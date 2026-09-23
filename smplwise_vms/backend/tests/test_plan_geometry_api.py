"""Plan Studio API (T084): the draft round trip with revisions, publish and what viewers see (ETag, 304), permissions,
diff / versions / timeline / rollback, copy from another version, and the two-point calibration."""
from __future__ import annotations

import datetime as dt

import pytest
from conftest import as_user, bind, png_bytes, seed_tree
from fastapi.testclient import TestClient

from smplwise.main import create_app
from smplwise.services.timeutil import parse_utc

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


def test_the_structure_of_an_instant_and_a_bad_instant(settings):
    """?at= serves the structure published at that instant with its ETag; an instant the UTC conversion cannot
    represent (an extreme offset overflows) is the same 422 as a malformed one, not a 500 (R-T6-1), and so it is on
    the map bundle's ?at=, through parse_utc (R-T7b-1)."""
    app, c, ids, vid, _ = _setup(settings)
    _save(c, vid, [WALL], 0)
    pub = c.post(f"/api/v1/plan-versions/{vid}/geometry/publish").json()["published"]
    ok = c.get(f"/api/v1/plan-versions/{vid}/geometry", params={"at": pub["published_at"]})
    assert ok.status_code == 200 and ok.headers["etag"] == f'"{pub["doc_hash"]}"' and ok.json()["geometry"]["id"] == pub["id"]
    for bad in ("9999-12-31T23:59:59-01:00", "0001-01-01T00:00:00+01:00", "yesterday"):
        r = c.get(f"/api/v1/plan-versions/{vid}/geometry", params={"at": bad})
        assert r.status_code == 422 and r.json()["code"] == "validation", bad
        m = c.get(f"/api/v1/floors/{ids['floor2']}/map", params={"at": bad})
        assert m.status_code == 422 and m.json()["code"] == "validation", bad


def test_parse_utc_refuses_an_instant_it_cannot_convert():
    """R-T7b-1: an instant the UTC conversion cannot represent is a ValueError like a malformed one, so a route that
    answers a ValueError from parse_utc with 422 does so for it too, instead of a 500."""
    for bad in ("9999-12-31T23:59:59-01:00", "0001-01-01T00:00:00+01:00"):
        with pytest.raises(ValueError):
            parse_utc(bad)
    assert parse_utc("9999-12-31T23:59:59+01:00") == dt.datetime(9999, 12, 31, 22, 59, 59, tzinfo=dt.timezone.utc), "the edge itself converts"


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
