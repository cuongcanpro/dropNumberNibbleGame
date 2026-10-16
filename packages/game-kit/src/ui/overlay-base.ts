import type Phaser from 'phaser';
import { BackKeyManager } from '../platform/back-key-manager';
import { designView } from '../platform/nibi-host';
import { killTweensDeep } from './destroy-deep';

export const OVERLAY_DEPTH = 99999;
export const FOG_ALPHA = 150 / 255;
const OPEN_MS = 250;
const CLOSE_MS = 150;

export interface Overlay {
	root: Phaser.GameObjects.Container;
	view: { x: number; y: number; width: number; height: number };
	/** Tâm vùng nhìn thấy (toạ độ world) — nơi đặt panel. */
	center: { x: number; y: number };
	/** Push back handler + animate vào. `onBack` trả true (nuốt) ⇒ lớp trên cùng đóng trước. */
	open(panel: Phaser.GameObjects.Container, onBack: () => void, targetScale?: number): void;
	/** Gỡ back handler + animate ra + huỷ toàn bộ; `done` chạy sau cùng. Gọi nhiều lần chỉ có hiệu lực lần đầu. */
	close(panel: Phaser.GameObjects.Container, done?: () => void, targetScale?: number): void;
	isClosing(): boolean;
	/** Huỷ NGAY (không animate, không `done`): gỡ back handler, dừng tween, destroy cây overlay. An toàn gọi lặp. */
	destroy(): void;
}

/**
 * Nền chung của mọi overlay/dialog: dim phủ cả vùng nhìn thấy của camera scene (designView(scene)), chặn input xuyên lớp
 * (fog interactive là object trên cùng nên `topOnly` không cho game phía dưới nhận tap),
 * depth cao, tự đăng ký BackKeyManager và dọn khi scene SHUTDOWN (listener cũng được gỡ).
 */
export function createOverlay(scene: Phaser.Scene, fogAlpha = FOG_ALPHA): Overlay {
	const view = designView(scene);
	const center = { x: view.x + view.width / 2, y: view.y + view.height / 2 };
	const root = scene.add.container(0, 0);
	root.setDepth(OVERLAY_DEPTH);
	const fog = scene.add.rectangle(center.x, center.y, view.width, view.height, 0x000000, fogAlpha);
	fog.setAlpha(0);
	fog.setInteractive();
	root.add(fog);

	let backHandler: (() => boolean) | null = null;
	let closing = false;

	const dispose = () => {
		if (backHandler) BackKeyManager.getInstance().remove(backHandler);
		backHandler = null;
		scene.events.off('shutdown', dispose);
		// Cả cây overlay: popup kết quả có tween lặp vô hạn (vầng sáng) không tự dừng khi destroy.
		killTweensDeep(scene, root);
		if (root.active) root.destroy();
	};
	scene.events.once('shutdown', dispose);

	return {
		root,
		view,
		center,
		open(panel, onBack, targetScale = 1) {
			backHandler = () => {
				onBack();
				return true;
			};
			BackKeyManager.getInstance().push(backHandler, root);
			panel.setScale(targetScale * 0.8);
			panel.setAlpha(0);
			scene.tweens.add({ targets: fog, alpha: 1, duration: OPEN_MS });
			scene.tweens.add({
				targets: panel,
				scale: targetScale,
				alpha: 1,
				duration: OPEN_MS,
				ease: 'Back.easeOut',
			});
		},
		close(panel, done, targetScale = 1) {
			if (closing) return;
			closing = true;
			if (backHandler) BackKeyManager.getInstance().remove(backHandler);
			backHandler = null;
			scene.tweens.add({ targets: fog, alpha: 0, duration: CLOSE_MS });
			scene.tweens.add({
				targets: panel,
				scale: targetScale * 0.8,
				alpha: 0,
				duration: CLOSE_MS,
				ease: 'Quad.easeIn',
				onComplete: () => {
					dispose();
					done?.();
				},
			});
		},
		isClosing: () => closing,
		destroy: dispose,
	};
}
