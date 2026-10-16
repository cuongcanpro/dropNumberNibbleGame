import { afterEach, describe, expect, it, vi } from 'vitest';
import { EXIT_FLUSH_TIMEOUT_MS, runExitSequence } from './exit-sequence';

afterEach(() => vi.useRealTimers());

describe('runExitSequence', () => {
	it('thứ tự recordQuit → game_exit → flush xong → exit', async () => {
		const log: string[] = [];
		await runExitSequence({
			recordQuit: () => log.push('quit'),
			emitGameExit: () => log.push('game_exit'),
			flush: async () => {
				await Promise.resolve();
				log.push('flush');
			},
			exit: () => log.push('exit'),
		});
		expect(log).toEqual(['quit', 'game_exit', 'flush', 'exit']);
	});

	it('flush treo ⇒ exit sau đúng 1.5s, không sớm hơn', async () => {
		vi.useFakeTimers();
		const exit = vi.fn<() => void>();
		const p = runExitSequence({
			emitGameExit: () => undefined,
			flush: () => new Promise(() => undefined),
			exit,
		});
		await vi.advanceTimersByTimeAsync(EXIT_FLUSH_TIMEOUT_MS - 1);
		expect(exit).not.toHaveBeenCalled();
		await vi.advanceTimersByTimeAsync(1);
		await p;
		expect(exit).toHaveBeenCalledTimes(1);
	});

	it('mọi bước ném lỗi vẫn gọi exit, không ném ra caller', async () => {
		const exit = vi.fn<() => void>();
		await expect(
			runExitSequence({
				recordQuit: () => {
					throw new Error('a');
				},
				emitGameExit: () => {
					throw new Error('b');
				},
				flush: () => Promise.reject(new Error('c')),
				exit,
			}),
		).resolves.toBeUndefined();
		expect(exit).toHaveBeenCalledTimes(1);
	});
});
