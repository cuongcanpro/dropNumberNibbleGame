import type Phaser from 'phaser';
import { beatenLabel } from '../rank/rank-helpers';
import { deviceLang } from './kit-config-client';
import { makeText, setDisplayText } from './widgets';

/**
 * Dòng "Beat N players" dưới huy hiệu hạng — MỘT kiểu cho mọi game (popup chung và result riêng
 * của game lớn đều dùng). Nằm TRONG banner (cao 140, viền sáng ~8 ở đáy) ngay dưới huy hiệu: cỡ 22 vừa
 * đọc được vừa không chạm viền đáy; đặt dưới banner thì đụng nút Replay/Share của popup result.
 */
export const BEATEN_SIZE = 22;

/** Khoảng cách từ TÂM banner tới đỉnh dòng chữ (âm = xuống dưới, y-up như Cocos). */
export const BEATEN_OFFSET_Y = -22;

export function makeBeatenText(
	scene: Phaser.Scene,
	font?: string,
	size = BEATEN_SIZE,
): Phaser.GameObjects.Text {
	return makeText(scene, {
		text: '',
		size,
		color: '#FFFFFF',
		...(font ? { font } : {}),
		outline: { color: 'rgb(30, 18, 72)', px: 3 },
		// Neo ĐỈNH chữ: chiều cao đổi theo font/scale, neo đáy thì mỗi máy lệch một kiểu.
		originX: 0.5,
		originY: 0,
	});
}

/** `0` người ⇒ ẩn hẳn: "Beat 0 players" không có gì để khoe. */
export function applyBeaten(label: Phaser.GameObjects.Text | null, beaten: number): void {
	if (!label) return;
	const s = beatenLabel(beaten, deviceLang());
	setDisplayText(label, s);
	label.setVisible(s !== '');
}
