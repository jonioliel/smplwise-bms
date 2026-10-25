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
    ("automations.run", "config_item", "trigger"),  # second round: running from the automations screen
    ("automations.run", "config_item", "run_script"),
    ("automations.run", "config_item", "apply_scene"),
]


# SVCIDENT3 (review S1 a): a run item names the script / scene / automation it runs; both copies of the allowlist list these
RUN_ENTITY = {("execute", ("script", "turn_on")): "script.open_front", ("execute", ("scene", "turn_on")): "scene.evening",
              ("config_item", "trigger"): "automation.a1", ("config_item", "run_script"): "script.s1", ("config_item", "apply_scene"): "scene.x"}
RUN_IDS = sorted(RUN_ENTITY.values())
# EXTID-295 (CR-USR2 13.6): a Home Assistant group whose entity policy names only some devices - the restricted service user the bridge needs
RESTRICTED_GROUPS = [SimpleNamespace(id="arx_service", name="Arx service", policy={"entities": {"domains": {"light": True, "lock": True}}})]


def _ext(db, *, on: bool = True, bridge_on: bool = True, version: str = "0.9.6", runnable: list[str] | None = None, policy: str = "true") -> None:
    """`policy` (EXTID-295, CR-USR2 13.6): what the bridge reported about the service user's entity policy ("true" = restricted)."""
    with db.connection() as conn:
        set_setting(conn, si.EXTENDED_SETTING, "on" if on else "off")
        set_setting(conn, si.BRIDGE_EXTENDED, "true" if bridge_on else "false")
        set_setting(conn, si.BRIDGE_POLICY, policy)
        set_setting(conn, si.DIRECTORY_AT, now_iso())  # ENTPOL-295: the report is current (the bridge pushed just now)
        set_setting(conn, "bridge.integration_version", version)
        ids = RUN_IDS if runnable is None else runnable
        set_setting(conn, si.RUNNABLE_SETTING, json.dumps(ids))
        set_setting(conn, si.BRIDGE_RUNNABLE, json.dumps(ids))


def _xsubject(db, principal, feature="devices.control", service="execute", item=("light", "turn_on")):
    """_subject with the entity id a run item names (SVCIDENT3)."""
    with db.connection() as conn:
        return si.subject(conn, principal, feature, bridge_service=service, item=item, entity_id=RUN_ENTITY.get((service, item)) if not isinstance(item, list) else None)


def _xcode(db, principal, **kw) -> str:
    with pytest.raises(ApiError) as e:
        _xsubject(db, principal, **kw)
    return e.value.code


def _audit(db, action: str) -> list[dict]:
    with db.connection(mode="read") as conn:
        return [dict(r) for r in conn.execute("SELECT actor_user_id, decision, reason, details_json FROM audit_log WHERE action = ? ORDER BY rowid", (action,))]


@pytest.fixture(autouse=True)
def _go_live_permit(request, monkeypatch):
    """integ/270 (2.7.0 security review S7): the extended mode ships with `EXTENDED_GO_LIVE_PERMITTED = False`. The tests below that
    describe the FUTURE enabled behaviour run with the permit set (like test_access_grants' GO_LIVE_PERMITTED); the tests named
    `..._without_the_go_live_permit` run with the value this build ships."""
    if "without_the_go_live_permit" not in request.node.name:
        monkeypatch.setattr(si, "EXTENDED_GO_LIVE_PERMITTED", True)


# ---------------------------------------------------------------- 0. the go-live guard (S7): in 2.7.0 the mode cannot be turned on

def test_the_extended_mode_ships_without_the_go_live_permit():
    assert si.EXTENDED_GO_LIVE_PERMITTED is False
    assert si.extended_go_live_permitted() is False


