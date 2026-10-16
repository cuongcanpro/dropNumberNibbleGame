/**
 * Kiểu công khai của màn loading dùng chung. Không có tuỳ chọn: game không được truyền giá trị nào
 * (Anh chốt 08/10) — tên, mô tả, mẹo, màu nền đều lấy từ listing Console.
 */
export interface LoadingScreen {
	setProgress(p: number): void;
	/** Kéo thanh lên 100%, mờ dần rồi gọi `next` (thường là `scene.start`). Gọi nhiều lần chỉ chạy một. */
	finish(next: () => void): void;
	destroy(): void;
}
