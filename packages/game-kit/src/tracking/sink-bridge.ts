import type { MetricSink } from '../metrics/metric-sink';
import type { EmitCtx } from './types';

/**
 * Cầu MetricSink → tracking SDK (dual-write, duyệt 26/08): mọi game dùng
 * MetricSink tự động đổ về Console song song đường zal cũ. Mapping action
 * khớp event catalog: `<logGroup>_<action>`; gameCustomEvent giữ nguyên tên.
 * Factory THUẦN — emit/getGameSlug inject để test bằng jest; wiring thật ở
 * MetricSinkAdapter. emit nổ không được giết sink gốc (try/catch từng call).
 */
export type BridgeEmit = (action: string, ctx?: EmitCtx) => void;

const lvl = (levelId: number | string | undefined): number | undefined => {
	const n = typeof levelId === 'string' ? Number(levelId) : levelId;
	return typeof n === 'number' && Number.isFinite(n) && n >= 0 ? n : undefined; // NO_LEVEL -1 → undefined
};
const ms = (durationSec: number | undefined): number | undefined =>
	typeof durationSec === 'number' ? Math.round(durationSec * 1000) : undefined;

export function wrapSinkWithTracking(
	sink: MetricSink,
	emit: BridgeEmit,
	getGameSlug: () => string | undefined,
	getGameMode?: () => string | undefined,
): MetricSink {
	const track = (action: string, ctx: EmitCtx): void => {
		try {
			// `mode` đặt SAU `...ctx`: data của game không được đè mode. Mode do MỘT nguồn
			// quyết định (ShareStorage) — để game tự khai trong payload thì hai game khai
			// hai kiểu và bảng bị tách theo tên viết sai.
			// Rỗng ⇒ undefined: "chưa khai" và "mode tên rỗng" là một chuyện.
			emit(action, { gameSlug: getGameSlug(), ...ctx, mode: getGameMode?.() || undefined });
		} catch {
			// tracking không bao giờ được làm hỏng đường metrics cũ
		}
	};
	return {
		gameLevelStart(levelId, data) {
			sink.gameLevelStart(levelId, data);
			track('game_level_start', { levelId: lvl(levelId), payload: data });
		},
		gameLevelComplete(levelId, data) {
			sink.gameLevelComplete(levelId, data);
			track('game_level_complete', {
				levelId: lvl(levelId),
				durationMs: ms(data.durationSec),
				payload: data,
			});
		},
		gameLevelFail(levelId, data) {
			sink.gameLevelFail(levelId, data);
			const progress = (data.gameData as { progressPercent?: number } | undefined)?.progressPercent;
			track('game_level_fail', {
				levelId: lvl(levelId),
				durationMs: ms(data.durationSec),
				value: typeof progress === 'number' ? progress : undefined,
				payload: data,
			});
		},
		gameScoreStart(data) {
			sink.gameScoreStart(data);
			track('game_score_start', { levelId: lvl(data.levelId), payload: data });
		},
		gameScoreEnd(data) {
			sink.gameScoreEnd(data);
			track('game_score_end', {
				levelId: lvl(data.levelId),
				durationMs: ms(data.durationSec),
				value: data.score,
				payload: data,
			});
		},
		tutorial(action, data) {
			sink.tutorial(action, data);
			track(`tutorial_${action}`, { durationMs: ms(data?.durationSec), payload: data ?? {} });
		},
		share(levelId, data) {
			sink.share(levelId, data);
			track(`share_${data.surface}`, { levelId: lvl(levelId), value: data.score, payload: data });
		},
		gameBooster(levelId, action, data) {
			sink.gameBooster(levelId, action, data);
			track(`booster_${action}`, { levelId: lvl(levelId), payload: data });
		},
		altAd(action, data) {
			sink.altAd(action, data);
			track(`alt_ad_${action}`, {
				levelId: lvl(data.levelId),
				durationMs: ms(data.durationSec),
				payload: data,
			});
		},
		gameCoinsChanged(levelId, data) {
			sink.gameCoinsChanged(levelId, data);
			track('coins_changed', { levelId: lvl(levelId), value: data.delta, payload: data });
		},
		gameCustomEvent(levelId, action, data) {
			sink.gameCustomEvent(levelId, action, data);
			const value = (data as { score?: number }).score;
			track(action, {
				levelId: lvl(levelId),
				value: typeof value === 'number' ? value : undefined,
				payload: data,
			});
		},
	};
}
