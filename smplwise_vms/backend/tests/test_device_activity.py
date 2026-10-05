"""DEVHIST S1 (CR-032): the device activity log - capture from the HA state_changed push (fake HA events per entity type),
attribution (person / Arx / automation / manual at the device / system), coalescing, the write-rate guard, retention and size caps,
the context-id link of Arx commands, the permission and the feed API. No live Home Assistant: every event is a fixture."""
from __future__ import annotations

import datetime as dt
import json
from dataclasses import replace
from pathlib import Path

import pytest
from conftest import as_user, bind, seed_tree
from fastapi.testclient import TestClient

from smplwise.rbac import ROLES
from smplwise.services import device_activity as da
from smplwise.services import ha_client, ha_sync

ROOT = Path(__file__).resolve().parents[3]
API = "/api/v1"
T0 = dt.datetime(2026, 10, 5, 8, 0, 0, tzinfo=dt.timezone.utc)

STATES = [
    {"entity_id": "light.lobby", "state": "on", "attributes": {"friendly_name": "Lobby light", "brightness": 128}, "last_changed": "2026-10-05T07:00:00+00:00", "last_updated": "2026-10-05T07:00:00+00:00"},
    {"entity_id": "switch.sign", "state": "on", "attributes": {"friendly_name": "Sign"}, "last_changed": "2026-10-05T07:00:00+00:00", "last_updated": "2026-10-05T07:00:00+00:00"},
    {"entity_id": "input_boolean.guest", "state": "off", "attributes": {"friendly_name": "Guest mode"}, "last_changed": "2026-10-05T07:00:00+00:00", "last_updated": "2026-10-05T07:00:00+00:00"},
    {"entity_id": "climate.lobby", "state": "cool", "attributes": {"friendly_name": "Lobby AC", "current_temperature": 25.5, "temperature": 22, "fan_mode": "auto"}, "last_changed": "2026-10-05T07:00:00+00:00", "last_updated": "2026-10-05T07:00:00+00:00"},
    {"entity_id": "cover.blind", "state": "open", "attributes": {"friendly_name": "Blind", "current_position": 100}, "last_changed": "2026-10-05T07:00:00+00:00", "last_updated": "2026-10-05T07:00:00+00:00"},
    {"entity_id": "fan.vent", "state": "off", "attributes": {"friendly_name": "Vent"}, "last_changed": "2026-10-05T07:00:00+00:00", "last_updated": "2026-10-05T07:00:00+00:00"},
    {"entity_id": "sensor.temp", "state": "23.5", "attributes": {"friendly_name": "Temp"}, "last_changed": "2026-10-05T07:00:00+00:00", "last_updated": "2026-10-05T07:00:00+00:00"},
    {"entity_id": "lock.front", "state": "locked", "attributes": {"friendly_name": "Front"}, "last_changed": "2026-10-05T07:00:00+00:00", "last_updated": "2026-10-05T07:00:00+00:00"},
    {"entity_id": "media_player.tv", "state": "playing", "attributes": {"friendly_name": "TV"}, "last_changed": "2026-10-05T07:00:00+00:00", "last_updated": "2026-10-05T07:00:00+00:00"},
    {"entity_id": "switch.plug", "state": "off", "attributes": {"friendly_name": "Plug", "device_class": "outlet"}, "last_changed": "2026-10-05T07:00:00+00:00", "last_updated": "2026-10-05T07:00:00+00:00"},
    {"entity_id": "switch.plug2", "state": "off", "attributes": {"friendly_name": "Plug without meter", "device_class": "outlet"}, "last_changed": "2026-10-05T07:00:00+00:00", "last_updated": "2026-10-05T07:00:00+00:00"},
    {"entity_id": "sensor.plug_power", "state": "41.5", "attributes": {"friendly_name": "Plug power", "device_class": "power", "unit_of_measurement": "W"}, "last_changed": "2026-10-05T07:00:00+00:00", "last_updated": "2026-10-05T07:00:00+00:00"},
    {"entity_id": "sensor.other_power", "state": "900", "attributes": {"friendly_name": "Other power", "device_class": "power", "unit_of_measurement": "W"}, "last_changed": "2026-10-05T07:00:00+00:00", "last_updated": "2026-10-05T07:00:00+00:00"},
    {"entity_id": "cover.garage", "state": "closed", "attributes": {"friendly_name": "Garage", "device_class": "garage", "current_position": 0}, "last_changed": "2026-10-05T07:00:00+00:00", "last_updated": "2026-10-05T07:00:00+00:00"},
    {"entity_id": "water_heater.boiler", "state": "eco", "attributes": {"friendly_name": "Boiler", "temperature": 55}, "last_changed": "2026-10-05T07:00:00+00:00", "last_updated": "2026-10-05T07:00:00+00:00"},
    {"entity_id": "valve.garden", "state": "closed", "attributes": {"friendly_name": "Irrigation", "current_position": 0}, "last_changed": "2026-10-05T07:00:00+00:00", "last_updated": "2026-10-05T07:00:00+00:00"},
    {"entity_id": "vacuum.robo", "state": "docked", "attributes": {"friendly_name": "Robo", "fan_speed": "quiet"}, "last_changed": "2026-10-05T07:00:00+00:00", "last_updated": "2026-10-05T07:00:00+00:00"},
    {"entity_id": "alarm_control_panel.house", "state": "disarmed", "attributes": {"friendly_name": "House alarm"}, "last_changed": "2026-10-05T07:00:00+00:00", "last_updated": "2026-10-05T07:00:00+00:00"},
    {"entity_id": "automation.evening", "state": "on", "attributes": {"friendly_name": "Evening lights"}, "last_changed": "2026-10-05T07:00:00+00:00", "last_updated": "2026-10-05T07:00:00+00:00"},
]
USERS = [("u-dana", "דנה כהן", "dana"), ("u-avi", "אבי לוי", "avi")]


