"""CR-038 D4 / D28 / D29 / 9.2: vendor send hours, the "wait for morning" rule, and the urgent quiet-hours rule.

Send hours (D4): messages to contacts leave only inside the send window of the ticket's department (override) or of the
installation (default 07:00-21:00), in the installation's IANA zone, every day. "from" < "to" is required: a window across
midnight and from == to are refused (14.1). The end is exclusive. DST days follow the zone rules (wall-clock times are
converted per instant; a wall time inside a spring-forward gap resolves to the first instant after it).

Who waits (9.2):
- reminder / closed / reassigned / reopened / update (and the cost notices): held until the next opening - ALSO for `critical`
  priorities (review T21); manager alerts of CR-018 are not affected (they never pass through this module);
- assign (D29): held until the opening unless the manager chose "send now" (preselected for `critical` priorities), or a holder
  of `tickets.external` releases the held row later (`outbox.Outbox.send_now`);
- code: never held (the vendor asked for it a second ago); test: never held (an administrator's own deliberate check).

Urgent and the managers' quiet hours (D28): with `urgent_is_critical` true (installation default true, per-department override)
a priority whose severity is `critical` keeps it, so CR-018 lets it pass the managers' quiet hours; false caps it at `alert`.
That rule is about CR-018 signals to MANAGERS; it never lets a vendor message out of the send window.
"""
from __future__ import annotations

import datetime as dt
import json
import re
from dataclasses import dataclass
from typing import Any, Mapping
from zoneinfo import ZoneInfo

UTC = dt.timezone.utc
DEFAULT_WINDOW = {"from": "07:00", "to": "21:00"}

HELD_BY_HOURS = frozenset({"reminder", "closed", "reassigned", "reopened", "update", "cost_rejected", "cost_approved", "cost_reopened"})
NEVER_HELD = frozenset({"code", "test", "phone_verify", "intake_reply"})  # TKNOTIFOTP: a verification code is asked for by a person who waits for it
_HHMM = re.compile(r"^([01]\d|2[0-3]):([0-5]\d)$")


class WindowError(ValueError):
    def __init__(self, code: str) -> None:
        super().__init__(code)
        self.code = code


@dataclass(frozen=True)
class SendWindow:
    start: dt.time
    end: dt.time  # exclusive

    def as_doc(self) -> dict[str, str]:
        return {"from": self.start.strftime("%H:%M"), "to": self.end.strftime("%H:%M")}


def parse_window(doc: Any) -> SendWindow:
    """`{"from": "HH:MM", "to": "HH:MM"}` -> SendWindow. WindowError codes: window_invalid, window_across_midnight, window_empty."""
    if isinstance(doc, str):
        try:
            doc = json.loads(doc)
        except ValueError as exc:
            raise WindowError("window_invalid") from exc
    if not isinstance(doc, Mapping):
        raise WindowError("window_invalid")
    a, b = doc.get("from"), doc.get("to")
    ma, mb = _HHMM.match(a) if isinstance(a, str) else None, _HHMM.match(b) if isinstance(b, str) else None
    if not ma or not mb:
        raise WindowError("window_invalid")
    start, end = dt.time(int(ma[1]), int(ma[2])), dt.time(int(mb[1]), int(mb[2]))
    if start == end:
        raise WindowError("window_empty")
    if start > end:
        raise WindowError("window_across_midnight")
    return SendWindow(start, end)


def effective_window(installation: Any, department_override: Any = None) -> SendWindow:
    """The department's window when it has a valid one, else the installation's, else the default (a corrupt stored value never
    opens the window wider than the default: it falls back to 07:00-21:00)."""
    for doc in (department_override, installation):
        if doc in (None, ""):
            continue
        try:
            return parse_window(doc)
        except WindowError:
            continue
    return parse_window(DEFAULT_WINDOW)


def _local_instant(day: dt.date, at: dt.time, tz: ZoneInfo) -> dt.datetime:
    """The UTC instant of a local wall time; a time inside a DST gap resolves to the first instant after the gap."""
    naive = dt.datetime.combine(day, at)
    aware = naive.replace(tzinfo=tz, fold=0)
    instant = aware.astimezone(UTC)
    if instant.astimezone(tz).replace(tzinfo=None) == naive:
        return instant
    # nonexistent wall time (spring forward): the first instant whose wall time is >= naive = the end of the gap
    other = naive.replace(tzinfo=tz, fold=1).astimezone(UTC)
    lo, hi = min(instant, other), max(instant, other)
    while (hi - lo) > dt.timedelta(seconds=1):
        mid = lo + (hi - lo) / 2
        if mid.astimezone(tz).replace(tzinfo=None) >= naive:
            hi = mid
        else:
            lo = mid
    floor = hi.replace(microsecond=0)
    return floor if floor.astimezone(tz).replace(tzinfo=None) >= naive else floor + dt.timedelta(seconds=1)


def in_window(now: dt.datetime, window: SendWindow, tz: ZoneInfo) -> bool:
    day = now.astimezone(tz).date()
    return _local_instant(day, window.start, tz) <= now.astimezone(UTC) < _local_instant(day, window.end, tz)


def next_opening(now: dt.datetime, window: SendWindow, tz: ZoneInfo) -> dt.datetime:
    """The first window start strictly after `now` when outside the window (now itself when inside)."""
    now = now.astimezone(UTC)
    if in_window(now, window, tz):
        return now
    day = now.astimezone(tz).date()
    for offset in range(0, 4):
        d = day + dt.timedelta(days=offset)
        start = _local_instant(d, window.start, tz)
        if start > now and start < _local_instant(d, window.end, tz):  # a window swallowed by a DST gap is empty that day
            return start
    raise AssertionError("no opening within two days")  # unreachable for a valid window


@dataclass(frozen=True)
class HoursDecision:
    send: bool
    not_before: dt.datetime  # == now when send is True


def decide(purpose: str, now: dt.datetime, window: SendWindow, tz: ZoneInfo, *, send_now: bool = False) -> HoursDecision:
    """`send_now` is a person's explicit release (the assign dialog's choice for `assign`, or "שלח עכשיו" on any message held
    by the send hours - the route's permission check is `tickets.external`, D29). Any other purpose, known or not, waits."""
    now = now.astimezone(UTC)
    if purpose in NEVER_HELD or send_now:
        return HoursDecision(True, now)
    opening = next_opening(now, window, tz)
    return HoursDecision(opening == now, opening)


def default_send_now(priority_severity: str) -> bool:
    """D29: the assign dialog preselects "send now" for priorities whose severity is `critical`."""
    return priority_severity == "critical"


def urgent_is_critical(installation_value: Any, department_override: Any = None) -> bool:
    """D28: department override (1 / 0) beats the installation value; the installation default is true."""
    if department_override in (0, 1, True, False):
        return bool(department_override)
    if isinstance(installation_value, bool):
        return installation_value
    return True


def signal_severity(priority_severity: str, urgent_critical: bool) -> str:
    """The CR-018 severity of a ticket signal: `critical` passes the managers' quiet hours; capped at `alert` when the
    department (or installation) turned that off (13.4)."""
    if priority_severity == "critical" and not urgent_critical:
        return "alert"
    return priority_severity if priority_severity in ("info", "alert", "critical") else "alert"
