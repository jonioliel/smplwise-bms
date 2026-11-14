"""DOORWIN-295 (CR-039 7, 10.4, 12, 13): the door-windows HTTP surface - Arx RBAC as the only authority, switches OFF, confirmation,
validation, audit. Negative first. Fakes only (the door directory is a fixed list; the engine is tier D unless a test plugs the W0 fake)."""
from __future__ import annotations

import json

import pytest
from fake_doorwin_adapters import ProductWorld
from fake_doorwin_asserts import find_secrets


@pytest.fixture()
def pw(settings, monkeypatch):
    return ProductWorld(settings, monkeypatch, go_live=False)


# ---------------------------------------------------------------- shipped off

def test_everything_ships_off(pw):
    s = pw.get("/doors/windows/settings").json()["settings"]
    assert s["doors.windows.enabled"] == "off" and s["doors.windows.exterior_allowed"] == "false"
    e = pw.get("/doors/emergency/settings").json()["settings"]
    assert (e["doors.emergency.enabled"], e["doors.emergency.open_enabled"], e["doors.emergency.automations"]) == ("off", "off", "off")
    # DOORLIVE-2310: `pw` models the rollback build (engine flags off): nothing can act
    assert e["go_live_permitted"] is False and e["open_available"] is False and e["lock_available"] is False
    st = pw.get("/doors/windows/state").json()
    assert st["enabled"] is False and st["tier"] == "prepared" and st["go_live_permitted"] is False


def test_the_emergency_switch_cannot_be_turned_on_in_this_build(pw):
    from smplwise.services import door_windows_engine as dwe

    # DWFIX-295 (review 3 DW-01 / DW-08): the SHIPPED constants, not a patched permit - the permit is in, the live engine is not built
    assert dwe.GO_LIVE_PERMITTED is True and dwe.LIVE_ENGINE_BUILT is False
    e = pw.get("/doors/emergency/settings").json()["settings"]
    assert e["go_live_permitted"] is False and e["live_engine_built"] is False
    r = pw.put("/doors/emergency/settings", changes={"doors.emergency.enabled": "on"}, confirmed=True)
    assert r.status_code == 409 and r.json()["code"] == "engine_not_implemented"
    assert pw.put("/doors/emergency/settings", changes={"doors.emergency.automations": "on"}, confirmed=True).json()["code"] == "automation_actor_unavailable"
    assert pw.put("/doors/emergency/settings", changes={"doors.emergency.open_enabled": "on"}, confirmed=True).json()["code"] == "open_unavailable"
    assert pw.get("/doors/emergency/settings").json()["settings"]["doors.emergency.enabled"] == "off"
    assert any(r["decision"] == "denied" for r in pw.rows("SELECT decision FROM audit_log WHERE action = 'settings.changed'"))


def test_settings_need_system_configure_and_a_confirmation(pw):
    pw.bind("sara", "site_admin")
    assert pw.put("/doors/windows/settings", "sara", changes={"doors.windows.enabled": "on"}, confirmed=True).status_code == 403
    assert pw.put("/doors/windows/settings", changes={"doors.windows.enabled": "on"}).status_code == 409
    assert pw.put("/doors/windows/settings", changes={"doors.windows.enabled": "maybe"}, confirmed=True).status_code == 422
    assert pw.put("/doors/windows/settings", changes={"doors.windows.max_hours": "13"}, confirmed=True).status_code == 422
    r = pw.put("/doors/windows/settings", changes={"doors.windows.enabled": "on"}, confirmed=True)
    assert r.status_code == 200 and r.json()["changed"] == ["doors.windows.enabled"]
    row = pw.rows("SELECT details_json FROM audit_log WHERE action = 'settings.changed' AND resource_id = 'doors.windows.enabled'")[0]
    assert json.loads(row["details_json"]) == {"key": "doors.windows.enabled", "before": "off", "after": "on"}


# ---------------------------------------------------------------- RBAC: who may define windows

