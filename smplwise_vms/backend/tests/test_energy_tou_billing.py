"""EL5: time-of-use (תעו״ז) bills end to end through the API with fakes (readings, clock, PDF renderer): golden numbers per
band and season, prices before and including VAT, the DST days, holidays and a manual day override, a season change inside a
period, a tariff version and a VAT change inside a period, a partial (meter stopped) period, energy carried from the previous
bill priced by the band of its own time, a sub-meter formula, the quarter-hour data requirement, the definition validation,
corrections of a TOU version against sealed bills, the special-days API and its permissions, and the PDF model/HTML of a TOU
bill. Expected hours are counted by hand from the calendar (comments), never from the code under test."""
from __future__ import annotations

import copy
import datetime as dt
from decimal import Decimal

import pytest

from conftest import as_user, bind
from energy_billing_world import FakeReadings, utc
from smplwise.services import bill_pdf_html, bill_pdf_model
from smplwise.services import energy_tou as tou
from test_energy_billing_api import API, W, draft, issue, rid, w  # noqa: F401 - `w` is the shared fixture
from zoneinfo import ZoneInfo

TZ = ZoneInfo("Asia/Jerusalem")
PRICES = {"summer": {"offpeak": "0.5000", "peak": "1.6895"}, "winter": {"offpeak": "0.4500", "peak": "1.2000"},
          "transition": {"offpeak": "0.4800", "peak": "0.9000"}}
D = Decimal


def loc(y: int, mo: int, d: int, h: int = 0) -> dt.datetime:
    return dt.datetime(y, mo, d, h, tzinfo=TZ).astimezone(dt.timezone.utc)


def definition(prices: dict | None = None) -> dict:
    d = tou.israel_template()
    d["prices"] = copy.deepcopy(prices or PRICES)
    return d


def hourly(w: W, mid: str, start: dt.datetime, end: dt.datetime, load=lambda local: 1000, wh: int = 1_000_000) -> int:
    """A reading every hour from `start` to `end` (UTC); the energy of each hour is load(local start of the hour) Wh."""
    t = start
    while t <= end:
        w.r.read(mid, t, wh)
        wh += load(t.astimezone(TZ))
        t += dt.timedelta(hours=1)
    return wh


def setup_tou(w: W, formula: str = "[לוח ראשי]", mode: str = "ex_vat", prices: dict | None = None, first: str = "2026-01-01") -> dict:
    c = w.c
    t = c.post(f"{API}/tariffs", json={"name": "תעו״ז ביתי", "kind": "tou", "definition": definition(prices), "price_mode": mode, "effective_from": "2026-01-01"})
    assert t.status_code == 201, t.text
    if not c.get(f"{API}/vat-rates").json()["items"]:
        assert c.post(f"{API}/vat-rates", json={"effective_from": "2025-01-01", "rate_percent": "18"}).status_code == 201
    cust = c.post(f"{API}/customers", json={"name": "לקוח בדיקה"})
    assert cust.status_code == 201, cust.text
    acc = c.post(f"{API}/accounts", json={"name": "דירה 4", "customer_id": cust.json()["id"], "formula": {"text": formula}, "tariff_id": t.json()["id"],
                                           "period_months": 1, "period_anchor_day": 1, "first_period_start": first, "auto_mode": "off"})
    assert acc.status_code == 201, acc.text
    return {"tariff": t.json(), "customer": cust.json(), "account": acc.json()}


def bill(w: W, aid: str, frm: str, to: str) -> dict:
    r = draft(w, aid, {"from": frm, "to": to})
    assert r.status_code == 201, r.text
    return r.json()


def lines(b: dict) -> list[tuple]:
    return [(ln["season"]["id"], ln["band"]["id"], ln["kwh"], ln["hours"], ln["amount_ex_vat"], ln["vat_amount"], ln["total"]) for ln in b["snapshot"]["lines"]]


def band_kwh(b: dict) -> dict[str, str]:
    return {x["band"]["id"]: x["kwh"] for x in b["snapshot"]["tou"]["by_band"]}


JULY = ("2026-07-01", "2026-07-31")


# ---------------------------------------------------------------- golden numbers

