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
    c.patch(f"/api/v1/plan-versions/{v1}/calibration", json={"pairs": [{"a": [0.1, 0.5], "b": [0.6, 0.5], "metres": 8.0}]})
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
    # the restored version keeps its calibration record (method, pairs), not only the scale
    back = c.get(f"/api/v1/plan-versions/{restored}").json()
    assert back["calibration"]["method"] == "two_point" and abs(back["scale_m_per_px"] - 0.025) < 1e-9, back


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
