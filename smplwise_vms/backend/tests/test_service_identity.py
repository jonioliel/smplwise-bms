"""USR2 phase 3, the ADD-ON side: the service identity (services/service_identity.py, routers/service_identity.py) - negative cases first.

An Arx-only (local) principal acts in Home Assistant only through ONE configured, non-administrator Home Assistant user, only for the
per-feature allow-list (devices, alarm under the PIN rules, media, cast, schedules), never for automations, the area write, the stream source
or doors; the person's id in `on_behalf_of` is the authenticated principal's and nothing else; a Home Assistant principal is untouched;
nothing changes while `security.local_identity` is off. Fakes only: no Home Assistant, no device, no lab secrets."""
from __future__ import annotations

import json

import pytest
from fastapi.testclient import TestClient

from bridge_loader import load
from smplwise.auth import current_principal, current_principal_ro
from smplwise.db import Database, new_id, now_iso, permission_revision, set_setting
from smplwise.errors import ApiError
from smplwise.rbac import Principal
from smplwise.services import device_activity, ha_bridge, ha_client
from smplwise.services import service_identity as si

SID = "a" * 32  # the service identity: a regular HA user
HA_ADMIN = "c" * 32
LID = "l_01JABCDEFGHJKMNPQRSTVWXYZ0"
LID2 = "l_01JABCDEFGHJKMNPQRSTVWXYZ1"


def _local(user_id: str = LID, username: str = "maria") -> Principal:
    return Principal(user_id=user_id, username=username, display_name=username.title(), source="local", via="cookie")


def _seed(db: Database, *, local_on: bool = True, role: str | None = "operator", service: str | None = SID, bridge: str = "0.9.0", user_id: str = LID,
          active: int = 1, bridge_reports: str | None = SID) -> None:
    with db.connection() as conn:
        now = now_iso()
        conn.execute("INSERT OR IGNORE INTO users(id, username, display_name, source, active, first_seen_at, last_seen_at) VALUES (?, ?, ?, 'local', ?, ?, ?)",
                     (user_id, user_id[-6:].lower(), "Maria Local", active, now, now))
        if role:
            conn.execute("INSERT INTO bindings(id, subject_kind, subject_id, role_id, scope_type, scope_id, effect, permission_revision, assigned_by, created_at) "
                         "VALUES (?, 'user', ?, ?, 'installation', '*', 'allow', ?, 'test', ?)", (new_id(), user_id, role, permission_revision(conn), now))
        for uid, name, admin in ((SID, "SmplWise Arx Service", 0), (HA_ADMIN, "Owner", 1)):
            conn.execute("INSERT OR IGNORE INTO ha_users(id, name, username, is_active, is_admin, synced_at) VALUES (?, ?, ?, 1, ?, ?)", (uid, name, name.lower()[:8], admin, now))
        set_setting(conn, "security.local_identity", "on" if local_on else "off")
        if service is not None:
            set_setting(conn, si.SETTING, service)
        set_setting(conn, "bridge.integration_version", bridge)
        set_setting(conn, "bridge.paired_at", now)
        if bridge_reports is not None:
            set_setting(conn, si.BRIDGE_CAPABLE, "true")
            set_setting(conn, si.BRIDGE_SETTING, bridge_reports)


def _subject(db: Database, principal: Principal, feature="devices.control", service="execute", item=("light", "turn_on")):
    with db.connection() as conn:
        return si.subject(conn, principal, feature, bridge_service=service, item=item)


def _code(db: Database, principal: Principal, **kw) -> str:
    with pytest.raises(ApiError) as e:
        _subject(db, principal, **kw)
    return e.value.code


@pytest.fixture()
def db(settings):
    from smplwise.main import create_app

    app = create_app(settings)
    return app.state.db


# ---------------------------------------------------------------- 1. refusals of the add-on side

def test_switch_off_refuses_every_local_call_and_changes_nothing_for_ha_users(db):
    _seed(db, local_on=False)
    assert _code(db, _local()) == "local_identity_off"
    ha = Principal(user_id="u-ha", username="dana", display_name="Dana", source="remote", via="cookie")
    assert _subject(db, ha) == {"user_id": "u-ha"}
    with db.connection() as conn:
        set_setting(conn, "security.local_identity", "on")
    assert _subject(db, ha) == {"user_id": "u-ha"}  # the switch never changes a Home Assistant principal's message


@pytest.mark.parametrize("feature,service,item", [
    ("devices.control", "execute", ("lock", "unlock")),  # doors stay refused
    ("devices.control", "execute", ("alarm_control_panel", "alarm_disarm")),  # the alarm only through its own section
    ("alarm", "execute", ("switch", "turn_on")),  # a zone bypass is not arm / disarm
    ("alarm", "execute", ("alarm_control_panel", "alarm_trigger")),
    ("alarm", "execute", ("alarm_control_panel", "alarm_arm_custom_bypass")),  # review F1: arming with the bypass set is a zone bypass
    ("alarm", "execute", ("select", "select_option")),  # a select-type bypass control
    ("devices.control", "execute", ("script", "turn_on")),  # review F2: a script may unlock a door or disarm (owner Q5 open: refused)
    ("devices.control", "execute", ("scene", "turn_on")),
    ("media", "execute", ("script", "turn_on")),
    ("media", "execute", ("light", "turn_on")),
    ("automations", "config_item", "upsert"),
    ("devices.area", "set_entity_area", None),
    ("devices.control", "stream_source", None),
    ("cast", "cast_stream", "purge"),
    ("schedules", "schedule", ["add"]),  # an unhashable item
    ("system", "execute", ("homeassistant", "restart")),
])
def test_items_outside_the_allow_list_are_refused_and_audited(db, feature, service, item):
    _seed(db)
    assert _code(db, _local(), feature=feature, service=service, item=item) == "service_identity_refused"
    with db.connection(mode="read") as conn:
        rows = conn.execute("SELECT actor_user_id, decision, reason FROM audit_log WHERE action = 'identity.service_identity.refused'").fetchall()
    assert rows and rows[-1]["actor_user_id"] == LID and rows[-1]["decision"] == "denied"


