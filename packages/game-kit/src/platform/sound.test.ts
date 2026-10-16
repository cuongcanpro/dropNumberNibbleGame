import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SFX_VOICES_PER_KEY } from './sfx-pool';
import { Sound, type SoundHandle, type SoundScene } from './sound';

type FakeHandle = SoundHandle & {
	key: string;
	plays: number;
	/** Plays started while still sounding, which Phaser does by cutting the sound. */
	cuts: number;
	destroy: ReturnType<typeof vi.fn<() => void>>;
};

function makeScene(add?: (key: string) => FakeHandle) {
	const handles: FakeHandle[] = [];
	const scene = {
		sound: {
			add: vi.fn<(key: string) => FakeHandle>(
				add ??
					((key) => {
						const h: FakeHandle = {
							key,
							plays: 0,
							cuts: 0,
							isPlaying: false,
							play() {
								if (h.isPlaying) h.cuts++;
								h.plays++;
								h.isPlaying = true;
							},
							stop() {
								h.isPlaying = false;
							},
							destroy: vi.fn<() => void>(),
						};
						handles.push(h);
						return h;
					}),
			),
			play: vi.fn<(key: string) => void>(),
			stopAll: vi.fn<() => void>(),
		},
		cache: { audio: { exists: (k: string) => k !== 'missing' } },
	} satisfies SoundScene;
	return { scene, handles };
}

describe('Sound', () => {
	let s: Sound;
	let fake: ReturnType<typeof makeScene>;
	beforeEach(() => {
		s = Sound.getInstance();
		s.stopAllAndClear();
		s.setSfxEnabled(true);
		s.setBgmEnabled(true);
		fake = makeScene();
		s.attach(fake.scene);
	});

	it('tắt SFX thì không gọi sound.play/add', () => {
		s.setSfxEnabled(false);
		s.playSfx('tap');
		s.playSfx('loop', true);
		expect(fake.scene.sound.play).not.toHaveBeenCalled();
		expect(fake.scene.sound.add).not.toHaveBeenCalled();
	});

	it('bật SFX phát, key không tồn tại bị bỏ qua', () => {
		s.playSfx('tap');
		s.playSfx('missing');
		expect(fake.handles.map((h) => [h.key, h.plays])).toEqual([['tap', 1]]);
	});

	it('SFX phát lại sound đã xong thay vì tạo sound mới mỗi lần (quota audio node của Nibi)', () => {
		for (let i = 0; i < 1000; i++) {
			s.playSfx('tap');
			for (const h of fake.handles) h.stop();
		}
		expect(fake.scene.sound.add).toHaveBeenCalledTimes(1);
		expect(fake.handles[0].plays).toBe(1000);
		expect(fake.scene.sound.play).not.toHaveBeenCalled();
	});

	it('SFX cùng key chồng nhau tới giới hạn rồi bỏ lượt, không cắt sound đang kêu', () => {
		for (let i = 0; i < SFX_VOICES_PER_KEY + 5; i++) s.playSfx('tap');
		expect(fake.handles).toHaveLength(SFX_VOICES_PER_KEY);
		expect(fake.handles.every((h) => h.plays === 1 && h.cuts === 0)).toBe(true);
	});

	it('phát lỗi (vd. hết quota) chỉ log, không ném vào frame', () => {
		const error = new Error('the audio node quota was exceeded');
		const failing = makeScene(() => {
			throw error;
		});
		s.attach(failing.scene);
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
		expect(() => {
			s.playSfx('tap');
			s.playSfx('loop', true);
			s.playBgm('theme');
		}).not.toThrow();
		expect(warn).toHaveBeenCalledTimes(3);
		expect(warn.mock.calls[0]?.join(' ')).toContain('tap');
		warn.mockRestore();
	});

	it('SFX lặp và BGM bật lại dùng lại sound cũ', () => {
		s.playSfx('loop', true);
		s.stopSfx('loop');
		s.playSfx('loop', true);
		s.playBgm('theme');
		s.setBgmEnabled(false);
		s.setBgmEnabled(true);
		expect(fake.handles.map((h) => [h.key, h.plays])).toEqual([
			['loop', 2],
			['theme', 2],
		]);
	});

	it('stopAllAndClear và attach sound manager khác thì huỷ các sound đang giữ', () => {
		s.playSfx('tap');
		s.playBgm('theme');
		s.stopAllAndClear();
		expect(fake.handles.every((h) => h.destroy.mock.calls.length === 1)).toBe(true);

		s.playSfx('tap');
		s.attach(makeScene().scene);
		expect(fake.handles[2].destroy).toHaveBeenCalledTimes(1);
	});

	it('tắt BGM dừng nhạc, bật lại phát tiếp track đã nhớ', () => {
		s.playBgm('theme');
		expect(fake.handles[0].isPlaying).toBe(true);
		s.setBgmEnabled(false);
		expect(fake.handles[0].isPlaying).toBe(false);
		s.setBgmEnabled(true);
		expect(fake.handles).toHaveLength(1);
		expect(fake.handles[0].isPlaying).toBe(true);
	});

	it('playBgm khi đang tắt chỉ nhớ key, không phát', () => {
		s.setBgmEnabled(false);
		s.playBgm('theme');
		expect(fake.scene.sound.add).not.toHaveBeenCalled();
		s.setBgmEnabled(true);
		expect(fake.handles[0].key).toBe('theme');
	});

	it('stopAllAndClear dừng hết và quên track', () => {
		s.playBgm('theme');
		s.stopAllAndClear();
		expect(fake.scene.sound.stopAll).toHaveBeenCalled();
		s.setBgmEnabled(false);
		s.setBgmEnabled(true);
		expect(fake.handles).toHaveLength(1);
	});

	it('setMuted đổi cả hai kênh', () => {
		s.setMuted(true);
		expect([s.isSfxEnabled(), s.isBgmEnabled()]).toEqual([false, false]);
	});
});
