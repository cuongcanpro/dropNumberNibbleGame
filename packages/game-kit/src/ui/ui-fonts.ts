export const FONT_LILITA = 'LilitaOne';
export const FONT_BALOO = 'Baloo';
/** Font nạp lỗi thì rơi về sans-serif, không chặn game (như Cocos / CLAUDE.md). */
export const FONT_LILITA_STACK = `${FONT_LILITA}, Arial, sans-serif`;
export const FONT_BALOO_STACK = `${FONT_BALOO}, Arial, sans-serif`;

/**
 * Các đoạn codepoint LilitaOne CÓ glyph (đọc từ cmap của file; `ui-fonts.test.ts` đối chiếu lại với
 * TTF thật). Không có U+1EA0–1EF9 và ă đ ĩ ũ ơ ư ⇒ canvas rơi từng ký tự sang Arial, dấu lệch, lẫn font.
 */
const LILITA_RANGES: readonly (readonly [number, number])[] = [
	[0x20, 0x7e],
	[0xa1, 0xae],
	[0xb0, 0xff],
	[0x131, 0x131],
	[0x141, 0x142],
	[0x152, 0x153],
	[0x160, 0x161],
	[0x178, 0x178],
	[0x17d, 0x17e],
	[0x192, 0x192],
	[0x2c6, 0x2c7],
	[0x2da, 0x2da],
	[0x2dc, 0x2dc],
	[0x2013, 0x2014],
	[0x2018, 0x201a],
	[0x201c, 0x201e],
	[0x2020, 0x2022],
	[0x2026, 0x2026],
	[0x2030, 0x2030],
	[0x2039, 0x203a],
	[0x2044, 0x2044],
	[0x20ac, 0x20ac],
	[0x2122, 0x2122],
	[0x2212, 0x2212],
	[0xfb01, 0xfb02],
];

/** `\n` không cần glyph. */
export function lilitaCovers(text: string): boolean {
	for (const ch of text) {
		const c = ch.codePointAt(0) ?? 0;
		if (ch === '\n') continue;
		if (!LILITA_RANGES.some(([a, b]) => c >= a && c <= b)) return false;
	}
	return true;
}

/**
 * Font thực dùng để vẽ `text`: Lilita không phủ hết chuỗi thì CẢ chuỗi sang Baloo (đậm giả cho gần
 * kiểu title), không để canvas trộn từng ký tự. Font khác Lilita giữ nguyên.
 */
export function displayFont(text: string, font: string): { font: string; bold?: true } {
	if (!font.includes(FONT_LILITA) || lilitaCovers(text)) return { font };
	return { font: FONT_BALOO_STACK, bold: true };
}
