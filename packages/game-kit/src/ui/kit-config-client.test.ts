import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { KIT_CONFIG_DEFAULTS } from '../shell/kit-config';
import { readKitConfig, resetKitConfigForTest } from '../shell/kit-config-store';
import {
	deviceLang,
	kitConfigKey,
	readCachedKitConfig,
	refreshKitConfig,
	resetKitConfigClientForTest,
	startKitConfig,
} from './kit-config-client';

class MemoryStore {
	map = new Map<string, string>();
	getItem(k: string): string | null {
		return this.map.get(k) ?? null;
	}
	setItem(k: string, v: string): void {
		this.map.set(k, v);
	}
}

const body = (parts: unknown) => ({ parts, updatedAt: 't' });
function fakeFetch(routes: Record<string, unknown>) {
	return vi.fn<(url: string) => Promise<unknown>>(async (url: string) =>
		routes[url] === undefined
			? { ok: false, json: async () => ({}) }
			: { ok: true, json: async () => routes[url] },
	) as unknown as typeof fetch;
}
const url = (base: string, slug = 'sandfall', lang = 'vi') =>
	`${base}/public/kit-config?gameKey=${slug}&lang=${lang}`;
const noop = (): void => undefined;
const BASES = ['https://own', 'https://other'];

beforeEach(() => {
	resetKitConfigForTest();
	resetKitConfigClientForTest();
});
afterEach(() => vi.useRealTimers());

describe('deviceLang', () => {
	it('vi* ⇒ vi, còn lại en', () => {
		expect(deviceLang('vi-VN')).toBe('vi');
		expect(deviceLang('VI')).toBe('vi');
		expect(deviceLang('en-US')).toBe('en');
		expect(deviceLang('fr')).toBe('en');
	});
});

describe('refreshKitConfig', () => {
	it('gọi đúng URL, lưu cache theo slug+lang, env build (đứng đầu) thắng', async () => {
		const store = new MemoryStore();
		const f = fakeFetch({
			[url('https://own')]: body({ hud: { showHome: false } }),
			[url('https://other')]: body({ hud: { showHome: true } }),
		});
		const cfg = await refreshKitConfig({
			slug: 'sandfall',
			lang: 'vi',
			fetchFn: f,
			storage: store,
			bases: BASES,
		});
		expect(cfg?.hud.showHome).toBe(false);
		expect(f).toHaveBeenCalledTimes(2);
		expect(store.map.has(kitConfigKey('sandfall', 'vi'))).toBe(true);
		expect(readCachedKitConfig('sandfall', 'vi', store)?.hud.showHome).toBe(false);
		expect(readCachedKitConfig('sandfall', 'en', store)).toBeNull();
	});

	it('env build chưa có route (404) ⇒ rơi sang env còn lại', async () => {
		const f = fakeFetch({ [url('https://other')]: body({ rank: { layout: 'off' } }) });
		const cfg = await refreshKitConfig({
			slug: 'sandfall',
			lang: 'vi',
			fetchFn: f,
			storage: null,
			bases: BASES,
		});
		expect(cfg?.rank.layout).toBe('off');
	});

	it('mạng ném / body không có parts / không có slug ⇒ null, cache cũ giữ nguyên', async () => {
		const store = new MemoryStore();
		store.setItem(
			kitConfigKey('sandfall', 'vi'),
			JSON.stringify(body({ hud: { showHome: false } })),
		);
		const boom = vi.fn<() => Promise<unknown>>(async () => {
			throw new Error('net');
		}) as unknown as typeof fetch;
		const opts = { slug: 'sandfall', lang: 'vi' as const, storage: store, bases: BASES };
		expect(await refreshKitConfig({ ...opts, fetchFn: boom })).toBeNull();
		expect(
			await refreshKitConfig({ ...opts, fetchFn: fakeFetch({ [url('https://own')]: { x: 1 } }) }),
		).toBeNull();
		expect(await refreshKitConfig({ ...opts, slug: '', fetchFn: boom })).toBeNull();
		expect(readCachedKitConfig('sandfall', 'vi', store)?.hud.showHome).toBe(false);
	});

	it('quá timeout ⇒ null, không treo', async () => {
		vi.useFakeTimers();
		const hang = vi.fn<() => Promise<unknown>>(
			() => new Promise(() => undefined),
		) as unknown as typeof fetch;
		const p = refreshKitConfig({
			slug: 's',
			lang: 'en',
			fetchFn: hang,
			storage: null,
			bases: BASES,
			timeoutMs: 1000,
		});
		await vi.advanceTimersByTimeAsync(1000);
		await expect(p).resolves.toBeNull();
	});
});

const deps = (store: MemoryStore, f: typeof fetch) => ({
	slug: 'sandfall',
	lang: 'vi' as const,
	fetchFn: f,
	storage: store,
	bases: BASES,
});

describe('startKitConfig (phiên)', () => {
	it('cache nạp đồng bộ; bản tươi tới TRƯỚC lần đọc đầu thì thắng', async () => {
		const store = new MemoryStore();
		store.setItem(
			kitConfigKey('sandfall', 'vi'),
			JSON.stringify(body({ hud: { showHome: false } })),
		);
		const f = fakeFetch({
			[url('https://own')]: body({ hud: { showHome: true, showSetting: false } }),
		});
		const p = startKitConfig(deps(store, f));
		await p;
		const cfg = readKitConfig();
		expect(cfg.hud).toEqual({ showHome: true, showSetting: false });
	});

	it('đã có người đọc thì bản tươi KHÔNG đổi giữa phiên, nhưng được cache cho lần sau', async () => {
		const store = new MemoryStore();
		store.setItem(
			kitConfigKey('sandfall', 'vi'),
			JSON.stringify(body({ hud: { showHome: false } })),
		);
		let release: (v: unknown) => void = noop;
		const f = vi.fn<() => Promise<unknown>>(
			() => new Promise((r) => (release = r)),
		) as unknown as typeof fetch;
		const p = startKitConfig({ ...deps(store, f), bases: ['https://own'] });
		expect(readKitConfig().hud.showHome).toBe(false); // popup đầu mở ⇒ chốt bản cache
		release({ ok: true, json: async () => body({ hud: { showHome: true } }) });
		await p;
		expect(readKitConfig().hud.showHome).toBe(false);
		expect(readCachedKitConfig('sandfall', 'vi', store)?.hud.showHome).toBe(true);
	});

	it('offline + chưa cache ⇒ mặc định của kit; không có slug ⇒ không làm gì', async () => {
		const boom = vi.fn<() => Promise<unknown>>(async () => {
			throw new Error('net');
		}) as unknown as typeof fetch;
		await startKitConfig(deps(new MemoryStore(), boom));
		expect(readKitConfig()).toEqual(KIT_CONFIG_DEFAULTS);
		resetKitConfigClientForTest();
		const none = fakeFetch({});
		await startKitConfig({ fetchFn: none, storage: null, bases: BASES, slug: '' });
		expect(none).not.toHaveBeenCalled();
	});
});
