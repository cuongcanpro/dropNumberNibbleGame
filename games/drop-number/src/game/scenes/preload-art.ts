import { type KitAtlas, preloadKitAtlas } from '@repo/game-kit/platform';
import type { Scene } from 'phaser';
import atlasData from '../atlas/ui.json';
import atlasUrl from '../atlas/ui.png?url';

// Tách khỏi file hằng/test: file này kéo `nibi` + `?url` nên vitest (Node) không import được.

/** Atlas sinh bởi `pnpm pack-assets` (nguồn ở `art/ui`); key frame = `ui/<tên file>`. */
const UI_ATLAS: KitAtlas = { key: 'game-atlas/ui', url: atlasUrl, frames: atlasData.frames };

/** Frame of the UI atlas; `add.image(x, y, START_BUTTON)` works like a loose image. */
export const START_BUTTON = 'ui/start-button';

/**
 * Ở Boot: ảnh = atlas (1 file thay cho N ảnh lẻ). `preloadKitAtlas` dựng alias để mỗi frame dùng như
 * một texture riêng. URL atlas tuyệt đối của Vite nên không đặt `load.setPath`.
 */
export function preloadGameArt(scene: Scene): void {
	preloadKitAtlas(scene, UI_ATLAS);
}

/**
 * Sound files under `res/` (mp3, or wav for very short effects); the key is the path without the
 * extension, e.g. `['sfx/tap.mp3', 'sfx/win.wav']` gives keys `sfx/tap` and `sfx/win`. Not loaded at Boot:
 * each boot file costs ~80 ms on a phone.
 */
const AUDIO_FILES: readonly string[] = [];

const AUDIO_EXT = /\.(mp3|wav)$/;

/**
 * Call in `create()` of the first play scene: queues the sounds and loads them in the background. The
 * kit's `Sound.playSfx/playBgm` skip keys not in the cache yet, so an early sound is just silent. Music:
 * call `Sound.getInstance().playBgm(key)` on `filecomplete-audio-<key>` from `scene.load`.
 */
export function queueGameAudio(scene: Scene): void {
	const files = AUDIO_FILES.map((url) => ({ key: url.replace(AUDIO_EXT, ''), url })).filter(
		(f) => !scene.cache.audio.exists(f.key),
	);
	if (files.length === 0) return;
	scene.load.setPath('');
	for (const f of files) scene.load.audio(f.key, f.url);
	if (!scene.load.isLoading()) scene.load.start();
}
