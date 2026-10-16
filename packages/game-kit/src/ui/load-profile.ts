import type Phaser from 'phaser';
import { nowMs } from '../platform/host-signal';
import { sendClientDiag } from '../tracking/tracking-bootstrap';

/**
 * Hồ sơ tải của màn loading (09/10): portal đo được haredoku mất ~8 s trong loader Phaser MỖI lần
 * vào game. Tách từng file thành chờ lượt (queue) / đọc (read: `load()` → FILE_LOAD) / xử lý-giải mã
 * (decode: FILE_LOAD → FILE_COMPLETE) để biết 8 s nằm ở I/O của runtime hay ở giải mã ảnh/âm thanh.
 * Gửi MỘT dòng `kind: load_profile` qua `/public/client-diag` (Server chỉ in log).
 */
export interface FileTiming {
	readonly key: string;
	readonly type: string;
	readonly bytes: number;
	startAt: number | undefined;
	loadAt: number | undefined;
	completeAt: number | undefined;
	failed?: boolean;
}

interface TypeSum {
	n: number;
	bytes: number;
	readMs: number;
	decodeMs: number;
	maxReadMs: number;
	maxDecodeMs: number;
}

const ms = (a: number | undefined, b: number | undefined): number =>
	a === undefined || b === undefined ? 0 : Math.max(0, Math.round(b - a));

export function summarizeLoad(
	files: readonly FileTiming[],
	run: { loaderStartAt: number; completeAt: number; maxParallel: number },
) {
	const byType: Record<string, TypeSum> = {};
	const rows = files.map((file) => {
		const read = ms(file.startAt, file.loadAt);
		const decode = ms(file.loadAt, file.completeAt);
		const sum = (byType[file.type] ??= {
			n: 0,
			bytes: 0,
			readMs: 0,
			decodeMs: 0,
			maxReadMs: 0,
			maxDecodeMs: 0,
		});
		sum.n += 1;
		sum.bytes += file.bytes;
		sum.readMs += read;
		sum.decodeMs += decode;
		sum.maxReadMs = Math.max(sum.maxReadMs, read);
		sum.maxDecodeMs = Math.max(sum.maxDecodeMs, decode);
		return {
			key: file.key.slice(0, 48),
			type: file.type,
			bytes: file.bytes,
			queue: ms(run.loaderStartAt, file.startAt),
			read,
			decode,
		};
	});
	const rel = (t: number | undefined) => (t === undefined ? 0 : Math.round(t - run.loaderStartAt));
	const max = (pick: (f: FileTiming) => number | undefined) =>
		Math.max(0, ...files.map((f) => rel(pick(f))));
	// Bao nhiêu file ĐANG đọc cùng lúc, đỉnh — 1 nghĩa là runtime đọc tuần tự dù Phaser cho 32 luồng.
	const edges = files.flatMap((f) =>
		f.startAt === undefined || f.loadAt === undefined
			? []
			: [
					{ t: f.startAt, d: 1 },
					{ t: f.loadAt, d: -1 },
				],
	);
	edges.sort((a, b) => a.t - b.t || a.d - b.d);
	let open = 0;
	let peakParallelReads = 0;
	for (const e of edges) {
		open += e.d;
		peakParallelReads = Math.max(peakParallelReads, open);
	}
	// Khoảng cách giữa hai lần đọc-xong liên tiếp: bội số ~16,7 ms ⇒ bị khoá theo khung hình.
	const loads = files
		.flatMap((f) => (f.loadAt === undefined ? [] : [f.loadAt]))
		.sort((a, b) => a - b);
	const gaps = loads
		.slice(1)
		.map((t, i) => t - (loads[i] ?? t))
		.sort((a, b) => a - b);
	const medianLoadGapMs =
		gaps.length === 0 ? 0 : Math.round((gaps[Math.floor(gaps.length / 2)] ?? 0) * 10) / 10;
	return {
		files: files.length,
		medianLoadGapMs,
		failed: files.filter((f) => f.failed).length,
		totalMs: Math.round(run.completeAt - run.loaderStartAt),
		maxParallel: run.maxParallel,
		peakParallelReads,
		lastStartAt: max((f) => f.startAt),
		lastLoadAt: max((f) => f.loadAt),
		lastCompleteAt: max((f) => f.completeAt),
		byType,
		slowest: [...rows].sort((a, b) => b.read + b.decode - (a.read + a.decode)).slice(0, 8),
	};
}

const now = (): number => nowMs() ?? 0;

type LoaderFile = Phaser.Loader.File & { load: () => void; onProcessComplete: () => void };

/** Bọc một method của File để đóng dấu thời điểm nó được gọi (chỉ dùng cho đo đạc). */
function stamp(file: LoaderFile, method: 'load' | 'onProcessComplete', mark: () => void): void {
	const original = file[method].bind(file);
	file[method] = () => {
		mark();
		original();
	};
}

/** Gắn vào loader của Boot; tự gửi khi loader xong. Không bao giờ ném — đo đạc không được cản game. */
export function profileLoader(scene: Phaser.Scene, game: string): void {
	try {
		const load = scene.load;
		const timings = new Map<Phaser.Loader.File, FileTiming>();
		let loaderStartAt = now();
		// Giả thuyết 09/10: scheduler Nibi chạy MỘT tác vụ async mỗi khung ⇒ tải bị khoá theo tần số khung.
		// Đếm khung trong lúc tải + khoảng cách giữa các lần đọc xong để chốt (≈16,7 ms/khung ở 60 Hz).
		const frame = (): number => scene.game?.loop?.frame ?? -1;
		let startFrame = frame();
		load.on('addfile', (_key: string, _type: string, _loader: unknown, file: LoaderFile) => {
			const t: FileTiming = {
				key: file.key,
				type: file.type,
				bytes: 0,
				startAt: undefined,
				loadAt: undefined,
				completeAt: undefined,
			};
			timings.set(file, t);
			stamp(file, 'load', () => {
				t.startAt = now();
			});
			stamp(file, 'onProcessComplete', () => {
				t.completeAt = now();
			});
		});
		load.once('start', () => {
			loaderStartAt = now();
			startFrame = frame();
		});
		// FILE_LOAD: đọc xong, trước khi xử lý/giải mã.
		load.on('load', (file: Phaser.Loader.File) => {
			const t = timings.get(file);
			if (t) t.loadAt = now();
		});
		load.on('loaderror', (file: Phaser.Loader.File) => {
			const t = timings.get(file);
			if (t) t.failed = true;
		});
		load.once('complete', () => {
			try {
				const files = [...timings].map(([file, t]) => ({
					...t,
					bytes: Math.max(file.bytesTotal, file.bytesLoaded, 0),
				}));
				const frames = frame() - startFrame;
				sendClientDiag({
					kind: 'load_profile',
					game,
					frames,
					fps: Math.round(scene.game?.loop?.actualFps ?? -1),
					...summarizeLoad(files, {
						loaderStartAt,
						completeAt: now(),
						maxParallel: load.maxParallelDownloads,
					}),
				});
			} catch {
				// đo đạc hỏng thì thôi
			}
		});
	} catch {
		// loader lạ / phiên bản Phaser khác: bỏ đo
	}
}
