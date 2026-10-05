"""EL5: the special-days calendar of time-of-use billing (holidays and holiday eves).

A time-of-use tariff treats holidays like Saturdays and holiday eves like Fridays (docs/architecture/ELECTRICITY_TOU.md
section 3; which day type each maps to is part of the tariff definition, never code). This module answers one question:
"is this local date a holiday, a holiday eve, or a regular day?".

- Generated days: the Israeli holidays computed locally from the Hebrew calendar (arithmetic of Calendrical Calculations,
  Reingold & Dershowitz, chapter 8): Rosh Hashanah (2 days), Yom Kippur, Sukkot (first day), Shemini Atzeret, Pesach (first
  and seventh day), Shavuot and Independence Day (with its statutory moves), each with its eve. No library, no network call,
  works offline (plan section 8.2 asked for `hdate`; it is not in the add-on image and the arithmetic is small and tested).
  The list is a default the manager confirms: which days the Electricity Authority counts is NOT verified against its text.
- Manual overrides (Energy settings, key `energy.calendar`): add a day, retype it, or cancel a generated one ('regular').
  An override always wins.

The setting is one small JSON document with its own revision: {"revision": n, "generator": "israel" | "none",
"overrides": {"YYYY-MM-DD": {"kind": "holiday" | "holiday_eve" | "regular", "name_he": "..."}}}."""
from __future__ import annotations

import datetime as dt
import json
import re
import sqlite3
from dataclasses import dataclass
from functools import lru_cache
from typing import Any

from ..db import get_setting, set_setting
from ..errors import ApiError, conflict
from . import energy_settings as es

SETTINGS_KEY = "energy.calendar"
KINDS = ("holiday", "holiday_eve", "regular")
KIND_HE = {"holiday": "חג", "holiday_eve": "ערב חג", "regular": "יום רגיל"}
GENERATORS = ("israel", "none")
MIN_YEAR, MAX_YEAR = 2000, 2100
MAX_OVERRIDES = 400
MAX_NAME = 60
DEFAULT: dict[str, Any] = {"revision": 0, "generator": "israel", "overrides": {}}
_DATE = re.compile(r"^\d{4}-\d{2}-\d{2}$")

es.register(es.SettingSpec(SETTINGS_KEY, DEFAULT, "json", es.MANAGE, read_permission=es.VIEW, max_length=60000,
                           label_he="ימים מיוחדים (תעו״ז)", own_route="/energy/calendar"))


# ====================================================================== the Hebrew calendar (pure arithmetic)
# Months are numbered from Nisan: 1 Nisan, 2 Iyar, 3 Sivan, 4 Tammuz, 5 Av, 6 Elul, 7 Tishrei, 8 Marheshvan, 9 Kislev,
# 10 Tevet, 11 Shevat, 12 Adar (Adar I in a leap year), 13 Adar II. The year starts on 1 Tishrei.

NISAN, IYAR, SIVAN, TISHREI = 1, 2, 3, 7
HEBREW_EPOCH = -1373427  # the fixed day (proleptic Gregorian ordinal) of 1 Tishrei AM 1


def hebrew_leap(year: int) -> bool:
    return (7 * year + 1) % 19 < 7


def _last_month(year: int) -> int:
    return 13 if hebrew_leap(year) else 12


@lru_cache(maxsize=512)
def _elapsed_days(year: int) -> int:
    """Days from the epoch to the molad of Tishrei of `year`, with the first postponement (no Sunday/Wednesday/Friday)."""
    months = (235 * year - 234) // 19
    parts = 12084 + 13753 * months
    day = 29 * months + parts // 25920
    if (3 * (day + 1)) % 7 < 3:
        day += 1
    return day


def _year_length_correction(year: int) -> int:
    ny0, ny1, ny2 = _elapsed_days(year - 1), _elapsed_days(year), _elapsed_days(year + 1)
    if ny2 - ny1 == 356:
        return 2
    if ny1 - ny0 == 382:
        return 1
    return 0


@lru_cache(maxsize=512)
def hebrew_new_year(year: int) -> int:
    """The fixed day of 1 Tishrei of `year`."""
    return HEBREW_EPOCH + _elapsed_days(year) + _year_length_correction(year)


def days_in_hebrew_year(year: int) -> int:
    return hebrew_new_year(year + 1) - hebrew_new_year(year)


def hebrew_month_length(year: int, month: int) -> int:
    if month in (2, 4, 6, 10, 13):
        return 29
    if month == 12 and not hebrew_leap(year):
        return 29
    length = days_in_hebrew_year(year)
    if month == 8 and length % 10 != 5:  # Marheshvan is long only in a complete year (355 / 385 days)
        return 29
    if month == 9 and length % 10 == 3:  # Kislev is short only in a deficient year (353 / 383 days)
        return 29
    return 30


