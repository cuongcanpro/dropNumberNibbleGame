import type Phaser from 'phaser';
import type { KitConfig } from '../shell/kit-config';
import { buildBottomButtons } from './game-setting-buttons';
import {
	type GameSettingTheme,
	recordSettingTheme,
	resolveSettingTheme,
	themeTitleStyle,
} from './game-setting-theme';
import { buildToggleRows, type ToggleRow } from './game-setting-toggles';
import { kitConfig } from './kit-config-client';
import { createOverlay, type Overlay } from './overlay-base';
import { panelPoint, type SettingOverlayCallbacks } from './settings-state';
import { addThemedBoard } from './themed-board';
import { uiKey } from './ui-keys';
import { makeButton, makeText, type UiButton } from './widgets';

export type { SettingOverlayCallbacks } from './settings-state';

/**
 * Panel Setting dùng chung (port Cocos `GameSettingOverlay`): 3 toggle ghi `UserData`,
 * lưới nút đáy theo callback, back key = resume. Dựng lúc `show()` (không giữ fog vô hình
 * chắn input khi chưa mở); `hide()` huỷ hết — gọi `show()` lần nữa sẽ dựng mới.
 */
export class GameSettingOverlay {
	private overlay: Overlay | null = null;
	private panel: Phaser.GameObjects.Container | null = null;
	private toggles: ToggleRow[] = [];
	private buttons: ReturnType<typeof buildBottomButtons> = {};
	private readonly theme: GameSettingTheme;
	private cfg: KitConfig = kitConfig();
	private readonly scene: Phaser.Scene;
	private readonly callbacks: SettingOverlayCallbacks;

	constructor(scene: Phaser.Scene, callbacks: SettingOverlayCallbacks) {
		this.scene = scene;
		this.callbacks = callbacks;
		this.theme = resolveSettingTheme(callbacks);
		recordSettingTheme(callbacks);
	}

	show(): void {
		if (this.overlay) return;
		const overlay = createOverlay(this.scene);
		const panel = this.scene.add.container(overlay.center.x, overlay.center.y);
		addThemedBoard(this.scene, panel, this.theme);
		this.buildTitle(panel);
		this.toggles = buildToggleRows(this.scene, panel, this.theme, this.cfg);
		this.buttons = buildBottomButtons(
			this.scene,
			panel,
			this.theme,
			this.callbacks,
			{
				resume: () => this.resume(),
				closeThen: (cb) => this.hide(cb),
			},
			this.cfg,
		);
		overlay.root.add(panel);
		this.overlay = overlay;
		this.panel = panel;
		overlay.open(panel, () => this.resume());
	}

	hide(onDone?: () => void): void {
		if (!this.overlay || !this.panel) return;
		const overlay = this.overlay;
		overlay.close(this.panel, () => {
			if (this.overlay === overlay) this.reset();
			onDone?.();
		});
	}

	isOpen(): boolean {
		return this.overlay !== null;
	}

	getSoundToggle(): ToggleRow | undefined {
		return this.toggles.find((t) => t.key === 'soundEnabled');
	}
	getMusicToggle(): ToggleRow | undefined {
		return this.toggles.find((t) => t.key === 'bgmEnabled');
	}
	getVibrationToggle(): ToggleRow | undefined {
		return this.toggles.find((t) => t.key === 'vibrationEnabled');
	}
	getResumeButton(): UiButton | undefined {
		return this.buttons.play;
	}
	getRestartButton(): UiButton | undefined {
		return this.buttons.replay;
	}

	private resume(): void {
		this.hide(() => this.callbacks.onResume());
	}

	private reset(): void {
		this.overlay = null;
		this.panel = null;
		this.toggles = [];
		this.buttons = {};
	}

	private buildTitle(panel: Phaser.GameObjects.Container): void {
		const at = panelPoint(274.5, 689.47);
		const t = this.theme;
		panel.add(
			makeText(this.scene, {
				...at,
				text: 'SETTING',
				size: 50,
				...themeTitleStyle(t),
			}),
		);
		const close = makeButton(this.scene, {
			...panelPoint(484, 689.47),
			texture: t.buttons?.close ?? uiKey('setting', 'btnClose'),
			width: 66,
			height: 66,
			onClick: () => this.resume(),
		});
		panel.add(close.root);
	}
}
