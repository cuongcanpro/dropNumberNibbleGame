import { describe, expect, it } from 'vitest';
import { EventQueue } from './event-queue';
import type { QueuedEvent, StorageAdapter } from './types';

function fakeStorage(): StorageAdapter {
	const m = new Map<string, string>();
	return { get: (k) => m.get(k) ?? null, set: (k, v) => void m.set(k, v) };
}
const evt = (id: string): QueuedEvent => ({
	event_id: id,
	ts: '2026-08-26T10:00:00.000Z',
	session_id: 's1',
	seq_no: 1,
	source: 'game',
	game_slug: 'pilot',
	action: id,
	network_state: 'offline',
	payload: '{}',
});

describe('EventQueue', () => {
	it('persist gộp theo microtask — restore từ storage sống qua kill app', async () => {
		const store = fakeStorage();
		let writes = 0;
		const counting: StorageAdapter = {
			get: store.get,
			set: (k, v) => {
				writes++;
				store.set(k, v);
			},
		};
		const q1 = new EventQueue(counting);
		q1.append(evt('a'));
		q1.append(evt('b'));
		expect(writes).toBe(0); // chưa ghi trong cùng tick (lệch có ý vs Cocos, review H2)
		await Promise.resolve(); // microtask
		expect(writes).toBe(1); // 2 append → 1 lần ghi
		const q2 = new EventQueue(store); // "app restart"
		expect(q2.size()).toBe(2);
	});

	it('persistNow ghi ngay khi còn bẩn, không ghi lại khi sạch', () => {
		const store = fakeStorage();
		let writes = 0;
		const q = new EventQueue({
			get: store.get,
			set: (k, v) => {
				writes++;
				store.set(k, v);
			},
		});
		q.append(evt('a'));
		q.persistNow();
		expect(writes).toBe(1);
		q.persistNow();
		expect(writes).toBe(1);
		expect(new EventQueue(store).size()).toBe(1);
	});

	it('peekBatch không xoá — removeByIds xoá đúng event đã gửi', () => {
		const q = new EventQueue(fakeStorage());
		q.append(evt('a'));
		q.append(evt('b'));
		const batch = q.peekBatch(500);
		expect(batch).toHaveLength(2);
		expect(q.size()).toBe(2); // peek không xoá
		q.removeByIds(batch.map((e) => e.event_id));
		expect(q.size()).toBe(0);
	});

	it('storage hỏng → degrade RAM-only, KHÔNG throw', () => {
		const broken: StorageAdapter = {
			get: () => {
				throw new Error('quota');
			},
			set: () => {
				throw new Error('quota');
			},
		};
		const q = new EventQueue(broken);
		expect(() => q.append(evt('a'))).not.toThrow();
		expect(q.size()).toBe(1);
	});
});
