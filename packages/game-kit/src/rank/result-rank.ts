import { getGameMode, getGameSlug } from '../tracking/game-context';
import { resolveDevRank } from './dev-rank-override';
import type { RankInput, RankView } from './rank-client';
import { fetchRank } from './rank-client';

/**
 * `score` là con số Server xếp theo metric của game/mode: điểm/level (cao hơn tốt hơn),
 * time = MILLISECOND (THẤP hơn tốt hơn), count = số mục khác nhau. `opts.mode` ghi đè mode của
 * game-context; truyền '' để hỏi không mode (hopogram).
 *
 * Hạng cho popup kết quả — tự điền slug + mode từ game-context, ĐÚNG nguồn mà event dùng
 * (sink-bridge), nên bảng popup hỏi luôn là bảng mà điểm ghi vào. Chưa `markGameOpen` ⇒ null.
 */
export function fetchResultRank(
	score: number,
	opts: Omit<RankInput, 'gameSlug' | 'score'> = {},
): Promise<RankView | null> {
	const dev = resolveDevRank({ ...opts, score });
	if (dev !== undefined) return Promise.resolve(dev);
	const slug = getGameSlug();
	if (!slug) return Promise.resolve(null);
	// `opts.mode` (kể cả '') thắng game-context: bảng theo mode của Server (numpuz classic_3x3...).
	const { mode, ...rest } = opts;
	return fetchRank({
		gameSlug: slug,
		score,
		...rest,
		mode: mode !== undefined ? mode : getGameMode(),
	});
}
