/**
 * Node 22+ có sẵn `localStorage` toàn cục nhưng không dùng được khi thiếu `--localstorage-file`,
 * nên test chạy trên một Storage trong bộ nhớ. Nguồn duy nhất — game import lại, không chép.
 */
export class MemoryStorage implements Storage {
	private readonly items = new Map<string, string>();
	get length(): number {
		return this.items.size;
	}
	clear(): void {
		this.items.clear();
	}
	getItem(key: string): string | null {
		return this.items.get(key) ?? null;
	}
	key(index: number): string | null {
		return [...this.items.keys()][index] ?? null;
	}
	removeItem(key: string): void {
		this.items.delete(key);
	}
	setItem(key: string, value: string): void {
		this.items.set(key, String(value));
	}
}

export function installMemoryStorage(): MemoryStorage {
	const storage = new MemoryStorage();
	Object.defineProperty(globalThis, 'localStorage', {
		value: storage,
		configurable: true,
		writable: true,
	});
	return storage;
}
