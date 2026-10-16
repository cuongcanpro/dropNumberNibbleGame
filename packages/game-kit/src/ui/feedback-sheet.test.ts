import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('nibi', () => ({ primaryCanvas: { width: 720, height: 1280 } }));
const send = vi.fn<(i: unknown) => Promise<boolean>>();
vi.mock('../shell/feedback-client', () => ({ sendFeedback: (i: unknown) => send(i) }));

const { BackKeyManager } = await import('../platform/back-key-manager');
const { FEEDBACK_FAILED, FEEDBACK_REASONS, FEEDBACK_THANKS, submitFeedback } = await import(
	'./feedback-model'
);
const { FeedbackSheet } = await import('./feedback-sheet');
const { asScene, FakeScene, fake } = await import('./testing/fake-scene');

describe('submitFeedback', () => {
	it('true ⇒ Thanks!', async () => {
		send.mockResolvedValue(true);
		expect(await submitFeedback('g', 'Game bug', ' hi ')).toEqual({
			ok: true,
			message: FEEDBACK_THANKS,
		});
		expect(send).toHaveBeenCalledWith({ gameKey: 'g', reason: 'Game bug', text: 'hi' });
	});
	it('false hoặc ném ⇒ lỗi thật, không bao giờ Thanks!', async () => {
		send.mockResolvedValue(false);
		expect((await submitFeedback('g', 'r', '')).message).toBe(FEEDBACK_FAILED);
		send.mockRejectedValue(new Error('x'));
		expect(await submitFeedback('g', 'r', undefined)).toEqual({
			ok: false,
			message: FEEDBACK_FAILED,
		});
	});
});

const sendBtn = (scene: InstanceType<typeof FakeScene>) =>
	fake(
		scene
			.byKind('text')
			.find((t) => t.text === 'Send')
			?.parent?.children.find((c) => c.kind === 'image'),
	);

describe('FeedbackSheet', () => {
	beforeEach(() => {
		send.mockReset();
		BackKeyManager.getInstance().clear();
	});

	it('mỗi lý do là một chip tương tác ≥44px', () => {
		const scene = new FakeScene();
		FeedbackSheet.show(asScene(scene), { gameKey: 'g' });
		for (const r of FEEDBACK_REASONS) {
			expect(scene.texts()).toContain(r);
		}
		const chips = scene
			.byKind('rectangle')
			.filter((r) => r.interactive && r.height >= 44 && r.height < 200);
		expect(chips).toHaveLength(FEEDBACK_REASONS.length);
	});

	it('chưa chọn lý do: Send không gửi', async () => {
		const scene = new FakeScene();
		FeedbackSheet.show(asScene(scene), { gameKey: 'g' });
		sendBtn(scene).tap();
		await Promise.resolve();
		expect(send).not.toHaveBeenCalled();
	});

	it('gửi thành công: Thanks! + đóng + onClose', async () => {
		send.mockResolvedValue(true);
		const scene = new FakeScene();
		const onClose = vi.fn<() => void>();
		const sheet = FeedbackSheet.show(asScene(scene), { gameKey: 'g', onClose });
		sheet.select('Too hard');
		sendBtn(scene).tap();
		await vi.waitFor(() => expect(scene.texts()).toContain(FEEDBACK_THANKS));
		expect(send).toHaveBeenCalledWith({ gameKey: 'g', reason: 'Too hard', text: undefined });
		scene.advance(300);
		expect(onClose).toHaveBeenCalledOnce();
	});

	it('gửi thất bại: báo lỗi thật, KHÔNG Thanks!, giữ sheet để thử lại', async () => {
		send.mockResolvedValue(false);
		const scene = new FakeScene();
		const onClose = vi.fn<() => void>();
		const sheet = FeedbackSheet.show(asScene(scene), { gameKey: 'g', onClose });
		sheet.select('Other');
		sendBtn(scene).tap();
		await vi.waitFor(() => expect(scene.texts()).toContain(FEEDBACK_FAILED));
		expect(scene.texts()).not.toContain(FEEDBACK_THANKS);
		scene.advance(300);
		expect(onClose).not.toHaveBeenCalled();
		send.mockResolvedValue(true);
		sendBtn(scene).tap();
		await vi.waitFor(() => expect(send).toHaveBeenCalledTimes(2));
	});

	it('máy tiếng Việt: nút Gửi (Baloo, không Lilita thiếu glyph); tiếng Anh: Send', () => {
		vi.stubGlobal('navigator', { language: 'vi-VN' });
		const vn = new FakeScene();
		FeedbackSheet.show(asScene(vn), { gameKey: 'g' });
		expect(vn.texts()).toContain('Gửi');
		expect(vn.texts()).not.toContain('Send');
		vi.unstubAllGlobals();
		const en = new FakeScene();
		FeedbackSheet.show(asScene(en), { gameKey: 'g' });
		expect(en.texts()).toContain('Send');
	});

	it('back key đóng sheet', () => {
		const scene = new FakeScene();
		const onClose = vi.fn<() => void>();
		FeedbackSheet.show(asScene(scene), { gameKey: 'g', onClose });
		expect(BackKeyManager.getInstance().dispatch()).toBe(true);
		scene.advance(300);
		expect(onClose).toHaveBeenCalledOnce();
	});
});
