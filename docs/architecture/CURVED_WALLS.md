# Curved walls - plan geometry schema 2.1 (owner request 2026-10-08)

## Encoding

A wall keeps its `polyline` (corner points, normalized 0..1) and may carry `bulges`: one number per segment
(`len(bulges) == len(polyline) - 1`), the DXF LWPOLYLINE convention:

- `bulge = tan(theta / 4)`, `theta` the angle the arc turns through; `0` = a straight segment.
- Measured in plan **pixels** (`x * width_px`, `y * height_px`): the normalized space is not isotropic, so an arc is
  only a circle in pixels.
- Sign on the stored numbers (x right, y down): a positive bulge turns clockwise on screen and bulges to the
  screen-left of the segment's direction (the `nl = (d.y, -d.x)` side of `geometry.ts`).
- `|bulge| <= 4` (about 303 degrees). A full circle is a closed outline of two segments with bulge 1 each.
- A closed outline still repeats its first point last; corner rounding of corner 0 moves the start to the second
  tangent point.

## Version and compatibility

- A document with at least one curved wall is stored as `schema_version: "2.1"`; every other document stays `"2.0"`,
  byte for byte (no migration; `normalize` drops all-zero bulges, so straightening every arc returns to 2.0).
  The server stamps the version on every save (`plan_geometry.rebase` / `doc_version`); a client may send either.
- Validator: `bulges` of the wrong type or length is structural (the save is refused); `|bulge| > 4` (`bulge`) and an
  arc that leaves the plan (`bounds`) are errors that block publishing; opening fit and `too_short` use the arc length.
- Older Arx (before 2.1) **refuses** a curved document: its package import checks `schema_version == "2.0"` and answers
  `package_doc_version`. A stale editor tab ignores the field and draws chords; its spread-based edits keep the
  field, and an edit that changes the corner count is refused by the new validator (length mismatch), never misread.
- DXF importers outside Arx read the bulged LWPOLYLINE natively (true arcs). Arx's own DXF import (`plan_dxf_map` 1.2)
  turns bulged centre lines with a wall width, concentric arc / circle pairs and single arcs on wall layers into curved
  wall candidates; doors and windows are not hosted on imported curved walls (added in the editor).

## The shared path helper

`smplwise/services/wall_path.py` (backend) and `frontend/src/map/wall-path.ts` (frontend) - standalone modules that
any wall kind can use: arc geometry, exact lengths, point and tangent by arc length, exact sub-paths, sampling within a
pixel tolerance (`TOL_PX` 0.25, at most 5 degrees and 128 chords per arc), projection, 3-point and radius bulges,
fillets, ring areas and offset faces. `sampled_wall(wall, W, H, tol)` / `sampledWall(...)` return the sampled polyline.
`contracts/fixtures/plan_geometry/wall-path.golden.json` and `sample-curved.primitives.json` pin both sides.

## Consumers

- Primitives (map, SVG, PNG, 3D, coverage): a curved wall is cut by its openings along its exact length; each part's
  `points` is the sampled path, `arc` the exact corners and bulges. Openings sit by arc length along the tangent.
- DXF export: curved parts are bulged LWPOLYLINEs on `SW_WALLS` (bulge negated by the y mirror), same layers and XDATA.
- 3D: a curved part's chords grow only by their joint's mitre; glTF exports the scene as drawn.
- Re-crop keeps arcs wholly inside and flattens an arc the crop cuts; shared rooms clip curved walls on their sampled
  path (read-only pieces are straight); candidates drop stale bulges when an edit replaces the corners.
- Editor (structure tool, desktop): Curve mode (`C`) - drag a segment's middle handle to bend it, set or clear a
  segment radius in the panel, round a corner with a radius; Arc wall mode - start, end, a point on the arc.
