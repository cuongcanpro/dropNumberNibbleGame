import { describe, expect, test } from 'vitest';
import type { ExitRoute } from '../events';
import { FakeMetricSink } from '../testing/fake-metric-sink';
import { type RunCollectorDeps, RunMetricsCollector } from './run-metrics-collector';

/** Minimal concrete collector: emitQuit records a player_quit fail carrying the
 *  exitRoute, and open() exposes the protected beginRun for the test. */
class TestCollector extends RunMetricsCollector {
	protected emitQuit(exitRoute: ExitRoute): void {
		this.sink.gameLevelFail(this.levelId, {
			durationSec: 0,
			reason: 'player_quit',
			attemptNumber: this.attemptNumber,
			exitRoute,
		});
	}
	open(): void {
		this.beginRun(1, 1);
	}
}

function make(deps: Partial<RunCollectorDeps> = {}) {
	const sink = new FakeMetricSink();
	const c = new TestCollector({ sink, nowMs: () => 0, teardownRoute: deps.teardownRoute });
	return { sink, c };
}

describe('RunMetricsCollector.recordTeardownQuit', () => {
	test('fires one quit with the configured teardownRoute when a run is open', () => {
		const { sink, c } = make({ teardownRoute: 'home' });
		c.open();
		c.recordTeardownQuit();
		expect(sink.levelFails.length).toBe(1);
		expect(sink.levelFails[0]!.data.exitRoute).toBe('home');
	});

	test('defaults to back when teardownRoute is omitted', () => {
		const { sink, c } = make();
		c.open();
		c.recordTeardownQuit();
		expect(sink.levelFails[0]!.data.exitRoute).toBe('back');
	});

	test('is a no-op when no run is open', () => {
		const { sink, c } = make();
		c.recordTeardownQuit();
		expect(sink.levelFails.length).toBe(0);
	});

	test('is a no-op after an explicit recordQuit (no double-emit)', () => {
		const { sink, c } = make({ teardownRoute: 'back' });
		c.open();
		c.recordQuit('home');
		c.recordTeardownQuit();
		expect(sink.levelFails.length).toBe(1);
		expect(sink.levelFails[0]!.data.exitRoute).toBe('home');
	});
});
