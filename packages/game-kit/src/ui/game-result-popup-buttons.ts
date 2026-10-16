import type Phaser from 'phaser';
import { BTN } from './game-result-popup-entrance';
import type { ResultSecondaryButton } from './result-extensions';
import { RESULT_POS } from './result-layout';
import { FONT_BALOO_STACK } from './ui-fonts';
import { uiKey } from './ui-keys';
import { makeButton, type UiButton } from './widgets';

const OUTLINE = {
	btnBlue: '#1A538F',
	btnGreen: '#1C7500',
	btnYellow: '#9A5A00',
	btnRed: '#A2312E',
} as const;

export interface ResultButtons {
	share: UiButton | null;
	primary: UiButton;
	secondary: UiButton | null;
	/** Mọi nút theo thứ tự hiện (cho entrance); container hàng nút = `all` để layout dời cả cụm. */
	all: UiButton[];
}

export interface ButtonSpec {
	showShare: boolean;
	primaryLabel: string;
	secondary?: ResultSecondaryButton | undefined;
	onShare: () => void;
	onPrimary: () => void;
	onSecondary: () => void;
}

/** Hàng nút: Share (nếu có) + nút chính, hàng riêng bên dưới cho nút phụ. Không có Home. */
export function buildResultButtons(
	scene: Phaser.Scene,
	parent: Phaser.GameObjects.Container,
	spec: ButtonSpec,
): ResultButtons {
	const P = RESULT_POS;
	const make = (
		pos: { x: number; y: number },
		texture: keyof typeof OUTLINE,
		text: string,
		onClick: () => void,
		icon = false,
	) =>
		makeButton(scene, {
			...pos,
			...BTN,
			texture: uiKey('setting', texture),
			label: {
				text,
				size: 40,
				font: FONT_BALOO_STACK,
				outline: { color: OUTLINE[texture], px: 2 },
				x: icon ? 20 : 0,
				y: -2,
			},
			...(icon ? { icon: { texture: uiKey('setting', 'iconPlay'), x: -74, y: -4.5 } } : {}),
			onClick,
		});

	const share = spec.showShare ? make(P.share, 'btnBlue', 'Share', spec.onShare) : null;
	const primary = make(
		share ? P.replay : P.replayAlone,
		'btnGreen',
		spec.primaryLabel,
		spec.onPrimary,
		spec.primaryLabel === 'Replay',
	);
	const sec = spec.secondary;
	const secondary = sec
		? make(P.secondary, sec.texture ?? 'btnYellow', sec.label, spec.onSecondary)
		: null;
	const all = [share, primary, secondary].filter((b): b is UiButton => b !== null);
	for (const b of all) parent.add(b.root);
	return { share, primary, secondary, all };
}
