"""EL5 engines without the API: the Hebrew-calendar holidays, the time-of-use definition (validation, seasons, day types,
bands, midnight-crossing ranges, 29 February), the classification of a bill window into band segments (DST spring and
autumn days, the repeated autumn hour, holidays and their eves, season and price-piece boundaries) and the batched read of
the readings store (identical to one read per window). Fakes and a temporary store only; no device."""
from __future__ import annotations

import copy
import datetime as dt
from collections import Counter
from zoneinfo import ZoneInfo

import pytest

from smplwise.services import energy_calendar as ecal
from smplwise.services import energy_provider as ep
from smplwise.services import energy_store as st
from smplwise.services import energy_tou as tou
from smplwise.db import Database
from test_energy_store import add_meter, feed, local

TZ = ZoneInfo("Asia/Jerusalem")
UTC = dt.timezone.utc


def priced(defn: dict | None = None, **over) -> dict:
    d = copy.deepcopy(defn or tou.israel_template())
    for s in d["prices"]:
        d["prices"][s] = {"offpeak": "0.5000", "peak": "1.5000"}
    d.update(over)
    return d


def hours_by(segs, *keys) -> Counter:
    out: Counter = Counter()
    for s in segs:
        key = tuple(getattr(s, k) for k in keys)
        out[key[0] if len(key) == 1 else key] += s.seconds / 3600
    return out


def classify(start: dt.date, end: dt.date, definition: dict | None = None, special=None, tz: ZoneInfo = TZ):
    d = tou.parse_definition(definition or priced())
    cal = ecal.Calendar({"generator": "israel", "overrides": {}})
    a = dt.datetime(start.year, start.month, start.day, tzinfo=tz).astimezone(UTC)
    b = dt.datetime(end.year, end.month, end.day, tzinfo=tz).astimezone(UTC)
    return tou.segments(a, b, tz, lambda _d: 0, lambda _i: d, special or cal.kind)


# ---------------------------------------------------------------- the Hebrew calendar

@pytest.mark.parametrize("year,rosh_hashanah,pesach,shavuot,yom_kippur,independence", [
    (2022, "2022-09-26", "2022-04-16", "2022-06-05", "2022-10-05", "2022-05-05"),   # 5 Iyar on Friday -> Thursday
    (2023, "2023-09-16", "2023-04-06", "2023-05-26", "2023-09-25", "2023-04-26"),
    (2024, "2024-10-03", "2024-04-23", "2024-06-12", "2024-10-12", "2024-05-14"),   # 5 Iyar on Monday -> Tuesday
    (2025, "2025-09-23", "2025-04-13", "2025-06-02", "2025-10-02", "2025-05-01"),   # 5 Iyar on Saturday -> Thursday
    (2026, "2026-09-12", "2026-04-02", "2026-05-22", "2026-09-21", "2026-04-22"),
    (2027, "2027-10-02", "2027-04-22", "2027-06-11", "2027-10-11", "2027-05-12"),
])
def test_generated_holidays_match_the_published_dates(year, rosh_hashanah, pesach, shavuot, yom_kippur, independence):
    days = {s.date.isoformat(): s for s in ecal.israel_special_days(year)}
    for date in (rosh_hashanah, pesach, shavuot, yom_kippur, independence):
        assert days[date].kind == "holiday", date
        eve = (dt.date.fromisoformat(date) - dt.timedelta(days=1)).isoformat()
        assert days[eve].kind in ("holiday_eve", "holiday"), eve
    rh = dt.date.fromisoformat(rosh_hashanah)
    assert days[(rh + dt.timedelta(days=1)).isoformat()].kind == "holiday"  # Rosh Hashanah is two days
    assert days[(rh - dt.timedelta(days=1)).isoformat()].kind == "holiday_eve"
    assert all(s.date.year == year and s.source == "generated" for s in days.values())


