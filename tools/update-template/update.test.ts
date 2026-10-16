import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import {
	existsSync,
	mkdirSync,
	mkdtempSync,
	readdirSync,
	readFileSync,
	renameSync,
	writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative } from 'node:path';
import { test } from 'node:test';
import { updateTemplate } from './update.ts';

type Tree = Record<string, string>;

function write(root: string, tree: Tree): string {
	for (const [path, text] of Object.entries(tree)) {
		mkdirSync(dirname(join(root, path)), { recursive: true });
		writeFileSync(join(root, path), text);
	}
	return root;
}

function read(root: string): Tree {
	const tree: Tree = {};
	const walk = (dir: string): void => {
		for (const entry of readdirSync(dir, { withFileTypes: true })) {
			if (entry.name === '.git' || entry.name === '.template-base') continue;
			const path = join(dir, entry.name);
			if (entry.isDirectory()) walk(path);
			else tree[relative(root, path).split('\\').join('/')] = readFileSync(path, 'utf8');
		}
	};
	walk(root);
	return tree;
}

const pkg = (version: string | undefined, scripts: Record<string, string>): string =>
	`${JSON.stringify({ name: 't', ...(version ? { templateVersion: version } : {}), scripts }, null, '\t')}\n`;

const CHANGELOG = `# Changelog

## 0.2.0 - 2026-10-20
Tóm tắt: Bản mới.
### Apply to your game
- Do Y.

## 0.1.0 - 2026-10-14
Tóm tắt: Bản đầu.
`;

const source = (): string =>
	write(mkdtempSync(join(tmpdir(), 'tpl-src-')), {
		'package.json': pkg('0.2.0', { dev: 'vite', check: 'pnpm test' }),
		'pnpm-workspace.yaml': 'packages:\n  - games/*\n  - packages/*\n',
		'AGENTS.md': 'new agents',
		'CHANGELOG.md': CHANGELOG,
		'.gitignore': 'node_modules/\n',
		'packages/game-kit/src/hud.ts': 'new hud',
		'packages/game-kit/src/added.ts': 'added',
		'packages/game-kit/node_modules/dep/index.js': 'source deps',
		'tools/update-template/cli.ts': 'cli',
		'docs/game-kit.md': 'new docs',
		'.claude/skills/nibble-game/SKILL.md': 'new skill',
		'games/sample-game/src/main.ts': 'sample',
	});

const userGame: Tree = {
	'pnpm-workspace.yaml': 'packages:\n  - games/*\n  - packages/*\n',
	'AGENTS.md': 'old agents',
	'packages/game-kit/src/hud.ts': 'old hud',
	'packages/game-kit/src/dropped.ts': 'dropped',
	'packages/game-kit/node_modules/dep/index.js': 'installed',
	'docs/game-kit.md': 'old docs',
	'.claude/skills/nibble-game/SKILL.md': 'old skill',
	'.claude/settings.local.json': '{}',
	'games/pop-bubbles/src/main.ts': 'my game',
	'pnpm-lock.yaml': 'lock',
	'.zdeploy.yml': 'applicationId: x',
};

const target = (version = '0.1.0', extra: Tree = {}): string =>
	write(mkdtempSync(join(tmpdir(), 'tpl-dst-')), {
		...userGame,
		'package.json': pkg(version, { dev: 'vite', mine: 'node mine.ts' }),
		...extra,
	});

function gitCommitAll(dir: string): void {
	const git = (...args: string[]): void => {
		execFileSync('git', ['-C', dir, '-c', 'user.name=t', '-c', 'user.email=t@t', ...args], {
			stdio: 'ignore',
		});
	};
	git('init', '-q');
	git('add', '-A');
	git('commit', '-q', '-m', 'start');
}

test('replaces the template folders, overwrites and merges root files, and leaves the game alone', () => {
	const dst = target();
	gitCommitAll(dst);
	const result = updateTemplate(source(), dst);
	const { 'packages/game-kit/src/dropped.ts': _dropped, ...kept } = userGame;
	assert.deepEqual(read(dst), {
		...kept,
		'package.json': pkg('0.2.0', { dev: 'vite', check: 'pnpm test', mine: 'node mine.ts' }),
		'AGENTS.md': 'new agents',
		'CHANGELOG.md': CHANGELOG,
		'.gitignore': 'node_modules/\n',
		'packages/game-kit/src/hud.ts': 'new hud',
		'packages/game-kit/src/added.ts': 'added',
		'tools/update-template/cli.ts': 'cli',
		'docs/game-kit.md': 'new docs',
		'.claude/skills/nibble-game/SKILL.md': 'new skill',
	});
	assert.equal(result.from, '0.1.0');
	assert.equal(result.to, '0.2.0');
	assert.deepEqual(
		result.entries.map((e) => e.version),
		['0.2.0'],
	);
	assert.equal(result.backup, undefined);
});

test('a dry run lists every change and touches nothing', () => {
	const dst = target();
	gitCommitAll(dst);
	const before = read(dst);
	const result = updateTemplate(source(), dst, { dryRun: true });
	assert.deepEqual(read(dst), before);
	assert.deepEqual(result.actions, [
		'delete packages/game-kit/src/dropped.ts',
		'add packages/game-kit/src/added.ts',
		'update packages/game-kit/src/hud.ts',
		'add tools/update-template/cli.ts',
		'update docs/game-kit.md',
		'update .claude/skills/nibble-game/SKILL.md',
		'add .gitignore',
		'update AGENTS.md',
		'add CHANGELOG.md',
		'merge package.json',
	]);
});

