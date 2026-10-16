import { afterEach, describe, expect, it, vi } from 'vitest';

const postMessage = vi.fn<(d: unknown) => void>();
vi.mock('nibi', () => ({ primaryCanvas: { width: 720, height: 1280 }, host: { postMessage } }));

const { attachLoadingScreen } = await import('./loading-screen');
const { LOADING_LOGO_KEY } = await import('./loading-art');
const { resetGameContextForTest, setGameSlug } = await import('../tracking/game-context');
const { asScene, FakeEmitter, FakeScene } = await import('./testing/fake-scene');

type Scene = InstanceType<typeof FakeScene>;
const LOGO_DONE = `filecomplete-image-${LOADING_LOGO_KEY}`;

/** Scene giả có loader (event progress/filecomplete). */
function setup() {
	const scene = new FakeScene();
	const loadEvents = new FakeEmitter();
	Object.assign(scene, {
		load: {
			...scene.load,
			on: loadEvents.on.bind(loadEvents),
			once: loadEvents.once.bind(loadEvents),
			off: loadEvents.off.bind(loadEvents),
		},
	});
	Object.assign(scene, {
		textures: { exists: (k: string) => scene.textureKeys.has(k) },
	});
	return { scene, loadEvents };
}

/** Chạy n frame 33ms: event `update` của scene + đồng hồ tween/delayedCall. */
function frames(scene: Scene, n: number): void {
	for (let i = 0; i < n; i++) {
		scene.events.emit('update', 0, 33);
		scene.advance(33);
	}
}

const pctText = (scene: Scene) => scene.texts().find((t) => t.endsWith('%'));
const hero = (scene: Scene) =>
	scene.byKind('image').find((o) => o.texture === LOADING_LOGO_KEY && o.visible);

function memoryStorage(entries: Record<string, unknown> = {}) {
	const map = new Map(Object.entries(entries).map(([k, v]) => [k, JSON.stringify(v)]));
	return {
		getItem: (k: string) => map.get(k) ?? null,
		setItem: (k: string, v: string) => void map.set(k, v),
		map,
	};
}

afterEach(() => {
	resetGameContextForTest();
	vi.unstubAllGlobals();
});

