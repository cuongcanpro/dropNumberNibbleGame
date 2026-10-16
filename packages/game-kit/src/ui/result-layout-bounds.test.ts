import { describe, expect, it } from 'vitest';
import { getLayoutBounds, setLayoutBounds } from './result-layout-bounds';

describe('layout bounds tường minh', () => {
	it('đặt và đọc lại, trả chính vật', () => {
		const part = {};
		expect(getLayoutBounds(part)).toBeUndefined();
		expect(setLayoutBounds(part, -40, 120)).toBe(part);
		expect(getLayoutBounds(part)).toEqual({ top: -40, bottom: 120 });
	});
});
