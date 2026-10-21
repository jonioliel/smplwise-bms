"""GENALERT-295: who is told about a generator alert is an administrator's choice (per alert type or per severity), a type's escalation and quiet-hours
choices are applied, CRITICAL always escalates to the system administrators and is never held by quiet hours.

Lab finding behind it (NMC site, 2026-10-20): no routing saved = normal-severity alerts reached nobody; the per-type `escalate` / `quiet_mode` choices were
stored but never read. Migration 0131 (built as PROVISIONAL 0141; renumbered at integ/2100)."""
from __future__ import annotations

import datetime as dt
import json

import pytest
from conftest import as_user, bind
from fastapi.testclient import TestClient
from generator_world import make_generator, set_state

from smplwise.db import Database
from smplwise.services import generator_alerts as alerts
from smplwise.services import generator_runtime as runtime
from smplwise.services import notify
from smplwise.services import notify_channels as nch
from smplwise.services import notify_settings as nsettings
from test_generator import API, T0, detect, evaluate, gid, rows


@pytest.fixture()
def app(settings):
    from smplwise.main import create_app
    from smplwise.services import ha_sync

    ha_sync.STATE.connected = False
    alerts.reset()
    runtime.reset()
    c = TestClient(create_app(settings))
    c.get("/api/v1/me")
    return c, Database(settings.db_path), settings


def _full(db, **states):
    make_generator(db, "full", model="DSE7320")
    detect(db)
    for k, v in states.items():
        set_state(db, "sensor.gen_" + k, v)
    return gid(db)


def _fire(db, key_state: tuple[str, str], at: float = T0) -> None:
    set_state(db, "sensor.gen_" + key_state[0], key_state[1])
    evaluate(db, at)
    evaluate(db, at + 61)


def _note(db, like: str):
    return rows(db, "SELECT * FROM notifications WHERE source LIKE ?", like)[0]


def _recipients(db, nid: str) -> set[str]:
    return {r["user_id"] for r in rows(db, "SELECT user_id FROM notification_recipients WHERE notification_id = ?", nid)}


def _uid(db, username: str) -> str:
    return rows(db, "SELECT id FROM users WHERE username = ?", username)[0]["id"]


# ---------------------------------------------------------------- recipients per severity

def test_first_run_nobody_configured_and_the_critical_delay_is_shown(app):
    c, db, _ = app
    g = _full(db)
    pol = c.get(f"{API}/devices/{g}/policies").json()
    assert pol["severity_defaults"] == {"critical": None, "alert": None, "info": None}
    assert pol["critical_escalate_after_min"] == 5 and pol["severity_channels"] == ["push", "app", "email"]
    assert all(i["policy"] is None for i in pol["items"])


def test_severity_default_reaches_the_roles_users_and_channels_chosen(app):
    c, db, settings = app
    g = _full(db)
    bind(c, settings, "ops", "operator", "installation", "*")
    bind(c, settings, "vera", "viewer", "installation", "*")
    _fire(db, ("fuel", "10"))  # low fuel: severity alert, no routing yet -> in the centre only
    n = _note(db, "generator.low_fuel@%")
    assert _recipients(db, n["id"]) == set()
    r = c.put(f"{API}/devices/{g}/severity-routing/alert", json={"recipients": {"roles": ["operator"], "users": []}, "channels": ["push", "email"]})
    assert r.status_code == 200 and r.json()["channels"] == ["push", "email"] and r.json()["row_version"] == 1
    src = rows(db, "SELECT * FROM notify_policies WHERE source LIKE 'generator.low_fuel@%'")[0]
    assert json.loads(src["channels_json"])["webpush"] is True and json.loads(src["channels_json"])["email"] is True and json.loads(src["channels_json"])["app"] is False
    # the next alert of that severity (a new episode) reaches the operator; the viewer (no generator.view) never
    set_state(db, "sensor.gen_fuel", "80")
    evaluate(db, T0 + 200)
    _fire(db, ("fuel", "9"), T0 + 2000)
    n2 = [x for x in rows(db, "SELECT * FROM notifications WHERE source LIKE 'generator.low_fuel@%' ORDER BY created_at")][-1]
    assert _recipients(db, n2["id"]) == {_uid(db, "ops")}


def test_a_type_with_its_own_recipients_wins_and_an_empty_one_inherits(app):
    c, db, settings = app
    g = _full(db)
    bind(c, settings, "ops", "operator", "installation", "*")
    bind(c, settings, "sam", "site_admin", "installation", "*")
    assert c.put(f"{API}/devices/{g}/severity-routing/alert", json={"recipients": {"roles": ["operator"], "users": []}}).status_code == 200
    with db.connection(mode="read") as conn:
        eff = alerts.effective_routing(conn, g, "low_fuel")
        assert eff["recipients"]["roles"] == ["operator"] and eff["inherited"] is True
    assert c.put(f"{API}/devices/{g}/policies/low_fuel", json={"recipients": {"roles": ["site_admin"], "users": []}}).status_code == 200
    with db.connection(mode="read") as conn:
        eff = alerts.effective_routing(conn, g, "low_fuel")
        assert eff["recipients"]["roles"] == ["site_admin"] and eff["inherited"] is False
        assert alerts.effective_routing(conn, g, "fuel_shutdown") is not None  # another type still inherits
    _fire(db, ("fuel", "10"))
    n = _note(db, "generator.low_fuel@%")
    assert _recipients(db, n["id"]) == {_uid(db, "sam")}
    # switched off = nobody, whatever the severity default says
    assert c.put(f"{API}/devices/{g}/policies/low_fuel", json={"enabled": False}).status_code == 200
    with db.connection(mode="read") as conn:
        assert alerts.effective_routing(conn, g, "low_fuel") is None


