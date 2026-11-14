"""CR-WK-LIMITS-2438 (code review 2026-11-13, finding 02:P2-3): Arx's own in-process limits on WisKey commands, and the one reader
of a command's answer, shared by the WisKey modules that used to carry their own copy of each (wiskey_station_ops, wiskey_installer,
wiskey_triage, wiskey_schedule_writes, wiskey_door_tech).

`WriteLimits` holds the three pieces every one of those copies had, under one lock:
- a sliding window per operator (`window_full`: how long until the oldest entry leaves, or None),
- a cool-down per target that starts only when a command was handed to WisKey (`mark_sent`), never for one that was not sent,
- an in-flight count per class of command, freed by `done`.
A refusal is `(f"{prefix}_<reason>", retry_after_s)` with reason `cooldown`, `rate_limited` or `busy`.

Each module keeps its own instance, its own refusal prefix, its own busy retry and its own constants: it passes them in on every call
(the constants are read from the module at call time, so a test that patches a module constant still changes that module only). Two
cool-down readings exist and are kept as they were:
- `key_cooldown_left` rounds first and admits when the rounded value is 0.0 (station maintenance, installer, triage);
- `cooldown_raw` is the unrounded remainder; a caller refusing on `raw > 0` reports `round(raw, 1)` (schedule device reads, door
  technical writes), so the last 50 ms of a cool-down refuse with a retry of 0.0.

Process memory only: nothing persists and nothing here contacts WisKey."""
from __future__ import annotations

import threading
import time
from collections import deque
from typing import Any, Hashable

from . import intercom_adapter as ad
from .intercom_client import IntercomError, UnclearAnswer

Refusal = tuple[str, float]


class WriteLimits:
    def __init__(self, prefix: str, busy_retry_s: float) -> None:
        self.prefix = prefix
        self.busy_retry_s = busy_retry_s
        self._lock = threading.Lock()
        self._last: dict[Hashable, float] = {}  # cool-down key -> when the command was handed to WisKey
        self._users: dict[Hashable, deque[float]] = {}  # window key (the operator, or class + operator) -> admitted instants
        self._inflight: dict[str, int] = {}  # class -> commands admitted and not yet done

    # ------------------------------------------------------------ the pieces (callers holding `_lock` use the `_locked` ones)

    @staticmethod
    def trim(q: deque[float], now: float, window_s: float) -> None:
        while q and now - q[0] >= window_s:
            q.popleft()

    def _window_full_locked(self, key: Hashable, now: float, window_s: float, cap: int) -> float | None:
        """Seconds until the oldest admitted entry of `key` leaves the window when the window is full, else None."""
        q = self._users.setdefault(key, deque())
        self.trim(q, now, window_s)
        if len(q) >= cap:
            return round(window_s - (now - q[0]), 1)
        return None

    def _slot_full_locked(self, cls: str, cap: int) -> bool:
        return self._inflight.get(cls, 0) >= cap

    def _take_slot_locked(self, cls: str) -> None:
        self._inflight[cls] = self._inflight.get(cls, 0) + 1

    def _cooldown_raw_locked(self, key: Hashable, cooldown_s: float, now: float) -> float:
        at = self._last.get(key)
        return 0.0 if at is None else cooldown_s - (now - at)

    def cooldown_raw(self, key: Hashable, cooldown_s: float, now: float | None = None) -> float:
        """The unrounded remainder of `key`'s cool-down (<= 0 when none is running)."""
        with self._lock:
            return self._cooldown_raw_locked(key, cooldown_s, time.monotonic() if now is None else now)

    def key_cooldown_left(self, key: Hashable, cooldown_s: float, now: float | None = None) -> float:
        """The remainder of `key`'s cool-down rounded to 0.1 s, never below 0.0; a zero cool-down never runs."""
        with self._lock:
            at = self._last.get(key)
        if at is None or cooldown_s <= 0:
            return 0.0
        left = cooldown_s - ((time.monotonic() if now is None else now) - at)
        return max(0.0, round(left, 1))

    # ------------------------------------------------------------ the common admission

    def admit_key(self, window_key: Hashable, cooldown_key: Hashable, *, cooldown_s: float, window_s: float, user_max: int, max_inflight: int,
                  cls: str = "") -> Refusal | None:
        """Cool-down first (rounded reading), then the operator's window, then the class's in-flight cap. An admitted command is counted
        in the window and holds one in-flight slot of `cls` until `done(cls)`; a refused one changes nothing."""
        now = time.monotonic()
        left = self.key_cooldown_left(cooldown_key, cooldown_s, now)
        if left > 0:
            return f"{self.prefix}_cooldown", left
        with self._lock:
            retry = self._window_full_locked(window_key, now, window_s, user_max)
            if retry is not None:
                return f"{self.prefix}_rate_limited", retry
            if self._slot_full_locked(cls, max_inflight):
                return f"{self.prefix}_busy", self.busy_retry_s
            self._users[window_key].append(now)
            self._take_slot_locked(cls)
        return None

    def mark_sent(self, cooldown_key: Hashable) -> None:
        with self._lock:
            self._last[cooldown_key] = time.monotonic()

    def done(self, cls: str = "") -> None:
        with self._lock:
            self._inflight[cls] = max(0, self._inflight.get(cls, 0) - 1)

    def reset(self) -> None:
        with self._lock:
            self._last.clear()
            self._users.clear()
            self._inflight.clear()


# ---------------------------------------------------------------- a command's answer

def result_of(frame: dict[str, Any], command: str, unclear_codes: frozenset[str]) -> Any:
    """`success: true` -> the result; `success: false` with a code that is not in `unclear_codes` and has the shape of a code -> a
    definite failure (IntercomError: the feed's outcome `refused`, WisKey's code is the reason); an unclear code or a frame that is
    neither -> UnclearAnswer (outcome unknown: "sent, no clear answer")."""
    if frame.get("success") is True:
        return frame.get("result")
    if frame.get("success") is False:
        error = frame.get("error") if isinstance(frame.get("error"), dict) else {}
        code = str(error.get("code") or "")
        if code not in unclear_codes and ad.CODE.fullmatch(code):
            raise IntercomError(code, command)
        raise UnclearAnswer(command, code or "action_failed")
    raise UnclearAnswer(command, "invalid_response")
