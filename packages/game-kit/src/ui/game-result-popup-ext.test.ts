import type Phaser from 'phaser';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { FakeObject as FO } from './testing/fake-objects';

type Part = FO & Phaser.GameObjects.Container;

vi.mock('nibi', () => ({ primaryCanvas: { width: 720, height: 1280 } }));
vi.mock('../shell/share', () => ({ canShare: () => true }));
/** Bộ đo giả: mỗi vật lá cao `height` (mặc định 40), container cộng dồn y cha — để kiểm thứ tự/gap, không cần canvas. */
vi.mock('./result-bounds', () => {
	type N = {
		visible: boolean;
		y: number;
		height: number;
		kind: string;
		children: N[];
	};
	const rows = (o: N, off: number, out: number[]): void => {
		if (!o.visible) return;
		if (o.kind === 'container') {
			for (const c of o.children) rows(c, off + o.y, out);
			return;
		}
		const top = off + o.y;
		out.push(top, top + (o.height || 40));
	};
	return {
		measureCluster: () => (c: { objs: N[] }) => {
			const out: number[] = [];
			for (const o of c.objs) rows(o, 0, out);
			return out.length ? { minY: Math.min(...out), maxY: Math.max(...out) } : null;
		},
	};
});

const { BackKeyManager } = await import('../platform/back-key-manager');
const { GameResultPopup } = await import('./game-result-popup');
const { asScene, FakeScene, fake } = await import('./testing/fake-scene');
const { uiKey } = await import('./ui-keys');
const { RESULT_SCALE } = await import('./result-layout');

const rank = { rank: 7, topPercent: 20, beaten: 100 } as never;

function setup() {
	const scene = new FakeScene();
	const onReplay = vi.fn<() => void>();
	const popup = new GameResultPopup(asScene(scene), { onReplay, onShare: () => {} });
	/** Khối game dựng: container cao `h` (một con chữ nhật cao h). */
	const part = (h: number): Part => {
		const c = scene.add.container(0, 0);
		const r = scene.add.rectangle(0, 0, 100, h);
		r.height = h;
		c.add(r);
		return c as Part;
	};
	return { scene, popup, onReplay, part };
}
const tex = (scene: InstanceType<typeof FakeScene>, key: string) =>
	scene.byKind('image').find((i) => i.texture === uiKey('result', key));

/** Container giữa của popup (cha của ribbon kit). */
const centreOf = (scene: InstanceType<typeof FakeScene>): FO => {
	const parent = tex(scene, 'titlegameover')?.parent;
	if (!parent) throw new Error('chưa có popup');
	return parent;
};