def test_hebrew_year_arithmetic():
    # leap years of the 19-year cycle and the three year lengths
    assert [y for y in range(5784, 5792) if ecal.hebrew_leap(y)] == [5784, 5787, 5790]
    for y in range(5700, 5900):
        n = ecal.days_in_hebrew_year(y)
        assert n in ((353, 354, 355) if not ecal.hebrew_leap(y) else (383, 384, 385)), (y, n)
        assert sum(ecal.hebrew_month_length(y, m) for m in range(1, 14 if ecal.hebrew_leap(y) else 13)) == n
        # Rosh Hashanah never falls on Sunday, Wednesday or Friday
        assert ecal.hebrew_to_date(y, 7, 1).weekday() not in (6, 2, 4)
        # Pesach never on Monday, Wednesday or Friday; Independence Day never on Friday, Saturday, Sunday or Monday
        assert ecal.hebrew_to_date(y, 1, 15).weekday() not in (0, 2, 4)
        assert ecal.independence_day(y).weekday() not in (4, 5, 6, 0)
    with pytest.raises(ValueError):
        ecal.hebrew_to_date(5786, 13, 1)  # 5786 is not a leap year: no Adar II
    assert ecal.israel_special_days(1999) == () and ecal.israel_special_days(2101) == ()


def test_overrides_win_and_a_cancelled_day_is_regular():
    cal = ecal.Calendar({"generator": "israel", "overrides": {
        "2026-04-22": {"kind": "regular", "name_he": "לא חג בתעריף"},
        "2026-07-14": {"kind": "holiday", "name_he": "יום מנוחה מקומי"}}})
    assert cal.kind(dt.date(2026, 4, 22)) is None and cal.entry(dt.date(2026, 4, 22)).source == "manual"
    assert cal.kind(dt.date(2026, 4, 21)) == "holiday_eve"  # the generated eve stays
    assert cal.kind(dt.date(2026, 7, 14)) == "holiday"
    listed = [s.date.isoformat() for s in cal.between(dt.date(2026, 4, 1), dt.date(2026, 5, 1))]
    assert "2026-04-22" in listed and listed == sorted(listed)
    none = ecal.Calendar({"generator": "none", "overrides": {}})
    assert none.kind(dt.date(2026, 4, 2)) is None and none.between(dt.date(2026, 1, 1), dt.date(2027, 1, 1)) == []


# ---------------------------------------------------------------- the definition

def test_template_has_empty_prices_and_needs_them():
    t = tou.israel_template()
    assert all(v is None for p in t["prices"].values() for v in p.values()), "no price is ever a default"
    with pytest.raises(tou.TouError) as e:
        tou.parse_definition(t)
    assert e.value.code == "price" and e.value.path.startswith("prices.")
    d = tou.parse_definition(priced())
    assert d.season_of(dt.date(2026, 7, 1)) == "summer" and d.season_of(dt.date(2026, 1, 15)) == "winter"
    assert d.season_of(dt.date(2026, 3, 1)) == "transition" and d.season_of(dt.date(2026, 11, 30)) == "transition"
    assert d.season_of(dt.date(2028, 2, 29)) == "winter"
    assert d.sha256() == tou.definition_sha256(d.raw) and tou.parse_definition(d.raw).raw == d.raw  # stable round trip


