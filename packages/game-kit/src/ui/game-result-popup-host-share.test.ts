import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('nibi', () => ({ primaryCanvas: { width: 720, height: 1280 } }));

const { attachShareHost, resetHostShareForTest } = await import('../shell/host-share');
const { GameResultPopup } = await import('./game-result-popup');
const { asScene, FakeScene } = await import('./testing/fake-scene');

afterEach(() => {
	resetHostShareForTest();
	vi.unstubAllGlobals();
});

describe('GameResultPopup + share qua launcher', () => {
	it('Share hiện khi launcher quảng bá, kể cả tới sau lúc dựng popup (đánh giá lại mỗi show)', () => {
		vi.stubGlobal('navigator', {});
		let send: ((d: unknown) => void) | undefined;
		attachShareHost({
			post: () => undefined,
			onMessage: (cb) => {
				send = cb;
			},
		});
		const scene = new FakeScene();
		const popup = new GameResultPopup(asScene(scene), {
			onReplay: vi.fn<() => void>(),
			onShare: vi.fn<() => void>(),
		});
		popup.show({ score: 1 });
		expect(popup.getShareButton()).toBeNull(); // chưa quảng bá

		send?.({ type: 'nv.identity.v1', capabilities: { share: true } });
		const scene2 = new FakeScene();
		const popup2 = new GameResultPopup(asScene(scene2), {
			onReplay: vi.fn<() => void>(),
			onShare: vi.fn<() => void>(),
		});
		popup2.show({ score: 1 });
		expect(popup2.getShareButton()).not.toBeNull();
		expect(scene2.texts()).toContain('Share');
	});
});
