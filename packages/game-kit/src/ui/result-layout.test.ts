import { describe, expect, it } from 'vitest';
import { rankBlockModel } from './rank-block-model';
import { formatScore, formatTime, resolveResultView } from './result-layout';

describe('resolveResultView', () => {
	it('game over thường: chip, title gameover, không halo', () => {
		const v = resolveResultView({ score: 1234, bestScore: 5000 });
		expect(v).toMatchObject({
			title: 'gameover',
			info: 'chip',
			score: '1,234',
			best: '5,000',
			halo: false,
		});
	});
	it('new best: big "Best Score" + halo', () => {
		const v = resolveResultView({ score: 99, isNewBest: true });
		expect(v).toMatchObject({
			title: 'win',
			info: 'big',
			bigLabel: 'Best Score',
			bigNumber: '99',
			halo: true,
		});
	});
	it('level clear thắng, level failed giữ title gameover', () => {
		expect(resolveResultView({ clearedLevel: 4 })).toMatchObject({
			title: 'win',
			bigLabel: 'Level',
			bigNumber: '4',
		});
		expect(resolveResultView({ failedLevel: 4 })).toMatchObject({
			title: 'gameover',
			info: 'big',
			bigNumber: '4',
			halo: false,
		});
	});
	it('metric level: nhãn Your Level / Best Level, không ribbon', () => {
		const v = resolveResultView({ score: 9, bestScore: 12, metric: 'level' });
		expect(v).toMatchObject({ info: 'chip', yourLabel: 'Your Level', bestLine: 'Best Level: 12' });
		expect(resolveResultView({ score: 13, isNewBest: true, metric: 'level' }).bigLabel).toBe(
			'Best Level',
		);
	});
	it('best chỉ là dòng trơn khi không phải new best', () => {
		const v = resolveResultView({ score: 1, bestScore: 5, isNewBest: false });
		expect(v).toMatchObject({ yourLabel: 'Your Score', bestLine: 'Best: 5', halo: false });
	});
	it('thiếu số liệu = 0', () => {
		expect(resolveResultView({}).score).toBe('0');
	});
});

describe('metric time', () => {
	it('win: nhãn Time + mm:ss + dòng Best', () => {
		const v = resolveResultView({ score: 72, bestScore: 58, isNewBest: true, metric: 'time' });
		expect(v).toMatchObject({
			info: 'big',
			bigLabel: 'Time',
			bigNumber: '01:12',
			extraLine: 'Best : 00:58',
		});
	});
	it('clearedLevel + time: vẫn hiện thời gian, không đổi sang Level', () => {
		const v = resolveResultView({ clearedLevel: 3, score: 72, metric: 'time' });
		expect(v).toMatchObject({ bigLabel: 'Time', bigNumber: '01:12', title: 'win' });
	});
	it('thua (chip): Your Time + Best : mm:ss, không extraLine', () => {
		const v = resolveResultView({ score: 100, bestScore: 58, metric: 'time' });
		expect(v).toMatchObject({
			info: 'chip',
			yourLabel: 'Your Time',
			score: '01:40',
			bestLine: 'Best : 00:58',
			extraLine: null,
		});
	});
	it('failedLevel thắng metric time (vẫn là Level)', () => {
		expect(resolveResultView({ failedLevel: 2, metric: 'time' })).toMatchObject({
			bigLabel: 'Level',
			bigNumber: '2',
		});
	});
	it('extraLine game truyền thắng mặc định; metric khác không có', () => {
		expect(resolveResultView({ score: 1, metric: 'time', extraLine: 'Time: 1:42' }).extraLine).toBe(
			'Time: 1:42',
		);
		expect(resolveResultView({ score: 1, isNewBest: true }).extraLine).toBeNull();
	});
});

describe('formatTime', () => {
	it('mm:ss, giờ, rác về 0', () => {
		expect(formatTime(72)).toBe('01:12');
		expect(formatTime(3725)).toBe('1:02:05');
		expect(formatTime(-5)).toBe('00:00');
		expect(formatTime(Number.NaN)).toBe('00:00');
		expect(formatTime(59.9)).toBe('00:59');
	});
});

describe('formatScore', () => {
	it('kẹp trên 9,999,999', () => {
		expect(formatScore(9_999_999)).toBe('9,999,999');
		expect(formatScore(10_000_000)).toBe('9,999,999+');
	});
});

describe('rankBlockModel', () => {
	it('null/undefined ⇒ ẩn', () => {
		expect(rankBlockModel(null).visible).toBe(false);
		expect(rankBlockModel(undefined).visible).toBe(false);
	});
	it('hạng thật ⇒ badge + beaten; 0 người ⇒ beaten rỗng', () => {
		expect(rankBlockModel({ rank: 50, topPercent: 12, beaten: 3 } as never)).toEqual({
			visible: true,
			badge: 'TOP 12%',
			beaten: 'Beat 3 players',
		});
		expect(rankBlockModel({ rank: 5, topPercent: 12, beaten: 0 } as never)).toMatchObject({
			badge: '#5',
			beaten: '',
		});
	});
});
