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

## 8. Next step

Owner answers §7; then 1a is dispatched from this document with the same implementer → reviewer → fix-round loop
as CR-005, starting from `scene-three.ts`.
