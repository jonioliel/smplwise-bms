"""SVCIDENT2 (owner decisions 2026-10-17, CR-USR2 section 11): the EXTENDED mode of the service identity - negative cases first.

One new switch, `security.local_identity_extended`, OFF by default. With it off everything is exactly as in 2.6.4: doors, alarm zone bypass
(and arming with the bypass set), scripts / scenes from device control and the camera stream source are refused to an Arx-only (local) user.
With it on (AND the bridge's own options-flow copy on, bridge >= 0.9.1) each of those works - but only under the user's OWN Arx permission;
the area write (`devices.area`) is refused in both modes; every other refusal (automations, administrators, the service user as a person)
stays. Fakes only: no Home Assistant, no device, no lab secrets."""
from __future__ import annotations

import asyncio
import json
from types import SimpleNamespace

import pytest

from bridge_loader import load
from smplwise.auth import current_principal, current_principal_ro
from smplwise.db import bump_permission_revision, get_setting, new_id, now_iso, permission_revision, set_setting
from smplwise.errors import ApiError
from smplwise.rbac import Principal
from smplwise.services import backup, door_authority
from smplwise.services import service_identity as si
from test_service_identity import HA_ADMIN, LID, SID, _action, _bridge, _code, _local, _seed, _subject, db, lx_app  # noqa: F401 (fixtures)

EXT_ITEMS = [  # (feature, bridge service, item) admitted only by the extended mode
    ("devices.control", "execute", ("lock", "unlock")),  # owner decision 1: doors
    ("devices.control", "execute", ("script", "turn_on")),  # 5: scripts / scenes
    ("devices.control", "execute", ("scene", "turn_on")),
    ("alarm", "execute", ("alarm_control_panel", "alarm_arm_custom_bypass")),  # 2: zone bypass
    ("alarm.bypass", "execute", ("switch", "turn_on")),
    ("alarm.bypass", "execute", ("select", "select_option")),
    ("cameras.live", "stream_source", "read"),  # 3: the camera stream source
]


def _ext(db, *, on: bool = True, bridge_on: bool = True, version: str = "0.9.1") -> None:
    with db.connection() as conn:
        set_setting(conn, si.EXTENDED_SETTING, "on" if on else "off")
        set_setting(conn, si.BRIDGE_EXTENDED, "true" if bridge_on else "false")
        set_setting(conn, "bridge.integration_version", version)


def _audit(db, action: str) -> list[dict]:
    with db.connection(mode="read") as conn:
        return [dict(r) for r in conn.execute("SELECT actor_user_id, decision, reason, details_json FROM audit_log WHERE action = ? ORDER BY rowid", (action,))]


# ---------------------------------------------------------------- 1. switch off: exactly the 2.6.4 refusals

@pytest.mark.parametrize("feature,service,item", EXT_ITEMS)
def test_switch_off_refuses_each_extended_item_exactly_as_before(db, feature, service, item):
    _seed(db)
    _ext(db, on=False, bridge_on=True)  # the bridge's copy alone changes nothing
    assert _code(db, _local(), feature=feature, service=service, item=item) == "service_identity_refused"
    expected = "never_local" if item in si.NEVER_LOCAL else "service_identity_refused"
    assert _audit(db, "identity.service_identity.refused")[-1]["reason"] == expected
    assert _audit(db, "identity.service_identity.extended") == []
    assert si.never_list(False) == si.NEVER_LOCAL and si.features(False) is si.FEATURES


def test_switch_on_without_local_identities_is_still_off(db):
    _seed(db, local_on=False)
    _ext(db)
    assert _code(db, _local(), feature="devices.control", item=("lock", "unlock")) == "local_identity_off"
    with db.connection(mode="read") as conn:
        assert si.extended_requested(conn) is True and si.extended_on(conn) is False


