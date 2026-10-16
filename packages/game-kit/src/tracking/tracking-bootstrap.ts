import type { IdentityProvider } from './device-identity';
import { getOrCreateDeviceId, guestIdentity } from './device-identity';
import { detectPlatform, parseUserAgent } from './device-info';
import { emitSessionStart } from './game-session';
import { flushNow, initTracking, trackingReady } from './track';
import type { TrackingHost } from './tracking-host';
import { endpointForEnv, resolveTrackingTarget } from './tracking-target';
import type { NetworkState } from './types';
import { TRACK_STATUS_KEY } from './types';

export interface TrackingBootOptions {
	/** `__NB_CONSOLE_ENV__` — rỗng = SDK tắt. */
	env: string;
	/** `__NB_CONSOLE_EVENTS_KEY__`. */
	appKey: string;
	/** `__NB_COMMIT__`. */
	commit: string;
	appVersion: string;
	host: TrackingHost;
	identity?: IdentityProvider | undefined;
	/** Bỏ trống = suy từ userAgent. */
	platform?: string | undefined;
	fetchFn?: typeof fetch | undefined;
	now?: (() => number) | undefined;
}

let booted = false;

/** Ngữ cảnh gửi diag, nhớ từ lúc boot để module khác (hồ sơ tải — ui/load-profile.ts) gửi được. */
let diagCtx: { o: TrackingBootOptions; deviceId: string } | undefined;

/**
 * Báo về Console (`/public/client-diag`) bằng fetch TRẦN, không qua SDK/queue: đây là thứ trả lời
 * "SDK có bật không, vướng ở đâu" — dùng chính SDK để báo SDK hỏng thì im lặng là đương nhiên
 * (sự cố 05/09 bên Cocos). Không chặn boot, không ném. Chưa khai env/key → chưa biết bắn đi đâu.
 */
function postDiag(
	o: TrackingBootOptions,
	deviceId: string,
	payload: Record<string, unknown>,
): void {
	try {
		const events = endpointForEnv(o.env);
		const fetchFn = o.fetchFn ?? (typeof fetch === 'function' ? fetch : undefined);
		if (!events || !o.appKey || !fetchFn) return;
		void fetchFn(events.replace(/\/events$/, '/client-diag'), {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', 'x-app-key': o.appKey },
			body: JSON.stringify({
				deviceId,
				appVersion: o.appVersion,
				env: o.env,
				payload: { ...payload, network: o.host.isOnline() ? 'wifi' : 'offline' },
			}),
		}).catch(() => undefined);
	} catch {
		// chẩn đoán hỏng thì thôi
	}
}

function reportDiag(
	o: TrackingBootOptions,
	deviceId: string,
	status: Record<string, unknown>,
): void {
	postDiag(o, deviceId, { tracking: status });
}

/**
 * Diag dạng nhật ký (`payload.kind`, vd `load_profile`): Server chỉ in log, không đè ảnh chụp boot.
 * Chưa boot tracking (env/key trống) ⇒ bỏ.
 */
export function sendClientDiag(payload: Record<string, unknown>): void {
	if (diagCtx !== undefined) postDiag(diagCtx.o, diagCtx.deviceId, payload);
}

/**
 * Bật SDK. Fail-closed: thiếu env/key (hoặc env `live`/lạ) → không init, 0 event vào queue,
 * ghi lý do vào `nv_track_status_v1` + log. KHÔNG bao giờ ném. Idempotent (gọi lại là no-op).
 */
