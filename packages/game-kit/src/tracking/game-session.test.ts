/* oxlint-disable vitest/require-mock-type-parameters -- test port từ Cocos, giữ cấu trúc để đối chiếu */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
	emitGameExit,
	emitGameOpen,
	emitSessionStart,
	resetGameSessionForTest,
} from './game-session';

describe('game-session — vòng đời phiên', () => {
	beforeEach(() => resetGameSessionForTest());

	it('session_start bắn trần, không kèm game', () => {
		const e = vi.fn();
		emitSessionStart(e);
		expect(e).toHaveBeenCalledWith('session_start');
	});

	it('game_open kèm slug; game_exit kèm slug + thời lượng', () => {
		const e = vi.fn();
		let t = 1000;
		emitGameOpen('haredoku', undefined, e, () => t);
		t = 4500;
		emitGameExit(e, () => t);
		expect(e).toHaveBeenNthCalledWith(1, 'game_open', { gameSlug: 'haredoku' });
		expect(e).toHaveBeenNthCalledWith(2, 'game_exit', { gameSlug: 'haredoku', durationMs: 3500 });
	});

	it('slug rỗng → không bắn, thà thiếu còn hơn ghi rác', () => {
		const e = vi.fn();
		emitGameOpen('', undefined, e);
		expect(e).not.toHaveBeenCalled();
	});

	it('game_exit khi chưa mở game nào → bỏ qua, không sinh exit lẻ', () => {
		const e = vi.fn();
		emitGameExit(e);
		expect(e).not.toHaveBeenCalled();
	});

	it('exit hai lần liên tiếp chỉ tính một lần', () => {
		const e = vi.fn();
		emitGameOpen('sandfall', undefined, e, () => 0);
		emitGameExit(e, () => 100);
		emitGameExit(e, () => 200);
		expect(e).toHaveBeenCalledTimes(2); // open + đúng 1 exit
	});

	it('đồng hồ chạy lùi không tạo thời lượng âm', () => {
		const e = vi.fn();
		emitGameOpen('onet', undefined, e, () => 5000);
		emitGameExit(e, () => 1000);
		expect(e).toHaveBeenLastCalledWith('game_exit', { gameSlug: 'onet', durationMs: 0 });
	});

	it('open lại cùng slug chỉ đổi mode, không game_open kép', () => {
		const e = vi.fn();
		emitGameOpen('onet', 'easy', e, () => 0);
		emitGameOpen('onet', 'hard', e, () => 10);
		expect(e).toHaveBeenCalledTimes(1);
		emitGameExit(e, () => 50);
		expect(e).toHaveBeenLastCalledWith('game_exit', { gameSlug: 'onet', durationMs: 50 });
	});

	it('open slug khác: đóng phiên cũ trước (exit rồi open)', () => {
		const e = vi.fn();
		emitGameOpen('a', undefined, e, () => 100);
		emitGameOpen('b', undefined, e, () => 400);
		expect(e.mock.calls.map((c) => c[0])).toEqual(['game_open', 'game_exit', 'game_open']);
		expect(e).toHaveBeenNthCalledWith(2, 'game_exit', { gameSlug: 'a', durationMs: 300 });
	});
});
