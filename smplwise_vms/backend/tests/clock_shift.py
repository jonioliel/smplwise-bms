"""TKGATEFIX8: a pytest plugin that runs the tests at ANOTHER wall-clock time - to reproduce failures that happen only near a date
boundary (the installation's local midnight, Asia/Jerusalem = 21:00 / 22:00 UTC) without waiting for it.

    SW_FAKE_NOW=2026-10-18T22:30:00+03:00 [SW_FAKE_LOCAL_TZ=UTC] python -m pytest -p clock_shift tests/...

Inactive unless SW_FAKE_NOW is set. It shifts `datetime.datetime.now()` / `utcnow()`, `datetime.date.today()` and `time.time()` by a
fixed offset (the clock keeps ticking from the given instant). `SW_FAKE_LOCAL_TZ` sets the zone of the NAIVE local time (`now()` without a
zone, `date.today()`) - the machine's own zone otherwise; `UTC` reproduces the test runner (an Ubuntu box in Etc/UTC). Loaded with `-p`
before the application is imported, so `from datetime import datetime` gets the shifted class too. Test-only: never imported by the
product."""
from __future__ import annotations

import datetime as _dt
import os
import sqlite3 as _sqlite3  # noqa: F401 - imported BEFORE the swap below: its default adapters must bind the real date types
import time as _time
from zoneinfo import ZoneInfo

_REAL_DT = _dt.datetime
_REAL_DATE = _dt.date
_REAL_TIME = _time.time

_raw = os.environ.get("SW_FAKE_NOW")
if _raw:
    _target = _REAL_DT.fromisoformat(_raw)
    if _target.tzinfo is None:
        raise SystemExit("SW_FAKE_NOW needs an offset, e.g. 2026-10-18T22:30:00+03:00")
    _OFFSET = _target - _REAL_DT.now(_dt.timezone.utc)
    _LOCAL = ZoneInfo(os.environ["SW_FAKE_LOCAL_TZ"]) if os.environ.get("SW_FAKE_LOCAL_TZ") else None

    def _aware_now() -> _dt.datetime:
        return _REAL_DT.now(_dt.timezone.utc) + _OFFSET

    class FakeDateTime(_REAL_DT):
        @classmethod
        def now(cls, tz=None):  # noqa: D102
            at = _aware_now()
            if tz is not None:
                return cls._from(at.astimezone(tz))
            local = at.astimezone(_LOCAL) if _LOCAL is not None else at.astimezone()
            return cls._from(local.replace(tzinfo=None))

        @classmethod
        def utcnow(cls):  # noqa: D102
            return cls._from(_aware_now().replace(tzinfo=None))

        @classmethod
        def today(cls):  # noqa: D102
            return cls.now()

        @classmethod
        def _from(cls, v: _dt.datetime) -> "FakeDateTime":
            return cls(v.year, v.month, v.day, v.hour, v.minute, v.second, v.microsecond, v.tzinfo, fold=v.fold)

    class FakeDate(_REAL_DATE):
        @classmethod
        def today(cls):  # noqa: D102
            n = FakeDateTime.now()
            return cls(n.year, n.month, n.day)

    _dt.datetime = FakeDateTime  # type: ignore[misc]
    _dt.date = FakeDate  # type: ignore[misc]
    # GATEHYGIENE: sqlite3 picks its adapters by EXACT type. sqlite3 is imported at the top of this module, BEFORE the swap, so its
    # default adapters stay registered for the REAL date / datetime (imported after the swap, it registered them for the fakes only and
    # every real `date` bound as a parameter raised "type 'datetime.date' is not supported" - a false failure of the tool, e.g.
    # energy_billing's due date); the fakes get the same ISO-text adapters here.
    _sqlite3.register_adapter(FakeDate, lambda v: v.isoformat())
    _sqlite3.register_adapter(FakeDateTime, lambda v: v.isoformat(" "))
    _time.time = lambda: _REAL_TIME() + _OFFSET.total_seconds()  # type: ignore[assignment]


def pytest_report_header(config):  # noqa: ARG001
    if _raw:
        return f"clock_shift: now = {_raw} (local naive zone: {os.environ.get('SW_FAKE_LOCAL_TZ') or 'machine'})"
    return None
