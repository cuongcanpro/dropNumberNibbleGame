import { describe, expect, test } from 'vitest';
import type { ExitRoute } from '../events';
// client/src/core/metrics/collectors/LevelMetricsCollector.test.ts
import { FakeMetricSink } from '../testing/fake-metric-sink';
import { LevelMetricsCollector } from './level-metrics-collector';

class TestLevelCollector extends LevelMetricsCollector {
	protected buildQuitData(exitRoute: ExitRoute): object {
		return { exitRoute, progressPercent: 42 };
	}
}

function make() {
	const sink = new FakeMetricSink();
	let t = 0;
	const c = new TestLevelCollector({ sink, nowMs: () => t });
	return {
		sink,
		c,
		advance: (ms: number) => {
			t += ms;
		},
	};
}

describe('LevelMetricsCollector', () => {
	test('start emits gameLevelStart with attempt + gameData', () => {
		const { sink, c } = make();
		c.start(4, 2, { difficulty: 'hard' });
		expect(sink.levelStarts).toEqual([
			{ levelId: 4, data: { attemptNumber: 2, gameData: { difficulty: 'hard' } } },
		]);
	});

	test('complete emits once with durationSec', () => {
		const { sink, c, advance } = make();
		c.start(4, 1);
		advance(5000);
		c.complete({ score: 10 });
		expect(sink.levelCompletes.length).toBe(1);
		expect(sink.levelCompletes[0]!.levelId).toBe(4);
		expect(sink.levelCompletes[0]!.data.durationSec).toBe(5);
		expect(sink.levelCompletes[0]!.data.gameData).toEqual({ score: 10 });
	});

	test('recordQuit after complete is a no-op (resolved guard)', () => {
		const { sink, c } = make();
		c.start(4, 1);
		c.complete();
		c.recordQuit('home');
		expect(sink.levelFails.length).toBe(0);
	});

	test('recordQuit before resolve emits player_quit fail with exitRoute', () => {
		const { sink, c, advance } = make();
		c.start(4, 1);
		advance(3000);
		c.recordQuit('back');
		expect(sink.levelFails.length).toBe(1);
		const f = sink.levelFails[0]!;
		expect(f.data.reason).toBe('player_quit');
		expect(f.data.durationSec).toBe(3);
		expect(f.data.gameData).toEqual({ exitRoute: 'back', progressPercent: 42 });
	});

	test('reArm allows a quit after a prior fail (revive case)', () => {
		const { sink, c } = make();
		c.start(4, 1);
		c.fail('out_of_time');
		c.reArm();
		c.recordQuit('home');
		expect(sink.levelFails.length).toBe(2);
		expect(sink.levelFails[1]!.data.reason).toBe('player_quit');
	});

	test('recordShare emits share with surface + current level', () => {
		const { sink, c } = make();
		c.start(9, 1);
		c.recordShare('win_popup', { combo: 7 });
		expect(sink.shares).toEqual([
			{ levelId: 9, data: { surface: 'win_popup', gameData: { combo: 7 } } },
		]);
	});

	test('recordShare with no run in progress emits with NO_LEVEL (engagement, not run-scoped)', () => {
		const { sink, c } = make();
		c.recordShare('win_popup');
		expect(sink.shares).toEqual([{ levelId: -1, data: { surface: 'win_popup' } }]);
	});

	test('double complete emits only one gameLevelComplete (resolved guard)', () => {
		const { sink, c } = make();
		c.start(4, 1);
		c.complete();
		c.complete();
		expect(sink.levelCompletes.length).toBe(1);
	});

	test('start while a run is unresolved closes the prior run as player_quit then starts new', () => {
		const { sink, c } = make();
		c.start(4, 1);
		c.start(5, 1); // re-entry before resolving level 4
		expect(sink.levelStarts.length).toBe(2);
		expect(sink.levelStarts[1]!.levelId).toBe(5);
		expect(sink.levelFails.length).toBe(1);
		expect(sink.levelFails[0]!.levelId).toBe(4);
		expect(sink.levelFails[0]!.data.reason).toBe('player_quit');
		expect(sink.levelFails[0]!.data.gameData).toEqual({
			exitRoute: 'restart',
			progressPercent: 42,
		});
		// new run is open and resolvable normally
		c.complete();
		expect(sink.levelCompletes.length).toBe(1);
		expect(sink.levelCompletes[0]!.levelId).toBe(5);
	});
});
