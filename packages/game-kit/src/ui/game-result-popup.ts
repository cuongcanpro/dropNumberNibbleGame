import type Phaser from 'phaser';
import { Sound } from '../platform/sound';
import type { RankView } from '../rank/rank-client';
import { canShare } from '../shell/share';
import { installDevHooks } from './dev-hooks';
import { buildResultButtons, type ResultButtons } from './game-result-popup-buttons';
import {
	applyResultView,
	buildResultContent,
	type ResultContent,
} from './game-result-popup-content';
import { buildEntrancePlan, playResultEntrance } from './game-result-popup-entrance';
import { createResultStack } from './game-result-popup-stack';
import { kitConfig } from './kit-config-client';
import { createOverlay, type Overlay } from './overlay-base';
import type { ResultExtensions } from './result-extensions';
import { type GameResultData, RESULT_FOG, RESULT_SCALE, resolveResultView } from './result-layout';
import { ResultRankBlock } from './result-rank-block';
import type { UiButton } from './widgets';

export type {
	ResultExtensions,
	ResultPart,
	ResultSecondaryButton,
} from './result-extensions';
export type { GameResultData } from './result-layout';

export interface GameResultPopupOptions {
	onReplay: () => void;
	/**
	 * KHÔNG còn nút Home trên popup (luật kit, 13/10): thoát về host đã có nút Exit ở Setting.
	 * Giữ trường này để game cũ vẫn biên dịch; nếu có thì chỉ làm hành động của phím Back (đóng popup rồi gọi nó).
	 */
	onHome?: () => void;
	/** Nút Share chỉ hiện khi có callback này VÀ `canShare()` (native chưa chắc có navigator.share). */
	onShare?: () => void;
	/** Key sfx (đã nạp) phát khi hiện popup. */
	sfxGameOverPath?: string;
	/** Nhãn nút xanh, mặc định `Replay`. Từng ván đổi được qua `show(data, { primaryLabel })`. */
	replayLabel?: string;
}

/**
 * Popup kết quả dùng chung (port Cocos `GameResultPopup`, 4 chế độ: new-best / game-over /
 * level-clear / level-failed). Bố cục theo cụm (xem `result-stack.ts`): kit đo bounds thật rồi xếp,
 * game gắn phần riêng qua `show(data, ext)` (`ResultExtensions`). Rank là phần phụ: `show` hiện NGAY, mạng
 * trả về thì gọi `applyRank(view)`; `null` (offline) ⇒ ẩn khối hạng và xếp lại không chừa ô trống.
 * Back key = `onHome` nếu có, không thì nuốt (popup không tự đóng được).
 */
export class GameResultPopup {
	private readonly scene: Phaser.Scene;
	private readonly opts: GameResultPopupOptions;
	private overlay: Overlay | null = null;
	private center: Phaser.GameObjects.Container | null = null;
	private content: ResultContent | null = null;
	private rank: ResultRankBlock | null = null;
	private buttons: ResultButtons | null = null;
	private restack: ((withRank: boolean) => void) | null = null;
	private fitScale = 1;
	private readonly rankOff: boolean;
	private readonly consoleLabel: string | undefined;
	private rankLaid = false;
	private pendingRank: RankView | null | undefined;

	constructor(scene: Phaser.Scene, opts: GameResultPopupOptions) {
		this.scene = scene;
		// Kit-config (Console) chỉ TẮT nút / đổi nhãn; game vẫn quyết có handler hay không. 'off' ẩn khối hạng.
		installDevHooks();
		const cfg = kitConfig();
		this.rankOff = cfg.rank.layout !== 'block'; // off: không UI hạng
		const { onShare, onHome, replayLabel, ...rest } = opts;
		this.consoleLabel = cfg.result.replayLabel;
		this.opts = {
			...rest,
			...(onShare && cfg.result.showShare ? { onShare } : {}),
			...(onHome && cfg.result.showHome ? { onHome } : {}), // chỉ cho phím Back, không có nút
			...(replayLabel ? { replayLabel } : {}),
		};
	}

	getReplayButton(): UiButton | null {
		return this.buttons?.primary ?? null;
	}
	getShareButton(): UiButton | null {
		return this.buttons?.share ?? null;
	}
	getSecondaryButton(): UiButton | null {
		return this.buttons?.secondary ?? null;
	}

