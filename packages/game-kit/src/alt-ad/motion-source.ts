// Nguồn gia tốc cho ShakeUi. Nibi 0.4.6+ native runtime triển khai DeviceMotionEvent
// (`devicemotion`, accelerationIncludingGravity theo m/s²). Web Vite dùng API trình duyệt.
import type { MotionSample } from './shake-detector';

export interface MotionSource {
	/** Có DeviceMotionEvent (nibi native 0.4.6+ / trình duyệt). Desktop sim có thể có type nhưng không bắn mẫu. */
	isSupported(): boolean;
	/** Bắt đầu nghe. `false` = không dùng được (bị từ chối quyền / ném lỗi). Mẫu tính bằng m/s². */
	start(onSample: (sample: MotionSample) => void): Promise<boolean>;
	stop(): void;
}

interface MotionAxes {
	x: number | null;
	y: number | null;
	z: number | null;
}

interface MotionEventLike {
	accelerationIncludingGravity?: MotionAxes | null;
	acceleration?: MotionAxes | null;
}

interface MotionHost {
	DeviceMotionEvent?: { requestPermission?: () => Promise<string> };
	addEventListener?: (type: string, cb: (e: MotionEventLike) => void) => void;
	removeEventListener?: (type: string, cb: (e: MotionEventLike) => void) => void;
}

function sampleOf(e: MotionEventLike): MotionSample | null {
	const a = e.accelerationIncludingGravity ?? e.acceleration;
	if (a && a.x != null && a.y != null && a.z != null) return { x: a.x, y: a.y, z: a.z };
	return null;
}

/** Nibi 0.4.6+ DeviceMotionEvent trên native; trình duyệt trên web. */
export function createMotionSource(host: MotionHost = globalThis as MotionHost): MotionSource {
	let listener: ((e: MotionEventLike) => void) | null = null;

	return {
		isSupported() {
			return (
				typeof host.DeviceMotionEvent !== 'undefined' && typeof host.addEventListener === 'function'
			);
		},
		async start(onSample) {
			if (!this.isSupported() || listener) return false;
			try {
				// iOS Safari: xin quyền từ user gesture. Native nibi thường granted ngay.
				const request = host.DeviceMotionEvent?.requestPermission;
				if (typeof request === 'function') {
					const result = await request.call(host.DeviceMotionEvent);
					if (result !== 'granted') return false;
				}
				listener = (e) => {
					const sample = sampleOf(e);
					if (sample) onSample(sample);
				};
				host.addEventListener?.('devicemotion', listener);
				return true;
			} catch {
				listener = null;
				return false;
			}
		},
		stop() {
			if (listener) host.removeEventListener?.('devicemotion', listener);
			listener = null;
		},
	};
}
