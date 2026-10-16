import { safeShiftDown } from '@repo/game-kit/platform';
import {
	HUD_BUTTON_MARGIN as HUD_MARGIN,
	HUD_BUTTON_SIZE as HUD_SIZE,
	kitHud,
	makeButton,
	uiKey,
} from '@repo/game-kit/ui';
import type Phaser from 'phaser';
import { DESIGN_WIDTH } from '../config/game-config';

export interface HudHandlers {
	readonly onHome: () => void;
	readonly onSettings: () => void;
}

/**
 * Hai nút HUD của game-kit (`gk-ui/hud/*`, cần `preloadGameKitUi(scene, [..., 'hud'])` ở Boot):
 * Home góc trên trái, Settings góc trên phải, theo khung design 720×1280. Native Play vẽ tràn viền:
 * nếu hàng nút lấn vào tai thỏ thì `safeShiftDown` đẩy xuống VỪA ĐỦ (kẹp, không cộng — màn dài có
 * khung nằm giữa thì đã né sẵn, dịch 0). Insets = 0 trên web và `nibi sim`.
 */
export function addHudButtons(scene: Phaser.Scene, handlers: HudHandlers): void {
	const y = HUD_MARGIN + HUD_SIZE / 2 + safeShiftDown(scene, HUD_MARGIN);
	// Console quyết nút HUD nào hiện (`kitHud`): game tự đặt nút nên tự áp.
	const kit = kitHud();
	const place = (file: 'btnHome' | 'btnSetting', x: number, onClick: () => void): void => {
		const texture = uiKey('hud', file);
		const source = scene.textures.get(texture).getSourceImage();
		const button = makeButton(scene, {
			x,
			y,
			texture,
			scale: HUD_SIZE / Math.max(source.width, source.height),
			onClick,
		});
		button.root.setVisible(file === 'btnHome' ? kit.home : kit.setting);
	};
	place('btnHome', HUD_MARGIN + HUD_SIZE / 2, handlers.onHome);
	place('btnSetting', DESIGN_WIDTH - HUD_MARGIN - HUD_SIZE / 2, handlers.onSettings);
}
