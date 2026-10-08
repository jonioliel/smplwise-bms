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
- ~~DXF does not carry the plan picture; levels are not split into separate layers~~ - addressed by PLN2 (below).
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

---

# PLN2 — levels in the DXF, the plan picture, multi-level round trip

Branch `pilot/PLN2-plan-dxf` (from `main` 383a03d9 = 2.3.0; released in 2.3.1 via `integ/231`). No migration.

## DXF layers per level
- A plan with **one** level: the fixed layer names, byte-for-byte the same drawing as before.
- A plan with **more than one** level: each level gets its own layer family, `<fixed name>-<suffix>` (`SW_WALLS-L0`,
  `SW_OPENINGS-L1`, `SW_ROOMS-…`, `SW_OBJECTS-…`, `SW_CONNECTORS-…`, `SW_LABELS-…`). The suffix is the level id upper-cased,
  `[A-Z0-9_]` only, at most 24 characters; an empty or clashing result becomes `LV<n>` (n = place in elevation order). The rule
  depends on the level count only, never on `?level=`, so names are stable across exports. CAD: switch a level with a layer
  filter / wildcard `*-L1`.
- Openings follow their wall; rooms of an unknown level go with the default level; a connector between two levels of this
  floor is drawn on both levels' connector layers, a connector to another floor on its own level's layer only; devices stay on
  `SW_DEVICES` (anchors are per floor). On level layers the level id is the third XDATA value. Layer descriptions and the header
  variables `SW_LEVEL_<suffix>` = `name | elevation m` carry the level names (Hebrew as UTF-8 text, cleaned like all text).
- Units, the y mirror and the Hebrew handling are unchanged.

## The plan picture
- ezdxf writes `IMAGE` + `IMAGEDEF` robustly (audit clean, read back), but a DXF **cannot embed raster data**: the picture
  is always an external file. So the bare `export.dxf` still carries no picture.
- The signed package can carry `assets/plan.dxf` (request body `{"draft": …, "dxf": true}`; UI button "DXF + תמונה" /
  "DXF + picture" in the studio export row). Its `IMAGE` (layer `SW_BACKGROUND`, drawn first) names `background.<ext>` by bare
  file name - the picture already shipped in `assets/`, i.e. the same folder - with its real pixel size, stretched over the plan.
  Unzip the package and open `assets/plan.dxf`.
- Default stays without the DXF: an importer of 2.2.x/2.3.0 refuses unknown file names, so the plain "Package" button keeps
  producing packages older installations can import.
- Import: `assets/plan.dxf` is listed and hashed against the signed manifest, never parsed, bounded at 24 MiB on the declared
  size (422 `package_file_too_large`, audited); on export a DXF over the bound is left out (`manifest.dxf.skipped = too_large`).
  All 2.2.1 limits and trust checks are unchanged. The package DXF draws only the anchors the exporting person may see (M2).
- **Limit:** opening the drawing with the picture was verified with ezdxf only, not in AutoCAD / BricsCAD / QCAD; a CAD
  program that does not search the drawing's folder for a bare image name needs the image path re-pointed once.

## Round trip with levels and connectors
`tests/test_plan_package_pln2.py`: three levels, door / window / labels / objects per level, an L-shaped stair model, an
elevator, a tribune-derived connector and stairs linked to another floor. Replace import restores the document hash, the
geometry hash and a per-level hash; merge restores the package items and keeps a local one (merge appends re-added items, so
the collection order - and the document hash - can differ from the export; the per-level comparison is by id); an import into
another version of the floor keeps the geometry hash. Import never writes the other floor's twin.

## Editor end to end
The live part of `evidence-plan-package.spec.ts` builds a two-level plan with stairs, checks the per-level layers in the DXF,
downloads both packages from the editor, drifts the draft on both levels and imports the DXF package back through the dialog.
Phone: the structure editor is intentionally not offered (`hide_structure`, decision 2026-09-30); the mobile project asserts
the desktop-only notice, no canvas and no export / import control (`editor-guard-mobile.png`). Run on the runner:
`run_smart.py fixture pilot/PLN2-plan-dxf evidence-plan-package --project=desktop` (and `--project=mobile`).

## Observed, not changed (pre-existing)
~~A structure object bound to an anchor stores `anchor_ref.resource_id` and sits on the anchor's position in the stored document
(`plan.json`, the geometry read). The M2 filter removes hidden cameras from the anchors, the report and the DXF devices, but a
bound body in `plan.json` still names a camera the exporter's scope denies. Needs an owner decision (the stored document is
what the hashes cover).~~ - addressed by PLNS (below).

