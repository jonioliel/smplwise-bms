# PERF3D-295 — the 3D plan view on a phone: harness, bottlenecks, fixes, proposal

Owner report (2026-10-20): Studio 6 / the 3D plan "looks fine, maybe slightly slow" on a real phone. This pass measures the live
floor map's 3D view (`sw-plan-3d` + `SceneView`) on a phone-sized screen, fixes what is safe without changing the picture, and
puts everything that would change the picture into the proposal at the end.

## 1. The harness

- `frontend/tests/perf-plan-3d.spec.ts` (runs only with `PERF_RUN=1`) and `frontend/tests/perf-3d-mocks.ts` (mocked backend and
  mocked HA push socket; a generated house: 2 levels x 12 rooms, 12 wall runs, 62 doors and windows, 168 objects, 102 HA entities,
  2 cameras, 4 circuits; no device, no network beyond the page).
- Phone: 390 x 844 CSS px, device pixel ratio 3 (`PERF_DSF`), touch; CPU throttling x4 through the DevTools protocol (`PERF_CPU`).
- Phases: load (toggle -> ready -> first frame -> thumbnails -> probe settled), rotate (one-finger CDP touch drag, 60 moves),
  zoom (two-finger pinch, 60 moves), idle (5 s), live (12 HA pushes 400 ms apart: power and temperature readings alternate).
- Numbers per phase: rAF frame intervals, scene frames and their main-thread cost (`SceneView.frame` wrapped), the label layout's
  cost, long tasks, Lit updates of the 3D element / the floor map / the hidden 2D canvas, CDP Performance metrics (layouts,
  style recalcs, script and task time); static: GPU-synchronised frame cost (`benchFrames`), draw calls, triangles, programs,
  drawing buffer, shadow map, textures, thumbnail bytes, DOM elements, JS heap. `PERF_TRACE=1` saves a DevTools trace of the zoom.
- Run: `SW_BASE_URL=http://127.0.0.1:<vite>/ PERF_RUN=1 PERF_RUNG=full PERF_OUT=<dir> npx playwright test tests/perf-plan-3d.spec.ts --project=mobile --workers=1`
  (`PERF_RUNG`: schematic | full | lite | realistic). Results append to `<dir>/results.jsonl`.
- Limits: headless Chromium draws WebGL with SwiftShader (a CPU renderer), so GPU cost is not a phone GPU's; all numbers are
  relative (A/B in the same conditions). A real phone is needed for absolute frame rates (section 5).

## 2. Ranked bottlenecks (runner, CPU x4, medians of 3 A/B pairs; base = integ/293 90a50db90)

