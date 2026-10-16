// Đếm ảnh lẻ trong res/ của từng game + tìm bản sao asset của game-kit. Thuần fs, không import game.
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { pathToFileURL } from 'node:url';

export const SKIP_GAMES = new Set(['_template_', 'nibi-api-probe']);
export const NEW_GAME_BUDGET = 30;
const IMAGE = /\.(png|jpe?g|webp)$/i;
// Catalog icon/cover bắt buộc nằm trong res/ nhưng không tải lúc boot.
const CATALOG = new Set(['icon.png', 'cover.png']);

export function walk(dir: string): string[] {
	if (!existsSync(dir)) return [];
	const out: string[] = [];
	for (const e of readdirSync(dir, { withFileTypes: true })) {
		const p = join(dir, e.name);
		if (e.isDirectory()) out.push(...walk(p));
		else if (e.isFile()) out.push(p);
	}
	return out.sort();
}

/** Đường dẫn tuyệt đối của ảnh atlas sinh ra: `<out>.png` hoặc `<out>-<n>.png` (multiatlas). */
async function atlasOutputs(gameDir: string): Promise<{ exact: Set<string>; prefixes: string[] }> {
	const exact = new Set<string>();
	const prefixes: string[] = [];
	const cfg = join(gameDir, 'pack.config.ts');
	if (!existsSync(cfg)) return { exact, prefixes };
	const config = (await import(pathToFileURL(cfg).href)).default as { groups: { out: string }[] };
	for (const g of config.groups) {
		exact.add(join(gameDir, `${g.out}.png`));
		prefixes.push(join(gameDir, g.out));
	}
	return { exact, prefixes };
}

/** Ảnh lẻ = ảnh trong res/ không phải output atlas khai trong pack.config.ts, không phải icon/cover. */
export async function looseImages(gameDir: string): Promise<string[]> {
	const { exact, prefixes } = await atlasOutputs(gameDir);
	const isAtlasPage = (f: string) =>
		exact.has(f) || prefixes.some((p) => new RegExp(`^${escapeRe(p)}-\\d+\\.png$`).test(f));
	return walk(join(gameDir, 'res')).filter((f) => {
		if (!IMAGE.test(f) || isAtlasPage(f)) return false;
		return !CATALOG.has(relative(join(gameDir, 'res'), f));
	});
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export async function countGames(root: string): Promise<Record<string, number>> {
	const counts: Record<string, number> = {};
	const gamesDir = join(root, 'games');
	for (const e of readdirSync(gamesDir, { withFileTypes: true })) {
		if (!e.isDirectory() || SKIP_GAMES.has(e.name)) continue;
		if (!existsSync(join(gamesDir, e.name, 'nibi.yml'))) continue;
		counts[e.name] = (await looseImages(join(gamesDir, e.name))).length;
	}
	return counts;
}

export interface Verdict {
	failures: string[];
	improved: string[];
}

/** Ratchet: không được tăng so với baseline; game chưa có trong baseline phải ≤ NEW_GAME_BUDGET. */
export function judge(counts: Record<string, number>, baseline: Record<string, number>): Verdict {
	const failures: string[] = [];
	const improved: string[] = [];
	for (const [game, n] of Object.entries(counts)) {
		const base = baseline[game];
		if (base === undefined) {
			if (n > NEW_GAME_BUDGET)
				failures.push(`${game}: ${n} ảnh lẻ > ngân sách game mới (${NEW_GAME_BUDGET})`);
		} else if (n > base) failures.push(`${game}: ${n} ảnh lẻ > baseline ${base}`);
		else if (n < base) improved.push(game);
	}
	return { failures, improved };
}

const sha = (f: string) => createHash('sha256').update(readFileSync(f)).digest('hex');

/** Cảnh báo: file trong game giống hệt (sha256) file của packages/game-kit/assets. */
export function findKitCopies(root: string): string[] {
	const kit = new Map<string, string>();
	for (const f of walk(join(root, 'packages/game-kit/assets'))) kit.set(sha(f), relative(root, f));
	const gamesDir = join(root, 'games');
	const hits: string[] = [];
	for (const e of readdirSync(gamesDir, { withFileTypes: true })) {
		if (!e.isDirectory() || e.name === '_template_') continue;
		for (const f of walk(join(gamesDir, e.name, 'res'))) {
			const twin = kit.get(sha(f));
			if (twin) hits.push(`${relative(root, f)} == ${twin}`);
		}
	}
	return hits;
}