@pytest.mark.parametrize("item", sorted(si.NEVER_LOCAL))
def test_never_local_items_are_refused_even_when_a_table_lists_them(db, monkeypatch, item):
    """Review F1 / F2: zone bypass, doors, scripts and scenes are refused by an explicit rule, not only by their absence from a table - a
    future table edit that lists one of them still cannot send it for a local identity."""
    _seed(db)
    for feature in ("devices.control", "alarm", "media"):
        widened = {k: dict(v) for k, v in si.FEATURES.items()}
        widened[feature]["execute"] = frozenset(widened[feature]["execute"]) | {item}
        monkeypatch.setattr(si, "FEATURES", widened)
        assert _code(db, _local(), feature=feature, item=item) == "service_identity_refused", (feature, item)
    with db.connection(mode="read") as conn:
        row = conn.execute("SELECT reason FROM audit_log WHERE action = 'identity.service_identity.refused' ORDER BY rowid DESC LIMIT 1").fetchone()
    assert row["reason"] == "never_local"
    assert {("alarm_control_panel", "alarm_arm_custom_bypass"), ("lock", "unlock"), ("script", "turn_on"), ("scene", "turn_on")} <= si.NEVER_LOCAL


def test_inactive_unknown_or_malformed_local_users_are_refused(db):
    _seed(db, active=0)
    assert _code(db, _local()) == "user_inactive"
    assert _code(db, _local(LID2)) == "user_inactive"  # no row at all
    assert _code(db, _local("l_short")) == "service_identity_refused"
    # an HA-shaped principal claiming source=local is still treated as local (fail closed) and refused: there is no such local row
    assert _code(db, Principal(user_id=SID, username="x", display_name="x", source="local")) == "service_identity_refused"


def test_service_identity_missing_admin_or_bridge_too_old(db):
    _seed(db, service=None)
    assert _code(db, _local()) == "service_identity_unconfigured"
    with db.connection() as conn:
        set_setting(conn, si.SETTING, "not-hex")
    assert _code(db, _local()) == "service_identity_unconfigured"
    with db.connection() as conn:
        set_setting(conn, si.SETTING, "d" * 32)  # not in the directory
    assert _code(db, _local()) == "service_identity_unconfigured"
    with db.connection() as conn:
        set_setting(conn, si.SETTING, HA_ADMIN)  # written behind the configure route's back: still refused at use
    assert _code(db, _local()) == "service_identity_admin"
    with db.connection() as conn:
        set_setting(conn, si.SETTING, SID)
        conn.execute("INSERT INTO bindings(id, subject_kind, subject_id, role_id, scope_type, scope_id, effect, permission_revision, assigned_by, created_at) "
                     "VALUES (?, 'user', ?, 'system_admin', 'installation', '*', 'allow', ?, 'test', ?)", (new_id(), SID, permission_revision(conn), now_iso()))
    assert _code(db, _local()) == "service_identity_admin"  # an Arx system administrator is an administrator too
    with db.connection() as conn:
        conn.execute("DELETE FROM bindings WHERE subject_id = ?", (SID,))
        set_setting(conn, "bridge.integration_version", "0.8.0")
    assert _code(db, _local()) == "service_identity_bridge_outdated"


def test_allowed_items_carry_the_service_identity_and_the_authenticated_person(db):
    _seed(db)
    for feature, service, item in (("devices.control", "execute", ("light", "turn_on")), ("alarm", "execute", ("alarm_control_panel", "alarm_disarm")),
                                   ("media", "execute", ("media_player", "volume_set")), ("media", "media_query", "queue"),
                                   ("cast", "cast_stream", "play"), ("schedules", "schedule", "edit")):
        assert _subject(db, _local(), feature=feature, service=service, item=item) == {
            "user_id": SID, "on_behalf_of": {"kind": "local", "user_id": LID, "feature": feature}}


def test_the_payload_guard_never_lets_a_local_id_or_a_bad_block_leave():
    for payload in ({"user_id": LID}, {"user_id": SID, "on_behalf_of": {"kind": "local", "user_id": SID, "feature": "x"}},
                    {"user_id": SID, "on_behalf_of": {"kind": "ha", "user_id": LID, "feature": "x"}}, {"user_id": SID, "on_behalf_of": "local"},
                    {"user_id": LID, "on_behalf_of": {"kind": "local", "user_id": LID, "feature": "x"}}):
        with pytest.raises(ApiError) as e:
            si.guard_payload(payload)
        assert e.value.code == "service_identity_refused"
    si.guard_payload({"user_id": "u-ha"})
    si.guard_payload({"user_id": SID, "on_behalf_of": {"kind": "local", "user_id": LID, "feature": "media"}})