@pytest.mark.parametrize("mutate,code", [
    (lambda d: d["seasons"][0].update(ranges=[["06-01", "08-31"]]), "season_gap"),
    (lambda d: d["seasons"][0].update(ranges=[["05-15", "09-30"]]), "season_overlap"),
    (lambda d: d["seasons"][0].update(ranges=[["06-31", "09-30"]]), "date"),
    (lambda d: d["schedule"]["summer"].update(weekday=[["17:10", "23:00", "peak"]]), "time_quarter"),
    (lambda d: d["schedule"]["summer"].update(weekday=[["17:00", "23:00", "peak"], ["22:00", "23:30", "peak"]]), "range_overlap"),
    (lambda d: d["schedule"]["summer"].update(weekday=[["17:00", "17:00", "peak"]]), "empty_range"),
    (lambda d: d["schedule"]["summer"].update(weekday=[["17:00", "23:00", "shoulder"]]), "unknown_band"),
    (lambda d: d["schedule"].update(spring={"weekday": []}), "unknown_season"),
    (lambda d: d["schedule"]["summer"].update(sunday=[]), "unknown_day_type"),
    (lambda d: d["week"].pop("sat"), "week"),
    (lambda d: d.update(holiday="holy"), "day_type"),
    (lambda d: d.update(default_band="night"), "default_band"),
    (lambda d: d["prices"]["winter"].pop("peak"), "price_missing"),
    (lambda d: d["prices"]["winter"].update(peak="-1"), "price"),
    (lambda d: d["prices"]["winter"].update(peak="1.23456"), "price"),
    (lambda d: d["bands"].append({"id": "peak", "name_he": "שוב"}), "duplicate"),
    (lambda d: d["bands"].append({"id": "Peak2", "name_he": "x"}), "id"),
    (lambda d: d.update(extra=1), "unknown_field"),
])
def test_invalid_definitions_are_refused_with_a_path(mutate, code):
    d = priced()
    mutate(d)
    with pytest.raises(tou.TouError) as e:
        tou.parse_definition(d)
    assert e.value.code == code
    assert e.value.message_he  # a Hebrew message for the editor


def test_february_29_follows_february_28_unless_explicit():
    d = priced()
    d["seasons"][1]["ranges"] = [["12-01", "02-28"]]
    assert tou.parse_definition(d).season_of(dt.date(2028, 2, 29)) == "winter"
    d["seasons"][2]["ranges"] = [["02-29", "05-31"], ["10-01", "11-30"]]  # 29.2 written explicitly into another season
    assert tou.parse_definition(d).season_of(dt.date(2028, 2, 29)) == "transition"


def test_midnight_crossing_range_and_three_bands():
    d = priced()
    d["bands"].append({"id": "night", "name_he": "לילה"})
    d["schedule"]["summer"]["weekday"] = [["07:00", "17:00", "peak"], ["22:00", "06:00", "night"]]
    d["prices"]["summer"]["night"] = "0.3000"
    pd = tou.parse_definition(d)
    assert [pd.band_at("summer", "weekday", m) for m in (0, 5 * 60 + 45, 6 * 60, 7 * 60, 16 * 60 + 45, 17 * 60, 22 * 60, 23 * 60 + 45)] == \
        ["night", "night", "offpeak", "peak", "peak", "offpeak", "night", "night"]
    grid = tou.week_grid(pd)["summer"]["weekday"]
    assert grid == [{"from": "00:00", "to": "06:00", "band": "night"}, {"from": "06:00", "to": "07:00", "band": "offpeak"},
                    {"from": "07:00", "to": "17:00", "band": "peak"}, {"from": "17:00", "to": "22:00", "band": "offpeak"},
                    {"from": "22:00", "to": "24:00", "band": "night"}]
    # a band price that a season can never use is not required
    d2 = priced()
    d2["bands"].append({"id": "shoulder", "name_he": "גבע"})
    tou.parse_definition(d2)


def test_day_type_takes_the_most_restful_candidate():
    d = tou.parse_definition(priced())
    assert d.day_type_of(dt.date(2026, 4, 22), "holiday") == "saturday"      # a Wednesday holiday
    assert d.day_type_of(dt.date(2026, 4, 21), "holiday_eve") == "friday"    # a Tuesday holiday eve
    assert d.day_type_of(dt.date(2026, 9, 19), "holiday_eve") == "saturday"  # a Saturday that is also an eve stays Saturday
    assert d.day_type_of(dt.date(2026, 10, 2), "holiday") == "saturday"      # a Friday holiday
    assert d.day_type_of(dt.date(2026, 7, 2), None) == "weekday"
    no_hol = tou.parse_definition(priced(holiday=None, holiday_eve=None))
    assert no_hol.day_type_of(dt.date(2026, 4, 22), "holiday") == "weekday"


# ---------------------------------------------------------------- classification of a window

