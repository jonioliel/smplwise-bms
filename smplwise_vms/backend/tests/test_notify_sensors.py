"""CR-018 S2, sources that come from Home Assistant entities: leak / smoke / gas / CO, doors and windows left open, batteries, unavailable devices, the
alarm panel and the doorbell event entity. Each one fires, folds (never twice for one condition), resolves, and reaches only who may see it."""
from __future__ import annotations

import datetime as dt

import pytest
from notify_src_world import API, Clock, World, clock, fake_push, iso  # noqa: F401 - fixtures

from smplwise.services import notify, notify_sensors, notify_sources


@pytest.fixture()
def w(settings, clock) -> World:  # noqa: F811
    return World(settings, clock)


# ---------------------------------------------------------------- pure classification

def test_conditions_are_pure_and_cover_every_v1_entity_source():
    c = notify_sensors.conditions
    assert [(x.source, x.active) for x in c("binary_sensor", "moisture", "on") if x.source.startswith("sensor.")] == [("sensor.leak", True)]
    assert {x.source for x in c("binary_sensor", "smoke", "off")} >= {"sensor.smoke"}
    assert {x.source for x in c("binary_sensor", "gas", "on")} >= {"sensor.gas"} and {x.source for x in c("binary_sensor", "carbon_monoxide", "on")} >= {"sensor.co"}
    assert [x.source for x in c("binary_sensor", "window", "on")][0] == "opening.left_open" and c("binary_sensor", "motion", "on")[0].source == "device.unavailable"
    assert c("cover", "garage", "open")[0] == notify_sensors.Cond("opening.left_open", True) and [x.source for x in c("cover", "shutter", "open")] == ["device.unavailable"]
    assert c("alarm_control_panel", None, "triggered")[0] == notify_sensors.Cond("alarm.triggered", True)
    # a wet sensor that drops off the network is neither wet nor dry
    gone = c("binary_sensor", "moisture", "unavailable")
    assert gone[0].keep and not gone[0].active and gone[1] == notify_sensors.Cond("device.unavailable", True)
    # the battery band: low below 15, kept up to 25, recovered above
    assert (c("sensor", "battery", "12")[0].active, c("sensor", "battery", "20")[0].keep, c("sensor", "battery", "30")[0].active, c("sensor", "battery", "30")[0].keep) == (True, True, False, False)
    assert c("sensor", "battery", "garbage")[0].keep


def test_may_notify_costs_nothing_for_an_ordinary_push():
    m = notify_sensors.may_notify
    t = lambda s: {"entity_id": "sensor.temp", "state": s, "attributes": {"device_class": "temperature"}}  # noqa: E731
    assert not m(t("20"), t("21")) and not m(None, t("21"))
    leak = lambda s: {"entity_id": "binary_sensor.l", "state": s, "attributes": {"device_class": "moisture"}}  # noqa: E731
    assert m(leak("off"), leak("on")) and not m(leak("on"), leak("on")) and not m(None, leak("off")) and m(None, leak("on"))


# ---------------------------------------------------------------- safety: leak / smoke / gas / CO

def test_leak_fires_critical_folds_and_resolves_and_flaps_make_new_rows(w, clock):
    e = w.entity("binary_sensor.kitchen_leak", "moisture", floor=w.ids["floor2"], name="חיישן מים")
    w.push(e, "off", "on", "moisture")
    n = w.one("sensor.leak")
    assert (n["severity"], n["category"], n["state"], n["subject_kind"], n["subject_id"], n["count"]) == ("critical", "safety", "open", "entity", e, 1)
    assert n["title"] == "דליפת מים" and "חיישן מים" in n["body"] and n["place"] == "מטבח" and n["area_id"] == "kitchen"
    # the same condition seen again (a second push, the monitor pass) never makes a second row or a fold
    w.push(e, "on", "on", "moisture")
    w.scan()
    w.scan()
    assert w.one("sensor.leak")["count"] == 1
    clock.advance(minutes=3)
    w.push(e, "on", "off", "moisture")
    r = w.one("sensor.leak")
    assert r["state"] == "resolved" and r["resolved_at"] is not None
    # it leaks again: the resolved row freed the key, a NEW row is made
    clock.advance(minutes=1)
    w.push(e, "off", "on", "moisture")
    assert len(w.rows("sensor.leak")) == 2 and len(w.rows("sensor.leak", "open")) == 1


