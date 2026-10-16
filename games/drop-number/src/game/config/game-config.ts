/**
 * Design frame. `config/` stays pure (no kit, Phaser or nibi imports) so Vitest can load it under Node;
 * the size must match game-kit's `applyHostCamera` (fixed 720x1280 portrait).
 */
export const DESIGN_WIDTH = 720;
export const DESIGN_HEIGHT = 1280;

export const GAME_TITLE = 'Drop Number';

/** Console game key: leaderboard, metrics and the Settings theme family all hang off it. */
export const GAME_SLUG = 'dropnumber';

/** The mode picks which leaderboard receives the score (lowercase, at most 32 characters). */
export const GAME_MODE = 'endless';

/** Storage keys carry the slug and a version so an old save never lands in another game. */
export const PROFILE_STORAGE_KEY = `nibbleverse.${GAME_SLUG}.profile.v1`;
export const ATTEMPT_STORAGE_KEY = `${GAME_SLUG}.run.attempts.v1`;
