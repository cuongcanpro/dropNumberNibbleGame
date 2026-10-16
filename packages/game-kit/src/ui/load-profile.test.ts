import { describe, expect, it, vi } from 'vitest';
import type { FileTiming } from './load-profile';

vi.mock('nibi', () => ({ host: { postMessage: vi.fn<(d: unknown) => void>() } }));

const { summarizeLoad } = await import('./load-profile');

const f = (p: Partial<FileTiming>): FileTiming => ({
	key: 'k',
	type: 'image',
	bytes: 1000,
	startAt: 0,
	loadAt: 10,
	completeAt: 20,
	...p,
});

describe('summarizeLoad — tách chờ lượt / đọc / giải mã cho từng loại file', () => {
	it('cộng theo loại và chỉ ra file chậm nhất', () => {
		const s = summarizeLoad(
			[
				f({ key: 'a', type: 'image', startAt: 0, loadAt: 100, completeAt: 150 }),
				f({ key: 'b', type: 'audio', bytes: 5000, startAt: 0, loadAt: 50, completeAt: 2050 }),
				f({ key: 'c', type: 'json', startAt: 200, loadAt: 210, completeAt: 211 }),
			],
			{ loaderStartAt: 0, completeAt: 2100, maxParallel: 32 },
		);
		expect(s.files).toBe(3);
		expect(s.totalMs).toBe(2100);
		expect(s.byType['audio']).toMatchObject({ n: 1, bytes: 5000, readMs: 50, decodeMs: 2000 });
		expect(s.byType['image']).toMatchObject({ n: 1, readMs: 100, decodeMs: 50 });
		expect(s.slowest[0]).toMatchObject({ key: 'b', decode: 2000 });
		expect(s.lastStartAt).toBe(200);
		expect(s.lastLoadAt).toBe(210);
		expect(s.lastCompleteAt).toBe(2050);
	});

	it('đếm số file đọc song song cao nhất (biết loader có chạy tuần tự không)', () => {
		const s = summarizeLoad(
			[
				f({ key: 'a', startAt: 0, loadAt: 100 }),
				f({ key: 'b', startAt: 10, loadAt: 90 }),
				f({ key: 'c', startAt: 100, loadAt: 200 }),
			],
			{ loaderStartAt: 0, completeAt: 300, maxParallel: 32 },
		);
		expect(s.peakParallelReads).toBe(2);
		// đọc xong lúc 90, 100, 200 ⇒ khoảng cách 10, 100 ⇒ trung vị (phần tử giữa) 100
		expect(s.medianLoadGapMs).toBe(100);
	});

	it('file lỗi / thiếu mốc ⇒ không làm hỏng tổng', () => {
		const s = summarizeLoad([f({ loadAt: undefined, completeAt: undefined, failed: true })], {
			loaderStartAt: 0,
			completeAt: 5,
			maxParallel: 6,
		});
		expect(s.failed).toBe(1);
		expect(s.byType['image']).toMatchObject({ n: 1, readMs: 0, decodeMs: 0 });
	});
});
