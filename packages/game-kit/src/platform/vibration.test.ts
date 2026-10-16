import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { hapticToMs, nearestVibrationType, Vibration, VibrationType } from './vibration';

describe('Vibration', () => {
	const vibrate = vi.fn<(ms: number) => boolean>();
	beforeEach(() => {
		vibrate.mockClear();
		Vibration.setVibrationEnabled(true);
		vi.stubGlobal('navigator', { vibrate });
	});
	afterEach(() => vi.unstubAllGlobals());

	it('vibrate(type) map sang ms theo bảng intensity/sharpness', () => {
		Vibration.vibrate(VibrationType.RIGID);
		expect(vibrate).toHaveBeenCalledWith(hapticToMs(1, 1));
		expect(hapticToMs(1, 1)).toBe(42);
	});

	it('tắt setting thì không gọi navigator.vibrate', () => {
		Vibration.setVibrationEnabled(false);
		Vibration.vibrate(VibrationType.HEAVY);
		Vibration.haptic(1, 1);
		expect(vibrate).not.toHaveBeenCalled();
		expect(Vibration.isVibrationEnabled()).toBe(false);
	});

	it('thiếu navigator.vibrate hoặc nó ném thì no-op', () => {
		vi.stubGlobal('navigator', {});
		expect(() => Vibration.haptic(0.5, 0.5)).not.toThrow();
		vi.stubGlobal('navigator', {
			vibrate: () => {
				throw new Error('x');
			},
		});
		expect(() => Vibration.haptic(0.5, 0.5)).not.toThrow();
	});

	it('nearestVibrationType trả đúng loại cho bảng cocos, gần nhất cho giá trị khác', () => {
		expect(nearestVibrationType(1, 1)).toBe(VibrationType.RIGID);
		expect(nearestVibrationType(0.35, 0)).toBe(VibrationType.SOFT);
		expect(nearestVibrationType(0.75, 0.55)).toBe(VibrationType.HEAVY);
	});

	it('vibrateWithPattern phát từng bước cách nhau durationMs', () => {
		vi.useFakeTimers();
		Vibration.vibrateWithPattern(
			[
				{ intensity: 0.5, sharpness: 0 },
				{ intensity: 1, sharpness: 1 },
			],
			100,
		);
		vi.advanceTimersByTime(0);
		expect(vibrate).toHaveBeenCalledTimes(1);
		vi.advanceTimersByTime(100);
		expect(vibrate).toHaveBeenCalledTimes(2);
		vi.useRealTimers();
	});
});
