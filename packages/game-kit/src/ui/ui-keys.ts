export type UiGroup = 'setting' | 'result' | 'tutorial' | 'hud';

/**
 * Key texture: `gk-ui/<nhóm>/<tên file Cocos>`. Tiền tố `gk-ui/` để không đụng key của game.
 * Tách riêng khỏi manifest để widget/theme import key mà không kéo theo cả mảng URL.
 */
export function uiKey(group: UiGroup, name: string): string {
	return `gk-ui/${group}/${name}`;
}
