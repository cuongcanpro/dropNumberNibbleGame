import type Phaser from 'phaser';

interface TweenOwner {
	readonly tweens: { killTweensOf(target: unknown): unknown };
}

/**
 * Huỷ mọi tween nhắm vào `obj` và toàn bộ con cháu của nó (Container giữ con trong `list`).
 *
 * Tween `repeat: -1` (vầng sáng xoay, sao lấp lánh, bánh cookie lắc lư) KHÔNG tự dừng khi object bị
 * `destroy()`: nó chạy tiếp trên object chết, mỗi lần mở popup bỏ lại vài tween, dồn qua từng màn thành
 * giật khi tương tác bàn chơi (bunnypack đo 8 tween rò mỗi lần thắng, 08/10).
 */
export function killTweensDeep(scene: TweenOwner, obj: unknown): void {
	scene.tweens.killTweensOf(obj);
	const list = (obj as { list?: unknown }).list;
	if (Array.isArray(list)) for (const child of list) killTweensDeep(scene, child);
}

/** `killTweensDeep` rồi `destroy`; an toàn khi gọi hai lần. */
export function destroyDeep(scene: TweenOwner, obj: Phaser.GameObjects.GameObject): void {
	if (!obj.active) return;
	killTweensDeep(scene, obj);
	obj.destroy();
}
