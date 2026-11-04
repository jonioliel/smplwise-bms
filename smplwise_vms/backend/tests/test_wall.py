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
    assert me["wall"] == {"enabled": True, "profile_version": 1, "desktop": False, "foldable_open": "tablet"}
    assert {(b["scope_type"], b["scope_id"]) for b in me["bindings"]} == {("camera", cams[0]), ("camera", cams[1])}
    cfg = c.get("/api/v1/wall/config", headers=W).json()
    assert [x["id"] for x in cfg["cameras"]] == cams[:2] and cfg["zone"] and cfg["alerts"] == []
    assert c.get(f"/api/v1/media/live/{cams[0]}", headers=W).status_code == 200
    assert c.get(f"/api/v1/media/live/{cams[2]}", headers=W).status_code in (403, 404), "an unlisted camera is not reachable"
    assert _add(c, cams).status_code == 409, "one profile per user"
    with app.state.db.connection() as conn:  # the audit row carries the actor and no secret
        row = conn.execute("SELECT actor_user_id, details_json FROM audit_log WHERE action = 'wall.profile.create'").fetchone()
    assert row is not None and "password" not in (row["details_json"] or "")


def test_desktop_flag_reaches_me_and_changes_no_permission(settings):
    """WALL-FOLLOWUPS-2390: "wall mode on desktop" is a profile flag; /me carries it (the client decides the mount before it
    fetches the configuration), the change is audited and bumps the version, and nothing about the role or the bindings moves.
    WALL-ANSWERS-2400: the flag is a column of its own (top-level `desktop`), never a key of the configuration blob."""
    app, c, cams = _setup(settings)
    _add(c, cams)
    before = c.get("/api/v1/me", headers=W).json()
    assert "desktop" not in wall_service.default_config()
    r = c.patch("/api/v1/wall/profiles/dev-wall", json={"desktop": True}, headers=ADMIN)
    assert r.status_code == 200, r.text
    assert r.json()["desktop"] is True and r.json()["version"] == 2 and "desktop" not in r.json()["config"]
    assert r.json()["config"]["cameras"] == cams[:2], "the rest of the profile is untouched"
    me = c.get("/api/v1/me", headers=W).json()
    assert me["wall"] == {"enabled": True, "profile_version": 2, "desktop": True, "foldable_open": "tablet"}
    assert me["bindings"] == before["bindings"] and me["permissions_any"] == before["permissions_any"], "presentation only"
    assert "desktop" not in c.get("/api/v1/wall/config", headers=W).json()["config"]
    with app.state.db.connection() as conn:
        row = conn.execute("SELECT desktop, config_json FROM wall_profiles WHERE user_id = 'dev-wall'").fetchone()
    assert row["desktop"] == 1 and '"desktop"' not in row["config_json"], "a column, never a key of config_json"
    assert c.patch("/api/v1/wall/profiles/dev-wall", json={"desktop": "yes"}, headers=ADMIN).status_code == 422
    assert c.patch("/api/v1/wall/profiles/dev-wall", json={"config": {"desktop": True}}, headers=ADMIN).status_code == 422, "no longer a configuration key"
    assert c.patch("/api/v1/wall/profiles/dev-wall", json={"desktop": False}, headers=W).status_code == 403, "a wall user cannot switch it"
    with app.state.db.connection() as conn:
        rows = [r["details_json"] or "" for r in conn.execute("SELECT details_json FROM audit_log WHERE action = 'wall.profile.update'").fetchall()]
    assert any('"desktop"' in d for d in rows), rows
    c.patch("/api/v1/wall/profiles/dev-wall", json={"enabled": False}, headers=ADMIN)
    assert c.get("/api/v1/me", headers=W).json()["wall"] is None, "a disabled profile has no wall anywhere"


def test_desktop_column_survives_a_rollback_of_the_configuration(settings):
    """WALL-ANSWERS-2400 (owner answer 20 = B): the stored configuration of a profile with the switch ON must validate under the
    OLDER model (no `desktop` key, extra keys forbidden), so a rollback keeps every profile's settings."""
    app, c, cams = _setup(settings)
    _add(c, cams)
    r = c.patch("/api/v1/wall/profiles/dev-wall", json={"desktop": True, "config": {"rotate_s": 30, "theme": "light"}}, headers=ADMIN)
    assert r.status_code == 200 and r.json()["desktop"] is True, r.text
    old_model = wall_service.WallConfig  # 2.38 / 2.39 had the same keys minus `desktop`, extra="forbid"
    assert "desktop" not in old_model.model_fields and old_model.model_config.get("extra") == "forbid"
    with app.state.db.connection() as conn:
        stored = conn.execute("SELECT config_json FROM wall_profiles WHERE user_id = 'dev-wall'").fetchone()["config_json"]
    old = old_model.model_validate_json(stored)  # raises on an unknown key - the failure mode the column removes
    assert old.rotate_s == 30 and old.theme == "light" and old.cameras == cams[:2]


