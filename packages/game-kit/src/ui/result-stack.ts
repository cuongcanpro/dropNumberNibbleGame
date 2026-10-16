/**
 * Xếp các cụm của popup kết quả theo chiều dọc (phần THUẦN, không đụng Phaser — đo bounds ở `result-bounds.ts`).
 * Cụm từ trên xuống: title · hero? · main? · custom? · rank? · buttons. Đơn vị = design (720x1280).
 */
export type ClusterName = 'title' | 'hero' | 'main' | 'custom' | 'rank' | 'buttons';

export const GAP = {
	/** title → hero (hero nằm trong cụm tiêu đề nên sát hơn) */
	titleHero: 12,
	/** title/hero → cụm kế tiếp (main hoặc custom) */
	titleMain: 44,
	/** main → custom, custom/main → rank */
	mainCustom: 48,
	toRank: 48,
	/** rank → nút: cố ý rộng nhất, hạng không được dính nút */
	rankButtons: 64,
	/** không có rank: cụm trước → nút */
	toButtons: 56,
} as const;

/** Cao tối đa (design) trước khi thu cả popup; view 9:16 cao 1280. */
export const MAX_STACK = 1220;
/** Quá cao thì gap được co tới tỉ lệ này trước khi phải thu popup. */
export const MIN_GAP_FACTOR = 0.75;

export interface StackItem {
	name: ClusterName;
	height: number;
}

export interface StackResult {
	/** Mép trên mỗi cụm (design, gốc 0 = tâm view, trải đều quanh 0). */
	tops: number[];
	/** gaps[i] = khoảng giữa cụm i và i+1 (đã co nếu cần). */
	gaps: number[];
	total: number;
	/** 1 = gap nguyên; <1 khi đã co (sàn MIN_GAP_FACTOR). */
	gapFactor: number;
	/** 1 = vừa; <1 = hệ số thu cả popup khi co gap vẫn chưa đủ. */
	fitScale: number;
}

export function gapBetween(a: ClusterName, b: ClusterName): number {
	if (b === 'buttons') return a === 'rank' ? GAP.rankButtons : GAP.toButtons;
	if (b === 'rank') return GAP.toRank;
	if (a === 'title' && b === 'hero') return GAP.titleHero;
	if (a === 'title' || a === 'hero') return GAP.titleMain;
	return GAP.mainCustom;
}

export function stackClusters(items: readonly StackItem[], maxStack = MAX_STACK): StackResult {
	const base = items.slice(1).map((it, i) => gapBetween(items[i].name, it.name));
	const sumH = items.reduce((n, it) => n + it.height, 0);
	const sumG = base.reduce((n, g) => n + g, 0);
	let gapFactor = 1;
	let gaps = base;
	if (sumH + sumG > maxStack && sumG > 0) {
		gapFactor = Math.max(MIN_GAP_FACTOR, (maxStack - sumH) / sumG);
		gaps = base.map((g) => Math.round(g * gapFactor));
	}
	const total = sumH + gaps.reduce((n, g) => n + g, 0);
	const tops: number[] = [];
	let y = -total / 2;
	items.forEach((it, i) => {
		tops.push(y);
		y += it.height + (gaps[i] ?? 0);
	});
	return {
		tops,
		gaps,
		total,
		gapFactor: Math.round(gapFactor * 100) / 100,
		fitScale: total > maxStack ? maxStack / total : 1,
	};
}
