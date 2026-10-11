"""CR-030 v2 (WDM S1): wall profiles - the kiosk role is the ceiling, the camera list is the user's camera-scope bindings,
disable / remove take effect at once, a wall user is refused on the remote channel unless the profile allows it."""
from __future__ import annotations

from conftest import as_user
from fastapi.testclient import TestClient

from smplwise.main import create_app
from smplwise.rbac import ROLES
from smplwise.services import wall as wall_service

W = as_user("wall")
ADMIN = as_user("joni")


def _setup(settings):
    app = create_app(settings)
    c = TestClient(app)
    c.get("/api/v1/me", headers=ADMIN)
    c.get("/api/v1/me", headers=W)
    cams = [c.post("/api/v1/cameras", json={"channel": n, "alias": f"cam{n}"}).json()["id"] for n in (1, 2, 3)]
    return app, c, cams


def _add(c, cams, **kw):
    body = {"user_id": "dev-wall", "title": "קבלה", "cameras": cams[:2], **kw}
    return c.post("/api/v1/wall/profiles", json=body, headers=ADMIN)


def test_role_has_exactly_the_wall_permission():
    assert ROLES["kiosk"] == ["map.read", "video.live", "wall.view"]


def test_user_without_profile_gets_nothing(settings):
    app, c, cams = _setup(settings)
    assert c.get("/api/v1/me", headers=W).json()["wall"] is None
    for path in ("/api/v1/wall/config", "/api/v1/wall/states?ids=sensor.x"):
        assert c.get(path, headers=W).status_code == 403, path
    assert c.get("/api/v1/wall/profiles", headers=W).status_code == 403, "a wall user is not an administrator"


def test_create_binds_cameras_and_me_carries_the_flag(settings):
    app, c, cams = _setup(settings)
    r = _add(c, cams)
    assert r.status_code == 201, r.text
    assert r.json()["config"]["cameras"] == cams[:2] and r.json()["status"] == "never"
    me = c.get("/api/v1/me", headers=W).json()
    assert me["wall"] == {"enabled": True, "profile_version": 1}
    assert {(b["scope_type"], b["scope_id"]) for b in me["bindings"]} == {("camera", cams[0]), ("camera", cams[1])}
    cfg = c.get("/api/v1/wall/config", headers=W).json()
    assert [x["id"] for x in cfg["cameras"]] == cams[:2] and cfg["zone"] and cfg["alerts"] == []
    assert c.get(f"/api/v1/media/live/{cams[0]}", headers=W).status_code == 200
    assert c.get(f"/api/v1/media/live/{cams[2]}", headers=W).status_code in (403, 404), "an unlisted camera is not reachable"
    assert _add(c, cams).status_code == 409, "one profile per user"
    with app.state.db.connection() as conn:  # the audit row carries the actor and no secret
        row = conn.execute("SELECT actor_user_id, details_json FROM audit_log WHERE action = 'wall.profile.create'").fetchone()
    assert row is not None and "password" not in (row["details_json"] or "")


def test_patch_rewrites_bindings_and_bumps_the_version(settings):
    app, c, cams = _setup(settings)
    _add(c, cams)
    r = c.patch("/api/v1/wall/profiles/dev-wall", json={"config": {"cameras": [cams[2], cams[0]], "rotate_s": 30}}, headers=ADMIN)
    assert r.status_code == 200, r.text
    assert r.json()["version"] == 2 and r.json()["config"]["cameras"] == [cams[2], cams[0]] and r.json()["config"]["rotate_s"] == 30
    assert [x["id"] for x in c.get("/api/v1/wall/config", headers=W).json()["cameras"]] == [cams[2], cams[0]]
    assert c.get(f"/api/v1/media/live/{cams[2]}", headers=W).status_code == 200
    assert c.get(f"/api/v1/media/live/{cams[1]}", headers=W).status_code in (403, 404), "the dropped camera lost its binding"
    assert c.patch("/api/v1/wall/profiles/dev-wall", json={"config": {"rotate_s": 7}}, headers=ADMIN).status_code == 422
    assert c.patch("/api/v1/wall/profiles/dev-wall", json={"config": {"stream": "main"}}, headers=ADMIN).status_code == 422, "sub streams only"
    assert c.patch("/api/v1/wall/profiles/dev-wall", json={"config": {"cameras": ["nope"]}}, headers=ADMIN).status_code == 422


