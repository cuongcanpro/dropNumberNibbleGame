import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { buildListingSnapshot, detectGameSlugs, listingSnapshot } from './listing-snapshot';

const sandfall = {
	appName: 'sandfall',
	displayName: 'Nibble Sands',
	description: 'Thả khối',
	loadingTips: ['Mẹo 1'],
	loadingBgColor: '#0B1020',
};

function fetchOk(card: unknown = sandfall): typeof fetch {
	return vi.fn<(url: string) => Promise<unknown>>(async (url: string) =>
		url.includes('/card?')
			? { ok: true, status: 200, json: async () => card }
			: { ok: false, status: 404, json: async () => ({}) },
	) as unknown as typeof fetch;
}
const fetchDown = vi.fn<() => Promise<never>>(async () => {
	throw new TypeError('fetch failed');
}) as unknown as typeof fetch;

describe('detectGameSlugs', () => {
	it('đọc slug từ gameSlug: và hằng *_SLUG, bỏ template, bỏ test, không lặp', () => {
		const root = mkdtempSync(join(tmpdir(), 'gk-slug-'));
		mkdirSync(join(root, 'game'));
		writeFileSync(
			join(root, 'main.ts'),
			"initGameShell({ gameSlug: 'harucat', mode: 1 });\ninitGameShell({ gameSlug: GAME_SLUG });",
		);
		writeFileSync(
			join(root, 'game', 'c.ts'),
			'export const GAME_SLUG = \'hareBlast\';\nconst X_GAME_SLUG = "hareBlast";',
		);
		writeFileSync(join(root, 'tpl.ts'), "export const GAME_SLUG = '{{gameSlug}}';");
		writeFileSync(join(root, 'c.test.ts'), "const T_SLUG = 'fake';");
		expect(detectGameSlugs(root).sort()).toEqual(['hareBlast', 'harucat']);
	});
	it('thư mục không tồn tại ⇒ rỗng', () => {
		expect(detectGameSlugs('/khong/ton/tai')).toEqual([]);
	});
});

describe('buildListingSnapshot', () => {
	it('khoá theo slug viết thường, giá trị là GameCard đã gộp', async () => {
		const snap = await buildListingSnapshot({
			slugs: ['Sandfall'],
			env: 'dev',
			fetchFn: fetchOk(),
		});
		expect(snap['sandfall']).toEqual({
			name: 'Nibble Sands',
			description: 'Thả khối',
			tips: ['Mẹo 1'],
			bgColor: '#0B1020',
		});
	});

	it('mạng chết ⇒ KHÔNG ném, trả {} và cảnh báo', async () => {
		const warn = vi.fn<(msg: string) => void>();
		const snap = await buildListingSnapshot({
			slugs: ['sandfall'],
			env: 'dev',
			fetchFn: fetchDown,
			warn,
		});
		expect(snap).toEqual({});
		expect(warn).toHaveBeenCalledOnce();
	});

	it('slug nào không có thẻ thì bỏ riêng slug đó', async () => {
		const fetchFn = vi.fn<(url: string) => Promise<unknown>>(async (url: string) =>
			url.includes('/sandfall/')
				? { ok: true, status: 200, json: async () => sandfall }
				: { ok: false, status: 404, json: async () => ({ code: 'GAME_NOT_FOUND' }) },
		) as unknown as typeof fetch;
		const snap = await buildListingSnapshot({ slugs: ['sandfall', 'lạ'], env: 'live', fetchFn });
		expect(Object.keys(snap)).toEqual(['sandfall']);
	});
});

const run = async (mode: string, env: Record<string, string>, fetchFn: typeof fetch) => {
	const root = mkdtempSync(join(tmpdir(), 'gk-plug-'));
	mkdirSync(join(root, 'src'));
	writeFileSync(join(root, 'src', 'main.ts'), "initGameShell({ gameSlug: 'sandfall' });");
	const hook = listingSnapshot(mode, root, { fetchFn, env }).config as () => Promise<{
		define: Record<string, string>;
	}>;
	return JSON.parse(Object.values((await hook()).define)[0]!) as Record<string, unknown>;
};

describe('listingSnapshot plugin', () => {
	it('nibi + dev ⇒ nhúng thẻ', async () => {
		expect(Object.keys(await run('nibi', { NB_CONSOLE_ENV: 'dev' }, fetchOk()))).toEqual([
			'sandfall',
		]);
	});
	it('nibi + mạng chết ⇒ {} (build không hỏng)', async () => {
		expect(await run('nibi', { NB_CONSOLE_ENV: 'live' }, fetchDown)).toEqual({});
	});
	it('mode khác nibi / env off / tắt thủ công ⇒ {} và KHÔNG gọi mạng', async () => {
		const f = fetchOk();
		expect(await run('production', { NB_CONSOLE_ENV: 'dev' }, f)).toEqual({});
		expect(await run('nibi', { NB_CONSOLE_ENV: 'off' }, f)).toEqual({});
		expect(await run('nibi', { NB_CONSOLE_ENV: 'dev', NB_LISTING_SNAPSHOT: 'off' }, f)).toEqual({});
		expect(f).not.toHaveBeenCalled();
	});
});
