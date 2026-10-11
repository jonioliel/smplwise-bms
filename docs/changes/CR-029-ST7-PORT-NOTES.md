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
