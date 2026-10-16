import type { ShakeFailReason } from './alt-ad-gate';
import type { MotionSource } from './motion-source';
import type { ShakeSessionOptions } from './shake-session';

export interface ShakeUiOptions {
	onSuccess: () => void;
	onFail: (reason: ShakeFailReason) => void;
	/** Reward icon đã nạp vào `KEYS.reward` (xem ensureShakeAssets). */
	hasReward?: boolean;
	/** Key texture của icon reward; mặc định `KEYS.reward`. */
	rewardKey?: string;
	rewardAmount?: number | undefined;
	fontFamily?: string;
	motion?: MotionSource;
	session?: ShakeSessionOptions;
	/** Kho câu thẻ reward (kit-config `altad.messages`); rỗng = kho mặc định. */
	messages?: readonly string[];
}
