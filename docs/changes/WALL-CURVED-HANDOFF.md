# Curved walls - finish (WALLC2, 2026-10-08)

Branch `pilot/WALLC2`, from `pilot/WALL-curved` @ 2d4381f7 (paused at ~65 %), with `origin/main` 5f907758 (release 2.4.0,
window walls) merged in. Worktree: `C:\cloude\wt-WALLC2`. No version bump, no migration, no merge to main, no release.
Design note: `docs/architecture/CURVED_WALLS.md` (encoding, compatibility, consumers, the four design decisions).

## Encoding (unchanged)

`walls[].bulges`: one DXF-style bulge per polyline segment (`tan(theta/4)`, 0 = straight), in plan **pixels**,
positive = clockwise on screen (y down), `|bulge| <= 4`. A document with a curved wall OR a window wall is stamped
`schema_version "2.1"` (`plan_geometry.document_version`); all other documents stay `"2.0"` byte for byte. Shared
helper: `services/wall_path.py` + `frontend/src/map/wall-path.ts`.

## Status per item

| Item | Status |
|---|---|
| Model, validator, limits, 2.0/2.1 stamping, no migration | DONE (2.1 now shared with window walls) |
| Shared sampled-path helper, golden parity backend/frontend | DONE |
| Hit-testing, nearest wall, corner snap | DONE |
| Snap onto an arc's body while drawing / dragging corners / moving walls | DONE (WALLC2, `snapPoint`) |
| Openings on curved walls (render, validator, editor, door tool, shared spaces) | DONE |
| Room area from a closed curved outline in the studio | DONE (WALLC2, wall panel `data-wall-area`) |
| Zones derived from closed curved walls | NOT DONE by decision 4 (zones stay drawn polygons) |
| Wall faces helper | DONE as helper; no consumer needs faces (3D uses mitred boxes) |
| 3D extrusion | DONE; curved joint mitre shared with glass walls (`jointGrow`) |
| Library object snapping to curved walls | NOT DONE: objects snap to the grid and alignment guides only; no object-to-wall snapping exists to extend (a new feature, not part of the curved-walls scope) |
| DXF export (bulged LWPOLYLINE) | DONE; glass walls and panes bulged too |
| DXF import of curved walls | DONE |
| Doors and windows on imported curved walls | DONE (WALLC2, `plan_dxf_map` 1.3) |
| SVG / PNG exports, package round trip, diff, merge, re-crop, shared rooms | DONE |
| Curve mode, arc mode, radius field, straighten, corner rounding, undo/redo | DONE |
| i18n he/en, no HA branding, operator screens untouched | DONE |
| Phone guard | DONE (the editor route is desktop-only; the floor map draws the arcs) |
| Merge with window walls (2.4.0) | DONE: curved glass walls render, divide, validate and export along the arc |

## Tests

See the WALLC2 report for the exact commands and SHAs. Backend: `tests/test_wall_curves.py` (25) plus the plan suites;
frontend: `tests/unit-wall-path.spec.ts` (12) plus the plan unit specs; live: `evidence-curved-walls` (fixture job,
desktop + mobile): 6 passed @ 57e2d0cc. Screenshots of the live spec go to `private-evidence/curved-walls/` (not
committed) and were reviewed: the 3D cutaway used to drop chords at the BACK of a round room off the scene centre
(fixed: curved runs carry a `pivot`); a refused radius lingered in the field and showed in the green info colour
(fixed). Known cosmetic: the shadow under the free end of a curved wall shows small steps (shadow-map resolution on
the sampled chords), not changed.

## Merge notes (for the merge to main)

Conflicts with 2.4.0 were resolved on this branch (schema wall def and version enum, `plan_geometry` version
constants and `_check_fields`, `plan_package` version check, DXF wall drawing, render imports, `geometry.ts` imports
and `WallPrim`, studio panel imports / actions / wall header, editor actions, fixture spec list). A later main that
touches the same lines needs the same care: keep both `bulges` and `glazing`, and keep `document_version` answering 2.1
for either feature.