@pytest.fixture()
def app_s(settings, monkeypatch):
    s = replace(settings, ha_url="http://ha.local:8123", ha_token="secret-token-value")
    monkeypatch.setattr(ha_client, "get_states", lambda _s: STATES)
    from smplwise.main import create_app

    da.reset()
    app = create_app(s)
    ha_sync.STATE.connected = True
    ha_sync.snapshot(app.state.db, s)
    with app.state.db.connection() as conn:
        for uid, name, uname in USERS:
            conn.execute("INSERT INTO ha_users(id, name, username, is_active, is_admin, synced_at) VALUES (?,?,?,1,0,?)", (uid, name, uname, "2026-10-05T07:00:00Z"))
        for eid, dev in (("switch.plug", "dev-plug"), ("sensor.plug_power", "dev-plug"), ("sensor.other_power", "dev-other"), ("switch.plug2", "dev-plug2")):
            conn.execute("UPDATE ha_entities SET device_id = ? WHERE entity_id = ?", (dev, eid))
    return app, s


def _iso(seconds: float = 0.0) -> str:
    return (T0 + dt.timedelta(seconds=seconds)).isoformat()


def _state(eid: str, state: str, seconds: float = 0.0, ctx: dict | None = None, **attrs) -> dict:
    return {"entity_id": eid, "state": state, "attributes": attrs, "last_changed": _iso(seconds), "last_updated": _iso(seconds),
            "context": ctx if ctx is not None else {"id": f"c{int(seconds * 10)}-{eid}", "parent_id": None, "user_id": None}}


def push(app, old: dict, new: dict) -> None:
    ha_sync.handle_state_event(app.state.db, {"entity_id": new["entity_id"], "old_state": old, "new_state": new})


def rows(app, eid: str | None = None) -> list[dict]:
    with app.state.db.connection(mode="read") as conn:
        q = "SELECT * FROM device_activity" + (" WHERE entity_id = ?" if eid else "") + " ORDER BY id"
        return [dict(r) for r in conn.execute(q, (eid,) if eid else ()).fetchall()]


def ctx(cid: str, user: str | None = None, parent: str | None = None) -> dict:
    return {"id": cid, "parent_id": parent, "user_id": user}


# ---------------------------------------------------------------- capture per entity type

def test_light_on_by_a_ha_user_then_brightness_change(app_s):
    app, _ = app_s
    off = _state("light.lobby", "off", 0)
    push(app, off, _state("light.lobby", "on", 10, ctx("c1", "u-dana"), brightness=128))
    r = rows(app)[0]
    assert (r["entity_id"], r["domain"], r["kind"], r["actor_type"], r["actor_name"], r["actor_ref"], r["via"], r["confidence"]) == ("light.lobby", "light", "power", "person", "דנה כהן", "u-dana", "ha", "exact")
    assert r["at_utc"] == "2026-10-05T08:00:10Z" and r["context_id"] == "c1"
    assert json.loads(r["from_json"]) == {"state": "off"} and json.loads(r["to_json"]) == {"state": "on", "brightness_pct": 50}
    # five minutes later the same person dims it: a value row, brightness only
    push(app, _state("light.lobby", "on", 10, brightness=128), _state("light.lobby", "on", 310, ctx("c2", "u-avi"), brightness=51))
    v = rows(app)[1]
    assert (v["kind"], v["actor_name"]) == ("value", "אבי לוי") and json.loads(v["from_json"]) == {"state": "on", "brightness_pct": 50} and json.loads(v["to_json"]) == {"state": "on", "brightness_pct": 20}


def test_dimmer_drag_is_one_row(app_s):
    app, _ = app_s
    push(app, _state("light.lobby", "off", 0), _state("light.lobby", "on", 1, ctx("c1", "u-dana"), brightness=20))
    prev = _state("light.lobby", "on", 1, brightness=20)
    for i, b in enumerate((60, 120, 200), start=1):  # three slider steps within 2 s, each its own HA context
        new = _state("light.lobby", "on", 1 + i * 0.5, ctx(f"d{i}", "u-dana"), brightness=b)
        push(app, prev, new)
        prev = new
    got = rows(app)
    assert len(got) == 2  # the on/off row and ONE value row for the whole drag
    assert json.loads(got[1]["from_json"])["brightness_pct"] == 8 and json.loads(got[1]["to_json"])["brightness_pct"] == 78
    assert got[1]["kind"] == "value"


