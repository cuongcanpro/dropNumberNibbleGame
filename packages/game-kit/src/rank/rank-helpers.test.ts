import { describe, expect, it } from 'vitest';
import type { RankView } from './rank-client';
import {
	beatenLabel,
	betterThanPercent,
	preferRank,
	RANK_PREFERRED_TOP,
	rankBadge,
	TOP_PERCENT_FLOOR,
} from './rank-helpers';

const v = (rank: number, topPercent: number): RankView => ({
	board: 'score',
	period: 'alltime',
	gameSlug: 'g',
	metric: 'score',
	score: 1,
	rank,
	totalPlayers: 5000,
	beaten: 0,
	topPercent,
	computedAt: '',
});

describe('preferRank', () => {
	it('đỉnh bảng ⇒ hạng', () => {
		expect(preferRank(v(1, TOP_PERCENT_FLOOR))).toBe(true);
		expect(preferRank(v(7, TOP_PERCENT_FLOOR))).toBe(true);
		expect(preferRank(v(RANK_PREFERRED_TOP, 0.4))).toBe(true);
	});
	it('giữa bảng ⇒ phần trăm', () => {
		expect(preferRank(v(976, 20))).toBe(false);
		expect(preferRank(v(RANK_PREFERRED_TOP + 1, 0.9))).toBe(false);
	});
	it('ngoài top nhưng chạm sàn % ⇒ hạng', () => {
		expect(preferRank(v(300, TOP_PERCENT_FLOOR))).toBe(true);
	});
});

describe('rankBadge / betterThanPercent / beatenLabel', () => {
	it('badge', () => {
		expect(rankBadge(v(1, 0.1))).toBe('#1');
		expect(rankBadge(v(976, 20))).toBe('TOP 20%');
	});
	it('betterThanPercent làm tròn 1 chữ số, không bao giờ 100', () => {
		expect(betterThanPercent(v(1, 0.1))).toBe(99.9);
		expect(betterThanPercent(v(976, 20))).toBe(80);
		expect(betterThanPercent(v(5, 0.35))).toBe(99.7);
	});
	it('beatenLabel', () => {
		expect(beatenLabel(0)).toBe('');
		expect(beatenLabel(4953)).toBe('Beat 4,953 players');
		expect(beatenLabel(1193, 'en')).toBe('Beat 1,193 players');
	});
	it('beatenLabel tiếng Việt: dấu chấm hàng nghìn, không phụ thuộc ICU', () => {
		expect(beatenLabel(0, 'vi')).toBe('');
		expect(beatenLabel(7, 'vi')).toBe('Hơn 7 người chơi');
		expect(beatenLabel(1193, 'vi')).toBe('Hơn 1.193 người chơi');
		expect(beatenLabel(1234567, 'vi')).toBe('Hơn 1.234.567 người chơi');
	});
});
