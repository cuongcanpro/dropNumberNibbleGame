// pnpm theme-layers [--check]
// Nướng các lớp art xám cho popup theo màu game (Setting/Exit/Feedback + popup lắc) từ ảnh GỐC trong
// packages/game-kit/art/theme-src. Tất định (cùng input ⇒ cùng byte); --check so với file đã commit.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import {
	DOT_EMPTY,
	DOT_FULL,
	ICON_LAYER,
	SHAKE_BOARD,
} from '../../packages/game-kit/src/ui/theme-layer-spec.ts';
import { decodePng } from '../pack-assets/png-io.ts';
import { type Img, toPng } from './image.ts';
import { splitSettingBoard, splitShakeBoard } from './split-board.ts';
import { grayLayer, splitResultBg, unbakeDot } from './split-other.ts';

const ROOT = resolve(import.meta.dirname, '../..');
const KIT = join(ROOT, 'packages/game-kit');
const SRC = join(KIT, 'art/theme-src');
const UI = join(KIT, 'assets/ui/setting');
const ALT = join(KIT, 'assets/alt-ad');

const read = (path: string): Img => decodePng(readFileSync(path), path);

/** Toàn bộ file sinh ra: đường dẫn tuyệt đối → PNG. */
export function buildLayerFiles(): Map<string, Buffer> {
	const out = new Map<string, Buffer>();
	const put = (dir: string, name: string, img: Img): void => {
		out.set(join(dir, `${name}.png`), toPng(img));
	};

	const setting = splitSettingBoard(read(join(SRC, 'board_setting.png')));
	put(UI, 'board_accent', setting.accent);
	put(UI, 'board_base', setting.base);
	for (const icon of ['iconsound', 'iconmusic', 'iconvibe']) {
		put(UI, `tint_${icon}`, grayLayer(read(join(UI, `${icon}.png`)), ICON_LAYER));
	}

	const shake = splitShakeBoard(read(join(SRC, 'mission_board.png')));
	const want = SHAKE_BOARD.baseBox;
	const got = shake.baseBox;
	if (got.x !== want.x || got.y !== want.y || got.w !== want.w || got.h !== want.h) {
		throw new Error(
			`SHAKE_BOARD.baseBox phải là ${JSON.stringify(got)} (đang ${JSON.stringify(want)})`,
		);
	}
	put(ALT, 'board_accent', shake.accent);
	put(ALT, 'board_base', shake.base);
	put(ALT, 'board_rabbit', shake.rabbit);

	const result = splitResultBg(read(join(SRC, 'resultBg.png')));
	// Tên `bg_*` có chủ ý: packer xếp theo key, ảnh lớn phải đứng TRƯỚC thì mới vừa một trang 2048.
	put(ALT, 'bg_paper', result.paper);
	put(ALT, 'bg_glow', result.glow);

	put(ALT, 'dot_full', grayLayer(unbakeDot(read(join(SRC, 'dot_full.png'))), DOT_FULL));
	put(ALT, 'dot_empty', grayLayer(unbakeDot(read(join(SRC, 'dot_empty.png'))), DOT_EMPTY));
	return out;
}

function main(): number {
	const check = process.argv.includes('--check');
	let stale = 0;
	for (const [path, bytes] of buildLayerFiles()) {
		const rel = relative(ROOT, path);
		if (check) {
			if (!existsSync(path) || !readFileSync(path).equals(bytes)) {
				stale++;
				console.error(`STALE ${rel}`);
			}
			continue;
		}
		mkdirSync(dirname(path), { recursive: true });
		writeFileSync(path, bytes);
		console.log(`wrote ${rel}`);
	}
	if (stale > 0) console.error('Chạy `pnpm theme-layers` rồi commit.');
	return stale > 0 ? 1 : 0;
}

if (import.meta.main) process.exit(main());
