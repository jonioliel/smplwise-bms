"""EL5: time-of-use (TOU, תעו״ז) tariff definitions and the time classification of a bill window.

Contract: docs/architecture/ELECTRICITY_TOU.md. A TOU tariff version stores a *definition* (energy_tariff_versions.definition_json):
seasons as month-day ranges, day types (ordered from "least" to "most" restful), the weekday map plus which day type a
holiday and a holiday eve count as, bands with a default band, per season and day type the local-time ranges of the
non-default bands, and a price per season and band. Nothing about Israel is hard-coded in the engine: the Israeli structure
is a template (`israel_template`) with EMPTY prices that the manager fills and confirms (plan section 7: the hours come from
secondary sources; prices are not verified anywhere).

Classification (plan section 5.8, owner examples summer 17-23 / winter 17-22): the window [start, end) is cut at every UTC
quarter hour (the readings store's bucket; Israel's offsets are whole hours, so a local quarter hour is a UTC quarter hour)
and every piece takes the season, day type and band of the LOCAL wall-clock time of its start in the account's IANA zone.
So the DST spring day simply has no 02:00-03:00 pieces (23 hours), the autumn day has its repeated hour twice (25 hours),
both copies with the band of that wall-clock hour, and no fixed +2/+3 offset is used anywhere. Consecutive pieces with the
same (price piece, local date, season, day type, band) are merged into one segment."""
from __future__ import annotations

import datetime as dt
import hashlib
import json
import re
from dataclasses import dataclass
from decimal import Decimal, InvalidOperation
from typing import Any, Callable
from zoneinfo import ZoneInfo

ENGINE = "arx.energy.tou/1"
QUARTER_S = 900
WEEK = ("sun", "mon", "tue", "wed", "thu", "fri", "sat")
_PY_WEEKDAY = {6: "sun", 0: "mon", 1: "tue", 2: "wed", 3: "thu", 4: "fri", 5: "sat"}
WEEK_HE = {"sun": "ראשון", "mon": "שני", "tue": "שלישי", "wed": "רביעי", "thu": "חמישי", "fri": "שישי", "sat": "שבת"}
MAX_SEASONS, MAX_DAY_TYPES, MAX_BANDS, MAX_RANGES = 12, 8, 8, 24
MAX_NAME = 40
_ID = re.compile(r"^[a-z][a-z0-9_]{0,23}$")
_MD = re.compile(r"^(\d{2})-(\d{2})$")
_HM = re.compile(r"^(\d{2}):(\d{2})$")
_Q4 = Decimal("0.0001")
_LEAP = 2000  # a leap year: day-of-year indexes 0..365 cover 29 February


class TouError(ValueError):
    def __init__(self, code: str, path: str, message_he: str):
        super().__init__(code)
        self.code = code
        self.path = path
        self.message_he = message_he

    def as_dict(self) -> dict[str, str]:
        return {"code": self.code, "path": self.path, "message": self.message_he}


@dataclass(frozen=True)
class Named:
    id: str
    name_he: str


@dataclass(frozen=True)
class Season:
    id: str
    name_he: str
    ranges: tuple[tuple[str, str], ...]  # inclusive month-day ranges, may wrap the year end


