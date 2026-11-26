"""DATA-RULES-2540: the generator data rules of the 2.52 deep review.

- D-02 / SCR-21: the starter battery's nominal system (12 V / 24 V) is the device's - the administrator's choice, else latched once the bank
  was seen above 16 V (also from the stored history) - never guessed from one sample. A 24 V bank that sags to 15.8 V stays a LOW battery
  (before: judged against the 12 V threshold and cleared as healthy). The device answer carries `battery_system_v` so the dial
  (gen-logic.ts batterySystem) applies the same rule.
- D-03: muting a CRITICAL type needs generator.manage and lasts at most MUTE_CRITICAL_MAX_H hours (before: any generator.view holder, up to
  7 days); a mute can be ended (DELETE .../mute, audited); an alert raised while muted is notified when the mute ends (before: never).
A fake controller only (tests/generator_world.py): no infrastructure, no device."""
from __future__ import annotations

import datetime as dt
import json

import pytest
from conftest import as_user, bind
from fastapi.testclient import TestClient
from generator_world import make_generator, set_state

from smplwise.db import Database
from smplwise.services import generator_alerts as alerts
from smplwise.services import generator_core as core
from smplwise.services import generator_runtime as runtime

API = "/api/v1/generator"
T0 = dt.datetime(2026, 10, 5, 9, 0, tzinfo=dt.timezone.utc).timestamp()


@pytest.fixture()
def app(settings):
    from smplwise.main import create_app
    from smplwise.services import ha_sync

    ha_sync.STATE.connected = False
    alerts.reset()
    runtime.reset()
    c = TestClient(create_app(settings))
    c.get("/api/v1/me")  # joni becomes system_admin (bootstrap)
    return c, Database(settings.db_path), settings


def _gen(db, level: str = "full") -> str:
    make_generator(db, level, model="DSE7320")
    with db.connection() as conn:
        core.detect(conn)
    with db.connection(mode="read") as conn:
        return conn.execute("SELECT id FROM generator_devices WHERE status <> 'removed'").fetchone()["id"]


def evaluate(db, ts: float):
    with db.connection() as conn:
        return alerts.evaluate(conn, ts)


def rows(db, sql: str, *a):
    with db.connection(mode="read") as conn:
        return conn.execute(sql, a).fetchall()


def _open(db, key: str):
    return rows(db, "SELECT * FROM generator_alerts WHERE alert_key = ? AND cleared_at IS NULL", key)


# ---------------------------------------------------------------- D-02 / SCR-21: the battery system

def test_pure_rule_is_the_one_boundary():
    assert core.battery_system(None, 12.6) == 12 and core.battery_system(None, 16.0) == 12 and core.battery_system(None, 16.1) == 24
    assert core.battery_system(24, 12.0) == 24 and core.battery_system(12, 27.0) == 12
    assert core.battery_known(None) is None and core.battery_known({"seen_24": True}) == 24
    assert core.battery_known({"seen_24": True, "nominal": 12}) == 12 and core.battery_known({"nominal": 7}) is None


def test_a_sagging_24v_bank_stays_low_and_is_not_cleared(app):
    c, db, _ = app
    g = _gen(db)
    set_state(db, "sensor.gen_battery", "26.9")
    evaluate(db, T0)  # a healthy 24 V bank: nothing, and the system is latched
    assert c.get(f"{API}/devices/{g}").json()["battery_system_v"] == 24
    set_state(db, "sensor.gen_battery", "22.9")
    evaluate(db, T0 + 10)
    evaluate(db, T0 + 80)
    assert len(_open(db, "battery_low")) == 1
    set_state(db, "sensor.gen_battery", "15.8")  # the bank keeps failing: before the fix the 12 V threshold applied and the alert cleared
    r = evaluate(db, T0 + 100)
    assert r["cleared"] == 0 and len(_open(db, "battery_low")) == 1
    assert rows(db, "SELECT state FROM notifications WHERE source LIKE 'generator.battery_low@%'")[0]["state"] == "open"
    set_state(db, "sensor.gen_battery", "27.2")  # charged again: cleared
    assert evaluate(db, T0 + 130)["cleared"] == 1


def test_a_bank_already_sagging_at_start_is_latched_from_the_history(app):
    c, db, _ = app
    g = _gen(db)
    with db.connection() as conn:  # the stored history of the last days holds 24 V readings; the engine never ran in this process
        conn.execute("INSERT INTO generator_samples_5m(device_id, role, ts, v_avg, v_min, v_max, n) VALUES (?,?,?,?,?,?,1)", (g, "battery_v", int(T0) - 86400, 26.5, 26.1, 26.8))
    set_state(db, "sensor.gen_battery", "14.2")
    evaluate(db, T0)
    evaluate(db, T0 + 61)
    assert len(_open(db, "battery_low")) == 1  # 14.2 V on a 24 V bank is low (on a 12 V bank it would be healthy)
    stored = json.loads(rows(db, "SELECT value FROM settings WHERE key = ?", core.BATTERY_KEY)[0]["value"])
    assert stored[g]["seen_24"] is True and c.get(f"{API}/devices/{g}").json()["battery_system_v"] == 24


