import { afterEach, describe, expect, it } from 'vitest';
import { createTrackingRig, resetTrackingForTest } from '../testing/tracking-rig';
import { setGameSlug } from '../tracking/game-context';
import { emitGameExit, emitGameOpen } from '../tracking/game-session';
import { flushNow } from '../tracking/track';
import { LevelMetricsCollector } from './collectors/level-metrics-collector';
import { ScoreMetricsCollector } from './collectors/score-metrics-collector';
import type { ExitRoute } from './events';
import { createMetricSink } from './metric-sink-adapter';

afterEach(() => resetTrackingForTest());

class TestLevel extends LevelMetricsCollector {
	protected buildQuitData(exitRoute: ExitRoute): object {
		return { exitRoute };
	}
}
class TestScore extends ScoreMetricsCollector {
	score = 0;
	protected currentScore(): number {
		return this.score;
	}
	protected buildQuitData(exitRoute: ExitRoute): object {
		return { exitRoute };
	}
}

async function actions(rig: ReturnType<typeof createTrackingRig>) {
	await flushNow();
	return rig.sent.flatMap((s) => s.body.events);
}

describe('collector → sink → Console (action name + duration_ms đúng Cocos)', () => {
	it('LevelMetricsCollector: start/complete/fail/quit', async () => {
		const rig = createTrackingRig();
		setGameSlug('haru-cats');
		let t = 0;
		const c = new TestLevel({ sink: createMetricSink(), nowMs: () => t });
		c.start(5, 1);
		t = 2500;
		c.complete({ stars: 3 });
		c.start(6, 1);
		t = 4000;
		c.fail('no_moves');
		c.start(7, 1);
		c.recordQuit('home');
		const ev = await actions(rig);
		expect(ev.map((e) => e['action'])).toEqual([
			'game_level_start',
			'game_level_complete',
			'game_level_start',
			'game_level_fail',
			'game_level_start',
			'game_level_fail',
		]);
		expect(ev[1]).toMatchObject({ level_id: 5, duration_ms: 2500, game_slug: 'haru-cats' });
		expect(ev[3]).toMatchObject({ level_id: 6, duration_ms: 1500 });
	});

	it('ScoreMetricsCollector: score_start/score_end, value = score, duration_ms = sec*1000', async () => {
		const rig = createTrackingRig();
		setGameSlug('block-blast');
		let t = 0;
		const c = new TestScore({ sink: createMetricSink(), nowMs: () => t });
		c.start(1, 100);
		c.score = 450;
		t = 61_250;
		c.end();
		const ev = await actions(rig);
		expect(ev.map((e) => e['action'])).toEqual(['game_score_start', 'game_score_end']);
		expect(ev[1]).toMatchObject({ value: 450, duration_ms: 61_250 });
		expect(JSON.parse(ev[1]!['payload'] as string)).toMatchObject({ isPersonalBest: true });
		expect(ev[0]!['level_id']).toBeUndefined(); // NO_LEVEL (-1) → bỏ
	});

	it('run + tutorial/share/booster/coins map đúng tên action', async () => {
		const rig = createTrackingRig();
		const sink = createMetricSink();
		sink.tutorial('start');
		sink.share(2, { surface: 'win_popup', score: 10 });
		sink.gameBooster(2, 'used', {});
		sink.gameCoinsChanged(2, { delta: 5, total: 50, reason: 'win' });
		const ev = await actions(rig);
		expect(ev.map((e) => e['action'])).toEqual([
			'tutorial_start',
			'share_win_popup',
			'booster_used',
			'coins_changed',
		]);
	});

	it('alt_ad_* đi qua sink tới Console (sửa lỗi Cocos)', async () => {
		const rig = createTrackingRig();
		const sink = createMetricSink();
		for (const a of [
			'offered',
			'accepted',
			'completed',
			'skipped',
			'abandoned',
			'error',
		] as const) {
			sink.altAd(a, { taskType: 'revive', origin: 'grill', durationSec: 1.5, levelId: 4 });
		}
		const ev = await actions(rig);
		expect(ev.map((e) => e['action'])).toEqual([
			'alt_ad_offered',
			'alt_ad_accepted',
			'alt_ad_completed',
			'alt_ad_skipped',
			'alt_ad_abandoned',
			'alt_ad_error',
		]);
		expect(ev[0]).toMatchObject({ level_id: 4, duration_ms: 1500 });
	});

	it('emitGameOpen/Exit: slug + mode vào mọi event sau đó; exit có duration', async () => {
		const rig = createTrackingRig();
		let t = 1000;
		emitGameOpen('onet', 'Classic', undefined, () => t);
		createMetricSink().gameScoreStart({ attemptNumber: 1 });
		t = 4000;
		emitGameExit(undefined, () => t);
		const ev = await actions(rig);
		expect(ev.map((e) => e['action'])).toEqual(['game_open', 'game_score_start', 'game_exit']);
		expect(ev.every((e) => e['game_slug'] === 'onet')).toBe(true);
		expect(ev[1]!['mode']).toBe('classic');
		expect(ev[2]!['duration_ms']).toBe(3000);
	});
});
