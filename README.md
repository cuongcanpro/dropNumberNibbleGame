# Nibble Verse game template

Khung trống để làm một game cho Nibble Verse (portal game không quảng cáo của ZPS): Phaser 4 + Nibi, đã nối sẵn game-kit (loading, Settings, Exit, popup kết quả, xếp hạng, lắc nhận thưởng). Mở ra là một màn "Hello world" có ván chơi giả (chạm để cộng điểm, "Give up" để thua) để thử mọi luồng.

## Bắt đầu

1. Tải repo về (clone hoặc tải zip).
2. Cài: Node ≥ 24, `corepack enable`, rồi `pnpm i`. Package `nibi` lấy từ registry nội bộ `npm.zingplay.dev` (đã cấu hình trong `.npmrc`), không cần VPN.
3. Đặt tên game: `pnpm rename-game <id> "<Tên game>"` (vd. `pnpm rename-game pop-bubbles "Pop the Bubbles"`), rồi `pnpm i`.
4. Chạy: `pnpm dev` rồi mở http://127.0.0.1:5173 trên trình duyệt. Làm và thử game ở đây, không cần cài app nào.

Muốn xem thêm trên Nibi (tuỳ chọn): `pnpm dev:nibi` mở Nibi giả lập (macOS, Windows, Linux; trên Linux chạy không cửa sổ); `pnpm dev:qr` chạy trên điện thoại qua app Nibi Launcher, cần đăng nhập Nibi một lần (`pnpm nibi:login`). Agent mở mã QR bằng `pnpm qr-page <Launcher URL>`. Cách cài app: `docs/test-loop.md`.
5. Mở agent (Claude Code, Codex…) trong thư mục repo và kể ý tưởng game. Agent đọc `AGENTS.md` và `docs/` rồi làm theo skill `nibble-game` có sẵn trong `.claude/skills/`. Xong một bước thì chạy `pnpm check`.

Không rành code thì bỏ qua các bước trên: mở agent trong thư mục này, dán prompt bắt đầu trên https://nibblenow.zingplay.dev/guide, agent tự cài đặt và làm cùng bạn.

## Chia sẻ game

`pnpm nibi:login` một lần (đăng nhập tài khoản VNG trên trình duyệt), rồi `pnpm deploy:nibi`. Một lệnh làm cả ba việc:

- **Link chơi trên trình duyệt:** `https://nibi.zingplay.dev/play/zps.<username>.<id>`, ai cũng mở được. Đây là link dán lên https://nibblenow.zingplay.dev.
- **Nibi Launcher:** game lên mục **Contributors**, ai cài app cũng chơi được.
- **Mã nguồn** `games/<id>/` gửi cho team (chỉ bạn và admin tải được) để đưa game vào Nibble Verse.

Package id tự đặt thành `zps.<username>.<id>`. Mỗi lần `pnpm deploy:nibi` lại là cập nhật cả ba.

## Cập nhật template

Phiên bản template của thư mục nằm ở `templateVersion` trong `package.json`; trang https://nibblenow.zingplay.dev/guide ghi bản mới nhất và thay đổi gì (`CHANGELOG.md`). Có bản mới thì tải zip về, giải nén ra **ngoài** thư mục game, rồi bảo agent "cập nhật template từ <thư mục vừa giải nén>". Agent chạy `node <bản mới>/tools/update-template/cli.ts --into .`: lệnh thay phần của template, gộp `package.json`, và không đụng game của bạn trong `games/<id>/`.
