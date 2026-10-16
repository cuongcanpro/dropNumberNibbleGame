// Máy trạng thái đếm lượt lắc của ShakeUi (Cocos để lẫn trong shakeUi.ts). THUẦN, test được.
import {
	createShakeDetector,
	type MotionSample,
	type ShakeDetectorOptions,
	type ShakeDirection,
} from './shake-detector';

export interface ShakeSessionOptions {
	/** Mặc định 3. */
	maxShakes?: number;
	/** Khoá giữa 2 lần đếm (ms). Mặc định 250 (Cocos `delayTime(0.25)`). */
	lockMs?: number;
	detector?: ShakeDetectorOptions;
}

export interface ShakeFeedResult {
	/** Mẫu này làm tăng bộ đếm. */
	counted: boolean;
	/** Detector phát hiện lắc VÀ hướng khác lần trước (kể cả bị khoá) → view reset timer Tap. */
	directionChanged: boolean;
	direction: ShakeDirection | null;
	count: number;
}

export interface ShakeSession {
	feed(sample: MotionSample, nowMs: number): ShakeFeedResult;
	/** Nút "Tap!": đếm như một lần lắc (đi qua cùng khoá + giới hạn). */
	tap(nowMs: number): boolean;
	readonly count: number;
	readonly done: boolean;
}

export function createShakeSession(options: ShakeSessionOptions = {}): ShakeSession {
	const maxShakes = options.maxShakes ?? 3;
	const lockMs = options.lockMs ?? 250;
	const detector = createShakeDetector({ threshold: 1.5, intervalMs: 100, ...options.detector });
	let count = 0;
	let lockedUntil = Number.NEGATIVE_INFINITY;
	// Cocos `_curDirection` khởi tạo 'unknown' → lần lắc đầu có hướng unknown bị bỏ qua.
	let lastDirection: ShakeDirection = 'unknown';

	function register(nowMs: number): boolean {
		if (count >= maxShakes || nowMs < lockedUntil) return false;
		count++;
		// Đủ số lần thì không mở khoá lại (Cocos: nhánh max return trước khi hạ isShaking).
		lockedUntil = count >= maxShakes ? Number.POSITIVE_INFINITY : nowMs + lockMs;
		return true;
	}

	return {
		feed(sample, nowMs) {
			if (count >= maxShakes)
				return { counted: false, directionChanged: false, direction: null, count };
			const shake = detector.feed(sample, nowMs);
			if (!shake || shake.direction === lastDirection) {
				return {
					counted: false,
					directionChanged: false,
					direction: shake?.direction ?? null,
					count,
				};
			}
			lastDirection = shake.direction;
			const counted = register(nowMs);
			return { counted, directionChanged: true, direction: shake.direction, count };
		},
		tap: register,
		get count() {
			return count;
		},
		get done() {
			return count >= maxShakes;
		},
	};
}
