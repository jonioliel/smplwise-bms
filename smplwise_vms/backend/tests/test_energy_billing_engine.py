"""CR-023 P2 engines without the API: the formula parser, periods, prices/VAT/rounding, payment terms and the time allocation
of consumption (fakes only)."""
from __future__ import annotations

import datetime as dt
from decimal import Decimal

import pytest

from energy_billing_world import FakeReadings, utc
from smplwise.services import energy_formula as fx
from smplwise.services import energy_periods as per
from smplwise.services import energy_pricing as px
from smplwise.services.energy_consumption import meter_window

NAMES = {"m1": "לוח ראשי", "m2": "מזגן לובי", "m3": "תאורה"}
D = Decimal


# ---------------------------------------------------------------- formula

def comp(text: str):
    return fx.compile_formula(fx.parse_text(text, NAMES), known=NAMES)


def test_formula_text_precedence_percent_and_division():
    c = comp("[לוח ראשי] + 30% * [מזגן לובי] - ([תאורה] / 2)")
    assert c.coefficients == {"m1": D(1), "m2": D("0.30"), "m3": D("-0.5")}
    assert c.evaluate({"m1": D(1000), "m2": D(100), "m3": D(10)}) == D("1025")
    # by id, unicode operators, unary minus inside parentheses
    c2 = comp("[m1] − (−[m2]) × 2")
    assert c2.coefficients == {"m1": D(1), "m2": D(2)}


def test_formula_errors_are_codes_never_eval():
    cases = {
        "": "empty", "   ": "empty", "[לוח ראשי] +": "syntax", "([לוח ראשי] + [תאורה]": "unbalanced", "[לוח ראשי])": "unbalanced",
        "[לא קיים]": "unknown_meter", "[לוח ראשי] * [תאורה]": "nonlinear", "2 / [לוח ראשי]": "nonlinear",
        "[לוח ראשי] / 0": "division_by_zero", "[לוח ראשי] + 5": "constant_term", "3 * 4": "no_meter",
        "__import__('os').system('x')": "syntax", "[לוח ראשי] + 1.2.3": "syntax", "[לוח": "unbalanced",
    }
    for text, code in cases.items():
        with pytest.raises(fx.FormulaError) as e:
            fx.compile_formula(fx.parse_text(text, NAMES), known=NAMES)
        assert e.value.code == code, (text, e.value.code)
    with pytest.raises(fx.FormulaError) as e:
        fx.parse_text("[a]+" * 1000, NAMES)
    assert e.value.code == "too_long"
    with pytest.raises(fx.FormulaError):
        fx.parse_text("(" * 40 + "[m1]" + ")" * 40, NAMES)


def test_formula_ast_is_validated_and_rename_safe():
    with pytest.raises(fx.FormulaError):
        fx.validate_ast({"op": "**", "args": [{"m": "m1"}, {"n": "2"}]})
    with pytest.raises(fx.FormulaError):
        fx.validate_ast({"m": "m1", "extra": 1})
    with pytest.raises(fx.FormulaError):
        fx.validate_ast({"n": "-1"})
    ast = fx.parse_text("[לוח ראשי] - [מזגן לובי]", NAMES)
    assert ast == {"op": "-", "args": [{"m": "m1"}, {"m": "m2"}]}
    renamed = {**NAMES, "m1": "ראשי חדש"}
    assert fx.to_text(ast, renamed) == "[ראשי חדש] - [מזגן לובי]"
    assert fx.sentence_he(ast, renamed) == "ראשי חדש פחות מזגן לובי"
    # round trip of a nested formula through text
    ast2 = fx.parse_text("[לוח ראשי] - ([מזגן לובי] - [תאורה]) * 2", NAMES)
    again = fx.parse_text(fx.to_text(ast2, NAMES), NAMES)
    assert fx.compile_formula(again).coefficients == fx.compile_formula(ast2).coefficients


