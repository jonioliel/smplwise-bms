"""Security review 2.4.2 (docs/security/SECURITY_REVIEW_242_2026-10-08.md): proofs of concept for the OPEN findings.

Every test here asserts the CURRENT (unfixed) behaviour, so each one documents a finding and passes while the finding is
open. When a fix lands, the matching test fails on purpose: invert its assertion into a regression test (or drop it).
Fakes and the in-process test client only; no device, no Frigate, no Home Assistant, no network."""
from __future__ import annotations

import copy
import sqlite3
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
from smplwise.services import plan_geometry as pg  # noqa: E402
from smplwise.services import wall_path  # noqa: E402
from smplwise.services.recorders import frigate_config as fcfg  # noqa: E402


def _objects(body: dict) -> dict[str, dict]:
    return {o["id"]: o for o in body["doc"]["objects"]}


# ---------------------------------------------------------------------------------------------- M1: curved-wall amplification

def _zigzag_wall(n: int) -> dict:
    pts = [[0.4 + 0.0001 * (i % 2), 0.4 + 0.2 * i / n] for i in range(n + 1)]
    return {"id": "w-amp", "level_id": "L0", "polyline": pts, "bulges": [wall_path.MAX_BULGE] * n, "thickness_m": 0.2, "height_m": None, "base_z_m": 0,
            "kind": "interior", "confidence": 1, "source": "manual", "locked": False, "external_ids": {}}


def test_poc_m1_one_curved_wall_samples_to_about_61_points_per_segment():
    n = 3000
    wall = _zigzag_wall(n)
    t = time.perf_counter()
    samples = wall_path.sampled_wall(wall, 4000, 3000)
    took = time.perf_counter() - t
    print(f"M1: segments={n} samples={len(samples)} seconds={took:.2f}")
    assert len(samples) >= 60 * n, "no per-wall or per-document cap on the sampled path"


def test_poc_m1_the_editor_route_samples_an_amplified_wall_before_any_size_check(settings, bound):
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
    print(f"M1: PUT status={r.status_code} sampled_wall calls={calls['n']} points={calls['samples']}")
    assert r.status_code == 200, r.text
    assert calls["samples"] >= 180_000, "a 80 KB wall is expanded to hundreds of thousands of points per request"


# ---------------------------------------------------------------------------------------------- M2: the hidden camera's position

def test_poc_m2_a_body_bound_to_a_hidden_camera_still_shows_the_cameras_position_and_heading(settings, bound):
    c, ids, vid, lobby, vault = bound
    ron = c.get(f"/api/v1/plan-versions/{vid}/geometry", headers=as_user("ron"))
    assert ron.status_code == 200 and vault not in ron.text
    # ron cannot list the vault camera's anchor ...
    anchors = c.get(f"/api/v1/floors/{ids['floor2']}/anchors", headers=as_user("ron")).json()["anchors"]
    assert not any(a["resource_id"] == vault for a in anchors)
    # ... but the body that follows it sits exactly on the anchor (0.6, 0.4) with the anchor's rotation
    assert _objects(ron.json())["o-vault"]["position"] == [0.6, 0.4]


def test_poc_m2_the_stored_doc_hash_confirms_which_camera_a_redacted_body_is_bound_to(settings, bound):
    c, ids, vid, lobby, vault = bound
    ron = c.get(f"/api/v1/plan-versions/{vid}/geometry", headers=as_user("ron")).json()
    stored_hash = ron["geometry"]["doc_hash"]
    served = copy.deepcopy(ron["doc"])
    for k in [k for k in served if k not in _stored_keys(settings, vid)]:
        served.pop(k)  # a key computed per read (none in this fixture); a reader drops what the stored document never has
    for o in served["objects"]:
        if o["id"] == "o-vault":
            o["anchor_ref"] = {"resource_type": "camera", "resource_id": "0" * 16}
    assert store.doc_hash(served) != stored_hash
    for o in served["objects"]:
        if o["id"] == "o-vault":
            o["anchor_ref"] = {"resource_type": "camera", "resource_id": vault}
    assert store.doc_hash(served) == stored_hash, "an offline guess of the hidden camera id is confirmed by the stored hash"


