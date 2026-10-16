/** Closed taxonomy. Do not add per-game logGroups — use `game_event`.
 *  gameData guardrail: the opaque per-event `gameData` block is for ad-hoc
 *  exploration only. The warehouse MUST NOT build funnels/KPIs on fields
 *  inside gameData — promote anything dashboard-bound to a typed field/enum. */
export type LogGroup =
	| 'session'
	| 'screen'
	| 'deeplink'
	| 'game_level'
	| 'game_score'
	| 'tutorial'
	| 'share'
	| 'alt_ad'
	| 'booster'
	| 'coins'
	| 'game_event';

export type SessionAction = 'start' | 'alive' | 'end';
export type GameLevelAction = 'start' | 'complete' | 'fail';
export type GameScoreAction = 'start' | 'end';
export type TutorialAction = 'start' | 'step' | 'complete' | 'drop_off';
export type BoosterAction = 'used' | 'purchased' | 'purchase_failed';
export type AltAdAction = 'offered' | 'accepted' | 'completed' | 'skipped' | 'abandoned' | 'error';

/** Which exit path produced a player_quit outcome. */
export type ExitRoute = 'home' | 'back' | 'restart' | 'level_jump' | 'map' | 'unknown';

/** Closed category of a game_level fail. Game-specific detail (e.g.
 *  'out_of_hearts', 'order-timeout', 'slots_full') belongs in gameData.failDetail,
 *  never in this field — the warehouse funnels on the category only. */
export type LevelFailReason =
	| 'out_of_resource'
	| 'out_of_time'
	| 'no_moves'
	| 'objective_unmet'
	| 'player_quit';

/** Closed reason of a game_score end. Natural run-end vs voluntary bail. */
export type ScoreEndReason = 'game_over' | 'player_quit';

/** Where a share was invoked. Closed — add a value here, not a free string. */
export type ShareSurface = 'win_popup' | 'game_over';

/** Closed alt-ad offer category — function, not game vocabulary. The specific
 *  item (grill, hammer, booster id…) goes in AltAdData.origin. */
export type AltAdTaskType = 'revive' | 'free_booster';

export interface AltAdData {
	taskType: AltAdTaskType;
	origin?: string | undefined;
	levelId?: string | number | undefined;
	durationSec?: number | undefined;
	errorReason?: string | undefined;
}

/** Sentinel for events with no level context. */
export const NO_LEVEL = -1;
