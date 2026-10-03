# CR-023 — Electricity meters and consumption bills ("תשתיות › חשמל")

**Status:** PROPOSED (phase P0: this document, the mockup gallery and the PDF feasibility check, 2026-10-04). Nothing
implemented. No product code, no migration file, no device contact in P0. Branch `pilot/electricity-p0` from `origin/main`
(0.1.157).
**Numbering:** CR-023 is the next free number (CR-021 self-update and CR-022 NVR connection live on pilot branches).
**Sources:** the design plan `private/nn3-electricity/PLAN.md` (25 sections, 2026-10-03; private, not copied), its Hebrew
summary, and the binding owner answers `private/nn3-electricity/OWNER_DECISIONS_2026-10-04.md`. Where the plan and the owner
answers differ, the owner answers win; every difference is listed in §22.
**Mockups:** `docs/design/mockups/electricity/` (gallery, README); screenshots `docs/evidence/electricity-mockup/`.
**PDF check:** `docs/evidence/electricity-pdf-spike/` (scripts, sample PDFs, raw output).
**Test tier when built:** L (new migration, new permissions, backup change, new screen family; `docs/release/TEST_POLICY.md`).

## 0. Owner decisions (2026-10-04)

| # | Decision | Effect here |
|---|---|---|
| D0 | First release: **a fixed price per kWh only**. Time-of-use later; the tariff structure stays versioned so it can be added | §7; TOU in phase P6 (§21) |
| D1 | Several meters per account: **a free formula** with a convenient formula editor; "sum" and "main minus sub-meters" are presets of it | §6 |
| D2 | Addressee: **a customer card per account** | §13 |
| D3 | Menu: a top area **"תשתיות"** with a sub-tab **"חשמל"** under it (water and generators later) | §3 |
| D4 | Retention defaults: **raw 90 days, quarter-hour 26 months, bills and files 7 years**, all editable in Settings | §15 |
| D5 | Issuing and cancelling bills: **any holder of the bills permission** | §14 |
| D6 | Prices are entered **in Settings**, each with a choice **"before VAT / including VAT"**, plus a **separate VAT-rate setting**, so the bill shows the conventional layout | §7, §15 |
| D7 | Missing data: **bill only what was measured**. A meter is a cumulative counter (like an odometer), so a gap loses no consumption; resets and replacement still need rules | §8 |
| D8 | Legal status: **a consumption bill and payment demand, not a tax invoice** | §11, §12 |
| D9 | Numbering: **YYYY-MM-customer number** (e.g. 2026-12-0001); a revision suffix on correction (2026-12-0001-2); a suffix when one customer has several accounts in the same month. A future tax invoice would need its own gapless series | §10 |

## 1. Goal

The manager picks energy meters that already exist in the system infrastructure. Arx records their cumulative readings in
its own store. An account combines meters by a formula, has a customer card, a fixed price and a billing period. At the
end of each period Arx prepares a draft; a holder of the bills permission issues it, which freezes the numbers and
produces a Hebrew A4 PDF in the conventional layout (consumption x price, subtotal, VAT, total). Bills are kept, listed
with their status, can be corrected by a new revision and cancelled with a reason. Retention of raw readings, quarter-hour
data and bills is set in Settings.

## 2. Scope

**First release (MVP):** meter selection with unit validation (kWh vs kW), sampling and storage, backfill from the
infrastructure's long-term statistics, the formula engine and editor, customers, fixed-price tariffs with effective dates,
VAT rates with effective dates, monthly and two-monthly periods, drafts, issue, sent and paid marks, cancel, correction,
the A4 PDF, bills list, account status and history, retention settings, permissions, audit, backup.

**Designed for, not built now:** time-of-use (seasons, day types, bands, Hebrew holiday calendar), fixed monthly charges,
sending bills by email (then WhatsApp) through the CR-018 channels, alerts (meter not reporting, spikes, budget), CSV
export, heat maps, solar export meters, SATEC meters (adapter placeholder only), water and generators as sibling sub-tabs.

**Out of scope:** tax invoices and allocation numbers, accounting integration, payment collection, customer self-service.

## 3. Placement and navigation

- A new main area **"תשתיות"** (icon: bolt) in the rail and in the phone dock, after WisKey. Level-1 section: **"חשמל"**
  (water and generators join later as siblings). Level-2 pages inside "חשמל": **"מונים"**, **"חשבונות"**, **"חיובים"**,
  **"לקוחות"**. All follow `ui.tabs` ordering and hiding and the dropdown-tabs mode of 0.1.157.