def test_every_bridge_transport_runs_the_guard_before_sending(settings, monkeypatch):
    import dataclasses

    s = dataclasses.replace(settings, ha_url="http://ha.local:8123", ha_token="t")
    sent = []
    monkeypatch.setattr(ha_client, "_bridge_client", lambda _s: (_ for _ in ()).throw(AssertionError("sent")))
    import httpx

    monkeypatch.setattr(httpx, "Client", lambda *a, **k: sent.append(1) or (_ for _ in ()).throw(AssertionError("sent")))
    for fn in (ha_client.call_bridge_execute, ha_client.call_bridge_set_area, ha_client.call_bridge_schedule, ha_client.call_bridge_config_item,
               ha_client.call_bridge_cast_stream, ha_client.call_bridge_stream_source):
        with pytest.raises(ApiError) as e:
            fn(s, {"user_id": LID, "domain": "light", "service": "turn_on", "data": {"entity_id": "light.x"}})
        assert e.value.code == "service_identity_refused", fn.__name__
    from smplwise.services import media_query

    with pytest.raises(ApiError):
        media_query.call_bridge_media_query(s, {"user_id": LID, "query": "queue"})
    assert sent == []


def test_tables_match_the_bridge_exactly():
    bridge = load("service_identity")
    assert {k: {s: frozenset(v) for s, v in d.items()} for k, d in si.FEATURES.items()} == \
           {k: {s: frozenset(v) for s, v in d.items()} for k, d in bridge.SERVICE_FEATURES.items()}
    assert si.DEVICE_PAIRS <= {(a["domain"], a["service"]) for a in ha_bridge.ACTIONS.values()} | si.DEVICE_PAIRS
    assert ("lock", "unlock") not in si.DEVICE_PAIRS and si.LOCAL_ID_RE.pattern == bridge.LOCAL_ID_RE.pattern
    # review F1 / F2: zone-bypass arming, scripts and scenes are in no feature on either side, and the explicit never-list is the same
    assert si.NEVER_LOCAL == bridge.NEVER_LOCAL
    for k, d in si.FEATURES.items():
        for items in d.values():
            assert not (frozenset(items) & si.NEVER_LOCAL), k
    as_t = lambda v: tuple(int(x) for x in v.split("."))  # noqa: E731
    assert as_t(load("const").VERSION) >= as_t(si.BRIDGE_SERVICE_IDENTITY_REQUIRED) == (0, 9, 0)  # the bridge in this repo carries the screen


# ---------------------------------------------------------------- 2. configuration, the bridge's copy and the self-check

def test_configure_refuses_administrators_and_strangers_and_the_route_is_local_only(lx_app):
    lx = lx_app
    _seed(lx.db, service=None, bridge_reports=None)
    remote = lx.remote()
    assert remote.get("/arx/api/v1/identity/service-identity").status_code == 404
    assert remote.put("/arx/api/v1/identity/service-identity", json={"user_id": SID}).status_code == 404
    st = lx.admin.get("/api/v1/identity/service-identity").json()
    assert st["ready"] is False and st["configured_user_id"] is None and any(s["code"] == "not_configured" for s in st["steps"])
    assert all(s["he"] and s["en"] for s in st["steps"])
    for bad, code in ((HA_ADMIN, "service_identity_admin"), ("d" * 32, "validation"), ("XYZ", "validation"), (LID, "validation")):
        r = lx.admin.put("/api/v1/identity/service-identity", json={"user_id": bad})
        assert r.json()["code"] == code, bad
    assert lx.admin.put("/api/v1/identity/service-identity", json={"user_id": SID, "extra": 1}).status_code == 422
    viewer = TestClient(lx.app, headers={"X-SW-Dev-User": "vera"})
    assert viewer.get("/api/v1/identity/service-identity").status_code == 403
    r = lx.admin.put("/api/v1/identity/service-identity", json={"user_id": SID.upper()})
    assert r.status_code == 200 and r.json()["configured_user_id"] == SID
    steps = {s["code"] for s in r.json()["steps"]}
    assert "bridge_not_set" in steps and r.json()["ready"] is False  # the bridge's own copy has not arrived yet
    rows = lx.rows("SELECT decision, reason FROM audit_log WHERE action = 'identity.service_identity.configured' ORDER BY at")
    assert [r["decision"] for r in rows].count("denied") == 4 and rows[-1]["decision"] == "allowed"


