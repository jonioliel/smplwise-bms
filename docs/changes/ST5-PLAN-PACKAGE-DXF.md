# ST5 / T088 — Plan Studio 5: DXF export, signed plan package, re-import

Branch `pilot/ST5-dxf-package` (not released, not merged). Requirements R175 / R176, tests AT175 / AT176.
Owner direction 2026-10-05: build without waiting for answers, decide per the unified design style. The decisions
below are the agent's and are open to the owner's review.

## What was built

### DXF export — `GET /api/v1/plan-versions/{id}/export.dxf?draft=&level=&layers=`
- `services/plan_dxf_export.py`, drawn from the same primitives as the SVG / PNG exports and the map
  (`plan_geometry_render.structure_primitives`).
- DXF R2018 (UTF-8). Fixed layers: `SW_WALLS`, `SW_OPENINGS`, `SW_ROOMS`, `SW_DEVICES`, `SW_OBJECTS`,
  `SW_CONNECTORS`, `SW_LABELS`. Each entity carries its item id as XDATA (`SMPLWISE`).
- Units: calibrated plan → metres (`$INSUNITS 6`); uncalibrated → plan pixels, unitless (`$INSUNITS 0`). Custom header
  variables `SW_UNITS`, `SW_SCALE_STATUS`, `SW_PLAN_VERSION`, `SW_FLOOR`, `SW_STAGE`, `SW_DOC_HASH`. y is mirrored
  (CAD y up), origin at the plan's bottom-left.
- Walls are LWPOLYLINE centre lines with constant width = thickness; doors = leaf LINE + swing ARC; windows = two
  LINEs; passages = dashed LINE; rooms = closed LWPOLYLINE + name; devices (camera / entity anchors) = CIRCLE + name,
  cameras with a heading LINE; objects = closed outline or ELLIPSE.
- Hebrew: MTEXT in style `SW_TEXT` (Arial). Control characters and bidi embedding / override marks are removed,
  MTEXT codes escaped. Text is stored in logical order.
- Permissions as the SVG export: published with `map.read`, drafts with `map.edit`. Not audited (the SVG/PNG exports
  are not either).

### Signed plan package — `POST /api/v1/plan-versions/{id}/package` body `{draft: bool}`
- `services/plan_package.py`. ZIP (`*.swplan.zip`): `plan.json` (canonical stored document), `rooms.json`,
  `anchors.json`, `catalog.json` (custom library items the objects use), `assets/background.*` (the version picture),
  `assets/source.*` (the original file, only when ≤ 16 MiB), `report.html` (Hebrew), `manifest.json` (SHA-256 per
  file, document hash and geometry hash, counts), `MANIFEST.sha256`, `manifest.sig.json`.
- Signature: the installation's existing Ed25519 key (`services/signing.py`, T067). Only the public key travels; the
  private key stays in `/data/keys`.
- `map.edit` on the floor; audited `geometry.package.export`.

### Re-import — `POST .../package/preview?mode=replace|merge` and `POST .../package/import?mode=&base_revision=&expect_hash=&accept_foreign=`
- Hostile-input checks reused from the evidence-bundle import (`services/bundle.py`): EOCD precheck, entry names
  (no `..`, absolute, drive letters, backslashes, control chars, symlinks, encrypted, duplicates), entry count (16),
  declared total (128 MiB), compression ratio (zip bomb), upload ≤ 48 MiB (also in `body_limit.LIMITS`). Only the known
  file names are accepted; every file is hashed against the signed manifest; unlisted files are refused.
- Version checks: package schema `smplwise-plan-package/1`, document `schema_version` 2.0; a package made by a newer
  app version is a warning. Full document validation; structural errors refuse.
- Preview (dry run, read connection, nothing written): origin, trust (`installation` / `embedded_key_only`), diff vs the
  current draft, counts, issues, same drawing / same version, and the entities the package names that are missing here:
  cameras / entities not on this installation, anchors not placed on this floor, circuit switches, custom items
  (added / missing / differing), rooms.
- Import: writes the target version's **draft only** (never a published structure, never another floor, never live
  rooms or anchors). Replace = the package's document; merge = current draft + package items, an item with the same id
  takes the package copy, nothing removed. A drawing mismatch adds an uncertainty note. The request must carry the draft
  revision and the result hash the preview showed (409 `stale_revision` / `import_plan_changed`). A package signed by
  another installation needs `accept_foreign=true` (409 `package_foreign`). Custom items the draft needs are added to
  the library when the person holds `catalog.manage`. Audited `geometry.package.import` (allowed and denied) and
  `catalog.import` (via plan_package).

### UI (plan editor › structure tool, export row)
- New buttons: `DXF`, `חבילה` (save the package of the draft, pending edits flushed first), `ייבוא חבילה` (file pick →
  dialog). The dialog (`screens/plan-package-dialog.ts`): replace / merge toggle (re-runs the dry run), source and
  trust, per-collection changes, warnings, what is missing, the trust checkbox for another system's package, the
  import button. No hints or badges on operator screens; no infrastructure branding.
- Strings Hebrew + English in `i18n/plan-package.ts` (English when the document `lang` starts with `en`).

## Decisions made without the owner
1. Rooms (zones) and anchors are **reported, not written** by an import: they are live map data, the import restores a
   draft. 2. The package requires a valid signature; foreign keys need an explicit confirmation. 3. The source file
   travels only up to 16 MiB. 4. Merge = package wins on same id, nothing removed. 5. DXF export is not audited (like SVG).
6. No migration was needed (0068 unused).

## Known limits
- Right-to-left ordering of Hebrew in commercial CAD programs was not verified (only ezdxf and our own DXF reader).
- DXF does not carry the plan picture; levels are not split into separate layers (use `?level=`).
- Importing a package does not create floors, plan versions or assets; it targets an existing editable version.
- The phone editor does not show the export row, and no plan canvas at all: at phone width the owner's mobile option
  `hide_structure` (default ON, decision 2026-09-30, `shell/phone.ts`, `routeGuardKind`) replaces `#/explore/floors/<id>/edit` with
  the notice "עריכת מבנה וקומות זמינה במחשב בלבד". This is why the plan walls "never showed" in the mobile run of the live editor
  test: the canvas was never mounted (by design, not a product bug; the old test expected walls on a screen the phone is not
  offered). The live spec now asserts the guard on the mobile project (no `sw-plan-canvas`, no overflow) instead of skipping it; the
  dialog on mobile is covered by the fixture part. The live part still needs a running backend (SW_LIVE=1).

## Rollback
Revert the branch commit: new routes and files only; `geometry_store._prepare` gained an optional `items` argument
(default unchanged). No schema change.

## Tests
- Backend: `tests/test_plan_dxf_export.py` (7), `tests/test_plan_package.py` (19).
- Playwright: `frontend/tests/evidence-plan-package.spec.ts` — fixture part (harness `tests/harness/plan-package-harness.ts`,
  vite dev server) and live part (`SW_LIVE=1`). Screenshots in `docs/design/evidence/plan-package/`.