def test_colour_attributes_follow_the_colour_mode_only(app_s):
    app, _ = app_s
    a = _state("light.lobby", "on", 0, brightness=100, color_mode="color_temp", rgb_color=[255, 180, 100], color_temp_kelvin=3000)
    b = _state("light.lobby", "on", 60, ctx("k1", "u-dana"), brightness=100, color_mode="color_temp", rgb_color=[255, 190, 120], color_temp_kelvin=3500)
    push(app, a, b)
    r = rows(app)[0]
    assert json.loads(r["to_json"]) == {"state": "on", "brightness_pct": 39, "color_temp_kelvin": 3500}  # the rgb drift of a colour-temperature change is not stored


def test_climate_temperature_mode_and_noise(app_s):
    app, _ = app_s
    base = _state("climate.lobby", "cool", 0, temperature=22, current_temperature=25.5, fan_mode="auto")
    push(app, base, _state("climate.lobby", "cool", 5, ctx("t0"), temperature=22, current_temperature=25.1, fan_mode="auto"))
    assert rows(app) == []  # a current-temperature drift is not an event
    t1 = _state("climate.lobby", "cool", 600, ctx("t1", "u-dana"), temperature=24, current_temperature=25.1, fan_mode="auto")
    push(app, base, t1)
    r = rows(app)[0]
    assert r["kind"] == "value" and json.loads(r["from_json"])["temperature"] == 22 and json.loads(r["to_json"])["temperature"] == 24 and r["actor_name"] == "דנה כהן"
    t2 = _state("climate.lobby", "heat", 1200, ctx("t2", "u-dana"), temperature=24, fan_mode="auto")
    push(app, t1, t2)
    assert rows(app)[1]["kind"] == "value" and json.loads(rows(app)[1]["to_json"])["state"] == "heat"  # cool -> heat: the mode of a device that stays on
    t3 = _state("climate.lobby", "off", 1800, ctx("t3", "u-dana"), fan_mode="auto")
    push(app, t2, t3)
    assert rows(app)[2]["kind"] == "power"
    t4 = _state("climate.lobby", "off", 1900, ctx("t4", "u-dana"), fan_mode="high")
    push(app, t3, t4)
    last = rows(app)[3]
    assert last["kind"] == "value" and json.loads(last["to_json"]) == {"state": "off", "fan_mode": "high"}


def test_cover_run_is_one_row_with_the_final_position(app_s):
    app, _ = app_s
    push(app, _state("cover.blind", "open", 0, current_position=100), _state("cover.blind", "closing", 10, ctx("v1", "u-avi"), current_position=90))
    push(app, _state("cover.blind", "closing", 10, current_position=90), _state("cover.blind", "closing", 14, ctx("v1", "u-avi"), current_position=40))
    push(app, _state("cover.blind", "closing", 14, current_position=40), _state("cover.blind", "closed", 20, ctx("v2"), current_position=0))
    got = rows(app)
    assert len(got) == 1
    r = got[0]
    assert r["kind"] == "power" and r["actor_name"] == "אבי לוי" and json.loads(r["from_json"]) == {"state": "open", "current_position": 100} and json.loads(r["to_json"]) == {"state": "closed", "current_position": 0}
    assert r["at_utc"] == "2026-10-05T08:00:10Z"
    # a later stop part-way (open at 30 %) is a row of its own
    push(app, _state("cover.blind", "closed", 20, current_position=0), _state("cover.blind", "opening", 3600, ctx("v3", "u-avi"), current_position=5))
    assert len(rows(app)) == 2


def test_fan_switch_and_virtual_switch(app_s):
    app, _ = app_s
    push(app, _state("fan.vent", "off", 0), _state("fan.vent", "on", 5, ctx("f1", "u-dana"), percentage=66, preset_mode="auto"))
    assert json.loads(rows(app, "fan.vent")[0]["to_json"]) == {"state": "on", "percentage": 66, "preset_mode": "auto"}
    push(app, _state("switch.sign", "on", 0), _state("switch.sign", "off", 5, ctx("s1", "u-avi")))
    push(app, _state("input_boolean.guest", "off", 0), _state("input_boolean.guest", "on", 5, ctx("b1", "u-avi")))
    assert [r["domain"] for r in rows(app)] == ["fan", "switch", "input_boolean"]


def test_never_stored_sensors_media_automations_and_first_sight(app_s):
    app, _ = app_s
    push(app, _state("sensor.temp", "23.5", 0), _state("sensor.temp", "23.9", 5, ctx("x1", "u-dana")))
    push(app, _state("media_player.tv", "playing", 0), _state("media_player.tv", "off", 5, ctx("x3", "u-dana")))
    push(app, _state("automation.evening", "on", 0), _state("automation.evening", "off", 5, ctx("x5", "u-dana")))
    ha_sync.handle_state_event(app.state.db, {"entity_id": "light.lobby", "old_state": None, "new_state": _state("light.lobby", "on", 5, ctx("x4"))})  # a new entity is a snapshot, not an activity
    assert rows(app) == []


