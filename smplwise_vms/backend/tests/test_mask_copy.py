"""MASKCOPY62-295 slice 1: the privacy-mask copy PLAN (no device write). Reuses the NVRMASK-295 fake NVR."""
from __future__ import annotations

import pytest
from conftest import as_user, bind
from fastapi.testclient import TestClient
from test_nvr_privacy_mask import SQUARE, SQUARE2, FakeMaskNvr

from smplwise.main import create_app
from smplwise.services import mask_copy, nvr_privacy

PLAN = "/api/v1/nvr/privacy-masks/copy/plan"


def _view(enabled, regions, w=704, h=576):
    return {"enabled": enabled, "normalized": {"width": w, "height": h}, "regions": [{"id": str(i), "points": p} for i, p in enumerate(regions, 1)]}


# ---------------------------------------------------------------- pure mapping and conflicts

def test_scale_points_per_axis_rounded_and_clamped():
    assert mask_copy.scale_points([[0, 576], [352, 288]], {"width": 704, "height": 576}, {"width": 1408, "height": 1152}) == [[0, 1152], [704, 576]]
    assert mask_copy.scale_points([[704, 576]], {"width": 704, "height": 576}, {"width": 352, "height": 288}) == [[352, 288]]
    assert mask_copy.scale_points([[1, 1]], {"width": 704, "height": 576}, {"width": 352, "height": 288}) == [[1, 1]]  # 0.5 rounds up


def test_plan_replace_and_add_modes():
    src = [SQUARE]
    tgt = _view(True, [SQUARE2])
    add = mask_copy.plan_target(src, {"width": 704, "height": 576}, tgt, 4, "add")
    assert add["status"] == "ready" and len(add["after"]["regions"]) == 2 and add["added"] == 1 and add["removed"] == 0
    rep = mask_copy.plan_target(src, {"width": 704, "height": 576}, tgt, 4, "replace")
    assert rep["status"] == "ready" and [r["points"] for r in rep["after"]["regions"]] == [SQUARE] and rep["removed"] == 1


def test_plan_unchanged_when_target_already_has_the_region_and_master_on():
    p = mask_copy.plan_target([SQUARE], {"width": 704, "height": 576}, _view(True, [SQUARE]), 4, "add")
    assert p["status"] == "unchanged"
    off = mask_copy.plan_target([SQUARE], {"width": 704, "height": 576}, _view(False, [SQUARE]), 4, "add")
    assert off["status"] == "ready", "master switch off: copying turns the mask on"


def test_plan_conflict_when_over_the_target_limit_and_invalid_when_scaled_too_small():
    full = _view(True, [SQUARE2, [[10, 10], [60, 10], [60, 60], [10, 60]], [[100, 100], [150, 100], [150, 150], [100, 150]], [[200, 200], [250, 200], [250, 250], [200, 250]]])
    c = mask_copy.plan_target([SQUARE], {"width": 704, "height": 576}, full, 4, "add")
    assert c["status"] == "conflict" and c["reason"] == "too_many_regions" and c["details"]["needed"] == 5 and "after" not in c
    assert mask_copy.plan_target([SQUARE], {"width": 704, "height": 576}, full, 4, "replace")["status"] == "ready"
    tiny = [[[0, 0], [100, 0], [100, 100], [0, 100]]]
    inv = mask_copy.plan_target(tiny, {"width": 704, "height": 576}, _view(False, [], w=16, h=16), 4, "add")
    assert inv["status"] == "invalid" and inv["problems"][0]["reason"] == "too_small" and inv["frame_differs"] is True


def test_plan_maps_into_a_different_frame():
    p = mask_copy.plan_target([SQUARE], {"width": 704, "height": 576}, _view(False, [], w=1408, h=1152), 4, "add")
    assert p["status"] == "ready" and p["frame_differs"] is True
    assert p["after"]["regions"][0]["points"] == [[0, 1152], [140, 1152], [140, 1036], [0, 1036]]


def test_digest_changes_with_the_plan():
    r = [{"camera_id": "a", "status": "ready", "etag": "e", "after": {"x": 1}}]
    assert mask_copy.plan_digest("s", "t", "add", r) == mask_copy.plan_digest("s", "t", "add", r)
    assert mask_copy.plan_digest("s", "t", "add", r) != mask_copy.plan_digest("s", "t", "replace", r)


# ---------------------------------------------------------------- the route against the fake NVR

@pytest.fixture()
def world(settings, monkeypatch):
    fake = FakeMaskNvr(channels=(1, 2, 3))
    monkeypatch.setattr(nvr_privacy, "_client", fake.client)
    from smplwise.services import nvr_write

    monkeypatch.setattr(nvr_write, "_client", fake.client)
    app = create_app(settings)
    with TestClient(app) as c:
        ids = [c.post("/api/v1/cameras", json={"channel": ch, "alias": f"מצלמה {ch}"}).json()["id"] for ch in (1, 2, 3)]
        yield c, fake, ids, app


