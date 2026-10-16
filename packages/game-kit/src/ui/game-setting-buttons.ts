import type Phaser from 'phaser';
import type { KitConfig } from '../shell/kit-config';
import type { GameSettingTheme } from './game-setting-theme';
import {
	type BottomButtonId,
	type BottomButtonSpec,
	bottomSlots,
	type SettingOverlayCallbacks,
	visibleBottomButtons,
} from './settings-state';
import { uiKey } from './ui-keys';
import { makeButton, type UiButton } from './widgets';

const BTN_W = 222;
const BTN_H = 81;
const ICON_MAX = 56;

const ICONS: Record<BottomButtonId, string> = {
	feedback: 'iconFeedback',
	themes: 'iconThemes',
	levels: 'iconLevels',
	replay: 'iconReturn',
	play: 'iconPlay',
	home: 'iconMap',
};

function background(id: BottomButtonId, theme: GameSettingTheme): string {
	const b = theme.buttons;
	switch (id) {
		case 'play':
			return b?.play ?? uiKey('setting', 'btnGreen');
		case 'replay':
			return b?.replay ?? uiKey('setting', 'btnRed');
		case 'home':
			return b?.home ?? uiKey('setting', 'btnYellow');
		default:
			return b?.secondary ?? uiKey('setting', 'btnBlue');
	}
}

function shadowOf(hex: string): string {
	const n = Number.parseInt(hex.slice(1), 16);
	return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, 0.39)`;
}

/**
 * Lưới 2x2 nút đáy: chỉ nút có callback, gói vào slot liên tiếp. Nút trừ PLAY đóng overlay rồi
 * mới gọi callback (như Cocos `_wireOrHide`); PLAY = `resume`.
 */
export function buildBottomButtons(
	scene: Phaser.Scene,
	panel: Phaser.GameObjects.Container,
	theme: GameSettingTheme,
	callbacks: SettingOverlayCallbacks,
	actions: { resume: () => void; closeThen: (cb: () => void) => void },
	cfg?: KitConfig,
): Partial<Record<BottomButtonId, UiButton>> {
	const specs = visibleBottomButtons(callbacks, cfg);
	const slots = bottomSlots(specs.length);
	const out: Partial<Record<BottomButtonId, UiButton>> = {};
	specs.forEach((spec: BottomButtonSpec, i: number) => {
		const onClick = () => {
			if (spec.id === 'play') return actions.resume();
			const cb = {
				feedback: callbacks.onFeedback,
				themes: callbacks.onThemes,
				levels: callbacks.onLevels,
				replay: callbacks.onRestart,
				home: callbacks.onHome,
			}[spec.id];
			if (cb) actions.closeThen(cb);
		};
		const btn = makeButton(scene, {
			...slots[i],
			texture: background(spec.id, theme),
			width: BTN_W,
			height: BTN_H,
			// Toạ độ con tính từ góc dưới-trái nút (Cocos) → tâm nút, y-down.
			icon: {
				texture: uiKey('setting', ICONS[spec.id]),
				x: 42 - BTN_W / 2,
				y: BTN_H / 2 - 45.53,
				maxSize: ICON_MAX,
			},
			label: {
				x: 133.38 - BTN_W / 2,
				y: BTN_H / 2 - 42,
				text: spec.label,
				size: 28,
				outline: { color: spec.outline, px: 2 },
				shadow: { color: shadowOf(spec.outline), offsetX: 0, offsetY: -2 },
			},
			onClick,
		});
		panel.add(btn.root);
		out[spec.id] = btn;
	});
	return out;
}
