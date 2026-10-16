import { afterEach, describe, expect, it } from 'vitest';
import { resolveDevRank, setDevRankOverride } from './dev-rank-override';

afterEach(() => setDevRankOverride(undefined));

describe('dev rank override', () => {
	it('mặc định không override (đi mạng)', () => {
		expect(resolveDevRank({ score: 10 })).toBeUndefined();
	});

	it('đối tượng một phần được điền đủ theo điểm', () => {
		setDevRankOverride({ rank: 7, totalPlayers: 1200 });
		expect(resolveDevRank({ score: 55 })).toMatchObject({
			rank: 7,
			totalPlayers: 1200,
			beaten: 1193,
			score: 55,
			board: 'score',
			period: 'alltime',
		});
	});

	it('null ép không có hạng, hàm tính theo input, undefined gỡ', () => {
		setDevRankOverride(null);
		expect(resolveDevRank({ score: 1 })).toBeNull();
		setDevRankOverride((i) => ({ rank: i.score }) as never);
		expect(resolveDevRank({ score: 9 })).toMatchObject({ rank: 9 });
		setDevRankOverride(undefined);
		expect(resolveDevRank({ score: 1 })).toBeUndefined();
	});

	it('bản phát hành (DEV tắt, không cờ) bỏ qua override', () => {
		const env = import.meta.env as { DEV: boolean };
		const was = env.DEV;
		env.DEV = false;
		try {
			expect(setDevRankOverride({ rank: 1 })).toBe(false);
			expect(resolveDevRank({ score: 1 })).toBeUndefined();
		} finally {
			env.DEV = was;
		}
	});
});
