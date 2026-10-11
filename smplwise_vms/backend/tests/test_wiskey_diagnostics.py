"""WisKey diagnostics, B0 ported as CR-036 S1: "what WisKey sees Arx as" - `GET /intercom/diagnostics` (system.configure,
audited), the closed projection of `authorization/session`, the two identities (service, background), the per-channel
allow-lists and the findings. B0's third identity (the signed-in operator's own Home Assistant token) is not ported: under
CR-036 Arx RBAC is the authority and no operator token is sent to WisKey.

Everything runs against scripted Home Assistant WebSockets (tests/test_intercom.py's FakeHa); no WisKey, no Home Assistant, no
device is contacted."""
from __future__ import annotations

import copy
import json
from typing import Any

import pytest
from conftest import as_user, bind
from fastapi.testclient import TestClient
from test_intercom import FakeHa, feed, normal, ok, wait_for  # noqa: F401 - `feed` is a fixture
from test_wiskey_background import PERSON_MARKERS, background_script, both_ready, by_token, service_script, split  # noqa: F401 - `split` is a fixture

from smplwise.services import intercom_client, intercom_sync, wiskey_channels, wiskey_diagnostics as diag

AUTH = "hikvision_intercom/authorization/session"

ADMIN_AUTH = {
    "allowed": True, "is_admin": True, "revision": 3, "personal_renewal": False,
    "areas": {"overview": "manage", "users": "manage", "events": "manage", "stations": "manage", "management": "manage"},
    "fields": {"phone": "manage", "photo": "manage", "credentials": "manage", "profile": "manage", "access": "manage"},
    "station_ids": None, "security": {"locked": False, "idle_minutes": 0, "reauth_sensitive": False, "elevated": False},
}
NARROW_AUTH = {
    "allowed": True, "is_admin": False, "revision": 7, "personal_renewal": False,
    "areas": {"overview": "view", "users": "none", "events": "none", "stations": "none", "management": "none"},
    "fields": {"phone": "none", "photo": "none", "credentials": "none", "profile": "none", "access": "none"},
    "station_ids": ["entry-a"], "profile_fields": {"badge-colour": "view"}, "security": {"locked": False, "idle_minutes": 0, "reauth_sensitive": False, "elevated": False},
}


def scripted(service: dict[str, Any] | None = ADMIN_AUTH):
    def script(msg: dict[str, Any], fake: FakeHa) -> list[Any]:
        if msg["type"] == AUTH:
            return [ok(msg, copy.deepcopy(service))]
        return normal(msg, fake)

    return script


# ---------------------------------------------------------------- the projection

def test_the_authorization_projection_keeps_permission_facts_only():
    p = diag.project_authorization(NARROW_AUTH)
    assert p == {
        "allowed": True, "is_admin": False,
        "areas": {"overview": "view", "users": "none", "events": "none", "stations": "none", "management": "none"},
        "fields": {"phone": "none", "photo": "none", "credentials": "none", "profile": "none", "access": "none"},
        "station_scope": {"kind": "explicit", "count": 1, "ids": ["entry-a"]},
        "revision": 7, "personal_renewal": False,
        "security": {"locked": False, "idle_minutes": 0, "reauth_sensitive": False, "elevated": False},
    }, "profile_fields is not kept"
    assert diag.project_authorization(ADMIN_AUTH)["station_scope"] == {"kind": "all", "count": None, "ids": []}
    assert diag.project_authorization({**NARROW_AUTH, "station_ids": []})["station_scope"] == {"kind": "explicit", "count": 0, "ids": []}
    # `users` / `phone` / `photo` / `profile` appear only as WisKey's permission CATEGORY names (levels), never as data
    assert not any(marker in json.dumps(p) for marker in PERSON_MARKERS)


def test_unrecognised_values_are_unknown_not_permissions():
    p = diag.project_authorization({"allowed": "yes", "is_admin": 1, "areas": {"overview": "superuser", "users": None}, "fields": {"phone": "edit"},
                                    "station_ids": "all", "revision": True, "security": {"locked": "no", "idle_minutes": "5"}})
    assert p["allowed"] is None and p["is_admin"] is None and p["revision"] is None
    assert p["areas"] == {"overview": "unknown", "users": "unknown", "events": "unknown", "stations": "unknown", "management": "unknown"}
    assert p["fields"]["phone"] == "unknown" and p["station_scope"]["kind"] == "unknown"
    assert p["security"] == {"locked": None, "idle_minutes": None, "reauth_sensitive": None, "elevated": None}
    assert diag.project_authorization({})["security"] is None
    with pytest.raises(ValueError):
        diag.project_authorization([])
    with pytest.raises(ValueError):
        diag.project_authorization(None)