@pytest.mark.parametrize("cls,source,title", [("smoke", "sensor.smoke", "עשן"), ("gas", "sensor.gas", "גז"), ("carbon_monoxide", "sensor.co", "פחמן חד־חמצני")])
def test_smoke_gas_and_co_are_critical_safety(w, cls, source, title):
    e = w.entity(f"binary_sensor.k_{cls}", cls, floor=w.ids["floor2"])
    w.push(e, "off", "on", cls)
    n = w.one(source)
    assert (n["severity"], n["category"], n["title"]) == ("critical", "safety", title)
    w.push(e, "on", "off", cls)
    assert w.one(source)["state"] == "resolved"


def test_leak_recipients_follow_the_scope_of_the_entity(w):
    e = w.entity("binary_sensor.kitchen_leak", "moisture", floor=w.ids["floor2"])
    w.push(e, "off", "on", "moisture")
    n = w.one("sensor.leak")
    assert w.recipients(n["id"]) == {"joni", "ops2", "vera"}, "floor 2 operator, installation viewer and the administrator; not floor 3, not a user with no binding"
    # what the inbox shows is re-checked too: the floor-3 operator sees nothing
    assert [x["id"] for x in w.inbox("ops2")] == [n["id"]] and w.inbox("ops3") == [] and w.inbox("nobody") == []


def test_an_entity_outside_the_catalogue_makes_no_row(w):
    e = w.entity("binary_sensor.hidden_leak", "moisture", floor=w.ids["floor2"], hidden=1)
    w.push(e, "off", "on", "moisture")
    w.scan()
    assert w.rows("sensor.leak") == []


def test_leak_seen_only_in_the_snapshot_is_caught_by_the_next_pass(w):
    e = w.entity("binary_sensor.snap_leak", "moisture", state="on", floor=w.ids["floor2"])  # the start-up snapshot wrote it: no push ever arrived
    w.scan()
    assert w.one("sensor.leak")["subject_id"] == e
    w.scan()
    assert w.one("sensor.leak")["count"] == 1
    w.set_state(e, "off")  # a push was missed: the pass resolves it
    w.scan()
    assert w.one("sensor.leak")["state"] == "resolved"


def test_a_wet_sensor_that_goes_unavailable_stays_open_until_it_is_dry(w, clock):
    e = w.entity("binary_sensor.k_leak", "moisture", floor=w.ids["floor2"])
    w.push(e, "off", "on", "moisture")
    w.push(e, "on", "unavailable", "moisture")
    w.scan()
    assert w.one("sensor.leak")["state"] == "open", "an unreachable sensor is not a dry one"
    w.push(e, "unavailable", "off", "moisture")
    assert w.one("sensor.leak")["state"] == "resolved"


def test_an_acknowledged_leak_is_not_announced_again_while_wet(w):
    e = w.entity("binary_sensor.k_leak", "moisture", floor=w.ids["floor2"])
    w.push(e, "off", "on", "moisture")
    nid = w.one("sensor.leak")["id"]
    from conftest import as_user

    assert w.c.post(f"{API}/notifications/{nid}/ack", headers=as_user("ops2")).status_code == 200
    assert w.one("sensor.leak")["state"] == "acknowledged"
    w.scan()
    w.push(e, "on", "on", "moisture")
    assert len(w.rows("sensor.leak")) == 1 and w.one("sensor.leak")["state"] == "acknowledged"
    w.push(e, "on", "off", "moisture")  # the sensor itself resolves it (an acknowledge only silences the escalation)
    assert w.one("sensor.leak")["state"] == "resolved"


