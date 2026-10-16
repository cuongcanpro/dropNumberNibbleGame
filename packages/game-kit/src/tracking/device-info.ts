/**
 * Suy os/model/platform từ userAgent — best-effort, KHÔNG BAO GIỜ ném: Hermes có thể thiếu
 * navigator hoặc trả UA lạ, thiếu info còn hơn crash (cùng tinh thần `safeStr` của Cocos).
 */
export interface UaInfo {
	os_name: string;
	os_version: string;
	model: string;
}

const UNKNOWN: UaInfo = { os_name: 'unknown', os_version: '', model: '' };

export function parseUserAgent(ua: string): UaInfo {
	try {
		const android = /Android\s+([\d.]+)(?:;\s*([^;)]+?))?(?:\s+Build\/[^;)]*)?[;)]/i.exec(ua);
		if (android) {
			return { os_name: 'Android', os_version: android[1] ?? '', model: cleanModel(android[2]) };
		}
		const ios = /(iPhone|iPad|iPod)[^)]*?OS\s+([\d_]+)/i.exec(ua);
		if (ios) {
			return { os_name: 'iOS', os_version: (ios[2] ?? '').replace(/_/g, '.'), model: ios[1] ?? '' };
		}
		const mac = /Mac OS X\s+([\d_.]+)/i.exec(ua);
		if (mac) return { os_name: 'macOS', os_version: (mac[1] ?? '').replace(/_/g, '.'), model: '' };
		const win = /Windows NT\s+([\d.]+)/i.exec(ua);
		if (win) return { os_name: 'Windows', os_version: win[1] ?? '', model: '' };
		return UNKNOWN;
	} catch {
		return UNKNOWN;
	}
}

// "wv" (WebView) hoặc "K" là rác UA reduction của Chrome — không phải model.
function cleanModel(raw: string | undefined): string {
	const m = (raw ?? '').trim();
	return m === 'K' || m === 'wv' ? '' : m;
}

/**
 * `nibi-android` | `nibi-ios` | `web` (quyết định, xem plan). Chưa có cách chắc chắn phân biệt
 * Launcher native với trình duyệt mobile, nên UA mobile → `nibi-*`, còn lại → `web`;
 * shell biết chắc thì truyền `platform` tường minh khi boot.
 */
export function detectPlatform(ua: string): string {
	const { os_name } = parseUserAgent(ua);
	if (os_name === 'Android') return 'nibi-android';
	if (os_name === 'iOS') return 'nibi-ios';
	return 'web';
}
