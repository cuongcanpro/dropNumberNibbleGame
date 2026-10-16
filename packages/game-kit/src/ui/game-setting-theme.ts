import { getGameSlug } from '../tracking/game-context';
import { currentCard } from './loading-card';
import { ICON_LAYER, SETTING_BOARD } from './theme-layer-spec';
import { layerTint, type ThemeTarget, themeTarget, themeTexts } from './theme-palette';
import { uiKey } from './ui-keys';

/** Một lớp của bảng nhiều lớp: texture xám + màu `setTint` (nhân). */
export interface BoardLayer {
	readonly texture: string;
	readonly tint: number;
}

/** Chip của Feedback: nền, viền, chữ. */
export interface ChipStyle {
	readonly fill: number;
	readonly stroke: number;
	readonly text: string;
}

export interface GameSettingTheme {
	readonly code: string;
	/** Key texture của khung panel (549x747) khi theme KHÔNG nhiều lớp (theme tự khai của game). */
	readonly background: string;
	/** Có = bảng nhiều lớp xếp chồng cùng khổ, mỗi lớp nhuộm theo màu game; thay cho `background`. */
	readonly boardLayers?: readonly BoardLayer[];
	readonly labelColor: string;
	/** Bỏ trống = title không viền. Khung có dải header đậm cần viền để title trắng đọc được. */
	readonly titleOutlineColor?: string;
	/** Chỉ đặt khi khung KHÔNG có dải header đậm (title trắng sẽ chìm). */
	readonly titleColor?: string;
	readonly icons: { readonly sound: string; readonly music: string; readonly vibration: string };
	/** Nhuộm icon hàng toggle (phép nhân) cho khớp theme. */
	readonly iconTint?: number;
	/** Chip Feedback; bỏ trống = kem + viền theo `labelColor`. */
	readonly chip?: ChipStyle;
	/** Bỏ trống = bộ nút chung (xanh/đỏ/vàng/xanh-dương). Giữ phân vai màu, chỉ đổi tông. */
	readonly buttons?: {
		readonly play: string;
		readonly replay: string;
		readonly home: string;
		readonly secondary: string;
		readonly close: string;
	};
	/** Bỏ trống = công tắc chung. */
	readonly toggle?: { readonly on: string; readonly off: string; readonly knob: string };
}

const s = (name: string) => uiKey('setting', name);

/** Icon xám (một lớp) dùng với `iconTint` của theme theo màu game. */
const TINT_ICONS = {
	sound: s('tint_iconsound'),
	music: s('tint_iconmusic'),
	vibration: s('tint_iconvibe'),
};

const hex = (css: string): number => Number.parseInt(css.slice(1), 16);

/** Theme theo màu chủ đạo: bảng 2 lớp (accent + base) + chữ, chip, icon cùng hue. */
export function paletteTheme(t: ThemeTarget): GameSettingTheme {
	const x = themeTexts(t);
	return {
		code: 'palette',
		background: s('board_base'),
		boardLayers: [
			{ texture: s('board_accent'), tint: layerTint(SETTING_BOARD.accent, t) },
			{ texture: s('board_base'), tint: layerTint(SETTING_BOARD.base, t) },
		],
		labelColor: x.label,
		titleOutlineColor: x.titleOutline,
		icons: TINT_ICONS,
		iconTint: layerTint(ICON_LAYER, t),
		chip: { fill: hex(x.chipFill), stroke: hex(x.chipStroke), text: x.chipText },
	};
}

/** Màu chủ đạo của game đang chạy: `loadingBgColor` Console theo slug (cache tươi nhất, chưa có thì snapshot chụp lúc build). */
export function currentThemeTarget(): ThemeTarget {
	const slug = getGameSlug();
	return themeTarget(slug ? currentCard(slug)?.bgColor : undefined);
}

/** Theme Setting của game đang chạy, ghi một lần khi Setting mở: Exit/Feedback mặc định theo đây. */
let recorded: { gameId?: string | undefined; theme?: GameSettingTheme | undefined } = {};

export function recordSettingTheme(opts: typeof recorded): void {
	if (opts.theme !== undefined) recorded = opts;
}

export function resetRecordedSettingThemeForTest(): void {
	recorded = {};
}

/**
 * Một nguồn cho cả Setting, Exit và Feedback: theme game tự khai (art riêng) > theme Setting đã ghi >
 * màu game trên Console. `gameId` không còn ý nghĩa (nhận để game cũ khỏi vỡ kiểu); kit-config
 * `setting.theme` bị bỏ qua (Anh chốt 12/10: một màu chủ đạo cho cả popup).
 */
export function resolveSettingTheme(opts: {
	readonly gameId?: string | undefined;
	readonly theme?: GameSettingTheme | undefined;
}): GameSettingTheme {
	return opts.theme ?? recorded.theme ?? paletteTheme(currentThemeTarget());
}

/** Style chữ title dùng chung cho Setting, Exit, Feedback (cùng họ theme = cùng kiểu title). */
export function themeTitleStyle(t: GameSettingTheme): {
	color: string;
	outline?: { color: string; px: number };
} {
	return {
		color: t.titleColor ?? '#FFFFFF',
		...(t.titleOutlineColor ? { outline: { color: t.titleOutlineColor, px: 4 } } : {}),
	};
}
