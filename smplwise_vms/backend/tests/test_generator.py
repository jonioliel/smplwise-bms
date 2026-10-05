"""CR-031 GEN1 phase A (backend): detection from the registry mirror (domain, generic, manual, negative), the capability levels, the sensor
mapping and its correction, the live values with unit normalisation, the history (record, downsample, retention), the alert engine
(raise after the hold, clear, flap fold, events, mute, acknowledge, only the types the sensors can produce), the notification-centre
rows, the routing settings (empty by default, validation, bridge, reset) and the permission matrix. A fake controller only: no
infrastructure, no device."""
from __future__ import annotations

import datetime as dt
import json

import pytest
from conftest import as_user, bind
from fastapi.testclient import TestClient
from generator_world import GEN_DEVICE, make_generator, make_other, set_state

from smplwise.db import Database
from smplwise.services import generator_alerts as alerts
from smplwise.services import generator_catalog as cat
from smplwise.services import generator_core as core
from smplwise.services import generator_history as history
from smplwise.services import generator_runtime as runtime

API = "/api/v1/generator"
T0 = dt.datetime(2026, 10, 5, 9, 0, tzinfo=dt.timezone.utc).timestamp()


@pytest.fixture()
def app(settings):
    from smplwise.main import create_app

    from smplwise.services import ha_sync

    ha_sync.STATE.connected = False  # the sync state is process-wide: other test files leave it connected
    alerts.reset()
    runtime.reset()
    c = TestClient(create_app(settings))
    c.get("/api/v1/me")  # joni becomes system_admin (bootstrap)
    return c, Database(settings.db_path), settings


def detect(db):
    with db.connection() as conn:
        return core.detect(conn)


def gid(db) -> str:
    with db.connection(mode="read") as conn:
        return conn.execute("SELECT id FROM generator_devices WHERE status <> 'removed'").fetchone()["id"]


def evaluate(db, ts: float):
    with db.connection() as conn:
        return alerts.evaluate(conn, ts)


def rows(db, sql: str, *a):
    with db.connection(mode="read") as conn:
        return conn.execute(sql, a).fetchall()


def enable_domain(db):
    with db.connection() as conn:
        core.jset(conn, "generator.integration_domains", ["genset_ctl"])


# ---------------------------------------------------------------- classification (pure)

def _e(eid, name, domain="sensor", dclass=None, unit=None):
    return {"entity_id": eid, "name": name, "original_name": None, "domain": domain, "device_class": dclass, "unit": unit}


@pytest.mark.parametrize("name,domain,dclass,unit,role", [
    ("Generator voltage L2", "sensor", "voltage", "V", "gen_v_l2"),
    ("מתח גנרטור פאזה 3", "sensor", "voltage", "V", "gen_v_l3"),
    ("Mains voltage L1", "sensor", "voltage", "V", "mains_v_l1"),
    ("Battery voltage", "sensor", "voltage", "V", "battery_v"),
    ("Fuel level", "sensor", None, "%", "fuel_pct"),
    ("Fuel", "sensor", None, "L", "fuel_l"),
    ("Oil pressure", "sensor", "pressure", "psi", "oil_pressure"),
    ("לחץ שמן", "sensor", "pressure", "bar", "oil_pressure"),
    ("Coolant temperature", "sensor", "temperature", "°C", "coolant_temp"),
    ("Engine hours", "sensor", None, "h", "run_hours"),
    ("Service hours remaining", "sensor", None, "h", "service_hours_left"),
    ("Mains failure", "binary_sensor", None, None, "mains_available"),
    ("Emergency stop", "binary_sensor", None, None, "alarm_emergency_stop"),
    ("Living room temperature", "sensor", "temperature", "°C", None),
])
def test_classify(name, domain, dclass, unit, role):
    got = core.classify(_e("sensor.x_" + str(abs(hash(name)) % 999), name, domain, dclass, unit))
    assert (got[0] if got else None) == role


def test_mains_failure_binary_is_inverted():
    assert core.classify(_e("binary_sensor.mf", "Mains failure", "binary_sensor"))[2] is True
    assert core.classify(_e("binary_sensor.mo", "Mains available", "binary_sensor", "power"))[2] is False


def test_unit_normalisation():
    assert cat.to_canonical("oil_pressure", 200, "kPa") == 2.0
    assert round(cat.to_canonical("oil_pressure", 29, "psi"), 2) == 2.0
    assert cat.to_canonical("gen_kw", 1500, "W") == 1.5
    assert round(cat.to_canonical("coolant_temp", 212, "°F"), 1) == 100.0
    assert cat.norm_enum("engine_state", "Running on load") == "running" and cat.norm_enum("engine_state", "Shutdown alarm") == "fault"
    assert cat.norm_enum("engine_state", "במנוחה") == "stopped" and cat.norm_enum("engine_state", "unavailable") is None
    assert cat.norm_bool("off", invert=True) is True and cat.norm_bool("unknown") is None


# ---------------------------------------------------------------- detection

def test_negative_no_generator(app):
    _, db, _ = app
    make_other(db)
    assert detect(db) == []
    with db.connection(mode="read") as conn:
        assert conn.execute("SELECT COUNT(*) FROM generator_devices").fetchone()[0] == 0


def test_generic_detection_and_capability_levels(app):
    c, db, _ = app
    make_other(db)
    expect = {"minimal": (True, 2), "typical": (True, 14), "full": (True, 24)}
    for level, (core_met, n_roles) in expect.items():
        with db.connection() as conn:
            conn.execute("DELETE FROM generator_devices")
            conn.execute("DELETE FROM ha_entities WHERE device_id = ?", (GEN_DEVICE,))
        make_generator(db, level, model="DSE7320")  # a generator-like model name makes the generic fallback accept even the minimal level
        found = detect(db)
        assert len(found) == 1 and found[0]["kind"] == "generic" and found[0]["status"] == "detected"
        d = c.get(f"{API}/devices/{gid(db)}").json()
        assert d["core_met"] is core_met and len(d["capabilities"]["roles"]) == n_roles, (level, d["capabilities"]["roles"])
        assert d["capabilities"]["alert_types"] <= d["capabilities"]["alert_types_total"] == 26
    assert d["capabilities"]["alert_types"] == 22 and d["capabilities"]["values"] == 23  # the full level: every generic alert type (the 4 controller-flag types need the DSE roles), 23 of 31 value roles (+ the alarm output)