def test_the_remaining_kinds_are_stored_with_their_own_attributes(app_s):
    app, _ = app_s
    push(app, _state("water_heater.boiler", "eco", 0, temperature=55), _state("water_heater.boiler", "eco", 5, ctx("w1", "u-dana"), temperature=60))
    push(app, _state("valve.garden", "closed", 0, current_position=0), _state("valve.garden", "opening", 5, ctx("w2", "u-avi"), current_position=10))
    push(app, _state("valve.garden", "opening", 5, current_position=10), _state("valve.garden", "open", 20, ctx("w3"), current_position=100))
    push(app, _state("vacuum.robo", "docked", 0, fan_speed="quiet"), _state("vacuum.robo", "cleaning", 5, ctx("w4", "u-dana"), fan_speed="turbo"))
    push(app, _state("vacuum.robo", "cleaning", 5, fan_speed="turbo"), _state("vacuum.robo", "cleaning", 60, ctx("w5", "u-dana"), fan_speed="quiet"))
    push(app, _state("alarm_control_panel.house", "disarmed", 0), _state("alarm_control_panel.house", "armed_away", 5, ctx("w6", "u-dana")))
    push(app, _state("lock.front", "locked", 0), _state("lock.front", "unlocking", 5, ctx("w7", "u-avi")))
    push(app, _state("lock.front", "unlocking", 5), _state("lock.front", "unlocked", 9, ctx("w8")))
    w, v, vac, al, lk = (rows(app, e) for e in ("water_heater.boiler", "valve.garden", "vacuum.robo", "alarm_control_panel.house", "lock.front"))
    assert w[0]["kind"] == "value" and json.loads(w[0]["to_json"]) == {"state": "eco", "temperature": 60}
    assert len(v) == 1 and json.loads(v[0]["to_json"]) == {"state": "open", "current_position": 100} and v[0]["actor_name"] == "אבי לוי"
    assert [r["kind"] for r in vac] == ["power", "value"] and json.loads(vac[1]["to_json"])["fan_speed"] == "quiet"
    assert al[0]["kind"] == "power" and json.loads(al[0]["to_json"]) == {"state": "armed_away"}
    assert len(lk) == 1 and json.loads(lk[0]["to_json"])["state"] == "unlocked"


def test_availability_is_the_system(app_s):
    app, _ = app_s
    push(app, _state("light.lobby", "on", 0, brightness=255), _state("light.lobby", "unavailable", 5, ctx("a1")))
    push(app, _state("light.lobby", "unavailable", 5), _state("light.lobby", "on", 90, ctx("a2"), brightness=255))
    got = rows(app)
    assert [(r["kind"], r["actor_type"], r["confidence"]) for r in got] == [("availability", "system", "exact")] * 2


# ---------------------------------------------------------------- attribution

def test_manual_at_the_device_is_estimated_and_missing_context_is_unknown(app_s):
    app, _ = app_s
    push(app, _state("switch.sign", "on", 0), _state("switch.sign", "off", 5, ctx("m1")))  # a context with no user and no parent
    no_ctx = _state("switch.sign", "on", 60)
    no_ctx.pop("context")
    push(app, _state("switch.sign", "off", 5), no_ctx)
    a, b = rows(app)
    assert (a["actor_type"], a["via"], a["confidence"], a["actor_name"]) == ("device", "device", "inferred", None)
    assert (b["actor_type"], b["via"], b["confidence"]) == ("unknown", "unknown", "unknown")


def test_automation_context_seen_before_the_device(app_s):
    app, _ = app_s
    push(app, _state("automation.evening", "on", 0), _state("automation.evening", "on", 9, ctx("auto1"), friendly_name="Evening lights", last_triggered="x"))
    push(app, _state("light.lobby", "off", 0), _state("light.lobby", "on", 10, ctx("auto1"), brightness=255))
    r = rows(app)[0]
    assert (r["actor_type"], r["actor_ref"], r["actor_name"], r["source_type"], r["source_ref"], r["confidence"]) == ("automation", "automation.evening", "Evening lights", "automation", "automation.evening", "exact")


def test_automation_context_seen_after_the_device_back_fills(app_s):
    app, _ = app_s
    push(app, _state("light.lobby", "off", 0), _state("light.lobby", "on", 10, ctx("auto2"), brightness=255))
    assert rows(app)[0]["actor_type"] == "device"
    push(app, _state("automation.evening", "on", 0), _state("automation.evening", "on", 11, ctx("auto2"), friendly_name="Evening lights"))
    r = rows(app)[0]
    assert (r["actor_type"], r["actor_name"], r["source_name"], r["confidence"]) == ("automation", "Evening lights", "Evening lights", "exact")


def test_parent_without_a_known_source_is_an_unnamed_automation(app_s):
    app, _ = app_s
    push(app, _state("switch.sign", "on", 0), _state("switch.sign", "off", 5, ctx("p1", parent="p0")))
    r = rows(app)[0]
    assert (r["actor_type"], r["actor_name"], r["confidence"], r["parent_id"]) == ("automation", None, "inferred", "p0")


