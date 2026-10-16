import { describe, expect, it } from 'vitest';
import { GAP, gapBetween, MAX_STACK, stackClusters } from './result-stack';

const item = (name: string, height: number) => ({ name: name as never, height });

describe('gapBetween', () => {
	it('bảng gap đã duyệt', () => {
		expect(gapBetween('title', 'main')).toBe(44);
		expect(gapBetween('main', 'custom')).toBe(48);
		expect(gapBetween('custom', 'rank')).toBe(48);
		expect(gapBetween('main', 'rank')).toBe(48);
		expect(gapBetween('rank', 'buttons')).toBe(64);
		expect(gapBetween('main', 'buttons')).toBe(56); // không rank
		expect(gapBetween('custom', 'buttons')).toBe(56);
		expect(gapBetween('title', 'hero')).toBe(GAP.titleHero);
		expect(gapBetween('hero', 'main')).toBe(44);
		expect(gapBetween('title', 'custom')).toBe(44); // không có main
	});
});

describe('stackClusters', () => {
	it('căn giữa quanh 0, đúng thứ tự và gap', () => {
		const r = stackClusters([
			item('title', 100),
			item('main', 200),
			item('rank', 80),
			item('buttons', 90),
		]);
		expect(r.gaps).toEqual([44, 48, 64]);
		expect(r.total).toBe(100 + 200 + 80 + 90 + 44 + 48 + 64);
		expect(r.tops[0]).toBe(-r.total / 2);
		expect(r.tops[1]).toBe(r.tops[0] + 100 + 44);
		expect(r.tops[3] + 90).toBe(r.total / 2); // đáy chạm nửa dưới
		expect(r.gapFactor).toBe(1);
		expect(r.fitScale).toBe(1);
	});
	it('không rank: gap tới nút = 56', () => {
		expect(stackClusters([item('main', 10), item('buttons', 10)]).gaps).toEqual([56]);
	});
	it('cao quá: co gap (sàn 0.75) rồi mới thu popup', () => {
		// sumH 1150, gap gốc 44+48+64=156 → cần 70 ⇒ factor 0.449 kẹp 0.75
		const heights = [
			item('title', 350),
			item('main', 300),
			item('rank', 200),
			item('buttons', 300),
		];
		const r = stackClusters(heights);
		expect(r.gapFactor).toBe(0.75);
		expect(r.gaps).toEqual([33, 36, 48]);
		expect(r.total).toBe(1150 + 117);
		expect(r.fitScale).toBeCloseTo(MAX_STACK / 1267, 5);
	});
	it('co gap đủ thì KHÔNG thu popup', () => {
		const r = stackClusters([
			item('title', 400),
			item('main', 360),
			item('rank', 200),
			item('buttons', 190),
		]);
		// sumH 1150, gap 156 → 1306 > 1220 ; factor (1220-1150)/156=0.449 → kẹp 0.75 → vẫn thu
		expect(r.fitScale).toBeLessThan(1);
		const ok = stackClusters([
			item('title', 380),
			item('main', 330),
			item('rank', 150),
			item('buttons', 230),
		]);
		// sumH 1090 + 156 = 1246 > 1220 ; factor 0.833 ⇒ co đủ
		expect(ok.gapFactor).toBeCloseTo(0.83, 2);
		expect(ok.total).toBeLessThanOrEqual(1220);
		expect(ok.fitScale).toBe(1);
	});
	it('rỗng / 1 cụm', () => {
		expect(stackClusters([]).total).toBe(0);
		expect(stackClusters([item('main', 100)]).tops).toEqual([-50]);
	});
});
