import type { QueuedEvent, StorageAdapter } from './types';
import { QUEUE_CAP, STORAGE_KEY } from './types';
import { uuidV4 } from './uuid';

/**
 * Hàng đợi bền (sống qua kill app). Lệch có ý so với Cocos (Anh chốt 04/10, review H2):
 * Cocos serialize cả queue NGAY mỗi append → ~4.5ms/append ở 5000 event trên Node,
 * ước 15-50ms trên Hermes + localStorage đồng bộ = giật khung khi offline lâu.
 * Ở đây persist được GỘP theo microtask: nhiều append trong cùng tick chỉ ghi 1 lần,
 * vẫn trước macrotask kế tiếp nên cửa sổ mất dữ liệu chỉ là crash ngay trong tick đó.
 * Storage hỏng → degrade RAM-only, không throw (không bao giờ làm phiền gameplay).
 */
export class EventQueue {
	private events: QueuedEvent[] = [];
	private readonly storage: StorageAdapter;
	private dirty = false;

	// Không dùng parameter property: erasableSyntaxOnly (Hermes/strip-types) cấm.
	constructor(storage: StorageAdapter) {
		this.storage = storage;
		try {
			const raw = this.storage.get(STORAGE_KEY);
			if (raw) this.events = JSON.parse(raw) as QueuedEvent[];
		} catch {
			this.events = [];
		}
	}

	append(evt: QueuedEvent): void {
		this.events.push(evt);
		if (this.events.length > QUEUE_CAP) {
			// drop cũ nhất đủ chỗ cho event mới + 1 marker — marker đo được mình mất bao nhiêu
			const dropped = this.events.length - QUEUE_CAP + 1;
			this.events.splice(0, dropped);
			this.events.push({
				...evt,
				event_id: uuidV4(),
				action: 'sdk_queue_overflow',
				payload: JSON.stringify({ dropped }),
			});
		}
		this.persist();
	}

	size(): number {
		return this.events.length;
	}

	/** Trả bản sao — KHÔNG xoá. Xoá chỉ sau khi server 200 (removeByIds). */
	peekBatch(max: number): QueuedEvent[] {
		return this.events.slice(0, max);
	}

	removeByIds(ids: string[]): void {
		const gone = new Set(ids);
		this.events = this.events.filter((e) => !gone.has(e.event_id));
		this.persist();
	}

	/** Đánh dấu bẩn và hẹn ghi ở microtask kế tiếp; gọi nhiều lần trong 1 tick chỉ ghi 1 lần. */
	private persist(): void {
		if (this.dirty) return;
		this.dirty = true;
		scheduleMicrotask(() => this.persistNow());
	}

	/** Ghi ngay nếu còn bẩn. Public để đường thoát game (exit sequence) ép ghi trước khi `exit()`. */
	persistNow(): void {
		if (!this.dirty) return;
		this.dirty = false;
		try {
			this.storage.set(STORAGE_KEY, JSON.stringify(this.events));
		} catch {
			// quota/hỏng storage — chấp nhận RAM-only, event mất khi kill app còn hơn crash game
		}
	}
}

/** Hermes chưa đo có `queueMicrotask`; Promise.then là microtask tương đương. */
function scheduleMicrotask(fn: () => void): void {
	if (typeof queueMicrotask === 'function') queueMicrotask(fn);
	else void Promise.resolve().then(fn);
}
