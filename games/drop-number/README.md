# Drop Number

Game Phaser 4 chạy trên Nibi, đã nối sẵn game-kit (`@repo/game-kit`). packageId `dev.nibi.drop-number`, slug `dropnumber`, khung design 720x1280.

## Layout

```
src/main.ts               boot: font -> UserData -> initGameShell -> Phaser.Game
src/game/config/          hằng số + dữ liệu (tên, slug, mode, khung design, khoá storage)
src/game/logic/           luật chơi thuần, không import Phaser/DOM/nibi, test cạnh file
src/game/metrics/         collector (extend ScoreMetricsCollector / LevelMetricsCollector của kit)
src/game/persistence/     store trên localStorage, validate save cũ
src/game/scenes/          scene Phaser mỏng: boot, game, game-shell (Home/Settings/Back)
src/game/view/            vẽ, HUD, popup kết quả, âm thanh/rung
art/                      ảnh nguồn -> atlas src/game/atlas/ bằng `pnpm pack-assets` (pack.config.ts)
res/                      file đóng gói nguyên: icon.png, cover.png, ảnh full màn hình, font, âm thanh
test/setup.ts             localStorage trong bộ nhớ cho Vitest
```
