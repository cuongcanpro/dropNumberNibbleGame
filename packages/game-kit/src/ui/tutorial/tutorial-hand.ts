import type Phaser from 'phaser';
import { playSequence, type SequenceStep } from '../tween-sequence';
import { uiKey } from '../ui-keys';

const DRAG_MOVE_MS = 1000;
const DRAG_HOLD_MS = 300;
const DRAG_FADE_MS = 200;
const TAP_PRESS_MS = 120;
const TAP_PAUSE_MS = 500;

export interface Point {
	x: number;
	y: number;
}

/**
 * Bàn tay chỉ dẫn lần chơi đầu (vòng lặp tap / drag). Caller sở hữu hệ toạ độ: truyền điểm theo
 * không gian của parent (Phaser y-down, khác Cocos y-up). Mỗi vòng là một sequence riêng nên
 * `stopLoop()` không động tới tween của object khác.
 */
export class TutorialHand {
	readonly image: Phaser.GameObjects.Image;
	private readonly scene: Phaser.Scene;
	private cancel: (() => void) | null = null;

	constructor(scene: Phaser.Scene, name = 'tutorial.hand') {
		this.scene = scene;
		this.image = scene.add.image(0, 0, uiKey('tutorial', 'icon_hand_tutorial'));
		// Cocos anchor (0.2, 0.8) y-up = 20% từ trái, 20% từ ĐỈNH → origin (0.2, 0.2) y-down: đầu ngón là điểm chạm.
		this.image.setOrigin(0.2, 0.2);
		this.image.setName(name);
		this.image.setVisible(false);
	}

	loopDrag(from: Point, to: Point): void {
		this.loopPath([from, to]);
	}

	/** Kéo qua nhiều chặng; tổng thời gian giữ `DRAG_MOVE_MS` dù bao nhiêu chặng. */
	loopPath(points: readonly Point[]): void {
		const start = points[0];
		if (!this.image.active || !start || points.length < 2) return;
		this.stopLoop();
		this.image.setVisible(true);
		const legMs = DRAG_MOVE_MS / (points.length - 1);
		const steps: SequenceStep[] = [
			{ call: () => this.image.setPosition(start.x, start.y).setAlpha(1) },
			...points.slice(1).map(
				(p): SequenceStep => ({
					tween: { targets: this.image, x: p.x, y: p.y, duration: legMs, ease: 'Quad.easeInOut' },
				}),
			),
			{ wait: DRAG_HOLD_MS },
			{ tween: { targets: this.image, alpha: 0, duration: DRAG_FADE_MS } },
		];
		this.loop(steps);
	}

	loopTap(at: Point): void {
		if (!this.image.active) return;
		this.stopLoop();
		this.image.setVisible(true);
		this.image.setPosition(at.x, at.y).setAlpha(1);
		this.loop([
			{ tween: { targets: this.image, scale: 0.85, duration: TAP_PRESS_MS } },
			{ tween: { targets: this.image, scale: 1, duration: TAP_PRESS_MS } },
			{ wait: TAP_PAUSE_MS },
		]);
	}

	stopLoop(): void {
		this.cancel?.();
		this.cancel = null;
		// Scene teardown có thể huỷ image trước khi tutorial abort ⇒ đừng đụng object đã chết.
		if (!this.image.active) return;
		this.image.setScale(1);
		this.image.setVisible(false);
	}

	private loop(steps: readonly SequenceStep[]): void {
		const run = (): void => {
			this.cancel = playSequence(this.scene, steps, run);
		};
		run();
	}
}
