import { type HapticStep, Sound, Vibration, type VibrationType } from '@repo/game-kit/platform';
import type Phaser from 'phaser';
import { DESIGN_HEIGHT, DESIGN_WIDTH } from '../config/game-config';

/**
 * SFX đi qua `Sound` của game-kit để tôn trọng toggle Sound và quota audio node của Nibi. `Sound` dùng
 * scene đã `attach` lúc `create()`; key chưa nạp thì no-op.
 */
export function playSfx(key: string): void {
	Sound.getInstance().playSfx(key);
}

/** Rung theo thang `VibrationType` của game-kit (tôn trọng toggle Vibration); web không hỗ trợ thì no-op. */
export function vibrate(type: VibrationType): void {
	Vibration.vibrate(type);
}

/** Chuỗi rung nhiều nhịp, mỗi nhịp cách nhau `intervalMs`. */
export function vibratePattern(steps: HapticStep[], intervalMs: number): void {
	Vibration.vibrateWithPattern(steps, intervalMs);
}

/**
 * Nền phủ khung design + phần letterbox dư (camera zoom theo cạnh ngắn, nên phần dư ở hai bên hoặc
 * trên/dưới). Vẽ rộng hơn khung để không hở viền trên mọi tỉ lệ màn.
 */
export function addBackground(scene: Phaser.Scene, color: number): Phaser.GameObjects.Rectangle {
	const margin = 2000;
	return scene.add
		.rectangle(
			DESIGN_WIDTH / 2,
			DESIGN_HEIGHT / 2,
			DESIGN_WIDTH + margin * 2,
			DESIGN_HEIGHT + margin * 2,
			color,
		)
		.setName('background');
}
