import { FakeMetricSink } from '@repo/game-kit/metrics';
import { describe, expect, it } from 'vitest';
import { GameMetricsCollector } from './game-metrics-collector';

function setup(score: number) {
	const sink = new FakeMetricSink();
	const collector = new GameMetricsCollector({ sink, nowMs: () => 0, getScore: () => score });
	return { sink, collector };
}

describe('GameMetricsCollector', () => {
	it('một ván bắt đầu -> đúng một game_score_end', () => {
		const { sink, collector } = setup(7);
		collector.start(1, 5);
		collector.end({ score: 7 });
		collector.recordQuit('home');
		expect(sink.scoreStarts).toHaveLength(1);
		expect(sink.scoreEnds).toHaveLength(1);
		expect(sink.scoreEnds[0]).toMatchObject({ score: 7, isPersonalBest: true });
	});

	it('thoát giữa chừng ghi player_quit kèm điểm đang có', () => {
		const { sink, collector } = setup(4);
		collector.start(1, 9);
		collector.recordQuit('home');
		expect(sink.scoreEnds[0]).toMatchObject({ score: 4, isPersonalBest: false });
	});
});
