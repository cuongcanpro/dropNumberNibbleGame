import { fetchResultRank } from '@repo/game-kit/rank';
import { canShare, rankLayoutOf, shareGame } from '@repo/game-kit/shell';
import { GameResultPopup, kitConfig } from '@repo/game-kit/ui';
import type Phaser from 'phaser';
import { GAME_SLUG } from '../config/game-config';

export interface ResultFlowOptions {
	readonly score: number;
	readonly bestScore: number;
	readonly isNewBest: boolean;
	/** Extra line between the score and the rank (the best block of the round). */
	readonly custom?: Phaser.GameObjects.Text;
	readonly onReplay: () => void;
	readonly onHome: () => void;
	/** `collector.recordShare('game_over')` — chỉ gọi khi share thật sự thành công. */
	readonly onShared: () => void;
}

/**
 * Popup kết quả: hiện NGAY, hạng (leaderboard) tới sau khi mạng trả về. `fetchResultRank` trả `null`
 * khi offline/SDK tắt/timeout ⇒ popup tự ẩn khối hạng, game không phải xử lý lỗi mạng.
 * Nút Share chỉ hiện khi `canShare()` (native chưa chắc có `navigator.share`).
 *
 * Hạng theo Console (kit-config `rank.layout`): popup của kit tự lo `block` (khối trophy), `full` (nút "Xem
 * bảng xếp hạng") và `off`, nên chỉ gọi mạng khi là `block`. Game có màn kết quả RIÊNG (không dùng
 * `GameResultPopup`) thì gọi `mountRank(scene, { score, container, x, y })` của `@repo/game-kit/ui`: một lời
 * gọi, Console quyết dạng hiển thị, thay cho tự dựng `ResultRankBlock` + `fetchResultRank`.
 */
export function showResult(scene: Phaser.Scene, options: ResultFlowOptions): GameResultPopup {
	const popup = new GameResultPopup(scene, {
		onReplay: options.onReplay,
		onHome: options.onHome,
		onShare: () => {
			if (!canShare()) return;
			void shareGame({ gameId: GAME_SLUG }).then((result) => {
				if (result === 'shared') options.onShared();
			});
		},
	});
	popup.show(
		{
			score: options.score,
			bestScore: options.bestScore,
			isNewBest: options.isNewBest,
		},
		options.custom ? { custom: options.custom } : {},
	);
	if (rankLayoutOf(kitConfig()) === 'block') {
		void fetchResultRank(options.score).then((view) => popup.applyRank(view));
	}
	return popup;
}
