/** Mức log theo kiểu const object (không dùng enum). Giá trị y Cocos `core/logger`. */
export const LogLevel = { DEBUG: 0, INFO: 1, WARN: 2, ERROR: 3 } as const;
export type LogLevel = (typeof LogLevel)[keyof typeof LogLevel];

let globalLevel: LogLevel = LogLevel.INFO;

/**
 * `new Logger(tag)` như Cocos. DEBUG tắt mặc định vì core puzzle gọi trên hot path.
 * Mức hiệu lực = max(mức toàn cục, mức riêng của instance).
 */
export class Logger {
	private readonly tag: string;
	private readonly minLevel: LogLevel;

	constructor(tag = 'default', minLevel: LogLevel = LogLevel.DEBUG) {
		this.tag = tag;
		this.minLevel = minLevel;
	}

	static setGlobalLevel(level: LogLevel): void {
		globalLevel = level;
	}

	static getGlobalLevel(): LogLevel {
		return globalLevel;
	}

	debug(message: string, data?: unknown): void {
		this.emit(LogLevel.DEBUG, console.debug, message, data);
	}

	info(message: string, data?: unknown): void {
		this.emit(LogLevel.INFO, console.info, message, data);
	}

	warn(message: string, data?: unknown): void {
		this.emit(LogLevel.WARN, console.warn, message, data);
	}

	error(message: string, data?: unknown): void {
		this.emit(LogLevel.ERROR, console.error, message, data);
	}

	private emit(
		level: LogLevel,
		sink: (...args: unknown[]) => void,
		message: string,
		data: unknown,
	): void {
		if (level < globalLevel || level < this.minLevel) return;
		const line = `[${this.tag}] ${message}`;
		if (data === undefined) sink(line);
		else sink(line, data);
	}
}
