# Nibi runtime: rules and pitfalls

Nibi is not a browser and not a game engine. On the phone the game runs as Hermes bytecode (`game.hbc`) inside the Nibi Launcher, with a host-owned canvas. `pnpm dev` runs a **web shim** of that surface, not "whatever Chrome does": most bugs below only show up in `pnpm dev:nibi` or on a phone. Official docs: https://nibi.zingplay.dev/docs (authoring, runtime networking, Web API compatibility).

## Screen and input

- `primaryCanvas` (`#screen`, from `nibi`) belongs to the host. Assigning its `width`/`height` is ignored. Phaser draws into it with `Scale.NONE`, as `src/main.ts` does.
- The viewport is frozen at boot: `innerWidth`, `innerHeight` and `devicePixelRatio` are set once and native never fires `resize`. Lay out once in design coordinates (720x1280) with the camera from `applyHostCamera(scene)` (letterboxed).
- Orientation: add `orientation: landscape` to `nibi.yml` (default portrait) and change `DESIGN_WIDTH/HEIGHT` in `config/game-config.ts`. It is frozen at compile time; `import { orientation } from 'nibi'` reads it.
- Safe area: shift HUD and bottom buttons with `safeShiftDown` / `safeShiftUp` (or `safeView`) from `@repo/game-kit/platform`. They return 0 when the group already clears the notch; adding `safe.top` to a position yourself moves it twice. Insets are 0 on web and in `nibi sim`, so this bug only shows on a phone.
- Input: the host sends `pointer*` and `touch*`, never `mouse*` or `click`. Keep `input: { activePointers: 2, touch: true }`. Pointer `clientX/Y` are logical pixels of the host stage.
- Device motion (`devicemotion`) works on the phone; `nibi sim` has no samples. The kit's shake popup falls back to a "Tap!" button after 5 s.
- Haptics: use the kit's `Vibration` (respects the player's toggle and goes through the Launcher; iOS has no `navigator.vibrate`).

## Lifecycle and storage

- Going to the background fires `visibilitychange` (then `blur`); timers, `requestAnimationFrame`, network and audio stop after those handlers. Save there, not on `pagehide`: the OS may kill a backgrounded app. The runtime flushes `localStorage` to disk right after the handler. In `nibi sim`, minimizing the window sends the game to the background.
- `localStorage` is 1 MiB per game (UTF-8 bytes of keys and values plus a few bytes per entry). Over the limit, `setItem` throws `QuotaExceededError` and changes nothing; catch it around saves that grow. It is no place for assets or logs.
- Prefix storage keys with the slug and a version (`config/game-config.ts` does) and validate saved data on load (`persistence/profile-store.ts`): an old or corrupt save must never block play.
- Leaving the game goes through the kit's `exitToHost` (Home button, Exit dialog). On the web it is a no-op.

## Audio

- Play every sound through the kit's `Sound` (`@repo/game-kit/platform`): it respects the Sound/Music toggles and avoids the audio-node quota. The runtime has about 256 live audio nodes, freed only on GC; a burst of raw `scene.sound.play` calls throws and freezes the game.
- Formats: ship **mp3** (wav only for very short effects). Opus and AAC/m4a play silent on native.
- Long music: prefer an audio element (streams, ≤ 8 MiB packaged file, at most 8 playing at once) over decoding the whole track into Web Audio (a 3-minute track is ~63 MB of the 128 MiB audio budget); check it in `pnpm dev:nibi` before relying on it.
- The AudioContext starts suspended; Phaser unlocks it on the first tap. Load sounds after the first screen (`queueGameAudio` in `scenes/preload-art.ts`).

## Missing or partial APIs