- Visibility: the area is shown to holders of `energy.view`, and only when at least one meter exists or the user holds
  `energy.manage` (an installation without meters shows nothing). "חיובים" and "לקוחות" need `energy.bills`.
- Settings: a new settings tab **"תשתיות"** with the sub-tab **"חשמל"** and three sections: **"מחירים ומע״מ"**,
  **"פרטי העסק"**, **"שמירת נתונים"**. The permission rows live in the existing "משתמשים והרשאות".
- Copy rule (`docs/design/UI_COPY_RULES.md`): operator screens never name the platform; the only mention is
  "תשתית המערכת" where the source of a meter is explained (picker, backfill). Clean operator screens: no hint paragraphs,
  short confirmations, management only where it belongs.
- **Terminology (open question Q1):** in Hebrew both "account" and "bill" are "חשבון". The mockups use **"חשבון"** for the
  account (meters + formula + customer + price + period) and **"חיוב"** for a produced bill; the printed document title is
  **"חשבון צריכת חשמל ודרישת תשלום"**.

## 4. Data model summary

### 4.1 Two databases
- Main database (`/data/smplwise.db`): configuration, customers, accounts, tariffs, VAT rates, bills. Small, relational,
  joins RBAC, audit and the project backup.
- New time-series database (`/data/energy.db`): raw readings and 15-minute intervals, behind one storage module
  (`services/energy_store.py`), its own write gate (`db.gate_for(path)`), WAL, `synchronous=NORMAL`. Reason: a sampler that
  writes every minute must never wait on, or block, the main write gate (the Plan Studio "SQLite storm" lesson), and the
  bulky data stays out of the project backup. SQLite stays (data-store direction note).

### 4.2 Migration number
**Migration 0054 `energy_core.sql`** or the next free number when P1 starts (0050-0053 are taken or reserved: CR-020 S2,
CR-021, NN4 0052, NN1 P4 0053). The energy database has its own sequence `migrations_energy/E001...`.

### 4.3 Main tables (migration 0054)
Text ids, UTC ISO times, money and prices as text decimals (never float).

| Table | Purpose | Key columns |
|---|---|---|
| `energy_meters` | A recorded meter | `id`, `source_kind` ('ha_entity'; 'satec' reserved), `source_ref`, `display_name`, `unit_factor` (Wh per unit: 1 / 1000 / 1000000), `area_id`, `status` ('active','paused','retired'), `max_kw` (plausibility cap), `revision`, created/retired |
| `energy_meter_epochs` | One row per counter life (install, replacement, manual reset, source change) | `meter_id`, `started_at`, `ended_at`, `start_reading_wh`, `end_reading_wh`, `reason`, `note` |
| `energy_customers` | Customer card (§13) | `id`, `customer_number` (unique, 4+ digits, text), `name`, `address`, `phone`, `email`, `tax_id` (optional), `notes`, `deleted_at` |
| `energy_accounts` | An account | `id`, `name`, `customer_id`, `account_letter` (null, or 'A','B',... §10), `formula_json` (§6), `tariff_id`, `period_months` (1 or 2), `period_anchor_day` (1-28), `period_anchor_month`, `first_period_start`, `timezone` (IANA), `auto_draft`, `status`, `revision`, `deleted_at` |
| `energy_account_meters` | Index derived from the formula: which meters an account uses (for "used in" and for retention guards) | `account_id`, `meter_id` |
| `energy_tariffs` | A named price | `id`, `name`, `currency` ('ILS'), `kind` ('fixed'; 'tou' reserved), `deleted_at` |
| `energy_tariff_versions` | A price valid from a date | `tariff_id`, `effective_from` (local date), `price` (text decimal, 4 places), `price_mode` ('ex_vat','inc_vat'), `definition_json` (null for fixed; TOU later), created by/at |
| `energy_vat_rates` | VAT rate valid from a date | `effective_from`, `rate_percent` (text decimal), created by/at |
| `energy_bills` | Draft or issued bill | `id`, `account_id`, `number` (null while draft), `revision` (1, 2...), `replaces_bill_id`, `period_start`, `period_end` (local dates, end exclusive), `state` ('draft','issued','sent','paid','void'), `totals_json`, `snapshot_json`, `snapshot_sha256`, `pdf_path`, `pdf_sha256`, `sent_at/how`, `paid_at/ref`, `void_reason`, created/issued by/at |
| `energy_bill_lines` | Per-meter lines of an issued bill | `bill_id`, `meter_id`, `meter_name`, `start_reading_wh`, `start_read_at`, `end_reading_wh`, `end_read_at`, `wh`, `coefficient`, `contribution_wh`, `resets` |
| `energy_bill_deliveries` | Later (sending): one row per attempt | `bill_id`, `channel`, `target_masked`, `status`, `at` |

