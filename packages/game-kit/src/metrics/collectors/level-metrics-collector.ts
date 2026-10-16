// client/src/core/metrics/collectors/LevelMetricsCollector.ts
import type { ExitRoute, LevelFailReason } from '../events';
import { RunMetricsCollector } from './run-metrics-collector';

/**
 * Level-funnel collector. Subclass supplies game-specific gameData via the
 * start/complete/fail args and the buildQuitData() hook used by recordQuit().
 */
export abstract class LevelMetricsCollector extends RunMetricsCollector {
	start(levelId: number, attemptNumber: number, gameData?: object): void {
		if (this.active && !this.resolved) {
			// A new run starting before the prior one resolved = the prior run
			// was abandoned; close it so every start has exactly one outcome.
			this.emitQuit('restart');
			this.markResolved();
		}
		this.beginRun(levelId, attemptNumber);
		this.sink.gameLevelStart(levelId, { attemptNumber, gameData });
	}

	complete(gameData?: object): void {
		if (!this.active || this.resolved) return;
		this.sink.gameLevelComplete(this.levelId, {
			durationSec: this.durationSec(),
			attemptNumber: this.attemptNumber,
			gameData,
		});
		this.markResolved();
	}

	fail(reason: LevelFailReason, gameData?: object): void {
		if (!this.active || this.resolved) return;
		this.sink.gameLevelFail(this.levelId, {
			durationSec: this.durationSec(),
			reason,
			attemptNumber: this.attemptNumber,
			gameData,
		});
		this.markResolved();
	}

	protected emitQuit(exitRoute: ExitRoute): void {
		this.sink.gameLevelFail(this.levelId, {
			durationSec: this.durationSec(),
			reason: 'player_quit',
			attemptNumber: this.attemptNumber,
			gameData: this.buildQuitData(exitRoute),
		});
	}

	/** Snapshot current counters + exitRoute for a player_quit fail. */
	protected abstract buildQuitData(exitRoute: ExitRoute): object;
}
