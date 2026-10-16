import { describe, expect, it, vi } from 'vitest';
import { cardUrl, catalogUrl, consoleBases, consoleBasesForEnv } from './card-fetch';
import {
	currentCard,
	findGames,
	parseTips,
	readCachedCard,
	refreshGameCard,
	snapshotCard,
} from './loading-card';

class MemoryStore {
	map = new Map<string, string>();
	getItem(k: string): string | null {
		return this.map.get(k) ?? null;
	}
	setItem(k: string, v: string): void {
		this.map.set(k, v);
	}
}

/** `routes[url]` = body (200) hoặc `{ status, body }`; thiếu route = 404 kiểu Nest ("Cannot GET", chưa deploy). */
function fakeFetch(routes: Record<string, unknown>) {
	return vi.fn<(url: string) => Promise<unknown>>(async (url: string) => {
		const r = routes[url] as { status?: number; body?: unknown } | undefined;
		if (r === undefined)
			return { ok: false, status: 404, json: async () => ({ message: 'Cannot GET' }) };
		if (r.status !== undefined) return { ok: false, status: r.status, json: async () => r.body };
		return { ok: true, status: 200, json: async () => r };
	}) as unknown as typeof fetch;
}

const live = ['https://api-live', 'live'] as const;
const dev = ['https://api-dev', 'dev'] as const;
const bases = [live, dev];
const sandfall = {
	appName: 'Sandfall',
	displayName: 'Nibble Sands',
	description: 'Thả khối',
	loadingTips: [' Mẹo 1 ', '', 42, 'Mẹo 2'],
	loadingBgColor: '#1B2A4A',
};

describe('consoleBases / URL / findGames / parseTips', () => {
	it('env đang build trước, env còn lại sau; không rõ env thì live rồi dev', () => {
		expect(consoleBases('https://nibble-api.zingplay.dev/public/games').map(catalogUrl)).toEqual([
			'https://nibble-api.zingplay.dev/public/games?env=dev',
			'https://nibble-api.zingplay.com/public/games?env=live',
		]);
		expect(catalogUrl(consoleBases(null)[0]!)).toBe(
			'https://nibble-api.zingplay.com/public/games?env=live',
		);
		expect(consoleBasesForEnv('dev')[0]![1]).toBe('dev');
		expect(consoleBasesForEnv('off')[0]![1]).toBe('live');
	});
	it('URL thẻ mỏng mã hoá slug', () => {
		expect(cardUrl(dev, 'a b')).toBe('https://api-dev/public/games/a%20b/card?env=dev');
	});
	it('findGames tìm mảng appName dù lồng trong data/items', () => {
		expect(findGames({ data: { items: [{ appName: 'x' }] } })).toEqual([{ appName: 'x' }]);
		expect(findGames({ data: [] })).toEqual([]);
	});
	it('parseTips bỏ phần tử rỗng / không phải chuỗi / quá dài, tối đa 3', () => {
		expect(parseTips([' a ', '', 1, 'x'.repeat(141), 'b'])).toEqual(['a', 'b']);
		expect(parseTips(['1', '2', '3', '4', '5'])).toEqual(['1', '2', '3']);
		expect(parseTips('a')).toEqual([]);
	});
});

describe('refreshGameCard', () => {
	it('env đầu thiếu game thì thử env sau; lưu tên, mô tả, mẹo, màu nền', async () => {
		const storage = new MemoryStore();
		const fetchFn = fakeFetch({
			[catalogUrl(live)]: { data: [] },
			[catalogUrl(dev)]: { data: [sandfall] },
		});
		const card = await refreshGameCard('sandfall', { fetchFn, storage, bases });
		expect(card).toEqual({
			name: 'Nibble Sands',
			description: 'Thả khối',
			tips: ['Mẹo 1', 'Mẹo 2'],
			bgColor: '#1B2A4A',
		});
		expect(readCachedCard('SANDFALL', storage)?.tips).toEqual(['Mẹo 1', 'Mẹo 2']);
	});

	it('màu nền sai dạng thì bỏ (null)', async () => {
		const fetchFn = fakeFetch({
			[catalogUrl(live)]: { data: [{ ...sandfall, loadingBgColor: 'red' }] },
		});
		const card = await refreshGameCard('sandfall', { fetchFn, storage: null, bases });
		expect(card?.bgColor).toBeNull();
	});

	it('mạng lỗi / timeout: trả null, giữ cache cũ', async () => {
		const storage = new MemoryStore();
		storage.setItem('gk.loading.card.sandfall', JSON.stringify({ name: 'Cũ', description: '' }));
		const hang = vi.fn<() => Promise<never>>(
			() => new Promise(() => {}),
		) as unknown as typeof fetch;
		const card = await refreshGameCard('sandfall', {
			fetchFn: hang,
			storage,
			bases,
			timeoutMs: 5,
		});
		expect(card).toBeNull();
		expect(readCachedCard('sandfall', storage)?.name).toBe('Cũ');
	});
});

