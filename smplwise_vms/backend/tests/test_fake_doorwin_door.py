"""CR-039 W0 self-tests: the fake clock / scheduler harness and the door model with its visibility rules. Fakes only."""
from __future__ import annotations

import datetime as dt

import pytest
from fake_doorwin_clock import DEFAULT_START, DoorwinScheduler, FakeDoorwinClock, at_local, utc
from fake_doorwin_door import (CommandRecord, FakeDoor, FakeDoorBank, confirmation_verdict, direction_of, relock_verdict)

from smplwise.services.door_path import OPEN_STATES

D = ("01JTESTSTATIONENTRY000000A", 1)


# ---------------------------------------------------------------- clock and scheduler
def test_clock_is_aware_and_never_runs_backwards():
    c = FakeDoorwinClock()
    assert c.now() == DEFAULT_START and c.now().tzinfo is not None and c.monotonic() == 0
    assert c.local("Asia/Jerusalem").hour == 8
    with pytest.raises(ValueError):
        FakeDoorwinClock(dt.datetime(2026, 1, 1))
    s = DoorwinScheduler(c)
    s.advance(10)
    with pytest.raises(AssertionError):
        c._set(DEFAULT_START)
    assert c.skewed(-30).now() == c.now() - dt.timedelta(seconds=30)
    assert at_local("Asia/Jerusalem", 2026, 11, 1, 8, 0) == utc(2026, 11, 1, 6, 0)


def test_scheduler_is_deterministic_and_ordered():
    def run() -> list[tuple[str, str, str]]:
        c = FakeDoorwinClock()
        s = DoorwinScheduler(c)
        out: list[str] = []
        s.every(15, lambda: out.append("tick"), owner="wiskey", name="tick")
        s.call_later(15, lambda: out.append("same-instant-later-seq"), owner="arx", name="watch")
        s.call_later(7, lambda: s.call_later(1, lambda: out.append("nested"), name="nested"), name="outer")
        s.advance(31)
        assert out == ["nested", "tick", "same-instant-later-seq", "tick"]
        return s.ran

    assert run() == run()


def test_cancel_owner_models_a_restart():
    c = FakeDoorwinClock()
    s = DoorwinScheduler(c)
    hits: list[str] = []
    s.every(30, lambda: hits.append("arx"), owner="arx")
    s.every(15, lambda: hits.append("wiskey"), owner="wiskey")
    assert s.cancel_owner("arx") == 1
    s.advance(60)
    assert hits == ["wiskey"] * 4 and s.pending("arx") == []


def test_a_failing_job_is_recorded_and_the_run_goes_on():
    c = FakeDoorwinClock()
    s = DoorwinScheduler(c)
    s.call_later(1, lambda: 1 / 0, name="boom")
    s.call_later(2, lambda: None, name="after")
    assert s.advance(3) == 2 and s.errors[0][1] == "boom"


def test_step_runs_exactly_one_job():
    c = FakeDoorwinClock()
    s = DoorwinScheduler(c)
    s.call_later(5, lambda: None)
    s.call_later(9, lambda: None)
    assert s.step() and c.monotonic() == 5
    assert s.step() and c.monotonic() == 9
    assert not s.step()


# ---------------------------------------------------------------- the door and what Arx can see
def test_truth_is_hidden_from_observable():
    c = FakeDoorwinClock()
    bank = FakeDoorBank(c, [D])
    bank.hold(D, "program")
    assert bank.truth_open(D)
    view = bank.observable(D)
    assert view == {"lock_state": "locked", "position_sensor": False}  # the optimistic entity says locked while held
    bank.lock_entity_reflects_hold = True
    assert bank.observable(D)["lock_state"] == "unlocked"
    with pytest.raises(ValueError):
        bank.hold(D, "arx_timer")  # tier C does not exist


def test_pulse_is_momentary():
    c = FakeDoorwinClock()
    s = DoorwinScheduler(c)
    bank = FakeDoorBank(c, [FakeDoor(D, open_duration_s=5)])
    bank.pulse(D)
    assert bank.truth_open(D) and bank.lock_entity_state(D) == "unlocked"
    s.advance(5)
    assert not bank.truth_open(D) and bank.lock_entity_state(D) == "locked"
    bank.set_lockdown(D, True)
    bank.pulse(D)
    assert not bank.truth_open(D)


@pytest.mark.parametrize("behaviour,survives,open_after_restore", [("fail_secure", True, True), ("fail_safe", False, False), ("unknown", None, True)])
def test_power_and_reboot(behaviour, survives, open_after_restore):
    c = FakeDoorwinClock()
    bank = FakeDoorBank(c, [FakeDoor(D, power_behaviour=behaviour, hold_survives_reboot=survives)])
    bank.hold(D, "program")
    bank.power_loss(D)
    assert bank.truth_open(D) is (behaviour != "fail_secure")
    bank.power_restore(D)
    assert bank.truth_open(D) is open_after_restore
    assert [why for *_, why in bank.timeline][0] == "hold:program"
    with pytest.raises(ValueError):
        FakeDoor(D, power_behaviour="fail_maybe")


def test_confirmation_verdict_is_the_4_4_rule():
    idle = {"owned": False, "status": "idle"}
    assert confirmation_verdict(idle, "locked") == "closed_confirmed"
    for st in OPEN_STATES:
        assert confirmation_verdict(idle, st) == "unknown"  # the optimistic entity can veto, never confirm
    assert confirmation_verdict({"owned": True, "status": "idle"}, "locked") == "unknown"
    assert confirmation_verdict({"owned": True, "status": "held_acknowledged"}, "locked") == "held"
    assert confirmation_verdict({"owned": True, "status": "restoring"}, "locked") == "pending"
    assert confirmation_verdict({"owned": True, "status": "unknown"}, "locked") == "unknown"
    assert confirmation_verdict(None, "locked") == "not_visible"


def test_relock_verdict_timeline():
    end = utc(2026, 11, 1, 9, 0)
    t = lambda s: end + dt.timedelta(seconds=s)  # noqa: E731
    assert relock_verdict(end, t(-1), 120, []) == "active"
    assert relock_verdict(end, t(60), 120, [(t(30), "pending")]) == "ending"
    assert relock_verdict(end, t(60), 120, [(t(30), "closed_confirmed")]) == "closed_confirmed"
    assert relock_verdict(end, t(121), 120, [(t(30), "unknown"), (t(90), "not_visible")]) == "relock_unconfirmed"
    assert relock_verdict(end, t(121), 120, []) == "relock_unconfirmed"  # feed loss: fail loud
    assert relock_verdict(end, t(900), 120, [(t(800), "closed_confirmed")]) == "closed_confirmed"  # the engine resolved it later
    assert relock_verdict(end, t(900), 120, [(t(-30), "closed_confirmed")]) == "relock_unconfirmed"  # a read before end proves nothing


def test_command_record_directions():
    assert direction_of("alwaysOpen") == direction_of("program_save_enabled") == direction_of("emergency_open") == "open"
    assert direction_of("close") == direction_of("pause") == direction_of("hold_release") == "close"
    assert direction_of("technical_program_list") == "neutral"
    r = CommandRecord("2026-11-01T06:00:00+00:00", "wiskey_program", D[0], D[1], "close", "unknown", False)
    assert r.direction == "close" and r.door_key == D
    with pytest.raises(ValueError):
        CommandRecord("2026-11-01T06:00:00+00:00", "x", D[0], D[1], "close", "maybe", False)
