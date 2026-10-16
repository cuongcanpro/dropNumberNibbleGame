import type Phaser from 'phaser';
import { FONT_LILITA_STACK } from './ui-fonts';
import { makeText } from './widgets';

const TIP_MS = 2200;
const TIP_FADE_MS = 200;

/** Tên game cỡ lớn (Lilita), bóng đổ xuống tuỳ chọn. */
export function makeLoadingName(
	scene: Phaser.Scene,
	x: number,
	y: number,
	value: string,
	color: string,
	shadow?: string,
): Phaser.GameObjects.Text {
	return makeText(scene, {
		x,
		y,
		text: value,
		size: 68,
		font: FONT_LILITA_STACK,
		color,
		...(shadow ? { shadow: { color: shadow, offsetX: 0, offsetY: -4 } } : {}),
	});
}

export interface LoadingFoot {
	readonly pct: Phaser.GameObjects.Text;
	readonly tip: Phaser.GameObjects.Text;
}

/** Hai dòng chân màn: phần trăm, mẹo. */
export function makeLoadingFoot(
	scene: Phaser.Scene,
	cx: number,
	ys: { pct: number; tip: number },
	colors: { text: string; sub: string },
	firstTip: string,
): LoadingFoot {
	const pct = makeText(scene, {
		x: cx,
		y: ys.pct,
		text: '0%',
		size: 32,
		font: FONT_LILITA_STACK,
		color: colors.text,
	});
	const tip = makeText(scene, { x: cx, y: ys.tip, text: firstTip, size: 25, color: colors.sub });
	tip.setWordWrapWidth(600, true);
	return { pct, tip };
}

/**
 * Đổi mẹo mỗi 2,2 giây (mờ ra, đổi chữ, hiện lại); `tips()` đọc lại mỗi lượt vì mẹo Console tới muộn. Chuỗi delayedCall tự dừng khi `running()` = false
 * (màn bị huỷ hoặc đang mờ vào game); time/tween của scene cũng bị xoá khi scene shutdown.
 */
export function startTipRotation(
	scene: Phaser.Scene,
	tip: Phaser.GameObjects.Text,
	tips: () => readonly string[],
	running: () => boolean,
): void {
	let index = 0;
	const next = (): void => {
		scene.time.delayedCall(TIP_MS, () => {
			if (!running()) return;
			if (tips().length < 2) return next(); // chờ Console có thể gửi thêm mẹo
			scene.tweens.add({
				targets: tip,
				alpha: 0,
				duration: TIP_FADE_MS,
				onComplete: () => {
					if (!running()) return;
					const list = tips();
					index = (index + 1) % Math.max(1, list.length);
					tip.setText(list[index] ?? '');
					scene.tweens.add({ targets: tip, alpha: 1, duration: TIP_FADE_MS });
					next();
				},
			});
		});
	};
	next();
}
