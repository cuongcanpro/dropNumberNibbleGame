/* oxlint-disable vitest/require-mock-type-parameters -- test port từ Cocos, giữ cấu trúc để đối chiếu */
import { describe, expect, it, type Mock, vi } from 'vitest';
import { EventQueue } from './event-queue';
import { FETCH_TIMEOUT_MS, FlushLoop } from './flush-loop';
import type { NetworkState, QueuedEvent, StorageAdapter, TrackConfig } from './types';
import { BATCH_MAX } from './types';

function fakeStorage(): StorageAdapter {
	const m = new Map<string, string>();
	return { get: (k) => m.get(k) ?? null, set: (k, v) => void m.set(k, v) };
}
const evt = (id: string): QueuedEvent => ({
	event_id: `00000000-0000-4000-8000-${id.padStart(12, '0')}`,
	ts: '2026-08-26T10:00:00.000Z',
	session_id: 's1',
	seq_no: 1,
	source: 'game',
	game_slug: 'pilot',
	action: 'a',
	network_state: 'offline',
	payload: '{}',
});

function setup(opts: { network?: NetworkState; fetchImpl?: Mock; nowRef?: { t: number } }) {
	const queue = new EventQueue(fakeStorage());
	const fetchMock = opts.fetchImpl ?? vi.fn().mockResolvedValue({ ok: true, status: 200 });
	const nowRef = opts.nowRef ?? { t: 1_000_000 };
	const cfg: TrackConfig = {
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
		getNetworkState: () => opts.network ?? 'wifi',
		storage: fakeStorage(),
		fetchFn: fetchMock as unknown as typeof fetch,
		now: () => nowRef.t,
	};
	return { queue, fetchMock, nowRef, loop: new FlushLoop(queue, cfg) };
}

describe('FlushLoop', () => {
	it('KHÔNG flush khi offline — không gọi fetch, queue giữ nguyên', async () => {
		const { queue, fetchMock, loop } = setup({ network: 'offline' });
		queue.append(evt('1'));
		await loop.flushNow();
		expect(fetchMock).not.toHaveBeenCalled();
		expect(queue.size()).toBe(1);
	});

	it('flush khi online: batch ≤500, 200 → xoá khỏi queue', async () => {
		const { queue, fetchMock, loop } = setup({});
		for (let i = 0; i < BATCH_MAX + 100; i++) queue.append(evt(String(i)));
		await loop.flushNow();
		expect(fetchMock).toHaveBeenCalledTimes(2); // 500 + 100
		const firstBody = JSON.parse((fetchMock.mock.calls[0] as [string, { body: string }])[1].body);
		expect(firstBody.events).toHaveLength(BATCH_MAX);
		expect(firstBody.device.device_id).toBe('d1');
		expect(queue.size()).toBe(0);
	});

	it('fail giữ NGUYÊN queue + backoff chặn retry dồn dập', async () => {
		const fetchImpl = vi.fn().mockRejectedValue(new Error('net'));
		const nowRef = { t: 1_000_000 };
		const { queue, fetchMock, loop } = setup({ fetchImpl, nowRef });
		queue.append(evt('1'));
		await loop.flushNow();
		expect(queue.size()).toBe(1); // fail → giữ nguyên
		await loop.flushNow(); // trong backoff window 1s → không gọi thêm
		expect(fetchMock).toHaveBeenCalledTimes(1);
		nowRef.t += 1_100; // qua backoff 1s
		await loop.flushNow();
		expect(fetchMock).toHaveBeenCalledTimes(2);
	});

	it('200 có rejected → vẫn xoá khỏi queue (server đã nhận, gửi lại cũng hỏng y vậy)', async () => {
		const fetchImpl = vi.fn().mockResolvedValue({ ok: true, status: 200 });
		const { queue, loop } = setup({ fetchImpl });
		queue.append(evt('1'));
		await loop.flushNow();
		expect(queue.size()).toBe(0);
	});

	it('header mang X-App-Key, gửi đúng endpoint', async () => {
		const { queue, fetchMock, loop } = setup({});
		queue.append(evt('1'));
		await loop.flushNow();
		const [url, init] = fetchMock.mock.calls[0] as [string, { headers: Record<string, string> }];
		expect(url).toBe('http://console.local/public/events');
		expect(init.headers['X-App-Key']).toBe('k');
	});

	it('fetch treo: sau 15s bỏ chờ, batch vẫn trong queue, vòng sau hồi phục', async () => {
		vi.useFakeTimers();
		try {
			const hang = vi.fn().mockReturnValue(new Promise(() => {})); // không bao giờ resolve
			const nowRef = { t: 1_000_000 };
			const { queue, fetchMock, loop } = setup({ fetchImpl: hang, nowRef });
			queue.append(evt('1'));
			const run = loop.flushNow();
			await vi.advanceTimersByTimeAsync(FETCH_TIMEOUT_MS);
			await run;
			expect(queue.size()).toBe(1); // timeout ≠ đã gửi
			expect(fetchMock).toHaveBeenCalledTimes(1);

			fetchMock.mockResolvedValue({ ok: true, status: 200 }); // mạng sống lại
			nowRef.t += 2_000; // qua backoff 1s
			await loop.flushNow();
			expect(fetchMock).toHaveBeenCalledTimes(2);
			expect(queue.size()).toBe(0);
		} finally {
			vi.useRealTimers();
		}
	});
});
