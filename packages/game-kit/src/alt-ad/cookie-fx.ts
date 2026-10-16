// Hiệu ứng bánh cookie: wiggle nhàn rỗi + burst khi đếm một lần lắc (Cocos startIdleWiggle/shakeBurst).
import type Phaser from 'phaser';

export interface CookieFx {
	startIdle(): void;
	burst(isClosed: () => boolean): void;
}

export function createCookieFx(scene: Phaser.Scene, cookie: Phaser.GameObjects.Image): CookieFx {
	const fx: CookieFx = {
		startIdle() {
			cookie.setAngle(-4);
			scene.tweens.add({
				targets: cookie,
				angle: 4,
				duration: 500,
				yoyo: true,
				repeat: -1,
				ease: 'Sine.easeInOut',
			});
		},
		burst(isClosed) {
			scene.tweens.killTweensOf(cookie);
			cookie.setScale(1);
			scene.tweens.chain({
				targets: cookie,
				tweens: [
					{ angle: -14, duration: 40 },
					{ angle: 12, duration: 60 },
					{ angle: -9, duration: 50 },
					{ angle: 7, duration: 50 },
					{ angle: 0, duration: 50 },
				],
				onComplete: () => {
					if (!isClosed()) fx.startIdle();
				},
			});
			scene.tweens.add({ targets: cookie, scale: 1.12, duration: 80, yoyo: true });
		},
	};
	return fx;
}