def test_formula_presets_and_duplicate_warning():
    assert fx.compile_formula(fx.preset("sum", ["m1", "m2", "m3"])).coefficients == {"m1": D(1), "m2": D(1), "m3": D(1)}
    assert fx.compile_formula(fx.preset("main_minus_subs", ["m2", "m1", "m3"], "m1")).coefficients == {"m1": D(1), "m2": D(-1), "m3": D(-1)}
    assert fx.compile_formula(fx.preset("share", ["m2"], percent="30")).coefficients == {"m2": D("0.3")}
    c = fx.compile_formula(fx.parse_text("[m1] + [m1] - [m2]", NAMES))
    assert c.coefficients["m1"] == 2 and [w["code"] for w in c.warnings] == ["duplicate_meter"]


# ---------------------------------------------------------------- periods

def cyc(months=1, day=1, month=1, first=dt.date(2026, 1, 1)):
    return per.Cycle(months, day, month, first)


def test_monthly_periods_from_the_1st_and_the_15th():
    ps = per.regular_periods(cyc(), dt.date(2026, 4, 1))
    assert [(p.start.isoformat(), p.end.isoformat()) for p in ps] == [("2026-01-01", "2026-02-01"), ("2026-02-01", "2026-03-01"), ("2026-03-01", "2026-04-01")]
    p = per.period_containing(cyc(day=15, first=dt.date(2026, 1, 15)), dt.date(2026, 3, 3))
    assert (p.start, p.end, p.last_day) == (dt.date(2026, 2, 15), dt.date(2026, 3, 15), dt.date(2026, 3, 14))


def test_anchor_29_to_31_clamps_without_drifting_and_leap_years():
    c = cyc(day=31, first=dt.date(2027, 12, 31))
    ps = per.regular_periods(c, dt.date(2028, 6, 1))
    starts = [p.start.isoformat() for p in ps]
    assert starts[:4] == ["2027-12-31", "2028-01-31", "2028-02-29", "2028-03-31"]  # leap February, then back to the 31st
    assert ps[1].days == 29 and ps[2].days == 31
    c29 = cyc(day=29, first=dt.date(2026, 1, 29))
    assert [p.start.isoformat() for p in per.regular_periods(c29, dt.date(2026, 5, 1))] == ["2026-01-29", "2026-02-28", "2026-03-29"]
    feb = per.Period(dt.date(2028, 2, 1), dt.date(2028, 3, 1))
    assert feb.days == 29
    assert per.same_period_last_year(per.Period(dt.date(2028, 2, 29), dt.date(2028, 3, 29))) == per.Period(dt.date(2027, 2, 28), dt.date(2027, 3, 29))


def test_two_monthly_cycle_and_partial_first_period():
    c = cyc(months=2, day=1, month=1, first=dt.date(2026, 2, 10))
    ps = per.regular_periods(c, dt.date(2026, 8, 1))
    assert [(p.start.isoformat(), p.end.isoformat()) for p in ps] == [("2026-02-10", "2026-03-01"), ("2026-03-01", "2026-05-01"), ("2026-05-01", "2026-07-01")]
    prev = per.previous_like(ps[2], c, 3)
    assert [(p.start.isoformat(), p.end.isoformat()) for p in prev] == [("2025-11-01", "2026-01-01"), ("2026-01-01", "2026-03-01"), ("2026-03-01", "2026-05-01")]


def test_dst_days_are_real_hours_in_the_local_zone():
    oct_ = per.Period(dt.date(2026, 10, 1), dt.date(2026, 11, 1))
    a, b = per.utc_window(oct_, "Asia/Jerusalem")
    assert a == utc(2026, 9, 30, 21) and b == utc(2026, 10, 31, 22)  # DST ends on 25.10.2026
    assert (b - a) == dt.timedelta(hours=31 * 24 + 1)
    mar = per.Period(dt.date(2026, 3, 1), dt.date(2026, 4, 1))
    a, b = per.utc_window(mar, "Asia/Jerusalem")
    assert (b - a) == dt.timedelta(hours=31 * 24 - 1)
    with pytest.raises(ValueError):
        per.zone("Mars/Base")


