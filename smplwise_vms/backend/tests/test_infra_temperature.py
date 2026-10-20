"""CR-INFRA-TEMPERATURE 2.9.1: temperature control under Infrastructure. A fake mirror and a fake clock only (no Home Assistant).

Negative cases first (validation, permissions, the uniform 404, no entity ids for operators), then the evaluator (warning from the first
moment, alarm after Z, hysteresis, door > X, offline, quiet hours and mute hold WARNINGS only, defrost windows below / above the hard max,
installation defaults vs per-unit overrides, a disconnected mirror changes nothing), statistics that exclude defrost time, the alert log and its
CSV, the acknowledge / mute acts, and the defrost learner on synthetic series (learning, learned, door rises ignored, reject persists)."""
from __future__ import annotations

import datetime as dt
import math
import random
from zoneinfo import ZoneInfo

import pytest
from conftest import as_user, bind
from fastapi.testclient import TestClient

from smplwise.db import Database, now_iso
from smplwise.services import temperature as t
from smplwise.services import temperature_defrost as learner
from smplwise.services import temperature_runtime as rt

API = "/api/v1/infra/temperature"
TZ = ZoneInfo("Asia/Jerusalem")
UTC = dt.timezone.utc
# 2026-10-19 10:00 local (07:00 UTC)
T0 = dt.datetime(2026, 10, 19, 7, 0, tzinfo=UTC).timestamp()


def iso(ts: float) -> str:
    return dt.datetime.fromtimestamp(ts, UTC).strftime("%Y-%m-%dT%H:%M:%SZ")


