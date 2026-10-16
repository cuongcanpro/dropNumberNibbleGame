import type Phaser from 'phaser';
import { OVERLAY_DEPTH } from './overlay-base';
import { PillBanner } from './pill-banner';
import { playSequence } from './tween-sequence';

const DEFAULT_HOLD_MS = 1500;
const FADE_MS = 250;
const SLIDE_PX = 10;

export interface ToastOptions {
	fontSize?: number;
	holdMs?: number;
	minWidth?: number;
	maxWidth?: number;
	/** Vị trí tâm viên thuốc (design). Mặc định giữa ngang, y = 1100. */
	x?: number;
	y?: number;
}

const instances = new WeakMap<object, Toast>();

/**
 * Toast một-instance: mỗi `show()` dùng lại cùng một viên nên không bao giờ chồng nhau.
 * Khi show mới ngắt show đang chạy, promise cũ được resolve TRƯỚC (người đang await, vd trong
 * Promise.all, không bao giờ treo) — y Cocos `Toast`.
 */
export class Toast {
	readonly root: Phaser.GameObjects.Container;
	private readonly scene: Phaser.Scene;
	private readonly banner: PillBanner;
	private holdMs: number;
	private cancel: (() => void) | null = null;
	private activeResolve: (() => void) | null = null;

	constructor(scene: Phaser.Scene, opts: ToastOptions = {}) {
		this.scene = scene;
		this.holdMs = opts.holdMs ?? DEFAULT_HOLD_MS;
		this.banner = new PillBanner(scene, {
			height: 56,
			minWidth: opts.minWidth ?? 200,
			maxWidth: opts.maxWidth ?? 560,
			paddingX: 28,
			fontSize: opts.fontSize ?? 22,
		});
		this.root = this.banner.root;
		this.root.setPosition(opts.x ?? 360, opts.y ?? 1100);
		this.root.setDepth(OVERLAY_DEPTH + 1);
	}

	/**
	 * Toast dùng chung của scene (tạo lần đầu, tự dọn khi scene SHUTDOWN). `holdMs`/`x`/`y` áp dụng
	 * ở MỖI lần gọi (nếu truyền); kích thước pill (`minWidth/maxWidth/fontSize`) chỉ lấy lúc tạo.
	 */
	static show(scene: Phaser.Scene, text: string, opts?: ToastOptions): Promise<void> {
		let toast = instances.get(scene);
		if (!toast || !toast.root.active) {
			const created = new Toast(scene, opts);
			toast = created;
			instances.set(scene, created);
			scene.events.once('shutdown', () => {
				created.stop();
				instances.delete(scene);
			});
		}
		if (opts) toast.applyPlacement(opts);
		return toast.show(text);
	}

	private applyPlacement(opts: ToastOptions): void {
		if (opts.holdMs !== undefined) this.holdMs = opts.holdMs;
		if (opts.x !== undefined || opts.y !== undefined) {
			this.root.setPosition(opts.x ?? this.root.x, opts.y ?? this.root.y);
		}
	}

	getText(): string {
		return this.banner.text;
	}

	show(text: string): Promise<void> {
		const { pill, root } = this.banner;
		const sameText = root.visible && this.banner.text === text;
		this.stop();
		if (!sameText) {
			this.banner.relayout(text);
			pill.setAlpha(0);
			pill.setY(SLIDE_PX);
		}
		root.setVisible(true);
		return new Promise<void>((resolve) => {
			this.activeResolve = resolve;
			const finish = () => {
				root.setVisible(false);
				this.activeResolve = null;
				this.cancel = null;
				resolve();
			};
			this.cancel = playSequence(
				this.scene,
				[
					{ tween: { targets: pill, alpha: 1, y: 0, duration: FADE_MS, ease: 'Quad.easeOut' } },
					{ wait: Math.max(this.holdMs, 0) },
					{ tween: { targets: pill, alpha: 0, duration: FADE_MS } },
				],
				finish,
			);
		});
	}

	/** Ngắt show đang chạy và resolve promise của nó (không để treo). */
	private stop(): void {
		this.cancel?.();
		this.cancel = null;
		const prev = this.activeResolve;
		this.activeResolve = null;
		prev?.();
	}
}
