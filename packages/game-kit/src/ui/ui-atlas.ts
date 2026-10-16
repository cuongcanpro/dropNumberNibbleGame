import uiData from '../../assets/atlas/gk-ui.json';
import uiUrl from '../../assets/atlas/gk-ui.png?url';
import type { KitAtlas } from '../platform/atlas-alias';

/**
 * Atlas UI của kit (setting/result/tutorial/hud — `pnpm pack-assets game-kit`, CI chạy `--check`).
 * Bảng frame import vào code (không ship .json riêng) ⇒ đúng 1 file tải. Để RIÊNG ở `ui/`, không chung
 * file với atlas alt-ad: import chung thì game chỉ dùng UI cũng bị đóng gói kèm atlas lắc 1,2 MB.
 */
export const GK_UI_ATLAS: KitAtlas = {
	key: 'gk-atlas/ui',
	url: uiUrl,
	frames: uiData.frames,
};
