import { type KitConfig, parseKitConfig } from '../shell/kit-config';
import { hudButtons } from '../shell/kit-config-rules';
import { readKitConfig, setKitConfig } from '../shell/kit-config-store';
import { getGameSlug } from '../tracking/game-context';
import { publicUrl } from '../tracking/public-url';
import { trackingConfig } from '../tracking/track';
import { consoleBases, defaultStorage, withTimeout } from './loading-card';

/**
 * Lấy kit-config từ Console lúc boot (song song với thẻ loading), lưu `localStorage`
 * `gk.kit.config.<slug>.<lang>`. Phiên này dùng bản cache đọc lúc boot (hoặc bản tươi nếu tới trước
 * khi popup đầu tiên mở); đổi ở Console hiện ở lần mở game kế tiếp. KHÔNG BAO GIỜ chặn boot: mọi lỗi
 * (offline, bị chặn, timeout, JSON rác) = giữ cache / mặc định của kit.
 */
interface KeyValueStore {
	getItem(key: string): string | null;
	setItem(key: string, value: string): void;
}

export interface KitConfigDeps {
	readonly slug?: string;
	readonly lang?: 'vi' | 'en';
	readonly fetchFn?: typeof fetch;
	readonly storage?: KeyValueStore | null;
	/** Base URL Console theo thứ tự ưu tiên (mặc định: env của bản build trước). */
	readonly bases?: readonly string[];
	readonly timeoutMs?: number;
}

const TIMEOUT_MS = 6000;
export const kitConfigKey = (slug: string, lang: string): string =>
	`gk.kit.config.${slug.toLowerCase()}.${lang}`;

/** `vi` nếu ngôn ngữ máy bắt đầu bằng "vi", còn lại `en`. */
export function deviceLang(locale?: string): 'vi' | 'en' {
	const l =
		locale ??
		trackingConfig()?.device.locale ??
		(typeof navigator === 'undefined' ? '' : navigator.language);
	return String(l).toLowerCase().startsWith('vi') ? 'vi' : 'en';
}

function defaultBases(): string[] {
	const endpoint = trackingConfig()?.endpoint;
	const url = endpoint ? publicUrl(endpoint, 'games') : null;
	return consoleBases(url).map(([base]) => base);
}

export function readCachedKitConfig(
	slug: string,
	lang: string,
	store: KeyValueStore | null = defaultStorage(),
): KitConfig | null {
	try {
		const raw = store?.getItem(kitConfigKey(slug, lang));
		return raw ? parseKitConfig(JSON.parse(raw)) : null;
	} catch {
		return null;
	}
}

async function fetchOne(
	base: string,
	slug: string,
	lang: string,
	fetchFn: typeof fetch,
	timeoutMs: number,
): Promise<unknown | null> {
	try {
		const qs = `gameKey=${encodeURIComponent(slug)}&lang=${lang}`;
		const res = await withTimeout(fetchFn(`${base}/public/kit-config?${qs}`), timeoutMs);
		if (!res.ok) return null;
		const body: unknown = await res.json();
		return body && typeof body === 'object' && 'parts' in body ? body : null;
	} catch {
		return null; // mạng lỗi / timeout / JSON rác
	}
}

/**
 * Tải bản mới nhất (mọi Console song song, env build ưu tiên) và lưu cache cho lần mở sau. Trả bản
 * đã parse, hoặc null khi không lấy được (cache cũ giữ nguyên).
 */
export async function refreshKitConfig(deps: KitConfigDeps = {}): Promise<KitConfig | null> {
	const slug = deps.slug ?? getGameSlug();
	if (!slug) return null;
	const lang = deps.lang ?? deviceLang();
	const fetchFn = deps.fetchFn ?? globalThis.fetch;
	const store = deps.storage === undefined ? defaultStorage() : deps.storage;
	const bases = deps.bases ?? defaultBases();
	const bodies = await Promise.all(
		bases.map((b) => fetchOne(b, slug, lang, fetchFn, deps.timeoutMs ?? TIMEOUT_MS)),
	);
	const body = bodies.find((b) => b !== null);
	if (!body) return null;
	try {
		store?.setItem(kitConfigKey(slug, lang), JSON.stringify(body));
	} catch {
		/* đầy quota: lần sau tải lại */
	}
	return parseKitConfig(body);
}

let started = false;

/**
 * Boot idempotent: nạp cache vào store NGAY (đồng bộ) rồi tải bản tươi không chờ. Chưa có slug ⇒ không
 * làm gì (lần gọi sau mới tính).
 */
export function startKitConfig(deps: KitConfigDeps = {}): Promise<KitConfig | null> {
	const slug = deps.slug ?? getGameSlug();
	if (started || !slug) return Promise.resolve(null);
	started = true;
	const lang = deps.lang ?? deviceLang();
	const store = deps.storage === undefined ? defaultStorage() : deps.storage;
	const cached = readCachedKitConfig(slug, lang, store);
	if (cached) setKitConfig(cached);
	return refreshKitConfig({ ...deps, slug, lang, storage: store }).then((fresh) => {
		if (fresh) setKitConfig(fresh, { fresh: true });
		return fresh;
	});
}

/**
 * Cấu hình hiệu lực, ĐỒNG BỘ — mọi chỗ trong kit đọc qua đây. Lần đầu tự khởi động nếu game chưa
 * có màn loading của kit; chưa có gì ⇒ mặc định của kit (= hành vi cũ).
 */
export function kitConfig(): KitConfig {
	if (!started) void startKitConfig();
	return readKitConfig();
}

export function resetKitConfigClientForTest(): void {
	started = false;
}

/** Nút HUD game nên vẽ: `const { home, setting } = kitHud();` (vắng config = cả hai hiện). */
export function kitHud(): { home: boolean; setting: boolean } {
	return hudButtons(kitConfig());
}
