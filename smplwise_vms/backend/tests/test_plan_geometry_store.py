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
from smplwise.services import plan_geometry as pg

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


def test_carry_takes_only_a_published_structure(settings):
    """R-T7-2: a work-in-progress draft of the source version is not carried (publishing the new plan version would
    publish it); the editor can still copy it by hand."""
    app, vid = _setup(settings)
    with app.state.db.connection() as conn:
        v = _version(conn, vid)
        doc, _ = store.working_doc(conn, v)
        store.save_draft(conn, v, _with(doc, WALL), 0, "u")
        same = _clone(conn, _version(conn, vid))
        assert store.carry(conn, same, "u") == "none" and store.draft_row(conn, same["id"]) is None
        assert store.load_doc(store.copy_from(conn, same, _version(conn, vid), "u"))["walls"][0]["id"] == "w1", "copy_from stays available"


def test_copy_from_maps_a_recrop_and_refuses_an_empty_source(settings):
    app, vid = _setup(settings)
    with app.state.db.connection() as conn:
        v = _version(conn, vid)
        doc, _ = store.working_doc(conn, v)
        store.save_draft(conn, v, _with(doc, WALL), 0, "u")
        store.publish(conn, v, "u")
        half = _clone(conn, _version(conn, vid), crop={"x": 0.0, "y": 0.0, "w": 0.5, "h": 1.0}, width=640)
        mapped = store.load_doc(store.copy_from(conn, half, _version(conn, vid), "u"))
        assert mapped["walls"][0]["polyline"] == [[0.2, 0.2], [1.0, 0.2]], "a manual copy maps a re-crop of the same page as carry does"
        assert any("חיתוך" in n for n in mapped["uncertainty"]["notes"])
        explicit = _clone(conn, _version(conn, vid), crop={"x": 0.0, "y": 0.0, "w": 1.0, "h": 1.0})
        assert store.carry(conn, explicit, "u") == "copied", "an explicit full crop is the same crop as none"
        assert not any("חיתוך" in n for n in store.load_doc(store.draft_row(conn, explicit["id"]))["uncertainty"]["notes"])
        blank = _clone(conn, _version(conn, vid))
        store.save_draft(conn, blank, pg.new_document(blank, None), 0, "u")
        with pytest.raises(ApiError) as e:
            store.copy_from(conn, _clone(conn, _version(conn, vid)), blank, "u")
        assert e.value.code == "nothing_to_copy"
