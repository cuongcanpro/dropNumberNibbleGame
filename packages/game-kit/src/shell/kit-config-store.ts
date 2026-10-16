import { KIT_CONFIG_DEFAULTS, type KitConfig } from './kit-config';

/**
 * Giữ cấu hình của phiên. Đồng bộ để popup đọc lúc mở không phải await. Quy tắc "đổi hiện ở lần mở
 * game KẾ TIẾP": bản cache đọc lúc boot là bản dùng cả phiên; bản tươi chỉ thay được nếu CHƯA AI đọc
 * (popup đầu tiên chưa mở) — sau đó đổi giữa phiên sẽ làm UI nhảy.
 */
let active: KitConfig = KIT_CONFIG_DEFAULTS;
let consumed = false;

/** `fresh` = bản vừa tải xong (bị bỏ nếu đã có người đọc). */
export function setKitConfig(cfg: KitConfig, opts: { fresh?: boolean } = {}): void {
	if (opts.fresh && consumed) return;
	active = cfg;
}

export function isKitConfigConsumed(): boolean {
	return consumed;
}

/** Cấu hình hiệu lực (mặc định của kit khi chưa có gì). Lần đọc đầu "chốt" cấu hình của phiên. */
export function readKitConfig(): KitConfig {
	consumed = true;
	return active;
}

export function resetKitConfigForTest(): void {
	active = KIT_CONFIG_DEFAULTS;
	consumed = false;
}
