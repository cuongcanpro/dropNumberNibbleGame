import { currentThemeTarget } from '../ui/game-setting-theme';
import { DOT_EMPTY, DOT_FULL, RESULT_BG, SHAKE_BOARD } from '../ui/theme-layer-spec';
import { layerTint, themeTexts } from '../ui/theme-palette';

/** Màu của popup lắc theo màu chủ đạo của game, chốt lúc MỞ popup (xem `currentThemeTarget`). */
export interface ShakeTheme {
	readonly accent: number;
	readonly base: number;
	readonly dotFull: number;
	readonly dotEmpty: number;
	readonly glow: number;
	/** Dòng gợi ý "lắc điện thoại". */
	readonly hint: string;
	/** Câu chúc trên thẻ kết quả. */
	readonly message: string;
	/** Viền chữ tiêu đề (chữ trắng) — cùng màu viền title Setting/Exit/Feedback. */
	readonly titleOutline: string;
}

export function shakeTheme(): ShakeTheme {
	const t = currentThemeTarget();
	const x = themeTexts(t);
	return {
		accent: layerTint(SHAKE_BOARD.accent, t),
		base: layerTint(SHAKE_BOARD.base, t),
		dotFull: layerTint(DOT_FULL, t),
		dotEmpty: layerTint(DOT_EMPTY, t),
		glow: layerTint(RESULT_BG.glow, t),
		hint: x.shakeHint,
		message: x.cardMessage,
		titleOutline: x.titleOutline,
	};
}
