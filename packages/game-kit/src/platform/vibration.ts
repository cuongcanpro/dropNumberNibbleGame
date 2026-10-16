/** Loại rung như Cocos nhưng là const object + union (không enum). */
export const VibrationType = { LIGHT: 0, MEDIUM: 1, HEAVY: 2, SOFT: 3, RIGID: 4 } as const;
export type VibrationType = (typeof VibrationType)[keyof typeof VibrationType];

export interface HapticStep {
	intensity: number;
	sharpness: number;
}

// Bảng y Cocos `core/plugins/vibration`.
const CONFIG: Record<VibrationType, HapticStep> = {
	[VibrationType.LIGHT]: { intensity: 0.35, sharpness: 0.35 },
	[VibrationType.MEDIUM]: { intensity: 0.5, sharpness: 0.35 },
	[VibrationType.HEAVY]: { intensity: 0.8, sharpness: 0.5 },
	[VibrationType.SOFT]: { intensity: 0.35, sharpness: 0 },
	[VibrationType.RIGID]: { intensity: 1, sharpness: 1 },
};

let enabled = true;
/** Launcher phát haptic thật; `host-platform.ts` tự gắn vào khi nạp `@repo/game-kit/platform`. */
let hapticHost: ((type: VibrationType) => boolean) | undefined;

/** Web không có intensity/sharpness → quy về thời lượng ms (công thức của block-blast). */
export function hapticToMs(intensity: number, sharpness: number): number {
	return Math.round(8 + intensity * 26 + sharpness * 8);
}

/** Loại gần nhất với (intensity, sharpness) — để Launcher phát haptic thật theo kiểu cocos. */
export function nearestVibrationType(intensity: number, sharpness: number): VibrationType {
	let best: VibrationType = VibrationType.LIGHT;
	let bestDistance = Number.POSITIVE_INFINITY;
	for (const type of Object.values(VibrationType)) {
		const step = CONFIG[type];
		const distance = (step.intensity - intensity) ** 2 + (step.sharpness - sharpness) ** 2;
		if (distance < bestDistance) {
			best = type;
			bestDistance = distance;
		}
	}
	return best;
}

/** Native chưa đo `navigator.vibrate` → thiếu hoặc ném đều là no-op im lặng. */
function nativeVibrate(ms: number): void {
	try {
		const nav = (globalThis as { navigator?: { vibrate?: (ms: number) => boolean } }).navigator;
		if (typeof nav?.vibrate === 'function') nav.vibrate(ms);
	} catch {
		// không hỗ trợ
	}
}

export const Vibration = {
	setVibrationEnabled(value: boolean): void {
		enabled = value;
	},

	isVibrationEnabled(): boolean {
		return enabled;
	},

	/** `handler` trả `true` khi đã tự rung; `undefined` để bỏ. */
	setHapticHost(handler: ((type: VibrationType) => boolean) | undefined): void {
		hapticHost = handler;
	},

	vibrate(type: VibrationType): void {
		const { intensity, sharpness } = CONFIG[type];
		Vibration.haptic(intensity, sharpness);
	},

	haptic(intensity: number, sharpness: number): void {
		if (!enabled) return;
		// Trong Launcher: haptic thật (iOS không có navigator.vibrate). Ngoài đó: rung theo ms.
		if (hapticHost?.(nearestVibrationType(intensity, sharpness)) === true) return;
		nativeVibrate(hapticToMs(intensity, sharpness));
	},

	/** Mỗi bước cách nhau `durationMs` như Cocos (setTimeout theo index). */
	vibrateWithPattern(pattern: HapticStep[], durationMs: number): void {
		if (!enabled) return;
		pattern.forEach(({ intensity, sharpness }, index) => {
			setTimeout(() => Vibration.haptic(intensity, sharpness), index * durationMs);
		});
	},
};
