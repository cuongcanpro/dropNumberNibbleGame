import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { compareVersions, entriesSince, parseChangelog } from './changelog.ts';

const ROOT = join(import.meta.dirname, '../..');

const sample = `# Changelog

Intro line.

## 0.3.0 - 2026-11-02
Tóm tắt: Thêm X.
### What changed
- X.
### Apply to your game
- Rename Y.

## 0.2.0 - 2026-10-20
Tóm tắt: Sửa Z.
### What changed
- Z.

## 0.1.0 - 2026-10-14
Tóm tắt: Bản đầu.
`;

test('compareVersions orders semver numerically', () => {
	assert.equal(compareVersions('0.10.0', '0.9.1'), 1);
	assert.equal(compareVersions('1.0.0', '1.0.0'), 0);
	assert.equal(compareVersions('0.0.0', '0.1.0'), -1);
	assert.throws(() => compareVersions('v1', '1.0.0'), /version/);
});

test('parseChangelog reads version, date, summary and body of each entry, newest first', () => {
	const entries = parseChangelog(sample);
	assert.deepEqual(
		entries.map(({ version, date, summary }) => [version, date, summary]),
		[
			['0.3.0', '2026-11-02', 'Thêm X.'],
			['0.2.0', '2026-10-20', 'Sửa Z.'],
			['0.1.0', '2026-10-14', 'Bản đầu.'],
		],
	);
	assert.match(entries[0].text, /^## 0\.3\.0 - 2026-11-02\n[\s\S]*- Rename Y\.$/);
});

test('entriesSince keeps only the entries newer than the given version', () => {
	assert.deepEqual(
		entriesSince(sample, '0.1.0').map((e) => e.version),
		['0.3.0', '0.2.0'],
	);
	assert.deepEqual(
		entriesSince(sample, '0.0.0').map((e) => e.version),
		['0.3.0', '0.2.0', '0.1.0'],
	);
	assert.deepEqual(entriesSince(sample, '0.3.0'), []);
});

test("the template's CHANGELOG.md tops out at package.json templateVersion, newest first, each with a summary and its changes", () => {
	const { templateVersion } = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
	const entries = parseChangelog(readFileSync(join(ROOT, 'CHANGELOG.md'), 'utf8'));
	assert.equal(entries[0]?.version, templateVersion);
	for (let i = 1; i < entries.length; i++) {
		assert.equal(compareVersions(entries[i - 1].version, entries[i].version), 1);
	}
	for (const entry of entries) {
		assert.ok(entry.summary, `${entry.version} has no "Tóm tắt:" line`);
		assert.match(entry.text, /^### What changed$/m, `${entry.version} has no "What changed"`);
	}
});
