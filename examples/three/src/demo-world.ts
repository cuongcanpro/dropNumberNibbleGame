import {
	BoxGeometry,
	Mesh,
	PerspectiveCamera,
	Raycaster,
	Scene,
	type ShaderMaterial,
	Vector2,
} from 'three';
import { createLambertMaterial, setMaterialColor } from './lambert-material';

const COLORS = [0xff5da2, 0x7b5eff, 0x3dd9eb, 0xffb938];
const SPIN_X_PER_SEC = 0.6;
const SPIN_Y_PER_SEC = 0.9;
const BOUNCE_SEC = 0.35;
const BOUNCE_GROWTH = 0.25;
const CAMERA_FOV_DEG = 40;
const CAMERA_DISTANCE = 6;
const CUBE_SIZE = 1;
/** Below the screen's centre, where the template's Start button sits. */
const CUBE_Y = -1.2;

/** Scale of a bounce `elapsed` seconds in: up and back to 1 over `BOUNCE_SEC`. */
export function bounceScale(elapsed: number): number {
	if (elapsed < 0 || elapsed >= BOUNCE_SEC) return 1;
	return 1 + BOUNCE_GROWTH * Math.sin((Math.PI * elapsed) / BOUNCE_SEC);
}

/** A lit cube that spins, and changes colour and bounces when tapped. Replace it with your world. */
export class DemoWorld {
	readonly scene = new Scene();
	readonly camera: PerspectiveCamera;
	readonly cube: Mesh<BoxGeometry, ShaderMaterial>;
	private readonly width: number;
	private readonly height: number;
	private readonly raycaster = new Raycaster();
	private colorIndex = 0;
	private sinceBounce = Number.POSITIVE_INFINITY;

	/** `width` and `height` are the canvas in backing pixels (`ThreeHost`). */
	constructor(width: number, height: number) {
		this.width = width;
		this.height = height;
		this.camera = new PerspectiveCamera(CAMERA_FOV_DEG, width / height, 0.1, 100);
		this.camera.position.set(0, 0, CAMERA_DISTANCE);
		this.cube = new Mesh(
			new BoxGeometry(CUBE_SIZE, CUBE_SIZE, CUBE_SIZE),
			createLambertMaterial(COLORS[0]),
		);
		this.cube.position.y = CUBE_Y;
		this.scene.add(this.cube);
	}

	get color(): number {
		return COLORS[this.colorIndex];
	}

	/** Moves the world on by `dt` seconds; call it from the scene's `update` while not paused. */
	advance(dt: number): void {
		this.cube.rotation.x += SPIN_X_PER_SEC * dt;
		this.cube.rotation.y += SPIN_Y_PER_SEC * dt;
		this.sinceBounce += dt;
		this.cube.scale.setScalar(bounceScale(this.sinceBounce));
	}

	/** Where the cube's centre shows, in canvas pixels, y down: for a Phaser label over it, or a test tap. */
	cubeOnCanvas(): { x: number; y: number } {
		this.camera.updateMatrixWorld();
		const { x, y } = this.cube.position.clone().project(this.camera);
		return { x: ((x + 1) / 2) * this.width, y: ((1 - y) / 2) * this.height };
	}

	/** A tap at canvas pixel (`x`, `y`), y down. Returns whether it hit the cube. */
	tapAt(x: number, y: number): boolean {
		// Matrices are otherwise refreshed only when three renders, which may not have happened yet.
		this.scene.updateMatrixWorld();
		this.camera.updateMatrixWorld();
		const ndc = new Vector2((x / this.width) * 2 - 1, 1 - (y / this.height) * 2);
		this.raycaster.setFromCamera(ndc, this.camera);
		if (this.raycaster.intersectObject(this.cube).length === 0) return false;
		this.colorIndex = (this.colorIndex + 1) % COLORS.length;
		setMaterialColor(this.cube.material, this.color);
		this.sinceBounce = 0;
		return true;
	}

	dispose(): void {
		this.cube.geometry.dispose();
		this.cube.material.dispose();
	}
}
