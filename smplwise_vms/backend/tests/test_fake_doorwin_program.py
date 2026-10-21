"""CR-039 W0 self-tests: the fake WisKey hold-open program engine behaves as the module docstring and the extraction (R)
say. Fakes only: no WisKey, no Home Assistant, no station, no door."""
from __future__ import annotations

import asyncio
import datetime as dt
import json

import pytest
from fake_doorwin_asserts import assert_unknown_open_not_retried
from fake_doorwin_clock import at_local, utc
from fake_doorwin_program import (ACTION, LIST, PRE_EFFECT_CODES, PREFIX, SAVE, FakeEngineError, FakeOutcomeUnknown, FakeTransportDown, date_exception, make_policy,
                                  policy_code, window_token)
from fake_doorwin_world import DOCK, ENTRY, SIDE, DoorwinWorld
from fake_wiskey import FakeWiskey

ZONE = "Asia/Jerusalem"
D = (ENTRY, 1)
# the world starts Sunday 2026-11-01 08:00 local; this window runs 08:00-11:00 local on Sundays
SUNDAY_MORNING = make_policy("Arx entrance v1", {"Sunday": [("08:00", "11:00")]})


def save(w: DoorwinWorld, policy=SUNDAY_MORNING, *, door=D, revision=0, enabled=True, **extra):
    return w.programs.command(SAVE, station_id=door[0], door=door[1], revision=revision, policy=policy, enabled=enabled, **extra)


def prog(w: DoorwinWorld, door=D):
    return w.programs.program(*door)


@pytest.fixture()
def w() -> DoorwinWorld:
    return DoorwinWorld()


def test_list_shape_and_empty(w):
    out = w.programs.command(LIST, station_id=ENTRY)
    assert out == {"programs": [], "saved": [], "timezone": ZONE, "native_supported": False}
    with pytest.raises(FakeEngineError) as e:
        w.programs.command(LIST, station_id="01JUNKNOWNSTATION0000000Z")
    assert e.value.code == "station_unloaded"


def test_save_creates_revision_one_and_does_not_tick_immediately(w):
    out = save(w)
    assert [p["revision"] for p in out["programs"]] == [1]
    assert prog(w)["execution"] == {"owned": False, "attempted": None, "status": "idle"}
    assert w.programs.device_log == [] and not w.bank.truth_open(D)  # no immediate tick (R)
    w.advance(15)
    p = prog(w)
    assert p["execution"]["status"] == "held_acknowledged" and p["execution"]["owned"] is True
    assert p["execution"]["attempted"] == "2026-11-01/08:00/11:00"
    assert w.programs.device_log.commands() == ["alwaysOpen"] and w.bank.truth_open(D)


def test_window_end_closes_and_does_not_reopen(w):
    save(w)
    w.advance(15)
    w.run_until(at_local(ZONE, 2026, 11, 1, 11, 0, 10))
    assert prog(w)["execution"]["status"] == "idle" and not w.bank.truth_open(D)
    assert w.programs.device_log.commands() == ["alwaysOpen", "close"]
    w.advance(3600)
    assert w.programs.device_log.commands() == ["alwaysOpen", "close"]


def test_compare_and_set_and_pause_before_edit(w):
    save(w)
    with pytest.raises(FakeEngineError) as e:
        save(w, revision=0)
    assert e.value.code == "revision_conflict"
    with pytest.raises(FakeEngineError) as e:
        save(w, revision=1)
    assert e.value.code == "hold_pause_before_edit"  # enabled
    w.programs.command(ACTION, station_id=ENTRY, door=1, revision=1, action="pause")
    out = save(w, revision=2)
    assert out["programs"][0]["revision"] == 3 and out["programs"][0]["enabled"] is True


def test_editing_an_enabled_program_needs_a_pause_even_outside_a_window(w):
    """R (hold_programs.update): `enabled` alone triggers hold_pause_before_edit - CR-039 4.3's "a change outside a window is
    one save" does not hold for an enabled program (recorded in CR-039-W0-NOTES.md)."""
    save(w, make_policy("Arx entrance v1", {"Monday": [("08:00", "11:00")]}))
    w.advance(60)
    assert prog(w)["execution"]["owned"] is False and prog(w)["enabled"] is True
    with pytest.raises(FakeEngineError) as e:
        save(w, revision=1)
    assert e.value.code == "hold_pause_before_edit"


