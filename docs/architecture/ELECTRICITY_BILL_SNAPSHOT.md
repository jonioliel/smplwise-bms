# Electricity bill snapshot (CR-023 P2) — the immutable bill DTO

Owner: `pilot/elec-billing` (server billing). Consumers: `pilot/elec-pdf` (`render_bill_pdf`), `pilot/elec-ui-bills`
(bill page, preview). Status: **v1, stable for P2/P3/P4**; additive changes only (new optional keys). A breaking change
bumps `schema`.

## 1. What it is

When a bill is **issued**, the server freezes everything needed to show and print it into one JSON document, the
*snapshot*. It is stored in `energy_bills.snapshot_json` with `snapshot_sha256` and is never changed again (a correction is a
new bill with its own snapshot). A **draft** has the same shape, recomputed on every recalculation, with `bill.number = null`
and `bill.state = "draft"`. The PDF and the bill page read ONLY this document — never live tables — so an issued bill looks
the same in seven years.

- Encoding: JSON, UTF-8. All money, prices, kWh and readings are **decimal strings** (never floats): kWh `"776.20"` (2 places),
  readings `"12345.678"` kWh (3 places), unit price `"0.5430"` (4 places), money `"421.48"` (2 places), percent `"18"` or `"17.5"`.
- Dates are local calendar dates of the account's time zone (`YYYY-MM-DD`); instants are UTC ISO-8601 with `Z`.
- Hash: `snapshot_sha256 = sha256(canonical_json(snapshot))`, canonical = `json.dumps(obj, sort_keys=True,
  separators=(",", ":"), ensure_ascii=False).encode("utf-8")`. The PDF footer prints the first 12 hex characters.
- Hebrew texts that the server composes (notes, formula sentence) are ready to print; the renderer must escape them (plain
  text, never HTML).

## 2. Shape (v1)

