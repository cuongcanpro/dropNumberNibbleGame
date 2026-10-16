import { describe, expect, it, vi } from 'vitest';

vi.mock('nibi', () => ({ primaryCanvas: { width: 1080, height: 1920 } }));

import type { ViewCameraLike } from './nibi-host';

const host = await import('./nibi-host');

describe('packedUrl', () => {
	it('thêm / đầu, không encode lại %', () => {
		expect(host.packedUrl('img/play%20copy.png')).toBe('/img/play%20copy.png');
		expect(host.packedUrl('/a/b.png')).toBe('/a/b.png');
	});
	it('bản web nạp res/ tương đối theo trang, để chạy được trong một thư mục', () => {
		vi.stubGlobal('NIBI_BUILD_TARGET', 'web');
		try {
			expect(host.packedUrl('img/a.png')).toBe('./img/a.png');
			expect(host.packedUrl('/sfx/tap.mp3')).toBe('./sfx/tap.mp3');
			expect(host.packedUrl('https://x.com/a')).toBe('https://x.com/a');
		} finally {
			vi.unstubAllGlobals();
		}
		expect(host.packedUrl('img/a.png')).toBe('/img/a.png');
	});
	it('absolute/blob/data/protocol-relative giữ nguyên', () => {
		for (const u of ['https://x.com/a', 'blob:abc', 'data:image/png;base64,AA', '//cdn/x']) {
			expect(host.packedUrl(u)).toBe(u);
		}
		expect(host.packedUrl('')).toBe('');
	});
});

function fakeScene() {
	const main = {
		setZoom: vi.fn<(z: number) => void>(),
		centerOn: vi.fn<(x: number, y: number) => void>(),
	};
	return { scene: { cameras: { main } }, main };
}

describe('camera', () => {
	it('zoom = min(w/720, h/1280), centerOn tâm design', () => {
		const { scene, main } = fakeScene();
		host.applyHostCamera(scene, { width: 1440, height: 1600 });
		expect(main.setZoom).toHaveBeenCalledWith(1.25);
		expect(main.centerOn).toHaveBeenCalledWith(360, 640);
		expect(host.getViewZoom()).toBe(1.25);
	});

	it('mặc định lấy size từ primaryCanvas', () => {
		const { scene, main } = fakeScene();
		host.applyHostCamera(scene);
		expect(main.setZoom).toHaveBeenCalledWith(1.5);
		expect(host.hostGameSize()).toEqual({ width: 1080, height: 1920 });
	});

	it('size lỗi thì zoom = 1', () => {
		expect(host.computeViewZoom(0, 0)).toBe(1);
		expect(host.computeViewZoom(Number.NaN, 100)).toBe(1);
	});

	it('designView phủ kín letterbox quanh khung design', () => {
		const v = host.designView({ width: 1440, height: 1600 });
		expect(v.width).toBeCloseTo(1152);
		expect(v.x).toBeCloseTo(-216);
		expect(v.height).toBeCloseTo(1280);
		expect(v.y).toBeCloseTo(0);
	});
});

const cam = (c: ViewCameraLike) => ({ cameras: { main: c } });

describe('designView(scene) theo camera thật', () => {
	it('(a) applyHostCamera: zoom=min, centerOn(360,640) ⇒ trùng bản size', () => {
		const zoom = 1.25; // 1440x1600
		const v = host.designView(
			cam({ zoom, width: 1440, height: 1600, scrollX: 360 - 720, scrollY: 640 - 800 }),
		);
		const bySize = host.designView({ width: 1440, height: 1600 });
		expect(v.x).toBeCloseTo(bySize.x);
		expect(v.y).toBeCloseTo(bySize.y);
		expect(v.width).toBeCloseTo(bySize.width);
		expect(v.height).toBeCloseTo(bySize.height);
	});

	it('(b) haru-cats: origin(0,0) + zoom, ghim mép trên ⇒ view bắt đầu tại scroll (0,0)', () => {
		const v = host.designView(
			cam({ zoom: 1.5, width: 1080, height: 2200, scrollX: 0, scrollY: 0, originX: 0, originY: 0 }),
		);
		expect(v).toEqual({ x: 0, y: 0, width: 720, height: 2200 / 1.5 });
	});

	it('(c) block-blast: zoom=width/720, tâm (360,640) ⇒ view = 0..720 theo chiều rộng', () => {
		const zoom = 1080 / 720;
		const v = host.designView(
			cam({ zoom, width: 1080, height: 2400, scrollX: 360 - 540, scrollY: 640 - 1200 }),
		);
		expect(v.x).toBeCloseTo(0);
		expect(v.width).toBeCloseTo(720);
		expect(v.height).toBeCloseTo(1600);
		expect(v.y).toBeCloseTo(640 - 800);
	});

	it('(d) không zoom, vẽ theo backing pixel ⇒ view = 0..width x 0..height', () => {
		const v = host.designView(cam({ zoom: 1, width: 1080, height: 1920, scrollX: 0, scrollY: 0 }));
		expect(v).toEqual({ x: 0, y: 0, width: 1080, height: 1920 });
	});

	it('zoom hỏng ⇒ coi như 1; ưu tiên zoomX/zoomY', () => {
		expect(
			host.designView(cam({ zoom: 0, width: 100, height: 50, scrollX: 0, scrollY: 0 })).width,
		).toBe(100);
		const v = host.designView(
			cam({ zoomX: 2, zoomY: 4, width: 100, height: 100, scrollX: 0, scrollY: 0 }),
		);
		expect(v.width).toBe(50);
		expect(v.height).toBe(25);
	});
});

describe('loadFont', () => {
	it('thiếu FontFace/document thì trả false, không ném', async () => {
		await expect(host.loadFont('X', '/f.ttf')).resolves.toBe(false);
	});

	it('FontFace.load() không bao giờ trả về → hết hạn trả false, game vẫn boot', async () => {
		vi.useFakeTimers();
		const added: unknown[] = [];
		vi.stubGlobal(
			'FontFace',
			class {
				load() {
					return new Promise(() => {}); // treo vĩnh viễn như asset hỏng trên native
				}
			},
		);
		vi.stubGlobal('document', { fonts: { add: (f: unknown) => added.push(f) } });
		try {
			const p = host.loadFont('X', '/f.ttf', 1000);
			await vi.advanceTimersByTimeAsync(1000);
			await expect(p).resolves.toBe(false);
			expect(added).toHaveLength(0);
		} finally {
			vi.unstubAllGlobals();
			vi.useRealTimers();
		}
	});

	it('nạp kịp thì add vào document.fonts và trả true', async () => {
		const added: unknown[] = [];
		const face = { name: 'ok' };
		vi.stubGlobal(
			'FontFace',
			class {
				load() {
					return Promise.resolve(face);
				}
			},
		);
		vi.stubGlobal('document', { fonts: { add: (f: unknown) => added.push(f) } });
		try {
			await expect(host.loadFont('X', '/f.ttf')).resolves.toBe(true);
			expect(added).toEqual([face]);
		} finally {
			vi.unstubAllGlobals();
		}
	});
});
