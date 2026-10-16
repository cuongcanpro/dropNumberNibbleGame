// Hẹn giờ hiện nút "Tap!" (Cocos TAP_FALLBACK_DELAY_SECONDS = 5). THUẦN: scheduler được tiêm vào
// (view dùng scene.time, test dùng fake timers).

export type Schedule = (callback: () => void, ms: number) => () => void;

export interface TapFallbackOptions {
	schedule: Schedule;
	onShow: () => void;
	delayMs?: number;
}

export interface TapFallback {
	/** (Re)start đếm 5s; no-op nếu đã hiện hoặc đã huỷ. */
	restart(): void;
	/** Hiện ngay (devicemotion không có / bị từ chối). */
	showNow(): void;
	/** Dừng hẳn (đủ lượt hoặc popup đóng). */
	cancel(): void;
	readonly shown: boolean;
}

export function createTapFallback(options: TapFallbackOptions): TapFallback {
	const delayMs = options.delayMs ?? 5000;
	let cancelPending: (() => void) | null = null;
	let shown = false;
	let stopped = false;

	function clear(): void {
		cancelPending?.();
		cancelPending = null;
	}
	function show(): void {
		if (shown || stopped) return;
		shown = true;
		clear();
		options.onShow();
	}

	return {
		restart() {
			if (shown || stopped) return;
			clear();
			cancelPending = options.schedule(show, delayMs);
		},
		showNow: show,
		cancel() {
			stopped = true;
			clear();
		},
		get shown() {
			return shown;
		},
	};
}
