import { Logger } from './logger';

export type BackKeyHandler = () => boolean;

/** Phaser GameObject thoả cấu trúc này; entry bị prune khi owner đã bị huỷ/rời scene. */
export interface BackKeyOwner {
	active: boolean;
	scene?: unknown;
}

interface StackEntry {
	handler: BackKeyHandler;
	owner?: BackKeyOwner | undefined;
}

const log = new Logger('BackKeyManager');
// Escape/Backspace trên desktop; `GoBack` là key của nút back phần cứng Android trên một số webview.
const BACK_KEYS = new Set(['Escape', 'Backspace', 'GoBack', 'BrowserBack']);

/**
 * Stack handler duyệt từ trên xuống; handler trả `true` = nuốt sự kiện. Rỗng/không ai nuốt → fallback.
 * Không dùng history/popstate: nguồn phím là `keydown` + UI gọi `dispatch()` trực tiếp.
 */
export class BackKeyManager {
	private static instance: BackKeyManager | null = null;
	private stack: StackEntry[] = [];
	private fallback: BackKeyHandler | null = null;

	static getInstance(): BackKeyManager {
		if (!BackKeyManager.instance) BackKeyManager.instance = new BackKeyManager();
		return BackKeyManager.instance;
	}

	private constructor() {
		const target = globalThis as {
			addEventListener?: (
				type: string,
				cb: (e: { key?: string; target?: unknown; repeat?: boolean }) => void,
			) => void;
		};
		if (typeof target.addEventListener !== 'function') return;
		target.addEventListener('keydown', (e) => {
			// Giữ phím sinh keydown lặp: bỏ qua, kẻo ExitConfirm mở rồi tự Cancel ngay.
			if (e.repeat === true || !e.key || !BACK_KEYS.has(e.key)) return;
			// Backspace trong ô nhập chữ là xoá ký tự, không phải "back".
			const tag = (e.target as { tagName?: string } | undefined)?.tagName;
			if (e.key === 'Backspace' && (tag === 'INPUT' || tag === 'TEXTAREA')) return;
			this.dispatch();
		});
	}

	push(handler: BackKeyHandler, owner?: BackKeyOwner): void {
		this.remove(handler); // chống push trùng
		this.stack.push({ handler, owner });
	}

	remove(handler: BackKeyHandler): void {
		this.stack = this.stack.filter((entry) => entry.handler !== handler);
	}

	setFallback(handler: BackKeyHandler | null): void {
		this.fallback = handler;
	}

	clear(): void {
		this.stack = [];
		this.fallback = null;
	}

	/** Trả `true` nếu có handler (hoặc fallback) nuốt. UI back button gọi hàm này. */
	dispatch(): boolean {
		for (let i = this.stack.length - 1; i >= 0; i--) {
			const entry = this.stack[i];
			if (entry.owner && (!entry.owner.active || !entry.owner.scene)) {
				this.stack.splice(i, 1);
				continue;
			}
			if (this.invoke(entry.handler)) return true;
		}
		return this.fallback ? this.invoke(this.fallback) : false;
	}

	private invoke(fn: BackKeyHandler): boolean {
		try {
			return fn() === true;
		} catch (e) {
			log.error('handler threw', e);
			return false;
		}
	}
}
