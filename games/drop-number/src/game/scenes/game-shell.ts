import { BackKeyManager } from '@repo/game-kit/platform';
import { exitToHost } from '@repo/game-kit/shell';
import { ExitConfirmDialog, FeedbackSheet, GameSettingOverlay } from '@repo/game-kit/ui';
import { type Scene, Scenes } from 'phaser';
import { GAME_SLUG } from '../config/game-config';

/**
 * Phần vỏ (Home / Settings / Back) dùng chung cho mọi scene chơi. Mỗi scene chỉ khai cách ghi nhận
 * "bỏ dở giữa chừng" của collector riêng — phần còn lại là một chỗ duy nhất.
 */
export interface ShellOptions {
	/** `collector.recordQuit('home')`: chỉ có tác dụng khi ván còn mở (collector tự bỏ qua nếu đã chốt). */
	readonly recordQuit: () => void;
	/** Settings, Exit or Feedback is opening: a real-time game pauses here (Back key included). */
	readonly onOpened?: () => void;
	/** The dialog closed without leaving the game: resume. */
	readonly onClosed?: () => void;
}

/** Home luôn hỏi xác nhận trước; confirm mới `exit()` (no-op trên web). */
export function confirmHome(scene: Scene, options: ShellOptions): void {
	options.onOpened?.();
	ExitConfirmDialog.show(
		scene,
		() => {
			void exitToHost({ recordQuit: options.recordQuit });
		},
		options.onClosed ? { onCancel: options.onClosed } : {},
	);
}

export interface SettingsOptions extends ShellOptions {
	readonly onRestart: () => void;
}

/** Settings: Resume, Replay, Feedback, Home — callback thiếu thì nút ẩn (tối đa 4 nút). */
export function openSettings(scene: Scene, options: SettingsOptions): void {
	options.onOpened?.();
	new GameSettingOverlay(scene, {
		gameId: GAME_SLUG,
		onResume: () => options.onClosed?.(),
		onRestart: options.onRestart,
		onFeedback: () => {
			FeedbackSheet.show(scene, {
				gameKey: GAME_SLUG,
				...(options.onClosed ? { onClose: options.onClosed } : {}),
			});
		},
		onHome: () => confirmHome(scene, options),
	}).show();
}

/**
 * Back/Escape khi không còn popup nào của kit đứng trên: mở ExitConfirm. Popup của kit tự đẩy
 * handler lên stack nên được xử lý trước; fallback chỉ chạy khi stack rỗng. Gỡ khi scene tắt để
 * scene kế tiếp đặt fallback của nó, và chốt outcome cho ván còn dở.
 */
export function installBackKey(
	scene: Scene,
	options: ShellOptions & { readonly recordTeardown: () => void },
): void {
	BackKeyManager.getInstance().setFallback(() => {
		confirmHome(scene, options);
		return true;
	});
	scene.events.once(Scenes.Events.SHUTDOWN, () => {
		BackKeyManager.getInstance().setFallback(null);
		// Rời scene khi ván còn mở (restart, back hệ thống) vẫn phải có outcome cho ván đó.
		options.recordTeardown();
	});
}
