import { Logger } from './logger';
import type { SoundHandle, SoundScene } from './sound';

/**
 * Same-key one-shots that may ring at once; a play past this while all are busy is dropped. Cake
 * Sort's merge, the densest SFX timeline so far, needs 2 for Slice landings and 3 for a group drop.
 */
export const SFX_VOICES_PER_KEY = 3;

const logger = new Logger('sound');

/**
 * Nibi native frees an audio node only on GC and throws once 256 are alive, and a Phaser sound holds
 * three, so a new sound per play soon kills the frame loop (docs/nibi-native-api-compat.md). Each key
 * replays a few sounds instead, and only ended ones: cutting a playing one leaks its buffer source.
 */
export class SfxPool {
	private voices = new Map<string, readonly SoundHandle[]>();

	play(sound: SoundScene['sound'], key: string, volume: number): void {
		try {
			this.freeVoice(sound, key, volume)?.play();
		} catch (error) {
			logger.warn(`SFX ${key} failed to play`, error);
		}
	}

	/** Destroys every voice so its nodes go with the next GC; later plays start fresh ones. */
	release(): void {
		for (const voices of this.voices.values()) {
			for (const voice of voices) voice.destroy();
		}
		this.voices = new Map();
	}

	private freeVoice(sound: SoundScene['sound'], key: string, volume: number): SoundHandle | null {
		const voices = this.voices.get(key) ?? [];
		const idle = voices.find((voice) => !voice.isPlaying);
		if (idle) return idle;
		if (voices.length >= SFX_VOICES_PER_KEY) return null;
		const voice = sound.add(key, { volume });
		this.voices.set(key, [...voices, voice]);
		return voice;
	}
}
