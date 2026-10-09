# Plan Studio 6 prototype — realistic 3D + eye-level walk-through (CR-029, ST7 look-dev)

An interactive WebGL prototype of the Studio 6 proposal (`docs/changes/CR-029-PLAN-STUDIO-6-REALISTIC-3D.md`): one page,
one bundled script, no server, no CDN. Open `index.html` from `file:///` in Chrome / Edge / Firefox (desktop or a phone).

**This folder is design evidence, not product code.** Nothing here is imported by `frontend/`; the product's `sw-plan-3d`,
`scene-builder.ts` and `scene-three.ts` are untouched. See "Prototype-only vs production plan" below.

## What it shows

| Mode | What you get |
|---|---|
| **Two visual styles** | Light architectural render and dark digital twin (`src/style.js`): palette per material id, light rig, post numbers, section-cut treatment, ground / backdrop. Header chip: follows the UI theme, or fixed per browser |
| **Section cut** | Orbit views clip the top visible floor at 60 % of its ceiling with a dark cap (dollhouse); the dark style adds a luminous edge; the walk never cuts (settings: on/off) |
| **Realistic (quality 3)** | Hue-free procedural detail textures tinted by the style palette (512 px floors / walls, real tile sizes), normal + roughness maps on floors, walls, doors, furniture; image-based lighting from a sky dome prefiltered per time of day; sun position by hour / date / latitude / plan north with soft PCF shadows; GTAO (0.6 m, low) on the top rung + contact AO on every rung (wall-junction strips, blob shadows under objects); Khronos Neutral tone mapping; MSAA x4; lit lamps as emissive bodies + a pool of 8 point lights with bloom; physical glass (transmission) on windows; optional planar floor reflections and lamp shadows (off by default — see the measured costs) |
| **Realistic lite** | The same textures, lighting, shadows and bloom without the AO, the physical glass and the reflector, at DPR 1 — the rung an integrated GPU lands on |
| **Full (2)** | Flat standard materials, hemisphere + sun shadows (the product's level 2 look) |
| **Schematic (1)** | Lambert, no shadows (the product's default level 1) |
| **Stills (0)** | Pre-baked image sets with SVG masks: 4 pictures per floor (day / night × lights off / on) rendered by the live view at a fixed camera, per-room masks projected with the same camera matrix, lit rooms revealed through their mask, open doors / presence / cameras drawn as SVG over the picture, zero WebGL frames (kiosk) |
| **Walk-through** | Eye-level first person (1.2–2.0 m), WASD / arrows / Q E, Shift run, mouse-drag look, optional pointer lock, click-to-walk with A* around walls and through open doors only, touch joystick + drag-look + tap-to-walk, wall collision (0.28 m body), doors passable only when their sensor says open (locked = closed, unsensed = passable), stairs between the two levels with the level switch at the top, saved viewpoints (1–9), stand-at-camera / stand-in-room, minimap with heading cone and tap-to-teleport, walk bar with numeric X / Y / heading fields |
| **Device panel** | Lights per room, doors (sensor simulation) and a lock, roller shutters by position, presence pulse, TV; the 3D reacts: lamps light the room, doors swing / slide (350 ms), shutters drop, the red open-door frame, the blue presence ring, the lock plate |
| **Time & weather** | Slider 00:00–23:59, "now", presets (noon / sunset / night), weather clear / hazy / overcast; sun azimuth and elevation shown |
| **Settings** (panel) | Default view (schematic / realistic), wall display (live / still), furniture (procedural / models), time source (site clock / manual), section cut, temperature pills, motion; eye height 1.2–2.0 m and mouse-look mode (drag / pointer lock / auto) in the walk tab — the list the product port must expose |
| **HUD** (developers) | Off by default (`?hud` or the settings toggle): fps, ms per frame (CPU submit), draw calls, triangles, textures, geometries, JS heap, canvas size and DPR, mode / rung, and the GPU string — a software renderer (SwiftShader) is flagged in orange |
| **Quality ladder** | 2.5 s probe after 3 warm-up frames; under 30 fps the view drops one rung (realistic → lite → full → schematic → stills when baked) and says so; manual choice re-measures |

Two plans: the two-floor demo house (synthetic, schema 2.0 + the CR's proposed 2.1 fields under `x_proto`) and the repo's
real fixture `contracts/fixtures/plan_geometry/sample-v2.json` (copied verbatim at build time), which proves the loader
walks the product's document as it is (its rooms list is empty, so the floor is a plate around its walls).

## Controls

| Input | Action |
|---|---|
| Mouse drag / wheel (orbit) | Orbit / zoom (OrbitControls); click a lamp, door, shutter, lock, camera or TV for its popover |
| Chips at the bottom | Presets (top / iso / perspective / from camera X), **סיור** (walk), the quality rungs |
| Floor strip (right) | Ground / floor 1 / all floors, with thumbnails and state dots (lit / presence / open) |
| Time card (top-left) | Hour slider, now, weather and time presets |
| Walk: `W A S D` / arrows | Move; `Shift` run; `Q` `E` turn; mouse drag look; `Esc` leave |
| Walk: click floor | Walk there along the open path (a closed door is a wall) |
| Walk: `Enter` | Act on the device in the crosshair (popover) |
| Walk: `1`–`9` | Saved viewpoints; "שמור עמדה" saves the current one (browser localStorage) |
| Walk: minimap click | Teleport (same floor) |
| Walk: touch | Left joystick = move; drag on the right half = look; tap = walk there; long-press a device = popover |
| Walk panel | Eye height 1.2–2.0 m, pointer-lock opt-in, saved positions, stand at camera / in room |
| Quality panel | Auto ladder on/off, reflections, GTAO, bloom, lamp shadows, DPR cap; bake stills; kiosk idle timer |
| Header | Plan selector, dark / light theme |

## Build and verify

```
# bundle (esbuild + three.js from frontend/node_modules; copies the repo fixture)
SW_NODE_MODULES=C:\...\frontend\node_modules node build.mjs
# static server for the captures (prints its PID; stop that PID only)
node tools/serve.mjs 4190
# headless Chromium: smoke | measure | shots | all   (SW_GPU=1 = the workstation's real GPU via ANGLE/D3D11, else SwiftShader)
SW_NODE_MODULES=... SW_GPU=1 SW_URL=http://127.0.0.1:4190/index.html node tools/capture.mjs all
# look-dev evidence: both styles x 1440/820/390, walk checks, overflow checks, GIF frames, per-rung measurement
SW_NODE_MODULES=... SW_GPU=1 SW_URL=... node tools/lookdev-shots.mjs all      # -> shots/lookdev/, shots/lookdev-gpu.json
SW_NODE_MODULES=... SW_GPU=1 SW_URL=... node tools/checkpoint.mjs             # -> docs/design/studio6/checkpoint/
SW_NODE_MODULES=... SW_GPU=1 SW_URL=... node tools/probe.mjs "<js>"           # one expression against window.studio6
```

`shots/` holds the screenshots, `shots/frames/` the GIF frame sequences, `shots/*.gif` the sequences (built by
`tools/make-gif.mjs`), `shots/perf-gpu.json` the measured numbers and `shots/shots-gpu.json` the scripted walk checks
(blocked at a closed door, on the stair, on the upper floor after it, tap-to-walk arrival). The page is served from a plain
static server for the headless runs only because Chromium's screenshot timing is more reliable there; `file:///` works
the same (the smoke run uses it).

## Prototype-only vs production plan

| Prototype shortcut | What the product does instead (CR-029) |
|---|---|
| `src/geometry.js` is a JS port of `buildPrimitives` / `blockingSegments` | The product keeps the TypeScript source of truth; the walk reuses `coverage.ts`'s segments directly (§4.3) |
| Materials are generated on a canvas at load (~1.2 s, 256 px) | CC0 texture sets from the manifest (§6), 512 px, loaded per material on demand, memory-capped |
| Lighting: sky dome prefiltered to a PMREM env map every time the slider moves | Same idea at S2; a cached set of a few prefiltered maps per hour band would avoid the per-move PMREM |
| No global illumination: indoor walls get the sky's diffuse unoccluded; the walk lowers the fill by a factor | S3's baked lightmap (hemisphere-sampled AO + indirect) per floor is the real fix |
| Door / cover / lock / presence states are a mock panel | The state layer (`room-state.ts`) and CR-007 device control with permissions |
| Stills are kept in memory for the session | `plan_bakes` rows + files on the server (§5.3), ETag, backup, geometry-key invalidation |
| Saved positions live in localStorage | `walk_positions[]` in the document (schema 2.1), `map.edit` |
| The cutaway is not drawn (walls full height in orbit) | The product's azimuth cutaway stays at level 3 |
| The furniture is a ~20-family procedural catalog written for the demo | The 154-item catalog's mesh parts; S8 glTF models only on the owner's word |
| One bundle (780 KB) with every addon | The `three` chunk cap (≤ 200 KB gzip) — GTAO, bloom and the composer need measuring against it; the Reflector and the Sky shader are not needed |
| Tap-to-walk A* on a 0.25 m grid built per request | S5: the same, cached per level + door-state key |

## Honest limits

- The two-floor house is authored for the prototype; the repo's only real geometry fixture is the 4-wall sample, which also
  loads. No private plans were used.
- Numbers in `shots/perf-gpu.json` are from the workstation's integrated Intel UHD GPU in headless Chromium through ANGLE/D3D11.
  The SwiftShader (software) measurement run is **NOT_RUN**: under SwiftShader the realistic level draws a frame in
  seconds, the page's main thread stays busy during the probe and the Playwright harness times out before the HUD can be
  read (`tools/capture.mjs measure` without `SW_GPU=1`). What was observed on SwiftShader in the staged boot checks: the
  smoke run from `file:///` boots and the probe falls back down the ladder; first realistic frame ~4-6 s (shader compile),
  later frames ~70 ms CPU-submit at 960x600 plus a multi-second GPU-side cost that only shows up on readback. No phone,
  tablet or kiosk was measured.
- Pointer lock was only exercised in a top-level page, not inside the product's Ingress iframe (CR §4.5 stays "to verify").
- Three.js r0.186 (the version `frontend/` ships) — `PCFSoftShadowMap` no longer exists there; PCF + radius is used.
