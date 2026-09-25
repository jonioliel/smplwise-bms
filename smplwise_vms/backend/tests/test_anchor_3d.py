"""Plan Studio phase 4 (T087, ruling R-P4-8): migration 0021 gives map anchors a mount height and a tilt; the routes
validate them (0-30 m, -90..90 deg), an explicit null clears them, they travel in every anchor answer and in the map
bundle, defaults are never stored, and the audit records them like every other anchor field."""
from __future__ import annotations

import sqlite3

from conftest import png_bytes, seed_tree
from fastapi.testclient import TestClient

from smplwise.main import create_app


def _cols(conn: sqlite3.Connection, table: str) -> set[str]:
    return {r[1] for r in conn.execute(f"PRAGMA table_info({table})").fetchall()}


def test_migration_0021_adds_the_3d_columns(settings):
    app = create_app(settings)
    with app.state.db.connection() as conn:
        assert {"mount_height_m", "tilt_deg"} <= _cols(conn, "map_anchors")
        assert conn.execute("SELECT MAX(version) FROM schema_migrations").fetchone()[0] >= 21


def _floor_with_plan(c: TestClient) -> dict:
    ids = seed_tree(c)
    asset = c.post(f"/api/v1/floors/{ids['floor2']}/plan-assets", files={"file": ("plan.png", png_bytes(), "image/png")}).json()
    v = c.post(f"/api/v1/floors/{ids['floor2']}/plan-versions", json={"asset_id": asset["id"]}).json()
    assert c.post(f"/api/v1/plan-versions/{v['id']}/publish").status_code == 200
    return ids


def test_mount_height_and_tilt_round_trip_validate_clear_and_audit(settings):
    app = create_app(settings)
    with TestClient(app) as c:
        ids = _floor_with_plan(c)
        cam = c.post("/api/v1/cameras", json={"channel": 4, "alias": "לובי"}).json()
        cam2 = c.post("/api/v1/cameras", json={"channel": 5, "alias": "חניה"}).json()
        r = c.post(f"/api/v1/floors/{ids['floor2']}/anchors", json={"resource_type": "camera", "resource_id": cam["id"], "x": 0.3, "y": 0.4, "rotation_degrees": 90, "field_of_view_degrees": 100, "mount_height_m": 3.2, "tilt_deg": 15})
        assert r.status_code == 201, r.text
        a = r.json()
        assert a["mount_height_m"] == 3.2 and a["tilt_deg"] == 15
        # defaults are the clients' business: an anchor created without the fields answers null, nothing is stored
        r = c.post(f"/api/v1/floors/{ids['floor2']}/anchors", json={"resource_type": "camera", "resource_id": cam2["id"], "x": 0.6, "y": 0.4})
        assert r.status_code == 201, r.text
        assert r.json()["mount_height_m"] is None and r.json()["tilt_deg"] is None
        # the list and the map bundle carry the fields
        listed = {x["id"]: x for x in c.get(f"/api/v1/floors/{ids['floor2']}/anchors").json()["anchors"]}
        assert listed[a["id"]]["mount_height_m"] == 3.2 and listed[a["id"]]["tilt_deg"] == 15
        bundle = {x["id"]: x for x in c.get(f"/api/v1/floors/{ids['floor2']}/map").json()["anchors"]}
        assert bundle[a["id"]]["mount_height_m"] == 3.2 and bundle[a["id"]]["tilt_deg"] == 15
        # validation on both routes
        for body in ({"mount_height_m": -0.1}, {"mount_height_m": 30.5}, {"tilt_deg": 90.5}, {"tilt_deg": -91}):
            assert c.patch(f"/api/v1/map-anchors/{a['id']}", json={"revision": a["revision"], **body}).status_code == 422, body
            assert c.post(f"/api/v1/floors/{ids['floor2']}/anchors", json={"resource_type": "camera", "resource_id": cam2["id"], "x": 0.1, "y": 0.1, **body}).status_code == 422, body
        # a patch changes both and bumps the revision
        r = c.patch(f"/api/v1/map-anchors/{a['id']}", json={"revision": a["revision"], "tilt_deg": -5, "mount_height_m": 2.8})
        assert r.status_code == 200, r.text
        a = r.json()
        assert a["tilt_deg"] == -5 and a["mount_height_m"] == 2.8 and a["revision"] == 2
        # an explicit null clears; an absent key leaves the value alone
        r = c.patch(f"/api/v1/map-anchors/{a['id']}", json={"revision": a["revision"], "tilt_deg": None, "label": "לובי צפון"})
        assert r.status_code == 200, r.text
        a = r.json()
        assert a["tilt_deg"] is None and a["mount_height_m"] == 2.8 and a["label"] == "לובי צפון"
        # the audit carries the before / after of the fields like every other anchor field
        rows = c.get("/api/v1/audit?prefix=anchor.update&limit=10").json()["rows"]
        assert any(x["details"].get("after", {}).get("tilt_deg") == -5 and x["details"]["before"].get("tilt_deg") == 15 for x in rows), rows
        assert any(x["details"].get("after", {}).get("tilt_deg", "absent") is None for x in rows), rows


