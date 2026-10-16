import { EventQueue } from './event-queue';
import { FlushLoop } from './flush-loop';
import { normalizeMode } from './game-context';
import type { EmitCtx, QueuedEvent, TrackConfig } from './types';
import { FLUSH_INTERVAL_MS, FLUSH_NOW_ACTIONS, FLUSH_THRESHOLD, SESSION_GAP_MS } from './types';
import { uuidV4 } from './uuid';

/**
 * API công khai của tracking SDK (spec §5). Nguyên tắc số 1: KHÔNG BAO GIỜ
 * làm phiền gameplay — emit sync-append không await, mọi lỗi bị nuốt,
 * không tự mở mạng (FlushLoop tự guard offline/backoff).
 */
let cfg: TrackConfig | null = null;
let queue: EventQueue | null = null;
let loop: FlushLoop | null = null;
let sessionId = '';
let seqNo = 0;
let lastEmitAt = 0;
let sinceFlush = 0;
let timer: ReturnType<typeof setInterval> | null = null;
const preInitBuffer: { action: string; ctx?: EmitCtx | undefined; at: number }[] = [];

let initError: string | undefined;
let lastEmitError: string | undefined;

export function initTracking(config: TrackConfig): void {
	try {
		cfg = config;
		queue = new EventQueue(config.storage);
		loop = new FlushLoop(queue, config);
		rotateSession();
		for (const b of preInitBuffer) emitAt(b.action, b.ctx, b.at); // emit trước init không mất
		preInitBuffer.length = 0;
		if (timer) clearInterval(timer);
		timer = setInterval(() => void loop?.flushNow(), FLUSH_INTERVAL_MS); // offline thì FlushLoop tự bỏ qua
	} catch (e) {
		// init hỏng — game vẫn chạy, nhưng cfg/queue có thể nửa vời (cfg đã gán,
		// queue chưa) ⇒ emit rơi vào preInitBuffer và KHÔNG BAO GIỜ persist.
		// Giữ lý do lại để host hỏi được, thay vì nuốt trắng như trước.
		initError = String(e);
	}
}

/** Config đã init — cho đường ĐỌC (rank-client) dùng lại endpoint/appKey/mạng. */
export function trackingConfig(): TrackConfig | null {
	return cfg;
}

/** Trạng thái THẬT sau init: chỉ true khi emit thực sự ghi được vào queue. */
export function trackingReady(): {
	ready: boolean;
	error?: string | undefined;
	emitError?: string | undefined;
	queued?: number | undefined;
} {
	return {
		ready: !!cfg && !!queue,
		error: initError,
		emitError: lastEmitError,
		queued: queue?.size(),
	};
}

export function emit(action: string, ctx?: EmitCtx): void {
	try {
		const at = cfg?.now?.() ?? Date.now();
		if (!cfg || !queue) {
			preInitBuffer.push({ action, ctx, at });
			return;
		}
		emitAt(action, ctx, at);
		sinceFlush += 1;
		// BA điều kiện đẩy, cộng dồn chứ không thay thế nhau: đủ 50 event · là thành
		// tích (FLUSH_NOW_ACTIONS) · timer 60s ở initTracking.
		if (sinceFlush >= FLUSH_THRESHOLD || FLUSH_NOW_ACTIONS.has(action)) {
			sinceFlush = 0;
			void loop?.flushNow();
		}
	} catch (e) {
		// nuốt mọi lỗi — tracking không được phép gây crash. NHƯNG phải giữ lại lý do:
		// nuốt trắng thì event biến mất mà không ai biết vì sao.
		lastEmitError = String(e);
	}
}

/**
 * Host gọi lúc mở app / mạng quay lại / trước khi thoát game. An toàn gọi bất kỳ lúc nào.
 * Gọi hai lần: lần đầu có thể chỉ chờ flush đang chạy dở (đã chụp queue TRƯỚC event vừa emit,
 * ví dụ game_exit); lần hai xả phần còn lại. Backoff/offline vẫn chặn trong FlushLoop.
 */
export async function flushNow(): Promise<void> {
	try {
		await loop?.flushNow();
		await loop?.flushNow();
	} catch {
		// nuốt — replay vô hại nhờ event_id
	}
}

function emitAt(action: string, ctx: EmitCtx | undefined, atMs: number): void {
	if (!cfg || !queue) return;
	if (atMs - lastEmitAt > SESSION_GAP_MS) rotateSession();
	lastEmitAt = atMs;
	seqNo += 1;
	const evt: QueuedEvent = {
		event_id: uuidV4(),
		ts: new Date(atMs).toISOString(),
		session_id: sessionId,
		seq_no: seqNo,
		source: cfg.source,
		game_slug: ctx?.gameSlug,
		action,
		level_id: ctx?.levelId,
		duration_ms: ctx?.durationMs,
		value: ctx?.value,
		network_state: cfg.getNetworkState(),
		payload: JSON.stringify(ctx?.payload ?? {}),
		mode: normalizeMode(ctx?.mode),
	};
	queue.append(evt);
}

function rotateSession(): void {
	sessionId = uuidV4();
	seqNo = 0;
}

/** Chỉ dùng trong test. */
export function resetForTest(): void {
	if (timer) clearInterval(timer);
	timer = null;
	cfg = null;
	queue = null;
	loop = null;
	sessionId = '';
	seqNo = 0;
	lastEmitAt = 0;
	sinceFlush = 0;
	preInitBuffer.length = 0;
	initError = undefined;
	lastEmitError = undefined;
}
