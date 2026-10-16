// pnpm check:kit-parts [--update]
// Ratchet: mỗi game tự nối các phần dùng chung của game-kit (HUD, Setting, Exit, Feedback, alt-ad, rank).
// Xem docs/game-kit-integration.md (mục "Kiểm tự động") và .claude/skills/kit-parts.
import { readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { judge, PART_IDS, scanGames } from './scan.ts';

const ROOT = resolve(import.meta.dirname, '../..');
const BASELINE = join(ROOT, 'scripts/check-kit-parts/baseline.json');

const update = process.argv.includes('--update');
const reports = scanGames(ROOT);
const baseline = JSON.parse(readFileSync(BASELINE, 'utf8')) as Record<string, string[]>;
const { failures, improved } = judge(reports, baseline);

if (failures.length > 0) {
	for (const f of failures) console.error(`FAIL ${f}`);
	console.error(
		`\nMỗi game tự nối phần dùng chung của game-kit (${PART_IDS.join(', ')}). Sửa theo gợi ý ở trên.\n` +
			`Game CỐ Ý không có phần nào (vd. Cocos gốc không có) ⇒ tạo games/<id>/kit-parts.json:\n` +
			`  { "exempt": { "altAd": "Cocos gốc không dùng AltAdGate" } }\n` +
			`và ghi cùng lý do vào mục L của docs/port-parity-checklist.md. Baseline chỉ được co lại, không thêm tay.`,
	);
	process.exit(1);
}

if (update) {
	// Chỉ co lại: game đã sạch bị gỡ khỏi baseline; không bao giờ thêm phần thiếu mới.
	const next: Record<string, string[]> = {};
	for (const [game, allowed] of Object.entries(baseline)) {
		const missing = reports[game]?.missing ?? allowed;
		const keep = allowed.filter((id) => missing.includes(id));
		if (keep.length > 0) next[game] = keep;
	}
	writeFileSync(BASELINE, `${JSON.stringify(next, null, '\t')}\n`);
	console.log('baseline cập nhật');
} else if (improved.length > 0) {
	console.log(
		`Đã nối thêm so với baseline: ${improved.join(', ')}. Chạy: pnpm check:kit-parts --update`,
	);
}
console.log('check:kit-parts ok');
