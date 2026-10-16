import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC = import.meta.dirname;
// Tên trong EXCEPTIONS dùng `/`; Windows trả `\` nên phải đổi trước khi so.
const relOf = (file: string) => relative(SRC, file).split(sep).join('/');

const PURE_DIRS = ['tracking', 'metrics', 'rank', 'shell'];
const PURE_FILES = [
	'alt-ad/alt-ad-gate.ts',
	'alt-ad/shake-detector.ts',
	'alt-ad/shake-session.ts',
	'alt-ad/tap-fallback.ts',
];
// Ngoại lệ có tên: DOM listener của host tracking; shell cần `exit` từ nibi.
const EXCEPTIONS = new Set(['tracking/nibi-tracking-host.ts', 'shell/game-shell.ts']);
// Ngoại lệ navigator/localStorage: các file này tự guard `typeof ... === 'undefined'` / try-catch.
const ENV_EXCEPTIONS = new Set([
	'shell/share.ts',
	'shell/platform-detect.ts',
	'metrics/attempt/local-attempt-store.ts',
]);

function walk(dir: string): string[] {
	if (!existsSync(dir)) return [];
	return readdirSync(dir).flatMap((name) => {
		const p = join(dir, name);
		return statSync(p).isDirectory() ? walk(p) : [p];
	});
}

function pureFiles(): string[] {
	const files = [
		...PURE_DIRS.flatMap((d) => walk(join(SRC, d))),
		...PURE_FILES.map((f) => join(SRC, f)).filter((f) => existsSync(f)),
	];
	return files
		.filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts'))
		.filter((f) => !EXCEPTIONS.has(relOf(f)));
}

function stripComments(code: string): string {
	return code.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

const FORBIDDEN_IMPORT =
	/(?:from\s+|import\s*\(\s*|import\s+|require\s*\(\s*)['"](?:phaser|nibi)(?:\/[^'"]*)?['"]/;
const FORBIDDEN_GLOBAL = /(?<![.\w$])(?:document|window)\b/;
const FORBIDDEN_ENV = /(?<![.\w$])(?:navigator|localStorage)\b/;

describe('purity: phần thuần không phụ thuộc phaser/nibi/DOM', () => {
	it('quét ít nhất không lỗi trên tập file hiện có', () => {
		expect(Array.isArray(pureFiles())).toBe(true);
	});

	for (const file of pureFiles()) {
		const rel = relOf(file);
		it(`${rel}`, () => {
			const code = stripComments(readFileSync(file, 'utf8'));
			expect(FORBIDDEN_IMPORT.test(code), `${rel} import phaser/nibi`).toBe(false);
			expect(FORBIDDEN_GLOBAL.test(code), `${rel} dùng document/window`).toBe(false);
			const envViolation = !ENV_EXCEPTIONS.has(rel) && FORBIDDEN_ENV.test(code);
			expect(envViolation, `${rel} dùng navigator/localStorage`).toBe(false);
		});
	}

	it('bộ dò bắt được vi phạm (self-check)', () => {
		expect(FORBIDDEN_IMPORT.test(`import Phaser from 'phaser';`)).toBe(true);
		expect(FORBIDDEN_IMPORT.test(`import { exit } from "nibi";`)).toBe(true);
		expect(FORBIDDEN_GLOBAL.test('const x = window.innerWidth;')).toBe(true);
		expect(FORBIDDEN_GLOBAL.test('globalThis.document')).toBe(false);
		expect(FORBIDDEN_ENV.test('const ua = navigator.userAgent;')).toBe(true);
		expect(FORBIDDEN_ENV.test('localStorage.getItem(k)')).toBe(true);
		expect(FORBIDDEN_ENV.test('globalThis.navigator')).toBe(false);
	});
});
