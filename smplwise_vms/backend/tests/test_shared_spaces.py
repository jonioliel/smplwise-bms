"""Shared space (CR-009, T093): the owner's double-height sports hall, drawn twice today (floor 2 holds the court, floor 3
the tribunes' top), becomes ONE room that belongs to both floors. The home floor (the court's) keeps everything; the
other floor shows it whole on every read - computed, never stored or hashed - edits it (routed to the home draft), and
its readers reach the hall's cameras and devices, and nothing else of the home floor. Deny still wins."""
from __future__ import annotations

import json
import math
from typing import Any

import pytest
from conftest import as_user, png_bytes, seed_tree
from fastapi.testclient import TestClient

from smplwise.db import Database, new_id, now_iso, permission_revision
from smplwise.main import create_app
from smplwise.rbac import Principal
from smplwise.services import ha_scope, ha_sync
from smplwise.services import shared_spaces as ss
from smplwise.services.access import camera_scope

HALL = [{"x": 0.2, "y": 0.2}, {"x": 0.6, "y": 0.2}, {"x": 0.6, "y": 0.6}, {"x": 0.2, "y": 0.6}]


def WALL(wid: str, pts: list[list[float]], **kw: Any) -> dict:
    w = {"id": wid, "level_id": "L0", "polyline": pts, "thickness_m": 0.2, "height_m": None, "base_z_m": 0, "kind": "interior", "confidence": 1, "source": "manual", "locked": False}
    w.update(kw)
    return w


def OBJ(oid: str, pos: list[float], item: str = "chair.basic", **kw: Any) -> dict:
    o = {"id": oid, "item_id": item, "level_id": "L0", "position": pos, "rotation_deg": 0, "size": {"w_m": 0.5, "d_m": 0.5, "h_m": 0.9}, "z_m": 0, "params": {}, "label": None,
         "anchor_ref": None, "group_id": None, "confidence": 1, "source": "manual", "locked": False}
    o.update(kw)
    return o


def DOOR(oid: str, wall: str, t: float) -> dict:
    return {"id": oid, "wall_id": wall, "t": t, "kind": "door", "width_m": 0.9, "height_m": 2.1, "sill_m": 0, "swing": "right", "hinge": "start", "anchor_ref": None, "confidence": 1, "source": "manual"}


def _binding(settings, user: str, role: str, scope_type: str, scope_id: str, effect: str = "allow") -> str:
    bid = new_id()
    with Database(settings.db_path).connection() as conn:
        conn.execute("INSERT INTO bindings(id, subject_kind, subject_id, role_id, scope_type, scope_id, effect, permission_revision, assigned_by, created_at) VALUES (?, 'user', ?, ?, ?, ?, ?, ?, 'test', ?)",
                     (bid, f"dev-{user}", role, scope_type, scope_id, effect, permission_revision(conn), now_iso()))
    return bid


def _plan(c: TestClient, floor_id: str, png: bytes | None = None) -> str:
    asset = c.post(f"/api/v1/floors/{floor_id}/plan-assets", files={"file": ("plan.png", png or png_bytes(), "image/png")}).json()
    v = c.post(f"/api/v1/floors/{floor_id}/plan-versions", json={"asset_id": asset["id"]}).json()
    assert c.post(f"/api/v1/plan-versions/{v['id']}/publish").status_code == 200
    return v["id"]


def _draft(c: TestClient, vid: str, headers: dict | None = None) -> dict:
    r = c.get(f"/api/v1/plan-versions/{vid}/geometry?draft=true", headers=headers or {})
    assert r.status_code == 200, r.text
    return r.json()


def _save(c: TestClient, vid: str, doc: dict | None = None, headers: dict | None = None, **fields: Any):
    g = _draft(c, vid, headers)
    return c.put(f"/api/v1/plan-versions/{vid}/geometry", json={"doc": dict(doc or g["doc"], **fields), "base_revision": g["geometry"]["revision"]}, headers=headers or {})


def _publish(c: TestClient, vid: str) -> None:
    r = c.post(f"/api/v1/plan-versions/{vid}/geometry/publish")
    assert r.status_code == 200, r.text


def _anchor(c: TestClient, floor_id: str, kind: str, rid: str, x: float, y: float) -> str:
    r = c.post(f"/api/v1/floors/{floor_id}/anchors", json={"resource_type": kind, "resource_id": rid, "x": x, "y": y})
    assert r.status_code == 201, r.text
    return r.json()["id"]


