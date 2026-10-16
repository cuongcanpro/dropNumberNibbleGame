import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BackKeyManager } from './back-key-manager';

describe('BackKeyManager', () => {
	const mgr = BackKeyManager.getInstance();
	beforeEach(() => mgr.clear());

	it('duyệt từ trên xuống, handler trả true thì dừng', () => {
		const calls: string[] = [];
		mgr.push(() => (calls.push('bottom'), true));
		mgr.push(() => (calls.push('top'), true));
		expect(mgr.dispatch()).toBe(true);
		expect(calls).toEqual(['top']);
	});

	it('handler trả false thì xuống tiếp rồi tới fallback', () => {
		const calls: string[] = [];
		mgr.push(() => (calls.push('a'), false));
		mgr.push(() => (calls.push('b'), false));
		mgr.setFallback(() => (calls.push('fb'), true));
		mgr.dispatch();
		expect(calls).toEqual(['b', 'a', 'fb']);
	});

	it('push trùng được dedupe, remove gỡ handler', () => {
		const h = vi.fn<() => boolean>(() => true);
		mgr.push(h);
		mgr.push(h);
		mgr.remove(h);
		expect(mgr.dispatch()).toBe(false);
		expect(h).not.toHaveBeenCalled();
	});

	it('prune owner đã inactive / rời scene', () => {
		const dead = vi.fn<() => boolean>(() => true);
		mgr.push(dead, { active: false, scene: {} });
		mgr.push(dead, { active: true, scene: undefined });
		expect(mgr.dispatch()).toBe(false);
		expect(dead).not.toHaveBeenCalled();
	});

	it('handler ném lỗi không chặn handler bên dưới', () => {
		vi.spyOn(console, 'error').mockImplementation(() => {});
		const ok = vi.fn<() => boolean>(() => true);
		mgr.push(ok);
		mgr.push(() => {
			throw new Error('x');
		});
		expect(mgr.dispatch()).toBe(true);
		expect(ok).toHaveBeenCalled();
	});
});
