import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('nibi', () => ({ primaryCanvas: { width: 720, height: 1280 } }));
const canShare = vi.fn<() => boolean>(() => true);
vi.mock('../shell/share', () => ({ canShare: () => canShare() }));

const { BackKeyManager } = await import('../platform/back-key-manager');
const { GameResultPopup } = await import('./game-result-popup');
const { asScene, FakeScene, fake } = await import('./testing/fake-scene');
const { uiKey } = await import('./ui-keys');

const view = { rank: 976, topPercent: 20, beaten: 1234 } as never;
const rankBoard = (scene: InstanceType<typeof FakeScene>) =>
	scene.byKind('image').find((i) => i.texture === uiKey('result', 'trophy_board'));

function setup(opts: Record<string, unknown> = {}) {
	const scene = new FakeScene();
	const onReplay = vi.fn<() => void>();
	const popup = new GameResultPopup(asScene(scene), { onReplay, ...opts });
	return { scene, popup, onReplay };
}

describe('GameResultPopup', () => {
	beforeEach(() => {
		canShare.mockReturnValue(true);
		BackKeyManager.getInstance().clear();
	});

	it('game over thường: Your Score + chip best', () => {
		const { scene, popup } = setup();
		popup.show({ score: 1500, bestScore: 20000 });
		expect(scene.texts()).toEqual(expect.arrayContaining(['Your Score', '1,500', 'Best: 20,000']));
	});

	it('lose / level-failed: không lấy halo của khối mừng', () => {
		const { scene, popup } = setup();
		popup.show({ failedLevel: 3 });
		const halo = scene.byKind('image').find((i) => i.texture === uiKey('result', 'bg_highlight'));
		expect(halo?.visible).toBe(false);
	});

	it('new best: halo + nhãn Best Score', () => {
		const { scene, popup } = setup();
		popup.show({ score: 9, isNewBest: true });
		const halo = scene.byKind('image').find((i) => i.texture === uiKey('result', 'bg_highlight'));
		expect(halo?.visible).toBe(true);
		expect(scene.texts()).toContain('Best Score');
	});

	it('metric level: Your Level + Best Level', () => {
		const { scene, popup } = setup();
		popup.show({ score: 9, bestScore: 12, metric: 'level' });
		expect(scene.texts()).toEqual(expect.arrayContaining(['Your Level', 'Best Level: 12']));
	});

	it('destroy: gỡ ngay popup, không gọi onReplay, an toàn gọi lặp', () => {
		const { scene, popup, onReplay } = setup();
		popup.destroy(); // trước show cũng không ném
		popup.show({ score: 1 });
		expect(scene.byKind('image').length).toBeGreaterThan(0);
		popup.destroy();
		expect(scene.byKind('image')).toHaveLength(0);
		expect(onReplay).not.toHaveBeenCalled();
		popup.destroy();
		popup.show({ score: 2 }); // mở lại được
		expect(scene.byKind('image').length).toBeGreaterThan(0);
	});

	it('Replay: đóng rồi mới gọi onReplay', () => {
		const { scene, popup, onReplay } = setup();
		popup.show({ score: 1 });
		fake(popup.getReplayButton()?.hit).tap();
		expect(onReplay).not.toHaveBeenCalled();
		scene.advance(300);
		expect(onReplay).toHaveBeenCalledOnce();
	});

	it('khối rank ẩn khi chưa có / null (offline), hiện khi có RankView', () => {
		const { scene, popup } = setup();
		popup.show({ score: 1 });
		expect(rankBoard(scene)?.parent?.visible).toBe(false);
		popup.applyRank(null);
		expect(rankBoard(scene)?.parent?.visible).toBe(false);
		popup.applyRank(view);
		expect(rankBoard(scene)?.parent?.visible).toBe(true);
		expect(scene.texts()).toEqual(expect.arrayContaining(['TOP 20%', 'Beat 1,234 players']));
		popup.applyRank(null);
		expect(rankBoard(scene)?.parent?.visible).toBe(false);
	});

	it('hạng tới TRƯỚC show vẫn được áp khi mở', () => {
		const { scene, popup } = setup();
		popup.applyRank(view);
		popup.show({ score: 1 });
		expect(rankBoard(scene)?.parent?.visible).toBe(true);
	});

	it('top bảng hiện #hạng; beaten 0 ẩn dòng Beat', () => {
		const { scene, popup } = setup();
		popup.show({ score: 1 });
		popup.applyRank({ rank: 3, topPercent: 0.1, beaten: 0 } as never);
		expect(scene.texts()).toContain('#3');
		const beaten = scene.byKind('text').find((t) => t.text === '');
		expect(beaten?.visible).toBe(false);
	});

	it('Share chỉ hiện khi canShare() và có onShare', () => {
		canShare.mockReturnValue(false);
		const a = setup({ onShare: vi.fn<() => void>() });
		a.popup.show({ score: 1 });
		expect(a.popup.getShareButton()).toBeNull();
		expect(a.scene.texts()).not.toContain('Share');

		canShare.mockReturnValue(true);
		const b = setup();
		b.popup.show({ score: 1 });
		expect(b.popup.getShareButton()).toBeNull(); // không có callback

		const onShare = vi.fn<() => void>();
		const c = setup({ onShare });
		c.popup.show({ score: 1 });
		fake(c.popup.getShareButton()?.hit).tap();
		expect(onShare).toHaveBeenCalledOnce();
		expect(c.scene.texts()).toContain('Share');
	});

	it('KHÔNG có nút Home; phím Back = onHome nếu game còn truyền, không thì nuốt', () => {
		const a = setup();
		a.popup.show({ score: 1 });
		expect(a.scene.texts()).not.toContain('Home');
		expect(BackKeyManager.getInstance().dispatch()).toBe(true); // nuốt, không thoát

		BackKeyManager.getInstance().clear();
		const onHome = vi.fn<() => void>();
		const b = setup({ onHome });
		b.popup.show({ score: 1 });
		expect(b.scene.texts()).not.toContain('Home');
		expect(BackKeyManager.getInstance().dispatch()).toBe(true);
		b.scene.advance(300);
		expect(onHome).toHaveBeenCalledOnce();
	});

	it('level clear / failed dùng nhãn Level', () => {
		const a = setup();
		a.popup.show({ clearedLevel: 7 });
		expect(a.scene.texts()).toEqual(expect.arrayContaining(['Level', '7']));
		const b = setup();
		b.popup.show({ failedLevel: 3 });
		expect(b.scene.texts()).toEqual(expect.arrayContaining(['Level', '3']));
	});

	it('replayLabel tuỳ biến', () => {
		const { scene, popup } = setup({ replayLabel: 'Continue' });
		popup.show({ score: 1 });
		expect(scene.texts()).toContain('Continue');
	});
});