def test_disabled_source_makes_no_row_and_is_picked_up_when_enabled(w):
    e = w.entity("binary_sensor.k_leak", "moisture", state="on", floor=w.ids["floor2"])
    w.set_policy("sensor.leak", enabled=False)
    w.scan()
    assert w.rows("sensor.leak") == []
    w.set_policy("sensor.leak", enabled=True)
    w.scan()
    assert w.one("sensor.leak")["subject_id"] == e


# ---------------------------------------------------------------- doors and windows left open

def test_opening_left_open_waits_for_the_threshold_then_resolves_on_close(w, clock):
    e = w.entity("binary_sensor.front_door", "door", state="on", floor=w.ids["floor2"], name="דלת כניסה", changed=clock.now)
    w.push(e, "off", "on", "door")
    assert w.rows("opening.left_open") == [], "an opening is a TIMED condition: the push alone announces nothing"
    clock.advance(minutes=9, seconds=30)
    w.scan()
    assert w.rows("opening.left_open") == []
    clock.advance(seconds=40)
    w.scan()
    n = w.one("opening.left_open")
    assert (n["severity"], n["category"], n["state"]) == ("alert", "doors", "open") and "10" in n["body"] and "דלת כניסה" in n["body"]
    clock.advance(minutes=5)
    w.scan()
    w.scan()
    assert w.one("opening.left_open")["count"] == 1, "one row while it stays open"
    w.push(e, "on", "off", "door")
    assert w.one("opening.left_open")["state"] == "resolved"


def test_opening_threshold_is_the_administrators_setting(w, clock):
    e = w.entity("binary_sensor.win", "window", state="on", floor=w.ids["floor2"], changed=clock.now)
    w.set_policy("opening.left_open", after_s=120)
    clock.advance(seconds=100)
    w.scan()
    assert w.rows("opening.left_open") == []
    clock.advance(seconds=30)
    w.scan()
    assert "2" in w.one("opening.left_open")["body"]
    # a window that was opened and closed again inside the threshold never made a row
    e2 = w.entity("binary_sensor.win2", "window", state="on", floor=w.ids["floor2"], changed=clock.now)
    clock.advance(seconds=60)
    w.push(e2, "on", "off", "window")
    clock.advance(seconds=120)
    w.scan()
    assert [r["subject_id"] for r in w.rows("opening.left_open")] == [e]


def test_a_garage_cover_counts_as_an_opening_and_a_shutter_does_not(w, clock):
    g = w.entity("cover.garage", "garage", state="open", floor=w.ids["floor2"], changed=clock.now)
    w.entity("cover.shutter", "shutter", state="open", floor=w.ids["floor2"], changed=clock.now)
    clock.advance(minutes=11)
    w.scan()
    assert [r["subject_id"] for r in w.rows("opening.left_open")] == [g]
    w.push(g, "open", "closed", "garage")
    assert w.one("opening.left_open")["state"] == "resolved"


def test_an_open_door_that_vanishes_from_the_catalogue_is_resolved(w, clock):
    e = w.entity("binary_sensor.d", "door", state="on", floor=w.ids["floor2"], changed=clock.now - dt.timedelta(minutes=20))
    w.scan()
    assert w.one("opening.left_open")["state"] == "open"
    with w.db.connection() as conn:
        conn.execute("UPDATE ha_entities SET hidden = 1 WHERE entity_id = ?", (e,))
    w.scan()
    assert w.one("opening.left_open")["state"] == "resolved"


# ---------------------------------------------------------------- low battery

