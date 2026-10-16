/* oxlint-disable unicorn/consistent-function-scoping -- test port từ Cocos, giữ cấu trúc để đối chiếu */
import { describe, expect, it } from 'vitest';
import { EventQueue } from './event-queue';
import type { QueuedEvent } from './types';
import { QUEUE_CAP, STORAGE_KEY } from './types';

// Nạp sẵn 5000 event qua storage (restore) để khỏi trả giá O(n²) persist khi append từng cái.
describe('queue cap', () => {
	it('cap 5000, key nv_track_queue_v1, drop kèm sdk_queue_overflow {dropped}', () => {
		expect(QUEUE_CAP).toBe(5000);
		expect(STORAGE_KEY).toBe('nv_track_queue_v1');
		const evt = (n: number): QueuedEvent => ({
			event_id: `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`,
			ts: '2026-10-04T10:00:00.000Z',
			session_id: 's',
			seq_no: n,
			source: 'game',
			action: `e${n}`,
			network_state: 'wifi',
			payload: '{}',
		});
		const seed = JSON.stringify(Array.from({ length: QUEUE_CAP }, (_, i) => evt(i)));
		const q = new EventQueue({ get: () => seed, set: () => undefined });
		q.append(evt(QUEUE_CAP));
		expect(q.size()).toBe(QUEUE_CAP);
		const all = q.peekBatch(QUEUE_CAP);
		const marker = all.find((e) => e.action === 'sdk_queue_overflow')!;
		expect(JSON.parse(marker.payload)).toEqual({ dropped: 2 });
		expect(all[0]!.action).toBe('e2'); // 2 cũ nhất (e0,e1) nhường chỗ cho event mới + marker
	});
});
