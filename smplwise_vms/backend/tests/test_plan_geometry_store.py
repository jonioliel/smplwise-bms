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
DOOR = {"id": "d1", "wall_id": "w1", "t": 0.5, "kind": "door", "width_m": 0.9, "height_m": 2.1, "sill_m": 0, "swing": "right", "hinge": "start",
        "anchor_ref": None, "confidence": 1, "source": "manual", "external_ids": {}}
HALF = {"x": 0.0, "y": 0.0, "w": 0.5, "h": 1.0}


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
    publish it); the editor can still copy it by hand. The calibration belongs to the published plan version, not to
    its structure, so a new version of the same drawing takes it when the source has only a draft structure, or none
    (review of 80249d1)."""
    app, vid = _setup(settings)
    with app.state.db.connection() as conn:
        conn.execute("UPDATE plan_versions SET scale_m_per_px = 0.02 WHERE id = ?", (vid,))
        v = _version(conn, vid)
        bare = _clone(conn, v)
        assert store.carry(conn, bare, "u") == "none" and _version(conn, bare["id"])["scale_m_per_px"] == pytest.approx(0.02), "no structure at all"
        doc, _ = store.working_doc(conn, v)
        store.save_draft(conn, v, _with(doc, WALL), 0, "u")
        same = _clone(conn, v)
        assert store.carry(conn, same, "u") == "none" and store.draft_row(conn, same["id"]) is None
        half = _clone(conn, v, crop={"x": 0.0, "y": 0.0, "w": 0.5, "h": 1.0}, width=640)
        assert store.carry(conn, half, "u") == "none" and store.draft_row(conn, half["id"]) is None
        assert _version(conn, half["id"])["scale_m_per_px"] == pytest.approx(0.01), "0.02 x (640 x 0.5) / (1.0 x 640)"
        assert json.loads(_version(conn, half["id"])["calibration_json"])["method"] == "carried"
        assert store.load_doc(store.copy_from(conn, same, _version(conn, vid), "u"))["walls"][0]["id"] == "w1", "copy_from stays available"


def test_carry_prunes_what_does_not_fit_the_new_version(settings):
    """Review of c6c35fc: the carried structure is judged in the new version's own pixels and metres, as its publish
    will judge it. The source's only door is centred 0.256 m inside the new crop's edge: its 0.9 m do not fit the cut
    wall, so it goes, with one note, and the new version's structure is publishable."""
    app, vid = _setup(settings)
    with app.state.db.connection() as conn:
        conn.execute("UPDATE plan_versions SET scale_m_per_px = 0.02 WHERE id = ?", (vid,))
        v = _version(conn, vid)
        doc, _ = store.working_doc(conn, v)
        d = _with(doc, dict(WALL, polyline=[[0.3, 0.2], [0.9, 0.2]]))  # 384 px = 7.68 m
        d["openings"] = [dict(DOOR, t=0.3)]  # centre 2.304 m, at page x 0.48
        store.save_draft(conn, v, d, 0, "u")
        assert store.publish(conn, v, "u")["unchanged"] is False
        half = _clone(conn, v, crop=HALF, width=640)
        assert store.carry(conn, half, "u") == "transformed"
        carried = store.load_doc(store.draft_row(conn, half["id"]))
        assert carried["walls"][0]["polyline"] == [[0.6, 0.2], [1.0, 0.2]] and carried["openings"] == [], "t' 0.9 on 2.56 m: 1.854..2.754 m"
        assert carried["uncertainty"]["notes"] == ["פריט אחד שמחוץ לחיתוך החדש הושמט."]
        assert store.pending_doc(conn, _version(conn, half["id"])) is not None, "no 422: the new version publishes"


def test_an_uncalibrated_source_passes_on_its_estimated_scale(settings):
    """Review of c6c35fc: before anyone calibrates, a re-crop keeps metres consistent - the new version takes the
    source's estimated scale through the crop formula, recorded as carried and estimated, so its document still says
    estimated (the UI shows the approximate sign); a version carried on from it stays estimated."""
    app, vid = _setup(settings)
    with app.state.db.connection() as conn:
        v = _version(conn, vid)
        doc, _ = store.working_doc(conn, v)
        store.save_draft(conn, v, _with(doc, WALL), 0, "u")
        store.publish(conn, v, "u")
        half = _clone(conn, v, crop=HALF, width=640)
        assert store.carry(conn, half, "u") == "transformed"
        est = pg.DEFAULT_WALL_THICKNESS_M / (pg.ESTIMATED_WALL_FRACTION * 640)  # the source's own estimate, 0.0521 m/px
        half = _version(conn, half["id"])
        assert half["scale_m_per_px"] == pytest.approx(est * (640 * 0.5) / (1.0 * 640))
        rec = json.loads(half["calibration_json"])
        assert (rec["method"], rec["status"]) == ("carried", "estimated")
        dims = store.load_doc(store.draft_row(conn, half["id"]))["dimensions"]
        assert dims["calibration"]["status"] == "estimated" and dims["scale_m_per_px"] == round(half["scale_m_per_px"], 6), "stored as canonical JSON"
        conn.execute("UPDATE plan_versions SET status = 'archived' WHERE id = ?", (vid,))
        conn.execute("UPDATE plan_versions SET status = 'published' WHERE id = ?", (half["id"],))
        quarter = _clone(conn, half, crop={"x": 0.0, "y": 0.0, "w": 0.25, "h": 1.0}, width=640)
        store.carry(conn, quarter, "u")
        q = _version(conn, quarter["id"])
        assert json.loads(q["calibration_json"]).get("status") == "estimated", "carried on from an estimate, it stays one"
        assert q["scale_m_per_px"] * 640 / 0.25 == pytest.approx(est * 640), "the page is as wide in metres as the first estimate made it"


