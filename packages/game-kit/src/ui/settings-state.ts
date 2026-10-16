import { UserData, type UserSettings } from '../platform/user-data';
import { KIT_CONFIG_DEFAULTS, type KitConfig } from '../shell/kit-config';
import { type SettingButtonName, settingButtonVisible } from '../shell/kit-config-rules';
import type { GameSettingTheme } from './game-setting-theme';

/**
 * Tối đa BỐN nút đáy — panel chỉ có lưới 2x2. Nút thiếu callback thì ẩn.
 */
export interface SettingOverlayCallbacks {
	/** Không còn tác dụng: màu panel theo `loadingBgColor` của game (xem `resolveSettingTheme`). */
	gameId?: string;
	/** Ghi đè hẳn theme (khung/icon/nút riêng của game). */
	theme?: GameSettingTheme;
	onResume: () => void;
	onRestart?: () => void;
	onFeedback?: () => void;
	onHome?: () => void;
	/** Chỉ game có chọn bảng màu (merge2248). */
	onThemes?: () => void;
	/** Game có màn chọn level. */
	onLevels?: () => void;
}

export const PANEL_W = 549;
export const PANEL_H = 747;

/** Cocos y-up, gốc dưới-trái panel → Phaser local, gốc tâm panel, y-down. */
export function panelPoint(x: number, yCocos: number): { x: number; y: number } {
	return { x: x - PANEL_W / 2, y: PANEL_H / 2 - yCocos };
}

export type ToggleKey = keyof UserSettings;
export const TOGGLE_ROWS: readonly {
	key: ToggleKey;
	label: string;
	icon: 'sound' | 'music' | 'vibration';
	y: number;
}[] = [
	{ key: 'soundEnabled', label: 'Sound', icon: 'sound', y: 570 },
	{ key: 'bgmEnabled', label: 'Music', icon: 'music', y: 470 },
	{ key: 'vibrationEnabled', label: 'Vibration', icon: 'vibration', y: 370 },
];

export function readToggle(key: ToggleKey): boolean {
	return UserData.getInstance().getUserSettings()[key];
}

/** Ghi qua UserData → nó tự áp xuống Sound/Vibration và lưu storage. */
export function writeToggle(key: ToggleKey, value: boolean): void {
	const ud = UserData.getInstance();
	ud.saveUserSettings({ ...ud.getUserSettings(), [key]: value });
}

/** Núm toggle: x trong slot (gốc trái) — 35px từ mép trái khi tắt, `width - 35` khi bật. */
export function knobOffsetX(on: boolean, slotWidth: number): number {
	return (on ? slotWidth - 35 : 35) - slotWidth / 2;
}

export type BottomButtonId = 'feedback' | 'themes' | 'levels' | 'replay' | 'play' | 'home';

export interface BottomButtonSpec {
	id: BottomButtonId;
	label: string;
	outline: string;
}

/** Thứ tự đọc như Cocos: feedback, themes, levels, replay, play, home. */
export const BOTTOM_BUTTONS: readonly BottomButtonSpec[] = [
	{ id: 'feedback', label: 'FEEDBACK', outline: '#2368A8' },
	{ id: 'themes', label: 'THEMES', outline: '#2368A8' },
	{ id: 'levels', label: 'LEVELS', outline: '#2368A8' },
	{ id: 'replay', label: 'REPLAY', outline: '#A2312E' },
	{ id: 'play', label: 'PLAY', outline: '#31840C' },
	{ id: 'home', label: 'HOME', outline: '#A86A00' },
];

const CALLBACK_OF: Record<BottomButtonId, keyof SettingOverlayCallbacks | null> = {
	feedback: 'onFeedback',
	themes: 'onThemes',
	levels: 'onLevels',
	replay: 'onRestart',
	play: null, // PLAY luôn có (= resume)
	home: 'onHome',
};

const CONFIG_NAME: Partial<Record<BottomButtonId, SettingButtonName>> = {
	feedback: 'feedback',
	themes: 'themes',
	levels: 'levels',
	replay: 'restart',
	home: 'home',
};

/**
 * Nút nào hiện: có callback VÀ kit-config không tắt (PLAY luôn hiện), tối đa 4 (Cocos sẽ lỗi ở nút
 * thứ 5 — ở đây cắt bớt).
 */
export function visibleBottomButtons(
	cb: SettingOverlayCallbacks,
	cfg: KitConfig = KIT_CONFIG_DEFAULTS,
): BottomButtonSpec[] {
	return BOTTOM_BUTTONS.filter((b) => {
		const key = CALLBACK_OF[b.id];
		const name = CONFIG_NAME[b.id];
		if (key === null || !name) return true;
		return settingButtonVisible(name, typeof cb[key] === 'function', cfg);
	}).slice(0, 4);
}

/** Slot lưới (Cocos y-up, gốc dưới-trái panel): nút gói gọn để không lệch chéo khi thiếu callback. */
export function bottomSlots(count: number): { x: number; y: number }[] {
	const LEFT = 149;
	const RIGHT = 394;
	const CENTER = 271.5;
	const TOP = 222;
	const BOTTOM = 116;
	const raw =
		count <= 1
			? [[CENTER, BOTTOM]]
			: count === 2
				? [
						[LEFT, BOTTOM],
						[RIGHT, BOTTOM],
					]
				: count === 3
					? [
							[LEFT, TOP],
							[RIGHT, TOP],
							[CENTER, BOTTOM],
						]
					: [
							[LEFT, TOP],
							[RIGHT, TOP],
							[LEFT, BOTTOM],
							[RIGHT, BOTTOM],
						];
	return raw.map(([x, y]) => panelPoint(x, y));
}