describe('GameResultPopup — cụm + điểm mở rộng', () => {
	beforeEach(() => BackKeyManager.getInstance().clear());

	it('thứ tự dọc: title · hero · info · custom · rank · buttons, gap đúng', () => {
		const { scene, popup, part } = setup();
		const [title, hero, info, custom] = [part(100), part(100), part(100), part(100)];
		popup.show({ score: 1 }, { title, hero, info, custom });
		popup.applyRank(rank);
		const ys = [title, hero, info, custom].map((p) => p.y);
		const rankRoot = tex(scene, 'trophy_board')?.parent as FO;
		const btn = fake(popup.getReplayButton()?.root);
		const order = [...ys, rankRoot.y, btn.y];
		expect([...order].sort((a, b) => a - b)).toEqual(order);
		// gap theo design: hero-title 12, hero→info 44, info→custom 48, custom→rank 48
		const k = RESULT_SCALE;
		expect((hero.y - 0 - (title.y + 100)) * k).toBeCloseTo(12, 5);
		expect((info.y - (hero.y + 100)) * k).toBeCloseTo(44, 5);
		expect((custom.y - (info.y + 100)) * k).toBeCloseTo(48, 5);
		expect((rankRoot.y - (custom.y + 100)) * k).toBeCloseTo(48, 5);
	});

	it('title game thay ribbon kit; info "none" ẩn khối số; info part thay khối số', () => {
		const a = setup();
		a.popup.show({ score: 5, isNewBest: true }, { title: a.part(100), info: 'none' });
		expect(tex(a.scene, 'titlewin')?.visible).toBe(false);
		expect(a.scene.byKind('text').find((t) => t.text === 'Best Score')?.parent?.visible).toBe(
			false,
		);
		const b = setup();
		b.popup.show({ score: 5 }, { info: b.part(100) });
		expect(b.scene.byKind('text').find((t) => t.text === 'Your Score')?.parent?.visible).toBe(
			false,
		);
	});

	it('rank:false: không khối hạng và không chừa chỗ (nút cách cụm trước 56)', () => {
		const { scene, popup, part } = setup();
		const info = part(100);
		popup.show({ score: 1 }, { rank: false, info });
		popup.applyRank(rank);
		expect(tex(scene, 'trophy_board')?.parent?.visible).toBe(false);
		const btn = fake(popup.getReplayButton()?.root);
		const share = fake(popup.getShareButton()?.root);
		expect(share.y).toBe(btn.y);
		const btnTop = btn.y - 4.5; // mock đo y = mép trên; icon Replay nằm ở y -4.5 nên là vật cao nhất
		expect((btnTop - (info.y + 100)) * RESULT_SCALE).toBeCloseTo(56, 0);
	});

	it('hạng về null ⇒ xếp lại, nút dịch lên; hạng có lại ⇒ trả chỗ', () => {
		const { popup, part } = setup();
		popup.show({ score: 1 }, { info: part(100) });
		const btn = fake(popup.getReplayButton()?.root);
		const withRoom = btn.y;
		popup.applyRank(null);
		expect(btn.y).toBeLessThan(withRoom - 20);
		popup.applyRank(rank);
		expect(btn.y).toBeCloseTo(withRoom, 5);
	});

	it('nút phụ nằm dưới hàng chính, bấm ⇒ đóng rồi gọi onClick', () => {
		const { scene, popup, part } = setup();
		const onClick = vi.fn<() => void>();
		popup.show(
			{ clearedLevel: 3 },
			{ info: part(100), primaryLabel: 'Next', secondary: { label: 'Collection', onClick } },
		);
		const sec = popup.getSecondaryButton();
		const main = fake(popup.getReplayButton()?.root);
		expect(scene.texts()).toEqual(expect.arrayContaining(['Next', 'Collection']));
		expect(fake(sec?.root).y).toBeGreaterThan(main.y + 80);
		expect(fake(sec?.hit).texture).toBe(uiKey('setting', 'btnYellow'));
		fake(sec?.hit).tap();
		expect(onClick).not.toHaveBeenCalled();
		scene.advance(300);
		expect(onClick).toHaveBeenCalledOnce();
	});

	it('quá cao: gap co về 0.75 rồi thu cả popup (scale mục tiêu < RESULT_SCALE)', () => {
		const { scene, popup, part } = setup();
		popup.show({ score: 1 }, { custom: part(900) });
		popup.applyRank(rank);
		scene.advance(600);
		const centre = centreOf(scene);
		expect(centre.scale).toBeLessThan(RESULT_SCALE);
		expect(centre.scale).toBeGreaterThan(0.5);
	});

	it('vừa khung: scale mục tiêu đúng RESULT_SCALE', () => {
		const { scene, popup, part } = setup();
		popup.show({ score: 1 }, { custom: part(100) });
		scene.advance(600);
		expect(centreOf(scene).scale).toBeCloseTo(RESULT_SCALE, 5);
	});

	it('cả chồng căn giữa quanh gốc container', () => {
		const { popup, part } = setup();
		const [t, c] = [part(200), part(200)];
		popup.show({ score: 1 }, { title: t, custom: c, info: 'none', rank: false });
		const btn = fake(popup.getReplayButton()?.root);
		const top = t.y;
		const bottom = btn.y + 40;
		expect(top + bottom).toBeCloseTo(0, 3); // đối xứng quanh 0
	});
});
