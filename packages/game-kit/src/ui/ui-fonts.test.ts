import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { displayFont, FONT_BALOO_STACK, FONT_LILITA_STACK, lilitaCovers } from './ui-fonts';

/** Đọc cmap (format 4 + 12) thẳng từ file TTF để bảng phủ trong code không thể lệch khỏi font thật. */
function cmapOf(file: string): Set<number> {
	const b = readFileSync(new URL(`../../assets/fonts/${file}`, import.meta.url));
	const v = new DataView(b.buffer, b.byteOffset, b.byteLength);
	const tables = v.getUint16(4);
	let cmapAt = 0;
	for (let i = 0; i < tables; i++) {
		const rec = 12 + i * 16;
		if (b.toString('latin1', rec, rec + 4) === 'cmap') cmapAt = v.getUint32(rec + 8);
	}
	const out = new Set<number>();
	const n = v.getUint16(cmapAt + 2);
	for (let i = 0; i < n; i++) {
		const at = cmapAt + v.getUint32(cmapAt + 4 + i * 8 + 4);
		const fmt = v.getUint16(at);
		if (fmt === 4) {
			const segX2 = v.getUint16(at + 6);
			const end = at + 14;
			const start = end + segX2 + 2;
			for (let s = 0; s < segX2 / 2; s++) {
				const e = v.getUint16(end + s * 2);
				for (let c = v.getUint16(start + s * 2); c <= e && c < 0xffff; c++) out.add(c);
			}
		} else if (fmt === 12) {
			const groups = v.getUint32(at + 12);
			for (let g = 0; g < groups; g++) {
				const o = at + 16 + g * 12;
				for (let c = v.getUint32(o); c <= v.getUint32(o + 4); c++) out.add(c);
			}
		}
	}
	return out;
}

describe('lilitaCovers', () => {
	it('khớp từng codepoint với cmap thật của LilitaOne và Baloo phủ đủ tiếng Việt', () => {
		const lilita = cmapOf('LilitaOne-Regular.ttf');
		const wrong: string[] = [];
		for (let c = 0x20; c <= 0x2fff; c++)
			if (lilitaCovers(String.fromCodePoint(c)) !== lilita.has(c))
				wrong.push(`U+${c.toString(16)}`);
		expect(wrong).toEqual([]);
		const baloo = cmapOf('Baloo-Regular.ttf');
		for (let c = 0x1ea0; c <= 0x1ef9; c++) expect(baloo.has(c)).toBe(true);
		for (const ch of 'ăâđêôơưĂÂĐÊÔƠƯ') expect(baloo.has(ch.codePointAt(0) ?? 0)).toBe(true);
	});
});

describe('displayFont', () => {
	it('chuỗi Lilita phủ được giữ nguyên font', () => {
		expect(displayFont('FEEDBACK', FONT_LILITA_STACK)).toEqual({ font: FONT_LILITA_STACK });
	});
	it('chuỗi có ký tự Lilita thiếu ⇒ CẢ chuỗi sang Baloo đậm', () => {
		const shown = ['NHIỆM VỤ', 'Đóng', 'Gửi', 'Hơn 1.193 người chơi', 'ư'].map((s) =>
			displayFont(s, FONT_LILITA_STACK),
		);
		expect(shown).toEqual(
			Array.from({ length: 5 }, () => ({ font: FONT_BALOO_STACK, bold: true })),
		);
	});
	it('font khác Lilita không bị đụng', () => {
		expect(displayFont('NHIỆM VỤ', FONT_BALOO_STACK)).toEqual({ font: FONT_BALOO_STACK });
		expect(displayFont('NHIỆM VỤ', 'sans-serif')).toEqual({ font: 'sans-serif' });
	});
});
