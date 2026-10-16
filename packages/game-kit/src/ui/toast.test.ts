import { describe, expect, it, vi } from 'vitest';

vi.mock('nibi', () => ({ primaryCanvas: { width: 720, height: 1280 } }));

const { Toast } = await import('./toast');
const { pillWidth } = await import('./pill-banner');

/** Mỗi PillBanner = một ảnh nền nướng `gk-pill-*` còn sống. */
const pills = (scene: { byKind(kind: string): Array<{ texture: string }> }) =>
	scene.byKind('image').filter((o) => o.texture.startsWith('gk-pill-'));
const { asScene, FakeScene } = await import('./testing/fake-scene');

function mk(holdMs = 1000) {
	const scene = new FakeScene();
	return { scene, toast: new Toast(asScene(scene), { holdMs }) };
}

describe('pillWidth', () => {
	const s = { minWidth: 200, maxWidth: 560, paddingX: 28 };
	it('kẹp [min, max]', () => {
		expect(pillWidth(10, s)).toBe(200);
		expect(pillWidth(300, s)).toBe(356);
		expect(pillWidth(900, s)).toBe(560);
	});
});

describe('Toast', () => {
	it('hiện chữ và visible ngay khi show', () => {
		const { toast } = mk();
		void toast.show('hello world');
		expect(toast.root.visible).toBe(true);
		expect(toast.getText()).toBe('hello world');
	});

	it('timing: fade 250 + giữ holdMs + fade 250 rồi mới resolve và ẩn', async () => {
		const { scene, toast } = mk(1000);
		let done = false;
		const p = toast.show('x').then(() => {
			done = true;
		});
		scene.advance(249);
		await Promise.resolve();
		expect(done).toBe(false);
		scene.advance(1000); // hết fade-in + hold (t = 1249)
		await Promise.resolve();
		expect(done).toBe(false);
		scene.advance(2); // t = 1251: bắt đầu fade-out
		scene.advance(250);
		await p;
		expect(done).toBe(true);
		expect(toast.root.visible).toBe(false);
	});

	it('không chồng: show liên tiếp vẫn một viên, chữ mới nhất', () => {
		const { scene, toast } = mk();
		void toast.show('first');
		void toast.show('second');
		expect(toast.getText()).toBe('second');
		expect(pills(scene)).toHaveLength(1);
	});

	it('resolve promise cũ khi bị thay thế (không treo await)', async () => {
		const { toast } = mk();
		let first = false;
		const p1 = toast.show('first').then(() => {
			first = true;
		});
		void toast.show('second');
		await p1;
		expect(first).toBe(true);
	});

	it('tween cũ bị huỷ: show lại không bị ẩn sớm bởi lượt trước', async () => {
		const { scene, toast } = mk(1000);
		void toast.show('a');
		scene.advance(900);
		const p2 = toast.show('b');
		scene.advance(900); // lượt a lẽ ra đã tắt ở ~1500
		expect(toast.root.visible).toBe(true);
		scene.advance(2000);
		await p2;
		expect(toast.root.visible).toBe(false);
	});

	it('Toast.show tĩnh dùng lại một instance mỗi scene và dọn khi SHUTDOWN', () => {
		const scene = new FakeScene();
		void Toast.show(asScene(scene), 'one');
		void Toast.show(asScene(scene), 'two');
		expect(pills(scene)).toHaveLength(1);
		expect(scene.events.count('shutdown')).toBe(1);
		scene.events.emit('shutdown');
		void Toast.show(asScene(scene), 'three');
		expect(pills(scene)).toHaveLength(2); // dựng instance mới sau shutdown
	});

	it('Toast.show tĩnh áp holdMs/x/y mới ở mỗi lần gọi', () => {
		const scene = new FakeScene();
		void Toast.show(asScene(scene), 'one', { holdMs: 100, x: 5, y: 6 });
		void Toast.show(asScene(scene), 'two', { holdMs: 3000, x: 10, y: 20 });
		const root = scene.byKind('container').find((c) => c.depth > 0)!;
		expect([root.x, root.y]).toEqual([10, 20]);
		scene.advance(2000); // holdMs cũ (100) lẽ ra đã ẩn từ ~600
		expect(root.visible).toBe(true);
	});
});

describe('PillBanner nướng nền', () => {
	it('không để Graphics sống; cùng cỡ dùng lại một texture', () => {
		const scene = new FakeScene();
		void Toast.show(asScene(scene), 'abc');
		const before = scene.textureKeys.size;
		void Toast.show(asScene(scene), 'abd'); // cùng bề rộng chữ giả → cùng key
		expect(scene.byKind('graphics')).toHaveLength(0);
		expect(scene.textureKeys.size).toBe(before);
		expect([...scene.textureKeys].some((k) => k.startsWith('gk-pill-'))).toBe(true);
	});
});
