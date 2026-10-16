import { host } from 'nibi';
import { parseUserAgent } from '../tracking/device-info';
import { Vibration } from './vibration';

/**
 * Tính năng thiết bị do Launcher (portal) cung cấp qua kênh `host` — thay cho PlatformWrapper
 * của cocos (haptic thật trên iOS, clipboard, share, thông tin máy, pin, thông báo…). Safe area thì
 * dùng `safeAreaInsets` của nibi (`safe-area.ts`), không qua đây.
 * Phía Launcher: `src/services/platform-bridge.ts` trong repo portal — đổi cả hai cùng lúc.
 *
 *   game → launcher  { type: 'nv.platform.hello' }
 *   launcher → game  { type: 'nv.platform.hello.v1', version, methods }   (Launcher cũng gửi lúc `ready`)
 *   game → launcher  { type: 'nv.platform.call', id, method, args }
 *   launcher → game  { type: 'nv.platform.result', id, ok: true, value }
 *                    { type: 'nv.platform.result', id, ok: false, error: { code, message } }
 *
 * Ngoài Launcher (web, `nibi sim`, portal bản cũ) không ai trả lời: sau `helloTimeoutMs` mọi
 * helper rơi về API web hoặc giá trị "không biết", không bao giờ ném.
 */
export const PLATFORM_HELLO_REQUEST = 'nv.platform.hello';
export const PLATFORM_HELLO = 'nv.platform.hello.v1';
export const PLATFORM_CALL = 'nv.platform.call';
export const PLATFORM_RESULT = 'nv.platform.result';

export type HostPlatformErrorCode =
	| 'BAD_ARGS'
	| 'BUSY'
	| 'FAILED'
	| 'TIMEOUT'
	| 'UNKNOWN_METHOD'
	| 'UNSUPPORTED';

export class HostPlatformError extends Error {
	readonly code: HostPlatformErrorCode;

	constructor(code: HostPlatformErrorCode, message: string) {
		super(message);
		this.code = code;
		this.name = 'HostPlatformError';
	}
}

type HostListener = (event: { readonly data: unknown; readonly type: 'message' }) => void;

/** Dạng MessagePort của `host` (nibi); test truyền bản giả. */
export interface HostPort {
	postMessage(data: unknown): void;
	addEventListener(type: 'message', listener: HostListener): void;
	removeEventListener(type: 'message', listener: HostListener): void;
}

export interface HostDeviceInfo {
	readonly appVersion: string;
	readonly buildNumber: string;
	/** Storefront App Store, alpha-2; '' khi không biết. */
	readonly country: string;
	readonly language: string;
	readonly model: string;
	readonly osName: string;
	readonly osVersion: string;
	readonly packageName: string;
	/** Tổng RAM (MB), -1 khi không biết. */
	readonly totalMemoryMb: number;
}

export interface HostBattery {
	readonly charging: boolean;
	/** 0–100, -1 khi không biết. */
	readonly level: number;
}

export interface HostDiskSpace {
	readonly availableMb: number;
	readonly totalMb: number;
}

/** getConnectionStatus của cocos: 0 mất mạng, 1 di động (hoặc khác), 2 Wi-Fi. */
export type HostConnection = 0 | 1 | 2;

export interface HostPlatformOptions {
	readonly callTimeoutMs?: number;
	readonly helloTimeoutMs?: number;
	/** share/email/review: người chơi có thể để sheet mở lâu. */
	readonly sheetTimeoutMs?: number;
}

type Pending = {
	readonly reject: (error: HostPlatformError) => void;
	readonly resolve: (value: unknown) => void;
	readonly timer: ReturnType<typeof setTimeout>;
};