def test_the_bridge_copy_arrives_with_the_directory_push_and_mismatch_is_explained(lx_app):
    lx = lx_app
    secret = lx.admin.get("/api/v1/ha/bridge/pairing").json()["pairing_code"]
    assert lx.admin.post("/api/v1/ha/bridge/ping", json=ha_bridge.sign(secret, {"version": "0.9.0"})).status_code == 200
    push = [{"id": SID, "name": "SmplWise Arx Service", "username": "arxsvc", "is_active": True, "is_admin": False}]
    assert lx.admin.post("/api/v1/ha/bridge/directory", json=ha_bridge.sign(secret, {"users": push, "version": "0.9.0", "service_identity": True,
                                                                                     "service_user_id": "e" * 32})).status_code == 200
    assert lx.admin.put("/api/v1/identity/service-identity", json={"user_id": SID}).status_code == 200
    st = lx.admin.get("/api/v1/identity/service-identity").json()
    assert st["bridge"]["reported_user_id"] == "e" * 32 and st["bridge"]["agrees"] is False and "mismatch" in {s["code"] for s in st["steps"]} and not st["ready"]
    assert lx.admin.post("/api/v1/ha/bridge/directory", json=ha_bridge.sign(secret, {"users": push, "version": "0.9.0", "service_identity": True,
                                                                                     "service_user_id": SID})).status_code == 200
    lx.enable()
    st = lx.admin.get("/api/v1/identity/service-identity").json()
    assert st["ready"] is True and st["bridge"]["agrees"] is True and st["steps"] == [] and st["user"]["is_admin"] is False
    assert {a["key"] for a in st["allowed"]} == set(si.FEATURES)


# ---------------------------------------------------------------- 3. through the app: a local user's real session

@pytest.fixture()
def lx_app(settings, tmp_path, monkeypatch):
    from test_local_identity import Lx
    from smplwise.services import ha_sync
    from smplwise.services import ha_user_auth as hua

    states = [{"entity_id": "light.lobby", "state": "off", "attributes": {"friendly_name": "Lobby light", "supported_features": 44},
               "last_changed": "2026-09-15T10:00:00+00:00", "last_updated": "2026-09-15T10:00:00+00:00"},
              {"entity_id": "lock.front", "state": "locked", "attributes": {"friendly_name": "Front door"},
               "last_changed": "2026-09-15T10:00:00+00:00", "last_updated": "2026-09-15T10:00:00+00:00"},
              {"entity_id": "script.open_front", "state": "off", "attributes": {"friendly_name": "Open the front door"},
               "last_changed": "2026-09-15T10:00:00+00:00", "last_updated": "2026-09-15T10:00:00+00:00"},
              {"entity_id": "scene.evening", "state": "unknown", "attributes": {"friendly_name": "Evening"},
               "last_changed": "2026-09-15T10:00:00+00:00", "last_updated": "2026-09-15T10:00:00+00:00"}]
    monkeypatch.setattr(ha_client, "get_states", lambda _s: states)
    lx = Lx(settings, tmp_path, monkeypatch, ha_url="http://ha.local:8123", ha_token="t")
    ha_sync.STATE.connected = True
    ha_sync.snapshot(lx.app.state.db, lx.settings)
    yield lx
    hua.reset_for_tests()


def _bridge(lx, monkeypatch, version="0.9.0", answer=None):
    secret = lx.admin.get("/api/v1/ha/bridge/pairing").json()["pairing_code"]
    assert lx.admin.post("/api/v1/ha/bridge/ping", json=ha_bridge.sign(secret, {"version": version})).status_code == 200
    calls: list[dict] = []

    def fake_execute(_settings, payload, timeout=15.0):
        ha_bridge.verify(secret, payload)
        calls.append(payload)
        return dict(answer or {"ok": True, "context_id": "ctx-local-1"})

    monkeypatch.setattr(ha_client, "call_bridge_execute", fake_execute)
    return secret, calls


def _action(client, entity="light.lobby", action="light.turn_on", crid="c-1", **extra):
    body = {"allowed_action_id": action, "arguments": {}, "expected_state_version": None, "confirmation_grant": None, "client_request_id": crid,
            "expires_at": "2099-01-01T00:00:00Z", **extra}
    return client.post(f"/arx/api/v1/ha/entities/{entity}/actions", json=body)


def test_local_user_controls_a_light_through_the_service_identity(lx_app, monkeypatch):
    lx = lx_app
    secret, calls = _bridge(lx, monkeypatch)
    lx.enable()
    created, c = lx.ready("maria", "operator")
    uid = created["user"]["id"]
    # unconfigured: refused, nothing sent, audited
    r = _action(c)
    assert r.status_code == 503 and r.json()["code"] == "service_identity_unconfigured" and calls == []
    with lx.db.connection() as conn:
        conn.execute("INSERT INTO ha_users(id, name, username, is_active, is_admin, synced_at) VALUES (?, 'SmplWise Arx Service', 'arxsvc', 1, 0, ?)", (SID, now_iso()))
        set_setting(conn, si.SETTING, SID)
    r = _action(c, crid="c-2")
    assert r.status_code == 202, r.text
    sent = calls[-1]
    assert sent["user_id"] == SID and sent["on_behalf_of"] == {"kind": "local", "user_id": uid, "feature": "devices.control"}
    # the record and the audit name the person, never the service identity
    rows = lx.rows("SELECT principal_user_id, context_id FROM ha_actions ORDER BY requested_at DESC LIMIT 1")
    assert rows[0]["principal_user_id"] == uid and rows[0]["context_id"] == "ctx-local-1"
    attempt = [a for a in lx.rows("SELECT actor_user_id, details_json FROM audit_log WHERE action = 'ha.action'") if json.loads(a["details_json"]).get("phase") == "attempt"]
    assert attempt[-1]["actor_user_id"] == uid and json.loads(attempt[-1]["details_json"])["service_identity"] is True
    # a door is refused (lock.unlock is in no feature), nothing sent
    n = len(calls)
    r = _action(c, entity="lock.front", action="lock.unlock", crid="c-3", confirmation_grant="confirmed")
    assert r.status_code in (403, 409) and len(calls) == n
    # a forged attribution in the body is not accepted (the action body forbids unknown keys) - and the person is always the session's
    r = _action(c, crid="c-4", on_behalf_of={"kind": "local", "user_id": LID2, "feature": "devices.control"})
    assert r.status_code == 422 and len(calls) == n
    # the switch off ends the session: nothing more can be sent for the person
    lx.enable(False)
    assert _action(c, crid="c-5").status_code == 401 and len(calls) == n


