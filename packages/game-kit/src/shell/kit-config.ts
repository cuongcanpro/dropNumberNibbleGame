/**
 * Kit-config v1 (Console -> game-kit): phần THUẦN — kiểu, mặc định, parse phòng thủ. Không mạng,
 * không storage, không DOM. Hợp đồng: `GET /public/kit-config` trả `{ parts, updatedAt }` với `Text`
 * đã đổi thành chuỗi theo `lang`; mọi trường optional, vắng = mặc định của kit (hành vi cũ).
 */
export type SettingThemeName = 'blue' | 'slate' | 'orange' | 'red';
export type RankLayout = 'block' | 'off';
export type RankBoardName = 'score' | 'carrot';

export interface KitConfig {
	readonly hud: { readonly showHome: boolean; readonly showSetting: boolean };
	readonly setting: {
		/** undefined = bảng slug -> theme offline của kit. */
		readonly theme: SettingThemeName | undefined;
		readonly toggles: {
			readonly sound: boolean;
			readonly music: boolean;
			readonly vibration: boolean;
		};
		readonly buttons: {
			readonly restart: boolean;
			readonly home: boolean;
			readonly feedback: boolean;
			readonly levels: boolean;
			readonly themes: boolean;
		};
	};
	readonly result: {
		readonly showShare: boolean;
		readonly showHome: boolean;
		readonly replayLabel: string | undefined;
	};
	/** `board` undefined = mặc định của game. Kỳ luôn alltime. */
	readonly rank: { readonly layout: RankLayout; readonly board: RankBoardName | undefined };
	/** `reasons` rỗng = danh sách cứng của kit. */
	readonly feedback: { readonly enabled: boolean; readonly reasons: readonly string[] };
	readonly altad: {
		readonly enabled: boolean;
		readonly maxShakes: number | undefined;
		readonly lockMs: number | undefined;
		readonly rewardAmount: number | undefined;
		/** Rỗng = kho câu mặc định. */
		readonly messages: readonly string[];
	};
	readonly exit: {
		readonly title: string | undefined;
		readonly message: string | undefined;
		readonly yesLabel: string | undefined;
		readonly noLabel: string | undefined;
	};
}

export const KIT_CONFIG_DEFAULTS: KitConfig = {
	hud: { showHome: true, showSetting: true },
	setting: {
		theme: undefined,
		toggles: { sound: true, music: true, vibration: true },
		buttons: { restart: true, home: true, feedback: true, levels: true, themes: true },
	},
	result: { showShare: true, showHome: true, replayLabel: undefined },
	rank: { layout: 'block', board: undefined },
	feedback: { enabled: true, reasons: [] },
	altad: {
		enabled: true,
		maxShakes: undefined,
		lockMs: undefined,
		rewardAmount: undefined,
		messages: [],
	},
	exit: { title: undefined, message: undefined, yesLabel: undefined, noLabel: undefined },
};

const THEMES: readonly string[] = ['blue', 'slate', 'orange', 'red'];
const MAX_TEXT = 140;
const MAX_REASON = 64;
const MAX_REASONS = 10;
const MAX_MESSAGES = 50;

type Rec = Record<string, unknown>;
const rec = (v: unknown): Rec =>
	v && typeof v === 'object' && !Array.isArray(v) ? (v as Rec) : {};
const bool = (v: unknown, fallback: boolean): boolean => (typeof v === 'boolean' ? v : fallback);

function text(v: unknown, max: number): string | undefined {
	if (typeof v !== 'string') return undefined;
	const t = v.trim();
	return t !== '' && t.length <= max ? t : undefined;
}

function textList(v: unknown, max: number, cap: number): string[] {
	if (!Array.isArray(v)) return [];
	return v
		.map((t) => text(t, max))
		.filter((t): t is string => t !== undefined)
		.slice(0, cap);
}

/** Số nguyên trong [min, max]; ngoài khoảng / sai kiểu = bỏ (không kẹp: Server đã chặn, lệch là dữ liệu hỏng). */
function int(v: unknown, min: number, max: number): number | undefined {
	return typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max ? v : undefined;
}

function oneOf<T extends string>(v: unknown, allowed: readonly string[]): T | undefined {
	return typeof v === 'string' && allowed.includes(v) ? (v as T) : undefined;
}

/**
 * `parts` thô (từ mạng hoặc cache) -> cấu hình đầy đủ. Từng trường sai kiểu bị bỏ riêng lẻ, phần
 * còn lại vẫn dùng; bất kỳ rác nào cũng ra mặc định, không ném.
 */
export function parseKitConfig(raw: unknown): KitConfig {
	const parts = rec(rec(raw).parts ?? raw);
	const d = KIT_CONFIG_DEFAULTS;
	const hud = rec(parts.hud);
	const setting = rec(parts.setting);
	const toggles = rec(setting.toggles);
	const buttons = rec(setting.buttons);
	const result = rec(parts.result);
	const rank = rec(parts.rank);
	const feedback = rec(parts.feedback);
	const altad = rec(parts.altad);
	const exit = rec(parts.exit);
	return {
		hud: {
			showHome: bool(hud.showHome, d.hud.showHome),
			showSetting: bool(hud.showSetting, d.hud.showSetting),
		},
		setting: {
			theme: oneOf<SettingThemeName>(setting.theme, THEMES),
			toggles: {
				sound: bool(toggles.sound, true),
				music: bool(toggles.music, true),
				vibration: bool(toggles.vibration, true),
			},
			buttons: {
				restart: bool(buttons.restart, true),
				home: bool(buttons.home, true),
				feedback: bool(buttons.feedback, true),
				levels: bool(buttons.levels, true),
				themes: bool(buttons.themes, true),
			},
		},
		result: {
			showShare: bool(result.showShare, true),
			showHome: bool(result.showHome, true),
			replayLabel: text(result.replayLabel, MAX_TEXT),
		},
		rank: {
			// 'full' (đã bỏ vì trùng màn result) trong config cũ đọc thành 'block'.
			layout: rank.layout === 'off' ? 'off' : 'block',
			board: oneOf<RankBoardName>(rank.board, ['score', 'carrot']),
		},
		feedback: {
			enabled: bool(feedback.enabled, true),
			reasons: textList(feedback.reasons, MAX_REASON, MAX_REASONS),
		},
		altad: {
			enabled: bool(altad.enabled, true),
			maxShakes: int(altad.maxShakes, 1, 10),
			lockMs: int(altad.lockMs, 0, 60000),
			rewardAmount: int(altad.rewardAmount, 0, 1000),
			messages: textList(altad.messages, MAX_TEXT, MAX_MESSAGES),
		},
		exit: {
			title: text(exit.title, MAX_TEXT),
			message: text(exit.message, MAX_TEXT),
			yesLabel: text(exit.yesLabel, MAX_TEXT),
			noLabel: text(exit.noLabel, MAX_TEXT),
		},
	};
}
