import { describe, expect, it, vi } from 'vitest';
import { createMotionSource } from './motion-source';
import type { MotionSample } from './shake-detector';

interface FakeAxes {
	x: number | null;
	y: number | null;
	z: number | null;
}

interface FakeMotionEvent {
	accelerationIncludingGravity?: FakeAxes | null;
	acceleration?: FakeAxes | null;
}

function fakeHost(opts: { hasApi?: boolean; permission?: string | (() => Promise<string>) } = {}) {
	const listeners = new Set<(e: FakeMotionEvent) => void>();
	const emit = (e: FakeMotionEvent) => {
		for (const cb of listeners) cb(e);
	};
	const api =
		opts.hasApi === false
			? {
					addEventListener: () => {},
					removeEventListener: () => {},
				}
			: {
					DeviceMotionEvent:
						opts.permission === undefined
							? {}
							: {
									requestPermission:
										typeof opts.permission === 'function'
											? opts.permission
											: async () => opts.permission as string,
								},
					addEventListener: (type: string, cb: (e: FakeMotionEvent) => void) => {
						if (type === 'devicemotion') listeners.add(cb);
					},
					removeEventListener: (_type: string, cb: (e: FakeMotionEvent) => void) => {
						listeners.delete(cb);
					},
				};
	return {
		...api,
		emit,
		get listenerCount() {
			return listeners.size;
		},
	};
}

describe('createMotionSource', () => {
	it('isSupported false khi không có DeviceMotionEvent', () => {
		const src = createMotionSource(fakeHost({ hasApi: false }));
		expect(src.isSupported()).toBe(false);
	});

	it('start false khi không hỗ trợ', async () => {
		const src = createMotionSource(fakeHost({ hasApi: false }));
		expect(await src.start(() => {})).toBe(false);
	});

	it('xin quyền: denied → không gắn listener', async () => {
		const host = fakeHost({ permission: 'denied' });
		const src = createMotionSource(host);
		expect(await src.start(() => {})).toBe(false);
		expect(host.listenerCount).toBe(0);
	});

	it('xin quyền: granted → bắn accelerationIncludingGravity', async () => {
		const host = fakeHost({ permission: 'granted' });
		const src = createMotionSource(host);
		const onSample = vi.fn<(s: MotionSample) => void>();
		expect(await src.start(onSample)).toBe(true);
		host.emit({ accelerationIncludingGravity: { x: 1, y: 2, z: 9.81 } });
		expect(onSample).toHaveBeenCalledWith({ x: 1, y: 2, z: 9.81 });
	});

	it('fallback acceleration khi includingGravity trống', async () => {
		const host = fakeHost();
		const src = createMotionSource(host);
		const onSample = vi.fn<(s: MotionSample) => void>();
		expect(await src.start(onSample)).toBe(true);
		host.emit({
			accelerationIncludingGravity: null,
			acceleration: { x: 3, y: 4, z: 5 },
		});
		expect(onSample).toHaveBeenCalledWith({ x: 3, y: 4, z: 5 });
	});

	it('bỏ mẫu thiếu trục; stop gỡ listener', async () => {
		const host = fakeHost();
		const src = createMotionSource(host);
		const onSample = vi.fn<(s: MotionSample) => void>();
		expect(await src.start(onSample)).toBe(true);
		host.emit({ accelerationIncludingGravity: { x: 1, y: null, z: 0 } });
		expect(onSample).not.toHaveBeenCalled();
		src.stop();
		host.emit({ accelerationIncludingGravity: { x: 9, y: 8, z: 7 } });
		expect(onSample).not.toHaveBeenCalled();
		expect(host.listenerCount).toBe(0);
	});

	it('start lần hai là no-op khi đang nghe', async () => {
		const host = fakeHost();
		const src = createMotionSource(host);
		expect(await src.start(() => {})).toBe(true);
		expect(await src.start(() => {})).toBe(false);
		expect(host.listenerCount).toBe(1);
	});
});
