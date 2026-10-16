import { describe, expect, it } from 'vitest';
import { type Board, emptyBoard, ROWS } from './board';
import { fall, fallSpeed, moveTo, SLAM_SPEED, spawn, spawnColumn, tap } from './falling';

const full = Array.from({ length: ROWS }, (_, i) => 2 ** (i + 2));

describe('falling block', () => {
	it('falls slowly at first and faster as the score grows, up to a cap', () => {
		expect(fallSpeed(0)).toBe(0.5);
		expect(fallSpeed(500)).toBeCloseTo(0.75);
		expect(fallSpeed(1500)).toBeCloseTo(1);
		expect(fallSpeed(7500)).toBeCloseTo(1.5);
		expect(fallSpeed(1e12)).toBe(3);
		expect(fallSpeed(2000)).toBeGreaterThan(fallSpeed(1000));
	});

	it('spawns above the middle column, or the nearest column with room', () => {
		expect(spawn(emptyBoard())).toEqual({ col: 2, y: ROWS, slam: false });
		expect(spawnColumn([[], [], full, [], []])).toBe(1);
		expect(spawnColumn([[], full, full, [], []])).toBe(3);
		expect(spawnColumn([full, full, full, full, full])).toBe(2);
	});

	it('sinks by speed x time and lands on top of the stack', () => {
		const board: Board = [[], [], [2, 4], [], []];
		const step = fall({ col: 2, y: ROWS, slam: false }, board, 1000, 2);
		expect(step).toEqual({ faller: { col: 2, y: ROWS - 2, slam: false }, landed: false });
		const landed = fall({ col: 2, y: 2.3, slam: false }, board, 1000, 2);
		expect(landed).toEqual({ faller: { col: 2, y: 2, slam: false }, landed: true });
	});

	it('a full column lands the block at once, above the board', () => {
		const step = fall({ col: 0, y: ROWS, slam: false }, [full, [], [], [], []], 16, 0.5);
		expect(step.landed).toBe(true);
		expect(step.faller.y).toBe(ROWS);
	});

	it('a tap moves the block and slams it down', () => {
		const moved = moveTo({ col: 2, y: 5, slam: false }, emptyBoard(), 0);
		expect(moved).toEqual({ col: 0, y: 5, slam: true });
		const step = fall(moved as NonNullable<typeof moved>, emptyBoard(), 100, 0.5);
		expect(step.faller.y).toBeCloseTo(5 - SLAM_SPEED * 0.1);
	});

	it('cannot pass a stack taller than the block', () => {
		const board: Board = [[], [2, 4, 8, 16], [], [], []];
		expect(moveTo({ col: 2, y: 3.5, slam: false }, board, 0)).toBeNull();
		expect(moveTo({ col: 2, y: 3.5, slam: false }, board, 1)).toBeNull();
		expect(moveTo({ col: 2, y: 4, slam: false }, board, 0)?.col).toBe(0);
		expect(moveTo({ col: 2, y: 3.5, slam: false }, board, 4)?.col).toBe(4);
	});

	it('a tap on a full column whose top differs ends the round', () => {
		const board: Board = [[], full, [], [], []];
		expect(tap({ col: 2, y: 3, slam: false }, board, 1, 2)).toEqual({ kind: 'over' });
	});

	it('a tap on a full column with the same top still moves when the block is above it', () => {
		const board: Board = [[], full, [], [], []];
		const top = full[ROWS - 1] as number;
		expect(tap({ col: 2, y: ROWS, slam: false }, board, 1, top)).toEqual({
			kind: 'move',
			faller: { col: 1, y: ROWS, slam: true },
		});
		expect(tap({ col: 2, y: 3, slam: false }, board, 1, top)).toEqual({ kind: 'ignored' });
	});

	it('a tap blocked by a taller stack (column not full) is ignored', () => {
		const board: Board = [[], [2, 4, 8, 16], [], [], []];
		expect(tap({ col: 2, y: 3.5, slam: false }, board, 0, 2)).toEqual({ kind: 'ignored' });
		expect(tap({ col: 2, y: 3.5, slam: false }, board, 3, 2).kind).toBe('move');
	});

	it('tapping its own column just slams it; outside the board is refused', () => {
		expect(moveTo({ col: 2, y: 6, slam: false }, emptyBoard(), 2)).toEqual({
			col: 2,
			y: 6,
			slam: true,
		});
		expect(moveTo({ col: 2, y: 6, slam: false }, emptyBoard(), 5)).toBeNull();
	});
});
