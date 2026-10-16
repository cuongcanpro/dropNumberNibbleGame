import type Phaser from 'phaser';
import { getViewZoom } from '../platform/nibi-host';

/** Độ phân giải nướng = zoom màn thật (nướng 1x rồi camera phóng thì viền mờ, như pill-banner). */
export function bakeRes(): number {
	return Math.max(1, Math.ceil(getViewZoom() * 2) / 2);
}

const hex = (c: number): string => c.toString(16).padStart(6, '0');

/**
 * Viên thuốc nướng sẵn cho rãnh / phần đã chạy của thanh. `shine` thêm vệt sáng trên + bóng dưới
 * (giả gradient, vì gradient bo góc trên WebGL1 của Graphics không đáng tin).
 */
export function bakeBarPill(
	scene: Phaser.Scene,
	w: number,
	h: number,
	color: number,
	alpha: number,
	shine: boolean,
): { key: string; res: number } {
	const r = bakeRes();
	const key = `gk-load-pill-${w}x${h}-${hex(color)}-${Math.round(alpha * 100)}${shine ? 's' : ''}@${r}`;
	if (!scene.textures.exists(key)) {
		const g = scene.add.graphics();
		const W = w * r;
		const H = h * r;
		g.fillStyle(color, alpha);
		g.fillRoundedRect(0, 0, W, H, H / 2);
		if (shine) {
			g.fillStyle(0x000000, 0.12);
			g.fillRoundedRect(H * 0.2, H * 0.55, W - H * 0.4, H * 0.38, H * 0.19);
			g.fillStyle(0xffffff, 0.35);
			g.fillRoundedRect(H * 0.3, H * 0.14, W - H * 0.6, H * 0.26, H * 0.13);
		}
		g.generateTexture(key, W, H);
		g.destroy();
	}
	return { key, res: r };
}

/** Ngôi sao bốn cánh (đường astroid) có quầng sáng màu `glow`, cạnh `size` design px. */
export function bakeSparkle(
	scene: Phaser.Scene,
	size: number,
	glow: number,
): { key: string; res: number } {
	const r = bakeRes();
	const key = `gk-load-spark-${size}-${hex(glow)}@${r}`;
	if (!scene.textures.exists(key)) {
		const g = scene.add.graphics();
		const S = size * r;
		const c = S / 2;
		// Quầng sáng: các vòng đồng tâm alpha thấp chồng lên nhau thành mép mềm.
		for (let i = 6; i >= 1; i--) {
			g.fillStyle(glow, 0.09);
			g.fillCircle(c, c, (S / 2) * (0.25 + i * 0.12));
		}
		const R = S * 0.42;
		const pts: Phaser.Types.Math.Vector2Like[] = [];
		for (let i = 0; i < 64; i++) {
			const t = (i / 64) * Math.PI * 2;
			pts.push({ x: c + R * Math.cos(t) ** 3, y: c + R * Math.sin(t) ** 3 });
		}
		g.fillStyle(0xfffbea, 1);
		// fillPoints chỉ đọc x/y; type Phaser đòi Vector2 đầy đủ.
		g.fillPoints(pts as Phaser.Math.Vector2[], true);
		g.fillStyle(0xffffff, 1);
		g.fillCircle(c, c, S * 0.06);
		g.generateTexture(key, S, S);
		g.destroy();
	}
	return { key, res: r };
}
