/** Một thư mục nguồn: mọi `*.png` bên trong (đệ quy) thành một frame. */
export interface PackSource {
	/** Đường dẫn tương đối so với thư mục chứa pack.config.ts. */
	dir: string;
	/** Ghép trước tên frame, vd `gk-ui/` để không đụng key của game. */
	prefix?: string;
	/** Đổi tên frame (khoá = đường dẫn tương đối bỏ `.png`, chưa gồm prefix) khi key cũ khác tên file. */
	rename?: Record<string, string>;
}

export interface PackGroup {
	/** Đường dẫn output KHÔNG đuôi, tương đối so với pack.config.ts: ghi `<out>.png` + `<out>.json`. */
	out: string;
	sources: PackSource[];
	/** Cạnh tối đa của một trang. Mặc định 2048 (tràn thì multiatlas `<out>-<n>.png`). */
	maxSize?: number;
}

export interface PackConfig {
	groups: PackGroup[];
}

export interface Sprite {
	key: string;
	width: number;
	height: number;
	/** RGBA 8-bit, hàng nối hàng. */
	data: Buffer;
}

export interface PackedFrame {
	key: string;
	/** Vị trí + kích thước sprite GỐC trong trang (đã trừ extrude). */
	x: number;
	y: number;
	w: number;
	h: number;
}

export interface PackedPage {
	width: number;
	height: number;
	frames: PackedFrame[];
	/** RGBA, `width*height*4`. */
	pixels: Buffer;
}

/** File sẽ ghi ra đĩa (đường dẫn tuyệt đối). */
export interface OutputFile {
	path: string;
	contents: Buffer | string;
	/** Chỉ PNG: so điểm ảnh thay vì byte khi `--check` (zlib khác phiên bản ⇒ byte khác). */
	png?: boolean;
}
