import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('nibi', () => ({ primaryCanvas: { width: 720, height: 1280 } }));
vi.mock('../shell/share', () => ({ canShare: () => true }));

const { BackKeyManager } = await import('../platform/back-key-manager');
const { UserData } = await import('../platform/user-data');
const { parseKitConfig } = await import('../shell/kit-config');
const { resetKitConfigForTest, setKitConfig } = await import('../shell/kit-config-store');
const { ExitConfirmDialog } = await import('./exit-confirm-dialog');
const { GameResultPopup } = await import('./game-result-popup');
const { GameSettingOverlay } = await import('./game-setting-overlay');
const { mountRank } = await import('./mount-rank');
const { FEEDBACK_REASONS } = await import('./feedback-model');
const { FeedbackSheet } = await import('./feedback-sheet');
const { asScene, FakeScene } = await import('./testing/fake-scene');
const { uiKey } = await import('./ui-keys');

const apply = (parts: unknown) => setKitConfig(parseKitConfig({ parts }));
const fn = () => vi.fn<() => void>();
const trophy = (scene: InstanceType<typeof FakeScene>) =>
	scene.byKind('image').some((i) => i.texture === uiKey('result', 'trophy_board'));
const openSetting = (cb: Record<string, unknown> = {}) => {
	const scene = new FakeScene();
	const overlay = new GameSettingOverlay(asScene(scene), { onResume: fn(), ...cb });
	overlay.show();
	return { scene, overlay };
};
const showResult = (opts: Record<string, unknown> = {}) => {
	const scene = new FakeScene();
	const popup = new GameResultPopup(asScene(scene), {
		onReplay: fn(),
		onHome: fn(),
		onShare: fn(),
		...opts,
	});
	popup.show({ score: 5 });
	return { scene, popup };
};

beforeEach(() => {
	localStorage.clear();
	UserData.resetForTest();
	BackKeyManager.getInstance().clear();
	resetKitConfigForTest();
});
afterEach(() => resetKitConfigForTest());

describe('setting', () => {
	it('setting.theme của Console bị bỏ qua: bảng luôn là 2 lớp theo màu game', () => {
		apply({ setting: { theme: 'red' } });
		const { scene } = openSetting({ gameId: 'tripletile' });
		const boards = scene
			.byKind('image')
			.filter((i) => i.texture.startsWith(uiKey('setting', 'board_')))
			.map((i) => i.texture);
		expect(boards).toEqual([uiKey('setting', 'board_accent'), uiKey('setting', 'board_base')]);
	});

	it('theme game tự khai (art riêng) vẫn được dùng, Console không còn ghi đè', () => {
		apply({ setting: { theme: 'red' } });
		const own = {
			code: 'own',
			background: 'own-bg',
			labelColor: '#000000',
			icons: { sound: 's', music: 'm', vibration: 'v' },
		};
		const { scene } = openSetting({ theme: own });
		expect(scene.byKind('image').some((i) => i.texture === 'own-bg')).toBe(true);
	});

	it('toggles.* ẩn hàng và dồn các hàng còn lại lên', () => {
		apply({ setting: { toggles: { sound: false } } });
		const { scene, overlay } = openSetting();
		expect(scene.texts()).not.toContain('Sound');
		expect(scene.texts()).toEqual(expect.arrayContaining(['Music', 'Vibration']));
		expect(overlay.getSoundToggle()).toBeUndefined();
		expect(overlay.getMusicToggle()).toBeDefined();
		const music = scene.byKind('text').find((t) => t.text === 'Music');
		expect(music?.y).toBe(747 / 2 - 570); // Music lên đúng slot đầu (y Cocos 570)
	});

	it('buttons.* ẩn nút dù game có handler; PLAY luôn còn', () => {
		apply({ setting: { buttons: { home: false, restart: false } }, feedback: { enabled: false } });
		const { scene } = openSetting({
			onHome: fn(),
			onRestart: fn(),
			onFeedback: fn(),
			onLevels: fn(),
		});
		const labels = scene.texts();
		expect(labels).toEqual(expect.arrayContaining(['PLAY', 'LEVELS']));
		for (const l of ['HOME', 'REPLAY', 'FEEDBACK']) expect(labels).not.toContain(l);
	});
});

