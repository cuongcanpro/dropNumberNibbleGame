/* oxlint-disable eslint/no-underscore-dangle -- test port từ Cocos, giữ cấu trúc để đối chiếu */
import { beforeEach, describe, expect, test } from 'vitest';
import { type ExitRoute, NO_LEVEL } from '../events';
import { FakeMetricSink } from '../testing/fake-metric-sink';
import { ScoreMetricsCollector } from './score-metrics-collector';

/** Concrete collector that reports a run-varying level via the currentLevelId hook. */
class LeveledScoreCollector extends ScoreMetricsCollector {
	private _score = 0;
	private _level = NO_LEVEL;
	setScore(s: number): void {
		this._score = s;
	}
	setLevel(level: number): void {
		this._level = level;
	}
	protected currentScore(): number {
		return this._score;
	}
	protected override currentLevelId(): number {
		return this._level;
	}
	protected buildQuitData(exitRoute: ExitRoute): object {
		return { exitRoute };
	}
}

/** Minimal concrete collector to exercise the base. */
class TestScoreCollector extends ScoreMetricsCollector {
	private _score = 0;
	setScore(s: number): void {
		this._score = s;
	}
	protected currentScore(): number {
		return this._score;
	}
	protected buildQuitData(exitRoute: ExitRoute): object {
		return { exitRoute, depth: this._score };
	}
}

