import type { HostChannel } from '../tracking/host-identity';

/**
 * Share qua LAUNCHER (portal Nibi) trên kênh `host` — native không có `navigator.share`.
 * Spec cho chủ portal: docs/launcher-share-protocol.md (đổi một bên là phải đổi bên kia).
 *
 *   launcher → game  nv.identity.v1 { ..., capabilities: { share: true } }   (quảng bá khả năng)
 *   game → launcher  { type: 'nv.share.v1', id, title?, text, url }
 *   launcher → game  { type: 'nv.share.result.v1', id, result: 'shared' | 'dismissed' | 'failed' }
 *
 * Không quảng bá ⇒ launcher cũ ⇒ `hostCanShare()` false ⇒ nút Share vẫn ẩn.
 */
export const SHARE_REQUEST = 'nv.share.v1';
export const SHARE_RESULT = 'nv.share.result.v1';
/** Capability đi kèm tin danh tính sẵn có — launcher đã gửi nó sau `ready` và khi game hỏi. */
const CAPABILITY_CARRIER = 'nv.identity.v1';
/** Người dùng có thể để sheet mở lâu; quá hạn coi như 'failed' để game không treo. */
export const HOST_SHARE_TIMEOUT_MS = 60_000;

export type HostShareResult = 'shared' | 'dismissed' | 'failed';
export interface HostSharePayload {
	title?: string | undefined;
	text: string;
	url: string;
}

let channel: HostChannel | undefined;
let capable = false;
let seq = 0;
const pending = new Map<string, (r: HostShareResult) => void>();

function onMessage(data: unknown): void {
	try {
		if (data === null || typeof data !== 'object') return;
		const m = data as Record<string, unknown>;
		if (m['type'] === CAPABILITY_CARRIER) {
			const caps = m['capabilities'];
			// Chỉ `true` mới bật; launcher bỏ field (đăng xuất, bản cũ) ⇒ tắt.
			capable =
				caps !== null && typeof caps === 'object' && (caps as { share?: unknown }).share === true;
		} else if (m['type'] === SHARE_RESULT && typeof m['id'] === 'string') {
			const settle = pending.get(m['id']);
			if (!settle) return;
			const r = m['result'];
			settle(r === 'shared' || r === 'dismissed' ? r : 'failed');
		}
	} catch {
		// message hỏng — giữ trạng thái cũ
	}
}

/** Gọi một lần lúc boot, TRƯỚC khi tracking hỏi danh tính (để không lỡ tin capability). */
export function attachShareHost(host: HostChannel): void {
	try {
		channel = host;
		host.onMessage(onMessage);
	} catch {
		channel = undefined; // không có kênh host (web/simulator)
	}
}

export function hostCanShare(): boolean {
	return capable && channel !== undefined;
}

/** Không bao giờ ném: post lỗi / quá hạn ⇒ 'failed'. */
export function requestHostShare(
	payload: HostSharePayload,
	timeoutMs: number = HOST_SHARE_TIMEOUT_MS,
): Promise<HostShareResult> {
	return new Promise((resolve) => {
		const host = channel;
		if (!host) return resolve('failed');
		seq += 1;
		const id = `s${Date.now().toString(36)}-${seq}`;
		const done = (r: HostShareResult): void => {
			clearTimeout(timer);
			pending.delete(id);
			resolve(r);
		};
		const timer = setTimeout(() => done('failed'), timeoutMs);
		pending.set(id, done);
		try {
			host.post({
				type: SHARE_REQUEST,
				id,
				...(payload.title ? { title: payload.title } : {}),
				text: payload.text,
				url: payload.url,
			});
		} catch {
			done('failed');
		}
	});
}

/** Chỉ cho test: xoá trạng thái module. */
export function resetHostShareForTest(): void {
	channel = undefined;
	capable = false;
	for (const settle of pending.values()) settle('failed');
	pending.clear();
}
