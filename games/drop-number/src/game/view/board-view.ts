import { FONT_LILITA_STACK, makeText } from '@repo/game-kit/ui';
import type Phaser from 'phaser';
import { DESIGN_WIDTH } from '../config/game-config';
import { type Board, type Cell, COLS, type MergeStep, ROWS } from '../logic/board';
import { formatValue } from '../logic/round';

const CELL = 116;
const GAP = 12;
const STEP = CELL + GAP;
const BOARD_W = COLS * CELL + (COLS - 1) * GAP;
const X0 = (DESIGN_WIDTH - BOARD_W) / 2;
const BOTTOM = 1220;
/** The block in hand waits above the board; a drop starts from here. */
export const HAND_Y = 250;
const NEXT_X = DESIGN_WIDTH - 80;

const PALETTE = [
	0xf06292, 0x4fc3f7, 0x81c784, 0xffb74d, 0xba68c8, 0xe57373, 0x4db6ac, 0xffd54f, 0x7986cb,
	0xa1887f, 0xff8a65, 0x90a4ae,
];

export const cellX = (col: number): number => X0 + CELL / 2 + col * STEP;
/** Row `ROWS` sits just above the board, where a block lands on a full column. */
export const cellY = (row: number): number => BOTTOM - CELL / 2 - row * STEP;

function shade(color: number, factor: number): number {
	const r = Math.round(((color >> 16) & 0xff) * factor);
	const g = Math.round(((color >> 8) & 0xff) * factor);
	const b = Math.round((color & 0xff) * factor);
	return (r << 16) | (g << 8) | b;
}

/** Each value's block is drawn once into a texture, then shown as plain Images. */
function blockTexture(scene: Phaser.Scene, value: number): string {
	const key = `block-${value}`;
	if (scene.textures.exists(key)) return key;
	const color = PALETTE[(Math.log2(value) - 1) % PALETTE.length] ?? 0xffffff;
	const g = scene.add.graphics();
	g.fillStyle(shade(color, 0.7), 1);
	g.fillRoundedRect(0, 0, CELL, CELL, 22);
	g.fillStyle(color, 1);
	g.fillRoundedRect(0, 0, CELL, CELL - 8, 22);
	g.generateTexture(key, CELL, CELL);
	g.destroy();
	return key;
}

function plainTexture(
	scene: Phaser.Scene,
	key: string,
	w: number,
	h: number,
	color: number,
	radius: number,
): string {
	if (scene.textures.exists(key)) return key;
	const g = scene.add.graphics();
	g.fillStyle(color, 1);
	g.fillRoundedRect(0, 0, w, h, radius);
	g.generateTexture(key, w, h);
	g.destroy();
	return key;
}

function labelSize(label: string): number {
	return [0, 60, 56, 46, 38, 32][label.length] ?? 30;
}

interface BlockSprite {
	readonly image: Phaser.GameObjects.Image;
	readonly text: Phaser.GameObjects.Text;
}

function makeBlock(scene: Phaser.Scene, x: number, y: number): BlockSprite {
	const image = scene.add.image(x, y, blockTexture(scene, 2));
	const text = makeText(scene, {
		x,
		y: y - 4,
		text: '2',
		size: 56,
		font: FONT_LILITA_STACK,
		outline: { color: '#00000055', px: 3 },
	});
	return { image, text };
}

function showBlock(scene: Phaser.Scene, block: BlockSprite, value: number | undefined): void {
	const visible = value !== undefined;
	block.image.setVisible(visible);
	block.text.setVisible(visible);
	if (!visible) return;
	const label = formatValue(value);
	block.image.setTexture(blockTexture(scene, value));
	block.text.setText(label);
	block.text.setFontSize(labelSize(label));
}

function setBlockPos(block: BlockSprite, x: number, y: number): void {
	block.image.setPosition(x, y);
	block.text.setPosition(x, y - 4);
}

/**
 * The 5x7 board, the block in hand and the next one. A fixed pool of block sprites (one per cell, plus the
 * row above the board) is updated in place; only a drop or a merge animates temporary sprites.
 */
export class BoardView {
	private readonly cells: BlockSprite[][] = [];
	private readonly hand: BlockSprite;
	private readonly next: BlockSprite;
	private readonly scene: Phaser.Scene;