describe('attachLoadingScreen', () => {
	it('thanh đuổi theo progress, % khớp; không còn chữ Nibble Verse', () => {
		const { scene, loadEvents } = setup();
		attachLoadingScreen(asScene(scene));
		expect(scene.texts()).toContain('0%');
		expect(scene.texts()).not.toContain('NIBBLE VERSE');
		loadEvents.emit('progress', 0.5);
		frames(scene, 1);
		const mid = Number(pctText(scene)?.replace('%', ''));
		expect(mid).toBeGreaterThan(0);
		expect(mid).toBeLessThan(50); // đuổi dần, không nhảy cục
		frames(scene, 60);
		expect(pctText(scene)).toBe('50%');
	});

	it('mẹo Console xoay vòng theo chu kỳ', () => {
		const { scene } = setup();
		setGameSlug('sandfall');
		vi.stubGlobal(
			'fetch',
			vi.fn<() => Promise<never>>(() => new Promise(() => {})),
		);
		vi.stubGlobal(
			'localStorage',
			memoryStorage({
				'gk.loading.card.sandfall': { name: '', description: '', tips: ['A', 'B'] },
			}),
		);
		attachLoadingScreen(asScene(scene));
		expect(scene.texts()).toContain('A');
		scene.advance(2200 + 200);
		expect(scene.texts()).toContain('B');
	});

	it('không có slug: chỉ logo Nibble Verse, đi chung lượt tải của Boot', () => {
		const { scene, loadEvents } = setup();
		attachLoadingScreen(asScene(scene));
		expect(scene.loaded.map(([k]) => k)).toEqual([LOADING_LOGO_KEY]);
		expect(hero(scene)).toBeUndefined();
		scene.textureKeys.add(LOADING_LOGO_KEY);
		loadEvents.emit(LOGO_DONE);
		expect(hero(scene)?.texture).toBe(LOADING_LOGO_KEY);
	});

	it('có cache: hiện ngay tên, mô tả, mẹo, màu nền Console', () => {
		const { scene } = setup();
		setGameSlug('sandfall');
		vi.stubGlobal(
			'fetch',
			vi.fn<() => Promise<never>>(() => new Promise(() => {})),
		);
		vi.stubGlobal(
			'localStorage',
			memoryStorage({
				'gk.loading.card.sandfall': {
					name: 'Nibble Sands',
					description: 'Thả khối',
					tips: ['Mẹo Console'],
					bgColor: '#f6e7c8',
				},
			}),
		);
		attachLoadingScreen(asScene(scene));
		expect(scene.texts()).toEqual(
			expect.arrayContaining(['Nibble Sands', 'Thả khối', 'Mẹo Console']),
		);
		const bg = scene.byKind('rectangle')[0];
		expect(bg?.state.setFillStyle).toEqual([0xf6e7c8, 1]);
	});

	it('chưa có cache: lấy thẻ từ Console, hiện lên và lưu cho lần sau', async () => {
		const { scene } = setup();
		setGameSlug('sandfall');
		const store = memoryStorage();
		vi.stubGlobal('localStorage', store);
		const catalog = {
			data: [{ appName: 'sandfall', displayName: 'Nibble Sands', description: 'Thả khối' }],
		};
		vi.stubGlobal(
			'fetch',
			vi.fn<() => Promise<unknown>>(async () => ({ ok: true, json: async () => catalog })),
		);
		attachLoadingScreen(asScene(scene));
		await vi.waitFor(() => expect(scene.texts()).toContain('Nibble Sands'));
		expect(store.map.has('gk.loading.card.sandfall')).toBe(true);
	});

	it('finish: lên 100%, mờ dần rồi gọi next đúng một lần', () => {
		const { scene } = setup();
		const ls = attachLoadingScreen(asScene(scene));
		const next = vi.fn<() => void>();
		ls.finish(next);
		ls.finish(next);
		expect(pctText(scene)).toBe('100%');
		scene.advance(400);
		expect(next).toHaveBeenCalledTimes(1);
	});

	it('finish báo launcher nv.loading.done đúng một lần (portal đo thời gian vào game)', () => {
		postMessage.mockClear();
		const { scene } = setup();
		const ls = attachLoadingScreen(asScene(scene));
		ls.finish(vi.fn<() => void>());
		ls.finish(vi.fn<() => void>());
		expect(postMessage).toHaveBeenCalledTimes(1);
		expect(postMessage.mock.calls[0]?.[0]).toMatchObject({
			type: 'nv.loading.done',
			loadMs: expect.any(Number),
		});
	});

	it('nướng thanh một lần: mở lại màn không tạo Graphics mới', () => {
		const { scene } = setup();
		attachLoadingScreen(asScene(scene)).destroy();
		const baked = scene.created.filter((o) => o.kind === 'graphics').length;
		expect(baked).toBe(3); // rãnh, phần đã chạy, ngôi sao
		attachLoadingScreen(asScene(scene));
		expect(scene.created.filter((o) => o.kind === 'graphics').length).toBe(baked);
	});

	it('gỡ listener khi destroy hoặc scene shutdown, không rò qua scene sau', () => {
		const { scene, loadEvents } = setup();
		const ls = attachLoadingScreen(asScene(scene));
		expect(loadEvents.count('progress')).toBe(1);
		expect(loadEvents.count(LOGO_DONE)).toBe(1);
		ls.destroy();
		expect(loadEvents.count('progress')).toBe(0);
		expect(loadEvents.count(LOGO_DONE)).toBe(0);
		expect(scene.events.count('update')).toBe(0);
		attachLoadingScreen(asScene(scene));
		scene.events.emit('shutdown');
		expect(loadEvents.count('progress')).toBe(0);
		expect(scene.events.count('update')).toBe(0);
	});
});
