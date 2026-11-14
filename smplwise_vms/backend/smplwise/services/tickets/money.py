"""CR-038 section 11A.4: the arithmetic of a cost claim - INTEGERS ONLY, in minor units (agorot for ILS). Pure functions, no SQL.

Rules (server-side, the record; the page computes the same figures for display only and the server ignores client totals):
- an amount is a decimal string `^\\d{1,9}(\\.\\d{1,2})?$` -> minor units (`parse_amount("12.5") == 1250`); never a float;
- labor hours are quarter hours: `^\\d{1,3}(\\.\\d{1,2})?$`, a multiple of 0.25, 0.25..200 -> `quarters` (an int);
- a parts quantity has at most 3 decimals, 0.001..100000 -> thousandths (an int);
- a line total = quantity x unit price (labor: hours x rate), rounded HALF-UP to the minor unit PER LINE;
- subtotal = the sum of the line totals; per-kind sums (labor, parts, travel, other) are kept for reporting;
- VAT (the vendor's toggle per claim, D32), rounded half-up ONCE:
    excluded: vat = subtotal x rate;              total = subtotal + vat;  net = subtotal
    included: total = subtotal (what was typed);  vat = total x rate / (1 + rate);  net = total - vat
    none (VAT-exempt vendor / no-charge):         vat = 0;  total = subtotal
  with the rate in basis points (1800 = 18.00 %), frozen in the revision;
- caps: at most 30 lines, every description <= 120 characters (Cc / Cf stripped - text_hygiene), a total above
  `max_claim_total_minor` is refused (`claim_too_large`, a fat-finger / tampering guard).
Every refusal is a MoneyError carrying a field path and a code; the routes turn it into the 422 envelope of their surface."""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Any, Mapping, Sequence

from .text_hygiene import clean_text

AMOUNT_RE = re.compile(r"^(\d{1,9})(?:\.(\d{1,2}))?$")
HOURS_RE = re.compile(r"^(\d{1,3})(?:\.(\d{1,2}))?$")
QTY_RE = re.compile(r"^(\d{1,6})(?:\.(\d{1,3}))?$")
LINE_KINDS: tuple[str, ...] = ("labor", "parts", "travel", "other")
VAT_MODES: tuple[str, ...] = ("excluded", "included", "none")
MAX_LINES = 30
DESC_MAX = 120
MAX_HOURS_Q = 200 * 4  # 200 hours in quarter hours
MAX_QTY_MILLI = 100_000 * 1000
MAX_RATE_BP = 10_000  # 100 % - the settings validator keeps it far lower
# ISO 4217 codes the module accepts (all with two minor digits: the input rule above has at most two decimals). A currency with
# another exponent (JPY, KWD ...) needs its own input rule first - it is not offered.
CURRENCIES: tuple[str, ...] = ("ILS", "USD", "EUR", "GBP", "CHF", "CAD", "AUD")


class MoneyError(ValueError):
    def __init__(self, field_name: str, code: str) -> None:
        super().__init__(f"{field_name}:{code}")
        self.field = field_name
        self.code = code


def half_up_div(n: int, d: int) -> int:
    """round(n / d) with halves away from zero, for n >= 0, d > 0 - integer arithmetic only."""
    if d <= 0 or n < 0:
        raise ValueError("half_up_div is defined for n >= 0, d > 0")
    return (2 * n + d) // (2 * d)


def parse_amount(value: Any, field_name: str = "amount") -> int:
    """A decimal string with at most two decimals -> minor units. Numbers (int / float) are refused: JSON floats are exactly the
    imprecision this module exists to avoid."""
    if not isinstance(value, str):
        raise MoneyError(field_name, "type")
    m = AMOUNT_RE.fullmatch(value.strip())
    if m is None:
        raise MoneyError(field_name, "format")
    whole, frac = m.group(1), (m.group(2) or "")
    return int(whole) * 100 + int(frac.ljust(2, "0") or "0")