def hebrew_to_date(year: int, month: int, day: int) -> dt.date:
    if not 1 <= month <= _last_month(year) or not 1 <= day <= hebrew_month_length(year, month):
        raise ValueError("invalid Hebrew date")
    fixed = hebrew_new_year(year) + day - 1
    if month < TISHREI:
        fixed += sum(hebrew_month_length(year, m) for m in range(TISHREI, _last_month(year) + 1))
        fixed += sum(hebrew_month_length(year, m) for m in range(1, month))
    else:
        fixed += sum(hebrew_month_length(year, m) for m in range(TISHREI, month))
    return dt.date.fromordinal(fixed)


def independence_day(hebrew_year: int) -> dt.date:
    """Yom HaAtzmaut: 5 Iyar, moved to Thursday when it falls on Friday or Saturday and to Tuesday when it falls on Monday
    (so Memorial Day never follows a Saturday night; the Monday rule is in force since 2004)."""
    d = hebrew_to_date(hebrew_year, IYAR, 5)
    wd = d.weekday()  # Monday = 0
    if wd == 4:
        return d - dt.timedelta(days=1)
    if wd == 5:
        return d - dt.timedelta(days=2)
    if wd == 0:
        return d + dt.timedelta(days=1)
    return d


@dataclass(frozen=True)
class SpecialDay:
    date: dt.date
    kind: str  # holiday | holiday_eve | regular (a cancelled generated day)
    name_he: str
    source: str  # generated | manual

    def as_api(self) -> dict[str, Any]:
        return {"date": self.date.isoformat(), "kind": self.kind, "kind_he": KIND_HE[self.kind], "name_he": self.name_he, "source": self.source}


@lru_cache(maxsize=256)
def israel_special_days(year: int) -> tuple[SpecialDay, ...]:
    """The generated holidays and eves whose Gregorian date falls in `year`, by date. A day that is both (the second day
    of Rosh Hashanah is the 'eve' of nothing; Shemini Atzeret's eve is Hoshana Rabba) keeps the stronger kind."""
    if not MIN_YEAR <= year <= MAX_YEAR:
        return ()
    spring, autumn = year + 3760, year + 3761
    out: dict[dt.date, SpecialDay] = {}

    def put(d: dt.date, kind: str, name: str) -> None:
        if d.year != year:
            return
        cur = out.get(d)
        if cur is None or (cur.kind == "holiday_eve" and kind == "holiday"):
            out[d] = SpecialDay(d, kind, name, "generated")

    def holiday(d: dt.date, name: str, eve_name: str) -> None:
        put(d, "holiday", name)
        put(d - dt.timedelta(days=1), "holiday_eve", eve_name)

    holiday(hebrew_to_date(spring, NISAN, 15), "פסח", "ערב פסח")
    holiday(hebrew_to_date(spring, NISAN, 21), "שביעי של פסח", "ערב שביעי של פסח")
    holiday(independence_day(spring), "יום העצמאות", "יום הזיכרון (ערב יום העצמאות)")
    holiday(hebrew_to_date(spring, SIVAN, 6), "שבועות", "ערב שבועות")
    rh = hebrew_to_date(autumn, TISHREI, 1)
    holiday(rh, "ראש השנה", "ערב ראש השנה")
    put(rh + dt.timedelta(days=1), "holiday", "ראש השנה (יום שני)")
    holiday(hebrew_to_date(autumn, TISHREI, 10), "יום כיפור", "ערב יום כיפור")
    holiday(hebrew_to_date(autumn, TISHREI, 15), "סוכות", "ערב סוכות")
    holiday(hebrew_to_date(autumn, TISHREI, 22), "שמיני עצרת ושמחת תורה", "הושענא רבה")
    return tuple(sorted(out.values(), key=lambda s: s.date))


# ====================================================================== the setting and the resolver

def read_config(conn: sqlite3.Connection) -> dict[str, Any]:
    raw = get_setting(conn, SETTINGS_KEY)
    out = json.loads(json.dumps(DEFAULT))
    try:
        stored = json.loads(raw) if raw else {}
    except ValueError:
        stored = {}
    if isinstance(stored, dict):
        if isinstance(stored.get("revision"), int):
            out["revision"] = stored["revision"]
        if stored.get("generator") in GENERATORS:
            out["generator"] = stored["generator"]
        ov = stored.get("overrides")
        if isinstance(ov, dict):
            for k, v in ov.items():
                if isinstance(k, str) and _DATE.match(k) and isinstance(v, dict) and v.get("kind") in KINDS:
                    out["overrides"][k] = {"kind": v["kind"], "name_he": str(v.get("name_he") or "")[:MAX_NAME]}
    return out


def _store(conn: sqlite3.Connection, cfg: dict[str, Any]) -> None:
    set_setting(conn, SETTINGS_KEY, json.dumps(cfg, ensure_ascii=False, sort_keys=True, separators=(",", ":")))