def test_minimal_without_hint_is_not_generic_and_typical_is(app):
    _, db, _ = app
    make_generator(db, "minimal", name="Unit A", model="X1")
    assert detect(db) == []  # two entities and a neutral name: not enough evidence for the generic fallback
    make_generator(db, "typical", name="Unit A", model="X1")
    assert len(detect(db)) == 1  # an engine state plus four more roles


def test_integration_domain_detection_and_partial(app):
    c, db, _ = app
    make_generator(db, "minimal", name="Unit A", model="X1")
    enable_domain(db)
    found = detect(db)
    assert found and found[0]["kind"] == "integration"
    # remove the voltage: only the engine state is left -> partial (listed, but no core)
    with db.connection() as conn:
        conn.execute("DELETE FROM ha_entities WHERE entity_id = 'sensor.gen_voltage_l1'")
    found = detect(db)
    assert found[0]["status"] == "partial"
    assert c.get(f"{API}/devices").json()["partial"] == 1


def test_vanished_device_is_marked_removed(app):
    c, db, _ = app
    make_generator(db, "typical")
    detect(db)
    with db.connection() as conn:
        conn.execute("UPDATE ha_devices SET removed_at = '2026-10-05T09:00:00Z'")
    detect(db)
    assert c.get(f"{API}/devices").json()["devices"] == []


def test_manual_pick_and_candidates(app):
    c, db, _ = app
    make_generator(db, "typical", name="Unit A", model="X1")
    r = c.get(f"{API}/device-candidates")
    assert r.status_code == 200 and r.json()["items"][0]["ha_device_id"] == GEN_DEVICE and r.json()["items"][0]["mapped_roles"] >= 10
    assert "entity_id" not in json.dumps(r.json())
    r = c.post(f"{API}/devices", json={"ha_device_id": GEN_DEVICE, "name": "גנרטור גג"})
    assert r.status_code == 201 and r.json()["source_kind"] == "manual" and r.json()["name"] == "גנרטור גג" and r.json()["core_met"] is True
    assert c.post(f"{API}/devices", json={"ha_device_id": GEN_DEVICE}).json()["id"] == r.json()["id"]  # idempotent
    assert c.post(f"{API}/devices", json={"ha_device_id": "nope"}).status_code == 404
    detect(db)  # a manual device stays after re-detection
    assert c.get(f"{API}/devices").json()["devices"][0]["source_kind"] == "manual"


def test_detect_route_rate_limit_and_audit(app):
    c, db, _ = app
    make_generator(db, "typical", model="DSE7320")
    from smplwise.routers import generator as router

    router._DETECT_CALLS.clear()
    for _i in range(3):
        assert c.post(f"{API}/devices/detect").status_code == 200
    assert c.post(f"{API}/devices/detect").status_code == 429
    router._DETECT_CALLS.clear()
    assert rows(db, "SELECT 1 FROM audit_log WHERE action = 'generator.detect'")


# ---------------------------------------------------------------- mapping correction

def test_role_override_and_unmap(app):
    c, db, _ = app
    make_generator(db, "full", model="DSE7320")
    detect(db)
    g = gid(db)
    roles = c.get(f"{API}/devices/{g}/roles").json()["items"]
    fuel = next(r for r in roles if r["role"] == "fuel_pct")
    assert fuel["mapped"] and fuel["mapped_by"] == "auto" and fuel["entity_id"] == "sensor.gen_fuel"
    r = c.put(f"{API}/devices/{g}/roles", json={"roles": {"fuel_pct": None, "battery_v": "sensor.gen_charger"}})
    assert r.status_code == 200 and "fuel_pct" not in r.json()["capabilities"]["roles"]
    roles = {r["role"]: r for r in c.get(f"{API}/devices/{g}/roles").json()["items"]}
    assert roles["battery_v"]["mapped_by"] == "manual" and roles["fuel_pct"]["unmapped_by_user"] is True
    detect(db)  # re-detection keeps the correction
    assert "fuel_pct" not in c.get(f"{API}/devices/{g}").json()["capabilities"]["roles"]
    assert c.put(f"{API}/devices/{g}/roles", json={"roles": {"nonsense": None}}).status_code == 422
    assert c.put(f"{API}/devices/{g}/roles", json={"roles": {"fuel_pct": "sensor.missing"}}).status_code == 422


# ---------------------------------------------------------------- live values

def test_live_values_units_and_availability(app):
    c, db, _ = app
    make_generator(db, "full", model="DSE7320")
    detect(db)
    g = gid(db)
    set_state(db, "sensor.gen_oil", "420")  # kPa -> 4.2 bar
    set_state(db, "sensor.gen_engine_state", "Running")
    set_state(db, "sensor.gen_mode", "Test")
    set_state(db, "binary_sensor.gen_mains_ok", "off")
    d = c.get(f"{API}/devices/{g}").json()
    v = d["values"]
    assert v["oil_pressure"]["value"] == 4.2 and v["oil_pressure"]["unit"] == "bar"
    assert v["engine_state"]["value"] == "running" and v["controller_mode"]["value"] == "test" and v["mains_available"]["value"] is False
    assert v["fuel_pct"]["label"] == "מפלס דלק"
    assert "entity_id" not in json.dumps(d) and d["availability"] in ("online", "stale")
    live = c.get(f"{API}/devices/{g}/live").json()
    assert live["values"]["oil_pressure"]["value"] == 4.2
    for r in ("sensor.gen_engine_state", "sensor.gen_voltage_l1", "sensor.gen_voltage_l2", "sensor.gen_voltage_l3"):
        set_state(db, r, "unavailable")
    d = c.get(f"{API}/devices/{g}").json()
    assert d["availability"] == "offline" and d["stale"] is True
    assert c.get(f"{API}/devices/nope").status_code == 404


