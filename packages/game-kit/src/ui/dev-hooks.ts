import { devHooksEnabled, setDevRankOverride } from '../rank/dev-rank-override';
import { parseKitConfig } from '../shell/kit-config';
import { setKitConfig } from '../shell/kit-config-store';

/**
 * Cầu nối cho QA / agent điều khiển từ console trình duyệt ở bản dev (`import.meta.env.DEV` hoặc
 * `globalThis.GK_DEV = true`), không cần mạng hay Console:
 *   `gkDev.setRank({ rank: 7, totalPlayers: 1200 })`   hạng giả cho popup / `mountRank`
 *   `gkDev.setKitConfig({ rank: { layout: 'off' }, hud: { showHome: false } })`   kit-config giả
 * Đặt TRƯỚC khi mở popup/overlay (kit-config được đọc lúc dựng). Bản phát hành không gắn gì.
 */
export function installDevHooks(): void {
	if (!devHooksEnabled()) return;
	(globalThis as { gkDev?: unknown }).gkDev = {
		setRank: setDevRankOverride,
		setKitConfig: (parts: unknown) => setKitConfig(parseKitConfig({ parts })),
	};
}
