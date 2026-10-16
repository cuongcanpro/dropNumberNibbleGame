import { describe, expect, it } from 'vitest';
import type { MetricSink } from '../metrics/metric-sink';
import { type BridgeEmit, wrapSinkWithTracking } from './sink-bridge';
import type { EmitCtx } from './types';

const noopSink = (): MetricSink => new Proxy({} as MetricSink, { get: () => () => undefined });

const capture = (): {
	calls: { action: string; ctx?: EmitCtx | undefined }[];
	emit: BridgeEmit;
} => {
	const calls: { action: string; ctx?: EmitCtx | undefined }[] = [];
	return { calls, emit: (action, ctx) => calls.push({ action, ctx }) };
};

describe('sink-bridge — mode', () => {
	it('game nhiều mode ⇒ mọi event mang mode đang chơi', () => {
		const { calls, emit } = capture();
		const s = wrapSinkWithTracking(
			noopSink(),
			emit,
			() => 'blockblast',
			() => 'adventure',
		);
		s.gameLevelComplete(3, { durationSec: 5 } as never);
		expect(calls[0]?.ctx?.mode).toBe('adventure');
	});

	it('game MỘT mode không khai gì ⇒ mode undefined, không phải chuỗi rác', () => {
		const { calls, emit } = capture();
		const s = wrapSinkWithTracking(noopSink(), emit, () => 'sandfall');
		s.gameScoreEnd({ score: 100 } as never);
		expect(calls[0]?.ctx?.mode).toBeUndefined();
	});

	it('mode rỗng ⇒ undefined: rỗng và "chưa khai" là một, đừng tạo mode tên ""', () => {
		const { calls, emit } = capture();
		const s = wrapSinkWithTracking(
			noopSink(),
			emit,
			() => 'blockblast',
			() => '',
		);
		s.gameScoreEnd({ score: 1 } as never);
		expect(calls[0]?.ctx?.mode).toBeUndefined();
	});

	it('ctx của game KHÔNG đè được mode — mode do một nguồn quyết định', () => {
		const { calls, emit } = capture();
		const s = wrapSinkWithTracking(
			noopSink(),
			emit,
			() => 'blockblast',
			() => 'classic',
		);
		s.gameCustomEvent(1, 'combo', { mode: 'gian-lan' } as never);
		expect(calls[0]?.ctx?.mode).toBe('classic');
	});
});
