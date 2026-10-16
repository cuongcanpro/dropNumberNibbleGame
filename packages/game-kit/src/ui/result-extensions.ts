import type Phaser from 'phaser';

/** Phần do game tự dựng bằng `scene.add.*`; popup đưa vào container giữa, đo và xếp (không cần toạ độ y). */
export type ResultPart =
	| Phaser.GameObjects.Container
	| Phaser.GameObjects.Image
	| Phaser.GameObjects.Text;

export type SecondaryTexture = 'btnYellow' | 'btnBlue' | 'btnGreen' | 'btnRed';

/** Nút phụ có hàng riêng dưới hàng chính (vd bunnypack "Collection"). Bấm = đóng popup rồi gọi `onClick`. */
export interface ResultSecondaryButton {
	label: string;
	onClick: () => void;
	/** Mặc định `btnYellow`. */
	texture?: SecondaryTexture;
}

/**
 * Điểm mở rộng của popup, truyền ở `show(data, ext)`. Mọi phần là container/ảnh game dựng sẵn; kit chỉ đo và xếp
 * theo thứ tự cụm: title · hero · info · custom · rank · buttons (gap trong `result-stack.ts`).
 */
export interface ResultExtensions {
	/** Thay ribbon của kit bằng art của game (VICTORY chef, wordmark "Complete!", ribbon "Try Again"...). */
	title?: ResultPart;
	/** Ảnh nhân vật dưới tiêu đề, trên khối thông tin (haru-cats bunny, dog-escape dog). */
	hero?: ResultPart;
	/** Thay khối số của kit bằng nội dung game (pill "Level 7"); `'none'` = không khối số (foodie lose). */
	info?: ResultPart | 'none';
	/** Ô riêng giữa khối thông tin và hạng (card mở khoá, quiz, thẻ thưởng, dải chapter). */
	custom?: ResultPart;
	/** Nhãn nút chính của ván này (Next / Next Level / Continue); mặc định `replayLabel` rồi `Replay`. Console vẫn thắng. */
	primaryLabel?: string;
	secondary?: ResultSecondaryButton;
	/** `false` = không có khối hạng và không chừa chỗ (merge2248). */
	rank?: boolean;
}
