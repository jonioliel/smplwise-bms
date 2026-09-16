# Canonical plan geometry schema v1 (T059)

**Status:** schema locked at `contracts/schemas/plan_geometry.v1.schema.json`; validator and exporter in
`smplwise/services/plan_schema.py`; tests in `tests/test_plan_schema.py` (0.1.29). No API endpoint yet.

## Why a schema

Every consumer of a floor plan — the map, the historical map, zone search, correlation, future AI-assisted
detection — must read the same, versioned description of what the VMS actually knows about a plan version, never a
picture with guesses baked in. The document therefore separates what was **measured** (the source hash, pixel
dimensions, the transform that produced the map background, rooms drawn or accepted by a person) from what was
**estimated** (auto-detected rooms, a door inferred from a placed lock) and from what is **missing** (walls and windows
are not detected by this build; calibration when no scale was entered), and says so in `uncertainty.notes`.

## Shape (v1)

| Field | Content | Rule |
|---|---|---|
| `schema_version` | `"1.0"` | breaking changes bump the major; additive fields bump the minor with defaults |
| `source` | `sha256`, `file_name`, `mime`, `page` | the immutable upload; the hash ties the document to one file |
| `dimensions` | `width_px`, `height_px`, `scale_m_per_px`, `calibration{status, reason}` | `measured / estimated` require a positive scale; `missing` requires a reason |
| `transform` | `rotation` ∈ {0, 90, 180, 270}, `crop{x, y, w, h}` normalized | the crop must stay inside the source |
| `walls` | polylines, thickness, confidence, source | empty in this build |
| `doors`, `windows` | position, optional wall, width, bound HA entity, confidence, source | doors come from placed locks / door sensors today |
| `rooms` | polygon, kind, name, confidence, source | ≥ 3 points, non-zero area, no self-intersection |
| `connectors` | stairs / elevator / corridor / ramp with position and floors | empty in this build |
| `uncertainty` | `overall` 0..1 and notes | the notes are for people; the number is for sorting |

All coordinates are normalized to the version image (origin top-left, 0..1), the same space the anchors use, so a
version with identical geometry (same source, page, rotation, crop) shares the space and anchors carry over (T038).

## Validation rules beyond JSON Schema

`plan_schema.validate(doc)` returns a list of problems: schema version, hash format, positive dimensions, calibration
consistency, crop inside bounds, normalized points, polygon validity (area > 0, simple), enumerated kinds, confidence
in [0, 1], provenance in `manual | auto | imported`, and **duplicate ids across all collections**.

## Determinism

`plan_schema.canonical_json(doc)` sorts keys, fixes separators and rounds floats to six digits: two exports of the same
version are byte-identical, which is what a deterministic renderer needs as input. The renderer itself (drawing the
document instead of the raster) is not built yet; the map still draws the raster background plus the zones layer.

## Open

- `GET /plan-versions/{id}/geometry` returning the document (read permission as the image).
- Wall / window extraction from the stylized rendering (`plan_stylize` finds wall masks but does not vectorize them).
- Connectors (stairs, elevators) as first-class placements linking floors.
- Regression set of plans (blurred scan, Hebrew labels, several floors, small dimensions, dense furniture, no scale)
  compared as geometry, not as pictures (MASTER_SPEC ch. 20).
