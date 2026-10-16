import type Phaser from 'phaser';
import type { GameSettingTheme } from './game-setting-theme';

/**
 * Khung panel của theme vào `parent`: bảng nhiều lớp (mỗi lớp nhuộm bằng GPU `setTint`, không xử lý pixel
 * lúc chạy) hoặc một texture của theme tự khai. Có `size` thì kéo giãn kiểu nineslice — mọi lớp cùng khổ
 * nên dùng chung một bộ cạnh cắt.
 */
export function addThemedBoard(
	scene: Phaser.Scene,
	parent: Phaser.GameObjects.Container,
	theme: GameSettingTheme,
	size?: { width: number; height: number; slice: number },
): void {
	const layers = theme.boardLayers ?? [{ texture: theme.background, tint: 0xffffff }];
	for (const { texture, tint } of layers) {
		const board = size
			? scene.add.nineslice(
					0,
					0,
					texture,
					undefined,
					size.width,
					size.height,
					size.slice,
					size.slice,
					size.slice,
					size.slice,
				)
			: scene.add.image(0, 0, texture);
		if (tint !== 0xffffff) board.setTint(tint);
		parent.add(board);
	}
}
