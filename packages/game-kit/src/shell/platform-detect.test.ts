import { describe, expect, it } from 'vitest';
import { detectPlatform } from './platform-detect';

const ANDROID = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36';
const IOS = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X)';

describe('detectPlatform', () => {
	it('mode nibi + UA ⇒ nibi-android / nibi-ios', () => {
		expect(detectPlatform('nibi', ANDROID)).toBe('nibi-android');
		expect(detectPlatform('nibi', IOS)).toBe('nibi-ios');
	});
	it('mode nibi nhưng UA lạ ⇒ nibi-android (không gán web)', () => {
		expect(detectPlatform('nibi', '')).toBe('nibi-android');
	});
	it('mode khác ⇒ web, kể cả UA mobile', () => {
		expect(detectPlatform('production', ANDROID)).toBe('web');
		expect(detectPlatform('development', IOS)).toBe('web');
	});
});
