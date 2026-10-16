import { afterEach, describe, expect, it, vi } from 'vitest';

type KeyEvt = { key?: string; repeat?: boolean };

// File riêng: singleton gắn listener `keydown` lúc khởi tạo nên phải stub global TRƯỚC khi import.
describe('BackKeyManager keydown', () => {
	afterEach(() => vi.unstubAllGlobals());

	it('bỏ qua keydown lặp (e.repeat) — giữ Escape không tự đóng dialog vừa mở', async () => {
		let onKey: ((e: KeyEvt) => void) | undefined;
		vi.stubGlobal('addEventListener', (type: string, cb: (e: KeyEvt) => void) => {
			if (type === 'keydown') onKey = cb;
		});
		vi.resetModules();
		const { BackKeyManager } = await import('./back-key-manager');
		const handler = vi.fn<() => boolean>(() => true);
		BackKeyManager.getInstance().push(handler);

		onKey?.({ key: 'Escape' });
		onKey?.({ key: 'Escape', repeat: true });
		onKey?.({ key: 'Escape', repeat: true });
		expect(handler).toHaveBeenCalledTimes(1);
		onKey?.({ key: 'Escape', repeat: false });
		expect(handler).toHaveBeenCalledTimes(2);
	});
});