def parse_hours(value: Any, field_name: str = "hours") -> int:
    """Labor hours in 0.25 steps, 0.25..200 -> quarter hours."""
    if not isinstance(value, str):
        raise MoneyError(field_name, "type")
    m = HOURS_RE.fullmatch(value.strip())
    if m is None:
        raise MoneyError(field_name, "format")
    hundredths = int(m.group(1)) * 100 + int((m.group(2) or "").ljust(2, "0") or "0")
    if hundredths % 25:
        raise MoneyError(field_name, "quarter_hours")
    q = hundredths // 25
    if not 1 <= q <= MAX_HOURS_Q:
        raise MoneyError(field_name, "range")
    return q


def parse_quantity(value: Any, field_name: str = "quantity") -> int:
    """A parts quantity with at most three decimals, 0.001..100000 -> thousandths."""
    if not isinstance(value, str):
        raise MoneyError(field_name, "type")
    m = QTY_RE.fullmatch(value.strip())
    if m is None:
        raise MoneyError(field_name, "format")
    milli = int(m.group(1)) * 1000 + int((m.group(2) or "").ljust(3, "0") or "0")
    if not 1 <= milli <= MAX_QTY_MILLI:
        raise MoneyError(field_name, "range")
    return milli


def format_minor(minor: int) -> str:
    """Minor units -> a plain decimal string with two decimals ('1234.50'); the CSV and the API answers use it."""
    sign = "-" if minor < 0 else ""
    minor = abs(int(minor))
    return f"{sign}{minor // 100}.{minor % 100:02d}"


def format_hours(quarters: int) -> str:
    h, q = divmod(int(quarters), 4)
    return f"{h}.{q * 25:02d}" if q else f"{h}"


def format_quantity(milli: int) -> str:
    whole, frac = divmod(int(milli), 1000)
    return f"{whole}.{frac:03d}".rstrip("0").rstrip(".") if frac else f"{whole}"


def _desc(value: Any, field_name: str, *, required: bool) -> str:
    if value is None:
        value = ""
    if not isinstance(value, str):
        raise MoneyError(field_name, "type")
    text = clean_text(value)
    if required and not text:
        raise MoneyError(field_name, "required")
    if len(text) > DESC_MAX:
        raise MoneyError(field_name, "too_long")
    return text


@dataclass(frozen=True)
class Line:
    """One validated line. `total_minor` is the server's per-line rounding; the other numbers are what was entered."""

    kind: str
    description: str
    total_minor: int
    hours_q: int | None = None
    rate_minor: int | None = None
    quantity_milli: int | None = None
    unit_minor: int | None = None
    amount_minor: int | None = None

    def as_json(self) -> dict[str, Any]:
        out: dict[str, Any] = {"kind": self.kind, "description": self.description, "total_minor": self.total_minor}
        if self.kind == "labor":
            out.update({"hours": format_hours(self.hours_q or 0), "rate_minor": self.rate_minor})
        elif self.kind == "parts":
            out.update({"quantity": format_quantity(self.quantity_milli or 0), "unit_minor": self.unit_minor})
        else:
            out["amount_minor"] = self.amount_minor
        return out


def parse_line(raw: Any, index: int) -> Line:
    """One client line: {kind, description?, hours + rate | quantity + unit_price | amount}. Unknown keys are refused."""
    base = f"lines.{index}"
    if not isinstance(raw, Mapping):
        raise MoneyError(base, "type")
    kind = raw.get("kind")
    if kind not in LINE_KINDS:
        raise MoneyError(f"{base}.kind", "unknown")
    allowed = {"labor": {"kind", "description", "hours", "rate"}, "parts": {"kind", "description", "quantity", "unit_price"},
               "travel": {"kind", "description", "amount"}, "other": {"kind", "description", "amount"}}[kind]
    extra = set(raw) - allowed
    if extra:
        raise MoneyError(base, "unknown_key")
    desc = _desc(raw.get("description"), f"{base}.description", required=kind in ("parts", "other"))
    if kind == "labor":
        q = parse_hours(raw.get("hours"), f"{base}.hours")
        rate = parse_amount(raw.get("rate"), f"{base}.rate")
        return Line(kind, desc, half_up_div(q * rate, 4), hours_q=q, rate_minor=rate)
    if kind == "parts":
        milli = parse_quantity(raw.get("quantity"), f"{base}.quantity")
        unit = parse_amount(raw.get("unit_price"), f"{base}.unit_price")
        return Line(kind, desc, half_up_div(milli * unit, 1000), quantity_milli=milli, unit_minor=unit)
    amount = parse_amount(raw.get("amount"), f"{base}.amount")
    return Line(kind, desc, amount, amount_minor=amount)


