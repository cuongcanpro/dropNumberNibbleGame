import { publicUrl } from '../tracking/public-url';
import { trackingConfig } from '../tracking/track';
import { resolveDevRank } from './dev-rank-override';

/**
 * Đường ĐỌC duy nhất của SDK: hạng của MỘT điểm, cho popup chúc mừng. Port từ Cocos `rank-client.ts`.
 *
 * Nguyên tắc số 1 của SDK: không bao giờ làm phiền gameplay — mọi lỗi trả `null` (chỗ gọi ẩn
 * phần hạng), có timeout nên popup không treo, không gọi khi offline. Đi `/public/*` vì SDK chỉ
 * giữ `X-App-Key`, hạng của một điểm không cần biết ai hỏi.
 */
export interface RankView {
	board: string;
	period: string;
	gameId?: string | number | null;
	gameSlug: string | null;
	metric: string | null;
	score: number;
	rank: number;
	totalPlayers: number;
	/** Số người xếp dưới — câu "bạn đã vượt qua N người". */
	beaten: number;
	/** Số đưa thẳng vào `TOP {n}%`. Ở ĐỈNH bảng dùng `rank`, xem `preferRank`. */
	topPercent: number;
	computedAt: string;
}

export interface RankInput {
	/** slug của game — Console không nhận raw id. */
	gameSlug: string;
	/** Điểm vừa đạt. BẮT BUỘC: event chưa flush lúc popup mở. */
	score: number;
	board?: 'score' | 'carrot';
	period?: 'daily' | 'weekly' | 'alltime';
	/** Hạng tính TRONG mode đang chơi; `fetchResultRank` lấy từ game-context (cùng nguồn với event). */
	mode?: string | undefined;
}

/** Popup không được chờ mạng quá lâu — quá hạn thì ẩn phần hạng, không treo. */
export const RANK_TIMEOUT_MS = 2500;

// Cùng (game, board, kỳ, điểm, mode) chỉ hỏi MỘT lần mỗi phiên.
const cache = new Map<string, RankView>();

export function resetRankCacheForTest(): void {
	cache.clear();
}

export async function fetchRank(input: RankInput): Promise<RankView | null> {
	const dev = resolveDevRank({ ...input });
	if (dev !== undefined) return dev;
	const cfg = trackingConfig();
	if (!cfg) return null; // SDK tắt / chưa init
	if (!Number.isFinite(input.score) || input.score < 0) return null;

	const board = input.board ?? 'score';
	const period = input.period ?? 'alltime';
	const score = Math.trunc(input.score);
	// Mode nằm TRONG khoá cache: hai mode cùng điểm là hai câu hỏi khác nhau.
	const mode = (input.mode ?? '').trim().toLowerCase();
	const key = `${input.gameSlug}|${board}|${period}|${score}|${mode}`;
	const hit = cache.get(key);
	if (hit) return hit;

	// Offline thì đừng thử: popup không nên đợi timeout.
	if (cfg.getNetworkState() === 'offline') return null;

	const url = publicUrl(cfg.endpoint, 'leaderboard/rank');
	if (!url) return null;
	const doFetch = cfg.fetchFn ?? fetch;
	const qs =
		`gameKey=${encodeURIComponent(input.gameSlug)}&score=${score}&board=${board}&period=${period}` +
		(mode ? `&mode=${encodeURIComponent(mode)}` : '');

	let timer: ReturnType<typeof setTimeout> | undefined;
	try {
		// Promise.race thay AbortController: native Hermes có thể thiếu AbortController.
		const req = doFetch(`${url}?${qs}`, { method: 'GET', headers: { 'X-App-Key': cfg.appKey } });
		req.catch(() => undefined); // timeout thắng rồi req mới lỗi thì không thành unhandled rejection
		const timeout = new Promise<null>((resolve) => {
			timer = setTimeout(() => resolve(null), RANK_TIMEOUT_MS);
		});
		const res = await Promise.race([req, timeout]);
		if (!res || !res.ok) return null;
		const body = (await res.json()) as RankView;
		// Thiếu trường là hợp đồng đã đổi — ẩn còn hơn hiện số vô nghĩa.
		if (typeof body?.rank !== 'number' || typeof body?.totalPlayers !== 'number') return null;
		cache.set(key, body);
		return body;
	} catch {
		return null;
	} finally {
		if (timer !== undefined) clearTimeout(timer);
	}
}