Settings are setting keys (§15), not a table. Indexes: unique `energy_bills.number` where not null; unique
`(account_id, period_start, period_end, revision)`; `energy_bills (account_id, period_start)`; `energy_account_meters (meter_id)`;
unique `energy_customers.customer_number` where `deleted_at` is null.

### 4.4 Energy database (`energy.db`)
| Table | Content |
|---|---|
| `readings` | Raw cumulative readings, at most one per meter per minute plus special events. `meter_id` INTEGER, `ts` INTEGER (UTC epoch s), `value_wh` INTEGER, `flags` (reset, glitch, after_unavailable, backfill). `WITHOUT ROWID`, PK `(meter_id, ts)` |
| `intervals` | 15-minute energy buckets: `meter_id`, `bucket`, `wh`, `quality` (0 measured, 1 interpolated inside a short gap, 3 backfilled hourly, 4 manual). PK `(meter_id, bucket)` |
| `daily` | Per meter per local date `wh` (derived, rebuilt from intervals; kept as long as bills for history) |
| `meter_map`, `cursor` | Text id to small integer; last processed reading per meter |

Energy is integer Wh. Sampling: the existing infrastructure WebSocket session hands `state_changed` of registered meters to
an in-memory sampler; one flush transaction per minute; a 15-minute safety poll of the mirror for stale detection;
read-only (no service call, no write to the infrastructure).

## 5. Meter validation (kWh versus kW)
Checked in the picker and again on the server when a meter is saved (a client cannot register a non-energy sensor):

| Check | Accepted | Warning | Rejected |
|---|---|---|---|
| Domain | `sensor` | - | anything else |
| Unit | kWh, Wh, MWh | - | W, kW, MW, VA, kVA, A, V, varh, kvarh, J/MJ/GJ, cal, missing, other |
| device_class | `energy` | missing (with an energy unit) | power, apparent_power, reactive_power, current, voltage, energy_storage, gas, water, monetary |
| state_class | `total_increasing` | `total` (resets daily or is two-way) | `measurement` |
| State | numeric >= 0 | unavailable now (saved, shown "לא מדווח") | non-numeric, negative |
| Duplicates | - | same device already used (3-phase total plus phases) | same sensor twice in one formula |

Hebrew messages (mockup screens "הודעת קילוואט" and "חיישן קילוואט נדחה"):
- kW / W: "החיישן מודד הספק רגעי (קילוואט), לא צריכה מצטברת. לחשבון חשמל צריך מונה שמציג קוט״ש."
- other unit: "יחידת המידה היא {unit}. אפשר לבחור רק מונה שמודד קוט״ש, וואט־שעה או מגוואט־שעה."
- daily counter (warning): "המונה מתאפס כל יום. מתאים, אבל מונה מצטבר עדיף."
- returned energy: "מונה של אנרגיה מוחזרת לרשת. לא נתמך בחשבון צריכה."
- A unit change on a live meter pauses it and keeps its data: "יחידת המדידה של המונה השתנתה. המונה הושהה."

## 6. Formula engine and editor (D1)

**Grammar.** `expr := term (('+'|'−') term)*`; `term := [number ('%' | '×')] operand | operand '×' number['%']`;
`operand := meter | '(' expr ')'`. Numbers are decimals >= 0; a percentage is a number with '%' (30% = 0.30).

**Linear only.** A meter may be multiplied by a constant, never by another meter, and nothing is divided by a meter. The
formula is therefore linear, which gives two guarantees: (1) the account consumption of a period equals the formula applied
to each meter's period consumption, and (2) when time-of-use arrives the same formula can be applied per 15-minute interval
with the same total. A meter used twice is a warning ("המונה מופיע פעמיים"), not an error.

**Storage.** `formula_json` is an AST that references meter **ids**, never names, e.g.
`{"op":"+","args":[{"m":"<id>"},{"k":"0.30","m":"<id>"}]}`. Renaming a meter changes nothing; retiring a meter used by an
active account is refused with the list of accounts (§16 error `meter_in_use`).

**Presets** (each produces a formula the user can keep editing): **"סכום"** (all chosen meters), **"ראשי פחות משנה"**
(one main minus the others), **"חלק באחוזים"** (a percentage of one meter), **"נוסחה חופשית"**.

