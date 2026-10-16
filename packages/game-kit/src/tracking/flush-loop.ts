import type { EventQueue } from './event-queue';
import type { TrackConfig } from './types';
import { BACKOFF_BASE_MS, BACKOFF_CAP_MS, BATCH_MAX, SDK_VERSION } from './types';
import { uuidV4 } from './uuid';

/** Timeout cho một POST: native chưa chắc có AbortController nên chỉ bỏ chờ (không huỷ request). */
export const FETCH_TIMEOUT_MS = 15_000;

/**
 * Chính sách đẩy batch (spec §5): CHỈ flush khi mạng ĐANG sẵn vì lý do khác —
 * SDK không bao giờ là lý do bật radio. Server idempotent theo event_id nên
 * fail cứ giữ queue retry, không cần state "đã gửi chưa". Backoff lũy tiến
 * 1s ×2 → cap 300s chặn retry dồn dập khi Console/đường mạng đang lỗi.
 */
export class FlushLoop {
	private readonly queue: EventQueue;
	private readonly cfg: TrackConfig;
	private current: Promise<void> | null = null;
	private backoffMs = 0; // 0 = không trong backoff
	private nextTryAt = 0;

	constructor(queue: EventQueue, cfg: TrackConfig) {
		this.queue = queue;
		this.cfg = cfg;
	}

	/** Đang flush thì trả promise đang chạy (không chồng) — để host `await` lúc thoát game. */
	flushNow(): Promise<void> {
		if (this.current) return this.current;
		if (this.cfg.getNetworkState() === 'offline') return Promise.resolve();
		const now = this.cfg.now?.() ?? Date.now();
		if (now < this.nextTryAt) return Promise.resolve(); // đang trong backoff window
		const run = this.drain().finally(() => {
			this.current = null;
		});
		this.current = run;
		return run;
	}

	private async drain(): Promise<void> {
		while (this.queue.size() > 0) {
			const batch = this.queue.peekBatch(BATCH_MAX);
			const ok = await this.send(batch);
			if (!ok) {
				this.backoffMs = Math.min(
					this.backoffMs === 0 ? BACKOFF_BASE_MS : this.backoffMs * 2,
					BACKOFF_CAP_MS,
				);
				this.nextTryAt = (this.cfg.now?.() ?? Date.now()) + this.backoffMs;
				return; // giữ nguyên queue — lần sau thử lại
			}
			this.backoffMs = 0;
			this.nextTryAt = 0;
			this.queue.removeByIds(batch.map((e) => e.event_id));
		}
	}

	private async send(events: unknown[]): Promise<boolean> {
		const fetchFn = this.cfg.fetchFn ?? fetch;
		const d = this.cfg.device;
		const body = JSON.stringify({
			batch_id: uuidV4(),
			sent_ts: new Date(this.cfg.now?.() ?? Date.now()).toISOString(),
			user_id: this.cfg.userId?.() ?? '',
			device: {
				device_id: d.device_id,
				platform: d.platform,
				app_version: d.app_version,
				build_commit: d.build_commit ?? '',
				sdk_version: SDK_VERSION,
				os_name: d.os_name,
				os_version: d.os_version,
				model: d.model,
				locale: d.locale,
				tz_offset_min: -new Date().getTimezoneOffset(),
			},
			events,
		});
		let timer: ReturnType<typeof setTimeout> | undefined;
		try {
			const req = fetchFn(this.cfg.endpoint, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json', 'X-App-Key': this.cfg.appKey },
				body,
			});
			req.catch(() => undefined); // timeout thắng rồi req mới lỗi thì không thành unhandled rejection
			const timeout = new Promise<null>((resolve) => {
				timer = setTimeout(() => resolve(null), FETCH_TIMEOUT_MS);
			});
			const res = await Promise.race([req, timeout]);
			// 200 kể cả có rejected[] — server ĐÃ nhận, dòng hỏng gửi lại cũng hỏng y vậy
			return res !== null && res.ok;
		} catch {
			return false; // mạng đứt giữa chừng — replay vô hại nhờ event_id
		} finally {
			if (timer !== undefined) clearTimeout(timer);
		}
	}
}
