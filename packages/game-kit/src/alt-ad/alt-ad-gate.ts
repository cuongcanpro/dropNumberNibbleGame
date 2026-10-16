// Port của Cocos `scenes/shake/AltAdGate.ts`. THUẦN: UI, sink và đồng hồ đều được tiêm vào.
// Sửa bug Cocos: emit luôn đi qua MetricSink.altAd (không gọi thẳng logger).
import type { AltAdAction, AltAdData, AltAdTaskType } from '../metrics/events';
import type { MetricSink } from '../metrics/metric-sink';

export type ShakeFailReason = 'skipped' | 'abandoned';
export type AltAdOutcome = 'completed' | 'skipped' | 'abandoned' | 'error';

export interface AltAdContext {
	taskType: AltAdTaskType;
	origin?: string | undefined;
	levelId?: string | number | undefined;
}

export interface ShakePopupHandlers {
	rewardUrl?: string | undefined;
	rewardKey?: string | undefined;
	rewardAmount?: number | undefined;
	onSuccess: () => void;
	onFail: (reason: ShakeFailReason) => void;
}

export type ShowPopup = (handlers: ShakePopupHandlers) => void;
export type AltAdEmit = (action: AltAdAction, data: AltAdData) => void;

export interface AltAdGateOpenArgs {
	context: AltAdContext;
	/** Ảnh reward nạp lúc mở (file lẻ). Game đã có ảnh trong atlas thì dùng `rewardKey` để khỏi giữ bản sao lẻ. */
	rewardUrl?: string | undefined;
	/** Key texture CÓ SẴN (vd frame atlas đã `preloadKitAtlas`) dùng làm icon reward; thắng `rewardUrl` khi texture tồn tại. */
	rewardKey?: string | undefined;
	/** Số reward được tặng. Mặc định 1. */
	rewardAmount?: number | undefined;
	onReward: () => void | Promise<void>;
	onGrantError?: (() => void) | undefined;
}

export interface AltAdGate {
	open(args: AltAdGateOpenArgs): Promise<AltAdOutcome>;
}

export interface AltAdGateDeps {
	/** Mọi `alt_ad_*` đi qua sink (sửa bug Cocos gọi thẳng logger) → tới Console. */
	sink: Pick<MetricSink, 'altAd'>;
	showPopup: ShowPopup;
	now?: () => number;
}

export function createAltAdGate(deps: AltAdGateDeps): AltAdGate {
	const now = deps.now ?? (() => Date.now());
	const emit: AltAdEmit = (action, data) => deps.sink.altAd(action, data);

	return {
		open(args) {
			const { context, rewardUrl, rewardKey, rewardAmount, onReward, onGrantError } = args;
			const startMs = now();
			emit('offered', { ...context });
			const elapsed = (): number => Math.max(0, Math.round((now() - startMs) / 1000));

			return new Promise<AltAdOutcome>((resolve) => {
				let settled = false; // popup gọi 2 lần (back + X) không được emit đôi
				deps.showPopup({
					rewardUrl,
					rewardKey,
					rewardAmount,
					onFail: (reason) => {
						if (settled) return;
						settled = true;
						emit(reason, { ...context, durationSec: elapsed() });
						resolve(reason);
					},
					onSuccess: () => {
						if (settled) return;
						settled = true;
						Promise.resolve()
							.then(() => onReward())
							.then(
								() => {
									emit('completed', { ...context, durationSec: elapsed() });
									resolve('completed');
								},
								(err: unknown) => {
									const errorReason = err instanceof Error ? err.message : String(err);
									emit('error', { ...context, durationSec: elapsed(), errorReason });
									onGrantError?.();
									resolve('error');
								},
							);
					},
				});
			});
		},
	};
}