@pytest.mark.parametrize("feature,service,item", EXT_ITEMS)
def test_switch_on_needs_the_bridge_copy_and_a_091_bridge(db, feature, service, item):
    _seed(db)
    _ext(db, bridge_on=False)
    assert _code(db, _local(), feature=feature, service=service, item=item) == "service_identity_extended_bridge_off"
    _ext(db, bridge_on=True, version="0.9.0")
    assert _code(db, _local(), feature=feature, service=service, item=item) == "service_identity_extended_bridge_off"
    # an item the 2.6.4 tables already allow does not depend on the bridge's copy
    assert _subject(db, _local())["on_behalf_of"]["feature"] == "devices.control"


# ---------------------------------------------------------------- 2. switch on: each item, as the service identity, audited with ids only

@pytest.mark.parametrize("feature,service,item", EXT_ITEMS)
def test_switch_on_admits_each_extended_item_through_the_service_identity(db, feature, service, item):
    _seed(db)
    _ext(db)
    assert _subject(db, _local(), feature=feature, service=service, item=item) == {
        "user_id": SID, "on_behalf_of": {"kind": "local", "user_id": LID, "feature": feature}}
    rows = _audit(db, "identity.service_identity.extended")
    assert rows[-1]["actor_user_id"] == LID and rows[-1]["decision"] == "allowed"
    details = json.loads(rows[-1]["details_json"])
    assert {k: details[k] for k in ("feature", "bridge_service", "item")} == {"feature": feature, "bridge_service": service, "item": list(item) if isinstance(item, tuple) else item}
    assert set(details) <= {"feature", "bridge_service", "item", "channel", "identity"}  # ids only (the audit layer adds channel / identity)


def test_area_write_is_refused_in_both_modes(db):
    _seed(db)
    for on in (False, True):
        _ext(db, on=on)
        for feature in ("devices.area", "devices.control", "cameras.live"):
            assert _code(db, _local(), feature=feature, service="set_entity_area", item=None) == "service_identity_refused", (on, feature)
    assert _audit(db, "identity.service_identity.refused")[-1]["reason"] == "never_local"  # with the switch on: the explicit never-list
    assert si.never_list(True) == frozenset({("smplwise_bridge", "set_entity_area")})
    with db.connection(mode="read") as conn:
        assert si.never_local("set_entity_area", {"x": 1}, True) is True and si.never_local("set_entity_area", None, False) is False


def test_area_write_stays_refused_even_when_a_table_lists_it(db, monkeypatch):
    _seed(db)
    _ext(db)
    widened = {k: dict(v) for k, v in si.EXTENDED_FEATURES.items()}
    widened["devices.area"] = {"set_entity_area": frozenset({None})}
    monkeypatch.setattr(si, "EXTENDED_FEATURES", widened)
    assert _code(db, _local(), feature="devices.area", service="set_entity_area", item=None) == "service_identity_refused"


@pytest.mark.parametrize("feature,service,item", [
    ("media", "execute", ("lock", "unlock")),
    ("alarm", "execute", ("lock", "unlock")),
    ("alarm", "execute", ("switch", "turn_on")),  # the bypass control only through the zone-bypass route's own feature
    ("devices.control", "execute", ("alarm_control_panel", "alarm_arm_custom_bypass")),
    ("alarm.bypass", "execute", ("light", "turn_on")),
    ("cameras.live", "execute", ("light", "turn_on")),
    ("cameras.live", "stream_source", "write"),
    ("alarm", "execute", ("alarm_control_panel", "alarm_trigger")),
    ("automations", "config_item", "upsert"),
    ("automations", "config_item", "run"),
    ("system", "execute", ("homeassistant", "restart")),
    ("devices.control", "execute", ["lock", "unlock"]),  # an unhashable item
])
def test_switch_on_keeps_refusing_items_outside_their_feature(db, feature, service, item):
    _seed(db)
    _ext(db)
    assert _code(db, _local(), feature=feature, service=service, item=item) == "service_identity_refused"


