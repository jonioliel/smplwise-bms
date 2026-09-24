"""Plan Studio in the rest of the product (T084): the map bundle carries a reference (not the document), the historical
map gets the structure of its instant, plan versions carry / publish / restore / delete their structure, and a backup
restores it."""
from __future__ import annotations

import datetime as dt
import io
import zipfile
from dataclasses import replace

from conftest import as_user, png_bytes, seed_tree
from fastapi.testclient import TestClient

from smplwise.main import create_app
from smplwise.services import geometry_store as store

FMT = "%Y-%m-%dT%H:%M:%SZ"
WALL = {"id": "w1", "level_id": "L0", "polyline": [[0.1, 0.2], [0.6, 0.2]], "thickness_m": 0.2, "height_m": None, "base_z_m": 0, "kind": "interior",
        "confidence": 1, "source": "manual", "locked": False, "external_ids": {}}
DOOR = {"id": "d1", "wall_id": "w1", "t": 0.5, "kind": "door", "width_m": 0.9, "height_m": 2.1, "sill_m": 0, "swing": "right", "hinge": "start",
        "anchor_ref": None, "confidence": 1, "source": "manual", "external_ids": {}}


def _setup(settings):
    app = create_app(settings)
    c = TestClient(app)
    ids = seed_tree(c)
    asset = c.post(f"/api/v1/floors/{ids['floor2']}/plan-assets", files={"file": ("plan.png", png_bytes(), "image/png")}).json()
    v = c.post(f"/api/v1/floors/{ids['floor2']}/plan-versions", json={"asset_id": asset["id"]}).json()
    assert c.post(f"/api/v1/plan-versions/{v['id']}/publish").status_code == 200
    return app, c, ids, v["id"], asset["id"]


def _put(c, vid, walls, openings=None):
    g = c.get(f"/api/v1/plan-versions/{vid}/geometry?draft=true").json()
    doc = dict(g["doc"], walls=walls) if openings is None else dict(g["doc"], walls=walls, openings=openings)
    r = c.put(f"/api/v1/plan-versions/{vid}/geometry", json={"doc": doc, "base_revision": g["geometry"]["revision"]})
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


def test_the_draft_reference_needs_map_edit(settings):
    """R-T7-3: placement.edit without map.edit cannot load the draft document, so the bundle hands it the published
    reference; permissions.structure says whether the structure editor is open to the user."""
    app, c, ids, vid, _ = _setup(settings)
    f2 = ids["floor2"]
    _put(c, vid, [WALL])
    c.post(f"/api/v1/plan-versions/{vid}/geometry/publish")
    _put(c, vid, [dict(WALL, thickness_m=0.3)])
    role = c.post("/api/v1/access/roles", json={"name": "הצבה בלבד", "permissions": ["map.read", "placement.edit"]}).json()
    c.get("/api/v1/me", headers=as_user("placer"))
    b = c.post("/api/v1/access/bindings", json={"subject_kind": "user", "subject_id": "dev-placer", "role_id": role["id"], "scope_type": "floor", "scope_id": f2})
    assert b.status_code == 201, b.text
    placer = c.get(f"/api/v1/floors/{f2}/map?draft=true", headers=as_user("placer")).json()
    assert placer["geometry"]["status"] == "published", "placement.edit alone gets the published reference, not the draft"
    assert placer["permissions"]["edit"] is True and placer["permissions"]["structure"] is False
    assert c.get(f"/api/v1/plan-versions/{vid}/geometry?draft=true", headers=as_user("placer")).status_code == 403, "the draft document needs map.edit"
    admin = c.get(f"/api/v1/floors/{f2}/map?draft=true").json()
    assert admin["geometry"]["status"] == "draft" and admin["permissions"]["structure"] is True


