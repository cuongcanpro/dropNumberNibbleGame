import type { StorageAdapter } from './types';

/**
 * Mọi thứ SDK cần từ môi trường chạy (DOM/navigator/localStorage) gói trong một interface
 * nhỏ để phần còn lại thuần và test được. Native Nibi chưa đo được `visibilitychange`,
 * `pagehide`, `navigator.onLine` — host thật (`nibi-tracking-host.ts`) phải guard từng cái;
 * cái nào thiếu thì đăng ký listener là no-op, SDK vẫn có timer 60s + flush ngay khi có thành tích.
 */
export interface TrackingHost {
	storage: StorageAdapter;
	/** Fail-open: không đọc được thì trả true (xem docs/nibi-native-api-compat.md). */
	isOnline(): boolean;
	userAgent(): string;
	language(): string;
	/** App bị ẩn / đóng tab — nơi duy nhất còn cơ hội xả queue. */
	onHide(cb: () => void): void;
	/** Mạng quay lại. */
	onOnline(cb: () => void): void;
}
