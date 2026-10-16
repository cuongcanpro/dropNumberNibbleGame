/**
 * Hợp đồng giữa tracking SDK và host (game Nibi / web).
 * SDK KHÔNG import gì từ Nibi/Phaser/DOM — host inject storage, network state,
 * device info qua TrackConfig. Toàn bộ test được bằng vitest thuần.
 */
export interface StorageAdapter {
	get(key: string): string | null;
	set(key: string, value: string): void;
}

export interface DeviceInfo {
	device_id: string;
	platform: string;
	app_version: string;
	os_name: string;
	os_version: string;
	model: string;
	locale: string;
	/** Commit dựng ra bản build (short sha); rỗng nếu build không lấy được git.
	 *  Console lưu vào `game_version` — chỗ vốn chỉ sao chép `app_version`. */
	build_commit?: string | undefined;
}

export type NetworkState = 'offline' | 'wifi' | 'cellular';

export interface TrackConfig {
	endpoint: string; // https://<console>/public/events
	appKey: string; // X-App-Key (shared secret trong build)
	source: 'game' | 'portal';
	device: DeviceInfo;
	getNetworkState(): NetworkState;
	storage: StorageAdapter; // Nibi: localStorage bọc try/catch
	userId?: (() => string) | undefined; // rỗng/undefined = guest
	fetchFn?: typeof fetch | undefined; // inject để test
	now?: (() => number) | undefined; // inject để test
}

export interface EmitCtx {
	gameSlug?: string | undefined;
	levelId?: number | undefined;
	durationMs?: number | undefined;
	value?: number | undefined;
	/** Chế độ chơi (`classic`, `adventure`…). Bỏ trống = game một mode. */
	mode?: string | undefined;
	payload?: object | undefined; // SDK JSON.stringify — nhận mọi shape data của MetricSink
}

/** Event nằm trong queue — đúng shape contract POST /public/events (spec §3). */
export interface QueuedEvent {
	event_id: string;
	ts: string;
	session_id: string;
	seq_no: number;
	source: 'game' | 'portal';
	game_slug?: string | undefined;
	action: string;
	level_id?: number | undefined;
	duration_ms?: number | undefined;
	value?: number | undefined;
	network_state: NetworkState;
	payload: string;
	/** Console lưu cột riêng (không nhét payload): mode là chiều để GROUP BY bảng
	 *  xếp hạng, nhét vào JSON thì mọi truy vấn phải parse chuỗi và không index được. */
	mode?: string | undefined;
}

export const QUEUE_CAP = 5000;
export const BATCH_MAX = 500;
export const FLUSH_THRESHOLD = 50;
/**
 * Action đẩy NGAY, không chờ nhịp 60s.
 *
 * Chỉ THÀNH TÍCH — thứ lên bảng xếp hạng và người chơi soi từng con số.
 * Sự cố 09/09: level 10 chơi lúc 10:39 nhưng 21:59 mới lên server (người chơi đóng
 * app ngay sau ván), bảng xếp hạng chụp lúc 17h30 vì thế thiếu và bị báo là "mất
 * dữ liệu". Đo được độ trễ 11 giờ 20 phút.
 *
 * `FLUSH_THRESHOLD` không cứu được ca này: đo ~1 level/phút, mỗi level vài event ⇒
 * phải chơi liên tục 15-20 phút mới tích đủ 50, nên thực tế chỉ timer 60s hoạt động.
 *
 * CỐ Ý không có `game_score_heartbeat` / `portal_screen_view`: chúng bắn định kỳ,
 * đẩy từng cái là đốt pin và data của người chơi để đổi lấy độ trễ không ai nhìn.
 *
 * Tên phải KHỚP TỪNG CHỮ với `sink-bridge.ts` — nơi duy nhất đặt tên action. Bản đầu
 * có `game_over`, một tên KHÔNG tồn tại ở đó: Set không khớp gì, không lỗi, không log,
 * chỉ lặng lẽ vô dụng. Thêm tên mới thì grep `sink-bridge.ts` trước.
 */
export const FLUSH_NOW_ACTIONS: ReadonlySet<string> = new Set([
	'game_level_complete',
	'game_score_end',
]);
export const FLUSH_INTERVAL_MS = 60_000;
export const BACKOFF_BASE_MS = 1_000;
export const BACKOFF_CAP_MS = 300_000;
export const SESSION_GAP_MS = 30 * 60_000;
export const STORAGE_KEY = 'nv_track_queue_v1';
// Trạng thái SDK lúc boot (bật/tắt + vì sao) — để chẩn đoán khi không có stdout.
// KHÔNG chứa appKey.
export const TRACK_STATUS_KEY = 'nv_track_status_v1';
/**
 * Gửi kèm mọi event (`sdk_version`). Lịch sử: 1.0.0 = tracking gốc; 1.1.0 = đọc kit-config v1 của
 * Console (Server/Console coi sdk_version >= 1.1.0 là "hỗ trợ kit-config"). Tăng khi hợp đồng đổi.
 */
export const SDK_VERSION = '1.1.0';