---

# PLNS — anchor references follow the reader's camera scope (owner decision D1, 2026-10-08)

Branch `pilot/PLNS-camera-scope` (from `main` 5f907758 = 2.4.0). No migration. Code: `services/plan_anchor_scope.py`.

## The rule
- Where a structure document names an anchor: `objects[].anchor_ref`, `openings[].anchor_ref`,
  `walls[].glazing.operable[].anchor_ref` (glass panels).
- Visible = the floor bundle's rule (T055): a camera follows the reader's camera scope for `map.read` (explicit deny wins); an
  entity is withheld from a reader who reaches the floor only through camera bindings. An installation-wide reader with no
  deny is untouched (fast path, byte-identical answers). A camera of a removed recorder is not withheld from a reader who may
  see it (unlike the anchors list, which drops it from the *current* map only).
- **Read / export:** a hidden reference becomes `null`; the item stays, with its stored position and rotation (the
  structure is the floor's; only the link is withheld). Applied in one place for the plan-geometry router (`_shown`): GET
  geometry (draft, published, `?at=`), the PUT / copy-from / detect-accept answers, `export.svg`, `export.png`,
  `export.dxf`; and in `plan_package.build` for the signed package (plan.json, the package DXF). The diff, versions and
  timeline routes carry ids / counts / hashes only; the map bundle carries the row reference only; the global search
  carries no references.
- **Write:** the editor saves what it was served, so a `null` it sends for a reference it was not shown is given back from
  the stored document for the same item (same id; for a glass panel, the same wall id and panel number) - PUT geometry,
  detect-accept, shared-room edits routed to the home floor (CR-009, `shared_spaces.plan_edits(fix=)`), and the package
  import (replace and merge). Deleting the item still deletes it. A NEW reference to a hidden anchor that exists here (an
  anchor on the floor, a registered camera or a known entity) is refused on the editor routes (422 `anchor_hidden`,
  details `ids` = item ids, nothing written) and dropped on the package import (warning `anchor_hidden` in preview and
  import). Binding a body to a hidden camera would otherwise move the body onto the camera's position. A reference to
  nothing known is left as before (the `anchor_missing` warning).

## Hashes and ETags (the choice)
- Stored documents are unchanged; there is no migration and no stored hash moves.
- `geometry.doc_hash`, `published_hash`, the bundle's geometry ref, the timeline and the import's `result_hash` /
  `current_hash` stay the identity of the STORED row: the editor compares them for "pending publish", the map caches the
  document by them, and the import confirms them. They are identifiers, not checksums of the redacted body.
- The published read's ETag: unchanged (`"<stored hash><tags>"`) when nothing is withheld; otherwise
  `"<sha256 of the served body>-r<tags>"`, so another reader's cached copy is never confirmed with a 304 and a change of the
  reader's scope changes the ETag.
- The package: plan.json is the redacted document and the manifest's `doc_hash`, `geometry_hash`, the file SHA-256s and the
  DXF's `SW_DOC_HASH` are all computed over it - the package verifies and re-imports on its own terms. A scoped editor's
  package therefore has another `doc_hash` than the stored row; its re-import restores the hidden references from the draft.

## Known limits
- A withheld body does not follow its anchor on the reader's map or in their SVG / PNG (it has no reference); it is drawn
  where the last save put it, which is the anchor's position at that save.
- The import dialog does not show a text for the new `anchor_hidden` warning yet (the API returns it; UI change not made).
- A scoped editor who moves a body whose reference they were not shown sees it snap back on save (the hidden reference is
  kept, the store refreshes the position from the anchor).

## Tests
`tests/test_plan_anchor_scope_plns.py`: administrator / floor viewer with a camera deny / floor editor with a camera deny /
camera-only viewer; reads (published, history, draft, ETag and 304), SVG + DXF, the package (redacted plan.json, matching
manifest and DXF hashes; the administrator's package unchanged), save and re-import (replace, merge) by the scoped editor
keep the stored reference, a new hidden binding refused (PUT) / dropped (import), the service rules (glass panels,
openings, no-op without a scope).

## Rollback
Revert the PLNS commit. Nothing stored changed, so nothing needs undoing in the data; packages made by scoped editors
remain valid packages (their plan.json simply has nulls).

## Rollback
Revert the PLN2 commits; packages made with `dxf: true` then become unimportable (unknown file), plain packages unaffected.