**Editor** (mockup screens 2.x): a token builder (meter chips with their last-period value, + − × % ( ) number, delete),
a text mode for power users (`[לוח סטודיו] + 30% * [תאורת לובי]`, meters in square brackets, parsed by the same grammar),
a readable sentence of the formula, and a live check on the last full period: each meter's consumption and the account
result. Errors block "הבא": unbalanced parentheses ("חסר סוגר..."), an unknown meter name in text mode, a meter times a
meter, and a negative result on the last period ("התוצאה שלילית בתקופה האחרונה..."). At billing time a negative result is
error `formula_negative` (422) and the draft is not created; the manager fixes the formula or the meters.

**Evaluation.** Server-side only, in `Decimal`, from per-meter period consumption (§8). The client preview uses the same
endpoint (`POST /energy/formula/check`).

## 7. Prices, VAT and the bill arithmetic (D0, D6)

- A tariff is a **fixed price per kWh** with versions by `effective_from`. Each version stores the price **as typed** and
  its mode: **before VAT** or **including VAT**. The default mode for new tariffs is a setting.
- VAT is a separate table of rates with `effective_from` (Settings › מחירים ומע״מ). The rate used is the one in force on the
  period's last day (open question Q4 offers "split the period at the change").
- A period that crosses a tariff version change is **split** at that date: one consumption line per price (as utilities do).
- Arithmetic (all `Decimal`, half-up, kWh shown with 2 decimals, unit price with 4, money with 2):
  - Price typed **before VAT**: `amount = round(kWh × price, 0.01)`; `vat = round(amount × rate, 0.01)`; `total = amount + vat`.
  - Price typed **including VAT**: `total = round(kWh × price, 0.01)` (the customer pays exactly the typed price);
    `amount = round(total / (1 + rate), 0.01)`; `vat = total − amount`; the unit price before VAT is displayed rounded to
    4 places with the note "המחיר נקבע כולל מע״מ".
  - Several lines (split periods): each line's `amount` is rounded, then subtotal, VAT and total as above.
- Example used in the mockups (fake): 776.20 kWh × 0.5430 ₪ = 421.48; VAT 18% = 75.87; total 497.35 ₪.

## 8. What is billed: measured readings only (D7)

- A meter is a cumulative counter. The consumption of a meter in a period is the sum of the positive deltas between
  consecutive accepted readings inside the period, across epochs. A gap in reporting loses nothing: the first reading
  after the gap carries the whole delta.
- **No estimates.** Energy is never invented. The 15-minute intervals spread a delta that spans a gap only for charts; the
  bill uses readings.
- **Boundary readings.** The start reading of a period is the last accepted reading at or before the period start; the end
  reading is the last accepted reading at or before the period end. If either is more than 15 minutes away from the
  boundary, the bill line prints the actual reading time ("קריאה ב-01.10 06:40") and the draft shows a data note. A delta
  that spans a boundary goes to the period in which the later reading falls (open question Q5 offers "split by time").
- **Resets** (counter drops to near zero, e.g. a Gen1 device after a power cut): the energy since the restart counts; the
  line shows "כולל איפוס מונה ב-...". **Noise** (a drop under 10% and under 1 kWh) is ignored. **Spikes** (a jump above the
  plausibility cap `max_kw` × hours × 1.5 + 50 Wh) are held and dropped if the next reading returns to the old level, or
  accepted if the next reading confirms the new level.
- **Replacement** ("החלפת מונה"): closes the epoch with the old meter's final reading (typed or last seen) and opens a new
  epoch with the new start reading; no delta is computed across epochs; the bill shows both segments.
- **Meter not reporting** at issue time: the draft shows "מונה לא מדווח מאז..."; issuing is allowed (the delta will land in
  the next period) and the bill carries a data note. Open question Q6: block issuing instead.

## 9. Billing periods

- Per account: monthly or two-monthly; start day 1-28 (29-31 are not offered); for two months, the month that opens a
  cycle; the first period starts at `first_period_start` (a partial first period ends at the next anchor).
- Periods are local dates in the account's IANA zone (`Asia/Jerusalem`), end exclusive, converted to UTC per date; DST days
  need no special case for a fixed price.
- Ad-hoc bills (any start and end) are allowed as drafts. **Issued bills of one account never overlap** (error
  `period_overlap` 409, mockup "הפקת חיוב: בחירת תקופה וחפיפה").
- Auto draft (per account, default on): the day after a period ends, after the nightly statistics self-check, a janitor step
  creates the draft and emits "טיוטת חיוב מוכנה" to holders of `energy.bills` (CR-018 `notify.emit`). Issuing is always manual.

## 10. Bill numbering (D9)