def test_permission_defaults(pw):
    from smplwise.rbac import ROLES

    assert {r for r, p in ROLES.items() if "access.windows.manage" in p} == {"site_admin", "system_admin", "door_windows_manager"}
    assert {r for r, p in ROLES.items() if "access.windows.cancel" in p} == {"operator", "site_admin", "system_admin", "door_windows_guard"}
    assert {r for r, p in ROLES.items() if "access.emergency.lock" in p} == {"site_admin", "system_admin", "emergency_lock"}
    assert {r for r, p in ROLES.items() if "access.emergency.open" in p} == {"system_admin", "emergency_open"}, "owner decision: system administrators only among the built-in roles (+ the single-permission grant role)"
    labels = pw.get("/access/roles").json()
    for p in ("access.windows.manage", "access.windows.cancel", "access.emergency.lock", "access.emergency.open"):
        assert labels["labels"][p] and p in labels["sensitive"]


@pytest.mark.parametrize("role, status", [("viewer", 403), ("operator", 403), ("door_opener", 403), ("editor", 403), ("site_admin", 201)])
def test_who_may_create_a_rule(pw, role, status):
    pw.bind("u1", role)
    assert pw.rule(user="u1", enable=False).status_code == status


def test_a_station_scoped_manager_cannot_reach_another_station(pw):
    rid = pw.role("מנהל חלונות עמדה", ["access.windows.manage"])
    pw.bind("stan", rid, "access_control_station", pw.ENTRY)
    assert pw.rule(user="stan", doors=[(pw.ENTRY, 1)], enable=False).status_code == 201
    r = pw.rule(user="stan", doors=[(pw.ENTRY, 1), (pw.SIDE, 1)], enable=False)
    assert r.status_code == 403
    assert any(a == "door.window.rule_saved" for a in [x["action"] for x in pw.rows("SELECT action FROM audit_log WHERE decision = 'denied'")])
    doors = pw.get("/doors/windows/state", "stan").json()["doors"]
    assert [d["key"] for d in doors if d["manage"]] == [f"{pw.ENTRY}:1"]


def test_a_deny_on_the_station_wins(pw):
    pw.bind("sara", "site_admin")
    pw.bind("sara", "site_admin", "access_control_station", pw.SIDE, effect="deny")
    assert pw.rule(user="sara", doors=[(pw.SIDE, 1)], enable=False).status_code == 403
    assert pw.rule(user="sara", doors=[(pw.ENTRY, 1)], enable=False).status_code == 201


def test_editing_needs_the_permission_on_the_old_doors_too(pw):
    r = pw.rule(doors=[(pw.SIDE, 1)], enable=False)
    rid_ = r.json()["rule"]["id"]
    role = pw.role("מנהל חלונות עמדה", ["access.windows.manage"])
    pw.bind("stan", role, "access_control_station", pw.ENTRY)
    r = pw.put(f"/doors/windows/rules/{rid_}", "stan", name="x", kind="weekly", doors=[{"station_id": pw.ENTRY, "relay": 1}],
               periods=[{"weekday": 1, "start": "08:00", "end": "09:00"}], confirmed=True)
    assert r.status_code == 403, "moving a rule off a door one cannot manage is not allowed"


def test_a_wall_or_kiosk_account_is_refused_even_with_the_permission(pw):
    pw.bind("wall1", "site_admin")
    pw.bind("wall1", "kiosk")
    r = pw.rule(user="wall1", enable=False)
    assert r.status_code == 403 and r.json()["details"]["reason"] == "wall_account"


def test_a_write_needs_the_confirmation(pw):
    r = pw.post("/doors/windows/rules", name="x", kind="weekly", doors=[{"station_id": pw.ENTRY, "relay": 1}],
                periods=[{"weekday": 1, "start": "08:00", "end": "09:00"}])
    assert r.status_code == 409 and r.json()["code"] == "confirmation_required"


def test_an_unknown_door_and_an_exterior_door_are_refused(pw):
    assert pw.rule(doors=[("st-nowhere", 1)], enable=False).json()["code"] == "door_unknown"
    assert pw.put(f"/doors/windows/doors/{pw.DOCK}/2/flags", exterior=True, confirmed=True).status_code == 200
    assert pw.rule(doors=[(pw.DOCK, 2)], enable=False).json()["code"] == "exterior_not_allowed"
    pw.put("/doors/windows/settings", changes={"doors.windows.exterior_allowed": "true"}, confirmed=True)
    assert pw.rule(doors=[(pw.DOCK, 2)], enable=False).status_code == 201


