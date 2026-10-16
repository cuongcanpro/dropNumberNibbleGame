// client/src/core/metrics/collectors/ScoreMetricsCollector.ts
import { type ExitRoute, NO_LEVEL, type ScoreEndReason } from '../events';
import { RunMetricsCollector } from './run-metrics-collector';

/** Persistable run meta for a suspend/resume snapshot — the non-derivable slice
 *  (original attempt / best-at-start / start time) so a resume re-arms the SAME
 *  funnel instead of opening a new run. */
export interface ScoreRunMeta {
	attemptNumber: number;
	bestAtStart: number;
	startedAtMs: number;
}

/**
 * Score-funnel collector. Sibling of LevelMetricsCollector: the base owns the
 * one-start-one-end lifecycle; subclasses keep their depth counters and supply
 * the live score (currentScore) and the gameData payloads. isPersonalBest
 * compares the final score to the best snapshotted at start ("beat the record
 * you walked in with"); a player_quit never counts as a personal best.
 */
export abstract class ScoreMetricsCollector extends RunMetricsCollector {
	private bestAtStart = 0;

	start(attemptNumber: number, bestAtStart: number, levelId: number = NO_LEVEL): void {
		if (this.active && !this.resolved) {
			// A new run starting before the prior one resolved = the prior run
			// was abandoned; close it so every start has exactly one end.
			this.emitQuit('restart');
			this.markResolved();
		}
		this.bestAtStart = bestAtStart;
		this.beginRun(levelId, attemptNumber);
		this.sink.gameScoreStart(levelId === NO_LEVEL ? { attemptNumber } : { levelId, attemptNumber });
	}

	/** Natural run end. score is read from currentScore() (live at end time). */
	end(gameData?: object): void {
		if (!this.active || this.resolved) return;
		const score = this.currentScore();
		const levelId = this.currentLevelId();
		const data: {
			score: number;
			durationSec: number;
			levelId?: number | undefined;
			attemptNumber: number;
			isPersonalBest: boolean;
			gameData?: object | undefined;
		} = {
			score,
			durationSec: this.durationSec(),
			attemptNumber: this.attemptNumber,
			isPersonalBest: score > this.bestAtStart,
			gameData,
		};
		if (levelId !== NO_LEVEL) data.levelId = levelId;
		this.sink.gameScoreEnd(data);
		this.markResolved();
	}

	/** Re-arm a suspended run on resume WITHOUT emitting gameScoreStart — the
	 *  original start already fired in the session that opened the run. The
	 *  eventual end closes the original funnel with the restored attempt /
	 *  best-at-start / start time. */
	resume(meta: ScoreRunMeta): void {
		this.bestAtStart = meta.bestAtStart;
		this.levelId = NO_LEVEL;
		this.attemptNumber = meta.attemptNumber;
		this.startedAtMs = meta.startedAtMs;
		this.resolved = false;
		this.active = true;
	}

	/** Persistable run meta for a suspend snapshot, or null when no run is open. */
	runMeta(): ScoreRunMeta | null {
		if (!this.active || this.resolved) return null;
		return {
			attemptNumber: this.attemptNumber,
			bestAtStart: this.bestAtStart,
			startedAtMs: this.startedAtMs,
		};
	}

	protected emitQuit(exitRoute: ExitRoute): void {
		const levelId = this.currentLevelId();
		const data: {
			score: number;
			durationSec: number;
			levelId?: number | undefined;
			attemptNumber: number;
			isPersonalBest: boolean;
			reason: ScoreEndReason;
			gameData: object;
		} = {
			score: this.currentScore(),
			durationSec: this.durationSec(),
			attemptNumber: this.attemptNumber,
			isPersonalBest: false,
			reason: 'player_quit',
			gameData: this.buildQuitData(exitRoute),
		};
		if (levelId !== NO_LEVEL) data.levelId = levelId;
		this.sink.gameScoreEnd(data);
	}

	/** Live current-run score, read at end / quit time. */
	protected abstract currentScore(): number;
	/** Live level id, read at end / quit time. Defaults to the level the run
	 *  began with (NO_LEVEL for games with no level dimension); override to
	 *  report a run-varying level (e.g. a player XP level that changes mid-run). */
	protected currentLevelId(): number {
		return this.levelId;
	}
	/** Snapshot current counters (+ exitRoute) for a player_quit end. */
	protected abstract buildQuitData(exitRoute: ExitRoute): object;
}