def test_battery_low_hysteresis_and_the_daily_reminder(w, clock):
    e = w.entity("sensor.lock_battery", "battery", state="80", floor=w.ids["floor2"], name="סוללת מנעול")
    w.push(e, "80", "12", "battery")
    n = w.one("device.battery_low")
    assert (n["severity"], n["category"]) == ("info", "device_faults") and "12%" in n["body"]
    for level in ("14", "18", "24"):  # between low and recovered: nothing changes, nothing resolves
        w.push(e, "12", level, "battery")
        w.scan()
    assert w.one("device.battery_low")["state"] == "open" and len(w.rows("device.battery_low")) == 1
    w.push(e, "24", "13", "battery")
    clock.advance(hours=25)
    w.scan()
    assert len(w.rows("device.battery_low")) == 2 and len(w.rows("device.battery_low", "open")) == 1, "once a day: the old row is superseded by one reminder"
    w.push(e, "24", "90", "battery")
    assert w.rows("device.battery_low", "open") == []


def test_a_binary_battery_sensor_and_a_sensor_without_a_number(w):
    b = w.entity("binary_sensor.door_batt", "battery", floor=w.ids["floor2"])
    w.push(b, "off", "on", "battery")
    assert w.one("device.battery_low")["state"] == "open"
    w.push(b, "on", "off", "battery")
    assert w.one("device.battery_low")["state"] == "resolved"
    s = w.entity("sensor.odd_battery", "battery", state="unknown", floor=w.ids["floor2"])
    w.scan()
    assert len(w.rows("device.battery_low")) == 1 and s


# ---------------------------------------------------------------- catalogued entity unavailable

def test_unavailable_waits_fifteen_minutes_and_is_not_judged_while_ha_is_down(w, clock):
    e = w.entity("light.hall", None, state="unavailable", floor=w.ids["floor2"], name="פנס מבואה", changed=clock.now)
    clock.advance(minutes=14)
    w.scan()
    assert w.rows("device.unavailable") == []
    clock.advance(minutes=2)
    w.scan(ha_connected=False)
    assert w.rows("device.unavailable") == [], "while Home Assistant itself is disconnected every entity looks unavailable: that is system.health's business"
    w.scan()
    n = w.one("device.unavailable")
    assert (n["severity"], n["subject_id"]) == ("info", e)
    w.scan(ha_connected=False)  # still open: a disconnected HA resolves nothing either
    assert w.one("device.unavailable")["state"] == "open"
    w.push(e, "unavailable", "on")
    assert w.one("device.unavailable")["state"] == "resolved"


def test_a_storm_of_unavailable_devices_is_announced_in_bounded_passes(w, clock):
    for i in range(130):
        w.entity(f"switch.s{i:03d}", None, state="unavailable", floor=None, changed=clock.now - dt.timedelta(hours=1))
    w.scan()
    assert len(w.rows("device.unavailable")) == notify_sources.MAX_PER_PASS
    w.scan()
    assert len(w.rows("device.unavailable")) == 130
    w.scan()
    assert len(w.rows("device.unavailable")) == 130


# ---------------------------------------------------------------- the alarm

def test_alarm_triggered_is_critical_until_disarmed(w):
    p = w.entity("alarm_control_panel.home", None, state="armed_away", floor=w.ids["floor2"], name="לוח אזעקה")
    w.push(p, "armed_away", "triggered")
    n = w.one("alarm.triggered")
    assert (n["severity"], n["category"], n["subject_kind"], n["subject_id"]) == ("critical", "safety", "alarm_panel", p)
    assert "joni" in w.recipients(n["id"])
    w.scan()
    assert w.one("alarm.triggered")["count"] == 1
    w.push(p, "triggered", "disarmed")
    assert w.one("alarm.triggered")["state"] == "resolved"


def test_alarm_state_changes_are_off_by_default_and_per_state_when_on(w, clock):
    p = w.entity("alarm_control_panel.home", None, state="disarmed", floor=w.ids["floor2"])
    w.push(p, "disarmed", "armed_away")
    assert w.rows("alarm.state") == []
    w.set_policy("alarm.state", enabled=True)
    clock.advance(minutes=5)
    w.push(p, "armed_away", "disarmed")
    n = w.one("alarm.state")
    assert n["severity"] == "info" and "מנוטרלת" in n["body"]


# ---------------------------------------------------------------- the doorbell event entity

