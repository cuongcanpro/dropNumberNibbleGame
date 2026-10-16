# Setup: check the machine, install, rename

Work through these in order. Check before you install, and when a check fails, fix it (with the human's go-ahead) before moving on. If a step still fails, stop and tell them in plain words what failed, with the exact error, and who to ask: Vũ (`vulq2`) for the template, anh Quang (`quangvd2`) for Nibble Now.

Anything that writes outside this folder (a global install, a system setting) needs their go-ahead first; say what it installs and why in one sentence. Claude Code's sandbox or auto mode may block such commands. Then give them the exact line as `! <command>` to paste into the chat, and read its output.

## 1. The folder

You are in the template when the root has `packages/game-kit/` and exactly one `games/<id>/` with a `nibi.yml`. If not, ask them to download **Template** from https://nibblenow.zingplay.dev/guide (it needs their ZPS login, so you can't fetch it), unzip it, and open you in that folder.

## 2. Node 24 or newer

`node --version`. Missing or older than 24: ask them to install the LTS from https://nodejs.org (the installer, Next all the way), then to fully quit and reopen their terminal or agent app so the new `node` is found, and check again. If they use nvm, `nvm install 24` and `nvm use 24` instead.

## 3. pnpm 11

`pnpm --version`. The repo pins pnpm 11 in `package.json` (`packageManager`).

- Works and prints 11 or newer: go on.
- Missing or older: ask before installing. Then `corepack enable`, which ships with Node 24 and makes `pnpm` follow the repo's pinned version. If `corepack` is missing or `corepack enable` fails with a permission error, use `npm i -g pnpm@11` instead. Still a permission error: give them the line as `! npm i -g pnpm@11`; never run `sudo` yourself.
- Check `pnpm --version` again.

On Windows, run commands in the terminal your agent uses (PowerShell or Git Bash); if `pnpm` is still not found after installing, they reopen the agent app.

## 4. Install

`pnpm i`. Packages come from `npm.zingplay.dev` (set in `.npmrc`), no VPN needed.

- Errors about fetching from `gitlab.zingplay.com` or a lockfile: delete `pnpm-lock.yaml` and run `pnpm i` again.
- Network errors on `npm.zingplay.dev`: ask them to check they are online and that `https://npm.zingplay.dev/` opens in their browser.

## 5. Rename the game

If the game folder is still `games/sample-game/`, the template hasn't been renamed: do it now, without waiting to be asked.

- Name: the game in their prompt (e.g. the one they claimed on Nibble Now); otherwise ask what the game is called.
- Id: the name in kebab-case ASCII, accents dropped, starting with a letter (`Ghép Hình Vui` → `ghep-hinh-vui`, `Pop the Bubbles` → `pop-bubbles`, `2048` → `game-2048`).
- `pnpm rename-game <id> "<Name>"`, then `pnpm i`. Tell them the name and id you used; `AGENTS.md`, "Renaming the game", says what changes.

Already renamed: leave it.

## 6. Start a git history

Git lets you undo a bad change and keeps each template update in its own commit. `git --version`; if it is missing, skip this step (a template update then keeps backups instead) and don't install it without asking. In the folder, if there is no `.git` yet: `git init`, `git add -A`, `git commit -m "Start <Name>"`. If the commit fails because no name or email is set, set them for this folder only: `git config user.name "<their name>"` and `git config user.email "<their account>@vng.com.vn"`.

Then commit whenever a step below is done, so there is always a working state to go back to.

## 7. Run it

Start `pnpm dev` in the background, wait until http://127.0.0.1:5173 answers, and give them the link to open in their browser. Then `pnpm check`.

**Done when** they see the Hello world under the game's name in their browser and `pnpm check` passes. Tell them briefly what you checked and installed.
