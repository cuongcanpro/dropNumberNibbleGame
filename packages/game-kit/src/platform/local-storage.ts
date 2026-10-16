/**
 * Port của Cocos `core/storage/LocalStorage`: JSON vào/ra, hỗ trợ TTL.
 * Native có thể thiếu/ném khi đụng `localStorage` → bọc try/catch, hỏng thì rơi về map RAM.
 */

const CACHE_TIMES_KEY = 'LocalStorage_this.cacheTimes';

function backing(): Storage | null {
	try {
		return typeof localStorage !== 'undefined' ? localStorage : null;
	} catch {
		return null;
	}
}

const memory = new Map<string, string>();

function readRaw(key: string): string | null {
	try {
		const value = backing()?.getItem(key);
		if (value != null) return value;
	} catch {
		// rơi xuống RAM
	}
	return memory.get(key) ?? null;
}

function writeRaw(key: string, value: string): void {
	try {
		const store = backing();
		if (store) {
			store.setItem(key, value);
			memory.delete(key);
			return;
		}
	} catch {
		// rơi xuống RAM
	}
	memory.set(key, value);
}

function isInvalid(value: string | null): boolean {
	return value == null || value === '' || value === 'undefined' || value === 'null';
}

let cacheTimes: Record<string, number> = {};

export const LocalStorage = {
	/** Gọi một lần lúc boot: xoá các key TTL đã hết hạn. */
	init(): void {
		cacheTimes = LocalStorage.get<Record<string, number>>(CACHE_TIMES_KEY, {});
		const now = Date.now();
		let changed = false;
		for (const key of Object.keys(cacheTimes)) {
			if (cacheTimes[key] < now) {
				LocalStorage.remove(key);
				delete cacheTimes[key];
				changed = true;
			}
		}
		if (changed) LocalStorage.set(CACHE_TIMES_KEY, cacheTimes);
	},

	get<T>(key: string, defaultValue?: T): T {
		const raw = readRaw(key);
		if (isInvalid(raw)) return defaultValue as T;
		try {
			return JSON.parse(raw as string) as T;
		} catch {
			return defaultValue as T;
		}
	},

	set<T>(key: string, value: T, ttlSeconds?: number): void {
		writeRaw(key, JSON.stringify(value));
		if (ttlSeconds) {
			cacheTimes[key] = Date.now() + ttlSeconds * 1000;
			writeRaw(CACHE_TIMES_KEY, JSON.stringify(cacheTimes));
		}
	},

	remove(key: string): void {
		try {
			backing()?.removeItem(key);
		} catch {
			// bỏ qua
		}
		memory.delete(key);
	},

	clear(): void {
		try {
			backing()?.clear();
		} catch {
			// bỏ qua
		}
		memory.clear();
		cacheTimes = {};
	},
};
