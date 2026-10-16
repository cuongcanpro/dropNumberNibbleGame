/**
 * One round of Drop Number: the board, the block in hand and the next one, the score. Rules live in
 * `logic/`: plain TypeScript with no Phaser, DOM, nibi or kit imports, so Vitest runs it under Node.
 */
import { type Board, type DropResult, drop, emptyBoard, highestTile } from './board';

/** Returns a number in [0, 1), like `Math.random`. */
export type Rng = () => number;

export interface RoundState {
	readonly board: Board;
	readonly current: number;
	readonly next: number;
	readonly score: number;
	/** Highest block made this round; it unlocks bigger new blocks. */
	readonly maxTile: number;
	readonly over: boolean;
}

/** New blocks run from 2 up to an eighth of the best block, at least 8 and at most 64. */
export function spawnChoices(maxTile: number): number[] {
	const top = Math.min(64, Math.max(8, maxTile / 8));
	const choices: number[] = [];
	for (let v = 2; v <= top; v *= 2) choices.push(v);
	return choices;
}

/** Smaller blocks come more often: with n choices the i-th (from 0) has weight n - i. */
export function nextValue(maxTile: number, rng: Rng): number {
	const choices = spawnChoices(maxTile);
	const n = choices.length;
	const total = (n * (n + 1)) / 2;
	let pick = rng() * total;
	for (let i = 0; i < n; i++) {
		pick -= n - i;
		if (pick < 0) return choices[i] as number;
	}
	return choices[n - 1] as number;
}

export function newRound(rng: Rng): RoundState {
	return {
		board: emptyBoard(),
		current: nextValue(0, rng),
		next: nextValue(0, rng),
		score: 0,
		maxTile: 0,
		over: false,
	};
}

export interface Move {
	readonly state: RoundState;
	/** Null when the block landed on a full column it can't merge with: the round is over. */
	readonly result: DropResult | null;
}

/** The falling block lands in `col`. Null once the round is over. */
export function play(state: RoundState, col: number, rng: Rng): Move | null {
	if (state.over) return null;
	const result = drop(state.board, col, state.current);
	if (!result) return { result: null, state: { ...state, over: true } };
	const maxTile = Math.max(state.maxTile, state.current, highestTile(result.board));
	const current = state.next;
	return {
		result,
		state: {
			board: result.board,
			current,
			next: nextValue(maxTile, rng),
			score: state.score + result.gained,
			maxTile,
			over: false,
		},
	};
}

/** Short label for a block: 2 … 8192, then 16K, 32K … */
export function formatValue(value: number): string {
	if (value < 10000) return String(value);
	if (value < 10_000_000) return `${Math.floor(value / 1024)}K`;
	return `${Math.floor(value / 1_048_576)}M`;
}
