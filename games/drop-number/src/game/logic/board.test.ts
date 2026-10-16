import { describe, expect, it } from 'vitest';
import { anyDrop, type Board, canDrop, drop, emptyBoard, highestTile, ROWS } from './board';

function play(board: Board, col: number, value: number) {
	const result = drop(board, col, value);
	if (!result) throw new Error(`cannot drop ${value} in column ${col}`);
	return result;
}

const full = (top: number): number[] => [
	...Array.from({ length: ROWS - 1 }, (_, i) => 2 ** (i + 3)),
	top,
];

describe('board', () => {
	it('starts with 5 empty columns', () => {
		expect(emptyBoard()).toEqual([[], [], [], [], []]);
	});

	it('drops a block to the bottom of the column', () => {
		const r = play(emptyBoard(), 2, 4);
		expect(r.landed).toEqual({ col: 2, row: 0 });
		expect(r.board).toEqual([[], [], [4], [], []]);
		expect(r.steps).toEqual([]);
		expect(r.gained).toBe(0);
	});

	it('stacks on top of a different number', () => {
		const r = play([[], [2], [], [], []], 1, 4);
		expect(r.board[1]).toEqual([2, 4]);
	});

	it('merges two equal blocks into double and scores it', () => {
		const r = play([[], [2], [], [], []], 1, 2);
		expect(r.board[1]).toEqual([4]);
		expect(r.gained).toBe(4);
	});

	it('merges sideways into the dropped block', () => {
		const r = play([[4], [], [], [], []], 1, 4);
		expect(r.board).toEqual([[], [8], [], [], []]);
		expect(r.steps[0]?.into).toEqual({ col: 1, row: 0 });
	});

	it('three equal blocks make 4x, four make 8x', () => {
		expect(play([[2], [], [2], [], []], 1, 2).board).toEqual([[], [8], [], [], []]);
		const four = play([[4, 2], [2], [4, 2], [], []], 1, 2);
		expect(four.steps[0]?.value).toBe(16);
		expect(four.board[1]).toEqual([16]);
		expect(four.steps[0]?.into).toEqual({ col: 1, row: 1 });
		expect(four.steps[0]?.at).toEqual({ col: 1, row: 0 });
	});

	it('chains a combo after blocks fall', () => {
		// A 4 dropped on column 1 merges with the 4 on its left into an 8, which then sits on another 8.
		const combo = play([[8, 4], [8], [], [], []], 1, 4);
		expect(combo.steps.map((s) => s.value)).toEqual([8, 16]);
		expect(combo.board).toEqual([[8], [16], [], [], []]);
		expect(combo.gained).toBe(24);
	});

	it('never leaves two equal neighbours after a drop', () => {
		const r = play([[2, 4], [4], [8, 2], [], []], 1, 2);
		for (let c = 0; c < r.board.length; c++) {
			const column = r.board[c] ?? [];
			for (let row = 0; row < column.length; row++) {
				const v = column[row];
				expect(column[row + 1]).not.toBe(v);
				expect(r.board[c + 1]?.[row]).not.toBe(v);
			}
		}
	});

	it('refuses a full column unless its top block matches', () => {
		const board: Board = [full(2), [], [], [], []];
		expect(canDrop(board, 0, 4)).toBe(false);
		expect(drop(board, 0, 4)).toBeNull();
		expect(canDrop(board, 0, 2)).toBe(true);
		const r = play(board, 0, 2);
		expect(r.landed).toEqual({ col: 0, row: ROWS });
		expect(r.board[0]).toHaveLength(ROWS);
		expect(r.board[0]?.[ROWS - 1]).toBe(4);
	});

	it('refuses columns outside the board', () => {
		expect(canDrop(emptyBoard(), 5, 2)).toBe(false);
		expect(canDrop(emptyBoard(), -1, 2)).toBe(false);
	});

	it('knows when no column can take the block', () => {
		const board: Board = [full(2), full(4), full(2), full(4), full(2)];
		expect(anyDrop(board, 8)).toBe(false);
		expect(anyDrop(board, 4)).toBe(true);
	});

	it('finds the highest tile', () => {
		expect(highestTile([[2, 64], [8], [], [], []])).toBe(64);
		expect(highestTile(emptyBoard())).toBe(0);
	});

	it('does not change the board it was given', () => {
		const board: Board = [[2], [], [], [], []];
		play(board, 1, 2);
		expect(board).toEqual([[2], [], [], [], []]);
	});
});