def test_update_device(app):
    c, db, _ = app
    make_generator(db, "typical", model="DSE7320")
    detect(db)
    g = gid(db)
    rev = c.get(f"{API}/devices/{g}").json()["revision"]
    r = c.put(f"{API}/devices/{g}", json={"name": "גנרטור גג", "rated_kw": 200, "fuel_type": "diesel", "revision": rev, "thresholds": {"fuel_low_pct": 30}})
    assert r.status_code == 200 and r.json()["name"] == "גנרטור גג" and r.json()["rated_kw"] == 200 and r.json()["thresholds"]["fuel_low_pct"] == 30
    assert c.put(f"{API}/devices/{g}", json={"name": "x", "revision": rev}).status_code == 409
    assert c.put(f"{API}/devices/{g}", json={"thresholds": {"fuel_low_pct": 999}}).status_code == 422
    assert c.put(f"{API}/devices/{g}", json={"unknown": 1}).status_code == 422


# ---------------------------------------------------------------- history

def test_history_record_downsample_and_retention(app):
    c, db, _ = app
    make_generator(db, "typical", model="DSE7320")
    detect(db)
    g = gid(db)
    now = int(dt.datetime.now(dt.timezone.utc).timestamp())
    base = now - now % 60
    for i in range(0, 180):  # three hours of minute samples, coolant rising
        set_state(db, "sensor.gen_coolant", str(40 + i * 0.1))
        with db.connection() as conn:
            history.record(conn, base - (180 - i) * 60)
    r = c.get(f"{API}/devices/{g}/history", params={"roles": "coolant_temp", "range": "24h", "max_points": 50})
    assert r.status_code == 200
    j = r.json()
    pts = j["series"]["coolant_temp"]
    assert j["source"] == "rollup_5m" and 0 < len(pts) <= 50 and j["step_s"] % 300 == 0 and j["units"]["coolant_temp"] == "°C"
    assert pts[0]["min"] <= pts[0]["v"] <= pts[0]["max"] and pts[-1]["v"] > pts[0]["v"]
    r = c.get(f"{API}/devices/{g}/history", params={"roles": "coolant_temp", "range": "1h"}).json()
    assert r["source"] == "raw" and r["step_s"] == 60 and 55 <= len(r["series"]["coolant_temp"]) <= 61
    r = c.get(f"{API}/devices/{g}/history", params={"range": "custom", "from": dt.datetime.fromtimestamp(base - 7200, dt.timezone.utc).isoformat(), "to": dt.datetime.fromtimestamp(base - 3600, dt.timezone.utc).isoformat()})
    assert r.status_code == 200 and set(r.json()["series"]) >= {"coolant_temp", "gen_hz"}
    assert c.get(f"{API}/devices/{g}/history", params={"range": "custom"}).status_code == 422
    assert c.get(f"{API}/devices/{g}/history", params={"range": "custom", "from": "2020-01-01T00:00:00Z", "to": "2026-01-01T00:00:00Z"}).status_code == 422  # beyond the retention
    assert c.get(f"{API}/devices/{g}/history", params={"roles": "fuel_pct"}).status_code == 422  # a role this generator does not have
    with db.connection() as conn:  # retention: raw after 3 days, rollup after the setting
        conn.execute("UPDATE generator_samples SET ts = ts - 400000")
        conn.execute("UPDATE generator_samples_5m SET ts = ts - 86400 * 40")
        out = history.prune(conn, now)
    assert out["raw"] > 0 and out["rollup"] > 0


# ---------------------------------------------------------------- alerts

def _full(db, **states):
    make_generator(db, "full", model="DSE7320")
    detect(db)
    for k, v in states.items():
        set_state(db, "sensor.gen_" + k, v)
    return gid(db)


def test_low_fuel_raises_after_hold_clears_and_lands_in_the_centre(app):
    c, db, _ = app
    g = _full(db)
    set_state(db, "sensor.gen_fuel", "18")
    assert evaluate(db, T0) == {"raised": 0, "cleared": 0}  # the hold (60 s) has not passed yet
    assert evaluate(db, T0 + 30)["raised"] == 0
    assert evaluate(db, T0 + 61)["raised"] == 1
    a = c.get(f"{API}/alerts", params={"state": "open"}).json()
    assert a["open_count"] == 1 and a["alerts"][0]["key"] == "low_fuel" and a["alerts"][0]["title"] == "מפלס דלק נמוך" and a["alerts"][0]["severity"] == "alert"
    n = rows(db, "SELECT * FROM notifications WHERE source LIKE 'generator.low_fuel@%'")
    assert len(n) == 1 and n[0]["subject_kind"] == "generator" and "18%" in n[0]["body"] and n[0]["state"] == "open"
    detail = c.get(f"{API}/alerts/{a['alerts'][0]['id']}").json()
    assert detail["snapshot"]["fuel_pct"] == 18 and detail["timeline"][0]["kind"] == "raised"
    assert evaluate(db, T0 + 120) == {"raised": 0, "cleared": 0}  # still low: no second row
    set_state(db, "sensor.gen_fuel", "80")
    assert evaluate(db, T0 + 180)["cleared"] == 1
    assert rows(db, "SELECT state FROM notifications WHERE source LIKE 'generator.low_fuel@%'")[0]["state"] == "resolved"
    assert c.get(f"{API}/alerts", params={"state": "open"}).json()["open_count"] == 0
    assert c.get(f"{API}/alerts", params={"state": "closed", "device_id": g}).json()["alerts"][0]["cleared_at"]


def test_flap_folds_into_the_same_row(app):
    c, db, _ = app
    _full(db)
    for step, fuel in ((0, "18"), (61, "18"), (100, "80"), (130, "18"), (200, "18")):
        set_state(db, "sensor.gen_fuel", fuel)
        evaluate(db, T0 + step)
    r = rows(db, "SELECT * FROM generator_alerts WHERE alert_key = 'low_fuel'")
    assert len(r) == 1 and r[0]["count"] == 2 and r[0]["cleared_at"] is None


