import { safeAreaInsets } from 'nibi';
import { designView, type ViewCameraLike, type ViewRect } from './nibi-host';

/** Phần tai thỏ / thanh home / bo góc màn mà HUD không được đè (design px của khung nhìn). */
export interface SafeInsets {
	readonly top: number;
	readonly right: number;
	readonly bottom: number;
	readonly left: number;
}

const ZERO: SafeInsets = { top: 0, right: 0, bottom: 0, left: 0 };

/**
 * Native Play của Nibi vẽ tràn viền; `safeAreaInsets` là CSS px, đóng băng lúc boot, = 0 trên web và
 * `nibi sim` (nên lỗi này chỉ lộ trên máy thật). Đổi sang design px bằng tỉ lệ bề ngang khung nhìn
 * (design) / `innerWidth` (CSS) — cùng cách bunnypack đã sửa 08/10.
 */
export function toDesignInsets(css: SafeInsets, viewWidth: number, cssWidth: number): SafeInsets {
	const k = viewWidth > 0 && cssWidth > 0 ? viewWidth / cssWidth : 1;
	return { top: css.top * k, right: css.right * k, bottom: css.bottom * k, left: css.left * k };
}

function readInsets(): SafeInsets {
	try {
		return safeAreaInsets ?? ZERO;
	} catch {
		return ZERO;
	}
}

/** Insets an toàn theo camera của scene (design px). */
export function safeInsets(scene: { cameras: { main: ViewCameraLike } }): SafeInsets {
	const view = designView(scene);
	const inner = globalThis.innerWidth;
	const cssWidth = typeof inner === 'number' && inner > 0 ? inner : view.width;
	return toDesignInsets(readInsets(), view.width, cssWidth);
}

/**
 * Khung nhìn trừ vùng không an toàn: HUD, nút góc, thanh dưới đặt theo rect này; nền và lớp phủ vẫn
 * dùng `designView` để tràn viền.
 */
export function safeView(scene: { cameras: { main: ViewCameraLike } }): ViewRect {
	const v = designView(scene);
	const s = safeInsets(scene);
	return {
		x: v.x + s.left,
		y: v.y + s.top,
		width: v.width - s.left - s.right,
		height: v.height - s.top - s.bottom,
	};
}

/** Lề tối thiểu giữa HUD và mép vùng an toàn (design px). */
export const SAFE_GAP = 12;

/**
 * Độ dịch XUỐNG (≥ 0) để mép trên `topEdge` của một nhóm HUD ra khỏi vùng tai thỏ. KẸP, không cộng:
 * bố cục vốn đã chừa đủ chỗ (khung 720×1280 giữa màn dài, spacer theo tỉ lệ) thì trả 0. Cộng thẳng
 * `safe.top` vào mọi game làm HUD lùi hai lần (lỗi 08/10). `viewTop` = mép trên khung nhìn (design).
 */
export function shiftDownFor(
	topEdge: number,
	viewTop: number,
	insetTop: number,
	gap = SAFE_GAP,
): number {
	if (insetTop <= 0) return 0;
	return Math.max(0, viewTop + insetTop + gap - topEdge);
}

/** Độ dịch LÊN (≥ 0) để mép dưới `bottomEdge` ra khỏi thanh home. `viewBottom` = mép dưới khung nhìn. */
export function shiftUpFor(
	bottomEdge: number,
	viewBottom: number,
	insetBottom: number,
	gap = SAFE_GAP,
): number {
	if (insetBottom <= 0) return 0;
	return Math.max(0, bottomEdge - (viewBottom - insetBottom - gap));
}

/** `shiftDownFor` theo camera của scene: mép trên nhóm HUD (design px, y-xuống). */
export function safeShiftDown(
	scene: { cameras: { main: ViewCameraLike } },
	topEdge: number,
): number {
	return shiftDownFor(topEdge, designView(scene).y, safeInsets(scene).top);
}

/** `shiftUpFor` theo camera của scene: mép dưới nhóm nút đáy (design px, y-xuống). */
export function safeShiftUp(
	scene: { cameras: { main: ViewCameraLike } },
	bottomEdge: number,
): number {
	const v = designView(scene);
	return shiftUpFor(bottomEdge, v.y + v.height, safeInsets(scene).bottom);
}
