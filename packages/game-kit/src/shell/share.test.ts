import { afterEach, describe, expect, it, vi } from 'vitest';
import { createTrackingRig, resetTrackingForTest } from '../testing/tracking-rig';
import { buildShareLink, canShare, shareGame } from './share';

afterEach(() => {
	vi.unstubAllGlobals();
	resetTrackingForTest();
});

describe('buildShareLink', () => {
	it('shape Cocos {g,inv,t} + lvl/c tuỳ chọn', () => {
		expect(JSON.parse(buildShareLink({ gameId: 'onet', inviterId: 42 }, 1000))).toEqual({
			g: 'onet',
			inv: 42,
			t: 1000,
		});
		expect(
			JSON.parse(
				buildShareLink({ gameId: 'onet', inviterId: 'd', level: 7, surface: 'hud' }, 3000),
			),
		).toEqual({ g: 'onet', inv: 'd', lvl: 7, c: 'hud', t: 3000 });
	});
});

describe('shareGame', () => {
	it('không có navigator.share ⇒ unsupported, canShare false', async () => {
		vi.stubGlobal('navigator', {});
		expect(canShare()).toBe(false);
		expect(await shareGame({ gameId: 'g' })).toBe('unsupported');
	});

	it('có share ⇒ shared; inviter mặc định = deviceId, link nằm trong text', async () => {
		createTrackingRig();
		const share = vi.fn<(d: { text: string }) => Promise<void>>(async () => undefined);
		vi.stubGlobal('navigator', { share });
		expect(canShare()).toBe(true);
		expect(await shareGame({ gameId: 'g', text: 'Chơi nè' })).toBe('shared');
		const arg = share.mock.calls[0] as unknown as [{ text: string }];
		const [first, link] = arg[0].text.split('\n');
		expect(first).toBe('Chơi nè');
		expect(JSON.parse(link ?? '')).toMatchObject({ g: 'g', inv: 'dev-1' });
	});

	it('share ném (huỷ/lỗi) ⇒ failed, không ném', async () => {
		vi.stubGlobal('navigator', {
			share: async () => {
				throw new Error('AbortError');
			},
		});
		expect(await shareGame({ gameId: 'g', inviterId: 1 })).toBe('failed');
	});
});
