import type Phaser from 'phaser';
import { feedbackReasonsOf } from '../shell/kit-config-rules';
import { CHIP_H, CHIP_W, feedbackLayout, PANEL_W } from './feedback-layout';
import { FEEDBACK_REASONS, FEEDBACK_TEXT, submitFeedback } from './feedback-model';
import { createFeedbackTextInput, type FeedbackTextInput } from './feedback-text-input';
import {
	type ChipStyle,
	type GameSettingTheme,
	resolveSettingTheme,
	themeTitleStyle,
} from './game-setting-theme';
import { deviceLang, kitConfig } from './kit-config-client';
import { createOverlay, type Overlay } from './overlay-base';
import { addThemedBoard } from './themed-board';
import { Toast } from './toast';
import { FONT_LILITA_STACK } from './ui-fonts';
import { uiKey } from './ui-keys';
import { makeButton, makeText } from './widgets';

export interface FeedbackSheetOptions {
	gameKey: string;
	/** Không còn tác dụng (màu panel theo màu game); giữ để game cũ khỏi vỡ kiểu. */
	gameId?: string;
	/** Theme riêng của game, cùng thứ tự ưu tiên với Setting. */
	theme?: GameSettingTheme;
	/** Chạy sau khi sheet đóng (cả gửi xong lẫn huỷ). */
	onClose?: () => void;
}

/** Chờ panel mở xong (overlay OPEN_MS = 250) rồi mới hiện ô DOM, tránh ô đứng yên trong lúc panel đang nở. */
const INPUT_SHOW_MS = 260;

/**
 * Sheet góp ý (MỚI so với Cocos, thay `portalLayerOpenFeedback`): chọn một chip lý do → Send →
 * `sendFeedback`. Kết quả báo bằng Toast: "Thanks!" chỉ khi trả `true`, ngược lại báo lỗi và GIỮ sheet
 * để thử lại. Ô ghi chú tự do chỉ có khi môi trường có DOM input thật.
 */
export class FeedbackSheet {
	private readonly scene: Phaser.Scene;
	private readonly opts: FeedbackSheetOptions;
	private readonly overlay: Overlay;
	private readonly panel: Phaser.GameObjects.Container;
	private readonly input: FeedbackTextInput;
	private readonly theme: GameSettingTheme;
	private selected: string | null = null;
	private sending = false;
	private readonly chips: { reason: string; box: Phaser.GameObjects.Rectangle }[] = [];
	private sendRoot: Phaser.GameObjects.Container | null = null;

	private constructor(scene: Phaser.Scene, opts: FeedbackSheetOptions) {
		this.scene = scene;
		this.opts = opts;
		this.overlay = createOverlay(scene);
		this.panel = scene.add.container(this.overlay.center.x, this.overlay.center.y);
		this.theme = resolveSettingTheme(opts);
		const chip = this.chip();
		this.input = createFeedbackTextInput(scene, {
			placeholder: FEEDBACK_TEXT[deviceLang()].placeholder,
			fill: hexCss(chip.fill),
			stroke: hexCss(chip.stroke),
			text: chip.text,
		});
		// DOM textarea nằm ngoài scene: scene tắt đột ngột thì phải tự gỡ.
		scene.events.once('shutdown', () => this.input.destroy());
		this.build();
		this.overlay.root.add(this.panel);
		this.overlay.open(this.panel, () => this.close());
	}

	static show(scene: Phaser.Scene, opts: FeedbackSheetOptions): FeedbackSheet {
		return new FeedbackSheet(scene, opts);
	}

	close(): void {
		if (this.overlay.isClosing()) return;
		this.input.destroy();
		this.overlay.close(this.panel, () => this.opts.onClose?.());
	}

	/** Chọn chip (public cho test/game tự động hoá). */
	select(reason: string): void {
		if (this.sending) return;
		this.selected = reason;
		for (const c of this.chips) {
			const on = c.reason === reason;
			c.box.setFillStyle(on ? 0x31840c : this.chip().fill, 1);
			c.box.setStrokeStyle(3, on ? 0x1c5a00 : this.chip().stroke, 1);
		}
		this.sendRoot?.setAlpha(1);
	}

