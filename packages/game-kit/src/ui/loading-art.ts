import type Phaser from 'phaser';
import logoUrl from '../../assets/loading/nibble-verse-logo.png?url';
import { packedUrl } from '../platform/nibi-host';

/**
 * Logo Nibble Verse (PNG nền trong, đóng gói trong kit) — ảnh duy nhất của màn loading, giống nhau mọi
 * game (Anh chốt 08/10: không tải icon/banner từng game). Nền trong để đặt được lên màu nền Console.
 */
export const LOADING_LOGO_KEY = 'gk-loading-logo';
const LOGO_TIMEOUT_MS = 1500;

let logoImage: HTMLImageElement | null = null;

/**
 * Giải mã logo TRƯỚC khi dựng Phaser.Game (gọi trong `loadGameKitFonts`, mọi main.ts đã chờ hàm này):
 * xếp logo chung lượt tải của Boot thì nó phải chờ giải mã sau hàng chục ảnh game (Nibi giải mã lần lượt)
 * → logo hiện trễ 2–3 giây (Anh báo 09/10). Không bao giờ ném; hết hạn thì Boot tự nạp như cũ.
 */
export function preloadLoadingLogo(timeoutMs = LOGO_TIMEOUT_MS): Promise<void> {
	if (logoImage || typeof Image === 'undefined') return Promise.resolve();
	return new Promise((resolve) => {
		const img = new Image();
		const timer = setTimeout(resolve, timeoutMs);
		const done = (ok: boolean): void => {
			clearTimeout(timer);
			if (ok) logoImage = img;
			resolve();
		};
		// `onload`/`onerror` như loader của Phaser: Image native của Nibi chưa chắc có addEventListener.
		// oxlint-disable-next-line unicorn/prefer-add-event-listener
		img.onload = () => done(true);
		// oxlint-disable-next-line unicorn/prefer-add-event-listener
		img.onerror = () => done(false);
		img.src = packedUrl(logoUrl);
	});
}

/**
 * Logo có sẵn ngay: lấy ảnh đã giải mã từ `preloadLoadingLogo`; chưa có thì xếp vào loader của Boot
 * (game gọi `load.start()` ngay sau). True = texture đã dùng được ở frame đầu.
 */
export function queueDefaultLogo(scene: Phaser.Scene): boolean {
	if (scene.textures.exists(LOADING_LOGO_KEY)) return true;
	if (logoImage?.complete && logoImage.naturalWidth > 0) {
		scene.textures.addImage(LOADING_LOGO_KEY, logoImage);
		return true;
	}
	scene.load.image(LOADING_LOGO_KEY, logoUrl);
	return false;
}
