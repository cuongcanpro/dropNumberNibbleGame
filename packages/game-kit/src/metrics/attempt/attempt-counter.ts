/** Persists per-level attempt counts. Injected so each game keeps its own
 *  storage location/shape; the counter owns only the spec §3.3 rule. */
export interface AttemptStore {
	/** Current count for levelId, 0 if this level was never started. */
	get(levelId: number): number;
	/** Persist the new count for levelId. */
	set(levelId: number, count: number): void;
}

/** Owns spec §3.3 (attempt_number): a fresh start (first play or retry)
 *  increments; a resume holds the attempt; counts are per-level. */
export class AttemptCounter {
	private readonly store: AttemptStore;

	constructor(store: AttemptStore) {
		this.store = store;
	}

	/** Attempt number to report on level/score start.
	 *  resumed=false (default): fresh start — bump, persist, return.
	 *  resumed=true: continuing an in-progress run — hold, never bump. */
	attemptFor(levelId: number, opts: { resumed?: boolean } = {}): number {
		if (opts.resumed) return Math.max(1, this.store.get(levelId));
		const next = this.store.get(levelId) + 1;
		this.store.set(levelId, next);
		return next;
	}
}