def test_golden_summer_month_per_band_issue_and_seal(w):
    hourly(w, "m1", loc(2026, 7, 1), loc(2026, 8, 2))  # a constant 1 kW
    s = setup_tou(w)
    b = bill(w, s["account"]["id"], *JULY)
    snap = b["snapshot"]
    # July 2026: 22 weekdays (Sun-Thu) x 17:00-23:00 = 132 peak hours; 744 - 132 = 612 off-peak hours; no holiday
    assert lines(b) == [("summer", "offpeak", "612.00", "612.00", "306.00", "55.08", "361.08"),
                        ("summer", "peak", "132.00", "132.00", "223.01", "40.14", "263.15")]  # 132 x 1.6895 = 223.014
    assert snap["lines"][1]["price_entered"] == "1.6895" and snap["lines"][1]["unit_price_ex_vat"] == "1.6895"
    assert snap["lines"][1]["band"]["name_he"] == "פסגה" and snap["lines"][1]["season"]["name_he"] == "קיץ"
    assert {k: snap["totals"][k] for k in ("kwh", "amount_ex_vat", "vat_amount", "total")} == {"kwh": "744.00", "amount_ex_vat": "529.01", "vat_amount": "95.22", "total": "624.23"}
    assert b["kwh"] == "744.00" and b["total"] == "624.23"
    t = snap["tou"]
    assert band_kwh(b) == {"offpeak": "612.00", "peak": "132.00"}
    assert len(t["daily"]) == 31 and t["daily"][0] == {"date": "2026-07-01", "season": "summer", "day_type": "weekday",
                                                       "bands": [{"band": "offpeak", "kwh": "18.00"}, {"band": "peak", "kwh": "6.00"}], "kwh": "24.00", "special": None}
    assert t["daily"][2]["day_type"] == "friday" and t["daily"][2]["bands"] == [{"band": "offpeak", "kwh": "24.00"}]
    assert t["versions"][0]["definition"]["prices"]["summer"] == PRICES["summer"] and len(t["versions"][0]["definition_sha256"]) == 64
    assert t["names"]["bands"] == {"offpeak": "שפל", "peak": "פסגה"} and t["calendar"] == {"generator": "israel"}
    assert snap["account"]["tariff"]["kind"] == "tou" and snap["meta"]["tou_engine"] == tou.ENGINE
    assert snap["notes"] == []  # no holiday in July, the meter reported to the end
    w.clock.at = utc(2026, 8, 2, 9)
    i = issue(w, b)
    assert i.status_code == 200, i.text
    sealed = i.json()
    assert sealed["number"] == "2026-07-0001" and sealed["snapshot"]["tou"] == t and sealed["snapshot"]["lines"] == snap["lines"]
    # a later change of the special days never touches the issued bill
    assert w.c.put(f"{API}/calendar/days/2026-07-14", json={"kind": "holiday", "name_he": "יום מקומי"}).status_code == 200
    assert w.c.get(f"{API}/bills/{sealed['id']}").json()["snapshot"] == sealed["snapshot"]


def test_prices_including_vat(w):
    hourly(w, "m1", loc(2026, 7, 1), loc(2026, 8, 2))
    s = setup_tou(w, mode="inc_vat")
    b = bill(w, s["account"]["id"], *JULY)
    # inc_vat: total = r2(kWh x price); amount = r2(total / 1.18); vat = total - amount
    assert lines(b) == [("summer", "offpeak", "612.00", "612.00", "259.32", "46.68", "306.00"),
                        ("summer", "peak", "132.00", "132.00", "188.99", "34.02", "223.01")]
    assert b["snapshot"]["lines"][1]["unit_price_ex_vat"] == "1.4318" and b["snapshot"]["lines"][1]["price_entered"] == "1.6895"
    assert b["snapshot"]["totals"]["total"] == "529.01" and b["snapshot"]["totals"]["price_mode_note_he"]


def test_energy_follows_the_hours_not_only_the_time(w):
    # 3 kW from 17:00 to 23:00 every day, 1 kW otherwise
    hourly(w, "m1", loc(2026, 7, 1), loc(2026, 8, 2), load=lambda t: 3000 if 17 <= t.hour < 23 else 1000)
    s = setup_tou(w)
    b = bill(w, s["account"]["id"], *JULY)
    # peak = 132 h x 3 kW = 396; off-peak = 9 Friday/Saturday evenings x 6 h x 3 kW + 31 x 18 h x 1 kW = 162 + 558 = 720
    assert band_kwh(b) == {"offpeak": "720.00", "peak": "396.00"} and b["kwh"] == "1116.00"


# ---------------------------------------------------------------- DST, holidays, the calendar

