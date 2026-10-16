import { AttemptCounter, createLocalAttemptStore, createMetricSink } from '@repo/game-kit/metrics';
import { applyHostCamera, Sound, safeShiftDown, VibrationType } from '@repo/game-kit/platform';
import { setGameMode } from '@repo/game-kit/shell';
import { FONT_LILITA_STACK, HUD_BUTTON_MARGIN, makeText } from '@repo/game-kit/ui';
import type Phaser from 'phaser';
import { Scene } from 'phaser';
import {
	ATTEMPT_STORAGE_KEY,
	DESIGN_HEIGHT,
	DESIGN_WIDTH,
	GAME_MODE,
	GAME_TITLE,
} from '../config/game-config';
import { formatValue, newRound, play, type RoundState } from '../logic/round';
import { GameMetricsCollector } from '../metrics/game-metrics-collector';
import { type Profile, ProfileStore } from '../persistence/profile-store';
import { BoardView } from '../view/board-view';
import { addBackground, vibrate } from '../view/core';
import { addHudButtons } from '../view/hud-buttons';
import { showResult } from '../view/result-flow';
import { installDebugHook } from './debug-hook';
import { confirmHome, installBackKey, openSettings, type ShellOptions } from './game-shell';
import { queueGameAudio, START_BUTTON } from './preload-art';
import { SCENE_GAME } from './scene-keys';

const CENTER_X = DESIGN_WIDTH / 2;
const CENTER_Y = DESIGN_HEIGHT / 2;
const random = (): number => Math.random();

/**
 * Drop Number: tap a column to drop the block in hand; equal neighbours merge. Turn-based, so nothing
 * steps in `update()`: input is ignored while a drop animates (`busy`) or a kit dialog is open (`paused`).
 */
export class GameScene extends Scene {
	private round!: RoundState;
	private started = false;
	private paused = false;
	private ended = false;
	private busy = false;
	private shownScore = 0;
	private profile!: Profile;
	private readonly store = new ProfileStore();
	private metrics!: GameMetricsCollector;
	private attempts!: AttemptCounter;
	private view: BoardView | null = null;
	private scoreText!: Phaser.GameObjects.Text;
	private bestText!: Phaser.GameObjects.Text;

	constructor() {
		super(SCENE_GAME);
	}

	/** Phaser reuses the scene instance on restart, so every piece of round state is rebuilt here. */
	create(): void {
		Sound.getInstance().attach(this);
		queueGameAudio(this);
		setGameMode(GAME_MODE);
		applyHostCamera(this);
		const sink = createMetricSink();
		this.round = newRound(random);
		this.started = false;
		this.paused = false;
		this.ended = false;
		this.busy = false;
		this.shownScore = 0;
		this.view = null;
		this.profile = this.store.load();
		this.metrics = new GameMetricsCollector({
			sink,
			nowMs: () => Date.now(),
			getScore: () => this.round.score,
		});
		this.attempts = new AttemptCounter(createLocalAttemptStore(ATTEMPT_STORAGE_KEY));

		addBackground(this, 0x1b2433);
		const shell: ShellOptions = {
			recordQuit: () => this.metrics.recordQuit('home'),
			onOpened: () => {
				this.paused = true;
			},
			onClosed: () => {
				this.paused = false;
			},
		};
		addHudButtons(this, {
			onHome: () => confirmHome(this, shell),
			onSettings: () => openSettings(this, { ...shell, onRestart: () => this.restart() }),
		});
		installBackKey(this, { ...shell, recordTeardown: () => this.metrics.recordTeardownQuit() });
		installDebugHook(this, () => ({
			started: this.started,
			paused: this.paused,
			ended: this.ended,
			busy: this.busy,
			...this.round,
		}));
		this.showTitle();
	}

