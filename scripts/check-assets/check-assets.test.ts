import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { countGames, findKitCopies, judge, NEW_GAME_BUDGET } from './scan.ts';

function fixture(): string {
	const root = mkdtempSync(join(tmpdir(), 'check-assets-'));
	const put = (rel: string, data: string) => {
		const p = join(root, rel);
		mkdirSync(join(p, '..'), { recursive: true });
		writeFileSync(p, data);
	};
	put('packages/game-kit/assets/ui/btn.png', 'KIT');
	for (const g of ['alpha', 'beta', '_template_', 'nibi-api-probe']) put(`games/${g}/nibi.yml`, '');
	// alpha: 2 ảnh lẻ + icon/cover + atlas khai báo (1 trang đơn, 1 trang multiatlas) + JSON
	put('games/alpha/res/a.png', '1');
	put('games/alpha/res/sub/b.jpg', '2');
	put('games/alpha/res/icon.png', 'i');
	put('games/alpha/res/cover.png', 'c');
	put('games/alpha/res/ui.png', 'u');
	put('games/alpha/res/ui.json', '{}');
	put('games/alpha/res/map-0.png', 'm0');
	put('games/alpha/res/sub/icon.png', 'nested icon counts');
	put(
		'games/alpha/pack.config.ts',
		"export default { groups: [{ out: 'res/ui', sources: [] }, { out: 'res/map', sources: [] }] };",
	);
	put('games/beta/res/x.webp', '3');
	put('games/beta/res/copy.png', 'KIT');
	put('games/_template_/res/t.png', 't');
	return root;
}

test('đếm ảnh lẻ: bỏ atlas khai báo, icon/cover gốc, game bị skip', async () => {
	assert.deepEqual(await countGames(fixture()), { alpha: 3, beta: 2 });
});

test('judge: không tăng so với baseline, game mới ≤ ngân sách', () => {
	const base = { a: 10, b: 10, c: 10 };
	const v = judge({ a: 11, b: 9, c: 10, d: NEW_GAME_BUDGET + 1, e: 5 }, base);
	assert.equal(v.failures.length, 2);
	assert.ok(v.failures[0]?.startsWith('a:'));
	assert.ok(v.failures[1]?.startsWith('d:'));
	assert.deepEqual(v.improved, ['b']);
});

test('bản sao asset game-kit (sha256) bị cảnh báo', () => {
	const hits = findKitCopies(fixture());
	assert.equal(hits.length, 1);
	assert.match(
		hits[0] ?? '',
		/games\/beta\/res\/copy\.png == packages\/game-kit\/assets\/ui\/btn\.png/,
	);
});
