import { Logger } from './logger';
import { SfxPool } from './sfx-pool';

/**
 * Singleton âm thanh port từ Cocos `common/audio/sound`, chạy trên Phaser sound manager.
 * Chỉ cần một tập con của `Phaser.Scene` (cấu trúc, không import phaser) → test được bằng fake.
 */
export interface SoundHandle {
	isPlaying: boolean;
	play(): unknown;
	stop(): unknown;
	destroy(): unknown;
}

export interface SoundScene {
	sound: {
		add(key: string, config?: { loop?: boolean; volume?: number }): SoundHandle;
		play(key: string, config?: { loop?: boolean; volume?: number }): unknown;
		stopAll(): unknown;
	};
	cache: { audio: { exists(key: string): boolean } };
}

const BGM_VOLUME = 0.45;
const SFX_VOLUME = 0.7;

const logger = new Logger('sound');

export class Sound {
	private static instance: Sound | null = null;

	private scene: SoundScene | null = null;
	private sfxEnabled = true;
	private bgmEnabled = true;
	private bgm: SoundHandle | null = null;
	private lastBgmKey = '';
	private loopingSfx = new Map<string, SoundHandle>();
	private oneShots = new SfxPool();
	/** BGM and looping SFX keep one sound per key: a new one per start would hold its nodes until GC. */
	private held = new Map<string, SoundHandle>();

	static getInstance(): Sound {
		if (!Sound.instance) Sound.instance = new Sound();
		return Sound.instance;
	}

	/** Mỗi scene gọi khi bắt đầu để manager luôn trỏ vào sound system còn sống. */
	attach(scene: SoundScene): void {
		if (this.scene && this.scene.sound !== scene.sound) this.release();
		this.scene = scene;
	}

	setBgmEnabled(enabled: boolean): void {
		if (this.bgmEnabled === enabled) return;
		this.bgmEnabled = enabled;
		if (!enabled) this.stopBgm();
		else if (this.lastBgmKey) this.playBgm(this.lastBgmKey, true);
	}

	isBgmEnabled(): boolean {
		return this.bgmEnabled;
	}

	setSfxEnabled(enabled: boolean): void {
		this.sfxEnabled = enabled;
		if (!enabled) this.stopLoopingSfx();
	}

	isSfxEnabled(): boolean {
		return this.sfxEnabled;
	}

	playBgm(key: string, loop = true): void {
		if (!key) return;
		if (this.bgm?.isPlaying && this.lastBgmKey === key) return;
		this.stopBgm();
		this.lastBgmKey = key; // nhớ để bật lại khi toggle BGM
		const scene = this.scene;
		if (!scene || !this.bgmEnabled || !scene.cache.audio.exists(key)) return;
		this.bgm = this.start(scene, `bgm:${loop}:${key}`, key, { loop, volume: BGM_VOLUME });
	}

	stopBgm(): void {
		this.bgm?.stop();
		this.bgm = null;
	}

	playSfx(key: string, loop = false): void {
		const scene = this.scene;
		if (!scene || !this.sfxEnabled || !key || !scene.cache.audio.exists(key)) return;
		if (!loop) {
			this.oneShots.play(scene.sound, key, SFX_VOLUME);
			return;
		}
		this.stopSfx(key);
		const handle = this.start(scene, `sfx:${key}`, key, { loop: true, volume: SFX_VOLUME });
		if (handle) this.loopingSfx.set(key, handle);
	}

	stopSfx(key: string): void {
		const handle = this.loopingSfx.get(key);
		if (!handle) return;
		handle.stop();
		this.loopingSfx.delete(key);
	}

	/** Gọi khi thoát game: dừng hết + quên track BGM; giữ nguyên cờ bật/tắt của người dùng. */
	stopAllAndClear(): void {
		this.stopBgm();
		this.loopingSfx.clear();
		this.lastBgmKey = '';
		this.scene?.sound.stopAll();
		this.release();
	}

	/** Tắt/bật cả hai kênh. Không tự lưu (Cocos lưu qua ShareStorage; ở đây game tự quyết). */
	setMuted(muted: boolean): void {
		this.setSfxEnabled(!muted);
		this.setBgmEnabled(!muted);
	}

	private stopLoopingSfx(): void {
		for (const key of this.loopingSfx.keys()) this.stopSfx(key);
	}

	private start(
		scene: SoundScene,
		id: string,
		key: string,
		config: { loop: boolean; volume: number },
	): SoundHandle | null {
		try {
			const handle = this.held.get(id) ?? scene.sound.add(key, config);
			this.held.set(id, handle);
			handle.play();
			return handle;
		} catch (error) {
			logger.warn(`${key} failed to play`, error);
			return null;
		}
	}

	/** Destroys every kept sound so its nodes go with the next GC. */
	private release(): void {
		this.oneShots.release();
		for (const handle of this.held.values()) handle.destroy();
		this.held = new Map();
		this.bgm = null;
		this.loopingSfx = new Map();
	}
}
