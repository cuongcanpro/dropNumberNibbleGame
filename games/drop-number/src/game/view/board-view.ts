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
const LANE_H = ROWS * STEP - GAP;
const LANE_TOP = BOTTOM - LANE_H;
/** Top of the tap area: the row above the board, where blocks appear. */
const TAP_TOP = 170;
const NEXT_X = DESIGN_WIDTH - 70;
const NEXT_Y = 168;
const SWEEP_H = 240;
const SWEEP_PASS_MS = 650;
const SWEEP_REST_MS = 220;

const PALETTE = [
	0xf06292, 0x4fc3f7, 0x81c784, 0xffb74d, 0xba68c8, 0xe57373, 0x4db6ac, 0xffd54f, 0x7986cb,
	0xa1887f, 0xff8a65, 0x90a4ae,
];

export const cellX = (col: number): number => X0 + CELL / 2 + col * STEP;
/** Row `ROWS` sits just above the board, where blocks appear; fractional rows work for the falling block. */
export const cellY = (row: number): number => BOTTOM - CELL / 2 - row * STEP;

function colorOf(value: number): number {
	return PALETTE[(Math.log2(value) - 1) % PALETTE.length] ?? 0xffffff;
}

function shade(color: number, factor: number): number {
	const r = Math.min(255, Math.round(((color >> 16) & 0xff) * factor));
	const g = Math.min(255, Math.round(((color >> 8) & 0xff) * factor));
	const b = Math.min(255, Math.round((color & 0xff) * factor));
	return (r << 16) | (g << 8) | b;
}

