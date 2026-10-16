import { publicUrl } from '../tracking/public-url';
import { trackingConfig } from '../tracking/track';
import {
	type ConsoleBase,
	consoleBases,
	type FetchCardDeps,
	fetchGameCard,
	type GameCard,
} from './card-fetch';

// Phần thuần nằm ở card-fetch.ts; re-export để chỗ gọi cũ (kit-config-client, index) không đổi import.
export type { GameCard } from './card-fetch';
export {
	catalogUrl,
	consoleBases,
	findGames,
	mergeCard,
	parseTips,
	withTimeout,
} from './card-fetch';

interface KeyValueStore {
	getItem(key: string): string | null;
	setItem(key: string, value: string): void;
}

export interface CardDeps extends FetchCardDeps {
	readonly storage?: KeyValueStore | null;
	/** Console theo thứ tự ưu tiên (mặc định: env của bản build trước). */
	readonly bases?: readonly ConsoleBase[];
}

const cardKey = (slug: string): string => `gk.loading.card.${slug.toLowerCase()}`;

function defaultBases(): readonly ConsoleBase[] {
	const endpoint = trackingConfig()?.endpoint;
	return consoleBases(endpoint ? publicUrl(endpoint, 'games') : null);
}

export function defaultStorage(): KeyValueStore | null {
	try {
		return globalThis.localStorage ?? null;
	} catch {
		return null;
	}
}

export function readCachedCard(slug: string, store = defaultStorage()): GameCard | null {
	try {
		const raw = store?.getItem(cardKey(slug));
		return raw ? (JSON.parse(raw) as GameCard) : null;
	} catch {
		return null;
	}
}

/** Thẻ đóng gói trong bundle lúc build, hoặc null. Chỉ là điểm xuất phát cho lần mở đầu (offline). */
export function snapshotCard(
	slug: string,
	snapshot: Readonly<Record<string, GameCard>> | undefined = typeof __NB_LISTING_SNAPSHOT__ ===
	'undefined'
		? undefined
		: __NB_LISTING_SNAPSHOT__,
): GameCard | null {
	return snapshot?.[slug.toLowerCase()] ?? null;
}

/**
 * Thẻ để vẽ NGAY: cache `localStorage` (tươi nhất, ghi bởi `refreshGameCard`) → snapshot lúc build →
 * null (mặc định của kit). Snapshot không bao giờ ghi vào cache nên không thể đè bản mới hơn.
 */
export function currentCard(
	slug: string,
	store = defaultStorage(),
	snapshot?: Readonly<Record<string, GameCard>>,
): GameCard | null {
	return readCachedCard(slug, store) ?? snapshotCard(slug, snapshot);
}

/**
 * Lấy thẻ game mới nhất từ Console (route thẻ mỏng, rơi về catalog; env build ưu tiên) và lưu
 * `localStorage` cho lần mở sau. Không lấy được (offline, bị chặn, timeout, chưa có game) → null, giữ cache cũ.
 */
export async function refreshGameCard(slug: string, deps: CardDeps = {}): Promise<GameCard | null> {
	const store = deps.storage === undefined ? defaultStorage() : deps.storage;
	const card = await fetchGameCard(slug, deps.bases ?? defaultBases(), deps);
	if (!card) return null;
	try {
		store?.setItem(cardKey(slug), JSON.stringify(card));
	} catch {
		/* đầy quota: lần sau tải lại */
	}
	return card;
}
