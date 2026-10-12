# CR-029 / ST7 product port - notes of slices S0 and S4

**Branch:** `pilot/ST7-port-s0-s4` (from `origin/main` e7201c92, release 2.4.3). **Binds to:** CR-029 sections 1-13, the
ST7 build plan (section 3 order, section 5.2 tests), LOOK_SPEC (branch `pilot/ST7-lookdev`, re-read at round 2,
e9a77c59) and the owner's decisions of 2026-10-09. Contradictions are recorded here, not silently resolved.

## Contradictions recorded

| # | What disagrees | Decision in the port | Why |
|---|---|---|---|
| P1 | CR-029 section 5.2 calls the new document version **2.1**; 2.1 already means window walls / curved walls (plan_glass, wall_path) | **2.2**, same rule: stamped only when a Studio 6 field is present; an older server refuses 2.2, never misreads it | two meanings for one version would make an older 2.1 reader drop materials silently |
| P2 | CR-029 puts north under `transform.north_deg` | document top level `north_deg` | the server owns `transform` and rewrites it from the plan version on every save (plan_geometry.rebase) |
| P3 | CR-029 names the window field `glazing` (`clear` / `frosted` / `tinted`) | `tint` on window openings, values `clear` / `tinted` / `frosted` / `reflective` | on a wall `glazing` is already an object; `tint` is that object's own field name and value list |
| P4 | CR-029 section 6.2 ids `floor_oak`, `floor_concrete`, ...; LOOK_SPEC section 2 (binding for the port) and the prototype use `oak`, `concrete`, ... | LOOK_SPEC ids; the CR spellings are aliases, normalised to the id on save | the look spec is the newer binding recipe; aliases keep the CR text valid |
| P5 | CR-029 section 5.2 "material_id on levels (default floor / ceiling)" - one field for two surfaces | `floor_material_id` and `ceiling_material_id` on levels and rooms | one id cannot describe two surfaces |
| P6 | CR-029 section 7 "plan.quality gains the value 3"; owner Q11: schematic default for everyone, realistic per browser | `plan.quality` unchanged (1 / 2); the realistic default is a person's own dial (`default_view`), never an installation dial | the owner's answer is binding |
| P7 | LOOK_SPEC section 10 scopes "per user (browser)"; the product needs the value on every device of the person and in backups | per-person dials on the server (`plan_view_prefs`, migration 0074, backed up); per-display dials (wall display, kiosk idle, quality rung, DPR cap) take the installation value and may be overridden in that browser only (S5) | a wall tablet has no person; a person's look must follow them |
| P8 | CR-029 section 4.3 "a door is passable when its entity reports open"; a door whose only entity is a lock | unlocked = passable, locked / jammed = blocked, no state = blocked (stale) | a lock says nothing about the leaf, but a person can open an unlocked door; unknown is never open |
| P9 | LOOK_SPEC round 2 glass opacity differs per style (.22 light / .20 dark) | one opacity .22 in the library; per-style tints | the library carries one opacity per material; S1 may add a per-style override |

## What S0 delivers

- Document 2.2 fields (backend `services/plan_studio6.py`, contract `plan_geometry.v2.schema.json`, frontend
  `map/studio6-fields.ts`): `material_id` (walls, openings, objects), `floor_material_id` / `ceiling_material_id`
  (rooms, levels), `ceiling` (rooms), `tint` (windows), `light` (lamps), `north_deg`, `walk_positions`.
  Structural types refuse a save; ranges and enums are errors; an unknown material is a warning.
- Material library `smplwise/catalog/materials.json` (byte copy `frontend/src/map/materials.json`, test-guarded).
- The resolver on both sides, pinned by `contracts/fixtures/plan_geometry/sample-v22.materials.json`.
- Catalog 2026.10.1: `material_id` on every built-in item, `light` on the 12 lamps, `walkable` on circulation.
- Look settings: installation `plan.view` (system.configure, audited), personal override `/api/v1/plan-view/prefs`
  (map.read, own row, audited), migration 0074, backup coverage. 0073 belongs to the 2.4.4 integration branch:
  `release_check.py` "migrations contiguous" is red on this branch alone until that merge.

## What S4 delivers

- `map/walk-world.ts`, `map/walk-controller.ts`, `map/walk-minimap.ts`, `map/walk-session.ts` (see their module notes),
  the walk mode of `SceneView`, the walk UI of `sw-plan-3d`, the walk world on request in `scene-builder.ts`, and the
  host wiring in `explore-floor-map.ts`. Levels 1-2 descriptions are byte-identical when the walk is off.

## Not in S0 / S4 (owner-visible gaps, by slice)

