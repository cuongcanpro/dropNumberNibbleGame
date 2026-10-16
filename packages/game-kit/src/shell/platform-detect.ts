import { detectPlatform as platformFromUa } from '../tracking/device-info';

/**
 * Build `--mode nibi` ⇒ chạy native Launcher ⇒ `nibi-android`/`nibi-ios` theo userAgent;
 * build web thường ⇒ `web` (kể cả khi mở bằng trình duyệt mobile — đó không phải Launcher).
 * `mode`/`ua` inject để test; mặc định đọc từ build + navigator.
 */
export function detectPlatform(
	mode: string | undefined = import.meta.env?.MODE,
	ua: string = typeof navigator !== 'undefined' ? navigator.userAgent || '' : '',
): string {
	if (mode !== 'nibi') return 'web';
	const p = platformFromUa(ua);
	return p === 'web' ? 'nibi-android' : p; // native mà UA lạ: Android là đa số, thà gán còn hơn 'web'
}
