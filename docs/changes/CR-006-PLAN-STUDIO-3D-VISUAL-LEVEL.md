# CR-006 — Plan Studio 3D visual level: real-time upgrade first, AI-rendered skins second

**Numbering:** registered as CR-006 on 2026-09-28 (CR-003 Plan Studio, CR-004 floor/level unification, CR-005
WisKey access control - in progress, phase 2).

**Status:** Proposed 2026-09-28. Nothing below is scheduled; the owner's open decisions are in §7. WisKey phase 2
(CR-005) stays the active priority until the owner says otherwise.

## 1. The request (owner, 2026-09-28, translated)

The owner shared a Home Assistant community post (Facebook HA group, Mihail Panayotov, 2026-09-28) showing a
photoreal, isometric, three-floor dashboard - cutaway walls, soft lighting, rooms that light up, presence tinted blue
and fading over minutes, red markers on open doors and windows, per-room temperature chips, floor thumbnails, and
contextual popups (security with camera stills, energy, climate) - and asked that our 3D schematic reach that level
"later on". Then, explicitly:

- **Phase 1 uses no external products** - the look must come from our own real-time renderer.
- **Phase 2 adds AI-generated renders through a link to Claude or ChatGPT, for a limited number of renders.** The
  system itself proposes which renders it wants (for example "every light on", "every light off", and other states
  it needs), the owner chooses which of them to send, and the system stores every answer it gets from the AI for
  future use, so a render is paid for once and reused.

## 2. What the reference actually is (facts from the author's own post)

- Plain Lovelace: the `ha-floorplan` custom card plus Bubble Card modals. **Not live 3D.**
- The floors are **3ds Max renders made from the house's DWG drawings** - three floors, each rendered twice: lights
  off and lights on. **SVG masks shaped like the rooms** reveal the lights-on render only where a room's light is on.
- Presence, open doors/windows, temperatures, thumbnails, buttons: all SVG layered over the two renders.
- The author says the renders were made over a couple of years, not that weekend, and recommends floorplanner.com
  for a quick approximation.

The transferable idea is therefore **two aligned images per floor plus per-room masks**, not one render per
combination of states - which is exactly what keeps phase 2's render count small (§4.2).

## 3. Where our 3D stands today (facts from the code)

- `frontend/src/map/scene-three.ts`: three.js `PerspectiveCamera(50°)`, one `AmbientLight(1.6)` plus one
  `DirectionalLight(1.4)`, no shadows, `MeshLambertMaterial` per design token, instancing groups by
  (shape, colour, opacity), a 31° perspective in the floor map; true isometry exists only on the building page.
- Quality level 1 only (design §10.4). Rendering is deterministic by rule: same plan JSON + same token version →
  same scene graph (design §4 rule 4) - phase 1 must keep that.
- Data the visual states need already exists or is planned: entities anchored on the plan with live state (T025),
  rooms/zones as polygons (T039), HA history (T041), camera stills, door/window and light entities, the level model
  (CR-004).

## 4. Architecture

### 4.1 Phase 1 - real-time "quality level 2" (no external products)

A second quality level of the existing scene, selectable per browser, level 1 kept as the fallback (phones, weak
GPUs). Everything is rendered from the geometry Plan Studio already has, so it applies to every site on day one.

