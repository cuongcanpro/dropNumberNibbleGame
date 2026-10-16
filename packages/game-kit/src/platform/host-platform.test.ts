import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// `host` của nibi ngoài Launcher là no-op; test dùng Launcher giả truyền thẳng vào.
vi.mock('nibi', () => ({
	host: { addEventListener() {}, postMessage() {}, removeEventListener() {} },
}));

import {
	createHostPlatform,
	type HostPort,
	PLATFORM_CALL,
	PLATFORM_HELLO,
	PLATFORM_HELLO_REQUEST,
	PLATFORM_RESULT,
} from './host-platform';

type Listener = (event: { data: unknown; type: 'message' }) => void;

function fakeLauncher() {
	const listeners = new Set<Listener>();
	const sent: Record<string, unknown>[] = [];
	const port: HostPort = {
		addEventListener: (_type, listener) => listeners.add(listener),
		postMessage: (data) => sent.push(data as Record<string, unknown>),
		removeEventListener: (_type, listener) => listeners.delete(listener),
	};
	const deliver = (data: unknown) => {
		for (const listener of listeners) listener({ data, type: 'message' });
	};
	const hello = (methods: string[]) => deliver({ methods, type: PLATFORM_HELLO, version: 1 });
	const calls = () => sent.filter((message) => message.type === PLATFORM_CALL);
	const answer = (value: unknown) => {
		const last = calls().at(-1);
		deliver({ id: last?.id, ok: true, type: PLATFORM_RESULT, value });
	};
	return { answer, calls, deliver, hello, port, sent };
}

describe('createHostPlatform', () => {
	beforeEach(() => vi.useFakeTimers());
	afterEach(() => {
		vi.useRealTimers();
		vi.unstubAllGlobals();
	});

	it('says hello once, then calls the launcher and resolves with its value', async () => {
		const launcher = fakeLauncher();
		const platform = createHostPlatform(launcher.port);
		const pending = platform.call('battery');
		expect(launcher.sent).toEqual([{ type: PLATFORM_HELLO_REQUEST }]);
		launcher.hello(['battery', 'haptic']);
		await vi.advanceTimersByTimeAsync(0);
		expect(launcher.calls()).toEqual([
			{ args: {}, id: 'p1', method: 'battery', type: PLATFORM_CALL },
		]);
		launcher.answer({ charging: true, level: 80 });
		await expect(pending).resolves.toEqual({ charging: true, level: 80 });
		platform.call('battery');
		expect(launcher.sent.filter((m) => m.type === PLATFORM_HELLO_REQUEST)).toHaveLength(1);
	});

	it('takes the hello the launcher sends on ready, before anything is called', () => {
		const launcher = fakeLauncher();
		const platform = createHostPlatform(launcher.port);
		expect(platform.supportsNow('haptic')).toBe(false);
		launcher.hello(['haptic']);
		expect(platform.supportsNow('haptic')).toBe(true);
		expect(platform.hapticNow(2)).toBe(true);
		expect(launcher.calls()).toEqual([
			{ args: { type: 2 }, id: 'p1', method: 'haptic', type: PLATFORM_CALL },
		]);
	});

	it('is UNSUPPORTED without a launcher answer (web, sim, older portal builds)', async () => {
		const platform = createHostPlatform(fakeLauncher().port, { helloTimeoutMs: 500 });
		const failed = platform.call('battery').catch((error: unknown) => error);
		await vi.advanceTimersByTimeAsync(500);
		expect(await failed).toMatchObject({ code: 'UNSUPPORTED' });
		expect(platform.hapticNow(0)).toBe(false);
	});

	it('is UNSUPPORTED at once for a method the launcher did not list', async () => {
		const launcher = fakeLauncher();
		const platform = createHostPlatform(launcher.port);
		launcher.hello(['battery']);
		await expect(platform.call('share', { message: 'x' })).rejects.toMatchObject({
			code: 'UNSUPPORTED',
		});
		expect(launcher.calls()).toEqual([]);
	});

	it('rejects with the launcher error code, and TIMEOUT when no result comes', async () => {
		const launcher = fakeLauncher();
		const platform = createHostPlatform(launcher.port, { callTimeoutMs: 1_000 });
		launcher.hello(['share', 'battery']);
		const busy = platform.call('share', { message: 'x' });
		launcher.deliver({
			error: { code: 'BUSY', message: 'another system sheet is open' },
			id: 'p1',
			ok: false,
			type: PLATFORM_RESULT,
		});
		await expect(busy).rejects.toMatchObject({ code: 'BUSY' });
		const silent = platform.call('battery').catch((error: unknown) => error);
		await vi.advanceTimersByTimeAsync(1_000);
		expect(await silent).toMatchObject({ code: 'TIMEOUT' });
	});

	it('ignores results for other ids and messages that are not its own', async () => {
		const launcher = fakeLauncher();
		const platform = createHostPlatform(launcher.port);
		launcher.hello(['language']);
		const pending = platform.call('language');
		launcher.deliver({ id: 'p9', ok: true, type: PLATFORM_RESULT, value: 'en' });
		launcher.deliver({ type: 'nv.identity.v1', userId: '1' });
		launcher.deliver('noise');
		launcher.answer('vi');
		await expect(pending).resolves.toBe('vi');
	});

	it('falls back to web APIs when the launcher cannot help', async () => {
		const writeText = vi.fn<(text: string) => Promise<void>>(async () => undefined);
		vi.stubGlobal('navigator', {
			clipboard: { writeText },
			language: 'vi-VN',
			userAgent:
				'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko)',
		});
		const platform = createHostPlatform(fakeLauncher().port, { helloTimeoutMs: 100 });
		const copied = platform.copyToClipboard('ROOM-42');
		const info = platform.deviceInfo();
		await vi.advanceTimersByTimeAsync(100);
		await expect(copied).resolves.toBe(true);
		expect(writeText).toHaveBeenCalledWith('ROOM-42');
		await expect(info).resolves.toMatchObject({
			country: '',
			language: 'vi',
			model: 'iPhone',
			osName: 'iOS',
			osVersion: '17.4',
			totalMemoryMb: -1,
		});
	});

	it('uses the launcher for typed helpers when it answers', async () => {
		const launcher = fakeLauncher();
		const platform = createHostPlatform(launcher.port);
		launcher.hello(['scheduleNotification']);
		const at = Date.now() + 60_000;
		const scheduled = platform.scheduleNotification({ at, body: 'Mèo đang đói!' });
		await vi.advanceTimersByTimeAsync(0);
		expect(launcher.calls().at(-1)).toMatchObject({
			args: { at, body: 'Mèo đang đói!' },
			method: 'scheduleNotification',
		});
		launcher.answer(true);
		await expect(scheduled).resolves.toBe(true);
	});
});
