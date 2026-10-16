// client/src/core/metrics/collectors/RunMetricsCollector.ts
import type { BoosterAction, ExitRoute, ShareSurface, TutorialAction } from '../events';
import type { MetricSink } from '../metric-sink';

export interface RunCollectorDeps {
	sink: MetricSink;
	nowMs: () => number;
	/** Route reported when the scene is torn down mid-run without an explicit
	 *  nav quit (system back, portal swap). Defaults to 'back'. */
	teardownRoute?: ExitRoute | undefined;
}

/**
 * Template-Method base for a single play "run". Owns the universal lifecycle:
 * one start resolves to exactly one outcome; a mid-run quit folds into that
 * outcome via the resolved guard. Game subclasses keep their own counters and
 * supply the game-specific payloads.
 */
export abstract class RunMetricsCollector {
	protected readonly sink: MetricSink;
	protected readonly nowMs: () => number;
	protected readonly teardownRoute: ExitRoute;

	protected levelId = -1;
	protected attemptNumber = -1;
	protected startedAtMs = 0;
	/** True once a terminal outcome has been emitted for the current run. */
	protected resolved = true;
	/** True between beginRun and the next beginRun. */
	protected active = false;

	constructor(deps: RunCollectorDeps) {
		this.sink = deps.sink;
		this.nowMs = deps.nowMs;
		this.teardownRoute = deps.teardownRoute ?? 'back';
	}

	protected beginRun(levelId: number, attemptNumber: number): void {
		this.levelId = levelId;
		this.attemptNumber = attemptNumber;
		this.startedAtMs = this.nowMs();
		this.resolved = false;
		this.active = true;
	}

	protected durationSec(): number {
		return Math.max(0, (this.nowMs() - this.startedAtMs) / 1000);
	}

	protected markResolved(): void {
		this.resolved = true;
	}

	/** Re-open the run after a revive/continue that followed a fail emission. */
	reArm(): void {
		if (this.active) this.resolved = false;
	}

	/** Single onExit chokepoint. No-op if the run already resolved to win/fail. */
	recordQuit(exitRoute: ExitRoute = 'unknown'): void {
		if (!this.active || this.resolved) return;
		this.emitQuit(exitRoute);
		this.markResolved();
	}

	/** Safety-net quit for scene teardown. Fires recordQuit(teardownRoute) only
	 *  if the run is still open — a no-op after a win/fail or an explicit quit. */
	recordTeardownQuit(): void {
		this.recordQuit(this.teardownRoute);
	}

	recordShare(surface: ShareSurface, gameData?: object): void {
		this.sink.share(this.levelId, gameData ? { surface, gameData } : { surface });
	}

	recordTutorial(
		action: TutorialAction,
		data?: {
			stepIndex?: number | undefined;
			totalSteps?: number | undefined;
			durationSec?: number | undefined;
			gameData?: object | undefined;
		},
	): void {
		this.sink.tutorial(action, data);
	}

	recordBooster(action: BoosterAction, data: object): void {
		if (!this.active) return;
		this.sink.gameBooster(this.levelId, action, data);
	}

	/** Emit the outcome-as-quit. Subclass picks level-fail vs score-end. */
	protected abstract emitQuit(exitRoute: ExitRoute): void;
}