def _world(settings, png3: bytes | None = None) -> dict[str, Any]:
    """Floor 2 (home, the court): the hall's walls (one long exterior wall runs along its top and past it), a door on a
    hall wall and one on the exterior wall inside the hall, a tribune and a label inside, a chair and a wall outside;
    camH and light.hall inside, camA outside. Floor 3: the duplicate drawing - the same room, two walls and an object
    inside, a wall crossing it, a wall and an object outside; camD and a second anchor of camH inside, cam3 outside."""
    app = create_app(settings)
    c = TestClient(app)
    ids = seed_tree(c)
    f2, f3 = ids["floor2"], ids["floor3"]
    v2, v3 = _plan(c, f2), _plan(c, f3, png3)
    cams = {k: c.post("/api/v1/cameras", json={"channel": n, "alias": k}).json()["id"] for n, k in enumerate(("camH", "camA", "camD", "cam3"), 1)}
    with app.state.db.connection() as conn:
        for eid in ("light.hall", "light.corridor", "light.stage"):
            ha_sync.upsert_state(conn, {"entity_id": eid, "state": "on", "last_changed": "2026-09-29T09:00:00+00:00", "attributes": {"friendly_name": eid}})
    hall = c.post(f"/api/v1/floors/{f2}/zones", json={"name": "אולם ספורט", "polygon": HALL}).json()
    dup = c.post(f"/api/v1/floors/{f3}/zones", json={"name": "אולם ספורט", "polygon": HALL}).json()
    walls2 = [WALL("ext", [[0.05, 0.2], [0.9, 0.2]], kind="exterior"), WALL("hw2", [[0.6, 0.2], [0.6, 0.6]]), WALL("hw3", [[0.6, 0.6], [0.2, 0.6]]),
              WALL("hw4", [[0.2, 0.6], [0.2, 0.2]]), WALL("out1", [[0.8, 0.3], [0.8, 0.7]]), WALL("stub", [[0.6, 0.4], [0.75, 0.4]])]
    doc2 = _draft(c, v2)["doc"]
    r = _save(c, v2, doc2, walls=walls2, openings=[DOOR("d-hall", "hw2", 0.5), DOOR("d-ext-in", "ext", round((0.4 - 0.05) / 0.85, 6)), DOOR("d-ext-out", "ext", round((0.85 - 0.05) / 0.85, 6))],
              objects=[OBJ("trib", [0.4, 0.3], "tribune.stepped", size={"w_m": 6, "d_m": 2, "h_m": 1.5}, params={"rows": 5}), OBJ("chair-out", [0.7, 0.7])],
              labels=[{"id": "lb-court", "text": "מגרש", "position": [0.4, 0.5], "level_id": "L0", "size": 14}])
    assert r.status_code == 200, r.text
    _publish(c, v2)
    doc3 = _draft(c, v3)["doc"]
    r = _save(c, v3, doc3, walls=[WALL("d1", [[0.2, 0.2], [0.6, 0.2]]), WALL("d2", [[0.6, 0.2], [0.6, 0.6]]), WALL("c3", [[0.1, 0.4], [0.7, 0.4]]), WALL("o3", [[0.8, 0.1], [0.8, 0.9]])],
              openings=[DOOR("dd", "d2", 0.5)], objects=[OBJ("dobj", [0.3, 0.5]), OBJ("oobj", [0.9, 0.9])])
    assert r.status_code == 200, r.text
    _publish(c, v3)
    anchors = {
        "camH2": _anchor(c, f2, "camera", cams["camH"], 0.45, 0.45), "camA": _anchor(c, f2, "camera", cams["camA"], 0.85, 0.85),
        "light": _anchor(c, f2, "ha_entity", "light.hall", 0.3, 0.3), "corr": _anchor(c, f2, "ha_entity", "light.corridor", 0.9, 0.5),
        "camD": _anchor(c, f3, "camera", cams["camD"], 0.5, 0.5), "camH3": _anchor(c, f3, "camera", cams["camH"], 0.35, 0.35),
        "cam3": _anchor(c, f3, "camera", cams["cam3"], 0.9, 0.1),
    }
    return {"app": app, "c": c, "ids": ids, "f2": f2, "f3": f3, "v2": v2, "v3": v3, "cams": cams, "hall": hall["id"], "dup": dup["id"], "anchors": anchors}


def _share(w: dict, **body: Any) -> dict:
    r = w["c"].post(f"/api/v1/zones/{w['hall']}/share", json={"floor_id": w["f3"], **body})
    assert r.status_code == 200, r.text
    return r.json()


# ---------------------------------------------------------------- the maths


def test_placement_round_trips_and_keeps_shapes_across_aspects():
    p = ss.Placement({"mode": "fit", "from": [0.4, 0.4], "to": [0.3, 0.6], "rotation_deg": 90, "scale": 0.5}, (1000, 500), (800, 800))
    for q in ((0.4, 0.4), (0.1, 0.9), (0.73, 0.21)):
        back = p.inv(*p.fwd(*q))
        assert math.isclose(back[0], q[0], abs_tol=1e-9) and math.isclose(back[1], q[1], abs_tol=1e-9)
    assert p.fwd(0.4, 0.4) == pytest.approx((0.3, 0.6))
    # a step of 0.2 plan widths to the right on the home plan turns 90 degrees clockwise (y down) and halves:
    # 0.1 of the other plan's width, straight down
    x, y = p.fwd(0.6, 0.4)
    assert (x, y) == pytest.approx((0.3, 0.6 + 0.1 * 800 / 800))
    same = ss.Placement({"mode": "same_frame"}, (1000, 500), (800, 800))
    assert same.fwd(0.25, 0.75) == (0.25, 0.75) and same.angle(30) == 30


