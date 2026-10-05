"""Shared space (CR-009, T097): the owner's double-height sports hall, drawn twice today (floor 2 holds the court, floor 3
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


WIDE = [{"x": 0.15, "y": 0.15}, {"x": 0.65, "y": 0.15}, {"x": 0.65, "y": 0.75}, {"x": 0.15, "y": 0.75}]


def _wide(settings) -> dict[str, Any]:
    """The owner's hall as it really is: wider at the upper level. Floor 3 draws its own, wider outline with walls along it
    (and a second drawing of the court's top wall inside); floor 2 has the tribune's upper rows outside the court -
    explicitly the hall's (`shared_space_id`, re-review N3) - and a locker under the overhang on its own level."""
    w = _world(settings)
    c = w["c"]
    z = c.get(f"/api/v1/floors/{w['f3']}/zones").json()["zones"][0]
    assert c.patch(f"/api/v1/zones/{w['dup']}", json={"revision": z["revision"], "polygon": WIDE}).status_code == 200
    g3 = _draft(c, w["v3"])["doc"]
    walls = [WALL("u1", [[0.15, 0.15], [0.65, 0.15]]), WALL("u2", [[0.65, 0.15], [0.65, 0.75]]), WALL("court-copy", [[0.2, 0.2], [0.6, 0.2]]), WALL("o3", [[0.8, 0.1], [0.8, 0.9]])]
    assert _save(c, w["v3"], g3, walls=walls, openings=[DOOR("du", "u2", 0.5)]).status_code == 200
    g2 = _draft(c, w["v2"])["doc"]
    assert _save(c, w["v2"], g2, objects=[*g2["objects"], OBJ("rows-up", [0.4, 0.7], "tribune.stepped", size={"w_m": 6, "d_m": 1.5, "h_m": 1.0}, params={"rows": 3},
                                                              shared_space_id=w["hall"]),
                                          OBJ("locker", [0.62, 0.3], "chair.basic")]).status_code == 200
    return w


def test_conversion_keeps_the_other_floors_outline_removes_only_duplicate_content_and_lists_members(settings):
    w = _world(settings)
    c = w["c"]
    pv = c.post(f"/api/v1/zones/{w['hall']}/share/preview", json={"floor_id": w["f3"]})
    assert pv.status_code == 200, pv.text
    p = pv.json()
    assert p["placement"] == {"mode": "same_frame"} and p["same_frame"] is True and p["aligned"] is True
    assert p["duplicate"]["zone_id"] == w["dup"] and p["outline"] == {"zone_id": w["dup"], "kept": True, "polygon": HALL}
    assert p["candidates"][0]["name_score"] == 1.0 and p["candidates"][0]["overlap"] == 1.0
    # the walls along floor 3's outline bound the hall at that floor: kept; only the duplicate content leaves
    assert p["boundary_walls_kept"] == ["d1", "d2"] and p["removed_ids"]["walls"] == [] and p["removed_ids"]["objects"] == ["dobj"] and p["remove"]["zone"] == 0
    acts = {a["anchor_id"]: a["action"] for a in p["anchors"]}
    assert acts == {w["anchors"]["camH2"]: "member", w["anchors"]["light"]: "member", w["anchors"]["camD"]: "member", w["anchors"]["camH3"]: "drop_duplicate"}
    assert len(_draft(c, w["v3"])["doc"]["objects"]) == 2, "the preview wrote nothing"
    r = _share(w)
    assert r["outline_zone_id"] == w["dup"] and r["dropped"] == [w["anchors"]["camH3"]]
    assert sorted((m["resource_type"], m["resource_id"]) for m in r["members_added"]) == sorted([("camera", w["cams"]["camH"]), ("ha_entity", "light.hall"), ("camera", w["cams"]["camD"])])
    d3 = _draft(c, w["v3"])
    assert [x["id"] for x in d3["doc"]["walls"]] == ["d1", "d2", "c3", "o3"] and [o["id"] for o in d3["doc"]["objects"] if "shared" not in o] == ["oobj"]
    with w["app"].state.db.connection() as conn:
        assert conn.execute("SELECT deleted_at FROM spatial_zones WHERE id = ?", (w["dup"],)).fetchone()[0] is None, "floor 3's outline stays"
        camd = conn.execute("SELECT floor_id, x, y FROM map_anchors WHERE resource_id = ? AND effective_to IS NULL", (w["cams"]["camD"],)).fetchall()
        assert [(a["floor_id"], a["x"], a["y"]) for a in camd] == [(w["f3"], 0.5, 0.5)], "review M3c: camD stays where it is, a member now"
        actions = [r[0] for r in conn.execute("SELECT action FROM audit_log WHERE action IN ('zone.share', 'geometry.shared.convert', 'zone.share.member_add') ORDER BY rowid").fetchall()]
        assert actions == ["zone.share", "geometry.shared.convert", "zone.share.member_add", "zone.share.member_add", "zone.share.member_add"]
    again = c.post(f"/api/v1/zones/{w['hall']}/share", json={"floor_id": w["f3"]})
    assert again.status_code == 409 and again.json()["code"] == "already_shared"


def test_review_m3b_a_camera_anchored_elsewhere_on_the_home_floor_keeps_its_anchor_on_the_other_floor(settings):
    w = _world(settings)
    c = w["c"]
    # camA is on floor 2 OUTSIDE the hall; floor 3 has camA inside its duplicate room
    a = _anchor(c, w["f3"], "camera", w["cams"]["camA"], 0.4, 0.55)
    acts = {x["anchor_id"]: x["action"] for x in c.post(f"/api/v1/zones/{w['hall']}/share/preview", json={"floor_id": w["f3"]}).json()["anchors"]}
    assert acts[a] == "kept"
    r = _share(w)
    assert a not in r["dropped"] and ("camera", w["cams"]["camA"]) not in [(m["resource_type"], m["resource_id"]) for m in r["members_added"]]


def test_a_room_is_shared_only_within_its_building_and_never_with_its_own_floor(settings):
    w = _world(settings)
    c = w["c"]
    assert c.post(f"/api/v1/zones/{w['hall']}/share/preview", json={"floor_id": w["f2"]}).status_code == 422
    other_b = c.post(f"/api/v1/sites/{w['ids']['site']}/buildings", json={"name": "מבנה ב"}).json()["id"]
    far = c.post(f"/api/v1/buildings/{other_b}/floors", json={"name": "קומה 0", "level": 0}).json()["id"]
    _plan(c, far)
    assert c.post(f"/api/v1/zones/{w['hall']}/share/preview", json={"floor_id": far}).status_code == 422


# ---------------------------------------------------------------- read side (two outlines)


def test_the_upper_floor_reads_the_halls_content_with_both_outlines_computed_never_stored(settings):
    w = _wide(settings)
    c = w["c"]
    r = _share(w)
    assert r["outline_zone_id"] == w["dup"]
    f2 = w["f2"]
    d3 = _draft(c, w["v3"])
    doc = d3["doc"]
    # content is shared, walls are each floor's own: floor 3 keeps its outline walls, the court copy left
    assert [x["id"] for x in doc["walls"]] == ["u1", "u2", "o3"], "no wall of floor 2 attached, the copy of the court's wall removed"
    assert sorted(o["id"] for o in doc["objects"] if "shared" in o) == [f"{f2}:rows-up", f"{f2}:trib"], "the upper rows outside the court's outline come too"
    assert [lb["id"] for lb in doc["labels"] if "shared" in lb] == [f"{f2}:lb-court"]
    assert {lv["id"] for lv in doc["levels"] if "shared" in lv} == {f"{f2}:L0"} and next(lv for lv in doc["levels"] if lv["id"] == f"{f2}:L0")["elevation_m"] == -3.0
    e = doc["shared_spaces"][0]
    assert e["role"] == "mirror" and e["polygon"] == WIDE and e["other_polygon"] == HALL and e["other_label"] == "מפלס תחתון" and e["aligned"] is True
    assert e["datum_m"] == -3.0 and e["upper_ceiling_m"] == 2.8 and e["volume_height_m"] is None and e["label"] == "רצפה בקומה 2"
    assert "home_doc_hash" not in e and "home_version_id" not in e, "review L1"
    assert e["home_revision"] == _draft(c, w["v2"])["geometry"]["revision"]
    d2 = _draft(c, w["v2"])["doc"]
    h = d2["shared_spaces"][0]
    assert h["role"] == "home" and h["polygon"] == HALL and h["other_polygon"] == WIDE and h["other_label"] == "מפלס עליון"
    assert h["volume_height_m"] == 3.0 and sorted(h["wall_ids"]) == ["hw2", "hw3", "hw4"] and not any("shared" in x for x in d2["objects"])
    with w["app"].state.db.connection() as conn:
        raw = conn.execute("SELECT doc_json FROM plan_geometry WHERE plan_version_id = ? AND status = 'draft'", (w["v3"],)).fetchone()[0]
        assert '"shared"' not in raw and f"{f2}:" not in raw
    # a move on floor 2 changes floor 3's view, never its hash
    before = d3["geometry"]["doc_hash"]
    moved = [dict(o, position=[0.45, 0.3]) if o["id"] == "trib" else o for o in _draft(c, w["v2"])["doc"]["objects"]]
    assert _save(c, w["v2"], objects=moved).status_code == 200
    d3b = _draft(c, w["v3"])
    assert d3b["geometry"]["doc_hash"] == before and next(o for o in d3b["doc"]["objects"] if o["id"] == f"{f2}:trib")["position"] == [0.45, 0.3]
    # published read: the ETag follows the room's content only (review L1)
    _publish(c, w["v2"])
    _publish(c, w["v3"])
    pub = c.get(f"/api/v1/plan-versions/{w['v3']}/geometry")
    etag = pub.headers["etag"]
    assert "-s" in etag and c.get(f"/api/v1/plan-versions/{w['v3']}/geometry", headers={"If-None-Match": etag}).status_code == 304
    g2 = _draft(c, w["v2"])["doc"]  # a change of floor 2 OUTSIDE the room, published
    assert _save(c, w["v2"], g2, labels=[*g2["labels"], {"id": "far-label", "text": "מסדרון", "position": [0.9, 0.9], "level_id": "L0", "size": 14}]).status_code == 200
    _publish(c, w["v2"])
    assert c.get(f"/api/v1/plan-versions/{w['v3']}/geometry", headers={"If-None-Match": etag}).status_code == 304, "a publish of floor 2 outside the room leaves floor 3's ETag"
    # the bundle: floor 3's own outline zone carries the chip; the members come in, positioned for floor 3
    m3 = c.get(f"/api/v1/floors/{w['f3']}/map").json()
    assert next(z for z in m3["zones"] if z["id"] == w["dup"])["shared"]["role"] == "mirror" and not any(z["id"] == w["hall"] for z in m3["zones"])
    mir = {a["resource_id"] for a in m3["anchors"] if a.get("shared")}
    assert mir == {w["cams"]["camH"], "light.hall"} and m3["geometry"]["view_hash"].startswith(m3["geometry"]["doc_hash"] + "-s")
    m2 = c.get(f"/api/v1/floors/{w['f2']}/map").json()
    assert {a["resource_id"] for a in m2["anchors"] if a.get("shared")} == {w["cams"]["camD"]}, "a member anchored upstairs shows downstairs too"
    assert next(z for z in m2["zones"] if z["id"] == w["hall"])["shared"]["role"] == "home"


def test_re_review_n3_the_home_floors_own_items_under_the_overhang_stay_its_own(settings):
    """Re-review N3: shared content is explicit, not geometry. An object floor 2 draws on its own level under the upper
    outline (a locker under the tribune) is neither attached to floor 3, nor writable or deletable from it, nor
    published by floor 3's publish; the tribune's upper rows carrying `shared_space_id` are the hall's."""
    w = _wide(settings)
    c, f2 = w["c"], w["f2"]
    _share(w)
    _publish(c, w["v2"])
    _publish(c, w["v3"])
    g = _draft(c, w["v3"])
    ids = {o["id"] for o in g["doc"]["objects"] if "shared" in o}
    assert f"{f2}:rows-up" in ids and f"{f2}:locker" not in ids
    assert not any(o["id"] == f"{f2}:locker" for o in c.get(f"/api/v1/plan-versions/{w['v3']}/geometry").json()["doc"]["objects"])
    mark = {"zone_id": w["hall"], "home_floor_id": f2}
    rev2 = _draft(c, w["v2"])["geometry"]["revision"]
    # an edit of it sent from floor 3 is an "addition" of an id floor 2 already has: refused, nothing written
    doc = dict(g["doc"])
    doc["objects"] = [*doc["objects"], OBJ(f"{f2}:locker", [0.62, 0.35], shared=mark)]
    r = _put(c, w["v3"], doc, g["geometry"]["revision"])
    assert r.status_code == 422 and r.json()["code"] == "shared_id_taken"
    # listing it as deleted does nothing
    doc = dict(_draft(c, w["v3"])["doc"], shared_deleted=[f"{f2}:locker"])
    assert _put(c, w["v3"], doc, _draft(c, w["v3"])["geometry"]["revision"]).status_code == 200
    home = _draft(c, w["v2"])
    assert home["geometry"]["revision"] == rev2 and any(o["id"] == "locker" for o in home["doc"]["objects"])
    # floor 2 moves its locker in its draft: floor 3's publish counts nothing and publishes nothing of it
    objs = [dict(o, position=[0.63, 0.25]) if o["id"] == "locker" else o for o in home["doc"]["objects"]]
    assert _save(c, w["v2"], objects=objs).status_code == 200
    assert c.get(f"/api/v1/plan-versions/{w['v3']}/geometry/diff").json()["shared_pending"] == []
    assert c.post(f"/api/v1/plan-versions/{w['v3']}/geometry/publish").json()["shared_published"] == []
    assert next(o for o in _published(c, w["v2"])["objects"] if o["id"] == "locker")["position"] == [0.62, 0.3]
    # a bad shared_space_id is refused by the structure check
    g2 = _draft(c, w["v2"])["doc"]
    bad = [dict(o, shared_space_id=7) if o["id"] == "locker" else o for o in g2["objects"]]
    assert _save(c, w["v2"], objects=bad).status_code == 422


def test_re_review_lows_ids_names_publish_skip_schema_guard_and_anchor_moves(settings):
    w = _world(settings)
    c, f2, app = w["c"], w["f2"], w["app"]
    _share(w)
    mark = {"zone_id": w["hall"], "home_floor_id": f2}
    # an "addition" named like a WALL of floor 2 is refused too (no id reuse across collections)
    g = _draft(c, w["v3"])
    doc = dict(g["doc"])
    doc["objects"] = [*doc["objects"], OBJ(f"{f2}:hw2", [0.3, 0.3], shared=mark)]
    r = _put(c, w["v3"], doc, g["geometry"]["revision"])
    assert r.status_code == 422 and r.json()["code"] == "shared_id_taken"
    # the cached subset follows a rename of the home floor (the levels carry its name)
    _publish(c, w["v2"])
    _publish(c, w["v3"])
    name = lambda: next(lv["name"] for lv in c.get(f"/api/v1/plan-versions/{w['v3']}/geometry").json()["doc"]["levels"] if lv["id"] == f"{f2}:L0")
    assert name().endswith("קומה 2")
    assert c.patch(f"/api/v1/floors/{f2}", json={"name": "מגרש"}).status_code == 200
    assert name().endswith("מגרש")
    # a room item of floor 2's draft on a level that exists only in that draft: floor 3's publish names it and can go without it
    d2 = _draft(c, w["v2"])["doc"]
    levels = [*d2["levels"], {"id": "L9", "name": "יציע", "elevation_m": 2.0, "ceiling_height_m": 2.5, "is_default": False, "external_ids": {}}]
    objs = [dict(o, level_id="L9") if o["id"] == "trib" else o for o in d2["objects"]]
    labels = [dict(lb, position=[0.45, 0.5]) if lb["id"] == "lb-court" else lb for lb in d2["labels"]]
    assert _save(c, w["v2"], levels=levels, objects=objs, labels=labels).status_code == 200
    pend = c.get(f"/api/v1/plan-versions/{w['v3']}/geometry/diff").json()["shared_pending"]
    assert pend[0]["invalid"] is True and [i["id"] for i in pend[0]["items"]] == [f"{f2}:trib"]
    r = c.post(f"/api/v1/plan-versions/{w['v3']}/geometry/publish")
    assert r.status_code == 422 and r.json()["code"] == "shared_invalid" and [i["id"] for i in r.json()["details"]["items"]] == [f"{f2}:trib"]
    r = c.post(f"/api/v1/plan-versions/{w['v3']}/geometry/publish", json={"shared_skip": [f"{f2}:trib"]})
    assert r.status_code == 200 and r.json()["shared_published"][0]["changes"] == 1
    pub = _published(c, w["v2"])
    assert next(o for o in pub["objects"] if o["id"] == "trib")["level_id"] == "L0" and next(lb for lb in pub["labels"] if lb["id"] == "lb-court")["position"] == [0.45, 0.5]
    # a member anchored on floor 2, moved from floor 3's map: only inside the room
    a2 = w["anchors"]["camH2"]
    rev = next(a for a in c.get(f"/api/v1/floors/{w['f3']}/map").json()["anchors"] if a["id"] == a2)["revision"]
    r = c.patch(f"/api/v1/map-anchors/{a2}?from_floor_id={w['f3']}", json={"revision": rev, "x": 0.9, "y": 0.9})
    assert r.status_code == 422 and r.json()["code"] == "shared_outside"
    assert c.patch(f"/api/v1/map-anchors/{a2}?from_floor_id={w['f3']}", json={"revision": rev, "x": 0.5, "y": 0.5}).status_code == 200
    # the schema guard: a database that ran the first shape of the migration gets the column and the members table
    import sqlite3 as _sq

    mem = _sq.connect(":memory:")
    mem.execute("CREATE TABLE spatial_zones(id TEXT PRIMARY KEY)")
    mem.execute("CREATE TABLE floors(id TEXT PRIMARY KEY)")
    mem.execute("CREATE TABLE cache_versions(name TEXT PRIMARY KEY, version INTEGER)")
    mem.execute("CREATE TABLE shared_spaces(id TEXT PRIMARY KEY, zone_id TEXT, home_floor_id TEXT, floor_id TEXT, placement_json TEXT, revision INTEGER, created_by TEXT, "
                "created_at TEXT, updated_at TEXT, removed_at TEXT, removed_by TEXT)")
    assert ss.ensure_schema(mem) == ["shared_spaces.other_zone_id", "shared_space_members"]
    assert ss.ensure_schema(mem) == []
    assert "other_zone_id" in {r[1] for r in mem.execute("PRAGMA table_info(shared_spaces)")}


def test_an_alarm_managed_member_stays_read_only_on_every_floor_of_the_room(settings):
    """CR-010 x CR-009 (coordinator note at the merge): what the alarm owns is operated through the alarm section only -
    a shared room's alarm-managed member shows on the other floor's map read-only, like everywhere else."""
    w = _world(settings)
    c, app = w["c"], w["app"]
    eid = "alarm_control_panel.hall"
    with app.state.db.connection() as conn:
        ha_sync.upsert_state(conn, {"entity_id": eid, "state": "disarmed", "last_changed": "2026-09-29T09:00:00+00:00", "attributes": {"friendly_name": "לוח אזעקה"}})
    _anchor(c, w["f2"], "ha_entity", eid, 0.5, 0.5)
    # review M1: the alarm's own controls are no longer made members - neither by the conversion nor by hand
    r = c.post(f"/api/v1/zones/{w['hall']}/share", json={"floor_id": w["f3"]})
    assert r.status_code == 409 and r.json()["code"] == "alarm_managed" and eid in r.json()["details"]["entity_ids"], r.text
    assert c.post(f"/api/v1/zones/{w['hall']}/share/preview", json={"floor_id": w["f3"]}).status_code == 409
    # a membership row that already exists (a database from before the rule) still shows read-only on the other floor
    a = c.get(f"/api/v1/floors/{w['f2']}/map").json()["anchors"]
    aid = next(x["id"] for x in a if x["resource_id"] == eid)
    assert c.delete(f"/api/v1/map-anchors/{aid}").status_code == 204
    _share(w)
    _anchor(c, w["f2"], "ha_entity", eid, 0.5, 0.5)
    with app.state.db.connection() as conn:
        ss.add_member(conn, w["hall"], "ha_entity", eid, None, now_iso())
        assert ss.is_member(conn, w["hall"], "ha_entity", eid)
    m3 = c.get(f"/api/v1/floors/{w['f3']}/map").json()
    ent = next(a for a in m3["anchors"] if a["resource_id"] == eid and a.get("shared"))["entity"]
    assert ent["alarm_managed"] is True and ent["actions"] == []


def test_review_m1_an_alarm_panel_is_never_a_member_and_a_shared_room_widens_no_alarm_reach(settings):
    """Security review M1: an alarm.disarm holder of floor 3 only must not reach a panel of floor 2 through the shared room -
    not by the conversion, not by "הוסף לחלל המשותף", and not through a membership row that already exists."""
    w = _world(settings)
    c, app = w["c"], w["app"]
    panel = "alarm_control_panel.hall"
    with app.state.db.connection() as conn:
        ha_sync.upsert_state(conn, {"entity_id": panel, "state": "disarmed", "last_changed": "2026-09-29T09:00:00+00:00", "attributes": {"friendly_name": "לוח אזעקה"}})
    _share(w)  # the room is shared first (no panel in it yet)
    _anchor(c, w["f2"], "ha_entity", panel, 0.5, 0.5)
    url = f"/api/v1/zones/{w['hall']}/share/members"
    r = c.post(url, json={"resource_type": "ha_entity", "resource_id": panel})
    assert r.status_code == 409 and r.json()["code"] == "alarm_managed" and "אזעקה" in r.json()["user_message"], r.text
    with app.state.db.connection() as conn:
        assert not ss.is_member(conn, w["hall"], "ha_entity", panel)
    # a lookalike that is not an alarm control is still addable (the rule is not a blanket refusal of devices)
    assert c.post(url, json={"resource_type": "ha_entity", "resource_id": "light.corridor"}).status_code == 201
    # a row that predates the rule: the floor-3 holder of alarm.disarm still does not reach the panel of floor 2
    with app.state.db.connection() as conn:
        ss.add_member(conn, w["hall"], "ha_entity", panel, None, now_iso())
        placed = ha_scope.placements(conn)
        assert any(p.get("shared_from") for p in placed[panel]), "the generic reach helper does mirror it - the alarm must not count it"
    c.get("/api/v1/me", headers=as_user("fay"))
    _binding(settings, "fay", "site_admin", "floor", w["f3"])
    hdr = as_user("fay")
    body = c.get("/api/v1/alarm/panels", headers=hdr)
    assert body.status_code == 200 and body.json()["panels"] == []
    act = c.post(f"/api/v1/alarm/panels/{panel}/actions", json={"action": "disarm", "client_request_id": "m1-req", "expires_at": "2099-01-01T00:00:00Z", "confirmed": True}, headers=hdr)
    assert act.status_code in (403, 404), act.text
    # the admin still sees it through its own reach
    assert [p["entity_id"] for p in c.get("/api/v1/alarm/panels").json()["panels"]] == [panel]


def test_owner_members_list_filters_each_member_by_the_readers_own_permissions(settings):
    """Owner 2026-09-30, "חברים בחלל המשותף": whoever reaches any floor of the room sees the members their own permissions
    allow, each with the floors it is anchored on; the share rights (both floors) add and remove, others read only."""
    w = _world(settings)
    c, cams = w["c"], w["cams"]
    _share(w)
    for u in ("dana", "noa", "ofer", "zed"):
        c.get("/api/v1/me", headers=as_user(u))
    _binding(settings, "dana", "viewer", "floor", w["f3"])
    _binding(settings, "noa", "viewer", "floor", w["f3"])
    _binding(settings, "noa", "viewer", "camera", cams["camH"], effect="deny")
    _binding(settings, "ofer", "editor", "floor", w["f3"])
    url = f"/api/v1/zones/{w['hall']}/share/members"
    admin = c.get(url).json()
    ids = {(m["resource_type"], m["resource_id"]) for m in admin["members"]}
    assert ids == {("camera", cams["camH"]), ("camera", cams["camD"]), ("ha_entity", "light.hall")} and admin["can_manage"] is True
    camh = next(m for m in admin["members"] if m["resource_id"] == cams["camH"])
    assert camh["kind"] == "camera" and camh["name"] == "camH" and [f["floor_id"] for f in camh["floors"]] == [w["f2"]]
    assert {x["resource_id"] for x in admin["candidates"]} >= {cams["camA"], cams["cam3"], "light.corridor"}
    d = c.get(url, headers=as_user("dana"))
    assert d.status_code == 200 and d.json()["can_manage"] is False and "candidates" not in d.json()
    assert {m["resource_id"] for m in d.json()["members"]} == {cams["camH"], cams["camD"], "light.hall"}
    assert next(m for m in d.json()["members"] if m["resource_id"] == cams["camH"])["floors"][0]["name"] == "קומה אחרת", "floor 2 is not hers to name"
    # a deny on the hall camera hides it from her list AND from her map, though the room is shared
    n = c.get(url, headers=as_user("noa")).json()
    assert cams["camH"] not in {m["resource_id"] for m in n["members"]}
    assert cams["camH"] not in {a["resource_id"] for a in c.get(f"/api/v1/floors/{w['f3']}/map", headers=as_user("noa")).json()["anchors"]}
    assert c.get(url, headers=as_user("zed")).status_code == 403  # no floor of the room
    # removing needs the share rights on BOTH floors, like adding
    assert c.delete(f"{url}/camera/{cams['camD']}", headers=as_user("ofer")).status_code == 403
    assert c.delete(f"{url}/camera/{cams['camD']}").status_code == 204


def test_a_misplaced_placement_warns_to_check_the_alignment(settings):
    w = _wide(settings)
    c = w["c"]
    _share(w)
    s = c.get(f"/api/v1/zones/{w['hall']}/share/members").json()
    assert [f["floor_id"] for f in s["floors"]] == [w["f2"], w["f3"]]
    r = c.patch(f"/api/v1/zones/{w['hall']}/share/{w['f3']}", json={"revision": 1, "mode": "fit", "from": [0.4, 0.4], "to": [0.8, 0.8], "rotation_deg": 0, "scale": 1})
    assert r.status_code == 200, r.text
    d3 = _draft(c, w["v3"])
    assert d3["doc"]["shared_spaces"][0]["aligned"] is False
    assert [i["code"] for i in d3["issues"] if i["code"] == "shared_alignment"] == ["shared_alignment"]
    assert "ודא את יישור הקומות" in next(i["message"] for i in d3["issues"] if i["code"] == "shared_alignment")


# ---------------------------------------------------------------- editing from the other floor (decision 1, review B2 / M1 / M2)


def _put(c: TestClient, vid: str, doc: dict, rev: int, headers: dict | None = None):
    return c.put(f"/api/v1/plan-versions/{vid}/geometry", json={"doc": doc, "base_revision": rev}, headers=headers or {})


def test_an_edit_from_the_upper_floor_lands_in_the_home_draft_and_only_inside_the_room(settings):
    w = _wide(settings)
    c, f2 = w["c"], w["f2"]
    _share(w)
    g = _draft(c, w["v3"])
    doc = g["doc"]
    rev2 = _draft(c, w["v2"])["geometry"]["revision"]
    doc["objects"] = [dict(o, position=[0.5, 0.35], rotation_deg=10) if o["id"] == f"{f2}:trib" else o for o in doc["objects"]]
    doc["objects"].append(OBJ(f"{f2}:bench", [0.3, 0.72], "chair.basic", level_id="L0", shared={"zone_id": w["hall"], "home_floor_id": f2}))  # upper outline only
    r = _put(c, w["v3"], doc, g["geometry"]["revision"])
    assert r.status_code == 200, r.text
    home = _draft(c, w["v2"])
    assert home["geometry"]["revision"] == rev2 + 1
    objs = {o["id"]: o for o in home["doc"]["objects"]}
    assert objs["trib"]["position"] == [0.5, 0.35] and objs["trib"]["rotation_deg"] == 10 and "shared" not in objs["bench"]
    assert objs["bench"]["shared_space_id"] == w["hall"], "re-review N3: drawn under the upper level from floor 3 - explicitly the hall's"
    with w["app"].state.db.connection() as conn:
        det = json.loads(conn.execute("SELECT details_json FROM audit_log WHERE action = 'geometry.shared.edit'").fetchone()[0])
        assert det["from_floor_id"] == w["f3"] and det["zone_ids"] == [w["hall"]] and det["changed"] == 1 and det["added"] == 1
    # out of both outlines: refused, and nothing written (own edits included)
    g = _draft(c, w["v3"])
    doc = g["doc"]
    doc["objects"] = [dict(o, position=[0.9, 0.9]) if o["id"] == f"{f2}:trib" else o for o in doc["objects"]]
    doc["labels"] = doc["labels"] + [{"id": "own-label", "text": "קומה 3", "position": [0.9, 0.2], "level_id": "L0", "size": 14}]
    bad = _put(c, w["v3"], doc, g["geometry"]["revision"])
    assert bad.status_code == 422 and bad.json()["code"] == "shared_outside"
    assert _draft(c, w["v3"])["geometry"]["revision"] == g["geometry"]["revision"] and not any(lb["id"] == "own-label" for lb in _draft(c, w["v3"])["doc"]["labels"])
    # a deletion must be listed: left out, the tribune stays; listed, it goes
    g = _draft(c, w["v3"])
    doc = g["doc"]
    doc["objects"] = [o for o in doc["objects"] if o["id"] != f"{f2}:trib"]
    assert _put(c, w["v3"], doc, g["geometry"]["revision"]).status_code == 200
    assert "trib" in {o["id"] for o in _draft(c, w["v2"])["doc"]["objects"]}, "review M1: an item left out is never deleted"
    g = _draft(c, w["v3"])
    doc = dict(g["doc"], shared_deleted=[f"{f2}:trib"])
    doc["objects"] = [o for o in doc["objects"] if o["id"] != f"{f2}:trib"]
    assert _put(c, w["v3"], doc, g["geometry"]["revision"]).status_code == 200
    assert "trib" not in {o["id"] for o in _draft(c, w["v2"])["doc"]["objects"]} and "chair-out" in {o["id"] for o in _draft(c, w["v2"])["doc"]["objects"]}


def test_review_b2_an_addition_never_overwrites_the_home_floor_and_circuits_stay_inside(settings):
    w = _world(settings)
    c, f2 = w["c"], w["f2"]
    _share(w)
    mark = {"zone_id": w["hall"], "home_floor_id": f2}
    rev2 = _draft(c, w["v2"])["geometry"]["revision"]
    # an "addition" named like an item of the rest of floor 2 (the chair outside the hall) is refused
    g = _draft(c, w["v3"])
    doc = g["doc"]
    doc["objects"] = [*doc["objects"], OBJ(f"{f2}:chair-out", [0.3, 0.3], shared=mark)]
    r = _put(c, w["v3"], doc, g["geometry"]["revision"])
    assert r.status_code == 422 and r.json()["code"] == "shared_id_taken"
    # a wall or an opening sent as shared is never routed nor stored: walls are each floor's own
    doc = _draft(c, w["v3"])["doc"]
    doc["walls"] = [*doc["walls"], dict(WALL(f"{f2}:ext", [[0.0, 0.0], [1.0, 1.0]]), shared=mark)]
    doc["openings"] = [*doc["openings"], dict(DOOR(f"{f2}:dx", f"{f2}:out1", 0.5), shared=mark)]
    assert _put(c, w["v3"], doc, _draft(c, w["v3"])["geometry"]["revision"]).status_code == 200
    home = _draft(c, w["v2"])["doc"]
    assert next(x for x in home["walls"] if x["id"] == "ext")["polyline"] == [[0.05, 0.2], [0.9, 0.2]] and "dx" not in {o["id"] for o in home["openings"]}
    assert _draft(c, w["v2"])["geometry"]["revision"] == rev2
    # a circuit may hold only objects of the room
    g = _draft(c, w["v3"])
    doc = g["doc"]
    doc["circuits"] = [*doc["circuits"], {"id": f"{f2}:k1", "name": "אולם", "switch_entity_id": "light.hall", "member_ids": [f"{f2}:trib", f"{f2}:chair-out"],
                                          "color_token": "circuit-1", "power_w": 0, "shared": mark}]
    r = _put(c, w["v3"], doc, g["geometry"]["revision"])
    assert r.status_code == 422 and r.json()["code"] == "shared_outside"
    doc["circuits"][-1]["member_ids"] = [f"{f2}:trib"]
    assert _put(c, w["v3"], doc, g["geometry"]["revision"]).status_code == 200
    # ... and its switch is changed on its own floor only
    g = _draft(c, w["v3"])
    doc = g["doc"]
    doc["circuits"] = [dict(k, switch_entity_id="light.corridor") if k["id"] == f"{f2}:k1" else k for k in doc["circuits"]]
    r = _put(c, w["v3"], doc, g["geometry"]["revision"])
    assert r.status_code == 422 and r.json()["code"] == "shared_switch"


def test_re_review_n2_a_new_circuit_from_the_other_floor_cannot_name_any_switch(settings):
    """Re-review N2: deleting the room's circuit and adding a new one in the same save must not bring in a switch the
    editor may not control - a new circuit reuses a switch already in the room, or needs ha.entity.control on it."""
    w = _world(settings)
    c, f2 = w["c"], w["f2"]
    _share(w)
    mark = {"zone_id": w["hall"], "home_floor_id": f2}
    g = _draft(c, w["v3"])
    doc = g["doc"]
    doc["circuits"] = [*doc["circuits"], {"id": f"{f2}:k1", "name": "אולם", "switch_entity_id": "light.hall", "member_ids": [f"{f2}:trib"], "color_token": "circuit-1", "power_w": 0, "shared": mark}]
    assert _put(c, w["v3"], doc, g["geometry"]["revision"]).status_code == 200  # the admin (who controls it)
    c.get("/api/v1/me", headers=as_user("ofer"))
    _binding(settings, "ofer", "editor", "floor", w["f3"])  # map.edit on floor 3, no ha.entity.control anywhere
    hdr = as_user("ofer")

    def swap(switch: str, new_id: str):
        g = _draft(c, w["v3"], hdr)
        d = dict(g["doc"], shared_deleted=[f"{f2}:k1"])
        k = next(x for x in d["circuits"] if x["id"] == f"{f2}:k1")
        d["circuits"] = [x for x in d["circuits"] if x["id"] != f"{f2}:k1"] + [dict(k, id=f"{f2}:{new_id}", switch_entity_id=switch)]
        return _put(c, w["v3"], d, g["geometry"]["revision"], hdr)

    rev2 = _draft(c, w["v2"])["geometry"]["revision"]
    r = swap("light.corridor", "k2")
    assert r.status_code == 422 and r.json()["code"] == "shared_switch"
    assert _draft(c, w["v2"])["geometry"]["revision"] == rev2 and "k2" not in {k["id"] for k in _draft(c, w["v2"])["doc"]["circuits"]}
    # the same swap reusing the room's own switch is fine
    assert swap("light.hall", "k3").status_code == 200
    assert {k["id"]: k["switch_entity_id"] for k in _draft(c, w["v2"])["doc"]["circuits"]} == {"k3": "light.hall"}
    # an editor who may control the entity may name it
    c.get("/api/v1/me", headers=as_user("gil"))
    _binding(settings, "gil", "editor", "floor", w["f3"])
    _binding(settings, "gil", "operator", "floor", f2)
    g = _draft(c, w["v3"], as_user("gil"))
    d = g["doc"]
    d["circuits"] = [*d["circuits"], {"id": f"{f2}:k4", "name": "מסדרון", "switch_entity_id": "light.corridor", "member_ids": [f"{f2}:trib"], "color_token": "circuit-2", "power_w": 0, "shared": mark}]
    assert _put(c, w["v3"], d, g["geometry"]["revision"], as_user("gil")).status_code == 200



def test_review_l1_a_new_circuit_from_the_other_floor_cannot_take_an_alarm_managed_switch(settings):
    """Review L1: even a caller who controls every entity (the admin) cannot wire a NEW shared circuit to what the alarm owns."""
    w = _world(settings)
    c, app, f2 = w["c"], w["app"], w["f2"]
    _share(w)
    with app.state.db.connection() as conn:
        ha_sync.upsert_state(conn, {"entity_id": "alarm_control_panel.hall", "state": "disarmed", "last_changed": "2026-09-29T09:00:00+00:00", "attributes": {"friendly_name": "לוח אזעקה"}})
    mark = {"zone_id": w["hall"], "home_floor_id": f2}

    def add(switch: str, cid: str):
        g = _draft(c, w["v3"])
        doc = g["doc"]
        doc["circuits"] = [*doc["circuits"], {"id": f"{f2}:{cid}", "name": "אולם", "switch_entity_id": switch, "member_ids": [f"{f2}:trib"], "color_token": "circuit-1", "power_w": 0, "shared": mark}]
        return _put(c, w["v3"], doc, g["geometry"]["revision"])

    r = add("alarm_control_panel.hall", "k-alarm")
    assert r.status_code == 422 and r.json()["code"] == "shared_switch", r.text
    assert "k-alarm" not in {k["id"] for k in _draft(c, w["v2"])["doc"]["circuits"]}
    assert add("light.corridor", "k-ok").status_code == 200, "an ordinary switch the actor controls is still fine"


def test_review_m1_a_deny_on_the_home_floor_writes_nothing_and_a_stale_mirror_is_a_conflict(settings):
    w = _world(settings)
    c, f2 = w["c"], w["f2"]
    _share(w)
    c.get("/api/v1/me", headers=as_user("rami"))
    _binding(settings, "rami", "editor", "floor", w["f3"])
    _binding(settings, "rami", "viewer", "floor", f2, effect="deny")
    hdr = as_user("rami")
    rev2 = _draft(c, w["v2"])["geometry"]["revision"]
    g = _draft(c, w["v3"], hdr)
    assert not any("shared" in o for o in g["doc"]["objects"]), "denied the home floor: no content attached"
    # a crafted echo with no items, listing every id as deleted
    doc = dict(g["doc"], shared_spaces=[{"role": "mirror", "home_floor_id": f2, "zone_id": w["hall"], "home_revision": rev2}], shared_deleted=[f"{f2}:trib", f"{f2}:lb-court"])
    r = _put(c, w["v3"], doc, g["geometry"]["revision"], hdr)
    assert r.status_code == 403 and r.json()["code"] == "shared_denied" and "current_revision" not in json.dumps(r.json())
    assert _draft(c, w["v2"])["geometry"]["revision"] == rev2
    # a stale mirror: 409 with no revision leaked, nothing written
    stale = _draft(c, w["v3"])
    objs = [dict(o, position=[0.35, 0.3]) if o["id"] == "trib" else o for o in _draft(c, w["v2"])["doc"]["objects"]]
    assert _save(c, w["v2"], objects=objs).status_code == 200
    doc = stale["doc"]
    doc["objects"] = [dict(o, rotation_deg=45) if o["id"] == f"{f2}:trib" else o for o in doc["objects"]]
    r = _put(c, w["v3"], doc, stale["geometry"]["revision"])
    assert r.status_code == 409 and r.json()["details"]["shared"] is True and "current_revision" not in r.json()["details"]
    assert _draft(c, w["v3"])["geometry"]["revision"] == stale["geometry"]["revision"]
    # review M2: a stale revision of THIS floor is refused before any home write
    fresh = _draft(c, w["v3"])
    rev2b = _draft(c, w["v2"])["geometry"]["revision"]
    doc = fresh["doc"]
    doc["objects"] = [dict(o, rotation_deg=15) if o["id"] == f"{f2}:trib" else o for o in doc["objects"]]
    r = _put(c, w["v3"], doc, fresh["geometry"]["revision"] + 5)
    assert r.status_code == 409 and _draft(c, w["v2"])["geometry"]["revision"] == rev2b


def _published(c: TestClient, vid: str) -> dict:
    r = c.get(f"/api/v1/plan-versions/{vid}/geometry")
    assert r.status_code == 200, r.text
    return r.json()["doc"]


def test_owner_answer_1_publishing_the_other_floor_publishes_only_the_rooms_pending_changes_home(settings):
    """Owner answer 1 (2026-09-29): publishing floor 3 also publishes the hall's pending changes on floor 2 - only the
    elements inside the room; the rest of floor 2's draft stays a draft. The dialog counts them; both floors audit it;
    a deny on the home floor leaves it out."""
    w = _world(settings)
    c, f2 = w["c"], w["f2"]
    _share(w)
    _publish(c, w["v3"])  # the conversion's own changes on floor 3 go out first
    # from floor 3: the tribune turned; on floor 2 itself: the chair outside the hall moved, and the label moved out of it
    g = _draft(c, w["v3"])
    doc = g["doc"]
    doc["objects"] = [dict(o, rotation_deg=20) if o["id"] == f"{f2}:trib" else o for o in doc["objects"]]
    assert _put(c, w["v3"], doc, g["geometry"]["revision"]).status_code == 200
    home = _draft(c, w["v2"])["doc"]
    assert _save(c, w["v2"], objects=[dict(o, position=[0.75, 0.75]) if o["id"] == "chair-out" else o for o in home["objects"]],
                 labels=[dict(lb, position=[0.9, 0.9]) if lb["id"] == "lb-court" else lb for lb in home["labels"]]).status_code == 200
    diff = c.get(f"/api/v1/plan-versions/{w['v3']}/geometry/diff").json()
    assert [(p["home_floor_id"], p["changes"]) for p in diff["shared_pending"]] == [(f2, 1)]
    assert _draft(c, w["v3"])["shared_pending"][0]["changes"] == 1
    # a reader denied on floor 2 who may publish floor 3: nothing of floor 2 is counted or published
    c.get("/api/v1/me", headers=as_user("rami"))
    _binding(settings, "rami", "editor", "floor", w["f3"])
    deny = _binding(settings, "rami", "viewer", "floor", f2, effect="deny")
    assert c.get(f"/api/v1/plan-versions/{w['v3']}/geometry/diff", headers=as_user("rami")).json()["shared_pending"] == []
    r = c.post(f"/api/v1/plan-versions/{w['v3']}/geometry/publish", headers=as_user("rami"))
    assert r.status_code == 200 and r.json()["shared_published"] == []
    assert next(o for o in _published(c, w["v2"])["objects"] if o["id"] == "trib")["rotation_deg"] == 0
    with Database(settings.db_path).connection() as conn:
        conn.execute("DELETE FROM bindings WHERE id = ?", (deny,))
    # the owner publishes floor 3 (its own draft unchanged): the tribune goes out on floor 2, nothing else does
    r = c.post(f"/api/v1/plan-versions/{w['v3']}/geometry/publish")
    assert r.status_code == 200, r.text
    assert r.json()["unchanged"] is False and [(p["home_floor_id"], p["changes"]) for p in r.json()["shared_published"]] == [(f2, 1)]
    pub = _published(c, w["v2"])
    assert next(o for o in pub["objects"] if o["id"] == "trib")["rotation_deg"] == 20
    assert next(o for o in pub["objects"] if o["id"] == "chair-out")["position"] == [0.7, 0.7], "the rest of floor 2 stays a draft"
    assert next(lb for lb in pub["labels"] if lb["id"] == "lb-court")["position"] == [0.4, 0.5], "an item moved out of the room keeps its published place"
    draft2 = _draft(c, w["v2"])["doc"]
    assert next(o for o in draft2["objects"] if o["id"] == "chair-out")["position"] == [0.75, 0.75]
    with w["app"].state.db.connection() as conn:
        rows = conn.execute("SELECT resource_id, details_json FROM audit_log WHERE action = 'geometry.shared.publish' ORDER BY rowid").fetchall()
    assert sorted(r[0] for r in rows) == sorted([f2, w["f3"]])
    assert all(json.loads(d)["changes"] == 1 for _, d in rows)
    # nothing pending any more; publishing floor 2 itself works as before
    assert c.get(f"/api/v1/plan-versions/{w['v3']}/geometry/diff").json()["shared_pending"] == []
    _publish(c, w["v2"])
    assert next(o for o in _published(c, w["v2"])["objects"] if o["id"] == "chair-out")["position"] == [0.75, 0.75]


def test_review_l8_a_backup_from_before_shared_spaces_restores_and_a_new_one_round_trips(settings):
    """Review L8: a backup taken before migration 0038 (no shared_spaces / shared_space_members in it) restores cleanly -
    the replace empties both tables, the room is again drawn on its own floor only - and a backup of a shared room
    brings the share and its members back."""
    import io
    import zipfile

    w = _world(settings)
    c = w["c"]
    _share(w)
    assert c.get(f"/api/v1/zones/{w['hall']}/share/members").status_code == 200
    e = c.post("/api/v1/backups", json={"note": "shared"}).json()
    full = c.get(f"/api/v1/backups/{e['name']}/download").content
    buf = io.BytesIO()
    with zipfile.ZipFile(io.BytesIO(full)) as src, zipfile.ZipFile(buf, "w") as dst:
        for item in src.infolist():
            if item.filename in ("data/shared_spaces.json", "data/shared_space_members.json"):
                continue
            body = src.read(item.filename)
            if item.filename == "manifest.json":
                m = json.loads(body)
                m["schema_version"] = 36
                m["tables"] = [t for t in m.get("tables") or [] if t not in ("shared_spaces", "shared_space_members")] if isinstance(m.get("tables"), list) else m.get("tables")
                body = json.dumps(m).encode("utf-8")
            dst.writestr(item, body)
    old = c.post("/api/v1/backups/upload", files={"file": ("old.zip", buf.getvalue(), "application/zip")})
    assert old.status_code in (200, 201), old.text
    r = c.post(f"/api/v1/backups/{old.json()['name']}/restore", json={"mode": "replace", "scope": "project", "confirm": "RESTORE"})
    assert r.status_code == 200, r.text
    with w["app"].state.db.connection() as conn:
        assert conn.execute("SELECT COUNT(*) FROM shared_spaces").fetchone()[0] == 0
        assert conn.execute("SELECT COUNT(*) FROM shared_space_members").fetchone()[0] == 0
    g = _draft(c, w["v3"])
    assert not g["doc"].get("shared_spaces") and not any("shared" in o for o in g["doc"]["objects"])
    assert c.get(f"/api/v1/floors/{w['f3']}/map").status_code == 200
    # the backup of the shared room brings it back whole
    up = c.post("/api/v1/backups/upload", files={"file": ("full.zip", full, "application/zip")})
    assert c.post(f"/api/v1/backups/{up.json()['name']}/restore", json={"mode": "replace", "scope": "project", "confirm": "RESTORE"}).status_code == 200
    with w["app"].state.db.connection() as conn:
        assert conn.execute("SELECT COUNT(*) FROM shared_spaces WHERE removed_at IS NULL").fetchone()[0] == 1
        assert conn.execute("SELECT COUNT(*) FROM shared_space_members WHERE removed_at IS NULL").fetchone()[0] >= 1
    assert any(e.get("role") == "mirror" for e in _draft(c, w["v3"])["doc"].get("shared_spaces") or [])


def _as_browser(v: Any) -> Any:
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
    assert _put(c, w["v3"], doc, g["geometry"]["revision"]).status_code == 200
    assert _draft(c, w["v2"])["geometry"]["revision"] == rev2
    g = _draft(c, w["v3"])
    doc = g["doc"]
    doc["objects"] = doc["objects"] + [dict(OBJ(f"{f2}:bad", [0.3, 0.3]), size="large", shared={"zone_id": w["hall"], "home_floor_id": f2})]
    r = _put(c, w["v3"], doc, g["geometry"]["revision"])
    assert r.status_code == 422 and r.json()["code"] == "geometry_structure"
    assert _draft(c, w["v2"])["geometry"]["revision"] == rev2 and _draft(c, w["v3"])["geometry"]["revision"] == g["geometry"]["revision"]


# ---------------------------------------------------------------- members (review B1): reach is explicit


def _p(user: str) -> Principal:
    return Principal(f"dev-{user}", user, user, "dev")


def test_review_b1_geometry_grants_nothing_members_are_explicit(settings):
    w = _world(settings)
    c, app = w["c"], w["app"]
    _share(w)
    c.get("/api/v1/me", headers=as_user("dana"))
    c.get("/api/v1/me", headers=as_user("ofer"))
    _binding(settings, "dana", "viewer", "floor", w["f3"])
    _binding(settings, "ofer", "editor", "floor", w["f3"])
    cams = w["cams"]

    def dana_cams() -> set[str]:
        with app.state.db.connection() as conn:
            return set(camera_scope(conn, _p("dana"), "map.read").ids)

    assert cams["camA"] not in dana_cams()
    # a floor-3 editor swallows the whole plan with the room's outline: refused (rights on every floor of the room)
    z3 = next(z for z in c.get(f"/api/v1/floors/{w['f3']}/zones").json()["zones"] if z["id"] == w["dup"])
    whole = [{"x": 0, "y": 0}, {"x": 1, "y": 0}, {"x": 1, "y": 1}, {"x": 0, "y": 1}]
    assert c.patch(f"/api/v1/zones/{w['dup']}", json={"revision": z3["revision"], "polygon": whole}, headers=as_user("ofer")).status_code == 403
    # the admin grows the HOME outline over the whole plan and moves camA into it: still nothing for dana
    zh = next(z for z in c.get(f"/api/v1/floors/{w['f2']}/zones").json()["zones"] if z["id"] == w["hall"])
    assert c.patch(f"/api/v1/zones/{w['hall']}", json={"revision": zh["revision"], "polygon": whole}).status_code == 200
    assert c.patch(f"/api/v1/map-anchors/{w['anchors']['camA']}", json={"revision": 1, "x": 0.4, "y": 0.4}).status_code == 200
    assert cams["camA"] not in dana_cams()
    m2 = c.get(f"/api/v1/floors/{w['f2']}/map").json()
    assert next(a for a in m2["anchors"] if a["id"] == w["anchors"]["camA"]).get("room_candidate") == w["hall"], "the editor is offered to add it"
    m3 = c.get(f"/api/v1/floors/{w['f3']}/map", headers=as_user("dana")).json()
    assert cams["camA"] not in {a["resource_id"] for a in m3["anchors"]}
    # adding it needs the share rights: a floor-3 editor is refused, the admin is not
    assert c.post(f"/api/v1/zones/{w['hall']}/share/members", json={"resource_type": "camera", "resource_id": cams["camA"]}, headers=as_user("ofer")).status_code == 403
    r = c.post(f"/api/v1/zones/{w['hall']}/share/members", json={"resource_type": "camera", "resource_id": cams["camA"]})
    assert r.status_code == 201 and r.json()["added"] is True
    assert cams["camA"] in dana_cams()
    # removing it narrows at once and marks open streams (review M5)
    import time as _t

    from smplwise.services import revocation

    t0 = _t.time()
    assert c.delete(f"/api/v1/zones/{w['hall']}/share/members/camera/{cams['camA']}").status_code == 204
    assert cams["camA"] not in dana_cams() and revocation.revoked_since("dev-dana", t0)


def test_re_review_n1_a_member_taken_off_the_rooms_floors_loses_its_reach_and_its_membership(settings):
    """Re-review N1: a hall camera taken off the map and placed on a floor outside the room is no longer reachable by a
    user of the room's other floor - the membership ends with its last anchor on the room's floors (audited)."""
    w = _world(settings)
    c, app = w["c"], w["app"]
    _share(w)
    c.get("/api/v1/me", headers=as_user("dana"))
    _binding(settings, "dana", "viewer", "floor", w["f3"])
    cam = w["cams"]["camH"]

    def dana_cams() -> set[str]:
        with app.state.db.connection() as conn:
            return set(camera_scope(conn, _p("dana"), "map.read").ids)

    assert cam in dana_cams()
    with app.state.db.connection() as conn:
        live = [r[0] for r in conn.execute("SELECT id FROM map_anchors WHERE resource_type = 'camera' AND resource_id = ? AND effective_to IS NULL", (cam,)).fetchall()]
        assert ss.is_member(conn, w["hall"], "camera", cam)
    for aid in live:
        assert c.delete(f"/api/v1/map-anchors/{aid}").status_code == 204
    f9 = c.post(f"/api/v1/buildings/{w['ids']['building']}/floors", json={"name": "קומה 9", "level": 9}).json()["id"]
    _plan(c, f9)
    _anchor(c, f9, "camera", cam, 0.5, 0.5)
    assert cam not in dana_cams()
    with app.state.db.connection() as conn:
        assert not ss.is_member(conn, w["hall"], "camera", cam)
        assert ss.camera_shared_floors(conn, cam) == []
        row = conn.execute("SELECT details_json FROM audit_log WHERE action = 'zone.share.member_remove' ORDER BY rowid DESC LIMIT 1").fetchone()
        assert row is not None and json.loads(row[0])["reason"] == "anchor_removed"
    m3 = c.get(f"/api/v1/floors/{w['f3']}/map", headers=as_user("dana")).json()
    assert cam not in {a["resource_id"] for a in m3["anchors"]}
    # a member whose membership row outlived its anchors (an older database) grants nothing either
    with app.state.db.connection() as conn:
        ss.add_member(conn, w["hall"], "camera", cam, None, now_iso())
        assert ss.camera_shared_floors(conn, cam) == [] and ("camera", cam) not in ss.mirrored_anchor_floors(conn)
    assert cam not in dana_cams()


def test_a_user_of_the_upper_floor_only_reaches_the_halls_members_and_nothing_else_of_the_home_floor(settings):
    w = _world(settings)
    c, app = w["c"], w["app"]
    _share(w)
    c.get("/api/v1/me", headers=as_user("dana"))
    _binding(settings, "dana", "viewer", "floor", w["f3"])
    with app.state.db.connection() as conn:
        scope = camera_scope(conn, _p("dana"), "map.read")
        assert w["cams"]["camH"] in scope.ids and w["cams"]["camD"] in scope.ids and w["cams"]["cam3"] in scope.ids
        assert w["cams"]["camA"] not in scope.ids
        placed = ha_scope.placements(conn)
        wide, floors = ha_scope.visible_floors(conn, _p("dana"), "entity.state.read")
        assert ha_scope.entity_visible(wide, floors, placed, "light.hall") and not ha_scope.entity_visible(wide, floors, placed, "light.corridor")
    hdr = as_user("dana")
    m3 = c.get(f"/api/v1/floors/{w['f3']}/map", headers=hdr).json()
    assert {a["resource_id"] for a in m3["anchors"]} == {w["cams"]["camH"], w["cams"]["camD"], w["cams"]["cam3"], "light.hall"}
    assert c.get(f"/api/v1/floors/{w['f2']}/map", headers=hdr).status_code == 403
    cams = {x["id"] for x in c.get("/api/v1/cameras", headers=hdr).json()["cameras"]}
    assert w["cams"]["camH"] in cams and w["cams"]["camA"] not in cams
    pub = c.get(f"/api/v1/plan-versions/{w['v3']}/geometry", headers=hdr)
    assert pub.status_code == 200 and any(o["id"] == f"{w['f2']}:trib" for o in pub.json()["doc"]["objects"])
    assert pub.json()["doc"]["shared_spaces"][0]["home_floor_name"] == "קומה אחרת", "review L1: the home floor is not named to her"
    res = c.get("/api/v1/search?q=אולם", headers=hdr).json()["results"]
    assert {x["floor_id"] for x in res if x["kind"] == "zone"} == {w["f3"]}
    tree = c.get("/api/v1/sites", headers=hdr).json()
    floors_listed = [f for s in tree["sites"] for b in s["buildings"] for f in b["floors"]]
    assert [f["id"] for f in floors_listed] == [w["f3"]] and floors_listed[0]["shared_camera_count"] == 1
    # un-share: the reach is gone on the very next request, and the members with it
    assert c.delete(f"/api/v1/zones/{w['hall']}/share/{w['f3']}").status_code == 204
    with app.state.db.connection() as conn:
        assert w["cams"]["camH"] not in camera_scope(conn, _p("dana"), "map.read").ids
        assert ss.member_rows(conn, w["hall"]) == []
    m3 = c.get(f"/api/v1/floors/{w['f3']}/map", headers=hdr).json()
    assert {a["resource_id"] for a in m3["anchors"]} == {w["cams"]["cam3"], w["cams"]["camD"]}


def test_deny_still_wins_on_either_floor_for_cameras_and_entities_alike(settings):
    w = _world(settings)
    c, app = w["c"], w["app"]
    _share(w)
    for u in ("eli", "noa", "tal"):
        c.get("/api/v1/me", headers=as_user(u))
    _binding(settings, "eli", "viewer", "floor", w["f3"])
    _binding(settings, "eli", "viewer", "floor", w["f2"], effect="deny")  # denied the home floor
    _binding(settings, "noa", "viewer", "floor", w["f3"])
    _binding(settings, "noa", "viewer", "camera", w["cams"]["camH"], effect="deny")  # denied the hall's camera
    _binding(settings, "tal", "viewer", "floor", w["f2"])
    _binding(settings, "tal", "viewer", "floor", w["f3"], effect="deny")  # review L3: denied the OTHER floor
    with app.state.db.connection() as conn:
        eli = camera_scope(conn, _p("eli"), "map.read")
        assert w["cams"]["camH"] not in eli.ids and w["cams"]["camD"] not in eli.ids and w["cams"]["cam3"] in eli.ids
        wide, floors = ha_scope.visible_floors(conn, _p("eli"), "entity.state.read")
        assert not ha_scope.entity_visible(wide, floors, ha_scope.placements(conn), "light.hall")
        noa = camera_scope(conn, _p("noa"), "map.read")
        assert w["cams"]["camH"] not in noa.ids and w["cams"]["camD"] in noa.ids
        tal = camera_scope(conn, _p("tal"), "map.read")
        wide, floors = ha_scope.visible_floors(conn, _p("tal"), "entity.state.read")
        assert w["cams"]["camH"] not in tal.ids and w["cams"]["camA"] in tal.ids
        assert not ha_scope.entity_visible(wide, floors, ha_scope.placements(conn), "light.hall"), "the entity behaves as the camera does"
        assert ha_scope.entity_visible(wide, floors, ha_scope.placements(conn), "light.corridor")
    m3 = c.get(f"/api/v1/floors/{w['f3']}/map", headers=as_user("eli")).json()
    assert {a["resource_id"] for a in m3["anchors"]} == {w["cams"]["cam3"]} and not any(o for o in [])
    g = c.get(f"/api/v1/plan-versions/{w['v3']}/geometry", headers=as_user("eli"))
    assert not any("shared" in o for o in g.json()["doc"]["objects"]) and "-s" not in g.headers["etag"]


def test_sharing_widens_reach_so_it_needs_every_floor_and_every_member_camera(settings):
    w = _world(settings)
    c = w["c"]
    for u in ("ofer", "gal"):
        c.get("/api/v1/me", headers=as_user(u))
    _binding(settings, "ofer", "editor", "floor", w["f3"])
    assert c.post(f"/api/v1/zones/{w['hall']}/share/preview", json={"floor_id": w["f3"]}, headers=as_user("ofer")).status_code == 403
    _binding(settings, "gal", "editor", "floor", w["f3"])
    _binding(settings, "gal", "editor", "floor", w["f2"])
    _binding(settings, "gal", "editor", "camera", w["cams"]["camD"], effect="deny")  # review M3a: a member camera from floor 3
    assert c.post(f"/api/v1/zones/{w['hall']}/share/preview", json={"floor_id": w["f3"]}, headers=as_user("gal")).status_code == 200
    assert c.post(f"/api/v1/zones/{w['hall']}/share", json={"floor_id": w["f3"]}, headers=as_user("gal")).status_code == 403
    with w["app"].state.db.connection() as conn:
        assert conn.execute("SELECT COUNT(*) FROM shared_spaces").fetchone()[0] == 0


def test_review_l3_the_member_routes_check_the_permission_before_saying_the_room_is_not_shared(settings):
    """Review L3: a caller without rights on the room's floor learns nothing about whether it is shared - 403, not 404."""
    w = _world(settings)
    c = w["c"]
    for u in ("zed", "dana"):
        c.get("/api/v1/me", headers=as_user(u))
    _binding(settings, "dana", "viewer", "floor", w["f2"])  # reads the home floor, cannot manage
    url = f"/api/v1/zones/{w['hall']}/share/members"
    body = {"resource_type": "camera", "resource_id": w["cams"]["camA"]}
    assert c.get(url).status_code == 404 and c.post(url, json=body).status_code == 404, "the administrator: the room is simply not shared"
    assert c.get(url, headers=as_user("zed")).status_code == 403
    assert c.post(url, json=body, headers=as_user("zed")).status_code == 403
    assert c.get(url, headers=as_user("dana")).status_code == 404, "a reader of the home floor may ask"
    assert c.post(url, json=body, headers=as_user("dana")).status_code == 403, "but not add"
    _share(w)
    assert c.get(url, headers=as_user("zed")).status_code == 403


def test_the_other_floors_editor_edits_the_room_and_its_members_with_map_edit_there(settings):
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
    assert _put(c, w["v3"], doc, g["geometry"]["revision"], hdr).status_code == 200
    assert next(o for o in _draft(c, w["v2"])["doc"]["objects"] if o["id"] == "trib")["position"] == [0.42, 0.32]
    m3 = c.get(f"/api/v1/floors/{w['f3']}/map", headers=hdr).json()
    light = next(a for a in m3["anchors"] if a["resource_id"] == "light.hall")
    assert c.patch(f"/api/v1/map-anchors/{light['id']}?from_floor_id={w['f3']}", json={"revision": light["revision"], "x": 0.31, "y": 0.31}, headers=hdr).status_code == 200
    corr = w["anchors"]["corr"]  # not a member: never editable from floor 3
    r = c.patch(f"/api/v1/map-anchors/{corr}?from_floor_id={w['f3']}", json={"revision": 1, "x": 0.9, "y": 0.52}, headers=hdr)
    assert r.status_code == 422 and r.json()["code"] == "not_shared"
    # a camera placed on floor 3 inside the room stays on floor 3 and is only a candidate until added (review B1)
    made = c.post(f"/api/v1/floors/{w['f3']}/anchors", json={"resource_type": "ha_entity", "resource_id": "light.stage", "x": 0.4, "y": 0.4}, headers=hdr)
    assert made.status_code == 201 and made.json()["floor_id"] == w["f3"]
    m3 = c.get(f"/api/v1/floors/{w['f3']}/map", headers=hdr).json()
    assert next(a for a in m3["anchors"] if a["resource_id"] == "light.stage").get("room_candidate") == w["hall"]


def test_zone_anchor_edits_from_the_other_floor_go_through_the_placement(settings):
    w = _world(settings, png3=png_bytes(800, 400, color=(250, 240, 240)))
    c = w["c"]
    r = _share(w, duplicate_zone_id=w["dup"], rotation_deg=90)
    assert r["placement"]["mode"] == "fit" and r["placement"]["rotation_deg"] == 90
    m3 = c.get(f"/api/v1/floors/{w['f3']}/map").json()
    cam = next(a for a in m3["anchors"] if a.get("shared") and a["resource_id"] == w["cams"]["camH"])
    x, y = cam["position"]["x"] + 0.01, cam["position"]["y"]
    up = c.patch(f"/api/v1/map-anchors/{cam['id']}?from_floor_id={w['f3']}", json={"revision": cam["revision"], "x": x, "y": y, "rotation_degrees": (cam["rotation_degrees"] + 15) % 360})
    assert up.status_code == 200, up.text
    assert up.json()["floor_id"] == w["f2"]
    again = next(a for a in c.get(f"/api/v1/floors/{w['f3']}/map").json()["anchors"] if a["id"] == cam["id"])
    assert again["position"]["x"] == pytest.approx(x, abs=1e-4) and again["position"]["y"] == pytest.approx(y, abs=1e-4)
    assert again["rotation_degrees"] == pytest.approx((cam["rotation_degrees"] + 15) % 360, abs=1e-2)
    # camD, a member anchored upstairs, shows downstairs at the transformed place
    m2 = c.get(f"/api/v1/floors/{w['f2']}/map").json()
    d = next(a for a in m2["anchors"] if a["resource_id"] == w["cams"]["camD"])
    assert d["shared"]["home_floor_id"] == w["f3"] and 0 <= d["position"]["x"] <= 1


# ---------------------------------------------------------------- zones of a shared room (review M4)


def test_review_m4_a_shared_room_is_not_deleted_or_replaced_under_the_share(settings):
    w = _world(settings)
    c = w["c"]
    _share(w)
    for zid in (w["hall"], w["dup"]):
        r = c.delete(f"/api/v1/zones/{zid}")
        assert r.status_code == 409 and r.json()["code"] == "zone_shared"
    with w["app"].state.db.connection() as conn:
        conn.execute("UPDATE spatial_zones SET source = 'auto' WHERE id = ?", (w["hall"],))
    r = c.post(f"/api/v1/floors/{w['f2']}/zones/accept", json={"candidates": [{"polygon": HALL, "name": "חדש"}], "replace_auto": True})
    assert r.status_code == 201 and w["hall"] in {z["id"] for z in r.json()["zones"]}


def test_history_and_camera_only_readers(settings):
    w = _world(settings)
    c = w["c"]
    before = now_iso()
    import time

    time.sleep(1.1)
    _share(w)
    m = c.get(f"/api/v1/floors/{w['f3']}/map?at={before}").json()
    assert not any(a.get("shared") for a in m["anchors"])
    c.get("/api/v1/me", headers=as_user("cam"))
    _binding(settings, "cam", "viewer", "camera", w["cams"]["camH"])
    m3 = c.get(f"/api/v1/floors/{w['f3']}/map", headers=as_user("cam")).json()
    assert m3["reach"] == "cameras" and m3["zones"] == [] and {a["resource_id"] for a in m3["anchors"]} == {w["cams"]["camH"]}


def test_review_l4_alignment_and_unshare_take_the_share_rights_on_both_floors(settings):
    w = _world(settings)
    c = w["c"]
    _share(w)
    for u in ("only3", "only2", "both"):
        c.get("/api/v1/me", headers=as_user(u))
    _binding(settings, "only3", "editor", "floor", w["f3"])
    _binding(settings, "only2", "editor", "floor", w["f2"])
    _binding(settings, "both", "editor", "floor", w["f2"])
    _binding(settings, "both", "editor", "floor", w["f3"])
    url = f"/api/v1/zones/{w['hall']}/share/{w['f3']}"
    body = {"revision": 1, "mode": "fit", "from": [0.4, 0.4], "to": [0.8, 0.8], "rotation_deg": 0, "scale": 1}
    for u in ("only3", "only2"):
        assert c.patch(url, json=body, headers=as_user(u)).status_code == 403, u
        assert c.delete(url, headers=as_user(u)).status_code == 403, u  # before L4 either floor was enough
    with w["app"].state.db.connection() as conn:
        assert len(ss.shares_of_zone(conn, w["hall"])) == 1
    deny = _binding(settings, "both", "editor", "floor", w["f3"], effect="deny")  # a deny on one floor wins over the allow on the other
    assert c.delete(url, headers=as_user("both")).status_code == 403
    with w["app"].state.db.connection() as conn:
        conn.execute("DELETE FROM bindings WHERE id = ?", (deny,))
    assert c.patch(url, json=body, headers=as_user("both")).status_code == 200
    assert c.delete(url, headers=as_user("both")).status_code == 204


def _live_share_rows(w: dict) -> tuple[int, int]:
    with w["app"].state.db.connection() as conn:
        return (conn.execute("SELECT COUNT(*) FROM shared_spaces WHERE removed_at IS NULL").fetchone()[0],
                conn.execute("SELECT COUNT(*) FROM shared_space_members WHERE removed_at IS NULL").fetchone()[0])


def test_review_l5_force_deleting_the_other_floor_ends_the_share_and_the_rooms_members(settings):
    w = _world(settings)
    c = w["c"]
    _share(w)
    shares, members = _live_share_rows(w)
    assert shares == 1 and members >= 1
    assert c.delete(f"/api/v1/floors/{w['f3']}").status_code == 409
    assert c.delete(f"/api/v1/floors/{w['f3']}?force=true").status_code == 204
    assert _live_share_rows(w) == (0, 0)
    with w["app"].state.db.connection() as conn:
        assert ss.member_rows(conn) == [] and ss.mirrored_anchor_floors(conn) == {}
        assert conn.execute("SELECT COUNT(*) FROM audit_log WHERE action = 'zone.unshare' AND resource_id = ?", (w["f3"],)).fetchone()[0] == 1
    # the home floor stays whole: its room is an ordinary room again, and it can be shared anew later
    assert not any(a.get("shared") for a in c.get(f"/api/v1/floors/{w['f2']}/map").json()["anchors"])


def test_review_l5_force_deleting_the_home_floor_ends_the_room_too(settings):
    w = _world(settings)
    c = w["c"]
    _share(w)
    assert c.delete(f"/api/v1/floors/{w['f2']}?force=true").status_code == 204
    assert _live_share_rows(w) == (0, 0)
    assert not any(a.get("shared") for a in c.get(f"/api/v1/floors/{w['f3']}/map").json()["anchors"])


# ------------------------------------------------ integration-review lows (SS1, 2.0.3)


def test_ss1_a_room_that_already_belongs_to_a_share_is_never_a_candidate_nor_the_auto_pick(settings):
    """The other floor's outline of a shared room (its duplicate) must not be offered again - the explicit choice was refused
    already (`already_shared`), the auto-detect silently took it as a second room's outline."""
    w = _world(settings)
    c = w["c"]
    _share(w)  # the hall <-> floor 3, through the duplicate
    far = [{"x": 0.65, "y": 0.65}, {"x": 0.9, "y": 0.65}, {"x": 0.9, "y": 0.9}, {"x": 0.65, "y": 0.9}]
    hall2 = c.post(f"/api/v1/floors/{w['f2']}/zones", json={"name": "אולם ספורט", "polygon": far}).json()["id"]
    with w["app"].state.db.connection() as conn:
        zone = conn.execute("SELECT * FROM spatial_zones WHERE id = ?", (hall2,)).fetchone()
        assert w["dup"] not in {x["zone_id"] for x in ss.candidates(conn, zone, w["f3"], True)}
    pv = c.post(f"/api/v1/zones/{hall2}/share/preview", json={"floor_id": w["f3"]})
    assert pv.status_code == 200, pv.text
    assert pv.json()["duplicate"] is None and pv.json()["outline"]["zone_id"] is None, "a new outline is drawn, the first room's is left alone"
    assert all(x["zone_id"] != w["dup"] for x in pv.json()["candidates"])


def test_ss1_unsharing_one_of_two_floors_ends_the_members_anchored_only_on_it(settings):
    w = _world(settings)
    c, app = w["c"], w["app"]
    _share(w)  # floor 3
    f9 = c.post(f"/api/v1/buildings/{w['ids']['building']}/floors", json={"name": "קומה 9", "level": 9}).json()["id"]
    _plan(c, f9)
    cam9 = c.post("/api/v1/cameras", json={"channel": 9, "alias": "cam9"}).json()["id"]
    _anchor(c, f9, "camera", cam9, 0.4, 0.4)
    r = c.post(f"/api/v1/zones/{w['hall']}/share", json={"floor_id": f9})
    assert r.status_code == 200, r.text
    camd, camh = w["cams"]["camD"], w["cams"]["camH"]
    with app.state.db.connection() as conn:
        assert all(ss.is_member(conn, w["hall"], "camera", k) for k in (camd, camh, cam9))
    assert c.delete(f"/api/v1/zones/{w['hall']}/share/{w['f3']}").status_code == 204
    with app.state.db.connection() as conn:
        assert not ss.is_member(conn, w["hall"], "camera", camd), "anchored only on floor 3, which left the room"
        assert ss.is_member(conn, w["hall"], "camera", cam9) and ss.is_member(conn, w["hall"], "camera", camh)
    assert c.delete(f"/api/v1/zones/{w['hall']}/share/{f9}").status_code == 204
    with app.state.db.connection() as conn:
        assert ss.member_rows(conn) == []


def test_ss1_the_centroid_of_a_room_without_corners_is_not_a_division_by_zero():
    assert ss._centroid([]) == (0.0, 0.0)
    assert ss._centroid([(0.0, 0.0), (2.0, 0.0), (2.0, 2.0), (0.0, 2.0)]) == (1.0, 1.0)
