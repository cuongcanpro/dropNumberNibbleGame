import { describe, expect, it, vi } from 'vitest';

// iPhone dọc: tai thỏ 47 CSS px, thanh home 34 CSS px; stage 390 CSS px rộng.
vi.mock('nibi', () => ({
	primaryCanvas: { width: 1170, height: 2532 },
	safeAreaInsets: { top: 47, right: 0, bottom: 34, left: 0 },
}));

const { safeInsets, safeShiftDown, safeView, shiftDownFor, shiftUpFor, toDesignInsets } =
	await import('./safe-area');

// Camera như applyHostCamera: zoom = min(1170/720, 2532/1280) = 1.625, centerOn(360, 640).
const camera = {
	main: { zoom: 1.625, width: 1170, height: 2532, scrollX: 360 - 585, scrollY: 640 - 1266 },
};

describe('safe area', () => {
	it('toDesignInsets đổi CSS px sang design px theo tỉ lệ bề ngang khung nhìn', () => {
		expect(toDesignInsets({ top: 10, right: 0, bottom: 5, left: 0 }, 720, 360)).toEqual({
			top: 20,
			right: 0,
			bottom: 10,
			left: 0,
		});
		// innerWidth chưa có (0) → không phóng
		expect(toDesignInsets({ top: 10, right: 0, bottom: 0, left: 0 }, 720, 0).top).toBe(10);
	});

	it('safeInsets dùng innerWidth của stage (CSS px) và khung nhìn của camera', () => {
		vi.stubGlobal('innerWidth', 390);
		try {
			const s = safeInsets({ cameras: camera });
			// khung nhìn rộng 1170 / 1.625 = 720 design px trên 390 CSS px
			expect(s.top).toBeCloseTo((47 * 720) / 390, 5);
			expect(s.bottom).toBeCloseTo((34 * 720) / 390, 5);
		} finally {
			vi.unstubAllGlobals();
		}
	});

	it('safeView thu khung nhìn lại đúng phần tai thỏ + thanh home', () => {
		vi.stubGlobal('innerWidth', 390);
		try {
			const v = safeView({ cameras: camera });
			const viewH = 2532 / 1.625;
			const top = (47 * 720) / 390;
			const bottom = (34 * 720) / 390;
			expect(v.y).toBeCloseTo(640 - viewH / 2 + top, 5);
			expect(v.height).toBeCloseTo(viewH - top - bottom, 5);
			expect(v.width).toBeCloseTo(720, 5);
		} finally {
			vi.unstubAllGlobals();
		}
	});
});

describe('kẹp, không cộng (lỗi quá đà 08/10)', () => {
	it('HUD đã cách mép đủ xa thì không dịch', () => {
		// màn dài: khung 720×1280 nằm giữa, mép trên khung cách mép màn 140 design px
		expect(shiftDownFor(140 + 20, 0, 87)).toBe(0);
		expect(shiftUpFor(1400, 1560, 60)).toBe(0);
	});

	it('chỉ dịch phần lấn vào vùng tai thỏ / thanh home, cộng lề nhỏ', () => {
		expect(shiftDownFor(20, 0, 87)).toBe(87 + 12 - 20);
		expect(shiftUpFor(1550, 1560, 60)).toBe(1550 - (1560 - 60 - 12));
	});

	it('insets = 0 (web, nibi sim) thì không bao giờ dịch, kể cả HUD sát mép', () => {
		expect(shiftDownFor(0, 0, 0)).toBe(0);
		expect(shiftUpFor(1560, 1560, 0)).toBe(0);
	});

	it('safeShiftDown đọc camera + insets của scene', () => {
		vi.stubGlobal('innerWidth', 390);
		try {
			const viewTop = 640 - 2532 / 1.625 / 2;
			const top = (47 * 720) / 390;
			expect(safeShiftDown({ cameras: camera }, viewTop + 10)).toBeCloseTo(top + 12 - 10, 5);
			expect(safeShiftDown({ cameras: camera }, viewTop + 200)).toBe(0);
		} finally {
			vi.unstubAllGlobals();
		}
	});
});
