// Quét từng game xem đã tự nối các phần dùng chung của @repo/game-kit chưa. Thuần fs, không import game.
// Nguồn luật: docs/game-kit-integration.md. Mỗi game TỰ SỞ HỮU việc nối (không ai vá hộ từng game).
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export const SKIP_GAMES = new Set(['_template_', 'nibi-api-probe']);

export interface KitPart {
	id: string;
	/** Khớp ít nhất một pattern (sau khi bỏ comment) ⇒ game đã nối phần này. */
	patterns: RegExp[];
	/** Hướng dẫn cho chủ game: nối gì, ở đâu. */
	hint: string;
}

const DOC = 'docs/game-kit-integration.md';

export const KIT_PARTS: KitPart[] = [
	{
		id: 'shell',
		patterns: [/\binitGameShell\b/],
		hint: `gọi initGameShell({ appVersion, gameSlug, mode }) trong main.ts trước new Phaser.Game (${DOC}, Bước 5)`,
	},
	{
		id: 'hud',
		patterns: [/\bkitHud\b/],
		hint: `HUD: const { home, setting } = kitHud() rồi chỉ vẽ nút Home/Setting khi true — Console bật/tắt (${DOC}, mục Kit-config, bảng part "hud")`,
	},
	{
		id: 'setting',
		patterns: [/\bGameSettingOverlay\b/],
		hint: `nút Setting mở new GameSettingOverlay(scene, {...}).show() (${DOC}, Bước 8)`,
	},
	{
		id: 'exit',
		patterns: [/\bExitConfirmDialog\b/, /\bexitToHost\b/],
		hint: `Back/Home ⇒ ExitConfirmDialog.show(...) + exitToHost({ recordQuit }) (${DOC}, Bước 8)`,
	},
	{
		id: 'feedback',
		patterns: [/\bFeedbackSheet\b/],
		hint: `onFeedback: () => FeedbackSheet.show(scene, { gameKey }) trong GameSettingOverlay (${DOC}, Bước 8)`,
	},
	{
		id: 'altAd',
		patterns: [/\bcreateSceneAltAdGate\b/, /\bShakeUi\b/, /\bAltAdGate\b/],
		hint: `lắc 3 lần thay quảng cáo: createSceneAltAdGate(scene, sink).open({...}) + preloadShakeAssets (${DOC}, Bước 9)`,
	},
	{
		id: 'rank',
		patterns: [
			/\bmountRank\b/,
			/\bGameResultPopup\b/,
			/\bfetchResultRank\b/,
			/\bResultRankBlock\b/,
		],
		hint: `result: mountRank(...) hoặc GameResultPopup + applyRank(await fetchResultRank(...)) (${DOC}, Bước 10)`,
	},
];

export const PART_IDS = KIT_PARTS.map((p) => p.id);

const SOURCE = /\.(ts|tsx|js|jsx|mjs)$/;
const TEST = /\.(test|spec)\.[a-z]+$/;

function walk(dir: string): string[] {
	if (!existsSync(dir)) return [];
	const out: string[] = [];
	for (const e of readdirSync(dir, { withFileTypes: true })) {
		const p = join(dir, e.name);
		if (e.isDirectory()) out.push(...walk(p));
		else if (e.isFile() && SOURCE.test(e.name) && !TEST.test(e.name)) out.push(p);
	}
	return out.sort();
}

/** Bỏ comment để câu "game này không dùng AltAdGate" không bị tính là đã dùng. */
export function stripComments(code: string): string {
	return code.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:\w'"`])\/\/.*$/gm, '$1');
}

/** Các phần kit mà mã nguồn `src/` của game đang dùng (không tính test). */
export function detectParts(gameDir: string): Set<string> {
	const found = new Set<string>();
	for (const file of walk(join(gameDir, 'src'))) {
		const code = stripComments(readFileSync(file, 'utf8'));
		for (const part of KIT_PARTS) {
			if (part.patterns.some((re) => re.test(code))) found.add(part.id);
		}
	}
	return found;
}

export interface Exemptions {
	exempt: Record<string, string>;
	errors: string[];
}

/** games/<id>/kit-parts.json: { "exempt": { "<part>": "lý do (vd. Cocos gốc không có)" } }. */
export function readExemptions(gameDir: string): Exemptions {
	const file = join(gameDir, 'kit-parts.json');
	if (!existsSync(file)) return { exempt: {}, errors: [] };
	const errors: string[] = [];
	const exempt: Record<string, string> = {};
	try {
		const raw =
			(JSON.parse(readFileSync(file, 'utf8')) as { exempt?: Record<string, unknown> }).exempt ?? {};
		for (const [id, reason] of Object.entries(raw)) {
			if (!PART_IDS.includes(id))
				errors.push(`kit-parts.json: part lạ "${id}" (hợp lệ: ${PART_IDS.join(', ')})`);
			else if (typeof reason !== 'string' || reason.trim().length < 10)
				errors.push(`kit-parts.json: "${id}" phải có lý do (chuỗi ≥ 10 ký tự)`);
			else exempt[id] = reason.trim();
		}
	} catch (e) {
		errors.push(`kit-parts.json không đọc được: ${(e as Error).message}`);
	}
	return { exempt, errors };
}

export interface GameReport {
	missing: string[];
	errors: string[];
}

export function scanGames(root: string): Record<string, GameReport> {
	const gamesDir = join(root, 'games');
	const out: Record<string, GameReport> = {};
	for (const e of readdirSync(gamesDir, { withFileTypes: true })) {
		if (!e.isDirectory() || SKIP_GAMES.has(e.name)) continue;
		const dir = join(gamesDir, e.name);
		if (!existsSync(join(dir, 'nibi.yml'))) continue;
		const have = detectParts(dir);
		const { exempt, errors } = readExemptions(dir);
		out[e.name] = { missing: PART_IDS.filter((id) => !have.has(id) && !(id in exempt)), errors };
	}
	return out;
}

/**
 * Ratchet: baseline chỉ được co lại. Game mất một phần (không có trong baseline) hoặc game MỚI thiếu phần ⇒ lỗi.
 * `improved` = baseline còn ghi phần game đã nối/miễn ⇒ nên chạy --update để gỡ.
 */
export function judge(
	reports: Record<string, GameReport>,
	baseline: Record<string, string[]>,
): { failures: string[]; improved: string[] } {
	const failures: string[] = [];
	const improved: string[] = [];
	for (const [game, { missing, errors }] of Object.entries(reports)) {
		for (const err of errors) failures.push(`${game}: ${err}`);
		const allowed = new Set(baseline[game] ?? []);
		const fresh = missing.filter((id) => !allowed.has(id));
		if (fresh.length > 0) {
			const why =
				game in baseline ? 'mất phần đã nối' : 'thiếu phần bắt buộc (game mới hoặc vừa mất)';
			for (const id of fresh) failures.push(`${game}: ${why} "${id}" — ${hintOf(id)}`);
		}
		if ([...allowed].some((id) => !missing.includes(id))) improved.push(game);
	}
	return { failures, improved };
}

function hintOf(id: string): string {
	return KIT_PARTS.find((p) => p.id === id)?.hint ?? '';
}