def test_pause_is_idempotent_in_effect_but_bumps_the_revision(w):
    """4.4 step 3 calls the retry `pause` idempotent: true for the door, not for the revision (R: every action is revision+1)."""
    save(w)
    w.advance(15)
    w.programs.command(ACTION, station_id=ENTRY, door=1, revision=1, action="pause")
    w.programs.command(ACTION, station_id=ENTRY, door=1, revision=2, action="pause")
    assert prog(w)["revision"] == 3 and prog(w)["enabled"] is False
    with pytest.raises(FakeEngineError) as e:
        w.programs.command(ACTION, station_id=ENTRY, door=1, revision=2, action="pause")
    assert e.value.code == "revision_conflict"  # a retry must re-read the revision first
    assert w.programs.device_log.commands() == ["alwaysOpen", "close"]


def test_pause_closes_a_held_door_immediately_and_there_is_no_resume(w):
    save(w)
    w.advance(15)
    assert w.bank.truth_open(D)
    out = w.programs.command(ACTION, station_id=ENTRY, door=1, revision=1, action="pause")
    p = out["programs"][0]
    assert p["enabled"] is False and p["revision"] == 2 and p["execution"]["status"] == "idle"
    assert not w.bank.truth_open(D) and w.programs.device_log.commands() == ["alwaysOpen", "close"]
    with pytest.raises(FakeEngineError) as e:
        w.programs.command(ACTION, station_id=ENTRY, door=1, revision=2, action="resume")
    assert e.value.code == "invalid_fields"
    w.advance(60)
    assert w.programs.device_log.commands() == ["alwaysOpen", "close"]  # paused stays paused


def test_remove_waits_for_a_confirmed_close(w):
    save(w)
    w.advance(15)
    w.programs.close_refused[D] = 2
    out = w.programs.command(ACTION, station_id=ENTRY, door=1, revision=1, action="remove")
    p = out["programs"][0]
    assert p["removing"] is True and p["execution"]["status"] == "unknown" and p["error"] == "technical_write_unknown"
    assert w.bank.truth_open(D)
    w.advance(15)
    assert prog(w)["removing"] is True  # second refusal
    w.advance(15)
    assert prog(w) is None and not w.bank.truth_open(D)
    assert w.programs.device_log.commands() == ["alwaysOpen", "close", "close", "close"]


def test_ha_down_at_end_time_leaves_the_door_held_until_ha_returns(w):
    save(w)
    w.advance(15)
    w.run_until(at_local(ZONE, 2026, 11, 1, 10, 59, 0))
    w.ha_down()
    w.run_until(at_local(ZONE, 2026, 11, 1, 12, 0, 0))
    assert w.bank.truth_open(D) and prog(w)["execution"]["status"] == "held_acknowledged"  # the stale engine view
    with pytest.raises(FakeTransportDown):
        w.programs.command(LIST, station_id=ENTRY)
    w.ha_up()
    w.advance(15)
    assert not w.bank.truth_open(D) and prog(w)["execution"]["status"] == "idle"


def test_restart_mid_window_closes_and_does_not_reopen_in_that_window(w):
    save(w)
    w.advance(15)
    w.programs.restart_ha()
    w.advance(15)
    assert not w.bank.truth_open(D)
    w.run_until(at_local(ZONE, 2026, 11, 1, 10, 50))
    assert w.programs.device_log.commands() == ["alwaysOpen", "close"]
    w.run_until(at_local(ZONE, 2026, 11, 8, 8, 0, 20))  # next Sunday: the next window opens normally
    assert w.programs.device_log.commands() == ["alwaysOpen", "close", "alwaysOpen"]
    assert w.bank.truth_open(D)


def test_network_loss_at_end_keeps_retrying_close_every_tick(w):
    save(w)
    w.advance(15)
    w.run_until(at_local(ZONE, 2026, 11, 1, 10, 59, 50))
    w.network_loss(ENTRY)
    w.run_until(at_local(ZONE, 2026, 11, 1, 11, 1, 0))
    p = prog(w)
    assert p["execution"] == {"owned": True, "attempted": "2026-11-01/08:00/11:00", "status": "unknown"} and p["error"] == "technical_write_unknown"
    assert w.bank.truth_open(D)
    failed = [r for r in w.programs.device_log if r.command == "close"]
    assert len(failed) >= 4 and all(r.outcome == "unknown" and not r.effect for r in failed)
    w.network_loss(ENTRY, lost=False)
    w.advance(15)
    assert not w.bank.truth_open(D) and prog(w)["execution"]["status"] == "idle" and prog(w)["error"] is None


