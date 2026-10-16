import { computeViewZoom, setViewZoom, UserData } from '@repo/game-kit/platform';
import { initGameShell } from '@repo/game-kit/shell';
import { loadGameKitFonts } from '@repo/game-kit/ui';
import { primaryCanvas } from 'nibi';
import { Game, Scale, WEBGL } from 'phaser';
import pkg from '../package.json';
import { GAME_MODE, GAME_SLUG } from './game/config/game-config';
import { BootScene } from './game/scenes/boot-scene';
import { GameScene } from './game/scenes/game-scene';

/**
 * Thứ tự boot cố định (docs/game-kit.md "What the template already wires"): font -> UserData ->
 * initGameShell -> Phaser.Game. Host sở hữu `#screen` (`primaryCanvas`) ở kích thước backing store cố định; Phaser vẽ
 * thẳng vào đó, khung design được camera zoom cho vừa (scene gọi `applyHostCamera`).
 */
void loadGameKitFonts().then(() => {
	// Áp toggle Sound/Vibration đã lưu trước khi có tiếng/rung đầu tiên (UserData tự áp lúc dựng singleton).
	UserData.getInstance();
	const { width, height } = primaryCanvas;
	// Đặt zoom sớm để chữ dựng trước camera (Boot) đã render đúng độ phân giải.
	setViewZoom(computeViewZoom(width, height));
	// Slug = khoá game trên Console (bảng xếp hạng, metrics); `game_open` phát ở đây, scene chỉ đổi mode.
	initGameShell({ appVersion: pkg.version, gameSlug: GAME_SLUG, mode: GAME_MODE });
	// Trả về Game để giữ tham chiếu (và tránh `new` chỉ để lấy side effect).
	return new Game({
		type: WEBGL,
		canvas: primaryCanvas,
		backgroundColor: '#1b2433',
		scale: {
			mode: Scale.NONE,
			autoCenter: Scale.NO_CENTER,
			width,
			height,
		},
		input: { activePointers: 2, touch: true },
		// Mask cần `render: { stencil: true }` (docs/nibi-runtime.md "Rendering and performance").
		scene: [BootScene, GameScene],
	});
});
