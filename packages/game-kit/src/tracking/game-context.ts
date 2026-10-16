/**
 * Slug + mode của game đang chơi — thay `ShareStorage.get('gameSlug'/'gameMode')` của Cocos.
 * Một nguồn duy nhất cho sink-bridge và rank-client (Phase 05): game một mode không set gì.
 */
const MAX_MODE_LEN = 32;

let gameSlug = '';
let gameMode = '';

/**
 * Cùng luật Server (`validate-event.ts`): trim + lowercase, > 32 ký tự là lỗi BAD_MODE
 * (server loại cả event). Client cắt về 32 để một mode dài lỡ tay không làm mất event.
 * Rỗng → undefined: "chưa khai" và "mode tên rỗng" là một chuyện.
 */
export function normalizeMode(raw: string | undefined | null): string | undefined {
	if (typeof raw !== 'string') return undefined;
	const m = raw.trim().toLowerCase().slice(0, MAX_MODE_LEN);
	return m === '' ? undefined : m;
}

export function setGameSlug(slug: string | undefined): void {
	gameSlug = slug ?? '';
}
export function getGameSlug(): string | undefined {
	return gameSlug || undefined;
}
export function setGameMode(mode: string | undefined): void {
	gameMode = normalizeMode(mode) ?? '';
}
export function getGameMode(): string | undefined {
	return gameMode || undefined;
}

/** Chỉ dùng trong test. */
export function resetGameContextForTest(): void {
	gameSlug = '';
	gameMode = '';
}
