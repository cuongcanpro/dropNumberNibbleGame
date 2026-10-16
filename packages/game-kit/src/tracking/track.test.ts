/* oxlint-disable unicorn/consistent-function-scoping, vitest/require-mock-type-parameters -- test port từ Cocos, giữ cấu trúc để đối chiếu */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { emit, flushNow, initTracking, resetForTest } from './track';
import type { QueuedEvent, StorageAdapter, TrackConfig } from './types';
import { FLUSH_THRESHOLD, SESSION_GAP_MS, STORAGE_KEY } from './types';

function fakeStorage(): StorageAdapter & { dump(): QueuedEvent[] } {
	const m = new Map<string, string>();
	return {
		get: (k) => m.get(k) ?? null,
		set: (k, v) => void m.set(k, v),
		dump: () => JSON.parse(m.get(STORAGE_KEY) ?? '[]') as QueuedEvent[],
	};
}

function cfg(over: Partial<TrackConfig> = {}): TrackConfig {
	return {
		endpoint: 'http://console.local/public/events',
		appKey: 'k',
		source: 'game',
		device: {
			device_id: 'd1',
			platform: 'android',
			app_version: '1',
			os_name: 'A',
			os_version: '14',
			model: 'P',
			locale: 'vi',
		},
		getNetworkState: () => 'offline', // mặc định offline — không đụng fetch
		storage: fakeStorage(),
		now: () => 1_000_000,
		...over,
	};
}

afterEach(() => resetForTest());

describe('track', () => {
	it('emit TRƯỚC init → không throw, không mất (nhập queue sau init)', async () => {
		expect(() => emit('early_action')).not.toThrow();
		const store = fakeStorage();
		initTracking(cfg({ storage: store }));
		await Promise.resolve(); // persist gộp theo microtask (review H2)
		expect(store.dump().map((e) => e.action)).toContain('early_action');
	});

	it('emit gắn event_id uuid + seq_no tăng dần trong session', async () => {
		const store = fakeStorage();
		initTracking(cfg({ storage: store }));
		emit('a', { gameSlug: 'pilot', levelId: 3, value: 120 });
		emit('b');
		await Promise.resolve();
		const [e1, e2] = store.dump();
		expect(e1.event_id).toMatch(/^[0-9a-f-]{36}$/);
		expect(e1.seq_no).toBe(1);
		expect(e2.seq_no).toBe(2);
		expect(e1.session_id).toBe(e2.session_id);
		expect(e1.level_id).toBe(3);
		expect(e1.value).toBe(120);
		expect(e1.network_state).toBe('offline');
	});

	it('gap >30 phút → session mới, seq_no reset', async () => {
		const store = fakeStorage();
		const nowRef = { t: 1_000_000 };
		initTracking(cfg({ storage: store, now: () => nowRef.t }));
		emit('a');
		nowRef.t += SESSION_GAP_MS + 1;
		emit('b');
		await Promise.resolve();
		const [e1, e2] = store.dump();
		expect(e2.session_id).not.toBe(e1.session_id);
		expect(e2.seq_no).toBe(1);
	});

	it('đủ ngưỡng 50 event → tự flush (khi online)', () => {
		const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 });
		initTracking(
			cfg({ getNetworkState: () => 'wifi', fetchFn: fetchMock as unknown as typeof fetch }),
		);
		for (let i = 0; i < FLUSH_THRESHOLD; i++) emit(`a${i}`);
		expect(fetchMock).toHaveBeenCalled();
	});

	it('storage throw → emit vẫn không lan lỗi ra caller', () => {
		const broken: StorageAdapter = {
			get: () => {
				throw new Error('x');
			},
			set: () => {
				throw new Error('x');
			},
		};
		initTracking(cfg({ storage: broken }));
		expect(() => emit('a')).not.toThrow();
	});

	it('flushNow export cho host gọi lúc mở app / mạng quay lại', async () => {
		const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 });
		initTracking(
			cfg({ getNetworkState: () => 'wifi', fetchFn: fetchMock as unknown as typeof fetch }),
		);
		emit('a'); // 1 event < ngưỡng 50 → emit KHÔNG tự flush
		await flushNow();
		expect(fetchMock).toHaveBeenCalledTimes(1);
	});
});

// Đẩy ngay event THÀNH TÍCH (sự cố 09/09: level 10 chơi 10:39 nhưng 21:59 mới lên
// server vì người chơi đóng app — nhịp 60s không kịp, ngưỡng 50 event không bao giờ
// chạm với ~1 level/phút).
describe('đẩy ngay event thành tích', () => {
	const online = (sent: unknown[]): Partial<TrackConfig> => ({
		// cfg() mặc định 'offline' để không đụng fetch — test này CẦN online, nếu
		// không FlushLoop bỏ qua và mọi khẳng định đều xanh giả.
		getNetworkState: () => 'wifi',
		fetchFn: (async () => {
			sent.push(1);
			return { ok: true } as Response;
		}) as unknown as TrackConfig['fetchFn'],
	});
	const tick = () => new Promise((r) => setTimeout(r, 0));

	it('game_level_complete đẩy NGAY, không chờ 60s hay đủ 50 event', async () => {
		const sent: unknown[] = [];
		initTracking(cfg(online(sent)));

		emit('game_level_complete', { levelId: 10 });
		await tick();

		expect(sent.length).toBe(1);
	});

	it('event đo đạc KHÔNG đẩy ngay — tránh đốt pin/data cho thứ không ai nhìn', async () => {
		const sent: unknown[] = [];
		initTracking(cfg(online(sent)));

		emit('game_score_heartbeat');
		emit('portal_screen_view');
		await tick();

		expect(sent.length).toBe(0);
	});
});
