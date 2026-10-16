/** Dữ liệu ván — giữ shape Cocos `GameResultData` (rank đi riêng qua `applyRank`, không còn `topPercent`). */
export interface GameResultData {
	score?: number;
	bestScore?: number;
	isNewBest?: boolean;
	/** Level-clear (vd Water Sort): titlewin + "Level" + số level. */
	clearedLevel?: number;
	/** Level-failed: titlegameover + "Level" + số level, cho game không tính điểm. */
	failedLevel?: number;
	/**
	 * Số trong `score`/`bestScore` là gì: điểm (mặc định), màn chơi (game không có điểm, vd bus-craze)
	 * hay thời gian tính bằng GIÂY (vd numpuz) — hiện `mm:ss`.
	 */
	metric?: 'score' | 'level' | 'time';
	/** Dòng nhỏ dưới khối số (vd foodie "Time: 1:42"). Chế độ `time` tự có "Best : mm:ss" nếu không truyền. */
	extraLine?: string;
}

/** Giây → `mm:ss` (≥ 1 giờ: `h:mm:ss`). Âm/NaN = 0. */
const pad2 = (n: number) => String(n).padStart(2, '0');

export function formatTime(totalSeconds: number): string {
	const t = Number.isFinite(totalSeconds) && totalSeconds > 0 ? Math.floor(totalSeconds) : 0;
	const h = Math.floor(t / 3600);
	const m = Math.floor((t % 3600) / 60);
	return h > 0 ? `${h}:${pad2(m)}:${pad2(t % 60)}` : `${pad2(m)}:${pad2(t % 60)}`;
}

export function formatScore(n: number): string {
	if (n > 9_999_999) return '9,999,999+';
	return n.toLocaleString('en-US');
}

export interface ResultView {
	title: 'win' | 'gameover';
	/** 'big' = khối số lớn ("Best Score"/"Level"); 'chip' = "Your Score" + chip best. */
	info: 'big' | 'chip';
	bigLabel: string;
	bigNumber: string;
	score: string;
	best: string;
	/** Nhãn dòng số hiện tại ở chế độ chip: "Your Score" / "Your Level". */
	yourLabel: string;
	/** Dòng best nhỏ, trơn (không ribbon): "Best: 5,000" / "Best Level: 12". Chỉ hiện ở chip. */
	bestLine: string;
	/** Halo xoay chỉ khi mừng (new best / clear level). */
	halo: boolean;
	/** Dòng nhỏ dưới khối số, hoặc null. */
	extraLine: string | null;
}

/** Bốn chế độ như Cocos `show()`: level-failed, level-clear, new-best, game-over thường. */
export function resolveResultView(data: GameResultData): ResultView {
	const failed = data.failedLevel !== undefined;
	const cleared = data.clearedLevel !== undefined;
	const newBest = cleared || !!data.isNewBest;
	const level = data.metric === 'level';
	const time = data.metric === 'time' && !failed;
	const fmt = time ? formatTime : formatScore;
	const score = fmt(data.score ?? 0);
	const best = fmt(data.bestScore ?? 0);
	const info = newBest || failed ? 'big' : 'chip';
	const bestTime = `Best : ${best}`; // numpuz: dấu cách hai bên ':' như art gốc
	return {
		title: newBest ? 'win' : 'gameover',
		info,
		bigLabel:
			failed || (cleared && !time) ? 'Level' : time ? 'Time' : level ? 'Best Level' : 'Best Score',
		bigNumber: failed ? `${data.failedLevel}` : cleared && !time ? `${data.clearedLevel}` : score,
		score,
		best,
		yourLabel: time ? 'Your Time' : level ? 'Your Level' : 'Your Score',
		bestLine: time ? bestTime : `${level ? 'Best Level' : 'Best'}: ${best}`,
		halo: newBest,
		extraLine:
			data.extraLine ?? (time && info === 'big' && data.bestScore !== undefined ? bestTime : null),
	};
}

/** Toạ độ tâm popup, y-down (Cocos y-up đã đảo dấu). */
export const RESULT_POS = {
	titleWin: { x: 0, y: -288 },
	titleGameOver: { x: 0, y: -257 },
	halo: { x: 0, y: -15 },
	bigLabel: { x: 0, y: -140 },
	bigNumber: { x: 0, y: -19 },
	bestLine: { x: 4, y: 52 },
	yourScore: { x: 5, y: -153 },
	curScore: { x: 4, y: -68 },
	/** Hàng nút đặt ở y=0: `layoutClusters` dời cả cụm nút xuống đúng chỗ. Không có nút Home (luật kit). */
	share: { x: -127, y: 0 },
	replay: { x: 127, y: 0 },
	replayAlone: { x: 0, y: 0 },
	/** Nút phụ (vd Collection) có hàng riêng dưới hàng chính. */
	secondary: { x: 0, y: 108 },
	/** Dòng extraLine: dưới số lớn (big) / dưới dòng Best (chip). */
	extraBig: { x: 4, y: 52 },
	extraChip: { x: 4, y: 100 },
} as const;

export const RESULT_SCALE = 1.125;
export const RESULT_FOG = 180 / 255;
