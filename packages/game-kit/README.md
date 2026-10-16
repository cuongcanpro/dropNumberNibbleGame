# @repo/game-kit

Kit chia sẻ cho game Nibi (tracking, metrics, rank, shell, alt-ad, platform, ui). TS source, không build riêng; import theo subpath:
`@repo/game-kit/{tracking,metrics,rank,shell,alt-ad,platform,ui,vite,testing}`.

- Phần thuần (`tracking metrics rank shell` + logic `alt-ad`) không import `phaser`/`nibi`/DOM — `src/purity.test.ts` chặn.
- Test cần storage: `test/setup.ts` dùng `installMemoryStorage()` từ `src/testing`; game import lại thay vì chép.
- Env Console: trong `vite.config.ts` của game dùng `define: consoleDefine(mode, __dirname)` từ `@repo/game-kit/vite`; xem `.env.example`. Game cần `/// <reference>` hoặc include `env.d.ts` để có type cho `__NB_*__`.
- Code: không `enum`, không parameter property, import tương đối không đuôi `.ts`.

## Tính năng thiết bị qua Launcher (`hostPlatform`)

`hostPlatform` từ `@repo/game-kit/platform` gọi portal qua kênh `host` (giao thức `nv.platform.*`, phía portal: `src/services/platform-bridge.ts`) — thay cho PlatformWrapper của cocos: `deviceInfo` (model, OS, phiên bản app, RAM, ngôn ngữ, quốc gia storefront), `battery`, `diskSpace`, `connection`, `copyToClipboard`, `share`, `requestReview`, `openAppSettings`, `sendEmail`, `openCustomerService`, `scheduleNotification` / `cancelNotifications`. `Vibration` tự rung haptic thật qua Launcher (iOS không có `navigator.vibrate`).

- Ngoài Launcher (web, `nibi sim`, portal bản cũ) không ai trả lời: sau ~1,5 s mọi helper rơi về API web hoặc giá trị "không biết" (`-1`, `''`, `false`), **không bao giờ ném**.
- Safe area không qua đây: dùng `safeInsets`/`safeView` (`safeAreaInsets` của nibi).
- Thông báo local: chỉ hẹn được khi người chơi đã cho phép thông báo (game không tự xin quyền), tối đa 30 ngày tới và 10 cái/game; `cancelNotifications` chỉ huỷ của game mình.

## Subpath `./vite` — luật riêng (dính 04/10)

`vite.config.ts` của game được Vite nạp bằng **Node**, không qua bundler. Node 24 strip type cho file `.ts` nhưng **không nhận import thiếu đuôi** (`./foo`). Vì vậy `./vite` trỏ thẳng vào `src/vite/console-define.ts` và file đó **không được import tương đối** file nào khác trong kit (chỉ `vite`, `node:*`). Thêm helper mới cho vite.config → viết trong cùng file hoặc thêm subpath mới trỏ thẳng file.

## Atlas (ít file lúc boot)

Ảnh UI + alt-ad được gộp sẵn thành `assets/atlas/gk-ui.*` và `gk-alt-ad.*` (cấu hình `pack.config.ts`). Sửa/thêm PNG nguồn ở `assets/ui|alt-ad` ⇒ chạy `pnpm pack-assets game-kit` rồi commit atlas (CI chạy `pnpm pack-assets --check`). `preloadGameKitUi` / `preloadShakeAssets` xếp hàng đúng 1 file mỗi atlas rồi dựng lại key cũ (`gk-ui/…`, `gk-alt-ad/…`) làm texture riêng dùng chung GL texture của atlas (`src/platform/atlas-alias.ts`). Đừng `textures.remove` key atlas (`gk-atlas/*`) và đừng gọi `setFilter` trên một alias: sẽ ảnh hưởng cả atlas.
