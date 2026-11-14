"""CR-014 schedules - the settings keys, the feature gate, the draft caps, the preview rate limit and the session hook
(docs/architecture/SCHEDULER_API.md §3.19, §6.2, §10.1)."""
from __future__ import annotations

import asyncio

from schedules_fixture import *  # noqa: F401,F403
from schedules_fixture import sched_app  # noqa: F401
from smplwise.services import ha_sync

API = "/api/v1"


def _by_name(c, name):
    return next(s for s in c.get(f"{API}/schedules", params={"limit": 500}).json()["items"] if s["name"] == name)


def test_settings_keys_defaults_and_validation(sched_app):
    app, s, c, fake, tr = sched_app
    got = c.get(f"{API}/settings").json()["settings"]
    assert got["schedules.snap_minutes"] == "15" and got["schedules.default_repeat"] == "repeat" and got["schedules.runs_retention_days"] == 90 and got["schedules.shabbat_sensor"] == SHABBAT
    assert c.patch(f"{API}/settings", json={"schedules.snap_minutes": "5", "schedules.default_repeat": "pause", "schedules.runs_retention_days": 30}).status_code == 200
    got = c.get(f"{API}/schedules/status").json()["settings"]
    assert got["snap_minutes"] == 5 and got["default_repeat"] == "pause"
    for bad in ({"schedules.snap_minutes": "10"}, {"schedules.default_repeat": "daily"}, {"schedules.runs_retention_days": 3}, {"schedules.runs_retention_days": 400}, {"schedules.enabled": "maybe"}):
        assert c.patch(f"{API}/settings", json=bad).status_code == 422, bad
    bind(c, s, "vera", "viewer", "installation", "*")
    assert c.patch(f"{API}/settings", json={"schedules.enabled": "false"}, headers={"X-SW-Dev-User": "vera"}).status_code == 403  # system.configure only
    with app.state.db.connection(mode="read") as conn:
        assert conn.execute("SELECT COUNT(*) FROM audit_log WHERE action = 'settings.update'").fetchone()[0] >= 1


def test_writes_are_409_while_the_feature_is_off(sched_app):
    app, s, c, fake, tr = sched_app
    sid = _by_name(c, "Hall lights on rest days")["id"]
    assert c.patch(f"{API}/settings", json={"schedules.enabled": "false"}).status_code == 200
    r = c.post(f"{API}/schedules", json={"draft": draft_of("x"), "enabled": True, "client_request_id": rid()})
    assert r.status_code == 409 and r.json()["code"] == "feature_disabled" and r.json()["user_message"] == "התזמונים כבויים בהגדרות המערכת."
    assert post_json(c, f"/schedules/{sid}/disable", {"client_request_id": rid()}).json()["code"] == "feature_disabled"
    assert c.get(f"{API}/schedules/catalog").json()["code"] == "feature_disabled"
    assert c.get(f"{API}/schedules/{sid}").status_code == 404 and not fake.bridge_calls


def test_draft_caps(sched_app):
    app, s, c, fake, tr = sched_app

    def valid(d):
        return post_json(c, "/schedules/preview", {"draft": d}).json()["valid"]

    assert not valid(draft_of("x", [slot("08:00:00", None, *[act("light.turn_on", "light.office")] * 21)]))  # > 20 actions
    assert not valid(draft_of("x", [slot("08:00:00", None, act("light.turn_on", "light.office", brightness=1, a=1, b=1, c=1, d=1, e=1, f=1, g=1, h=1))]))  # > 8 keys
    assert not valid(draft_of("x", tags=[f"t{i}" for i in range(11)]))
    assert valid(draft_of("x"))


def test_preview_is_rate_limited(sched_app):
    app, s, c, fake, tr = sched_app
    codes = [post_json(c, "/schedules/preview", {"draft": draft_of("x")}).status_code for _ in range(61)]
    assert codes[:60] == [200] * 60 and codes[60] == 429


def _rows(app):
    with app.state.db.connection(mode="read") as conn:
        return conn.execute("SELECT schedule_id FROM schedule_cache").fetchall()


def test_the_session_subscribes_and_pulls_when_the_feature_is_on(sched_app):
    """`HaSync._schedules_start` (the on_ready hook): `scheduler_updated` first, then the full pull; a refused subscription is
    survivable; nothing at all while the feature is off."""
    app, s, c, fake, tr = sched_app
    sync = ha_sync.HaSync()
    sync.db = app.state.db
    seen: list[str] = []

    async def call(msg_type, **kw):
        seen.append(msg_type)
        return {"id": 41, "type": "result", "success": True, "result": None}

    asyncio.run(sync._schedules_start(call, "connect"))
    assert seen == ["scheduler_updated"] and sync._sched_sub_id == 41 and len(_rows(app)) == 12  # the pull ran through the transport
    sync._sched_sub_id = None

    async def refused(msg_type, **kw):
        return {"id": 42, "type": "result", "success": False, "error": {"code": "unknown_command"}}

    asyncio.run(sync._schedules_start(refused, "connect"))
    assert sync._sched_sub_id is None
    assert c.patch(f"{API}/settings", json={"schedules.enabled": "false"}).status_code == 200
    seen.clear()
    asyncio.run(sync._schedules_start(call, "connect"))
    assert seen == []
