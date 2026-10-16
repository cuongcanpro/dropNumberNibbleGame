import { trackingConfig } from '../tracking/track';
import { hostCanShare, requestHostShare } from './host-share';

/**
 * Deep link chia sẻ — GIỮ NGUYÊN shape Cocos `buildShareLink`: chuỗi JSON `{g, inv, lvl?, c?, t}`
 * (key ngắn cho giới hạn độ dài). `parseDeepLink` bên Cocos/Launcher đọc đúng dạng này.
 */
export interface ShareLinkParams {
	gameId: string;
	inviterId: string | number;
	level?: string | number | undefined;
	surface?: string | undefined;
}

export function buildShareLink(params: ShareLinkParams, now: number = Date.now()): string {
	const wire: Record<string, unknown> = { g: params.gameId, inv: params.inviterId, t: now };
	if (params.level != null) wire['lvl'] = params.level;
	if (params.surface != null) wire['c'] = params.surface;
	return JSON.stringify(wire);
}

export type ShareResult = 'shared' | 'unsupported' | 'failed';

export interface ShareInput {
	gameId: string;
	/** Bỏ trống = device id của tracking (Cocos: userId ?? deviceId). */
	inviterId?: string | number | undefined;
	text?: string | undefined;
	level?: string | number | undefined;
	surface?: string | undefined;
}

type ShareNavigator = { share?: (data: { title?: string; text?: string }) => Promise<void> };

function shareNavigator(): ShareNavigator | undefined {
	return typeof navigator === 'undefined' ? undefined : (navigator as ShareNavigator);
}

/**
 * Web: `navigator.share`. Nibi native không có ⇒ chỉ true khi launcher quảng bá `capabilities.share`
 * (docs/launcher-share-protocol.md). Capability có thể tới SAU lúc game dựng popup — popup kit gọi lại
 * hàm này mỗi lần `show()`; game tự dựng nút nên gọi lúc hiện popup, đừng cache lúc boot.
 */
export function canShare(): boolean {
	return typeof shareNavigator()?.share === 'function' || hostCanShare();
}

/**
 * Chia sẻ: `navigator.share` nếu có, không thì nhờ launcher qua kênh host (timeout 60s ⇒ 'failed').
 * Không bao giờ ném. 'unsupported' = không có đường nào (không phải lỗi); 'failed' gồm cả người chơi
 * huỷ sheet. Event `share_*` KHÔNG phát ở đây (giữ Cocos): game gọi `sink.share`/collector
 * `recordShare(surface)` — nên gọi sau khi nhận 'shared'.
 */
export async function shareGame(input: ShareInput): Promise<ShareResult> {
	const nav = shareNavigator();
	const viaWeb = typeof nav?.share === 'function';
	if (!viaWeb && !hostCanShare()) return 'unsupported';
	try {
		const link = buildShareLink({
			gameId: input.gameId,
			inviterId: input.inviterId ?? trackingConfig()?.device.device_id ?? '',
			level: input.level,
			surface: input.surface,
		});
		const text = input.text ?? 'Play with me';
		if (viaWeb && nav?.share) {
			await nav.share({ title: 'Nibble Verse', text: `${text}\n${link}` });
			return 'shared';
		}
		const r = await requestHostShare({ title: 'Nibble Verse', text, url: link });
		return r === 'shared' ? 'shared' : 'failed';
	} catch {
		return 'failed';
	}
}