describe('refreshGameCard — route thẻ mỏng', () => {
	const slim = { ...sandfall, loadingTips: ['Mẹo 1'] };

	it('đủ cả hai Console bằng thẻ mỏng: KHÔNG chạm catalog; gộp tên từ env đầu, mẹo/màu từ env đầu có chúng', async () => {
		const fetchFn = fakeFetch({
			[cardUrl(live, 'sandfall')]: {
				appName: 'Sandfall',
				displayName: 'Live Name',
				description: 'L',
			},
			[cardUrl(dev, 'sandfall')]: slim,
		});
		const card = await refreshGameCard('sandfall', { fetchFn, storage: null, bases });
		expect(card).toEqual({
			name: 'Live Name',
			description: 'L',
			tips: ['Mẹo 1'],
			bgColor: '#1B2A4A',
		});
		const called = (fetchFn as unknown as { mock: { calls: string[][] } }).mock.calls.map(
			(c) => c[0],
		);
		expect(called.some((u) => u!.endsWith('/public/games?env=live'))).toBe(false);
		expect(called).toHaveLength(2);
	});

	it('Server chưa deploy route (404 Nest) ⇒ rơi về catalog của riêng Console đó', async () => {
		const fetchFn = fakeFetch({
			[cardUrl(dev, 'sandfall')]: slim,
			[catalogUrl(live)]: {
				data: [{ appName: 'Sandfall', displayName: 'Từ catalog live', description: '' }],
			},
		});
		const card = await refreshGameCard('sandfall', { fetchFn, storage: null, bases });
		expect(card?.name).toBe('Từ catalog live');
		expect(card?.tips).toEqual(['Mẹo 1']);
	});

	it('404 GAME_NOT_FOUND = game không có ở Console đó ⇒ KHÔNG tải catalog', async () => {
		const fetchFn = fakeFetch({
			[cardUrl(live, 'sandfall')]: { status: 404, body: { code: 'GAME_NOT_FOUND' } },
			[cardUrl(dev, 'sandfall')]: slim,
		});
		const card = await refreshGameCard('sandfall', { fetchFn, storage: null, bases });
		expect(card?.name).toBe('Nibble Sands');
		const called = (fetchFn as unknown as { mock: { calls: string[][] } }).mock.calls.map(
			(c) => c[0],
		);
		expect(called.every((u) => u!.includes('/card?'))).toBe(true);
	});

	it('thẻ mỏng lỗi mạng ⇒ vẫn rơi về catalog', async () => {
		const fetchFn = vi.fn<(url: string) => Promise<unknown>>(async (url: string) => {
			if (url.includes('/card?')) throw new Error('offline-ish');
			return { ok: true, status: 200, json: async () => ({ data: [sandfall] }) };
		}) as unknown as typeof fetch;
		const card = await refreshGameCard('sandfall', { fetchFn, storage: null, bases: [dev] });
		expect(card?.name).toBe('Nibble Sands');
	});
});

describe('currentCard — cache → snapshot lúc build → null', () => {
	const snap = { sandfall: { name: 'Snapshot', description: '', tips: ['s'], bgColor: '#112233' } };

	it('không cache ⇒ snapshot (khoá không phân biệt hoa thường)', () => {
		expect(currentCard('SandFall', new MemoryStore(), snap)?.name).toBe('Snapshot');
		expect(snapshotCard('sandfall', snap)?.bgColor).toBe('#112233');
	});

	it('cache có thì THẮNG snapshot (snapshot không đè bản mới hơn)', () => {
		const store = new MemoryStore();
		store.setItem('gk.loading.card.sandfall', JSON.stringify({ name: 'Cache', description: '' }));
		expect(currentCard('sandfall', store, snap)?.name).toBe('Cache');
	});

	it('không cache, không snapshot (hoặc hằng chưa define trong test) ⇒ null', () => {
		expect(currentCard('sandfall', new MemoryStore())).toBeNull();
		expect(currentCard('other', new MemoryStore(), snap)).toBeNull();
	});
});
