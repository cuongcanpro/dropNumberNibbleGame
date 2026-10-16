import { afterEach, describe, expect, it } from 'vitest';
import { createMetricSink } from '../metrics/metric-sink-adapter';
import { createTrackingRig, resetTrackingForTest } from '../testing/tracking-rig';
import { setGameMode, setGameSlug } from './game-context';
import { emit, flushNow } from './track';
import { SDK_VERSION } from './types';

/**
 * Mirror luật Server — nếu Server đổi, sửa Ở ĐÂY và ở SDK:
 *   Server/src/public-events/validate-event.ts  (validateEvent, từng event)
 *   Server/src/public-events/events-batch.dto.ts (envelope: DeviceDto + EventsBatchDto)
 * Chạy trên batch THẬT do FlushLoop sinh (fetch giả bắt body), không phải fixture tay.
 */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_MODE_LEN = 32;
const FUTURE_TOLERANCE_MS = 24 * 3600_000;

function validateEvent(e: Record<string, unknown>, nowMs: number): string | null {
	for (const f of ['event_id', 'ts', 'session_id', 'action', 'network_state']) {
		if (typeof e[f] !== 'string' || e[f] === '') return 'MISSING_FIELD';
	}
	if (!UUID_RE.test(e['event_id'] as string)) return 'BAD_EVENT_ID';
	const ts = Date.parse(e['ts'] as string);
	if (Number.isNaN(ts) || ts > nowMs + FUTURE_TOLERANCE_MS) return 'BAD_TS';
	if (e['source'] !== 'game' && e['source'] !== 'portal') return 'BAD_SOURCE';
	if (typeof e['seq_no'] !== 'number' || e['seq_no'] < 0) return 'BAD_SEQ';
	if (typeof e['payload'] !== 'string') return 'BAD_PAYLOAD';
	const rawMode = e['mode'];
	if (rawMode !== undefined && rawMode !== null && typeof rawMode !== 'string') return 'BAD_MODE';
	const mode = typeof rawMode === 'string' ? rawMode.trim().toLowerCase() : '';
	if (mode.length > MAX_MODE_LEN) return 'BAD_MODE';
	// SDK còn phải gửi mode ĐÃ chuẩn hoá (server lowercase hộ, nhưng đừng dựa vào).
	if (typeof rawMode === 'string' && rawMode !== mode) return 'MODE_NOT_NORMALIZED';
	// Các trường số tuỳ chọn: nếu có phải là number (server lưu cột số).
	for (const f of ['level_id', 'duration_ms', 'value']) {
		if (e[f] !== undefined && e[f] !== null && typeof e[f] !== 'number') return `BAD_${f}`;
	}
	return null;
}

function validateEnvelope(b: Record<string, unknown>): string | null {
	if (typeof b['batch_id'] !== 'string') return 'batch_id';
	if (typeof b['sent_ts'] !== 'string') return 'sent_ts';
	if (b['user_id'] !== undefined && typeof b['user_id'] !== 'string') return 'user_id';
	const d = b['device'] as Record<string, unknown> | undefined;
	if (!d || typeof d !== 'object') return 'device';
	for (const f of [
		'device_id',
		'platform',
		'app_version',
		'sdk_version',
		'os_name',
		'os_version',
		'model',
		'locale',
	]) {
		if (typeof d[f] !== 'string') return `device.${f}`;
	}
	if (d['market'] !== undefined && typeof d['market'] !== 'string') return 'device.market';
	if (!Number.isInteger(d['tz_offset_min'])) return 'device.tz_offset_min';
	if (!Array.isArray(b['events'])) return 'events';
	if (b['events'].length > 500) return 'events>500';
	return null;
}

afterEach(() => resetTrackingForTest());

describe('server-contract — batch thật từ FlushLoop pass luật Server', () => {
	it('envelope + mọi event hợp lệ, kể cả event có level/duration/value/mode', async () => {
		const rig = createTrackingRig();
		setGameSlug('block-blast');
		setGameMode('  Adventure ');
		const sink = createMetricSink();
		sink.gameLevelStart(3, { attemptNumber: 1 });
		sink.gameLevelComplete(3, { durationSec: 12.5, gameData: { stars: 3 } });
		sink.gameScoreEnd({ score: 900, durationSec: 60, isPersonalBest: true });
		sink.altAd('offered', { taskType: 'revive' });
		sink.gameCustomEvent(-1, 'combo', { n: 2 });
		emit('session_start');
		await flushNow();

		expect(rig.sent.length).toBeGreaterThan(0);
		const batch = rig.sent[0]!;
		expect(batch.headers['X-App-Key']).toBe('k');
		expect(validateEnvelope(batch.body)).toBeNull();
		const events = rig.sent.flatMap((s) => s.body.events);
		expect(events).toHaveLength(6);
		for (const e of events) expect(validateEvent(e, rig.clock.t)).toBeNull();
		expect(events.every((e) => typeof e['payload'] === 'string')).toBe(true);
		const complete = events.find((e) => e['action'] === 'game_level_complete')!;
		expect(complete['mode']).toBe('adventure');
		expect(complete['duration_ms']).toBe(12500);
		expect(complete['game_slug']).toBe('block-blast');
	});

	it('device có đủ field + build_commit, tz_offset_min là số nguyên', async () => {
		const rig = createTrackingRig();
		emit('a');
		await flushNow();
		const d = rig.sent[0]!.body['device'] as Record<string, unknown>;
		expect(d).toMatchObject({
			device_id: 'dev-1',
			platform: 'nibi-android',
			app_version: '1.2.3',
			build_commit: 'abc1234',
			sdk_version: SDK_VERSION,
		});
		expect(Number.isInteger(d['tz_offset_min'])).toBe(true);
	});

	it('mode > 32 ký tự bị cắt về 32 — không bị server loại cả event (BAD_MODE)', async () => {
		const rig = createTrackingRig();
		emit('a', { mode: 'x'.repeat(50) });
		await flushNow();
		const e = rig.sent[0]!.body.events[0]!;
		expect((e['mode'] as string).length).toBe(32);
		expect(validateEvent(e, rig.clock.t)).toBeNull();
	});

	it('batch ≤ 500 event/lần gửi (DTO ArrayMaxSize)', async () => {
		const rig = createTrackingRig();
		for (let i = 0; i < 501; i++) emit(`a${i % 3}`);
		await flushNow();
		await flushNow();
		expect(rig.sent.length).toBeGreaterThanOrEqual(2);
		for (const s of rig.sent) expect(validateEnvelope(s.body)).toBeNull();
		expect(rig.sent.flatMap((s) => s.body.events)).toHaveLength(501);
		for (const s of rig.sent) expect(s.body.events.length).toBeLessThanOrEqual(500);
	});

	it('bắt được vi phạm (self-check của mirror)', () => {
		const base = { event_id: 'x', ts: 't', session_id: 's', action: 'a', network_state: 'wifi' };
		expect(validateEvent({ ...base }, 0)).toBe('BAD_EVENT_ID');
		const ok = {
			...base,
			event_id: '00000000-0000-4000-8000-000000000000',
			ts: new Date(0).toISOString(),
			source: 'game',
			seq_no: 1,
			payload: '{}',
		};
		expect(validateEvent(ok, 0)).toBeNull();
		expect(validateEvent({ ...ok, payload: {} }, 0)).toBe('BAD_PAYLOAD');
		expect(validateEvent({ ...ok, mode: 'x'.repeat(33) }, 0)).toBe('BAD_MODE');
	});
});
