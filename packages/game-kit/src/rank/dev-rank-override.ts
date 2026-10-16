import type { RankInput, RankView } from './rank-client';

/**
 * Hạng GIẢ cho QA / agent xem UI hạng khi offline (thay các cheat đã xoá ở haredoku/bunnypack).
 * Chỉ có hiệu lực ở bản dev (`import.meta.env.DEV`) hoặc khi bật cờ `globalThis.GK_DEV = true`;
 * bản phát hành bỏ qua hoàn toàn nên không thể bịa hạng với người chơi thật.
 *
 * - đối tượng: ghi đè một phần `RankView` (thiếu trường lấy giá trị mặc định theo điểm);
 * - `null`: ép "không có hạng" (UI ẩn khối);
 * - hàm: tính theo input;
 * - `undefined`: gỡ override, quay lại gọi mạng thật.
 */
export type DevRankOverride =
	| Partial<RankView>
	| null
	| ((input: Pick<RankInput, 'score' | 'board' | 'period'>) => RankView | null);

type DevInput = Pick<RankInput, 'score' | 'board' | 'period'> & { gameSlug?: string | null };

let override: DevRankOverride | undefined;

export function devHooksEnabled(): boolean {
	return import.meta.env?.DEV === true || (globalThis as { GK_DEV?: unknown }).GK_DEV === true;
}

/** Trả `false` (và không làm gì) khi bản build không cho dev hook. */
export function setDevRankOverride(next: DevRankOverride | undefined): boolean {
	if (!devHooksEnabled()) return false;
	override = next;
	return true;
}

/** `undefined` = không override (đi mạng); `null` = ép không có hạng. */
export function resolveDevRank(input: DevInput): RankView | null | undefined {
	if (override === undefined || !devHooksEnabled()) return undefined;
	if (override === null) return null;
	const base = {
		board: input.board ?? 'score',
		period: input.period ?? 'alltime',
	};
	if (typeof override === 'function') return override({ score: input.score, ...base });
	const totalPlayers = override.totalPlayers ?? 1000;
	const rank = override.rank ?? Math.max(1, Math.round(totalPlayers * 0.12));
	return {
		...base,
		gameSlug: input.gameSlug ?? 'dev',
		metric: null,
		score: input.score,
		rank,
		totalPlayers,
		beaten: override.beaten ?? Math.max(0, totalPlayers - rank),
		topPercent: override.topPercent ?? Math.max(1, Math.ceil((rank / totalPlayers) * 100)),
		computedAt: new Date(0).toISOString(),
		...override,
	};
}