def test_autumn_dst_month_has_745_hours(w):
    hourly(w, "m1", loc(2026, 10, 1), loc(2026, 11, 2))
    s = setup_tou(w)
    w.clock.at = utc(2026, 11, 2, 9)
    b = bill(w, s["account"]["id"], "2026-10-01", "2026-10-31")
    # transition: 21 weekdays x 17:00-22:00 = 105; 31 x 24 + 1 (25.10.2026 has 25 hours) = 745 hours in all
    assert band_kwh(b) == {"offpeak": "640.00", "peak": "105.00"} and b["kwh"] == "745.00"
    assert [ln["hours"] for ln in b["snapshot"]["lines"]] == ["640.00", "105.00"]
    assert b["snapshot"]["period"]["start_utc"] == "2026-09-30T21:00:00Z" and b["snapshot"]["period"]["end_utc"] == "2026-10-31T22:00:00Z"
    day25 = next(d for d in b["snapshot"]["tou"]["daily"] if d["date"] == "2026-10-25")
    assert day25["kwh"] == "25.00"
    # the Shemini Atzeret holiday (Saturday 3.10) and its eve (Friday 2.10) are listed in the note
    note = next(n for n in b["snapshot"]["notes"] if n["code"] == "tou_special_days")
    assert "03.10.2026 שמיני עצרת ושמחת תורה" in note["text_he"] and "02.10.2026 הושענא רבה" in note["text_he"]


def test_spring_dst_month_has_743_hours(w):
    hourly(w, "m1", loc(2026, 3, 1), loc(2026, 4, 2))
    s = setup_tou(w)
    b = bill(w, s["account"]["id"], "2026-03-01", "2026-03-31")
    # 23 weekdays x 5 h = 115; 31 x 24 - 1 (27.3.2026 has 23 hours) = 743
    assert band_kwh(b) == {"offpeak": "628.00", "peak": "115.00"} and b["kwh"] == "743.00"


def test_holidays_remove_the_peak_and_a_manual_override_is_recalculated(w):
    hourly(w, "m1", loc(2026, 4, 1), loc(2026, 5, 2))
    s = setup_tou(w)
    b = bill(w, s["account"]["id"], "2026-04-01", "2026-04-30")
    # 22 weekdays minus 1-2.4 (Pesach eve and day), 7-8.4 (seventh day and eve), 21-22.4 (Memorial Day, Independence Day)
    assert band_kwh(b) == {"offpeak": "640.00", "peak": "80.00"}
    days = {d["date"]: d for d in b["snapshot"]["tou"]["daily"]}
    assert days["2026-04-22"]["special"] == {"kind": "holiday", "name_he": "יום העצמאות"} and days["2026-04-22"]["day_type"] == "saturday"
    assert len([x for x in b["snapshot"]["tou"]["special_days"] if x["kind"] != "regular"]) == 6
    # the manager decides Independence Day is a regular day for this tariff: the draft is flagged, then recalculated
    cal = w.c.get(f"{API}/calendar", params={"year": 2026}).json()
    r = w.c.put(f"{API}/calendar/days/2026-04-22", json={"kind": "regular", "name_he": "לא חג בתעריף", "base_revision": cal["revision"]})
    assert r.status_code == 200, r.text
    assert r.json()["drafts_to_recalculate"] == 1
    again = w.c.post(f"{API}/bills/{b['id']}/recalculate", json={"row_version": b["row_version"]})
    assert again.status_code == 200, again.text
    assert band_kwh(again.json()) == {"offpeak": "635.00", "peak": "85.00"}
    stale = w.c.put(f"{API}/calendar/days/2026-04-23", json={"kind": "holiday", "base_revision": cal["revision"]})
    assert stale.status_code == 409 and stale.json()["code"] == "revision_conflict"


def test_winter_peak_applies_on_every_day_type(w):
    hourly(w, "m1", loc(2026, 12, 1), loc(2027, 1, 2))
    s = setup_tou(w)
    w.clock.at = utc(2027, 1, 2, 9)
    b = bill(w, s["account"]["id"], "2026-12-01", "2026-12-31")
    assert band_kwh(b) == {"offpeak": "589.00", "peak": "155.00"}  # 31 days x 17:00-22:00
    peak = next(ln for ln in b["snapshot"]["lines"] if ln["band"]["id"] == "peak")
    assert peak["amount_ex_vat"] == "186.00" and peak["season"]["id"] == "winter"


# ---------------------------------------------------------------- boundaries inside a period

def test_season_change_inside_an_adhoc_period(w):
    hourly(w, "m1", loc(2026, 9, 15), loc(2026, 10, 16))
    s = setup_tou(w)
    w.clock.at = utc(2026, 10, 16, 9)
    b = bill(w, s["account"]["id"], "2026-09-15", "2026-10-14")
    # summer 15-30.9: 10 weekdays x 6 h (20.9 Yom Kippur eve, 21.9 Yom Kippur, 25.9 Sukkot eve are not weekdays);
    # transition 1-14.10: 10 weekdays x 5 h
    assert [(x[0], x[1], x[2]) for x in lines(b)] == [("summer", "offpeak", "324.00"), ("summer", "peak", "60.00"),
                                                      ("transition", "offpeak", "286.00"), ("transition", "peak", "50.00")]
    assert {ln["from"] for ln in b["snapshot"]["lines"]} == {"2026-09-15"}  # one price piece: the season is not a split


