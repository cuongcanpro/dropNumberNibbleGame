import { LocalStorage } from './local-storage';
import { Sound } from './sound';
import { Vibration } from './vibration';

export interface UserSettings {
	soundEnabled: boolean;
	bgmEnabled: boolean;
	vibrationEnabled: boolean;
}

const KEY = 'user_settings';

function defaults(): UserSettings {
	return { soundEnabled: true, bgmEnabled: true, vibrationEnabled: true };
}

/** Port Cocos `shared/user/UserData`: settings + định dạng chuỗi "smv" để đồng bộ với host. */
export class UserData {
	private static instance: UserData | null = null;
	private settings: UserSettings;

	private constructor() {
		// Merge với default để save cũ thiếu field vẫn hợp lệ.
		this.settings = { ...defaults(), ...LocalStorage.get<Partial<UserSettings>>(KEY, {}) };
		this.apply();
	}

	static getInstance(): UserData {
		if (!UserData.instance) UserData.instance = new UserData();
		return UserData.instance;
	}

	/** Chỉ dùng cho test: bỏ singleton để đọc lại storage. */
	static resetForTest(): void {
		UserData.instance = null;
	}

	getUserSettings(): UserSettings {
		return this.settings;
	}

	saveUserSettings(settings: UserSettings): void {
		this.settings = { ...settings };
		LocalStorage.set(KEY, this.settings);
		this.apply();
	}

	saveUserSettingsFromRaw(raw: string): void {
		this.saveUserSettings({
			soundEnabled: raw.includes('s'),
			bgmEnabled: raw.includes('m'),
			vibrationEnabled: raw.includes('v'),
		});
	}

	getUserSettingsAsRaw(): string {
		const s = this.settings;
		return `${s.soundEnabled ? 's' : ''}${s.bgmEnabled ? 'm' : ''}${s.vibrationEnabled ? 'v' : ''}`;
	}

	private apply(): void {
		Vibration.setVibrationEnabled(this.settings.vibrationEnabled);
		Sound.getInstance().setSfxEnabled(this.settings.soundEnabled);
		Sound.getInstance().setBgmEnabled(this.settings.bgmEnabled);
	}
}