def test_severity_routing_validation_permissions_conflict_and_reset(app):
    c, db, settings = app
    g = _full(db)
    bind(c, settings, "vera", "viewer", "installation", "*")
    url = f"{API}/devices/{g}/severity-routing/critical"
    assert c.put(url, json={"channels": ["whatsapp"]}).status_code == 422  # WhatsApp is chosen per alert type, never as a severity default
    assert c.put(url, json={"channels": ["ha_mobile"]}).status_code == 422
    assert c.put(url, json={"recipients": {"roles": ["viewer"], "users": []}}).status_code == 422
    assert c.put(url, json={"recipients": {"roles": [], "users": ["nobody"]}}).status_code == 422
    assert c.put(f"{API}/devices/{g}/severity-routing/loud", json={"channels": []}).status_code == 404
    assert c.put(url, json={"channels": ["push"]}, headers=as_user("vera")).status_code == 403
    assert c.put(url, json={"channels": ["push"]}).json()["row_version"] == 1
    assert c.put(url, json={"channels": ["push", "app"], "row_version": 1}).json()["row_version"] == 2
    assert c.put(url, json={"channels": [], "row_version": 1}).status_code == 409
    assert c.get(f"{API}/devices/{g}/policies").json()["severity_defaults"]["critical"]["channels"] == ["push", "app"]
    assert c.post(f"{API}/devices/{g}/policies/reset").status_code == 200
    assert rows(db, "SELECT * FROM generator_severity_routing") == []
    assert rows(db, "SELECT 1 FROM notify_policies WHERE source LIKE 'generator.%@%'") == []


# ---------------------------------------------------------------- escalation

def _make_critical(c, g):
    assert c.put(f"{API}/devices/{g}/policies/battery_low", json={"severity": "critical"}).status_code == 200


def test_critical_always_escalates_even_when_the_type_escalate_choice_is_off(app):
    c, db, _ = app
    g = _full(db)
    _make_critical(c, g)
    _fire(db, ("battery", "10.5"))
    n = _note(db, "generator.battery_low@%")
    assert n["severity"] == "critical" and n["escalate_at"] is not None
    t0 = notify.now_utc()
    with db.connection() as conn:
        assert notify.escalation_tick(conn, t0 + dt.timedelta(minutes=4)) == 0
    with db.connection() as conn:
        assert notify.escalation_tick(conn, t0 + dt.timedelta(minutes=6)) == 1
    assert "dev-joni" in _recipients(db, n["id"])  # the system administrator, added by the escalation


def test_the_critical_delay_is_configurable_and_a_type_delay_overrides_it(app):
    c, db, _ = app
    g = _full(db)
    assert c.put(f"{API}/settings", json={"critical_escalate_after_min": 2}).json()["critical_escalate_after_min"] == 2
    assert c.put(f"{API}/settings", json={"critical_escalate_after_min": 5000}).status_code == 422
    _make_critical(c, g)
    _fire(db, ("battery", "10.5"))
    n = _note(db, "generator.battery_low@%")
    t0 = notify.now_utc()
    with db.connection() as conn:
        assert notify.escalation_tick(conn, t0 + dt.timedelta(minutes=1)) == 0
        assert notify.escalation_tick(conn, t0 + dt.timedelta(minutes=3)) == 1
    # a type of its own: escalate on, 20 minutes
    assert c.put(f"{API}/devices/{g}/policies/battery_low", json={"escalate": True, "escalate_after_s": 1200}).status_code == 200
    with db.connection() as conn:
        assert alerts.escalation_after_min(conn, f"generator.battery_low@{g}", "critical") == 20
        assert alerts.escalation_after_min(conn, f"generator.battery_low@{g}", "alert") == 20
        assert alerts.escalation_after_min(conn, f"generator.other@{g}", "critical") == 2


