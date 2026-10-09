"""Security review 2.4.2 (docs/security/SECURITY_REVIEW_242_2026-10-08.md): regression tests for the findings fixed in SEC243.

These started as proofs of concept that asserted the UNFIXED behaviour (SEC242); each one now asserts the fix. Fakes and the
in-process test client only; no device, no Frigate, no Home Assistant, no network."""
from __future__ import annotations

import copy
import sys
import time
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent))
sys.path.insert(0, str(Path(__file__).resolve().parent / "fixtures"))
from conftest import as_user  # noqa: E402
from test_plan_anchor_scope_plns import bound  # noqa: E402,F401  (fixture)
from test_plan_geometry_binding import OBJ  # noqa: E402

from smplwise import db as dbmod  # noqa: E402
from smplwise.services import geometry_store as store  # noqa: E402
from smplwise.services import ha_user_auth as hua  # noqa: E402
from smplwise.services import plan_anchor_scope as anchor_scope  # noqa: E402
from smplwise.services import plan_geometry as pg  # noqa: E402
from smplwise.services import wall_path  # noqa: E402
from smplwise.services.recorders import frigate_config as fcfg  # noqa: E402


def _objects(body: dict) -> dict[str, dict]:
    return {o["id"]: o for o in body["doc"]["objects"]}


# ---------------------------------------------------------------------------------------------- M1: curved-wall amplification

def _zigzag_wall(n: int, wid: str = "w-amp", y0: float = 0.4) -> dict:
    pts = [[0.4 + 0.0001 * (i % 2), y0 + 0.2 * i / n] for i in range(n + 1)]
    return {"id": wid, "level_id": "L0", "polyline": pts, "bulges": [wall_path.MAX_BULGE] * n, "thickness_m": 0.2, "height_m": None, "base_z_m": 0,
            "kind": "interior", "confidence": 1, "source": "manual", "locked": False, "external_ids": {}}


def test_m1_the_budget_counts_without_sampling_and_refuses_before_any_sampling(monkeypatch):
    # the arithmetic count is exactly what sampling produces
    small = _zigzag_wall(40)
    assert wall_path.sample_count(small, 4000, 3000) == (40, len(wall_path.sampled_wall(small, 4000, 3000)))
    calls = {"n": 0}
    monkeypatch.setattr(wall_path, "sample_with_s", lambda *a, **k: calls.__setitem__("n", calls["n"] + 1) or ([], []))
    t = time.perf_counter()
    # one wall past the corner cap
    with pytest.raises(wall_path.CurveLimit) as e:
        wall_path.check_walls([_zigzag_wall(3000)], 4000, 3000)
    assert e.value.code == "curve_corners" and e.value.wall_id == "w-amp"
    # many walls each under the corner cap: the document's arc segments
    with pytest.raises(wall_path.CurveLimit) as e:
        wall_path.check_walls([{**_zigzag_wall(500, f"w{i}"), "bulges": [0.01] * 500} for i in range(11)], 4000, 3000)
    assert e.value.code == "curve_segments"
    # few segments, but each one sampled to 128 points on a huge plan: the point budget
    big = [{"id": f"c{i}", "polyline": [[0.1, 0.1 + i * 1e-4], [0.9, 0.1 + i * 1e-4]], "bulges": [1.0]} for i in range(1600)]
    with pytest.raises(wall_path.CurveLimit) as e:
        wall_path.check_walls(big, 100000, 100000)
    assert e.value.code == "curve_points"
    assert calls["n"] == 0, "nothing was sampled"
    assert time.perf_counter() - t < 2.0
    # a realistic round room passes
    wall_path.check_walls([{"id": "r", "polyline": [[0.3, 0.5], [0.7, 0.5], [0.3, 0.5]], "bulges": [1.0, 1.0]}], 4000, 3000)


def test_m1_validate_refuses_an_amplified_wall_as_structural(settings, bound):
    c, ids, vid, _lobby, _vault = bound
    doc = c.get(f"/api/v1/plan-versions/{vid}/geometry?draft=true").json()["doc"]
    issues = pg.validate(dict(doc, walls=[*doc["walls"], _zigzag_wall(3000)]))
    assert [(i["code"], i["structural"], i["id"]) for i in issues] == [("curve_corners", True, "w-amp")]
    assert issues[0]["message"] == wall_path.CURVE_LIMIT_MESSAGES["curve_corners"]


