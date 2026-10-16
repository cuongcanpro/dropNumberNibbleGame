// ShakeUi: popup "lắc 3 lần" (Cocos shakeUi), luật ở shake-session; toạ độ Cocos y-lên đã đảo sang y-xuống.
import type Phaser from 'phaser';
import { BackKeyManager } from '../platform/back-key-manager';
import { DESIGN_HEIGHT } from '../platform/nibi-host';
import { Vibration } from '../platform/vibration';
import { killTweensDeep } from '../ui/destroy-deep';
import type { ShakeFailReason } from './alt-ad-gate';
import { KEYS } from './assets';
import { type CookieFx, createCookieFx } from './cookie-fx';
import { createMotionSource, type MotionSource } from './motion-source';
import { randomReviveMessage } from './revive-messages';
import { createShakeSession, type ShakeSession } from './shake-session';
import { type ShakeTheme, shakeTheme } from './shake-theme';
import { buildShakeLayout } from './shake-ui-layout';
import type { ShakeUiOptions } from './shake-ui-options';
import { popDot, popIn, slide } from './shake-ui-pop';
import { showRewardCard } from './shake-ui-reward';
import { clearActiveShakeUi, setActiveShakeUi, simulateShakes } from './shake-ui-sim';
import { createTapFallback, type TapFallback } from './tap-fallback';

const CONTENT_SCALE = 0.8382;
const DEPTH = 9500;
const RESULT_DELAY_MS = 600;
const SUBTITLE = 'Shake your phone\nto awaken your luck!';
const SUBTITLE_TAP = 'Keep shaking or tap below\nto awaken your luck!';
export class ShakeUi {
	private readonly root: Phaser.GameObjects.Container;
	private readonly centre: Phaser.GameObjects.Container;
	private readonly cookie: Phaser.GameObjects.Image;
	private readonly dots: Phaser.GameObjects.Image[];
	private readonly subtitle: Phaser.GameObjects.Text;
	private readonly tapButton: Phaser.GameObjects.Container;
	private readonly scene: Phaser.Scene;
	private readonly o: ShakeUiOptions;
	private readonly session: ShakeSession;
	private readonly tapFallback: TapFallback;
	private readonly motion: MotionSource;
	private readonly font: string;
	private readonly theme: ShakeTheme;
	private readonly fx: CookieFx;
	private finished = false;
	private entered = false;
	/** Outcome đang chờ animateOut xong; shutdown giữa chừng thì gọi luôn để gate không treo. */
	private pending: (() => void) | null = null;
	private readonly backHandler = (): boolean => (this.exit('abandoned'), true);

	constructor(scene: Phaser.Scene, o: ShakeUiOptions) {
		this.scene = scene;
		this.o = o;
		this.font = o.fontFamily ?? 'sans-serif';
		this.motion = o.motion ?? createMotionSource();
		this.session = createShakeSession(o.session);
		this.theme = shakeTheme();
		this.tapFallback = createTapFallback({
			onShow: () => this.revealTap(),
			schedule: (cb, ms) => {
				const t = scene.time.delayedCall(ms, cb);
				return () => t.remove(false);
			},
		});

		const layout = buildShakeLayout(scene, {
			font: this.font,
			maxShakes: o.session?.maxShakes ?? 3,
			subtitle: SUBTITLE,
			scale: CONTENT_SCALE,
			depth: DEPTH,
			theme: this.theme,
			onClose: () => this.exit('skipped'),
			onTap: () => this.count(this.session.tap(scene.time.now)),
		});
		this.root = layout.root;
		this.centre = layout.centre;
		this.cookie = layout.cookie;
		this.dots = layout.dots;
		this.subtitle = layout.subtitle;
		this.tapButton = layout.tapButton;
		this.fx = createCookieFx(scene, this.cookie);
	}

	/** Hiện popup; như Cocos, detector và timer Tap chỉ chạy sau khi animation vào (0.5s) kết thúc. */
	open(): void {
		// Scene restart/stop lúc popup mở: dọn motion/timer/back và trả 'abandoned' đúng 1 lần.
		for (const ev of ['shutdown', 'destroy']) this.scene.events.once(ev, this.onShutdown);
		BackKeyManager.getInstance().push(this.backHandler, this.root);
		setActiveShakeUi(this);
		this.centre.setY(DESIGN_HEIGHT + 300);
		slide(this.scene, this.centre, 'in', () => this.startSensing());
		this.fx.startIdle();
	}

