/* oxlint-disable eslint/no-underscore-dangle -- tên define do Vite quy ước, không đổi được */
// File DUY NHẤT của tracking chạm DOM/navigator/localStorage/nibi (ngoại lệ có tên trong purity.test.ts).
import { host as nibiHost } from 'nibi';
import type { IdentityProvider } from './device-identity';
import { createHostIdentity, type HostChannel } from './host-identity';
import { bootTracking } from './tracking-bootstrap';
import type { TrackingHost } from './tracking-host';
import type { StorageAdapter } from './types';

// Hằng build-time do `consoleDefine` (@repo/game-kit/vite) bake; typeof guard vì thiếu define
// (vitest, game quên cấu hình) là ReferenceError chứ không phải undefined.
declare const __NB_CONSOLE_ENV__: string | undefined;
declare const __NB_CONSOLE_EVENTS_KEY__: string | undefined;
declare const __NB_COMMIT__: string | undefined;

function localStorageAdapter(): StorageAdapter {
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
				// quota/không có storage → RAM-only
			}
		},
	};
}

function listen(target: unknown, type: string, cb: () => void): void {
	try {
		const t = target as { addEventListener?: (t: string, c: () => void) => void } | undefined;
		t?.addEventListener?.(type, cb);
	} catch {
		// engine lạ — bỏ qua
	}
}

/**
 * Native chưa đo `visibilitychange`/`pagehide`/`online` (docs/nibi-native-api-compat.md) →
 * listener thiếu thì bỏ qua; shell còn flush ở exit, thành tích flush ngay, timer 60s.
 */
export function createDomHost(): TrackingHost {
	return {
		storage: localStorageAdapter(),
		// Chỉ coi mất mạng khi navigator nói RÕ false (thiếu onLine ≠ offline).
		isOnline: () => !(typeof navigator !== 'undefined' && navigator.onLine === false),
		userAgent: () => (typeof navigator !== 'undefined' ? navigator.userAgent || '' : ''),
		language: () => (typeof navigator !== 'undefined' ? navigator.language || '' : ''),
		onHide: (cb) => {
			if (typeof document !== 'undefined') {
				listen(document, 'visibilitychange', () => {
					if (document.visibilityState === 'hidden') cb();
				});
			}
			if (typeof window !== 'undefined') listen(window, 'pagehide', cb);
		},
		onOnline: (cb) => {
			if (typeof window !== 'undefined') listen(window, 'online', cb);
		},
	};
}

/** Kênh `host` của Nibi (MessagePort JSON tới launcher). Web/simulator: no-op, không ai trả lời. */
export function nibiHostChannel(): HostChannel {
	return {
		// oxlint-disable-next-line unicorn/require-post-message-target-origin -- host Nibi là MessagePort tới launcher, không có origin
		post: (data) => nibiHost.postMessage(data),
		onMessage: (cb) => nibiHost.addEventListener('message', (e) => cb(e.data)),
	};
}

export interface GameKitTrackingOptions {
	appVersion: string;
	identity?: IdentityProvider | undefined;
	/** `nibi-android` | `nibi-ios` | `web`; bỏ trống = suy từ userAgent. */
	platform?: string | undefined;
	/** Chỉ để test/ghi đè; mặc định DOM host. */
	host?: TrackingHost | undefined;
}

/** Gọi một lần khi boot game. Trả true nếu SDK bật. Không bao giờ ném. */
export function initGameKitTracking(opts: GameKitTrackingOptions): boolean {
	try {
		const env = typeof __NB_CONSOLE_ENV__ === 'string' ? __NB_CONSOLE_ENV__ : '';
		const host = opts.host ?? createDomHost();
		return bootTracking({
			env,
			appKey: typeof __NB_CONSOLE_EVENTS_KEY__ === 'string' ? __NB_CONSOLE_EVENTS_KEY__ : '',
			commit: typeof __NB_COMMIT__ === 'string' ? __NB_COMMIT__ : '',
			appVersion: opts.appVersion,
			host,
			// Mặc định hỏi launcher (portal Nibi) — một người chơi một device trên mọi game.
			identity:
				opts.identity ?? createHostIdentity(nibiHostChannel(), { storage: host.storage, env }),
			platform: opts.platform,
		});
	} catch {
		return false;
	}
}
