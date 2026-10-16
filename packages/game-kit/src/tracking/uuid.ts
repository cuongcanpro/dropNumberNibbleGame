/**
 * UUID v4 cho event_id — chìa khoá idempotency của cả pipeline (spec §2).
 *
 * KHÔNG dùng `globalThis`: engine JS của Cocos2d-x JSB không định nghĩa nó, và
 * chạm vào là ném ReferenceError NGAY TRƯỚC khi tới được fallback bên dưới. Lỗi
 * đó bị try/catch của emit nuốt trắng, khiến mọi event biến mất không dấu vết —
 * mất cả buổi mới truy ra (28/08). `typeof` an toàn với cả định danh chưa khai báo.
 */
type MaybeCrypto = { randomUUID?: () => string } | undefined;

function safeCrypto(): MaybeCrypto {
	try {
		return typeof crypto === 'undefined' ? undefined : (crypto as MaybeCrypto);
	} catch {
		return undefined; // môi trường lạ chặn cả typeof
	}
}

export function uuidV4(): string {
	try {
		const c = safeCrypto();
		if (c?.randomUUID) return c.randomUUID();
	} catch {
		// randomUUID có mặt nhưng ném (secure-context) — rơi xuống fallback
	}
	let out = '';
	for (const ch of 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx') {
		if (ch === 'x') out += ((Math.random() * 16) | 0).toString(16);
		else if (ch === 'y') out += (((Math.random() * 4) | 0) + 8).toString(16);
		else out += ch;
	}
	return out;
}