def test_switch_on_keeps_every_other_refusal(db):
    _seed(db, active=0)
    _ext(db)
    assert _code(db, _local(), feature="devices.control", item=("lock", "unlock")) == "user_inactive"
    with db.connection() as conn:
        conn.execute("UPDATE users SET active = 1 WHERE id = ?", (LID,))
        set_setting(conn, si.SETTING, HA_ADMIN)  # an administrator as the service identity: still refused at use
    assert _code(db, _local(), feature="devices.control", item=("lock", "unlock")) == "service_identity_admin"
    with db.connection() as conn:
        set_setting(conn, si.SETTING, SID)
    ha = Principal(user_id="u-ha", username="dana", display_name="Dana", source="remote", via="cookie")
    assert _subject(db, ha, item=("lock", "unlock")) == {"user_id": "u-ha"}  # a Home Assistant principal: untouched by the switch
    with db.connection() as conn, pytest.raises(ApiError) as e:
        si.refuse_automation_write(conn, _local(), None)  # the automations screen: HA users only, in both modes
    assert e.value.code == "automation_write_requires_ha_identity"


# ---------------------------------------------------------------- 3. the switch itself, the self-check and the drift with the bridge

def test_the_switch_is_off_by_default_system_admin_and_local_channel_only(lx_app):
    lx = lx_app
    assert lx.admin.get("/api/v1/settings").json()["settings"]["security.local_identity_extended"] == "off"
    lx.enable()
    created, c = lx.ready("maria", "site_admin")
    r = c.patch("/arx/api/v1/settings", json={"security.local_identity_extended": "on"})
    assert r.status_code == 403, r.text  # a local user (no system.configure; and the remote channel is refused for this key)
    from fastapi.testclient import TestClient

    vera = TestClient(lx.app, headers={"X-SW-Dev-User": "vera"})
    assert vera.patch("/api/v1/settings", json={"security.local_identity_extended": "on"}).status_code == 403
    assert lx.admin.patch("/api/v1/settings", json={"security.local_identity_extended": "bogus"}).status_code == 422
    r = lx.admin.patch("/api/v1/settings", json={"security.local_identity_extended": "on"})
    assert r.status_code == 200 and r.json()["settings"]["security.local_identity_extended"] == "on"
    rows = lx.rows("SELECT decision, details_json FROM audit_log WHERE action = 'identity.service_identity.extended_switch' ORDER BY rowid")
    sw = json.loads(rows[-1]["details_json"])
    assert rows[-1]["decision"] == "allowed" and (sw["from"], sw["to"]) == ("off", "on")
    assert "security.local_identity_extended" in backup.SETTINGS_KEEP  # a restore never switches it on


def test_the_self_check_shows_both_copies_and_the_lists_follow_the_mode(db):
    _seed(db)
    with db.connection(mode="read") as conn:
        st = si.status(conn)
    assert st["extended"] == {"requested": False, "on": False, "bridge_on": False, "bridge_version_ok": False, "agrees": True, "required": "0.9.1"}
    assert {a["key"] for a in st["allowed"]} == set(si.FEATURES) and not any(s["code"].startswith("extended") for s in st["steps"])
    _ext(db, bridge_on=False)
    with db.connection(mode="read") as conn:
        st = si.status(conn)
    codes = {s["code"] for s in st["steps"]}
    assert {"extended_on", "extended_bridge_off"} <= codes and st["extended"]["agrees"] is False
    assert {a["key"] for a in st["allowed"]} == set(si.EXTENDED_FEATURE_LABELS) and len(st["refused"]) == len(si.EXTENDED_REFUSED_LABELS)
    assert all(x["he"] and x["en"] for x in st["allowed"] + st["refused"] + st["steps"])
    _ext(db, on=False, bridge_on=True)
    with db.connection(mode="read") as conn:
        assert "extended_bridge_only" in {s["code"] for s in si.status(conn)["steps"]}