```jsonc
{
  "schema": "arx.energy.bill_snapshot/1",
  "doc": {                                   // what the document is (legal status, decision D8)
    "title_he": "חשבון צריכת חשמל ודרישת תשלום",
    "subtitle_he": "אינו חשבונית מס",
    "is_tax_invoice": false
  },
  "bill": {
    "id": "a1b2c3d4e5f60718",
    "number": "2026-10-0001",                // null in a draft; see §4
    "revision": 1,                           // 2, 3... for corrections
    "replaces": null,                        // {"bill_id": "...", "number": "2026-10-0001"} on a correction
    "state": "issued",                       // the state at sealing: "draft" | "issued" (later states live on the row, not here)
    "origin": "manual",                      // "manual" | "auto"
    "issue_date": "2026-11-02",              // null in a draft
    "due_date": "2026-11-16",                // null in a draft (the draft shows the expected due date in "expected_due_date")
    "expected_due_date": "2026-11-16",       // what the due date would be if issued today (drafts and issued)
    "payment_terms": {"mode": "net_days", "days": 14, "day_of_month": null},
    "issued_at": "2026-11-02T08:12:00Z",     // null in a draft
    "issued_by": {"kind": "user", "display_name": "יוני"}   // {"kind": "system"} for automatic issue; null in a draft
  },
  "period": {
    "from": "2026-10-01",                    // first day, inclusive
    "to": "2026-10-31",                      // last day, inclusive (what the bill prints: "מ-01.10.2026 עד 31.10.2026")
    "end_exclusive": "2026-11-01",
    "days": 31,
    "timezone": "Asia/Jerusalem",
    "start_utc": "2026-09-30T21:00:00Z",
    "end_utc": "2026-10-31T22:00:00Z"        // DST-correct: a 31-day period may be 743 or 745 hours long
  },
  "business": {                              // Settings › פרטי העסק at the moment of sealing
    "name": "נכסי הדוגמה בע״מ", "registration_no": "510000000", "address": "...", "phone": "...", "email": "...",
    "accent_color": "#2767ed",
    "footer_note": "התשלום בהעברה בנקאית לפי פרטי ההסכם.",
    "logo": {"sha256": "<64 hex>", "mime": "image/png", "width": 400, "height": 120}   // or null; bytes by hash, §5
  },
  "customer": {                              // the customer card at the moment of sealing
    "id": "...", "customer_number": "0001", "name": "...", "address": "...", "phone": "...", "email": "...", "tax_id": "..."
  },
  "account": {
    "id": "...", "name": "סטודיו אורן - קומה 1",
    "tariff": {"id": "...", "name": "תעריף כללי"},
    "formula": {
      "ast": {"op": "-", "args": [{"m": "<meter id>"}, {"m": "<meter id>"}]},
      "text": "[לוח ראשי] - [מזגן לובי]",            // meters by their names at sealing
      "sentence_he": "לוח ראשי פחות מזגן לובי"
    }
  },
  "meters": [                                // one entry per meter in the formula, in formula order
    {
      "meter_id": "...", "name": "לוח ראשי",
      "coefficient": "1",                    // d(result)/d(meter): "1", "-1", "0.30"... (the formula is linear, §3)
      "start": {"at": "2026-09-30T21:00:00Z", "reading_kwh": "12345.678", "kind": "interpolated"},
      "end":   {"at": "2026-10-31T22:00:00Z", "reading_kwh": "13121.878", "kind": "reading"},
      // kind: "reading" (a real reading within 15 minutes of the boundary), "interpolated" (by time between two readings),
      //       "carried" (the start is where the previous bill of this account stopped for this meter), "last_report"
      //       (the meter did not report up to the end; the end is its last reading)
      "consumption_kwh": "776.20",           // what is billed for this meter in this bill (before the coefficient)
      "contribution_kwh": "776.20",          // coefficient x consumption
      "carried_in_kwh": "0.00",              // part of consumption_kwh that happened before the period (a late report)
      "resets": [{"at": "2026-10-12T03:12:00Z"}],           // counter resets / replacements inside the window
      "last_report_at": "2026-10-31T21:58:00Z",
      "reported_to_end": true                // false: "מונה לא מדווח מאז ..." note, the rest goes to the next bill
    }
  ],
  "lines": [                                 // one charge line per price segment (tariff version x VAT rate), §3
    {
      "from": "2026-10-01", "to": "2026-10-31",
      "kwh": "776.20",
      "price_entered": "0.5430", "price_mode": "ex_vat",    // as typed in Settings ("ex_vat" | "inc_vat")
      "unit_price_ex_vat": "0.5430",                        // 4 places; for inc_vat the rounded derived price
      "amount_ex_vat": "421.48",
      "vat_rate_percent": "18",
      "vat_amount": "75.87",
      "total": "497.35",
      "tariff_version_id": "...", "vat_rate_id": "..."
    }
  ],
  "totals": {
    "currency": "ILS",
    "kwh": "776.20",
    "amount_ex_vat": "421.48",
    "vat_amount": "75.87",
    "total": "497.35",                       // the amount to pay
    "vat_breakdown": [{"rate_percent": "18", "base": "421.48", "vat": "75.87"}],
    "price_mode_note_he": null               // "המחיר נקבע כולל מע״מ" when any line was entered including VAT
  },
  "notes": [                                 // data notes, ready to print, in this order
    {"code": "meter_not_reporting", "meter_id": "...", "at": "2026-10-28T09:40:00Z",
     "text_he": "המונה מזגן לובי לא מדווח מאז 28.10.2026 09:40. הצריכה שלאחר מכן תחויב בחיוב הבא."},
    {"code": "reading_time", "meter_id": "...", "at": "...", "text_he": "קריאת סוף התקופה של לוח ראשי ב-31.10.2026 18:40."},
    {"code": "carried_in", "meter_id": "...", "text_he": "כולל 12.40 קוט״ש מהתקופה הקודמת שדווחו באיחור."},
    {"code": "meter_reset", "meter_id": "...", "at": "...", "text_he": "כולל איפוס מונה ב-12.10.2026 03:12."},
    {"code": "period_split", "text_he": "התקופה פוצלה ב-15.10.2026 בגלל שינוי מחיר או שיעור מע״מ."}
  ],
  "history": {                               // owner round 3: the consumption chart; computed at generation, never invented
    "current": {"from": "2026-10-01", "to": "2026-10-31", "kwh": "776.20"},
    "previous": [                            // up to 12 previous periods of the same length, oldest first
      {"from": "2026-09-01", "to": "2026-09-30", "kwh": "701.10", "status": "measured", "source": "bill"},
      {"from": "2026-08-01", "to": "2026-08-31", "kwh": null, "status": "missing", "source": null}
    ],
    "same_period_last_year": {"from": "2025-10-01", "to": "2025-10-31", "kwh": "690.00", "status": "partial", "source": "readings"}
    // or null when the account did not exist then
  },
  "rounding": {"rule": "half_up", "kwh_places": 2, "unit_price_places": 4, "money_places": 2,
               "order": "per_line_then_sum", "vat": "per_line"},
  "meta": {"engine": "arx.energy.billing/1", "software_version": "0.1.157", "computed_at": "2026-11-02T08:12:00Z"}
}
```

