import { describe, expect, it, vi } from 'vitest';

vi.mock('nibi', () => ({ primaryCanvas: { width: 720, height: 1280 } }));

const { asScene, FakeScene, fake } = await import('./testing/fake-scene');
const { FONT_BALOO_STACK, FONT_LILITA_STACK } = await import('./ui-fonts');
const { makeText, setDisplayText } = await import('./widgets');

describe('makeText chọn font theo glyph', () => {
	it('Lilita + tiếng Việt ⇒ Baloo đậm cho cả chuỗi', () => {
		const scene = new FakeScene();
		makeText(asScene(scene), { text: 'NHIỆM VỤ', size: 50, font: FONT_LILITA_STACK });
		const t = fake(scene.byKind('text')[0]);
		expect(t.style.fontFamily).toBe(FONT_BALOO_STACK);
		expect(t.style.fontStyle).toBe('bold');
	});
	it('Lilita + chuỗi Anh ⇒ giữ Lilita', () => {
		const scene = new FakeScene();
		makeText(asScene(scene), { text: 'MISSION', size: 50, font: FONT_LILITA_STACK });
		expect(fake(scene.byKind('text')[0]).style.fontFamily).toBe(FONT_LILITA_STACK);
	});
	it('setDisplayText đổi font theo chữ mới và trả lại Lilita khi hết dấu', () => {
		const scene = new FakeScene();
		const t = makeText(asScene(scene), { text: '', size: 50, font: FONT_LILITA_STACK });
		setDisplayText(t, 'Đảo');
		const o = fake(scene.byKind('text')[0]);
		expect(o.state.setFontFamily).toEqual([FONT_BALOO_STACK]);
		expect(o.state.setFontStyle).toEqual(['bold']);
		setDisplayText(t, 'Island');
		expect(o.state.setFontFamily).toEqual([FONT_LILITA_STACK]);
		expect(o.state.setFontStyle).toEqual(['normal']);
	});
});
