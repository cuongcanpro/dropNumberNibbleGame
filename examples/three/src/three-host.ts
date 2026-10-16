// three r162 shares Phaser 4's WebGL1 context: r162 is the last three that still renders on WebGL1,
// the only WebGL Nibi has, so keep it pinned. Phaser's `Extern` rebinds its own GL state around
// `render()` but nobody resets three's, so `resetState()` runs on both sides. No `setSize` or
// `setPixelRatio`: they assign `canvas.width/height`, which the Nibi host ignores.
import { type Game, GameObjects, type Scene as PhaserScene, Renderer } from 'phaser';
import { type Camera, type Scene as ThreeScene, WebGLRenderer } from 'three';

export interface ThreeHost {
	readonly renderer: WebGLRenderer;
	/** The canvas in backing pixels, which is what three draws to. */
	readonly width: number;
	readonly height: number;
	renderFrame(scene: ThreeScene, camera: Camera): void;
}

let cached: { gl: WebGLRenderingContext; host: ThreeHost } | null = null;

/** One host for the life of the Game, so shaders and buffers survive scene restarts. */
export function getThreeHost(game: Game): ThreeHost {
	const phaserRenderer = game.renderer;
	if (!(phaserRenderer instanceof Renderer.WebGL.WebGLRenderer)) {
		throw new Error('ThreeHost needs Phaser running on WebGL (type: WEBGL in the game config)');
	}
	const { gl } = phaserRenderer;
	if (cached && cached.gl === gl) return cached.host;
	const canvas = game.canvas;
	const renderer = new WebGLRenderer({
		canvas,
		context: gl,
		alpha: true,
		stencil: true,
		depth: true,
	});
	renderer.autoClear = false;
	// three bound its own buffers while constructing; without a rebind Phaser's next sprite batch
	// draws with no index buffer and the frame goes blank.
	phaserRenderer.renderNodes.getNode('RebindContext')?.run(phaserRenderer.baseDrawingContext);
	const host: ThreeHost = {
		renderer,
		width: canvas.width,
		height: canvas.height,
		renderFrame(scene, camera) {
			renderer.resetState();
			renderer.setViewport(0, 0, canvas.width, canvas.height);
			// Only depth: whatever Phaser drew before this layer (the background) stays behind the 3D.
			renderer.clear(false, true, false);
			renderer.render(scene, camera);
			renderer.resetState();
			// Phaser 4 draws with stencil Equal 0 / Keep and does not set it again: hand it back.
			gl.enable(gl.STENCIL_TEST);
			gl.stencilFunc(gl.EQUAL, 0, 0xff);
			gl.stencilOp(gl.KEEP, gl.KEEP, gl.KEEP);
			gl.stencilMask(0xff);
		},
	};
	cached = { gl, host };
	return host;
}

/** The 3D world as one entry of the display list: Phaser objects added after it draw on top. */
export class ThreeLayer extends GameObjects.Extern {
	private readonly host: ThreeHost;
	private readonly world: ThreeScene;
	private readonly camera: Camera;

	constructor(scene: PhaserScene, host: ThreeHost, world: ThreeScene, camera: Camera) {
		super(scene);
		this.host = host;
		this.world = world;
		this.camera = camera;
	}

	override render(): void {
		this.host.renderFrame(this.world, this.camera);
	}
}
