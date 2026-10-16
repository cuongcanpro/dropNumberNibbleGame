import { type GameObjects, Input, type Scene, Scenes } from 'phaser';
import { DemoWorld } from './demo-world';
import { getThreeHost, ThreeLayer } from './three-host';

/**
 * Puts the 3D world into `scene` at this point of its display list: call it after the background
 * and before the HUD, so the background shows behind the 3D and the HUD draws over it.
 */
export function addDemoWorld(scene: Scene): DemoWorld {
	const host = getThreeHost(scene.game);
	const world = new DemoWorld(host.width, host.height);
	// Compile the shaders now rather than on the first frame, which would stall it.
	host.renderer.compile(world.scene, world.camera);
	scene.add.existing(new ThreeLayer(scene, host, world.scene, world.camera)).setName('world3d');
	// Pointer x/y are canvas pixels, the same space as the host. A tap on a Phaser button is not the 3D's.
	scene.input.on(
		Input.Events.POINTER_DOWN,
		(pointer: Input.Pointer, over: GameObjects.GameObject[]) => {
			if (over.length === 0) world.tapAt(pointer.x, pointer.y);
		},
	);
	scene.events.once(Scenes.Events.SHUTDOWN, () => world.dispose());
	return world;
}
