import { describe, expect, it, vi } from 'vitest';

vi.mock('nibi', () => ({ primaryCanvas: { width: 720, height: 1280 } }));

const { createOverlay } = await import('./overlay-base');
const { buildShakeLayout } = await import('../alt-ad/shake-ui-layout');
const { asScene, FakeScene } = await import('./testing/fake-scene');

// Camera haru-cats: origin(0,0), zoom 1.5, ghim mép trên, canvas 1080x2200.
const haruCamera = {
	main: { zoom: 1.5, width: 1080, height: 2200, scrollX: 0, scrollY: 0, originX: 0, originY: 0 },
};
// Camera block-blast: zoom = width/720, centerOn(360,640).
const blastCamera = {
	main: { zoom: 1.5, width: 1080, height: 2400, scrollX: 360 - 540, scrollY: 640 - 1200 },
};
// drop-the-sheep: không zoom, backing pixel.
const plainCamera = { main: { zoom: 1, width: 1080, height: 1920, scrollX: 0, scrollY: 0 } };

describe('createOverlay + ShakeUi layout bám camera của scene', () => {
	const cases = [
		['haru-cats origin(0,0)', haruCamera, { x: 0, y: 0, width: 720, height: 2200 / 1.5 }],
		['block-blast', blastCamera, { x: 0, y: 640 - 800, width: 720, height: 1600 }],
		['không zoom', plainCamera, { x: 0, y: 0, width: 1080, height: 1920 }],
	] as const;

	for (const [name, camera, view] of cases) {
		it(`${name}: fog + tâm panel nằm giữa vùng nhìn thấy`, () => {
			const scene = new FakeScene();
			scene.cameras = camera;
			const overlay = createOverlay(asScene(scene));
			expect(overlay.view.x).toBeCloseTo(view.x);
			expect(overlay.view.y).toBeCloseTo(view.y);
			expect(overlay.view.width).toBeCloseTo(view.width);
			expect(overlay.view.height).toBeCloseTo(view.height);
			expect(overlay.center.x).toBeCloseTo(view.x + view.width / 2);
			expect(overlay.center.y).toBeCloseTo(view.y + view.height / 2);
		});

		it(`${name}: shake-ui dim phủ đúng view, tâm = tâm view`, () => {
			const scene = new FakeScene();
			scene.cameras = camera;
			const layout = buildShakeLayout(asScene(scene), {
				font: 'x',
				maxShakes: 3,
				subtitle: 's',
				scale: 1,
				depth: 1,
				theme: {
					accent: 0,
					base: 0,
					dotFull: 0,
					dotEmpty: 0,
					glow: 0,
					hint: '#000000',
					message: '#000000',
					titleOutline: '#000000',
				},
				onClose: () => {},
				onTap: () => {},
			});
			const dim = scene.byKind('rectangle')[0];
			expect(dim.width).toBeCloseTo(view.width);
			expect(dim.height).toBeCloseTo(view.height);
			expect(layout.centre.x).toBeCloseTo(view.x + view.width / 2);
			expect(layout.centre.y).toBeCloseTo(view.y + view.height / 2);
		});
	}
});