def test_a_long_station_list_is_capped_but_counted():
    p = diag.project_authorization({**NARROW_AUTH, "station_ids": [f"s{i}" for i in range(500)]})
    assert p["station_scope"]["count"] == 500 and len(p["station_scope"]["ids"]) == diag.MAX_STATION_IDS


# ---------------------------------------------------------------- the endpoint: shared identity (no background account yet)

def admin_client(app: Any, s: Any) -> TestClient:
    c = TestClient(app)
    bind(c, s, "root", "system_admin", "installation", "*")
    bind(c, s, "vera", "viewer", "installation", "*")
    bind(c, s, "sam", "site_admin", "installation", "*")
    return c


def test_only_the_system_administrator_may_read_the_diagnostics(feed):
    app, s, install = feed
    install(scripted())
    intercom_sync.SYNC.start(s)
    wait_for(lambda: intercom_sync.STATE.state == "ready")
    c = admin_client(app, s)
    for user in ("vera", "sam", "nobody"):
        r = c.get("/api/v1/intercom/diagnostics", headers=as_user(user))
        assert r.status_code == 403, user
    assert c.get("/api/v1/intercom/diagnostics", headers=as_user("root")).status_code == 200


def test_before_the_background_account_exists_the_diagnostics_say_it_shares_the_service_identity(feed):
    app, s, install = feed
    fakes = install(scripted())
    intercom_sync.SYNC.start(s)
    wait_for(lambda: intercom_sync.STATE.state == "ready")
    c = admin_client(app, s)
    body = c.get("/api/v1/intercom/diagnostics", headers=as_user("root")).json()
    assert body["service"]["identity"] == "service" and body["service"]["state"] == "ready" and body["service"]["subscribe"] == "ok"
    assert body["service"]["authorization_state"] == "ok" and body["service"]["authorization"]["is_admin"] is True
    assert body["service"]["authorization"]["station_scope"]["kind"] == "all"
    assert body["background"] == {"identity": "service", "split": False, "configured": False, "state": "shares_service_identity", "last_error": None, "connected": None,
                                  "wiskey_version": None, "subscribe": "n/a", "authorization": None, "authorization_state": "not_asked"}
    assert "operator" not in body, "no per-operator WisKey identity under CR-036"
    assert body["channels"] == wiskey_channels.describe() and body["channels"]["background"] == ["authorization/session", "overview", "subscribe"]
    codes = {(f["code"], f["level"], f["subject"]) for f in body["findings"]}
    assert ("background_shares_service_identity", "warn", "background") in codes and ("service_identity_is_admin", "info", "service") in codes
    assert [m["type"] for m in fakes[0].sent].count(AUTH) == 1, "one authorization/session read, over the service session"
    assert not any(m["type"].startswith("hikvision_intercom/") and m["type"] not in ("hikvision_intercom/overview", "hikvision_intercom/subscribe", AUTH) for m in fakes[0].sent), "read-only"
    text = json.dumps(body, ensure_ascii=False)
    assert not any(marker in text for marker in PERSON_MARKERS)


def test_without_home_assistant_the_diagnostics_still_answer_honestly(settings):
    from smplwise.main import create_app

    intercom_sync.SYNC.reset()
    c = admin_client(create_app(settings), settings)
    body = c.get("/api/v1/intercom/diagnostics", headers=as_user("root")).json()
    assert body["service"]["state"] == "ha_not_configured" and body["service"]["authorization"] is None and body["service"]["authorization_state"] == "not_asked"


def test_a_locked_connection_and_idle_settings_are_reported(feed):
    app, s, install = feed
    locked = {**ADMIN_AUTH, "security": {"locked": True, "idle_minutes": 15, "reauth_sensitive": True, "elevated": False}}
    install(scripted(locked))
    intercom_sync.SYNC.start(s)
    wait_for(lambda: intercom_sync.STATE.state == "ready")
    body = admin_client(app, s).get("/api/v1/intercom/diagnostics", headers=as_user("root")).json()
    codes = {(f["code"], f["subject"]) for f in body["findings"]}
    assert ("connection_locked", "service") in codes and ("idle_or_reauth_configured", "service") in codes


# ---------------------------------------------------------------- the endpoint: split background session

def split_script(auth: dict[str, Any]):
    def script(msg: dict[str, Any], fake: FakeHa) -> list[Any]:
        if msg["type"] == AUTH:
            return [ok(msg, copy.deepcopy(auth))]
        return background_script(msg, fake)

    return script


def service_with_auth(msg: dict[str, Any], fake: FakeHa) -> list[Any]:
    if msg["type"] == AUTH:
        return [ok(msg, copy.deepcopy(ADMIN_AUTH))]
    return service_script(msg, fake)


