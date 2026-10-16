/**
 * Ba env của NB_CONSOLE (service name theo convention: NB_CONSOLE · tên đầy đủ
 * "Nibble Verse Console"). Chọn bằng hằng BUILD-TIME `__NB_CONSOLE_ENV__` — KHÔNG
 * dùng ConfigService.isDev() vì res/config.json load async, isDev() lúc boot luôn
 * trả false (comment trong config.ts tự thừa nhận "default to production").
 *
 * Fail-closed: thiếu endpoint HOẶC thiếu key → null → SDK không init, không đọng
 * queue. Env lạ (kể cả 'prod', 'staging') cũng null — KHÔNG đoán hộ.
 * Key dev/live KHÔNG hardcode (secret) — inject lúc build qua NB_CONSOLE_EVENTS_KEY.
 */
export type NbConsoleEnv = 'local' | 'dev' | 'live';

export interface TrackingTarget {
	endpoint: string;
	appKey: string;
}

const LOCAL_KEY = 'local-events-key'; // chỉ chạy localhost — không phải secret

const ENDPOINTS: Record<NbConsoleEnv, string> = {
	local: 'http://localhost:3000/public/events',
	// app PUBLIC của dev (SURFACES=public,player) — nơi duy nhất nhận /public/*.
	// Tên cũ 'staging' + domain nibble-console-api-staging đã NXDOMAIN từ 09/26;
	// build nào khai NB_CONSOLE_ENV=staging từ đó tới nay đều bắn vào hư không.
	dev: 'https://nibble-api.zingplay.dev/public/events',
	// app PUBLIC của live. MỞ 18/09/2026 — trước đó để rỗng là ĐÚNG vì chưa có
	// deployment live. Live lên thật từ 11/09 nhưng dòng này không ai sửa, nên bản
	// live câm suốt một tuần: SDK không init, không event, không queue, KHÔNG LỖI.
	// Câm-không-lỗi là lớp hỏng đắt nhất ở đây — đừng trả nó về '' nữa.
	// Deployment tự khai khoá nó chờ: GET /public/events/key-fingerprint → 7a25a609.
	live: 'https://nibble-api.zingplay.com/public/events',
};

/**
 * Hằng build-time → tên env. KHÔNG đoán hộ: build nào không khai báo
 * `NB_CONSOLE_ENV` thì trả chuỗi rỗng ⇒ resolveTrackingTarget cho null ⇒ SDK nằm im.
 *
 * Trước đây chỗ này mặc định 'local' và đó là lỗi thật: bản CDN dựng bởi CI
 * (CI không set biến) mang endpoint `http://localhost:3000` ra máy người chơi,
 * nên event sinh ra rồi kẹt vĩnh viễn trong queue offline. Mặc định phải là
 * KHÔNG BẮN, muốn bắn thì nói rõ: NB_CONSOLE_ENV=local (về máy) hoặc =dev (về Console dev,
 * kèm NB_CONSOLE_EVENTS_KEY = EVENTS_APP_KEY của app public dev).
 */
export function envFromBuild(raw: unknown): string {
	return typeof raw === 'string' ? raw : '';
}

export function resolveTrackingTarget(
	env: NbConsoleEnv | string,
	buildKey: string,
): TrackingTarget | null {
	const endpoint = ENDPOINTS[env as NbConsoleEnv];
	if (!endpoint) return null; // live hoặc env lạ
	const appKey = env === 'local' ? LOCAL_KEY : buildKey;
	if (!appKey) return null; // dev/live chưa có key ⇒ nằm im
	return { endpoint, appKey };
}

/**
 * Endpoint theo env, KHÔNG kèm điều kiện key — dùng cho chẩn đoán.
 *
 * `resolveTrackingTarget` cố ý trả null khi thiếu key (fail-closed cho việc GỬI
 * EVENT). Nhưng chẩn đoán phải gửi được ĐÚNG LÚC ĐÓ, vì "thiếu key" chính là thứ
 * cần báo. Hai mục đích khác nhau nên tách hàm, không nới lỏng hàm kia.
 */
export function endpointForEnv(env: NbConsoleEnv | string): string {
	return ENDPOINTS[env as NbConsoleEnv] ?? '';
}
