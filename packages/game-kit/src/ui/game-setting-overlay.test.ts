import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('nibi', () => ({ primaryCanvas: { width: 720, height: 1280 } }));

const { BackKeyManager } = await import('../platform/back-key-manager');
const { UserData } = await import('../platform/user-data');
const { GameSettingOverlay } = await import('./game-setting-overlay');
const { asScene, FakeScene, fake } = await import('./testing/fake-scene');
const { uiKey } = await import('./ui-keys');

function setup(extra: Record<string, () => void> = {}) {
	const scene = new FakeScene();
	const onResume = vi.fn<() => void>();
	const overlay = new GameSettingOverlay(asScene(scene), { onResume, ...extra });
	return { scene, onResume, overlay };
}

const tex = (name: string) => uiKey('setting', name);

describe('GameSettingOverlay', () => {
	beforeEach(() => {
		localStorage.clear();
		UserData.resetForTest();
		BackKeyManager.getInstance().clear();
	});

	it('chưa show thì không tạo gì, không chặn input', () => {
		const { scene } = setup();
		expect(scene.created).toHaveLength(0);
	});

	it('nút thiếu callback bị ẩn: chỉ PLAY', () => {
		const { scene, overlay } = setup();
		overlay.show();
		const labels = scene.texts();
		expect(labels).toContain('PLAY');
		for (const l of ['REPLAY', 'HOME', 'FEEDBACK', 'THEMES', 'LEVELS'])
			expect(labels).not.toContain(l);
	});

	it('có callback thì nút hiện', () => {
		const { scene, overlay } = setup({
			onRestart: vi.fn<() => void>(),
			onHome: vi.fn<() => void>(),
			onFeedback: vi.fn<() => void>(),
		});
		overlay.show();
		expect(scene.texts()).toEqual(expect.arrayContaining(['REPLAY', 'HOME', 'FEEDBACK', 'PLAY']));
	});

	it('PLAY: đóng rồi mới gọi onResume', () => {
		const { scene, overlay, onResume } = setup();
		overlay.show();
		fake(overlay.getResumeButton()?.hit).tap();
		expect(onResume).not.toHaveBeenCalled();
		scene.advance(300);
		expect(onResume).toHaveBeenCalledOnce();
		expect(overlay.isOpen()).toBe(false);
	});

	it('nút phụ: hide rồi gọi đúng callback', () => {
		const onHome = vi.fn<() => void>();
		const onRestart = vi.fn<() => void>();
		const { scene, overlay } = setup({ onHome, onRestart });
		overlay.show();
		fake(overlay.getRestartButton()?.hit).tap();
		scene.advance(300);
		expect(onRestart).toHaveBeenCalledOnce();
		expect(onHome).not.toHaveBeenCalled();
	});

	it('push back handler khi show, back = resume, pop khi hide', () => {
		const { scene, overlay, onResume } = setup();
		const back = BackKeyManager.getInstance();
		expect(back.dispatch()).toBe(false);
		overlay.show();
		expect(back.dispatch()).toBe(true);
		scene.advance(300);
		expect(onResume).toHaveBeenCalledOnce();
		expect(back.dispatch()).toBe(false); // đã pop
	});

	it('toggle ghi UserData và đổi texture slot', () => {
		const { scene, overlay } = setup();
		overlay.show();
		const sound = overlay.getSoundToggle();
		expect(sound?.slot.texture).toBe(tex('on_off_slot1'));
		fake(sound?.slot).tap();
		expect(UserData.getInstance().getUserSettings().soundEnabled).toBe(false);
		expect(sound?.slot.texture).toBe(tex('on_off_slot2'));
		const x0 = sound?.knob.x ?? 0;
		scene.advance(150);
		expect(sound?.knob.x).toBeLessThan(x0);
		fake(sound?.slot).tap();
		expect(UserData.getInstance().getUserSettings().soundEnabled).toBe(true);
	});

	it('hit area toggle >= 44px', () => {
		const { overlay } = setup();
		overlay.show();
		const hit = fake(overlay.getMusicToggle()?.slot).interactive as {
			hitArea: { width: number; height: number };
		};
		expect(hit.hitArea.height).toBeGreaterThanOrEqual(44);
	});

	it('SHUTDOWN dọn back handler và listener', () => {
		const { scene, overlay } = setup();
		overlay.show();
		scene.events.emit('shutdown');
		expect(BackKeyManager.getInstance().dispatch()).toBe(false);
		expect(scene.events.count('shutdown')).toBe(0);
	});

	it('fog chặn input và phủ cả letterbox', () => {
		const scene = new FakeScene();
		scene.scale = { width: 1440, height: 1600 }; // zoom 1.25 -> view 1152 x 1280
		new GameSettingOverlay(asScene(scene), { onResume: vi.fn<() => void>() }).show();
		const fog = scene.byKind('rectangle')[0];
		expect(fog.interactive).not.toBeNull();
		expect(fog.width).toBeGreaterThan(720);
	});
});
