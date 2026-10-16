import type { PackConfig } from '../../scripts/pack-assets/types.ts';

/**
 * Atlas của kit — runtime Nibi trên iOS tốn ~65–100 ms MỖI FILE tải, nên ~37 ảnh lẻ của kit
 * (cộng vào mọi game) gộp còn 2 file. Ảnh nguồn giữ nguyên ở assets/ui + assets/alt-ad (các lớp board, result, dot, tint do `pnpm theme-layers` sinh từ art/theme-src);
 * không import nên `nibi build` không đóng gói chúng.
 * Tách 2 atlas vì alt-ad (cookie, bảng nhiệm vụ lớn) chỉ phục vụ popup lắc, không nên kéo vào atlas UI.
 */
const config: PackConfig = {
	groups: [
		{ out: 'assets/atlas/gk-ui', sources: [{ dir: 'assets/ui', prefix: 'gk-ui/' }] },
		{
			out: 'assets/atlas/gk-alt-ad',
			sources: [
				{
					dir: 'assets/alt-ad',
					prefix: 'gk-alt-ad/',
					// Giữ key cũ của alt-ad/assets.ts (tên file ≠ key).
					rename: { but_x: 'close' },
				},
			],
		},
	],
};

export default config;