def test_membership_clips_a_wall_along_the_outline_and_drops_a_touching_stub():
    poly = [(20.0, 20.0), (60.0, 20.0), (60.0, 60.0), (20.0, 60.0)]
    pieces, total = ss.clip_intervals([(5.0, 20.0), (90.0, 20.0)], poly, 1.0)
    assert total == 85 and pieces == [pytest.approx((15.0, 55.0))], "the long wall along the room's top: only its piece over the room"
    pieces, _ = ss.clip_intervals([(60.0, 40.0), (75.0, 40.0)], poly, 1.0)
    assert all(b - a <= 1.0 + 1e-9 for a, b in pieces), "an adjoining wall only touches the outline"
    assert ss.near((40.0, 40.0), poly, 0) and ss.near((60.5, 40.0), poly, 1.0) and not ss.near((62.0, 40.0), poly, 1.0)


# ---------------------------------------------------------------- conversion


def test_conversion_preview_lists_what_leaves_the_other_floor_and_apply_is_atomic(settings):
    w = _world(settings)
    c = w["c"]
    pv = c.post(f"/api/v1/zones/{w['hall']}/share/preview", json={"floor_id": w["f3"]})
    assert pv.status_code == 200, pv.text
    p = pv.json()
    assert p["placement"] == {"mode": "same_frame"} and p["same_frame"] is True
    assert p["duplicate"]["zone_id"] == w["dup"], "the duplicate room was detected by name and overlap"
    assert p["candidates"][0]["name_score"] == 1.0 and p["candidates"][0]["overlap"] == 1.0
    assert p["removed_ids"]["walls"] == ["d1", "d2"] and p["removed_ids"]["openings"] == ["dd"] and p["removed_ids"]["objects"] == ["dobj"]
    assert p["crossing_walls_kept"] == ["c3"] and p["remove"]["zone"] == 1
    acts = {a["anchor_id"]: a["action"] for a in p["anchors"]}
    assert acts == {w["anchors"]["camD"]: "rebind", w["anchors"]["camH3"]: "drop_duplicate"}, "cam3 outside the room stays where it is"
    assert p["attach"] == {"walls": 3, "clipped_walls": 1, "openings": 2, "objects": 1, "labels": 1, "connectors": 0, "circuits": 0, "anchors": 2}
    # the preview wrote nothing
    assert len(_draft(c, w["v3"])["doc"]["walls"]) == 4
    r = _share(w)
    assert r["share_id"] and len(r["rebound"]) == 1 and r["dropped"] == [w["anchors"]["camH3"]]
    d3 = _draft(c, w["v3"])
    own = [x["id"] for x in d3["doc"]["walls"] if "shared" not in x]
    assert own == ["c3", "o3"] and [o["id"] for o in d3["doc"]["objects"] if "shared" not in o] == ["oobj"]
    with w["app"].state.db.connection() as conn:
        assert conn.execute("SELECT deleted_at FROM spatial_zones WHERE id = ?", (w["dup"],)).fetchone()[0] is not None
        camd = conn.execute("SELECT floor_id, x, y FROM map_anchors WHERE resource_id = ? AND effective_to IS NULL", (w["cams"]["camD"],)).fetchall()
        assert [(a["floor_id"], a["x"], a["y"]) for a in camd] == [(w["f2"], 0.5, 0.5)], "camD was re-bound to the hall on its home floor, never lost"
        camh = conn.execute("SELECT floor_id FROM map_anchors WHERE resource_id = ? AND effective_to IS NULL", (w["cams"]["camH"],)).fetchall()
        assert [a[0] for a in camh] == [w["f2"]], "the duplicate anchor was tombstoned: the mirror shows the hall's own"
        actions = [r[0] for r in conn.execute("SELECT action FROM audit_log WHERE action IN ('zone.share', 'geometry.shared.convert', 'anchor.rebind') ORDER BY rowid").fetchall()]
        assert actions == ["zone.share", "geometry.shared.convert", "anchor.rebind"]
        det = json.loads(conn.execute("SELECT details_json FROM audit_log WHERE action = 'zone.share'").fetchone()[0])
        assert det["home_floor_id"] == w["f2"] and det["floor_id"] == w["f3"]
    again = c.post(f"/api/v1/zones/{w['hall']}/share", json={"floor_id": w["f3"]})
    assert again.status_code == 409 and again.json()["code"] == "already_shared"


def test_a_room_is_shared_only_within_its_building_and_never_with_its_own_floor(settings):
    w = _world(settings)
    c = w["c"]
    assert c.post(f"/api/v1/zones/{w['hall']}/share/preview", json={"floor_id": w["f2"]}).status_code == 422
    other_b = c.post(f"/api/v1/sites/{w['ids']['site']}/buildings", json={"name": "מבנה ב"}).json()["id"]
    far = c.post(f"/api/v1/buildings/{other_b}/floors", json={"name": "קומה 0", "level": 0}).json()["id"]
    _plan(c, far)
    r = c.post(f"/api/v1/zones/{w['hall']}/share/preview", json={"floor_id": far})
    assert r.status_code == 422


# ---------------------------------------------------------------- attach on read


