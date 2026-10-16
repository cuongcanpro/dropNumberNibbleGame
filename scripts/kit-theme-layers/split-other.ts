import { rgbToHsl } from '../../packages/game-kit/src/ui/theme-color.ts';
import { type LayerSpec, RESULT_BG } from '../../packages/game-kit/src/ui/theme-layer-spec.ts';
import { blank, clone, type Img, putGray } from './image.ts';

/** Ảnh một lớp: pixel → xám g = L / l (kẹp 1), alpha giữ nguyên. Runtime nhuộm bằng tint hsl(…, l). */
export function grayLayer(src: Img, spec: LayerSpec): Img {
	const out = blank(src.width, src.height);
	for (let i = 0; i < src.data.length; i += 4) {
		const a = src.data[i + 3] as number;
		if (a === 0) continue;
		const { l } = rgbToHsl(
			src.data[i] as number,
			src.data[i + 1] as number,
			src.data[i + 2] as number,
		);
		putGray(out, i, Math.min(1, l / spec.l), a);
	}
	return out;
}

const dist2 = (a: number[], b: number[]): number =>
	((a[0] as number) - (b[0] as number)) ** 2 +
	((a[1] as number) - (b[1] as number)) ** 2 +
	((a[2] as number) - (b[2] as number)) ** 2;

/**
 * Chấm đếm gốc là hình VUÔNG đặc màu nền bảng + vòng tròn: nền nướng sẵn nên không nhuộm theo bảng mới được.
 * Tách vòng tròn ra: alpha = độ lệch so với nền (chiếu lên trục nền→màu chấm), màu = màu chấm gỡ khỏi nền.
 */
export function unbakeDot(src: Img): Img {
	const px = (x: number, y: number): number[] => {
		const i = (y * src.width + x) * 4;
		return [src.data[i] as number, src.data[i + 1] as number, src.data[i + 2] as number];
	};
	const bg = px(0, 0);
	const fg = px(src.width >> 1, src.height >> 1);
	const span = dist2(fg, bg) || 1;
	const out = clone(src);
	for (let y = 0; y < src.height; y++) {
		for (let x = 0; x < src.width; x++) {
			const p = px(x, y);
			const along =
				(((p[0] as number) - (bg[0] as number)) * ((fg[0] as number) - (bg[0] as number)) +
					((p[1] as number) - (bg[1] as number)) * ((fg[1] as number) - (bg[1] as number)) +
					((p[2] as number) - (bg[2] as number)) * ((fg[2] as number) - (bg[2] as number))) /
				span;
			const a = Math.max(0, Math.min(1, along));
			const i = (y * src.width + x) * 4;
			for (let c = 0; c < 3; c++) {
				const v =
					a > 0.02
						? (bg[c] as number) + ((p[c] as number) - (bg[c] as number)) / a
						: (fg[c] as number);
				out.data[i + c] = Math.max(0, Math.min(255, Math.round(v)));
			}
			out.data[i + 3] = Math.round(a * 255);
		}
	}
	return out;
}

export interface ResultBgLayers {
	/** Giấy + bánh, quầng hồng đã thay bằng trắng. */
	paper: Img;
	/** Trắng + alpha = độ đậm quầng, thu nhỏ `glowScale` lần. */
	glow: Img;
}

const OPAQUE = 250;
const GLOW_MIN_S = 0.3;
const GLOW_MIN_L = 0.85;

const isGlow = (h: number, s: number, l: number): boolean =>
	(h >= 320 || h <= 8) && s >= GLOW_MIN_S && l >= GLOW_MIN_L;

/**
 * Thẻ may mắn: quầng hồng (pixel hồng rất sáng) → lớp alpha; giấy trắng + bánh + viền giữ nguyên.
 * Nhuộm trắng bằng màu T rồi chồng lên giấy trắng cho đúng lerp(trắng, T, alpha) của mockup.
 */
export function splitResultBg(src: Img): ResultBgLayers {
	const k = RESULT_BG.glowScale;
	const paper = clone(src);
	const alpha = new Float32Array(src.width * src.height);
	for (let p = 0; p < alpha.length; p++) {
		const i = p * 4;
		const a = src.data[i + 3] as number;
		// Pixel nửa trong suốt là bóng đổ của bánh/viền, không phải quầng: để nguyên ở lớp giấy.
		if (a < OPAQUE) continue;
		const { h, s, l } = rgbToHsl(
			src.data[i] as number,
			src.data[i + 1] as number,
			src.data[i + 2] as number,
		);
		if (!isGlow(h, s, l)) continue;
		alpha[p] = Math.min(1, (1 - l) / (1 - RESULT_BG.glow.l)) * (a / 255);
		paper.data[i] = 255;
		paper.data[i + 1] = 255;
		paper.data[i + 2] = 255;
	}
	const gw = Math.ceil(src.width / k);
	const gh = Math.ceil(src.height / k);
	const glow = blank(gw, gh);
	for (let gy = 0; gy < gh; gy++) {
		for (let gx = 0; gx < gw; gx++) {
			let sum = 0;
			for (let dy = 0; dy < k; dy++) {
				for (let dx = 0; dx < k; dx++) {
					const x = gx * k + dx;
					const y = gy * k + dy;
					if (x < src.width && y < src.height) sum += alpha[y * src.width + x] as number;
				}
			}
			putGray(glow, (gy * gw + gx) * 4, 1, Math.round((sum / (k * k)) * 255));
		}
	}
	return { paper, glow };
}
