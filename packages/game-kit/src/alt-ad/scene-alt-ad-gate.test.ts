import { afterEach, describe, expect, it, vi } from 'vitest';
import { parseKitConfig } from '../shell/kit-config';
import { resetKitConfigForTest, setKitConfig } from '../shell/kit-config-store';
import { REVIVE_MESSAGES, randomReviveMessage } from './revive-messages';

afterEach(() => resetKitConfigForTest());

vi.mock('nibi', () => ({ primaryCanvas: { width: 720, height: 1280 } }));
const { createSceneAltAdGate } = await import('./scene-alt-ad-gate');

describe('altad config', () => {
	it('enabled=false: không mở popup, không emit, trả skipped', async () => {
		setKitConfig(parseKitConfig({ parts: { altad: { enabled: false } } }));
		const altAd = vi.fn<() => void>();
		const gate = createSceneAltAdGate({} as never, { altAd } as never);
		const onReward = vi.fn<() => void>();
		await expect(gate.open({ context: { taskType: 'revive' }, onReward })).resolves.toBe('skipped');
		expect(altAd).not.toHaveBeenCalled();
		expect(onReward).not.toHaveBeenCalled();
	});
});

describe('randomReviveMessage', () => {
	it('pool từ config thay kho; rỗng thì dùng kho mặc định', () => {
		expect(randomReviveMessage(() => 0, ['A', 'B'])).toBe('A');
		expect(randomReviveMessage(() => 0.99, ['A', 'B'])).toBe('B');
		expect(randomReviveMessage(() => 0, [])).toBe(REVIVE_MESSAGES[0]);
	});
});