def test_tariff_version_and_vat_change_split_the_period(w):
    hourly(w, "m1", loc(2026, 7, 1), loc(2026, 8, 2))
    s = setup_tou(w)
    july_prices = copy.deepcopy(PRICES)
    july_prices["summer"] = {"offpeak": "0.5500", "peak": "1.7000"}
    r = w.c.post(f"{API}/tariffs/{s['tariff']['id']}/versions", json={"effective_from": "2026-07-15", "definition": definition(july_prices), "price_mode": "ex_vat"})
    assert r.status_code == 201, r.text
    assert w.c.post(f"{API}/vat-rates", json={"effective_from": "2026-07-20", "rate_percent": "17"}).status_code == 201
    b = bill(w, s["account"]["id"], *JULY)
    got = [(ln["from"], ln["to"], ln["band"]["id"], ln["kwh"], ln["price_entered"], ln["vat_rate_percent"]) for ln in b["snapshot"]["lines"]]
    # 1-14.7: 10 weekdays; 15-19.7: 3 weekdays; 20-31.7: 9 weekdays (6 peak hours each)
    assert got == [("2026-07-01", "2026-07-14", "offpeak", "276.00", "0.5000", "18"), ("2026-07-01", "2026-07-14", "peak", "60.00", "1.6895", "18"),
                   ("2026-07-15", "2026-07-19", "offpeak", "102.00", "0.5500", "18"), ("2026-07-15", "2026-07-19", "peak", "18.00", "1.7000", "18"),
                   ("2026-07-20", "2026-07-31", "offpeak", "234.00", "0.5500", "17"), ("2026-07-20", "2026-07-31", "peak", "54.00", "1.7000", "17")]
    assert [x["rate_percent"] for x in b["snapshot"]["totals"]["vat_breakdown"]] == ["18", "17"]
    assert any(n["code"] == "period_split" for n in b["snapshot"]["notes"])
    assert len(b["snapshot"]["tou"]["versions"]) == 2
    # line amounts: the bill total is the sum of the rounded lines
    total = sum(D(ln["total"]) for ln in b["snapshot"]["lines"])
    assert str(total) == b["snapshot"]["totals"]["total"]


def test_a_meter_that_stopped_reporting_is_billed_to_its_last_report(w):
    hourly(w, "m1", loc(2026, 7, 1), loc(2026, 8, 2))
    w.r.m["m1"].last_report = loc(2026, 7, 20, 12)
    s = setup_tou(w)
    w.clock.at = utc(2026, 8, 2, 9)
    b = bill(w, s["account"]["id"], *JULY)
    # 1-19.7: 13 weekdays x 6 h = 78 peak; 19 x 24 + 12 = 468 hours in all
    assert band_kwh(b) == {"offpeak": "390.00", "peak": "78.00"}
    assert [n["code"] for n in b["snapshot"]["notes"]] == ["meter_not_reporting"]
    assert b["snapshot"]["meters"][0]["end"]["kind"] == "last_report"


def test_energy_carried_from_the_previous_bill_is_priced_by_its_own_hours(w):
    hourly(w, "m1", loc(2026, 6, 1), loc(2026, 8, 2))
    w.r.m["m1"].last_report = loc(2026, 6, 30, 10)  # the June bill stops at 30.6 10:00
    s = setup_tou(w)
    w.clock.at = utc(2026, 7, 2, 9)
    june = issue(w, bill(w, s["account"]["id"], "2026-06-01", "2026-06-30"))
    assert june.status_code == 200, june.text
    w.r.m["m1"].last_report = None
    w.clock.at = utc(2026, 8, 2, 9)
    b = bill(w, s["account"]["id"], *JULY)
    # carried 30.6 10:00-24:00 (a Tuesday): 17:00-23:00 peak = 6 kWh, the other 8 hours off-peak
    assert band_kwh(b) == {"offpeak": "620.00", "peak": "138.00"}
    assert [ln["hours"] for ln in b["snapshot"]["lines"]] == ["612.00", "132.00"]  # hours stay the period's own
    m = b["snapshot"]["meters"][0]
    assert m["carried_in_kwh"] == "14.00" and m["consumption_kwh"] == "758.00" and m["start"]["kind"] == "carried"
    assert any(n["code"] == "carried_in" for n in b["snapshot"]["notes"])