def test_only_types_the_sensors_can_produce(app):
    c, db, _ = app
    make_generator(db, "minimal", model="DSE7320")
    detect(db)
    g = gid(db)
    d = c.get(f"{API}/devices/{g}").json()
    avail = {t["key"] for t in d["alert_types"] if t["available"]}
    assert avail == {"fail_to_start", "emergency_stop", "unexpected_stop", "gen_voltage", "controller_offline"}
    na = next(t for t in d["alert_types"] if t["key"] == "low_fuel")
    assert na["available"] is False and na["needs"]
    set_state(db, "sensor.gen_engine_state", "Fault")
    evaluate(db, T0)
    evaluate(db, T0 + 10)
    assert {r["alert_key"] for r in rows(db, "SELECT alert_key FROM generator_alerts")} == {"unexpected_stop"}
    pol = c.get(f"{API}/devices/{g}/policies").json()
    assert pol["available"] == 5 and pol["total"] == 26 and not all(i["available"] for i in pol["items"])
    r = c.put(f"{API}/devices/{g}/policies/low_fuel", json={"enabled": True})
    assert r.status_code == 422 and r.json()["error"]["code"] == "type_unavailable" if "error" in r.json() else r.status_code == 422


def test_controller_alarm_output_beats_thresholds_and_event_types(app):
    c, db, _ = app
    g = _full(db)
    set_state(db, "sensor.gen_engine_state", "Running")
    set_state(db, "sensor.gen_voltage_l1", "231")
    evaluate(db, T0)
    set_state(db, "binary_sensor.gen_alarm_emergency", "on")
    evaluate(db, T0 + 5)
    open_ = {r["alert_key"]: r for r in rows(db, "SELECT * FROM generator_alerts WHERE cleared_at IS NULL")}
    assert "emergency_stop" in open_ and open_["emergency_stop"]["severity"] == "critical"
    # events: mains lost (hold 5 s) then restored
    set_state(db, "binary_sensor.gen_mains_ok", "off")
    evaluate(db, T0 + 10)
    evaluate(db, T0 + 20)
    assert "mains_lost" in {r["alert_key"] for r in rows(db, "SELECT alert_key FROM generator_alerts WHERE cleared_at IS NULL")}
    set_state(db, "binary_sensor.gen_mains_ok", "on")
    r = evaluate(db, T0 + 30)
    assert r["cleared"] == 1 and r["raised"] == 1
    ev = rows(db, "SELECT * FROM generator_alerts WHERE alert_key = 'mains_restored'")
    assert len(ev) == 1 and ev[0]["cleared_at"] == ev[0]["raised_at"] and ev[0]["severity"] == "info"
    # a test run that fails
    set_state(db, "sensor.gen_last_test", "2026-10-05T09:00:00+00:00")
    set_state(db, "sensor.gen_last_test_result", "failed")
    evaluate(db, T0 + 40)
    assert rows(db, "SELECT 1 FROM generator_alerts WHERE alert_key = 'test_failed'") and not rows(db, "SELECT 1 FROM generator_alerts WHERE alert_key = 'test_done'")


def test_nothing_raised_while_controller_offline_except_offline_alert(app):
    c, db, _ = app
    _full(db)
    for r in ("sensor.gen_engine_state", "sensor.gen_voltage_l1", "sensor.gen_voltage_l2", "sensor.gen_voltage_l3"):
        set_state(db, r, "unavailable")
    set_state(db, "sensor.gen_fuel", "3")
    evaluate(db, T0)
    evaluate(db, T0 + 121)
    assert {r["alert_key"] for r in rows(db, "SELECT alert_key FROM generator_alerts")} == {"controller_offline"}


def test_ack_mute_and_ack_all(app):
    c, db, _ = app
    g = _full(db)
    set_state(db, "sensor.gen_fuel", "3")
    evaluate(db, T0)
    evaluate(db, T0 + 61)
    evaluate(db, T0 + 90)  # fuel_shutdown (30 s hold) as well
    open_ = c.get(f"{API}/alerts", params={"state": "open"}).json()["alerts"]
    assert {a["key"] for a in open_} == {"low_fuel", "fuel_shutdown"}
    a = next(x for x in open_ if x["key"] == "low_fuel")
    r = c.post(f"{API}/alerts/{a['id']}/ack", json={"note": "בדיקה"})
    assert r.status_code == 200 and r.json()["acknowledged"] is True and r.json()["ack_note"] == "בדיקה" and r.json()["state"] == "open"
    assert rows(db, "SELECT state FROM notifications WHERE source LIKE 'generator.low_fuel@%'")[0]["state"] == "acknowledged"
    assert rows(db, "SELECT 1 FROM audit_log WHERE action = 'generator.alert.ack'")
    assert c.post(f"{API}/alerts/{a['id']}/ack").status_code == 200  # idempotent
    assert c.post(f"{API}/devices/{g}/alerts/ack-all").json() == {"acknowledged": 1}
    assert c.post(f"{API}/alerts/nope/ack").status_code == 404
    # mute: after the alert clears and is raised again past the fold window, the row exists but nobody is notified
    m = c.post(f"{API}/alerts/{a['id']}/mute", json={"hours": 2}).json()
    assert m["muted_until"] and c.get(f"{API}/alerts/{a['id']}").json()["muted_until"]
    set_state(db, "sensor.gen_fuel", "90")
    evaluate(db, T0 + 200)
    set_state(db, "sensor.gen_fuel", "3")
    evaluate(db, T0 + 2000)
    evaluate(db, T0 + 2100)
    again = rows(db, "SELECT * FROM generator_alerts WHERE alert_key = 'low_fuel' ORDER BY raised_at")
    assert len(again) == 2 and again[1]["notification_id"] is None
    assert c.post(f"{API}/alerts/{a['id']}/mute", json={"hours": 0}).status_code == 422


