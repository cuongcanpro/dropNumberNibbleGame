import type Phaser from 'phaser';
import type { ResultContent } from './game-result-popup-content';
import { measureCluster } from './result-bounds';
import {
	type Cluster,
	type LayoutReport,
	layoutClusters,
	type MeasureY,
} from './result-cluster-layout';
import type { ResultExtensions } from './result-extensions';
import { RESULT_SCALE } from './result-layout';
import type { ClusterName } from './result-stack';

type Obj = Phaser.GameObjects.Container;

export interface StackParts {
	content: ResultContent;
	ext: ResultExtensions;
	rankRoot: Obj;
	buttonRoots: Obj[];
}

export interface ResultStack {
	/** Xếp lại theo có/không khối hạng; số đo lấy từ lần đầu (an toàn khi tween vào đang chạy, scale 0). */
	apply(withRank: boolean): LayoutReport;
}

/**
 * Gom vật của popup thành cụm title · hero · main · custom · rank · buttons và xếp bằng `layoutClusters`.
 * Số đo của từng cụm chỉ lấy MỘT lần (khi còn ở vị trí gốc, rank được bật tạm để đo nếu chưa có hạng) rồi dùng lại.
 */
const make = (name: ClusterName, objs: Cluster['objs']): Cluster[] =>
	objs.length ? [{ name, objs }] : [];

export function createResultStack(center: Obj, parts: StackParts): ResultStack {
	const { content: c, ext, rankRoot, buttonRoots } = parts;
	const main: Cluster | null =
		ext.info === 'none'
			? null
			: ext.info
				? { name: 'main', objs: [ext.info] }
				: { name: 'main', objs: [c.infoBig, c.infoChip, c.extraLine], skip: [c.halo] };
	const clusters = (withRank: boolean): Cluster[] => [
		...make(
			'title',
			ext.title ? [ext.title, c.titleWin, c.titleGameOver] : [c.titleWin, c.titleGameOver],
		),
		...make('hero', ext.hero ? [ext.hero] : []),
		...(main ? [main] : []),
		...make('custom', ext.custom ? [ext.custom] : []),
		...(withRank ? make('rank', [rankRoot]) : []),
		...make('buttons', buttonRoots),
	];
	const raw = measureCluster(center);
	const memo = new Map<ClusterName, ReturnType<MeasureY>>();
	const measure: MeasureY = (cl) => {
		if (!memo.has(cl.name)) {
			const forced = cl.name === 'rank' && !rankRoot.visible;
			if (forced) rankRoot.setVisible(true);
			memo.set(cl.name, raw(cl));
			if (forced) rankRoot.setVisible(false);
		}
		return memo.get(cl.name) ?? null;
	};
	// Đo hết ngay khi còn ở vị trí gốc: tween vào (scale 0) / rank ẩn sẽ làm số đo sai nếu để muộn.
	for (const cl of clusters(true)) measure(cl);
	return { apply: (withRank) => layoutClusters(clusters(withRank), measure, RESULT_SCALE) };
}
