import type { AltAdAction, AltAdData, BoosterAction, TutorialAction } from '../events';
import type { MetricSink } from '../metric-sink';

export class FakeMetricSink implements MetricSink {
	levelStarts: Array<{
		levelId: number;
		data: { attemptNumber?: number | undefined; gameData?: object | undefined };
	}> = [];
	levelCompletes: Array<{
		levelId: number;
		data: {
			durationSec: number;
			attemptNumber?: number | undefined;
			gameData?: object | undefined;
		};
	}> = [];
	levelFails: Array<{
		levelId: number;
		data: {
			durationSec: number;
			reason?: string | undefined;
			attemptNumber?: number | undefined;
			exitRoute?: string | undefined;
			gameData?: object | undefined;
		};
	}> = [];
	scoreStarts: Array<{
		levelId?: string | number | undefined;
		attemptNumber?: number | undefined;
	}> = [];
	scoreEnds: Array<{
		score: number;
		durationSec: number;
		levelId?: string | number | undefined;
		attemptNumber?: number | undefined;
		isPersonalBest?: boolean | undefined;
		reason?: string | undefined;
		exitRoute?: string | undefined;
		gameData?: object | undefined;
	}> = [];
	tutorials: Array<{
		action: TutorialAction;
		data?:
			| {
					stepIndex?: number | undefined;
					totalSteps?: number | undefined;
					durationSec?: number | undefined;
					gameData?: object | undefined;
			  }
			| undefined;
	}> = [];
	shares: Array<{
		levelId: number;
		data: { surface: string; score?: number | undefined; gameData?: object | undefined };
	}> = [];
	boosters: Array<{ levelId: number; action: BoosterAction; data: object }> = [];
	altAds: Array<{ action: AltAdAction; data: AltAdData }> = [];
	coins: Array<{ levelId: number; data: { delta: number; total: number; reason: string } }> = [];
	customs: Array<{ levelId: number; action: string; data: object }> = [];

	gameLevelStart(
		levelId: number,
		data: { attemptNumber?: number | undefined; gameData?: object | undefined },
	): void {
		this.levelStarts.push({ levelId, data });
	}
	gameLevelComplete(
		levelId: number,
		data: {
			durationSec: number;
			attemptNumber?: number | undefined;
			gameData?: object | undefined;
		},
	): void {
		this.levelCompletes.push({ levelId, data });
	}
	gameLevelFail(
		levelId: number,
		data: {
			durationSec: number;
			reason?: string | undefined;
			attemptNumber?: number | undefined;
			exitRoute?: string | undefined;
			gameData?: object | undefined;
		},
	): void {
		this.levelFails.push({ levelId, data });
	}
	gameScoreStart(data: {
		levelId?: string | number | undefined;
		attemptNumber?: number | undefined;
	}): void {
		this.scoreStarts.push(data);
	}
	gameScoreEnd(data: {
		score: number;
		durationSec: number;
		levelId?: string | number | undefined;
		attemptNumber?: number | undefined;
		isPersonalBest?: boolean | undefined;
		reason?: string | undefined;
		exitRoute?: string | undefined;
		gameData?: object | undefined;
	}): void {
		this.scoreEnds.push(data);
	}
	tutorial(
		action: TutorialAction,
		data?: {
			stepIndex?: number | undefined;
			totalSteps?: number | undefined;
			durationSec?: number | undefined;
			gameData?: object | undefined;
		},
	): void {
		this.tutorials.push({ action, data });
	}
	share(
		levelId: number,
		data: { surface: string; score?: number | undefined; gameData?: object | undefined },
	): void {
		this.shares.push({ levelId, data });
	}
	gameBooster(levelId: number, action: BoosterAction, data: object): void {
		this.boosters.push({ levelId, action, data });
	}
	altAd(action: AltAdAction, data: AltAdData): void {
		this.altAds.push({ action, data });
	}
	gameCoinsChanged(levelId: number, data: { delta: number; total: number; reason: string }): void {
		this.coins.push({ levelId, data });
	}
	gameCustomEvent(levelId: number, action: string, data: object): void {
		this.customs.push({ levelId, action, data });
	}
}
