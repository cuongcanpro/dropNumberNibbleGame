import { afterEach, describe, expect, it, vi } from 'vitest';
import { Logger, LogLevel } from './logger';

describe('Logger', () => {
	afterEach(() => {
		Logger.setGlobalLevel(LogLevel.INFO);
		vi.restoreAllMocks();
	});

	it('DEBUG bị chặn ở mức INFO, ERROR luôn qua', () => {
		const debug = vi.spyOn(console, 'debug').mockImplementation(() => {});
		const error = vi.spyOn(console, 'error').mockImplementation(() => {});
		const log = new Logger('T');
		log.debug('d');
		log.error('e', { k: 1 });
		expect(debug).not.toHaveBeenCalled();
		expect(error).toHaveBeenCalledWith('[T] e', { k: 1 });
	});

	it('hạ mức toàn cục xuống DEBUG thì debug in ra kèm tag', () => {
		const debug = vi.spyOn(console, 'debug').mockImplementation(() => {});
		Logger.setGlobalLevel(LogLevel.DEBUG);
		new Logger('T').debug('d');
		expect(debug).toHaveBeenCalledWith('[T] d');
	});

	it('mức riêng của instance nâng ngưỡng lên', () => {
		const info = vi.spyOn(console, 'info').mockImplementation(() => {});
		new Logger('T', LogLevel.WARN).info('i');
		expect(info).not.toHaveBeenCalled();
	});
});
