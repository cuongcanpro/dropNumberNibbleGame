import { describe, expect, it, vi } from 'vitest';

vi.mock('nibi', () => ({ primaryCanvas: { width: 720, height: 1280 } }));

const { preloadGameKitUi } = await import('./assets');
const { HUD_ASSETS, RESULT_ASSETS, SETTING_ASSETS, TUTORIAL_ASSETS } = await import(
	'./assets-manifest'
);
const { GK_UI_ATLAS } = await import('./ui-atlas');
const { paletteTheme } = await import('./game-setting-theme');
const { themeTarget } = await import('./theme-palette');
const { FakeScene, asScene } = await import('./testing/fake-scene');

describe('preloadGameKitUi', () => {
	it('xếp hàng đúng 1 file: atlas gk-ui (không còn ảnh lẻ)', () => {
		const scene = new FakeScene();
		preloadGameKitUi(asScene(scene));
		expect(scene.loaded).toEqual([[GK_UI_ATLAS.key, GK_UI_ATLAS.url]]);
		expect(GK_UI_ATLAS.url.length).toBeGreaterThan(0);
	});
	it('nhóm nào cũng chỉ 1 file; gọi lại khi atlas đã có thì không nạp nữa', () => {
		for (const groups of [
			['hud'],
			['tutorial'],
			['setting', 'result', 'tutorial', 'hud'],
		] as const) {
			const scene = new FakeScene();
			preloadGameKitUi(asScene(scene), groups);
			expect(scene.loaded).toHaveLength(1);
		}
		const scene = new FakeScene();
		scene.textureKeys.add(GK_UI_ATLAS.key);
		preloadGameKitUi(asScene(scene));
		expect(scene.loaded).toHaveLength(0);
	});
	it('mọi key manifest, theme, nút, icon đều có frame trong atlas (key cũ còn đủ)', () => {
		const frames = new Set(Object.keys(GK_UI_ATLAS.frames));
		const manifest = [...SETTING_ASSETS, ...RESULT_ASSETS, ...TUTORIAL_ASSETS, ...HUD_ASSETS];
		expect(frames.size).toBe(manifest.length);
		for (const { key } of manifest) expect(frames.has(key)).toBe(true);
		expect(HUD_ASSETS.map((a) => a.key)).toEqual(['gk-ui/hud/btnHome', 'gk-ui/hud/btnSetting']);
		const t = paletteTheme(themeTarget('#5CAAEC'));
		const layers = (t.boardLayers ?? []).map((l) => l.texture);
		expect(layers).toHaveLength(2);
		for (const k of [...layers, t.icons.sound, t.icons.music, t.icons.vibration]) {
			expect(frames.has(k)).toBe(true);
		}
		// Bảng màu cũ đã gỡ khỏi atlas: không còn khung nào chưa dùng.
		for (const old of ['board_setting', 'board_setting1', 'board_setting2', 'board_setting3']) {
			expect(frames.has(`gk-ui/setting/${old}`)).toBe(false);
		}
	});
});
