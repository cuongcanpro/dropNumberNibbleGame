// Xếp dọc nội dung thẻ khích lệ (câu chúc → icon thưởng → nhãn "x N") thành một cụm căn giữa tờ giấy.
// Trước đây câu chúc neo nửa trên vùng giấy và icon neo cứng y=140 ⇒ câu ngắn dính mép trên, cụm lệch
// lên (Anh báo 13/10). Toạ độ tương đối tâm thẻ, y xuống; hàm thuần để test được.

/** Cả cụm dịch xuống chút so với tâm giấy: mép trên tờ giấy có bánh may mắn + hạt vụn đè lên (Anh 13/10). */
export const REWARD_OFFSET_Y = 20;

/** Khoảng cách câu chúc → icon, icon → nhãn. */
export const REWARD_GAP = { textToIcon: 36, iconToLabel: 10 } as const;

export interface RewardStackInput {
	/** Chiều cao khối chữ sau khi wrap và co cỡ. */
	readonly textHeight: number;
	/** Chiều cao icon đã nhân scale cuối; bỏ trống = thẻ không có thưởng. */
	readonly iconHeight?: number;
	/** Chiều cao nhãn "x N". */
	readonly labelHeight?: number;
}

export interface RewardStack {
	/** Tâm khối chữ (origin 0.5). */
	readonly textY: number;
	/** Tâm icon (origin 0.5). */
	readonly iconY?: number;
	/** Mép trên nhãn (origin 0.5, 0). */
	readonly labelY?: number;
}

export function stackReward(i: RewardStackInput): RewardStack {
	if (i.iconHeight === undefined) return { textY: REWARD_OFFSET_Y };
	const label = i.labelHeight ?? 0;
	const total =
		i.textHeight + REWARD_GAP.textToIcon + i.iconHeight + REWARD_GAP.iconToLabel + label;
	const top = REWARD_OFFSET_Y - total / 2;
	const iconY = top + i.textHeight + REWARD_GAP.textToIcon + i.iconHeight / 2;
	return {
		textY: top + i.textHeight / 2,
		iconY,
		labelY: iconY + i.iconHeight / 2 + REWARD_GAP.iconToLabel,
	};
}