- S0 editor UI: material selects per wall / room / object, the north compass on the calibration card and the saved
  positions list are available as pure operations (`studio6-fields.ts`) but not yet drawn in the plan editor; the
  settings screens for `plan.view` and the personal dials are API + client only (no settings tab yet).
- S1: textures and models (asset step pending approval), level 3 in SceneView, the post-processing chunk, box-mapped UVs.
- S2: sun / sky / time of day / lamp pool / door animation. S3: stills, masks, lightmap, `plan_bakes` (migration 0075 is
  free for it). S5: joystick polish, saved positions editing in the walk, route, kiosk idle, pointer lock on the real
  Ingress page. S7: perf gate R178, AT177 / AT178 evidence, registry.

## S1 / S2 (branch `pilot/ST7-port-s1-s2`, from `pilot/ST7-port-s0-s4` 0298e10d)

### Contradictions recorded (S1 / S2)

| # | What disagrees | Decision in the port | Why |
|---|---|---|---|
| P10 | The brief: "solar position from site latitude / longitude (existing site settings)"; no such setting exists (CR-029 section 5.2 proposed reading HA `/api/config`, which the backend does not read) | new installation settings `site.latitude` / `site.longitude` (strings in the settings table, "" = not set, validated -90..90 / -180..180, read back as numbers or null); not set = 32.0 / 34.8 with a note in the time popover | no HA config read path to reuse; a plain setting is auditable and backed up with the settings |
| P11 | LOOK_SPEC 13.2 maps the kit onto the prototype's ids (`sofa.3seat`, `bed.double`, `cabinet.tv`, `plant.pot`, ...); the product catalog 2026.10.1 has other ids and no residential beds / TV cabinet / pot plant | `map/plan3d-assets.ts` MODEL_MAP re-keyed on catalog ids (sofa.2/3, chair.basic/folding/office, table.dining/desk, cabinet.low, shelf.unit, fridge.domestic/kitchen, toilet.standard, sink.bathroom, bathtub, kitchenette.counter tiled every 0.6 m); the 19 approved files ship (unmapped ones wait for catalog items); `lampRoundFloor.glb` is not shipped (lamps stay procedural, LICENSES.md calls it unmapped) | the owner approved the file list, not the ids |
| P12 | LOOK_SPEC / prototype use three's GLTFLoader and BufferGeometryUtils | `map/mesh-utils.ts` readGlb (triangles, node transforms, material names) and creaseNormals | GLTFLoader pulls animation / skinning classes into the capped `three` chunk |
| P13 | LOOK_SPEC 6 / 8: door leaves open 85 deg | 80 deg (the description's DOOR_OPEN_DEG, shared with levels 1-2) | one deterministic description; changing it would move the level-2 baselines |
| P14 | This branch's ladder (5 modes) vs `pilot/PLANMODE-sticky-quality` (auto / full / schematic, `plan.quality` auto/2/1 + /me/prefs) | superset with the same wire values ("auto", "1", "2"; new "lite", "realistic"), the same browser key, the same attributes (`data-quality-mode`, `data-3d-low-fps*`), the same rule (a chosen mode sticks, only auto falls), a missing `plan.quality` = schematic. Precedence: browser choice <- `plan.view.quality` when fixed <- `plan.quality` <- auto. Not yet wired: the hotfix's /me/prefs `plan.quality` and its FpsWatch hysteresis (2.5 s probe here) - the integration merge takes the hotfix's persistence and keeps this ladder's rungs | the hotfix ships first; the merge needs one design |
| P15 | CR-029 3.4: the walk drops a level under 24 fps (the generic fallback) | a separate session flag (`sw.plan3d.walkguard`) under the new dial `plan.view.walk_guard` (on by default; off = a hint only) | coordinator 2026-10-11 |
| P16 | ST7 build plan L8 MSAA x4 on desktop | MSAA x2 on both level-3 rungs, SMAA only without WebGL2 | LOOK_SPEC round 2 (x4 rendered blank with instancing on ANGLE/D3D11) |

### What S1 / S2 deliver

- Assets: `frontend/public/plan3d/` (72 files, 3.42 MB: 21 colour maps, 16 sets x normal + rough_ao, 19 models) with
  `MANIFEST.json` (`scripts/plan3d_manifest.py`, `--check`); `unit-plan3d-assets.spec.ts` checks files, hashes, licences.
- Description: `scene-real-builder.ts` (`SceneInput.realistic`): materials per base part (resolver), bevel radii, the
  detail families (skirting, door frames / casings / handles, window frames / sills / mullions / transom, sofa, chair,
  table, desk, cabinet / kitchen run, bed, round table / stool, tree / bush, lamp bodies with bulbs), room floors, section
  caps, model rows, lamps, shutters (covers), room daylight. Levels 1-2 byte-identical (`unit-plan3d-real.spec.ts`).
- View: `scene-real.ts` + level 3 in `scene-three.ts` (see the module notes), `post-chain.ts` in its own chunk.
- Element: rung chips, ladder, hint, time pill (clock / slider / date / now), sky backdrop, grade, vignette, style by theme,
  walk interior fill and fog; hosts: the floor map and the style guide request the realistic part (`realistic-change`).

### Not in S1 / S2 (by slice)

- Settings screens: `plan.view` dials (style, furniture, textures, section cut, walk guard, ...) and the site location are
  API-only (as S0 left them); the history map and the event page do not request the realistic part (level 3 there draws
  the level-2 structure under the level-3 light).
- S3: stills, masks, the kiosk still swap, lightmap, `plan_bakes` (0075). S5: joystick / kiosk polish, the realistic walk
  on a phone. S7: the R178 gate on the runner (390 px, 4x CPU throttle) with real fps, AT177 / AT178, registry rows,
  real-device rows (NOT_RUN).
## S7 prep (branch `pilot/ST7-s7-perf`, from `origin/integ/247` a8b6a21d)

The performance and determinism gate without the real measurement: `frontend/tests/evidence-plan-studio-6.spec.ts`
(functional part always, measurement opt-in and load-aware), the owner checklist
`docs/design/studio6/PLAN_STUDIO_PHASE6_CHECKLIST_HE.md`, the quiet-window runbook
`docs/design/studio6/PLAN_STUDIO_PHASE6_PERF_RUNBOOK.md`, the kiosk thermal note (CR-029 section 3.5), the registry rows
(T089 evidence, AT177 / AT178 procedure). No product behaviour changed.

### Contradictions and gaps recorded (S7)

| # | What disagrees | State | Consequence |
|---|---|---|---|
| P17 | CR-029 3.4: "the GPU texture budget is counted and capped at 48 MB phone / 128 MB elsewhere; over it the library serves its 256 px variants" | not built: `RealMaterials` counts no bytes; `public/plan3d/` ships the 512 px set only | the spec asserts the budget as it stands (all library textures <= 512 px, decoded total under the cap on the 1,000-object floor) and lists the swap as `test.fixme` |
| P18 | CR-029 3.4 phone row "normal maps off above 1,000 parts" and the S7 lever "normal maps" | no product dial; nothing drops normal maps by part count | the lever table switches normal maps through the measurement harness (stripped from every material, restored after) |
| P19 | CR-029 3.1 "a second small shadow map for the strongest lamp at level 3 on desktop" | not built (LOOK_SPEC: lamp shadows off by default); no pool lamp ever casts | the functional part asserts no casting lamp; the lever table measures the cost through the harness (strongest pool lamp, 512 px cube) |
| P20 | The S7 brief: "the lever table (... DPR)" on the phone rung | the lite rung pins DPR 1 (LOOK_SPEC); `dpr_cap` applies to the realistic rung only | the DPR rows are measured on the realistic rung (cap 1 / 1.25 / 1.5 / 2) |
| P21 | Defect (not fixed here, not a one-line change): `SceneView.setRealSettings({ dprCap })` stores the cap but only `applyQuality` sets the pixel ratio | reproduced on the mobile project (base ratio 2): a cap of 2 set while the realistic rung draws at cap 1 leaves the ratio at 1 until the next rung or level change | `sw-plan-3d` passes the person's `dpr_cap` dial after the view is constructed, so a mount that starts at the realistic rung draws at the default 1.25 whatever the dial says until the rung changes. Fix: re-apply the pixel ratio (and resize the post chain) in `setRealSettings` when the cap changes at level 3. **Fixed 2026-10-12 (ST7DPR, branch `pilot/ST7-dpr-cap`):** the element hands the cap to `SceneView` at construction (`dprCap`), `setRealSettings({ dprCap })` re-applies the ratio at level 3 and resizes the post chain in place (`PostChain.setPixelRatio`), and the rule is one pure function (`pixelRatioFor`, `quality-ladder.ts`); evidence `unit-plan-3d-pixel-ratio.spec.ts`, `evidence-plan-3d-dpr-cap.spec.ts` |
| P22 | CR-029 9: "R178 is asserted on the runner's Chrome at 390 px with 4x CPU throttling" | Playwright's bundled headless Chromium draws with SwiftShader on the workstation (measured) and the runner has no known GPU | the gate opts into the prototype's ANGLE switches (`--use-angle=d3d11` on Windows) and refuses a software renderer; the quiet-window run is on the workstation, not the runner |
| P23 | AT178 "at least 30 fps on a phone" | the workstation at 390 px with a throttled CPU is a proxy | AT178 needs the owner's real-phone row (checklist row 4) as well; the proxy alone never closes it |
