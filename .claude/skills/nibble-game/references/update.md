# Update the template

The folder's template version is `templateVersion` in the root `package.json`; a copy without it predates versioning. Nibble Now's guide page (https://nibblenow.zingplay.dev/guide) shows the latest version and what it changed. You can't fetch it yourself (it needs their ZPS login), so at the start of a session tell them in one sentence which version they're on and that they can check the guide page for a newer one. Go on only when they say they downloaded a newer zip.

1. They download **Template** from the guide page. Unzip it outside the game folder, e.g. next to it (`unzip`, `tar -xf` on Windows, or ask them to double-click it). Call the result `<new>`; it holds `tools/update-template/`.
2. Commit everything first if the folder is a git repo; the update refuses uncommitted changes.
3. From the game folder: `node <new>/tools/update-template/cli.ts --into . --dry-run`. Tell them briefly what will change, in their language, and that their game in `games/<id>/` is not touched.
4. With their go-ahead, run it again without `--dry-run`. It replaces the template's own folders and root files, merges `package.json` and `pnpm-workspace.yaml`, and records the template's root files in `.template-base/` (commit it: the next update merges against it).
   - A `warning:` names an edit of theirs (or yours) that the template overrode or dropped. If the edit was on purpose (a dependency, a script, an ignore line), put it back. On a folder's first update every difference shows up as a warning, since there is no record yet of what the template had; most are just the older template.
   - Without git it copies the files it changes or deletes to `.template-backup/<old version>/` first.
5. `pnpm i`, then `pnpm check`.
6. Apply the printed "Apply to your game" lists to `games/<id>/`, oldest version first, then `pnpm check` again and play a round in `pnpm dev`.
7. Commit ("Update template to <version>") and delete `<new>`.

If `pnpm check` fails and you can't fix it in the game, roll back and tell them what broke, with the error, so they can report it to Vũ (`vulq2`): `git reset --hard` then `git clean -fd` (the folder was clean before the update, so this only removes what it added). Without git, copy `.template-backup/<old version>/` back over the folder and delete the files the output listed as `add`.
