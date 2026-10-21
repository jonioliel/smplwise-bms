"""CR-039 5.4 / DOORWIN2-295: the generated holiday list of door windows, shared with the electricity calendar.

The Israeli holidays and their eves are computed locally from the Hebrew calendar by `services/energy_calendar.py` (pure arithmetic, no library,
no network). This module is the thin shared seam the door windows use, so the doors never carry a second copy of that arithmetic and the energy
calendar's own file stays untouched (the extraction CR-039 5.4 asked for is done as a wrapper: one source of truth, no shared-file churn).

- the generator is a per-consumer choice, `doors.windows.calendar_generator` = `israel` (default) | `none`;
- generated days are `holiday` / `holiday_eve`; a manager's overrides in `door_window_calendar` (services/door_windows.py) always win over them,
  including `regular` (cancel a generated holiday) and `closed` (the building is closed that day);
- the list is a default the manager confirms: which days a building is closed is the manager's decision, never code.
"""
from __future__ import annotations

import datetime as dt
import sqlite3
from typing import Any

from ..db import get_setting
from . import energy_calendar as ec

GENERATOR_KEY = "doors.windows.calendar_generator"
GENERATORS = ec.GENERATORS  # ("israel", "none")
DEFAULT_GENERATOR = "israel"


def generator_of(conn: sqlite3.Connection) -> str:
    value = get_setting(conn, GENERATOR_KEY) or DEFAULT_GENERATOR
    return value if value in GENERATORS else DEFAULT_GENERATOR


def generated(generator: str, start: dt.date, end: dt.date) -> dict[str, dict[str, str]]:
    """{YYYY-MM-DD: {kind, name_he}} of the generated special days with start <= date <= end. `none` (or an unknown name) generates nothing."""
    if generator not in GENERATORS or generator == "none":
        return {}
    cal = ec.Calendar({"generator": generator, "overrides": {}})
    out: dict[str, dict[str, str]] = {}
    for day in cal.between(start, end + dt.timedelta(days=1)):
        if day.kind in ("holiday", "holiday_eve"):
            out[day.date.isoformat()] = {"kind": day.kind, "name_he": day.name_he}
    return out


def day_types(generator: str, start: dt.date, end: dt.date) -> dict[str, str]:
    """{YYYY-MM-DD: 'holiday' | 'holiday_eve'} - what `door_windows.calendar_for` merges under the manager's overrides."""
    return {d: v["kind"] for d, v in generated(generator, start, end).items()}


def listing(conn: sqlite3.Connection, start: dt.date, days: int, overrides: dict[str, dict[str, Any]]) -> list[dict[str, Any]]:
    """The list the screen shows: every special day in [start, start+days], generated and manual, by date. Each row: date, kind (the effective
    day type: holiday | holiday_eve | regular | closed), name_he, source (`generated` | `manual`) and, for a manual row that changes a generated
    one, the generated kind it overrides. Cancelled generated days stay in the list (kind `regular`) so the manager sees what was cancelled."""
    end = start + dt.timedelta(days=days)
    gen = generated(generator_of(conn), start, end)
    out: dict[str, dict[str, Any]] = {d: {"date": d, "kind": v["kind"], "name_he": v["name_he"], "source": "generated", "generated_kind": None} for d, v in gen.items()}
    for d, o in overrides.items():
        if start.isoformat() <= d <= end.isoformat():
            out[d] = {"date": d, "kind": o["day_type"], "name_he": o.get("label") or (gen.get(d) or {}).get("name_he") or "", "source": "manual",
                      "generated_kind": (gen.get(d) or {}).get("kind")}
    return [out[d] for d in sorted(out)]