def test_the_other_floor_reads_the_hall_whole_computed_never_stored(settings):
    w = _world(settings)
    c = w["c"]
    _share(w)
    f2 = w["f2"]
    d3 = _draft(c, w["v3"])
    doc = d3["doc"]
    shared_walls = {x["id"]: x for x in doc["walls"] if "shared" in x}
    assert set(shared_walls) == {f"{f2}:hw2", f"{f2}:hw3", f"{f2}:hw4", f"{f2}:ext#1"}
    assert shared_walls[f"{f2}:ext#1"]["shared"]["readonly"] is True and "readonly" not in shared_walls[f"{f2}:hw2"]["shared"]
    assert shared_walls[f"{f2}:ext#1"]["polyline"] == [[pytest.approx(0.2, abs=0.02), 0.2], [pytest.approx(0.6, abs=0.02), 0.2]]
    ops = {o["id"]: o for o in doc["openings"] if "shared" in o}
    assert set(ops) == {f"{f2}:d-hall", f"{f2}:d-ext-in"} and ops[f"{f2}:d-ext-in"]["wall_id"] == f"{f2}:ext#1"
    assert [o["id"] for o in doc["objects"] if "shared" in o] == [f"{f2}:trib"]
    assert [lb["id"] for lb in doc["labels"] if "shared" in lb] == [f"{f2}:lb-court"]
    levels = {lv["id"]: lv for lv in doc["levels"]}
    assert levels[f"{f2}:L0"]["elevation_m"] == -3.0, "the court is one floor down"
    entry = doc["shared_spaces"][0]
    assert entry["role"] == "mirror" and entry["home_floor_id"] == f2 and entry["label"] == "רצפה בקומה 2" and entry["volume_height_m"] == pytest.approx(5.8)
    assert entry["home_revision"] == _draft(c, w["v2"])["geometry"]["revision"]
    # the home floor's own read says the room is shared (the chip there too) without any mirrored item
    d2 = _draft(c, w["v2"])["doc"]
    assert d2["shared_spaces"][0]["role"] == "home" and d2["shared_spaces"][0]["other_floor_id"] == w["f3"] and not any("shared" in x for x in d2["walls"])
    assert d2["shared_spaces"][0]["volume_height_m"] == pytest.approx(5.8) and sorted(d2["shared_spaces"][0]["wall_ids"]) == ["hw2", "hw3", "hw4"]
    # nothing of it is stored on floor 3, and a change on floor 2 never changes floor 3's hash
    with w["app"].state.db.connection() as conn:
        raw = conn.execute("SELECT doc_json, doc_hash FROM plan_geometry WHERE plan_version_id = ? AND status = 'draft'", (w["v3"],)).fetchone()
        assert '"shared"' not in raw["doc_json"] and f"{f2}:" not in raw["doc_json"]
    before = d3["geometry"]["doc_hash"]
    moved = [dict(o, position=[0.45, 0.3]) if o["id"] == "trib" else o for o in _draft(c, w["v2"])["doc"]["objects"]]
    assert _save(c, w["v2"], objects=moved).status_code == 200
    d3b = _draft(c, w["v3"])
    assert d3b["geometry"]["doc_hash"] == before and next(o for o in d3b["doc"]["objects"] if o["id"] == f"{f2}:trib")["position"] == [0.45, 0.3]
    # the published read follows the home floor's publish through its ETag
    pub = c.get(f"/api/v1/plan-versions/{w['v3']}/geometry")
    etag = pub.headers["etag"]
    assert "-s" in etag and next(o for o in pub.json()["doc"]["objects"] if o["id"] == f"{f2}:trib")["position"] == [0.4, 0.3], "the live map shows the home floor's published hall"
    assert c.get(f"/api/v1/plan-versions/{w['v3']}/geometry", headers={"If-None-Match": etag}).status_code == 304
    _publish(c, w["v2"])
    pub2 = c.get(f"/api/v1/plan-versions/{w['v3']}/geometry", headers={"If-None-Match": etag})
    assert pub2.status_code == 200 and pub2.headers["etag"] != etag
    # the map bundle: the room's zone and anchors on floor 3, in its coordinates, and a view_hash that follows them
    m3 = c.get(f"/api/v1/floors/{w['f3']}/map").json()
    zones = {z["id"]: z for z in m3["zones"]}
    assert zones[w["hall"]]["shared"]["role"] == "mirror" and zones[w["hall"]]["shared"]["label"] == "רצפה בקומה 2"
    mir = {a["resource_id"]: a for a in m3["anchors"] if a.get("shared")}
    assert set(mir) == {w["cams"]["camH"], w["cams"]["camD"], "light.hall"} and mir["light.hall"]["entity"]["state"] == "on"
    assert m3["geometry"]["view_hash"].startswith(m3["geometry"]["doc_hash"] + "-s")
    m2 = c.get(f"/api/v1/floors/{w['f2']}/map").json()
    assert next(z for z in m2["zones"] if z["id"] == w["hall"])["shared"]["role"] == "home"
    # the export draws the mirrored hall
    svg = c.get(f"/api/v1/plan-versions/{w['v3']}/export.svg")
    assert svg.status_code == 200 and f'data-room="{w['hall']}"' in svg.text and f"{f2}:trib" in svg.text


