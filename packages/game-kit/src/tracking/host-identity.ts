import { DEVICE_ID_KEY, type IdentityProvider } from './device-identity';
import type { StorageAdapter } from './types';

/**
 * Danh tính do LAUNCHER trao cho game (portal Nibi ↔ game, kênh `host` của gói `nibi`).
 *
 * Vì sao: game trong Nibi có localStorage riêng từng package ⇒ tự sinh device_id riêng và
 * gửi `user_id` rỗng. Một người chơi 3 game thành 4 "device" trên Console (DAU phồng), và
 * bảng xếp hạng không gắn được người chơi (chỉ đếm user_id số). Launcher biết cả hai.
 *
 * Giao thức (portal: `src/services/game-identity.ts` — đổi một bên là phải đổi bên kia):
 *   game → launcher  { type: 'nv.identity.request' }
 *   launcher → game  { type: 'nv.identity.v1', deviceId, userId, env }
 * Launcher cũng tự gửi một lần sau `ready`, phòng game hỏi trước khi launcher nghe.
 * Không có launcher (web, simulator) ⇒ không ai trả lời ⇒ hành vi cũ (guest, id riêng).
 */
export const IDENTITY_REQUEST = 'nv.identity.request';
export const IDENTITY_MESSAGE = 'nv.identity.v1';

export interface HostChannel {
	post(data: unknown): void;
	onMessage(cb: (data: unknown) => void): void;
}

export interface HostIdentity extends IdentityProvider {
	/** Device của launcher; undefined tới khi launcher trả lời. */
	deviceId(): string | undefined;
	/** Resolve ở lần trả lời hợp lệ đầu tiên — bootstrap chờ nó (có trần) trước batch đầu. */
	readonly ready: Promise<void>;
}

/** uid nhớ theo env: lần mở sau batch đầu đã có uid, không chờ launcher. */
export const userIdKey = (env: string): string => `nv_user_id_v1:${env}`;

// device portal là 32 hex; nới để chịu UUID có gạch. Không khớp ⇒ bỏ (không ghi rác vào batch).
const DEVICE_RE = /^[A-Za-z0-9_-]{8,64}$/;
// Bảng xếp hạng chỉ đếm user_id SỐ (ZPS uid) — chuỗi khác coi như guest.
const USER_RE = /^\d{1,20}$/;

export function createHostIdentity(
	channel: HostChannel,
	opts: { storage: StorageAdapter; env: string },
): HostIdentity {
	let device: string | undefined;
	let user = '';
	try {
		const saved = opts.storage.get(userIdKey(opts.env));
		if (saved && USER_RE.test(saved)) user = saved;
	} catch {
		// storage hỏng — guest tới khi launcher trả lời
	}
	let markReady: (() => void) | undefined;
	const ready = new Promise<void>((resolve) => {
		markReady = resolve;
	});
	try {
		channel.onMessage((data) => {
			try {
				if (data === null || typeof data !== 'object') return;
				const m = data as Record<string, unknown>;
				if (m['type'] !== IDENTITY_MESSAGE) return;
				const d = m['deviceId'];
				if (typeof d === 'string' && DEVICE_RE.test(d)) {
					device = d;
					// Lần mở sau game boot với đúng id này ngay từ event đầu, không chờ trả lời.
					opts.storage.set(DEVICE_ID_KEY, d);
				}
				// uid của Console env KHÁC (service ZPS khác) là người khác ở Console này.
				const u = m['userId'];
				user = m['env'] === opts.env && typeof u === 'string' && USER_RE.test(u) ? u : '';
				// Đăng xuất ở launcher ghi '' — lần mở sau không mang uid cũ.
				opts.storage.set(userIdKey(opts.env), user);
				markReady?.();
			} catch {
				// message hỏng — giữ trạng thái cũ
			}
		});
		channel.post({ type: IDENTITY_REQUEST });
	} catch {
		// không có kênh host — guest như cũ
	}
	return { userId: () => user, deviceId: () => device, ready };
}
