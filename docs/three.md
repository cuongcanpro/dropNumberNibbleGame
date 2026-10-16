# 3D with three.js

For a game that needs real 3D: perspective, objects that turn, depth. Fake 3D (isometric or pre-rendered sprites) stays plain Phaser and costs less.

three.js r162 draws into Phaser's own WebGL context as one entry of the display list (`GameObjects.Extern`): what the scene adds before it (the background) shows behind the 3D, and what it adds after it (HUD, the kit's popups) draws on top. The game stays a Phaser game; three only draws the world.

`examples/three/` is a working example: a lit cube that spins, and changes colour and bounces when tapped, under the template's HUD. It runs at 60 fps with 7 draw calls in the Nibi sim, and `pnpm check` typechecks and tests it.

| File | What it is |
| --- | --- |
| `three-host.ts` | `getThreeHost(game)`: the one three renderer on Phaser's context, and `ThreeLayer`, the `Extern` that draws a three scene. Copy as is. |
| `lambert-material.ts` | A hand-lit material (GLSL 100). Copy, and change the lighting if you like. |
| `demo-world.ts` | The 3D world: camera, meshes, `advance(dt)`, tap picking, projection to the screen. Replace with your game's world. |
| `add-demo-world.ts` | Puts the world into a scene: host, layer, shader warm-up, taps, disposal. |

## Adding 3D to the game

1. Ask the user before adding the dependency. Then, in `games/<id>/`: `pnpm add three@0.162.0` and `pnpm add -D @types/three@0.162.0`, exact versions.
2. Copy `examples/three/src/*` into `games/<id>/src/game/view/three/`.
3. Wire it into `GameScene` (`src/game/scenes/game-scene.ts`):

   ```ts
   import type { DemoWorld } from '../view/three/demo-world';
   import { addDemoWorld } from '../view/three/add-demo-world';

   private world!: DemoWorld;

   // create(): right after addBackground(...), before addHudButtons(...)
   this.world = addDemoWorld(this);

   // update(time, deltaMs): before the early return, so the world also moves on the title screen
   if (!this.paused) this.world.advance(deltaMs / 1000);
   ```

4. Turn the demo into the game: build the world in `demo-world.ts` from `logic/` state, keep the rules in `logic/` with tests, and route taps through `tapAt`. To put a Phaser label or button over a 3D object, take the object's canvas position (`cubeOnCanvas()` shows how) and turn it into scene coordinates with `this.cameras.main.getWorldPoint(x, y)`: the scene's camera is zoomed to the design frame.
5. Check it on Hermes before calling it done: the headless sim ([test-loop.md](test-loop.md#driving-the-sim-or-phone-from-the-cli)) should show the lit world under the HUD, `nibi sim perf` near 60 fps, and `nibi sim console --level warn` nothing new. Two warnings at boot are expected: `WebGL 1 support was deprecated in r153` and `EXT_blend_minmax extension not supported`.

## Rules on Nibi

- **three 0.162.0, pinned.** r163 dropped WebGL1, and WebGL1 is all Nibi has ([nibi-runtime.md](nibi-runtime.md#rendering-and-performance)).
- **One renderer on Phaser's context.** Always go through `getThreeHost`: no second `WebGLRenderer`, canvas or context. Don't call `renderer.setSize` or `setPixelRatio`: the host owns the canvas size. Build the camera's aspect from `host.width / host.height`.
- **Light by hand.** Use a `ShaderMaterial` in GLSL 100 like `lambert-material.ts`; `MeshBasicMaterial` (unlit) also works. three's lit materials (`MeshLambertMaterial`, `MeshPhongMaterial`, `MeshStandardMaterial`) and shadow maps are unproven on Hermes.
- **WebGL1 limits.** At most 65535 vertices per geometry (16-bit indices only), no float textures, a texture that repeats must be a power of two, no antialiasing.
- **Draw calls.** Each visible mesh is one draw call. Draw many copies of one shape as one `InstancedMesh`, and stay under about 50 calls: in the team's measurements around 60 held 58 fps in the sim and 180 dropped to 51.
- **Compile at load.** `renderer.compile(scene, camera)` (in `add-demo-world.ts`) compiles every shader up front; a mesh shown for the first time mid-game otherwise stalls that frame. Upload textures the same way with `renderer.initTexture`.
- **Taps.** Pointer `x`/`y` are canvas pixels, the same space as the host. Update the world matrices before raycasting, as `tapAt` does: three refreshes them only when it renders.
- **Dispose** geometries, materials and textures when the scene shuts down.
- **Size.** three adds about 0.5 MB to `game.hbc`.
