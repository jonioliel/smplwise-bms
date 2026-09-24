# Plan Studio — Phase 2 (T085) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The structure layer of phase 1 gains a library of objects (about 150 built-in items in 12 categories, custom items with "based on"), levels and connectors (a tribune that descends to −1.2 m, stairs that link two floors), lighting circuits bound to Home Assistant switches (lamps glow on the live map when the switch is on; the circuit is toggled from the live map through the existing HA action route) and objects in the global search — on every map surface the product already has, drawn by the same deterministic primitives in Python and TypeScript.

**Architecture:** Objects live in the v2 document (`objects`, `groups`, `levels`, `connectors`, `circuits` — collections that phase 1 already reserved and validates structurally) with positions 0..1 and sizes in metres. The built-in catalog is a versioned JSON file shipped with the add-on; custom items are rows of a new `catalog_items` table (migration 0020) and every API answer merges the two. An object that represents an entity is the BODY of its anchor: the anchor stays the source of truth for position, live state and permissions, and the server refreshes the object's position from the anchor on every draft save and publish. Rendering stays 2D: a category symbol inside a rotated footprint, produced by `plan_geometry_render.structure_primitives` and `geometry.ts buildPrimitives` alike and pinned by the extended golden fixture. The map bundle keeps returning a reference to the document; it gains `catalog_revision`, the published document's `levels` and the `circuit_states` the live map needs.

**Tech Stack:** FastAPI + SQLite on Python 3.12 (Pillow / numpy already present), Lit 3 + TypeScript 5.9 (strict, `noUnusedLocals`), Playwright 1.63. **No new runtime dependency** (Python or npm) in this phase.

**Spec:** `docs/architecture/PLAN_STUDIO_DESIGN_HE.md` (sections 2, 2a, 4.1–4.3, 5 with its 2026-09-24 amendment, 7, 8, 12, 13, 14 phase 2, 16) and `docs/changes/CR-003-PLAN-STUDIO.md`. Task card: `management/tasks/T085.md` (R169 / AT169, R170 / AT170). Foundation: the phase-1 plan `docs/superpowers/plans/2026-09-23-plan-studio-phase1.md` and the code it produced (0.1.82), plus the editor precision hotfix 0.1.83 that ships before this phase.

## Rulings

Controller rulings for phase 2 (binding; every task below follows them):

1. **No 3D in this phase.** Objects render in 2D on every map surface as a category symbol inside a rotated footprint rectangle (or a circle for cylinders), with an optional label; the primitives are produced by BOTH `plan_geometry_render.py` and `geometry.ts` (deterministic, identical rounding and sort order as in phase 1) and pinned by extending the golden fixture: `sample-v2.json` gains objects and connectors and the golden is regenerated (Task 4 says exactly how and asserts the new counts: 24 primitives for `all`, 7 for `level_L1`).
2. **Built-in catalog** `smplwise_vms/backend/smplwise/catalog/objects.json` with a `catalog_version`, 153 items in the 12 categories of design section 4.3 (Task 1 lists every item with id, category, names he/en, tags, role, shape, size, z_ref / z_m, params where relevant, icon symbol, color token, anchor_kinds, IFC class). Icons: a set of exactly 24 inline SVG symbols keyed by `icon`, defined once in TypeScript (`frontend/src/map/plan-symbols.ts`, map rendering) and once in Python (`services/plan_symbols.py`, SVG export); both produce the same symbol ids in the primitives; the drawing itself may differ in detail but not in placement.
3. **Custom items** live in the new table `catalog_items` (migration 0020: id, based_on, names_json, category, tags_json, role, shape, size_json, z_m, params_json, icon, color_token, created_by, created_at, updated_at), in `PROJECT_TABLES` for backups. API per design section 5: `GET /catalog/objects` (built-in + custom, filtered client-side), `POST/PATCH/DELETE /catalog/objects/{id}` (custom only), `GET /catalog/export`, `POST /catalog/import` (JSON of the custom items; duplicates by id are replaced), permission `catalog.manage` added to the permission matrix (`test_rbac_matrix.py`), to the built-in roles `editor`, `site_admin` and `system_admin` (viewers and operators not), to `PERMISSION_LABELS` (the custom roles editor) and to the role catalogue contract; audit actions `catalog.item.create` / `catalog.item.update` / `catalog.item.delete` / `catalog.import`. The map bundle gains `catalog_revision` so clients refresh the library.
4. **Objects in the document:** `objects` items `{id, item_id, level_id, position [x, y] (0–1), rotation_deg, size {w_m, d_m, h_m} (defaults from the item, editable), z_m, params, label, anchor_ref {resource_type, resource_id} | null, group_id | null, confidence, source, locked, external_ids}`. When `anchor_ref` is set the object is the body of that anchor: rendering takes the position and rotation from the anchor (the document's position is refreshed from the anchor on save and on publish, and every map surface overrides it with the live anchor position it already holds); the anchor keeps live state and permissions; deleting the anchor un-binds the object (kept, unbound). Binding UX: dropping an object within 0.5 m of an anchor whose kind is in the item's `anchor_kinds` offers "הצמד לישות"; a bound object shows the anchor's state (a lamp glows when the light entity is on).
5. **Arrays:** the array tool takes rows × columns, spacing, direction and creates member objects plus a `groups` item `{id, kind: "array", member_ids, params}`; moving the group moves all members; deleting the group asks (in-page dialog, never `confirm()`) whether to delete the members.
6. **Levels:** the document's `levels` collection (L0 default exists: name, elevation_m, ceiling_height_m, is_default); the editor gets level chips at the top of the canvas (all levels / one level) filtering objects, walls and labels; an "add level" dialog (name, floor elevation, ceiling height); each wall / object / label has `level_id`; zones and anchors get `level_id` through the existing PATCH routes (`spatial_zones.level_id` / `map_anchors.level_id` columns already exist); the zones editor and the entity / camera inspectors get a level selector; the bundle returns the published document's levels so the live map offers the same filter.
7. **Connectors:** `connectors` items `{id, kind: stairs | ramp | tribune | elevator | ladder, level_from, level_to, floor_ids [], polyline, width_m, label, object_id, source, external_ids}`; a tribune object (shape `stepped`, params rows / step height / step width / connects_levels) produces a connector automatically on save and publish (idempotent by object id: `cx-<object id>`); cross-floor stairs keep the same connector id in both floors' documents (the editor offers "קשר לקומה" with a floor picker; the second floor gets the connector on its draft). Connectors render with a direction arrow and a level delta label ("↓ −1.2 מ׳").
8. **Circuits:** `circuits` items `{id, name, switch_entity_id (an HA entity id of domain switch / light), member_ids (object ids of light items), color_token, power_w (sum of the members' params.power_w, recomputed by the server on save)}`; the live map shows the lamps of a circuit with a glow when the switch entity is on (state from the existing HA entity sync: `circuit_states` in the bundle, updated by the existing WebSocket push), and a circuit toggle on the live map that calls the existing HA action route with its existing permission (no new HA write path); the editor's circuit panel: new circuit → pick the switch entity from the synced HA entities (search) → click lamps to add / remove → power sum; circuit colour on the map.
9. **Global search:** `GET /search?q=` also returns `object` results from PUBLISHED documents (label or catalog names, he / en) with the floor path and the object id; the floor screen accepts `?focus=object:<id>` and centres on it. The scan is bounded: published documents only, indexed once per `doc_hash`.
10. **Exports:** SVG / PNG get `?layers=` (comma list of `structure,objects,labels,connectors`) and render objects and connectors; JSON export unchanged. Backups include `catalog_items`. Phone: viewing everything, placing / moving single objects; arrays and wall drawing stay desktop-only with an in-page message.
11. **Validation:** new structural rules (field types) and geometric rules: `item_id` must exist in the catalog or be a custom item — a missing item is a geometric error that blocks publishing, not a structural refusal; sizes 0.05–100 m; rotation finite; `level_id` must reference a level; `member_ids` must reference objects; a circuit's `switch_entity_id` is a string (`switch.` / `light.`); `LIMITS` respected; the diff and the publish preview show objects / connectors / circuits / levels rows (`COLL_LABEL` already names them; the preview lists them).
12. **Release:** 0.1.84 (the hotfix 0.1.83 ships before this phase, so the version bump is 0.1.83 → 0.1.84), a CHANGELOG entry, records in `tasks.json` / `test_catalog.json` (T085 stays BACKLOG with evidence "on commit <sha>" — the registry refuses DONE while dependencies are BACKLOG; AT169 / AT170 PASS only for what the tests actually exercised), the owner checklist `docs/operations/PLAN_STUDIO_PHASE2_CHECKLIST_HE.md`, the design-document implementation line. Task 15 stops after the release commit: NO merge, NO push, NO HA store reload (the controller does those after the whole-branch review). Every commit step calls `bash /c/cloude/smplwisebms/secrets/scan_staged.sh` and requires the printed `0`, uses a UTF-8 message file without BOM with `git commit -F`, English, no apostrophes, trailer `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.
13. **Copy:** Hebrew product strings, English code and repository documents; strict TypeScript; no new runtime dependencies; pytest never with `-q`; Playwright live specs with `--workers=1` in real Chrome (`SW_LIVE=1 SW_CHROME=1`), never `toBeVisible()` on horizontal SVG lines (use `toHaveCount` / `toBeAttached`), each live test creates and cleans up its own site / building / floor.
14. **HA state in the live spec:** the code has no dev hook for entity states (the backend tests use `monkeypatch` and `ha_sync.upsert_state` directly), so Task 6 adds a small dev-only route `POST /ha/dev/states` in `routers/ha.py` that upserts states through `ha_sync.upsert_state` and publishes them on the existing WebSocket; it answers 404 unless the backend runs in developer identity mode (`settings.dev_user` set and not in the add-on) and needs `system.configure`. The live spec uses it to switch the circuit on and off.

## Global Constraints

- Geometry contract: coordinates normalized 0..1 to the plan **version image**, origin top-left, points stored as `[x, y]` arrays (like v1 and `coverage_polygon`); angles 0° = up, clockwise; sizes in metres.
- Metres only from calibration. Uncalibrated drawing uses the estimated scale `0.2 m / (0.006 × width_px)` and every metre value shown is prefixed `≈`.
- Nothing automatic is published: publish is the only way viewers see a change. Drafts are editor-only.
- Permissions (VMS, floor scope `("floor", floor_id)`): `map.read` = published document, timeline, exports of the published document; `map.edit` = draft read/write, calibration, copy, draft exports, diff, versions; `map.publish` = publish, rollback. New in this phase: `catalog.manage` (installation scope) = custom items, library export / import.
- Determinism: canonical JSON = `plan_schema.canonical_json` (sorted keys, floats rounded to 6 digits); `doc_hash` = SHA-256 of it; primitives rounded **half-up** to 0.01 px with `floor(v * 100 + 0.5) / 100` in both languages.
- Migrations are additive only. Backups include every new table.
- UI copy in Hebrew; code, comments and commit messages in English.
- Commits: message in a temp file (UTF-8, no BOM), `git commit -F`; trailer `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>` (CLAUDE.md); before every commit `bash /c/cloude/smplwisebms/secrets/scan_staged.sh` must print `0` - the script lives in the gitignored `secrets/` folder because its pattern names private identifiers; never copy the pattern into a tracked file. Keep commit messages free of apostrophes (the shell harness chokes on unbalanced quotes in heredocs).
- Branch: `git checkout -b pilot/T085-plan-studio-2 g0/intake` before Task 1, after the 0.1.83 hotfix (`pilot/T084-editor-precision`) has been merged into `g0/intake` (`git log --oneline -1 g0/intake` names it); Task 15 ends with the release commit on this branch and nothing else.
- Commands (Git Bash on Windows):
  - `SP=C:/Users/jon/AppData/Local/Temp/claude/C--cloude-smplwisebms/bd61f90d-850a-444f-9da9-92c50c272bc2/scratchpad` - the session scratchpad; it already holds `fixture_chain.sh`, `restart_backend.ps1` (starts the developer backend hidden), `restart_dev.sh` (created by phase 1) and `ha_store_reload.py` (not used by this plan).
  - "Restart the developer backend" means `bash "$SP/restart_dev.sh"` (expect `me: 200` and a listener pid different from the previous run; an old process can survive on the port - stop it with `powershell -NoProfile -Command "Stop-Process -Id <that pid>"` and run the helper again).
  - `PY=C:/cloude/smplwisebms/.venv/Scripts/python.exe`
  - Backend tests: `cd smplwise_vms/backend && MSYS_NO_PATHCONV=1 $PY -m pytest <files> -p no:cacheprovider` — do **not** add `-q` (pyproject already sets it; `-qq` hides the summary line).
  - Node: `export PATH="$APPDATA/fnm/node-versions/v24.21.0/installation:$PATH"`; in `frontend/`: `npx tsc --noEmit -p tsconfig.json`, `npm run build`, `npx playwright test <spec> --project=desktop --workers=1 --reporter=line`.
  - Live specs (`SW_LIVE=1 SW_CHROME=1`) need the developer backend on 8099 (restart it after any backend change) and a fresh `npm run build` (the preview on 4173 serves `frontend/dist` and proxies `/api` to 8099).
  - Demo fixture chain (only when a demo-visible component changed): `bash "$SP/fixture_chain.sh"` - it stops the backend, runs `tests/screenshots.spec.ts tests/screens.spec.ts` in demo mode (expect `fixtures exit: 0` and 129 passed), restores `docs/evidence/T007` and restarts the backend.
  - Never edit version files while a background pytest run is in progress. Run `scripts/dev_cleanup.ps1 -StopBackend` when a batch of live specs is done.
- Test counts: the backend suite had 239 tests at 0.1.82; the 0.1.83 hotfix may add some. Task 1 Step 0 records the baseline count of the branch base in `$SP/baseline_backend_0184.txt`; every "N passed" expectation below is stated as `baseline + new`, and the release task reads the real number from the pytest output file.

---

## File Structure

**Backend — create**
- `smplwise_vms/backend/smplwise/migrations/0020_catalog_items.sql` — the custom items table.
- `smplwise_vms/backend/smplwise/catalog/objects.json` — the built-in library (153 items, `catalog_version`).
- `smplwise_vms/backend/smplwise/services/plan_catalog.py` — loader, catalog file check, custom items (merge with "based on"), library, revision, indexes for validation / rendering / search.
- `smplwise_vms/backend/smplwise/services/plan_symbols.py` — the 24 SVG symbols for the export.
- `smplwise_vms/backend/smplwise/routers/plan_catalog.py` — `/catalog/objects`, `/catalog/export`, `/catalog/import`.
- Tests: `smplwise_vms/backend/tests/test_plan_catalog.py`, `test_plan_catalog_api.py`, `test_plan_geometry_objects.py`, `test_plan_geometry_render2.py`, `test_plan_geometry_binding.py`, `test_plan_circuits_search.py`.

**Backend — modify**
- `smplwise_vms/backend/smplwise/services/plan_geometry.py` — object / group / connector / circuit rules, `normalize` (circuit power, derived tribune connectors), `apply_anchor_positions`, `counts`.
- `smplwise_vms/backend/smplwise/services/plan_geometry_render.py` — object and connector primitives, `layers`, anchors and the catalog in the exports.
- `smplwise_vms/backend/smplwise/services/geometry_store.py` — normalization and anchor refresh on save / publish, `unbind_anchor`, `link_connector`, `circuit_switches`, `object_index`, `levels_of`, `circuits_of`.
- `smplwise_vms/backend/smplwise/routers/plan_geometry.py` — validation with the catalog, `?layers=`, the connector link route.
- `smplwise_vms/backend/smplwise/routers/anchors.py` — bundle `catalog_revision`, `levels`, `circuit_states`; `level_id` on anchors; un-binding on delete.
- `smplwise_vms/backend/smplwise/routers/zones.py` — `level_id`, `ceiling_height_m` on zones.
- `smplwise_vms/backend/smplwise/routers/ha.py` — circuit switches count as placements (scope, WebSocket), the dev-only state route.
- `smplwise_vms/backend/smplwise/routers/search.py` — `object` results.
- `smplwise_vms/backend/smplwise/routers/access.py` — `PERMISSION_LABELS["catalog.manage"]`.
- `smplwise_vms/backend/smplwise/roles.json`, `contracts/examples/role-catalog.design.json` — `catalog.manage` on editor / site_admin / system_admin.
- `smplwise_vms/backend/smplwise/services/backup.py` — `catalog_items` in `PROJECT_TABLES`.
- `smplwise_vms/backend/smplwise/main.py` — register the catalog router.
- `contracts/schemas/plan_geometry.v2.schema.json`, `contracts/fixtures/plan_geometry/sample-v2.json`, `sample-v2.primitives.json`, `scripts/geometry_golden.py` — the extended contract and golden.
- Tests modified: `test_rbac_matrix.py` (catalog.manage row), `test_plan_geometry_integration.py` (bundle fields), `test_backup.py` (catalog_items round trip).

**Frontend — create**
- `frontend/src/api/plan-catalog.ts` — library types and calls (cached by `catalog_revision`).
- `frontend/src/map/plan-symbols.ts` — the 24 symbols (Lit `svg` templates).
- Tests: `frontend/tests/unit-geometry-2.spec.ts` (node), `frontend/tests/unit-studio-ops-2.spec.ts` (node), `frontend/tests/evidence-plan-studio-2.spec.ts` (live).

**Frontend — modify**
- `frontend/src/map/geometry.ts` — object / group / level / connector / circuit types, object and connector primitives, `applyAnchorPositions`, `connectorLabel`, footprint maths.
- `frontend/src/map/studio-ops.ts` — object, array, group, level, connector, circuit operations.
- `frontend/src/api/geometry.ts`, `frontend/src/api/types.ts`, `frontend/src/api/maps.ts`, `frontend/src/api/zones.ts`, `frontend/src/api/search.ts` — new fields and calls.
- `frontend/src/map/sw-plan-canvas.ts` — object / connector layer, glow, object handles, level filter for objects.
- `frontend/src/screens/plan-studio-panel.ts` — library, object inspector, array dialog, level chips and dialog, connector panel, circuit panel, custom item dialog.
- `frontend/src/screens/explore-plan-editor.ts` — the new tools and their state.
- `frontend/src/screens/explore-floor-map.ts` — layers "עצמים" / "מחברים", level chips, circuit toggles, `focusObject`.
- `frontend/src/screens/investigate-history-map.ts`, `investigate-event-detail.ts` — catalog and anchor positions for the object layer.
- `frontend/src/shell/sw-app.ts` — `?focus=object:` routing.
- `frontend/src/components/sw-icon.ts` — `grid`, `bolt`, `levels` icons (the existing `stairs` is reused).
- `frontend/src/styles/tokens.css` — object colour tokens, circuit tokens, glow.

---
### Task 1: The custom items table, the built-in catalog file and its loader

**Files:**
- Create: `smplwise_vms/backend/smplwise/migrations/0020_catalog_items.sql`
- Create: `smplwise_vms/backend/smplwise/catalog/objects.json`
- Create: `smplwise_vms/backend/smplwise/services/plan_catalog.py`
- Test: `smplwise_vms/backend/tests/test_plan_catalog.py`

**Interfaces:**
- Produces: table `catalog_items(id TEXT PK, based_on TEXT, names_json TEXT, category TEXT, tags_json TEXT, role TEXT, shape TEXT, size_json TEXT, z_m REAL, params_json TEXT, icon TEXT, color_token TEXT, created_by TEXT, created_at TEXT, updated_at TEXT)`.
- Produces (`services/plan_catalog.py`): constants `CATALOG_FILE`, `CATEGORIES` (12 ids), `ROLES`, `SHAPES`, `ICONS` (24 symbol ids), `COLOR_TOKENS`, `Z_REFS`, `MIN_SIZE_M = 0.05`, `MAX_SIZE_M = 100.0`, `MIN_Z_M = -50.0`, `MAX_Z_M = 500.0`, `MAX_PARAMS_BYTES = 4096`, `ID_RE`; functions `check_item(item, ids, *, builtin) -> list[str]`, `check_catalog(data) -> list[str]`, `builtin() -> {catalog_version, categories, icons, color_tokens, items: dict[id, item]}` (cached), `builtin_ids() -> frozenset[str]`, `row_item(row) -> dict` (merged with its base), `custom_rows(conn)`, `custom_items(conn) -> list[dict]`, `revision(conn) -> str` (`"<catalog_version>:<count>:<max updated_at>"`), `library(conn) -> {catalog_version, revision, categories, icons, color_tokens, items: list}`, `item_index(conn) -> dict[id, item]`, `names_index(conn) -> dict[id, {he, en, tags}]`.
- Built-in item shape: `{id, category, names {he, en}, tags [], role, shape, size {w_m, d_m, h_m}, z_ref: floor | ceiling, z_m, params {}, params_schema {}, icon, color_token, anchor_kinds [], ifc {class, predefined_type}}`; a merged custom item adds `custom: true`, `based_on`, `created_by`, `created_at`, `updated_at` and takes `z_ref`, `params_schema`, `anchor_kinds`, `ifc` from its base (defaults `floor`, `{}`, `[]`, `IfcFurniture / USERDEFINED` without one).

- [ ] **Step 0: Branch and baseline**

```bash
cd /c/cloude/smplwisebms && git checkout -b pilot/T085-plan-studio-2 g0/intake && git log --oneline -1
cd smplwise_vms/backend && MSYS_NO_PATHCONV=1 $PY -m pytest -p no:cacheprovider > "$SP/baseline_backend_0184.txt" 2>&1; echo "exit $?"; tail -n 2 "$SP/baseline_backend_0184.txt"
```

Expected: the branch exists on top of the merged 0.1.83 hotfix; `exit 0` and a line `N passed` (239 at 0.1.82 plus whatever the hotfix added) - that N is the **baseline** every later expectation adds to.

- [ ] **Step 1: Write the failing tests**

```python
"""Plan Studio object library (T085, CR-003): migration 0020 adds the custom items table; the built-in catalog file
is valid by the same rules the API applies to custom items (153 items in the 12 categories, 24 symbols); a custom
item based on a built-in one inherits what its row does not carry; the library revision follows the custom rows."""
from __future__ import annotations

import copy
import json
import sqlite3

from smplwise.main import create_app
from smplwise.services import plan_catalog as cat


def _cols(conn: sqlite3.Connection, table: str) -> set[str]:
    return {r[1] for r in conn.execute(f"PRAGMA table_info({table})").fetchall()}


def test_migration_0020_adds_the_custom_items_table(settings):
    app = create_app(settings)
    with app.state.db.connection() as conn:
        assert {"id", "based_on", "names_json", "category", "tags_json", "role", "shape", "size_json", "z_m", "params_json", "icon", "color_token",
                "created_by", "created_at", "updated_at"} == _cols(conn, "catalog_items")


def test_the_built_in_catalog_is_valid_and_complete():
    data = json.loads(cat.CATALOG_FILE.read_text(encoding="utf-8"))
    assert cat.check_catalog(data) == []
    b = cat.builtin()
    items = b["items"]
    assert b["catalog_version"] == "2026.09.1" and len(items) == 153
    assert [c["id"] for c in b["categories"]] == list(cat.CATEGORIES) and len(cat.CATEGORIES) == 12
    assert {i["category"] for i in items.values()} == set(cat.CATEGORIES), "every category has items"
    assert {i["icon"] for i in items.values()} == set(cat.ICONS) and len(cat.ICONS) == 24, "every symbol is used"
    assert all(i["color_token"] in cat.COLOR_TOKENS for i in items.values())
    assert all(cat.MIN_SIZE_M <= i["size"][k] <= cat.MAX_SIZE_M for i in items.values() for k in ("w_m", "d_m", "h_m"))
    chair, lamp, tribune, door_station = items["chair.basic"], items["light.ceiling"], items["tribune.stepped"], items["doorstation.intercom"]
    assert chair["size"] == {"w_m": 0.45, "d_m": 0.45, "h_m": 0.85} and chair["icon"] == "chair" and chair["anchor_kinds"] == []
    assert lamp["z_ref"] == "ceiling" and lamp["z_m"] == -0.3 and lamp["params"]["power_w"] == 36 and lamp["anchor_kinds"] == ["light", "switch"]
    assert lamp["ifc"]["class"] == "IfcLightFixture"
    assert tribune["shape"] == "stepped" and tribune["params"] == {"rows": 4, "step_height_m": 0.3, "step_width_m": 1.0, "connects_levels": None}
    assert "יציע" in tribune["tags"] and "bleachers" in tribune["tags"], "synonyms for the search"
    assert door_station["icon"] == "doorstation" and "camera" in door_station["anchor_kinds"]
    assert cat.builtin_ids() == frozenset(items)


def test_check_catalog_names_every_problem():
    data = json.loads(cat.CATALOG_FILE.read_text(encoding="utf-8"))
    broken = copy.deepcopy(data)
    broken["items"][1]["id"] = broken["items"][0]["id"]  # duplicate
    broken["items"][2]["icon"] = "spaceship"
    broken["items"][3]["size"]["w_m"] = 0.01
    broken["items"][4]["category"] = "toys"
    broken["items"][5]["names"] = {"he": ""}
    errors = cat.check_catalog(broken)
    assert any("duplicate" in e for e in errors) and any("icon" in e for e in errors) and any("size" in e for e in errors)
    assert any("category" in e for e in errors) and any("names.he" in e for e in errors)
    assert cat.check_catalog({"catalog_version": "x", "categories": [], "icons": [], "color_tokens": [], "items": []}) != []
    assert cat.check_catalog("nope") == ["catalog: not an object"]


def test_custom_items_merge_with_their_base_and_move_the_revision(settings):
    app = create_app(settings)
    with app.state.db.connection() as conn:
        assert cat.revision(conn) == "2026.09.1:0:" and cat.custom_items(conn) == []
        conn.execute("INSERT INTO catalog_items(id, based_on, names_json, category, tags_json, role, shape, size_json, z_m, params_json, icon, color_token, created_by, created_at, updated_at) "
                     "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                     ("c1", "light.ceiling", '{"he": "מנורת אולם", "en": "Hall lamp"}', "lighting", '["אולם"]', "light", "cylinder", '{"w_m": 0.6, "d_m": 0.6, "h_m": 0.2}', -0.5,
                      '{"power_w": 120}', "lamp", "light", "dev-joni", "2026-09-25T08:00:00Z", "2026-09-25T08:00:00Z"))
        items = cat.custom_items(conn)
        assert len(items) == 1
        c = items[0]
        assert c["custom"] is True and c["based_on"] == "light.ceiling" and c["names"]["he"] == "מנורת אולם" and c["size"]["w_m"] == 0.6 and c["z_m"] == -0.5
        assert c["z_ref"] == "ceiling" and c["anchor_kinds"] == ["light", "switch"] and c["params_schema"] == cat.builtin()["items"]["light.ceiling"]["params_schema"]
        assert c["ifc"]["class"] == "IfcLightFixture" and c["params"] == {"power_w": 120}
        idx = cat.item_index(conn)
        assert "c1" in idx and "chair.basic" in idx and len(idx) == 154
        assert cat.names_index(conn)["c1"] == {"he": "מנורת אולם", "en": "Hall lamp", "tags": ["אולם"]}
        assert cat.revision(conn) == "2026.09.1:1:2026-09-25T08:00:00Z"
        lib = cat.library(conn)
        assert lib["revision"] == cat.revision(conn) and len(lib["items"]) == 154 and lib["items"][0]["custom"] is False and lib["items"][-1]["id"] == "c1"
        # a custom item without a base takes the neutral defaults
        conn.execute("INSERT INTO catalog_items(id, based_on, names_json, category, tags_json, role, shape, size_json, z_m, params_json, icon, color_token, created_by, created_at, updated_at) "
                     "VALUES ('c2', NULL, '{\"he\": \"ארגז\"}', 'storage', '[]', 'furniture', 'box', '{\"w_m\": 1, \"d_m\": 1, \"h_m\": 1}', 0, '{}', 'box', 'furniture', NULL, '2026-09-25T09:00:00Z', '2026-09-25T09:00:00Z')")
        c2 = cat.item_index(conn)["c2"]
        assert c2["z_ref"] == "floor" and c2["anchor_kinds"] == [] and c2["params_schema"] == {} and c2["ifc"] == {"class": "IfcFurniture", "predefined_type": "USERDEFINED"}
        assert c2["names"] == {"he": "ארגז", "en": ""}
```

- [ ] **Step 2: Run them to see them fail**

Run: `cd smplwise_vms/backend && MSYS_NO_PATHCONV=1 $PY -m pytest tests/test_plan_catalog.py -p no:cacheprovider`
Expected: FAIL at import — `No module named 'smplwise.services.plan_catalog'`.

- [ ] **Step 3: The migration**

`smplwise_vms/backend/smplwise/migrations/0020_catalog_items.sql`:

```sql
-- Plan Studio phase 2 (T085, CR-003): the installation's custom object items. The built-in library is a versioned
-- file (catalog/objects.json), not a table; a custom item may be "based on" a built-in one and then inherits what
-- its row does not carry (services/plan_catalog.py). Rows are project data: backups include them.
CREATE TABLE catalog_items (
  id           TEXT PRIMARY KEY,
  based_on     TEXT,
  names_json   TEXT NOT NULL,
  category     TEXT NOT NULL,
  tags_json    TEXT NOT NULL DEFAULT '[]',
  role         TEXT NOT NULL,
  shape        TEXT NOT NULL,
  size_json    TEXT NOT NULL,
  z_m          REAL NOT NULL DEFAULT 0,
  params_json  TEXT NOT NULL DEFAULT '{}',
  icon         TEXT NOT NULL,
  color_token  TEXT NOT NULL,
  created_by   TEXT,
  created_at   TEXT NOT NULL,
  updated_at   TEXT NOT NULL
);
CREATE INDEX idx_catalog_items_updated ON catalog_items (updated_at);
```

- [ ] **Step 4: The built-in catalog (`smplwise_vms/backend/smplwise/catalog/objects.json`)**

Write the file exactly as follows (153 items; one item per line; UTF-8, LF). The header lists the 12 categories with their Hebrew and English names, the 24 symbol ids and the colour tokens the items reference. Sizes are metres; `z_ref: "ceiling"` items carry a negative `z_m` offset from the level's ceiling (a ceiling lamp sits at ceiling − 0.3 m), `z_ref: "floor"` items an absolute height. `params` are the defaults an object copies at placement; `params_schema` tells the inspector what to show (`number` / `int` with min / max, `level` = a level picker). `anchor_kinds` are the HA domains an object of this item may be the body of.

```json
{
  "catalog_version": "2026.09.1",
  "categories": [
    {"id": "structure", "he": "מבנה", "en": "Structure"},
    {"id": "circulation", "he": "תנועה", "en": "Circulation"},
    {"id": "seating", "he": "ישיבה ושולחנות", "en": "Seating and tables"},
    {"id": "storage", "he": "אחסון", "en": "Storage"},
    {"id": "lighting", "he": "תאורה", "en": "Lighting"},
    {"id": "electrical", "he": "חשמל", "en": "Electrical"},
    {"id": "safety", "he": "בטיחות", "en": "Safety"},
    {"id": "medical", "he": "רפואה", "en": "Medical"},
    {"id": "sport", "he": "ספורט", "en": "Sport"},
    {"id": "facilities", "he": "משרד, מטבח וסניטרי", "en": "Office, kitchen and sanitary"},
    {"id": "security", "he": "אבטחה", "en": "Security"},
    {"id": "outdoor", "he": "חוץ", "en": "Outdoor"}
  ],
  "icons": ["box", "cylinder", "chair", "table", "sofa", "bed", "cabinet", "lamp", "panel", "socket", "extinguisher", "smoke", "exit", "aed", "medical", "goal", "mat", "stairs", "elevator", "doorstation", "tree", "sanitary", "office", "parking"],
  "color_tokens": ["object", "structure", "circulation", "furniture", "light", "electrical", "safety", "medical", "sport", "sanitary", "security", "outdoor"],
  "items": [
    {"id":"column.round","category":"structure","names":{"he":"עמוד עגול","en":"Round column"},"tags":["עמוד","column","pillar"],"role":"structure","shape":"cylinder","size":{"w_m":0.4,"d_m":0.4,"h_m":2.8},"z_ref":"floor","z_m":0,"params":{},"params_schema":{},"icon":"cylinder","color_token":"structure","anchor_kinds":[],"ifc":{"class":"IfcColumn","predefined_type":"COLUMN"}},
    {"id":"column.square","category":"structure","names":{"he":"עמוד מרובע","en":"Square column"},"tags":["עמוד","column","pillar"],"role":"structure","shape":"box","size":{"w_m":0.4,"d_m":0.4,"h_m":2.8},"z_ref":"floor","z_m":0,"params":{},"params_schema":{},"icon":"box","color_token":"structure","anchor_kinds":[],"ifc":{"class":"IfcColumn","predefined_type":"COLUMN"}},
    {"id":"beam.steel","category":"structure","names":{"he":"קורה","en":"Beam"},"tags":["קורה","beam"],"role":"structure","shape":"box","size":{"w_m":4,"d_m":0.3,"h_m":0.4},"z_ref":"ceiling","z_m":-0.4,"params":{},"params_schema":{},"icon":"box","color_token":"structure","anchor_kinds":[],"ifc":{"class":"IfcBeam","predefined_type":"BEAM"}},
    {"id":"railing.straight","category":"structure","names":{"he":"מעקה","en":"Railing"},"tags":["מעקה","railing","handrail"],"role":"structure","shape":"box","size":{"w_m":2,"d_m":0.05,"h_m":1.0},"z_ref":"floor","z_m":0,"params":{},"params_schema":{},"icon":"box","color_token":"structure","anchor_kinds":[],"ifc":{"class":"IfcRailing","predefined_type":"GUARDRAIL"}},
    {"id":"partition.low","category":"structure","names":{"he":"מחיצה נמוכה","en":"Low partition"},"tags":["מחיצה","partition"],"role":"structure","shape":"box","size":{"w_m":1.5,"d_m":0.1,"h_m":1.2},"z_ref":"floor","z_m":0,"params":{},"params_schema":{},"icon":"box","color_token":"structure","anchor_kinds":[],"ifc":{"class":"IfcWall","predefined_type":"PARTITIONING"}},
    {"id":"partition.glass","category":"structure","names":{"he":"מחיצת זכוכית","en":"Glass partition"},"tags":["זכוכית","glass","partition"],"role":"structure","shape":"box","size":{"w_m":2,"d_m":0.05,"h_m":2.5},"z_ref":"floor","z_m":0,"params":{},"params_schema":{},"icon":"box","color_token":"structure","anchor_kinds":[],"ifc":{"class":"IfcWall","predefined_type":"PARTITIONING"}},
    {"id":"counter.straight","category":"structure","names":{"he":"דלפק","en":"Counter"},"tags":["דלפק","counter"],"role":"furniture","shape":"box","size":{"w_m":2,"d_m":0.6,"h_m":1.1},"z_ref":"floor","z_m":0,"params":{},"params_schema":{},"icon":"office","color_token":"furniture","anchor_kinds":[],"ifc":{"class":"IfcFurniture","predefined_type":"DESK"}},
    {"id":"counter.reception","category":"structure","names":{"he":"עמדת קבלה","en":"Reception desk"},"tags":["קבלה","reception","דלפק"],"role":"furniture","shape":"box","size":{"w_m":3,"d_m":0.8,"h_m":1.1},"z_ref":"floor","z_m":0,"params":{},"params_schema":{},"icon":"office","color_token":"furniture","anchor_kinds":[],"ifc":{"class":"IfcFurniture","predefined_type":"DESK"}},
    {"id":"platform.stage","category":"structure","names":{"he":"במה","en":"Stage"},"tags":["במה","stage","platform"],"role":"structure","shape":"box","size":{"w_m":6,"d_m":4,"h_m":0.6},"z_ref":"floor","z_m":0,"params":{},"params_schema":{},"icon":"box","color_token":"structure","anchor_kinds":[],"ifc":{"class":"IfcBuildingElementProxy","predefined_type":"USERDEFINED"}},
    {"id":"screen.folding","category":"structure","names":{"he":"פרגוד","en":"Folding screen"},"tags":["פרגוד","screen","divider"],"role":"furniture","shape":"box","size":{"w_m":1.8,"d_m":0.05,"h_m":1.8},"z_ref":"floor","z_m":0,"params":{},"params_schema":{},"icon":"box","color_token":"furniture","anchor_kinds":[],"ifc":{"class":"IfcFurniture","predefined_type":"USERDEFINED"}},
    {"id":"stairs.straight","category":"circulation","names":{"he":"מדרגות ישרות","en":"Straight stairs"},"tags":["מדרגות","stairs","staircase"],"role":"circulation","shape":"box","size":{"w_m":1.2,"d_m":3,"h_m":3},"z_ref":"floor","z_m":0,"params":{"steps":16,"connects_levels":null},"params_schema":{"steps":{"type":"int","min":1,"max":200,"he":"מדרגות"},"connects_levels":{"type":"level","he":"מחברת למפלס"}},"icon":"stairs","color_token":"circulation","anchor_kinds":[],"ifc":{"class":"IfcStair","predefined_type":"STRAIGHT_RUN_STAIR"}},
    {"id":"stairs.landing","category":"circulation","names":{"he":"מדרגות עם פודסט","en":"Stairs with landing"},"tags":["מדרגות","פודסט","stairs","landing"],"role":"circulation","shape":"box","size":{"w_m":2.4,"d_m":3,"h_m":3},"z_ref":"floor","z_m":0,"params":{"steps":18,"connects_levels":null},"params_schema":{"steps":{"type":"int","min":1,"max":200,"he":"מדרגות"},"connects_levels":{"type":"level","he":"מחברת למפלס"}},"icon":"stairs","color_token":"circulation","anchor_kinds":[],"ifc":{"class":"IfcStair","predefined_type":"HALF_TURN_STAIR"}},
    {"id":"ramp.straight","category":"circulation","names":{"he":"רמפה","en":"Ramp"},"tags":["רמפה","ramp"],"role":"circulation","shape":"box","size":{"w_m":1.2,"d_m":6,"h_m":0.5},"z_ref":"floor","z_m":0,"params":{"connects_levels":null},"params_schema":{"connects_levels":{"type":"level","he":"מחברת למפלס"}},"icon":"stairs","color_token":"circulation","anchor_kinds":[],"ifc":{"class":"IfcRamp","predefined_type":"STRAIGHT_RUN_RAMP"}},
    {"id":"elevator.passenger","category":"circulation","names":{"he":"מעלית","en":"Elevator"},"tags":["מעלית","elevator","lift"],"role":"circulation","shape":"box","size":{"w_m":1.6,"d_m":1.8,"h_m":2.4},"z_ref":"floor","z_m":0,"params":{},"params_schema":{},"icon":"elevator","color_token":"circulation","anchor_kinds":[],"ifc":{"class":"IfcTransportElement","predefined_type":"ELEVATOR"}},
    {"id":"ladder.fixed","category":"circulation","names":{"he":"סולם","en":"Ladder"},"tags":["סולם","ladder"],"role":"circulation","shape":"box","size":{"w_m":0.5,"d_m":0.2,"h_m":3},"z_ref":"floor","z_m":0,"params":{"connects_levels":null},"params_schema":{"connects_levels":{"type":"level","he":"מחברת למפלס"}},"icon":"stairs","color_token":"circulation","anchor_kinds":[],"ifc":{"class":"IfcStair","predefined_type":"USERDEFINED"}},
    {"id":"tribune.stepped","category":"circulation","names":{"he":"טריבונה","en":"Tribune"},"tags":["טריבונה","יציע","bleachers","tribune","grandstand"],"role":"circulation","shape":"stepped","size":{"w_m":12,"d_m":4,"h_m":1.2},"z_ref":"floor","z_m":0,"params":{"rows":4,"step_height_m":0.3,"step_width_m":1.0,"connects_levels":null},"params_schema":{"rows":{"type":"int","min":1,"max":60,"he":"שורות"},"step_height_m":{"type":"number","min":0.05,"max":1,"he":"גובה מדרגה (מ׳)"},"step_width_m":{"type":"number","min":0.2,"max":3,"he":"רוחב מדרגה (מ׳)"},"connects_levels":{"type":"level","he":"מחברת למפלס"}},"icon":"stairs","color_token":"circulation","anchor_kinds":[],"ifc":{"class":"IfcStair","predefined_type":"USERDEFINED"}},
    {"id":"escalator","category":"circulation","names":{"he":"מדרגות נעות","en":"Escalator"},"tags":["מדרגות נעות","escalator"],"role":"circulation","shape":"box","size":{"w_m":1.2,"d_m":8,"h_m":3},"z_ref":"floor","z_m":0,"params":{"connects_levels":null},"params_schema":{"connects_levels":{"type":"level","he":"מחברת למפלס"}},"icon":"stairs","color_token":"circulation","anchor_kinds":[],"ifc":{"class":"IfcTransportElement","predefined_type":"ESCALATOR"}},
    {"id":"chair.basic","category":"seating","names":{"he":"כיסא","en":"Chair"},"tags":["כסא","seat","chair"],"role":"furniture","shape":"box","size":{"w_m":0.45,"d_m":0.45,"h_m":0.85},"z_ref":"floor","z_m":0,"params":{},"params_schema":{},"icon":"chair","color_token":"furniture","anchor_kinds":[],"ifc":{"class":"IfcFurniture","predefined_type":"CHAIR"}},
    {"id":"chair.office","category":"seating","names":{"he":"כיסא משרדי","en":"Office chair"},"tags":["כסא","office","chair"],"role":"furniture","shape":"cylinder","size":{"w_m":0.6,"d_m":0.6,"h_m":1.1},"z_ref":"floor","z_m":0,"params":{},"params_schema":{},"icon":"chair","color_token":"furniture","anchor_kinds":[],"ifc":{"class":"IfcFurniture","predefined_type":"CHAIR"}},
    {"id":"chair.folding","category":"seating","names":{"he":"כיסא מתקפל","en":"Folding chair"},"tags":["כסא","folding","chair"],"role":"furniture","shape":"box","size":{"w_m":0.45,"d_m":0.5,"h_m":0.8},"z_ref":"floor","z_m":0,"params":{},"params_schema":{},"icon":"chair","color_token":"furniture","anchor_kinds":[],"ifc":{"class":"IfcFurniture","predefined_type":"CHAIR"}},
    {"id":"armchair","category":"seating","names":{"he":"כורסה","en":"Armchair"},"tags":["כורסא","armchair"],"role":"furniture","shape":"box","size":{"w_m":0.85,"d_m":0.85,"h_m":0.8},"z_ref":"floor","z_m":0,"params":{},"params_schema":{},"icon":"sofa","color_token":"furniture","anchor_kinds":[],"ifc":{"class":"IfcFurniture","predefined_type":"CHAIR"}},
    {"id":"sofa.2","category":"seating","names":{"he":"ספה דו־מושבית","en":"Two-seat sofa"},"tags":["ספה","sofa","couch"],"role":"furniture","shape":"box","size":{"w_m":1.6,"d_m":0.9,"h_m":0.85},"z_ref":"floor","z_m":0,"params":{},"params_schema":{},"icon":"sofa","color_token":"furniture","anchor_kinds":[],"ifc":{"class":"IfcFurniture","predefined_type":"SOFA"}},
    {"id":"sofa.3","category":"seating","names":{"he":"ספה תלת־מושבית","en":"Three-seat sofa"},"tags":["ספה","sofa","couch"],"role":"furniture","shape":"box","size":{"w_m":2.1,"d_m":0.9,"h_m":0.85},"z_ref":"floor","z_m":0,"params":{},"params_schema":{},"icon":"sofa","color_token":"furniture","anchor_kinds":[],"ifc":{"class":"IfcFurniture","predefined_type":"SOFA"}},
    {"id":"bench.indoor","category":"seating","names":{"he":"ספסל","en":"Bench"},"tags":["ספסל","bench"],"role":"furniture","shape":"box","size":{"w_m":1.8,"d_m":0.4,"h_m":0.45},"z_ref":"floor","z_m":0,"params":{},"params_schema":{},"icon":"sofa","color_token":"furniture","anchor_kinds":[],"ifc":{"class":"IfcFurniture","predefined_type":"USERDEFINED"}},
    {"id":"stool","category":"seating","names":{"he":"שרפרף","en":"Stool"},"tags":["שרפרף","stool"],"role":"furniture","shape":"cylinder","size":{"w_m":0.35,"d_m":0.35,"h_m":0.45},"z_ref":"floor","z_m":0,"params":{},"params_schema":{},"icon":"chair","color_token":"furniture","anchor_kinds":[],"ifc":{"class":"IfcFurniture","predefined_type":"CHAIR"}},
    {"id":"table.desk","category":"seating","names":{"he":"שולחן משרדי","en":"Desk"},"tags":["שולחן","desk","table"],"role":"furniture","shape":"box","size":{"w_m":1.4,"d_m":0.7,"h_m":0.75},"z_ref":"floor","z_m":0,"params":{},"params_schema":{},"icon":"table","color_token":"furniture","anchor_kinds":[],"ifc":{"class":"IfcFurniture","predefined_type":"DESK"}},
    {"id":"table.meeting","category":"seating","names":{"he":"שולחן ישיבות","en":"Meeting table"},"tags":["שולחן","ישיבות","meeting","table"],"role":"furniture","shape":"box","size":{"w_m":3,"d_m":1.2,"h_m":0.75},"z_ref":"floor","z_m":0,"params":{},"params_schema":{},"icon":"table","color_token":"furniture","anchor_kinds":[],"ifc":{"class":"IfcFurniture","predefined_type":"TABLE"}},
    {"id":"table.dining","category":"seating","names":{"he":"שולחן אוכל","en":"Dining table"},"tags":["שולחן","אוכל","dining","table"],"role":"furniture","shape":"box","size":{"w_m":1.6,"d_m":0.9,"h_m":0.75},"z_ref":"floor","z_m":0,"params":{},"params_schema":{},"icon":"table","color_token":"furniture","anchor_kinds":[],"ifc":{"class":"IfcFurniture","predefined_type":"TABLE"}},
    {"id":"table.round","category":"seating","names":{"he":"שולחן עגול","en":"Round table"},"tags":["שולחן","עגול","round","table"],"role":"furniture","shape":"cylinder","size":{"w_m":1.2,"d_m":1.2,"h_m":0.75},"z_ref":"floor","z_m":0,"params":{},"params_schema":{},"icon":"table","color_token":"furniture","anchor_kinds":[],"ifc":{"class":"IfcFurniture","predefined_type":"TABLE"}},
    {"id":"table.side","category":"seating","names":{"he":"שולחן צד","en":"Side table"},"tags":["שולחן","side","table"],"role":"furniture","shape":"box","size":{"w_m":0.5,"d_m":0.5,"h_m":0.5},"z_ref":"floor","z_m":0,"params":{},"params_schema":{},"icon":"table","color_token":"furniture","anchor_kinds":[],"ifc":{"class":"IfcFurniture","predefined_type":"TABLE"}},
    {"id":"desk.standing","category":"seating","names":{"he":"עמדת עבודה בעמידה","en":"Standing desk"},"tags":["עמדה","standing","desk"],"role":"furniture","shape":"box","size":{"w_m":1.2,"d_m":0.7,"h_m":1.1},"z_ref":"floor","z_m":0,"params":{},"params_schema":{},"icon":"table","color_token":"furniture","anchor_kinds":[],"ifc":{"class":"IfcFurniture","predefined_type":"DESK"}},
    {"id":"stool.bar","category":"seating","names":{"he":"כיסא בר","en":"Bar stool"},"tags":["כסא","בר","bar","stool"],"role":"furniture","shape":"cylinder","size":{"w_m":0.4,"d_m":0.4,"h_m":0.75},"z_ref":"floor","z_m":0,"params":{},"params_schema":{},"icon":"chair","color_token":"furniture","anchor_kinds":[],"ifc":{"class":"IfcFurniture","predefined_type":"CHAIR"}},
    {"id":"seat.auditorium","category":"seating","names":{"he":"מושב אולם","en":"Auditorium seat"},"tags":["מושב","אולם","seat","auditorium"],"role":"furniture","shape":"box","size":{"w_m":0.55,"d_m":0.7,"h_m":1.0},"z_ref":"floor","z_m":0,"params":{},"params_schema":{},"icon":"chair","color_token":"furniture","anchor_kinds":[],"ifc":{"class":"IfcFurniture","predefined_type":"CHAIR"}},
    {"id":"cabinet.tall","category":"storage","names":{"he":"ארון","en":"Cabinet"},"tags":["ארון","cabinet","cupboard"],"role":"furniture","shape":"box","size":{"w_m":1.0,"d_m":0.6,"h_m":2.0},"z_ref":"floor","z_m":0,"params":{},"params_schema":{},"icon":"cabinet","color_token":"furniture","anchor_kinds":[],"ifc":{"class":"IfcFurniture","predefined_type":"SHELF"}},
    {"id":"cabinet.low","category":"storage","names":{"he":"ארונית","en":"Low cabinet"},"tags":["ארונית","cabinet"],"role":"furniture","shape":"box","size":{"w_m":0.8,"d_m":0.45,"h_m":0.8},"z_ref":"floor","z_m":0,"params":{},"params_schema":{},"icon":"cabinet","color_token":"furniture","anchor_kinds":[],"ifc":{"class":"IfcFurniture","predefined_type":"SHELF"}},
    {"id":"shelf.unit","category":"storage","names":{"he":"כוננית","en":"Shelf unit"},"tags":["מדף","כוננית","shelf","bookcase"],"role":"furniture","shape":"box","size":{"w_m":0.9,"d_m":0.4,"h_m":2.0},"z_ref":"floor","z_m":0,"params":{},"params_schema":{},"icon":"cabinet","color_token":"furniture","anchor_kinds":[],"ifc":{"class":"IfcFurniture","predefined_type":"SHELF"}},
    {"id":"locker.single","category":"storage","names":{"he":"לוקר","en":"Locker"},"tags":["לוקר","locker"],"role":"furniture","shape":"box","size":{"w_m":0.4,"d_m":0.5,"h_m":1.8},"z_ref":"floor","z_m":0,"params":{},"params_schema":{},"icon":"cabinet","color_token":"furniture","anchor_kinds":[],"ifc":{"class":"IfcFurniture","predefined_type":"SHELF"}},
    {"id":"locker.bank","category":"storage","names":{"he":"בנק לוקרים","en":"Locker bank"},"tags":["לוקר","lockers"],"role":"furniture","shape":"box","size":{"w_m":1.6,"d_m":0.5,"h_m":1.8},"z_ref":"floor","z_m":0,"params":{},"params_schema":{},"icon":"cabinet","color_token":"furniture","anchor_kinds":[],"ifc":{"class":"IfcFurniture","predefined_type":"SHELF"}},
    {"id":"safe.box","category":"storage","names":{"he":"כספת","en":"Safe"},"tags":["כספת","safe"],"role":"furniture","shape":"box","size":{"w_m":0.6,"d_m":0.6,"h_m":0.8},"z_ref":"floor","z_m":0,"params":{},"params_schema":{},"icon":"cabinet","color_token":"furniture","anchor_kinds":[],"ifc":{"class":"IfcFurniture","predefined_type":"USERDEFINED"}},
    {"id":"fridge.domestic","category":"storage","names":{"he":"מקרר","en":"Refrigerator"},"tags":["מקרר","fridge","refrigerator"],"role":"kitchen","shape":"box","size":{"w_m":0.7,"d_m":0.7,"h_m":1.8},"z_ref":"floor","z_m":0,"params":{},"params_schema":{},"icon":"cabinet","color_token":"furniture","anchor_kinds":[],"ifc":{"class":"IfcElectricAppliance","predefined_type":"REFRIGERATOR"}},
    {"id":"rack.server","category":"storage","names":{"he":"ארון שרתים","en":"Server rack"},"tags":["שרתים","rack","server","תקשורת"],"role":"electrical","shape":"box","size":{"w_m":0.6,"d_m":1.0,"h_m":2.0},"z_ref":"floor","z_m":0,"params":{},"params_schema":{},"icon":"cabinet","color_token":"electrical","anchor_kinds":[],"ifc":{"class":"IfcFurniture","predefined_type":"USERDEFINED"}},
    {"id":"cabinet.files","category":"storage","names":{"he":"ארון תיקים","en":"File cabinet"},"tags":["תיקים","files","cabinet"],"role":"furniture","shape":"box","size":{"w_m":0.5,"d_m":0.6,"h_m":1.3},"z_ref":"floor","z_m":0,"params":{},"params_schema":{},"icon":"cabinet","color_token":"furniture","anchor_kinds":[],"ifc":{"class":"IfcFurniture","predefined_type":"FILECABINET"}},
    {"id":"wardrobe","category":"storage","names":{"he":"ארון בגדים","en":"Wardrobe"},"tags":["ארון","בגדים","wardrobe","closet"],"role":"furniture","shape":"box","size":{"w_m":1.5,"d_m":0.6,"h_m":2.2},"z_ref":"floor","z_m":0,"params":{},"params_schema":{},"icon":"cabinet","color_token":"furniture","anchor_kinds":[],"ifc":{"class":"IfcFurniture","predefined_type":"SHELF"}},
    {"id":"shelf.wall","category":"storage","names":{"he":"מדף קיר","en":"Wall shelf"},"tags":["מדף","shelf"],"role":"furniture","shape":"box","size":{"w_m":1.0,"d_m":0.3,"h_m":0.05},"z_ref":"floor","z_m":1.5,"params":{},"params_schema":{},"icon":"cabinet","color_token":"furniture","anchor_kinds":[],"ifc":{"class":"IfcFurniture","predefined_type":"SHELF"}},
    {"id":"rack.pallet","category":"storage","names":{"he":"מדף מחסן","en":"Pallet rack"},"tags":["מחסן","פלטות","pallet","rack","warehouse"],"role":"furniture","shape":"box","size":{"w_m":2.7,"d_m":1.1,"h_m":3.0},"z_ref":"floor","z_m":0,"params":{},"params_schema":{},"icon":"cabinet","color_token":"furniture","anchor_kinds":[],"ifc":{"class":"IfcFurniture","predefined_type":"SHELF"}},
    {"id":"light.ceiling","category":"lighting","names":{"he":"מנורת תקרה","en":"Ceiling light"},"tags":["מנורה","תאורה","lamp","light"],"role":"light","shape":"cylinder","size":{"w_m":0.4,"d_m":0.4,"h_m":0.1},"z_ref":"ceiling","z_m":-0.3,"params":{"power_w":36},"params_schema":{"power_w":{"type":"number","min":0,"max":5000,"he":"הספק (W)"}},"icon":"lamp","color_token":"light","anchor_kinds":["light","switch"],"ifc":{"class":"IfcLightFixture","predefined_type":"POINTSOURCE"}},
    {"id":"light.spot","category":"lighting","names":{"he":"ספוט","en":"Spotlight"},"tags":["ספוט","spot","light"],"role":"light","shape":"cylinder","size":{"w_m":0.12,"d_m":0.12,"h_m":0.1},"z_ref":"ceiling","z_m":-0.05,"params":{"power_w":8},"params_schema":{"power_w":{"type":"number","min":0,"max":5000,"he":"הספק (W)"}},"icon":"lamp","color_token":"light","anchor_kinds":["light","switch"],"ifc":{"class":"IfcLightFixture","predefined_type":"DIRECTIONSOURCE"}},
    {"id":"light.led_strip","category":"lighting","names":{"he":"פס לד","en":"LED strip"},"tags":["לד","led","strip","פס"],"role":"light","shape":"box","size":{"w_m":2,"d_m":0.05,"h_m":0.05},"z_ref":"ceiling","z_m":-0.3,"params":{"power_w":20},"params_schema":{"power_w":{"type":"number","min":0,"max":5000,"he":"הספק (W)"}},"icon":"lamp","color_token":"light","anchor_kinds":["light","switch"],"ifc":{"class":"IfcLightFixture","predefined_type":"USERDEFINED"}},
    {"id":"light.fluorescent","category":"lighting","names":{"he":"גוף פלואורסנט","en":"Fluorescent fixture"},"tags":["פלואורסנט","fluorescent","light"],"role":"light","shape":"box","size":{"w_m":1.2,"d_m":0.15,"h_m":0.08},"z_ref":"ceiling","z_m":-0.1,"params":{"power_w":36},"params_schema":{"power_w":{"type":"number","min":0,"max":5000,"he":"הספק (W)"}},"icon":"lamp","color_token":"light","anchor_kinds":["light","switch"],"ifc":{"class":"IfcLightFixture","predefined_type":"POINTSOURCE"}},
    {"id":"light.panel","category":"lighting","names":{"he":"פאנל לד","en":"LED panel"},"tags":["פאנל","panel","led","light"],"role":"light","shape":"box","size":{"w_m":0.6,"d_m":0.6,"h_m":0.05},"z_ref":"ceiling","z_m":-0.05,"params":{"power_w":40},"params_schema":{"power_w":{"type":"number","min":0,"max":5000,"he":"הספק (W)"}},"icon":"lamp","color_token":"light","anchor_kinds":["light","switch"],"ifc":{"class":"IfcLightFixture","predefined_type":"POINTSOURCE"}},
    {"id":"light.emergency","category":"lighting","names":{"he":"תאורת חירום","en":"Emergency light"},"tags":["חירום","emergency","light"],"role":"light","shape":"box","size":{"w_m":0.3,"d_m":0.1,"h_m":0.1},"z_ref":"floor","z_m":2.3,"params":{"power_w":5},"params_schema":{"power_w":{"type":"number","min":0,"max":5000,"he":"הספק (W)"}},"icon":"lamp","color_token":"light","anchor_kinds":["light","switch"],"ifc":{"class":"IfcLightFixture","predefined_type":"SECURITYLIGHTING"}},
    {"id":"light.flood","category":"lighting","names":{"he":"פרוז׳קטור","en":"Floodlight"},"tags":["פרוז׳קטור","פרוזקטור","flood","floodlight"],"role":"light","shape":"box","size":{"w_m":0.3,"d_m":0.2,"h_m":0.25},"z_ref":"floor","z_m":4,"params":{"power_w":150},"params_schema":{"power_w":{"type":"number","min":0,"max":5000,"he":"הספק (W)"}},"icon":"lamp","color_token":"light","anchor_kinds":["light","switch"],"ifc":{"class":"IfcLightFixture","predefined_type":"DIRECTIONSOURCE"}},
    {"id":"light.pole","category":"lighting","names":{"he":"עמוד תאורה","en":"Light pole"},"tags":["עמוד","תאורה","pole","street light","חוץ"],"role":"light","shape":"cylinder","size":{"w_m":0.2,"d_m":0.2,"h_m":6},"z_ref":"floor","z_m":0,"params":{"power_w":100},"params_schema":{"power_w":{"type":"number","min":0,"max":5000,"he":"הספק (W)"}},"icon":"lamp","color_token":"light","anchor_kinds":["light","switch"],"ifc":{"class":"IfcLightFixture","predefined_type":"POINTSOURCE"}},
    {"id":"light.pendant","category":"lighting","names":{"he":"מנורה תלויה","en":"Pendant light"},"tags":["תלויה","pendant","light"],"role":"light","shape":"cylinder","size":{"w_m":0.35,"d_m":0.35,"h_m":0.4},"z_ref":"ceiling","z_m":-1.0,"params":{"power_w":40},"params_schema":{"power_w":{"type":"number","min":0,"max":5000,"he":"הספק (W)"}},"icon":"lamp","color_token":"light","anchor_kinds":["light","switch"],"ifc":{"class":"IfcLightFixture","predefined_type":"POINTSOURCE"}},
    {"id":"light.wall","category":"lighting","names":{"he":"מנורת קיר","en":"Wall light"},"tags":["קיר","wall","sconce","light"],"role":"light","shape":"box","size":{"w_m":0.2,"d_m":0.1,"h_m":0.2},"z_ref":"floor","z_m":2.0,"params":{"power_w":12},"params_schema":{"power_w":{"type":"number","min":0,"max":5000,"he":"הספק (W)"}},"icon":"lamp","color_token":"light","anchor_kinds":["light","switch"],"ifc":{"class":"IfcLightFixture","predefined_type":"POINTSOURCE"}},
    {"id":"light.high_bay","category":"lighting","names":{"he":"תאורת אולם","en":"High bay light"},"tags":["אולם","high bay","light"],"role":"light","shape":"cylinder","size":{"w_m":0.4,"d_m":0.4,"h_m":0.3},"z_ref":"ceiling","z_m":-0.5,"params":{"power_w":150},"params_schema":{"power_w":{"type":"number","min":0,"max":5000,"he":"הספק (W)"}},"icon":"lamp","color_token":"light","anchor_kinds":["light","switch"],"ifc":{"class":"IfcLightFixture","predefined_type":"POINTSOURCE"}},
    {"id":"light.track","category":"lighting","names":{"he":"פס ספוטים","en":"Track light"},"tags":["פס","track","spot","light"],"role":"light","shape":"box","size":{"w_m":1.5,"d_m":0.05,"h_m":0.1},"z_ref":"ceiling","z_m":-0.1,"params":{"power_w":30},"params_schema":{"power_w":{"type":"number","min":0,"max":5000,"he":"הספק (W)"}},"icon":"lamp","color_token":"light","anchor_kinds":["light","switch"],"ifc":{"class":"IfcLightFixture","predefined_type":"DIRECTIONSOURCE"}},
    {"id":"panel.electrical","category":"electrical","names":{"he":"לוח חשמל","en":"Electrical panel"},"tags":["לוח","חשמל","panel","breaker"],"role":"electrical","shape":"box","size":{"w_m":0.6,"d_m":0.2,"h_m":1.0},"z_ref":"floor","z_m":1.0,"params":{},"params_schema":{},"icon":"panel","color_token":"electrical","anchor_kinds":["switch","sensor"],"ifc":{"class":"IfcElectricDistributionBoard","predefined_type":"DISTRIBUTIONBOARD"}},
    {"id":"panel.main","category":"electrical","names":{"he":"לוח חשמל ראשי","en":"Main panel"},"tags":["לוח","ראשי","main","panel"],"role":"electrical","shape":"box","size":{"w_m":1.2,"d_m":0.3,"h_m":2.0},"z_ref":"floor","z_m":0,"params":{},"params_schema":{},"icon":"panel","color_token":"electrical","anchor_kinds":["switch","sensor"],"ifc":{"class":"IfcElectricDistributionBoard","predefined_type":"SWITCHBOARD"}},
    {"id":"socket.wall","category":"electrical","names":{"he":"שקע","en":"Socket"},"tags":["שקע","socket","outlet"],"role":"electrical","shape":"box","size":{"w_m":0.08,"d_m":0.05,"h_m":0.08},"z_ref":"floor","z_m":0.3,"params":{},"params_schema":{},"icon":"socket","color_token":"electrical","anchor_kinds":["switch"],"ifc":{"class":"IfcOutlet","predefined_type":"POWEROUTLET"}},
    {"id":"switch.wall","category":"electrical","names":{"he":"מפסק","en":"Switch"},"tags":["מפסק","switch"],"role":"electrical","shape":"box","size":{"w_m":0.08,"d_m":0.05,"h_m":0.08},"z_ref":"floor","z_m":1.1,"params":{},"params_schema":{},"icon":"socket","color_token":"electrical","anchor_kinds":["switch","light"],"ifc":{"class":"IfcSwitchingDevice","predefined_type":"TOGGLESWITCH"}},
    {"id":"generator.diesel","category":"electrical","names":{"he":"גנרטור","en":"Generator"},"tags":["גנרטור","generator"],"role":"electrical","shape":"box","size":{"w_m":2.5,"d_m":1.0,"h_m":1.5},"z_ref":"floor","z_m":0,"params":{},"params_schema":{},"icon":"panel","color_token":"electrical","anchor_kinds":["switch","sensor"],"ifc":{"class":"IfcElectricGenerator","predefined_type":"CHP"}},
    {"id":"ups.rack","category":"electrical","names":{"he":"UPS","en":"UPS"},"tags":["ups","אל־פסק","battery"],"role":"electrical","shape":"box","size":{"w_m":0.6,"d_m":0.8,"h_m":1.2},"z_ref":"floor","z_m":0,"params":{},"params_schema":{},"icon":"panel","color_token":"electrical","anchor_kinds":["sensor"],"ifc":{"class":"IfcElectricFlowStorageDevice","predefined_type":"BATTERY"}},
    {"id":"meter.electric","category":"electrical","names":{"he":"מונה חשמל","en":"Electric meter"},"tags":["מונה","meter"],"role":"electrical","shape":"box","size":{"w_m":0.2,"d_m":0.1,"h_m":0.3},"z_ref":"floor","z_m":1.2,"params":{},"params_schema":{},"icon":"panel","color_token":"electrical","anchor_kinds":["sensor"],"ifc":{"class":"IfcFlowMeter","predefined_type":"ENERGYMETER"}},
    {"id":"charger.ev","category":"electrical","names":{"he":"עמדת טעינה לרכב","en":"EV charger"},"tags":["טעינה","ev","charger"],"role":"electrical","shape":"box","size":{"w_m":0.4,"d_m":0.3,"h_m":1.5},"z_ref":"floor","z_m":0,"params":{},"params_schema":{},"icon":"panel","color_token":"electrical","anchor_kinds":["switch","sensor"],"ifc":{"class":"IfcElectricAppliance","predefined_type":"USERDEFINED"}},
    {"id":"junction.box","category":"electrical","names":{"he":"קופסת חיבורים","en":"Junction box"},"tags":["קופסה","junction","box"],"role":"electrical","shape":"box","size":{"w_m":0.2,"d_m":0.1,"h_m":0.2},"z_ref":"floor","z_m":2.2,"params":{},"params_schema":{},"icon":"socket","color_token":"electrical","anchor_kinds":[],"ifc":{"class":"IfcJunctionBox","predefined_type":"POWER"}},
    {"id":"transformer","category":"electrical","names":{"he":"שנאי","en":"Transformer"},"tags":["שנאי","transformer"],"role":"electrical","shape":"box","size":{"w_m":1.5,"d_m":1.0,"h_m":1.5},"z_ref":"floor","z_m":0,"params":{},"params_schema":{},"icon":"panel","color_token":"electrical","anchor_kinds":["sensor"],"ifc":{"class":"IfcTransformer","predefined_type":"VOLTAGE"}},
    {"id":"extinguisher.powder","category":"safety","names":{"he":"מטף אבקה","en":"Powder extinguisher"},"tags":["מטף","מטפה","extinguisher","fire"],"role":"safety","shape":"cylinder","size":{"w_m":0.2,"d_m":0.2,"h_m":0.5},"z_ref":"floor","z_m":0.9,"params":{},"params_schema":{},"icon":"extinguisher","color_token":"safety","anchor_kinds":[],"ifc":{"class":"IfcFireSuppressionTerminal","predefined_type":"USERDEFINED"}},
    {"id":"extinguisher.co2","category":"safety","names":{"he":"מטף CO2","en":"CO2 extinguisher"},"tags":["מטף","מטפה","co2","extinguisher","fire"],"role":"safety","shape":"cylinder","size":{"w_m":0.2,"d_m":0.2,"h_m":0.6},"z_ref":"floor","z_m":0.9,"params":{},"params_schema":{},"icon":"extinguisher","color_token":"safety","anchor_kinds":[],"ifc":{"class":"IfcFireSuppressionTerminal","predefined_type":"USERDEFINED"}},
    {"id":"hydrant.cabinet","category":"safety","names":{"he":"ארון הידרנט","en":"Hose reel cabinet"},"tags":["הידרנט","hydrant","hose"],"role":"safety","shape":"box","size":{"w_m":0.6,"d_m":0.25,"h_m":0.8},"z_ref":"floor","z_m":1.0,"params":{},"params_schema":{},"icon":"extinguisher","color_token":"safety","anchor_kinds":[],"ifc":{"class":"IfcFireSuppressionTerminal","predefined_type":"HOSEREEL"}},
    {"id":"hydrant.outdoor","category":"safety","names":{"he":"הידרנט חוץ","en":"Outdoor hydrant"},"tags":["הידרנט","hydrant"],"role":"safety","shape":"cylinder","size":{"w_m":0.25,"d_m":0.25,"h_m":0.8},"z_ref":"floor","z_m":0,"params":{},"params_schema":{},"icon":"extinguisher","color_token":"safety","anchor_kinds":[],"ifc":{"class":"IfcFireSuppressionTerminal","predefined_type":"FIREHYDRANT"}},
    {"id":"detector.smoke","category":"safety","names":{"he":"גלאי עשן","en":"Smoke detector"},"tags":["גלאי","עשן","smoke","detector"],"role":"safety","shape":"cylinder","size":{"w_m":0.12,"d_m":0.12,"h_m":0.05},"z_ref":"ceiling","z_m":-0.05,"params":{},"params_schema":{},"icon":"smoke","color_token":"safety","anchor_kinds":["binary_sensor","sensor"],"ifc":{"class":"IfcSensor","predefined_type":"SMOKESENSOR"}},
    {"id":"detector.heat","category":"safety","names":{"he":"גלאי חום","en":"Heat detector"},"tags":["גלאי","חום","heat","detector"],"role":"safety","shape":"cylinder","size":{"w_m":0.12,"d_m":0.12,"h_m":0.05},"z_ref":"ceiling","z_m":-0.05,"params":{},"params_schema":{},"icon":"smoke","color_token":"safety","anchor_kinds":["binary_sensor","sensor"],"ifc":{"class":"IfcSensor","predefined_type":"HEATSENSOR"}},
    {"id":"sign.exit","category":"safety","names":{"he":"שלט יציאה","en":"Exit sign"},"tags":["יציאה","exit","sign"],"role":"safety","shape":"box","size":{"w_m":0.35,"d_m":0.05,"h_m":0.2},"z_ref":"floor","z_m":2.2,"params":{},"params_schema":{},"icon":"exit","color_token":"safety","anchor_kinds":[],"ifc":{"class":"IfcSign","predefined_type":"USERDEFINED"}},
    {"id":"aed.wall","category":"safety","names":{"he":"AED (דפיברילטור)","en":"AED"},"tags":["aed","דפיברילטור","defibrillator"],"role":"medical","shape":"box","size":{"w_m":0.4,"d_m":0.2,"h_m":0.4},"z_ref":"floor","z_m":1.2,"params":{},"params_schema":{},"icon":"aed","color_token":"safety","anchor_kinds":[],"ifc":{"class":"IfcMedicalDevice","predefined_type":"USERDEFINED"}},
    {"id":"assembly.point","category":"safety","names":{"he":"נקודת התקהלות","en":"Assembly point"},"tags":["התקהלות","assembly","muster"],"role":"safety","shape":"cylinder","size":{"w_m":3,"d_m":3,"h_m":0.05},"z_ref":"floor","z_m":0,"params":{},"params_schema":{},"icon":"exit","color_token":"safety","anchor_kinds":[],"ifc":{"class":"IfcBuildingElementProxy","predefined_type":"USERDEFINED"}},
    {"id":"alarm.panel","category":"safety","names":{"he":"לוח גילוי אש","en":"Fire alarm panel"},"tags":["גילוי אש","alarm","panel"],"role":"safety","shape":"box","size":{"w_m":0.5,"d_m":0.15,"h_m":0.6},"z_ref":"floor","z_m":1.4,"params":{},"params_schema":{},"icon":"panel","color_token":"safety","anchor_kinds":["alarm_control_panel","binary_sensor"],"ifc":{"class":"IfcAlarm","predefined_type":"USERDEFINED"}},
    {"id":"alarm.button","category":"safety","names":{"he":"לחצן חירום","en":"Emergency button"},"tags":["לחצן","חירום","button","pull"],"role":"safety","shape":"box","size":{"w_m":0.1,"d_m":0.05,"h_m":0.1},"z_ref":"floor","z_m":1.3,"params":{},"params_schema":{},"icon":"socket","color_token":"safety","anchor_kinds":["binary_sensor","button"],"ifc":{"class":"IfcAlarm","predefined_type":"MANUALPULLBOX"}},
    {"id":"sprinkler.head","category":"safety","names":{"he":"ספרינקלר","en":"Sprinkler"},"tags":["ספרינקלר","sprinkler"],"role":"safety","shape":"cylinder","size":{"w_m":0.06,"d_m":0.06,"h_m":0.06},"z_ref":"ceiling","z_m":-0.02,"params":{},"params_schema":{},"icon":"smoke","color_token":"safety","anchor_kinds":[],"ifc":{"class":"IfcFireSuppressionTerminal","predefined_type":"SPRINKLER"}},
    {"id":"eyewash.station","category":"safety","names":{"he":"עמדת שטיפת עיניים","en":"Eyewash station"},"tags":["שטיפת עיניים","eyewash"],"role":"safety","shape":"box","size":{"w_m":0.4,"d_m":0.4,"h_m":1.2},"z_ref":"floor","z_m":0,"params":{},"params_schema":{},"icon":"sanitary","color_token":"safety","anchor_kinds":[],"ifc":{"class":"IfcSanitaryTerminal","predefined_type":"USERDEFINED"}},
    {"id":"firstaid.kit","category":"safety","names":{"he":"ערכת עזרה ראשונה","en":"First aid kit"},"tags":["עזרה ראשונה","first aid"],"role":"safety","shape":"box","size":{"w_m":0.3,"d_m":0.12,"h_m":0.4},"z_ref":"floor","z_m":1.3,"params":{},"params_schema":{},"icon":"aed","color_token":"safety","anchor_kinds":[],"ifc":{"class":"IfcFurniture","predefined_type":"USERDEFINED"}},
    {"id":"bed.hospital","category":"medical","names":{"he":"מיטת אשפוז","en":"Hospital bed"},"tags":["מיטה","אשפוז","bed","hospital"],"role":"medical","shape":"box","size":{"w_m":1.0,"d_m":2.2,"h_m":0.9},"z_ref":"floor","z_m":0,"params":{},"params_schema":{},"icon":"bed","color_token":"medical","anchor_kinds":[],"ifc":{"class":"IfcFurniture","predefined_type":"BED"}},
    {"id":"stretcher","category":"medical","names":{"he":"אלונקה","en":"Stretcher"},"tags":["אלונקה","stretcher","gurney"],"role":"medical","shape":"box","size":{"w_m":0.6,"d_m":2.0,"h_m":0.8},"z_ref":"floor","z_m":0,"params":{},"params_schema":{},"icon":"bed","color_token":"medical","anchor_kinds":[],"ifc":{"class":"IfcMedicalDevice","predefined_type":"USERDEFINED"}},
    {"id":"station.nurses","category":"medical","names":{"he":"עמדת אחיות","en":"Nurses station"},"tags":["אחיות","nurses","station"],"role":"medical","shape":"box","size":{"w_m":3,"d_m":1,"h_m":1.1},"z_ref":"floor","z_m":0,"params":{},"params_schema":{},"icon":"office","color_token":"medical","anchor_kinds":[],"ifc":{"class":"IfcFurniture","predefined_type":"DESK"}},
    {"id":"monitor.patient","category":"medical","names":{"he":"מוניטור","en":"Patient monitor"},"tags":["מוניטור","monitor"],"role":"medical","shape":"box","size":{"w_m":0.4,"d_m":0.3,"h_m":0.4},"z_ref":"floor","z_m":1.0,"params":{},"params_schema":{},"icon":"medical","color_token":"medical","anchor_kinds":["sensor"],"ifc":{"class":"IfcMedicalDevice","predefined_type":"USERDEFINED"}},
    {"id":"pole.iv","category":"medical","names":{"he":"עמוד עירוי","en":"IV pole"},"tags":["עירוי","iv","pole"],"role":"medical","shape":"cylinder","size":{"w_m":0.5,"d_m":0.5,"h_m":1.8},"z_ref":"floor","z_m":0,"params":{},"params_schema":{},"icon":"medical","color_token":"medical","anchor_kinds":[],"ifc":{"class":"IfcMedicalDevice","predefined_type":"USERDEFINED"}},
    {"id":"cabinet.medicine","category":"medical","names":{"he":"ארון תרופות","en":"Medicine cabinet"},"tags":["תרופות","medicine","cabinet"],"role":"medical","shape":"box","size":{"w_m":0.8,"d_m":0.4,"h_m":1.8},"z_ref":"floor","z_m":0,"params":{},"params_schema":{},"icon":"cabinet","color_token":"medical","anchor_kinds":["lock","binary_sensor"],"ifc":{"class":"IfcFurniture","predefined_type":"SHELF"}},
    {"id":"wheelchair","category":"medical","names":{"he":"כיסא גלגלים","en":"Wheelchair"},"tags":["כיסא גלגלים","wheelchair"],"role":"medical","shape":"box","size":{"w_m":0.65,"d_m":1.0,"h_m":0.9},"z_ref":"floor","z_m":0,"params":{},"params_schema":{},"icon":"medical","color_token":"medical","anchor_kinds":[],"ifc":{"class":"IfcMedicalDevice","predefined_type":"USERDEFINED"}},
    {"id":"xray.mobile","category":"medical","names":{"he":"מכשיר רנטגן נייד","en":"Mobile x-ray"},"tags":["רנטגן","x-ray","xray"],"role":"medical","shape":"box","size":{"w_m":0.7,"d_m":1.4,"h_m":1.8},"z_ref":"floor","z_m":0,"params":{},"params_schema":{},"icon":"medical","color_token":"medical","anchor_kinds":[],"ifc":{"class":"IfcMedicalDevice","predefined_type":"USERDEFINED"}},
    {"id":"bed.exam","category":"medical","names":{"he":"מיטת בדיקה","en":"Exam bed"},"tags":["מיטה","בדיקה","exam","bed"],"role":"medical","shape":"box","size":{"w_m":0.7,"d_m":1.9,"h_m":0.8},"z_ref":"floor","z_m":0,"params":{},"params_schema":{},"icon":"bed","color_token":"medical","anchor_kinds":[],"ifc":{"class":"IfcFurniture","predefined_type":"BED"}},
    {"id":"trolley.medical","category":"medical","names":{"he":"עגלת טיפול","en":"Medical trolley"},"tags":["עגלה","trolley","cart"],"role":"medical","shape":"box","size":{"w_m":0.6,"d_m":0.5,"h_m":0.9},"z_ref":"floor","z_m":0,"params":{},"params_schema":{},"icon":"medical","color_token":"medical","anchor_kinds":[],"ifc":{"class":"IfcMedicalDevice","predefined_type":"USERDEFINED"}},
    {"id":"curtain.track","category":"medical","names":{"he":"וילון הפרדה","en":"Cubicle curtain"},"tags":["וילון","curtain"],"role":"medical","shape":"box","size":{"w_m":2.5,"d_m":0.05,"h_m":2.2},"z_ref":"floor","z_m":0,"params":{},"params_schema":{},"icon":"box","color_token":"medical","anchor_kinds":[],"ifc":{"class":"IfcFurniture","predefined_type":"USERDEFINED"}},
    {"id":"sink.scrub","category":"medical","names":{"he":"כיור ניתוח","en":"Scrub sink"},"tags":["כיור","scrub","sink"],"role":"sanitary","shape":"box","size":{"w_m":1.2,"d_m":0.5,"h_m":0.9},"z_ref":"floor","z_m":0,"params":{},"params_schema":{},"icon":"sanitary","color_token":"medical","anchor_kinds":[],"ifc":{"class":"IfcSanitaryTerminal","predefined_type":"SINK"}},
    {"id":"goal.football","category":"sport","names":{"he":"שער כדורגל","en":"Football goal"},"tags":["שער","כדורגל","goal","football","soccer"],"role":"sport","shape":"box","size":{"w_m":7.32,"d_m":2.0,"h_m":2.44},"z_ref":"floor","z_m":0,"params":{},"params_schema":{},"icon":"goal","color_token":"sport","anchor_kinds":[],"ifc":{"class":"IfcBuildingElementProxy","predefined_type":"USERDEFINED"}},
    {"id":"goal.handball","category":"sport","names":{"he":"שער כדוריד","en":"Handball goal"},"tags":["שער","כדוריד","goal","handball"],"role":"sport","shape":"box","size":{"w_m":3.0,"d_m":1.0,"h_m":2.0},"z_ref":"floor","z_m":0,"params":{},"params_schema":{},"icon":"goal","color_token":"sport","anchor_kinds":[],"ifc":{"class":"IfcBuildingElementProxy","predefined_type":"USERDEFINED"}},
    {"id":"basket.hoop","category":"sport","names":{"he":"סל כדורסל","en":"Basketball hoop"},"tags":["סל","כדורסל","basket","basketball","hoop"],"role":"sport","shape":"box","size":{"w_m":1.8,"d_m":1.2,"h_m":3.05},"z_ref":"floor","z_m":0,"params":{},"params_schema":{},"icon":"goal","color_token":"sport","anchor_kinds":[],"ifc":{"class":"IfcBuildingElementProxy","predefined_type":"USERDEFINED"}},
    {"id":"net.volleyball","category":"sport","names":{"he":"רשת כדורעף","en":"Volleyball net"},"tags":["רשת","כדורעף","net","volleyball"],"role":"sport","shape":"box","size":{"w_m":9.5,"d_m":0.1,"h_m":2.43},"z_ref":"floor","z_m":0,"params":{},"params_schema":{},"icon":"goal","color_token":"sport","anchor_kinds":[],"ifc":{"class":"IfcBuildingElementProxy","predefined_type":"USERDEFINED"}},
    {"id":"mat.gym","category":"sport","names":{"he":"מזרן","en":"Mat"},"tags":["מזרן","mat"],"role":"sport","shape":"box","size":{"w_m":2,"d_m":1,"h_m":0.05},"z_ref":"floor","z_m":0,"params":{},"params_schema":{},"icon":"mat","color_token":"sport","anchor_kinds":[],"ifc":{"class":"IfcFurniture","predefined_type":"USERDEFINED"}},
    {"id":"machine.treadmill","category":"sport","names":{"he":"הליכון","en":"Treadmill"},"tags":["הליכון","treadmill"],"role":"sport","shape":"box","size":{"w_m":0.9,"d_m":2.0,"h_m":1.5},"z_ref":"floor","z_m":0,"params":{},"params_schema":{},"icon":"mat","color_token":"sport","anchor_kinds":["switch"],"ifc":{"class":"IfcElectricAppliance","predefined_type":"USERDEFINED"}},
    {"id":"machine.multi","category":"sport","names":{"he":"מתקן כושר","en":"Gym machine"},"tags":["מתקן","כושר","gym","machine"],"role":"sport","shape":"box","size":{"w_m":1.5,"d_m":1.5,"h_m":2.2},"z_ref":"floor","z_m":0,"params":{},"params_schema":{},"icon":"mat","color_token":"sport","anchor_kinds":[],"ifc":{"class":"IfcFurniture","predefined_type":"USERDEFINED"}},
    {"id":"bench.players","category":"sport","names":{"he":"ספסל שחקנים","en":"Players bench"},"tags":["ספסל","שחקנים","bench"],"role":"sport","shape":"box","size":{"w_m":4,"d_m":0.5,"h_m":0.9},"z_ref":"floor","z_m":0,"params":{},"params_schema":{},"icon":"sofa","color_token":"sport","anchor_kinds":[],"ifc":{"class":"IfcFurniture","predefined_type":"USERDEFINED"}},
    {"id":"rack.weights","category":"sport","names":{"he":"מתקן משקולות","en":"Weight rack"},"tags":["משקולות","weights","rack"],"role":"sport","shape":"box","size":{"w_m":1.2,"d_m":0.5,"h_m":1.0},"z_ref":"floor","z_m":0,"params":{},"params_schema":{},"icon":"mat","color_token":"sport","anchor_kinds":[],"ifc":{"class":"IfcFurniture","predefined_type":"USERDEFINED"}},
    {"id":"table.tennis","category":"sport","names":{"he":"שולחן טניס","en":"Table tennis"},"tags":["טניס שולחן","פינג פונג","table tennis","ping pong"],"role":"sport","shape":"box","size":{"w_m":2.74,"d_m":1.525,"h_m":0.76},"z_ref":"floor","z_m":0,"params":{},"params_schema":{},"icon":"table","color_token":"sport","anchor_kinds":[],"ifc":{"class":"IfcFurniture","predefined_type":"TABLE"}},
    {"id":"scoreboard","category":"sport","names":{"he":"לוח תוצאות","en":"Scoreboard"},"tags":["תוצאות","scoreboard"],"role":"sport","shape":"box","size":{"w_m":2,"d_m":0.2,"h_m":1},"z_ref":"floor","z_m":2.5,"params":{},"params_schema":{},"icon":"office","color_token":"sport","anchor_kinds":["switch"],"ifc":{"class":"IfcAudioVisualAppliance","predefined_type":"DISPLAY"}},
    {"id":"bleacher.mobile","category":"sport","names":{"he":"טריבונה ניידת","en":"Mobile bleacher"},"tags":["טריבונה","יציע","bleacher"],"role":"sport","shape":"stepped","size":{"w_m":4,"d_m":2,"h_m":0.9},"z_ref":"floor","z_m":0,"params":{"rows":3,"step_height_m":0.3,"step_width_m":0.65,"connects_levels":null},"params_schema":{"rows":{"type":"int","min":1,"max":60,"he":"שורות"},"step_height_m":{"type":"number","min":0.05,"max":1,"he":"גובה מדרגה (מ׳)"},"step_width_m":{"type":"number","min":0.2,"max":3,"he":"רוחב מדרגה (מ׳)"},"connects_levels":{"type":"level","he":"מחברת למפלס"}},"icon":"stairs","color_token":"sport","anchor_kinds":[],"ifc":{"class":"IfcFurniture","predefined_type":"USERDEFINED"}},
    {"id":"bar.pullup","category":"sport","names":{"he":"מתקן מתח","en":"Pull-up bar"},"tags":["מתח","pull-up","bar"],"role":"sport","shape":"box","size":{"w_m":1.2,"d_m":0.6,"h_m":2.3},"z_ref":"floor","z_m":0,"params":{},"params_schema":{},"icon":"mat","color_token":"sport","anchor_kinds":[],"ifc":{"class":"IfcFurniture","predefined_type":"USERDEFINED"}},
    {"id":"printer.office","category":"facilities","names":{"he":"מדפסת","en":"Printer"},"tags":["מדפסת","printer"],"role":"office","shape":"box","size":{"w_m":0.5,"d_m":0.45,"h_m":0.4},"z_ref":"floor","z_m":0.75,"params":{},"params_schema":{},"icon":"office","color_token":"furniture","anchor_kinds":["switch"],"ifc":{"class":"IfcElectricAppliance","predefined_type":"USERDEFINED"}},
    {"id":"whiteboard","category":"facilities","names":{"he":"לוח מחיק","en":"Whiteboard"},"tags":["לוח","whiteboard"],"role":"office","shape":"box","size":{"w_m":1.8,"d_m":0.05,"h_m":1.2},"z_ref":"floor","z_m":0.9,"params":{},"params_schema":{},"icon":"office","color_token":"furniture","anchor_kinds":[],"ifc":{"class":"IfcFurniture","predefined_type":"USERDEFINED"}},
    {"id":"projector.ceiling","category":"facilities","names":{"he":"מקרן","en":"Projector"},"tags":["מקרן","projector"],"role":"office","shape":"box","size":{"w_m":0.35,"d_m":0.3,"h_m":0.12},"z_ref":"ceiling","z_m":-0.3,"params":{},"params_schema":{},"icon":"office","color_token":"furniture","anchor_kinds":["switch","media_player"],"ifc":{"class":"IfcAudioVisualAppliance","predefined_type":"PROJECTOR"}},
    {"id":"screen.projection","category":"facilities","names":{"he":"מסך הקרנה","en":"Projection screen"},"tags":["מסך","הקרנה","screen"],"role":"office","shape":"box","size":{"w_m":2.4,"d_m":0.1,"h_m":1.5},"z_ref":"floor","z_m":1.0,"params":{},"params_schema":{},"icon":"office","color_token":"furniture","anchor_kinds":["cover"],"ifc":{"class":"IfcFurniture","predefined_type":"USERDEFINED"}},
    {"id":"tv.wall","category":"facilities","names":{"he":"טלוויזיה","en":"TV"},"tags":["טלוויזיה","tv","display"],"role":"office","shape":"box","size":{"w_m":1.2,"d_m":0.1,"h_m":0.7},"z_ref":"floor","z_m":1.5,"params":{},"params_schema":{},"icon":"office","color_token":"furniture","anchor_kinds":["media_player","switch"],"ifc":{"class":"IfcAudioVisualAppliance","predefined_type":"DISPLAY"}},
    {"id":"fridge.kitchen","category":"facilities","names":{"he":"מקרר מטבח","en":"Kitchen fridge"},"tags":["מקרר","fridge"],"role":"kitchen","shape":"box","size":{"w_m":0.9,"d_m":0.75,"h_m":1.9},"z_ref":"floor","z_m":0,"params":{},"params_schema":{},"icon":"cabinet","color_token":"furniture","anchor_kinds":[],"ifc":{"class":"IfcElectricAppliance","predefined_type":"REFRIGERATOR"}},
    {"id":"oven.kitchen","category":"facilities","names":{"he":"תנור","en":"Oven"},"tags":["תנור","oven","cooker"],"role":"kitchen","shape":"box","size":{"w_m":0.6,"d_m":0.6,"h_m":0.9},"z_ref":"floor","z_m":0,"params":{},"params_schema":{},"icon":"office","color_token":"furniture","anchor_kinds":["switch"],"ifc":{"class":"IfcElectricAppliance","predefined_type":"ELECTRICCOOKER"}},
    {"id":"kitchenette.counter","category":"facilities","names":{"he":"מטבחון","en":"Kitchenette"},"tags":["מטבחון","kitchenette","kitchen"],"role":"kitchen","shape":"box","size":{"w_m":2.4,"d_m":0.6,"h_m":0.9},"z_ref":"floor","z_m":0,"params":{},"params_schema":{},"icon":"office","color_token":"furniture","anchor_kinds":[],"ifc":{"class":"IfcFurniture","predefined_type":"USERDEFINED"}},
    {"id":"sink.kitchen","category":"facilities","names":{"he":"כיור מטבח","en":"Kitchen sink"},"tags":["כיור","sink"],"role":"sanitary","shape":"box","size":{"w_m":0.8,"d_m":0.5,"h_m":0.9},"z_ref":"floor","z_m":0,"params":{},"params_schema":{},"icon":"sanitary","color_token":"sanitary","anchor_kinds":[],"ifc":{"class":"IfcSanitaryTerminal","predefined_type":"SINK"}},
    {"id":"sink.bathroom","category":"facilities","names":{"he":"כיור","en":"Washbasin"},"tags":["כיור","sink","washbasin"],"role":"sanitary","shape":"box","size":{"w_m":0.6,"d_m":0.45,"h_m":0.85},"z_ref":"floor","z_m":0,"params":{},"params_schema":{},"icon":"sanitary","color_token":"sanitary","anchor_kinds":[],"ifc":{"class":"IfcSanitaryTerminal","predefined_type":"WASHHANDBASIN"}},
    {"id":"toilet.standard","category":"facilities","names":{"he":"אסלה","en":"Toilet"},"tags":["אסלה","toilet","wc"],"role":"sanitary","shape":"box","size":{"w_m":0.4,"d_m":0.7,"h_m":0.8},"z_ref":"floor","z_m":0,"params":{},"params_schema":{},"icon":"sanitary","color_token":"sanitary","anchor_kinds":[],"ifc":{"class":"IfcSanitaryTerminal","predefined_type":"TOILETPAN"}},
    {"id":"urinal","category":"facilities","names":{"he":"משתנה","en":"Urinal"},"tags":["משתנה","urinal"],"role":"sanitary","shape":"box","size":{"w_m":0.4,"d_m":0.35,"h_m":0.6},"z_ref":"floor","z_m":0.5,"params":{},"params_schema":{},"icon":"sanitary","color_token":"sanitary","anchor_kinds":[],"ifc":{"class":"IfcSanitaryTerminal","predefined_type":"URINAL"}},
    {"id":"shower.stall","category":"facilities","names":{"he":"מקלחת","en":"Shower"},"tags":["מקלחת","shower"],"role":"sanitary","shape":"box","size":{"w_m":0.9,"d_m":0.9,"h_m":2.1},"z_ref":"floor","z_m":0,"params":{},"params_schema":{},"icon":"sanitary","color_token":"sanitary","anchor_kinds":[],"ifc":{"class":"IfcSanitaryTerminal","predefined_type":"SHOWER"}},
    {"id":"bathtub","category":"facilities","names":{"he":"אמבטיה","en":"Bathtub"},"tags":["אמבטיה","bath","bathtub"],"role":"sanitary","shape":"box","size":{"w_m":1.7,"d_m":0.75,"h_m":0.6},"z_ref":"floor","z_m":0,"params":{},"params_schema":{},"icon":"sanitary","color_token":"sanitary","anchor_kinds":[],"ifc":{"class":"IfcSanitaryTerminal","predefined_type":"BATH"}},
    {"id":"water.cooler","category":"facilities","names":{"he":"מתקן מים","en":"Water cooler"},"tags":["מים","water","cooler"],"role":"kitchen","shape":"box","size":{"w_m":0.35,"d_m":0.35,"h_m":1.2},"z_ref":"floor","z_m":0,"params":{},"params_schema":{},"icon":"office","color_token":"furniture","anchor_kinds":["switch"],"ifc":{"class":"IfcElectricAppliance","predefined_type":"USERDEFINED"}},
    {"id":"dishwasher","category":"facilities","names":{"he":"מדיח","en":"Dishwasher"},"tags":["מדיח","dishwasher"],"role":"kitchen","shape":"box","size":{"w_m":0.6,"d_m":0.6,"h_m":0.85},"z_ref":"floor","z_m":0,"params":{},"params_schema":{},"icon":"office","color_token":"furniture","anchor_kinds":["switch"],"ifc":{"class":"IfcElectricAppliance","predefined_type":"DISHWASHER"}},
    {"id":"copier.large","category":"facilities","names":{"he":"מכונת צילום","en":"Copier"},"tags":["צילום","copier"],"role":"office","shape":"box","size":{"w_m":1.0,"d_m":0.7,"h_m":1.2},"z_ref":"floor","z_m":0,"params":{},"params_schema":{},"icon":"office","color_token":"furniture","anchor_kinds":["switch"],"ifc":{"class":"IfcElectricAppliance","predefined_type":"USERDEFINED"}},
    {"id":"coat.rack","category":"facilities","names":{"he":"מתלה מעילים","en":"Coat rack"},"tags":["מתלה","מעילים","coat","rack"],"role":"office","shape":"cylinder","size":{"w_m":0.4,"d_m":0.4,"h_m":1.8},"z_ref":"floor","z_m":0,"params":{},"params_schema":{},"icon":"box","color_token":"furniture","anchor_kinds":[],"ifc":{"class":"IfcFurniture","predefined_type":"USERDEFINED"}},
    {"id":"doorstation.intercom","category":"security","names":{"he":"עמדת דלת (אינטרקום)","en":"Door station"},"tags":["אינטרקום","עמדת דלת","intercom","door station"],"role":"security","shape":"box","size":{"w_m":0.12,"d_m":0.05,"h_m":0.25},"z_ref":"floor","z_m":1.4,"params":{},"params_schema":{},"icon":"doorstation","color_token":"security","anchor_kinds":["binary_sensor","lock","camera","button"],"ifc":{"class":"IfcCommunicationsAppliance","predefined_type":"USERDEFINED"}},
    {"id":"barrier.vehicle","category":"security","names":{"he":"מחסום רכב","en":"Vehicle barrier"},"tags":["מחסום","barrier","boom"],"role":"security","shape":"box","size":{"w_m":4,"d_m":0.3,"h_m":1.0},"z_ref":"floor","z_m":0,"params":{},"params_schema":{},"icon":"doorstation","color_token":"security","anchor_kinds":["cover","switch"],"ifc":{"class":"IfcBuildingElementProxy","predefined_type":"USERDEFINED"}},
    {"id":"turnstile.tripod","category":"security","names":{"he":"קרוסלה","en":"Turnstile"},"tags":["קרוסלה","turnstile"],"role":"security","shape":"box","size":{"w_m":1.2,"d_m":1.0,"h_m":1.0},"z_ref":"floor","z_m":0,"params":{},"params_schema":{},"icon":"doorstation","color_token":"security","anchor_kinds":["lock","cover"],"ifc":{"class":"IfcBuildingElementProxy","predefined_type":"USERDEFINED"}},
    {"id":"gate.pedestrian","category":"security","names":{"he":"שער הולכי רגל","en":"Pedestrian gate"},"tags":["שער","gate"],"role":"security","shape":"box","size":{"w_m":1.0,"d_m":0.1,"h_m":2.0},"z_ref":"floor","z_m":0,"params":{},"params_schema":{},"icon":"doorstation","color_token":"security","anchor_kinds":["lock","cover","binary_sensor"],"ifc":{"class":"IfcDoor","predefined_type":"GATE"}},
    {"id":"gate.vehicle","category":"security","names":{"he":"שער רכב","en":"Vehicle gate"},"tags":["שער","רכב","gate"],"role":"security","shape":"box","size":{"w_m":4,"d_m":0.2,"h_m":2.0},"z_ref":"floor","z_m":0,"params":{},"params_schema":{},"icon":"doorstation","color_token":"security","anchor_kinds":["cover","switch"],"ifc":{"class":"IfcDoor","predefined_type":"GATE"}},
    {"id":"guard.post","category":"security","names":{"he":"עמדת שומר","en":"Guard post"},"tags":["שומר","guard","booth"],"role":"security","shape":"box","size":{"w_m":2.4,"d_m":2.4,"h_m":2.6},"z_ref":"floor","z_m":0,"params":{},"params_schema":{},"icon":"doorstation","color_token":"security","anchor_kinds":[],"ifc":{"class":"IfcBuildingElementProxy","predefined_type":"USERDEFINED"}},
    {"id":"reader.card","category":"security","names":{"he":"קורא כרטיסים","en":"Card reader"},"tags":["קורא","כרטיסים","reader","access"],"role":"security","shape":"box","size":{"w_m":0.08,"d_m":0.05,"h_m":0.12},"z_ref":"floor","z_m":1.2,"params":{},"params_schema":{},"icon":"socket","color_token":"security","anchor_kinds":["lock","binary_sensor"],"ifc":{"class":"IfcCommunicationsAppliance","predefined_type":"USERDEFINED"}},
    {"id":"bollard.security","category":"security","names":{"he":"עמוד חסימה","en":"Bollard"},"tags":["עמוד","חסימה","bollard"],"role":"security","shape":"cylinder","size":{"w_m":0.25,"d_m":0.25,"h_m":0.9},"z_ref":"floor","z_m":0,"params":{},"params_schema":{},"icon":"cylinder","color_token":"security","anchor_kinds":[],"ifc":{"class":"IfcBuildingElementProxy","predefined_type":"USERDEFINED"}},
    {"id":"detector.motion","category":"security","names":{"he":"גלאי תנועה","en":"Motion detector"},"tags":["גלאי","תנועה","motion","pir"],"role":"security","shape":"box","size":{"w_m":0.1,"d_m":0.1,"h_m":0.1},"z_ref":"floor","z_m":2.3,"params":{},"params_schema":{},"icon":"smoke","color_token":"security","anchor_kinds":["binary_sensor"],"ifc":{"class":"IfcSensor","predefined_type":"MOVEMENTSENSOR"}},
    {"id":"siren.outdoor","category":"security","names":{"he":"צופר","en":"Siren"},"tags":["צופר","siren"],"role":"security","shape":"box","size":{"w_m":0.3,"d_m":0.15,"h_m":0.3},"z_ref":"floor","z_m":2.5,"params":{},"params_schema":{},"icon":"smoke","color_token":"security","anchor_kinds":["siren","switch"],"ifc":{"class":"IfcAlarm","predefined_type":"SIREN"}},
    {"id":"keypad.alarm","category":"security","names":{"he":"לוח מקשים לאזעקה","en":"Alarm keypad"},"tags":["אזעקה","keypad","alarm"],"role":"security","shape":"box","size":{"w_m":0.15,"d_m":0.05,"h_m":0.2},"z_ref":"floor","z_m":1.4,"params":{},"params_schema":{},"icon":"socket","color_token":"security","anchor_kinds":["alarm_control_panel"],"ifc":{"class":"IfcAlarm","predefined_type":"USERDEFINED"}},
    {"id":"lock.electric","category":"security","names":{"he":"מנעול חשמלי","en":"Electric lock"},"tags":["מנעול","lock","strike"],"role":"security","shape":"box","size":{"w_m":0.05,"d_m":0.05,"h_m":0.2},"z_ref":"floor","z_m":1.0,"params":{},"params_schema":{},"icon":"socket","color_token":"security","anchor_kinds":["lock"],"ifc":{"class":"IfcDoor","predefined_type":"USERDEFINED"}},
    {"id":"tree.large","category":"outdoor","names":{"he":"עץ","en":"Tree"},"tags":["עץ","tree"],"role":"outdoor","shape":"cylinder","size":{"w_m":6,"d_m":6,"h_m":8},"z_ref":"floor","z_m":0,"params":{},"params_schema":{},"icon":"tree","color_token":"outdoor","anchor_kinds":[],"ifc":{"class":"IfcGeographicElement","predefined_type":"USERDEFINED"}},
    {"id":"tree.small","category":"outdoor","names":{"he":"עץ קטן","en":"Small tree"},"tags":["עץ","tree"],"role":"outdoor","shape":"cylinder","size":{"w_m":3,"d_m":3,"h_m":4},"z_ref":"floor","z_m":0,"params":{},"params_schema":{},"icon":"tree","color_token":"outdoor","anchor_kinds":[],"ifc":{"class":"IfcGeographicElement","predefined_type":"USERDEFINED"}},
    {"id":"bush","category":"outdoor","names":{"he":"שיח","en":"Bush"},"tags":["שיח","bush","shrub"],"role":"outdoor","shape":"cylinder","size":{"w_m":1,"d_m":1,"h_m":1},"z_ref":"floor","z_m":0,"params":{},"params_schema":{},"icon":"tree","color_token":"outdoor","anchor_kinds":[],"ifc":{"class":"IfcGeographicElement","predefined_type":"USERDEFINED"}},
    {"id":"hedge","category":"outdoor","names":{"he":"גדר חיה","en":"Hedge"},"tags":["גדר חיה","hedge"],"role":"outdoor","shape":"box","size":{"w_m":4,"d_m":0.6,"h_m":1.2},"z_ref":"floor","z_m":0,"params":{},"params_schema":{},"icon":"tree","color_token":"outdoor","anchor_kinds":[],"ifc":{"class":"IfcGeographicElement","predefined_type":"USERDEFINED"}},
    {"id":"bench.outdoor","category":"outdoor","names":{"he":"ספסל חוץ","en":"Outdoor bench"},"tags":["ספסל","bench"],"role":"outdoor","shape":"box","size":{"w_m":1.8,"d_m":0.55,"h_m":0.85},"z_ref":"floor","z_m":0,"params":{},"params_schema":{},"icon":"sofa","color_token":"outdoor","anchor_kinds":[],"ifc":{"class":"IfcFurniture","predefined_type":"USERDEFINED"}},
    {"id":"parking.space","category":"outdoor","names":{"he":"חניה","en":"Parking space"},"tags":["חניה","parking"],"role":"outdoor","shape":"box","size":{"w_m":2.5,"d_m":5,"h_m":0.05},"z_ref":"floor","z_m":0,"params":{},"params_schema":{},"icon":"parking","color_token":"outdoor","anchor_kinds":[],"ifc":{"class":"IfcBuildingElementProxy","predefined_type":"USERDEFINED"}},
    {"id":"parking.disabled","category":"outdoor","names":{"he":"חניית נכים","en":"Accessible parking"},"tags":["חניה","נכים","parking","accessible"],"role":"outdoor","shape":"box","size":{"w_m":3.5,"d_m":5,"h_m":0.05},"z_ref":"floor","z_m":0,"params":{},"params_schema":{},"icon":"parking","color_token":"outdoor","anchor_kinds":[],"ifc":{"class":"IfcBuildingElementProxy","predefined_type":"USERDEFINED"}},
    {"id":"bin.waste","category":"outdoor","names":{"he":"פח אשפה","en":"Waste bin"},"tags":["פח","bin","trash"],"role":"outdoor","shape":"cylinder","size":{"w_m":0.5,"d_m":0.5,"h_m":1.0},"z_ref":"floor","z_m":0,"params":{},"params_schema":{},"icon":"cylinder","color_token":"outdoor","anchor_kinds":[],"ifc":{"class":"IfcFurniture","predefined_type":"USERDEFINED"}},
    {"id":"fence.section","category":"outdoor","names":{"he":"גדר","en":"Fence"},"tags":["גדר","fence"],"role":"outdoor","shape":"box","size":{"w_m":3,"d_m":0.05,"h_m":1.8},"z_ref":"floor","z_m":0,"params":{},"params_schema":{},"icon":"box","color_token":"outdoor","anchor_kinds":[],"ifc":{"class":"IfcBuildingElementProxy","predefined_type":"USERDEFINED"}},
    {"id":"sign.post","category":"outdoor","names":{"he":"שלט חוץ","en":"Sign post"},"tags":["שלט","sign"],"role":"outdoor","shape":"box","size":{"w_m":0.8,"d_m":0.1,"h_m":2.2},"z_ref":"floor","z_m":0,"params":{},"params_schema":{},"icon":"exit","color_token":"outdoor","anchor_kinds":[],"ifc":{"class":"IfcSign","predefined_type":"USERDEFINED"}},
    {"id":"bike.rack","category":"outdoor","names":{"he":"מתקן אופניים","en":"Bike rack"},"tags":["אופניים","bike","rack"],"role":"outdoor","shape":"box","size":{"w_m":2,"d_m":0.6,"h_m":0.8},"z_ref":"floor","z_m":0,"params":{},"params_schema":{},"icon":"box","color_token":"outdoor","anchor_kinds":[],"ifc":{"class":"IfcFurniture","predefined_type":"USERDEFINED"}},
    {"id":"table.picnic","category":"outdoor","names":{"he":"שולחן פיקניק","en":"Picnic table"},"tags":["פיקניק","picnic","table"],"role":"outdoor","shape":"box","size":{"w_m":1.8,"d_m":1.5,"h_m":0.75},"z_ref":"floor","z_m":0,"params":{},"params_schema":{},"icon":"table","color_token":"outdoor","anchor_kinds":[],"ifc":{"class":"IfcFurniture","predefined_type":"TABLE"}},
    {"id":"playground.unit","category":"outdoor","names":{"he":"מתקן משחקים","en":"Playground unit"},"tags":["משחקים","playground"],"role":"outdoor","shape":"box","size":{"w_m":5,"d_m":4,"h_m":3},"z_ref":"floor","z_m":0,"params":{},"params_schema":{},"icon":"mat","color_token":"outdoor","anchor_kinds":[],"ifc":{"class":"IfcBuildingElementProxy","predefined_type":"USERDEFINED"}},
    {"id":"pergola","category":"outdoor","names":{"he":"פרגולה","en":"Pergola"},"tags":["פרגולה","pergola"],"role":"outdoor","shape":"box","size":{"w_m":4,"d_m":3,"h_m":2.5},"z_ref":"floor","z_m":0,"params":{},"params_schema":{},"icon":"box","color_token":"outdoor","anchor_kinds":[],"ifc":{"class":"IfcBuildingElementProxy","predefined_type":"USERDEFINED"}},
    {"id":"container.storage","category":"outdoor","names":{"he":"מכולה","en":"Storage container"},"tags":["מכולה","container"],"role":"outdoor","shape":"box","size":{"w_m":6,"d_m":2.4,"h_m":2.6},"z_ref":"floor","z_m":0,"params":{},"params_schema":{},"icon":"cabinet","color_token":"outdoor","anchor_kinds":[],"ifc":{"class":"IfcBuildingElementProxy","predefined_type":"USERDEFINED"}},
    {"id":"dumpster","category":"outdoor","names":{"he":"צפרדע אשפה","en":"Dumpster"},"tags":["צפרדע","dumpster"],"role":"outdoor","shape":"cylinder","size":{"w_m":1.8,"d_m":1.2,"h_m":1.3},"z_ref":"floor","z_m":0,"params":{},"params_schema":{},"icon":"cylinder","color_token":"outdoor","anchor_kinds":[],"ifc":{"class":"IfcFurniture","predefined_type":"USERDEFINED"}},
    {"id":"flagpole","category":"outdoor","names":{"he":"תורן","en":"Flagpole"},"tags":["תורן","flag","pole"],"role":"outdoor","shape":"cylinder","size":{"w_m":0.15,"d_m":0.15,"h_m":8},"z_ref":"floor","z_m":0,"params":{},"params_schema":{},"icon":"cylinder","color_token":"outdoor","anchor_kinds":[],"ifc":{"class":"IfcBuildingElementProxy","predefined_type":"USERDEFINED"}}
  ]
}
```

Check the file before going on: `MSYS_NO_PATHCONV=1 $PY -c "import json,sys; d=json.load(open('smplwise_vms/backend/smplwise/catalog/objects.json',encoding='utf-8')); print(len(d['items']), len(d['categories']), len(d['icons']))"` → `153 12 24`.

- [ ] **Step 5: The loader (`smplwise_vms/backend/smplwise/services/plan_catalog.py`)**

```python
"""Plan Studio object library (T085, CR-003): the built-in catalog shipped with the add-on (catalog/objects.json,
versioned) and the installation's custom items (catalog_items, migration 0020). A custom item may be "based on" a
built-in one and inherits what its row does not carry (z_ref, params_schema, anchor_kinds, ifc). Everything the
validator, the renderer, the search and the API need comes through the indexes here; nothing else reads the file."""
from __future__ import annotations

import json
import re
import sqlite3
from functools import lru_cache
from math import isfinite
from pathlib import Path
from typing import Any

CATALOG_FILE = Path(__file__).resolve().parents[1] / "catalog" / "objects.json"
CATEGORIES = ("structure", "circulation", "seating", "storage", "lighting", "electrical", "safety", "medical", "sport", "facilities", "security", "outdoor")
ROLES = ("furniture", "light", "electrical", "safety", "medical", "sport", "structure", "circulation", "security", "outdoor", "sanitary", "office", "kitchen")
SHAPES = ("box", "cylinder", "extruded_polygon", "stepped", "composite")
ICONS = ("box", "cylinder", "chair", "table", "sofa", "bed", "cabinet", "lamp", "panel", "socket", "extinguisher", "smoke", "exit", "aed", "medical", "goal",
         "mat", "stairs", "elevator", "doorstation", "tree", "sanitary", "office", "parking")
COLOR_TOKENS = ("object", "structure", "circulation", "furniture", "light", "electrical", "safety", "medical", "sport", "sanitary", "security", "outdoor")
Z_REFS = ("floor", "ceiling")
MIN_SIZE_M, MAX_SIZE_M = 0.05, 100.0
MIN_Z_M, MAX_Z_M = -50.0, 500.0
MAX_PARAMS_BYTES = 4096
MAX_TAGS = 20
ID_RE = re.compile(r"^[a-z0-9][a-z0-9._-]{0,63}$")
DEFAULT_IFC = {"class": "IfcFurniture", "predefined_type": "USERDEFINED"}


def _num(v: Any) -> bool:
    return isinstance(v, (int, float)) and not isinstance(v, bool) and isfinite(v)


def _size_ok(size: Any) -> bool:
    return isinstance(size, dict) and all(_num(size.get(k)) and MIN_SIZE_M <= size[k] <= MAX_SIZE_M for k in ("w_m", "d_m", "h_m")) and set(size) == {"w_m", "d_m", "h_m"}


def check_item(item: Any, ids: set[str], *, builtin: bool) -> list[str]:
    """Problems of one catalog item as "<id>: <what>" strings - the rules the file and a custom item share. `ids` collects
    the ids seen so far (a duplicate is a problem). A custom item is checked without z_ref / params_schema / anchor_kinds /
    ifc, which it takes from its base."""
    if not isinstance(item, dict):
        return ["item: not an object"]
    iid = item.get("id")
    tag = iid if isinstance(iid, str) else "?"
    out: list[str] = []
    if not isinstance(iid, str) or not ID_RE.match(iid):
        out.append(f"{tag}: id must match {ID_RE.pattern}")
    elif iid in ids:
        out.append(f"{tag}: duplicate id")
    else:
        ids.add(iid)
    if item.get("category") not in CATEGORIES:
        out.append(f"{tag}: unknown category")
    names = item.get("names")
    if not isinstance(names, dict) or not isinstance(names.get("he"), str) or not 1 <= len(names["he"].strip()) <= 80:
        out.append(f"{tag}: names.he must be 1..80 characters")
    if isinstance(names, dict) and "en" in names and (not isinstance(names["en"], str) or len(names["en"]) > 80):
        out.append(f"{tag}: names.en must be a string of at most 80 characters")
    tags = item.get("tags", [])
    if not isinstance(tags, list) or len(tags) > MAX_TAGS or not all(isinstance(t, str) and 1 <= len(t) <= 40 for t in tags):
        out.append(f"{tag}: tags must be up to {MAX_TAGS} strings of 1..40 characters")
    if item.get("role") not in ROLES:
        out.append(f"{tag}: unknown role")
    if item.get("shape") not in SHAPES:
        out.append(f"{tag}: unknown shape")
    if not _size_ok(item.get("size")):
        out.append(f"{tag}: size w_m / d_m / h_m must be {MIN_SIZE_M}..{MAX_SIZE_M} m")
    if not _num(item.get("z_m")) or not MIN_Z_M <= item["z_m"] <= MAX_Z_M:
        out.append(f"{tag}: z_m must be {MIN_Z_M}..{MAX_Z_M} m")
    params = item.get("params", {})
    if not isinstance(params, dict) or len(json.dumps(params, ensure_ascii=False)) > MAX_PARAMS_BYTES:
        out.append(f"{tag}: params must be an object under {MAX_PARAMS_BYTES} bytes")
    elif item.get("shape") == "stepped" and not (isinstance(params.get("rows"), int) and params["rows"] >= 1 and _num(params.get("step_height_m")) and _num(params.get("step_width_m"))):
        out.append(f"{tag}: a stepped shape needs params rows, step_height_m and step_width_m")
    if item.get("icon") not in ICONS:
        out.append(f"{tag}: unknown icon")
    if item.get("color_token") not in COLOR_TOKENS:
        out.append(f"{tag}: unknown color_token")
    if builtin:
        if item.get("z_ref") not in Z_REFS:
            out.append(f"{tag}: z_ref must be floor or ceiling")
        if not isinstance(item.get("params_schema"), dict):
            out.append(f"{tag}: params_schema must be an object")
        if not isinstance(item.get("anchor_kinds"), list) or not all(isinstance(k, str) for k in item["anchor_kinds"]):
            out.append(f"{tag}: anchor_kinds must be a list of domains")
        ifc = item.get("ifc")
        if not isinstance(ifc, dict) or not isinstance(ifc.get("class"), str) or not ifc["class"].startswith("Ifc"):
            out.append(f"{tag}: ifc.class must name an Ifc class")
    return out


def check_catalog(data: Any) -> list[str]:
    """Every problem of a catalog file (empty when it is valid): the header, the category list, each item, and that
    every category is used."""
    if not isinstance(data, dict):
        return ["catalog: not an object"]
    errors: list[str] = []
    if not isinstance(data.get("catalog_version"), str) or not data["catalog_version"].strip():
        errors.append("catalog_version: missing")
    cats = data.get("categories")
    if not isinstance(cats, list) or [c.get("id") if isinstance(c, dict) else None for c in cats] != list(CATEGORIES) or not all(isinstance(c.get("he"), str) and c["he"] for c in cats):
        errors.append("categories: must be the 12 known categories, in order, each with a Hebrew name")
    if data.get("icons") != list(ICONS):
        errors.append("icons: must list the 24 symbol ids")
    if data.get("color_tokens") != list(COLOR_TOKENS):
        errors.append("color_tokens: must list the known tokens")
    items = data.get("items")
    if not isinstance(items, list) or not items:
        errors.append("items: must be a non-empty list")
        return errors
    ids: set[str] = set()
    for item in items:
        errors.extend(check_item(item, ids, builtin=True))
    used = {i.get("category") for i in items if isinstance(i, dict)}
    for c in CATEGORIES:
        if c not in used:
            errors.append(f"category {c}: no items")
    return errors


@lru_cache(maxsize=1)
def builtin() -> dict[str, Any]:
    """The built-in library, read once. A broken file is a packaging error: refuse to start rather than serve half."""
    data = json.loads(CATALOG_FILE.read_text(encoding="utf-8"))
    errors = check_catalog(data)
    if errors:
        raise RuntimeError("catalog/objects.json is invalid: " + "; ".join(errors[:5]))
    return {"catalog_version": data["catalog_version"], "categories": data["categories"], "icons": list(data["icons"]), "color_tokens": list(data["color_tokens"]),
            "items": {i["id"]: i for i in data["items"]}}


def builtin_ids() -> frozenset[str]:
    return frozenset(builtin()["items"])


def row_item(r: sqlite3.Row | dict[str, Any]) -> dict[str, Any]:
    """A custom row as a library item: its own fields, and from its base what a row does not carry."""
    base = builtin()["items"].get(r["based_on"]) if r["based_on"] else None
    names = json.loads(r["names_json"])
    return {
        "id": r["id"], "custom": True, "based_on": r["based_on"], "category": r["category"], "names": {"he": names.get("he", ""), "en": names.get("en", "")},
        "tags": json.loads(r["tags_json"] or "[]"), "role": r["role"], "shape": r["shape"], "size": json.loads(r["size_json"]),
        "z_ref": base["z_ref"] if base else "floor", "z_m": r["z_m"], "params": json.loads(r["params_json"] or "{}"),
        "params_schema": dict(base["params_schema"]) if base else {}, "icon": r["icon"], "color_token": r["color_token"],
        "anchor_kinds": list(base["anchor_kinds"]) if base else [], "ifc": dict(base["ifc"]) if base else dict(DEFAULT_IFC),
        "created_by": r["created_by"], "created_at": r["created_at"], "updated_at": r["updated_at"],
    }


def custom_rows(conn: sqlite3.Connection) -> list[sqlite3.Row]:
    return conn.execute("SELECT * FROM catalog_items ORDER BY created_at, rowid").fetchall()


def custom_items(conn: sqlite3.Connection) -> list[dict[str, Any]]:
    return [row_item(r) for r in custom_rows(conn)]


def revision(conn: sqlite3.Connection) -> str:
    """What a client compares to know whether its copy of the library is current: the built-in version, the number of
    custom items and the latest custom change."""
    row = conn.execute("SELECT COUNT(*), MAX(updated_at) FROM catalog_items").fetchone()
    return f"{builtin()['catalog_version']}:{row[0]}:{row[1] or ''}"


def library(conn: sqlite3.Connection) -> dict[str, Any]:
    b = builtin()
    return {"catalog_version": b["catalog_version"], "revision": revision(conn), "categories": b["categories"], "icons": b["icons"], "color_tokens": b["color_tokens"],
            "items": [dict(i, custom=False, based_on=None) for i in b["items"].values()] + custom_items(conn)}


def item_index(conn: sqlite3.Connection) -> dict[str, dict[str, Any]]:
    """Every item by id (built-in and custom): what the validator, the normalizer and the renderer look up."""
    return {**builtin()["items"], **{i["id"]: i for i in custom_items(conn)}}


def names_index(conn: sqlite3.Connection) -> dict[str, dict[str, Any]]:
    """The searchable names of every item: he, en and tags."""
    return {iid: {"he": i["names"].get("he", ""), "en": i["names"].get("en", ""), "tags": list(i.get("tags", []))} for iid, i in item_index(conn).items()}
```

- [ ] **Step 6: Run the tests to see them pass**

Run: `cd smplwise_vms/backend && MSYS_NO_PATHCONV=1 $PY -m pytest tests/test_plan_catalog.py tests/test_plan_geometry_db.py -p no:cacheprovider`
Expected: `7 passed` (4 new + 3 existing).

- [ ] **Step 7: Commit**

```bash
cd /c/cloude/smplwisebms && git add smplwise_vms/backend/smplwise/migrations/0020_catalog_items.sql smplwise_vms/backend/smplwise/catalog/objects.json smplwise_vms/backend/smplwise/services/plan_catalog.py smplwise_vms/backend/tests/test_plan_catalog.py
msg=$(mktemp) && cat > "$msg" <<'EOF'
feat(plan-studio): custom items table, the built-in object catalog (153 items, 12 categories) and its loader (T085)

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOF
test "$(bash /c/cloude/smplwisebms/secrets/scan_staged.sh)" = 0 && git commit -F "$msg"
```

---
### Task 2: The catalog API, `catalog.manage`, audit, backups and the bundle's `catalog_revision`

**Files:**
- Create: `smplwise_vms/backend/smplwise/routers/plan_catalog.py`
- Modify: `smplwise_vms/backend/smplwise/services/plan_catalog.py` (append `DEFAULT_CUSTOM`, `custom_values`)
- Modify: `smplwise_vms/backend/smplwise/main.py` (import + `include_router`)
- Modify: `smplwise_vms/backend/smplwise/roles.json`, `contracts/examples/role-catalog.design.json` (`catalog.manage` on editor / site_admin / system_admin)
- Modify: `smplwise_vms/backend/smplwise/routers/access.py` (`PERMISSION_LABELS`)
- Modify: `smplwise_vms/backend/smplwise/services/backup.py` (`PROJECT_TABLES`)
- Modify: `smplwise_vms/backend/smplwise/routers/anchors.py` (`catalog_revision` in the bundle)
- Test: `smplwise_vms/backend/tests/test_plan_catalog_api.py` (create); `tests/test_rbac_matrix.py`, `tests/test_plan_geometry_integration.py` (one test each)

**Interfaces:**
- Consumes: `plan_catalog.library / revision / row_item / custom_rows / builtin_ids / check_item / ID_RE` (Task 1); `rbac.permissions_anywhere`, `rbac.authorize`, `audit.audit`, `backup.PROJECT_TABLES`.
- Produces:
  - `plan_catalog.custom_values(body, *, existing=None) -> dict` (the column values `based_on, names_json, category, tags_json, role, shape, size_json, z_m, params_json, icon, color_token`; raises `ValueError(message)`), `plan_catalog.DEFAULT_CUSTOM`.
  - HTTP (all under `/api/v1`): `GET /catalog/objects` → `{catalog_version, revision, categories, icons, color_tokens, items}` (map.read at any scope); `POST /catalog/objects` body `{based_on?, names {he, en?}, category?, tags?, role?, shape?, size?, z_m?, params?, icon?, color_token?}` → 201 merged item; `PATCH /catalog/objects/{id}` (same fields, partial) → item, 409 `builtin_item` for a built-in id, 404 unknown; `DELETE /catalog/objects/{id}` → 204; `GET /catalog/export` → `{format: "smplwise-catalog-1", catalog_version, exported_at, items: [row dicts]}` as an attachment; `POST /catalog/import` body `{format, items}` → `{imported, replaced, revision}` (an id of a built-in item or a malformed id → 422). Manage routes need `catalog.manage` at any scope.
  - Audit actions `catalog.item.create`, `catalog.item.update`, `catalog.item.delete` (resource_type `catalog`, resource_id = item id) and `catalog.import` (resource_id `*`, details `{imported, replaced}`).
  - `roles.json`: `catalog.manage` on `editor`, `site_admin`, `system_admin`; `PERMISSION_LABELS["catalog.manage"] = "ניהול ספריית העצמים"`.
  - `GET /floors/{id}/map` → `catalog_revision: string`; `backup.PROJECT_TABLES` includes `catalog_items`.

- [ ] **Step 1: Write the failing tests**

`smplwise_vms/backend/tests/test_plan_catalog_api.py`:

```python
"""Plan Studio object library API (T085): the merged library for every map reader, custom items with "based on" for
catalog.manage only, built-in items never editable, export / import of the custom library (duplicates by id are
replaced, the created_at of a round trip is kept), the audit rows, the roles that hold the permission, the bundle's
catalog_revision and the backup of custom items."""
from __future__ import annotations

import io
import json
import pathlib
import zipfile
from dataclasses import replace

from conftest import as_user, bind, png_bytes, seed_tree
from fastapi.testclient import TestClient

from smplwise.main import create_app
from smplwise.rbac import ROLES
from smplwise.routers.access import PERMISSION_LABELS

ROOT = pathlib.Path(__file__).resolve().parents[3]


def test_library_read_scope_and_the_custom_item_lifecycle(settings):
    app = create_app(settings)
    c = TestClient(app)
    ids = seed_tree(c)
    lib = c.get("/api/v1/catalog/objects").json()
    assert len(lib["items"]) == 153 and lib["revision"] == "2026.09.1:0:" and [x["id"] for x in lib["categories"]][:2] == ["structure", "circulation"]
    assert lib["items"][0] == dict(lib["items"][0], custom=False, based_on=None)
    # a floor-scoped viewer reads the library, a user without any binding does not, a viewer never manages it
    bind(c, settings, "vera", "viewer", "floor", ids["floor2"])
    assert c.get("/api/v1/catalog/objects", headers=as_user("vera")).status_code == 200
    assert c.get("/api/v1/catalog/objects", headers=as_user("nobody")).status_code == 403
    assert c.post("/api/v1/catalog/objects", json={"names": {"he": "x"}}, headers=as_user("vera")).status_code == 403
    # create based on a built-in lamp: what the body omits comes from the base
    r = c.post("/api/v1/catalog/objects", json={"based_on": "light.ceiling", "names": {"he": "מנורת אולם", "en": "Hall lamp"}, "size": {"w_m": 0.6, "d_m": 0.6, "h_m": 0.2}, "params": {"power_w": 120}})
    assert r.status_code == 201, r.text
    item = r.json()
    assert item["custom"] is True and item["based_on"] == "light.ceiling" and item["category"] == "lighting" and item["icon"] == "lamp" and item["z_ref"] == "ceiling" and item["z_m"] == -0.3
    assert item["anchor_kinds"] == ["light", "switch"] and item["params"] == {"power_w": 120} and item["role"] == "light" and item["created_by"] == "dev-joni"
    iid = item["id"]
    lib = c.get("/api/v1/catalog/objects").json()
    assert len(lib["items"]) == 154 and lib["revision"].startswith("2026.09.1:1:")
    # patch a field; a bad value is refused; built-in items are never touched
    assert c.patch(f"/api/v1/catalog/objects/{iid}", json={"z_m": -0.6, "tags": ["אולם"]}).json()["z_m"] == -0.6
    assert c.patch(f"/api/v1/catalog/objects/{iid}", json={"icon": "spaceship"}).status_code == 422
    assert c.patch(f"/api/v1/catalog/objects/{iid}", json={"size": {"w_m": 0.01, "d_m": 1, "h_m": 1}}).status_code == 422
    assert c.post("/api/v1/catalog/objects", json={"based_on": "nope", "names": {"he": "x"}}).status_code == 422
    assert c.post("/api/v1/catalog/objects", json={"names": {"he": ""}}).status_code == 422
    assert c.patch("/api/v1/catalog/objects/chair.basic", json={"z_m": 1}).status_code == 409
    assert c.delete("/api/v1/catalog/objects/chair.basic").status_code == 409
    assert c.patch("/api/v1/catalog/objects/missing", json={"z_m": 1}).status_code == 404
    # a custom item without a base takes the neutral defaults
    plain = c.post("/api/v1/catalog/objects", json={"names": {"he": "ארגז"}, "category": "storage"}).json()
    assert plain["shape"] == "box" and plain["size"] == {"w_m": 1.0, "d_m": 1.0, "h_m": 1.0} and plain["icon"] == "box" and plain["color_token"] == "object" and plain["z_ref"] == "floor"
    # export, delete, import back (ids kept; a second copy replaces the first)
    exp = c.get("/api/v1/catalog/export")
    assert exp.status_code == 200 and exp.headers["content-disposition"].startswith("attachment") and exp.json()["format"] == "smplwise-catalog-1"
    assert [x["id"] for x in exp.json()["items"]] == [iid, plain["id"]] and exp.json()["items"][0]["names"]["he"] == "מנורת אולם"
    assert c.delete(f"/api/v1/catalog/objects/{iid}").status_code == 204
    assert c.get("/api/v1/catalog/objects").json()["revision"].startswith("2026.09.1:1:")
    imp = c.post("/api/v1/catalog/import", json=exp.json())
    assert imp.status_code == 200, imp.text
    assert imp.json() == {"imported": 1, "replaced": 1, "revision": c.get("/api/v1/catalog/objects").json()["revision"]}
    back = c.get("/api/v1/catalog/objects").json()["items"]
    assert [x["id"] for x in back if x["custom"]] == [iid, plain["id"]], "a round trip keeps created_at, so the order holds"
    assert next(x for x in back if x["id"] == iid)["z_m"] == -0.6
    assert c.post("/api/v1/catalog/import", json={"format": "smplwise-catalog-1", "items": [{"id": "chair.basic", "names": {"he": "x"}}]}).status_code == 422
    assert c.post("/api/v1/catalog/import", json={"format": "smplwise-catalog-1", "items": [{"id": "BAD ID", "names": {"he": "x"}}]}).status_code == 422
    assert c.post("/api/v1/catalog/import", json={"format": "other", "items": []}).status_code == 422
    assert c.get("/api/v1/catalog/export", headers=as_user("vera")).status_code == 403
    with app.state.db.connection() as conn:
        acts = [r[0] for r in conn.execute("SELECT action FROM audit_log WHERE decision = 'allowed' AND (action LIKE 'catalog.item.%' OR action = 'catalog.import') ORDER BY rowid").fetchall()]
    assert acts == ["catalog.item.create", "catalog.item.update", "catalog.item.create", "catalog.item.delete", "catalog.import"]


def test_the_permission_sits_on_the_built_in_roles_and_the_labels(settings):
    assert all("catalog.manage" in ROLES[r] for r in ("editor", "site_admin", "system_admin"))
    assert all("catalog.manage" not in ROLES[r] for r in ("viewer", "operator", "kiosk"))
    assert PERMISSION_LABELS["catalog.manage"] == "ניהול ספריית העצמים"
    contract = json.loads((ROOT / "contracts" / "examples" / "role-catalog.design.json").read_text(encoding="utf-8"))
    assert {r["id"]: "catalog.manage" in r["permissions"] for r in contract["roles"]} == {r["id"]: "catalog.manage" in ROLES[r["id"]] for r in contract["roles"]}
    app = create_app(settings)
    c = TestClient(app)
    ids = seed_tree(c)
    bind(c, settings, "eli", "editor", "floor", ids["floor2"])
    assert "catalog.manage" in c.get("/api/v1/me", headers=as_user("eli")).json()["permissions_any"]
    assert c.post("/api/v1/catalog/objects", json={"names": {"he": "ארגז"}}, headers=as_user("eli")).status_code == 201, "an editor anywhere manages the shared library"


def test_the_bundle_carries_the_catalog_revision_and_backups_carry_custom_items(settings, tmp_path):
    app = create_app(settings)
    c = TestClient(app)
    ids = seed_tree(c)
    asset = c.post(f"/api/v1/floors/{ids['floor2']}/plan-assets", files={"file": ("plan.png", png_bytes(), "image/png")}).json()
    v = c.post(f"/api/v1/floors/{ids['floor2']}/plan-versions", json={"asset_id": asset["id"]}).json()
    assert c.post(f"/api/v1/plan-versions/{v['id']}/publish").status_code == 200
    assert c.get(f"/api/v1/floors/{ids['floor2']}/map").json()["catalog_revision"] == "2026.09.1:0:"
    item = c.post("/api/v1/catalog/objects", json={"based_on": "chair.basic", "names": {"he": "כיסא אולם"}}).json()
    assert c.get(f"/api/v1/floors/{ids['floor2']}/map").json()["catalog_revision"] == c.get("/api/v1/catalog/objects").json()["revision"]
    e = c.post("/api/v1/backups", json={"note": "with a custom item"}).json()
    assert e["tables"]["catalog_items"] == 1
    d = c.get(f"/api/v1/backups/{e['name']}/download")
    with zipfile.ZipFile(io.BytesIO(d.content)) as z:
        assert json.loads(z.read("data/catalog_items.json"))[0]["id"] == item["id"]
    app2 = create_app(replace(settings, data_dir=tmp_path / "data2"))
    c2 = TestClient(app2)
    up = c2.post("/api/v1/backups/upload", files={"file": ("copy.zip", d.content, "application/zip")}).json()
    assert c2.post(f"/api/v1/backups/{up['name']}/restore", json={"mode": "replace", "scope": "project", "confirm": "RESTORE"}).status_code == 200
    restored = [x for x in c2.get("/api/v1/catalog/objects").json()["items"] if x["custom"]]
    assert [x["id"] for x in restored] == [item["id"]] and restored[0]["names"]["he"] == "כיסא אולם" and restored[0]["based_on"] == "chair.basic"
```

In `smplwise_vms/backend/tests/test_rbac_matrix.py`, inside `test_matrix_by_role_scope_and_deny` right after the two `map.read` assertions (the lines starting with `assert [st(u, "get", f"/api/v1/floors/{f3}/map")`), add:

```python
    # catalog.manage: editors and site admins anywhere manage the shared object library; viewers and operators never
    assert [st(u, "post", "/api/v1/catalog/objects", json={"names": {"he": "ארגז"}}) for u in ("vera", "omer", "eli", "sara", "dan")] == [403, 403, 201, 201, 403]
```

In `smplwise_vms/backend/tests/test_plan_geometry_integration.py`, append:

```python
def test_the_bundle_says_which_library_the_map_needs(settings):
    app, c, ids, vid, _ = _setup(settings)
    m = c.get(f"/api/v1/floors/{ids['floor2']}/map").json()
    assert m["catalog_revision"] == "2026.09.1:0:"
```

- [ ] **Step 2: Run to see them fail**

Run: `cd smplwise_vms/backend && MSYS_NO_PATHCONV=1 $PY -m pytest tests/test_plan_catalog_api.py tests/test_rbac_matrix.py tests/test_plan_geometry_integration.py -p no:cacheprovider`
Expected: the three new tests FAIL (404 on `/catalog/objects`, `KeyError: 'catalog.manage'`, `KeyError: 'catalog_revision'`), the matrix test FAILS on the new row; the other integration tests pass.

- [ ] **Step 3: `custom_values` in `services/plan_catalog.py`**

Add `import copy` to the imports (after `import json`) and append at the end of the file:

```python
# ---------------------------------------------------------------- custom items (API)

DEFAULT_CUSTOM: dict[str, Any] = {"category": "storage", "names": {"he": "", "en": ""}, "tags": [], "role": "furniture", "shape": "box",
                                  "size": {"w_m": 1.0, "d_m": 1.0, "h_m": 1.0}, "z_m": 0.0, "params": {}, "icon": "box", "color_token": "object"}
CUSTOM_FIELDS = ("names", "category", "tags", "role", "shape", "size", "z_m", "params", "icon", "color_token")


def custom_values(body: Mapping[str, Any], *, existing: sqlite3.Row | Mapping[str, Any] | None = None) -> dict[str, Any]:
    """The column values of a custom item from an API body: the body's fields over the existing row's (a PATCH), over the
    base item's (based_on), over the neutral defaults. Raises ValueError(message) when the result breaks a rule of
    check_item. Unknown keys in the body are ignored (an export carries created_at and updated_at)."""
    based_on = body["based_on"] if "based_on" in body else (existing["based_on"] if existing is not None else None)
    if based_on is not None and based_on not in builtin()["items"]:
        raise ValueError("based_on חייב להיות מזהה של פריט מובנה")
    base = builtin()["items"].get(based_on) if based_on else None
    merged: dict[str, Any] = copy.deepcopy(DEFAULT_CUSTOM)
    if base is not None:
        merged.update({k: copy.deepcopy(base[k]) for k in CUSTOM_FIELDS})
    if existing is not None:
        merged.update({"names": json.loads(existing["names_json"]), "category": existing["category"], "tags": json.loads(existing["tags_json"] or "[]"), "role": existing["role"],
                       "shape": existing["shape"], "size": json.loads(existing["size_json"]), "z_m": existing["z_m"], "params": json.loads(existing["params_json"] or "{}"),
                       "icon": existing["icon"], "color_token": existing["color_token"]})
    for k in CUSTOM_FIELDS:
        if body.get(k) is not None:
            merged[k] = copy.deepcopy(body[k])
    if isinstance(merged.get("names"), dict):
        merged["names"] = {"he": str(merged["names"].get("he", "")).strip(), "en": str(merged["names"].get("en", "")).strip()}
    if isinstance(merged.get("size"), dict):
        merged["size"] = {k: merged["size"].get(k) for k in ("w_m", "d_m", "h_m")}
    item = {"id": body.get("id") or (existing["id"] if existing is not None else "x"), **merged}
    problems = check_item(item, set(), builtin=False)
    if problems:
        raise ValueError("; ".join(p.split(": ", 1)[1] for p in problems))
    return {"based_on": based_on, "names_json": json.dumps(merged["names"], ensure_ascii=False), "category": merged["category"], "tags_json": json.dumps(merged["tags"], ensure_ascii=False),
            "role": merged["role"], "shape": merged["shape"], "size_json": json.dumps(merged["size"]), "z_m": float(merged["z_m"]),
            "params_json": json.dumps(merged["params"], ensure_ascii=False), "icon": merged["icon"], "color_token": merged["color_token"]}
```

and add `Mapping` to the typing import: `from typing import Any, Mapping`.

- [ ] **Step 4: The router (`smplwise_vms/backend/smplwise/routers/plan_catalog.py`)**

```python
"""Plan Studio object library API (T085, CR-003): the built-in catalog merged with the installation's custom items
(readable by anyone who may read a map), custom items with "based on" (catalog.manage, held at any scope: the
library is shared), and the export / import of the custom library as JSON. Built-in items never change through the
API; a custom item that a document still uses may be deleted - the object then reports unknown_item in the editor."""
from __future__ import annotations

import json
import sqlite3
from typing import Any

from fastapi import APIRouter, Depends, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ConfigDict, Field

from ..audit import audit
from ..auth import current_principal, current_principal_ro, get_conn, get_read_conn
from ..db import new_id, now_iso
from ..errors import ApiError, conflict, not_found
from ..rbac import INSTALLATION, Principal, authorize, permissions_anywhere, require
from ..services import plan_catalog as cat

router = APIRouter()
NO_CACHE = {"Cache-Control": "private, no-cache"}
EXPORT_FORMAT = "smplwise-catalog-1"
COLUMNS = ("based_on", "names_json", "category", "tags_json", "role", "shape", "size_json", "z_m", "params_json", "icon", "color_token")
_INSERT = f"INSERT INTO catalog_items(id, {', '.join(COLUMNS)}, created_by, created_at, updated_at) VALUES (?, {', '.join('?' * len(COLUMNS))}, ?, ?, ?)"
_UPDATE = f"UPDATE catalog_items SET {', '.join(f'{c} = ?' for c in COLUMNS)}, updated_at = ? WHERE id = ?"


def _rid(request: Request) -> str | None:
    return getattr(request.state, "correlation_id", None)


def _held_anywhere(conn: sqlite3.Connection, principal: Principal, permission: str) -> None:
    """The library is installation-wide data: a floor-scoped binding is enough (a floor viewer reads it, a floor editor
    manages it). Without the permission anywhere the refusal is audited at the root scope."""
    if authorize(conn, principal, permission, INSTALLATION).allowed or permission in permissions_anywhere(conn, principal):
        return
    require(conn, principal, permission, INSTALLATION)


def _custom(conn: sqlite3.Connection, item_id: str) -> sqlite3.Row:
    if item_id in cat.builtin_ids():
        raise conflict("builtin_item", "פריט מובנה אינו ניתן לעריכה או למחיקה; צור פריט מותאם שמבוסס עליו.")
    r = conn.execute("SELECT * FROM catalog_items WHERE id = ?", (item_id,)).fetchone()
    if r is None:
        raise not_found("הפריט לא נמצא בספרייה.")
    return r


def _values(body: dict[str, Any], existing: sqlite3.Row | None = None) -> dict[str, Any]:
    try:
        return cat.custom_values(body, existing=existing)
    except ValueError as exc:
        raise ApiError(422, "validation", f"פריט לא תקין: {exc}.")


def _item(conn: sqlite3.Connection, item_id: str) -> dict[str, Any]:
    return cat.row_item(conn.execute("SELECT * FROM catalog_items WHERE id = ?", (item_id,)).fetchone())


def _row_dict(r: sqlite3.Row) -> dict[str, Any]:
    """The export shape of a custom row: the columns with the JSON ones decoded (what import takes back)."""
    return {"id": r["id"], "based_on": r["based_on"], "names": json.loads(r["names_json"]), "category": r["category"], "tags": json.loads(r["tags_json"] or "[]"),
            "role": r["role"], "shape": r["shape"], "size": json.loads(r["size_json"]), "z_m": r["z_m"], "params": json.loads(r["params_json"] or "{}"),
            "icon": r["icon"], "color_token": r["color_token"], "created_at": r["created_at"], "updated_at": r["updated_at"]}


class CustomItemIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    based_on: str | None = Field(default=None, max_length=64)
    names: dict[str, str] | None = None
    category: str | None = Field(default=None, max_length=40)
    tags: list[str] | None = Field(default=None, max_length=20)
    role: str | None = Field(default=None, max_length=40)
    shape: str | None = Field(default=None, max_length=40)
    size: dict[str, float] | None = None
    z_m: float | None = None
    params: dict[str, Any] | None = None
    icon: str | None = Field(default=None, max_length=40)
    color_token: str | None = Field(default=None, max_length=40)


class ImportIn(BaseModel):
    format: str = Field(pattern="^smplwise-catalog-1$")
    items: list[dict[str, Any]] = Field(max_length=500)


@router.get("/catalog/objects")
def list_objects(principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    """The whole library (built-in + custom); the client filters and searches it."""
    _held_anywhere(conn, principal, "map.read")
    return cat.library(conn)


@router.post("/catalog/objects", status_code=201)
def create_object(body: CustomItemIn, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    _held_anywhere(conn, principal, "catalog.manage")
    values = _values(body.model_dump(exclude_unset=True))
    iid, now = new_id(), now_iso()
    conn.execute(_INSERT, (iid, *[values[c] for c in COLUMNS], principal.user_id, now, now))
    audit(conn, actor=principal, action="catalog.item.create", decision="allowed", resource_type="catalog", resource_id=iid, request_id=_rid(request),
          details={"based_on": values["based_on"], "category": values["category"], "name": json.loads(values["names_json"])["he"]})
    return _item(conn, iid)


@router.patch("/catalog/objects/{item_id}")
def update_object(item_id: str, body: CustomItemIn, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    _held_anywhere(conn, principal, "catalog.manage")
    r = _custom(conn, item_id)
    fields = body.model_dump(exclude_unset=True)
    values = _values(fields, existing=r)
    conn.execute(_UPDATE, (*[values[c] for c in COLUMNS], now_iso(), item_id))
    audit(conn, actor=principal, action="catalog.item.update", decision="allowed", resource_type="catalog", resource_id=item_id, request_id=_rid(request),
          details={"fields": sorted(fields)})
    return _item(conn, item_id)


@router.delete("/catalog/objects/{item_id}", status_code=204)
def delete_object(item_id: str, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> None:
    _held_anywhere(conn, principal, "catalog.manage")
    r = _custom(conn, item_id)
    conn.execute("DELETE FROM catalog_items WHERE id = ?", (item_id,))
    audit(conn, actor=principal, action="catalog.item.delete", decision="allowed", resource_type="catalog", resource_id=item_id, request_id=_rid(request),
          details={"name": json.loads(r["names_json"]).get("he"), "based_on": r["based_on"]})


@router.get("/catalog/export", response_model=None)
def export_catalog(principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> JSONResponse:
    """The custom items as a JSON file (the built-in ones ship with the add-on and are not exported)."""
    _held_anywhere(conn, principal, "catalog.manage")
    body = {"format": EXPORT_FORMAT, "catalog_version": cat.builtin()["catalog_version"], "exported_at": now_iso(), "items": [_row_dict(r) for r in cat.custom_rows(conn)]}
    return JSONResponse(body, headers={"Content-Disposition": 'attachment; filename="smplwise-catalog-custom.json"', **NO_CACHE})


@router.post("/catalog/import")
def import_catalog(body: ImportIn, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """Custom items from an export: an id already in the table is replaced, a new one inserted (its created_at kept
    when the file carries one, so a round trip keeps the order); an id of a built-in item or a malformed id refuses
    the whole file before anything is written."""
    _held_anywhere(conn, principal, "catalog.manage")
    builtin_ids = cat.builtin_ids()
    prepared: list[tuple[str, dict[str, Any], str | None]] = []
    for i, item in enumerate(body.items):
        iid = item.get("id")
        if not isinstance(iid, str) or not cat.ID_RE.match(iid):
            raise ApiError(422, "validation", f"פריט {i + 1}: מזהה לא תקין.")
        if iid in builtin_ids:
            raise ApiError(422, "validation", f"פריט {i + 1}: המזהה {iid} שמור לפריט מובנה.")
        created = item.get("created_at")
        prepared.append((iid, _values(item), created if isinstance(created, str) and len(created) == 20 else None))
    imported = replaced = 0
    now = now_iso()
    for iid, values, created in prepared:
        if conn.execute("SELECT 1 FROM catalog_items WHERE id = ?", (iid,)).fetchone():
            conn.execute(_UPDATE, (*[values[c] for c in COLUMNS], now, iid))
            replaced += 1
        else:
            conn.execute(_INSERT, (iid, *[values[c] for c in COLUMNS], principal.user_id, created or now, now))
            imported += 1
    audit(conn, actor=principal, action="catalog.import", decision="allowed", resource_type="catalog", resource_id="*", request_id=_rid(request),
          details={"imported": imported, "replaced": replaced})
    return {"imported": imported, "replaced": replaced, "revision": cat.revision(conn)}
```

- [ ] **Step 5: Wire it: router, roles, labels, backup, bundle**

In `smplwise_vms/backend/smplwise/main.py`, replace `plan_geometry, plans, playback,` in the `from .routers import …` line with `plan_catalog, plan_geometry, plans, playback,`, and after `app.include_router(plan_geometry.router, prefix=api, tags=["plans"])` add:

```python
    app.include_router(plan_catalog.router, prefix=api, tags=["catalog"])
```

In `smplwise_vms/backend/smplwise/roles.json` add `"catalog.manage"` right after `"views.edit"` in the three roles `editor`, `site_admin` and `system_admin` (three edits: `"views.edit"\n      ]` → `"views.edit",\n        "catalog.manage"\n      ]` in `editor`; `"views.edit",\n        "site.content.configure",` → `"views.edit",\n        "catalog.manage",\n        "site.content.configure",` in `site_admin` and `system_admin`). Apply the same three edits to `contracts/examples/role-catalog.design.json`. Check: `MSYS_NO_PATHCONV=1 $PY -c "import json; r={x['id']: x['permissions'] for x in json.load(open('smplwise_vms/backend/smplwise/roles.json'))['roles']}; print([k for k in r if 'catalog.manage' in r[k]])"` → `['editor', 'site_admin', 'system_admin']`, and the same command on the contract file prints the same list.

In `smplwise_vms/backend/smplwise/routers/access.py` (`PERMISSION_LABELS`), after `    "views.edit": "עריכת תצוגות",` add:

```python
    "catalog.manage": "ניהול ספריית העצמים",
```

In `smplwise_vms/backend/smplwise/services/backup.py`, replace `"plan_versions", "plan_geometry", "map_anchors",` with `"plan_versions", "plan_geometry", "catalog_items", "map_anchors",` (the table has no foreign keys, so its place in the replace order is free).

In `smplwise_vms/backend/smplwise/routers/anchors.py` (`floor_map`), replace

```python
    from ..services import geometry_store

    geometry = None
```

with

```python
    from ..services import geometry_store, plan_catalog

    geometry = None
```

and in the return dict replace `        "geometry": geometry,` with

```python
        "geometry": geometry,
        "catalog_revision": plan_catalog.revision(conn),
```

- [ ] **Step 6: Run the tests to see them pass**

Run: `cd smplwise_vms/backend && MSYS_NO_PATHCONV=1 $PY -m pytest tests/test_plan_catalog.py tests/test_plan_catalog_api.py tests/test_rbac_matrix.py tests/test_rbac.py tests/test_custom_roles.py tests/test_plan_geometry_integration.py tests/test_backup.py -p no:cacheprovider`
Expected: all pass (`4 + 3 + matrix + rbac + custom roles + 8 integration + backup` — no failure; the summary line counts them).

- [ ] **Step 7: Commit**

```bash
cd /c/cloude/smplwisebms && git add smplwise_vms/backend/smplwise/routers/plan_catalog.py smplwise_vms/backend/smplwise/services/plan_catalog.py smplwise_vms/backend/smplwise/main.py smplwise_vms/backend/smplwise/roles.json contracts/examples/role-catalog.design.json smplwise_vms/backend/smplwise/routers/access.py smplwise_vms/backend/smplwise/services/backup.py smplwise_vms/backend/smplwise/routers/anchors.py smplwise_vms/backend/tests/test_plan_catalog_api.py smplwise_vms/backend/tests/test_rbac_matrix.py smplwise_vms/backend/tests/test_plan_geometry_integration.py
msg=$(mktemp) && cat > "$msg" <<'EOF'
feat(plan-studio): object library API with custom items, catalog.manage on the built-in roles, export and import, backups, catalog_revision in the map bundle (T085)

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOF
test "$(bash /c/cloude/smplwisebms/secrets/scan_staged.sh)" = 0 && git commit -F "$msg"
```

---
### Task 3: The document model — objects, groups, connectors, circuits: rules, normalization, anchor refresh

**Files:**
- Modify: `smplwise_vms/backend/smplwise/services/plan_geometry.py`
- Modify: `contracts/schemas/plan_geometry.v2.schema.json` (typed `object`, `group`, `connector`, `circuit` definitions)
- Modify: `smplwise_vms/backend/tests/test_plan_geometry_model.py` (`test_counts` expectation)
- Test: `smplwise_vms/backend/tests/test_plan_geometry_objects.py` (create)

**Interfaces:**
- Consumes: `plan_catalog.builtin()`, `plan_catalog.MIN_SIZE_M / MAX_SIZE_M / MIN_Z_M / MAX_Z_M / SHAPES` (Task 1).
- Produces (`plan_geometry.py`):
  - constants `CONNECTOR_KINDS = ("stairs", "ramp", "tribune", "elevator", "ladder")`, `GROUP_KINDS = ("array", "manual")`, `SWITCH_RE` (`^(switch|light)\.[a-z0-9_]+$`), `DERIVED_PREFIX = "cx-"`.
  - `validate(doc, items=None) -> list[issue]` — `items` is the item index (`plan_catalog.item_index(conn)`), default the built-in items; new geometric codes: `unknown_item` (error, blocks publishing), `size`, `z`, `unknown_level`, `unknown_group`, `anchor_ref`, `bounds`, `enum`, `confidence` on objects; `unknown_member`, `duplicate_member`, `enum` on groups; `enum`, `unknown_level`, `connector_levels`, `bounds`, `size`, `unknown_object` on connectors; `name`, `switch_entity`, `unknown_member`, `not_a_light` (warning), `power` on circuits.
  - `normalize(doc, items) -> dict` — recomputes every circuit's `power_w` from its members (`params.power_w`, else the item's default) and derives one connector `cx-<object id>` (kind `tribune` for a stepped item, else the item id's first segment when it is a connector kind, else `stairs`; `source: "auto"`, `object_id` set) for every object whose `params.connects_levels` names another level; derived connectors whose object is gone are dropped; manual connectors are kept; idempotent.
  - `apply_anchor_positions(doc, anchors) -> dict` — `anchors` maps `"<resource_type>:<resource_id>"` to `{x, y, rotation}`; bound objects take the anchor's position (rounded to 6) and rotation.
  - `object_axis(obj, width, height, scale) -> [[x, y], [x, y]]` — the depth axis of a footprint (back edge → front edge through the centre, along the rotation; 0° = up, clockwise).
  - `counts(doc)` → also `connectors`, `circuits`, `levels`, `groups`.
- Schema: `$defs.size`, `$defs.object`, `$defs.group`, `$defs.connector`, `$defs.circuit`; the collections reference them.

- [ ] **Step 1: Write the failing tests**

```python
"""Plan Studio document v2, phase 2 (T085): objects, groups, connectors and circuits have structural field rules
(a save is refused) and geometric rules (kept with the draft, block publishing) - a missing catalog item is geometric,
never structural; normalize() sums circuit power and derives a connector from a tribune that connects levels; the
body of an anchor takes the anchor's position; counts and the schema cover the new collections."""
from __future__ import annotations

import copy
import json
import pathlib

from smplwise.services import plan_catalog as cat
from smplwise.services import plan_geometry as pg

SCHEMA = pathlib.Path(__file__).resolve().parents[3] / "contracts" / "schemas" / "plan_geometry.v2.schema.json"
VERSION = {"id": "v1", "floor_id": "f1", "asset_id": "a1", "page": 1, "rotation": 0, "crop_json": None, "width_px": 1000, "height_px": 800,
           "scale_m_per_px": 0.01, "calibration_json": '{"method": "two_point", "pairs": [], "residual_pct": 0.0}'}


def _doc() -> dict:
    d = pg.new_document(VERSION, None)
    d["levels"].append({"id": "L1", "name": "אולם תחתון", "elevation_m": -1.2, "ceiling_height_m": 6.0, "is_default": False, "external_ids": {}})
    return d


def OBJ(oid: str, item: str = "chair.basic", pos=(0.2, 0.2), **kw) -> dict:
    o = {"id": oid, "item_id": item, "level_id": "L0", "position": list(pos), "rotation_deg": 0, "size": {"w_m": 0.45, "d_m": 0.45, "h_m": 0.85}, "z_m": 0, "params": {},
         "label": None, "anchor_ref": None, "group_id": None, "confidence": 1, "source": "manual", "locked": False, "external_ids": {}}
    o.update(kw)
    return o


def CONN(cid: str, **kw) -> dict:
    c = {"id": cid, "kind": "stairs", "level_from": "L0", "level_to": "L1", "floor_ids": [], "polyline": [[0.7, 0.7], [0.8, 0.7]], "width_m": 1.2, "label": None,
         "object_id": None, "source": "manual", "external_ids": {}}
    c.update(kw)
    return c


def _codes(doc) -> set[tuple[str, str | None]]:
    return {(i["code"], i["id"]) for i in pg.validate(doc) if not i["structural"]}


def _structural(doc) -> set[str]:
    return {i["path"] for i in pg.validate(doc) if i["structural"]}


def test_field_types_of_the_new_collections_are_structural():
    d = _doc()
    d["objects"] = [OBJ("o1", position="x", size=None, params=[], rotation_deg="north")]
    d["groups"] = [{"id": "g1", "kind": 3, "member_ids": "o1"}]
    d["connectors"] = [{"id": "c1", "kind": "stairs", "level_from": None, "floor_ids": "f", "polyline": "p", "width_m": "wide", "source": "manual"}]
    d["circuits"] = [{"id": "k1", "name": None, "switch_entity_id": 5, "member_ids": [1], "color_token": None}]
    paths = _structural(d)
    assert {"objects[0].position", "objects[0].size", "objects[0].params", "objects[0].rotation_deg", "groups[0].kind", "groups[0].member_ids",
            "connectors[0].level_from", "connectors[0].floor_ids", "connectors[0].polyline", "connectors[0].width_m",
            "circuits[0].name", "circuits[0].switch_entity_id", "circuits[0].member_ids", "circuits[0].color_token"} <= paths
    assert pg.validate(_doc()) == []


def test_object_rules_name_the_item_and_a_missing_catalog_item_blocks_only_publishing():
    d = _doc()
    d["objects"] = [OBJ("o1"), OBJ("o2", item="spaceship"), OBJ("o3", size={"w_m": 0.01, "d_m": 1, "h_m": 1}), OBJ("o4", position=(1.2, 0.5)), OBJ("o5", level_id="L9"),
                    OBJ("o6", group_id="g9"), OBJ("o7", z_m=900), OBJ("o8", anchor_ref={"resource_type": "camera"}), OBJ("o9", source="dreamed", confidence=2)]
    codes = _codes(d)
    assert ("unknown_item", "o2") in codes and not any(i["structural"] for i in pg.validate(d)), "a missing item is geometric, the save goes through"
    assert ("size", "o3") in codes and ("bounds", "o4") in codes and ("unknown_level", "o5") in codes and ("unknown_group", "o6") in codes
    assert ("z", "o7") in codes and ("anchor_ref", "o8") in codes and ("enum", "o9") in codes and ("confidence", "o9") in codes
    assert not any(c[1] == "o1" for c in codes)
    # a custom item known through the index passes; the same document without the index reports it missing
    d2 = _doc()
    d2["objects"] = [OBJ("o1", item="c-custom")]
    assert ("unknown_item", "o1") in _codes(d2)
    assert [i for i in pg.validate(d2, items={**cat.builtin()["items"], "c-custom": {"id": "c-custom", "role": "furniture"}}) if not i["structural"]] == []


def test_group_connector_and_circuit_rules():
    d = _doc()
    d["objects"] = [OBJ("o1"), OBJ("o2", item="light.ceiling", pos=(0.5, 0.3)), OBJ("o3", item="light.ceiling", pos=(0.6, 0.3))]
    d["groups"] = [{"id": "g1", "kind": "array", "member_ids": ["o1", "o9"], "params": {}}, {"id": "g2", "kind": "manual", "member_ids": ["o1"], "params": {}},
                   {"id": "g3", "kind": "cloud", "member_ids": [], "params": {}}]
    d["connectors"] = [CONN("c1"), CONN("c2", level_to="L0"), CONN("c3", level_to="L7"), CONN("c4", polyline=[[0.1, 0.1], [1.4, 0.1]]), CONN("c5", width_m=0.01),
                       CONN("c6", kind="teleport"), CONN("c7", level_to=None, floor_ids=[]), CONN("c8", level_to=None, floor_ids=["f-other"]), CONN("c9", object_id="o9")]
    d["circuits"] = [{"id": "k1", "name": "אולם", "switch_entity_id": "switch.hall", "member_ids": ["o2", "o3"], "color_token": "circuit-1", "power_w": 0},
                     {"id": "k2", "name": "", "switch_entity_id": "sensor.x", "member_ids": ["o1", "o9"], "color_token": "circuit-2", "power_w": -1}]
    codes = _codes(d)
    assert ("unknown_member", "g1") in codes and ("duplicate_member", "g2") in codes and ("enum", "g3") in codes
    assert ("connector_levels", "c2") in codes and ("unknown_level", "c3") in codes and ("bounds", "c4") in codes and ("size", "c5") in codes
    assert ("enum", "c6") in codes and ("connector_levels", "c7") in codes and ("unknown_object", "c9") in codes
    assert not any(c[1] in ("c1", "c8", "k1") for c in codes), "a cross-floor connector needs no level_to; the lamp circuit is fine"
    assert ("name", "k2") in codes and ("switch_entity", "k2") in codes and ("unknown_member", "k2") in codes and ("power", "k2") in codes
    assert [i["severity"] for i in pg.validate(d) if i["code"] == "not_a_light"] == ["warning"], "a chair on a circuit is only a warning"
    # limits stay structural
    big = _doc()
    big["objects"] = [OBJ(f"o{i}") for i in range(pg.LIMITS["objects"] + 1)]
    assert any(i["code"] == "limit" and i["structural"] for i in pg.validate(big))


def test_normalize_sums_circuit_power_and_derives_the_tribune_connector():
    d = _doc()
    d["objects"] = [OBJ("l1", item="light.ceiling", pos=(0.5, 0.3), size={"w_m": 0.4, "d_m": 0.4, "h_m": 0.1}, z_m=2.7),
                    OBJ("l2", item="light.ceiling", pos=(0.6, 0.3), size={"w_m": 0.4, "d_m": 0.4, "h_m": 0.1}, z_m=2.7, params={"power_w": 60}),
                    OBJ("t1", item="tribune.stepped", pos=(0.25, 0.6), rotation_deg=180, size={"w_m": 4, "d_m": 3, "h_m": 1.2},
                        params={"rows": 4, "step_height_m": 0.3, "step_width_m": 1.0, "connects_levels": "L1"})]
    d["circuits"] = [{"id": "k1", "name": "אולם", "switch_entity_id": "switch.hall", "member_ids": ["l1", "l2", "ghost"], "color_token": "circuit-1", "power_w": 0}]
    d["connectors"] = [CONN("c1")]
    items = cat.builtin()["items"]
    n = pg.normalize(d, items)
    assert n["circuits"][0]["power_w"] == 96, "36 from the item default + 60 from the object; a missing member counts nothing"
    assert [c["id"] for c in n["connectors"]] == ["c1", "cx-t1"]
    cx = n["connectors"][1]
    assert cx == {"id": "cx-t1", "kind": "tribune", "level_from": "L0", "level_to": "L1", "floor_ids": [], "polyline": [[0.25, 0.4125], [0.25, 0.7875]], "width_m": 4.0,
                  "label": None, "object_id": "t1", "source": "auto", "external_ids": {}}
    assert pg.normalize(n, items) == n, "idempotent"
    assert [i["code"] for i in pg.validate(n) if i["severity"] == "error"] == ["unknown_member"], "only the ghost member; the derived connector validates"
    assert d["connectors"] == [CONN("c1")] and d["circuits"][0]["power_w"] == 0, "the input is untouched"
    # the connector follows the object: no more connects_levels, no connector; stairs items derive their own kind
    gone = copy.deepcopy(n)
    gone["objects"][2]["params"]["connects_levels"] = None
    assert [c["id"] for c in pg.normalize(gone, items)["connectors"]] == ["c1"]
    ramp = copy.deepcopy(n)
    ramp["objects"][2].update({"item_id": "ramp.straight", "params": {"connects_levels": "L1"}})
    assert pg.normalize(ramp, items)["connectors"][1]["kind"] == "ramp"
    assert pg.object_axis(n["objects"][2], 1000, 800, 0.01) == [[0.25, 0.4125], [0.25, 0.7875]]
    assert pg.object_axis(dict(n["objects"][2], rotation_deg=90), 1000, 800, 0.01) == [[0.1, 0.6], [0.4, 0.6]]
    assert pg.normalize({"objects": "x"}, items) == {"objects": "x"}, "malformed input passes through"


def test_the_body_of_an_anchor_takes_the_anchor_position():
    d = _doc()
    d["objects"] = [OBJ("o1", item="light.ceiling", anchor_ref={"resource_type": "ha_entity", "resource_id": "light.store"}, rotation_deg=45),
                    OBJ("o2", item="light.ceiling", anchor_ref={"resource_type": "ha_entity", "resource_id": "light.gone"}), OBJ("o3")]
    moved = pg.apply_anchor_positions(d, {"ha_entity:light.store": {"x": 0.7123456789, "y": 0.25, "rotation": 90}})
    assert moved["objects"][0]["position"] == [0.712346, 0.25] and moved["objects"][0]["rotation_deg"] == 90
    assert moved["objects"][1]["position"] == [0.2, 0.2] and moved["objects"][2]["position"] == [0.2, 0.2]
    assert d["objects"][0]["position"] == [0.2, 0.2], "the input is untouched"


def test_counts_and_diff_cover_the_new_collections():
    d = _doc()
    d["objects"] = [OBJ("o1")]
    d["circuits"] = [{"id": "k1", "name": "x", "switch_entity_id": "switch.a", "member_ids": [], "color_token": "circuit-1", "power_w": 0}]
    d["connectors"] = [CONN("c1")]
    d["groups"] = [{"id": "g1", "kind": "manual", "member_ids": ["o1"], "params": {}}]
    assert pg.counts(d) == {"walls": 0, "openings": 0, "labels": 0, "objects": 1, "connectors": 1, "circuits": 1, "levels": 2, "groups": 1}
    diff = pg.diff(_doc(), d)
    assert set(diff["collections"]) == {"objects", "circuits", "connectors", "groups"} and diff["total"] == 4


def test_schema_file_types_the_new_collections():
    schema = json.loads(SCHEMA.read_text(encoding="utf-8"))
    defs = schema["$defs"]
    assert schema["properties"]["objects"]["items"] == {"$ref": "#/$defs/object"} and schema["properties"]["connectors"]["items"] == {"$ref": "#/$defs/connector"}
    assert schema["properties"]["circuits"]["items"] == {"$ref": "#/$defs/circuit"} and schema["properties"]["groups"]["items"] == {"$ref": "#/$defs/group"}
    assert set(defs["connector"]["properties"]["kind"]["enum"]) == set(pg.CONNECTOR_KINDS) and set(defs["group"]["properties"]["kind"]["enum"]) == set(pg.GROUP_KINDS)
    assert set(defs["object"]["required"]) >= {"id", "item_id", "level_id", "position", "rotation_deg", "size", "z_m", "params", "confidence", "source"}
    assert defs["size"]["properties"]["w_m"] == {"type": "number", "minimum": 0.05, "maximum": 100}
    assert defs["circuit"]["properties"]["switch_entity_id"]["pattern"] == pg.SWITCH_RE.pattern
```

In `smplwise_vms/backend/tests/test_plan_geometry_model.py`, replace the body of `test_counts` with:

```python
    assert pg.counts(_doc()) == {"walls": 2, "openings": 1, "labels": 1, "objects": 0, "connectors": 0, "circuits": 0, "levels": 1, "groups": 0}
```

- [ ] **Step 2: Run to see them fail**

Run: `cd smplwise_vms/backend && MSYS_NO_PATHCONV=1 $PY -m pytest tests/test_plan_geometry_objects.py tests/test_plan_geometry_model.py -p no:cacheprovider`
Expected: the 7 new tests FAIL (`AttributeError: CONNECTOR_KINDS`, missing codes, `normalize` not found), `test_counts` FAILS on the new keys; the rest of the model tests pass.

- [ ] **Step 3: The model (`services/plan_geometry.py`)**

Imports: replace `import math` with

```python
import math
import re
```

and after `from .plan_schema import canonical_json as canonical_json` add:

```python
from . import plan_catalog
```

Constants: after the `ANCHOR_TYPES = ("camera", "ha_entity")` line add:

```python
CONNECTOR_KINDS = ("stairs", "ramp", "tribune", "elevator", "ladder")
GROUP_KINDS = ("array", "manual")
SWITCH_RE = re.compile(r"^(switch|light)\.[a-z0-9_]+$")
DERIVED_PREFIX = "cx-"  # the connector derived from an object that connects levels: cx-<object id>
```

Replace the `counts` function with:

```python
def counts(doc: Mapping[str, Any]) -> dict[str, int]:
    return {c: len(doc.get(c) or []) for c in ("walls", "openings", "labels", "objects", "connectors", "circuits", "levels", "groups")}
```

Replace the signature and the tail of `validate`: the line `def validate(doc: Any) -> list[dict[str, Any]]:` becomes

```python
def validate(doc: Any, items: Mapping[str, Mapping[str, Any]] | None = None) -> list[dict[str, Any]]:
    """`items` is the library index (plan_catalog.item_index(conn): built-in + custom); without it only the built-in
    items are known, so a custom item reads as missing - the routers always pass the index."""
```

and the block

```python
    _check_labels(doc["labels"], levels, issues)
    _check_rooms(doc["rooms"], levels, issues)
```

becomes

```python
    _check_labels(doc["labels"], levels, issues)
    _check_rooms(doc["rooms"], levels, issues)
    known = plan_catalog.builtin()["items"] if items is None else items
    group_ids = {g["id"] for g in doc["groups"]}
    objects = _check_objects(doc["objects"], levels, group_ids, known, issues)
    _check_groups(doc["groups"], objects, issues)
    _check_connectors(doc["connectors"], levels, objects, issues)
    _check_circuits(doc["circuits"], objects, known, issues)
```

In `_check_fields`, replace the closing comment line `    # objects, circuits, connectors, groups, uncertain_regions: no field rules in phase 1` with:

```python
    elif coll == "objects":
        req("item_id", isinstance(item.get("item_id"), str))
        req("level_id", isinstance(item.get("level_id"), str))
        req("position", _finite_point(item.get("position")))
        req("rotation_deg", _num(item.get("rotation_deg")))
        size = item.get("size")
        req("size", isinstance(size, dict) and all(_num(size.get(k)) for k in ("w_m", "d_m", "h_m")))
        req("z_m", _num(item.get("z_m")))
        req("params", isinstance(item.get("params"), dict))
        opt("label", lambda v: isinstance(v, str))
        opt("anchor_ref", lambda v: isinstance(v, dict))
        opt("group_id", lambda v: isinstance(v, str))
        req("confidence", _num(item.get("confidence")))
        req("source", isinstance(item.get("source"), str))
        opt("locked", lambda v: isinstance(v, bool))
        opt("external_ids", lambda v: isinstance(v, dict))
    elif coll == "groups":
        req("kind", isinstance(item.get("kind"), str))
        req("member_ids", isinstance(item.get("member_ids"), list) and all(isinstance(m, str) for m in item["member_ids"]))
        opt("params", lambda v: isinstance(v, dict))
        opt("label", lambda v: isinstance(v, str))
    elif coll == "connectors":
        req("kind", isinstance(item.get("kind"), str))
        req("level_from", isinstance(item.get("level_from"), str))
        opt("level_to", lambda v: isinstance(v, str))
        req("floor_ids", isinstance(item.get("floor_ids"), list) and all(isinstance(f, str) for f in item["floor_ids"]))
        pl = item.get("polyline")
        req("polyline", isinstance(pl, list) and all(_finite_point(p) for p in pl))
        req("width_m", _num(item.get("width_m")))
        opt("label", lambda v: isinstance(v, str))
        opt("object_id", lambda v: isinstance(v, str))
        req("source", isinstance(item.get("source"), str))
        opt("external_ids", lambda v: isinstance(v, dict))
    elif coll == "circuits":
        req("name", isinstance(item.get("name"), str))
        req("switch_entity_id", isinstance(item.get("switch_entity_id"), str))
        req("member_ids", isinstance(item.get("member_ids"), list) and all(isinstance(m, str) for m in item["member_ids"]))
        req("color_token", isinstance(item.get("color_token"), str))
        opt("power_w", _num)
    # uncertain_regions: no field rules yet (phase 3, detection)
```

After `_check_rooms` add the four geometric checks:

```python
def _check_objects(objects: list[dict[str, Any]], levels: set[str], groups: set[str], items: Mapping[str, Mapping[str, Any]], issues: list[dict[str, Any]]) -> dict[str, dict[str, Any]]:
    """Objects: the item must exist (a custom item deleted meanwhile blocks publishing, not the save), the position
    inside the plan, sizes 0.05..100 m, the level and the group known, an anchor_ref well formed."""
    ok: dict[str, dict[str, Any]] = {}
    for o in objects:
        oid = o["id"]
        if o["item_id"] not in items:
            _issue(issues, "unknown_item", f"הפריט {o['item_id']} לא קיים בספרייה.", item=oid, path="objects")
        if not _pt(o["position"]):
            _issue(issues, "bounds", "מיקום העצם מחוץ לתוכנית.", item=oid, path="objects")
        size = o["size"]
        if not all(plan_catalog.MIN_SIZE_M <= size[k] <= plan_catalog.MAX_SIZE_M for k in ("w_m", "d_m", "h_m")):
            _issue(issues, "size", f"מידות העצם בין {plan_catalog.MIN_SIZE_M} ל־{plan_catalog.MAX_SIZE_M:g} מ׳.", item=oid, path="objects")
        if not plan_catalog.MIN_Z_M <= o["z_m"] <= plan_catalog.MAX_Z_M:
            _issue(issues, "z", "גובה העצם בין מינוס 50 ל־500 מ׳.", item=oid, path="objects")
        if o["level_id"] not in levels:
            _issue(issues, "unknown_level", "העצם שייך למפלס שלא קיים.", item=oid, path="objects")
        if o.get("group_id") is not None and o["group_id"] not in groups:
            _issue(issues, "unknown_group", "העצם שייך לקבוצה שלא קיימת.", item=oid, path="objects")
        ref = o.get("anchor_ref")
        if ref is not None and not (ref.get("resource_type") in ANCHOR_TYPES and isinstance(ref.get("resource_id"), str) and ref["resource_id"]):
            _issue(issues, "anchor_ref", "anchor_ref צריך resource_type ו־resource_id.", item=oid, path="objects")
        if o["source"] not in SOURCES:
            _issue(issues, "enum", "מקור (source) לא מוכר.", item=oid, path="objects")
        if not _unit(o["confidence"]):
            _issue(issues, "confidence", "confidence בין 0 ל־1.", item=oid, path="objects")
        ok[oid] = o
    return ok


def _check_groups(groups: list[dict[str, Any]], objects: dict[str, dict[str, Any]], issues: list[dict[str, Any]]) -> None:
    seen: dict[str, str] = {}
    for g in groups:
        gid = g["id"]
        if g["kind"] not in GROUP_KINDS:
            _issue(issues, "enum", "סוג קבוצה לא מוכר.", item=gid, path="groups")
        for mid in g["member_ids"]:
            if mid not in objects:
                _issue(issues, "unknown_member", f"הקבוצה מפנה לעצם {mid} שלא קיים.", item=gid, path="groups")
            elif mid in seen:
                _issue(issues, "duplicate_member", f"העצם {mid} שייך לשתי קבוצות ({seen[mid]}, {gid}).", item=gid, path="groups")
            else:
                seen[mid] = gid


def _check_connectors(connectors: list[dict[str, Any]], levels: set[str], objects: dict[str, dict[str, Any]], issues: list[dict[str, Any]]) -> None:
    """A connector joins two different levels of this floor, or this floor with another (level_to empty, floor_ids set)."""
    for c in connectors:
        cid = c["id"]
        if c["kind"] not in CONNECTOR_KINDS or c["source"] not in SOURCES:
            _issue(issues, "enum", "סוג מחבר או מקור לא מוכרים.", item=cid, path="connectors")
        if c["level_from"] not in levels or (c.get("level_to") is not None and c["level_to"] not in levels):
            _issue(issues, "unknown_level", "המחבר מפנה למפלס שלא קיים.", item=cid, path="connectors")
        elif c.get("level_to") == c["level_from"] or (c.get("level_to") is None and not c["floor_ids"]):
            _issue(issues, "connector_levels", "מחבר חייב לחבר שני מפלסים שונים, או קומה אחרת.", item=cid, path="connectors")
        if len(c["polyline"]) < 2 or not all(_pt(p) for p in c["polyline"]):
            _issue(issues, "bounds", "למחבר צריך לפחות שתי נקודות בתוך התוכנית.", item=cid, path="connectors")
        if not plan_catalog.MIN_SIZE_M <= c["width_m"] <= plan_catalog.MAX_SIZE_M:
            _issue(issues, "size", "רוחב המחבר בין 0.05 ל־100 מ׳.", item=cid, path="connectors")
        if c.get("object_id") is not None and c["object_id"] not in objects:
            _issue(issues, "unknown_object", "המחבר נגזר מעצם שלא קיים.", item=cid, path="connectors")


def _check_circuits(circuits: list[dict[str, Any]], objects: dict[str, dict[str, Any]], items: Mapping[str, Mapping[str, Any]], issues: list[dict[str, Any]]) -> None:
    for k in circuits:
        kid = k["id"]
        if not 1 <= len(k["name"].strip()) <= 80:
            _issue(issues, "name", "למעגל צריך שם (עד 80 תווים).", item=kid, path="circuits")
        if not SWITCH_RE.match(k["switch_entity_id"]):
            _issue(issues, "switch_entity", "ישות המפסק חייבת להיות switch.* או light.*.", item=kid, path="circuits")
        for mid in k["member_ids"]:
            o = objects.get(mid)
            if o is None:
                _issue(issues, "unknown_member", f"המעגל מפנה לעצם {mid} שלא קיים.", item=kid, path="circuits")
            elif (items.get(o["item_id"]) or {}).get("role", "light") != "light":
                _issue(issues, "not_a_light", f"העצם {mid} אינו גוף תאורה.", item=kid, path="circuits", severity="warning")
        p = k.get("power_w")
        if p is not None and p < 0:
            _issue(issues, "power", "הספק המעגל אינו יכול להיות שלילי.", item=kid, path="circuits")
```

Append at the end of the file (after `prune_unfit`):

```python
# ---------------------------------------------------------------- normalization (phase 2)

def object_axis(obj: Mapping[str, Any], width: float, height: float, scale: float) -> list[list[float]]:
    """The depth axis of an object's footprint in normalized plan space: from its back edge to its front edge through
    the centre, along its rotation (0 = up, clockwise). A tribune's derived connector runs along it."""
    cx, cy = float(obj["position"][0]) * width, float(obj["position"][1]) * height
    theta = math.radians(float(obj.get("rotation_deg") or 0))
    dx, dy = math.sin(theta), -math.cos(theta)
    hd = float(obj["size"]["d_m"]) / scale / 2
    pts = [(cx - dx * hd, cy - dy * hd), (cx + dx * hd, cy + dy * hd)]
    return [[round(min(1.0, max(0.0, x / width)), 6) + 0.0, round(min(1.0, max(0.0, y / height)), 6) + 0.0] for x, y in pts]


def _derived_kind(item: Mapping[str, Any] | None, item_id: Any) -> str:
    if item is not None and item.get("shape") == "stepped":
        return "tribune"
    first = str(item_id or "").split(".", 1)[0]
    return first if first in CONNECTOR_KINDS else "stairs"


def normalize(doc: Mapping[str, Any], items: Mapping[str, Mapping[str, Any]]) -> dict[str, Any]:
    """What the server recomputes on every draft save and publish, from the document alone: each circuit's power
    (the members' params.power_w, else their item's default) and one derived connector per object that connects
    levels (a tribune, stairs, a ramp...: params.connects_levels names the other level). Derived connectors carry the
    object id and are regenerated every time, so the result is idempotent; manual connectors are kept. Malformed
    data passes through untouched (it already failed validation)."""
    out = copy.deepcopy(dict(doc))
    objects = out.get("objects")
    if not isinstance(objects, list):
        return out
    by_id = {o["id"]: o for o in objects if isinstance(o, dict) and isinstance(o.get("id"), str)}
    circuits = out.get("circuits")
    if isinstance(circuits, list):
        for c in circuits:
            if not isinstance(c, dict) or not isinstance(c.get("member_ids"), list):
                continue
            total = 0.0
            for mid in c["member_ids"]:
                o = by_id.get(mid)
                if o is None:
                    continue
                params = o.get("params") if isinstance(o.get("params"), dict) else {}
                w = params.get("power_w")
                if not _num(w):
                    item = items.get(o.get("item_id"))
                    w = (item.get("params") or {}).get("power_w") if item else None
                if _num(w):
                    total += float(w)
            c["power_w"] = round(total, 3)
    dims = out.get("dimensions") if isinstance(out.get("dimensions"), dict) else {}
    width, height = dims.get("width_px"), dims.get("height_px")
    derived: dict[str, dict[str, Any]] = {}
    if _num(width) and width > 0 and _num(height) and height > 0:
        scale, _ = effective_scale(out)
        for o in objects:
            if not isinstance(o, dict) or not isinstance(o.get("id"), str):
                continue
            params = o.get("params") if isinstance(o.get("params"), dict) else {}
            target = params.get("connects_levels")
            size = o.get("size")
            if not (isinstance(target, str) and target and target != o.get("level_id") and _finite_point(o.get("position")) and isinstance(size, dict)
                    and _num(size.get("d_m")) and _num(size.get("w_m")) and _num(o.get("rotation_deg", 0))):
                continue
            cid = DERIVED_PREFIX + o["id"]
            derived[cid] = {"id": cid, "kind": _derived_kind(items.get(o.get("item_id")), o.get("item_id")), "level_from": o.get("level_id"), "level_to": target, "floor_ids": [],
                            "polyline": object_axis(o, width, height, scale), "width_m": float(size["w_m"]), "label": None, "object_id": o["id"], "source": "auto", "external_ids": {}}
    connectors = out.get("connectors")
    if isinstance(connectors, list):
        kept = [c for c in connectors if not (isinstance(c, dict) and isinstance(c.get("object_id"), str))]
        out["connectors"] = kept + [derived[k] for k in sorted(derived)]
    return out


def apply_anchor_positions(doc: Mapping[str, Any], anchors: Mapping[str, Mapping[str, Any]]) -> dict[str, Any]:
    """The body follows its anchor: an object whose anchor_ref names an anchor in `anchors` ("<type>:<id>" -> {x, y,
    rotation}) takes the anchor's position and rotation. The store runs it on every save and publish; the maps run
    it with the live positions they hold. An object whose anchor is missing keeps what it has (deleting an anchor
    un-binds its body through the anchor route)."""
    out = copy.deepcopy(dict(doc))
    objects = out.get("objects")
    if not isinstance(objects, list):
        return out
    for o in objects:
        ref = o.get("anchor_ref") if isinstance(o, dict) else None
        if not isinstance(ref, dict):
            continue
        a = anchors.get(f"{ref.get('resource_type')}:{ref.get('resource_id')}")
        if a is None or not (_num(a.get("x")) and _num(a.get("y"))):
            continue
        o["position"] = [round(float(a["x"]), 6), round(float(a["y"]), 6)]
        o["rotation_deg"] = round(float(a.get("rotation") or 0), 3)
    return out
```

- [ ] **Step 4: The schema file**

Replace the whole of `contracts/schemas/plan_geometry.v2.schema.json` with:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://smplwise.local/contracts/plan_geometry.v2.schema.json",
  "title": "SMPLWISE plan geometry document v2 (Plan Studio, T084 / T085, CR-003)",
  "description": "The structure layer of one plan version: walls, openings, labels, levels, objects from the library, groups, connectors and lighting circuits. Coordinates are normalized 0..1 to the plan version image (origin top-left), points are [x, y]; sizes are metres; the server owns plan_version_id, floor_id, source, dimensions and transform, recomputes circuit power and the connectors derived from objects that connect levels, and refreshes the position of an object bound to an anchor.",
  "type": "object",
  "required": ["schema_version", "plan_version_id", "floor_id", "source", "dimensions", "transform", "levels", "walls", "openings", "rooms", "objects", "circuits", "connectors", "labels", "groups", "uncertain_regions", "uncertainty", "meta"],
  "properties": {
    "schema_version": {"const": "2.0"},
    "plan_version_id": {"type": "string"},
    "floor_id": {"type": "string"},
    "source": {"type": "object", "required": ["sha256", "page"], "properties": {"sha256": {"type": "string", "pattern": "^[0-9a-f]{64}$"}, "file_name": {"type": "string"}, "mime": {"type": "string"}, "page": {"type": "integer", "minimum": 1}}},
    "dimensions": {"type": "object", "required": ["width_px", "height_px", "scale_m_per_px", "calibration"], "properties": {"width_px": {"type": "integer", "minimum": 1, "maximum": 100000}, "height_px": {"type": "integer", "minimum": 1, "maximum": 100000}, "scale_m_per_px": {"type": ["number", "null"], "exclusiveMinimum": 0}, "calibration": {"$ref": "#/$defs/calibration"}}},
    "transform": {"type": "object", "required": ["rotation"], "properties": {"rotation": {"enum": [0, 90, 180, 270]}, "crop": {"type": ["object", "null"]}}},
    "levels": {"type": "array", "minItems": 1, "maxItems": 20, "items": {"$ref": "#/$defs/level"}},
    "walls": {"type": "array", "maxItems": 2000, "items": {"$ref": "#/$defs/wall"}},
    "openings": {"type": "array", "maxItems": 4000, "items": {"$ref": "#/$defs/opening"}},
    "rooms": {"type": "array", "maxItems": 500, "items": {"$ref": "#/$defs/room"}},
    "objects": {"type": "array", "maxItems": 5000, "items": {"$ref": "#/$defs/object"}},
    "circuits": {"type": "array", "maxItems": 500, "items": {"$ref": "#/$defs/circuit"}},
    "connectors": {"type": "array", "maxItems": 200, "items": {"$ref": "#/$defs/connector"}},
    "labels": {"type": "array", "maxItems": 1000, "items": {"$ref": "#/$defs/label"}},
    "groups": {"type": "array", "maxItems": 500, "items": {"$ref": "#/$defs/group"}},
    "uncertain_regions": {"type": "array", "maxItems": 200, "items": {"$ref": "#/$defs/item"}},
    "uncertainty": {"type": "object", "required": ["overall", "notes"], "properties": {"overall": {"$ref": "#/$defs/unit"}, "notes": {"type": "array", "items": {"type": "string"}}}},
    "meta": {"type": "object"}
  },
  "$defs": {
    "unit": {"type": "number", "minimum": 0, "maximum": 1},
    "point": {"type": "array", "prefixItems": [{"$ref": "#/$defs/unit"}, {"$ref": "#/$defs/unit"}], "minItems": 2, "maxItems": 2},
    "id": {"type": "string", "minLength": 1, "maxLength": 64},
    "external_ids": {"type": "object", "additionalProperties": {"type": "string"}},
    "source": {"enum": ["manual", "auto", "imported"]},
    "anchor_ref": {"type": ["object", "null"], "required": ["resource_type", "resource_id"], "properties": {"resource_type": {"enum": ["camera", "ha_entity"]}, "resource_id": {"type": "string", "minLength": 1}}},
    "calibration": {"type": "object", "required": ["status"], "properties": {"status": {"enum": ["measured", "estimated", "missing"]}, "method": {"enum": ["two_point", "dxf_units", "door_width", "manual", "carried", null]}, "pairs": {"type": "array", "items": {"type": "object", "required": ["a", "b", "metres"], "properties": {"a": {"$ref": "#/$defs/point"}, "b": {"$ref": "#/$defs/point"}, "metres": {"type": "number", "exclusiveMinimum": 0}}}}, "residual_pct": {"type": ["number", "null"]}, "reason": {"type": ["string", "null"]}}},
    "size": {"type": "object", "required": ["w_m", "d_m", "h_m"], "properties": {"w_m": {"type": "number", "minimum": 0.05, "maximum": 100}, "d_m": {"type": "number", "minimum": 0.05, "maximum": 100}, "h_m": {"type": "number", "minimum": 0.05, "maximum": 100}}},
    "level": {"type": "object", "required": ["id", "name", "elevation_m", "ceiling_height_m", "is_default"], "properties": {"id": {"$ref": "#/$defs/id"}, "name": {"type": "string", "minLength": 1}, "elevation_m": {"type": "number", "minimum": -50, "maximum": 500}, "ceiling_height_m": {"type": "number", "exclusiveMinimum": 0, "maximum": 50}, "is_default": {"type": "boolean"}, "external_ids": {"$ref": "#/$defs/external_ids"}}},
    "wall": {"type": "object", "required": ["id", "level_id", "polyline", "thickness_m", "kind", "confidence", "source"], "properties": {"id": {"$ref": "#/$defs/id"}, "level_id": {"type": "string"}, "polyline": {"type": "array", "minItems": 2, "items": {"$ref": "#/$defs/point"}}, "thickness_m": {"type": "number", "exclusiveMinimum": 0, "maximum": 3}, "height_m": {"type": ["number", "null"]}, "base_z_m": {"type": "number"}, "kind": {"enum": ["exterior", "interior", "partition", "railing", "low"]}, "confidence": {"$ref": "#/$defs/unit"}, "source": {"$ref": "#/$defs/source"}, "locked": {"type": "boolean"}, "external_ids": {"$ref": "#/$defs/external_ids"}}},
    "opening": {"type": "object", "required": ["id", "wall_id", "t", "kind", "width_m", "height_m", "sill_m", "swing", "hinge", "confidence", "source"], "properties": {"id": {"$ref": "#/$defs/id"}, "wall_id": {"type": "string"}, "t": {"$ref": "#/$defs/unit"}, "kind": {"enum": ["door", "window", "passage"]}, "width_m": {"type": "number", "exclusiveMinimum": 0, "maximum": 10}, "height_m": {"type": "number", "exclusiveMinimum": 0, "maximum": 10}, "sill_m": {"type": "number", "minimum": 0, "maximum": 10}, "swing": {"enum": ["left", "right", "double", "sliding", "none"]}, "hinge": {"enum": ["start", "end"]}, "anchor_ref": {"$ref": "#/$defs/anchor_ref"}, "confidence": {"$ref": "#/$defs/unit"}, "source": {"$ref": "#/$defs/source"}, "external_ids": {"$ref": "#/$defs/external_ids"}}},
    "room": {"type": "object", "required": ["id"], "properties": {"id": {"$ref": "#/$defs/id"}, "level_id": {"type": ["string", "null"]}, "ceiling_height_m": {"type": ["number", "null"]}, "external_ids": {"$ref": "#/$defs/external_ids"}}},
    "label": {"type": "object", "required": ["id", "text", "position", "level_id", "size"], "properties": {"id": {"$ref": "#/$defs/id"}, "text": {"type": "string", "minLength": 1, "maxLength": 80}, "position": {"$ref": "#/$defs/point"}, "level_id": {"type": "string"}, "size": {"type": "number", "minimum": 6, "maximum": 200}}},
    "object": {"type": "object", "required": ["id", "item_id", "level_id", "position", "rotation_deg", "size", "z_m", "params", "confidence", "source"], "properties": {"id": {"$ref": "#/$defs/id"}, "item_id": {"type": "string", "minLength": 1, "maxLength": 64}, "level_id": {"type": "string"}, "position": {"$ref": "#/$defs/point"}, "rotation_deg": {"type": "number"}, "size": {"$ref": "#/$defs/size"}, "z_m": {"type": "number", "minimum": -50, "maximum": 500}, "params": {"type": "object"}, "label": {"type": ["string", "null"], "maxLength": 80}, "anchor_ref": {"$ref": "#/$defs/anchor_ref"}, "group_id": {"type": ["string", "null"]}, "confidence": {"$ref": "#/$defs/unit"}, "source": {"$ref": "#/$defs/source"}, "locked": {"type": "boolean"}, "external_ids": {"$ref": "#/$defs/external_ids"}}},
    "group": {"type": "object", "required": ["id", "kind", "member_ids"], "properties": {"id": {"$ref": "#/$defs/id"}, "kind": {"enum": ["array", "manual"]}, "member_ids": {"type": "array", "maxItems": 5000, "items": {"type": "string"}}, "params": {"type": "object"}, "label": {"type": ["string", "null"], "maxLength": 80}}},
    "connector": {"type": "object", "required": ["id", "kind", "level_from", "floor_ids", "polyline", "width_m", "source"], "properties": {"id": {"$ref": "#/$defs/id"}, "kind": {"enum": ["stairs", "ramp", "tribune", "elevator", "ladder"]}, "level_from": {"type": "string"}, "level_to": {"type": ["string", "null"]}, "floor_ids": {"type": "array", "items": {"type": "string"}}, "polyline": {"type": "array", "minItems": 2, "items": {"$ref": "#/$defs/point"}}, "width_m": {"type": "number", "minimum": 0.05, "maximum": 100}, "label": {"type": ["string", "null"], "maxLength": 80}, "object_id": {"type": ["string", "null"]}, "source": {"$ref": "#/$defs/source"}, "external_ids": {"$ref": "#/$defs/external_ids"}}},
    "circuit": {"type": "object", "required": ["id", "name", "switch_entity_id", "member_ids", "color_token"], "properties": {"id": {"$ref": "#/$defs/id"}, "name": {"type": "string", "minLength": 1, "maxLength": 80}, "switch_entity_id": {"type": "string", "pattern": "^(switch|light)\\.[a-z0-9_]+$"}, "member_ids": {"type": "array", "items": {"type": "string"}}, "color_token": {"type": "string", "maxLength": 40}, "power_w": {"type": "number", "minimum": 0}}},
    "item": {"type": "object", "required": ["id"], "properties": {"id": {"$ref": "#/$defs/id"}}}
  }
}
```

- [ ] **Step 5: Run the tests to see them pass**

Run: `cd smplwise_vms/backend && MSYS_NO_PATHCONV=1 $PY -m pytest tests/test_plan_geometry_objects.py tests/test_plan_geometry_model.py tests/test_plan_geometry_render.py tests/test_plan_geometry_store.py tests/test_plan_geometry_api.py -p no:cacheprovider`
Expected: all pass (7 new + the phase-1 files; the render file still validates the unchanged sample).

- [ ] **Step 6: Commit**

```bash
cd /c/cloude/smplwisebms && git add smplwise_vms/backend/smplwise/services/plan_geometry.py contracts/schemas/plan_geometry.v2.schema.json smplwise_vms/backend/tests/test_plan_geometry_model.py smplwise_vms/backend/tests/test_plan_geometry_objects.py
msg=$(mktemp) && cat > "$msg" <<'EOF'
feat(plan-studio): document rules for objects, groups, connectors and circuits, circuit power and derived tribune connectors, anchor position refresh (T085)

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOF
test "$(bash /c/cloude/smplwisebms/secrets/scan_staged.sh)" = 0 && git commit -F "$msg"
```

---
### Task 4: Object and connector primitives, the 24 symbols, SVG / PNG with `?layers=`, the extended golden

**Files:**
- Create: `smplwise_vms/backend/smplwise/services/plan_symbols.py`
- Modify: `smplwise_vms/backend/smplwise/services/plan_geometry_render.py`
- Modify: `smplwise_vms/backend/smplwise/services/geometry_store.py` (append `anchor_positions`)
- Modify: `smplwise_vms/backend/smplwise/routers/plan_geometry.py` (`?layers=`, anchors and the catalog in the exports)
- Modify: `contracts/fixtures/plan_geometry/sample-v2.json` (objects, groups, connectors, circuits), regenerate `sample-v2.primitives.json`
- Modify: `smplwise_vms/backend/tests/test_plan_geometry_render.py` (`test_level_filter`, `test_input_order_does_not_matter`)
- Test: `smplwise_vms/backend/tests/test_plan_geometry_render2.py` (create)

**Interfaces:**
- Consumes: `pg.apply_anchor_positions`, `pg.effective_scale`, `plan_catalog.builtin / item_index` (Tasks 1, 3).
- Produces:
  - `plan_symbols.SYMBOLS: dict[str, str]` (24 ids → inner SVG markup in a 24 × 24 box), `symbol_markup(icon)`.
  - `render.structure_primitives(doc, width, height, level=None, items=None)` → the phase-1 list followed by connectors (sorted by id, never filtered by level) then objects (sorted by id, filtered by level): `{"kind": "connector", id, ckind, points, width, arrow {from, to}, label, lx, ly, level_from, level_to}` and `{"kind": "object", id, item_id, shape, icon, color, level_id, cx, cy, w, h, rotation, corners [4 points], label, circuit_id, anchor, steps [[p, p]...]}`; `render.connector_label(levels, c)`; constants `LAYERS = ("structure", "objects", "labels", "connectors")`, `OBJECT_COLORS`, `CIRCUIT_COLORS`, `ARROW_PX = 14.0`.
  - `render.render_svg(doc, zones, width, height, *, level=None, labels=True, rooms=True, layers=None, anchors=None, items=None)` and `render.render_png(..., layers=None, anchors=None, items=None)`; SVG DOM: `<g id="connectors">` with `<path data-connector=id data-kind=ckind>` + `<path data-connector-arrow=id>` + `<text data-connector-label=id>`; `<g id="objects">` with `<polygon|ellipse data-object=id data-item=item_id>`, step `<path data-object-step=id>`, `<g data-symbol=icon>` and `<text data-object-label=id>`.
  - `geometry_store.anchor_positions(conn, floor_id) -> dict["<type>:<id>", {x, y, rotation}]`.
  - `GET …/export.svg|png?layers=structure,objects,labels,connectors` (any subset; an unknown name → 422 `validation`); both exports pass the floor's live anchors and the library.
  - Golden: `sample-v2.primitives.json` with 24 primitives in `all` and 7 in `level_L1`.

- [ ] **Step 1: Extend the sample fixture**

In `contracts/fixtures/plan_geometry/sample-v2.json` replace the four lines

```json
  "rooms": [],
  "objects": [],
  "circuits": [],
  "connectors": [],
```

with

```json
  "rooms": [],
  "objects": [
    {"id": "o1", "item_id": "chair.basic", "level_id": "L0", "position": [0.2, 0.2], "rotation_deg": 0, "size": {"w_m": 0.45, "d_m": 0.45, "h_m": 0.85}, "z_m": 0, "params": {}, "label": null, "anchor_ref": null, "group_id": "g1", "confidence": 1, "source": "manual", "locked": false, "external_ids": {}},
    {"id": "o2", "item_id": "table.desk", "level_id": "L0", "position": [0.3, 0.4], "rotation_deg": 90, "size": {"w_m": 1.4, "d_m": 0.7, "h_m": 0.75}, "z_m": 0, "params": {}, "label": "שולחן", "anchor_ref": null, "group_id": "g1", "confidence": 1, "source": "manual", "locked": false, "external_ids": {}},
    {"id": "o3", "item_id": "light.ceiling", "level_id": "L0", "position": [0.5, 0.3], "rotation_deg": 0, "size": {"w_m": 0.4, "d_m": 0.4, "h_m": 0.1}, "z_m": 2.7, "params": {}, "label": null, "anchor_ref": {"resource_type": "ha_entity", "resource_id": "light.store"}, "group_id": null, "confidence": 1, "source": "manual", "locked": false, "external_ids": {}},
    {"id": "o4", "item_id": "tribune.stepped", "level_id": "L0", "position": [0.25, 0.6], "rotation_deg": 180, "size": {"w_m": 4, "d_m": 3, "h_m": 1.2}, "z_m": 0, "params": {"rows": 4, "step_height_m": 0.3, "step_width_m": 1.0, "connects_levels": "L1"}, "label": null, "anchor_ref": null, "group_id": null, "confidence": 1, "source": "manual", "locked": false, "external_ids": {}},
    {"id": "o5", "item_id": "extinguisher.co2", "level_id": "L1", "position": [0.15, 0.8], "rotation_deg": 0, "size": {"w_m": 0.2, "d_m": 0.2, "h_m": 0.6}, "z_m": 0.9, "params": {}, "label": "מטף", "anchor_ref": null, "group_id": null, "confidence": 1, "source": "manual", "locked": false, "external_ids": {}}
  ],
  "circuits": [
    {"id": "k1", "name": "מעגל אולם", "switch_entity_id": "switch.hall_a", "member_ids": ["o3"], "color_token": "circuit-1", "power_w": 36}
  ],
  "connectors": [
    {"id": "c1", "kind": "stairs", "level_from": "L0", "level_to": "L1", "floor_ids": [], "polyline": [[0.7, 0.7], [0.8, 0.7]], "width_m": 1.2, "label": null, "object_id": null, "source": "manual", "external_ids": {}},
    {"id": "cx-o4", "kind": "tribune", "level_from": "L0", "level_to": "L1", "floor_ids": [], "polyline": [[0.25, 0.4125], [0.25, 0.7875]], "width_m": 4.0, "label": null, "object_id": "o4", "source": "auto", "external_ids": {}}
  ],
```

and replace `  "groups": [],` with

```json
  "groups": [
    {"id": "g1", "kind": "manual", "member_ids": ["o1", "o2"], "params": {}, "label": null}
  ],
```

- [ ] **Step 2: Write the failing tests**

`smplwise_vms/backend/tests/test_plan_geometry_render2.py`:

```python
"""Plan Studio drawing, phase 2 (T085): objects are rotated footprints with a symbol id (a cylinder keeps its square
box), a stepped tribune carries its step lines, connectors run along their polyline with an arrow and a level delta
label, the level filter keeps connectors, a bound body follows its anchor, the golden file pins 24 primitives, the
SVG draws every layer and honours ?layers=, the PNG draws footprints, the routes accept the layer list."""
from __future__ import annotations

import io
import json
import pathlib
import xml.etree.ElementTree as ET

from conftest import png_bytes, seed_tree
from fastapi.testclient import TestClient
from PIL import Image

from smplwise.main import create_app
from smplwise.services import plan_catalog as cat
from smplwise.services import plan_geometry as pg
from smplwise.services import plan_geometry_render as render
from smplwise.services import plan_symbols

FIX = pathlib.Path(__file__).resolve().parents[3] / "contracts" / "fixtures" / "plan_geometry"


def _sample() -> dict:
    return json.loads((FIX / "sample-v2.json").read_text(encoding="utf-8"))


def _by_id(prims, pid):
    return next(p for p in prims if p["id"] == pid)


def test_the_sample_is_normalized_and_valid():
    doc = _sample()
    assert pg.normalize(doc, cat.builtin()["items"]) == doc, "the derived tribune connector in the fixture is exactly what normalize produces"
    assert [i for i in pg.validate(doc) if i["severity"] == "error"] == []


def test_object_primitives_are_rotated_footprints_with_a_symbol():
    prims = render.structure_primitives(_sample(), 1000, 800)
    assert [p["kind"] for p in prims] == ["wall"] * 9 + ["door", "window", "door", "door", "passage", "door", "label", "label", "connector", "connector"] + ["object"] * 5
    assert len(prims) == 24
    o1 = _by_id(prims, "o1")
    assert o1 == {"kind": "object", "id": "o1", "item_id": "chair.basic", "shape": "box", "icon": "chair", "color": "furniture", "level_id": "L0", "cx": 200.0, "cy": 160.0,
                  "w": 45.0, "h": 45.0, "rotation": 0.0, "corners": [[177.5, 137.5], [222.5, 137.5], [222.5, 182.5], [177.5, 182.5]], "label": None, "circuit_id": None,
                  "anchor": None, "steps": []}
    o2 = _by_id(prims, "o2")  # 1.4 x 0.7 m desk turned 90 degrees clockwise: x' = -y, y' = x
    assert o2["corners"] == [[335.0, 250.0], [335.0, 390.0], [265.0, 390.0], [265.0, 250.0]] and o2["rotation"] == 90.0 and o2["label"] == "שולחן" and o2["icon"] == "table"
    o3 = _by_id(prims, "o3")
    assert o3["shape"] == "cylinder" and o3["corners"] == [[480.0, 220.0], [520.0, 220.0], [520.0, 260.0], [480.0, 260.0]]
    assert o3["circuit_id"] == "k1" and o3["anchor"] == "ha_entity:light.store" and o3["color"] == "light" and o3["icon"] == "lamp"
    o4 = _by_id(prims, "o4")  # a 4 x 3 m tribune turned 180 degrees, 4 rows: three step lines across the width
    assert o4["shape"] == "stepped" and o4["corners"] == [[450.0, 630.0], [50.0, 630.0], [50.0, 330.0], [450.0, 330.0]]
    assert o4["steps"] == [[[450.0, 555.0], [50.0, 555.0]], [[450.0, 480.0], [50.0, 480.0]], [[450.0, 405.0], [50.0, 405.0]]]
    assert _by_id(prims, "o5")["level_id"] == "L1" and _by_id(prims, "o5")["label"] == "מטף"
    # an item the library no longer has still draws: a plain box, the neutral colour
    doc = _sample()
    doc["objects"][0]["item_id"] = "gone.item"
    ghost = _by_id(render.structure_primitives(doc, 1000, 800), "o1")
    assert ghost["shape"] == "box" and ghost["icon"] == "box" and ghost["color"] == "object" and ghost["corners"] == o1["corners"]


def test_connector_primitives_carry_an_arrow_and_a_level_delta_label():
    prims = render.structure_primitives(_sample(), 1000, 800)
    c1 = _by_id(prims, "c1")
    assert c1 == {"kind": "connector", "id": "c1", "ckind": "stairs", "points": [[700.0, 560.0], [800.0, 560.0]], "width": 120.0, "arrow": {"from": [786.0, 560.0], "to": [800.0, 560.0]},
                  "label": "↓ −1.2 מ׳", "lx": 750.0, "ly": 560.0, "level_from": "L0", "level_to": "L1"}
    cx = _by_id(prims, "cx-o4")
    assert cx["ckind"] == "tribune" and cx["points"] == [[250.0, 330.0], [250.0, 630.0]] and cx["width"] == 400.0 and cx["arrow"] == {"from": [250.0, 616.0], "to": [250.0, 630.0]}
    assert cx["label"] == "↓ −1.2 מ׳" and [cx["lx"], cx["ly"]] == [250.0, 480.0]
    levels = {lv["id"]: lv for lv in _sample()["levels"]}
    assert render.connector_label(levels, {"level_from": "L1", "level_to": "L0", "label": None}) == "↑ +1.2 מ׳"
    assert render.connector_label(levels, {"level_from": "L0", "level_to": None, "label": None, "floor_ids": ["f2"]}) == "↕"
    assert render.connector_label(levels, {"level_from": "L0", "level_to": "L1", "label": "לגלריה"}) == "לגלריה"


def test_the_level_filter_keeps_connectors_and_anchors_move_bound_bodies():
    doc = _sample()
    only = render.structure_primitives(doc, 1000, 800, "L1")
    assert sorted(p["id"] for p in only) == ["c1", "cx-o4", "lb", "o5", "of", "wd", "wd"] and len(only) == 7
    moved = pg.apply_anchor_positions(doc, {"ha_entity:light.store": {"x": 0.9, "y": 0.9, "rotation": 45}})
    o3 = _by_id(render.structure_primitives(moved, 1000, 800), "o3")
    assert [o3["cx"], o3["cy"], o3["rotation"]] == [900.0, 720.0, 45.0]
    assert _by_id(render.structure_primitives(doc, 1000, 800), "o3")["cx"] == 500.0, "the source document is untouched"


def test_the_golden_file_has_24_and_7_primitives():
    golden = json.loads((FIX / "sample-v2.primitives.json").read_text(encoding="utf-8"))
    assert len(golden["all"]) == 24 and len(golden["level_L1"]) == 7
    assert render.structure_primitives(_sample(), 1000, 800) == golden["all"] and render.structure_primitives(_sample(), 1000, 800, "L1") == golden["level_L1"]


def test_every_symbol_exists_once():
    assert set(plan_symbols.SYMBOLS) == set(cat.ICONS) and len(plan_symbols.SYMBOLS) == 24
    assert plan_symbols.symbol_markup("chair").startswith("<") and plan_symbols.symbol_markup("nope") == plan_symbols.SYMBOLS["box"]


def test_svg_draws_objects_connectors_and_honours_layers():
    doc = _sample()
    a = render.render_svg(doc, [], 1000, 800)
    assert a == render.render_svg(doc, [], 1000, 800)
    ns = {"s": "http://www.w3.org/2000/svg"}
    root = ET.fromstring(a)
    assert 'data-object="o1"' in a and 'data-item="chair.basic"' in a and 'data-symbol="chair"' in a and 'data-connector="c1"' in a and 'data-connector-arrow="c1"' in a
    assert 'data-object-step="o4"' in a and 'data-connector-label="cx-o4"' in a and ">↓ −1.2 מ׳<" in a and 'data-object-label="o2"' in a and ">שולחן<" in a
    assert len(root.findall(".//s:polyline", ns)) == 9, "connectors and objects are paths, polygons and ellipses: the wall count stays"
    assert len(root.findall(".//s:ellipse", ns)) == 1, "the cylinder lamp"
    only = render.render_svg(doc, [], 1000, 800, layers={"structure"})
    assert 'data-wall="wa"' in only and "data-object" not in only and "data-connector" not in only
    objects = render.render_svg(doc, [], 1000, 800, layers={"objects"})
    assert 'data-object="o1"' in objects and "data-wall" not in objects and "<text" not in objects, "labels is its own layer"
    no_labels = render.render_svg(doc, [], 1000, 800, labels=False)
    assert "<text" not in no_labels and 'data-object="o1"' in no_labels
    lifted = render.render_svg(doc, [], 1000, 800, anchors={"ha_entity:light.store": {"x": 0.9, "y": 0.9, "rotation": 0}})
    assert 'cx="900"' in lifted


def test_png_draws_footprints(tmp_path):
    data = render.render_png(_sample(), [], 1000, 800)
    im = Image.open(io.BytesIO(data)).convert("RGB")
    assert im.getpixel((200, 160)) != (255, 255, 255), "the chair footprint is tinted"
    assert im.getpixel((500, 300)) == (255, 255, 255), "nothing between the objects"
    assert render.render_png(_sample(), [], 1000, 800, layers={"structure"}) != data
    assert render.render_png(_sample(), [], 1000, 800) == data


def test_export_routes_take_a_layer_list(settings):
    app = create_app(settings)
    c = TestClient(app)
    ids = seed_tree(c)
    asset = c.post(f"/api/v1/floors/{ids['floor2']}/plan-assets", files={"file": ("plan.png", png_bytes(), "image/png")}).json()
    vid = c.post(f"/api/v1/floors/{ids['floor2']}/plan-versions", json={"asset_id": asset["id"]}).json()["id"]
    c.post(f"/api/v1/plan-versions/{vid}/publish")
    g = c.get(f"/api/v1/plan-versions/{vid}/geometry?draft=true").json()
    sample = _sample()
    doc = dict(g["doc"], levels=sample["levels"], objects=sample["objects"][:2], groups=sample["groups"], connectors=[sample["connectors"][0]])
    assert c.put(f"/api/v1/plan-versions/{vid}/geometry", json={"doc": doc, "base_revision": 0}).status_code == 200
    assert c.post(f"/api/v1/plan-versions/{vid}/geometry/publish").status_code == 200
    svg = c.get(f"/api/v1/plan-versions/{vid}/export.svg?layers=objects,labels")
    assert svg.status_code == 200 and 'data-object="o1"' in svg.text and "data-connector" not in svg.text and ">שולחן<" in svg.text
    assert c.get(f"/api/v1/plan-versions/{vid}/export.svg?layers=walls").status_code == 422
    assert c.get(f"/api/v1/plan-versions/{vid}/export.png?layers=structure,connectors").status_code == 200
```

In `smplwise_vms/backend/tests/test_plan_geometry_render.py`, replace the two lines of `test_level_filter`

```python
    assert sorted({p["id"] for p in prims}) == ["lb", "of", "wd"]
    assert [p["id"] for p in prims if p["kind"] == "wall"] == ["wd", "wd"]
```

with

```python
    assert sorted({p["id"] for p in prims}) == ["c1", "cx-o4", "lb", "o5", "of", "wd"], "connectors are never filtered by level; o5 is the L1 object"
    assert [p["id"] for p in prims if p["kind"] == "wall"] == ["wd", "wd"]
```

and in `test_input_order_does_not_matter` replace both occurrences of `for coll in ("walls", "openings", "labels"):` with `for coll in ("walls", "openings", "labels", "objects", "connectors", "circuits"):`.

- [ ] **Step 3: Run to see them fail**

Run: `cd smplwise_vms/backend && MSYS_NO_PATHCONV=1 $PY -m pytest tests/test_plan_geometry_render2.py tests/test_plan_geometry_render.py -p no:cacheprovider`
Expected: the new file FAILS (`No module named 'smplwise.services.plan_symbols'`); in the old file `test_level_filter` and the golden tests FAIL (17 primitives, no objects yet).

- [ ] **Step 4: The symbols (`smplwise_vms/backend/smplwise/services/plan_symbols.py`)**

```python
"""The 24 object symbols of the Plan Studio exports (T085): inner SVG markup in a 24 x 24 box, stroke based, keyed by
the catalog's icon id. frontend/src/map/plan-symbols.ts draws the same ids on the map; the primitives carry the id and
the placement, so the two drawings may differ in detail but never in where they sit."""
from __future__ import annotations

SYMBOLS: dict[str, str] = {
    "box": '<rect x="5" y="5" width="14" height="14" rx="1.5"/>',
    "cylinder": '<circle cx="12" cy="12" r="7"/>',
    "chair": '<rect x="7" y="10" width="10" height="7" rx="1.5"/><path d="M7 10V6h10v4M8 17v3M16 17v3"/>',
    "table": '<rect x="4" y="8" width="16" height="8" rx="1.5"/><path d="M6 16v3M18 16v3"/>',
    "sofa": '<path d="M4 11a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v6H4z"/><path d="M4 14h16M7 9V7h10v2"/>',
    "bed": '<rect x="4" y="9" width="16" height="9" rx="1.5"/><path d="M4 13h16M6 9V6h5v3M6 18v2M18 18v2"/>',
    "cabinet": '<rect x="5" y="4" width="14" height="16" rx="1"/><path d="M12 4v16M9 11h1M14 11h1"/>',
    "lamp": '<circle cx="12" cy="11" r="5"/><path d="M12 16v3M9 20h6M8 5l1 1M16 5l-1 1"/>',
    "panel": '<rect x="6" y="4" width="12" height="16" rx="1"/><path d="M9 8h6M9 11h6M9 14h3"/>',
    "socket": '<rect x="5" y="5" width="14" height="14" rx="2"/><path d="M10 10v4M14 10v4"/>',
    "extinguisher": '<rect x="9" y="8" width="6" height="12" rx="3"/><path d="M12 8V5M9 5h6M15 9l3-2"/>',
    "smoke": '<circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2"/><path d="M12 5v2M12 17v2"/>',
    "exit": '<rect x="4" y="6" width="16" height="12" rx="1.5"/><path d="M9 12h7M13 9l3 3-3 3"/>',
    "aed": '<path d="M12 20s-7-4.5-7-9.5A3.5 3.5 0 0 1 12 8a3.5 3.5 0 0 1 7 2.5C19 15.5 12 20 12 20z"/><path d="M12 9l-1.5 3h3L12 15"/>',
    "medical": '<rect x="4" y="6" width="16" height="12" rx="2"/><path d="M12 9v6M9 12h6"/>',
    "goal": '<rect x="4" y="6" width="16" height="10"/><path d="M4 16v3M20 16v3M8 6v10M12 6v10M16 6v10"/>',
    "mat": '<rect x="3" y="8" width="18" height="8" rx="2"/><path d="M7 8v8M12 8v8M17 8v8"/>',
    "stairs": '<path d="M4 20h4v-4h4v-4h4V8h4"/>',
    "elevator": '<rect x="5" y="3" width="14" height="18" rx="1.5"/><path d="M12 3v18M8 10l1.5-2 1.5 2M14.5 14l1.5 2 1.5-2"/>',
    "doorstation": '<rect x="7" y="3" width="10" height="18" rx="2"/><circle cx="12" cy="8" r="2"/><path d="M9 13h6M9 16h6"/>',
    "tree": '<circle cx="12" cy="10" r="6"/><path d="M12 16v5M9 21h6"/>',
    "sanitary": '<path d="M6 10h12v3a6 6 0 0 1-12 0z"/><path d="M12 10V5M9 5h6"/>',
    "office": '<rect x="4" y="5" width="16" height="11" rx="1.5"/><path d="M8 20h8M12 16v4"/>',
    "parking": '<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M9 17V7h4a3 3 0 0 1 0 6H9"/>',
}


def symbol_markup(icon: str) -> str:
    """The markup of a symbol id; an unknown id draws the plain box (the same fallback the map uses)."""
    return SYMBOLS.get(icon, SYMBOLS["box"])
```

- [ ] **Step 5: The renderer (`services/plan_geometry_render.py`)**

Replace the import line `from .plan_geometry import DEFAULT_LEVEL_ID, DEFAULT_WALL_THICKNESS_M, effective_scale` with:

```python
from . import plan_catalog
from .plan_geometry import DEFAULT_LEVEL_ID, DEFAULT_WALL_THICKNESS_M, apply_anchor_positions, effective_scale
from .plan_symbols import symbol_markup

LAYERS = ("structure", "objects", "labels", "connectors")
ARROW_PX = 14.0
OBJECT_COLORS = {"object": "#7b8794", "structure": "#4b5567", "circulation": "#6b7f99", "furniture": "#9aa7b8", "light": "#f2b544", "electrical": "#e07a2f",
                 "safety": "#e0443c", "medical": "#2fa7b3", "sport": "#3fa25b", "sanitary": "#5b9bd5", "security": "#7a5cc7", "outdoor": "#5c9e4f"}
CIRCUIT_COLORS = {"circuit-1": "#2f6bff", "circuit-2": "#f59e0b", "circuit-3": "#22c55e", "circuit-4": "#a855f7", "circuit-5": "#ef4444", "circuit-6": "#14b8a6"}
```

Replace the `structure_primitives` signature line

```python
def structure_primitives(doc: dict[str, Any], width: float, height: float, level: str | None = None) -> list[dict[str, Any]]:
    scale, _ = effective_scale(doc)
```

with

```python
def _rotated(cx: float, cy: float, x: float, y: float, theta: float) -> Point:
    """A footprint-local offset (x right, y down) turned by theta around the centre: clockwise on screen (y points down)."""
    c, s = math.cos(theta), math.sin(theta)
    return (cx + x * c - y * s, cy + x * s + y * c)


def connector_label(levels: dict[str, Any], c: dict[str, Any]) -> str:
    """"↓ −1.2 מ׳": the arrow and the signed elevation difference from level_from to level_to; a connector's own label
    wins; a cross-floor connector (no level_to here) shows only the two-way arrow. The same string comes from
    geometry.ts connectorLabel, so the export and the map agree."""
    if c.get("label"):
        return str(c["label"])
    a, b = levels.get(c.get("level_from")), levels.get(c.get("level_to"))
    if a is None or b is None:
        return "↕"
    delta = float(b["elevation_m"]) - float(a["elevation_m"])
    return f"{'↓' if delta < 0 else '↑'} {'−' if delta < 0 else '+'}{abs(delta):.1f} מ׳"


def _connector_prims(doc: dict[str, Any], width: float, height: float, px_per_m: float) -> list[dict[str, Any]]:
    levels = {lv["id"]: lv for lv in doc.get("levels", []) if isinstance(lv, dict) and isinstance(lv.get("id"), str)}
    out: list[dict[str, Any]] = []
    for c in sorted(doc.get("connectors", []), key=lambda c: c["id"]):
        pts: list[Point] = [(float(p[0]) * width, float(p[1]) * height) for p in c.get("polyline", [])]
        if len(pts) < 2:
            continue
        cum = _cum(pts)
        total = cum[-1]
        if total <= 1e-6:
            continue
        tail, _ = point_at(pts, cum, max(0.0, total - min(ARROW_PX, total)))
        mid, _ = point_at(pts, cum, total / 2)
        out.append({"kind": "connector", "id": c["id"], "ckind": str(c.get("kind") or "stairs"), "points": [_p(q) for q in pts], "width": r2(max(1.0, float(c.get("width_m") or 1) * px_per_m)),
                    "arrow": {"from": _p(tail), "to": _p(pts[-1])}, "label": connector_label(levels, c), "lx": r2(mid[0]), "ly": r2(mid[1]),
                    "level_from": c.get("level_from"), "level_to": c.get("level_to")})
    return out


def _object_prims(doc: dict[str, Any], width: float, height: float, px_per_m: float, level: str | None, items: dict[str, Any]) -> list[dict[str, Any]]:
    circuit_of: dict[str, str] = {}
    for k in sorted(doc.get("circuits", []), key=lambda k: k["id"]):
        for mid in k.get("member_ids", []):
            circuit_of.setdefault(mid, k["id"])
    out: list[dict[str, Any]] = []
    for o in sorted(doc.get("objects", []), key=lambda o: o["id"]):
        if level is not None and o.get("level_id") != level:
            continue
        item = items.get(o.get("item_id")) or {}
        shape = item.get("shape") if item.get("shape") in plan_catalog.SHAPES else "box"
        cx, cy = float(o["position"][0]) * width, float(o["position"][1]) * height
        size = o.get("size") or {}
        hw, hd = float(size.get("w_m") or 0.05) * px_per_m / 2, float(size.get("d_m") or 0.05) * px_per_m / 2
        rot = float(o.get("rotation_deg") or 0)
        theta = math.radians(rot)
        corners = [_p(_rotated(cx, cy, sx * hw, sy * hd, theta)) for sx, sy in ((-1, -1), (1, -1), (1, 1), (-1, 1))]
        steps: list[list[list[float]]] = []
        params = o.get("params") if isinstance(o.get("params"), dict) else {}
        rows = params.get("rows")
        if shape == "stepped" and isinstance(rows, int) and rows >= 2:
            for i in range(1, rows):
                y = -hd + 2 * hd * i / rows
                steps.append([_p(_rotated(cx, cy, -hw, y, theta)), _p(_rotated(cx, cy, hw, y, theta))])
        ref = o.get("anchor_ref")
        out.append({"kind": "object", "id": o["id"], "item_id": str(o.get("item_id") or ""), "shape": shape, "icon": item.get("icon") if item.get("icon") in plan_catalog.ICONS else "box",
                    "color": item.get("color_token") if item.get("color_token") in plan_catalog.COLOR_TOKENS else "object", "level_id": o.get("level_id"),
                    "cx": r2(cx), "cy": r2(cy), "w": r2(hw * 2), "h": r2(hd * 2), "rotation": r2(rot), "corners": corners, "label": o.get("label") or None,
                    "circuit_id": circuit_of.get(o["id"]), "anchor": f"{ref['resource_type']}:{ref['resource_id']}" if isinstance(ref, dict) and ref.get("resource_id") else None,
                    "steps": steps})
    return out


def structure_primitives(doc: dict[str, Any], width: float, height: float, level: str | None = None, items: dict[str, Any] | None = None) -> list[dict[str, Any]]:
    """Walls cut by their openings, door leaves and arcs, window glass, passages, labels (phase 1), then connectors
    (sorted by id, never filtered by level: they are what joins the levels) and objects (sorted by id, filtered by
    level). `items` is the library index; without it the built-in items are used, and an unknown item draws as a box."""
    scale, _ = effective_scale(doc)
```

and replace the final `    return prims` of `structure_primitives` (the line right after the labels loop) with:

```python
    px_per_m = 1.0 / scale
    prims.extend(_connector_prims(doc, width, height, px_per_m))
    prims.extend(_object_prims(doc, width, height, px_per_m, level, plan_catalog.builtin()["items"] if items is None else items))
    return prims
```

Replace the export section from `def render_svg(` down to the end of the file with:

```python
def _layer_set(layers: Any, labels: bool) -> set[str]:
    out = set(LAYERS) if layers is None else {str(x) for x in layers}
    if not labels:
        out.discard("labels")
    return out


def _prepared(doc: dict[str, Any], anchors: dict[str, Any] | None) -> dict[str, Any]:
    return apply_anchor_positions(doc, anchors) if anchors else doc


def _svg_object(p: dict[str, Any], labels: bool) -> list[str]:
    color = OBJECT_COLORS.get(p["color"], OBJECT_COLORS["object"])
    out = []
    if p["shape"] == "cylinder":
        out.append(f'<ellipse data-object={quoteattr(p["id"])} data-item={quoteattr(p["item_id"])} cx="{_n(p["cx"])}" cy="{_n(p["cy"])}" rx="{_n(p["w"] / 2)}" ry="{_n(p["h"] / 2)}" '
                   f'transform="rotate({_n(p["rotation"])} {_n(p["cx"])} {_n(p["cy"])})" fill="{color}" fill-opacity="0.18" stroke="{color}" stroke-width="1.2"/>')
    else:
        out.append(f'<polygon data-object={quoteattr(p["id"])} data-item={quoteattr(p["item_id"])} points="{_pts(p["corners"])}" fill="{color}" fill-opacity="0.18" stroke="{color}" stroke-width="1.2"/>')
    for a, b in p["steps"]:
        out.append(f'<path data-object-step={quoteattr(p["id"])} d="M {_n(a[0])} {_n(a[1])} L {_n(b[0])} {_n(b[1])}" stroke="{color}" stroke-width="1" fill="none"/>')
    s = min(3.0, max(0.35, min(p["w"], p["h"]) * 0.6 / 24))
    out.append(f'<g data-symbol={quoteattr(p["icon"])} transform="translate({_n(p["cx"])} {_n(p["cy"])}) rotate({_n(p["rotation"])}) scale({_n(s)}) translate(-12 -12)" '
               f'fill="none" stroke="{color}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">{symbol_markup(p["icon"])}</g>')
    if labels and p["label"]:
        out.append(f'<text data-object-label={quoteattr(p["id"])} x="{_n(p["cx"])}" y="{_n(p["cy"] + p["h"] / 2 + 12)}" font-size="11">{escape(p["label"])}</text>')
    return out


def _svg_connector(p: dict[str, Any], labels: bool) -> list[str]:
    d = "M " + " L ".join(f"{_n(x)} {_n(y)}" for x, y in p["points"])
    out = [f'<path data-connector={quoteattr(p["id"])} data-kind={quoteattr(p["ckind"])} d="{d}" stroke="{TOKENS["structure"]}" stroke-opacity="0.25" stroke-width="{_n(p["width"])}" fill="none"/>',
           f'<path data-connector-arrow={quoteattr(p["id"])} d="M {_n(p["arrow"]["from"][0])} {_n(p["arrow"]["from"][1])} L {_n(p["arrow"]["to"][0])} {_n(p["arrow"]["to"][1])}" '
           f'stroke="{TOKENS["structure"]}" stroke-width="2" marker-end="url(#sw-arrow)" fill="none"/>']
    if labels:
        out.append(f'<text data-connector-label={quoteattr(p["id"])} x="{_n(p["lx"])}" y="{_n(p["ly"])}" font-size="12">{escape(p["label"])}</text>')
    return out


def render_svg(doc: dict[str, Any], zones: list[dict[str, Any]], width: float, height: float, *, level: str | None = None, labels: bool = True, rooms: bool = True,
               layers: Any = None, anchors: dict[str, Any] | None = None, items: dict[str, Any] | None = None) -> str:
    """The structure, the connectors and the objects as SVG - the same primitives as the map. `layers` is a subset of
    LAYERS (default all); `labels=False` removes the labels layer; `anchors` moves bound bodies to their live anchors."""
    show = _layer_set(layers, labels)
    prims = structure_primitives(_prepared(doc, anchors), width, height, level, items)
    w, h = _n(width), _n(height)
    out = [f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="0 0 {w} {h}">',
           f'<defs><marker id="sw-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="M0 0L10 5L0 10z" fill="{TOKENS["structure"]}"/></marker></defs>',
           f'<rect width="{w}" height="{h}" fill="{TOKENS["canvas"]}"/>']
    if rooms:
        out.append('<g id="rooms">')
        for z, pts in _rooms(zones, width, height, level):
            out.append(f'<polygon data-room={quoteattr(z["id"])} points="{_pts(pts)}" fill="{TOKENS["room_fill"]}" stroke="{TOKENS["room_line"]}" stroke-width="1"/>')
        out.append("</g>")
    if "structure" in show:
        out.append(f'<g id="walls" fill="none" stroke="{TOKENS["structure"]}" stroke-linecap="butt" stroke-linejoin="miter">')
        out.extend(f'<polyline data-wall={quoteattr(p["id"])} points="{_pts(p["points"])}" stroke-width="{_n(p["width"])}"/>' for p in prims if p["kind"] == "wall")
        out.append("</g>")
        out.append('<g id="openings" fill="none">')
        for p in prims:
            if p["kind"] == "door":
                out.append(f'<g data-opening={quoteattr(p["id"])}>')
                out.extend(f'<line x1="{_n(a[0])}" y1="{_n(a[1])}" x2="{_n(b[0])}" y2="{_n(b[1])}" stroke="{TOKENS["opening"]}" stroke-width="1.5"/>' for a, b in p["leaves"])
                out.extend(f'<path d="M {_n(a["from"][0])} {_n(a["from"][1])} A {_n(a["r"])} {_n(a["r"])} 0 0 {a["sweep"]} {_n(a["to"][0])} {_n(a["to"][1])}" '
                           f'stroke="{TOKENS["opening"]}" stroke-width="1" stroke-dasharray="4 3"/>' for a in p["arcs"])
                out.append("</g>")
            elif p["kind"] == "window":
                out.append(f'<g data-opening={quoteattr(p["id"])}>')
                out.extend(f'<line x1="{_n(a[0])}" y1="{_n(a[1])}" x2="{_n(b[0])}" y2="{_n(b[1])}" stroke="{TOKENS["glass"]}" stroke-width="1.5"/>' for a, b in p["lines"])
                out.append("</g>")
            elif p["kind"] == "passage":
                a, b = p["gap"]
                out.append(f'<line data-opening={quoteattr(p["id"])} x1="{_n(a[0])}" y1="{_n(a[1])}" x2="{_n(b[0])}" y2="{_n(b[1])}" stroke="{TOKENS["structure"]}" '
                           f'stroke-width="1" stroke-dasharray="2 3"/>')
        out.append("</g>")
    if "connectors" in show:
        out.append(f'<g id="connectors" font-family="Arial, Helvetica, sans-serif" font-weight="600" fill="{TOKENS["label"]}" text-anchor="middle" dominant-baseline="middle">')
        for p in prims:
            if p["kind"] == "connector":
                out.extend(_svg_connector(p, "labels" in show))
        out.append("</g>")
    if "objects" in show:
        out.append(f'<g id="objects" font-family="Arial, Helvetica, sans-serif" font-weight="600" fill="{TOKENS["label"]}" text-anchor="middle" dominant-baseline="middle">')
        for p in prims:
            if p["kind"] == "object":
                out.extend(_svg_object(p, "labels" in show))
        out.append("</g>")
    if "labels" in show:
        out.append(f'<g id="labels" font-family="Arial, Helvetica, sans-serif" font-weight="600" fill="{TOKENS["label"]}" text-anchor="middle" dominant-baseline="middle">')
        out.extend(f'<text data-label={quoteattr(p["id"])} x="{_n(p["x"])}" y="{_n(p["y"])}" font-size="{_n(p["size"])}">{escape(p["text"])}</text>'
                   for p in prims if p["kind"] == "label")
        out.append("</g>")
    out.append("</svg>")
    return "\n".join(out) + "\n"


def _rgb(hex_color: str, alpha: int = 255) -> tuple[int, int, int, int]:
    h = hex_color.lstrip("#")
    return int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16), alpha


def _ellipse_points(p: dict[str, Any], n: int = 24) -> list[tuple[float, float]]:
    theta = math.radians(p["rotation"])
    return [_rotated(p["cx"], p["cy"], math.cos(2 * math.pi * i / n) * p["w"] / 2, math.sin(2 * math.pi * i / n) * p["h"] / 2, theta) for i in range(n)]


def render_png(doc: dict[str, Any], zones: list[dict[str, Any]], width: float, height: float, *, background: Path | None = None, level: str | None = None,
               layers: Any = None, anchors: dict[str, Any] | None = None, items: dict[str, Any] | None = None) -> bytes:
    """The structure, connectors and object footprints over the plan picture (or white). Text stays in the SVG:
    Pillow cannot shape Hebrew; symbols too (a centre dot marks each object)."""
    from PIL import Image, ImageDraw

    show = _layer_set(layers, True)
    size = (int(round(width)), int(round(height)))
    if background is not None:
        with Image.open(background) as im:
            base = im.convert("RGBA")
            if base.size != size:
                base = base.resize(size)
    else:
        base = Image.new("RGBA", size, _rgb(TOKENS["canvas"]))
    layer = Image.new("RGBA", size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(layer)
    for _z, pts in _rooms(zones, width, height, level):
        draw.polygon([tuple(p) for p in pts], fill=_rgb(TOKENS["room_fill"], 110), outline=_rgb(TOKENS["room_line"]))
    prims = structure_primitives(_prepared(doc, anchors), width, height, level, items)
    if "connectors" in show:
        for p in prims:
            if p["kind"] == "connector":
                draw.line([tuple(q) for q in p["points"]], fill=_rgb(TOKENS["structure"], 60), width=max(1, int(round(p["width"]))))
                draw.line([tuple(p["arrow"]["from"]), tuple(p["arrow"]["to"])], fill=_rgb(TOKENS["structure"]), width=2)
    if "structure" in show:
        for p in prims:
            if p["kind"] == "wall":
                draw.line([tuple(q) for q in p["points"]], fill=_rgb(TOKENS["structure"]), width=max(1, int(round(p["width"]))), joint="curve")
        for p in prims:
            if p["kind"] == "door":
                arcs = p["arcs"] or [None] * len(p["leaves"])
                for (a, b), arc in zip(p["leaves"], arcs):
                    draw.line([tuple(a), tuple(b)], fill=_rgb(TOKENS["opening"]), width=2)
                    if arc is not None:
                        cx, cy, r = a[0], a[1], arc["r"]
                        start = math.degrees(math.atan2(arc["from"][1] - cy, arc["from"][0] - cx))
                        end = math.degrees(math.atan2(arc["to"][1] - cy, arc["to"][0] - cx))
                        if not arc["sweep"]:
                            start, end = end, start
                        draw.arc([cx - r, cy - r, cx + r, cy + r], start=start, end=end, fill=_rgb(TOKENS["opening"]), width=1)
            elif p["kind"] == "window":
                for a, b in p["lines"]:
                    draw.line([tuple(a), tuple(b)], fill=_rgb(TOKENS["glass"]), width=2)
            elif p["kind"] == "passage":
                draw.line([tuple(p["gap"][0]), tuple(p["gap"][1])], fill=_rgb(TOKENS["structure"]), width=1)
    if "objects" in show:
        for p in prims:
            if p["kind"] != "object":
                continue
            color = OBJECT_COLORS.get(p["color"], OBJECT_COLORS["object"])
            pts = _ellipse_points(p) if p["shape"] == "cylinder" else [tuple(q) for q in p["corners"]]
            draw.polygon([tuple(q) for q in pts], fill=_rgb(color, 60), outline=_rgb(color))
            for a, b in p["steps"]:
                draw.line([tuple(a), tuple(b)], fill=_rgb(color), width=1)
            draw.ellipse([p["cx"] - 2, p["cy"] - 2, p["cx"] + 2, p["cy"] + 2], fill=_rgb(color))
    out = Image.alpha_composite(base, layer).convert("RGB")
    buf = io.BytesIO()
    out.save(buf, format="PNG")
    return buf.getvalue()
```

(`_rgb` moves below `render_svg` exactly as it was; the old `render_png` body is replaced.)

- [ ] **Step 6: `anchor_positions` in the store and the export routes**

Append to `smplwise_vms/backend/smplwise/services/geometry_store.py`:

```python
def anchor_positions(conn: sqlite3.Connection, floor_id: str) -> dict[str, dict[str, float]]:
    """The live anchors of a floor keyed "<type>:<id>": what a bound object takes its position and rotation from."""
    return {f"{r['resource_type']}:{r['resource_id']}": {"x": r["x"], "y": r["y"], "rotation": r["rotation_degrees"] or 0}
            for r in conn.execute("SELECT resource_type, resource_id, x, y, rotation_degrees FROM map_anchors WHERE floor_id = ? AND effective_to IS NULL", (floor_id,)).fetchall()}
```

In `smplwise_vms/backend/smplwise/routers/plan_geometry.py` add `from ..services import plan_catalog` after `from ..services import geometry_store as store`, add after `NO_CACHE = …`:

```python
def _layers(raw: str | None) -> set[str] | None:
    """?layers=structure,objects,labels,connectors - any subset; an unknown name is a 422."""
    if raw is None:
        return None
    chosen = {x.strip() for x in raw.split(",") if x.strip()}
    unknown = sorted(chosen - set(render.LAYERS))
    if unknown:
        raise ApiError(422, "validation", "שכבות לא מוכרות בייצוא.", details={"unknown": unknown, "layers": list(render.LAYERS)})
    return chosen
```

and replace the two export handlers with:

```python
@router.get("/plan-versions/{version_id}/export.svg", response_model=None)
def export_svg(version_id: str, draft: bool = False, level: str | None = None, labels: bool = True, rooms: bool = True, layers: str | None = None,
               principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> Response:
    v, doc = _export_doc(conn, principal, version_id, draft)
    text = render.render_svg(doc, floor_zones(conn, v["floor_id"]), v["width_px"], v["height_px"], level=level, labels=labels, rooms=rooms, layers=_layers(layers),
                             anchors=store.anchor_positions(conn, v["floor_id"]), items=plan_catalog.item_index(conn))
    return Response(content=text.encode("utf-8"), media_type="image/svg+xml; charset=utf-8",
                    headers={"Content-Disposition": f'attachment; filename="plan-{v["id"]}.svg"', **NO_CACHE})


@router.get("/plan-versions/{version_id}/export.png", response_model=None)
def export_png(version_id: str, request: Request, draft: bool = False, level: str | None = None, background: bool = True, layers: str | None = None,
               principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> Response:
    v, doc = _export_doc(conn, principal, version_id, draft)
    picture = settings_of(request).data_dir / v["image_path"] if background else None
    data = render.render_png(doc, floor_zones(conn, v["floor_id"]), v["width_px"], v["height_px"], background=picture if picture is not None and picture.exists() else None,
                             level=level, layers=_layers(layers), anchors=store.anchor_positions(conn, v["floor_id"]), items=plan_catalog.item_index(conn))
    return Response(content=data, media_type="image/png", headers={"Content-Disposition": f'attachment; filename="plan-{v["id"]}.png"', **NO_CACHE})
```

- [ ] **Step 7: Regenerate the golden and run the tests**

```bash
cd /c/cloude/smplwisebms && MSYS_NO_PATHCONV=1 $PY scripts/geometry_golden.py && MSYS_NO_PATHCONV=1 $PY scripts/geometry_golden.py --check; echo "golden $?"
```

Expected: `written contracts/fixtures/plan_geometry/sample-v2.primitives.json: 24 primitives` and `golden 0`.

Run: `cd smplwise_vms/backend && MSYS_NO_PATHCONV=1 $PY -m pytest tests/test_plan_geometry_render2.py tests/test_plan_geometry_render.py tests/test_plan_geometry_export.py tests/test_plan_geometry_objects.py -p no:cacheprovider`
Expected: all pass (9 new + 5 + 3 + 7).

- [ ] **Step 8: Commit**

```bash
cd /c/cloude/smplwisebms && git add smplwise_vms/backend/smplwise/services/plan_symbols.py smplwise_vms/backend/smplwise/services/plan_geometry_render.py smplwise_vms/backend/smplwise/services/geometry_store.py smplwise_vms/backend/smplwise/routers/plan_geometry.py contracts/fixtures/plan_geometry/sample-v2.json contracts/fixtures/plan_geometry/sample-v2.primitives.json smplwise_vms/backend/tests/test_plan_geometry_render.py smplwise_vms/backend/tests/test_plan_geometry_render2.py
msg=$(mktemp) && cat > "$msg" <<'EOF'
feat(plan-studio): object and connector primitives with 24 symbols, SVG and PNG layers, golden fixture with objects and connectors (T085)

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOF
test "$(bash /c/cloude/smplwisebms/secrets/scan_staged.sh)" = 0 && git commit -F "$msg"
```

---
### Task 5: The body of an anchor, un-binding, derived connectors in the store, the cross-floor link

**Files:**
- Modify: `smplwise_vms/backend/smplwise/services/geometry_store.py` (`_prepare`, `working_doc`, `save_draft`, `pending_doc`, `rollback`, `copy_published`, `unbind_anchor`, `anchor_issues`, `link_connector`)
- Modify: `smplwise_vms/backend/smplwise/routers/plan_geometry.py` (validation with the library, anchor warnings, `POST …/geometry/link`)
- Modify: `smplwise_vms/backend/smplwise/routers/anchors.py` (`delete_anchor` un-binds)
- Test: `smplwise_vms/backend/tests/test_plan_geometry_binding.py` (create)

**Interfaces:**
- Consumes: `pg.normalize`, `pg.apply_anchor_positions`, `pg.validate(doc, items)` (Task 3); `store.anchor_positions` (Task 4); `plan_catalog.item_index` (Task 1); `catalog.get_floor`.
- Produces:
  - `geometry_store._prepare(conn, version, doc)` = rebase + normalize + anchor refresh; `working_doc` returns a prepared document; `save_draft` stores a prepared document; `pending_doc` publishes a prepared one and validates with the library; `rollback` / `copy_published` prepare what they restore.
  - `geometry_store.unbind_anchor(conn, floor_id, resource_type, resource_id, actor_id) -> int` (drafts changed), `geometry_store.anchor_issues(conn, floor_id, doc) -> list[issue]` (warning `anchor_missing` per bound object without an anchor), `geometry_store.link_connector(conn, source_version, connector_id, target_floor_id, actor_id) -> {connector, target: {floor_id, version_id, revision}}`.
  - HTTP `POST /plan-versions/{id}/geometry/link` body `{connector_id, floor_id}` (map.edit on both floors; 422 same floor; 404 unknown connector; 409 `derived_connector`, 409 `no_plan`); audit `geometry.connector.link`.
  - `DELETE /map-anchors/{id}` un-binds the anchor's bodies in every draft of the floor (audit detail `unbound_bodies`).
- Behaviour note recorded for the editor (Task 9): after a publish, a draft whose bound bodies moved since its last save may still show "פרסום המבנה"; the diff prepares both sides, so it reports no change and a second publish answers `unchanged`.

- [ ] **Step 1: Write the failing tests**

```python
"""Plan Studio bindings (T085): an object bound to an anchor is the anchor's body - the server refreshes its position
and rotation from the anchor on every save and publish, deleting the anchor un-binds the body (kept where it is), a
missing anchor is a warning; a tribune that connects levels derives its connector in the stored draft and in the
published document; circuit power is recomputed on save; stairs linked to another floor exist in both drafts under
the same id."""
from __future__ import annotations

from conftest import as_user, bind, png_bytes, seed_tree
from fastapi.testclient import TestClient

from smplwise.main import create_app
from smplwise.services import ha_sync

LEVELS = [{"id": "L0", "name": "מפלס ראשי", "elevation_m": 0.0, "ceiling_height_m": 2.8, "is_default": True, "external_ids": {}},
          {"id": "L1", "name": "אולם תחתון", "elevation_m": -1.2, "ceiling_height_m": 6.0, "is_default": False, "external_ids": {}}]


def OBJ(oid: str, item: str = "chair.basic", pos=(0.2, 0.2), **kw) -> dict:
    o = {"id": oid, "item_id": item, "level_id": "L0", "position": list(pos), "rotation_deg": 0, "size": {"w_m": 0.45, "d_m": 0.45, "h_m": 0.85}, "z_m": 0, "params": {},
         "label": None, "anchor_ref": None, "group_id": None, "confidence": 1, "source": "manual", "locked": False, "external_ids": {}}
    o.update(kw)
    return o


def _plan(c, floor_id: str) -> str:
    asset = c.post(f"/api/v1/floors/{floor_id}/plan-assets", files={"file": ("plan.png", png_bytes(), "image/png")}).json()
    v = c.post(f"/api/v1/floors/{floor_id}/plan-versions", json={"asset_id": asset["id"]}).json()
    assert c.post(f"/api/v1/plan-versions/{v['id']}/publish").status_code == 200
    return v["id"]


def _setup(settings):
    app = create_app(settings)
    c = TestClient(app)
    ids = seed_tree(c)
    return app, c, ids, _plan(c, ids["floor2"])


def _save(c, vid, **fields):
    g = c.get(f"/api/v1/plan-versions/{vid}/geometry?draft=true").json()
    r = c.put(f"/api/v1/plan-versions/{vid}/geometry", json={"doc": dict(g["doc"], **fields), "base_revision": g["geometry"]["revision"]})
    assert r.status_code == 200, r.text
    return r.json()


def test_a_bound_object_follows_its_anchor_on_save_and_publish_and_is_unbound_when_the_anchor_goes(settings):
    app, c, ids, vid = _setup(settings)
    with app.state.db.connection() as conn:
        ha_sync.upsert_state(conn, {"entity_id": "light.store", "state": "off", "attributes": {"friendly_name": "Store light"}, "last_changed": "2026-09-25T08:00:00+00:00", "last_updated": "2026-09-25T08:00:00+00:00"})
    a = c.post(f"/api/v1/floors/{ids['floor2']}/anchors", json={"resource_type": "ha_entity", "resource_id": "light.store", "x": 0.7, "y": 0.25, "rotation_degrees": 30})
    assert a.status_code == 201, a.text
    lamp = OBJ("o1", item="light.ceiling", pos=(0.2, 0.2), z_m=2.5, size={"w_m": 0.4, "d_m": 0.4, "h_m": 0.1}, anchor_ref={"resource_type": "ha_entity", "resource_id": "light.store"})
    saved = _save(c, vid, objects=[lamp])
    assert saved["doc"]["objects"][0]["position"] == [0.7, 0.25] and saved["doc"]["objects"][0]["rotation_deg"] == 30, "the body sits on its anchor"
    assert saved["issues"] == []
    # the anchor moves: the stored draft is refreshed when it is read, and what publishes takes the live position
    moved = c.patch(f"/api/v1/map-anchors/{a.json()['id']}", json={"revision": 1, "x": 0.75})
    assert moved.status_code == 200, moved.text
    assert c.get(f"/api/v1/plan-versions/{vid}/geometry?draft=true").json()["doc"]["objects"][0]["position"] == [0.75, 0.25]
    assert c.post(f"/api/v1/plan-versions/{vid}/geometry/publish").json()["unchanged"] is False
    assert c.get(f"/api/v1/plan-versions/{vid}/geometry").json()["doc"]["objects"][0]["position"] == [0.75, 0.25]
    assert c.post(f"/api/v1/plan-versions/{vid}/geometry/publish").json()["unchanged"] is True, "the same prepared document publishes nothing"
    # deleting the anchor leaves the body where it is, unbound; the draft revision moved (an open editor reloads)
    before = c.get(f"/api/v1/plan-versions/{vid}/geometry?draft=true").json()["geometry"]["revision"]
    assert c.delete(f"/api/v1/map-anchors/{a.json()['id']}").status_code == 204
    g = c.get(f"/api/v1/plan-versions/{vid}/geometry?draft=true").json()
    assert g["doc"]["objects"][0]["anchor_ref"] is None and g["doc"]["objects"][0]["position"] == [0.75, 0.25] and g["geometry"]["revision"] == before + 1
    with app.state.db.connection() as conn:
        assert conn.execute("SELECT json_extract(details_json, '$.unbound_bodies') FROM audit_log WHERE action = 'anchor.delete'").fetchone()[0] == 1
    # a reference to an anchor that does not exist is a warning, never an error
    ghost = _save(c, vid, objects=[dict(lamp, anchor_ref={"resource_type": "ha_entity", "resource_id": "light.gone"})])
    assert [(i["code"], i["severity"], i["id"]) for i in ghost["issues"]] == [("anchor_missing", "warning", "o1")]
    assert ghost["doc"]["objects"][0]["position"] == [0.2, 0.2], "no anchor: the position the editor sent stays"
    assert c.post(f"/api/v1/plan-versions/{vid}/geometry/publish").status_code == 200


def test_a_tribune_derives_its_connector_and_circuit_power_is_recomputed(settings):
    app, c, ids, vid = _setup(settings)
    tribune = OBJ("t1", item="tribune.stepped", pos=(0.4, 0.6), rotation_deg=180, size={"w_m": 4, "d_m": 3, "h_m": 1.2},
                  params={"rows": 4, "step_height_m": 0.3, "step_width_m": 1.0, "connects_levels": "L1"})
    lamps = [OBJ("l1", item="light.ceiling", pos=(0.5, 0.3), size={"w_m": 0.4, "d_m": 0.4, "h_m": 0.1}, z_m=2.5),
             OBJ("l2", item="light.ceiling", pos=(0.6, 0.3), size={"w_m": 0.4, "d_m": 0.4, "h_m": 0.1}, z_m=2.5, params={"power_w": 60})]
    circuit = {"id": "k1", "name": "אולם", "switch_entity_id": "switch.hall", "member_ids": ["l1", "l2"], "color_token": "circuit-1", "power_w": 0}
    saved = _save(c, vid, levels=LEVELS, objects=[tribune, *lamps], circuits=[circuit])
    assert [x["id"] for x in saved["doc"]["connectors"]] == ["cx-t1"] and saved["doc"]["connectors"][0]["kind"] == "tribune" and saved["doc"]["connectors"][0]["level_to"] == "L1"
    assert saved["doc"]["circuits"][0]["power_w"] == 96 and saved["issues"] == []
    assert c.post(f"/api/v1/plan-versions/{vid}/geometry/publish").status_code == 200
    assert [x["id"] for x in c.get(f"/api/v1/plan-versions/{vid}/geometry").json()["doc"]["connectors"]] == ["cx-t1"]
    diff = c.get(f"/api/v1/plan-versions/{vid}/geometry/diff").json()
    assert diff["diff"]["same"] is True and diff["counts"]["connectors"] == 1 and diff["counts"]["circuits"] == 1
    gone = _save(c, vid, objects=[dict(tribune, params=dict(tribune["params"], connects_levels=None)), *lamps])
    assert gone["doc"]["connectors"] == []
    # a custom item deleted from the library blocks publishing (422 geometry_invalid), not the save
    custom = c.post("/api/v1/catalog/objects", json={"based_on": "chair.basic", "names": {"he": "כיסא אולם"}}).json()
    with_custom = _save(c, vid, objects=[OBJ("c1", item=custom["id"])], circuits=[])  # the circuit's lamps are gone with the objects
    assert with_custom["issues"] == []
    assert c.delete(f"/api/v1/catalog/objects/{custom['id']}").status_code == 204
    assert [i["code"] for i in c.get(f"/api/v1/plan-versions/{vid}/geometry?draft=true").json()["issues"]] == ["unknown_item"]
    bad = c.post(f"/api/v1/plan-versions/{vid}/geometry/publish")
    assert bad.status_code == 422 and bad.json()["code"] == "geometry_invalid"


def test_stairs_linked_to_another_floor_exist_in_both_drafts_under_one_id(settings):
    app, c, ids, vid = _setup(settings)
    other = _plan(c, ids["floor3"])
    stairs = {"id": "st1", "kind": "stairs", "level_from": "L0", "level_to": None, "floor_ids": [], "polyline": [[0.7, 0.7], [0.8, 0.7]], "width_m": 1.2, "label": None,
              "object_id": None, "source": "manual", "external_ids": {}}
    saved = _save(c, vid, connectors=[stairs])
    assert [i["code"] for i in saved["issues"]] == ["connector_levels"], "not linked yet: it goes nowhere"
    assert c.post(f"/api/v1/plan-versions/{vid}/geometry/link", json={"connector_id": "st1", "floor_id": ids["floor2"]}).status_code == 422
    assert c.post(f"/api/v1/plan-versions/{vid}/geometry/link", json={"connector_id": "nope", "floor_id": ids["floor3"]}).status_code == 404
    r = c.post(f"/api/v1/plan-versions/{vid}/geometry/link", json={"connector_id": "st1", "floor_id": ids["floor3"]})
    assert r.status_code == 200, r.text
    assert r.json()["connector"]["floor_ids"] == sorted([ids["floor2"], ids["floor3"]]) and r.json()["target"] == {"floor_id": ids["floor3"], "version_id": other, "revision": 1}
    mine = c.get(f"/api/v1/plan-versions/{vid}/geometry?draft=true").json()
    theirs = c.get(f"/api/v1/plan-versions/{other}/geometry?draft=true").json()
    assert mine["issues"] == [] and theirs["issues"] == []
    assert [x["id"] for x in theirs["doc"]["connectors"]] == ["st1"] and theirs["doc"]["connectors"][0]["floor_ids"] == sorted([ids["floor2"], ids["floor3"]])
    assert theirs["doc"]["connectors"][0]["polyline"] == [[0.7, 0.7], [0.8, 0.7]] and theirs["doc"]["connectors"][0]["level_from"] == "L0"
    again = c.post(f"/api/v1/plan-versions/{vid}/geometry/link", json={"connector_id": "st1", "floor_id": ids["floor3"]})
    assert again.status_code == 200 and again.json()["target"]["revision"] == 1, "linking twice changes nothing on the other floor"
    assert len(c.get(f"/api/v1/plan-versions/{other}/geometry?draft=true").json()["doc"]["connectors"]) == 1
    # a floor without a plan cannot receive it; a derived connector cannot be linked; a viewer cannot link
    empty = c.post(f"/api/v1/buildings/{ids['building']}/floors", json={"name": "קומה 4", "level": 4}).json()
    assert c.post(f"/api/v1/plan-versions/{vid}/geometry/link", json={"connector_id": "st1", "floor_id": empty["id"]}).status_code == 409
    tribune = OBJ("t1", item="tribune.stepped", pos=(0.4, 0.6), size={"w_m": 4, "d_m": 3, "h_m": 1.2}, params={"rows": 4, "step_height_m": 0.3, "step_width_m": 1.0, "connects_levels": "L1"})
    _save(c, vid, levels=LEVELS, objects=[tribune], connectors=[dict(stairs, floor_ids=[ids["floor2"], ids["floor3"]])])
    assert c.post(f"/api/v1/plan-versions/{vid}/geometry/link", json={"connector_id": "cx-t1", "floor_id": ids["floor3"]}).status_code == 409
    bind(c, settings, "dana", "viewer", "floor", ids["floor2"])
    assert c.post(f"/api/v1/plan-versions/{vid}/geometry/link", json={"connector_id": "st1", "floor_id": ids["floor3"]}, headers=as_user("dana")).status_code == 403
    with app.state.db.connection() as conn:
        assert conn.execute("SELECT COUNT(*) FROM audit_log WHERE action = 'geometry.connector.link'").fetchone()[0] == 2
```

- [ ] **Step 2: Run to see them fail**

Run: `cd smplwise_vms/backend && MSYS_NO_PATHCONV=1 $PY -m pytest tests/test_plan_geometry_binding.py -p no:cacheprovider`
Expected: 3 FAIL (the body keeps `[0.2, 0.2]`, no derived connector in the saved draft, 404 on `/geometry/link`).

- [ ] **Step 3: The store (`services/geometry_store.py`)**

Replace `from . import plan_geometry as pg` with

```python
from . import plan_catalog
from . import plan_geometry as pg
```

and add `import copy` after `import hashlib`. Then insert before `def working_doc(`:

```python
def _prepare(conn: sqlite3.Connection, version: sqlite3.Row, doc: dict[str, Any]) -> dict[str, Any]:
    """What every document goes through on its way into the table and out to the editor: the rebase on its version
    (ids, size, calibration), the normalization (circuit power, the connectors derived from objects that connect
    levels) and the refresh of bound bodies from the floor's live anchors (design 2a, rule 1)."""
    doc = pg.rebase(doc, version, _asset(conn, version))
    doc = pg.normalize(doc, plan_catalog.item_index(conn))
    return pg.apply_anchor_positions(doc, anchor_positions(conn, version["floor_id"]))
```

Replace the body of `working_doc` with:

```python
    """The document the editor starts from: the stored draft, else a copy of the published document, else a new one -
    prepared, so bodies sit on their anchors even when the anchor moved after the last save."""
    d = draft_row(conn, version["id"])
    if d is not None:
        return _prepare(conn, version, load_doc(d)), d
    p = published_row(conn, version["id"])
    return (_prepare(conn, version, load_doc(p)) if p is not None else pg.new_document(version, _asset(conn, version))), None
```

In `save_draft` replace `    doc = pg.rebase(doc, version, _asset(conn, version))` with `    doc = _prepare(conn, version, doc)`.

In `pending_doc` replace

```python
    doc = pg.rebase(load_doc(d), version, _asset(conn, version))
    p = published_row(conn, version["id"])
    if p is not None and p["doc_hash"] == doc_hash(doc):
        return None
    if p is None and pg.is_empty(doc):
        return None
    errors = [i for i in pg.validate(doc) if i["severity"] == "error"]
```

with

```python
    doc = _prepare(conn, version, load_doc(d))
    p = published_row(conn, version["id"])
    if p is not None and p["doc_hash"] == doc_hash(doc):
        return None
    if p is None and pg.is_empty(doc):
        return None
    errors = [i for i in pg.validate(doc, plan_catalog.item_index(conn)) if i["severity"] == "error"]
```

In `rollback` replace `    doc = pg.rebase(load_doc(src), version, _asset(conn, version))` with `    doc = _prepare(conn, version, load_doc(src))`, and in `copy_published` replace `    doc = pg.rebase(load_doc(p), target, _asset(conn, target))` with `    doc = _prepare(conn, target, load_doc(p))`.

Append at the end of the file (after `anchor_positions` from Task 4):

```python
def unbind_anchor(conn: sqlite3.Connection, floor_id: str, resource_type: str, resource_id: str, actor_id: str | None, now: str | None = None,
                  last: dict[str, Any] | None = None) -> int:
    """Deleting an anchor leaves its bodies where they are, unbound: every draft of the floor loses the anchor_ref and
    keeps the anchor's last position (`last` = {x, y, rotation}, read by the delete route before the tombstone), with
    revision + 1 so an open editor sees a conflict and reloads instead of writing the reference back. Published
    documents are history and keep the reference; their bodies draw at the position last refreshed. Returns the
    drafts changed."""
    now = now or now_iso()
    changed = 0
    for d in conn.execute("SELECT * FROM plan_geometry WHERE floor_id = ? AND status = 'draft'", (floor_id,)).fetchall():
        doc = load_doc(d)
        hit = False
        for o in doc.get("objects") or []:
            ref = o.get("anchor_ref") if isinstance(o, dict) else None
            if isinstance(ref, dict) and ref.get("resource_type") == resource_type and ref.get("resource_id") == resource_id:
                o["anchor_ref"] = None
                if last is not None:
                    o["position"] = [round(float(last["x"]), 6), round(float(last["y"]), 6)]
                    o["rotation_deg"] = round(float(last.get("rotation") or 0), 3)
                hit = True
        if hit:
            conn.execute("UPDATE plan_geometry SET doc_json = ?, doc_hash = ?, revision = revision + 1, updated_at = ? WHERE id = ?",
                         (pg.canonical_json(doc), doc_hash(doc), now, d["id"]))
            changed += 1
    return changed


def anchor_issues(conn: sqlite3.Connection, floor_id: str, doc: dict[str, Any]) -> list[dict[str, Any]]:
    """A warning per bound object whose anchor is not on the floor (the anchor was deleted, or the reference was typed):
    the body stays where it is; nothing blocks."""
    have = anchor_positions(conn, floor_id)
    out: list[dict[str, Any]] = []
    for o in doc.get("objects") or []:
        ref = o.get("anchor_ref") if isinstance(o, dict) else None
        if isinstance(ref, dict) and f"{ref.get('resource_type')}:{ref.get('resource_id')}" not in have:
            out.append({"code": "anchor_missing", "severity": "warning", "structural": False, "id": o.get("id"), "path": "objects",
                        "message": "העוגן שהעצם מייצג לא קיים בקומה; העצם נשאר במקומו, לא מקושר."})
    return out


def _default_level(doc: dict[str, Any]) -> str:
    return next((lv["id"] for lv in doc.get("levels") or [] if isinstance(lv, dict) and lv.get("is_default")), pg.DEFAULT_LEVEL_ID)


def link_connector(conn: sqlite3.Connection, source: sqlite3.Row, connector_id: str, target_floor_id: str, actor_id: str | None, now: str | None = None) -> dict[str, Any]:
    """Stairs or an elevator between two floors exist in both floors' documents under the same id (design section 8,
    for T064). The source draft's connector gets both floor ids and no level_to (it leaves the floor); the target
    floor's editor version (its latest draft, else its published plan) gets the same connector on its draft - the
    polyline copied, level_from = its default level - upserted by id, so linking twice changes nothing there."""
    now = now or now_iso()
    doc, draft = working_doc(conn, source)
    item = next((c for c in doc.get("connectors") or [] if isinstance(c, dict) and c.get("id") == connector_id), None)
    if item is None:
        raise ApiError(404, "not_found", "המחבר לא נמצא בטיוטה.")
    if item.get("object_id"):
        raise conflict("derived_connector", "מחבר שנגזר מעצם (טריבונה) מחבר מפלסים באותה קומה; קשר לקומה מדרגות או מעלית שציירת.")
    target_version = conn.execute("SELECT * FROM plan_versions WHERE floor_id = ? AND status IN ('draft', 'published') "
                                  "ORDER BY CASE status WHEN 'draft' THEN 0 ELSE 1 END, created_at DESC LIMIT 1", (target_floor_id,)).fetchone()
    if target_version is None:
        raise conflict("no_plan", "לקומה השנייה אין תוכנית; העלה תוכנית לפני שמקשרים אליה.")
    floors = sorted({source["floor_id"], target_floor_id, *[f for f in item.get("floor_ids") or [] if isinstance(f, str)]})
    item["floor_ids"] = floors
    item["level_to"] = None
    save_draft(conn, source, doc, draft["revision"] if draft is not None else 0, actor_id, now)
    tdoc, tdraft = working_doc(conn, target_version)
    twin = {**copy.deepcopy(item), "level_from": _default_level(tdoc), "level_to": None, "floor_ids": floors, "source": "manual"}
    connectors = [c for c in tdoc.get("connectors") or [] if not (isinstance(c, dict) and c.get("id") == connector_id)]
    if twin in (tdoc.get("connectors") or []):
        row = tdraft
    else:
        tdoc["connectors"] = [*connectors, twin]
        row = save_draft(conn, target_version, tdoc, tdraft["revision"] if tdraft is not None else 0, actor_id, now)
    return {"connector": item, "target": {"floor_id": target_floor_id, "version_id": target_version["id"], "revision": row["revision"] if row is not None else 0}}
```

- [ ] **Step 4: The routes**

In `smplwise_vms/backend/smplwise/routers/plan_geometry.py`:

- add `from .catalog import get_floor` after `from .plans import get_version, version_row`;
- in `_payload`, replace `"issues": [i for i in pg.validate(doc) if not i["structural"]],` with `"issues": [i for i in pg.validate(doc, plan_catalog.item_index(conn)) if not i["structural"]] + store.anchor_issues(conn, version["floor_id"], doc),`;
- in `geometry_diff`, replace `"issues": [i for i in pg.validate(doc) if not i["structural"]],` with `"issues": [i for i in pg.validate(doc, plan_catalog.item_index(conn)) if not i["structural"]] + store.anchor_issues(conn, v["floor_id"], doc),`;
- after the `copy_geometry` handler add:

```python
class LinkIn(BaseModel):
    connector_id: str = Field(min_length=1, max_length=64)
    floor_id: str = Field(min_length=1, max_length=32)


@router.post("/plan-versions/{version_id}/geometry/link")
def link_connector(version_id: str, body: LinkIn, request: Request, principal: Principal = Depends(current_principal),
                   conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """Stairs / an elevator to another floor: the connector keeps one id in both floors' drafts (map.edit on both)."""
    v = _editable(conn, principal, version_id)
    if body.floor_id == v["floor_id"]:
        raise ApiError(422, "validation", "קשר לקומה אחרת, לא לאותה קומה.")
    get_floor(conn, body.floor_id)
    require(conn, principal, "map.edit", ("floor", body.floor_id))
    result = store.link_connector(conn, v, body.connector_id, body.floor_id, principal.user_id)
    audit(conn, actor=principal, action="geometry.connector.link", decision="allowed", resource_type="floor", resource_id=v["floor_id"], request_id=_rid(request),
          details={"version_id": v["id"], "connector_id": body.connector_id, "to_floor_id": body.floor_id, "target_version_id": result["target"]["version_id"]})
    return result
```

In `smplwise_vms/backend/smplwise/routers/anchors.py` (`delete_anchor`), replace

```python
    conn.execute("UPDATE map_anchors SET effective_to = ?, updated_by = ?, updated_at = ? WHERE id = ?", (now, principal.user_id, now, anchor_id))
    audit(conn, actor=principal, action="anchor.delete", decision="allowed", resource_type="floor", resource_id=a["floor_id"], request_id=_rid(request),
          details={"anchor_id": anchor_id, "resource": f"{a['resource_type']}:{a['resource_id']}"})
```

with

```python
    conn.execute("UPDATE map_anchors SET effective_to = ?, updated_by = ?, updated_at = ? WHERE id = ?", (now, principal.user_id, now, anchor_id))
    from ..services import geometry_store

    unbound = geometry_store.unbind_anchor(conn, a["floor_id"], a["resource_type"], a["resource_id"], principal.user_id, now,
                                           last={"x": a["x"], "y": a["y"], "rotation": a["rotation_degrees"] or 0})  # its bodies stay where the anchor was, unbound
    audit(conn, actor=principal, action="anchor.delete", decision="allowed", resource_type="floor", resource_id=a["floor_id"], request_id=_rid(request),
          details={"anchor_id": anchor_id, "resource": f"{a['resource_type']}:{a['resource_id']}", "unbound_bodies": unbound})
```

- [ ] **Step 5: Run the tests to see them pass**

Run: `cd smplwise_vms/backend && MSYS_NO_PATHCONV=1 $PY -m pytest tests/test_plan_geometry_binding.py tests/test_plan_geometry_store.py tests/test_plan_geometry_api.py tests/test_plan_geometry_integration.py tests/test_plan_geometry_export.py tests/test_anchor_coverage.py -p no:cacheprovider`
Expected: all pass (3 new; the phase-1 files still pass: their documents have no objects, so preparing them changes nothing).

- [ ] **Step 6: Commit**

```bash
cd /c/cloude/smplwisebms && git add smplwise_vms/backend/smplwise/services/geometry_store.py smplwise_vms/backend/smplwise/routers/plan_geometry.py smplwise_vms/backend/smplwise/routers/anchors.py smplwise_vms/backend/tests/test_plan_geometry_binding.py
msg=$(mktemp) && cat > "$msg" <<'EOF'
feat(plan-studio): bound objects follow their anchor on save and publish, un-binding on anchor delete, derived connectors stored, cross-floor connector link (T085)

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOF
test "$(bash /c/cloude/smplwisebms/secrets/scan_staged.sh)" = 0 && git commit -F "$msg"
```

---
### Task 6: Circuits server side, levels for zones and anchors, objects in the global search, the dev-only state route

**Files:**
- Modify: `smplwise_vms/backend/smplwise/services/geometry_store.py` (`levels_of`, `circuits_of`, `circuit_switches`, `published_objects`)
- Modify: `smplwise_vms/backend/smplwise/routers/anchors.py` (bundle `levels`, `circuit_states`; `level_id` on anchors)
- Modify: `smplwise_vms/backend/smplwise/routers/zones.py` (`level_id`, `ceiling_height_m`)
- Modify: `smplwise_vms/backend/smplwise/routers/ha.py` (circuit switches count as placements; `POST /ha/dev/states`)
- Modify: `smplwise_vms/backend/smplwise/routers/search.py` (`object` results)
- Test: `smplwise_vms/backend/tests/test_plan_circuits_search.py` (create)

**Interfaces:**
- Consumes: `geometry_store.published_row / draft_row / at_row / load_doc` (phase 1), `ha_sync.entity_row / upsert_state / publish / STATE`, `ha_bridge.actions_for`, `ha_history.state_at`, `plan_catalog.names_index`.
- Produces:
  - `geometry_store.levels_of(row) -> list[level]` (`[]` for None), `circuits_of(row) -> list[circuit]`, `circuit_switches(conn) -> dict[entity_id, list[floor_id]]` (published documents of published plan versions; one parse per `doc_hash`, cache bounded to 256 hashes), `published_objects(conn) -> dict[floor_id, list[{id, item_id, label, level_id, position}]]` (same bound).
  - `GET /floors/{id}/map` → `levels: [...]` (of the document the reference names) and `circuit_states: {circuit_id: {entity_id, name, color_token, member_ids, power_w, state, known, fresh, available, can_control, actions}}` (`actions` = the switch / light `turn_on` / `turn_off` specs when the caller may control on the floor and the bundle is live; empty in a historical bundle); anchors carry `level_id`; `POST /floors/{id}/anchors` and `PATCH /map-anchors/{id}` take `level_id` (`""` clears).
  - `GET /floors/{id}/zones` etc.: zones carry `level_id`, `ceiling_height_m`; `PATCH /zones/{id}` takes both (`""` / `0` clear).
  - `routers/ha._placements` includes the circuit switches of published documents (so `_entity_allowed`, the catalogue's `placed` filter and the WebSocket scope treat them as placed on the floor).
  - `POST /ha/dev/states` body `{states: [{entity_id, state, attributes?}]}` → `{entities: [rows]}`; 404 unless developer identity mode (`settings.dev_user` and not `in_addon`); needs `system.configure`; audit `ha.dev.states`. Helper `_dev_only(settings)`.
  - `GET /search?q=` → results of kind `object` `{id, title, subtitle, route: "/explore/floors/<fid>?focus=object:<id>", floor_id}`, counted in `counts.object`.

- [ ] **Step 1: Write the failing tests**

```python
"""Plan Studio circuits, levels and search, server side (T085): the map bundle carries the published levels and the
state of every circuit's switch (control only with ha.entity.control on the floor, never in a historical bundle); a
circuit's switch counts as placed on the floor for scope, so a floor operator toggles it through the existing entity
action route and a floor viewer only reads it; zones and anchors take a level; the global search finds objects of
published documents by label or library name; the developer-only state route feeds the live spec."""
from __future__ import annotations

import datetime as dt
from dataclasses import replace

import pytest
from conftest import as_user, bind, png_bytes, seed_tree
from fastapi.testclient import TestClient

from smplwise.errors import ApiError
from smplwise.main import create_app
from smplwise.routers import ha as ha_router
from smplwise.services import ha_sync

LEVELS = [{"id": "L0", "name": "מפלס ראשי", "elevation_m": 0.0, "ceiling_height_m": 2.8, "is_default": True, "external_ids": {}},
          {"id": "L1", "name": "אולם תחתון", "elevation_m": -1.2, "ceiling_height_m": 6.0, "is_default": False, "external_ids": {}}]


def OBJ(oid: str, item: str, pos, **kw) -> dict:
    o = {"id": oid, "item_id": item, "level_id": "L0", "position": list(pos), "rotation_deg": 0, "size": {"w_m": 0.4, "d_m": 0.4, "h_m": 0.1}, "z_m": 2.5, "params": {},
         "label": None, "anchor_ref": None, "group_id": None, "confidence": 1, "source": "manual", "locked": False, "external_ids": {}}
    o.update(kw)
    return o


def _state(app, entity_id: str, state: str) -> None:
    now = dt.datetime.now(dt.timezone.utc).isoformat()
    with app.state.db.connection() as conn:
        ha_sync.upsert_state(conn, {"entity_id": entity_id, "state": state, "attributes": {"friendly_name": entity_id}, "last_changed": now, "last_updated": now})


def _setup(settings):
    app = create_app(settings)
    c = TestClient(app)
    ids = seed_tree(c)
    asset = c.post(f"/api/v1/floors/{ids['floor2']}/plan-assets", files={"file": ("plan.png", png_bytes(), "image/png")}).json()
    v = c.post(f"/api/v1/floors/{ids['floor2']}/plan-versions", json={"asset_id": asset["id"]}).json()
    assert c.post(f"/api/v1/plan-versions/{v['id']}/publish").status_code == 200
    return app, c, ids, v["id"]


def _publish(c, vid, **fields):
    g = c.get(f"/api/v1/plan-versions/{vid}/geometry?draft=true").json()
    r = c.put(f"/api/v1/plan-versions/{vid}/geometry", json={"doc": dict(g["doc"], **fields), "base_revision": g["geometry"]["revision"]})
    assert r.status_code == 200, r.text
    p = c.post(f"/api/v1/plan-versions/{vid}/geometry/publish")
    assert p.status_code == 200, p.text
    return r.json()


CIRCUITS = [{"id": "k1", "name": "אולם צפון", "switch_entity_id": "switch.hall_a", "member_ids": ["l1", "l2"], "color_token": "circuit-1", "power_w": 0},
            {"id": "k2", "name": "אולם דרום", "switch_entity_id": "switch.hall_b", "member_ids": ["l3"], "color_token": "circuit-2", "power_w": 0}]
LAMPS = [OBJ("l1", "light.ceiling", (0.3, 0.3)), OBJ("l2", "light.ceiling", (0.4, 0.3)), OBJ("l3", "light.ceiling", (0.6, 0.3))]


def test_the_bundle_carries_levels_and_circuit_states_and_a_switch_counts_as_placed(settings):
    app, c, ids, vid = _setup(settings)
    _state(app, "switch.hall_a", "on")
    _state(app, "switch.hall_b", "off")
    m = c.get(f"/api/v1/floors/{ids['floor2']}/map").json()
    assert m["levels"] == [] and m["circuit_states"] == {}, "nothing published yet"
    _publish(c, vid, levels=LEVELS, objects=LAMPS, circuits=CIRCUITS)
    m = c.get(f"/api/v1/floors/{ids['floor2']}/map").json()
    assert [lv["id"] for lv in m["levels"]] == ["L0", "L1"] and m["levels"][1]["elevation_m"] == -1.2
    k1 = m["circuit_states"]["k1"]
    assert k1["entity_id"] == "switch.hall_a" and k1["state"] == "on" and k1["known"] is True and k1["can_control"] is True and k1["member_ids"] == ["l1", "l2"]
    assert k1["power_w"] == 72 and k1["name"] == "אולם צפון" and k1["color_token"] == "circuit-1"
    assert [a["id"] for a in k1["actions"]] == ["switch.turn_on", "switch.turn_off"]
    assert m["circuit_states"]["k2"]["state"] == "off"
    # a floor viewer reads the state but cannot control; the switch counts as placed on the floor for scope
    bind(c, settings, "vera", "viewer", "floor", ids["floor2"])
    bind(c, settings, "omer", "operator", "floor", ids["floor2"])
    bind(c, settings, "ron", "viewer", "floor", ids["floor3"])
    v = c.get(f"/api/v1/floors/{ids['floor2']}/map", headers=as_user("vera")).json()["circuit_states"]["k1"]
    assert v["state"] == "on" and v["can_control"] is False and v["actions"] == []
    assert c.get(f"/api/v1/floors/{ids['floor2']}/map", headers=as_user("omer")).json()["circuit_states"]["k1"]["can_control"] is True
    e = c.get("/api/v1/ha/entities/switch.hall_a", headers=as_user("vera"))
    assert e.status_code == 200 and [p["floor_id"] for p in e.json()["placements"]] == [ids["floor2"]] and e.json()["can_control"] is False
    assert c.get("/api/v1/ha/entities/switch.hall_a", headers=as_user("ron")).status_code == 403
    assert [x["entity_id"] for x in c.get("/api/v1/ha/entities?placed=true", headers=as_user("vera")).json()["entities"]] == ["switch.hall_a", "switch.hall_b"]
    # a historical bundle carries the state of its instant and never control
    at = (dt.datetime.now(dt.timezone.utc) + dt.timedelta(seconds=2)).strftime("%Y-%m-%dT%H:%M:%SZ")
    h = c.get(f"/api/v1/floors/{ids['floor2']}/map?at={at}").json()
    assert h["history"] == "exact" and h["circuit_states"]["k1"]["can_control"] is False and h["circuit_states"]["k1"]["actions"] == []
    assert h["circuit_states"]["k1"]["state"] == "on", "the local HA history knows the state recorded a moment ago"


def test_the_toggle_uses_the_existing_entity_action_route_and_its_permission(settings):
    app, c, ids, vid = _setup(settings)
    _state(app, "switch.hall_a", "off")
    _publish(c, vid, levels=LEVELS, objects=LAMPS[:2], circuits=CIRCUITS[:1])
    bind(c, settings, "vera", "viewer", "floor", ids["floor2"])
    bind(c, settings, "omer", "operator", "floor", ids["floor2"])
    body = {"allowed_action_id": "switch.turn_on", "arguments": {}, "expected_state_version": None, "confirmation_grant": None, "client_request_id": "c1", "expires_at": "2099-01-01T00:00:00Z"}
    assert c.post("/api/v1/ha/entities/switch.hall_a/actions", json=body, headers=as_user("vera")).status_code == 403, "reading a circuit grants no control"
    r = c.post("/api/v1/ha/entities/switch.hall_a/actions", json=body, headers=as_user("omer"))
    assert r.status_code == 503 and r.json()["code"] == "bridge_not_paired", "the floor operator reaches the existing action path (no bridge in the test)"
    with app.state.db.connection() as conn:
        assert conn.execute("SELECT COUNT(*) FROM ha_actions WHERE entity_id = 'switch.hall_a'").fetchone()[0] == 1


def test_zones_and_anchors_take_a_level(settings):
    app, c, ids, vid = _setup(settings)
    _publish(c, vid, levels=LEVELS)
    z = c.post(f"/api/v1/floors/{ids['floor2']}/zones", json={"name": "אולם", "polygon": [{"x": 0.1, "y": 0.1}, {"x": 0.4, "y": 0.1}, {"x": 0.4, "y": 0.3}]}).json()
    assert z["level_id"] is None and z["ceiling_height_m"] is None
    z2 = c.patch(f"/api/v1/zones/{z['id']}", json={"revision": 1, "level_id": "L1", "ceiling_height_m": 5}).json()
    assert z2["level_id"] == "L1" and z2["ceiling_height_m"] == 5
    assert c.patch(f"/api/v1/zones/{z['id']}", json={"revision": 2, "level_id": "", "ceiling_height_m": 0}).json()["level_id"] is None
    assert c.get(f"/api/v1/floors/{ids['floor2']}/map").json()["zones"][0]["ceiling_height_m"] is None
    cam = c.post("/api/v1/cameras", json={"channel": 1, "alias": "אולם"}).json()
    a = c.post(f"/api/v1/floors/{ids['floor2']}/anchors", json={"resource_type": "camera", "resource_id": cam["id"], "x": 0.3, "y": 0.3, "level_id": "L1"}).json()
    assert a["level_id"] == "L1"
    assert c.patch(f"/api/v1/map-anchors/{a['id']}", json={"revision": 1, "level_id": ""}).json()["level_id"] is None
    assert c.patch(f"/api/v1/map-anchors/{a['id']}", json={"revision": 2, "level_id": "L0"}).json()["level_id"] == "L0"
    assert c.get(f"/api/v1/floors/{ids['floor2']}/map").json()["anchors"][0]["level_id"] == "L0"


def test_global_search_finds_objects_of_published_documents(settings):
    app, c, ids, vid = _setup(settings)
    objects = [OBJ("x1", "extinguisher.co2", (0.15, 0.8), label="מטף כניסה", size={"w_m": 0.2, "d_m": 0.2, "h_m": 0.6}, z_m=0.9),
               OBJ("x2", "chair.basic", (0.2, 0.2), size={"w_m": 0.45, "d_m": 0.45, "h_m": 0.85}, z_m=0)]
    _publish(c, vid, objects=objects)
    r = c.get("/api/v1/search?q=מטף").json()
    hits = [x for x in r["results"] if x["kind"] == "object"]
    assert len(hits) == 1 and r["counts"]["object"] == 1
    assert hits[0] == {"kind": "object", "id": "x1", "title": "מטף כניסה", "subtitle": f"מטף CO2 · מבנה א · קומה 2", "route": f"/explore/floors/{ids['floor2']}?focus=object:x1", "floor_id": ids["floor2"]}
    assert [x["id"] for x in c.get("/api/v1/search?q=co2").json()["results"] if x["kind"] == "object"] == ["x1"], "the English name and the tags count"
    assert [x["title"] for x in c.get("/api/v1/search?q=כיסא").json()["results"] if x["kind"] == "object"] == ["כיסא"], "no label: the library name"
    # a draft-only object is not searchable; a viewer of another floor sees nothing
    g = c.get(f"/api/v1/plan-versions/{vid}/geometry?draft=true").json()
    c.put(f"/api/v1/plan-versions/{vid}/geometry", json={"doc": dict(g["doc"], objects=[*objects, OBJ("x3", "aed.wall", (0.5, 0.5), label="AED מסדרון", size={"w_m": 0.4, "d_m": 0.2, "h_m": 0.4}, z_m=1.2)]), "base_revision": g["geometry"]["revision"]})
    assert [x["kind"] for x in c.get("/api/v1/search?q=AED").json()["results"]] == []
    bind(c, settings, "ron", "viewer", "floor", ids["floor3"])
    assert c.get("/api/v1/search?q=מטף", headers=as_user("ron")).json()["results"] == []


def test_the_dev_state_route_exists_only_in_developer_mode(settings):
    app, c, ids, vid = _setup(settings)
    r = c.post("/api/v1/ha/dev/states", json={"states": [{"entity_id": "switch.hall_a", "state": "on", "attributes": {"friendly_name": "Hall A"}}]})
    assert r.status_code == 200, r.text
    assert r.json()["entities"][0]["state"] == "on" and c.get("/api/v1/ha/entities/switch.hall_a").json()["state"] == "on"
    assert c.post("/api/v1/ha/dev/states", json={"states": [{"state": "on"}]}).status_code == 422
    bind(c, settings, "vera", "viewer", "floor", ids["floor2"])
    assert c.post("/api/v1/ha/dev/states", json={"states": [{"entity_id": "switch.hall_a", "state": "off"}]}, headers=as_user("vera")).status_code == 403
    with pytest.raises(ApiError) as exc:
        ha_router._dev_only(replace(settings, in_addon=True))
    assert exc.value.status == 404
    with pytest.raises(ApiError):
        ha_router._dev_only(replace(settings, dev_user=None))
    ha_router._dev_only(settings)
    with app.state.db.connection() as conn:
        assert conn.execute("SELECT COUNT(*) FROM audit_log WHERE action = 'ha.dev.states'").fetchone()[0] == 1
```

- [ ] **Step 2: Run to see them fail**

Run: `cd smplwise_vms/backend && MSYS_NO_PATHCONV=1 $PY -m pytest tests/test_plan_circuits_search.py -p no:cacheprovider`
Expected: 5 FAIL (`KeyError: 'levels'`, 403 for the operator, `KeyError: 'level_id'`, no object results, 404 on `/ha/dev/states`).

- [ ] **Step 3: The store helpers (`services/geometry_store.py`, append)**

```python
# ---------------------------------------------------------------- what the bundle, the scope and the search read (phase 2)

_SWITCH_CACHE: dict[str, list[str]] = {}
_OBJECT_CACHE: dict[str, list[dict[str, Any]]] = {}
_CACHE_MAX = 256


def levels_of(row: sqlite3.Row | None) -> list[dict[str, Any]]:
    """The levels of the document a bundle reference names (the live map offers the same level filter as the editor)."""
    if row is None:
        return []
    levels = load_doc(row).get("levels")
    return [lv for lv in levels if isinstance(lv, dict)] if isinstance(levels, list) else []


def circuits_of(row: sqlite3.Row | None) -> list[dict[str, Any]]:
    if row is None:
        return []
    circuits = load_doc(row).get("circuits")
    return [c for c in circuits if isinstance(c, dict) and isinstance(c.get("id"), str) and isinstance(c.get("switch_entity_id"), str)] if isinstance(circuits, list) else []


def _cached(cache: dict[str, Any], row: sqlite3.Row, build) -> Any:
    hit = cache.get(row["doc_hash"])
    if hit is None:
        hit = build(load_doc(row))
        if len(cache) >= _CACHE_MAX:
            cache.clear()
        cache[row["doc_hash"]] = hit
    return hit


def _current_published(conn: sqlite3.Connection) -> list[sqlite3.Row]:
    """The published structure of every floor's published plan version - the only documents the live map, the scope
    and the search read."""
    return conn.execute("SELECT g.floor_id, g.plan_version_id, g.doc_hash, g.doc_json FROM plan_geometry g JOIN plan_versions v ON v.id = g.plan_version_id "
                        "WHERE g.status = 'published' AND v.status = 'published'").fetchall()


def circuit_switches(conn: sqlite3.Connection) -> dict[str, list[str]]:
    """The switch entity of every circuit in a published document, keyed entity id -> floor ids: for scope purposes such
    a switch counts as placed on the floor (a floor viewer reads its state, a floor operator toggles it through the
    entity action route). One parse per document hash, bounded."""
    out: dict[str, list[str]] = {}
    for r in _current_published(conn):
        for eid in _cached(_SWITCH_CACHE, r, lambda doc: sorted({c["switch_entity_id"] for c in doc.get("circuits") or [] if isinstance(c, dict) and isinstance(c.get("switch_entity_id"), str)})):
            out.setdefault(eid, []).append(r["floor_id"])
    return out


def published_objects(conn: sqlite3.Connection) -> dict[str, list[dict[str, Any]]]:
    """What the global search scans: the objects of every published document, keyed by floor - id, item, label, level
    and position. One parse per document hash, bounded."""
    out: dict[str, list[dict[str, Any]]] = {}
    for r in _current_published(conn):
        entries = _cached(_OBJECT_CACHE, r, lambda doc: [{"id": o["id"], "item_id": str(o.get("item_id") or ""), "label": o.get("label") or None, "level_id": o.get("level_id"), "position": o.get("position")}
                                                         for o in doc.get("objects") or [] if isinstance(o, dict) and isinstance(o.get("id"), str)])
        if entries:
            out.setdefault(r["floor_id"], []).extend(entries)
    return out
```

- [ ] **Step 4: The bundle and the anchors (`routers/anchors.py`)**

In `anchor_row`, replace `        "label_pos": r["label_pos"] or "auto",` with

```python
        "label_pos": r["label_pos"] or "auto",
        "level_id": r["level_id"] if "level_id" in r.keys() else None,
```

In `AnchorIn`, after `    layer_id: str = Field(default="cameras", max_length=40)` add `    level_id: str | None = Field(default=None, max_length=64)`; in `AnchorPatch`, after `    layer_id: str | None = Field(default=None, max_length=40)` add `    level_id: str | None = Field(default=None, max_length=64)`.

In `create_anchor`, replace the INSERT statement's column list and values: `…, coverage_radius, coverage_polygon, label_pos)` / `VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?)""",` / `…, body.coverage_radius, _check_polygon(body.coverage_polygon), body.label_pos),` become `…, coverage_radius, coverage_polygon, label_pos, level_id)` / `VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?)""",` / `…, body.coverage_radius, _check_polygon(body.coverage_polygon), body.label_pos, body.level_id or None),`.

In `update_anchor`, after `    if "coverage_polygon" in fields:` … `fields["coverage_polygon"] = _check_polygon(fields["coverage_polygon"])` add:

```python
    if "level_id" in fields:
        fields["level_id"] = fields["level_id"] or None  # "" clears: back to the floor's default level
```

In `floor_map`, replace the block

```python
    geometry = None
    if version is not None:
        if at_iso and history == "exact":
            geometry = geometry_store.ref(geometry_store.at_row(conn, version["id"], at_iso))
        elif draft and can_edit and can_structure and not at_iso:
            geometry = geometry_store.ref(geometry_store.draft_row(conn, version["id"]) or geometry_store.published_row(conn, version["id"]))
        else:
            geometry = geometry_store.ref(geometry_store.published_row(conn, version["id"]))
```

with

```python
    geometry_row = None
    if version is not None:
        if at_iso and history == "exact":
            geometry_row = geometry_store.at_row(conn, version["id"], at_iso)
        elif draft and can_edit and can_structure and not at_iso:
            geometry_row = geometry_store.draft_row(conn, version["id"]) or geometry_store.published_row(conn, version["id"])
        else:
            geometry_row = geometry_store.published_row(conn, version["id"])
    geometry = geometry_store.ref(geometry_row)
    levels = geometry_store.levels_of(geometry_row)
    circuits = geometry_store.circuits_of(geometry_row)
```

and after the `if at_iso:\n        ha_hist = ha_history.coverage(conn)` block add:

```python
    circuit_states: dict[str, Any] = {}
    if circuits:
        # The switch of a circuit is the live state of its lamps (design 2a, rule 2). Reading needs nothing beyond the
        # floor's map.read; control is the floor's ha.entity.control, exercised through the entity action route.
        control = authorize(conn, principal, "ha.entity.control", ("floor", floor_id)).allowed and not at_iso
        switch_ids = sorted({c["switch_entity_id"] for c in circuits})
        rows = {r["entity_id"]: ha_sync.entity_row(r) for r in conn.execute(f"SELECT * FROM ha_entities WHERE entity_id IN ({','.join('?' * len(switch_ids))})", switch_ids).fetchall()}
        hist = ha_history.state_at(conn, switch_ids, at_iso) if at_iso else {}
        for c in circuits:
            e = rows.get(c["switch_entity_id"])
            past = hist.get(c["switch_entity_id"], {})
            state = past.get("state") if at_iso else (e["state"] if e else None)
            circuit_states[c["id"]] = {
                "entity_id": c["switch_entity_id"], "name": c.get("name"), "color_token": c.get("color_token"), "member_ids": list(c.get("member_ids") or []), "power_w": c.get("power_w"),
                "state": state, "known": bool(past.get("known")) if at_iso else e is not None, "fresh": bool(e and e["fresh"]) and not at_iso, "available": bool(e and e["available"]),
                "can_control": bool(control and e is not None and not e["removed_at"]),
                "actions": [a for a in ha_bridge.actions_for(e["domain"]) if a["id"].endswith(("turn_on", "turn_off"))] if (control and e is not None and not e["removed_at"]) else [],
            }
```

and in the return dict, after `        "catalog_revision": plan_catalog.revision(conn),` add:

```python
        "levels": levels,
        "circuit_states": circuit_states,
```

- [ ] **Step 5: Zones (`routers/zones.py`)**

In `zone_row` replace `        "searchable": bool(r["searchable"]),` with

```python
        "searchable": bool(r["searchable"]),
        "level_id": r["level_id"] if "level_id" in r.keys() else None,
        "ceiling_height_m": r["ceiling_height_m"] if "ceiling_height_m" in r.keys() else None,
```

In `ZonePatch`, after `    searchable: bool | None = None` add:

```python
    level_id: str | None = Field(default=None, max_length=64)
    ceiling_height_m: float | None = Field(default=None, ge=0, le=50)
```

In `update_zone`, after `    if body.searchable is not None:\n        fields["searchable"] = 1 if body.searchable else 0` add:

```python
    if body.level_id is not None:
        fields["level_id"] = body.level_id or None  # "" = the floor's default level
    if body.ceiling_height_m is not None:
        fields["ceiling_height_m"] = body.ceiling_height_m or None  # 0 = the level's ceiling
```

- [ ] **Step 6: HA scope and the dev route (`routers/ha.py`)**

Replace `_placements` with:

```python
def _placements(conn: sqlite3.Connection) -> dict[str, list[dict[str, str]]]:
    """Where an entity is on the maps: its anchors, and the floors whose published structure has a circuit switched by
    it (T085) - a floor viewer reads such a switch, a floor operator controls it, the push socket forwards it."""
    out: dict[str, list[dict[str, str]]] = {}
    for r in conn.execute(
        "SELECT a.resource_id, a.floor_id, f.name AS floor_name FROM map_anchors a JOIN floors f ON f.id = a.floor_id WHERE a.resource_type = 'ha_entity' AND a.effective_to IS NULL"
    ).fetchall():
        out.setdefault(r["resource_id"], []).append({"floor_id": r["floor_id"], "floor_name": r["floor_name"]})
    from ..services import geometry_store

    switches = geometry_store.circuit_switches(conn)
    if switches:
        names = {r["id"]: r["name"] for r in conn.execute("SELECT id, name FROM floors WHERE deleted_at IS NULL").fetchall()}
        for eid, floors in switches.items():
            have = {p["floor_id"] for p in out.get(eid, [])}
            for fid in floors:
                if fid in names and fid not in have:
                    out.setdefault(eid, []).append({"floor_id": fid, "floor_name": names[fid]})
                    have.add(fid)
    return out
```

After the `get_action` handler (before `# ---- bridge pairing + directory`), add:

```python
# ---------------------------------------------------------------- developer identity mode only

class DevStatesIn(BaseModel):
    states: list[dict[str, Any]] = Field(min_length=1, max_length=50)


def _dev_only(settings: Settings) -> None:
    """The route exists only where SW_DEV_USER runs the backend outside the add-on: inside Home Assistant it is a 404."""
    if settings.in_addon or not settings.dev_user:
        raise ApiError(404, "not_found", "לא נמצא.")


@router.post("/ha/dev/states")
def dev_states(body: DevStatesIn, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """Inject entity states as if Home Assistant sent them (the same upsert and the same push the sync uses), for live
    specs and manual checks without a Home Assistant. Developer identity mode only; system.configure; audited."""
    _dev_only(settings_of(request))
    require(conn, principal, "system.configure", INSTALLATION)
    now = now_iso()
    rows = []
    for st in body.states:
        eid = st.get("entity_id")
        if not isinstance(eid, str) or "." not in eid:
            raise ApiError(422, "validation", "לכל מצב צריך entity_id.")
        row = ha_sync.upsert_state(conn, {"entity_id": eid, "state": str(st.get("state")), "attributes": st.get("attributes") or {}, "last_changed": now, "last_updated": now})
        ha_sync.STATE.sequence += 1
        ha_sync.publish({"type": "entity_state_changed", "sequence": ha_sync.STATE.sequence, "entity": row})
        rows.append(row)
    audit(conn, actor=principal, action="ha.dev.states", decision="allowed", resource_type="installation", resource_id="*", request_id=getattr(request.state, "correlation_id", None),
          details={"entities": [r["entity_id"] for r in rows]})
    return {"entities": rows}
```

- [ ] **Step 7: Objects in the search (`routers/search.py`)**

After the HA entities loop (before `    return {"q": q, "results": results, "counts": counts}`) add:

```python
    # objects of the published structure of each visible floor: by their label or their library name (he / en / tags)
    from ..services import geometry_store, plan_catalog

    names = plan_catalog.names_index(conn)
    for fid, entries in geometry_store.published_objects(conn).items():
        if not floor_ok(fid):
            continue
        f = floors[fid]
        for o in entries:
            n = names.get(o["item_id"]) or {"he": o["item_id"], "en": "", "tags": []}
            if not any(_contains(h, needle) for h in (o["label"], n["he"], n["en"], *n["tags"])):
                continue
            add("object", {"id": o["id"], "title": o["label"] or n["he"], "subtitle": f"{n['he']} · {f['building_name']} · {f['name']}",
                           "route": f"/explore/floors/{fid}?focus=object:{o['id']}", "floor_id": fid})
```

- [ ] **Step 8: Run the tests to see them pass**

Run: `cd smplwise_vms/backend && MSYS_NO_PATHCONV=1 $PY -m pytest tests/test_plan_circuits_search.py tests/test_ha.py tests/test_ha_authority.py tests/test_search.py tests/test_zones.py tests/test_anchor_coverage.py tests/test_plan_geometry_integration.py tests/test_rbac_matrix.py -p no:cacheprovider`
Expected: all pass (5 new; the HA, search, zones and anchor files unchanged in outcome).

- [ ] **Step 9: Commit**

```bash
cd /c/cloude/smplwisebms && git add smplwise_vms/backend/smplwise/services/geometry_store.py smplwise_vms/backend/smplwise/routers/anchors.py smplwise_vms/backend/smplwise/routers/zones.py smplwise_vms/backend/smplwise/routers/ha.py smplwise_vms/backend/smplwise/routers/search.py smplwise_vms/backend/tests/test_plan_circuits_search.py
msg=$(mktemp) && cat > "$msg" <<'EOF'
feat(plan-studio): circuit states and levels in the map bundle, circuit switches in the HA scope, level on zones and anchors, objects in the global search, dev-only state route (T085)

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOF
test "$(bash /c/cloude/smplwisebms/secrets/scan_staged.sh)" = 0 && git commit -F "$msg"
```

---
### Task 7: Frontend types, API clients and the primitives mirror (objects, connectors, anchor refresh), node specs

**Files:**
- Modify: `frontend/src/map/geometry.ts`
- Create: `frontend/src/api/plan-catalog.ts`
- Modify: `frontend/src/api/types.ts`, `frontend/src/api/maps.ts`, `frontend/src/api/zones.ts`, `frontend/src/api/search.ts`, `frontend/src/api/geometry.ts`
- Modify: `frontend/tests/unit-studio-controller.spec.ts` (typed object literals)
- Test: `frontend/tests/unit-geometry-2.spec.ts` (create)

**Interfaces:**
- Consumes: the golden `contracts/fixtures/plan_geometry/sample-v2.primitives.json` and `smplwise_vms/backend/smplwise/catalog/objects.json` (Tasks 1, 4); `GET /catalog/objects` (Task 2); bundle fields (Task 6).
- Produces (`geometry.ts`): types `ObjectShape`, `ConnectorKind`, `GroupKind`, `GeomSize`, `GeomObject`, `GeomGroup`, `GeomConnector`, `GeomCircuit`, `ConnectorPrim`, `ObjectPrim` (added to `Primitive`), `CatalogShape`, `CatalogLookup`, `AnchorPosition`, `SymbolId`; constants `SYMBOL_IDS` (24), `OBJECT_SHAPES`, `COLOR_TOKENS`, `ARROW_PX = 14`; `GeometryDoc.objects / circuits / connectors / groups` typed; `buildPrimitives(doc, W, H, level = null, catalog?: CatalogLookup)` emits connectors then objects after the phase-1 primitives; `rotated(cx, cy, x, y, theta): Pt`, `objectCorners(o, W, H, scale): Pt[]`, `connectorLabel(levels: Map<string, GeomLevel>, c): string`, `applyAnchorPositions(doc, positions): GeometryDoc`.
- Produces (`api/plan-catalog.ts`): `ParamSpec`, `CatalogItem`, `CatalogCategory`, `CatalogLibrary`, `CustomItemBody`; `loadLibrary(revision?) -> Promise<CatalogLibrary>` (cached until the revision differs), `invalidateLibrary()`, `lookupOf(lib): CatalogLookup`, `itemOf(lib, id)`, `searchItems(items, q, category)`, `createItem`, `updateItem`, `deleteItem`, `importItems`, `exportUrl()`.
- Produces (`api/types.ts`): `CircuitState`; `Anchor.level_id?`, `SpatialZone.level_id? / ceiling_height_m?`, `FloorMap.catalog_revision? / levels? / circuit_states?`. (`api/maps.ts`): `MapBundle.catalogRevision / levels / circuitStates`; `createAnchor` / `updateAnchor` bodies take `level_id`. (`api/zones.ts`): `updateZone` body takes `level_id`, `ceiling_height_m`. (`api/search.ts`): kind `object` with label `עצם` and icon `grid`. (`api/geometry.ts`): `GeometryCounts` + `connectors / circuits / levels / groups`; `exportUrl(versionId, fmt, { draft?, layers? })`; `linkConnector(versionId, connectorId, floorId)`.

- [ ] **Step 1: Write the failing node spec**

`frontend/tests/unit-geometry-2.spec.ts`:

```ts
import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { applyAnchorPositions, buildPrimitives, connectorLabel, objectCorners, SYMBOL_IDS, type CatalogLookup, type GeometryDoc, type GeomLevel, type ObjectPrim, type ObjectShape, type Primitive } from '../src/map/geometry';
import { searchItems, type CatalogItem } from '../src/api/plan-catalog';

// Plan Studio phase 2 (T085): the object and connector primitives equal the backend renderer's (the extended golden
// file), a missing item draws as a box, the connector label and the anchor refresh mirror the Python, and the library
// search finds items by Hebrew / English names and tags. Runs in node: no page, no backend.
const HERE = path.dirname(fileURLToPath(import.meta.url));
const FIX = path.resolve(HERE, '..', '..', 'contracts', 'fixtures', 'plan_geometry');
const CATALOG = path.resolve(HERE, '..', '..', 'smplwise_vms', 'backend', 'smplwise', 'catalog', 'objects.json');
const sample = () => JSON.parse(fs.readFileSync(path.join(FIX, 'sample-v2.json'), 'utf8')) as GeometryDoc;
const golden = JSON.parse(fs.readFileSync(path.join(FIX, 'sample-v2.primitives.json'), 'utf8')) as { all: Primitive[]; level_L1: Primitive[] };
const library = JSON.parse(fs.readFileSync(CATALOG, 'utf8')) as { items: CatalogItem[] };
const byId = new Map(library.items.map((i) => [i.id, i]));
const lookup: CatalogLookup = (id) => {
  const i = byId.get(id);
  return i ? { shape: i.shape as ObjectShape, icon: i.icon, color_token: i.color_token } : undefined;
};

/** Deep comparison with a 0.011 px tolerance on numbers (Math.hypot and the C library may differ in the last bit). */
function close(a: unknown, b: unknown, where = ''): void {
  if (typeof a === 'number' && typeof b === 'number') {
    expect(Math.abs(a - b), `${where}: ${a} vs ${b}`).toBeLessThanOrEqual(0.011);
    return;
  }
  if (Array.isArray(a) && Array.isArray(b)) {
    expect(a.length, `${where} length`).toBe(b.length);
    a.forEach((x, i) => close(x, b[i], `${where}[${i}]`));
    return;
  }
  if (a && b && typeof a === 'object' && typeof b === 'object') {
    expect(Object.keys(a).sort(), `${where} keys`).toEqual(Object.keys(b).sort());
    for (const k of Object.keys(a)) close((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k], `${where}.${k}`);
    return;
  }
  expect(a, where).toEqual(b);
}

test.describe('plan studio objects and connectors (unit)', () => {
  test('the map draws exactly what the backend exports, objects and connectors included', () => {
    const all = buildPrimitives(sample(), 1000, 800, null, lookup);
    expect(all.length).toBe(24);
    close(all, golden.all, 'all');
    const l1 = buildPrimitives(sample(), 1000, 800, 'L1', lookup);
    expect(l1.length).toBe(7);
    close(l1, golden.level_L1, 'L1');
    expect(all.map((p) => p.kind).slice(15)).toEqual(['label', 'label', 'connector', 'connector', 'object', 'object', 'object', 'object', 'object']);
  });

  test('a missing item draws as a plain box; the symbol ids are the 24 known ones', () => {
    const o1 = buildPrimitives(sample(), 1000, 800, null, () => undefined).find((p) => p.id === 'o1') as ObjectPrim;
    expect([o1.shape, o1.icon, o1.color]).toEqual(['box', 'box', 'object']);
    expect(SYMBOL_IDS.length).toBe(24);
    expect(new Set(library.items.map((i) => i.icon))).toEqual(new Set(SYMBOL_IDS));
  });

  test('connector labels and the corners of a turned footprint', () => {
    const levels = new Map<string, GeomLevel>(sample().levels.map((l) => [l.id, l]));
    expect(connectorLabel(levels, { level_from: 'L0', level_to: 'L1', label: null })).toBe('↓ −1.2 מ׳');
    expect(connectorLabel(levels, { level_from: 'L1', level_to: 'L0', label: null })).toBe('↑ +1.2 מ׳');
    expect(connectorLabel(levels, { level_from: 'L0', level_to: null, label: null })).toBe('↕');
    expect(connectorLabel(levels, { level_from: 'L0', level_to: 'L1', label: 'לגלריה' })).toBe('לגלריה');
    const o2 = sample().objects.find((o) => o.id === 'o2')!;
    close(objectCorners(o2, 1000, 800, 0.01), [[335, 250], [335, 390], [265, 390], [265, 250]], 'o2');
  });

  test('a bound body follows its anchor; the input document is untouched', () => {
    const doc = sample();
    const moved = applyAnchorPositions(doc, { 'ha_entity:light.store': { x: 0.9123456789, y: 0.9, rotation: 45 } });
    const o3 = moved.objects.find((o) => o.id === 'o3')!;
    expect(o3.position).toEqual([0.912346, 0.9]);
    expect(o3.rotation_deg).toBe(45);
    expect(doc.objects.find((o) => o.id === 'o3')!.position).toEqual([0.5, 0.3]);
    expect((buildPrimitives(moved, 1000, 800, null, lookup).find((p) => p.id === 'o3') as ObjectPrim).cx).toBe(912.35);
  });

  test('the library search matches Hebrew and English names and tags, any category', () => {
    const items = library.items;
    expect(searchItems(items, 'כיסא', null).map((i) => i.id)).toContain('chair.basic');
    expect(searchItems(items, 'bleachers', null).map((i) => i.id)).toEqual(['tribune.stepped']);
    expect(searchItems(items, 'יציע', null).map((i) => i.id).sort()).toEqual(['bleacher.mobile', 'tribune.stepped']);
    expect(searchItems(items, 'מטף', 'safety').length).toBe(2);
    expect(searchItems(items, 'מטף', 'medical')).toEqual([]);
    expect(searchItems(items, '', 'lighting').length).toBe(12);
  });
});
```

In `frontend/tests/unit-studio-controller.spec.ts` replace `import type { GeometryDoc } from '../src/map/geometry';` with `import type { GeometryDoc, GeomConnector, GeomObject } from '../src/map/geometry';`, and the two lines

```ts
    expect(await shows({ ...bare, objects: [{ id: 'o1' }] })).toBe(true);
    expect(await shows({ ...bare, connectors: [{ id: 'c1' }] })).toBe(true);
```

with

```ts
    expect(await shows({ ...bare, objects: [{ id: 'o1' } as unknown as GeomObject] })).toBe(true);
    expect(await shows({ ...bare, connectors: [{ id: 'c1' } as unknown as GeomConnector] })).toBe(true);
```

Run (in `frontend/`): `npx playwright test tests/unit-geometry-2.spec.ts --project=desktop --reporter=line`
Expected: FAIL — `searchItems` / `applyAnchorPositions` are not exported (module not found for `../src/api/plan-catalog`).

- [ ] **Step 2: `geometry.ts` — types and the primitives**

Replace the `GeometryDoc` collection lines

```ts
  objects: unknown[];
  circuits: unknown[];
  connectors: unknown[];
  labels: GeomLabel[];
  groups: unknown[];
```

with

```ts
  objects: GeomObject[];
  circuits: GeomCircuit[];
  connectors: GeomConnector[];
  labels: GeomLabel[];
  groups: GeomGroup[];
```

Insert before `export interface CalPair {`:

```ts
export type ObjectShape = 'box' | 'cylinder' | 'extruded_polygon' | 'stepped' | 'composite';
export type ConnectorKind = 'stairs' | 'ramp' | 'tribune' | 'elevator' | 'ladder';
export type GroupKind = 'array' | 'manual';
export interface GeomSize {
  w_m: number;
  d_m: number;
  h_m: number;
}
/** An object from the library (T085): position 0..1, sizes in metres. With `anchor_ref` it is the body of that anchor:
 * the server refreshes its position from the anchor on save and publish, the maps override it live. */
export interface GeomObject {
  id: string;
  item_id: string;
  level_id: string;
  position: Pt;
  rotation_deg: number;
  size: GeomSize;
  z_m: number;
  params: Record<string, unknown>;
  label: string | null;
  anchor_ref: AnchorRef | null;
  group_id: string | null;
  confidence: number;
  source: GeomSource;
  locked: boolean;
  external_ids?: ExternalIds;
}
export interface GeomGroup {
  id: string;
  kind: GroupKind;
  member_ids: string[];
  params: Record<string, unknown>;
  label?: string | null;
}
export interface GeomConnector {
  id: string;
  kind: ConnectorKind;
  level_from: string;
  level_to: string | null;
  floor_ids: string[];
  polyline: Pt[];
  width_m: number;
  label: string | null;
  /** Set on a connector the server derived from an object (a tribune): regenerated on every save, not editable. */
  object_id: string | null;
  source: GeomSource;
  external_ids?: ExternalIds;
}
export interface GeomCircuit {
  id: string;
  name: string;
  switch_entity_id: string;
  member_ids: string[];
  color_token: string;
  power_w: number;
}
```

Replace the primitive types block

```ts
export interface LabelPrim { kind: 'label'; id: string; x: number; y: number; text: string; size: number }
export type Primitive = WallPrim | DoorPrim | WindowPrim | PassagePrim | LabelPrim;
```

with

```ts
export interface LabelPrim { kind: 'label'; id: string; x: number; y: number; text: string; size: number }
export interface ConnectorPrim { kind: 'connector'; id: string; ckind: ConnectorKind; points: Pt[]; width: number; arrow: { from: Pt; to: Pt }; label: string; lx: number; ly: number; level_from: string; level_to: string | null }
export interface ObjectPrim { kind: 'object'; id: string; item_id: string; shape: ObjectShape; icon: string; color: string; level_id: string; cx: number; cy: number; w: number; h: number; rotation: number; corners: Pt[]; label: string | null; circuit_id: string | null; anchor: string | null; steps: [Pt, Pt][] }
export type Primitive = WallPrim | DoorPrim | WindowPrim | PassagePrim | LabelPrim | ConnectorPrim | ObjectPrim;

/** The 24 symbol ids of the library (plan-symbols.ts draws them; the export draws the same ids). */
export const SYMBOL_IDS = ['box', 'cylinder', 'chair', 'table', 'sofa', 'bed', 'cabinet', 'lamp', 'panel', 'socket', 'extinguisher', 'smoke', 'exit', 'aed', 'medical', 'goal', 'mat', 'stairs', 'elevator', 'doorstation', 'tree', 'sanitary', 'office', 'parking'] as const;
export type SymbolId = (typeof SYMBOL_IDS)[number];
export const OBJECT_SHAPES: readonly ObjectShape[] = ['box', 'cylinder', 'extruded_polygon', 'stepped', 'composite'];
export const COLOR_TOKENS = ['object', 'structure', 'circulation', 'furniture', 'light', 'electrical', 'safety', 'medical', 'sport', 'sanitary', 'security', 'outdoor'] as const;
/** What the renderer needs from the library for one item. */
export interface CatalogShape {
  shape: ObjectShape;
  icon: string;
  color_token: string;
}
export type CatalogLookup = (itemId: string) => CatalogShape | undefined;
export interface AnchorPosition {
  x: number;
  y: number;
  rotation: number;
}
export const ARROW_PX = 14;
```

In `buildPrimitives`, change the signature line to

```ts
export function buildPrimitives(doc: GeometryDoc, width: number, height: number, level: string | null = null, catalog?: CatalogLookup): Primitive[] {
```

and replace its final `  return prims;` with

```ts
  const pxPerM = 1 / scale;
  const levels = new Map<string, GeomLevel>(doc.levels.map((l) => [l.id, l]));
  for (const c of [...doc.connectors].sort(byId)) {
    const pts: Pt[] = c.polyline.map((p) => [p[0] * width, p[1] * height]);
    if (pts.length < 2) continue;
    const cum = cumulative(pts);
    const total = cum[cum.length - 1];
    if (total <= 1e-6) continue;
    const tail = pointAt(pts, cum, Math.max(0, total - Math.min(ARROW_PX, total))).p;
    const mid = pointAt(pts, cum, total / 2).p;
    prims.push({ kind: 'connector', id: c.id, ckind: c.kind || 'stairs', points: pts.map(rp), width: r2(Math.max(1, (c.width_m || 1) * pxPerM)), arrow: { from: rp(tail), to: rp(pts[pts.length - 1]) },
      label: connectorLabel(levels, c), lx: r2(mid[0]), ly: r2(mid[1]), level_from: c.level_from, level_to: c.level_to ?? null });
  }
  const circuitOf = new Map<string, string>();
  for (const k of [...doc.circuits].sort(byId)) for (const mid of k.member_ids) if (!circuitOf.has(mid)) circuitOf.set(mid, k.id);
  for (const o of [...doc.objects].sort(byId)) {
    if (level !== null && o.level_id !== level) continue;
    const item = catalog?.(o.item_id);
    const shape: ObjectShape = item && OBJECT_SHAPES.includes(item.shape) ? item.shape : 'box';
    const cx = o.position[0] * width;
    const cy = o.position[1] * height;
    const hw = ((o.size?.w_m || 0.05) * pxPerM) / 2;
    const hd = ((o.size?.d_m || 0.05) * pxPerM) / 2;
    const rot = o.rotation_deg || 0;
    const theta = (rot * Math.PI) / 180;
    const corners: Pt[] = ([[-1, -1], [1, -1], [1, 1], [-1, 1]] as const).map(([sx, sy]) => rp(rotated(cx, cy, sx * hw, sy * hd, theta)));
    const steps: [Pt, Pt][] = [];
    const rows = o.params?.rows;
    if (shape === 'stepped' && typeof rows === 'number' && Number.isInteger(rows) && rows >= 2) {
      for (let i = 1; i < rows; i++) {
        const y = -hd + (2 * hd * i) / rows;
        steps.push([rp(rotated(cx, cy, -hw, y, theta)), rp(rotated(cx, cy, hw, y, theta))]);
      }
    }
    const ref = o.anchor_ref;
    prims.push({ kind: 'object', id: o.id, item_id: String(o.item_id ?? ''), shape, icon: item && (SYMBOL_IDS as readonly string[]).includes(item.icon) ? item.icon : 'box',
      color: item && (COLOR_TOKENS as readonly string[]).includes(item.color_token) ? item.color_token : 'object', level_id: o.level_id, cx: r2(cx), cy: r2(cy), w: r2(hw * 2), h: r2(hd * 2),
      rotation: r2(rot), corners, label: o.label || null, circuit_id: circuitOf.get(o.id) ?? null, anchor: ref && ref.resource_id ? `${ref.resource_type}:${ref.resource_id}` : null, steps });
  }
  return prims;
```

Append at the end of the file:

```ts
// ---------------------------------------------------------------- objects and connectors (phase 2)

/** A footprint-local offset (x right, y down) turned by theta around the centre: clockwise on screen (y points down). */
export function rotated(cx: number, cy: number, x: number, y: number, theta: number): Pt {
  const c = Math.cos(theta);
  const s = Math.sin(theta);
  return [cx + x * c - y * s, cy + x * s + y * c];
}

/** The four corners of an object's footprint in plan pixels (not rounded): the hit area and the handles. */
export function objectCorners(o: Pick<GeomObject, 'position' | 'rotation_deg' | 'size'>, W: number, H: number, scale: number): Pt[] {
  const cx = o.position[0] * W;
  const cy = o.position[1] * H;
  const hw = (o.size.w_m / scale) / 2;
  const hd = (o.size.d_m / scale) / 2;
  const theta = ((o.rotation_deg || 0) * Math.PI) / 180;
  return ([[-1, -1], [1, -1], [1, 1], [-1, 1]] as const).map(([sx, sy]) => rotated(cx, cy, sx * hw, sy * hd, theta));
}

/** "↓ −1.2 מ׳": the arrow and the signed elevation difference from level_from to level_to; the connector's own label
 * wins; a cross-floor connector (no level_to here) shows the two-way arrow. The same string as the Python export. */
export function connectorLabel(levels: Map<string, GeomLevel>, c: Pick<GeomConnector, 'level_from' | 'level_to' | 'label'>): string {
  if (c.label) return c.label;
  const a = levels.get(c.level_from);
  const b = c.level_to ? levels.get(c.level_to) : undefined;
  if (!a || !b) return '↕';
  const delta = b.elevation_m - a.elevation_m;
  return `${delta < 0 ? '↓' : '↑'} ${delta < 0 ? '−' : '+'}${Math.abs(delta).toFixed(1)} מ׳`;
}

const round6 = (v: number): number => Math.round(v * 1e6) / 1e6;

/** The body follows its anchor: an object whose anchor_ref names a key of `positions` ("<type>:<id>") takes the anchor's
 * position and rotation. The maps run it with the live anchors they hold; the server does the same on save and publish. */
export function applyAnchorPositions(doc: GeometryDoc, positions: Record<string, AnchorPosition>): GeometryDoc {
  let changed = false;
  const objects = doc.objects.map((o) => {
    const ref = o.anchor_ref;
    const a = ref ? positions[`${ref.resource_type}:${ref.resource_id}`] : undefined;
    if (!a) return o;
    changed = true;
    return { ...o, position: [round6(a.x), round6(a.y)] as Pt, rotation_deg: Math.round((a.rotation || 0) * 1000) / 1000 };
  });
  return changed ? { ...doc, objects } : doc;
}
```

- [ ] **Step 3: `api/plan-catalog.ts`**

```ts
/**
 * Plan Studio object library (T085): the built-in catalog merged with the installation's custom items, fetched once and
 * refreshed when the map bundle's catalog_revision differs; custom item calls; the client-side search the library
 * panel runs (design 4.3: names he / en and tags, synonyms included).
 */
import { del, get, patch, post, resourceUrl } from './client';
import type { CatalogLookup, GeomSize, ObjectShape } from '../map/geometry';

export interface ParamSpec {
  type: 'number' | 'int' | 'level';
  min?: number;
  max?: number;
  he: string;
}
export interface CatalogItem {
  id: string;
  category: string;
  names: { he: string; en: string };
  tags: string[];
  role: string;
  shape: ObjectShape;
  size: GeomSize;
  /** Ceiling items carry a negative z_m offset from the level's ceiling; floor items an absolute height. */
  z_ref: 'floor' | 'ceiling';
  z_m: number;
  params: Record<string, unknown>;
  params_schema: Record<string, ParamSpec>;
  icon: string;
  color_token: string;
  /** HA domains an object of this item may be the body of (light -> light / switch). */
  anchor_kinds: string[];
  ifc: { class: string; predefined_type: string };
  custom: boolean;
  based_on: string | null;
  created_by?: string | null;
  created_at?: string;
  updated_at?: string;
}
export interface CatalogCategory {
  id: string;
  he: string;
  en: string;
}
export interface CatalogLibrary {
  catalog_version: string;
  revision: string;
  categories: CatalogCategory[];
  icons: string[];
  color_tokens: string[];
  items: CatalogItem[];
}
export interface CustomItemBody {
  based_on?: string | null;
  names?: { he: string; en?: string };
  category?: string;
  tags?: string[];
  role?: string;
  shape?: ObjectShape;
  size?: GeomSize;
  z_m?: number;
  params?: Record<string, unknown>;
  icon?: string;
  color_token?: string;
}

let cache: CatalogLibrary | null = null;
let inflight: Promise<CatalogLibrary> | null = null;

/** The library, fetched once per revision: a caller that knows the bundle's catalog_revision passes it. */
export function loadLibrary(revision?: string | null): Promise<CatalogLibrary> {
  if (cache && (!revision || cache.revision === revision)) return Promise.resolve(cache);
  if (!inflight) {
    inflight = get<CatalogLibrary>('catalog/objects')
      .then((lib) => {
        cache = lib;
        return lib;
      })
      .finally(() => {
        inflight = null;
      });
  }
  return inflight;
}

export function invalidateLibrary(): void {
  cache = null;
}

export function lookupOf(lib: CatalogLibrary): CatalogLookup {
  const m = new Map(lib.items.map((i) => [i.id, { shape: i.shape, icon: i.icon, color_token: i.color_token }]));
  return (id) => m.get(id);
}

export const itemOf = (lib: CatalogLibrary, id: string): CatalogItem | undefined => lib.items.find((i) => i.id === id);

const fold = (s: string): string => s.toLocaleLowerCase().replace(/[֑-ׇ]/g, '');

/** Items whose Hebrew or English name or a tag contains the query (case folded); an empty query lists the category. */
export function searchItems(items: CatalogItem[], q: string, category: string | null): CatalogItem[] {
  const needle = fold(q.trim());
  return items.filter((i) => (!category || i.category === category) && (!needle || [i.names.he, i.names.en, ...i.tags].some((s) => fold(s).includes(needle))));
}

const refresh = <T>(x: T): T => {
  invalidateLibrary();
  return x;
};
export const createItem = (body: CustomItemBody) => post<CatalogItem>('catalog/objects', body).then(refresh);
export const updateItem = (id: string, body: CustomItemBody) => patch<CatalogItem>(`catalog/objects/${encodeURIComponent(id)}`, body).then(refresh);
export const deleteItem = (id: string) => del(`catalog/objects/${encodeURIComponent(id)}`).then(refresh);
export const importItems = (items: unknown[]) => post<{ imported: number; replaced: number; revision: string }>('catalog/import', { format: 'smplwise-catalog-1', items }).then(refresh);
export const exportUrl = () => resourceUrl('api/v1/catalog/export');
```

- [ ] **Step 4: Bundle, anchors, zones, search and geometry API fields**

`frontend/src/api/types.ts`: in `Anchor`, after `  label_pos?: string | null;` add `  /** Plan Studio level of the floor (null = the default level). */\n  level_id?: string | null;`; in `SpatialZone`, after `  label_pos?: string;` add `  level_id?: string | null;\n  ceiling_height_m?: number | null;`; before `export interface FloorMap {` add:

```ts
/** The switch of a lighting circuit as the live map needs it (T085): its state, and the turn on / off actions when the
 * caller may control entities on the floor. */
export interface CircuitState {
  entity_id: string;
  name: string | null;
  color_token: string | null;
  member_ids: string[];
  power_w: number | null;
  state: string | null;
  known: boolean;
  fresh: boolean;
  available: boolean;
  can_control: boolean;
  actions: import('./ha').HaActionSpec[];
}
```

and in `FloorMap`, after `  geometry?: GeometryRef | null;` add:

```ts
  /** T085: the library revision the map needs, the levels of the referenced document and the circuit switch states. */
  catalog_revision?: string;
  levels?: import('../map/geometry').GeomLevel[];
  circuit_states?: Record<string, CircuitState>;
```

`frontend/src/api/maps.ts`: replace `import type { Anchor, Camera, FloorMap, GeometryRef, PlanAsset, PlanVersion, SpatialZone } from './types';` with `import type { Anchor, Camera, CircuitState, FloorMap, GeometryRef, PlanAsset, PlanVersion, SpatialZone } from './types';\nimport type { GeomLevel } from '../map/geometry';`; in `MapBundle` after `  scaleMPerPx: number | null;` add `  catalogRevision: string | null;\n  levels: GeomLevel[];\n  circuitStates: Record<string, CircuitState>;`; in `demoBundle` after `    scaleMPerPx: null,` add `    catalogRevision: null,\n    levels: [],\n    circuitStates: {},`; in `loadMap` after `    scaleMPerPx: m.plan?.scale_m_per_px ?? null,` add `    catalogRevision: m.catalog_revision ?? null,\n    levels: m.levels ?? [],\n    circuitStates: m.circuit_states ?? {},`. In `createAnchor`'s body type add `level_id?: string | null` after `label?: string | null`; in `updateAnchor`'s body type add `level_id?: string | null` after `label_pos?: string`.

`frontend/src/api/zones.ts`: in `updateZone`'s body type add `level_id?: string; ceiling_height_m?: number` after `label_pos?: string`.

`frontend/src/api/search.ts`: `export type SearchKind = 'zone' | 'camera' | 'floor' | 'building' | 'entity' | 'object';`, `KIND_LABEL` gains `object: 'עצם'`, `KIND_ICON` gains `object: 'grid'`.

`frontend/src/api/geometry.ts`: in `GeometryCounts` add `connectors: number;\n  circuits: number;\n  levels: number;\n  groups: number;` after `objects: number;`; add `type GeomConnector` to the `../map/geometry` type import; replace `exportUrl` with

```ts
export function exportUrl(versionId: string, fmt: 'svg' | 'png', opts: { draft?: boolean; layers?: string[] } = {}): string {
  const q = new URLSearchParams();
  if (opts.draft) q.set('draft', 'true');
  if (opts.layers?.length) q.set('layers', opts.layers.join(','));
  const qs = q.toString();
  return resourceUrl(`api/v1/plan-versions/${versionId}/export.${fmt}${qs ? `?${qs}` : ''}`);
}
/** Stairs / an elevator to another floor: the same connector id lands on the other floor's draft (T085). */
export const linkConnector = (versionId: string, connectorId: string, floorId: string) =>
  post<{ connector: GeomConnector; target: { floor_id: string; version_id: string; revision: number } }>(`plan-versions/${versionId}/geometry/link`, { connector_id: connectorId, floor_id: floorId });
```

- [ ] **Step 5: Type-check and run the node specs**

Run (in `frontend/`): `npx tsc --noEmit -p tsconfig.json` → exit 0; `npx playwright test tests/unit-geometry.spec.ts tests/unit-geometry-2.spec.ts tests/unit-studio-controller.spec.ts --project=desktop --reporter=line` → `24 passed` (19 phase-1 tests + 5 new).

- [ ] **Step 6: Commit**

```bash
cd /c/cloude/smplwisebms && git add frontend/src/map/geometry.ts frontend/src/api/plan-catalog.ts frontend/src/api/types.ts frontend/src/api/maps.ts frontend/src/api/zones.ts frontend/src/api/search.ts frontend/src/api/geometry.ts frontend/tests/unit-studio-controller.spec.ts frontend/tests/unit-geometry-2.spec.ts
msg=$(mktemp) && cat > "$msg" <<'EOF'
feat(plan-studio): frontend types, library API and the object and connector primitives that match the golden fixture (T085)

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOF
test "$(bash /c/cloude/smplwisebms/secrets/scan_staged.sh)" = 0 && git commit -F "$msg"
```

---
### Task 8: Objects and connectors on every map surface — canvas layer, symbols, glow, layer rows, first live test

**Files:**
- Create: `frontend/src/map/plan-symbols.ts`
- Modify: `frontend/src/map/sw-plan-canvas.ts` (object / connector rendering, glow, layer switches, arrow marker)
- Modify: `frontend/src/styles/tokens.css` (object, circuit and glow tokens)
- Modify: `frontend/src/screens/explore-floor-map.ts` (layers "עצמים" / "מחברים", library, anchor positions, circuit and entity states, WebSocket updates)
- Modify: `frontend/src/screens/investigate-history-map.ts`, `frontend/src/screens/investigate-event-detail.ts` (library and anchor positions for the object layer)
- Test: `frontend/tests/evidence-plan-studio-2.spec.ts` (create; first live test)

**Interfaces:**
- Consumes: `buildPrimitives(doc, W, H, level, catalog)`, `applyAnchorPositions`, `ObjectPrim`, `ConnectorPrim`, `CatalogLookup`, `AnchorPosition`, `SYMBOL_IDS` (Task 7); `loadLibrary`, `lookupOf` (Task 7); `MapBundle.catalogRevision / circuitStates / levels` (Task 7); bundle `circuit_states` (Task 6).
- Produces:
  - `plan-symbols.ts`: `SYMBOLS: Record<SymbolId, SVGTemplateResult>`, `symbolOf(icon): SVGTemplateResult`.
  - Canvas properties `catalog: CatalogLookup | null`, `anchorPositions: Record<string, AnchorPosition>`, `circuitStates: Record<string, string | null>` (circuit id → switch state), `entityStates: Record<string, string | null>` (entity id → state, for bound bodies), `hideObjects`, `hideConnectors`; DOM `[data-structure] [data-object=<id>][data-item][data-shape][data-circuit][data-glow]`, `[data-connector=<id>][data-kind]`, the `#sw-arrow` marker.
  - Live floor map: layers `objects` (icon `grid`, label "עצמים") and `connectors` (icon `stairs`, label "מחברים") in the toolbar and the layers panel (`[data-layer="objects"]`, `[data-layer="connectors"]`), remembered per floor with explicit-off markers like `structure`; the library is loaded by the bundle's `catalogRevision`; a WebSocket push for a circuit's switch updates `circuitStates`.
  - Tokens: `--sw-obj-object … --sw-obj-outdoor` (12), `--sw-circuit-1 … --sw-circuit-6`, `--sw-map-glow`.

- [ ] **Step 1: The failing live test**

`frontend/tests/evidence-plan-studio-2.spec.ts` (the helper block is shared by every later live test of this plan; each task appends its test inside the `test.describe.serial` block):

```ts
import { test, expect, type APIRequestContext, type Page } from '@playwright/test';

// Plan Studio phase 2 (T085) against the running developer backend: objects and connectors on the live map, the library
// in the editor, arrays, levels, connectors, circuits with simulated switch states (the dev-only state route), the global
// search and the custom library. The spec builds its own site / building / two floors with generated plan pictures and
// removes them at the end. Runs only with SW_LIVE=1 (backend on 8099 behind the preview proxy) in real Chrome.
const ids = { site: '', building: '', floor: '', floor2: '', version: '', version2: '', asset: '' };
let api: APIRequestContext;

const LEVEL = (id: string, name: string, elevation: number, ceiling: number, isDefault = false) => ({ id, name, elevation_m: elevation, ceiling_height_m: ceiling, is_default: isDefault, external_ids: {} });
const OBJ = (id: string, item: string, pos: [number, number], extra: Record<string, unknown> = {}) => ({ id, item_id: item, level_id: 'L0', position: pos, rotation_deg: 0, size: { w_m: 0.45, d_m: 0.45, h_m: 0.85 },
  z_m: 0, params: {}, label: null, anchor_ref: null, group_id: null, confidence: 1, source: 'manual', locked: false, external_ids: {}, ...extra });

/** Click a normalized plan point on the canvas of `screen` (the canvas converts plan to host pixels itself). */
async function clickPlan(page: Page, screen: string, x: number, y: number, modifiers: ('Alt' | 'Shift')[] = []) {
  const canvas = page.locator(`${screen} sw-plan-canvas`);
  const box = (await canvas.boundingBox())!;
  const s = await canvas.evaluate((el, p) => (el as unknown as { toScreen: (a: number, b: number) => { x: number; y: number } }).toScreen(p[0], p[1]), [x, y] as [number, number]);
  await page.mouse.click(box.x + s.x, box.y + s.y, { modifiers });
}

/** Drag from one normalized plan point to another on the canvas of `screen`. */
async function dragPlan(page: Page, screen: string, from: [number, number], to: [number, number], modifiers: ('Alt' | 'Shift')[] = []) {
  const canvas = page.locator(`${screen} sw-plan-canvas`);
  const box = (await canvas.boundingBox())!;
  const conv = async (p: [number, number]) => canvas.evaluate((el, q) => (el as unknown as { toScreen: (a: number, b: number) => { x: number; y: number } }).toScreen(q[0], q[1]), p);
  const a = await conv(from);
  const b = await conv(to);
  for (const m of modifiers) await page.keyboard.down(m);
  await page.mouse.move(box.x + a.x, box.y + a.y);
  await page.mouse.down();
  await page.mouse.move(box.x + (a.x + b.x) / 2, box.y + (a.y + b.y) / 2, { steps: 4 });
  await page.mouse.move(box.x + b.x, box.y + b.y, { steps: 4 });
  await page.mouse.up();
  for (const m of modifiers) await page.keyboard.up(m);
}

const draft = async (version = ids.version) => (await (await api.get(`api/v1/plan-versions/${version}/geometry?draft=true`)).json()) as { geometry: { revision: number }; doc: Record<string, unknown> & { objects: { id: string; item_id: string; position: [number, number]; group_id: string | null; anchor_ref: unknown }[]; groups: { id: string; member_ids: string[] }[]; connectors: { id: string; kind: string; level_to: string | null; floor_ids: string[] }[]; circuits: { id: string; member_ids: string[]; power_w: number }[]; levels: { id: string }[] } };
const saveDraft = async (patch: Record<string, unknown>, version = ids.version) => {
  const g = await draft(version);
  expect((await api.put(`api/v1/plan-versions/${version}/geometry`, { data: { doc: { ...g.doc, ...patch }, base_revision: g.geometry.revision } })).status()).toBe(200);
};
const publish = async (version = ids.version) => expect((await api.post(`api/v1/plan-versions/${version}/geometry/publish`)).status()).toBe(200);

test.describe.serial('plan studio phase 2 (SW A)', () => {
  test.skip(process.env.SW_LIVE !== '1', 'set SW_LIVE=1 with the backend running');

  test.beforeAll(async ({ playwright, browser }) => {
    api = await playwright.request.newContext({ baseURL: 'http://127.0.0.1:4173/' });
    const stamp = new Date().toISOString().slice(0, 19);
    ids.site = (await (await api.post('api/v1/sites', { data: { name: `בדיקת סטודיו 2 ${stamp}`, address: '' } })).json()).id;
    ids.building = (await (await api.post(`api/v1/sites/${ids.site}/buildings`, { data: { name: 'אולם ספורט' } })).json()).id;
    ids.floor = (await (await api.post(`api/v1/buildings/${ids.building}/floors`, { data: { name: 'אולם', level: 0 } })).json()).id;
    ids.floor2 = (await (await api.post(`api/v1/buildings/${ids.building}/floors`, { data: { name: 'גלריה', level: 1 } })).json()).id;
    const page = await browser.newPage({ viewport: { width: 1000, height: 600 } });
    await page.setContent('<div style="box-sizing:border-box;width:1000px;height:600px;background:#fff;border:10px solid #333"></div>');
    const png = await page.screenshot();
    await page.close();
    for (const [floor, key, vkey] of [[ids.floor, 'asset', 'version'], [ids.floor2, '', 'version2']] as const) {
      const asset = await (await api.post(`api/v1/floors/${floor}/plan-assets`, { multipart: { file: { name: 'plan.png', mimeType: 'image/png', buffer: png } } })).json();
      if (key) ids[key] = asset.id;
      ids[vkey] = (await (await api.post(`api/v1/floors/${floor}/plan-versions`, { data: { asset_id: asset.id } })).json()).id;
      expect((await api.post(`api/v1/plan-versions/${ids[vkey]}/publish`)).status()).toBe(200);
    }
    // 1 m = 100 px: the whole 1000 px plan is 10 m wide
    expect((await api.patch(`api/v1/plan-versions/${ids.version}/calibration`, { data: { pairs: [{ a: [0, 0.5], b: [1, 0.5], metres: 10 }] } })).status()).toBe(200);
  });

  test.afterAll(async () => {
    if (!api) return;
    try {
      for (const f of [ids.floor, ids.floor2]) if (f) expect((await api.delete(`api/v1/floors/${f}?force=true`)).status(), 'test floor removed').toBe(204);
      if (ids.building) expect((await api.delete(`api/v1/buildings/${ids.building}`)).status(), 'test building removed').toBe(204);
      if (ids.site) expect((await api.delete(`api/v1/sites/${ids.site}`)).status(), 'test site removed').toBe(204);
    } finally {
      await api.dispose();
    }
  });

  test('published objects and connectors show on the live map with their own layer switches and in the exports', async ({ page }) => {
    await saveDraft({
      levels: [LEVEL('L0', 'מפלס ראשי', 0, 2.8, true), LEVEL('L1', 'אולם תחתון', -1.2, 6)],
      objects: [OBJ('seed-chair', 'chair.basic', [0.2, 0.2]), OBJ('seed-lamp', 'light.ceiling', [0.5, 0.3], { size: { w_m: 0.4, d_m: 0.4, h_m: 0.1 }, z_m: 2.5 })],
      connectors: [{ id: 'seed-stairs', kind: 'stairs', level_from: 'L0', level_to: 'L1', floor_ids: [], polyline: [[0.7, 0.7], [0.8, 0.7]], width_m: 1.2, label: null, object_id: null, source: 'manual', external_ids: {} }],
    });
    await publish();
    await page.goto(`/?design=a#/explore/floors/${ids.floor}`);
    const objects = page.locator('explore-floor-map sw-plan-canvas [data-structure] [data-object]');
    await expect(objects).toHaveCount(2, { timeout: 20000 });
    await expect(page.locator('explore-floor-map sw-plan-canvas [data-object="seed-chair"][data-item="chair.basic"]')).toHaveCount(1);
    await expect(page.locator('explore-floor-map sw-plan-canvas [data-connector="seed-stairs"][data-kind="stairs"]')).toHaveCount(1);
    await expect(page.locator('explore-floor-map sw-plan-canvas [data-connector="seed-stairs"] text')).toHaveText('↓ −1.2 מ׳');
    await page.locator('explore-floor-map .layers button[aria-label="עצמים"]').click();
    await expect(objects).toHaveCount(0);
    await page.locator('explore-floor-map .layers button[aria-label="עצמים"]').click();
    await expect(objects).toHaveCount(2);
    await page.locator('explore-floor-map .layers button[aria-label="מחברים"]').click();
    await expect(page.locator('explore-floor-map sw-plan-canvas [data-connector]')).toHaveCount(0);
    await page.locator('explore-floor-map .layers button[aria-label="מחברים"]').click();
    await page.locator('explore-floor-map sw-button[icon="layers"]').click();
    await expect(page.locator('explore-floor-map [data-layers-panel] [data-layer="objects"]')).toHaveCount(1);
    await expect(page.locator('explore-floor-map [data-layers-panel] [data-layer="connectors"]')).toHaveCount(1);
    const svg = await (await api.get(`api/v1/plan-versions/${ids.version}/export.svg`)).text();
    expect(svg).toContain('data-object="seed-chair"');
    expect(svg).toContain('data-symbol="chair"');
    expect(await (await api.get(`api/v1/plan-versions/${ids.version}/export.svg?layers=structure`)).text()).not.toContain('data-object');
  });
});
```

Run: `cd frontend && npm run build && SW_LIVE=1 SW_CHROME=1 npx playwright test tests/evidence-plan-studio-2.spec.ts --project=desktop --workers=1 --reporter=line` (the developer backend must run Task 6's code: `bash "$SP/restart_dev.sh"` first)
Expected: FAIL — `[data-object]` count 0 (the canvas draws no objects yet).

- [ ] **Step 2: The symbols (`frontend/src/map/plan-symbols.ts`)**

```ts
/**
 * The 24 object symbols of the map (T085): stroke-based drawings in a 24 x 24 box, keyed by the library's icon id.
 * services/plan_symbols.py draws the same ids in the export; the primitives carry the id and the placement, so the two
 * drawings may differ in detail but never in where they sit.
 */
import { svg, type SVGTemplateResult } from 'lit';
import { SYMBOL_IDS, type SymbolId } from './geometry';

export const SYMBOLS: Record<SymbolId, SVGTemplateResult> = {
  box: svg`<rect x="5" y="5" width="14" height="14" rx="1.5"/>`,
  cylinder: svg`<circle cx="12" cy="12" r="7"/>`,
  chair: svg`<rect x="7" y="10" width="10" height="7" rx="1.5"/><path d="M7 10V6h10v4M8 17v3M16 17v3"/>`,
  table: svg`<rect x="4" y="8" width="16" height="8" rx="1.5"/><path d="M6 16v3M18 16v3"/>`,
  sofa: svg`<path d="M4 11a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v6H4z"/><path d="M4 14h16M7 9V7h10v2"/>`,
  bed: svg`<rect x="4" y="9" width="16" height="9" rx="1.5"/><path d="M4 13h16M6 9V6h5v3M6 18v2M18 18v2"/>`,
  cabinet: svg`<rect x="5" y="4" width="14" height="16" rx="1"/><path d="M12 4v16M9 11h1M14 11h1"/>`,
  lamp: svg`<circle cx="12" cy="11" r="5"/><path d="M12 16v3M9 20h6M8 5l1 1M16 5l-1 1"/>`,
  panel: svg`<rect x="6" y="4" width="12" height="16" rx="1"/><path d="M9 8h6M9 11h6M9 14h3"/>`,
  socket: svg`<rect x="5" y="5" width="14" height="14" rx="2"/><path d="M10 10v4M14 10v4"/>`,
  extinguisher: svg`<rect x="9" y="8" width="6" height="12" rx="3"/><path d="M12 8V5M9 5h6M15 9l3-2"/>`,
  smoke: svg`<circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2"/><path d="M12 5v2M12 17v2"/>`,
  exit: svg`<rect x="4" y="6" width="16" height="12" rx="1.5"/><path d="M9 12h7M13 9l3 3-3 3"/>`,
  aed: svg`<path d="M12 20s-7-4.5-7-9.5A3.5 3.5 0 0 1 12 8a3.5 3.5 0 0 1 7 2.5C19 15.5 12 20 12 20z"/><path d="M12 9l-1.5 3h3L12 15"/>`,
  medical: svg`<rect x="4" y="6" width="16" height="12" rx="2"/><path d="M12 9v6M9 12h6"/>`,
  goal: svg`<rect x="4" y="6" width="16" height="10"/><path d="M4 16v3M20 16v3M8 6v10M12 6v10M16 6v10"/>`,
  mat: svg`<rect x="3" y="8" width="18" height="8" rx="2"/><path d="M7 8v8M12 8v8M17 8v8"/>`,
  stairs: svg`<path d="M4 20h4v-4h4v-4h4V8h4"/>`,
  elevator: svg`<rect x="5" y="3" width="14" height="18" rx="1.5"/><path d="M12 3v18M8 10l1.5-2 1.5 2M14.5 14l1.5 2 1.5-2"/>`,
  doorstation: svg`<rect x="7" y="3" width="10" height="18" rx="2"/><circle cx="12" cy="8" r="2"/><path d="M9 13h6M9 16h6"/>`,
  tree: svg`<circle cx="12" cy="10" r="6"/><path d="M12 16v5M9 21h6"/>`,
  sanitary: svg`<path d="M6 10h12v3a6 6 0 0 1-12 0z"/><path d="M12 10V5M9 5h6"/>`,
  office: svg`<rect x="4" y="5" width="16" height="11" rx="1.5"/><path d="M8 20h8M12 16v4"/>`,
  parking: svg`<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M9 17V7h4a3 3 0 0 1 0 6H9"/>`,
};

/** The symbol of an icon id; an unknown id draws the plain box (the export's fallback too). */
export function symbolOf(icon: string): SVGTemplateResult {
  return SYMBOLS[(SYMBOL_IDS as readonly string[]).includes(icon) ? (icon as SymbolId) : 'box'];
}
```

- [ ] **Step 3: Tokens (`frontend/src/styles/tokens.css`)**

After the line `  --sw-map-label: #8b96a8;` (the base block) add:

```css
  /* Plan Studio objects (T085): one colour per library colour token, the circuit colours, the "switch is on" glow */
  --sw-obj-object: #7b8794;
  --sw-obj-structure: #4b5567;
  --sw-obj-circulation: #6b7f99;
  --sw-obj-furniture: #9aa7b8;
  --sw-obj-light: #f2b544;
  --sw-obj-electrical: #e07a2f;
  --sw-obj-safety: #e0443c;
  --sw-obj-medical: #2fa7b3;
  --sw-obj-sport: #3fa25b;
  --sw-obj-sanitary: #5b9bd5;
  --sw-obj-security: #7a5cc7;
  --sw-obj-outdoor: #5c9e4f;
  --sw-circuit-1: #2f6bff;
  --sw-circuit-2: #f59e0b;
  --sw-circuit-3: #22c55e;
  --sw-circuit-4: #a855f7;
  --sw-circuit-5: #ef4444;
  --sw-circuit-6: #14b8a6;
  --sw-map-glow: #ffd166;
```

(The same hex values as `OBJECT_COLORS` / `CIRCUIT_COLORS` in `plan_geometry_render.py`, so an export looks like the map.)

- [ ] **Step 4: The canvas (`frontend/src/map/sw-plan-canvas.ts`)**

Replace the import line `import { buildPrimitives, isClosedOutline, type DoorPrim, type GeometryDoc, type LabelPrim, type PassagePrim, type Primitive, type Pt, type WallPrim, type WindowPrim } from './geometry';` with:

```ts
import { applyAnchorPositions, buildPrimitives, isClosedOutline, type AnchorPosition, type CatalogLookup, type DoorPrim, type GeometryDoc, type LabelPrim, type PassagePrim, type Primitive, type Pt, type WallPrim, type WindowPrim } from './geometry';
import { symbolOf } from './plan-symbols';
```

After `  @property() selectedGeomId: string | null = null;` add:

```ts
  /** T085: the library shapes (symbol, colour) the object layer draws with; without it every object is a plain box. */
  @property({ attribute: false }) catalog: CatalogLookup | null = null;
  /** T085: the live anchors of the floor ("<type>:<id>" -> position): a bound object draws on its anchor, not where the
   * document last saw it. */
  @property({ attribute: false }) anchorPositions: Record<string, AnchorPosition> = {};
  /** T085: circuit id -> the state of its switch ("on" glows every lamp of the circuit). */
  @property({ attribute: false }) circuitStates: Record<string, string | null> = {};
  /** T085: entity id -> state, for objects bound to an entity (a lamp that is the body of a light glows on its own). */
  @property({ attribute: false }) entityStates: Record<string, string | null> = {};
  /** T085: the layer switches of the live map (the structure itself stays). */
  @property({ type: Boolean }) hideObjects = false;
  @property({ type: Boolean }) hideConnectors = false;
```

Replace `  private primCache: { doc: GeometryDoc; w: number; h: number; level: string | null; prims: Primitive[] } | null = null;` with

```ts
  private primCache: { doc: GeometryDoc; w: number; h: number; level: string | null; catalog: CatalogLookup | null; anchors: Record<string, AnchorPosition>; prims: Primitive[] } | null = null;
```

Replace the body of `primitives(doc)` with:

```ts
    const c = this.primCache;
    if (c && c.doc === doc && c.w === this.planWidth && c.h === this.planHeight && c.level === this.structureLevel && c.catalog === this.catalog && c.anchors === this.anchorPositions) return c.prims;
    const shown = Object.keys(this.anchorPositions).length ? applyAnchorPositions(doc, this.anchorPositions) : doc;
    const prims = buildPrimitives(shown, this.planWidth, this.planHeight, this.structureLevel, this.catalog ?? undefined);
    this.primCache = { doc, w: this.planWidth, h: this.planHeight, level: this.structureLevel, catalog: this.catalog, anchors: this.anchorPositions, prims };
    return prims;
```

In `renderStructure`, replace `    return svg`<g class="structure" data-structure>${this.primitives(doc).map((p) => this.renderPrimitive(p, inv, issues))}</g>`;` with:

```ts
    const shown = this.primitives(doc).filter((p) => !(this.hideObjects && p.kind === 'object') && !(this.hideConnectors && p.kind === 'connector'));
    return svg`<g class="structure" data-structure>${shown.map((p) => this.renderPrimitive(p, inv, issues))}</g>`;
```

In `renderPrimitive`, before `      case 'label':` add:

```ts
      case 'connector':
        return svg`<g class="conn ${cls}" data-connector=${p.id} data-kind=${p.ckind}>
          <path class="cbody" d=${`M ${p.points.map((q) => `${q[0]} ${q[1]}`).join(' L ')}`} stroke-width=${p.width} />
          <path class="carrow" d=${`M ${p.arrow.from[0]} ${p.arrow.from[1]} L ${p.arrow.to[0]} ${p.arrow.to[1]}`} stroke-width=${2 * inv} marker-end="url(#sw-arrow)" />
          <text class="clabel" x=${p.lx} y=${p.ly} font-size=${12 * inv}>${p.label}</text>
        </g>`;
      case 'object': {
        const entityId = p.anchor ? p.anchor.slice(p.anchor.indexOf(':') + 1) : null;
        const on = (p.circuit_id !== null && this.circuitStates[p.circuit_id] === 'on') || (entityId !== null && this.entityStates[entityId] === 'on');
        const circuit = p.circuit_id !== null ? this.geometry?.circuits.find((k) => k.id === p.circuit_id) : undefined;
        const sym = Math.min(3, Math.max(0.35, (Math.min(p.w, p.h) * 0.6) / 24));
        return svg`<g class="obj ${cls} ${on ? 'glow' : ''}" data-object=${p.id} data-item=${p.item_id} data-shape=${p.shape} data-circuit=${p.circuit_id ?? nothing} ?data-glow=${on}
             style=${`--oc: var(--sw-obj-${p.color});${circuit ? ` --kc: var(--sw-${circuit.color_token});` : ''}`}>
          ${p.shape === 'cylinder'
            ? svg`<ellipse class="fp" cx=${p.cx} cy=${p.cy} rx=${p.w / 2} ry=${p.h / 2} transform=${`rotate(${p.rotation} ${p.cx} ${p.cy})`} stroke-width=${1.2 * inv} />`
            : svg`<polygon class="fp" points=${ptsAttr(p.corners)} stroke-width=${1.2 * inv} />`}
          ${p.steps.map(([a, b]) => svg`<line class="step" x1=${a[0]} y1=${a[1]} x2=${b[0]} y2=${b[1]} stroke-width=${inv} />`)}
          <g class="sym" transform=${`translate(${p.cx} ${p.cy}) rotate(${p.rotation}) scale(${sym}) translate(-12 -12)`} stroke-width=${1.6 / sym}>${symbolOf(p.icon)}</g>
          ${p.label && this.scale >= 0.6 ? svg`<text class="olabel" x=${p.cx} y=${p.cy + p.h / 2 + 12 * inv} font-size=${11 * inv}>${p.label}</text>` : nothing}
        </g>`;
      }
```

In `render()`, replace `        <svg xmlns="http://www.w3.org/2000/svg" role="img" aria-label="תוכנית קומה">` with:

```ts
        <svg xmlns="http://www.w3.org/2000/svg" role="img" aria-label="תוכנית קומה">
          <defs><marker id="sw-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path class="carrowhead" d="M0 0L10 5L0 10z" /></marker></defs>
```

In `static styles`, after the `.structure .glabel.issue { … }` rule (the one ending the structure block, before `.geom-hits .hit {`) add:

```css
    /* T085: connectors (a wide translucent band along the polyline, an arrow, the level delta) and objects (a tinted
       footprint in the item's colour, a symbol, an optional label); a lamp glows while its circuit's switch is on. */
    .structure .conn .cbody {
      fill: none;
      stroke: var(--sw-map-structure);
      stroke-opacity: 0.22;
      stroke-linecap: butt;
    }
    .structure .conn .carrow {
      fill: none;
      stroke: var(--sw-map-structure);
    }
    .carrowhead {
      fill: var(--sw-map-structure);
    }
    .structure .conn .clabel,
    .structure .obj .olabel {
      fill: var(--sw-map-label);
      font-family: var(--sw-font);
      font-weight: 600;
      text-anchor: middle;
      dominant-baseline: middle;
      direction: rtl;
      unicode-bidi: plaintext;
    }
    .structure .obj .fp {
      fill: var(--oc);
      fill-opacity: 0.18;
      stroke: var(--oc);
    }
    .structure .obj .step {
      stroke: var(--oc);
    }
    .structure .obj .sym {
      fill: none;
      stroke: var(--oc);
      stroke-linecap: round;
      stroke-linejoin: round;
    }
    .structure .obj[data-circuit] .fp {
      stroke: var(--kc, var(--oc));
      stroke-width: 2;
    }
    .structure .obj.glow .fp {
      fill: var(--sw-map-glow);
      fill-opacity: 0.6;
      stroke: var(--sw-map-glow);
      filter: drop-shadow(0 0 6px var(--sw-map-glow));
    }
    .structure .obj.sel .fp {
      stroke: var(--sw-accent);
      stroke-width: 2;
    }
    .structure .obj.issue .fp {
      stroke: var(--sw-danger);
    }
    .structure .conn.sel .cbody,
    .structure .conn.sel .carrow {
      stroke: var(--sw-accent);
    }
    .structure .conn.issue .cbody {
      stroke: var(--sw-danger);
    }
```

- [ ] **Step 5: The live floor map (`frontend/src/screens/explore-floor-map.ts`)**

Imports: replace `import { geometryFor } from '../api/geometry';\nimport type { GeometryDoc } from '../map/geometry';` with:

```ts
import { geometryFor } from '../api/geometry';
import type { AnchorPosition, CatalogLookup, GeometryDoc } from '../map/geometry';
import { loadLibrary, lookupOf } from '../api/plan-catalog';
```

Replace the `Layer` type and the `LAYERS` list:

```ts
type Layer = 'cameras' | 'doors' | 'lights' | 'sensors' | 'zones' | 'structure' | 'objects' | 'connectors';

const LAYERS: { id: Layer; icon: 'camera' | 'door' | 'light' | 'sensor' | 'map' | 'wall' | 'grid' | 'stairs'; label: () => string }[] = [
  { id: 'cameras', icon: 'camera', label: () => t('floor.cameras') },
  { id: 'doors', icon: 'door', label: () => t('floor.doors') },
  { id: 'lights', icon: 'light', label: () => t('floor.lights') },
  { id: 'sensors', icon: 'sensor', label: () => t('floor.sensors') },
  { id: 'zones', icon: 'map', label: () => 'חדרים ואזורים' },
  { id: 'structure', icon: 'wall', label: () => 'מבנה' },
  { id: 'objects', icon: 'grid', label: () => 'עצמים' },
  { id: 'connectors', icon: 'stairs', label: () => 'מחברים' },
];
/** Layers that came after the first stored layer lists: stored as "-<id>" when switched off, so an old list still shows them. */
const LATE_LAYERS: Layer[] = ['structure', 'objects', 'connectors'];
```

Replace `  @state() private layers = new Set<Layer>(['cameras', 'doors', 'lights', 'sensors', 'zones', 'structure']);` with

```ts
  @state() private layers = new Set<Layer>(['cameras', 'doors', 'lights', 'sensors', 'zones', 'structure', 'objects', 'connectors']);
  /** T085: the library's shapes for the object layer, fetched by the bundle's catalog revision. */
  @state() private catalogLookup: CatalogLookup | null = null;
```

In `startWs`, replace

```ts
      if (m.type === 'entity_state_changed' && b) {
        if (!b.anchors.some((a) => a.resource_type === 'ha_entity' && a.resource_id === m.entity.entity_id)) return;
        this.bundle = { ...b, anchors: b.anchors.map((a) => (a.resource_type === 'ha_entity' && a.resource_id === m.entity.entity_id ? { ...a, entity: { ...(a.entity ?? ({} as HaEntity)), ...m.entity, actions: a.entity?.actions } } : a)) };
```

with

```ts
      if (m.type === 'entity_state_changed' && b) {
        const eid = m.entity.entity_id;
        const switches = Object.values(b.circuitStates).some((s) => s.entity_id === eid);
        if (!switches && !b.anchors.some((a) => a.resource_type === 'ha_entity' && a.resource_id === eid)) return;
        this.bundle = {
          ...b,
          anchors: b.anchors.map((a) => (a.resource_type === 'ha_entity' && a.resource_id === eid ? { ...a, entity: { ...(a.entity ?? ({} as HaEntity)), ...m.entity, actions: a.entity?.actions } } : a)),
          // a circuit's switch changed: its lamps follow at once (T085)
          circuitStates: switches ? Object.fromEntries(Object.entries(b.circuitStates).map(([id, s]) => [id, s.entity_id === eid ? { ...s, state: m.entity.state, fresh: m.entity.fresh, available: m.entity.available } : s])) : b.circuitStates,
        };
```

In `load()`, after `      if (this.bundle.source === 'api') this.startWs();` add:

```ts
      if (this.bundle.source === 'api') {
        const rev = this.bundle.catalogRevision;
        void loadLibrary(rev).then((lib) => {
          this.catalogLookup = lookupOf(lib);
        }).catch(() => {}); // without the library objects draw as plain boxes
      }
```

After the `markers` getter add:

```ts
  /** T085: what the object layer needs from the bundle - bound bodies sit on their live anchors, lamps glow by their
   * circuit's switch or their own entity. */
  private get anchorPositions(): Record<string, AnchorPosition> {
    const out: Record<string, AnchorPosition> = {};
    for (const a of this.bundle?.anchors ?? []) out[`${a.resource_type}:${a.resource_id}`] = { x: a.position.x, y: a.position.y, rotation: a.rotation_degrees };
    return out;
  }

  private get circuitStateMap(): Record<string, string | null> {
    return Object.fromEntries(Object.entries(this.bundle?.circuitStates ?? {}).map(([id, s]) => [id, s.state]));
  }

  private get entityStateMap(): Record<string, string | null> {
    const out: Record<string, string | null> = {};
    for (const a of this.bundle?.anchors ?? []) if (a.resource_type === 'ha_entity') out[a.resource_id] = a.entity?.state ?? null;
    return out;
  }
```

In `layerCounts`, replace `    const out: Record<Layer, number> = { cameras: 0, doors: 0, lights: 0, sensors: 0, zones: b?.zones.length ?? 0, structure: this.geometry?.walls.length ?? 0 };` with

```ts
    const out: Record<Layer, number> = { cameras: 0, doors: 0, lights: 0, sensors: 0, zones: b?.zones.length ?? 0, structure: this.geometry?.walls.length ?? 0,
      objects: this.geometry?.objects.length ?? 0, connectors: this.geometry?.connectors.length ?? 0 };
```

Replace the bodies of `setLayers` and `restoreLayers`:

```ts
  private setLayers(next: Set<Layer>) {
    this.layers = next;
    try {
      const stored: string[] = [...next];
      for (const id of LATE_LAYERS) if (!next.has(id)) stored.push(`-${id}`);
      localStorage.setItem(`sw.floor.layers.${this.floorId}`, JSON.stringify(stored));
    } catch {
      /* private mode or blocked storage: the choice lives for this page only */
    }
  }

  private restoreLayers() {
    try {
      const raw = localStorage.getItem(`sw.floor.layers.${this.floorId}`);
      if (!raw) return;
      const arr = JSON.parse(raw) as string[];
      if (!Array.isArray(arr)) return;
      const next = new Set<Layer>(arr.filter((l): l is Layer => LAYERS.some((x) => x.id === l)));
      for (const id of LATE_LAYERS) if (!arr.includes(`-${id}`)) next.add(id);
      this.layers = next;
    } catch {
      /* ignore */
    }
  }
```

In `renderPanel`, after the `structure` row add:

```ts
      { id: 'objects', label: 'עצמים', count: this.geometry ? `${this.geometry.objects.length} עצמים מהספרייה` : 'אין עצמים' },
      { id: 'connectors', label: 'מחברים', count: this.geometry ? `${this.geometry.connectors.length} מדרגות, רמפות ומעליות` : 'אין מחברים' },
```

In `renderStage`, replace `        .geometry=${this.layers.has('structure') ? this.geometry : null}` with:

```ts
        .geometry=${this.layers.has('structure') || this.layers.has('objects') || this.layers.has('connectors') ? this.geometry : null}
        .hideObjects=${!this.layers.has('objects')}
        .hideConnectors=${!this.layers.has('connectors')}
        .catalog=${this.catalogLookup}
        .anchorPositions=${this.anchorPositions}
        .circuitStates=${this.circuitStateMap}
        .entityStates=${this.entityStateMap}
```

(The structure layer off with objects on: walls still draw - the canvas has no wall switch; add `.hideStructure` only if the owner asks. Recorded as a known limit of this task: the "מבנה" switch hides the whole document when objects and connectors are off too, as before.)

- [ ] **Step 6: The history map and the event page**

`frontend/src/screens/investigate-history-map.ts`: replace `import type { GeometryDoc } from '../map/geometry';` with `import type { AnchorPosition, CatalogLookup, GeometryDoc } from '../map/geometry';\nimport { loadLibrary, lookupOf } from '../api/plan-catalog';`; after `  @state() private geometry: GeometryDoc | null = null;` add `  @state() private catalogLookup: CatalogLookup | null = null;`; right after the line `      this.geometry = null; // another floor or instant: no structure until its document arrives` add:

```ts
      void loadLibrary(this.bundle?.catalogRevision).then((lib) => {
        this.catalogLookup = lookupOf(lib);
      }).catch(() => {});
```

and in the `<sw-plan-canvas … .geometry=${this.geometry} dimEntities` element add, right after `.geometry=${this.geometry}`:

```ts
 .catalog=${this.catalogLookup} .anchorPositions=${Object.fromEntries(b.anchors.map((a) => [`${a.resource_type}:${a.resource_id}`, { x: a.position.x, y: a.position.y, rotation: a.rotation_degrees } as AnchorPosition]))} .entityStates=${Object.fromEntries(b.anchors.filter((a) => a.resource_type === 'ha_entity').map((a) => [a.resource_id, a.entity?.state_at?.known ? a.entity.state_at.state : null]))}
```

`frontend/src/screens/investigate-event-detail.ts`: replace `import type { GeometryDoc } from '../map/geometry';` with `import type { AnchorPosition, CatalogLookup, GeometryDoc } from '../map/geometry';\nimport { loadLibrary, lookupOf } from '../api/plan-catalog';`; after `  @state() private geometry: GeometryDoc | null = null;` add `  @state() private catalogLookup: CatalogLookup | null = null;`; in `loadMap`, after `      this.bundle = b;` add:

```ts
      void loadLibrary(b.catalogRevision).then((lib) => {
        this.catalogLookup = lookupOf(lib);
      }).catch(() => {});
```

and in its `<sw-plan-canvas …>` element add after `.geometry=${this.geometry}`:

```ts
 .catalog=${this.catalogLookup} .anchorPositions=${Object.fromEntries(this.bundle.anchors.map((a) => [`${a.resource_type}:${a.resource_id}`, { x: a.position.x, y: a.position.y, rotation: a.rotation_degrees } as AnchorPosition]))}
```

- [ ] **Step 7: Type-check, build, run**

Run (in `frontend/`):
- `npx tsc --noEmit -p tsconfig.json` → exit 0
- `npm run build`, then `SW_LIVE=1 SW_CHROME=1 npx playwright test tests/evidence-plan-studio-2.spec.ts --project=desktop --workers=1 --reporter=line` → `1 passed`
- Neighbours: `SW_LIVE=1 SW_CHROME=1 npx playwright test tests/evidence-plan-studio.spec.ts tests/evidence-viewer.spec.ts --project=desktop --workers=1 --reporter=line > "$SP/after_t8.txt"` → the phase-1 spec passes as before; `evidence-viewer` expects the layers panel rows: if it counts six rows, update its expectation to eight (`objects`, `connectors` added) and keep it green.
- `bash "$SP/fixture_chain.sh"` → `129 passed` (the live map's toolbar gained two layer buttons in demo mode too).

- [ ] **Step 8: Commit**

```bash
cd /c/cloude/smplwisebms && git add frontend/src/map/plan-symbols.ts frontend/src/map/sw-plan-canvas.ts frontend/src/styles/tokens.css frontend/src/screens/explore-floor-map.ts frontend/src/screens/investigate-history-map.ts frontend/src/screens/investigate-event-detail.ts frontend/tests/evidence-plan-studio-2.spec.ts
git add frontend/tests/evidence-viewer.spec.ts 2>/dev/null
git add docs/evidence/T007 2>/dev/null
msg=$(mktemp) && cat > "$msg" <<'EOF'
feat(plan-studio): objects and connectors on every map surface with symbols, circuit glow and layer switches (T085)

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOF
test "$(bash /c/cloude/smplwisebms/secrets/scan_staged.sh)" = 0 && git commit -F "$msg"
```

---
### Task 9: Editor — the library panel, placing objects, handles (move, rotate, stretch), Alt-duplicate, nudges, binding

**Files:**
- Modify: `frontend/src/map/studio-ops.ts` (object operations)
- Modify: `frontend/src/map/sw-plan-canvas.ts` (object and connector hits, object handles, drag kinds, `GeomDragMode` `objects`)
- Modify: `frontend/src/screens/plan-studio-panel.ts` (`GeomKind` + `object` / `connector` / `group`, the library panel, the object inspector)
- Modify: `frontend/src/screens/explore-plan-editor.ts` (tool `library`, placing, drags, nudges, binding offer, phone rule)
- Test: `frontend/tests/unit-studio-ops-2.spec.ts` (create), `frontend/tests/evidence-plan-studio-2.spec.ts` (second live test)

**Interfaces:**
- Consumes: `CatalogItem`, `CatalogLibrary`, `loadLibrary`, `lookupOf`, `itemOf`, `searchItems`, `exportUrl` (Task 7); `GeomObject`, `objectCorners`, `distanceM`, `effectiveScale` (Task 7 / phase 1); the canvas drag API of the hotfix (`GeomDragDetail`, `geom-drag-move` / `geom-drag` / `geom-drag-cancel`, `dragged()`, `geomPreview`, `nudgeGeom`).
- Produces:
  - `studio-ops.ts`: `PlaceOpts {levelId, ceilingM}`, `BIND_DISTANCE_M = 0.5`, `objectZ(item, ceilingM)`, `addObject(doc, item, p, opts, rotation = 0) -> {doc, id}`, `patchObject(doc, id, patch)`, `moveObject(doc, id, p)`, `duplicateObject(doc, id, p, newId?) -> {doc, id}`, `rotationTo(o, p, W, H, snapDeg) -> number`, `stretchedSize(o, edge, p, W, H, scale, keepRatio) -> GeomSize`, `removeItem` extended to objects (also out of groups, circuits and derived connectors), groups (members kept, unlinked), connectors and circuits.
  - Canvas: `GeomDragMode = 'all' | 'items' | 'objects' | 'none'`; `GeomDragDetail.kind` gains `'object' | 'object-rotate' | 'object-stretch' | 'object-duplicate' | 'connector-vertex'`, and `shift`, `alt` flags; `geom-select` kinds `object` / `connector`; DOM `[data-hit-object=<id>]`, `[data-hit-connector=<id>]`, `[data-object-rotate]`, `[data-object-stretch=<0..3>]`, `[data-connector-vertex=<i>]`.
  - Panel: `GeomKind = 'wall' | 'opening' | 'label' | 'object' | 'connector' | 'group'`; `LibraryView`, `LibraryActions`, `renderLibraryPanel`; `ObjectView`, `ObjectActions`, `renderObjectInspector`; DOM `[data-library-panel][data-studio-save]`, `[data-lib-search]`, `[data-lib-cat=<id|all|recent|favorites>]`, `[data-lib-item=<id>]`, `[data-lib-fav=<id>]`, `[data-lib-cancel]`, `[data-selected-object=<id>]`, `[data-object-label]`, `[data-item-level]`, `[data-object-w] [data-object-d] [data-object-h] [data-object-rotation] [data-object-z]`, `[data-object-param=<name>]`, `[data-object-unbind]`, `[data-object-array]`, `[data-object-custom]`, `[data-select-group]`, `[data-geom-delete]`.
  - Editor: tool `[data-tool="library"]` (icon `grid`, label "ספריית עצמים"); `[data-bind-offer]` bar with `[data-bind-accept]` / `[data-bind-dismiss]`; localStorage `sw.studio.recent`, `sw.studio.fav`; the phone rule (`(max-width: 767px)`): the wall mode and arrays answer with an in-page message.

- [ ] **Step 1: The failing node spec (`frontend/tests/unit-studio-ops-2.spec.ts`)**

```ts
import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { GeometryDoc, GeomObject } from '../src/map/geometry';
import type { CatalogItem } from '../src/api/plan-catalog';
import { addObject, duplicateObject, moveObject, objectZ, patchObject, removeItem, rotationTo, stretchedSize } from '../src/map/studio-ops';

// Plan Studio phase 2 (T085): the pure document operations of the editor - placing an item (its size, z and params come
// from the library), moving, rotating, stretching, duplicating, and removing an object out of its group, its circuit
// and the connector derived from it. Runs in node. Later tasks add their operations to this file.
const HERE = path.dirname(fileURLToPath(import.meta.url));
const sample = () => JSON.parse(fs.readFileSync(path.resolve(HERE, '..', '..', 'contracts', 'fixtures', 'plan_geometry', 'sample-v2.json'), 'utf8')) as GeometryDoc;
const library = JSON.parse(fs.readFileSync(path.resolve(HERE, '..', '..', 'smplwise_vms', 'backend', 'smplwise', 'catalog', 'objects.json'), 'utf8')) as { items: CatalogItem[] };
const item = (id: string): CatalogItem => library.items.find((i) => i.id === id)!;
const PLACE = { levelId: 'L0', ceilingM: 3.0 };

test.describe('plan studio object operations (unit)', () => {
  test('placing an item copies its size, params and height; a ceiling item sits below the ceiling', () => {
    const doc = sample();
    const chair = addObject(doc, item('chair.basic'), [0.42, 0.61], PLACE);
    const o = chair.doc.objects.find((x) => x.id === chair.id)!;
    expect(o).toMatchObject({ item_id: 'chair.basic', level_id: 'L0', position: [0.42, 0.61], rotation_deg: 0, size: { w_m: 0.45, d_m: 0.45, h_m: 0.85 }, z_m: 0, params: {}, label: null, anchor_ref: null, group_id: null, source: 'manual', locked: false });
    const lamp = addObject(chair.doc, item('light.ceiling'), [0.5, 0.5], PLACE, 30);
    const l = lamp.doc.objects.find((x) => x.id === lamp.id)!;
    expect(l.z_m).toBe(2.7);
    expect(l.params).toEqual({ power_w: 36 });
    expect(l.rotation_deg).toBe(30);
    expect(objectZ(item('extinguisher.co2'), 3.0)).toBe(0.9);
    expect(doc.objects.length).toBe(5);
  });

  test('move, rotate, stretch, duplicate', () => {
    const doc = sample();
    const moved = moveObject(doc, 'o1', [1.4, 0.3]);
    expect(moved.objects.find((x) => x.id === 'o1')!.position).toEqual([1, 0.3]);
    const o2 = doc.objects.find((x) => x.id === 'o2')!; // centre (300, 320) px
    expect(rotationTo(o2, [0.3, 0.1], 1000, 800, 1)).toBe(0); // straight up
    expect(rotationTo(o2, [0.5, 0.4], 1000, 800, 1)).toBe(90); // to the right
    expect(rotationTo(o2, [0.32, 0.1], 1000, 800, 15)).toBe(0); // Shift snaps to 15 degrees
    const o1 = doc.objects.find((x) => x.id === 'o1')!; // 45 x 45 px at (200, 160), scale 0.01
    expect(stretchedSize(o1, 1, [0.25, 0.2], 1000, 800, 0.01, false)).toEqual({ w_m: 1, d_m: 0.45, h_m: 0.85 }); // right edge to x = 250: half width 50 px = 0.5 m
    expect(stretchedSize(o1, 2, [0.2, 0.3], 1000, 800, 0.01, false)).toEqual({ w_m: 0.45, d_m: 1.6, h_m: 0.85 }); // bottom edge to y = 240
    expect(stretchedSize(o1, 1, [0.25, 0.2], 1000, 800, 0.01, true)).toEqual({ w_m: 1, d_m: 1, h_m: 0.85 }); // ratio kept
    expect(stretchedSize(o1, 1, [0.2, 0.2], 1000, 800, 0.01, false).w_m).toBe(0.05); // never below the minimum
    const dup = duplicateObject(doc, 'o3', [0.6, 0.6]);
    const copy = dup.doc.objects.find((x) => x.id === dup.id)!;
    expect(copy).toMatchObject({ item_id: 'light.ceiling', position: [0.6, 0.6], anchor_ref: null, group_id: null, z_m: 2.7 });
    expect(dup.doc.objects.length).toBe(6);
    expect(duplicateObject(doc, 'o1', [0.1, 0.1], 'fixed-id').id).toBe('fixed-id');
    expect(patchObject(doc, 'o1', { label: 'כיסא', position: [-1, 0.2] }).objects[0]).toMatchObject({ id: 'o1', label: 'כיסא', position: [0, 0.2] });
  });

  test('removing an object takes it out of its group, its circuit and its derived connector; removing a group keeps the members', () => {
    const doc = sample();
    const noLamp = removeItem(doc, 'o3');
    expect(noLamp.objects.some((x) => x.id === 'o3')).toBe(false);
    expect(noLamp.circuits[0].member_ids).toEqual([]);
    const noTribune = removeItem(doc, 'o4');
    expect(noTribune.connectors.map((c) => c.id)).toEqual(['c1']);
    const noChair = removeItem(doc, 'o1');
    expect(noChair.groups[0].member_ids).toEqual(['o2']);
    const noGroup = removeItem(doc, 'g1');
    expect(noGroup.groups).toEqual([]);
    expect(noGroup.objects.filter((o) => o.group_id === null).length).toBe(5);
    expect(removeItem(doc, 'c1').connectors.map((c) => c.id)).toEqual(['cx-o4']);
    expect(removeItem(doc, 'k1').circuits).toEqual([]);
    expect((doc.objects[0] as GeomObject).group_id).toBe('g1'); // the input is untouched
  });
});
```

Run (in `frontend/`): `npx playwright test tests/unit-studio-ops-2.spec.ts --project=desktop --reporter=line`
Expected: FAIL — `addObject` is not exported.

- [ ] **Step 2: Object operations (`frontend/src/map/studio-ops.ts`)**

Replace the import line with:

```ts
import { DEFAULT_LEVEL_ID, OPENING_DEFAULTS, rotated, type GeometryDoc, type GeomLabel, type GeomObject, type GeomOpening, type GeomSize, type GeomWall, type OpeningKind, type Pt, type Swing, type WallKind } from './geometry';
import type { CatalogItem } from '../api/plan-catalog';
```

Replace `removeItem` with:

```ts
/** A wall takes its openings with it; an object leaves its group and its circuit and takes the connector derived from it;
 * a group leaves its members in place, unlinked; a connector and a circuit simply go. */
export function removeItem(doc: GeometryDoc, id: string): GeometryDoc {
  if (doc.walls.some((w) => w.id === id)) return { ...doc, walls: doc.walls.filter((w) => w.id !== id), openings: doc.openings.filter((o) => o.wall_id !== id) };
  if (doc.objects.some((o) => o.id === id)) {
    return {
      ...doc,
      objects: doc.objects.filter((o) => o.id !== id),
      groups: doc.groups.map((g) => (g.member_ids.includes(id) ? { ...g, member_ids: g.member_ids.filter((m) => m !== id) } : g)),
      circuits: doc.circuits.map((k) => (k.member_ids.includes(id) ? { ...k, member_ids: k.member_ids.filter((m) => m !== id) } : k)),
      connectors: doc.connectors.filter((c) => c.object_id !== id),
    };
  }
  if (doc.groups.some((g) => g.id === id)) return { ...doc, groups: doc.groups.filter((g) => g.id !== id), objects: doc.objects.map((o) => (o.group_id === id ? { ...o, group_id: null } : o)) };
  if (doc.connectors.some((c) => c.id === id)) return { ...doc, connectors: doc.connectors.filter((c) => c.id !== id) };
  if (doc.circuits.some((k) => k.id === id)) return { ...doc, circuits: doc.circuits.filter((k) => k.id !== id) };
  return { ...doc, openings: doc.openings.filter((o) => o.id !== id), labels: doc.labels.filter((l) => l.id !== id) };
}
```

Append at the end of the file:

```ts
// ---------------------------------------------------------------- objects (T085)

export interface PlaceOpts {
  levelId: string;
  ceilingM: number;
}
/** An object dropped this close (metres) to an anchor of a kind its item may represent is offered as the anchor's body. */
export const BIND_DISTANCE_M = 0.5;
const MIN_SIZE_M = 0.05;
const MAX_SIZE_M = 100;
const round3 = (v: number): number => Math.round(v * 1000) / 1000;

/** The height an item sits at: ceiling items carry a negative offset from the level's ceiling (a lamp at ceiling - 0.3). */
export function objectZ(item: Pick<CatalogItem, 'z_ref' | 'z_m'>, ceilingM: number): number {
  return item.z_ref === 'ceiling' ? round3(ceilingM + item.z_m) : item.z_m;
}

export function addObject(doc: GeometryDoc, item: CatalogItem, p: Pt, opts: PlaceOpts, rotation = 0): { doc: GeometryDoc; id: string } {
  const o: GeomObject = { id: newId(), item_id: item.id, level_id: opts.levelId, position: clampPt(p), rotation_deg: rotation, size: { ...item.size }, z_m: objectZ(item, opts.ceilingM),
    params: JSON.parse(JSON.stringify(item.params)) as Record<string, unknown>, label: null, anchor_ref: null, group_id: null, confidence: 1, source: 'manual', locked: false, external_ids: {} };
  return { doc: { ...doc, objects: [...doc.objects, o] }, id: o.id };
}

export function patchObject(doc: GeometryDoc, id: string, patch: Partial<GeomObject>): GeometryDoc {
  return { ...doc, objects: doc.objects.map((o) => (o.id === id ? { ...o, ...patch, id: o.id, position: patch.position ? clampPt(patch.position) : o.position } : o)) };
}

export function moveObject(doc: GeometryDoc, id: string, p: Pt): GeometryDoc {
  return patchObject(doc, id, { position: p });
}

/** A copy at `p`: same item, size, height, params, label, level and rotation; never bound, never in a group. */
export function duplicateObject(doc: GeometryDoc, id: string, p: Pt, newIdValue?: string): { doc: GeometryDoc; id: string } {
  const src = doc.objects.find((o) => o.id === id);
  if (!src) return { doc, id };
  const copy: GeomObject = { ...src, id: newIdValue ?? newId(), position: clampPt(p), params: JSON.parse(JSON.stringify(src.params)) as Record<string, unknown>, size: { ...src.size }, anchor_ref: null, group_id: null, external_ids: {} };
  return { doc: { ...doc, objects: [...doc.objects, copy] }, id: copy.id };
}

/** The rotation (0 = up, clockwise) that points an object's front at `p`, snapped to `snapDeg` degrees. */
export function rotationTo(o: Pick<GeomObject, 'position'>, p: Pt, W: number, H: number, snapDeg: number): number {
  const dx = (p[0] - o.position[0]) * W;
  const dy = (p[1] - o.position[1]) * H;
  if (Math.hypot(dx, dy) < 1e-9) return 0;
  const deg = (Math.atan2(dx, -dy) * 180) / Math.PI;
  const snapped = Math.round(deg / snapDeg) * snapDeg;
  return ((snapped % 360) + 360) % 360;
}

/** The size after dragging an edge midpoint to `p`: edge 0 = front (-d), 1 = right (+w), 2 = back (+d), 3 = left (-w); the
 * opposite edge stays where it is in the footprint's own frame (the centre moves with it - the editor recentres). Shift
 * keeps the width / depth ratio. Never below 5 cm, never above 100 m. */
export function stretchedSize(o: Pick<GeomObject, 'position' | 'rotation_deg' | 'size'>, edge: 0 | 1 | 2 | 3, p: Pt, W: number, H: number, scale: number, keepRatio: boolean): GeomSize {
  const theta = ((o.rotation_deg || 0) * Math.PI) / 180;
  const [ax, ay] = rotated(0, 0, edge === 1 ? 1 : edge === 3 ? -1 : 0, edge === 2 ? 1 : edge === 0 ? -1 : 0, theta); // the edge's outward unit vector on screen
  const dx = (p[0] - o.position[0]) * W;
  const dy = (p[1] - o.position[1]) * H;
  const along = Math.max(0, dx * ax + dy * ay); // how far from the centre the pointer is, along the outward direction
  const clamp = (v: number) => Math.min(MAX_SIZE_M, Math.max(MIN_SIZE_M, round3(v)));
  const ratio = o.size.d_m / o.size.w_m;
  if (edge === 1 || edge === 3) {
    const w = clamp(along * 2 * scale);
    return { ...o.size, w_m: w, d_m: keepRatio ? clamp(w * ratio) : o.size.d_m };
  }
  const d = clamp(along * 2 * scale);
  return { ...o.size, d_m: d, w_m: keepRatio ? clamp(d / ratio) : o.size.w_m };
}
```

Run the node spec again → `3 passed`.

- [ ] **Step 3: The canvas — object and connector hits, object handles (`frontend/src/map/sw-plan-canvas.ts`)**

Add `type ConnectorPrim, type ObjectPrim` to the `./geometry` import (after `type LabelPrim,`).

Replace the `GeomDragDetail` interface and `GeomDragMode` type with:

```ts
export interface GeomDragDetail {
  kind: 'vertex' | 'opening' | 'label' | 'object' | 'object-rotate' | 'object-stretch' | 'object-duplicate' | 'connector-vertex';
  id: string;
  /** A wall corner, a stretch edge (0 front, 1 right, 2 back, 3 left) or a connector corner. */
  index: number;
  x: number;
  y: number;
  shift: boolean;
  alt: boolean;
}

/** What the pointer can grab in the structure: 'all' (the structure tool's select mode) walls, openings, labels, objects,
 * connectors and the selected item's handles; 'objects' (the library, connectors and circuits tools) objects and
 * connectors only; 'items' (the structure tool's drawing modes) the existing openings and labels only; 'none' nothing. */
export type GeomDragMode = 'all' | 'items' | 'objects' | 'none';
```

In `onGeomDragStart`, replace the two lines

```ts
    const detail = (p: { x: number; y: number }): GeomDragDetail => ({ kind, id, index, x: +p.x.toFixed(5), y: +p.y.toFixed(5) });
```

with

```ts
    let mods = { shift: e.shiftKey, alt: e.altKey };
    const detail = (p: { x: number; y: number }): GeomDragDetail => ({ kind, id, index, x: +p.x.toFixed(5), y: +p.y.toFixed(5), ...mods });
```

in its `move` handler add as the first line `      mods = { shift: ev.shiftKey, alt: ev.altKey };`, and replace

```ts
      else emit('geom-select', kind === 'vertex' ? { id, kind: 'wall', vertex: index } : { id, kind });
```

with

```ts
      else emit('geom-select', kind === 'vertex' ? { id, kind: 'wall', vertex: index } : { id, kind: kind.startsWith('object') ? 'object' : kind === 'connector-vertex' ? 'connector' : kind });
```

Replace the guard line `    if (e.button !== 0 || this.geomDrag === 'none' || (kind === 'vertex' && this.geomDrag !== 'all')) return;` with

```ts
    const objectKind = kind.startsWith('object') || kind === 'connector-vertex';
    if (e.button !== 0 || this.geomDrag === 'none' || (kind === 'vertex' && this.geomDrag !== 'all') || (objectKind && this.geomDrag === 'items') || (!objectKind && this.geomDrag === 'objects')) return;
```

Add after `pickGeom`:

```ts
  private pickConnector(id: string, e: Event) {
    e.stopPropagation();
    if (this.dragMoved) return;
    this.dispatchEvent(new CustomEvent('geom-select', { detail: { id, kind: 'connector' }, bubbles: true, composed: true }));
  }

  /** The selected object's handles: a rotate knob past its front edge and a stretch square on each edge midpoint. */
  private renderObjectHandles(p: ObjectPrim, inv: number) {
    const mid = (i: number): Pt => [(p.corners[i][0] + p.corners[(i + 1) % 4][0]) / 2, (p.corners[i][1] + p.corners[(i + 1) % 4][1]) / 2];
    const front = mid(0);
    const dx = front[0] - p.cx;
    const dy = front[1] - p.cy;
    const n = Math.hypot(dx, dy) || 1;
    const knob: Pt = [front[0] + (dx / n) * 18 * inv, front[1] + (dy / n) * 18 * inv];
    const hs = 5 * inv;
    return svg`<g class="ohandles">
      <line class="handle-line" x1=${front[0]} y1=${front[1]} x2=${knob[0]} y2=${knob[1]} />
      ${[0, 1, 2, 3].map((i) => { const m = mid(i); return svg`<rect class="handle" data-object-stretch=${i} x=${m[0] - hs} y=${m[1] - hs} width=${hs * 2} height=${hs * 2} rx=${1.5 * inv} role="slider" aria-label="מתיחה"
          @pointerdown=${(e: PointerEvent) => this.onGeomDragStart('object-stretch', p.id, i, e)} @click=${(e: Event) => e.stopPropagation()} />`; })}
      <circle class="handle" data-object-rotate cx=${knob[0]} cy=${knob[1]} r=${7 * inv} role="slider" aria-label="סיבוב" @pointerdown=${(e: PointerEvent) => this.onGeomDragStart('object-rotate', p.id, 0, e)} @click=${(e: Event) => e.stopPropagation()} />
    </g>`;
  }
```

In `renderGeomHits`, replace

```ts
    const selWall = mode === 'all' ? doc.walls.find((w) => w.id === this.selectedGeomId) : undefined;
    const drag = this.geomDragAt;
    return svg`<g class="geom-hits">
```

with

```ts
    const selWall = mode === 'all' ? doc.walls.find((w) => w.id === this.selectedGeomId) : undefined;
    const drag = this.geomDragAt;
    const objectsOn = mode === 'all' || mode === 'objects';
    const objects = objectsOn ? prims.filter((p): p is ObjectPrim => p.kind === 'object' && !this.hideObjects) : [];
    const connectors = objectsOn ? prims.filter((p): p is ConnectorPrim => p.kind === 'connector' && !this.hideConnectors) : [];
    const selObject = objectsOn && !drag ? objects.find((p) => p.id === this.selectedGeomId) : undefined;
    const selConnector = objectsOn ? doc.connectors.find((c) => c.id === this.selectedGeomId) : undefined;
    return svg`<g class="geom-hits">
      ${connectors.map((p) => svg`<path class="hit" data-hit-connector=${p.id} d=${`M ${p.points.map((q) => `${q[0]} ${q[1]}`).join(' L ')}`} stroke-width=${Math.max(p.width, 12 * inv)} @click=${(e: Event) => this.pickConnector(p.id, e)} />`)}
      ${objects.map((p) => svg`<polygon class="hit ohit" data-hit-object=${p.id} points=${ptsAttr(p.corners)} @pointerdown=${(e: PointerEvent) => this.onGeomDragStart(e.altKey ? 'object-duplicate' : 'object', p.id, 0, e)} @click=${(e: Event) => e.stopPropagation()} />`)}
      ${selConnector && !selConnector.object_id ? selConnector.polyline.map((v, i) => svg`<circle class="gvtx" data-connector-vertex=${i} cx=${v[0] * W} cy=${v[1] * H} r=${6 * inv} stroke-width=${1.6 * inv} aria-label=${`פינת מחבר ${i + 1}`}
          @pointerdown=${(e: PointerEvent) => this.onGeomDragStart('connector-vertex', selConnector.id, i, e)} @click=${(e: Event) => e.stopPropagation()} />`) : nothing}
      ${selObject ? this.renderObjectHandles(selObject, inv) : nothing}
```

In `static styles`, after the `.geom-hits line.hit { … }` rule add:

```css
    .geom-hits .ohit {
      pointer-events: all;
      cursor: move;
    }
    .geom-hits path.hit {
      pointer-events: stroke;
    }
```

- [ ] **Step 4: The panel — library and object inspector (`frontend/src/screens/plan-studio-panel.ts`)**

Replace `export type GeomKind = 'wall' | 'opening' | 'label';` with `export type GeomKind = 'wall' | 'opening' | 'label' | 'object' | 'connector' | 'group';`. Replace the `../map/geometry` import with:

```ts
import { effectiveScale, lengthPx, perimeterM, polygonAreaM2, type GeometryDoc, type GeomLabel, type GeomLevel, type GeomObject, type GeomOpening, type GeomWall, type Hinge, type OpeningKind, type Pt, type Swing, type WallKind } from '../map/geometry';
import type { CatalogItem, CatalogLibrary, ParamSpec } from '../api/plan-catalog';
import { searchItems } from '../api/plan-catalog';
```

Append before `export const studioPanelStyles = css\``:

```ts
// ---------------------------------------------------------------- the library and the object inspector (T085)

export interface LibraryView {
  lib: CatalogLibrary;
  q: string;
  /** null = every category; 'recent' and 'favorites' are the two special shelves. */
  category: string | null;
  recent: string[];
  favorites: string[];
  placing: CatalogItem | null;
  saveState: SaveState;
  phone: boolean;
  exportHref: string;
  canManage: boolean;
}

export interface LibraryActions {
  setQuery(q: string): void;
  setCategory(id: string | null): void;
  pick(item: CatalogItem): void;
  toggleFavorite(id: string): void;
  importFile(file: File): void;
  cancelPlacing(): void;
}

export function renderLibraryPanel(v: LibraryView, a: LibraryActions): TemplateResult {
  const special = v.category === 'recent' || v.category === 'favorites';
  const pool = v.category === 'recent' ? v.recent.map((id) => v.lib.items.find((i) => i.id === id)).filter((i): i is CatalogItem => !!i)
    : v.category === 'favorites' ? v.lib.items.filter((i) => v.favorites.includes(i.id)) : v.lib.items;
  const items = searchItems(pool, v.q, special ? null : v.category).slice(0, 60);
  return html`<sw-card heading="ספריית עצמים" subheading=${v.placing ? `לחץ על התוכנית כדי להציב: ${v.placing.names.he} · Esc לביטול` : `${v.lib.items.length} פריטים · חיפוש בעברית ובאנגלית`} data-library-panel data-studio-save=${v.saveState}>
    <sw-field><input type="search" data-lib-search placeholder="חיפוש: כיסא, מטף, bleachers…" .value=${v.q} @input=${(e: Event) => a.setQuery((e.target as HTMLInputElement).value)} /></sw-field>
    <div class="modes" role="group" aria-label="קטגוריות">
      <button class=${v.category === null ? 'on' : ''} data-lib-cat="all" @click=${() => a.setCategory(null)}>הכול</button>
      <button class=${v.category === 'recent' ? 'on' : ''} data-lib-cat="recent" @click=${() => a.setCategory('recent')}>לאחרונה</button>
      <button class=${v.category === 'favorites' ? 'on' : ''} data-lib-cat="favorites" @click=${() => a.setCategory('favorites')}>מועדפים</button>
      ${v.lib.categories.map((c) => html`<button class=${v.category === c.id ? 'on' : ''} data-lib-cat=${c.id} @click=${() => a.setCategory(c.id)}>${c.he}</button>`)}
    </div>
    ${v.placing ? html`<div class="btns"><sw-button size="sm" variant="ghost" data-lib-cancel @click=${() => a.cancelPlacing()}>סיים הצבה</sw-button></div>` : nothing}
    <div class="list libl">
      ${items.length ? items.map((i) => html`<div class="libitem ${v.placing?.id === i.id ? 'on' : ''}" data-lib-item=${i.id} role="button" tabindex="0" draggable="true" title=${`${i.names.he} · ${i.size.w_m}×${i.size.d_m}×${i.size.h_m} מ׳`}
          @dragstart=${(e: DragEvent) => e.dataTransfer?.setData('text/x-sw-item', i.id)} @click=${() => a.pick(i)} @keydown=${(e: KeyboardEvent) => (e.key === 'Enter' || e.key === ' ') && a.pick(i)}>
          <span class="nm">${i.names.he}${i.custom ? html` <span class="muted">מותאם</span>` : nothing}</span>
          <span class="muted ltr">${i.size.w_m}×${i.size.d_m} m</span>
          <button class="fav ${v.favorites.includes(i.id) ? 'on' : ''}" data-lib-fav=${i.id} aria-label="מועדף" @click=${(e: Event) => { e.stopPropagation(); a.toggleFavorite(i.id); }}>★</button>
        </div>`) : html`<div class="note">${v.category === 'recent' ? 'עדיין לא הוצבו פריטים בדפדפן הזה.' : v.category === 'favorites' ? 'סמן ★ ליד פריט כדי לשמור אותו כאן.' : 'לא נמצאו פריטים.'}</div>`}
    </div>
    ${v.phone ? html`<div class="note">בטלפון: הצבה והזזה של עצם בודד; מערכים וציור קירות בדסקטופ.</div>` : nothing}
    ${v.canManage ? html`<div class="exports" role="group" aria-label="הספרייה המותאמת">
      <a class="btnlink" data-lib-export href=${v.exportHref} download>ייצוא הספרייה המותאמת</a>
      <label class="btnlink">ייבוא<input type="file" accept="application/json,.json" data-lib-import hidden @change=${(e: Event) => { const f = (e.target as HTMLInputElement).files?.[0]; if (f) a.importFile(f); (e.target as HTMLInputElement).value = ''; }} /></label>
    </div>` : nothing}
  </sw-card>`;
}

export interface ObjectView {
  o: GeomObject;
  item: CatalogItem | undefined;
  levels: GeomLevel[];
  doc: GeometryDoc;
  estimated: boolean;
  showEstimates: boolean;
  anchorName: string | null;
  phone: boolean;
  canManage: boolean;
}

export interface ObjectActions {
  patch(id: string, patch: Partial<GeomObject>): void;
  unbind(id: string): void;
  remove(id: string): void;
  array(id: string): void;
  custom(id: string): void;
  selectGroup(groupId: string): void;
}

function paramField(o: GeomObject, name: string, spec: ParamSpec, levels: GeomLevel[], a: ObjectActions) {
  const value = o.params[name];
  if (spec.type === 'level') {
    return html`<sw-field label=${spec.he}><select data-object-param=${name} @change=${(e: Event) => a.patch(o.id, { params: { ...o.params, [name]: (e.target as HTMLSelectElement).value || null } })}>
      <option value="" ?selected=${!value}>ללא</option>${levels.filter((l) => l.id !== o.level_id).map((l) => html`<option value=${l.id} ?selected=${value === l.id}>${l.name} (${l.elevation_m} מ׳)</option>`)}</select></sw-field>`;
  }
  const step = spec.type === 'int' ? 1 : 0.1;
  return html`<sw-field label=${spec.he}><input type="number" data-ltr data-object-param=${name} min=${String(spec.min ?? '')} max=${String(spec.max ?? '')} step=${String(step)} .value=${value === null || value === undefined ? '' : String(value)}
    @change=${(e: Event) => { const x = spec.type === 'int' ? parseInt((e.target as HTMLInputElement).value, 10) : parseFloat((e.target as HTMLInputElement).value); if (Number.isFinite(x) && (spec.min === undefined || x >= spec.min) && (spec.max === undefined || x <= spec.max)) a.patch(o.id, { params: { ...o.params, [name]: x } }); }} /></sw-field>`;
}

export function renderObjectInspector(v: ObjectView, a: ObjectActions): TemplateResult {
  const o = v.o;
  const name = v.item?.names.he ?? o.item_id;
  const group = o.group_id ? v.doc.groups.find((g) => g.id === o.group_id) : undefined;
  const size = (key: 'w_m' | 'd_m' | 'h_m', label: string, attr: string) => html`<sw-field label=${label}><input type="number" min="0.05" max="100" step="0.05" data-ltr ${attr} .value=${String(o.size[key])}
      @change=${(e: Event) => { const x = numberOf(e); if (x >= 0.05 && x <= 100) a.patch(o.id, { size: { ...o.size, [key]: x } }); }} /></sw-field>`;
  return html`<sw-card heading=${name} subheading=${v.item ? `${v.lib_category(v.item)}${v.item.custom ? ' · פריט מותאם' : ''}` : 'הפריט לא קיים בספרייה: העצם מצויר כתיבה'} data-selected-object=${o.id}>
    <sw-field label="שם על המפה (אופציונלי)"><input type="text" maxlength="80" data-object-label .value=${o.label ?? ''} @change=${(e: Event) => a.patch(o.id, { label: (e.target as HTMLInputElement).value.trim() || null })} /></sw-field>
    ${o.anchor_ref
      ? html`<div class="note" data-object-bound>הגוף של ${v.anchorName ?? o.anchor_ref.resource_id}: המיקום, המצב וההרשאות מהעוגן. <button class="linkbtn" data-object-unbind @click=${() => a.unbind(o.id)}>נתק מהישות</button></div>`
      : nothing}
    <div class="two">
      <sw-field label="מפלס"><select data-item-level @change=${(e: Event) => a.patch(o.id, { level_id: (e.target as HTMLSelectElement).value })}>${v.levels.map((l) => html`<option value=${l.id} ?selected=${l.id === o.level_id}>${l.name}</option>`)}</select></sw-field>
      <sw-field label="סיבוב (°)"><input type="number" min="0" max="359" step="1" data-ltr data-object-rotation .value=${String(Math.round(o.rotation_deg))} ?disabled=${!!o.anchor_ref}
        @change=${(e: Event) => a.patch(o.id, { rotation_deg: ((Math.round(numberOf(e)) % 360) + 360) % 360 })} /></sw-field>
    </div>
    <div class="three">${size('w_m', 'רוחב (מ׳)', 'data-object-w')}${size('d_m', 'עומק (מ׳)', 'data-object-d')}${size('h_m', 'גובה (מ׳)', 'data-object-h')}</div>
    <sw-field label="גובה מהרצפה (מ׳)"><input type="number" min="-50" max="500" step="0.05" data-ltr data-object-z .value=${String(o.z_m)} @change=${(e: Event) => { const x = numberOf(e); if (x >= -50 && x <= 500) a.patch(o.id, { z_m: x }); }} /></sw-field>
    ${v.item ? Object.entries(v.item.params_schema).map(([k, spec]) => paramField(o, k, spec, v.levels, a)) : nothing}
    ${group ? html`<div class="note" data-object-group>חלק ממערך של ${group.member_ids.length} · <button class="linkbtn" data-select-group @click=${() => a.selectGroup(group.id)}>בחר את המערך</button></div>` : nothing}
    <div class="note">${v.estimated ? (v.showEstimates ? 'המידות במטרים משוערות (≈) עד הכיול' : 'לא מכויל: המידות מוצגות כערכי הפריט') : 'המידות במטרים לפי הכיול'} · חצים = הזזה עדינה (Shift = גדולה) · Alt+גרירה = שכפול · Delete = מחיקה</div>
    <div class="btns">
      <sw-button size="sm" icon="grid" data-object-array ?disabled=${v.phone || !!o.anchor_ref} title=${v.phone ? 'מערכים בדסקטופ בלבד' : 'שורות × עמודות מהעצם הזה'} @click=${() => a.array(o.id)}>מערך</sw-button>
      ${v.canManage ? html`<sw-button size="sm" icon="plus" data-object-custom @click=${() => a.custom(o.id)}>צור פריט מזה</sw-button>` : nothing}
      <sw-button size="sm" variant="ghost" icon="trash" data-geom-delete @click=${() => a.remove(o.id)}>מחק</sw-button>
    </div>
  </sw-card>`;
}
```

and give `ObjectView` its category helper: add to the interface `  /** The Hebrew name of an item's category (the editor passes the library's list). */\n  lib_category(item: CatalogItem): string;`.

In `studioPanelStyles`, before the closing backtick add:

```css
  .three {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    gap: 8px;
  }
  .libl {
    max-block-size: 320px;
  }
  .libitem {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto auto;
    gap: 8px;
    align-items: center;
    padding: 6px 8px;
    border: 1px solid var(--sw-border);
    border-radius: 8px;
    background: var(--sw-surface);
    font-size: var(--sw-fs-sm);
    cursor: pointer;
  }
  .libitem:hover,
  .libitem.on {
    background: var(--sw-accent-soft);
    border-color: var(--sw-accent);
  }
  .libitem .nm {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .libitem .muted {
    color: var(--sw-text-2);
    font-size: var(--sw-fs-xs);
  }
  .libitem .ltr {
    direction: ltr;
    unicode-bidi: isolate;
  }
  .libitem .fav {
    border: 0;
    background: none;
    color: var(--sw-text-3);
    font: inherit;
    cursor: pointer;
    padding: 0 2px;
  }
  .libitem .fav.on {
    color: var(--sw-warning);
  }
```

- [ ] **Step 5: The editor (`frontend/src/screens/explore-plan-editor.ts`)**

Imports: add after the `../api/prefs` import line:

```ts
import { itemOf, loadLibrary, lookupOf, type CatalogItem, type CatalogLibrary } from '../api/plan-catalog';
```

replace the `../map/geometry` import with

```ts
import { distanceM, effectiveScale, isClosedOutline, lengthPx, nearestWall, pointOnWall, snapPoint, type CatalogLookup, type GeometryDoc, type GeomWall, type Pt } from '../map/geometry';
```

replace the `../map/studio-ops` import with

```ts
import { BIND_DISTANCE_M, addLabel, addObject, addOpening, addWall, defaultLevelId, duplicateObject, moveObject, moveVertex, newId, nudgeT, openingRange, patchLabel, patchObject, patchOpening, patchWall, removeItem, rotationTo, stretchedSize, type WallDefaults } from '../map/studio-ops';
```

and the `./plan-studio-panel` import with

```ts
import { COLL_LABEL, countLabel, fmtMetres, fmtScale, renderCalibPanel, renderLibraryPanel, renderMeasurePanel, renderObjectInspector, renderStudioPanel, studioPanelStyles, type GeomKind, type GeomSel, type StudioMode } from './plan-studio-panel';
```

(Every symbol above is used by this task; `noUnusedLocals` stays green. Task 10 extends the `plan-catalog` line with `createItem`, `importItems` and `exportUrl as catalogExportUrl`.)

Tools: replace the `Tool` type and add the tool row:

```ts
type Tool = 'select' | 'camera' | 'lights' | 'entity' | 'zones' | 'structure' | 'library' | 'calibrate' | 'measure' | 'layers';
```

and in `TOOLS` after the `structure` entry add `  { id: 'library', icon: 'grid', label: 'ספריית עצמים', ready: true },`; replace `const STUDIO_TOOLS: Tool[] = ['structure', 'calibrate', 'measure'];` with `const STUDIO_TOOLS: Tool[] = ['structure', 'library', 'calibrate', 'measure'];`.

After `const ARROWS = […];` add:

```ts
/** Per-browser shelves of the library panel (design 4.3: "recent" and "favourites" per browser). */
const readList = (key: string): string[] => { try { const v = JSON.parse(localStorage.getItem(key) ?? '[]'); return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []; } catch { return []; } };
const writeList = (key: string, list: string[]) => { try { localStorage.setItem(key, JSON.stringify(list.slice(0, 40))); } catch { /* private mode */ } };
```

State: after `  private nudgeBurst: … = null;` add:

```ts
  // ---- Plan Studio phase 2 (T085): the library, placing, binding ----
  @state() private library: CatalogLibrary | null = null;
  private libLookup: CatalogLookup | null = null;
  @state() private libQ = '';
  @state() private libCategory: string | null = null;
  @state() private libRecent: string[] = readList('sw.studio.recent');
  @state() private libFav: string[] = readList('sw.studio.fav');
  /** The item the next click on the plan places (desktop: stays armed until Esc; phone: one placement). */
  @state() private placingItem: CatalogItem | null = null;
  /** An object dropped within BIND_DISTANCE_M of an anchor its item may represent: the offer to make it the anchor's body. */
  @state() private bindOffer: { objectId: string; anchor: Anchor } | null = null;
  /** The id a duplicate takes while it is dragged (Alt + drag), so the preview and the drop agree. */
  private dupId: string | null = null;
  private readonly phone = window.matchMedia('(max-width: 767px)');
```

In `load()`, replace `      void this.loadStudio(b);` with `      void this.loadStudio(b);\n      void this.loadLibraryFor(b);`.

In `pickTool`, after `    this.geomPreview = null;` add `    this.placingItem = null;\n    this.bindOffer = null;\n    if (tool === 'structure' && this.phone.matches && this.studioMode === 'wall') this.studioMode = 'select'; // wall drawing is desktop only: a phone opens the tool in select mode`.

Replace the `studioPlacing` getter and the `geomDragMode` getter with:

```ts
  /** Clicks on the plan go to the studio tool instead of selecting pins. */
  private get studioPlacing(): boolean {
    if (!this.studioOn) return false;
    if (this.tool === 'library') return !!this.placingItem;
    return this.tool !== 'structure' || this.studioMode !== 'select';
  }

  /** What the pointer can grab in the structure (owner report on 0.1.82: a door just placed could not be slid along its
   * wall without switching to select mode). Select mode: everything, corners included. Every drawing mode: the existing
   * openings and labels, so a press on one drags it (or selects it) while a press on a bare wall still places a door;
   * in wall mode a corner stays a snap target for the new wall, not a handle. Nothing while a wall is being drawn: its
   * clicks belong to the drawing. The library tool: objects and connectors, unless an item is being placed. */
  private get geomDragMode(): GeomDragMode {
    if (!this.studio.doc) return 'none';
    if (this.tool === 'library') return this.placingItem ? 'none' : 'objects';
    if (this.tool !== 'structure') return 'none';
    if (this.studioMode === 'select') return 'all';
    return this.wallDraft ? 'none' : 'items';
  }
```

After `loadStudio` add:

```ts
  private async loadLibraryFor(b: MapBundle) {
    if (b.source !== 'api') return;
    try {
      const lib = await loadLibrary(b.catalogRevision);
      this.library = lib;
      this.libLookup = lookupOf(lib);
    } catch (err) {
      this.error = describeError(err);
    }
  }

  /** The level new items go to: the level filter (Task 11) when one is on, else the document's default level. */
  private placeOpts(doc: GeometryDoc): { levelId: string; ceilingM: number } {
    const levelId = defaultLevelId(doc);
    return { levelId, ceilingM: doc.levels.find((l) => l.id === levelId)?.ceiling_height_m ?? 2.8 };
  }

  private remember(itemId: string) {
    this.libRecent = [itemId, ...this.libRecent.filter((x) => x !== itemId)].slice(0, 12);
    writeList('sw.studio.recent', this.libRecent);
  }

  /** Place the armed item at a plan point; on a phone one placement disarms the item. */
  private placeItem(p: Pt) {
    const doc = this.studio.doc;
    const item = this.placingItem;
    if (!doc || !item) return;
    const r = addObject(doc, item, p, this.placeOpts(doc));
    this.studio.commit(r.doc);
    this.geomSel = { id: r.id, kind: 'object' };
    this.remember(item.id);
    this.offerBinding(r.id);
    if (this.phone.matches) this.placingItem = null;
  }

  /** After a placement or a move: an anchor of a kind the item may represent, within BIND_DISTANCE_M, is offered. */
  private offerBinding(objectId: string) {
    const b = this.bundle;
    const doc = this.studio.doc;
    const lib = this.library;
    this.bindOffer = null;
    if (!b || !doc || !lib) return;
    const o = doc.objects.find((x) => x.id === objectId);
    const item = o ? itemOf(lib, o.item_id) : undefined;
    if (!o || !item || !item.anchor_kinds.length || o.anchor_ref) return;
    const { scale } = effectiveScale(doc);
    let best: { a: Anchor; d: number } | null = null;
    for (const a of this.anchors) {
      const kind = a.resource_type === 'camera' ? 'camera' : (a.entity?.domain ?? '');
      if (!item.anchor_kinds.includes(kind)) continue;
      const d = distanceM(o.position, [a.position.x, a.position.y], b.width, b.height, scale);
      if (d <= BIND_DISTANCE_M && (!best || d < best.d)) best = { a, d };
    }
    if (best) this.bindOffer = { objectId, anchor: best.a };
  }

  /** The object becomes the anchor's body: it takes the anchor's position and rotation now, and follows it from here on. */
  private bindObject(objectId: string, a: Anchor) {
    this.edit((d) => patchObject(d, objectId, { anchor_ref: { resource_type: a.resource_type, resource_id: a.resource_id }, position: [a.position.x, a.position.y], rotation_deg: a.rotation_degrees }));
    this.bindOffer = null;
    this.info = `העצם הוא עכשיו הגוף של ${this.anchorName(a)}`;
    setTimeout(() => (this.info = ''), 3000);
  }

  private get catalogLookup(): CatalogLookup | null {
    return this.libLookup;
  }
```

In `onPlanHover`, replace `    if (this.tool === 'calibrate') this.hover = this.snap(p, null, true);` with `    if (this.tool === 'library') this.hover = p;\n    else if (this.tool === 'calibrate') this.hover = this.snap(p, null, true);`.

In `studioClick`, after `    const p: Pt = [x, y];` add:

```ts
    if (this.tool === 'library') {
      if (this.placingItem) this.placeItem(p);
      return;
    }
```

Replace `onGeomSelect` with:

```ts
  private onGeomSelect(id: string, kind: GeomKind, vertex?: number) {
    if (kind === 'object' && this.tool !== 'library') this.pickTool('library'); // the object inspector lives in the library tool (pickTool clears the selection, so it goes first)
    this.geomSel = vertex === undefined ? { id, kind } : { id, kind, vertex };
    this.selectedId = null;
    this.selectedZoneId = null;
    if (kind !== 'object' && kind !== 'group') this.bindOffer = null;
  }
```

In `dragged(doc, d)`, before `    if (d.kind === 'vertex') {` add:

```ts
    if (d.kind === 'object' || d.kind === 'object-duplicate') {
      const o = doc.objects.find((v) => v.id === d.id);
      if (!o) return null;
      if (o.anchor_ref) return { doc, sel: { id: d.id, kind: 'object' } }; // a body moves with its anchor, never by hand
      if (d.kind === 'object-duplicate') {
        this.dupId ??= newId();
        const r = duplicateObject(doc, d.id, p, this.dupId);
        return { doc: r.doc, sel: { id: r.id, kind: 'object' } };
      }
      return { doc: moveObject(doc, d.id, p), sel: { id: d.id, kind: 'object' } };
    }
    if (d.kind === 'object-rotate') {
      const o = doc.objects.find((v) => v.id === d.id);
      if (!o || o.anchor_ref) return null;
      return { doc: patchObject(doc, d.id, { rotation_deg: rotationTo(o, p, b.width, b.height, d.shift ? 15 : 1) }), sel: { id: d.id, kind: 'object' } };
    }
    if (d.kind === 'object-stretch') {
      const o = doc.objects.find((v) => v.id === d.id);
      if (!o) return null;
      const size = stretchedSize(o, (d.index % 4) as 0 | 1 | 2 | 3, p, b.width, b.height, effectiveScale(doc).scale, d.shift);
      return { doc: patchObject(doc, d.id, { size }), sel: { id: d.id, kind: 'object' } };
    }
    if (d.kind === 'connector-vertex') return null; // Task 12
```

(`newId` joins the studio-ops import now; Task 10 keeps it.) In `onGeomDrag`, after `    this.onGeomSelect(r.sel.id, r.sel.kind, r.sel.vertex);` add `    this.dupId = null;\n    if (r.sel.kind === 'object') this.offerBinding(r.sel.id);` and in the `@geom-drag-cancel` handler (the canvas element) replace `@geom-drag-cancel=${() => (this.geomPreview = null)}` with `@geom-drag-cancel=${() => { this.geomPreview = null; this.dupId = null; }}`.

In `nudgeGeom`, replace `      if (sel.kind === 'label') {` with:

```ts
      if (sel.kind === 'object') {
        const o = doc.objects.find((x) => x.id === sel.id);
        if (!o || o.anchor_ref) return false;
        next = moveObject(doc, o.id, [o.position[0] + dx, o.position[1] + dy]);
      } else if (sel.kind === 'label') {
```

and in the `item` comparison line of `nudgeGeom` replace `sel.kind === 'label' ? d.labels.find((x) => x.id === sel.id) :` with `sel.kind === 'label' ? d.labels.find((x) => x.id === sel.id) : sel.kind === 'object' ? d.objects.find((x) => x.id === sel.id) :`. In `handleStudioKey`, replace `    if (ARROWS.includes(e.key) && this.tool === 'structure' && this.nudgeGeom(e)) return true;` with `    if (ARROWS.includes(e.key) && (this.tool === 'structure' || this.tool === 'library') && this.nudgeGeom(e)) return true;`.

In `handleKey`'s Escape branch, replace `      if (this.wallDraft) {` with `      if (this.placingItem) this.placingItem = null;\n      else if (this.bindOffer) this.bindOffer = null;\n      else if (this.wallDraft) {`.

In `focusGeom`, replace `    const at: Pt | null = w ? … : l ? l.position : null;` (the whole `const at` line) with:

```ts
    const ob = doc.objects.find((x) => x.id === id);
    const at: Pt | null = w ? pointOnWall(w, 0.5, b.width, b.height) : o && host ? pointOnWall(host, o.t, b.width, b.height) : l ? l.position : ob ? ob.position : null;
    if (ob) {
      this.pickTool('library');
      this.geomSel = { id, kind: 'object' };
      if (at) this.canvas?.centerOn(at[0], at[1]);
      return;
    }
```

In `renderStructurePanel`'s actions, replace

```ts
        setMode: (m) => {
          this.studioMode = m;
          this.wallDraft = null;
          this.hover = null;
        },
```

with

```ts
        setMode: (m) => {
          if (m === 'wall' && this.phone.matches) {
            this.info = 'ציור קירות זמין בדסקטופ בלבד; בטלפון אפשר להציב ולהזיז עצמים בודדים';
            setTimeout(() => (this.info = ''), 4000);
            return;
          }
          this.studioMode = m;
          this.wallDraft = null;
          this.hover = null;
        },
```

Add after `renderStructurePanel`:

```ts
  private renderLibraryTool(b: MapBundle) {
    const doc = this.studio.doc;
    const lib = this.library;
    if (!doc || !lib || !b.planVersionId) {
      return html`<sw-card heading="ספריית עצמים"><div class="note">${b.source === 'demo' ? 'נתוני הדגמה: הספרייה נטענת מהשרת.' : this.error || 'טוען את הספרייה…'}</div></sw-card>`;
    }
    const { estimated } = effectiveScale(doc);
    const canManage = b.permissions.structure; // catalog.manage rides with the editor roles (editor, site_admin, system_admin); the server refuses otherwise
    const sel = this.geomSel?.kind === 'object' ? doc.objects.find((o) => o.id === this.geomSel!.id) : undefined;
    const anchorOf = (o: { anchor_ref: { resource_type: string; resource_id: string } | null }) => {
      const a = o.anchor_ref && this.anchors.find((x) => x.resource_type === o.anchor_ref!.resource_type && x.resource_id === o.anchor_ref!.resource_id);
      return a ? this.anchorName(a) : null;
    };
    return html`${sel
      ? renderObjectInspector(
          { o: sel, item: itemOf(lib, sel.item_id), levels: doc.levels, doc, estimated, showEstimates: this.showEstimates, anchorName: anchorOf(sel), phone: this.phone.matches, canManage,
            lib_category: (item) => lib.categories.find((c) => c.id === item.category)?.he ?? item.category },
          {
            patch: (id, patch) => this.edit((d) => patchObject(d, id, patch)),
            unbind: (id) => this.edit((d) => patchObject(d, id, { anchor_ref: null })),
            remove: (id) => {
              this.edit((d) => removeItem(d, id));
              this.geomSel = null;
            },
            array: () => {}, // Task 10
            custom: () => {}, // Task 10
            selectGroup: () => {}, // Task 10
          },
        )
      : nothing}
    ${renderLibraryPanel(
      { lib, q: this.libQ, category: this.libCategory, recent: this.libRecent, favorites: this.libFav, placing: this.placingItem, saveState: this.studio.saveState, phone: this.phone.matches,
        exportHref: '', canManage: false },
      {
        setQuery: (q) => (this.libQ = q),
        setCategory: (id) => (this.libCategory = id),
        pick: (item) => {
          this.placingItem = this.placingItem?.id === item.id ? null : item;
          this.geomSel = null;
          this.bindOffer = null;
        },
        toggleFavorite: (id) => {
          this.libFav = this.libFav.includes(id) ? this.libFav.filter((x) => x !== id) : [...this.libFav, id];
          writeList('sw.studio.fav', this.libFav);
        },
        importFile: () => {}, // Task 10
        cancelPlacing: () => (this.placingItem = null),
      },
    )}`;
  }
```

In `renderToolPanel`, after `    if (this.tool === 'structure') return this.renderStructurePanel(b);` add `    if (this.tool === 'library') return this.renderLibraryTool(b);`.

In `render()`:
- the canvas element: after `.rulers=${this.rulers}` add ` .catalog=${this.catalogLookup} .anchorPositions=${Object.fromEntries(this.anchors.map((a) => [`${a.resource_type}:${a.resource_id}`, { x: a.position.x, y: a.position.y, rotation: a.rotation_degrees }]))}`, and add a drop target for the library's drag: after `@plan-click=${…}` (the last attribute, before `></sw-plan-canvas>`) add ` @dragover=${(e: DragEvent) => { if (e.dataTransfer?.types.includes('text/x-sw-item')) e.preventDefault(); }} @drop=${(e: DragEvent) => this.onItemDrop(e)}`;
- after the `${this.wallDraft ? …}` placing hint add:

```ts
                ${this.placingItem && !this.bindOffer ? html`<div class="placing-hint"><span>לחץ על התוכנית כדי להציב ${this.placingItem.names.he} · Esc לביטול</span></div>` : nothing}
                ${this.bindOffer ? html`<div class="placing-hint bindbar" data-bind-offer><span>העצם ליד ${this.anchorName(this.bindOffer.anchor)} — להפוך אותו לגוף של הישות?
                    <button data-bind-accept @click=${() => this.bindObject(this.bindOffer!.objectId, this.bindOffer!.anchor)}>הצמד לישות</button><button data-bind-dismiss @click=${() => (this.bindOffer = null)}>לא</button></span></div>` : nothing}
```

Add the drop handler after `placeItem`:

```ts
  /** An item dragged from the library panel and dropped on the plan. */
  private onItemDrop(e: DragEvent) {
    const id = e.dataTransfer?.getData('text/x-sw-item');
    const canvas = this.canvas;
    const lib = this.library;
    if (!id || !canvas || !lib) return;
    e.preventDefault();
    const item = itemOf(lib, id);
    if (!item) return;
    const rect = canvas.getBoundingClientRect();
    const p = canvas.toPlan(e.clientX - rect.left, e.clientY - rect.top);
    this.placingItem = item;
    this.placeItem([p.x, p.y]);
    if (!this.phone.matches) this.placingItem = null; // a drop is one placement
  }
```

Styles: before `    @media (max-width: 1023px) {` in the editor's css add:

```css
    .bindbar {
      pointer-events: auto;
    }
    .bindbar button {
      margin-inline-start: 8px;
      border: 1px solid rgba(255, 255, 255, 0.6);
      background: transparent;
      color: #fff;
      border-radius: 999px;
      padding: 2px 10px;
      font: inherit;
      cursor: pointer;
    }
```

- [ ] **Step 6: The live test (append inside the `test.describe.serial` block of `evidence-plan-studio-2.spec.ts`)**

```ts
  test('the library places a chair by click, the handles move, rotate and duplicate it, a lamp dropped on a light anchor is offered as its body', async ({ page }) => {
    const ed = 'explore-plan-editor';
    // an HA light with an anchor at (0.6, 0.6): the body offer needs an anchor of a matching kind
    expect((await api.post('api/v1/ha/dev/states', { data: { states: [{ entity_id: 'light.studio2_lamp', state: 'off', attributes: { friendly_name: 'מנורת אולם' } }] } })).status()).toBe(200);
    const anchor = await (await api.post(`api/v1/floors/${ids.floor}/anchors`, { data: { resource_type: 'ha_entity', resource_id: 'light.studio2_lamp', x: 0.6, y: 0.6, rotation_degrees: 0, field_of_view_degrees: null } })).json();
    expect(anchor.id).toBeTruthy();
    await page.goto(`/?design=a#/explore/floors/${ids.floor}/edit`);
    await expect(page.locator(`${ed} sw-plan-canvas [data-object]`)).toHaveCount(2, { timeout: 20000 });
    await page.locator(`${ed} [data-tool="library"]`).click();
    await expect(page.locator(`${ed} [data-library-panel]`)).toBeVisible();
    await page.locator(`${ed} [data-lib-search]`).fill('כיסא');
    await page.locator(`${ed} [data-lib-item="chair.basic"]`).click();
    await clickPlan(page, ed, 0.3, 0.5);
    await expect(page.locator(`${ed} sw-plan-canvas [data-object]`)).toHaveCount(3);
    await expect(page.locator(`${ed} [data-selected-object]`)).toBeVisible();
    const placedId = (await page.locator(`${ed} [data-selected-object]`).getAttribute('data-selected-object'))!;
    await page.keyboard.press('Escape'); // disarm the item: presses on objects now grab them
    await dragPlan(page, ed, [0.3, 0.5], [0.4, 0.5]);
    await expect.poll(async () => (await draft()).doc.objects.find((o) => o.id === placedId)?.position[0] ?? 0, { timeout: 10000 }).toBeGreaterThan(0.38);
    const knob = (await page.locator(`${ed} sw-plan-canvas [data-object-rotate]`).boundingBox())!;
    await page.mouse.move(knob.x + knob.width / 2, knob.y + knob.height / 2);
    await page.mouse.down();
    await page.mouse.move(knob.x + 80, knob.y + 60, { steps: 6 });
    await page.mouse.up();
    await expect.poll(async () => Math.round(((await draft()).doc.objects.find((o) => o.id === placedId) as unknown as { rotation_deg: number }).rotation_deg), { timeout: 10000 }).toBeGreaterThan(0);
    await dragPlan(page, ed, [0.4, 0.5], [0.4, 0.7], ['Alt']);
    await expect(page.locator(`${ed} sw-plan-canvas [data-object]`)).toHaveCount(4);
    await page.keyboard.press('Delete');
    await expect(page.locator(`${ed} sw-plan-canvas [data-object]`)).toHaveCount(3);
    await page.locator(`${ed} [data-lib-cat="recent"]`).click();
    await expect(page.locator(`${ed} [data-lib-item="chair.basic"]`)).toHaveCount(1);
    // a ceiling lamp dropped on the light's anchor becomes its body
    await page.locator(`${ed} [data-lib-cat="all"]`).click();
    await page.locator(`${ed} [data-lib-search]`).fill('מנורת תקרה');
    await page.locator(`${ed} [data-lib-item="light.ceiling"]`).click();
    await clickPlan(page, ed, 0.6, 0.6);
    await expect(page.locator(`${ed} [data-bind-offer]`)).toBeVisible();
    await page.locator(`${ed} [data-bind-accept]`).click();
    await expect(page.locator(`${ed} [data-object-bound]`)).toBeVisible();
    await expect(page.locator(`${ed} [data-studio-save="saved"]`)).toHaveCount(1, { timeout: 10000 });
    const bound = (await draft()).doc.objects.find((o) => o.item_id === 'light.ceiling' && o.anchor_ref);
    expect(bound).toBeTruthy();
    expect(bound!.position).toEqual([0.6, 0.6]);
    expect((await draft()).doc.objects.find((o) => o.id === placedId)!.item_id).toBe('chair.basic');
  });
```

- [ ] **Step 7: Type-check, build, run**

Run (in `frontend/`):
- `npx tsc --noEmit -p tsconfig.json` → exit 0
- `npx playwright test tests/unit-studio-ops-2.spec.ts tests/unit-geometry-2.spec.ts --project=desktop --reporter=line` → `8 passed`
- `npm run build`, then `SW_LIVE=1 SW_CHROME=1 npx playwright test tests/evidence-plan-studio-2.spec.ts --project=desktop --workers=1 --reporter=line` → `2 passed`
- `SW_LIVE=1 SW_CHROME=1 npx playwright test tests/evidence-plan-studio.spec.ts --project=desktop --workers=1 --reporter=line` → the phase-1 spec passes as before (the structure tool is unchanged).
- `bash "$SP/fixture_chain.sh"` → `129 passed` (the rail gained a tool in demo mode, disabled there).

- [ ] **Step 8: Commit**

```bash
cd /c/cloude/smplwisebms && git add frontend/src/map/studio-ops.ts frontend/src/map/sw-plan-canvas.ts frontend/src/screens/plan-studio-panel.ts frontend/src/screens/explore-plan-editor.ts frontend/tests/unit-studio-ops-2.spec.ts frontend/tests/evidence-plan-studio-2.spec.ts
git add docs/evidence/T007 2>/dev/null
msg=$(mktemp) && cat > "$msg" <<'EOF'
feat(plan-studio): library panel with search, recents and favourites, placing by click or drop, object handles, Alt duplicate, nudges and the body-of-an-anchor offer (T085)

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOF
test "$(bash /c/cloude/smplwisebms/secrets/scan_staged.sh)" = 0 && git commit -F "$msg"
```

---
### Task 10: Editor — the array tool and groups, custom items from an object, export / import of the custom library

**Files:**
- Modify: `frontend/src/map/studio-ops.ts` (`arrayDefaults`, `addArray`, `moveGroup`, `removeGroup`, `ARRAY_MAX`)
- Modify: `frontend/src/map/sw-plan-canvas.ts` (`highlightIds`: every member of a selected group is drawn selected)
- Modify: `frontend/src/screens/plan-studio-panel.ts` (group inspector, array dialog, group delete dialog, custom item dialog)
- Modify: `frontend/src/screens/explore-plan-editor.ts` (dialog state, group moves, Delete on a group asks, custom item creation, import)
- Test: `frontend/tests/unit-studio-ops-2.spec.ts` (two tests appended), `frontend/tests/evidence-plan-studio-2.spec.ts` (third live test)

**Interfaces:**
- Consumes: `addObject`, `duplicateObject`, `patchObject`, `removeItem` (Task 9); `createItem`, `importItems`, `exportUrl`, `loadLibrary`, `itemOf` (Task 7); `GeomGroup` (Task 7).
- Produces:
  - `studio-ops.ts`: `ArrayOpts {rows, cols, spacingX, spacingY, directionDeg}`, `ARRAY_MAX = 400`, `arrayDefaults(item) -> {spacingX: w + 0.05, spacingY: d + 0.45}`, `addArray(doc, originId, opts, W, H, scale) -> {doc, groupId, ids} | null` (the origin is member [0, 0]; columns run along the direction's right, rows along its back; the group is `{kind: "array", params: {rows, cols, spacing_x_m, spacing_y_m, direction_deg, item_id}}`), `moveGroup(doc, groupId, dx, dy)` (bound members stay), `removeGroup(doc, groupId, withMembers)`.
  - Canvas: `highlightIds: string[]`.
  - Panel: `renderGroupInspector`, `renderArrayDialog`, `renderGroupDeleteDialog`, `renderCustomItemDialog` with their view / action types; DOM `[data-selected-group=<id>]`, `[data-group-delete]`, `[data-array-dialog]` with `[data-array-rows] [data-array-cols] [data-array-sx] [data-array-sy] [data-array-dir] [data-array-create] [data-array-cancel]`, `[data-group-delete-dialog]` with `[data-group-delete-all] [data-group-delete-keep] [data-group-delete-cancel]`, `[data-custom-dialog]` with `[data-custom-name] [data-custom-name-en] [data-custom-category] [data-custom-shape] [data-custom-icon] [data-custom-color] [data-custom-w] [data-custom-d] [data-custom-h] [data-custom-create] [data-custom-cancel]`, `[data-lib-export]`, `[data-lib-import]`.
  - Editor: Delete on a selected group opens the delete dialog (never `confirm()`); a member dragged while its group is selected moves the group; "צור פריט מזה" creates a custom item based on the object's item (the built-in one behind a custom item) with the object's size and params, then refreshes the library; the import reads a `smplwise-catalog-1` file.

- [ ] **Step 1: Failing node tests (append inside the `test.describe` block of `unit-studio-ops-2.spec.ts`)**

Add `addArray, arrayDefaults, moveGroup, removeGroup` to the `../src/map/studio-ops` import, then append:

```ts
  test('an array of 6 x 10 chairs is one group; the origin is member [0, 0]; the group moves as one', () => {
    let doc = sample();
    const placed = addObject(doc, item('chair.basic'), [0.1, 0.1], PLACE);
    doc = placed.doc;
    expect(arrayDefaults(item('chair.basic'))).toEqual({ spacingX: 0.5, spacingY: 0.9 });
    const arr = addArray(doc, placed.id, { rows: 6, cols: 10, spacingX: 0.5, spacingY: 0.9, directionDeg: 0 }, 1000, 800, 0.01)!;
    expect(arr).not.toBeNull();
    expect(arr.ids.length).toBe(60);
    expect(arr.ids[0]).toBe(placed.id);
    const g = arr.doc.groups.find((x) => x.id === arr.groupId)!;
    expect(g).toMatchObject({ kind: 'array', member_ids: arr.ids, params: { rows: 6, cols: 10, spacing_x_m: 0.5, spacing_y_m: 0.9, direction_deg: 0, item_id: 'chair.basic' } });
    expect(arr.doc.objects.length).toBe(doc.objects.length + 59);
    const at = (id: string) => arr.doc.objects.find((o) => o.id === id)!;
    expect(at(arr.ids[9]).position).toEqual([0.55, 0.1]); // column 9: 9 x 0.5 m = 450 px of 1000
    expect(at(arr.ids[50]).position).toEqual([0.1, 0.6625]); // row 5: 5 x 0.9 m = 450 px of 800
    expect(at(arr.ids[59]).group_id).toBe(arr.groupId);
    expect(at(placed.id).group_id).toBe(arr.groupId);
    const turned = addArray(doc, placed.id, { rows: 1, cols: 2, spacingX: 1, spacingY: 1, directionDeg: 90 }, 1000, 800, 0.01)!;
    expect(turned.doc.objects.find((o) => o.id === turned.ids[1])!.position).toEqual([0.1, 0.225]); // the right of a 90 degree turn points down: 100 px of 800
    expect(addArray(doc, 'nope', { rows: 2, cols: 2, spacingX: 1, spacingY: 1, directionDeg: 0 }, 1000, 800, 0.01)).toBeNull();
    expect(addArray(doc, placed.id, { rows: 30, cols: 30, spacingX: 1, spacingY: 1, directionDeg: 0 }, 1000, 800, 0.01)).toBeNull(); // 900 > ARRAY_MAX
    expect(addArray(arr.doc, placed.id, { rows: 2, cols: 2, spacingX: 1, spacingY: 1, directionDeg: 0 }, 1000, 800, 0.01)).toBeNull(); // already in a group
    const moved = moveGroup(arr.doc, arr.groupId, 0.1, 0);
    expect(moved.objects.find((o) => o.id === arr.ids[9])!.position).toEqual([0.65, 0.1]);
    expect(moved.objects.find((o) => o.id === 'o1')!.position).toEqual([0.2, 0.2]); // not a member
  });

  test('deleting a group keeps or takes its members', () => {
    let doc = sample();
    const placed = addObject(doc, item('chair.basic'), [0.1, 0.1], PLACE);
    const arr = addArray(placed.doc, placed.id, { rows: 2, cols: 3, spacingX: 0.5, spacingY: 0.9, directionDeg: 0 }, 1000, 800, 0.01)!;
    doc = arr.doc;
    const kept = removeGroup(doc, arr.groupId, false);
    expect(kept.groups.some((g) => g.id === arr.groupId)).toBe(false);
    expect(kept.objects.filter((o) => arr.ids.includes(o.id)).every((o) => o.group_id === null)).toBe(true);
    expect(kept.objects.length).toBe(doc.objects.length);
    const gone = removeGroup(doc, arr.groupId, true);
    expect(gone.objects.some((o) => arr.ids.includes(o.id))).toBe(false);
    expect(gone.objects.length).toBe(doc.objects.length - 6);
  });
```

Run: `npx playwright test tests/unit-studio-ops-2.spec.ts --project=desktop --reporter=line` → FAIL (`addArray` is not exported).

- [ ] **Step 2: Array and group operations (append to `frontend/src/map/studio-ops.ts`)**

Add `type GeomGroup` to the `./geometry` import list. Append:

```ts
// ---------------------------------------------------------------- arrays and groups (T085)

export interface ArrayOpts {
  rows: number;
  cols: number;
  spacingX: number;
  spacingY: number;
  directionDeg: number;
}
/** Members an array may have at once (six rows of twelve chairs is 72). */
export const ARRAY_MAX = 400;
const OBJECTS_MAX = 5000;

/** Column pitch = the item's width + 5 cm, row pitch = its depth + 45 cm (a walkable gap behind a chair). */
export function arrayDefaults(item: Pick<CatalogItem, 'size'>): { spacingX: number; spacingY: number } {
  return { spacingX: round3(item.size.w_m + 0.05), spacingY: round3(item.size.d_m + 0.45) };
}

/** Rows x columns of copies of an object, in one group. Columns run along the direction's right, rows along its back
 * (direction 0 = up: columns go right on screen, rows go down). The origin stays member [0, 0] and keeps its id; every
 * copy gets a new one. Null when the origin is missing or already grouped, the array is smaller than 2 or larger than
 * ARRAY_MAX, or the document would pass its object limit. */
export function addArray(doc: GeometryDoc, originId: string, opts: ArrayOpts, W: number, H: number, scale: number): { doc: GeometryDoc; groupId: string; ids: string[] } | null {
  const origin = doc.objects.find((o) => o.id === originId);
  const rows = Math.floor(opts.rows);
  const cols = Math.floor(opts.cols);
  const total = rows * cols;
  if (!origin || origin.group_id || rows < 1 || cols < 1 || total < 2 || total > ARRAY_MAX || doc.objects.length + total - 1 > OBJECTS_MAX) return null;
  const theta = ((opts.directionDeg || 0) * Math.PI) / 180;
  const right: Pt = [Math.cos(theta), Math.sin(theta)];
  const back: Pt = [-Math.sin(theta), Math.cos(theta)];
  const px = 1 / scale;
  const groupId = newId();
  const ids: string[] = [];
  const added: GeomObject[] = [];
  const x0 = origin.position[0] * W;
  const y0 = origin.position[1] * H;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = x0 + c * opts.spacingX * px * right[0] + r * opts.spacingY * px * back[0];
      const y = y0 + c * opts.spacingX * px * right[1] + r * opts.spacingY * px * back[1];
      if (r === 0 && c === 0) {
        ids.push(origin.id);
        continue;
      }
      const copy: GeomObject = { ...origin, id: newId(), position: clampPt([x / W, y / H]), params: JSON.parse(JSON.stringify(origin.params)) as Record<string, unknown>, size: { ...origin.size },
        anchor_ref: null, group_id: groupId, external_ids: {} };
      ids.push(copy.id);
      added.push(copy);
    }
  }
  const group: GeomGroup = { id: groupId, kind: 'array', member_ids: ids, params: { rows, cols, spacing_x_m: opts.spacingX, spacing_y_m: opts.spacingY, direction_deg: opts.directionDeg, item_id: origin.item_id }, label: null };
  return { doc: { ...doc, objects: [...doc.objects.map((o) => (o.id === origin.id ? { ...o, group_id: groupId } : o)), ...added], groups: [...doc.groups, group] }, groupId, ids };
}

/** Every member of the group moves by (dx, dy) in normalized plan space; a member that is the body of an anchor stays. */
export function moveGroup(doc: GeometryDoc, groupId: string, dx: number, dy: number): GeometryDoc {
  const g = doc.groups.find((x) => x.id === groupId);
  if (!g) return doc;
  const members = new Set(g.member_ids);
  return { ...doc, objects: doc.objects.map((o) => (members.has(o.id) && !o.anchor_ref ? { ...o, position: clampPt([o.position[0] + dx, o.position[1] + dy]) } : o)) };
}

/** The group goes; its members go with it (`withMembers`) or stay in place, unlinked. */
export function removeGroup(doc: GeometryDoc, groupId: string, withMembers: boolean): GeometryDoc {
  const g = doc.groups.find((x) => x.id === groupId);
  if (!g) return doc;
  let out = doc;
  if (withMembers) for (const id of g.member_ids) out = removeItem(out, id);
  return removeItem(out, groupId);
}
```

Run the node spec → `5 passed`.

- [ ] **Step 3: The canvas highlights a selected group's members (`sw-plan-canvas.ts`)**

After `  @property() selectedGeomId: string | null = null;` add `  /** Items drawn selected besides selectedGeomId (the members of a selected group). */\n  @property({ attribute: false }) highlightIds: string[] = [];`. In `renderStructure`, replace `    const issues = new Set(this.issueIds);` with `    const issues = new Set(this.issueIds);\n    const marked = new Set(this.highlightIds);` and pass it: replace `this.renderPrimitive(p, inv, issues)` with `this.renderPrimitive(p, inv, issues, marked)`; change the signature to `private renderPrimitive(p: Primitive, inv: number, issues: Set<string>, marked: Set<string> = new Set())` and its first line to `    const cls = \`${p.id === this.selectedGeomId || marked.has(p.id) ? 'sel' : ''} ${issues.has(p.id) ? 'issue' : ''}\`;`.

- [ ] **Step 4: Panel — group inspector and the three dialogs (`plan-studio-panel.ts`)**

Add `type GeomGroup, type GeomSize, type ObjectShape, SYMBOL_IDS, COLOR_TOKENS, OBJECT_SHAPES` to the `../map/geometry` import (value imports for the three constants). Append before `export const studioPanelStyles`:

```ts
export interface GroupActions {
  select(objectId: string): void;
  askDelete(groupId: string): void;
}

export function renderGroupInspector(g: GeomGroup, item: CatalogItem | undefined, a: GroupActions): TemplateResult {
  const p = g.params as { rows?: number; cols?: number; spacing_x_m?: number; spacing_y_m?: number };
  return html`<sw-card heading=${g.kind === 'array' ? `מערך של ${g.member_ids.length}` : `קבוצה של ${g.member_ids.length}`} subheading=${item ? item.names.he : ''} data-selected-group=${g.id}>
    ${g.kind === 'array' && p.rows ? html`<div class="note">${p.rows} שורות × ${p.cols} עמודות · רווח ${p.spacing_x_m} × ${p.spacing_y_m} מ׳</div>` : nothing}
    <div class="note">גרירת אחד העצמים מזיזה את כל המערך · Delete מוחק (ושואל אם למחוק גם את העצמים)</div>
    <div class="btns">
      ${g.member_ids[0] ? html`<sw-button size="sm" variant="ghost" data-group-first @click=${() => a.select(g.member_ids[0])}>בחר עצם אחד</sw-button>` : nothing}
      <sw-button size="sm" variant="danger" icon="trash" data-group-delete @click=${() => a.askDelete(g.id)}>מחק מערך</sw-button>
    </div>
  </sw-card>`;
}

export interface ArrayDialogView {
  item: CatalogItem | undefined;
  rows: number;
  cols: number;
  spacingX: number;
  spacingY: number;
  directionDeg: number;
  max: number;
}

export function renderArrayDialog(v: ArrayDialogView, onChange: (patch: Partial<ArrayDialogView>) => void, onCreate: () => void, onCancel: () => void): TemplateResult {
  const total = Math.floor(v.rows) * Math.floor(v.cols);
  const ok = total >= 2 && total <= v.max && v.spacingX > 0 && v.spacingY > 0;
  const num = (e: Event) => parseFloat((e.target as HTMLInputElement).value);
  return html`<sw-dialog open heading="מערך" subheading=${`שורות × עמודות של ${v.item?.names.he ?? 'העצם'}; העצם שנבחר הוא הראשון`} data-array-dialog @close=${onCancel}>
    <div class="two">
      <sw-field label="שורות"><input type="number" min="1" max="60" step="1" data-ltr data-array-rows .value=${String(v.rows)} @input=${(e: Event) => onChange({ rows: num(e) || 1 })} /></sw-field>
      <sw-field label="עמודות"><input type="number" min="1" max="60" step="1" data-ltr data-array-cols .value=${String(v.cols)} @input=${(e: Event) => onChange({ cols: num(e) || 1 })} /></sw-field>
    </div>
    <div class="two">
      <sw-field label="רווח בין עמודות (מ׳)"><input type="number" min="0.05" max="50" step="0.05" data-ltr data-array-sx .value=${String(v.spacingX)} @input=${(e: Event) => onChange({ spacingX: num(e) })} /></sw-field>
      <sw-field label="רווח בין שורות (מ׳)"><input type="number" min="0.05" max="50" step="0.05" data-ltr data-array-sy .value=${String(v.spacingY)} @input=${(e: Event) => onChange({ spacingY: num(e) })} /></sw-field>
    </div>
    <sw-field label="כיוון (°)" hint="0 = העמודות ימינה והשורות למטה; 90 = מסובב"><input type="number" min="0" max="359" step="1" data-ltr data-array-dir .value=${String(v.directionDeg)} @input=${(e: Event) => onChange({ directionDeg: num(e) || 0 })} /></sw-field>
    <div class="note" data-array-total>${total} עצמים${total > v.max ? ` · יותר מ־${v.max} במערך אחד` : ''}</div>
    <sw-button slot="footer" variant="ghost" data-array-cancel @click=${onCancel}>ביטול</sw-button>
    <sw-button slot="footer" variant="primary" icon="check" data-array-create ?disabled=${!ok} @click=${onCreate}>צור מערך</sw-button>
  </sw-dialog>`;
}

export function renderGroupDeleteDialog(count: number, onAll: () => void, onKeep: () => void, onCancel: () => void): TemplateResult {
  return html`<sw-dialog open heading="מחיקת מערך" subheading=${`המערך מכיל ${count} עצמים`} data-group-delete-dialog @close=${onCancel}>
    <div class="note">למחוק גם את העצמים, או להשאיר אותם על המפה כעצמים בודדים?</div>
    <sw-button slot="footer" variant="ghost" data-group-delete-cancel @click=${onCancel}>ביטול</sw-button>
    <sw-button slot="footer" data-group-delete-keep @click=${onKeep}>השאר את העצמים</sw-button>
    <sw-button slot="footer" variant="danger" icon="trash" data-group-delete-all @click=${onAll}>מחק הכול</sw-button>
  </sw-dialog>`;
}

export interface CustomItemView {
  nameHe: string;
  nameEn: string;
  category: string;
  shape: ObjectShape;
  icon: string;
  color: string;
  size: GeomSize;
  basedOn: string | null;
  busy: boolean;
  error: string;
}

export function renderCustomItemDialog(v: CustomItemView, lib: CatalogLibrary, onChange: (patch: Partial<CustomItemView>) => void, onCreate: () => void, onCancel: () => void): TemplateResult {
  const num = (e: Event) => parseFloat((e.target as HTMLInputElement).value);
  const sizeField = (key: keyof GeomSize, label: string, attr: string) => html`<sw-field label=${label}><input type="number" min="0.05" max="100" step="0.05" data-ltr ${attr} .value=${String(v.size[key])}
      @input=${(e: Event) => { const x = num(e); if (x >= 0.05 && x <= 100) onChange({ size: { ...v.size, [key]: x } }); }} /></sw-field>`;
  return html`<sw-dialog open heading="פריט מותאם" subheading=${v.basedOn ? `מבוסס על ${lib.items.find((i) => i.id === v.basedOn)?.names.he ?? v.basedOn}: הפריט החדש נשמר בספרייה של המתקן` : 'פריט חדש בספרייה של המתקן'} data-custom-dialog @close=${onCancel}>
    ${v.error ? html`<div class="err">${v.error}</div>` : nothing}
    <div class="two">
      <sw-field label="שם (עברית)"><input type="text" maxlength="80" data-custom-name .value=${v.nameHe} @input=${(e: Event) => onChange({ nameHe: (e.target as HTMLInputElement).value })} /></sw-field>
      <sw-field label="שם (אנגלית, לחיפוש)"><input type="text" maxlength="80" data-ltr data-custom-name-en .value=${v.nameEn} @input=${(e: Event) => onChange({ nameEn: (e.target as HTMLInputElement).value })} /></sw-field>
    </div>
    <div class="two">
      <sw-field label="קטגוריה"><select data-custom-category @change=${(e: Event) => onChange({ category: (e.target as HTMLSelectElement).value })}>${lib.categories.map((c) => html`<option value=${c.id} ?selected=${c.id === v.category}>${c.he}</option>`)}</select></sw-field>
      <sw-field label="צורה"><select data-custom-shape @change=${(e: Event) => onChange({ shape: (e.target as HTMLSelectElement).value as ObjectShape })}>${OBJECT_SHAPES.map((s) => html`<option value=${s} ?selected=${s === v.shape}>${s}</option>`)}</select></sw-field>
    </div>
    <div class="two">
      <sw-field label="סמל"><select data-custom-icon @change=${(e: Event) => onChange({ icon: (e.target as HTMLSelectElement).value })}>${SYMBOL_IDS.map((s) => html`<option value=${s} ?selected=${s === v.icon}>${s}</option>`)}</select></sw-field>
      <sw-field label="צבע"><select data-custom-color @change=${(e: Event) => onChange({ color: (e.target as HTMLSelectElement).value })}>${COLOR_TOKENS.map((c) => html`<option value=${c} ?selected=${c === v.color}>${c}</option>`)}</select></sw-field>
    </div>
    <div class="three">${sizeField('w_m', 'רוחב (מ׳)', 'data-custom-w')}${sizeField('d_m', 'עומק (מ׳)', 'data-custom-d')}${sizeField('h_m', 'גובה (מ׳)', 'data-custom-h')}</div>
    <div class="note">הגובה מהרצפה, הפרמטרים וסוגי הישויות נלקחים מהפריט שעליו הוא מבוסס.</div>
    <sw-button slot="footer" variant="ghost" data-custom-cancel @click=${onCancel}>ביטול</sw-button>
    <sw-button slot="footer" variant="primary" icon="check" data-custom-create ?disabled=${v.busy || !v.nameHe.trim()} @click=${onCreate}>${v.busy ? 'שומר…' : 'צור פריט'}</sw-button>
  </sw-dialog>`;
}
```

- [ ] **Step 5: The editor (`explore-plan-editor.ts`)**

Imports: replace the `../api/plan-catalog` import with `import { createItem, exportUrl as catalogExportUrl, importItems, itemOf, loadLibrary, lookupOf, type CatalogItem, type CatalogLibrary } from '../api/plan-catalog';`; add `addArray, arrayDefaults, moveGroup, removeGroup, ARRAY_MAX` to the `../map/studio-ops` import; add `renderArrayDialog, renderCustomItemDialog, renderGroupDeleteDialog, renderGroupInspector, type ArrayDialogView, type CustomItemView` to the `./plan-studio-panel` import.

State: after `  private readonly phone = window.matchMedia('(max-width: 767px)');` add:

```ts
  @state() private arrayDialog: (ArrayDialogView & { objectId: string }) | null = null;
  /** The group whose delete waits for the choice (members too, or not). */
  @state() private groupDelete: string | null = null;
  @state() private customDialog: (CustomItemView & { objectId: string; params: Record<string, unknown>; z: number }) | null = null;
```

In `dragged()`, in the `object` branch, replace `      return { doc: moveObject(doc, d.id, p), sel: { id: d.id, kind: 'object' } };` with:

```ts
      if (this.geomSel?.kind === 'group' && o.group_id === this.geomSel.id) {
        return { doc: moveGroup(doc, o.group_id, p[0] - o.position[0], p[1] - o.position[1]), sel: { id: o.group_id, kind: 'group' } }; // the whole array follows the dragged member
      }
      return { doc: moveObject(doc, d.id, p), sel: { id: d.id, kind: 'object' } };
```

In `handleStudioKey`, replace

```ts
    if ((e.key === 'Delete' || e.key === 'Backspace') && this.geomSel) {
      e.preventDefault();
      const id = this.geomSel.id;
```

with

```ts
    if ((e.key === 'Delete' || e.key === 'Backspace') && this.geomSel) {
      e.preventDefault();
      const id = this.geomSel.id;
      if (this.geomSel.kind === 'group') {
        this.groupDelete = id; // never confirm(): the dialog asks whether the members go too
        return true;
      }
```

In `handleKey`'s Escape branch, before `      if (this.placingItem) this.placingItem = null;` add `      if (this.arrayDialog || this.groupDelete || this.customDialog) { this.arrayDialog = null; this.groupDelete = null; this.customDialog = null; return; }`.

Add after `bindObject`:

```ts
  // ---- arrays, groups, custom items (T085) ----

  private openArray(objectId: string) {
    const doc = this.studio.doc;
    const lib = this.library;
    const o = doc?.objects.find((x) => x.id === objectId);
    const item = o && lib ? itemOf(lib, o.item_id) : undefined;
    if (!doc || !o) return;
    if (this.phone.matches) {
      this.info = 'מערכים זמינים בדסקטופ בלבד';
      setTimeout(() => (this.info = ''), 3000);
      return;
    }
    const d = item ? arrayDefaults(item) : { spacingX: round(o.size.w_m + 0.05), spacingY: round(o.size.d_m + 0.45) };
    this.arrayDialog = { objectId, item, rows: 2, cols: 4, spacingX: d.spacingX, spacingY: d.spacingY, directionDeg: o.rotation_deg, max: ARRAY_MAX };
  }

  private createArray() {
    const b = this.bundle;
    const doc = this.studio.doc;
    const a = this.arrayDialog;
    if (!b || !doc || !a) return;
    const r = addArray(doc, a.objectId, a, b.width, b.height, effectiveScale(doc).scale);
    if (!r) {
      this.error = 'לא ניתן ליצור את המערך (העצם כבר במערך, או שיש יותר מדי עצמים)';
      return;
    }
    this.arrayDialog = null;
    this.studio.commit(r.doc);
    this.geomSel = { id: r.groupId, kind: 'group' };
    this.info = `${r.ids.length} עצמים במערך אחד`;
    setTimeout(() => (this.info = ''), 4000);
  }

  private deleteGroup(withMembers: boolean) {
    const gid = this.groupDelete;
    this.groupDelete = null;
    if (!gid) return;
    this.edit((d) => removeGroup(d, gid, withMembers));
    this.geomSel = null;
  }

  private openCustom(objectId: string) {
    const doc = this.studio.doc;
    const lib = this.library;
    const o = doc?.objects.find((x) => x.id === objectId);
    if (!doc || !lib || !o) return;
    const item = itemOf(lib, o.item_id);
    this.customDialog = {
      objectId, nameHe: item ? `${item.names.he} (מותאם)` : '', nameEn: item?.names.en ?? '', category: item?.category ?? 'storage', shape: item?.shape ?? 'box', icon: item?.icon ?? 'box',
      color: item?.color_token ?? 'object', size: { ...o.size }, basedOn: item ? (item.custom ? item.based_on : item.id) : null, busy: false, error: '',
      params: JSON.parse(JSON.stringify(o.params)) as Record<string, unknown>, z: item && item.z_ref === 'ceiling' ? item.z_m : o.z_m,
    };
  }

  private async createCustom() {
    const c = this.customDialog;
    const b = this.bundle;
    if (!c || !b) return;
    this.customDialog = { ...c, busy: true, error: '' };
    try {
      const item = await createItem({ based_on: c.basedOn, names: { he: c.nameHe.trim(), en: c.nameEn.trim() }, category: c.category, shape: c.shape, icon: c.icon, color_token: c.color, size: c.size, z_m: c.z, params: c.params });
      this.customDialog = null;
      await this.loadLibraryFor(b);
      this.remember(item.id);
      this.libCategory = 'recent';
      this.libQ = '';
      this.info = `הפריט "${item.names.he}" נוסף לספרייה`;
      setTimeout(() => (this.info = ''), 4000);
    } catch (err) {
      this.customDialog = { ...c, busy: false, error: describeError(err) };
    }
  }

  private async importLibrary(file: File) {
    const b = this.bundle;
    if (!b) return;
    try {
      const parsed = JSON.parse(await file.text()) as { format?: string; items?: unknown[] };
      if (parsed.format !== 'smplwise-catalog-1' || !Array.isArray(parsed.items)) throw new Error('הקובץ אינו ייצוא של ספרייה מותאמת (smplwise-catalog-1)');
      const r = await importItems(parsed.items);
      await this.loadLibraryFor(b);
      this.info = `יובאו ${r.imported} פריטים, ${r.replaced} הוחלפו`;
      setTimeout(() => (this.info = ''), 4000);
    } catch (err) {
      this.error = err instanceof Error && !(err instanceof ApiError) ? err.message : describeError(err);
    }
  }
```

and after the `const writeList = …` line add `const round = (v: number): number => Math.round(v * 1000) / 1000;`.

In `renderLibraryTool`: replace the three placeholder actions `array: () => {}, // Task 10`, `custom: () => {}, // Task 10`, `selectGroup: () => {}, // Task 10` with `array: (id) => this.openArray(id),`, `custom: (id) => this.openCustom(id),`, `selectGroup: (gid) => (this.geomSel = { id: gid, kind: 'group' }),`; replace `exportHref: '', canManage: false },` with `exportHref: catalogExportUrl(), canManage },`; replace `importFile: () => {}, // Task 10` with `importFile: (f) => void this.importLibrary(f),`; and replace `    return html\`${sel` with:

```ts
    const group = this.geomSel?.kind === 'group' ? doc.groups.find((g) => g.id === this.geomSel!.id) : undefined;
    return html`${group ? renderGroupInspector(group, itemOf(lib, String((group.params as { item_id?: string }).item_id ?? '')), { select: (oid) => (this.geomSel = { id: oid, kind: 'object' }), askDelete: (gid) => (this.groupDelete = gid) }) : nothing}${sel
```

In `render()`, on the canvas element after `.selectedGeomId=${this.geomSel?.id ?? null}` add ` .highlightIds=${this.geomSel?.kind === 'group' ? (this.studio.doc?.groups.find((g) => g.id === this.geomSel!.id)?.member_ids ?? []) : []}`; and after `        ${this.renderGeomDiffDialog()}` add:

```ts
        ${this.arrayDialog ? renderArrayDialog(this.arrayDialog, (patch) => (this.arrayDialog = { ...this.arrayDialog!, ...patch }), () => this.createArray(), () => (this.arrayDialog = null)) : nothing}
        ${this.groupDelete ? renderGroupDeleteDialog(this.studio.doc?.groups.find((g) => g.id === this.groupDelete)?.member_ids.length ?? 0, () => this.deleteGroup(true), () => this.deleteGroup(false), () => (this.groupDelete = null)) : nothing}
        ${this.customDialog && this.library ? renderCustomItemDialog(this.customDialog, this.library, (patch) => (this.customDialog = { ...this.customDialog!, ...patch }), () => void this.createCustom(), () => (this.customDialog = null)) : nothing}
```

- [ ] **Step 6: The live test (append inside the `test.describe.serial` block)**

Add to the `ids` record at the top of the spec a list of created custom items and their cleanup: replace `const ids = { … asset: '' };` with `const ids = { site: '', building: '', floor: '', floor2: '', version: '', version2: '', asset: '' };\nconst customIds: string[] = [];` and in `afterAll`, before the floor deletes, add `      for (const id of customIds) expect((await api.delete(\`api/v1/catalog/objects/${id}\`)).status(), 'custom item removed').toBe(204);`. Then append the test:

```ts
  test('sixty chairs in one array, moved as one; deleting the array asks; a custom item is made from an object and exported', async ({ page }) => {
    const ed = 'explore-plan-editor';
    await page.goto(`/?design=a#/explore/floors/${ids.floor}/edit`);
    await page.locator(`${ed} [data-tool="library"]`).click();
    await page.locator(`${ed} [data-lib-search]`).fill('כיסא');
    await page.locator(`${ed} [data-lib-item="chair.basic"]`).click();
    const before = await page.locator(`${ed} sw-plan-canvas [data-object]`).count();
    await clickPlan(page, ed, 0.15, 0.15);
    await page.keyboard.press('Escape');
    await expect(page.locator(`${ed} [data-selected-object]`)).toBeVisible();
    const originId = (await page.locator(`${ed} [data-selected-object]`).getAttribute('data-selected-object'))!;
    await page.locator(`${ed} [data-object-array]`).click();
    await expect(page.locator(`${ed} [data-array-dialog]`)).toBeVisible();
    await page.locator(`${ed} [data-array-rows]`).fill('6');
    await page.locator(`${ed} [data-array-cols]`).fill('10');
    await expect(page.locator(`${ed} [data-array-sx]`)).toHaveValue('0.5');
    await expect(page.locator(`${ed} [data-array-sy]`)).toHaveValue('0.9');
    await expect(page.locator(`${ed} [data-array-total]`)).toContainText('60');
    await page.locator(`${ed} [data-array-create]`).click();
    await expect(page.locator(`${ed} sw-plan-canvas [data-object]`)).toHaveCount(before + 60);
    await expect(page.locator(`${ed} [data-selected-group]`)).toContainText('60');
    await expect.poll(async () => (await draft()).doc.groups.find((g) => g.member_ids.includes(originId))?.member_ids.length ?? 0, { timeout: 10000 }).toBe(60);
    const group = (await draft()).doc.groups.find((g) => g.member_ids.includes(originId))!;
    const tenth = (await draft()).doc.objects.find((o) => o.id === group.member_ids[9])!;
    expect(tenth.position[0]).toBeCloseTo(0.6, 2); // column 9 x 0.5 m at 100 px/m from x = 0.15
    // the group stays selected: dragging the origin moves the whole array
    await dragPlan(page, ed, [0.15, 0.15], [0.2, 0.15]);
    await expect.poll(async () => (await draft()).doc.objects.find((o) => o.id === group.member_ids[9])!.position[0], { timeout: 10000 }).toBeGreaterThan(0.63);
    // Delete asks; keeping the members leaves 60 objects without a group
    await page.keyboard.press('Delete');
    await expect(page.locator(`${ed} [data-group-delete-dialog]`)).toBeVisible();
    await page.locator(`${ed} [data-group-delete-keep]`).click();
    await expect(page.locator(`${ed} sw-plan-canvas [data-object]`)).toHaveCount(before + 60);
    await expect.poll(async () => (await draft()).doc.groups.length, { timeout: 10000 }).toBe(0);
    // a custom item from the origin chair
    await clickPlan(page, ed, 0.2, 0.15);
    await expect(page.locator(`${ed} [data-selected-object="${originId}"]`)).toBeVisible();
    await page.locator(`${ed} [data-object-custom]`).click();
    await expect(page.locator(`${ed} [data-custom-dialog]`)).toBeVisible();
    await page.locator(`${ed} [data-custom-name]`).fill('כיסא אולם');
    await page.locator(`${ed} [data-custom-create]`).click();
    await expect(page.locator(`${ed} [data-custom-dialog]`)).toHaveCount(0);
    await page.locator(`${ed} [data-lib-cat="all"]`).click();
    await page.locator(`${ed} [data-lib-search]`).fill('כיסא אולם');
    await expect(page.locator(`${ed} [data-lib-item]`)).toHaveCount(1);
    const exported = await (await api.get('api/v1/catalog/export')).json();
    const mine = exported.items.find((i: { names: { he: string } }) => i.names.he === 'כיסא אולם');
    expect(mine).toBeTruthy();
    expect(mine.based_on).toBe('chair.basic');
    customIds.push(mine.id);
  });
```

- [ ] **Step 7: Type-check, build, run**

Run (in `frontend/`): `npx tsc --noEmit -p tsconfig.json` → exit 0; `npx playwright test tests/unit-studio-ops-2.spec.ts --project=desktop --reporter=line` → `5 passed`; `npm run build`, then `SW_LIVE=1 SW_CHROME=1 npx playwright test tests/evidence-plan-studio-2.spec.ts --project=desktop --workers=1 --reporter=line` → `3 passed`.

- [ ] **Step 8: Commit**

```bash
cd /c/cloude/smplwisebms && git add frontend/src/map/studio-ops.ts frontend/src/map/sw-plan-canvas.ts frontend/src/screens/plan-studio-panel.ts frontend/src/screens/explore-plan-editor.ts frontend/tests/unit-studio-ops-2.spec.ts frontend/tests/evidence-plan-studio-2.spec.ts
msg=$(mktemp) && cat > "$msg" <<'EOF'
feat(plan-studio): array tool and groups with an in-page delete dialog, custom items from an object, export and import of the custom library (T085)

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOF
test "$(bash /c/cloude/smplwisebms/secrets/scan_staged.sh)" = 0 && git commit -F "$msg"
```

---
### Task 11: Levels — chips over the canvas, the add-level dialog, per-item levels, zones and anchors, the live map filter

**Files:**
- Modify: `frontend/src/map/studio-ops.ts` (`addLevel`, `patchLevel`, `removeLevel`, `levelUsage`)
- Modify: `frontend/src/screens/plan-studio-panel.ts` (`renderLevelChips`, `renderLevelDialog`, level selects in the wall and label inspectors)
- Modify: `frontend/src/screens/explore-plan-editor.ts` (level filter, dialog, per-item level, zone and anchor level selects)
- Modify: `frontend/src/screens/explore-floor-map.ts` (level chips on the live map)
- Test: `frontend/tests/unit-studio-ops-2.spec.ts` (one test appended), `frontend/tests/evidence-plan-studio-2.spec.ts` (fourth live test)

**Interfaces:**
- Consumes: `GeomLevel`, `defaultLevelId`, `patchWall`, `patchLabel`, `patchObject` (phase 1 / Task 9); `updateZone` / `updateAnchor` bodies with `level_id` (Task 7); bundle `levels` (Task 6 / 7); the canvas `structureLevel` (phase 1: filters walls and labels; Task 7 made `buildPrimitives` filter objects too).
- Produces:
  - `studio-ops.ts`: `addLevel(doc, name, elevationM, ceilingM) -> {doc, id}` (id `L<n>`, the smallest free n), `patchLevel(doc, id, patch)` (one default at a time), `levelUsage(doc, id) -> number`, `removeLevel(doc, id) -> GeometryDoc | null` (null for the default level or a used one).
  - Panel: `renderLevelChips(levels, current, onPick, onAdd?)` → `[data-level-chips]` with `[data-level-chip="all"|<id>]` and `[data-level-add]`; `renderLevelDialog(v, onChange, onCreate, onCancel)` → `[data-level-dialog]` with `[data-level-name] [data-level-elevation] [data-level-ceiling] [data-level-create] [data-level-cancel]`; `StudioView.levels`, `StudioActions.setLevel(id, levelId)`; `[data-item-level]` in the wall and label inspectors.
  - Editor: `levelFilter` (null = all) filters walls, labels, objects (canvas `structureLevel`) and pins (`Anchor.level_id ?? default`); new walls, labels and objects take the filtered level; zone inspector `[data-zone-level]`, camera / entity inspectors `[data-anchor-level]` (saved with the anchor: `level_id`).
  - Live map: `[data-level-chips]` when the bundle has more than one level; the same filter on the structure and the pins.

- [ ] **Step 1: Failing node test (append to `unit-studio-ops-2.spec.ts`)**

Add `addLevel, levelUsage, patchLevel, removeLevel` to the studio-ops import and append inside the describe block:

```ts
  test('levels: added with the next free id, one default at a time, removed only when unused', () => {
    const doc = sample();
    const added = addLevel(doc, 'גלריה', 3.5, 3.0);
    expect(added.id).toBe('L2');
    expect(added.doc.levels.find((l) => l.id === 'L2')).toEqual({ id: 'L2', name: 'גלריה', elevation_m: 3.5, ceiling_height_m: 3.0, is_default: false, external_ids: {} });
    const asDefault = patchLevel(added.doc, 'L2', { is_default: true });
    expect(asDefault.levels.map((l) => l.is_default)).toEqual([false, false, true]);
    expect(levelUsage(doc, 'L1')).toBe(5); // wall wd, label lb, object o5, connectors c1 and cx-o4 (both end there)
    expect(removeLevel(doc, 'L0')).toBeNull(); // the default
    expect(removeLevel(doc, 'L1')).toBeNull(); // used
    expect(removeLevel(added.doc, 'L2')!.levels.length).toBe(2);
  });
```

Run: `npx playwright test tests/unit-studio-ops-2.spec.ts --project=desktop --reporter=line` → FAIL (`addLevel` is not exported).

- [ ] **Step 2: Level operations (append to `studio-ops.ts`; add `type GeomLevel` to the geometry import)**

```ts
// ---------------------------------------------------------------- levels (T085)

export function addLevel(doc: GeometryDoc, name: string, elevationM: number, ceilingM: number): { doc: GeometryDoc; id: string } {
  let n = 0;
  while (doc.levels.some((l) => l.id === `L${n}`)) n++;
  const level: GeomLevel = { id: `L${n}`, name: name.trim(), elevation_m: round3(elevationM), ceiling_height_m: round3(ceilingM), is_default: doc.levels.length === 0, external_ids: {} };
  return { doc: { ...doc, levels: [...doc.levels, level] }, id: level.id };
}

/** Exactly one level is the default: making one the default clears the others. */
export function patchLevel(doc: GeometryDoc, id: string, patch: Partial<GeomLevel>): GeometryDoc {
  return { ...doc, levels: doc.levels.map((l) => (l.id === id ? { ...l, ...patch, id: l.id } : patch.is_default ? { ...l, is_default: false } : l)) };
}

/** How many items sit on a level: walls, labels, objects, and connectors that start or end there. */
export function levelUsage(doc: GeometryDoc, id: string): number {
  return doc.walls.filter((w) => w.level_id === id).length + doc.labels.filter((l) => l.level_id === id).length + doc.objects.filter((o) => o.level_id === id).length
    + doc.connectors.filter((c) => c.level_from === id || c.level_to === id).length;
}

/** The level goes only when nothing sits on it and it is not the default (rooms and anchors keep their own level id:
 * the server treats an unknown one as the default). */
export function removeLevel(doc: GeometryDoc, id: string): GeometryDoc | null {
  const level = doc.levels.find((l) => l.id === id);
  if (!level || level.is_default || levelUsage(doc, id) > 0) return null;
  return { ...doc, levels: doc.levels.filter((l) => l.id !== id) };
}
```

Run the node spec → `6 passed`.

- [ ] **Step 3: Panel — chips, dialog, per-item level selects (`plan-studio-panel.ts`)**

Add to `StudioView` (after `showEstimates: boolean;`): `  levels: GeomLevel[];` and to `StudioActions` (after `retry(): void;`): `  setLevel(id: string, levelId: string): void;`. In `renderWall`, after the height field (`</sw-field>` of "גובה (מ׳, ריק = עד התקרה)") add:

```ts
    ${levelSelect(v.levels, w.level_id, (lv) => a.setLevel(w.id, lv))}
```

and in `renderLabel`, after the size field add `    ${levelSelect(v.levels, l.level_id, (lv) => a.setLevel(l.id, lv))}` (change its signature to `function renderLabel(l: GeomLabel, v: StudioView, a: StudioActions)` and its call in `renderSelection` to `renderLabel(l, v, a)`). Add before `renderSelection`:

```ts
/** The level an item sits on (only shown when the floor has more than one). */
function levelSelect(levels: GeomLevel[], current: string, onPick: (levelId: string) => void) {
  if (levels.length < 2) return nothing;
  return html`<sw-field label="מפלס"><select data-item-level @change=${(e: Event) => onPick((e.target as HTMLSelectElement).value)}>${levels.map((l) => html`<option value=${l.id} ?selected=${l.id === current}>${l.name} (${l.elevation_m} מ׳)</option>`)}</select></sw-field>`;
}
```

Append before `export const studioPanelStyles`:

```ts
// ---------------------------------------------------------------- levels (T085)

/** The chips over the canvas: all levels, or one. `onAdd` (editors) adds the "+ מפלס" chip. */
export function renderLevelChips(levels: GeomLevel[], current: string | null, onPick: (id: string | null) => void, onAdd?: () => void): TemplateResult {
  if (levels.length < 2 && !onAdd) return html``;
  return html`<div class="levelchips" role="group" aria-label="מפלסים" data-level-chips>
    <sw-chip data-level-chip="all" ?selected=${current === null} @click=${() => onPick(null)}>כל המפלסים</sw-chip>
    ${[...levels].sort((a, b) => b.elevation_m - a.elevation_m).map((l) => html`<sw-chip data-level-chip=${l.id} ?selected=${current === l.id} @click=${() => onPick(l.id)}>${l.name} · ${l.elevation_m >= 0 ? '+' : '−'}${Math.abs(l.elevation_m).toFixed(1)} מ׳</sw-chip>`)}
    ${onAdd ? html`<sw-chip data-level-add icon="plus" @click=${onAdd}>מפלס</sw-chip>` : nothing}
  </div>`;
}

export interface LevelDialogView {
  name: string;
  elevation: number;
  ceiling: number;
  error: string;
}

export function renderLevelDialog(v: LevelDialogView, onChange: (patch: Partial<LevelDialogView>) => void, onCreate: () => void, onCancel: () => void): TemplateResult {
  const num = (e: Event) => parseFloat((e.target as HTMLInputElement).value);
  const ok = v.name.trim().length > 0 && v.elevation >= -50 && v.elevation <= 500 && v.ceiling > 0 && v.ceiling <= 50;
  return html`<sw-dialog open heading="מפלס חדש" subheading="גובה הרצפה יחסית למפלס הראשי (0), וגובה התקרה מעליה" data-level-dialog @close=${onCancel}>
    ${v.error ? html`<div class="err">${v.error}</div>` : nothing}
    <sw-field label="שם"><input type="text" maxlength="60" data-level-name placeholder="למשל: אולם תחתון" .value=${v.name} @input=${(e: Event) => onChange({ name: (e.target as HTMLInputElement).value })} /></sw-field>
    <div class="two">
      <sw-field label="גובה רצפה (מ׳)" hint="שלילי = מתחת למפלס הראשי"><input type="number" min="-50" max="500" step="0.1" data-ltr data-level-elevation .value=${String(v.elevation)} @input=${(e: Event) => onChange({ elevation: num(e) })} /></sw-field>
      <sw-field label="גובה תקרה (מ׳)"><input type="number" min="0.1" max="50" step="0.1" data-ltr data-level-ceiling .value=${String(v.ceiling)} @input=${(e: Event) => onChange({ ceiling: num(e) })} /></sw-field>
    </div>
    <sw-button slot="footer" variant="ghost" data-level-cancel @click=${onCancel}>ביטול</sw-button>
    <sw-button slot="footer" variant="primary" icon="check" data-level-create ?disabled=${!ok} @click=${onCreate}>הוסף מפלס</sw-button>
  </sw-dialog>`;
}
```

and to `studioPanelStyles` append:

```css
  .levelchips {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    align-items: center;
  }
```

- [ ] **Step 4: The editor (`explore-plan-editor.ts`)**

Imports: add `addLevel` to the studio-ops import; add `renderLevelChips, renderLevelDialog, type LevelDialogView` to the panel import; add `import '../components/sw-chip';` after `import '../components/sw-dialog';`.

State (after `  @state() private customDialog: … = null;`):

```ts
  /** The level shown in the editor (null = every level): filters walls, labels, objects and pins; new items take it. */
  @state() private levelFilter: string | null = null;
  @state() private levelDialog: LevelDialogView | null = null;
```

Replace `placeOpts` with:

```ts
  /** The level new items go to: the level filter when one is on, else the document's default level. */
  private placeOpts(doc: GeometryDoc): { levelId: string; ceilingM: number } {
    const levelId = this.levelFilter && doc.levels.some((l) => l.id === this.levelFilter) ? this.levelFilter : defaultLevelId(doc);
    return { levelId, ceilingM: doc.levels.find((l) => l.id === levelId)?.ceiling_height_m ?? 2.8 };
  }

  private createLevel() {
    const doc = this.studio.doc;
    const v = this.levelDialog;
    if (!doc || !v) return;
    if (doc.levels.some((l) => l.elevation_m === v.elevation)) {
      this.levelDialog = { ...v, error: 'כבר יש מפלס בגובה הזה' };
      return;
    }
    const r = addLevel(doc, v.name, v.elevation, v.ceiling);
    this.studio.commit(r.doc);
    this.levelDialog = null;
    this.levelFilter = r.id;
    this.info = `המפלס "${v.name}" נוסף; פריטים חדשים יוצבו בו`;
    setTimeout(() => (this.info = ''), 4000);
  }

  /** Pins on other levels are hidden with the level filter (anchors without a level belong to the default one). */
  private onLevel(a: Anchor): boolean {
    const doc = this.studio.doc;
    if (!this.levelFilter || !doc) return true;
    return (a.level_id ?? defaultLevelId(doc)) === this.levelFilter;
  }
```

In the `markers` getter, replace `      .filter((a) => this.layers.has(this.layerOf(a)))` with `      .filter((a) => this.layers.has(this.layerOf(a)) && this.onLevel(a))`.

In `finishWall`, replace `    const r = addWall(doc, d, this.wallDefaults);\n    this.studio.commit(r.doc);` with:

```ts
    const r = addWall(doc, d, this.wallDefaults);
    const level = this.placeOpts(doc).levelId;
    this.studio.commit(level === defaultLevelId(doc) ? r.doc : patchWall(r.doc, r.id, { level_id: level }));
```

and in `studioClick`'s label branch replace `      const r = addLabel(doc, p, 'תווית');\n      this.studio.commit(r.doc);` with:

```ts
      const r = addLabel(doc, p, 'תווית');
      const level = this.placeOpts(doc).levelId;
      this.studio.commit(level === defaultLevelId(doc) ? r.doc : patchLabel(r.doc, r.id, { level_id: level }));
```

In `renderStructurePanel`, add `levels: doc.levels,` after `showEstimates: this.showEstimates,` and `setLevel: (id, lv) => this.edit((d) => (d.walls.some((w) => w.id === id) ? patchWall(d, id, { level_id: lv }) : patchLabel(d, id, { level_id: lv }))),` after the `retry` action.

In `save()`, in the `updateAnchor(…)` call add `level_id: a.level_id ?? ''` after `label_pos: a.label_pos ?? 'auto'`.

In `renderCameraInspector` and `renderEntityInspector`, before the `<sw-field label="תווית (אופציונלי)">` line (camera) and before the `<sw-field label="שם במפה (ידני)">` line (entity) add:

```ts
      ${(this.studio.doc?.levels.length ?? 0) > 1 ? html`<sw-field label="מפלס"><select data-anchor-level @change=${(ev: Event) => this.apply(a.id, { level_id: (ev.target as HTMLSelectElement).value || null })}>${this.studio.doc!.levels.map((l) => html`<option value=${l.id} ?selected=${(a.level_id ?? defaultLevelId(this.studio.doc!)) === l.id}>${l.name}</option>`)}</select></sw-field>` : nothing}
```

In `renderZoneInspector`, after the `<sw-field label="מיקום שם החדר">…</sw-field>` line add:

```ts
      ${(this.studio.doc?.levels.length ?? 0) > 1 ? html`<sw-field label="מפלס"><select data-zone-level @change=${(e: Event) => this.patchZone(z, { level_id: (e.target as HTMLSelectElement).value })}>${this.studio.doc!.levels.map((l) => html`<option value=${l.id} ?selected=${(z.level_id ?? defaultLevelId(this.studio.doc!)) === l.id}>${l.name}</option>`)}</select></sw-field>` : nothing}
```

and extend `patchZone`'s body type with `level_id?: string; ceiling_height_m?: number`.

In `render()`: on the canvas element add ` .structureLevel=${this.levelFilter}` after `.geomDrag=${this.geomDragMode}`; right after the `<div class="floorchip">…</div>` line add:

```ts
                ${this.studio.doc && b.permissions.structure ? html`<div class="levelbar">${renderLevelChips(this.studio.doc.levels, this.levelFilter, (id) => (this.levelFilter = id), () => (this.levelDialog = { name: '', elevation: -1.2, ceiling: 3.0, error: '' }))}</div>` : nothing}
```

and after the custom item dialog line add:

```ts
        ${this.levelDialog ? renderLevelDialog(this.levelDialog, (patch) => (this.levelDialog = { ...this.levelDialog!, ...patch }), () => this.createLevel(), () => (this.levelDialog = null)) : nothing}
```

Styles (before `@media (max-width: 1023px)`):

```css
    .levelbar {
      position: absolute;
      inset-inline-start: 50%;
      transform: translateX(-50%);
      inset-block-start: 12px;
      z-index: var(--sw-z-map-ui);
      background: var(--sw-surface);
      border: 1px solid var(--sw-border);
      border-radius: 999px;
      padding: 4px 8px;
      box-shadow: var(--sw-shadow-1);
      max-inline-size: 60%;
    }
```

and add `studioPanelStyles`' `.levelchips` (already there) — the editor includes `studioPanelStyles` ✓.

- [ ] **Step 5: The live map (`explore-floor-map.ts`)**

Add `import '../components/sw-chip';` if missing (it is imported already: keep), `import { renderLevelChips } from './plan-studio-panel';` after the `../api/plan-catalog` import, and `@state() private levelFilter: string | null = null;` after `catalogLookup`. In `load()`, right after `this.restoreLayers();` add `this.levelFilter = null;`. In the `markers` getter's API branch, replace `      .filter((a) => (a.resource_type === 'camera' ? this.layers.has('cameras') : this.layers.has(a.layer_id === 'doors' ? 'doors' : a.layer_id === 'lights' ? 'lights' : 'sensors')))` with:

```ts
      .filter((a) => (a.resource_type === 'camera' ? this.layers.has('cameras') : this.layers.has(a.layer_id === 'doors' ? 'doors' : a.layer_id === 'lights' ? 'lights' : 'sensors')))
      .filter((a) => !this.levelFilter || (a.level_id ?? b.levels.find((l) => l.is_default)?.id ?? 'L0') === this.levelFilter)
```

On the canvas element (renderStage) add ` .structureLevel=${this.levelFilter}` after `.hideConnectors=${…}`, and right after the `<div class="floorchip" data-floorchip>…</div>` line add:

```ts
      ${b.levels.length > 1 ? html`<div class="levelbar">${renderLevelChips(b.levels, this.levelFilter, (id) => (this.levelFilter = id))}</div>` : nothing}
```

with the style (in the floor map's `static styles`, next to `.floorchip`):

```css
    .levelbar {
      position: absolute;
      inset-inline-start: 50%;
      transform: translateX(-50%);
      inset-block-start: 12px;
      z-index: var(--sw-z-map-ui);
      background: var(--sw-surface);
      border: 1px solid var(--sw-border);
      border-radius: 999px;
      padding: 4px 8px;
      box-shadow: var(--sw-shadow-1);
      display: flex;
      gap: 6px;
      flex-wrap: wrap;
      max-inline-size: 60%;
    }
```

- [ ] **Step 6: The live test (append inside the `test.describe.serial` block)**

```ts
  test('a third level is added from the chips; the tribune connects the hall to the level at -1.2 m and publishes its connector; the live map filters by level', async ({ page }) => {
    const ed = 'explore-plan-editor';
    await page.goto(`/?design=a#/explore/floors/${ids.floor}/edit`);
    await expect(page.locator(`${ed} [data-level-chips] [data-level-chip]`)).toHaveCount(3, { timeout: 20000 }); // all + the two seeded levels
    await page.locator(`${ed} [data-level-add]`).click();
    await page.locator(`${ed} [data-level-name]`).fill('גלריה');
    await page.locator(`${ed} [data-level-elevation]`).fill('3.5');
    await page.locator(`${ed} [data-level-ceiling]`).fill('3');
    await page.locator(`${ed} [data-level-create]`).click();
    await expect(page.locator(`${ed} [data-level-chips] [data-level-chip]`)).toHaveCount(4);
    await expect.poll(async () => (await draft()).doc.levels.map((l) => l.id), { timeout: 10000 }).toEqual(['L0', 'L1', 'L2']);
    // the new level is the filter now: nothing of the hall shows; back to all levels
    await expect(page.locator(`${ed} sw-plan-canvas [data-object]`)).toHaveCount(0);
    await page.locator(`${ed} [data-level-chip="all"]`).click();
    await expect(page.locator(`${ed} sw-plan-canvas [data-object]`).first()).toBeAttached();
    // a tribune on the hall level that descends to the lower hall
    await page.locator(`${ed} [data-tool="library"]`).click();
    await page.locator(`${ed} [data-lib-search]`).fill('טריבונה');
    await page.locator(`${ed} [data-lib-item="tribune.stepped"]`).click();
    await clickPlan(page, ed, 0.5, 0.7);
    await page.keyboard.press('Escape');
    await expect(page.locator(`${ed} [data-selected-object]`)).toBeVisible();
    const tribuneId = (await page.locator(`${ed} [data-selected-object]`).getAttribute('data-selected-object'))!;
    await page.locator(`${ed} [data-object-param="connects_levels"]`).selectOption('L1');
    await expect.poll(async () => (await draft()).doc.connectors.find((c) => c.id === `cx-${tribuneId}`)?.level_to ?? null, { timeout: 10000 }).toBe('L1');
    await expect(page.locator(`${ed} sw-plan-canvas [data-connector="cx-${tribuneId}"][data-kind="tribune"]`)).toHaveCount(1);
    await page.locator(`${ed} [data-publish]`).click();
    await expect(page.locator(`${ed} [data-geom-diff-rows]`)).toContainText('עצמים');
    await expect(page.locator(`${ed} [data-geom-diff-rows]`)).toContainText('מפלסים');
    const published = page.waitForResponse((r) => r.url().includes('/geometry/publish'));
    await page.locator(`${ed} [data-geom-publish]`).click();
    expect((await published).status()).toBe(200);
    await page.goto(`/?design=a#/explore/floors/${ids.floor}`);
    await expect(page.locator(`explore-floor-map sw-plan-canvas [data-connector="cx-${tribuneId}"] text`)).toHaveText('↓ −1.2 מ׳', { timeout: 20000 });
    await expect(page.locator('explore-floor-map [data-level-chips] [data-level-chip]')).toHaveCount(4);
    await page.locator('explore-floor-map [data-level-chip="L1"]').click();
    await expect(page.locator(`explore-floor-map sw-plan-canvas [data-object="${tribuneId}"]`)).toHaveCount(0);
    await expect(page.locator(`explore-floor-map sw-plan-canvas [data-connector="cx-${tribuneId}"]`)).toHaveCount(1); // connectors are never filtered
    await page.locator('explore-floor-map [data-level-chip="all"]').click();
    await expect(page.locator(`explore-floor-map sw-plan-canvas [data-object="${tribuneId}"]`)).toHaveCount(1);
  });
```

- [ ] **Step 7: Type-check, build, run**

Run (in `frontend/`): `npx tsc --noEmit -p tsconfig.json` → exit 0; `npx playwright test tests/unit-studio-ops-2.spec.ts --project=desktop --reporter=line` → `6 passed`; `npm run build`, `SW_LIVE=1 SW_CHROME=1 npx playwright test tests/evidence-plan-studio-2.spec.ts --project=desktop --workers=1 --reporter=line` → `4 passed`; `SW_LIVE=1 SW_CHROME=1 npx playwright test tests/evidence-plan-studio.spec.ts tests/evidence-zones.spec.ts tests/evidence-editor.spec.ts --project=desktop --workers=1 --reporter=line` → as their baselines; `bash "$SP/fixture_chain.sh"` → `129 passed`.

- [ ] **Step 8: Commit**

```bash
cd /c/cloude/smplwisebms && git add frontend/src/map/studio-ops.ts frontend/src/screens/plan-studio-panel.ts frontend/src/screens/explore-plan-editor.ts frontend/src/screens/explore-floor-map.ts frontend/tests/unit-studio-ops-2.spec.ts frontend/tests/evidence-plan-studio-2.spec.ts
git add docs/evidence/T007 2>/dev/null
msg=$(mktemp) && cat > "$msg" <<'EOF'
feat(plan-studio): levels - chips over the canvas, add level dialog, per item level, zones and anchors on a level, live map level filter (T085)

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOF
test "$(bash /c/cloude/smplwisebms/secrets/scan_staged.sh)" = 0 && git commit -F "$msg"
```

---
### Task 12: Editor — connectors (stairs, ramp, elevator, ladder) and the cross-floor link

**Files:**
- Modify: `frontend/src/map/studio-ops.ts` (`CONNECTOR_DEFAULT_WIDTH_M`, `addConnector`, `patchConnector`, `moveConnectorVertex`)
- Modify: `frontend/src/screens/plan-studio-panel.ts` (`renderConnectorPanel`)
- Modify: `frontend/src/screens/explore-plan-editor.ts` (tool `connectors`, two-click drawing, vertex drags, the link)
- Test: `frontend/tests/unit-studio-ops-2.spec.ts` (one test appended), `frontend/tests/evidence-plan-studio-2.spec.ts` (fifth live test)

**Interfaces:**
- Consumes: `linkConnector` (Task 7), `GeomConnector`, `ConnectorKind`, `connectorLabel` (Task 7); `loadTree` (`../api/catalog`); canvas `connector-vertex` drags and `[data-connector-vertex]` (Task 9); `geomDragMode` `objects` (Task 9).
- Produces:
  - `studio-ops.ts`: `CONNECTOR_DEFAULT_WIDTH_M = {stairs: 1.2, ramp: 1.5, tribune: 4, elevator: 1.6, ladder: 0.5}`, `CONNECTOR_KINDS`, `addConnector(doc, kind, a, b, levelFrom, levelTo) -> {doc, id}`, `patchConnector(doc, id, patch)`, `moveConnectorVertex(doc, id, index, p)`.
  - Panel: `ConnectorView`, `ConnectorActions`, `renderConnectorPanel`; DOM `[data-connector-panel][data-studio-save]`, `[data-conn-mode=<kind>]`, `[data-conn-row=<id>]`, `[data-selected-connector=<id>]`, `[data-conn-kind] [data-conn-from] [data-conn-to] [data-conn-width] [data-conn-label]`, `[data-conn-derived]`, `[data-conn-link-floor]`, `[data-conn-link]`, `[data-geom-delete]`.
  - Editor: tool `[data-tool="connectors"]` (icon `stairs`, label "מפלסים ומחברים"); two clicks draw a connector (a rubber band ruler in between, snapping to wall corners); `level_from` = the level filter or the default, `level_to` = the other level when the floor has exactly two, else empty; "קשר לקומה" calls `POST …/geometry/link` and reloads the draft (its revision moved).

- [ ] **Step 1: Failing node test (append to `unit-studio-ops-2.spec.ts`; add `addConnector, moveConnectorVertex, patchConnector` to the studio-ops import)**

```ts
  test('connectors: drawn between two points with the kind width, patched and their corners moved inside the plan', () => {
    const doc = sample();
    const r = addConnector(doc, 'stairs', [0.7, 0.2], [0.9, 0.2], 'L0', 'L1');
    const c = r.doc.connectors.find((x) => x.id === r.id)!;
    expect(c).toEqual({ id: r.id, kind: 'stairs', level_from: 'L0', level_to: 'L1', floor_ids: [], polyline: [[0.7, 0.2], [0.9, 0.2]], width_m: 1.2, label: null, object_id: null, source: 'manual', external_ids: {} });
    expect(addConnector(doc, 'elevator', [0.1, 0.1], [0.1, 0.15], 'L0', null).doc.connectors.at(-1)!.width_m).toBe(1.6);
    const wider = patchConnector(r.doc, r.id, { width_m: 2, level_to: null, floor_ids: ['f-other'] });
    expect(wider.connectors.find((x) => x.id === r.id)).toMatchObject({ width_m: 2, level_to: null, floor_ids: ['f-other'] });
    expect(moveConnectorVertex(r.doc, r.id, 1, [1.2, 0.3]).connectors.find((x) => x.id === r.id)!.polyline).toEqual([[0.7, 0.2], [1, 0.3]]);
    expect(moveConnectorVertex(r.doc, 'cx-o4', 0, [0.1, 0.1]).connectors.find((x) => x.id === 'cx-o4')!.polyline).toEqual([[0.25, 0.4125], [0.25, 0.7875]]); // derived: not editable
  });
```

Run → FAIL (`addConnector` is not exported).

- [ ] **Step 2: Connector operations (append to `studio-ops.ts`; add `type ConnectorKind, type GeomConnector` to the geometry import)**

```ts
// ---------------------------------------------------------------- connectors (T085)

export const CONNECTOR_KINDS: readonly ConnectorKind[] = ['stairs', 'ramp', 'tribune', 'elevator', 'ladder'];
export const CONNECTOR_DEFAULT_WIDTH_M: Record<ConnectorKind, number> = { stairs: 1.2, ramp: 1.5, tribune: 4, elevator: 1.6, ladder: 0.5 };

export function addConnector(doc: GeometryDoc, kind: ConnectorKind, a: Pt, b: Pt, levelFrom: string, levelTo: string | null): { doc: GeometryDoc; id: string } {
  const c: GeomConnector = { id: newId(), kind, level_from: levelFrom, level_to: levelTo, floor_ids: [], polyline: [clampPt(a), clampPt(b)], width_m: CONNECTOR_DEFAULT_WIDTH_M[kind], label: null,
    object_id: null, source: 'manual', external_ids: {} };
  return { doc: { ...doc, connectors: [...doc.connectors, c] }, id: c.id };
}

export function patchConnector(doc: GeometryDoc, id: string, patch: Partial<GeomConnector>): GeometryDoc {
  return { ...doc, connectors: doc.connectors.map((c) => (c.id === id ? { ...c, ...patch, id: c.id } : c)) };
}

/** A corner of a drawn connector; a connector derived from an object (a tribune) follows its object, not the pointer. */
export function moveConnectorVertex(doc: GeometryDoc, id: string, index: number, p: Pt): GeometryDoc {
  return { ...doc, connectors: doc.connectors.map((c) => (c.id === id && !c.object_id ? { ...c, polyline: c.polyline.map((q, i) => (i === index ? clampPt(p) : q)) } : c)) };
}
```

Run the node spec → `7 passed`.

- [ ] **Step 3: The panel (`plan-studio-panel.ts`, append before `studioPanelStyles`; add `type ConnectorKind, type GeomConnector` to the geometry import)**

```ts
// ---------------------------------------------------------------- connectors (T085)

export const CONNECTOR_LABEL: Record<ConnectorKind, string> = { stairs: 'מדרגות', ramp: 'רמפה', tribune: 'טריבונה', elevator: 'מעלית', ladder: 'סולם' };

export interface ConnectorView {
  doc: GeometryDoc;
  mode: ConnectorKind | null;
  start: Pt | null;
  sel: GeomConnector | undefined;
  saveState: SaveState;
  /** The other floors of the building (the link picker) and the floor chosen in it. */
  floors: { id: string; name: string }[];
  linkFloor: string;
  linkBusy: boolean;
  phone: boolean;
}

export interface ConnectorActions {
  setMode(kind: ConnectorKind | null): void;
  select(id: string): void;
  patch(id: string, patch: Partial<GeomConnector>): void;
  remove(id: string): void;
  setLinkFloor(floorId: string): void;
  link(id: string): void;
}

export function renderConnectorPanel(v: ConnectorView, a: ConnectorActions): TemplateResult {
  const levels = v.doc.levels;
  const levelName = (id: string | null) => (id ? levels.find((l) => l.id === id)?.name ?? id : 'קומה אחרת');
  const sel = v.sel;
  const num = (e: Event) => parseFloat((e.target as HTMLInputElement).value);
  return html`<sw-card heading="מפלסים ומחברים" subheading=${v.mode ? (v.start ? `לחץ על הנקודה השנייה של ${CONNECTOR_LABEL[v.mode]} · Esc לביטול` : `לחץ על הנקודה הראשונה של ${CONNECTOR_LABEL[v.mode]}`) : 'מדרגות, רמפה, מעלית וסולם בין מפלסים ובין קומות'} data-connector-panel data-studio-save=${v.saveState}>
    <div class="modes" role="group" aria-label="סוג מחבר">
      ${(['stairs', 'ramp', 'elevator', 'ladder'] as ConnectorKind[]).map((k) => html`<button class=${v.mode === k ? 'on' : ''} data-conn-mode=${k} aria-pressed=${v.mode === k} @click=${() => a.setMode(v.mode === k ? null : k)}>${CONNECTOR_LABEL[k]}</button>`)}
    </div>
    <div class="note">שתי לחיצות על התוכנית מציירות מחבר (הצמדה לפינות קירות). טריבונה היא עצם מהספרייה: המחבר שלה נוצר לבד כשמגדירים לאיזה מפלס היא יורדת.</div>
    ${v.doc.connectors.length
      ? html`<div class="list">${v.doc.connectors.map((c) => html`<button class=${sel?.id === c.id ? 'on' : ''} data-conn-row=${c.id} @click=${() => a.select(c.id)}>
          <span>${CONNECTOR_LABEL[c.kind] ?? c.kind}${c.object_id ? ' (מעצם)' : ''}</span><span class="note" style="margin:0">${levelName(c.level_from)} ← ${c.floor_ids.length ? `${c.floor_ids.length} קומות` : levelName(c.level_to)}</span>
        </button>`)}</div>`
      : html`<div class="note">עדיין אין מחברים בקומה.</div>`}
    ${sel ? renderConnectorInspector(sel, v, a, levelName, num) : nothing}
  </sw-card>`;
}

function renderConnectorInspector(c: GeomConnector, v: ConnectorView, a: ConnectorActions, levelName: (id: string | null) => string, num: (e: Event) => number) {
  const derived = !!c.object_id;
  const others = v.doc.levels.filter((l) => l.id !== c.level_from);
  return html`<div class="sel" data-selected-connector=${c.id}>
    <div class="selhead"><strong>${CONNECTOR_LABEL[c.kind] ?? c.kind}</strong><span class="muted">${connectorLabelOf(v.doc, c)}</span></div>
    ${derived ? html`<div class="note" data-conn-derived>נגזר מעצם (${c.object_id}): המיקום, הרוחב והמפלסים מגיעים מהעצם; ערוך אותו בספריית העצמים.</div>` : nothing}
    <div class="two">
      <sw-field label="סוג"><select data-conn-kind ?disabled=${derived} @change=${(e: Event) => a.patch(c.id, { kind: (e.target as HTMLSelectElement).value as ConnectorKind })}>${(['stairs', 'ramp', 'elevator', 'ladder', 'tribune'] as ConnectorKind[]).map((k) => html`<option value=${k} ?selected=${k === c.kind}>${CONNECTOR_LABEL[k]}</option>`)}</select></sw-field>
      <sw-field label="רוחב (מ׳)"><input type="number" min="0.05" max="100" step="0.1" data-ltr data-conn-width ?disabled=${derived} .value=${String(c.width_m)} @change=${(e: Event) => { const x = num(e); if (x >= 0.05 && x <= 100) a.patch(c.id, { width_m: x }); }} /></sw-field>
    </div>
    <div class="two">
      <sw-field label="ממפלס"><select data-conn-from ?disabled=${derived} @change=${(e: Event) => a.patch(c.id, { level_from: (e.target as HTMLSelectElement).value })}>${v.doc.levels.map((l) => html`<option value=${l.id} ?selected=${l.id === c.level_from}>${l.name}</option>`)}</select></sw-field>
      <sw-field label="למפלס"><select data-conn-to ?disabled=${derived || c.floor_ids.length > 0} @change=${(e: Event) => a.patch(c.id, { level_to: (e.target as HTMLSelectElement).value || null })}>
        <option value="" ?selected=${!c.level_to}>${c.floor_ids.length ? 'קומה אחרת' : 'בחר מפלס'}</option>${others.map((l) => html`<option value=${l.id} ?selected=${l.id === c.level_to}>${l.name}</option>`)}</select></sw-field>
    </div>
    <sw-field label="תווית (אופציונלי; ריק = הפרש הגובה)"><input type="text" maxlength="80" data-conn-label .value=${c.label ?? ''} @change=${(e: Event) => a.patch(c.id, { label: (e.target as HTMLInputElement).value.trim() || null })} /></sw-field>
    ${!derived
      ? html`<div class="row"><span class="lbl">קשר לקומה<span class="muted">${c.floor_ids.length ? `מקושר: ${c.floor_ids.length} קומות · אותו מזהה בשתי הקומות` : 'מדרגות או מעלית לקומה אחרת מופיעות בטיוטה של שתי הקומות'}</span></span>
          <select data-conn-link-floor aria-label="קומה" ?disabled=${!v.floors.length} @change=${(e: Event) => a.setLinkFloor((e.target as HTMLSelectElement).value)}>
            <option value="" ?selected=${!v.linkFloor}>בחר קומה</option>${v.floors.map((f) => html`<option value=${f.id} ?selected=${f.id === v.linkFloor}>${f.name}</option>`)}</select>
          <sw-button size="sm" data-conn-link ?disabled=${!v.linkFloor || v.linkBusy} @click=${() => a.link(c.id)}>${v.linkBusy ? 'מקשר…' : 'קשר'}</sw-button></div>`
      : nothing}
    <div class="note">${levelName(c.level_from)} ← ${c.floor_ids.length ? 'קומה אחרת' : levelName(c.level_to)} · גרירת פינה מזיזה את המחבר</div>
    ${!derived ? html`<div class="btns"><sw-button size="sm" variant="ghost" icon="trash" data-geom-delete @click=${() => a.remove(c.id)}>מחק מחבר</sw-button></div>` : nothing}
  </div>`;
}

function connectorLabelOf(doc: GeometryDoc, c: GeomConnector): string {
  return connectorLabel(new Map(doc.levels.map((l) => [l.id, l])), c);
}
```

and add `connectorLabel` to the `../map/geometry` value imports of the panel.

- [ ] **Step 4: The editor (`explore-plan-editor.ts`)**

Imports: add `addConnector, moveConnectorVertex, patchConnector` to the studio-ops import; add `renderConnectorPanel` to the panel import; add `import { linkConnector } from '../api/geometry';` (merge into the existing `../api/geometry` import: `import { calibrate, copyGeometryFrom, exportUrl, geometryDiff, linkConnector, publishGeometry, type GeometryDiffResponse } from '../api/geometry';`); add `import { loadTree, type CatalogTree } from '../api/catalog';` and `type ConnectorKind` to the geometry type import.

Tools: `type Tool` gains `'connectors'` (after `'library'`); `TOOLS` gains `  { id: 'connectors', icon: 'stairs', label: 'מפלסים ומחברים', ready: true },` after the library entry; `STUDIO_TOOLS` becomes `['structure', 'library', 'connectors', 'calibrate', 'measure']`.

State (after `levelDialog`):

```ts
  // ---- connectors (T085) ----
  @state() private connMode: ConnectorKind | null = null;
  @state() private connStart: Pt | null = null;
  @state() private tree: CatalogTree | null = null;
  @state() private linkFloor = '';
  @state() private linkBusy = false;
```

In `pickTool`, after `    this.bindOffer = null;` add `    this.connMode = null;\n    this.connStart = null;\n    if (tool === 'connectors' && !this.tree && this.bundle?.source === 'api') void loadTree().then((t) => (this.tree = t)).catch(() => {});`.

In the `studioPlacing` getter, after `    if (this.tool === 'library') return !!this.placingItem;` add `    if (this.tool === 'connectors') return !!this.connMode;`; in `geomDragMode`, after `    if (this.tool === 'library') return this.placingItem ? 'none' : 'objects';` add `    if (this.tool === 'connectors') return this.connMode ? 'none' : 'objects';`.

In `onPlanHover`, before `    else if (this.tool === 'calibrate')` add `    else if (this.tool === 'connectors') this.hover = this.snap(p, null, true);`. In `studioClick`, after the library block add:

```ts
    if (this.tool === 'connectors') {
      if (!this.connMode) return;
      const q = this.snap(p, null, true);
      if (!this.connStart) {
        this.connStart = q;
        return;
      }
      const from = this.placeOpts(doc).levelId;
      const others = doc.levels.filter((l) => l.id !== from);
      const r = addConnector(doc, this.connMode, this.connStart, q, from, others.length === 1 ? others[0].id : null);
      this.connStart = null;
      this.studio.commit(r.doc);
      this.geomSel = { id: r.id, kind: 'connector' };
      return;
    }
```

In `dragged()`, replace `    if (d.kind === 'connector-vertex') return null; // Task 12` with:

```ts
    if (d.kind === 'connector-vertex') {
      const c = doc.connectors.find((v) => v.id === d.id);
      if (!c || c.object_id) return null;
      return { doc: moveConnectorVertex(doc, d.id, d.index, this.snap(p, null, true)), sel: { id: d.id, kind: 'connector' } };
    }
```

In `onGeomSelect`, after the library line add `    if (kind === 'connector' && this.tool !== 'connectors') this.pickTool('connectors');`. In `handleKey`'s Escape branch, before `      if (this.placingItem)` add `      if (this.connStart) { this.connStart = null; return; }`. In the `rulers` getter, before `    if (this.tool === 'calibrate') {` add:

```ts
    if (this.tool === 'connectors' && this.connStart && this.hover) return [{ a: this.connStart, b: this.hover, label: this.connMode ? { stairs: 'מדרגות', ramp: 'רמפה', elevator: 'מעלית', ladder: 'סולם', tribune: 'טריבונה' }[this.connMode] : '', tone: 'muted' }];
```

In `focusGeom`, after the `if (ob) {…}` block add:

```ts
    const cn = doc.connectors.find((x) => x.id === id);
    if (cn) {
      this.pickTool('connectors');
      this.geomSel = { id, kind: 'connector' };
      const mid = cn.polyline[Math.floor(cn.polyline.length / 2)];
      if (mid) this.canvas?.centerOn(mid[0], mid[1]);
      return;
    }
```

Add after `createLevel`:

```ts
  /** The other floors of this building, for the link picker. */
  private get otherFloors(): { id: string; name: string }[] {
    const b = this.bundle;
    if (!b || this.tree?.source !== 'api') return [];
    for (const s of this.tree.sites) for (const bl of s.buildings ?? []) if ((bl.floors ?? []).some((f) => f.id === b.floorId)) return (bl.floors ?? []).filter((f) => f.id !== b.floorId).map((f) => ({ id: f.id, name: f.name }));
    return [];
  }

  private async linkTo(connectorId: string) {
    const b = this.bundle;
    if (!b?.planVersionId || !this.linkFloor) return;
    this.linkBusy = true;
    this.error = '';
    try {
      if (!(await this.studio.flush())) {
        this.error = this.studio.error;
        return;
      }
      const r = await linkConnector(b.planVersionId, connectorId, this.linkFloor);
      await this.loadStudio(b, true); // the server changed both drafts: this one has a new revision
      this.geomSel = { id: connectorId, kind: 'connector' };
      this.info = `המחבר קושר לקומה "${this.otherFloors.find((f) => f.id === r.target.floor_id)?.name ?? ''}"; הוא מופיע בטיוטה שלה באותו מזהה`;
      setTimeout(() => (this.info = ''), 5000);
    } catch (err) {
      this.error = describeError(err);
    } finally {
      this.linkBusy = false;
    }
  }

  private renderConnectorTool(b: MapBundle) {
    const doc = this.studio.doc;
    if (!doc) return html`<sw-card heading="מפלסים ומחברים"><div class="note">${b.source === 'demo' ? 'נתוני הדגמה: המחברים עובדים מול השרת.' : this.error || 'טוען…'}</div></sw-card>`;
    return renderConnectorPanel(
      { doc, mode: this.connMode, start: this.connStart, sel: this.geomSel?.kind === 'connector' ? doc.connectors.find((c) => c.id === this.geomSel!.id) : undefined, saveState: this.studio.saveState,
        floors: this.otherFloors, linkFloor: this.linkFloor, linkBusy: this.linkBusy, phone: this.phone.matches },
      {
        setMode: (k) => {
          this.connMode = k;
          this.connStart = null;
          this.geomSel = null;
        },
        select: (id) => (this.geomSel = { id, kind: 'connector' }),
        patch: (id, patch) => this.edit((d) => patchConnector(d, id, patch)),
        remove: (id) => {
          this.edit((d) => removeItem(d, id));
          this.geomSel = null;
        },
        setLinkFloor: (f) => (this.linkFloor = f),
        link: (id) => void this.linkTo(id),
      },
    );
  }
```

In `renderToolPanel`, after the library line add `    if (this.tool === 'connectors') return this.renderConnectorTool(b);`. In `render()`, after the library placing hint add `                ${this.connMode ? html`<div class="placing-hint"><span>${this.connStart ? 'לחץ על הנקודה השנייה' : 'לחץ על הנקודה הראשונה'} · Esc לביטול</span></div>` : nothing}`.

- [ ] **Step 5: The live test (append inside the `test.describe.serial` block)**

```ts
  test('stairs are drawn with two clicks, set to reach the lower hall, and linked to the gallery floor under one id', async ({ page }) => {
    const ed = 'explore-plan-editor';
    await page.goto(`/?design=a#/explore/floors/${ids.floor}/edit`);
    await page.locator(`${ed} [data-tool="connectors"]`).click();
    await expect(page.locator(`${ed} [data-connector-panel]`)).toBeVisible();
    await page.locator(`${ed} [data-conn-mode="stairs"]`).click();
    await clickPlan(page, ed, 0.75, 0.9);
    await clickPlan(page, ed, 0.9, 0.9);
    await expect(page.locator(`${ed} [data-selected-connector]`)).toBeVisible();
    const stairsId = (await page.locator(`${ed} [data-selected-connector]`).getAttribute('data-selected-connector'))!;
    await expect(page.locator(`${ed} sw-plan-canvas [data-connector="${stairsId}"][data-kind="stairs"]`)).toHaveCount(1);
    await page.locator(`${ed} [data-conn-to]`).selectOption('L1');
    await expect.poll(async () => (await draft()).doc.connectors.find((c) => c.id === stairsId)?.level_to ?? null, { timeout: 10000 }).toBe('L1');
    await expect(page.locator(`${ed} sw-plan-canvas [data-connector="${stairsId}"] text`)).toHaveText('↓ −1.2 מ׳');
    // the link: the gallery floor gets the same connector on its draft; this draft lists both floors
    await page.locator(`${ed} [data-conn-link-floor]`).selectOption(ids.floor2);
    await page.locator(`${ed} [data-conn-link]`).click();
    await expect.poll(async () => (await draft(ids.version2)).doc.connectors.map((c) => c.id), { timeout: 15000 }).toEqual([stairsId]);
    const theirs = (await draft(ids.version2)).doc.connectors[0];
    expect(theirs.floor_ids.sort()).toEqual([ids.floor, ids.floor2].sort());
    expect(theirs.level_to).toBeNull();
    const mine = (await draft()).doc.connectors.find((c) => c.id === stairsId)!;
    expect(mine.floor_ids.sort()).toEqual([ids.floor, ids.floor2].sort());
    await expect(page.locator(`${ed} [data-selected-connector="${stairsId}"]`)).toContainText('2 קומות');
    await expect(page.locator(`${ed} sw-plan-canvas [data-connector="${stairsId}"] text`)).toHaveText('↕');
  });
```

- [ ] **Step 6: Type-check, build, run**

Run (in `frontend/`): `npx tsc --noEmit -p tsconfig.json` → exit 0; `npx playwright test tests/unit-studio-ops-2.spec.ts --project=desktop --reporter=line` → `7 passed`; `npm run build`, `SW_LIVE=1 SW_CHROME=1 npx playwright test tests/evidence-plan-studio-2.spec.ts --project=desktop --workers=1 --reporter=line` → `5 passed`; `bash "$SP/fixture_chain.sh"` → `129 passed`.

- [ ] **Step 7: Commit**

```bash
cd /c/cloude/smplwisebms && git add frontend/src/map/studio-ops.ts frontend/src/screens/plan-studio-panel.ts frontend/src/screens/explore-plan-editor.ts frontend/tests/unit-studio-ops-2.spec.ts frontend/tests/evidence-plan-studio-2.spec.ts
git add docs/evidence/T007 2>/dev/null
msg=$(mktemp) && cat > "$msg" <<'EOF'
feat(plan-studio): connectors tool - stairs, ramp, elevator and ladder between levels, corner drags, cross-floor link (T085)

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOF
test "$(bash /c/cloude/smplwisebms/secrets/scan_staged.sh)" = 0 && git commit -F "$msg"
```

---
### Task 13: Circuits — the editor panel (switch entity, lamps, power) and the live map toggle with the glow

**Files:**
- Modify: `frontend/src/map/studio-ops.ts` (`CIRCUIT_COLORS`, `addCircuit`, `patchCircuit`, `toggleCircuitMember`, `circuitPower`)
- Modify: `frontend/src/components/sw-icon.ts` (`bolt`)
- Modify: `frontend/src/screens/plan-studio-panel.ts` (`renderCircuitPanel`)
- Modify: `frontend/src/screens/explore-plan-editor.ts` (tool `circuits`, member mode)
- Modify: `frontend/src/screens/explore-floor-map.ts` (the circuit strip: state, toggle through the existing action path)
- Test: `frontend/tests/unit-studio-ops-2.spec.ts` (one test appended), `frontend/tests/evidence-plan-studio-2.spec.ts` (sixth live test)

**Interfaces:**
- Consumes: `listEntities` (`../api/ha`), `HaEntity`; `CircuitState`, `MapBundle.circuitStates` (Task 7); the floor map's `trigger(entityId, spec)` / `send()` / `this.action` (phase 1 HA actions); canvas `circuitStates` glow and `highlightIds` (Tasks 8, 10); `itemOf` (Task 7).
- Produces:
  - `studio-ops.ts`: `CIRCUIT_COLORS = ['circuit-1' … 'circuit-6']`, `addCircuit(doc, name, switchEntityId, colorToken) -> {doc, id}`, `patchCircuit(doc, id, patch)`, `toggleCircuitMember(doc, circuitId, objectId)` (an object is on one circuit at most), `circuitPower(doc, circuit, itemOf) -> number` (the client-side sum; the server recomputes on save).
  - Panel: `CircuitView`, `CircuitActions`, `renderCircuitPanel`; DOM `[data-circuit-panel][data-studio-save]`, `[data-circuit-row=<id>]`, `[data-circuit-new]`, `[data-circuit-name] [data-circuit-switch-q] [data-circuit-switch=<entity_id>] [data-circuit-color] [data-circuit-create] [data-circuit-cancel]`, `[data-selected-circuit=<id>]`, `[data-circuit-members]` (aria-pressed), `[data-circuit-count]`, `[data-circuit-power]`, `[data-circuit-rename]`, `[data-circuit-delete]`.
  - Editor: tool `[data-tool="circuits"]` (icon `bolt`, label "מעגלי תאורה"); in member mode a click on a lamp adds / removes it (an item that is not a light answers with a message); the selected circuit's lamps are highlighted.
  - Live map: `[data-circuit-strip]` with `[data-circuit-toggle=<id>]` buttons (name · lamps · state; disabled without `can_control`; the click sends the switch's `turn_on` / `turn_off` action through `trigger()`), `[data-circuit-status]` / `[data-circuit-error]` for the action's outcome.

- [ ] **Step 1: Failing node test (append to `unit-studio-ops-2.spec.ts`; add `addCircuit, circuitPower, patchCircuit, toggleCircuitMember` to the studio-ops import)**

```ts
  test('circuits: created with a switch entity, lamps toggled in and out (one circuit per lamp), power summed from the items', () => {
    const doc = sample();
    const r = addCircuit(doc, 'אולם צפון', 'switch.hall_b', 'circuit-2');
    expect(r.doc.circuits.find((k) => k.id === r.id)).toEqual({ id: r.id, name: 'אולם צפון', switch_entity_id: 'switch.hall_b', member_ids: [], color_token: 'circuit-2', power_w: 0 });
    const withLamp = toggleCircuitMember(r.doc, r.id, 'o3'); // o3 belongs to k1: it moves over
    expect(withLamp.circuits.find((k) => k.id === r.id)!.member_ids).toEqual(['o3']);
    expect(withLamp.circuits.find((k) => k.id === 'k1')!.member_ids).toEqual([]);
    expect(toggleCircuitMember(withLamp, r.id, 'o3').circuits.find((k) => k.id === r.id)!.member_ids).toEqual([]);
    const items = new Map(library.items.map((i) => [i.id, i]));
    const lookup = (id: string) => items.get(id);
    expect(circuitPower(withLamp, withLamp.circuits.find((k) => k.id === r.id)!, lookup)).toBe(36); // the item's default
    const boosted = patchObject(withLamp, 'o3', { params: { power_w: 60 } });
    expect(circuitPower(boosted, boosted.circuits.find((k) => k.id === r.id)!, lookup)).toBe(60); // the object's own value wins
    expect(patchCircuit(r.doc, r.id, { name: 'צפון', color_token: 'circuit-3' }).circuits.at(-1)).toMatchObject({ name: 'צפון', color_token: 'circuit-3' });
  });
```

Run → FAIL (`addCircuit` is not exported).

- [ ] **Step 2: Circuit operations (append to `studio-ops.ts`; add `type GeomCircuit` to the geometry import)**

```ts
// ---------------------------------------------------------------- circuits (T085)

export const CIRCUIT_COLORS = ['circuit-1', 'circuit-2', 'circuit-3', 'circuit-4', 'circuit-5', 'circuit-6'] as const;

export function addCircuit(doc: GeometryDoc, name: string, switchEntityId: string, colorToken: string): { doc: GeometryDoc; id: string } {
  const k: GeomCircuit = { id: newId(), name: name.trim(), switch_entity_id: switchEntityId, member_ids: [], color_token: colorToken, power_w: 0 };
  return { doc: { ...doc, circuits: [...doc.circuits, k] }, id: k.id };
}

export function patchCircuit(doc: GeometryDoc, id: string, patch: Partial<GeomCircuit>): GeometryDoc {
  return { ...doc, circuits: doc.circuits.map((k) => (k.id === id ? { ...k, ...patch, id: k.id } : k)) };
}

/** A lamp on the circuit leaves it; a lamp not on it joins (and leaves any other circuit: one switch per lamp). */
export function toggleCircuitMember(doc: GeometryDoc, circuitId: string, objectId: string): GeometryDoc {
  const k = doc.circuits.find((x) => x.id === circuitId);
  if (!k) return doc;
  const member = k.member_ids.includes(objectId);
  return { ...doc, circuits: doc.circuits.map((x) => (x.id === circuitId ? { ...x, member_ids: member ? x.member_ids.filter((m) => m !== objectId) : [...x.member_ids, objectId] } : { ...x, member_ids: x.member_ids.filter((m) => m !== objectId) })) };
}

/** The sum of the members' power: the object's params.power_w, else its item's default (what the server recomputes). */
export function circuitPower(doc: GeometryDoc, k: GeomCircuit, itemOfId: (id: string) => Pick<CatalogItem, 'params'> | undefined): number {
  let total = 0;
  for (const mid of k.member_ids) {
    const o = doc.objects.find((x) => x.id === mid);
    if (!o) continue;
    const own = o.params.power_w;
    const w = typeof own === 'number' ? own : (itemOfId(o.item_id)?.params.power_w as number | undefined);
    if (typeof w === 'number' && Number.isFinite(w)) total += w;
  }
  return Math.round(total * 1000) / 1000;
}
```

Run the node spec → `8 passed`.

- [ ] **Step 3: The icon and the panel**

`frontend/src/components/sw-icon.ts`: after the `stairs:` line add `  bolt: svg\`<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>\`,`.

`plan-studio-panel.ts`: add `type GeomCircuit` to the geometry import and `import type { HaEntity } from '../api/ha';`; append before `studioPanelStyles`:

```ts
// ---------------------------------------------------------------- circuits (T085)

export interface CircuitView {
  doc: GeometryDoc;
  sel: GeomCircuit | undefined;
  membersMode: boolean;
  power: (k: GeomCircuit) => number;
  creating: { name: string; q: string; results: HaEntity[]; entity: HaEntity | null; color: string; busy: boolean } | null;
  saveState: SaveState;
  colors: readonly string[];
}

export interface CircuitActions {
  select(id: string | null): void;
  startNew(): void;
  cancelNew(): void;
  setNew(patch: Partial<NonNullable<CircuitView['creating']>>): void;
  create(): void;
  patch(id: string, patch: Partial<GeomCircuit>): void;
  toggleMembers(): void;
  remove(id: string): void;
}

export function renderCircuitPanel(v: CircuitView, a: CircuitActions): TemplateResult {
  const c = v.creating;
  const sel = v.sel;
  return html`<sw-card heading="מעגלי תאורה" subheading=${v.membersMode ? 'לחץ על מנורות כדי להוסיף או להסיר מהמעגל' : 'כמה מנורות על ישות מפסק אחת ב־Home Assistant'} data-circuit-panel data-studio-save=${v.saveState}>
    ${v.doc.circuits.length
      ? html`<div class="list">${v.doc.circuits.map((k) => html`<button class=${sel?.id === k.id ? 'on' : ''} data-circuit-row=${k.id} style=${`border-inline-start: 4px solid var(--sw-${k.color_token})`} @click=${() => a.select(sel?.id === k.id ? null : k.id)}>
          <span>${k.name}</span><span class="note ltr" style="margin:0">${k.member_ids.length} · ${v.power(k)} W · ${k.switch_entity_id}</span>
        </button>`)}</div>`
      : html`<div class="note">עדיין אין מעגלים בקומה.</div>`}
    ${c
      ? html`<div class="sel" data-circuit-new-form>
          <sw-field label="שם המעגל"><input type="text" maxlength="80" data-circuit-name placeholder="למשל: אולם צפון" .value=${c.name} @input=${(e: Event) => a.setNew({ name: (e.target as HTMLInputElement).value })} /></sw-field>
          <sw-field label="ישות המפסק (switch / light)"><input type="search" data-ltr data-circuit-switch-q placeholder="חיפוש בקטלוג HA" .value=${c.q} @input=${(e: Event) => a.setNew({ q: (e.target as HTMLInputElement).value })} /></sw-field>
          <div class="list">${c.results.slice(0, 20).map((e) => html`<button class=${c.entity?.entity_id === e.entity_id ? 'on' : ''} data-circuit-switch=${e.entity_id} @click=${() => a.setNew({ entity: e })}><span>${e.name || e.original_name || e.entity_id}</span><span class="ltr">${e.entity_id}</span></button>`)}</div>
          <sw-field label="צבע"><select data-circuit-color @change=${(e: Event) => a.setNew({ color: (e.target as HTMLSelectElement).value })}>${v.colors.map((col, i) => html`<option value=${col} ?selected=${col === c.color}>מעגל ${i + 1}</option>`)}</select></sw-field>
          <div class="btns"><sw-button variant="primary" size="sm" icon="check" data-circuit-create ?disabled=${c.busy || !c.name.trim() || !c.entity} @click=${() => a.create()}>צור מעגל</sw-button><sw-button variant="ghost" size="sm" data-circuit-cancel @click=${() => a.cancelNew()}>ביטול</sw-button></div>
        </div>`
      : html`<div class="btns"><sw-button size="sm" icon="plus" data-circuit-new @click=${() => a.startNew()}>מעגל חדש</sw-button></div>`}
    ${sel && !c ? renderCircuitInspector(sel, v, a) : nothing}
  </sw-card>`;
}

function renderCircuitInspector(k: GeomCircuit, v: CircuitView, a: CircuitActions) {
  return html`<div class="sel" data-selected-circuit=${k.id} style=${`--kc: var(--sw-${k.color_token})`}>
    <div class="selhead"><strong>${k.name}</strong><span class="muted ltr">${k.switch_entity_id}</span></div>
    <div class="note"><span data-circuit-count>${countLabel(k.member_ids.length, 'מנורה אחת', 'מנורות')}</span> · <span data-circuit-power>${v.power(k)} W</span></div>
    <div class="two">
      <sw-field label="שם"><input type="text" maxlength="80" data-circuit-rename .value=${k.name} @change=${(e: Event) => { const x = (e.target as HTMLInputElement).value.trim(); if (x) a.patch(k.id, { name: x }); }} /></sw-field>
      <sw-field label="צבע"><select @change=${(e: Event) => a.patch(k.id, { color_token: (e.target as HTMLSelectElement).value })}>${v.colors.map((col, i) => html`<option value=${col} ?selected=${col === k.color_token}>מעגל ${i + 1}</option>`)}</select></sw-field>
    </div>
    <div class="btns">
      <sw-button size="sm" variant=${v.membersMode ? 'primary' : 'ghost'} icon="light" data-circuit-members aria-pressed=${v.membersMode} @click=${() => a.toggleMembers()}>${v.membersMode ? 'סיים בחירת מנורות' : 'הוסף / הסר מנורות'}</sw-button>
      <sw-button size="sm" variant="ghost" icon="trash" data-circuit-delete @click=${() => a.remove(k.id)}>מחק מעגל</sw-button>
    </div>
    <div class="note">המצב החי של המנורות נגזר מהמפסק; ההפעלה מהמפה החיה היא פעולת HA הקיימת, באותן הרשאות.</div>
  </div>`;
}
```

- [ ] **Step 4: The editor (`explore-plan-editor.ts`)**

Imports: add `CIRCUIT_COLORS, addCircuit, circuitPower, patchCircuit, toggleCircuitMember` to the studio-ops import; `renderCircuitPanel` to the panel import; `listEntities` is already imported from `../api/ha`.

Tools: `type Tool` gains `'circuits'` (after `'connectors'`); `TOOLS` gains `  { id: 'circuits', icon: 'bolt', label: 'מעגלי תאורה', ready: true },` after the connectors entry; `STUDIO_TOOLS` becomes `['structure', 'library', 'connectors', 'circuits', 'calibrate', 'measure']`.

State (after `linkBusy`):

```ts
  // ---- circuits (T085) ----
  @state() private circuitSel: string | null = null;
  @state() private membersMode = false;
  @state() private circuitNew: { name: string; q: string; results: HaEntity[]; entity: HaEntity | null; color: string; busy: boolean } | null = null;
  private circuitTimer = 0;
```

In `pickTool`, after the connectors lines add `    this.membersMode = false;\n    this.circuitNew = null;`; in `geomDragMode`, after the connectors line add `    if (this.tool === 'circuits') return 'objects';`.

In `onGeomSelect`, at the very top add:

```ts
    if (this.tool === 'circuits' && this.membersMode && kind === 'object' && this.circuitSel) {
      const doc = this.studio.doc;
      const lib = this.library;
      const o = doc?.objects.find((x) => x.id === id);
      const item = o && lib ? itemOf(lib, o.item_id) : undefined;
      if (item && item.role !== 'light') {
        this.info = `${item.names.he} אינו גוף תאורה`;
        setTimeout(() => (this.info = ''), 2500);
        return;
      }
      const cid = this.circuitSel;
      this.edit((d) => toggleCircuitMember(d, cid, id));
      return;
    }
```

Add after `renderConnectorTool`:

```ts
  private async searchSwitches(q: string) {
    try {
      const r = await listEntities({ q: q || undefined, limit: 200 });
      const results = r.entities.filter((e) => e.domain === 'switch' || e.domain === 'light').slice(0, 40);
      if (this.circuitNew) this.circuitNew = { ...this.circuitNew, results };
    } catch (err) {
      this.error = describeError(err);
    }
  }

  private createCircuit() {
    const doc = this.studio.doc;
    const c = this.circuitNew;
    if (!doc || !c?.entity) return;
    const r = addCircuit(doc, c.name, c.entity.entity_id, c.color);
    this.studio.commit(r.doc);
    this.circuitNew = null;
    this.circuitSel = r.id;
    this.membersMode = true;
    this.info = 'המעגל נוצר: לחץ על המנורות שלו';
    setTimeout(() => (this.info = ''), 4000);
  }

  private renderCircuitTool(b: MapBundle) {
    const doc = this.studio.doc;
    const lib = this.library;
    if (!doc) return html`<sw-card heading="מעגלי תאורה"><div class="note">${b.source === 'demo' ? 'נתוני הדגמה: המעגלים עובדים מול השרת.' : this.error || 'טוען…'}</div></sw-card>`;
    return renderCircuitPanel(
      { doc, sel: doc.circuits.find((k) => k.id === this.circuitSel), membersMode: this.membersMode, power: (k) => circuitPower(doc, k, (id) => (lib ? itemOf(lib, id) : undefined)), creating: this.circuitNew,
        saveState: this.studio.saveState, colors: CIRCUIT_COLORS },
      {
        select: (id) => {
          this.circuitSel = id;
          this.membersMode = false;
        },
        startNew: () => {
          this.circuitNew = { name: '', q: '', results: [], entity: null, color: CIRCUIT_COLORS[doc.circuits.length % CIRCUIT_COLORS.length], busy: false };
          void this.searchSwitches('');
        },
        cancelNew: () => (this.circuitNew = null),
        setNew: (patch) => {
          if (!this.circuitNew) return;
          this.circuitNew = { ...this.circuitNew, ...patch };
          if (patch.q !== undefined) {
            window.clearTimeout(this.circuitTimer);
            this.circuitTimer = window.setTimeout(() => void this.searchSwitches(patch.q ?? ''), 250);
          }
        },
        create: () => this.createCircuit(),
        patch: (id, patch) => this.edit((d) => patchCircuit(d, id, patch)),
        toggleMembers: () => (this.membersMode = !this.membersMode),
        remove: (id) => {
          this.edit((d) => removeItem(d, id));
          this.circuitSel = null;
          this.membersMode = false;
        },
      },
    );
  }
```

In `renderToolPanel`, after the connectors line add `    if (this.tool === 'circuits') return this.renderCircuitTool(b);`. In `render()`, replace the `.highlightIds=${…}` binding with:

```ts
 .highlightIds=${this.geomSel?.kind === 'group' ? (this.studio.doc?.groups.find((g) => g.id === this.geomSel!.id)?.member_ids ?? []) : this.tool === 'circuits' && this.circuitSel ? (this.studio.doc?.circuits.find((k) => k.id === this.circuitSel)?.member_ids ?? []) : []}
```

and after the connectors placing hint add `                ${this.tool === 'circuits' && this.membersMode ? html`<div class="placing-hint"><span>לחץ על מנורה כדי להוסיף או להסיר אותה מהמעגל</span></div>` : nothing}`.

- [ ] **Step 5: The live map — the circuit strip (`explore-floor-map.ts`)**

After `renderPanel()` add:

```ts
  /** T085: one button per lighting circuit of the published structure - its switch state, and the toggle through the
   * existing entity action path (the same permission, the same confirmation rules, the same audit). */
  private renderCircuitStrip() {
    const b = this.bundle;
    const states = b?.circuitStates ?? {};
    const ids = Object.keys(states);
    if (!b || !ids.length) return nothing;
    const act = this.action;
    return html`<div class="circuits" role="group" aria-label="מעגלי תאורה" data-circuit-strip>
      ${ids.map((id) => {
        const s = states[id];
        const on = s.state === 'on';
        const spec = s.actions.find((x) => x.id.endsWith(on ? 'turn_off' : 'turn_on'));
        return html`<button class="circuit ${on ? 'on' : ''}" data-circuit-toggle=${id} data-state=${s.state ?? 'unknown'} style=${`--kc: var(--sw-${s.color_token ?? 'circuit-1'})`} ?disabled=${!s.can_control || !spec}
            title=${s.can_control ? (on ? 'כיבוי המעגל' : 'הדלקת המעגל') : 'אין הרשאת שליטה בישויות בקומה'} @click=${() => { if (spec) this.trigger(s.entity_id, spec); }}>
          <i></i><span>${s.name ?? id}</span><span class="cnt">${s.member_ids.length} מנורות · ${s.state === null ? 'לא ידוע' : on ? 'דולק' : 'כבוי'}${s.power_w ? ` · ${s.power_w} W` : ''}</span>
        </button>`;
      })}
      ${act && ids.some((id) => states[id].entity_id === act.entityId)
        ? html`<span class="cstatus" data-circuit-status>${act.error ? html`<span class="err" data-circuit-error>${act.error}</span>` : act.record ? ACTION_STATUS_LABEL[act.record.status] + (act.record.error ? ` · ${ACTION_ERROR_LABEL[act.record.error] ?? act.record.error}` : '') : act.busy ? 'שולח…' : ''}</span>`
        : nothing}
    </div>`;
  }
```

In `renderStage`, after `      ${this.panel ? this.renderPanel() : nothing}` add `      ${this.renderCircuitStrip()}`. Styles (next to `.layers`):

```css
    .circuits {
      position: absolute;
      inset-inline-end: 12px;
      inset-block-start: 12px;
      display: flex;
      flex-direction: column;
      gap: 4px;
      z-index: var(--sw-z-map-ui);
      max-inline-size: 260px;
    }
    .circuits .circuit {
      display: grid;
      grid-template-columns: auto minmax(0, 1fr);
      grid-template-areas: "dot name" "dot cnt";
      gap: 0 8px;
      align-items: center;
      text-align: start;
      padding: 6px 10px;
      border: 1px solid var(--sw-border);
      border-radius: 10px;
      background: var(--sw-surface);
      box-shadow: var(--sw-shadow-1);
      font: inherit;
      font-size: var(--sw-fs-sm);
      color: var(--sw-text);
      cursor: pointer;
    }
    .circuits .circuit i {
      grid-area: dot;
      inline-size: 12px;
      block-size: 12px;
      border-radius: 50%;
      border: 2px solid var(--kc);
      background: transparent;
    }
    .circuits .circuit.on i {
      background: var(--sw-map-glow);
      box-shadow: 0 0 6px var(--sw-map-glow);
    }
    .circuits .circuit .cnt {
      grid-area: cnt;
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-2);
    }
    .circuits .circuit:disabled {
      cursor: not-allowed;
      opacity: 0.7;
    }
    .circuits .cstatus {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-2);
      background: var(--sw-surface);
      border-radius: 8px;
      padding: 4px 8px;
    }
    .circuits .err {
      color: var(--sw-danger);
    }
```

- [ ] **Step 6: The live test (append inside the `test.describe.serial` block)**

```ts
  test('eight lamps on two circuits glow on the live map when their switches are on; the toggle goes through the entity action path; the editor builds a circuit from the switch catalogue', async ({ page }) => {
    const lamp = (id: string, x: number, y: number) => OBJ(id, 'light.ceiling', [x, y], { size: { w_m: 0.4, d_m: 0.4, h_m: 0.1 }, z_m: 2.5 });
    const lamps = [0, 1, 2, 3].flatMap((i) => [lamp(`la${i}`, 0.15 + i * 0.05, 0.35), lamp(`lb${i}`, 0.15 + i * 0.05, 0.45)]);
    const g = await draft();
    await saveDraft({
      objects: [...g.doc.objects.filter((o) => o.item_id !== 'light.ceiling' || o.anchor_ref), ...lamps],
      circuits: [{ id: 'k-north', name: 'אולם צפון', switch_entity_id: 'switch.studio2_a', member_ids: ['la0', 'la1', 'la2', 'la3'], color_token: 'circuit-1', power_w: 0 },
                 { id: 'k-south', name: 'אולם דרום', switch_entity_id: 'switch.studio2_b', member_ids: ['lb0', 'lb1', 'lb2', 'lb3'], color_token: 'circuit-2', power_w: 0 }],
    });
    expect((await draft()).doc.circuits.find((k) => k.id === 'k-north')!.power_w).toBe(144); // 4 x 36 W, recomputed by the server
    await api.post('api/v1/ha/dev/states', { data: { states: [{ entity_id: 'switch.studio2_a', state: 'on', attributes: { friendly_name: 'מפסק צפון' } }, { entity_id: 'switch.studio2_b', state: 'off', attributes: { friendly_name: 'מפסק דרום' } }] } });
    await publish();
    await page.goto(`/?design=a#/explore/floors/${ids.floor}`);
    await expect(page.locator('explore-floor-map [data-circuit-strip] [data-circuit-toggle]')).toHaveCount(2, { timeout: 20000 });
    await expect(page.locator('explore-floor-map sw-plan-canvas [data-object][data-glow]')).toHaveCount(4);
    await expect(page.locator('explore-floor-map [data-circuit-toggle="k-north"]')).toHaveAttribute('data-state', 'on');
    // the second switch turns on: the push updates the map without a reload
    await api.post('api/v1/ha/dev/states', { data: { states: [{ entity_id: 'switch.studio2_b', state: 'on' }] } });
    await expect(page.locator('explore-floor-map sw-plan-canvas [data-object][data-glow]')).toHaveCount(8, { timeout: 15000 });
    // the toggle is the existing action route: the developer backend has no paired bridge, so the answer says so
    const action = page.waitForResponse((r) => r.url().includes('/ha/entities/switch.studio2_a/actions') && r.request().method() === 'POST');
    await page.locator('explore-floor-map [data-circuit-toggle="k-north"]').click();
    expect((await action).status()).toBe(503);
    await expect(page.locator('explore-floor-map [data-circuit-error]')).toContainText('גשר');
    // the editor: a circuit from the switch catalogue, one lamp added by clicking it, the power sum
    const ed = 'explore-plan-editor';
    await page.goto(`/?design=a#/explore/floors/${ids.floor}/edit`);
    await page.locator(`${ed} [data-tool="circuits"]`).click();
    await expect(page.locator(`${ed} [data-circuit-row]`)).toHaveCount(2, { timeout: 20000 });
    await page.locator(`${ed} [data-circuit-new]`).click();
    await page.locator(`${ed} [data-circuit-name]`).fill('גלריה');
    await page.locator(`${ed} [data-circuit-switch-q]`).fill('studio2_a');
    await page.locator(`${ed} [data-circuit-switch="switch.studio2_a"]`).click();
    await page.locator(`${ed} [data-circuit-create]`).click();
    await expect(page.locator(`${ed} [data-selected-circuit]`)).toBeVisible();
    await expect(page.locator(`${ed} [data-circuit-members]`)).toHaveAttribute('aria-pressed', 'true');
    await clickPlan(page, ed, 0.15, 0.45); // lb0 moves from the south circuit to the new one
    await expect(page.locator(`${ed} [data-circuit-count]`)).toContainText('מנורה אחת');
    await expect(page.locator(`${ed} [data-circuit-power]`)).toContainText('36');
    await expect.poll(async () => (await draft()).doc.circuits.find((k) => k.id === 'k-south')?.member_ids.length, { timeout: 10000 }).toBe(3);
  });
```

- [ ] **Step 7: Type-check, build, run**

Run (in `frontend/`): `npx tsc --noEmit -p tsconfig.json` → exit 0; `npx playwright test tests/unit-studio-ops-2.spec.ts --project=desktop --reporter=line` → `8 passed`; `npm run build`, `SW_LIVE=1 SW_CHROME=1 npx playwright test tests/evidence-plan-studio-2.spec.ts --project=desktop --workers=1 --reporter=line` → `6 passed`; `SW_LIVE=1 SW_CHROME=1 npx playwright test tests/evidence-ha.spec.ts tests/evidence-viewer.spec.ts --project=desktop --workers=1 --reporter=line` → as their baselines (BLOCKED lines that name the NVR / HA are environment, not this task); `bash "$SP/fixture_chain.sh"` → `129 passed`.

- [ ] **Step 8: Commit**

```bash
cd /c/cloude/smplwisebms && git add frontend/src/map/studio-ops.ts frontend/src/components/sw-icon.ts frontend/src/screens/plan-studio-panel.ts frontend/src/screens/explore-plan-editor.ts frontend/src/screens/explore-floor-map.ts frontend/tests/unit-studio-ops-2.spec.ts frontend/tests/evidence-plan-studio-2.spec.ts
git add docs/evidence/T007 2>/dev/null
msg=$(mktemp) && cat > "$msg" <<'EOF'
feat(plan-studio): lighting circuits - editor panel with the switch catalogue and lamp membership, live map glow and toggle through the entity action path (T085)

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOF
test "$(bash /c/cloude/smplwisebms/secrets/scan_staged.sh)" = 0 && git commit -F "$msg"
```

---
### Task 14: Global search focus on the floor, the phase acceptance spec (sports hall) and the phone rules

**Files:**
- Modify: `frontend/src/shell/sw-app.ts` (`?focus=object:<id>` → `focusObject`)
- Modify: `frontend/src/screens/explore-floor-map.ts` (`focusObject`: centre on the object and mark it selected)
- Test: `frontend/tests/evidence-plan-studio-2.spec.ts` (the acceptance test and the phone test)

**Interfaces:**
- Consumes: search results of kind `object` with route `/explore/floors/<fid>?focus=object:<id>` (Task 6 / 7); the floor map's `applyFocus` (phase 1), `geometry` and the canvas `selectedGeomId` (phase 1 / Task 8).
- Produces: `explore-floor-map.focusObject: string` (property), `[data-object=<id>].sel` on the live map after a search hit; the acceptance evidence of design section 14 phase 2 in one live test; the phone test (390 px): placing works, arrays and wall drawing answer with the in-page message.

- [ ] **Step 1: The failing tests (append inside the `test.describe.serial` block)**

```ts
  test('acceptance: the sports hall - tribune to -1.2 m, sixty chairs in one array, eight lamps on two circuits, "מטף" found by the global search and focused on the floor, a custom item exported', async ({ page }) => {
    const ed = 'explore-plan-editor';
    // sixty chairs in one array, published
    await page.goto(`/?design=a#/explore/floors/${ids.floor}/edit`);
    await page.locator(`${ed} [data-tool="library"]`).click();
    await page.locator(`${ed} [data-lib-search]`).fill('כיסא');
    await page.locator(`${ed} [data-lib-item="chair.basic"]`).click();
    await clickPlan(page, ed, 0.2, 0.4);
    await page.keyboard.press('Escape');
    await page.locator(`${ed} [data-object-array]`).click();
    await page.locator(`${ed} [data-array-rows]`).fill('6');
    await page.locator(`${ed} [data-array-cols]`).fill('10');
    await page.locator(`${ed} [data-array-sy]`).fill('0.6');
    await page.locator(`${ed} [data-array-create]`).click();
    await expect(page.locator(`${ed} [data-selected-group]`)).toContainText('60');
    // an extinguisher with a searchable label
    await page.locator(`${ed} [data-lib-search]`).fill('מטף');
    await page.locator(`${ed} [data-lib-item="extinguisher.co2"]`).click();
    await clickPlan(page, ed, 0.92, 0.2);
    await page.keyboard.press('Escape');
    await page.locator(`${ed} [data-object-label]`).fill('מטף כניסה');
    await page.locator(`${ed} [data-object-label]`).press('Enter');
    await page.locator(`${ed} [data-object-label]`).dispatchEvent('change');
    await expect(page.locator(`${ed} [data-library-panel][data-studio-save="saved"]`)).toHaveCount(1, { timeout: 10000 });
    const extId = (await draft()).doc.objects.find((o) => o.item_id === 'extinguisher.co2')!.id;
    await publish();
    // the published document carries the whole scenario
    const pub = (await (await api.get(`api/v1/plan-versions/${ids.version}/geometry`)).json()).doc as { levels: { id: string; elevation_m: number }[]; objects: { item_id: string; group_id: string | null }[]; groups: { member_ids: string[] }[]; connectors: { kind: string; level_to: string | null }[]; circuits: { member_ids: string[] }[] };
    expect(pub.levels.find((l) => l.id === 'L1')!.elevation_m).toBe(-1.2);
    expect(pub.connectors.some((c) => c.kind === 'tribune' && c.level_to === 'L1')).toBe(true);
    expect(pub.groups.some((g) => g.member_ids.length === 60)).toBe(true);
    expect(pub.circuits.filter((k) => k.member_ids.length >= 3).length).toBe(2); // north (4) and south (3); the gallery circuit of the previous test has one lamp
    expect(pub.objects.filter((o) => o.item_id === 'light.ceiling').length).toBeGreaterThanOrEqual(8);
    // the global search finds the extinguisher and the floor opens focused on it
    const hits = (await (await api.get('api/v1/search?q=מטף')).json()).results as { kind: string; id: string; route: string; title: string }[];
    const hit = hits.find((h) => h.kind === 'object' && h.id === extId)!;
    expect(hit.title).toBe('מטף כניסה');
    await page.goto(`/?design=a#/explore/floors/${ids.floor}`);
    await page.locator('sw-app .search input').fill('מטף');
    await expect(page.locator('sw-app .results .row', { hasText: 'מטף כניסה' })).toBeVisible();
    await page.locator('sw-app .results .row', { hasText: 'מטף כניסה' }).click();
    await expect(page).toHaveURL(new RegExp(`focus=object:${extId}`));
    await expect(page.locator(`explore-floor-map sw-plan-canvas [data-object="${extId}"].sel`)).toHaveCount(1, { timeout: 20000 });
    // the custom item made in the array test is in the export
    const exported = await (await api.get('api/v1/catalog/export')).json();
    expect(exported.items.some((i: { names: { he: string } }) => i.names.he === 'כיסא אולם')).toBe(true);
  });

  test.describe('on a phone', () => {
    test.use({ viewport: { width: 390, height: 844 } });

    test('viewing and placing a single object work; arrays and wall drawing say they are desktop only', async ({ page }) => {
      const ed = 'explore-plan-editor';
      await page.goto(`/?design=a#/explore/floors/${ids.floor}`);
      await expect(page.locator('explore-floor-map sw-plan-canvas [data-object]').first()).toBeAttached({ timeout: 20000 });
      await page.goto(`/?design=a#/explore/floors/${ids.floor}/edit`);
      await page.locator(`${ed} [data-tool="library"]`).click();
      await page.locator(`${ed} [data-lib-search]`).fill('כיסא');
      await page.locator(`${ed} [data-lib-item="chair.basic"]`).click();
      const before = await page.locator(`${ed} sw-plan-canvas [data-object]`).count();
      await clickPlan(page, ed, 0.5, 0.5);
      await expect(page.locator(`${ed} sw-plan-canvas [data-object]`)).toHaveCount(before + 1);
      await expect(page.locator(`${ed} [data-object-array]`)).toBeDisabled();
      await expect(page.locator(`${ed} [data-library-panel]`)).toContainText('בטלפון');
      await page.locator(`${ed} [data-tool="structure"]`).click();
      await page.locator(`${ed} [data-studio-mode="wall"]`).click();
      await expect(page.locator(`${ed} .bar`)).toContainText('בדסקטופ בלבד');
      await expect(page.locator(`${ed} [data-studio-mode="wall"]`)).toHaveAttribute('aria-pressed', 'false');
    });
  });
```

Run: `npm run build && SW_LIVE=1 SW_CHROME=1 npx playwright test tests/evidence-plan-studio-2.spec.ts --project=desktop --workers=1 --reporter=line`
Expected: the acceptance test FAILS at the focus assertion (`[data-object=…].sel` count 0: the floor screen ignores `?focus=`); the phone test passes already.

- [ ] **Step 2: The route and the focus**

`frontend/src/shell/sw-app.ts`: replace the `explore-floor-map` route line with:

```ts
        const focus = r.params.get('focus') ?? '';
        return html`<explore-floor-map .floorId=${floorId} .screenState=${screenState} .focusZone=${r.params.get('zone') ?? ''} .focusCamera=${r.params.get('camera') ?? ''} .focusEntity=${r.params.get('entity') ?? ''} .focusObject=${focus.startsWith('object:') ? focus.slice('object:'.length) : ''}></explore-floor-map>`;
```

`frontend/src/screens/explore-floor-map.ts`: after `  @property() focusEntity = '';` add `  /** A global search hit of kind object (T085): the object to centre on and mark. */\n  @property() focusObject = '';\n  @state() private focusedObjectId: string | null = null;`; in `updated()`, replace `    } else if ((changed.has('focusZone') || changed.has('focusCamera') || changed.has('focusEntity')) && this.bundle) {` with `    } else if ((changed.has('focusZone') || changed.has('focusCamera') || changed.has('focusEntity') || changed.has('focusObject')) && this.bundle) {`; in `applyFocus`, replace `    if (!b || (!this.focusZone && !this.focusCamera && !this.focusEntity)) return;` with `    if (!b || (!this.focusZone && !this.focusCamera && !this.focusEntity && !this.focusObject)) return;` and append at the end of `applyFocus` (after the `if (a) { … }` block):

```ts
    if (this.focusObject) {
      const o = this.geometry?.objects.find((x) => x.id === this.focusObject);
      if (!o) return; // the document arrives after the bundle: the geometry load calls applyFocus again
      this.focusedObjectId = o.id;
      canvas.centerOn(o.position[0], o.position[1]);
    }
```

In `load()`, replace `        if (seq === this.geomSeq) this.geometry = g; // live HA updates replace the bundle object: compare loads, not objects` with:

```ts
        if (seq === this.geomSeq) {
          this.geometry = g; // live HA updates replace the bundle object: compare loads, not objects
          if (this.focusObject) void this.applyFocus();
        }
```

and on the canvas element in `renderStage` add ` .selectedGeomId=${this.focusedObjectId}` after `.hideConnectors=${…}`. In `onSelect` (a pin was picked) add as its first line `    this.focusedObjectId = null;`.

- [ ] **Step 3: Type-check, build, run**

Run (in `frontend/`): `npx tsc --noEmit -p tsconfig.json` → exit 0; `npm run build`; `SW_LIVE=1 SW_CHROME=1 npx playwright test tests/evidence-plan-studio-2.spec.ts --project=desktop --workers=1 --reporter=line` → `8 passed` (seven desktop tests and the phone test); `SW_LIVE=1 SW_CHROME=1 npx playwright test tests/evidence-search.spec.ts tests/evidence-spatial-search.spec.ts --project=desktop --workers=1 --reporter=line` → as their baselines.

- [ ] **Step 4: Commit**

```bash
cd /c/cloude/smplwisebms && git add frontend/src/shell/sw-app.ts frontend/src/screens/explore-floor-map.ts frontend/tests/evidence-plan-studio-2.spec.ts
msg=$(mktemp) && cat > "$msg" <<'EOF'
feat(plan-studio): a global search hit opens the floor focused on the object; phase 2 acceptance and phone live tests (T085)

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOF
test "$(bash /c/cloude/smplwisebms/secrets/scan_staged.sh)" = 0 && git commit -F "$msg"
```

---
### Task 15: Release 0.1.84 — full verification, version, changelog, records, owner checklist, design line (stop after the release commit)

**Files:**
- Modify: `smplwise_vms/config.yaml`, `smplwise_vms/Dockerfile`, `smplwise_vms/backend/smplwise/__init__.py` (0.1.84)
- Modify: `smplwise_vms/CHANGELOG.md`, `contracts/API_INVENTORY.md` (generated), `smplwise_vms/www/` (generated by `build:addon`)
- Modify: `management/tasks.json`, `management/test_catalog.json` and the generated views (`scripts/project_status.py --write`)
- Create: `docs/operations/PLAN_STUDIO_PHASE2_CHECKLIST_HE.md`
- Modify: `docs/architecture/PLAN_STUDIO_DESIGN_HE.md` (implementation line), `docs/security/HA_IDENTITY_RBAC_HE.md` (the new permission)

**Interfaces:**
- Consumes: everything above.
- Produces: add-on 0.1.84 on the branch `pilot/T085-plan-studio-2` (one release commit; NO merge, NO push, NO HA store reload - the controller does those after the whole-branch review); T085 evidenced "on commit <sha>" and left BACKLOG (its dependency T084 is BACKLOG, so the registry refuses DONE); AT169 / AT170 recorded for what the tests exercised.

- [ ] **Step 1: Version bump and the generated API inventory**

```bash
cd /c/cloude/smplwisebms && cur=$(grep -oE '^version: "0\.1\.[0-9]+"' smplwise_vms/config.yaml | grep -oE '0\.1\.[0-9]+') && echo "from $cur"
sed -i "s/^version: \"$cur\"/version: \"0.1.84\"/" smplwise_vms/config.yaml
sed -i "s/io.hass.version=\"$cur\"/io.hass.version=\"0.1.84\"/" smplwise_vms/Dockerfile
sed -i "s/__version__ = \"$cur\"/__version__ = \"0.1.84\"/" smplwise_vms/backend/smplwise/__init__.py
grep -c '0\.1\.84' smplwise_vms/config.yaml smplwise_vms/Dockerfile smplwise_vms/backend/smplwise/__init__.py
MSYS_NO_PATHCONV=1 $PY C:/cloude/smplwisebms/scripts/api_inventory.py && head -3 contracts/API_INVENTORY.md
```

Expected: `from 0.1.83` (the hotfix's version; `0.1.82` if it shipped without a bump - either way the three files now say 0.1.84 and each reports `1`); the inventory is rewritten at 0.1.84 with 8 more routes than before (catalog objects GET / POST / PATCH / DELETE, catalog export, catalog import, geometry link, ha dev states).

- [ ] **Step 2: The whole backend suite and the golden file**

```bash
cd /c/cloude/smplwisebms/smplwise_vms/backend && MSYS_NO_PATHCONV=1 $PY -m pytest -p no:cacheprovider > "$SP/pytest_0184.txt" 2>&1; echo "exit $?"; tail -n 3 "$SP/pytest_0184.txt"
MSYS_NO_PATHCONV=1 $PY C:/cloude/smplwisebms/scripts/geometry_golden.py --check; echo "golden $?"
```

Expected: `exit 0` and `N passed` with N = the baseline of Task 1 Step 0 + 32 (Task 1: 4, Task 2: 3 in the new file + 1 appended to `test_plan_geometry_integration.py`, Task 3: 7, Task 4: 9, Task 5: 3, Task 6: 5; modified tests keep their count); if the number differs, count the new tests and explain the difference in the evidence line; `golden 0`.

- [ ] **Step 3: The whole frontend check**

In `frontend/`:
- `npx tsc --noEmit -p tsconfig.json` → exit 0
- `npx playwright test tests/unit-geometry.spec.ts tests/unit-geometry-2.spec.ts tests/unit-studio-controller.spec.ts tests/unit-studio-ops-2.spec.ts --project=desktop --reporter=line` → `32 passed` (19 phase-1 + 5 + 8)
- `npm run build`, then `bash "$SP/restart_dev.sh"` (prints `me: 200` and the new listener pid)
- `SW_LIVE=1 SW_CHROME=1 npx playwright test tests/evidence-plan-studio-2.spec.ts --project=desktop --workers=1 --reporter=line > "$SP/live_0184.txt"; tail -n 3 "$SP/live_0184.txt"` → `8 passed`
- `SW_LIVE=1 SW_CHROME=1 npx playwright test tests/evidence-plan-studio.spec.ts tests/evidence-editor.spec.ts tests/evidence-plan-versions.spec.ts tests/evidence-history-map.spec.ts tests/evidence-zones.spec.ts tests/evidence-zone-vertices.spec.ts tests/evidence-viewer.spec.ts tests/evidence-search.spec.ts tests/evidence-ha.spec.ts --project=desktop --workers=1 --reporter=line > "$SP/neighbours_0184.txt"` → the same results as the Task 8 / 11 / 13 baselines; a failure that also fails in the baseline and names the NVR / go2rtc / HA (ConnectTimeout, source_unavailable) is BLOCKED, anything else is fixed before continuing
- `bash "$SP/fixture_chain.sh"` → `fixtures exit: 0`, `129 passed`
- `npm run build:addon` → writes `smplwise_vms/www`

- [ ] **Step 4: CHANGELOG**

Insert at the top of `smplwise_vms/CHANGELOG.md`, right after the `# Changelog — SMPLWISE VMS add-on` line and its blank line:

```markdown
## 0.1.84 (pilot) — Plan Studio phase 2: the object library, levels and connectors, lighting circuits, objects in the search
- The plan editor gains three tools (T085, CR-003): **ספריית עצמים** - 153 built-in items in 12 categories (structure,
  circulation, seating, storage, lighting, electrical, safety, medical, sport, office / kitchen / sanitary, security,
  outdoor) with Hebrew and English search, recents and favourites per browser, placing by click or drag, handles to
  move, rotate and stretch (Shift keeps the ratio), Alt + drag duplicates, arrow keys nudge, an **array** of rows ×
  columns in one group (moved as one; deleting asks whether the members go too, in an in-page dialog), custom items
  made from an object ("צור פריט מזה", based on the built-in item) and the export / import of the custom library;
  **מפלסים ומחברים** - level chips over the canvas (all levels / one), an add-level dialog, a level on every wall,
  object, label, room and pin, stairs / ramp / elevator / ladder drawn with two clicks between levels, a tribune that
  connects levels derives its connector on save and publish, "קשר לקומה" puts stairs on the other floor's draft under
  the same id; **מעגלי תאורה** - a circuit is one Home Assistant switch (chosen from the synced catalogue) and its
  lamps (clicked in and out), with the power sum.
- Every map shows the objects and connectors (layers "עצמים" and "מחברים" on the live map, the history map at the
  chosen instant, the event page, the Lovelace card): a category symbol inside a rotated footprint, a level delta on
  every connector ("↓ −1.2 מ׳"); the lamps of a circuit glow while its switch is on, and the live map's circuit
  buttons toggle the switch through the existing entity action route with its existing permission. A level filter on
  the live map follows the published levels.
- An object that represents an entity is the body of its anchor: dropped near a matching anchor it offers "הצמד
  לישות", then takes its position and rotation from the anchor on every save and publish; deleting the anchor leaves
  the object unbound where it was.
- The global search finds objects of published structures by their label or library name ("מטף") and opens the floor
  focused on the object.
- Exports: SVG / PNG draw objects and connectors and take `?layers=structure,objects,labels,connectors`; backups
  include the custom items.
- New permission `catalog.manage` (editor, site admin, system admin): custom items and the library export / import,
  with audit `catalog.item.create / update / delete` and `catalog.import`. Storage: migration 0020 (`catalog_items`),
  additive; 8 new API routes; `/floors/{id}/map` carries `catalog_revision`, `levels` and `circuit_states`.
- Phone: everything is viewable and single objects are placed and moved; arrays and wall drawing say they are desktop
  only. Developer backends (never the add-on) get `POST /ha/dev/states` to simulate entity states for the live specs.
- Evidence: six new backend test files, two node unit specs, the live spec `evidence-plan-studio-2` (eight tests in
  real Chrome, one at phone width).

```

- [ ] **Step 5: Records (only after Steps 2–3 are green)**

```bash
cd /c/cloude/smplwisebms && cat > "$SP/record_t085.py" <<'EOF'
"""Record the Plan Studio phase 2 evidence (T085 and its acceptance tests) at the tested commit. T085 stays BACKLOG:
its dependency T084 is BACKLOG and the registry refuses DONE while a dependency is not DONE. Usage:
record_t085.py <pytest output file> <live spec output file>"""
import datetime
import json
import pathlib
import re
import subprocess
import sys

ROOT = pathlib.Path(r"C:\cloude\smplwisebms\management")
summary = re.search(r"(\d+) passed", pathlib.Path(sys.argv[1]).read_text(encoding="utf-8", errors="replace"))
live = re.search(r"(\d+) passed", pathlib.Path(sys.argv[2]).read_text(encoding="utf-8", errors="replace"))
if not summary or not live:
    sys.exit("no summary line in " + sys.argv[1] + " / " + sys.argv[2])
N, L = summary.group(1), int(live.group(1))
commit = subprocess.check_output(["git", "rev-parse", "--short", "HEAD"], text=True, cwd=ROOT.parent).strip()
today = datetime.date.today().isoformat()
now = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
env = f"workstation: dev backend 0.1.84 (SQLite) on 8099 + vite preview 4173, Chrome through Playwright; pytest on Python 3.12 ({today})"
tasks = json.loads((ROOT / "tasks.json").read_text(encoding="utf-8"))
tests = json.loads((ROOT / "test_catalog.json").read_text(encoding="utf-8"))
by_task = {t["id"]: t for t in tasks}
by_test = {t["id"]: t for t in tests}

t085 = (f"{today} (0.1.84): Plan Studio phase 2 on commit {commit} - migration 0020 (catalog_items, in backups), the built-in library "
        "smplwise_vms/backend/smplwise/catalog/objects.json (153 items in 12 categories, 24 symbols), the library API (GET /catalog/objects, custom items with "
        "based_on, export / import, permission catalog.manage on editor / site_admin / system_admin, audit catalog.item.* and catalog.import), document rules "
        "for objects / groups / connectors / circuits (a missing item is a geometric error), normalize (circuit power, derived tribune connectors), bound "
        "objects refreshed from their anchor on save and publish and un-bound when the anchor goes, the cross-floor connector link, circuit switch states and "
        "levels in the map bundle (circuit switches count as placements for scope), objects in the global search, the developer-only state route; the "
        "renderer and geometry.ts draw objects and connectors from the same primitives (golden fixture: 24 / 7), SVG / PNG ?layers=; the editor: library "
        "panel, placing, handles, arrays and groups, custom items, levels, connectors, circuits; the live map: object and connector layers, level chips, "
        f"circuit glow and toggle, ?focus=object. Tests: {N} backend passed (6 new files), 32 node unit tests, evidence-plan-studio-2 {L}/8 live in real Chrome "
        "(the circuit toggle reaches the entity action route and gets bridge_not_paired on the developer backend: no Home Assistant bridge in the lab run), "
        "fixture chain 129. Left for the next phases: 3D (T087), detection (T086), DXF / package exports of objects (T088). Recorded while BACKLOG: T084 is BACKLOG.")
t = by_task["T085"]
t["evidence"].append(t085)
t["commit"] = commit
t["owner"] = t["owner"] or "Claude Code (tech lead); approver: product owner"

EVIDENCE = {
    "AT169": ["smplwise_vms/backend/tests/test_plan_catalog.py, test_plan_catalog_api.py (153 items, 12 categories, custom items, export / import, catalog.manage)",
              "smplwise_vms/backend/tests/test_plan_geometry_binding.py (the body of an anchor: position from the anchor on save and publish, un-binding)",
              "frontend/tests/unit-geometry-2.spec.ts, unit-studio-ops-2.spec.ts (primitives vs the golden, search, placing, rotate, stretch, arrays)",
              "frontend/tests/evidence-plan-studio-2.spec.ts (library search he / en, placing, handles, duplicate, sixty chairs in one array, custom item exported, the body offer)"],
    "AT170": ["smplwise_vms/backend/tests/test_plan_geometry_objects.py, test_plan_geometry_render2.py (levels, connectors with the level delta, derived tribune connector)",
              "smplwise_vms/backend/tests/test_plan_circuits_search.py (circuit states in the bundle, control through the entity action route, zones and anchors on a level, objects in the search)",
              "frontend/tests/evidence-plan-studio-2.spec.ts (a level at -1.2 m with a tribune connector on the live map, stairs linked to a second floor, eight lamps on two circuits glowing by simulated switch states, the toggle through the action route, search focus)"],
}
for aid, ev in EVIDENCE.items():
    x = by_test[aid]
    if L == 8:
        x.update({"status": "PASS", "commit": commit, "environment": env, "evidence": ev, "executed_at": now})
    else:
        x["evidence"] = [f"partial ({today}, 0.1.84, on commit {commit}): live spec {L}/8 - see the run log", *ev]
        x["status"] = "NOT_RUN"

(ROOT / "tasks.json").write_text(json.dumps(tasks, ensure_ascii=False, indent=2) + "\n", encoding="utf-8", newline="\n")
(ROOT / "test_catalog.json").write_text(json.dumps(tests, ensure_ascii=False, indent=2) + "\n", encoding="utf-8", newline="\n")
print("recorded at", commit, "live", L)
EOF
$PY "$SP/record_t085.py" "$SP/pytest_0184.txt" "$SP/live_0184.txt" && MSYS_NO_PATHCONV=1 $PY C:/cloude/smplwisebms/scripts/project_status.py --write
```

Expected: `recorded at <sha> live 8` and `PASS: planning registry links, dependency graph and original design hashes; …`. If any check in Steps 2–3 is not green, do not run the script: set T085 to `BLOCKED` with the failing check as `blocker` and report it.

- [ ] **Step 6: Owner checklist, the design line, the security note**

Create `docs/operations/PLAN_STUDIO_PHASE2_CHECKLIST_HE.md`:

```markdown
# סטודיו התוכנית — שלב 2: בדיקה אצל הבעלים (גרסה 0.1.84)

לכל סעיף: עבר / נכשל, והערה קצרה אם משהו לא נוח. אין צורך ב־NVR; מספיקה קומה עם תוכנית מכוילת, ולסעיפים 12–14 גם
ישות מפסק (switch או light) ב־Home Assistant.

| # | מה עושים | מה אמור לקרות |
|---|---|---|
| 1 | "בדוק עדכון" בחנות התוספים ועדכון ל־0.1.84 | הגרסה מותקנת והמערכת עולה; המבנה של שלב 1 נשאר כפי שהיה |
| 2 | קומה ← עריכה ← הכלי "ספריית עצמים"; חיפוש "כיסא" ואז "chair" | אותה רשימה בשתי השפות; הקטגוריות כצ׳יפים ("הכול", "לאחרונה", "מועדפים", 12 קטגוריות) |
| 3 | לחיצה על "כיסא" ואז לחיצה על התוכנית (או גרירה של הפריט אל התוכנית) | הכיסא מוצב; מעבר לכלי "מבנה" מראה בכותרת המשנית "הטיוטה נשמרה" תוך שניות; חזרה לספרייה: "לאחרונה" מכיל את הכיסא; ★ מוסיף למועדפים |
| 4 | גרירת העצם; גרירת הידית העגולה (סיבוב); גרירת ריבוע בקצה (מתיחה, Shift שומר יחס); Alt+גרירה; חצים | העצם זז, מסתובב ונמתח; Alt+גרירה יוצר עותק; החצים מזיזים בעדינות (Shift = צעד גדול); Delete מוחק; Ctrl+Z מחזיר |
| 5 | בחירת כיסא ← "מערך" ← 6 שורות × 10 עמודות ← "צור מערך" | 60 כיסאות במערך אחד; גרירת אחד מהם מזיזה את כולם; Delete פותח שאלה "מחק הכול / השאר את העצמים" (לא חלון של הדפדפן) |
| 6 | בחירת עצם ← "צור פריט מזה" ← שם ← "צור פריט"; חיפוש השם בספרייה | הפריט המותאם נמצא (מסומן "מותאם"); "ייצוא הספרייה המותאמת" מוריד JSON; "ייבוא" של אותו קובץ מדווח "0 יובאו, N הוחלפו" |
| 7 | צ׳יפ "מפלס" מעל המפה ← שם "אולם תחתון", גובה רצפה −1.2, תקרה 6 ← "הוסף מפלס" | צ׳יפ חדש; בחירתו מסתירה את מה שבמפלס הראשי; "כל המפלסים" מחזיר |
| 8 | הצבת "טריבונה" מהספרייה; בפאנל: "מחברת למפלס" ← אולם תחתון | על התוכנית מופיע מחבר עם חץ ותווית "↓ −1.2 מ׳"; אחרי "פרסום המבנה" הוא מופיע גם במפה החיה |
| 9 | הכלי "מפלסים ומחברים" ← "מדרגות" ← שתי לחיצות על התוכנית ← "למפלס": אולם תחתון | מדרגות עם תווית הפרש הגובה; גרירת פינה מזיזה אותן |
| 10 | באותן מדרגות: "קשר לקומה" ← קומה אחרת במבנה ← "קשר" | ההודעה מאשרת; בעורך של הקומה השנייה אותן מדרגות מופיעות בטיוטה (אותו מזהה), התווית "↕" |
| 11 | חדר (הכלי "חדרים ואזורים") ומצלמה / ישות: שדה "מפלס" בפאנל | ניתן לשייך למפלס; במפה החיה צ׳יפ המפלס מסנן גם סיכות |
| 12 | הכלי "מעגלי תאורה" ← "מעגל חדש" ← שם ← חיפוש המפסק ב־HA ← "צור מעגל"; לחיצה על 4 מנורות (מהספרייה: "מנורת תקרה") | המנורות מצטרפות (מסומנות בצבע המעגל), הספק מסתכם (36 W לכל מנורה); "פרסום המבנה" |
| 13 | המפה החיה של הקומה; הדלקת המפסק מ־Home Assistant | המנורות של המעגל זוהרות; בכפתור המעגל (ימין למעלה) "דולק"; כיבוי ב־HA מכבה אותן |
| 14 | לחיצה על כפתור המעגל במפה החיה | אותה פעולה כמו בכרטיס ישות: נשלחת דרך הגשר, מוצג "נשלח · ממתין לעדכון" ואז "אושר"; משתמש ללא הרשאת שליטה רואה את הכפתור מעומעם |
| 15 | מנורת תקרה מהספרייה שמונחת על סיכה של ישות light | מוצע "הצמד לישות"; אחרי האישור העצם "הגוף של …": המיקום נלקח מהסיכה, הזזת הסיכה בעורך הסיכות מזיזה אותו אחרי שמירה |
| 16 | הצבת "מטף" עם שם "מטף כניסה" ← "פרסום המבנה"; חיפוש "מטף" בשורת החיפוש העליונה | תוצאה מסוג "עצם"; לחיצה פותחת את הקומה ממורכזת על המטף (מסומן) |
| 17 | המפה החיה: כפתורי השכבות "עצמים" ו"מחברים"; פאנל "שכבות" | כל כפתור מסתיר ומחזיר רק את השכבה שלו; הבחירה נשמרת לקומה |
| 18 | בפאנל המבנה: SVG ו־PNG; בדפדפן: `…/export.svg?layers=structure` | ה־SVG מכיל עצמים (סמלים), מחברים ותוויות; עם `layers=structure` רק קירות ופתחים |
| 19 | טלפון (או חלון צר): המפה החיה והעורך | הכול נראה; הצבה והזזה של עצם בודד עובדות; "מערך" מעומעם; מצב "קיר" מודיע "זמין בדסקטופ בלבד" |
| 20 | הגדרות ← משתמשים ותפקידים ← תפקיד מותאם | ההרשאה "ניהול ספריית העצמים" מופיעה ברשימה; עורך / מנהל אתר / מנהל מערכת מחזיקים אותה |
| 21 | אופציונלי: גיבוי ושחזור של הפרויקט | הפריטים המותאמים חוזרים עם המבנה |

**חשוב לדעת:** תלת־ממד, זיהוי אוטומטי וייצוא DXF של עצמים הם השלבים הבאים (T086–T088). מחבר של טריבונה נוצר לבד
מהעצם ואינו ניתן לעריכה ישירה; מדרגות שקושרו לקומה אחרת מציגות "↕" במקום הפרש גובה. פריט מותאם שנמחק מהספרייה
בזמן שעצמים משתמשים בו מסומן באדום ("לא קיים בספרייה") וחוסם פרסום עד להחלפתו.
```

In `docs/architecture/PLAN_STUDIO_DESIGN_HE.md`, after the line `**מימוש:** שלב 1 (T084) מומש בגרסה 0.1.82; רשימת הבדיקה לבעלים: \`docs/operations/PLAN_STUDIO_PHASE1_CHECKLIST_HE.md\`.` add a blank line and:

```markdown
**מימוש:** שלב 2 (T085) מומש בגרסה 0.1.84; רשימת הבדיקה לבעלים: `docs/operations/PLAN_STUDIO_PHASE2_CHECKLIST_HE.md`. סטיות מסעיפים 4–8 שנרשמו במימוש: העמודות של `catalog_items` הן `names_json`, `tags_json`, `size_json`, `params_json` (במקום `name_he` / `name_en` / `size_w_m` ועוד), ובלי `revision` ו־`deleted_at` (מחיקה היא מחיקה); לעצם `item_id` אחד (מובנה או מותאם) במקום `catalog_id` + `custom_item_id`; למעגל `switch_entity_id` (מזהה הישות) במקום `switch_ref`, ו־`power_w` המחושב בשרת; למחבר `polyline` ו־`object_id`; ההרשאה `catalog.manage` נבדקת בכל היקף שבו היא מוחזקת (הספרייה משותפת למתקן); התלת־ממד נשאר לשלב 4.
```

In `docs/security/HA_IDENTITY_RBAC_HE.md`, before the line `## 6. חברות מרובה והכרעת הרשאות` add:

```markdown
עדכון 2026-09-25 (0.1.84, T085): הרשאה חדשה `catalog.manage` — ניהול ספריית העצמים המותאמת של המתקן (יצירה, עריכה, מחיקה, ייצוא וייבוא של פריטים). מוחזקת על ידי `editor`, `site_admin` ו־`system_admin`; לא על ידי צופה, מפעיל או קיוסק. הספרייה משותפת למתקן, ולכן ההרשאה מכובדת בכל היקף שבו היא מוחזקת (עורך של קומה אחת מנהל את הספרייה); ההפעלה של מעגל תאורה מהמפה החיה אינה הרשאה חדשה — היא `ha.entity.control` בהיקף הקומה דרך נתיב פעולת הישות הקיים, והמפסק של מעגל במסמך מפורסם נחשב "מוצב" על הקומה לצורך ההיקף.

```

- [ ] **Step 7: The release commit — and stop**

```bash
cd /c/cloude/smplwisebms && git add -A
test "$(bash /c/cloude/smplwisebms/secrets/scan_staged.sh)" = 0 || echo "SECRET SCAN FAILED - do not commit"
git status --short | head -60
msg=$(mktemp) && cat > "$msg" <<'EOF'
release: 0.1.84 - Plan Studio phase 2 (T085, CR-003): object library, levels and connectors, lighting circuits, objects in the search

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOF
test "$(bash /c/cloude/smplwisebms/secrets/scan_staged.sh)" = 0 && git commit -F "$msg"
git log --oneline -1
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/dev_cleanup.ps1 -StopBackend
MSYS_NO_PATHCONV=1 $PY C:/cloude/smplwisebms/scripts/progress.py
```

Expected: `git status` shows only this plan's files (no `private-evidence/`, `secrets/` or `data/`); the scan prints `0`; the release commit is the branch head. **Stop here**: no `git merge`, no `git push`, no HA store reload - the controller performs them after reviewing the whole branch. The closing report lists the release commit sha, the pytest count, the live spec count, the neighbour results and the progress table.

---

## Self-Review

**1. Spec coverage** (design `PLAN_STUDIO_DESIGN_HE.md`, phase 2 of section 14, and the rulings):

| Design / ruling | Where |
|---|---|
| 2a rules 1–3: object ↔ anchor (body), circuits = one switch entity + lamps, levels also for anchors | Tasks 5 (binding), 6 / 13 (circuits), 6 / 11 (levels on zones and anchors) |
| 2a table: live map, editor, history map, event page, Lovelace (same floor screen), global search, backups, phone | Tasks 8 (every surface), 9–13 (editor), 6 / 14 (search), 2 (backups), 9 / 14 (phone) |
| 4.1 `catalog_items` (0020) | Task 1 (columns as ruling 3, recorded as a deviation from the design's column names in Task 15's design line) |
| 4.2 objects, circuits, connectors, groups, levels in v2; validation rules; conversions | Tasks 3, 4 (metres ↔ px in the primitives) |
| 4.3 built-in library, search, custom items with "based on", export / import | Tasks 1, 2, 7 (client search), 9, 10 |
| 5 `GET /catalog/*`, `catalog_revision`, `?layers=`, search objects | Tasks 2, 4, 6 |
| 7 object tool (place / rotate / stretch / Shift ratio / Alt duplicate / arrows), array, level chips + add level, circuits panel; phone | Tasks 9, 10, 11, 13, 14 |
| 7 rendering: symbol in a rotated footprint, glow when on, connector arrow + "↓ −1.2 מ׳", same code in Python (exports) | Tasks 4, 7, 8 |
| 8 levels and connectors: default 0 / 2.8, tribune derives a connector on publish, cross-floor stairs share one id | Tasks 3 (normalize), 5 (store + link), 11, 12 |
| 12 permissions: `catalog.manage` on editor / site_admin / system_admin, matrix, roles.json, security doc; circuit control = existing HA actions | Tasks 2, 6, 13, 15 |
| 13 tests: golden fixture, unit, live (placing with search, array, level, circuit, export) | Tasks 4, 7, 9–14 |
| 14 acceptance: tribune to −1.2, 60 chairs in one array, 8 lamps on 2 circuits glowing by the switch, search "מטף" focused, custom item exported | Task 14 (one live test) with Tasks 11, 10, 13, 6, 10 |
| 16 decisions 2, 5, 10, 11 | Tasks 3 (0–1 + metres), 1 / 2 (JSON + table + based_on), 5 (anchor source of truth), 6 (bundle keeps the reference; levels and circuit states are small derived data) |
| Rulings 1–14 | 1: Tasks 4, 7, 8; 2: Task 1 (+ symbols 4, 8); 3: Task 2; 4: Tasks 3, 5, 9; 5: Task 10; 6: Tasks 6, 11; 7: Tasks 3, 5, 12; 8: Tasks 6, 13; 9: Tasks 6, 14; 10: Tasks 4, 2, 9, 14; 11: Task 3 (+ COLL_LABEL already lists the collections; Task 11's test sees the rows); 12: Task 15; 13: every task; 14: Task 6 |

Recorded interpretations: `catalog.manage` is honoured at any scope where it is held (the library is installation-wide, and the design grants it to `editor`, who is usually floor-scoped); a connector derived from an object is regenerated on every save (not only on publish), so the draft and the published document agree; the `catalog_items` columns follow ruling 3, not the design's draft column list; 3D stays with T087.

**2. Placeholder scan:** every code step carries the full code and every command is exact; the run-time values (the backend test count, the live count, the version the hotfix left) are read by the release steps from files or `grep`, never guessed.

**3. Type and name consistency** (the appendix below is the pre-flight table): the Python primitive keys (`kind`, `id`, `item_id`, `shape`, `icon`, `color`, `level_id`, `cx`, `cy`, `w`, `h`, `rotation`, `corners`, `label`, `circuit_id`, `anchor`, `steps` / `ckind`, `points`, `width`, `arrow`, `label`, `lx`, `ly`, `level_from`, `level_to`) equal the TypeScript `ObjectPrim` / `ConnectorPrim` fields; the bundle fields `catalog_revision`, `levels`, `circuit_states` map to `MapBundle.catalogRevision / levels / circuitStates`; the canvas events `geom-select` (kinds `object`, `connector`), `geom-drag` kinds and `GeomDragDetail.shift / alt` match the editor's `dragged()`; every DOM hook the live spec uses is named in the task that renders it.

## Appendix: Consistency table

Pre-flight cross-check of every place where two tasks share a file or an interface. "Checked" means the names and shapes were compared while the plan was written; the implementer re-checks the row when a task changes a signature.

### A. Shared files and interfaces

| Producer → consumer | Shared file / interface | What must agree |
|---|---|---|
| Task 1 → Task 2 | `services/plan_catalog.py`; migration `0020_catalog_items.sql` | Task 2 calls `builtin()`, `builtin_ids(conn)`, `row_item(row)`, `custom_items(conn)`, `revision(conn)`, `library(conn)` and `check_item(item)` with the Task 1 signatures and appends `DEFAULT_CUSTOM` and `custom_values(body, existing=None)` to the same module; the table columns (`names_json`, `tags_json`, `size_json`, `params_json`, `based_on`, `created_at`, `updated_at`) are what the router writes and what the import replaces by id, keeping `created_at`. |
| Task 1 → Tasks 3, 4, 5, 6 | `plan_catalog.item_index(conn)`, `plan_catalog.names_index(conn)` | One item dict (`shape`, `icon`, `color_token`, `size`, `params`, `role`, `z_ref`, `z_m`) feeds `validate(doc, items)`, `normalize(doc, items)`, `structure_primitives(doc, w, h, level=None, items=None)`, `geometry_store._prepare` and the search titles (label, else `names.he`). |
| Task 1 → Tasks 4, 7, 8, 10 | `ICONS` (24), `SHAPES`, `COLOR_TOKENS` | `plan_symbols.SYMBOLS` keys equal `plan_catalog.ICONS` (`test_every_symbol_exists_once`); `SYMBOL_IDS` (24) equals the icon set of `objects.json` (`unit-geometry-2` test 2); `map/plan-symbols.ts` has one template per `SymbolId`; the custom item dialog (Task 10) offers `OBJECT_SHAPES` and `COLOR_TOKENS`. |
| Task 2 → Tasks 6, 7, 8, 15 | bundle field `catalog_revision` (`routers/anchors.py`) | Task 6 adds `levels` and `circuit_states` to the same bundle dict; `MapBundle.catalogRevision` (Task 7); the floor map calls `loadLibrary(revision)` and reloads when the revision changes (Task 8); the changelog names the three fields. |
| Task 2 → Tasks 7, 9, 10, 14 | `GET / POST /catalog/objects`, `PATCH / DELETE /catalog/objects/{id}`, `GET /catalog/export`, `POST /catalog/import` | `api/plan-catalog.ts` (`loadLibrary`, `createItem`, `updateItem`, `deleteItem`, `importItems`, `exportUrl`); the export format `smplwise-catalog-1` is what `importLibrary` (Task 10) posts back ("N יובאו, M הוחלפו") and what the acceptance test reads (`items[].names.he`). |
| Task 2 → Task 9 | permission `catalog.manage` | The editor gates the custom item and import buttons on `bundle.permissions.structure` (the same three built-in roles hold both permissions; the server still answers 403 for anyone else) - a recorded interpretation, the bundle gets no new permission field. |
| Task 3 → Task 4 | `validate(doc, items)`, `normalize(doc, items)`, `counts(doc)` | The extended sample fixture (o1–o5, g1, c1, cx-o4, k1, level L1) validates with no errors and is already normalized (`test_the_sample_is_normalized_and_valid`); the `counts` keys `objects`, `groups`, `connectors`, `circuits` match `GeometryCounts` (Task 7) and the diff rows the live tests read ('עצמים'). |
| Task 3 → Task 5 | `normalize`, `apply_anchor_positions(doc, anchors)` | Called by `geometry_store._prepare` in the order rebase → normalize → anchor refresh; the derived connector id `cx-<object id>` (`DERIVED_PREFIX`) is what Task 11's live test and the golden expect. |
| Task 3 → Tasks 7, 12, 13 | `CONNECTOR_KINDS = ("stairs", "ramp", "tribune", "elevator", "ladder")`, `GROUP_KINDS`, `SWITCH_RE` | `ConnectorKind` / `GroupKind` (Task 7) and `CONNECTOR_KINDS` in studio-ops (Task 12) list the same five kinds, of which the tool draws four (a tribune connector is only derived); `switch_entity_id` must match `^(switch|light)\.` on the server and the circuit panel search offers only those domains. |
| Task 3 → Task 7 | `contracts/schemas/plan_geometry.v2.schema.json` `$defs` | Field names `item_id`, `position`, `rotation`, `size`, `z_m`, `level_id`, `label`, `group_id`, `anchor_ref`, `params`; `kind`, `member_ids`; `polyline`, `width_m`, `level_from`, `level_to`, `floor_ids`, `object_id`, `source`; `switch_entity_id`, `color_token`, `power_w`; `elevation_m`, `ceiling_height_m` are the ones `GeomObject`, `GeomGroup`, `GeomConnector`, `GeomCircuit`, `GeomLevel` carry. |
| Task 4 → Task 5 | `geometry_store.anchor_positions(conn, plan_version_id)` | Defined for the exports (`render_svg / render_png(..., anchors=)`), reused unchanged by `_prepare`. |
| Task 4 → Task 7 | golden `sample-v2.primitives.json` (24 all, 7 for L1), `ARROW_PX = 14.0`, `connector_label` | `buildPrimitives(doc, W, H, level, catalog)` reproduces the golden in `unit-geometry-2` test 1; `ARROW_PX = 14` in `geometry.ts`; `connectorLabel` gives '↓ −1.2 מ׳', '↑ …' and '↕' exactly as `connector_label`. |
| Task 4 → Tasks 8, 11 | `LAYERS = ("structure", "objects", "labels", "connectors")`; primitive order walls → openings → labels → connectors → objects | The floor map layer ids `objects` / `connectors` and the `?layers=` values coincide; `renderPrimitive` handles the `connector` and `object` kinds; connectors are never level-filtered on either side (`test_the_level_filter_keeps_connectors_and_anchors_move_bound_bodies`; Task 11's live test). |
| Task 5 → Task 6 | `routers/anchors.py` (`delete_anchor` un-binds; `AnchorIn` / `AnchorPatch.level_id`), `geometry_store` read helpers | Task 6 reads published documents through the store as Task 5 prepared them (`_current_published`, `published_objects`); the two tasks edit different functions of `anchors.py`. |
| Task 5 → Tasks 7, 12 | `POST /plan-versions/{id}/geometry/link` `{connector_id, floor_id}`, audit `geometry.connector.link` | `linkConnector(versionId, connectorId, floorId)` in `api/geometry.ts`; `linkTo()` in the editor; the live test looks for the same id in the other floor's draft (`ids.floor2`). |
| Task 6 → Tasks 7, 8, 13 | bundle `levels[]`, `circuit_states[]` (`entity_id`, `name`, `color_token`, `member_ids`, `power_w`, `state`, `known`, `fresh`, `available`, `can_control`, `actions`) | `CircuitState` in `types.ts`; canvas `circuitStates` → `[data-object][data-glow]`; `renderCircuitStrip` reads `can_control` and `actions` and calls the existing `trigger()`; WS updates replace `circuitStates` (Task 8), so the glow follows the switch. |
| Task 6 → Task 11 | `PATCH /zones/{id}` and `PATCH /anchors/{id}` with `level_id` (`""` clears), zones `ceiling_height_m` | The editor's `[data-zone-level]` / `[data-anchor-level]` selects send these; the live map chips filter pins and rooms by `level_id`. |
| Task 6 → Task 14 | search result `kind: "object"`, `route: /explore/floors/{fid}?focus=object:{id}` | `sw-app` passes `focusObject`; the floor map marks `[data-object=<id>].sel` through `selectedGeomId` and centres on `position`. |
| Task 6 → Tasks 9, 13 | `POST /ha/dev/states` (developer backends only, audit `ha.dev.states`) | The live spec seeds `light.studio2_lamp` (the body offer, Task 9) and `switch.studio2_a / b` (the glow and toggle, Task 13); the add-on answers 404 (`test_the_dev_state_route_exists_only_in_developer_mode`). |
| Task 7 → Task 8 | `buildPrimitives(doc, W, H, level, catalog?)`, `CatalogLookup`, `AnchorPosition`, `applyAnchorPositions` | The canvas primitive cache key includes `catalog` and `anchorPositions`; the floor map builds `catalogLookup` with `lookupOf(library)` and `anchorPositions` from the bundle anchors. |
| Task 7 → Tasks 9, 10, 13 | `api/plan-catalog.ts` (`loadLibrary`, `lookupOf`, `itemOf`, `searchItems`, `createItem`, `importItems`, `exportUrl`), `CatalogItem` | The library panel search is `searchItems(lib, q, category)`; `createCustom` posts `createItem`; `importLibrary` posts `importItems`; the circuit panel reads `power_w` from `itemOf(...).params`. |
| Task 8 → Tasks 9–14 | canvas props `catalog`, `anchorPositions`, `circuitStates`, `entityStates`, `hideObjects`, `hideConnectors`, `selectedGeomId`; DOM `[data-object]`, `[data-connector]`, `[data-glow]` | Task 9 adds `GeomDragMode 'objects'`, the handles and `[data-hit-object]` / `[data-hit-connector]`; Task 10 adds `highlightIds`; Task 14 sets `.selectedGeomId` on the live map; every live locator uses these attributes. |
| Task 8 → Tasks 9–14 (live spec) | `evidence-plan-studio-2.spec.ts`: `ids` (site, building, floor, floor2, version), `clickPlan`, `dragPlan`, `draft`, `saveDraft`, `publish`, the 10 m calibration | Later tests are appended inside the same `test.describe.serial` block and build on what the earlier ones left: Task 10's custom item 'כיסא אולם', Task 11's level `L1` at −1.2 m and the tribune connector, Task 13's circuits `k-north` (4 lamps) and `k-south` (3 after the move) - all asserted again by the acceptance test (Task 14). |
| Task 9 → Tasks 10–13 | studio-ops (`addObject`, `patchObject`, `moveObject`, `duplicateObject`, `removeItem`, `placeOpts`), panel `GeomKind`, editor (`pickTool`, `onGeomSelect`, `dragged`, `focusGeom`, `renderLibraryTool`) | `addArray` reuses `duplicateObject`; `removeItem` also removes a connector or a circuit; `placeOpts` carries the current level into new items and connectors (Tasks 11, 12); `onGeomSelect` gains the `membersMode` branch (Task 13); no function is redefined, only extended. |
| Task 10 → Task 14 | `[data-object-array]`, `[data-array-rows]`, `[data-array-cols]`, `[data-array-sy]`, `[data-array-create]`, `[data-selected-group]` | The acceptance test builds the 60-chair array with them; on a phone `[data-object-array]` is disabled and the panel says "בטלפון". |
| Task 11 → Task 12 | `doc.levels` (`GeomLevel[]`), the editor fields `levelDialog` and `createLevel` | The connector panel's "למפלס" `<select data-conn-to>` lists the same `doc.levels` the level chips and `levelSelect` show (ids `L<n>`, names); Task 12 inserts its state after `levelDialog` and its methods after `createLevel` (insertion anchors only, nothing redefined). |
| Task 11 → Task 14 | level `L1` (elevation −1.2, ceiling 6), `cx-<tribune id>` with `level_to: 'L1'` | Asserted on the published document in the acceptance test. |
| Task 12 → Task 13 | the editor's tool switch (`renderConnectorTool`, `renderCircuitTool`) | Each tool renders its own panel; the switch lists `library`, `connectors`, `circuits` after the phase-1 tools. |
| Task 13 → Task 14 | circuits `k-north` (4 lamps) and `k-south` (3 lamps) | `pub.circuits.filter((k) => k.member_ids.length >= 3).length === 2`. |
| Task 15 ↔ Tasks 1–14 | test file names and counts; the product strings the checklist quotes | Six new backend files (4 + 3 + 7 + 9 + 3 + 5 tests) plus one test appended to `test_plan_geometry_integration.py`; node specs 5 + 8; the live spec 8. Every quoted label in the checklist is rendered by the task named in the row: "ספריית עצמים", "לאחרונה", "מועדפים", "הצמד לישות", "הגוף של", "ייצוא הספרייה המותאמת", "ייבוא", "לא קיים בספרייה" (Task 9); "מערך", "צור מערך", "צור פריט מזה", "צור פריט", "מחק הכול", "השאר את העצמים", "יובאו" / "הוחלפו" (Task 10); "מפלס", "הוסף מפלס", "כל המפלסים" (Task 11); "מפלסים ומחברים", "מדרגות", "למפלס", "קשר לקומה" (Task 12); "מעגלי תאורה", "מעגל חדש", "צור מעגל", "דולק" (Task 13); "עצמים" / "מחברים" (Task 8); "מחברת למפלס" (the catalog param label, Task 1, rendered by the object inspector of Task 9); "בדסקטופ בלבד" (Task 9); "ניהול ספריית העצמים" (Task 2); the action status texts come from the existing `ACTION_STATUS_LABEL` ('נשלח · ממתין לעדכון מ־Home Assistant', 'אושר · המצב התעדכן'). |

### B. Per task: tests against code, created files against later edits

| Task | The tests exercise the code the task writes | The files it creates are touched later only as stated |
|---|---|---|
| 1 | `test_plan_catalog.py` (4) calls `check_item`, `check_catalog`, `builtin`, `row_item`, `custom_items`, `revision`, `item_index` with the Task 1 signatures; the migration test reads the `catalog_items` columns. | `services/plan_catalog.py` gains `DEFAULT_CUSTOM` / `custom_values` in Task 2 and nothing else; `catalog/objects.json` is never edited (custom items live in the table). |
| 2 | `test_plan_catalog_api.py` (3) hits the six routes with the five fixture users; the matrix row is inserted into `test_matrix_by_role_scope_and_deny`; the appended integration test reads `catalog_revision` from the bundle. | `routers/plan_catalog.py` is not edited later; the bundle in `anchors.py` gets `levels` / `circuit_states` in Task 6. |
| 3 | `test_plan_geometry_objects.py` (7) and the updated `test_counts` cover the `validate` codes (`unknown_item`, `unknown_level`, `unknown_member`, `unknown_object`, sizes, angles, `SWITCH_RE`), `normalize` (power sum, derived connector), `apply_anchor_positions`; `test_schema_file_types_the_new_collections` pins the schema enums to `CONNECTOR_KINDS` / `GROUP_KINDS`. | `plan_geometry.py` and the schema are not edited later. |
| 4 | `test_plan_geometry_render2.py` (9) states the hand-computed corners (o1 `[[177.5, 137.5], [222.5, 137.5], [222.5, 182.5], [177.5, 182.5]]`), the golden counts 24 / 7, the SVG layer subsets and the export routes' `?layers=`; `test_level_filter` in the phase-1 file gets its new id list. | `plan_symbols.py` is not edited later; the sample fixture and the golden are regenerated once and read by Task 7's spec; `geometry_store.anchor_positions` is reused by Task 5. |
| 5 | `test_plan_geometry_binding.py` (3) saves, publishes, deletes the anchor and links stairs, reading positions back through the API. | `geometry_store._prepare` is called by every entry point Task 5 lists; Task 6 adds read helpers only. |
| 6 | `test_plan_circuits_search.py` (5) reads the bundle, posts through `/ha/entities/{id}/actions` (503 `bridge_not_paired` on the developer backend counts as "reached the route with its permission"), patches zones and anchors, searches, and checks the dev route's 404 in add-on mode. | `routers/ha.py`, `routers/search.py`, `routers/zones.py` are not edited later. |
| 7 | `unit-geometry-2.spec.ts` (5) reads the golden and `objects.json` through `fs`; its expectations are Task 4's numbers. | `geometry.ts` types and `api/plan-catalog.ts` are extended, never changed, by Tasks 8–13 (new imports only). |
| 8 | The first live test checks `[data-object]` / `[data-connector]` counts, the symbols, the level delta text and the layer buttons on the live map. | `plan-symbols.ts` is not edited later; `sw-plan-canvas.ts` gains `geomDrag 'objects'` and the handles (Task 9) and `highlightIds` (Task 10) in separate blocks. |
| 9 | `unit-studio-ops-2.spec.ts` (3) checks `addObject` copies size / params / z, `moveObject` / `rotationTo` / `stretchedSize` / `duplicateObject`, and the `removeItem` side effects; the second live test drives the DOM hooks Task 9 renders. | `renderLibraryTool` gets the array and custom buttons (Task 10); `pickTool` and the tool switch get the new tools (Tasks 11–13); no function is redefined. |
| 10 | Two node tests (`addArray` 6 × 10, `removeGroup` keep / take) and the third live test (sixty chairs, the in-page dialog, a custom item, the export). | `renderArrayDialog` / `renderCustomItemDialog` are not edited later. |
| 11 | One node test (`addLevel` ids, one default, `removeLevel` refused while used, `levelUsage` L1 = 5 on the fixture) and the fourth live test. | `renderLevelChips` / `renderLevelDialog` / `levelSelect` are not edited later; Task 12 only uses `levelDialog` and `createLevel` as insertion anchors in the editor. |
| 12 | One node test (`addConnector` widths, `patchConnector`, `moveConnectorVertex` kept inside the plan) and the fifth live test (two clicks, "למפלס", "קשר לקומה" to `ids.floor2`). | Not edited later. |
| 13 | One node test (`addCircuit`, `toggleCircuitMember` one circuit per lamp, `circuitPower`) and the sixth live test (seeded switch states, glow, the toggle through the action route, editor membership). | Not edited later. |
| 14 | The acceptance test and the phone test assert only what Tasks 8–13 rendered, plus the focus. | The `sw-app.ts` / `explore-floor-map.ts` edits are the last code edits of the plan. |
| 15 | Reads the pytest and live outputs from files, the version from `grep`, and records only on green. | Creates the checklist and edits the documents after every code commit; stops after the release commit. |
