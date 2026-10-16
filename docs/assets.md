# Asset budget and pipeline

Measured on iPhone: the Nibi runtime costs **~65–100 ms per file loaded at boot, whatever its size**, and every Play starts a fresh runtime. Load time ≈ files × 80 ms (126 files = 8.5 s). Target: about 2 s.

## Rules

- **Boot loads at most 30 files, game-kit included.** The kit already loads its art as 2 atlases plus 2 fonts. `pnpm check:assets` fails a game with more than 30 loose images in `res/`.
- UI, icons, frames, sprites, tiles go into an **atlas**: source PNGs live in `games/<id>/art/<group>/` (outside `res/`, or `nibi build` packs every file separately), the generated atlas is committed, and `pnpm pack-assets --check` fails when it is stale.
- `res/` holds only what loads as is: full-screen images larger than ~1024 px, fonts, audio, level data, and the catalog `icon.png` (≤ 512 KiB) and `cover.png` (≤ 2 MiB), PNG, JPEG or WebP. The template ships one placeholder image as both; replace both.
- Load atlas frames, not one `load.image` per file. Bundle many small JSON files into one, or `import` them into code.
- Sounds not needed on the first screen load after it: list them in `AUDIO_FILES` in `scenes/preload-art.ts` (`queueGameAudio`). Audio format: mp3, wav for very short effects ([nibi-runtime.md](nibi-runtime.md#audio)).
- Never copy kit PNGs or fonts into the game; `check:assets` warns on byte-identical copies.

## Adding images

1. Put PNGs in `games/<id>/art/<group>/`. Split groups by how they are used (UI and sprites vs tiles drawn into canvases); keep one group within a 2048x2048 page where you can (it spills into `<out>-<n>.png` pages otherwise).
2. Declare the group in `games/<id>/pack.config.ts`:
   ```ts
   groups: [{ out: 'src/game/atlas/ui', sources: [{ dir: 'art/ui', prefix: 'ui/' }] }]
   ```
   Frame key = `prefix` + file path without `.png` (`art/ui/start-button.png` → `ui/start-button`). `rename` maps a file path to a different key.
3. Run `pnpm pack-assets` (all targets) or `pnpm pack-assets <id>`, and commit the PNG and JSON it writes.
4. Load it once at boot with `preloadKitAtlas(scene, { key, url, frames })`, as `scenes/preload-art.ts` does, then use each frame as a texture key: `scene.add.image(x, y, 'ui/start-button')`.

The packer is deterministic: maxrects, 2048 px pages, 1 px padding and extrude, no rotation, no trim (frame sizes equal the source sizes).

## Pitfalls with atlases

- `textures.get(key).getSourceImage()` on a plain atlas frame returns the whole page; the kit's aliases from `preloadKitAtlas` return a canvas cropped to the frame. `drawImage` of one frame must use the frame rect (`cutX/cutY/cutWidth/cutHeight`).
- Never `textures.remove` an atlas or an alias texture: it shares the GL texture with every other frame. Remove only textures you created.
- Atlas URLs from Vite `?url` are absolute: do not set `load.setPath` around `preloadKitAtlas`.
- Load a loose `res/` file through `packedUrl('<path under res/>')` (`@repo/game-kit/platform`), never a hard-coded `'/<path>'`: Nibi packs it under `/<path>`, but the browser build at `/play/<packageId>` is served from a folder, where `packedUrl` returns a relative URL.
- A file that imports `@repo/game-kit/platform` pulls in `nibi` and breaks Vitest: keep keys and constants that tests import apart from the loader code.
- Frame JSON ships inside the code bundle (~58 KB for 212 frames); watch it for thousands of frames.

## Checking the count

In `pnpm dev`, open DevTools → Network, filter by png/json/mp3/ttf and count requests at boot. `pnpm build` writes `games/<id>/dist/manifest.json`; its asset list is what the phone loads.
