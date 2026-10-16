import type Phaser from 'phaser';

/** Một atlas do `pnpm pack-assets` sinh ra: 1 ảnh + bảng frame (key cũ của từng ảnh lẻ → ô trong atlas). */
export interface KitAtlas {
	/** Key texture của CẢ atlas (không phải key của frame). */
	readonly key: string;
	readonly url: string;
	readonly frames: Readonly<
		Record<string, { frame: { x: number; y: number; w: number; h: number } }>
	>;
}

/** Phần của scene mà preload cần — cấu trúc để test bằng fake. */
export interface AtlasPreloadScene {
	textures: {
		exists(key: string): boolean;
		once(event: string, fn: () => void): unknown;
	};
	load: { image(key: string, url: string): unknown };
}

/**
 * Xếp hàng 1 file (ảnh atlas) thay cho N ảnh lẻ; khi nó vào TextureManager thì dựng lại mọi key cũ.
 * Gọi lặp lại (nhiều scene, nhiều nhóm) an toàn: đã có atlas ⇒ không nạp lại.
 */
export function preloadKitAtlas(scene: AtlasPreloadScene | Phaser.Scene, atlas: KitAtlas): void {
	const textures = scene.textures as Phaser.Textures.TextureManager;
	if (textures.exists(atlas.key)) {
		createAtlasAliases(textures, atlas);
		return;
	}
	// Sự kiện của TextureManager (toàn cục), không phải của scene: scene shutdown giữa chừng cũng không mất alias.
	// Chạy đồng bộ trong addImage ⇒ alias đã có trước `complete`, trước `create()` của scene.
	textures.once(`addtexture-${atlas.key}`, () => createAtlasAliases(textures, atlas));
	scene.load.image(atlas.key, atlas.url);
}

/**
 * Mỗi frame cũ thành một Texture RIÊNG nhưng DÙNG CHUNG GL texture của atlas (không upload lại):
 * `Texture.source[0].glTexture` trỏ cùng WebGLTextureWrapper, frame `__BASE` cắt (x,y,w,h) trong atlas.
 * Nhờ đó `add.image(x,y,key)`, `setTexture(key)`, `textures.exists(key)`, `frame.width/height` chạy như ảnh lẻ.
 *
 * Phải truyền kích thước CẢ atlas vào `create` (UV = cut / source.width), không phải kích thước frame.
 */
export function createAtlasAliases(
	textures: Phaser.Textures.TextureManager,
	atlas: KitAtlas,
): void {
	const base = textures.get(atlas.key);
	const baseSource = base.source[0];
	if (!baseSource) return;
	// WebGL: chia sẻ wrapper. Canvas renderer (không có glTexture): chia sẻ thẳng ảnh, cắt bằng frame.
	const shared = baseSource.glTexture ?? baseSource.image;
	for (const [key, { frame: f }] of Object.entries(atlas.frames)) {
		if (textures.exists(key)) continue;
		const alias = textures.create(key, shared as never, baseSource.width, baseSource.height);
		if (!alias) continue;
		alias.add('__BASE', 0, f.x, f.y, f.w, f.h);
		guardSharedSource(alias, baseSource, f);
	}
}

type Crop = { x: number; y: number; w: number; h: number };

/**
 * 1) `textures.remove(alias)` → `Texture.destroy` → `TextureSource.destroy` → `renderer.deleteTexture(glTexture)`
 *    sẽ xoá GL texture CHUNG, làm mọi alias khác (và atlas) hiện ô đen. Gỡ `glTexture` khỏi source của alias
 *    trước khi destroy để chỉ alias biến mất; atlas chỉ bị giải phóng khi chính `key` của atlas bị remove.
 * 2) Code game hay đọc `textures.get(key).getSourceImage().width/height` để đo ảnh lẻ — trả `source.image`.
 *    Với alias đó phải là ảnh cỡ frame, không phải cả atlas: dựng canvas cắt lười, chỉ khi có người đọc.
 */
function guardSharedSource(
	alias: Phaser.Textures.Texture,
	baseSource: Phaser.Textures.TextureSource,
	crop: Crop,
): void {
	const source = alias.source[0];
	if (!source) return;
	let cropped: unknown;
	Object.defineProperty(source, 'image', {
		configurable: true,
		get: () => {
			cropped ??= cropFrame(baseSource.image, crop);
			return cropped;
		},
		set: (value: unknown) => {
			if (value === null) cropped = undefined;
		},
	});
	const destroy = alias.destroy.bind(alias);
	alias.destroy = () => {
		source.glTexture = null as never;
		destroy();
	};
}

/** Canvas cỡ frame chứa phần cắt; không có DOM/ảnh vẽ được thì trả object `{width,height}` để vẫn đo được. */
function cropFrame(image: unknown, { x, y, w, h }: Crop): { width: number; height: number } {
	try {
		const canvas = document.createElement('canvas');
		canvas.width = w;
		canvas.height = h;
		canvas.getContext('2d')?.drawImage(image as CanvasImageSource, x, y, w, h, 0, 0, w, h);
		return canvas;
	} catch {
		return { width: w, height: h };
	}
}