def test_m1_the_editor_route_refuses_an_amplified_wall_with_a_clean_422_and_samples_nothing(settings, bound):
    c, ids, vid, _lobby, _vault = bound
    g = c.get(f"/api/v1/plan-versions/{vid}/geometry?draft=true").json()
    calls = {"n": 0, "samples": 0}
    real = wall_path.sampled_wall

    def counting(wall, w, h, tol=wall_path.TOL_PX):
        out = real(wall, w, h, tol)
        calls["n"] += 1
        calls["samples"] += len(out)
        return out

    wall_path.sampled_wall = counting
    try:
        r = c.put(f"/api/v1/plan-versions/{vid}/geometry", json={"doc": dict(g["doc"], walls=[*g["doc"]["walls"], _zigzag_wall(3000)]),
                                                                  "base_revision": g["geometry"]["revision"]}, headers=as_user("edna"))
    finally:
        wall_path.sampled_wall = real
    assert r.status_code == 422, r.text
    body = r.json()
    assert body["code"] == "geometry_structure"
    assert [(i["code"], i["id"]) for i in body["details"]["issues"]] == [("curve_corners", "w-amp")]
    assert calls["samples"] == 0, "the amplified wall was never sampled"
    # the same document through candidate acceptance: refused the same way
    cand = dict(_zigzag_wall(3000, "imp-w1"), source="imported")
    r = c.post(f"/api/v1/plan-versions/{vid}/detect/accept", json={"accepted": ["imp-w1"], "candidates": {"walls": [cand]}, "base_revision": g["geometry"]["revision"]},
               headers=as_user("edna"))
    assert r.status_code == 422 and r.json()["code"] == "geometry_structure", r.text
    assert {i["code"] for i in r.json()["details"]["issues"]} == {"curve_corners"}
    # a modest curved wall still saves
    ok = {**_zigzag_wall(20, "w-ok"), "bulges": [0.2] * 20}
    r = c.put(f"/api/v1/plan-versions/{vid}/geometry", json={"doc": dict(g["doc"], walls=[*g["doc"]["walls"], ok]), "base_revision": g["geometry"]["revision"]},
              headers=as_user("edna"))
    assert r.status_code == 200, r.text


# ---------------------------------------------------------------------------------------------- M2: the hidden camera's position

def test_m2_a_body_bound_to_a_hidden_camera_no_longer_shows_the_cameras_position_and_heading(settings, bound):
    c, ids, vid, lobby, vault = bound
    ron = c.get(f"/api/v1/plan-versions/{vid}/geometry", headers=as_user("ron"))
    assert ron.status_code == 200 and vault not in ron.text
    anchors = c.get(f"/api/v1/floors/{ids['floor2']}/anchors", headers=as_user("ron")).json()["anchors"]
    assert not any(a["resource_id"] == vault for a in anchors)
    body = _objects(ron.json())["o-vault"]
    assert body["position"] != [0.6, 0.4] and body["position"] == list(anchor_scope.WITHHELD_POSITION) and body["rotation_deg"] == 0
    # the visible camera's body still follows its camera; the administrator still sees the real pose
    assert _objects(ron.json())["o-lobby"]["position"] == [0.3, 0.4]
    assert _objects(c.get(f"/api/v1/plan-versions/{vid}/geometry").json())["o-vault"]["position"] == [0.6, 0.4]


def test_m2_the_stored_doc_hash_no_longer_confirms_a_guessed_hidden_camera(settings, bound):
    c, ids, vid, lobby, vault = bound
    ron = c.get(f"/api/v1/plan-versions/{vid}/geometry", headers=as_user("ron")).json()
    stored_hash = ron["geometry"]["doc_hash"]
    served = copy.deepcopy(ron["doc"])
    for k in [k for k in served if k not in _stored_keys(settings, vid)]:
        served.pop(k)
    for o in served["objects"]:
        if o["id"] == "o-vault":
            o["anchor_ref"] = {"resource_type": "camera", "resource_id": vault}
    assert store.doc_hash(served) != stored_hash, "the withheld pose is part of the stored hash: a right guess of the id is not confirmed"


