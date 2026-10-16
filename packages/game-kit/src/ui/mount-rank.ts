import type Phaser from 'phaser';
import type { RankView } from '../rank/rank-client';
import { fetchResultRank } from '../rank/result-rank';
import type { RankBoardName, RankLayout } from '../shell/kit-config';
import { rankBoardOf, rankLayoutOf } from '../shell/kit-config-rules';
import { installDevHooks } from './dev-hooks';
import { kitConfig } from './kit-config-client';
import { ResultRankBlock } from './result-rank-block';

export interface MountRankOptions {
	/** Điểm vừa đạt (bắt buộc: event chưa flush lúc result mở). */
	score: number;
	/** Mặc định của game; kit-config `rank.board` ghi đè. */
	board?: RankBoardName;
	/** Ghi đè mode của game-context ('' = không mode); xem `fetchResultRank`. */
	mode?: string;
	/** Nơi gắn khối (mặc định thêm thẳng vào scene). */
	container?: Phaser.GameObjects.Container;
	/** Vị trí khối trong container (layout `block`). */
	x?: number;
	y?: number;
	/** Layout `block`: chạy khi hạng về (`null` = offline/timeout, khối đã ẩn) để result riêng thu gọn chỗ trống. */
	onRank?: (view: RankView | null) => void;
}

export interface MountedRank {
	/**
	 * Dạng Console chọn. `'off'` ⇒ không có UI hạng nào được dựng: result riêng nên thu gọn / căn lại
	 * vùng giữa thay vì để chỗ trống.
	 */
	layout: RankLayout;
	/** Gỡ khối / đóng panel. An toàn gọi nhiều lần. */
	destroy(): void;
}

/**
 * MỘT lời gọi ở result cho mọi game, kể cả game có màn result riêng: Console quyết dạng hiển thị
 * (kit-config `rank.layout`): `block` gắn khối trophy vào `container`,
 * `off` không làm gì (không gọi mạng). Kỳ luôn alltime. Mạng lỗi ⇒ block ẩn / panel báo không có.
 */
export function mountRank(scene: Phaser.Scene, opts: MountRankOptions): MountedRank {
	installDevHooks();
	const cfg = kitConfig();
	const layout = rankLayoutOf(cfg);
	const board = rankBoardOf(cfg, opts.board);
	if (layout === 'off') return { layout, destroy: () => undefined };
	const block = new ResultRankBlock(scene, opts.x, opts.y);
	opts.container?.add(block.root);
	let alive = true;
	void fetchResultRank(opts.score, {
		board,
		period: 'alltime',
		...(opts.mode !== undefined && { mode: opts.mode }),
	}).then((view) => {
		if (!alive || !block.root.active) return;
		block.apply(view);
		opts.onRank?.(view);
	});
	return {
		layout,
		destroy: () => {
			alive = false;
			if (block.root.active) block.root.destroy();
		},
	};
}
