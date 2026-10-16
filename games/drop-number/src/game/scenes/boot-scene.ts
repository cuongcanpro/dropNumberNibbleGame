import { applyHostCamera } from '@repo/game-kit/platform';
import { attachLoadingScreen, preloadGameKitUi } from '@repo/game-kit/ui';
import { Scene } from 'phaser';
import { preloadGameArt } from './preload-art';
import { SCENE_BOOT, SCENE_GAME } from './scene-keys';

/**
 * Tải hai bước để không có màn trống: `create` dựng màn loading dùng chung của kit rồi mới xếp hàng
 * phần nặng và `load.start()`. Tải hết trong `preload` thì người chơi nhìn một mảng màu vài giây, tưởng
 * game treo. Màn loading do game-kit lo hết (tên, mô tả, mẹo, màu nền lấy từ Console theo slug của
 * `initGameShell`); Boot không được truyền giá trị cứng nào cho màn loading.
 */
export class BootScene extends Scene {
	constructor() {
		super(SCENE_BOOT);
	}

	preload(): void {
		applyHostCamera(this);
	}

	create(): void {
		const loading = attachLoadingScreen(this);
		this.load.once('complete', () => loading.finish(() => this.scene.start(SCENE_GAME)));
		// setting/result/tutorial + hud (Home/Settings) của game-kit. Game không có thưởng nên không tải popup lắc (alt-ad).
		preloadGameKitUi(this, ['setting', 'result', 'tutorial', 'hud']);
		// Ảnh riêng của game = atlas (art/ -> pnpm pack-assets), không phải N lần `load.image` (~80 ms/file trên máy thật).
		// Ảnh full-màn hình / font còn lẻ: `this.load.image('key', 'res/...')`. Âm thanh: `queueGameAudio` ở scene chơi.
		preloadGameArt(this);
		this.load.start();
	}
}