def _stored_keys(settings, vid: str) -> set[str]:
    from smplwise.db import Database

    with Database(settings.db_path).connection(mode="read") as conn:
        return set(store.load_doc(store.published_row(conn, vid)))


def test_poc_l_anchor_hidden_answers_differently_for_a_registered_camera_and_an_unknown_id(settings, bound):
    c, ids, vid, lobby, vault = bound
    g = c.get(f"/api/v1/plan-versions/{vid}/geometry?draft=true", headers=as_user("edna")).json()

    def put(rid: str):
        extra = OBJ("o-probe", pos=(0.1, 0.9), anchor_ref={"resource_type": "camera", "resource_id": rid})
        return c.put(f"/api/v1/plan-versions/{vid}/geometry", json={"doc": dict(g["doc"], objects=[*g["doc"]["objects"], extra]),
                                                                      "base_revision": g["geometry"]["revision"]}, headers=as_user("edna"))

    assert put(vault).status_code == 422 and put(vault).json()["code"] == "anchor_hidden"
    assert put("feedfacefeedface").status_code == 200, "an unknown id is stored: the answer tells a registered hidden camera apart"


# ---------------------------------------------------------------------------------------------- L: rate-limiter keys persisted unbounded

def test_poc_l_every_distinct_client_address_becomes_a_persisted_counter_row(tmp_path):
    d = dbmod.Database(tmp_path / "t.db")
    d.migrate()
    lim = hua.RateLimiter(clock=lambda: 1_000_000.0)
    n = 5000
    for i in range(n):  # one request each from n addresses (an IPv6 /64 gives 2**64 of them)
        assert lim.hit(f"ip:2001:db8::{i:x}", hua.IP_LIMITS)
    with d.connection() as conn:
        assert lim.flush(conn) == n
    with d.connection(mode="read") as conn:
        assert conn.execute("SELECT COUNT(*) FROM block_counters WHERE scope = 'signin'").fetchone()[0] == n
    assert len(lim._hits) == n, "no hard cap on live keys: the 20000 sweep only drops keys older than the longest window"  # noqa: SLF001


# ---------------------------------------------------------------------------------------------- L: the instance-schema walk recurses

class _Http:
    def __init__(self, doc):
        self.doc = doc

    def get_json(self, *a, **kw):
        return self.doc


class _Adapter:
    def __init__(self, doc):
        self.http = _Http(doc)


def test_poc_l_a_self_referencing_instance_schema_raises_recursion_error():
    doc = {"properties": {"cameras": {"additionalProperties": {"$ref": "#/$defs/C"}}},
           "$defs": {"C": {"anyOf": [{"$ref": "#/$defs/C"}]}}}
    with pytest.raises(RecursionError):
        fcfg.FrigateConfig(_Adapter(doc)).frigate_schema_check()


# ---------------------------------------------------------------------------------------------- L: a zone delete + undo drops fields Arx does not model

from test_frigate_control import BASE, World, _clean, world  # noqa: E402,F401  (fixtures)


def test_poc_l_zone_delete_then_undo_loses_the_fields_arx_does_not_model(world):
    world.policy(config=True)
    cam = world.cams()["cam_front"]
    world.fake.cameras["cam_front"]["zones"]["porch"] = {"coordinates": "0.1,0.1,0.5,0.1,0.5,0.5", "inertia": 5,
                                                         "filters": {"person": {"min_area": 5000}}, "speed_threshold": 2.5}
    gone = world.call("POST", f"{BASE}/cameras/{cam}/config/zones/porch/delete", json={"confirm": True, "supervised": True})
    assert gone.status_code == 200 and gone.json()["verified"] is True
    undo = world.call("POST", f"{BASE}/changes/{world.changes()[0]['id']}/revert", json={"confirm": True})
    assert undo.status_code == 200 and undo.json()["verified"] is True, "the undo reports success ..."
    back = world.fake.cameras["cam_front"]["zones"]["porch"]
    assert "filters" not in back and "speed_threshold" not in back, "... but the zone's filters and speed threshold are gone"