def _on(c):
    assert c.patch("/api/v1/settings", json={"nvr.privacy_mask_copy": "true"}).status_code == 200


def test_switch_defaults_off_and_nothing_is_read(world):
    c, fake, (a, b, _c3), _app = world
    assert c.get("/api/v1/settings").json()["settings"]["nvr.privacy_mask_copy"] == "false"
    r = c.post(PLAN, json={"source_camera_id": a, "target_camera_ids": [b]})
    assert r.status_code == 409 and r.json()["code"] == "feature_disabled"
    assert fake.calls == []


def test_plan_reads_only_never_writes_and_warns(world):
    c, fake, (a, b, c3), app = world
    _on(c)
    fake.master[1], fake.regions[1] = True, {"1": SQUARE}
    fake.master[3], fake.regions[3] = True, {"1": SQUARE2}
    fake.calls.clear()
    r = c.post(PLAN, json={"source_camera_id": a, "target_camera_ids": [b, c3]})
    assert r.status_code == 200, r.text
    out = r.json()
    assert out["device_write"] is False and out["confirmation_required"] is True and out["mode"] == "add"
    assert [w["code"] for w in out["warnings"]] == ["scene_must_match"]
    assert (out["ready"], out["unchanged"], out["conflict"]) == (2, 0, 0) and len(out["plan_digest"]) == 32
    by = {i["camera_id"]: i for i in out["items"]}
    assert by[b]["after"]["enabled"] is True and by[b]["after"]["regions"][0]["points"] == SQUARE and by[b]["before"]["enabled"] is False
    assert len(by[c3]["after"]["regions"]) == 2 and by[c3]["etag"]
    assert fake.writes() == [] and all(m == "GET" for m, _p in fake.calls)
    assert fake.master[2] is False and fake.regions[2] == {}
    with app.state.db.connection(mode="read") as conn:
        row = conn.execute("SELECT decision, details_json FROM audit_log WHERE action = 'nvr.privacy_mask_copy' ORDER BY rowid DESC LIMIT 1").fetchone()
    import json

    details = json.loads(row["details_json"])
    assert row["decision"] == "allowed" and details["targets"] == 2 and details["ready"] == 2 and "regions" not in details and "after" not in details


def test_unchanged_replace_and_source_without_active_mask(world):
    c, fake, (a, b, _c3), _app = world
    _on(c)
    assert c.post(PLAN, json={"source_camera_id": a, "target_camera_ids": [b]}).json()["details"]["reason"] == "source_has_no_active_mask"
    fake.master[1], fake.regions[1] = True, {"1": SQUARE}
    fake.master[2], fake.regions[2] = True, {"1": SQUARE}
    assert c.post(PLAN, json={"source_camera_id": a, "target_camera_ids": [b]}).json()["unchanged"] == 1
    fake.regions[2] = {"1": SQUARE2}
    rep = c.post(PLAN, json={"source_camera_id": a, "target_camera_ids": [b], "mode": "replace"}).json()["items"][0]
    assert rep["status"] == "ready" and rep["removed"] == 1 and len(rep["after"]["regions"]) == 1
    assert fake.writes() == []


def test_validation_and_rbac(world, settings):
    c, fake, (a, b, _c3), _app = world
    _on(c)
    fake.master[1], fake.regions[1] = True, {"1": SQUARE}
    assert c.post(PLAN, json={"source_camera_id": a, "target_camera_ids": [a]}).status_code == 422
    assert c.post(PLAN, json={"source_camera_id": a, "target_camera_ids": [b, b]}).status_code == 422
    assert c.post(PLAN, json={"source_camera_id": a, "target_camera_ids": [b], "mode": "merge"}).status_code == 422
    assert c.post(PLAN, json={"source_camera_id": a, "target_camera_ids": ["nope"]}).status_code in (403, 404)
    bind(c, settings, "sam", "site_admin", "installation", "*")
    fake.calls.clear()
    assert c.post(PLAN, json={"source_camera_id": a, "target_camera_ids": [b]}, headers=as_user("sam")).status_code == 403
    assert fake.calls == [], "403 before any device call"
    role = c.post("/api/v1/access/roles", json={"name": "מסכות", "description": "", "permissions": ["map.read", "video.live"], "sensitive": ["nvr.config.privacy"]}).json()
    bind(c, settings, "dan", role["id"], "installation", "*")
    assert c.post(PLAN, json={"source_camera_id": a, "target_camera_ids": [b]}, headers=as_user("dan")).status_code == 200


def test_plan_is_local_only():
    from smplwise import remote_channel

    assert any(b == "/api/v1/nvr/privacy-masks" for b in remote_channel.BLOCKED_ON_REMOTE)
