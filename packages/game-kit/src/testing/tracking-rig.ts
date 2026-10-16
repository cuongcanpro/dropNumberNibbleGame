import { resetGameContextForTest } from '../tracking/game-context';
import { resetGameSessionForTest } from '../tracking/game-session';
import { initTracking, resetForTest } from '../tracking/track';
import type { NetworkState, StorageAdapter, TrackConfig } from '../tracking/types';

export interface SentBatch {
	url: string;
	headers: Record<string, string>;
	body: Record<string, unknown> & { events: Record<string, unknown>[] };
}

export interface TrackingRig {
	storage: StorageAdapter & { dump(key: string): string | null };
	sent: SentBatch[];
	clock: { t: number };
	net: { state: NetworkState };
	fail: { on: boolean };
	/** Số lần fetch được gọi (kể cả lần fail). */
	counter: { attempts: number };
}

/**
 * Dựng tracking SDK THẬT với fetch giả bắt body — dùng chung cho test contract/collector.
 * Gọi `resetTrackingForTest()` ở afterEach (timer flush 60s phải được dọn).
 */
export function createTrackingRig(over: Partial<TrackConfig> = {}): TrackingRig {
	const map = new Map<string, string>();
	const storage = {
		get: (k: string) => map.get(k) ?? null,
		set: (k: string, v: string) => void map.set(k, v),
		dump: (k: string) => map.get(k) ?? null,
	};
	const rig: TrackingRig = {
		storage,
		sent: [],
		clock: { t: Date.UTC(2026, 9, 4, 10, 0, 0) },
		net: { state: 'wifi' },
		fail: { on: false },
		counter: { attempts: 0 },
	};
	initTracking({
		endpoint: 'https://console.test/public/events',
		appKey: 'k',
		source: 'game',
		device: {
			device_id: 'dev-1',
			platform: 'nibi-android',
			app_version: '1.2.3',
			build_commit: 'abc1234',
			os_name: 'Android',
			os_version: '14',
			model: 'Pixel',
			locale: 'vi-VN',
		},
		getNetworkState: () => rig.net.state,
		storage,
		now: () => rig.clock.t,
		fetchFn: (async (url: string, init: { headers: Record<string, string>; body: string }) => {
			rig.counter.attempts += 1;
			if (rig.fail.on) return { ok: false, status: 500 } as Response;
			rig.sent.push({ url, headers: init.headers, body: JSON.parse(init.body) });
			return { ok: true, status: 200 } as Response;
		}) as unknown as typeof fetch,
		...over,
	});
	return rig;
}

export function resetTrackingForTest(): void {
	resetForTest();
	resetGameSessionForTest();
	resetGameContextForTest();
}