# ---------------------------------------------------------------- prices, VAT, rounding

def piece(price="0.5430", mode="ex_vat", rate="18", start=dt.date(2026, 9, 1), end=dt.date(2026, 10, 1)):
    return px.Piece(start, end, px.PriceVersion("v", start, D(price), mode), px.VatRate("r", start, D(rate)))


def test_golden_bill_and_half_up_rounding():
    ln = px.line(piece(), D("776.20"))
    assert (str(ln.amount_ex_vat), str(ln.vat_amount), str(ln.total)) == ("421.48", "75.87", "497.35")
    t = px.totals([ln])
    assert (t["kwh"], t["amount_ex_vat"], t["vat_amount"], t["total"]) == ("776.20", "421.48", "75.87", "497.35")
    # half up, not banker's: 0.125 -> 0.13 ; kWh 0.005 -> 0.01
    assert px.r2(D("0.125")) == D("0.13") and px.r2(D("2.675")) == D("2.68") and px.r2(D("0.005")) == D("0.01")
    # kWh is rounded first, then amount = rounded kWh x price
    ln2 = px.line(piece(price="1.0000"), D("10.004999"))
    assert str(ln2.kwh) == "10.00" and str(ln2.amount_ex_vat) == "10.00"


def test_price_including_vat():
    ln = px.line(piece(price="0.6407", mode="inc_vat"), D("776.20"))
    assert str(ln.total) == "497.31"  # the customer pays exactly kWh x the typed price
    assert ln.amount_ex_vat + ln.vat_amount == ln.total
    assert str(ln.amount_ex_vat) == "421.45" and str(ln.unit_price_ex_vat) == "0.5430"
    assert px.totals([ln])["price_mode_note_he"] == "המחיר נקבע כולל מע״מ"


def test_vat_change_splits_the_period_and_vat_is_per_line():
    prices = [px.PriceVersion("p1", dt.date(2026, 1, 1), D("0.5"), "ex_vat")]
    vats = [px.VatRate("v17", dt.date(2025, 1, 1), D("17")), px.VatRate("v18", dt.date(2026, 9, 16), D("18"))]
    ps = px.pieces(dt.date(2026, 9, 1), dt.date(2026, 10, 1), prices, vats)
    assert [(p.start.day, p.vat.rate) for p in ps] == [(1, D(17)), (16, D(18))]
    lines = [px.line(ps[0], D("150")), px.line(ps[1], D("150"))]
    t = px.totals(lines)
    assert t["vat_amount"] == "26.25" and t["total"] == "176.25"  # 75 x 17% = 12.75 ; 75 x 18% = 13.50
    assert [b["rate_percent"] for b in t["vat_breakdown"]] == ["17", "18"]
    with pytest.raises(px.MissingRate) as e:
        px.pieces(dt.date(2026, 9, 1), dt.date(2026, 10, 1), prices, [])
    assert e.value.code == "vat_missing"
    with pytest.raises(px.MissingRate) as e:
        px.pieces(dt.date(2025, 12, 1), dt.date(2026, 1, 15), prices, vats)
    assert e.value.code == "tariff_missing" and e.value.day == dt.date(2025, 12, 1)


def test_price_and_rate_parsing():
    assert px.parse_price("0.543") == D("0.5430")
    for bad in ("0", "-1", "0.12345", "abc", "1e400", "NaN"):
        with pytest.raises(ValueError):
            px.parse_price(bad)
    assert px.parse_rate("17.5") == D("17.5")
    for bad in ("51", "-1", "1.234"):
        with pytest.raises(ValueError):
            px.parse_rate(bad)