def test_sub_meter_formula_and_a_negative_band(w):
    hourly(w, "m1", loc(2026, 7, 1), loc(2026, 8, 2), load=lambda t: 2000)
    hourly(w, "m2", loc(2026, 7, 1), loc(2026, 8, 2), load=lambda t: 1000, wh=50_000)
    s = setup_tou(w, formula="[לוח ראשי] - [מזגן לובי]")
    b = bill(w, s["account"]["id"], *JULY)
    assert band_kwh(b) == {"offpeak": "612.00", "peak": "132.00"} and b["total"] == "624.23"
    assert [m["contribution_kwh"] for m in b["snapshot"]["meters"]] == ["1488.00", "-744.00"]
    neg = setup_tou(w, formula="[מזגן לובי] - [לוח ראשי]")
    r = draft(w, neg["account"]["id"], {"from": JULY[0], "to": JULY[1]})
    assert r.status_code == 422 and r.json()["code"] == "formula_negative"
    assert r.json()["details"]["band"] == "offpeak" and "שפל" in r.json()["user_message"]


class _DailyOnly(FakeReadings):
    """A store whose quarter-hour data is gone: only local-midnight edges can be answered (energy_store._from_daily)."""

    def consumption(self, meter_id, start, end):
        for t in (start, end):
            if t.astimezone(TZ).time() != dt.time(0, 0):
                raise ValueError("edge_not_day_aligned")
        return super().consumption(meter_id, start, end)


def test_time_of_use_needs_quarter_hour_data(w):
    old = _DailyOnly()
    old.m = w.r.m
    from smplwise.services.energy_billing_provider import set_provider

    set_provider(old)
    hourly(w, "m1", loc(2026, 7, 1), loc(2026, 8, 2))
    s = setup_tou(w)
    r = draft(w, s["account"]["id"], {"from": JULY[0], "to": JULY[1]})
    assert r.status_code == 422 and r.json()["code"] == "tou_needs_interval_data", r.text


def test_a_long_reporting_gap_across_bands_gets_a_note(w):
    w.r.read("m1", loc(2026, 7, 1), 1_000_000)
    w.r.read("m1", loc(2026, 7, 2, 12), 1_036_000)  # 36 h without a report: spread evenly over peak and off-peak hours
    hourly(w, "m1", loc(2026, 7, 2, 13), loc(2026, 8, 2), wh=1_037_000)
    s = setup_tou(w)
    b = bill(w, s["account"]["id"], *JULY)
    notes = [n for n in b["snapshot"]["notes"] if n["code"] == "tou_spread_gap"]
    assert len(notes) == 1 and "01.07.2026 00:00" in notes[0]["text_he"] and "02.07.2026 12:00" in notes[0]["text_he"]


# ---------------------------------------------------------------- tariffs: validation, listing, corrections

def test_definition_validation_and_kinds(w):
    c = w.c
    t = tou.israel_template()  # prices are empty
    r = c.post(f"{API}/tariffs", json={"name": "x", "kind": "tou", "definition": t, "price_mode": "ex_vat", "effective_from": "2026-01-01"})
    assert r.status_code == 422 and r.json()["code"] == "tariff_definition_invalid" and r.json()["details"]["fields"][0].startswith("definition.prices.")
    assert c.post(f"{API}/tariffs", json={"name": "x", "kind": "tou", "price": "0.5", "definition": definition(), "effective_from": "2026-01-01"}).status_code == 422
    assert c.post(f"{API}/tariffs", json={"name": "x", "price": "0.5", "definition": definition(), "effective_from": "2026-01-01"}).status_code == 422
    assert c.post(f"{API}/tariffs", json={"name": "x", "kind": "tou", "effective_from": "2026-01-01"}).status_code == 422
    s = setup_tou(w)
    tid = s["tariff"]["id"]
    v = s["tariff"]["versions"][0]
    assert s["tariff"]["kind"] == "tou" and v["price"] is None and v["definition"]["prices"] == PRICES and len(v["definition_sha256"]) == 64
    assert c.post(f"{API}/tariffs/{tid}/versions", json={"effective_from": "2026-09-01", "price": "0.6"}).status_code == 422  # one kind per tariff
    acc = c.get(f"{API}/accounts/{s['account']['id']}").json()
    assert acc["tariff"]["kind"] == "tou" and acc["tariff"]["price"] is None and acc["tariff"]["price_mode"] == "ex_vat"
    # the template and the check endpoint (the editor's preview, also before the prices are typed)
    tpl = c.get(f"{API}/tou/templates").json()["items"][0]
    assert tpl["id"] == "israel_household" and tpl["definition"] == tou.israel_template() and "לא אומת" in tpl["source_he"]
    chk = c.post(f"{API}/tou/check", json={"definition": tpl["definition"]}).json()
    assert chk["ok"] is False and chk["errors"][0]["code"] == "price" and chk["grid"]["summer"]["weekday"][1] == {"from": "17:00", "to": "23:00", "band": "peak"}
    ok = c.post(f"{API}/tou/check", json={"definition": definition()}).json()
    assert ok["ok"] is True and ok["definition_sha256"] == v["definition_sha256"] and ok["grid"]["winter"]["saturday"][1]["band"] == "peak"
    bad = c.post(f"{API}/tou/check", json={"definition": {**definition(), "seasons": definition()["seasons"][:2]}}).json()
    assert bad["ok"] is False and bad["errors"][0]["code"] == "season_gap" and bad["grid"] is None