def add_entity(db: Database, eid: str, state: str, *, domain: str | None = None, unit: str | None = None, device_class: str | None = None, changed: str | None = None) -> None:
    dom = domain or eid.split(".")[0]
    at = changed or now_iso()
    with db.connection() as conn:
        conn.execute("""INSERT OR REPLACE INTO ha_entities (entity_id, name, domain, device_class, unit, state, available, last_changed, last_updated, first_seen_at, updated_at)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                     (eid, "שם " + eid.split(".")[1], dom, device_class, unit, state, 0 if state == "unavailable" else 1, at, at, at, at))


def set_state(db: Database, eid: str, state: str, changed: str | None = None) -> None:
    with db.connection() as conn:
        conn.execute("UPDATE ha_entities SET state = ?, available = ?, last_changed = COALESCE(?, last_changed) WHERE entity_id = ?",
                     (state, 0 if state == "unavailable" else 1, changed, eid))


@pytest.fixture()
def app(settings, monkeypatch):
    from smplwise.main import create_app
    from smplwise.routers import temperature as tr
    from smplwise.services import ha_sync

    ha_sync.STATE.connected = True
    rt.reset()
    clock = {"ts": T0}
    monkeypatch.setattr(tr, "now_ts", lambda: clock["ts"])
    c = TestClient(create_app(settings))
    c.get("/api/v1/me")  # joni becomes system_admin (bootstrap)
    db = Database(settings.db_path)
    add_entity(db, "sensor.fridge_temp", "4.0", unit="°C", device_class="temperature")
    add_entity(db, "sensor.freezer_temp", "-18.0", unit="°C", device_class="temperature")
    add_entity(db, "sensor.humidity", "40", unit="%", device_class="humidity")
    add_entity(db, "binary_sensor.fridge_door", "off", device_class="door")
    add_entity(db, "light.kitchen", "on")
    with db.connection() as conn:
        conn.execute("UPDATE infra_temp_units SET created_at = created_at")  # schema present
    yield c, db, settings, clock
    ha_sync.STATE.connected = False


def body(**kw):
    b = {"name": "מקרר מטבח", "temp_entity_id": "sensor.fridge_temp", "door_entity_id": "binary_sensor.fridge_door", "low": 2, "high": 6, "defrost_mode": "none"}
    b.update(kw)
    return b


def create(c, **kw):
    r = c.post(API, json=body(**kw))
    assert r.status_code == 201, r.text
    uid = r.json()["id"]
    return uid


def backdate(db: Database, uid: str, ts: float) -> None:
    with db.connection() as conn:
        conn.execute("UPDATE infra_temp_units SET created_at = ? WHERE id = ?", (iso(ts), uid))


def tick(db: Database, ts: float, connected: bool = True) -> dict:
    with db.connection() as conn:
        return rt.evaluate(conn, ts, connected=connected)


def run(db: Database, eid: str, values: list[float | str], start: float, step: int = 60) -> float:
    """Feeds one value per tick (a minute apart); returns the instant of the last tick."""
    ts = start
    for v in values:
        set_state(db, eid, str(v))
        tick(db, ts)
        ts += step
    return ts - step


def events(db: Database, uid: str) -> list[dict]:
    with db.connection(mode="read") as conn:
        return [dict(r) for r in conn.execute("SELECT * FROM infra_temp_events WHERE unit_id = ? ORDER BY started_at, rowid", (uid,)).fetchall()]


def notes(db: Database, source: str) -> list[dict]:
    with db.connection(mode="read") as conn:
        return [dict(r) for r in conn.execute("SELECT * FROM notifications WHERE source = ? ORDER BY created_at", (source,)).fetchall()]


# ---------------------------------------------------------------- validation (negative first)

@pytest.mark.parametrize("patch,code", [
    ({"temp_entity_id": "sensor.humidity"}, "not_temperature_sensor"),
    ({"temp_entity_id": "light.kitchen"}, "not_temperature_sensor"),
    ({"temp_entity_id": "sensor.nope"}, "sensor_not_found"),
    ({"door_entity_id": "sensor.freezer_temp"}, "not_door_sensor"),
    ({"door_entity_id": "binary_sensor.nope"}, "sensor_not_found"),
    ({"low": 6, "high": 6}, "band_invalid"),
    ({"low": 8, "high": 2}, "band_invalid"),
    ({"low": -100, "high": 2}, "band_invalid"),
    ({"rules": {"high_alarm_min": -1}}, "rule_invalid"),
    ({"rules": {"quiet_from": "25:00"}}, "rule_invalid"),
    ({"rules": {"nonsense": 1}}, "rule_invalid"),
    ({"rules": {"door_alarm": "yes"}}, "rule_invalid"),
    ({"rules": {"retention_days": 50}}, "rule_invalid"),  # installation-only, never per unit
    ({"defrost_mode": "fixed", "defrost_windows": []}, "defrost_invalid"),
    ({"defrost_mode": "fixed", "defrost_windows": [{"start": "3:00", "minutes": 30}]}, "defrost_invalid"),
    ({"defrost_mode": "fixed", "defrost_windows": [{"start": "03:00", "minutes": 500}]}, "defrost_invalid"),
])
def test_invalid_units_are_refused(app, patch, code):
    c, db, _s, _clk = app
    r = c.post(API, json=body(**patch))
    assert r.status_code == 422, r.text
    assert r.json()["code"] == code
    assert r.json()["details"]["message_en"]
    with db.connection(mode="read") as conn:
        assert conn.execute("SELECT COUNT(*) FROM infra_temp_units").fetchone()[0] == 0


def test_duplicate_name_and_unknown_area(app):
    c, *_ = app
    create(c)
    r = c.post(API, json=body(name="  מקרר   מטבח "))
    assert r.status_code == 409 and r.json()["code"] == "duplicate_name"
    r = c.post(API, json=body(name="אחר", area_id="no-area"))
    assert r.json()["code"] == "area_not_found"


def test_permission_matrix_and_no_entity_ids_for_operators(app):
    c, _db, settings, _clk = app
    uid = create(c)
    bind(c, settings, "ops", "operator", "installation", "*")
    bind(c, settings, "adm", "site_admin", "installation", "*")
    bind(c, settings, "vera", "viewer", "installation", "*")
    bind(c, settings, "kio", "kiosk", "installation", "*")
    o, a, v, k = as_user("ops"), as_user("adm"), as_user("vera"), as_user("kio")
    for h in (o, a, v):
        r = c.get(API, headers=h)
        assert r.status_code == 200
        assert c.get(f"{API}/{uid}", headers=h).status_code == 200
        assert c.get(f"{API}/{uid}/history", headers=h).status_code == 200
        assert c.get(f"{API}/events", headers=h).status_code == 200
    # operators and viewers never receive entity ids; a manager does
    for h in (o, v):
        txt = c.get(API, headers=h).text + c.get(f"{API}/{uid}", headers=h).text
        assert "sensor.fridge_temp" not in txt and "binary_sensor.fridge_door" not in txt
        assert c.get(API, headers=h).json()["units"][0]["temp_sensor_name"] == "שם fridge_temp"  # the friendly name instead
    assert c.get(API, headers=a).json()["units"][0]["temp_entity_id"] == "sensor.fridge_temp"
    assert c.get(API, headers=k).status_code == 403
    for h in (o, v):
        assert c.get(f"{API}/manage", headers=h).status_code == 403
        assert c.get(f"{API}/candidates", headers=h).status_code == 403
        assert c.post(API, json=body(name="x"), headers=h).status_code == 403
        assert c.put(f"{API}/{uid}", json=body(), headers=h).status_code == 403
        assert c.delete(f"{API}/{uid}", headers=h).status_code == 403
        assert c.put(f"{API}/settings", json={"rules": {}}, headers=h).status_code == 403
    # acknowledge / mute: operators yes, viewers no
    assert c.post(f"{API}/{uid}/mute", json={"minutes": 30}, headers=v).status_code == 403
    assert c.post(f"{API}/{uid}/mute", json={"minutes": 30}, headers=o).status_code == 200
    # alert routing: readable by the manager, writable only with system.configure
    assert c.get(f"{API}/alerts", headers=a).status_code == 200
    assert c.put(f"{API}/alerts", json={"kinds": {"warning": {"enabled": False}}}, headers=a).status_code == 403
    assert c.put(f"{API}/alerts", json={"kinds": {"warning": {"enabled": False}}}).status_code == 200


def test_unknown_unit_is_a_uniform_404(app):
    c, *_ = app
    assert c.get(f"{API}/nope").status_code == 404
    assert c.get(f"{API}/nope/history").status_code == 404
    assert c.post(f"{API}/nope/ack").status_code == 404


def test_candidates_list_degree_sensors_and_binary_sensors(app):
    c, *_ = app
    temps = [i["entity_id"] for i in c.get(f"{API}/candidates?kind=temp").json()["items"]]
    assert temps == sorted(temps, key=lambda e: "שם " + e.split(".")[1]) and "sensor.humidity" not in temps and "sensor.fridge_temp" in temps
    doors = c.get(f"{API}/candidates?kind=door").json()["items"]
    assert [d["entity_id"] for d in doors] == ["binary_sensor.fridge_door"] and doors[0]["state"] == "off"
    assert c.get(f"{API}/candidates?kind=temp&q=freezer").json()["items"][0]["value"] == -18.0


# ---------------------------------------------------------------- pure helpers

def test_quiet_hours_and_windows_cross_midnight():
    r = {**t.code_defaults(), "quiet_enabled": True, "quiet_from": "23:00", "quiet_to": "06:00"}
    assert t.in_quiet(r, 23 * 60) and t.in_quiet(r, 2 * 60) and t.in_quiet(r, 5 * 60 + 59)
    assert not t.in_quiet(r, 6 * 60) and not t.in_quiet(r, 12 * 60)
    assert not t.in_quiet({**r, "quiet_enabled": False}, 2 * 60)
    assert t.in_defrost([(23 * 60 + 50, 30)], 10) and not t.in_defrost([(23 * 60 + 50, 30)], 25)
    assert t.windows_of("none", [{"start": "03:00", "minutes": 30}], []) == []
    assert t.windows_of("fixed", [{"start": "03:00", "minutes": 30}], []) == [(180, 30)]
    assert t.windows_of("learn", [], [{"start_min": 180, "minutes": 30, "status": "rejected"}, {"start_min": 900, "minutes": 40, "status": "learned"}]) == [(900, 40)]


def test_readings_parse_live_numbers_only_and_convert_fahrenheit():
    assert t.temp_of("4.25") == 4.25
    assert t.temp_of("unavailable") is None and t.temp_of("unknown") is None and t.temp_of("abc") is None and t.temp_of("nan") is None
    assert t.temp_of("4", available=0) is None and t.temp_of("4", connected=False) is None
    assert t.temp_of("41", unit="°F") == 5.0
    assert t.door_of("on") is True and t.door_of("off") is False and t.door_of("on", invert=True) is False and t.door_of("unavailable") is None


# ---------------------------------------------------------------- the evaluator (fake clock)

def test_warning_from_the_first_moment_then_alarm_after_z_and_hysteresis(app):
    c, db, *_ = app
    uid = create(c, rules={"high_alarm_min": 5})
    ts = run(db, "sensor.fridge_temp", [4.0, 4.5, 6.5], T0)
    ev = [e for e in events(db, uid) if e["kind"] == "high"]
    assert len(ev) == 1 and ev[0]["severity"] == "warning" and ev[0]["warned_at"] == iso(ts) and ev[0]["alarmed_at"] is None
    assert len(notes(db, "temperature.warning")) == 1 and not notes(db, "temperature.alarm")
    assert c.get(API).json()["units"][0]["status"] == "warning"
    ts = run(db, "sensor.fridge_temp", [6.8] * 5, ts + 60)  # 5 minutes after the excursion began
    ev = [e for e in events(db, uid) if e["kind"] == "high"][0]
    assert ev["severity"] == "alarm" and ev["alarmed_at"] is not None and ev["peak"] == 6.8
    assert notes(db, "temperature.warning")[0]["state"] == "resolved"  # the warning gave way to the alarm
    assert len(notes(db, "temperature.alarm")) == 1 and notes(db, "temperature.alarm")[0]["severity"] == "critical"
    assert c.get(API).json()["units"][0]["status"] == "alarm"
    # inside the band but within the hysteresis: still open; 0.3 inside: closed
    ts = run(db, "sensor.fridge_temp", [5.9], ts + 60)
    assert [e for e in events(db, uid) if e["kind"] == "high"][0]["ended_at"] is None
    ts = run(db, "sensor.fridge_temp", [5.6], ts + 60)
    ev = [e for e in events(db, uid) if e["kind"] == "high"][0]
    assert ev["ended_at"] == iso(ts) and ev["value"] == 5.6
    assert notes(db, "temperature.alarm")[0]["state"] == "resolved"
    assert c.get(API).json()["units"][0]["status"] == "ok"


def test_low_excursion_and_the_alarm_switch_off(app):
    c, db, *_ = app
    uid = create(c, rules={"low_alarm": False, "low_alarm_min": 1})
    run(db, "sensor.fridge_temp", [1.5] * 10, T0)
    ev = [e for e in events(db, uid) if e["kind"] == "low"][0]
    assert ev["severity"] == "warning" and ev["alarmed_at"] is None and ev["threshold"] == 2


def test_warning_off_means_only_the_alarm_notifies(app):
    c, db, *_ = app
    uid = create(c, rules={"warn_on_excursion": False, "high_alarm_min": 2})
    run(db, "sensor.fridge_temp", [7.0, 7.0], T0)
    assert not notes(db, "temperature.warning")
    run(db, "sensor.fridge_temp", [7.0], T0 + 120)
    assert len(notes(db, "temperature.alarm")) == 1
    assert [e for e in events(db, uid) if e["kind"] == "high"][0]["warned_at"] is None


def test_quiet_hours_hold_warnings_but_never_alarms(app):
    c, db, *_ = app
    uid = create(c, rules={"quiet_enabled": True, "quiet_from": "09:00", "quiet_to": "10:30", "high_alarm_min": 3})  # T0 = 10:00 local
    ts = run(db, "sensor.fridge_temp", [7.0, 7.0], T0)
    ev = [e for e in events(db, uid) if e["kind"] == "high"][0]
    assert ev["suppressed"] == "quiet" and not notes(db, "temperature.warning")
    ts = run(db, "sensor.fridge_temp", [7.0, 7.0], ts + 60)
    assert len(notes(db, "temperature.alarm")) == 1  # 10:03 local, still quiet: the alarm passes
    # a fresh warning in quiet hours that still holds when they end is notified then
    uid2 = create(c, name="מקפיא", temp_entity_id="sensor.freezer_temp", door_entity_id=None, low=-22, high=-16,
                  rules={"quiet_enabled": True, "quiet_from": "09:00", "quiet_to": "10:30", "high_alarm": False})
    run(db, "sensor.freezer_temp", [-15.0], T0 + 10 * 60)
    assert [e for e in events(db, uid2) if e["kind"] == "high"][0]["suppressed"] == "quiet"
    before = len(notes(db, "temperature.warning"))
    run(db, "sensor.freezer_temp", [-15.0], T0 + 31 * 60)  # 10:31 local
    assert len(notes(db, "temperature.warning")) == before + 1
    assert [e for e in events(db, uid2) if e["kind"] == "high"][0]["suppressed"] is None


def test_mute_holds_warnings_only_and_is_logged(app):
    c, db, settings, clk = app
    uid = create(c, rules={"high_alarm_min": 2})
    r = c.post(f"{API}/{uid}/mute", json={"minutes": 60})
    assert r.status_code == 200 and r.json()["muted_until"] == iso(T0 + 3600)
    ts = run(db, "sensor.fridge_temp", [7.0], T0 + 60)
    assert not notes(db, "temperature.warning")
    assert [e for e in events(db, uid) if e["kind"] == "high"][0]["suppressed"] == "mute"
    run(db, "sensor.fridge_temp", [7.0, 7.0], ts + 60)
    assert len(notes(db, "temperature.alarm")) == 1  # never muted
    mute = [e for e in events(db, uid) if e["kind"] == "mute"]
    assert len(mute) == 1 and mute[0]["ack_by"] and mute[0]["severity"] == "info"
    assert c.post(f"{API}/{uid}/mute", json={"until_defrost_end": True}).status_code == 422  # no defrost window
    assert c.delete(f"{API}/{uid}/mute").json()["muted_until"] is None


def test_door_open_longer_than_x_is_an_alarm_until_closed(app):
    c, db, *_ = app
    uid = create(c, rules={"door_alarm_min": 3})
    set_state(db, "binary_sensor.fridge_door", "on", changed=iso(T0))
    for i in range(3):
        tick(db, T0 + i * 60)
    assert not [e for e in events(db, uid) if e["kind"] == "door"]
    tick(db, T0 + 180)
    ev = [e for e in events(db, uid) if e["kind"] == "door"][0]
    assert ev["severity"] == "alarm" and ev["started_at"] == iso(T0) and len(notes(db, "temperature.alarm")) == 1
    u = c.get(API).json()["units"][0]
    assert u["status"] == "alarm" and u["door"]["open"] is True
    set_state(db, "binary_sensor.fridge_door", "off", changed=iso(T0 + 200))
    tick(db, T0 + 240)
    ev = [e for e in events(db, uid) if e["kind"] == "door"][0]
    assert ev["ended_at"] == iso(T0 + 240) and notes(db, "temperature.alarm")[0]["state"] == "resolved"
    with db.connection(mode="read") as conn:
        d = conn.execute("SELECT * FROM infra_temp_doors WHERE unit_id = ?", (uid,)).fetchone()
    assert d["opened_at"] == iso(T0) and d["closed_at"] == iso(T0 + 200)


def test_inverted_door_sensor(app):
    c, db, *_ = app
    uid = create(c, door_invert=True, rules={"door_alarm_min": 1})
    set_state(db, "binary_sensor.fridge_door", "on", changed=iso(T0))  # on = closed
    tick(db, T0)
    tick(db, T0 + 120)
    assert not [e for e in events(db, uid) if e["kind"] == "door"]
    assert c.get(API).json()["units"][0]["door"]["open"] is False


def test_offline_after_n_minutes_and_back(app):
    c, db, *_ = app
    uid = create(c, rules={"offline_min": 10})
    backdate(db, uid, T0)
    run(db, "sensor.fridge_temp", [4.0], T0)
    set_state(db, "sensor.fridge_temp", "unavailable")
    for m in range(1, 10):
        tick(db, T0 + m * 60)
    assert not [e for e in events(db, uid) if e["kind"] == "offline"]
    assert c.get(API).json()["units"][0]["status"] == "offline"  # no live reading is never "ok"
    tick(db, T0 + 600)
    ev = [e for e in events(db, uid) if e["kind"] == "offline"][0]
    assert ev["severity"] == "warning" and ev["value"] == 4.0 and len(notes(db, "temperature.offline")) == 1
    run(db, "sensor.fridge_temp", [4.1], T0 + 660)
    assert [e for e in events(db, uid) if e["kind"] == "offline"][0]["ended_at"] == iso(T0 + 660)


def test_disconnected_mirror_changes_nothing(app):
    c, db, *_ = app
    uid = create(c)
    set_state(db, "sensor.fridge_temp", "9")
    assert tick(db, T0, connected=False) == {"sampled": 0, "opened": 0, "alarmed": 0, "closed": 0, "notified": 0}
    assert events(db, uid) == []


def test_defrost_window_holds_below_the_hard_max_and_not_above(app):
    c, db, *_ = app
    # 10:00 local = T0: a fixed window 09:50 for 30 minutes; band -22..-16, hard margin 5 -> hard max -11
    uid = create(c, name="מקפיא", temp_entity_id="sensor.freezer_temp", door_entity_id=None, low=-22, high=-16, defrost_mode="fixed",
                 defrost_windows=[{"start": "09:50", "minutes": 30}], rules={"high_alarm_min": 2})
    run(db, "sensor.freezer_temp", [-14.0, -13.0, -12.0], T0)
    kinds = [e["kind"] for e in events(db, uid)]
    assert "high" not in kinds and kinds.count("defrost") == 1
    assert c.get(API).json()["units"][0]["defrost"]["in_window"] is True
    run(db, "sensor.freezer_temp", [-10.0, -10.0, -10.0], T0 + 180)  # above the hard max: judged as usual
    high = [e for e in events(db, uid) if e["kind"] == "high"][0]
    assert high["severity"] == "alarm"
    # the samples carry the defrost flag
    with db.connection(mode="read") as conn:
        assert conn.execute("SELECT COUNT(*) FROM infra_temp_samples WHERE unit_id = ? AND flags & 1", (uid,)).fetchone()[0] == 6


def test_installation_defaults_and_per_unit_override(app):
    c, db, *_ = app
    r = c.put(f"{API}/settings", json={"rules": {"high_alarm_min": 2, "retention_days": 90}})
    assert r.status_code == 200 and r.json()["rules"]["high_alarm_min"] == 2 and r.json()["rules"]["retention_days"] == 90
    assert c.put(f"{API}/settings", json={"rules": {"high_alarm_min": 2}, "row_version": 0}).status_code == 409
    u1 = create(c)
    u2 = create(c, name="מקרר 2", door_entity_id=None, rules={"high_alarm_min": 30})
    add_entity(db, "sensor.fridge2", "4", unit="°C", device_class="temperature")
    c.put(f"{API}/{u2}", json=body(name="מקרר 2", temp_entity_id="sensor.fridge2", door_entity_id=None, rules={"high_alarm_min": 30}))
    for i in range(3):
        set_state(db, "sensor.fridge2", "7")
        set_state(db, "sensor.fridge_temp", "7")
        tick(db, T0 + i * 60)
    assert [e for e in events(db, u1) if e["kind"] == "high"][0]["severity"] == "alarm"  # the installation's 2 minutes
    assert [e for e in events(db, u2) if e["kind"] == "high"][0]["severity"] == "warning"  # its own 30 minutes
    m = c.get(f"{API}/manage").json()
    assert next(u for u in m["units"] if u["id"] == u2)["rules"] == {"high_alarm_min": 30}
    assert m["defaults"]["high_alarm_min"] == 2


def test_statistics_exclude_defrost_time_but_the_raw_count_keeps_it(app):
    c, db, _s, clk = app
    clk["ts"] = T0 + 20 * 60
    uid = create(c, name="מקפיא", temp_entity_id="sensor.freezer_temp", door_entity_id=None, low=-22, high=-16, defrost_mode="fixed",
                 defrost_windows=[{"start": "10:00", "minutes": 10}])
    vals = [-14.0] * 10 + [-14.0] * 5 + [-19.0] * 5  # 10 minutes inside the window, 5 above the band outside it
    run(db, "sensor.freezer_temp", vals, T0)
    st = c.get(f"{API}/{uid}/history?range=24h").json()["stats"]
    assert st["out_min_raw"] == 15 and st["out_min"] == 5 and st["max"] == -14.0 and st["min"] == -19.0
    c.put(f"{API}/{uid}", json=body(name="מקפיא", temp_entity_id="sensor.freezer_temp", door_entity_id=None, low=-22, high=-16, defrost_mode="fixed",
                                    defrost_windows=[{"start": "10:00", "minutes": 10}], rules={"exclude_defrost_stats": False}))
    assert c.get(f"{API}/{uid}/history?range=24h").json()["stats"]["out_min"] == 15


def test_history_series_points_and_ranges(app):
    c, db, _s, clk = app
    uid = create(c)
    run(db, "sensor.fridge_temp", [4.0 + i / 100 for i in range(30)], T0)
    clk["ts"] = T0 + 30 * 60
    h = c.get(f"{API}/{uid}/history?range=24h&points=1500").json()
    assert h["source"] == "raw" and len(h["points"]) == 30 and h["low"] == 2 and h["high"] == 6
    h7 = c.get(f"{API}/{uid}/history?range=7d").json()
    assert h7["source"] == "5m" and 1 <= len(h7["points"]) <= 6  # five-minute buckets, merged to stay under the point budget
    assert c.get(f"{API}/{uid}/history?range=custom&from=2026-10-19T06:00:00Z&to=2026-10-19T08:00:00Z").status_code == 200
    assert c.get(f"{API}/{uid}/history?range=custom&from=2026-10-19T06:00:00").status_code == 422  # no zone
    assert c.get(f"{API}/{uid}/history?range=custom&from=2026-10-19T08:00:00Z&to=2026-10-19T06:00:00Z").status_code == 422


# ---------------------------------------------------------------- acknowledge, log, CSV

def test_ack_logs_who_and_acknowledges_the_notification(app):
    c, db, settings, clk = app
    clk["ts"] = T0 + 3600
    uid = create(c, rules={"high_alarm_min": 1})
    assert c.post(f"{API}/{uid}/ack").status_code == 409  # nothing open
    run(db, "sensor.fridge_temp", [7.0, 7.0], T0)
    r = c.post(f"{API}/{uid}/ack")
    assert r.status_code == 200 and r.json()["acked"] == 1
    assert notes(db, "temperature.alarm")[0]["state"] == "acknowledged"
    u = c.get(API).json()["units"][0]
    assert u["events"][0]["ack_by_name"] and u["events"][0]["ack_at"]
    log = c.get(f"{API}/events").json()
    assert [e["kind"] for e in log["events"]].count("ack") == 1 and log["total"] == 2


def test_log_filters_and_csv(app):
    c, db, _s, clk = app
    clk["ts"] = T0 + 3600
    uid = create(c, name="=HYPERLINK(1)", rules={"high_alarm_min": 1, "door_alarm_min": 1})
    run(db, "sensor.fridge_temp", [7.0, 7.0, 5.0], T0)
    set_state(db, "binary_sensor.fridge_door", "on", changed=iso(T0))
    tick(db, T0 + 300)
    all_ = c.get(f"{API}/events").json()
    assert {e["kind"] for e in all_["events"]} == {"high", "door"}
    assert all(e["unit_name"] == "=HYPERLINK(1)" for e in all_["events"])
    assert [e["kind"] for e in c.get(f"{API}/events?kind=door").json()["events"]] == ["door"]
    assert c.get(f"{API}/events?kind=temp&severity=warning").json()["total"] == 0
    assert c.get(f"{API}/events?unit={uid}&severity=alarm").json()["total"] == 2
    r = c.get(f"{API}/events.csv")
    assert r.status_code == 200 and r.headers["content-type"].startswith("text/csv") and "attachment" in r.headers["content-disposition"]
    text = r.content.decode("utf-8")
    assert text.startswith("﻿") and "זמן מקומי" in text and "'=HYPERLINK(1)" in text and "אזעקה" in text
    assert "Local time" in c.get(f"{API}/events.csv?lang=en").content.decode("utf-8")


def test_recipients_default_to_the_managers_and_a_unit_may_replace_them(app):
    c, db, settings, _clk = app
    bind(c, settings, "ops", "operator", "installation", "*")
    bind(c, settings, "adm", "site_admin", "installation", "*")
    uid = create(c, rules={"high_alarm_min": 1})
    run(db, "sensor.fridge_temp", [7.0], T0)
    with db.connection(mode="read") as conn:
        n = conn.execute("SELECT id FROM notifications WHERE source = 'temperature.warning'").fetchone()
        rec = {r[0] for r in conn.execute("SELECT user_id FROM notification_recipients WHERE notification_id = ?", (n[0],)).fetchall()}
    assert "dev-adm" in rec and "dev-ops" not in rec  # warnings: site and system administrators
    run(db, "sensor.fridge_temp", [7.0], T0 + 60)
    with db.connection(mode="read") as conn:
        n = conn.execute("SELECT id FROM notifications WHERE source = 'temperature.alarm'").fetchone()
        rec = {r[0] for r in conn.execute("SELECT user_id FROM notification_recipients WHERE notification_id = ?", (n[0],)).fetchall()}
    assert {"dev-adm", "dev-ops"} <= rec  # alarms: the operators too
    r = c.put(f"{API}/{uid}", json=body(rules={"high_alarm_min": 1}, recipients={"users": ["dev-ops"]}))
    assert r.status_code == 200 and r.json()["recipients"] == {"roles": [], "users": ["dev-ops"], "groups": []}
    assert c.put(f"{API}/{uid}", json=body(recipients={"users": ["ghost"]})).json()["code"] == "recipient_user"


def test_disabling_or_deleting_a_unit_closes_its_alerts(app):
    c, db, *_ = app
    uid = create(c, rules={"high_alarm_min": 1})
    run(db, "sensor.fridge_temp", [7.0, 7.0], T0)
    assert notes(db, "temperature.alarm")[0]["state"] == "open"
    assert c.put(f"{API}/{uid}", json=body(rules={"high_alarm_min": 1}, enabled=False)).status_code == 200
    assert notes(db, "temperature.alarm")[0]["state"] == "resolved"
    assert all(e["ended_at"] for e in events(db, uid))
    assert c.get(API).json()["units"] == []
    assert c.delete(f"{API}/{uid}").status_code == 204
    assert events(db, uid) == []


def test_audit_rows_carry_ids_only(app):
    c, db, *_ = app
    uid = create(c)
    with db.connection(mode="read") as conn:
        rows = conn.execute("SELECT * FROM audit_log WHERE action LIKE 'infra.temperature.%'").fetchall()
    assert rows and all("fridge" not in str(dict(r)) and "מקרר" not in str(dict(r)) for r in rows)
    assert rows[0]["resource_id"] == uid


# ---------------------------------------------------------------- the defrost learner (synthetic series)

def _series(days: int, *, windows=((180, 28), (900, 28)), base=-19.0, amp=1.2, seed=1, start_local=dt.datetime(2026, 10, 10, 0, 0)):
    random.seed(seed)
    start = start_local.replace(tzinfo=TZ).timestamp()
    pts = []
    for k in range(days * 288):
        ts = start + k * 300
        v = base + math.sin(ts / 3600 * 2 * math.pi / 2.5 + seed) * amp + random.uniform(-0.25, 0.25)
        loc = dt.datetime.fromtimestamp(ts, TZ)
        m = loc.hour * 60 + loc.minute
        for s, n in windows:
            if s <= m < s + n:
                v += 4.5 * math.sin((m - s) / n * math.pi)
        pts.append((ts, v))
    return pts


RULES = {"learn_min_repeats": 3, "defrost_max_min": 60}


@pytest.mark.parametrize("seed", [1, 2, 3])
def test_learner_finds_the_daily_defrost_cycles(seed):
    res = learner.learn(_series(7, seed=seed), [], -22, -16, RULES, TZ)
    assert res["state"] == "learned"
    starts = [w["start_min"] for w in res["windows"]]
    assert len(starts) == 2
    assert 160 <= starts[0] <= 185 and 880 <= starts[1] <= 905
    for w in res["windows"]:
        assert 30 <= w["minutes"] <= 75 and w["repeats"] >= 5


def test_learner_is_learning_until_enough_days_and_finds_nothing_without_a_pattern():
    assert learner.learn(_series(2), [], -22, -16, RULES, TZ)["state"] == "learning"
    assert learner.learn(_series(7, windows=(), base=4.0), [], 2, 6, RULES, TZ)["state"] == "none_found"


def test_learner_ignores_rises_explained_by_the_door():
    pts = _series(7, windows=((600, 25),), base=4.0, amp=0.4)
    doors = []
    for d in range(7):
        a = (dt.datetime(2026, 10, 10, 10, 0, tzinfo=TZ) + dt.timedelta(days=d)).timestamp() - 120
        doors.append((a, a + 300))
    assert learner.learn(pts, doors, 2, 6, RULES, TZ)["state"] == "none_found"
    assert learner.learn(pts, [], 2, 6, RULES, TZ)["state"] == "learned"


def test_circular_median_across_midnight():
    assert learner.circular_median([1430, 5, 10]) == 5
    assert learner.circular_median([100, 110, 120]) == 110


def test_learner_storage_confirm_reject_clear(app):
    c, db, *_ = app
    uid = create(c, name="מקפיא", temp_entity_id="sensor.freezer_temp", door_entity_id=None, low=-22, high=-16, defrost_mode="learn")
    pts = _series(7, start_local=dt.datetime(2026, 10, 12, 0, 0))
    with db.connection() as conn:
        for ts, v in pts:
            conn.execute("INSERT INTO infra_temp_samples_5m(unit_id, ts, v_avg, v_min, v_max, n) VALUES (?,?,?,?,?,5)", (uid, int(ts), v, v, v))
        now = pts[-1][0] + 300
        assert rt.run_learner(conn, now, force=True) == 1
    u = c.get(API).json()["units"][0]
    assert u["defrost"]["state"] == "learned" and len(u["defrost"]["windows"]) == 2 and all(w["status"] == "learned" for w in u["defrost"]["windows"])
    first, second = (w["start_min"] for w in u["defrost"]["windows"])
    assert c.post(f"{API}/{uid}/defrost/{first}/confirm").status_code == 200
    assert c.post(f"{API}/{uid}/defrost/{second}/reject").status_code == 200
    assert c.post(f"{API}/{uid}/defrost/7/confirm").status_code == 404
    with db.connection() as conn:
        rt.run_learner(conn, now + 3600, force=True)
    ws = {w["start_min"]: w["status"] for w in c.get(API).json()["units"][0]["defrost"]["windows"]}
    assert ws == {first: "confirmed", second: "rejected"}  # the rejected one is not suggested again
    assert c.delete(f"{API}/{uid}/defrost/learned").status_code == 204
    assert c.get(API).json()["units"][0]["defrost"]["windows"] == []


# ---------------------------------------------------------------- climate units (owner 2026-10-19: air conditioners / HVAC / thermostats)

def add_climate(db: Database, eid: str, mode: str, cur: float | None, sp: float | None, action: str | None = None, **extra) -> None:
    import json as _json

    attrs = {"current_temperature": cur, "temperature": sp, "hvac_action": action, **extra}
    at = now_iso()
    with db.connection() as conn:
        conn.execute("""INSERT OR REPLACE INTO ha_entities (entity_id, name, domain, state, attributes_json, available, last_changed, last_updated, first_seen_at, updated_at)
                        VALUES (?, ?, 'climate', ?, ?, 1, ?, ?, ?, ?)""", (eid, "מזגן " + eid.split(".")[1], mode, _json.dumps(attrs), at, at, at, at))


def test_climate_reading_band_and_off_are_pure():
    row = {"domain": "climate", "state": "cool", "attributes_json": '{"current_temperature": 23.4, "temperature": 22, "hvac_action": "cooling"}',
           "available": 1, "removed_at": None, "disabled": 0, "unit": None}
    r = t.reading_of(row)
    assert r == {"source": "climate", "value": 23.4, "setpoint": 22.0, "setpoint_low": None, "setpoint_high": None, "hvac_mode": "cool", "hvac_action": "cooling"}
    u = {"band_mode": "setpoint", "low": 18, "high": 26}
    assert t.band_of(u, r, {"setpoint_tolerance": 1.5}) == (20.5, 23.5)
    assert t.band_of({**u, "band_mode": "fixed"}, r, {"setpoint_tolerance": 1.5}) == (18.0, 26.0)
    rng = t.reading_of({**row, "state": "heat_cool", "attributes_json": '{"current_temperature": 21, "target_temp_low": 20, "target_temp_high": 24}'})
    assert rng["setpoint"] == 22.0 and t.band_of(u, rng, {"setpoint_tolerance": 1}) == (19.0, 25.0)
    off = t.reading_of({**row, "state": "off"})
    assert t.is_off(off, {"alert_when_off": False}) and not t.is_off(off, {"alert_when_off": True}) and not t.is_off(r, {})
    assert t.reading_of({**row, "state": "unavailable"})["value"] is None
    assert t.band_of(u, {**r, "setpoint": None}, {"setpoint_tolerance": 1}) == (18.0, 26.0)  # no setpoint: the stored band


def test_climate_unit_end_to_end(app):
    c, db, _s, clk = app
    add_climate(db, "climate.server_ac", "cool", 22.0, 22.0, "cooling")
    cands = c.get(f"{API}/candidates?kind=temp").json()["items"]
    ac = next(i for i in cands if i["entity_id"] == "climate.server_ac")
    assert ac["group"] == "climate" and ac["value"] == 22.0 and ac["setpoint"] == 22.0 and ac["hvac_mode"] == "cool"
    assert cands[0]["group"] == "sensor" and cands[-1]["group"] == "climate"  # sensors first, then climate entities
    # a setpoint band is only for a climate entity
    assert c.post(API, json=body(name="x", band_mode="setpoint")).status_code == 422
    uid = create(c, name="חדר שרתים", kind="server", temp_entity_id="climate.server_ac", door_entity_id=None, low=18, high=26, band_mode="setpoint",
                 rules={"setpoint_tolerance": 2, "high_alarm_min": 2})
    with db.connection() as conn:
        rt.evaluate(conn, T0, connected=True)
    clk["ts"] = T0 + 60
    u = c.get(API).json()["units"][0]
    assert u["source"] == "climate" and u["value"] == 22.0 and (u["low"], u["high"]) == (20.0, 24.0)
    assert u["hvac"] == {"setpoint": 22.0, "setpoint_low": None, "setpoint_high": None, "hvac_mode": "cool", "hvac_action": "cooling"}
    assert "climate.server_ac" not in c.get(API, headers=as_user("nobody")).text
    # the current temperature climbs over setpoint + tolerance: warning, then alarm after 2 minutes
    for i, v in enumerate([24.5, 25.0, 25.5]):
        add_climate(db, "climate.server_ac", "cool", v, 22.0, "cooling")
        with db.connection() as conn:
            rt.evaluate(conn, T0 + 60 * (i + 1), connected=True)
    assert [e for e in events(db, uid) if e["kind"] == "high"][0]["severity"] == "alarm"
    # both series are stored: the reading and the setpoint
    with db.connection(mode="read") as conn:
        rows = conn.execute("SELECT v, sp FROM infra_temp_samples WHERE unit_id = ? ORDER BY ts", (uid,)).fetchall()
    assert [(r["v"], r["sp"]) for r in rows] == [(22.0, 22.0), (24.5, 22.0), (25.0, 22.0), (25.5, 22.0)]
    clk["ts"] = T0 + 300
    h = c.get(f"{API}/{uid}/history?range=24h&points=1500").json()
    assert h["points"][0][5] == 22.0 and len(h["points"]) == 4
    sp = c.get(API).json()["units"][0]["spark"]
    assert sp and all(len(p) == 3 and p[2] == 22.0 for p in sp)  # [ts, value, setpoint]
    # switched off: a state, not an alarm - the band rows end with a stated reason
    add_climate(db, "climate.server_ac", "off", 27.0, 22.0, "off")
    with db.connection() as conn:
        rt.evaluate(conn, T0 + 300, connected=True)
    ev = [e for e in events(db, uid) if e["kind"] == "high"][0]
    assert ev["ended_at"] == iso(T0 + 300) and '"closed": "off"' in ev["detail_json"]
    assert notes(db, "temperature.alarm")[0]["state"] == "resolved"
    assert c.get(API).json()["units"][0]["status"] == "off"
    with db.connection() as conn:
        rt.evaluate(conn, T0 + 360, connected=True)
    assert len([e for e in events(db, uid) if e["kind"] == "high"]) == 1  # still off: nothing new
    # ... unless the rule says so
    r = c.put(f"{API}/{uid}", json=body(name="חדר שרתים", kind="server", temp_entity_id="climate.server_ac", door_entity_id=None, low=18, high=26, band_mode="setpoint",
                                        rules={"setpoint_tolerance": 2, "alert_when_off": True}))
    assert r.status_code == 200
    with db.connection() as conn:
        rt.evaluate(conn, T0 + 420, connected=True)
    assert len([e for e in events(db, uid) if e["kind"] == "high" and e["ended_at"] is None]) == 1


def test_climate_unit_with_fixed_band_and_a_sensor_unit_side_by_side(app):
    c, db, _s, clk = app
    add_climate(db, "climate.office", "heat", 21.0, 23.0, "heating")
    u1 = create(c, name="משרד", kind="room", temp_entity_id="climate.office", door_entity_id=None, low=18, high=26)
    u2 = create(c)
    run(db, "sensor.fridge_temp", [4.0], T0)
    clk["ts"] = T0 + 60
    units = {u["id"]: u for u in c.get(API).json()["units"]}
    assert (units[u1]["low"], units[u1]["high"]) == (18, 26) and units[u1]["status"] == "ok" and units[u1]["hvac"]["hvac_action"] == "heating"
    assert units[u2]["source"] == "sensor" and units[u2]["hvac"] is None and units[u2]["status"] == "ok"


# ---------------------------------------------------------------- DST (gate-hygiene finding): window starts are local instants of the zone

def _utc(*a) -> float:
    return dt.datetime(*a, tzinfo=UTC).timestamp()


@pytest.mark.parametrize("now,windows,expected", [
    # fall-back night 25.10.2026 (02:00 IDT -> 01:00 IST): from 00:30 IDT the 03:00 window is 03:00 IST = 01:00Z (the old code said 00:00Z)
    (_utc(2026, 10, 24, 21, 30), [(180, 30)], _utc(2026, 10, 25, 1, 0)),
    # the repeated hour: 01:30 is ambiguous -> its FIRST occurrence (01:30 IDT = 22:30Z on 24.10)
    (_utc(2026, 10, 24, 21, 0), [(90, 30)], _utc(2026, 10, 24, 22, 30)),
    # ... and once the first 01:30 has passed, the next start is the next day's 01:30 IST, never the second 01:30 of the same night
    (_utc(2026, 10, 24, 22, 45), [(90, 30)], _utc(2026, 10, 25, 23, 30)),
    # spring-forward night 27.03.2026 (02:00 IST -> 03:00 IDT): 03:00 is 03:00 IDT = 00:00Z
    (_utc(2026, 3, 26, 22, 30), [(180, 30)], _utc(2026, 3, 27, 0, 0)),
    # the skipped hour: 02:30 does not exist -> moved forward by the gap to 03:30 IDT = 00:30Z
    (_utc(2026, 3, 26, 22, 30), [(150, 30)], _utc(2026, 3, 27, 0, 30)),
    # an ordinary day: the earliest of several windows; a window that just started is not "next"
    (_utc(2026, 7, 1, 0, 0), [(180, 30), (900, 30)], _utc(2026, 7, 1, 12, 0)),
])
def test_next_window_start_is_dst_correct(now, windows, expected):
    tz = ZoneInfo("Asia/Jerusalem")
    assert t.next_window_start(windows, now, tz) == expected


def test_local_instant_and_window_intervals_across_both_transitions():
    tz = ZoneInfo("Asia/Jerusalem")
    assert t.local_instant(dt.date(2026, 10, 25), 90, tz) == _utc(2026, 10, 24, 22, 30)   # ambiguous -> first
    assert t.local_instant(dt.date(2026, 3, 27), 150, tz) == _utc(2026, 3, 27, 0, 30)     # non-existent -> forward
    assert t.local_instant(dt.date(2026, 10, 26), 180, tz) == _utc(2026, 10, 26, 1, 0)    # winter time
    assert t.local_instant(dt.date(2026, 10, 24), 180, tz) == _utc(2026, 10, 24, 0, 0)    # summer time
    # the window instants of the two nights are one per local day, each converted on its own
    iv = t.window_intervals([(180, 30)], _utc(2026, 10, 23, 12, 0), _utc(2026, 10, 26, 12, 0), tz)
    assert [a for a, _b in iv] == [_utc(2026, 10, 24, 0, 0), _utc(2026, 10, 25, 1, 0), _utc(2026, 10, 26, 1, 0)]
    iv = t.window_intervals([(150, 30)], _utc(2026, 3, 26, 12, 0), _utc(2026, 3, 27, 12, 0), tz)
    assert iv == [(_utc(2026, 3, 27, 0, 30), _utc(2026, 3, 27, 1, 0))]
    # the report schedule's next run on the fall-back night uses the same rule
    from smplwise.services import temperature_whatsapp as twa

    assert twa.next_run({"freq": "daily", "at": "03:00"}, _utc(2026, 10, 24, 21, 30), tz) == _utc(2026, 10, 25, 1, 0)


def test_the_defrost_chip_time_on_the_fall_back_night(app):
    c, db, _s, clk = app
    create(c, name="מקפיא", temp_entity_id="sensor.freezer_temp", door_entity_id=None, low=-22, high=-16, defrost_mode="fixed",
           defrost_windows=[{"start": "03:00", "minutes": 30}])
    clk["ts"] = _utc(2026, 10, 24, 21, 30)  # 00:30 local on 25.10
    assert c.get(API).json()["units"][0]["defrost"]["next_at"] == "2026-10-25T01:00:00Z"
