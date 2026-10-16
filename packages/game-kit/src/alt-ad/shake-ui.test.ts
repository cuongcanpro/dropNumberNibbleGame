import { describe, expect, it, vi } from 'vitest';

vi.mock('nibi', () => ({ primaryCanvas: { width: 720, height: 1280 } }));

const { ShakeUi } = await import('./shake-ui');
const { dismissShakeUi, simulateShakeSuccess } = await import('./shake-ui-sim');
const { BackKeyManager } = await import('../platform/back-key-manager');
const { asScene, FakeScene } = await import('../ui/testing/fake-scene');

function mk() {
	const scene = new FakeScene();
	const motion = {
		isSupported: () => true,
		start: vi.fn<() => Promise<boolean>>(async () => true),
		stop: vi.fn<() => void>(),
	};
	const onFail = vi.fn<(reason: string) => void>();
	const onSuccess = vi.fn<() => void>();
	const ui = new ShakeUi(asScene(scene), { onSuccess, onFail, motion });
	ui.open();
	return { scene, motion, onFail, onSuccess };
}

describe('ShakeUi vòng đời', () => {
	it('scene shutdown giữa chừng: dừng motion, onFail("abandoned") đúng 1 lần', () => {
		const { scene, motion, onFail, onSuccess } = mk();
		scene.advance(600); // vào xong -> startSensing
		expect(motion.start).toHaveBeenCalledTimes(1);
		scene.events.emit('shutdown');
		scene.events.emit('destroy'); // emit thứ hai không được gọi lại
		expect(motion.stop).toHaveBeenCalled();
		expect(onFail).toHaveBeenCalledTimes(1);
		expect(onFail).toHaveBeenCalledWith('abandoned');
		expect(onSuccess).not.toHaveBeenCalled();
		expect(BackKeyManager.getInstance().dispatch()).toBe(false); // back handler đã gỡ
	});

	it('shutdown trước khi animation vào xong: không start motion sau đó', () => {
		const { scene, motion, onFail } = mk();
		scene.events.emit('shutdown');
		scene.advance(600);
		expect(motion.start).not.toHaveBeenCalled();
		expect(onFail).toHaveBeenCalledTimes(1);
	});

	it('đóng bình thường (X): onFail("skipped") một lần, shutdown sau đó không gọi thêm', () => {
		const { scene, onFail } = mk();
		scene.advance(600);
		BackKeyManager.getInstance().dispatch(); // back -> abandoned qua animateOut
		scene.advance(400);
		scene.events.emit('shutdown');
		expect(onFail).toHaveBeenCalledTimes(1);
		expect(onFail).toHaveBeenCalledWith('abandoned');
	});

	it('shutdown giữa animateOut: outcome đang chờ vẫn được trả đúng 1 lần', () => {
		const { scene, onFail } = mk();
		scene.advance(600);
		BackKeyManager.getInstance().dispatch();
		scene.events.emit('shutdown'); // tween bị scene giết -> không tự complete
		scene.advance(400);
		expect(onFail).toHaveBeenCalledTimes(1);
	});
});

describe('simulateShakeSuccess (QA hook)', () => {
	it('không có popup mở: trả false', () => {
		expect(simulateShakeSuccess()).toBe(false);
	});

	it('đếm đủ maxShakes qua session.tap rồi hiện reward; không bỏ qua lockMs', () => {
		const { scene, onFail, onSuccess } = mk();
		// FakeScene chưa có tweens.chain (cookie burst) — no-op là đủ cho test luật đếm.
		Object.assign(scene.tweens, { chain: () => undefined });
		expect(simulateShakeSuccess()).toBe(true);
		scene.advance(550 + 3 * 260 + 700); // vào xong + 3 lượt cách lockMs+10 + RESULT_DELAY
		expect(onFail).not.toHaveBeenCalled();
		expect(onSuccess).not.toHaveBeenCalled(); // dừng ở thẻ reward, chờ Continue
		scene.events.emit('shutdown');
		expect(simulateShakeSuccess()).toBe(false); // hook tự gỡ khi popup đóng
	});
});

describe('dismissShakeUi', () => {
	it('không có popup mở: trả false', () => {
		expect(dismissShakeUi()).toBe(false);
	});

	it('đóng popup đang mở như nút Back: onFail("abandoned") đúng 1 lần, gỡ back handler', () => {
		const { scene, motion, onFail, onSuccess } = mk();
		scene.advance(600);
		expect(dismissShakeUi()).toBe(true);
		scene.advance(400);
		expect(motion.stop).toHaveBeenCalled();
		expect(onFail).toHaveBeenCalledTimes(1);
		expect(onFail).toHaveBeenCalledWith('abandoned');
		expect(onSuccess).not.toHaveBeenCalled();
		expect(BackKeyManager.getInstance().dispatch()).toBe(false);
		expect(dismissShakeUi()).toBe(false);
	});
});
