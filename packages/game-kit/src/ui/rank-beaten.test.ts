import { describe, expect, it, vi } from 'vitest';

vi.mock('nibi', () => ({ primaryCanvas: { width: 720, height: 1280 } }));

const { asScene, FakeScene, fake } = await import('./testing/fake-scene');
const { BEATEN_OFFSET_Y, BEATEN_SIZE, makeBeatenText } = await import('./rank-beaten');
const { ResultRankBlock } = await import('./result-rank-block');

/** Phần nhìn thấy của trophy_board (frame cao 140 có đệm bóng) là ±56; viền sáng ~5 ở đáy. */
const BANNER_HALF = 56;
const BORDER = 5;
/** Phần nhìn thấy của chữ Baloo ≈ 1,3 × cỡ (đã tính viền). */
const LINE = 1.3;

describe('dòng "Beat N players" trong banner hạng', () => {
	it('đủ to để đọc (≥ 22) và nằm trọn trong banner, cách viền đáy', () => {
		expect(BEATEN_SIZE).toBeGreaterThanOrEqual(22);
		const bottom = -BEATEN_OFFSET_Y + BEATEN_SIZE * LINE;
		expect(bottom).toBeLessThanOrEqual(BANNER_HALF - BORDER);
	});

	it('nằm dưới huy hiệu hạng với khoảng hở, không chồng lên', () => {
		const scene = new FakeScene();
		const block = new ResultRankBlock(asScene(scene));
		block.apply({ rank: 7, topPercent: 1, beaten: 1193 } as never);
		const texts = scene.byKind('text');
		const badge = fake(texts.find((t) => t.text === '#7'));
		const beaten = fake(texts.find((t) => t.text.startsWith('Beat')));
		const badgeBottom = badge.y + 38 * 0.35; // chữ số cao ≈ 0,7 × cỡ, neo giữa
		expect(beaten.y).toBeGreaterThanOrEqual(badgeBottom); // beaten neo ĐỈNH
		expect(beaten.visible).toBe(true);
	});

	it('chữ trắng viền đậm để đọc được trên mọi nền', () => {
		const scene = new FakeScene();
		makeBeatenText(asScene(scene));
		const t = fake(scene.byKind('text')[0]);
		expect(t.style.color).toBe('#FFFFFF');
		expect((t.state.setStroke as number[])[1]).toBeGreaterThanOrEqual(6);
	});
});
