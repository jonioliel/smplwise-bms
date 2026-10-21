"""FRIGATE-295 phase 3: the 0.18 abilities Arx did not use yet, end to end against the 0.18.2-shaped fake Frigate.

- named runtime switches of ONE zone / motion mask / object mask of ONE camera (`PUT /api/camera/{cam}/set/{kind}/{name}`), class `analytics`;
- an Arx export put into (or out of) a Frigate case (`POST /api/exports/reassign`), and a case named on export creation, class `exports`;
- the clip of one review item (`GET /api/review/{id}/clip.mp4`), behind the same first-supervised-read gate as the other clips.
"""
from __future__ import annotations

import sys
from pathlib import Path

from smplwise.services.recorders import frigate_http as fh

sys.path.insert(0, str(Path(__file__).resolve().parent))
sys.path.insert(0, str(Path(__file__).resolve().parent / "fixtures"))
from conftest import as_user, bind  # noqa: E402
from test_frigate_control import BASE, World, _clean, world  # noqa: E402,F401  (fixtures)
from test_frigate_f2b import _export  # noqa: E402


def _named(w: World) -> None:
    cam = w.fake.cameras["cam_front"]
    cam["zones"]["porch"].update({"enabled": True, "enabled_in_config": True})
    cam["zones"]["drive"] = {"coordinates": "0.5,0.5,0.9,0.5,0.9,0.9", "enabled": False, "enabled_in_config": False}
    cam.setdefault("motion", {})["mask"] = {"tree": {"friendly_name": "Tree", "enabled": True, "enabled_in_config": True, "coordinates": "0,0,0.2,0,0.2,0.2"}}


# ---------------------------------------------------------------------------------------------- named zone / mask switches

def test_named_switches_are_listed_switched_read_back_and_undone(world):
    _named(world)
    cid = world.cams()["cam_front"]
    view = world.call("GET", f"{BASE}/cameras/{cid}/control").json()
    named = {n["feature"]: n for n in view["named"]}
    assert named["zone:porch"]["value"] is True and named["zone:drive"]["value"] is False and named["motion_mask:tree"]["kind"] == "motion_mask"
    assert {f["feature"] for f in view["features"]}.isdisjoint(named), "the fixed switch list the drawer knows is unchanged"
    assert world.toggle("cam_front", "zone:porch", False).json()["code"] == "frigate_write_class_off"
    world.policy(analytics=True)
    r = world.toggle("cam_front", "zone:porch", False).json()
    assert r["changed"] is True and r["verified"] is True and world.fake.cameras["cam_front"]["zones"]["porch"]["enabled"] is False
    assert world.fake.writes[-1] == ("PUT", "/api/camera/cam_front/set/zone/porch", {"value": "OFF"})
    m = world.toggle("cam_front", "motion_mask:tree", False).json()
    assert m["verified"] is True and world.fake.writes[-1] == ("PUT", "/api/camera/cam_front/set/motion_mask/tree", {"value": "OFF"})
    undo = world.call("POST", f"{BASE}/changes/{r['change_id']}/revert", json={})
    assert undo.status_code == 200 and undo.json()["verified"] is True and world.fake.cameras["cam_front"]["zones"]["porch"]["enabled"] is True


def test_frigate_ignoring_a_switch_is_reported_unverified_and_an_unknown_name_is_never_sent(world):
    _named(world)
    world.policy(analytics=True)
    r = world.toggle("cam_front", "zone:drive", True).json()   # disabled in Frigate's YAML: Frigate answers 200 and ignores ON
    assert r["changed"] is True and r["verified"] is False and r["observed"] is False and world.changes()[0]["status"] == "unverified"
    n = len(world.fake.writes)
    missing = world.toggle("cam_front", "zone:nosuch", False)
    assert missing.status_code == 404 and missing.json()["code"] == "frigate_feature_unknown" and len(world.fake.writes) == n
    for bad in ("zone:", "zone:a/b", "fence:porch", "zone:" + "x" * 65):
        assert world.toggle("cam_front", bad, False).status_code in (404, 422), bad
    assert len(world.fake.writes) == n


def test_named_switch_paths_are_one_camera_one_name_only():
    ok = "/api/camera/cam_front/set/zone/porch"
    assert fh.write_allowed("analytics", "PUT", ok) and not fh.write_allowed("record", "PUT", ok)
    for bad in ("/api/camera/*/set/zone/porch", "/api/camera/cam_front/set/zone/../detect", "/api/camera/cam_front/set/zone/a/b",
                "/api/camera/cam_front/set/detect/sub", "/api/camera/cam_front/set/profile/x"):
        assert not fh.write_allowed("analytics", "PUT", bad), bad


