import type Phaser from 'phaser';
import type { Cluster } from './result-cluster-layout';
import { getLayoutBounds, type LayoutRows } from './result-layout-bounds';

/**
 * Đo mép dọc của một cụm (đơn vị cục bộ của container giữa) CHỈ từ dữ liệu tất định, không đọc pixel/canvas,
 * để web và Nibi native ra CÙNG số: ảnh = khung (art của kit đã cắt sát; art game có viền trong suốt thì báo
 * `setLayoutBounds`), chữ = `height` của Text trừ phần line-height trống (TEXT_INSET). Halo/glow đi qua `skip`.
 */

/** Phần line-height trống trên/dưới glyph, theo cỡ chữ (font Baloo của kit). */
export const TEXT_INSET = 0.1;

type Range = { minY: number; maxY: number };

function growY(out: Range, ys: number[]): void {
	for (const y of ys) {
		out.minY = Math.min(out.minY, y);
		out.maxY = Math.max(out.maxY, y);
	}
}

/** Mép dọc của một vật theo hệ của chính vật (trước transform). */
function ownRows(o: Phaser.GameObjects.GameObject): LayoutRows | null {
	const explicit = getLayoutBounds(o);
	if (explicit) return explicit;
	if (o.type === 'Image') {
		const img = o as Phaser.GameObjects.Image;
		const h = img.frame.cutHeight;
		const top = -img.originY * h;
		return { top, bottom: top + h };
	}
	if (o.type === 'Text') {
		const t = o as Phaser.GameObjects.Text;
		const pad = (Number.parseFloat(String(t.style.fontSize)) || 0) * TEXT_INSET;
		const top = -t.originY * t.height;
		return { top: top + pad, bottom: top + t.height - pad };
	}
	return null;
}

function walk(
	o: Phaser.GameObjects.GameObject,
	inv: Phaser.GameObjects.Components.TransformMatrix,
	skip: Set<object>,
	out: Range,
): void {
	const g = o as Phaser.GameObjects.GameObject & { visible: boolean; alpha: number };
	if (skip.has(o) || !g.visible || g.alpha === 0) return;
	const rows = ownRows(o);
	const list = (o as Phaser.GameObjects.Container).list;
	if (!rows && Array.isArray(list)) {
		for (const c of list) walk(c, inv, skip, out);
		return;
	}
	if (!rows) return;
	// Chỉ cần y: hai mép ở x=0 (transform của popup chỉ scale/dời, không xoay).
	const m = (o as Phaser.GameObjects.Image).getWorldTransformMatrix();
	growY(
		out,
		[rows.top, rows.bottom].map((y) => inv.applyInverse(m.tx + m.c * y, m.ty + m.d * y).y),
	);
}

/** Bộ đo cho `layoutClusters` — `center` là container giữa của popup. */
export function measureCluster(center: Phaser.GameObjects.Container): (c: Cluster) => Range | null {
	return (c) => {
		const inv = center.getWorldTransformMatrix();
		const out: Range = { minY: 1e9, maxY: -1e9 };
		const skip = new Set<object>(c.skip ?? []);
		for (const o of c.objs) walk(o as unknown as Phaser.GameObjects.GameObject, inv, skip, out);
		return out.maxY < out.minY ? null : out;
	};
}
