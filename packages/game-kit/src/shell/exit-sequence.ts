/**
 * Trình tự thoát game — THUẦN, dep inject để test được. `game-shell.ts` nối dep thật.
 *
 * Thứ tự là bắt buộc (spike #13: code sau `exit()` không chạy, runtime chết ngay):
 * (1) game_exit vào queue → (2) xả queue, chặn trên 1.5s → (3) `exit()`.
 * Mạng treo cũng không giữ người chơi quá 1.5s; `exit()` luôn được gọi, không ném ra ngoài.
 */
export const EXIT_FLUSH_TIMEOUT_MS = 1500;

export interface ExitDeps {
	/** Optional `recordQuit('home')` của collector — chạy trước game_exit để event quit vào queue kịp. */
	recordQuit?: (() => void) | undefined;
	emitGameExit: () => void;
	flush: () => Promise<void>;
	exit: () => void;
	timeoutMs?: number | undefined;
}

export async function runExitSequence(d: ExitDeps): Promise<void> {
	try {
		d.recordQuit?.();
	} catch {
		// quan sát hỏng không được chặn thoát
	}
	try {
		d.emitGameExit();
	} catch {
		// như trên
	}
	let timer: ReturnType<typeof setTimeout> | undefined;
	try {
		const timeout = new Promise<void>((resolve) => {
			timer = setTimeout(resolve, d.timeoutMs ?? EXIT_FLUSH_TIMEOUT_MS);
		});
		await Promise.race([d.flush(), timeout]);
	} catch {
		// flush lỗi: event còn trong queue, phiên sau gửi bù
	} finally {
		if (timer !== undefined) clearTimeout(timer);
	}
	try {
		d.exit();
	} catch {
		// host không cho exit thì thôi
	}
}