def test_local_user_cannot_run_a_script_or_a_scene_through_device_control(lx_app, monkeypatch):
    """Review F2: a script or scene in the person's scope could unlock a door or disarm under the service identity - refused (owner Q5 open),
    nothing sent, audited as a service-identity refusal (not an RBAC one: the role may control the entity)."""
    lx = lx_app
    secret, calls = _bridge(lx, monkeypatch)
    lx.enable()
    created, c = lx.ready("maria", "site_admin")
    uid = created["user"]["id"]
    with lx.db.connection() as conn:
        conn.execute("INSERT INTO ha_users(id, name, username, is_active, is_admin, synced_at) VALUES (?, 'SmplWise Arx Service', 'arxsvc', 1, 0, ?)", (SID, now_iso()))
        set_setting(conn, si.SETTING, SID)
    for i, (entity, action) in enumerate((("script.open_front", "script.turn_on"), ("scene.evening", "scene.turn_on"))):
        r = _action(c, entity=entity, action=action, crid=f"s-{i}", confirmation_grant="confirmed")
        assert r.status_code == 403 and r.json()["code"] == "service_identity_refused", r.text
    assert calls == []
    rows = lx.rows("SELECT details_json FROM audit_log WHERE action = 'identity.service_identity.refused' AND actor_user_id = ?", (uid,))
    items = [json.loads(r["details_json"])["item"] for r in rows]
    assert ["script", "turn_on"] in items and ["scene", "turn_on"] in items
    assert _action(c, crid="s-light").status_code == 202 and len(calls) == 1  # a light still works


def test_ha_user_message_is_unchanged_with_the_feature_on(lx_app, monkeypatch):
    lx = lx_app
    secret, calls = _bridge(lx, monkeypatch)
    lx.enable()
    _seed(lx.db)
    lx.flag("u-viewer")
    lx.bind("u-viewer", "operator")
    assert lx.login(lx.viewer).status_code == 200
    r = _action(lx.client, crid="ha-1")
    assert r.status_code == 202, r.text
    assert calls[-1]["user_id"] == "u-viewer" and "on_behalf_of" not in calls[-1]


def test_activity_rows_name_the_person_never_the_service(lx_app):
    lx = lx_app
    _seed(lx.db)
    with lx.db.connection() as conn:
        # an Arx request of a local person is in flight (no context id yet): the change is that person's, inferred - never "the service"
        conn.execute("INSERT INTO ha_actions(id, entity_id, action_id, arguments_json, principal_user_id, principal_username, client_request_id, status, requested_at, via) "
                     "VALUES ('a0', 'light.lobby', 'light.turn_on', '{}', ?, 'maria', 'x0', 'pending', ?, 'bridge')", (LID, now_iso()))
        who = device_activity.attribute(conn, "state", {"id": "ctx-race", "parent_id": None, "user_id": SID})
        assert who["actor_type"] == "person" and who["actor_ref"] is None and who["actor_name"] is None and who["via"] == "arx" and who["confidence"] == "inferred"
        conn.execute("DELETE FROM ha_actions WHERE id = 'a0'")
        conn.execute("INSERT INTO ha_actions(id, entity_id, action_id, arguments_json, principal_user_id, principal_username, client_request_id, status, requested_at, via, context_id) "
                     "VALUES ('a1', 'light.lobby', 'light.turn_on', '{}', ?, 'maria', 'x', 'pending', ?, 'bridge', 'ctx-ok')", (LID, now_iso()))
        who = device_activity.attribute(conn, "state", {"id": "ctx-ok", "parent_id": None, "user_id": SID})
        assert who["actor_ref"] == LID and who["actor_name"] == "Maria Local" and who["via"] == "arx" and who["confidence"] == "exact"
        other = device_activity.attribute(conn, "state", {"id": "ctx-ha", "parent_id": None, "user_id": HA_ADMIN})
        assert other["actor_ref"] == HA_ADMIN and other["actor_name"] == "Owner" and other["via"] == "ha"


# ---------------------------------------------------------------- 4. alarm (owner answer Q4): the PIN rules hold for a local user

