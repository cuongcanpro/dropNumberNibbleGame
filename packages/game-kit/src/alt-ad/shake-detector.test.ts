import { describe, expect, it } from 'vitest';
import { createShakeDetector, directionOf, GRAVITY_MS2 } from './shake-detector';

describe('shake-detector', () => {
	it('đổi đơn vị m/s² → g: ngưỡng 1.5g ≈ 14.7 m/s²', () => {
		expect(1.5 * GRAVITY_MS2).toBeCloseTo(14.715, 3);
		const d = createShakeDetector();
		// Δ = 14.6 m/s² ≈ 1.488g < 1.5 → không lắc; Δ = 14.8 ≈ 1.509g → lắc.
		expect(d.feed({ x: 14.6, y: 0, z: 0 }, 1000)).toBeNull();
		d.reset();
		const ev = d.feed({ x: 14.8, y: 0, z: 0 }, 1000);
		expect(ev?.force).toBeCloseTo(14.8 / 9.81, 5);
	});

	it('unitDivisor=1: mẫu đã là g', () => {
		const d = createShakeDetector({ unitDivisor: 1 });
		expect(d.feed({ x: 1.4, y: 0, z: 0 }, 0)).toBeNull();
		expect(d.feed({ x: 1.4, y: 1.6, z: 0 }, 500)?.direction).toBe('up');
	});

	it('dưới ngưỡng bị bỏ qua, bằng ngưỡng cũng không (Cocos dùng >)', () => {
		const d = createShakeDetector({ unitDivisor: 1 });
		expect(d.feed({ x: 1.5, y: 0, z: 0 }, 0)).toBeNull();
	});

	it('interval 100ms: lần thứ hai trong 100ms bị chặn, sau 100ms thì qua', () => {
		const d = createShakeDetector({ unitDivisor: 1 });
		expect(d.feed({ x: 2, y: 0, z: 0 }, 1000)).not.toBeNull();
		expect(d.feed({ x: -2, y: 0, z: 0 }, 1100)).toBeNull(); // đúng 100ms: chưa đủ (>)
		expect(d.feed({ x: 2, y: 0, z: 0 }, 1201)).not.toBeNull();
	});

	it('hướng theo trục |Δ| lớn hơn', () => {
		expect(directionOf(3, 1)).toBe('right');
		expect(directionOf(-3, 1)).toBe('left');
		expect(directionOf(1, 3)).toBe('up');
		expect(directionOf(1, -3)).toBe('down');
		expect(directionOf(2, 2)).toBe('unknown');
	});
});
