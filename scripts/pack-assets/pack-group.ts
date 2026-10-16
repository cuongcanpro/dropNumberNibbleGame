import { MaxRectsPacker } from 'maxrects-packer';
import { blitExtruded } from './png-io.ts';
import type { PackedFrame, PackedPage, Sprite } from './types.ts';

export const DEFAULT_MAX_SIZE = 2048;
/** Khoảng trống giữa hai sprite (đã tính cả extrude) — đủ cho mip/filter linear. */
export const PADDING = 2;
export const EXTRUDE = 1;

/**
 * Xếp sprite vào trang ≤ maxSize. Không xoay, không trim.
 * Tất định: nhập sort theo key, maxrects ổn định với cùng thứ tự ⇒ cùng bố cục mỗi lần chạy.
 */
export function packSprites(input: readonly Sprite[], maxSize = DEFAULT_MAX_SIZE): PackedPage[] {
	const sprites = [...input].sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
	const packer = new MaxRectsPacker<{
		width: number;
		height: number;
		x: number;
		y: number;
		data: Sprite;
	}>(maxSize, maxSize, PADDING, {
		smart: true,
		pot: false,
		square: false,
		allowRotation: false,
		border: 0,
	});
	for (const s of sprites) {
		const width = s.width + EXTRUDE * 2;
		const height = s.height + EXTRUDE * 2;
		if (width > maxSize || height > maxSize) {
			throw new Error(`${s.key}: ${s.width}x${s.height} lớn hơn trang ${maxSize}px`);
		}
		packer.add(width, height, s);
	}
	return packer.bins.map((bin) => {
		// Kích thước thật = biên phải/dưới của rect xa nhất (bin.width có thể là cỡ tối đa).
		let width = 0;
		let height = 0;
		for (const r of bin.rects) {
			width = Math.max(width, r.x + r.width);
			height = Math.max(height, r.y + r.height);
		}
		const page = { width, height, pixels: Buffer.alloc(width * height * 4) };
		const frames: PackedFrame[] = [];
		for (const r of bin.rects) {
			const s = r.data as Sprite;
			blitExtruded(page, s, r.x + EXTRUDE, r.y + EXTRUDE, EXTRUDE);
			frames.push({ key: s.key, x: r.x + EXTRUDE, y: r.y + EXTRUDE, w: s.width, h: s.height });
		}
		frames.sort((a, b) => (a.key < b.key ? -1 : 1));
		return { ...page, frames };
	});
}
