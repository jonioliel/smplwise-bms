"""CR-WK-LIMITS-2438 (code review 2026-11-13, finding 02:P2-3): today's behaviour of the five WisKey `Limits` classes and the three
`result_of` readers, pinned on a fake clock BEFORE they were moved onto the shared `services/wiskey_write_limits.py`. Written and run
green against the old classes first; the move must keep every refusal code, retry value and order of checks exactly as it was.

Nothing here contacts a device: the limits are process memory and the frames are literal dictionaries."""
from __future__ import annotations

import time

import pytest

from smplwise.services import wiskey_door_tech as dt
from smplwise.services import wiskey_installer as wi
from smplwise.services import wiskey_schedule_writes as sw
from smplwise.services import wiskey_station_ops as ops
from smplwise.services import wiskey_triage as tr
from smplwise.services.intercom_client import IntercomError, UnclearAnswer


class Clock:
    def __init__(self, t: float = 1000.0) -> None:
        self.t = t

    def __call__(self) -> float:
        return self.t


@pytest.fixture
def clock(monkeypatch):
    c = Clock()
    monkeypatch.setattr(time, "monotonic", c)
    return c


# ---------------------------------------------------------------- station maintenance (wiskey_station_ops)

def test_station_ops_inflight_cooldown_and_rounding(clock):
    lim = ops.Limits()
    assert lim.admit("u", "A", "sync") is None
    assert lim.admit("u", "B", "sync") is None, "a command not yet sent starts no cool-down"
    assert lim.admit("u", "C", "sync") == ("station_ops_busy", 2.0)
    lim.done(), lim.done(), lim.done()  # an extra done never goes below zero
    assert lim.admit("u", "C", "sync") is None and lim.admit("u", "D", "sync") is None
    lim.done(), lim.done()
    lim.sent("A", "sync")
    clock.t += 10
    assert lim.cooldown_left("A", "sync") == 20.0 and lim.cooldown_left("A", "rescan") == 0.0 and lim.cooldown_left("B", "sync") == 0.0
    assert lim.admit("u", "A", "sync") == ("station_ops_cooldown", 20.0)
    assert lim.cooldown_left("A", "sync", now=clock.t + 5) == 15.0
    clock.t += 19.96  # 0.04 s left rounds to 0.0: admitted
    assert lim.cooldown_left("A", "sync") == 0.0 and lim.admit("v", "A", "sync") is None
    lim.reset()
    assert lim.cooldown_left("A", "sync") == 0.0


def test_station_ops_window_and_scale(clock, monkeypatch):
    monkeypatch.setattr(ops, "USER_MAX", 2)
    lim = ops.Limits()
    assert lim.admit("w", "X", "sync") is None
    lim.done()
    clock.t += 10
    assert lim.admit("w", "Y", "sync") is None
    lim.done()
    clock.t += 10
    assert lim.admit("w", "Z", "sync") == ("station_ops_rate_limited", 40.0)
    assert lim.admit("other", "Z", "sync") is None, "the window is per operator"
    lim.done()
    clock.t += 40  # the first entry is exactly one window old: it leaves
    assert lim.admit("w", "Z", "sync") is None
    lim.done()
    monkeypatch.setattr(ops, "COOLDOWN_SCALE", 0.5)
    lim.sent("X", "rescan")
    clock.t += 10
    assert lim.cooldown_left("X", "rescan") == 20.0
    monkeypatch.setattr(ops, "COOLDOWN_SCALE", 0.0)
    assert lim.cooldown_left("X", "rescan") == 0.0


# ---------------------------------------------------------------- installer writes (wiskey_installer)