def test_a_person_who_runs_a_scene_stays_the_actor_and_the_scene_is_the_source(app_s):
    app, _ = app_s
    push(app, _state("automation.evening", "on", 0), _state("automation.evening", "on", 1, ctx("sc1", "u-dana"), friendly_name="Evening lights"))
    push(app, _state("switch.sign", "on", 0), _state("switch.sign", "off", 2, ctx("sc1", "u-dana")))
    r = rows(app)[0]
    assert (r["actor_type"], r["actor_name"], r["source_type"], r["source_name"]) == ("person", "דנה כהן", "automation", "Evening lights")


def _action(app, aid: str, entity: str, user: str, username: str) -> None:
    with app.state.db.connection() as conn:
        conn.execute("INSERT INTO ha_actions(id, entity_id, action_id, arguments_json, principal_user_id, principal_username, client_request_id, status, requested_at, via) VALUES (?,?,?,?,?,?,?,?,?,?)",
                     (aid, entity, "switch.turn_off", "{}", user, username, aid, "pending", "2026-10-05T08:00:00Z", "bridge"))


def test_arx_command_links_the_person_through_the_context_id(app_s):
    app, _ = app_s
    _action(app, "act1", "switch.sign", "u-dana", "dana")
    # the state change arrives BEFORE the bridge's answer is stored: the person is already known from the context user
    push(app, _state("switch.sign", "on", 0), _state("switch.sign", "off", 5, ctx("bridge-ctx-1", "u-dana")))
    assert (rows(app)[0]["via"], rows(app)[0]["actor_name"]) == ("ha", "דנה כהן")
    with app.state.db.connection() as conn:
        assert da.note_context(conn, "act1", {"ok": True, "context_id": "bridge-ctx-1"}, "u-dana", "dana") == "bridge-ctx-1"
        assert conn.execute("SELECT context_id FROM ha_actions WHERE id = 'act1'").fetchone()[0] == "bridge-ctx-1"
    r = rows(app)[0]
    assert (r["via"], r["actor_type"], r["actor_ref"], r["actor_name"], r["confidence"]) == ("arx", "person", "u-dana", "דנה כהן", "exact")
    # the other order: the action's context is already known when the change arrives
    _action(app, "act2", "switch.sign", "u-avi", "avi")
    with app.state.db.connection() as conn:
        da.note_context(conn, "act2", {"context_id": "bridge-ctx-2"}, "u-avi", "avi")
    push(app, _state("switch.sign", "off", 5), _state("switch.sign", "on", 60, ctx("bridge-ctx-2", None)))  # even a context that lost its user id
    r2 = rows(app)[1]
    assert (r2["via"], r2["actor_name"]) == ("arx", "אבי לוי")


def test_note_context_ignores_a_missing_or_odd_id(app_s):
    app, _ = app_s
    _action(app, "act3", "switch.sign", "u-avi", "avi")
    with app.state.db.connection() as conn:
        assert da.note_context(conn, "act3", {"ok": True}, "u-avi", "avi") is None
        assert da.note_context(conn, "act3", {"context_id": 5}, "u-avi", "avi") is None
        assert da.note_context(conn, "act3", "nope", "u-avi", "avi") is None
        assert conn.execute("SELECT context_id FROM ha_actions WHERE id = 'act3'").fetchone()[0] is None


# ---------------------------------------------------------------- guards and retention

def test_a_chatty_entity_is_rate_limited_and_the_gap_is_recorded(app_s):
    app, _ = app_s
    prev = _state("switch.sign", "on", 0)
    for i in range(1, 41):  # a flapping relay: 40 flips in 40 seconds
        new = _state("switch.sign", "off" if i % 2 else "on", i, ctx(f"r{i}"))
        push(app, prev, new)
        prev = new
    assert len(rows(app, "switch.sign")) == da.ENTITY_RATE[0] and da.STATS["rate_limited"] == 10
    with app.state.db.connection(mode="read") as conn:
        gaps = [dict(g) for g in conn.execute("SELECT * FROM device_activity_gaps").fetchall()]
    assert len(gaps) == 1 and gaps[0]["reason"] == "rate_limit" and gaps[0]["entity_id"] == "switch.sign"  # one extended gap, not ten rows
    # an unrelated entity is not affected
    push(app, _state("light.lobby", "off", 0), _state("light.lobby", "on", 41, ctx("z1")))
    assert len(rows(app, "light.lobby")) == 1


def test_a_failure_of_the_log_never_loses_the_state_update(app_s, monkeypatch):
    app, _ = app_s

    def boom(*_a, **_k):
        raise RuntimeError("nope")

    monkeypatch.setattr(da, "_record", boom)
    push(app, _state("switch.sign", "on", 0), _state("switch.sign", "off", 5, ctx("e1")))
    with app.state.db.connection(mode="read") as conn:
        assert conn.execute("SELECT state FROM ha_entities WHERE entity_id = 'switch.sign'").fetchone()[0] == "off"


