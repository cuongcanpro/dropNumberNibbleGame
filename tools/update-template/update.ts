import { execFileSync } from 'node:child_process';
import {
	cpSync,
	existsSync,
	mkdirSync,
	readdirSync,
	readFileSync,
	rmdirSync,
	rmSync,
	writeFileSync,
} from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { type ChangelogEntry, compareVersions, entriesSince } from './changelog.ts';
import { type Merged, mergePackageJson, mergeWorkspaceYaml } from './merge.ts';

/** Folders the template owns outright: replaced whole, so files the template dropped go too. */
const TEMPLATE_DIRS = [
	'packages',
	'scripts',
	'tools',
	'docs',
	'examples',
	'.claude/skills/nibble-game',
];

/** Root files the template owns outright. The lockfile is left to `pnpm i`. */
const TEMPLATE_FILES = [
	'.dokployignore',
	'.gitattributes',
	'.gitignore',
	'.npmrc',
	'.oxlintrc.json',
	'AGENTS.md',
	'CHANGELOG.md',
	'CLAUDE.md',
	'Dockerfile',
	'README.md',
	'biome.json',
	'nginx.conf',
	'tsconfig.json',
];

const MERGED_FILES: Record<string, (user: string, template: string, base?: string) => Merged> = {
	'package.json': mergePackageJson,
	'pnpm-workspace.yaml': mergeWorkspaceYaml,
};

const NO_VERSION = '0.0.0';
const DEPENDENCY_DIR = 'node_modules';
const BACKUP_DIR = '.template-backup';
/** The template's root files as of the last update: the base of the next three-way merge. */
const BASE_DIR = '.template-base';

export interface UpdateResult {
	readonly from: string;
	readonly to: string;
	/** `delete|add|update|merge <path>`, in the order they are applied. */
	readonly actions: string[];
	readonly warnings: string[];
	/** Changelog entries newer than `from`, newest first. */
	readonly entries: ChangelogEntry[];
	/** Where the old files were copied, when the folder has no git. */
	readonly backup?: string;
}

type Change =
	| {
			readonly kind: 'add' | 'update' | 'merge';
			readonly path: string;
			readonly data: Buffer | string;
	  }
	| { readonly kind: 'delete'; readonly path: string };

const readBytes = (path: string): Buffer | undefined =>
	existsSync(path) ? readFileSync(path) : undefined;
const readText = (path: string): string | undefined => readBytes(path)?.toString('utf8');

function listFiles(root: string, dir: string): string[] {
	if (!existsSync(join(root, dir))) return [];
	return readdirSync(join(root, dir), { recursive: true, withFileTypes: true })
		.filter((e) => e.isFile())
		.map((e) => relative(root, join(e.parentPath, e.name)).split(sep).join('/'))
		.filter((path) => !path.split('/').includes(DEPENDENCY_DIR))
		.sort();
}

function versionOf(dir: string): string {
	const text = readText(join(dir, 'package.json'));
	if (text === undefined || !existsSync(join(dir, 'games'))) {
		throw new Error(`${dir} is not a Nibble game template folder (no package.json or games/)`);
	}
	let json: unknown;
	try {
		json = JSON.parse(text.replace(/^﻿/, ''));
	} catch (error) {
		throw new Error(`${join(dir, 'package.json')} is not valid JSON`, { cause: error });
	}
	const version = (json as { templateVersion?: unknown } | null)?.templateVersion;
	return typeof version === 'string' ? version : NO_VERSION;
}

function overwrite(path: string, data: Buffer, before: Buffer | undefined): Change[] {
	if (before?.equals(data)) return [];
	return [{ kind: before === undefined ? 'add' : 'update', path, data }];
}

function planDir(source: string, target: string, dir: string): Change[] {
	const incoming = listFiles(source, dir);
	const kept = new Set(incoming);
	const deletes = listFiles(target, dir).filter((path) => !kept.has(path));
	// Deletes go first and a case-only rename is rewritten, so it survives a case-insensitive disk.
	const deleted = new Set(deletes.map((path) => path.toLowerCase()));
	return [
		...deletes.map((path): Change => ({ kind: 'delete', path })),
		...incoming.flatMap((path) =>
			overwrite(
				path,
				readFileSync(join(source, path)),
				deleted.has(path.toLowerCase()) ? undefined : readBytes(join(target, path)),
			),
		),
	];
}

