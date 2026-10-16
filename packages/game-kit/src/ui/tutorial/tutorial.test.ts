import { describe, expect, it, vi } from 'vitest';

vi.mock('nibi', () => ({ primaryCanvas: { width: 720, height: 1280 } }));

const { asScene, FakeScene, fake } = await import('../testing/fake-scene');
const { TutorialHand, TutorialTip, createTutorialDim } = await import('./index');
const { FONT_BALOO_STACK, FONT_LILITA_STACK } = await import('../ui-fonts');

/** Font của chữ trong TutorialTip dựng với `options`. */
function labelFont(options?: { font?: string }): unknown {
	const scene = new FakeScene();
	new TutorialTip(asScene(scene), 'tip', options).show('Tránh ô đỏ');
	return scene.byKind('text')[0]?.style.fontFamily;
}

describe('TutorialTip', () => {
	it('show dính tới hide; getText phản ánh chữ', () => {
		const scene = new FakeScene();
		const tip = new TutorialTip(asScene(scene));
		tip.show('Tap here');
		scene.advance(5000);
		expect(tip.getText()).toBe('Tap here');
		expect(tip.root.visible).toBe(true);
		tip.hide();
		scene.advance(300);
		expect(tip.root.visible).toBe(false);
	});

	it('flash tự ẩn sau holdS', () => {
		const scene = new FakeScene();
		const tip = new TutorialTip(asScene(scene));
		tip.flash('Nice!', 1);
		scene.advance(900);
		expect(tip.root.visible).toBe(true);
		scene.advance(600);
		expect(tip.root.visible).toBe(false);
	});

	it('mặc định LilitaOne; chữ Việt truyền font Baloo vì LilitaOne thiếu glyph (đ, ỏ, ể)', () => {
		expect(labelFont()).toBe(FONT_LILITA_STACK);
		expect(labelFont({ font: FONT_BALOO_STACK })).toBe(FONT_BALOO_STACK);
	});
});

describe('TutorialHand', () => {
	it('loopTap hiện hand tại điểm; stopLoop ẩn và dừng vòng lặp', () => {
		const scene = new FakeScene();
		const hand = new TutorialHand(asScene(scene));
		hand.loopTap({ x: 100, y: 200 });
		expect(hand.image.visible).toBe(true);
		expect([hand.image.x, hand.image.y]).toEqual([100, 200]);
		scene.advance(3000); // chạy vài vòng không lỗi
		hand.stopLoop();
		expect(hand.image.visible).toBe(false);
		const before = scene.now;
		scene.advance(5000);
		expect(scene.now).toBe(before + 5000);
		expect(hand.image.visible).toBe(false); // không bị vòng cũ bật lại
	});

	it('loopPath cần >= 2 điểm; loopDrag đặt đầu ở điểm xuất phát', () => {
		const scene = new FakeScene();
		const hand = new TutorialHand(asScene(scene));
		hand.loopPath([{ x: 1, y: 1 }]);
		expect(hand.image.visible).toBe(false);
		hand.loopDrag({ x: 10, y: 20 }, { x: 50, y: 60 });
		expect(hand.image.visible).toBe(true);
		expect([hand.image.x, hand.image.y]).toEqual([10, 20]);
		scene.advance(1100);
		expect([hand.image.x, hand.image.y]).toEqual([50, 60]);
	});

	it('origin đầu ngón (0.2, 0.2)', () => {
		const scene = new FakeScene();
		const hand = new TutorialHand(asScene(scene));
		expect(fake(hand.image).state['setOrigin']).toEqual([0.2, 0.2]);
	});
});

describe('createTutorialDim', () => {
	it('chặn input (interactive), phủ letterbox, onTap khi nhả', () => {
		const scene = new FakeScene();
		scene.scale = { width: 1440, height: 1600 };
		const onTap = vi.fn<() => void>();
		const dim = fake(createTutorialDim(asScene(scene), 'dim', 180, onTap));
		expect(dim.interactive).not.toBeNull();
		expect(dim.width).toBeGreaterThan(720);
		dim.emit('pointerup');
		expect(onTap).toHaveBeenCalledOnce();
	});
});