/** Each value's block is drawn once into a texture, then shown as plain Images. */
function blockTexture(scene: Phaser.Scene, value: number): string {
	const key = `block-${value}`;
	if (scene.textures.exists(key)) return key;
	const color = colorOf(value);
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

/** A soft vertical band of light: bright in the middle, fading to nothing at both ends. */
function sweepTexture(scene: Phaser.Scene): string {
	const key = 'lane-sweep';
	if (scene.textures.exists(key)) return key;
	const g = scene.add.graphics();
	const slices = 30;
	const h = SWEEP_H / slices;
	for (let i = 0; i < slices; i++) {
		const t = (i + 0.5) / slices;
		g.fillStyle(0xffffff, Math.sin(Math.PI * t) ** 2 * 0.55);
		g.fillRect(0, i * h, CELL - 12, Math.ceil(h));
	}
	g.generateTexture(key, CELL - 12, SWEEP_H);
	g.destroy();
	return key;
}

function dotTexture(scene: Phaser.Scene): string {
	const key = 'spark';
	if (scene.textures.exists(key)) return key;
	const g = scene.add.graphics();
	g.fillStyle(0xffffff, 0.35);
	g.fillCircle(10, 10, 10);
	g.fillStyle(0xffffff, 1);
	g.fillCircle(10, 10, 6);
	g.generateTexture(key, 20, 20);
	g.destroy();
	return key;
}

function ringTexture(scene: Phaser.Scene): string {
	const key = 'merge-ring';
	if (scene.textures.exists(key)) return key;
	const g = scene.add.graphics();
	g.lineStyle(8, 0xffffff, 1);
	g.strokeRoundedRect(4, 4, CELL - 8, CELL - 8, 22);
	g.generateTexture(key, CELL, CELL);
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
 * The 5x7 board, the falling block, the next one, and the effects: a light sweeping down the falling
 * block's column, sparks while it slams, and particles that join two merging blocks. A fixed pool of block
 * sprites (one per cell, plus the row above the board) is updated in place.
 */
export class BoardView {
	private readonly scene: Phaser.Scene;
	private readonly cells: BlockSprite[][] = [];
	private readonly faller: BlockSprite;
	private fallerValue = 2;
	private readonly next: BlockSprite;
	private readonly glow: Phaser.GameObjects.Image;
	private readonly sweep: Phaser.GameObjects.Image;
	private readonly sparks: Phaser.GameObjects.Particles.ParticleEmitter;
	private readonly trail: Phaser.GameObjects.Particles.ParticleEmitter;
	private sweepMs = 0;
	private activeCol: number | null = null;

	constructor(scene: Phaser.Scene, onColumn: (col: number) => void) {
		this.scene = scene;
		const laneY = LANE_TOP + LANE_H / 2;
		const frameKey = plainTexture(
			scene,
			'board-frame',
			BOARD_W + 28,
			ROWS * STEP + 16,
			0x141b27,
			28,
		);
		scene.add.image(DESIGN_WIDTH / 2, laneY, frameKey);
		const laneKey = plainTexture(scene, 'board-lane', CELL, LANE_H, 0x223047, 20);
		for (let col = 0; col < COLS; col++) {
			const lane = scene.add.image(cellX(col), laneY, laneKey);
			// The whole column, from the row above the board down to the bottom, is the tap target.
			const hit = {
				x: -GAP / 2,
				y: TAP_TOP - LANE_TOP,
				width: STEP,
				height: BOTTOM + 40 - TAP_TOP,
			};
			lane
				.setInteractive({
					hitArea: hit,
					hitAreaCallback: (r: typeof hit, px: number, py: number) =>
						px >= r.x && px <= r.x + r.width && py >= r.y && py <= r.y + r.height,
				})
				.setName(`column-${col}`)
				.on('pointerdown', () => onColumn(col));
		}

		// Light on the falling block's column: a soft glow plus a band sweeping down, again and again.
		this.glow = scene.add
			.image(0, laneY, laneKey)
			.setBlendMode('ADD')
			.setAlpha(0.18)
			.setVisible(false);
		this.sweep = scene.add
			.image(0, LANE_TOP + SWEEP_H / 2, sweepTexture(scene))
			.setBlendMode('ADD')
			.setVisible(false);

		for (let col = 0; col < COLS; col++) {
			const column: BlockSprite[] = [];
			for (let row = 0; row <= ROWS; row++) {
				const block = makeBlock(scene, cellX(col), cellY(row));
				showBlock(scene, block, undefined);
				column.push(block);
			}
			this.cells.push(column);
		}
		this.faller = makeBlock(scene, cellX(2), cellY(ROWS));
		showBlock(scene, this.faller, undefined);

		makeText(scene, { x: NEXT_X - 74, y: NEXT_Y, text: 'Tiếp', size: 26, color: '#9fb0c8' });
		this.next = makeBlock(scene, NEXT_X, NEXT_Y + 4);
		this.next.image.setScale(0.55);
		this.next.text.setScale(0.55);

		const spark = dotTexture(scene);
		this.trail = scene.add.particles(0, 0, spark, {
			speed: { min: 10, max: 60 },
			angle: { min: 0, max: 360 },
			lifespan: { min: 250, max: 420 },
			scale: { start: 0.9, end: 0 },
			alpha: { start: 0.9, end: 0 },
			blendMode: 'ADD',
			emitting: false,
		});
		this.sparks = scene.add.particles(0, 0, spark, {
			speed: { min: 90, max: 340 },
			angle: { min: 0, max: 360 },
			lifespan: { min: 320, max: 620 },
			scale: { start: 2.2, end: 0 },
			alpha: { start: 1, end: 0 },
			blendMode: 'ADD',
			emitting: false,
		});
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

	setNext(next: number): void {
		showBlock(this.scene, this.next, next);
	}

	/** A new falling block appears above `col`. */
	spawnFaller(value: number, col: number): void {
		this.fallerValue = value;
		showBlock(this.scene, this.faller, value);
		this.placeFaller(col, ROWS, false);
		for (const part of [this.faller.image, this.faller.text]) {
			part.setScale(0.4);
			this.scene.tweens.add({ targets: part, scale: 1, duration: 180, ease: 'Back.Out' });
		}
	}

	/** Moves the falling block; a slam leaves a trail of sparks. */
	placeFaller(col: number, y: number, slam: boolean): void {
		const x = cellX(col);
		const py = cellY(y);
		setBlockPos(this.faller, x, py);
		this.setActiveColumn(col);
		if (slam) {
			this.trail.setParticleTint(colorOf(this.fallerValue));
			this.trail.emitParticleAt(x + (Math.random() - 0.5) * CELL * 0.8, py - CELL / 2, 2);
		}
	}

	hideFaller(): void {
		showBlock(this.scene, this.faller, undefined);
		this.setActiveColumn(null);
	}

	/** The absorbed blocks slide into the merged one trailing particles, then burst and pop. */
	async animateMerge(step: MergeStep): Promise<void> {
		// k absorbed blocks turned v into v * 2^k.
		const value = step.value / 2 ** step.from.length;
		const tint = colorOf(value);
		const movers = step.from.map((cell) => {
			const block = makeBlock(this.scene, cellX(cell.col), cellY(cell.row));
			showBlock(this.scene, block, value);
			this.blockAt(cell)?.image.setVisible(false);
			this.blockAt(cell)?.text.setVisible(false);
			return block;
		});
		const tx = cellX(step.into.col);
		const ty = cellY(step.into.row);
		this.trail.setParticleTint(tint);
		await Promise.all(
			movers.map((m) =>
				this.tween(
					{ targets: m.image, x: tx, y: ty, scale: 0.8, duration: 160, ease: 'Quad.In' },
					() => {
						setBlockPos(m, m.image.x, m.image.y);
						this.trail.emitParticleAt(m.image.x, m.image.y, 2);
					},
				),
			),
		);
		for (const m of movers) {
			m.image.destroy();
			m.text.destroy();
		}
		this.burst(tx, ty, colorOf(step.value), 18 + 8 * step.from.length);
		this.render(step.board);
		const merged = this.blockAt(step.at);
		if (!merged) return;
		if (step.into.row !== step.at.row || step.into.col !== step.at.col) {
			// Show the merged block where it was made, then let it fall to its resting cell.
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

	/** A column the block can't reach wiggles. */
	refuse(col: number): void {
		const targets = (this.cells[col] ?? []).flatMap((b) => [b.image, b.text]);
		this.scene.tweens.add({ targets, x: '+=10', duration: 50, yoyo: true, repeat: 2 });
	}

	private setActiveColumn(col: number | null): void {
		if (col === this.activeCol) return;
		this.activeCol = col;
		const on = col !== null;
		this.glow.setVisible(on);
		this.sweep.setVisible(on);
		if (!on) return;
		this.glow.setX(cellX(col));
		this.sweep.setX(cellX(col));
		// Restart the sweep from the top so the light follows the block into its new column.
		this.sweepMs = 0;
		this.tick(0);
	}

	/** Steps the light sweeping down the active column: a fast pass, then a short rest, again and again. */
	tick(deltaMs: number): void {
		if (this.activeCol === null) return;
		this.sweepMs = (this.sweepMs + deltaMs) % (SWEEP_PASS_MS + SWEEP_REST_MS);
		const t = Math.min(1, this.sweepMs / SWEEP_PASS_MS);
		const top = LANE_TOP + SWEEP_H / 2;
		this.sweep.setY(top + (BOTTOM - SWEEP_H / 2 - top) * t * t);
		this.sweep.setAlpha(this.sweepMs < SWEEP_PASS_MS ? 1 : 0);
	}

	/** Sparks fly out of the merge and a ring of light grows and fades. */
	private burst(x: number, y: number, color: number, count: number): void {
		this.sparks.setParticleTint(color);
		this.sparks.emitParticleAt(x, y, Math.min(count, 50));
		const ring = this.scene.add
			.image(x, y, ringTexture(this.scene))
			.setTint(shade(color, 1.3))
			.setBlendMode('ADD');
		this.scene.tweens.add({
			targets: ring,
			scale: 1.6,
			alpha: 0,
			duration: 360,
			ease: 'Quad.Out',
			onComplete: () => ring.destroy(),
		});
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