Format **`YYYY-MM-CCCC[L][-R]`**:
- `YYYY-MM`: the year and month of the **period's last day** (open question Q2). Example: 1.11.2026-1.12.2026 → `2026-11`.
- `CCCC`: the customer number (4 digits, zero padded; more digits allowed beyond 9999).
- `L`: the **account letter**, only when the customer has more than one account. Letters (A, B, C...) are fixed per account
  when the account is created (the first account of a customer gets A when a second one is added), so a number never
  changes meaning between months (mockup "לקוח קיים עם כמה חשבונות", customer card).
- `-R`: the **revision**, only for corrections: `2026-12-0001-2`, `-3`...
- Assigned inside the issuing transaction; uniqueness is enforced by the unique index. A collision (two non-overlapping
  bills of the same account ending in the same month, for example an ad-hoc split) is refused with `number_taken` (409) and
  the open question Q3 offers a sequence suffix instead.
- These numbers are **not** a gapless series: a cancelled number is never reused and gaps are expected. A future tax
  invoice would need its own gapless sequential series (separate project, D9).
- The format is shown read-only in Settings › פרטי העסק ("YYYY-MM-NNNN, שנה-חודש-מספר לקוח").

## 11. Bill lifecycle and statuses (D5, D8)

| State | Hebrew chip | How it is reached | Allowed next |
|---|---|---|---|
| `draft` | טיוטה | auto draft or "הפקת חיוב" | recalculate, delete, issue |
| `issued` | הונפק | "הנפקה" (number, snapshot, PDF frozen) | sent, paid, correct, cancel |
| `sent` | נשלח | "סימון כנשלח" (date and how: דוא״ל / מסירה ידנית / אחר); later automatic after a successful send | paid, correct, cancel |
| `paid` | שולם | "סימון כשולם" (date, optional reference) | correct |
| `void` | בוטל | "ביטול" with a required reason, or automatically when its correction is issued ("הוחלף ב-...") | - |

- Every action above requires `energy.bills` (D5). Issued bills are never edited; a correction creates a draft revision
  (`-2`) that `replaces_bill_id`; issuing it cancels the original with reason "הוחלף ב-<number>".
- Snapshot: everything needed to reproduce the bill without live tables (customer and business details at that moment,
  account name, formula, meters with readings and reading times, epochs and resets, tariff and VAT versions used, totals,
  data notes, software version, computed-at time). Its SHA-256 is stored and a short form is printed in the PDF footer.
- Drafts can be recalculated any time; recalculating an issued period produces a new draft, never a silent change.

## 12. Bill layout (A4, conventional; mockup "חיוב שהונפק (A4)")

One neutral print style (white paper even when the UI is dark; the business accent colour from Settings), RTL, Heebo TTF:
1. Header: title "חשבון צריכת חשמל ודרישת תשלום", subtitle "אינו חשבונית מס", bill number (with "מחליף את ..." for a
   revision), issue date; business logo and details (name, registration number, address, phone, email).
2. Customer box: name, address, customer number, account name. Period box: from - to (number of days), tariff name, due date
   (issue date + "ימים לתשלום").
3. Total to pay, large.
4. Meters table: meter, start reading, end reading, consumption, coefficient/sign from the formula, billed kWh; the formula
   sentence under it; reading times when they differ from the boundary; reset notes.
5. Charges table: consumption kWh × unit price before VAT = amount (one line per price version), subtotal before VAT,
   VAT x%, total to pay.
6. Notes: the fixed note from Settings, data notes, previous-period consumption, the price-mode note.
7. Footer: "הופק ב-SmplWise Arx", page x of y, the short snapshot hash. Drafts carry a "טיוטה" watermark; cancelled bills a
   "בוטל" watermark on any later copy.

## 13. Customer card (D2)
Fields: name (required), customer number (allocated as the next free number, editable while unused, unique), billing
address, phone, email, registration/tax id (optional, for businesses), notes. A customer has one or more accounts.
Contact fields are visible only with `energy.bills`. Deleting a customer is allowed only without active accounts; issued bills
keep their snapshot copy until the bill retention ends. Customers are not Arx users (no login, no self-service).

## 14. Permissions (D5)

| Permission | Hebrew label | Meaning | Default roles |
|---|---|---|---|
| `energy.view` | צפייה במונים ובצריכה | Meters, kWh, account status without money | operator, site_admin, system_admin |
| `energy.bills` | חיובים: סכומים, לקוחות, הפקה וביטול | Prices, amounts, bills and PDFs, customer contact fields; create, issue, mark sent/paid, correct and cancel bills | site_admin, system_admin |
| `energy.manage` | ניהול מונים, חשבונות, לקוחות ומחירים | Configure meters, accounts and formulas, customers, tariffs and VAT, business details | site_admin, system_admin |
| `system.configure` (existing) | - | The retention values | system_admin |

