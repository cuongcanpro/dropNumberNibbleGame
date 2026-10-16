import { type UiGroup, uiKey } from './ui-keys';

/**
 * Key texture của ui/ theo nhóm. Ảnh nguồn nằm ở `assets/ui/<nhóm>/<tên>.png` nhưng KHÔNG được import:
 * runtime chỉ tải atlas `assets/atlas/gk-ui.*` (xem `pack.config.ts`, `pnpm pack-assets`) rồi dựng
 * lại từng key này làm texture riêng (`platform/atlas-alias.ts`).
 */
export interface UiAsset {
	readonly key: string;
}

function keys(group: UiGroup, names: readonly string[]): readonly UiAsset[] {
	return names.map((name) => ({ key: uiKey(group, name) }));
}

/** Giữ tên hằng Cocos: asset consumer phải preload trước khi dựng widget. */
export const SETTING_ASSETS = keys('setting', [
	'board_accent',
	'board_base',
	'btnBlue',
	'btnClose',
	'btnGreen',
	'btnRed',
	'btnYellow',
	'on_off_button',
	'on_off_slot1',
	'on_off_slot2',
	'iconPlay',
	'iconFeedback',
	'iconLevels',
	'iconMap',
	'iconReturn',
	'iconThemes',
	'iconmusic',
	'iconsound',
	'iconvibe',
	'tint_iconsound',
	'tint_iconmusic',
	'tint_iconvibe',
]);

/** Giữ tên hằng Cocos: asset consumer phải preload trước khi dựng widget. */
export const RESULT_ASSETS = keys('result', [
	'BoardBestScore',
	'bg_highlight',
	'titlegameover',
	'titlewin',
	'trophy_board',
]);

/** Giữ tên hằng Cocos: asset consumer phải preload trước khi dựng widget. */
export const TUTORIAL_ASSETS = keys('tutorial', ['icon_hand_tutorial']);

/** Nút HUD chung của Cocos `res/_shared/ui/` (btnHome, btnSetting) — 24/26 game dùng. */
export const HUD_ASSETS = keys('hud', ['btnHome', 'btnSetting']);

/** Cỡ chuẩn nút HUD trên stage 720x1280 (cạnh dài, px) và khoảng cách tới mép màn. */
export const HUD_BUTTON_SIZE = 72;
export const HUD_BUTTON_MARGIN = 20;
