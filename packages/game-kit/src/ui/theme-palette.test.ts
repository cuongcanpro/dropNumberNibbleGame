import { describe, expect, it } from 'vitest';
import { hslToRgb, rgbToHsl } from './theme-color';
import {
	DEFAULT_THEME_COLOR,
	layerTint,
	themeTarget,
	themeTexts,
	tintFromColor,
} from './theme-palette';

const hueOf = (c: number) => rgbToHsl((c >> 16) & 255, (c >> 8) & 255, c & 255).h;

describe('themeTarget (màu chủ đạo → hue + độ đậm)', () => {
	it('lấy hue và saturation của màu Console, kẹp saturation vào [0.5, 0.75]', () => {
		const t = themeTarget('#5CAAEC'); // xanh dương, s ≈ .79 → kẹp .75
		expect(t.h).toBeGreaterThan(200);
		expect(t.h).toBeLessThan(215);
		expect(t.s).toBe(0.75);
		const dim = themeTarget('#7F6144'); // nâu, s ≈ .30 nhưng ≥ .12 → nâng lên .5
		expect(dim.s).toBe(0.5);
	});

	it('màu xám (s < 0.12), thiếu hoặc sai dạng → cam mặc định #E8873E', () => {
		const orange = themeTarget(`#${DEFAULT_THEME_COLOR.toString(16)}`);
		for (const bad of ['#424242', '#FFFFFF', '#000000', undefined, null, '', 'red', '#12345', 42]) {
			expect(themeTarget(bad)).toEqual(orange);
		}
		expect(orange.h).toBeGreaterThan(25);
		expect(orange.h).toBeLessThan(35);
	});

	it('màu rất sáng/rất tối vẫn giữ hue của nó (độ sáng không lấy từ màu nhập)', () => {
		expect(themeTarget('#100929').h).toBeCloseTo(themeTarget('#2A1266').h, -1); // tím đậm
		expect(themeTarget('#FAF5F0').s).toBeGreaterThanOrEqual(0.5); // kem nhạt: s thô .5, độ sáng không ảnh hưởng
		const dark = themeTarget('#100929');
		expect(dark.s).toBeGreaterThanOrEqual(0.5);
		expect(dark.s).toBeLessThanOrEqual(0.75);
	});

	it('không phân biệt hoa thường', () => {
		expect(themeTarget('#5caaec')).toEqual(themeTarget('#5CAAEC'));
	});
});

describe('layerTint', () => {
	it('tint giữ hue của đích, độ sáng lấy từ lớp (không từ màu nhập)', () => {
		const t = themeTarget('#5CAAEC');
		const tint = layerTint({ k: 1, l: 0.7 }, t);
		expect(Math.abs(hueOf(tint) - t.h)).toBeLessThan(2);
		const { l } = rgbToHsl((tint >> 16) & 255, (tint >> 8) & 255, tint & 255);
		expect(l).toBeCloseTo(0.7, 1);
	});

	it('k nhân vào saturation và kẹp ≤ 1', () => {
		const t = { h: 120, s: 0.75 };
		const lo = rgbToHsl(...unpack(layerTint({ k: 0.5, l: 0.5 }, t))).s;
		const hi = rgbToHsl(...unpack(layerTint({ k: 5, l: 0.5 }, t))).s;
		expect(lo).toBeCloseTo(0.375, 1);
		expect(hi).toBeCloseTo(1, 1);
	});
});

const lum = (css: string) => rgbToHsl(...unpack(Number.parseInt(css.slice(1), 16))).l;

describe('themeTexts / tintFromColor', () => {
	it('màu chữ lấy hue đích, độ sáng cố định (nhãn .42, viền title .32)', () => {
		const t = themeTarget('#81B85F');
		const x = themeTexts(t);
		expect(lum(x.label)).toBeCloseTo(0.42, 1);
		expect(lum(x.titleOutline)).toBeCloseTo(0.32, 1);
		expect(x.label).toMatch(/^#[0-9a-f]{6}$/);
		expect(lum(x.shakeHint)).toBeCloseTo(0.38, 1);
		expect(lum(x.chipFill)).toBeGreaterThan(0.85);
	});

	it('tintFromColor = layerTint của màu Console, cùng quy tắc xám → cam', () => {
		expect(tintFromColor({ k: 1, l: 0.7 }, '#424242')).toBe(
			layerTint({ k: 1, l: 0.7 }, themeTarget('#E8873E')),
		);
	});
});

describe('theme-color', () => {
	it('hsl <-> rgb khứ hồi', () => {
		const [r, g, b] = hslToRgb(200, 0.6, 0.5);
		const back = rgbToHsl(r, g, b);
		expect(back.h).toBeCloseTo(200, 0);
		expect(back.s).toBeCloseTo(0.6, 2);
		expect(back.l).toBeCloseTo(0.5, 2);
	});
});

function unpack(c: number): [number, number, number] {
	return [(c >> 16) & 255, (c >> 8) & 255, c & 255];
}
