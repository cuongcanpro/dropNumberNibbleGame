import { describe, expect, it } from 'vitest';
import { addPoints, canRevive, loseRound, newRound, revive } from './round';

describe('round', () => {
	it('starts at zero, open and not yet revived', () => {
		expect(newRound()).toEqual({ score: 0, over: false, revived: false });
	});

	it('adds points while the round is open', () => {
		expect(addPoints(addPoints(newRound(), 3), 2).score).toBe(5);
	});

	it('ignores negative points', () => {
		expect(addPoints(newRound(), -4).score).toBe(0);
	});

	it('freezes the score once the round is lost', () => {
		const lost = loseRound(addPoints(newRound(), 7));
		expect(addPoints(lost, 5)).toEqual({ score: 7, over: true, revived: false });
	});

	it('offers one revive per round, keeping the score', () => {
		const lost = loseRound(addPoints(newRound(), 7));
		expect(canRevive(newRound())).toBe(false);
		expect(canRevive(lost)).toBe(true);
		const revived = revive(lost);
		expect(revived).toEqual({ score: 7, over: false, revived: true });
		expect(canRevive(loseRound(revived))).toBe(false);
		expect(revive(loseRound(revived)).over).toBe(true);
	});
});
