// Nguồn: Cocos scenes/reviveSystem/constants.ts (REVIVE_MESSAGES) — giữ nguyên nội dung.
export const REVIVE_MESSAGES: readonly string[] = [
	// Khen ngợi nỗ lực
	'You did really well this time, and even though you lost, you still have a chance to come back and try again right now.',
	"That was a strong effort and it shows your progress clearly, so don't stop here and give yourself another chance.",
	"You've already made it this far, which means you're capable of more, and you can continue and try again immediately.",
	"That run proved you're improving step by step, and one more try could lead to a much better result.",
	'You handled that challenge nicely, and with one more chance, things could turn out very differently.',
	'You showed real skill in that attempt, and you still have an opportunity to jump back in and keep going.',
	"That was a solid performance overall, and there's no reason not to give it another try now.",
	"You're clearly getting better with each run, so continuing now could really pay off.",
	"That effort wasn't wasted at all, and you can use what you learned to try again right away.",
	"You played well and stayed focused, which means you're ready for another chance to continue.",

	// Gần thành công
	'You were extremely close to success, and one more attempt could be all it takes to turn things around.',
	'That run was almost perfect, so trying again now might lead to a great outcome.',
	'You nearly had it this time, and stopping here would be a shame when you can try again.',
	'Just a small mistake held you back, and another try could easily fix that.',
	'That attempt had great momentum, so keep it going and give it one more shot.',
	'You were only a moment away from success, and now is the perfect time to try again.',
	'That felt close to a win, and one more run could finally get you there.',
	"You're closer than ever before, so continuing now makes a lot of sense.",
	'That was nearly your best performance so far, and you can immediately try to beat it.',
	"One more chance could completely change the result, so don't give up yet.",

	// Động viên sau thất bại
	"It's okay that things didn't work out this time, because you still have the chance to continue.",
	'Everyone loses sometimes, and what really matters is choosing to try again.',
	"That didn't go as planned, but you're not out of options and can keep playing.",
	'Take a moment to breathe, then jump back in and give it another shot.',
	"This single loss doesn't define your ability, and you can always try again.",
	'Failing here is normal, and continuing now is part of the fun.',
	"You're allowed to make mistakes, and you're also allowed to try again right away.",
	"That was a tough moment, but you're strong enough to keep going.",
	"There's no pressure at all, you can continue and play at your own pace.",
	'Even after a setback like this, you still have a chance to recover and continue.',

	// Khuyến khích tiếp tục
	'You still have one more opportunity to continue, so try again now and see what happens.',
	"This doesn't have to be the end, because you can jump right back in.",
	"Your journey isn't over yet, and you can continue playing from here.",
	"You can keep going right now and see how far you're able to reach.",
	'Another attempt is waiting for you, and it could be your best one yet.',
	'Give yourself another chance while everything is still fresh in your mind.',
	"You're not finished yet, so jump back in and keep playing.",
	'This run can still be saved, and you can try again immediately.',
	"There's still more ahead of you, so continue and don't stop here.",
	'You have another chance right now, so use it and keep going.',
];

/** `pool` rỗng/vắng = kho mặc định; kit-config `altad.messages` thay hẳn kho khi không rỗng. */
export function randomReviveMessage(
	rand: () => number = Math.random,
	pool: readonly string[] = REVIVE_MESSAGES,
): string {
	const from = pool.length > 0 ? pool : REVIVE_MESSAGES;
	return from[Math.floor(rand() * from.length)] ?? '';
}