def test_local_user_arms_and_disarms_under_the_pin_rules_but_never_bypasses(alarm_app):
    from test_alarm import CODE, _act, _bypass, _no_code, _set_code

    app, s, c, calls, _ = alarm_app
    _set_code(c)
    db = app.state.db
    _seed(db, role="site_admin")  # alarm.arm + alarm.disarm + alarm.bypass by role
    with db.connection() as conn:
        conn.execute("UPDATE settings SET value = '0.9.0' WHERE key = 'bridge.integration_version'")
    local = _local()
    app.dependency_overrides[current_principal] = lambda: local
    app.dependency_overrides[current_principal_ro] = lambda: local
    try:
        # personal PIN rules apply exactly as on the remote channel: codeless remote disarm off -> a PIN is asked, nothing sent
        app.dependency_overrides.pop(current_principal), app.dependency_overrides.pop(current_principal_ro)
        assert c.patch("/api/v1/settings", json={"alarm.remote_codeless": "false"}).status_code == 200
        app.dependency_overrides[current_principal] = lambda: local
        app.dependency_overrides[current_principal_ro] = lambda: local
        n = len(calls)
        r = _act(c, "alarm_control_panel.risco_house", "disarm", confirmed=True)
        assert r.status_code == 409 and r.json()["details"]["prompt"] in ("pin", "pin_missing") and len(calls) == n
        # an administrator sets the person's policy to no_code and codeless remote back on: arm and disarm through the service identity
        app.dependency_overrides.clear()
        _no_code(c, LID)
        assert c.patch("/api/v1/settings", json={"alarm.remote_codeless": "true"}).status_code == 200
        app.dependency_overrides[current_principal] = lambda: local
        app.dependency_overrides[current_principal_ro] = lambda: local
        r = _act(c, "alarm_control_panel.risco_house", "disarm", confirmed=True)
        assert r.status_code == 202, r.text
        assert calls[-1]["user_id"] == SID and calls[-1]["on_behalf_of"] == {"kind": "local", "user_id": LID, "feature": "alarm"}
        assert calls[-1]["data"]["code"] == CODE  # the stored panel code, exactly as for a no_code HA user
        assert _act(c, "alarm_control_panel.risco_house", "arm_away").status_code == 202 and calls[-1]["service"] == "alarm_arm_away"
        # a zone bypass is not in the `alarm` feature: refused, nothing sent
        n = len(calls)
        r = _bypass(c, "binary_sensor.kitchen_window", True, confirmed=True)
        assert r.status_code == 403 and r.json()["code"] == "service_identity_refused" and len(calls) == n
        # the remote rules still apply to a local user
        app.dependency_overrides.clear()
        assert c.patch("/api/v1/settings", json={"alarm.remote_disarm": "false"}).status_code == 200
        app.dependency_overrides[current_principal] = lambda: local
        app.dependency_overrides[current_principal_ro] = lambda: local
        assert _act(c, "alarm_control_panel.risco_house", "disarm", confirmed=True).json()["code"] == "remote_disarm_disabled" and len(calls) == n
        with db.connection(mode="read") as conn:
            row = conn.execute("SELECT actor_user_id, details_json FROM audit_log WHERE action = 'alarm.arm' AND decision = 'allowed' ORDER BY rowid DESC LIMIT 1").fetchone()
        assert row["actor_user_id"] == LID and json.loads(row["details_json"])["service_identity"] is True
    finally:
        app.dependency_overrides.clear()


def test_local_user_never_bypasses_a_zone_nor_arms_with_the_bypass_set(alarm_app, monkeypatch):
    """Review F1: a local user holding alarm.arm AND alarm.bypass is refused both the zone-bypass route (switch or select control, on and
    off) and `arm_custom_bypass` - by an explicit rule: widening the `alarm` table to the bypass controls changes nothing."""
    from smplwise.services import ha_sync as hs
    from test_alarm import _act, _bypass, _no_code

    app, s, c, calls, _ = alarm_app
    db = app.state.db
    _seed(db, role="site_admin")  # alarm.arm + alarm.disarm + alarm.bypass
    with db.connection() as conn:
        conn.execute("UPDATE settings SET value = '0.9.0' WHERE key = 'bridge.integration_version'")
        now = now_iso()
        hs.upsert_state(conn, {"entity_id": "alarm_control_panel.risco_house", "state": "disarmed", "last_changed": now, "last_updated": now,
                               "attributes": {"friendly_name": "x", "code_format": "number", "code_arm_required": False, "supported_features": 1 | 2 | 4 | 16}})
    _no_code(c, LID)
    widened = {k: dict(v) for k, v in si.FEATURES.items()}
    widened["alarm"]["execute"] = frozenset(widened["alarm"]["execute"]) | {("switch", "turn_on"), ("switch", "turn_off"), ("select", "select_option")}
    monkeypatch.setattr(si, "FEATURES", widened)
    local = _local()
    app.dependency_overrides[current_principal] = lambda: local
    app.dependency_overrides[current_principal_ro] = lambda: local
    try:
        n = len(calls)
        r = _act(c, "alarm_control_panel.risco_house", "arm_custom_bypass")
        assert r.status_code == 403 and r.json()["code"] == "service_identity_refused", r.text
        for on in (True, False):
            r = _bypass(c, "binary_sensor.kitchen_window", on, confirmed=True)
            assert r.status_code == 403 and r.json()["code"] == "service_identity_refused", r.text
        assert len(calls) == n  # nothing reached the bridge
        assert _act(c, "alarm_control_panel.risco_house", "arm_away").status_code == 202  # plain arming still works
        with db.connection(mode="read") as conn:
            reasons = [r["reason"] for r in conn.execute("SELECT reason FROM audit_log WHERE action = 'identity.service_identity.refused' AND actor_user_id = ?", (LID,))]
        assert reasons.count("zone_bypass") == 2 and "never_local" in reasons
    finally:
        app.dependency_overrides.clear()


