import type Phaser from 'phaser';
import { parseHexColor } from './card-fetch';

/** Bộ màu màn loading theo màu nền Console (`loadingBgColor`); không có thì `DEFAULT_BG`. */
export interface LoadingTheme {
	/** Màu nền đặc: màu Console, chưa có thì `DEFAULT_BG`. */
	readonly bg: number;
	readonly text: string;
	readonly sub: string;
	readonly nameShadow: string | null;
	readonly trackColor: number;
	readonly trackAlpha: number;
}

/**
 * Nền mặc định khi chưa có màu Console (lần mở đầu chưa cache): xám xanh trung tính, không phải đen,
 * để lúc màu Console về chuyển sang nền sáng hay tối đều dịu mắt (Anh chốt 09/10).
 */
export const DEFAULT_BG = 0x5e6472;

const DARK: LoadingTheme = {
	bg: DEFAULT_BG,
	text: '#ffffff',
	sub: '#c9ced8',
	nameShadow: '#000000',
	trackColor: 0xffffff,
	trackAlpha: 0.16,
};

// `#RRGGBB` → số; sai dạng → null (Console gõ tay, không tin). Định nghĩa ở card-fetch (dùng cả lúc build).
export { parseHexColor };

/** Độ sáng cảm nhận 0–1 (Rec. 601), đủ để chọn chữ sáng/tối. */
function luminance(c: number): number {
	return (0.299 * ((c >> 16) & 255) + 0.587 * ((c >> 8) & 255) + 0.114 * (c & 255)) / 255;
}

export function loadingTheme(bgHex: string | null | undefined): LoadingTheme {
	const bg = parseHexColor(bgHex);
	if (bg === null) return DARK;
	if (luminance(bg) < 0.6) return { ...DARK, bg };
	return {
		bg,
		text: '#2b2b2b',
		sub: '#55606e',
		nameShadow: null,
		trackColor: 0x000000,
		trackAlpha: 0.14,
	};
}

/** Những phần của màn loading đổi màu theo nền (gom ra đây cho loading-screen gọn). */
export interface ThemedParts {
	readonly bg: Phaser.GameObjects.Rectangle;
	readonly name: Phaser.GameObjects.Text;
	readonly desc: Phaser.GameObjects.Text;
	readonly pct: Phaser.GameObjects.Text;
	readonly tip: Phaser.GameObjects.Text;
	readonly bar: { setTrackStyle(color: number, alpha: number): void };
}

const FADE_MS = 500;

/** Pha hai màu 0xRRGGBB theo tỉ lệ k (0..1). */
export function mixColor(from: number, to: number, k: number): number {
	const ch = (shift: number): number => {
		const a = (from >> shift) & 255;
		return Math.round(a + (((to >> shift) & 255) - a) * k) << shift;
	};
	return ch(16) | ch(8) | ch(0);
}

/**
 * Nền đặc theo màu Console; chữ và rãnh thanh đổi theo độ sáng nền. `fadeFrom` (màu đang hiện) → nền
 * chuyển dần sang màu mới thay vì nhảy cục (lần đầu chưa có cache, màu Console về sau vài giây).
 */
export function applyLoadingTheme(
	t: LoadingTheme,
	p: ThemedParts,
	fade?: { scene: Phaser.Scene; from: number },
): void {
	const to = t.bg;
	if (fade && fade.from !== to && typeof fade.scene.tweens.addCounter === 'function') {
		fade.scene.tweens.addCounter({
			from: 0,
			to: 1,
			duration: FADE_MS,
			onUpdate: (tw) => p.bg.setFillStyle(mixColor(fade.from, to, tw.getValue() ?? 1), 1),
		});
	} else {
		p.bg.setFillStyle(to, 1);
	}
	p.name.setColor(t.text).setShadow(0, 4, t.nameShadow ?? '#000000', 0, false, !!t.nameShadow);
	p.pct.setColor(t.text);
	p.desc.setColor(t.sub);
	p.tip.setColor(t.sub);
	p.bar.setTrackStyle(t.trackColor, t.trackAlpha);
}
