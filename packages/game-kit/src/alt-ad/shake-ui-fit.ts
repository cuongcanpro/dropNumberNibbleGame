/**
 * Cỡ chữ lớn nhất ≤ `start` mà khối chữ cao ≤ `maxHeight`, co dần từng 2px tới `floor`.
 * `measure(size)` trả chiều cao thật sau khi wrap ở cỡ đó (Phaser Text đo lại ngay khi đổi cỡ).
 * Không vừa kể cả ở sàn thì trả sàn: chữ nhỏ vẫn đọc được, còn tràn thẻ thì không.
 */
export function fitFontSize(
	measure: (size: number) => number,
	maxHeight: number,
	start: number,
	floor: number,
): number {
	let size = start;
	while (size > floor && measure(size) > maxHeight) size -= 2;
	return Math.max(size, floor);
}