def test_the_bridge_copy_arrives_with_the_directory_push(db):
    _seed(db)
    with db.connection() as conn:
        si.note_directory_push(conn, {"service_identity": True, "service_user_id": SID, "local_identity_extended": True})
        assert get_setting(conn, si.BRIDGE_EXTENDED) == "true"
        si.note_directory_push(conn, {"service_identity": True, "service_user_id": SID})  # an older bridge: no key = off
        assert get_setting(conn, si.BRIDGE_EXTENDED) == "false"
        si.note_directory_push(conn, {"service_identity": True, "service_user_id": SID, "local_identity_extended": "true"})  # not a boolean
        assert get_setting(conn, si.BRIDGE_EXTENDED) == "false"


def test_never_lists_and_extended_tables_are_identical_on_both_sides():
    bridge = load("service_identity")
    assert si.NEVER_LOCAL == bridge.NEVER_LOCAL and si.NEVER_LOCAL_EXTENDED == bridge.NEVER_LOCAL_EXTENDED == frozenset({si.AREA_WRITE})
    for on in (False, True):
        assert si.never_list(on) == bridge.never_list(on)
        assert {k: {s: frozenset(v) for s, v in d.items()} for k, d in si.features(on).items()} == \
               {k: {s: frozenset(v) for s, v in d.items()} for k, d in bridge.features(on).items()}
    for k, d in si.EXTENDED_FEATURES.items():  # nothing on the extended never-list is in an extended table
        for svc, items in d.items():
            assert not any(si.never_local(svc, i, True) for i in items), k
    assert si.BRIDGE_EXTENDED_REQUIRED == load("const").VERSION == "0.9.1"


# ---------------------------------------------------------------- 4. through the routes: the user's own permission still decides

def _bind_role(lx, uid: str, permissions: list[str], sensitive: list[str]) -> None:
    r = lx.admin.post("/api/v1/access/roles", json={"name": f"role-{len(permissions)}-{len(sensitive)}-{uid[-4:]}", "permissions": permissions, "sensitive": sensitive})
    assert r.status_code in (200, 201), r.text
    with lx.db.connection() as conn:
        conn.execute("INSERT INTO bindings(id, subject_kind, subject_id, role_id, scope_type, scope_id, effect, permission_revision, assigned_by, created_at) "
                     "VALUES (?, 'user', ?, ?, 'installation', '*', 'allow', ?, 'test', ?)", (new_id(), uid, r.json()["id"], permission_revision(conn), now_iso()))
        bump_permission_revision(conn)


def _service_user(lx) -> None:
    with lx.db.connection() as conn:
        conn.execute("INSERT OR IGNORE INTO ha_users(id, name, username, is_active, is_admin, synced_at) VALUES (?, 'SmplWise Arx Service', 'arxsvc', 1, 0, ?)", (SID, now_iso()))
        set_setting(conn, si.SETTING, SID)


