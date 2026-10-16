import type { StorageAdapter } from '../../tracking/types';
import type { AttemptStore } from './attempt-counter';

type AttemptMap = Record<string, number>;

// Storage mặc định = localStorage bọc try/catch (hỏng/thiếu → coi như rỗng, không ném).
function defaultStorage(): StorageAdapter {
	return {
		get: (k) => {
			try {
				return localStorage.getItem(k);
			} catch {
				return null;
			}
		},
		set: (k, v) => {
			try {
				localStorage.setItem(k, v);
			} catch {
				// quota/không có storage — mất đếm còn hơn crash
			}
		},
	};
}

/**
 * AttemptStore lưu localStorage, đếm số lượt thử theo từng màn. Mỗi game chỉ cần một key riêng.
 *
 * Ngữ nghĩa: đếm LƯỢT THỬ, không phải lượt vào màn. Game có resume giữa màn phải gọi
 * `attemptFor(level, { resumed: true })` để KHÔNG tăng đếm.
 * (Cocos dùng `LocalStorage.get/set` JSON; `storage` tham số thứ hai là chỗ inject cho test.)
 */
export function createLocalAttemptStore(
	storageKey: string,
	storage: StorageAdapter = defaultStorage(),
): AttemptStore {
	const load = (): AttemptMap => {
		try {
			const raw = storage.get(storageKey);
			const parsed = raw ? (JSON.parse(raw) as AttemptMap) : null;
			return parsed && typeof parsed === 'object' ? parsed : {};
		} catch {
			return {};
		}
	};
	return {
		get: (levelId) => {
			const n = load()[String(levelId)];
			return typeof n === 'number' && n > 0 ? n : 0;
		},
		set: (levelId, count) => {
			const next = load();
			next[String(levelId)] = count;
			storage.set(storageKey, JSON.stringify(next));
		},
	};
}
