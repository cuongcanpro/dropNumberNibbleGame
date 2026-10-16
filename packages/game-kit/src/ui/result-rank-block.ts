import type Phaser from 'phaser';
import type { RankView } from '../rank/rank-client';
import { applyBeaten, BEATEN_OFFSET_Y, makeBeatenText } from './rank-beaten';
import { rankBlockModel } from './rank-block-model';
import { FONT_BALOO_STACK } from './ui-fonts';
import { uiKey } from './ui-keys';
import { makeText } from './widgets';

/**
 * Khối hạng của result: bảng trophy (đã in sẵn chữ "You're in the") + huy hiệu + "Beat N players".
 * `apply(null)` ẨN cả khối — bảng không có số là câu dang dở. Dùng lại được trong result riêng
 * của game lớn: `new ResultRankBlock(scene)` rồi `container.add(block.root)`.
 *
 * Toạ độ theo Cocos (y-up) đã đổi sang y-down: huy hiệu ở (49, +2) (nhích lên 10px so với Cocos để chừa chỗ cho dòng "Beat" cỡ 22 trong banner).
 */
export class ResultRankBlock {
	readonly root: Phaser.GameObjects.Container;
	private readonly badge: Phaser.GameObjects.Text;
	private readonly beaten: Phaser.GameObjects.Text;

	constructor(scene: Phaser.Scene, x = 14, y = 192) {
		this.root = scene.add.container(x, y);
		const board = scene.add.image(-16, 0, uiKey('result', 'trophy_board'));
		this.badge = makeText(scene, {
			x: 49,
			y: 2,
			text: '',
			size: 38,
			font: FONT_BALOO_STACK,
			color: '#FFFA64',
			outline: { color: 'rgb(77, 77, 77)', px: 3 },
			shadow: { color: 'rgb(110, 110, 110)', offsetX: 2, offsetY: -2 },
		});
		this.beaten = makeBeatenText(scene, FONT_BALOO_STACK);
		this.beaten.setPosition(49, -BEATEN_OFFSET_Y);
		this.root.add([board, this.badge, this.beaten]);
		this.root.setVisible(false);
	}

	apply(view: RankView | null | undefined): void {
		const model = rankBlockModel(view);
		this.root.setVisible(model.visible);
		this.badge.setText(model.badge);
		applyBeaten(this.beaten, view?.beaten ?? 0);
	}
}