describe('ScoreMetricsCollector', () => {
	let sink: FakeMetricSink;
	let now: number;
	let c: TestScoreCollector;

	beforeEach(() => {
		sink = new FakeMetricSink();
		now = 1000;
		c = new TestScoreCollector({ sink, nowMs: () => now });
	});

	test('start emits gameScoreStart with the attempt number', () => {
		c.start(3, 12);

		expect(sink.scoreStarts.length).toBe(1);
		expect(sink.scoreStarts[0]!.attemptNumber).toBe(3);
	});

	test('end emits gameScoreEnd with live score, duration, attempt and gameData', () => {
		c.start(1, 0);
		c.setScore(9);
		now = 8000; // 7s

		c.end({ depth: 9 });

		expect(sink.scoreEnds.length).toBe(1);
		const e = sink.scoreEnds[0]!;
		expect(e.score).toBe(9);
		expect(e.durationSec).toBe(7);
		expect(e.attemptNumber).toBe(1);
		expect(e.reason).toBeUndefined();
		expect(e.gameData).toEqual({ depth: 9 });
	});

	test('isPersonalBest is true only when score beats bestAtStart', () => {
		c.start(1, 10);
		c.setScore(11);
		c.end();

		c.start(2, 11);
		c.setScore(11);
		c.end();

		expect(sink.scoreEnds[0]!.isPersonalBest).toBe(true);
		expect(sink.scoreEnds[1]!.isPersonalBest).toBe(false);
	});

	test('recordQuit emits player_quit end, never a personal best, with buildQuitData', () => {
		c.start(1, 0);
		c.setScore(5);

		c.recordQuit('home');

		const e = sink.scoreEnds[0]!;
		expect(e.reason).toBe('player_quit');
		expect(e.score).toBe(5);
		expect(e.isPersonalBest).toBe(false);
		expect(e.gameData).toEqual({ exitRoute: 'home', depth: 5 });
	});

	test('a terminal end closes the funnel so a later quit is a no-op', () => {
		c.start(1, 0);
		c.setScore(7);
		c.end();

		c.recordQuit('back');

		expect(sink.scoreEnds.length).toBe(1);
		expect(sink.scoreEnds[0]!.reason).toBeUndefined();
	});

	test('start while a prior run is unresolved auto-closes it as player_quit(restart)', () => {
		c.start(1, 0);
		c.setScore(4);

		c.start(2, 4);

		expect(sink.scoreEnds.length).toBe(1);
		expect(sink.scoreEnds[0]!.reason).toBe('player_quit');
		expect(sink.scoreEnds[0]!.gameData).toEqual({ exitRoute: 'restart', depth: 4 });
		expect(sink.scoreStarts.length).toBe(2);
	});

	test('end before start is a no-op', () => {
		c.setScore(3);
		c.end();

		expect(sink.scoreEnds.length).toBe(0);
	});

	test('resume re-arms a suspended run without a second gameScoreStart', () => {
		c.resume({ attemptNumber: 5, bestAtStart: 20, startedAtMs: 1000 });
		c.setScore(25);
		now = 4000; // 3s after the restored startedAtMs

		c.end();

		expect(sink.scoreStarts.length).toBe(0); // resume never starts a funnel
		expect(sink.scoreEnds.length).toBe(1);
		const e = sink.scoreEnds[0]!;
		expect(e.attemptNumber).toBe(5);
		expect(e.durationSec).toBe(3);
		expect(e.isPersonalBest).toBe(true); // 25 > restored bestAtStart 20
	});

	test('a resumed run closes as player_quit via recordQuit, never a personal best', () => {
		c.resume({ attemptNumber: 3, bestAtStart: 0, startedAtMs: 1000 });
		c.setScore(8);

		c.recordQuit('back');

		expect(sink.scoreStarts.length).toBe(0);
		expect(sink.scoreEnds.length).toBe(1);
		expect(sink.scoreEnds[0]!.reason).toBe('player_quit');
		expect(sink.scoreEnds[0]!.isPersonalBest).toBe(false);
	});

	test('runMeta is null before a run, a snapshot while active, null after the end', () => {
		expect(c.runMeta()).toBeNull();

		c.start(2, 7); // beginRun snapshots startedAtMs = now (1000)
		now = 3000;

		expect(c.runMeta()).toEqual({ attemptNumber: 2, bestAtStart: 7, startedAtMs: 1000 });

		c.end();
		expect(c.runMeta()).toBeNull();
	});

	test('runMeta round-trips through resume to close the original funnel', () => {
		c.start(9, 50);
		now = 2000;
		const meta = c.runMeta();
		if (meta === null) throw new Error('expected a snapshot');

		// Simulate a new scene session: a fresh collector resumes from the snapshot.
		const sink2 = new FakeMetricSink();
		const c2 = new TestScoreCollector({ sink: sink2, nowMs: () => now });
		c2.resume(meta);
		c2.setScore(40);
		now = 4000; // 3s after the original startedAtMs (1000, captured at start)

		c2.end();

		expect(sink2.scoreStarts.length).toBe(0);
		expect(sink2.scoreEnds[0]!.attemptNumber).toBe(9);
		expect(sink2.scoreEnds[0]!.durationSec).toBe(3);
		expect(sink2.scoreEnds[0]!.isPersonalBest).toBe(false); // 40 < restored best 50
	});

	test('start with a levelId emits gameScoreStart carrying that levelId', () => {
		const lc = new LeveledScoreCollector({ sink, nowMs: () => now });
		lc.start(2, 0, 7);

		expect(sink.scoreStarts.length).toBe(1);
		expect(sink.scoreStarts[0]!.levelId).toBe(7);
		expect(sink.scoreStarts[0]!.attemptNumber).toBe(2);
	});

	test('end reports the live level from currentLevelId(), not the start level', () => {
		const lc = new LeveledScoreCollector({ sink, nowMs: () => now });
		lc.start(1, 0, 7);
		lc.setScore(40);
		lc.setLevel(9); // leveled up mid-run

		lc.end({ note: 'x' });

		expect(sink.scoreEnds[0]!.levelId).toBe(9);
	});

	test('a quit reports the live level and is never a personal best', () => {
		const lc = new LeveledScoreCollector({ sink, nowMs: () => now });
		lc.start(1, 100, 7);
		lc.setScore(120);
		lc.setLevel(9);

		lc.recordQuit('home');

		const e = sink.scoreEnds[0]!;
		expect(e.levelId).toBe(9);
		expect(e.reason).toBe('player_quit');
		expect(e.isPersonalBest).toBe(false);
	});

	test('omits levelId entirely when the run has no level dimension', () => {
		// TestScoreCollector never sets a level → currentLevelId() defaults to NO_LEVEL.
		c.start(3, 0);
		c.setScore(5);
		c.end();

		expect('levelId' in sink.scoreStarts[0]!).toBe(false);
		expect('levelId' in sink.scoreEnds[0]!).toBe(false);
	});
});