def test_each_identity_is_asked_over_its_own_session(split):
    app, s, install, wbf = split
    conns = install(service_with_auth, split_script(NARROW_AUTH))
    intercom_sync.SYNC.start(s)
    wbf.FEED.start(s)
    both_ready(wbf)
    body = admin_client(app, s).get("/api/v1/intercom/diagnostics", headers=as_user("root")).json()
    assert body["service"]["authorization"]["is_admin"] is True and body["background"]["authorization"]["is_admin"] is False
    background = body["background"]
    assert background["identity"] == "background" and background["split"] is True and background["state"] == "ready" and background["subscribe"] == "ok"
    assert background["authorization"]["areas"]["overview"] == "view" and background["authorization"]["station_scope"] == {"kind": "explicit", "count": 1, "ids": ["entry-a"]}
    assert [m["type"] for m in by_token(conns, "bg-token").sent].count(AUTH) == 1 and [m["type"] for m in by_token(conns, "t").sent].count(AUTH) == 1
    codes = {f["code"] for f in body["findings"]}
    assert "background_shares_service_identity" not in codes and "background_is_admin" not in codes and "background_has_more_than_overview" not in codes
    assert "bg-token" not in json.dumps(body)


def test_a_background_account_that_is_too_powerful_is_flagged(split):
    app, s, install, wbf = split
    install(service_with_auth, split_script(ADMIN_AUTH))
    intercom_sync.SYNC.start(s)
    wbf.FEED.start(s)
    both_ready(wbf)
    codes = {(f["code"], f["level"]) for f in admin_client(app, s).get("/api/v1/intercom/diagnostics", headers=as_user("root")).json()["findings"]}
    assert ("background_is_admin", "warn") in codes and ("background_has_more_than_overview", "warn") in codes and ("background_scope_is_all_stations", "info") in codes


def test_a_background_account_with_more_than_overview_or_without_overview_is_flagged(split):
    app, s, install, wbf = split
    wide = {**NARROW_AUTH, "areas": {**NARROW_AUTH["areas"], "users": "view"}}
    install(service_with_auth, split_script(wide))
    intercom_sync.SYNC.start(s)
    wbf.FEED.start(s)
    both_ready(wbf)
    c = admin_client(app, s)
    assert "background_has_more_than_overview" in {f["code"] for f in c.get("/api/v1/intercom/diagnostics", headers=as_user("root")).json()["findings"]}


def test_a_background_session_that_is_not_ready_says_so(split):
    app, s, install, wbf = split

    def refused(msg: dict[str, Any], fake: FakeHa) -> list[Any]:
        if msg["type"] == "hikvision_intercom/overview":
            return [{"id": msg["id"], "type": "result", "success": False, "error": {"code": "unauthorized", "message": "unauthorized"}}]
        return [ok(msg)]

    install(service_with_auth, refused)
    intercom_sync.SYNC.start(s)
    wbf.FEED.start(s)
    wait_for(lambda: wbf.FEED.status["state"] == "forbidden" and intercom_sync.STATE.state == "ready")
    body = admin_client(app, s).get("/api/v1/intercom/diagnostics", headers=as_user("root")).json()
    assert body["background"]["state"] == "forbidden" and body["background"]["authorization"] is None and body["background"]["authorization_state"] == "forbidden"
    assert "background_authorization_unavailable" in {f["code"] for f in body["findings"]}


def test_the_background_session_refuses_any_read_outside_its_allow_list(split):
    app, s, install, wbf = split
    install(service_with_auth, split_script(NARROW_AUTH))
    wbf.FEED.start(s)
    wait_for(lambda: wbf.FEED.status["state"] == "ready")
    for command in ("overview", "events/list", "users/query", "stations/test_unlock", "tts/start"):
        with pytest.raises(ValueError):
            wbf.FEED.command(command, intercom_client.authorization_session)


# ---------------------------------------------------------------- audit and the operator probe that was not ported

def test_each_diagnostics_run_leaves_one_audit_row_with_codes_only(feed):
    app, s, install = feed
    install(scripted())
    intercom_sync.SYNC.start(s)
    wait_for(lambda: intercom_sync.STATE.state == "ready")
    c = admin_client(app, s)
    assert c.get("/api/v1/intercom/diagnostics", headers=as_user("root")).status_code == 200
    assert c.get("/api/v1/intercom/diagnostics", headers=as_user("vera")).status_code == 403
    with app.state.db.connection() as conn:
        rows = conn.execute("SELECT actor_user_id, decision, details_json FROM audit_log WHERE action = 'intercom.diagnostics.read'").fetchall()
    assert len(rows) == 1 and rows[0][0].endswith("root") and rows[0][1] == "allowed", rows
    details = json.loads(rows[0][2])
    assert details["service"] == "ok" and details["background"] == "not_asked" and details["split"] is False
    assert "background_shares_service_identity" in details["findings"]


def test_the_operator_probe_module_is_gone():
    import importlib.util

    assert importlib.util.find_spec("smplwise.services.wiskey_operator") is None