def test_a_12v_bank_is_unchanged_and_the_choice_is_a_setting(app):
    c, db, _ = app
    g = _gen(db)
    set_state(db, "sensor.gen_battery", "13.4")
    evaluate(db, T0)
    evaluate(db, T0 + 61)
    assert not _open(db, "battery_low") and c.get(f"{API}/devices/{g}").json()["battery_system_v"] is None
    # the administrator says it is a 24 V bank: 13.4 V is now low; null goes back to detection
    d = c.put(f"{API}/devices/{g}", json={"battery_nominal_v": 24}).json()
    assert d["battery_nominal_v"] == 24 and d["battery_system_v"] == 24
    evaluate(db, T0 + 70)
    evaluate(db, T0 + 140)
    assert len(_open(db, "battery_low")) == 1
    assert c.put(f"{API}/devices/{g}", json={"battery_nominal_v": 18}).status_code == 422
    d = c.put(f"{API}/devices/{g}", json={"battery_nominal_v": None}).json()
    assert d["battery_nominal_v"] is None and d["battery_system_v"] is None
    assert rows(db, "SELECT 1 FROM audit_log WHERE action = 'generator.device.update' AND details_json LIKE '%battery_nominal_v%'")
    # an operator may not choose it
    bind(c, app[2], "ops", "operator", "installation", "*")
    assert c.put(f"{API}/devices/{g}", json={"battery_nominal_v": 12}, headers=as_user("ops")).status_code == 403


# ---------------------------------------------------------------- D-03: the mute

def _critical(db, g):
    """Low oil pressure while running: a CRITICAL type."""
    set_state(db, "sensor.gen_engine_state", "Running")
    set_state(db, "sensor.gen_oil", "0.2")
    evaluate(db, T0)
    evaluate(db, T0 + 30)
    open_ = _open(db, "low_oil_pressure")
    assert len(open_) == 1 and open_[0]["severity"] == "critical"
    return open_[0]["id"]


def test_critical_mute_needs_manage_and_is_capped(app):
    c, db, settings = app
    g = _gen(db)
    aid = _critical(db, g)
    bind(c, settings, "ops", "operator", "installation", "*")
    r = c.post(f"{API}/alerts/{aid}/mute", json={"hours": 168}, headers=as_user("ops"))
    assert r.status_code == 403 and not rows(db, "SELECT 1 FROM generator_mutes")
    # the administrator mutes it: 168 h asked, MUTE_CRITICAL_MAX_H applied
    r = c.post(f"{API}/alerts/{aid}/mute", json={"hours": 168})
    assert r.status_code == 200
    until = dt.datetime.fromisoformat(r.json()["muted_until"].replace("Z", "+00:00"))
    left = (until - dt.datetime.now(dt.timezone.utc)).total_seconds() / 3600
    assert alerts.MUTE_CRITICAL_MAX_H - 0.1 < left <= alerts.MUTE_CRITICAL_MAX_H + 0.01
    a = json.loads(rows(db, "SELECT details_json FROM audit_log WHERE action = 'generator.alert.mute'")[-1]["details_json"])
    assert a["critical"] is True and a["hours"] == alerts.MUTE_CRITICAL_MAX_H and a["requested_hours"] == 168


def test_a_non_critical_mute_stays_with_the_operator(app):
    c, db, settings = app
    _gen(db)
    set_state(db, "sensor.gen_fuel", "18")
    evaluate(db, T0)
    evaluate(db, T0 + 61)
    aid = _open(db, "low_fuel")[0]["id"]
    bind(c, settings, "ops", "operator", "installation", "*")
    r = c.post(f"{API}/alerts/{aid}/mute", json={"hours": 48}, headers=as_user("ops"))
    assert r.status_code == 200
    left = (dt.datetime.fromisoformat(r.json()["muted_until"].replace("Z", "+00:00")) - dt.datetime.now(dt.timezone.utc)).total_seconds() / 3600
    assert left > 47