def test_the_switch_cannot_be_turned_on_without_the_go_live_permit(lx_app):
    lx = lx_app
    lx.enable()
    r = lx.admin.patch("/api/v1/settings", json={"security.local_identity_extended": "on"})
    assert r.status_code == 409 and r.json()["code"] == "extended_not_permitted", r.text
    assert lx.admin.get("/api/v1/settings").json()["settings"]["security.local_identity_extended"] == "off"  # nothing stored
    created, c = lx.ready("maria", "site_admin")
    assert c.patch("/arx/api/v1/settings", json={"security.local_identity_extended": "on"}).status_code == 403  # the authority checks come first
    assert lx.admin.patch("/api/v1/settings", json={"security.local_identity_extended": "off"}).status_code == 200  # off always works
    rows = lx.rows("SELECT decision, reason FROM audit_log WHERE action = 'identity.service_identity.extended_switch' ORDER BY rowid")
    assert not [row for row in rows if row["decision"] == "allowed"]  # never an allowed switch to on


@pytest.mark.parametrize("feature,service,item", EXT_ITEMS)
def test_a_stored_on_value_changes_nothing_without_the_go_live_permit(db, feature, service, item):
    _seed(db)
    _ext(db, on=True, bridge_on=True)  # as if a later build had stored it (both copies on, a 0.9.1 bridge)
    with db.connection(mode="read") as conn:
        assert si.extended_requested(conn) is True and si.extended_on(conn) is False
        assert si.status(conn)["extended"]["permitted"] is False and si.status(conn)["extended"]["on"] is False
    assert _code(db, _local(), feature=feature, service=service, item=item) == "service_identity_refused"  # exactly the 2.6.4 refusal
    expected = "never_local" if item in si.NEVER_LOCAL else "service_identity_refused"
    assert _audit(db, "identity.service_identity.refused")[-1]["reason"] == expected
    assert _audit(db, "identity.service_identity.extended") == []


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
    assert _xcode(db, _local(), feature=feature, service=service, item=item) == "service_identity_extended_bridge_off"
    # SVCIDENT3: the run fences (S1 b, S2) are in 0.9.2; EXTID-295: the V-01 fix and the policy report are in 0.9.6 - an older bridge gets no
    # extended item at all, even when it (impossibly) reported a restricted policy
    for old in ("0.9.0", "0.9.1", "0.9.2", "0.9.5"):
        _ext(db, bridge_on=True, version=old)
        assert _xcode(db, _local(), feature=feature, service=service, item=item) == "service_identity_extended_bridge_off"
    # an item the 2.6.4 tables already allow does not depend on the bridge's copy
    assert _subject(db, _local())["on_behalf_of"]["feature"] == "devices.control"


@pytest.mark.parametrize("feature,service,item", EXT_ITEMS)
def test_1306_switch_on_refuses_each_extended_item_while_the_service_policy_is_not_restricted(db, feature, service, item):
    """EXTID-295 (CR-USR2 13.6, owner decision 3 of 2026-10-21) - negative first: the default (or an unknown) entity policy of the service
    user refuses every item only the extended mode admits, 503, audited `policy_default`, nothing sent; basic items are not affected."""
    _seed(db)
    for policy in ("false", "", "True", "1"):  # only the exact report "true" counts
        _ext(db, policy=policy)
        assert _xcode(db, _local(), feature=feature, service=service, item=item) == "service_identity_policy_default"
        assert _audit(db, "identity.service_identity.refused")[-1]["reason"] == "policy_default"
    assert _audit(db, "identity.service_identity.extended") == []
    assert _subject(db, _local())["on_behalf_of"]["feature"] == "devices.control"  # a 2.6.4 item: unaffected by the report
    _ext(db, policy="true")
    assert _xsubject(db, _local(), feature=feature, service=service, item=item)["user_id"] == SID


