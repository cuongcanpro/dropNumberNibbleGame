/**
 * Phần THUẦN của thẻ game (không localStorage, không tracking): kiểu, parse, gộp, và lấy từ Console.
 * Dùng chung giữa runtime (`loading-card.ts`) và bước build (`vite/listing-snapshot.ts`) để luật
 * gộp tên/mẹo/màu chỉ có MỘT bản.
 */

/**
 * Chữ + màu màn loading của game trên listing Console (Server `public-catalog`): `displayName`,
 * `description`, `loadingTips` theo listing (market + locale), `loadingBgColor` một màu cho cả game.
 * Game không phải khai gì; không có ảnh (logo Nibble Verse đóng gói trong kit).
 */
export interface GameCard {
	readonly name: string;
	readonly description: string;
	readonly tips?: readonly string[];
	/** `#RRGGBB`; null/thiếu thì nền đen. */
	readonly bgColor?: string | null;
}

/** `#RRGGBB` → số; sai dạng → null. Nằm ở đây (không import tương đối) vì chuỗi build Node cũng dùng. */
export function parseHexColor(value: unknown): number | null {
	return typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value)
		? Number.parseInt(value.slice(1), 16)
		: null;
}

export interface ConsoleGame {
	readonly appName?: string;
	readonly displayName?: string;
	readonly description?: string;
	readonly loadingTips?: unknown;
	readonly loadingBgColor?: unknown;
}

export type ConsoleBase = readonly [base: string, env: string];

export interface FetchCardDeps {
	readonly fetchFn?: typeof fetch;
	readonly timeoutMs?: number;
}

const CONSOLE_ENVS: readonly ConsoleBase[] = [
	['https://nibble-api.zingplay.com', 'live'],
	['https://nibble-api.zingplay.dev', 'dev'],
];
export const CARD_TIMEOUT_MS = 6000;
const MAX_TIPS = 3;

/** Console gõ tay: chỉ nhận chuỗi khác rỗng, tối đa 3 mẹo (khớp trần của Server/Console), mỗi mẹo ≤ 140 ký tự. */
export function parseTips(value: unknown): string[] {
	if (!Array.isArray(value)) return [];
	return value
		.filter((t): t is string => typeof t === 'string')
		.map((t) => t.trim())
		.filter((t) => t.length > 0 && t.length <= 140)
		.slice(0, MAX_TIPS);
}

/** Console của env đang build trước (theo endpoint tracking), rồi env còn lại. Dùng chung với kit-config. */
export function consoleBases(endpoint: string | null | undefined): readonly ConsoleBase[] {
	const own = endpoint ? CONSOLE_ENVS.find(([base]) => endpoint.startsWith(base)) : undefined;
	return own ? [own, ...CONSOLE_ENVS.filter((e) => e !== own)] : CONSOLE_ENVS;
}

/** Cùng thứ tự nhưng chọn theo TÊN env (`NB_CONSOLE_ENV` lúc build). Env lạ ⇒ live trước. */
export function consoleBasesForEnv(env: string | undefined): readonly ConsoleBase[] {
	const own = CONSOLE_ENVS.find(([, e]) => e === env);
	return own ? [own, ...CONSOLE_ENVS.filter((e) => e !== own)] : CONSOLE_ENVS;
}

export const catalogUrl = ([base, env]: ConsoleBase): string => `${base}/public/games?env=${env}`;
export const cardUrl = ([base, env]: ConsoleBase, slug: string): string =>
	`${base}/public/games/${encodeURIComponent(slug)}/card?env=${env}`;

/** Mảng game (có `appName`) ở đâu đó trong JSON, không phụ thuộc lớp bọc `data`/`items`. */
export function findGames(node: unknown): ConsoleGame[] {
	if (Array.isArray(node)) {
		if (node.length && typeof node[0] === 'object' && node[0] && 'appName' in node[0]) {
			return node as ConsoleGame[];
		}
		for (const v of node) {
			const found = findGames(v);
			if (found.length) return found;
		}
	} else if (node && typeof node === 'object') {
		for (const v of Object.values(node)) {
			const found = findGames(v);
			if (found.length) return found;
		}
	}
	return [];
}