def line_from_json(raw: Mapping[str, Any]) -> Line:
    """A stored line back (lines_json of a revision) - for an adjustment prefill and the CSV; trusted input."""
    kind = raw["kind"]
    if kind == "labor":
        q = parse_hours(raw["hours"])
        return Line(kind, raw.get("description") or "", int(raw["total_minor"]), hours_q=q, rate_minor=int(raw["rate_minor"]))
    if kind == "parts":
        return Line(kind, raw.get("description") or "", int(raw["total_minor"]), quantity_milli=parse_quantity(raw["quantity"]),
                    unit_minor=int(raw["unit_minor"]))
    return Line(kind, raw.get("description") or "", int(raw["total_minor"]), amount_minor=int(raw["amount_minor"]))


@dataclass(frozen=True)
class Computed:
    lines: tuple[Line, ...]
    by_kind: Mapping[str, int]
    subtotal_minor: int
    vat_mode: str
    vat_rate_bp: int
    vat_minor: int
    total_minor: int
    net_minor: int
    flags: tuple[str, ...] = field(default_factory=tuple)

    def as_json(self) -> dict[str, Any]:
        return {
            "lines": [ln.as_json() for ln in self.lines],
            "labor_minor": self.by_kind["labor"], "parts_minor": self.by_kind["parts"], "travel_minor": self.by_kind["travel"],
            "other_minor": self.by_kind["other"], "subtotal_minor": self.subtotal_minor, "vat_mode": self.vat_mode,
            "vat_rate_bp": self.vat_rate_bp, "vat_minor": self.vat_minor, "net_minor": self.net_minor, "total_minor": self.total_minor,
        }


def vat_of(subtotal: int, mode: str, rate_bp: int) -> tuple[int, int, int]:
    """(vat, total, net) for a subtotal - see the module docstring."""
    if mode not in VAT_MODES:
        raise MoneyError("vat_mode", "unknown")
    if not 0 <= rate_bp <= MAX_RATE_BP:
        raise MoneyError("vat_rate_bp", "range")
    if mode == "none" or rate_bp == 0:
        return 0, subtotal, subtotal
    if mode == "excluded":
        vat = half_up_div(subtotal * rate_bp, 10_000)
        return vat, subtotal + vat, subtotal
    vat = half_up_div(subtotal * rate_bp, 10_000 + rate_bp)
    return vat, subtotal, subtotal - vat


def compute(lines: Sequence[Line], vat_mode: str, rate_bp: int, *, max_total_minor: int | None = None) -> Computed:
    if len(lines) > MAX_LINES:
        raise MoneyError("lines", "too_many")
    by_kind = {k: 0 for k in LINE_KINDS}
    for ln in lines:
        by_kind[ln.kind] += ln.total_minor
    subtotal = sum(by_kind.values())
    vat, total, net = vat_of(subtotal, vat_mode, rate_bp)
    if max_total_minor is not None and total > max_total_minor:
        raise MoneyError("total", "claim_too_large")
    return Computed(tuple(lines), by_kind, subtotal, vat_mode, rate_bp, vat, total, net)


def parse_lines(raw: Any) -> list[Line]:
    if not isinstance(raw, (list, tuple)):
        raise MoneyError("lines", "type")
    if len(raw) > MAX_LINES:
        raise MoneyError("lines", "too_many")
    return [parse_line(item, i) for i, item in enumerate(raw)]


def vat_mode_for(*, vat_exempt: bool, amounts_include_vat: bool | None, no_charge: bool) -> str:
    """The revision's VAT mode: an exempt vendor (עוסק פטור) or a no-charge claim has none; otherwise the vendor's toggle."""
    if vat_exempt or no_charge:
        return "none"
    return "included" if amounts_include_vat else "excluded"
