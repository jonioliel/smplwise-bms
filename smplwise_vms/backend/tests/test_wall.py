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