def test_installer_slot_cooldown_and_window(clock, monkeypatch):
    lim = wi.Limits()
    timed = wi.Op("x", "clock/station_sync", "write", "a", cooldown_s=40.0)
    free = wi.Op("y", "clock/station_sync", "write", "a")
    assert lim.admit("u", timed, "t") is None
    assert lim.admit("u", timed, "t") == ("installer_busy", 3.0)
    lim.done(), lim.done()
    lim.sent(free, "t")
    assert lim.cooldown_left(free, "t") == 0.0, "an op without a cool-down never cools down"
    lim.sent(timed, "t")
    clock.t += 15
    assert lim.cooldown_left(timed, "t") == 25.0 and lim.cooldown_left(timed, "t2") == 0.0
    assert lim.admit("u", timed, "t") == ("installer_cooldown", 25.0)
    assert lim.cooldown_left(wi.Op("x", "other", "write", "b", cooldown_s=40.0), "t") == 25.0, "the cool-down keys on the op's name"
    assert lim.admit("u", timed, "t2") is None
    lim.done()
    monkeypatch.setattr(wi, "USER_MAX", 2)
    clock.t += 0.5
    assert lim.admit("u", free, "t3") == ("installer_rate_limited", 44.5)
    monkeypatch.setattr(wi, "COOLDOWN_SCALE", 0.5)
    assert lim.cooldown_left(timed, "t") == 4.5
    lim.reset()
    assert lim.cooldown_left(timed, "t") == 0.0 and lim.admit("u", free, "t3") is None


# ---------------------------------------------------------------- triage (wiskey_triage)

def test_triage_classes_are_separate(clock, monkeypatch):
    lim = tr.Limits()
    assert lim.admit("u", "write", "t") is None
    assert lim.admit("u", "write", "t2") == ("triage_busy", 2.0)
    assert lim.admit("u", "review", "t") is None and lim.admit("u", "review", "t2") is None
    assert lim.admit("u", "review", "t3") == ("triage_busy", 2.0)
    lim.done("write"), lim.done("review"), lim.done("review"), lim.done("review")
    lim.sent("write", "t")
    clock.t += 4
    assert lim.cooldown_left("write", "t") == 6.0 and lim.cooldown_left("review", "t") == 0.0
    assert lim.admit("u", "write", "t") == ("triage_cooldown", 6.0)
    lim.sent("review", "t")
    clock.t += 1
    assert lim.cooldown_left("review", "t") == 2.0
    monkeypatch.setattr(tr, "USER_MAX", {"review": 2, "write": 10})
    assert lim.admit("u", "review", "q") == ("triage_rate_limited", 55.0), "two earlier reviews: the review window is full"
    assert lim.admit("u", "write", "q") is None, "the write window is its own"
    lim.done("write")
    monkeypatch.setattr(tr, "COOLDOWN_SCALE", 0.0)
    assert lim.cooldown_left("write", "t") == 0.0
    lim.reset()
    assert lim.admit("u", "review", "q") is None


# ---------------------------------------------------------------- schedule writes (wiskey_schedule_writes)

def test_schedule_writes_window_device_slot_and_cooldown(clock, monkeypatch):
    lim = sw.Limits()
    monkeypatch.setattr(sw, "USER_MAX", 1)
    assert lim.admit_write("u") is None
    clock.t += 5
    assert lim.admit_write("u") == ("schedule_rate_limited", 55.0)
    assert lim.admit_write("v") is None
    assert lim.admit_device("S") is None
    assert lim.admit_device("S2") == ("schedule_device_busy", 5.0)
    lim.device_done(), lim.device_done()
    lim.device_sent("S")
    clock.t += 4
    assert lim.admit_device("S") == ("schedule_station_cooldown", 6.0)
    assert lim.admit_device("S2") is None, "another station is not cooled down"
    lim.device_done()
    clock.t += 5.96  # 0.04 s left: still refused, the retry rounds to 0.0
    assert lim.admit_device("S") == ("schedule_station_cooldown", 0.0)
    clock.t += 0.04
    assert lim.admit_device("S") is None
    lim.device_done()
    monkeypatch.setattr(sw, "COOLDOWN_SCALE", 0.0)
    lim.device_sent("S")
    assert lim.admit_device("S") is None
    lim.reset()
    assert lim.admit_write("u") is None


# ---------------------------------------------------------------- door technical writes (wiskey_door_tech)

HOLD, CODE = dt.KINDS["hold_save"], dt.KINDS["code_write"]


