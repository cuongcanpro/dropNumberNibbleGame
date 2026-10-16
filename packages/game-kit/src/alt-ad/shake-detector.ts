// Port của Cocos `common/systems/shakeDetection.ts`, bỏ phần cc. THUẦN: không DOM/Phaser.

export type ShakeDirection = 'left' | 'right' | 'up' | 'down' | 'unknown';

export interface MotionSample {
	x: number;
	y: number;
	z: number;
}

export interface ShakeEvent {
	/** Biên độ Δ gia tốc, đơn vị g. */
	force: number;
	direction: ShakeDirection;
}

/** 1g theo m/s². `devicemotion` trả m/s², còn ngưỡng Cocos (1.5) tính bằng g (cc accelerometer). */
export const GRAVITY_MS2 = 9.81;

export interface ShakeDetectorOptions {
	/** Ngưỡng |Δa| tính bằng g. Mặc định 1.5 (ShakeUi của Cocos). */
	threshold?: number;
	/** Khoảng tối thiểu giữa 2 lần phát hiện (ms). Mặc định 100 (ShakeUi của Cocos). */
	intervalMs?: number;
	/**
	 * Số chia đưa mẫu về g. Mặc định 9.81 (mẫu m/s²). Truyền 1 nếu nguồn đã tính bằng g.
	 * Tách ra để chỉnh theo máy thật mà không đụng luật.
	 */
	unitDivisor?: number;
}

export interface ShakeDetector {
	feed(sample: MotionSample, nowMs: number): ShakeEvent | null;
	reset(): void;
}

/** Trục có |Δ| lớn hơn quyết định hướng; bằng nhau → unknown (y hệt Cocos). */
export function directionOf(dx: number, dy: number): ShakeDirection {
	const ax = Math.abs(dx);
	const ay = Math.abs(dy);
	if (ax > ay) return dx > 0 ? 'right' : 'left';
	if (ay > ax) return dy > 0 ? 'up' : 'down';
	return 'unknown';
}

export function createShakeDetector(options: ShakeDetectorOptions = {}): ShakeDetector {
	const threshold = options.threshold ?? 1.5;
	const intervalMs = options.intervalMs ?? 100;
	const divisor = options.unitDivisor ?? GRAVITY_MS2;
	// Cocos khởi tạo lastAcc = 0 và lastShakeTime = 0; mẫu đầu tiên so với gốc toạ độ.
	let last: MotionSample = { x: 0, y: 0, z: 0 };
	let lastShakeMs: number | null = null;

	return {
		feed(sample, nowMs) {
			const cur = { x: sample.x / divisor, y: sample.y / divisor, z: sample.z / divisor };
			const dx = cur.x - last.x;
			const dy = cur.y - last.y;
			const dz = cur.z - last.z;
			last = cur;
			const force = Math.sqrt(dx * dx + dy * dy + dz * dz);
			if (force <= threshold) return null;
			// Cocos: interval chỉ chặn lần phát hiện, lastAcc vẫn cập nhật mọi mẫu.
			if (lastShakeMs !== null && nowMs - lastShakeMs <= intervalMs) return null;
			lastShakeMs = nowMs;
			return { force, direction: directionOf(dx, dy) };
		},
		reset() {
			last = { x: 0, y: 0, z: 0 };
			lastShakeMs = null;
		},
	};
}
