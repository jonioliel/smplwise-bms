"""CR-027 phase 1: the phone app's presence contract - registration with a hashed token, the config and the master switch, the
employee notice and its versioning, event batches (idempotent, validated, sensor allow-list), the current state, rename /
unregister, the administrator's settings, the required-sensors policy and its enforcement, retention, and the security
rules (token hashing, cross-user access, oversized bodies, token guessing)."""
from __future__ import annotations

import datetime as dt
import json
from pathlib import Path

import pytest
from conftest import as_user, bind, seed_tree
from fastapi.testclient import TestClient

from smplwise.main import create_app
from smplwise.rbac import ROLES
from smplwise.routers.access import PERMISSION_LABELS
from smplwise.services import presence as svc

API = "/api/v1"
ROOT = Path(__file__).resolve().parents[3]
APP_UA = {"User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 SmplWiseArx/1.0.0 (iOS app)"}
WEB_UA = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/130.0 Safari/537.36"}


@pytest.fixture(autouse=True)
def _limits():
    svc.reset_limits()
    yield
    svc.reset_limits()


@pytest.fixture()
def world(settings):
    app = create_app(settings)
    c = TestClient(app)
    ids = seed_tree(c)
    bind(c, settings, "dana", "operator", "floor", ids["floor2"])  # a floor-scoped operator: holds presence.report at that scope only
    bind(c, settings, "vera", "viewer", "installation", "*")
    c.get(f"{API}/me", headers=as_user("nobody"))  # a user with no binding at all
    return app, c, ids


def register(c: TestClient, user: str, name: str = "הנייד של יוסי", install_id: str = "11111111-2222-3333-4444-555555555555", **extra) -> tuple[int, dict]:
    r = c.post(f"{API}/presence/devices", json={"name": name, "platform": "ios", "install_id": install_id, "app_version": "1.0.0", "os_version": "18.1", "model": "iPhone15,3", **extra}, headers=as_user(user))
    return r.status_code, r.json()


