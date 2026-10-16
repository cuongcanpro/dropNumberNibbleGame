import altAdData from '../../assets/atlas/gk-alt-ad.json';
import altAdUrl from '../../assets/atlas/gk-alt-ad.png?url';
import type { KitAtlas } from '../platform/atlas-alias';

/** Atlas popup lắc (alt-ad) — chỉ game import `@repo/game-kit/alt-ad` mới đóng gói file này. */
export const GK_ALT_AD_ATLAS: KitAtlas = {
	key: 'gk-atlas/alt-ad',
	url: altAdUrl,
	frames: altAdData.frames,
};
