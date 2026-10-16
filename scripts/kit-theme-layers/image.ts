import { encodePng } from '../pack-assets/png-io.ts';

/** RGBA 8-bit, hàng nối hàng. */
export interface Img {
	width: number;
	height: number;
	data: Buffer;
}

export interface Rect {
	readonly x: number;
	readonly y: number;
	readonly w: number;
	readonly h: number;
}

export const blank = (width: number, height: number): Img => ({
	width,
	height,
	data: Buffer.alloc(width * height * 4),
});

export const clone = (img: Img): Img => ({ ...img, data: Buffer.from(img.data) });

export const inRect = (r: Rect, x: number, y: number): boolean =>
	x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h;

/** Ghi pixel xám g (0..1) với alpha a: RGB bằng nhau, runtime nhuộm bằng phép nhân. */
export function putGray(img: Img, i: number, g: number, a: number): void {
	const v = Math.max(0, Math.min(255, Math.round(g * 255)));
	img.data[i] = v;
	img.data[i + 1] = v;
	img.data[i + 2] = v;
	img.data[i + 3] = a;
}

export function crop(img: Img, r: Rect): Img {
	const out = blank(r.w, r.h);
	for (let y = 0; y < r.h; y++) {
		const from = ((r.y + y) * img.width + r.x) * 4;
		img.data.copy(out.data, y * r.w * 4, from, from + r.w * 4);
	}
	return out;
}

/** Hộp bao các pixel có alpha > 0; null nếu ảnh trống. */
export function opaqueBounds(img: Img): Rect | null {
	let x0 = img.width;
	let y0 = img.height;
	let x1 = -1;
	let y1 = -1;
	for (let y = 0; y < img.height; y++) {
		for (let x = 0; x < img.width; x++) {
			if ((img.data[(y * img.width + x) * 4 + 3] as number) === 0) continue;
			x0 = Math.min(x0, x);
			y0 = Math.min(y0, y);
			x1 = Math.max(x1, x);
			y1 = Math.max(y1, y);
		}
	}
	return x1 < 0 ? null : { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}

export const countOpaque = (img: Img): number => {
	let n = 0;
	for (let i = 3; i < img.data.length; i += 4) if ((img.data[i] as number) > 0) n++;
	return n;
};

export const toPng = (img: Img): Buffer => encodePng(img.width, img.height, img.data);

/**
 * Thân phẳng (một màu, bo góc) → mảnh nhỏ `(2r+2)²` cho nineslice: bốn góc nguyên bản, hai pixel giữa nhân bản
 * theo hàng/cột giữa. Chỉ đúng khi cạnh giữa của `img` thật sự phẳng (kiểm ở đây, không tin).
 */
export function ninePatch(img: Img, r: number): Img {
	const size = 2 * r + 2;
	const out = blank(size, size);
	const from = (t: number, len: number): number => (t < r ? t : t >= r + 2 ? len - (size - t) : r);
	for (let y = 0; y < size; y++) {
		for (let x = 0; x < size; x++) {
			const i = (from(y, img.height) * img.width + from(x, img.width)) * 4;
			img.data.copy(out.data, (y * size + x) * 4, i, i + 4);
		}
	}
	// Mọi pixel giữa cạnh phải bằng pixel giữa tương ứng, nếu không kéo giãn sẽ sai hình.
	const same = (a: number, b: number): boolean =>
		img.data.subarray(a, a + 4).equals(img.data.subarray(b, b + 4));
	const mid = (img.height >> 1) * img.width + (img.width >> 1);
	for (let x = r; x < img.width - r; x++) {
		if (!same((r * img.width + x) * 4, (r * img.width + r) * 4))
			throw new Error('ninePatch: cạnh ngang không phẳng');
	}
	for (let y = r; y < img.height - r; y++) {
		if (!same((y * img.width + r) * 4, (r * img.width + r) * 4))
			throw new Error('ninePatch: cạnh dọc không phẳng');
	}
	if (!same(mid * 4, (r * img.width + r) * 4)) throw new Error('ninePatch: thân không phẳng');
	return out;
}
