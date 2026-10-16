import { describe, expect, test } from 'vitest';
import { AttemptCounter } from './attempt-counter';
import { createMemoryAttemptStore } from './memory-attempt-store';

describe('AttemptCounter', () => {
	test('fresh start from empty returns 1', () => {
		const c = new AttemptCounter(createMemoryAttemptStore());
		expect(c.attemptFor(3)).toBe(1);
	});

	test('retry of the same level increments', () => {
		const c = new AttemptCounter(createMemoryAttemptStore());
		expect(c.attemptFor(3)).toBe(1);
		expect(c.attemptFor(3)).toBe(2);
		expect(c.attemptFor(3)).toBe(3);
	});

	test('different levels count independently', () => {
		const c = new AttemptCounter(createMemoryAttemptStore());
		c.attemptFor(3);
		c.attemptFor(3);
		expect(c.attemptFor(7)).toBe(1);
		expect(c.attemptFor(3)).toBe(3);
	});

	test('resume holds the attempt without bumping', () => {
		const c = new AttemptCounter(createMemoryAttemptStore());
		c.attemptFor(3); // 1
		c.attemptFor(3); // 2
		expect(c.attemptFor(3, { resumed: true })).toBe(2);
		expect(c.attemptFor(3, { resumed: true })).toBe(2);
	});

	test('resume with no prior record returns 1', () => {
		const c = new AttemptCounter(createMemoryAttemptStore());
		expect(c.attemptFor(9, { resumed: true })).toBe(1);
	});
});
