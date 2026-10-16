import { primaryCanvas } from 'nibi';
import type Phaser from 'phaser';

export const DESIGN_WIDTH = 720;
export const DESIGN_HEIGHT = 1280;

/**
 * Key đóng gói là `/` + đường dẫn dưới `res/`. KHÔNG `encodeURIComponent`: `Image.src` native chạy
 * `encodeURI` thêm lần nữa, `%` thành `%25` và trượt key manifest (`play%20copy.png`).
 * `+` không bị encodeURI đụng nhưng bị đóng gói thành `%2B` → tránh tên file có `+`.
 */
export function packedUrl(path: string): string {
	if (!path) return path;
	if (/^(?:blob:|data:|https?:\/\/|\/\/)/i.test(path)) return path;
	const key = path.startsWith('/') ? path : `/${path}`;
	// Bản web có thể nằm trong một thư mục (`/play/<id>` của Nibi Site trỏ vào CDN), không phải gốc
	// origin: nạp `res/` tương đối theo trang. Bản Nibi giữ key tuyệt đối của gói.
	return isWebBuild() ? `.${key}` : key;
}

declare const NIBI_BUILD_TARGET: 'native' | 'web' | undefined;

/** `nibi/vite` định nghĩa `NIBI_BUILD_TARGET`; ngoài Vite (vitest Node) coi là bản Nibi. */
function isWebBuild(): boolean {
	return typeof NIBI_BUILD_TARGET !== 'undefined' && NIBI_BUILD_TARGET === 'web';
}

export async function fetchPacked(path: string): Promise<Response> {
	const url = packedUrl(path);
	const response = await fetch(url);
	if (!response.ok && response.status !== 0) {
		throw new Error(`packed fetch ${url} -> ${response.status}`);
	}
	return response;
}

/** Kích thước backing store của host; gán vào `Phaser.Game` config, không gán ngược vào canvas. */
export function hostGameSize(): { width: number; height: number } {
	return { width: primaryCanvas.width, height: primaryCanvas.height };
}

/** Zoom để khung design 720x1280 vừa canvas (letterbox). Không hợp lệ → 1. */
export function computeViewZoom(width: number, height: number): number {
	const zoom = Math.min(width / DESIGN_WIDTH, height / DESIGN_HEIGHT);
	return Number.isFinite(zoom) && zoom > 0 ? zoom : 1;
}

let viewZoom = 1;

export function setViewZoom(zoom: number): void {
	viewZoom = zoom;
}

export function getViewZoom(): number {
	return viewZoom;
}

interface CameraLike {
	setZoom(zoom: number): unknown;
	centerOn(x: number, y: number): unknown;
}

/**
 * Layout viết theo toạ độ design; camera zoom + centerOn(360, 640) để khung design nằm giữa,
 * phần dư là letterbox. Gọi ở đầu mỗi scene. `size` mặc định lấy từ host (tiêm vào khi test).
 */
export function applyHostCamera(
	scene: { cameras: { main: CameraLike } } | Phaser.Scene,
	size: { width: number; height: number } = hostGameSize(),
): void {
	const zoom = computeViewZoom(size.width, size.height);
	viewZoom = zoom;
	scene.cameras.main.setZoom(zoom);
	scene.cameras.main.centerOn(DESIGN_WIDTH / 2, DESIGN_HEIGHT / 2);
}

export interface ViewRect {
	x: number;
	y: number;
	width: number;
	height: number;
}

/** Phần của Phaser.Camera mà view cần — cấu trúc để test bằng fake. */
export interface ViewCameraLike {
	zoom?: number;
	zoomX?: number;
	zoomY?: number;
	scrollX: number;
	scrollY: number;
	width: number;
	height: number;
	originX?: number;
	originY?: number;
}

