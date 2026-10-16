import { describe, expect, it } from 'vitest';
import { REWARD_GAP, REWARD_OFFSET_Y, stackReward } from './shake-ui-reward-layout';

describe('stackReward', () => {
	it('không có thưởng: câu chúc nằm giữa thẻ (dịch xuống REWARD_OFFSET_Y)', () => {
		expect(stackReward({ textHeight: 150 })).toEqual({ textY: REWARD_OFFSET_Y });
	});

	it('có thưởng: cả cụm chữ + icon + nhãn căn giữa quanh REWARD_OFFSET_Y', () => {
		const t = 150;
		const icon = 96;
		const label = 50;
		const s = stackReward({ textHeight: t, iconHeight: icon, labelHeight: label });
		const top = (s.textY ?? 0) - t / 2;
		const bottom = (s.labelY ?? 0) + label;
		expect(top - REWARD_OFFSET_Y).toBeCloseTo(-(bottom - REWARD_OFFSET_Y));
		expect((s.iconY ?? 0) - icon / 2 - ((s.textY ?? 0) + t / 2)).toBeCloseTo(REWARD_GAP.textToIcon);
		expect((s.labelY ?? 0) - ((s.iconY ?? 0) + icon / 2)).toBeCloseTo(REWARD_GAP.iconToLabel);
	});

	it('câu ngắn không dính mép trên: chữ dịch xuống so với câu dài', () => {
		const short = stackReward({ textHeight: 50, iconHeight: 96, labelHeight: 50 });
		const long = stackReward({ textHeight: 200, iconHeight: 96, labelHeight: 50 });
		expect(short.textY - 25).toBeGreaterThan(long.textY - 100);
	});
});