def test_correcting_a_tou_version_never_touches_a_sealed_bill(w):
    hourly(w, "m1", loc(2026, 7, 1), loc(2026, 9, 2))
    s = setup_tou(w)
    tid, v1 = s["tariff"]["id"], s["tariff"]["versions"][0]
    w.clock.at = utc(2026, 8, 2, 9)
    sealed = issue(w, bill(w, s["account"]["id"], *JULY)).json()
    aug = bill(w, s["account"]["id"], "2026-08-01", "2026-08-31")  # a draft of the running period (preview)
    fixed = copy.deepcopy(PRICES)
    fixed["summer"]["peak"] = "1.5000"
    body = {"effective_from": "2026-01-01", "definition": definition(fixed), "price_mode": "ex_vat", "replace_version_id": v1["id"],
            "base": {"effective_from": "2026-01-01", "definition_sha256": v1["definition_sha256"], "price_mode": "ex_vat"}}
    plan = w.c.post(f"{API}/tariffs/{tid}/versions", json=body)
    assert plan.status_code == 200 and plan.json()["applied"] is False
    p = plan.json()["plan"]
    assert p["kind"] == "later_only" and p["applies_from"] == "2026-08-01" and p["drafts"] == 1
    stale = w.c.post(f"{API}/tariffs/{tid}/versions", json={**body, "base": {**body["base"], "definition_sha256": "0" * 64}, "confirm": True})
    assert stale.status_code == 409 and stale.json()["code"] == "revision_conflict"
    done = w.c.post(f"{API}/tariffs/{tid}/versions", json={**body, "confirm": True})
    assert done.status_code == 200 and done.json()["drafts"] == {"recomputed": 1, "failed": []}
    vs = done.json()["versions"]
    assert [x["effective_from"] for x in vs] == ["2026-01-01", "2026-08-01"] and vs[0]["definition_sha256"] == v1["definition_sha256"]
    assert w.c.get(f"{API}/bills/{sealed['id']}").json()["snapshot"] == sealed["snapshot"]
    recomputed = w.c.get(f"{API}/bills/{aug['id']}").json()
    peak = next(ln for ln in recomputed["snapshot"]["lines"] if ln["band"]["id"] == "peak")
    assert peak["price_entered"] == "1.5000" and peak["tariff_version_id"] == vs[1]["id"]
    same = w.c.post(f"{API}/tariffs/{tid}/versions", json={"effective_from": "2026-08-01", "definition": definition(fixed), "price_mode": "ex_vat",
                                                           "replace_version_id": vs[1]["id"], "confirm": True})
    assert same.status_code == 409 and same.json()["code"] == "nothing_changed"
    # the version a sealed bill used can never be deleted
    assert w.c.delete(f"{API}/tariffs/{tid}/versions/{v1['id']}").status_code == 409


# ---------------------------------------------------------------- special days API

