import { describe, expect, it } from 'vitest';
import { createShakeSession } from './shake-session';

// Mẫu m/s²: biên độ ±20 ≈ 2g > ngưỡng; cặp mẫu tạo Δ lớn theo trục mong muốn.
const A = 20;
function shakeTo(s: ReturnType<typeof createShakeSession>, axis: 'x' | 'y', v: number, t: number) {
	return s.feed({ x: axis === 'x' ? v : 0, y: axis === 'y' ? v : 0, z: 0 }, t);
}

describe('shake-session', () => {
	it('3 lần đổi hướng (cách >0.25s) → done', () => {
		const s = createShakeSession();
		expect(shakeTo(s, 'x', A, 1000).counted).toBe(true); // right
		expect(shakeTo(s, 'x', -A, 1300).counted).toBe(true); // left
		expect(shakeTo(s, 'x', A, 1600).counted).toBe(true); // right
		expect(s.count).toBe(3);
		expect(s.done).toBe(true);
	});

	it('cùng hướng liên tiếp không đếm thêm', () => {
		const s = createShakeSession();
		expect(shakeTo(s, 'x', A, 1000).counted).toBe(true); // right
		// Δ cùng dấu dương lần nữa: lùi về 0 trước (Δ âm = left!) nên dùng mẫu tăng liên tục.
		expect(s.feed({ x: A, y: 0, z: 0 }, 1300).directionChanged).toBe(false);
		expect(shakeTo(s, 'x', 2 * A, 1600).counted).toBe(false); // vẫn right
		expect(s.count).toBe(1);
	});

	it('lần lắc đầu hướng unknown bị bỏ qua (Cocos _curDirection khởi tạo unknown)', () => {
		const s = createShakeSession();
		expect(s.feed({ x: 15, y: 15, z: 0 }, 1000).counted).toBe(false);
		expect(s.count).toBe(0);
	});

	it('khoá 0.25s giữa 2 lần đếm; hướng vẫn được ghi nhận khi bị khoá', () => {
		const s = createShakeSession();
		expect(shakeTo(s, 'x', A, 1000).counted).toBe(true);
		const r = shakeTo(s, 'x', -A, 1200); // left, trong khoá
		expect(r.counted).toBe(false);
		expect(r.directionChanged).toBe(true);
		expect(s.count).toBe(1);
		expect(shakeTo(s, 'x', A, 1350).counted).toBe(true); // right, hết khoá (1000+250) và qua interval detector
	});

	it('dưới ngưỡng bị bỏ qua', () => {
		const s = createShakeSession();
		expect(shakeTo(s, 'x', 10, 1000).counted).toBe(false); // 1.02g
		expect(s.count).toBe(0);
	});

	it('tap đếm như lắc nhưng chịu khoá và giới hạn 3', () => {
		const s = createShakeSession();
		expect(s.tap(0)).toBe(true);
		expect(s.tap(100)).toBe(false); // khoá
		expect(s.tap(300)).toBe(true);
		expect(s.tap(600)).toBe(true);
		expect(s.done).toBe(true);
		expect(s.tap(10_000)).toBe(false);
		expect(shakeTo(s, 'x', A, 20_000).counted).toBe(false);
	});
});
