import assert from 'node:assert/strict';
import { test } from 'node:test';
import { currentNames, namesFor, renameLockImporter, replaceNames } from './rename.ts';

const from = { id: 'sample-game', title: 'Sample Game', slug: 'samplegame' };

test('namesFor derives the slug from a kebab-case id', () => {
	assert.deepEqual(namesFor('pop-bubbles', ' Pop the Bubbles '), {
		id: 'pop-bubbles',
		title: 'Pop the Bubbles',
		slug: 'popbubbles',
	});
});

test('namesFor rejects ids that are not kebab-case', () => {
	for (const bad of ['Pop', 'pop_bubbles', 'pop--bubbles', '-pop', '1pop', '']) {
		assert.throws(() => namesFor(bad, 'X'), /kebab-case/);
	}
	assert.throws(() => namesFor('pop', '  '), /title/);
});

test('currentNames reads title and slug from game-config', () => {
	const config =
		"export const GAME_TITLE = 'Sample Game';\nexport const GAME_SLUG = 'samplegame';\n";
	assert.deepEqual(currentNames('sample-game', config), from);
	assert.throws(() => currentNames('sample-game', ''), /GAME_TITLE/);
});

test('replaceNames swaps id, title and slug in one pass', () => {
	const to = namesFor('sample-game-two', 'Sample Game Two');
	const text = 'packageId: "dev.nibi.sample-game"\ndisplayName: "Sample Game"\nslug samplegame';
	assert.equal(
		replaceNames(text, from, to),
		'packageId: "dev.nibi.sample-game-two"\ndisplayName: "Sample Game Two"\nslug samplegametwo',
	);
});

test('renameLockImporter moves only the importer key', () => {
	const lock = "importers:\n\n  games/sample-game:\n    dependencies:\n      x: '1'\n";
	assert.equal(
		renameLockImporter(lock, 'sample-game', 'pop-bubbles'),
		"importers:\n\n  games/pop-bubbles:\n    dependencies:\n      x: '1'\n",
	);
});