	constructor(scene: Phaser.Scene, onColumn: (col: number) => void) {
		this.scene = scene;
		const frameKey = plainTexture(
			scene,
			'board-frame',
			BOARD_W + 28,
			ROWS * STEP + 16,
			0x141b27,
			28,
		);
		scene.add.image(DESIGN_WIDTH / 2, BOTTOM - (ROWS * STEP - GAP) / 2, frameKey);
		const laneKey = plainTexture(scene, 'board-lane', CELL, ROWS * STEP - GAP, 0x223047, 20);
		for (let col = 0; col < COLS; col++) {
			const lane = scene.add.image(cellX(col), BOTTOM - (ROWS * STEP - GAP) / 2, laneKey);
			// The whole column, from the hand down to the bottom, is the tap target.
			lane
				.setInteractive({
					hitArea: {
						x: -GAP / 2,
						y: HAND_Y - 80 - (BOTTOM - ROWS * STEP + GAP),
						width: STEP,
						height: BOTTOM + 40 - (HAND_Y - 80),
					},
					hitAreaCallback: (r: Phaser.Geom.Rectangle, px: number, py: number) =>
						px >= r.x && px <= r.x + r.width && py >= r.y && py <= r.y + r.height,
				})
				.setName(`column-${col}`)
				.on('pointerdown', () => onColumn(col));
		}
		for (let col = 0; col < COLS; col++) {
			const column: BlockSprite[] = [];
			for (let row = 0; row <= ROWS; row++) {
				const block = makeBlock(scene, cellX(col), cellY(row));
				showBlock(scene, block, undefined);
				column.push(block);
			}
			this.cells.push(column);
		}
		this.hand = makeBlock(scene, DESIGN_WIDTH / 2, HAND_Y);
		makeText(scene, { x: NEXT_X, y: HAND_Y - 62, text: 'Tiếp', size: 26, color: '#9fb0c8' });
		this.next = makeBlock(scene, NEXT_X, HAND_Y + 6);
		this.next.image.setScale(0.55);
		this.next.text.setScale(0.55);
	}

	render(board: Board): void {
		for (let col = 0; col < COLS; col++) {
			const column = this.cells[col] as BlockSprite[];
			for (let row = 0; row <= ROWS; row++) {
				const block = column[row] as BlockSprite;
				block.image.setScale(1).setAlpha(1);
				block.text.setScale(1).setAlpha(1);
				showBlock(this.scene, block, board[col]?.[row]);
			}
		}
	}

	setHand(current: number, next: number): void {
		showBlock(this.scene, this.hand, current);
		showBlock(this.scene, this.next, next);
		for (const part of [this.hand.image, this.hand.text]) {
			part.setScale(0.6);
			this.scene.tweens.add({ targets: part, scale: 1, duration: 160, ease: 'Back.Out' });
		}
	}

	hideHand(): void {
		this.hand.image.setVisible(false);
		this.hand.text.setVisible(false);
	}

	/** The block in hand falls into `col` and rests at `row`. */
	async animateDrop(col: number, row: number, value: number): Promise<void> {
		const temp = makeBlock(this.scene, cellX(col), HAND_Y);
		showBlock(this.scene, temp, value);
		const duration = 90 + (ROWS - row) * 35;
		await this.tween({ targets: temp.image, y: cellY(row), duration, ease: 'Quad.In' }, () =>
			setBlockPos(temp, cellX(col), temp.image.y),
		);
		temp.image.destroy();
		temp.text.destroy();
	}

	/** The absorbed blocks slide into the merged one, then the board shows the result with a pop. */
	async animateMerge(step: MergeStep): Promise<void> {
		// k absorbed blocks turned v into v * 2^k.
		const value = step.value / 2 ** step.from.length;
		const movers = step.from.map((cell) => {
			const block = makeBlock(this.scene, cellX(cell.col), cellY(cell.row));
			showBlock(this.scene, block, value);
			this.blockAt(cell)?.image.setVisible(false);
			this.blockAt(cell)?.text.setVisible(false);
			return block;
		});
		const tx = cellX(step.into.col);
		const ty = cellY(step.into.row);
		await Promise.all(
			movers.map((m) =>
				this.tween({ targets: m.image, x: tx, y: ty, duration: 140, ease: 'Quad.In' }, () =>
					setBlockPos(m, m.image.x, m.image.y),
				),
			),
		);
		for (const m of movers) {
			m.image.destroy();
			m.text.destroy();
		}
		this.render(step.board);
		const merged = this.blockAt(step.at);
		if (merged) {
			const into = this.blockAt(step.into);
			// Show the merged block where it was made, then let it fall to its resting cell.
			if (into && (step.into.row !== step.at.row || step.into.col !== step.at.col)) {
				setBlockPos(merged, tx, ty);
				await this.tween(
					{ targets: merged.image, y: cellY(step.at.row), duration: 120, ease: 'Quad.In' },
					() => setBlockPos(merged, cellX(step.at.col), merged.image.y),
				);
				setBlockPos(merged, cellX(step.at.col), cellY(step.at.row));
			}
			await this.tween({
				targets: [merged.image, merged.text],
				scale: 1.18,
				duration: 80,
				yoyo: true,
			});
		}
	}

	/** A column that can't take the block wiggles. */
	refuse(col: number): void {
		const targets = (this.cells[col] ?? []).flatMap((b) => [b.image, b.text]);
		this.scene.tweens.add({ targets, x: '+=10', duration: 50, yoyo: true, repeat: 2 });
	}

	private blockAt(cell: Cell): BlockSprite | undefined {
		return this.cells[cell.col]?.[cell.row];
	}

	private tween(
		config: Phaser.Types.Tweens.TweenBuilderConfig,
		onUpdate?: () => void,
	): Promise<void> {
		return new Promise((resolve) => {
			this.scene.tweens.add({
				...config,
				...(onUpdate ? { onUpdate } : {}),
				onComplete: () => resolve(),
			});
		});
	}
}
