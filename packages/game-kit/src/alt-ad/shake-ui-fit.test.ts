import { describe, expect, it } from 'vitest';
import { fitFontSize } from './shake-ui-fit';

/** Mô hình đo: mỗi dòng chứa `width / (size × 0.5)` ký tự, cao `size × 1.3`. */
const measure = (chars: number, width: number) => (size: number) => {
	const perLine = Math.floor(width / (size * 0.5));
	return Math.ceil(chars / perLine) * size * 1.3;
};

describe('fitFontSize', () => {
	it('câu ngắn giữ nguyên cỡ mong muốn', () => {
		expect(fitFontSize(measure(40, 600), 290, 40, 24)).toBe(40);
	});
	it('câu dài co dần cho vừa chiều cao', () => {
		const m = measure(140, 600);
		const maxH = 200;
		const size = fitFontSize(m, maxH, 40, 24);
		expect(size).toBeLessThan(40);
		expect(size).toBeGreaterThanOrEqual(24);
		expect(m(size)).toBeLessThanOrEqual(maxH);
	});
	it('không bao giờ xuống dưới sàn kể cả khi không vừa', () => {
		expect(fitFontSize(measure(5000, 600), 100, 40, 24)).toBe(24);
	});
});
