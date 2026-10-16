import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('nibi', () => ({ primaryCanvas: { width: 720, height: 1280 } }));
const { createFeedbackTextInput } = await import('./feedback-text-input');

const style = { placeholder: 'p', fill: '#fff', stroke: '#c00', text: '#600' };

function stubDom() {
	const el = {
		style: {} as Record<string, string>,
		value: 'ghi chú',
		focus() {},
		addEventListener() {},
		remove: vi.fn<() => void>(),
	};
	const styleEl = { remove: vi.fn<() => void>(), textContent: '' };
	vi.stubGlobal('document', {
		createElement: (tag: string) => (tag === 'textarea' ? el : styleEl),
		body: { appendChild() {} },
		head: { appendChild() {} },
	});
	const listeners: Record<string, () => void> = {};
	vi.stubGlobal('window', {
		addEventListener: (e: string, fn: () => void) => void (listeners[e] = fn),
		removeEventListener: (e: string) => void delete listeners[e],
	});
	return { el, styleEl, listeners };
}

/** Scene tối thiểu: camera zoom tâm design (như applyHostCamera) + canvas có rect đổi được. */
function sceneWith(rect: { left: number; top: number; width: number; height: number }) {
	const r = { ...rect };
	const scene = {
		cameras: { main: { zoom: 1, width: 720, height: 1280, scrollX: 0, scrollY: 0 } },
		game: { canvas: { getBoundingClientRect: () => r } },
		scale: { on: vi.fn<(...a: unknown[]) => void>(), off: vi.fn<(...a: unknown[]) => void>() },
	};
	return { scene: scene as never, rect: r, resize: scene.scale.on };
}

afterEach(() => vi.unstubAllGlobals());

describe('createFeedbackTextInput', () => {
	it('không có DOM ⇒ no-op, available=false', () => {
		vi.stubGlobal('document', undefined);
		const input = createFeedbackTextInput(
			sceneWith({ left: 0, top: 0, width: 1, height: 1 }).scene,
			style,
		);
		expect(input.available).toBe(false);
		expect(input.value()).toBe('');
		expect(() => input.attach({ x: 0, y: 0, w: 1, h: 1 })).not.toThrow();
	});

	it('ẩn tới khi attach; attach đặt ô đúng hộp theo rect canvas (iframe 360×640)', () => {
		const dom = stubDom();
		const { scene } = sceneWith({ left: 0, top: 0, width: 360, height: 640 });
		const input = createFeedbackTextInput(scene, style);
		expect(dom.el.style.display).toBe('none');
		input.attach({ x: 360, y: 640, w: 540, h: 84 });
		expect(dom.el.style).toMatchObject({
			display: 'block',
			left: '45px',
			top: '299px',
			width: '270px',
			height: '42px',
		});
		expect(input.value()).toBe('ghi chú');
	});

	it('đổi cỡ cửa sổ ⇒ tính lại theo rect canvas mới (letterbox lệch)', () => {
		const dom = stubDom();
		const { scene, rect } = sceneWith({ left: 0, top: 0, width: 360, height: 640 });
		const input = createFeedbackTextInput(scene, style);
		input.attach({ x: 360, y: 640, w: 540, h: 84 });
		Object.assign(rect, { left: 259, top: 0, width: 281, height: 500 });
		dom.listeners.resize?.();
		expect(Number.parseFloat(dom.el.style.left ?? '')).toBeCloseTo(259 + 90 * (281 / 720), 1);
		expect(Number.parseFloat(dom.el.style.width ?? '')).toBeCloseTo(540 * (281 / 720), 1);
	});

	it('chữ không nhỏ hơn 16px (iOS zoom) và destroy gỡ ô + listener', () => {
		const dom = stubDom();
		const { scene } = sceneWith({ left: 0, top: 0, width: 200, height: 355 });
		const input = createFeedbackTextInput(scene, style);
		input.attach({ x: 360, y: 640, w: 540, h: 84 });
		expect(Number.parseFloat(dom.el.style.fontSize ?? '')).toBeGreaterThanOrEqual(16);
		input.destroy();
		expect(dom.el.remove).toHaveBeenCalled();
		expect(dom.styleEl.remove).toHaveBeenCalled();
		expect(dom.listeners.resize).toBeUndefined();
	});
});