def test_calendar_api_and_permissions(w):
    c = w.c
    y = c.get(f"{API}/calendar", params={"year": 2026})
    assert y.status_code == 200
    body = y.json()
    assert body["generator"] == "israel" and body["revision"] == 0 and "לאשר" in body["note_he"]
    assert {d["date"]: d["kind"] for d in body["days"]}["2026-09-21"] == "holiday"
    r = c.put(f"{API}/calendar/days/2026-11-10", json={"kind": "holiday", "name_he": "יום חג מקומי"})
    assert r.status_code == 200 and r.json()["revision"] == 1
    day = next(d for d in r.json()["days"] if d["date"] == "2026-11-10")
    assert day == {"date": "2026-11-10", "kind": "holiday", "kind_he": "חג", "name_he": "יום חג מקומי", "source": "manual", "generated": None}
    over = c.put(f"{API}/calendar/days/2026-04-22", json={"kind": "regular"}).json()
    ind = next(d for d in over["days"] if d["date"] == "2026-04-22")
    assert ind["kind"] == "regular" and ind["generated"]["name_he"] == "יום העצמאות"
    assert c.delete(f"{API}/calendar/days/2026-04-22").status_code == 200
    assert c.delete(f"{API}/calendar/days/2026-04-22").status_code == 404
    assert c.put(f"{API}/calendar/days/1990-01-01", json={"kind": "holiday"}).status_code == 422
    assert c.get(f"{API}/calendar", params={"year": 1900}).status_code == 422
    off = c.put(f"{API}/calendar/settings", json={"generator": "none"}, params={"year": 2026}).json()
    assert off["generator"] == "none" and [d["date"] for d in off["days"]] == ["2026-11-10"]
    # the generic settings route neither shows nor accepts the calendar document
    gen = c.get(f"{API}/settings")
    assert gen.status_code == 200 and "energy.calendar" not in gen.text
    assert c.patch(f"{API}/settings", json={"energy.calendar": {"generator": "israel"}}).status_code == 422
    bind(c, w.settings, "op", "operator", "installation", "*")
    h = as_user("op")
    assert c.get(f"{API}/calendar", headers=h).status_code == 200
    assert c.put(f"{API}/calendar/days/2026-11-11", json={"kind": "holiday"}, headers=h).status_code == 403
    assert c.put(f"{API}/calendar/settings", json={"generator": "israel"}, headers=h).status_code == 403
    assert c.post(f"{API}/tou/check", json={"definition": definition()}, headers=h).status_code == 403


# ---------------------------------------------------------------- the REAL readings store

def test_real_store_tou_bill_reads_once_per_meter_and_needs_quarter_hours(settings, monkeypatch):
    from fastapi.testclient import TestClient

    from smplwise.db import Database
    from smplwise.main import create_app
    from smplwise.services import energy_billing as eb
    from smplwise.services import energy_billing_pdf as pdfseam
    from smplwise.services import energy_provider as ep
    from smplwise.services import energy_store as st
    from smplwise.services.energy_billing_provider import set_provider
    from test_energy_store import add_meter, feed

    set_provider(None)  # the real store through the adapter
    pdfseam.set_renderer(None)
    monkeypatch.setattr(eb, "now_utc", lambda: dt.datetime(2026, 10, 2, 9, 0, tzinfo=dt.timezone.utc))
    monkeypatch.setattr(eb, "AUTO_EVERY_S", 10**9)
    c = TestClient(create_app(settings))
    assert c.get("/api/v1/me").status_code == 200
    db = Database(settings.db_path)
    store = st.store_for(settings)
    mid = add_meter(db, "לוח ראשי")
    pts, v, t = [], 1_000_000, dt.datetime(2026, 3, 1, tzinfo=TZ)
    while t <= dt.datetime(2026, 8, 1, 1, tzinfo=TZ):
        pts.append((t, v))
        v += 3000 if 17 <= t.hour < 23 else 1000  # per hour: 3 kW in the evening, 1 kW otherwise
        t = (t.astimezone(dt.timezone.utc) + dt.timedelta(hours=1)).astimezone(TZ)
    feed(store, mid, pts)
    tt = c.post(f"{API}/tariffs", json={"name": "תעו״ז", "kind": "tou", "definition": definition(), "price_mode": "ex_vat", "effective_from": "2026-01-01"})
    assert tt.status_code == 201, tt.text
    assert c.post(f"{API}/vat-rates", json={"effective_from": "2025-01-01", "rate_percent": "18"}).status_code == 201
    cust = c.post(f"{API}/customers", json={"name": "לקוח בדיקה"}).json()
    acc = c.post(f"{API}/accounts", json={"name": "דירה", "customer_id": cust["id"], "formula": {"text": "[לוח ראשי]"}, "tariff_id": tt.json()["id"],
                                          "period_months": 1, "period_anchor_day": 1, "first_period_start": "2026-03-01", "auto_mode": "off"}).json()
    calls = {"one": 0, "many": 0}
    one, many = ep.EnergyProvider.consumption, ep.EnergyProvider.consumption_windows

    def count_one(self, *a, **k):
        calls["one"] += 1
        return one(self, *a, **k)

    def count_many(self, *a, **k):
        calls["many"] += 1
        return many(self, *a, **k)

    monkeypatch.setattr(ep.EnergyProvider, "consumption", count_one)
    monkeypatch.setattr(ep.EnergyProvider, "consumption_windows", count_many)
    r = c.post(f"{API}/accounts/{acc['id']}/bills", json={"period": {"from": "2026-07-01", "to": "2026-07-31"}, "client_request_id": rid()})
    assert r.status_code == 201, r.text
    b = r.json()
    assert band_kwh(b) == {"offpeak": "720.00", "peak": "396.00"} and b["kwh"] == "1116.00"  # as with the fake store
    assert calls["many"] == 1, "one batched read for all band segments of the meter"
    # quarter-hour data kept 3 months only: March is beyond it, so a TOU bill is refused (a fixed bill would use daily totals)
    assert c.patch(f"{API}/settings", json={"energy.interval_retention_months": 3}).status_code == 200
    old = c.post(f"{API}/accounts/{acc['id']}/bills", json={"period": {"from": "2026-03-01", "to": "2026-03-31"}, "client_request_id": rid()})
    assert old.status_code == 422 and old.json()["code"] == "tou_needs_interval_data", old.text