def test_migration_0204_moves_the_switch_out_of_the_blob(settings):
    """A row written by a 2390-era build (`desktop` inside config_json) is migrated: the value lands in the column, the key leaves
    the blob, every other key stays; a row with the key false or absent stays off; a row that is not JSON is left alone."""
    import json
    import sqlite3
    from pathlib import Path

    from smplwise import db as dbmod

    app, c, cams = _setup(settings)
    _add(c, cams)
    sql = (Path(dbmod.__file__).parent / "migrations" / "0204_wall_profiles_desktop.sql").read_text(encoding="utf-8")
    mem = sqlite3.connect(":memory:")
    mem.execute("CREATE TABLE wall_profiles (user_id TEXT PRIMARY KEY, config_json TEXT NOT NULL)")
    on = {"cameras": ["a"], "desktop": True, "rotate_s": 30, "plan": {"mode": "live"}}
    rows = [("on", json.dumps(on)), ("off", json.dumps({"desktop": False, "rotate_s": 15})), ("none", json.dumps({"rotate_s": 60})), ("bad", "not json")]
    mem.executemany("INSERT INTO wall_profiles VALUES (?, ?)", rows)
    mem.executescript(sql)
    got = {r[0]: (r[1], r[2]) for r in mem.execute("SELECT user_id, desktop, config_json FROM wall_profiles")}
    assert got["on"][0] == 1 and json.loads(got["on"][1]) == {"cameras": ["a"], "rotate_s": 30, "plan": {"mode": "live"}}
    assert list(json.loads(got["on"][1])) == ["cameras", "rotate_s", "plan"], "the order of the other keys is kept"
    assert got["off"][0] == 0 and json.loads(got["off"][1]) == {"rotate_s": 15}
    assert got["none"][0] == 0 and json.loads(got["none"][1]) == {"rotate_s": 60}
    assert got["bad"] == (0, "not json")
    # the running service also reads a blob that still carries the key (a row restored from an older database): ignored there
    with app.state.db.connection() as conn:
        conn.execute("UPDATE wall_profiles SET config_json = ?, desktop = 0 WHERE user_id = 'dev-wall'", (json.dumps({**wall_service.default_config(), "desktop": True, "rotate_s": 30}),))
    prof = c.get("/api/v1/wall/profiles/dev-wall", headers=ADMIN).json()
    assert prof["config"]["rotate_s"] == 30, "the legacy key does not drop the configuration to the defaults"
    assert prof["desktop"] is False, "the column decides"


def test_foldable_setting_is_admin_only_audited_and_reaches_me(settings):
    """WALL-ANSWERS-2400 (owner answer 18 = A + a setting): an unfolded foldable is a tablet by default; an administrator may
    switch the installation to "phone". Presentation only - /me carries it for a wall user; nothing about permissions moves."""
    import json

    app, c, cams = _setup(settings)
    _add(c, cams)
    assert c.get("/api/v1/wall/settings", headers=ADMIN).json() == {"foldable_open": "tablet"}
    assert c.get("/api/v1/wall/profiles", headers=ADMIN).json()["foldable_open"] == "tablet"
    before = c.get("/api/v1/me", headers=W).json()
    assert c.get("/api/v1/wall/settings", headers=W).status_code == 403
    assert c.patch("/api/v1/wall/settings", json={"foldable_open": "phone"}, headers=W).status_code == 403, "a wall user cannot switch it"
    assert c.patch("/api/v1/wall/settings", json={"foldable_open": "laptop"}, headers=ADMIN).status_code == 422
    assert c.patch("/api/v1/wall/settings", json={"foldable_open": "phone", "x": 1}, headers=ADMIN).status_code == 422
    r = c.patch("/api/v1/wall/settings", json={"foldable_open": "phone"}, headers=ADMIN)
    assert r.status_code == 200 and r.json() == {"foldable_open": "phone"}
    me = c.get("/api/v1/me", headers=W).json()
    assert me["wall"]["foldable_open"] == "phone"
    assert me["bindings"] == before["bindings"] and me["permissions_any"] == before["permissions_any"], "presentation only"
    c.patch("/api/v1/wall/settings", json={"foldable_open": "phone"}, headers=ADMIN)  # unchanged: no second audit row
    with app.state.db.connection() as conn:
        rows = conn.execute("SELECT actor_user_id, details_json FROM audit_log WHERE action = 'wall.settings.update'").fetchall()
        conn.execute("UPDATE settings SET value = 'garbage' WHERE key = 'wall.foldable_open'")
    assert len(rows) == 1 and rows[0]["actor_user_id"]
    assert json.loads(rows[0]["details_json"])["foldable_open"] == {"from": "tablet", "to": "phone"}
    assert c.get("/api/v1/wall/settings", headers=ADMIN).json() == {"foldable_open": "tablet"}, "an unknown stored value reads as the default"


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
