/* oxlint-disable unicorn/consistent-function-scoping -- test port từ Cocos, giữ cấu trúc để đối chiếu */
import { beforeEach, describe, expect, it } from 'vitest';
import type { BridgeEmit } from './sink-bridge';
import { wrapSinkWithTracking } from './sink-bridge';

// MetricSink shape tối thiểu cho test — chỉ các method bridge đụng tới
function fakeSink() {
	const calls: string[] = [];
	const rec =
		(name: string) =>
		(...args: unknown[]) =>
			void (calls.push(name), args);
	return {
		calls,
		sink: {
			gameLevelStart: rec('gameLevelStart'),
			gameLevelComplete: rec('gameLevelComplete'),
			gameLevelFail: rec('gameLevelFail'),
			gameScoreStart: rec('gameScoreStart'),
			gameScoreEnd: rec('gameScoreEnd'),
			tutorial: rec('tutorial'),
			share: rec('share'),
			gameBooster: rec('gameBooster'),
			altAd: rec('altAd'),
			gameCoinsChanged: rec('gameCoinsChanged'),
			gameCustomEvent: rec('gameCustomEvent'),
		},
	};
}

describe('wrapSinkWithTracking', () => {
	let emitted: { action: string; ctx?: import('./types').EmitCtx & Record<string, unknown> }[];
	const emit: BridgeEmit = (action, ctx) => void emitted.push({ action, ctx: ctx as never });
	const slug = () => 'sandfall';

	beforeEach(() => {
		emitted = [];
	});

	it('gọi XUYÊN sink gốc (dual-write) và emit action map đúng tên catalog', () => {
		const { sink, calls } = fakeSink();
		const wrapped = wrapSinkWithTracking(sink as never, emit, slug);
		wrapped.gameLevelStart(5, { attemptNumber: 2, gameData: { boardSize: 6 } });
		expect(calls).toEqual(['gameLevelStart']); // đường zal cũ vẫn chạy
		expect(emitted[0].action).toBe('game_level_start');
		expect(emitted[0].ctx).toMatchObject({ gameSlug: 'sandfall', levelId: 5 });
		expect(emitted[0].ctx?.payload).toMatchObject({ attemptNumber: 2, gameData: { boardSize: 6 } });
	});

	it('game_score_end: value=score, duration đổi ms, best flag vào payload', () => {
		const { sink } = fakeSink();
		const wrapped = wrapSinkWithTracking(sink as never, emit, slug);
		wrapped.gameScoreEnd({
			score: 890,
			durationSec: 61.5,
			attemptNumber: 3,
			isPersonalBest: true,
			reason: 'game_over',
		});
		expect(emitted[0]).toMatchObject({
			action: 'game_score_end',
			ctx: { gameSlug: 'sandfall', value: 890, durationMs: 61500 },
		});
		expect(emitted[0].ctx?.payload).toMatchObject({ isPersonalBest: true, reason: 'game_over' });
	});

	it('game_level_fail: value = progressPercent trong gameData (haredoku)', () => {
		const { sink } = fakeSink();
		const wrapped = wrapSinkWithTracking(sink as never, emit, () => 'haredoku');
		wrapped.gameLevelFail(9, {
			durationSec: 30,
			reason: 'out_of_resource',
			gameData: { progressPercent: 72 },
		});
		expect(emitted[0]).toMatchObject({
			action: 'game_level_fail',
			ctx: { gameSlug: 'haredoku', levelId: 9, durationMs: 30000, value: 72 },
		});
	});

	it('action ghép theo chiều phụ: tutorial_step, share_game_over, booster_used, alt_ad_offered', () => {
		const { sink } = fakeSink();
		const wrapped = wrapSinkWithTracking(sink as never, emit, slug);
		wrapped.tutorial('step', { stepIndex: 1, totalSteps: 2 });
		wrapped.share(-1, { surface: 'game_over', score: 10 });
		wrapped.gameBooster(-1, 'used', { boosterId: 'undo' });
		wrapped.altAd('offered', { taskType: 'free_booster', origin: 'sandfall_undo' });
		expect(emitted.map((e) => e.action)).toEqual([
			'tutorial_step',
			'share_game_over',
			'booster_used',
			'alt_ad_offered',
		]);
		expect(emitted[1].ctx?.value).toBe(10); // share mang score
	});

	it('gameCustomEvent giữ NGUYÊN tên action (catalog chi phối: game_score_heartbeat...)', () => {
		const { sink } = fakeSink();
		const wrapped = wrapSinkWithTracking(sink as never, emit, slug);
		wrapped.gameCustomEvent(-1, 'game_score_heartbeat', { score: 512 });
		expect(emitted[0].action).toBe('game_score_heartbeat');
		expect(emitted[0].ctx).toMatchObject({ value: 512, levelId: undefined });
	});

	it('levelId = NO_LEVEL (-1) → undefined (không gửi -1 lên kho)', () => {
		const { sink } = fakeSink();
		const wrapped = wrapSinkWithTracking(sink as never, emit, slug);
		wrapped.gameLevelStart(-1, {});
		expect(emitted[0].ctx?.levelId).toBeUndefined();
	});

	it('emit nổ → sink gốc VẪN chạy (tracking không được giết metrics cũ)', () => {
		const { sink, calls } = fakeSink();
		const boom: BridgeEmit = () => {
			throw new Error('x');
		};
		const wrapped = wrapSinkWithTracking(sink as never, boom, slug);
		expect(() => wrapped.gameScoreStart({ attemptNumber: 1 })).not.toThrow();
		expect(calls).toEqual(['gameScoreStart']);
	});
});