- `energy.bills` is added to the sensitive list (`sensitive_permissions_not_implied`): never implied by another permission.
- viewer, kiosk and editor get none by default. Scope: installation only in v1 (`site_id` on accounts later).
- Money hiding is **server-side**: every serializer drops prices, amounts, VAT, totals and customer contact fields when the
  caller lacks `energy.bills`; bill and PDF routes return 403. The UI also hides the columns and the "חיובים"/"לקוחות" pages
  (mockup toggle "צפייה בלבד").

## 15. Settings and retention (D4, D6)

| Key | Default | Range | Who edits |
|---|---|---|---|
| `energy.raw_retention_days` | **90** | 7-366 | system.configure |
| `energy.interval_retention_months` | **26** | 3-120 | system.configure |
| `energy.bill_retention_years` (issued bill records and their PDFs) | **7** | 1-15 | system.configure |
| `energy.draft_retention_days` | 30 | 7-365 | energy.manage |
| `energy.stale_after_minutes` | 60 | 15-1440 | energy.manage |
| `energy.default_price_mode` | `ex_vat` | ex_vat / inc_vat | energy.manage |
| VAT rates (table §4.3) | none (must be typed) | 0-50% | energy.manage |
| `energy.business` (logo, name, number, address, phone, email, accent colour, payment days, fixed note) | empty | - | energy.manage |
| `energy.include_history_in_backup` | false | bool | backup.manage |

Retention jobs (hourly janitor, outside the main gate, batches of 50,000 rows): raw readings by `ts`; intervals older than
the limit but never inside the period of an open draft; bill records and PDFs after the bill retention (a PDF can be
re-rendered from the snapshot, marked "העתק"); `VACUUM` of `energy.db` at night when more than 20% of pages are free.
Settings shows the current size per class ("בשימוש 212 MB"). Storage estimate for 200 meters at the defaults: raw
~0.6-0.9 GB (90 days at one reading per minute when the value changes), intervals ~150-200 MB; typical sites (10-30 meters)
need tens of MB.

## 16. API (`/api/v1/energy/...`) and errors
Meters (`candidates`, CRUD, `replace`, `backfill`, `series`), customers, accounts (`status`, `history`), `formula/check`,
tariffs and versions, VAT rates, bills (`POST accounts/{id}/bills`, `recalculate`, `issue`, `sent`, `paid`, `correct`, `void`,
list, get, `pdf`), settings. Permissions per §14. Errors use `ApiError` with Hebrew messages: `meter_unit_rejected` 422,
`meter_duplicate` 409, `meter_in_use` 409, `formula_invalid` 422, `formula_negative` 422, `tariff_missing` 422 (no price in
force on a date), `vat_missing` 422, `period_invalid` 422, `period_overlap` 409, `number_taken` 409, `bill_not_draft` 409,
`reason_required` 422, `pdf_render_failed` 503 (retryable, the bill stays issued), `revision_conflict` 409. Live updates:
`energy_meter_status` and `energy_bill_state` on `/me/ws`; values refresh by 60 s polling.

## 17. PDF generation (P0 feasibility result)

**Decision proposed: WeasyPrint 70** (HTML + CSS, Pango/HarfBuzz shaping), **fpdf2 2.8.9 + uharfbuzz as the fallback**.
Evidence in `docs/evidence/electricity-pdf-spike/` (README there lists what was and was not proven):
- Proven on the Ubuntu runner (amd64, glibc, Pango 1.52): a Hebrew RTL A4 bill with Heebo renders correctly (page image
  `page1-1.png`); text extracts in logical order with `pdftotext`; fonts embedded as subsets; 1 page ≈ 0.2-0.27 s warm,
  1.4 s cold including Python import; a 5-page bill with daily tables 0.6-1.2 s on a loaded machine; peak RSS ≈ 88 MB;
  PDFs 18-29 KB. A locked URL fetcher refused `http(s)://` and `file:///etc/...`; injection strings printed as text.
- Proven by reading the public package indexes: every Python wheel needed (WeasyPrint stack, fpdf2, uharfbuzz, Pillow
  12.3.0) exists as `musllinux_1_2` wheels for **both x86_64 and aarch64** (no compiler in the image). Alpine 3.22 ships
  Pango 1.56.3 for both architectures; because `poppler-utils` already pulls cairo, fontconfig, harfbuzz, fribidi and glib,
  `apk add pango` adds only `pango` + `libxft` (≈0.7 MB x86_64, ≈0.9 MB aarch64 installed). Python packages add ≈42 MB
  installed (fontTools 29 MB, Pyphen 6 MB, WeasyPrint 3 MB, zopfli 2.7 MB...). Estimated image growth ≈ 45 MB, under the
  plan's 60 MB gate.