1. **Camera and framing.** Isometric preset for the floor map (the building page's 30° axes), per-floor framing,
   a floor thumbnail strip that switches floors and carries the same state dots as the reference (movement,
   open door) with the same decay.
2. **Lighting and materials.** Hemisphere + sun with soft shadows (`PCFSoftShadowMap`), cheap ambient occlusion
   (vertex AO baked at build time, SSAO only where the device allows), tone mapping, a sky-gradient backdrop token,
   `MeshStandardMaterial` per token with a floor material and glass; cutaway walls (walls facing the camera drop
   to a low height) so rooms read from above.
3. **State layer** (the part the reference does with SVG): room fill tint by state - light on (warm), presence
   (blue, fading over N minutes from the last motion, N a setting), open door/window (red marker on the opening),
   temperature chip per room from the room's climate/temperature entity; camera cones stay. States come from the
   entities already anchored in the room's polygon; the fade uses the entity's last-changed time, so it works from
   live state alone and improves with T041's history.
4. **Determinism and tests.** Same JSON + same tokens + same state snapshot → same scene graph; visual-regression
   snapshots (T074's harness) for both levels; a performance budget on a phone (level 2 falls back to level 1 when
   the frame budget is missed).

Permissions unchanged (`map.read` to view). No new backend surface except the two settings (quality level default,
presence decay minutes).

### 4.2 Phase 2 - AI-rendered skins (limited, proposed by the system, chosen by the owner, stored)

1. **Control image from phase 1.** Every render request starts from our own deterministic level-2 render of the
   floor (fixed camera matrix, fixed size, labels stripped). The AI is asked for an image-to-image "make this
   photoreal, keep the geometry exactly" pass. Because the camera matrix is ours, the room polygons project onto the
   result with the same matrix - that is what makes masks possible without hand work.
2. **Render set proposed by the system.** Per floor, the system lists the renders it wants, with a count and an
   estimated cost, and the owner ticks which to send. The default set is small by design, following the reference:
   S0 "all lights off, day", S1 "all lights on, day"; optional S2/S3 the same at night. Per-room lighting is S1
   masked by the room polygon - never one render per room or per combination. Other states the owner may add
   later (e.g. "doors open") are extra images in the same set, not multiplications.
3. **Provider.** A provider interface with one implementation at a time. Fact to record: Claude (Anthropic API)
   does not generate images today; OpenAI's image models do, as do others. The design is provider-agnostic; the
   first implementation is the owner's choice (§7.1). Reuses the product's existing opt-in AI pattern from T063:
   `ai.provider`, `ai.privacy_ack`, `ai.budget_daily` - plus a per-site render cap. Nothing is sent without the
   acknowledgement, and only the schematic control image leaves the premises: no plan raster, no camera stills, no
   people, no labels or entity names (§7.2 decides whether the original plan raster may be sent for fidelity).
4. **Storage ("skins").** Every answer is stored in the add-on's data dir with a DB row: floor, level, state key,
   provider, model, prompt version, control-image hash, created_at, cost, accepted (yes/no). A skin is reused until
   the geometry hash changes; then the view shows "skin outdated" and the system proposes a re-render - it never
   re-renders on its own. Skins are part of the project export/backup.
5. **Compositing.** With an accepted skin: the skin is the floor's base, the lit variant is masked per room by the
   room polygon, and the phase-1 state layer (markers, chips, presence tint, cameras) is drawn on top - the same
   code, so a floor with and without a skin behaves the same.
6. **Acceptance step.** After a render arrives, the system overlays our wall outlines on it and reports an
   alignment score; the owner accepts or rejects. Rejected renders are kept (they were paid for) but never shown.

### 4.3 What SMPLWISE deliberately does better than the reference

Scalable across sites without an artist; states driven by data, not hand-drawn SVG; skins optional and reusable;
a hard budget and an explicit privacy acknowledgement before any plan-derived image leaves the premises.

## 5. Phased build order

| Slice | Scope | Review rounds | Estimate (tonight's pace) |
|---|---|---|---|
| 1a | Camera presets, thumbnails strip, lighting, materials, cutaway walls, level-2 toggle + fallback | 2-3 | 4-6 h |
| 1b | State layer: room tints, presence decay, open-door markers, temperature chips; settings | 2 | 3-5 h |
| 1c | Determinism + visual regression + phone budget | 1-2 | 2-3 h |
| 2a | Provider interface + one provider, privacy ack, budgets, control-image export | 2-3 | 4-6 h |
| 2b | Render-set proposal UI, send/receive, skins storage, acceptance overlay + alignment score | 3 | 5-8 h |
| 2c | Compositing with masks, outdated detection, export/backup | 2 | 3-5 h |
| **Total** | | **12-15** | **~21-33 h** + real render trials in phase 2 |

## 6. Scope impact

New tasks to register in `management/tasks.json` under Plan Studio (T087 successor). Touches `scene-three.ts`,
`sw-plan-3d.ts`, `scene-builder.ts`, settings, a new `plan_skins` table and data-dir folder, a new AI-image provider
adapter next to T063's. No HA writes, no device access, no external calls in phase 1.

## 7. Open decisions needing owner sign-off

1. Image provider for phase 2: (a) OpenAI image API first, provider-agnostic interface (recommended, since Claude
   has no image generation); (b) another provider the owner prefers; (c) decide later, build phase 1 only.
2. What may leave the premises: (a) only our schematic level-2 render, labels stripped (recommended); (b) also the
   original plan raster for fidelity, per-site acknowledgement.
3. Render budget: (a) 2 renders per floor by default, up to 4 (recommended); (b) up to 6 (adds night variants);
   and a monthly cap per installation.
4. Presence decay default: (a) 3 minutes (the reference's "a couple of minutes"); (b) 10 minutes; (c) configurable
   only, no default tint.
5. Priority: (a) after CR-005 slices A1-A2 (person editor + card capture); (b) after all of CR-005 phase 2;
   (c) interleave 1a now as a short break between WisKey slices.

> Recorded decision 2026-09-28 (owner in chat, same day): §7.1 (a) - OpenAI first behind a provider-agnostic
> interface, and AI only in phase 2, none in phase 1. §7.3 - renders are a one-time act per floor; the answers and
> images are stored and reused; re-rendering only when the owner asks after a geometry change. §7.5 - the owner
> will run this CR in a second, parallel session alongside CR-005 phase 2. Scope clarification from the owner: the
> goal is that **both the 3D and the 2D map views look far more visual and polished than today**, so phase 1
> covers the 2D floor map as well (room fills, state tints, markers, chips, thumbnails - the same state layer drawn
> on the canvas), not only the three.js scene. §7.2 and §7.4 were not understood as asked and are re-put in plain
> terms: 7.2 = which picture is allowed to be sent to the AI provider (our own schematic render only, or also the
> original architect's plan image); 7.4 = how many minutes the blue "there was movement here" tint keeps fading
> before it disappears (default proposed: 3 minutes, a setting).
>
> Second round of answers (owner, same day): §7.2 - (a) as the default, but the send dialog in phase 2 offers the
> choice per send (our schematic render only / also the original plan image), since sending happens only at site
> set-up; still phase 2 only, no external service in phase 1. §7.4 - presence fade is an option: on/off and the
> duration in minutes, per installation. §7.5 - the owner asked this session to orchestrate CR-006 and CR-005 in
> parallel itself (a 24-hour build push), so the parallel-session rule below applies between agents of one session.
>
> Parallel-session rule (two sessions releasing into the same `g0/intake`/`main`): a session merges its branch only
> after `git pull`, bumps the version from the current tip, never reuses a version number, and does not start a
> release while the other session's release commit is not yet pushed; both sessions keep the full backend suite
> to one run at a time on this workstation (the timing tests fail under concurrent load - see the T054 evidence).

## 7a. Implementation record - slice 1a (2026-09-28, branch `pilot/T087-plan-visual-1a`)

Built as specified in §4.1 items 1, 2 and 4 (the state layer, item 3, and the 2D map are slices 1b/1c). Facts and
deviations recorded, not silently resolved:

- **Quality level 2** lives in `frontend/src/map/scene-three.ts` next to level 1 (unchanged: the same Lambert
  materials, lights and instance groups). Level 2: `HemisphereLight` + a shadow-casting `DirectionalLight`
  (`PCFSoftShadowMap`, 2048² map, shadow camera fitted to the extent of the shown floor plates), `MeshStandardMaterial`
  per token with a rough floor and a glossy translucent glass (`map-glass`), ACES tone mapping, a CSS sky gradient on
  the element (`--sw-map-sky`, `--sw-map-sky-horizon`, defined for both designs - the tokens have designs a/b, not a
  dark theme), and the cutaway. Selection per browser: two chips in the element's bar, stored in
  `localStorage` `sw.plan3d.quality` (the `sw.wall.cols` pattern); the installation default is the new setting
  `plan.quality` (`1|2`, default `2`, `settings.py` DEFAULTS, edited on the settings screen next to `plan.levels`).
- **Ambient occlusion:** neither vertex AO nor SSAO. Vertex AO cannot ride on the shared unit box/cylinder of the
  instance groups without a per-instance attribute and a custom shader; SSAO needs the post-processing chain
  (EffectComposer + SSAOPass + depth/normal targets) and a full-screen pass on every frame - the phone budget and the
  chunk cap argue against both. Level 2 bakes a **contact occlusion** instead: one `InstancedMesh` of gradient planes
  under every wall, object and connector box standing on its floor (`AO_SPREAD_M` past the footprint), built with the
  scene, deterministic, one draw call. Recorded as a deviation from §4.1's "vertex AO".
- **Cutaway:** `scene-frame.cutawayIds` - a wall on the camera's side of the extent centre whose outward normal faces
  the camera within 65° is lowered to `CUTAWAY_HEIGHT_M` (0.7 m); the opening parts sitting in it follow (hidden
  above the cut, clipped across it). Decided per camera azimuth quantised to 10° bins centred on the presets' 45°, so
  an orbit re-cuts in steps and float noise never flips a preset's cut; never from a camera preset or from straight
  above; level 2 only.
- **Presets:** `iso` is now a true isometric on an `OrthographicCamera` (the building page's 30° axes: azimuth 45°,
  elevation 35.26°, `ISO_DIR`), framed per floor by `isoFrame` on the extent of the shown levels' plates; the phase-4
  31° perspective view stays as the new `persp` preset; `top` and the camera presets as before. Both levels share the
  presets. The default preset stays `iso` (its meaning changed from the perspective to the true isometric - design
  §10 phase-4 note superseded for the floor map).
- **Thumbnail strip:** the element takes the floor's levels and an all-levels description and draws one small
  isometric per level from the same parts (`SceneView.renderThumbnail`, a render target read back), cached per level
  and bounded by the listed levels with `keepIsos` (the building page's bound). A click selects the level (the
  screen's level filter; the chips agree); the shown level again means every level. Floors are not in the strip:
  another floor's scene is not on the client - the existing floor buttons switch floors.
- **Fallback:** on level 2 the element renders continuously for 2.5 s from its first reported frame and drops to
  level 1 under `minFps` (30) with a note in the map's note style (`data-3d-fallback`), remembered for the session;
  choosing level 2 again measures afresh. Headless Chromium (SwiftShader) falls back by itself; the specs disable the
  probe where level 2 must stay. The state dots on the thumbnails (§4.1 item 1) belong to the state layer, slice 1b.
- **Chunk:** `three` 154.36 → 154.61 KB gzip (Vite's figure; the chunk spec measures 154,074 bytes at gzip -9);
  `sw-plan-3d` 7.41 → 13.23 KB gzip. No post-processing packages.
- **Tests:** `unit-plan-3d-frame.spec.ts` (node: framing maths, cutaway determinism), `unit-plan-3d-quality.spec.ts`
  (browser: level switch and graph equality after a round trip, probe fallback, orthographic preset, cutaway against
  the pure function and the cut height, thumbnail cache bound, visual snapshots per level and preset that must be
  pixel-identical twice and differ between levels - written to `docs/evidence/T087/visual/`, the T007 harness's way),
  the level-2 test appended to `evidence-plan-studio-4.spec.ts` (which now honours `SW_BASE_URL` for its API context so
  it runs against a throwaway instance), `test_plan_estimates_setting.py` for the setting.

Review round 1 (same day) - fixed in the second commit: hidden cut parts (lintels, glass above the cut) collapse on
every axis and park under the floor instead of squashing to a thin bar (they used to float, shadow and take clicks);
the selection outline follows the cut box; thumbnails are drawn in a scissored corner of the main canvas and copied
out, because three applies the output colour space and tone mapping only to the canvas (a render target read back
linear, near-black) - a unit assertion holds a thumbnail's mean luminance within 0.7-1.4 of the view's; the probe
ignores a hidden tab (`visibilitychange` restarts it), runs once per mount or level switch (not per state push), and
opens its window after three warm-up frames (shader compile and shadow-map build are one-off); the all-levels
description is keyed on structure, so the thumbnail cache is not redrawn on state pushes; the floor map hands the
element the installation default so it builds once; level 2 draws the structure in the new `--sw-map-wall-3d` token
(both designs) with dark `map-structure` section caps on the cut walls, the sun from -x so shadows fall toward the
viewer and to the right, and a brighter hemisphere ground. Ruling recorded by the coordinator: `iso` as a true
orthographic isometric is accepted; `persp` keeps the old view.

Frame rate at level 2 (measured in the round, real Chrome, the workstation at 80-90 % CPU from other applications):
the 37-part floor ~50-58 fps; the 3,000-chair floor level 1 29-32 fps against level 2 14-18 fps (an A/B on the same
floor, back to back) - both were vsync-capped at 60 fps on the idle machine earlier the same day. The level-2 cost
on a heavy floor is the per-fragment standard shading of 3,000 chairs covering the view, not the draw calls (7
against 3); above HIDE_SMALL_ABOVE_PARTS the objects now neither cast nor receive shadows (the structure still does),
a modest gain. The live perf gate (>= 20 fps on 3,000 chairs) therefore measures level 1 - the design's instancing
budget (10.4) - and reports level 2 on the same floor; level 2's own budget is slice 1c's, and a device under it
falls back by itself.

## 7b. Implementation record - slice 1b (2026-09-28, branch `pilot/T087-plan-visual-1b`)

Built as specified in §4.1 item 3 and the owner's scope clarification (the 2D map gets the same layer). Facts and
deviations recorded:

- **Room state model** - `frontend/src/map/room-state.ts`, one pure function `roomStates(structure, snapshot, now,
  fade)` shared by the 3D builder, the 2D canvas and the strip. Per room polygon, from the entities anchored inside it:
  `lit` (a light on, a switch on the lights layer on, or a lamp object of the structure glowing by its circuit or its
  own entity), `presence` (a motion / occupancy / presence binary sensor on) with `presenceAge` and `presenceFade`
  (1 while on, then stepping down over the window from the entity's `last_changed`, in 12 quantised steps so the
  scene is rebuilt per step and the same instant gives the same layer), `openings` (door / window sensors, covers with
  an opening class, locks reporting `open` - a bound opening follows its entity, an unbound sensor claims the nearest
  opening within 2 % of the plan width on its level; a room lists the open openings on its boundary), `temperature`
  (the climate's `current_temperature`, else a temperature sensor, the lowest id among equals), `lock` and `alarm`
  states (carried in the model, not drawn yet). Per level: the strongest presence fade, an open opening, a lit room -
  the strip's dots; a sensor in no room still counts for its level.
- **3D** - the layer is part of the scene description (`SceneInput.roomStates`, design rule 4 unchanged: the same
  JSON + tokens + state snapshot give the same description): `room:<id>#lit` (a `tint` prism in `map-lit`, opacity
  0.42), `room:<id>#presence` (`map-presence`, opacity 0.5 × the fade), `open:<id>#j0/#j1/#head(/#sill)` (a `marker`
  frame of instanced boxes in `danger`, following the wall's yaw and the cutaway like the door leaf), `room:<id>#temp`
  (a label sprite - the existing label mechanism, RTL canvas text). Tints are not pickable and never outlined; they
  receive shadows at level 2; level 1 draws the same parts with its Lambert materials - no extra cost. The all-levels
  scene of the strip is built without the layer, so the thumbnail cache is untouched by state; the dots are DOM over
  the cached `<img>` (`data-3d-dots`), the presence dot with the fade as its opacity.
- **2D** - `sw-plan-canvas.roomStates`: tint polygons over the zone's own outline (`data-room-tint`, the presence
  one with `--fade`), the temperature chip under the room's name (`data-room-temp`), a thick red rounded line with a
  dot on an open opening's gap (`data-open-mark`), same tokens (`--sw-map-lit`, `--sw-map-presence`, `--sw-map-temp`,
  `--sw-danger`; both designs).
- **Screen** - `explore-floor-map` derives the layer from the bundle's anchors (their `entity` rows: domain, device
  class, state, `last_changed`, attributes), the structure's openings and lamp objects (once per document) and the
  zones; null on a stale screen or without the sync (like the dimmed pins), and in demo mode. `stateNow` steps at the
  fade's cadence while a tint fades (no timer otherwise). The layer toggle "מצבי חדרים" sits in the layers panel
  (default on, stored per floor like the other late layers as `-states`). The history map and the event page pass no
  layer (a past instant has no live `last_changed` on the client) - a candidate for T041's history.
- **Setting** - `plan.presence_fade` (`off` | 1-120 minutes, default `3`) in `settings.py` DEFAULTS, edited on the
  settings screen under the quality level; read once per floor load.
- **Carried 1a nits** - thumbnails are drawn in a scheduled animation frame outside `render()` and the main frame is
  redrawn at once (`SceneView.redrawNow`); a failed thumbnail is not cached (`data-3d-thumbs` counts the drawn
  ones); a narrow canvas frames the thumbnail on the clamped size (`scene-frame.clampThumb`); the all-levels scene is
  keyed without the level filter (`SceneBuild.structureAll`); the settings wait has a 3 s timeout
  (`timing.withTimeout`, `SETTINGS_WAIT_MS`); the probe's fallback timer is `PROBE_MS + 1500` (`PROBE_FALLBACK_MS`).
- **Chunk:** `three` unchanged (154.60 KB gzip); `sw-plan-3d` 13.9 → 14.61 KB gzip; the entry bundle +~2 KB gzip
  (the model and the canvas layer).
- **Tests:** `unit-room-state.spec.ts` (node: lit / presence fade maths / opening mapping / temperature choice / an
  entity in no room / a room with no entities / determinism / the builder's state parts and the cutaway following /
  the nits' pure pieces), `unit-plan-3d-state.spec.ts` (browser: tints, frame and chip in the scene graph at both
  levels and their absence on a quiet scene, the tint not outlined, the strip dots over an unchanged thumbnail, the
  failed thumbnail not cached, the narrow-canvas thumbnail identical to an explicit request of the clamped size),
  `unit-plan-canvas-state.spec.ts` (browser: the 2D tints / chip / marker, their absence without the layer, the same
  SVG twice, the panel toggle and its storage), the state-layer test appended to `evidence-plan-studio-4.spec.ts`
  (a zone around the lamp, a motion and a temperature sensor through the dev state route: 2D and 3D tints, the
  fade after the motion, the frame, the dots, the level switch keeping the thumbnails, the toggle, the setting),
  `test_plan_estimates_setting.py` for the setting.

Review round 1 (same day) - fixed in the second commit: an unbound door / window sensor never claims an opening that
has a bound entity of its own (a neighbouring door with a closed sensor used to turn red), and the reach is 0.75 m
once the plan is calibrated (the 2 % rule only uncalibrated); the scene's state key carries the layer's signature
(`layerSignature`: the drawn values, never `presenceAge`) and a presence fade step updates the tint materials in
place (`SceneView.setDescription` detects a tint-only change - `tintOnlyChange` - and writes the opacities; each tint
owns its material; no realisation, no shadow-map rebuild - a unit assertion holds the instance groups' identity and
the build count); the layer memo is keyed by identity (bundle, document, layer set, instant, fade, stale flag),
computed once per render; temperature chips are DOM (`data-3d-chip`, kind `chip` in the description, laid out on the
projected point after every drawn frame through `onDraw`, fixed pixel size, RTL, theme tokens); lit + presence blend:
lit = the warm plate alone (0.45), presence = a blue edge ring inside the outline (`insetRing`, 0.18 m, 0.75 × fade)
in 3D and a clipped inset edge band (3.5 px, 0.85 × fade) in 2D, the full blue plate / fill only in a room that is not
lit; the 2D open mark is 6 px with the door's swing wedge filled red and the dot at the leaf's tip, off the pin.
Chunk after the round: `sw-plan-3d` 15.35 KB gzip, `three` unchanged.

## 7c. Implementation record - slice 1c (2026-09-28, branch `pilot/T087-plan-visual-1c`)

Built as specified in §4.1 item 4 (determinism and tests, the phone budget, the fallback) plus the nits carried from
1a/1b. Facts and deviations recorded:

- **Determinism as tests** - `frontend/tests/unit-plan-3d-determinism.spec.ts`. (1) Node: the builder is a pure
  function - the same plan JSON, state snapshot and `now` bucket, each a fresh JSON copy, give the same description at
  every level filter. (2) Browser: for both quality levels and the three overview presets the element realises the
  live description (a lit room with a chip, a fading presence, an open door), then an equal description that is a
  different object (a full realisation, never the tint shortcut), and the whole scene graph - object names, instance
  matrices, transforms, materials with their colours, shadow flags, lights - is `toEqual`, and `capture()` gives the
  same bytes after the rebuild. (3) Pixel baselines per (level, preset, project) under `docs/evidence/T087/visual/`
  (the 1a evidence PNGs are now real baselines, desktop and mobile, the quiet sample floor and - `-state` - the same
  floor with the state snapshot: tints, the red door frame, the chip and the pills), compared in the page pixel by
  pixel: a pixel differs when a channel moves by more than 2/255 (tight on purpose: the same renderer draws the same
  bytes, and a wall token nudged by a few /255 must not pass), at most 0.2 % of the pixels may (today: 0 differing).
  `renderer-<project>.json` records the WebGL renderer that drew them (headless Chromium: SwiftShader); on another
  renderer the comparison is skipped and says so - the determinism tests still run - and `SW_REQUIRE_VISUAL=1` turns
  that skip into a failure for a lane that must compare. Regen:
  `SW_UPDATE_VISUAL=1 npx playwright test tests/unit-plan-3d-determinism.spec.ts --project=desktop --project=mobile`
  from `frontend/` after `npm run build`. The quality spec's visual test keeps its "same pixels twice, levels differ"
  assertions and writes no files any more.
- **Level-2 budget** - the live perf test now asserts level 2 ≥ 30 fps on the 3,000-chair floor and ≥ 45 fps at
  390 px (the design's 30 fps phone floor with headroom, on the workstation's GPU) and ranks the four levers of §4.1.4
  with `SceneView.benchFrames` (frames back to back with a one-pixel readback each: requestAnimationFrame is
  vsync-capped, and the idle workstation reports 60 fps for every configuration - the 14-18 fps of the 1a round were
  measured under 80-90 % CPU from other applications). Real Chrome, 3,000 chairs, level 2, ms per frame, three runs
  (the absolute numbers move with the machine's load; the 1a configuration is "no object shadows"):

  | configuration | 1440 px (run 1 / 2 / 3) | 390 px (run 1 / 2 / 3) |
  |---|---|---|
  | full (object shadows, standard objects, 2048 map, occlusion) | 27.95 / 20.13 / 19.72 | 17.23 / 18.00 / 17.68 |
  | no object shadows (1a) | 28.75 / 19.39 / 18.25 | 14.21 / 14.16 / 14.52 |
  | + Lambert objects | 20.00 / 12.47 / 12.83 | 10.58 / 9.35 / 10.53 |
  | + 1024 shadow map (instead of Lambert) | 27.75 / 17.97 / 19.18 | 14.63 / 14.23 / 14.87 |
  | + no occlusion (instead of Lambert) | 28.91 / 17.68 / 17.39 | 14.06 / 13.68 / 15.18 |
  | Lambert + 1024 map | **19.15 / 9.34 / 10.72** | **10.16 / 7.85 / 8.04** |
  | all four | 19.30 / 9.26 / 10.15 | 10.62 / 8.36 / 9.38 |

  Decision: `HEAVY_CONFIG` = no object shadows + Lambert objects + the 1024 shadow map, the contact occlusion kept.
  The Lambert objects take 30-35 % off a frame at 1440 px and 25-35 % at 390 px in every run (the per-fragment
  standard shading of the chairs covering the view was the cost, as 1a suspected); the object shadows ~17 % at
  390 px; the smaller map gains nothing on its own but 15-25 % more on top of Lambert in two runs of three (once the
  shading is cheap the shadow pass is a visible share) - a heavy floor gets 2 cm shadow texels instead of 1 cm under
  the PCF blur; the dropped occlusion stays inside the noise and would leave the chairs floating. Applied above
  `HIDE_SMALL_ABOVE_PARTS` (3,000 parts) - the one heaviness threshold of the view, shared with the far-camera hiding
  of small objects - deterministically for every device; the element's probe then measures that configuration
  against `DEFAULT_MIN_FPS` (30, the design's floor), so a phone under it falls back to level 1 and never runs the
  full configuration of a heavy floor. `SceneView.setHeavyConfig` exists for measurement only. Vsync-capped fps
  before/after: 60/60 on every floor and width (the gates hold with the cap); uncapped cost before (1a) → after:
  1440 px 28.75 → 19.15 ms (run 1), 19.39 → 9.34 (run 2), 18.25 → 10.72 (run 3); 390 px 14.21 → 10.16,
  14.16 → 7.85, 14.52 → 8.04.
- **Carried nits** - the presence ring is 0.3 m (`PRESENCE_RING_W_M`), and `insetRing` gives no ring at all where the
  room is narrower than twice the band anywhere (a corridor, the arm of a concave room: an inset edge reversed or
  emptied, a crossing, the area gone - the folded ring would draw a blot); the DOM labels of the element are matched
  to their parts by `data-3d-part` id, never by DOM order, and derived in `willUpdate` from the description (no second
  Lit update per description); the entity pills are DOM labels like the temperature chips (`data-3d-label`, the state
  token as the colour, RTL, fixed pixel size, hidden behind the camera, standing on the point with the bottom edge a
  6 px gap above it so the object under it stays clickable from straight above; no Tab stops - the list and the
  inspector select by keyboard; only the shown level's pills under a level filter; above `PILL_CAP` = 60 pills at the
  overview only the selected, the hovered and the alerting ones - a token other than text-3 - with a "+N" hint,
  `data-3d-more`; review nits of 1c), a click on a pill selects the entity as its sprite used to (`part-select`), the
  selected pill carries the accent ring (nothing in the scene to outline), and
  `renderThumbnail`, the raycaster and the glTF no longer see a sprite for an entity - the description is unchanged
  (`ent:` parts keep `shape: 'sprite'`; the element decides how to draw them, as with the chips).
- **The two pre-existing mobile failures** (`unit-floor-map-3d:10`, `unit-plan-3d:86`) - the brief's hypothesis
  (pointer-events / z-order of the room rect over the marker) was not the cause; both were the specs assuming the
  desktop layout. (1) The 1.6 × zoom of the first spec zooms about the viewport's centre, and on the 390 px phone that
  pushes the first camera (at 9 % of the plan width) past the left edge; Playwright clips the marker's box to the
  viewport and clicks the visible sliver's centre, which lies beside the pin (off screen) and outside the 70° cone, on
  the demo room rect under it - measured with a forced click at (12, 463): the pin at x = -42..-16. The spec now pans
  the pin on screen first (`centerOn`, the user's pan) and expects the phone's card to be a drawer (the screen's 767 px
  rule) rather than a popover. (2) The phone hides the tool row's layer buttons by design (`.tools .layers` is
  `display: none` under 640 px) and offers the same layers in the "שכבות" panel; the spec toggles whichever control
  the layout shows, and types its "3" into the 3D bar's camera select (a select on every layout) instead of the
  desktop-only floor select. No product code changed for these; the assertions did not weaken.
- **Chunk:** `three` unchanged (154.60 KB gzip); `sw-plan-3d` 15.35 → 16.06 KB gzip (the pills, the configuration, the
  two measurement hooks).
- **Tests:** `unit-plan-3d-determinism.spec.ts` (3 tests × desktop / mobile), the pills test in `unit-plan-3d-state`,
  the narrow-room cases in `unit-room-state`, the view spec's sprite count moved to the DOM pills; all 3D/2D unit
  specs green on desktop and mobile (110); the live `evidence-plan-studio-4` on a throwaway backend in real Chrome
  (the perf test with the new gates and the lever table).
- Not in this tree: a 0.1.116 changelog entry (the 1b merge carried none; the release step writes it).

## 7d. Implementation record - slice 2a (2026-09-28, branch `pilot/T087-plan-skins-2a`)

The foundation of §4.2 items 1 and 3 plus the privacy / budget part of item 3; the render-set proposal, real sends,
skin storage, the acceptance overlay (2b) and compositing (2c) are not built. **No floor picture is sent anywhere in
2a**: the only request that can leave the installation is the owner's connection test with a synthetic pattern.

- **Settings: a `skins.*` family, not the T063 `ai.*` keys** (decision recorded here). `ai.provider` / `ai.privacy_ack` /
  `ai.budget_daily` belong to the search's analysis provider (event metadata; `external` is refused because none is
  bundled). A skin sends a floor picture to an image provider - different data, a different consent, a different
  budget unit - so reusing `ai.privacy_ack` would let one acknowledgement silently cover the other. New keys
  (`routers/settings.py`): `skins.provider` (`openai` only), `skins.model` (default `gpt-image-1.5`, the official SDK's
  default for edits), `skins.privacy_ack` (`false`), `skins.budget_renders_per_floor` (4, 0-6), `skins.budget_monthly`
  (20, 0-500). All edited with `system.configure` and audited through `settings.update`.
- **Key**: the add-on option `openai_api_key` (`config.yaml` options + schema `password?`, `config.Settings`,
  env fallback `OPENAI_API_KEY`) - never in the DB, never logged, never in audit rows or error payloads;
  `services/skins/provider.redact` strips the key, bearer tokens and `sk-…` shapes from every provider message
  (the `go2rtc.redact_url` rule for free text). `GET /skins/status` says only `key_configured`.
- **Provider interface** - `services/skins/provider.py`: `SkinProvider` (`render(control_png, prompt, options) ->
  RenderResult` with bytes, provider, model, cost estimate, HTTP status, usage, request id; `estimate(options)`;
  `capabilities()`), one implementation `OpenAIImageProvider`, errors as `SkinProviderError` (redacted message, the
  provider's status and code). A test swaps the factory on `app.state.skin_provider_factory`; no test touches the
  network (a fake provider and an `httpx.MockTransport`).
- **The OpenAI request shape - verified** on 2026-09-28 against OpenAI's official material: the image-generation guide's
  edit example (`POST https://api.openai.com/v1/images/edits`, `multipart/form-data`, `Authorization: Bearer`, fields
  `model`, `image[]` as a file, `prompt`) and the official Python SDK's types (`image_edit_params.py`: `size`
  `1024x1024|1536x1024|1024x1536|auto`, `quality`, `output_format`, `n`; `images_response.py`: `data[].b64_json`,
  `usage.input_tokens / output_tokens / total_tokens`; `response_format` is for the DALL-E models only and is not
  sent). The platform.openai.com API reference page itself answered 403 to the fetch; the guide and the SDK were
  read instead. **Not verified**: per-image prices (the pricing page lists token prices only) - `estimate()` is a
  labelled rough figure (`basis: estimate_unverified`, NEEDS_VERIFICATION in the code); the reply's token usage is
  recorded as the fact. Sent by 2a: `model`, `prompt`, `size`, `quality`, `output_format=png`, `n=1`, `image[]`.
- **Exactly what can leave** (shown word for word on the settings card, `routers/skins.LEAVES / NEVER_LEAVES`): our
  schematic control image (level-2 isometric render: walls, openings, floor plates, furniture, room colour; no labels);
  the original plan image only when the sender chooses it per send (2b's send dialog, §7.2 decision); the product's
  fixed prompt. Never camera stills, people, labels / room / entity names, sensor states or HA data, addresses, site
  names or ids. In 2a concretely: only the 64x64 test pattern and the fixed test prompt.
- **Records and budget** - migration `0027_plan_skins.sql`: `plan_skin_renders` (floor, level, state key, provider,
  model, prompt version, control-image hash, geometry key, `sent_plan_raster`, cost estimate, status, HTTP status,
  error code, usage, image path, `test`, `accepted`, created_by/at - the shape 2b/2c reuse; 2a writes only `test = 1`
  rows) and `plan_skin_controls`. The budget counts `status = 'ok'` rows: monthly per installation in the site's zone
  (`time.zone`; tests count - they are paid requests), per floor and geometry key for real renders (a changed structure
  is a new allowance; the monthly cap bounds the total). A provider error is recorded (when the provider answered) but
  not counted. `services/skins/store.Budget` holds the arithmetic.
- **Connection test** - `POST /skins/test` (`system.configure`), the settings button "בדיקת חיבור לספק הרינדור":
  refused (409, audited `skins.test` denied, nothing sent) without the acknowledgement, then without the key, then
  when the monthly budget is spent; otherwise the attempt is audited and committed before the send (`unlocked`), ONE
  deterministic 64x64 pattern (colour bars over a checkerboard, no text chunk) goes with a fixed prompt at
  `1024x1024` / `low`, a `plan_skin_renders` row flagged `test` is written and the outcome audited; the reply status is
  shown, and the returned picture when there is one (not stored).
- **Control image** - `frontend/src/map/skin-control.ts` (pure): `controlSceneInput` replaces every live value by a
  synthetic state (`all_off`, or `all_on`: every room lit, every circuit and bound lamp on), blanks room and anchor
  names, turns cameras and entities off; `controlDescription` keeps floor plates, rooms, walls with their parts, doors,
  windows, objects, connectors (plus the lit plates and glows in `all_on`) and drops every sprite, label, chip, entity,
  camera, cone, marker and presence tint whatever the input carried. `scene-three.renderControlImage` draws it with a
  fresh level-2 `SceneView` on an off-screen mount at 1536x1024 (OpenAI's landscape edit size, so the answer shares
  the pixel grid for 2c's masks), pixel ratio 1 (new `SceneViewOptions.pixelRatio`), the `iso` preset framed on the
  description's extent (a fixed camera matrix per geometry), flattened on a fixed white backdrop, then disposed -
  nothing of the viewer's orbit, quality, fallback or theme sky reaches it (the design tokens a/b do). `sw-plan-3d.
  captureControl(desc)`; the floor map's 3D tool row shows "תמונות בקרה" to `map.edit` holders on an API floor: it
  refuses unless the map shows the published structure, captures both states and uploads them.
- **Upload** - `POST /floors/{id}/skins/control-image` (multipart `state`, `geometry_key`, `file`; `map.edit` on the
  floor): the geometry key = SHA-256 of the published structure's `doc_hash` and the floor's rooms (id, level,
  outline) - `GET /floors/{id}/skins` hands it out; a stale key is 409 `geometry_changed`, no published structure 409
  `no_geometry`. PNG validated by bytes: signature, a chunk walk with CRCs, only critical and colour chunks (a
  `tEXt`/`zTXt`/`iTXt`/`eXIf` chunk is refused - no label rides along as metadata), decodable, exactly 1536x1024,
  8 MB cap. Stored as `<data>/skins/<floor>/control-<state>-<key16>.png` (one per floor and state; a new key replaces
  the old image), never served by any route, deleted with the floor (`catalog.delete_floor`, counted in the
  `floor.delete` audit). The response says whether the bytes equal the stored ones for the same key.
- **Deviation / limits recorded**: the control image is drawn in the current design's tokens (a/b), so switching the
  design changes the bytes; the anchors that position bound bodies come from the uploader's bundle (a camera the
  uploader may not see is absent - an editor normally sees all). Skins in the project export/backup are 2c's.
- **Tests**: `smplwise_vms/backend/tests/test_plan_skins.py` (16: settings defaults/validation/permission, the key
  option and env fallback and config.yaml, status without the key, the test refused without ack/key/budget and
  nothing sent, the test flow with a fake provider (one fixed pattern, the row, the two audit rows), provider errors
  recorded-not-counted and redacted in the reply / audit / log, budget arithmetic and the month boundary in the site
  zone, budget counting per month / floor / key, the upload's validation / permission / keying / key change / deletion
  with the floor, no published structure, the OpenAI multipart shape and reply parsing on a mock transport, redaction,
  the interface); `frontend/tests/unit-plan-skin-control.spec.ts` (node purity + browser capture: fixed size, opaque, no
  text chunk, identical bytes on repeated calls and under another viewer quality/preset, different per state, labels
  visible only without the filter, the view untouched; desktop + mobile); `frontend/tests/evidence-plan-skins.spec.ts`
  (live, a throwaway backend without a key: the settings card and both refusals through the UI, the floor-map button
  uploading both states and a second press reported identical). The 1c determinism, chunk and floor-map 3D specs re-run
  green.

## 8. Next step

Owner answers §7; then 1a is dispatched from this document with the same implementer → reviewer → fix-round loop
as CR-005, starting from `scene-three.ts`.
