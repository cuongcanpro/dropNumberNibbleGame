import { consoleDefine, listingSnapshot } from '@repo/game-kit/vite';
import { defineNibiConfig } from 'nibi/vite';
import type { ConfigEnv } from 'vite';

// Function config: `consoleDefine` cần `mode` để bake NB_CONSOLE_* đúng lúc `nibi build` (--mode nibi);
// `listingSnapshot` chụp thẻ listing Console vào bundle cho lần mở đầu offline (lỗi mạng không làm hỏng build).
export default ({ mode }: ConfigEnv) =>
	defineNibiConfig({
		publicDir: 'res',
		plugins: [listingSnapshot(mode, import.meta.dirname)],
		define: consoleDefine(mode, import.meta.dirname),
		server: {
			host: '127.0.0.1',
		},
	});