export function createHostPlatform(port: HostPort, options: HostPlatformOptions = {}) {
	const helloTimeoutMs = options.helloTimeoutMs ?? 1_500;
	const callTimeoutMs = options.callTimeoutMs ?? 10_000;
	const sheetTimeoutMs = options.sheetTimeoutMs ?? 5 * 60_000;
	/** `undefined` = chưa biết Launcher có những hàm nào. */
	let methods: ReadonlySet<string> | undefined;
	let unsupported = false;
	let helloWait: Promise<void> | undefined;
	let resolveHello: (() => void) | undefined;
	let nextId = 0;
	const pending = new Map<string, Pending>();

	port.addEventListener('message', ({ data }) => {
		if (!isRecord(data)) return;
		if (data.type === PLATFORM_HELLO && Array.isArray(data.methods)) {
			// Hello đến muộn (sau timeout) vẫn nhận: các lần gọi sau dùng được Launcher.
			methods = new Set(data.methods.filter((m): m is string => typeof m === 'string'));
			unsupported = false;
			resolveHello?.();
			return;
		}
		if (data.type !== PLATFORM_RESULT || typeof data.id !== 'string') return;
		const entry = pending.get(data.id);
		if (entry === undefined) return;
		pending.delete(data.id);
		clearTimeout(entry.timer);
		if (data.ok === true) {
			entry.resolve(data.value);
			return;
		}
		const error = isRecord(data.error) ? data.error : {};
		entry.reject(
			new HostPlatformError(
				errorCode(error.code),
				typeof error.message === 'string' ? error.message : 'launcher error',
			),
		);
	});

	const ensureHello = (): Promise<void> => {
		if (methods !== undefined || unsupported) return Promise.resolve();
		helloWait ??= new Promise<void>((resolve) => {
			const timer = setTimeout(() => {
				if (methods === undefined) unsupported = true;
				resolve();
			}, helloTimeoutMs);
			resolveHello = () => {
				clearTimeout(timer);
				resolve();
			};
			post({ type: PLATFORM_HELLO_REQUEST });
		});
		return helloWait;
	};

	const post = (message: unknown): boolean => {
		try {
			port.postMessage(message);
			return true;
		} catch {
			return false;
		}
	};

	const send = (method: string, args: Record<string, unknown>, timeoutMs: number) =>
		new Promise<unknown>((resolve, reject) => {
			nextId += 1;
			const id = `p${nextId}`;
			const timer = setTimeout(() => {
				pending.delete(id);
				reject(new HostPlatformError('TIMEOUT', `${method}: no answer from the launcher`));
			}, timeoutMs);
			pending.set(id, { reject, resolve, timer });
			if (!post({ args, id, method, type: PLATFORM_CALL })) {
				pending.delete(id);
				clearTimeout(timer);
				reject(new HostPlatformError('UNSUPPORTED', 'no host channel'));
			}
		});

	const dispatch = (method: string, args: Record<string, unknown>, timeoutMs: number) =>
		methods?.has(method) === true
			? send(method, args, timeoutMs)
			: Promise.reject(new HostPlatformError('UNSUPPORTED', `launcher has no ${method}`));

	/** Gửi ngay khi đã biết Launcher (để kết quả không bị lỡ), không thì đợi hello trước. */
	const call = <T>(
		method: string,
		args: Record<string, unknown> = {},
		timeoutMs = callTimeoutMs,
	): Promise<T> =>
		(methods !== undefined || unsupported
			? dispatch(method, args, timeoutMs)
			: ensureHello().then(() => dispatch(method, args, timeoutMs))) as Promise<T>;

	return {
		call,

		/** Không gửi gì: chỉ cho biết Launcher đã báo có `method` chưa. */
		supportsNow(method: string): boolean {
			return methods?.has(method) === true;
		},

		/**
		 * Haptic đồng bộ cho Vibration: `true` nếu đã giao cho Launcher; `false` thì caller tự rung
		 * kiểu web. Lần đầu (chưa biết Launcher) cũng hỏi hello luôn để các lần sau dùng được.
		 */
		hapticNow(type: number): boolean {
			if (methods === undefined && !unsupported) {
				void ensureHello();
				return false;
			}
			if (methods?.has('haptic') !== true) return false;
			send('haptic', { type }, callTimeoutMs).catch(() => undefined);
			return true;
		},

		deviceInfo: () => orElse(call<HostDeviceInfo>('deviceInfo'), webDeviceInfo),
		battery: () => orElse(call<HostBattery>('battery'), () => ({ charging: false, level: -1 })),
		diskSpace: () =>
			orElse(call<HostDiskSpace>('diskSpace'), () => ({ availableMb: -1, totalMb: -1 })),
		connection: () => orElse(call<HostConnection>('connection'), webConnection),
		language: () => orElse(call<string>('language'), webLanguage),
		country: () => orElse(call<string>('country'), () => ''),

		copyToClipboard: (text: string) =>
			orElse(call<boolean>('copyToClipboard', { text }), () => webCopy(text)),
		share: (input: { readonly message: string; readonly title?: string }) =>
			orElse(call<boolean>('share', { ...input }, sheetTimeoutMs), () => webShare(input)),
		requestReview: () => orElse(call<boolean>('requestReview', {}, sheetTimeoutMs), () => false),
		openAppSettings: () =>
			orElse(
				call<null>('openAppSettings', {}, sheetTimeoutMs).then(() => undefined),
				() => undefined,
			),
		sendEmail: (input: {
			readonly body?: string;
			readonly subject?: string;
			readonly to: string;
		}) => orElse(call<boolean>('sendEmail', { ...input }, sheetTimeoutMs), () => false),
		openCustomerService: (input: { readonly accountId: string; readonly content: string }) =>
			orElse(call<boolean>('openCustomerService', { ...input }, sheetTimeoutMs), () => false),

		/** Thông báo local sau `at` (epoch ms, tối đa 30 ngày). `false` khi chưa được phép thông báo. */
		scheduleNotification: (input: { readonly at: number; readonly body: string }) =>
			orElse(call<boolean>('scheduleNotification', { ...input }), () => false),
		/** Huỷ các thông báo game này đã hẹn; trả số đã huỷ. */
		cancelNotifications: () => orElse(call<number>('cancelNotifications'), () => 0),
	};
}

