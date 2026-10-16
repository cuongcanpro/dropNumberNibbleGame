/**
 * Mép dọc tường minh cho phần game dựng (`ResultPart`) khi art có viền trong suốt: kit đo bằng khung (không đọc pixel,
 * để web và Nibi native ra CÙNG số), nên game báo mép nhìn thấy thật. Toạ độ theo hệ của chính vật (y=0 là origin của nó).
 */
export interface LayoutRows {
	top: number;
	bottom: number;
}

const rows = new WeakMap<object, LayoutRows>();

/** Đặt mép nhìn thấy của `part`; trả lại chính `part` để viết một dòng. */
export function setLayoutBounds<T extends object>(part: T, top: number, bottom: number): T {
	rows.set(part, { top, bottom });
	return part;
}

export function getLayoutBounds(part: object): LayoutRows | undefined {
	return rows.get(part);
}
