import { PNG } from 'pngjs';
import type { Sprite } from './types.ts';

export function decodePng(buffer: Buffer, key: string): Sprite {
	const png = PNG.sync.read(buffer);
	return { key, width: png.width, height: png.height, data: png.data };
}

/** Mức nén + filter cố định để cùng input ⇒ cùng byte (fingerprint của CI deploy). */
export function encodePng(width: number, height: number, pixels: Buffer): Buffer {
	const png = new PNG({ width, height });
	pixels.copy(png.data);
	return PNG.sync.write(png, { deflateLevel: 9, colorType: 6, filterType: -1 });
}

/** Chép sprite vào trang tại (x,y) rồi kéo dài 1 lớp điểm ảnh biên ra `extrude` px (chống bleed khi filter linear). */
export function blitExtruded(
	page: { width: number; pixels: Buffer },
	sprite: Sprite,
	x: number,
	y: number,
	extrude: number,
): void {
	const { width: w, height: h, data } = sprite;
	for (let row = -extrude; row < h + extrude; row++) {
		const srcRow = Math.min(h - 1, Math.max(0, row));
		for (let col = -extrude; col < w + extrude; col++) {
			const srcCol = Math.min(w - 1, Math.max(0, col));
			const src = (srcRow * w + srcCol) * 4;
			const dst = ((y + row) * page.width + (x + col)) * 4;
			data.copy(page.pixels, dst, src, src + 4);
		}
	}
}
