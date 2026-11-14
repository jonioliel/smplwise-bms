"""CR-WK-LIMITS-2438 (code review 2026-11-13, finding 02:P2-3): the shared WisKey limits and answer reader
(services/wiskey_write_limits.py), and that the five modules use them instead of carrying their own copies.

The behaviour of each module's limits on a fake clock is pinned in tests/test_wiskey_limits_pins_2438.py (written green against the
old copies). Nothing here contacts a device."""
from __future__ import annotations

import inspect
import time

import pytest

from smplwise.services import wiskey_door_tech as dt
from smplwise.services import wiskey_installer as wi
from smplwise.services import wiskey_schedule_writes as sw
from smplwise.services import wiskey_station_ops as ops
from smplwise.services import wiskey_triage as tr
from smplwise.services import wiskey_write_limits as wl
from smplwise.services.intercom_client import IntercomError, UnclearAnswer


@pytest.fixture
def clock(monkeypatch):
    now = [500.0]
    monkeypatch.setattr(time, "monotonic", lambda: now[0])
    return now


def admit(lim: wl.WriteLimits, user: str = "u", key: object = "k", *, cooldown_s: float = 10.0, window_s: float = 60.0, user_max: int = 3,
          max_inflight: int = 1, cls: str = "") -> tuple[str, float] | None:
    return lim.admit_key(user, key, cooldown_s=cooldown_s, window_s=window_s, user_max=user_max, max_inflight=max_inflight, cls=cls)


def test_the_slot_is_held_until_done_and_a_refusal_changes_nothing(clock):
    lim = wl.WriteLimits("demo", busy_retry_s=4.0)
    assert admit(lim) is None
    assert admit(lim, key="other") == ("demo_busy", 4.0)
    assert admit(lim, cls="second") is None, "each class has its own slots"
    lim.done()
    assert admit(lim, key="other") is None
    lim.done(), lim.done(), lim.done()
    assert lim._inflight[""] == 0, "an extra done never goes below zero"
    assert len(lim._users["u"]) == 3, "the busy refusal was not counted in the window"


def test_the_cooldown_starts_only_when_sent(clock):
    lim = wl.WriteLimits("demo", busy_retry_s=1.0)
    assert admit(lim) is None
    lim.done()
    assert lim.key_cooldown_left("k", 10.0) == 0.0, "admitted but not sent: no cool-down"
    lim.mark_sent("k")
    clock[0] += 4
    assert lim.key_cooldown_left("k", 10.0) == 6.0 and lim.cooldown_raw("k", 10.0) == 6.0
    assert admit(lim) == ("demo_cooldown", 6.0)
    assert admit(lim, key="k2") is None
    lim.done()
    assert lim.key_cooldown_left("k", 0.0) == 0.0, "a zero cool-down never runs"
    clock[0] += 5.96
    assert lim.key_cooldown_left("k", 10.0) == 0.0 and 0 < lim.cooldown_raw("k", 10.0) < 0.05, "the two readings of the last 50 ms"
    assert admit(lim) is None


def test_the_window_is_per_key_and_slides(clock):
    lim = wl.WriteLimits("demo", busy_retry_s=1.0)
    for _ in range(2):
        assert admit(lim, user_max=2, max_inflight=9) is None
        clock[0] += 10
    assert admit(lim, user_max=2, max_inflight=9) == ("demo_rate_limited", 40.0)
    assert admit(lim, user="v", user_max=2, max_inflight=9) is None
    clock[0] += 40
    assert admit(lim, user_max=2, max_inflight=9) is None, "an entry exactly one window old has left"


def test_reset_forgets_everything(clock):
    lim = wl.WriteLimits("demo", busy_retry_s=1.0)
    assert admit(lim) is None
    lim.mark_sent("k")
    lim.reset()
    assert lim._last == {} and lim._users == {} and lim._inflight == {}
    assert admit(lim) is None


def test_result_of_reads_one_way_with_the_callers_unclear_codes():
    assert wl.result_of({"success": True, "result": 7}, "c", frozenset()) == 7
    with pytest.raises(IntercomError) as refused:
        wl.result_of({"success": False, "error": {"code": "busy_station"}}, "c", frozenset())
    assert (refused.value.code, refused.value.command) == ("busy_station", "c")
    with pytest.raises(UnclearAnswer) as unclear:
        wl.result_of({"success": False, "error": {"code": "busy_station"}}, "c", frozenset({"busy_station"}))
    assert unclear.value.code == "busy_station"
    with pytest.raises(UnclearAnswer) as neither:
        wl.result_of({}, "c", frozenset())
    assert neither.value.code == "invalid_response"


@pytest.mark.parametrize("module,prefix,busy", [(ops, "station_ops", 2.0), (wi, "installer", 3.0), (tr, "triage", 2.0), (sw, "schedule", 5.0),
                                                (dt, "door_tech", 2.0)])
def test_every_module_keeps_its_own_instance_on_the_shared_class(module, prefix, busy):
    assert isinstance(module.LIMITS, wl.WriteLimits) and type(module.LIMITS) is module.Limits
    assert (module.LIMITS.prefix, module.LIMITS.busy_retry_s) == (prefix, busy)
    body = inspect.getsource(module.Limits)
    assert "threading.Lock()" not in body and "popleft" not in body, "no own lock and no own window code"


@pytest.mark.parametrize("module", [ops, sw, tr])
def test_the_three_readers_delegate_to_the_shared_one(module, monkeypatch):
    seen = []
    monkeypatch.setattr(wl, "result_of", lambda frame, command, codes: seen.append((command, codes)) or "shared")
    assert module.result_of({"success": True}, "x") == "shared"
    assert seen == [("x", module.UNCLEAR_CODES)]
