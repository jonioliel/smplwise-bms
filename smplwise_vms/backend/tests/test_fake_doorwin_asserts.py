"""CR-039 W0 self-tests: the helper assertions catch what they promise and pass what is legitimate. Fakes only."""
from __future__ import annotations

import logging

import pytest
from fake_doorwin_asserts import (DoorwinAssertionError, assert_close_retries_bounded, assert_failed_close_reported, assert_no_secrets,
                                  assert_no_silent_open, assert_unknown_open_not_retried, find_secrets)
from fake_doorwin_clock import at_local
from fake_doorwin_program import SAVE, make_policy
from fake_doorwin_world import ENTRY, DoorwinWorld

ZONE = "Asia/Jerusalem"
D = (ENTRY, 1)
T0 = "2026-11-01T09:00:00+00:00"


def rec(at, command, outcome, key="w1", door=D):
    return {"at": at, "station": door[0], "door": door[1], "command": command, "outcome": outcome, "key": key}


def rep(at, state, resolution=None, door=D):
    return {"at": at, "door": door, "state": state, "resolution": resolution}


# ---------------------------------------------------------------- a failed close is never silent
def test_failed_close_without_a_report_is_caught():
    log = [rec(T0, "close", "unknown")]
    with pytest.raises(DoorwinAssertionError):
        assert_failed_close_reported(log, [], within_s=150)
    with pytest.raises(DoorwinAssertionError):  # a report too late
        assert_failed_close_reported(log, [rep("2026-11-01T09:05:00+00:00", "relock_unconfirmed")], within_s=150)
    assert_failed_close_reported(log, [rep("2026-11-01T09:02:00+00:00", "relock_unconfirmed")], within_s=150)


def test_failed_close_recovered_by_the_engine_within_the_bound_needs_no_report():
    log = [rec(T0, "close", "unknown"), rec("2026-11-01T09:00:15+00:00", "close", "ok")]
    assert_failed_close_reported(log, [rep("2026-11-01T09:00:30+00:00", "closed_confirmed")], within_s=150)


def test_a_false_confirmation_is_caught_and_a_manual_check_is_allowed():
    log = [rec(T0, "close", "unknown")]
    reports = [rep("2026-11-01T09:02:00+00:00", "relock_unconfirmed"), rep("2026-11-01T09:10:00+00:00", "closed_confirmed")]
    with pytest.raises(DoorwinAssertionError):
        assert_failed_close_reported(log, reports, within_s=150)
    reports[-1]["resolution"] = "manual_checked"
    assert_failed_close_reported(log, reports, within_s=150)


def test_reports_in_column_shape_are_accepted():
    log = [rec(T0, "pause", "refused")]
    report = {"at": "2026-11-01T09:01:00+00:00", "config_entry_id": ENTRY, "physical_index": 1, "state": "relock_unconfirmed"}
    assert_failed_close_reported(log, [report], within_s=150)


def test_no_silent_open_with_the_hidden_truth():
    w = DoorwinWorld()
    w.programs.command(SAVE, station_id=ENTRY, door=1, revision=0, policy=make_policy("Arx e v1", {"Sunday": [("08:00", "09:00")]}), enabled=True)
    w.advance(15)
    assert_no_silent_open(w.bank, {}, expected_open=[D])  # inside the window: legitimately open
    w.ha_down()
    w.run_until(at_local(ZONE, 2026, 11, 1, 9, 5))
    with pytest.raises(DoorwinAssertionError):
        assert_no_silent_open(w.bank, {D: "closed_confirmed"})
    assert_no_silent_open(w.bank, {D: "relock_unconfirmed"})


# ---------------------------------------------------------------- an unknown open is never repeated
def test_unknown_open_retry_is_caught_per_scope():
    log = [rec(T0, "alwaysOpen", "unknown"), rec("2026-11-01T09:00:15+00:00", "close", "ok"), rec("2026-11-01T09:00:30+00:00", "alwaysOpen", "ok")]
    with pytest.raises(DoorwinAssertionError):
        assert_unknown_open_not_retried(log)
    log[-1]["key"] = "w2"  # the next window is a new scope
    assert_unknown_open_not_retried(log)


