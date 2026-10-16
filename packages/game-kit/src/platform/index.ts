export type { KitAtlas } from './atlas-alias';
export { createAtlasAliases, preloadKitAtlas } from './atlas-alias';
export type { PackedAtlasData } from './atlas-pages';
export { atlasPageUrls, kitAtlasPages } from './atlas-pages';
export type { BackKeyHandler, BackKeyOwner } from './back-key-manager';
export { BackKeyManager } from './back-key-manager';
export type {
	HostBattery,
	HostConnection,
	HostDeviceInfo,
	HostDiskSpace,
	HostPlatform,
	HostPlatformErrorCode,
} from './host-platform';
export { HostPlatformError, hostPlatform } from './host-platform';
export { LocalStorage } from './local-storage';
export { Logger, LogLevel } from './logger';
export type { ViewCameraLike, ViewRect } from './nibi-host';
export {
	applyHostCamera,
	computeViewZoom,
	DESIGN_HEIGHT,
	DESIGN_WIDTH,
	designView,
	FONT_TIMEOUT_MS,
	fetchPacked,
	getViewZoom,
	hostGameSize,
	loadFont,
	onAppHide,
	onAppShow,
	packedUrl,
	setViewZoom,
} from './nibi-host';
export type { AudioFile, QueueAudioOptions, QueueAudioScene } from './queue-audio';
export { queueAudioAfterStart } from './queue-audio';
export type { SafeInsets } from './safe-area';
export {
	SAFE_GAP,
	safeInsets,
	safeShiftDown,
	safeShiftUp,
	safeView,
	shiftDownFor,
	shiftUpFor,
	toDesignInsets,
} from './safe-area';
export { SFX_VOICES_PER_KEY } from './sfx-pool';
export type { SoundHandle, SoundScene } from './sound';
export { Sound } from './sound';
export type { UserSettings } from './user-data';
export { UserData } from './user-data';
export type { HapticStep } from './vibration';
export { hapticToMs, nearestVibrationType, Vibration, VibrationType } from './vibration';
