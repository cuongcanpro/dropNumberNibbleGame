import { describe, expect, it, vi } from 'vitest';
import { atlasPageUrls, kitAtlasPages } from './atlas-pages';
import { type QueueAudioScene, queueAudioAfterStart } from './queue-audio';

function fakeScene(cached: string[] = [], active = true) {
	const calls: string[] = [];
	const listeners = new Map<string, () => void>();
	let loading = false;
	const scene: QueueAudioScene = {
		cache: { audio: { exists: (k) => cached.includes(k) } },
		load: {
			setPath: (p) => calls.push(`path:${p}`),
			audio: (k, u) => calls.push(`audio:${k}=${u}`),
			once: (e, fn) => listeners.set(e, fn),
			isLoading: () => loading,
			start: () => {
				loading = true;
				calls.push('start');
			},
		},
		sys: { isActive: () => active },
	};
	return { scene, calls, listeners };
}

describe('queueAudioAfterStart', () => {
	it('queues missing files, puts bgm first, resets the path and starts the loader', () => {
		const { scene, calls } = fakeScene(['sfx/a']);
		queueAudioAfterStart(scene, ['sfx/a', 'sfx/b', { key: 'bgm', url: '/x/bgm.mp3' }], {
			bgm: 'bgm',
			path: 'res/',
			onBgmReady: vi.fn<() => void>(),
		});
		expect(calls).toEqual([
			'path:res/',
			'audio:bgm=/x/bgm.mp3',
			'audio:sfx/b=sfx/b.mp3',
			'path:',
			'start',
		]);
	});

	it('does nothing when every key is cached', () => {
		const { scene, calls } = fakeScene(['a']);
		queueAudioAfterStart(scene, ['a']);
		expect(calls).toEqual([]);
	});

	it('starts bgm on filecomplete only while the scene is active', () => {
		const on = fakeScene();
		const ready = vi.fn<() => void>();
		queueAudioAfterStart(on.scene, ['m'], { bgm: 'm', onBgmReady: ready });
		on.listeners.get('filecomplete-audio-m')?.();
		expect(ready).toHaveBeenCalledTimes(1);
		const off = fakeScene([], false);
		const ready2 = vi.fn<() => void>();
		queueAudioAfterStart(off.scene, ['m'], { bgm: 'm', onBgmReady: ready2 });
		off.listeners.get('filecomplete-audio-m')?.();
		expect(ready2).not.toHaveBeenCalled();
	});

	it('calls onBgmReady at once when bgm is already cached', () => {
		const { scene } = fakeScene(['m']);
		const ready = vi.fn<() => void>();
		queueAudioAfterStart(scene, ['m', 'x'], { bgm: 'm', onBgmReady: ready });
		expect(ready).toHaveBeenCalledTimes(1);
	});
});

describe('kitAtlasPages', () => {
	const urls = atlasPageUrls({ './atlas/a-0.png': '/u0.png', './atlas/a-1.png': '/u1.png' });
	it('maps each multiatlas page to its own KitAtlas', () => {
		const pages = kitAtlasPages(
			'g/a',
			{
				textures: [
					{ image: 'a-0.png', frames: [{ filename: 'k1', frame: { x: 0, y: 0, w: 1, h: 1 } }] },
					{ image: 'a-1.png', frames: [{ filename: 'k2', frame: { x: 2, y: 2, w: 3, h: 3 } }] },
				],
			},
			urls,
		);
		expect(pages.map((p) => [p.key, p.url, Object.keys(p.frames)])).toEqual([
			['g/a/0', '/u0.png', ['k1']],
			['g/a/1', '/u1.png', ['k2']],
		]);
	});
	it('wraps a single-page hash atlas', () => {
		const pages = kitAtlasPages(
			'g/a',
			{ frames: { k: { frame: { x: 0, y: 0, w: 1, h: 1 } } }, meta: { image: 'a-1.png' } },
			urls,
		);
		expect(pages).toHaveLength(1);
		expect(pages[0]?.url).toBe('/u1.png');
	});
});
