import { type ClusterName, MAX_STACK, stackClusters } from './result-stack';

/** Vật có thể dời theo trục dọc (container/image/text của Phaser đều thoả). */
export interface Movable {
	y: number;
}

export interface Cluster<T extends Movable = Movable> {
	name: ClusterName;
	/** Con trực tiếp của container giữa; cả cụm dời cùng một độ dời dọc. */
	objs: T[];
	/** Thuộc `objs` nhưng không tính vào bounds (halo / glow) — vẫn dời theo cụm. */
	skip?: object[];
}

/** Khoảng dọc thật (đơn vị cục bộ của container giữa) hoặc null nếu cụm không có gì nhìn thấy. */
export type MeasureY = (c: Cluster) => { minY: number; maxY: number } | null;

export interface LayoutReport {
	totalDesign: number;
	clusters: { name: ClusterName; heightDesign: number; topDesign: number }[];
	gaps: number[];
	gapFactor: number;
	/** Hệ số thu cả popup (nhân vào RESULT_SCALE); 1 = không thu. */
	fitScale: number;
}

const baseY = new WeakMap<object, number>();

/**
 * Đo từng cụm, xếp theo `stackClusters`, dời `objs` để cả chồng căn giữa gốc container (= tâm view 720x1280).
 * Idempotent: lần đầu nhớ y gốc của mỗi vật, các lần sau tính lại từ y gốc (gọi lại khi hạng về / ẩn).
 * `scale` = hệ số cục bộ → design (RESULT_SCALE). Cụm không có gì nhìn thấy bị bỏ qua.
 */
export function layoutClusters(
	clusters: readonly Cluster[],
	measure: MeasureY,
	scale: number,
	maxStack = MAX_STACK,
): LayoutReport {
	for (const c of clusters)
		for (const o of c.objs) {
			if (baseY.has(o)) o.y = baseY.get(o) as number;
			else baseY.set(o, o.y);
		}
	const live = clusters.flatMap((c) => {
		const b = measure(c);
		return b ? [{ c, b, h: (b.maxY - b.minY) * scale }] : [];
	});
	const r = stackClusters(
		live.map((x) => ({ name: x.c.name, height: x.h })),
		maxStack,
	);
	live.forEach((x, i) => {
		const dy = (r.tops[i] - x.b.minY * scale) / scale;
		for (const o of x.c.objs) o.y += dy;
	});
	return {
		totalDesign: Math.round(r.total),
		clusters: live.map((x, i) => ({
			name: x.c.name,
			heightDesign: Math.round(x.h),
			topDesign: Math.round(r.tops[i]),
		})),
		gaps: r.gaps,
		gapFactor: r.gapFactor,
		fitScale: Math.round(r.fitScale * 1000) / 1000,
	};
}