def _insert(conn, eid: str, at: str, n: int = 1) -> None:
    for i in range(n):
        conn.execute("INSERT INTO device_activity(entity_id, domain, at_utc, kind, actor_type, via, confidence, from_json, to_json) VALUES (?,?,?,?,?,?,?,?,?)",
                     (eid, eid.split(".")[0], at, "power", "device", "device", "inferred", '{"state":"on"}', '{"state":"off"}'))


def test_retention_per_entity_cap_and_table_cap(app_s):
    app, _ = app_s
    now = dt.datetime.now(dt.timezone.utc)
    old = (now - dt.timedelta(days=91)).strftime("%Y-%m-%dT%H:%M:%SZ")
    fresh = (now - dt.timedelta(days=10)).strftime("%Y-%m-%dT%H:%M:%SZ")
    with app.state.db.connection() as conn:
        _insert(conn, "switch.sign", old, 3)
        _insert(conn, "switch.sign", fresh, 2)
        conn.execute("INSERT INTO device_activity_gaps(entity_id, started_at, ended_at, reason) VALUES (NULL, ?, ?, 'disconnected')", (old, old))
        out = da.prune(conn)
        assert out["expired"] == 3 and conn.execute("SELECT COUNT(*) FROM device_activity").fetchone()[0] == 2
        assert conn.execute("SELECT COUNT(*) FROM device_activity_gaps").fetchone()[0] == 0
        _insert(conn, "light.lobby", fresh, 12)
        out = da.prune(conn, per_entity=10)
        assert out["per_entity"] == 2 and conn.execute("SELECT COUNT(*) FROM device_activity WHERE entity_id = 'light.lobby'").fetchone()[0] == 10
        out = da.prune(conn, max_rows=8)
        assert out["over_cap"] == 4 and conn.execute("SELECT COUNT(*) FROM device_activity").fetchone()[0] == 8


def test_the_setting_changes_the_retention_and_the_janitor_prunes(app_s):
    app, s = app_s
    c = TestClient(app)
    got = c.get(f"{API}/settings").json()["settings"]
    assert got["device_activity.retention_days"] == 90
    assert c.patch(f"{API}/settings", json={"device_activity.retention_days": 30}).status_code == 200
    assert c.patch(f"{API}/settings", json={"device_activity.retention_days": 3}).status_code == 422
    now = dt.datetime.now(dt.timezone.utc)
    with app.state.db.connection() as conn:
        _insert(conn, "switch.sign", (now - dt.timedelta(days=40)).strftime("%Y-%m-%dT%H:%M:%SZ"))
        _insert(conn, "switch.sign", (now - dt.timedelta(days=5)).strftime("%Y-%m-%dT%H:%M:%SZ"))
    from smplwise.main import janitor_tick

    da._last_prune = 0.0
    janitor_tick(app.state.db, s)
    assert len(rows(app)) == 1


def test_connect_records_the_start_and_a_gap(app_s):
    app, _ = app_s
    da.note_connect(app.state.db, "2026-10-05T06:00:00Z")
    with app.state.db.connection(mode="read") as conn:
        assert conn.execute("SELECT value FROM settings WHERE key = 'device_activity.started_at'").fetchone() is not None
        g = conn.execute("SELECT * FROM device_activity_gaps").fetchall()
    assert len(g) == 1 and g[0]["reason"] == "disconnected" and g[0]["entity_id"] is None and g[0]["started_at"] == "2026-10-05T06:00:00Z"


# ---------------------------------------------------------------- permission and API

def test_no_new_permission_exists():
    """Owner decision 2026-10-05: whoever may see the device may see its activity - no devices.activity permission anywhere."""
    from smplwise.routers.access import PERMISSION_LABELS

    assert "devices.activity" not in PERMISSION_LABELS and all("devices.activity" not in perms for perms in ROLES.values())
    contract = (ROOT / "contracts" / "examples" / "role-catalog.design.json").read_text(encoding="utf-8")
    assert "devices.activity" not in contract


def _seed_feed(app) -> None:
    push(app, _state("light.lobby", "off", 0), _state("light.lobby", "on", 10, ctx("c1", "u-dana"), brightness=128))
    push(app, _state("light.lobby", "on", 10, brightness=128), _state("light.lobby", "on", 4000, ctx("c2", "u-avi"), brightness=51))
    push(app, _state("light.lobby", "on", 4000, brightness=51), _state("light.lobby", "off", 9000, ctx("c3")))
    push(app, _state("light.lobby", "off", 9000), _state("light.lobby", "unavailable", 9500, ctx("c4")))


