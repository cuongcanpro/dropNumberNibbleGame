/**
 * `/public/events` → `/public/<path>`. Không khớp dạng ⇒ null, không đoán.
 * Dùng chung với feedback: một nguồn endpoint (trackingConfig), không hằng thứ hai.
 */
export function publicUrl(endpoint: string, path: string): string | null {
	const url = endpoint.replace(/\/events\/?$/, `/${path}`);
	return url === endpoint ? null : url;
}