def test_doors_and_scripts_through_device_control_need_the_switch_and_the_users_permission(lx_app, monkeypatch):
    lx = lx_app
    secret, calls = _bridge(lx, monkeypatch, version="0.9.1")
    lx.enable()
    _service_user(lx)
    door_user, c = lx.ready("dora", "operator")  # operator: ha.entity.control, no door.unlock
    _bind_role(lx, door_user["user"]["id"], ["devices.read"], ["door.unlock"])
    plain_user, p = lx.ready("pita", "operator")  # no door.unlock
    viewer_user, v = lx.ready("vivi", "viewer")  # no ha.entity.control
    unlock = {"entity": "lock.front", "action": "lock.unlock", "confirmation_grant": "confirmed"}
    # switch off: refused exactly as in 2.6.4, nothing sent
    r = _action(c, crid="d-0", **unlock)
    assert r.status_code == 403 and r.json()["code"] == "service_identity_refused", r.text
    r = _action(c, entity="script.open_front", action="script.turn_on", crid="s-0", confirmation_grant="confirmed")
    assert r.status_code == 403 and r.json()["code"] == "service_identity_refused", r.text
    assert calls == []
    # switch on, but the bridge has not reported its own copy: still nothing sent
    assert lx.admin.patch("/api/v1/settings", json={"security.local_identity_extended": "on"}).status_code == 200
    r = _action(c, crid="d-1", **unlock)
    assert r.status_code == 503 and r.json()["code"] == "service_identity_extended_bridge_off" and calls == []
    with lx.db.connection() as conn:
        set_setting(conn, si.BRIDGE_EXTENDED, "true")
    # missing permission first: no door.unlock -> the grant refusal; no ha.entity.control -> forbidden; nothing sent
    r = _action(p, crid="d-2", **unlock)
    assert r.status_code == 403 and r.json()["code"] == "grant_required", r.text
    r = _action(v, entity="script.open_front", action="script.turn_on", crid="s-1", confirmation_grant="confirmed")
    assert r.status_code == 403 and r.json()["code"] == "forbidden", r.text
    assert calls == []
    # the user's own permission + the switch: sent as the service identity, attributed to the person
    r = _action(c, crid="d-3", **unlock)
    assert r.status_code == 202, r.text
    assert calls[-1]["user_id"] == SID and (calls[-1]["domain"], calls[-1]["service"]) == ("lock", "unlock")
    assert calls[-1]["on_behalf_of"] == {"kind": "local", "user_id": door_user["user"]["id"], "feature": "devices.control"}
    for i, (entity, action) in enumerate((("script.open_front", "script.turn_on"), ("scene.evening", "scene.turn_on"))):
        r = _action(p, entity=entity, action=action, crid=f"s-{i + 2}", confirmation_grant="confirmed")
        assert r.status_code == 202, r.text
        assert calls[-1]["on_behalf_of"]["feature"] == "devices.control" and calls[-1]["domain"] == action.split(".")[0]
    rows = lx.rows("SELECT actor_user_id, details_json FROM audit_log WHERE action = 'identity.service_identity.extended' ORDER BY rowid")
    assert [json.loads(r["details_json"])["item"] for r in rows] == [["lock", "unlock"], ["script", "turn_on"], ["scene", "turn_on"]]
    # switched off again: refused again
    assert lx.admin.patch("/api/v1/settings", json={"security.local_identity_extended": "off"}).status_code == 200
    n = len(calls)
    r = _action(c, crid="d-4", **unlock)
    assert r.status_code == 403 and r.json()["code"] == "service_identity_refused" and len(calls) == n


def test_the_area_write_route_refuses_a_local_user_with_the_switch_on(lx_app, monkeypatch):
    lx = lx_app
    _bridge(lx, monkeypatch, version="0.9.1")
    lx.enable()
    _service_user(lx)
    created, c = lx.ready("maria", "site_admin")
    assert lx.admin.patch("/api/v1/settings", json={"security.local_identity_extended": "on"}).status_code == 200
    with lx.db.connection() as conn:
        set_setting(conn, si.BRIDGE_EXTENDED, "true")
    sent = []
    from smplwise.services import ha_client

    monkeypatch.setattr(ha_client, "call_bridge_set_area", lambda *a, **k: sent.append(a) or {"ok": True})
    r = c.put("/arx/api/v1/devices/entities/light.lobby/area", json={"area_id": "kitchen"})
    assert r.status_code == 403, r.text
    assert sent == []


# ---------------------------------------------------------------- 5. the alarm: zone bypass and arming with the bypass set

def _alarm_local(app, monkeypatch, role: str):
    from smplwise.services import ha_sync as hs

    db = app.state.db
    _seed(db, role=role)
    with db.connection() as conn:
        now = now_iso()
        hs.upsert_state(conn, {"entity_id": "alarm_control_panel.risco_house", "state": "disarmed", "last_changed": now, "last_updated": now,
                               "attributes": {"friendly_name": "x", "code_format": "number", "code_arm_required": False, "supported_features": 1 | 2 | 4 | 16}})
    local = _local()
    return local


def _as(app, principal):
    app.dependency_overrides[current_principal] = lambda: principal
    app.dependency_overrides[current_principal_ro] = lambda: principal


