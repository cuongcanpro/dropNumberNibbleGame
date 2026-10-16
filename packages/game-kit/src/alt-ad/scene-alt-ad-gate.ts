// Gắn AltAdGate với Phaser scene + MetricSink: `gate.open({...})` là toàn bộ API cho game.
import type Phaser from 'phaser';
import type { MetricSink } from '../metrics/metric-sink';
import { kitConfig } from '../ui/kit-config-client';
import { type AltAdGate, createAltAdGate } from './alt-ad-gate';
import { ensureShakeAssets, rewardTextureKey } from './assets';
import type { MotionSource } from './motion-source';
import type { ShakeSessionOptions } from './shake-session';
import { ShakeUi } from './shake-ui';

export interface SceneAltAdGateOptions {
	fontFamily?: string;
	motion?: MotionSource;
	/** Mặc định của game; kit-config Console (`altad.*`) ghi đè khi có. */
	session?: ShakeSessionOptions;
}

export function createSceneAltAdGate(
	scene: Phaser.Scene,
	sink: Pick<MetricSink, 'altAd'>,
	options: SceneAltAdGateOptions = {},
): AltAdGate {
	const gate = createAltAdGate({
		sink,
		showPopup: ({ rewardUrl, rewardKey, rewardAmount, onSuccess, onFail }) => {
			// Đọc config lúc MỞ (không lúc tạo gate): bản tươi có thể tới giữa chừng trước popup đầu.
			const cfg = kitConfig().altad;
			const session: ShakeSessionOptions = {
				...options.session,
				...(cfg.maxShakes !== undefined ? { maxShakes: cfg.maxShakes } : {}),
				...(cfg.lockMs !== undefined ? { lockMs: cfg.lockMs } : {}),
			};
			void ensureShakeAssets(scene, rewardUrl, rewardKey).then((hasReward) => {
				// Scene đã đóng trong lúc nạp ảnh → coi như bỏ giữa chừng.
				if (!scene.sys.isActive()) return onFail('abandoned');
				new ShakeUi(scene, {
					...options,
					session,
					messages: cfg.messages,
					onSuccess,
					onFail,
					hasReward,
					rewardKey: rewardTextureKey(scene, rewardKey),
					rewardAmount: cfg.rewardAmount ?? rewardAmount,
				}).open();
			});
		},
	});
	return {
		open(args) {
			// Console tắt altad: không mở popup, không emit `offered`; game coi như người chơi bỏ qua.
			if (!kitConfig().altad.enabled) return Promise.resolve('skipped');
			return gate.open(args);
		},
	};
}