def test_non_critical_escalates_only_when_the_type_choice_is_on_and_critical_ignores_the_installation_switch(app):
    c, db, _ = app
    g = _full(db)
    with db.connection() as conn:  # the installation escalation switched OFF by an administrator
        nsettings.ensure_row(conn)
        conn.execute("UPDATE notify_settings SET escalation_json = ? WHERE id = 1", (json.dumps({"enabled": False, "after_min": 5, "steps": 2, "to": "managers"}),))
    _fire(db, ("fuel", "10"))  # low fuel, severity alert, escalate off
    assert _note(db, "generator.low_fuel@%")["escalate_at"] is None
    assert c.put(f"{API}/devices/{g}/policies/low_fuel", json={"escalate": True, "escalate_after_s": 600}).status_code == 200
    set_state(db, "sensor.gen_fuel", "80")
    evaluate(db, T0 + 200)
    _fire(db, ("fuel", "9"), T0 + 5000)
    n = rows(db, "SELECT * FROM notifications WHERE source LIKE 'generator.low_fuel@%' AND state = 'open'")[0]
    assert n["escalate_at"] is not None
    t0 = notify.now_utc()
    with db.connection() as conn:
        assert notify.escalation_tick(conn, t0 + dt.timedelta(minutes=9)) == 0
        assert notify.escalation_tick(conn, t0 + dt.timedelta(minutes=11)) == 1
    assert "dev-joni" in _recipients(db, n["id"])
    _make_critical(c, g)
    _fire(db, ("battery", "10.5"), T0 + 9000)
    nb = _note(db, "generator.battery_low@%")
    assert nb["escalate_at"] is not None  # CRITICAL still escalates with the installation switch off


def test_other_sources_keep_the_installation_rule(app):
    c, db, _ = app
    with db.connection(mode="read") as conn:
        assert nsettings.load(conn)["escalation"]["enabled"] is True
        assert notify._escalate_at(conn, "alert", notify.now_utc(), "camera.offline") is None
        assert notify._escalate_at(conn, "critical", notify.now_utc(), "sensor.leak") is not None


# ---------------------------------------------------------------- quiet hours


def test_quiet_hours_choice_is_applied_and_critical_is_never_held(app):
    c, db, _ = app
    g = _full(db)
    with db.connection(mode="read") as conn:
        base = nsettings.load(conn)
        d = nch.Dispatch("n1", "new", {"source": f"generator.low_fuel@{g}", "subject_id": g, "severity": "alert"}, {}, base, "UTC", notify.now_utc(), True, [], {})
        d._conn = conn
        assert d.held("webpush") is True  # no choice: the severity x channel matrix (alert is held at night by default)
    assert c.put(f"{API}/devices/{g}/policies/low_fuel", json={"quiet_mode": "pass"}).status_code == 200
    assert c.put(f"{API}/devices/{g}/policies/fuel_shutdown", json={"quiet_mode": "hold", "severity": "critical"}).status_code == 200
    with db.connection(mode="read") as conn:
        base = nsettings.load(conn)
        base["pass_through"]["critical"]["webpush"] = False  # even an administrator's matrix cannot hold a critical generator alert

        def held(key: str, sev: str, quiet: bool = True, mode: str = "new") -> bool:
            d = nch.Dispatch("n1", mode, {"source": f"generator.{key}@{g}", "subject_id": g, "severity": sev}, {}, base, "UTC", notify.now_utc(), quiet, [], {})
            d._conn = conn
            return d.held("webpush")

        assert held("low_fuel", "alert") is False  # pass
        assert held("low_fuel", "alert", quiet=False) is False
        assert held("fuel_shutdown", "critical") is False  # hold, but critical
        assert held("battery_low", "critical") is False
        assert held("low_fuel", "alert", mode="escalate") is False
        d_other = nch.Dispatch("n1", "new", {"source": "camera.offline", "subject_id": "x", "severity": "alert"}, {}, base, "UTC", notify.now_utc(), True, [], {})
        d_other._conn = conn
        assert d_other.held("webpush") is True  # other sources keep the matrix
    with db.connection(mode="read") as conn:
        pol = conn.execute("SELECT quiet_mode FROM generator_alert_policies WHERE alert_key = 'fuel_shutdown'").fetchone()
        assert pol["quiet_mode"] == "hold"  # stored as chosen, ignored while the alert is critical


def test_hold_holds_a_non_critical_alert_even_if_the_matrix_would_pass_it(app):
    c, db, _ = app
    g = _full(db)
    assert c.put(f"{API}/devices/{g}/policies/low_fuel", json={"quiet_mode": "hold"}).status_code == 200
    with db.connection(mode="read") as conn:
        base = nsettings.load(conn)
        base["pass_through"]["alert"]["webpush"] = True
        d = nch.Dispatch("n1", "new", {"source": f"generator.low_fuel@{g}", "subject_id": g, "severity": "alert"}, {}, base, "UTC", notify.now_utc(), True, [], {})
        d._conn = conn
        assert d.held("webpush") is True


def test_after_s_stays_the_fire_delay_and_the_editor_field_is_escalate_after_s(app):
    c, db, _ = app
    g = _full(db)
    r = c.put(f"{API}/devices/{g}/policies/low_fuel", json={"escalate": True, "escalate_after_s": 900})
    assert r.status_code == 200 and r.json()["escalate_after_s"] == 900 and r.json()["after_s"] == 0
    assert c.put(f"{API}/devices/{g}/policies/low_fuel", json={"escalate_after_s": -5}).status_code == 422