- `DOMParser`, `TextDecoder`, `requestIdleCallback` and `crypto.randomUUID` have been missing or partial on native: prefer JSON over XML (bitmap fonts as JSON, or Phaser Text) and check any other browser API in `pnpm dev:nibi` first.
- No `navigator.share` or `navigator.vibrate`: use the kit's `shareGame` and `Vibration`.
- Web Audio, OffscreenCanvas and ImageBitmap are incomplete. Look up any browser API in https://nibi.zingplay.dev/docs/web-compatibility before using it.
- Fonts never fall back: a missing glyph draws nothing. The kit's LilitaOne has no Vietnamese glyphs (use Baloo for Vietnamese); neither font has `✓`. Check every non-ASCII character against `packages/game-kit/assets/fonts/*.ttf`.

## Rendering and performance

Hermes has no JIT: per-object and per-frame work costs several times what it does in Chrome, and a game smooth on the web can drop to half its frame rate on a phone. Web numbers, even CPU-throttled, do not predict it.

- WebGL1 only: `getContext('webgl2')` returns `null`. No float textures, no 32-bit indices, no blend min/max, no antialias. Masks need `render.stencil` in the game config.
- `Graphics` is rebuilt every frame in Phaser 4 (one `fillCircle` ≈ 100 points plus triangulation). Draw static shapes once, `generateTexture`, show them as Images.
- Each texture change ends a draw batch: keep things drawn together in one atlas (5 interleaved textures made 277 draws/frame; one atlas halved render time).
- Each Image costs ~16 µs per frame; a Container per entity multiplies that. Flatten entities; draw hundreds of static sprites as one `SpriteGPULayer` (check it in `pnpm dev:nibi`: Phaser 4.2.1 has caveats).
- Update only what a touch changed; do not redraw the whole screen on input.
- A `repeat: -1` tween keeps running after its object is destroyed: close hand-made popups with `destroyDeep(scene, root)` (`@repo/game-kit/ui`).
- Phaser 4.2.1: `TweenChain.remove()` throws, use `stop()`. A tween on the scale of an image sized with `setDisplaySize` must return to that scale, not `1`.
- Big JSON parses ~3x slower than V8: split level data into chunks ≤ 1 MB and load lazily. Images wider than 4096 px must be cut. Prefer `CanvasTexture` over uploading a `Uint8Array`.
- `ParticleEmitter`: keep under ~60 particles per burst.
- A log line `Nibi ignored WebGLRenderingContext...` means something is not drawn; fix it before trusting FPS numbers.
- Measure on the phone before optimizing: `nibi dev eval` (see [test-loop.md](test-loop.md)); time `update` and `render` separately at the heaviest moment.

## Assets, network, physics, build

- Files under `res/` are packed under `/path` keys (`nibi.yml` `assets.root: res`, Vite `publicDir: 'res'`). `res/foo` and `/res/foo` are the same key. Keep `+` and `%` out of file names and do not URL-encode keys. Imports (`?url`, `new URL(..., import.meta.url)`) from `src/` or `packages/` are packed too. Do not `?inline` fonts or atlases: that embeds them in `game.hbc`. Budget: [assets.md](assets.md).
- `fetch` reaches only the URL prefixes under `permissions.network` in `nibi.yml` (the template grants the two Console APIs). Gameplay must never wait on the network; rank, feedback and telemetry fail soft.
- Physics: `nibi/box2d` is the only physics API (native objects; web shim over `phaser-box2d`). Never `instanceof` physics objects; read positions with `world.readBodyTransforms`.
- `nibi sim`, `nibi dev` and `nibi build` run `vite build --mode nibi`, then Hermes. That build reads `.env.nibi` and `.env.nibi.local`, never `.env.development.local`. Game-kit stops it unless `NB_CONSOLE_ENV` is `local|dev|live|off`; this repo commits `games/<id>/.env.nibi` with `off`.
- Unit tests: `vi.mock('nibi', () => import('nibi/testing'))` gives a do-nothing stand-in with the same exports (zero safe area, portrait). Keep `logic/` and `config/` free of `nibi`, Phaser and kit imports so they need no mock.
