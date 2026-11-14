"""CR-023 P2 section 7 / owner decisions D0, D6, round 2 (Q4 = b, Q7, Q8): prices, VAT, rounding, payment terms.

Rounding (normative, docs/architecture/ELECTRICITY_BILL_SNAPSHOT.md section 3): ROUND_HALF_UP; kWh 2 places, unit prices 4,
money 2. Each line is rounded on its own (kWh, amount, VAT, total), then the totals are the sums of the rounded lines.
- price before VAT ("ex_vat"): amount = r2(kWh x price); vat = r2(amount x rate/100); total = amount + vat
- price including VAT ("inc_vat"): total = r2(kWh x price); amount = r2(total / (1 + rate/100)); vat = total - amount
A period is split at every date where the tariff version or the VAT rate changes; each part is one line."""
from __future__ import annotations

import calendar
import datetime as dt
from dataclasses import dataclass
from decimal import ROUND_HALF_UP, Decimal, InvalidOperation
from typing import Any

Q2 = Decimal("0.01")
Q3 = Decimal("0.001")
Q4 = Decimal("0.0001")
HUNDRED = Decimal(100)


def r2(x: Decimal) -> Decimal:
    return x.quantize(Q2, rounding=ROUND_HALF_UP)


def r3(x: Decimal) -> Decimal:
    return x.quantize(Q3, rounding=ROUND_HALF_UP)


def r4(x: Decimal) -> Decimal:
    return x.quantize(Q4, rounding=ROUND_HALF_UP)


def s2(x: Decimal) -> str:
    return str(r2(x))


def pct_str(x: Decimal) -> str:
    s = format(x.normalize(), "f")
    return s


def parse_price(value: str | int | float) -> Decimal:
    """A price per kWh as typed: > 0, at most 4 decimals, at most 1000."""
    try:
        d = Decimal(str(value).strip())
    except (InvalidOperation, AttributeError):
        raise ValueError("price") from None
    if not d.is_finite() or d <= 0 or d > 1000 or d != d.quantize(Q4):
        raise ValueError("price")
    return d.quantize(Q4)


def parse_rate(value: str | int | float) -> Decimal:
    """A VAT rate in percent: 0-50, at most 2 decimals."""
    try:
        d = Decimal(str(value).strip())
    except (InvalidOperation, AttributeError):
        raise ValueError("rate") from None
    if not d.is_finite() or d < 0 or d > 50 or d != d.quantize(Q2):
        raise ValueError("rate")
    return d


@dataclass(frozen=True)
class PriceVersion:
    id: str
    effective_from: dt.date
    price: Decimal
    mode: str  # ex_vat | inc_vat
    definition: Any = None  # EL5: an energy_tou.Definition for a time-of-use version (prices per season and band), else None


@dataclass(frozen=True)
class VatRate:
    id: str
    effective_from: dt.date
    rate: Decimal


class MissingRate(Exception):
    def __init__(self, code: str, day: dt.date):
        super().__init__(code)
        self.code = code
        self.day = day


def in_force(items, day: dt.date):
    best = None
    for it in items:
        if it.effective_from <= day and (best is None or it.effective_from > best.effective_from):
            best = it
    return best


@dataclass(frozen=True)
class Piece:
    start: dt.date
    end: dt.date  # exclusive
    price: PriceVersion
    vat: VatRate


def pieces(start: dt.date, end: dt.date, prices: list[PriceVersion], vats: list[VatRate]) -> list[Piece]:
    cuts = sorted({p.effective_from for p in prices if start < p.effective_from < end} | {v.effective_from for v in vats if start < v.effective_from < end})
    bounds = [start, *cuts, end]
    out: list[Piece] = []
    for a, b in zip(bounds, bounds[1:]):
        pv = in_force(prices, a)
        if pv is None:
            raise MissingRate("tariff_missing", a)
        vr = in_force(vats, a)
        if vr is None:
            raise MissingRate("vat_missing", a)
        out.append(Piece(a, b, pv, vr))
    return out


