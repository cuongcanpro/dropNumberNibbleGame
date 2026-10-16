/**
 * Drop Number board: 5 columns of up to 7 blocks. A dropped block merges with equal neighbours
 * (left, right, below, above): k neighbours turn value v into v * 2^k, then everything falls and the
 * blocks that moved try again (combo). Pure TypeScript, no Phaser.
 */
export const COLS = 5;
export const ROWS = 7;

/** Columns left to right; each column lists its blocks bottom first. */
export type Board = readonly (readonly number[])[];

export interface Cell {
	readonly col: number;
	readonly row: number;
}

export interface MergeStep {
	/** Where the merged block sits before falling. */
	readonly into: Cell;
	/** Blocks absorbed into it. */
	readonly from: readonly Cell[];
	readonly value: number;
	/** Where the merged block rests after the fall. */
	readonly at: Cell;
	/** Board after this merge and the fall that follows. */
	readonly board: Board;
}

export interface DropResult {
	/** Where the block lands; `row === ROWS` when it lands on top of a full column it merges with. */
	readonly landed: Cell;
	readonly steps: readonly MergeStep[];
	readonly board: Board;
	/** Points: the sum of every value a merge created. */
	readonly gained: number;
}

export function emptyBoard(): Board {
	return Array.from({ length: COLS }, () => []);
}

/** A column takes a block while it has room, or when full if its top block has the same value. */
export function canDrop(board: Board, col: number, value: number): boolean {
	const column = board[col];
	if (!column) return false;
	return column.length < ROWS || column[column.length - 1] === value;
}

export function anyDrop(board: Board, value: number): boolean {
	return board.some((_, col) => canDrop(board, col, value));
}

export function highestTile(board: Board): number {
	let max = 0;
	for (const column of board) for (const v of column) max = Math.max(max, v);
	return max;
}

const NEIGHBOURS: readonly Cell[] = [
	{ col: -1, row: 0 },
	{ col: 1, row: 0 },
	{ col: 0, row: -1 },
	{ col: 0, row: 1 },
];

function allCells(cols: readonly (readonly number[])[]): Cell[] {
	const cells: Cell[] = [];
	cols.forEach((column, col) => {
		column.forEach((_, row) => {
			cells.push({ col, row });
		});
	});
	return cells;
}

/** Returns null when the column can't take the block. */
export function drop(board: Board, col: number, value: number): DropResult | null {
	if (!canDrop(board, col, value)) return null;
	const cols = board.map((column) => [...column]);
	const target = cols[col] as number[];
	const landed: Cell = { col, row: target.length };
	target.push(value);

	const steps: MergeStep[] = [];
	let gained = 0;
	let active: Cell[] = [landed];
	const at = (c: Cell): number | undefined => cols[c.col]?.[c.row];

	for (;;) {
		let merge: { into: Cell; from: Cell[]; value: number } | null = null;
		for (const cell of active) {
			const v = at(cell);
			if (v === undefined) continue;
			const from = NEIGHBOURS.map((d) => ({ col: cell.col + d.col, row: cell.row + d.row })).filter(
				(n) => at(n) === v,
			);
			if (from.length > 0) {
				merge = { into: cell, from, value: v * 2 ** from.length };
				break;
			}
		}
		if (!merge) break;

		// 0 marks a removed block until the fall below compacts the columns.
		(cols[merge.into.col] as number[])[merge.into.row] = merge.value;
		for (const m of merge.from) (cols[m.col] as number[])[m.row] = 0;
		gained += merge.value;

		const moved: Cell[] = [];
		let intoAfter: Cell = merge.into;
		for (let c = 0; c < COLS; c++) {
			const column = cols[c] as number[];
			const kept: number[] = [];
			column.forEach((v, row) => {
				if (v === 0) return;
				const newRow = kept.length;
				kept.push(v);
				if (c === merge.into.col && row === merge.into.row) intoAfter = { col: c, row: newRow };
				else if (newRow !== row) moved.push({ col: c, row: newRow });
			});
			cols[c] = kept;
		}
		// The merged block and the blocks that fell go first so a combo centres on them; then every cell, so the
		// board never rests with two equal neighbours.
		active = [
			intoAfter,
			...moved.sort((a, b) => a.row - b.row || a.col - b.col),
			...allCells(cols),
		];
		steps.push({
			into: merge.into,
			from: merge.from,
			value: merge.value,
			at: intoAfter,
			board: cols.map((column) => [...column]),
		});
	}

	return { landed, steps, board: cols, gained };
}
