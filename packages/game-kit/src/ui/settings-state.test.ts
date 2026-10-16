import { beforeEach, describe, expect, it } from 'vitest';
import { Sound } from '../platform/sound';
import { UserData } from '../platform/user-data';
import { Vibration } from '../platform/vibration';
import {
	bottomSlots,
	knobOffsetX,
	panelPoint,
	readToggle,
	visibleBottomButtons,
	writeToggle,
} from './settings-state';

const noop = () => {};

describe('visibleBottomButtons', () => {
	it('chỉ PLAY khi không có callback phụ', () => {
		expect(visibleBottomButtons({ onResume: noop }).map((b) => b.id)).toEqual(['play']);
	});
	it('giữ thứ tự Cocos và bỏ nút thiếu callback', () => {
		const ids = visibleBottomButtons({
			onResume: noop,
			onHome: noop,
			onFeedback: noop,
			onRestart: noop,
		});
		expect(ids.map((b) => b.id)).toEqual(['feedback', 'replay', 'play', 'home']);
	});
	it('cắt tối đa 4 nút', () => {
		const all = {
			onResume: noop,
			onHome: noop,
			onFeedback: noop,
			onRestart: noop,
			onThemes: noop,
			onLevels: noop,
		};
		expect(visibleBottomButtons(all)).toHaveLength(4);
	});
});

describe('bottomSlots', () => {
	it('1 nút: giữa đáy; 2: hàng đáy; 3: 2 trên + 1 giữa; 4: lưới 2x2', () => {
		expect(bottomSlots(1)).toEqual([panelPoint(271.5, 116)]);
		expect(bottomSlots(2).map((p) => p.y)).toEqual([panelPoint(0, 116).y, panelPoint(0, 116).y]);
		expect(bottomSlots(3)[2]).toEqual(panelPoint(271.5, 116));
		expect(new Set(bottomSlots(4).map((p) => `${p.x},${p.y}`)).size).toBe(4);
	});
	it('đổi y-up (Cocos) sang y-down gốc tâm', () => {
		expect(panelPoint(274.5, 373.5)).toEqual({ x: 0, y: 0 });
		expect(panelPoint(0, 747).y).toBe(-373.5);
	});
});

describe('knobOffsetX', () => {
	it('bật nghiêng phải, tắt nghiêng trái, đối xứng quanh tâm slot', () => {
		expect(knobOffsetX(true, 118)).toBe(24);
		expect(knobOffsetX(false, 118)).toBe(-24);
	});
});

describe('toggle ↔ UserData', () => {
	beforeEach(() => {
		localStorage.clear();
		UserData.resetForTest();
	});
	it('ghi bền qua storage và áp xuống Sound/Vibration', () => {
		writeToggle('soundEnabled', false);
		writeToggle('bgmEnabled', false);
		writeToggle('vibrationEnabled', false);
		expect(Sound.getInstance().isSfxEnabled()).toBe(false);
		expect(Sound.getInstance().isBgmEnabled()).toBe(false);
		expect(Vibration.isVibrationEnabled()).toBe(false);
		UserData.resetForTest(); // đọc lại từ storage
		expect(readToggle('soundEnabled')).toBe(false);
		expect(readToggle('vibrationEnabled')).toBe(false);
		writeToggle('soundEnabled', true);
		writeToggle('bgmEnabled', true);
		writeToggle('vibrationEnabled', true);
		expect(UserData.getInstance().getUserSettingsAsRaw()).toBe('smv');
	});
});
