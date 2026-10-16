import type { PackedFrame, PackedPage } from './types.ts';

function frameBody(f: PackedFrame) {
	return {
		frame: { x: f.x, y: f.y, w: f.w, h: f.h },
		rotated: false,
		trimmed: false,
		spriteSourceSize: { x: 0, y: 0, w: f.w, h: f.h },
		sourceSize: { w: f.w, h: f.h },
	};
}

const META = { app: 'pack-assets', format: 'RGBA8888', scale: '1' };

/**
 * Một trang ⇒ Phaser JSON Hash (`load.atlas`). Nhiều trang ⇒ multiatlas (`load.multiatlas`).
 * `images` là tên file PNG tương ứng từng trang (so với file json).
 */
export function buildAtlasJson(pages: readonly PackedPage[], images: readonly string[]): string {
	const first = pages[0];
	if (pages.length === 1 && first) {
		const frames: Record<string, ReturnType<typeof frameBody>> = {};
		for (const f of first.frames) frames[f.key] = frameBody(f);
		const meta = { ...META, image: images[0], size: { w: first.width, h: first.height } };
		return `${JSON.stringify({ frames, meta }, null, '\t')}\n`;
	}
	const textures = pages.map((p, i) => ({
		image: images[i],
		format: META.format,
		size: { w: p.width, h: p.height },
		scale: META.scale,
		frames: p.frames.map((f) => ({ filename: f.key, ...frameBody(f) })),
	}));
	return `${JSON.stringify({ textures, meta: { app: META.app } }, null, '\t')}\n`;
}