def test_close_ack_lost_means_unknown_although_the_door_returned(w):
    save(w)
    w.advance(15)
    w.programs.close_ack_lost.add(D)
    w.run_until(at_local(ZONE, 2026, 11, 1, 11, 0, 10))
    assert prog(w)["execution"]["status"] == "unknown" and not w.bank.truth_open(D)
    w.programs.close_ack_lost.clear()
    w.advance(15)
    assert prog(w)["execution"]["status"] == "idle"


def test_open_failure_is_closed_and_never_reopened_in_the_same_window(w):
    w.programs.open_refused[D] = True
    save(w)
    w.advance(15)
    assert prog(w)["execution"]["status"] == "unknown"
    w.programs.open_refused.clear()
    w.advance(15 * 20)
    assert w.programs.device_log.commands() == ["alwaysOpen", "close"]
    assert not w.bank.truth_open(D)
    assert_unknown_open_not_retried(w.programs.device_log)  # WisKey's own executor obeys SR-3


def test_back_to_back_windows_close_then_reopen_one_tick_later(w):
    save(w, make_policy("Arx entrance v1", {"Sunday": [("08:00", "08:30"), ("08:30", "09:00")]}))
    w.run_until(at_local(ZONE, 2026, 11, 1, 8, 30, 20))
    assert w.programs.device_log.commands() == ["alwaysOpen", "close", "alwaysOpen"]  # R: the token changes at the boundary
    first_close, reopen = w.programs.device_log[1], w.programs.device_log[2]
    assert reopen.at > first_close.at


def test_date_exceptions_replace_the_weekday(w):
    sunday = make_policy("Arx entrance v1", {"Sunday": [("08:00", "11:00")]}, holidays=[date_exception("Holiday", "2026-11-01")])
    save(w, sunday)
    w.advance(3600)
    assert w.programs.device_log == [] and not w.bank.truth_open(D)
    assert window_token(sunday, at_local(ZONE, 2026, 11, 8, 9, 0)) == "2026-11-08/08:00/11:00"
    friday_like = make_policy("x", {"Sunday": [("08:00", "11:00")]}, holidays=[date_exception("Eve", "2026-11-08", periods=[("07:00", "13:00")])])
    assert window_token(friday_like, at_local(ZONE, 2026, 11, 8, 12, 0)) == "2026-11-08/07:00/13:00"


def test_dst_repeated_hour_holds_once_and_missing_hour_never_opens():
    # Israel 2026: clocks go back on Sunday 2026-10-25 02:00 -> 01:00 (the 01:00-02:00 hour happens twice)
    w = DoorwinWorld(start=utc(2026, 10, 24, 21, 0))
    save(w, make_policy("Arx entrance v1", {"Sunday": [("01:00", "01:30")]}))
    first, second = utc(2026, 10, 24, 22, 10), utc(2026, 10, 24, 23, 10)  # 01:10 IDT and 01:10 IST
    policy = w.programs.program(*D)["policy"]
    assert window_token(policy, first) == window_token(policy, second) == "2026-10-25/01:00/01:30"
    w.run_until(utc(2026, 10, 25, 1, 0))  # past both passes of 01:00-01:30
    assert w.programs.device_log.commands() == ["alwaysOpen", "close"]
    # 2027-03-26 02:00 -> 03:00 (Friday): a 02:00-02:30 window does not exist that day
    gap = make_policy("x", {"Friday": [("02:00", "02:30")]})
    start = utc(2027, 3, 25, 23, 0)
    assert all(window_token(gap, start + dt.timedelta(minutes=m)) is None for m in range(0, 120, 5))
    assert window_token(gap, at_local(ZONE, 2027, 4, 2, 2, 10)) == "2027-04-02/02:00/02:30"  # an ordinary Friday
    partial = make_policy("x", {"Friday": [("01:30", "02:30")]})  # partly inside the gap: executed partly, not dropped
    assert window_token(partial, utc(2027, 3, 25, 23, 45)) == "2027-03-26/01:30/02:30"  # 01:45 IST
    assert window_token(partial, utc(2027, 3, 26, 0, 0)) is None  # 03:00 IDT


def test_ha_clock_skew_moves_the_window(w):
    save(w, make_policy("Arx entrance v1", {"Sunday": [("08:05", "09:00")]}))
    w.programs.ha_clock_skew_s = 600  # HA ten minutes ahead
    w.advance(15)
    assert w.bank.truth_open(D)


