"""FIX-COMMS-2570 (deep review 2.56, CU-01..CU-03): a generator mute delays event alerts too, never tells an acknowledged alert late, and the
24 V battery latch can be cleared / is not learned from an earlier sensor mapping. A fake controller only (tests/generator_world.py)."""
from __future__ import annotations

import datetime as dt
import json

import pytest
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
    c.get("/api/v1/me")
    return c, Database(settings.db_path)


def _gen(db) -> str:
    make_generator(db, "full", model="DSE7320")
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


def _mute(db, g: str, key: str, until: str = "2026-10-05T10:00:00Z") -> None:
    with db.connection() as conn:
        conn.execute("INSERT OR REPLACE INTO generator_mutes(device_id, alert_key, until, muted_by) VALUES (?,?,?,?)", (g, key, until, "u"))


def _fail_the_test(db, ts: float) -> None:
    set_state(db, "sensor.gen_last_test", "2026-10-05T09:00:00+00:00")
    set_state(db, "sensor.gen_last_test_result", "failed")
    evaluate(db, ts)


# ---------------------------------------------------------------- CU-01: an event raised during a mute is told when the mute ends

def test_a_muted_event_is_told_when_the_mute_ends(app):
    c, db = app
    g = _gen(db)
    evaluate(db, T0)
    _mute(db, g, "test_failed")
    _fail_the_test(db, T0 + 40)
    ev = rows(db, "SELECT * FROM generator_alerts WHERE alert_key = 'test_failed'")
    assert len(ev) == 1 and ev[0]["notification_id"] is None and ev[0]["cleared_at"] is not None
    evaluate(db, T0 + 1800)  # still muted: still quiet
    assert rows(db, "SELECT notification_id FROM generator_alerts WHERE alert_key = 'test_failed'")[0]["notification_id"] is None
    evaluate(db, T0 + 3700)  # the mute ended at T0 + 3600: told once
    told = rows(db, "SELECT * FROM generator_alerts WHERE alert_key = 'test_failed'")[0]
    assert told["notification_id"] and rows(db, "SELECT state FROM notifications WHERE id = ?", told["notification_id"])[0]["state"] == "open"
    assert "_muted" not in json.loads(told["snapshot_json"])
    n = len(rows(db, "SELECT 1 FROM notifications WHERE source LIKE 'generator.test_failed@%'"))
    evaluate(db, T0 + 3800)
    assert len(rows(db, "SELECT 1 FROM notifications WHERE source LIKE 'generator.test_failed@%'")) == n


def test_the_mute_marker_is_not_exposed(app):
    c, db = app
    g = _gen(db)
    evaluate(db, T0)
    _mute(db, g, "test_failed")
    _fail_the_test(db, T0 + 40)
    aid = rows(db, "SELECT id FROM generator_alerts WHERE alert_key = 'test_failed'")[0]["id"]
    assert "_muted" not in c.get(f"{API}/alerts/{aid}").json().get("snapshot", {})


# ---------------------------------------------------------------- CU-02: nobody is told late about an acknowledged alert

def test_an_acknowledged_alert_is_not_told_after_the_mute(app):
    c, db = app
    g = _gen(db)
    _mute(db, g, "low_fuel")
    set_state(db, "sensor.gen_fuel", "18")
    evaluate(db, T0)
    evaluate(db, T0 + 61)
    row = rows(db, "SELECT * FROM generator_alerts WHERE alert_key = 'low_fuel' AND cleared_at IS NULL")[0]
    assert row["notification_id"] is None
    assert c.post(f"{API}/alerts/{row['id']}/ack", json={"note": "handled"}).status_code == 200
    evaluate(db, T0 + 3700)  # the mute is over
    assert rows(db, "SELECT notification_id FROM generator_alerts WHERE id = ?", row["id"])[0]["notification_id"] is None
    assert not rows(db, "SELECT 1 FROM notifications WHERE source LIKE 'generator.low_fuel@%'")


def test_an_acknowledged_event_is_not_told_after_the_mute(app):
    c, db = app
    g = _gen(db)
    evaluate(db, T0)
    _mute(db, g, "test_failed")
    _fail_the_test(db, T0 + 40)
    aid = rows(db, "SELECT id FROM generator_alerts WHERE alert_key = 'test_failed'")[0]["id"]
    assert c.post(f"{API}/alerts/{aid}/ack", json={"note": "seen"}).status_code == 200
    evaluate(db, T0 + 3700)
    assert rows(db, "SELECT notification_id FROM generator_alerts WHERE id = ?", aid)[0]["notification_id"] is None


# ---------------------------------------------------------------- CU-03: the 24 V latch

def _latch_from_history(c, db):
    g = _gen(db)
    with db.connection() as conn:
        conn.execute("INSERT INTO generator_samples_5m(device_id, role, ts, v_avg, v_min, v_max, n) VALUES (?,?,?,?,?,?,1)", (g, "battery_v", int(T0) - 86400, 26.5, 26.1, 26.8))
    set_state(db, "sensor.gen_battery", "13.2")
    evaluate(db, T0)
    assert c.get(f"{API}/devices/{g}").json()["battery_system_v"] == 24
    return g


def test_choosing_automatic_clears_the_latch(app):
    c, db = app
    g = _latch_from_history(c, db)
    d = c.put(f"{API}/devices/{g}", json={"battery_nominal_v": None}).json()
    assert d["battery_system_v"] is None
    alerts.reset()  # a fresh process: the old history may not latch the bank again
    evaluate(db, T0 + 100)
    assert c.get(f"{API}/devices/{g}").json()["battery_system_v"] is None
    # a real 24 V reading after the choice latches it again
    set_state(db, "sensor.gen_battery", "27.0")
    evaluate(db, T0 + 200)
    assert c.get(f"{API}/devices/{g}").json()["battery_system_v"] == 24


def test_a_battery_remap_drops_what_the_old_sensor_taught(app):
    c, db = app
    g = _latch_from_history(c, db)
    r = c.put(f"{API}/devices/{g}/roles", json={"roles": {"battery_v": "sensor.gen_charger"}})
    assert r.status_code == 200, r.text
    assert c.get(f"{API}/devices/{g}").json()["battery_system_v"] is None
    alerts.reset()
    evaluate(db, T0 + 100)
    assert c.get(f"{API}/devices/{g}").json()["battery_system_v"] is None
