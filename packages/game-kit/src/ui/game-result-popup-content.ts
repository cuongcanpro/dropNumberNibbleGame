import type Phaser from 'phaser';
import { RESULT_POS, type ResultView } from './result-layout';
import { FONT_BALOO_STACK } from './ui-fonts';
import { uiKey } from './ui-keys';
import { makeText } from './widgets';

type Obj = Phaser.GameObjects.Container;

export interface ResultContent {
	titleWin: Phaser.GameObjects.Image;
	titleGameOver: Phaser.GameObjects.Image;
	infoBig: Obj;
	infoChip: Obj;
	halo: Phaser.GameObjects.Image;
	bigLabel: Phaser.GameObjects.Text;
	bigNumber: Phaser.GameObjects.Text;
	curScore: Phaser.GameObjects.Text;
	yourScore: Phaser.GameObjects.Text;
	bestLine: Phaser.GameObjects.Text;
	/** Dòng nhỏ dưới khối số (`GameResultData.extraLine`). Nằm ngoài infoBig/infoChip để không phụ thuộc chế độ. */
	extraLine: Phaser.GameObjects.Text;
}

const SHADOW = { color: 'rgb(110, 110, 110)', offsetX: 2, offsetY: -2 };
const XY = (p: { x: number; y: number }): [number, number] => [p.x, p.y];
const r = (name: string) => uiKey('result', name);

/** Tiêu đề + hai khối thông tin (big number / chip). Mọi thứ ẩn sẵn, `applyResultView` bật đúng chế độ. */
export function buildResultContent(scene: Phaser.Scene, parent: Obj): ResultContent {
	const text = (o: Parameters<typeof makeText>[1]) =>
		makeText(scene, { font: FONT_BALOO_STACK, ...o });
	const P = RESULT_POS;

	const titleWin = scene.add.image(P.titleWin.x, P.titleWin.y, r('titlewin'));
	const titleGameOver = scene.add.image(P.titleGameOver.x, P.titleGameOver.y, r('titlegameover'));

	const halo = scene.add.image(P.halo.x, P.halo.y, r('bg_highlight'));
	const bigLabel = text({
		...P.bigLabel,
		text: 'Best Score',
		size: 50,
		color: '#FDD70E',
		shadow: SHADOW,
	});
	const bigNumber = text({
		...P.bigNumber,
		text: '0',
		size: 80,
		color: '#FFFC00',
		outline: { color: '#000000', px: 2 },
	});
	const infoBig = scene.add.container(0, 0);
	infoBig.add([halo, bigLabel, bigNumber]);

	// Best KHÔNG dùng ribbon "Best Score!" (art in sẵn chữ mừng): chỉ new best mới được mừng, còn lại là dòng trơn.
	const bestLine = text({ ...P.bestLine, text: 'Best: 0', size: 36, color: '#FFE62C' });
	const yourScore = text({
		...P.yourScore,
		text: 'Your Score',
		size: 40,
		color: '#0FDE17',
		shadow: SHADOW,
	});
	const curScore = text({
		...P.curScore,
		text: '0',
		size: 100,
		outline: { color: '#000000', px: 3 },
	});
	const infoChip = scene.add.container(0, 0);
	infoChip.add([bestLine, yourScore, curScore]);

	const extraLine = text({
		...P.extraBig,
		text: '',
		size: 36,
		color: '#FFE62C',
	});

	for (const o of [titleWin, titleGameOver, infoBig, infoChip, extraLine]) o.setVisible(false);
	parent.add([titleWin, titleGameOver, infoBig, infoChip, extraLine]);
	return {
		titleWin,
		titleGameOver,
		infoBig,
		infoChip,
		halo,
		bigLabel,
		bigNumber,
		curScore,
		yourScore,
		bestLine,
		extraLine,
	};
}

/**
 * `override` = game đã dựng phần của mình: `title` thay ribbon của kit, `info` thay (hoặc, `'none'`, bỏ) khối số.
 * Phần kit bị thay chỉ ẩn, không huỷ — layout bỏ qua mọi vật đang ẩn.
 */
export function applyResultView(
	c: ResultContent,
	v: ResultView,
	override: { title?: boolean; info?: boolean } = {},
): void {
	c.titleWin.setVisible(!override.title && v.title === 'win');
	c.titleGameOver.setVisible(!override.title && v.title === 'gameover');
	c.infoBig.setVisible(!override.info && v.info === 'big');
	c.infoChip.setVisible(!override.info && v.info === 'chip');
	const extra = override.info ? null : v.extraLine;
	c.extraLine.setText(extra ?? '');
	c.extraLine.setVisible(extra !== null);
	c.extraLine.setPosition(
		...(v.info === 'big' ? XY(RESULT_POS.extraBig) : XY(RESULT_POS.extraChip)),
	);
	c.bigLabel.setText(v.bigLabel);
	c.bigNumber.setText(v.bigNumber);
	c.curScore.setText(v.score);
	c.yourScore.setText(v.yourLabel);
	c.bestLine.setText(v.bestLine);
	// Halo chỉ là phần của khối mừng: lose / level-failed ("big" nhưng không halo) không được lấy nó.
	c.halo.setVisible(v.halo);
}