| # | bottleneck | evidence (base) | status |
|---|---|---|---|
| 1 | Fill cost at device ratio 2 (levels 1-2 draw at min(2, dpr): 780 x 1198 with MSAA, PBR + shadow sampling) | GPU-synced frame 123-131 ms at full, 78 ms schematic; every gesture frame is a 170-230 ms long task of which our JS is 5-9 ms; ratio 1.5 cuts the frame 24 %, ratio 1 cuts it 57 % (section 4) | look change -> proposal P1 |
| 2 | Every live HA push that touches the floor rebuilt the whole 3D scene (graph, instancing, shadow map, cutaway, labels) - also for readings the 3D never draws (a meter's watts) and for label-only changes (a temperature chip) | 9-12 full rebuilds per 12 pushes; worst long task 284-407 ms (schematic / full), 1.6-2.0 s at the lite rung | fixed |
| 3 | The level-2 sun shadow map was redrawn on every frame although it depends only on the casters and the fixed sun | 175 draw calls / 19.6 k triangles per frame vs 134 / 10.8 k without the pass; a 2048^2 depth target redrawn per frame | fixed (pixel-identical) |
| 4 | Per-frame label layout read the mount's box between label style writes (a forced style pass) and rewrote every label's display and transform | label pass 1.2-1.5 ms per frame (throttled), 450-520 style recalcs per gesture | fixed |
| 5 | The 3D element re-rendered on every render of the floor map (a new `levels` array each time) | 23-24 Lit updates of `sw-plan-3d` per 12 pushes | fixed |
| 6 | The floor map and the hidden 2D canvas re-render on every push | 24 updates each per 12 pushes; after the fixes the whole live phase costs 39-138 ms of script | measured, left as is (small) |
| 7 | The walk's minimap read 11 computed style tokens on every pose (every walk frame) | not covered by the harness (the walk is not driven) | fixed, NOT measured |
| 8 | Load: settings + scene + the frame-budget probe (continuous frames for ~2.5 s after open) | ready 2.2 s schematic / 2.8 s full / 5.8 s lite; settled 2.3 / 7.0 / 11.7 s | unchanged (probe is design behaviour) |

Static footprint (full rung, phone): drawing buffer 780 x 1198 (~11 MB), shadow map 2048^2 (~34 MB estimate), textures ~6 MB,
2 thumbnails 33 KB, ~1,900 DOM elements, JS heap ~100-110 MB.

## 3. What changed (no visual change)

- `scene-three.ts`: the shadow map is drawn only when a caster or the sun changed (`shadowMap.autoUpdate = false` at every level;
  `markShadows()` on a new graph, the sun fit, a cutaway change, a small-object visibility change, a restored context). A unit
  test proves the cached map draws the same pixels as a freshly drawn one after an orbit.
- `scene-three.ts`: `liveOnlyChange()` keeps the graph when only tint opacities or DOM labels (chips, pills) changed;
  `projectPoints()` projects the labels in one batch without reading the mount's box.
- `scene-equal.ts` + `explore-floor-map.ts`: a push that builds an equal description keeps the shown object (the 3D does nothing).
  `SceneView` itself still realises an equal description handed to it (the replay determinism specs rely on that).
- `sw-plan-3d.ts`: label styles written only when they change, label elements listed once per render; `levels` / `levelDots`
  compared by value; the walk minimap's palette cached per walk and theme.

## 4. Before / after (runner, mocked house, phone 390 x 844 @3, CPU x4; medians of 3; base -> fix)

| metric | schematic | full (default) | lite |
|---|---|---|---|
| live: full scene rebuilds / 12 pushes | 12 -> 0 | 11 -> 0 | 3 -> 0 |
| live: worst long task | 284 -> 108 ms | 381 -> 192 ms | 1,862 -> 247 ms |
| live: long-task time | 3.4 -> 0.9 s | 4.1 -> 1.6 s | 6.5 -> 3.8 s |
| live: script time | 576 -> 138 ms | 527 -> 62 ms | 688 -> 110 ms |
| live: `sw-plan-3d` updates | 24 -> 12 | 23 -> 12 | 16 -> 10 |
| rotate: label pass per frame | 1.5 -> 0.7 ms | 1.3 -> 0.7 ms | 1.3 -> 0.5 ms |
| rotate: scene frame JS (p50) | 4.7 -> 3.9 ms | 6.5 -> 5.1 ms | 8.2 -> 6.5 ms |
| rotate: style recalcs | 474 -> 322 | 460 -> 312 | 460 -> 308 |
| rotate: long-task time (60 moves) | 21.9 -> 18.2 s | 32.7 -> 32.9 s | 48.3 -> 44.0 s |
| zoom: label pass per frame | 1.4 -> 0.6 ms | 1.2 -> 0.6 ms | 1.2 -> 0.4 ms |
| zoom: style recalcs | 452 -> 332 | 513 -> 331 | 523 -> 391 |
| zoom: long-task time | 17.3 -> 16.3 s | 27.5 -> 30.7 s (noise: runs 26.5-30.6 vs 28.6-34.2) | 42.1 -> 39.6 s |
| draw calls / triangles per frame | 132 / 10.2 k (same) | 175 / 19.6 k -> 134 / 10.8 k | 209 / 44.4 k (same) |
| GPU-synced frame (SwiftShader) | 78 -> 71 ms | 131 -> 134 ms | 215 -> 210 ms |
| load: ready | 2.2 -> 2.0 s | 2.8 -> 3.1 s | 5.8 -> 5.1 s |

Reading: the live-push freezes are gone (the biggest felt win on a phone in a home whose sensors report every few seconds);
the per-frame main-thread work of a gesture is 15-25 % lower; at the full rung the frame's draw work drops by the shadow pass
(23 % of draw calls, 45 % of triangles) but SwiftShader's frame time is dominated by fill, so whether that shortens a phone's
frame must be measured on the phone. Load times are within the noise of a shared runner.

## 5. What needs a real phone

- Frame rate while orbiting / pinching at the full rung, before and after (the removed shadow pass is a GPU saving SwiftShader
  does not show).
- Whether a temperature / power update still causes a visible hitch (expected: no).
- The resolution proposal P1 below (sharpness at rest vs smoothness while moving).
- Observation from the harness, not a performance item: on a phone a drag that starts on or near an entity pill is taken by the
  pill (touch adjustment), and the floor map's circuit buttons cover the left edge of the 3D view - a drag there does not orbit.

## 6. Proposal (changes the picture - not implemented; needs the owner's choice)

Measured on the fixed build, full rung, same harness (medians of 3):

| device ratio of the canvas | buffer | GPU-synced frame | rotate long-task time | zoom long-task time |
|---|---|---|---|---|
| 2 (today on a phone) | 780 x 1198 | 122.8 ms | 30.9 s | 26.3 s |
| 1.5 | 585 x 898 | 92.9 ms (-24 %) | 19.7 s (-36 %) | 18.6 s (-29 %) |
| 1 | 390 x 599 | 53.1 ms (-57 %) | 11.9 s (-61 %) | 11.2 s (-57 %) |

- P1a (recommended): draw at ratio 1 (or 1.25) while a gesture or the damping moves the camera, and one frame at the full ratio
  when it settles - sharp at rest, smoother while moving (slightly softer edges during motion only).
- P1b: cap levels 1-2 at ratio 1.5 on phone-wide screens (always a little softer; simpler).
- P2: on phone-wide screens, a 1024 shadow map at level 2 (as HEAVY_CONFIG already does above 3,000 parts) - softer shadow edges;
  with the map no longer redrawn per frame its gain is mostly memory (~34 -> ~8 MB) and the redraw on a state change.
- P3: no MSAA (`antialias: false`) when the canvas ratio is >= 2 - jaggier edges on low-DPR screens if applied too broadly.
