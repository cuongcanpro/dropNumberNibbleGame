# Nibble Verse game

This repo holds one game for Nibble Verse, ZPS's no-ads casual games portal. The game lives in `games/<id>/` (now `games/sample-game/`): Phaser 4 + TypeScript, built by Vite for the web and to Hermes bytecode for the native Nibi Launcher. `@repo/game-kit` (vendored in `packages/game-kit`) gives it the shared shell: loading, HUD, Settings, Exit, Feedback, result popup with rank, shake-for-reward, sound, save, telemetry. The template is a "Hello world" scene with every kit part wired and a placeholder round (tap for points, "Give up" to lose) so each flow can be played; the user's idea is the game to build.

Nibi is not a browser: code that works in Chrome can fail silently on a phone.

Taking the user from setup to a game they play in the browser and share by link (they may not code): follow [.claude/skills/nibble-game/SKILL.md](.claude/skills/nibble-game/SKILL.md).

## Commands (repo root)

| Command | Does |
| --- | --- |
| `pnpm i` | Install. The registry is `npm.zingplay.dev` (`.npmrc`), no VPN needed; `nibi` on npmjs.org is an unrelated package. |
| `pnpm rename-game <id> "<Name>"` | Rename the game (see Layout), then `pnpm i` |
| `node <new copy>/tools/update-template/cli.ts --into . [--dry-run]` | Update this folder to a newer template the user downloaded ([update.md](.claude/skills/nibble-game/references/update.md)); `templateVersion` in `package.json` is the folder's version, `CHANGELOG.md` what each changed |
| `pnpm dev` | Web at http://127.0.0.1:5173: the user's loop |
| `pnpm dev:nibi` | Optional: desktop Nibi sim (Hermes; macOS, Windows x64, Linux x64 headless) |
| `pnpm dev:qr` | Optional: phone through the Nibi Launcher (QR) |
| `pnpm qr-page <url>` | Optional: open the `Launcher URL:` that `dev:qr` prints as a QR in the browser (an agent's shell can't draw it) |
| `pnpm nibi:login` | Sign in to the Nibi Site with a VNG account in the browser, once per machine (needed by `deploy:nibi` and `dev:qr`) |
| `pnpm deploy:nibi` | Share: `nibi deploy --source --web` to the Nibi sandbox as `zps.<username>.<id>`: the browser link `https://nibi.zingplay.dev/play/<packageId>`, the Launcher's Contributors list, and a zip of the game's source |
| `pnpm test` | Vitest for the game and the kit |
| `pnpm check` | Typecheck, tests, oxlint, Biome, script tests, theme layers, atlases, asset budget, kit parts |
| `pnpm format` | Fix formatting |
| `pnpm pack-assets` | Rebuild atlases from `games/<id>/art/` |
| `pnpm build` | `nibi build` (writes `games/<id>/dist/game.hbc`) and the web build into `web-dist/` |
| `pnpm build:web` | Web build only, into `web-dist/` (`deploy:nibi` makes its own) |

## Read before

- Any code touching canvas, layout, input, audio, storage, lifecycle, WebGL, network, physics or performance: [docs/nibi-runtime.md](docs/nibi-runtime.md).
- Using or changing a game-kit part (HUD, Settings, Exit, result, rank, shake reward, metrics, telemetry): [docs/game-kit.md](docs/game-kit.md).
- Adding an image, sound, font or data file, or anything loaded at boot: [docs/assets.md](docs/assets.md).
- Running the game in the sim or on a phone, or driving it from the CLI: [docs/test-loop.md](docs/test-loop.md).
- A game in 3D (three.js), or anything in `examples/three/`: [docs/three.md](docs/three.md).

## Layout

Keep `games/<id>/` shaped exactly like a game in the team's `games` monorepo, because a finished game is copied there as is: same files (`nibi.yml`, `package.json`, `vite.config.ts`, `pack.config.ts`, `src/`, `res/`, `art/`, `test/`), same `@repo/game-kit/...` imports, same relative paths to `packages/` and `scripts/`.