describe('result', () => {
	it('mặc định: Share + Replay, KHÔNG có nút Home dù game truyền onHome', () => {
		const t = showResult().scene.texts();
		expect(t).toEqual(expect.arrayContaining(['Share', 'Replay']));
		expect(t).not.toContain('Home');
	});

	it('showShare=false ẩn nút, replayLabel đổi nhãn', () => {
		apply({ result: { showShare: false, showHome: false, replayLabel: 'Chơi lại' } });
		const t = showResult().scene.texts();
		expect(t).toContain('Chơi lại');
		expect(t).not.toContain('Share');
		expect(t).not.toContain('Home');
	});

	it('nhãn Console thắng nhãn game; không có config thì dùng nhãn game', () => {
		apply({ result: { replayLabel: 'Chơi lại' } });
		expect(showResult({ replayLabel: 'Again' }).scene.texts()).toContain('Chơi lại');
		resetKitConfigForTest();
		expect(showResult({ replayLabel: 'Again' }).scene.texts()).toContain('Again');
	});

	it('rank full cũ ⇒ đọc thành block: khối trophy hiện, không có nút xem hạng', () => {
		apply({ rank: { layout: 'full' } });
		const { scene, popup } = showResult();
		popup.applyRank({ rank: 3, topPercent: 1, beaten: 9 } as never);
		const board = scene.byKind('image').find((i) => i.texture === uiKey('result', 'trophy_board'));
		expect(board?.parent?.visible).toBe(true);
		expect(scene.texts()).not.toContain('See ranking');
	});

	it('rank block ⇒ không có nút xem hạng', () => {
		expect(showResult().scene.texts()).not.toContain('See ranking');
	});

	it('rank off ⇒ khối hạng không bao giờ hiện, kể cả khi có RankView', () => {
		apply({ rank: { layout: 'off' } });
		const { scene, popup } = showResult();
		popup.applyRank({ rank: 3, topPercent: 1, beaten: 9 } as never);
		const board = scene.byKind('image').find((i) => i.texture === uiKey('result', 'trophy_board'));
		expect(board?.parent?.visible).toBe(false);
	});
});

describe('exit', () => {
	it('chữ Console thắng chữ game; chỗ Console không đặt thì dùng chữ game', () => {
		apply({ exit: { title: 'Thoát game?', yesLabel: 'Ừ', noLabel: 'Thôi' } });
		const scene = new FakeScene();
		ExitConfirmDialog.show(asScene(scene), fn(), { noLabel: 'Ở lại', message: 'Về nhà?' });
		expect(scene.texts()).toEqual(expect.arrayContaining(['Thoát game?', 'Ừ', 'Thôi', 'Về nhà?']));
	});
});

describe('feedback', () => {
	it('lý do Console thay danh sách cứng; không có thì dùng danh sách cứng', () => {
		const scene = new FakeScene();
		apply({ feedback: { reasons: ['Lỗi A', 'Lỗi B'] } });
		FeedbackSheet.show(asScene(scene), { gameKey: 'g' });
		expect(scene.texts()).toEqual(expect.arrayContaining(['Lỗi A', 'Lỗi B']));
		expect(scene.texts()).not.toContain(FEEDBACK_REASONS[0]);
		resetKitConfigForTest();
		const s2 = new FakeScene();
		FeedbackSheet.show(asScene(s2), { gameKey: 'g' });
		expect(s2.texts()).toContain(FEEDBACK_REASONS[0]);
	});
});

describe('mountRank', () => {
	it('block (mặc định): gắn khối trophy vào container', () => {
		const scene = new FakeScene();
		const container = scene.add.container(0, 0) as never;
		const m = mountRank(asScene(scene), { score: 10, container });
		expect(m.layout).toBe('block');
		expect(trophy(scene)).toBe(true);
		m.destroy();
		m.destroy(); // idempotent
	});

	it('full cũ: đọc thành block, vẫn dựng khối trophy', () => {
		apply({ rank: { layout: 'full' } });
		const scene = new FakeScene();
		const m = mountRank(asScene(scene), { score: 10 });
		expect(m.layout).toBe('block');
		expect(trophy(scene)).toBe(true);
	});

	it('off: không dựng gì', () => {
		apply({ rank: { layout: 'off' } });
		const scene = new FakeScene();
		const m = mountRank(asScene(scene), { score: 10 });
		expect(m.layout).toBe('off');
		expect(scene.created).toHaveLength(0);
	});
});