- **Not proven:** a real build of the add-on image (no Docker on the runner), rendering on musl/Alpine, rendering on
  aarch64, and render time on the owner's ARM hardware. P3 starts with a one-off image build on both architectures
  (CI or a machine with Docker + QEMU) and the same render script; the gate is unchanged (≤ 60 MB, ≤ 5 s for 3 pages on aarch64).
- Fonts: bundle Heebo as static TTF instances (400, 700; SIL OFL, notice added) built from the full family, not the UI's
  Hebrew/Latin WOFF2 subsets. Logo: PNG/JPEG ≤ 1 MB, checked by magic bytes, re-encoded by Pillow (max 800 px, metadata
  stripped), SVG refused. Render in a subprocess with a time limit and a 10 MB output cap. PDFs stored under
  `/data/energy/bills/<yyyy>/<bill_id>.pdf` (mode 600), served only through an authorised route with a file name built from
  the bill number.
- The holiday-calendar library check is postponed with time-of-use (owner instruction).

## 18. Security points
- Read-only infrastructure access (state stream, mirror, `recorder/statistics_during_period`); no service call, no new token;
  the token never reaches bills, logs, snapshots or errors.
- Server-side meter validation and formula parsing; formula ids checked against meters the caller may use.
- No credentials, internal URLs, IP addresses or sensor ids on PDFs or screens (meters appear by display names).
- PDF injection: autoescaped template, no user HTML/CSS, locked URL fetcher (bundled fonts and the stored logo only), logo
  re-encoding, subprocess with time and size limits.
- Customer personal data: `energy.bills` only, never in logs, masked in the delivery log, deleted with the customer except
  the snapshot copy inside issued bills until the bill retention ends.
- Financial integrity: issued bills immutable with a snapshot hash; corrections are new revisions; every financial act is
  audited; numbers unique, assigned in the issuing transaction; a restore never makes a number reusable.
- Rate limits: recalculation and PDF rendering 10 per minute per user; one backfill job per meter.

## 19. Audit and backup
Audit: `energy.meter.create/update/retire/replace/backfill`, `energy.account.create/update/delete` (formula changes as
before/after ids), `energy.customer.create/update/delete` (field names only), `energy.tariff.version.create/delete`,
`energy.vat.create`, `energy.bill.draft/recalculate/issue/sent/paid/correct/void`, `energy.bill.pdf.download`,
`energy.settings.update`. Backup: main tables join `PROJECT_TABLES`, `pdf_path` joins `FILE_COLUMNS`; `energy.db` optional
(default off), `daily` always exported as JSON; restore keeps bill numbers unique.

## 20. Acceptance tests (tier L)
Backend (fixtures and fake meters only): the validation matrix of §5; formula parser and evaluator (presets, text mode,
precedence, percentages, unbalanced parentheses, meter × meter refused, negative result, duplicate warning, rename-safe ids);
deltas, resets, noise, spike-then-return, persisting jump, replacement epochs, gaps of 10 minutes and 3 days (no energy lost,
no estimate); boundary readings and reading-time notes; price modes before/including VAT, VAT change, price version split,
half-up rounding golden bills (776.20 × 0.5430 → 421.48 / 75.87 / 497.35); periods (monthly from the 1st and the 15th,
two-monthly, partial first, ad-hoc, overlap refused); numbering (customer number, letters, revisions, collision, concurrent
issue, cancelled number never reused, restore); lifecycle transitions and immutability; money hiding for an
`energy.view`-only user (no money keys in any JSON, 403 on bills and PDFs); PDF golden text via `pdftotext`, injection
strings as text, fetcher refusal, render timeout; retention (each class at its limit, intervals inside an open draft kept);
backup with and without history; load (200 fake meters, one reading per 10 s for a simulated day: flush under 50 ms per
minute, the main write gate never taken by the sampler).
Frontend (Playwright desktop/tablet/mobile, RTL, light/dark, the four skins on the main screens): meters (table, cards,
tree, empty, error, loading), picker with the kW rejection, accounts, account status/history/bills, the six wizard steps
with every error state, bills list with statuses, bill page per state with its dialogs, customers, settings sections,
permission rows; view-only user without money.

## 21. Phases

