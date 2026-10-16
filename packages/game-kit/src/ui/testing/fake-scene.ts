/**
 * Scene giả tối thiểu cho test widget (không có Phaser thật): add.container/image/text/rectangle/
 * graphics/nineslice, tweens, time (đồng hồ giả `advance`), events, scale, textures, load.
 */
import type { ViewCameraLike } from '../../platform/nibi-host';
import { FakeEmitter, FakeObject } from './fake-objects';

export { FakeEmitter, FakeObject, fake } from './fake-objects';

type Props = Record<string, unknown>;

interface TweenCfg extends Props {
	ease?: string;
	targets?: unknown;
	delay?: number;
	duration?: number;
	onComplete?: () => void;
}

interface Task {
	at: number;
	run: () => void;
	targets: unknown[];
	dead: boolean;
}

export class FakeScene {
	created: FakeObject[] = [];
	events = new FakeEmitter();
	scale = { width: 720, height: 1280 };
	private cameraOverride: { main: ViewCameraLike } | null = null;
	textureKeys = new Set<string>();
	loaded: [string, string][] = [];
	now = 0;
	private tasks: Task[] = [];

	/** Mặc định = camera sau `applyHostCamera` (zoom=min, tâm design) theo `scale`; test gán đè được. */
	get cameras(): { main: ViewCameraLike } {
		if (this.cameraOverride) return this.cameraOverride;
		const { width, height } = this.scale;
		const zoom = Math.min(width / 720, height / 1280); // = computeViewZoom, không import để khỏi kéo `nibi`
		return {
			main: {
				zoom,
				width,
				height,
				scrollX: 360 - width / 2,
				scrollY: 640 - height / 2,
			},
		};
	}
	set cameras(value: { main: ViewCameraLike }) {
		this.cameraOverride = value;
	}

	/** Callback đăng ký qua `textures.once(event, fn)`; test gọi `fireTextureEvent` để giả lập ảnh nạp xong. */
	textureListeners: [string, () => void][] = [];
	textures = {
		exists: (key: string) => this.textureKeys.has(key),
		// Atlas "đã nạp" trong fake không có source thật ⇒ createAtlasAliases bỏ qua.
		get: () => ({ source: [] as unknown[] }),
		once: (event: string, fn: () => void) => void this.textureListeners.push([event, fn]),
	};
	load = { image: (key: string, url: string) => void this.loaded.push([key, url]) };
	add = {
		container: (x = 0, y = 0) => new FakeObject('container', this, x, y),
		image: (x = 0, y = 0, key = '') => new FakeObject('image', this, x, y, key),
		text: (x = 0, y = 0, text = '', style: Props = {}) => {
			const o = new FakeObject('text', this, x, y);
			o.text = text;
			o.style = style;
			o.width = text.length * 10;
			return o;
		},
		rectangle: (x = 0, y = 0, w = 0, h = 0) =>
			new FakeObject('rectangle', this, x, y).setSize(w, h),
		graphics: () => new FakeObject('graphics', this),
		nineslice: (x = 0, y = 0, key = '', _f?: unknown, w = 0, h = 0) =>
			new FakeObject('nineslice', this, x, y, key).setSize(w, h),
		existing: (o: FakeObject) => o,
	};
	tweens = {
		add: (cfg: TweenCfg) => {
			const targets = ([] as unknown[]).concat(cfg.targets ?? []);
			this.schedule((cfg.delay ?? 0) + (cfg.duration ?? 0), targets, () => {
				const { targets: _t, delay: _d, duration: _du, onComplete, ease: _e, ...props } = cfg;
				for (const t of targets) Object.assign(t as object, props);
				onComplete?.();
			});
		},
		killTweensOf: (target: unknown) => {
			for (const t of this.tasks) if (t.targets.includes(target)) t.dead = true;
		},
	};
	time = {
		delayedCall: (ms: number, cb: () => void) => {
			const task = this.schedule(ms, [], cb);
			return { remove: () => void (task.dead = true) };
		},
	};

	private schedule(ms: number, targets: unknown[], run: () => void): Task {
		const task = { at: this.now + ms, run, targets, dead: false };
		this.tasks.push(task);
		return task;
	}

	fireTextureEvent(event: string): void {
		const due = this.textureListeners.filter(([e]) => e === event);
		this.textureListeners = this.textureListeners.filter(([e]) => e !== event);
		for (const [, fn] of due) fn();
	}

	/** Chạy đồng hồ giả: tween/delayedCall đến hạn được thực thi theo thứ tự thời gian. */
	advance(ms: number): void {
		const end = this.now + ms;
		for (;;) {
			const due = this.tasks
				.filter((t) => !t.dead && t.at <= end)
				.reduce<Task | undefined>((min, t) => (!min || t.at < min.at ? t : min), undefined);
			if (!due) break;
			this.now = due.at;
			due.dead = true;
			due.run();
		}
		this.now = end;
	}

	byKind(kind: string): FakeObject[] {
		return this.created.filter((o) => o.kind === kind && o.active);
	}
	texts(): string[] {
		return this.byKind('text').map((t) => t.text);
	}
	/** Object tương tác được, lọc theo texture hoặc text (cho test tap). */
	findInteractive(match: { texture?: string; text?: string }): FakeObject | undefined {
		return this.created.find(
			(o) =>
				o.active &&
				o.interactive &&
				(match.texture === undefined || o.texture === match.texture) &&
				(match.text === undefined || o.text === match.text),
		);
	}
}

/** Ép fake về kiểu Phaser.Scene tại chỗ gọi: `new Widget(asScene(fake))`. */
export function asScene<T>(scene: FakeScene): T {
	return scene as unknown as T;
}