def test_operator_role_cannot_disarm_even_through_the_service_identity(alarm_app):
    from test_alarm import _act

    app, s, c, calls, _ = alarm_app
    _seed(app.state.db, role="operator")  # operator: alarm.arm only
    with app.state.db.connection() as conn:
        conn.execute("UPDATE settings SET value = '0.9.0' WHERE key = 'bridge.integration_version'")
    local = _local()
    app.dependency_overrides[current_principal] = lambda: local
    app.dependency_overrides[current_principal_ro] = lambda: local
    try:
        n = len(calls)
        assert _act(c, "alarm_control_panel.risco_house", "disarm", confirmed=True).status_code == 403 and len(calls) == n
    finally:
        app.dependency_overrides.clear()


# ---------------------------------------------------------------- 5. automations: never; reads stay

def test_automation_writes_and_runs_are_refused_to_a_local_user(autos_app):
    from automations_fixture import API, create_item, draft_of

    app, s, c, fake, tr = autos_app
    _seed(app.state.db, role="site_admin")
    local = _local()
    app.dependency_overrides[current_principal] = lambda: local
    app.dependency_overrides[current_principal_ro] = lambda: local
    try:
        n = len(tr.bridge_calls)
        r = create_item(c, "automation", draft_of("x"))
        assert r.status_code == 403 and r.json()["code"] == "automation_write_requires_ha_identity"
        assert len(tr.bridge_calls) == n
        assert c.get(f"{API}/automations").status_code == 200  # reads stay available
        with app.state.db.connection(mode="read") as conn:
            row = conn.execute("SELECT actor_user_id, reason FROM audit_log WHERE action = 'identity.service_identity.refused' ORDER BY rowid DESC LIMIT 1").fetchone()
        assert row["actor_user_id"] == LID and row["reason"] == "automation_write_requires_ha_identity"
    finally:
        app.dependency_overrides.clear()


# ---------------------------------------------------------------- 6. schedules: through the service identity

def test_local_user_schedule_create_goes_through_the_service_identity(sched_app):
    from schedules_fixture import draft_of, rid

    API = "/api/v1"

    app, s, c, fake, tr = sched_app
    _seed(app.state.db, role="site_admin", service=None)
    local = _local()
    app.dependency_overrides[current_principal] = lambda: local
    app.dependency_overrides[current_principal_ro] = lambda: local
    try:
        n = len(fake.bridge_calls)
        body = {"draft": draft_of("Local evening"), "enabled": True, "client_request_id": rid(), "confirm_lowering": False}
        r = c.post(f"{API}/schedules", json=body)
        assert r.status_code == 503 and r.json()["code"] == "service_identity_unconfigured" and len(fake.bridge_calls) == n
        with app.state.db.connection() as conn:
            set_setting(conn, si.SETTING, SID)
        r = c.post(f"{API}/schedules", json={**body, "client_request_id": rid()})
        assert r.status_code == 201, r.text
        call = fake.bridge_calls[-1]
        assert call["user_id"] == SID and call["on_behalf_of"] == {"kind": "local", "user_id": LID, "feature": "schedules"}
    finally:
        app.dependency_overrides.clear()


# ---------------------------------------------------------------- 7. review F3: a cast session never outlives its local owner

def _cast_row(owner: str, *, power_off_after: bool = True) -> dict:
    return {"session_id": "cs-1", "restore_json": json.dumps({"power_off_after": power_off_after}), "device_key": "dk-tv", "camera_id": "cam-1",
            "kind": "live", "target_entity_id": "media_player.tv", "started_by": owner, "started_by_name": "Maria Local", "stopped_at": None}


def _cast_bridge(monkeypatch) -> list[dict]:
    sent: list[dict] = []

    def fake(_settings, payload, timeout=10.0):
        sent.append(payload)
        return {"ok": True}

    monkeypatch.setattr(ha_client, "call_bridge_cast_stream", fake)
    return sent


@pytest.mark.parametrize("gone", ["disabled", "deleted"])
def test_cast_stop_and_power_off_still_go_out_after_the_local_owner_is_disabled(db, settings, monkeypatch, gone):
    from smplwise.services import cast_sessions

    _seed(db)
    sent = _cast_bridge(monkeypatch)
    with db.connection() as conn:
        conn.execute("UPDATE users SET active = 0" + (", deleted_at = ?" if gone == "deleted" else "") + " WHERE id = ?",
                     ((now_iso(), LID) if gone == "deleted" else (LID,)))
        out = cast_sessions._end(conn, _cast_row(LID), "timeout", None, None, send=True, settings=settings)
    assert out["stop"] == "sent" and out["power_off"] == "sent", out
    assert [p["op"] for p in sent] == ["stop", "off"]
    for p in sent:  # the service identity, attributed to the (former) owner - a cleanup, never a play
        assert p["user_id"] == SID and p["on_behalf_of"] == {"kind": "local", "user_id": LID, "feature": "cast"}
    with db.connection(mode="read") as conn:
        rows = conn.execute("SELECT details_json FROM audit_log WHERE action = 'identity.service_identity.cleanup'").fetchall()
    assert [json.loads(r["details_json"])["sent_as"] for r in rows] == ["service_for_owner", "service_for_owner"]


