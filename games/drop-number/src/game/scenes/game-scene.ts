import { type AltAdGate, createSceneAltAdGate } from '@repo/game-kit/alt-ad';
import { AttemptCounter, createLocalAttemptStore, createMetricSink } from '@repo/game-kit/metrics';
import { applyHostCamera, Sound } from '@repo/game-kit/platform';
import { setGameMode } from '@repo/game-kit/shell';
import { makeText } from '@repo/game-kit/ui';
import { Scene } from 'phaser';
import {
	ATTEMPT_STORAGE_KEY,
	DESIGN_HEIGHT,
	DESIGN_WIDTH,
	GAME_MODE,
	GAME_TITLE,
} from '../config/game-config';
import { addPoints, canRevive, loseRound, newRound, revive } from '../logic/round';
import { GameMetricsCollector } from '../metrics/game-metrics-collector';
import { type Profile, ProfileStore } from '../persistence/profile-store';
import { addBackground } from '../view/core';
import { addHudButtons } from '../view/hud-buttons';
import { showResult } from '../view/result-flow';
import { installDebugHook } from './debug-hook';
import { confirmHome, installBackKey, openSettings, type ShellOptions } from './game-shell';
import { queueGameAudio, START_BUTTON } from './preload-art';
import { SCENE_GAME } from './scene-keys';

const CENTER_X = DESIGN_WIDTH / 2;
const CENTER_Y = DESIGN_HEIGHT / 2;

/**
 * Hello-world scene with every game-kit part wired: HUD, Settings, Exit, Back key, metrics, result popup
 * with rank, and the shake-for-reward gate. The placeholder round (tap for points, "Give up" to lose)
 * exists only so every flow can be played; replace it with your game and keep the hooks.
 */
export class GameScene extends Scene {
	private round = newRound();
	private started = false;
	private paused = false;
	private ended = false;
	private profile!: Profile;
	private readonly store = new ProfileStore();
	private metrics!: GameMetricsCollector;
	private attempts!: AttemptCounter;
	private adGate!: AltAdGate;

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
		this.round = newRound();
		this.started = false;
		this.paused = false;
		this.ended = false;
		this.profile = this.store.load();
		this.metrics = new GameMetricsCollector({
			sink,
			nowMs: () => Date.now(),
			getScore: () => this.round.score,
		});
		this.attempts = new AttemptCounter(createLocalAttemptStore(ATTEMPT_STORAGE_KEY));
		this.adGate = createSceneAltAdGate(this, sink);

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
			...this.round,
		}));
		this.showTitle();
	}

	/** Real-time games step `logic/` here; Settings, Exit and the reward gate set `paused`. */
	override update(_time: number, _deltaMs: number): void {
		if (!this.started || this.paused || this.ended) return;
		// Step the round with `_deltaMs` here.
	}

	private showTitle(): void {
		const title = makeText(this, { x: CENTER_X, y: 360, text: GAME_TITLE, size: 72 });
		const button = this.add.image(CENTER_X, CENTER_Y, START_BUTTON).setName('start');
		const label = makeText(this, {
			x: CENTER_X,
			y: CENTER_Y,
			text: 'Hello world!\nTap to start',
			size: 36,
			color: '#1b2433',
		});
		button.setInteractive({ useHandCursor: true });
		button.once('pointerdown', () => {
			title.destroy();
			button.destroy();
			label.destroy();
			this.startRound();
		});
	}

	/** Your game starts here: draw the board and route input to `logic/`. */
	private startRound(): void {
		this.round = newRound();
		this.started = true;
		this.metrics.start(this.attempts.attemptFor(0), this.profile.bestScore);

		const button = this.add.image(CENTER_X, CENTER_Y, START_BUTTON).setName('add-point');
		makeText(this, { x: CENTER_X, y: CENTER_Y, text: '+1', size: 48, color: '#1b2433' });
		const score = makeText(this, { x: CENTER_X, y: 360, text: '0', size: 72 }).setName('score');
		button.setInteractive({ useHandCursor: true }).on('pointerdown', () => {
			if (this.paused || this.ended) return;
			this.round = addPoints(this.round, 1);
			score.setText(String(this.round.score));
		});
		makeText(this, { x: CENTER_X, y: 1000, text: 'Give up', size: 40, color: '#ff9b9b' })
			.setName('give-up')
			.setInteractive({ useHandCursor: true })
			.on('pointerdown', () => this.loseRound());
	}

	/** The player lost (out of lives, time up...): offer one revive, otherwise end the round. */
	private loseRound(): void {
		if (this.paused || this.ended) return;
		this.round = loseRound(this.round);
		if (canRevive(this.round)) this.offerReward();
		else this.endRound();
	}

	/** Call when the round ends: saves the best score, closes metrics and shows the result popup with rank. */
	endRound(): void {
		if (this.ended) return;
		this.ended = true;
		const { score } = this.round;
		const isNewBest = score > this.profile.bestScore;
		const bestScore = Math.max(score, this.profile.bestScore);
		this.profile = { bestScore, gamesPlayed: this.profile.gamesPlayed + 1 };
		this.store.save(this.profile);
		this.metrics.end({ score });
		showResult(this, {
			score,
			bestScore,
			isNewBest,
			onReplay: () => this.restart(),
			onHome: () => confirmHome(this, { recordQuit: () => this.metrics.recordQuit('home') }),
			onShared: () => this.metrics.recordShare('game_over'),
		});
	}

	/**
	 * Call wherever an ad-funded game would show a rewarded ad: the player shakes the phone 3 times (Tap! on
	 * desktop) and taps Continue instead. Outcomes are in docs/game-kit.md "Shake-for-reward".
	 */
	offerReward(): void {
		this.paused = true;
		void this.adGate
			.open({
				context: { taskType: 'revive', origin: 'game_over' },
				onReward: () => {
					this.round = revive(this.round);
				},
			})
			.then((outcome) => {
				if (outcome === 'completed' && !this.round.over) this.paused = false;
				else this.endRound();
			});
	}

	private restart(): void {
		this.scene.restart();
	}
}
