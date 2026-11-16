"""CR-TK-MONEY-UTILS (code review 2026-11-13, 01:F-15): the small field validators and utilities the money modules of the tickets
module share.

Before this module `_text` was identical in costs.py and quotes.py, `_instant` was written in quotes.py and again in rfq.py (with
one extra flag), `_local` (an ISO instant as local text) twice character for character in export.py and costs_report.py, and the
per-user rate limiter three times (export.py, costs_report.py, deletion.py). Each helper below is the text those copies had; the
modules keep their old names as one-line wrappers, so no caller and no test moved.

The validators never build an error themselves: the calling module passes `refuse(code, field)`, which returns ITS exception (a
`CostRefused` for claims and quotes, the 422 envelope for a request for quotation) - same checks, same codes, the caller's shape.

A leaf of the package: it imports the clock helpers and the text hygiene only."""
from __future__ import annotations

import collections
import datetime as dt
import threading
import time
from typing import Any, Callable

from ..timeutil import parse_utc
from .text_hygiene import clean_text
from .timeutil import iso_s, parse_naive_local

Refuse = Callable[[str, str], Exception]  # (code, field) -> the exception the calling module raises


def text(value: Any, field: str, max_len: int, *, refuse: Refuse, multiline: bool = False) -> str | None:
    """An optional text field: None stays None, anything but text is `type`, cleaned text longer than `max_len` is `too_long`, and
    text that cleans to nothing is None."""
    if value is None:
        return None
    if not isinstance(value, str):
        raise refuse("type", field)
    t = clean_text(value, multiline=multiline)
    if len(t) > max_len:
        raise refuse("too_long", field)
    return t or None


def instant(value: Any, field: str, now: dt.datetime, *, horizon_days: int, refuse: Refuse, future: bool = False) -> str | None:
    """An optional ISO instant, stored as UTC seconds: None / "" stay None, anything but text is `type`, unreadable text is `format`,
    and an instant more than a day in the past or more than `horizon_days` ahead is `range` (`future`: at or before `now` too)."""
    if value is None or value == "":
        return None
    if not isinstance(value, str):
        raise refuse("type", field)
    at = parse_naive_local(value)
    if at is None:
        raise refuse("format", field)
    if (future and at <= now) or at < now - dt.timedelta(days=1) or at > now + dt.timedelta(days=horizon_days):
        raise refuse("range", field)
    return iso_s(at)


def local_text(at: dt.datetime | None, tz: dt.tzinfo, fmt: str) -> str | None:
    """An aware instant as text in zone `tz`; None for no instant."""
    return None if at is None else at.astimezone(tz).strftime(fmt)


def local_minute(iso: str | None, tz: dt.tzinfo) -> str:
    """A stored ISO instant as `YYYY-MM-DD HH:MM` in zone `tz` (the CSV exports); "" for an empty or unreadable value."""
    if not iso:
        return ""
    try:
        return parse_utc(iso).astimezone(tz).strftime("%Y-%m-%d %H:%M")
    except ValueError:
        return ""


class RateWindow:
    """A per-user limiter kept in memory: at most `limit` marks per user in any `window_s` seconds. Only a successful action is
    marked, so a refused one never extends the wait. `limit` and `window_s` are read through callables at every call, so a module
    keeps its own constants (and a test may change them).

    Each module makes its OWN instance: the table export, the costs report and the ticket deletion never share a bucket."""

    def __init__(self, limit: Callable[[], int], window_s: Callable[[], float]) -> None:
        self._limit = limit
        self._window_s = window_s
        self._marks: dict[str, collections.deque[float]] = {}
        self._lock = threading.Lock()

    def wait(self, user_id: str, n: int = 1, now: float | None = None) -> float:
        """Seconds until `n` more marks fit in the user's window (0 = now)."""
        now = time.monotonic() if now is None else now
        limit, window_s = self._limit(), self._window_s()
        with self._lock:
            q = self._marks.setdefault(user_id, collections.deque())
            while q and now - q[0] >= window_s:
                q.popleft()
            if len(q) + n <= limit:
                return 0.0
            if n > limit:
                return window_s
            # the oldest entries that must expire before n fit
            return max(0.0, window_s - (now - q[len(q) + n - limit - 1]))

    def mark(self, user_id: str, now: float | None = None) -> None:
        now = time.monotonic() if now is None else now
        with self._lock:
            self._marks.setdefault(user_id, collections.deque()).append(now)

    def reset(self) -> None:
        """Tests only."""
        with self._lock:
            self._marks.clear()


__all__ = ["Refuse", "RateWindow", "instant", "local_minute", "local_text", "text"]
