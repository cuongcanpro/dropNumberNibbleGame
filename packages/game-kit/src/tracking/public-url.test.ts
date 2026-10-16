import { describe, expect, it } from 'vitest';
import { publicUrl } from './public-url';

describe('publicUrl', () => {
	it('/public/events → /public/<path>', () => {
		expect(publicUrl('https://x.dev/public/events', 'feedback')).toBe(
			'https://x.dev/public/feedback',
		);
		expect(publicUrl('https://x.dev/public/events/', 'leaderboard/rank')).toBe(
			'https://x.dev/public/leaderboard/rank',
		);
	});
	it('không khớp dạng /events ⇒ null', () => {
		expect(publicUrl('https://x.dev/other', 'feedback')).toBeNull();
	});
});
