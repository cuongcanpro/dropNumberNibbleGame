import { describe, expect, it } from 'vitest';
import { getOrCreateDeviceId } from './device-identity';
import { detectPlatform, parseUserAgent } from './device-info';
import {
	getGameMode,
	getGameSlug,
	normalizeMode,
	resetGameContextForTest,
	setGameMode,
	setGameSlug,
} from './game-context';

describe('parseUserAgent / detectPlatform', () => {
	it('Android, iOS, macOS web, UA lạ/rỗng không ném', () => {
		expect(parseUserAgent('Mozilla/5.0 (Linux; Android 14; Pixel 7) Chrome/1')).toEqual({
			os_name: 'Android',
			os_version: '14',
			model: 'Pixel 7',
		});
		expect(parseUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X)')).toEqual({
			os_name: 'iOS',
			os_version: '17.2',
			model: 'iPhone',
		});
		expect(parseUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)').os_name).toBe('macOS');
		expect(parseUserAgent('').os_name).toBe('unknown');
		expect(detectPlatform('Mozilla/5.0 (Linux; Android 14; K)')).toBe('nibi-android');
		expect(detectPlatform('Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X)')).toBe(
			'nibi-ios',
		);
		expect(detectPlatform('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)')).toBe('web');
		expect(detectPlatform('')).toBe('web');
	});
});

describe('getOrCreateDeviceId', () => {
	it('storage hỏng vẫn trả id hợp lệ', () => {
		const broken = {
			get: () => {
				throw new Error('x');
			},
			set: () => {
				throw new Error('x');
			},
		};
		expect(getOrCreateDeviceId(broken)).toMatch(/^[0-9a-f-]{36}$/);
	});
});

describe('game-context', () => {
	it('mode: trim + lowercase + cắt 32; rỗng → undefined', () => {
		resetGameContextForTest();
		expect(normalizeMode(' Adventure ')).toBe('adventure');
		expect(normalizeMode('   ')).toBeUndefined();
		expect(normalizeMode('x'.repeat(40))).toHaveLength(32);
		setGameSlug('onet');
		setGameMode('Classic');
		expect([getGameSlug(), getGameMode()]).toEqual(['onet', 'classic']);
		setGameMode(undefined);
		expect(getGameMode()).toBeUndefined();
		resetGameContextForTest();
	});
});
