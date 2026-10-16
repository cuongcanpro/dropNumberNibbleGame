/* oxlint-disable eslint/no-underscore-dangle -- tên define do Vite quy ước, không đổi được */
// Các hằng bake lúc build bởi `consoleDefine` (`@repo/game-kit/vite`). Rỗng = SDK Console tắt.
declare const __NB_CONSOLE_ENV__: string;
declare const __NB_CONSOLE_EVENTS_KEY__: string;
declare const __NB_COMMIT__: string;
// Thẻ listing chụp lúc build (`listingSnapshot`), khoá theo slug viết thường; `{}` khi không chụp được.
declare const __NB_LISTING_SNAPSHOT__:
	| Readonly<Record<string, import('./ui/card-fetch').GameCard>>
	| undefined;