function plan(source: string, target: string): { changes: Change[]; warnings: string[] } {
	const changes = TEMPLATE_DIRS.flatMap((dir) => planDir(source, target, dir));
	const warnings: string[] = [];
	for (const path of TEMPLATE_FILES) {
		const data = readBytes(join(source, path));
		if (data === undefined) continue;
		const mine = readBytes(join(target, path));
		const base = readBytes(join(target, BASE_DIR, path));
		if (mine && base && !mine.equals(base) && !mine.equals(data)) {
			warnings.push(
				`${path}: you had changed it; replaced by the template's (yours is in git history)`,
			);
		}
		changes.push(...overwrite(path, data, mine));
	}
	for (const [path, merge] of Object.entries(MERGED_FILES)) {
		const theirs = readText(join(source, path));
		const mine = readText(join(target, path));
		if (theirs === undefined) continue;
		if (mine === undefined) {
			changes.push({ kind: 'add', path, data: theirs });
			continue;
		}
		const merged = merge(mine, theirs, readText(join(target, BASE_DIR, path)));
		warnings.push(...merged.warnings);
		if (merged.text !== mine) changes.push({ kind: 'merge', path, data: merged.text });
	}
	return { changes, warnings };
}

function assertCommitted(target: string): void {
	if (!existsSync(join(target, '.git'))) return;
	let status: string;
	try {
		status = execFileSync('git', ['-C', target, 'status', '--porcelain'], { encoding: 'utf8' });
	} catch (error) {
		throw new Error(`${target} has .git but \`git status\` failed; is git installed?`, {
			cause: error,
		});
	}
	if (status.trim() !== '') {
		throw new Error(
			`${target} has uncommitted changes: commit them first, so the update is its own commit`,
		);
	}
}

function writeFile(path: string, data: Buffer | string): void {
	mkdirSync(dirname(path), { recursive: true });
	writeFileSync(path, data);
}

function removeEmptyParents(target: string, path: string): void {
	for (let dir = dirname(join(target, path)); dir !== target; dir = dirname(dir)) {
		if (!existsSync(dir) || readdirSync(dir).length > 0) return;
		rmdirSync(dir);
	}
}

/** A rerun after a failed update must not replace the originals already backed up. */
function backUp(target: string, backup: string, path: string): void {
	const copy = join(backup, path);
	if (existsSync(copy) || !existsSync(join(target, path))) return;
	mkdirSync(dirname(copy), { recursive: true });
	cpSync(join(target, path), copy);
}

function apply(target: string, changes: readonly Change[], backup: string | undefined): void {
	for (const change of changes) {
		if (backup && change.kind !== 'add') backUp(target, backup, change.path);
		if (change.kind === 'delete') {
			rmSync(join(target, change.path), { force: true });
			removeEmptyParents(target, change.path);
		} else {
			writeFile(join(target, change.path), change.data);
		}
	}
}

function saveBase(source: string, target: string): void {
	rmSync(join(target, BASE_DIR), { recursive: true, force: true });
	for (const path of [...TEMPLATE_FILES, ...Object.keys(MERGED_FILES)]) {
		const data = readBytes(join(source, path));
		if (data !== undefined) writeFile(join(target, BASE_DIR, path), data);
	}
}

/** Brings `target`, a folder made from an older template, up to the template in `source`. */
export function updateTemplate(
	source: string,
	target: string,
	options: { readonly dryRun?: boolean } = {},
): UpdateResult {
	if (`${source}${sep}`.startsWith(`${target}${sep}`)) {
		throw new Error(
			'the new template is inside the folder to update: unzip it outside, e.g. next to it',
		);
	}
	const to = versionOf(source);
	const from = versionOf(target);
	const order = compareVersions(from, to);
	if (order > 0) {
		throw new Error(
			`${target} is on template ${from}, newer than ${to}: download the latest template`,
		);
	}
	if (order === 0) return { from, to, actions: [], warnings: [], entries: [] };
	if (!options.dryRun) assertCommitted(target);

	const { changes, warnings } = plan(source, target);
	const actions = changes.map((c) => `${c.kind} ${c.path}`);
	const entries = entriesSince(readText(join(source, 'CHANGELOG.md')) ?? '', from);
	if (options.dryRun) return { from, to, actions, warnings, entries };

	const backup = existsSync(join(target, '.git')) ? undefined : `${BACKUP_DIR}/${from}`;
	apply(target, changes, backup && join(target, backup));
	saveBase(source, target);
	return { from, to, actions, warnings, entries, ...(backup ? { backup } : {}) };
}
