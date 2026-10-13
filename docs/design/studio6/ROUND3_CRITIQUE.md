# ST7 look-dev — round 3 self-critique (2026-10-13)

**Branch:** `pilot/ST7-look-r3` (from `origin/main` b26c1b7d, release 2.4.8 = the 2.4.7 Studio 6 code). **Owner:** approved the
round-2 look on 2026-10-10 ("already much better; if needed we do another round") and authorised round 3 without specific
complaints, so this round is a rigorous self-critique of the **shipped product** (not the prototype) against `LOOK_SPEC.md`
(branch `pilot/ST7-lookdev` e9a77c59, binding) and the reference class the plan names (archviz isos, Matterport dollhouse,
Planner 5D, Apple / Google Home cards; light = architectural render, dark = digital twin).

## 1. Method

Round 1-2 judged the prototype. The product port (S0-S7) never got the same look pass, so this round renders **the real
element** (`sw-plan-3d` at level 3, both rungs, both styles) through the production build:

- **Fixture:** `frontend/tests/lookdev/house.ts` — a synthetic two-floor building in schema 2.2 with PRODUCT catalog
  ids (2026.10.1): ground floor entrance / living / kitchen / study / WC / utility / stairs; upper floor gallery / meeting
  room / open office / server room / kitchenette / bathroom; 16 rooms, 33 openings (shutters on three), 88 objects,
  3 cameras, 16 entities, lit rooms, open doors, presence, temperatures. No real site, no private data.
- **Harness:** `frontend/tests/lookdev-studio6.spec.ts` (opt-in `SW_LOOKDEV=1`, never in a gate) draws 28 desktop + 8
  phone frames: iso / top / perspective, one floor / both floors, 10:00 / 13:00 / 17:36 (golden) / 21:00 (night), lite
  and realistic rungs, eye-level walks in the living room, kitchen, study, meeting room and open office; on the
  workstation GPU (ANGLE D3D11, `--use-angle=d3d11`). Every frame was looked at. The frames live in
  `private-evidence/studio6-lookdev/<tag>/` (gitignored); the twelve that carry the argument are copied to
  `docs/design/studio6/round3/{before,after}/` (JPEG, desktop frames downscaled to 1080 px; the full-size PNGs stay in private-evidence).
- Experiments were run through the harness's `SW_LOOKDEV_PATCH` hook (a JavaScript body on the live element): the
  sun shadow off, normals recomputed, GTAO off, the dome / ground / glass hidden - each isolating one cause.

## 2. The ten most visible gaps, ranked by impact

