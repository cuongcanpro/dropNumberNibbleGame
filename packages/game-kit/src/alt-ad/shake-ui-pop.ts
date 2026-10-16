// Các tween nhỏ của ShakeUi, tách ra để shake-ui.ts giữ dưới 200 dòng.
import type Phaser from 'phaser';
import { DESIGN_HEIGHT } from '../platform/nibi-host';
import { KEYS } from './assets';

/** Chấm đếm lượt lắc: đổi sang chấm đầy rồi nảy. */
export function popDot(
	scene: Phaser.Scene,
	dot: Phaser.GameObjects.Image | undefined,
	tint: number,
): void {
	if (!dot) return;
	dot.setTexture(KEYS.dotFull).setTint(tint).setScale(1);
	scene.tweens.add({ targets: dot, scale: 1.4, duration: 120, yoyo: true, ease: 'Back.easeOut' });
}

/** Nút Tap hiện dần từ 0.82 lên 1. */
export function popIn(scene: Phaser.Scene, target: Phaser.GameObjects.Container): void {
	target.setVisible(true).setScale(0.82);
	scene.tweens.add({ targets: target, alpha: 1, scale: 1, duration: 240, ease: 'Back.easeOut' });
}

/** Thẻ trượt từ dưới lên giữa màn (0.5s) hoặc ngược xuống (0.3s). */
export function slide(
	scene: Phaser.Scene,
	target: Phaser.GameObjects.Container,
	dir: 'in' | 'out',
	onComplete: () => void,
): void {
	const entering = dir === 'in';
	scene.tweens.add({
		targets: target,
		y: entering ? DESIGN_HEIGHT / 2 : DESIGN_HEIGHT + 300,
		duration: entering ? 500 : 300,
		ease: entering ? 'Back.easeOut' : 'Back.easeIn',
		onComplete,
	});
}
