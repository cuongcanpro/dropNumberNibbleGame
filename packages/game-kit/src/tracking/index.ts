export type { IdentityProvider } from './device-identity';
export { DEVICE_ID_KEY, getOrCreateDeviceId, guestIdentity } from './device-identity';
export {
	getGameMode,
	getGameSlug,
	normalizeMode,
	setGameMode,
	setGameSlug,
} from './game-context';
export { emitGameExit, emitGameOpen, emitSessionStart } from './game-session';
export type { GameKitTrackingOptions } from './nibi-tracking-host';
export { createDomHost, initGameKitTracking } from './nibi-tracking-host';
export type { BridgeEmit } from './sink-bridge';
export { wrapSinkWithTracking } from './sink-bridge';
export { emit, flushNow, initTracking, trackingConfig, trackingReady } from './track';
export type { TrackingBootOptions } from './tracking-bootstrap';
export { bootTracking } from './tracking-bootstrap';
export type { TrackingHost } from './tracking-host';
export type { NbConsoleEnv, TrackingTarget } from './tracking-target';
export { endpointForEnv, envFromBuild, resolveTrackingTarget } from './tracking-target';
export * from './types';
