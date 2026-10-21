"""CR-039 W0 self-tests: `FakeEmergencyEngine` (W13-e, U3, U4, the drill engine of 8.8). Fakes only."""
from __future__ import annotations

import pytest
from fake_doorwin_asserts import assert_unknown_open_not_retried
from fake_doorwin_clock import DoorwinScheduler, FakeDoorwinClock
from fake_doorwin_emergency import FakeEmergencyEngine
from fake_doorwin_program import FakeEngineError, make_policy
from fake_doorwin_world import DOCK, ENTRY, SIDE, DoorwinWorld
from fake_wiskey import FakeWiskey

ALL = [(ENTRY, 1), (SIDE, 1), (DOCK, 1), (DOCK, 2)]


def test_kinds_follow_the_unknowns():
    assert DoorwinWorld().emergency.available_kinds() == ["lock_secure"]  # day one: Secure only (8.2), OPEN absent (8.4)
    assert DoorwinWorld(unknowns={"U3": True, "U4": True}).emergency.available_kinds() == ["lock_secure", "lock_lockdown", "open"]
    w = DoorwinWorld()
    for kind in ("open", "lock_lockdown"):
        with pytest.raises(FakeEngineError) as e:
            w.emergency.one(kind, (ENTRY, 1), f"req-e-{kind}")
        assert e.value.code == "unknown_command"


def test_without_a_batch_command_the_product_loops_per_door():
    w = DoorwinWorld()
    with pytest.raises(FakeEngineError) as e:
        w.emergency.batch("lock_secure", ALL, "req-e-0001")
    assert e.value.code == "unknown_command"
    runs = [w.emergency.one("lock_secure", d, f"req-e-1{i:03d}") for i, d in enumerate(ALL)]
    w.advance(1)
    assert all(r.incident_state() == "in_effect" for r in runs)
    with_batch = DoorwinWorld(unknowns={"W13e": True})
    run = with_batch.emergency.batch("lock_secure", ALL, "req-e-0002", reason="drill of the lead")
    assert len(with_batch.emergency.calls) == 1 and set(run.doors) == set(ALL)


def test_per_door_results_and_partial_failure():
    w = DoorwinWorld(unknowns={"W13e": True})
    w.emergency.script = {(SIDE, 1): "refused", (DOCK, 1): "unknown", (DOCK, 2): "slow"}
    run = w.emergency.batch("lock_secure", ALL, "req-e-0003")
    assert run.counts()["sent"] == 4 and run.incident_state() == "applying"
    w.advance(1)
    assert run.states() == {(ENTRY, 1): "acknowledged", (SIDE, 1): "refused", (DOCK, 1): "sent", (DOCK, 2): "sent"}
    w.advance(9)
    assert run.states()[(DOCK, 2)] == "acknowledged" and run.states()[(DOCK, 1)] == "unknown"
    assert run.incident_state() == "in_effect_partial"
    assert {r.code for r in run.doors.values()} == {None, "refused", "answer_lost"}


def test_latency_budget_with_the_incident_lane():
    clock = FakeDoorwinClock()
    sched = DoorwinScheduler(clock)
    doors = [(f"01JTESTSTATION{i:012d}", 1) for i in range(30)]
    eng = FakeEmergencyEngine(clock, sched, doors)
    eng.batch_command = True
    run = eng.batch("lock_secure", doors, "req-e-0004")
    assert run.first_sent_after_s() == 0.0
    sched.advance(5)
    assert run.all_sent_after_s() is not None and run.all_sent_after_s() < 5.0  # 8.7: 30 doors out within 5 s
    assert run.settled
    eng.latency_s = 1.0
    slow = eng.batch("lock_secure", doors, "req-e-0005")
    sched.advance(5)
    assert slow.all_sent_after_s() is None  # 4 slots x 1 s: the budget is visibly missed - measurable, not hidden