def test_door_tech_station_slot_and_cooldown(clock):
    lim = dt.Limits()
    assert lim.admit("u", "A", HOLD, 1) is None
    assert lim.admit("u", "A", HOLD, 2) == ("door_tech_busy", 2.0), "one write per station"
    assert lim.admit("u", "B", HOLD, 1) is None
    assert lim.admit("u", "C", HOLD, 1) == ("door_tech_busy", 2.0), "two at once installation-wide"
    lim.done("A"), lim.done("B"), lim.done("B")
    lim.sent("u", "A", HOLD, 1)
    clock.t += 1
    assert lim.admit("u", "A", HOLD, 1) == ("door_tech_cooldown", 2.0)
    assert lim.admit("u", "A", HOLD, 2) is None, "another door is not cooled down"
    lim.done("A")
    clock.t += 1.96  # 0.04 s left: refused, the retry rounds to 0.0
    assert lim.admit("u", "A", HOLD, 1) == ("door_tech_cooldown", 0.0)
    clock.t += 0.04
    assert lim.admit("u", "A", HOLD, 1) is None
    lim.done("A")


def test_door_tech_code_windows_user_window_and_scale(clock, monkeypatch):
    lim = dt.Limits()
    monkeypatch.setattr(dt, "CODE_USER_MAX", 1)
    lim.sent("u", "A", CODE, 2)
    clock.t += 100
    assert lim.admit("u", "B", CODE, 3) == ("door_tech_code_rate_limited", 800.0)
    assert lim.admit("u", "B", HOLD, 3) is None, "the code window counts code writes only"
    lim.done("B")
    monkeypatch.setattr(dt, "CODE_USER_MAX", 6)
    monkeypatch.setattr(dt, "CODE_STATION_MAX", 1)
    assert lim.admit("other", "A", CODE, 4) == ("door_tech_code_rate_limited", 800.0), "the station's code window counts every operator"
    assert lim.admit("other", "B", CODE, 4) is None
    lim.done("B")
    monkeypatch.setattr(dt, "USER_MAX", 2)
    assert lim.admit("w", "A", HOLD, 1) is None
    lim.done("A")
    clock.t += 10
    assert lim.admit("w", "A", HOLD, 2) is None
    lim.done("A")
    clock.t += 10
    assert lim.admit("w", "B", HOLD, 2) == ("door_tech_rate_limited", 40.0)
    monkeypatch.setattr(dt, "SCALE", 0.5)  # the windows shrink with the scale (here: 30 s)
    assert lim.admit("w", "B", HOLD, 2) == ("door_tech_rate_limited", 10.0)
    lim.sent("w", "C", HOLD, 1)
    clock.t += 1
    assert lim.admit("x", "C", HOLD, 1) == ("door_tech_cooldown", 0.5)
    lim.reset()
    monkeypatch.setattr(dt, "CODE_STATION_MAX", 6)
    assert lim.admit("u", "A", CODE, 2) is None and lim._inflight == {"A"}


# ---------------------------------------------------------------- the three identical answer readers

FRAMES = [
    ({"success": True, "result": {"x": 1}}, ("ok", {"x": 1})),
    ({"success": True}, ("ok", None)),
    ({"success": False, "error": {"code": "station_offline"}}, ("refused", "station_offline")),
    ({"success": False, "error": {"code": "timeout"}}, ("unclear", "timeout")),
    ({"success": False, "error": {"code": ""}}, ("unclear", "action_failed")),
    ({"success": False, "error": "text"}, ("unclear", "action_failed")),
    ({"success": False}, ("unclear", "action_failed")),
    ({"success": False, "error": {"code": "Not A Code!"}}, ("unclear", "Not A Code!")),
    ({"result": 1}, ("unclear", "invalid_response")),
    ({"success": "true"}, ("unclear", "invalid_response")),
]


def _read(fn, frame):
    try:
        return "ok", fn(frame, "the/command")
    except IntercomError as exc:
        assert exc.command == "the/command"
        return "refused", exc.code
    except UnclearAnswer as exc:
        assert exc.command == "the/command"
        return "unclear", exc.code


@pytest.mark.parametrize("module", [ops, sw, tr], ids=["station_ops", "schedule_writes", "triage"])
@pytest.mark.parametrize("frame,expected", FRAMES)
def test_result_of_reads_the_same_way_in_the_three_modules(module, frame, expected):
    assert _read(module.result_of, frame) == expected


@pytest.mark.parametrize("module,code", [(sw, "schedule_write_uncertain"), (tr, "storage_write_failed")])
def test_result_of_keeps_each_modules_own_unclear_codes(module, code):
    assert _read(module.result_of, {"success": False, "error": {"code": code}}) == ("unclear", code)
    assert _read(ops.result_of, {"success": False, "error": {"code": code}}) == ("refused", code)
