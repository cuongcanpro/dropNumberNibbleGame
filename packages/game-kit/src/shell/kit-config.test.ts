import { describe, expect, it } from 'vitest';
import { SDK_VERSION } from '../tracking/types';
import { KIT_CONFIG_DEFAULTS, parseKitConfig } from './kit-config';
import {
	feedbackReasonsOf,
	hudButtons,
	rankBoardOf,
	rankLayoutOf,
	settingButtonVisible,
} from './kit-config-rules';

describe('parseKitConfig', () => {
	it('rác / rỗng / thiếu parts ⇒ đúng mặc định của kit', () => {
		for (const raw of [null, undefined, 42, 'x', [], {}, { parts: {} }, { parts: 5 }]) {
			expect(parseKitConfig(raw)).toEqual(KIT_CONFIG_DEFAULTS);
		}
	});

	it('nhận bản đầy đủ từ Server', () => {
		const cfg = parseKitConfig({
			parts: {
				hud: { showHome: false },
				setting: {
					theme: 'red',
					toggles: { music: false },
					buttons: { levels: false, restart: false },
				},
				result: { showShare: false, replayLabel: ' Chơi lại ' },
				rank: { layout: 'off', board: 'carrot' },
				feedback: { enabled: false, reasons: ['Lỗi', 'Khó quá'] },
				altad: { enabled: false, maxShakes: 5, lockMs: 0, rewardAmount: 3, messages: ['Ê'] },
				exit: { title: 'Thoát?', yesLabel: 'Ừ' },
			},
			updatedAt: 'x',
		});
		expect(cfg.hud).toEqual({ showHome: false, showSetting: true });
		expect(cfg.setting.theme).toBe('red');
		expect(cfg.setting.toggles).toEqual({ sound: true, music: false, vibration: true });
		expect(cfg.setting.buttons.levels).toBe(false);
		expect(cfg.setting.buttons.home).toBe(true);
		expect(cfg.result).toEqual({ showShare: false, showHome: true, replayLabel: 'Chơi lại' });
		expect(cfg.rank).toEqual({ layout: 'off', board: 'carrot' });
		expect(cfg.feedback).toEqual({ enabled: false, reasons: ['Lỗi', 'Khó quá'] });
		expect(cfg.altad).toEqual({
			enabled: false,
			maxShakes: 5,
			lockMs: 0,
			rewardAmount: 3,
			messages: ['Ê'],
		});
		expect(cfg.exit.title).toBe('Thoát?');
		expect(cfg.exit.noLabel).toBeUndefined();
	});

	it('sai kiểu bị bỏ TỪNG TRƯỜNG, trường đúng bên cạnh vẫn nhận', () => {
		const cfg = parseKitConfig({
			parts: {
				hud: { showHome: 'no', showSetting: false },
				setting: { theme: 'purple', toggles: 'x', buttons: { home: 0, levels: false } },
				result: { showShare: false, replayLabel: 7 },
				rank: { layout: 'wide', board: 'carrot' },
				feedback: { enabled: 1, reasons: ['ok', 3, '', 'x'.repeat(65)] },
				altad: { maxShakes: 99, lockMs: -1, rewardAmount: 1.5, messages: 'a' },
				exit: { title: '', message: 'm'.repeat(141) },
			},
		});
		expect(cfg.hud).toEqual({ showHome: true, showSetting: false });
		expect(cfg.setting.theme).toBeUndefined();
		expect(cfg.setting.buttons).toMatchObject({ home: true, levels: false });
		expect(cfg.result).toMatchObject({ showShare: false, replayLabel: undefined });
		expect(cfg.rank).toEqual({ layout: 'block', board: 'carrot' });
		expect(cfg.feedback).toEqual({ enabled: true, reasons: ['ok'] });
		expect(cfg.altad).toMatchObject({
			maxShakes: undefined,
			lockMs: undefined,
			rewardAmount: undefined,
		});
		expect(cfg.altad.messages).toEqual([]);
		expect(cfg.exit.title).toBeUndefined();
		expect(cfg.exit.message).toBeUndefined();
	});

	it('trần số lượng: 10 lý do, 50 câu', () => {
		const many = Array.from({ length: 80 }, (_, i) => `m${i}`);
		const cfg = parseKitConfig({
			parts: { feedback: { reasons: many }, altad: { messages: many } },
		});
		expect(cfg.feedback.reasons).toHaveLength(10);
		expect(cfg.altad.messages).toHaveLength(50);
	});
});

const cfg = (parts: unknown) => parseKitConfig({ parts });

describe('luật hiển thị', () => {
	it('hudButtons theo hud.*', () => {
		expect(hudButtons(cfg({}))).toEqual({ home: true, setting: true });
		expect(hudButtons(cfg({ hud: { showHome: false } }))).toEqual({ home: false, setting: true });
	});

	it('nút Setting = có handler VÀ config không tắt', () => {
		const c = cfg({ setting: { buttons: { home: false } } });
		expect(settingButtonVisible('home', true, c)).toBe(false);
		expect(settingButtonVisible('restart', true, c)).toBe(true);
		expect(settingButtonVisible('restart', false, c)).toBe(false); // không handler: config không tự thêm
		expect(settingButtonVisible('levels', false, KIT_CONFIG_DEFAULTS)).toBe(false);
	});

	it('feedback tắt bởi feedback.enabled hoặc buttons.feedback', () => {
		expect(settingButtonVisible('feedback', true, cfg({ feedback: { enabled: false } }))).toBe(
			false,
		);
		expect(
			settingButtonVisible('feedback', true, cfg({ setting: { buttons: { feedback: false } } })),
		).toBe(false);
		expect(settingButtonVisible('feedback', true, cfg({}))).toBe(true);
	});

	it('rank layout + board: config thắng mặc định game', () => {
		expect(rankLayoutOf(cfg({}))).toBe('block');
		expect(rankLayoutOf(cfg({ rank: { layout: 'off' } }))).toBe('off');
		expect(rankBoardOf(cfg({}), 'carrot')).toBe('carrot');
		expect(rankBoardOf(cfg({}))).toBe('score');
		expect(rankBoardOf(cfg({ rank: { board: 'score' } }), 'carrot')).toBe('score');
	});

	it('lý do góp ý: config thay hẳn, rỗng thì rơi về danh sách cứng', () => {
		expect(feedbackReasonsOf(cfg({ feedback: { reasons: ['a'] } }), ['x', 'y'])).toEqual(['a']);
		expect(feedbackReasonsOf(cfg({}), ['x', 'y'])).toEqual(['x', 'y']);
	});
});

describe('version signal', () => {
	it('sdk_version >= 1.1.0 = đọc kit-config v1 (Server/Console dựa vào mốc này)', () => {
		expect(SDK_VERSION).toBe('1.1.0');
	});
});
