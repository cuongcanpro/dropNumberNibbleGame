export interface GameNames {
	readonly id: string;
	readonly title: string;
	readonly slug: string;
}

/** Files under `games/<id>/` that carry the id, title or slug. */
export const GAME_FILES = [
	'package.json',
	'nibi.yml',
	'index.html',
	'README.md',
	'pack.config.ts',
	'src/game/config/game-config.ts',
] as const;

export const CONFIG_FILE = 'src/game/config/game-config.ts';

const ID_RE = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;

/** Folder and package name in kebab-case; the slug drops the dashes (Console key convention). */
export function namesFor(id: string, title: string): GameNames {
	if (!ID_RE.test(id)) {
		throw new Error(`id "${id}" must be kebab-case: lowercase letters, digits and single dashes`);
	}
	if (title.trim() === '') throw new Error('title must not be empty');
	return { id, title: title.trim(), slug: id.replaceAll('-', '') };
}

/** Reads the current title and slug from `game-config.ts`. */
export function currentNames(id: string, configSource: string): GameNames {
	const title = /export const GAME_TITLE = '([^']+)'/.exec(configSource)?.[1];
	const slug = /export const GAME_SLUG = '([^']+)'/.exec(configSource)?.[1];
	if (!title || !slug) throw new Error(`GAME_TITLE or GAME_SLUG not found in ${CONFIG_FILE}`);
	return { id, title, slug };
}

function escapeRe(text: string): string {
	return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Replaces every old id, title and slug in one pass, so a new name containing an old one is safe. */
export function replaceNames(text: string, from: GameNames, to: GameNames): string {
	const map = new Map([
		[from.id, to.id],
		[from.title, to.title],
		[from.slug, to.slug],
	]);
	const pattern = [...map.keys()]
		.sort((a, b) => b.length - a.length)
		.map(escapeRe)
		.join('|');
	return text.replace(new RegExp(pattern, 'g'), (match) => map.get(match) ?? match);
}

/** pnpm 11 crashes on `pnpm i` when a workspace folder moves, unless the lockfile importer key moves too. */
export function renameLockImporter(lock: string, fromId: string, toId: string): string {
	return lock.replace(
		new RegExp(`^(\\s*)games/${escapeRe(fromId)}:$`, 'm'),
		(_match, indent: string) => `${indent}games/${toId}:`,
	);
}
