// Số đo của các lớp art tách sẵn (sinh bởi `pnpm theme-layers`, xem scripts/kit-theme-layers).
// KHÔNG import gì: script nướng ảnh và runtime kit đọc cùng một nguồn nên không thể lệch nhau.
// `k`, `l` do khớp với mockup Anh duyệt (sai số TB ~1/255 mỗi kênh); đổi số ⇒ chạy lại generator.

export interface LayerSpec {
	readonly k: number;
	readonly l: number;
}

export interface Box {
	readonly x: number;
	readonly y: number;
	readonly w: number;
	readonly h: number;
}

/** Bảng Setting/Exit/Feedback 549x747: 2 lớp cùng khổ để dùng chung hình học nineslice. */
export const SETTING_BOARD = {
	/** Viền + header + vành tối (cả nét viền đen: pixel xám tối nhân với tint vẫn ra gần đen). */
	accent: { k: 1.05, l: 0.7 },
	/** Thân kem: pixel sáng hơn ngưỡng này thuộc lớp base. */
	base: { k: 1.4, l: 0.92 },
	baseMinL: 0.79,
} as const;

/** Bảng "MISSION" của popup lắc 712x1076. Mascot thỏ giữ nguyên màu (lớp detail, cắt gọn). */
export const SHAKE_BOARD = {
	width: 712,
	height: 1076,
	accent: { k: 1.25, l: 0.77 },
	base: { k: 0.9, l: 0.89 },
	baseMinL: 0.82,
	/** Pixel tối hơn mức này là nét viền (thuộc lớp accent, trừ trong ô mascot). */
	outlineMaxL: 0.35,
	/** Vùng giữ nguyên màu gốc (cắt khỏi ảnh gốc, đặt lại đúng chỗ bằng toạ độ này). */
	rabbit: { x: 2, y: 4, w: 220, h: 248 } as Box,
	/** Hộp thân (vùng base) trên ảnh gốc. Thân phẳng một màu nên chỉ lưu mảnh nineslice (2·baseSlice+2 px vuông). */
	baseBox: { x: 20, y: 258, w: 672, h: 732 } as Box,
	baseSlice: 24,
	/** Nướng sẵn trong art, xoá bằng màu header: chữ "MISSION" (Phaser vẽ lại) và nút X (nút thật nằm đè lên). */
	baked: [
		{ x: 296, y: 184, w: 175, h: 56 },
		{ x: 562, y: 170, w: 72, h: 72 },
	] as readonly Box[],
	/** Tâm chữ "MISSION" cũ, toạ độ so với tâm ảnh (để đặt Text đúng chỗ). */
	titleAt: { x: 27, y: -326.5 },
} as const;

/** Thẻ may mắn 873x610: giấy + bánh giữ nguyên, quầng hồng thành lớp alpha độ phân giải thấp. */
export const RESULT_BG = {
	/** Quầng hồng lưu ở 1/GLOW_SCALE kích thước rồi GPU phóng lên (đường chuyển mượt, không lộ). */
	glowScale: 4,
	glow: { k: 1.1, l: 0.88 },
} as const;

/** Icon xám nhuộm cho hàng toggle (nhân với tint). */
export const ICON_LAYER: LayerSpec = { k: 0.8, l: 0.56 };

/** Chấm đếm lượt lắc: đầy = họ accent, rỗng = họ base. */
export const DOT_FULL: LayerSpec = { k: 1.25, l: 0.77 };
export const DOT_EMPTY: LayerSpec = { k: 0.9, l: 0.89 };
