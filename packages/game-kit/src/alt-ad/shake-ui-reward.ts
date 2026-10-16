// Thẻ kết quả của ShakeUi (Cocos `showReward`). View Phaser; toạ độ tương đối tâm thẻ, y xuống.
import type Phaser from 'phaser';
import { RESULT_BG } from '../ui/theme-layer-spec';
import { KEYS } from './assets';
import type { ShakeTheme } from './shake-theme';
import { fitFontSize } from './shake-ui-fit';
import { stackReward } from './shake-ui-reward-layout';

export interface RewardCardOptions {
	message: string;
	/** Có icon reward hay không (texture `KEYS.reward` đã nạp). */
	hasReward: boolean;
	/** Key texture của icon reward. */
	rewardKey: string;
	rewardAmount: number;
	fontFamily: string;
	theme: ShakeTheme;
	onContinue: () => void;
}

const ICON_SCALE = 0.8;
/** Icon từ game có kích thước lộn xộn; không kẹp thì icon cao đẩy nhãn "xN" ra ngoài thẻ. */
const ICON_MAX_HEIGHT = 120;
/** Câu chúc: cỡ mong muốn, sàn khi câu dài (≤ 140 ký tự), bề rộng wrap trong giấy 873. */
const MESSAGE_SIZE = 40;
const MESSAGE_FLOOR = 24;
const MESSAGE_WRAP = 640;
/** Vùng chữ trong giấy (y tương đối tâm): có icon thì dừng trên icon (đỉnh icon y=80), không thì cả tờ. */
const MESSAGE_AREA = {
	withReward: { top: -240, bottom: 50 },
	alone: { top: -240, bottom: 240 },
} as const;

export function showRewardCard(
	scene: Phaser.Scene,
	parent: Phaser.GameObjects.Container,
	o: RewardCardOptions,
): Phaser.GameObjects.Container {
	const card = scene.add.container(0, 0);
	parent.add(card);
	// Quầng hồng là ảnh alpha 1/4 kích thước nhuộm theo màu game, phóng lên đúng khổ giấy.
	card.add([
		scene.add.image(0, 0, KEYS.resultPaper),
		scene.add.image(0, 0, KEYS.resultGlow).setScale(RESULT_BG.glowScale).setTint(o.theme.glow),
	]);

	// Vùng co chữ: có icon thì chừa chỗ icon + nhãn bên dưới; vị trí thật do stackReward() quyết (căn giữa cả cụm).
	const area = o.hasReward ? MESSAGE_AREA.withReward : MESSAGE_AREA.alone;
	const text = scene.add
		.text(0, 0, `"${o.message}"`, {
			fontFamily: o.fontFamily,
			fontSize: `${MESSAGE_SIZE}px`,
			color: o.theme.message,
			align: 'center',
			wordWrap: { width: MESSAGE_WRAP },
		})
		.setOrigin(0.5)
		.setAlpha(0);
	// Câu dài co chữ cho vừa vùng giấy; câu ngắn giữ 40.
	const fitted = fitFontSize(
		(size) => text.setFontSize(size).height,
		area.bottom - area.top,
		MESSAGE_SIZE,
		MESSAGE_FLOOR,
	);
	text.setFontSize(fitted);
	card.add(text);

	if (!o.hasReward) {
		const { textY } = stackReward({ textHeight: text.height });
		text.setY(textY - 40);
		scene.tweens.add({ targets: text, y: textY, alpha: 1, duration: 350, delay: 250 });
	} else {
		const icon = scene.add.image(0, 0, o.rewardKey);
		const h = icon.height || 1;
		const scale = Math.min(ICON_SCALE, ICON_MAX_HEIGHT / h);
		const label = scene.add
			.text(0, 0, `x ${o.rewardAmount}`, {
				fontFamily: o.fontFamily,
				fontSize: '40px',
				color: '#17884a',
			})
			.setOrigin(0.5, 0)
			.setAlpha(0);
		const pos = stackReward({
			textHeight: text.height,
			iconHeight: h * scale,
			labelHeight: label.height,
		});
		text.setY(pos.textY - 40);
		scene.tweens.add({ targets: text, y: pos.textY, alpha: 1, duration: 350, delay: 250 });
		icon
			.setPosition(0, pos.iconY ?? 0)
			.setScale(scale * 0.375)
			.setAlpha(0);
		label.setY(pos.labelY ?? 0);
		card.add([icon, label]);
		scene.tweens.add({
			targets: icon,
			scale,
			alpha: 1,
			duration: 400,
			delay: 400,
			ease: 'Back.easeOut',
		});
		scene.tweens.add({ targets: label, alpha: 1, duration: 300, delay: 800 });
	}

	const btn = scene.add.container(0, 480 + 70);
	const btnBg = scene.add.image(0, 0, KEYS.button);
	const btnText = scene.add
		.text(0, 0, 'Continue', { fontFamily: o.fontFamily, fontSize: '40px', color: '#17884a' })
		.setOrigin(0.5);
	btn.add([btnBg, btnText]).setAlpha(0).setScale(0.85);
	card.add(btn);
	// Cocos: nút trồi lên 70px khi hiện (+0.6s) → xuất phát thấp hơn đích.
	scene.tweens.add({ targets: btn, y: 480, alpha: 1, scale: 1, duration: 250, delay: 600 });
	let clicked = false;
	btnBg.setInteractive({ useHandCursor: true }).on('pointerup', () => {
		if (clicked) return;
		clicked = true;
		o.onContinue();
	});

	// Pop-in cả thẻ.
	card.setScale(0).setAlpha(0);
	scene.tweens.add({ targets: card, scale: 1, alpha: 1, duration: 300, ease: 'Back.easeOut' });
	return card;
}