def test_alert_filters_and_retention(app):
    c, db, _ = app
    g = _full(db)
    set_state(db, "sensor.gen_fuel", "3")
    evaluate(db, T0)
    evaluate(db, T0 + 61)
    evaluate(db, T0 + 100)
    assert len(c.get(f"{API}/alerts", params={"severity": "critical"}).json()["alerts"]) == 1
    assert len(c.get(f"{API}/alerts", params={"type": "low_fuel"}).json()["alerts"]) == 1
    assert len(c.get(f"{API}/alerts", params={"ack": "true"}).json()["alerts"]) == 0
    assert len(c.get(f"{API}/alerts", params={"limit": 1}).json()["alerts"]) == 1 and c.get(f"{API}/alerts", params={"limit": 1}).json()["next_before"]
    with db.connection() as conn:
        conn.execute("UPDATE generator_alerts SET cleared_at = '2025-01-01T00:00:00Z' WHERE alert_key = 'low_fuel'")
        assert alerts.prune_alerts(conn, dt.datetime(2026, 10, 5, tzinfo=dt.timezone.utc).timestamp()) == 1  # older than the 365 days
        conn.execute("UPDATE generator_alerts SET cleared_at = '2026-06-01T00:00:00Z' WHERE alert_key = 'fuel_shutdown'")
        assert alerts.prune_alerts(conn, dt.datetime(2026, 10, 5, tzinfo=dt.timezone.utc).timestamp()) == 0  # inside the year


# ---------------------------------------------------------------- routing

def test_routing_starts_empty_then_delivers_only_what_was_saved(app):
    c, db, settings = app
    g = _full(db)
    bind(c, settings, "ops", "operator", "installation", "*")
    bind(c, settings, "vera", "viewer", "installation", "*")
    pol = c.get(f"{API}/devices/{g}/policies").json()
    assert all(i["policy"] is None for i in pol["items"]) and pol["channels_reserved"] == ["whatsapp", "ha_mobile"]
    set_state(db, "sensor.gen_fuel", "10")
    evaluate(db, T0)
    evaluate(db, T0 + 61)
    n = rows(db, "SELECT id FROM notifications WHERE source LIKE 'generator.low_fuel@%'")
    assert len(n) == 1 and rows(db, "SELECT 1 FROM notification_recipients WHERE notification_id = ?", n[0]["id"]) == []  # in the centre, but nobody is addressed yet
    r = c.put(f"{API}/devices/{g}/policies/battery_low", json={"recipients": {"roles": ["operator"], "users": []}, "channels": ["push", "app"], "severity": "critical", "escalate": True})
    assert r.status_code == 200 and r.json()["channels"] == ["push", "app"] and r.json()["row_version"] == 1
    src = rows(db, "SELECT * FROM notify_policies WHERE source LIKE 'generator.battery_low@%'")[0]
    assert src["severity"] == "critical" and json.loads(src["recipients_json"]) == {"rule": "generator"} and json.loads(src["channels_json"])["webpush"] is True
    set_state(db, "sensor.gen_battery", "10.5")
    evaluate(db, T0 + 300)
    evaluate(db, T0 + 361)
    nb = rows(db, "SELECT id, severity FROM notifications WHERE source LIKE 'generator.battery_low@%'")[0]
    users = {r["user_id"] for r in rows(db, "SELECT user_id FROM notification_recipients WHERE notification_id = ?", nb["id"])}
    ops_id = rows(db, "SELECT id FROM users WHERE username = 'ops'")[0]["id"]
    assert nb["severity"] == "critical" and users == {ops_id}  # the operator by role; the viewer (no generator.view) and the admin (not named) are not addressed
    assert c.put(f"{API}/devices/{g}/policies/battery_low", json={"enabled": False, "row_version": 1}).json()["row_version"] == 2
    assert c.put(f"{API}/devices/{g}/policies/battery_low", json={"enabled": True, "row_version": 1}).status_code == 409
    assert c.post(f"{API}/devices/{g}/policies/reset").json() == {"reset": 1}
    assert rows(db, "SELECT * FROM generator_alert_policies") == []
    assert rows(db, "SELECT 1 FROM notify_policies WHERE source LIKE 'generator.battery_low@%' AND source LIKE '%@' || ?", g) == []  # the mirror row of this generator is gone (defaults again)


def test_routing_validation(app):
    c, db, _ = app
    g = _full(db)
    url = f"{API}/devices/{g}/policies/low_fuel"
    assert c.put(url, json={"channels": ["whatsapp"]}).status_code == 422
    assert c.put(url, json={"channels": ["sms"]}).status_code == 422
    assert c.put(url, json={"recipients": {"roles": ["viewer"], "users": []}}).status_code == 422
    assert c.put(url, json={"recipients": {"roles": [], "users": ["ghost"]}}).status_code == 422
    assert c.put(url, json={"quiet_mode": "never"}).status_code == 422
    assert c.put(url, json={"after_s": -1}).status_code == 422
    assert c.put(f"{API}/devices/{g}/policies/nonsense", json={"enabled": True}).status_code == 404
    r = c.put(url, json={"recipients": {"roles": ["site_admin"], "users": []}, "quiet_mode": "pass", "after_s": 120})
    assert r.status_code == 200 and r.json()["quiet_mode"] == "pass" and r.json()["severity"] == "alert"
    assert "Home Assistant" not in json.dumps(c.get(f"{API}/devices/{g}/policies").json(), ensure_ascii=False)


# ---------------------------------------------------------------- settings and permissions

