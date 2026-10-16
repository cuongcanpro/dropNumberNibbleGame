import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createTrackingRig, resetTrackingForTest } from '../testing/tracking-rig';
import { setGameMode, setGameSlug } from '../tracking/game-context';
import { fetchRank, RANK_TIMEOUT_MS, resetRankCacheForTest } from './rank-client';
import { fetchResultRank } from './result-rank';

const OK = {
	board: 'score',
	period: 'alltime',
	gameId: 1,
	gameSlug: 'sandfall',
	metric: 'score',
	score: 1000,
	rank: 47,
	totalPlayers: 5000,
	beaten: 4953,
	topPercent: 0.9,
	computedAt: '2026-09-02T11:30:00.000Z',
};

type Call = { url: string; headers: Record<string, string> };

function rankFetch(res: () => Promise<unknown>, calls: Call[] = []): typeof fetch {
	return (async (url: string, init: { headers: Record<string, string> }) => {
		calls.push({ url, headers: init.headers });
		return res();
	}) as unknown as typeof fetch;
}

const okRes = async () => ({ ok: true, json: async () => OK });

beforeEach(() => {
	resetRankCacheForTest();
});
afterEach(() => {
	resetTrackingForTest();
	resetRankCacheForTest();
	vi.useRealTimers();
});

describe('fetchRank', () => {
	it('GET đúng URL + X-App-Key, trả RankView', async () => {
		const calls: Call[] = [];
		createTrackingRig({ fetchFn: rankFetch(okRes, calls) });
		expect(await fetchRank({ gameSlug: 'sandfall', score: 1000 })).toEqual(OK);
		expect(calls[0]?.url).toBe(
			'https://console.test/public/leaderboard/rank?gameKey=sandfall&score=1000&board=score&period=alltime',
		);
		expect(calls[0]?.headers['X-App-Key']).toBe('k');
	});

	it('mode + board + period vào query và vào khoá cache', async () => {
		const calls: Call[] = [];
		createTrackingRig({ fetchFn: rankFetch(okRes, calls) });
		await fetchRank({ gameSlug: 'g', score: 5, board: 'carrot', period: 'daily', mode: ' Hard ' });
		expect(calls[0]?.url).toContain('board=carrot&period=daily&mode=hard');
		await fetchRank({ gameSlug: 'g', score: 5, board: 'carrot', period: 'daily', mode: 'easy' });
		expect(calls).toHaveLength(2); // mode khác ⇒ câu hỏi khác
	});

	it('cache hit: không bắn request thứ hai', async () => {
		const calls: Call[] = [];
		createTrackingRig({ fetchFn: rankFetch(okRes, calls) });
		await fetchRank({ gameSlug: 'sandfall', score: 1000 });
		await fetchRank({ gameSlug: 'sandfall', score: 1000 });
		expect(calls).toHaveLength(1);
	});

	it('offline ⇒ null, không đụng mạng', async () => {
		const calls: Call[] = [];
		const rig = createTrackingRig({ fetchFn: rankFetch(okRes, calls) });
		rig.net.state = 'offline';
		expect(await fetchRank({ gameSlug: 'g', score: 1 })).toBeNull();
		expect(calls).toHaveLength(0);
	});

	it('SDK tắt (chưa init) ⇒ null', async () => {
		expect(await fetchRank({ gameSlug: 'g', score: 1 })).toBeNull();
	});

	it('non-2xx / thiếu field / fetch ném ⇒ null', async () => {
		createTrackingRig({ fetchFn: rankFetch(async () => ({ ok: false })) });
		expect(await fetchRank({ gameSlug: 'g', score: 1 })).toBeNull();
		resetTrackingForTest();
		createTrackingRig({
			fetchFn: rankFetch(async () => ({ ok: true, json: async () => ({ rank: 'x' }) })),
		});
		expect(await fetchRank({ gameSlug: 'g', score: 1 })).toBeNull();
		resetTrackingForTest();
		createTrackingRig({
			fetchFn: rankFetch(async () => ({
				ok: true,
				json: async () => {
					throw new Error('parse');
				},
			})),
		});
		expect(await fetchRank({ gameSlug: 'g', score: 1 })).toBeNull();
		resetTrackingForTest();
		createTrackingRig({
			fetchFn: rankFetch(async () => {
				throw new Error('net');
			}),
		});
		expect(await fetchRank({ gameSlug: 'g', score: 1 })).toBeNull();
	});

	it('quá 2.5s ⇒ null (fake timers, không AbortController)', async () => {
		createTrackingRig({ fetchFn: rankFetch(() => new Promise(() => undefined)) });
		vi.useFakeTimers();
		const p = fetchRank({ gameSlug: 'g', score: 1 });
		await vi.advanceTimersByTimeAsync(RANK_TIMEOUT_MS);
		await expect(p).resolves.toBeNull();
	});

	it('endpoint lạ / điểm âm hoặc NaN ⇒ null, không gọi', async () => {
		const calls: Call[] = [];
		createTrackingRig({ endpoint: 'https://x.test/ingest', fetchFn: rankFetch(okRes, calls) });
		expect(await fetchRank({ gameSlug: 'g', score: 1 })).toBeNull();
		resetTrackingForTest();
		createTrackingRig({ fetchFn: rankFetch(okRes, calls) });
		expect(await fetchRank({ gameSlug: 'g', score: -1 })).toBeNull();
		expect(await fetchRank({ gameSlug: 'g', score: Number.NaN })).toBeNull();
		expect(calls).toHaveLength(0);
	});
});

describe('fetchResultRank', () => {
	it('chưa có slug ⇒ null; có slug+mode ⇒ dùng game-context', async () => {
		const calls: Call[] = [];
		createTrackingRig({ fetchFn: rankFetch(okRes, calls) });
		expect(await fetchResultRank(10)).toBeNull();
		setGameSlug('sandfall');
		setGameMode('Hard');
		await fetchResultRank(10, { period: 'weekly' });
		expect(calls[0]?.url).toContain(
			'gameKey=sandfall&score=10&board=score&period=weekly&mode=hard',
		);
	});

	it('opts.mode ghi đè game-context; "" = không mode', async () => {
		const calls: Call[] = [];
		createTrackingRig({ fetchFn: rankFetch(okRes, calls) });
		setGameSlug('numpuz');
		setGameMode('x');
		await fetchResultRank(1234, { mode: 'classic_3x3' });
		expect(calls[0]?.url).toContain('score=1234&board=score&period=alltime&mode=classic_3x3');
		await fetchResultRank(5, { mode: '' });
		expect(calls[1]?.url).not.toContain('mode=');
	});
});