@dataclass(frozen=True)
class Line:
    piece: Piece
    kwh: Decimal  # rounded 2
    unit_price_ex_vat: Decimal
    amount_ex_vat: Decimal
    vat_amount: Decimal
    total: Decimal
    price_entered: Decimal | None = None  # EL5: the band price of a time-of-use line (None = the version's flat price)
    tou: dict | None = None  # EL5: {"season": {...}, "band": {...}, "hours": "..."} of a time-of-use line

    def as_dict(self) -> dict:
        p = self.piece
        out = {
            "from": p.start.isoformat(),
            "to": (p.end - dt.timedelta(days=1)).isoformat(),
            "kwh": str(self.kwh),
            "price_entered": str(self.price_entered if self.price_entered is not None else p.price.price),
            "price_mode": p.price.mode,
            "unit_price_ex_vat": str(self.unit_price_ex_vat),
            "amount_ex_vat": str(self.amount_ex_vat),
            "vat_rate_percent": pct_str(p.vat.rate),
            "vat_amount": str(self.vat_amount),
            "total": str(self.total),
            "tariff_version_id": p.price.id,
            "vat_rate_id": p.vat.id,
        }
        if self.tou is not None:
            out.update(self.tou)
        return out


def line(piece: Piece, kwh_exact: Decimal, price: Decimal | None = None, tou: dict | None = None) -> Line:
    """One charge line. `price` overrides the version's flat price (a time-of-use band price, same mode and rounding)."""
    kwh = r2(kwh_exact)
    entered = price
    price = piece.price.price if price is None else price
    rate = piece.vat.rate
    factor = 1 + rate / HUNDRED
    if piece.price.mode == "ex_vat":
        amount = r2(kwh * price)
        vat = r2(amount * rate / HUNDRED)
        total = amount + vat
        unit = r4(price)
    else:
        total = r2(kwh * price)
        amount = r2(total / factor)
        vat = total - amount
        unit = r4(price / factor)
    return Line(piece, kwh, unit, amount, vat, total, entered, tou)


def totals(lines: list[Line]) -> dict:
    kwh = sum((ln.kwh for ln in lines), Decimal("0.00"))
    amount = sum((ln.amount_ex_vat for ln in lines), Decimal("0.00"))
    vat = sum((ln.vat_amount for ln in lines), Decimal("0.00"))
    total = sum((ln.total for ln in lines), Decimal("0.00"))
    breakdown: dict[str, dict[str, Decimal]] = {}
    for ln in lines:
        key = pct_str(ln.piece.vat.rate)
        b = breakdown.setdefault(key, {"base": Decimal("0.00"), "vat": Decimal("0.00")})
        b["base"] += ln.amount_ex_vat
        b["vat"] += ln.vat_amount
    return {
        "currency": "ILS",
        "kwh": str(r2(kwh)),
        "amount_ex_vat": str(r2(amount)),
        "vat_amount": str(r2(vat)),
        "total": str(r2(total)),
        "vat_breakdown": [{"rate_percent": k, "base": str(r2(v["base"])), "vat": str(r2(v["vat"]))} for k, v in breakdown.items()],
        "price_mode_note_he": "המחיר נקבע כולל מע״מ" if any(ln.piece.price.mode == "inc_vat" for ln in lines) else None,
    }


# ---------------------------------------------------------------- payment terms (round 2 Q8: N days, or a fixed day)

def due_date(issue: dt.date, terms: dict) -> dt.date:
    mode = terms.get("mode", "net_days")
    if mode == "day_of_month":
        day = int(terms.get("day_of_month") or 15)
        y, m = issue.year, issue.month
        for _ in range(3):
            cand = dt.date(y, m, min(day, calendar.monthrange(y, m)[1]))
            if cand > issue:
                return cand
            y, m = (y + 1, 1) if m == 12 else (y, m + 1)
        raise RuntimeError("unreachable")  # pragma: no cover
    return issue + dt.timedelta(days=int(terms.get("days", 14)))
