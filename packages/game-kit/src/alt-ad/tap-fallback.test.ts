import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createTapFallback } from './tap-fallback';

function make() {
	const onShow = vi.fn<() => void>();
	const tf = createTapFallback({
		onShow,
		schedule: (cb, ms) => {
			const id = setTimeout(cb, ms);
			return () => clearTimeout(id);
		},
	});
	return { tf, onShow };
}

describe('tap-fallback', () => {
	beforeEach(() => vi.useFakeTimers());
	afterEach(() => vi.useRealTimers());

	it('hiện sau 5s', () => {
		const { tf, onShow } = make();
		tf.restart();
		vi.advanceTimersByTime(4999);
		expect(onShow).not.toHaveBeenCalled();
		vi.advanceTimersByTime(1);
		expect(onShow).toHaveBeenCalledTimes(1);
		expect(tf.shown).toBe(true);
	});

	it('restart reset đồng hồ 5s', () => {
		const { tf, onShow } = make();
		tf.restart();
		vi.advanceTimersByTime(3000);
		tf.restart();
		vi.advanceTimersByTime(3000);
		expect(onShow).not.toHaveBeenCalled();
		vi.advanceTimersByTime(2000);
		expect(onShow).toHaveBeenCalledTimes(1);
	});

	it('showNow hiện ngay (motion không có) và chỉ một lần', () => {
		const { tf, onShow } = make();
		tf.restart();
		tf.showNow();
		expect(onShow).toHaveBeenCalledTimes(1);
		vi.advanceTimersByTime(10_000);
		expect(onShow).toHaveBeenCalledTimes(1);
	});

	it('cancel chặn hiện', () => {
		const { tf, onShow } = make();
		tf.restart();
		tf.cancel();
		vi.advanceTimersByTime(10_000);
		tf.showNow();
		expect(onShow).not.toHaveBeenCalled();
	});
});