	private showTitle(): void {
		const title = makeText(this, {
			x: CENTER_X,
			y: 380,
			text: GAME_TITLE,
			size: 88,
			font: FONT_LILITA_STACK,
			outline: { color: '#0d1320', px: 4 },
		});
		const hint = makeText(this, {
			x: CENTER_X,
			y: 480,
			text: 'Thả số, ghép số giống nhau!',
			size: 34,
			color: '#9fb0c8',
		});
		const best =
			this.profile.bestScore > 0
				? makeText(this, {
						x: CENTER_X,
						y: 940,
						text: `Kỷ lục: ${this.profile.bestScore}   Khối lớn nhất: ${formatValue(Math.max(2, this.profile.bestTile))}`,
						size: 30,
						color: '#9fb0c8',
					})
				: null;
		const button = this.add.image(CENTER_X, CENTER_Y + 60, START_BUTTON).setName('start');
		const label = makeText(this, {
			x: CENTER_X,
			y: CENTER_Y + 60,
			text: 'Chơi',
			size: 48,
			color: '#1b2433',
		});
		button.setInteractive({ useHandCursor: true });
		button.once('pointerdown', () => {
			for (const o of [title, hint, best, button, label]) o?.destroy();
			this.startRound();
		});
	}

	private startRound(): void {
		this.round = newRound(random);
		this.shownScore = 0;
		this.started = true;
		this.metrics.start(this.attempts.attemptFor(0), this.profile.bestScore);

		const top = HUD_BUTTON_MARGIN + safeShiftDown(this, HUD_BUTTON_MARGIN);
		this.scoreText = makeText(this, {
			x: CENTER_X,
			y: top + 40,
			text: '0',
			size: 64,
			font: FONT_LILITA_STACK,
		}).setName('score');
		this.bestText = makeText(this, {
			x: CENTER_X,
			y: top + 96,
			text: `Kỷ lục: ${this.profile.bestScore}`,
			size: 26,
			color: '#9fb0c8',
		});
		this.view = new BoardView(this, (col) => this.onColumn(col));
		this.view.render(this.round.board);
		this.view.setHand(this.round.current, this.round.next);
	}

	private onColumn(col: number): void {
		if (!this.started || this.paused || this.ended || this.busy || !this.view) return;
		const view = this.view;
		const before = this.round;
		const move = play(before, col, random);
		if (!move) {
			view.refuse(col);
			vibrate(VibrationType.LIGHT);
			return;
		}
		this.busy = true;
		this.round = move.state;
		void this.animateMove(view, before, move.result).then(() => {
			if (this.view !== view) return;
			this.busy = false;
			if (this.round.over) this.time.delayedCall(500, () => this.endRound());
		});
	}

	private async animateMove(
		view: BoardView,
		before: RoundState,
		result: NonNullable<ReturnType<typeof play>>['result'],
	): Promise<void> {
		view.hideHand();
		const { landed } = result;
		await view.animateDrop(landed.col, landed.row, before.current);
		view.render(
			before.board.map((column, c) => (c === landed.col ? [...column, before.current] : column)),
		);
		for (const step of result.steps) {
			await view.animateMerge(step);
			this.shownScore += step.value;
			this.scoreText.setText(String(this.shownScore));
			vibrate(VibrationType.LIGHT);
		}
		view.render(this.round.board);
		this.shownScore = this.round.score;
		this.scoreText.setText(String(this.shownScore));
		if (this.round.score > this.profile.bestScore) {
			this.bestText.setText(`Kỷ lục: ${this.round.score}`);
		}
		if (!this.round.over) view.setHand(this.round.current, this.round.next);
	}

	/** Call when the round ends: saves the best score, closes metrics and shows the result popup with rank. */
	endRound(): void {
		if (this.ended) return;
		this.ended = true;
		const { score, maxTile } = this.round;
		const isNewBest = score > this.profile.bestScore;
		const bestScore = Math.max(score, this.profile.bestScore);
		this.profile = {
			bestScore,
			gamesPlayed: this.profile.gamesPlayed + 1,
			bestTile: Math.max(maxTile, this.profile.bestTile),
		};
		this.store.save(this.profile);
		this.metrics.end({ score });
		const tileLine = makeText(this, {
			text: `Khối lớn nhất: ${formatValue(Math.max(2, maxTile))}`,
			size: 32,
			color: '#ffffff',
			outline: { color: '#2b1a3a', px: 3 },
		});
		showResult(this, {
			score,
			bestScore,
			isNewBest,
			custom: tileLine,
			onReplay: () => this.restart(),
			onHome: () => confirmHome(this, { recordQuit: () => this.metrics.recordQuit('home') }),
			onShared: () => this.metrics.recordShare('game_over'),
		});
	}

	private restart(): void {
		this.scene.restart();
	}
}
