import { PROFILE_STORAGE_KEY } from '../config/game-config';

export interface Profile {
	readonly bestScore: number;
	readonly gamesPlayed: number;
	/** Highest block ever made. */
	readonly bestTile: number;
}

export const DEFAULT_PROFILE: Profile = { bestScore: 0, gamesPlayed: 0, bestTile: 0 };

function nonNegativeInt(value: unknown, fallback: number): number {
	return typeof value === 'number' && Number.isFinite(value) && value >= 0
		? Math.floor(value)
		: fallback;
}

/**
 * Save là dữ liệu không tin được (bản cũ, sửa tay, storage hỏng): validate từng field, field sai thì
 * rơi về mặc định thay vì ném — người chơi không bao giờ bị kẹt vì save lỗi.
 */
export class ProfileStore {
	load(): Profile {
		try {
			const raw = localStorage.getItem(PROFILE_STORAGE_KEY);
			if (!raw) return DEFAULT_PROFILE;
			const saved = JSON.parse(raw) as Partial<Record<keyof Profile, unknown>> | null;
			return {
				bestScore: nonNegativeInt(saved?.bestScore, DEFAULT_PROFILE.bestScore),
				gamesPlayed: nonNegativeInt(saved?.gamesPlayed, DEFAULT_PROFILE.gamesPlayed),
				bestTile: nonNegativeInt(saved?.bestTile, DEFAULT_PROFILE.bestTile),
			};
		} catch {
			return DEFAULT_PROFILE;
		}
	}

	save(profile: Profile): void {
		try {
			localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profile));
		} catch {
			// Storage là tuỳ chọn ở simulator/private mode.
		}
	}
}
