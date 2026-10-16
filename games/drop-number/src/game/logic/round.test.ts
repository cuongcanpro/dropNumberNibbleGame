import { describe, expect, it } from 'vitest';
import { type Board, ROWS } from './board';
import { formatValue, newRound, nextValue, play, type RoundState, spawnChoices } from './round';

const always = (n: number) => () => n;
/** A full column of distinct powers of two, starting at 4 << shift. */
const col = (shift: number) => Array.from({ length: ROWS }, (_, i) => 2 ** (i + 2 + shift));

function state(over: Partial<RoundState>): RoundState {
	return { ...newRound(always(0)), ...over };
}

describe('round', () => {
	it('starts empty with 2s in hand when the rng rolls low', () => {
		const r = newRound(always(0));
		expect(r).toMatchObject({ score: 0, maxTile: 0, over: false, current: 2, next: 2 });
		expect(r.board).toEqual([[], [], [], [], []]);
	});

	it('new blocks start at 2..8 and grow with the best block, up to 64', () => {
		expect(spawnChoices(0)).toEqual([2, 4, 8]);
		expect(spawnChoices(128)).toEqual([2, 4, 8, 16]);
		expect(spawnChoices(1024)).toEqual([2, 4, 8, 16, 32, 64]);
		expect(spawnChoices(1 << 20)).toEqual([2, 4, 8, 16, 32, 64]);
	});

	it('small blocks are more likely than big ones', () => {
		// 3 choices, weights 3:2:1 over 6.
		expect(nextValue(0, always(0))).toBe(2);
		expect(nextValue(0, always(2.99 / 6))).toBe(2);
		expect(nextValue(0, always(3 / 6))).toBe(4);
		expect(nextValue(0, always(5 / 6))).toBe(8);
		expect(nextValue(0, always(0.9999))).toBe(8);
	});

	it('a drop moves next into hand, draws a new next and scores merges', () => {
		const start = state({ board: [[], [4], [], [], []], current: 4, next: 8 });
		const move = play(start, 1, always(0));
		expect(move?.state).toMatchObject({ current: 8, next: 2, score: 8, maxTile: 8, over: false });
		expect(move?.state.board[1]).toEqual([8]);
	});

	it('ignores a column that cannot take the block', () => {
		const full = Array.from({ length: ROWS }, (_, i) => 2 ** (i + 2));
		const start = state({ board: [full, [], [], [], []], current: 2 });
		expect(play(start, 0, always(0))).toBeNull();
	});

	it('is over when no column can take the next block', () => {
		// Every column full; column 4 has one free slot that the drop fills.
		const board: Board = [col(0), col(1), col(0), col(1), col(0).slice(0, ROWS - 1)];
		const start = state({ board, current: 2, next: 4 });
		const move = play(start, 4, always(0));
		expect(move?.state.over).toBe(true);
		expect(play(move?.state as RoundState, 0, always(0))).toBeNull();
	});

	it('keeps going when a full column tops out with the next block', () => {
		const board: Board = [col(0), col(1), col(0), col(1), col(0).slice(0, ROWS - 1)];
		// Column 1 tops out at 512: a 512 in hand can still go there.
		const start = state({ board, current: 2, next: 512 });
		expect(play(start, 4, always(0))?.state.over).toBe(false);
	});

	it('labels big blocks short', () => {
		expect(formatValue(2)).toBe('2');
		expect(formatValue(8192)).toBe('8192');
		expect(formatValue(16384)).toBe('16K');
		expect(formatValue(1 << 20)).toBe('1024K');
		expect(formatValue(1 << 24)).toBe('16M');
	});
});
