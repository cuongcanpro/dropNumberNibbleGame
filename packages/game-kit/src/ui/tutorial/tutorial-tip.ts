import type Phaser from 'phaser';
import { PillBanner } from '../pill-banner';
import { playSequence, type SequenceStep } from '../tween-sequence';

const FADE_MS = 200;
const SLIDE_PX = 10;

/**
 * Banner một dòng của tutorial: cùng họ với Toast nhưng dính lại tới `hide()`/`show()` —
 * bước tutorial kết thúc bằng hành động của người chơi, không theo timer. Dựng một lần mỗi scene,
 * caller đặt vị trí qua `root`.
 */
export class TutorialTip {
	readonly root: Phaser.GameObjects.Container;
	private readonly scene: Phaser.Scene;
	private readonly banner: PillBanner;
	private cancel: (() => void) | null = null;

	constructor(scene: Phaser.Scene, name = 'tutorial.tip', options: { font?: string } = {}) {
		this.scene = scene;
		this.banner = new PillBanner(scene, {
			height: 60,
			minWidth: 220,
			maxWidth: 600,
			paddingX: 28,
			fontSize: 26,
			...options,
		});
		this.root = this.banner.root;
		this.root.setName(name);
	}

	getText(): string {
		return this.banner.text;
	}

	show(text: string): void {
		this.enter(text, null);
	}

	/** Hiện rồi tự ẩn sau `holdS` giây (câu khen / thông tin). */
	flash(text: string, holdS: number): void {
		this.enter(text, holdS);
	}

	hide(): void {
		this.cancel?.();
		const { pill, root } = this.banner;
		this.cancel = playSequence(this.scene, [
			{ tween: { targets: pill, alpha: 0, duration: FADE_MS } },
			{ call: () => root.setVisible(false) },
		]);
	}

	private enter(text: string, holdS: number | null): void {
		this.cancel?.();
		const { pill, root } = this.banner;
		this.banner.relayout(text);
		root.setVisible(true);
		pill.setAlpha(0);
		pill.setY(SLIDE_PX);
		const steps: SequenceStep[] = [
			{ tween: { targets: pill, alpha: 1, y: 0, duration: FADE_MS, ease: 'Quad.easeOut' } },
		];
		if (holdS !== null) {
			steps.push(
				{ wait: holdS * 1000 },
				{ tween: { targets: pill, alpha: 0, duration: FADE_MS } },
				{ call: () => root.setVisible(false) },
			);
		}
		this.cancel = playSequence(this.scene, steps);
	}
}
