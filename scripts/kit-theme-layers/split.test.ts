import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, it } from 'node:test';
import { hslToRgb, rgbToHsl } from '../../packages/game-kit/src/ui/theme-color.ts';
import {
	RESULT_BG,
	SETTING_BOARD,
	SHAKE_BOARD,
} from '../../packages/game-kit/src/ui/theme-layer-spec.ts';
import { decodePng } from '../pack-assets/png-io.ts';
import { buildLayerFiles } from './cli.ts';
import { type Img, ninePatch } from './image.ts';
import { eraseBaked, splitSettingBoard, splitShakeBoard } from './split-board.ts';
import { splitResultBg, unbakeDot } from './split-other.ts';

const KIT = resolve(import.meta.dirname, '../../packages/game-kit');
const art = (name: string): Img => decodePng(readFileSync(join(KIT, 'art/theme-src', name)), name);

/** Mockup Anh duyệt: giữ L từng pixel, thay hue, nhân saturation (recolor.mjs). */
function mockSetting(src: Img, t: { h: number; s: number }): number[] {
	const out: number[] = [];
	for (let i = 0; i < src.data.length; i += 4) {
		const [r, g, b] = [src.data[i], src.data[i + 1], src.data[i + 2]] as number[];
		const { h, s, l } = rgbToHsl(r as number, g as number, b as number);
		const inRange = h >= 8 && h <= 52;
		out.push(
			...(s >= 0.08 && inRange
				? hslToRgb(t.h, Math.min(1, (s * t.s) / 0.78), l)
				: [r as number, g as number, b as number]),
		);
	}
	return out;
}

const dark = (img: Img): number => {
	let c = 0;
	for (let y = SHAKE_BOARD.baked[0]?.y ?? 0; y < (SHAKE_BOARD.baked[0]?.y ?? 0) + 56; y++) {
		for (let x = 296; x < 471; x++) {
			const i = (y * img.width + x) * 4;
			const g = (img.data[i] as number) / 255;
			if ((img.data[i + 3] as number) > 0 && g < 0.5) c++;
		}
	}
	return c;
};

describe('theme layers', () => {
	it('tất định: hai lần sinh ra cùng byte, và khớp file đã commit', () => {
		const a = buildLayerFiles();
		const b = buildLayerFiles();
		for (const [path, bytes] of a) {
			assert.ok(bytes.equals(b.get(path) as Buffer), path);
			assert.ok(readFileSync(path).equals(bytes), `STALE ${path}: chạy pnpm theme-layers`);
		}
	});

	it('bảng Setting: 2 lớp xếp chồng + tint dựng lại màu mockup (sai số TB < 3/255)', () => {
		const src = art('board_setting.png');
		const { accent, base } = splitSettingBoard(src);
		const t = { h: 207, s: 0.75 };
		const tint = (k: number, l: number) => hslToRgb(t.h, Math.min(1, k * t.s), l);
		const ta = tint(SETTING_BOARD.accent.k, SETTING_BOARD.accent.l);
		const tb = tint(SETTING_BOARD.base.k, SETTING_BOARD.base.l);
		const want = mockSetting(src, t);
		let err = 0;
		let n = 0;
		for (let p = 0; p < src.width * src.height; p++) {
			const i = p * 4;
			if (src.data[i + 3] !== 255) continue;
			// Base che accent; pixel không thuộc lớp nào thì bỏ qua.
			const layer = (base.data[i + 3] as number) > 0 ? [base, tb] : [accent, ta];
			const [img, tc] = layer as [Img, number[]];
			const g = (img.data[i] as number) / 255;
			for (let c = 0; c < 3; c++)
				err += Math.abs(g * (tc[c] as number) - (want[p * 3 + c] as number));
			n += 3;
		}
		assert.ok(err / n < 3, `sai số TB ${(err / n).toFixed(2)}`);
	});

	it('popup lắc: chữ MISSION nướng sẵn và nút X nướng sẵn đã bị xoá khỏi mọi lớp', () => {
		const src = art('mission_board.png');
		const clean = eraseBaked(src);
		for (const box of SHAKE_BOARD.baked) {
			const first = (box.y * clean.width + box.x) * 4;
			for (let y = box.y; y < box.y + box.h; y++) {
				for (let x = box.x; x < box.x + box.w; x++) {
					const i = (y * clean.width + x) * 4;
					assert.deepEqual(clean.data.subarray(i, i + 3), clean.data.subarray(first, first + 3));
				}
			}
		}
		const layers = splitShakeBoard(src);
		assert.equal(dark(layers.accent), 0, 'accent còn pixel tối ở chỗ chữ MISSION');
		assert.equal(layers.base.width, 2 * SHAKE_BOARD.baseSlice + 2);
		assert.equal(layers.rabbit.width, SHAKE_BOARD.rabbit.w);
	});

	it('quầng hồng: lớp alpha 1/4 kích thước, giấy không còn pixel hồng bão hoà', () => {
		const src = art('resultBg.png');
		const { paper, glow } = splitResultBg(src);
		assert.equal(glow.width, Math.ceil(src.width / RESULT_BG.glowScale));
		assert.equal(glow.height, Math.ceil(src.height / RESULT_BG.glowScale));
		let strongest = 0;
		for (let i = 3; i < glow.data.length; i += 4)
			strongest = Math.max(strongest, glow.data[i] as number);
		assert.ok(strongest > 100 && strongest <= 255, `alpha đỉnh ${strongest}`);
		const mid = ((src.height >> 1) * src.width + (src.width >> 1)) * 4;
		assert.deepEqual([...paper.data.subarray(mid, mid + 3)], [255, 255, 255]);
	});

	it('chấm đếm: tách khỏi nền vuông nướng sẵn (góc trong suốt, tâm đặc)', () => {
		const dot = unbakeDot(art('dot_full.png'));
		assert.equal(dot.data[3], 0);
		assert.equal(dot.data[((dot.height >> 1) * dot.width + (dot.width >> 1)) * 4 + 3], 255);
	});

	it('ninePatch từ chối thân không phẳng', () => {
		const img: Img = { width: 8, height: 8, data: Buffer.alloc(8 * 8 * 4, 255) };
		img.data[(4 * 8 + 4) * 4] = 0;
		assert.throws(() => ninePatch(img, 2), /phẳng/);
	});
});