def test_copy_from_another_drawing_copies_as_it_is(settings):
    """Review of af47d01: a copy from another drawing transforms nothing, so it prunes nothing and carries no
    calibration - a door valid in its measured source stays, although the uncalibrated target's own estimate would not
    fit it (the validator flags it in the editor instead)."""
    app, vid = _setup(settings)
    with app.state.db.connection() as conn:
        conn.execute("UPDATE plan_versions SET scale_m_per_px = 0.1 WHERE id = ?", (vid,))
        v = _version(conn, vid)
        doc, _ = store.working_doc(conn, v)
        d = _with(doc, dict(WALL, polyline=[[0.1, 0.2], [0.15, 0.2]]))  # 32 px = 3.2 m at 0.1 m/px
        d["openings"] = [dict(DOOR, t=0.2)]  # centre 0.64 m: 0.19..1.09 m
        store.save_draft(conn, v, d, 0, "u")
        turned = _clone(conn, v, rotation=90)
        copied = store.load_doc(store.copy_from(conn, turned, v, "u"))
        assert [o["id"] for o in copied["openings"]] == ["d1"] and not any("הושמט" in n for n in copied["uncertainty"]["notes"])
        assert _version(conn, turned["id"])["scale_m_per_px"] is None and _version(conn, turned["id"])["calibration_json"] is None


def test_copy_from_the_same_drawing_and_crop_copies_as_it_is_with_the_calibration(settings):
    """Review of af47d01: the same drawing and crop transforms nothing either, so nothing is pruned - a draft door that
    overruns its wall stays, t unchanged, for the validator to flag in the editor - and an uncalibrated target first
    takes the source's calibration, as carry does, so the copy is judged in the source's metric."""
    app, vid = _setup(settings)
    with app.state.db.connection() as conn:
        conn.execute("UPDATE plan_versions SET scale_m_per_px = 0.02 WHERE id = ?", (vid,))
        v = _version(conn, vid)
        doc, _ = store.working_doc(conn, v)
        d = _with(doc, WALL)  # 320 px = 6.4 m
        d["openings"] = [dict(DOOR, t=0.95)]  # centre 6.08 m: 5.63..6.53 m, past the end
        store.save_draft(conn, v, d, 0, "u")
        same = _clone(conn, v)
        copied = store.load_doc(store.copy_from(conn, same, v, "u"))
        assert [(o["id"], o["t"]) for o in copied["openings"]] == [("d1", 0.95)] and not any("הושמט" in n for n in copied["uncertainty"]["notes"])
        assert ("opening_outside_wall", "d1") in {(i["code"], i["id"]) for i in pg.validate(copied)}, "flagged in the editor, not deleted"
        same = _version(conn, same["id"])
        assert same["scale_m_per_px"] == pytest.approx(0.02) and json.loads(same["calibration_json"])["method"] == "carried"


def test_copy_from_a_recrop_takes_the_calibration_before_it_prunes(settings):
    """Review of af47d01: a re-crop of the same drawing into an uncalibrated target first takes the source's
    calibration (0.02 m/px through the half crop: 0.01 m/px), then prunes only what the re-crop made unfit in that
    metric: the door straddling the cut goes, the door well inside the cut wall stays."""
    app, vid = _setup(settings)
    with app.state.db.connection() as conn:
        conn.execute("UPDATE plan_versions SET scale_m_per_px = 0.02 WHERE id = ?", (vid,))
        v = _version(conn, vid)
        doc, _ = store.working_doc(conn, v)
        d = _with(doc, dict(WALL, polyline=[[0.3, 0.2], [0.9, 0.2]]))  # 384 px = 7.68 m
        d["openings"] = [dict(DOOR, id="d_in", t=0.15), dict(DOOR, id="d_edge", t=0.3)]  # centres 1.152 m and 2.304 m (page x 0.48)
        store.save_draft(conn, v, d, 0, "u")
        half = _clone(conn, v, crop=HALF, width=640)
        copied = store.load_doc(store.copy_from(conn, half, v, "u"))
        assert _version(conn, half["id"])["scale_m_per_px"] == pytest.approx(0.01)
        assert [(o["id"], o["t"]) for o in copied["openings"]] == [("d_in", 0.45)], "on the 2.56 m cut wall: d_in 0.702..1.602 m, d_edge 1.854..2.754 m"
        assert copied["uncertainty"]["notes"] == ["פריט אחד שמחוץ לחיתוך החדש הושמט."]
        assert [i for i in pg.validate(copied) if i["severity"] == "error"] == []


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
        assert not any("הוצמדו" in n for n in mapped["uncertainty"]["notes"]), "the wall is cut at the crop's edge, not clamped: no clamp note"
        explicit = _clone(conn, _version(conn, vid), crop={"x": 0.0, "y": 0.0, "w": 1.0, "h": 1.0})
        assert store.carry(conn, explicit, "u") == "copied", "an explicit full crop is the same crop as none"
        assert not any("חיתוך" in n for n in store.load_doc(store.draft_row(conn, explicit["id"]))["uncertainty"]["notes"])
        blank = _clone(conn, _version(conn, vid))
        store.save_draft(conn, blank, pg.new_document(blank, None), 0, "u")
        with pytest.raises(ApiError) as e:
            store.copy_from(conn, _clone(conn, _version(conn, vid)), blank, "u")
        assert e.value.code == "nothing_to_copy"