def test_patch_null_clears_the_label_and_the_cone_and_a_no_op_patch_changes_nothing(settings):
    """Ruling R-P4-T3-1: an explicit null clears the label and the field of view (a reload keeps them cleared); a
    patch that changes nothing bumps no revision and writes no audit row."""
    app = create_app(settings)
    with TestClient(app) as c:
        ids = _floor_with_plan(c)
        cam = c.post("/api/v1/cameras", json={"channel": 6, "alias": "מסדרון"}).json()
        a = c.post(f"/api/v1/floors/{ids['floor2']}/anchors", json={"resource_type": "camera", "resource_id": cam["id"], "x": 0.5, "y": 0.5, "field_of_view_degrees": 90, "label": "מסדרון מערב"}).json()
        r = c.patch(f"/api/v1/map-anchors/{a['id']}", json={"revision": a["revision"], "label": None, "field_of_view_degrees": None})
        assert r.status_code == 200, r.text
        assert r.json()["label"] is None and r.json()["field_of_view_degrees"] is None and r.json()["revision"] == 2
        reloaded = {x["id"]: x for x in c.get(f"/api/v1/floors/{ids['floor2']}/map").json()["anchors"]}[a["id"]]
        assert reloaded["label"] is None and reloaded["field_of_view_degrees"] is None
        audits = lambda: [x for x in c.get("/api/v1/audit?prefix=anchor.update&limit=50").json()["rows"] if x["details"].get("anchor_id") == a["id"]]  # noqa: E731
        n = len(audits())
        # the same values again, an empty body and the same x: no change, no revision bump, no audit row
        for body in ({"label": None}, {}, {"x": 0.5, "field_of_view_degrees": None}):
            r = c.patch(f"/api/v1/map-anchors/{a['id']}", json={"revision": 2, **body})
            assert r.status_code == 200, (body, r.text)
            assert r.json()["revision"] == 2, body
        assert len(audits()) == n
        # a real change still bumps and audits only the changed field
        r = c.patch(f"/api/v1/map-anchors/{a['id']}", json={"revision": 2, "x": 0.5, "y": 0.25})
        assert r.json()["revision"] == 3
        rows = audits()
        assert len(rows) == n + 1 and rows[0]["details"]["after"] == {"y": 0.25}, rows[0]