@dataclass(frozen=True)
class Definition:
    seasons: tuple[Season, ...]
    day_types: tuple[Named, ...]  # ascending "rest" order: a date that qualifies for several takes the last one
    week: dict[str, str]
    holiday: str | None
    holiday_eve: str | None
    bands: tuple[Named, ...]
    default_band: str
    schedule: dict[tuple[str, str], tuple[tuple[int, int, str], ...]]  # (season, day type) -> [(from min, to min, band)], split at midnight
    prices: dict[tuple[str, str], Decimal]  # (season, band) -> price per kWh as entered (mode on the version row)
    season_by_doy: tuple[str, ...]  # 366 entries, by day-of-year index of a leap year
    raw: dict[str, Any]  # the normalised JSON (what is stored and sealed into snapshots)

    # ---------------------------------------------------------------- lookups
    def season_of(self, day: dt.date) -> str:
        return self.season_by_doy[_doy(day.month, day.day)]

    def day_type_of(self, day: dt.date, special: str | None) -> str:
        cands = [self.week[_PY_WEEKDAY[day.weekday()]]]
        if special == "holiday" and self.holiday:
            cands.append(self.holiday)
        elif special == "holiday_eve" and self.holiday_eve:
            cands.append(self.holiday_eve)
        order = {d.id: i for i, d in enumerate(self.day_types)}
        return max(cands, key=lambda c: order[c])

    def band_at(self, season: str, day_type: str, minute: int) -> str:
        for a, b, band in self.schedule.get((season, day_type), ()):
            if a <= minute < b:
                return band
        return self.default_band

    def price(self, season: str, band: str) -> Decimal:
        return self.prices[(season, band)]

    def season_name(self, sid: str) -> str:
        return next((s.name_he for s in self.seasons if s.id == sid), sid)

    def band_name(self, bid: str) -> str:
        return next((b.name_he for b in self.bands if b.id == bid), bid)

    def day_type_name(self, did: str) -> str:
        return next((d.name_he for d in self.day_types if d.id == did), did)

    def band_index(self, bid: str) -> int:
        return next((i for i, b in enumerate(self.bands) if b.id == bid), len(self.bands))

    def season_index(self, sid: str) -> int:
        return next((i for i, s in enumerate(self.seasons) if s.id == sid), len(self.seasons))

    def sha256(self) -> str:
        return definition_sha256(self.raw)