def test_feed_shape_filters_paging_and_permission(app_s):
    app, s = app_s
    c = TestClient(app)
    _seed_feed(app)
    r = c.get(f"{API}/devices/light.lobby/activity")
    assert r.status_code == 200, r.text
    body = r.json()
    assert [i["kind"] for i in body["items"]] == ["availability", "power", "value", "power"]  # newest first
    first = body["items"][-1]
    assert first["actor"] == {"type": "person", "name": "דנה כהן"} and first["from"] == {"state": "off"} and first["to"] == {"state": "on", "brightness_pct": 50}
    assert first["changed"] == ["brightness_pct", "state"] and first["via"] == "ha" and first["confidence"] == "exact" and first["source"] is None
    assert body["entity"] == {"entity_id": "light.lobby", "name": "Lobby light", "domain": "light", "activity_kind": "light", "virtual": False, "power": None}
    assert body["retention_days"] == 90 and body["coverage"]["from"] and body["next_cursor"] is None and body["availability"] in ("ok", "partial")
    assert "ha_url" not in r.text and "u-dana" not in r.text  # no HA user id, no host
    # filters
    assert [i["kind"] for i in c.get(f"{API}/devices/light.lobby/activity", params={"kind": "value"}).json()["items"]] == ["value"]
    assert [i["actor"]["type"] for i in c.get(f"{API}/devices/light.lobby/activity", params={"actor": "person"}).json()["items"]] == ["person", "person"]
    assert [i["kind"] for i in c.get(f"{API}/devices/light.lobby/activity", params={"actor": "system"}).json()["items"]] == ["availability"]
    window = c.get(f"{API}/devices/light.lobby/activity", params={"since": "2026-10-05T09:00:00Z", "until": "2026-10-05T10:00:00Z"}).json()["items"]
    assert [i["at"] for i in window] == ["2026-10-05T09:07:40Z"]
    # paging
    p1 = c.get(f"{API}/devices/light.lobby/activity", params={"limit": 3}).json()
    assert len(p1["items"]) == 3 and p1["next_cursor"]
    p2 = c.get(f"{API}/devices/light.lobby/activity", params={"limit": 3, "cursor": p1["next_cursor"]}).json()
    assert [i["id"] for i in p2["items"]] == [p1["items"][-1]["id"] - 1 - 0] or len(p2["items"]) == 1
    assert p2["next_cursor"] is None
    ids = [i["id"] for i in p1["items"] + p2["items"]]
    assert len(set(ids)) == 4
    # bad input
    assert c.get(f"{API}/devices/light.lobby/activity", params={"cursor": "###"}).status_code == 422
    assert c.get(f"{API}/devices/light.lobby/activity", params={"since": "2026-10-05T09:00:00"}).status_code == 422
    assert c.get(f"{API}/devices/light.lobby/activity", params={"actor": "robot"}).status_code == 422
    assert c.get(f"{API}/devices/light.lobby/activity", params={"limit": 500}).status_code == 422
    # not electrical / unknown
    for eid in ("sensor.temp", "media_player.tv", "automation.evening", "light.nope"):
        assert c.get(f"{API}/devices/{eid}/activity").status_code == 404, eid


def test_feed_follows_devices_read_and_the_floor(app_s):
    app, s = app_s
    c = TestClient(app)
    _seed_feed(app)
    ids = seed_tree(c)
    bind(c, s, "vi", "viewer", "installation", "*")  # devices.read only: sees the device, so sees its activity, names included
    r = c.get(f"{API}/devices/light.lobby/activity", headers=as_user("vi"))
    assert r.status_code == 200 and r.json()["items"][-1]["actor"]["name"] == "דנה כהן"
    bind(c, s, "kio", "kiosk", "installation", "*")  # a kiosk holds no devices.read
    assert c.get(f"{API}/devices/light.lobby/activity", headers=as_user("kio")).status_code == 403
    bind(c, s, "fl", "viewer", "floor", ids["floor2"])  # a floor where the light is not placed: the device is not theirs
    assert c.get(f"{API}/devices/light.lobby/activity", headers=as_user("fl")).status_code == 404
    assert c.get(f"{API}/devices/light.lobby/activity", headers=as_user("nobody-bound")).status_code == 403


def test_security_devices_need_the_permission_that_operates_them(app_s):
    app, s = app_s
    c = TestClient(app)
    push(app, _state("lock.front", "locked", 0), _state("lock.front", "unlocked", 5, ctx("l1", "u-dana")))
    push(app, _state("alarm_control_panel.house", "armed_away", 0), _state("alarm_control_panel.house", "disarmed", 5, ctx("l2", "u-dana")))
    for name, role in (("vi", "viewer"), ("op", "operator"), ("sa", "system_admin")):  # door.unlock is a system_admin permission
        bind(c, s, name, role, "installation", "*")
    # a viewer sees both devices but not who locked / armed them
    assert c.get(f"{API}/devices/lock.front/activity", headers=as_user("vi")).status_code == 403
    assert c.get(f"{API}/devices/alarm_control_panel.house/activity", headers=as_user("vi")).status_code == 403
    # an operator may arm (alarm.arm) but holds no door.unlock (system_admin only)
    assert c.get(f"{API}/devices/lock.front/activity", headers=as_user("op")).status_code == 403
    assert c.get(f"{API}/devices/alarm_control_panel.house/activity", headers=as_user("op")).status_code == 200
    r = c.get(f"{API}/devices/lock.front/activity", headers=as_user("sa"))
    assert r.status_code == 200 and r.json()["items"][0]["actor"]["name"] == "דנה כהן" and r.json()["entity"]["activity_kind"] == "generic"
    assert c.get(f"{API}/devices/lock.front/activity").status_code == 200  # the dev admin holds everything


