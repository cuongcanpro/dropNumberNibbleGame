import { afterEach, describe, expect, it } from 'vitest';
import type { MetricSink } from '../metrics/metric-sink';
import { wrapSinkWithTracking } from './sink-bridge';
/**
 * Kịch bản nghiệm thu "máy bay" (plan phase 05 Task 5.5, chạy ở tầng SDK↔Console
 * vì Cocos simulator không chạy được trên máy dev — fallback ghi trong plan risks):
 *   offline chơi 2 "phiên" (kill app giữa chừng) → bật mạng → queue xả sạch →
 *   verify ClickHouse bằng device_id (làm ngoài test, qua curl).
 * Gated: CONSOLE_URL + EVENTS_APP_KEY.
 */
import { emit, flushNow, initTracking, resetForTest } from './track';
import type { NetworkState, QueuedEvent, StorageAdapter, TrackConfig } from './types';
import { STORAGE_KEY } from './types';

const CONSOLE_URL = process.env['CONSOLE_URL'];
const APP_KEY = process.env['EVENTS_APP_KEY'];
const maybe = CONSOLE_URL && APP_KEY ? describe : describe.skip;

// storage BỀN xuyên "kill app" — cùng Map qua nhiều lần init
const persistent = new Map<string, string>();
const storage: StorageAdapter = {
	get: (k) => persistent.get(k) ?? null,
	set: (k, v) => void persistent.set(k, v),
};
const noopSink = new Proxy({}, { get: () => () => undefined }) as MetricSink; // đường zal cũ: nuốt

let network: NetworkState = 'offline';
const DEVICE = `airplane-${Date.now()}`;

function boot(): MetricSink {
	initTracking({
		endpoint: `${CONSOLE_URL}/public/events`,
		appKey: APP_KEY as string,
		source: 'game',
		device: {
			device_id: DEVICE,
			platform: 'android',
			app_version: '1.0.0',
			os_name: 'Android',
			os_version: '14',
			model: 'AirplaneRig',
			locale: 'vi-VN',
		},
		getNetworkState: () => network,
		storage,
	} satisfies TrackConfig);
	return wrapSinkWithTracking(noopSink, emit, () => 'sandfall');
}
const dump = (): QueuedEvent[] => JSON.parse(persistent.get(STORAGE_KEY) ?? '[]') as QueuedEvent[];

maybe('kịch bản máy bay: 2 phiên offline + kill app → bật mạng → xả sạch', () => {
	afterEach(() => resetForTest());

	it('phiên 1 offline: chơi sandfall, event nằm queue', async () => {
		const sink = boot();
		sink.gameScoreStart({ attemptNumber: 1 });
		sink.gameCustomEvent(-1, 'game_score_heartbeat', { score: 120 });
		sink.gameBooster(-1, 'used', { boosterId: 'undo' });
		sink.gameScoreEnd({
			score: 890,
			durationSec: 300,
			attemptNumber: 1,
			isPersonalBest: true,
			reason: 'game_over',
		});
		await flushNow(); // offline → không được gửi gì
		expect(dump().length).toBe(4);
		// KILL APP = resetForTest (afterEach) — storage GIỮ NGUYÊN
	});

	it('phiên 2 sau kill: queue sống, chơi tiếp haredoku, session MỚI', async () => {
		const sink = boot();
		expect(dump().length).toBe(4); // sống qua kill
		const wrapped = wrapSinkWithTracking(noopSink, emit, () => 'haredoku');
		wrapped.gameLevelStart(7, { attemptNumber: 2, gameData: { boardSize: 6, isHard: true } });
		wrapped.gameCustomEvent(7, 'game_level_hint', { kind: 'hint', progressPercent: 40 });
		wrapped.gameLevelFail(7, {
			durationSec: 95,
			reason: 'out_of_resource',
			gameData: { progressPercent: 72 },
		});
		const all = dump();
		expect(all.length).toBe(7);
		expect(new Set(all.map((e) => e.session_id)).size).toBe(2); // 2 phiên = 2 session
		expect(all[0].seq_no).toBe(1);
		expect(all[4].seq_no).toBe(1); // session mới reset seq
		void sink;
	});

	it('bật mạng → flush → queue xả SẠCH (server nhận đủ 7)', async () => {
		boot();
		network = 'wifi';
		await flushNow();
		expect(dump().length).toBe(0);
		console.log(`[airplane] verify CH: device_id='${DEVICE}'`);
	});
});
