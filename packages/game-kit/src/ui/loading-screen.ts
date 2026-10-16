import type Phaser from 'phaser';
import { loadingDoneMessage, nowMs, postHostSignal } from '../platform/host-signal';
import { designView } from '../platform/nibi-host';
import { safeShiftUp } from '../platform/safe-area';
import { getGameSlug } from '../tracking/game-context';
import { destroyDeep } from './destroy-deep';
import { startKitConfig } from './kit-config-client';
import { profileLoader } from './load-profile';
import { LOADING_LOGO_KEY, queueDefaultLogo } from './loading-art';
import { currentCard, type GameCard, refreshGameCard } from './loading-card';
import { LoadingProgressBar } from './loading-progress-bar';
import { makeLoadingFoot, makeLoadingName, startTipRotation } from './loading-screen-text';
import { applyLoadingTheme, DEFAULT_BG, type LoadingTheme, loadingTheme } from './loading-theme';
import type { LoadingScreen } from './loading-types';
import { makeText, setDisplayText } from './widgets';

export type { LoadingScreen } from './loading-types';

const DEPTH = 100000;
const FADE_MS = 220;
const LOGO_W = 440;
/** Ô logo (600×451 → 440×331) + khoảng thở. */
const HERO_SLOT = 360;
/** Giống màn loading của portal: thanh cam #FF8B5C→#F0422A; rãnh theo màu nền. */
const BAR = { width: 560, height: 40, barColor: 0xf0422a, glowColor: 0xff8b5c };

/**
 * Màn loading dùng chung (Anh chốt 08/10): logo Nibble Verse đóng gói trong kit cho mọi game; tên, mô tả,
 * mẹo, màu nền lấy từ listing Console theo slug (`initGameShell`), lưu `localStorage` — lần mở sau hiện
 * ngay từ cache, đồng thời làm mới ngầm. Chưa có cache (lần mở đầu, kể cả offline) → thẻ chụp lúc build
 * (`listingSnapshot`); không có nốt → nền xám trung tính, không mẹo. Dùng trong
 * Boot: `create` gọi hàm này, xếp hàng phần nặng, `load.once('complete', () => ls.finish(() => start))`,
 * rồi `load.start()` (logo đứng đầu lượt tải đó).
 */