# ---------------------------------------------------------------- editing from the other floor (decision 1)


def test_an_edit_from_the_upper_floor_lands_in_the_home_draft_and_only_inside_the_room(settings):
    w = _world(settings)
    c, f2 = w["c"], w["f2"]
    _share(w)
    g = _draft(c, w["v3"])
    doc = g["doc"]
    rev2 = _draft(c, w["v2"])["geometry"]["revision"]
    # move the tribune and add a bench inside the hall, both from floor 3
    doc["objects"] = [dict(o, position=[0.5, 0.35], rotation_deg=10) if o["id"] == f"{f2}:trib" else o for o in doc["objects"]]
    doc["objects"].append(OBJ(f"{f2}:bench", [0.3, 0.45], "chair.basic", level_id="L0", shared={"zone_id": w["hall"], "home_floor_id": f2}))
    # edits of a read-only piece are ignored (the exterior wall belongs to the rest of floor 2)
    doc["walls"] = [dict(x, polyline=[[0.2, 0.25], [0.6, 0.25]]) if x["id"] == f"{f2}:ext#1" else x for x in doc["walls"]]
    r = c.put(f"/api/v1/plan-versions/{w['v3']}/geometry", json={"doc": doc, "base_revision": g["geometry"]["revision"]})
    assert r.status_code == 200, r.text
    home = _draft(c, w["v2"])
    assert home["geometry"]["revision"] == rev2 + 1
    objs = {o["id"]: o for o in home["doc"]["objects"]}
    assert objs["trib"]["position"] == [0.5, 0.35] and objs["trib"]["rotation_deg"] == 10 and objs["bench"]["level_id"] == "L0" and "shared" not in objs["bench"]
    assert next(x for x in home["doc"]["walls"] if x["id"] == "ext")["polyline"] == [[0.05, 0.2], [0.9, 0.2]]
    assert next(o for o in r.json()["doc"]["objects"] if o["id"] == f"{f2}:bench")["shared"]["home_floor_id"] == f2, "the answer is re-attached"
    with w["app"].state.db.connection() as conn:
        det = json.loads(conn.execute("SELECT details_json FROM audit_log WHERE action = 'geometry.shared.edit'").fetchone()[0])
        assert det["from_floor_id"] == w["f3"] and det["zone_ids"] == [w["hall"]] and det["changed"] == 1 and det["added"] == 1
    # moving something out of the room from floor 3 is refused, and nothing is written (own edits included)
    g = _draft(c, w["v3"])
    doc = g["doc"]
    doc["objects"] = [dict(o, position=[0.9, 0.9]) if o["id"] == f"{f2}:trib" else o for o in doc["objects"]]
    doc["labels"] = doc["labels"] + [{"id": "own-label", "text": "קומה 3", "position": [0.9, 0.2], "level_id": "L0", "size": 14}]
    bad = c.put(f"/api/v1/plan-versions/{w['v3']}/geometry", json={"doc": doc, "base_revision": g["geometry"]["revision"]})
    assert bad.status_code == 422 and bad.json()["code"] == "shared_outside"
    assert _draft(c, w["v3"])["geometry"]["revision"] == g["geometry"]["revision"] and not any(lb["id"] == "own-label" for lb in _draft(c, w["v3"])["doc"]["labels"])
    # deleting a hall wall from floor 3 deletes it (and its door) at home
    g = _draft(c, w["v3"])
    doc = g["doc"]
    doc["walls"] = [x for x in doc["walls"] if x["id"] != f"{f2}:hw2"]
    doc["openings"] = [o for o in doc["openings"] if o["wall_id"] != f"{f2}:hw2"]
    assert c.put(f"/api/v1/plan-versions/{w['v3']}/geometry", json={"doc": doc, "base_revision": g["geometry"]["revision"]}).status_code == 200
    home = _draft(c, w["v2"])["doc"]
    assert "hw2" not in {x["id"] for x in home["walls"]} and "d-hall" not in {o["id"] for o in home["openings"]} and "out1" in {x["id"] for x in home["walls"]}


def _as_browser(v: Any) -> Any:
    """JSON as a browser re-serializes it: 0.0 comes back as 0."""
    if isinstance(v, float) and v.is_integer():
        return int(v)
    if isinstance(v, dict):
        return {k: _as_browser(x) for k, x in v.items()}
    if isinstance(v, list):
        return [_as_browser(x) for x in v]
    return v


