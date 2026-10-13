# CR-037 — Plan Studio 8: BIM / IFC export and import (T090)

Branch `pilot/ST8-ifc` (from `main` b26c1b7d = 2.4.8). Task T090 (R179 / R180, AT179 / AT180). Owner released the
task on 2026-10-13; every owner decision met on the way took the safest default and is listed in section 7.
Design basis: `docs/architecture/PLAN_STUDIO_DESIGN_HE.md` section 17.3, ADR-016, CR-003 (IFC through an own
writer), the plan model `contracts/schemas/plan_geometry.v2.schema.json` (documents 2.0 / 2.1 / 2.2) and the
DXF / package work of ST5 / PLN2 / PLNS (`docs/changes/ST5-PLAN-PACKAGE-DXF.md`).

## 1. Scope

**Export** — `GET /api/v1/plan-versions/{id}/export.ifc?draft=&level=` — IFC4 (ISO 10303-21 text, `FILE_SCHEMA
(('IFC4'))`), written by an own dependency-free STEP writer, `services/plan_ifc.py`:

| plan model | IFC | geometry |
|---|---|---|
| plan version | IfcProject › IfcSite › IfcBuilding (the floor's name) | units metre / square metre / cubic metre / radian; one Model context, Axis / Body / FootPrint sub-contexts |
| `levels[]` | IfcBuildingStorey, `Elevation` = `elevation_m`, placed at Z = elevation | levels in elevation order |
| `walls[]` | IfcWall (`PredefinedType` SOLIDWALL / PARTITIONING / USERDEFINED for railing · low · glass) | `Axis`: the centre polyline; `Body`: an IfcExtrudedAreaSolid per segment (rectangle of thickness × segment, height = `height_m` or the level's ceiling, from `base_z_m`); a curved wall (2.1) is sampled to chords for the Body, its corners go to the Axis and its bulges to the property set |
| `openings[]` | IfcOpeningElement + IfcRelVoidsElement; door → IfcDoor + IfcRelFillsElement (`OverallWidth` / `OverallHeight`, `OperationType` from swing); window → IfcWindow; passage → the opening only | a box at `t` along the host wall, width × (thickness + 2 cm) × height from the sill, placed with `RefDirection` = the wall's tangent |
| rooms (`spatial_zones`) | IfcSpace (aggregated into the storey of `rooms[].level_id`, default level otherwise) | `Body`: the polygon extruded to the room's / level's ceiling height; `LongName` = the room's name |
| `objects[]` | the catalog item's `ifc.class` / `predefined_type` (IfcFurniture, IfcLightFixture, IfcSanitaryTerminal, IfcColumn, IfcBuildingElementProxy, …; `plan_catalog.DEFAULT_IFC` when the item has none) | a box w × d × h at `z_m`, rotated by `rotation_deg` |
| `connectors[]` | IfcStair (stairs), IfcRamp (ramp), IfcTransportElement ELEVATOR (elevator), IfcStair USERDEFINED (tribune, ladder) | the polyline as a band of `width_m`, 1 m high, on `level_from` |
| anchors (cameras / entities the caller may see) | camera → IfcAudioVisualAppliance CAMERA; entity → IfcBuildingElementProxy | a 0.3 m box at the anchor, named by the anchor's display name; the resource ids in the property set |
| every element | `Pset_SMPLWISE` (IfcPropertySet): `ItemId`, `Collection`, `Kind`, `LevelId`, `Thickness`, `T`, `Swing`, `Hinge`, `Sill`, `Bulges`, `CatalogItem`, `ResourceType`, `ResourceId`, `EntityId`, `ScaleStatus` | what a re-import needs for an exact round trip |

Not exported, with the reason: labels (IfcAnnotation carries no useful text for a BIM viewer; the names of rooms and
objects are on the elements), circuits (IfcDistributionCircuit needs IfcDistributionSystem ports — out of scope for
stage 1; the switch entity id is on each member's property set as `CircuitSwitch`), groups, uncertain regions,
materials / lights (CR-029 look fields) and walk positions.

**Import** — `POST /api/v1/plan-versions/{id}/import-ifc?level_id=&storey=` (multipart `file`) — a best-effort reader,
`services/plan_ifc_read.py`, that answers **candidates in the shape of `/detect` and `/import-dxf-geometry`** (walls,
openings, objects; rooms as zone candidates) plus an **import report**. Nothing is stored by the import route: the
person accepts the candidates in the editor's detect tool through the existing `/detect/accept` (walls / openings /
objects) and the zones accept (rooms), exactly like the DXF import. Read: IfcBuildingStorey (one storey is mapped onto
the chosen document level — see 7.4), IfcWall / IfcWallStandardCase / IfcCurtainWall, IfcOpeningElement + IfcDoor /
IfcWindow (passages = unfilled openings), IfcSpace, and the furniture / fixture classes of the catalog table (IfcFurniture,
IfcFurnishingElement, IfcLightFixture, IfcSanitaryTerminal, IfcElectricAppliance, IfcMedicalDevice,
IfcFireSuppressionTerminal, IfcAlarm, IfcColumn, IfcBuildingElementProxy, IfcCommunicationsAppliance,
IfcAudioVisualAppliance, IfcSign, IfcSwitchingDevice, IfcTransformer, IfcGeographicElement, IfcFlowTerminal,
IfcDistributionElement, IfcDistributionControlElement, IfcEnergyConversionDevice). Everything else is listed in the report
as skipped with its class and reason (`unsupported_class`, `no_geometry`, `curved_geometry`, `no_storey`,
`other_storey`, `placement_cycle`, `outside_plan`, `opening_off_wall`, `live_device`, …). Partial import is never silent
(R130): the report carries counts, the skipped list (capped at 200 rows + a total) and warnings.

Geometry the reader understands: IfcLocalPlacement chains (IfcAxis2Placement3D / 2D), IfcExtrudedAreaSolid with
IfcRectangleProfileDef / IfcArbitraryClosedProfileDef (IfcPolyline, IfcIndexedPolyCurve with IfcCartesianPointList2D/3D
without arc segments), IfcMappedItem (with IfcCartesianTransformationOperator3D), IfcBooleanClippingResult (the first
operand), IfcFacetedBrep (the footprint of its vertices), the wall `Axis` representation, IfcMaterialLayerSetUsage
(wall thickness), `Pset_WallCommon.IsExternal`, `Pset_SMPLWISE` (our own export). Schemas accepted: IFC4, IFC4X1-X3 and
IFC2X3 (attribute positions used are identical for the entities read); other schema names are refused.

**UI** — plan editor › structure panel › export row: `IFC` (the draft as IFC4) and `ייבוא IFC` (file pick → the
candidates open in the detect tool with the origin "מיובאים מ־IFC" and the report's one-line summary; the skipped list
is shown as a short list in the same panel). Strings in `frontend/src/i18n/plan-ifc.ts` (Hebrew and English). No new
Settings page, no hints or badges, no infrastructure branding, desktop only like the rest of the structure editor.

## 2. Format, units, coordinates

- IFC4 (IFC4 ADD2 TC1 entity names), text STEP, UTF-8 with the STEP `\X2\…\X0\` encoding for every non-ASCII
  character (Hebrew names survive in every IFC viewer; the reader decodes `\X2\`, `\X4\`, `\X\`, `\S\` and `''`).
- Units are metres, whatever the plan's calibration. A plan **without** a calibration (status `missing`) cannot be
  exported as IFC (422 `plan_uncalibrated`): a BIM file in pixels would be wrong, not approximate. An estimated
  calibration exports with `Pset_SMPLWISE.ScaleStatus = estimated` on the project.
- Axes: IFC X = plan x (right), IFC Y = plan up (= −plan y), Z up; origin = the plan's bottom-left corner (the same frame
  as the DXF export). A storey is placed at Z = `elevation_m`; walls, openings and spaces are placed relative to the
  storey; an element's Z is relative to the storey. The site carries no latitude / longitude (the location is a
  settings matter, SEC247 I3); `north_deg` (2.2) is written to `Pset_SMPLWISE.NorthDeg` on the project only.
- Rotation: the plan's `rotation_deg` is clockwise on screen; in IFC (Y up) the element's `RefDirection` is
  (cos −θ, sin −θ). The reader inverts it.
- Import units: `IfcUnitAssignment` → `IfcSIUnit` LENGTHUNIT (prefix MILLI, CENTI, DECI, KILO, …) or
  `IfcConversionBasedUnit` (inch, foot, …) through its `IfcMeasureWithUnit`; no length unit → metres assumed with a
  warning in the report.
- Import alignment (`alignment` in the report): the file's XY are taken as plan metres from the plan's bottom-left
  corner when every candidate then lies inside the plan; otherwise the whole set is translated so its bounding box
  starts at the plan's origin (foreign files have arbitrary origins). What still falls outside the plan after that is
  skipped as `outside_plan` and the report says how many metres the plan would need. Nothing is scaled.

## 3. GlobalId and round trip

- GlobalId = the IFC 22-character encoding of `uuid5(SMPLWISE_NAMESPACE, f"{floor_id}:{collection}:{item id}")`,
  unless the item carries `external_ids.ifc_guid` (an item that came from an IFC keeps the architect's id). Two exports
  of the same structure are byte-identical except `FILE_NAME`'s timestamp, which is the exported row's own time
  (published `created_at` / draft `updated_at`), so a published structure exports to the same bytes every time.
- Our own file re-imported into the same floor restores walls (polyline, bulges, thickness, kind, height, base),
  openings (host, t, kind, width, height, sill, swing, hinge), objects (catalog item, position, rotation, size, z) and
  rooms (polygon, name) to the rounding used (positions 1e-5 normalized, metres 1e-3), as candidates with
  `external_ids.ifc_guid`. Levels are not created (7.4); connectors, labels, circuits, groups, anchors are reported, not
  imported (`live_device` for anchors, as the package import decided in ST5 decision 1). The test
  `tests/test_plan_ifc.py::test_round_trip_*` holds this.
- A foreign file (another BIM tool): what the geometry table in section 1 covers, best effort, never silently partial.

## 4. Limits and security (untrusted file)

- Upload ≤ 32 MiB (`body_limit.LIMITS` row `plan_ifc`, and the route checks `plan_ifc_read.MAX_BYTES` itself);
  `.ifczip` / any ZIP is refused (`ifc_compressed`) — only the text form is read; a file without `ISO-10303-21` /
  `DATA;` / `FILE_SCHEMA` is refused (`ifc_not_step`); NUL bytes refuse.
- Parser bounds: ≤ 400,000 entity instances, ≤ 64 KiB per instance, nesting depth ≤ 32, ≤ 50,000 items per aggregate,
  strings ≤ 4,000 characters, the `\X2\` decoder bounded; every bound refuses with `ifc_too_complex` before any mapping.
- No external references are followed: STEP p21 has none; `IfcExternalReference` / `IfcDocumentReference` /
  `IfcLibraryReference` are ignored (no network, no file system).
- Placement / mapping chains: depth ≤ 64 with cycle detection (a cycle skips the element, `placement_cycle`);
  non-finite or absurd numbers (|v| > 1e7 m) skip the element (`bad_number`).
- Time: the read runs in the detection worker pool under `detect_timeout_s` (504 `ifc_timeout`, like the DXF
  import), and the parser checks the same deadline every 2,000 instances (`IfcTimeout`), so a timed-out read stops
  instead of finishing a result nobody reads.
- Memory: the file is read once into a string; instances are parsed lazily by index (only the attribute text is kept
  until an instance is looked up), and the candidate collections are capped at the document limits (2,000 walls, 4,000
  openings, 5,000 objects, 500 rooms) — the rest is reported as `limit`.
- Output of the import is the candidate shape only; ids are `imp-<run>-w001` etc. (never the file's); the file's names
  are cleaned like every imported text (control characters and bidi marks removed, ≤ 80 chars).
- Export: only the anchors the caller may see (review M2 / PLNS: hidden anchor references are nulls in the served
  document, so a withheld body is exported at the served pose, never the hidden camera's).

## 5. RBAC and audit

- Export: `map.read` on a published structure, `map.edit` on a draft (the SVG / PNG / DXF rule). Audited
  `geometry.ifc.export` (allowed: version, stage, bytes, counts). Unlike the DXF export it IS audited: an IFC leaves
  the system as a model of the building, which the owner asked to be traceable.
- Import: `map.import` on the floor (the DXF import's permission), an archived version refuses. Audited
  `geometry.ifc.import` (allowed with counts and the skipped total; a refusal with `code` / `timed_out` / `failed`).
  The accept goes through `/detect/accept` (`map.edit`) and is audited there as every accept.
- No new role, no new permission, no migration (nothing is stored by this change).

## 6. Dependency decision: IfcOpenShell is NOT added

Evaluated on 2026-10-13 against the design's "availability check" (17.3): IfcOpenShell is LGPL-3.0 (acceptable to
link dynamically), but its wheels are ~60–90 MB per platform (the `ifcopenshell` package bundles OpenCASCADE), there is
no musl / Alpine wheel for the add-on's base image, and the aarch64 wheels lag behind. Adding it would roughly double
the add-on image and tie the build to a C++ toolchain for a feature that reads a known entity subset. The pure-Python
reader above covers our own export exactly and the common ArchiCAD / Revit / BricsCAD wall / opening / space / furniture
representations best-effort, within the bounds of section 4 (a C++ parser would also be harder to bound). Revisit only
if the owner needs IFC files with complex solids (clipping chains, B-reps of curved walls) read exactly — then as an
isolated converter process like `dwg2dxf` in section 17.2, never linked into the add-on process.

## 7. Decisions taken without the owner (safest default; open to review)

1. **Uncalibrated plan → no IFC export** (422). An IFC with pixel coordinates would mislead a BIM user.
2. **Import never writes**: candidates + report; accept through the existing detect / zones accept (the DXF rule).
3. **Rooms are zone candidates**, not structure items (ST5 decision 1: rooms are live map data).
4. **One storey per import**: `storey` (index in elevation order) chooses which IfcBuildingStorey lands on the chosen
   document level; default = the storey whose elevation is closest to that level's `elevation_m` (a one-storey file
   always matches). The other storeys are listed in the report as `other_storey` with their index, so a second import
   with `storey=` brings the next one to the next level. Levels are not created by the import (a document level is an
   editor decision with a ceiling height; creating levels from a file would also create connectors nobody drew).
5. **Anchors are exported, never imported** (live devices; `live_device` in the report).
6. **Export audited**, import audited; no new permission.
7. **Curved walls**: Body sampled to chords (`wall_path.sample`, 0.25 px tolerance), Axis = the corners, bulges in
   `Pset_SMPLWISE.Bulges` (a JSON array) — our round trip is exact, a foreign viewer sees chords.
8. **Glass walls** (2.1): IfcWall USERDEFINED `ObjectType = 'glass'` with the frame depth as thickness; the glazing
   block is not modelled (no IfcCurtainWall panels) and the report of a re-import restores kind `glass` from the Pset
   only (the glazing block takes the defaults).
9. **Objects without a catalog class** export as `plan_catalog.DEFAULT_IFC` (IfcFurniture USERDEFINED); a foreign
   object whose class / type has no catalog item imports as `object.generic` with confidence 0.5 (the DXF rule).
10. **Door swing to IFC `OperationType`**: left → SINGLE_SWING_LEFT, right → SINGLE_SWING_RIGHT, double →
    DOUBLE_DOOR_SINGLE_SWING, sliding → SLIDING_TO_LEFT, none → NOTDEFINED; the inverse on import (any DOUBLE_* →
    double, any SLIDING_* → sliding, *_LEFT → left, *_RIGHT → right, else none).

## 8. Files

- `smplwise_vms/backend/smplwise/services/plan_ifc.py` — writer (STEP encoder, GlobalId, the entity builders).
- `smplwise_vms/backend/smplwise/services/plan_ifc_read.py` — bounded STEP parser + mapper to candidates + report.
- `smplwise_vms/backend/smplwise/routers/plan_ifc.py` — the two routes; registered in `main.py`; `body_limit.LIMITS` row.
- `smplwise_vms/backend/tests/test_plan_ifc.py` — writer structure, determinism and GlobalId stability, permissions and
  audit, round trip (two levels, curved wall, every opening kind, objects, rooms), a hand-written foreign-style file
  (millimetres, IFC2X3, rectangle-profile walls without Axis, material layers, doors by OperationType), hostile files.
- Frontend: `api/geometry.ts` (`exportUrl('ifc')`, `importIfcGeometry`, the report type), `i18n/plan-ifc.ts`,
  `screens/plan-studio-panel.ts` (export row, candidate origin), `screens/explore-plan-editor.ts` (the import flow and
  the report), `map/candidates.ts` (source `ifc`).

## 9. Known limits

- A foreign file's walls with arcs, B-rep walls, clipping chains deeper than the first operand, grid placements and
  IfcGeometricSet representations are skipped with a reason, not approximated.
- The reader maps one storey per import and creates no levels (7.4).
- Doors / windows of a foreign file sit at `t` from the projection of their placement onto the host wall's axis;
  their swing comes from `OperationType` only (no leaf geometry analysis).
- Hebrew text order in third-party BIM viewers was not verified (the encoding is the standard `\X2\` one).
- No 3D viewer check of the written IFC in a commercial product was possible in this environment; the file is checked
  by our own reader and by structure assertions (entity counts, references resolve, every storey aggregated).

## 10. Rollback

Revert the branch commits: new files, two new routes, one `body_limit` row, one router registration, frontend strings and
the export-row buttons. No migration, nothing stored, no schema change.
