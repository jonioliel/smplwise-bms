"""CR-039 W0 self-tests: the tier-A station schedule fake (U1) and the hold-until fake (U3). Fakes only."""
from __future__ import annotations

import datetime as dt

import pytest
from fake_doorwin_clock import at_local
from fake_doorwin_program import FakeEngineError, FakeOutcomeUnknown, FakeTransportDown, make_policy
from fake_doorwin_world import DOCK, ENTRY, SIDE, DoorwinWorld

ZONE = "Asia/Jerusalem"
D = (ENTRY, 1)
SUNDAY_MORNING = make_policy("Arx entrance v1", {"Sunday": [("08:00", "11:00")]})


@pytest.fixture()
def w() -> DoorwinWorld:
    return DoorwinWorld(unknowns={"U1": True, "U3": True})


# ---------------------------------------------------------------- tier A
def test_u1_absent_means_no_command_family():
    w = DoorwinWorld()
    with pytest.raises(FakeEngineError) as e:
        w.stations_engine.create(ENTRY, 1, SUNDAY_MORNING, "req-a-0001")
    assert e.value.code == "unknown_command"


def test_unsupported_door_is_refused_per_door(w):
    w.stations_engine.support((SIDE, 1))
    with pytest.raises(FakeEngineError) as e:
        w.stations_engine.create(ENTRY, 1, SUNDAY_MORNING, "req-a-0002")
    assert e.value.code == "operation_unsupported"
    assert w.stations_engine.create(SIDE, 1, SUNDAY_MORNING, "req-a-0003")["schedule_id"]
    w.stations_engine.unsupport((SIDE, 1))
    with pytest.raises(FakeEngineError):
        w.stations_engine.create(SIDE, 1, SUNDAY_MORNING, "req-a-0004")


def test_station_relock_needs_neither_ha_nor_network_nor_arx(w):
    w.stations_engine.support(D)
    w.stations_engine.create(ENTRY, 1, SUNDAY_MORNING, "req-a-0005")
    w.advance(5)
    assert w.bank.truth_open(D)
    w.ha_down()
    w.network_loss(ENTRY)
    w.arx_link(False)
    w.arx_restart()
    w.run_until(at_local(ZONE, 2026, 11, 1, 11, 0, 5))
    assert not w.bank.truth_open(D)
    assert [r.command for r in w.stations_engine.device_log] == ["alwaysOpen", "close"]


def test_writes_need_ha_and_are_idempotent(w):
    w.stations_engine.support(D)
    first = w.stations_engine.create(ENTRY, 1, SUNDAY_MORNING, "req-a-0006")
    assert w.stations_engine.create(ENTRY, 1, SUNDAY_MORNING, "req-a-0006") == first
    assert [r["outcome"] for r in w.stations_engine.requests] == ["ok", "duplicate"]
    w.ha_down()
    with pytest.raises(FakeTransportDown):
        w.stations_engine.delete(ENTRY, 1, "req-a-0007")
    with pytest.raises(FakeTransportDown):
        w.stations_engine.list(ENTRY)


def test_delete_returns_the_door_at_once(w):
    w.stations_engine.support(D)
    w.stations_engine.create(ENTRY, 1, SUNDAY_MORNING, "req-a-0008")
    w.advance(5)
    assert w.stations_engine.status(ENTRY, 1) == {"scheduled": True, "held": True}
    w.stations_engine.delete(ENTRY, 1, "req-a-0009")
    assert not w.bank.truth_open(D) and w.stations_engine.list(ENTRY) == []


def test_relock_fault_is_recorded_once_and_the_door_stays_open(w):
    w.stations_engine.support(D)
    w.stations_engine.create(ENTRY, 1, SUNDAY_MORNING, "req-a-0010")
    w.stations_engine.relock_fault.add(D)
    w.run_until(at_local(ZONE, 2026, 11, 1, 11, 5))
    assert w.bank.truth_open(D)
    faults = [r for r in w.stations_engine.device_log if r.code == "relock_fault"]
    assert len(faults) == 1 and faults[0].outcome == "unknown" and not faults[0].effect


def test_station_clock_skew(w):
    w.stations_engine.support(D)
    w.stations_engine.create(ENTRY, 1, make_policy("Arx e v1", {"Sunday": [("08:10", "09:00")]}), "req-a-0011")
    w.advance(5)
    assert not w.bank.truth_open(D)
    w.stations_engine.station_clock_skew_s[ENTRY] = 900
    w.advance(5)
    assert w.bank.truth_open(D)


