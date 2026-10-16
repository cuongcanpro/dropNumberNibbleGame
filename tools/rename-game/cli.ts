// pnpm rename-game <id> "<Display Name>": renames the one game in games/ (folder, package, packageId,
// title, slug, storage keys) and the pnpm-lock.yaml importer, then asks for `pnpm i`.
import { existsSync, readdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import {
	CONFIG_FILE,
	currentNames,
	GAME_FILES,
	namesFor,
	renameLockImporter,
	replaceNames,
} from './rename.ts';

const ROOT = resolve(import.meta.dirname, '../..');
const GAMES = join(ROOT, 'games');
const LOCK = join(ROOT, 'pnpm-lock.yaml');

const [id, title] = process.argv.slice(2);
if (!id || !title) {
	console.error(
		'Usage: pnpm rename-game <id> "<Display Name>"   e.g. pnpm rename-game pop-bubbles "Pop the Bubbles"',
	);
	process.exit(1);
}

const games = readdirSync(GAMES, { withFileTypes: true }).filter((d) => d.isDirectory());
if (games.length !== 1) {
	console.error(`Expected exactly one folder in games/, found ${games.length}.`);
	process.exit(1);
}

try {
	const fromId = games[0].name;
	const from = currentNames(fromId, readFileSync(join(GAMES, fromId, CONFIG_FILE), 'utf8'));
	const to = namesFor(id, title);
	if (fromId !== to.id && existsSync(join(GAMES, to.id))) {
		throw new Error(`games/${to.id} already exists`);
	}

	for (const file of GAME_FILES) {
		const path = join(GAMES, fromId, file);
		writeFileSync(path, replaceNames(readFileSync(path, 'utf8'), from, to));
	}
	writeFileSync(LOCK, renameLockImporter(readFileSync(LOCK, 'utf8'), fromId, to.id));
	if (fromId !== to.id) renameSync(join(GAMES, fromId), join(GAMES, to.id));

	console.log(
		`Renamed games/${fromId} -> games/${to.id}: title "${to.title}", slug "${to.slug}", packageId dev.nibi.${to.id}.`,
	);
	console.log('Now run: pnpm i');
} catch (error) {
	console.error(`rename-game: ${(error as Error).message}`);
	process.exit(1);
}
