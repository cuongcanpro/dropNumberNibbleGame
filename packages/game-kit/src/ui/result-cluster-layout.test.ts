import { describe, expect, it } from 'vitest';
import { type Cluster, layoutClusters, type MeasureY } from './result-cluster-layout';

/** Vật giả: tâm y + cao h ⇒ bounds [y - h/2, y + h/2]. */
const obj = (y: number, h: number) => ({ y, h });
const measure: MeasureY = (c) => {
	const items = c.objs as { y: number; h: number }[];
	if (items.every((o) => o.h === 0)) return null;
	return {
		minY: Math.min(...items.map((o) => o.y - o.h / 2)),
		maxY: Math.max(...items.map((o) => o.y + o.h / 2)),
	};
};
const cl = (name: string, ...objs: { y: number; h: number }[]): Cluster =>
	({ name, objs }) as Cluster;

const top = (o: { y: number; h: number }) => o.y - o.h / 2;

describe('layoutClusters', () => {
	it('xếp title→main→rank→buttons, gap thật, căn giữa', () => {
		const t = obj(-300, 100);
		const m = obj(500, 200);
		const r = obj(0, 80);
		const b = obj(7, 90);
		const rep = layoutClusters(
			[cl('title', t), cl('main', m), cl('rank', r), cl('buttons', b)],
			measure,
			1,
		);
		expect(rep.gaps).toEqual([44, 48, 64]);
		expect(rep.totalDesign).toBe(100 + 200 + 80 + 90 + 156);
		expect(top(t)).toBe(-rep.totalDesign / 2);
		expect(top(m) - (top(t) + 100)).toBe(44);
		expect(top(r) - (top(m) + 200)).toBe(48);
		expect(top(b) - (top(r) + 80)).toBe(64);
		expect(top(b) + 90).toBe(rep.totalDesign / 2);
	});
	it('thứ tự mảng = thứ tự xếp, kể cả hero/custom', () => {
		const names = ['title', 'hero', 'main', 'custom', 'rank', 'buttons'];
		const objs = names.map(() => obj(0, 50));
		layoutClusters(
			names.map((n, i) => cl(n, objs[i])),
			measure,
			1,
		);
		const ys = objs.map((o) => o.y);
		expect([...ys].sort((a, b) => a - b)).toEqual(ys);
	});
	it('cụm rỗng/ẩn bị bỏ: không để lại ô trống', () => {
		const a = obj(0, 100);
		const b = obj(0, 100);
		const rep = layoutClusters(
			[cl('main', a), cl('rank', obj(0, 0)), cl('buttons', b)],
			measure,
			1,
		);
		expect(rep.gaps).toEqual([56]);
		expect(rep.clusters.map((c) => c.name)).toEqual(['main', 'buttons']);
	});
	it('idempotent: gọi lại (rank về/ẩn) tính từ y gốc', () => {
		const a = obj(10, 100);
		const rank = obj(0, 80);
		const b = obj(0, 90);
		const list = [cl('main', a), cl('rank', rank), cl('buttons', b)];
		const first = layoutClusters(list, measure, 1);
		const again = layoutClusters(list, measure, 1);
		expect(again).toEqual(first);
		rank.h = 0; // hạng offline → ẩn
		const noRank = layoutClusters(list, measure, 1);
		expect(noRank.gaps).toEqual([56]);
		expect(a.y - 50).toBe(-noRank.totalDesign / 2);
	});
	it('scale cục bộ→design: gap tính theo design', () => {
		const a = obj(0, 100); // 100 local = 112.5 design
		const b = obj(0, 80);
		const rep = layoutClusters([cl('main', a), cl('buttons', b)], measure, 1.125);
		expect(rep.totalDesign).toBe(Math.round(180 * 1.125 + 56));
		expect((b.y - 40 - (a.y + 50)) * 1.125).toBeCloseTo(56, 5);
	});
	it('fit: quá cao ⇒ fitScale < 1 và gap co', () => {
		const rep = layoutClusters(
			[cl('title', obj(0, 400)), cl('main', obj(0, 400)), cl('buttons', obj(0, 500))],
			measure,
			1,
		);
		expect(rep.gapFactor).toBe(0.75);
		expect(rep.fitScale).toBeLessThan(1);
	});
});
