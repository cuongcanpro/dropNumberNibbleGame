import type { AttemptStore } from './attempt-counter';

/** In-memory AttemptStore for unit tests. */
export function createMemoryAttemptStore(): AttemptStore {
	const m = new Map<number, number>();
	return {
		get: (levelId) => m.get(levelId) ?? 0,
		set: (levelId, count) => {
			m.set(levelId, count);
		},
	};
}
