import type {
	AltAdAction,
	AltAdData,
	BoosterAction,
	LevelFailReason,
	ScoreEndReason,
	ShareSurface,
	TutorialAction,
} from './events';

/**
 * Game-facing output port. Collectors depend on THIS, never on MetricLogger,
 * so they unit-test against a FakeMetricSink. App-level events
 * (session/deeplink/screen) are NOT here — they are emitted by app trackers
 * calling MetricLogger directly.
 */
export interface MetricSink {
	gameLevelStart(
		levelId: number,
		data: { attemptNumber?: number | undefined; gameData?: object | undefined },
	): void;
	gameLevelComplete(
		levelId: number,
		data: {
			durationSec: number;
			attemptNumber?: number | undefined;
			gameData?: object | undefined;
		},
	): void;
	gameLevelFail(
		levelId: number,
		data: {
			durationSec: number;
			reason?: LevelFailReason | undefined;
			attemptNumber?: number | undefined;
			exitRoute?: string | undefined;
			gameData?: object | undefined;
		},
	): void;

	gameScoreStart(data: {
		levelId?: string | number | undefined;
		attemptNumber?: number | undefined;
	}): void;
	gameScoreEnd(data: {
		score: number;
		durationSec: number;
		levelId?: string | number | undefined;
		attemptNumber?: number | undefined;
		isPersonalBest?: boolean | undefined;
		reason?: ScoreEndReason | undefined;
		exitRoute?: string | undefined;
		gameData?: object | undefined;
	}): void;

	tutorial(
		action: TutorialAction,
		data?: {
			stepIndex?: number | undefined;
			totalSteps?: number | undefined;
			durationSec?: number | undefined;
			gameData?: object | undefined;
		},
	): void;
	share(
		levelId: number,
		data: { surface: ShareSurface; score?: number | undefined; gameData?: object | undefined },
	): void;
	gameBooster(levelId: number, action: BoosterAction, data: object): void;
	altAd(action: AltAdAction, data: AltAdData): void;
	gameCoinsChanged(levelId: number, data: { delta: number; total: number; reason: string }): void;
	gameCustomEvent(levelId: number, action: string, data: object): void;
}