def test_disable_drops_the_flag_and_remove_cuts_access(settings):
    app, c, cams = _setup(settings)
    _add(c, cams)
    assert c.patch("/api/v1/wall/profiles/dev-wall", json={"enabled": False}, headers=ADMIN).status_code == 200
    assert c.get("/api/v1/me", headers=W).json()["wall"] is None
    assert c.get("/api/v1/wall/config", headers=W).status_code == 403
    assert c.get(f"/api/v1/media/live/{cams[0]}", headers=W).status_code == 200, "the role stays: the normal limited application"
    c.patch("/api/v1/wall/profiles/dev-wall", json={"enabled": True}, headers=ADMIN)
    assert c.delete("/api/v1/wall/profiles/dev-wall", headers=ADMIN).json()["removed"] is True
    me = c.get("/api/v1/me", headers=W).json()
    assert me["wall"] is None and me["bindings"] == []
    assert c.get(f"/api/v1/media/live/{cams[0]}", headers=W).status_code == 403
    assert c.get("/api/v1/wall/profiles/dev-wall", headers=ADMIN).status_code == 404


def test_states_return_only_the_listed_chips(settings):
    from smplwise.services import ha_sync

    app, c, cams = _setup(settings)
    with app.state.db.connection() as conn:
        for eid, st in (("sensor.temp", "21.5"), ("lock.front", "locked")):
            ha_sync.upsert_state(conn, {"entity_id": eid, "state": st, "last_changed": "2026-10-05T09:00:00+00:00", "attributes": {"friendly_name": eid}})
    _add(c, cams)
    assert c.patch("/api/v1/wall/profiles/dev-wall", json={"config": {"state_entities": ["sensor.temp"]}}, headers=ADMIN).status_code == 200
    got = c.get("/api/v1/wall/states?ids=sensor.temp,lock.front", headers=W).json()["states"]
    assert [s["id"] for s in got] == ["sensor.temp"], "an entity that is not on the profile is never returned"
    assert c.patch("/api/v1/wall/profiles/dev-wall", json={"config": {"state_entities": ["sensor.missing"]}}, headers=ADMIN).status_code == 422


def test_remote_refusal_rule(settings):
    app, c, cams = _setup(settings)
    with app.state.db.connection() as conn:
        assert wall_service.remote_refusal_needed(conn, "dev-wall") is False
    _add(c, cams)
    with app.state.db.connection() as conn:
        assert wall_service.remote_refusal_needed(conn, "dev-wall") is True
    c.patch("/api/v1/wall/profiles/dev-wall", json={"remote_allowed": True}, headers=ADMIN)
    with app.state.db.connection() as conn:
        assert wall_service.remote_refusal_needed(conn, "dev-wall") is False
    c.patch("/api/v1/wall/profiles/dev-wall", json={"remote_allowed": False, "enabled": False}, headers=ADMIN)
    with app.state.db.connection() as conn:
        assert wall_service.remote_refusal_needed(conn, "dev-wall") is False, "a disabled profile is a plain user again"


def test_floor_scope_and_candidates(settings):
    from conftest import seed_tree

    app, c, cams = _setup(settings)
    ids = seed_tree(c)
    r = c.post("/api/v1/wall/profiles", json={"user_id": "dev-wall", "title": "מסדרון", "floor_id": ids["floor2"]}, headers=ADMIN)
    assert r.status_code == 201, r.text
    assert r.json()["config"]["scope"] == "floor"
    me = c.get("/api/v1/me", headers=W).json()
    assert [(b["scope_type"], b["scope_id"]) for b in me["bindings"]] == [("floor", ids["floor2"])]
    assert c.get("/api/v1/wall/candidates", headers=ADMIN).status_code == 200


def test_websocket_announces_config_and_disable(settings):
    app, c, cams = _setup(settings)
    _add(c, cams)
    with c.websocket_connect("/api/v1/wall/ws", headers=W) as ws:
        hello = ws.receive_json()
        assert hello["type"] == "hello" and hello["payload"]["state"] == "ok"
        ws.send_json({"type": "hello", "payload": {"class": "tablet", "screen": "800x1280"}})
        c.patch("/api/v1/wall/profiles/dev-wall", json={"title": "אחר"}, headers=ADMIN)
        assert ws.receive_json()["type"] == "config"
        c.patch("/api/v1/wall/profiles/dev-wall", json={"enabled": False}, headers=ADMIN)
        assert ws.receive_json()["type"] == "disabled"


