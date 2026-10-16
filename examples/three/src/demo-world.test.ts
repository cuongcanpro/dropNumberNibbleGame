import { describe, expect, it } from 'vitest';
import { bounceScale, DemoWorld } from './demo-world';

const WIDTH = 720;
const HEIGHT = 1280;

describe('DemoWorld', () => {
	it('changes colour and bounces when the tap lands on the cube', () => {
		const world = new DemoWorld(WIDTH, HEIGHT);
		const before = world.color;
		const { x, y } = world.cubeOnCanvas();
		expect(world.tapAt(x, y)).toBe(true);
		expect(world.color).not.toBe(before);
		world.advance(0.1);
		expect(world.cube.scale.x).toBeGreaterThan(1);
	});

	it('ignores a tap beside the cube', () => {
		const world = new DemoWorld(WIDTH, HEIGHT);
		const before = world.color;
		expect(world.tapAt(20, 20)).toBe(false);
		expect(world.color).toBe(before);
	});

	it('spins while it advances', () => {
		const world = new DemoWorld(WIDTH, HEIGHT);
		world.advance(0.5);
		expect(world.cube.rotation.y).toBeGreaterThan(0);
	});

	// Nibi's WebGL1 has no OES_element_index_uint: a geometry over 65535 vertices would need 32-bit indices.
	it('keeps every index buffer 16-bit for WebGL1', () => {
		const index = new DemoWorld(WIDTH, HEIGHT).cube.geometry.index;
		expect(index?.array).toBeInstanceOf(Uint16Array);
	});
});

describe('bounceScale', () => {
	it('grows and settles back to 1', () => {
		expect(bounceScale(0)).toBe(1);
		expect(bounceScale(0.175)).toBeCloseTo(1.25);
		expect(bounceScale(0.35)).toBe(1);
	});
});
