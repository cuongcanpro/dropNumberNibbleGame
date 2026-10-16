import { sendFeedback } from '../shell/feedback-client';

/** Lý do cố định (EN) — native chưa chắc có text input nên chip là đường chính (quyết định của Anh). */
export const FEEDBACK_REASONS: readonly string[] = [
	'Game bug',
	'Too hard',
	'Too easy',
	'Controls feel off',
	'Slow or laggy',
	'Idea or request',
	'Other',
];

export const FEEDBACK_THANKS = 'Thanks!';
export const FEEDBACK_FAILED = "Couldn't send. Try again later.";

export interface FeedbackOutcome {
	ok: boolean;
	/** Chuỗi hiện cho người chơi: "Thanks!" CHỈ khi gửi thật sự thành công. */
	message: string;
}

/**
 * Gửi góp ý. `sendFeedback` trả `false` khi offline/endpoint chưa có (hiện Server chưa có
 * `POST /public/feedback`) ⇒ báo lỗi thật, không bao giờ giả "đã gửi". `send` tiêm được để test.
 */
export async function submitFeedback(
	gameKey: string,
	reason: string,
	text: string | undefined,
	send: typeof sendFeedback = sendFeedback,
): Promise<FeedbackOutcome> {
	let ok = false;
	try {
		ok = await send({ gameKey, reason, text: text?.trim() || undefined });
	} catch {
		ok = false;
	}
	return { ok, message: ok ? FEEDBACK_THANKS : FEEDBACK_FAILED };
}

/** Chữ cố định của sheet theo ngôn ngữ máy (lý do chip do Console cấp nên không nằm ở đây). */
export const FEEDBACK_TEXT = {
	en: { placeholder: 'Add a note (optional)', send: 'Send' },
	vi: { placeholder: 'Thêm ghi chú (tuỳ chọn)', send: 'Gửi' },
} as const;