def test_settings(app):
    c, db, _ = app
    s = c.get(f"{API}/settings").json()
    assert s["alert_retention_days"] == 365 and s["history_retention_days"] == 35 and s["integration_domains"] == [] and s["thresholds"]["fuel_low_pct"] == 25
    r = c.put(f"{API}/settings", json={"integration_domains": ["Genset_Ctl", "genset_ctl"], "alert_retention_days": 400, "thresholds": {"oil_min_bar": 1.5}})
    assert r.status_code == 200 and r.json()["integration_domains"] == ["genset_ctl"] and r.json()["alert_retention_days"] == 400 and r.json()["thresholds"]["oil_min_bar"] == 1.5
    assert c.put(f"{API}/settings", json={"alert_retention_days": 5}).status_code == 422
    assert c.put(f"{API}/settings", json={"integration_domains": ["bad domain!"]}).status_code == 422
    assert c.put(f"{API}/settings", json={"thresholds": {"nonsense": 1}}).status_code == 422
    make_generator(db, "typical", name="Unit A", model="X1")
    c.put(f"{API}/settings", json={"integration_domains": ["genset_ctl"]})
    assert len(detect(db)) == 1


def test_permission_matrix(app):
    c, db, settings = app
    make_generator(db, "typical", model="DSE7320")
    detect(db)
    g = gid(db)
    bind(c, settings, "ops", "operator", "installation", "*")
    bind(c, settings, "adm", "site_admin", "installation", "*")
    bind(c, settings, "vera", "viewer", "installation", "*")
    bind(c, settings, "kio", "kiosk", "installation", "*")
    o, a, v = as_user("ops"), as_user("adm"), as_user("vera")
    for path in ("/devices", f"/devices/{g}", f"/devices/{g}/live", f"/devices/{g}/history", "/alerts"):
        assert c.get(API + path, headers=o).status_code == 200, path
        assert c.get(API + path, headers=a).status_code == 200, path
        assert c.get(API + path, headers=v).status_code == 403, path
        assert c.get(API + path, headers=as_user("kio")).status_code == 403, path
    for method, path, body in (("get", f"/devices/{g}/roles", None), ("put", f"/devices/{g}/roles", {"roles": {}}), ("get", f"/devices/{g}/policies", None),
                               ("put", f"/devices/{g}/policies/not_auto", {"enabled": True}), ("post", f"/devices/{g}/policies/reset", None), ("get", "/settings", None),
                               ("put", "/settings", {}), ("post", "/devices/detect", None), ("post", "/devices", {"ha_device_id": GEN_DEVICE}), ("get", "/device-candidates", None),
                               ("put", f"/devices/{g}", {"name": "x"})):
        assert getattr(c, method)(API + path, headers=o, **({"json": body} if body is not None else {})).status_code == 403, ("operator", path)
        assert getattr(c, method)(API + path, headers=v, **({"json": body} if body is not None else {})).status_code == 403, ("viewer", path)
        assert getattr(c, method)(API + path, headers=a, **({"json": body} if body is not None else {})).status_code in (200, 201), ("site_admin", path)
    assert rows(db, "SELECT 1 FROM audit_log WHERE action = 'generator.view' AND decision = 'denied'")
    set_state(db, "sensor.gen_battery", "9")
    evaluate(db, T0)
    evaluate(db, T0 + 61)
    aid = c.get(f"{API}/alerts", headers=o).json()["alerts"][0]["id"]
    assert c.post(f"{API}/alerts/{aid}/ack", headers=o).status_code == 200  # an operator acknowledges
    assert c.post(f"{API}/alerts/{aid}/ack", headers=v).status_code == 403


def test_permissions_registered_in_both_catalogues():
    from smplwise.rbac import ROLES
    from smplwise.routers.access import PERMISSION_LABELS, SENSITIVE

    for p in ("generator.view", "generator.manage"):
        assert PERMISSION_LABELS[p] and p not in SENSITIVE
    assert {p for p in ROLES["operator"] if p.startswith("generator.")} == {"generator.view"}
    for role in ("site_admin", "system_admin"):
        assert {p for p in ROLES[role] if p.startswith("generator.")} == {"generator.view", "generator.manage"}
    for role in ("viewer", "kiosk", "editor"):
        assert not [p for p in ROLES[role] if p.startswith("generator.")]
    assert not [p for p in PERMISSION_LABELS if p.startswith("generator.control")]  # no command permission: view and alerts only
    # the 22 alert types and their needs are consistent
    assert len(cat.ALERT_TYPES) == 26 and all(set(t.needs) <= set(cat.ROLES) for t in cat.ALERT_TYPES)


def test_runtime_tick_detects_samples_and_alerts(app):
    from smplwise.services import ha_sync

    c, db, settings = app
    ha_sync.STATE.connected = False  # pinned: the process-wide sync state may be left connected by another test of the same worker
    make_generator(db, "full", model="DSE7320")
    set_state(db, "sensor.gen_fuel", "10")
    out = runtime.tick(db, settings, T0, require_connection=False)
    assert out["detected"] == 1 and out["samples"] > 5 and out["raised"] == 0
    out = runtime.tick(db, settings, T0 + 61, require_connection=False)
    assert out["raised"] == 1 and "detected" not in out
    assert runtime.tick(db, settings, T0 + 70) == {"skipped": "disconnected"}
    ha_sync.STATE.connected = False
    assert runtime.janitor(db, T0)["alerts"] == 0
    assert runtime.janitor(db, T0 + 10) is None  # hourly


# ---------------------------------------------------------------- the real controller's entity list (redacted fixture)

def _load_dse(db):
    from pathlib import Path

    ents = json.loads((Path(__file__).parent / "fixtures" / "generator_dse8620_entities.json").read_text(encoding="utf-8"))
    with db.connection() as conn:
        conn.execute("INSERT INTO ha_devices(device_id, name, manufacturer, model, updated_at) VALUES ('dev_dse','Generator','Deep Sea Electronics','DSE 8620 MKII','2026-10-05T08:00:00Z')")
        for e in ents:
            conn.execute(
                """INSERT INTO ha_entities(entity_id, platform, device_id, name, domain, device_class, unit, entity_category, disabled, state, available, first_seen_at, updated_at)
                   VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)""",
                (e["entity_id"], "dse_8620", "dev_dse", e["name"], e["domain"], e["device_class"], e["unit"], e["category"], 1 if e["disabled"] else 0, e["state"],
                 0 if e["state"] == "unavailable" else 1, "2026-10-05T08:00:00Z", "2026-10-05T08:00:00Z"))
    return ents


