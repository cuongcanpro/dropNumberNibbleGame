// pnpm deploy:nibi runs this first: it sets packageId in games/<id>/nibi.yml to zps.<username>.<id>,
// the only form the Nibi sandbox accepts from contributors, using the account `pnpm nibi:login` signed in.
import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import {
	packageIdOf,
	SANDBOX_SITE,
	sandboxPackageId,
	usernameFromWhoami,
	withPackageId,
} from './sandbox.ts';

const ROOT = resolve(import.meta.dirname, '../..');
const GAMES = join(ROOT, 'games');

/** Runs the workspace's own `nibi` CLI through Node, so it works the same on macOS and Windows. */
function nibi(...args: string[]): string {
	const require = createRequire(join(ROOT, 'package.json'));
	const manifestPath = require.resolve('nibi/package.json');
	const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as {
		readonly bin: string | Readonly<Record<string, string>>;
	};
	const bin = typeof manifest.bin === 'string' ? manifest.bin : manifest.bin.nibi;
	if (!bin) throw new Error('the nibi package has no CLI; run pnpm i');
	return execFileSync(process.execPath, [join(dirname(manifestPath), bin), ...args], {
		encoding: 'utf8',
		stdio: ['ignore', 'pipe', 'pipe'],
	});
}

try {
	const games = readdirSync(GAMES, { withFileTypes: true }).filter((d) => d.isDirectory());
	if (games.length !== 1)
		throw new Error(`expected exactly one folder in games/, found ${games.length}`);
	const id = games[0].name;
	let whoami: string;
	try {
		whoami = nibi('whoami', SANDBOX_SITE);
	} catch {
		throw new Error(`not signed in to ${SANDBOX_SITE}; run pnpm nibi:login first`);
	}
	const packageId = sandboxPackageId(usernameFromWhoami(whoami), id);
	const path = join(GAMES, id, 'nibi.yml');
	const source = readFileSync(path, 'utf8');
	const current = packageIdOf(source);
	if (current !== packageId) {
		writeFileSync(path, withPackageId(source, packageId));
		console.log(`packageId ${current ?? '(none)'} -> ${packageId} in games/${id}/nibi.yml`);
	} else {
		console.log(`packageId ${packageId}`);
	}
} catch (error) {
	console.error(`sandbox-id: ${(error as Error).message}`);
	process.exit(1);
}