export function attachLoadingScreen(scene: Phaser.Scene): LoadingScreen {
	const v = designView(scene);
	const cx = v.x + v.width / 2;
	const root = scene.add.container(0, 0).setDepth(DEPTH);
	const attachedAt = nowMs();
	// Mọi game gắn màn loading ở Boot ⇒ đo luôn loader ở đây (ui/load-profile.ts).
	profileLoader(scene, getGameSlug() ?? 'unknown');
	const bg = scene.add.rectangle(cx, v.y + v.height / 2, v.width, v.height, DEFAULT_BG, 1);
	root.add(bg);

	// Chân màn: dòng mẹo né thanh home, % và thanh xếp ngược lên từ đó.
	const tipEdge = v.y + v.height - 70;
	const tipY = tipEdge - 30 - safeShiftUp(scene, tipEdge);
	const pctY = tipY - 54;
	const barY = pctY - 44;
	// Cụm trên: logo, tên, mô tả (tối đa 3 dòng), căn giữa khoảng từ mép trên tới thanh.
	const groupH = HERO_SLOT + 40 + 52 + 96;
	const top = (v.y + barY - 40) / 2 - groupH / 2;
	const heroY = top + HERO_SLOT / 2;
	const nameY = top + HERO_SLOT + 40;
	const slug = getGameSlug();
	const cachedCard = slug ? currentCard(slug) : null;
	let theme: LoadingTheme = loadingTheme(cachedCard?.bgColor);
	const hero = scene.add.image(cx, heroY, LOADING_LOGO_KEY).setVisible(false);
	const name = makeLoadingName(scene, cx, nameY, '', theme.text);
	const desc = makeText(scene, {
		x: cx,
		y: nameY + 52,
		text: '',
		size: 24,
		color: theme.sub,
		originY: 0,
	});
	desc.setWordWrapWidth(600, true).setMaxLines(3);
	root.add([hero, name, desc]);
	// Nổi nhẹ; repeat -1 không tự dừng khi destroy → destroyDeep kill tween.
	scene.tweens.add({
		targets: hero,
		y: heroY - 16,
		duration: 1600,
		ease: 'Sine.easeInOut',
		yoyo: true,
		repeat: -1,
	});

	const bar = new LoadingProgressBar(scene, cx, barY, { ...BAR, ...theme });
	root.add(bar.objects);
	const foot = makeLoadingFoot(
		scene,
		cx,
		{ pct: pctY, tip: tipY },
		{ text: theme.text, sub: theme.sub },
		'',
	);
	bar.onDisplay((p) => foot.pct.setText(`${Math.round(p * 100)}%`));
	root.add([foot.pct, foot.tip]);

	let alive = true;
	let finishing = false;
	let tips: readonly string[] = [];
	startTipRotation(
		scene,
		foot.tip,
		() => tips,
		() => alive && !finishing,
	);

	const showLogo = (): void => {
		if (!alive || !scene.textures.exists(LOADING_LOGO_KEY)) return;
		hero.setTexture(LOADING_LOGO_KEY);
		hero.setScale(LOGO_W / (hero.width || LOGO_W)).setVisible(true);
	};
	const showCard = (card: GameCard | null): void => {
		if (!alive || !card) return;
		setDisplayText(name, card.name);
		desc.setText(card.description);
		if (card.tips?.length) {
			tips = card.tips;
			if (!tips.includes(foot.tip.text)) foot.tip.setText(tips[0] ?? '');
		}
		const from = theme.bg;
		theme = loadingTheme(card.bgColor);
		// Thẻ từ cache áp ngay; thẻ Console về sau thì nền chuyển dần từ màu đang hiện (mặc định xám trung tính).
		applyLoadingTheme(
			theme,
			{ bg, name, desc, ...foot, bar },
			cardShown ? { scene, from } : undefined,
		);
		cardShown = true;
	};
	let cardShown = false;

	const logoDone = `filecomplete-image-${LOADING_LOGO_KEY}`;
	const onLogo = (): void => {
		scene.load.off(logoDone, onLogo);
		showLogo();
	};
	if (queueDefaultLogo(scene)) showLogo();
	else scene.load.on(logoDone, onLogo);
	if (slug) {
		showCard(cachedCard);
		// Màn đã đóng thì showCard bỏ qua: cache vẫn được lưu cho lần mở sau.
		void refreshGameCard(slug).then(showCard);
		void startKitConfig(); // song song với thẻ: cache nạp ngay, bản tươi cho lần mở sau
	}

	const setProgress = (p: number): void => bar.setTarget(p);
	const onUpdate = (_t: number, delta: number): void => bar.step(delta);
	const off = (): void => {
		alive = false;
		scene.load.off('progress', setProgress);
		scene.load.off(logoDone, onLogo);
		scene.events.off('update', onUpdate);
	};
	scene.load.on('progress', setProgress);
	scene.events.on('update', onUpdate);
	scene.events.once('shutdown', off);

	return {
		setProgress,
		finish(next) {
			if (finishing || !alive) return;
			finishing = true;
			// Launcher ghép mốc này vào dòng đo `play_timing` (platform/host-signal.ts).
			const doneAt = nowMs();
			postHostSignal(loadingDoneMessage((doneAt ?? 0) - (attachedAt ?? 0), doneAt));
			bar.snap(1);
			scene.tweens.add({
				targets: root,
				alpha: 0,
				delay: 120,
				duration: FADE_MS,
				onComplete: next,
			});
		},
		destroy() {
			off();
			if (root.active) destroyDeep(scene, root);
		},
	};
}
