/**
 * Bố cục sheet Feedback (thuần, test được): tiêu đề → lưới chip → ô ghi chú → Send, panel cao vừa đủ
 * nội dung (không còn khoảng chết). Toạ độ gốc ở TÂM panel, y xuống.
 */
export const PANEL_W = 620;
/** Dải header đậm của bảng kết thúc ~116px dưới mép trên; chip phải bắt đầu dưới đó. */
export const HEADER_H = 116;
export const CHIP_W = 262;
export const CHIP_H = 64;
const CHIP_GAP_X = 16;
const CHIP_GAP_Y = 12;
const PAD_TOP = 24;
const NOTE_H = 84;
const NOTE_GAP = 22;
const SEND_H = 81;
const SEND_W = 225;
const SEND_GAP = 22;
/** Mép dưới của thân bảng có viền/bóng dày ~30. */
const PAD_BOTTOM = 48;

export interface Box {
	x: number;
	y: number;
	w: number;
	h: number;
}

export interface FeedbackLayout {
	panelH: number;
	/** Tâm tiêu đề và nút đóng (cùng y). */
	headerY: number;
	chips: { x: number; y: number }[];
	/** Ô ghi chú (tâm + kích thước); null khi môi trường không có DOM input. */
	note: Box | null;
	send: Box;
}

export function feedbackLayout(count: number, hasNote: boolean): FeedbackLayout {
	const rows = Math.max(1, Math.ceil(count / 2));
	const gridH = rows * CHIP_H + (rows - 1) * CHIP_GAP_Y;
	const noteBlock = hasNote ? NOTE_GAP + NOTE_H : 0;
	const panelH = HEADER_H + PAD_TOP + gridH + noteBlock + SEND_GAP + SEND_H + PAD_BOTTOM;
	const top = -panelH / 2;
	const gridTop = top + HEADER_H + PAD_TOP;
	const chips = Array.from({ length: count }, (_, i) => {
		const lastAlone = i === count - 1 && count % 2 === 1;
		const side = i % 2 === 0 ? -1 : 1;
		return {
			x: lastAlone ? 0 : (side * (CHIP_W + CHIP_GAP_X)) / 2,
			y: gridTop + CHIP_H / 2 + Math.floor(i / 2) * (CHIP_H + CHIP_GAP_Y),
		};
	});
	const noteTop = gridTop + gridH + NOTE_GAP;
	const note = hasNote
		? { x: 0, y: noteTop + NOTE_H / 2, w: 2 * CHIP_W + CHIP_GAP_X, h: NOTE_H }
		: null;
	const sendTop = (note ? noteTop + NOTE_H : gridTop + gridH) + SEND_GAP;
	return {
		panelH,
		headerY: top + 52,
		chips,
		note,
		send: { x: 0, y: sendTop + SEND_H / 2, w: SEND_W, h: SEND_H },
	};
}

export interface CssRect {
	left: number;
	top: number;
	width: number;
	height: number;
}

/**
 * Hộp world (tâm + kích thước) → hình chữ nhật CSS trên trang. `view` là vùng world mà camera hiển thị
 * (`designView(scene)`), phủ TOÀN canvas; `canvas` là `getBoundingClientRect()` của canvas (đã gồm
 * letterbox của Scale.FIT, iframe, dpr). Tỉ lệ css-px/world = canvas.width / view.width.
 */
export function worldToCss(
	box: Box,
	view: { x: number; y: number; width: number; height: number },
	canvas: CssRect,
): CssRect {
	const k = canvas.width / view.width;
	return {
		left: canvas.left + (box.x - box.w / 2 - view.x) * k,
		top: canvas.top + (box.y - box.h / 2 - view.y) * k,
		width: box.w * k,
		height: box.h * k,
	};
}
