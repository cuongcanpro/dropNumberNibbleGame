import type Phaser from 'phaser';
import { designView } from '../../platform/nibi-host';

/**
 * Dim toàn màn chặn input thật (fog của popup cố ý không chặn; bước tutorial dạng card/spotlight
 * cần cổng cứng). Là object interactive trên cùng nên game phía dưới không nhận tap.
 * `onTap` (tuỳ chọn) chạy khi nhả tay — cho card "chạm để tiếp tục". Listener sống cùng object
 * nên tự mất khi scene SHUTDOWN huỷ nó.
 */
export function createTutorialDim(
	scene: Phaser.Scene,
	name: string,
	opacity = 180,
	onTap?: () => void,
): Phaser.GameObjects.Rectangle {
	const view = designView(scene);
	const dim = scene.add.rectangle(
		view.x + view.width / 2,
		view.y + view.height / 2,
		view.width,
		view.height,
		0x000000,
		opacity / 255,
	);
	dim.setName(name);
	dim.setInteractive();
	if (onTap) dim.on('pointerup', onTap);
	return dim;
}
