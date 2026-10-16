import type { RankView } from './rank-client';

/** Sàn `topPercent` mà Console trả về — trùng PERCENT_FLOOR phía server. */
export const TOP_PERCENT_FLOOR = 0.1;
/** Trong bao nhiêu hạng đầu thì con số hạng đọc hay hơn phần trăm. */
export const RANK_PREFERRED_TOP = 10;

/**
 * Nên hiện `#hạng` hay `TOP X%`? `topPercent` có sàn 0,1% nên ở đỉnh bảng hạng 1 và hạng 7
 * hiện giống nhau — lúc đó dùng con số hạng; giữa bảng "TOP 20%" đọc hay hơn "#976".
 */
export function preferRank(view: RankView): boolean {
	return view.rank <= RANK_PREFERRED_TOP || view.topPercent <= TOP_PERCENT_FLOOR;
}

/** Nhãn huy hiệu: `#hạng` hoặc `TOP x%`. Một chỗ duy nhất để đổi ngưỡng không lệch giữa các game. */
export function rankBadge(view: RankView): string {
	return preferRank(view) ? `#${view.rank}` : `TOP ${view.topPercent}%`;
}

/**
 * "Giỏi hơn X% người chơi" — mặt kia của `topPercent`. Làm tròn 1 chữ số: sàn 0,1 nên người
 * dẫn đầu ra 99,9 chứ không phải 100.
 */
export function betterThanPercent(view: RankView): number {
	return Math.round((100 - view.topPercent) * 10) / 10;
}

/** Ngăn nghìn bằng dấu chấm (vi-VN) tự làm: Hermes không chắc có ICU nên không dùng `toLocaleString('vi-VN')`. */
function groupVi(n: number): string {
	return String(Math.trunc(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

/** Dòng phụ dưới huy hiệu. `0` ⇒ rỗng: không vượt qua ai thì không có gì để khoe. */
export function beatenLabel(beaten: number, lang: 'vi' | 'en' = 'en'): string {
	if (!(beaten > 0)) return '';
	return lang === 'vi'
		? `Hơn ${groupVi(beaten)} người chơi`
		: `Beat ${beaten.toLocaleString('en-US')} players`;
}