def test_1306_the_policy_report_arrives_with_the_push_and_is_shown_on_the_card(db):
    _seed(db)
    with db.connection() as conn:
        base = {"service_identity": True, "service_user_id": SID, "local_identity_extended": True}
        for sent, stored in ((True, "true"), (False, "false"), (None, ""), ("true", ""), (1, "")):
            si.note_directory_push(conn, {**base, "service_policy_restricted": sent})
            assert get_setting(conn, si.BRIDGE_POLICY) == stored, sent
        si.note_directory_push(conn, {**base, "service_policy_restricted": True})
        si.note_directory_push(conn, base)  # an older bridge sends no key: unknown
        assert get_setting(conn, si.BRIDGE_POLICY) == ""
    rows = _audit(db, "bridge.service_identity_seen")
    assert json.loads(rows[-1]["details_json"])["policy_restricted"] is None
    _ext(db, policy="false")
    with db.connection(mode="read") as conn:
        st = si.status(conn)
    assert st["extended"]["service_policy_restricted"] is False and "service_policy_default" in {s["code"] for s in st["steps"]}
    _ext(db, policy="true")
    with db.connection(mode="read") as conn:
        st = si.status(conn)
    assert st["extended"]["service_policy_restricted"] is True and "service_policy_default" not in {s["code"] for s in st["steps"]}
    assert si.BRIDGE_POLICY in backup.SETTINGS_KEEP  # an archive's "true" never stands in for the live report


# ---------------------------------------------------------------- 2. switch on: each item, as the service identity, audited with ids only

@pytest.mark.parametrize("feature,service,item", EXT_ITEMS)
def test_switch_on_admits_each_extended_item_through_the_service_identity(db, feature, service, item):
    _seed(db)
    _ext(db)
    assert _xsubject(db, _local(), feature=feature, service=service, item=item) == {
        "user_id": SID, "on_behalf_of": {"kind": "local", "user_id": LID, "feature": feature}}
    rows = _audit(db, "identity.service_identity.extended")
    assert rows[-1]["actor_user_id"] == LID and rows[-1]["decision"] == "allowed"
    details = json.loads(rows[-1]["details_json"])
    assert {k: details[k] for k in ("feature", "bridge_service", "item")} == {"feature": feature, "bridge_service": service, "item": list(item) if isinstance(item, tuple) else item}
    assert set(details) <= {"feature", "bridge_service", "item", "entity_id", "channel", "identity"}  # ids only (the audit layer adds channel / identity)
    assert details.get("entity_id") == RUN_ENTITY.get((service, item))  # SVCIDENT3: a run names the item it runs


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
    ("automations.run", "config_item", "upsert"),  # second round: a write never, even under the run feature
    ("automations.run", "config_item", "delete"),
    ("automations.run", "config_item", "enable"),
    ("automations.run", "config_item", "stop_script"),
    ("devices.control", "config_item", "trigger"),  # a run only under its own feature
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
    assert st["extended"] == {"permitted": True, "requested": False, "on": False, "bridge_on": False, "bridge_version_ok": False, "agrees": True, "required": "0.9.6",
                              "doors_addon_only": True,  # SVCIDENT3 (review S4)
                              "service_policy_restricted": None,  # EXTID-295 (CR-USR2 13.6): nothing reported yet
                              "service_policy_fresh": False}  # ENTPOL-295: no push yet
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
    # SVCIDENT3: the run fences ship in 0.9.2; EXTID-295 (Fable review 4): the V-01 fix and the policy report ship in 0.9.6
    assert si.BRIDGE_EXTENDED_REQUIRED == "0.9.6" and si._version_tuple(load("const").VERSION) >= si._version_tuple("0.9.6")  # numeric, not string order (0.10.0 > 0.9.6)


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
    secret, calls = _bridge(lx, monkeypatch, version="0.9.6")
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
    # EXTID-295 (CR-USR2 13.6): the bridge has not reported a restricted service user - still nothing sent
    r = _action(c, crid="d-1p", **unlock)
    assert r.status_code == 503 and r.json()["code"] == "service_identity_policy_default" and calls == []
    with lx.db.connection() as conn:
        set_setting(conn, si.BRIDGE_POLICY, "true")
        set_setting(conn, si.DIRECTORY_AT, "2026-01-01T00:00:00Z")
    # ENTPOL-295: "restricted" was reported, but the bridge stopped pushing (Home Assistant unreachable) - not trusted, nothing sent
    r = _action(c, crid="d-1s", **unlock)
    assert r.status_code == 503 and r.json()["code"] == "service_identity_policy_default" and calls == []
    assert lx.rows("SELECT reason FROM audit_log WHERE action = 'identity.service_identity.refused' ORDER BY rowid")[-1]["reason"] == "policy_stale"
    with lx.db.connection() as conn:
        set_setting(conn, si.DIRECTORY_AT, now_iso())  # ENTPOL-295: in a current push
    # SVCIDENT3 (review S1 a): a script / scene outside the runnable allowlist (empty by default) is refused with both switches on, nothing sent
    # owner answer 2026-10-18: a script from device control also needs script.run / script.manage - an operator holds neither (audited 403)
    r = _action(p, entity="script.open_front", action="script.turn_on", crid="sr-0", confirmation_grant="confirmed")
    assert r.status_code == 403 and r.json()["code"] == "forbidden", r.text
    denied = lx.rows("SELECT reason FROM audit_log WHERE action = 'script.run' AND decision = 'denied' ORDER BY rowid")
    assert denied, "the script.run refusal is audited"
    _bind_role(lx, plain_user["user"]["id"], ["script.run"], [])
    for i, (entity, action) in enumerate((("script.open_front", "script.turn_on"), ("scene.evening", "scene.turn_on"))):
        r = _action(p, entity=entity, action=action, crid=f"nr-{i}", confirmation_grant="confirmed")
        assert r.status_code == 403 and r.json()["code"] == "service_identity_not_runnable", r.text
    assert calls == []
    assert lx.admin.put("/api/v1/identity/service-identity/runnable", json={"entity_ids": ["script.open_front", "scene.evening"]}).status_code == 200
    r = _action(p, entity="script.open_front", action="script.turn_on", crid="nr-2", confirmation_grant="confirmed")
    assert r.status_code == 503 and r.json()["code"] == "service_identity_runnable_bridge_missing" and calls == []  # the bridge's copy lacks it
    with lx.db.connection() as conn:
        set_setting(conn, si.BRIDGE_RUNNABLE, json.dumps(["scene.evening", "script.open_front"]))
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
        user = FakeUser(SID, admin=False)
        user.groups = RESTRICTED_GROUPS  # 0.9.6 (CR-USR2 13.6): the service user is restricted
        hass = FakeHass({SID: user}, {ENTITY})

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