test('without git, the files it changes or deletes are first copied to .template-backup/', () => {
	const dst = target();
	const result = updateTemplate(source(), dst);
	assert.equal(result.backup, '.template-backup/0.1.0');
	const backup = read(join(dst, '.template-backup/0.1.0'));
	assert.deepEqual(backup, {
		'packages/game-kit/src/hud.ts': 'old hud',
		'packages/game-kit/src/dropped.ts': 'dropped',
		'docs/game-kit.md': 'old docs',
		'.claude/skills/nibble-game/SKILL.md': 'old skill',
		'AGENTS.md': 'old agents',
		'package.json': pkg('0.1.0', { dev: 'vite', mine: 'node mine.ts' }),
	});
});

test('a copy without templateVersion counts as 0.0.0 and gets every changelog entry', () => {
	const dst = target('0.1.0', { 'package.json': pkg(undefined, { dev: 'vite' }) });
	gitCommitAll(dst);
	const result = updateTemplate(source(), dst);
	assert.equal(result.from, '0.0.0');
	assert.deepEqual(
		result.entries.map((e) => e.version),
		['0.2.0', '0.1.0'],
	);
});

test('refuses uncommitted changes in a git folder, a newer folder, and a folder that is not a template', () => {
	const dirty = target();
	gitCommitAll(dirty);
	writeFileSync(join(dirty, 'games/pop-bubbles/src/main.ts'), 'edited');
	assert.throws(() => updateTemplate(source(), dirty), /commit/);

	assert.throws(() => updateTemplate(source(), target('0.3.0')), /newer/);
	assert.throws(
		() => updateTemplate(source(), mkdtempSync(join(tmpdir(), 'tpl-none-'))),
		/template/,
	);
});

test('a folder already on the source version has nothing to do', () => {
	const dst = target('0.2.0');
	gitCommitAll(dst);
	const result = updateTemplate(source(), dst);
	assert.deepEqual([result.actions, result.entries], [[], []]);
});

test('copies binary files byte for byte', () => {
	const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0xff, 0xfe, 0x00, 0x80]);
	const src = source();
	mkdirSync(join(src, 'packages/game-kit/assets'));
	writeFileSync(join(src, 'packages/game-kit/assets/btn.png'), png);
	const dst = target('0.1.0', { 'packages/game-kit/assets/btn.png': 'old' });
	gitCommitAll(dst);
	updateTemplate(src, dst);
	assert.deepEqual(readFileSync(join(dst, 'packages/game-kit/assets/btn.png')), png);
});

test('a file the template renamed by case only survives', () => {
	const src = source();
	renameSync(join(src, 'packages/game-kit/src/hud.ts'), join(src, 'packages/game-kit/src/Hud.ts'));
	const dst = target();
	gitCommitAll(dst);
	updateTemplate(src, dst);
	assert.ok(readdirSync(join(dst, 'packages/game-kit/src')).includes('Hud.ts'));
	assert.equal(readFileSync(join(dst, 'packages/game-kit/src/Hud.ts'), 'utf8'), 'new hud');
});

test('the next update merges against the template it last brought, so only real edits are kept or reported', () => {
	const dst = target();
	gitCommitAll(dst);
	updateTemplate(source(), dst);
	assert.ok(existsSync(join(dst, '.template-base/package.json')));

	const user = JSON.parse(readFileSync(join(dst, 'package.json'), 'utf8'));
	user.scripts.check = 'pnpm test && pnpm lint';
	writeFileSync(join(dst, 'package.json'), JSON.stringify(user, null, '\t'));
	writeFileSync(join(dst, '.gitignore'), 'mine\n');
	gitCommitAll(dst);

	const next = source();
	write(next, {
		'package.json': pkg('0.3.0', { dev: 'vite --host' }),
		'.gitignore': 'template\n',
		'CHANGELOG.md': `# Changelog\n\n## 0.3.0 - 2026-11-01\nTóm tắt: Ba.\n\n${CHANGELOG.slice(13)}`,
	});
	const result = updateTemplate(next, dst);
	assert.deepEqual(JSON.parse(readFileSync(join(dst, 'package.json'), 'utf8')).scripts, {
		dev: 'vite --host',
		check: 'pnpm test && pnpm lint',
		mine: 'node mine.ts',
	});
	assert.deepEqual(result.warnings, [
		".gitignore: you had changed it; replaced by the template's (yours is in git history)",
		'package.json scripts.check: the template dropped it; kept your edited copy',
	]);
});

test('refuses a source unzipped inside the folder it updates', () => {
	const dst = target();
	const src = join(dst, 'nibble-game-template');
	renameSync(source(), src);
	assert.throws(() => updateTemplate(src, dst), /outside/);
});

test('a rerun after a failed update keeps the first backup of each file', () => {
	const dst = target();
	updateTemplate(source(), dst, { dryRun: true });
	const backupOf = (path: string): string => join(dst, '.template-backup/0.1.0', path);
	write(dst, { '.template-backup/0.1.0/AGENTS.md': 'old agents' });
	writeFileSync(join(dst, 'AGENTS.md'), 'half-updated');
	updateTemplate(source(), dst);
	assert.equal(readFileSync(backupOf('AGENTS.md'), 'utf8'), 'old agents');
});