def test_ha_doorbell_event_entity_rings_folds_and_expires(w, clock):
    e = w.entity("event.front_bell", "doorbell", state="2026-10-01T08:59:00.000+00:00", floor=w.ids["floor2"], name="פעמון כניסה", attrs={"event_type": "ring"})
    w.push(e, None, "2026-10-01T08:59:00.000+00:00", "doorbell", event_type="ring")  # the first state is a start-up, not a ring
    assert w.rows("door.ring") == []
    w.push(e, "2026-10-01T08:59:00.000+00:00", "2026-10-01T09:00:00.000+00:00", "doorbell", event_type="ring")
    n = w.one("door.ring")
    assert (n["category"], n["severity"], n["subject_kind"]) == ("doors", "alert", "entity") and "פעמון כניסה" in n["body"]
    clock.advance(seconds=20)
    w.push(e, "2026-10-01T09:00:00.000+00:00", "2026-10-01T09:00:20.000+00:00", "doorbell", event_type="ring")
    assert w.one("door.ring")["count"] == 2, "a second ring inside the fold window folds"
    w.push(e, "2026-10-01T09:00:20.000+00:00", "2026-10-01T09:00:25.000+00:00", "doorbell", event_type="motion")
    assert w.one("door.ring")["count"] == 2, "the doorbell entity's own motion events are not a ring"
    clock.advance(seconds=130)
    with w.db.connection() as conn:
        assert notify_sources.ring_expiry(conn, clock.now) == {"rings_expired": 1}
    assert w.one("door.ring")["state"] == "resolved"


def test_a_ha_doorbell_is_not_a_door_deep_link_row(w):
    e = w.entity("event.bell", "doorbell", state="a", floor=w.ids["floor2"])
    w.push(e, "a", "b", "doorbell", event_type="ring")
    row = w.inbox("joni")[0]
    assert row["door"] is None, "the open-the-door deep link exists only for WisKey stations (subject kind door)"


# ---------------------------------------------------------------- the real hook inside ha_sync

def test_the_state_hook_inside_ha_sync_handle_state_event(w):
    from smplwise.services import ha_sync

    e = w.entity("binary_sensor.k_leak", "moisture", floor=w.ids["floor2"])
    ha_sync.handle_state_event(w.db, {"old_state": {"entity_id": e, "state": "off", "attributes": {"device_class": "moisture", "friendly_name": "k"}},
                                      "new_state": {"entity_id": e, "state": "on", "attributes": {"device_class": "moisture", "friendly_name": "k"}, "last_changed": iso(w.clock.now), "last_updated": iso(w.clock.now)}})
    assert w.one("sensor.leak")["subject_id"] == e
    ha_sync.handle_state_event(w.db, {"old_state": {"entity_id": e, "state": "on", "attributes": {"device_class": "moisture"}},
                                      "new_state": {"entity_id": e, "state": "off", "attributes": {"device_class": "moisture"}, "last_changed": iso(w.clock.now), "last_updated": iso(w.clock.now)}})
    assert w.one("sensor.leak")["state"] == "resolved"


def test_a_failing_hook_never_breaks_the_state_update(w, monkeypatch):
    from smplwise.services import ha_sync

    def boom(*a, **k):
        raise RuntimeError("policy table gone")

    monkeypatch.setattr(notify, "emit_full", boom)
    e = w.entity("binary_sensor.k_leak", "moisture", floor=w.ids["floor2"])
    ha_sync.handle_state_event(w.db, {"old_state": {"entity_id": e, "state": "off", "attributes": {"device_class": "moisture"}},
                                      "new_state": {"entity_id": e, "state": "on", "attributes": {"device_class": "moisture"}, "last_changed": iso(w.clock.now), "last_updated": iso(w.clock.now)}})
    with w.db.connection(mode="read") as conn:
        assert conn.execute("SELECT state FROM ha_entities WHERE entity_id = ?", (e,)).fetchone()["state"] == "on", "the mirror row was still written"