def test_cast_stop_of_a_disabled_local_owner_goes_out_as_the_acting_ha_administrator(db, settings, monkeypatch):
    from smplwise.services import cast_sessions

    _seed(db)
    sent = _cast_bridge(monkeypatch)
    admin = Principal(user_id=HA_ADMIN, username="owner", display_name="Owner", source="ingress")
    with db.connection() as conn:
        conn.execute("UPDATE users SET active = 0 WHERE id = ?", (LID,))
        out = cast_sessions._end(conn, _cast_row(LID, power_off_after=False), "admin", admin, None, send=True, settings=settings)
    assert out["stop"] == "sent" and sent[-1]["user_id"] == HA_ADMIN and "on_behalf_of" not in sent[-1]


def test_a_disabled_local_owner_can_never_play_and_cleanup_is_stop_or_off_only(db, settings, monkeypatch):
    from smplwise.services import cast_sessions

    _seed(db)
    sent = _cast_bridge(monkeypatch)
    with db.connection() as conn:
        conn.execute("UPDATE users SET active = 0 WHERE id = ?", (LID,))
        with pytest.raises(ApiError) as e:
            cast_sessions._bridge(conn, settings, LID, "play", "media_player.tv", url="https://x/y")
        assert e.value.code == "user_inactive"
        with pytest.raises(ApiError) as e:
            si.subject_for_cleanup(conn, LID, "cast", bridge_service="cast_stream", item="play", actor=None)
        assert e.value.code == "service_identity_refused"
        set_setting(conn, "security.local_identity", "off")
        with pytest.raises(ApiError) as e:  # the switch off: no service-identity message at all, not even a stop
            si.subject_for_cleanup(conn, LID, "cast", bridge_service="cast_stream", item="stop", actor=None)
        assert e.value.code == "local_identity_off"
    assert sent == []


def test_janitor_ends_the_open_cast_of_a_disabled_local_owner(db, settings, monkeypatch):
    from smplwise.services import cast_sessions

    _seed(db)
    sent = _cast_bridge(monkeypatch)
    with db.connection() as conn:
        assert cast_sessions.owner_gone(conn, LID) is False
        conn.execute("UPDATE users SET active = 0 WHERE id = ?", (LID,))
        assert cast_sessions.owner_gone(conn, LID) is True
        assert cast_sessions.owner_gone(conn, "u-ha") is False  # a Home Assistant owner is never judged here
    assert sent == []


# ---------------------------------------------------------------- 8. review F4: the service user is never a person

def test_signing_in_as_the_service_user_is_refused_and_flagged(settings, tmp_path):
    import dataclasses

    from smplwise.main import create_app

    s = dataclasses.replace(settings, dev_user=None, trusted_proxies=("testclient",), data_dir=tmp_path / "svc")
    app = create_app(s)
    _seed(app.state.db)
    c = TestClient(app)
    r = c.get("/api/v1/me", headers={"X-Remote-User-Id": SID, "X-Remote-User-Name": "arxsvc"})
    assert r.status_code == 403 and r.json()["code"] == "service_account", r.text
    with app.state.db.connection(mode="read") as conn:
        row = conn.execute("SELECT actor_user_id, decision FROM audit_log WHERE action = 'identity.service_identity.signin_refused'").fetchone()
        assert row["actor_user_id"] == SID and row["decision"] == "denied"
        assert conn.execute("SELECT 1 FROM users WHERE id = ?", (SID,)).fetchone() is None  # no user row for it is created
    assert c.get("/api/v1/me", headers={"X-Remote-User-Id": "b" * 32, "X-Remote-User-Name": "dana"}).status_code == 200
    # a sign-in recorded before the identity was configured is flagged on the self-check
    with app.state.db.connection() as conn:
        conn.execute("INSERT INTO users(id, username, display_name, source, active, first_seen_at, last_seen_at) VALUES (?, 'arxsvc', 'svc', 'ingress', 1, ?, ?)",
                     (SID, now_iso(), now_iso()))
        st = si.status(conn)
    assert "service_signed_in" in {x["code"] for x in st["steps"]}


def test_the_service_user_cannot_be_given_an_arx_role(settings):
    from smplwise.main import create_app

    app = create_app(settings)
    _seed(app.state.db)
    c = TestClient(app)
    body = {"subject_kind": "user", "subject_id": SID, "role_id": "viewer", "scope_type": "installation", "scope_id": "*"}
    r = c.post("/api/v1/access/bindings", json=body)
    assert r.status_code == 422 and r.json()["code"] == "service_account", r.text
    assert c.post("/api/v1/access/bindings", json={**body, "subject_id": HA_ADMIN}).status_code == 201


def test_activity_under_the_service_context_is_the_service_unless_an_arx_request_is_pending(lx_app):
    lx = lx_app
    _seed(lx.db)
    with lx.db.connection() as conn:
        who = device_activity.attribute(conn, "state", {"id": "ctx-direct", "parent_id": None, "user_id": SID})
        # nobody in Arx asked: the service user acting in Home Assistant directly - never "an Arx person"
        assert who["actor_type"] == "system" and who["actor_ref"] == SID and who["actor_name"] == "SmplWise Arx Service" and who["via"] == "ha"


from test_alarm import _fresh_limits, alarm_app  # noqa: E402,F401  (fixtures)
from automations_fixture import autos_app  # noqa: E402,F401
from schedules_fixture import sched_app  # noqa: E402,F401