# ---------------------------------------------------------------------------------------------- exports in cases

def test_an_arx_export_is_put_into_a_case_taken_out_and_the_move_is_undone(world):
    world.policy(exports=True, cases=True)
    eid = _export(world).json()["export_id"]
    url = f"{BASE}/exports/{eid}/case"
    assert world.call("POST", url, json={"case_id": "case_foreign"}).json()["code"] == "frigate_first_write_unsupervised"
    r = world.call("POST", url, json={"case_id": "case_foreign", "supervised": True}).json()
    assert r["changed"] is True and r["verified"] is True and r["case_id"] == "case_foreign"
    assert world.fake.writes[-1] == ("POST", "/api/exports/reassign", {"ids": [eid], "export_case_id": "case_foreign"})
    assert world.call("POST", url, json={"case_id": "case_foreign"}).json()["changed"] is False
    out = world.call("POST", url, json={"case_id": None}).json()
    assert out["verified"] is True and world.fake.writes[-1] == ("POST", "/api/exports/reassign", {"ids": [eid], "export_case_id": None})
    undo = world.call("POST", f"{BASE}/changes/{out['change_id']}/revert", json={})
    assert undo.status_code == 200 and next(x for x in world.fake.exports if x["id"] == eid)["export_case"] == "case_foreign"
    assert world.call("POST", url, json={"case_id": "no_such_case"}).status_code == 404
    assert world.call("POST", f"{BASE}/exports/cam_front_foreign/case", json={"case_id": "case_foreign", "supervised": True}).json()["code"] == "frigate_object_not_arx"


def test_an_export_can_be_created_straight_into_a_case(world):
    world.policy(exports=True)
    r = _export(world, case_id="case_foreign").json()
    assert r["verified"] is True and world.fake.writes[-1][2] == {"name": "Front door evening", "source": "recordings", "export_case_id": "case_foreign"}
    assert next(x for x in world.fake.exports if x["id"] == r["export_id"])["export_case"] == "case_foreign"
    n = len(world.fake.writes)
    assert _export(world, case_id="no_such_case").status_code == 404 and len(world.fake.writes) == n


def test_assigning_needs_the_exports_class_and_permission(world):
    world.policy(exports=True)
    eid = _export(world).json()["export_id"]
    world.policy(exports=False)
    assert world.call("POST", f"{BASE}/exports/{eid}/case", json={"case_id": "case_foreign", "supervised": True}).json()["code"] == "frigate_write_class_off"
    world.policy(exports=True)
    bind(world.c, world.s, "lena", "operator", "installation", "*")
    assert world.call("POST", f"{BASE}/exports/{eid}/case", json={"case_id": "case_foreign", "supervised": True}, headers=as_user("lena")).status_code == 403


# ---------------------------------------------------------------------------------------------- review clip

def test_a_review_clip_is_a_gated_get_of_a_closed_item_only(world):
    world.poll()
    closed, still_open = "1791227000.100000-aaa111", "1791227900.300000-ccc333"
    url = f"{BASE}/reviews/{closed}/clip.mp4"
    assert world.call("GET", url).json()["code"] == "frigate_first_write_unsupervised" and world.fake.clip_hits == []
    ok = world.c.get(url + "?supervised=true")
    assert ok.status_code == 200 and ok.content == world.fake.clip and ok.headers["content-type"] == "video/mp4"
    assert world.fake.clip_hits == [f"/api/review/{closed}/clip.mp4"] and world.fake.non_get == ["POST /api/login"]
    assert "/api/review" not in " ".join(f"{k}: {v}" for k, v in ok.headers.items())
    op = world.call("GET", f"{BASE}/reviews/{still_open}/clip.mp4")
    assert op.status_code == 409 and op.json()["code"] == "frigate_clip_window" and len(world.fake.clip_hits) == 1
    assert world.call("GET", f"{BASE}/reviews/1791227999.000000-nosuch/clip.mp4").status_code == 404
    assert world.audit("frigate.clip.read")[-1]["decision"] == "allowed"


def test_a_review_clip_follows_the_camera_scope(world):
    world.poll()
    cams = world.cams()
    bind(world.c, world.s, "tal", "operator", "camera", cams["cam_yard"])   # the item is on cam_front
    r = world.call("GET", f"{BASE}/reviews/1791227000.100000-aaa111/clip.mp4?supervised=true", headers=as_user("tal"))
    assert r.status_code == 403 and world.fake.clip_hits == []
    assert fh.clip_allowed("/api/review/1791227000.100000-aaa111/clip.mp4") and not fh.allowed("/api/review/1791227000.100000-aaa111/clip.mp4")