def test_outlet_power_only_from_a_power_sensor_of_the_same_device(app_s):
    app, _ = app_s
    from smplwise.services import devices as svc

    c = TestClient(app)
    with app.state.db.connection(mode="read") as conn:
        ents = svc.load_entities(conn)
    cards = svc.build_cards(ents, lambda _e: False)["cards"]["switches"]["entities"]
    by = {r["entity_id"]: r for r in cards}
    assert by["switch.plug"]["power"] == {"entity_id": "sensor.plug_power", "value": 41.5, "unit": "W"}  # the sensor of the OTHER device is never used
    assert by["switch.plug2"]["power"] is None and "power" not in by["switch.sign"]
    e = c.get(f"{API}/devices/switch.plug/activity").json()["entity"]
    assert e["activity_kind"] == "outlet" and e["power"]["entity_id"] == "sensor.plug_power"
    assert c.get(f"{API}/devices/switch.plug2/activity").json()["entity"]["power"] is None
    assert c.get(f"{API}/devices/switch.sign/activity").json()["entity"]["power"] is None


def test_tracked_since_is_set_once_when_the_log_starts(app_s):
    app, _ = app_s
    c = TestClient(app)
    assert c.get(f"{API}/devices/light.lobby/activity").json()["tracked_since"] is None  # nothing recorded yet: history starts from zero
    push(app, _state("light.lobby", "off", 0), _state("light.lobby", "on", 10, ctx("t1", "u-dana"), brightness=10))
    first = c.get(f"{API}/devices/light.lobby/activity").json()["tracked_since"]
    assert first
    push(app, _state("light.lobby", "on", 10, brightness=10), _state("light.lobby", "off", 600, ctx("t2", "u-dana")))
    assert c.get(f"{API}/devices/light.lobby/activity").json()["tracked_since"] == first


def test_card_rows_carry_the_activity_flag_and_the_twelve_kinds(app_s):
    app, _ = app_s
    from smplwise.services import devices as svc
    from smplwise.services.device_activity import ACTIVITY_KINDS, activity_kind

    with app.state.db.connection(mode="read") as conn:
        by = {e["entity_id"]: e for e in svc.load_entities(conn)}
    rows_ = {eid: svc.card_row(e, False) for eid, e in by.items()}
    kinds = {eid: r["activity_kind"] for eid, r in rows_.items()}
    assert kinds["light.lobby"] == "light" and kinds["switch.sign"] == "switch" and kinds["input_boolean.guest"] == "switch" and kinds["switch.plug"] == "outlet"
    assert kinds["cover.blind"] == "cover" and kinds["cover.garage"] == "garage_door" and kinds["climate.lobby"] in ("climate", "heater") and kinds["fan.vent"] == "fan"
    assert kinds["lock.front"] == "generic" and kinds["alarm_control_panel.house"] == "generic"
    assert rows_["lock.front"]["activity_permission"] == "door.unlock" and rows_["alarm_control_panel.house"]["activity_permission"] == "alarm.arm" and "activity_permission" not in rows_["light.lobby"]
    assert not rows_["sensor.temp"]["activity"] and rows_["sensor.temp"]["activity_kind"] is None and not rows_["media_player.tv"]["activity"]
    # the kinds without a card yet (water heater, valve, vacuum) and the heater come from the same function
    assert activity_kind("water_heater") == "water_heater" and activity_kind("valve") == "valve" and activity_kind("vacuum") == "vacuum"
    assert activity_kind("climate", None, "heating") == "heater" and activity_kind("humidifier") == "generic" and activity_kind("sensor") is None
    assert {activity_kind(d, dc, ck) for d, dc, ck in (("light", None, None), ("switch", None, None), ("switch", "outlet", None), ("cover", None, None), ("cover", "garage", None), ("climate", None, None), ("climate", None, "heating"),
                                                       ("fan", None, None), ("water_heater", None, None), ("valve", None, None), ("vacuum", None, None), ("lock", None, None))} == set(ACTIVITY_KINDS)


def test_schedules_of_a_device_come_from_the_existing_filter():
    """No new route: GET /schedules?entity=<id> already filters by the action entity (tests/test_schedules_api.py owns its behaviour);
    this only pins that the filter exists, so the popup's schedules tab keeps working."""
    src = (ROOT / "smplwise_vms" / "backend" / "smplwise" / "routers" / "schedules.py").read_text(encoding="utf-8")
    assert 'entity: str | None = Query(None, max_length=120)' in src


def test_migration_adds_the_context_column_and_indexes(app_s):
    app, _ = app_s
    with app.state.db.connection(mode="read") as conn:
        cols = {r[1] for r in conn.execute("PRAGMA table_info(ha_actions)").fetchall()}
        idx = {r[1] for r in conn.execute("PRAGMA index_list(device_activity)").fetchall()}
        ver = [r[0] for r in conn.execute("SELECT version FROM schema_migrations").fetchall()]
    assert "context_id" in cols and {"idx_device_activity_entity", "idx_device_activity_at", "idx_device_activity_context"} <= idx and 63 in ver
