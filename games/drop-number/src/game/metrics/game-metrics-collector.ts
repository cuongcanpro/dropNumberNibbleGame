import { type ExitRoute, type MetricSink, ScoreMetricsCollector } from '@repo/game-kit/metrics';

export interface GameMetricsCollectorDeps {
	readonly sink: MetricSink;
	readonly nowMs: () => number;
	/** Điểm sống của ván — đọc lúc kết thúc / bỏ dở, để thoát giữa chừng mang điểm đang có chứ không phải 0. */
	readonly getScore: () => number;
}

/**
 * Collector cho game theo điểm (`game_score_start/end`); không hardcode slug (sink tự đọc). Game theo màn
 * thì extend `LevelMetricsCollector` thay vì `ScoreMetricsCollector` (docs/game-kit.md "Metrics").
 */
export class GameMetricsCollector extends ScoreMetricsCollector {
	private readonly getScore: () => number;

	constructor(deps: GameMetricsCollectorDeps) {
		super({ sink: deps.sink, nowMs: deps.nowMs });
		this.getScore = deps.getScore;
	}

	protected currentScore(): number {
		return this.getScore();
	}

	protected buildQuitData(exitRoute: ExitRoute): object {
		return { exitRoute };
	}
}
