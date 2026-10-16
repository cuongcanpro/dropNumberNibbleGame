// Ngoại lệ có tên trong purity.test.ts: file DUY NHẤT của shell import `exit` từ nibi.
import { exit } from 'nibi';
import { emitGameExit, emitGameOpen } from '../tracking/game-session';
import { initGameKitTracking, nibiHostChannel } from '../tracking/nibi-tracking-host';
import { flushNow } from '../tracking/track';
import { runExitSequence } from './exit-sequence';
import { attachShareHost } from './host-share';
import { detectPlatform } from './platform-detect';

/** Vào game: đặt slug/mode vào game-context + phát `game_open`. Idempotent: gọi lại cùng slug chỉ đổi mode (không `game_open` thứ hai);
 * slug khác → `game_exit` phiên cũ rồi `game_open` mới. */
export function markGameOpen(slug: string, mode?: string): void {
	emitGameOpen(slug, mode);
}

/**
 * Về host: `game_exit` → flush (≤1.5s) → `exit()`. Không ném, không treo.
 * `recordQuit` = `() => collector.recordQuit('home')` nếu game dùng run collector.
 */
export function exitToHost(opts: { recordQuit?: () => void } = {}): Promise<void> {
	return runExitSequence({
		recordQuit: opts.recordQuit,
		emitGameExit: () => emitGameExit(),
		flush: flushNow,
		exit,
	});
}

export interface GameShellOptions {
	appVersion: string;
	gameSlug: string;
	mode?: string | undefined;
}

/** Một lệnh boot: bật tracking với platform đúng + `game_open`. Trả true nếu SDK bật. */
export function initGameShell(o: GameShellOptions): boolean {
	attachShareHost(nibiHostChannel()); // trước tracking: không lỡ tin capability của launcher
	const on = initGameKitTracking({ appVersion: o.appVersion, platform: detectPlatform() });
	markGameOpen(o.gameSlug, o.mode); // SDK tắt thì emit là no-op; context vẫn cần cho rank
	return on;
}
