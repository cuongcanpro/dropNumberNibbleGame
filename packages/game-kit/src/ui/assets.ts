import type Phaser from 'phaser';
import balooUrl from '../../assets/fonts/Baloo-Regular.ttf?url';
import lilitaUrl from '../../assets/fonts/LilitaOne-Regular.ttf?url';
import type { AtlasPreloadScene } from '../platform/atlas-alias';
import { preloadKitAtlas } from '../platform/atlas-alias';
import { loadFont } from '../platform/nibi-host';
import { installDevHooks } from './dev-hooks';
import { preloadLoadingLogo } from './loading-art';
import { GK_UI_ATLAS } from './ui-atlas';
import { FONT_BALOO, FONT_LILITA } from './ui-fonts';

export type UiAssetGroup = 'setting' | 'result' | 'tutorial' | 'hud';

/** Phần của Phaser Scene mà preload dùng — cấu trúc để test bằng fake. */
export type UiPreloadScene = AtlasPreloadScene;

/**
 * Gọi trong `preload()` của scene. Xếp hàng ĐÚNG 1 file (atlas `gk-ui`, ~37 ảnh lẻ trước đây) rồi mọi key
 * `gk-ui/<nhóm>/<tên>` dùng được như texture riêng. Atlas chứa đủ 4 nhóm nên `groups` không còn đổi số file:
 * giữ tham số để game cũ không phải sửa, và vì 1 file luôn rẻ hơn 2 file trên Nibi iOS (~80 ms/file).
 */
export function preloadGameKitUi(
	scene: UiPreloadScene | Phaser.Scene,
	_groups: readonly UiAssetGroup[] = ['setting', 'result', 'tutorial'],
): void {
	installDevHooks(); // bản dev: gắn `gkDev` để QA đặt hạng/kit-config giả trước khi mở popup
	preloadKitAtlas(scene, GK_UI_ATLAS);
}

/** Nạp 2 font dùng chung TRƯỚC khi tạo Phaser.Game. Không ném; trả cho mỗi font đã nạp được chưa. */
export async function loadGameKitFonts(): Promise<{ lilita: boolean; baloo: boolean }> {
	// Logo màn loading giải mã cùng lúc với font: Boot dựng màn loading là đã có logo ngay frame đầu.
	const [lilita, baloo] = await Promise.all([
		loadFont(FONT_LILITA, lilitaUrl),
		loadFont(FONT_BALOO, balooUrl),
		preloadLoadingLogo(),
	]);
	return { lilita, baloo };
}
