# Changelog

Newest first. `templateVersion` in `package.json` is the top entry. Each entry has a `Tóm tắt:` line that Nibble Now shows on its guide page, and an "Apply to your game" list for whatever `tools/update-template` can't change because it lives in `games/<id>/`.

## 0.3.0 - 2026-10-15
Tóm tắt: Có ví dụ làm game 3D bằng three.js chạy được trên Nibi (examples/three) và hướng dẫn ghép vào game.

### What changed

- `examples/three/`: a lit cube that spins and reacts to taps, drawn by three.js r162 inside Phaser's WebGL context under the game-kit HUD; 60 fps in the Nibi sim. `pnpm check` typechecks and tests it.
- `docs/three.md`: how to add 3D to a game and what holds on Nibi (three pinned to 0.162.0 for WebGL1, hand-lit materials, draw calls, shader warm-up, tap picking).
- The workspace includes `examples/*`, so `pnpm i` installs three for the example; a game's own build only gets three if the game adds it.

## 0.2.0 - 2026-10-14
Tóm tắt: Lệnh deploy:nibi cho luôn link chơi trên trình duyệt (nibi.zingplay.dev/play/...), không cần zdeploy nữa; Nibi giả lập chạy cả trên Windows và Linux.

### What changed

- `pnpm deploy:nibi` passes `--source --web` (opt-in flags since nibi 0.6.4; a plain `nibi deploy` uploads neither) and so also publishes the browser build at `https://nibi.zingplay.dev/play/zps.<username>.<id>`: that is the link for Nibble Now, next to the Launcher listing and the source upload. The zdeploy step is gone.
- `packedUrl` in the game-kit returns a relative URL in the browser build, so `res/` files load when the game is served from a folder.
- The Nibi sim (`pnpm dev:nibi`, `nibi sim`) runs on Windows x64 and Linux x64 as well as macOS (nibi 0.6.6; headless only on Linux), so the agent checks a round on Hermes on any of them.

### Apply to your game

- Run `pnpm update nibi` (0.6.6 or newer). Older CLIs print no `web` line on `deploy:nibi`, and before 0.6.6 the Windows and Linux sim hosts were out of date.
- Load loose `res/` files through `packedUrl` from `@repo/game-kit/platform`, a `?url` import, or a relative path. nibi 0.6.5 also points a hard-coded `'/<path>'` in `fetch`, XHR, image and audio `src`, and `FontFace` at the build's folder, but not one in CSS or in a URL the game builds itself.

## 0.1.0 - 2026-10-14
Tóm tắt: Có lệnh cập nhật template (không cần tải lại và chép tay), Nibi Launcher thành tuỳ chọn, lắc nhận thưởng thành tuỳ chọn.

### What changed

- `tools/update-template` brings a folder up to a newer template; the template now carries `templateVersion` and this changelog.
- The browser (`pnpm dev`) is the main loop; `dev:nibi`, `dev:qr` and `deploy:nibi` are optional.
- `pnpm deploy:nibi`, `pnpm nibi:login` and `pnpm qr-page` publish to the Nibi sandbox and show the Launcher QR (nibi 0.6.3).
- The kit's purity test passes on Windows.
- Packages install from `npm.zingplay.dev` without VPN.

### Apply to your game

Copies unzipped before this version have no `templateVersion`; compare `games/<id>/` with `games/sample-game/` in the new copy:

- No `src/game/scenes/debug-hook.ts`: the copy is from before the pause and test-loop fixes. Port `debug-hook.ts`, the `onOpened`/`onClosed` pause in `game-shell.ts`, and the `paused` flag, `describe()` and `installDebugHook` call in `game-scene.ts`.
- The game has no natural reward: delete `offerReward()` and its `createSceneAltAdGate`, and add `kit-parts.json` with `{ "exempt": { "altAd": "No rewards in this game" } }` (`docs/game-kit.md`).