def test_effects_on_the_door_bank():
    w = DoorwinWorld(unknowns={"U3": True, "U4": True, "W13e": True})
    w.programs.command("stations/technical_program_save", station_id=ENTRY, door=1, revision=0,
                       policy=make_policy("Arx e v1", {"Sunday": [("08:00", "11:00")]}), enabled=True)
    w.advance(15)
    assert w.bank.truth_open((ENTRY, 1))
    w.emergency.batch("lock_secure", [(ENTRY, 1)], "req-e-0006")
    w.advance(1)
    assert not w.bank.truth_open((ENTRY, 1))  # every hold ended (credentials still work: no lockdown)
    w.emergency.batch("lock_lockdown", ALL, "req-e-0007")
    w.advance(1)
    assert all(w.bank.door(d).lockdown for d in ALL)
    w.emergency.release_batch("lock_lockdown", ALL, "req-e-0008")
    w.advance(1)
    assert not any(w.bank.door(d).lockdown for d in ALL)
    w.emergency.batch("open", ALL, "req-e-0009")
    w.advance(1)
    assert set(w.bank.truth_open_doors()) == set(ALL)
    release = w.emergency.release_batch("open", ALL, "req-e-0010")
    w.advance(1)
    assert release.incident_state() == "released" and w.bank.truth_open_doors() == []


def test_release_partial_and_unknown_lost_does_not_apply():
    w = DoorwinWorld(unknowns={"U3": True, "W13e": True})
    w.emergency.batch("open", ALL, "req-e-0011")
    w.advance(1)
    w.emergency.release_script = {(DOCK, 2): "unknown_lost"}
    rel = w.emergency.release_batch("open", ALL, "req-e-0012")
    w.advance(11)
    assert rel.incident_state() == "released_partial" and w.bank.truth_open_doors() == [(DOCK, 2)]
    assert rel.doors[(DOCK, 2)].applied is False


def test_duplicate_request_ids_execute_once():
    w = DoorwinWorld(unknowns={"W13e": True})
    a = w.emergency.batch("lock_secure", ALL, "req-e-0013")
    b = w.emergency.batch("lock_secure", ALL, "req-e-0013")
    assert a is b and sum(w.emergency.attempts.values()) == 4 and len(w.emergency.calls) == 2


def test_e1_retry_script_and_bound():
    w = DoorwinWorld(unknowns={"U3": True})
    door = (ENTRY, 1)
    w.emergency.attempt_script[door] = ["unknown_lost", "unknown_lost", "ok"]
    for n in range(3):
        run = w.emergency.one("open", door, f"req-e-02{n}")
        w.advance(10)
        if run.states()[door] == "acknowledged":
            break
    assert w.emergency.attempts[("open", "apply", door)] == 3 and w.bank.truth_open(door)
    # the product's attempts share one incident scope: the E-1 rule allows these three, 10 s apart
    log = [{**r.as_dict(), "key": "incident-1"} for r in w.emergency.device_log]
    assert_unknown_open_not_retried(log)


def test_unreachable_engine_answers_unknown_and_applies_nothing():
    w = DoorwinWorld(unknowns={"W13e": True})
    w.emergency.reachable = False
    run = w.emergency.batch("lock_secure", ALL, "req-e-0030")
    w.advance(11)
    assert set(run.states().values()) == {"unknown"} and {r.code for r in run.doors.values()} == {"no_connection"}
    assert not any(r.applied for r in run.doors.values())


def test_drill_engine_offers_everything_moves_nothing_and_never_reaches_wiskey():
    fw = FakeWiskey()
    clock = FakeDoorwinClock()
    sched = DoorwinScheduler(clock)
    eng = FakeEmergencyEngine.for_drill(clock, sched, ALL, script={(SIDE, 1): "refused"})
    assert eng.available_kinds() == ["lock_secure", "lock_lockdown", "open"] and eng.bank is None
    run = eng.one("open", (SIDE, 1), "req-d-0001")
    sched.advance(1)
    assert run.states()[(SIDE, 1)] == "refused"
    assert fw.received == []
    with pytest.raises(FakeEngineError):
        eng.one("open", ("01JNOTADOOR00000000000000", 1), "req-d-0002")
