import { describe, expect, it, vi } from 'vitest';
import { FakeMetricSink } from '../metrics/testing/fake-metric-sink';
import { createAltAdGate, type ShakePopupHandlers } from './alt-ad-gate';

function setup() {
	const sink = new FakeMetricSink();
	let handlers!: ShakePopupHandlers;
	let t = 10_000;
	const gate = createAltAdGate({
		sink,
		now: () => t,
		showPopup: (h) => {
			handlers = h;
		},
	});
	return { sink, gate, h: () => handlers, advance: (ms: number) => (t += ms) };
}
const ctx = { taskType: 'revive', origin: 'grill', levelId: 7 } as const;

describe('alt-ad-gate', () => {
	it('completed: offered rồi completed kèm durationSec, onReward chạy', async () => {
		const { sink, gate, h, advance } = setup();
		const onReward = vi.fn<() => void>();
		const p = gate.open({
			context: ctx,
			rewardUrl: 'u',
			rewardKey: 'k',
			rewardAmount: 2,
			onReward,
		});
		expect(sink.altAds).toEqual([{ action: 'offered', data: { ...ctx } }]);
		expect(h().rewardUrl).toBe('u');
		expect(h().rewardKey).toBe('k');
		expect(h().rewardAmount).toBe(2);
		advance(12_400);
		h().onSuccess();
		await expect(p).resolves.toBe('completed');
		expect(onReward).toHaveBeenCalledOnce();
		expect(sink.altAds[1]).toEqual({ action: 'completed', data: { ...ctx, durationSec: 12 } });
	});

	it.each(['skipped', 'abandoned'] as const)('%s', async (reason) => {
		const { sink, gate, h, advance } = setup();
		const onReward = vi.fn<() => void>();
		const p = gate.open({ context: ctx, onReward });
		advance(3000);
		h().onFail(reason);
		await expect(p).resolves.toBe(reason);
		expect(onReward).not.toHaveBeenCalled();
		expect(sink.altAds.map((a) => a.action)).toEqual(['offered', reason]);
		expect(sink.altAds[1]?.data.durationSec).toBe(3);
	});

	it('onReward ném → error + errorReason + onGrantError', async () => {
		const { sink, gate, h } = setup();
		const onGrantError = vi.fn<() => void>();
		const p = gate.open({
			context: { taskType: 'free_booster' },
			onReward: async () => {
				throw new Error('grant failed');
			},
			onGrantError,
		});
		h().onSuccess();
		await expect(p).resolves.toBe('error');
		expect(onGrantError).toHaveBeenCalledOnce();
		expect(sink.altAds[1]?.action).toBe('error');
		expect(sink.altAds[1]?.data.errorReason).toBe('grant failed');
	});

	it('popup gọi nhiều lần chỉ emit một outcome', async () => {
		const { sink, gate, h } = setup();
		const p = gate.open({ context: ctx, onReward: () => {} });
		h().onFail('skipped');
		h().onFail('abandoned');
		h().onSuccess();
		await p;
		expect(sink.altAds.map((a) => a.action)).toEqual(['offered', 'skipped']);
	});
});
