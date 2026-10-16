import { afterEach, describe, expect, it } from 'vitest';
/**
 * Contract check 2 đầu: SDK THẬT bắn vào Console THẬT (spec §6).
 * Chỉ chạy khi CONSOLE_URL + EVENTS_APP_KEY được set:
 *   CONSOLE_URL=http://localhost:3000 EVENTS_APP_KEY=... pnpm -F @repo/game-kit exec vitest run contract
 * Queue xả sạch = server 200 accepted (FlushLoop chỉ removeByIds sau 200).
 */
import { emit, flushNow, initTracking, resetForTest } from './track';
import type { QueuedEvent, StorageAdapter } from './types';
import { STORAGE_KEY } from './types';

const CONSOLE_URL = process.env['CONSOLE_URL'];
const APP_KEY = process.env['EVENTS_APP_KEY'];
const maybe = CONSOLE_URL && APP_KEY ? describe : describe.skip;

function fakeStorage(): StorageAdapter & { dump(): QueuedEvent[] } {
	const m = new Map<string, string>();
	return {
		get: (k) => m.get(k) ?? null,
		set: (k, v) => void m.set(k, v),
		dump: () => JSON.parse(m.get(STORAGE_KEY) ?? '[]') as QueuedEvent[],
	};
}

maybe('contract với Console thật', () => {
	afterEach(() => resetForTest());

	it('emit 3 event → flush → queue xả sạch (server nhận đủ)', async () => {
		const store = fakeStorage();
		initTracking({
			endpoint: `${CONSOLE_URL}/public/events`,
			appKey: APP_KEY as string,
			source: 'game',
			device: {
				device_id: `contract-${Date.now()}`,
				platform: 'android',
				app_version: '1.0.0',
				os_name: 'Android',
				os_version: '14',
				model: 'ContractRig',
				locale: 'vi-VN',
			},
			getNetworkState: () => 'wifi',
			storage: store,
		});
		emit('contract_check', {
			gameSlug: 'sandfall',
			levelId: 1,
			value: 42,
			payload: { probe: true },
		});
		emit('contract_check', { gameSlug: 'sandfall', levelId: 2 });
		emit('contract_check', { gameSlug: 'haredoku' });
		expect(store.dump()).toHaveLength(3);
		await flushNow();
		expect(store.dump()).toHaveLength(0); // 200 mới được xoá — bằng chứng server nhận
	});
});