# ---------------------------------------------------------------- 8. second round (owner 2026-10-17): RUNNING from the automations screen

RUN_PERMS = ["script.run", "devices.control", "devices.read", "entity.state.read"]


def _local_runner(app, c, *, sensitive: list[str]) -> Principal:
    """A local person bound to a custom role at the installation (the role is created by the bootstrap administrator)."""
    db = app.state.db
    _seed(db, role=None)
    r = c.post("/api/v1/access/roles", json={"name": f"runner-{len(sensitive)}-{new_id()[:6]}", "permissions": RUN_PERMS if sensitive is not None else [], "sensitive": sensitive})
    assert r.status_code in (200, 201), r.text
    with db.connection() as conn:
        conn.execute("INSERT INTO bindings(id, subject_kind, subject_id, role_id, scope_type, scope_id, effect, permission_revision, assigned_by, created_at) "
                     "VALUES (?, 'user', ?, ?, 'installation', '*', 'allow', ?, 'test', ?)", (new_id(), LID, r.json()["id"], permission_revision(conn), now_iso()))
        bump_permission_revision(conn)
    return _local()


def _screened_transport(tr, *, bridge_extended: list[bool]) -> list[dict]:
    """The bridge as __init__ runs it: service_identity.screen with the bridge's own copy of the switch, then the real config_item handler (the message
    without `on_behalf_of`, re-signed for the fake). Returns every payload the add-on signed, `on_behalf_of` included."""
    from smplwise.services import ha_bridge

    bsi, signing = load("service_identity"), load("signing")
    seen: list[dict] = []
    original = tr.bridge

    class _Auth:
        async def async_get_user(self, uid):
            return SimpleNamespace(id=uid, is_active=True, is_admin=False, system_generated=False, groups=RESTRICTED_GROUPS) if uid == SID else None

    def bridge(payload):
        seen.append({k: v for k, v in payload.items() if k not in ("sig", "nonce", "ts")})
        msg, refused = asyncio.run(bsi.screen(SimpleNamespace(auth=_Auth()), signing.Verifier(tr.secret), dict(payload), "config_item", SID, bridge_extended[0]))
        if refused is not None:
            return refused
        return original(ha_bridge.sign(tr.secret, {k: v for k, v in msg.items() if k not in ("sig", "nonce", "ts")}))

    tr.bridge = bridge
    return seen