def test_zone_bypass_and_custom_bypass_need_the_switch_and_alarm_bypass(alarm_app, monkeypatch):
    from test_alarm import _act, _bypass, _no_code

    app, s, c, calls, _ = alarm_app
    db = app.state.db
    local = _alarm_local(app, monkeypatch, "site_admin")  # alarm.arm + alarm.disarm + alarm.bypass
    _no_code(c, LID)
    try:
        # switch off: refused exactly as in 2.6.4 (zone_bypass / never_local), nothing sent
        _as(app, local)
        n = len(calls)
        assert _bypass(c, "binary_sensor.kitchen_window", True, confirmed=True).json()["code"] == "service_identity_refused"
        assert _act(c, "alarm_control_panel.risco_house", "arm_custom_bypass").json()["code"] == "service_identity_refused"
        assert len(calls) == n
        # switch on, bridge copy off: nothing sent
        _ext(db, bridge_on=False)
        r = _bypass(c, "binary_sensor.kitchen_window", True, confirmed=True)
        assert r.status_code == 503 and r.json()["code"] == "service_identity_extended_bridge_off" and len(calls) == n
        # both copies on: the bypass goes out as `alarm.bypass`, arming with the bypass set as `alarm`
        _ext(db)
        r = _bypass(c, "binary_sensor.kitchen_window", True, confirmed=True)
        assert r.status_code == 202, r.text
        assert calls[-1]["user_id"] == SID and calls[-1]["on_behalf_of"] == {"kind": "local", "user_id": LID, "feature": "alarm.bypass"}
        assert (calls[-1]["domain"], calls[-1]["service"]) in si.BYPASS_PAIRS
        r = _act(c, "alarm_control_panel.risco_house", "arm_custom_bypass")
        assert r.status_code == 202, r.text
        assert calls[-1]["service"] == "alarm_arm_custom_bypass" and calls[-1]["on_behalf_of"]["feature"] == "alarm"
        assert _bypass(c, "binary_sensor.kitchen_window", False, confirmed=True).status_code == 202  # the restore too
    finally:
        app.dependency_overrides.clear()


def test_without_alarm_bypass_a_local_user_cannot_bypass_even_with_the_switch_on(alarm_app, monkeypatch):
    from test_alarm import _act, _bypass, _no_code

    app, s, c, calls, _ = alarm_app
    db = app.state.db
    local = _alarm_local(app, monkeypatch, "operator")  # alarm.arm only
    _no_code(c, LID)
    _ext(db)
    try:
        _as(app, local)
        n = len(calls)
        r = _act(c, "alarm_control_panel.risco_house", "arm_custom_bypass")
        assert r.status_code == 403 and r.json()["code"] == "forbidden", r.text
        assert _bypass(c, "binary_sensor.kitchen_window", True, confirmed=True).status_code == 403
        assert len(calls) == n
        assert _act(c, "alarm_control_panel.risco_house", "arm_away").status_code == 202  # plain arming still works
    finally:
        app.dependency_overrides.clear()


# ---------------------------------------------------------------- 6. WisKey doors: the one door rule, for a local user only in the extended mode

def test_the_door_rule_judges_a_local_user_only_with_the_switch_on(db):
    _seed(db, role="door_opener")  # access.doors.open installation-wide
    local = _local()
    with db.connection(mode="read") as conn:
        assert door_authority.check(conn, local, "station-1").reason == "identity_unmapped"  # switch off: as in 2.6.4
    _ext(db, bridge_on=False)  # a WisKey door never goes through the bridge: the add-on's switch is what counts
    with db.connection(mode="read") as conn:
        d = door_authority.check(conn, local, "station-1")
        assert d.allowed and d.granted_by == "access.doors.open"
    with db.connection() as conn:
        conn.execute("DELETE FROM bindings WHERE subject_id = ?", (LID,))
        bump_permission_revision(conn)
    with db.connection(mode="read") as conn:
        assert door_authority.check(conn, local, "station-1").allowed is False  # no permission: refused
    with db.connection() as conn:
        conn.execute("INSERT INTO bindings(id, subject_kind, subject_id, role_id, scope_type, scope_id, effect, permission_revision, assigned_by, created_at) "
                     "VALUES (?, 'user', ?, 'door_opener', 'installation', '*', 'allow', ?, 'test', ?)", (new_id(), LID, permission_revision(conn), now_iso()))
        conn.execute("UPDATE users SET active = 0 WHERE id = ?", (LID,))
    with db.connection(mode="read") as conn:
        assert door_authority.check(conn, local, "station-1").reason == "identity_unmapped"  # an inactive local user
        # a principal that only claims to be local by source with a Home Assistant id is never judged as one
        assert door_authority.identity_ok(Principal(user_id=SID, username="x", display_name="x", source="local"), False, conn) is False


