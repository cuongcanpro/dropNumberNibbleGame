import type Phaser from 'phaser';

export interface TweenStep {
	tween: { targets: object; duration: number; ease?: string } & Record<string, unknown>;
}
export type SequenceStep = TweenStep | { wait: number } | { call: () => void };

/**
 * Chạy tuần tự tween / chờ / gọi hàm bằng `scene.tweens` + `scene.time` (không dùng `tweens.chain`
 * để fake scene test được). Trả hàm huỷ: dừng tween đang chạy và timer đang chờ — KHÔNG gọi `onDone`,
 * nên bên giữ promise phải tự resolve khi huỷ (xem Toast).
 */
export function playSequence(
	scene: Phaser.Scene,
	steps: readonly SequenceStep[],
	onDone?: () => void,
): () => void {
	let cancelled = false;
	let timer: { remove(): unknown } | null = null;
	const targets = new Set<object>();

	const next = (i: number): void => {
		if (cancelled) return;
		const step = steps[i];
		if (!step) {
			onDone?.();
			return;
		}
		if ('wait' in step) {
			timer = scene.time.delayedCall(step.wait, () => next(i + 1));
		} else if ('call' in step) {
			step.call();
			next(i + 1);
		} else {
			targets.add(step.tween.targets);
			scene.tweens.add({ ...step.tween, onComplete: () => next(i + 1) } as never);
		}
	};
	next(0);

	return () => {
		cancelled = true;
		timer?.remove();
		for (const t of targets) scene.tweens.killTweensOf(t);
	};
}