def _stored_keys(settings, vid: str) -> set[str]:
    from smplwise.db import Database

    with Database(settings.db_path).connection(mode="read") as conn:
        return set(store.load_doc(store.published_row(conn, vid)))


def test_m2_a_scoped_editor_saves_the_withheld_body_and_its_stored_pose_stays(settings, bound):
    c, ids, vid, lobby, vault = bound
    g = c.get(f"/api/v1/plan-versions/{vid}/geometry?draft=true", headers=as_user("edna")).json()
    assert _objects(g)["o-vault"]["position"] == list(anchor_scope.WITHHELD_POSITION)
    r = c.put(f"/api/v1/plan-versions/{vid}/geometry", json={"doc": g["doc"], "base_revision": g["geometry"]["revision"]}, headers=as_user("edna"))
    assert r.status_code == 200, r.text
    from smplwise.db import Database

    with Database(settings.db_path).connection(mode="read") as conn:
        stored = {o["id"]: o for o in store.load_doc(store.draft_row(conn, vid))["objects"]}
    assert stored["o-vault"]["position"] == [0.6, 0.4] and stored["o-vault"]["anchor_ref"] == {"resource_type": "camera", "resource_id": vault}


def test_l2_anchor_hidden_answers_the_same_for_a_registered_camera_and_an_unknown_id(settings, bound):
    c, ids, vid, lobby, vault = bound
    g = c.get(f"/api/v1/plan-versions/{vid}/geometry?draft=true", headers=as_user("edna")).json()

    def put(rid: str):
        extra = OBJ("o-probe", pos=(0.1, 0.9), anchor_ref={"resource_type": "camera", "resource_id": rid})
        return c.put(f"/api/v1/plan-versions/{vid}/geometry", json={"doc": dict(g["doc"], objects=[*g["doc"]["objects"], extra]),
                                                                      "base_revision": g["geometry"]["revision"]}, headers=as_user("edna"))

    hidden, unknown = put(vault), put("feedfacefeedface")
    assert hidden.status_code == unknown.status_code == 422
    assert hidden.json()["code"] == unknown.json()["code"] == "anchor_hidden"
    assert hidden.json()["details"] == unknown.json()["details"] == {"ids": ["o-probe"]}


# ---------------------------------------------------------------------------------------------- L4: rate-limiter keys

def test_l4_a_single_request_from_a_fresh_address_is_not_persisted_and_live_keys_are_capped(tmp_path):
    d = dbmod.Database(tmp_path / "t.db")
    d.migrate()
    lim = hua.RateLimiter(clock=lambda: 1_000_000.0)
    n = 5000
    for i in range(n):  # one request each from n addresses
        assert lim.hit(f"ip:2001:db8::{i:x}", hua.IP_LIMITS)
    with d.connection() as conn:
        assert lim.flush(conn) == 0
    with d.connection(mode="read") as conn:
        assert conn.execute("SELECT COUNT(*) FROM block_counters WHERE scope = 'signin'").fetchone()[0] == 0
    # a key that comes near its limit is persisted
    for _ in range(5):
        assert lim.hit("ip:192.0.2.7", hua.IP_LIMITS)
    with d.connection() as conn:
        assert lim.flush(conn) == 1
    # the live keys are capped: cold keys go first, the hot one stays
    small = hua.RateLimiter(clock=lambda: 1_000_000.0)
    small.MAX_KEYS, small.LOW_WATER = 1000, 900
    for _ in range(5):
        small.hit("ip:hot", hua.IP_LIMITS)
    for i in range(3000):
        small.hit(f"ip:cold{i}", hua.IP_LIMITS)
    assert len(small._hits) <= 1000 and "ip:hot" in small._hits  # noqa: SLF001
    assert small.hit("ip:hot", [(60.0, 5)]) is False, "the hot key kept its count"


def test_l4_ipv6_addresses_share_one_bucket_per_64():
    assert hua.limit_ip("2001:db8:1:2::1") == hua.limit_ip("2001:db8:1:2:ffff:ffff:ffff:ffff") == "2001:db8:1:2::/64"
    assert hua.limit_ip("2001:db8:1:3::1") != hua.limit_ip("2001:db8:1:2::1")
    assert hua.limit_ip("192.0.2.4") == "192.0.2.4" and hua.limit_ip("::ffff:192.0.2.4") == "192.0.2.4"
    assert hua.limit_ip("") == "" and hua.limit_ip("not-an-address") == "not-an-address"


