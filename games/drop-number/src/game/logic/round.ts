/**
 * Rules live in `logic/`: plain TypeScript with no Phaser, DOM, nibi or kit imports, so Vitest runs it
 * under Node. Replace this placeholder round with your game's rules, test first.
 */
export interface RoundState {
	readonly score: number;
	readonly over: boolean;
	readonly revived: boolean;
}

export function newRound(): RoundState {
	return { score: 0, over: false, revived: false };
}

/** Negative points and points after the round is lost are ignored. */
export function addPoints(state: RoundState, points: number): RoundState {
	if (state.over || points <= 0) return state;
	return { ...state, score: state.score + points };
}

export function loseRound(state: RoundState): RoundState {
	return state.over ? state : { ...state, over: true };
}

/** One second chance per round, granted by the shake-for-reward gate. */
export function canRevive(state: RoundState): boolean {
	return state.over && !state.revived;
}

export function revive(state: RoundState): RoundState {
	return canRevive(state) ? { ...state, over: false, revived: true } : state;
}
