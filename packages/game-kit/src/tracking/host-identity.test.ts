import { describe, expect, it } from 'vitest';
import { DEVICE_ID_KEY } from './device-identity';
import {
	createHostIdentity,
	type HostChannel,
	IDENTITY_MESSAGE,
	IDENTITY_REQUEST,
	userIdKey,
} from './host-identity';

function rig() {
	const posted: unknown[] = [];
	let listener: ((data: unknown) => void) | undefined;
	const channel: HostChannel = {
		post: (d) => void posted.push(d),
		onMessage: (cb) => {
			listener = cb;
		},
	};
	const map = new Map<string, string>();
	const storage = {
		get: (k: string) => map.get(k) ?? null,
		set: (k: string, v: string) => void map.set(k, v),
	};
	const send = (d: unknown) => listener?.(d);
	return { channel, posted, map, storage, send };
}

const PORTAL_DEVICE = '9f2c4e1a7b3d4c5e8f9a0b1c2d3e4f5a';

describe('createHostIdentity — launcher trao danh tính cho game', () => {
	it('hỏi launcher ngay khi tạo', () => {
		const r = rig();
		createHostIdentity(r.channel, { storage: r.storage, env: 'dev' });
		expect(r.posted).toEqual([{ type: IDENTITY_REQUEST }]);
	});

	it('chưa có trả lời ⇒ guest: userId rỗng, deviceId undefined (bootstrap giữ id riêng của game)', () => {
		const r = rig();
		const id = createHostIdentity(r.channel, { storage: r.storage, env: 'dev' });
		expect(id.userId()).toBe('');
		expect(id.deviceId()).toBeUndefined();
	});

	it('nhận trả lời ⇒ dùng device của portal + userId, và LƯU device cho lần mở sau', () => {
		const r = rig();
		const id = createHostIdentity(r.channel, { storage: r.storage, env: 'dev' });
		r.send({ type: IDENTITY_MESSAGE, deviceId: PORTAL_DEVICE, userId: '1234567', env: 'dev' });
		expect(id.deviceId()).toBe(PORTAL_DEVICE);
		expect(id.userId()).toBe('1234567');
		expect(r.map.get(DEVICE_ID_KEY)).toBe(PORTAL_DEVICE);
	});

	it('launcher khác env với game ⇒ bỏ userId (uid ZPS service khác là người khác ở Console đó), vẫn lấy device', () => {
		const r = rig();
		const id = createHostIdentity(r.channel, { storage: r.storage, env: 'dev' });
		r.send({ type: IDENTITY_MESSAGE, deviceId: PORTAL_DEVICE, userId: '1234567', env: 'live' });
		expect(id.userId()).toBe('');
		expect(id.deviceId()).toBe(PORTAL_DEVICE);
	});

	it('bỏ qua message lạ / sai hình dạng — không bao giờ ném', () => {
		const r = rig();
		const id = createHostIdentity(r.channel, { storage: r.storage, env: 'dev' });
		for (const junk of [
			null,
			'x',
			42,
			{ type: 'other' },
			{ type: IDENTITY_MESSAGE, deviceId: 'a b<script>', userId: 'abc' },
		]) {
			expect(() => r.send(junk)).not.toThrow();
		}
		expect(id.deviceId()).toBeUndefined();
		expect(id.userId()).toBe('');
	});

	it('đăng xuất ở launcher (userId rỗng) ⇒ game về guest', () => {
		const r = rig();
		const id = createHostIdentity(r.channel, { storage: r.storage, env: 'dev' });
		r.send({ type: IDENTITY_MESSAGE, deviceId: PORTAL_DEVICE, userId: '42', env: 'dev' });
		r.send({ type: IDENTITY_MESSAGE, deviceId: PORTAL_DEVICE, userId: '', env: 'dev' });
		expect(id.userId()).toBe('');
	});

	it('kênh hỏng (post ném) ⇒ vẫn trả identity guest, không ném', () => {
		const r = rig();
		const broken: HostChannel = {
			post: () => {
				throw new Error('no host');
			},
			onMessage: () => {
				throw new Error('no host');
			},
		};
		expect(() =>
			createHostIdentity(broken, { storage: r.storage, env: 'dev' }).userId(),
		).not.toThrow();
	});

	it('ready resolve ở trả lời hợp lệ đầu tiên', async () => {
		const r = rig();
		const id = createHostIdentity(r.channel, { storage: r.storage, env: 'dev' });
		let done = false;
		void id.ready.then(() => {
			done = true;
		});
		r.send({ type: 'other' });
		await Promise.resolve();
		expect(done).toBe(false);
		r.send({ type: IDENTITY_MESSAGE, deviceId: PORTAL_DEVICE, userId: '9', env: 'dev' });
		await id.ready;
		expect(done).toBe(true);
	});

	it('nhớ uid theo env: lần mở sau có uid ngay, đăng xuất thì xoá', () => {
		const r = rig();
		createHostIdentity(r.channel, { storage: r.storage, env: 'dev' });
		r.send({ type: IDENTITY_MESSAGE, deviceId: PORTAL_DEVICE, userId: '55', env: 'dev' });
		expect(r.map.get(userIdKey('dev'))).toBe('55');
		const next = createHostIdentity(rig().channel, { storage: r.storage, env: 'dev' });
		expect(next.userId()).toBe('55');
		expect(createHostIdentity(rig().channel, { storage: r.storage, env: 'live' }).userId()).toBe(
			'',
		);
		r.send({ type: IDENTITY_MESSAGE, deviceId: PORTAL_DEVICE, userId: '', env: 'dev' });
		expect(r.map.get(userIdKey('dev'))).toBe('');
	});
});