def test_a_viewer_cannot_patch_the_mount_height(settings):
    from conftest import as_user, bind

    app = create_app(settings)
    with TestClient(app) as c:
        ids = _floor_with_plan(c)
        cam = c.post("/api/v1/cameras", json={"channel": 7, "alias": "כניסה"}).json()
        a = c.post(f"/api/v1/floors/{ids['floor2']}/anchors", json={"resource_type": "camera", "resource_id": cam["id"], "x": 0.2, "y": 0.2}).json()
        bind(c, settings, "ron", "viewer", "floor", ids["floor2"])
        r = c.patch(f"/api/v1/map-anchors/{a['id']}", json={"revision": a["revision"], "mount_height_m": 2.0}, headers=as_user("ron"))
        assert r.status_code == 403, r.text
        # the viewer still reads the map and sees the value unchanged
        seen = {x["id"]: x for x in c.get(f"/api/v1/floors/{ids['floor2']}/map", headers=as_user("ron")).json()["anchors"]}
        assert seen[a["id"]]["mount_height_m"] is None


def test_the_history_bundle_carries_the_mount_height_and_the_tilt(settings):
    app = create_app(settings)
    with TestClient(app) as c:
        ids = _floor_with_plan(c)
        cam = c.post("/api/v1/cameras", json={"channel": 8, "alias": "מחסן"}).json()
        a = c.post(f"/api/v1/floors/{ids['floor2']}/anchors", json={"resource_type": "camera", "resource_id": cam["id"], "x": 0.4, "y": 0.6, "mount_height_m": 2.6, "tilt_deg": 20}).json()
        hist = c.get(f"/api/v1/floors/{ids['floor2']}/map?at=2099-01-01T00:00:00Z").json()
        assert hist["history"] == "exact"
        got = {x["id"]: x for x in hist["anchors"]}[a["id"]]
        assert got["mount_height_m"] == 2.6 and got["tilt_deg"] == 20


def test_a_populated_database_from_before_0021_upgrades(settings, tmp_path, monkeypatch):
    """A database created at migration 0020 with a placed camera: 0021 applies on top, the anchor reads back with null
    3D fields (the kind's defaults) and a patch can set them."""
    import shutil

    from smplwise import db as dbmod

    old_dir = tmp_path / "migrations_0020"
    old_dir.mkdir()
    for f in sorted(dbmod.MIGRATIONS_DIR.glob("*.sql")):
        if int(f.name.split("_", 1)[0]) <= 20:
            shutil.copy(f, old_dir / f.name)
    real_dir = dbmod.MIGRATIONS_DIR
    monkeypatch.setattr(dbmod, "MIGRATIONS_DIR", old_dir)
    with TestClient(create_app(settings)) as c:
        ids = _floor_with_plan(c)
        cam = c.post("/api/v1/cameras", json={"channel": 9, "alias": "גג"}).json()
    with dbmod.Database(settings.db_path).connection() as conn:
        assert "mount_height_m" not in _cols(conn, "map_anchors")
        assert conn.execute("SELECT MAX(version) FROM schema_migrations").fetchone()[0] == 20
        version_id = conn.execute("SELECT id FROM plan_versions WHERE floor_id = ? AND status = 'published'", (ids["floor2"],)).fetchone()[0]
        now = dbmod.now_iso()
        conn.execute(
            """INSERT INTO map_anchors(id, floor_id, plan_version_id, resource_type, resource_id, x, y, rotation_degrees, field_of_view_degrees, layer_id, label, revision, effective_from, created_by, updated_by, updated_at)
               VALUES ('old-anchor', ?, ?, 'camera', ?, 0.3, 0.3, 45, 90, 'cameras', 'ישן', 1, ?, 'test', 'test', ?)""",
            (ids["floor2"], version_id, cam["id"], now, now),
        )
    monkeypatch.setattr(dbmod, "MIGRATIONS_DIR", real_dir)
    with TestClient(create_app(settings)) as c:
        got = {x["id"]: x for x in c.get(f"/api/v1/floors/{ids['floor2']}/map").json()["anchors"]}["old-anchor"]
        assert got["label"] == "ישן" and got["rotation_degrees"] == 45
        assert got["mount_height_m"] is None and got["tilt_deg"] is None
        r = c.patch("/api/v1/map-anchors/old-anchor", json={"revision": 1, "mount_height_m": 3.4})
        assert r.status_code == 200, r.text
        assert r.json()["mount_height_m"] == 3.4 and r.json()["revision"] == 2
