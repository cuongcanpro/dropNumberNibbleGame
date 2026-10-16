---
name: nibble-game
description: Take someone from a freshly unzipped Nibble game template to a game they play in the browser and share by link, running every command for them. Use when the human wants to set up the template, make a new Nibble game, port an existing web game into the template, get a link to mark it done on nibblenow.zingplay.dev, or optionally put it on the Nibi Launcher.
---

# Nibble game

Nibble Verse is a phone app of short, offline, no-ads casual games. Its games run on **Nibi**: TypeScript executed by Hermes inside a native sandbox, drawing through WebGL and Canvas2D. Nibi is not a browser: there is no DOM, and code that works in Chrome can fail silently on a phone.

The human makes and plays the game in the browser (`pnpm dev`), nothing to install beyond Node. The sim (which you run yourself) and the Launcher on their phone are optional; their one Nibi step is signing in before the deploy that gives their link (step 5). The hard rules below are what keep the game ready for Nibi.

The human may not write code. Run every command yourself, explain each step in a sentence or two in their language (usually Vietnamese), and ask them only for decisions: the game, the spec, names, and anything that needs their account or their phone. The template's `AGENTS.md` and `docs/` are the authority on commands, layout, the game-kit and Nibi's limits; this skill is the order of work.

## Hard rules

- Work in the template. Never ship a standalone web project (Vite app, HTML page, DOM UI) as the game.
- Portrait phone game in Phaser 4 + TypeScript: design frame 720×1280, touch input only. A game that needs real 3D draws it with three.js inside Phaser ([docs/three.md](../../../docs/three.md)).
- Everything is drawn in the canvas, including buttons, text and menus. Use the game-kit's HUD, Settings, Exit and result popup instead of building UI in HTML.
- Plays fully offline. No ads, no in-app purchases, no accounts, no multiplayer.

## Steps

Each step ends on a **done when** line. Don't start the next step until it holds.

Once set up, open each later session with the version check in [references/update.md](references/update.md); update only when they bring a newer zip.

### 1. Set up

Start here every time, before talking about the game: most people arrive with a bare machine. Follow [references/setup.md](references/setup.md): check the folder, Node 24+ and pnpm 11, install what is missing with their go-ahead, `pnpm i`, rename the game if it is still `sample-game`, start a git history, and open it in their browser.

**Done when** they see the Hello world under their game's name and `pnpm check` passes.

### 2. Agree on a short spec

Ask what they want to make (and a reference game, if any). Write one screen: core loop with one finger, win/lose, scoring and what is saved as best, levels (fixed bank, generator, or endless), what you cut from the reference (every ad, purchase, energy/lives timer and online feature), and a rough asset list. The template's shake-for-reward gate is optional: mention it only if the reference pays for a revive or booster, as a choice that defaults to none, and remove it if they don't want it (`AGENTS.md`).

Porting a game they already have: ask where it is and read its code first. The spec is what it already does, minus anything Nibi can't run. Its rules (pure logic, level data, scoring) move into `games/<id>/src/game/logic/` and `config/` with tests; its rendering and any DOM/HTML/CSS UI are rewritten in Phaser, never wrapped or shimmed.

**Done when** they confirm the spec.

### 3. Build the game

Follow `AGENTS.md`: rules test-first in `logic/`, then thin scenes and views. Read the `docs/` page each change needs before writing it (runtime limits, game-kit, assets). Show progress in `pnpm dev` as you go and take their feedback.

**Done when** every rule in the spec has a passing test, a full round plays from start to win and lose in `pnpm dev`, and `pnpm check` passes.

### 4. Check it on Nibi yourself

Run the sim headless and play a full round from the CLI (`docs/test-loop.md`, "Driving the sim or phone from the CLI"); fix whatever only fails there. The human does nothing here. The sim runs on macOS, Windows x64 and Linux x64, and its first run downloads the host once; on any other system (Windows or Linux on ARM) skip this step.

Only if the human asks to play it on their phone:

1. They install the Nibi Launcher (`docs/test-loop.md`, "Phone setup").
2. `pnpm nibi:login` once (step 5 explains the sign-in).
3. Start `pnpm dev:qr` in the background. From your shell it prints `Launcher URL: https://…/dev/<user>/<session>/` instead of a QR: run `pnpm qr-page <that URL>`, which opens the QR in their browser, and they scan it from the Launcher. Edits reload on the phone; the URL stays the same between runs. Stop `dev:qr` when done.

**Done when** a full round plays in the sim with no errors in its console, or the system has no sim host.

### 5. Share it

`pnpm deploy:nibi` is the whole share step. It publishes the browser version at `https://nibi.zingplay.dev/play/zps.<username>.<id>`, a link anyone can open, which is the one for Nibble Now; it lists the game under **Contributors** in every Nibi Launcher; and it uploads the source of `games/<id>/`, which only they and the team's admins can download, so the team can move a finished game into Nibble Verse.

1. `pnpm check` and `pnpm build` pass.
2. `pnpm nibi:login` once. It prints a `Code:` and opens a browser page; tell them the code, they sign in with their VNG account (`@vng.com.vn`), check the page shows the same code and approve. No app needed. If the sign-in is refused, they ask `vulq2` for an account.
3. Tell them the game becomes public (the link and the Launcher), get their go-ahead, then `pnpm deploy:nibi`. It sets `packageId` in `nibi.yml` to `zps.<username>.<id>`, the only form the sandbox accepts, builds for Nibi and for the browser, uploads both with the source zip, and publishes. Every later `pnpm deploy:nibi` updates all three. Read its last lines:
   - `web https://nibi.zingplay.dev/play/zps.<username>.<id>`: the link. `web not hosted: <reason>`: fix the reason (a failing `pnpm build:web` shows the same error) and deploy again.
   - `source … files … kept on the Site`. No `source` or `web` line at all: the `nibi` CLI is too old; `pnpm update nibi`, then deploy again.
   - `source archive is … over the limit` (50 MB): move raw art or video out of `games/<id>/`.
4. Give them the link to open on their phone's browser, then tell them to open their game's page on https://nibblenow.zingplay.dev, paste it, press **Đánh dấu xong**, and add a short diary entry: what was built, what was cut, what's left.

**Done when** the `/play` link opens and plays on a phone's browser.
