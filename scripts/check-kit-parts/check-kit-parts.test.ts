import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { detectParts, judge, PART_IDS, readExemptions, scanGames, stripComments } from './scan.ts';

function fixture(files: Record<string, string>): string {
	const root = mkdtempSync(join(tmpdir(), 'check-kit-parts-'));
	for (const [rel, data] of Object.entries(files)) {
		const p = join(root, rel);
		mkdirSync(join(p, '..'), { recursive: true });
		writeFileSync(p, data);
	}
	return root;
}

const FULL =
	'initGameShell(); kitHud(); new GameSettingOverlay(); ExitConfirmDialog.show(); FeedbackSheet.show(); createSceneAltAdGate(); mountRank();';

test('comment không tính là đã nối', () => {
	assert.equal(
		stripComments('// createSceneAltAdGate\nconst a = 1; /* kitHud */').includes('kitHud'),
		false,
	);
	assert.ok(stripComments("const u = 'https://x.y'; // FeedbackSheet").includes('https://x.y'));
	const root = fixture({ 'g/src/a.ts': '// Không dùng FeedbackSheet\nkitHud();' });
	assert.deepEqual([...detectParts(join(root, 'g'))], ['hud']);
});

test('nhận cả .js, bỏ file test', () => {
	const root = fixture({ 'g/src/a.js': 'initGameShell()', 'g/src/a.test.ts': 'kitHud()' });
	assert.deepEqual([...detectParts(join(root, 'g'))], ['shell']);
});

test('scanGames: bỏ _template_/nibi-api-probe, game đủ phần không thiếu gì', () => {
	const root = fixture({
		'games/full/nibi.yml': '',
		'games/full/src/a.ts': FULL,
		'games/part/nibi.yml': '',
		'games/part/src/a.ts': 'kitHud();',
		'games/_template_/nibi.yml': '',
		'games/nibi-api-probe/nibi.yml': '',
	});
	const r = scanGames(root);
	assert.deepEqual(Object.keys(r).sort(), ['full', 'part']);
	assert.deepEqual(r.full?.missing, []);
	assert.deepEqual(
		r.part?.missing,
		PART_IDS.filter((id) => id !== 'hud'),
	);
});

test('kit-parts.json: miễn có lý do thì không còn thiếu; thiếu lý do / part lạ ⇒ lỗi', () => {
	const root = fixture({
		'games/a/nibi.yml': '',
		'games/a/src/x.ts':
			'initGameShell(); kitHud(); GameSettingOverlay; exitToHost; FeedbackSheet; mountRank',
		'games/a/kit-parts.json': JSON.stringify({
			exempt: { altAd: 'Cocos gốc không dùng AltAdGate' },
		}),
		'games/b/nibi.yml': '',
		'games/b/kit-parts.json': JSON.stringify({ exempt: { altAd: 'x', nope: 'lý do đủ dài rồi' } }),
	});
	assert.deepEqual(scanGames(root).a, { missing: [], errors: [] });
	assert.equal(readExemptions(join(root, 'games/b')).errors.length, 2);
});

test('judge: mất phần / game mới thiếu ⇒ lỗi; baseline co lại ⇒ improved', () => {
	const reports = {
		lost: { missing: ['hud', 'exit'], errors: [] },
		fresh: { missing: ['rank'], errors: [] },
		better: { missing: [], errors: [] },
		same: { missing: ['altAd'], errors: [] },
	};
	const v = judge(reports, { lost: ['hud'], better: ['rank'], same: ['altAd'] });
	assert.equal(v.failures.length, 2);
	assert.match(v.failures[0] ?? '', /^lost: mất phần đã nối "exit".*Bước 8/);
	assert.match(v.failures[1] ?? '', /^fresh: thiếu phần bắt buộc \(game mới hoặc vừa mất\) "rank"/);
	assert.deepEqual(v.improved, ['better']);
});
