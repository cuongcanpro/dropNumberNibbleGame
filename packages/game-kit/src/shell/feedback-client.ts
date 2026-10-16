import { publicUrl } from '../tracking/public-url';
import { trackingConfig } from '../tracking/track';

/**
 * Gửi góp ý tới `POST {base}/public/feedback` (Server đã có endpoint). Trả `false` khi SDK tắt, offline,
 * non-2xx hoặc timeout; UI phải báo lỗi thật, không giả "đã gửi".
 */
export interface FeedbackInput {
	gameKey: string;
	text?: string | undefined;
	reason?: string | undefined;
}

export const FEEDBACK_TIMEOUT_MS = 5000;
// Server không tin DOM maxLength: cắt cứng ở client để payload không phình.
export const FEEDBACK_TEXT_MAX = 500;
export const FEEDBACK_REASON_MAX = 64;

/** Không bao giờ ném. false khi SDK tắt / offline / non-2xx / timeout / lỗi mạng. */
export async function sendFeedback(input: FeedbackInput): Promise<boolean> {
	let timer: ReturnType<typeof setTimeout> | undefined;
	try {
		const cfg = trackingConfig();
		if (!cfg || cfg.getNetworkState() === 'offline') return false;
		const url = publicUrl(cfg.endpoint, 'feedback');
		if (!url) return false;
		const req = (cfg.fetchFn ?? fetch)(url, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', 'X-App-Key': cfg.appKey },
			body: JSON.stringify({
				deviceId: cfg.device.device_id,
				gameKey: input.gameKey,
				text: (input.text ?? '').slice(0, FEEDBACK_TEXT_MAX),
				reason: (input.reason ?? '').slice(0, FEEDBACK_REASON_MAX),
				appVersion: cfg.device.app_version,
			}),
		});
		req.catch(() => undefined);
		const timeout = new Promise<null>((resolve) => {
			timer = setTimeout(() => resolve(null), FEEDBACK_TIMEOUT_MS);
		});
		const res = await Promise.race([req, timeout]);
		return res !== null && res.ok;
	} catch {
		return false;
	} finally {
		if (timer !== undefined) clearTimeout(timer);
	}
}