	show(data: GameResultData, ext: ResultExtensions = {}): void {
		if (this.overlay) return;
		const { scene, opts } = this;
		const overlay = createOverlay(scene, RESULT_FOG);
		const center = scene.add.container(overlay.center.x, overlay.center.y);
		const content = buildResultContent(scene, center);
		const view = resolveResultView(data);
		applyResultView(content, view, { title: !!ext.title, info: !!ext.info });
		const parts = [ext.title, ext.hero, ext.info === 'none' ? undefined : ext.info, ext.custom];
		for (const p of parts) if (p) center.add(p);

		const wantRank = !this.rankOff && ext.rank !== false;
		const rank = new ResultRankBlock(scene, 14, 0);
		center.add(rank.root);
		if (wantRank && this.pendingRank !== undefined) rank.apply(this.pendingRank);
		const buttons = buildResultButtons(scene, center, {
			showShare: !!opts.onShare && canShare(),
			// Console thắng; rồi nhãn từng ván; rồi nhãn mặc định của game.
			primaryLabel: this.consoleLabel ?? ext.primaryLabel ?? opts.replayLabel ?? 'Replay',
			secondary: ext.secondary,
			onShare: () => this.onShare(),
			onPrimary: () => this.close(opts.onReplay),
			onSecondary: () => ext.secondary && this.close(ext.secondary.onClick),
		});
		this.rank = wantRank ? rank : null;
		if (!wantRank) rank.root.setVisible(false);

		const stack = createResultStack(center, {
			content,
			ext,
			rankRoot: rank.root,
			buttonRoots: buttons.all.map((b) => b.root),
		});
		// Chưa biết hạng ⇒ chừa chỗ; đã biết là null (offline) ⇒ không chừa.
		this.rankLaid = wantRank && this.pendingRank !== null;
		this.fitScale = stack.apply(this.rankLaid).fitScale;
		this.restack = (withRank) => void stack.apply(withRank);

		overlay.root.add(center);
		this.overlay = overlay;
		this.center = center;
		this.content = content;
		this.buttons = buttons;
		overlay.open(
			center,
			() => (opts.onHome ? this.close(opts.onHome) : undefined),
			this.targetScale(),
		);
		playResultEntrance(
			scene,
			buildEntrancePlan(content, ext, this.rank?.root ?? null, buttons.all, view.halo && !ext.info),
		);
		if (opts.sfxGameOverPath) Sound.getInstance().playSfx(opts.sfxGameOverPath);
	}

	private targetScale(): number {
		return RESULT_SCALE * this.fitScale;
	}

	/** Hạng thật từ Console tới sau khi popup đã mở. `null` ⇒ ẩn khối hạng và xếp lại, KHÔNG bịa số. */
	applyRank(view: RankView | null): void {
		this.pendingRank = view;
		if (this.rankOff || !this.rank) return;
		this.rank.apply(view);
		if ((view !== null) !== this.rankLaid) {
			this.rankLaid = view !== null;
			this.restack?.(this.rankLaid);
		}
	}

	private onShare(): void {
		if (this.overlay?.isClosing()) return;
		this.opts.onShare?.();
	}

	/**
	 * Huỷ popup ngay, không animate và KHÔNG gọi onReplay/onHome (dùng khi scene tự chuyển màn, hoặc
	 * hạng mạng về muộn sau khi popup đã bỏ). An toàn gọi lặp / trước `show`.
	 */
	destroy(): void {
		const { overlay, content } = this;
		if (content) this.scene.tweens.killTweensOf(content.halo);
		overlay?.destroy();
		this.reset();
	}

	private reset(): void {
		this.overlay = null;
		this.center = null;
		this.content = null;
		this.rank = null;
		this.buttons = null;
		this.restack = null;
	}

	private close(then: () => void): void {
		if (!this.overlay || !this.center || this.overlay.isClosing()) return;
		const overlay = this.overlay;
		if (this.content) this.scene.tweens.killTweensOf(this.content.halo);
		overlay.close(
			this.center,
			() => {
				this.reset();
				then();
			},
			this.targetScale(),
		);
	}
}