def test_status_unavailable_and_errors_once(w):
    save(w)
    w.programs.status_unavailable = "device_busy"
    with pytest.raises(FakeEngineError) as e:
        w.programs.command(LIST, station_id=ENTRY)
    assert e.value.code == "device_busy"
    w.programs.status_unavailable = None
    w.programs.errors_once[ACTION] = "device_busy"
    with pytest.raises(FakeEngineError):
        w.programs.command(ACTION, station_id=ENTRY, door=1, revision=1, action="pause")
    assert prog(w)["revision"] == 1 and prog(w)["enabled"] is True  # refused before any effect
    assert w.programs.requests[-1]["outcome"] == "refused" and w.programs.requests[-1]["effect"] is False


@pytest.mark.parametrize("when,effect", [("before_effect", False), ("after_effect", True)])
def test_lost_answers_carry_the_truth(w, when, effect):
    w.programs.lose_answer[SAVE] = when
    with pytest.raises(FakeOutcomeUnknown) as e:
        save(w)
    assert e.value.effect is effect
    assert (prog(w) is not None) is effect
    assert w.programs.requests[-1]["outcome"] == "unknown"


def test_arx_link_down_does_not_stop_the_engine(w):
    save(w)
    w.arx_link(False)
    with pytest.raises(FakeTransportDown):
        w.programs.command(LIST, station_id=ENTRY)
    w.advance(15)
    assert w.bank.truth_open(D)  # WisKey goes on without Arx


def test_u2_trusted_writes_request_ids_and_actor(w):
    actor = {"type": "user", "user_id": "u-ops-1"}
    with pytest.raises(FakeEngineError) as e:
        save(w, request_id="req-00000001", actor=actor)
    assert e.value.code == "invalid_format"  # rc.37: the strict schema has no such keys
    w.programs.u2_trusted_writes = True
    first = save(w, request_id="req-00000001", actor=actor)
    again = save(w, request_id="req-00000001", actor=actor)
    assert again == first and len(w.programs.programs) == 1 and prog(w)["revision"] == 1  # deduplicated, nothing executed
    assert [a["request_id"] for a in w.programs.wiskey_audit] == ["req-00000001"]
    assert set(w.programs.wiskey_audit[0]) == {"at", "request_id", "actor", "command", "station_id", "door", "outcome"}  # never a body
    with pytest.raises(FakeEngineError) as e:
        w.programs.command(ACTION, station_id=ENTRY, door=1, revision=1, action="pause", request_id="req-00000002", actor={"type": "automation"})
    assert e.value.code == "invalid_fields"
    auto = {"type": "automation", "automation_id": "automation.lobby", "item_revision": "r7", "approving_user": "u-mgr-1"}
    w.programs.command(ACTION, station_id=ENTRY, door=1, revision=1, action="pause", request_id="req-00000003", actor=auto)
    w.programs.dedupe_request_ids = False
    with pytest.raises(FakeEngineError) as e:
        w.programs.command(ACTION, station_id=ENTRY, door=1, revision=1, action="pause", request_id="req-00000003", actor=auto)
    assert e.value.code == "revision_conflict"  # without dedupe the compare-and-set is the only guard


def test_policy_validation_codes():
    ok = make_policy("Arx a v1", {"Monday": [("08:00", "09:00")]})
    assert policy_code(ok) is None
    assert policy_code(make_policy("x" * 33)) == "invalid_fields"
    assert policy_code(make_policy("n", {"Monday": [(f"{h:02d}:00", f"{h:02d}:30") for h in range(9)]})) == "schedule_period_limit"
    assert policy_code(make_policy("n", {"Monday": [("08:00", "10:00"), ("09:00", "11:00")]})) == "schedule_overlap"
    assert policy_code(make_policy("n", {"Monday": [("22:00", "02:00")]})) == "schedule_invalid_time"  # no overnight period
    assert policy_code(make_policy("n", {"Monday": [("08:00", "24:00")]})) is None
    assert policy_code(make_policy("n", zone="Mars/Olympus")) == "invalid_timezone"
    assert policy_code({**ok, "extra": 1}) == "invalid_fields"
    two = make_policy("n", holidays=[date_exception("a", "2026-12-01", "2026-12-03"), date_exception("b", "2026-12-03")])
    assert policy_code(two) == "schedule_holiday_overlap"


def test_request_size_cap(w):
    w.programs.u2_trusted_writes = False
    big = make_policy("n", holidays=[date_exception("h" * 30000, "2027-01-01"), date_exception("h" * 30000, "2027-01-02"),
                                     date_exception("h" * 10000, "2027-01-03")])
    with pytest.raises(FakeEngineError) as e:
        save(w, big)
    assert e.value.code == "request_too_large"
    assert len(json.dumps(big)) > 65536