| # | Gap (as shipped in 2.4.7 / 2.4.8) | Where it showed | Root cause | Round-3 fix |
|---|---|---|---|---|
| **G1** | **Every merged surface was unlit by the sun and read as navy / charcoal** - interior plaster `#ece6dc` drew as `#3a4258`, floors, ceilings, sills and frames flat; the whole light style looked like the dark one; a lit lamp was the only light cue | every frame; iso day, every walk (`before/light-iso-L0-day-real.jpg`, `before/light-walk-living-day-real.jpg`) | `scene-real.ts` `Bucket.push` transformed the vertex **normal as a point** with the transposed inverse 4x4 (`Vector3.applyMatrix4`, which divides by the translation row): a wall metres from the origin got a normal skewed toward its own position. Instanced objects (their own normals) were fine, which is why the chairs looked lit while the walls did not | the normal matrix proper (`Matrix3.getNormalMatrix`) + `normalize()`. Regression: `unit-plan-3d-look-r3.spec.ts` (merged wall normals are unit and axis-aligned) |
| **G2** | **Level-2 state plates painted over the materials**: a lit room got a saturated yellow plate (map-lit, alpha .45) over its oak / tiles, presence a blue plate (.36) and a 0.3 m neon ring (.75); the open-door frame was a flat token red | iso, top, walks (`before/light-top-L0-day-lite.jpg`) | the state layer kept its level-2 path at level 3; LOOK_SPEC section 2 lists only `open_door` / `presence` / `cone` / `lock_ok` as state colours (per style) and says the lamps light a lit room | `SceneView.statePart`: at level 3 the lit plate is dropped, the presence plate thins to .13 (x .35) and the ring to .34 (x .45); the state colours come from `LOOK_STYLES[style].states` (light `#2767ed` / `#e4463c`, dark `#38bdf8` / `#ff6b62`); the open-door frame is an emitter (emissive .9, blooms a little, readable at night); a style switch re-tints them. Levels 1-2 keep every part |
| **G3** | **The realistic rung's ground was a dark grey pit** around the building, the whole backdrop with it (the lite rung showed the sky gradient) | every realistic orbit frame (`before/light-iso-L0-day-real.jpg`) | the ground disc is a lit `MeshStandardMaterial` on the realistic rung and was a **zero-height `BoxGeometry`**: three builds the +y face with `depth > 0 ? 1 : -1` on a 0 depth, so the top face's normal pointed DOWN and the sun never lit it (the lite rung's unlit `MeshBasicMaterial` hid the bug) | a `PlaneGeometry` rotated to face up. Regression: the disc's normals are `[0,1,0]` |
| **G4** | **No ceilings**: every eye-level walk showed the sky above the walls; the sun flooded interiors from above, so walls facing the sun blew out while the rest sat in blue shade | every walk frame (`before/light-walk-living-day-real.jpg`, `after1/light-walk-meeting-day-real.png` (private-evidence)) | CR-029 section 5.2 defines `ceiling` (default true) but the port built no ceiling plate; the section cut hid the gap in the orbit views | `RealWorld.ceilings`: one plate per room at `elevation + ceiling_height` (the room's own height when set), in the room's / level's ceiling material (`plaster_ceiling`), facing down, cut by the section plane like a wall (so the orbit views are unchanged), skipped for `rooms[].ceiling: false`. The walk's light is now the fill + lamps + window light, as LOOK_SPEC section 3 intends. Regression: node (`unit-plan3d-real.spec.ts`) and browser |
| **G5** | **Lamp halos**: a lit ceiling fitting bloomed into a 3 m disc on the ceiling; the dark style's night walk was a fog of warm bloom; the day-time lamp glowed like a sun | night walks, night iso, dark kitchen (`before/dark-m-walk-kitchen-night-lite.jpg`, `after1/dark-walk-living-night-real.png` (private-evidence)) | the pool point light sat 5 cm under the bulb, 25 cm from the ceiling plate: `1 / d^2` made a hotspot ten times brighter than the room, and bloom (threshold 1.0-1.6, strength .38-.5) spread it; the bulb emissive 3.0 / 3.4 at night added to it | the ceiling fitting's point light drops 0.45 m under the bulb (pendant 0.25 m; floor / wall lamps unchanged); bulb emissive light 1.6 / 3.0 -> **1.0 / 2.0**, dark 2.6 / 3.4 -> **1.5 / 2.0**; bloom night strength light .38 -> **.28** (radius .30), dark .5 -> **.36** (radius .40), dark night threshold 1.0 -> **1.15**. The lit-room cue stays the pool light on the floor and the glowing bulb |
| **G6** | **Interiors read dim and blue in the orbit views**; the golden-hour iso was a dark box | iso day / golden (`after1/light-iso-L0-golden-real.png` (private-evidence)) | with G1 fixed the sun lights only the faces it reaches; the shade side of every room had the spec's hemisphere fill 0.26 x recipe - a sky-blue tint on warm plaster | hemisphere fill light 0.26 -> **0.36**, dark 0.35 -> **0.42**; the walk's interior fill ceiling light [0.55, 1.0] -> **[0.5, 0.85]** (the meeting room with a 1.8 m window blew out at 1.0). The IBL stays as specified |
| **G7** | **The office chair was a tufted leather barrel** (a 0.6 m cylinder tiled with the leather set at 0.6 m); the round stools likewise | study and open-office walks (`before/light-walk-office-day-lite.jpg`, `before/dark-walk-openoffice-night-lite.jpg`) | `MODEL_MAP['chair.office']` exists (chairDesk.glb) but the builder sent only **box** base parts to the model path; the catalog's office chair is a cylinder | a cylinder item takes its kit model like a box (fit by diameter). Regression: node |
| **G8** | **Phone: a pill cloud** - 16 entity pills over a 390 px picture hid the plan; the same cap (60) as a 1440 px desk | phone iso (`before/light-m-iso-L0-night-lite.jpg`) | one `PILL_CAP` for every stage width | at level 3 a stage under 640 px caps the pills at **8** (the alerting ones - open, on, stale - stay, the rest count in the "+N" hint the cap already draws). Regression: browser, mobile project |
| **G9** | **Dark-style day was a black box** - furniture and floors invisible at noon; only the cap edges and the lit rooms read | dark iso day (`after1/dark-iso-L0-day-real.png` (private-evidence)) | sun x .55 and sky x .32 are the twin's intent, but the fill (.35) left the shade at ~2 % | the dark fill 0.35 -> 0.42 (G6); the twin stays dark - its readability is the cap edge, the lit rooms and the state colours, as LOOK_SPEC section 1 says; recorded as a style, not a bug |
| **G10** | **The window glass of the lite rung is an opaque pale board** from inside; the realistic rung's physical glass shows a blurred sky with the sun as a dot, no exterior behind it | walks (`after1/light-walk-living-day-real.png` (private-evidence)) | the horizon band (vegetation silhouette, r 55 m) and the ground disc end a few metres out; the dome is a plain gradient | **not changed in round 3** (recorded): the cheap glass is the lite rung's budget rule; an exterior worth looking at (a ground texture, a tree line nearer the windows, a sun disc with haze) is a release-B item with the lightmap. The transmission glass already shows the sky and the sun |

Smaller findings, fixed on the way: the "tint-only" fast path (a presence fade step) now applies the same thinning so a
fade does not restore the level-2 opacity; the pool lights' day strength is unchanged (the lit-room cue by day).

Not touched (and why): the entity pills' chrome, the time pill, the bar (clean, as round 2 left them); the furniture
kit's proportions (owner Q10 settled procedural AND models); the aliasing on the cap edges in the dark style (MSAA x2 on a
HalfFloat target is the round-2 budget decision; x4 rendered blank with instancing on ANGLE); the ground / horizon beyond the
windows (G10); the kiosk / stills paths (S3 / S5-B draw the level-2 stills, their own recipe).

## 3. What changed in the look numbers (LOOK_SPEC addendum, R3)

| LOOK_SPEC item | R2 value | R3 value | Why |
|---|---|---|---|
| Hemisphere fill x recipe | light 0.26, dark 0.35 | light **0.36**, dark **0.42** | G6 / G9 |
| Interior fill while walking | light lerp(0.55, 1.0) x 0.7 | light lerp(**0.5, 0.85**) x 0.7 (dark unchanged) | G6 |
| Lamp bulb emissive day / night | light 1.6 / 3.0, dark 2.6 / 3.4 | light **1.0 / 2.0**, dark **1.5 / 2.6** | G5 |
| Lamp pool light position | 5 cm under the bulb | ceiling kinds **0.45 m** under, pendant **0.25 m**, floor / wall 5 cm | G5 |
| Lamp pool night strength (dark) | x 1.20 | x **1.10** | G5 |
| Bloom strength night / radius | light .38 / .35, dark .50 / .45 | light **.28 / .30**, dark **.36 / .40** | G5 |
| Bloom threshold night (dark) | 1.0 | **1.15** | G5 |
| Bloom strength day (dark) | .32 | **.26** | G5 |
| State colours at level 3 | UI tokens (map-lit, map-presence, danger) | the style's `states` table; no lit plate; presence plate .13, ring .34; open-door frame emissive .9 | G2 |
| Ceilings | none | per room, cut by the section plane | G4 |
| Phone pill cap (level 3, stage < 640 px) | 60 | 8 | G8 |

Everything else in LOOK_SPEC sections 1-6 stands. The level 1-2 descriptions and baselines do not move (the unit specs
`unit-plan3d-real` "byte-identical without realistic" and `unit-plan-3d-determinism` still pass).

## 4. Evidence

- Before / after pairs (the committed subset): `docs/design/studio6/round3/before/*.jpg` and `round3/after/*.jpg` -
  light iso day (realistic), light walk living day, light walk meeting day, light iso night, dark iso night (lite), dark
  walk living night, phone iso night, phone walk living day, plus the study walk (office chair) and the perspective of
  both floors.
- The full matrices (36 frames each, three passes): `private-evidence/studio6-lookdev/{before,after1,after2,after3}/`
  on the workstation (gitignored; `frames.txt` has draw calls and triangles per frame).
- Draw calls / triangles (workstation GPU, 1440 x 900, realistic rung, one floor): before 408 / 54.4k, after 408 /
  56.0k (the ceilings: one merged mesh per level, +1.6k triangles; the office chair model replaces a 14-segment cylinder).
  No new draw calls, no new texture, no new chunk. The lite rung: 151 / 18.7k -> 151 / 20.3k.

## 5. Performance and budgets

- Chunks unchanged: `three` and `three-post` carry no new import (`Matrix3`, `PlaneGeometry` are in `three` already);
  `unit-three-chunk.spec.ts` is the guard.
- Per frame: +1 merged mesh per level (ceilings), the same instanced groups; the pool lights move, they do not multiply;
  the post chain is unchanged (MSAA x2, GTAO 6 samples on the top rung only). The R178 gate / lever table
  (`evidence-plan-studio-6.spec.ts`) and the dpr_cap rules are untouched; the quiet-window runbook applies as before.
- Not measured on a phone (NOT_RUN, as every round): the real-phone row stays the owner's checklist item.

## 6. Hebrew summary / תקציר

סבב 3 בדק את המוצר עצמו (לא את האב־טיפוס) בשני הסגנונות, בשתי הרמות, בשעות שונות, בדסקטופ ובטלפון, ומצא שהתמונה
הריאליסטית ששוחררה ב־2.4.7 סבלה משני באגים שהסתירו את כל השאר: הנורמלים של הקירות הממוזגים היו שבורים (השמש לא
האירה שום משטח, הטיח נראה כחול־כהה) והרצפה של הרמה הריאליסטית פנתה כלפי מטה (בור אפור סביב הבניין). אחרי התיקון
טופלו: שכבות המצב של רמה 2 שצבעו את החומרים (צהוב/כחול רווי), חוסר תקרות בסיור, הילות המנורות, מילוי האור בחללים,
כיסא המשרד (חבית עור), ענן התוויות בטלפון. המספרים החדשים רשומים בסעיף 3; רמות 1-2 לא זזו.
