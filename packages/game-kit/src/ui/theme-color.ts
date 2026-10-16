// Toán màu HSL thuần (không import gì): kit dùng khi mở popup, script sinh lớp art dùng khi nướng ảnh,
// nên cả hai tính CÙNG một công thức. Không import để node chạy thẳng file .ts được.

export interface Hsl {
	/** 0..360 */
	readonly h: number;
	/** 0..1 */
	readonly s: number;
	/** 0..1 */
	readonly l: number;
}

export function rgbToHsl(r: number, g: number, b: number): Hsl {
	const rr = r / 255;
	const gg = g / 255;
	const bb = b / 255;
	const mx = Math.max(rr, gg, bb);
	const mn = Math.min(rr, gg, bb);
	const l = (mx + mn) / 2;
	if (mx === mn) return { h: 0, s: 0, l };
	const d = mx - mn;
	const s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
	let h: number;
	if (mx === rr) h = (gg - bb) / d + (gg < bb ? 6 : 0);
	else if (mx === gg) h = (bb - rr) / d + 2;
	else h = (rr - gg) / d + 4;
	return { h: h * 60, s, l };
}

/** RGB 0..255 (số thực, chưa làm tròn). */
export function hslToRgb(h: number, s: number, l: number): [number, number, number] {
	const a = s * Math.min(l, 1 - l);
	const f = (n: number): number => {
		const k = (n + h / 30) % 12;
		return (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))) * 255;
	};
	return [f(0), f(8), f(4)];
}

/** 0xRRGGBB (làm tròn, kẹp 0..255). */
export function hslToInt(h: number, s: number, l: number): number {
	const [r, g, b] = hslToRgb(h, s, l).map((v) => Math.max(0, Math.min(255, Math.round(v))));
	return ((r as number) << 16) | ((g as number) << 8) | (b as number);
}

/** `#rrggbb` thường, cho style chữ của Phaser. */
export function intToCss(c: number): string {
	return `#${c.toString(16).padStart(6, '0')}`;
}