# ---------------------------------------------------------------- the PDF of a TOU bill

def test_pdf_model_and_html_of_a_tou_bill(w):
    hourly(w, "m1", loc(2026, 4, 1), loc(2026, 5, 2))
    s = setup_tou(w)
    b = bill(w, s["account"]["id"], "2026-04-01", "2026-04-30")
    model = bill_pdf_model.BillSnapshot.from_billing_snapshot(b["snapshot"])
    assert [c.label for c in model.charges] == ["צריכת חשמל - שפל (מעבר)", "צריכת חשמל - פסגה (מעבר)"]
    assert model.charges[1].hours == D("80.00") and model.tou_bands == ("שפל", "פסגה")
    assert len(model.tou_daily) == 30 and model.tou_daily[21].marker == "יום העצמאות" and model.tou_daily[21].kwh == (D("24.00"), None)
    html = bill_pdf_html.build_html(model, False)
    assert "צריכת חשמל - פסגה (מעבר)" in html and "פירוט יומי לפי שעות" in html and html.count("<tr>") >= 30 + 2
    fixed = copy.deepcopy(b["snapshot"])
    fixed.pop("tou")
    for ln in fixed["lines"]:
        ln.pop("band"), ln.pop("season"), ln.pop("hours")
    plain = bill_pdf_model.BillSnapshot.from_billing_snapshot(fixed)
    assert plain.tou_daily == () and all(c.label == "צריכת חשמל" for c in plain.charges)
    assert "פירוט יומי" not in bill_pdf_html.build_html(plain, False)


def test_pdf_renders_a_tou_bill_with_the_real_engine(w):
    """The whole render pipeline (WeasyPrint in its sandboxed process) on a 2-month TOU bill with its daily table; the text is
    read back with poppler. Skipped where WeasyPrint/poppler are not installed (the add-on image and the runner have them)."""
    import shutil
    import subprocess

    pytest.importorskip("weasyprint")
    if not all(shutil.which(t) for t in ("pdftotext", "pdfinfo")):
        pytest.skip("poppler-utils not installed")
    from smplwise.services.bill_pdf import render_bill_pdf

    hourly(w, "m1", loc(2026, 3, 1), loc(2026, 5, 2))
    s = setup_tou(w)
    b = bill(w, s["account"]["id"], "2026-03-01", "2026-04-30")
    pdf = render_bill_pdf(b["snapshot"])
    text = " ".join(subprocess.run(["pdftotext", "-", "-"], input=pdf, capture_output=True, check=True).stdout.decode().split())
    pages = int(next(ln.split(":")[1] for ln in subprocess.run(["pdfinfo", "-"], input=pdf, capture_output=True, check=True).stdout.decode().splitlines()
                     if ln.startswith("Pages:")))
    assert "פסגה" in text and "שפל" in text and "פירוט יומי לפי שעות" in text and "22.04.2026" in text
    assert 2 <= pages <= 6


def test_pdf_fallback_engine_renders_a_tou_bill(w):
    pytest.importorskip("fpdf")
    pytest.importorskip("uharfbuzz")
    from smplwise.services import bill_pdf_engine

    hourly(w, "m1", loc(2026, 7, 1), loc(2026, 8, 2))
    s = setup_tou(w)
    b = bill(w, s["account"]["id"], *JULY)
    data = bill_pdf_engine.render_fpdf2(bill_pdf_model.BillSnapshot.from_billing_snapshot(b["snapshot"]), None)
    assert data.startswith(b"%PDF") and len(data) > 5000
