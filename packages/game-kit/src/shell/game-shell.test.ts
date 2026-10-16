import { afterEach, describe, expect, it, vi } from 'vitest';
import { createTrackingRig, resetTrackingForTest } from '../testing/tracking-rig';
import { getGameMode, getGameSlug } from '../tracking/game-context';
import { flushNow } from '../tracking/track';

const exitMock = vi.hoisted(() => vi.fn<() => void>());
vi.mock('nibi', () => ({ exit: exitMock }));

import { exitToHost, markGameOpen } from './game-shell';

afterEach(() => {
	resetTrackingForTest();
	exitMock.mockReset();
});

const actionsOf = (rig: ReturnType<typeof createTrackingRig>) =>
	rig.sent.flatMap((b) => b.body.events.map((e) => e['action']));

describe('game-shell (mock nibi)', () => {
	it('markGameOpen đặt context + phát game_open; exitToHost gửi game_exit trước exit()', async () => {
		const rig = createTrackingRig();
		markGameOpen('sandfall', 'Hard');
		expect(getGameSlug()).toBe('sandfall');
		expect(getGameMode()).toBe('hard');
		await exitToHost();
		const actions = rig.sent.flatMap((b) => b.body.events.map((e) => e['action']));
		expect(actions).toEqual(expect.arrayContaining(['game_open', 'game_exit']));
		expect(rig.sent.at(-1)?.body.events.some((e) => e['action'] === 'game_exit')).toBe(true);
		expect(exitMock).toHaveBeenCalledTimes(1);
	});

	it('chưa open ⇒ không game_exit lẻ, vẫn exit()', async () => {
		const rig = createTrackingRig();
		await exitToHost();
		expect(rig.sent.flatMap((b) => b.body.events).some((e) => e['action'] === 'game_exit')).toBe(
			false,
		);
		expect(exitMock).toHaveBeenCalledTimes(1);
	});

	it('markGameOpen lần 2 cùng slug: chỉ đổi mode, không game_open thứ hai', async () => {
		const rig = createTrackingRig();
		markGameOpen('sandfall', 'easy');
		markGameOpen('sandfall', 'hard');
		expect(getGameMode()).toBe('hard');
		await flushNow();
		expect(actionsOf(rig).filter((a) => a === 'game_open')).toHaveLength(1);
		expect(actionsOf(rig)).not.toContain('game_exit');
	});

	it('markGameOpen slug khác: game_exit phiên cũ rồi game_open mới', async () => {
		const rig = createTrackingRig();
		markGameOpen('sandfall');
		markGameOpen('onet');
		expect(getGameSlug()).toBe('onet');
		await flushNow();
		expect(actionsOf(rig).filter((a) => a === 'game_open' || a === 'game_exit')).toEqual([
			'game_open',
			'game_exit',
			'game_open',
		]);
	});
});
