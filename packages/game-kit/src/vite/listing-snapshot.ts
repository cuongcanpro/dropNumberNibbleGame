import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { consoleBasesForEnv, fetchGameCard, type GameCard } from '@repo/game-kit/card-fetch';
import { loadEnv, type Plugin } from 'vite';

/**
 * Chụp thẻ listing (tên, mô tả, mẹo, màu nền) của game LÚC BUILD và nhúng vào bundle, để lần mở đầu
 * tiên khi OFFLINE vẫn đúng tên/mẹo/màu/theme popup (Nibi SDK không có kênh truyền tham số từ portal).
 * Runtime đọc: cache localStorage → snapshot này → mặc định (`currentCard` ở ui/loading-card.ts).
 * Nhúng trong JS nên không thêm file tải lúc boot.
 *
 * KHÔNG BAO GIỜ làm hỏng build: mạng lỗi / Console chưa có game ⇒ cảnh báo và nhúng `{}`.
 */

export type ListingSnapshot = Record<string, GameCard>;

/** Slug game khai trong code: `gameSlug: 'x'` hoặc hằng `*GAME_SLUG`/`*_SLUG = 'x'` (không khớp `'{{gameSlug}}'` của template). */
const SLUG_RE = /\b(?:gameSlug|[A-Z][A-Z0-9_]*_SLUG)\s*[:=]\s*['"]([A-Za-z0-9_-]+)['"]/g;

function sourceFiles(dir: string): string[] {
	try {
		return readdirSync(dir).flatMap((name) => {
			const p = join(dir, name);
			if (statSync(p).isDirectory()) return name === 'node_modules' ? [] : sourceFiles(p);
			return name.endsWith('.ts') && !/\.(test|spec)\.ts$/.test(name) ? [p] : [];
		});
	} catch {
		return []; // không có thư mục src (config lạ) ⇒ không chụp gì
	}
}

/** Slug (không trùng lặp, giữ hoa thường như trong code) của game ở `srcDir`. */
export function detectGameSlugs(srcDir: string): string[] {
	const found = new Set<string>();
	for (const file of sourceFiles(srcDir)) {
		for (const m of readFileSync(file, 'utf8').matchAll(SLUG_RE)) found.add(m[1]!);
	}
	return [...found];
}

export interface SnapshotOptions {
	readonly slugs: readonly string[];
	/** `NB_CONSOLE_ENV` của bản build (dev | live): env này được ưu tiên khi gộp. */
	readonly env: string;
	readonly fetchFn?: typeof fetch;
	readonly timeoutMs?: number;
	readonly warn?: (msg: string) => void;
}

export async function buildListingSnapshot(o: SnapshotOptions): Promise<ListingSnapshot> {
	const bases = consoleBasesForEnv(o.env);
	const cards = await Promise.all(
		o.slugs.map(async (slug) => {
			try {
				const card = await fetchGameCard(slug, bases, {
					...(o.fetchFn ? { fetchFn: o.fetchFn } : {}),
					timeoutMs: o.timeoutMs ?? 5000,
				});
				if (!card)
					o.warn?.(
						`[game-kit] listingSnapshot: không lấy được thẻ "${slug}" — bản build không có snapshot cho slug này.`,
					);
				return [slug.toLowerCase(), card] as const;
			} catch (e) {
				o.warn?.(`[game-kit] listingSnapshot: lỗi "${slug}": ${(e as Error).message}`);
				return [slug.toLowerCase(), null] as const;
			}
		}),
	);
	return Object.fromEntries(cards.filter((c): c is readonly [string, GameCard] => c[1] !== null));
}

export interface ListingSnapshotDeps {
	readonly fetchFn?: typeof fetch;
	readonly env?: Readonly<Record<string, string | undefined>>;
}

/**
 * Chỉ chụp ở `--mode nibi` với `NB_CONSOLE_ENV` = dev | live (bản ra thiết bị). Mọi mode khác (vite dev,
 * test, build web, `off`/`local`) nhúng `{}` — không chạm mạng. `NB_LISTING_SNAPSHOT=off` để tắt thủ công.
 */
export function listingSnapshot(mode: string, cwd: string, deps: ListingSnapshotDeps = {}): Plugin {
	return {
		name: 'game-kit-listing-snapshot',
		async config() {
			const env = deps.env ?? { ...loadEnv(mode, cwd, 'NB_'), ...process.env };
			const target = env['NB_CONSOLE_ENV'] ?? '';
			const on =
				mode === 'nibi' &&
				(target === 'dev' || target === 'live') &&
				env['NB_LISTING_SNAPSHOT'] !== 'off';
			const snapshot = on
				? await buildListingSnapshot({
						slugs: detectGameSlugs(join(cwd, 'src')),
						env: target,
						...(deps.fetchFn ? { fetchFn: deps.fetchFn } : {}),
						warn: (msg) => console.warn(msg),
					})
				: {};
			return { define: { __NB_LISTING_SNAPSHOT__: JSON.stringify(snapshot) } };
		},
	};
}