def test_payment_terms_net_days_and_fixed_day():
    assert px.due_date(dt.date(2026, 11, 2), {"mode": "net_days", "days": 14}) == dt.date(2026, 11, 16)
    assert px.due_date(dt.date(2026, 11, 2), {"mode": "day_of_month", "day_of_month": 15}) == dt.date(2026, 11, 15)
    assert px.due_date(dt.date(2026, 11, 15), {"mode": "day_of_month", "day_of_month": 15}) == dt.date(2026, 12, 15)
    assert px.due_date(dt.date(2027, 2, 1), {"mode": "day_of_month", "day_of_month": 31}) == dt.date(2027, 2, 28)
    assert px.due_date(dt.date(2026, 12, 20), {"mode": "day_of_month", "day_of_month": 15}) == dt.date(2027, 1, 15)


# ---------------------------------------------------------------- consumption: time allocation, gaps, resets, carry

def test_boundary_segment_is_allocated_by_time():
    r = FakeReadings()
    r.add_meter("m", "מונה")
    r.read("m", utc(2026, 9, 30, 18), 1000)
    r.read("m", utc(2026, 10, 1, 0), 7000)  # 6 h segment crossing 21:00Z: 3 h before, 3 h after
    w1 = meter_window(r, "m", [utc(2026, 9, 1), utc(2026, 9, 30, 21)])
    w2 = meter_window(r, "m", [utc(2026, 9, 30, 21), utc(2026, 10, 31)])
    assert w1.wh == 3000 and w2.wh == 3000
    assert w1.end.kind == "interpolated" and w1.end.reading_wh == 4000
    assert w2.start.kind == "interpolated" and w2.start.reading_wh == 4000


def test_three_day_gap_loses_nothing_and_reset_counts_since_restart():
    r = FakeReadings()
    r.add_meter("m", "מונה")
    r.read("m", utc(2026, 9, 1), 0)
    r.read("m", utc(2026, 9, 10), 9000)
    r.read("m", utc(2026, 9, 13), 12000)  # 3-day gap: carried whole by the next reading
    r.read("m", utc(2026, 9, 14), 500, reset=True)  # counter restarted: 500 Wh since the restart
    r.read("m", utc(2026, 9, 20), 1500)
    w = meter_window(r, "m", [utc(2026, 9, 1), utc(2026, 9, 20)])
    assert w.wh == 9000 + 3000 + 500 + 1000
    assert w.resets == [utc(2026, 9, 14)]


def test_unreported_meter_bills_to_its_last_reading_and_the_rest_is_carried_once():
    r = FakeReadings()
    r.add_meter("m", "מונה")
    r.read("m", utc(2026, 9, 1), 0)
    r.read("m", utc(2026, 9, 25), 24000)
    a, b, c = utc(2026, 9, 1), utc(2026, 10, 1), utc(2026, 11, 1)
    w1 = meter_window(r, "m", [a, b])
    assert w1.wh == 24000 and w1.end.kind == "last_report" and w1.end.at == utc(2026, 9, 25)
    # the meter comes back after the boundary: the delta spans 25.9 -> 5.10
    r.read("m", utc(2026, 10, 5), 34000)
    r.read("m", utc(2026, 10, 31, 12), 40000)
    w2 = meter_window(r, "m", [b, c], carried_from=w1.end.at)
    assert w2.carried_in_wh == pytest.approx(D(10000) * D(6 * 24) / D(10 * 24))
    assert w1.wh + w2.wh == 40000  # nothing lost, nothing twice
    assert w2.start.kind == "carried"


def test_pieces_split_one_meter_by_time():
    r = FakeReadings()
    r.add_meter("m", "מונה")
    r.read("m", utc(2026, 9, 1), 0)
    r.read("m", utc(2026, 9, 21), 20000)
    w = meter_window(r, "m", [utc(2026, 9, 1), utc(2026, 9, 11), utc(2026, 9, 21)])
    assert w.pieces_wh == [D(10000), D(10000)]