def test_wrong_door_foreign_program_and_limit(w):
    with pytest.raises(FakeEngineError) as e:
        save(w, door=(ENTRY, 2))
    assert e.value.code == "operation_unsupported"
    foreign = w.programs.add_foreign(SIDE, 1)
    assert foreign.foreign and prog(w, (SIDE, 1))["policy"]["schedule"]["name"] == "Lobby hours"
    w.programs.max_programs = 1
    with pytest.raises(FakeEngineError) as e:
        save(w, door=(DOCK, 1))
    assert e.value.code == "schedule_limit"


def test_enabled_save_needs_the_station(w):
    w.network_loss(ENTRY)
    with pytest.raises(FakeEngineError) as e:
        save(w)
    assert e.value.code == "device_unavailable"
    save(w, enabled=False)  # storage only, no device reads
    assert prog(w)["enabled"] is False


def test_status_push_is_a_switch():
    quiet = DoorwinWorld()
    save(quiet)
    quiet.advance(15)
    assert quiet.programs.pushes == []
    loud = DoorwinWorld(unknowns={"U6": True})
    save(loud)
    loud.advance(15)
    assert [s for _, _, s in loud.programs.pushes] == ["opening", "held_acknowledged"]


def test_call_form_answers_frames(w):
    call = w.programs.as_call()
    frame = asyncio.run(call(PREFIX + LIST, station_id=ENTRY))
    assert frame["success"] is True and frame["result"]["native_supported"] is False


def test_attached_to_fake_wiskey(w):
    fw = FakeWiskey()
    station = fw.overview["stations"][0]["id"]
    stations = {station: [lock["physical_index"] for lock in fw.overview["stations"][0]["integrated_locks"]]}
    w2 = DoorwinWorld(stations=stations)
    w2.programs.attach(fw)
    listed = fw.respond({"id": 1, "type": PREFIX + LIST, "station_id": station})
    assert listed[0]["success"] and listed[0]["result"]["programs"] == []  # the engine, not the fixture
    door = stations[station][0]
    saved = fw.respond({"id": 2, "type": PREFIX + SAVE, "station_id": station, "door": door, "revision": 0, "policy": SUNDAY_MORNING, "enabled": True})
    assert saved[0]["success"]
    bad = fw.respond({"id": 3, "type": PREFIX + SAVE, "station_id": station, "door": door, "revision": 1, "policy": SUNDAY_MORNING, "enabled": True,
                      "request_id": "req-00000009"})
    assert bad[0]["error"]["code"] == "invalid_format"  # FakeWiskey's catalog strictness stays in front
    w2.programs.lose_answer[ACTION] = "after_effect"
    assert fw.respond({"id": 4, "type": PREFIX + ACTION, "station_id": station, "door": door, "revision": 1, "action": "pause"}) == []  # the answer never comes
    assert w2.programs.program(station, door)["enabled"] is False
    w2.programs.push_on_status_change = True
    w2.programs.u2_trusted_writes = True
    ok = fw.respond({"id": 5, "type": PREFIX + SAVE, "station_id": station, "door": door, "revision": 2, "policy": SUNDAY_MORNING, "enabled": True,
                     "request_id": "req-00000010", "actor": {"type": "user", "user_id": "u-1"}})
    assert ok[0]["success"]
    w2.advance(15)
    assert [s for _, _, s in w2.programs.pushes] == ["opening", "held_acknowledged"]  # each one also pushed `refresh` on fw's sockets


def test_every_refusal_is_before_effect_in_the_fake(w):
    """The fake's truth for U7: each code it refuses with had no effect. Whether WisKey CONFIRMS that is U7 (DoorwinWorld
    `pre_effect_codes`); until then the product treats them as unknown."""
    save(w)
    for attempt in (lambda: save(w, revision=0), lambda: save(w, revision=1), lambda: save(w, door=(ENTRY, 2)),
                    lambda: save(w, make_policy("x" * 40), revision=1),
                    lambda: w.programs.command(ACTION, station_id=ENTRY, door=1, revision=9, action="pause"),
                    lambda: w.programs.command(ACTION, station_id=SIDE, door=1, revision=1, action="pause")):
        with pytest.raises(FakeEngineError):
            attempt()
    refused = [r for r in w.programs.requests if r["outcome"] == "refused"]
    assert len(refused) == 6 and all(not r["effect"] and r["code"] in PRE_EFFECT_CODES for r in refused)