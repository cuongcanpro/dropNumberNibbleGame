import type { RankView } from '../rank/rank-client';
import { beatenLabel, rankBadge } from '../rank/rank-helpers';
import { deviceLang } from './kit-config-client';

export interface RankBlockModel {
	/** false ⇒ ẩn cả khối (offline / chưa có hạng): KHÔNG vẽ số bịa. */
	visible: boolean;
	/** `#hạng` hoặc `TOP x%` (luật ở `preferRank`). */
	badge: string;
	/** "Beat N players"; rỗng khi 0 người. */
	beaten: string;
}

export function rankBlockModel(view: RankView | null | undefined): RankBlockModel {
	if (!view) return { visible: false, badge: '', beaten: '' };
	return { visible: true, badge: rankBadge(view), beaten: beatenLabel(view.beaten, deviceLang()) };
}