def bearer(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def enable(c: TestClient, **more) -> dict:
    r = c.put(f"{API}/presence/settings", json={"enabled": True, "notice_text": "הודעה לעובדים: המערכת אוספת מיקום לצורך נוכחות.", **more})
    assert r.status_code == 200, r.text
    return r.json()["settings"]


def event(cid: str, typ: str = "fix", **kw) -> dict:
    base = {"client_event_id": cid, "type": typ, "lat": 32.0, "lon": 34.8, "accuracy_m": 18, "at": "2026-10-05T10:00:04Z", "source": "continuous"}
    base.update(kw)
    return base


STATUS_ON = {"location_auth": "always", "precise": True, "sharing": True, "sensors": {"location": "on", "battery": "on"}}


# ---------------------------------------------------------------- roles and labels

def test_presence_permissions_in_every_role_but_kiosk_and_labelled():
    for role, perms in ROLES.items():
        assert ("presence.report" in perms) == (role != "kiosk"), role
    assert "presence.sensors.view" in ROLES["system_admin"] and "presence.sensors.view" not in ROLES["operator"]
    assert PERMISSION_LABELS["presence.report"] and PERMISSION_LABELS["presence.sensors.view"]
    contract = json.loads((ROOT / "contracts" / "examples" / "role-catalog.design.json").read_text(encoding="utf-8"))
    for role in contract["roles"]:
        assert "presence.report" in role["permissions"], role["id"]


# ---------------------------------------------------------------- registration

def test_register_returns_the_token_once_and_stores_only_its_hash(world):
    app, c, _ = world
    status, body = register(c, "dana")
    assert status == 201, body
    token = body["device_token"]
    assert token.startswith("arxd_") and len(token) >= 40 and body["device_id"].startswith("dev_") and body["name"] == "הנייד של יוסי" and body["created"] is True
    with app.state.db.connection(mode="read") as conn:
        row = conn.execute("SELECT * FROM mobile_devices").fetchone()
        assert row["token_hash"] == svc.token_hash(token) and token not in json.dumps(dict(row))
        assert row["user_id"] == "dev-dana" and row["channel"] == "dev"
        blob = " ".join(str(r[0]) for r in conn.execute("SELECT details_json FROM audit_log WHERE action LIKE 'presence.%'").fetchall())
        assert token not in blob
    # the same install registers again: 200, the token is rotated and the old one dies
    status2, body2 = register(c, "dana", name="הנייד של יוסי")
    assert status2 == 200 and body2["device_id"] == body["device_id"] and body2["device_token"] != token and body2["created"] is False
    assert c.get(f"{API}/presence/config", headers=bearer(token)).status_code == 401
    assert c.get(f"{API}/presence/config", headers=bearer(body2["device_token"])).status_code == 200
    # own devices list: no token inside
    mine = c.get(f"{API}/presence/devices/me", headers=as_user("dana")).json()["devices"]
    assert [d["device_id"] for d in mine] == [body["device_id"]] and "device_token" not in json.dumps(mine) and token not in json.dumps(mine)


def test_register_validation_name_uniqueness_permission_and_rate_limit(world):
    app, c, _ = world
    assert register(c, "dana", name="א")[0] == 400 and register(c, "dana", name="x" * 41)[0] == 400
    assert register(c, "dana", install_id="short")[1]["code"] == "invalid_install_id"
    r = c.post(f"{API}/presence/devices", json={"name": "טלפון", "platform": "windows", "install_id": "11111111-2222-3333-4444-555555555555"}, headers=as_user("dana"))
    assert r.status_code == 400 and r.json()["code"] == "invalid_platform"
    assert register(c, "dana", name="הנייד של יוסי")[0] == 201
    status, body = register(c, "dana", name="הנייד של יוסי", install_id="99999999-2222-3333-4444-555555555555")
    assert status == 409 and body["code"] == "device_name_taken" and body["details"]["suggestion"] == "הנייד של יוסי 2"
    # another user may use the same name (uniqueness is per user)
    assert register(c, "vera", name="הנייד של יוסי")[0] == 201
    # no binding at all: 403, audited
    assert register(c, "nobody")[0] == 403
    with app.state.db.connection(mode="read") as conn:
        assert conn.execute("SELECT COUNT(*) FROM audit_log WHERE action = 'presence.report' AND decision = 'denied'").fetchone()[0] == 1
    # the rate limit: 10 registrations per user, then 429
    for i in range(9):
        assert register(c, "vera", name=f"מכשיר {i}", install_id=f"{i:08d}-2222-3333-4444-555555555555")[0] == 201
    assert register(c, "vera", name="עוד אחד", install_id="bbbbbbbb-2222-3333-4444-555555555555")[1]["code"] == "rate_limited"
    svc.reset_limits()
    status, body = register(c, "vera", name="עוד אחד", install_id="aaaaaaaa-2222-3333-4444-555555555555")
    assert status == 409 and body["code"] == "too_many_devices"  # 10 live devices


# ---------------------------------------------------------------- config, the switch and the notice

def test_config_follows_the_master_switch_and_the_notice_version_rises_by_itself(world):
    app, c, _ = world
    _, body = register(c, "dana")
    tok = bearer(body["device_token"])
    cfg = c.get(f"{API}/presence/config", headers=tok).json()
    assert cfg["enabled"] is False and cfg["sensors"]["allowed"] == [] and cfg["sites"] == [] and cfg["notice_version"] == 1 and cfg["mode"] == "continuous"
    assert cfg["interval_s"] == 60 and cfg["distance_filter_m"] == 50 and cfg["device"]["device_id"] == body["device_id"] and cfg["device"]["notice_ack_version"] == 0
    assert [s["key"] for s in cfg["sensors"]["catalog"]] == list(svc.SENSOR_KEYS)
    # a session reads it too; a garbage bearer is refused
    assert c.get(f"{API}/presence/config", headers=as_user("dana")).json()["enabled"] is False
    assert c.get(f"{API}/presence/config", headers=bearer("arxd_" + "x" * 43)).status_code == 401
    st = enable(c, sites=[{"id": "site_main", "name": "המשרד", "lat": 32.0, "lon": 34.8, "radius_m": 150}])
    assert st["enabled"] is True and st["notice_version"] == 2 and st["sensors_allowed"] == list(svc.SENSOR_KEYS)
    cfg = c.get(f"{API}/presence/config", headers=tok).json()
    assert cfg["enabled"] is True and cfg["sensors"]["allowed"] == list(svc.SENSOR_KEYS) and cfg["notice_text"].startswith("הודעה") and cfg["notice_version"] == 2 and cfg["sites"][0]["id"] == "site_main"
    # the same text again does not bump; a change does; trimming the allow-list does not, a newly allowed sensor does
    assert enable(c)["notice_version"] == 2
    r = c.put(f"{API}/presence/settings", json={"notice_text": "גרסה חדשה"})
    assert r.json()["settings"]["notice_version"] == 3
    assert c.put(f"{API}/presence/settings", json={"sensors_allowed": ["location"]}).json()["settings"]["notice_version"] == 3
    assert c.put(f"{API}/presence/settings", json={"sensors_allowed": ["location", "battery"]}).json()["settings"]["notice_version"] == 4
    # a settings change is audited without the notice text itself
    with app.state.db.connection(mode="read") as conn:
        rows = [json.loads(r[0]) for r in conn.execute("SELECT details_json FROM audit_log WHERE action = 'presence.settings.update'").fetchall()]
    assert rows and all("notice_text" not in r for r in rows) and any(r.get("notice_version") == 3 for r in rows)
    # only system.configure
    assert c.get(f"{API}/presence/settings", headers=as_user("dana")).status_code == 403
    assert c.put(f"{API}/presence/settings", json={"enabled": False}, headers=as_user("dana")).status_code == 403
    # validation
    for bad in ({"enabled": "yes"}, {"retention_days": 0}, {"retention_days": 400}, {"interval_s": 5}, {"sensors_allowed": ["camera"]}, {"sites": [{"id": "x", "lat": 95, "lon": 0}]},
                {"nope": 1}, {"required_sensors": {"enabled": True, "sensors": ["microphone"]}}, {"mode": "regions"}):
        assert c.put(f"{API}/presence/settings", json=bad).status_code == 422, bad


def test_ack_and_events_need_the_switch_and_the_current_notice(world):
    app, c, _ = world
    _, body = register(c, "dana")
    did, tok = body["device_id"], bearer(body["device_token"])
    # switched off: an event batch is refused, the status alone is accepted
    r = c.post(f"{API}/presence/devices/{did}/events", json={"events": [event("e1")], "status": STATUS_ON}, headers=tok)
    assert r.status_code == 409 and r.json()["code"] == "presence_disabled"
    r = c.post(f"{API}/presence/devices/{did}/events", json={"events": [], "status": STATUS_ON}, headers=tok)
    assert r.status_code == 200 and r.json() == {"accepted": 0, "duplicates": 0, "inside": None, "site_id": None, "notice_version": 1}
    enable(c)  # version 2
    r = c.post(f"{API}/presence/devices/{did}/events", json={"events": [event("e1")]}, headers=tok)
    assert r.status_code == 409 and r.json()["code"] == "notice_ack_required" and r.json()["details"]["notice_version"] == 2
    r = c.post(f"{API}/presence/devices/{did}/ack", json={"notice_version": 1}, headers=tok)
    assert r.status_code == 409 and r.json()["code"] == "notice_version_stale" and r.json()["details"]["notice_version"] == 2
    assert c.post(f"{API}/presence/devices/{did}/ack", json={"notice_version": 2}, headers=tok).json() == {"ok": True, "notice_version": 2}
    assert c.post(f"{API}/presence/devices/{did}/events", json={"events": [event("e1")]}, headers=tok).json()["accepted"] == 1
    mine = c.get(f"{API}/presence/devices/me", headers=as_user("dana")).json()["devices"][0]
    assert mine["notice_ack_version"] == 2 and mine["notice_ack_at"]
    # a session cannot acknowledge for a device (device token only)
    assert c.post(f"{API}/presence/devices/{did}/ack", json={"notice_version": 2}, headers=as_user("dana")).status_code == 401


# ---------------------------------------------------------------- events

def test_events_are_idempotent_validated_and_update_the_current_state(world):
    app, c, _ = world
    _, body = register(c, "dana")
    did, tok = body["device_id"], bearer(body["device_token"])
    enable(c, sites=[{"id": "site_main", "name": "המשרד", "lat": 32.0, "lon": 34.8, "radius_m": 150}])
    c.post(f"{API}/presence/devices/{did}/ack", json={"notice_version": 2}, headers=tok)
    batch = {"events": [event("e1", at="2026-10-05T10:00:00Z"), event("e2", at="2026-10-05T10:01:00Z", lat=32.1, lon=34.9),
                        {"client_event_id": "s1", "type": "sensor", "sensor": "battery", "at": "2026-10-05T10:00:30Z", "value": {"level": 82, "charging": False}}],
             "status": STATUS_ON}
    r = c.post(f"{API}/presence/devices/{did}/events", json=batch, headers=tok)
    assert r.status_code == 200, r.text
    assert r.json() == {"accepted": 3, "duplicates": 0, "inside": False, "site_id": None, "notice_version": 2}  # the newest fix is 15 km away
    # the same batch again: all duplicates, nothing changes
    assert c.post(f"{API}/presence/devices/{did}/events", json=batch, headers=tok).json()["accepted"] == 0
    assert c.post(f"{API}/presence/devices/{did}/events", json=batch, headers=tok).json()["duplicates"] == 3
    # an enter event, then an older fix that must not move the state back
    r = c.post(f"{API}/presence/devices/{did}/events", json={"events": [event("e3", "enter", site_id="site_main", at="2026-10-05T10:05:00Z"), event("e0", at="2026-10-05T09:00:00Z", lat=31.0, lon=34.0)]}, headers=tok)
    assert r.json()["inside"] is True and r.json()["site_id"] == "site_main"
    state = c.get(f"{API}/presence/devices/{did}/state", headers=tok).json()
    assert state["presence"]["inside"] is True and state["presence"]["site_id"] == "site_main" and state["presence"]["at"] == "2026-10-05T10:05:00Z" and state["presence"]["lat"] == 32.0
    assert state["status"]["sensors"]["location"] == "on" and state["status"]["sensors"]["battery"] == "on" and state["status"]["sensors"]["steps"] == "off" and state["status"]["sharing"] is True
    # a fix inside the geofence without a site id is matched to it
    assert c.post(f"{API}/presence/devices/{did}/events", json={"events": [event("e4", at="2026-10-05T10:06:00Z", lat=32.0005, lon=34.8005)]}, headers=tok).json() == {"accepted": 1, "duplicates": 0, "inside": True, "site_id": "site_main", "notice_version": 2}
    with app.state.db.connection(mode="read") as conn:
        rows = conn.execute("SELECT client_event_id, type, sensor, value_json FROM mobile_presence_events ORDER BY id").fetchall()
        assert [r[0] for r in rows] == ["e1", "s1", "e2", "e0", "e3", "e4"] and rows[1][2] == "battery"  # a batch is stored in time order and json.loads(rows[1][3]) == {"level": 82, "charging": False}
    # validation: a sensor not allowed, an unknown sensor, a bad coordinate, a bad time, a missing id
    for bad, code in (
        ({"client_event_id": "x1x1x1x1", "type": "sensor", "sensor": "activity", "at": "2026-10-05T10:00:00Z", "value": {}}, "ok"),
        ({"client_event_id": "x2x2x2x2", "type": "sensor", "sensor": "microphone", "at": "2026-10-05T10:00:00Z", "value": {}}, "sensor_not_allowed"),
        (event("x3x3x3x3", lat=95), "invalid_event"),
        (event("x4x4x4x4", at="yesterday"), "invalid_event"),
        ({"type": "fix", "lat": 1, "lon": 1, "at": "2026-10-05T10:00:00Z"}, "invalid_event"),
        ({"client_event_id": "x5x5x5x5", "type": "sensor", "sensor": "battery", "at": "2026-10-05T10:00:00Z", "value": {"blob": "x" * 2000}}, "invalid_event"),
        ({"client_event_id": "x6x6x6x6", "type": "teleport", "at": "2026-10-05T10:00:00Z"}, "invalid_event"),
    ):
        r = c.post(f"{API}/presence/devices/{did}/events", json={"events": [bad]}, headers=tok)
        if code == "ok":
            assert r.status_code == 200, r.text
        else:
            assert r.status_code == 400 and r.json()["code"] == code, (bad, r.text)
    assert c.put(f"{API}/presence/settings", json={"sensors_allowed": ["battery"]}).status_code == 200
    r = c.post(f"{API}/presence/devices/{did}/events", json={"events": [event("x7x7x7x7")]}, headers=tok)
    assert r.status_code == 400 and r.json()["code"] == "sensor_not_allowed" and r.json()["details"]["sensor"] == "location"
    r = c.post(f"{API}/presence/devices/{did}/events", json={"events": [{"client_event_id": "x8x8x8x8", "type": "sensor", "sensor": "steps", "at": "2026-10-05T10:00:00Z", "value": {"delta": 10}}]}, headers=tok)
    assert r.json()["details"]["sensor"] == "steps"
    # the batch cap
    r = c.post(f"{API}/presence/devices/{did}/events", json={"events": [event(f"b{i:07d}") for i in range(51)]}, headers=tok)
    assert r.status_code == 422


# ---------------------------------------------------------------- security

def test_cross_user_access_is_refused_like_a_missing_device_and_audited(world):
    app, c, _ = world
    _, a = register(c, "dana", install_id="aaaaaaaa-0000-0000-0000-000000000000")
    _, b = register(c, "vera", install_id="bbbbbbbb-0000-0000-0000-000000000000")
    enable(c)
    ta, tb = bearer(a["device_token"]), bearer(b["device_token"])
    # device A's token on device B's routes
    for method, path, body in (("post", f"/presence/devices/{b['device_id']}/ack", {"notice_version": 2}), ("post", f"/presence/devices/{b['device_id']}/events", {"events": []}),
                               ("patch", f"/presence/devices/{b['device_id']}", {"name": "גנוב"}), ("get", f"/presence/devices/{b['device_id']}/state", None), ("delete", f"/presence/devices/{b['device_id']}", None)):
        r = getattr(c, method)(f"{API}{path}", headers=ta, **({"json": body} if body is not None else {}))
        assert r.status_code == 404, (method, path, r.text)
    # user dana's session on vera's device
    assert c.patch(f"{API}/presence/devices/{b['device_id']}", json={"name": "גנוב"}, headers=as_user("dana")).status_code == 404
    assert c.delete(f"{API}/presence/devices/{b['device_id']}", headers=as_user("dana")).status_code == 404
    assert c.get(f"{API}/presence/devices/{b['device_id']}/state", headers=as_user("dana")).status_code == 404
    # vera (a viewer) may not list everyone's devices; the administrator may, and sees both with their users but no token
    assert c.get(f"{API}/presence/devices", headers=as_user("vera")).status_code == 403
    allr = c.get(f"{API}/presence/devices").json()
    assert {d["user"]["id"] for d in allr["devices"]} == {"dev-dana", "dev-vera"} and "token" not in json.dumps(allr)
    assert c.get(f"{API}/presence/devices", params={"user_id": "dev-vera"}).json()["devices"][0]["device_id"] == b["device_id"]
    # the administrator may remove another user's device; the token dies with it and the audit says who did it
    assert c.delete(f"{API}/presence/devices/{b['device_id']}").status_code == 204
    assert c.get(f"{API}/presence/config", headers=tb).status_code == 401
    assert c.get(f"{API}/presence/devices/me", headers=as_user("vera")).json()["devices"] == []
    with app.state.db.connection(mode="read") as conn:
        denied = conn.execute("SELECT COUNT(*) FROM audit_log WHERE action = 'presence.device.access' AND decision = 'denied'").fetchone()[0]
        assert denied >= 8
        row = conn.execute("SELECT details_json FROM audit_log WHERE action = 'presence.device.unregister'").fetchone()
        assert json.loads(row[0])["by_admin"] is True
        assert conn.execute("SELECT revoked_at, push_relay_token FROM mobile_devices WHERE id = ?", (b["device_id"],)).fetchone()[0]
    # the owner's own unregister through the token
    assert c.delete(f"{API}/presence/devices/{a['device_id']}", headers=ta).status_code == 204
    assert c.get(f"{API}/presence/config", headers=ta).status_code == 401


def test_token_guessing_is_throttled_and_oversized_bodies_are_refused(world, monkeypatch):
    # the limiters refill / age out on a monotonic clock: freeze it, or a slow machine (61 posts taking > 1 s earns a token back) flips the 429
    monkeypatch.setattr(svc, "_now", lambda: 1000.0)
    app, c, _ = world
    _, a = register(c, "dana")
    did = a["device_id"]
    for _ in range(20):
        assert c.get(f"{API}/presence/config", headers=bearer("arxd_" + "7" * 43)).status_code == 401
    assert c.get(f"{API}/presence/config", headers=bearer("arxd_" + "7" * 43)).status_code == 429  # per token key, a minute's window
    assert c.get(f"{API}/presence/config", headers=bearer(a["device_token"])).status_code == 200  # a real token is not caught by it
    svc.reset_limits()
    # a non-device bearer on a device-only route is a plain 401, not a session lookup
    assert c.post(f"{API}/presence/devices/{did}/ack", json={"notice_version": 1}, headers={"Authorization": "Bearer eyJhbGciOiJIUzI1NiJ9.x.y"}).status_code == 401
    # a body over the route's cap (1 MiB locally; 64 KiB for an anonymous caller on the remote channel) is refused while it streams
    huge = {"events": [], "status": {"sensors": {"location": "on"}, "pad": "x" * (1024 * 1024 + 10)}}
    r = c.post(f"{API}/presence/devices/{did}/events", content=json.dumps(huge), headers={**bearer(a["device_token"]), "Content-Type": "application/json"})
    assert r.status_code == 413 and r.json()["code"] == "payload_too_large"
    # an oversized sensor value inside a legal body is a 400
    enable(c)
    c.post(f"{API}/presence/devices/{did}/ack", json={"notice_version": 2}, headers=bearer(a["device_token"]))
    big = {"client_event_id": "big-big-big", "type": "sensor", "sensor": "battery", "at": "2026-10-05T10:00:00Z", "value": {f"k{i}": i for i in range(25)}}
    assert c.post(f"{API}/presence/devices/{did}/events", json={"events": [big]}, headers=bearer(a["device_token"])).status_code == 400
    # the events rate limit per device
    for i in range(60):
        c.post(f"{API}/presence/devices/{did}/events", json={"events": []}, headers=bearer(a["device_token"]))
    assert c.post(f"{API}/presence/devices/{did}/events", json={"events": []}, headers=bearer(a["device_token"])).status_code == 429


# ---------------------------------------------------------------- rename and the own list

def test_rename_by_token_or_session_keeps_names_unique(world):
    app, c, _ = world
    _, a = register(c, "dana", name="ראשון", install_id="aaaaaaaa-0000-0000-0000-000000000000")
    _, b = register(c, "dana", name="שני", install_id="bbbbbbbb-0000-0000-0000-000000000000")
    assert c.patch(f"{API}/presence/devices/{a['device_id']}", json={"name": "  הנייד  של   יוסי "}, headers=bearer(a["device_token"])).json()["name"] == "הנייד של יוסי"
    r = c.patch(f"{API}/presence/devices/{b['device_id']}", json={"name": "הנייד של יוסי"}, headers=as_user("dana"))
    assert r.status_code == 409 and r.json()["details"]["suggestion"] == "הנייד של יוסי 2"
    assert c.patch(f"{API}/presence/devices/{b['device_id']}", json={"name": "x"}, headers=as_user("dana")).status_code == 400
    assert c.patch(f"{API}/presence/devices/{b['device_id']}", json={"name": "שלישי"}, headers=as_user("dana")).json()["name"] == "שלישי"
    names = [d["name"] for d in c.get(f"{API}/presence/devices/me", headers=as_user("dana")).json()["devices"]]
    assert names == ["הנייד של יוסי", "שלישי"]


# ---------------------------------------------------------------- the required-sensors policy

def test_required_sensors_policy_blocks_the_app_until_the_sensor_is_on_never_admins(world):
    app, c, ids = world
    _, a = register(c, "dana")
    did, tok = a["device_id"], bearer(a["device_token"])
    # before any policy exists nothing mentions the gate
    assert "presence_gate" not in c.get(f"{API}/me", headers={**as_user("dana"), **APP_UA}).json()
    enable(c, required_sensors={"enabled": True, "sensors": ["location"]})
    # the app session of dana is blocked everywhere but the paths that lead out; a browser is not; /me explains
    me = c.get(f"{API}/me", headers={**as_user("dana"), **APP_UA}).json()
    assert me["presence_gate"] == {"required": ["location"], "missing": ["location"], "blocked": True, "applies": True, "channel": "app", "break_glass_until": None, "reason": "missing_sensors"}
    r = c.get(f"{API}/sites", headers={**as_user("dana"), **APP_UA})
    assert r.status_code == 403 and r.json()["code"] == "presence_required" and r.json()["details"]["missing"] == ["location"] and "מיקום" in r.json()["user_message"]
    assert c.get(f"{API}/presence/config", headers={**as_user("dana"), **APP_UA}).status_code == 200
    assert c.get(f"{API}/presence/devices/me", headers={**as_user("dana"), **APP_UA}).status_code == 200
    assert c.get(f"{API}/sites", headers={**as_user("dana"), **WEB_UA}).status_code == 200
    assert c.get(f"{API}/me", headers={**as_user("dana"), **WEB_UA}).json()["presence_gate"]["reason"] == "web_not_covered"
    # the administrator is never blocked, from the app either
    assert c.get(f"{API}/sites", headers=APP_UA).status_code == 200
    assert c.get(f"{API}/me", headers=APP_UA).json()["presence_gate"]["reason"] == "exempt"
    # one audit row per user per window, not per request
    c.get(f"{API}/sites", headers={**as_user("dana"), **APP_UA})
    with app.state.db.connection(mode="read") as conn:
        assert conn.execute("SELECT COUNT(*) FROM audit_log WHERE action = 'presence.gate.refused'").fetchone()[0] == 1
    # the phone acknowledges the notice and reports location on: the gate opens (the status alone is enough, no event needed)
    c.post(f"{API}/presence/devices/{did}/ack", json={"notice_version": 2}, headers=tok)
    assert c.post(f"{API}/presence/devices/{did}/events", json={"events": [], "status": STATUS_ON}, headers=tok).status_code == 200
    assert c.get(f"{API}/sites", headers={**as_user("dana"), **APP_UA}).status_code == 200
    assert c.get(f"{API}/me", headers={**as_user("dana"), **APP_UA}).json()["presence_gate"]["blocked"] is False
    # sharing switched off on the phone: blocked again; a stale report (older than max_stale_hours) does not count either
    c.post(f"{API}/presence/devices/{did}/events", json={"events": [], "status": {**STATUS_ON, "sharing": False}}, headers=tok)
    assert c.get(f"{API}/sites", headers={**as_user("dana"), **APP_UA}).status_code == 403
    c.post(f"{API}/presence/devices/{did}/events", json={"events": [], "status": STATUS_ON}, headers=tok)
    with app.state.db.connection() as conn:
        st = json.loads(conn.execute("SELECT status_json FROM mobile_devices WHERE id = ?", (did,)).fetchone()[0])
        st["reported_at"] = "2026-01-01T00:00:00Z"
        conn.execute("UPDATE mobile_devices SET status_json = ? WHERE id = ?", (json.dumps(st), did))
    assert c.get(f"{API}/sites", headers={**as_user("dana"), **APP_UA}).status_code == 403
    # a new notice version: the device must acknowledge again before its report counts
    c.post(f"{API}/presence/devices/{did}/events", json={"events": [], "status": STATUS_ON}, headers=tok)
    assert c.get(f"{API}/sites", headers={**as_user("dana"), **APP_UA}).status_code == 200
    c.put(f"{API}/presence/settings", json={"notice_text": "נוסח חדש"})
    assert c.get(f"{API}/sites", headers={**as_user("dana"), **APP_UA}).status_code == 403
    c.post(f"{API}/presence/devices/{did}/ack", json={"notice_version": 3}, headers=tok)
    assert c.get(f"{API}/sites", headers={**as_user("dana"), **APP_UA}).status_code == 200
    # break-glass: the policy is suspended with a reason, audited; 0 ends it
    r = c.post(f"{API}/presence/settings/break-glass", json={"hours": 2, "reason": "תקלה באפליקציה"})
    assert r.status_code == 200 and r.json()["break_glass"]["until"] and r.json()["break_glass"]["by"] == "dev-joni"
    c.post(f"{API}/presence/devices/{did}/events", json={"events": [], "status": {**STATUS_ON, "sharing": False}}, headers=tok)
    me = c.get(f"{API}/me", headers={**as_user("dana"), **APP_UA}).json()["presence_gate"]
    assert me["blocked"] is False and me["reason"] == "break_glass" and me["missing"] == ["location"]
    assert c.get(f"{API}/sites", headers={**as_user("dana"), **APP_UA}).status_code == 200
    assert c.post(f"{API}/presence/settings/break-glass", json={"hours": 2, "reason": ""}).status_code == 422
    assert c.post(f"{API}/presence/settings/break-glass", json={"hours": 0}).json()["break_glass"]["until"] is None
    assert c.get(f"{API}/sites", headers={**as_user("dana"), **APP_UA}).status_code == 403
    assert c.post(f"{API}/presence/settings/break-glass", json={"hours": 1, "reason": "בדיקה"}, headers=as_user("dana")).status_code == 403
    with app.state.db.connection(mode="read") as conn:
        assert conn.execute("SELECT COUNT(*) FROM audit_log WHERE action = 'presence.break_glass' AND decision = 'allowed'").fetchone()[0] == 2
    # the policy scoped to roles / users and the web switch
    c.put(f"{API}/presence/settings", json={"required_sensors": {"enabled": True, "sensors": ["location"], "roles": ["viewer"]}})
    assert c.get(f"{API}/sites", headers={**as_user("dana"), **APP_UA}).status_code == 200  # dana is an operator
    assert c.get(f"{API}/me", headers={**as_user("dana"), **APP_UA}).json()["presence_gate"]["reason"] == "not_in_scope"
    assert c.get(f"{API}/sites", headers={**as_user("vera"), **APP_UA}).status_code == 403  # vera is a viewer with no device
    c.put(f"{API}/presence/settings", json={"required_sensors": {"enabled": True, "sensors": ["location"], "users": ["dev-vera"], "apply_to_web": True}})
    assert c.get(f"{API}/sites", headers={**as_user("vera"), **WEB_UA}).status_code == 403
    assert c.get(f"{API}/sites", headers={**as_user("vera"), **WEB_UA}).json()["details"]["channel"] == "web"
    c.put(f"{API}/presence/settings", json={"required_sensors": {"enabled": True, "sensors": ["location"], "exempt_users": ["dev-vera"], "apply_to_web": True}})
    assert c.get(f"{API}/sites", headers={**as_user("vera"), **WEB_UA}).status_code == 200
    # the master switch off makes the policy inert (nothing can be reported, so nothing is required)
    c.put(f"{API}/presence/settings", json={"required_sensors": {"enabled": True, "sensors": ["location"]}, "enabled": False})
    assert c.get(f"{API}/sites", headers={**as_user("dana"), **APP_UA}).status_code == 200
    assert c.get(f"{API}/me", headers={**as_user("dana"), **APP_UA}).json()["presence_gate"]["reason"] == "presence_disabled"
    # ... and switching the policy off clears everything
    c.put(f"{API}/presence/settings", json={"required_sensors": {"enabled": False, "sensors": []}, "enabled": True})
    assert c.get(f"{API}/me", headers={**as_user("dana"), **APP_UA}).json()["presence_gate"] is None


# ---------------------------------------------------------------- retention

def test_janitor_prunes_events_messages_and_revoked_rows_per_the_retention_setting(world):
    app, c, _ = world
    _, a = register(c, "dana")
    did, tok = a["device_id"], bearer(a["device_token"])
    enable(c, retention_days=7)
    c.post(f"{API}/presence/devices/{did}/ack", json={"notice_version": 2}, headers=tok)
    old = (dt.datetime.now(dt.timezone.utc) - dt.timedelta(days=10)).strftime("%Y-%m-%dT%H:%M:%SZ")
    fresh = (dt.datetime.now(dt.timezone.utc) - dt.timedelta(days=1)).strftime("%Y-%m-%dT%H:%M:%SZ")
    assert c.post(f"{API}/presence/devices/{did}/events", json={"events": [event("old-old-old", at=old), event("new-new-new", at=fresh)]}, headers=tok).json()["accepted"] == 2
    with app.state.db.connection() as conn:
        conn.execute("INSERT INTO mobile_push_messages(id, device_id, user_id, mode, category, title, body, deep_link, at, expires_at) VALUES ('m1', ?, 'dev-dana', 'new', 'alerts', 't', 'b', '#/x', ?, ?)", (did, old, old))
        conn.execute("INSERT INTO mobile_devices(id, user_id, name, platform, install_id, token_hash, token_rotated_at, created_at, last_seen_at, revoked_at) VALUES ('dev_gone', 'dev-x', 'ישן', 'ios', 'i', 'h', ?, ?, ?, '2026-01-01T00:00:00Z')", (old, old, old))
    assert svc.janitor(app.state.db) == {"events": 1, "messages": 1, "devices": 1}
    with app.state.db.connection(mode="read") as conn:
        assert [r[0] for r in conn.execute("SELECT client_event_id FROM mobile_presence_events").fetchall()] == ["new-new-new"]
        assert conn.execute("SELECT COUNT(*) FROM mobile_devices").fetchone()[0] == 1


def test_janitor_on_an_empty_installation_is_a_no_op(world):
    app, _, _ = world
    assert svc.janitor(app.state.db) == {"events": 0, "messages": 0, "devices": 0}
