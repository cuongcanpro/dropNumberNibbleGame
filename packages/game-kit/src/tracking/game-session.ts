import { setGameMode, setGameSlug } from './game-context';
import { emit } from './track';

/**
 * Vòng đời phiên: session_start (mở app) · game_open / game_exit (vào–rời minigame).
 *
 * Vì sao cần: trước đây Console chỉ thấy người CHƠI TỚI VÁN. Người mở app rồi
 * thoát, vào game rồi bỏ ngay, hay chỉ duyệt danh sách — đều vô hình. DAU và
 * retention vì thế đếm thiếu, và không có cách nào biết SDK có sống hay không nếu
 * người dùng chưa kịp vào ván.
 *
 * Module THUẦN (emit/now inject được) — wiring thật ở nibi-tracking-host và shell.
 */
export type Emit = typeof emit;

let openedSlug: string | null = null;
let openedAt = 0;

/** Mở app. Gọi một lần, ngay sau khi SDK sẵn sàng. */
export function emitSessionStart(e: Emit = emit): void {
	e('session_start');
}

/**
 * Vào một minigame. Đồng thời đặt slug/mode vào game-context (nguồn cho sink-bridge) —
 * Cocos làm việc này riêng bằng ShareStorage. `mode` bỏ trống = game một mode.
 * Idempotent theo slug: gọi lại khi đang mở cùng slug chỉ đổi mode.
 */
export function emitGameOpen(
	slug: string,
	mode?: string,
	e: Emit = emit,
	nowMs: () => number = Date.now,
): void {
	if (!slug) return; // không có slug thì event vô nghĩa, bỏ qua còn hơn ghi rác
	if (openedSlug === slug) {
		// Gọi lại cùng slug (đổi mode): chỉ cập nhật mode, không phát game_open thứ hai.
		setGameMode(mode);
		return;
	}
	// Slug khác đang mở: đóng phiên cũ trước để game_open/game_exit luôn đi theo cặp.
	if (openedSlug) emitGameExit(e, nowMs);
	setGameSlug(slug);
	setGameMode(mode);
	openedSlug = slug;
	openedAt = nowMs();
	e('game_open', { gameSlug: slug, mode });
}

/**
 * Rời minigame về menu. An toàn khi gọi thừa: không có phiên nào đang mở thì
 * bỏ qua, tránh sinh game_exit lẻ không có game_open đi kèm.
 */
export function emitGameExit(e: Emit = emit, nowMs: () => number = Date.now): void {
	if (!openedSlug) return;
	const slug = openedSlug;
	const durationMs = Math.max(0, nowMs() - openedAt);
	openedSlug = null;
	openedAt = 0;
	e('game_exit', { gameSlug: slug, durationMs });
}

/** Chỉ dùng trong test. */
export function resetGameSessionForTest(): void {
	openedSlug = null;
	openedAt = 0;
}
