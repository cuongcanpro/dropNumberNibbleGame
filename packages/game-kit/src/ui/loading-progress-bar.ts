import type Phaser from 'phaser';
import { bakeBarPill, bakeSparkle } from './loading-bake';

export interface ProgressBarStyle {
	readonly width: number;
	readonly height: number;
	readonly trackColor: number;
	readonly trackAlpha: number;
	readonly barColor: number;
	readonly glowColor: number;
}

const INSET = 6; // phần đã chạy nằm lọt trong rãnh, chừa viền rãnh 6px
const SPARK = 72;

/**
 * Thanh tiến trình bo tròn có ngôi sao lấp lánh ở đầu. Loader báo progress theo từng file (giật cục),
 * nên `target` là mốc thật còn `shown` đuổi theo mỗi frame. Phần đã chạy là một viên thuốc nướng sẵn
 * bị `setCrop` theo tỉ lệ: không vẽ lại Graphics mỗi frame (chậm trên Hermes); ngôi sao che đầu cắt.
 */
export class LoadingProgressBar {
	readonly objects: Phaser.GameObjects.GameObject[];
	private readonly scene: Phaser.Scene;
	private readonly track: Phaser.GameObjects.Image;
	private readonly size: { w: number; h: number };
	private readonly fill: Phaser.GameObjects.Image;
	private readonly spark: Phaser.GameObjects.Image;
	private readonly fillLeft: number;
	private readonly fillWidth: number;
	private readonly fillTexWidth: number;
	private readonly fillTexHeight: number;
	private shown = 0;
	private target = 0;
	private onChange: ((p: number) => void) | null = null;

	constructor(scene: Phaser.Scene, cx: number, cy: number, s: ProgressBarStyle) {
		const track = bakeBarPill(scene, s.width, s.height, s.trackColor, s.trackAlpha, false);
		const trackImg = scene.add.image(cx, cy, track.key).setScale(1 / track.res);
		this.track = trackImg;
		this.scene = scene;
		this.size = { w: s.width, h: s.height };
		this.fillWidth = s.width - INSET * 2;
		const fillH = s.height - INSET * 2;
		const fill = bakeBarPill(scene, this.fillWidth, fillH, s.barColor, 1, true);
		this.fillLeft = cx - s.width / 2 + INSET;
		this.fillTexWidth = this.fillWidth * fill.res;
		this.fillTexHeight = fillH * fill.res;
		this.fill = scene.add
			.image(this.fillLeft, cy, fill.key)
			.setOrigin(0, 0.5)
			.setScale(1 / fill.res);
		const spark = bakeSparkle(scene, SPARK, s.glowColor);
		this.spark = scene.add.image(this.fillLeft, cy, spark.key).setScale(1 / spark.res);
		this.objects = [trackImg, this.fill, this.spark];
		this.render();
		// Lấp lánh: phóng nhẹ + xoay 45°, yoyo. repeat -1 không tự dừng khi destroy → chủ gọi killTweensDeep.
		const base = 1 / spark.res;
		scene.tweens.add({
			targets: this.spark,
			scale: base * 1.15,
			angle: 45,
			duration: 700,
			ease: 'Sine.easeInOut',
			yoyo: true,
			repeat: -1,
		});
		this.spark.setScale(base * 0.85);
	}

	/** Đổi màu rãnh khi màu nền Console tới sau (rãnh trắng mờ không thấy trên nền sáng). */
	setTrackStyle(color: number, alpha: number): void {
		const t = bakeBarPill(this.scene, this.size.w, this.size.h, color, alpha, false);
		this.track.setTexture(t.key).setScale(1 / t.res);
	}

	get value(): number {
		return this.shown;
	}

	/** Gọi khi số % hiển thị đổi (chữ phần trăm của màn loading). */
	onDisplay(cb: (p: number) => void): void {
		this.onChange = cb;
		cb(this.shown);
	}

	setTarget(p: number): void {
		this.target = Math.max(this.target, Math.max(0, Math.min(1, p)));
	}

	/** Đuổi theo `target` (gọi mỗi frame từ `update`); bước tối thiểu để không bò mãi ở cuối. */
	step(deltaMs: number): void {
		if (this.shown >= this.target) return;
		const k = Math.min(1, deltaMs / 33);
		this.shown = Math.min(
			this.target,
			this.shown + Math.max(0.006 * k, (this.target - this.shown) * 0.22 * k),
		);
		this.render();
	}

	/** Nhảy thẳng đến mốc (xong tải, hoặc tắt chuyển động). */
	snap(p: number): void {
		this.target = Math.max(0, Math.min(1, p));
		this.shown = this.target;
		this.render();
	}

	private render(): void {
		const p = this.shown;
		this.fill.setVisible(p > 0);
		if (p > 0) this.fill.setCrop(0, 0, Math.max(1, this.fillTexWidth * p), this.fillTexHeight);
		this.spark.x = this.fillLeft + this.fillWidth * Math.max(0.02, p);
		this.onChange?.(p);
	}
}
