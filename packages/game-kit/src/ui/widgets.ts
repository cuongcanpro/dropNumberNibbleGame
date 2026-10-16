import type Phaser from 'phaser';
import { getViewZoom } from '../platform/nibi-host';
import { displayFont, FONT_BALOO_STACK } from './ui-fonts';

/** Khuyến nghị tap target tối thiểu (design px) — hopogram-web lesson. */
export const MIN_TAP = 44;

export interface TextOptions {
	x?: number;
	y?: number;
	text: string;
	size: number;
	color?: string;
	font?: string;
	/** Viền kiểu Cocos `enableOutline(color, px)`: px là bề dày NGOÀI glyph (Phaser stroke tính cả trong). */
	outline?: { color: string; px: number };
	/** Cocos `enableShadow(color, offset)`; offsetY theo Cocos (hướng lên) nên đã đảo dấu ở đây. */
	shadow?: { color: string; offsetX: number; offsetY: number };
	originX?: number;
	originY?: number;
}

/** Font mong muốn của từng Text (trước khi đổi theo glyph) để `setDisplayText` chọn lại mỗi lần đổi chữ. */
const preferredFont = new WeakMap<object, string>();

export function makeText(scene: Phaser.Scene, o: TextOptions): Phaser.GameObjects.Text {
	const want = o.font ?? FONT_BALOO_STACK;
	const shown = displayFont(o.text, want);
	const text = scene.add.text(o.x ?? 0, o.y ?? 0, o.text, {
		fontFamily: shown.font,
		...(shown.bold ? { fontStyle: 'bold' } : {}),
		fontSize: `${o.size}px`,
		color: o.color ?? '#ffffff',
		align: 'center',
	});
	preferredFont.set(text, want);
	text.setOrigin(o.originX ?? 0.5, o.originY ?? 0.5);
	// Camera zoom phóng to canvas chữ ⇒ render ở độ phân giải bằng zoom để khỏi mờ.
	text.setResolution(Math.max(1, getViewZoom()));
	if (o.outline) text.setStroke(o.outline.color, o.outline.px * 2);
	if (o.shadow) text.setShadow(o.shadow.offsetX, -o.shadow.offsetY, o.shadow.color, 0, true, true);
	return text;
}

/**
 * Đổi chữ của Text tạo bằng `makeText` và chọn lại font theo glyph (chuỗi tiếng Việt không được vẽ
 * bằng Lilita). Dùng thay `setText` ở mọi Text có font Lilita mà nội dung đổi lúc chạy.
 */
export function setDisplayText(text: Phaser.GameObjects.Text, value: string): void {
	const shown = displayFont(value, preferredFont.get(text) ?? FONT_BALOO_STACK);
	text.setFontFamily(shown.font);
	text.setFontStyle(shown.bold ? 'bold' : 'normal');
	text.setText(value);
}

/** Hit-area hình chữ nhật dạng object thuần (không import Phaser ở runtime) trong toạ độ local của image. */
export function rectHitArea(width: number, height: number, minSize = MIN_TAP) {
	const w = Math.max(width, minSize);
	const h = Math.max(height, minSize);
	return {
		hitArea: { x: (width - w) / 2, y: (height - h) / 2, width: w, height: h },
		hitAreaCallback: (
			r: { x: number; y: number; width: number; height: number },
			px: number,
			py: number,
		) => px >= r.x && px <= r.x + r.width && py >= r.y && py <= r.y + r.height,
		useHandCursor: true,
	};
}

export interface ButtonOptions {
	x?: number;
	y?: number;
	texture: string;
	/** Kích thước hiển thị để tính hit-area; mặc định lấy từ texture. */
	width?: number;
	height?: number;
	label?: TextOptions;
	/** Icon con (toạ độ tương đối tâm nút). */
	icon?: { texture: string; x: number; y: number; maxSize?: number };
	/** Scale lúc nghỉ (Cocos result dùng 1.06); press feedback tính theo mốc này. */
	scale?: number;
	onClick: () => void;
}

export interface UiButton {
	root: Phaser.GameObjects.Container;
	hit: Phaser.GameObjects.Image;
	setEnabled(enabled: boolean): void;
}

/**
 * Nút ảnh + press feedback (scale 0.9 như Cocos `pressFeedback` scaleDelta 0.1).
 * Container luôn báo origin 0.5 nên interactive đặt trên Image con, không đặt trên container.
 * Click chỉ tính khi nhả tay còn nằm trên nút (pointerout huỷ).
 */
export function makeButton(scene: Phaser.Scene, o: ButtonOptions): UiButton {
	const root = scene.add.container(o.x ?? 0, o.y ?? 0);
	const base = o.scale ?? 1;
	root.setScale(base);
	const hit = scene.add.image(0, 0, o.texture);
	root.add(hit);
	if (o.icon) {
		const icon = scene.add.image(o.icon.x, o.icon.y, o.icon.texture);
		const longest = Math.max(icon.width, icon.height);
		// Chỉ thu icon quá khổ; icon vừa vặn giữ scale 1 (như Cocos ICON_MAX_SIZE).
		if (o.icon.maxSize && longest > o.icon.maxSize) icon.setScale(o.icon.maxSize / longest);
		root.add(icon);
	}
	if (o.label) root.add(makeText(scene, o.label));

	const w = o.width ?? hit.width;
	const h = o.height ?? hit.height;
	hit.setInteractive(rectHitArea(w, h));

	let pressed = false;
	const scaleTo = (scale: number, duration: number) =>
		scene.tweens.add({ targets: root, scale, duration, ease: 'Quad.easeOut' });
	hit.on('pointerdown', () => {
		pressed = true;
		scaleTo(base * 0.9, 70);
	});
	hit.on('pointerout', () => {
		if (!pressed) return;
		pressed = false;
		scaleTo(base, 90);
	});
	hit.on('pointerup', () => {
		if (!pressed) return;
		pressed = false;
		scaleTo(base, 90);
		o.onClick();
	});

	return {
		root,
		hit,
		setEnabled(enabled) {
			if (enabled) hit.setInteractive(rectHitArea(w, h));
			else hit.disableInteractive();
			root.setVisible(enabled);
		},
	};
}
