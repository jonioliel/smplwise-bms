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
  The server stamps the version on every save (`plan_geometry.rebase` / `document_version`); a client may send either.
- 2.1 is shared with window walls (release 2.4.0, `plan_glass`): `document_version` answers 2.1 when a document has a
  curved wall OR a glass wall / glazing block (`doc_version`, `SUPPORTED_VERSIONS`, `SCHEMA_VERSION_CURVED` remain as
  aliases of `document_version`, `SCHEMA_VERSIONS`, `SCHEMA_VERSION_21`). The frontend's `withDocVersion`
  (glass-wall.ts) follows the same rule.
- Validator: `bulges` of the wrong type or length is structural (the save is refused); `|bulge| > 4` (`bulge`) and an
  arc that leaves the plan (`bounds`) are errors that block publishing; opening fit and `too_short` use the arc length.
- Older Arx (before 2.1) **refuses** a curved document: its package import checks `schema_version == "2.0"` and answers
  `package_doc_version`. A stale editor tab ignores the field and draws chords; its spread-based edits keep the
  field, and an edit that changes the corner count is refused by the new validator (length mismatch), never misread.
- DXF importers outside Arx read the bulged LWPOLYLINE natively (true arcs). Arx's own DXF import (`plan_dxf_map` 1.3)
  turns bulged centre lines with a wall width, concentric arc / circle pairs and single arcs on wall layers into curved
  wall candidates; door swing arcs, door blocks and window lines near a curved wall are hosted on it by arc length
  (projection onto the drawing's own arcs, in metres; t is the same in the version because the plan is a similarity of
  the drawing). A drawing without arcs takes the straight-line matching unchanged.

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
- Window walls (kind `glass`) may be curved: their parts carry `glass` and `arc`; the glazing primitive divides the
  exact arc length and is drawn on the sampled path (each sample with its exact arc length, `sample_with_s` /
  `sampleWithS`); the glass validator, `wallLengthM` and `wallPathPx` measure the path; the DXF writes the glass wall
  and pane bulged on `SW_GLAZING`; the 3D glass runs use the curved joint mitre (`jointGrow`).
- Editor (structure tool, desktop): the curved wall tool (`R`, chip "קיר מעוגל") draws a wall through clicked points
  (next section) - the primary way since WALLP; the bend mode (`C`, or "כיפוף ועיגול פינות" in the wall inspector; no chip
  since WALLP) drags a segment's middle handle to bend it, sets or clears a segment radius, rounds a corner. The old
  three-click arc mode (start, end, a point on the arc) is gone: three clicks of the points tool make the same arc.
