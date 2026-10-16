export { setGameMode } from '../tracking/game-context';
export { EXIT_FLUSH_TIMEOUT_MS } from './exit-sequence';
export type { FeedbackInput } from './feedback-client';
export { sendFeedback } from './feedback-client';
export type { GameShellOptions } from './game-shell';
export { exitToHost, initGameShell, markGameOpen } from './game-shell';
export type { HostShareResult } from './host-share';
export { attachShareHost } from './host-share';
export type { KitConfig, RankBoardName, RankLayout, SettingThemeName } from './kit-config';
export { KIT_CONFIG_DEFAULTS, parseKitConfig } from './kit-config';
export {
	feedbackReasonsOf,
	hudButtons,
	rankBoardOf,
	rankLayoutOf,
	settingButtonVisible,
} from './kit-config-rules';
export { detectPlatform } from './platform-detect';
export type { ShareInput, ShareLinkParams, ShareResult } from './share';
export { buildShareLink, canShare, shareGame } from './share';
