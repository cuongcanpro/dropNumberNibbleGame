import { describe, expect, it, vi } from 'vitest';

vi.mock('nibi', () => ({ host: { postMessage: vi.fn<(d: unknown) => void>() } }));

const { LOADING_DONE, loadingDoneMessage, postHostSignal } = await import('./host-signal');

describe('loadingDoneMessage', () => {
	it('làm tròn ms, không âm', () => {
		expect(loadingDoneMessage(1234.6, 5678.2)).toEqual({
			type: LOADING_DONE,
			loadMs: 1235,
			jsMs: 5678,
		});
		expect(loadingDoneMessage(-3, 0).loadMs).toBe(0);
	});
	it('runtime không có performance.now ⇒ jsMs = -1', () => {
		expect(loadingDoneMessage(10, undefined).jsMs).toBe(-1);
	});
});

describe('postHostSignal', () => {
	it('gửi qua post được truyền vào', () => {
		const post = vi.fn<(d: unknown) => void>();
		postHostSignal({ type: 'x' }, post);
		expect(post).toHaveBeenCalledWith({ type: 'x' });
	});
	it('post ném lỗi ⇒ nuốt, không làm hỏng việc vào game', () => {
		expect(() =>
			postHostSignal({ type: 'x' }, () => {
				throw new Error('closed');
			}),
		).not.toThrow();
	});
});
