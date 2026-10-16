import type Phaser from 'phaser';
import { type GameSettingTheme, resolveSettingTheme, themeTitleStyle } from './game-setting-theme';
import { kitConfig } from './kit-config-client';
import { createOverlay, type Overlay } from './overlay-base';
import { addThemedBoard } from './themed-board';
import { FONT_LILITA_STACK } from './ui-fonts';
import { uiKey } from './ui-keys';
import { makeButton, makeText } from './widgets';

export interface ExitConfirmDialogOptions {
	title?: string;
	message?: string;
	yesLabel?: string;
	noLabel?: string;
	/** Không còn tác dụng (màu panel theo màu game); giữ để game cũ khỏi vỡ kiểu. */
	gameId?: string;
	/** Theme riêng của game, cùng thứ tự ưu tiên với Setting. */
	theme?: GameSettingTheme;
	onConfirm: () => void;
	onCancel?: () => void;
}

const PANEL_W = 600;
const PANEL_H = 360;
const SLICE = 120;

/** Cocos y-up gốc dưới-trái panel 600x360 → Phaser gốc tâm, y-down. */
const at = (x: number, yCocos: number) => ({ x: x - PANEL_W / 2, y: PANEL_H / 2 - yCocos });

/**
 * Hộp xác nhận thoát (Back/Escape khi không còn popup nào). Dựng + mở ngay trong constructor.
 * Tự đăng ký back handler: back = Cancel, nên bấm back hai lần liên tiếp = mở rồi đóng.
 */
export class ExitConfirmDialog {
	private readonly scene: Phaser.Scene;
	private readonly opts: ExitConfirmDialogOptions;
	private readonly overlay: Overlay;
	private readonly panel: Phaser.GameObjects.Container;

	constructor(scene: Phaser.Scene, opts: ExitConfirmDialogOptions) {
		this.scene = scene;
		this.opts = opts;
		this.overlay = createOverlay(scene);
		this.panel = scene.add.container(this.overlay.center.x, this.overlay.center.y);
		this.build();
		this.overlay.root.add(this.panel);
		this.overlay.open(this.panel, () => this.cancel());
	}

	/** Tiện dụng: tạo + mở, trả về dialog. */
	static show(
		scene: Phaser.Scene,
		onConfirm: () => void,
		opts?: Partial<ExitConfirmDialogOptions>,
	): ExitConfirmDialog {
		return new ExitConfirmDialog(scene, { ...opts, onConfirm });
	}

	close(done?: () => void): void {
		this.overlay.close(this.panel, done);
	}

	private build(): void {
		const { scene, panel } = this;
		// Chữ: kit-config Console > game truyền > mặc định Cocos.
		const cfg = kitConfig().exit;
		const opts = {
			...this.opts,
			title: cfg.title ?? this.opts.title,
			message: cfg.message ?? this.opts.message,
			yesLabel: cfg.yesLabel ?? this.opts.yesLabel,
			noLabel: cfg.noLabel ?? this.opts.noLabel,
		};
		const theme = resolveSettingTheme(this.opts);
		addThemedBoard(scene, panel, theme, { width: PANEL_W, height: PANEL_H, slice: SLICE });
		panel.add(
			makeText(scene, {
				...at(300, 320),
				text: opts.title ?? 'Exit?',
				size: 50,
				...themeTitleStyle(theme),
			}),
		);
		panel.add(
			makeText(scene, {
				...at(300, 210),
				text: opts.message ?? 'Return to the home screen?',
				size: 36,
				font: FONT_LILITA_STACK,
				color: theme.labelColor,
			}),
		);
		const button = (
			x: number,
			texture: string,
			text: string,
			outline: string,
			onClick: () => void,
		) =>
			panel.add(
				makeButton(scene, {
					...at(x, 80),
					texture,
					width: 225,
					height: 81,
					label: { text, size: 40, font: FONT_LILITA_STACK, outline: { color: outline, px: 3 } },
					onClick,
				}).root,
			);
		button(170, uiKey('setting', 'btnGreen'), opts.yesLabel ?? 'Yes', 'rgba(0, 80, 0, 0.78)', () =>
			this.confirm(),
		);
		button(430, uiKey('setting', 'btnRed'), opts.noLabel ?? 'No', 'rgba(80, 0, 0, 0.78)', () =>
			this.cancel(),
		);
	}

	private confirm(): void {
		if (this.overlay.isClosing()) return;
		this.opts.onConfirm();
		this.close();
	}

	private cancel(): void {
		if (this.overlay.isClosing()) return;
		this.opts.onCancel?.();
		this.close();
	}
}
