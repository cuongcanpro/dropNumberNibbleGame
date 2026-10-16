// pnpm check:assets [--update]
// Ratchet số ảnh lẻ trong res/ mỗi game (nibi tốn ~80 ms/file lúc boot). Xem .claude/skills/pack-assets.
import { readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { countGames, findKitCopies, judge, NEW_GAME_BUDGET } from './scan.ts';

const ROOT = resolve(import.meta.dirname, '../..');
const BASELINE = join(ROOT, 'scripts/check-assets/baseline.json');

const update = process.argv.includes('--update');
const counts = await countGames(ROOT);
const baseline = JSON.parse(readFileSync(BASELINE, 'utf8')) as Record<string, number>;
const { failures, improved } = judge(counts, baseline);

for (const hit of findKitCopies(ROOT)) console.warn(`WARN bản sao asset game-kit: ${hit}`);

if (failures.length > 0) {
	for (const f of failures) console.error(`FAIL ${f}`);
	console.error(
		`\nMỗi ảnh lẻ trong res/ tốn ~80 ms lúc boot trên iPhone. Gộp UI/icon/frame thành atlas:\n` +
			`xem .claude/skills/pack-assets/SKILL.md và mục "Asset budget" trong AGENTS.md ` +
			`(ngân sách game mới: ${NEW_GAME_BUDGET} file).`,
	);
	process.exit(1);
}

if (update) {
	const next: Record<string, number> = { ...baseline };
	for (const [game, n] of Object.entries(counts)) next[game] = Math.min(n, baseline[game] ?? n);
	const sorted = Object.fromEntries(Object.entries(next).sort(([a], [b]) => a.localeCompare(b)));
	writeFileSync(BASELINE, `${JSON.stringify(sorted, null, '\t')}\n`);
	console.log('baseline cập nhật');
} else if (improved.length > 0) {
	console.log(`Giảm so với baseline: ${improved.join(', ')}. Chạy: pnpm check:assets --update`);
}
console.log('check:assets ok');