def _runs(c, ids):
    return {
        "automation": c.post(f"/api/v1/automations/automation/{ids['automation']}/run", json={"client_request_id": rid(), "confirm": True, "skip_condition": False}),
        "script": c.post(f"/api/v1/automations/script/{ids['script']}/run", json={"client_request_id": rid(), "fields": {"temp": 22}, "confirm": True}),
        "scene": c.post(f"/api/v1/automations/scene/{ids['scene']}/apply", json={"client_request_id": rid(), "confirm": True}),
    }


def _entity_ids(c, ids) -> list[str]:
    """The entity ids of the three fixture items (what the runnable allowlist names)."""
    from automations_fixture import get_item

    out = []
    for kind, item_id in ids.items():
        body = get_item(c, kind, item_id).json()
        eid = body.get("entity_id") or (body.get("item") or {}).get("entity_id")
        assert isinstance(eid, str) and eid.startswith(kind + "."), body
        out.append(eid)
    return out


def _items(c):
    from automations_fixture import create_item, draft_of, item_by_name

    created = create_item(c, "automation", draft_of("ריצה מקומית"))
    assert created.status_code == 201, created.text
    return {"automation": created.json()["item"]["id"], "script": item_by_name(c, "קירור עם פרמטרים")["id"], "scene": item_by_name(c, "wall scene 03", "scene")["id"]}


def test_runs_from_the_automations_screen_need_the_switch_on_both_sides_and_the_users_permission(autos_app):
    app, s, c, fake, tr = autos_app
    ids = _items(c)  # by the bootstrap administrator, before any override
    local = _local_runner(app, c, sensitive=["automation.manage", "scene.manage", "ha.entity.control"])  # a scene needs the control of its entity
    with app.state.db.connection() as conn:
        set_setting(conn, "bridge.integration_version", "0.9.6")
    bridge_extended = [False]
    seen = _screened_transport(tr, bridge_extended=bridge_extended)
    _as(app, local)
    try:
        # switch off: refused exactly as in 2.6.4, before any op is recorded, nothing sent
        for kind, r in _runs(c, ids).items():
            assert r.status_code == 403 and r.json()["code"] == "automation_write_requires_ha_identity", (kind, r.text)
        assert seen == []
        # SVCIDENT3 (review S1 a): both switches on, the runnable allowlist empty (the default): refused, nothing sent
        _ext(app.state.db, bridge_on=True, runnable=[])
        for kind, r in _runs(c, ids).items():
            assert r.status_code == 403 and r.json()["code"] == "service_identity_not_runnable", (kind, r.text)
        assert seen == []
        run_ids = _entity_ids(c, ids)
        # the add-on's switch on, the bridge's copy not reported: nothing sent
        _ext(app.state.db, bridge_on=False, runnable=run_ids)
        for kind, r in _runs(c, ids).items():
            assert r.status_code == 503 and r.json()["code"] == "service_identity_extended_bridge_off", (kind, r.text)
        assert seen == []
        # the add-on believes the bridge is on, the bridge's own copy is off: the bridge refuses (fail closed)
        _ext(app.state.db, bridge_on=True, runnable=run_ids)
        r = _runs(c, ids)["script"]
        assert r.status_code != 202 and seen[-1]["on_behalf_of"]["feature"] == "automations.run"
        # both sides on: each run goes as the service identity, attributed to the person, `automations.run`
        bridge_extended[0] = True
        n = len(seen)
        for kind, r in _runs(c, ids).items():
            assert r.status_code == 202, (kind, r.text)
        ops = [(p["op"], p["user_id"], p["on_behalf_of"]) for p in seen[n:]]
        assert [o[0] for o in ops] == ["trigger", "run_script", "apply_scene"]
        assert all(o[1] == SID and o[2] == {"kind": "local", "user_id": LID, "feature": "automations.run"} for o in ops)
        rows = _audit(app.state.db, "identity.service_identity.extended")
        assert [json.loads(r["details_json"])["item"] for r in rows][-3:] == ["trigger", "run_script", "apply_scene"]
    finally:
        app.dependency_overrides.clear()


