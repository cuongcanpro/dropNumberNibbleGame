/**
 * Object/emitter giả (tách khỏi fake-scene.ts cho gọn). Scene giả tối thiểu cho test widget (không có Phaser thật). Chỉ phủ phần API mà ui/ dùng:
 * add.container/image/text/rectangle/graphics, tweens, time, events, scale, textures, load.
 * Method `setXxx` lạ tự ghi vào `state` và trả về chính nó (chain như Phaser).
 */
export interface FakeSceneLike {
	created: FakeObject[];
	textureKeys?: Set<string>;
}
type Listener = (...args: unknown[]) => void;
type Props = Record<string, unknown>;

export class FakeEmitter {
	private map = new Map<string, Listener[]>();
	on(event: string, fn: Listener): this {
		this.map.set(event, [...(this.map.get(event) ?? []), fn]);
		return this;
	}
	once(event: string, fn: Listener): this {
		const wrap: Listener = (...a) => {
			this.off(event, wrap);
			fn(...a);
		};
		return this.on(event, wrap);
	}
	off(event: string, fn?: Listener): this {
		this.map.set(event, fn ? (this.map.get(event) ?? []).filter((f) => f !== fn) : []);
		return this;
	}
	emit(event: string, ...args: unknown[]): boolean {
		for (const fn of this.map.get(event) ?? []) fn(...args); // off() tạo mảng mới nên lặp an toàn
		return (this.map.get(event) ?? []).length > 0;
	}
	count(event: string): number {
		return (this.map.get(event) ?? []).length;
	}
}

export class FakeObject extends FakeEmitter {
	active = true;
	visible = true;
	alpha = 1;
	scale = 1;
	depth = 0;
	width = 0;
	height = 0;
	text = '';
	/** Style của `add.text` (fontFamily, fontSize, ...). */
	style: Props = {};
	children: FakeObject[] = [];
	interactive: Props | null = null;
	state: Props = {};
	parent: FakeObject | null = null;
	readonly kind: string;
	readonly scene: FakeSceneLike;
	x: number;
	y: number;
	texture: string;
	constructor(kind: string, scene: FakeSceneLike, x = 0, y = 0, texture = '') {
		super();
		this.kind = kind;
		this.scene = scene;
		this.x = x;
		this.y = y;
		this.texture = texture;
		// Proxy để method lạ (`setXxx`, `fillStyle`, ...) đều chain được; `created` giữ proxy để so sánh danh tính nhất quán.
		const proxy = new Proxy(this, {
			get(target, prop, receiver) {
				if (prop in target || typeof prop !== 'string' || prop === 'then') {
					return Reflect.get(target, prop, receiver);
				}
				return (...args: unknown[]) => {
					target.state[prop] = args;
					return receiver;
				};
			},
		});
		scene.created.push(proxy);
		return proxy;
	}
	setPosition(x: number, y = x): this {
		this.x = x;
		this.y = y;
		return this;
	}
	setScale(s: number): this {
		this.scale = s;
		return this;
	}
	setAlpha(a: number): this {
		this.alpha = a;
		return this;
	}
	setDepth(d: number): this {
		this.depth = d;
		return this;
	}
	setVisible(v: boolean): this {
		this.visible = v;
		return this;
	}
	setTexture(key: string): this {
		this.texture = key;
		return this;
	}
	setText(t: string): this {
		this.text = t;
		return this;
	}
	setSize(w: number, h: number): this {
		this.width = w;
		this.height = h;
		return this;
	}
	setInteractive(config?: Props): this {
		this.interactive = config ?? {};
		return this;
	}
	disableInteractive(): this {
		this.interactive = null;
		return this;
	}
	/** Như `Graphics.generateTexture`: đăng ký key để `textures.exists` thấy (test cache texture nướng). */
	generateTexture(key: string): this {
		this.scene.textureKeys?.add(key);
		return this;
	}
	/** Như `Phaser.GameObjects.Container.list`. */
	get list(): FakeObject[] {
		return this.children;
	}
	add(child: FakeObject | FakeObject[]): this {
		for (const c of Array.isArray(child) ? child : [child]) {
			c.parent = this;
			this.children.push(c);
		}
		return this;
	}
	destroy(): void {
		if (!this.active) return;
		this.active = false;
		for (const c of this.children) c.destroy();
		this.emit('destroy');
	}
	/** Mô phỏng một cú chạm: down rồi up trên chính object. */
	tap(): void {
		this.emit('pointerdown', { x: 0, y: 0 });
		this.emit('pointerup', { x: 0, y: 0 });
	}
}

/** Ép object Phaser (type) về fake để gọi `tap()`/đọc `interactive` trong test. */
export function fake(o: unknown): FakeObject {
	return o as FakeObject;
}