def test_program_save_requests_count_as_opens():
    w = DoorwinWorld()
    policy = make_policy("Arx e v1", {"Sunday": [("08:00", "09:00")]})
    w.programs.lose_answer[SAVE] = "after_effect"
    with pytest.raises(Exception):
        w.programs.command(SAVE, station_id=ENTRY, door=1, revision=0, policy=policy, enabled=True)
    with pytest.raises(Exception):  # the forbidden second save of the same compiled document (revision_conflict anyway)
        w.programs.command(SAVE, station_id=ENTRY, door=1, revision=0, policy=policy, enabled=True)
    with pytest.raises(DoorwinAssertionError):
        assert_unknown_open_not_retried(w.programs.requests)


def test_e1_exception_is_bounded():
    def e(at, outcome):
        return rec(at, "emergency_open", outcome, key="incident-1")

    ok = [e("2026-11-01T09:00:00+00:00", "unknown"), e("2026-11-01T09:00:10+00:00", "unknown"), e("2026-11-01T09:00:20+00:00", "ok")]
    assert_unknown_open_not_retried(ok)
    with pytest.raises(DoorwinAssertionError):
        assert_unknown_open_not_retried(ok + [e("2026-11-01T09:00:30+00:00", "ok")])  # a 4th attempt
    with pytest.raises(DoorwinAssertionError):
        assert_unknown_open_not_retried([e("2026-11-01T09:00:00+00:00", "unknown"), e("2026-11-01T09:00:05+00:00", "ok")])  # too fast
    mixed = [rec(T0, "hold_until", "unknown", key="incident-1"), e("2026-11-01T09:00:10+00:00", "ok")]
    with pytest.raises(DoorwinAssertionError):
        assert_unknown_open_not_retried(mixed)  # E-1 covers emergency_open only


def test_close_retry_schedule():
    start = "2026-11-01T09:02:00+00:00"
    assert_close_retries_bounded(["2026-11-01T09:02:30+00:00", "2026-11-01T09:03:30+00:00", "2026-11-01T09:05:30+00:00"], start)
    with pytest.raises(DoorwinAssertionError):
        assert_close_retries_bounded(["2026-11-01T09:02:10+00:00"], start)
    with pytest.raises(DoorwinAssertionError):
        assert_close_retries_bounded(["2026-11-01T09:02:30+00:00", "2026-11-01T09:03:30+00:00", "2026-11-01T09:05:30+00:00",
                                      "2026-11-01T09:09:30+00:00"], start)


# ---------------------------------------------------------------- no key / token / phone
def test_secrets_are_found_and_never_echoed():
    secret = "SYNTHETIC-rule-token-0042"
    findings = find_secrets(f"trigger accepted token={secret}", secrets=[secret])
    assert findings and not any(secret in f for f in findings)
    with pytest.raises(DoorwinAssertionError):
        assert_no_secrets({"rule": "r1", "token": "abc123def"})
    with pytest.raises(DoorwinAssertionError):
        assert_no_secrets("auth Bearer abcdefghijklmnop")
    with pytest.raises(DoorwinAssertionError):
        assert_no_secrets("jwt eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3OCJ9.c2lnbmF0dXJlLXZhbHVl")
    with pytest.raises(DoorwinAssertionError):
        assert_no_secrets({"person": {"phone": "+972501234567"}})
    with pytest.raises(DoorwinAssertionError):
        assert_no_secrets("call 054-123-4567 now")
    with pytest.raises(DoorwinAssertionError):
        assert_no_secrets([{"signed_message_json": "{...}"}])


def test_clean_audit_rows_pass(caplog):
    caplog.set_level(logging.INFO, logger="smplwise.doors")
    logging.getLogger("smplwise.doors").info("door.window.engine_write door=%s:%s outcome=%s", ENTRY, 1, "unknown")
    rows = [{"action": "door.window.compiled", "at": "2026-11-01T09:00:00+00:00", "details": {"door": f"{ENTRY}:1", "tier": "program", "program_revision": 3,
             "compiled_sha256": "9f" * 32, "client_request_id": "1b4e28ba-2fa1-11d2-883f-0016d3cca427", "token_sha256": "ab" * 32}},
            {"card": {"masked_number": "•••• 1234"}, "pin_configured": True, "pin": None}]
    assert_no_secrets(caplog.records, rows, "occurrence 2026-11-01T08:00:00+00:00 .. 2026-11-01T11:00:00+00:00")