def test_plan_block_is_the_screens_own_plan_view(settings):
    """CR-029 S5-B: a wall screen's own plan mode / quality / idle time live in the profile config (config_json: no migration),
    start as follow, are validated in full, merge partially, are audited as a diff, reach the display, and an older row without
    the block reads as follow."""
    import json

    app, c, cams = _setup(settings)
    r = _add(c, cams)
    follow = {"mode": "follow", "quality": "follow", "idle_s": "follow"}
    assert r.json()["config"]["plan"] == follow
    r = c.patch("/api/v1/wall/profiles/dev-wall", json={"config": {"show_map": True, "plan": {"mode": "stills", "quality": "schematic", "idle_s": 120}}}, headers=ADMIN)
    assert r.status_code == 200, r.text
    assert r.json()["config"]["plan"] == {"mode": "stills", "quality": "schematic", "idle_s": 120}
    assert r.json()["version"] == 2
    seen = c.get("/api/v1/wall/config", headers=W).json()
    assert seen["config"]["plan"] == {"mode": "stills", "quality": "schematic", "idle_s": 120} and seen["config"]["show_map"] is True
    # a partial patch changes only what it names; idle 0 is a value ("never"), follow hands the dial back
    r = c.patch("/api/v1/wall/profiles/dev-wall", json={"config": {"plan": {"idle_s": 0}}}, headers=ADMIN)
    assert r.json()["config"]["plan"] == {"mode": "stills", "quality": "schematic", "idle_s": 0}
    r = c.patch("/api/v1/wall/profiles/dev-wall", json={"config": {"plan": {"mode": "follow", "quality": "follow", "idle_s": "follow"}}}, headers=ADMIN)
    assert r.json()["config"]["plan"] == follow
    # nothing is clamped silently: a value outside the lists is a 422 and the stored block stays as it was
    for bad in ({"mode": "main"}, {"quality": "ultra"}, {"quality": 2}, {"idle_s": 7}, {"idle_s": "30"}, {"idle_s": -1}, {"idle_s": None}, {"zoom": 2}):
        got = c.patch("/api/v1/wall/profiles/dev-wall", json={"config": {"plan": bad}}, headers=ADMIN)
        assert got.status_code == 422, (bad, got.text)
    assert c.get("/api/v1/wall/profiles/dev-wall", headers=ADMIN).json()["config"]["plan"] == follow
    # the diff is audited with the dotted names, never a value that is a secret (there is none) - and a no-op writes nothing
    c.patch("/api/v1/wall/profiles/dev-wall", json={"config": {"plan": {"mode": "live"}}}, headers=ADMIN)
    with app.state.db.connection() as conn:
        rows = conn.execute("SELECT details_json FROM audit_log WHERE action = 'wall.profile.update' ORDER BY rowid").fetchall()
    changed = [json.loads(x["details_json"])["changed"] for x in rows]
    assert any("config.plan.mode" in ch for ch in changed) and any("config.show_map" in ch for ch in changed)
    assert changed[-1] == ["config.plan.mode"]
    before = c.get("/api/v1/wall/profiles/dev-wall", headers=ADMIN).json()["version"]
    c.patch("/api/v1/wall/profiles/dev-wall", json={"config": {"plan": {"mode": "live"}}}, headers=ADMIN)
    assert c.get("/api/v1/wall/profiles/dev-wall", headers=ADMIN).json()["version"] == before, "the same value is not a change"
    # a profile stored before the block existed reads as follow (config_of falls back per field, never a 500 on a wall)
    old = wall_service.default_config()
    old.pop("plan")
    with app.state.db.connection() as conn:
        conn.execute("UPDATE wall_profiles SET config_json = ? WHERE user_id = ?", (json.dumps(old), "dev-wall"))
    assert c.get("/api/v1/wall/config", headers=W).json()["config"]["plan"] == follow
    # the wall user cannot write it (administration only)
    assert c.patch("/api/v1/wall/profiles/dev-wall", json={"config": {"plan": {"mode": "stills"}}}, headers=W).status_code == 403


def test_plan_block_choices_agree_with_the_installation_dials():
    """The screen's lists are the plan.view lists plus follow - one vocabulary for the dial and its per-screen override."""
    from typing import get_args

    from smplwise.services import plan_view

    def values(field: str) -> list:
        return list(get_args(wall_service.Plan.model_fields[field].annotation))

    assert values("mode") == ["follow", *plan_view.CHOICES["wall_display"]]
    assert values("quality") == ["follow", *plan_view.CHOICES["quality"]]
    assert values("idle_s") == ["follow", *plan_view.CHOICES["kiosk_idle_s"]]