# ---------------------------------------------------------------- 7. the camera stream source (enable), both sides together

def test_a_local_user_enables_a_live_camera_only_with_the_switch_on(live):
    from test_ha_camera_live import ENTITY, URL, FakeHass, FakeUser, STREAM, svc, signing
    from smplwise.services import ha_camera_streams as hls

    app = live.app
    db = app.state.db
    _seed(db)
    from smplwise.services import ha_bridge

    with db.connection(mode="read") as conn:
        secret = ha_bridge.signing_key(conn)
    bridge_si = load("service_identity")
    seen: list[dict] = []
    bridge_extended = [True]

    def stream_source(_settings, payload):
        """What the bridge's __init__ does: screen (with its own copy of the switch), then the handler with the waiver for a screened message."""
        seen.append(dict(payload))
        hass = FakeHass({SID: FakeUser(SID, admin=False)}, {ENTITY})

        async def getter(_hass, entity_id):
            return URL

        async def run():
            msg, refused = await bridge_si.screen(hass, signing.Verifier(secret), dict(payload), "stream_source", SID, bridge_extended[0])
            if refused is not None:
                return refused
            return await svc.async_handle_stream_source(hass, bridge_si.PREVERIFIED, msg, admin_waived="on_behalf_of" in payload and bridge_extended[0])

        original = svc._ha
        svc._ha = lambda: SimpleNamespace(get_stream_source=getter)
        try:
            return asyncio.run(run())
        finally:
            svc._ha = original

    hls.set_transport(SimpleNamespace(stream_source=stream_source))
    local = _local()
    with db.connection() as conn, pytest.raises(ApiError) as e:  # switch off: refused before anything is asked, exactly as before
        hls.enable(conn, live.s, local, ENTITY)
    # the test app runs in developer identity mode (the identity gate passes), so the service identity is what refuses: the stream source is in
    # no 2.6.4 table; in the add-on (no developer identity) the gate answers identity_unmapped first. Either way nothing is asked.
    assert e.value.code == "service_identity_refused" and seen == []
    _ext(db)
    bridge_extended[0] = False  # the bridge's own copy off: the bridge refuses (the add-on was told it is on - a stale copy)
    with db.connection() as conn, pytest.raises(ApiError):
        hls.enable(conn, live.s, local, ENTITY)
    assert seen and "on_behalf_of" in seen[-1] and live.go.writes() == []
    bridge_extended[0] = True
    with db.connection() as conn:
        out = hls.enable(conn, live.s, local, ENTITY)
    assert out["enabled"] is True and live.go.store[STREAM] == [URL]
    assert seen[-1]["user_id"] == SID and seen[-1]["on_behalf_of"] == {"kind": "local", "user_id": LID, "feature": "cameras.live"}
    with db.connection(mode="read") as conn:
        assert hls.enabled(conn)[ENTITY]["enabled_by"] == LID


from test_alarm import _fresh_limits, alarm_app  # noqa: E402,F401  (fixtures)
from test_camera_card import cam_app  # noqa: E402,F401
from test_devices import dev_app  # noqa: E402,F401
from test_ha_camera_live import _no_real_dns, live  # noqa: E402,F401