def test_dse8620_profile_disabled_and_unavailable_are_absent(app):
    c, db, _ = app
    _load_dse(db)
    found = detect(db)
    assert len(found) == 1 and found[0]["kind"] == "integration" and found[0]["status"] == "detected"  # the known profile needs no setting
    g = gid(db)
    d = c.get(f"{API}/devices/{g}").json()
    roles = set(d["capabilities"]["roles"])
    assert {"engine_state", "controller_mode", "supply_source", "mains_available", "on_load", "load_on_mains", "generator_running", "mains_breaker_closed", "generator_breaker_closed",
            "warning_active", "shutdown_active", "trip_active", "battery_v", "charger_v", "rpm", "gen_hz", "gen_v_l1", "gen_v_l2", "gen_v_l3", "gen_a_l1", "gen_kw", "gen_kva",
            "mains_hz", "mains_v_l1", "monitoring_status", "last_poll_at"} <= roles, sorted(roles)
    assert "pf" not in roles  # reported unavailable by the controller right now: absent
    assert not roles & {"oil_pressure", "coolant_temp", "fuel_pct", "run_hours", "starts"}  # they exist only as disabled entities: capability off
    assert {"oil_pressure", "fuel_pct"} <= set(d["capabilities"]["disabled_roles"])
    avail = {t["key"] for t in d["alert_types"] if t["available"]}
    assert {"controller_warning", "controller_shutdown", "controller_trip", "mains_lost", "generator_started", "ats_to_gen", "controller_offline"} <= avail
    assert "low_fuel" not in avail and "fuel_shutdown" not in avail and "high_coolant_temp" not in avail
    assert d["values"]["supply_source"]["value"] == "mains" and d["values"]["engine_state"]["value"] == "stopped" and d["values"]["controller_mode"]["value"] == "auto"
    items = {r["role"]: r for r in c.get(f"{API}/devices/{g}/roles").json()["items"]}
    assert items["oil_pressure"]["mapped"] is False and items["oil_pressure"]["disabled_in_source"] is True
    # warning / shutdown flags raise the controller alert types
    set_state(db, "binary_sensor.gen_shutdown_active", "on")
    evaluate(db, T0)
    assert any(r["alert_key"] == "controller_shutdown" for r in rows(db, "SELECT alert_key FROM generator_alerts"))


def test_view_mode_preference(app):
    c, _, _ = app
    assert "gauges" in json.dumps(c.get("/api/v1/me/prefs").json())
    r = c.put("/api/v1/me/prefs", json={"generator.view_mode": "charts"})
    assert r.status_code == 200, r.text
    assert c.put("/api/v1/me/prefs", json={"generator.view_mode": "both"}).status_code == 422


# ---------------------------------------------------------------- several generators (unbounded): independent routing, alerts and state

def _three(db):
    out = []
    for i, sfx in enumerate(("", "2", "3")):
        make_generator(db, "full", device_id=f"dev_gen_{i}", name=f"גנרטור {i + 1}", model="DSE7320", suffix=sfx)
    detect(db)
    with db.connection(mode="read") as conn:
        out = [r["id"] for r in conn.execute("SELECT id FROM generator_devices ORDER BY name").fetchall()]
    return out


def test_three_generators_independent_routing_and_alerts(app):
    c, db, settings = app
    g1, g2, g3 = _three(db)
    assert len(c.get(f"{API}/devices").json()["devices"]) == 3
    bind(c, settings, "ops", "operator", "installation", "*")
    bind(c, settings, "adm", "site_admin", "installation", "*")
    ops_id = rows(db, "SELECT id FROM users WHERE username = 'ops'")[0]["id"]
    adm_id = rows(db, "SELECT id FROM users WHERE username = 'adm'")[0]["id"]
    # different routing for the SAME alert type on each generator
    assert c.put(f"{API}/devices/{g1}/policies/battery_low", json={"recipients": {"roles": ["operator"], "users": []}, "channels": ["push"], "severity": "critical"}).status_code == 200
    assert c.put(f"{API}/devices/{g2}/policies/battery_low", json={"recipients": {"roles": ["site_admin"], "users": []}, "channels": ["email"], "severity": "info"}).status_code == 200
    pol = {r["source"]: r for r in rows(db, "SELECT * FROM notify_policies WHERE source LIKE 'generator.battery_low@%'")}
    assert len(pol) == 2 and json.loads(pol[f"generator.battery_low@{g1}"]["channels_json"])["webpush"] is True and json.loads(pol[f"generator.battery_low@{g2}"]["channels_json"])["email"] is True
    assert pol[f"generator.battery_low@{g1}"]["severity"] == "critical" and pol[f"generator.battery_low@{g2}"]["severity"] == "info"
    assert c.get(f"{API}/devices/{g3}/policies").json()["items"][0]["policy"] is None  # the third generator has no routing
    # the same fault on all three; independent state
    for sfx in ("", "2", "3"):
        set_state(db, f"sensor.gen{sfx}_battery", "10")
    evaluate(db, T0)
    evaluate(db, T0 + 61)
    assert c.get(f"{API}/alerts", params={"state": "open", "type": "battery_low"}).json()["open_count"] == 3
    got = {}
    for g in (g1, g2, g3):
        n = rows(db, "SELECT id, severity, subject_id FROM notifications WHERE source = ?", f"generator.battery_low@{g}")
        assert len(n) == 1 and n[0]["subject_id"] == g
        got[g] = (n[0]["severity"], {r["user_id"] for r in rows(db, "SELECT user_id FROM notification_recipients WHERE notification_id = ?", n[0]["id"])})
    assert got[g1] == ("critical", {ops_id}) and got[g2] == ("info", {adm_id}) and got[g3][1] == set()
    # clearing one generator leaves the others open; acknowledging one does not touch the others
    set_state(db, "sensor.gen2_battery", "27")
    evaluate(db, T0 + 90)
    states = {g: c.get(f"{API}/alerts", params={"device_id": g, "type": "battery_low"}).json()["alerts"][0]["state"] for g in (g1, g2, g3)}
    assert states == {g1: "open", g2: "closed", g3: "open"}
    a3 = c.get(f"{API}/alerts", params={"device_id": g3, "state": "open"}).json()["alerts"][0]["id"]
    c.post(f"{API}/alerts/{a3}/ack")
    assert [x["acknowledged"] for x in c.get(f"{API}/alerts", params={"device_id": g1}).json()["alerts"]] == [False]
    # one generator's fuel problem raises only on that generator (hold timers are per generator)
    set_state(db, "sensor.gen3_fuel", "10")
    evaluate(db, T0 + 100)
    evaluate(db, T0 + 170)
    assert {(r["device_id"], r["alert_key"]) for r in rows(db, "SELECT device_id, alert_key FROM generator_alerts WHERE alert_key = 'low_fuel'")} == {(g3, "low_fuel")}
    # mute on one generator does not mute the others; reset is per generator
    am = c.get(f"{API}/alerts", params={"device_id": g1, "type": "battery_low"}).json()["alerts"][0]["id"]
    c.post(f"{API}/alerts/{am}/mute", json={"hours": 2})
    assert [r["device_id"] for r in rows(db, "SELECT device_id FROM generator_mutes")] == [g1]
    assert c.post(f"{API}/devices/{g1}/policies/reset").json() == {"reset": 1}
    assert len(rows(db, "SELECT * FROM generator_alert_policies")) == 1 and {r["source"] for r in rows(db, "SELECT source FROM notify_policies WHERE source LIKE 'generator.battery_low@%'")} == {f"generator.battery_low@{g2}", f"generator.battery_low@{g3}"}  # g1 reset; g3 only has its created defaults


