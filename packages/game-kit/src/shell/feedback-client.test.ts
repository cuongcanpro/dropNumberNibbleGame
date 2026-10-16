import { afterEach, describe, expect, it, vi } from 'vitest';
import { createTrackingRig, resetTrackingForTest } from '../testing/tracking-rig';
import { FEEDBACK_TIMEOUT_MS, sendFeedback } from './feedback-client';

afterEach(() => {
	resetTrackingForTest();
	vi.useRealTimers();
});

describe('sendFeedback', () => {
	it('POST đúng URL/header/payload, 2xx ⇒ true', async () => {
		const calls: { url: string; init: { headers: Record<string, string>; body: string } }[] = [];
		createTrackingRig({
			fetchFn: (async (url: string, init: never) => {
				calls.push({ url, init });
				return { ok: true };
			}) as unknown as typeof fetch,
		});
		expect(await sendFeedback({ gameKey: 'sandfall', text: 'hay', reason: 'bug' })).toBe(true);
		expect(calls[0]?.url).toBe('https://console.test/public/feedback');
		expect(calls[0]?.init.headers['X-App-Key']).toBe('k');
		expect(JSON.parse(calls[0]?.init.body ?? '{}')).toEqual({
			deviceId: 'dev-1',
			gameKey: 'sandfall',
			text: 'hay',
			reason: 'bug',
			appVersion: '1.2.3',
		});
	});

	it('cắt text 500 và reason 64 ký tự trước khi gửi', async () => {
		const bodies: string[] = [];
		createTrackingRig({
			fetchFn: (async (_url: string, init: { body: string }) => {
				bodies.push(init.body);
				return { ok: true };
			}) as unknown as typeof fetch,
		});
		await sendFeedback({ gameKey: 'g', text: 'x'.repeat(900), reason: 'r'.repeat(200) });
		const sent = JSON.parse(bodies[0] ?? '{}') as { text: string; reason: string };
		expect(sent.text).toHaveLength(500);
		expect(sent.reason).toHaveLength(64);
	});

	it('SDK tắt ⇒ false', async () => {
		expect(await sendFeedback({ gameKey: 'g' })).toBe(false);
	});

	it('offline / 404 / fetch ném ⇒ false', async () => {
		const rig = createTrackingRig({
			fetchFn: (async () => ({ ok: false, status: 404 })) as unknown as typeof fetch,
		});
		expect(await sendFeedback({ gameKey: 'g' })).toBe(false);
		resetTrackingForTest();
		createTrackingRig({
			fetchFn: (async () => {
				throw new Error('net');
			}) as unknown as typeof fetch,
		});
		expect(await sendFeedback({ gameKey: 'g' })).toBe(false);
		resetTrackingForTest();
		const rig2 = createTrackingRig();
		rig2.net.state = 'offline';
		expect(await sendFeedback({ gameKey: 'g' })).toBe(false);
		expect(rig.counter.attempts).toBe(0); // fetch bị ghi đè nên rig không đếm; chỉ để dùng biến
	});

	it('treo ⇒ false sau timeout', async () => {
		createTrackingRig({ fetchFn: (() => new Promise(() => undefined)) as unknown as typeof fetch });
		vi.useFakeTimers();
		const p = sendFeedback({ gameKey: 'g' });
		await vi.advanceTimersByTimeAsync(FEEDBACK_TIMEOUT_MS);
		await expect(p).resolves.toBe(false);
	});
});
