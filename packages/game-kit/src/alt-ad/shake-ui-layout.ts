// Dựng cây GameObject của ShakeUi (toạ độ Cocos y-lên đã đảo dấu sang Phaser y-xuống).
import type Phaser from 'phaser';
import { designView } from '../platform/nibi-host';
import { deviceLang } from '../ui/kit-config-client';
import { SHAKE_BOARD } from '../ui/theme-layer-spec';
import { FONT_LILITA_STACK } from '../ui/ui-fonts';
import { makeText } from '../ui/widgets';
import { KEYS } from './assets';
import type { ShakeTheme } from './shake-theme';

export interface ShakeLayoutOptions {
	font: string;
	maxShakes: number;
	subtitle: string;
	scale: number;
	depth: number;
	theme: ShakeTheme;
	onClose: () => void;
	onTap: () => void;
}

export interface ShakeLayout {
	root: Phaser.GameObjects.Container;
	centre: Phaser.GameObjects.Container;
	cookie: Phaser.GameObjects.Image;
	dots: Phaser.GameObjects.Image[];
	subtitle: Phaser.GameObjects.Text;
	tapButton: Phaser.GameObjects.Container;
}

export function buildShakeLayout(scene: Phaser.Scene, o: ShakeLayoutOptions): ShakeLayout {
	const view = designView(scene);
	const cx = view.x + view.width / 2;
	const cy = view.y + view.height / 2;
	const root = scene.add.container(0, 0).setDepth(o.depth);
	// Rect dim phủ đúng vùng camera nhìn thấy (kể cả letterbox) và nuốt touch phía sau.
	const dim = scene.add.rectangle(cx, cy, view.width, view.height, 0x000000, 150 / 255);
	dim.setInteractive();
	root.add(dim);
	const centre = scene.add.container(cx, cy).setScale(o.scale);
	root.add(centre);

	centre.add(buildBoard(scene, o.theme));
	const subtitle = scene.add
		.text(0, 220, o.subtitle, {
			fontFamily: o.font,
			fontSize: '35px',
			color: o.theme.hint,
			align: 'center',
			wordWrap: { width: 600 },
		})
		.setOrigin(0.5);
	centre.add(subtitle);
	const cookie = scene.add.image(0, -30, KEYS.cookies[0]);
	centre.add(cookie);

	const dots: Phaser.GameObjects.Image[] = [];
	for (let i = 0; i < o.maxShakes; i++) {
		const dot = scene.add
			.image(-((o.maxShakes - 1) * 70) / 2 + i * 70, -250, KEYS.dotEmpty)
			.setTint(o.theme.dotEmpty);
		dots.push(dot);
		centre.add(dot);
	}

	const close = scene.add.image(245, -375, KEYS.close).setInteractive({ useHandCursor: true });
	close.on('pointerup', o.onClose);
	centre.add(close);

	const tapButton = scene.add.container(0, 320).setVisible(false).setAlpha(0);
	const tapBg = scene.add.image(0, 0, KEYS.button);
	const tapText = scene.add
		.text(0, 0, 'Tap!', { fontFamily: o.font, fontSize: '32px', color: '#17884a' })
		.setOrigin(0.5);
	tapButton.add([tapBg, tapText]);
	tapBg.setInteractive({ useHandCursor: true }).on('pointerup', o.onTap);
	centre.add(tapButton);

	return { root, centre, cookie, dots, subtitle, tapButton };
}

const BOARD_Y = -44.33;
/** Chữ nướng sẵn "MISSION" đã bị xoá khỏi art; vi/en theo ngôn ngữ máy như phần còn lại của kit. */
const BOARD_TITLE = { en: 'MISSION', vi: 'NHIỆM VỤ' } as const;
const TITLE_SIZE = 64;
// Chữ trắng viền theo màu game: đồng bộ title Setting/Exit/Feedback (Anh duyệt 12/10).
const TITLE_COLOR = '#FFFFFF';
const TITLE_OUTLINE_PX = 4;

/** Bảng 3 lớp: accent (cả hình) → base (thân, nineslice) → thỏ (giữ màu gốc); chữ tiêu đề là Text thật. */
function buildBoard(scene: Phaser.Scene, theme: ShakeTheme): Phaser.GameObjects.Container {
	const { width, height } = SHAKE_BOARD;
	const at = (b: { x: number; y: number; w: number; h: number }) => ({
		x: b.x + b.w / 2 - width / 2,
		y: b.y + b.h / 2 - height / 2,
	});
	const bb = SHAKE_BOARD.baseBox;
	const sl = SHAKE_BOARD.baseSlice;
	const base = at(bb);
	const rabbit = at(SHAKE_BOARD.rabbit);
	const board = scene.add.container(0, BOARD_Y);
	board.add([
		scene.add.image(0, 0, KEYS.boardAccent).setTint(theme.accent),
		scene.add
			.nineslice(base.x, base.y, KEYS.boardBase, undefined, bb.w, bb.h, sl, sl, sl, sl)
			.setTint(theme.base),
		scene.add.image(rabbit.x, rabbit.y, KEYS.boardRabbit),
		makeText(scene, {
			...SHAKE_BOARD.titleAt,
			text: BOARD_TITLE[deviceLang()],
			size: TITLE_SIZE,
			font: FONT_LILITA_STACK,
			color: TITLE_COLOR,
			outline: { color: theme.titleOutline, px: TITLE_OUTLINE_PX },
		}),
	]);
	return board;
}
