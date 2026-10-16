import { host } from 'nibi';

/**
 * Tin game → launcher (kênh `host` của Nibi), cùng họ với `nv.identity.request`.
 *
 * `nv.loading.done`: màn loading vừa xong, game chơi được. Portal ghép với mốc nó tự đo
 * (bấm Play → kiểm channel → prepare → runtimeReady → ready) thành một dòng `play_timing`
 * gửi về Console, để biết "vào game lâu" nằm ở bước nào (09/10: chơi lại vẫn lâu như lần đầu).
 * Web/simulator: `host` là no-op, không ai nghe — vô hại.
 */
export const LOADING_DONE = 'nv.loading.done';

export interface LoadingDoneMessage {
	readonly type: typeof LOADING_DONE;
	/** Từ lúc gắn màn loading (Boot `create`) tới lúc xong — phần tải + giải mã asset của game. */
	readonly loadMs: number;
	/** `performance.now()` lúc xong ≈ từ lúc JS của game bắt đầu chạy; -1 nếu runtime không có. */
	readonly jsMs: number;
}

const round = (ms: number): number => Math.max(0, Math.round(ms));

export function loadingDoneMessage(loadMs: number, jsMs: number | undefined): LoadingDoneMessage {
	return { type: LOADING_DONE, loadMs: round(loadMs), jsMs: jsMs === undefined ? -1 : round(jsMs) };
}

export const nowMs = (): number | undefined =>
	typeof globalThis.performance?.now === 'function' ? globalThis.performance.now() : undefined;

/** Không bao giờ ném: báo đo đạc hỏng thì thôi, không được làm hỏng việc vào game. */
export function postHostSignal(
	data: unknown,
	// oxlint-disable-next-line unicorn/require-post-message-target-origin -- host Nibi là MessagePort tới launcher, không có origin
	post: (d: unknown) => void = (d) => host.postMessage(d),
): void {
	try {
		post(data);
	} catch {
		// launcher cũ / web: không có ai nghe
	}
}