- Snapping: a drawing point (wall mode, arc mode, a dragged corner, a moved wall's corners) lands on a wall corner
  within the snap radius, else on a curved wall's arc within it (`snapPoint`); straight wall bodies keep the old
  behaviour (no body snap, the 45 degree step).
- Area: the wall panel shows the floor area a closed outline encloses (`wallOutlineAreaM2`, centre line; a round room of
  two half circles counts). Zones are not derived from walls.
- The phone keeps the editor desktop-only (owner decision 2026-09-30): the editor route shows the desktop-only state,
  so the curve and arc tools never appear there; the floor map draws the arcs.

## Design decisions (2026-10-08, the recommended answers taken; the owner may revisit)

1. Dragging a corner of a curved segment keeps its bulge (the arc's angle), so the arc scales with the chord; the
   radius is not held. A fixed radius would make some drags impossible (a chord longer than the diameter) and the
   numeric radius field already sets an exact radius.
2. Curve mode keeps the select-mode behaviour for the wall body (a drag on the selected wall's body moves it); bending
   is only through the segment handles. One less mode to learn; the handles are the only bend targets.
3. The bulge limit stays at 4 (about 303 degrees per segment); the importer splits arcs into parts of at most half a
   turn (bulge <= 1) and a full circle is two half circles.
4. Room area from curved outlines is shown in the studio (the wall panel of a closed outline); zones are not derived
   automatically from closed curved walls (zones stay drawn polygons, as for straight walls).

## Drawing through points (WALLP, owner request 2026-10-08)

The owner found the two-step "קשת" + "קיר מעוגל" awkward. The structure tool's "קיר מעוגל" chip (`R`) now draws a wall
**through points clicked on the curve**: point 1, point 2, point 3 ... with a live dashed preview of the smooth curve
through them and the cursor, its length and its tightest radius; a double click (a second click on the last point), Enter
or the "סיום" button builds it; a click on the first point (from three points on) builds a closed ring (a round room);
Backspace or Ctrl+Z take back a point, Ctrl+Y puts it back, Esc cancels. Points snap to wall corners and curved bodies,
else to the grid when it is on (no 45 degree step: the points lie on a curve; Shift = no snap). Taps work the same on a
touch screen (tablet); the phone keeps the editor desktop-only.

### The fit (`frontend/src/map/curve-fit.ts`, pure, unit-tested)

1. A tangent at every point: the tangent of the circle through the point and its two neighbours; an open end takes the
   circle through the first / last three points. Points on one circle give exactly that circle; three points give one
   arc; collinear points give a straight wall.
2. Between consecutive points: one arc when both tangents agree with a single arc (the circle case), else a **biarc** -
   two arcs meeting tangentially at a junction (equal tangent lengths). The curve is G1 (tangent-continuous) at every
   clicked point and every junction, including the closing point of a ring.
3. A point where the path reverses (more than 150 degrees between the chords) is kept as a corner: each side is fitted
   on its own, so no loop is forced. Near-coincident points (< 0.5 px) count once; a ring through two points is their
   circle; fewer than two points build nothing.

Chosen over one arc per pair of points (a G1 chain of single arcs depends on its first tangent, oscillates with uneven
spacing and has no solution for a closed ring with an even number of points) and over a spline approximated by arcs
within a tolerance (more corners, no exactness on circles). Biarcs are local: moving a point changes the curve only in
the spans next to it. The arcs are ordinary bulges, so DXF, 3D, glazing, openings and areas need nothing new.

### Storage and editing

- The wall is an ordinary curved wall (polyline + bulges, schema 2.1). The clicked points' polyline indices are kept in
  `external_ids.curve_through` (e.g. `"0,2,4"`; the other corners are junctions). `external_ids` is a free string map in
  2.0 / 2.1, so there is no schema change and no migration; the server stores and packages it untouched; an older
  reader keeps it and only loses the re-fit. The record is checked on read (`studio-ops.curveThrough`): malformed or
  stale indices make the wall an ordinary curved wall.
- The clicked points are the wall's handles (select mode, the select tool, and the curved drawing modes while nothing is
  drawn): a drag re-fits through the moved point (one undo step; openings keep their place by projection), the arrow
  keys move the selected point, Delete or "הסר נקודה" removes it (with fewer than two points left the wall goes), "הוסף
  נקודה" adds one on the longest span. In a drawing mode a tap on a handle starts a new curve there (to continue).
- Edits by other tools end the re-fit (the record is dropped): bending a segment, a radius, rounding or removing a
  corner. A whole-wall move keeps it.
- Glass: the "קיר זכוכית" chip (`G`; its tooltip and accessible name also say "קיר מסך") draws a glass wall directly,
  straight (like the wall tool) or curved (through points), with the glazing defaults, the tool's panel width and frame
  depth (0.12 m). The kind is called "קיר זכוכית" everywhere (it was "קיר חלונות"); the conversion buttons stay.
- Shared fixture: `contracts/fixtures/plan_geometry/sample-curve-points.json` is produced by the frontend fit; the
  frontend spec re-fits every wall to itself, `tests/test_wall_curve_points.py` checks validation, 2.1, primitives,
  openings on the curve, glazing along it, DXF arcs and read-back, save and package with the record.
- Safety caps (integ/243, the shared curve budget of security review 2.4.2 M1): the fit runs only in the editor; its
  output reaches the server as ordinary walls through the geometry routes, all of which run `plan_geometry.validate` ->
  `wall_path.check_walls` / `CurveBudget` before anything samples, renders or stores the walls. A fitted wall past the
  budget (more than 512 corners on one wall, more than 5000 arc segments or 200 000 sampled points in a document) is
  refused with 422 `geometry_structure` and the issue code `curve_corners` / `curve_segments` / `curve_points`
  (`tests/test_wall_curve_points.py`). The editor mirrors the per-wall cap: at most 255 clicked points per curve
  (`curve-ops.MAX_CURVE_POINTS`, at most 511 corners), and a fit past `MAX_CURVED_CORNERS` is neither built nor re-fitted
  (`tests/unit-curve-fit.spec.ts`). The document-wide segment and point caps are enforced by the server only.
