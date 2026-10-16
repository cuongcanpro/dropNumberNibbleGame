import { describe, expect, it } from 'vitest';
import { consoleEnvProblem, resolveConsoleDefine } from './console-define';

describe('resolveConsoleDefine', () => {
	it('bake đủ key dưới dạng literal JSON', () => {
		const d = resolveConsoleDefine(
			{ NB_CONSOLE_ENV: 'dev', NB_CONSOLE_EVENTS_KEY: 'k1' },
			'abc123',
		);
		expect(Object.entries(d)).toEqual([
			['__NB_CONSOLE_ENV__', '"dev"'],
			['__NB_CONSOLE_EVENTS_KEY__', '"k1"'],
			['__NB_COMMIT__', '"abc123"'],
		]);
	});

	it('thiếu key → chuỗi rỗng (SDK tắt)', () => {
		const d = resolveConsoleDefine({}, '');
		expect(Object.values(d)).toEqual(['""', '""', '""']);
	});
});

describe('consoleEnvProblem', () => {
	it('mode khác nibi (vite dev/build thường) → không chặn, kể cả thiếu env', () => {
		expect(consoleEnvProblem({}, 'development')).toBeNull();
		expect(consoleEnvProblem({}, 'production')).toBeNull();
	});

	it('nibi build thiếu NB_CONSOLE_ENV → chặn, chỉ đường tới .env.nibi', () => {
		const msg = consoleEnvProblem({}, 'nibi');
		expect(msg).toContain('.env.nibi');
		expect(msg).toContain('NB_CONSOLE_ENV');
	});

	it('nibi build env rỗng (`NB_CONSOLE_ENV= nibi build`) → chặn, muốn tắt phải nói `off`', () => {
		expect(consoleEnvProblem({ NB_CONSOLE_ENV: '' }, 'nibi')).toContain('off');
	});

	it('env lạ (staging, prod) → chặn', () => {
		expect(consoleEnvProblem({ NB_CONSOLE_ENV: 'staging' }, 'nibi')).toContain('staging');
		expect(consoleEnvProblem({ NB_CONSOLE_ENV: 'prod' }, 'nibi')).not.toBeNull();
	});

	it('dev/live thiếu NB_CONSOLE_EVENTS_KEY → chặn', () => {
		expect(consoleEnvProblem({ NB_CONSOLE_ENV: 'dev' }, 'nibi')).toContain('NB_CONSOLE_EVENTS_KEY');
		expect(
			consoleEnvProblem({ NB_CONSOLE_ENV: 'live', NB_CONSOLE_EVENTS_KEY: '' }, 'nibi'),
		).toContain('NB_CONSOLE_EVENTS_KEY');
	});

	// dev/live có key, local (key cứng), off (chủ động tắt) → cho qua
	it.each([
		{ NB_CONSOLE_ENV: 'dev', NB_CONSOLE_EVENTS_KEY: 'k' },
		{ NB_CONSOLE_ENV: 'live', NB_CONSOLE_EVENTS_KEY: 'k' },
		{ NB_CONSOLE_ENV: 'local' },
		{ NB_CONSOLE_ENV: 'off' },
	])('cho qua %o', (env) => {
		expect(consoleEnvProblem(env, 'nibi')).toBeNull();
	});

	it('câu lỗi KHÔNG lộ giá trị key', () => {
		const msg = consoleEnvProblem(
			{ NB_CONSOLE_ENV: 'bogus', NB_CONSOLE_EVENTS_KEY: 's3cret' },
			'nibi',
		);
		expect(msg).not.toContain('s3cret');
	});
});