	/**
	 * Parity Cocos: máy không có cảm biến (hoặc từ chối quyền) KHÔNG hiện Tap ngay —
	 * timer 5s vẫn chạy và Tap hiện sau đó, giống accelerometer câm trên Cocos.
	 */
	private startSensing(): void {
		this.entered = true;
		if (this.finished || this.session.done) return;
		this.tapFallback.restart();
		if (!this.motion.isSupported()) return;
		void this.motion.start((s) => this.onSample(s));
	}

	private onSample(sample: { x: number; y: number; z: number }): void {
		if (this.finished) return;
		const r = this.session.feed(sample, this.scene.time.now);
		if (r.directionChanged) this.tapFallback.restart();
		this.count(r.counted);
	}

	private count(counted: boolean): void {
		if (!counted || this.finished) return;
		const n = this.session.count;
		Vibration.haptic(0.7, 0.4);
		this.cookie.setTexture(KEYS.cookies[Math.min(n, KEYS.cookies.length - 1)] as string);
		this.fx.burst(() => this.finished);
		popDot(this.scene, this.dots[n - 1], this.theme.dotFull);
		if (!this.session.done) return;
		this.tapFallback.cancel();
		this.motion.stop();
		this.tapButton.setVisible(false);
		this.scene.time.delayedCall(RESULT_DELAY_MS, () => this.showResult());
	}

	private showResult(): void {
		if (this.finished) return;
		// Dòng gợi ý "lắc điện thoại" nằm dưới thẻ, không ẩn thì lộ ở mép đáy thẻ (Anh báo 13/10).
		this.scene.tweens.add({ targets: this.subtitle, alpha: 0, duration: 150 });
		// Parity Cocos: back key trên thẻ reward vẫn thoát với 'abandoned'; chỉ Continue mới onSuccess.
		showRewardCard(this.scene, this.centre, {
			message: randomReviveMessage(Math.random, this.o.messages),
			hasReward: this.o.hasReward ?? false,
			rewardKey: this.o.rewardKey ?? KEYS.reward,
			rewardAmount: this.o.rewardAmount ?? 1,
			fontFamily: this.font,
			theme: this.theme,
			onContinue: () => {
				if (this.finished) return;
				this.finished = true;
				this.animateOut(() => this.o.onSuccess());
			},
		});
	}

	private exit(reason: ShakeFailReason): void {
		if (this.finished) return;
		this.finished = true;
		this.animateOut(() => this.o.onFail(reason));
	}

	private readonly onShutdown = (): void => {
		const settle = this.pending ?? (this.finished ? null : () => this.o.onFail('abandoned'));
		this.finished = true;
		this.pending = null;
		this.release();
		settle?.();
	};

	dismiss(): void {
		this.exit('abandoned');
	}

	simulateSuccess(): void {
		simulateShakes({
			scene: this.scene,
			session: this.session,
			lockMs: this.o.session?.lockMs,
			entered: this.entered,
			isFinished: () => this.finished,
			count: (counted) => this.count(counted),
		});
	}

	private release(): void {
		clearActiveShakeUi(this);
		for (const ev of ['shutdown', 'destroy']) this.scene.events.off(ev, this.onShutdown);
		this.tapFallback.cancel();
		this.motion.stop();
		BackKeyManager.getInstance().remove(this.backHandler);
		killTweensDeep(this.scene, this.root); // wiggle cookie lặp vô hạn, không tự dừng khi destroy
	}

	private animateOut(done: () => void): void {
		this.release();
		this.pending = done;
		slide(this.scene, this.centre, 'out', () => {
			if (this.pending !== done) return; // shutdown đã trả outcome rồi
			this.pending = null;
			this.root.destroy();
			done();
		});
	}

	private revealTap(): void {
		if (this.session.done || this.finished) return;
		popIn(this.scene, this.tapButton);
		this.subtitle.setText(SUBTITLE_TAP);
	}
}