export async function withTimeout<T>(work: Promise<T>, ms: number): Promise<T> {
	let timer: ReturnType<typeof setTimeout> | undefined;
	const timeout = new Promise<never>((_, reject) => {
		timer = setTimeout(() => reject(new Error('timeout')), ms);
	});
	try {
		return await Promise.race([work, timeout]);
	} finally {
		clearTimeout(timer);
	}
}

/**
 * Gộp bản ghi của game từ các Console theo thứ tự ưu tiên: tên + mô tả từ bản đầu tiên, mẹo + màu từ
 * bản đầu tiên CÓ chúng. Live có thể chưa có `loadingTips`/`loadingBgColor` trong khi dev đã có (08/10:
 * kit dừng ở live → mẹo dự phòng của game + nền đen).
 */
export function mergeCard(games: readonly ConsoleGame[]): GameCard | null {
	const base = games[0];
	if (!base) return null;
	const tips = games.map((g) => parseTips(g.loadingTips)).find((t) => t.length > 0) ?? [];
	const bg = games.find((g) => parseHexColor(g.loadingBgColor) !== null)?.loadingBgColor;
	return {
		name: base.displayName ?? '',
		description: base.description ?? '',
		tips,
		bgColor: typeof bg === 'string' ? bg : null,
	};
}

/** `null` = không có game ở Console này; `undefined` = KHÔNG biết (lỗi mạng, route chưa deploy) ⇒ thử đường khác. */
async function fromCardRoute(
	cb: ConsoleBase,
	slug: string,
	fetchFn: typeof fetch,
	ms: number,
): Promise<ConsoleGame | null | undefined> {
	try {
		const res = await withTimeout(fetchFn(cardUrl(cb, slug)), ms);
		const body: unknown = await res.json();
		if (res.ok) {
			return body && typeof body === 'object' && 'appName' in body
				? (body as ConsoleGame)
				: undefined;
		}
		// Chỉ 404 do CHÍNH route này (mã GAME_NOT_FOUND) mới là "game không có"; 404 của Nest
		// ("Cannot GET") nghĩa là Server chưa deploy route ⇒ rơi về catalog.
		const code = body && typeof body === 'object' ? (body as { code?: unknown }).code : undefined;
		return res.status === 404 && code === 'GAME_NOT_FOUND' ? null : undefined;
	} catch {
		return undefined;
	}
}

async function fromCatalog(
	cb: ConsoleBase,
	slug: string,
	fetchFn: typeof fetch,
	ms: number,
): Promise<ConsoleGame | undefined> {
	try {
		const res = await withTimeout(fetchFn(catalogUrl(cb)), ms);
		if (!res.ok) return undefined;
		const wanted = slug.toLowerCase();
		return findGames(await res.json()).find((g) => g.appName?.toLowerCase() === wanted);
	} catch {
		return undefined; // mạng lỗi / bị chặn / timeout
	}
}

/**
 * Thẻ của game từ các Console song song (env ưu tiên đứng đầu). Mỗi Console thử route thẻ mỏng
 * (~1 KB) trước, lỗi/chưa deploy thì rơi về catalog đầy đủ của riêng Console đó.
 */
export async function fetchGameCard(
	slug: string,
	bases: readonly ConsoleBase[],
	deps: FetchCardDeps = {},
): Promise<GameCard | null> {
	const fetchFn = deps.fetchFn ?? globalThis.fetch;
	const ms = deps.timeoutMs ?? CARD_TIMEOUT_MS;
	const found = await Promise.all(
		bases.map(async (cb) => {
			const slim = await fromCardRoute(cb, slug, fetchFn, ms);
			return slim === undefined ? fromCatalog(cb, slug, fetchFn, ms) : (slim ?? undefined);
		}),
	);
	return mergeCard(found.filter((g): g is ConsoleGame => g !== undefined));
}
