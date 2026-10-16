import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('nibi', () => ({ primaryCanvas: { width: 720, height: 1280 } }));

const { BackKeyManager } = await import('../platform/back-key-manager');
const { ExitConfirmDialog } = await import('./exit-confirm-dialog');
const { recordSettingTheme, resetRecordedSettingThemeForTest } = await import(
	'./game-setting-theme'
);
const { uiKey } = await import('./ui-keys');
const { asScene, FakeScene, fake } = await import('./testing/fake-scene');

const tapButton = (scene: InstanceType<typeof FakeScene>, label: string) => {
	const text = scene.byKind('text').find((t) => t.text === label);
	// Nút = container [image, label]: image con đầu tiên là vùng bấm.
	const hit = text?.parent?.children.find((c) => c.kind === 'image');
	fake(hit).tap();
};

const iconSet = { sound: 's', music: 'm', vibration: 'v' };
const boardTextures = (opts?: { gameId: string }) => {
	const scene = new FakeScene();
	ExitConfirmDialog.show(asScene(scene), vi.fn<() => void>(), opts);
	return scene.byKind('nineslice').map((n) => n.texture);
};

describe('ExitConfirmDialog', () => {
	beforeEach(() => BackKeyManager.getInstance().clear());

	it('chữ mặc định như Cocos', () => {
		const scene = new FakeScene();
		ExitConfirmDialog.show(asScene(scene), vi.fn<() => void>());
		expect(scene.texts()).toEqual(
			expect.arrayContaining(['Exit?', 'Return to the home screen?', 'Yes', 'No']),
		);
	});

	it('Yes: gọi onConfirm rồi đóng, pop back handler', () => {
		const scene = new FakeScene();
		const onConfirm = vi.fn<() => void>();
		const onCancel = vi.fn<() => void>();
		ExitConfirmDialog.show(asScene(scene), onConfirm, { onCancel });
		tapButton(scene, 'Yes');
		expect(onConfirm).toHaveBeenCalledOnce();
		expect(onCancel).not.toHaveBeenCalled();
		scene.advance(300);
		expect(BackKeyManager.getInstance().dispatch()).toBe(false);
	});

	it('No: gọi onCancel, không gọi onConfirm', () => {
		const scene = new FakeScene();
		const onConfirm = vi.fn<() => void>();
		const onCancel = vi.fn<() => void>();
		ExitConfirmDialog.show(asScene(scene), onConfirm, { onCancel });
		tapButton(scene, 'No');
		expect(onCancel).toHaveBeenCalledOnce();
		expect(onConfirm).not.toHaveBeenCalled();
	});

	it('back key = cancel, nuốt phím; lần back thứ hai không còn nuốt', () => {
		const scene = new FakeScene();
		const onCancel = vi.fn<() => void>();
		ExitConfirmDialog.show(asScene(scene), vi.fn<() => void>(), { onCancel });
		const back = BackKeyManager.getInstance();
		expect(back.dispatch()).toBe(true);
		expect(onCancel).toHaveBeenCalledOnce();
		scene.advance(300);
		expect(back.dispatch()).toBe(false);
	});

	it('nhãn/tiêu đề tuỳ biến', () => {
		const scene = new FakeScene();
		ExitConfirmDialog.show(asScene(scene), vi.fn<() => void>(), {
			title: 'Quit',
			message: 'Sure?',
			yesLabel: 'OK',
			noLabel: 'Stay',
		});
		expect(scene.texts()).toEqual(expect.arrayContaining(['Quit', 'Sure?', 'OK', 'Stay']));
	});

	it('theme Setting tự khai đã ghi thì Exit dùng đúng art đó; không ghi thì bảng 2 lớp theo màu game', () => {
		resetRecordedSettingThemeForTest();
		expect(boardTextures()).toEqual([
			uiKey('setting', 'board_accent'),
			uiKey('setting', 'board_base'),
		]);
		const own = { code: 'own', background: 'own-bg', labelColor: '#000000', icons: iconSet };
		recordSettingTheme({ theme: own });
		expect(boardTextures()).toEqual(['own-bg']);
		resetRecordedSettingThemeForTest();
	});
});