def test_a_recropped_version_publishes_what_fits(settings):
    """Review of c6c35fc, end to end: an uncalibrated structure with a wall across the future crop edge and two doors -
    one well inside, one centred 0.167 m inside that edge - becomes a re-cropped plan version that publishes at once. The
    new version keeps the source's estimated metres, the door that fits (moved to t 0.15 on the cut wall) and a note
    for the one that does not."""
    app, c, ids, v1, asset_id = _setup(settings)
    _put(c, v1, [dict(WALL, polyline=[[0.3, 0.2], [0.9, 0.2]])], [dict(DOOR, id="d_in", t=0.05), dict(DOOR, id="d_edge", t=0.325)])
    assert c.post(f"/api/v1/plan-versions/{v1}/geometry/publish").json()["unchanged"] is False
    half = c.post(f"/api/v1/floors/{ids['floor2']}/plan-versions", json={"asset_id": asset_id, "crop": {"x": 0, "y": 0, "w": 0.5, "h": 1}}).json()
    assert half["geometry_carry"] == "transformed"
    assert c.post(f"/api/v1/plan-versions/{half['id']}/publish").status_code == 200
    pub = c.get(f"/api/v1/plan-versions/{half['id']}/geometry").json()
    assert [(o["id"], o["t"]) for o in pub["doc"]["openings"]] == [("d_in", 0.15)], "d_edge: t' 0.975 on 6.667 m, 6.05..6.95 m"
    assert [i for i in pub["issues"] if i["severity"] == "error"] == [] and pub["doc"]["uncertainty"]["notes"] == ["פריט אחד שמחוץ לחיתוך החדש הושמט."]
    assert pub["doc"]["dimensions"]["calibration"]["status"] == "estimated"
    assert abs(half["scale_m_per_px"] - 0.2 / (0.006 * 640)) < 1e-9, "320 px for half of the 640 px page: the same estimated metres per pixel"


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
    with app.state.db.connection() as conn:
        audited = dict(conn.execute("SELECT json_extract(details_json, '$.version_id'), json_extract(details_json, '$.geometry_carry') FROM audit_log "
                                    "WHERE action = 'plan.version.create'").fetchall())
    assert [audited[x["id"]] for x in (same, half, turned)] == ["copied", "transformed", "none"], "the create audit records the carry the response reported"
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
    assert c.get(f"/api/v1/plan-versions/{same['id']}").json()["status"] == "published", "the floor's published plan is untouched"
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


def test_a_backup_without_structure_restores_over_one(settings):
    """R-T7-1: a backup written before this release has no data/plan_geometry.json. Restoring it in replace mode over
    a database with a published structure empties plan_geometry too (the restored project equals the backup) instead
    of failing on the structure's foreign key to plan_versions."""
    app, c, ids, vid, _ = _setup(settings)
    e = c.post("/api/v1/backups", json={"note": "before Plan Studio"}).json()
    _put(c, vid, [WALL])
    assert c.patch(f"/api/v1/plan-versions/{vid}/calibration", json={"pairs": [{"a": [0.1, 0.5], "b": [0.6, 0.5], "metres": 8.0}]}).status_code == 200
    c.post(f"/api/v1/plan-versions/{vid}/geometry/publish")
    assert c.get(f"/api/v1/plan-versions/{vid}/geometry").status_code == 200 and c.get(f"/api/v1/plan-versions/{vid}").json()["scale_m_per_px"]
    old = io.BytesIO()
    with zipfile.ZipFile(io.BytesIO(c.get(f"/api/v1/backups/{e['name']}/download").content)) as src, zipfile.ZipFile(old, "w") as dst:
        for item in src.infolist():
            if item.filename != "data/plan_geometry.json":
                dst.writestr(item, src.read(item))
    up = c.post("/api/v1/backups/upload", files={"file": ("old.zip", old.getvalue(), "application/zip")}).json()
    r = c.post(f"/api/v1/backups/{up['name']}/restore", json={"mode": "replace", "scope": "project", "confirm": "RESTORE"})
    assert r.status_code == 200, r.text
    assert c.get(f"/api/v1/plan-versions/{vid}/geometry").status_code == 404, "the structure drawn after the backup is gone"
    back = c.get(f"/api/v1/plan-versions/{vid}").json()
    assert back["status"] == "published" and back["scale_m_per_px"] is None, "the plan version is the one in the backup"
    with app.state.db.connection() as conn:
        assert conn.execute("SELECT COUNT(*) FROM plan_geometry").fetchone()[0] == 0, "its draft too"
