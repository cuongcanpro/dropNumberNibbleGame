import type { PackConfig } from '../../scripts/pack-assets/types.ts';

/**
 * Nibi tốn ~65-100 ms MỖI FILE tải lúc boot: ảnh UI/icon/tile gộp thành atlas (docs/assets.md). Ảnh nguồn
 * ở `art/<nhóm>/` (NGOÀI `res/`), atlas sinh ra nằm cạnh code và được import `?url`.
 *
 * Thêm ảnh: bỏ PNG vào `art/<nhóm>/`, khai nhóm ở đây, chạy `pnpm pack-assets` rồi commit cả atlas
 * (`pnpm check` chạy `pack-assets --check`). Key frame = `prefix` + đường dẫn bỏ `.png`.
 */
const config: PackConfig = {
	groups: [{ out: 'src/game/atlas/ui', sources: [{ dir: 'art/ui', prefix: 'ui/' }] }],
};

export default config;
