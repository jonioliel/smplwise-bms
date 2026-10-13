"""CR-038 slice 9, section 11A.4: the arithmetic of a cost claim (services/tickets/money.py) - integers in minor units only,
per-line half-up rounding, VAT excluded / included / none, caps, and the refusal of floats."""
from __future__ import annotations

import pytest

from smplwise.services.tickets import money
from smplwise.services.tickets.money import MoneyError


@pytest.mark.parametrize("text,minor", [("0", 0), ("1", 100), ("1.5", 150), ("1.05", 105), ("12.50", 1250), ("999999999.99", 99999999999)])
def test_amounts_parse_to_minor_units(text, minor):
    assert money.parse_amount(text) == minor


@pytest.mark.parametrize("bad", [1.5, 2, None, "", "1.234", "-1", "1,5", "1e3", "0x10", " ", "1.", ".5", "1234567890"])
def test_amounts_refuse_floats_and_other_shapes(bad):
    with pytest.raises(MoneyError):
        money.parse_amount(bad)


def test_half_up_is_integer_and_rounds_halves_up():
    assert money.half_up_div(5, 10) == 1
    assert money.half_up_div(4, 10) == 0
    assert money.half_up_div(15, 10) == 2
    assert money.half_up_div(25, 10) == 3
    assert money.half_up_div(0, 7) == 0


@pytest.mark.parametrize("text,q", [("0.25", 1), ("1", 4), ("1.5", 6), ("1.75", 7), ("200", 800)])
def test_hours_are_quarter_hours(text, q):
    assert money.parse_hours(text) == q


@pytest.mark.parametrize("bad,code", [("0", "range"), ("0.1", "quarter_hours"), ("1.33", "quarter_hours"), ("200.25", "range"), ("abc", "format")])
def test_hours_refusals(bad, code):
    with pytest.raises(MoneyError) as e:
        money.parse_hours(bad)
    assert e.value.code == code


def test_line_totals_round_per_line():
    labor = money.parse_line({"kind": "labor", "hours": "1.25", "rate": "33.33"}, 0)
    assert labor.total_minor == 4166  # 1.25 x 33.33 = 41.6625 -> 41.66
    parts = money.parse_line({"kind": "parts", "description": "פילטר", "quantity": "3", "unit_price": "0.335"[:4]}, 1)
    assert parts.total_minor == 99  # 3 x 0.33
    parts2 = money.parse_line({"kind": "parts", "description": "צינור", "quantity": "0.5", "unit_price": "0.05"}, 2)
    assert parts2.total_minor == 3  # 0.5 x 0.05 = 0.025 -> 0.03 (half up)
    other = money.parse_line({"kind": "other", "description": "אגרה", "amount": "12.00"}, 3)
    assert other.total_minor == 1200


def test_line_refusals():
    with pytest.raises(MoneyError) as e:
        money.parse_line({"kind": "other", "amount": "1"}, 0)
    assert e.value.field == "lines.0.description" and e.value.code == "required"
    with pytest.raises(MoneyError) as e:
        money.parse_line({"kind": "labor", "hours": "1", "rate": "1", "total": "999"}, 1)
    assert e.value.code == "unknown_key"  # a client total is not even accepted
    with pytest.raises(MoneyError):
        money.parse_line({"kind": "bribe", "amount": "1"}, 2)
    with pytest.raises(MoneyError) as e:
        money.parse_line({"kind": "parts", "description": "x" * 121, "quantity": "1", "unit_price": "1"}, 3)
    assert e.value.code == "too_long"


def test_descriptions_lose_hidden_characters_before_the_length_check():
    ln = money.parse_line({"kind": "other", "description": "‮מסנן​", "amount": "1"}, 0)
    assert ln.description == "מסנן"


def test_vat_excluded_included_and_none():
    assert money.vat_of(10000, "excluded", 1800) == (1800, 11800, 10000)
    vat, total, net = money.vat_of(11800, "included", 1800)
    assert (vat, total, net) == (1800, 11800, 10000)
    vat, total, net = money.vat_of(100, "included", 1800)  # 100 x 18/118 = 15.25 -> 15
    assert (vat, total, net) == (15, 100, 85)
    assert money.vat_of(12345, "none", 1800) == (0, 12345, 12345)
    assert money.vat_of(12345, "excluded", 0) == (0, 12345, 12345)
    assert money.vat_of(1, "excluded", 1800) == (0, 1, 1)  # 0.18 -> 0


def test_compute_sums_per_kind_and_caps_the_total():
    lines = money.parse_lines([
        {"kind": "labor", "hours": "2", "rate": "150"},
        {"kind": "parts", "description": "מדחס", "quantity": "1", "unit_price": "800"},
        {"kind": "travel", "amount": "50"},
        {"kind": "other", "description": "פינוי", "amount": "25.5"},
    ])
    c = money.compute(lines, "excluded", 1800)
    assert c.by_kind == {"labor": 30000, "parts": 80000, "travel": 5000, "other": 2550}
    assert c.subtotal_minor == 117550 and c.vat_minor == 21159 and c.total_minor == 138709 and c.net_minor == 117550
    with pytest.raises(MoneyError) as e:
        money.compute(lines, "excluded", 1800, max_total_minor=100000)
    assert e.value.code == "claim_too_large"


def test_at_most_thirty_lines():
    with pytest.raises(MoneyError) as e:
        money.parse_lines([{"kind": "travel", "amount": "1"}] * 31)
    assert e.value.code == "too_many"


def test_vat_mode_for_exempt_and_no_charge():
    assert money.vat_mode_for(vat_exempt=True, amounts_include_vat=True, no_charge=False) == "none"
    assert money.vat_mode_for(vat_exempt=False, amounts_include_vat=None, no_charge=True) == "none"
    assert money.vat_mode_for(vat_exempt=False, amounts_include_vat=True, no_charge=False) == "included"
    assert money.vat_mode_for(vat_exempt=False, amounts_include_vat=False, no_charge=False) == "excluded"


def test_formatting_round_trips():
    assert money.format_minor(138709) == "1387.09" and money.format_minor(5) == "0.05" and money.format_minor(0) == "0.00"
    assert money.format_hours(6) == "1.50" and money.format_hours(4) == "1"
    assert money.format_quantity(1500) == "1.5" and money.format_quantity(2000) == "2"
    ln = money.parse_line({"kind": "labor", "hours": "1.5", "rate": "10"}, 0)
    assert money.line_from_json(ln.as_json()) == ln


def test_no_float_anywhere_in_a_computation():
    lines = money.parse_lines([{"kind": "labor", "hours": "0.25", "rate": "0.01"}, {"kind": "parts", "description": "x", "quantity": "0.001", "unit_price": "0.01"}])
    c = money.compute(lines, "included", 1700)
    for v in (c.subtotal_minor, c.vat_minor, c.total_minor, c.net_minor, *c.by_kind.values(), *(ln.total_minor for ln in c.lines)):
        assert type(v) is int
