import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { uuidV4 } from './uuid';

const V4_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe('uuidV4', () => {
	it('đúng format v4', () => {
		expect(uuidV4()).toMatch(V4_RE);
	});

	it('1000 lần không trùng', () => {
		const seen = new Set<string>();
		for (let i = 0; i < 1000; i++) seen.add(uuidV4());
		expect(seen.size).toBe(1000);
	});
});

describe('uuidV4 — môi trường không có crypto/globalThis (JSB, Hermes)', () => {
	const RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

	it('KHÔNG chạm globalThis: JSB không định nghĩa nó, chạm là ReferenceError và emit nuốt mất event', () => {
		// Bỏ comment trước khi soi: phần giải thích ở đầu file CÓ nhắc globalThis,
		// và đó là điều cần giữ. Chỉ code mới không được chạm.
		const code = readFileSync(join(import.meta.dirname, 'uuid.ts'), 'utf8')
			.replace(/\/\*[\s\S]*?\*\//g, '')
			.replace(/\/\/.*/g, '');
		expect(code).not.toMatch(/globalThis/);
	});

	it('không có crypto vẫn trả uuid v4 hợp lệ, không ném', () => {
		const saved = (global as { crypto?: unknown }).crypto;
		delete (global as { crypto?: unknown }).crypto; // mô phỏng runtime JSB
		try {
			expect(uuidV4()).toMatch(RE);
		} finally {
			(global as { crypto?: unknown }).crypto = saved;
		}
	});

	it('randomUUID ném (secure-context) vẫn rơi xuống fallback', () => {
		const saved = (global as { crypto?: unknown }).crypto;
		(global as { crypto?: unknown }).crypto = {
			randomUUID: () => {
				throw new Error('not a secure context');
			},
		};
		try {
			expect(uuidV4()).toMatch(RE);
		} finally {
			(global as { crypto?: unknown }).crypto = saved;
		}
	});
});