def test_an_untouched_mirror_writes_nothing_home_and_a_malformed_item_is_refused(settings):
    w = _world(settings)
    c, f2 = w["c"], w["f2"]
    _share(w)
    rev2 = _draft(c, w["v2"])["geometry"]["revision"]
    g = _draft(c, w["v3"])
    doc = _as_browser(g["doc"])
    doc["labels"] = doc["labels"] + [{"id": "own", "text": "קומה 3", "position": [0.9, 0.2], "level_id": "L0", "size": 14}]
    assert c.put(f"/api/v1/plan-versions/{w['v3']}/geometry", json={"doc": doc, "base_revision": g["geometry"]["revision"]}).status_code == 200
    assert _draft(c, w["v2"])["geometry"]["revision"] == rev2, "saving floor 3's own label never rewrites the hall"
    g = _draft(c, w["v3"])
    doc = g["doc"]
    doc["objects"] = doc["objects"] + [dict(OBJ(f"{f2}:bad", [0.3, 0.3]), size="large", shared={"zone_id": w["hall"], "home_floor_id": f2})]
    r = c.put(f"/api/v1/plan-versions/{w['v3']}/geometry", json={"doc": doc, "base_revision": g["geometry"]["revision"]})
    assert r.status_code == 422 and r.json()["code"] == "geometry_structure"
    assert _draft(c, w["v2"])["geometry"]["revision"] == rev2 and _draft(c, w["v3"])["geometry"]["revision"] == g["geometry"]["revision"]


def test_a_stale_mirror_is_a_conflict_and_a_client_that_never_read_it_deletes_nothing(settings):
    w = _world(settings)
    c, f2 = w["c"], w["f2"]
    _share(w)
    stale = _draft(c, w["v3"])
    # someone edits the hall on floor 2 meanwhile
    objs = [dict(o, position=[0.35, 0.3]) if o["id"] == "trib" else o for o in _draft(c, w["v2"])["doc"]["objects"]]
    assert _save(c, w["v2"], objects=objs).status_code == 200
    doc = stale["doc"]
    doc["objects"] = [dict(o, rotation_deg=45) if o["id"] == f"{f2}:trib" else o for o in doc["objects"]]
    r = c.put(f"/api/v1/plan-versions/{w['v3']}/geometry", json={"doc": doc, "base_revision": stale["geometry"]["revision"]})
    assert r.status_code == 409 and r.json()["code"] == "stale_revision" and r.json()["details"]["shared"] is True
    assert _draft(c, w["v3"])["geometry"]["revision"] == stale["geometry"]["revision"], "nothing written"
    # a client without the mirror (no shared_spaces echo, no shared items) saves its own floor and the hall stays
    fresh = _draft(c, w["v3"])
    plain = {k: v for k, v in fresh["doc"].items() if k != "shared_spaces"}
    for coll in ("walls", "openings", "objects", "labels", "connectors", "levels", "circuits", "groups"):
        plain[coll] = [x for x in plain[coll] if "shared" not in x]
    assert c.put(f"/api/v1/plan-versions/{w['v3']}/geometry", json={"doc": plain, "base_revision": fresh["geometry"]["revision"]}).status_code == 200
    assert "trib" in {o["id"] for o in _draft(c, w["v2"])["doc"]["objects"]}


def test_zone_and_anchor_edits_from_the_other_floor_go_through_the_placement(settings):
    w = _world(settings, png3=png_bytes(800, 400, color=(250, 240, 240)))
    c = w["c"]
    r = _share(w, duplicate_zone_id=w["dup"], rotation_deg=90)
    place = r["placement"]
    assert place["mode"] == "fit" and place["rotation_deg"] == 90
    m3 = c.get(f"/api/v1/floors/{w['f3']}/map").json()
    cam = next(a for a in m3["anchors"] if a.get("shared") and a["resource_id"] == w["cams"]["camH"])
    # nudge the hall's camera on floor 3's map: it moves on floor 2, back through the placement, and stays in the room
    x, y = cam["position"]["x"] + 0.01, cam["position"]["y"]
    up = c.patch(f"/api/v1/map-anchors/{cam['id']}?from_floor_id={w['f3']}", json={"revision": cam["revision"], "x": x, "y": y, "rotation_degrees": (cam["rotation_degrees"] + 15) % 360})
    assert up.status_code == 200, up.text
    assert up.json()["floor_id"] == w["f2"]
    m3b = c.get(f"/api/v1/floors/{w['f3']}/map").json()
    again = next(a for a in m3b["anchors"] if a["id"] == cam["id"])
    assert again["position"]["x"] == pytest.approx(x, abs=1e-4) and again["position"]["y"] == pytest.approx(y, abs=1e-4)
    assert again["rotation_degrees"] == pytest.approx((cam["rotation_degrees"] + 15) % 360, abs=1e-2)
    out = c.patch(f"/api/v1/map-anchors/{cam['id']}?from_floor_id={w['f3']}", json={"revision": again["revision"], "x": 0.99, "y": 0.99})
    assert out.status_code == 422 and out.json()["code"] == "shared_outside"
    # an anchor placed on floor 3 inside the hall is created on the hall's home floor
    zone3 = next(z for z in m3b["zones"] if z["id"] == w["hall"])
    cx = sum(p["x"] for p in zone3["polygon"]) / 4
    cy = sum(p["y"] for p in zone3["polygon"]) / 4
    made = c.post(f"/api/v1/floors/{w['f3']}/anchors", json={"resource_type": "ha_entity", "resource_id": "light.stage", "x": cx, "y": cy})
    assert made.status_code == 201 and made.json()["floor_id"] == w["f2"]
    assert made.json()["position"]["x"] == pytest.approx(0.4, abs=1e-3) and made.json()["position"]["y"] == pytest.approx(0.4, abs=1e-3)
    # the room's name and polygon from floor 3
    z = c.get(f"/api/v1/floors/{w['f2']}/zones").json()["zones"]
    hz = next(q for q in z if q["id"] == w["hall"])
    moved = [{"x": p["x"], "y": p["y"]} for p in zone3["polygon"]]
    pr = c.patch(f"/api/v1/zones/{w['hall']}?from_floor_id={w['f3']}", json={"revision": hz["revision"], "name": "אולם", "polygon": moved})
    assert pr.status_code == 200, pr.text
    assert pr.json()["name"] == "אולם" and pr.json()["polygon"] == [{"x": pytest.approx(p["x"], abs=2e-4), "y": pytest.approx(p["y"], abs=2e-4)} for p in HALL]


