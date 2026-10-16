import type Phaser from 'phaser';
import { designView } from '../platform/nibi-host';
import { type Box, type CssRect, worldToCss } from './feedback-layout';

export interface FeedbackTextInput {
	/** Có DOM input thật (web sim). false ⇒ sheet bỏ ô ghi chú và co panel lại. */
	readonly available: boolean;
	/** Giá trị hiện tại (rỗng nếu không có input). */
	value(): string;
	/** Đặt ô vào hộp world này (tâm + kích thước, trong toạ độ scene) và hiện ra; theo canvas khi đổi cỡ. */
	attach(box: Box): void;
	destroy(): void;
}

export interface FeedbackInputStyle {
	placeholder: string;
	/** Màu nền, viền, chữ lấy từ chip của palette. */
	fill: string;
	stroke: string;
	text: string;
}

const NONE: FeedbackTextInput = {
	available: false,
	value: () => '',
	attach: () => {},
	destroy: () => {},
};

/** iOS tự zoom trang khi focus ô có chữ < 16px. */
const MIN_FONT_PX = 16;
const FONT_DESIGN_PX = 26;

/**
 * Ô ghi chú tự do CHỈ khi môi trường có DOM input thật (web sim). Native Hermes chưa có
 * (docs/nibi-native-api-compat.md) ⇒ dò tính năng, thiếu thì trả no-op và sheet chỉ còn chip.
 *
 * Vị trí tính từ `getBoundingClientRect()` của canvas + vùng world camera đang hiển thị
 * (`worldToCss`), nên đúng với mọi kích thước Scale.FIT / letterbox / iframe; tính lại khi
 * scene.scale hoặc cửa sổ đổi cỡ. Ô nằm TRONG panel (do sheet chừa chỗ), không phải overlay trôi nổi.
 */
export function createFeedbackTextInput(
	scene: Phaser.Scene,
	style: FeedbackInputStyle,
): FeedbackTextInput {
	try {
		if (typeof document === 'undefined' || typeof document.createElement !== 'function')
			return NONE;
		const body = document.body;
		const el = document.createElement('textarea');
		const usable =
			body &&
			typeof body.appendChild === 'function' &&
			typeof el.focus === 'function' &&
			typeof el.addEventListener === 'function' &&
			'value' in el;
		if (!usable) return NONE;
		el.placeholder = style.placeholder;
		el.maxLength = 500;
		el.className = 'gk-feedback-note';
		const css = document.createElement('style');
		css.textContent = `.gk-feedback-note::placeholder{color:${style.text};opacity:.55}`;
		Object.assign(el.style, {
			position: 'fixed',
			display: 'none',
			boxSizing: 'border-box',
			zIndex: '2147483647',
			resize: 'none',
			outline: 'none',
			background: style.fill,
			color: style.text,
			border: `2px solid ${style.stroke}`,
			font: `${MIN_FONT_PX}px Baloo, Arial, sans-serif`,
			margin: '0',
		});
		document.head?.appendChild(css);
		body.appendChild(el);

		let box: Box | null = null;
		const place = (): void => {
			const canvas = scene.game?.canvas;
			if (!box || !canvas) return;
			const r = worldToCss(box, designView(scene), canvas.getBoundingClientRect() as CssRect);
			const k = r.width / box.w; // css px mỗi đơn vị design
			Object.assign(el.style, {
				display: 'block',
				left: `${r.left}px`,
				top: `${r.top}px`,
				width: `${r.width}px`,
				height: `${r.height}px`,
				borderWidth: `${Math.max(2, 3 * k)}px`,
				borderRadius: `${16 * k}px`,
				padding: `${8 * k}px ${12 * k}px`,
				fontSize: `${Math.max(MIN_FONT_PX, FONT_DESIGN_PX * k)}px`,
			});
		};
		const onResize = (): void => place();
		scene.scale?.on?.('resize', onResize);
		window.addEventListener?.('resize', onResize);
		return {
			available: true,
			value: () => el.value,
			attach: (b) => {
				box = b;
				place();
			},
			destroy: () => {
				scene.scale?.off?.('resize', onResize);
				window.removeEventListener?.('resize', onResize);
				el.remove?.();
				css.remove?.();
			},
		};
	} catch {
		return NONE;
	}
}
