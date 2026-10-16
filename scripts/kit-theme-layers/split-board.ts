import { rgbToHsl } from '../../packages/game-kit/src/ui/theme-color.ts';
import { SETTING_BOARD, SHAKE_BOARD } from '../../packages/game-kit/src/ui/theme-layer-spec.ts';
import {
	blank,
	clone,
	crop,
	type Img,
	inRect,
	ninePatch,
	opaqueBounds,
	putGray,
	type Rect,
} from './image.ts';

/** Quy tắc tách một bảng thành lớp accent (viền/header/nét đen) + lớp base (thân kem). */
interface BoardRule {
	accent: { l: number };
	base: { l: number };
	baseMinL: number;
	/** true = pixel này giữ nguyên màu gốc (lớp detail, không nhuộm). */
	isDetail: (h: number, s: number, l: number, x: number, y: number) => boolean;
}

export interface BoardLayers {
	/** Toàn bộ silhouette đã nhuộm được; pixel thuộc thân (base) có g=1 vì bị lớp base che. */
	accent: Img;
	/** Chỉ pixel thân sáng. Chồng LÊN accent nên mép base/accent luôn có nền đặc bên dưới (không hở khe khi phóng). */
	base: Img;
	/** Pixel giữ nguyên màu gốc, còn nguyên khổ ảnh. */
	detail: Img;
}

function splitBoard(src: Img, rule: BoardRule): BoardLayers {
	const { width, height } = src;
	const accent = blank(width, height);
	const base = blank(width, height);
	const detail = blank(width, height);
	for (let y = 0; y < height; y++) {
		for (let x = 0; x < width; x++) {
			const i = (y * width + x) * 4;
			const a = src.data[i + 3] as number;
			if (a === 0) continue;
			const { h, s, l } = rgbToHsl(
				src.data[i] as number,
				src.data[i + 1] as number,
				src.data[i + 2] as number,
			);
			if (rule.isDetail(h, s, l, x, y)) {
				src.data.copy(detail.data, i, i, i + 4);
			} else if (l >= rule.baseMinL) {
				putGray(base, i, Math.min(1, l / rule.base.l), a);
				putGray(accent, i, 1, a);
			} else {
				putGray(accent, i, Math.min(1, l / rule.accent.l), a);
			}
		}
	}
	return { accent, base, detail };
}

/** Setting/Exit/Feedback: không có gì để giữ màu gốc ⇒ detail rỗng. */
export function splitSettingBoard(src: Img): BoardLayers {
	return splitBoard(src, {
		accent: SETTING_BOARD.accent,
		base: SETTING_BOARD.base,
		baseMinL: SETTING_BOARD.baseMinL,
		isDetail: () => false,
	});
}

/** Màu header ngay cạnh chữ "MISSION" (phẳng, không gradient): đổ đè lên chữ và nút X để xoá. */
export function eraseBaked(src: Img): Img {
	const out = clone(src);
	const first = SHAKE_BOARD.baked[0] as Rect;
	const at = (first.y * src.width + (first.x - 4)) * 4;
	const [r, g, b] = [src.data[at], src.data[at + 1], src.data[at + 2]] as number[];
	for (const box of SHAKE_BOARD.baked) {
		for (let y = box.y; y < box.y + box.h; y++) {
			for (let x = box.x; x < box.x + box.w; x++) {
				const i = (y * out.width + x) * 4;
				out.data[i] = r as number;
				out.data[i + 1] = g as number;
				out.data[i + 2] = b as number;
				out.data[i + 3] = 255;
			}
		}
	}
	return out;
}

const HUE_MIN = 225;
const HUE_MAX = 290;
const MIN_S = 0.15;

export interface ShakeBoardLayers {
	accent: Img;
	/** Mảnh nineslice nhỏ của thân phẳng; runtime kéo giãn tới `baseBox`. */
	base: Img;
	baseBox: Rect;
	rabbit: Img;
}

/**
 * Bảng popup lắc: thân + viền tím nhuộm được; mascot thỏ giữ nguyên màu. Chữ "MISSION" và nút X nướng sẵn bị xoá khỏi art.
 * Nét viền đen coi là lớp accent (xám tối × tint ≈ đen) — trừ trong ô mascot, nơi nét tối thuộc hình gốc.
 */
export function splitShakeBoard(original: Img): ShakeBoardLayers {
	const src = eraseBaked(original);
	const layers = splitBoard(src, {
		accent: SHAKE_BOARD.accent,
		base: SHAKE_BOARD.base,
		baseMinL: SHAKE_BOARD.baseMinL,
		isDetail: (h, s, l, x, y) => {
			const themed = s >= MIN_S && h >= HUE_MIN && h <= HUE_MAX;
			if (l < SHAKE_BOARD.outlineMaxL) return inRect(SHAKE_BOARD.rabbit, x, y);
			return !themed;
		},
	});
	const baseBox = opaqueBounds(layers.base);
	if (!baseBox) throw new Error('mission_board: không có pixel thân');
	// Detail chỉ được nằm trong hai ô giữ màu: nằm ngoài là art đổi mà chưa cập nhật quy tắc.
	for (let y = 0; y < layers.detail.height; y++) {
		for (let x = 0; x < layers.detail.width; x++) {
			if (
				(layers.detail.data[(y * layers.detail.width + x) * 4 + 3] as number) > 0 &&
				!inRect(SHAKE_BOARD.rabbit, x, y)
			) {
				throw new Error(`mission_board: pixel giữ màu gốc ở (${x},${y}) ngoài ô mascot`);
			}
		}
	}
	return {
		accent: layers.accent,
		base: ninePatch(crop(layers.base, baseBox), SHAKE_BOARD.baseSlice),
		baseBox,
		rabbit: crop(layers.detail, SHAKE_BOARD.rabbit),
	};
}
