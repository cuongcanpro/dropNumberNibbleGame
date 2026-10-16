import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mergePackageJson, mergeWorkspaceYaml } from './merge.ts';

test("mergePackageJson takes the template's values and keeps keys the user added", () => {
	const user = {
		name: 'nibble-game-template',
		scripts: { dev: 'old dev', mine: 'node mine.ts' },
		devDependencies: { typescript: 'catalog:', lodash: '^4.0.0' },
		author: 'Lan',
	};
	const template = {
		name: 'nibble-game-template',
		templateVersion: '0.2.0',
		scripts: { dev: 'new dev', check: 'pnpm test' },
		devDependencies: { typescript: 'catalog:' },
	};
	const { text, warnings } = mergePackageJson(
		`${JSON.stringify(user, null, '\t')}\n`,
		`${JSON.stringify(template, null, '\t')}\n`,
	);
	assert.deepEqual(JSON.parse(text), {
		name: 'nibble-game-template',
		templateVersion: '0.2.0',
		scripts: { dev: 'new dev', check: 'pnpm test', mine: 'node mine.ts' },
		devDependencies: { typescript: 'catalog:', lodash: '^4.0.0' },
		author: 'Lan',
	});
	assert.match(text, /^\{\n\t"name"/);
	assert.ok(text.endsWith('}\n'));
	assert.deepEqual(warnings, [
		'package.json scripts.dev: took the template\'s "new dev" over yours "old dev"',
	]);
});

test('mergePackageJson does not warn about the version it is moving to', () => {
	const { warnings } = mergePackageJson(
		'{"templateVersion":"0.1.0"}',
		'{"templateVersion":"0.2.0"}',
	);
	assert.deepEqual(warnings, []);
});

const templateYaml = `packages:
  - games/*
  - packages/*

catalog:
  '@biomejs/biome': ^2.5.4
  nibi: ^0.6.4
  vite: ^8.1.5

allowBuilds:
  esbuild: true
`;

test("mergeWorkspaceYaml takes the template's entries and keeps entries and sections the user added", () => {
	const user = `packages:
  - games/*
  - packages/*
  - tools/mine

catalog:
  '@biomejs/biome': ^2.5.4
  nibi: ^0.6.3
  zod: ^4.0.0

allowBuilds:
  esbuild: true

overrides:
  foo: 1.0.0
`;
	const { text, warnings } = mergeWorkspaceYaml(user, templateYaml);
	assert.equal(
		text,
		`packages:
  - games/*
  - packages/*
  - tools/mine

catalog:
  '@biomejs/biome': ^2.5.4
  nibi: ^0.6.4
  vite: ^8.1.5
  zod: ^4.0.0

allowBuilds:
  esbuild: true

overrides:
  foo: 1.0.0
`,
	);
	assert.deepEqual(warnings, [
		'pnpm-workspace.yaml catalog.nibi: took the template\'s "^0.6.4" over yours "^0.6.3"',
	]);
});

test('mergeWorkspaceYaml leaves an unchanged file as it is', () => {
	assert.deepEqual(mergeWorkspaceYaml(templateYaml, templateYaml), {
		text: templateYaml,
		warnings: [],
	});
});

test('mergeWorkspaceYaml re-indents entries the user added to match the template', () => {
	const user = 'catalog:\n    nibi: ^0.6.3\n    zod: ^4.0.0\n';
	const { text } = mergeWorkspaceYaml(user, 'catalog:\n  nibi: ^0.6.4\n');
	assert.equal(text, 'catalog:\n  nibi: ^0.6.4\n  zod: ^4.0.0\n');
});

test('mergeWorkspaceYaml reads Windows line endings', () => {
	const { text, warnings } = mergeWorkspaceYaml(
		templateYaml.replaceAll('\n', '\r\n'),
		templateYaml,
	);
	assert.deepEqual([text, warnings], [templateYaml, []]);
});

test('with a base, keys the user left alone follow the template silently, edits are kept, drops are dropped', () => {
	const base = JSON.stringify({ scripts: { dev: 'a', old: 'node tools/old.ts', lint: 'x' } });
	const user = JSON.stringify({ scripts: { dev: 'a', old: 'node tools/old.ts', lint: 'mine' } });
	const template = JSON.stringify({ scripts: { dev: 'b', lint: 'x' } });
	const { text, warnings } = mergePackageJson(user, template, base);
	assert.deepEqual(JSON.parse(text).scripts, { dev: 'b', lint: 'mine' });
	assert.deepEqual(warnings, []);
});

test('mergePackageJson keeps user keys named like Object methods and names a broken file', () => {
	const { text } = mergePackageJson('{"scripts":{"constructor":"x"}}', '{"scripts":{}}');
	assert.deepEqual(JSON.parse(text).scripts, { constructor: 'x' });
	assert.deepEqual(JSON.parse(mergePackageJson('\uFEFF{"a":1}', '{"a":1}').text), { a: 1 });
	assert.throws(() => mergePackageJson('{oops', '{}'), /package\.json/);
});
