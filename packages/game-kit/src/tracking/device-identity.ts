import type { StorageAdapter } from './types';
import { uuidV4 } from './uuid';

export const DEVICE_ID_KEY = 'nv_device_id_v1';

/**
 * Identity v0 device-first: không có zpsToken nên `user_id` mặc định rỗng (guest),
 * Console định danh theo `device_id`. Game/shell có tài khoản thật thì truyền provider riêng.
 */
export interface IdentityProvider {
	userId(): string;
	/** Device do launcher trao (host-identity.ts); undefined ⇒ dùng id riêng của game. */
	deviceId?(): string | undefined;
	/** Có ⇒ batch đầu lúc boot chờ nó (tối đa IDENTITY_WAIT_MS) để không đi với id/uid sai. */
	readonly ready?: Promise<void>;
}

export const guestIdentity: IdentityProvider = { userId: () => '' };

/**
 * device_id sinh một lần, lưu bền. Storage hỏng → vẫn trả id (RAM-only, đổi mỗi lần mở app)
 * còn hơn không có id: Server không nhận device rỗng có nghĩa.
 */
export function getOrCreateDeviceId(storage: StorageAdapter): string {
	try {
		const existing = storage.get(DEVICE_ID_KEY);
		if (existing) return existing;
	} catch {
		// đọc hỏng → sinh mới bên dưới
	}
	const id = uuidV4();
	try {
		storage.set(DEVICE_ID_KEY, id);
	} catch {
		// không lưu được — chấp nhận
	}
	return id;
}