/**
 * Vùng world đang nhìn thấy (để vẽ lớp dim phủ kín cả letterbox và đặt panel ở giữa).
 * - Nhận size: giả định `applyHostCamera` (zoom=min, centerOn(360,640)) — chữ ký cũ.
 * - Nhận scene: tính tay từ `cameras.main`, không phụ thuộc `worldView` (chỉ cập nhật ở preRender).
 *   Điểm pivot zoom là `origin * size` (mặc định 0.5), nên
 *   `x = scrollX + originX*width*(1 - 1/zoomX)`, `width = camWidth/zoomX` (tương tự y).
 *   origin 0.5 ⇒ tâm = scroll + w/2; origin 0 (haru-cats) ⇒ mép trái-trên = scroll.
 */
export function designView(
	sizeOrScene:
		| { width: number; height: number }
		| { cameras: { main: ViewCameraLike } } = hostGameSize(),
): ViewRect {
	if ('cameras' in sizeOrScene) return cameraView(sizeOrScene.cameras.main);
	const size = sizeOrScene;
	const zoom = computeViewZoom(size.width, size.height);
	const width = size.width / zoom;
	const height = size.height / zoom;
	return { x: (DESIGN_WIDTH - width) / 2, y: (DESIGN_HEIGHT - height) / 2, width, height };
}

function validZoom(z: number | undefined): number {
	return z !== undefined && Number.isFinite(z) && z > 0 ? z : 1;
}

function cameraView(cam: ViewCameraLike): ViewRect {
	const zx = validZoom(cam.zoomX ?? cam.zoom);
	const zy = validZoom(cam.zoomY ?? cam.zoom);
	const ox = cam.originX ?? 0.5;
	const oy = cam.originY ?? 0.5;
	return {
		x: cam.scrollX + ox * cam.width * (1 - 1 / zx),
		y: cam.scrollY + oy * cam.height * (1 - 1 / zy),
		width: cam.width / zx,
		height: cam.height / zy,
	};
}

/**
 * Nạp font bằng FontFace + document.fonts. Native có thể thiếu các API này → không bao giờ ném,
 * trả `false` và game chơi bằng font mặc định. Gọi trước `new Phaser.Game`.
 */
/** Quá hạn này thì chơi bằng font hệ thống: main.ts chờ font trước khi dựng Phaser.Game. */
export const FONT_TIMEOUT_MS = 2500;

/**
 * Nạp TTF qua FontFace, KHÔNG bao giờ treo: `face.load()` không trả về (asset chậm/hỏng trên native) mà
 * không có hạn thì game kẹt ở màn trống vĩnh viễn — hết hạn trả `false` và game chạy với font dự phòng.
 */
export async function loadFont(
	name: string,
	url: string,
	timeoutMs = FONT_TIMEOUT_MS,
): Promise<boolean> {
	try {
		if (typeof FontFace === 'undefined' || typeof document === 'undefined' || !document.fonts) {
			return false;
		}
		const face = new FontFace(name, `url(${packedUrl(url)})`);
		let timer: ReturnType<typeof setTimeout> | undefined;
		const timeout = new Promise<null>((resolve) => {
			timer = setTimeout(() => resolve(null), timeoutMs);
		});
		const loaded = await Promise.race([face.load(), timeout]).finally(() => clearTimeout(timer));
		if (!loaded) return false;
		document.fonts.add(loaded);
		return true;
	} catch {
		return false;
	}
}

type Listener = () => void;

/** App ẩn/hiện (visibilitychange + pagehide) để game tự save. Trả hàm huỷ đăng ký. */
export function onAppHide(cb: Listener): () => void {
	return listen((hidden) => hidden && cb());
}

export function onAppShow(cb: Listener): () => void {
	return listen((hidden) => !hidden && cb());
}

function listen(on: (hidden: boolean) => void): () => void {
	if (typeof document === 'undefined') return () => {};
	const onVisibility = () => on(document.visibilityState === 'hidden');
	const onPageHide = () => on(true);
	document.addEventListener('visibilitychange', onVisibility);
	globalThis.addEventListener?.('pagehide', onPageHide);
	return () => {
		document.removeEventListener('visibilitychange', onVisibility);
		globalThis.removeEventListener?.('pagehide', onPageHide);
	};
}
