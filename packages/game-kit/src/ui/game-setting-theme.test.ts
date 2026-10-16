import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('nibi', () => ({ primaryCanvas: { width: 720, height: 1280 } }));
vi.mock('../shell/share', () => ({ canShare: () => true }));

const { BackKeyManager } = await import('../platform/back-key-manager');
const { UserData } = await import('../platform/user-data');
const { parseKitConfig } = await import('../shell/kit-config');
const { resetKitConfigForTest, setKitConfig } = await import('../shell/kit-config-store');
const { resetGameContextForTest, setGameSlug } = await import('../tracking/game-context');
const { ExitConfirmDialog } = await import('./exit-confirm-dialog');
const { FeedbackSheet } = await import('./feedback-sheet');
const {
	paletteTheme,
	recordSettingTheme,
	resetRecordedSettingThemeForTest,
	resolveSettingTheme,
	currentThemeTarget,
} = await import('./game-setting-theme');
const { GameSettingOverlay } = await import('./game-setting-overlay');
const { SETTING_BOARD } = await import('./theme-layer-spec');
const { layerTint, themeTarget } = await import('./theme-palette');
const { asScene, FakeScene } = await import('./testing/fake-scene');
const { uiKey } = await import('./ui-keys');

const cacheCard = (slug: string, bgColor: unknown) =>
	localStorage.setItem(`gk.loading.card.${slug}`, JSON.stringify({ name: slug, bgColor }));
const fn = () => vi.fn<() => void>();
const tintOf = (o: { state: Record<string, unknown> }) =>
	(o.state.setTint as number[] | undefined)?.[0];
const ACCENT = uiKey('setting', 'board_accent');
const BASE = uiKey('setting', 'board_base');

beforeEach(() => {
	localStorage.clear();
	UserData.resetForTest();
	BackKeyManager.getInstance().clear();
	resetKitConfigForTest();
	resetRecordedSettingThemeForTest();
	resetGameContextForTest();
});

describe('resolveSettingTheme', () => {
	it('màu game trên Console (cache theo slug) → bảng 2 lớp nhuộm theo màu đó', () => {
		setGameSlug('watersort');
		cacheCard('watersort', '#5CAAEC');
		const t = resolveSettingTheme({});
		const target = themeTarget('#5CAAEC');
		expect(t.boardLayers).toEqual([
			{ texture: ACCENT, tint: layerTint(SETTING_BOARD.accent, target) },
			{ texture: BASE, tint: layerTint(SETTING_BOARD.base, target) },
		]);
	});

	it('chưa có slug/cache/màu xám/màu sai → cam mặc định', () => {
		const orange = paletteTheme(themeTarget('#E8873E'));
		expect(resolveSettingTheme({})).toEqual(orange); // chưa có slug
		setGameSlug('blockblast');
		expect(resolveSettingTheme({})).toEqual(orange); // chưa có cache
		cacheCard('blockblast', '#424242');
		expect(resolveSettingTheme({})).toEqual(orange); // xám
		cacheCard('blockblast', 'not-a-colour');
		expect(currentThemeTarget()).toEqual(themeTarget('#E8873E'));
	});

	it('thứ tự: theme game tự khai > theme Setting đã ghi > màu game; gameId bị bỏ qua', () => {
		setGameSlug('haredoku');
		cacheCard('haredoku', '#F2EEDC');
		const own = { ...paletteTheme(themeTarget('#000000')), code: 'own', background: 'own-bg' };
		const other = { ...own, code: 'recorded' };
		expect(resolveSettingTheme({ theme: own }).code).toBe('own');
		recordSettingTheme({ theme: other });
		expect(resolveSettingTheme({}).code).toBe('recorded');
		expect(resolveSettingTheme({ theme: own }).code).toBe('own');
		resetRecordedSettingThemeForTest();
		expect(resolveSettingTheme({ gameId: 'tripletile' }).code).toBe('palette');
	});

	it('kit-config setting.theme của Console bị bỏ qua (vẫn parse được)', () => {
		const cfg = parseKitConfig({ parts: { setting: { theme: 'red' } } });
		expect(cfg.setting.theme).toBe('red');
		setKitConfig(cfg);
		setGameSlug('fill');
		cacheCard('fill', '#0F044D');
		expect(resolveSettingTheme({}).code).toBe('palette');
	});

	it('Setting chỉ ghi nhớ theme tự khai; gọi với gameId suông không làm Exit/Feedback đổi theo', () => {
		recordSettingTheme({ gameId: 'tripletile' });
		setGameSlug('x');
		expect(resolveSettingTheme({}).code).toBe('palette');
	});
});

const setup = () => {
	setGameSlug('dropthesheep');
	cacheCard('dropthesheep', '#81B85F');
	return paletteTheme(themeTarget('#81B85F'));
};

describe('popup dùng palette theo màu game', () => {
	it('Setting: 2 image (accent rồi base) mang tint, icon toggle dùng ảnh xám + iconTint', () => {
		const theme = setup();
		const scene = new FakeScene();
		new GameSettingOverlay(asScene(scene), { onResume: fn() }).show();
		const boards = scene.byKind('image').filter((i) => [ACCENT, BASE].includes(i.texture));
		expect(boards.map((b) => b.texture)).toEqual([ACCENT, BASE]);
		expect(boards.map(tintOf)).toEqual(theme.boardLayers?.map((l) => l.tint));
		const icon = scene
			.byKind('image')
			.find((i) => i.texture === uiKey('setting', 'tint_iconsound'));
		expect(tintOf(icon as never)).toBe(theme.iconTint);
		const label = scene.byKind('text').find((t) => t.text === 'Sound');
		expect(label?.style.color).toBe(theme.labelColor);
	});

	it('Exit: 2 nineslice cùng khổ + cùng bộ cạnh cắt, tint theo palette', () => {
		const theme = setup();
		const scene = new FakeScene();
		ExitConfirmDialog.show(asScene(scene), fn());
		const slices = scene.byKind('nineslice');
		expect(slices.map((s) => s.texture)).toEqual([ACCENT, BASE]);
		expect(slices.map((s) => [s.width, s.height])).toEqual([
			[600, 360],
			[600, 360],
		]);
		expect(slices.map(tintOf)).toEqual(theme.boardLayers?.map((l) => l.tint));
	});

	it('Feedback: 2 nineslice nhuộm, chip theo palette (không còn kem cố định)', () => {
		const theme = setup();
		const scene = new FakeScene();
		FeedbackSheet.show(asScene(scene), { gameKey: 'g' });
		expect(scene.byKind('nineslice').map(tintOf)).toEqual(theme.boardLayers?.map((l) => l.tint));
		const chip = scene.byKind('rectangle').find((r) => r.width === 262); // CHIP_W
		expect(chip?.state.setStrokeStyle).toEqual([3, theme.chip?.stroke, 1]);
	});

	it('theme tự khai (art riêng) vẫn vẽ đúng một texture, không nhuộm', () => {
		const own = { ...paletteTheme(themeTarget('#81B85F')), code: 'own', background: 'own-bg' };
		const { boardLayers: _drop, ...custom } = own;
		const scene = new FakeScene();
		ExitConfirmDialog.show(asScene(scene), fn(), { theme: custom });
		expect(scene.byKind('nineslice').map((s) => s.texture)).toEqual(['own-bg']);
		expect(scene.byKind('nineslice').map(tintOf)).toEqual([undefined]);
	});
});