@pytest.mark.parametrize("behaviour,open_without_power", [("fail_secure", False), ("fail_safe", True), ("unknown", True)])
def test_power_loss_follows_u5(behaviour, open_without_power):
    w = DoorwinWorld(unknowns={"U1": True, "U5": (behaviour, False)})
    w.bank.power_loss(D)
    assert w.bank.truth_open(D) is open_without_power


def test_reboot_inside_a_window_is_re_held_by_the_station(w):
    w.bank.door(D).hold_survives_reboot = False
    w.stations_engine.support(D)
    w.stations_engine.create(ENTRY, 1, SUNDAY_MORNING, "req-a-0012")
    w.advance(5)
    w.bank.power_loss(D)
    w.advance(30)
    w.bank.power_restore(D)
    assert not w.bank.truth_open(D)  # the hold did not survive the reboot
    w.advance(5)
    assert w.bank.truth_open(D)  # the station's own schedule holds it again


def test_lost_answer_after_effect(w):
    w.stations_engine.support(D)
    w.stations_engine.lose_answer["station_schedule_create"] = "after_effect"
    with pytest.raises(FakeOutcomeUnknown) as e:
        w.stations_engine.create(ENTRY, 1, SUNDAY_MORNING, "req-a-0013")
    assert e.value.effect is True and (ENTRY, 1) in w.stations_engine.schedules


# ---------------------------------------------------------------- U3 hold-until
def test_u3_absent_means_no_hold_command():
    w = DoorwinWorld()
    with pytest.raises(FakeEngineError) as e:
        w.holds.hold_until(ENTRY, 1, w.clock.now() + dt.timedelta(hours=1), "req-h-0001")
    assert e.value.code == "unknown_command"


def test_device_side_hold_relocks_through_an_ha_outage(w):
    until = w.clock.now() + dt.timedelta(hours=2)
    assert w.holds.hold_until(ENTRY, 1, until, "req-h-0002")["accepted"] is True
    assert w.bank.truth_open(D) and w.holds.hold_status(ENTRY, 1)["held"] is True
    w.ha_down()
    w.run_until(until + dt.timedelta(seconds=1))
    assert not w.bank.truth_open(D)


def test_wiskey_side_hold_is_lost_during_an_ha_outage(w):
    w.holds.relock_side = "wiskey"
    until = w.clock.now() + dt.timedelta(hours=2)
    w.holds.hold_until(ENTRY, 1, until, "req-h-0003")
    w.ha_down()
    w.run_until(until + dt.timedelta(minutes=30))
    assert w.bank.truth_open(D)  # nobody relocked
    w.ha_up()
    assert not w.bank.truth_open(D)


def test_hold_idempotent_release_and_failures(w):
    until = w.clock.now() + dt.timedelta(hours=1)
    first = w.holds.hold_until(SIDE, 1, until, "req-h-0004")
    assert w.holds.hold_until(SIDE, 1, until, "req-h-0004") == first
    w.holds.release_refused[(SIDE, 1)] = 1
    with pytest.raises(FakeEngineError) as e:
        w.holds.hold_release(SIDE, 1, "req-h-0005")
    assert e.value.code == "device_unavailable" and w.bank.truth_open((SIDE, 1))
    assert w.holds.hold_release(SIDE, 1, "req-h-0006") == {"released": True}
    assert not w.bank.truth_open((SIDE, 1))
    with pytest.raises(FakeEngineError) as e:
        w.holds.hold_until(SIDE, 1, w.clock.now() - dt.timedelta(seconds=1), "req-h-0007")
    assert e.value.code == "invalid_time"
    w.network_loss(DOCK)
    with pytest.raises(FakeEngineError) as e:
        w.holds.hold_until(DOCK, 2, until, "req-h-0008")
    assert e.value.code == "station_offline"
    w.holds.status_unavailable = "device_busy"
    with pytest.raises(FakeEngineError):
        w.holds.hold_status(SIDE, 1)


@pytest.mark.parametrize("when,effect", [("before_effect", False), ("after_effect", True)])
def test_hold_lost_answer(w, when, effect):
    w.holds.lose_answer["hold_until"] = when
    with pytest.raises(FakeOutcomeUnknown) as e:
        w.holds.hold_until(ENTRY, 1, w.clock.now() + dt.timedelta(hours=1), "req-h-0009")
    assert e.value.effect is effect and w.bank.truth_open(D) is effect
    assert w.holds.device_log[-1].outcome == "unknown"
