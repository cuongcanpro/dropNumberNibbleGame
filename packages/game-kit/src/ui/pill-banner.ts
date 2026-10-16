import type Phaser from 'phaser';
import { getViewZoom } from '../platform/nibi-host';
import { FONT_LILITA_STACK } from './ui-fonts';
import { makeText, setDisplayText } from './widgets';

export interface PillStyle {
	height: number;
	minWidth: number;
	maxWidth: number;
	paddingX: number;
	fontSize: number;
	/** Mặc định LilitaOne; chữ tiếng Việt cần Baloo (LilitaOne thiếu glyph như đ, ỏ). */
	font?: string;
}

/** Bề rộng viên thuốc: ôm chữ + padding, kẹp [min, max]. */
export function pillWidth(
	labelWidth: number,
	s: Pick<PillStyle, 'minWidth' | 'maxWidth' | 'paddingX'>,
): number {
	return Math.max(s.minWidth, Math.min(s.maxWidth, labelWidth + s.paddingX * 2));
}

const PAD = 2; // viền 2px tràn ra ngoài nửa bề dày: chừa lề để không bị cắt khi nướng
const QUANT = 4; // gom bề rộng theo bội 4px để nhiều câu Toast dùng chung một texture

/**
 * Nướng nền viên thuốc thành texture một lần (cache theo cỡ). Graphics để sống thì Phaser chia lại bo
 * góc thành tam giác MỖI FRAME; TutorialTip đứng suốt màn hướng dẫn nên đủ gây giật trên Hermes.
 */
function bakePill(
	scene: Phaser.Scene,
	w: number,
	h: number,
): { key: string; w: number; h: number } {
	const W = Math.ceil(w / QUANT) * QUANT;
	const H = Math.ceil(h);
	// Nướng ở độ phân giải màn thật (camera zoom ~1,6 trên điện thoại): nướng 1x rồi phóng thì viền mờ.
	const r = Math.max(1, Math.ceil(getViewZoom() * 2) / 2);
	const key = `gk-pill-${W}x${H}@${r}`;
	if (!scene.textures.exists(key)) {
		const g = scene.add.graphics();
		g.fillStyle(0x1a2433, 224 / 255);
		g.fillRoundedRect(PAD * r, PAD * r, W * r, H * r, (H * r) / 2);
		g.lineStyle(2 * r, 0xffffff, 26 / 255);
		g.strokeRoundedRect(PAD * r, PAD * r, W * r, H * r, (H * r) / 2);
		g.generateTexture(key, (W + PAD * 2) * r, (H + PAD * 2) * r);
		g.destroy();
	}
	return { key, w: W + PAD * 2, h: H + PAD * 2 };
}

/**
 * Viên thuốc tối + chữ trắng dùng chung Toast / TutorialTip (nền 26,36,51 alpha 224, viền trắng mờ).
 * `root` do caller đặt vị trí; fade + trượt chạy trên `pill` để root không bị trôi.
 */
export class PillBanner {
	readonly root: Phaser.GameObjects.Container;
	readonly pill: Phaser.GameObjects.Container;
	private readonly scene: Phaser.Scene;
	private readonly bg: Phaser.GameObjects.Image;
	private readonly label: Phaser.GameObjects.Text;
	private readonly style: PillStyle;
	private current = '';

	constructor(scene: Phaser.Scene, style: PillStyle) {
		this.style = style;
		this.scene = scene;
		const first = bakePill(scene, style.minWidth, style.height);
		this.bg = scene.add.image(0, 0, first.key).setDisplaySize(first.w, first.h);
		this.label = makeText(scene, {
			text: '',
			size: style.fontSize,
			font: style.font ?? FONT_LILITA_STACK,
		});
		this.pill = scene.add.container(0, 0);
		this.pill.add([this.bg, this.label]);
		this.root = scene.add.container(0, 0);
		this.root.add(this.pill);
		this.relayout('');
		this.pill.setAlpha(0);
		this.root.setVisible(false);
	}

	get text(): string {
		return this.current;
	}

	relayout(text: string): void {
		this.current = text;
		setDisplayText(this.label, text);
		const w = pillWidth(this.label.width, this.style);
		const baked = bakePill(this.scene, w, this.style.height);
		this.bg.setTexture(baked.key).setDisplaySize(baked.w, baked.h);
	}
}
