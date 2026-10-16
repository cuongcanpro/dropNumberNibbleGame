import { execFileSync } from 'node:child_process';
import { loadEnv } from 'vite';

export interface ConsoleDefine {
	__NB_CONSOLE_ENV__: string;
	__NB_CONSOLE_EVENTS_KEY__: string;
	__NB_COMMIT__: string;
}

type EnvBag = Readonly<Record<string, string | undefined>>;

/** Hàm thuần (dễ test): thiếu key → chuỗi rỗng đã JSON.stringify → SDK tắt, fail-closed. */
export function resolveConsoleDefine(env: EnvBag, commit: string): ConsoleDefine {
	return {
		__NB_CONSOLE_ENV__: JSON.stringify(env.NB_CONSOLE_ENV ?? ''),
		__NB_CONSOLE_EVENTS_KEY__: JSON.stringify(env.NB_CONSOLE_EVENTS_KEY ?? ''),
		__NB_COMMIT__: JSON.stringify(commit),
	};
}

/** Mode Vite mà `nibi sim|dev|build|deploy` luôn dùng (`vite build --mode nibi`). */
const NIBI_MODE = 'nibi';

/**
 * Bản ra thiết bị (mode `nibi`) phải nói rõ env. Trả câu lỗi, hoặc null nếu hợp lệ.
 *
 * Vì sao chặn: `--mode nibi` chỉ đọc `.env`/`.env.nibi`(`.local`), KHÔNG đọc
 * `.env.development.local`. Game chỉ có file local ⇒ bake env rỗng ⇒ SDK tắt câm
 * trên máy thật (sandfall 06/10). Muốn build không tracking thì khai `off`.
 * Không đưa giá trị key vào câu lỗi — log build có thể bị dán đi chỗ khác.
 */
export function consoleEnvProblem(env: EnvBag, mode: string): string | null {
	if (mode !== NIBI_MODE) return null;
	const consoleEnv = env.NB_CONSOLE_ENV ?? '';
	const hint =
		'Tạo `.env.nibi` cạnh vite.config (xem .env.example) hoặc truyền qua shell. ' +
		'Build không tracking: NB_CONSOLE_ENV=off.';
	if (consoleEnv === 'off' || consoleEnv === 'local') return null;
	if (consoleEnv !== 'dev' && consoleEnv !== 'live') {
		const got = consoleEnv ? `"${consoleEnv}"` : 'rỗng/không khai báo';
		return `[game-kit] NB_CONSOLE_ENV ${got} — nibi build cần local | dev | live | off. ${hint}`;
	}
	if (!env.NB_CONSOLE_EVENTS_KEY) {
		return `[game-kit] NB_CONSOLE_ENV=${consoleEnv} nhưng thiếu NB_CONSOLE_EVENTS_KEY — SDK sẽ tắt trên máy thật. ${hint}`;
	}
	return null;
}

function shortCommit(cwd: string): string {
	try {
		return execFileSync('git', ['rev-parse', '--short', 'HEAD'], {
			cwd,
			encoding: 'utf8',
			stdio: ['ignore', 'pipe', 'ignore'],
		}).trim();
	} catch {
		return '';
	}
}

/**
 * Chạy trong Node (vite.config). `.env*` của game đọc qua loadEnv(prefix NB_);
 * biến shell (`process.env`) thắng file để CI/deploy ghi đè được.
 * Mode `nibi` mà env sai ⇒ ném lỗi, build dừng (xem consoleEnvProblem).
 */
export function consoleDefine(mode: string, cwd: string): ConsoleDefine {
	const fileEnv = loadEnv(mode, cwd, 'NB_');
	const env = { ...fileEnv, ...process.env };
	const problem = consoleEnvProblem(env, mode);
	if (problem) throw new Error(problem);
	return resolveConsoleDefine(env, shortCommit(cwd));
}