# ---------------------------------------------------------------- permissions (decision 3)


def _p(user: str) -> Principal:
    return Principal(f"dev-{user}", user, user, "dev")


def test_a_user_of_the_upper_floor_only_reaches_the_whole_hall_and_nothing_else_of_the_home_floor(settings):
    w = _world(settings)
    c, app = w["c"], w["app"]
    _share(w)
    c.get("/api/v1/me", headers=as_user("dana"))
    _binding(settings, "dana", "viewer", "floor", w["f3"])
    with app.state.db.connection() as conn:
        scope = camera_scope(conn, _p("dana"), "map.read")
        assert w["cams"]["camH"] in scope.ids and w["cams"]["camD"] in scope.ids and w["cams"]["cam3"] in scope.ids
        assert w["cams"]["camA"] not in scope.ids, "a floor-2 camera outside the hall stays out of reach"
        placed = ha_scope.placements(conn)
        wide, floors = ha_scope.visible_floors(conn, _p("dana"), "entity.state.read")
        assert ha_scope.entity_visible(wide, floors, placed, "light.hall") and not ha_scope.entity_visible(wide, floors, placed, "light.corridor")
    hdr = as_user("dana")
    # the map, the live snapshot authorization and the events of the hall's camera
    m3 = c.get(f"/api/v1/floors/{w['f3']}/map", headers=hdr).json()
    assert {a["resource_id"] for a in m3["anchors"]} == {w["cams"]["camH"], w["cams"]["camD"], w["cams"]["cam3"], "light.hall"}
    assert c.get(f"/api/v1/floors/{w['f2']}/map", headers=hdr).status_code == 403
    cams = {x["id"] for x in c.get("/api/v1/cameras", headers=hdr).json()["cameras"]}
    assert w["cams"]["camH"] in cams and w["cams"]["camA"] not in cams
    pub = c.get(f"/api/v1/plan-versions/{w['v3']}/geometry", headers=hdr)
    assert pub.status_code == 200 and any(o["id"] == f"{w['f2']}:trib" for o in pub.json()["doc"]["objects"])
    # search finds the hall from floor 3
    res = c.get("/api/v1/search?q=אולם", headers=hdr).json()["results"]
    hall = next(x for x in res if x["kind"] == "zone")
    assert hall["floor_id"] == w["f3"] and hall["route"].startswith(f"/explore/floors/{w['f3']}")
    # the site tree lists floor 3 with the shared cameras counted once
    tree = c.get("/api/v1/sites", headers=hdr).json()
    floors = [f for s in tree["sites"] for b in s["buildings"] for f in b["floors"]]
    assert [f["id"] for f in floors] == [w["f3"]] and floors[0]["shared_camera_count"] == 2
    # un-share: the reach is gone on the very next request
    assert c.delete(f"/api/v1/zones/{w['hall']}/share/{w['f3']}").status_code == 204
    with app.state.db.connection() as conn:
        assert w["cams"]["camH"] not in camera_scope(conn, _p("dana"), "map.read").ids
    m3 = c.get(f"/api/v1/floors/{w['f3']}/map", headers=hdr).json()
    assert {a["resource_id"] for a in m3["anchors"]} == {w["cams"]["cam3"]}
    assert not any("shared" in o for o in c.get(f"/api/v1/plan-versions/{w['v3']}/geometry", headers=hdr).json()["doc"]["objects"])


def test_deny_still_wins_on_the_hall(settings):
    w = _world(settings)
    c, app = w["c"], w["app"]
    _share(w)
    c.get("/api/v1/me", headers=as_user("eli"))
    c.get("/api/v1/me", headers=as_user("noa"))
    _binding(settings, "eli", "viewer", "floor", w["f3"])
    _binding(settings, "eli", "viewer", "floor", w["f2"], effect="deny")  # denied the hall's home floor
    _binding(settings, "noa", "viewer", "floor", w["f3"])
    _binding(settings, "noa", "viewer", "camera", w["cams"]["camH"], effect="deny")  # denied the hall's camera
    with app.state.db.connection() as conn:
        eli = camera_scope(conn, _p("eli"), "map.read")
        assert w["cams"]["camH"] not in eli.ids and w["cams"]["camD"] not in eli.ids and w["cams"]["cam3"] in eli.ids
        wide, floors = ha_scope.visible_floors(conn, _p("eli"), "entity.state.read")
        assert not ha_scope.entity_visible(wide, floors, ha_scope.placements(conn), "light.hall")
        noa = camera_scope(conn, _p("noa"), "map.read")
        assert w["cams"]["camH"] not in noa.ids and w["cams"]["camD"] in noa.ids
    m3 = c.get(f"/api/v1/floors/{w['f3']}/map", headers=as_user("eli")).json()
    assert {a["resource_id"] for a in m3["anchors"]} == {w["cams"]["cam3"]} and not any(z.get("shared") for z in m3["zones"])
    g = c.get(f"/api/v1/plan-versions/{w['v3']}/geometry", headers=as_user("eli"))
    assert not any("shared" in o for o in g.json()["doc"]["objects"]) and "-s" not in g.headers["etag"]
    m3n = c.get(f"/api/v1/floors/{w['f3']}/map", headers=as_user("noa")).json()
    assert w["cams"]["camH"] not in {a["resource_id"] for a in m3n["anchors"]} and w["cams"]["camD"] in {a["resource_id"] for a in m3n["anchors"]}


