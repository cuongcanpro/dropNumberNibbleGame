import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('nibi', () => ({ primaryCanvas: { width: 720, height: 1280 } }));

const { ShakeUi } = await import('./shake-ui');
const { showRewardCard } = await import('./shake-ui-reward');
const { shakeTheme } = await import('./shake-theme');
const { KEYS } = await import('./assets');
const { BackKeyManager } = await import('../platform/back-key-manager');
const { resetGameContextForTest, setGameSlug } = await import('../tracking/game-context');
const { DOT_EMPTY, DOT_FULL, RESULT_BG, SHAKE_BOARD } = await import('../ui/theme-layer-spec');
const { layerTint, themeTarget, themeTexts } = await import('../ui/theme-palette');
const { asScene, FakeScene } = await import('../ui/testing/fake-scene');

const tintOf = (o: { state: Record<string, unknown> }) =>
	(o.state.setTint as number[] | undefined)?.[0];
const cacheCard = (slug: string, bgColor: unknown) =>
	localStorage.setItem(`gk.loading.card.${slug}`, JSON.stringify({ name: slug, bgColor }));

function open() {
	const scene = new FakeScene();
	const motion = { isSupported: () => false, start: async () => false, stop: () => {} };
	new ShakeUi(asScene(scene), { onSuccess: () => {}, onFail: () => {}, motion }).open();
	return scene;
}

beforeEach(() => {
	localStorage.clear();
	resetGameContextForTest();
	BackKeyManager.getInstance().clear();
});
afterEach(() => vi.unstubAllGlobals());

describe('popup lắc theo màu game', () => {
	it('bảng 3 lớp: accent + base (nineslice) nhuộm theo màu Console, thỏ giữ màu gốc', () => {
		setGameSlug('haredoku');
		cacheCard('haredoku', '#5CAAEC');
		const t = themeTarget('#5CAAEC');
		const scene = open();
		const accent = scene.byKind('image').find((i) => i.texture === KEYS.boardAccent);
		const base = scene.byKind('nineslice').find((i) => i.texture === KEYS.boardBase);
		const rabbit = scene.byKind('image').find((i) => i.texture === KEYS.boardRabbit);
		expect(tintOf(accent as never)).toBe(layerTint(SHAKE_BOARD.accent, t));
		expect(tintOf(base as never)).toBe(layerTint(SHAKE_BOARD.base, t));
		expect(base?.width).toBe(SHAKE_BOARD.baseBox.w);
		expect(base?.height).toBe(SHAKE_BOARD.baseBox.h);
		expect(tintOf(rabbit as never)).toBeUndefined();
		// Bảng nhuộm xếp đúng thứ tự: accent dưới, base trên, thỏ trên cùng.
		const layers: string[] = [KEYS.boardAccent, KEYS.boardBase, KEYS.boardRabbit];
		const order = scene.created.filter((o) => layers.includes(o.texture)).map((o) => o.texture);
		expect(order).toEqual([KEYS.boardAccent, KEYS.boardBase, KEYS.boardRabbit]);
	});

	it('màu xám/chưa có màu → cam mặc định (cùng quy tắc palette)', () => {
		setGameSlug('blockblast');
		cacheCard('blockblast', '#424242');
		const t = themeTarget('#E8873E');
		const accent = open()
			.byKind('image')
			.find((i) => i.texture === KEYS.boardAccent);
		expect(tintOf(accent as never)).toBe(layerTint(SHAKE_BOARD.accent, t));
	});

	it('tiêu đề chữ trắng, viền cùng màu viền title Setting', () => {
		setGameSlug('x');
		cacheCard('x', '#81B85F');
		const t = themeTarget('#81B85F');
		const title = open()
			.byKind('text')
			.find((x) => x.text === 'MISSION');
		expect(title?.style.color).toBe('#FFFFFF');
		expect((title?.state.setStroke as unknown[] | undefined)?.[0]).toBe(themeTexts(t).titleOutline);
	});

	it('chữ MISSION là Text thật (vi/en theo ngôn ngữ máy), không còn nướng trong art', () => {
		expect(open().texts()).toContain('MISSION');
		vi.stubGlobal('navigator', { language: 'vi-VN' });
		const scene = open();
		expect(scene.texts()).toContain('NHIỆM VỤ');
		expect(scene.texts()).not.toContain('MISSION');
		// Art mới không có khung "board" nguyên khối chứa chữ nướng.
		expect(scene.created.some((o) => o.texture === 'gk-alt-ad/board')).toBe(false);
	});

	it('chấm đếm nhuộm theo họ accent/base; dòng gợi ý theo hue game', () => {
		setGameSlug('x');
		cacheCard('x', '#81B85F');
		const t = themeTarget('#81B85F');
		const scene = open();
		const dots = scene.byKind('image').filter((i) => i.texture === KEYS.dotEmpty);
		expect(dots).toHaveLength(3);
		expect(dots.map(tintOf)).toEqual(Array(3).fill(layerTint(DOT_EMPTY, t)));
		const hint = scene.byKind('text').find((x) => x.text.startsWith('Shake your phone'));
		expect(hint?.style.color).toBe(themeTexts(t).shakeHint);
		expect(shakeTheme().dotFull).toBe(layerTint(DOT_FULL, t));
	});
});

describe('thẻ kết quả theo màu game', () => {
	it('giấy giữ nguyên, quầng hồng nhuộm + phóng 4 lần, câu chúc cùng hue', () => {
		setGameSlug('x');
		cacheCard('x', '#81B85F');
		const t = themeTarget('#81B85F');
		const scene = new FakeScene();
		const parent = scene.add.container(0, 0);
		showRewardCard(asScene(scene), parent as never, {
			message: 'Nice',
			hasReward: false,
			rewardKey: KEYS.reward,
			rewardAmount: 1,
			fontFamily: 'x',
			theme: shakeTheme(),
			onContinue: () => {},
		});
		const paper = scene.byKind('image').find((i) => i.texture === KEYS.resultPaper);
		const glow = scene.byKind('image').find((i) => i.texture === KEYS.resultGlow);
		expect(tintOf(paper as never)).toBeUndefined();
		expect(tintOf(glow as never)).toBe(layerTint(RESULT_BG.glow, t));
		expect(glow?.scale).toBe(RESULT_BG.glowScale);
		const msg = scene.byKind('text').find((x) => x.text === '"Nice"');
		expect(msg?.style.color).toBe(themeTexts(t).cardMessage);
	});
});
