import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LocalStorage } from './local-storage';

describe('LocalStorage', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		LocalStorage.clear();
	});
	afterEach(() => vi.useRealTimers());

	it('JSON roundtrip + default khi thiếu/hỏng', () => {
		LocalStorage.set('a', { x: 1 });
		expect(LocalStorage.get('a')).toEqual({ x: 1 });
		expect(LocalStorage.get('missing', 7)).toBe(7);
		localStorage.setItem('bad', '{oops');
		expect(LocalStorage.get('bad', 'def')).toBe('def');
	});

	it('TTL: init() xoá key đã hết hạn, giữ key còn hạn', () => {
		LocalStorage.set('short', 1, 10);
		LocalStorage.set('long', 2, 100);
		vi.advanceTimersByTime(11_000);
		LocalStorage.init();
		expect(LocalStorage.get('short')).toBeUndefined();
		expect(LocalStorage.get('long')).toBe(2);
	});

	it('storage ném lỗi thì rơi về RAM, không crash', () => {
		// MemoryStorage trong test không có global `Storage`; ghi đè method của instance.
		const orig = localStorage.setItem;
		localStorage.setItem = () => {
			throw new Error('quota');
		};
		try {
			expect(() => LocalStorage.set('r', 5)).not.toThrow();
			expect(LocalStorage.get('r')).toBe(5);
		} finally {
			localStorage.setItem = orig;
		}
	});
});