### History entries (the chart)
- `status`: `"measured"` (every meter of the formula had data for the whole period), `"partial"` (some data, not all — the
  value is a lower bound and the chart should mark it), `"missing"` (no data: `kwh` is null — draw no bar).
- `source`: `"bill"` (taken from an issued, not cancelled bill of this account for exactly that period — the billed kWh),
  `"readings"` (computed from the long-term daily totals of the readings store), or null when missing.
- A first bill ever has `previous: []` and `same_period_last_year: null` → no chart. The renderer omits the chart when no
  entry has a value, and omits individual bars that are null.
- A correction (revision 2+) **copies** `history` from the snapshot it replaces (same period, same comparison).

## 3. Arithmetic (normative; the renderer prints, never recomputes)

1. The period is split at every date where the tariff version or the VAT rate changes (owner round 2, Q4 = b). Each piece
   becomes one line.
2. Per meter, consumption is taken from its readings; energy between two readings that straddle a boundary is allocated
   **by time** (owner round 2, Q5 = b). A meter that has not reported up to the period end is billed up to its last reading,
   and the next bill starts exactly where this one stopped ("carried"), so nothing is lost or billed twice.
3. Per line: the formula (linear) is applied to the meters' consumption in that piece → `kwh` rounded half-up to 2 places.
   - `ex_vat`: `amount_ex_vat = round(kwh × price, 0.01)`; `vat_amount = round(amount_ex_vat × rate / 100, 0.01)`;
     `total = amount_ex_vat + vat_amount`.
   - `inc_vat`: `total = round(kwh × price, 0.01)`; `amount_ex_vat = round(total / (1 + rate / 100), 0.01)`;
     `vat_amount = total − amount_ex_vat`; `unit_price_ex_vat = round(price / (1 + rate / 100), 0.0001)` (display only).
4. Totals are the sums of the rounded line values (`kwh`, `amount_ex_vat`, `vat_amount`, `total`). No re-rounding.
5. Golden example: 776.20 kWh × 0.5430 = 421.48; VAT 18% = 75.87; total 497.35.

## 4. Bill number

`YYYY-MM-CCCC[/S][-R]` — `YYYY-MM` = year and month of the period's LAST day; `CCCC` = the customer number (at least 4
digits, zero padded); `/S` = running suffix (2, 3...) when another bill with the same `YYYY-MM-CCCC` was already numbered
(two bills of one account ending in the same month, or a customer with several accounts); `-R` = revision on a correction
(`2026-12-0001-2`, `2026-12-0001/2-2`). Not a gapless series; a cancelled number is never reused.

## 5. Rendering contract (for `pilot/elec-pdf`)

```python
def render_bill_pdf(snapshot: dict, *, logo: bytes | None = None, watermark: str | None = None) -> bytes
```
- `snapshot`: exactly this document (parsed JSON).
- `logo`: the logo bytes whose sha256 equals `snapshot.business.logo.sha256` (PNG or JPEG, re-encoded by the server, max
  800 px); `None` when there is no logo or it is unavailable.
- `watermark`: `None` (issued / sent / paid), `"draft"` ("טיוטה"), `"void"` ("בוטל"), `"copy"` ("העתק").
- The billing API calls it through a seam (`services/energy_billing_pdf.py`); if the keyword arguments are not supported it
  falls back to `render_bill_pdf(snapshot)`. A render failure is `pdf_render_failed` (503, retryable); the bill stays issued.
- The server stores the first PDF of an issued bill (`/data/energy/bills/<yyyy>/<bill_id>.pdf`, `pdf_sha256`) and serves that
  file afterwards; drafts and watermarked copies are rendered on demand and not stored.
