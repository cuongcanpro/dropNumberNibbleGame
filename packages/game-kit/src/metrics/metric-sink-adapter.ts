import { getGameMode, getGameSlug } from '../tracking/game-context';
import { wrapSinkWithTracking } from '../tracking/sink-bridge';
import { emit } from '../tracking/track';
import type { MetricSink } from './metric-sink';

/**
 * Sink gốc rỗng: Nibi không có zal/MetricLogger (lệch có ý so với Cocos, xem
 * docs/port-parity-checklist.md L3) và không có GameStatsReporter (cần zpsToken, L4).
 * Console là đích duy nhất, đi qua bridge.
 */
const noopSink: MetricSink = {
	gameLevelStart: () => undefined,
	gameLevelComplete: () => undefined,
	gameLevelFail: () => undefined,
	gameScoreStart: () => undefined,
	gameScoreEnd: () => undefined,
	tutorial: () => undefined,
	share: () => undefined,
	gameBooster: () => undefined,
	altAd: () => undefined,
	gameCoinsChanged: () => undefined,
	gameCustomEvent: () => undefined,
};

/**
 * MetricSink production: mọi call → `emit` của tracking SDK. SDK chưa init thì emit buffer/nuốt,
 * SDK tắt (thiếu env/key) thì không có gì ra mạng. `altAd` cũng đi qua bridge → `alt_ad_<action>`
 * tới Console (sửa lỗi Cocos: alt_ad chỉ đi zal nên Console không thấy).
 * Slug/mode đọc từ game-context (set bởi `emitGameOpen`/`setGameSlug`/`setGameMode`).
 */
export function createMetricSink(): MetricSink {
	return wrapSinkWithTracking(noopSink, emit, getGameSlug, getGameMode);
}
