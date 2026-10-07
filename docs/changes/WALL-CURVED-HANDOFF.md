# Curved walls - handoff (WIP, paused 2026-10-08 by owner decision to save quota)

Branch `pilot/WALL-curved`, cut from `origin/main` 70c5a875 (release 2.3.1). Worktree used: `C:\cloude\wt-curved`.
No version bump, no migration (none needed), no merge or release. Design note: `docs/architecture/CURVED_WALLS.md`.

## Encoding chosen

`walls[].bulges`: one DXF-style bulge per polyline segment (`tan(theta/4)`, 0 = straight), in plan **pixels**,
positive = clockwise on screen (y down), `|bulge| <= 4`. A document with a curved wall is stamped `schema_version
"2.1"` by the server; all other documents stay `"2.0"` byte for byte. Older Arx refuses 2.1 packages
(`package_doc_version`); a stale editor tab draws chords and an edit changing the corner count is refused by the
validator (bulges length mismatch). Shared helper: `services/wall_path.py` + `frontend/src/map/wall-path.ts`.

## Status per item of the brief

| Item | Status |
|---|---|
| 1 Model: bulges, validator, limits, 2.0/2.1 stamping, no migration, old clients refuse/flatten | DONE |
| 2 Shared sampled-path helper (backend + frontend, golden tests) | DONE (`wall-path.golden.json`) |
| 2 Hit-testing, nearest wall, snapping to corners | DONE (corner snap unchanged; snapping ONTO an arc's body not added) |
| 2 Openings on curved walls (arc length, tangent) | DONE (render, validator, editor, door tool, shared-space entrances) |
| 2 Room / closed-loop area | PARTIAL: `ring_area`/`ringArea` with circular segments exist and are tested; rooms are zone polygons, nothing in the UI shows an area from a curved wall outline yet |
| 2 Wall faces (inner/outer offsets) | DONE as helper (`offset_polyline`, `wall_faces`), tested; no consumer uses faces yet (3D uses mitred boxes) |
| 2 3D extrusion | DONE (sampled chords, mitre growth only); glTF exports the scene as drawn. Not visually reviewed |
| 2 Library object snapping to curved walls | NOT DONE (object snapping uses alignment guides/grid, no wall snapping existed to extend) |
| 2 DXF export (bulged LWPOLYLINE, layers unchanged) | DONE, read back with ezdxf in tests |
| 2 DXF import (project's own reader) | DONE: centre lines with width, concentric arc/circle pairs, single arcs; openings not hosted on imported curved walls |
| 2 SVG / PNG exports | DONE (sampled path) |
| 2 Signed package round trip | DONE (API test: export -> straighten draft -> import restores the same hash, 2.1) |
| 2 Diff / candidate merge / re-crop / shared rooms | DONE (diff sees bulges; merge drops stale bulges; re-crop keeps or flattens; shared pieces straight) |
| 3 Curve mode (C), drag segment middle = 3-point arc | DONE (code), live spec written, see test status |
| 3 Arc draw mode (start, end, point on arc) | DONE (code), live spec written |
| 3 Numeric radius field, straighten | DONE (studio panel, curve mode, selected segment) |
| 3 Corner rounding (fillet with radius) | DONE (studio panel, curve mode, selected corner; closed outlines incl. corner 0) |
| 3 Undo/redo per step | DONE (each edit = one `edit()`/commit; spec covers Ctrl+Z/Ctrl+Y) |
| 3 i18n he/en, no HA branding, no operator-screen changes | DONE (`frontend/src/i18n/plan-curves.ts`) |
| 3 Phone guard | DONE (curve/arc refused on phone like wall drawing; C ignored) |
| 4 Backend unit tests | DONE: `tests/test_wall_curves.py` (23) |
| 4 Frontend unit tests | DONE: `tests/unit-wall-path.spec.ts` (8, golden parity with backend) |
| 4 Playwright editor specs desktop + phone | Desktop: 4/4 PASS on the runner fixture job (bend + undo/redo, radius/straighten, corner rounding, arc mode + SVG export). Phone: 1 FAIL in the spec's own setup (see below) |
| 4 Evidence screenshots looked at | NOT DONE (the spec writes them to `private-evidence/curved-walls/` on the machine that runs it; nobody has looked yet) |

## What ran

- Workstation (main checkout `.venv`): `tests/test_wall_curves.py` 23 passed; plan suites 161 passed earlier.
- Runner: `run_smart.py backend pilot/WALL-curved <18 plan test files incl. test_wall_curves, door tool, detect api,
  shared spaces, packages>` -> **296 passed** @ a86e5852. `run_smart.py tsc pilot/WALL-curved` -> **tsc ok**.
- Workstation Playwright (no server, scratch config): unit-wall-path + unit-geometry(-2) + unit-scene-builder +
  unit-door-tool + unit-studio-ops(-2) + unit-shared-space + unit-coverage -> **108 passed**.
- Live editor spec `evidence-curved-walls` via `run_smart.py fixture` @ a86e5852: **4 passed** (desktop), **1 failed**
  (mobile), 5 skipped (each test runs on one project only).

## Known failing test

`[mobile] evidence-curved-walls.spec.ts:196 phone: the curve tools stay away`: the wait for `sw-plan-canvas [data-wall]`
right after opening the editor times out on the phone (the phone editor does not draw the structure until a tool is
picked, or draws it elsewhere). This is the spec's setup, not the guard: fix the spec to open the structure tool first
(or wait for the canvas), then assert the guard. The guard code itself is in `setMode` / the C key handler.

## Next steps (in order)

1. Fix the phone spec setup (above), then re-run the live spec:
   `%LOCALAPPDATA%\Programs\Python\Python312\python.exe private\runner\run_smart.py fixture pilot/WALL-curved evidence-curved-walls`
   (desktop + mobile). Likely spots: the corner `[data-wall-vertex="2"]` click, `data-segment-radius` value format,
   the SVG export URL `export.svg?draft=true`.
2. Look at the screenshots (bend, radius panel, rounded corner, arc preview, arc wall, phone guard) and a 3D view of a
   round room; fix visual issues (handle size/colour, 3D z-fighting on wall tops).
3. Snap to an arc's body while drawing (snapPoint onto the sampled path) and object snapping to curved walls if wanted.
4. Room area from a closed curved wall outline (use `ringArea`) where the studio shows areas.
5. Doors/windows on imported curved walls (plan_dxf_map: host openings via `wall_path.project`).
6. Run the broader suites once more on the runner (`run_smart.py backend`, `run_smart.py tsc`), then review/merge.

## How to run

- Backend: `run_smart.py backend pilot/WALL-curved tests/test_wall_curves.py` (golden regeneration locally:
  `SW_REGEN_GOLDEN=1 pytest tests/test_wall_curves.py`, then review the diff of the two golden files).
- Frontend unit specs: `npx playwright test -c <config without webServer> unit-wall-path` (the repo config starts
  a preview server; `run_smart.py spec pilot/WALL-curved tests/unit-wall-path.spec.ts` works too).
- tsc: `run_smart.py tsc pilot/WALL-curved`.
- Live editor spec: `run_smart.py fixture pilot/WALL-curved evidence-curved-walls`.

## Files touched

Backend: `services/wall_path.py` (new), `plan_geometry.py`, `plan_geometry_render.py`, `plan_dxf_export.py`,
`plan_dxf_map.py`, `plan_package.py`, `shared_spaces.py`, `plan_door_tool.py`; tests `test_wall_curves.py` (new),
`test_plan_geometry_model.py`. Contracts: `schemas/plan_geometry.v2.schema.json`, fixtures `sample-curved.json`,
`sample-curved.primitives.json`, `wall-path.golden.json` (new).
Frontend: `map/wall-path.ts`, `map/curve-ops.ts`, `i18n/plan-curves.ts` (new); `map/geometry.ts`, `studio-ops.ts`,
`door-tool.ts`, `scene-builder.ts`, `shared-space.ts`, `sw-plan-canvas.ts`, `screens/explore-plan-editor.ts`,
`plan-studio-panel.ts`; tests `unit-wall-path.spec.ts`, `evidence-curved-walls.spec.ts` (new),
`tests/fixtures/fixture_specs.json`. Docs: `docs/architecture/CURVED_WALLS.md`, this file.

## Merge notes (glass wall branch pilot/WALL-glass)

Expected conflicts are small: the one-line `wall` def in `plan_geometry.v2.schema.json` (both add properties), the
walls branch of `_check_fields` in `plan_geometry.py`, and `GeomWall` in `geometry.ts`. The glass agent can use
`wall_path` / `wall-path.ts` directly (`sampled_wall`, `wall_faces`).

## Open design questions

1. Vertex drag on a curved segment keeps its bulge (the arc scales with the chord). Should it keep the radius instead?
2. Curve mode inherits select-mode behaviour (wall body drag moves the wall). Keep, or make curve mode bend-only?
3. Bulge range: 4 (about 303 degrees) is the limit; the importer splits arcs into half turns. OK?
4. Room area from curved outlines: show in the studio, or derive zones from closed curved walls?