- `src/game/logic/` and `src/game/config/`: rules, level generation, scoring. Plain TypeScript with no Phaser, DOM, `nibi` or kit imports; a `*.test.ts` next to each file.
- `src/game/scenes/` thin Phaser scenes; `src/game/view/` drawing, HUD, tweens, input; `persistence/` versioned `localStorage` stores; `metrics/` the collector.
- Design frame 720x1280 portrait. Name, slug and storage keys are in `src/game/config/game-config.ts`; display name and `packageId` in `nibi.yml`.
- TypeScript targets ES2022 (`lib: ES2022`): newer methods such as `Array.prototype.findLast` or `toSorted` fail `pnpm typecheck` even though Vitest runs them.

### Renaming the game

Run `pnpm rename-game <id> "<Display Name>"` (e.g. `pnpm rename-game pop-bubbles "Pop the Bubbles"`), then `pnpm i`. It renames the folder and rewrites `package.json`, `nibi.yml`, `index.html`, `README.md`, `pack.config.ts`, `game-config.ts` and the `pnpm-lock.yaml` importer key (pnpm 11 crashes with `depNode.fetching is not a function` if the folder moves without it).

- `<id>`: kebab-case, the folder and package name.
- Slug (`GAME_SLUG`): the id without dashes (`popbubbles`). It is the game's key on the Nibble Console (leaderboard, metrics, Settings theme) and prefixes the storage keys; if the team creates the Console row under another key, use theirs before the game ships.
- `packageId` becomes `dev.nibi.<id>`: a development id for the sim and your own phone. `pnpm deploy:nibi` switches it to `zps.<username>.<id>`, the only form the Nibi sandbox accepts; the team assigns the portal id when the game moves to Nibble Verse. Don't rename the game after the first deploy: a new id is a new game.
- `res/icon.png` and `res/cover.png` are the same placeholder image: replace both ([docs/assets.md](docs/assets.md)).

## Rules

- Write the rules test first in `logic/`, then the view. Done means `pnpm check` and `pnpm build` pass and a full round plays in `pnpm dev`.
- The user makes and plays the game in the browser (`pnpm dev`). Don't ask them to install the Nibi Launcher or run `dev:nibi`/`dev:qr` unless they ask to see it on Nibi; `deploy:nibi`, which gives their link, needs only a sign-in in the browser. You may run the headless sim yourself to catch Nibi-only bugs ([docs/test-loop.md](docs/test-loop.md#driving-the-sim-or-phone-from-the-cli)).
- Do not edit the template's own files outside `games/<id>/` (the folders and root files `tools/update-template/update.ts` lists): a template update replaces them, and `packages/` and `scripts/` are copies of the team's monorepo. Work around a kit bug in the game and tell the user to report it to the team. Notes about the game go in `games/<id>/`. Maintaining the template itself is the exception: `docs/maintaining.md`, only in its repo.
- Keep every kit part wired (`pnpm check:kit-parts`) and call `GameScene.endRound()` when a round ends.
- The shake-for-reward gate is optional: don't bring it up unless the game has a natural reward (revive, free booster), and then offer it, defaulting to none. Keep `GameScene.offerReward()` only if the user wants it; otherwise delete it with its `createSceneAltAdGate` and exempt it ([docs/game-kit.md](docs/game-kit.md#what-the-template-already-wires)).
- A real-time game steps its logic in `GameScene.update()` and stops while `paused` is set (Settings, Exit, Feedback, reward gate).
- Nibble sells nothing and shows no ads: no ads, no in-app purchases, nothing that needs the network to play.
- Ask the user before adding a dependency, changing `permissions` in `nibi.yml`, or turning telemetry on. Keys go in `games/<id>/.env.nibi.local`, never in git.
- Give interactive objects, popup roots and list items a role-based name with `setName('...')`: `globalThis.gameDebug.interactives()` (`scenes/debug-hook.ts`) lists them for `nibi sim tap`. Keep `describe()` in `GameScene` returning the round state ([docs/test-loop.md](docs/test-loop.md#driving-the-sim-or-phone-from-the-cli)).
- Deploy only after the user agrees, and only with `pnpm deploy:nibi`: it publishes the `/play` link and the Launcher listing to everyone and uploads `games/<id>/` (never `.env*`, `node_modules` or `dist`) for the owner and the team's admins. The `/play` link is the one for Nibble Now.
- The browser build is served from a folder, not the origin root: load `res/` files through `packedUrl` (`@repo/game-kit/platform`), a `?url` import, or a relative path, never a hard-coded `/path`.
