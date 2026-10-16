import { Sound } from './sound';

/** Một file âm thanh: chuỗi = key, URL là `<key>.mp3`; hoặc `{ key, url }` khi URL khác (vd Vite `?url`). */
export type AudioFile = string | { readonly key: string; readonly url: string };

export interface QueueAudioOptions {
	/** Key nhạc nền: xếp đầu hàng, phát khi file về nếu scene còn chạy. */
	readonly bgm?: string;
	/** Mặc định `Sound.playBgm(bgm, true)`; truyền để thay (vd chỉ phát khi ván cần nhạc). Cũng gọi ngay nếu bgm đã có trong cache. */
	readonly onBgmReady?: () => void;
	/** `load.setPath` bao quanh phần xếp hàng (vd `ASSET_ROOT`); mặc định rỗng. Luôn trả về rỗng sau đó. */
	readonly path?: string;
}

/** Phần của scene mà hàm cần, cấu trúc để test bằng fake. */
export interface QueueAudioScene {
	cache: { audio: { exists(key: string): boolean } };
	load: {
		setPath(path: string): unknown;
		audio(key: string, url: string): unknown;
		once(event: string, fn: () => void): unknown;
		isLoading(): boolean;
		start(): unknown;
	};
	sys: { isActive(): boolean };
}

/**
 * Âm thanh không cần ở khung đầu (mỗi file ~80 ms khi boot): gọi sau khi scene chơi đầu tiên đã dựng.
 * Bỏ qua key đã có trong cache nên gọi lại (ván mới, scene sau) an toàn. `Sound.playSfx/playBgm` của kit
 * bỏ qua key chưa có nên tiếng đến sớm chỉ im lặng; nhạc nền bật khi `filecomplete-audio-<bgm>` nếu
 * scene còn active.
 */
export function queueAudioAfterStart(
	scene: QueueAudioScene,
	files: readonly AudioFile[],
	options: QueueAudioOptions = {},
): void {
	const { bgm, onBgmReady, path = '' } = options;
	const startBgm = (): void => {
		if (onBgmReady) onBgmReady();
		else if (bgm) Sound.getInstance().playBgm(bgm, true);
	};
	const { load, cache } = scene;
	const todo = files
		.map((f) => (typeof f === 'string' ? { key: f, url: `${f}.mp3` } : f))
		.filter((f) => !cache.audio.exists(f.key));
	if (bgm && onBgmReady && cache.audio.exists(bgm)) onBgmReady();
	if (todo.length === 0) return;
	// Nhạc nền xếp đầu hàng: nghe được sớm nhất.
	todo.sort((a, b) => Number(b.key === bgm) - Number(a.key === bgm));
	load.setPath(path);
	for (const f of todo) load.audio(f.key, f.url);
	// setPath dính vào loader dùng chung của scene: trả lại để lần nạp sau không bị tiền tố.
	load.setPath('');
	if (bgm && todo.some((f) => f.key === bgm)) {
		load.once(`filecomplete-audio-${bgm}`, () => {
			if (scene.sys.isActive()) startBgm();
		});
	}
	if (!load.isLoading()) load.start();
}
