/**
 * The falling block: it starts above the board and sinks at a speed that grows with the score. A tap moves
 * it to another column (only over stacks it is still above) and slams it down. Pure TypeScript.
 */
import { type Board, COLS, ROWS } from './board';

export interface Faller {
	readonly col: number;
	/** Height of the block's bottom, in rows from the floor (0 = bottom cell). Starts at `ROWS`. */
	readonly y: number;
	/** Slammed down by a tap: falls at `SLAM_SPEED`. */
	readonly slam: boolean;
}

/** Rows per second once tapped. */
export const SLAM_SPEED = 28;

/** Rows per second: 0.5 at 0 points, then +0.25 each time the score (+500) doubles, at most 3. */
export function fallSpeed(score: number): number {
	return Math.min(3, 0.5 + 0.25 * Math.log2(1 + Math.max(0, score) / 500));
}

/** The middle column, or the nearest one with room when it is full. */
export function spawnColumn(board: Board): number {
	const mid = Math.floor(COLS / 2);
	for (let d = 0; d < COLS; d++) {
		for (const col of [mid - d, mid + d]) {
			const column = board[col];
			if (column && column.length < ROWS) return col;
		}
	}
	return mid;
}

export function spawn(board: Board): Faller {
	return { col: spawnColumn(board), y: ROWS, slam: false };
}

/** Moves to `col` when every column on the way (target included) is still below the block. */
export function moveTo(faller: Faller, board: Board, col: number): Faller | null {
	if (col < 0 || col >= COLS) return null;
	const [from, to] = faller.col < col ? [faller.col, col] : [col, faller.col];
	for (let c = from; c <= to; c++) {
		if ((board[c]?.length ?? 0) > faller.y) return null;
	}
	return { col, y: faller.y, slam: true };
}

export type Tap =
	| { readonly kind: 'move'; readonly faller: Faller }
	/** The column is full and its top block differs: a wrong choice that ends the round. */
	| { readonly kind: 'over' }
	/** A taller stack is in the way: the tap does nothing. */
	| { readonly kind: 'ignored' };

/** What a tap on `col` does to the falling block holding `value`. */
export function tap(faller: Faller, board: Board, col: number, value: number): Tap {
	const column = board[col];
	if (column && column.length >= ROWS && column[column.length - 1] !== value) {
		return { kind: 'over' };
	}
	const moved = moveTo(faller, board, col);
	return moved ? { kind: 'move', faller: moved } : { kind: 'ignored' };
}

export interface FallStep {
	readonly faller: Faller;
	/** The block reached the top of its column's stack. */
	readonly landed: boolean;
}

export function fall(faller: Faller, board: Board, dtMs: number, speed: number): FallStep {
	const floor = board[faller.col]?.length ?? 0;
	const y = faller.y - ((faller.slam ? SLAM_SPEED : speed) * dtMs) / 1000;
	if (y <= floor) return { faller: { ...faller, y: floor }, landed: true };
	return { faller: { ...faller, y }, landed: false };
}
