// Cầu tới ShakeUi đang mở (QA/playground, và game đóng popup khi lượt chơi kết thúc). Tách file để shake-ui.ts giữ dưới 200 dòng.
import type Phaser from 'phaser';
import type { ShakeSession } from './shake-session';

interface Simulatable {
	simulateSuccess(): void;
	dismiss(): void;
}

/** Popup đang mở (tối đa 1). */
let active: Simulatable | null = null;

export const setActiveShakeUi = (ui: Simulatable): void => {
	active = ui;
};

export const clearActiveShakeUi = (ui: Simulatable): void => {
	if (active === ui) active = null;
};

/**
 * Đóng popup đang mở như nút Back (gate trả `abandoned`), như `dismissActiveShakeUi` của Cocos: lượt
 * chơi kết thúc hay popup khác sắp mở thì lời mời cũ không được nằm lại. Trả `false` nếu không có popup nào.
 */
export function dismissShakeUi(): boolean {
	if (!active) return false;
	active.dismiss();
	return true;
}

/**
 * QA / playground: đưa popup ShakeUi đang mở tới thẻ reward qua ĐÚNG đường đếm của người chơi
 * (`session.tap` → khoá `lockMs`, giới hạn `maxShakes`), không giả thời gian devicemotion.
 * Trả `false` nếu không có popup nào đang mở.
 */
export function simulateShakeSuccess(): boolean {
	if (!active) return false;
	active.simulateSuccess();
	return true;
}

export interface SimulateShakesArgs {
	scene: Phaser.Scene;
	session: ShakeSession;
	lockMs: number | undefined;
	/** Animation vào đã xong (đã bắt đầu nhận lắc thật). */
	entered: boolean;
	isFinished: () => boolean;
	count: (counted: boolean) => void;
}

/** Đếm đủ `maxShakes` lần qua `session.tap`, cách nhau `lockMs + 10` ms để khoá luôn cho qua. */
export function simulateShakes(a: SimulateShakesArgs): void {
	if (a.isFinished() || a.session.done) return;
	const gap = (a.lockMs ?? 250) + 10;
	const step = (): void => {
		if (a.isFinished() || a.session.done) return;
		a.count(a.session.tap(a.scene.time.now));
		if (!a.session.done) a.scene.time.delayedCall(gap, step);
	};
	// Chờ animation vào xong (500ms): người chơi thật chưa lắc được khi popup còn trượt lên.
	a.scene.time.delayedCall(a.entered ? 0 : 550, step);
}
