// Asset popup: 1 atlas (`assets/atlas/gk-alt-ad.*`, xem pack.config.ts) thay cho 10 ảnh lẻ.
import type Phaser from 'phaser';
import { preloadKitAtlas } from '../platform/atlas-alias';
import { packedUrl } from '../platform/nibi-host';
import { GK_ALT_AD_ATLAS } from './alt-ad-atlas';

const P = 'gk-alt-ad/';
export const KEYS = {
	// Bảng 3 lớp (nhuộm theo màu game): accent nguyên khổ, base + thỏ cắt gọn (toạ độ ở theme-layer-spec).
	boardAccent: `${P}board_accent`,
	boardBase: `${P}board_base`,
	boardRabbit: `${P}board_rabbit`,
	// cookie_1 = ban đầu; mỗi lần lắc sang cái kế tiếp.
	cookies: [`${P}cookie_1`, `${P}cookie_2`, `${P}cookie_3`, `${P}cookie_4`],
	dotEmpty: `${P}dot_empty`,
	dotFull: `${P}dot_full`,
	button: `${P}button`,
	close: `${P}close`,
	// Thẻ kết quả: giấy + bánh giữ màu, quầng hồng là lớp alpha 1/4 kích thước nhuộm theo màu game.
	resultPaper: `${P}bg_paper`,
	resultGlow: `${P}bg_glow`,
	reward: `${P}reward`,
} as const;

/** Gọi trong `preload()` của scene để popup mở tức thì (giữ được user gesture cho iOS). 1 file, key cũ vẫn dùng được. */
export function preloadShakeAssets(scene: Phaser.Scene): void {
	preloadKitAtlas(scene, GK_ALT_AD_ATLAS);
}

/** Key texture của icon reward: `rewardKey` nếu game đã có sẵn texture đó, không thì ảnh nạp từ `rewardUrl`. */
export function rewardTextureKey(scene: Phaser.Scene, rewardKey?: string): string {
	return rewardKey && scene.textures.exists(rewardKey) ? rewardKey : KEYS.reward;
}

/** Nạp bù lúc mở nếu chưa preload, kèm icon reward. Không bao giờ reject: thiếu ảnh thì popup vẫn chạy. */
export function ensureShakeAssets(
	scene: Phaser.Scene,
	rewardUrl?: string,
	rewardKey?: string,
): Promise<boolean> {
	preloadShakeAssets(scene);
	// Texture có sẵn (frame atlas của game): khỏi nạp file lẻ.
	const ownKey = rewardKey !== undefined && rewardTextureKey(scene, rewardKey) === rewardKey;
	let hasReward = ownKey;
	if (rewardUrl && !ownKey) {
		// Reward khác nhau mỗi lần mở → bỏ texture cũ.
		if (scene.textures.exists(KEYS.reward)) scene.textures.remove(KEYS.reward);
		scene.load.image(KEYS.reward, packedUrl(rewardUrl));
		hasReward = true;
	}
	if (scene.load.list.size === 0 && !scene.load.isLoading()) return Promise.resolve(hasReward);
	return new Promise((resolve) => {
		scene.load.once('complete', () =>
			resolve(hasReward && (ownKey || scene.textures.exists(KEYS.reward))),
		);
		if (!scene.load.isLoading()) scene.load.start();
	});
}
