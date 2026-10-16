import type Phaser from 'phaser';
import type { ResultContent } from './game-result-popup-content';
import type { ResultExtensions } from './result-extensions';
import type { UiButton } from './widgets';

/** Nút result: 222x81, nghỉ ở scale 1.06 (như Cocos). */
export const BTN = { width: 222, height: 81, scale: 1.06 };

type Target = Phaser.GameObjects.Container | Phaser.GameObjects.Image | Phaser.GameObjects.Text;

/** Phần tử xuất hiện lần lượt (title → hero → info → custom → rank → nút). `pop` = phần của kit (scale + alpha), `fade` = phần game dựng (chỉ alpha: gốc toạ độ của chúng không biết trước). */
export interface EntrancePlan {
	pop: { target: Target; delay: number; from: number }[];
	fade: { target: Target; delay: number }[];
	buttons: readonly UiButton[];
	/** Halo xoay (khối mừng của kit) hoặc null khi game thay khối thông tin. */
	halo: ResultContent['halo'] | null;
}

export function playResultEntrance(scene: Phaser.Scene, plan: EntrancePlan): void {
	const run = (target: Target, delay: number, scale: number) =>
		scene.tweens.add({
			targets: target,
			delay,
			scale,
			alpha: 1,
			duration: 250,
			ease: 'Back.easeOut',
		});
	for (const { target, delay, from } of plan.pop) {
		target.setScale(from).setAlpha(0);
		run(target, delay, 1);
	}
	for (const { target, delay } of plan.fade) {
		target.setAlpha(0);
		scene.tweens.add({ targets: target, delay, alpha: 1, duration: 250 });
	}
	plan.buttons.forEach((b, i) => {
		b.root.setScale(0).setAlpha(0);
		run(b.root, 700 + i * 80, BTN.scale);
	});
	const halo = plan.halo;
	if (halo) {
		halo.setAlpha(0);
		scene.tweens.add({ targets: halo, alpha: 1, duration: 300 });
		scene.tweens.add({
			targets: halo,
			scale: 1.03,
			yoyo: true,
			repeat: -1,
			duration: 750,
			ease: 'Sine.easeInOut',
		});
		scene.tweens.add({ targets: halo, angle: 360, repeat: -1, duration: 20000 });
	}
}

/** Dựng lịch xuất hiện: phần kit pop, phần game dựng fade. `rankRoot` null = không có khối hạng. */
export function buildEntrancePlan(
	c: ResultContent,
	ext: ResultExtensions,
	rankRoot: Target | null,
	buttons: readonly UiButton[],
	celebrate: boolean,
): EntrancePlan {
	const pop: EntrancePlan['pop'] = [];
	const fade: EntrancePlan['fade'] = [];
	if (ext.title) fade.push({ target: ext.title, delay: 100 });
	else pop.push({ target: c.titleWin.visible ? c.titleWin : c.titleGameOver, delay: 100, from: 0 });
	if (ext.hero) fade.push({ target: ext.hero, delay: 200 });
	if (ext.info === 'none') {
		/* không có khối số */
	} else if (ext.info) fade.push({ target: ext.info, delay: 300 });
	else pop.push({ target: c.infoBig.visible ? c.infoBig : c.infoChip, delay: 300, from: 0.7 });
	if (ext.custom) fade.push({ target: ext.custom, delay: 400 });
	if (rankRoot) pop.push({ target: rankRoot, delay: 500, from: 0 });
	return { pop, fade, buttons, halo: celebrate ? c.halo : null };
}
