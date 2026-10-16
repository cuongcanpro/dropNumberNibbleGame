import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetTrackingForTest } from '../testing/tracking-rig';
import { DEVICE_ID_KEY } from './device-identity';
import { emit } from './track';
import type { TrackingBootOptions } from './tracking-bootstrap';
import { bootTracking, IDENTITY_WAIT_MS, resetBootForTest } from './tracking-bootstrap';
import type { TrackingHost } from './tracking-host';
import { STORAGE_KEY, TRACK_STATUS_KEY } from './types';

const ANDROID_UA =
	'Mozilla/5.0 (Linux; Android 14; Pixel 7 Build/UP1A) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36';

function makeHost(over: Partial<TrackingHost> = {}) {
	const map = new Map<string, string>();
	const hide: (() => void)[] = [];
	const online: (() => void)[] = [];
	const host: TrackingHost = {
		storage: { get: (k) => map.get(k) ?? null, set: (k, v) => void map.set(k, v) },
		isOnline: () => true,
		userAgent: () => ANDROID_UA,
		language: () => 'vi-VN',
		onHide: (cb) => void hide.push(cb),
		onOnline: (cb) => void online.push(cb),
		...over,
	};
	return { host, map, hide, online };
}

function boot(h: ReturnType<typeof makeHost>, over: Partial<TrackingBootOptions> = {}) {
	const bodies: Record<string, unknown>[] = [];
	const urls: string[] = [];
	const fetchFn = (async (url: string, init: { body: string }) => {
		urls.push(url);
		bodies.push(JSON.parse(init.body));
		return { ok: true, status: 200 } as Response;
	}) as unknown as typeof fetch;
	const ok = bootTracking({
		env: 'dev',
		appKey: 'nbc_dev_key',
		commit: 'abc1234',
		appVersion: '0.1.0',
		host: h.host,
		fetchFn,
		...over,
	});
	return { ok, bodies, urls };
}

beforeEach(() => {
	vi.spyOn(console, 'log').mockImplementation(() => undefined);
	vi.spyOn(console, 'error').mockImplementation(() => undefined);
});
afterEach(() => {
	resetTrackingForTest();
	resetBootForTest();
	vi.restoreAllMocks();
});

const batches = (r: ReturnType<typeof boot>) => r.bodies.filter((b) => 'events' in b);