def test_summer_month_hours_per_band():
    segs = classify(dt.date(2026, 7, 1), dt.date(2026, 8, 1))
    h = hours_by(segs, "band")
    assert h == {"peak": 22 * 6, "offpeak": 31 * 24 - 22 * 6}  # 22 weekdays x 17:00-23:00
    assert all(s.start < s.end for s in segs) and all(a.end == b.start for a, b in zip(segs, segs[1:]))
    # every segment starts and ends on a quarter hour and never crosses a local date
    assert all(int(s.start.timestamp()) % 900 == 0 and s.start.astimezone(TZ).date() == s.date for s in segs)
    peak = [s for s in segs if s.band == "peak"]
    assert {s.start.astimezone(TZ).hour for s in peak} == {17} and {s.end.astimezone(TZ).hour for s in peak} == {23}


def test_dst_spring_day_has_23_hours_and_autumn_day_25():
    spring = classify(dt.date(2026, 3, 27), dt.date(2026, 3, 28))  # Friday 02:00 -> 03:00
    assert sum(s.seconds for s in spring) == 23 * 3600
    march = hours_by(classify(dt.date(2026, 3, 1), dt.date(2026, 4, 1)), "band")
    assert march == {"peak": 23 * 5, "offpeak": 31 * 24 - 1 - 23 * 5}  # transition: 23 weekdays x 17:00-22:00
    october = hours_by(classify(dt.date(2026, 10, 1), dt.date(2026, 11, 1)), "band")
    assert october == {"peak": 21 * 5, "offpeak": 31 * 24 + 1 - 21 * 5}  # the 25-hour day of 25.10.2026


def test_the_repeated_autumn_hour_takes_the_band_of_its_wall_clock_time_twice():
    d = priced()
    d["bands"].append({"id": "night", "name_he": "לילה"})
    d["schedule"]["transition"] = {"weekday": [["01:00", "02:00", "night"]], "friday": [["01:00", "02:00", "night"]], "saturday": [["01:00", "02:00", "night"]]}
    d["prices"]["transition"]["night"] = "0.1000"
    segs = classify(dt.date(2026, 10, 25), dt.date(2026, 10, 26), d)
    night = [s for s in segs if s.band == "night"]
    assert sum(s.seconds for s in night) == 2 * 3600  # 01:00-02:00 summer time and 01:00-02:00 winter time
    assert sum(s.seconds for s in segs) == 25 * 3600
    spring = classify(dt.date(2026, 3, 27), dt.date(2026, 3, 28), {**d, "schedule": {"transition": {"friday": [["02:00", "03:00", "night"]]}}})
    assert not [s for s in spring if s.band == "night"]  # 02:00-03:00 does not exist on the spring day


def test_holidays_and_eves_remove_the_weekday_peak():
    april = classify(dt.date(2026, 4, 1), dt.date(2026, 5, 1))
    h = hours_by(april, "band")
    # 22 weekdays minus Pesach eve/day (1-2.4), the seventh day and its eve (7-8.4), Memorial Day and Independence Day (21-22.4)
    assert h["peak"] == 16 * 5 and h["offpeak"] == 30 * 24 - 16 * 5
    types = {s.date: s.day_type for s in april}
    assert types[dt.date(2026, 4, 22)] == "saturday" and types[dt.date(2026, 4, 21)] == "friday" and types[dt.date(2026, 4, 23)] == "weekday"
    winter = hours_by(classify(dt.date(2026, 12, 1), dt.date(2027, 1, 1)), "band")
    assert winter == {"peak": 31 * 5, "offpeak": 31 * 24 - 31 * 5}  # winter peak on every day type
    # a manual cancellation makes Independence Day a regular Wednesday again
    cal = ecal.Calendar({"generator": "israel", "overrides": {"2026-04-22": {"kind": "regular", "name_he": ""}}})
    h2 = hours_by(classify(dt.date(2026, 4, 1), dt.date(2026, 5, 1), special=cal.kind), "band")
    assert h2["peak"] == 17 * 5


