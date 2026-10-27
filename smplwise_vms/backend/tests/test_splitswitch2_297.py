"""SPLITSWITCH2-297 (owner decision q48, 2026-10-27): the emergency-buttons switch is a SETTING (`doors.emergency.engine_switch`), like the
door-window program switch. Default ON; changed only with the settings-manage permission at the installation; every change audited
(who/when/old/new); turning it OFF needs an explicit confirmation and is refused while an emergency is active; OFF never blocks a release.
The setting is an extra gate on top of the permit and the build flag: it never turns a live engine on by itself. FAKES ONLY."""
from __future__ import annotations

import json

from fake_doorwin_adapters import ProductWorld

from smplwise.services import door_emergency as de
from smplwise.services import door_windows_engine as dwe

KEY = "doors.emergency.engine_switch"


def _put(pw, value, user=None, **extra):
    return pw.put("/doors/emergency/settings", user, changes={KEY: value}, confirmed=True, **extra)


def _value(pw):
    return pw.get("/doors/emergency/settings").json()["settings"][KEY]


def test_default_is_on_and_visible(settings, monkeypatch):
    pw = ProductWorld(settings, monkeypatch, go_live=True)
    assert _value(pw) == "on"
    assert KEY in de.SETTINGS and de.SETTINGS[KEY][0] == "on"


def test_shipped_build_stays_off_even_with_the_switch_on(settings, monkeypatch):
    pw = ProductWorld(settings, monkeypatch, go_live=False)
    assert _value(pw) == "on"
    with pw.db.connection(mode="read") as conn:
        assert de.live_ok(conn) is False and de.enabled(conn) is False  # the switch is a gate, never an activation


def test_turning_off_requires_explicit_confirmation(settings, monkeypatch):
    pw = ProductWorld(settings, monkeypatch, go_live=True)
    r = _put(pw, "off")
    assert r.status_code == 409 and r.json()["code"] == "confirmation_required", r.text
    assert _value(pw) == "on"
    r = _put(pw, "off", confirm_engine_off=False)
    assert r.status_code == 409 and _value(pw) == "on"
    r = _put(pw, "off", confirm_engine_off=True)
    assert r.status_code == 200 and _value(pw) == "off"
    assert _put(pw, "on").status_code == 200 and _value(pw) == "on"  # turning on needs no extra confirmation


def test_off_stops_new_presses_and_back_on_restores(settings, monkeypatch):
    pw = ProductWorld(settings, monkeypatch, go_live=True)
    pw.emergency_on()
    assert _put(pw, "off", confirm_engine_off=True).status_code == 200
    r = pw.press()
    assert r.status_code == 409 and r.json()["code"] == "emergency_off" and pw.emergency.calls == []
    assert pw.get("/doors/emergency/state").json()["enabled"] is False
    assert pw.get("/doors/emergency/settings").json()["settings"]["go_live_permitted"] is False
    assert _put(pw, "on").status_code == 200
    assert pw.press().status_code in (200, 201)


def test_off_refused_while_an_emergency_is_active_and_release_still_works(settings, monkeypatch):
    pw = ProductWorld(settings, monkeypatch, go_live=True)
    pw.emergency_on()
    inc = pw.press().json()["incident"]
    r = _put(pw, "off", confirm_engine_off=True)
    assert r.status_code == 409 and r.json()["code"] == "incident_active" and _value(pw) == "on"
    assert pw.release(inc["id"]).status_code == 200
    assert _put(pw, "off", confirm_engine_off=True).status_code == 200


def test_only_the_settings_manager_can_change_it(settings, monkeypatch):
    pw = ProductWorld(settings, monkeypatch, go_live=True)
    for i, role in enumerate(("viewer", "operator", "site_admin")):
        pw.bind(f"u{i}", role)
        assert _put(pw, "off", f"u{i}", confirm_engine_off=True).status_code == 403, role
    assert _value(pw) == "on"
    assert pw.rows("SELECT id FROM audit_log WHERE action = 'settings.changed' AND resource_id = ?", KEY) == []


def test_the_generic_settings_endpoint_cannot_write_it(settings, monkeypatch):
    pw = ProductWorld(settings, monkeypatch, go_live=True)
    pw.call("PATCH", "/settings", **{KEY: "off"})
    assert _value(pw) == "on"


def test_every_change_is_audited_with_who_when_old_new(settings, monkeypatch):
    pw = ProductWorld(settings, monkeypatch, go_live=True)
    assert _put(pw, "off", confirm_engine_off=True).status_code == 200
    assert _put(pw, "on").status_code == 200
    rows = pw.rows("SELECT at, actor_user_id, actor_username, decision, details_json FROM audit_log WHERE action = 'settings.changed' AND resource_id = ? ORDER BY id", KEY)
    assert len(rows) == 2
    for row, (before, after) in zip(rows, (("on", "off"), ("off", "on"))):
        assert row["decision"] == "allowed" and row["at"] and row["actor_user_id"] and row["actor_username"]
        assert json.loads(row["details_json"]) == {"key": KEY, "before": before, "after": after}
    assert _put(pw, "on").status_code == 200  # no change -> no extra row
    assert len(pw.rows("SELECT id FROM audit_log WHERE action = 'settings.changed' AND resource_id = ?", KEY)) == 2


def test_an_invalid_value_is_refused(settings, monkeypatch):
    pw = ProductWorld(settings, monkeypatch, go_live=True)
    assert _put(pw, "maybe").status_code == 422 and _value(pw) == "on"


def test_a_refused_off_is_audited_denied(settings, monkeypatch):
    pw = ProductWorld(settings, monkeypatch, go_live=True)
    pw.emergency_on()
    inc = pw.press().json()["incident"]
    _put(pw, "off", confirm_engine_off=True)
    assert any(x["decision"] == "denied" for x in pw.rows("SELECT decision FROM audit_log WHERE action = 'settings.changed'"))
    assert pw.release(inc["id"]).status_code == 200


def test_readers_of_the_flag_tolerate_it_being_off(settings, monkeypatch):
    pw = ProductWorld(settings, monkeypatch, go_live=True)
    pw.emergency_on()
    assert _put(pw, "off", confirm_engine_off=True).status_code == 200
    with pw.db.connection(mode="read") as conn:
        assert de.live_ok(conn) is False and de.enabled(conn) is False and de.open_enabled(conn, pw.settings) is False
        assert de.open_available(pw.settings, conn) is False
    assert pw.get("/doors/emergency/state").status_code == 200
    assert pw.get("/doors/emergency/settings").json()["settings"]["open_available"] is False
    assert pw.get("/doors/windows/state").json()["go_live_permitted"] is True  # the program switch is independent
    assert dwe.emergency_ready() is True, "the build-level helper is unchanged (no connection)"


def test_off_does_not_change_the_door_window_programs(settings, monkeypatch):
    pw = ProductWorld(settings, monkeypatch, go_live=True)
    assert _put(pw, "off", confirm_engine_off=True).status_code == 200
    pw.windows_on()
    assert pw.get("/doors/windows/state").json()["enabled"] is True
