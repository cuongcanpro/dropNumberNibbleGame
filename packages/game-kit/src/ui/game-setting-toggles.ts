import type Phaser from 'phaser';
import type { KitConfig } from '../shell/kit-config';
import type { GameSettingTheme } from './game-setting-theme';
import {
	knobOffsetX,
	panelPoint,
	readToggle,
	TOGGLE_ROWS,
	type ToggleKey,
	writeToggle,
} from './settings-state';
import { uiKey } from './ui-keys';
import { makeText, rectHitArea } from './widgets';

const TOGGLE_NAME: Record<ToggleKey, 'sound' | 'music' | 'vibration'> = {
	soundEnabled: 'sound',
	bgmEnabled: 'music',
	vibrationEnabled: 'vibration',
};
const SLOT_W = 118;
const SLOT_H = 60;
const ICON_MAX_W = 79;
const ICON_MAX_H = 71;

export interface ToggleRow {
	key: ToggleKey;
	slot: Phaser.GameObjects.Image;
	knob: Phaser.GameObjects.Image;
}

function slotTexture(theme: GameSettingTheme, on: boolean): string {
	if (theme.toggle) return on ? theme.toggle.on : theme.toggle.off;
	return uiKey('setting', on ? 'on_off_slot1' : 'on_off_slot2');
}

/** 3 hàng Sound/Music/Vibration ghi `UserData` (→ Sound/Vibration áp ngay, lưu storage). */
export function buildToggleRows(
	scene: Phaser.Scene,
	panel: Phaser.GameObjects.Container,
	theme: GameSettingTheme,
	cfg?: KitConfig,
): ToggleRow[] {
	const shown = TOGGLE_ROWS.filter((r) => !cfg || cfg.setting.toggles[TOGGLE_NAME[r.key]]);
	return shown.map((row, index) => {
		// Hàng bị tắt thì dồn các hàng còn lại lên, không để lỗ hổng giữa panel.
		const y = TOGGLE_ROWS[index]?.y ?? row.y;
		const icon = scene.add.image(0, 0, theme.icons[row.icon]);
		icon.setPosition(panelPoint(100, y).x, panelPoint(100, y).y);
		if (theme.iconTint !== undefined) icon.setTint(theme.iconTint);
		if (icon.width > 0 && icon.height > 0) {
			icon.setScale(Math.min(1.5, ICON_MAX_W / icon.width, ICON_MAX_H / icon.height));
		}
		const label = makeText(scene, {
			...panelPoint(270, y),
			text: row.label,
			size: 42,
			color: theme.labelColor,
		});

		let on = readToggle(row.key);
		const at = panelPoint(460, y);
		const slot = scene.add.image(at.x, at.y, slotTexture(theme, on));
		slot.setInteractive(rectHitArea(SLOT_W, SLOT_H));
		const knob = scene.add.image(
			at.x + knobOffsetX(on, SLOT_W),
			at.y,
			theme.toggle?.knob ?? uiKey('setting', 'on_off_button'),
		);

		slot.on('pointerup', () => {
			on = !on;
			slot.setTexture(slotTexture(theme, on));
			scene.tweens.killTweensOf(knob);
			scene.tweens.add({ targets: knob, x: at.x + knobOffsetX(on, SLOT_W), duration: 100 });
			writeToggle(row.key, on);
		});

		panel.add([icon, label, slot, knob]);
		return { key: row.key, slot, knob };
	});
}
