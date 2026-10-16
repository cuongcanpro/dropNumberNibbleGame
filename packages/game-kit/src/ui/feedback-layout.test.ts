import { describe, expect, it } from 'vitest';
import { CHIP_H, CHIP_W, feedbackLayout, HEADER_H, PANEL_W, worldToCss } from './feedback-layout';

const within = (b: { x: number; y: number; w: number; h: number }, panelH: number) =>
	b.x - b.w / 2 >= -PANEL_W / 2 &&
	b.x + b.w / 2 <= PANEL_W / 2 &&
	b.y - b.h / 2 >= -panelH / 2 &&
	b.y + b.h / 2 <= panelH / 2;

const overlap = (a: { x: number; y: number; w: number; h: number }, b: typeof a) =>
	Math.abs(a.x - b.x) < (a.w + b.w) / 2 && Math.abs(a.y - b.y) < (a.h + b.h) / 2;

describe.each([1, 2, 5, 7, 10])('feedbackLayout %i chip', (n) => {
	for (const hasNote of [true, false]) {
		it(`ghi chú=${hasNote}: chip dưới header, mọi thứ trong panel, không chồng nhau`, () => {
			const l = feedbackLayout(n, hasNote);
			const top = -l.panelH / 2;
			const boxes = l.chips.map((c) => ({ ...c, w: CHIP_W, h: CHIP_H }));
			for (const b of boxes) {
				expect(b.y - b.h / 2).toBeGreaterThanOrEqual(top + HEADER_H); // dưới dải header
				expect(within(b, l.panelH)).toBe(true);
			}
			const all = [...boxes, ...(l.note ? [l.note] : []), l.send];
			for (const b of all) expect(within(b, l.panelH)).toBe(true);
			for (let i = 0; i < all.length; i++)
				for (let j = i + 1; j < all.length; j++)
					expect(overlap(all[i] as never, all[j] as never), `${i}/${j}`).toBe(false);
			// Send nằm DƯỚI ô ghi chú và dưới chip; đáy có đệm, không khoảng chết lớn.
			const last = Math.max(
				...boxes.map((b) => b.y + b.h / 2),
				l.note ? l.note.y + l.note.h / 2 : -1e9,
			);
			expect(l.send.y - l.send.h / 2).toBeGreaterThanOrEqual(last);
			expect(l.send.y - l.send.h / 2 - last).toBeLessThanOrEqual(30);
			expect(l.panelH / 2 - (l.send.y + l.send.h / 2)).toBeLessThanOrEqual(50);
		});
	}
	it('hàng lẻ cuối canh giữa, còn lại 2 cột đối xứng', () => {
		const l = feedbackLayout(n, true);
		expect(l.chips[n - 1]?.x === 0).toBe(n % 2 === 1);
		expect((l.chips[0]?.x ?? 0) < 0).toBe(n > 1);
	});
});

describe('worldToCss', () => {
	const design = { x: 0, y: 0, width: 720, height: 1280 };
	it('FIT trong iframe 360×640: tỉ lệ 0,5', () => {
		const r = worldToCss({ x: 360, y: 640, w: 540, h: 84 }, design, {
			left: 0,
			top: 0,
			width: 360,
			height: 640,
		});
		expect(r).toEqual({ left: 45, top: 299, width: 270, height: 42 });
	});
	it('cửa sổ rộng: canvas letterbox lệch trái/trên, vẫn bám đúng', () => {
		const canvas = { left: 520, top: 10, width: 450, height: 800 };
		const r = worldToCss({ x: 360, y: 640, w: 720, h: 128 }, design, canvas);
		expect(r.left).toBeCloseTo(520);
		expect(r.width).toBeCloseTo(450);
		expect(r.top).toBeCloseTo(10 + (640 - 64) * 0.625);
	});
	it('view lệch (camera zoom, vùng thấy rộng hơn design) vẫn khớp', () => {
		const view = { x: -90, y: 0, width: 900, height: 1280 };
		const r = worldToCss({ x: 360, y: 640, w: 100, h: 100 }, view, {
			left: 0,
			top: 0,
			width: 450,
			height: 640,
		});
		expect(r.left).toBeCloseTo((310 + 90) * 0.5);
		expect(r.width).toBeCloseTo(50);
	});
});