def definition_sha256(raw: dict[str, Any]) -> str:
    return hashlib.sha256(json.dumps(raw, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode("utf-8")).hexdigest()


def _doy(month: int, day: int) -> int:
    return (dt.date(_LEAP, month, day) - dt.date(_LEAP, 1, 1)).days


def _hm(value: Any, path: str, allow_24: bool) -> int:
    m = _HM.match(value) if isinstance(value, str) else None
    if not m:
        raise TouError("time", path, "שעה חייבת להיות בתבנית HH:MM.")
    h, mi = int(m.group(1)), int(m.group(2))
    if (h == 24 and mi == 0 and allow_24) or (0 <= h <= 23 and 0 <= mi <= 59):
        if mi % 15:
            raise TouError("time_quarter", path, "השעות חייבות להיות ברבעי שעה (00, 15, 30, 45), כמו נתוני המונים.")
        return h * 60 + mi
    raise TouError("time", path, "שעה לא תקינה.")


def _named(items: Any, path: str, limit: int, what_he: str) -> tuple[Named, ...]:
    if not isinstance(items, list) or not items:
        raise TouError("required", path, f"יש להגדיר לפחות {what_he} אחד.")
    if len(items) > limit:
        raise TouError("too_many", path, f"אפשר להגדיר עד {limit} {what_he}.")
    out: list[Named] = []
    seen: set[str] = set()
    for i, it in enumerate(items):
        p = f"{path}[{i}]"
        if not isinstance(it, dict):
            raise TouError("syntax", p, "מבנה לא תקין.")
        iid, name = it.get("id"), it.get("name_he")
        if not isinstance(iid, str) or not _ID.match(iid):
            raise TouError("id", p + ".id", "מזהה חייב להתחיל באות לטינית קטנה ולהכיל אותיות, ספרות וקו תחתון (עד 24).")
        if iid in seen:
            raise TouError("duplicate", p + ".id", f"המזהה {iid} מופיע פעמיים.")
        if not isinstance(name, str) or not name.strip() or len(name.strip()) > MAX_NAME:
            raise TouError("name", p + ".name_he", f"שם חובה, עד {MAX_NAME} תווים.")
        seen.add(iid)
        out.append(Named(iid, name.strip()))
    return tuple(out)


def _price(value: Any, path: str) -> Decimal:
    try:
        d = Decimal(str(value).strip())
    except (InvalidOperation, AttributeError):
        raise TouError("price", path, "המחיר חייב להיות מספר.") from None
    if value is None or isinstance(value, bool) or not d.is_finite() or d < 0 or d > 1000 or d != d.quantize(_Q4):
        raise TouError("price", path, "המחיר הוא 0 עד 1000 עם עד 4 ספרות אחרי הנקודה.")
    return d.quantize(_Q4)


def parse_definition(obj: Any) -> Definition:
    """Validate a definition from outside (API body or a stored row) -> Definition. Raises TouError (first error)."""
    if not isinstance(obj, dict):
        raise TouError("syntax", "", "הגדרת התעריף חייבת להיות אובייקט.")
    allowed = {"seasons", "day_types", "week", "holiday", "holiday_eve", "bands", "default_band", "schedule", "prices"}
    extra = sorted(set(obj) - allowed)
    if extra:
        raise TouError("unknown_field", extra[0], f"שדה לא מוכר: {extra[0]}.")
    # seasons
    raw_seasons = obj.get("seasons")
    if not isinstance(raw_seasons, list) or not raw_seasons:
        raise TouError("required", "seasons", "יש להגדיר לפחות עונה אחת.")
    if len(raw_seasons) > MAX_SEASONS:
        raise TouError("too_many", "seasons", f"אפשר להגדיר עד {MAX_SEASONS} עונות.")
    named_seasons = _named([{"id": s.get("id"), "name_he": s.get("name_he")} if isinstance(s, dict) else s for s in raw_seasons], "seasons", MAX_SEASONS, "עונות")
    seasons: list[Season] = []
    owner: list[str | None] = [None] * 366
    explicit_feb29 = False
    for i, (s, n) in enumerate(zip(raw_seasons, named_seasons)):
        rs = s.get("ranges")
        if not isinstance(rs, list) or not rs or len(rs) > 6:
            raise TouError("required", f"seasons[{i}].ranges", "לכל עונה צריך טווח תאריכים אחד עד שישה.")
        ranges: list[tuple[str, str]] = []
        for j, r in enumerate(rs):
            p = f"seasons[{i}].ranges[{j}]"
            if not isinstance(r, list) or len(r) != 2 or not all(isinstance(x, str) for x in r):
                raise TouError("syntax", p, "טווח הוא [\"MM-DD\", \"MM-DD\"].")
            idx = []
            for x in r:
                m = _MD.match(x)
                try:
                    if not m:
                        raise ValueError
                    idx.append(_doy(int(m.group(1)), int(m.group(2))))
                except ValueError:
                    raise TouError("date", p, f"תאריך לא תקין: {x} (MM-DD).") from None
            a, b = idx
            days = list(range(a, b + 1)) if a <= b else list(range(a, 366)) + list(range(0, b + 1))
            for d in days:
                if owner[d] is not None and owner[d] != n.id:
                    md = (dt.date(_LEAP, 1, 1) + dt.timedelta(days=d)).strftime("%d.%m")
                    raise TouError("season_overlap", p, f"התאריך {md} שייך ליותר מעונה אחת.")
                owner[d] = n.id
            if _doy(2, 29) in days:
                explicit_feb29 = True
            ranges.append((r[0], r[1]))
        seasons.append(Season(n.id, n.name_he, tuple(ranges)))
    feb29, feb28 = _doy(2, 29), _doy(2, 28)
    if owner[feb29] is None and not explicit_feb29 and owner[feb28] is not None:
        owner[feb29] = owner[feb28]  # 29 February belongs to the season of 28 February (plan section 8.1)
    missing = [d for d in range(366) if owner[d] is None]
    if missing:
        md = (dt.date(_LEAP, 1, 1) + dt.timedelta(days=missing[0])).strftime("%d.%m")
        raise TouError("season_gap", "seasons", f"העונות חייבות לכסות את כל השנה. התאריך {md} לא שייך לאף עונה.")
    season_ids = [s.id for s in seasons]
    # day types and the week
    day_types = _named(obj.get("day_types"), "day_types", MAX_DAY_TYPES, "סוגי ימים")
    dt_ids = {d.id for d in day_types}
    week = obj.get("week")
    if not isinstance(week, dict) or set(week) != set(WEEK):
        raise TouError("week", "week", "יש לשייך כל יום בשבוע (ראשון עד שבת) לסוג יום.")
    for k in WEEK:
        if week[k] not in dt_ids:
            raise TouError("week", f"week.{k}", f"יום {WEEK_HE[k]} משויך לסוג יום שאינו מוגדר.")
    hol, eve = obj.get("holiday"), obj.get("holiday_eve")
    for key, val in (("holiday", hol), ("holiday_eve", eve)):
        if val is not None and val not in dt_ids:
            raise TouError("day_type", key, "חג וערב חג חייבים להיות משויכים לסוג יום מוגדר (או לא להשתנות).")
    # bands
    bands = _named(obj.get("bands"), "bands", MAX_BANDS, "פסי תעריף")
    band_ids = {b.id for b in bands}
    default_band = obj.get("default_band")
    if default_band not in band_ids:
        raise TouError("default_band", "default_band", "יש לבחור פס ברירת מחדל מתוך הפסים המוגדרים.")
    # schedule
    sched_raw = obj.get("schedule") or {}
    if not isinstance(sched_raw, dict):
        raise TouError("syntax", "schedule", "מבנה לא תקין.")
    schedule: dict[tuple[str, str], tuple[tuple[int, int, str], ...]] = {}
    norm_schedule: dict[str, dict[str, list[list[str]]]] = {}
    for sid, per_dt in sched_raw.items():
        if sid not in season_ids:
            raise TouError("unknown_season", f"schedule.{sid}", f"עונה לא מוגדרת: {sid}.")
        if not isinstance(per_dt, dict):
            raise TouError("syntax", f"schedule.{sid}", "מבנה לא תקין.")
        for did, ranges in per_dt.items():
            p = f"schedule.{sid}.{did}"
            if did not in dt_ids:
                raise TouError("unknown_day_type", p, f"סוג יום לא מוגדר: {did}.")
            if not isinstance(ranges, list) or len(ranges) > MAX_RANGES:
                raise TouError("syntax", p, f"עד {MAX_RANGES} טווחי שעות לכל עונה וסוג יום.")
            parts: list[tuple[int, int, str]] = []
            kept: list[list[str]] = []
            for j, r in enumerate(ranges):
                pj = f"{p}[{j}]"
                if not isinstance(r, list) or len(r) != 3:
                    raise TouError("syntax", pj, "טווח שעות הוא [\"HH:MM\", \"HH:MM\", \"פס\"].")
                a, b = _hm(r[0], pj, False), _hm(r[1], pj, True)
                if r[2] not in band_ids:
                    raise TouError("unknown_band", pj, f"פס לא מוגדר: {r[2]}.")
                if a == b:
                    raise TouError("empty_range", pj, "שעת ההתחלה שווה לשעת הסיום.")
                if a < b:
                    parts.append((a, b, r[2]))
                else:  # crosses midnight: evening of the date, and its early morning (both evaluated on the same date)
                    parts.append((a, 24 * 60, r[2]))
                    if b > 0:
                        parts.append((0, b, r[2]))
                kept.append([r[0], r[1], r[2]])
            parts.sort()
            for (_a1, b1, _x), (a2, _b2, _y) in zip(parts, parts[1:]):
                if a2 < b1:
                    raise TouError("range_overlap", p, "טווחי השעות חופפים.")
            schedule[(sid, did)] = tuple(parts)
            if kept:
                norm_schedule.setdefault(sid, {})[did] = kept
    # prices: every band that can occur in a season needs its price there
    prices_raw = obj.get("prices")
    if not isinstance(prices_raw, dict):
        raise TouError("required", "prices", "יש להזין מחירים.")
    prices: dict[tuple[str, str], Decimal] = {}
    norm_prices: dict[str, dict[str, str]] = {}
    for sid, per_band in prices_raw.items():
        if sid not in season_ids:
            raise TouError("unknown_season", f"prices.{sid}", f"עונה לא מוגדרת: {sid}.")
        if not isinstance(per_band, dict):
            raise TouError("syntax", f"prices.{sid}", "מבנה לא תקין.")
        for bid, val in per_band.items():
            if bid not in band_ids:
                raise TouError("unknown_band", f"prices.{sid}.{bid}", f"פס לא מוגדר: {bid}.")
            prices[(sid, bid)] = _price(val, f"prices.{sid}.{bid}")
    for s in seasons:
        used = {s_band for (sid, _d), rng in schedule.items() if sid == s.id for (_a, _b, s_band) in rng} | {default_band}
        for bid in sorted(used, key=lambda x: [b.id for b in bands].index(x)):
            if (s.id, bid) not in prices:
                raise TouError("price_missing", f"prices.{s.id}.{bid}",
                               f"חסר מחיר ל{next(b.name_he for b in bands if b.id == bid)} ב{s.name_he}.")
        norm_prices[s.id] = {b.id: str(prices[(s.id, b.id)]) for b in bands if (s.id, b.id) in prices}
    raw = {
        "seasons": [{"id": s.id, "name_he": s.name_he, "ranges": [list(r) for r in s.ranges]} for s in seasons],
        "day_types": [{"id": d.id, "name_he": d.name_he} for d in day_types],
        "week": {k: week[k] for k in WEEK},
        "holiday": hol, "holiday_eve": eve,
        "bands": [{"id": b.id, "name_he": b.name_he} for b in bands],
        "default_band": default_band,
        "schedule": norm_schedule,
        "prices": norm_prices,
    }
    return Definition(tuple(seasons), day_types, {k: week[k] for k in WEEK}, hol, eve, bands, default_band, schedule, prices,
                      tuple(owner), raw)  # type: ignore[arg-type]


# ====================================================================== the Israeli template

TEMPLATE_SOURCE_HE = ("מבנה תעו״ז ביתי לפי מקורות משניים (אתרי מידע על תעריפי רשות החשמל, 2026): קיץ יוני-ספטמבר, חורף "
                      "דצמבר-פברואר, מעבר בשאר החודשים; פסגה בקיץ 17:00-23:00 בימי חול, בחורף 17:00-22:00 בכל הימים, "
                      "במעבר 17:00-22:00 בימי חול. המחירים ריקים: יש להזין אותם מחשבון אמיתי. המבנה לא אומת מול נוסח הרשות.")


def israel_template() -> dict[str, Any]:
    """The Israeli household TOU structure (plan section 7) with EMPTY prices (null). Never a default in code: the manager
    fills the prices and confirms the hours against a real bill."""
    return {
        "seasons": [
            {"id": "summer", "name_he": "קיץ", "ranges": [["06-01", "09-30"]]},
            {"id": "winter", "name_he": "חורף", "ranges": [["12-01", "02-29"]]},
            {"id": "transition", "name_he": "מעבר", "ranges": [["03-01", "05-31"], ["10-01", "11-30"]]},
        ],
        "day_types": [
            {"id": "weekday", "name_he": "ימי חול"},
            {"id": "friday", "name_he": "שישי וערבי חג"},
            {"id": "saturday", "name_he": "שבת וחג"},
        ],
        "week": {"sun": "weekday", "mon": "weekday", "tue": "weekday", "wed": "weekday", "thu": "weekday", "fri": "friday", "sat": "saturday"},
        "holiday": "saturday", "holiday_eve": "friday",
        "bands": [{"id": "offpeak", "name_he": "שפל"}, {"id": "peak", "name_he": "פסגה"}],
        "default_band": "offpeak",
        "schedule": {
            "summer": {"weekday": [["17:00", "23:00", "peak"]]},
            "winter": {"weekday": [["17:00", "22:00", "peak"]], "friday": [["17:00", "22:00", "peak"]], "saturday": [["17:00", "22:00", "peak"]]},
            "transition": {"weekday": [["17:00", "22:00", "peak"]]},
        },
        "prices": {"summer": {"offpeak": None, "peak": None}, "winter": {"offpeak": None, "peak": None}, "transition": {"offpeak": None, "peak": None}},
    }


TEMPLATES = {"israel_household": {"name_he": "תעו״ז ביתי (ישראל)", "build": israel_template, "source_he": TEMPLATE_SOURCE_HE}}


# ====================================================================== classification of a window

@dataclass(frozen=True)
class Segment:
    start: dt.datetime  # UTC
    end: dt.datetime  # UTC, exclusive
    piece: int  # index of the price piece (tariff version x VAT) the local date belongs to
    date: dt.date  # local date
    season: str
    day_type: str
    band: str

    @property
    def seconds(self) -> int:
        return int((self.end - self.start).total_seconds())


def segments(start: dt.datetime, end: dt.datetime, tz: ZoneInfo, piece_of: Callable[[dt.date], int],
             definition_of: Callable[[int], Definition], special_of: Callable[[dt.date], str | None]) -> list[Segment]:
    """The window [start, end) cut at UTC quarter hours, each part classified by the local wall-clock time of its start,
    consecutive equal parts merged. `piece_of(local date)` -> price piece index; `definition_of(piece)` -> its definition;
    `special_of(local date)` -> 'holiday' | 'holiday_eve' | None."""
    if end <= start:
        return []
    out: list[Segment] = []
    cache: dict[dt.date, tuple[int, Definition, str, str]] = {}
    t = start.astimezone(dt.timezone.utc)
    end = end.astimezone(dt.timezone.utc)
    while t < end:
        ts = int(t.timestamp())
        nxt = dt.datetime.fromtimestamp(ts - ts % QUARTER_S + QUARTER_S, dt.timezone.utc)
        stop = min(nxt, end)
        local = t.astimezone(tz)
        day = local.date()
        info = cache.get(day)
        if info is None:
            piece = piece_of(day)
            d = definition_of(piece)
            season = d.season_of(day)
            info = (piece, d, season, d.day_type_of(day, special_of(day)))
            cache[day] = info
        piece, d, season, day_type = info
        band = d.band_at(season, day_type, local.hour * 60 + local.minute)
        last = out[-1] if out else None
        if last is not None and last.end == t and (last.piece, last.date, last.season, last.day_type, last.band) == (piece, day, season, day_type, band):
            out[-1] = Segment(last.start, stop, piece, day, season, day_type, band)
        else:
            out.append(Segment(t, stop, piece, day, season, day_type, band))
        t = stop
    return out


def week_grid(d: Definition) -> dict[str, dict[str, list[dict[str, str]]]]:
    """For the editor preview: per season and day type, the day split into consecutive (from, to, band) ranges."""
    def fmt(m: int) -> str:
        return f"{m // 60:02d}:{m % 60:02d}"

    out: dict[str, dict[str, list[dict[str, str]]]] = {}
    for s in d.seasons:
        out[s.id] = {}
        for t in d.day_types:
            cuts = sorted({0, 24 * 60} | {x for a, b, _ in d.schedule.get((s.id, t.id), ()) for x in (a, b)})
            rows: list[dict[str, str]] = []
            for a, b in zip(cuts, cuts[1:]):
                band = d.band_at(s.id, t.id, a)
                if rows and rows[-1]["band"] == band:
                    rows[-1]["to"] = fmt(b)
                else:
                    rows.append({"from": fmt(a), "to": fmt(b), "band": band})
            out[s.id][t.id] = rows
    return out