def test_unmute_and_a_muted_alert_is_told_when_the_mute_ends(app):
    c, db, settings = app
    _gen(db)
    set_state(db, "sensor.gen_fuel", "18")
    evaluate(db, T0)
    evaluate(db, T0 + 61)
    first = _open(db, "low_fuel")[0]
    assert first["notification_id"]
    assert c.post(f"{API}/alerts/{first['id']}/mute", json={"hours": 24}).status_code == 200
    # the condition clears and comes back past the fold window while muted: a new row, nobody told
    set_state(db, "sensor.gen_fuel", "80")
    evaluate(db, T0 + 100)
    set_state(db, "sensor.gen_fuel", "18")
    evaluate(db, T0 + 2000)
    evaluate(db, T0 + 2100)
    second = _open(db, "low_fuel")[0]
    assert second["id"] != first["id"] and second["notification_id"] is None
    evaluate(db, T0 + 2200)
    assert _open(db, "low_fuel")[0]["notification_id"] is None  # still muted: still quiet
    # an operator ends the mute (allowed: it only makes alerts louder); audited; the next pass tells the alert
    bind(c, settings, "ops", "operator", "installation", "*")
    r = c.delete(f"{API}/alerts/{second['id']}/mute", headers=as_user("ops"))
    assert r.status_code == 200 and r.json()["muted_until"] is None
    assert rows(db, "SELECT 1 FROM audit_log WHERE action = 'generator.alert.unmute'")
    assert c.delete(f"{API}/alerts/{second['id']}/mute").status_code == 200  # idempotent
    assert len(rows(db, "SELECT 1 FROM audit_log WHERE action = 'generator.alert.unmute'")) == 1
    assert c.delete(f"{API}/alerts/nope/mute").status_code == 404
    evaluate(db, T0 + 2300)
    told = _open(db, "low_fuel")[0]
    assert told["notification_id"]
    n = rows(db, "SELECT state FROM notifications WHERE id = ?", told["notification_id"])
    assert n and n[0]["state"] == "open"
    evaluate(db, T0 + 2400)  # told once
    assert len(rows(db, "SELECT 1 FROM notifications WHERE source LIKE 'generator.low_fuel@%' AND state = 'open'")) == 1
    # and the clear now reaches the centre
    set_state(db, "sensor.gen_fuel", "80")
    evaluate(db, T0 + 2500)
    assert rows(db, "SELECT state FROM notifications WHERE id = ?", told["notification_id"])[0]["state"] == "resolved"


def test_an_expired_mute_tells_the_alert(app):
    c, db, _ = app
    g = _gen(db)
    set_state(db, "sensor.gen_fuel", "18")
    evaluate(db, T0)
    evaluate(db, T0 + 61)
    aid = _open(db, "low_fuel")[0]["id"]
    with db.connection() as conn:  # a mute that runs until T0 + 1 h (engine time), set before the alert came back
        conn.execute("INSERT INTO generator_mutes(device_id, alert_key, until, muted_by) VALUES (?,?,?,?)",
                     (g, "low_fuel", "2026-10-05T10:00:00Z", "u"))
    set_state(db, "sensor.gen_fuel", "80")
    evaluate(db, T0 + 100)
    set_state(db, "sensor.gen_fuel", "18")
    evaluate(db, T0 + 1100)
    evaluate(db, T0 + 1200)
    row = _open(db, "low_fuel")[0]
    assert row["id"] != aid and row["notification_id"] is None
    evaluate(db, T0 + 3500)  # still inside the mute
    assert _open(db, "low_fuel")[0]["notification_id"] is None
    evaluate(db, T0 + 3700)  # the mute ended at T0 + 3600
    assert _open(db, "low_fuel")[0]["notification_id"]


def test_a_flap_while_muted_is_told_when_the_mute_ends(app):
    c, db, _ = app
    g = _gen(db)
    set_state(db, "sensor.gen_fuel", "18")
    evaluate(db, T0)
    evaluate(db, T0 + 61)
    first = _open(db, "low_fuel")[0]
    with db.connection() as conn:
        conn.execute("INSERT INTO generator_mutes(device_id, alert_key, until, muted_by) VALUES (?,?,?,?)", (g, "low_fuel", "2026-10-05T09:30:00Z", "u"))
    set_state(db, "sensor.gen_fuel", "80")
    evaluate(db, T0 + 100)
    set_state(db, "sensor.gen_fuel", "18")  # back within the fold window: the same row again, muted
    evaluate(db, T0 + 200)
    evaluate(db, T0 + 300)
    again = _open(db, "low_fuel")[0]
    assert again["id"] == first["id"] and again["count"] == 2 and again["notification_id"] is None
    evaluate(db, T0 + 1900)  # the mute ended at T0 + 1800
    told = _open(db, "low_fuel")[0]
    assert told["notification_id"] and rows(db, "SELECT state FROM notifications WHERE id = ?", told["notification_id"])[0]["state"] == "open"
