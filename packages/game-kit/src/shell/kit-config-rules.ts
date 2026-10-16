import type { KitConfig, RankBoardName, RankLayout } from './kit-config';

/** HUD của game: nút Home/Setting có hiện không. */
export function hudButtons(cfg: KitConfig): { home: boolean; setting: boolean } {
	return { home: cfg.hud.showHome, setting: cfg.hud.showSetting };
}

export type SettingButtonName = 'restart' | 'home' | 'feedback' | 'levels' | 'themes';

/**
 * Nút Setting chỉ hiện khi game có handler VÀ config không tắt. Feedback còn cần `feedback.enabled`.
 * Config chỉ TẮT được nút, không bật nút mà game chưa nối handler (mặc định "bật" ≠ "tự thêm").
 */
export function settingButtonVisible(
	name: SettingButtonName,
	hasHandler: boolean,
	cfg: KitConfig,
): boolean {
	if (!hasHandler || !cfg.setting.buttons[name]) return false;
	return name === 'feedback' ? cfg.feedback.enabled : true;
}

export function rankLayoutOf(cfg: KitConfig): RankLayout {
	return cfg.rank.layout;
}

/** Board config thắng mặc định của game. */
export function rankBoardOf(cfg: KitConfig, gameDefault: RankBoardName = 'score'): RankBoardName {
	return cfg.rank.board ?? gameDefault;
}

/** Lý do góp ý: config (nếu có) thay hẳn danh sách mặc định. */
export function feedbackReasonsOf(cfg: KitConfig, fallback: readonly string[]): readonly string[] {
	return cfg.feedback.reasons.length > 0 ? cfg.feedback.reasons : fallback;
}