class Calendar:
    """The resolved special days of one configuration (overrides win over the generated list)."""

    def __init__(self, cfg: dict[str, Any]):
        self.generator = cfg.get("generator", "israel")
        self.overrides: dict[dt.date, SpecialDay] = {}
        for k, v in (cfg.get("overrides") or {}).items():
            d = dt.date.fromisoformat(k)
            self.overrides[d] = SpecialDay(d, v["kind"], v.get("name_he") or "", "manual")
        self._years: dict[int, dict[dt.date, SpecialDay]] = {}

    def _generated(self, year: int) -> dict[dt.date, SpecialDay]:
        if year not in self._years:
            days = israel_special_days(year) if self.generator == "israel" else ()
            self._years[year] = {s.date: s for s in days}
        return self._years[year]

    def entry(self, day: dt.date) -> SpecialDay | None:
        """The special-day entry of `day` (a 'regular' override included), or None."""
        if day in self.overrides:
            return self.overrides[day]
        return self._generated(day.year).get(day)

    def kind(self, day: dt.date) -> str | None:
        """'holiday' | 'holiday_eve' | None (a regular day, or a cancelled generated one)."""
        e = self.entry(day)
        return e.kind if e is not None and e.kind != "regular" else None

    def between(self, start: dt.date, end: dt.date) -> list[SpecialDay]:
        """Every entry with start <= date < end (generated and manual, cancellations included), by date."""
        out: dict[dt.date, SpecialDay] = {}
        for y in range(start.year, end.year + 1):
            for d, s in self._generated(y).items():
                if start <= d < end:
                    out[d] = s
        for d, s in self.overrides.items():
            if start <= d < end:
                out[d] = s
        return [out[d] for d in sorted(out)]


def calendar_of(conn: sqlite3.Connection) -> Calendar:
    return Calendar(read_config(conn))


def _err(code: str, message: str, **details: Any) -> ApiError:
    return ApiError(422, code, message, details=details)


def year_view(conn: sqlite3.Connection, year: int) -> dict[str, Any]:
    if not MIN_YEAR <= year <= MAX_YEAR:
        raise _err("validation", f"השנה חייבת להיות בין {MIN_YEAR} ל-{MAX_YEAR}.", fields=["year"])
    cfg = read_config(conn)
    cal = Calendar(cfg)
    days = []
    for s in cal.between(dt.date(year, 1, 1), dt.date(year + 1, 1, 1)):
        gen = cal._generated(year).get(s.date)
        item = s.as_api()
        item["generated"] = gen.as_api() if gen is not None and s.source == "manual" else None
        days.append(item)
    return {"year": year, "revision": cfg["revision"], "generator": cfg["generator"], "days": days,
            "note_he": "רשימת החגים מחושבת לפי הלוח העברי. יש לאשר אותה מול חשבון חשמל אמיתי."}


def _check_revision(cfg: dict[str, Any], base_revision: int | None) -> None:
    if base_revision is not None and base_revision != cfg["revision"]:
        raise conflict("revision_conflict", "הימים המיוחדים שונו בינתיים. יש לרענן ולנסות שוב.", current_revision=cfg["revision"])


def set_override(conn: sqlite3.Connection, day: dt.date, kind: str, name_he: str | None, base_revision: int | None) -> dict[str, Any]:
    if kind not in KINDS:
        raise _err("validation", "סוג היום אינו מוכר.", fields=["kind"])
    if not MIN_YEAR <= day.year <= MAX_YEAR:
        raise _err("validation", f"התאריך חייב להיות בין {MIN_YEAR} ל-{MAX_YEAR}.", fields=["date"])
    name = (name_he or "").strip()
    if len(name) > MAX_NAME:
        raise _err("validation", f"השם ארוך מ-{MAX_NAME} תווים.", fields=["name_he"])
    cfg = read_config(conn)
    _check_revision(cfg, base_revision)
    key = day.isoformat()
    if key not in cfg["overrides"] and len(cfg["overrides"]) >= MAX_OVERRIDES:
        raise _err("validation", f"אפשר לשמור עד {MAX_OVERRIDES} ימים ידניים.", fields=["date"])
    cfg["overrides"][key] = {"kind": kind, "name_he": name}
    cfg["revision"] += 1
    _store(conn, cfg)
    return cfg


def remove_override(conn: sqlite3.Connection, day: dt.date, base_revision: int | None) -> dict[str, Any]:
    cfg = read_config(conn)
    _check_revision(cfg, base_revision)
    if cfg["overrides"].pop(day.isoformat(), None) is None:
        raise ApiError(404, "not_found", "אין הגדרה ידנית לתאריך הזה.")
    cfg["revision"] += 1
    _store(conn, cfg)
    return cfg


def set_generator(conn: sqlite3.Connection, generator: str, base_revision: int | None) -> dict[str, Any]:
    if generator not in GENERATORS:
        raise _err("validation", "מקור החגים אינו מוכר.", fields=["generator"])
    cfg = read_config(conn)
    _check_revision(cfg, base_revision)
    cfg["generator"] = generator
    cfg["revision"] += 1
    _store(conn, cfg)
    return cfg
