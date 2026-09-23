# Plan Studio — Phase 1 (T084) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The product's floor map gains a calibrated, versioned structure layer — walls, doors, windows, passages and labels — that editors draw in the existing plan editor and that every map surface already in the product shows (live floor map, history map at an instant, the event page's map card, and therefore the Lovelace card), with JSON / SVG / PNG exports.

**Architecture:** A canonical v2 geometry document per plan version lives in a new `plan_geometry` table: one draft (the editor's autosave target), at most one published row, and an archived history. Publishing a plan version also publishes its draft; the map bundle carries only a reference (id + SHA-256), and the document is fetched once per hash. A pure TypeScript module computes exactly the same deterministic primitives as the Python renderer (pinned by one shared golden fixture), and `sw-plan-canvas` draws them — so every screen that already shows a map shows the structure without its own code.

**Tech Stack:** FastAPI + SQLite on Python 3.12 (Pillow / numpy already present), Lit 3 + TypeScript 5.9 (strict, `noUnusedLocals`), Playwright 1.63. **No new runtime dependency** in this phase.

**Spec:** `docs/architecture/PLAN_STUDIO_DESIGN_HE.md` (sections 2, 2a, 4.1, 4.2, 5, 6, 7, 11, 12, 13, 14 phase 1) and `docs/changes/CR-003-PLAN-STUDIO.md`. Task card: `management/tasks/T084.md` (R167, R168; implements T059's R117 / R118).

## Global Constraints

- Geometry contract: coordinates normalized 0..1 to the plan **version image**, origin top-left, points stored as `[x, y]` arrays (like v1 and `coverage_polygon`); angles 0° = up, clockwise; sizes in metres.
- Metres only from calibration. Uncalibrated drawing uses the estimated scale `0.2 m / (0.006 × width_px)` and every metre value shown is prefixed `≈`.
- Nothing automatic is published: publish is the only way viewers see a change. Drafts are editor-only.
- Permissions (VMS, floor scope `("floor", floor_id)`): `map.read` = published document, timeline, exports of the published document; `map.edit` = draft read/write, calibration, copy, draft exports, diff, versions; `map.publish` = publish, rollback.
- Determinism: canonical JSON = `plan_schema.canonical_json` (sorted keys, floats rounded to 6 digits); `doc_hash` = SHA-256 of it; primitives rounded **half-up** to 0.01 px with `floor(v * 100 + 0.5) / 100` in both languages.
- Migrations are additive only. Backups include every new table.
- UI copy in Hebrew; code, comments and commit messages in English.
- Commits: message in a temp file (UTF-8, no BOM), `git commit -F`; trailer `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>` (CLAUDE.md); before every commit `bash /c/cloude/smplwisebms/secrets/scan_staged.sh` must print `0` - the script lives in the gitignored `secrets/` folder because its pattern names private identifiers; never copy the pattern into a tracked file. Keep commit messages free of apostrophes (the shell harness chokes on unbalanced quotes in heredocs).
- Branch: `git checkout -b pilot/T084-plan-studio-1 g0/intake` before Task 1. Merge back and push only in Task 15.
- Commands (Git Bash on Windows):
  - `SP=C:/Users/jon/AppData/Local/Temp/claude/C--cloude-smplwisebms/bd61f90d-850a-444f-9da9-92c50c272bc2/scratchpad` - the session scratchpad; it already holds `fixture_chain.sh`, `restart_backend.ps1` (starts the developer backend hidden) and `ha_store_reload.py`.
  - "Restart the developer backend" means `bash "$SP/restart_dev.sh"` (created once, see below).
  - `PY=C:/cloude/smplwisebms/.venv/Scripts/python.exe`
  - Backend tests: `cd smplwise_vms/backend && MSYS_NO_PATHCONV=1 $PY -m pytest <files> -p no:cacheprovider` — do **not** add `-q` (pyproject already sets it; `-qq` hides the summary line).
  - Node: `export PATH="$APPDATA/fnm/node-versions/v24.21.0/installation:$PATH"`; in `frontend/`: `npx tsc --noEmit -p tsconfig.json`, `npm run build`, `npx playwright test <spec> --project=desktop --workers=1 --reporter=line`.
  - Live specs (`SW_LIVE=1 SW_CHROME=1`) need the developer backend on 8099 (restart it after any backend change) and a fresh `npm run build` (the preview on 4173 serves `frontend/dist` and proxies `/api` to 8099).
  - Demo fixture chain (only when a demo-visible component changed): `bash "$SP/fixture_chain.sh"` - it stops the backend, runs `tests/screenshots.spec.ts tests/screens.spec.ts` in demo mode (expect `fixtures exit: 0` and 129 passed), restores `docs/evidence/T007` and restarts the backend.
  - Never edit version files while a background pytest run is in progress. Run `scripts/dev_cleanup.ps1 -StopBackend` when a batch of live specs is done.


**Developer backend restart helper** (create it once, before Task 6; it kills the running wrapper, starts a new one, shows that it answers and which process listens):

```bash
cat > "$SP/restart_dev.sh" <<'EOF'
#!/bin/bash
SP="$(cd "$(dirname "$0")" && pwd)"
WPID=$(powershell -NoProfile -Command "(Get-CimInstance Win32_Process | Where-Object { \$_.CommandLine -like '*run_backend.ps1*' } | Select-Object -First 1).ProcessId")
[ -n "$WPID" ] && taskkill //PID "$WPID" //T //F > /dev/null 2>&1
sleep 3
powershell -NoProfile -ExecutionPolicy Bypass -File "$SP/restart_backend.ps1"
sleep 25
curl -s -o /dev/null -w "me: %{http_code}\n" http://127.0.0.1:8099/api/v1/me
powershell -NoProfile -Command "(Get-NetTCPConnection -LocalPort 8099 -State Listen | Select-Object -First 1).OwningProcess"
EOF
```

Expect `me: 200` and a listener pid different from the previous run; an old process can survive on the port - stop it with `powershell -NoProfile -Command "Stop-Process -Id <that pid>"` and run the helper again.

---

## File Structure

**Backend — create**
- `smplwise_vms/backend/smplwise/migrations/0018_plan_geometry.sql` — `plan_geometry` table (one draft / one published per version, archived history) + `plan_versions.calibration_json`.
- `smplwise_vms/backend/smplwise/migrations/0019_levels.sql` — `level_id` on rooms and anchors, room ceiling height (used from phase 2).
- `smplwise_vms/backend/smplwise/services/plan_geometry.py` — v2 document: construction from a version, rebase, validation (structural vs geometric), effective scale, two-point scale, diff, crop transform, counts.
- `smplwise_vms/backend/smplwise/services/plan_geometry_render.py` — deterministic primitives, SVG and PNG export.
- `smplwise_vms/backend/smplwise/services/geometry_store.py` — persistence: draft save with revisions, publish, rollback, history / instant, carry to a new version, copy.
- `smplwise_vms/backend/smplwise/routers/plan_geometry.py` — the API.
- `contracts/schemas/plan_geometry.v2.schema.json` — the published contract.
- `contracts/fixtures/plan_geometry/sample-v2.json`, `sample-v2.primitives.json` — the shared golden fixture.
- `scripts/geometry_golden.py` — regenerates the golden primitives.
- Tests: `smplwise_vms/backend/tests/test_plan_geometry_db.py`, `test_plan_geometry_model.py`, `test_plan_geometry_render.py`, `test_plan_geometry_store.py`, `test_plan_geometry_api.py`, `test_plan_geometry_integration.py`, `test_plan_geometry_export.py`.

**Backend — modify**
- `smplwise_vms/backend/smplwise/routers/plans.py` — `version_row` exposes `calibration`; create / publish / rollback / delete hooks.
- `smplwise_vms/backend/smplwise/routers/anchors.py` — the map bundle carries `geometry` (reference).
- `smplwise_vms/backend/smplwise/services/backup.py` — `plan_geometry` in `PROJECT_TABLES`.
- `smplwise_vms/backend/smplwise/main.py` — register the router.

**Frontend — create**
- `frontend/src/map/geometry.ts` — v2 types, primitives (mirror of the Python renderer), editor maths.
- `frontend/src/map/studio-ops.ts` — pure document operations (add / patch / move / remove).
- `frontend/src/map/studio-controller.ts` — Lit ReactiveController: draft, undo / redo, 2 s autosave, conflicts.
- `frontend/src/api/geometry.ts` — API client, per-hash cache, history timeline.
- `frontend/src/screens/plan-studio-panel.ts` — the studio side panels (render functions + styles).
- Tests: `frontend/tests/unit-geometry.spec.ts`, `frontend/tests/unit-studio-controller.spec.ts` (node, no page), `frontend/tests/evidence-plan-studio.spec.ts` (live).

**Frontend — modify**
- `frontend/src/api/types.ts`, `frontend/src/api/maps.ts` — `GeometryRef`, calibration, bundle fields.
- `frontend/src/map/sw-plan-canvas.ts` — structure layer, editing affordances, rulers.
- `frontend/src/styles/tokens.css` — `--sw-map-structure`, `--sw-map-glass`.
- `frontend/src/components/sw-icon.ts` — `wall`, `ruler`, `scale` icons.
- `frontend/src/screens/explore-floor-map.ts`, `investigate-history-map.ts`, `investigate-event-detail.ts` — show the structure.
- `frontend/src/screens/explore-plan-editor.ts` — studio tools, calibration, measure, combined publish.

---

### Task 1: Storage migrations

**Files:**
- Create: `smplwise_vms/backend/smplwise/migrations/0018_plan_geometry.sql`
- Create: `smplwise_vms/backend/smplwise/migrations/0019_levels.sql`
- Test: `smplwise_vms/backend/tests/test_plan_geometry_db.py`

**Interfaces:**
- Produces: table `plan_geometry(id, plan_version_id, floor_id, status draft|published|archived, revision, doc_json, doc_hash, created_by, created_at, updated_at, published_by, published_at, archived_at)` with partial unique indexes (one draft, one published per version); columns `plan_versions.calibration_json`, `spatial_zones.level_id`, `spatial_zones.ceiling_height_m`, `map_anchors.level_id`.

- [ ] **Step 1: Write the failing test**

```python
"""Plan Studio storage (T084, CR-003): migration 0018 adds the versioned plan_geometry table (at most one draft and one
published row per plan version) and a calibration record per plan version; 0019 lets rooms and placed items belong to
a level of the floor."""
from __future__ import annotations

import sqlite3

import pytest
from conftest import png_bytes, seed_tree
from fastapi.testclient import TestClient

from smplwise.main import create_app


def _cols(conn: sqlite3.Connection, table: str) -> set[str]:
    return {r[1] for r in conn.execute(f"PRAGMA table_info({table})").fetchall()}


def test_migrations_add_the_geometry_table_and_level_columns(settings):
    app = create_app(settings)
    with app.state.db.connection() as conn:
        assert {"id", "plan_version_id", "floor_id", "status", "revision", "doc_json", "doc_hash", "created_at", "updated_at",
                "published_at", "published_by", "archived_at"} <= _cols(conn, "plan_geometry")
        assert "calibration_json" in _cols(conn, "plan_versions")
        assert {"level_id", "ceiling_height_m"} <= _cols(conn, "spatial_zones")
        assert "level_id" in _cols(conn, "map_anchors")


@pytest.mark.parametrize("status", ["draft", "published"])
def test_at_most_one_draft_and_one_published_row_per_version(settings, status):
    app = create_app(settings)
    c = TestClient(app)
    ids = seed_tree(c)
    asset = c.post(f"/api/v1/floors/{ids['floor2']}/plan-assets", files={"file": ("plan.png", png_bytes(), "image/png")}).json()
    v = c.post(f"/api/v1/floors/{ids['floor2']}/plan-versions", json={"asset_id": asset["id"]}).json()
    sql = ("INSERT INTO plan_geometry(id, plan_version_id, floor_id, status, revision, doc_json, doc_hash, created_at, updated_at) "
           "VALUES (?, ?, ?, ?, 1, '{}', 'h', '2026-09-23T08:00:00Z', '2026-09-23T08:00:00Z')")
    with app.state.db.connection() as conn:
        conn.execute(sql, ("g1", v["id"], ids["floor2"], status))
    with pytest.raises(sqlite3.IntegrityError):
        with app.state.db.connection() as conn:
            conn.execute(sql, ("g2", v["id"], ids["floor2"], status))
    with app.state.db.connection() as conn:  # archived rows are the history: any number of them
        for i in range(3):
            conn.execute(sql, (f"a{i}", v["id"], ids["floor2"], "archived"))
```

- [ ] **Step 2: Run it to see it fail**

Run: `cd smplwise_vms/backend && MSYS_NO_PATHCONV=1 $PY -m pytest tests/test_plan_geometry_db.py -p no:cacheprovider`
Expected: FAIL — `no such table: plan_geometry` / missing columns.

- [ ] **Step 3: Write the migrations**

`0018_plan_geometry.sql`:

```sql
-- Plan Studio phase 1 (T084, CR-003): the structure layer of each plan version. One draft row per version (the
-- editor's autosave target), at most one published row, and the archived history the historical map reads.
-- doc_json is the canonical v2 document (services/plan_geometry.py); doc_hash its SHA-256, which the map bundle
-- carries instead of the document and which serves as the ETag.
CREATE TABLE plan_geometry (
  id              TEXT PRIMARY KEY,
  plan_version_id TEXT NOT NULL REFERENCES plan_versions(id),
  floor_id        TEXT NOT NULL REFERENCES floors(id),
  status          TEXT NOT NULL CHECK (status IN ('draft', 'published', 'archived')),
  revision        INTEGER NOT NULL DEFAULT 1,
  doc_json        TEXT NOT NULL,
  doc_hash        TEXT NOT NULL,
  created_by      TEXT,
  created_at      TEXT NOT NULL,
  updated_at      TEXT NOT NULL,
  published_by    TEXT,
  published_at    TEXT,
  archived_at     TEXT
);
CREATE INDEX idx_plan_geometry_version ON plan_geometry (plan_version_id, status);
CREATE UNIQUE INDEX idx_plan_geometry_one_draft ON plan_geometry (plan_version_id) WHERE status = 'draft';
CREATE UNIQUE INDEX idx_plan_geometry_one_published ON plan_geometry (plan_version_id) WHERE status = 'published';
-- The two-point calibration record of a version (pairs, method, residual); the scale itself stays in scale_m_per_px.
ALTER TABLE plan_versions ADD COLUMN calibration_json TEXT;
```

`0019_levels.sql`:

```sql
-- Plan Studio (T084 / T085, CR-003): rooms and placed items belong to a level of the floor (the split-level sports
-- hall); NULL = the floor's default level. A room may override its level's ceiling height.
ALTER TABLE spatial_zones ADD COLUMN level_id TEXT;
ALTER TABLE spatial_zones ADD COLUMN ceiling_height_m REAL;
ALTER TABLE map_anchors ADD COLUMN level_id TEXT;
```

- [ ] **Step 4: Run the test to see it pass**

Run: `cd smplwise_vms/backend && MSYS_NO_PATHCONV=1 $PY -m pytest tests/test_plan_geometry_db.py -p no:cacheprovider`
Expected: `3 passed`.

- [ ] **Step 5: Commit**

```bash
git add smplwise_vms/backend/smplwise/migrations/0018_plan_geometry.sql smplwise_vms/backend/smplwise/migrations/0019_levels.sql smplwise_vms/backend/tests/test_plan_geometry_db.py
msg=$(mktemp) && cat > "$msg" <<'EOF'
feat(plan-studio): plan_geometry table, calibration record, level columns (T084)

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOF
test "$(bash /c/cloude/smplwisebms/secrets/scan_staged.sh)" = 0 && git commit -F "$msg"
```

---

### Task 2: The v2 document — construction, rebase, validation, schema file

**Files:**
- Create: `smplwise_vms/backend/smplwise/services/plan_geometry.py`
- Create: `contracts/schemas/plan_geometry.v2.schema.json`
- Test: `smplwise_vms/backend/tests/test_plan_geometry_model.py`

**Interfaces:**
- Consumes: `smplwise.services.plan_schema.canonical_json(doc) -> str`.
- Produces (module `plan_geometry`, imported as `pg` by later tasks):
  - constants `SCHEMA_VERSION = "2.0"`, `DEFAULT_LEVEL_ID = "L0"`, `DEFAULT_WALL_THICKNESS_M = 0.2`, `ESTIMATED_WALL_FRACTION = 0.006`, `WALL_KINDS`, `OPENING_KINDS`, `SWINGS`, `HINGES`, `SOURCES`, `CAL_STATUSES`, `CAL_METHODS`, `COLLECTIONS`, `LIMITS`.
  - `canonical_json(doc) -> str` (re-export), `calibration_of(version, asset) -> dict`, `version_block(version, asset) -> dict`, `new_document(version, asset) -> dict`, `rebase(doc, version, asset) -> dict`, `is_empty(doc) -> bool`, `counts(doc) -> dict[str, int]`, `effective_scale(doc) -> tuple[float, bool]`, `polyline_length_px(points, width, height) -> float`, `two_point_scale(pairs, width_px, height_px) -> tuple[float, float]` (raises `ValueError` when a pair is shorter than 5 px), `validate(doc) -> list[Issue]` where `Issue = {"code", "severity": "error"|"warning", "structural": bool, "id": str|None, "path": str, "message": str}`.
  - `version` / `asset` may be `sqlite3.Row` or a dict with keys `id, floor_id, asset_id, page, rotation, crop_json, width_px, height_px, scale_m_per_px, calibration_json` / `sha256, original_name, mime`.

- [ ] **Step 1: Write the failing tests**

```python
"""Plan Studio document v2 (T084): a new document carries the version's source, size and calibration and one default
level; the validator separates structural problems (a save is refused) from geometric ones (kept with the draft,
block publishing); the published JSON schema and the validator agree on the enums."""
from __future__ import annotations

import copy
import json
import pathlib

import pytest

from smplwise.services import plan_geometry as pg

SCHEMA = pathlib.Path(__file__).resolve().parents[3] / "contracts" / "schemas" / "plan_geometry.v2.schema.json"
VERSION = {"id": "v1", "floor_id": "f1", "asset_id": "a1", "page": 1, "rotation": 0, "crop_json": None, "width_px": 1000, "height_px": 500,
           "scale_m_per_px": 0.02, "calibration_json": None}
ASSET = {"sha256": "b" * 64, "original_name": "plan.pdf", "mime": "application/pdf"}


def _doc() -> dict:
    d = pg.new_document(VERSION, ASSET)
    d["walls"] = [
        {"id": "w1", "level_id": "L0", "polyline": [[0.1, 0.2], [0.5, 0.2]], "thickness_m": 0.2, "height_m": None, "base_z_m": 0, "kind": "exterior",
         "confidence": 1, "source": "manual", "locked": False, "external_ids": {}},
        {"id": "w2", "level_id": "L0", "polyline": [[0.5, 0.2], [0.5, 0.8]], "thickness_m": 0.15, "height_m": 3.0, "base_z_m": 0, "kind": "interior",
         "confidence": 1, "source": "manual", "locked": False, "external_ids": {}},
    ]
    d["openings"] = [{"id": "o1", "wall_id": "w1", "t": 0.5, "kind": "door", "width_m": 0.9, "height_m": 2.1, "sill_m": 0, "swing": "right", "hinge": "start",
                      "anchor_ref": None, "confidence": 1, "source": "manual", "external_ids": {}}]
    d["labels"] = [{"id": "t1", "text": "מחסן", "position": [0.3, 0.4], "level_id": "L0", "size": 14}]
    return d


def _codes(doc) -> set[tuple[str, str | None]]:
    return {(i["code"], i["id"]) for i in pg.validate(doc)}


def test_new_document_takes_the_version_and_validates():
    d = pg.new_document(VERSION, ASSET)
    assert d["schema_version"] == "2.0" and d["plan_version_id"] == "v1" and d["floor_id"] == "f1"
    assert d["dimensions"] == {"width_px": 1000, "height_px": 500, "scale_m_per_px": 0.02,
                               "calibration": {"status": "measured", "method": "manual", "pairs": [], "residual_pct": None, "reason": None}}
    assert [lv["id"] for lv in d["levels"]] == ["L0"] and d["levels"][0]["is_default"] is True
    assert all(d[c] == [] for c in pg.COLLECTIONS if c != "levels")
    assert pg.validate(d) == [] and pg.validate(_doc()) == []
    missing = pg.new_document(dict(VERSION, scale_m_per_px=None), ASSET)
    assert missing["dimensions"]["calibration"]["status"] == "missing" and pg.validate(missing) == []


def test_calibration_record_and_rebase_come_from_the_version():
    rec = {"method": "two_point", "pairs": [{"a": [0.1, 0.1], "b": [0.6, 0.1], "metres": 10}], "residual_pct": 0.0}
    d = pg.new_document(dict(VERSION, calibration_json=json.dumps(rec)), ASSET)
    assert d["dimensions"]["calibration"]["method"] == "two_point" and d["dimensions"]["calibration"]["pairs"] == rec["pairs"]
    tampered = _doc()
    tampered["plan_version_id"] = "other"
    tampered["dimensions"]["scale_m_per_px"] = 99
    back = pg.rebase(tampered, VERSION, ASSET)
    assert back["plan_version_id"] == "v1" and back["dimensions"]["scale_m_per_px"] == 0.02 and back["walls"] == tampered["walls"]


def test_structural_problems_are_flagged_as_structural():
    assert [i["code"] for i in pg.validate([])] == ["type"]
    d = _doc()
    d["walls"] = "nope"
    issues = pg.validate(d)
    assert issues and all(i["structural"] for i in issues) and issues[0]["path"] == "walls"
    d = _doc()
    d["openings"].append({"wall_id": "w1"})
    assert any(i["structural"] and i["path"] == "openings[1]" for i in pg.validate(d))
    d = _doc()
    d["schema_version"] = "1.0"
    assert any(i["code"] == "schema_version" and i["structural"] for i in pg.validate(d))
    d = _doc()
    d["labels"] = [dict(d["labels"][0], id=f"t{i}") for i in range(pg.LIMITS["labels"] + 1)]
    assert any(i["code"] == "limit" for i in pg.validate(d))


def test_geometric_problems_name_the_item():
    d = _doc()
    d["walls"][0]["polyline"][1] = [1.3, 0.2]
    assert ("bounds", "w1") in _codes(d)
    d = _doc()
    d["walls"][1]["level_id"] = "L9"
    assert ("unknown_level", "w2") in _codes(d)
    d = _doc()
    d["openings"][0]["wall_id"] = "w9"
    assert ("unknown_wall", "o1") in _codes(d)
    d = _doc()
    d["openings"][0]["t"] = 0.99  # w1 is 0.4 x 1000 px x 0.02 = 8 m; a 0.9 m door centred at 7.92 m sticks out
    assert ("opening_outside_wall", "o1") in _codes(d)
    d = _doc()
    d["labels"][0]["id"] = "w1"
    assert ("duplicate_id", "w1") in _codes(d)
    d = _doc()
    d["walls"][0]["thickness_m"] = 0
    assert ("thickness", "w1") in _codes(d)
    d = _doc()
    d["walls"][0]["polyline"] = [[0.2, 0.2], [0.2, 0.2]]
    assert ("too_short", "w1") in _codes(d)
    d = _doc()
    d["levels"].append(dict(d["levels"][0], id="L1", is_default=True))
    codes = _codes(d)
    assert ("levels", None) in codes and ("duplicate_elevation", "L1") in codes
    d = _doc()
    d["openings"].append(dict(d["openings"][0], id="o2", t=0.52))
    issues = pg.validate(d)
    assert [i["severity"] for i in issues if i["code"] == "overlap"] == ["warning"]
    assert not any(i["severity"] == "error" for i in issues) and not any(i["structural"] for i in issues)


def test_scale_is_measured_or_estimated():
    d = pg.new_document(dict(VERSION, scale_m_per_px=None), ASSET)
    scale, estimated = pg.effective_scale(d)
    assert estimated and scale == pytest.approx(0.2 / (0.006 * 1000))
    assert pg.effective_scale(_doc()) == (0.02, False)


def test_two_point_scale_mean_and_residual():
    s, r = pg.two_point_scale([([0.1, 0.1], [0.6, 0.1], 10.0)], 1000, 500)
    assert s == pytest.approx(0.02) and r == 0.0
    s, r = pg.two_point_scale([([0.1, 0.1], [0.6, 0.1], 10.0), ([0.1, 0.1], [0.1, 0.5], 4.4)], 1000, 500)
    assert s == pytest.approx((0.02 * 500 + 0.022 * 200) / 700) and r > 3
    with pytest.raises(ValueError):
        pg.two_point_scale([([0.1, 0.1], [0.101, 0.1], 1.0)], 1000, 500)


def test_schema_file_matches_the_validator():
    schema = json.loads(SCHEMA.read_text(encoding="utf-8"))
    assert schema["properties"]["schema_version"] == {"const": pg.SCHEMA_VERSION}
    defs = schema["$defs"]
    assert set(defs["wall"]["properties"]["kind"]["enum"]) == set(pg.WALL_KINDS)
    assert set(defs["opening"]["properties"]["kind"]["enum"]) == set(pg.OPENING_KINDS)
    assert set(defs["opening"]["properties"]["swing"]["enum"]) == set(pg.SWINGS)
    assert set(defs["calibration"]["properties"]["status"]["enum"]) == set(pg.CAL_STATUSES)
    assert set(schema["required"]) >= {"schema_version", "source", "dimensions", "transform", *pg.COLLECTIONS, "uncertainty"}
    assert copy.deepcopy(_doc())["schema_version"] == schema["properties"]["schema_version"]["const"]
```

- [ ] **Step 2: Run to see them fail**

Run: `cd smplwise_vms/backend && MSYS_NO_PATHCONV=1 $PY -m pytest tests/test_plan_geometry_model.py -p no:cacheprovider`
Expected: FAIL — `ImportError: cannot import name 'plan_geometry'`.

- [ ] **Step 3: Write `services/plan_geometry.py`**

```python
"""Plan Studio geometry document, schema v2 (T084, CR-003): the structure layer of one plan version - levels, walls,
openings and labels (objects, circuits and connectors arrive with phase 2) in the version's normalized 0..1 space,
with real sizes in metres. contracts/schemas/plan_geometry.v2.schema.json is the published contract; this module
validates without a schema library. Structural problems (wrong types, missing collections, limits) refuse a save;
geometric problems (bounds, unknown references, an opening that does not fit its wall) stay with the draft and block
publishing. Design: docs/architecture/PLAN_STUDIO_DESIGN_HE.md, sections 2a and 4."""
from __future__ import annotations

import copy
import json
import math
from typing import Any, Mapping

from .plan_schema import canonical_json as canonical_json

SCHEMA_VERSION = "2.0"
TOKENS_VERSION = "map-1"
DEFAULT_LEVEL_ID = "L0"
DEFAULT_LEVEL_NAME = "מפלס ראשי"
DEFAULT_CEILING_M = 2.8
DEFAULT_WALL_THICKNESS_M = 0.2
ESTIMATED_WALL_FRACTION = 0.006  # uncalibrated: a 0.2 m wall is drawn 0.6 % of the plan width wide
WALL_KINDS = ("exterior", "interior", "partition", "railing", "low")
OPENING_KINDS = ("door", "window", "passage")
SWINGS = ("left", "right", "double", "sliding", "none")
HINGES = ("start", "end")
SOURCES = ("manual", "auto", "imported")
CAL_STATUSES = ("measured", "estimated", "missing")
CAL_METHODS = ("two_point", "dxf_units", "door_width", "manual", "carried")
ANCHOR_TYPES = ("camera", "ha_entity")
COLLECTIONS = ("levels", "walls", "openings", "rooms", "objects", "circuits", "connectors", "labels", "groups", "uncertain_regions")
LIMITS = {"levels": 20, "walls": 2000, "openings": 4000, "rooms": 500, "objects": 5000, "circuits": 500, "connectors": 200, "labels": 1000,
          "groups": 500, "uncertain_regions": 200}
DIFF_COLLECTIONS = ("levels", "walls", "openings", "labels", "rooms", "objects", "circuits", "connectors", "groups")


def _num(v: Any) -> bool:
    return isinstance(v, (int, float)) and not isinstance(v, bool) and math.isfinite(v)


def _unit(v: Any) -> bool:
    return _num(v) and 0 <= v <= 1


def _pt(p: Any) -> bool:
    return isinstance(p, (list, tuple)) and len(p) == 2 and _unit(p[0]) and _unit(p[1])


def _issue(issues: list[dict[str, Any]], code: str, message: str, *, item: str | None = None, path: str = "", severity: str = "error", structural: bool = False) -> None:
    issues.append({"code": code, "severity": severity, "structural": structural, "id": item, "path": path, "message": message})


# ---------------------------------------------------------------- construction

def calibration_of(version: Mapping[str, Any], asset: Mapping[str, Any] | None) -> dict[str, Any]:
    """The calibration block a document takes from its plan version - the version is the only place it changes."""
    raw = version["calibration_json"]
    if raw:
        rec = json.loads(raw)
        return {"status": "measured", "method": rec.get("method", "two_point"), "pairs": rec.get("pairs", []), "residual_pct": rec.get("residual_pct"), "reason": None}
    if version["scale_m_per_px"]:
        method = "dxf_units" if asset is not None and asset["mime"] == "image/vnd.dxf" else "manual"
        return {"status": "measured", "method": method, "pairs": [], "residual_pct": None, "reason": None}
    return {"status": "missing", "method": None, "pairs": [], "residual_pct": None, "reason": "לא בוצע כיול; מידות במטרים מוצגות כמשוערות"}


def version_block(version: Mapping[str, Any], asset: Mapping[str, Any] | None) -> dict[str, Any]:
    """Everything a document says about its plan version: the server always writes it, a client never can."""
    crop = json.loads(version["crop_json"]) if version["crop_json"] else None
    return {
        "plan_version_id": version["id"],
        "floor_id": version["floor_id"],
        "source": {"sha256": asset["sha256"] if asset is not None else "0" * 64, "file_name": asset["original_name"] if asset is not None else "",
                   "mime": asset["mime"] if asset is not None else "", "page": int(version["page"])},
        "dimensions": {"width_px": int(version["width_px"]), "height_px": int(version["height_px"]), "scale_m_per_px": version["scale_m_per_px"],
                       "calibration": calibration_of(version, asset)},
        "transform": {"rotation": int(version["rotation"]), "crop": crop},
    }


def new_document(version: Mapping[str, Any], asset: Mapping[str, Any] | None) -> dict[str, Any]:
    doc: dict[str, Any] = {"schema_version": SCHEMA_VERSION, **version_block(version, asset)}
    for coll in COLLECTIONS:
        doc[coll] = []
    doc["levels"] = [{"id": DEFAULT_LEVEL_ID, "name": DEFAULT_LEVEL_NAME, "elevation_m": 0.0, "ceiling_height_m": DEFAULT_CEILING_M, "is_default": True, "external_ids": {}}]
    doc["uncertainty"] = {"overall": 0.5, "notes": []}
    doc["meta"] = {"generator": "smplwise-vms", "tokens_version": TOKENS_VERSION, "detector_version": None}
    return doc


def rebase(doc: Mapping[str, Any], version: Mapping[str, Any], asset: Mapping[str, Any] | None) -> dict[str, Any]:
    """The server owns the version-bound fields (ids, source, size, calibration): a stale or edited client copy cannot
    move the document to another version or fake a calibration."""
    out = dict(doc)
    out.update(version_block(version, asset))
    out["schema_version"] = SCHEMA_VERSION
    return out


def is_empty(doc: Mapping[str, Any]) -> bool:
    return not any(doc.get(c) for c in ("walls", "openings", "labels", "objects", "connectors"))


def counts(doc: Mapping[str, Any]) -> dict[str, int]:
    return {c: len(doc.get(c) or []) for c in ("walls", "openings", "labels", "objects")}


# ---------------------------------------------------------------- measurement

def polyline_length_px(points: list[Any], width: float, height: float) -> float:
    return sum(math.hypot((b[0] - a[0]) * width, (b[1] - a[1]) * height) for a, b in zip(points, points[1:]))


def effective_scale(doc: Mapping[str, Any]) -> tuple[float, bool]:
    """Metres per version pixel and whether it is only an estimate (no calibration: a 0.2 m wall = 0.6 % of the width)."""
    dims = doc.get("dimensions") or {}
    scale = dims.get("scale_m_per_px")
    status = (dims.get("calibration") or {}).get("status")
    if _num(scale) and scale > 0 and status in ("measured", "estimated"):
        return float(scale), status == "estimated"
    return DEFAULT_WALL_THICKNESS_M / (ESTIMATED_WALL_FRACTION * int(dims.get("width_px") or 1000)), True


def two_point_scale(pairs: list[tuple[Any, Any, float]], width_px: int, height_px: int) -> tuple[float, float]:
    """Metres per version pixel from (a, b, metres) pairs: a length-weighted mean; the residual is the largest relative
    disagreement of one pair with the mean, in percent (0 for a single pair)."""
    scales: list[float] = []
    weights: list[float] = []
    for a, b, metres in pairs:
        d = math.hypot((b[0] - a[0]) * width_px, (b[1] - a[1]) * height_px)
        if d < 5:
            raise ValueError("points_too_close")
        scales.append(metres / d)
        weights.append(d)
    mean = sum(s * w for s, w in zip(scales, weights)) / sum(weights)
    residual = max(abs(s - mean) / mean for s in scales) * 100 if len(scales) > 1 else 0.0
    return mean, round(residual, 2)


# ---------------------------------------------------------------- validation

def validate(doc: Any) -> list[dict[str, Any]]:
    issues: list[dict[str, Any]] = []
    if not isinstance(doc, dict):
        _issue(issues, "type", "המסמך חייב להיות אובייקט JSON.", structural=True)
        return issues
    if doc.get("schema_version") != SCHEMA_VERSION:
        _issue(issues, "schema_version", f"schema_version חייב להיות {SCHEMA_VERSION}.", path="schema_version", structural=True)
    dims = doc.get("dimensions")
    if not isinstance(dims, dict) or not all(isinstance(dims.get(k), int) and not isinstance(dims.get(k), bool) and dims.get(k) > 0 for k in ("width_px", "height_px")):
        _issue(issues, "dimensions", "dimensions.width_px ו־height_px חייבים להיות מספרים שלמים חיוביים.", path="dimensions", structural=True)
    for coll in COLLECTIONS:
        items = doc.get(coll)
        if not isinstance(items, list):
            _issue(issues, "type", f"{coll} חייב להיות רשימה.", path=coll, structural=True)
            continue
        if len(items) > LIMITS[coll]:
            _issue(issues, "limit", f"{coll}: יותר מ־{LIMITS[coll]} פריטים.", path=coll, structural=True)
        for i, item in enumerate(items):
            if not isinstance(item, dict) or not isinstance(item.get("id"), str) or not 1 <= len(item["id"]) <= 64:
                _issue(issues, "type", f"{coll}[{i}] חייב להיות אובייקט עם id טקסטואלי.", path=f"{coll}[{i}]", structural=True)
    if any(i["structural"] for i in issues):
        return issues
    width, height = dims["width_px"], dims["height_px"]
    seen: dict[str, str] = {}
    for coll in COLLECTIONS:
        for item in doc[coll]:
            if item["id"] in seen:
                _issue(issues, "duplicate_id", f"המזהה {item['id']} מופיע פעמיים ({seen[item['id']]}, {coll}).", item=item["id"], path=coll)
            else:
                seen[item["id"]] = coll
    _check_calibration(dims, issues)
    levels = _check_levels(doc["levels"], issues)
    walls = _check_walls(doc["walls"], levels, width, height, issues)
    _check_openings(doc, walls, width, height, issues)
    _check_labels(doc["labels"], levels, issues)
    _check_rooms(doc["rooms"], levels, issues)
    unc = doc.get("uncertainty")
    if not isinstance(unc, dict) or not _unit(unc.get("overall")) or not isinstance(unc.get("notes"), list):
        _issue(issues, "uncertainty", "uncertainty צריך overall בין 0 ל־1 ורשימת notes.", path="uncertainty")
    return issues


def _check_calibration(dims: dict[str, Any], issues: list[dict[str, Any]]) -> None:
    cal = dims.get("calibration")
    if not isinstance(cal, dict) or cal.get("status") not in CAL_STATUSES:
        _issue(issues, "calibration", "סטטוס הכיול חייב להיות measured / estimated / missing.", path="dimensions.calibration")
        return
    if cal["status"] == "missing":
        if not cal.get("reason"):
            _issue(issues, "calibration", "כיול חסר דורש סיבה.", path="dimensions.calibration.reason")
    elif not (_num(dims.get("scale_m_per_px")) and dims["scale_m_per_px"] > 0):
        _issue(issues, "calibration", "כיול קיים דורש scale_m_per_px חיובי.", path="dimensions.scale_m_per_px")
    if cal.get("method") is not None and cal.get("method") not in CAL_METHODS:
        _issue(issues, "enum", "שיטת כיול לא מוכרת.", path="dimensions.calibration.method")


def _check_levels(levels: list[dict[str, Any]], issues: list[dict[str, Any]]) -> set[str]:
    ids: set[str] = set()
    elevations: set[float] = set()
    if not levels:
        _issue(issues, "levels", "לקומה צריך להיות לפחות מפלס אחד.", path="levels")
    for lv in levels:
        ids.add(lv["id"])
        el, ceil = lv.get("elevation_m"), lv.get("ceiling_height_m")
        if not _num(el) or not -50 <= el <= 500:
            _issue(issues, "elevation", "גובה רצפת המפלס בין מינוס 50 ל־500 מ׳.", item=lv["id"], path="levels")
        elif el in elevations:
            _issue(issues, "duplicate_elevation", f"שני מפלסים באותו גובה ({el} מ׳).", item=lv["id"], path="levels")
        else:
            elevations.add(el)
        if not _num(ceil) or not 0 < ceil <= 50:
            _issue(issues, "ceiling", "גובה התקרה בין 0 ל־50 מ׳.", item=lv["id"], path="levels")
        if not isinstance(lv.get("name"), str) or not lv["name"].strip():
            _issue(issues, "name", "למפלס צריך שם.", item=lv["id"], path="levels")
    if levels and sum(1 for lv in levels if lv.get("is_default") is True) != 1:
        _issue(issues, "levels", "בדיוק מפלס אחד מסומן כמפלס ברירת המחדל.", path="levels")
    return ids


def _check_walls(walls: list[dict[str, Any]], levels: set[str], width: int, height: int, issues: list[dict[str, Any]]) -> dict[str, dict[str, Any]]:
    ok: dict[str, dict[str, Any]] = {}
    for w in walls:
        wid = w["id"]
        pl = w.get("polyline")
        if not isinstance(pl, list) or len(pl) < 2 or not all(_pt(p) for p in pl):
            _issue(issues, "bounds", "קיר צריך לפחות שתי נקודות בתוך התוכנית.", item=wid, path="walls")
            continue
        if polyline_length_px(pl, width, height) < 1:
            _issue(issues, "too_short", "הקיר קצר מדי (אורך אפס).", item=wid, path="walls")
        if w.get("level_id") not in levels:
            _issue(issues, "unknown_level", "הקיר שייך למפלס שלא קיים.", item=wid, path="walls")
        if not (_num(w.get("thickness_m")) and 0 < w["thickness_m"] <= 3):
            _issue(issues, "thickness", "עובי קיר בין 0 ל־3 מ׳.", item=wid, path="walls")
        h = w.get("height_m")
        if h is not None and not (_num(h) and 0 < h <= 50):
            _issue(issues, "height", "גובה קיר בין 0 ל־50 מ׳ (ריק = עד התקרה).", item=wid, path="walls")
        z = w.get("base_z_m", 0)
        if not (_num(z) and -10 <= z <= 50):
            _issue(issues, "base_z", "גובה תחתית הקיר בין מינוס 10 ל־50 מ׳.", item=wid, path="walls")
        if w.get("kind") not in WALL_KINDS or w.get("source") not in SOURCES:
            _issue(issues, "enum", "סוג קיר או מקור (source) לא מוכרים.", item=wid, path="walls")
        if not _unit(w.get("confidence")):
            _issue(issues, "confidence", "confidence בין 0 ל־1.", item=wid, path="walls")
        ok[wid] = w
    return ok


def _check_openings(doc: dict[str, Any], walls: dict[str, dict[str, Any]], width: int, height: int, issues: list[dict[str, Any]]) -> None:
    scale, _ = effective_scale(doc)
    spans: dict[str, list[tuple[float, float, str]]] = {}
    for o in doc["openings"]:
        oid = o["id"]
        wall = walls.get(o.get("wall_id"))
        if wall is None:
            _issue(issues, "unknown_wall", "הפתח מחובר לקיר שלא קיים.", item=oid, path="openings")
            continue
        if o.get("kind") not in OPENING_KINDS or o.get("swing") not in SWINGS or o.get("hinge") not in HINGES:
            _issue(issues, "enum", "סוג פתח, כיוון פתיחה או ציר לא מוכרים.", item=oid, path="openings")
        if o.get("source") not in SOURCES or not _unit(o.get("confidence")):
            _issue(issues, "enum", "מקור או confidence לא תקינים.", item=oid, path="openings")
        for key in ("height_m", "sill_m"):
            v = o.get(key)
            if not (_num(v) and 0 <= v <= 10) or (key == "height_m" and v == 0):
                _issue(issues, "size", f"{key} מחוץ לטווח.", item=oid, path="openings")
        ref = o.get("anchor_ref")
        if ref is not None and not (isinstance(ref, dict) and ref.get("resource_type") in ANCHOR_TYPES and isinstance(ref.get("resource_id"), str) and ref["resource_id"]):
            _issue(issues, "anchor_ref", "anchor_ref צריך resource_type ו־resource_id.", item=oid, path="openings")
        t, width_m = o.get("t"), o.get("width_m")
        if not _unit(t):
            _issue(issues, "bounds", "מיקום הפתח על הקיר (t) בין 0 ל־1.", item=oid, path="openings")
            continue
        if not (_num(width_m) and 0 < width_m <= 10):
            _issue(issues, "width", "רוחב פתח בין 0 ל־10 מ׳.", item=oid, path="openings")
            continue
        length_m = polyline_length_px(wall["polyline"], width, height) * scale
        centre = t * length_m
        if centre - width_m / 2 < -0.01 or centre + width_m / 2 > length_m + 0.01:
            _issue(issues, "opening_outside_wall", "הפתח חורג מאורך הקיר.", item=oid, path="openings")
        spans.setdefault(wall["id"], []).append((centre - width_m / 2, centre + width_m / 2, oid))
    for items in spans.values():
        items.sort()
        for (_a0, a1, first), (b0, _b1, second) in zip(items, items[1:]):
            if b0 < a1 - 0.01:
                _issue(issues, "overlap", f"הפתחים {first} ו־{second} חופפים על אותו קיר.", item=second, path="openings", severity="warning")


def _check_labels(labels: list[dict[str, Any]], levels: set[str], issues: list[dict[str, Any]]) -> None:
    for lb in labels:
        if not _pt(lb.get("position")):
            _issue(issues, "bounds", "מיקום התווית מחוץ לתוכנית.", item=lb["id"], path="labels")
        if not isinstance(lb.get("text"), str) or not 1 <= len(lb["text"].strip()) <= 80:
            _issue(issues, "text", "טקסט התווית 1 עד 80 תווים.", item=lb["id"], path="labels")
        if lb.get("level_id") not in levels:
            _issue(issues, "unknown_level", "התווית שייכת למפלס שלא קיים.", item=lb["id"], path="labels")
        if not (_num(lb.get("size")) and 6 <= lb["size"] <= 200):
            _issue(issues, "size", "גודל תווית בין 6 ל־200.", item=lb["id"], path="labels")


def _check_rooms(rooms: list[dict[str, Any]], levels: set[str], issues: list[dict[str, Any]]) -> None:
    for r in rooms:
        if r.get("level_id") is not None and r["level_id"] not in levels:
            _issue(issues, "unknown_level", "החדר שייך למפלס שלא קיים.", item=r["id"], path="rooms")
        c = r.get("ceiling_height_m")
        if c is not None and not (_num(c) and 0 < c <= 50):
            _issue(issues, "ceiling", "גובה תקרת החדר בין 0 ל־50 מ׳.", item=r["id"], path="rooms")
```

(The `copy` import is used by Task 3.)

- [ ] **Step 4: Write `contracts/schemas/plan_geometry.v2.schema.json`**

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://smplwise.local/contracts/plan_geometry.v2.schema.json",
  "title": "SMPLWISE plan geometry document v2 (Plan Studio, T084 / CR-003)",
  "description": "The structure layer of one plan version. Coordinates are normalized 0..1 to the plan version image (origin top-left), points are [x, y]; sizes are metres; the server owns plan_version_id, floor_id, source, dimensions and transform.",
  "type": "object",
  "required": ["schema_version", "plan_version_id", "floor_id", "source", "dimensions", "transform", "levels", "walls", "openings", "rooms", "objects", "circuits", "connectors", "labels", "groups", "uncertain_regions", "uncertainty", "meta"],
  "properties": {
    "schema_version": {"const": "2.0"},
    "plan_version_id": {"type": "string"},
    "floor_id": {"type": "string"},
    "source": {"type": "object", "required": ["sha256", "page"], "properties": {"sha256": {"type": "string", "pattern": "^[0-9a-f]{64}$"}, "file_name": {"type": "string"}, "mime": {"type": "string"}, "page": {"type": "integer", "minimum": 1}}},
    "dimensions": {"type": "object", "required": ["width_px", "height_px", "scale_m_per_px", "calibration"], "properties": {"width_px": {"type": "integer", "minimum": 1}, "height_px": {"type": "integer", "minimum": 1}, "scale_m_per_px": {"type": ["number", "null"], "exclusiveMinimum": 0}, "calibration": {"$ref": "#/$defs/calibration"}}},
    "transform": {"type": "object", "required": ["rotation"], "properties": {"rotation": {"enum": [0, 90, 180, 270]}, "crop": {"type": ["object", "null"]}}},
    "levels": {"type": "array", "minItems": 1, "maxItems": 20, "items": {"$ref": "#/$defs/level"}},
    "walls": {"type": "array", "maxItems": 2000, "items": {"$ref": "#/$defs/wall"}},
    "openings": {"type": "array", "maxItems": 4000, "items": {"$ref": "#/$defs/opening"}},
    "rooms": {"type": "array", "maxItems": 500, "items": {"$ref": "#/$defs/room"}},
    "objects": {"type": "array", "maxItems": 5000, "items": {"$ref": "#/$defs/item"}},
    "circuits": {"type": "array", "maxItems": 500, "items": {"$ref": "#/$defs/item"}},
    "connectors": {"type": "array", "maxItems": 200, "items": {"$ref": "#/$defs/item"}},
    "labels": {"type": "array", "maxItems": 1000, "items": {"$ref": "#/$defs/label"}},
    "groups": {"type": "array", "maxItems": 500, "items": {"$ref": "#/$defs/item"}},
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
    "level": {"type": "object", "required": ["id", "name", "elevation_m", "ceiling_height_m", "is_default"], "properties": {"id": {"$ref": "#/$defs/id"}, "name": {"type": "string", "minLength": 1}, "elevation_m": {"type": "number", "minimum": -50, "maximum": 500}, "ceiling_height_m": {"type": "number", "exclusiveMinimum": 0, "maximum": 50}, "is_default": {"type": "boolean"}, "external_ids": {"$ref": "#/$defs/external_ids"}}},
    "wall": {"type": "object", "required": ["id", "level_id", "polyline", "thickness_m", "kind", "confidence", "source"], "properties": {"id": {"$ref": "#/$defs/id"}, "level_id": {"type": "string"}, "polyline": {"type": "array", "minItems": 2, "items": {"$ref": "#/$defs/point"}}, "thickness_m": {"type": "number", "exclusiveMinimum": 0, "maximum": 3}, "height_m": {"type": ["number", "null"]}, "base_z_m": {"type": "number"}, "kind": {"enum": ["exterior", "interior", "partition", "railing", "low"]}, "confidence": {"$ref": "#/$defs/unit"}, "source": {"$ref": "#/$defs/source"}, "locked": {"type": "boolean"}, "external_ids": {"$ref": "#/$defs/external_ids"}}},
    "opening": {"type": "object", "required": ["id", "wall_id", "t", "kind", "width_m", "height_m", "sill_m", "swing", "hinge", "confidence", "source"], "properties": {"id": {"$ref": "#/$defs/id"}, "wall_id": {"type": "string"}, "t": {"$ref": "#/$defs/unit"}, "kind": {"enum": ["door", "window", "passage"]}, "width_m": {"type": "number", "exclusiveMinimum": 0, "maximum": 10}, "height_m": {"type": "number", "exclusiveMinimum": 0, "maximum": 10}, "sill_m": {"type": "number", "minimum": 0, "maximum": 10}, "swing": {"enum": ["left", "right", "double", "sliding", "none"]}, "hinge": {"enum": ["start", "end"]}, "anchor_ref": {"$ref": "#/$defs/anchor_ref"}, "confidence": {"$ref": "#/$defs/unit"}, "source": {"$ref": "#/$defs/source"}, "external_ids": {"$ref": "#/$defs/external_ids"}}},
    "room": {"type": "object", "required": ["id"], "properties": {"id": {"$ref": "#/$defs/id"}, "level_id": {"type": ["string", "null"]}, "ceiling_height_m": {"type": ["number", "null"]}, "external_ids": {"$ref": "#/$defs/external_ids"}}},
    "label": {"type": "object", "required": ["id", "text", "position", "level_id", "size"], "properties": {"id": {"$ref": "#/$defs/id"}, "text": {"type": "string", "minLength": 1, "maxLength": 80}, "position": {"$ref": "#/$defs/point"}, "level_id": {"type": "string"}, "size": {"type": "number", "minimum": 6, "maximum": 200}}},
    "item": {"type": "object", "required": ["id"], "properties": {"id": {"$ref": "#/$defs/id"}}}
  }
}
```

- [ ] **Step 5: Run the tests to see them pass**

Run: `cd smplwise_vms/backend && MSYS_NO_PATHCONV=1 $PY -m pytest tests/test_plan_geometry_model.py -p no:cacheprovider`
Expected: `7 passed`.

- [ ] **Step 6: Commit**

```bash
git add smplwise_vms/backend/smplwise/services/plan_geometry.py contracts/schemas/plan_geometry.v2.schema.json smplwise_vms/backend/tests/test_plan_geometry_model.py
msg=$(mktemp) && cat > "$msg" <<'EOF'
feat(plan-studio): geometry document v2 - construction, rebase, validation, schema contract (T084)

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOF
test "$(bash /c/cloude/smplwisebms/secrets/scan_staged.sh)" = 0 && git commit -F "$msg"
```

---

### Task 3: Diff, crop transform

**Files:**
- Modify: `smplwise_vms/backend/smplwise/services/plan_geometry.py` (append)
- Test: `smplwise_vms/backend/tests/test_plan_geometry_model.py` (append)

**Interfaces:**
- Produces: `diff(old: dict | None, new: dict) -> {"collections": {coll: {"added": [ids], "removed": [ids], "changed": [ids]}}, "total": int, "calibration_changed": bool, "same": bool}`; `transform_crop(doc, old_crop: dict | None, new_crop: dict | None) -> dict` (deep copy; walls and labels mapped through both crops, clamped, a note added).

- [ ] **Step 1: Append the failing tests**

```python
def test_diff_names_added_removed_and_changed_items():
    a = _doc()
    b = copy.deepcopy(a)
    b["walls"][0]["thickness_m"] = 0.3
    b["walls"].pop(1)
    b["labels"].append({"id": "t2", "text": "x", "position": [0.1, 0.1], "level_id": "L0", "size": 12})
    d = pg.diff(a, b)
    assert d["collections"]["walls"] == {"added": [], "removed": ["w2"], "changed": ["w1"]}
    assert d["collections"]["labels"] == {"added": ["t2"], "removed": [], "changed": []}
    assert d["total"] == 3 and d["same"] is False and d["calibration_changed"] is False
    assert pg.diff(a, copy.deepcopy(a))["same"] is True
    first = pg.diff(None, a)
    assert first["collections"]["walls"]["added"] == ["w1", "w2"] and first["calibration_changed"] is False
    c = copy.deepcopy(a)
    c["dimensions"]["scale_m_per_px"] = 0.03
    assert pg.diff(a, c)["calibration_changed"] is True


def test_transform_crop_maps_points_through_both_crops():
    d = _doc()
    out = pg.transform_crop(d, None, {"x": 0.0, "y": 0.0, "w": 0.5, "h": 1.0})
    assert out["walls"][0]["polyline"] == [[0.2, 0.2], [1.0, 0.2]]
    assert out["labels"][0]["position"] == [0.6, 0.4]
    assert d["walls"][0]["polyline"] == [[0.1, 0.2], [0.5, 0.2]], "the input is not modified"
    assert any("חיתוך" in n for n in out["uncertainty"]["notes"])


def test_counts():
    assert pg.counts(_doc()) == {"walls": 2, "openings": 1, "labels": 1, "objects": 0}
```

- [ ] **Step 2: Run to see the two new ones fail**

Run: `cd smplwise_vms/backend && MSYS_NO_PATHCONV=1 $PY -m pytest tests/test_plan_geometry_model.py -p no:cacheprovider`
Expected: 2 FAIL (`module 'plan_geometry' has no attribute 'diff'` / `transform_crop`), 8 pass.

- [ ] **Step 3: Append to `plan_geometry.py`**

```python
# ---------------------------------------------------------------- comparison and transforms

def diff(old: Mapping[str, Any] | None, new: Mapping[str, Any]) -> dict[str, Any]:
    """What publishing `new` changes against `old`: ids added, removed and changed per collection, and whether the
    calibration moved. `old` is None for a first publish."""
    out: dict[str, dict[str, list[str]]] = {}
    total = 0
    for coll in DIFF_COLLECTIONS:
        a = {i["id"]: i for i in (old or {}).get(coll, []) if isinstance(i, dict) and isinstance(i.get("id"), str)}
        b = {i["id"]: i for i in new.get(coll, []) if isinstance(i, dict) and isinstance(i.get("id"), str)}
        added = sorted(set(b) - set(a))
        removed = sorted(set(a) - set(b))
        changed = sorted(k for k in set(a) & set(b) if canonical_json(a[k]) != canonical_json(b[k]))
        if added or removed or changed:
            out[coll] = {"added": added, "removed": removed, "changed": changed}
            total += len(added) + len(removed) + len(changed)
    old_dims = (old or {}).get("dimensions") or {}
    new_dims = new.get("dimensions") or {}
    cal = old is not None and (canonical_json(old_dims.get("calibration") or {}) != canonical_json(new_dims.get("calibration") or {})
                               or old_dims.get("scale_m_per_px") != new_dims.get("scale_m_per_px"))
    return {"collections": out, "total": total, "calibration_changed": bool(cal), "same": total == 0 and not cal}


def transform_crop(doc: Mapping[str, Any], old_crop: Mapping[str, Any] | None, new_crop: Mapping[str, Any] | None) -> dict[str, Any]:
    """A re-crop of the same page: every point goes through the old crop to the page and back through the new one
    (the anchors' realign uses the same maths). Points outside the new crop are clamped to its edge and a note says so."""
    oc = old_crop or {"x": 0.0, "y": 0.0, "w": 1.0, "h": 1.0}
    nc = new_crop or {"x": 0.0, "y": 0.0, "w": 1.0, "h": 1.0}

    def move(p: Any) -> list[float]:
        sx, sy = oc["x"] + p[0] * oc["w"], oc["y"] + p[1] * oc["h"]
        return [min(1.0, max(0.0, round((sx - nc["x"]) / nc["w"], 6))), min(1.0, max(0.0, round((sy - nc["y"]) / nc["h"], 6)))]

    out = copy.deepcopy(dict(doc))
    for w in out.get("walls", []):
        w["polyline"] = [move(p) for p in w["polyline"]]
    for lb in out.get("labels", []):
        lb["position"] = move(lb["position"])
    unc = out.setdefault("uncertainty", {"overall": 0.5, "notes": []})
    unc["notes"] = [*unc.get("notes", []), "המבנה הועבר מגרסה עם חיתוך אחר; נקודות שמחוץ לחיתוך הוצמדו לשוליים."]
    return out
```

- [ ] **Step 4: Run to see all pass**

Run: `cd smplwise_vms/backend && MSYS_NO_PATHCONV=1 $PY -m pytest tests/test_plan_geometry_model.py -p no:cacheprovider`
Expected: `10 passed`.

- [ ] **Step 5: Commit**

```bash
git add smplwise_vms/backend/smplwise/services/plan_geometry.py smplwise_vms/backend/tests/test_plan_geometry_model.py
msg=$(mktemp) && cat > "$msg" <<'EOF'
feat(plan-studio): geometry diff and crop transform (T084)

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOF
test "$(bash /c/cloude/smplwisebms/secrets/scan_staged.sh)" = 0 && git commit -F "$msg"
```

---

### Task 4: Deterministic primitives and the shared golden fixture

**Files:**
- Create: `smplwise_vms/backend/smplwise/services/plan_geometry_render.py`
- Create: `contracts/fixtures/plan_geometry/sample-v2.json`
- Create: `scripts/geometry_golden.py`
- Create (generated): `contracts/fixtures/plan_geometry/sample-v2.primitives.json`
- Test: `smplwise_vms/backend/tests/test_plan_geometry_render.py`

**Interfaces:**
- Consumes: `pg.effective_scale`, `pg.DEFAULT_WALL_THICKNESS_M`, `pg.DEFAULT_LEVEL_ID`.
- Produces: `r2(v) -> float`; `structure_primitives(doc, width, height, level=None) -> list[dict]` with shapes
  - `{"kind": "wall", "id", "part": int, "points": [[x, y], ...], "width": px}`
  - `{"kind": "door", "id", "gap": [[x, y], [x, y]], "leaves": [[[x, y], [x, y]], ...], "arcs": [{"from": [x, y], "to": [x, y], "r": px, "sweep": 0|1}, ...]}` (arc `i` turns around `leaves[i][0]`)
  - `{"kind": "window", "id", "gap", "lines": [[[x, y], [x, y]], [[x, y], [x, y]]]}`
  - `{"kind": "passage", "id", "gap"}`
  - `{"kind": "label", "id", "x", "y", "text", "size"}`
  - Order: walls by id (parts in order), then openings by id, then labels by id. Coordinates in plan pixels (`x * width`), rounded with `r2`.

- [ ] **Step 1: Write the fixture `contracts/fixtures/plan_geometry/sample-v2.json`**

```json
{
  "schema_version": "2.0",
  "plan_version_id": "sample",
  "floor_id": "sample-floor",
  "source": {"sha256": "0000000000000000000000000000000000000000000000000000000000000000", "file_name": "sample.pdf", "mime": "application/pdf", "page": 1},
  "dimensions": {"width_px": 1000, "height_px": 800, "scale_m_per_px": 0.01, "calibration": {"status": "measured", "method": "two_point", "pairs": [{"a": [0.1, 0.1], "b": [0.9, 0.1], "metres": 8.0}], "residual_pct": 0.0, "reason": null}},
  "transform": {"rotation": 0, "crop": null},
  "levels": [
    {"id": "L0", "name": "מפלס ראשי", "elevation_m": 0.0, "ceiling_height_m": 3.0, "is_default": true, "external_ids": {}},
    {"id": "L1", "name": "אולם תחתון", "elevation_m": -1.2, "ceiling_height_m": 6.0, "is_default": false, "external_ids": {}}
  ],
  "walls": [
    {"id": "wa", "level_id": "L0", "polyline": [[0.1, 0.1], [0.9, 0.1], [0.9, 0.6]], "thickness_m": 0.3, "height_m": null, "base_z_m": 0, "kind": "exterior", "confidence": 1, "source": "manual", "locked": false, "external_ids": {}},
    {"id": "wb", "level_id": "L0", "polyline": [[0.1, 0.5], [0.6, 0.5]], "thickness_m": 0.15, "height_m": null, "base_z_m": 0, "kind": "interior", "confidence": 1, "source": "manual", "locked": false, "external_ids": {}},
    {"id": "wc", "level_id": "L0", "polyline": [[0.6, 0.1], [0.6, 0.5]], "thickness_m": 0.1, "height_m": 2.4, "base_z_m": 0, "kind": "partition", "confidence": 0.8, "source": "auto", "locked": false, "external_ids": {}},
    {"id": "wd", "level_id": "L1", "polyline": [[0.1, 0.7], [0.4, 0.7]], "thickness_m": 0.2, "height_m": null, "base_z_m": 0, "kind": "interior", "confidence": 1, "source": "manual", "locked": false, "external_ids": {}}
  ],
  "openings": [
    {"id": "oa", "wall_id": "wa", "t": 0.2, "kind": "door", "width_m": 0.9, "height_m": 2.1, "sill_m": 0, "swing": "right", "hinge": "start", "anchor_ref": null, "confidence": 1, "source": "manual", "external_ids": {}},
    {"id": "ob", "wall_id": "wa", "t": 0.75, "kind": "window", "width_m": 1.2, "height_m": 1.2, "sill_m": 0.9, "swing": "none", "hinge": "start", "anchor_ref": null, "confidence": 1, "source": "manual", "external_ids": {}},
    {"id": "oc", "wall_id": "wb", "t": 0.5, "kind": "door", "width_m": 0.8, "height_m": 2.1, "sill_m": 0, "swing": "left", "hinge": "end", "anchor_ref": {"resource_type": "ha_entity", "resource_id": "lock.store"}, "confidence": 1, "source": "manual", "external_ids": {}},
    {"id": "od", "wall_id": "wc", "t": 0.5, "kind": "door", "width_m": 1.6, "height_m": 2.1, "sill_m": 0, "swing": "double", "hinge": "start", "anchor_ref": null, "confidence": 1, "source": "manual", "external_ids": {}},
    {"id": "oe", "wall_id": "wb", "t": 0.9, "kind": "passage", "width_m": 1.0, "height_m": 2.1, "sill_m": 0, "swing": "none", "hinge": "start", "anchor_ref": null, "confidence": 1, "source": "manual", "external_ids": {}},
    {"id": "of", "wall_id": "wd", "t": 0.5, "kind": "door", "width_m": 1.0, "height_m": 2.1, "sill_m": 0, "swing": "sliding", "hinge": "start", "anchor_ref": null, "confidence": 1, "source": "manual", "external_ids": {}}
  ],
  "rooms": [],
  "objects": [],
  "circuits": [],
  "connectors": [],
  "labels": [
    {"id": "la", "text": "מחסן", "position": [0.3, 0.3], "level_id": "L0", "size": 16},
    {"id": "lb", "text": "אולם", "position": [0.25, 0.75], "level_id": "L1", "size": 16}
  ],
  "groups": [],
  "uncertain_regions": [],
  "uncertainty": {"overall": 0.2, "notes": []},
  "meta": {"generator": "fixture", "tokens_version": "map-1", "detector_version": null}
}
```

- [ ] **Step 2: Write the failing tests `tests/test_plan_geometry_render.py`**

```python
"""Plan Studio drawing (T084): the structure primitives are deterministic, openings cut their wall, free wall ends are
extended by half the thickness, the level filter works, and the golden file the frontend compares with is current."""
from __future__ import annotations

import json
import pathlib

from smplwise.services import plan_geometry as pg
from smplwise.services import plan_geometry_render as render

FIX = pathlib.Path(__file__).resolve().parents[3] / "contracts" / "fixtures" / "plan_geometry"


def _sample() -> dict:
    return json.loads((FIX / "sample-v2.json").read_text(encoding="utf-8"))


def test_the_sample_fixture_is_a_valid_document():
    assert [i for i in pg.validate(_sample()) if i["severity"] == "error"] == []


def test_openings_cut_their_wall_and_free_ends_are_extended():
    prims = render.structure_primitives(_sample(), 1000, 800)
    wb = [p for p in prims if p["kind"] == "wall" and p["id"] == "wb"]
    # wb: (100,400)-(600,400), 15 px thick; door oc cuts [310, 390], passage oe cuts [500, 600] up to the wall end
    assert [p["points"] for p in wb] == [[[92.5, 400.0], [310.0, 400.0]], [[390.0, 400.0], [500.0, 400.0]]]
    assert [p["part"] for p in wb] == [0, 1] and wb[0]["width"] == 15.0
    door = next(p for p in prims if p["id"] == "oc")
    assert door["kind"] == "door" and door["gap"] == [[310.0, 400.0], [390.0, 400.0]]
    assert len(door["leaves"]) == 1 and door["leaves"][0][0] == [390.0, 400.0] and door["arcs"][0]["r"] == 80.0
    assert len(next(p for p in prims if p["id"] == "od")["leaves"]) == 2
    assert [p["kind"] for p in prims if p["id"] == "ob"] == ["window"]
    assert [p["kind"] for p in prims if p["id"] == "oe"] == ["passage"]
    wa_parts = [p for p in prims if p["kind"] == "wall" and p["id"] == "wa"]
    assert len(wa_parts) == 3 and wa_parts[1]["points"] == [[385.0, 80.0], [900.0, 80.0], [900.0, 120.0]]
    assert [p["id"] for p in prims if p["kind"] == "label"] == ["la", "lb"]


def test_level_filter():
    prims = render.structure_primitives(_sample(), 1000, 800, "L1")
    assert sorted({p["id"] for p in prims}) == ["lb", "of", "wd"]
    assert [p["id"] for p in prims if p["kind"] == "wall"] == ["wd", "wd"]


def test_primitives_are_deterministic_and_match_the_golden_file():
    doc = _sample()
    assert render.structure_primitives(doc, 1000, 800) == render.structure_primitives(json.loads(json.dumps(doc)), 1000, 800)
    golden = json.loads((FIX / "sample-v2.primitives.json").read_text(encoding="utf-8"))
    assert golden["width"] == 1000 and golden["height"] == 800
    assert render.structure_primitives(doc, 1000, 800) == golden["all"]
    assert render.structure_primitives(doc, 1000, 800, "L1") == golden["level_L1"]
```

- [ ] **Step 3: Run to see them fail**

Run: `cd smplwise_vms/backend && MSYS_NO_PATHCONV=1 $PY -m pytest tests/test_plan_geometry_render.py -p no:cacheprovider`
Expected: FAIL — `cannot import name 'plan_geometry_render'` (the fixture test passes).

- [ ] **Step 4: Write `services/plan_geometry_render.py` (primitives only; exports come in Task 8)**

```python
"""Deterministic drawing of the Plan Studio structure layer (T084, CR-003). structure_primitives() turns a v2 document
into plain shapes in plan pixels - walls cut by their openings (free ends extended by half the thickness so corners
close), door leaves and swing arcs, window glass, passages, labels. The SVG / PNG exports draw exactly these shapes and
frontend/src/map/geometry.ts computes the same list for the map; contracts/fixtures/plan_geometry pins both.
Coordinates are rounded half-up to 0.01 px, the same arithmetic on both sides."""
from __future__ import annotations

import math
from typing import Any

from .plan_geometry import DEFAULT_WALL_THICKNESS_M, effective_scale

Point = tuple[float, float]


def r2(v: float) -> float:
    return math.floor(v * 100 + 0.5) / 100


def _p(p: Point) -> list[float]:
    return [r2(p[0]), r2(p[1])]


def _cum(pts: list[Point]) -> list[float]:
    out = [0.0]
    for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
        out.append(out[-1] + math.hypot(x1 - x0, y1 - y0))
    return out


def point_at(pts: list[Point], cum: list[float], s: float) -> tuple[Point, Point]:
    """The point at arc length s along a polyline and the unit direction of the segment it lies on."""
    i = 0
    while i < len(pts) - 2 and s > cum[i + 1]:
        i += 1
    (x0, y0), (x1, y1) = pts[i], pts[i + 1]
    seg = cum[i + 1] - cum[i]
    if seg <= 1e-9:
        return (x0, y0), (1.0, 0.0)
    f = min(1.0, max(0.0, (s - cum[i]) / seg))
    return (x0 + (x1 - x0) * f, y0 + (y1 - y0) * f), ((x1 - x0) / seg, (y1 - y0) / seg)


def sub_polyline(pts: list[Point], cum: list[float], s0: float, s1: float) -> list[Point]:
    a, _ = point_at(pts, cum, s0)
    b, _ = point_at(pts, cum, s1)
    return [a, *[pts[i] for i in range(1, len(pts) - 1) if s0 < cum[i] < s1], b]


def _extend(p: Point, q: Point, by: float) -> Point:
    """Move p away from q by `by` (a free wall end grows by half the thickness, like a square cap)."""
    dx, dy = p[0] - q[0], p[1] - q[1]
    n = math.hypot(dx, dy)
    return p if n < 1e-9 else (p[0] + dx / n * by, p[1] + dy / n * by)


def _add(p: Point, v: Point, k: float) -> Point:
    return (p[0] + v[0] * k, p[1] + v[1] * k)


def _sweep(c: Point, a: Point, b: Point) -> int:
    """SVG sweep flag of the short arc a -> b around c (y points down: a positive cross product turns clockwise on screen)."""
    return 1 if (a[0] - c[0]) * (b[1] - c[1]) - (a[1] - c[1]) * (b[0] - c[0]) > 0 else 0


def _door(g0: Point, g1: Point, d: Point, opening: dict[str, Any], w: float) -> dict[str, Any]:
    nl: Point = (d[1], -d[0])  # the left of the wall direction
    nr: Point = (-d[1], d[0])
    swing = opening.get("swing") or "right"
    if swing == "none":
        return {"leaves": [], "arcs": []}
    if swing == "sliding":
        k = w * 0.12
        return {"leaves": [[_p(_add(g0, nl, k)), _p(_add(g1, nl, k))]], "arcs": []}
    if swing == "double":
        h = w / 2
        leaves: list[list[list[float]]] = []
        arcs: list[dict[str, Any]] = []
        for hinge, along in ((g0, d), (g1, (-d[0], -d[1]))):
            tip = _add(hinge, nl, h)
            mid = _add(hinge, along, h)
            leaves.append([_p(hinge), _p(tip)])
            arcs.append({"from": _p(tip), "to": _p(mid), "r": r2(h), "sweep": _sweep(hinge, tip, mid)})
        return {"leaves": leaves, "arcs": arcs}
    n = nl if swing == "left" else nr
    hinge, other = (g0, g1) if (opening.get("hinge") or "start") == "start" else (g1, g0)
    tip = _add(hinge, n, w)
    return {"leaves": [[_p(hinge), _p(tip)]], "arcs": [{"from": _p(tip), "to": _p(other), "r": r2(w), "sweep": _sweep(hinge, tip, other)}]}


def structure_primitives(doc: dict[str, Any], width: float, height: float, level: str | None = None) -> list[dict[str, Any]]:
    scale, _ = effective_scale(doc)
    px_per_m = 1.0 / scale
    walls = {w["id"]: w for w in doc.get("walls", [])}
    by_wall: dict[Any, list[dict[str, Any]]] = {}
    for o in doc.get("openings", []):
        by_wall.setdefault(o.get("wall_id"), []).append(o)
    prims: list[dict[str, Any]] = []
    geo: dict[str, tuple[list[Point], list[float], float]] = {}
    for wid in sorted(walls):
        w = walls[wid]
        if level is not None and w.get("level_id") != level:
            continue
        pts: list[Point] = [(float(p[0]) * width, float(p[1]) * height) for p in w["polyline"]]
        cum = _cum(pts)
        total = cum[-1]
        if total <= 1e-6:
            continue
        wpx = max(1.0, float(w.get("thickness_m") or DEFAULT_WALL_THICKNESS_M) * px_per_m)
        geo[wid] = (pts, cum, wpx)
        cuts: list[tuple[float, float]] = []
        for o in by_wall.get(wid, []):
            c = float(o.get("t") or 0) * total
            half = float(o.get("width_m") or 0) * px_per_m / 2
            cuts.append((max(0.0, c - half), min(total, c + half)))
        cuts.sort()
        keep: list[tuple[float, float]] = []
        cursor = 0.0
        for a, b in cuts:
            if a > cursor:
                keep.append((cursor, a))
            cursor = max(cursor, b)
        if cursor < total:
            keep.append((cursor, total))
        part = 0
        for s0, s1 in keep:
            if s1 - s0 <= 0.01:
                continue
            seg = sub_polyline(pts, cum, s0, s1)
            if s0 <= 0:
                seg[0] = _extend(seg[0], seg[1], wpx / 2)
            if s1 >= total:
                seg[-1] = _extend(seg[-1], seg[-2], wpx / 2)
            prims.append({"kind": "wall", "id": wid, "part": part, "points": [_p(q) for q in seg], "width": r2(wpx)})
            part += 1
    for o in sorted(doc.get("openings", []), key=lambda o: o["id"]):
        g = geo.get(o.get("wall_id"))
        if g is None:
            continue
        pts, cum, wpx = g
        c, d = point_at(pts, cum, float(o.get("t") or 0) * cum[-1])
        w = float(o.get("width_m") or 0) * px_per_m
        g0, g1 = _add(c, d, -w / 2), _add(c, d, w / 2)
        base = {"id": o["id"], "gap": [_p(g0), _p(g1)]}
        if o.get("kind") == "door":
            prims.append({"kind": "door", **base, **_door(g0, g1, d, o, w)})
        elif o.get("kind") == "window":
            nl: Point = (d[1], -d[0])
            q = wpx / 4
            prims.append({"kind": "window", **base, "lines": [[_p(_add(g0, nl, q)), _p(_add(g1, nl, q))], [_p(_add(g0, nl, -q)), _p(_add(g1, nl, -q))]]})
        else:
            prims.append({"kind": "passage", **base})
    for lb in sorted(doc.get("labels", []), key=lambda l: l["id"]):
        if level is not None and lb.get("level_id") != level:
            continue
        prims.append({"kind": "label", "id": lb["id"], "x": r2(float(lb["position"][0]) * width), "y": r2(float(lb["position"][1]) * height),
                      "text": str(lb.get("text") or ""), "size": r2(float(lb.get("size") or 14))})
    return prims
```

- [ ] **Step 5: Write `scripts/geometry_golden.py` and generate the golden file**

```python
"""Regenerate contracts/fixtures/plan_geometry/sample-v2.primitives.json from sample-v2.json with the backend renderer.
Run it after an intentional change to the primitives; frontend/tests/unit-geometry.spec.ts compares its own output with
this file, so the map and the exports keep drawing the same shapes. `--check` exits 1 when the file is stale."""
from __future__ import annotations

import json
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "smplwise_vms" / "backend"))

from smplwise.services import plan_geometry_render as render  # noqa: E402

FIX = ROOT / "contracts" / "fixtures" / "plan_geometry"


def main() -> int:
    doc = json.loads((FIX / "sample-v2.json").read_text(encoding="utf-8"))
    out = {"width": 1000, "height": 800, "all": render.structure_primitives(doc, 1000, 800), "level_L1": render.structure_primitives(doc, 1000, 800, "L1")}
    text = json.dumps(out, ensure_ascii=False, indent=1) + "\n"
    target = FIX / "sample-v2.primitives.json"
    if "--check" in sys.argv:
        return 0 if target.exists() and target.read_text(encoding="utf-8") == text else 1
    target.write_text(text, encoding="utf-8", newline="\n")
    print(f"written {target.relative_to(ROOT)}: {len(out['all'])} primitives")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
```

Run: `$PY scripts/geometry_golden.py`
Expected: `written contracts/fixtures/plan_geometry/sample-v2.primitives.json: 17 primitives` - 9 wall parts (wa 3, wb 2, wc 2, wd 2: every opening cuts its wall), 6 openings, 2 labels. Open the file and check that `oc`'s leaf starts at `[390.0, 400.0]`.

- [ ] **Step 6: Run the tests to see them pass**

Run: `cd smplwise_vms/backend && MSYS_NO_PATHCONV=1 $PY -m pytest tests/test_plan_geometry_render.py -p no:cacheprovider`
Expected: `4 passed`. Also `$PY scripts/geometry_golden.py --check; echo $?` prints `0`.

- [ ] **Step 7: Commit**

```bash
git add smplwise_vms/backend/smplwise/services/plan_geometry_render.py contracts/fixtures/plan_geometry scripts/geometry_golden.py smplwise_vms/backend/tests/test_plan_geometry_render.py
msg=$(mktemp) && cat > "$msg" <<'EOF'
feat(plan-studio): deterministic structure primitives and the shared golden fixture (T084)

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOF
test "$(bash /c/cloude/smplwisebms/secrets/scan_staged.sh)" = 0 && git commit -F "$msg"
```

---

### Task 5: Persistence — drafts, publish, history, rollback, carry, copy

**Files:**
- Create: `smplwise_vms/backend/smplwise/services/geometry_store.py`
- Test: `smplwise_vms/backend/tests/test_plan_geometry_store.py`

**Interfaces:**
- Consumes: `pg.*` (Tasks 2–3), `db.new_id`, `db.now_iso`, `errors.ApiError`, `errors.conflict`.
- Produces (imported as `store`):
  - `doc_hash(doc) -> str`, `row_api(row) -> dict`, `ref(row | None) -> dict | None` (`{id, doc_hash, status, revision, published_at}`), `load_doc(row) -> dict`, `get_row(conn, id)`.
  - `draft_row(conn, version_id)`, `published_row(conn, version_id)`, `at_row(conn, version_id, iso)`, `history(conn, version_id) -> list[Row]` (published + archived, newest first).
  - `working_doc(conn, version) -> tuple[dict, Row | None]` (draft, else published copy, else new; always rebased).
  - `save_draft(conn, version, doc, base_revision, actor_id, now=None) -> Row` (409 `stale_revision` when `base_revision` ≠ current, 0 = none yet; identical content does not bump the revision).
  - `pending_doc(conn, version) -> dict | None` (422 `geometry_invalid` with `details.issues` when the draft has errors).
  - `publish(conn, version, actor_id, now=None) -> {"published": row_api | None, "diff": pg.diff, "unchanged": bool}`.
  - `rollback(conn, version, geometry_id, actor_id, now=None) -> Row` (409 `not_archived`).
  - `copy_published(conn, source_version, target_version, actor_id, now=None) -> bool`.
  - `carry(conn, target_version, actor_id, now=None) -> "copied" | "transformed" | "none"`, `carry_calibration(conn, source, target)`.
  - `copy_candidates(conn, version) -> list[{version_id, status, created_at, walls, openings, same_drawing}]`, `copy_from(conn, target, source, actor_id, now=None) -> Row` (409 `not_empty` / `nothing_to_copy`).

- [ ] **Step 1: Write the failing tests**

```python
"""Plan Studio persistence (T084): draft revisions and conflicts, publish / archive / the document of an instant,
rollback, an invalid draft refused, and the structure carried to a new plan version of the same drawing."""
from __future__ import annotations

import copy
import json

import pytest
from conftest import png_bytes, seed_tree
from fastapi.testclient import TestClient

from smplwise.db import new_id, now_iso
from smplwise.errors import ApiError
from smplwise.main import create_app
from smplwise.services import geometry_store as store

WALL = {"id": "w1", "level_id": "L0", "polyline": [[0.1, 0.2], [0.6, 0.2]], "thickness_m": 0.2, "height_m": None, "base_z_m": 0, "kind": "interior",
        "confidence": 1, "source": "manual", "locked": False, "external_ids": {}}


def _setup(settings):
    app = create_app(settings)
    c = TestClient(app)
    ids = seed_tree(c)
    asset = c.post(f"/api/v1/floors/{ids['floor2']}/plan-assets", files={"file": ("plan.png", png_bytes(), "image/png")}).json()
    v = c.post(f"/api/v1/floors/{ids['floor2']}/plan-versions", json={"asset_id": asset["id"]}).json()
    assert c.post(f"/api/v1/plan-versions/{v['id']}/publish").status_code == 200
    return app, v["id"]


def _version(conn, vid):
    return conn.execute("SELECT * FROM plan_versions WHERE id = ?", (vid,)).fetchone()


def _with(doc, *walls):
    d = copy.deepcopy(doc)
    d["walls"] = [dict(w) for w in walls]
    return d


def _clone(conn, source, *, crop=None, width=None, rotation=None):
    """A second draft version of the same asset, inserted directly (so the create hook of Task 7 does not run)."""
    vid = new_id()
    conn.execute(
        "INSERT INTO plan_versions(id, floor_id, asset_id, page, rotation, crop_json, width_px, height_px, image_path, scale_m_per_px, status, revision, notes, created_at) "
        "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, 'draft', 1, '', ?)",
        (vid, source["floor_id"], source["asset_id"], source["page"], source["rotation"] if rotation is None else rotation, json.dumps(crop) if crop else None,
         width or source["width_px"], source["height_px"], source["image_path"], now_iso()))
    return _version(conn, vid)


def test_draft_revisions_and_conflicts(settings):
    app, vid = _setup(settings)
    with app.state.db.connection() as conn:
        v = _version(conn, vid)
        doc, row = store.working_doc(conn, v)
        assert row is None and doc["plan_version_id"] == vid and doc["walls"] == [] and doc["dimensions"]["width_px"] == 640
        r1 = store.save_draft(conn, v, _with(doc, WALL), 0, "u")
        assert r1["status"] == "draft" and r1["revision"] == 1
        assert store.save_draft(conn, v, _with(doc, WALL), 1, "u")["revision"] == 1, "identical content keeps the revision"
        with pytest.raises(ApiError) as e:
            store.save_draft(conn, v, doc, 0, "u")
        assert e.value.status == 409 and e.value.code == "stale_revision"
        r2 = store.save_draft(conn, v, _with(doc, dict(WALL, thickness_m=0.3)), 1, "u")
        assert r2["revision"] == 2 and store.load_doc(r2)["walls"][0]["thickness_m"] == 0.3


def test_publish_archives_and_serves_the_instant(settings):
    app, vid = _setup(settings)
    with app.state.db.connection() as conn:
        v = _version(conn, vid)
        doc, _ = store.working_doc(conn, v)
        assert store.publish(conn, v, "u")["unchanged"] is True, "nothing drawn: nothing to publish"
        store.save_draft(conn, v, _with(doc, WALL), 0, "u")
        first = store.publish(conn, v, "u", now="2026-09-23T08:00:00Z")
        assert first["unchanged"] is False and first["diff"]["collections"]["walls"]["added"] == ["w1"]
        d = store.draft_row(conn, vid)
        store.save_draft(conn, v, _with(doc, dict(WALL, thickness_m=0.3)), d["revision"], "u")
        second = store.publish(conn, v, "u", now="2026-09-23T09:00:00Z")
        assert second["diff"]["collections"]["walls"]["changed"] == ["w1"]
        assert store.publish(conn, v, "u", now="2026-09-23T09:30:00Z")["unchanged"] is True
        assert [r["status"] for r in store.history(conn, vid)] == ["published", "archived"]
        assert store.at_row(conn, vid, "2026-09-23T08:30:00Z")["id"] == first["published"]["id"]
        assert store.at_row(conn, vid, "2026-09-23T07:00:00Z") is None
        assert store.at_row(conn, vid, "2026-09-23T10:00:00Z")["id"] == second["published"]["id"]
        assert store.ref(store.published_row(conn, vid)) == {"id": second["published"]["id"], "doc_hash": second["published"]["doc_hash"],
                                                             "status": "published", "revision": 1, "published_at": "2026-09-23T09:00:00Z"}


def test_an_invalid_draft_is_refused_with_its_issues(settings):
    app, vid = _setup(settings)
    with app.state.db.connection() as conn:
        v = _version(conn, vid)
        doc, _ = store.working_doc(conn, v)
        store.save_draft(conn, v, _with(doc, dict(WALL, polyline=[[0.1, 0.2], [1.4, 0.2]])), 0, "u")
        with pytest.raises(ApiError) as e:
            store.publish(conn, v, "u")
        assert e.value.status == 422 and e.value.code == "geometry_invalid"
        assert [(i["code"], i["id"]) for i in e.value.details["issues"]] == [("bounds", "w1")]
        assert store.published_row(conn, vid) is None


def test_rollback_restores_an_archived_document_into_published_and_draft(settings):
    app, vid = _setup(settings)
    with app.state.db.connection() as conn:
        v = _version(conn, vid)
        doc, _ = store.working_doc(conn, v)
        store.save_draft(conn, v, _with(doc, WALL), 0, "u")
        first = store.publish(conn, v, "u", now="2026-09-23T08:00:00Z")["published"]
        store.save_draft(conn, v, _with(doc, dict(WALL, thickness_m=0.3)), store.draft_row(conn, vid)["revision"], "u")
        store.publish(conn, v, "u", now="2026-09-23T09:00:00Z")
        with pytest.raises(ApiError) as e:
            store.rollback(conn, v, store.published_row(conn, vid)["id"], "u")
        assert e.value.code == "not_archived"
        restored = store.rollback(conn, v, first["id"], "u", now="2026-09-23T10:00:00Z")
        assert store.load_doc(restored)["walls"][0]["thickness_m"] == 0.2
        assert store.load_doc(store.draft_row(conn, vid))["walls"][0]["thickness_m"] == 0.2
        assert len(store.history(conn, vid)) == 3


def test_structure_follows_a_new_version_of_the_same_drawing(settings):
    app, vid = _setup(settings)
    with app.state.db.connection() as conn:
        v = _version(conn, vid)
        doc, _ = store.working_doc(conn, v)
        store.save_draft(conn, v, _with(doc, WALL), 0, "u")
        store.publish(conn, v, "u")
        conn.execute("UPDATE plan_versions SET scale_m_per_px = 0.02 WHERE id = ?", (vid,))
        same = _clone(conn, _version(conn, vid))
        assert store.carry(conn, same, "u") == "copied"
        assert store.load_doc(store.draft_row(conn, same["id"]))["walls"][0]["polyline"] == WALL["polyline"]
        assert _version(conn, same["id"])["scale_m_per_px"] == pytest.approx(0.02)
        half = _clone(conn, _version(conn, vid), crop={"x": 0.0, "y": 0.0, "w": 0.5, "h": 1.0}, width=640)
        assert store.carry(conn, half, "u") == "transformed"
        assert store.load_doc(store.draft_row(conn, half["id"]))["walls"][0]["polyline"] == [[0.2, 0.2], [1.0, 0.2]]
        assert _version(conn, half["id"])["scale_m_per_px"] == pytest.approx(0.01), "same pixel width, half the drawing"
        turned = _clone(conn, _version(conn, vid), rotation=90)
        assert store.carry(conn, turned, "u") == "none" and store.draft_row(conn, turned["id"]) is None
        assert vid in {c["version_id"] for c in store.copy_candidates(conn, turned)}
        copied = store.load_doc(store.copy_from(conn, turned, _version(conn, vid), "u"))
        assert copied["walls"][0]["id"] == "w1" and any("בלי יישור" in n for n in copied["uncertainty"]["notes"])
        with pytest.raises(ApiError) as e:
            store.copy_from(conn, turned, _version(conn, vid), "u")
        assert e.value.code == "not_empty"
```

- [ ] **Step 2: Run to see them fail**

Run: `cd smplwise_vms/backend && MSYS_NO_PATHCONV=1 $PY -m pytest tests/test_plan_geometry_store.py -p no:cacheprovider`
Expected: FAIL — `cannot import name 'geometry_store'`.

- [ ] **Step 3: Write `services/geometry_store.py`**

```python
"""Plan Studio persistence (T084, CR-003): the structure document of each plan version in plan_geometry - one draft
(the editor's autosave target), at most one published row, and the archived history the historical map reads. A
document is stored as canonical JSON with its SHA-256; the map bundle carries only (id, hash). The server rebases every
document on its version, so ids, size and calibration can never be changed by a client."""
from __future__ import annotations

import hashlib
import json
import sqlite3
from typing import Any

from ..db import new_id, now_iso
from ..errors import ApiError, conflict
from . import plan_geometry as pg

_INSERT = ("INSERT INTO plan_geometry(id, plan_version_id, floor_id, status, revision, doc_json, doc_hash, created_by, created_at, updated_at, published_by, published_at) "
           "VALUES (?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?)")
_FULL = {"x": 0.0, "y": 0.0, "w": 1.0, "h": 1.0}


def doc_hash(doc: dict[str, Any]) -> str:
    return hashlib.sha256(pg.canonical_json(doc).encode("utf-8")).hexdigest()


def row_api(r: sqlite3.Row) -> dict[str, Any]:
    return {"id": r["id"], "plan_version_id": r["plan_version_id"], "floor_id": r["floor_id"], "status": r["status"], "revision": r["revision"],
            "doc_hash": r["doc_hash"], "created_at": r["created_at"], "updated_at": r["updated_at"], "published_at": r["published_at"],
            "published_by": r["published_by"], "archived_at": r["archived_at"]}


def ref(r: sqlite3.Row | None) -> dict[str, Any] | None:
    """What the map bundle carries: enough to fetch and cache the document, never the document itself."""
    return None if r is None else {"id": r["id"], "doc_hash": r["doc_hash"], "status": r["status"], "revision": r["revision"], "published_at": r["published_at"]}


def load_doc(r: sqlite3.Row) -> dict[str, Any]:
    return json.loads(r["doc_json"])


def get_row(conn: sqlite3.Connection, geometry_id: str) -> sqlite3.Row:
    return conn.execute("SELECT * FROM plan_geometry WHERE id = ?", (geometry_id,)).fetchone()


def _asset(conn: sqlite3.Connection, version: sqlite3.Row) -> sqlite3.Row | None:
    return conn.execute("SELECT * FROM plan_assets WHERE id = ?", (version["asset_id"],)).fetchone()


def _crop(version: sqlite3.Row) -> dict[str, float]:
    return json.loads(version["crop_json"]) if version["crop_json"] else dict(_FULL)


def _same_drawing(a: sqlite3.Row, b: sqlite3.Row) -> bool:
    return (a["asset_id"], a["page"], a["rotation"]) == (b["asset_id"], b["page"], b["rotation"])


def draft_row(conn: sqlite3.Connection, version_id: str) -> sqlite3.Row | None:
    return conn.execute("SELECT * FROM plan_geometry WHERE plan_version_id = ? AND status = 'draft'", (version_id,)).fetchone()


def published_row(conn: sqlite3.Connection, version_id: str) -> sqlite3.Row | None:
    return conn.execute("SELECT * FROM plan_geometry WHERE plan_version_id = ? AND status = 'published'", (version_id,)).fetchone()


def at_row(conn: sqlite3.Connection, version_id: str, iso: str) -> sqlite3.Row | None:
    """The document that was published at the instant (the historical map)."""
    return conn.execute(
        "SELECT * FROM plan_geometry WHERE plan_version_id = ? AND status IN ('published', 'archived') AND published_at IS NOT NULL AND published_at <= ? "
        "AND (archived_at IS NULL OR archived_at > ?) ORDER BY published_at DESC LIMIT 1", (version_id, iso, iso)).fetchone()


def history(conn: sqlite3.Connection, version_id: str) -> list[sqlite3.Row]:
    return conn.execute("SELECT * FROM plan_geometry WHERE plan_version_id = ? AND status IN ('published', 'archived') ORDER BY published_at DESC, rowid DESC",
                        (version_id,)).fetchall()


def _insert(conn: sqlite3.Connection, version: sqlite3.Row, status: str, doc: dict[str, Any], actor_id: str | None, now: str) -> sqlite3.Row:
    gid = new_id()
    published = status == "published"
    conn.execute(_INSERT, (gid, version["id"], version["floor_id"], status, pg.canonical_json(doc), doc_hash(doc), actor_id, now, now,
                           actor_id if published else None, now if published else None))
    return get_row(conn, gid)


def _replace_draft(conn: sqlite3.Connection, version: sqlite3.Row, doc: dict[str, Any], actor_id: str | None, now: str) -> sqlite3.Row:
    d = draft_row(conn, version["id"])
    if d is None:
        return _insert(conn, version, "draft", doc, actor_id, now)
    conn.execute("UPDATE plan_geometry SET doc_json = ?, doc_hash = ?, revision = revision + 1, updated_at = ? WHERE id = ?",
                 (pg.canonical_json(doc), doc_hash(doc), now, d["id"]))
    return get_row(conn, d["id"])


def working_doc(conn: sqlite3.Connection, version: sqlite3.Row) -> tuple[dict[str, Any], sqlite3.Row | None]:
    """The document the editor starts from: the stored draft, else a copy of the published document, else a new one."""
    asset = _asset(conn, version)
    d = draft_row(conn, version["id"])
    if d is not None:
        return pg.rebase(load_doc(d), version, asset), d
    p = published_row(conn, version["id"])
    return (pg.rebase(load_doc(p), version, asset) if p is not None else pg.new_document(version, asset)), None


def save_draft(conn: sqlite3.Connection, version: sqlite3.Row, doc: dict[str, Any], base_revision: int, actor_id: str | None, now: str | None = None) -> sqlite3.Row:
    now = now or now_iso()
    doc = pg.rebase(doc, version, _asset(conn, version))
    d = draft_row(conn, version["id"])
    current = d["revision"] if d is not None else 0
    if base_revision != current:
        raise conflict("stale_revision", "טיוטת המבנה השתנתה בינתיים; טען מחדש את העורך.", current_revision=current, sent_revision=base_revision)
    if d is None:
        return _insert(conn, version, "draft", doc, actor_id, now)
    if doc_hash(doc) == d["doc_hash"]:
        return d
    return _replace_draft(conn, version, doc, actor_id, now)


def pending_doc(conn: sqlite3.Connection, version: sqlite3.Row) -> dict[str, Any] | None:
    """The draft that publishing the version would publish, or None when there is nothing new. 422 when invalid."""
    d = draft_row(conn, version["id"])
    if d is None:
        return None
    doc = pg.rebase(load_doc(d), version, _asset(conn, version))
    p = published_row(conn, version["id"])
    if p is not None and p["doc_hash"] == doc_hash(doc):
        return None
    if p is None and pg.is_empty(doc):
        return None
    errors = [i for i in pg.validate(doc) if i["severity"] == "error"]
    if errors:
        raise ApiError(422, "geometry_invalid", "במבנה יש שגיאות שמונעות פרסום; הן מסומנות באדום על המפה.", details={"issues": errors[:50]})
    return doc


def publish(conn: sqlite3.Connection, version: sqlite3.Row, actor_id: str | None, now: str | None = None) -> dict[str, Any]:
    now = now or now_iso()
    prev = published_row(conn, version["id"])
    prev_doc = load_doc(prev) if prev is not None else None
    doc = pending_doc(conn, version)
    if doc is None:
        return {"published": row_api(prev) if prev is not None else None, "diff": pg.diff(prev_doc, prev_doc or {}), "unchanged": True}
    if prev is not None:
        conn.execute("UPDATE plan_geometry SET status = 'archived', archived_at = ?, updated_at = ? WHERE id = ?", (now, now, prev["id"]))
    row = _insert(conn, version, "published", doc, actor_id, now)
    return {"published": row_api(row), "diff": pg.diff(prev_doc, doc), "unchanged": False}


def rollback(conn: sqlite3.Connection, version: sqlite3.Row, geometry_id: str, actor_id: str | None, now: str | None = None) -> sqlite3.Row:
    now = now or now_iso()
    src = conn.execute("SELECT * FROM plan_geometry WHERE id = ? AND plan_version_id = ?", (geometry_id, version["id"])).fetchone()
    if src is None or src["status"] != "archived":
        raise conflict("not_archived", "רק גרסת מבנה מהארכיון ניתנת לשחזור.")
    doc = pg.rebase(load_doc(src), version, _asset(conn, version))
    prev = published_row(conn, version["id"])
    if prev is not None:
        conn.execute("UPDATE plan_geometry SET status = 'archived', archived_at = ?, updated_at = ? WHERE id = ?", (now, now, prev["id"]))
    row = _insert(conn, version, "published", doc, actor_id, now)
    _replace_draft(conn, version, doc, actor_id, now)
    return row


def copy_published(conn: sqlite3.Connection, source: sqlite3.Row, target: sqlite3.Row, actor_id: str | None, now: str | None = None) -> bool:
    """A restored plan version (plans.rollback_version) gets the structure its source had, published and as its draft."""
    now = now or now_iso()
    p = published_row(conn, source["id"])
    if p is None:
        return False
    doc = pg.rebase(load_doc(p), target, _asset(conn, target))
    _insert(conn, target, "published", doc, actor_id, now)
    _replace_draft(conn, target, doc, actor_id, now)
    return True


def carry_calibration(conn: sqlite3.Connection, source: sqlite3.Row, target: sqlite3.Row) -> None:
    """Metres per pixel follow a re-crop of the same drawing: m_new = m_old x (old width x new crop w) / (old crop w x new width)."""
    if target["scale_m_per_px"] or not source["scale_m_per_px"]:
        return
    oc, nc = _crop(source), _crop(target)
    scale = source["scale_m_per_px"] * (source["width_px"] * nc["w"]) / (oc["w"] * target["width_px"])
    record = {"method": "carried", "pairs": [], "residual_pct": None, "from_version": source["id"]}
    conn.execute("UPDATE plan_versions SET scale_m_per_px = ?, calibration_json = ? WHERE id = ?", (scale, json.dumps(record), target["id"]))


def carry(conn: sqlite3.Connection, target: sqlite3.Row, actor_id: str | None, now: str | None = None) -> str:
    """A new plan version starts from the structure of the floor's published plan: the same drawing and crop copies it,
    a re-crop of the same page maps every point through both crops, anything else starts empty (the editor offers a
    manual copy). Returns "copied" | "transformed" | "none"."""
    now = now or now_iso()
    source = conn.execute("SELECT * FROM plan_versions WHERE floor_id = ? AND status = 'published' AND id != ?", (target["floor_id"], target["id"])).fetchone()
    row = (published_row(conn, source["id"]) or draft_row(conn, source["id"])) if source is not None else None
    if row is None or draft_row(conn, target["id"]) is not None:
        return "none"
    doc = load_doc(row)
    if pg.is_empty(doc) or not _same_drawing(source, target):
        return "none"
    mode = "copied"
    if (source["crop_json"] or None) != (target["crop_json"] or None):
        doc = pg.transform_crop(doc, _crop(source), _crop(target))
        mode = "transformed"
    carry_calibration(conn, source, target)
    save_draft(conn, conn.execute("SELECT * FROM plan_versions WHERE id = ?", (target["id"],)).fetchone(), doc, 0, actor_id, now)
    return mode


def copy_candidates(conn: sqlite3.Connection, target: sqlite3.Row) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    for v in conn.execute("SELECT * FROM plan_versions WHERE floor_id = ? AND id != ? ORDER BY created_at DESC", (target["floor_id"], target["id"])).fetchall():
        row = published_row(conn, v["id"]) or draft_row(conn, v["id"])
        if row is None:
            continue
        doc = load_doc(row)
        if pg.is_empty(doc):
            continue
        n = pg.counts(doc)
        out.append({"version_id": v["id"], "status": v["status"], "created_at": v["created_at"], "walls": n["walls"], "openings": n["openings"],
                    "same_drawing": _same_drawing(v, target)})
    return out[:5]


def copy_from(conn: sqlite3.Connection, target: sqlite3.Row, source: sqlite3.Row, actor_id: str | None, now: str | None = None) -> sqlite3.Row:
    now = now or now_iso()
    current, draft = working_doc(conn, target)
    if not pg.is_empty(current):
        raise conflict("not_empty", "לגרסה הזו כבר יש מבנה; מחק אותו לפני העתקה.")
    row = published_row(conn, source["id"]) or draft_row(conn, source["id"])
    if row is None:
        raise conflict("nothing_to_copy", "לגרסה שנבחרה אין מבנה.")
    doc = pg.rebase(load_doc(row), target, _asset(conn, target))
    if not _same_drawing(source, target):
        unc = doc.get("uncertainty") or {"overall": 0.5, "notes": []}
        doc["uncertainty"] = {**unc, "notes": [*unc.get("notes", []), "המבנה הועתק מגרסה עם שרטוט אחר, בלי יישור — בדוק מיקומים."]}
    return save_draft(conn, target, doc, draft["revision"] if draft is not None else 0, actor_id, now)
```

- [ ] **Step 4: Run to see them pass**

Run: `cd smplwise_vms/backend && MSYS_NO_PATHCONV=1 $PY -m pytest tests/test_plan_geometry_store.py -p no:cacheprovider`
Expected: `5 passed`.

- [ ] **Step 5: Commit**

```bash
git add smplwise_vms/backend/smplwise/services/geometry_store.py smplwise_vms/backend/tests/test_plan_geometry_store.py
msg=$(mktemp) && cat > "$msg" <<'EOF'
feat(plan-studio): geometry persistence - drafts, publish, history, rollback, carry, copy (T084)

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOF
test "$(bash /c/cloude/smplwisebms/secrets/scan_staged.sh)" = 0 && git commit -F "$msg"
```

---

### Task 6: The API — geometry, timeline, calibration

**Files:**
- Create: `smplwise_vms/backend/smplwise/routers/plan_geometry.py`
- Modify: `smplwise_vms/backend/smplwise/main.py` (import + `include_router`)
- Modify: `smplwise_vms/backend/smplwise/routers/plans.py` (`version_row` exposes `calibration`)
- Test: `smplwise_vms/backend/tests/test_plan_geometry_api.py`

**Interfaces:**
- Consumes: `store.*` (Task 5), `pg.validate`, `pg.two_point_scale`, `plans.get_version`, `plans.version_row`.
- Produces (HTTP, all under `/api/v1`):
  - `GET /plan-versions/{id}/geometry[?draft=true|?at=ISO]` → `{geometry: {id|null, plan_version_id, floor_id, status: new|draft|published|archived, revision, doc_hash, created_at, updated_at, published_at, published_by, archived_at}, doc, issues, published_hash, copy_candidates?}`; published responses carry `ETag` and answer `If-None-Match` with 304; 404 when nothing is published.
  - `PUT /plan-versions/{id}/geometry` body `{doc, base_revision}` → same shape; 409 `stale_revision`, 422 `geometry_structure`.
  - `POST /plan-versions/{id}/geometry/publish` → `{published, diff, unchanged}`; 409 `publish_plan_first` on a draft plan version.
  - `GET …/geometry/diff` → `{diff, issues, counts, published_counts}`; `GET …/geometry/versions` → `{versions: [row + counts]}`; `GET …/geometry/timeline` → `{timeline: [{id, doc_hash, published_at, archived_at}]}` oldest first (map.read).
  - `POST …/geometry/rollback` body `{geometry_id}`; `POST …/geometry/copy-from` body `{from_version_id}`.
  - `PATCH /plan-versions/{id}/calibration` body `{pairs: [{a: [x, y], b: [x, y], metres}]}` → `{version, scale_m_per_px, residual_pct, warning}`.
  - `version_row(...)` gains `"calibration": dict | None`.

- [ ] **Step 1: Write the failing tests**

```python
"""Plan Studio API (T084): the draft round trip with revisions, publish and what viewers see (ETag, 304), permissions,
diff / versions / timeline / rollback, copy from another version, and the two-point calibration."""
from __future__ import annotations

from conftest import as_user, bind, png_bytes, seed_tree
from fastapi.testclient import TestClient

from smplwise.main import create_app

WALL = {"id": "w1", "level_id": "L0", "polyline": [[0.1, 0.2], [0.6, 0.2]], "thickness_m": 0.2, "height_m": None, "base_z_m": 0, "kind": "interior",
        "confidence": 1, "source": "manual", "locked": False, "external_ids": {}}


def _setup(settings):
    app = create_app(settings)
    c = TestClient(app)
    ids = seed_tree(c)
    asset = c.post(f"/api/v1/floors/{ids['floor2']}/plan-assets", files={"file": ("plan.png", png_bytes(), "image/png")}).json()
    v = c.post(f"/api/v1/floors/{ids['floor2']}/plan-versions", json={"asset_id": asset["id"]}).json()
    assert c.post(f"/api/v1/plan-versions/{v['id']}/publish").status_code == 200
    return app, c, ids, v["id"], asset["id"]


def _draft(c, vid):
    return c.get(f"/api/v1/plan-versions/{vid}/geometry?draft=true").json()


def _save(c, vid, walls, base):
    g = _draft(c, vid)
    doc = dict(g["doc"], walls=walls)
    return c.put(f"/api/v1/plan-versions/{vid}/geometry", json={"doc": doc, "base_revision": base})


def test_draft_round_trip_and_what_viewers_see(settings):
    app, c, ids, vid, _ = _setup(settings)
    g = _draft(c, vid)
    assert g["geometry"]["status"] == "new" and g["geometry"]["revision"] == 0 and g["copy_candidates"] == [] and g["issues"] == []
    r = _save(c, vid, [WALL], 0)
    assert r.status_code == 200 and r.json()["geometry"]["revision"] == 1 and r.json()["geometry"]["status"] == "draft"
    assert _save(c, vid, [WALL], 0).status_code == 409
    bad = c.put(f"/api/v1/plan-versions/{vid}/geometry", json={"doc": dict(g["doc"], walls="x"), "base_revision": 1})
    assert bad.status_code == 422 and bad.json()["code"] == "geometry_structure"
    assert c.get(f"/api/v1/plan-versions/{vid}/geometry").status_code == 404, "nothing published yet"
    diff = c.get(f"/api/v1/plan-versions/{vid}/geometry/diff").json()
    assert diff["diff"]["collections"]["walls"]["added"] == ["w1"] and diff["counts"]["walls"] == 1 and diff["published_counts"] is None
    p = c.post(f"/api/v1/plan-versions/{vid}/geometry/publish")
    assert p.status_code == 200 and p.json()["unchanged"] is False
    pub = c.get(f"/api/v1/plan-versions/{vid}/geometry")
    assert pub.status_code == 200 and pub.json()["doc"]["walls"][0]["id"] == "w1" and pub.json()["geometry"]["status"] == "published"
    assert c.get(f"/api/v1/plan-versions/{vid}/geometry", headers={"If-None-Match": pub.headers["etag"]}).status_code == 304
    assert _draft(c, vid)["published_hash"] == pub.json()["geometry"]["doc_hash"]
    with app.state.db.connection() as conn:
        assert conn.execute("SELECT COUNT(*) FROM audit_log WHERE action = 'geometry.publish'").fetchone()[0] == 1


def test_permissions(settings):
    app, c, ids, vid, _ = _setup(settings)
    _save(c, vid, [WALL], 0)
    c.post(f"/api/v1/plan-versions/{vid}/geometry/publish")
    bind(c, settings, "dana", "viewer", "floor", ids["floor2"])
    h = as_user("dana")
    assert c.get(f"/api/v1/plan-versions/{vid}/geometry", headers=h).status_code == 200
    assert c.get(f"/api/v1/plan-versions/{vid}/geometry/timeline", headers=h).status_code == 200
    assert c.get(f"/api/v1/plan-versions/{vid}/geometry?draft=true", headers=h).status_code == 403
    assert c.put(f"/api/v1/plan-versions/{vid}/geometry", json={"doc": {}, "base_revision": 0}, headers=h).status_code == 403
    assert c.post(f"/api/v1/plan-versions/{vid}/geometry/publish", headers=h).status_code == 403
    assert c.patch(f"/api/v1/plan-versions/{vid}/calibration", json={"pairs": [{"a": [0.1, 0.5], "b": [0.6, 0.5], "metres": 8}]}, headers=h).status_code == 403


def test_versions_timeline_rollback_and_copy(settings):
    app, c, ids, vid, asset_id = _setup(settings)
    _save(c, vid, [WALL], 0)
    c.post(f"/api/v1/plan-versions/{vid}/geometry/publish")
    _save(c, vid, [dict(WALL, thickness_m=0.3)], 1)
    c.post(f"/api/v1/plan-versions/{vid}/geometry/publish")
    versions = c.get(f"/api/v1/plan-versions/{vid}/geometry/versions").json()["versions"]
    assert [v["status"] for v in versions] == ["published", "archived"] and versions[0]["counts"]["walls"] == 1
    timeline = c.get(f"/api/v1/plan-versions/{vid}/geometry/timeline").json()["timeline"]
    assert [t["id"] for t in timeline] == [versions[1]["id"], versions[0]["id"]] and timeline[0]["archived_at"] == timeline[1]["published_at"]
    rb = c.post(f"/api/v1/plan-versions/{vid}/geometry/rollback", json={"geometry_id": versions[1]["id"]})
    assert rb.status_code == 200
    assert c.get(f"/api/v1/plan-versions/{vid}/geometry").json()["doc"]["walls"][0]["thickness_m"] == 0.2
    # a draft plan version publishes its structure together with the plan, not alone; a different drawing starts empty
    v2 = c.post(f"/api/v1/floors/{ids['floor2']}/plan-versions", json={"asset_id": asset_id, "rotation": 90}).json()
    assert c.post(f"/api/v1/plan-versions/{v2['id']}/geometry/publish").status_code == 409
    g2 = _draft(c, v2["id"])
    assert g2["doc"]["walls"] == [] and [x["version_id"] for x in g2["copy_candidates"]] == [vid]
    cp = c.post(f"/api/v1/plan-versions/{v2['id']}/geometry/copy-from", json={"from_version_id": vid})
    assert cp.status_code == 200 and cp.json()["doc"]["walls"][0]["id"] == "w1"
    assert c.post(f"/api/v1/plan-versions/{v2['id']}/geometry/copy-from", json={"from_version_id": vid}).status_code == 409


def test_calibration_sets_the_scale_and_updates_the_draft(settings):
    app, c, ids, vid, _ = _setup(settings)
    r = c.patch(f"/api/v1/plan-versions/{vid}/calibration", json={"pairs": [{"a": [0.1, 0.5], "b": [0.6, 0.5], "metres": 8.0}]})
    assert r.status_code == 200, r.text
    body = r.json()
    assert abs(body["scale_m_per_px"] - 0.025) < 1e-9 and body["residual_pct"] == 0.0 and body["warning"] is None  # 0.5 x 640 = 320 px for 8 m
    assert body["version"]["calibration"]["method"] == "two_point" and body["version"]["scale_m_per_px"] == body["scale_m_per_px"]
    g = _draft(c, vid)
    assert g["geometry"]["status"] == "draft" and g["doc"]["dimensions"]["scale_m_per_px"] == body["scale_m_per_px"]
    assert g["doc"]["dimensions"]["calibration"]["status"] == "measured"
    far = c.patch(f"/api/v1/plan-versions/{vid}/calibration", json={"pairs": [{"a": [0.1, 0.5], "b": [0.6, 0.5], "metres": 8.0},
                                                                            {"a": [0.1, 0.1], "b": [0.1, 0.6], "metres": 6.0}]}).json()
    assert far["residual_pct"] > 3 and far["warning"]
    assert c.patch(f"/api/v1/plan-versions/{vid}/calibration", json={"pairs": [{"a": [0.1, 0.5], "b": [0.1005, 0.5], "metres": 1}]}).status_code == 422
    assert c.patch(f"/api/v1/plan-versions/{vid}/calibration", json={"pairs": [{"a": [1.5, 0.5], "b": [0.6, 0.5], "metres": 8}]}).status_code == 422
    with app.state.db.connection() as conn:
        assert conn.execute("SELECT COUNT(*) FROM audit_log WHERE action = 'plan.calibrate'").fetchone()[0] == 2
```

- [ ] **Step 2: Run to see them fail**

Run: `cd smplwise_vms/backend && MSYS_NO_PATHCONV=1 $PY -m pytest tests/test_plan_geometry_api.py -p no:cacheprovider`
Expected: FAIL — 404 on every geometry route.

- [ ] **Step 3: Write `routers/plan_geometry.py`**

```python
"""Plan Studio API (T084, CR-003): the structure document of a plan version - draft autosave, publish, diff, history,
timeline, rollback, copy from another version - and the version's two-point calibration. Drafts need map.edit on the
floor; published documents are readable with map.read, like the plan image itself."""
from __future__ import annotations

import json
import sqlite3
from typing import Any

from fastapi import APIRouter, Depends, Request
from fastapi.responses import JSONResponse, Response
from pydantic import BaseModel, Field

from ..audit import audit
from ..auth import current_principal, current_principal_ro, get_conn, get_read_conn
from ..db import now_iso
from ..errors import ApiError, conflict, not_found
from ..rbac import Principal, require
from ..services import geometry_store as store
from ..services import plan_geometry as pg
from ..services.timeutil import parse_utc
from .plans import get_version, version_row

router = APIRouter()
NO_CACHE = {"Cache-Control": "private, no-cache"}


def _rid(request: Request) -> str | None:
    return getattr(request.state, "correlation_id", None)


def _floor(v: sqlite3.Row) -> tuple[str, str]:
    return ("floor", v["floor_id"])


def _payload(conn: sqlite3.Connection, version: sqlite3.Row, row: sqlite3.Row | None, doc: dict[str, Any]) -> dict[str, Any]:
    published = store.published_row(conn, version["id"])
    geometry = store.row_api(row) if row is not None else {
        "id": None, "plan_version_id": version["id"], "floor_id": version["floor_id"], "status": "new", "revision": 0, "doc_hash": store.doc_hash(doc),
        "created_at": None, "updated_at": None, "published_at": None, "published_by": None, "archived_at": None,
    }
    return {"geometry": geometry, "doc": doc, "issues": [i for i in pg.validate(doc) if not i["structural"]],
            "published_hash": published["doc_hash"] if published is not None else None}


def _editable(conn: sqlite3.Connection, principal: Principal, version_id: str) -> sqlite3.Row:
    v = get_version(conn, version_id)
    require(conn, principal, "map.edit", _floor(v))
    if v["status"] == "archived":
        raise conflict("archived_version", "גרסה מהארכיון אינה ניתנת לעריכה; שחזר אותה קודם.")
    return v


@router.get("/plan-versions/{version_id}/geometry", response_model=None)
def get_geometry(version_id: str, request: Request, draft: bool = False, at: str | None = None,
                 principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> Any:
    v = get_version(conn, version_id)
    if draft:
        require(conn, principal, "map.edit", _floor(v))
        doc, row = store.working_doc(conn, v)
        body = _payload(conn, v, row, doc)
        if pg.is_empty(doc):
            body["copy_candidates"] = store.copy_candidates(conn, v)
        return body
    require(conn, principal, "map.edit" if v["status"] == "draft" else "map.read", _floor(v))
    if at:
        try:
            iso = parse_utc(at).strftime("%Y-%m-%dT%H:%M:%SZ")
        except ValueError:
            raise ApiError(422, "validation", "זמן חייב להיות UTC (Z).")
        row = store.at_row(conn, v["id"], iso)
    else:
        row = store.published_row(conn, v["id"])
    if row is None:
        raise not_found("אין מבנה מפורסם לגרסה הזו.")
    etag = f'"{row["doc_hash"]}"'
    headers = {"ETag": etag, **NO_CACHE}
    if request.headers.get("if-none-match") == etag:
        return Response(status_code=304, headers=headers)
    return JSONResponse(_payload(conn, v, row, store.load_doc(row)), headers=headers)


class GeometryPut(BaseModel):
    doc: dict[str, Any]
    base_revision: int = Field(ge=0)


@router.put("/plan-versions/{version_id}/geometry")
def put_geometry(version_id: str, body: GeometryPut, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    v = _editable(conn, principal, version_id)
    structural = [i for i in pg.validate(body.doc) if i["structural"]]
    if structural:
        raise ApiError(422, "geometry_structure", "מבנה המסמך אינו תקין; השינוי לא נשמר.", details={"issues": structural[:50]})
    row = store.save_draft(conn, v, body.doc, body.base_revision, principal.user_id)
    return _payload(conn, v, row, store.load_doc(row))


@router.post("/plan-versions/{version_id}/geometry/publish")
def publish_geometry(version_id: str, request: Request, principal: Principal = Depends(current_principal), conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    v = get_version(conn, version_id)
    require(conn, principal, "map.publish", _floor(v))
    if v["status"] == "draft":
        raise conflict("publish_plan_first", "זו טיוטת תוכנית: פרסום הגרסה יפרסם גם את המבנה שלה.")
    if v["status"] == "archived":
        raise conflict("archived_version", "גרסה מהארכיון אינה ניתנת לפרסום.")
    result = store.publish(conn, v, principal.user_id)
    if not result["unchanged"]:
        audit(conn, actor=principal, action="geometry.publish", decision="allowed", resource_type="floor", resource_id=v["floor_id"], request_id=_rid(request),
              details={"version_id": v["id"], "geometry_id": result["published"]["id"], "changes": result["diff"]["total"],
                       "collections": {k: {kk: len(vv) for kk, vv in c.items()} for k, c in result["diff"]["collections"].items()}})
    return result


@router.get("/plan-versions/{version_id}/geometry/diff")
def geometry_diff(version_id: str, principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    v = get_version(conn, version_id)
    require(conn, principal, "map.edit", _floor(v))
    doc, _ = store.working_doc(conn, v)
    p = store.published_row(conn, v["id"])
    old = store.load_doc(p) if p is not None else None
    return {"diff": pg.diff(old, doc), "issues": [i for i in pg.validate(doc) if not i["structural"]], "counts": pg.counts(doc),
            "published_counts": pg.counts(old) if old is not None else None}


@router.get("/plan-versions/{version_id}/geometry/versions")
def geometry_versions(version_id: str, principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    v = get_version(conn, version_id)
    require(conn, principal, "map.edit", _floor(v))
    return {"versions": [dict(store.row_api(r), counts=pg.counts(store.load_doc(r))) for r in store.history(conn, v["id"])]}


@router.get("/plan-versions/{version_id}/geometry/timeline")
def geometry_timeline(version_id: str, principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> dict[str, Any]:
    """When each published structure of the version was in force - the historical map picks the one of its instant."""
    v = get_version(conn, version_id)
    require(conn, principal, "map.read", _floor(v))
    return {"timeline": [{"id": r["id"], "doc_hash": r["doc_hash"], "published_at": r["published_at"], "archived_at": r["archived_at"]}
                         for r in reversed(store.history(conn, v["id"]))]}


class GeometryRollbackIn(BaseModel):
    geometry_id: str = Field(min_length=1, max_length=32)


@router.post("/plan-versions/{version_id}/geometry/rollback")
def rollback_geometry(version_id: str, body: GeometryRollbackIn, request: Request, principal: Principal = Depends(current_principal),
                      conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    v = get_version(conn, version_id)
    require(conn, principal, "map.publish", _floor(v))
    if v["status"] != "published":
        raise conflict("not_published", "שחזור מבנה אפשרי בגרסת התוכנית המפורסמת.")
    row = store.rollback(conn, v, body.geometry_id, principal.user_id)
    audit(conn, actor=principal, action="geometry.rollback", decision="allowed", resource_type="floor", resource_id=v["floor_id"], request_id=_rid(request),
          details={"version_id": v["id"], "restored_from": body.geometry_id, "geometry_id": row["id"]})
    return {"published": store.row_api(row)}


class CopyFromIn(BaseModel):
    from_version_id: str = Field(min_length=1, max_length=32)


@router.post("/plan-versions/{version_id}/geometry/copy-from")
def copy_geometry(version_id: str, body: CopyFromIn, request: Request, principal: Principal = Depends(current_principal),
                  conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    v = _editable(conn, principal, version_id)
    src = get_version(conn, body.from_version_id)
    if src["floor_id"] != v["floor_id"]:
        raise ApiError(422, "validation", "אפשר להעתיק מבנה רק מגרסה של אותה קומה.")
    row = store.copy_from(conn, v, src, principal.user_id)
    audit(conn, actor=principal, action="geometry.copy", decision="allowed", resource_type="floor", resource_id=v["floor_id"], request_id=_rid(request),
          details={"version_id": v["id"], "from_version_id": src["id"]})
    return _payload(conn, v, row, store.load_doc(row))


class CalPair(BaseModel):
    a: list[float] = Field(min_length=2, max_length=2)
    b: list[float] = Field(min_length=2, max_length=2)
    metres: float = Field(gt=0, le=1000)


class CalibrationIn(BaseModel):
    pairs: list[CalPair] = Field(min_length=1, max_length=4)


@router.patch("/plan-versions/{version_id}/calibration")
def calibrate(version_id: str, body: CalibrationIn, request: Request, principal: Principal = Depends(current_principal),
              conn: sqlite3.Connection = Depends(get_conn)) -> dict[str, Any]:
    """Two points and a known distance (more pairs average and expose a distorted scan). Nothing moves on the map:
    positions are 0..1; only the metres change. Viewers see it after the structure is published."""
    v = _editable(conn, principal, version_id)
    if any(not 0 <= c <= 1 for p in body.pairs for c in (*p.a, *p.b)):
        raise ApiError(422, "validation", "נקודות הכיול חייבות להיות בתוך התוכנית.")
    try:
        scale, residual = pg.two_point_scale([(p.a, p.b, p.metres) for p in body.pairs], v["width_px"], v["height_px"])
    except ValueError:
        raise ApiError(422, "validation", "שתי הנקודות קרובות מדי זו לזו; בחר נקודות רחוקות יותר.")
    now = now_iso()
    record = {"method": "two_point", "pairs": [{"a": [round(p.a[0], 6), round(p.a[1], 6)], "b": [round(p.b[0], 6), round(p.b[1], 6)], "metres": p.metres} for p in body.pairs],
              "residual_pct": residual, "at": now, "by": principal.user_id}
    conn.execute("UPDATE plan_versions SET scale_m_per_px = ?, calibration_json = ?, revision = revision + 1 WHERE id = ?",
                 (scale, json.dumps(record, ensure_ascii=False), v["id"]))
    v2 = get_version(conn, v["id"])
    doc, row = store.working_doc(conn, v2)
    store.save_draft(conn, v2, doc, row["revision"] if row is not None else 0, principal.user_id, now)
    audit(conn, actor=principal, action="plan.calibrate", decision="allowed", resource_type="floor", resource_id=v["floor_id"], request_id=_rid(request),
          details={"version_id": v["id"], "scale_m_per_px": scale, "residual_pct": residual, "pairs": len(body.pairs)})
    warning = "הזוגות לא מסכימים ביניהם ביותר מ־3%: ייתכן שהסריקה מעוותת. כייל שוב או הוסף זוג." if residual > 3 else None
    return {"version": version_row(v2), "scale_m_per_px": scale, "residual_pct": residual, "warning": warning}
```

- [ ] **Step 4: Register the router and expose the calibration record**

In `smplwise_vms/backend/smplwise/main.py`, add `plan_geometry` to the `from .routers import …` line (keep the list's order readable, e.g. right after `media`), and after `app.include_router(plans.router, prefix=api, tags=["plans"])` add:

```python
    app.include_router(plan_geometry.router, prefix=api, tags=["plans"])
```

In `smplwise_vms/backend/smplwise/routers/plans.py`, in `version_row`, replace

```python
        "scale_m_per_px": r["scale_m_per_px"], "status": r["status"], "revision": r["revision"], "notes": r["notes"],
```

with

```python
        "scale_m_per_px": r["scale_m_per_px"], "status": r["status"], "revision": r["revision"], "notes": r["notes"],
        "calibration": json.loads(r["calibration_json"]) if "calibration_json" in r.keys() and r["calibration_json"] else None,
```

- [ ] **Step 5: Run the tests to see them pass**

Run: `cd smplwise_vms/backend && MSYS_NO_PATHCONV=1 $PY -m pytest tests/test_plan_geometry_api.py tests/test_plan_schema.py -p no:cacheprovider`
Expected: `8 passed` (4 new + 4 existing v1 schema tests untouched).

- [ ] **Step 6: Commit**

```bash
git add smplwise_vms/backend/smplwise/routers/plan_geometry.py smplwise_vms/backend/smplwise/main.py smplwise_vms/backend/smplwise/routers/plans.py smplwise_vms/backend/tests/test_plan_geometry_api.py
msg=$(mktemp) && cat > "$msg" <<'EOF'
feat(plan-studio): geometry API - draft, publish, diff, versions, timeline, rollback, copy, calibration (T084)

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOF
test "$(bash /c/cloude/smplwisebms/secrets/scan_staged.sh)" = 0 && git commit -F "$msg"
```

---

### Task 7: Integration — the map bundle, plan versions, backups

**Files:**
- Modify: `smplwise_vms/backend/smplwise/routers/anchors.py` (`floor_map`)
- Modify: `smplwise_vms/backend/smplwise/routers/plans.py` (`create_version`, `publish_version`, `rollback_version`, `delete_version`)
- Modify: `smplwise_vms/backend/smplwise/services/backup.py` (`PROJECT_TABLES`)
- Test: `smplwise_vms/backend/tests/test_plan_geometry_integration.py`

**Interfaces:**
- Consumes: `store.ref`, `store.at_row`, `store.draft_row`, `store.published_row`, `store.carry`, `store.pending_doc`, `store.publish`, `store.copy_published`.
- Produces: `GET /floors/{id}/map` → new key `geometry` (`ref` of the shown version: draft for editors with `?draft=true`, the row in force with `?at=`, else published; `null` when none). `POST /floors/{id}/plan-versions` response gains `geometry_carry`. Publishing a plan version publishes its pending draft structure (422 `geometry_invalid` before anything changes). A restored plan version gets its source's structure. Deleting a draft version deletes its structure. Backups include `plan_geometry`.

- [ ] **Step 1: Write the failing tests**

```python
"""Plan Studio in the rest of the product (T084): the map bundle carries a reference (not the document), the historical
map gets the structure of its instant, plan versions carry / publish / restore / delete their structure, and a backup
restores it."""
from __future__ import annotations

import datetime as dt
from dataclasses import replace

from conftest import png_bytes, seed_tree
from fastapi.testclient import TestClient

from smplwise.main import create_app
from smplwise.services import geometry_store as store

FMT = "%Y-%m-%dT%H:%M:%SZ"
WALL = {"id": "w1", "level_id": "L0", "polyline": [[0.1, 0.2], [0.6, 0.2]], "thickness_m": 0.2, "height_m": None, "base_z_m": 0, "kind": "interior",
        "confidence": 1, "source": "manual", "locked": False, "external_ids": {}}


def _setup(settings):
    app = create_app(settings)
    c = TestClient(app)
    ids = seed_tree(c)
    asset = c.post(f"/api/v1/floors/{ids['floor2']}/plan-assets", files={"file": ("plan.png", png_bytes(), "image/png")}).json()
    v = c.post(f"/api/v1/floors/{ids['floor2']}/plan-versions", json={"asset_id": asset["id"]}).json()
    assert c.post(f"/api/v1/plan-versions/{v['id']}/publish").status_code == 200
    return app, c, ids, v["id"], asset["id"]


def _put(c, vid, walls):
    g = c.get(f"/api/v1/plan-versions/{vid}/geometry?draft=true").json()
    r = c.put(f"/api/v1/plan-versions/{vid}/geometry", json={"doc": dict(g["doc"], walls=walls), "base_revision": g["geometry"]["revision"]})
    assert r.status_code == 200, r.text
    return r.json()


def test_the_map_bundle_carries_a_reference_not_the_document(settings):
    app, c, ids, vid, _ = _setup(settings)
    assert c.get(f"/api/v1/floors/{ids['floor2']}/map").json()["geometry"] is None
    _put(c, vid, [WALL])
    c.post(f"/api/v1/plan-versions/{vid}/geometry/publish")
    m = c.get(f"/api/v1/floors/{ids['floor2']}/map").json()
    pub = c.get(f"/api/v1/plan-versions/{vid}/geometry").json()
    assert m["geometry"] == {"id": pub["geometry"]["id"], "doc_hash": pub["geometry"]["doc_hash"], "status": "published", "revision": 1,
                             "published_at": pub["geometry"]["published_at"]}
    _put(c, vid, [dict(WALL, thickness_m=0.3)])
    editor = c.get(f"/api/v1/floors/{ids['floor2']}/map?draft=true").json()
    assert editor["geometry"]["status"] == "draft" and editor["geometry"]["doc_hash"] != pub["geometry"]["doc_hash"]
    assert c.get(f"/api/v1/floors/{ids['floor2']}/map").json()["geometry"]["status"] == "published", "viewers keep the published one"


def test_the_historical_map_gets_the_structure_of_its_instant(settings):
    app, c, ids, vid, _ = _setup(settings)
    with app.state.db.connection() as conn:
        v = conn.execute("SELECT * FROM plan_versions WHERE id = ?", (vid,)).fetchone()
        base = dt.datetime.strptime(v["published_at"], FMT)
        doc, _ = store.working_doc(conn, v)
        store.save_draft(conn, v, dict(doc, walls=[WALL]), 0, "u")
        first = store.publish(conn, v, "u", now=(base + dt.timedelta(hours=1)).strftime(FMT))["published"]
        store.save_draft(conn, v, dict(doc, walls=[dict(WALL, thickness_m=0.3)]), store.draft_row(conn, vid)["revision"], "u")
        second = store.publish(conn, v, "u", now=(base + dt.timedelta(hours=2)).strftime(FMT))["published"]
    mid = (base + dt.timedelta(minutes=90)).strftime(FMT)
    m = c.get(f"/api/v1/floors/{ids['floor2']}/map?at={mid}").json()
    assert m["history"] == "exact" and m["geometry"]["id"] == first["id"]
    assert c.get(f"/api/v1/floors/{ids['floor2']}/map").json()["geometry"]["id"] == second["id"]
    assert c.get(f"/api/v1/plan-versions/{vid}/geometry?at={mid}").json()["doc"]["walls"][0]["thickness_m"] == 0.2


def test_plan_versions_carry_publish_restore_and_delete_their_structure(settings):
    app, c, ids, v1, asset_id = _setup(settings)
    _put(c, v1, [WALL])
    c.post(f"/api/v1/plan-versions/{v1}/geometry/publish")
    same = c.post(f"/api/v1/floors/{ids['floor2']}/plan-versions", json={"asset_id": asset_id}).json()
    assert same["geometry_carry"] == "copied"
    half = c.post(f"/api/v1/floors/{ids['floor2']}/plan-versions", json={"asset_id": asset_id, "crop": {"x": 0, "y": 0, "w": 0.5, "h": 1}}).json()
    assert half["geometry_carry"] == "transformed"
    assert c.get(f"/api/v1/plan-versions/{half['id']}/geometry?draft=true").json()["doc"]["walls"][0]["polyline"] == [[0.2, 0.2], [1.0, 0.2]]
    turned = c.post(f"/api/v1/floors/{ids['floor2']}/plan-versions", json={"asset_id": asset_id, "rotation": 90}).json()
    assert turned["geometry_carry"] == "none"
    # deleting a draft plan version removes its structure (no dangling rows, no foreign-key error)
    assert c.delete(f"/api/v1/plan-versions/{half['id']}").status_code == 204
    with app.state.db.connection() as conn:
        assert conn.execute("SELECT COUNT(*) FROM plan_geometry WHERE plan_version_id = ?", (half["id"],)).fetchone()[0] == 0
    # publishing the plan version publishes its structure with it
    _put(c, same["id"], [WALL, dict(WALL, id="w2", polyline=[[0.1, 0.4], [0.6, 0.4]])])
    assert c.post(f"/api/v1/plan-versions/{same['id']}/publish").status_code == 200
    assert len(c.get(f"/api/v1/plan-versions/{same['id']}/geometry").json()["doc"]["walls"]) == 2
    # an invalid structure blocks the plan publish before anything changes
    _put(c, turned["id"], [dict(WALL, polyline=[[0.1, 0.2], [1.5, 0.2]])])
    bad = c.post(f"/api/v1/plan-versions/{turned['id']}/publish")
    assert bad.status_code == 422 and bad.json()["code"] == "geometry_invalid"
    assert c.get(f"/api/v1/plan-versions/{turned['id']}").json()["status"] == "draft"
    # restoring the archived first version brings back its structure
    rb = c.post(f"/api/v1/plan-versions/{v1}/rollback", json={"revision": c.get(f"/api/v1/plan-versions/{v1}").json()["revision"]})
    assert rb.status_code == 201, rb.text
    restored = rb.json()["id"]
    assert [w["id"] for w in c.get(f"/api/v1/plan-versions/{restored}/geometry").json()["doc"]["walls"]] == ["w1"]


def test_a_backup_restores_the_structure(settings, tmp_path):
    app, c, ids, vid, _ = _setup(settings)
    _put(c, vid, [WALL])
    c.post(f"/api/v1/plan-versions/{vid}/geometry/publish")
    before = c.get(f"/api/v1/plan-versions/{vid}/geometry").json()["geometry"]["doc_hash"]
    e = c.post("/api/v1/backups", json={"note": "geometry"}).json()
    assert e["tables"]["plan_geometry"] == 2  # draft + published
    data = c.get(f"/api/v1/backups/{e['name']}/download").content
    c2 = TestClient(create_app(replace(settings, data_dir=tmp_path / "data2")))
    up = c2.post("/api/v1/backups/upload", files={"file": ("copy.zip", data, "application/zip")}).json()
    assert c2.post(f"/api/v1/backups/{up['name']}/restore", json={"mode": "replace", "scope": "project", "confirm": "RESTORE"}).status_code == 200
    assert c2.get(f"/api/v1/plan-versions/{vid}/geometry").json()["geometry"]["doc_hash"] == before
```

- [ ] **Step 2: Run to see them fail**

Run: `cd smplwise_vms/backend && MSYS_NO_PATHCONV=1 $PY -m pytest tests/test_plan_geometry_integration.py -p no:cacheprovider`
Expected: FAIL — `KeyError: 'geometry'` / `'geometry_carry'` / backup table count missing.

- [ ] **Step 3: The map bundle (`routers/anchors.py`, `floor_map`)**

After the `if at_iso and history_from … else …` block that sets `version` and `anchors`, insert:

```python
    from ..services import geometry_store

    geometry = None
    if version is not None:
        if at_iso and history == "exact":
            geometry = geometry_store.ref(geometry_store.at_row(conn, version["id"], at_iso))
        elif draft and can_edit and not at_iso:
            geometry = geometry_store.ref(geometry_store.draft_row(conn, version["id"]) or geometry_store.published_row(conn, version["id"]))
        else:
            geometry = geometry_store.ref(geometry_store.published_row(conn, version["id"]))
```

and in the returned dict, after `"plan": version_row(version) if version else None,` add:

```python
        "geometry": geometry,
```

- [ ] **Step 4: Plan versions (`routers/plans.py`)**

Add the import next to the other service imports:

```python
from ..services import geometry_store
```

In `create_version`, replace the final `return version_row(get_version(conn, version_id))` with:

```python
    # a new version starts from the floor's structure when it is the same drawing (copied / mapped through a re-crop)
    carry = geometry_store.carry(conn, get_version(conn, version_id), principal.user_id)
    return dict(version_row(get_version(conn, version_id)), geometry_carry=carry)
```

In `publish_version`, right after `now = now_iso()` insert:

```python
    # the version's structure is published with it; an invalid one refuses the publish before anything changes (422)
    structure_pending = geometry_store.pending_doc(conn, v)
```

and right after the line `carried, pending = _carry_anchors(conn, get_version(conn, version_id), now)` insert:

```python
    structure = geometry_store.publish(conn, get_version(conn, version_id), principal.user_id, now) if structure_pending is not None else None
```

then add `"structure_published": bool(structure and not structure["unchanged"]),` to that function's audit `details` dict.

In `rollback_version`, right after `carried, pending = _carry_anchors(conn, restored, now)` insert:

```python
    geometry_store.copy_published(conn, v, restored, principal.user_id, now)
```

In `delete_version`, right before `conn.execute("DELETE FROM plan_versions WHERE id = ?", (version_id,))` insert:

```python
    conn.execute("DELETE FROM plan_geometry WHERE plan_version_id = ?", (version_id,))
```

- [ ] **Step 5: Backups (`services/backup.py`)**

Replace the `PROJECT_TABLES` line with:

```python
PROJECT_TABLES = ["settings", "sites", "buildings", "floors", "plan_assets", "plan_versions", "plan_geometry", "map_anchors", "recorders", "cameras", "spatial_zones", "cases", "case_items", "saved_views"]
```

(Inserts follow this order and deletes the reverse, so `plan_geometry` comes after the `plan_versions` it references.)

- [ ] **Step 6: Run the new and the neighbouring suites**

Run: `cd smplwise_vms/backend && MSYS_NO_PATHCONV=1 $PY -m pytest tests/test_plan_geometry_integration.py tests/test_backup.py tests/test_plans.py tests/test_plan_versions.py tests/test_plan_crop.py tests/test_anchor_coverage.py tests/test_zones.py -p no:cacheprovider`
Expected: all pass (the plan-version publish, rollback and delete paths and the backup table list changed under them). Then the whole suite: `MSYS_NO_PATHCONV=1 $PY -m pytest -p no:cacheprovider` → `N passed`, no failures (176 before this plan plus the new files so far).

- [ ] **Step 7: Commit**

```bash
git add smplwise_vms/backend/smplwise/routers/anchors.py smplwise_vms/backend/smplwise/routers/plans.py smplwise_vms/backend/smplwise/services/backup.py smplwise_vms/backend/tests/test_plan_geometry_integration.py
msg=$(mktemp) && cat > "$msg" <<'EOF'
feat(plan-studio): structure in the map bundle, plan versions and backups (T084)

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOF
test "$(bash /c/cloude/smplwisebms/secrets/scan_staged.sh)" = 0 && git commit -F "$msg"
```

---

### Task 8: SVG and PNG exports

**Files:**
- Modify: `smplwise_vms/backend/smplwise/services/plan_geometry_render.py` (append)
- Modify: `smplwise_vms/backend/smplwise/routers/plan_geometry.py` (append two routes)
- Test: `smplwise_vms/backend/tests/test_plan_geometry_export.py`

**Interfaces:**
- Consumes: `structure_primitives`, `r2`, zones as `floor_zones(conn, floor_id)` dicts (`id`, `polygon: [{x, y}]`, optional `level_id`).
- Produces: `render_svg(doc, zones, width, height, *, level=None, labels=True, rooms=True) -> str`, `render_png(doc, zones, width, height, *, background: Path | None = None, level=None) -> bytes`; routes `GET /plan-versions/{id}/export.svg` and `/export.png` (`?draft=true`, `?level=`, `?labels=`, `?rooms=`, `?background=`).

- [ ] **Step 1: Write the failing tests**

```python
"""Plan Studio exports (T084): SVG and PNG are drawn from the same primitives as the map - deterministic byte for byte,
the level filter applies, the PNG draws walls over the plan picture - and the routes serve the published structure
(drafts only to editors)."""
from __future__ import annotations

import io
import json
import pathlib
import xml.etree.ElementTree as ET

from conftest import as_user, bind, png_bytes, seed_tree
from fastapi.testclient import TestClient
from PIL import Image

from smplwise.main import create_app
from smplwise.services import plan_geometry_render as render

FIX = pathlib.Path(__file__).resolve().parents[3] / "contracts" / "fixtures" / "plan_geometry"
ZONES = [{"id": "z1", "name": "מחסן", "polygon": [{"x": 0.1, "y": 0.1}, {"x": 0.6, "y": 0.1}, {"x": 0.6, "y": 0.5}, {"x": 0.1, "y": 0.5}]}]


def _sample() -> dict:
    return json.loads((FIX / "sample-v2.json").read_text(encoding="utf-8"))


def test_svg_is_deterministic_and_draws_every_item():
    doc = _sample()
    a = render.render_svg(doc, ZONES, 1000, 800)
    assert a == render.render_svg(doc, ZONES, 1000, 800)
    root = ET.fromstring(a)
    ns = {"s": "http://www.w3.org/2000/svg"}
    assert len(root.findall(".//s:polyline", ns)) == len([p for p in render.structure_primitives(doc, 1000, 800) if p["kind"] == "wall"])
    assert 'data-opening="oc"' in a and 'data-room="z1"' in a and ">מחסן<" in a
    only = render.render_svg(doc, ZONES, 1000, 800, level="L1", rooms=False, labels=False)
    assert 'data-wall="wd"' in only and 'data-wall="wa"' not in only and "<text" not in only and "data-room" not in only


def test_png_draws_walls_over_the_background(tmp_path):
    bg = tmp_path / "bg.png"
    Image.new("RGB", (1000, 800), (255, 255, 255)).save(bg)
    data = render.render_png(_sample(), [], 1000, 800, background=bg)
    im = Image.open(io.BytesIO(data)).convert("RGB")
    assert im.size == (1000, 800)
    assert max(im.getpixel((500, 80))) < 150, "wall wa crosses (500, 80)"
    assert im.getpixel((500, 300)) == (255, 255, 255), "nothing in the middle of the room"
    assert render.render_png(_sample(), [], 1000, 800, background=bg) == data


def test_export_routes_serve_the_published_structure(settings):
    app = create_app(settings)
    c = TestClient(app)
    ids = seed_tree(c)
    asset = c.post(f"/api/v1/floors/{ids['floor2']}/plan-assets", files={"file": ("plan.png", png_bytes(), "image/png")}).json()
    vid = c.post(f"/api/v1/floors/{ids['floor2']}/plan-versions", json={"asset_id": asset["id"]}).json()["id"]
    c.post(f"/api/v1/plan-versions/{vid}/publish")
    assert c.get(f"/api/v1/plan-versions/{vid}/export.svg").status_code == 404
    g = c.get(f"/api/v1/plan-versions/{vid}/geometry?draft=true").json()
    wall = {"id": "w1", "level_id": "L0", "polyline": [[0.1, 0.2], [0.6, 0.2]], "thickness_m": 0.2, "height_m": None, "base_z_m": 0, "kind": "interior",
            "confidence": 1, "source": "manual", "locked": False, "external_ids": {}}
    c.put(f"/api/v1/plan-versions/{vid}/geometry", json={"doc": dict(g["doc"], walls=[wall]), "base_revision": 0})
    assert c.get(f"/api/v1/plan-versions/{vid}/export.svg?draft=true").status_code == 200
    c.post(f"/api/v1/plan-versions/{vid}/geometry/publish")
    svg = c.get(f"/api/v1/plan-versions/{vid}/export.svg")
    assert svg.status_code == 200 and svg.headers["content-type"].startswith("image/svg+xml") and 'data-wall="w1"' in svg.text
    assert c.get(f"/api/v1/plan-versions/{vid}/export.svg").content == svg.content
    png = c.get(f"/api/v1/plan-versions/{vid}/export.png")
    assert png.status_code == 200 and png.headers["content-type"] == "image/png" and Image.open(io.BytesIO(png.content)).size == (640, 400)
    bind(c, settings, "dana", "viewer", "floor", ids["floor2"])
    assert c.get(f"/api/v1/plan-versions/{vid}/export.svg", headers=as_user("dana")).status_code == 200
    assert c.get(f"/api/v1/plan-versions/{vid}/export.svg?draft=true", headers=as_user("dana")).status_code == 403
```

- [ ] **Step 2: Run to see them fail**

Run: `cd smplwise_vms/backend && MSYS_NO_PATHCONV=1 $PY -m pytest tests/test_plan_geometry_export.py -p no:cacheprovider`
Expected: FAIL — `module has no attribute 'render_svg'`; routes 404.

- [ ] **Step 3: Append the exporters to `plan_geometry_render.py`**

Add `import io`, `from pathlib import Path` and `from xml.sax.saxutils import escape, quoteattr` to the imports, and import `DEFAULT_LEVEL_ID` next to `DEFAULT_WALL_THICKNESS_M`. Then append:

```python
# ---------------------------------------------------------------- exports (same primitives as the map)

TOKENS = {"canvas": "#ffffff", "structure": "#4b5567", "opening": "#2f6bff", "glass": "#7fb2ff", "label": "#8b96a8", "room_fill": "#eef3ff", "room_line": "#c5cfdd"}


def _n(v: float) -> str:
    s = f"{r2(v):.2f}".rstrip("0").rstrip(".")
    return "0" if s in ("", "-0") else s


def _pts(points: Any) -> str:
    return " ".join(f"{_n(x)},{_n(y)}" for x, y in points)


def _rooms(zones: list[dict[str, Any]], width: float, height: float, level: str | None) -> list[tuple[dict[str, Any], list[tuple[float, float]]]]:
    out = []
    for z in sorted(zones, key=lambda z: z["id"]):
        if level is not None and (z.get("level_id") or DEFAULT_LEVEL_ID) != level:
            continue
        out.append((z, [(r2(p["x"] * width), r2(p["y"] * height)) for p in z["polygon"]]))
    return out


def render_svg(doc: dict[str, Any], zones: list[dict[str, Any]], width: float, height: float, *, level: str | None = None, labels: bool = True, rooms: bool = True) -> str:
    prims = structure_primitives(doc, width, height, level)
    w, h = _n(width), _n(height)
    out = [f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="0 0 {w} {h}">', f'<rect width="{w}" height="{h}" fill="{TOKENS["canvas"]}"/>']
    if rooms:
        out.append('<g id="rooms">')
        for z, pts in _rooms(zones, width, height, level):
            out.append(f'<polygon data-room={quoteattr(z["id"])} points="{_pts(pts)}" fill="{TOKENS["room_fill"]}" stroke="{TOKENS["room_line"]}" stroke-width="1"/>')
        out.append("</g>")
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
    if labels:
        out.append(f'<g id="labels" font-family="Arial, Helvetica, sans-serif" font-weight="600" fill="{TOKENS["label"]}" text-anchor="middle" dominant-baseline="middle">')
        out.extend(f'<text data-label={quoteattr(p["id"])} x="{_n(p["x"])}" y="{_n(p["y"])}" font-size="{_n(p["size"])}">{escape(p["text"])}</text>'
                   for p in prims if p["kind"] == "label")
        out.append("</g>")
    out.append("</svg>")
    return "\n".join(out) + "\n"


def _rgb(hex_color: str, alpha: int = 255) -> tuple[int, int, int, int]:
    h = hex_color.lstrip("#")
    return int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16), alpha


def render_png(doc: dict[str, Any], zones: list[dict[str, Any]], width: float, height: float, *, background: Path | None = None, level: str | None = None) -> bytes:
    """The structure over the plan picture (or white). Labels stay in the SVG: Pillow cannot shape Hebrew text."""
    from PIL import Image, ImageDraw

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
    prims = structure_primitives(doc, width, height, level)
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
    out = Image.alpha_composite(base, layer).convert("RGB")
    buf = io.BytesIO()
    out.save(buf, format="PNG")
    return buf.getvalue()
```

- [ ] **Step 4: Append the routes to `routers/plan_geometry.py`**

Add `from ..auth import settings_of`, `from ..services import plan_geometry_render as render` and `from .zones import floor_zones` to the imports, then append:

```python
def _export_doc(conn: sqlite3.Connection, principal: Principal, version_id: str, draft: bool) -> tuple[sqlite3.Row, dict[str, Any]]:
    v = get_version(conn, version_id)
    if draft:
        require(conn, principal, "map.edit", _floor(v))
        return v, store.working_doc(conn, v)[0]
    require(conn, principal, "map.edit" if v["status"] == "draft" else "map.read", _floor(v))
    row = store.published_row(conn, v["id"])
    if row is None:
        raise not_found("אין מבנה מפורסם לגרסה הזו.")
    return v, store.load_doc(row)


@router.get("/plan-versions/{version_id}/export.svg", response_model=None)
def export_svg(version_id: str, draft: bool = False, level: str | None = None, labels: bool = True, rooms: bool = True,
               principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> Response:
    v, doc = _export_doc(conn, principal, version_id, draft)
    text = render.render_svg(doc, floor_zones(conn, v["floor_id"]), v["width_px"], v["height_px"], level=level, labels=labels, rooms=rooms)
    return Response(content=text.encode("utf-8"), media_type="image/svg+xml; charset=utf-8",
                    headers={"Content-Disposition": f'attachment; filename="plan-{v["id"]}.svg"', **NO_CACHE})


@router.get("/plan-versions/{version_id}/export.png", response_model=None)
def export_png(version_id: str, request: Request, draft: bool = False, level: str | None = None, background: bool = True,
               principal: Principal = Depends(current_principal_ro), conn: sqlite3.Connection = Depends(get_read_conn)) -> Response:
    v, doc = _export_doc(conn, principal, version_id, draft)
    picture = settings_of(request).data_dir / v["image_path"] if background else None
    data = render.render_png(doc, floor_zones(conn, v["floor_id"]), v["width_px"], v["height_px"],
                             background=picture if picture is not None and picture.exists() else None, level=level)
    return Response(content=data, media_type="image/png", headers={"Content-Disposition": f'attachment; filename="plan-{v["id"]}.png"', **NO_CACHE})
```

- [ ] **Step 5: Run to see them pass**

Run: `cd smplwise_vms/backend && MSYS_NO_PATHCONV=1 $PY -m pytest tests/test_plan_geometry_export.py tests/test_plan_geometry_render.py -p no:cacheprovider`
Expected: `7 passed`.

- [ ] **Step 6: Commit**

```bash
git add smplwise_vms/backend/smplwise/services/plan_geometry_render.py smplwise_vms/backend/smplwise/routers/plan_geometry.py smplwise_vms/backend/tests/test_plan_geometry_export.py
msg=$(mktemp) && cat > "$msg" <<'EOF'
feat(plan-studio): deterministic SVG and PNG exports of the structure (T084)

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOF
test "$(bash /c/cloude/smplwisebms/secrets/scan_staged.sh)" = 0 && git commit -F "$msg"
```

---

### Task 9: Frontend geometry maths and document operations (node-tested)

**Files:**
- Create: `frontend/src/map/geometry.ts`
- Create: `frontend/src/map/studio-ops.ts`
- Test: `frontend/tests/unit-geometry.spec.ts`

**Interfaces:**
- Consumes: `contracts/fixtures/plan_geometry/*.json` (Task 4).
- Produces (`geometry.ts`): types `Pt`, `WallKind`, `OpeningKind`, `Swing`, `Hinge`, `GeomSource`, `CalStatus`, `AnchorRef`, `GeomLevel`, `GeomWall`, `GeomOpening`, `GeomLabel`, `CalPair`, `Calibration`, `GeometryDoc`, `WallPrim`, `DoorPrim`, `WindowPrim`, `PassagePrim`, `LabelPrim`, `Primitive`; constants `DEFAULT_LEVEL_ID`, `DEFAULT_WALL_THICKNESS_M`, `ESTIMATED_WALL_FRACTION`, `OPENING_DEFAULTS`; functions `r2`, `effectiveScale(doc) -> {scale, estimated}`, `pointAt(pts, cum, s)`, `buildPrimitives(doc, width, height, level = null) -> Primitive[]`, `lengthPx(pts, W, H)`, `distanceM(a, b, W, H, scale)`, `polygonAreaM2(poly, W, H, scale)`, `perimeterM(poly, W, H, scale)`, `nearestWall(p, walls, W, H, maxPx, onlyId?) -> {wall, t, distPx} | null`, `snapPoint(p, prev, walls, W, H, {tolPx, free}) -> Pt`.
- Produces (`studio-ops.ts`): `WallDefaults`, `newId()`, `defaultLevelId(doc)`, `kindDefaults(kind)`, `addWall(doc, points, defaults) -> {doc, id}`, `addOpening(doc, wallId, t, kind) -> {doc, id}`, `patchWall(doc, id, patch)`, `patchOpening(doc, id, patch)`, `moveVertex(doc, id, index, p)`, `removeItem(doc, id)`.

- [ ] **Step 1: Write the failing spec `frontend/tests/unit-geometry.spec.ts`**

```ts
import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildPrimitives, distanceM, effectiveScale, nearestWall, perimeterM, polygonAreaM2, snapPoint, type GeometryDoc, type Primitive, type Pt } from '../src/map/geometry';
import { addOpening, addWall, moveVertex, patchOpening, removeItem } from '../src/map/studio-ops';

// Plan Studio (T084): the map's structure primitives equal the backend renderer's (the shared golden file), and the
// pure editor maths (snapping, the nearest wall, metres) and document operations behave. Runs in node: no page, no backend.
const HERE = path.dirname(fileURLToPath(import.meta.url));
const FIX = path.resolve(HERE, '..', '..', 'contracts', 'fixtures', 'plan_geometry');
const sample = () => JSON.parse(fs.readFileSync(path.join(FIX, 'sample-v2.json'), 'utf8')) as GeometryDoc;
const golden = JSON.parse(fs.readFileSync(path.join(FIX, 'sample-v2.primitives.json'), 'utf8')) as { all: Primitive[]; level_L1: Primitive[] };

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

test.describe('plan studio geometry (unit)', () => {
  test('the map draws exactly what the backend exports', () => {
    close(buildPrimitives(sample(), 1000, 800), golden.all, 'all');
    close(buildPrimitives(sample(), 1000, 800, 'L1'), golden.level_L1, 'L1');
  });

  test('snapping: a wall vertex first, then 45 degree steps unless free', () => {
    const doc = sample();
    expect(snapPoint([0.603, 0.498], null, doc.walls, 1000, 800, { tolPx: 10, free: false })).toEqual([0.6, 0.5]);
    const p = snapPoint([0.3, 0.212], [0.1, 0.2], [], 1000, 800, { tolPx: 10, free: false });
    expect(p[1]).toBeCloseTo(0.2, 6);
    expect(snapPoint([0.3, 0.212], [0.1, 0.2], [], 1000, 800, { tolPx: 10, free: true })).toEqual([0.3, 0.212]);
  });

  test('a click near a wall finds it and the position along it', () => {
    const doc = sample();
    const hit = nearestWall([0.35, 0.505], doc.walls, 1000, 800, 20);
    expect(hit?.wall.id).toBe('wb');
    expect(hit?.t).toBeCloseTo(0.5, 6);
    expect(nearestWall([0.35, 0.3], doc.walls, 1000, 800, 20)).toBeNull();
  });

  test('metres come from the calibration and are estimated without it', () => {
    const doc = sample();
    expect(effectiveScale(doc)).toEqual({ scale: 0.01, estimated: false });
    expect(distanceM([0.1, 0.1], [0.9, 0.1], 1000, 800, 0.01)).toBeCloseTo(8, 9);
    const square: Pt[] = [[0.1, 0.1], [0.3, 0.1], [0.3, 0.35], [0.1, 0.35]]; // 200 x 200 px
    expect(polygonAreaM2(square, 1000, 800, 0.01)).toBeCloseTo(4, 9);
    expect(perimeterM(square, 1000, 800, 0.01)).toBeCloseTo(8, 9);
    const raw: GeometryDoc = { ...doc, dimensions: { ...doc.dimensions, scale_m_per_px: null, calibration: { ...doc.dimensions.calibration, status: 'missing' } } };
    expect(effectiveScale(raw)).toEqual({ scale: 0.2 / (0.006 * 1000), estimated: true });
  });

  test('editor operations keep the document consistent', () => {
    let doc = sample();
    const w = addWall(doc, [[0.2, 0.9], [0.5, 0.9]], { thickness_m: 0.25, kind: 'partition' });
    doc = w.doc;
    expect(w.id).toMatch(/^[0-9a-f]{16}$/);
    expect(doc.walls.find((x) => x.id === w.id)).toMatchObject({ level_id: 'L0', thickness_m: 0.25, kind: 'partition', source: 'manual', confidence: 1, height_m: null });
    const o = addOpening(doc, w.id, 0.5, 'window');
    doc = o.doc;
    expect(doc.openings.find((x) => x.id === o.id)).toMatchObject({ wall_id: w.id, kind: 'window', width_m: 1.2, sill_m: 0.9, swing: 'none' });
    doc = patchOpening(doc, o.id, { t: 0.25 });
    expect(doc.openings.find((x) => x.id === o.id)!.t).toBe(0.25);
    doc = moveVertex(doc, w.id, 1, [0.6, 0.9]);
    expect(doc.walls.find((x) => x.id === w.id)!.polyline[1]).toEqual([0.6, 0.9]);
    doc = removeItem(doc, w.id);
    expect(doc.walls.some((x) => x.id === w.id)).toBe(false);
    expect(doc.openings.some((x) => x.id === o.id)).toBe(false);
  });
});
```

- [ ] **Step 2: Run to see it fail**

Run (in `frontend/`): `npx playwright test tests/unit-geometry.spec.ts --project=desktop --reporter=line`
Expected: FAIL — cannot resolve `../src/map/geometry`.

- [ ] **Step 3: Write `frontend/src/map/geometry.ts`**

```ts
/**
 * Plan Studio structure layer (T084, CR-003): the v2 geometry document types, the deterministic primitives every map
 * draws - the same list the backend's plan_geometry_render.structure_primitives produces for the SVG / PNG exports
 * (contracts/fixtures/plan_geometry pins both) - and the pure maths of the editor tools: snapping, the nearest wall,
 * distances and areas in metres. No DOM and no Lit, so it runs in node (tests/unit-geometry.spec.ts).
 */
export type Pt = [number, number];
export type WallKind = 'exterior' | 'interior' | 'partition' | 'railing' | 'low';
export type OpeningKind = 'door' | 'window' | 'passage';
export type Swing = 'left' | 'right' | 'double' | 'sliding' | 'none';
export type Hinge = 'start' | 'end';
export type GeomSource = 'manual' | 'auto' | 'imported';
export type CalStatus = 'measured' | 'estimated' | 'missing';
export type ExternalIds = Record<string, string>;

export interface AnchorRef {
  resource_type: 'camera' | 'ha_entity';
  resource_id: string;
}
export interface GeomLevel {
  id: string;
  name: string;
  elevation_m: number;
  ceiling_height_m: number;
  is_default: boolean;
  external_ids?: ExternalIds;
}
export interface GeomWall {
  id: string;
  level_id: string;
  polyline: Pt[];
  thickness_m: number;
  height_m: number | null;
  base_z_m: number;
  kind: WallKind;
  confidence: number;
  source: GeomSource;
  locked: boolean;
  external_ids?: ExternalIds;
}
export interface GeomOpening {
  id: string;
  wall_id: string;
  t: number;
  kind: OpeningKind;
  width_m: number;
  height_m: number;
  sill_m: number;
  swing: Swing;
  hinge: Hinge;
  anchor_ref: AnchorRef | null;
  confidence: number;
  source: GeomSource;
  external_ids?: ExternalIds;
}
export interface GeomLabel {
  id: string;
  text: string;
  position: Pt;
  level_id: string;
  size: number;
}
export interface CalPair {
  a: Pt;
  b: Pt;
  metres: number;
}
export interface Calibration {
  status: CalStatus;
  method: string | null;
  pairs: CalPair[];
  residual_pct: number | null;
  reason: string | null;
}
export interface GeometryDoc {
  schema_version: '2.0';
  plan_version_id: string;
  floor_id: string;
  source: { sha256: string; file_name: string; mime: string; page: number };
  dimensions: { width_px: number; height_px: number; scale_m_per_px: number | null; calibration: Calibration };
  transform: { rotation: number; crop: { x: number; y: number; w: number; h: number } | null };
  levels: GeomLevel[];
  walls: GeomWall[];
  openings: GeomOpening[];
  rooms: { id: string; level_id?: string | null; ceiling_height_m?: number | null }[];
  objects: unknown[];
  circuits: unknown[];
  connectors: unknown[];
  labels: GeomLabel[];
  groups: unknown[];
  uncertain_regions: unknown[];
  uncertainty: { overall: number; notes: string[] };
  meta: { generator: string; tokens_version: string; detector_version: string | null };
}

export interface WallPrim { kind: 'wall'; id: string; part: number; points: Pt[]; width: number }
export interface DoorPrim { kind: 'door'; id: string; gap: [Pt, Pt]; leaves: [Pt, Pt][]; arcs: { from: Pt; to: Pt; r: number; sweep: 0 | 1 }[] }
export interface WindowPrim { kind: 'window'; id: string; gap: [Pt, Pt]; lines: [Pt, Pt][] }
export interface PassagePrim { kind: 'passage'; id: string; gap: [Pt, Pt] }
export interface LabelPrim { kind: 'label'; id: string; x: number; y: number; text: string; size: number }
export type Primitive = WallPrim | DoorPrim | WindowPrim | PassagePrim | LabelPrim;

export const DEFAULT_LEVEL_ID = 'L0';
export const DEFAULT_WALL_THICKNESS_M = 0.2;
export const ESTIMATED_WALL_FRACTION = 0.006;
export const OPENING_DEFAULTS: Record<OpeningKind, { width_m: number; height_m: number; sill_m: number }> = {
  door: { width_m: 0.9, height_m: 2.1, sill_m: 0 },
  window: { width_m: 1.2, height_m: 1.2, sill_m: 0.9 },
  passage: { width_m: 1.0, height_m: 2.1, sill_m: 0 },
};

/** Half-up rounding to 0.01 px - the backend's r2, so both sides print the same numbers. */
export const r2 = (v: number): number => Math.floor(v * 100 + 0.5) / 100;
const rp = (p: Pt): Pt => [r2(p[0]), r2(p[1])];
const byId = <T extends { id: string }>(a: T, b: T): number => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
const clamp01 = (v: number): number => Math.min(1, Math.max(0, v));

/** Metres per version pixel, and whether it is only an estimate (no calibration: a 0.2 m wall = 0.6 % of the width). */
export function effectiveScale(doc: Pick<GeometryDoc, 'dimensions'>): { scale: number; estimated: boolean } {
  const d = doc.dimensions;
  const s = d.scale_m_per_px;
  const st = d.calibration?.status;
  if (typeof s === 'number' && s > 0 && (st === 'measured' || st === 'estimated')) return { scale: s, estimated: st === 'estimated' };
  return { scale: DEFAULT_WALL_THICKNESS_M / (ESTIMATED_WALL_FRACTION * (d.width_px || 1000)), estimated: true };
}

function cumulative(pts: Pt[]): number[] {
  const out = [0];
  for (let i = 1; i < pts.length; i++) out.push(out[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  return out;
}

/** The point at arc length s along a polyline and the unit direction of the segment it lies on. */
export function pointAt(pts: Pt[], cum: number[], s: number): { p: Pt; d: Pt } {
  let i = 0;
  while (i < pts.length - 2 && s > cum[i + 1]) i++;
  const [x0, y0] = pts[i];
  const [x1, y1] = pts[i + 1];
  const seg = cum[i + 1] - cum[i];
  if (seg <= 1e-9) return { p: [x0, y0], d: [1, 0] };
  const f = Math.min(1, Math.max(0, (s - cum[i]) / seg));
  return { p: [x0 + (x1 - x0) * f, y0 + (y1 - y0) * f], d: [(x1 - x0) / seg, (y1 - y0) / seg] };
}

function subPolyline(pts: Pt[], cum: number[], s0: number, s1: number): Pt[] {
  const inner: Pt[] = [];
  for (let i = 1; i < pts.length - 1; i++) if (s0 < cum[i] && cum[i] < s1) inner.push(pts[i]);
  return [pointAt(pts, cum, s0).p, ...inner, pointAt(pts, cum, s1).p];
}

const extend = (p: Pt, q: Pt, by: number): Pt => {
  const dx = p[0] - q[0];
  const dy = p[1] - q[1];
  const n = Math.hypot(dx, dy);
  return n < 1e-9 ? p : [p[0] + (dx / n) * by, p[1] + (dy / n) * by];
};
const add = (p: Pt, v: Pt, k: number): Pt => [p[0] + v[0] * k, p[1] + v[1] * k];
const sweep = (c: Pt, a: Pt, b: Pt): 0 | 1 => ((a[0] - c[0]) * (b[1] - c[1]) - (a[1] - c[1]) * (b[0] - c[0]) > 0 ? 1 : 0);

function door(g0: Pt, g1: Pt, d: Pt, o: GeomOpening, w: number): Pick<DoorPrim, 'leaves' | 'arcs'> {
  const nl: Pt = [d[1], -d[0]];
  const nr: Pt = [-d[1], d[0]];
  const swing = o.swing || 'right';
  if (swing === 'none') return { leaves: [], arcs: [] };
  if (swing === 'sliding') {
    const k = w * 0.12;
    return { leaves: [[rp(add(g0, nl, k)), rp(add(g1, nl, k))]], arcs: [] };
  }
  if (swing === 'double') {
    const h = w / 2;
    const leaves: [Pt, Pt][] = [];
    const arcs: DoorPrim['arcs'] = [];
    const pairs: [Pt, Pt][] = [[g0, d], [g1, [-d[0], -d[1]]]];
    for (const [hinge, along] of pairs) {
      const tip = add(hinge, nl, h);
      const mid = add(hinge, along, h);
      leaves.push([rp(hinge), rp(tip)]);
      arcs.push({ from: rp(tip), to: rp(mid), r: r2(h), sweep: sweep(hinge, tip, mid) });
    }
    return { leaves, arcs };
  }
  const n = swing === 'left' ? nl : nr;
  const [hinge, other] = (o.hinge || 'start') === 'start' ? [g0, g1] : [g1, g0];
  const tip = add(hinge, n, w);
  return { leaves: [[rp(hinge), rp(tip)]], arcs: [{ from: rp(tip), to: rp(other), r: r2(w), sweep: sweep(hinge, tip, other) }] };
}

/** Walls cut by their openings (free ends grown by half the thickness), door leaves and arcs, window glass,
 * passages and labels, in plan pixels - the mirror of the backend's structure_primitives. */
export function buildPrimitives(doc: GeometryDoc, width: number, height: number, level: string | null = null): Primitive[] {
  const { scale } = effectiveScale(doc);
  const pxPerM = 1 / scale;
  const byWall = new Map<string, GeomOpening[]>();
  for (const o of doc.openings) byWall.set(o.wall_id, [...(byWall.get(o.wall_id) ?? []), o]);
  const prims: Primitive[] = [];
  const geo = new Map<string, { pts: Pt[]; cum: number[]; wpx: number }>();
  for (const w of [...doc.walls].sort(byId)) {
    if (level !== null && w.level_id !== level) continue;
    const pts: Pt[] = w.polyline.map((p) => [p[0] * width, p[1] * height]);
    const cum = cumulative(pts);
    const total = cum[cum.length - 1];
    if (total <= 1e-6) continue;
    const wpx = Math.max(1, (w.thickness_m || DEFAULT_WALL_THICKNESS_M) * pxPerM);
    geo.set(w.id, { pts, cum, wpx });
    const cuts = (byWall.get(w.id) ?? []).map((o): [number, number] => {
      const c = (o.t || 0) * total;
      const half = ((o.width_m || 0) * pxPerM) / 2;
      return [Math.max(0, c - half), Math.min(total, c + half)];
    });
    cuts.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    const keep: [number, number][] = [];
    let cursor = 0;
    for (const [a, b] of cuts) {
      if (a > cursor) keep.push([cursor, a]);
      cursor = Math.max(cursor, b);
    }
    if (cursor < total) keep.push([cursor, total]);
    let part = 0;
    for (const [s0, s1] of keep) {
      if (s1 - s0 <= 0.01) continue;
      const seg = subPolyline(pts, cum, s0, s1);
      if (s0 <= 0) seg[0] = extend(seg[0], seg[1], wpx / 2);
      if (s1 >= total) seg[seg.length - 1] = extend(seg[seg.length - 1], seg[seg.length - 2], wpx / 2);
      prims.push({ kind: 'wall', id: w.id, part, points: seg.map(rp), width: r2(wpx) });
      part += 1;
    }
  }
  for (const o of [...doc.openings].sort(byId)) {
    const g = geo.get(o.wall_id);
    if (!g) continue;
    const { p: c, d } = pointAt(g.pts, g.cum, (o.t || 0) * g.cum[g.cum.length - 1]);
    const w = (o.width_m || 0) * pxPerM;
    const g0 = add(c, d, -w / 2);
    const g1 = add(c, d, w / 2);
    const gap: [Pt, Pt] = [rp(g0), rp(g1)];
    if (o.kind === 'door') prims.push({ kind: 'door', id: o.id, gap, ...door(g0, g1, d, o, w) });
    else if (o.kind === 'window') {
      const nl: Pt = [d[1], -d[0]];
      const q = g.wpx / 4;
      prims.push({ kind: 'window', id: o.id, gap, lines: [[rp(add(g0, nl, q)), rp(add(g1, nl, q))], [rp(add(g0, nl, -q)), rp(add(g1, nl, -q))]] });
    } else prims.push({ kind: 'passage', id: o.id, gap });
  }
  for (const lb of [...doc.labels].sort(byId)) {
    if (level !== null && lb.level_id !== level) continue;
    prims.push({ kind: 'label', id: lb.id, x: r2(lb.position[0] * width), y: r2(lb.position[1] * height), text: String(lb.text ?? ''), size: r2(lb.size || 14) });
  }
  return prims;
}

// ---------------------------------------------------------------- editor maths

export function lengthPx(pts: Pt[], W: number, H: number): number {
  let s = 0;
  for (let i = 1; i < pts.length; i++) s += Math.hypot((pts[i][0] - pts[i - 1][0]) * W, (pts[i][1] - pts[i - 1][1]) * H);
  return s;
}

export function distanceM(a: Pt, b: Pt, W: number, H: number, scale: number): number {
  return Math.hypot((b[0] - a[0]) * W, (b[1] - a[1]) * H) * scale;
}

export function polygonAreaM2(poly: Pt[], W: number, H: number, scale: number): number {
  let a = 0;
  for (let i = 0; i < poly.length; i++) {
    const [x0, y0] = poly[i];
    const [x1, y1] = poly[(i + 1) % poly.length];
    a += x0 * W * (y1 * H) - x1 * W * (y0 * H);
  }
  return (Math.abs(a) / 2) * scale * scale;
}

export function perimeterM(poly: Pt[], W: number, H: number, scale: number): number {
  return lengthPx([...poly, poly[0]], W, H) * scale;
}

/** The wall closest to a point (plan pixels) and the relative position t along its polyline. */
export function nearestWall(p: Pt, walls: GeomWall[], W: number, H: number, maxPx: number, onlyId?: string): { wall: GeomWall; t: number; distPx: number } | null {
  const q: Pt = [p[0] * W, p[1] * H];
  let best: { wall: GeomWall; t: number; distPx: number } | null = null;
  for (const w of walls) {
    if (onlyId && w.id !== onlyId) continue;
    const pts: Pt[] = w.polyline.map((v) => [v[0] * W, v[1] * H]);
    const cum = cumulative(pts);
    const total = cum[cum.length - 1];
    if (total <= 1e-6) continue;
    for (let i = 0; i < pts.length - 1; i++) {
      const [ax, ay] = pts[i];
      const dx = pts[i + 1][0] - ax;
      const dy = pts[i + 1][1] - ay;
      const l2 = dx * dx + dy * dy;
      const u = l2 > 0 ? Math.max(0, Math.min(1, ((q[0] - ax) * dx + (q[1] - ay) * dy) / l2)) : 0;
      const dist = Math.hypot(q[0] - (ax + u * dx), q[1] - (ay + u * dy));
      if (dist <= maxPx && (!best || dist < best.distPx)) best = { wall: w, t: (cum[i] + u * Math.sqrt(l2)) / total, distPx: dist };
    }
  }
  return best;
}

/** A drawing point: onto a wall vertex within tolPx; otherwise, from the previous point, to the nearest 45 degrees
 * unless `free` (Shift). */
export function snapPoint(p: Pt, prev: Pt | null, walls: GeomWall[], W: number, H: number, opts: { tolPx: number; free: boolean }): Pt {
  let best: Pt | null = null;
  let bestD = opts.tolPx;
  for (const w of walls) {
    for (const v of w.polyline) {
      const dd = Math.hypot((v[0] - p[0]) * W, (v[1] - p[1]) * H);
      if (dd <= bestD) {
        best = v;
        bestD = dd;
      }
    }
  }
  if (best) return [best[0], best[1]];
  if (!prev || opts.free) return p;
  const dx = (p[0] - prev[0]) * W;
  const dy = (p[1] - prev[1]) * H;
  const len = Math.hypot(dx, dy);
  if (len < 1e-9) return p;
  const step = Math.PI / 4;
  const ang = Math.round(Math.atan2(dy, dx) / step) * step;
  return [clamp01(prev[0] + (Math.cos(ang) * len) / W), clamp01(prev[1] + (Math.sin(ang) * len) / H)];
}
```

- [ ] **Step 4: Write `frontend/src/map/studio-ops.ts`**

```ts
/** Plan Studio (T084): pure edits of a structure document - every function returns a new document, so undo / redo is
 * a stack of documents and nothing is ever mutated in place. */
import { DEFAULT_LEVEL_ID, OPENING_DEFAULTS, type GeometryDoc, type GeomOpening, type GeomWall, type OpeningKind, type Pt, type Swing, type WallKind } from './geometry';

export interface WallDefaults {
  thickness_m: number;
  kind: WallKind;
}

/** 16 hex characters, like the backend's new_id(). */
export function newId(): string {
  const b = new Uint8Array(8);
  crypto.getRandomValues(b);
  return Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
}

const round5 = (v: number): number => Math.round(v * 1e5) / 1e5;
const clampPt = (p: Pt): Pt => [round5(Math.min(1, Math.max(0, p[0]))), round5(Math.min(1, Math.max(0, p[1])))];

export function defaultLevelId(doc: GeometryDoc): string {
  return doc.levels.find((l) => l.is_default)?.id ?? DEFAULT_LEVEL_ID;
}

/** A kind's usual size and swing (a door opens, a window and a passage do not). */
export function kindDefaults(kind: OpeningKind): Pick<GeomOpening, 'kind' | 'width_m' | 'height_m' | 'sill_m' | 'swing'> {
  const swing: Swing = kind === 'door' ? 'right' : 'none';
  return { kind, ...OPENING_DEFAULTS[kind], swing };
}

export function addWall(doc: GeometryDoc, points: Pt[], defaults: WallDefaults): { doc: GeometryDoc; id: string } {
  const id = newId();
  const wall: GeomWall = { id, level_id: defaultLevelId(doc), polyline: points.map(clampPt), thickness_m: defaults.thickness_m, height_m: null, base_z_m: 0,
    kind: defaults.kind, confidence: 1, source: 'manual', locked: false, external_ids: {} };
  return { doc: { ...doc, walls: [...doc.walls, wall] }, id };
}

export function addOpening(doc: GeometryDoc, wallId: string, t: number, kind: OpeningKind): { doc: GeometryDoc; id: string } {
  const o: GeomOpening = { id: newId(), wall_id: wallId, t: round5(Math.min(1, Math.max(0, t))), ...kindDefaults(kind), hinge: 'start', anchor_ref: null,
    confidence: 1, source: 'manual', external_ids: {} };
  return { doc: { ...doc, openings: [...doc.openings, o] }, id: o.id };
}

export function patchWall(doc: GeometryDoc, id: string, patch: Partial<GeomWall>): GeometryDoc {
  return { ...doc, walls: doc.walls.map((w) => (w.id === id ? { ...w, ...patch, id: w.id } : w)) };
}

export function patchOpening(doc: GeometryDoc, id: string, patch: Partial<GeomOpening>): GeometryDoc {
  return {
    ...doc,
    openings: doc.openings.map((o) => (o.id === id ? { ...o, ...patch, id: o.id, t: patch.t === undefined ? o.t : round5(Math.min(1, Math.max(0, patch.t))) } : o)),
  };
}

export function moveVertex(doc: GeometryDoc, id: string, index: number, p: Pt): GeometryDoc {
  return { ...doc, walls: doc.walls.map((w) => (w.id === id ? { ...w, polyline: w.polyline.map((q, i) => (i === index ? clampPt(p) : q)) } : w)) };
}

/** A wall takes its openings with it. */
export function removeItem(doc: GeometryDoc, id: string): GeometryDoc {
  if (doc.walls.some((w) => w.id === id)) return { ...doc, walls: doc.walls.filter((w) => w.id !== id), openings: doc.openings.filter((o) => o.wall_id !== id) };
  return { ...doc, openings: doc.openings.filter((o) => o.id !== id), labels: doc.labels.filter((l) => l.id !== id) };
}
```

- [ ] **Step 5: Run the spec and the type check**

Run (in `frontend/`): `npx playwright test tests/unit-geometry.spec.ts --project=desktop --reporter=line` → `5 passed`.
Run: `npx tsc --noEmit -p tsconfig.json` → no output (exit 0).

- [ ] **Step 6: Commit**

```bash
git add frontend/src/map/geometry.ts frontend/src/map/studio-ops.ts frontend/tests/unit-geometry.spec.ts
msg=$(mktemp) && cat > "$msg" <<'EOF'
feat(plan-studio): frontend geometry maths and document operations, same primitives as the backend (T084)

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOF
test "$(bash /c/cloude/smplwisebms/secrets/scan_staged.sh)" = 0 && git commit -F "$msg"
```

---

### Task 10: API client, bundle fields, the studio controller

**Files:**
- Create: `frontend/src/api/geometry.ts`
- Create: `frontend/src/map/studio-controller.ts`
- Modify: `frontend/src/api/types.ts`, `frontend/src/api/maps.ts`
- Test: `frontend/tests/unit-studio-controller.spec.ts`

**Interfaces:**
- Consumes: `get`, `post`, `put`, `patch`, `resourceUrl`, `ApiError`, `describeError` (`api/client.ts`); `GeometryDoc`, `Pt` (Task 9).
- Produces:
  - `types.ts`: `GeometryRef {id, doc_hash, status, revision, published_at}`; `PlanVersion.calibration?`; `FloorMap.geometry?`.
  - `maps.ts`: `MapBundle.geometryRef: GeometryRef | null`, `MapBundle.scaleMPerPx: number | null`.
  - `api/geometry.ts`: `GeometryRow`, `GeometryIssue`, `CopyCandidate`, `GeometryResponse`, `GeometryDiff`, `CalibrationResult`, `GeometryPeriod`; `getGeometry(versionId, {draft?, at?})`, `geometryFor(bundle)`, `geometryAt(versionId, iso)`, `saveGeometryDraft(versionId, doc, baseRevision)`, `publishGeometry(versionId)`, `geometryDiff(versionId)`, `copyGeometryFrom(versionId, fromVersionId)`, `calibrate(versionId, pairs)`, `exportUrl(versionId, fmt, {draft?})`.
  - `studio-controller.ts`: `SaveState`, `StudioApi {load, save}`, `class StudioController` with fields `doc, revision, hash, publishedHash, issues, copyCandidates, saveState, error`, getters `canUndo, canRedo, pendingPublish`, methods `load(versionId)`, `commit(doc)`, `undo()`, `redo()`, `flush()`.

- [ ] **Step 1: Write the failing spec `frontend/tests/unit-studio-controller.spec.ts`**

```ts
import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ReactiveControllerHost } from 'lit';
import { ApiError } from '../src/api/client';
import type { GeometryResponse, GeometryRow } from '../src/api/geometry';
import type { GeometryDoc } from '../src/map/geometry';
import { StudioController, type StudioApi } from '../src/map/studio-controller';

// Plan Studio (T084): the editor's autosave - one save after the quiet period with the revision the server gave, undo
// saves too, and a conflict keeps the local edit and says so. Runs in node with a fake host and a fake API.
const HERE = path.dirname(fileURLToPath(import.meta.url));
const sample = () => JSON.parse(fs.readFileSync(path.resolve(HERE, '..', '..', 'contracts', 'fixtures', 'plan_geometry', 'sample-v2.json'), 'utf8')) as GeometryDoc;
const host = () => ({ addController() {}, removeController() {}, requestUpdate() {}, updateComplete: Promise.resolve(true) }) as unknown as ReactiveControllerHost;
const row = (revision: number, status: GeometryRow['status']): GeometryRow => ({ id: 'g1', plan_version_id: 'v1', floor_id: 'f1', status, revision, doc_hash: `h${revision}`,
  created_at: null, updated_at: null, published_at: null, published_by: null, archived_at: null });
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function fakeApi(doc: GeometryDoc) {
  const saves: { revision: number; walls: number }[] = [];
  let rev = 0;
  const api: StudioApi = {
    load: async (): Promise<GeometryResponse> => ({ geometry: row(0, 'new'), doc, issues: [], published_hash: null, copy_candidates: [] }),
    save: async (_id, d, base): Promise<GeometryResponse> => {
      if (base !== rev) throw new ApiError(409, { code: 'stale_revision', user_message: 'x', retryable: false, correlation_id: '', details: {} });
      rev += 1;
      saves.push({ revision: rev, walls: d.walls.length });
      return { geometry: row(rev, 'draft'), doc: d, issues: [], published_hash: null };
    },
  };
  return { api, saves };
}

test.describe('studio controller (unit)', () => {
  test('edits are saved once after the quiet period, in order, with the right base revision', async () => {
    const { api, saves } = fakeApi(sample());
    const c = new StudioController(host(), api, 20);
    await c.load('v1');
    c.commit({ ...c.doc!, walls: c.doc!.walls.slice(0, 3) });
    c.commit({ ...c.doc!, walls: c.doc!.walls.slice(0, 2) });
    expect(c.saveState).toBe('pending');
    await sleep(80);
    expect(saves).toEqual([{ revision: 1, walls: 2 }]);
    expect(c.saveState).toBe('saved');
    c.undo();
    await c.flush();
    expect(saves.at(-1)).toEqual({ revision: 2, walls: 3 });
    expect(c.revision).toBe(2);
    expect(c.canRedo).toBe(true);
  });

  test('a conflict keeps the local edit and reports it', async () => {
    const { api } = fakeApi(sample());
    const c = new StudioController(host(), api, 20);
    await c.load('v1');
    c.revision = 5; // another editor saved meanwhile
    c.commit({ ...c.doc!, walls: [] });
    await c.flush();
    expect(c.saveState).toBe('error');
    expect(c.error).toContain('במקום אחר');
    expect(c.doc!.walls).toEqual([]);
  });

  test('pendingPublish: only when the draft differs from what viewers see and there is something to show', async () => {
    const { api } = fakeApi(sample());
    const c = new StudioController(host(), api, 20);
    await c.load('v1');
    expect(c.pendingPublish).toBe(true); // the sample has walls, nothing is published
    c.publishedHash = c.hash;
    expect(c.pendingPublish).toBe(false);
  });
});
```

- [ ] **Step 2: Run to see it fail**

Run (in `frontend/`): `npx playwright test tests/unit-studio-controller.spec.ts --project=desktop --reporter=line`
Expected: FAIL — cannot resolve `../src/api/geometry` / `../src/map/studio-controller`.

- [ ] **Step 3: Types and bundle fields**

In `frontend/src/api/types.ts`, add after the `PlanVersion` interface:

```ts
/** Plan Studio (T084): the structure document the map bundle points to - fetched separately and cached by hash. */
export interface GeometryRef {
  id: string | null;
  doc_hash: string;
  status: 'new' | 'draft' | 'published' | 'archived';
  revision: number;
  published_at: string | null;
}
```

In `PlanVersion`, after `scale_m_per_px: number | null;` add:

```ts
  /** Two-point calibration record (Plan Studio): pairs, method, residual. */
  calibration?: { method: string; pairs: { a: [number, number]; b: [number, number]; metres: number }[]; residual_pct: number | null } | null;
```

In `FloorMap`, after `plan: PlanVersion | null;` add:

```ts
  /** Reference to the structure document of the shown version (null when none is published). */
  geometry?: GeometryRef | null;
```

In `frontend/src/api/maps.ts`: add `GeometryRef` to the `import type { … } from './types'` list; in `MapBundle` add after `haHistory: …;`:

```ts
  /** Plan Studio: the structure document of the shown version (fetched by hash) and the version's scale. */
  geometryRef: GeometryRef | null;
  scaleMPerPx: number | null;
```

In `demoBundle(...)` add `geometryRef: null, scaleMPerPx: null,` next to `haHistory: null,`; in `loadMap(...)` add next to `haHistory: m.ha_history ?? null,`:

```ts
    geometryRef: m.geometry ?? null,
    scaleMPerPx: m.plan?.scale_m_per_px ?? null,
```

- [ ] **Step 4: Write `frontend/src/api/geometry.ts`**

```ts
/**
 * Plan Studio API (T084): the structure document of a plan version. Maps get it by hash (the bundle carries only the
 * reference), the historical map by the version's publish timeline; the editor works on the draft through the studio
 * controller.
 */
import { get, patch, post, put, resourceUrl } from './client';
import type { GeometryDoc, Pt } from '../map/geometry';
import type { MapBundle } from './maps';
import type { PlanVersion } from './types';

export interface GeometryRow {
  id: string | null;
  plan_version_id: string;
  floor_id: string;
  status: 'new' | 'draft' | 'published' | 'archived';
  revision: number;
  doc_hash: string;
  created_at: string | null;
  updated_at: string | null;
  published_at: string | null;
  published_by: string | null;
  archived_at: string | null;
}
export interface GeometryIssue {
  code: string;
  severity: 'error' | 'warning';
  structural: boolean;
  id: string | null;
  path: string;
  message: string;
}
export interface CopyCandidate {
  version_id: string;
  status: string;
  created_at: string;
  walls: number;
  openings: number;
  same_drawing: boolean;
}
export interface GeometryResponse {
  geometry: GeometryRow;
  doc: GeometryDoc;
  issues: GeometryIssue[];
  published_hash: string | null;
  copy_candidates?: CopyCandidate[];
}
export interface GeometryDiff {
  collections: Record<string, { added: string[]; removed: string[]; changed: string[] }>;
  total: number;
  calibration_changed: boolean;
  same: boolean;
}
export interface CalibrationResult {
  version: PlanVersion;
  scale_m_per_px: number;
  residual_pct: number;
  warning: string | null;
}
export interface GeometryPeriod {
  id: string;
  doc_hash: string;
  published_at: string;
  archived_at: string | null;
}

const byHash = new Map<string, GeometryDoc>();
const timelines = new Map<string, Promise<GeometryPeriod[]>>();

export function getGeometry(versionId: string, opts: { draft?: boolean; at?: string } = {}): Promise<GeometryResponse> {
  const q = new URLSearchParams();
  if (opts.draft) q.set('draft', 'true');
  if (opts.at) q.set('at', opts.at);
  const qs = q.toString();
  return get<GeometryResponse>(`plan-versions/${versionId}/geometry${qs ? `?${qs}` : ''}`);
}

/** The structure a live map shows: fetched once per hash. A map without its structure still works (null on error). */
export async function geometryFor(bundle: MapBundle): Promise<GeometryDoc | null> {
  const ref = bundle.geometryRef;
  if (bundle.source !== 'api' || !ref || !bundle.planVersionId) return null;
  const hit = byHash.get(ref.doc_hash);
  if (hit) return hit;
  try {
    const r = await getGeometry(bundle.planVersionId, ref.status === 'draft' ? { draft: true } : {});
    byHash.set(r.geometry.doc_hash, r.doc);
    return r.doc;
  } catch {
    return null;
  }
}

/** The structure a historical map shows at an instant: the version's publish timeline is read once, documents once per hash. */
export async function geometryAt(versionId: string, iso: string): Promise<GeometryDoc | null> {
  let tl = timelines.get(versionId);
  if (!tl) {
    tl = get<{ timeline: GeometryPeriod[] }>(`plan-versions/${versionId}/geometry/timeline`).then((r) => r.timeline).catch(() => []);
    timelines.set(versionId, tl);
  }
  const period = (await tl).find((p) => p.published_at <= iso && (!p.archived_at || iso < p.archived_at));
  if (!period) return null;
  const hit = byHash.get(period.doc_hash);
  if (hit) return hit;
  try {
    const r = await getGeometry(versionId, { at: period.published_at });
    byHash.set(r.geometry.doc_hash, r.doc);
    return r.doc;
  } catch {
    return null;
  }
}

export const saveGeometryDraft = (versionId: string, doc: GeometryDoc, baseRevision: number) =>
  put<GeometryResponse>(`plan-versions/${versionId}/geometry`, { doc, base_revision: baseRevision });
export const publishGeometry = (versionId: string) =>
  post<{ published: GeometryRow | null; diff: GeometryDiff; unchanged: boolean }>(`plan-versions/${versionId}/geometry/publish`);
export const geometryDiff = (versionId: string) =>
  get<{ diff: GeometryDiff; issues: GeometryIssue[]; counts: Record<string, number>; published_counts: Record<string, number> | null }>(`plan-versions/${versionId}/geometry/diff`);
export const copyGeometryFrom = (versionId: string, fromVersionId: string) =>
  post<GeometryResponse>(`plan-versions/${versionId}/geometry/copy-from`, { from_version_id: fromVersionId });
export const calibrate = (versionId: string, pairs: { a: Pt; b: Pt; metres: number }[]) =>
  patch<CalibrationResult>(`plan-versions/${versionId}/calibration`, { pairs });
export function exportUrl(versionId: string, fmt: 'svg' | 'png', opts: { draft?: boolean } = {}): string {
  return resourceUrl(`api/v1/plan-versions/${versionId}/export.${fmt}${opts.draft ? '?draft=true' : ''}`);
}
```

- [ ] **Step 5: Write `frontend/src/map/studio-controller.ts`**

```ts
import type { ReactiveController, ReactiveControllerHost } from 'lit';
import { ApiError, describeError } from '../api/client';
import { getGeometry, saveGeometryDraft, type CopyCandidate, type GeometryIssue, type GeometryResponse } from '../api/geometry';
import type { GeometryDoc } from './geometry';

export type SaveState = 'idle' | 'pending' | 'saving' | 'saved' | 'error';

export interface StudioApi {
  load: (versionId: string) => Promise<GeometryResponse>;
  save: (versionId: string, doc: GeometryDoc, baseRevision: number) => Promise<GeometryResponse>;
}

const DEFAULT_API: StudioApi = { load: (id) => getGeometry(id, { draft: true }), save: (id, doc, base) => saveGeometryDraft(id, doc, base) };

/**
 * Plan Studio draft state for the editor (T084): the working document, undo / redo, and the autosave that PUTs the
 * draft `delayMs` after the last edit with the revision the server gave last time. A 409 keeps the local edit and says
 * so; the editor offers a reload.
 */
export class StudioController implements ReactiveController {
  doc: GeometryDoc | null = null;
  revision = 0;
  hash: string | null = null;
  publishedHash: string | null = null;
  issues: GeometryIssue[] = [];
  copyCandidates: CopyCandidate[] = [];
  saveState: SaveState = 'idle';
  error = '';
  private versionId: string | null = null;
  private undoStack: GeometryDoc[] = [];
  private redoStack: GeometryDoc[] = [];
  private timer: ReturnType<typeof setTimeout> | undefined;
  private dirty = false;
  private inflight: Promise<void> | null = null;

  constructor(private readonly host: ReactiveControllerHost, private readonly api: StudioApi = DEFAULT_API, private readonly delayMs = 2000) {
    host.addController(this);
  }

  hostConnected(): void {}

  hostDisconnected(): void {
    clearTimeout(this.timer);
  }

  get canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  get canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  /** The draft differs from what viewers see, and there is something to show. */
  get pendingPublish(): boolean {
    const d = this.doc;
    if (!d || !this.hash || this.hash === this.publishedHash) return false;
    return this.publishedHash !== null || d.walls.length > 0 || d.openings.length > 0 || d.labels.length > 0;
  }

  async load(versionId: string): Promise<void> {
    clearTimeout(this.timer);
    this.versionId = versionId;
    const r = await this.api.load(versionId);
    this.apply(r);
    this.doc = r.doc;
    this.copyCandidates = r.copy_candidates ?? [];
    this.undoStack = [];
    this.redoStack = [];
    this.dirty = false;
    this.saveState = 'idle';
    this.error = '';
    this.host.requestUpdate();
  }

  commit(next: GeometryDoc): void {
    if (!this.doc) return;
    this.undoStack = [...this.undoStack.slice(-60), this.doc];
    this.redoStack = [];
    this.change(next);
  }

  undo(): void {
    const prev = this.undoStack.pop();
    if (!prev || !this.doc) return;
    this.redoStack.push(this.doc);
    this.change(prev);
  }

  redo(): void {
    const next = this.redoStack.pop();
    if (!next || !this.doc) return;
    this.undoStack.push(this.doc);
    this.change(next);
  }

  /** Save now and wait: before publishing, calibrating or leaving the editor. */
  async flush(): Promise<void> {
    clearTimeout(this.timer);
    for (;;) {
      if (this.inflight) await this.inflight;
      if (!this.dirty || this.saveState === 'error') return;
      this.inflight = this.saveOnce();
      await this.inflight;
      this.inflight = null;
    }
  }

  private change(next: GeometryDoc): void {
    this.doc = next;
    this.dirty = true;
    if (this.saveState !== 'saving') this.saveState = 'pending';
    clearTimeout(this.timer);
    this.timer = setTimeout(() => void this.flush(), this.delayMs);
    this.host.requestUpdate();
  }

  private apply(r: GeometryResponse): void {
    this.revision = r.geometry.revision;
    this.hash = r.geometry.doc_hash;
    this.publishedHash = r.published_hash;
    this.issues = r.issues;
  }

  private async saveOnce(): Promise<void> {
    const doc = this.doc;
    const id = this.versionId;
    if (!doc || !id) return;
    this.dirty = false;
    this.saveState = 'saving';
    this.host.requestUpdate();
    try {
      const r = await this.api.save(id, doc, this.revision);
      this.apply(r);
      this.saveState = this.dirty ? 'pending' : 'saved';
      this.error = '';
    } catch (err) {
      this.dirty = true;
      this.saveState = 'error';
      this.error = err instanceof ApiError && err.code === 'stale_revision' ? 'טיוטת המבנה נערכה במקום אחר; טען מחדש את העורך כדי לא לדרוס שינוי.' : describeError(err);
    } finally {
      this.host.requestUpdate();
    }
  }
}
```

- [ ] **Step 6: Run the specs and the type check**

Run (in `frontend/`): `npx playwright test tests/unit-studio-controller.spec.ts tests/unit-geometry.spec.ts --project=desktop --reporter=line` → `8 passed`.
Run: `npx tsc --noEmit -p tsconfig.json` → exit 0.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/api/geometry.ts frontend/src/map/studio-controller.ts frontend/src/api/types.ts frontend/src/api/maps.ts frontend/tests/unit-studio-controller.spec.ts
msg=$(mktemp) && cat > "$msg" <<'EOF'
feat(plan-studio): geometry API client, bundle reference, studio controller with autosave (T084)

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOF
test "$(bash /c/cloude/smplwisebms/secrets/scan_staged.sh)" = 0 && git commit -F "$msg"
```

---

### Task 11: The structure on every map (canvas layer + live map, history map, event page)

**Files:**
- Modify: `frontend/src/map/sw-plan-canvas.ts`
- Modify: `frontend/src/styles/tokens.css`
- Modify: `frontend/src/components/sw-icon.ts`
- Modify: `frontend/src/screens/explore-floor-map.ts`, `frontend/src/screens/investigate-history-map.ts`, `frontend/src/screens/investigate-event-detail.ts`
- Test: `frontend/tests/evidence-plan-studio.spec.ts` (new, live)

**Interfaces:**
- Consumes: `buildPrimitives`, `Primitive`, `Pt`, `GeometryDoc` (Task 9); `geometryFor`, `geometryAt` (Task 10).
- Produces: `sw-plan-canvas` properties `geometry: GeometryDoc | null`, `structureLevel: string | null`, `issueIds: string[]`, `selectedGeomId: string | null`; DOM `[data-structure]`, `[data-wall=<id>]` (one per wall part), `[data-opening=<id>][data-kind]`, `[data-label=<id>]`. Icons `wall`, `ruler`, `scale`. Tokens `--sw-map-structure`, `--sw-map-glass`. Floor-map layer id `structure` (label "מבנה").

- [ ] **Step 1: Write the live spec `frontend/tests/evidence-plan-studio.spec.ts` (harness + first test)**

```ts
import { test, expect, type APIRequestContext, type Page } from '@playwright/test';

// Plan Studio phase 1 (T084) against the running developer backend. The spec builds its own site / building / floor
// with a generated plan picture, so the owner's floors are never touched, and removes them at the end.
// Runs only with SW_LIVE=1 (backend on 8099 behind the preview proxy).
const ids = { site: '', building: '', floor: '', version: '', asset: '' };
let api: APIRequestContext;

const WALL = (id: string, polyline: [number, number][]) => ({ id, level_id: 'L0', polyline, thickness_m: 0.2, height_m: null, base_z_m: 0, kind: 'exterior',
  confidence: 1, source: 'manual', locked: false, external_ids: {} });

/** Click a normalized plan point on the canvas of `screen` (the canvas converts plan to host pixels itself). */
async function clickPlan(page: Page, screen: string, x: number, y: number) {
  const canvas = page.locator(`${screen} sw-plan-canvas`);
  const box = (await canvas.boundingBox())!;
  const s = await canvas.evaluate((el, p) => (el as unknown as { toScreen: (a: number, b: number) => { x: number; y: number } }).toScreen(p[0], p[1]), [x, y] as [number, number]);
  await page.mouse.click(box.x + s.x, box.y + s.y);
}

test.describe.serial('plan studio (SW A)', () => {
  test.skip(process.env.SW_LIVE !== '1', 'set SW_LIVE=1 with the backend running');

  test.beforeAll(async ({ playwright, browser }) => {
    api = await playwright.request.newContext({ baseURL: 'http://127.0.0.1:4173/' });
    const stamp = new Date().toISOString().slice(0, 19);
    ids.site = (await (await api.post('api/v1/sites', { data: { name: `בדיקת סטודיו ${stamp}`, address: '' } })).json()).id;
    ids.building = (await (await api.post(`api/v1/sites/${ids.site}/buildings`, { data: { name: 'מבנה בדיקה' } })).json()).id;
    ids.floor = (await (await api.post(`api/v1/buildings/${ids.building}/floors`, { data: { name: 'קומת בדיקה', level: 0 } })).json()).id;
    const page = await browser.newPage({ viewport: { width: 800, height: 500 } });
    await page.setContent('<div style="box-sizing:border-box;width:800px;height:500px;background:#fff;border:10px solid #333"></div>');
    const png = await page.screenshot();
    await page.close();
    const asset = await (await api.post(`api/v1/floors/${ids.floor}/plan-assets`, { multipart: { file: { name: 'plan.png', mimeType: 'image/png', buffer: png } } })).json();
    ids.asset = asset.id;
    ids.version = (await (await api.post(`api/v1/floors/${ids.floor}/plan-versions`, { data: { asset_id: asset.id } })).json()).id;
    expect((await api.post(`api/v1/plan-versions/${ids.version}/publish`)).status()).toBe(200);
  });

  test.afterAll(async () => {
    if (!api) return;
    if (ids.floor) await api.delete(`api/v1/floors/${ids.floor}?force=true`);
    if (ids.building) await api.delete(`api/v1/buildings/${ids.building}`);
    if (ids.site) await api.delete(`api/v1/sites/${ids.site}`);
    await api.dispose();
  });

  test('a published structure shows on the live map, with a layer switch, and on the history map', async ({ page }) => {
    const g = await (await api.get(`api/v1/plan-versions/${ids.version}/geometry?draft=true`)).json();
    const doc = { ...g.doc, walls: [WALL('lw1', [[0.1, 0.1], [0.9, 0.1]]), WALL('lw2', [[0.1, 0.1], [0.1, 0.9]])],
      openings: [{ id: 'lo1', wall_id: 'lw1', t: 0.5, kind: 'door', width_m: 0.9, height_m: 2.1, sill_m: 0, swing: 'right', hinge: 'start', anchor_ref: null,
        confidence: 1, source: 'manual', external_ids: {} }] };
    expect((await api.put(`api/v1/plan-versions/${ids.version}/geometry`, { data: { doc, base_revision: g.geometry.revision } })).status()).toBe(200);
    expect((await api.post(`api/v1/plan-versions/${ids.version}/geometry/publish`)).status()).toBe(200);
    await page.goto(`/?design=a#/explore/floors/${ids.floor}`);
    const walls = page.locator('explore-floor-map sw-plan-canvas [data-structure] [data-wall]');
    await expect(walls).toHaveCount(3, { timeout: 20000 }); // lw1 is cut by its door into two parts, plus lw2
    await expect(page.locator('explore-floor-map sw-plan-canvas [data-opening="lo1"][data-kind="door"]')).toHaveCount(1);
    await page.locator('explore-floor-map .layers button[aria-label="מבנה"]').click();
    await expect(walls).toHaveCount(0);
    await page.locator('explore-floor-map .layers button[aria-label="מבנה"]').click();
    await expect(walls).toHaveCount(3);
    await page.waitForTimeout(1100); // the instant must be after the publish second
    const t = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
    await page.goto(`/?design=a#/investigate/floors/${ids.floor}/history?t=${t}`);
    await expect(page.locator('investigate-history-map sw-plan-canvas [data-wall]')).toHaveCount(3, { timeout: 20000 });
  });
});
```

- [ ] **Step 2: Run to see it fail**

Restart the dev backend (it must run the Tasks 1–8 code), then in `frontend/`: `npm run build && SW_LIVE=1 SW_CHROME=1 npx playwright test tests/evidence-plan-studio.spec.ts --project=desktop --workers=1 --reporter=line`
Expected: FAIL — `[data-structure] [data-wall]` count 0 (the canvas does not draw the structure yet).

- [ ] **Step 3: Tokens and icons**

`frontend/src/styles/tokens.css` — after `  --sw-map-furniture-line: #c9d3e3;` add:

```css
  --sw-map-structure: #4b5567;
  --sw-map-glass: #7fb2ff;
```

and after `  --sw-map-furniture-line: #d3dbe7;` add:

```css
  --sw-map-structure: #56617a;
  --sw-map-glass: #7fb2ff;
```

`frontend/src/components/sw-icon.ts` — after the `stairs:` entry add:

```ts
  wall: svg`<path d="M3 5h18v4H3zM3 15h18v4H3zM8 9v6M16 9v6"/>`,
  ruler: svg`<path d="M3 16 16 3l5 5L8 21z"/><path d="m7 12 2 2M10 9l2 2M13 6l2 2"/>`,
  scale: svg`<path d="M4 20h16M4 20V8M20 20V8M4 8l8-4 8 4M8 14h8"/>`,
```

- [ ] **Step 4: The canvas layer (`frontend/src/map/sw-plan-canvas.ts`)**

Add the import below the existing ones:

```ts
import { buildPrimitives, type GeometryDoc, type Primitive, type Pt } from './geometry';
```

Add after the `polygonCentroid` function (module level):

```ts
const ptsAttr = (ps: Pt[]): string => ps.map((p) => `${p[0]},${p[1]}`).join(' ');
```

Add these properties after `@property({ type: Boolean }) boxSelect = false;`:

```ts
  /** Plan Studio (T084): the structure document, drawn between the rooms and the pins on every map. */
  @property({ attribute: false }) geometry: GeometryDoc | null = null;
  /** Show one level only (null = all levels). */
  @property() structureLevel: string | null = null;
  /** Items with a validation error, drawn in red (editor). */
  @property({ attribute: false }) issueIds: string[] = [];
  @property() selectedGeomId: string | null = null;
  private primCache: { doc: GeometryDoc; w: number; h: number; level: string | null; prims: Primitive[] } | null = null;
```

Add these methods before `render()`:

```ts
  /** Primitives of the shown document, recomputed only when the document, the plan size or the level changes. */
  private primitives(doc: GeometryDoc): Primitive[] {
    const c = this.primCache;
    if (c && c.doc === doc && c.w === this.planWidth && c.h === this.planHeight && c.level === this.structureLevel) return c.prims;
    const prims = buildPrimitives(doc, this.planWidth, this.planHeight, this.structureLevel);
    this.primCache = { doc, w: this.planWidth, h: this.planHeight, level: this.structureLevel, prims };
    return prims;
  }

  private renderStructure() {
    const doc = this.geometry;
    if (!doc) return nothing;
    const inv = 1 / this.scale;
    const issues = new Set(this.issueIds);
    return svg`<g class="structure" data-structure>${this.primitives(doc).map((p) => this.renderPrimitive(p, inv, issues))}</g>`;
  }

  private renderPrimitive(p: Primitive, inv: number, issues: Set<string>) {
    const cls = `${p.id === this.selectedGeomId ? 'sel' : ''} ${issues.has(p.id) ? 'issue' : ''}`;
    switch (p.kind) {
      case 'wall':
        return svg`<g class="wall-g ${cls}" data-wall=${p.id}><polyline class="wall" points=${ptsAttr(p.points)} stroke-width=${p.width} /></g>`;
      case 'door':
        return svg`<g class="opening ${cls}" data-opening=${p.id} data-kind="door">
          ${p.leaves.map(([a, b]) => svg`<line class="leaf" x1=${a[0]} y1=${a[1]} x2=${b[0]} y2=${b[1]} stroke-width=${1.6 * inv} />`)}
          ${p.arcs.map((a) => svg`<path class="arc" d=${`M ${a.from[0]} ${a.from[1]} A ${a.r} ${a.r} 0 0 ${a.sweep} ${a.to[0]} ${a.to[1]}`} stroke-width=${1.1 * inv} stroke-dasharray=${`${4 * inv} ${3 * inv}`} />`)}
        </g>`;
      case 'window':
        return svg`<g class="opening ${cls}" data-opening=${p.id} data-kind="window">${p.lines.map(([a, b]) => svg`<line class="glass" x1=${a[0]} y1=${a[1]} x2=${b[0]} y2=${b[1]} stroke-width=${1.6 * inv} />`)}</g>`;
      case 'passage':
        return svg`<g class="opening ${cls}" data-opening=${p.id} data-kind="passage"><line class="gapline" x1=${p.gap[0][0]} y1=${p.gap[0][1]} x2=${p.gap[1][0]} y2=${p.gap[1][1]} stroke-width=${inv} stroke-dasharray=${`${2 * inv} ${3 * inv}`} /></g>`;
      case 'label':
        return svg`<text class="glabel" data-label=${p.id} x=${p.x} y=${p.y} font-size=${p.size}>${p.text}</text>`;
    }
  }
```

In `render()`, replace

```ts
            ${this.zones.map((z) => this.renderZone(z))}
            ${this.markers.map((m) => this.renderMarker(m))}
```

with

```ts
            ${this.zones.map((z) => this.renderZone(z))}
            ${this.renderStructure()}
            ${this.markers.map((m) => this.renderMarker(m))}
```

In `static styles`, after the `.draft circle { … }` rule add:

```css
    .structure {
      pointer-events: none;
    }
    .structure .wall {
      fill: none;
      stroke: var(--sw-map-structure);
      stroke-linecap: butt;
      stroke-linejoin: miter;
    }
    .structure .sel .wall {
      stroke: var(--sw-accent);
    }
    .structure .issue .wall,
    .structure .opening.issue line,
    .structure .opening.issue path {
      stroke: var(--sw-danger);
    }
    .structure .leaf,
    .structure .arc {
      fill: none;
      stroke: var(--sw-accent);
    }
    .structure .glass {
      stroke: var(--sw-map-glass);
    }
    .structure .gapline {
      stroke: var(--sw-map-structure);
    }
    .structure .opening.sel .leaf,
    .structure .opening.sel .glass,
    .structure .opening.sel .gapline {
      stroke: var(--sw-accent-hover);
    }
    .structure .glabel {
      fill: var(--sw-map-label);
      font-weight: 600;
      text-anchor: middle;
      dominant-baseline: middle;
    }
```

- [ ] **Step 5: The live floor map (`frontend/src/screens/explore-floor-map.ts`)**

Imports (below the existing ones):

```ts
import { geometryFor } from '../api/geometry';
import type { GeometryDoc } from '../map/geometry';
```

Replace `type Layer = 'cameras' | 'doors' | 'lights' | 'sensors' | 'zones';` with `type Layer = 'cameras' | 'doors' | 'lights' | 'sensors' | 'zones' | 'structure';`, change the `LAYERS` icon type to `'camera' | 'door' | 'light' | 'sensor' | 'map' | 'wall'`, and add the entry after the zones one:

```ts
  { id: 'structure', icon: 'wall', label: () => 'מבנה' },
```

Replace `@state() private layers = new Set<Layer>(['cameras', 'doors', 'lights', 'sensors', 'zones']);` with:

```ts
  @state() private layers = new Set<Layer>(['cameras', 'doors', 'lights', 'sensors', 'zones', 'structure']);
  /** Plan Studio: the published structure of the shown version (fetched by hash after the bundle). */
  @state() private geometry: GeometryDoc | null = null;
  private geomSeq = 0;
```

In `load()`, right after `this.bundle = await loadMap(this.floorId);` add:

```ts
      const seq = ++this.geomSeq;
      this.geometry = null;
      void geometryFor(this.bundle).then((g) => {
        if (seq === this.geomSeq) this.geometry = g; // live HA updates replace the bundle object: compare loads, not objects
      });
```

Replace `setLayers` and `restoreLayers` with:

```ts
  /** Layer state is remembered per floor in this browser (M07: "מצב שכבות נשמר עם התצוגה"); never on the server.
   * '-structure' records an explicit "off": lists stored before the structure layer existed must still show it. */
  private setLayers(next: Set<Layer>) {
    this.layers = next;
    try {
      const stored: string[] = [...next];
      if (!next.has('structure')) stored.push('-structure');
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
      if (!arr.includes('-structure')) next.add('structure');
      this.layers = next;
    } catch {
      /* ignore */
    }
  }
```

In `layerCounts()`, replace

```ts
    const out: Record<Layer, number> = { cameras: 0, doors: 0, lights: 0, sensors: 0, zones: b?.zones.length ?? 0 };
```

with

```ts
    const out: Record<Layer, number> = { cameras: 0, doors: 0, lights: 0, sensors: 0, zones: b?.zones.length ?? 0, structure: this.geometry?.walls.length ?? 0 };
```

In `renderPanel()`, add a row after the `zones` row of `rows`:

```ts
      { id: 'structure', label: 'מבנה', count: this.geometry ? `${this.geometry.walls.length} קירות · ${this.geometry.openings.length} פתחים` : 'לא שורטט מבנה' },
```

In `renderStage()`, add this attribute to `<sw-plan-canvas …>` right after `.imageUrl=${b.imageUrl}`:

```ts
        .geometry=${this.layers.has('structure') ? this.geometry : null}
```

- [ ] **Step 6: The historical map (`frontend/src/screens/investigate-history-map.ts`)**

Imports (below the existing ones):

```ts
import { geometryAt, geometryFor } from '../api/geometry';
import type { GeometryDoc } from '../map/geometry';
```

State, after `@state() private casePick: NewCaseItem | null = null;`:

```ts
  /** Plan Studio: the structure published at the instant (one plan version can have several structure publishes). */
  @state() private geometry: GeometryDoc | null = null;
  private geomSeq = 0;
```

Method, right before `ensureVersion()`:

```ts
  /** The structure follows the cursor like the anchors do; the timeline and the documents are cached, so moving is cheap. */
  private async updateGeometry() {
    const b = this.bundle;
    const seq = ++this.geomSeq;
    if (!b || b.source !== 'api' || !b.planVersionId) {
      this.geometry = null;
      return;
    }
    const t = this.instant.toISOString().replace(/\.\d{3}Z$/, 'Z');
    const g = b.history === 'exact' ? await geometryAt(b.planVersionId, t) : await geometryFor(b);
    if (seq === this.geomSeq) this.geometry = g;
  }
```

In `init()`, right after `this.bundle = await loadMap(this.floorId, false, this.instant.toISOString().replace(/\.\d{3}Z$/, 'Z'));` add:

```ts
      void this.updateGeometry();
```

In `ensureVersion()`, replace `if (inside) return;` with:

```ts
    if (inside) {
      void this.updateGeometry();
      return;
    }
```

and right after `this.bundle = nb;` add `void this.updateGeometry();`.

On the API canvas (the `<sw-plan-canvas alwaysLabel …>` that has `.markers=${this.apiMarkers}`), add `.geometry=${this.geometry}` after `.zones=${b.zones}`.

- [ ] **Step 7: The event page (`frontend/src/screens/investigate-event-detail.ts`)**

Imports (below the existing ones):

```ts
import { geometryFor } from '../api/geometry';
import type { GeometryDoc } from '../map/geometry';
```

State, after `@state() private casePick: NewCaseItem | null = null;`:

```ts
  @state() private geometry: GeometryDoc | null = null;
```

Replace the `loadMap` method with:

```ts
  private async loadMap(floorId: string) {
    try {
      this.bundle = await loadMap(floorId);
      this.geometry = await geometryFor(this.bundle);
    } catch {
      this.bundle = null;
      this.geometry = null;
    }
  }
```

On its canvas (`<sw-plan-canvas .planWidth=${this.bundle.width} …>`), add `.geometry=${this.geometry}` after `.zones=${this.bundle.zones}`.

The Lovelace card needs no change: its map view loads the same floor screen (`smplwise-card.js`: `/explore/floors/<floor>`).

- [ ] **Step 8: Type-check, build, run the live spec and the neighbours**

Before this task's edits, record a baseline once: `SW_LIVE=1 SW_CHROME=1 npx playwright test tests/evidence-history-map.spec.ts tests/evidence-plan-versions.spec.ts tests/evidence-zones.spec.ts --project=desktop --workers=1 --reporter=line > "$SP/baseline_t11.txt"` (device-dependent failures are BLOCKED, not regressions).

Run (in `frontend/`):
- `npx tsc --noEmit -p tsconfig.json` → exit 0
- `npm run build` → build succeeds
- restart the developer backend (see Global Constraints), then `SW_LIVE=1 SW_CHROME=1 npx playwright test tests/evidence-plan-studio.spec.ts --project=desktop --workers=1 --reporter=line` → `1 passed`
- the three neighbour specs again → the same results as the baseline.

- [ ] **Step 9: Demo fixture chain (the floor map's layer bar gained a button in demo mode)**

Run: `bash "$SP/fixture_chain.sh"` → `fixtures exit: 0` and `129 passed` in the output file it names; it restores `docs/evidence/T007` and restarts the backend itself.

- [ ] **Step 10: Commit**

```bash
git add frontend/src/map/sw-plan-canvas.ts frontend/src/styles/tokens.css frontend/src/components/sw-icon.ts frontend/src/screens/explore-floor-map.ts frontend/src/screens/investigate-history-map.ts frontend/src/screens/investigate-event-detail.ts frontend/tests/evidence-plan-studio.spec.ts
msg=$(mktemp) && cat > "$msg" <<'EOF'
feat(plan-studio): structure layer on the live map, the history map at t and the event page (T084)

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOF
test "$(bash /c/cloude/smplwisebms/secrets/scan_staged.sh)" = 0 && git commit -F "$msg"
```

---

### Task 12: Editor — draw walls, place doors, windows, passages and labels

**Files:**
- Modify: `smplwise_vms/backend/smplwise/routers/anchors.py` (bundle permission `structure` = map.edit)
- Modify: `smplwise_vms/backend/tests/test_plan_geometry_integration.py` (import line + one test)
- Modify: `frontend/src/api/types.ts`, `frontend/src/api/maps.ts` (`permissions.structure`)
- Modify: `frontend/src/map/geometry.ts` (append `pointOnWall`), `frontend/src/map/studio-ops.ts` (`addLabel`, `patchLabel`)
- Modify: `frontend/tests/unit-geometry.spec.ts` (imports + one test)
- Modify: `frontend/src/map/sw-plan-canvas.ts` (pick / drag affordances, hover events, the wall being drawn)
- Create: `frontend/src/screens/plan-studio-panel.ts`
- Modify: `frontend/src/screens/explore-plan-editor.ts`
- Modify: `frontend/tests/evidence-plan-studio.spec.ts` (second live test)

**Interfaces:**
- Consumes: `StudioController` (Task 10); `nearestWall`, `snapPoint`, `effectiveScale`, `lengthPx`, `GeometryDoc`, `Pt` (Task 9); `addWall`, `addOpening`, `patchWall`, `patchOpening`, `moveVertex`, `removeItem`, `kindDefaults`, `WallDefaults` (Task 9); `copyGeometryFrom`, `exportUrl` (Task 10); canvas `geometry`, `selectedGeomId`, `issueIds` (Task 11).
- Produces:
  - `GET /floors/{id}/map` → `permissions.structure` (map.edit on the floor); `MapBundle.permissions.structure: boolean`.
  - `geometry.ts`: `pointOnWall(wall, t, W, H) -> Pt`. `studio-ops.ts`: `addLabel(doc, p, text) -> {doc, id}`, `patchLabel(doc, id, patch)`.
  - `sw-plan-canvas`: properties `geomEditable: boolean`, `wallDraft: Pt[]`, `hoverPoint: Pt | null`; events `plan-hover {x, y, shift}` (only while `placing`, once per frame), `plan-click {x, y, shift}`, `geom-select {id, kind: 'wall'|'opening'|'label'}`, `geom-drag {kind: 'vertex'|'opening'|'label', id, index, x, y}`; DOM `[data-hit-wall]`, `[data-hit-opening]`, `[data-hit-label]`, `[data-wall-vertex]`, `[data-hover-point]`.
  - `plan-studio-panel.ts`: `StudioMode`, `GeomKind`, `GeomSel`, `STUDIO_MODES`, `StudioView`, `StudioActions`, `fmtMetres(m, estimated)`, `fmtScale(scale)`, `renderStudioPanel(view, actions)`, `studioPanelStyles`; DOM `[data-studio-panel][data-studio-save=<state>]`, `[data-studio-mode=<mode>]`, `[data-wall-thickness]`, `[data-wall-kind]`, `[data-studio-scale]`, `[data-studio-counts]`, `[data-selected-wall|opening|label=<id>]`, `[data-geom-delete]`, `[data-studio-issues]`, `[data-issue=<code>]`, `[data-copy-from=<version id>]`, `[data-export-svg|png|json]`.
  - Editor: rail tool `[data-tool="structure"]` (disabled without `permissions.structure`); `STUDIO_TOOLS`; methods `loadStudio(b, force)`, `edit(fn)`, `focusGeom(id)`, `copyStructure(versionId)`, `exportJson()`; getters `studioOn`, `studioPlacing`, `issueIds`.

- [ ] **Step 1: Failing backend test — the bundle says whether the structure can be edited**

In `smplwise_vms/backend/tests/test_plan_geometry_integration.py`, replace `from conftest import png_bytes, seed_tree` with `from conftest import as_user, bind, png_bytes, seed_tree`, and append:

```python
def test_the_bundle_says_whether_the_structure_can_be_edited(settings):
    app, c, ids, vid, _ = _setup(settings)
    assert c.get(f"/api/v1/floors/{ids['floor2']}/map").json()["permissions"]["structure"] is True
    bind(c, settings, "dana", "viewer", "floor", ids["floor2"])
    assert c.get(f"/api/v1/floors/{ids['floor2']}/map", headers=as_user("dana")).json()["permissions"]["structure"] is False
```

Run: `cd smplwise_vms/backend && MSYS_NO_PATHCONV=1 $PY -m pytest tests/test_plan_geometry_integration.py -p no:cacheprovider`
Expected: 1 FAIL (`KeyError: 'structure'`), 4 pass.

- [ ] **Step 2: Expose it**

In `routers/anchors.py` (`floor_map`'s return dict), replace

```python
        "permissions": {"edit": can_edit, "publish": can_publish, "import": authorize(conn, principal, "map.import", ("floor", floor_id)).allowed},
```

with

```python
        "permissions": {"edit": can_edit, "publish": can_publish, "import": authorize(conn, principal, "map.import", ("floor", floor_id)).allowed,
                        "structure": authorize(conn, principal, "map.edit", ("floor", floor_id)).allowed},
```

(`edit` is placement.edit - pins; the structure document needs map.edit, a different permission.)

In `frontend/src/api/types.ts` (`FloorMap`) and `frontend/src/api/maps.ts` (`MapBundle`), replace `permissions: { edit: boolean; publish: boolean; import: boolean };` with `permissions: { edit: boolean; publish: boolean; import: boolean; structure: boolean };`, and in `demoBundle` replace `permissions: { edit: true, publish: true, import: true },` with `permissions: { edit: true, publish: true, import: true, structure: false },` (demo data has no document to edit).

Run the backend file again → `5 passed`.

- [ ] **Step 3: Failing unit test — labels and positions along a wall**

In `frontend/tests/unit-geometry.spec.ts`, replace the two `../src/map/…` import lines with:

```ts
import { buildPrimitives, distanceM, effectiveScale, nearestWall, perimeterM, pointOnWall, polygonAreaM2, snapPoint, type GeometryDoc, type Primitive, type Pt } from '../src/map/geometry';
import { addLabel, addOpening, addWall, moveVertex, patchLabel, patchOpening, removeItem } from '../src/map/studio-ops';
```

and add inside the `test.describe` block, after the last test:

```ts
  test('labels, and the point at a position along a wall', () => {
    let doc = sample();
    const l = addLabel(doc, [0.5, 0.5], 'מחסן');
    doc = patchLabel(l.doc, l.id, { text: 'מחסן ראשי', position: [1.2, 0.4] });
    expect(doc.labels.find((x) => x.id === l.id)).toMatchObject({ text: 'מחסן ראשי', position: [1, 0.4], level_id: 'L0', size: 14 });
    const wb = doc.walls.find((w) => w.id === 'wb')!;
    const mid = pointOnWall(wb, 0.5, 1000, 800); // (100,400)-(600,400) px
    expect(mid[0]).toBeCloseTo(0.35, 9);
    expect(mid[1]).toBeCloseTo(0.5, 9);
    doc = removeItem(doc, l.id);
    expect(doc.labels.some((x) => x.id === l.id)).toBe(false);
  });
```

Run (in `frontend/`): `npx playwright test tests/unit-geometry.spec.ts --project=desktop --reporter=line`
Expected: FAIL — `pointOnWall` / `addLabel` are not exported.

- [ ] **Step 4: `pointOnWall`, `addLabel`, `patchLabel`**

Append to `frontend/src/map/geometry.ts`:

```ts
/** The point at relative position t (0..1 of the length) along a wall, in normalized plan space. */
export function pointOnWall(wall: GeomWall, t: number, W: number, H: number): Pt {
  const pts: Pt[] = wall.polyline.map((v) => [v[0] * W, v[1] * H]);
  const cum = cumulative(pts);
  const { p } = pointAt(pts, cum, Math.min(1, Math.max(0, t)) * cum[cum.length - 1]);
  return [p[0] / W, p[1] / H];
}
```

In `frontend/src/map/studio-ops.ts`, add `type GeomLabel` to the `./geometry` import list and append:

```ts
export function addLabel(doc: GeometryDoc, p: Pt, text: string): { doc: GeometryDoc; id: string } {
  const label: GeomLabel = { id: newId(), text, position: clampPt(p), level_id: defaultLevelId(doc), size: 14 };
  return { doc: { ...doc, labels: [...doc.labels, label] }, id: label.id };
}

export function patchLabel(doc: GeometryDoc, id: string, patch: Partial<GeomLabel>): GeometryDoc {
  return { ...doc, labels: doc.labels.map((l) => (l.id === id ? { ...l, ...patch, id: l.id, position: patch.position ? clampPt(patch.position) : l.position } : l)) };
}
```

Run the unit spec again → `6 passed`; `npx tsc --noEmit -p tsconfig.json` → exit 0.

- [ ] **Step 5: Failing live test — draw, place, select, delete, undo**

Append inside the `test.describe.serial` block of `frontend/tests/evidence-plan-studio.spec.ts`, after the first test:

```ts
  test('draw a wall, place a door, select, delete and undo in the editor; the draft autosaves and viewers keep the published one', async ({ page }) => {
    const ed = 'explore-plan-editor';
    await page.goto(`/?design=a#/explore/floors/${ids.floor}/edit`);
    await expect(page.locator(`${ed} sw-plan-canvas [data-wall]`)).toHaveCount(3, { timeout: 20000 });
    await page.locator(`${ed} [data-tool="structure"]`).click();
    await expect(page.locator(`${ed} [data-studio-panel]`)).toBeVisible();
    await page.locator(`${ed} [data-studio-mode="wall"]`).click();
    await clickPlan(page, ed, 0.3, 0.6);
    await clickPlan(page, ed, 0.7, 0.6);
    await page.keyboard.press('Enter');
    await expect(page.locator(`${ed} sw-plan-canvas [data-wall]`)).toHaveCount(4);
    await page.locator(`${ed} [data-studio-mode="door"]`).click();
    await clickPlan(page, ed, 0.5, 0.6);
    await expect(page.locator(`${ed} sw-plan-canvas [data-opening][data-kind="door"]`)).toHaveCount(2);
    await expect(page.locator(`${ed} sw-plan-canvas [data-wall]`)).toHaveCount(5); // the door cuts the new wall
    await expect(page.locator(`${ed} [data-selected-opening]`)).toBeVisible();
    await expect(page.locator(`${ed} [data-studio-panel][data-studio-save="saved"]`)).toHaveCount(1, { timeout: 10000 });
    const draft = await (await api.get(`api/v1/plan-versions/${ids.version}/geometry?draft=true`)).json();
    expect(draft.geometry.status).toBe('draft');
    expect(draft.doc.walls).toHaveLength(3);
    expect(draft.doc.openings).toHaveLength(2);
    const published = await (await api.get(`api/v1/plan-versions/${ids.version}/geometry`)).json();
    expect(published.doc.walls).toHaveLength(2); // viewers see nothing until it is published
    await page.locator(`${ed} [data-studio-mode="select"]`).click();
    await clickPlan(page, ed, 0.35, 0.6);
    await expect(page.locator(`${ed} [data-selected-wall]`)).toBeVisible();
    await page.keyboard.press('Delete');
    await expect(page.locator(`${ed} sw-plan-canvas [data-wall]`)).toHaveCount(3);
    await expect(page.locator(`${ed} sw-plan-canvas [data-opening]`)).toHaveCount(1); // its door went with it
    await page.keyboard.press('Control+z');
    await expect(page.locator(`${ed} sw-plan-canvas [data-wall]`)).toHaveCount(5);
    await expect(page.locator(`${ed} [data-studio-panel][data-studio-save="saved"]`)).toHaveCount(1, { timeout: 10000 });
  });
```

Run: `npm run build && SW_LIVE=1 SW_CHROME=1 npx playwright test tests/evidence-plan-studio.spec.ts --project=desktop --workers=1 --reporter=line`
Expected: test 1 passes, test 2 FAILS (`[data-tool="structure"]` not found).

- [ ] **Step 6: Canvas — pick, drag, hover, the wall being drawn (`frontend/src/map/sw-plan-canvas.ts`)**

Add after the `private primCache …` line from Task 11:

```ts
  /** Plan Studio editor: walls, openings and labels can be picked and dragged (the structure tool's select mode). */
  @property({ type: Boolean }) geomEditable = false;
  /** The wall being drawn (normalized points) and the snapped cursor the editor computed (rubber band, snap dot). */
  @property({ attribute: false }) wallDraft: Pt[] = [];
  @property({ attribute: false }) hoverPoint: Pt | null = null;
  @state() private geomDrag: { x: number; y: number } | null = null;
  private hoverFrame = 0;
  private hoverEvent: { x: number; y: number; shift: boolean } | null = null;
```

Replace `disconnectedCallback` with:

```ts
  disconnectedCallback() {
    super.disconnectedCallback();
    this.resizeObserver?.disconnect();
    cancelAnimationFrame(this.hoverFrame);
  }
```

Replace the first two lines of `onPointerMove`

```ts
  private onPointerMove = (e: PointerEvent) => {
    if (!this.pointers.has(e.pointerId)) return;
```

with

```ts
  private onPointerMove = (e: PointerEvent) => {
    if (this.placing && e.pointerType !== 'touch') this.queueHover(e);
    if (!this.pointers.has(e.pointerId)) return;
```

In `onBackgroundClick`, replace `detail: { x: +p.x.toFixed(4), y: +p.y.toFixed(4) }` with `detail: { x: +p.x.toFixed(4), y: +p.y.toFixed(4), shift: e.shiftKey }`.

Add these methods before `render()`:

```ts
  /** Placing tools get the cursor position once per frame; the editor snaps it and hands it back as hoverPoint. */
  private queueHover(e: PointerEvent) {
    const rect = this.getBoundingClientRect();
    const p = this.toPlan(e.clientX - rect.left, e.clientY - rect.top);
    this.hoverEvent = { x: p.x, y: p.y, shift: e.shiftKey };
    if (this.hoverFrame) return;
    this.hoverFrame = requestAnimationFrame(() => {
      this.hoverFrame = 0;
      const h = this.hoverEvent;
      if (h) this.dispatchEvent(new CustomEvent('plan-hover', { detail: h, bubbles: true, composed: true }));
    });
  }

  private pickGeom(id: string, e: Event) {
    e.stopPropagation();
    if (this.dragMoved) return;
    this.dispatchEvent(new CustomEvent('geom-select', { detail: { id, kind: 'wall' }, bubbles: true, composed: true }));
  }

  /** Drag a corner of the selected wall, an opening along its wall, or a label; a press without movement selects. */
  private onGeomDragStart(kind: 'vertex' | 'opening' | 'label', id: string, index: number, e: PointerEvent) {
    if (!this.geomEditable || e.button !== 0) return;
    e.stopPropagation();
    e.preventDefault();
    const rect0 = this.getBoundingClientRect();
    const start = this.toPlan(e.clientX - rect0.left, e.clientY - rect0.top);
    let moved = false;
    let last = start;
    this.viewport.setPointerCapture(e.pointerId);
    const move = (ev: PointerEvent) => {
      const p = this.toPlan(ev.clientX - rect0.left, ev.clientY - rect0.top);
      if (!moved && Math.hypot((p.x - start.x) * this.planWidth, (p.y - start.y) * this.planHeight) * this.scale < 3) return;
      moved = true;
      last = p;
      this.geomDrag = { x: p.x, y: p.y };
    };
    const up = () => {
      this.viewport.removeEventListener('pointermove', move);
      this.viewport.removeEventListener('pointerup', up);
      this.viewport.removeEventListener('pointercancel', up);
      this.geomDrag = null;
      this.dragMoved = true; // pointer capture sends the trailing click to the viewport: swallow it
      setTimeout(() => (this.dragMoved = false), 0);
      if (moved) this.dispatchEvent(new CustomEvent('geom-drag', { detail: { kind, id, index, x: +last.x.toFixed(5), y: +last.y.toFixed(5) }, bubbles: true, composed: true }));
      else if (kind !== 'vertex') this.dispatchEvent(new CustomEvent('geom-select', { detail: { id, kind }, bubbles: true, composed: true }));
    };
    this.viewport.addEventListener('pointermove', move);
    this.viewport.addEventListener('pointerup', up);
    this.viewport.addEventListener('pointercancel', up);
  }

  /** Invisible wide strokes to pick a wall part, an opening or a label, and the selected wall's corner handles.
   * Hidden while a placing tool is active, so clicks reach the plan. Markers stay above them. */
  private renderGeomHits() {
    const doc = this.geometry;
    if (!doc || !this.geomEditable || this.placing) return nothing;
    const inv = 1 / this.scale;
    const W = this.planWidth;
    const H = this.planHeight;
    const selWall = doc.walls.find((w) => w.id === this.selectedGeomId);
    const drag = this.geomDrag;
    return svg`<g class="geom-hits">
      ${this.primitives(doc).map((p) => {
        if (p.kind === 'wall') return svg`<polyline class="hit" data-hit-wall=${p.id} points=${ptsAttr(p.points)} stroke-width=${Math.max(p.width, 12 * inv)} @click=${(e: Event) => this.pickGeom(p.id, e)} />`;
        if (p.kind === 'label') return svg`<circle class="hit" data-hit-label=${p.id} cx=${p.x} cy=${p.y} r=${Math.max(p.size, 10 * inv)} @pointerdown=${(e: PointerEvent) => this.onGeomDragStart('label', p.id, 0, e)} @click=${(e: Event) => e.stopPropagation()} />`;
        return svg`<line class="hit" data-hit-opening=${p.id} x1=${p.gap[0][0]} y1=${p.gap[0][1]} x2=${p.gap[1][0]} y2=${p.gap[1][1]} stroke-width=${14 * inv} @pointerdown=${(e: PointerEvent) => this.onGeomDragStart('opening', p.id, 0, e)} @click=${(e: Event) => e.stopPropagation()} />`;
      })}
      ${selWall ? selWall.polyline.map((v, i) => svg`<circle class="gvtx" data-wall-vertex=${i} cx=${v[0] * W} cy=${v[1] * H} r=${6 * inv} stroke-width=${1.6 * inv} role="slider" aria-label=${`פינת קיר ${i + 1}`}
          @pointerdown=${(e: PointerEvent) => this.onGeomDragStart('vertex', selWall.id, i, e)} @click=${(e: Event) => e.stopPropagation()} />`) : nothing}
      ${drag ? svg`<circle class="gdrag" cx=${drag.x * W} cy=${drag.y * H} r=${5 * inv} stroke-width=${1.5 * inv} />` : nothing}
    </g>`;
  }

  /** The wall being drawn, the rubber band to the snapped cursor, and the snap dot. */
  private renderWallDraft() {
    const pts = this.wallDraft;
    const h = this.hoverPoint;
    if (!pts.length && !h) return nothing;
    const inv = 1 / this.scale;
    const W = this.planWidth;
    const H = this.planHeight;
    const line = [...pts, ...(h && pts.length ? [h] : [])].map((p) => `${p[0] * W},${p[1] * H}`).join(' ');
    return svg`<g class="wdraft" pointer-events="none">
      ${pts.length ? svg`<polyline points=${line} stroke-width=${2 * inv} stroke-dasharray=${`${6 * inv} ${4 * inv}`} />` : nothing}
      ${pts.map((p) => svg`<circle cx=${p[0] * W} cy=${p[1] * H} r=${3.5 * inv} stroke-width=${1.5 * inv} />`)}
      ${h ? svg`<circle class="snap" data-hover-point cx=${h[0] * W} cy=${h[1] * H} r=${4.5 * inv} stroke-width=${1.5 * inv} />` : nothing}
    </g>`;
  }
```

In `render()`, replace (the Task 11 order)

```ts
            ${this.renderStructure()}
            ${this.markers.map((m) => this.renderMarker(m))}
            ${this.renderDraft()}
```

with

```ts
            ${this.renderStructure()}
            ${this.renderGeomHits()}
            ${this.markers.map((m) => this.renderMarker(m))}
            ${this.renderDraft()}
            ${this.renderWallDraft()}
```

In `static styles`, after the `.structure .glabel { … }` rule from Task 11, add:

```css
    .geom-hits .hit {
      fill: transparent;
      stroke: transparent;
      pointer-events: stroke;
      cursor: pointer;
    }
    .geom-hits circle.hit {
      pointer-events: all;
      cursor: grab;
    }
    .geom-hits line.hit {
      cursor: ew-resize;
    }
    .gvtx {
      fill: var(--sw-surface);
      stroke: var(--sw-accent);
      cursor: grab;
    }
    .gdrag {
      fill: var(--sw-accent);
      fill-opacity: 0.35;
      stroke: var(--sw-accent);
      pointer-events: none;
    }
    .wdraft polyline {
      fill: none;
      stroke: var(--sw-accent);
    }
    .wdraft circle {
      fill: var(--sw-surface);
      stroke: var(--sw-accent);
    }
    .wdraft circle.snap {
      fill: var(--sw-accent);
    }
```

Run: `npx tsc --noEmit -p tsconfig.json` → exit 0.

- [ ] **Step 7: The studio panel (`frontend/src/screens/plan-studio-panel.ts`)**

```ts
/**
 * Plan Studio side panel of the plan editor (T084): the structure tool - draw mode, wall defaults, the selected wall /
 * opening / label, validation issues, copy from another version, exports. Pure render functions: the editor owns the
 * state and passes callbacks; its shadow root provides the shared classes (.row, .two, .note, .btns, .err).
 */
import { css, html, nothing, type TemplateResult } from 'lit';
import type { CopyCandidate, GeometryIssue } from '../api/geometry';
import { effectiveScale, lengthPx, type GeometryDoc, type GeomLabel, type GeomOpening, type GeomWall, type Hinge, type OpeningKind, type Swing, type WallKind } from '../map/geometry';
import type { SaveState } from '../map/studio-controller';
import { kindDefaults, type WallDefaults } from '../map/studio-ops';

export type StudioMode = 'select' | 'wall' | 'door' | 'window' | 'passage' | 'label';
export type GeomKind = 'wall' | 'opening' | 'label';
export interface GeomSel {
  id: string;
  kind: GeomKind;
}

export const STUDIO_MODES: { id: StudioMode; label: string; hint: string }[] = [
  { id: 'select', label: 'בחירה', hint: 'לחץ על קיר, פתח או תווית כדי לערוך. גרור פתח לאורך הקיר, תווית למקומה ופינה של קיר נבחר.' },
  { id: 'wall', label: 'קיר', hint: 'לחץ נקודה אחר נקודה. Enter או לחיצה חוזרת על הנקודה האחרונה מסיימים, Shift מבטל הצמדה לזוויות, Backspace מוחק נקודה.' },
  { id: 'door', label: 'דלת', hint: 'לחץ על קיר כדי להציב דלת. כיוון הפתיחה והציר נקבעים כאן בפאנל.' },
  { id: 'window', label: 'חלון', hint: 'לחץ על קיר כדי להציב חלון.' },
  { id: 'passage', label: 'מעבר', hint: 'פתח בלי דלת בקיר.' },
  { id: 'label', label: 'תווית', hint: 'לחץ במקום התווית ואז הקלד את הטקסט כאן בפאנל.' },
];

const WALL_KIND_LABEL: Record<WallKind, string> = { exterior: 'חיצוני', interior: 'פנימי', partition: 'מחיצה', railing: 'מעקה', low: 'קיר נמוך' };
const OPENING_KIND_LABEL: Record<OpeningKind, string> = { door: 'דלת', window: 'חלון', passage: 'מעבר' };
const SWING_LABEL: Record<Swing, string> = { right: 'לצד ימין של הקיר', left: 'לצד שמאל של הקיר', double: 'כנף כפולה', sliding: 'הזזה', none: 'ללא כנף' };
const HINGE_LABEL: Record<Hinge, string> = { start: 'בצד תחילת הקיר', end: 'בצד סוף הקיר' };
const SAVE_LABEL: Record<SaveState, string> = {
  idle: 'טיוטת המבנה',
  pending: 'שינויים ממתינים לשמירה…',
  saving: 'שומר…',
  saved: 'הטיוטה נשמרה · הצופים יראו אותה אחרי פרסום',
  error: 'השמירה נכשלה',
};

/** Metres for display: "≈" when the plan is not calibrated (design section 6). Owner decision 2026-09-23: the setting
 * `plan.estimates` = false hides metres until the plan is calibrated (`show` = false). */
export function fmtMetres(m: number, estimated: boolean, show = true): string {
  if (estimated && !show) return 'לא מכויל';
  return `${estimated ? '≈' : ''}${m < 10 ? m.toFixed(2) : m.toFixed(1)} מ׳`;
}

export function fmtScale(scaleMPerPx: number): string {
  return `1 מ׳ = ${(1 / scaleMPerPx).toFixed(1)} פיקסלים בתוכנית`;
}

export interface StudioView {
  doc: GeometryDoc;
  W: number;
  H: number;
  mode: StudioMode;
  wallDefaults: WallDefaults;
  sel: GeomSel | null;
  saveState: SaveState;
  saveError: string;
  issues: GeometryIssue[];
  copyCandidates: CopyCandidate[];
  exportSvg: string;
  exportPng: string;
  busy: boolean;
  /** Setting `plan.estimates`: show estimated metres ("≈") before calibration, or hide them. */
  showEstimates: boolean;
}

export interface StudioActions {
  setMode(mode: StudioMode): void;
  setWallDefaults(d: WallDefaults): void;
  patchWall(id: string, patch: Partial<GeomWall>): void;
  patchOpening(id: string, patch: Partial<GeomOpening>): void;
  patchLabel(id: string, patch: Partial<GeomLabel>): void;
  remove(id: string): void;
  focus(id: string): void;
  copyFrom(versionId: string): void;
  exportJson(): void;
  reload(): void;
}

const numberOf = (e: Event): number => parseFloat((e.target as HTMLInputElement).value);

export function renderStudioPanel(v: StudioView, a: StudioActions): TemplateResult {
  const { scale, estimated } = effectiveScale(v.doc);
  const errors = v.issues.filter((i) => i.severity === 'error');
  const warnings = v.issues.filter((i) => i.severity === 'warning');
  const mode = STUDIO_MODES.find((m) => m.id === v.mode) ?? STUDIO_MODES[0];
  const empty = !v.doc.walls.length && !v.doc.openings.length && !v.doc.labels.length;
  return html`<sw-card heading="מבנה" subheading=${SAVE_LABEL[v.saveState]} data-studio-panel data-studio-save=${v.saveState}>
    <div class="modes" role="group" aria-label="כלי ציור">
      ${STUDIO_MODES.map((m) => html`<button class=${m.id === v.mode ? 'on' : ''} data-studio-mode=${m.id} aria-pressed=${m.id === v.mode} @click=${() => a.setMode(m.id)}>${m.label}</button>`)}
    </div>
    <div class="note">${mode.hint}</div>
    ${v.mode === 'wall' ? renderWallDefaults(v.wallDefaults, a) : nothing}
    <div class="row"><span class="lbl">קנה מידה<span class="muted" data-studio-scale>${estimated ? 'לא מכויל: מידות משוערות (≈)' : fmtScale(scale)}</span></span></div>
    <div class="note" data-studio-counts>${v.doc.walls.length} קירות · ${v.doc.openings.length} פתחים · ${v.doc.labels.length} תוויות</div>
    ${v.sel ? renderSelection(v, v.sel, a, scale, estimated) : nothing}
    ${errors.length || warnings.length ? renderIssues(errors, warnings, a) : nothing}
    ${empty && v.copyCandidates.length ? renderCopy(v.copyCandidates, a, v.busy) : nothing}
    <div class="exports" role="group" aria-label="ייצוא המבנה">
      <a class="btnlink" data-export-svg href=${v.exportSvg} download>SVG</a>
      <a class="btnlink" data-export-png href=${v.exportPng} download>PNG</a>
      <button class="btnlink" data-export-json @click=${() => a.exportJson()}>JSON</button>
      <span class="note">ייצוא הטיוטה כפי שהיא</span>
    </div>
    ${v.saveState === 'error' ? html`<div class="err">${v.saveError} <button class="linkbtn" data-studio-reload @click=${() => a.reload()}>טען מחדש</button></div>` : nothing}
  </sw-card>`;
}

function renderWallDefaults(d: WallDefaults, a: StudioActions) {
  return html`<div class="two">
    <sw-field label="עובי קיר (מ׳)"><input type="number" min="0.01" max="3" step="0.01" data-ltr data-wall-thickness .value=${String(d.thickness_m)}
      @change=${(e: Event) => { const x = numberOf(e); if (x > 0 && x <= 3) a.setWallDefaults({ ...d, thickness_m: x }); }} /></sw-field>
    <sw-field label="סוג קיר"><select aria-label="סוג קיר" data-wall-kind @change=${(e: Event) => a.setWallDefaults({ ...d, kind: (e.target as HTMLSelectElement).value as WallKind })}>
      ${(Object.keys(WALL_KIND_LABEL) as WallKind[]).map((k) => html`<option value=${k} ?selected=${d.kind === k}>${WALL_KIND_LABEL[k]}</option>`)}
    </select></sw-field>
  </div>`;
}

function renderSelection(v: StudioView, sel: GeomSel, a: StudioActions, scale: number, estimated: boolean) {
  if (sel.kind === 'wall') {
    const w = v.doc.walls.find((x) => x.id === sel.id);
    return w ? renderWall(w, v, a, scale, estimated) : nothing;
  }
  if (sel.kind === 'opening') {
    const o = v.doc.openings.find((x) => x.id === sel.id);
    return o ? renderOpening(o, a) : nothing;
  }
  const l = v.doc.labels.find((x) => x.id === sel.id);
  return l ? renderLabel(l, a) : nothing;
}

function renderWall(w: GeomWall, v: StudioView, a: StudioActions, scale: number, estimated: boolean) {
  const len = lengthPx(w.polyline, v.W, v.H) * scale;
  const openings = v.doc.openings.filter((o) => o.wall_id === w.id).length;
  return html`<div class="sel" data-selected-wall=${w.id}>
    <div class="selhead"><strong>קיר ${WALL_KIND_LABEL[w.kind]}</strong><span class="muted">${fmtMetres(len, estimated, v.showEstimates)} · ${openings} פתחים</span></div>
    <div class="two">
      <sw-field label="עובי (מ׳)"><input type="number" min="0.01" max="3" step="0.01" data-ltr .value=${String(w.thickness_m)}
        @change=${(e: Event) => { const x = numberOf(e); if (x > 0 && x <= 3) a.patchWall(w.id, { thickness_m: x }); }} /></sw-field>
      <sw-field label="סוג"><select aria-label="סוג קיר" @change=${(e: Event) => a.patchWall(w.id, { kind: (e.target as HTMLSelectElement).value as WallKind })}>
        ${(Object.keys(WALL_KIND_LABEL) as WallKind[]).map((k) => html`<option value=${k} ?selected=${w.kind === k}>${WALL_KIND_LABEL[k]}</option>`)}
      </select></sw-field>
    </div>
    <sw-field label="גובה (מ׳, ריק = עד התקרה)"><input type="number" min="0.1" max="50" step="0.1" data-ltr .value=${w.height_m === null ? '' : String(w.height_m)}
      @change=${(e: Event) => { const raw = (e.target as HTMLInputElement).value.trim(); const x = parseFloat(raw); if (!raw) a.patchWall(w.id, { height_m: null }); else if (x > 0 && x <= 50) a.patchWall(w.id, { height_m: x }); }} /></sw-field>
    <div class="btns"><sw-button size="sm" variant="ghost" icon="trash" data-geom-delete @click=${() => a.remove(w.id)}>מחק קיר</sw-button><span class="note">הפתחים שבקיר נמחקים איתו</span></div>
  </div>`;
}

function renderOpening(o: GeomOpening, a: StudioActions) {
  return html`<div class="sel" data-selected-opening=${o.id}>
    <div class="selhead"><strong>${OPENING_KIND_LABEL[o.kind]}</strong><span class="muted">${o.width_m.toFixed(2)} מ׳ רוחב${o.anchor_ref ? ' · מקושר לישות' : ''}</span></div>
    <div class="two">
      <sw-field label="סוג"><select aria-label="סוג פתח" @change=${(e: Event) => a.patchOpening(o.id, kindDefaults((e.target as HTMLSelectElement).value as OpeningKind))}>
        ${(Object.keys(OPENING_KIND_LABEL) as OpeningKind[]).map((k) => html`<option value=${k} ?selected=${o.kind === k}>${OPENING_KIND_LABEL[k]}</option>`)}
      </select></sw-field>
      <sw-field label="רוחב (מ׳)"><input type="number" min="0.1" max="10" step="0.05" data-ltr .value=${String(o.width_m)}
        @change=${(e: Event) => { const x = numberOf(e); if (x > 0 && x <= 10) a.patchOpening(o.id, { width_m: x }); }} /></sw-field>
    </div>
    <div class="two">
      <sw-field label="גובה (מ׳)"><input type="number" min="0.1" max="10" step="0.05" data-ltr .value=${String(o.height_m)}
        @change=${(e: Event) => { const x = numberOf(e); if (x > 0 && x <= 10) a.patchOpening(o.id, { height_m: x }); }} /></sw-field>
      ${o.kind === 'window'
        ? html`<sw-field label="גובה אדן (מ׳)"><input type="number" min="0" max="10" step="0.05" data-ltr .value=${String(o.sill_m)}
            @change=${(e: Event) => { const x = numberOf(e); if (x >= 0 && x <= 10) a.patchOpening(o.id, { sill_m: x }); }} /></sw-field>`
        : nothing}
    </div>
    ${o.kind === 'door'
      ? html`<div class="two">
          <sw-field label="כיוון פתיחה"><select aria-label="כיוון פתיחה" @change=${(e: Event) => a.patchOpening(o.id, { swing: (e.target as HTMLSelectElement).value as Swing })}>
            ${(Object.keys(SWING_LABEL) as Swing[]).map((k) => html`<option value=${k} ?selected=${o.swing === k}>${SWING_LABEL[k]}</option>`)}
          </select></sw-field>
          <sw-field label="ציר"><select aria-label="ציר" @change=${(e: Event) => a.patchOpening(o.id, { hinge: (e.target as HTMLSelectElement).value as Hinge })}>
            ${(Object.keys(HINGE_LABEL) as Hinge[]).map((k) => html`<option value=${k} ?selected=${o.hinge === k}>${HINGE_LABEL[k]}</option>`)}
          </select></sw-field>
        </div>`
      : nothing}
    <div class="btns"><sw-button size="sm" variant="ghost" icon="trash" data-geom-delete @click=${() => a.remove(o.id)}>מחק ${OPENING_KIND_LABEL[o.kind]}</sw-button></div>
  </div>`;
}

function renderLabel(l: GeomLabel, a: StudioActions) {
  return html`<div class="sel" data-selected-label=${l.id}>
    <sw-field label="טקסט"><input type="text" maxlength="80" data-label-text .value=${l.text}
      @change=${(e: Event) => { const x = (e.target as HTMLInputElement).value.trim(); if (x) a.patchLabel(l.id, { text: x }); }} /></sw-field>
    <sw-field label="גודל"><input type="number" min="6" max="200" step="1" data-ltr .value=${String(l.size)}
      @change=${(e: Event) => { const x = numberOf(e); if (x >= 6 && x <= 200) a.patchLabel(l.id, { size: x }); }} /></sw-field>
    <div class="btns"><sw-button size="sm" variant="ghost" icon="trash" data-geom-delete @click=${() => a.remove(l.id)}>מחק תווית</sw-button></div>
  </div>`;
}

function renderIssues(errors: GeometryIssue[], warnings: GeometryIssue[], a: StudioActions) {
  return html`<div class="issues" data-studio-issues>
    <div class="ilbl">${errors.length ? `${errors.length} שגיאות חוסמות פרסום` : 'אין שגיאות חוסמות'}${warnings.length ? ` · ${warnings.length} אזהרות` : ''}</div>
    ${[...errors, ...warnings].slice(0, 20).map((i) => html`<button class="issue ${i.severity}" data-issue=${i.code} data-issue-id=${i.id ?? ''} ?disabled=${!i.id} @click=${() => { if (i.id) a.focus(i.id); }}>${i.message}</button>`)}
  </div>`;
}

function renderCopy(cands: CopyCandidate[], a: StudioActions, busy: boolean) {
  return html`<div class="copy" data-copy-candidates>
    <div class="ilbl">להתחיל ממבנה קיים?</div>
    ${cands.map((c) => html`<button class="issue" data-copy-from=${c.version_id} ?disabled=${busy} @click=${() => a.copyFrom(c.version_id)}>
      <span>העתק ${c.walls} קירות ו־${c.openings} פתחים מגרסה ${c.status === 'published' ? 'מפורסמת' : c.status === 'draft' ? 'בטיוטה' : 'מהארכיון'}</span>
      <span class="muted">${c.same_drawing ? 'אותו שרטוט' : 'שרטוט אחר: המיקומים לא מיושרים, בדוק אותם'}</span>
    </button>`)}
  </div>`;
}

export const studioPanelStyles = css`
  .modes {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    margin-block-end: 8px;
  }
  .modes button,
  .btnlink {
    border: 1px solid var(--sw-border);
    background: var(--sw-surface);
    color: var(--sw-text);
    border-radius: var(--sw-r-pill);
    padding: 4px 10px;
    font: inherit;
    font-size: var(--sw-fs-sm);
    cursor: pointer;
    text-decoration: none;
  }
  .modes button.on {
    background: var(--sw-accent);
    border-color: var(--sw-accent);
    color: #fff;
  }
  .modes button:focus-visible,
  .btnlink:focus-visible,
  .issue:focus-visible {
    outline: 2px solid var(--sw-accent);
    outline-offset: 1px;
  }
  .sel {
    border-block-start: 1px solid var(--sw-border);
    margin-block-start: 10px;
    padding-block-start: 10px;
    display: grid;
    gap: 8px;
  }
  .selhead {
    display: flex;
    justify-content: space-between;
    gap: 8px;
    flex-wrap: wrap;
  }
  .selhead .muted,
  .issue .muted {
    color: var(--sw-text-2);
    font-size: var(--sw-fs-sm);
  }
  .issues,
  .copy {
    display: grid;
    gap: 4px;
    margin-block-start: 10px;
  }
  .ilbl {
    font-weight: 600;
    font-size: var(--sw-fs-sm);
  }
  .issue {
    text-align: start;
    border: 1px solid var(--sw-border);
    background: var(--sw-surface);
    color: var(--sw-text);
    border-radius: 8px;
    padding: 6px 8px;
    font: inherit;
    font-size: var(--sw-fs-sm);
    cursor: pointer;
    display: grid;
    gap: 2px;
  }
  .issue.error {
    border-color: var(--sw-danger);
  }
  .issue.warning {
    border-color: var(--sw-warning);
  }
  .issue:disabled {
    cursor: default;
    opacity: 0.7;
  }
  .exports {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    align-items: center;
    margin-block-start: 10px;
  }
  .linkbtn {
    border: 0;
    background: none;
    color: var(--sw-accent);
    font: inherit;
    cursor: pointer;
    padding: 0;
  }
`;
```

- [ ] **Step 8: The editor (`frontend/src/screens/explore-plan-editor.ts`)**

Imports, after the `../api/zones` import line:

```ts
import { copyGeometryFrom, exportUrl } from '../api/geometry';
import { productSettings } from '../api/prefs';
import { nearestWall, pointOnWall, snapPoint, type GeometryDoc, type Pt } from '../map/geometry';
import { StudioController } from '../map/studio-controller';
import { addLabel, addOpening, addWall, moveVertex, patchLabel, patchOpening, patchWall, removeItem, type WallDefaults } from '../map/studio-ops';
import { renderStudioPanel, studioPanelStyles, type GeomKind, type GeomSel, type StudioMode } from './plan-studio-panel';
```

Tools: replace `type Tool = 'select' | 'camera' | 'lights' | 'entity' | 'zones' | 'layers';` with

```ts
type Tool = 'select' | 'camera' | 'lights' | 'entity' | 'zones' | 'structure' | 'layers';
```

add to `TOOLS`, after the `zones` entry:

```ts
  { id: 'structure', icon: 'wall', label: 'מבנה: קירות, דלתות וחלונות', ready: true },
```

and right after the `TOOLS` array:

```ts
/** Tools that work on the Plan Studio structure document (they need map.edit on the floor). */
const STUDIO_TOOLS: Tool[] = ['structure'];
```

Styles: replace `  static styles = css\`` with `  static styles = [css\``, and the closing `` `; `` of that block (the one right before `connectedCallback() {`) with `` `, studioPanelStyles]; ``.

State, after `@query('sw-plan-canvas') private canvas?: SwPlanCanvas;`:

```ts
  /** Plan Studio (T084): the structure draft of the shown plan version, autosaved two seconds after the last edit. */
  private studio = new StudioController(this);
  private studioVersion: string | null = null;
  @state() private studioMode: StudioMode = 'wall';
  @state() private wallDefaults: WallDefaults = { thickness_m: 0.2, kind: 'interior' };
  @state() private geomSel: GeomSel | null = null;
  @state() private wallDraft: Pt[] | null = null;
  @state() private hover: Pt | null = null;
  /** Setting `plan.estimates` (default true): estimated metres carry "≈" before calibration; false hides them. */
  @state() private showEstimates = true;
```

Replace `disconnectedCallback` with:

```ts
  disconnectedCallback() {
    super.disconnectedCallback();
    window.removeEventListener('keydown', this.onKey);
    void this.studio.flush(); // an edit younger than the autosave delay is still saved when the editor closes
  }
```

In `load()`, right after `this.bundle = b;` add:

```ts
      void this.loadStudio(b);
      void productSettings().then((s) => {
        this.showEstimates = s['plan.estimates'] !== 'false'; // the key exists on ProductSettings from Task 13; until then it is simply undefined
      });
```

(`'plan.estimates'` is added to the `ProductSettings` interface in Task 13; add it now as `'plan.estimates'?: 'true' | 'false';` in `frontend/src/api/media.ts`, after `'snapshots.max_age_s': number;`, so this compiles.)

In `handleKey`, replace the Escape block and the `typing` guard

```ts
    if (e.key === 'Escape') {
      if (this.drawing) this.drawing = null;
      else if (this.placing) this.placing = null;
      else if (this.candidates) this.candidates = null;
      else {
        this.selectedId = null;
        this.selectedZoneId = null;
      }
      return;
    }
    if (typing) return;
```

with

```ts
    if (e.key === 'Escape') {
      if (this.wallDraft) {
        this.wallDraft = null;
        this.hover = null;
      } else if (this.drawing) this.drawing = null;
      else if (this.placing) this.placing = null;
      else if (this.candidates) this.candidates = null;
      else {
        this.selectedId = null;
        this.selectedZoneId = null;
        this.geomSel = null;
      }
      return;
    }
    if (typing) return;
    if (this.studioOn && this.handleStudioKey(e)) return;
```

Replace `pickTool` with:

```ts
  private pickTool(tool: Tool) {
    this.tool = tool;
    this.placing = null;
    this.wallDraft = null;
    this.hover = null;
    if (tool !== 'structure') this.geomSel = null;
    if (tool === 'entity' || tool === 'lights') {
      this.entResults = null; // the two tools list different sets
      void this.searchEntities();
    }
  }
```

Add this block right after `pickTool`:

```ts
  // ---- Plan Studio: structure (T084) ----

  /** The structure draft follows the plan version the editor shows (a new draft or a restore changes it). */
  private async loadStudio(b: MapBundle, force = false) {
    if (b.source !== 'api' || !b.planVersionId || !b.permissions.structure) return;
    if (!force && this.studioVersion === b.planVersionId) return;
    this.studioVersion = b.planVersionId;
    try {
      await this.studio.flush();
      await this.studio.load(b.planVersionId);
      this.geomSel = null;
      this.wallDraft = null;
    } catch (err) {
      this.error = describeError(err);
    }
  }

  private get studioOn(): boolean {
    return STUDIO_TOOLS.includes(this.tool) && !!this.studio.doc;
  }

  /** Clicks on the plan go to the studio tool instead of selecting pins. */
  private get studioPlacing(): boolean {
    return this.studioOn && (this.tool !== 'structure' || this.studioMode !== 'select');
  }

  private get issueIds(): string[] {
    return this.studio.issues.filter((i) => i.severity === 'error' && i.id).map((i) => i.id as string);
  }

  /** One undoable edit of the structure draft. */
  private edit(fn: (doc: GeometryDoc) => GeometryDoc) {
    const doc = this.studio.doc;
    if (doc) this.studio.commit(fn(doc));
  }

  private snap(p: Pt, prev: Pt | null, free: boolean): Pt {
    const b = this.bundle;
    const doc = this.studio.doc;
    if (!b || !doc) return p;
    return snapPoint(p, prev, doc.walls, b.width, b.height, { tolPx: 10 / (this.canvas?.zoom ?? 1), free });
  }

  private onPlanHover(x: number, y: number, shift: boolean) {
    const b = this.bundle;
    const doc = this.studio.doc;
    if (!b || !doc || !this.studioPlacing) {
      this.hover = null;
      return;
    }
    const p: Pt = [x, y];
    if (this.studioMode === 'wall') this.hover = this.snap(p, this.wallDraft?.at(-1) ?? null, shift);
    else if (this.studioMode === 'label') this.hover = p;
    else {
      const hit = nearestWall(p, doc.walls, b.width, b.height, 14 / (this.canvas?.zoom ?? 1));
      this.hover = hit ? pointOnWall(hit.wall, hit.t, b.width, b.height) : null;
    }
  }

  private studioClick(x: number, y: number, shift: boolean) {
    const b = this.bundle;
    const doc = this.studio.doc;
    if (!b || !doc) return;
    const p: Pt = [x, y];
    const mode = this.studioMode;
    const zoom = this.canvas?.zoom ?? 1;
    if (mode === 'wall') {
      const d = this.wallDraft ?? [];
      const q = this.snap(p, d.at(-1) ?? null, shift);
      const near = (a: Pt) => Math.hypot((a[0] - q[0]) * b.width, (a[1] - q[1]) * b.height) * zoom < 8;
      if (d.length && near(d[d.length - 1])) {
        this.finishWall(); // a second click on the last point ends the wall (a double click does the same)
        return;
      }
      if (d.length >= 3 && near(d[0])) {
        this.wallDraft = [...d, d[0]]; // back on the first point: a closed outline
        this.finishWall();
        return;
      }
      this.wallDraft = [...d, q];
      return;
    }
    if (mode === 'label') {
      const r = addLabel(doc, p, 'תווית');
      this.studio.commit(r.doc);
      this.geomSel = { id: r.id, kind: 'label' };
      return;
    }
    if (mode === 'select') return;
    const hit = nearestWall(p, doc.walls, b.width, b.height, 14 / zoom);
    if (!hit) {
      this.info = 'לחץ על קיר כדי להציב פתח';
      setTimeout(() => (this.info = ''), 2500);
      return;
    }
    const r = addOpening(doc, hit.wall.id, hit.t, mode);
    this.studio.commit(r.doc);
    this.geomSel = { id: r.id, kind: 'opening' };
  }

  private finishWall() {
    const d = this.wallDraft;
    this.wallDraft = null;
    this.hover = null;
    const doc = this.studio.doc;
    if (!doc || !d || d.length < 2) return;
    const r = addWall(doc, d, this.wallDefaults);
    this.studio.commit(r.doc);
    this.geomSel = { id: r.id, kind: 'wall' };
  }

  private onGeomSelect(id: string, kind: GeomKind) {
    this.geomSel = { id, kind };
    this.selectedId = null;
    this.selectedZoneId = null;
  }

  private onGeomDrag(d: { kind: 'vertex' | 'opening' | 'label'; id: string; index: number; x: number; y: number }) {
    const b = this.bundle;
    const doc = this.studio.doc;
    if (!b || !doc) return;
    const p: Pt = [d.x, d.y];
    if (d.kind === 'vertex') {
      const w = doc.walls.find((v) => v.id === d.id);
      const prev = w && d.index > 0 ? w.polyline[d.index - 1] : null;
      const others = doc.walls.filter((v) => v.id !== d.id);
      this.studio.commit(moveVertex(doc, d.id, d.index, snapPoint(p, prev, others, b.width, b.height, { tolPx: 10 / (this.canvas?.zoom ?? 1), free: true })));
      this.geomSel = { id: d.id, kind: 'wall' };
    } else if (d.kind === 'opening') {
      const o = doc.openings.find((v) => v.id === d.id);
      const hit = o ? nearestWall(p, doc.walls, b.width, b.height, Number.POSITIVE_INFINITY, o.wall_id) : null;
      if (hit) this.studio.commit(patchOpening(doc, d.id, { t: hit.t }));
      this.geomSel = { id: d.id, kind: 'opening' };
    } else {
      this.studio.commit(patchLabel(doc, d.id, { position: p }));
      this.geomSel = { id: d.id, kind: 'label' };
    }
  }

  /** Keys of the studio tools; true when the key was used. Ctrl+Z / Ctrl+Y undo the structure, not the pins. */
  private handleStudioKey(e: KeyboardEvent): boolean {
    const mod = e.ctrlKey || e.metaKey;
    const key = e.key.toLowerCase();
    if (e.key === 'Enter' && this.wallDraft) {
      e.preventDefault();
      this.finishWall();
      return true;
    }
    if (e.key === 'Backspace' && this.wallDraft) {
      e.preventDefault();
      this.wallDraft = this.wallDraft.length > 1 ? this.wallDraft.slice(0, -1) : null;
      return true;
    }
    if ((e.key === 'Delete' || e.key === 'Backspace') && this.geomSel) {
      e.preventDefault();
      const id = this.geomSel.id;
      this.edit((d) => removeItem(d, id));
      this.geomSel = null;
      return true;
    }
    if (mod && (key === 'z' || key === 'y')) {
      e.preventDefault();
      if (key === 'y' || e.shiftKey) this.studio.redo();
      else this.studio.undo();
      this.geomSel = null;
      return true;
    }
    if (mod && key === 's') {
      e.preventDefault();
      void this.studio.flush();
      return true;
    }
    return false;
  }

  /** Bring an item into view and select it (the issue list, publish errors). */
  private focusGeom(id: string) {
    const b = this.bundle;
    const doc = this.studio.doc;
    if (!b || !doc) return;
    const w = doc.walls.find((x) => x.id === id);
    const o = doc.openings.find((x) => x.id === id);
    const l = doc.labels.find((x) => x.id === id);
    const host = o ? doc.walls.find((x) => x.id === o.wall_id) : undefined;
    const at: Pt | null = w ? pointOnWall(w, 0.5, b.width, b.height) : o && host ? pointOnWall(host, o.t, b.width, b.height) : l ? l.position : null;
    this.tool = 'structure';
    this.studioMode = 'select';
    this.wallDraft = null;
    this.geomSel = w ? { id, kind: 'wall' } : o ? { id, kind: 'opening' } : l ? { id, kind: 'label' } : null;
    if (at) this.canvas?.centerOn(Math.min(1, Math.max(0, at[0])), Math.min(1, Math.max(0, at[1])));
  }

  private async copyStructure(fromVersionId: string) {
    const b = this.bundle;
    if (!b?.planVersionId) return;
    this.busy = true;
    this.error = '';
    try {
      await this.studio.flush();
      await copyGeometryFrom(b.planVersionId, fromVersionId);
      await this.loadStudio(b, true);
      this.info = 'המבנה הועתק לטיוטה; בדוק מיקומים ופרסם';
      setTimeout(() => (this.info = ''), 4000);
    } catch (err) {
      this.error = describeError(err);
    } finally {
      this.busy = false;
    }
  }

  private exportJson() {
    const doc = this.studio.doc;
    if (!doc) return;
    const url = URL.createObjectURL(new Blob([JSON.stringify(doc, null, 2)], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `plan-structure-${doc.plan_version_id}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  private renderStructurePanel(b: MapBundle) {
    const doc = this.studio.doc;
    const versionId = b.planVersionId;
    if (!doc || !versionId) {
      return html`<sw-card heading="מבנה"><div class="note">${b.source === 'demo' ? 'נתוני הדגמה: ציור המבנה עובד מול השרת.' : this.error || 'טוען את טיוטת המבנה…'}</div></sw-card>`;
    }
    return renderStudioPanel(
      {
        doc, W: b.width, H: b.height, mode: this.studioMode, wallDefaults: this.wallDefaults, sel: this.geomSel, saveState: this.studio.saveState, saveError: this.studio.error,
        issues: this.studio.issues, copyCandidates: this.studio.copyCandidates, exportSvg: exportUrl(versionId, 'svg', { draft: true }), exportPng: exportUrl(versionId, 'png', { draft: true }), busy: this.busy,
        showEstimates: this.showEstimates,
      },
      {
        setMode: (m) => {
          this.studioMode = m;
          this.wallDraft = null;
          this.hover = null;
        },
        setWallDefaults: (d) => {
          this.wallDefaults = d;
        },
        patchWall: (id, patch) => this.edit((d) => patchWall(d, id, patch)),
        patchOpening: (id, patch) => this.edit((d) => patchOpening(d, id, patch)),
        patchLabel: (id, patch) => this.edit((d) => patchLabel(d, id, patch)),
        remove: (id) => {
          this.edit((d) => removeItem(d, id));
          this.geomSel = null;
        },
        focus: (id) => this.focusGeom(id),
        copyFrom: (id) => void this.copyStructure(id),
        exportJson: () => this.exportJson(),
        reload: () => void this.loadStudio(b, true),
      },
    );
  }
```

In `renderToolPanel(b)`, right after `const anchoredIds = …;` add:

```ts
    if (this.tool === 'structure') return this.renderStructurePanel(b);
```

In `render()`:
- rail tool buttons: replace `data-tool=${tl.id} ?disabled=${!tl.ready}` with `data-tool=${tl.id} ?disabled=${!tl.ready || (STUDIO_TOOLS.includes(tl.id) && !b.permissions.structure)}`;
- rail undo / redo buttons act on the structure while a studio tool is active: replace `aria-label="ביטול" ?disabled=${!this.undo.length} @click=${() => this.doUndo()}` with `aria-label="ביטול" ?disabled=${this.studioOn ? !this.studio.canUndo : !this.undo.length} @click=${() => (this.studioOn ? this.studio.undo() : this.doUndo())}`, and `aria-label="בצע שוב" ?disabled=${!this.redo.length} @click=${() => this.doRedo()}` with `aria-label="בצע שוב" ?disabled=${this.studioOn ? !this.studio.canRedo : !this.redo.length} @click=${() => (this.studioOn ? this.studio.redo() : this.doRedo())}`;
- replace the whole `<sw-plan-canvas editable alwaysLabel …>…</sw-plan-canvas>` element with:

```ts
                <sw-plan-canvas editable alwaysLabel .placing=${!!this.placing || !!this.drawing || this.studioPlacing} .planWidth=${b.width} .planHeight=${b.height} .plan=${b.planSvg} .imageUrl=${b.imageUrl} .markers=${this.markers} .selectedId=${this.selectedId}
                  .zones=${this.planZones} .selectedZoneId=${this.selectedZoneId} .draftPoints=${this.drawing ?? []}
                  .geometry=${this.studio.doc} .geomEditable=${this.tool === 'structure' && this.studioMode === 'select'} .selectedGeomId=${this.geomSel?.id ?? null} .issueIds=${this.issueIds}
                  .wallDraft=${this.wallDraft ?? []} .hoverPoint=${this.studioPlacing ? this.hover : null}
                  @plan-hover=${(e: CustomEvent<{ x: number; y: number; shift: boolean }>) => this.onPlanHover(e.detail.x, e.detail.y, e.detail.shift)}
                  @geom-select=${(e: CustomEvent<{ id: string; kind: GeomKind }>) => this.onGeomSelect(e.detail.id, e.detail.kind)}
                  @geom-drag=${(e: CustomEvent<{ kind: 'vertex' | 'opening' | 'label'; id: string; index: number; x: number; y: number }>) => this.onGeomDrag(e.detail)}
                  @zone-select=${(e: CustomEvent<{ id: string }>) => { if (this.placing || this.drawing || this.studioPlacing || e.detail.id.startsWith('cand-')) return; if (this.tool === 'structure') { this.geomSel = null; return; } this.selectedZoneId = e.detail.id; this.selectedId = null; }}
                  @zone-edit=${(e: CustomEvent<{ id: string; polygon: ZonePoint[] }>) => { const z = this.zones.find((x) => x.id === e.detail.id); if (z) void this.patchZone(z, { polygon: e.detail.polygon }); }}
                  @marker-select=${(e: CustomEvent<MarkerSelectDetail>) => { if (this.placing || this.drawing || this.studioPlacing) return; this.selectedId = e.detail.id; this.selectedZoneId = null; this.geomSel = null; }}
                  @marker-move=${(e: CustomEvent<{ id: string; x: number; y: number }>) => { this.apply(e.detail.id, { position: { x: +e.detail.x.toFixed(4), y: +e.detail.y.toFixed(4) } }); this.selectedId = e.detail.id; }}
                  @marker-orient=${(e: CustomEvent<{ id: string; rotation: number; fov: number }>) => this.apply(e.detail.id, { rotation_degrees: e.detail.rotation, field_of_view_degrees: e.detail.fov })}
                  @marker-coverage=${(e: CustomEvent<{ id: string; radius?: number; polygon?: { x: number; y: number }[] }>) => this.apply(e.detail.id, e.detail.polygon ? { coverage_polygon: e.detail.polygon.map((p) => [p.x, p.y] as [number, number]) } : { coverage_radius: e.detail.radius })}
                  @plan-click=${(e: CustomEvent<{ x: number; y: number; shift?: boolean }>) => (this.drawing ? this.addDraftPoint(e.detail.x, e.detail.y) : this.studioPlacing ? this.studioClick(e.detail.x, e.detail.y, !!e.detail.shift) : this.place(e.detail.x, e.detail.y))}></sw-plan-canvas>
```

- after the `${this.drawing ? html`<div class="placing-hint">…` line, add:

```ts
                ${this.wallDraft ? html`<div class="placing-hint"><span>ציור קיר: ${this.wallDraft.length} נקודות · Enter או לחיצה חוזרת על הנקודה האחרונה מסיימים · Esc לביטול</span></div>` : nothing}
```

- [ ] **Step 9: Type-check, build, run**

Record the editor baseline first (before Step 6): `SW_LIVE=1 SW_CHROME=1 npx playwright test tests/evidence-editor.spec.ts tests/evidence-zones.spec.ts tests/evidence-zone-vertices.spec.ts --project=desktop --workers=1 --reporter=line > "$SP/baseline_t12.txt"`.

Run (in `frontend/`):
- `npx tsc --noEmit -p tsconfig.json` → exit 0
- `npx playwright test tests/unit-geometry.spec.ts tests/unit-studio-controller.spec.ts --project=desktop --reporter=line` → `9 passed`
- `npm run build`, restart the developer backend (the bundle permission changed), then `SW_LIVE=1 SW_CHROME=1 npx playwright test tests/evidence-plan-studio.spec.ts --project=desktop --workers=1 --reporter=line` → `2 passed`
- the three editor specs → the same results as the baseline
- backend: `cd smplwise_vms/backend && MSYS_NO_PATHCONV=1 $PY -m pytest tests/test_plan_geometry_integration.py -p no:cacheprovider` → `5 passed`
- `bash "$SP/fixture_chain.sh"` → `129 passed` (the editor rail gained a tool in demo mode, disabled there).

- [ ] **Step 10: Commit**

```bash
git add smplwise_vms/backend/smplwise/routers/anchors.py smplwise_vms/backend/tests/test_plan_geometry_integration.py frontend/src/api/types.ts frontend/src/api/maps.ts frontend/src/map/geometry.ts frontend/src/map/studio-ops.ts frontend/src/map/sw-plan-canvas.ts frontend/src/screens/plan-studio-panel.ts frontend/src/screens/explore-plan-editor.ts frontend/tests/unit-geometry.spec.ts frontend/tests/evidence-plan-studio.spec.ts
msg=$(mktemp) && cat > "$msg" <<'EOF'
feat(plan-studio): draw walls, place doors, windows, passages and labels in the plan editor (T084)

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOF
test "$(bash /c/cloude/smplwisebms/secrets/scan_staged.sh)" = 0 && git commit -F "$msg"
```

---

### Task 13: Calibration and measuring in the editor

**Files:**
- Modify: `smplwise_vms/backend/smplwise/routers/settings.py` (setting `plan.estimates`), `frontend/src/api/media.ts` (its type), `frontend/src/screens/system-diagnostics.ts` (its row)
- Create: `smplwise_vms/backend/tests/test_plan_estimates_setting.py`
- Modify: `frontend/src/map/sw-plan-canvas.ts` (rulers)
- Modify: `frontend/src/screens/plan-studio-panel.ts` (calibration and measure panels, the calibrate action)
- Modify: `frontend/src/screens/explore-plan-editor.ts` (two tools, state, clicks, rulers, save)
- Modify: `frontend/tests/evidence-plan-studio.spec.ts` (third live test)

**Interfaces:**
- Consumes: `calibrate(versionId, pairs)` (Task 10), `PATCH /plan-versions/{id}/calibration` (Task 6), `effectiveScale`, `distanceM`, `lengthPx`, `polygonAreaM2`, `perimeterM` (Task 9), `fmtMetres`, `fmtScale` (Task 12).
- Produces: canvas `RulerOverlay {a, b, label, tone: 'accent'|'muted'}` and property `rulers`, DOM `[data-ruler]`; panel `fmtArea`, `CalibView`, `renderCalibPanel`, `renderMeasurePanel`, action `calibrate()`, DOM `[data-studio-calibrate]`, `[data-calib-panel]`, `[data-calib-metres]`, `[data-calib-save]`, `[data-calib-reset]`, `[data-calib-result]`, `[data-calib-warning]`, `[data-measure-panel]`, `[data-measure-distance]`, `[data-measure-area]`, `[data-measure-clear]`; editor tools `[data-tool="calibrate"]`, `[data-tool="measure"]`.

- [ ] **Step 0: The setting `plan.estimates` (owner decision 2026-09-23)**

Before calibration the editor shows estimated metres marked "≈" (the default); the setting lets an installation hide metres until the plan is calibrated. Failing test first, `smplwise_vms/backend/tests/test_plan_estimates_setting.py`:

```python
"""Plan Studio (T084, owner decision 2026-09-23): the setting plan.estimates says whether the editor shows estimated
metres ("≈") before a plan is calibrated (default) or hides them until calibration."""
from __future__ import annotations

from conftest import as_user, bind
from fastapi.testclient import TestClient

from smplwise.main import create_app


def test_plan_estimates_setting_defaults_to_true_and_accepts_only_booleans(settings):
    c = TestClient(create_app(settings))
    assert c.get("/api/v1/settings").json()["settings"]["plan.estimates"] == "true"
    assert c.patch("/api/v1/settings", json={"plan.estimates": "false"}).json()["settings"]["plan.estimates"] == "false"
    assert c.get("/api/v1/settings").json()["settings"]["plan.estimates"] == "false"
    assert c.patch("/api/v1/settings", json={"plan.estimates": "maybe"}).status_code == 422
    bind(c, settings, "dana", "viewer", "installation", "*")
    assert c.patch("/api/v1/settings", json={"plan.estimates": "true"}, headers=as_user("dana")).status_code == 403
```

Run: `cd smplwise_vms/backend && MSYS_NO_PATHCONV=1 $PY -m pytest tests/test_plan_estimates_setting.py -p no:cacheprovider` → FAIL (`KeyError: 'plan.estimates'`).

In `routers/settings.py`, add to `DEFAULTS` after the `"history.ha_secondary"` line:

```python
    "plan.estimates": "true",  # Plan Studio: show estimated metres (≈) before a plan is calibrated; false hides metres until calibration (owner decision 2026-09-23)
```

and to `SettingsPatch` after the `history_ha_secondary` field:

```python
    plan_estimates: str | None = Field(default=None, pattern="^(true|false)$", alias="plan.estimates")
```

Run the test again → `1 passed`; also `tests/test_ui_settings.py` → unchanged.

In `frontend/src/api/media.ts`, add to `ProductSettings` after `'snapshots.max_age_s': number;` (if Task 12 did not already):

```ts
  'plan.estimates'?: 'true' | 'false';
```

In `frontend/src/screens/system-diagnostics.ts`, add after the `history.ha_secondary` row (the `<div class="row">` whose select carries `data-set-ha-secondary`):

```ts
        <div class="row"><span class="lbl">מידות לפני כיול<span class="muted">בעורך התוכנית, כשגרסת התוכנית עדיין לא כוילה: להציג אורכים ושטחים משוערים עם ≈, או להסתיר מטרים עד הכיול</span></span>
          <sw-field class="ctl"><select data-set-plan-estimates ?disabled=${!api || !this.canEdit} @change=${(e: Event) => this.set('plan.estimates', (e.target as HTMLSelectElement).value)}>
            <option value="true" ?selected=${String(this.value('plan.estimates') ?? 'true') !== 'false'}>משוערות עם ≈</option><option value="false" ?selected=${String(this.value('plan.estimates') ?? 'true') === 'false'}>מוסתרות עד כיול</option>
          </select></sw-field></div>
```

- [ ] **Step 1: Failing live test**

Append inside the `test.describe.serial` block of `frontend/tests/evidence-plan-studio.spec.ts`:

```ts
  test('calibrate with two points and a known distance, then measure in metres', async ({ page }) => {
    const ed = 'explore-plan-editor';
    await page.goto(`/?design=a#/explore/floors/${ids.floor}/edit`);
    await expect(page.locator(`${ed} sw-plan-canvas [data-wall]`).first()).toBeVisible({ timeout: 20000 });
    // before calibration: estimates, marked "≈" (the default of plan.estimates)
    await page.locator(`${ed} [data-tool="measure"]`).click();
    await clickPlan(page, ed, 0.3, 0.3);
    await clickPlan(page, ed, 0.55, 0.3);
    await expect(page.locator(`${ed} [data-measure-distance]`)).toContainText('≈');
    await page.locator(`${ed} [data-measure-clear]`).click();
    await page.locator(`${ed} [data-tool="calibrate"]`).click();
    await expect(page.locator(`${ed} [data-calib-panel]`)).toBeVisible();
    await clickPlan(page, ed, 0.2, 0.5);
    await clickPlan(page, ed, 0.7, 0.5);
    await page.locator(`${ed} [data-calib-metres]`).fill('10');
    await expect(page.locator(`${ed} [data-calib-save]`)).not.toHaveAttribute('disabled', '');
    const saved = page.waitForResponse((r) => r.url().includes('/calibration') && r.request().method() === 'PATCH');
    await page.locator(`${ed} [data-calib-save]`).click();
    expect((await saved).status()).toBe(200);
    await expect(page.locator(`${ed} [data-calib-result]`)).toContainText('40.0'); // 1 m = 40 px
    const v = await (await api.get(`api/v1/plan-versions/${ids.version}`)).json();
    expect(v.scale_m_per_px).toBeCloseTo(0.025, 4); // 10 m over 0.5 x 800 px
    expect(v.calibration.method).toBe('two_point');
    await page.locator(`${ed} [data-tool="measure"]`).click();
    await clickPlan(page, ed, 0.3, 0.3);
    await clickPlan(page, ed, 0.55, 0.3);
    await expect(page.locator(`${ed} [data-measure-distance]`)).toContainText('5.00'); // 0.25 x 800 px x 0.025
    await expect(page.locator(`${ed} [data-measure-distance]`)).not.toContainText('≈');
  });
```

Run: `npm run build && SW_LIVE=1 SW_CHROME=1 npx playwright test tests/evidence-plan-studio.spec.ts --project=desktop --workers=1 --reporter=line`
Expected: tests 1–2 pass, test 3 FAILS (`[data-tool="calibrate"]` not found).

- [ ] **Step 2: Rulers on the canvas (`frontend/src/map/sw-plan-canvas.ts`)**

After the module-level `ptsAttr` helper (Task 11) add:

```ts
/** A measured segment drawn over the plan (calibration, measuring): normalized end points and a label. */
export interface RulerOverlay {
  a: Pt;
  b: Pt;
  label: string;
  tone: 'accent' | 'muted';
}
```

After the `hoverPoint` property (Task 12) add:

```ts
  @property({ attribute: false }) rulers: RulerOverlay[] = [];
```

Before `render()` add:

```ts
  private renderRulers() {
    if (!this.rulers.length) return nothing;
    const inv = 1 / this.scale;
    const W = this.planWidth;
    const H = this.planHeight;
    return svg`<g class="rulers" pointer-events="none">
      ${this.rulers.map((r) => {
        const ax = r.a[0] * W;
        const ay = r.a[1] * H;
        const bx = r.b[0] * W;
        const by = r.b[1] * H;
        const mx = (ax + bx) / 2;
        const my = (ay + by) / 2;
        const tw = (r.label.length * 7 + 14) * inv;
        return svg`<g class="ruler ${r.tone}" data-ruler>
          <line x1=${ax} y1=${ay} x2=${bx} y2=${by} stroke-width=${2 * inv} />
          <circle cx=${ax} cy=${ay} r=${3.5 * inv} stroke-width=${1.5 * inv} />
          <circle cx=${bx} cy=${by} r=${3.5 * inv} stroke-width=${1.5 * inv} />
          ${r.label
            ? svg`<rect x=${mx - tw / 2} y=${my - 11 * inv} width=${tw} height=${22 * inv} rx=${11 * inv} stroke-width=${inv} /><text x=${mx} y=${my} font-size=${12 * inv}>${r.label}</text>`
            : nothing}
        </g>`;
      })}
    </g>`;
  }
```

In `render()`, add `${this.renderRulers()}` right after `${this.renderWallDraft()}`. In `static styles`, after the `.wdraft circle.snap { … }` rule add:

```css
    .ruler line {
      stroke: var(--sw-accent);
    }
    .ruler.muted line {
      stroke: var(--sw-text-2);
      stroke-dasharray: 4 3;
    }
    .ruler circle {
      fill: var(--sw-surface);
      stroke: var(--sw-accent);
    }
    .ruler rect {
      fill: var(--sw-surface);
      stroke: var(--sw-border);
    }
    .ruler text {
      fill: var(--sw-text);
      font-family: var(--sw-font);
      font-weight: 600;
      text-anchor: middle;
      dominant-baseline: middle;
      direction: rtl;
      unicode-bidi: plaintext;
    }
```

- [ ] **Step 3: Panels (`frontend/src/screens/plan-studio-panel.ts`)**

Replace the `../map/geometry` import line with:

```ts
import { effectiveScale, lengthPx, perimeterM, polygonAreaM2, type GeometryDoc, type GeomLabel, type GeomOpening, type GeomWall, type Hinge, type OpeningKind, type Pt, type Swing, type WallKind } from '../map/geometry';
```

After `fmtScale` add:

```ts
export function fmtArea(m2: number, estimated: boolean, show = true): string {
  if (estimated && !show) return 'לא מכויל';
  return `${estimated ? '≈' : ''}${m2 < 100 ? m2.toFixed(1) : m2.toFixed(0)} מ״ר`;
}
```

In `StudioActions`, after `reload(): void;` add `calibrate(): void;`. In `renderStudioPanel`, replace the scale row

```ts
    <div class="row"><span class="lbl">קנה מידה<span class="muted" data-studio-scale>${estimated ? 'לא מכויל: מידות משוערות (≈)' : fmtScale(scale)}</span></span></div>
```

with

```ts
    <div class="row"><span class="lbl">קנה מידה<span class="muted" data-studio-scale>${estimated ? 'לא מכויל: מידות משוערות (≈)' : fmtScale(scale)}</span></span><sw-button size="sm" icon="scale" data-studio-calibrate @click=${() => a.calibrate()}>${estimated ? 'כיול' : 'כיול מחדש'}</sw-button></div>
```

Add above `export const studioPanelStyles`:

```ts
export interface CalibView {
  a: Pt | null;
  b: Pt | null;
  metres: string;
  /** Distance between the two points in plan pixels (null until both are set). */
  pixels: number | null;
  scale: number;
  estimated: boolean;
  showEstimates: boolean;
  result: string;
  warning: string;
  busy: boolean;
}

export function renderCalibPanel(v: CalibView, onMetres: (value: string) => void, onSave: () => void, onReset: () => void): TemplateResult {
  const metres = parseFloat(v.metres);
  const ready = !!v.a && !!v.b && metres > 0 && !v.busy;
  const notCalibrated = v.showEstimates ? 'התוכנית לא מכוילת: מידות מוצגות כמשוערות (≈)' : 'התוכנית לא מכוילת: מידות מוסתרות עד הכיול (הגדרות)';
  return html`<sw-card heading="כיול קנה מידה" subheading=${v.estimated ? notCalibrated : `מכויל · ${fmtScale(v.scale)}`} data-calib-panel>
    <ol class="steps">
      <li class=${v.a ? 'done' : ''}>לחץ על נקודה שהמרחק ממנה ידוע, למשל פינת קיר</li>
      <li class=${v.b ? 'done' : ''}>לחץ על הנקודה השנייה</li>
      <li>הקלד את המרחק האמיתי ביניהן</li>
    </ol>
    <sw-field label="מרחק (מ׳)"><input type="number" min="0.01" max="1000" step="0.01" data-ltr data-calib-metres .value=${v.metres} ?disabled=${!v.b}
      @input=${(e: Event) => onMetres((e.target as HTMLInputElement).value)} /></sw-field>
    ${v.pixels !== null ? html`<div class="note">${v.pixels.toFixed(0)} פיקסלים בתוכנית${metres > 0 ? ` · 1 מ׳ = ${(v.pixels / metres).toFixed(1)} פיקסלים` : ''}</div>` : nothing}
    <div class="btns">
      <sw-button variant="primary" size="sm" icon="check" data-calib-save ?disabled=${!ready} @click=${onSave}>שמור כיול</sw-button>
      <sw-button variant="ghost" size="sm" data-calib-reset @click=${onReset}>נקה נקודות</sw-button>
    </div>
    ${v.result ? html`<div class="note" data-calib-result>${v.result}</div>` : nothing}
    ${v.warning ? html`<div class="err" data-calib-warning>${v.warning}</div>` : nothing}
    <div class="note">המיקומים על המפה לא זזים, רק המטרים משתנים. הכיול נכנס לטיוטת המבנה והצופים רואים אותו אחרי פרסום.</div>
  </sw-card>`;
}

export function renderMeasurePanel(pts: Pt[], W: number, H: number, scale: number, estimated: boolean, show: boolean, onClear: () => void): TemplateResult {
  const total = pts.length > 1 ? lengthPx(pts, W, H) * scale : 0;
  const sub = estimated ? (show ? 'לא מכויל: הערכים משוערים (≈)' : 'לא מכויל: המידות מוסתרות עד הכיול (הגדרות)') : 'לפי הכיול של גרסת התוכנית';
  return html`<sw-card heading="מדידה" subheading=${sub} data-measure-panel>
    <div class="note">לחץ נקודות על התוכנית. Shift מבטל הצמדה לזוויות, Esc מנקה.</div>
    <div class="measure-val" data-measure-distance>${pts.length > 1 ? fmtMetres(total, estimated, show) : '—'}</div>
    ${pts.length >= 3
      ? html`<div class="note">שטח המצולע <span class="measure-val" data-measure-area>${fmtArea(polygonAreaM2(pts, W, H, scale), estimated, show)}</span> · היקף ${fmtMetres(perimeterM(pts, W, H, scale), estimated, show)}</div>`
      : nothing}
    <div class="btns"><sw-button variant="ghost" size="sm" data-measure-clear ?disabled=${!pts.length} @click=${onClear}>נקה</sw-button></div>
  </sw-card>`;
}
```

At the end of the `studioPanelStyles` block (before its closing `` `; ``, the last line of the file) add:

```css
  .steps {
    margin: 0 0 8px;
    padding-inline-start: 18px;
    display: grid;
    gap: 2px;
    font-size: var(--sw-fs-sm);
  }
  .steps li.done {
    color: var(--sw-text-2);
    text-decoration: line-through;
  }
  .measure-val {
    font-family: var(--sw-font-mono);
    font-size: var(--sw-fs-lg);
    font-weight: 600;
    font-variant-numeric: tabular-nums;
  }
```

- [ ] **Step 4: The editor (`frontend/src/screens/explore-plan-editor.ts`)**

Imports: replace `import { copyGeometryFrom, exportUrl } from '../api/geometry';` with `import { calibrate, copyGeometryFrom, exportUrl } from '../api/geometry';`; replace the `../map/geometry` import with `import { distanceM, effectiveScale, nearestWall, pointOnWall, snapPoint, type GeometryDoc, type Pt } from '../map/geometry';`; replace the `./plan-studio-panel` import with `import { fmtMetres, fmtScale, renderCalibPanel, renderMeasurePanel, renderStudioPanel, studioPanelStyles, type GeomKind, type GeomSel, type StudioMode } from './plan-studio-panel';`; and add `RulerOverlay` to the type import from `../map/sw-plan-canvas` (`import type { PlanMarker, MarkerSelectDetail, PlanZone, RulerOverlay, SwPlanCanvas } from '../map/sw-plan-canvas';`).

Tools: replace the `type Tool = …` line with

```ts
type Tool = 'select' | 'camera' | 'lights' | 'entity' | 'zones' | 'structure' | 'calibrate' | 'measure' | 'layers';
```

add to `TOOLS` after the `structure` entry:

```ts
  { id: 'calibrate', icon: 'scale', label: 'כיול קנה מידה', ready: true },
  { id: 'measure', icon: 'ruler', label: 'מדידת מרחק ושטח', ready: true },
```

replace `const STUDIO_TOOLS: Tool[] = ['structure'];` with `const STUDIO_TOOLS: Tool[] = ['structure', 'calibrate', 'measure'];`, and add below it:

```ts
interface CalibState {
  a: Pt | null;
  b: Pt | null;
  metres: string;
  result: string;
  warning: string;
}
const EMPTY_CALIB: CalibState = { a: null, b: null, metres: '', result: '', warning: '' };
```

State, after `@state() private hover: Pt | null = null;`:

```ts
  @state() private calib: CalibState = { ...EMPTY_CALIB };
  @state() private measurePts: Pt[] = [];
```

In `handleKey`'s Escape block, replace

```ts
      } else if (this.drawing) this.drawing = null;
```

with

```ts
      } else if (this.tool === 'measure' && this.measurePts.length) this.measurePts = [];
      else if (this.tool === 'calibrate' && this.calib.a) this.calib = { ...EMPTY_CALIB };
      else if (this.drawing) this.drawing = null;
```

In `pickTool`, after `if (tool !== 'structure') this.geomSel = null;` add:

```ts
    if (tool !== 'measure') this.measurePts = [];
    if (tool !== 'calibrate') this.calib = { ...EMPTY_CALIB };
```

Replace `onPlanHover` with:

```ts
  private onPlanHover(x: number, y: number, shift: boolean) {
    const b = this.bundle;
    const doc = this.studio.doc;
    if (!b || !doc || !this.studioPlacing) {
      this.hover = null;
      return;
    }
    const p: Pt = [x, y];
    if (this.tool === 'calibrate') this.hover = this.snap(p, null, true);
    else if (this.tool === 'measure') this.hover = this.snap(p, this.measurePts.at(-1) ?? null, shift);
    else if (this.studioMode === 'wall') this.hover = this.snap(p, this.wallDraft?.at(-1) ?? null, shift);
    else if (this.studioMode === 'label') this.hover = p;
    else {
      const hit = nearestWall(p, doc.walls, b.width, b.height, 14 / (this.canvas?.zoom ?? 1));
      this.hover = hit ? pointOnWall(hit.wall, hit.t, b.width, b.height) : null;
    }
  }
```

In `studioClick`, right after `const p: Pt = [x, y];` insert:

```ts
    if (this.tool === 'calibrate') {
      const q = this.snap(p, null, true); // corners of walls attract; no angle snapping - the distance is what counts
      const c = this.calib;
      this.calib = !c.a || c.b ? { ...EMPTY_CALIB, a: q } : { ...c, b: q };
      return;
    }
    if (this.tool === 'measure') {
      this.measurePts = [...this.measurePts, this.snap(p, this.measurePts.at(-1) ?? null, shift)];
      return;
    }
```

Add after `renderStructurePanel`:

```ts
  /** Calibration and measuring segments with their lengths, drawn by the canvas. */
  private get rulers(): RulerOverlay[] {
    const bundle = this.bundle;
    const doc = this.studio.doc;
    if (!bundle || !doc) return [];
    const { scale, estimated } = effectiveScale(doc);
    const len = (a: Pt, c: Pt) => fmtMetres(distanceM(a, c, bundle.width, bundle.height, scale), estimated, this.showEstimates);
    if (this.tool === 'calibrate') {
      const { a, b: end, metres } = this.calib;
      const tip = end ?? this.hover;
      if (!a || !tip) return [];
      return [{ a, b: tip, label: end ? (parseFloat(metres) > 0 ? `${metres} מ׳` : '? מ׳') : '', tone: end ? 'accent' : 'muted' }];
    }
    if (this.tool === 'measure') {
      const fixed = this.measurePts;
      const pts = this.hover && fixed.length ? [...fixed, this.hover] : fixed;
      const out: RulerOverlay[] = [];
      for (let i = 1; i < pts.length; i++) out.push({ a: pts[i - 1], b: pts[i], label: len(pts[i - 1], pts[i]), tone: i > fixed.length - 1 ? 'muted' : 'accent' });
      if (fixed.length >= 3) out.push({ a: fixed[fixed.length - 1], b: fixed[0], label: '', tone: 'muted' });
      return out;
    }
    return [];
  }

  private async saveCalibration() {
    const bundle = this.bundle;
    const { a, b: end, metres } = this.calib;
    const m = parseFloat(metres);
    if (!bundle?.planVersionId || !a || !end || !(m > 0)) return;
    this.busy = true;
    this.error = '';
    try {
      await this.studio.flush();
      const r = await calibrate(bundle.planVersionId, [{ a, b: end, metres: m }]);
      await this.loadStudio(bundle, true); // the server rewrote the draft's dimensions
      this.calib = { ...EMPTY_CALIB, result: `קנה המידה נשמר: ${fmtScale(r.scale_m_per_px)}`, warning: r.warning ?? '' };
    } catch (err) {
      this.error = describeError(err);
    } finally {
      this.busy = false;
    }
  }

  private renderCalibrate(bundle: MapBundle) {
    const doc = this.studio.doc;
    if (!doc) return html`<sw-card heading="כיול קנה מידה"><div class="note">${bundle.source === 'demo' ? 'נתוני הדגמה: הכיול עובד מול השרת.' : 'טוען…'}</div></sw-card>`;
    const { scale, estimated } = effectiveScale(doc);
    const c = this.calib;
    const pixels = c.a && c.b ? Math.hypot((c.b[0] - c.a[0]) * bundle.width, (c.b[1] - c.a[1]) * bundle.height) : null;
    return renderCalibPanel(
      { a: c.a, b: c.b, metres: c.metres, pixels, scale, estimated, showEstimates: this.showEstimates, result: c.result, warning: c.warning, busy: this.busy },
      (value) => {
        this.calib = { ...this.calib, metres: value };
      },
      () => void this.saveCalibration(),
      () => {
        this.calib = { ...EMPTY_CALIB };
      },
    );
  }

  private renderMeasure(bundle: MapBundle) {
    const doc = this.studio.doc;
    if (!doc) return html`<sw-card heading="מדידה"><div class="note">${bundle.source === 'demo' ? 'נתוני הדגמה: המדידה עובדת מול השרת.' : 'טוען…'}</div></sw-card>`;
    const { scale, estimated } = effectiveScale(doc);
    return renderMeasurePanel(this.measurePts, bundle.width, bundle.height, scale, estimated, this.showEstimates, () => {
      this.measurePts = [];
    });
  }
```

In `renderStructurePanel`'s actions object, after `reload: () => void this.loadStudio(b, true),` add `calibrate: () => this.pickTool('calibrate'),`.

In `renderToolPanel(b)`, after the `structure` line add:

```ts
    if (this.tool === 'calibrate') return this.renderCalibrate(b);
    if (this.tool === 'measure') return this.renderMeasure(b);
```

On the `<sw-plan-canvas …>` element, add `.rulers=${this.rulers}` right after `.hoverPoint=${this.studioPlacing ? this.hover : null}`.

- [ ] **Step 5: Type-check, build, run**

Run (in `frontend/`): `npx tsc --noEmit -p tsconfig.json` → exit 0; `npm run build`; `SW_LIVE=1 SW_CHROME=1 npx playwright test tests/evidence-plan-studio.spec.ts --project=desktop --workers=1 --reporter=line` → `3 passed`. Re-run the three editor specs → same as the Task 12 baseline.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/map/sw-plan-canvas.ts frontend/src/screens/plan-studio-panel.ts frontend/src/screens/explore-plan-editor.ts frontend/tests/evidence-plan-studio.spec.ts
msg=$(mktemp) && cat > "$msg" <<'EOF'
feat(plan-studio): two-point calibration and distance / area measuring in the plan editor (T084)

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOF
test "$(bash /c/cloude/smplwisebms/secrets/scan_staged.sh)" = 0 && git commit -F "$msg"
```

---

### Task 14: Publishing the structure — preview, blocked publish, publish with a new plan version

**Files:**
- Modify: `frontend/src/screens/plan-studio-panel.ts` (`COLL_LABEL`)
- Modify: `frontend/src/screens/explore-plan-editor.ts` (publish button, structure preview dialog, the plan-version preview note, refresh after publishing)
- Modify: `frontend/tests/evidence-plan-studio.spec.ts` (fourth live test)

**Interfaces:**
- Consumes: `geometryDiff(versionId)`, `publishGeometry(versionId)` (Task 10); `StudioController.pendingPublish` (Task 10); `POST /plan-versions/{id}/geometry/publish` and the combined plan publish (Tasks 6–7); `focusGeom`, `loadStudio`, `issueIds` (Task 12).
- Produces: header button `[data-publish]` ("פרסום גרסה" for a draft plan version, "פרסום המבנה" when only the structure changed); dialog `[data-geom-diff]` with `[data-geom-diff-rows]`, `[data-geom-diff-error]`, `[data-geom-publish]`, `[data-geom-cancel]`; note `[data-diff-structure]` in the existing plan-version preview; `COLL_LABEL`.

- [ ] **Step 1: Failing live test**

Append inside the `test.describe.serial` block of `frontend/tests/evidence-plan-studio.spec.ts`:

```ts
  test('publish the structure through its preview; an invalid draft is blocked and fixed from the issue list; a new drawing copies the structure and publishes it with the plan', async ({ page }) => {
    const ed = 'explore-plan-editor';
    await page.goto(`/?design=a#/explore/floors/${ids.floor}/edit`);
    await expect(page.locator(`${ed} [data-publish]`)).toContainText('פרסום המבנה', { timeout: 20000 });
    await page.locator(`${ed} [data-publish]`).click();
    await expect(page.locator(`${ed} [data-geom-diff-rows]`)).toContainText('קירות');
    const published = page.waitForResponse((r) => r.url().includes('/geometry/publish'));
    await page.locator(`${ed} [data-geom-publish]`).click();
    expect((await published).status()).toBe(200);
    await expect(page.locator(`${ed} [data-publish]`)).toHaveCount(0);
    const pub = await (await api.get(`api/v1/plan-versions/${ids.version}/geometry`)).json();
    expect(pub.doc.walls).toHaveLength(3);
    expect(pub.doc.dimensions.scale_m_per_px).toBeCloseTo(0.025, 4);

    // a wall outside the plan blocks publishing; the issue list selects it and Delete fixes the draft
    const g = await (await api.get(`api/v1/plan-versions/${ids.version}/geometry?draft=true`)).json();
    const bad = { ...g.doc, walls: [...g.doc.walls, WALL('bad1', [[0.2, 0.8], [1.4, 0.8]])] };
    expect((await api.put(`api/v1/plan-versions/${ids.version}/geometry`, { data: { doc: bad, base_revision: g.geometry.revision } })).status()).toBe(200);
    await page.goto('about:blank');
    await page.goto(`/?design=a#/explore/floors/${ids.floor}/edit`);
    await page.locator(`${ed} [data-tool="structure"]`).click();
    await expect(page.locator(`${ed} [data-issue="bounds"]`)).toBeVisible({ timeout: 20000 });
    await page.locator(`${ed} [data-publish]`).click();
    await expect(page.locator(`${ed} [data-geom-diff-error]`)).toBeVisible();
    await expect(page.locator(`${ed} [data-geom-publish] button`)).toBeDisabled();
    await page.locator(`${ed} [data-geom-cancel]`).click();
    await page.locator(`${ed} [data-issue="bounds"]`).click();
    await expect(page.locator(`${ed} [data-selected-wall="bad1"]`)).toBeVisible();
    await page.keyboard.press('Delete');
    await expect(page.locator(`${ed} [data-studio-panel][data-studio-save="saved"]`)).toHaveCount(1, { timeout: 10000 });
    await expect(page.locator(`${ed} [data-issue]`)).toHaveCount(0);

    // a new plan version of another drawing (rotated) starts empty and offers the published structure
    const turned = await (await api.post(`api/v1/floors/${ids.floor}/plan-versions`, { data: { asset_id: ids.asset, rotation: 90 } })).json();
    expect(turned.geometry_carry).toBe('none');
    await page.goto('about:blank');
    await page.goto(`/?design=a#/explore/floors/${ids.floor}/edit`);
    await page.locator(`${ed} [data-tool="structure"]`).click();
    await page.locator(`${ed} [data-copy-from="${ids.version}"]`).click();
    await expect(page.locator(`${ed} sw-plan-canvas [data-wall]`)).toHaveCount(5, { timeout: 10000 });
    await page.locator(`${ed} [data-publish]`).click();
    await expect(page.locator(`${ed} [data-diff-structure]`)).toContainText('3 קירות');
    const planPublished = page.waitForResponse((r) => r.url().endsWith(`/plan-versions/${turned.id}/publish`));
    await page.locator(`${ed} [data-diff-confirm]`).click();
    expect((await planPublished).status()).toBe(200);
    const after = await (await api.get(`api/v1/plan-versions/${turned.id}/geometry`)).json();
    expect(after.doc.walls).toHaveLength(3);
    const svgExport = await api.get(`api/v1/plan-versions/${turned.id}/export.svg`);
    expect(svgExport.status()).toBe(200);
    expect(await svgExport.text()).toContain('data-wall=');
  });
```

Run: `npm run build && SW_LIVE=1 SW_CHROME=1 npx playwright test tests/evidence-plan-studio.spec.ts --project=desktop --workers=1 --reporter=line`
Expected: tests 1–3 pass, test 4 FAILS (`[data-publish]` not found).

- [ ] **Step 2: Collection names (`frontend/src/screens/plan-studio-panel.ts`)**

After `SAVE_LABEL` add:

```ts
/** Hebrew names of the document's collections (publish previews). */
export const COLL_LABEL: Record<string, string> = {
  walls: 'קירות',
  openings: 'פתחים',
  labels: 'תוויות',
  levels: 'מפלסים',
  rooms: 'חדרים',
  objects: 'עצמים',
  circuits: 'מעגלי תאורה',
  connectors: 'מחברים',
  groups: 'קבוצות',
};
```

- [ ] **Step 3: The editor (`frontend/src/screens/explore-plan-editor.ts`)**

Imports: replace `import { calibrate, copyGeometryFrom, exportUrl } from '../api/geometry';` with `import { calibrate, copyGeometryFrom, exportUrl, geometryDiff, publishGeometry } from '../api/geometry';`, and add `COLL_LABEL` to the `./plan-studio-panel` import list.

Module level, after `EMPTY_CALIB`:

```ts
type GeomDiffData = Awaited<ReturnType<typeof geometryDiff>>;
```

State, after `@state() private measurePts: Pt[] = [];`:

```ts
  @state() private geomDiff: { data: GeomDiffData | null; error: string } | null = null;
```

Replace `publish()` with:

```ts
  /** Publishing always goes through a preview. A draft plan version publishes its image, its pins (T038) and its
   * structure together; on the published version only the structure has something new to publish. */
  private async publish() {
    const b = this.bundle;
    if (!b?.planVersionId) return;
    if (this.dirty.size && !(await this.save())) return;
    await this.studio.flush();
    if (this.studio.saveState === 'error') {
      this.error = this.studio.error;
      return;
    }
    if (b.planStatus === 'published') {
      await this.openGeomDiff(b.planVersionId);
      return;
    }
    const draft = this.versions.find((v) => v.id === b.planVersionId);
    if (!draft) {
      await this.publishNow(b.planVersionId);
      return;
    }
    await this.openDiff('publish', draft);
  }

  private async openGeomDiff(versionId: string) {
    this.geomDiff = { data: null, error: '' };
    try {
      this.geomDiff = { data: await geometryDiff(versionId), error: '' };
    } catch (err) {
      this.geomDiff = { data: null, error: describeError(err) };
    }
  }

  private async confirmGeomPublish() {
    const b = this.bundle;
    const d = this.geomDiff;
    if (!b?.planVersionId || !d?.data) return;
    this.busy = true;
    try {
      await publishGeometry(b.planVersionId);
      this.geomDiff = null;
      this.info = 'המבנה פורסם; הצופים רואים אותו עכשיו';
      setTimeout(() => (this.info = ''), 4000);
      await this.loadStudio(b, true); // refresh what viewers see (the published hash)
    } catch (err) {
      this.geomDiff = { ...d, error: describeError(err) };
    } finally {
      this.busy = false;
    }
  }
```

In `publishNow`, replace

```ts
      await publishVersion(versionId);
      this.info = 'הגרסה פורסמה; הצופים רואים אותה עכשיו';
      await this.load();
```

with

```ts
      await publishVersion(versionId);
      this.info = 'הגרסה פורסמה; הצופים רואים אותה עכשיו';
      await this.load();
      if (this.bundle) await this.loadStudio(this.bundle, true);
```

In `confirmDiff`, replace

```ts
      this.diff = null;
      await this.load();
      setTimeout(() => (this.info = ''), 4000);
    } catch (err) {
      this.diff = { ...d, error: describeError(err) };
      if (err instanceof ApiError && err.status === 409) void this.loadVersions();
```

with

```ts
      this.diff = null;
      await this.load();
      if (this.bundle) await this.loadStudio(this.bundle, true); // the structure was published with the plan
      setTimeout(() => (this.info = ''), 4000);
    } catch (err) {
      this.diff = { ...d, error: describeError(err) };
      if (err instanceof ApiError && err.status === 409) void this.loadVersions();
      if (err instanceof ApiError && err.code === 'geometry_invalid') {
        this.tool = 'structure'; // the issue list is in the structure panel
        this.studioMode = 'select';
      }
```

Add after `renderDiffDialog()`:

```ts
  private renderGeomDiffDialog() {
    const d = this.geomDiff;
    if (!d) return nothing;
    const data = d.data;
    const errors = data ? data.issues.filter((i) => i.severity === 'error') : [];
    const rows = data ? Object.entries(data.diff.collections) : [];
    return html`<sw-dialog open heading="פרסום המבנה" subheading="מה ישתנה לצופים במפה" data-geom-diff @close=${() => (this.geomDiff = null)}>
      ${d.error ? html`<div class="err" data-geom-diff-error>${d.error}</div>` : nothing}
      ${!data
        ? d.error
          ? nothing
          : html`<div class="note">טוען השוואה…</div>`
        : html`<div class="ditems" data-geom-diff-rows>
              ${rows.length
                ? rows.map(([coll, c]) => html`<div><span>${COLL_LABEL[coll] ?? coll}</span><span>${c.added.length} נוספו · ${c.changed.length} שונו · ${c.removed.length} הוסרו</span></div>`)
                : html`<div><span>אין שינוי בפריטים</span></div>`}
              ${data.diff.calibration_changed ? html`<div><span>כיול</span><span>קנה המידה השתנה</span></div>` : nothing}
            </div>
            <div class="note">${data.published_counts ? `כעת: ${data.published_counts.walls} קירות, ${data.published_counts.openings} פתחים` : 'פרסום ראשון של מבנה'} · אחרי הפרסום: ${data.counts.walls} קירות, ${data.counts.openings} פתחים</div>
            ${errors.length ? html`<div class="err" data-geom-diff-error>${errors.length} שגיאות חוסמות את הפרסום; הן מסומנות באדום על המפה וברשימת הבעיות של המבנה.</div>` : nothing}`}
      <sw-button slot="footer" variant="ghost" data-geom-cancel @click=${() => (this.geomDiff = null)}>ביטול</sw-button>
      <sw-button slot="footer" variant="primary" icon="check" data-geom-publish ?disabled=${this.busy || !data || errors.length > 0 || !!data?.diff.same} @click=${() => this.confirmGeomPublish()}>פרסם מבנה</sw-button>
    </sw-dialog>`;
  }
```

In `renderDiffDialog()`, right after the closing `</div>` of the `data-diff-summary` block (the line after `<span>${data.anchors.total} פריטים מוצבים · …</span>`), add:

```ts
            ${d.mode === 'publish' && this.studio.doc && (this.studio.doc.walls.length || this.studio.doc.openings.length)
              ? html`<div class="note" data-diff-structure>המבנה של הטיוטה (${this.studio.doc.walls.length} קירות, ${this.studio.doc.openings.length} פתחים) יפורסם יחד עם הגרסה${this.issueIds.length ? '; יש בו שגיאות שיחסמו את הפרסום' : ''}.</div>`
              : nothing}
```

In `render()`, replace the header publish button

```ts
        ${b.planStatus === 'draft' && b.permissions.publish ? html`<sw-button slot="actions" variant="primary" icon="check" ?disabled=${this.busy} @click=${() => this.publish()}>פרסום גרסה</sw-button>` : nothing}
```

with

```ts
        ${b.permissions.publish && (b.planStatus === 'draft' || this.studio.pendingPublish)
          ? html`<sw-button slot="actions" variant="primary" icon="check" data-publish ?disabled=${this.busy} @click=${() => this.publish()}>${b.planStatus === 'draft' ? 'פרסום גרסה' : 'פרסום המבנה'}</sw-button>`
          : nothing}
```

and replace `        ${this.renderDiffDialog()}` with:

```ts
        ${this.renderDiffDialog()}
        ${this.renderGeomDiffDialog()}
```

- [ ] **Step 4: Type-check, build, run**

Run (in `frontend/`): `npx tsc --noEmit -p tsconfig.json` → exit 0; `npm run build`; `SW_LIVE=1 SW_CHROME=1 npx playwright test tests/evidence-plan-studio.spec.ts --project=desktop --workers=1 --reporter=line` → `4 passed`; `SW_LIVE=1 SW_CHROME=1 npx playwright test tests/evidence-plan-versions.spec.ts tests/evidence-editor.spec.ts --project=desktop --workers=1 --reporter=line` → same as the baselines (the plan-version publish path changed).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/screens/plan-studio-panel.ts frontend/src/screens/explore-plan-editor.ts frontend/tests/evidence-plan-studio.spec.ts
msg=$(mktemp) && cat > "$msg" <<'EOF'
feat(plan-studio): publish the structure through a preview, blocked by errors, together with a new plan version (T084)

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOF
test "$(bash /c/cloude/smplwisebms/secrets/scan_staged.sh)" = 0 && git commit -F "$msg"
```

---

### Task 15: Release 0.1.82 — full verification, version, records, owner checklist, merge

**Files:**
- Modify: `smplwise_vms/config.yaml`, `smplwise_vms/Dockerfile`, `smplwise_vms/backend/smplwise/__init__.py` (0.1.82)
- Modify: `smplwise_vms/CHANGELOG.md`, `contracts/API_INVENTORY.md` (generated), `smplwise_vms/www/` (generated by `build:addon`)
- Modify: `management/tasks.json`, `management/test_catalog.json` and the generated views (`scripts/project_status.py --write`)
- Create: `docs/operations/PLAN_STUDIO_PHASE1_CHECKLIST_HE.md`
- Modify: `docs/architecture/PLAN_STUDIO_DESIGN_HE.md` (implementation line)

**Interfaces:**
- Consumes: everything above.
- Produces: add-on 0.1.82 on `main`; T084 and T059 evidenced (DONE only if every check below is green); AT117 / AT118 / AT167 / AT168 recorded.

- [ ] **Step 1: Version bump and the generated API inventory**

```bash
sed -i 's/^version: "0.1.81"/version: "0.1.82"/' smplwise_vms/config.yaml
sed -i 's/io.hass.version="0.1.81"/io.hass.version="0.1.82"/' smplwise_vms/Dockerfile
sed -i 's/__version__ = "0.1.81"/__version__ = "0.1.82"/' smplwise_vms/backend/smplwise/__init__.py
grep -c '0\.1\.82' smplwise_vms/config.yaml smplwise_vms/Dockerfile smplwise_vms/backend/smplwise/__init__.py
MSYS_NO_PATHCONV=1 $PY C:/cloude/smplwisebms/scripts/api_inventory.py
```

Expected: each file reports `1`; the inventory is rewritten at 0.1.82 with the 11 new routes (geometry GET / PUT, publish, diff, versions, timeline, rollback, copy-from, calibration, export.svg, export.png).

- [ ] **Step 2: The whole backend suite and the golden file**

```bash
cd /c/cloude/smplwisebms/smplwise_vms/backend && MSYS_NO_PATHCONV=1 $PY -m pytest -p no:cacheprovider > "$SP/pytest_0182.txt" 2>&1; echo "exit $?"; tail -n 3 "$SP/pytest_0182.txt"
MSYS_NO_PATHCONV=1 $PY C:/cloude/smplwisebms/scripts/geometry_golden.py --check; echo "golden $?"
```

Expected: `exit 0` and `N passed` (176 before this plan + 34 new = 210; if the number differs, count the new tests and explain the difference in the evidence line); `golden 0`.

- [ ] **Step 3: The whole frontend check**

In `frontend/`:
- `npx tsc --noEmit -p tsconfig.json` → exit 0
- `npx playwright test tests/unit-geometry.spec.ts tests/unit-studio-controller.spec.ts --project=desktop --reporter=line` → `9 passed`
- `npm run build`, then `bash "$SP/restart_dev.sh"` (prints `me: 200` and the new listener pid)
- `SW_LIVE=1 SW_CHROME=1 npx playwright test tests/evidence-plan-studio.spec.ts --project=desktop --workers=1 --reporter=line` → `4 passed`
- `SW_LIVE=1 SW_CHROME=1 npx playwright test tests/evidence-editor.spec.ts tests/evidence-plan-versions.spec.ts tests/evidence-history-map.spec.ts tests/evidence-zones.spec.ts tests/evidence-zone-vertices.spec.ts --project=desktop --workers=1 --reporter=line > "$SP/neighbours_0182.txt"` → the same results as the Task 11 / 12 baselines; a failure that also fails in the baseline and names the NVR / go2rtc / HA (ConnectTimeout, source_unavailable) is BLOCKED, anything else is fixed before continuing
- `bash "$SP/fixture_chain.sh"` → `fixtures exit: 0`, `129 passed`
- `npm run build:addon` → writes `smplwise_vms/www`

- [ ] **Step 4: CHANGELOG**

Insert at the top of `smplwise_vms/CHANGELOG.md`, right after the `# Changelog — SMPLWISE VMS add-on` line and its blank line:

```markdown
## 0.1.82 (pilot) — Plan Studio phase 1: walls, doors and windows on the plan, calibrated, on every map
- The plan editor gains three tools (T084, CR-003): **structure** - walls drawn point by point with snapping to
  corners and to 45 degrees, doors / windows / passages placed on a wall (they cut it), labels, selection, dragging
  of corners, openings and labels, undo / redo and a server-side draft saved two seconds after the last edit;
  **calibrate** - two points and a known distance (more pairs expose a distorted scan); **measure** - distance,
  area and perimeter in metres, marked "≈" until the plan is calibrated (the new setting "מידות לפני כיול" /
  `plan.estimates` hides them until calibration instead - owner decision 2026-09-23).
- A draft belongs to the editor: viewers keep the published structure until "פרסום המבנה" (a preview of what
  changes; blocked while the validator reports errors, which are red on the map and listed in the panel).
  Publishing a draft plan version publishes its structure with it and refuses (422) before anything changes when
  the structure is invalid.
- Every map shows the published structure: the live floor map (new layer "מבנה", remembered per floor), the
  history map at the chosen instant (each structure publish has its own period), the event page and the Lovelace
  card, which embeds the same floor screen.
- A new plan version of the same drawing starts from the floor's structure (copied, or mapped through a re-crop,
  with the calibration carried); another drawing starts empty and offers a copy. Restoring a plan version restores
  its structure; backups include it.
- Exports: SVG and PNG drawn from the same deterministic primitives as the map (a golden fixture pins the Python
  and TypeScript code to the same shapes), and the JSON document.
- Storage: migrations 0018 (`plan_geometry`, `plan_versions.calibration_json`) and 0019 (level columns used from
  phase 2), additive only; 11 new API routes; `/floors/{id}/map` carries a reference to the structure and
  `permissions.structure`.
- Evidence: seven new backend test files, two node unit specs, the live spec `evidence-plan-studio` (four tests in
  real Chrome).

```

- [ ] **Step 5: Records (only after Steps 1–3 are green)**

```bash
cd /c/cloude/smplwisebms && cat > "$SP/record_t084.py" <<'EOF'
"""Record the Plan Studio phase 1 evidence (T084, T059 and their acceptance tests) at the tested commit."""
import datetime
import json
import pathlib
import re
import subprocess
import sys

ROOT = pathlib.Path(r"C:\cloude\smplwisebms\management")
summary = re.search(r"(\d+) passed", pathlib.Path(sys.argv[1]).read_text(encoding="utf-8", errors="replace"))
if not summary:
    sys.exit("no pytest summary line in " + sys.argv[1])
N = summary.group(1)
commit = subprocess.check_output(["git", "rev-parse", "--short", "HEAD"], text=True, cwd=ROOT.parent).strip()
today = datetime.date.today().isoformat()
now = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
env = f"workstation: dev backend 0.1.82 (SQLite) on 8099 + vite preview 4173, Chrome through Playwright; pytest on Python 3.12 ({today})"
tasks = json.loads((ROOT / "tasks.json").read_text(encoding="utf-8"))
tests = json.loads((ROOT / "test_catalog.json").read_text(encoding="utf-8"))
by_task = {t["id"]: t for t in tasks}
by_test = {t["id"]: t for t in tests}

t084 = (f"{today} (0.1.82): Plan Studio phase 1 on {commit} - plan_geometry (migration 0018: one draft, at most one published and an archived "
        "history per plan version; plan_versions.calibration_json) and level columns (0019); document v2 (contracts/schemas/plan_geometry.v2.schema.json) "
        "with structural vs geometric validation; API: draft autosave with revisions (409 stale_revision), publish with diff and audit (geometry.publish), "
        "versions, timeline, rollback, copy between versions, two-point calibration with residual (plan.calibrate); the map bundle carries a reference "
        "(id + SHA-256, ETag / 304) and permissions.structure; a plan-version publish publishes its structure (422 geometry_invalid before anything "
        "changes), a new version of the same drawing carries it (copied, or mapped through the crop, with the calibration), a restore brings it back, "
        "deleting a draft version removes it, backups include it; deterministic primitives shared by the map and the SVG / PNG exports "
        "(contracts/fixtures/plan_geometry golden). Shown on the live floor map (layer 'מבנה'), the history map at t, the event page and the Lovelace "
        "card (same floor screen); drawn in the plan editor (structure, calibrate and measure tools, publish preview). Tests: "
        f"{N} backend passed (7 new files), 9 node unit tests, evidence-plan-studio 4/4 live in real Chrome, neighbour specs as their baselines, "
        "fixture chain 129. R167 note: measured metres only after calibration; before it every value carries '≈' (design section 6).")
t059 = (f"{today} (0.1.82): acceptance implemented by T084 (CR-003) on {commit}: versioned schema v2 with source hash, dimensions, transforms, walls, "
        "openings (doors / windows), rooms, connectors and uncertainty; the validator covers normalized bounds, missing calibration (a reason is required), "
        "duplicate ids and references, while polygon simplicity stays with the v1 proposal schema (plan_schema.polygon_simple); the renderer is "
        "deterministic (same JSON -> same primitives, SVG and PNG bytes; golden fixture shared with the browser).")
for tid, line in (("T084", t084), ("T059", t059)):
    t = by_task[tid]
    t["evidence"].append(line)
    t["status"] = "DONE"
    t["blocker"] = None
    t["commit"] = commit
    t["owner"] = t["owner"] or "Claude Code (tech lead); approver: product owner"

EVIDENCE = {
    "AT117": ["smplwise_vms/backend/tests/test_plan_geometry_model.py", "contracts/schemas/plan_geometry.v2.schema.json"],
    "AT118": ["smplwise_vms/backend/tests/test_plan_geometry_model.py (validator)", "smplwise_vms/backend/tests/test_plan_geometry_render.py + contracts/fixtures/plan_geometry (determinism)",
              "frontend/tests/unit-geometry.spec.ts (the browser draws the same primitives)"],
    "AT167": ["smplwise_vms/backend/tests/test_plan_geometry_api.py (calibration, residual, audit)", "smplwise_vms/backend/tests/test_plan_geometry_model.py (measured / estimated / missing)",
              "frontend/tests/evidence-plan-studio.spec.ts (calibrate, then measure 5.00 m without '≈')"],
    "AT168": ["smplwise_vms/backend/tests/test_plan_geometry_store.py", "smplwise_vms/backend/tests/test_plan_geometry_api.py", "smplwise_vms/backend/tests/test_plan_geometry_integration.py",
              "smplwise_vms/backend/tests/test_plan_geometry_export.py", "frontend/tests/evidence-plan-studio.spec.ts (live map, history map, editor, publish, copy)"],
}
for aid, ev in EVIDENCE.items():
    x = by_test[aid]
    x.update({"status": "PASS", "commit": commit, "environment": env, "evidence": ev, "executed_at": now})

(ROOT / "tasks.json").write_text(json.dumps(tasks, ensure_ascii=False, indent=2) + "\n", encoding="utf-8", newline="\n")
(ROOT / "test_catalog.json").write_text(json.dumps(tests, ensure_ascii=False, indent=2) + "\n", encoding="utf-8", newline="\n")
print("recorded at", commit)
EOF
$PY "$SP/record_t084.py" "$SP/pytest_0182.txt" && MSYS_NO_PATHCONV=1 $PY C:/cloude/smplwisebms/scripts/project_status.py --write
```

If any check in Steps 2–3 is not green, do not run the script: set T084 to `IN_PROGRESS` with the failing check as `blocker` and report it.

- [ ] **Step 6: Owner checklist and the design document line**

Create `docs/operations/PLAN_STUDIO_PHASE1_CHECKLIST_HE.md`:

```markdown
# סטודיו התוכנית — שלב 1: בדיקה אצל הבעלים (גרסה 0.1.82)

לכל סעיף: עבר / נכשל, והערה קצרה אם משהו לא נוח. אין צורך ב־NVR; מספיקה קומה עם תוכנית.

| # | מה עושים | מה אמור לקרות |
|---|---|---|
| 1 | "בדוק עדכון" בחנות התוספים ועדכון ל־0.1.82 | הגרסה מותקנת והמערכת עולה |
| 2 | קומה עם תוכנית ← עריכה ← הכלי "כיול קנה מידה" (סרגל); שתי לחיצות על קצוות קיר שאורכו ידוע, הקלדת המרחק במטרים, "שמור כיול" | מופיע "קנה המידה נשמר: 1 מ׳ = … פיקסלים"; שום סיכה לא זזה |
| 3 | הכלי "מדידה": שתי לחיצות לאורך קיר ידוע | מרחק במטרים בלי "≈"; שלוש נקודות ומעלה מציגות גם שטח והיקף |
| 4 | הכלי "מבנה", מצב "קיר": לחיצות לאורך קיר בתוכנית ואז Enter | הקיר מצויר; Shift מבטל הצמדה לזוויות; בפאנל "הטיוטה נשמרה" |
| 5 | מצבים "דלת", "חלון", "מעבר": לחיצה על קיר | הפתח חותך את הקיר; לדלת אפשר לשנות כיוון פתיחה וציר בפאנל |
| 6 | מצב "תווית": לחיצה ואז טקסט בפאנל | התווית מוצגת על המפה |
| 7 | מצב "בחירה": לחיצה על קיר, גרירת פינה; גרירת דלת לאורך הקיר | הקיר והדלת זזים; Delete מוחק; Ctrl+Z מחזיר |
| 8 | "פרסום המבנה" | חלון תצוגה מקדימה עם מה שנוסף / שונה / הוסר; אחרי "פרסם מבנה" הכפתור נעלם |
| 9 | המפה החיה של הקומה | הקירות והפתחים מוצגים; כפתור השכבה "מבנה" מסתיר ומחזיר; ההגדרה נשמרת לקומה |
| 10 | המפה ההיסטורית בזמן לפני הפרסום ואחריו | לפני: בלי המבנה החדש; אחרי: איתו |
| 11 | עמוד של אירוע עם מיקום על המפה | המבנה מוצג במפה של האירוע |
| 12 | כרטיס ה־Lovelace של המפה | המבנה מוצג גם בכרטיס |
| 13 | בפאנל המבנה: SVG, PNG, JSON | שלושה קבצים יורדים; ה־SVG נפתח בדפדפן |
| 14 | משתמש צופה (בלי הרשאת עריכה) פותח את המפה | רואה רק את המבנה המפורסם, לא טיוטה |
| 15 | אופציונלי: גיבוי ושחזור של הפרויקט | המבנה חוזר כפי שהיה |
| 16 | הגדרות ← "מידות לפני כיול" ← "מוסתרות עד כיול", ואז כלי המדידה בגרסת תוכנית שעדיין לא כוילה | במקום מספרים עם ≈ מוצג "לא מכויל"; אחרי החזרה ל"משוערות עם ≈" המספרים חוזרים |

**חשוב לדעת:** טיוטה לא מגיעה לצופים עד הפרסום. שגיאה במבנה (למשל קיר מחוץ לתוכנית) מסומנת באדום, מופיעה ברשימת
הבעיות בפאנל וחוסמת פרסום; לחיצה עליה מביאה לפריט.
```

In `docs/architecture/PLAN_STUDIO_DESIGN_HE.md`, after the status paragraph (the line that ends with `` של `MASTER_SPEC_HE.md` ואת T059. ``) add a blank line and:

```markdown
**מימוש:** שלב 1 (T084) מומש בגרסה 0.1.82; רשימת הבדיקה לבעלים: `docs/operations/PLAN_STUDIO_PHASE1_CHECKLIST_HE.md`.
```

- [ ] **Step 7: Commit the release, merge, push, clean up**

```bash
cd /c/cloude/smplwisebms && git add -A
test "$(bash /c/cloude/smplwisebms/secrets/scan_staged.sh)" = 0 || echo "SECRET SCAN FAILED - do not commit"
git status --short | head -40
msg=$(mktemp) && cat > "$msg" <<'EOF'
release: 0.1.82 - Plan Studio phase 1 (T084, CR-003): structure layer on every map, editor tools, exports

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOF
git commit -F "$msg"
git checkout g0/intake
merge=$(mktemp) && cat > "$merge" <<'EOF'
merge: Plan Studio phase 1 (pilot/T084-plan-studio-1) into g0/intake

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOF
git merge --no-ff -F "$merge" pilot/T084-plan-studio-1
git push origin g0/intake && git push origin g0/intake:main
MSYS_NO_PATHCONV=1 $PY "$SP/ha_store_reload.py" 0.1.82
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/dev_cleanup.ps1 -StopBackend
MSYS_NO_PATHCONV=1 $PY C:/cloude/smplwisebms/scripts/progress.py
```

Expected: `git status` shows only this plan's files (no `private-evidence/`, `secrets/` or `data/`); both pushes succeed; `ha_store_reload.py` prints 0.1.82 or times out (then the owner clicks "בדוק עדכון"); the progress table shows T084 and T059 done.

---

## Self-Review

**1. Spec coverage** (design `PLAN_STUDIO_DESIGN_HE.md`, phase 1 of section 14):

| Design section | Where |
|---|---|
| 2 principles: normalized 0..1, metres only from calibration, nothing published automatically | Global Constraints; Tasks 2, 5, 6, 14 |
| 2a embedded in the map: live map, editor, history at t, event page, Lovelace | Task 11 (live, history, event; Lovelace loads the same floor screen), Task 12 (editor) |
| 4.1 tables 0018 / 0019 | Task 1 (0020 catalog and 0021 mount height are phase 2, T085) |
| 4.2 document v2 incl. `external_ids`, `anchor_ref` | Task 2 (`switch_ref` belongs to circuits, phase 2) |
| 5 API, bundle reference, ETag | Tasks 6, 7 |
| 6 calibration: two points, residual, carried, DXF units, estimated with "≈" | Tasks 2, 5, 6, 13 (the door-width hint is phase 3, T086) |
| 7 editor: walls, openings, snapping, undo, autosave, conflicts, issues | Tasks 10, 12, 14 |
| 8 levels | data only in phase 1 (0019 columns, default level L0); the level UI is phase 2 |
| 11 exports | Task 8 (SVG / PNG), Task 12 (JSON); DXF and plan packages are phase 5 (T088) |
| 12 permissions: map.read / map.edit / map.publish | Tasks 6, 8, 12 (`permissions.structure`) |
| 13 tests: golden fixture, unit, live | Tasks 4, 9, 10, 11–14 |
| backups, audit | Task 7 (backup), Task 6 (geometry.publish, geometry.rollback, geometry.copy, plan.calibrate) |

No phase-1 requirement is left without a task. Recorded interpretations: R167's "metres only when calibrated" is implemented as measured metres only after calibration, with estimates always marked "≈" (design section 6), and the evidence line says so; calibrating bumps `plan_versions.revision` like any other version edit.

**2. Placeholder scan:** every code step carries the full code and every command is exact; the only run-time value (the backend test count) is read by `record_t084.py` from the pytest output file of Task 15 Step 2.

**3. Type and name consistency** (checked across tasks): `structure_primitives` (Python) and `buildPrimitives` (TypeScript) emit the same five shapes and are pinned by `sample-v2.primitives.json`; `GeometryResponse.geometry.revision` is the `base_revision` the controller sends; `StudioController.pendingPublish` drives `[data-publish]`; the bundle field is `permissions.structure` on both sides; canvas events `plan-hover`, `plan-click` (with `shift`), `geom-select`, `geom-drag` match the editor listeners; `RulerOverlay`, `STUDIO_TOOLS`, `CalibState` / `EMPTY_CALIB`, `COLL_LABEL`, `fmtMetres`, `fmtScale`, `fmtArea` are defined before use; the live spec's `ids.asset` is set in `beforeAll`.