def test_writes_enable_disable_and_stop_stay_refused_with_the_switch_on(autos_app):
    from automations_fixture import create_item, draft_of, get_item

    app, s, c, fake, tr = autos_app
    ids = _items(c)
    rev = get_item(c, "automation", ids["automation"]).json()["revision"]
    local = _local_runner(app, c, sensitive=["automation.manage", "scene.manage", "script.manage"])
    _ext(app.state.db)
    seen = _screened_transport(tr, bridge_extended=[True])
    _as(app, local)
    try:
        attempts = {
            "create": create_item(c, "automation", draft_of("לא מקומי")),
            "delete": c.post(f"/api/v1/automations/automation/{ids['automation']}/delete", json={"base_revision": rev, "confirm": True, "client_request_id": rid()}),
            "enable": c.post(f"/api/v1/automations/automation/{ids['automation']}/enable", json={"client_request_id": rid()}),
            "disable": c.post(f"/api/v1/automations/automation/{ids['automation']}/disable", json={"client_request_id": rid()}),
            "stop": c.post(f"/api/v1/automations/script/{ids['script']}/stop", json={"client_request_id": rid()}),
        }
        for what, r in attempts.items():
            assert r.status_code == 403 and r.json()["code"] == "automation_write_requires_ha_identity", (what, r.text)
        assert seen == []
    finally:
        app.dependency_overrides.clear()
    # the tables agree: only the three run ops, never a write, on either side
    bsi = load("service_identity")
    assert si.AUTOMATION_RUN_OPS == bsi.AUTOMATION_RUN_OPS == frozenset({"trigger", "run_script", "apply_scene"})
    with app.state.db.connection() as conn:
        for op in ("upsert", "delete", "enable", "disable", "stop_script"):
            assert si.feature_refusal("automations.run", "config_item", op, True) == "service_identity_refused", op


def test_without_the_run_permission_a_local_user_is_refused_even_with_the_switch_on(autos_app):
    app, s, c, fake, tr = autos_app
    ids = _items(c)
    _seed(app.state.db, role="viewer")  # no script.run, no automation.manage, no scene rights
    _ext(app.state.db)
    seen = _screened_transport(tr, bridge_extended=[True])
    _as(app, _local())
    try:
        for kind, r in _runs(c, ids).items():
            assert r.status_code in (403, 404) and r.json()["code"] != "automation_write_requires_ha_identity", (kind, r.text)
        assert seen == []
    finally:
        app.dependency_overrides.clear()


# ---------------------------------------------------------------- 9. second round: arm_custom_bypass needs alarm.bypass for a Home Assistant user too