def test_season_change_and_price_pieces_split_segments():
    segs = classify(dt.date(2026, 9, 15), dt.date(2026, 10, 15))
    h = hours_by(segs, "season", "band")
    # summer 15-30.9 (Yom Kippur 21.9 and its eve, Sukkot eve 25.9): 10 weekdays x 6 h; transition 1-14.10: 10 weekdays x 5 h
    assert h == {("summer", "peak"): 60, ("summer", "offpeak"): 16 * 24 - 60, ("transition", "peak"): 50, ("transition", "offpeak"): 14 * 24 - 50}
    d1, d2 = tou.parse_definition(priced()), tou.parse_definition(priced())
    a = dt.datetime(2026, 7, 1, tzinfo=TZ).astimezone(UTC)
    b = dt.datetime(2026, 8, 1, tzinfo=TZ).astimezone(UTC)
    two = tou.segments(a, b, TZ, lambda day: 0 if day < dt.date(2026, 7, 15) else 1, lambda i: (d1, d2)[i], lambda _d: None)
    assert {s.piece for s in two if s.date < dt.date(2026, 7, 15)} == {0} and {s.piece for s in two if s.date >= dt.date(2026, 7, 15)} == {1}
    assert sum(s.seconds for s in two) == 31 * 24 * 3600


def test_window_edges_inside_a_quarter_hour_are_kept_exact():
    d = tou.parse_definition(priced())
    a = dt.datetime(2026, 7, 1, 16, 50, tzinfo=TZ).astimezone(UTC)
    b = dt.datetime(2026, 7, 1, 17, 20, tzinfo=TZ).astimezone(UTC)
    segs = tou.segments(a, b, TZ, lambda _d: 0, lambda _i: d, lambda _d: None)
    assert [(s.band, s.seconds) for s in segs] == [("offpeak", 600), ("peak", 1200)]
    assert tou.segments(b, a, TZ, lambda _d: 0, lambda _i: d, lambda _d: None) == []


# ---------------------------------------------------------------- the readings store: one read for many windows

@pytest.fixture()
def store_env(settings):
    db = Database(settings.db_path)
    db.migrate()
    return db, st.store_for(settings), settings


def test_batched_windows_equal_one_read_per_window(store_env):
    db, store, settings = store_env
    mid = add_meter(db)
    pts, v = [], 1_000_000
    t = local(2026, 7, 1)
    while t <= local(2026, 7, 4):
        pts.append((t, v))
        v += 3000 if 17 <= t.hour < 23 else 1000  # per 20 minutes: 9 kW in the evening, 3 kW otherwise
        t += dt.timedelta(minutes=20)
    pts.append((local(2026, 7, 6, 12), pts[-1][1] + 50_000))  # a 2.5-day reporting gap with energy
    feed(store, mid, pts)
    with db.connection(mode="read") as conn:
        p = ep.EnergyProvider(conn, store, now=local(2026, 7, 10).timestamp())
        a = local(2026, 7, 1).astimezone(UTC)
        b = local(2026, 7, 7).astimezone(UTC)
        segs = tou.segments(a, b, TZ, lambda _d: 0, lambda _i: tou.parse_definition(priced()), lambda _d: None)
        wins = [(s.start, s.end) for s in segs] + [(local(2026, 7, 2, 17, 5), local(2026, 7, 2, 17, 50))]  # an unaligned window too
        batch = p.consumption_windows(mid, wins)
        single = [p.consumption(mid, x, y) for x, y in wins]
        assert [(c.wh, c.coverage, c.covered_seconds, c.total_seconds) for c in batch] == [(c.wh, c.coverage, c.covered_seconds, c.total_seconds) for c in single]
        assert sum(c.wh or 0 for c in batch[:-1]) == p.consumption(mid, a, b).wh
        peak = sum(c.wh or 0 for s, c in zip(segs, batch) if s.band == "peak" and s.date <= dt.date(2026, 7, 3))
        assert peak == 2 * 6 * 9000  # 1-3.7.2026 are Wednesday, Thursday, Friday: Friday has no summer peak
        gaps = p.reporting_gaps(mid, a, b, dt.timedelta(hours=2))
        assert len(gaps) == 1 and gaps[0][0] == local(2026, 7, 4).astimezone(UTC) and gaps[0][2] == 50_000
        assert p.consumption_windows(mid, []) == []
