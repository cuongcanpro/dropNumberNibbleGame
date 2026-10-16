# Test loop: web, sim, phone

The web loop is the default: it needs nothing but Node, and it is where the game is made and played. The sim and the phone are optional checks for Nibi-only bugs; the sim runs on macOS, Windows x64 and Linux x64, the phone needs the Nibi Launcher and one `pnpm nibi:login`.

Commands run from the repo root unless noted; `nibi sim --help` and `nibi dev --help` list every flag (nibi 0.6.6).

| Loop | Command | What it is |
| --- | --- | --- |
| Web | `pnpm dev` | Vite at http://127.0.0.1:5173. Fastest loop; use Chrome's device toolbar at 390x844. A shim of Nibi; it does not typecheck. |
| Desktop sim | `pnpm dev:nibi` | `nibi sim .`: builds `--mode nibi`, compiles to Hermes, plays in the desktop nibi-host window (on Linux there is no window: it always runs headless). Catches most native-only bugs. The first run downloads the host for your system (`@nibi/sim-darwin-*`, `-win32-x64`, `-linux-x64`) into `~/.nibi/hosts/`. |
| Phone | `pnpm dev:qr` | `nibi dev .`: builds, watches, prints a QR code; scan it with the Nibi Launcher on the phone. The only place where shake, vibration, share, safe area, backgrounding and real frame rate show up. |

Tracking is off in all three (see [game-kit.md](game-kit.md#telemetry-off-by-default-here)).

## Driving the sim or phone from the CLI

Start the sim in one terminal and drive it from another (or from an agent); run these from `games/<id>/`:

```sh
pnpm exec nibi sim . --headless          # no window, offscreen framebuffer; keeps running
until pnpm exec nibi sim ready; do sleep 2; done   # `ready` fails at once while the sim is still building
pnpm exec nibi sim screenshot shot.png --max-size 800
pnpm exec nibi sim tap 0.5 0.5 --norm    # 0-1 fractions of the canvas; without --norm, CSS pixels
pnpm exec nibi sim drag 100 600 300 600 --duration 300
pnpm exec nibi sim console --level warn  # game console.* output
pnpm exec nibi sim perf --duration 5000
```

To know what to tap, ask the game through its debug hook (`src/game/scenes/debug-hook.ts`, installed by `GameScene`):

```sh
pnpm exec nibi sim eval 'gameDebug.describe()'       # round state: {"started":true,"paused":false,"ended":false,"score":3,...}
pnpm exec nibi sim eval 'gameDebug.interactives()'   # [{"name":"","texture":"gk-ui/hud/btnSetting","nx":0.92,"ny":0.13}, {"name":"give-up","texture":"<generated>","nx":0.5,"ny":0.73}]
pnpm exec nibi sim tap 0.5 0.73 --norm               # tap the item's nx, ny
```

`interactives()` lists every visible input-enabled object in draw order (topmost last), with its `setName` name and texture key. Text objects get a generated texture key, so name them. Kit buttons have no name: find them by texture (`gk-ui/hud/btnSetting`, `gk-ui/setting/btnClose`, `gk-alt-ad/button` for Tap! and Continue). The same hook works in the browser (`pnpm dev`, Playwright `page.evaluate(() => gameDebug.describe())`); there, multiply `nx`/`ny` by the canvas bounding box. Extend `describe()` with whatever an agent needs to play your game (piece positions in 0-1 coordinates, the current phase).

`nibi dev` has the same verbs (`nibi dev screenshot`, `tap`, `eval`, `perf`, `console`) against the connected phone; `nibi dev devices` lists phones and `--device <n>` picks one. `nibi dev eval` runs JavaScript in the game on the phone and prints the result as JSON; it is how you measure frame time on device ([nibi-runtime.md](nibi-runtime.md#rendering-and-performance)).

## Phone setup

- Install the Nibi Launcher: Android APK from https://nibi.zingplay.dev/get; iOS through zpple, then TestFlight.
- The Launcher must run Nibi runtime 1.1.0 or newer (the version `nibi` 0.6.6 builds for). `nibi 1.0.0 does not satisfy 1.1.0` followed by `startup_failure` means the Launcher is old: update it, don't pin `runtime.version` in `nibi.yml`.
- `nibi dev .` with no flags uses the tunnel of the Nibi Site, which needs one `pnpm nibi:login`: a VNG account (`@vng.com.vn`) gets a Site account on its first sign-in; if that is refused, ask `vulq2`. Without it, `pnpm dev:qr` stops with `not logged in to https://nibi.zingplay.dev`. On the same Wi-Fi you can skip the tunnel: `pnpm exec nibi dev . --host 0.0.0.0 --origin http://<your-LAN-IP>:<port> --port <port>` from `games/<id>/`.
- The QR prints only in an interactive terminal; elsewhere (an agent's shell) `nibi dev` prints the `Launcher URL:` instead. `pnpm qr-page <that URL>` opens it as a QR in the browser, or paste it into the Launcher's scan screen.

## What each loop cannot show

| Feature | Web | Sim | Phone |
| --- | --- | --- | --- |
| Shake gate | "Tap!" fallback after 5 s | "Tap!" fallback | Real shake |
| Vibration, share sheet | No | No | Yes (through the Launcher) |
| Safe-area insets | 0 | 0 | Real |
| Backgrounding | No | Minimize the window (macOS, Windows) | Yes |
| Frame rate | Not representative | Hermes, desktop CPU | Real |
| Telemetry, rank | Off here; Console requests fail with CORS on 127.0.0.1 | Off | Off unless `.env.nibi.local` sets a key |

## A five-minute pass before calling something done

- [ ] `pnpm dev`: play a full round, open Settings, Feedback, Exit, the result popup, the shake gate (Tap! fallback, then Continue).
- [ ] `pnpm dev:nibi` (or the headless sim): the same round on Hermes; `nibi sim console --level warn` shows no new errors or `Nibi ignored ...` lines.
- [ ] If a phone is at hand: `pnpm dev:qr`, check safe area, shake, vibration and frame rate.
- [ ] `pnpm check` and `pnpm build` pass.
