# PLAN3D-POLISH-2430 — 3D map polish (no-mockup items)

Branch `pilot/PLAN3D-POLISH-2430` from `main` a5618fad6 (v2.42.1). Scope: the items of the read-only 3D review that need no
new design mockup. Grouped pills, the room card on tap, stacked floors and the plan-image wizard are the design agent's and
are not built here. No version bump, CHANGELOG or API inventory; no migration; nothing outside the 3D map changes visually
(the floor map and the event page only pass more data to the 3D builder).

## What changed, per item

| # | Item | Change | Files |
|---|------|--------|-------|
| 1 | Pill words | The entity pills call `api/ha` `stateLabel` (the formatter of every other screen) with the entity's domain, device class, unit and the attributes it reads. A door sensor says `פתוחה` / `סגורה`, motion `תנועה`, a thermometer `21.4 °C`, a light `דולק · 50%`; an entity without a known device class says `פעיל`, never `דולק`. New optional `SceneAnchor.entity_meta` (`entityMeta()` keeps only domain, device class, unit and the three attributes the words read). The floor map passes it (and keys the scene state on it), the event replay passes it without today's attributes. The builder's own `STATE_HE` map is gone. | `map/scene-builder.ts`, `screens/explore-floor-map.ts`, `screens/investigate-event-detail.ts` |
| 2 | Fit the floor | The live element (`SceneView` option `fit: 'content'`) frames the overview presets on what the floor **draws** (walls, openings, furniture, rooms, cameras: `scene-frame.contentExtent`) instead of the floor plates - the default level's plate is the whole plan sheet, so a plan with white margins framed its margins. The box is fitted into the stage **less its overlays** (the element's bar, measured; the host's top band of floor buttons / level chips on a stage at least 480 px tall; a 12 px margin) in every preset: iso (`isoFitFrame`, orthographic), perspective and top (`perspFit`, the nearest distance whose projection fits, then a slide so the box sits centred in the free part). It re-fits on a resize, on a new extent (a level shown alone, all levels again) and when the overlays change - until the person orbits / pans / zooms (OrbitControls `start`); picking a preset fits again. The stills, the skin control image and the thumbnails keep the old plate frame (their pictures and masks depend on it). | `map/scene-frame.ts`, `map/scene-three.ts`, `map/sw-plan-3d.ts` |
| 3 | Room name plates | Room and plan names are DOM plates in the live element (no sprite there any more): `--sw-fs-sm`, weight 600, body ink on the opaque menu surface, RTL, a navy plate on the night picture of levels 1-2. With every level shown only the top level's names show (the lower ones stood through the upper floor); none in the walk. The pill overlap pass now includes the plates and the temperature chips, so a room name, its reading and an entity pill never cover one another. | `map/sw-plan-3d.ts`, `map/scene-three.ts` |
| 4 | Night readability | Levels 1-2 at night: a faint cool, shadowless fill light from the overview cameras' side (0.55 at level 2, 0.35 at level 1), so the outer walls the camera sees no longer sink into the sky; the stage's night backdrop gains a soft ground glow under the building. Level 3's night rig is untouched (the realism agent's area). | `map/scene-three.ts`, `map/sw-plan-3d.ts` |
| 5 | Sky arc | At level 3 in perspective the exterior's fixed rings showed as an arc across the top of the frame: the sky dome's ground / sky seam (a circle round the building), the 55 m hill band and the ground disc's fading rim. In perspective the dome now follows the camera (its seam is the true, straight horizon at eye level), the hill band shows only near eye level (the walk, a low orbit) and the ground disc grows so its opaque part reaches past the ground point of the frame's top ray. The orthographic overview keeps the exterior as built. | `map/scene-three.ts` (`followSky`) |
| 6 | Light pool | The 8 glow point lights are in the scene only where they light something (`scene-frame.glowPoolWanted`): always at levels 2 and 3, at the schematic level only while a glow holds one of them. **Deviation from the brief:** the brief said "only at realistic-lite / realistic", but level 2 uses the pool for the lit rooms' glow (the night picture's warm rooms) and level 1 for a glowing lamp, so removing it there would change the look; the cost saving applies to the unlit schematic floor - the weak-device rung. The pool moves only on a level switch or when the schematic floor's first lamp goes on / last goes off (one recompile), never per state push. | `map/scene-three.ts`, `map/scene-frame.ts` |
| 7 | Context loss | `webglcontextrestored` now also rebuilds, at level 3, the post chain (its render targets) and the prefiltered environment (a new PMREM generator and target from the dome), besides re-marking the shadow map; three re-uploads programs, buffers and textures itself. | `map/scene-three.ts` |
| 8 | `auto` start | Owner decision: `auto` starts at **realistic lite** on a capable GPU. `quality-ladder.gpuClass` reads the renderer string (WEBGL_debug_renderer_info), WebGL 2, the texture limit, cores and memory: capable (known able families: NVIDIA / AMD Radeon / Apple M & Apple GPU / Intel Iris Xe & Arc / Adreno 6xx+ / Mali-G5x+ / Immortalis / Xclipse, with WebGL 2, >= 4096 px textures, >= 4 cores and >= 4 GB where the browser says), weak (software renderers, old families, small devices) or unknown (masked or unlisted). `webgl.ts` reads the facts once per page from a throw-away context it releases. `autoStart(defaultView, installLevel, gpu)`: capable -> lite; weak / unknown keep the start of before (full, or the installation's level). A rung the person chose still sticks, the probe still steps `auto` down one rung at a time, and with no setting at all (the static demo) the view stays schematic. CR-029's R178 rule carries the amendment. | `map/quality-ladder.ts`, `map/webgl.ts`, `map/sw-plan-3d.ts`, `docs/changes/CR-029-PLAN-STUDIO-6-REALISTIC-3D.md`, `tests/evidence-plan-studio-6.spec.ts` (comment; the auto test pins `gpu = 'weak'`) |
| 9 | Merge furniture | **Skipped.** Levels 1-2 already draw furniture as one InstancedMesh per shape / colour / opacity group; the draw calls that remain are level 3's realistic objects, built in `scene-real*.ts`, which the parallel realism agent (`pilot/PLAN3D-REALISM-2432`) is reworking now - merging there would conflict with it and needs per-room material atlasing. Measured for the record: realistic lite on the dense mocked floor (2 levels x 12 rooms) draws **209 calls / 44,400 triangles** a frame (SwiftShader, `lastFrameInfo`). Proposed as a follow-up after the realism branch lands. | - |

## Before / after

Shots on the live floor map with the mocked dense house (`tests/perf-3d-mocks.ts`: two levels of 4 x 3 named rooms, door sensors,
thermometers, power meters, lamps, furniture), desktop 1440 x 900, headless Chromium (SwiftShader):

| View | Before | After |
|------|--------|-------|
| Day, iso (full) | `evidence/PLAN3D-POLISH-2430/before/day-iso.png` | `evidence/PLAN3D-POLISH-2430/after/day-iso.png` |
| Night, iso (full) | `before/night-iso.png` | `after/night-iso.png` |
| Perspective (full) | `before/perspective.png` | `after/perspective.png` |
| Schematic, iso | `before/schematic-iso.png` | `after/schematic-iso.png` |
| Dense, realistic lite, iso | `before/dense-lite-iso.png` | `after/dense-lite-iso.png` |
| Realistic lite, night | `before/night-lite-iso.png` | `after/night-lite-iso.png` |
| Realistic lite, perspective (the sky arc) | `before/lite-perspective.png` | `after/lite-perspective.png` |
| Realistic lite after a forced context loss | - | `after/lite-after-context-restore.png` |

What the pictures show: the pills read `פתוחה` / `תנועה` (before: `דולק`); room names are readable plates (before: not
visible at all - floor-height sprites under the furniture); the night outer walls keep their outline over a soft ground glow;
the lite perspective has no hill / horizon arc across the top.

## Numbers (relative: headless Chromium on SwiftShader, the mocked dense floor, 1440 x 900; never a phone's absolute cost)

| Measure | Before | After |
|---------|--------|-------|
| Realistic lite, iso: draw calls / triangles per frame (`lastFrameInfo`) | 209 / 44,400 | 185 / 44,352 (the 24 room-name sprites are DOM plates now) |
| Glow point lights in an unlit schematic scene (`glowLightsInScene`) | 8 (always) | 0 |
| Iso: building's bounding box, share of the stage width x height | 0.650 x 0.897 | 0.611 x 0.842 of the stage = **0.974 of the free part** (stage less the bar / top band / margin) |
| Perspective | 0.640 x 0.889 | 0.641 x 0.881 = 1.02 of the free part (the plate's corner passes the walls' box a little) |
| Top | 0.598 x 0.764 | 0.626 x 0.800 = 0.93 of the free part |
| Iso after a resize to 1100 x 800 | 0.647 x 0.895 (old frame widened) | 0.975 of the free part (re-fitted) |
| Level-3 perspective, top 6 % band: max brightness spread per row (an arc shows as a step) | 163 | 0 |

On this mocked floor the walls run edge to edge of the plan sheet, so the content extent equals the plate and the gain shows
as "fills the free part" (the building no longer sits under the bar / the host's top controls). The large gain is on a plan
whose sheet has white margins round the building (the review's ~50 % case): `contentExtent` drops the margins - pinned by
`unit-plan3d-polish-2430.spec.ts` (a room in the middle 30 % of the sheet frames to under 75 % of the sheet on both axes).
Honest limit: the before-row of the sky band was taken with an earlier version of the readback helper; the after-row with the
final one (both read the drawn frame of level 3, which keeps its buffer through the post chain).

## Tests

All commands from `frontend/` with Node 24 (fnm) on the workstation (Windows 11, headless Chromium + SwiftShader); the preview
of this branch's build on port 4391 (`npx vite preview --host 127.0.0.1 --port 4391 --strictPort`, `SW_BASE_URL=http://127.0.0.1:4391/`).

| Command | Exit | Result |
|---------|------|--------|
| `npx tsc --noEmit` | 0 | clean |
| `npx vite build` | 0 | built |
| `python scripts/gate/lint_spec_waits.py frontend/tests/evidence-plan3d-polish-2430.spec.ts frontend/tests/unit-plan3d-polish-2430.spec.ts` (repo root, Python 3.12) | 0 | 0 findings |
| `npx playwright test -c playwright.unit.config.ts tests/unit-plan3d-polish-2430.spec.ts` | 0 | 11 passed (items 1, 2 maths, 6, 8) |
| `npx playwright test -c playwright.unit.config.ts <28 node unit specs matching plan-3d / plan3d / scene / replay-3d / floor-map-3d / wall-plan / studio / anchor-3d / quality>` | 0 | 143 passed (before the last two fixes; rerun below) |
| `SW_UNIT_PAGES=1 npx playwright test -c playwright.unit.config.ts tests/unit-floor-map-3d tests/unit-plan-3d-{determinism,kiosk,look-r3,odd,perf,quality,realistic,state,view,walk}.spec.ts tests/unit-plan-3d.spec.ts --workers=2` (first run) | 1 | 50 passed, 9 failed, 4 skipped - the 9: the visual baselines (expected), and 8 assertions of the old behaviour (pill word "לא נעול", a meter reading not drawn, the iso / top target at the plate centre, the cutaway azimuth from the extent centre, the chip / pill positions) |
| same 5 affected files after the fixes (`unit-plan-3d-{determinism,perf,quality,state,view}.spec.ts`) | 1 | 34 passed, **1 failed: `unit-plan-3d-determinism` visual baselines** (`plan-3d-l1-iso-desktop.png`: 28 % of pixels differ - the new framing; expected, see below) |
| `SW_SHOTS=after npx playwright test tests/evidence-plan3d-polish-2430.spec.ts --project=desktop --workers=1` | 0 | 7 passed (shots, 1, 2, 3, 5, 6, 7) |
| same spec without the shots after the last fixes (`-g "^(?!.*shots)"`) | 0 | 6 passed |
| final rerun: 30 node unit specs (the list above + `hud`) | 0 | 170 passed |
| final rerun: `SW_UNIT_PAGES=1 ... tests/unit-plan-3d-odd.spec.ts tests/unit-hud-layout.spec.ts` (the pill-overlap pass changed) | 0 | 3 passed, 3 skipped |

What the spec changes mean for the gate: `unit-plan-3d-perf` (a meter reading is now a live change of its pill, the lock reads
`פתוח`), `unit-plan-3d-quality` (the iso target is `isoFitFrame(contentExtent)` in the free part), `unit-plan-3d-view` (the
top camera is `perspFit` straight down), `evidence-plan-studio-6` (comment + the auto test pins `gpu = 'weak'`; **NOT_RUN
here**, 5-minute probe test). The cutaway now takes its azimuth from the view direction (camera - target): the target slides
off the extent centre, the preset's azimuth stays 45 deg.

NOT_RUN (the lead runs them on the runner): the full suites (evidence / layout / pixel / visual), the mobile and tablet
projects of the new evidence spec (desktop only by design), the SW_PERF_GATE measurement, every pixel comparison (the
baselines are Linux / runner-renderer specific).

## Pixel / visual baselines expected to change (not updated here; the lead refreshes them on the runner)

- `docs/evidence/T087/visual/plan-3d-l{1,2}-{top,iso,persp}[-state]-{desktop,tablet,mobile}.png` and
  `plan-3d-element-l{1,2}-*.png` (unit-plan-3d-determinism / unit-plan-3d-quality: the live element's framing, the room
  names now DOM plates instead of sprites; `-state` night variants also the night fill).
- `frontend/tests/evidence-replay-3d.spec.ts-snapshots/*` (history / event 3D at level 3: framing, room plates, the
  perspective sky).
- `frontend/tests/pixel-walk-touch.spec.ts-snapshots/*` (the walk at level 3: the dome follows the camera, the hill band
  stays at eye level; no room plates in the walk - unchanged there).
- Any visual-matrix / lookdev picture of the 3D floor map (`lookdev-studio6.spec.ts` pictures) for the same reasons.
- Not expected to change: the 2D map, the stills (`still-bake`), the skin control image and the level thumbnails (they keep
  the plate frame and the label sprites).

## Known limits

- The evidence spec's level-change step (a click on the strip's second level) printed the same box as the resize step just
  before it: on the mocked house both levels share one footprint, so it does not prove the re-fit on a level change by
  itself. The re-fit on a new extent is code-reviewed (`SceneView.setDescription` -> `refit()` when `contentExtent` changed)
  and the maths unit-tested; a floor whose levels differ in footprint would show it - not exercised here.
- The fit uses fixed pixel bands for the host's top controls (52 px on a stage at least 480 px tall) and the element's
  measured bar; the host's side columns (the circuit buttons on the left of the floor map) are not measured.
- Phone and tablet projects of the new evidence spec are not run (desktop only).

## Rollback

Revert the branch's commits; no data, setting or migration is involved.

## Open owner questions

1. מצב "אוטומטי" במכשיר שכרטיס המסך שלו לא מזוהה (דפדפן שמסתיר את שם הכרטיס, דגם לא מוכר): עכשיו הוא מתחיל כמו קודם ("מלא").
   א. להשאיר כך
   ב. להתחיל בסכמטי (זהיר יותר)
   ג. לנסות ריאליסטי קל ולתת לבדיקת הקצב להוריד
2. שמות החדרים כשמוצגים כל המפלסים: עכשיו רק שמות המפלס העליון (התחתונים עמדו "דרך" התקרה).
   א. להשאיר כך
   ב. להציג את כל המפלסים
   ג. להציג רק כשבוחרים מפלס
3. מקום לפקדים העליונים של המסך (כפתורי קומה ומפלסים): המסגור שומר רצועה של 52 פיקסלים למעלה, ולכן הבניין מעט קטן יותר במסך רחב ונמוך.
   א. להשאיר כך
   ב. לוותר על הרצועה (בניין גדול יותר, ייתכן מתחת לפקדים)
4. איחוד הרהיטים לחיסכון בציור (סעיף 9) לא נעשה בגלל עבודת הריאליזם שרצה במקביל.
   א. לעשות אחרי שענף הריאליזם ימוזג
   ב. לוותר
