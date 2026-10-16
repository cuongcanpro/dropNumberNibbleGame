import { describe, expect, it, vi } from 'vitest';

vi.mock('nibi', () => ({ primaryCanvas: { width: 720, height: 1280 } }));

const { createOverlay } = await import('./overlay-base');
const { asScene, FakeScene } = await import('./testing/fake-scene');
const { killTweensDeep } = await import('./destroy-deep');
const { fake } = await import('./testing/fake-objects');

describe('killTweensDeep', () => {
	it('huỷ tween của object và mọi con cháu trong Container', () => {
		const scene = new FakeScene();
		const root = scene.add.container();
		const inner = scene.add.container();
		const halo = scene.add.image();
		inner.add(halo);
		root.add(inner);
		let fired = 0;
		scene.tweens.add({ targets: halo, angle: 360, duration: 100, onComplete: () => fired++ });
		killTweensDeep(scene, root);
		scene.advance(1000);
		expect(fired).toBe(0);
	});

	it('overlay đóng xong không để tween của panel con chạy tiếp (popup kết quả rò vầng sáng)', () => {
		const scene = new FakeScene();
		const ov = createOverlay(asScene(scene));
		const panel = scene.add.container();
		const halo = scene.add.image();
		panel.add(halo);
		fake(ov.root).add(panel);
		ov.open(panel as never, () => {});
		let haloTicks = 0;
		// Mô phỏng tween lặp: hẹn chạy sau khi overlay đã đóng.
		scene.tweens.add({ targets: halo, angle: 360, duration: 5000, onComplete: () => haloTicks++ });
		ov.close(panel as never);
		scene.advance(10000);
		expect(haloTicks).toBe(0);
		expect(ov.root.active).toBe(false);
	});
});