	/** Chip theo màu game; theme tự khai không có `chip` thì kem + viền theo màu nhãn. */
	private chip(): ChipStyle {
		const label = this.theme.labelColor;
		return (
			this.theme.chip ?? {
				fill: 0xf3e3c8,
				stroke: Number.parseInt(label.slice(1), 16),
				text: label,
			}
		);
	}

	private build(): void {
		const { scene, panel } = this;
		// Lý do từ Console (nếu có) thay hẳn danh sách cứng; tối đa 10 chip (Server chặn).
		const reasons = feedbackReasonsOf(kitConfig(), FEEDBACK_REASONS);
		const L = feedbackLayout(reasons.length, this.input.available);
		addThemedBoard(scene, panel, this.theme, { width: PANEL_W, height: L.panelH, slice: 120 });
		panel.add(
			makeText(scene, {
				x: 0,
				y: L.headerY,
				text: 'FEEDBACK',
				size: 50,
				...themeTitleStyle(this.theme),
			}),
		);
		const close = makeButton(scene, {
			x: PANEL_W / 2 - 50,
			y: L.headerY,
			texture: uiKey('setting', 'btnClose'),
			width: 66,
			height: 66,
			onClick: () => this.close(),
		});
		panel.add(close.root);

		reasons.forEach((reason, i) => {
			const at = L.chips[i] ?? { x: 0, y: 0 };
			const box = scene.add.rectangle(at.x, at.y, CHIP_W, CHIP_H, this.chip().fill, 1);
			box.setStrokeStyle(3, this.chip().stroke, 1);
			box.setInteractive({ useHandCursor: true });
			box.on('pointerup', () => this.select(reason));
			const label = makeText(scene, {
				x: at.x,
				y: at.y,
				text: reason,
				size: 28,
				font: FONT_LILITA_STACK,
				color: this.chip().text,
			});
			// Lý do dài (≤ 64 ký tự) không tràn chip: co chữ cho vừa.
			if (label.width > CHIP_W - 20) label.setScale((CHIP_W - 20) / label.width);
			panel.add([box, label]);
			this.chips.push({ reason, box });
		});

		const send = makeButton(scene, {
			x: L.send.x,
			y: L.send.y,
			texture: uiKey('setting', 'btnGreen'),
			width: L.send.w,
			height: L.send.h,
			label: {
				text: FEEDBACK_TEXT[deviceLang()].send,
				size: 40,
				font: FONT_LILITA_STACK,
				outline: { color: '#1C7500', px: 3 },
			},
			onClick: () => void this.send(),
		});
		send.root.setAlpha(0.5); // chưa chọn lý do: mờ, bấm không có tác dụng
		this.sendRoot = send.root;
		panel.add(send.root);

		// Ô ghi chú DOM đè đúng chỗ chừa trong panel (toạ độ panel → world bằng tâm overlay).
		const note = L.note;
		if (note) {
			const { x, y } = this.overlay.center;
			scene.time.delayedCall(INPUT_SHOW_MS, () => {
				if (!this.overlay.isClosing()) this.input.attach({ ...note, x: x + note.x, y: y + note.y });
			});
		}
	}

	private async send(): Promise<void> {
		if (!this.selected || this.sending || this.overlay.isClosing()) return;
		this.sending = true;
		this.sendRoot?.setAlpha(0.5);
		const outcome = await submitFeedback(this.opts.gameKey, this.selected, this.input.value());
		this.sending = false;
		if (this.overlay.isClosing()) return;
		void Toast.show(this.scene, outcome.message);
		if (outcome.ok) this.close();
		else this.sendRoot?.setAlpha(1); // thất bại thật: giữ sheet, cho thử lại
	}
}

const hexCss = (n: number): string => `#${n.toString(16).padStart(6, '0')}`;