def test_the_rule_lifecycle_is_audited_and_versioned(pw):
    r = pw.rule(enable=False)
    rid_ = r.json()["rule"]["id"]
    assert r.json()["rule"]["state"] == "draft"
    for action, st in (("enable", "enabled"), ("pause", "paused"), ("enable", "enabled"), ("retire", "retired")):
        x = pw.post(f"/doors/windows/rules/{rid_}/{action}", confirmed=True)
        assert x.status_code == 200 and x.json()["rule"]["state"] == st
    assert pw.post(f"/doors/windows/rules/{rid_}/enable", confirmed=True).status_code == 404, "a retired rule stays retired"
    acts = pw.audit_actions("door.window.rule")
    assert acts == ["door.window.rule_saved", "door.window.rule_enabled", "door.window.rule_paused", "door.window.rule_enabled", "door.window.rule_retired"]
    assert len(pw.rows("SELECT * FROM door_window_rule_versions WHERE rule_id = ?", rid_)) == 1


def test_a_stale_revision_is_a_conflict(pw):
    r = pw.rule(enable=False).json()["rule"]
    body = dict(name="x", kind="weekly", doors=[{"station_id": pw.ENTRY, "relay": 1}], periods=[{"weekday": 1, "start": "08:00", "end": "09:00"}], confirmed=True)
    assert pw.put(f"/doors/windows/rules/{r['id']}", revision=r["revision"], **body).status_code == 200
    assert pw.put(f"/doors/windows/rules/{r['id']}", revision=r["revision"], **body).json()["code"] == "revision_conflict"


def test_preview_shows_the_next_week_without_saving(pw):
    r = pw.post("/doors/windows/rules/preview", name="x", kind="weekly", doors=[{"station_id": pw.ENTRY, "relay": 1}],
                periods=[{"weekday": d, "start": "08:00", "end": "09:00"} for d in range(7)])
    assert r.status_code == 200, r.text
    (door,) = r.json()["doors"]
    assert len(door["occurrences"]) == 7 and door["errors"] == []
    assert pw.rows("SELECT COUNT(*) AS n FROM door_window_rules")[0]["n"] == 0


def test_the_state_lists_only_visible_doors_and_rules(pw):
    pw.rule(doors=[(pw.SIDE, 1)], enable=False)
    pw.bind("vered", "viewer")
    st = pw.get("/doors/windows/state", "vered").json()
    assert st["doors"] == [] and st["rules"] == [] and st["can"] == {"manage": False, "cancel": False, "configure": False}
    pw.bind("oren", "operator")
    st = pw.get("/doors/windows/state", "oren").json()
    assert len(st["doors"]) == 4 and st["can"]["cancel"] and not st["can"]["manage"] and len(st["rules"]) == 1


def test_calendar_needs_manage_at_the_installation(pw):
    rid = pw.role("מנהל חלונות עמדה", ["access.windows.manage"])
    pw.bind("stan", rid, "access_control_station", pw.ENTRY)
    days = [{"on_date": "2026-12-25", "day_type": "closed", "label": "סגור"}]
    assert pw.put("/doors/windows/calendar", "stan", days=days, confirmed=True).status_code == 403
    assert pw.put("/doors/windows/calendar", days=days, confirmed=True).status_code == 200
    assert pw.get("/doors/windows/calendar").json()["days"][0]["day_type"] == "closed"
    assert pw.put("/doors/windows/calendar", days=[{"on_date": "2026-12-25", "day_type": "none"}], confirmed=True).status_code == 200
    assert pw.get("/doors/windows/calendar").json()["days"] == []


def test_nothing_secret_lands_in_the_audit_or_the_answers(pw):
    pw.put("/doors/windows/settings", changes={"doors.windows.enabled": "on"}, confirmed=True)
    answers = [pw.rule().text, pw.get("/doors/windows/state").text]
    rows = pw.rows("SELECT details_json FROM audit_log WHERE action LIKE 'door.%'")
    assert find_secrets(answers + [r["details_json"] or "" for r in rows]) == []
