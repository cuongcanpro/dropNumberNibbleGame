import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Vibration, VibrationType } from './vibration';

describe('Vibration trong Launcher', () => {
	const vibrate = vi.fn<(ms: number) => boolean>();
	const hapticHost = vi.fn<(type: VibrationType) => boolean>(() => true);
	beforeEach(() => {
		hapticHost.mockClear();
		vibrate.mockClear();
		Vibration.setVibrationEnabled(true);
		Vibration.setHapticHost(hapticHost);
		vi.stubGlobal('navigator', { vibrate });
	});
	afterEach(() => {
		Vibration.setHapticHost(undefined);
		vi.unstubAllGlobals();
	});

	it('gửi đúng loại rung cocos cho Launcher, không đụng navigator.vibrate', () => {
		Vibration.vibrate(VibrationType.HEAVY);
		expect(hapticHost).toHaveBeenCalledWith(VibrationType.HEAVY);
		expect(vibrate).not.toHaveBeenCalled();
	});

	it('tắt setting thì không gửi gì', () => {
		Vibration.setVibrationEnabled(false);
		Vibration.vibrate(VibrationType.RIGID);
		expect(hapticHost).not.toHaveBeenCalled();
	});

	it('Launcher không nhận thì vẫn rung kiểu web', () => {
		hapticHost.mockReturnValueOnce(false);
		Vibration.vibrate(VibrationType.LIGHT);
		expect(vibrate).toHaveBeenCalledTimes(1);
	});
});