export type HostPlatform = ReturnType<typeof createHostPlatform>;

const NO_HOST: HostPort = {
	addEventListener() {},
	postMessage() {},
	removeEventListener() {},
};

/**
 * `host` có thể thiếu hoặc không nghe được (nibi cũ, mock test chỉ có `primaryCanvas` hay chỉ
 * `postMessage`): không nhận được kết quả thì coi như ngoài Launcher.
 */
function nibiHost(): HostPort {
	try {
		const candidate = host as Partial<HostPort> | undefined;
		return typeof candidate?.addEventListener === 'function' &&
			typeof candidate.postMessage === 'function'
			? (candidate as HostPort)
			: NO_HOST;
	} catch {
		return NO_HOST;
	}
}

/** Một kênh cho cả game: Launcher gửi hello lúc `ready`, nên tạo sớm để không lỡ. */
export const hostPlatform: HostPlatform = createHostPlatform(nibiHost());

// Rung qua Launcher (iOS không có navigator.vibrate) cho mọi game dùng Vibration.
Vibration.setHapticHost((type) => hostPlatform.hapticNow(type));

/** Launcher không trả lời / không có hàm / báo lỗi → giá trị web hoặc "không biết", không ném. */
async function orElse<T>(promise: Promise<T>, fallback: () => T | Promise<T>): Promise<T> {
	try {
		return await promise;
	} catch {
		return fallback();
	}
}

function errorCode(value: unknown): HostPlatformErrorCode {
	switch (value) {
		case 'BAD_ARGS':
		case 'BUSY':
		case 'UNKNOWN_METHOD':
			return value;
		default:
			return 'FAILED';
	}
}

type WebNavigator = {
	readonly clipboard?: { writeText?: (text: string) => Promise<void> };
	readonly language?: string;
	readonly onLine?: boolean;
	readonly share?: (data: { text?: string; title?: string }) => Promise<void>;
	readonly userAgent?: string;
};

function webNavigator(): WebNavigator | undefined {
	return (globalThis as { navigator?: WebNavigator }).navigator;
}

function webLanguage(): string {
	return (webNavigator()?.language ?? '').split('-')[0] || 'en';
}

function webConnection(): HostConnection {
	return webNavigator()?.onLine === false ? 0 : 1;
}

function webDeviceInfo(): HostDeviceInfo {
	const ua = parseUserAgent(webNavigator()?.userAgent ?? '');
	return {
		appVersion: '',
		buildNumber: '',
		country: '',
		language: webLanguage(),
		model: ua.model,
		osName: ua.os_name,
		osVersion: ua.os_version,
		packageName: '',
		totalMemoryMb: -1,
	};
}

async function webCopy(text: string): Promise<boolean> {
	try {
		const writeText = webNavigator()?.clipboard?.writeText;
		if (writeText === undefined) return false;
		await writeText.call(webNavigator()?.clipboard, text);
		return true;
	} catch {
		return false;
	}
}

async function webShare(input: { readonly message: string; readonly title?: string }) {
	try {
		const share = webNavigator()?.share;
		if (share === undefined) return false;
		await share.call(webNavigator(), {
			text: input.message,
			...(input.title === undefined ? {} : { title: input.title }),
		});
		return true;
	} catch {
		return false;
	}
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}
