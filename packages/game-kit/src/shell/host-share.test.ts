import { afterEach, describe, expect, it, vi } from 'vitest';
import type { HostChannel } from '../tracking/host-identity';
import { attachShareHost, resetHostShareForTest } from './host-share';
import { canShare, shareGame } from './share';

function rig() {
	const posted: Record<string, unknown>[] = [];
	let listener: ((d: unknown) => void) | undefined;
	const channel: HostChannel = {
		post: (d) => void posted.push(d as Record<string, unknown>),
		onMessage: (cb) => {
			listener = cb;
		},
	};
	attachShareHost(channel);
	const send = (d: unknown) => listener?.(d);
	const advertise = () =>
		send({ type: 'nv.identity.v1', deviceId: 'x', capabilities: { share: true } });
	return { posted, send, advertise };
}

afterEach(() => {
	vi.useRealTimers();
	vi.unstubAllGlobals();
	resetHostShareForTest();
});

describe('share qua launcher (kênh host)', () => {
	it('chưa quảng bá ⇒ canShare false, shareGame unsupported, không post gì', async () => {
		vi.stubGlobal('navigator', {});
		const { posted, send } = rig();
		send({ type: 'nv.identity.v1', deviceId: 'x' }); // launcher cũ: không có capabilities
		expect(canShare()).toBe(false);
		expect(await shareGame({ gameId: 'g' })).toBe('unsupported');
		expect(posted).toEqual([]);
	});

	it('capabilities.share=true ⇒ canShare true, kể cả tới muộn', () => {
		vi.stubGlobal('navigator', {});
		const { advertise, send } = rig();
		expect(canShare()).toBe(false);
		advertise();
		expect(canShare()).toBe(true);
		send({ type: 'nv.identity.v1', deviceId: 'x', capabilities: { share: 'yes' } });
		expect(canShare()).toBe(false); // chỉ `true` thật mới bật
	});

	it('shared: post nv.share.v1 đủ trường, nhận result đúng id', async () => {
		vi.stubGlobal('navigator', {});
		const { posted, send, advertise } = rig();
		advertise();
		const p = shareGame({ gameId: 'g', inviterId: 7, text: 'Chơi nè', level: 3 });
		const req = posted[0] as { type: string; id: string; title: string; text: string; url: string };
		expect(req.type).toBe('nv.share.v1');
		expect(req.text).toBe('Chơi nè');
		expect(JSON.parse(req.url)).toMatchObject({ g: 'g', inv: 7, lvl: 3 });
		send({ type: 'nv.share.result.v1', id: 'khac', result: 'shared' }); // id lạ bị bỏ
		send({ type: 'nv.share.result.v1', id: req.id, result: 'shared' });
		expect(await p).toBe('shared');
	});

	it('dismissed / failed / result rác ⇒ failed', async () => {
		vi.stubGlobal('navigator', {});
		const { posted, send, advertise } = rig();
		advertise();
		for (const [i, result] of ['dismissed', 'failed', 'banana'].entries()) {
			const p = shareGame({ gameId: 'g', inviterId: 1 });
			send({ type: 'nv.share.result.v1', id: (posted[i] as { id: string }).id, result });
			expect(await p).toBe('failed');
		}
	});

	it('launcher không trả lời ⇒ failed sau 60s', async () => {
		vi.useFakeTimers();
		vi.stubGlobal('navigator', {});
		rig().advertise();
		const p = shareGame({ gameId: 'g', inviterId: 1 });
		await vi.advanceTimersByTimeAsync(59_999);
		let settled = false;
		void p.then(() => {
			settled = true;
		});
		await Promise.resolve();
		expect(settled).toBe(false);
		await vi.advanceTimersByTimeAsync(1);
		expect(await p).toBe('failed');
	});

	it('post ném ⇒ failed, không ném', async () => {
		vi.stubGlobal('navigator', {});
		attachShareHost({
			post: () => {
				throw new Error('port closed');
			},
			onMessage: (cb) => cb({ type: 'nv.identity.v1', capabilities: { share: true } }),
		});
		expect(await shareGame({ gameId: 'g', inviterId: 1 })).toBe('failed');
	});

	it('web có navigator.share: dùng nó, không đụng host', async () => {
		const share = vi.fn<(d: { text: string }) => Promise<void>>(async () => undefined);
		vi.stubGlobal('navigator', { share });
		const { posted, advertise } = rig();
		advertise();
		expect(await shareGame({ gameId: 'g', inviterId: 1 })).toBe('shared');
		expect(share).toHaveBeenCalledOnce();
		expect(posted).toEqual([]);
	});
});