describe('bootTracking', () => {
	it('NB_CONSOLE_ENV=off tắt tracking mà không báo lỗi; env thiếu hoặc lạ vẫn báo lỗi', () => {
		const off = boot(makeHost(), { env: 'off' });
		expect(off.ok).toBe(false);
		expect(console.error).not.toHaveBeenCalled();
		expect(console.log).toHaveBeenCalledWith(expect.stringContaining('NB_CONSOLE_ENV=off'));
		resetTrackingForTest();
		resetBootForTest();
		boot(makeHost(), { env: '' });
		expect(console.error).toHaveBeenCalledWith(expect.stringContaining('SDK KHÔNG bật'));
	});

	it('fail-closed: thiếu env hoặc key → SDK tắt, 0 event, 0 network, status on:false', () => {
		for (const o of [{ env: '' }, { appKey: '' }, { env: 'prod' }, { env: 'live', appKey: '' }]) {
			const h = makeHost();
			const r = boot(h, o);
			expect(r.ok).toBe(false);
			emit('a');
			expect(h.map.get(STORAGE_KEY)).toBeUndefined();
			expect(r.urls).toHaveLength(0); // thiếu key/env: không cả client-diag
			expect(JSON.parse(h.map.get(TRACK_STATUS_KEY) ?? '{}').on).toBe(false);
			expect(h.map.get(TRACK_STATUS_KEY)).not.toContain('nbc_dev_key');
			resetTrackingForTest();
			resetBootForTest();
		}
	});

	it('bật: device_id sinh một lần + lưu nv_device_id_v1; status on:true không lộ key', async () => {
		const h = makeHost();
		const r = boot(h);
		expect(r.ok).toBe(true);
		const id = h.map.get(DEVICE_ID_KEY);
		expect(id).toMatch(/^[0-9a-f-]{36}$/);
		const status = JSON.parse(h.map.get(TRACK_STATUS_KEY) ?? '{}');
		expect(status.on).toBe(true);
		expect(h.map.get(TRACK_STATUS_KEY)).not.toContain('nbc_dev_key');
		await vi.waitFor(() => expect(batches(r).length).toBe(1)); // session_start xả ngay lúc boot
		const body = batches(r)[0] as {
			user_id: string;
			device: Record<string, unknown>;
			events: { action: string }[];
		};
		expect(body.device.device_id).toBe(id);
		expect(body.user_id).toBe(''); // IdentityProvider mặc định = guest
		expect(body.events[0]!.action).toBe('session_start');
		expect(body.device).toMatchObject({
			platform: 'nibi-android',
			os_name: 'Android',
			os_version: '14',
			model: 'Pixel 7',
			locale: 'vi-VN',
			build_commit: 'abc1234',
			app_version: '0.1.0',
		});
	});

	it('device_id giữ nguyên qua lần mở app sau', () => {
		const h = makeHost();
		boot(h);
		const first = h.map.get(DEVICE_ID_KEY);
		resetTrackingForTest();
		resetBootForTest();
		boot(h);
		expect(h.map.get(DEVICE_ID_KEY)).toBe(first);
	});

	it('identity provider cấp user_id; platform tường minh thắng UA', async () => {
		const h = makeHost();
		const r = boot(h, { identity: { userId: () => 'u-42' }, platform: 'web' });
		await vi.waitFor(() => expect(batches(r).length).toBe(1));
		const body = batches(r)[0] as { user_id: string; device: { platform: string } };
		expect(body.user_id).toBe('u-42');
		expect(body.device.platform).toBe('web');
	});

	it('offline lúc boot: không gửi event; mạng quay lại (online listener) → xả', async () => {
		let net = false;
		const h = makeHost({ isOnline: () => net });
		const r = boot(h);
		expect(batches(r)).toHaveLength(0);
		net = true;
		h.online.forEach((cb) => cb());
		await vi.waitFor(() => expect(batches(r).length).toBe(1));
	});

	it('hide → flush queue (event KHÔNG thuộc nhóm đẩy ngay)', async () => {
		const h = makeHost();
		const r = boot(h);
		await vi.waitFor(() => expect(batches(r).length).toBe(1)); // session_start
		emit('game_level_start');
		await Promise.resolve();
		expect(batches(r)).toHaveLength(1);
		h.hide.forEach((cb) => cb());
		await vi.waitFor(() => expect(batches(r).length).toBe(2));
	});

	it('host ném (navigator lạ) vẫn bật được, không ném ra ngoài', () => {
		const h = makeHost({
			userAgent: () => {
				throw new Error('x');
			},
			language: () => {
				throw new Error('x');
			},
		});
		expect(() => boot(h)).not.toThrow();
		expect(boot(h).ok).toBe(true);
	});

	it('idempotent: gọi boot hai lần không đăng ký listener đôi', () => {
		const h = makeHost();
		boot(h);
		boot(h);
		expect(h.hide).toHaveLength(1);
	});

	it('identity có deviceId (launcher trao) ⇒ batch gửi device_id của launcher, kể cả event xếp hàng TRƯỚC khi có trả lời', async () => {
		const h = makeHost();
		let launcherDevice: string | undefined;
		const r = boot(h, { identity: { userId: () => '77', deviceId: () => launcherDevice } });
		emit('trước_trả_lời');
		launcherDevice = 'portal0device0id0000000000000001';
		const { flushNow } = await import('./track');
		await flushNow();
		const last = batches(r).at(-1) as { device: { device_id: string }; user_id: string };
		expect(last.device.device_id).toBe('portal0device0id0000000000000001');
		expect(last.user_id).toBe('77');
	});

	it('batch đầu lúc boot CHỜ launcher trả lời danh tính — không đi với id riêng/uid rỗng', async () => {
		const h = makeHost();
		let launcherDevice: string | undefined;
		let answer: (() => void) | undefined;
		const ready = new Promise<void>((resolve) => {
			answer = resolve;
		});
		const r = boot(h, {
			identity: {
				userId: () => (launcherDevice ? '88' : ''),
				deviceId: () => launcherDevice,
				ready,
			},
		});
		await new Promise((resolve) => setTimeout(resolve, 20));
		expect(batches(r)).toHaveLength(0);
		launcherDevice = 'portal0device0id0000000000000002';
		answer?.();
		await vi.waitFor(() => expect(batches(r)).toHaveLength(1));
		const first = batches(r)[0] as { device: { device_id: string }; user_id: string };
		expect(first.device.device_id).toBe('portal0device0id0000000000000002');
		expect(first.user_id).toBe('88');
	});

	it('không ai trả lời (web, launcher cũ) ⇒ vẫn đẩy sau IDENTITY_WAIT_MS', async () => {
		vi.useFakeTimers({ toFake: ['setTimeout'] });
		const h = makeHost();
		const r = boot(h, {
			identity: { userId: () => '', ready: new Promise<void>(() => undefined) },
		});
		await vi.advanceTimersByTimeAsync(IDENTITY_WAIT_MS + 10);
		vi.useRealTimers();
		await vi.waitFor(() => expect(batches(r).length).toBeGreaterThan(0));
	});
});