export function bootTracking(o: TrackingBootOptions): boolean {
	if (booted) return trackingReady().ready;
	const { host } = o;
	const deviceId = getOrCreateDeviceId(host.storage);
	diagCtx = { o, deviceId };
	const status = (v: Record<string, unknown>): void => {
		const line = `[tracking] ${JSON.stringify(v)}`;
		if (v['on']) console.log(line);
		// `off` là tắt có chủ ý (sim, bản sandbox trên Launcher), không phải cấu hình sai: không báo lỗi.
		else if (v['env'] === 'off') console.log(`${line} — NB_CONSOLE_ENV=off, tracking tắt`);
		else console.error(`${line} — SDK KHÔNG bật, sẽ không có event nào`);
		reportDiag(o, deviceId, v);
		try {
			host.storage.set(TRACK_STATUS_KEY, JSON.stringify({ ...v, at: new Date().toISOString() }));
		} catch {
			// quan sát hỏng thì thôi, không được làm hỏng game
		}
	};
	const target = resolveTrackingTarget(o.env, o.appKey);
	if (!target) {
		status({ on: false, env: o.env || '<không khai báo>', key: o.appKey ? 'có' : 'rỗng' });
		return false;
	}
	const identity = o.identity ?? guestIdentity;
	const ua = safe(() => host.userAgent());
	const info = parseUserAgent(ua);
	try {
		initTracking({
			endpoint: target.endpoint,
			appKey: target.appKey,
			source: 'game',
			device: {
				// GETTER, đọc lúc gửi batch (flush-loop): launcher trả lời danh tính SAU boot, mọi
				// batch từ lúc đó — kể cả event đã xếp hàng trước — mang device của launcher.
				get device_id() {
					return safe(() => identity.deviceId?.() ?? '') || deviceId;
				},
				platform: o.platform ?? detectPlatform(ua),
				app_version: o.appVersion,
				os_name: info.os_name,
				os_version: info.os_version,
				model: info.model,
				locale: safe(() => host.language()) || 'en',
				build_commit: o.commit,
			},
			getNetworkState: (): NetworkState => {
				try {
					return host.isOnline() ? 'wifi' : 'offline';
				} catch {
					return 'wifi'; // fail-open: thà thử gửi rồi backoff còn hơn câm
				}
			},
			storage: host.storage,
			userId: () => safe(() => identity.userId()),
			fetchFn: o.fetchFn,
			now: o.now,
		});
	} catch (e) {
		status({ on: false, env: o.env, reason: `initTracking lỗi: ${String(e)}` });
		return false;
	}
	// initTracking nuốt lỗi bên trong: hỏi thẳng trạng thái thật thay vì đoán.
	const st = trackingReady();
	if (!st.ready) {
		status({ on: false, env: o.env, reason: st.error ?? 'queue chưa sẵn sàng' });
		return false;
	}
	booted = true;
	host.onHide(() => void flushNow()); // đóng tab/ẩn app: cơ hội cuối xả queue
	host.onOnline(() => void flushNow());
	emitSessionStart();
	const after = trackingReady();
	status({
		on: true,
		env: o.env,
		endpoint: target.endpoint,
		queued: after.queued,
		emitError: after.emitError,
	});
	// mở app CÓ mạng = xả queue của các phiên offline trước. Chờ launcher trao danh tính (có
	// trần): trả lời phải đi một vòng native↔RN, mà batch đầu chứa session_start và event
	// offline (có thể có điểm) — gửi sớm là đi với device riêng của game và user_id rỗng.
	void waitForIdentity(identity).then(() => flushNow());
	return true;
}

/** Trần chờ danh tính lúc boot: không có launcher (web) thì chỉ trễ batch đầu chừng này. */
export const IDENTITY_WAIT_MS = 1500;

function waitForIdentity(identity: IdentityProvider): Promise<void> {
	if (!identity.ready) return Promise.resolve();
	return Promise.race([
		identity.ready,
		new Promise<void>((resolve) => setTimeout(resolve, IDENTITY_WAIT_MS)),
	]).catch(() => undefined);
}

function safe(fn: () => string): string {
	try {
		return fn() || '';
	} catch {
		return '';
	}
}

/** Chỉ dùng trong test. */
export function resetBootForTest(): void {
	booted = false;
	diagCtx = undefined;
}