def test_live_summary_history_and_retention_with_many_generators(app):
    c, db, _ = app
    g1, g2, g3 = _three(db)
    set_state(db, "sensor.gen2_engine_state", "Running")
    set_state(db, "sensor.gen3_fuel", "40")
    r = c.get(f"{API}/devices/live").json()
    assert [d["name"] for d in r["devices"]] == ["גנרטור 1", "גנרטור 2", "גנרטור 3"]
    by = {d["id"]: d for d in r["devices"]}
    assert by[g2]["summary"]["engine_state"]["value"] == "running" and by[g3]["summary"]["fuel_pct"]["value"] == 40 and by[g1]["summary"]["fuel_pct"]["value"] == 92
    assert "entity_id" not in json.dumps(r) and by[g1]["availability"] in ("online", "stale")
    now = int(dt.datetime.now(dt.timezone.utc).timestamp())
    with db.connection() as conn:
        assert history.record(conn, now) == 3 * 16  # every numeric role of every generator, one bulk read
    for g in (g1, g2, g3):
        assert c.get(f"{API}/devices/{g}/history", params={"roles": "fuel_pct", "range": "1h"}).json()["series"]["fuel_pct"]
    plan = rows(db, "EXPLAIN QUERY PLAN DELETE FROM generator_samples WHERE ts < 5")
    assert "idx_generator_samples_ts" in " ".join(str(tuple(x)) for x in plan)
    assert c.get(f"{API}/devices/live", headers=as_user("nobody")).status_code == 403
    # one generator removed from the registry leaves the others untouched
    with db.connection() as conn:
        conn.execute("UPDATE ha_devices SET removed_at = '2026-10-05T09:00:00Z' WHERE device_id = 'dev_gen_1'")
    detect(db)
    assert len(c.get(f"{API}/devices").json()["devices"]) == 2


# ---------------------------------------------------------------- message template per policy

def test_message_template(app):
    c, db, _ = app
    g = _full(db)
    url = f"{API}/devices/{g}/policies/low_fuel"
    pol = c.get(f"{API}/devices/{g}/policies").json()
    assert set(pol["placeholders"]) == {"name", "detail", "type", "severity"} and pol["template_max"] == 500
    item = next(i for i in pol["items"] if i["key"] == "low_fuel")
    assert item["policy"] is None and item["message_sample"]
    for bad in ("{oops}", "{name", "{name!r}", "{name:>10}", "{0}", "{name.x}"):
        r = c.put(url, json={"template_he": bad})
        assert r.status_code == 400 and r.json()["error"]["code"] == "template_invalid" if "error" in r.json() else r.status_code == 400, bad
    assert c.put(url, json={"template_he": "x" * 501}).status_code == 422
    r = c.post(f"{url}/preview", json={"template_he": "⚠ {type}: {detail} ({name}, {severity})"})
    assert r.json()["text"] == "⚠ מפלס דלק נמוך: מפלס הדלק 18% (גנרטור ראשי, התראה)"
    assert c.post(f"{url}/preview", json={"template_he": "{bad}"}).status_code == 400
    assert c.put(url, json={"template_he": "דחוף! {name} - {detail}"}).json()["template_he"] == "דחוף! {name} - {detail}"
    assert next(i for i in c.get(f"{API}/devices/{g}/policies").json()["items"] if i["key"] == "low_fuel")["policy"]["template_he"] == "דחוף! {name} - {detail}"
    set_state(db, "sensor.gen_fuel", "10")
    evaluate(db, T0)
    evaluate(db, T0 + 61)
    assert rows(db, "SELECT body FROM notifications WHERE source LIKE 'generator.low_fuel@%'")[0]["body"] == "דחוף! גנרטור ראשי - מפלס הדלק 10%"
    assert c.put(url, json={"template_he": None}).json()["template_he"] is None  # back to the built-in text
    set_state(db, "sensor.gen_fuel", "80")
    evaluate(db, T0 + 100)
    set_state(db, "sensor.gen_fuel", "5")
    evaluate(db, T0 + 2000)
    evaluate(db, T0 + 2100)
    assert [r["body"] for r in rows(db, "SELECT body FROM notifications WHERE source LIKE 'generator.low_fuel@%' ORDER BY first_at")][-1] == "גנרטור ראשי: מפלס הדלק 5%."