def test_sharing_widens_reach_so_it_needs_both_floors_and_every_camera_of_the_room(settings):
    w = _world(settings)
    c = w["c"]
    for u in ("ofer", "gal"):
        c.get("/api/v1/me", headers=as_user(u))
    _binding(settings, "ofer", "editor", "floor", w["f3"])  # the other floor only
    r = c.post(f"/api/v1/zones/{w['hall']}/share/preview", json={"floor_id": w["f3"]}, headers=as_user("ofer"))
    assert r.status_code == 403
    _binding(settings, "gal", "editor", "floor", w["f3"])
    _binding(settings, "gal", "editor", "floor", w["f2"])
    _binding(settings, "gal", "editor", "camera", w["cams"]["camH"], effect="deny")
    assert c.post(f"/api/v1/zones/{w['hall']}/share/preview", json={"floor_id": w["f3"]}, headers=as_user("gal")).status_code == 200, "looking needs map.edit on both floors"
    r = c.post(f"/api/v1/zones/{w['hall']}/share", json={"floor_id": w["f3"]}, headers=as_user("gal"))
    assert r.status_code == 403
    with w["app"].state.db.connection() as conn:
        assert conn.execute("SELECT COUNT(*) FROM shared_spaces").fetchone()[0] == 0


def test_the_other_floors_editor_edits_the_room_with_map_edit_there_only(settings):
    w = _world(settings)
    c, f2 = w["c"], w["f2"]
    _share(w)
    c.get("/api/v1/me", headers=as_user("ofer"))
    _binding(settings, "ofer", "editor", "floor", w["f3"])
    hdr = as_user("ofer")
    assert c.get(f"/api/v1/plan-versions/{w['v2']}/geometry?draft=true", headers=hdr).status_code == 403
    g = _draft(c, w["v3"], hdr)
    doc = g["doc"]
    doc["objects"] = [dict(o, position=[0.42, 0.32]) if o["id"] == f"{f2}:trib" else o for o in doc["objects"]]
    r = c.put(f"/api/v1/plan-versions/{w['v3']}/geometry", json={"doc": doc, "base_revision": g["geometry"]["revision"]}, headers=hdr)
    assert r.status_code == 200, r.text
    assert next(o for o in _draft(c, w["v2"])["doc"]["objects"] if o["id"] == "trib")["position"] == [0.42, 0.32]
    # the room's anchors from floor 3 with placement.edit there; one outside the room stays out of reach
    m3 = c.get(f"/api/v1/floors/{w['f3']}/map", headers=hdr).json()
    light = next(a for a in m3["anchors"] if a["resource_id"] == "light.hall")
    assert c.patch(f"/api/v1/map-anchors/{light['id']}?from_floor_id={w['f3']}", json={"revision": light["revision"], "x": 0.31, "y": 0.31}, headers=hdr).status_code == 200
    corr = w["anchors"]["corr"]
    r = c.patch(f"/api/v1/map-anchors/{corr}?from_floor_id={w['f3']}", json={"revision": 1, "x": 0.9, "y": 0.52}, headers=hdr)
    assert r.status_code == 422 and r.json()["code"] == "not_shared"
    assert c.patch(f"/api/v1/map-anchors/{corr}", json={"revision": 1, "x": 0.9, "y": 0.52}, headers=hdr).status_code == 403


def test_history_and_camera_only_readers(settings):
    w = _world(settings)
    c = w["c"]
    before = now_iso()
    import time

    time.sleep(1.1)
    _share(w)
    # before the share, floor 3's history map has no hall
    m = c.get(f"/api/v1/floors/{w['f3']}/map?at={before}").json()
    assert not any(z.get("shared") for z in m["zones"])
    # a user bound to the hall camera alone reaches floor 3's drawing (the camera is on it) without circuits or zones
    c.get("/api/v1/me", headers=as_user("cam"))
    _binding(settings, "cam", "viewer", "camera", w["cams"]["camH"])
    m3 = c.get(f"/api/v1/floors/{w['f3']}/map", headers=as_user("cam")).json()
    assert m3["reach"] == "cameras" and m3["zones"] == [] and {a["resource_id"] for a in m3["anchors"]} == {w["cams"]["camH"]}
