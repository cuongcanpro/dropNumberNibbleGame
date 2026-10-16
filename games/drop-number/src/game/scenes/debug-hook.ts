import { GameObjects, type Scene } from 'phaser';

export interface InteractiveInfo {
	readonly name: string;
	readonly texture: string;
	/** Centre in 0-1 fractions of the canvas, ready for `nibi sim tap <nx> <ny> --norm`. */
	readonly nx: number;
	readonly ny: number;
}

export interface GameDebug {
	describe(): unknown;
	interactives(): InteractiveInfo[];
}

function toNorm(scene: Scene, x: number, y: number): { nx: number; ny: number } {
	const view = scene.cameras.main.worldView;
	return { nx: (x - view.x) / view.width, ny: (y - view.y) / view.height };
}

function isVisible(obj: GameObjects.GameObject): boolean {
	return (obj as { visible?: boolean }).visible !== false;
}

/** Every visible, input-enabled object in draw order (topmost last), kit buttons included. */
function listInteractives(scene: Scene): InteractiveInfo[] {
	const out: InteractiveInfo[] = [];
	const walk = (list: readonly GameObjects.GameObject[]): void => {
		for (const obj of list) {
			if (!obj.active || !isVisible(obj)) continue;
			if (obj instanceof GameObjects.Container) {
				walk(obj.list);
				continue;
			}
			if (!obj.input?.enabled) continue;
			const bounds = (obj as GameObjects.Image).getBounds();
			const texture = (obj as { texture?: { key: string } }).texture?.key ?? '';
			out.push({ name: obj.name, texture, ...toNorm(scene, bounds.centerX, bounds.centerY) });
		}
	};
	walk(scene.children.list);
	return out;
}

/**
 * `globalThis.gameDebug` for `nibi sim eval` and browser tests (docs/test-loop.md): `describe()` is the
 * game's own snapshot, `interactives()` finds buttons by `setName` or texture key (kit buttons have no name).
 */
export function installDebugHook(scene: Scene, describe: () => unknown): void {
	const hook: GameDebug = { describe, interactives: () => listInteractives(scene) };
	(globalThis as { gameDebug?: GameDebug }).gameDebug = hook;
}
