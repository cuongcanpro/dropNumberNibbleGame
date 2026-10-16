import { beforeEach, describe, expect, it } from 'vitest';
import { PROFILE_STORAGE_KEY } from '../config/game-config';
import { DEFAULT_PROFILE, ProfileStore } from './profile-store';

describe('ProfileStore', () => {
	beforeEach(() => localStorage.clear());

	it('trả mặc định khi chưa có save', () => {
		expect(new ProfileStore().load()).toEqual(DEFAULT_PROFILE);
	});

	it('lưu rồi đọc lại đúng', () => {
		const store = new ProfileStore();
		store.save({ bestScore: 12, gamesPlayed: 3, bestTile: 256 });
		expect(store.load()).toEqual({ bestScore: 12, gamesPlayed: 3, bestTile: 256 });
	});

	it('save cũ chưa có bestTile thì bestTile = 0', () => {
		localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify({ bestScore: 5, gamesPlayed: 1 }));
		expect(new ProfileStore().load()).toEqual({ bestScore: 5, gamesPlayed: 1, bestTile: 0 });
	});

	it('validate save cũ/hỏng, field sai về mặc định', () => {
		localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify({ bestScore: -4, gamesPlayed: 'x' }));
		expect(new ProfileStore().load()).toEqual(DEFAULT_PROFILE);
		localStorage.setItem(PROFILE_STORAGE_KEY, '{not json');
		expect(new ProfileStore().load()).toEqual(DEFAULT_PROFILE);
	});
});
