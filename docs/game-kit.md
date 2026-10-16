# Game-kit integration

`@repo/game-kit` (code in `packages/game-kit/src`, the final word) is the shared shell every Nibble Verse game uses: fonts, loading screen, HUD buttons, Settings, Exit, Feedback, result popup with rank, the shake-for-reward gate that replaces ads, share, save helpers, sound and vibration, and telemetry to the Nibble Console. It ships TypeScript source; import it by subpath:

| Subpath | Use |
| --- | --- |
| `@repo/game-kit/shell` | `initGameShell`, `setGameMode`, `exitToHost`, `canShare`, `shareGame` |
| `@repo/game-kit/ui` | `loadGameKitFonts`, `attachLoadingScreen`, `preloadGameKitUi`, `kitHud`, `makeButton`, `makeText`, `GameSettingOverlay`, `ExitConfirmDialog`, `FeedbackSheet`, `GameResultPopup`, `mountRank`, `destroyDeep` |
| `@repo/game-kit/platform` | `applyHostCamera`, `safeView`, `safeShiftDown/Up`, `Sound`, `Vibration`, `UserData`, `BackKeyManager`, `preloadKitAtlas`, `queueAudioAfterStart`, `hostPlatform` |
| `@repo/game-kit/metrics` | `createMetricSink`, `ScoreMetricsCollector`, `LevelMetricsCollector`, `AttemptCounter`, `FakeMetricSink` (tests) |
| `@repo/game-kit/alt-ad` | `createSceneAltAdGate`, `preloadShakeAssets`, `dismissShakeUi` |
| `@repo/game-kit/rank` | `fetchResultRank` |
| `@repo/game-kit/testing` | `installMemoryStorage` for Vitest |
| `@repo/game-kit/vite` | `consoleDefine`, `listingSnapshot` for `vite.config.ts` |

Never edit `packages/game-kit`. If the kit has a bug or lacks something, work around it in the game and report it to the team.

## What the template already wires

| Part | Where | Keep |
| --- | --- | --- |
| Boot order: fonts → `UserData` → `initGameShell({ appVersion, gameSlug, mode })` → `new Phaser.Game` | `src/main.ts` | Always |
| Loading screen, kit UI preload, shake assets, game atlas | `scenes/boot-scene.ts` | Always |
| HUD Home/Settings drawn only when `kitHud()` says so | `view/hud-buttons.ts` | Always |
| Settings (`GameSettingOverlay` with `onFeedback` → `FeedbackSheet`), Home → `ExitConfirmDialog` → `exitToHost`, Back key, pause while they are open | `scenes/game-shell.ts` | Always |
| Metrics collector started per round, quit on Home and teardown | `metrics/`, `scenes/game-scene.ts` | Always |
| Result popup with rank (`GameResultPopup` + `fetchResultRank`) and share | `view/result-flow.ts`, called by `GameScene.endRound()` | Call `endRound()` when a round ends |
| Shake-for-reward gate (revive example) | `GameScene.offerReward()` | Optional: only for a revive or free booster the user wants; otherwise delete it and exempt `altAd` |
| Debug hook `globalThis.gameDebug` | `scenes/debug-hook.ts` | Keep `describe()` current ([test-loop.md](test-loop.md)) |

`pnpm check:kit-parts` fails if the game's `src/` loses any of `initGameShell`, `kitHud`, `GameSettingOverlay`, `ExitConfirmDialog`/`exitToHost`, `FeedbackSheet`, an alt-ad gate, or a rank/result call. It only checks the symbols are present, not that they work: play the flows (see [test-loop.md](test-loop.md)). A part the game deliberately lacks goes in `games/<id>/kit-parts.json` with a reason of at least 10 characters: `{ "exempt": { "altAd": "No rewards in this game" } }`.

## Metrics

- Score games use `ScoreMetricsCollector` (`game_score_start/end`); level games extend `LevelMetricsCollector` (`game_level_start/complete/fail`). The template's `GameMetricsCollector` extends the score one.
- `collector.start(attempt, bestAtStart)` at round start, `collector.end({ score })` at round end, `recordQuit('home')` when the player leaves mid-round, `recordShare('game_over')` after a successful share. Ending twice is ignored.
- Never hardcode the slug in collectors: the sink reads slug and mode from `initGameShell` / `setGameMode`.

## Result popup and rank

- `new GameResultPopup(scene, { onReplay, onShare }).show({ score, bestScore, isNewBest })` shows at once; rank arrives later through `popup.applyRank(await fetchResultRank(score))`. `null` (offline, tracking off, timeout) hides the rank block, so the game never handles network errors. Level games call `show({ clearedLevel })` or `show({ failedLevel })`.
- The popup has no Home button (kit rule): exit lives in Settings.
- Optional layout parts: `popup.show(data, { title, hero, info, custom, primaryLabel, secondary, rank: false })`, each a `Container | Image | Text` the game builds; the kit places them vertically. `metric: 'time'` shows seconds as `mm:ss`.
- A custom result screen calls `mountRank(scene, { score, container, x, y })` instead.
- Rank `score` follows the metric the Console sets for the game: points or level (higher is better), time in **milliseconds** (lower is better). Score games send the player's best, not the round score.
- Rank needs a Console game row and a leaderboard config for the slug; ask the team. In dev builds `gkDev.setRank({ rank: 7, totalPlayers: 1200 })` in the browser console fakes a rank to check the layout.

