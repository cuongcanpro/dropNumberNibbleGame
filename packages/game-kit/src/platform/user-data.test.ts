import { beforeEach, describe, expect, it } from 'vitest';
import { LocalStorage } from './local-storage';
import { Sound } from './sound';
import { UserData } from './user-data';
import { Vibration } from './vibration';

describe('UserData', () => {
	beforeEach(() => {
		LocalStorage.clear();
		UserData.resetForTest();
	});

	it('mặc định bật hết, raw = "smv"', () => {
		const ud = UserData.getInstance();
		expect(ud.getUserSettings()).toEqual({
			soundEnabled: true,
			bgmEnabled: true,
			vibrationEnabled: true,
		});
		expect(ud.getUserSettingsAsRaw()).toBe('smv');
	});

	it('smv roundtrip + lưu key user_settings + áp sang Sound/Vibration', () => {
		const ud = UserData.getInstance();
		ud.saveUserSettingsFromRaw('m');
		expect(ud.getUserSettingsAsRaw()).toBe('m');
		expect(LocalStorage.get('user_settings')).toEqual({
			soundEnabled: false,
			bgmEnabled: true,
			vibrationEnabled: false,
		});
		expect(Sound.getInstance().isSfxEnabled()).toBe(false);
		expect(Sound.getInstance().isBgmEnabled()).toBe(true);
		expect(Vibration.isVibrationEnabled()).toBe(false);
	});

	it('nạp lại từ storage, save cũ thiếu field vẫn có default', () => {
		LocalStorage.set('user_settings', { soundEnabled: false });
		const s = UserData.getInstance().getUserSettings();
		expect(s).toEqual({ soundEnabled: false, bgmEnabled: true, vibrationEnabled: true });
	});
});
