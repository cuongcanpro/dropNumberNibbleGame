import type { KitAtlas } from './atlas-alias';

type Rect = { x: number; y: number; w: number; h: number };

/** Dạng JSON `pnpm pack-assets` ghi: Hash (1 trang) hoặc multiatlas (`textures[]`, mỗi trang một ảnh) khi nhóm tràn 2048 px. */
export interface PackedAtlasData {
	readonly frames?: Readonly<Record<string, { frame: Rect }>>;
	readonly meta?: { readonly image?: string; readonly app?: string };
	readonly textures?: readonly {
		readonly image: string;
		readonly frames: readonly { readonly filename: string; readonly frame: Rect }[];
	}[];
}

/**
 * Kết quả `import.meta.glob('./atlas/*.png', { eager: true, import: 'default', query: '?url' })` → URL theo
 * TÊN FILE (`foo-0.png`), để tra bằng `meta.image` / `textures[i].image` của JSON atlas.
 */
export function atlasPageUrls(globbed: Readonly<Record<string, string>>): Record<string, string> {
	return Object.fromEntries(
		Object.entries(globbed).map(([path, url]) => [path.slice(path.lastIndexOf('/') + 1), url]),
	);
}

/**
 * Mỗi trang atlas thành một `KitAtlas` (key `<keyPrefix>/<i>`), frame key = key texture cũ nên `add.image(key)`
 * không đổi. Dùng cho cả atlas 1 trang lẫn multiatlas; đưa từng phần tử vào `preloadKitAtlas`.
 */
export function kitAtlasPages(
	keyPrefix: string,
	data: PackedAtlasData,
	pageUrls: Readonly<Record<string, string>>,
): KitAtlas[] {
	if (data.textures) {
		return data.textures.map((page, i) => ({
			key: `${keyPrefix}/${i}`,
			url: pageUrls[page.image] ?? '',
			frames: Object.fromEntries(page.frames.map((f) => [f.filename, { frame: f.frame }])),
		}));
	}
	return [
		{
			key: `${keyPrefix}/0`,
			url: pageUrls[data.meta?.image ?? ''] ?? '',
			frames: data.frames ?? {},
		},
	];
}