## Shake-for-reward (optional, replaces ads)

```ts
const gate = createSceneAltAdGate(scene, createMetricSink());
const outcome = await gate.open({
	context: { taskType: 'revive', origin: 'game_over' }, // or 'free_booster'
	rewardKey: 'ui/heart', // optional: an existing texture (atlas frame) shown as the reward icon
	onReward: () => grantRevive(),
});
```

The player shakes the phone 3 times (on desktop and in the sim a "Tap!" button appears after 5 s), then taps **Continue** on the reward card. `alt_ad_*` events are sent automatically. `open()` resolves with:

| Outcome | When | `onReward` ran |
| --- | --- | --- |
| `'completed'` | The player tapped Continue | Yes, before the promise resolves |
| `'skipped'` | The player closed the popup with X, or at once without any popup when the Console turns the gate off for this game (`kitConfig().altad.enabled`) | No |
| `'abandoned'` | The player pressed Back, or the scene shut down while the popup was open | No |
| `'error'` | `onReward` threw or rejected | Yes, and failed |

So never wait for `onReward` alone: branch on the outcome and end the round on anything but `'completed'`, as `GameScene.offerReward()` does. When a round ends while a shake popup is open, call `dismissShakeUi()`.

## Settings, exit, feedback

`GameSettingOverlay` shows a button only when its callback is given (`onRestart`, `onFeedback`, `onHome`, plus `onThemes`/`onLevels`). `onFeedback` → `FeedbackSheet.show(scene, { gameKey })` is required. Panel colors come from the game's Console listing. Popups the game builds itself close with `destroyDeep(scene, root)`.

The kit does not pause the game behind its dialogs. `scenes/game-shell.ts` calls `onOpened` before Settings or Exit opens (HUD button or Back key) and `onClosed` when Settings resumes, Exit is cancelled or Feedback closes; `GameScene` sets `paused` from them.

## Camera and safe area

Kit overlays center on what the scene's camera shows (`designView(scene)`); open them after the camera is set. With `applyHostCamera` (zoom = min(w/720, h/1280), centered on 360,640) the design frame sits in the middle and the rest is letterbox, which `view/core.ts` `addBackground` covers. Pin HUD with `safeShiftDown` / `safeView`.

## Assets and sound

- Kit art loads as 2 atlases; never copy kit PNGs or fonts into the game (`pnpm check:assets` warns).
- `preloadKitAtlas(scene, atlas)` registers each frame of a game atlas as its own texture key, so `add.image(x, y, 'ui/start-button')` works.
- `queueAudioAfterStart(scene, ['sfx/tap', ...], { bgm: 'music/theme' })` loads sounds after the first scene is up; `Sound.getInstance().playSfx(key)` is silent until the file arrives.

## Telemetry (off by default here)

`vite.config.ts` bakes `NB_CONSOLE_ENV` and `NB_CONSOLE_EVENTS_KEY` into the bundle through `consoleDefine`:

| `NB_CONSOLE_ENV` | Events go to | Key |
| --- | --- | --- |
| empty / unknown / `off` | nowhere (SDK off) | none |
| `dev` | `https://nibble-api.zingplay.dev/public/events` | `NB_CONSOLE_EVENTS_KEY` |
| `live` | `https://nibble-api.zingplay.com/public/events` | `NB_CONSOLE_EVENTS_KEY` |
| `local` | `http://localhost:3000` (a local Server) | fixed |

- `pnpm dev` reads `games/<id>/.env.development.local`; nothing set means off.
- `nibi sim | dev | build` read `games/<id>/.env.nibi` (committed here as `off`) then `.env.nibi.local` (gitignored). To send events to the dev Console, get the events key from the team and put `NB_CONSOLE_ENV=dev` and `NB_CONSOLE_EVENTS_KEY=...` in `.env.nibi.local`. Never commit a key.
- With tracking off the console logs `[tracking] ... SDK KHÔNG bật` once; that is expected. On the web, the kit's requests to the Console for the listing card and kit-config fail with CORS errors from `127.0.0.1`; the game falls back to defaults.
- Custom events beyond what the collectors emit: ask the team first.

## Known kit issues

- The result popup's dim (depth 99999) covers the HUD, so Settings and Home cannot be tapped at game over, and the popup has no Home button. Exit is still reachable through the Back key (Escape on desktop), which opens the Exit dialog; Replay returns to a screen with the HUD. Do not raise the HUD's depth or patch the kit; the team tracks it.

## Tests

`test/setup.ts` calls `installMemoryStorage()` so stores and collectors work under Node. Test collectors with `FakeMetricSink`. Mock `nibi` with `vi.mock('nibi', () => import('nibi/testing'))` when a test must import a file that uses it; better, keep that code out of `logic/`.
