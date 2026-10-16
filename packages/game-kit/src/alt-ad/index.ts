export type {
	AltAdContext,
	AltAdGate,
	AltAdGateDeps,
	AltAdGateOpenArgs,
	AltAdOutcome,
	ShakeFailReason,
	ShakePopupHandlers,
} from './alt-ad-gate';
export { createAltAdGate } from './alt-ad-gate';
export { ensureShakeAssets, preloadShakeAssets } from './assets';
export type { MotionSource } from './motion-source';
export { createMotionSource } from './motion-source';
export { REVIVE_MESSAGES, randomReviveMessage } from './revive-messages';
export type { SceneAltAdGateOptions } from './scene-alt-ad-gate';
export { createSceneAltAdGate } from './scene-alt-ad-gate';
export type {
	MotionSample,
	ShakeDetector,
	ShakeDetectorOptions,
	ShakeDirection,
	ShakeEvent,
} from './shake-detector';
export { createShakeDetector, GRAVITY_MS2 } from './shake-detector';
export type { ShakeFeedResult, ShakeSession, ShakeSessionOptions } from './shake-session';
export { createShakeSession } from './shake-session';
export { ShakeUi } from './shake-ui';
export type { ShakeUiOptions } from './shake-ui-options';
export { dismissShakeUi, simulateShakeSuccess } from './shake-ui-sim';
export type { TapFallback, TapFallbackOptions } from './tap-fallback';
export { createTapFallback } from './tap-fallback';
