import { describe, expect, it, vi } from 'vitest';
import { asScene, FakeScene } from '../ui/testing/fake-scene';
import { createAtlasAliases, type KitAtlas, preloadKitAtlas } from './atlas-alias';

const atlas: KitAtlas = {
	key: 'gk-atlas/test',
	url: '/assets/test.png',
	frames: {
		'k/a': { frame: { x: 1, y: 2, w: 30, h: 40 } },
		'k/b': { frame: { x: 50, y: 60, w: 10, h: 10 } },
	},
};

/** TextureManager giả đủ phương thức mà alias dùng, giữ nguyên hình dạng Phaser (source[0].glTexture...). */
function fakeManager() {
	const glTexture = { id: 'shared-gl' };
	const deleted: unknown[] = [];
	const list = new Map<string, FakeTexture>();
	class FakeTexture {
		source: { glTexture: unknown; image: unknown; width: number; height: number }[];
		frames: Record<string, number[]> = {};
		destroyed = false;
		key: string;
		constructor(key: string, shared: unknown, width: number, height: number) {
			this.key = key;
			this.source = [{ glTexture: shared, image: shared, width, height }];
		}
		add(name: string, _i: number, x: number, y: number, w: number, h: number) {
			this.frames[name] = [x, y, w, h];
		}
		// Giống Texture.destroy → TextureSource.destroy: xoá GL texture nếu source còn giữ.
		destroy() {
			const gl = this.source[0]?.glTexture;
			if (gl) deleted.push(gl);
			this.destroyed = true;
			list.delete(this.key);
		}
	}
	const base = new FakeTexture(atlas.key, glTexture, 256, 128);
	base.source[0]!.image = { naturalWidth: 256 };
	list.set(atlas.key, base);
	const textures = {
		exists: (k: string) => list.has(k),
		get: (k: string) => list.get(k),
		create: vi.fn<(k: string, shared: unknown, w: number, h: number) => FakeTexture>(
			(k, shared, w, h) => {
				const t = new FakeTexture(k, shared, w, h);
				list.set(k, t);
				return t;
			},
		),
		remove: (k: string) => list.get(k)?.destroy(),
	};
	return { textures, glTexture, deleted, list };
}

describe('createAtlasAliases', () => {
	it('mỗi key một texture dùng chung GL texture, kích thước = cả atlas, frame __BASE = ô', () => {
		const m = fakeManager();
		createAtlasAliases(m.textures as never, atlas);
		for (const [key, { frame: f }] of Object.entries(atlas.frames)) {
			const t = m.list.get(key);
			expect(t?.source[0]?.glTexture).toBe(m.glTexture);
			expect(t?.frames['__BASE']).toEqual([f.x, f.y, f.w, f.h]);
		}
		expect(m.textures.create).toHaveBeenCalledWith('k/a', m.glTexture, 256, 128);
	});
	it('idempotent: gọi lại không tạo trùng', () => {
		const m = fakeManager();
		createAtlasAliases(m.textures as never, atlas);
		createAtlasAliases(m.textures as never, atlas);
		expect(m.textures.create).toHaveBeenCalledTimes(2);
	});
	it('remove một alias KHÔNG xoá GL texture chung; alias còn lại + atlas vẫn sống', () => {
		const m = fakeManager();
		createAtlasAliases(m.textures as never, atlas);
		m.textures.remove('k/a');
		expect(m.deleted).toEqual([]);
		expect(m.list.has('k/a')).toBe(false);
		expect(m.list.get('k/b')?.source[0]?.glTexture).toBe(m.glTexture);
		// remove atlas thật sự mới xoá GL texture
		m.textures.remove(atlas.key);
		expect(m.deleted).toEqual([m.glTexture]);
	});
	it('getSourceImage: source.image có kích thước ô, không phải cả atlas', () => {
		const m = fakeManager();
		createAtlasAliases(m.textures as never, atlas);
		const img = m.list.get('k/a')?.source[0]?.image as { width: number; height: number };
		expect([img.width, img.height]).toEqual([30, 40]);
	});
});

describe('preloadKitAtlas', () => {
	it('queue 1 file, alias dựng khi texture atlas được thêm; atlas đã có thì không queue', () => {
		const scene = new FakeScene();
		preloadKitAtlas(asScene(scene), atlas);
		preloadKitAtlas(asScene(scene), atlas);
		expect(scene.loaded.filter(([k]) => k === atlas.key)).toHaveLength(2); // phaser loader tự bỏ key trùng
		expect(scene.textureListeners.every(([e]) => e === `addtexture-${atlas.key}`)).toBe(true);
		const exists = new FakeScene();
		exists.textureKeys.add(atlas.key);
		preloadKitAtlas(asScene(exists), { ...atlas, frames: {} });
		expect(exists.loaded).toHaveLength(0);
	});
});
