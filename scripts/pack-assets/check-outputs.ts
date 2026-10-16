import { existsSync, readFileSync } from 'node:fs';
import { PNG } from 'pngjs';
import type { OutputFile } from './types.ts';

/** Trả lý do lệch (rỗng = khớp). PNG so điểm ảnh, không so byte. */
export function diffOutput(file: OutputFile): string | null {
	if (!existsSync(file.path)) return 'thiếu file';
	const onDisk = readFileSync(file.path);
	if (!file.png) {
		return onDisk.toString('utf8') === file.contents.toString() ? null : 'nội dung khác';
	}
	const a = PNG.sync.read(onDisk);
	const b = PNG.sync.read(file.contents as Buffer);
	if (a.width !== b.width || a.height !== b.height) return 'kích thước khác';
	return a.data.equals(b.data) ? null : 'điểm ảnh khác';
}
