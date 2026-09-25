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