def test_a_home_assistant_user_needs_alarm_bypass_for_arm_custom_bypass(alarm_app, monkeypatch):
    from test_alarm import _act, _no_code
    from smplwise.services import ha_sync as hs

    app, s, c, calls, _ = alarm_app
    db = app.state.db
    with db.connection() as conn:
        now = now_iso()
        hs.upsert_state(conn, {"entity_id": "alarm_control_panel.risco_house", "state": "disarmed", "last_changed": now, "last_updated": now,
                               "attributes": {"friendly_name": "x", "code_format": "number", "code_arm_required": False, "supported_features": 1 | 2 | 4 | 16}})
        conn.execute("INSERT OR IGNORE INTO users(id, username, display_name, source, active, first_seen_at, last_seen_at) VALUES ('u-arm', 'armer', 'Armer', 'remote', 1, ?, ?)", (now, now))
        conn.execute("INSERT INTO bindings(id, subject_kind, subject_id, role_id, scope_type, scope_id, effect, permission_revision, assigned_by, created_at) "
                     "VALUES (?, 'user', 'u-arm', 'operator', 'installation', '*', 'allow', ?, 'test', ?)", (new_id(), permission_revision(conn), now))
        bump_permission_revision(conn)
    _no_code(c, "u-arm")
    _no_code(c)
    armer = Principal(user_id="u-arm", username="armer", display_name="Armer", source="remote", via="cookie")  # operator: alarm.arm only
    try:
        _as(app, armer)
        n = len(calls)
        r = _act(c, "alarm_control_panel.risco_house", "arm_custom_bypass")
        assert r.status_code == 403 and r.json()["code"] == "forbidden", r.text
        assert len(calls) == n
        assert _act(c, "alarm_control_panel.risco_house", "arm_away").status_code == 202  # plain arming is unchanged
    finally:
        app.dependency_overrides.clear()
    r = _act(c, "alarm_control_panel.risco_house", "arm_custom_bypass")  # the bootstrap administrator holds alarm.bypass
    assert r.status_code == 202, r.text
    assert calls[-1]["service"] == "alarm_arm_custom_bypass" and "on_behalf_of" not in calls[-1]

from test_alarm import _fresh_limits, alarm_app  # noqa: E402,F401  (fixtures)
from automations_fixture import autos_app, rid  # noqa: E402,F401
from test_camera_card import cam_app  # noqa: E402,F401
from test_devices import dev_app  # noqa: E402,F401
from test_ha_camera_live import _no_real_dns, live  # noqa: E402,F401


def test_arm_modes_offer_custom_bypass_only_with_alarm_bypass(alarm_app):
    """The panel list offers `arm_custom_bypass` only to a caller who holds alarm.bypass; the server refusal stays."""
    from test_alarm import _act, _no_code, _panel, _panels
    from smplwise.services import ha_sync as hs

    app, s, c, calls, _ = alarm_app
    eid = "alarm_control_panel.risco_house"
    with app.state.db.connection() as conn:
        now = now_iso()
        hs.upsert_state(conn, {"entity_id": eid, "state": "disarmed", "last_changed": now, "last_updated": now,
                               "attributes": {"friendly_name": "x", "code_format": "number", "code_arm_required": False, "supported_features": 1 | 2 | 4 | 16}})
        conn.execute("INSERT OR IGNORE INTO users(id, username, display_name, source, active, first_seen_at, last_seen_at) VALUES ('u-arm', 'armer', 'Armer', 'remote', 1, ?, ?)", (now, now))
        conn.execute("INSERT INTO bindings(id, subject_kind, subject_id, role_id, scope_type, scope_id, effect, permission_revision, assigned_by, created_at) "
                     "VALUES (?, 'user', 'u-arm', 'operator', 'installation', '*', 'allow', ?, 'test', ?)", (new_id(), permission_revision(conn), now))
        bump_permission_revision(conn)
    _no_code(c, "u-arm")
    _no_code(c)
    armer = Principal(user_id="u-arm", username="armer", display_name="Armer", source="remote", via="cookie")  # alarm.arm only
    try:
        _as(app, armer)
        p = _panel(_panels(c), eid)
        assert p["can"]["arm"] is True and p["can"]["bypass"] is False
        assert "arm_custom_bypass" not in p["arm_modes"] and "arm_away" in p["arm_modes"]  # negative first
        assert _act(c, eid, "arm_custom_bypass").status_code == 403  # the server refusal stays
    finally:
        app.dependency_overrides.clear()
    assert "arm_custom_bypass" in _panel(_panels(c), eid)["arm_modes"]  # the bootstrap administrator holds alarm.bypass
