import { hslToInt, intToCss, rgbToHsl } from './theme-color';

/**
 * Màu chủ đạo của popup = `loadingBgColor` của game trên Console. Chỉ lấy hue + độ đậm; độ sáng từng lớp
 * nnằm sẵn trong art (xem `theme-layer-spec.ts`), nên màu quá sáng (#FAF5F0) hay quá tối (#100929) vẫn ra
 * bảng đọc được.
 */
export const DEFAULT_THEME_COLOR = 0xe8873e;

/** Dưới ngưỡng này là xám (block-blast #424242): không có hue để theo → dùng cam mặc định. */
const GRAY_BELOW = 0.12;
const S_MIN = 0.5;
const S_MAX = 0.75;

export interface ThemeTarget {
	/** 0..360 */
	readonly h: number;
	/** Đã kẹp [0.5, 0.75]. */
	readonly s: number;
}

/** Một lớp art xám đã chuẩn hoá: `k` nhân vào độ đậm đích, `l` là độ sáng tint (pixel xám 1.0 = màu này). */
export interface LayerSpec {
	readonly k: number;
	readonly l: number;
}

const HEX = /^#[0-9a-f]{6}$/i;

const fromInt = (c: number): ThemeTarget => {
	const { h, s } = rgbToHsl((c >> 16) & 255, (c >> 8) & 255, c & 255);
	return { h, s };
};

/** Hex sai dạng / thiếu / xám → cam mặc định. */
export function themeTarget(hex: unknown): ThemeTarget {
	let t =
		typeof hex === 'string' && HEX.test(hex) ? fromInt(Number.parseInt(hex.slice(1), 16)) : null;
	if (!t || t.s < GRAY_BELOW) t = fromInt(DEFAULT_THEME_COLOR);
	return { h: t.h, s: Math.min(S_MAX, Math.max(S_MIN, t.s)) };
}

/** Màu `setTint` (nhân) của một lớp: hue đích, độ đậm đích × k, độ sáng của lớp. */
export function layerTint(spec: LayerSpec, t: ThemeTarget): number {
	return hslToInt(t.h, Math.min(1, spec.k * t.s), spec.l);
}

export function tintFromColor(spec: LayerSpec, hex: unknown): number {
	return layerTint(spec, themeTarget(hex));
}

export interface ThemeTexts {
	readonly label: string;
	readonly titleOutline: string;
	readonly shakeHint: string;
	readonly cardMessage: string;
	readonly chipFill: string;
	readonly chipStroke: string;
	readonly chipText: string;
}

const css = (h: number, s: number, l: number): string => intToCss(hslToInt(h, s, l));

/** Màu chữ/viền theo màu chủ đạo (số lấy từ mockup Anh duyệt 12/10). */
export function themeTexts(t: ThemeTarget): ThemeTexts {
	return {
		label: css(t.h, t.s, 0.42),
		titleOutline: css(t.h, t.s, 0.32),
		shakeHint: css(t.h, t.s, 0.38),
		cardMessage: css(t.h, t.s * 0.6, 0.32),
		chipFill: css(t.h, t.s * 0.55, 0.9),
		chipStroke: css(t.h, t.s * 0.8, 0.55),
		chipText: css(t.h, t.s, 0.35),
	};
}