| Phase | Content | Hours (agent) | Tier |
|---|---|---|---|
| **P0** | This CR, the mockup gallery for owner approval, the PDF feasibility check (done in this branch) | 8-10 | - |
| P1 | Backend core: migration 0054, `energy.db`, storage module, validation, sampler hook, deltas/resets/epochs, intervals and daily, backfill, retention jobs, meters API, permissions, audit | 16-20 | L |
| P2 | Formula engine, customers, tariffs and VAT, periods, drafts, issue/sent/paid/correct/void, numbering, snapshots, money hiding, backup | 14-18 | L |
| P3 | PDF: real image build on amd64 + aarch64 (the open part of §17), template, fonts, logo upload, subprocess, storage, golden PDFs | 8-10 | M (inside the L release) |
| P4 | Frontend: area and tabs, meters, accounts, account page, wizard (6 steps) with the formula editor, bills, customers, settings, tokens in all skins and palettes, three widths, states | 18-24 | L |
| P5 | Evidence, Hebrew user guide, full L gate on the runner, bilingual release notes | 5-7 | L |
| **MVP** | | **61-79** | one L release |
| P6 | Time-of-use (seasons, day types, bands, holiday calendar with the library check, daily band table on the bill) | 16-22 | L |
| P7 | Alerts through notifications (not reporting, spikes, budget) | 8-10 | M |
| P8 | Sending bills (email, then WhatsApp), delivery log, automatic `sent` | 8-12 | L |
| P9 | SATEC adapter (owner details pending) | unknown | - |

Dependencies: migrations 0050-0053 merged before P1; NN1 P2 shell capability model if it lands first (otherwise plain
`TAB_PERMISSIONS`); CR-018 email channel for P8.

## 22. Recorded contradictions and deviations from the plan
1. Menu: the plan recommended an area named "אנרגיה"; the owner chose "תשתיות" › "חשמל" (D3). The plan's concern that
   "תשתיות" may be confused with "תשתית המערכת" remains; the singular "תשתית המערכת" only appears in two places (§3).
2. Meters per account: the plan recommended main/sub-meters; the owner chose a free formula with presets (D1). The
   linear-only rule (§6) is an addition of this CR so time-of-use stays exact later.
3. Retention: plan default raw 35 days; owner 90 days (D4). PDF retention is merged into the bill retention (one value, 7 years).
4. Permissions: the plan had a separate `energy.bills.issue`; the owner chose any holder of the bills permission (D5), so
   it is dropped.
5. Missing data: the plan recommended estimates with a typed confirmation; the owner chose measured only (D7); quality
   class 2 ("estimated gap") is removed from the bill path.
6. Numbering: the plan recommended a yearly gapless series; the owner chose year-month-customer number (D9); the counter
   table is dropped.
7. Scope: the plan's first release included time-of-use; the owner moved it later (D0). The calendar table and the holiday
   library check move to P6.
8. Prices: the plan kept prices per account tariff; the owner placed price entry in Settings with a separate VAT setting (D6).
   Accounts pick a tariff from Settings.

## 23. Open questions for the owner
1. Q1 Terminology: "חשבון" for the account and "חיוב" for the produced bill (as in the mockups)? (a) yes (b) "מנוי" for the
   account (c) another word.
2. Q2 The month in the number: (a) the month of the period's last day (b) the month the period starts (c) the issue month.
3. Q3 Two bills of the same account ending in the same month (an ad-hoc split): (a) refuse (b) add a sequence suffix "/2".
4. Q4 VAT change inside a period: (a) the rate on the last day (b) split the period at the change.
5. Q5 A delta that spans a period boundary (meter offline at midnight): (a) all to the later period (b) split by time.
6. Q6 Meter not reporting at issue time: (a) allow with a note (b) block until it reports or a manual reading is typed.
7. Q7 A fixed monthly charge line (e.g. a meter fee) in the first release: (a) no (b) yes, optional per tariff.
8. Q8 Due date: (a) issue date + days from Settings (b) a fixed day of the month.
9. Q9 Importing past data from the infrastructure statistics when an account is created (the plan had it as a wizard step;
   the owner's step list does not): (a) an optional line in the review step (b) a separate step (c) not in the first release.

## 24. P0 record (this branch)
- Mockup gallery `docs/design/mockups/electricity/` (49 screens, four skins, light/dark, 1440/820/390, view-only toggle);
  screenshots `docs/evidence/electricity-mockup/` generated by `shots.mjs` on the test runner.
- PDF feasibility `docs/evidence/electricity-pdf-spike/`.
- No product file, migration, setting or permission was changed; no device or infrastructure was contacted.
