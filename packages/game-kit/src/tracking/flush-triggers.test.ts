import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createTrackingRig, resetTrackingForTest } from '../testing/tracking-rig';
import { FETCH_TIMEOUT_MS } from './flush-loop';
import { emit, flushNow } from './track';
import {
	BACKOFF_BASE_MS,
	BACKOFF_CAP_MS,
	FLUSH_INTERVAL_MS,
	FLUSH_THRESHOLD,
	SESSION_GAP_MS,
	STORAGE_KEY,
} from './types';

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
	resetTrackingForTest();
	vi.useRealTimers();
});

const queued = (rig: ReturnType<typeof createTrackingRig>): number =>
	(JSON.parse(rig.storage.dump(STORAGE_KEY) ?? '[]') as unknown[]).length;

describe('hằng số khớp Cocos', () => {
	it('giá trị', () => {
		expect([FLUSH_THRESHOLD, FLUSH_INTERVAL_MS, BACKOFF_BASE_MS, BACKOFF_CAP_MS]).toEqual([
			50, 60_000, 1_000, 300_000,
		]);
		expect(SESSION_GAP_MS).toBe(30 * 60_000);
	});
});

describe('flush triggers', () => {
	it('đủ 50 event → flush; 49 thì chưa', async () => {
		const rig = createTrackingRig();
		for (let i = 0; i < FLUSH_THRESHOLD - 1; i++) emit('a');
		await vi.advanceTimersByTimeAsync(0);
		expect(rig.sent).toHaveLength(0);
		emit('a');
		await vi.advanceTimersByTimeAsync(0);
		expect(rig.sent).toHaveLength(1);
		expect(queued(rig)).toBe(0);
	});

	it('timer 60s xả queue, 59s thì chưa', async () => {
		const rig = createTrackingRig();
		emit('a');
		await vi.advanceTimersByTimeAsync(FLUSH_INTERVAL_MS - 1000);
		expect(rig.sent).toHaveLength(0);
		await vi.advanceTimersByTimeAsync(1000);
		expect(rig.sent).toHaveLength(1);
	});

	it.each(['game_level_complete', 'game_score_end'])('%s đẩy ngay', async (action) => {
		const rig = createTrackingRig();
		emit(action);
		await vi.advanceTimersByTimeAsync(0);
		expect(rig.sent).toHaveLength(1);
	});

	it.each(['game_level_start', 'game_level_fail', 'game_open', 'game_exit'])(
		'%s KHÔNG đẩy ngay',
		async (action) => {
			const rig = createTrackingRig();
			emit(action);
			await vi.advanceTimersByTimeAsync(0);
			expect(rig.sent).toHaveLength(0);
		},
	);

	it('offline: không gọi fetch, queue giữ; online lại thì xả', async () => {
		const rig = createTrackingRig();
		rig.net.state = 'offline';
		emit('game_level_complete');
		await vi.advanceTimersByTimeAsync(FLUSH_INTERVAL_MS * 3);
		expect(rig.sent).toHaveLength(0);
		expect(queued(rig)).toBe(1);
		rig.net.state = 'wifi';
		await flushNow();
		expect(rig.sent).toHaveLength(1);
		expect(queued(rig)).toBe(0);
	});
});

describe('backoff', () => {
	it('1s → 2s → 4s … → cap 300s; chặn trong cửa sổ; thành công thì reset', async () => {
		const rig = createTrackingRig();
		rig.fail.on = true;
		emit('a');
		await flushNow(); // lần 1 fail
		expect(rig.counter.attempts).toBe(1);
		const waits = [1, 2, 4, 8, 16, 32, 64, 128, 256, 300, 300].map((s) => s * 1000);
		let attempts = 1;
		for (const wait of waits) {
			rig.clock.t += wait - 1;
			await flushNow();
			expect(rig.counter.attempts).toBe(attempts); // còn trong cửa sổ backoff
			rig.clock.t += 1;
			await flushNow();
			attempts += 1;
			expect(rig.counter.attempts).toBe(attempts); // hết cửa sổ → thử lại (và fail tiếp)
		}
		expect(queued(rig)).toBe(1); // fail không mất event
		rig.fail.on = false;
		rig.clock.t += BACKOFF_CAP_MS;
		await flushNow();
		expect(queued(rig)).toBe(0);
		// reset: lần fail kế tiếp lại bắt đầu ở 1s
		rig.fail.on = true;
		emit('b');
		await flushNow();
		const n = rig.counter.attempts;
		rig.clock.t += BACKOFF_BASE_MS;
		await flushNow();
		expect(rig.counter.attempts).toBe(n + 1);
	});

	it('fetch treo quá FETCH_TIMEOUT_MS → coi là fail, queue giữ, không kẹt flushing', async () => {
		const rig = createTrackingRig({
			fetchFn: (() => new Promise(() => undefined)) as unknown as typeof fetch,
		});
		emit('a');
		const p = flushNow();
		await vi.advanceTimersByTimeAsync(FETCH_TIMEOUT_MS + 1);
		await p;
		expect(queued(rig)).toBe(1);
	});
});

describe('session', () => {
	it('gap > 30 phút → session_id mới, seq_no reset; trong gap thì giữ', async () => {
		const rig = createTrackingRig();
		emit('a');
		rig.clock.t += SESSION_GAP_MS - 1;
		emit('b');
		rig.clock.t += SESSION_GAP_MS + 1;
		emit('c');
		await Promise.resolve(); // persist gộp theo microtask (review H2)
		const ev = JSON.parse(rig.storage.dump(STORAGE_KEY) ?? '[]') as {
			session_id: string;
			seq_no: number;
		}[];
		expect(ev[1]!.session_id).toBe(ev[0]!.session_id);
		expect(ev[2]!.session_id).not.toBe(ev[0]!.session_id);
		expect(ev.map((e) => e.seq_no)).toEqual([1, 2, 1]);
	});
});