def test_l4_a_failed_flush_keeps_its_batch():
    import sqlite3

    lim = hua.RateLimiter(clock=lambda: 1_000_000.0)
    for _ in range(5):
        lim.hit("ip:192.0.2.9", hua.IP_LIMITS)
    conn = sqlite3.connect(":memory:")  # no block_counters table: the write fails
    assert lim.flush(conn) == 0
    assert "ip:192.0.2.9" in lim._dirty  # noqa: SLF001


# ---------------------------------------------------------------------------------------------- L5: the instance-schema walk

class _Http:
    def __init__(self, doc):
        self.doc = doc

    def get_json(self, *a, **kw):
        return self.doc


class _Adapter:
    def __init__(self, doc):
        self.http = _Http(doc)


def test_l5_a_self_referencing_instance_schema_is_walked_once():
    doc = {"properties": {"cameras": {"additionalProperties": {"$ref": "#/$defs/C"}}},
           "$defs": {"C": {"anyOf": [{"$ref": "#/$defs/C"}]}}}
    out = fcfg.FrigateConfig(_Adapter(doc)).frigate_schema_check()
    assert out["checked"] is True and "detect.fps" in out["missing"]


def test_l5_an_exponential_instance_schema_is_linear_and_a_huge_one_is_not_concluded():
    depth = 60
    defs = {f"D{i}": {"anyOf": [{"$ref": f"#/$defs/D{i + 1}"}, {"$ref": f"#/$defs/D{i + 1}"}]} for i in range(depth)}
    defs[f"D{depth}"] = {"type": "object"}
    doc = {"properties": {"cameras": {"additionalProperties": {"$ref": "#/$defs/D0"}}}, "$defs": defs}
    t = time.perf_counter()
    out = fcfg.FrigateConfig(_Adapter(doc)).frigate_schema_check()
    assert out["checked"] is True and time.perf_counter() - t < 2.0
    wide = {"properties": {"cameras": {"anyOf": [{"type": "object"} for _ in range(fcfg.SCHEMA_WALK_MAX + 10)]}}}
    assert fcfg.FrigateConfig(_Adapter(wide)).frigate_schema_check() == {"checked": False, "missing": []}


# ---------------------------------------------------------------------------------------------- L6: zone delete + undo

from test_frigate_control import BASE, World, _clean, world  # noqa: E402,F401  (fixtures)


def test_l6_zone_delete_then_undo_keeps_the_fields_arx_does_not_model(world):
    world.policy(config=True)
    cam = world.cams()["cam_front"]
    world.fake.cameras["cam_front"]["zones"]["porch"] = {"coordinates": "0.1,0.1,0.5,0.1,0.5,0.5", "inertia": 5,
                                                         "filters": {"person": {"min_area": 5000}}, "speed_threshold": 2.5}
    gone = world.call("POST", f"{BASE}/cameras/{cam}/config/zones/porch/delete", json={"confirm": True, "supervised": True})
    assert gone.status_code == 200 and gone.json()["verified"] is True
    assert "porch" not in world.fake.cameras["cam_front"]["zones"]
    undo = world.call("POST", f"{BASE}/changes/{world.changes()[0]['id']}/revert", json={"confirm": True})
    assert undo.status_code == 200 and undo.json()["verified"] is True
    back = world.fake.cameras["cam_front"]["zones"]["porch"]
    assert back["filters"] == {"person": {"min_area": 5000}} and back["speed_threshold"] == 2.5 and back["inertia"] == 5


def test_l6_a_zone_whose_extra_fields_cannot_be_put_back_is_not_deleted(world):
    world.policy(config=True)
    cam = world.cams()["cam_front"]
    world.fake.cameras["cam_front"]["zones"]["porch"] = {"coordinates": "0.1,0.1,0.5,0.1,0.5,0.5", "filters": {"person.x": {"min_area": 1}}}
    r = world.call("POST", f"{BASE}/cameras/{cam}/config/zones/porch/delete", json={"confirm": True, "supervised": True})
    assert r.status_code == 409 and r.json()["code"] == "frigate_zone_not_reversible"
    assert "porch" in world.fake.cameras["cam_front"]["zones"], "nothing was written"
