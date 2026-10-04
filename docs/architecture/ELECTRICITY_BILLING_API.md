# Electricity billing API (CR-023 P2) — customers, accounts, formula, prices, bills

Owner: `pilot/elec-billing`. Consumers: `pilot/elec-ui-bills`, `pilot/elec-ui-meters` (account wizard, formula editor).
Meters, readings and series are the other server branch (`pilot/elec-server`, `docs/architecture/ELECTRICITY_INTERFACES.md`).
The bill document itself is `docs/architecture/ELECTRICITY_BILL_SNAPSHOT.md`.

All routes are under `/api/v1/energy`. JSON only (`Content-Type: application/json`, else 415). Bodies are closed (an unknown
field is 422). Errors use the common envelope `{code, user_message, retryable, correlation_id, details}`; `user_message` is
Hebrew and printable. Ids are 16-hex strings. Dates are local `YYYY-MM-DD` (the account's time zone); instants UTC ISO `Z`.
Money/kWh/prices are **decimal strings**.

## 1. Permissions

| Permission | Hebrew | Gives |
|---|---|---|
| `energy.view` | צפייה במונים ובצריכה | accounts (names, formula, period, kWh), customer name and number. **No money, no contact fields** |
| `energy.manage` | ניהול מונים, חשבונות, לקוחות ומחירים | create/edit customers, accounts, tariffs and VAT rates, billing settings and logo |
| `energy.bills` | חיובים: סכומים, לקוחות, הפקה וביטול | prices, amounts, customer contact fields, every bill action (create, recalculate, issue, sent, paid, correct, cancel), PDFs. Sensitive: never implied, a custom role must name it |

Default roles: `energy.view` operator, site_admin, system_admin; `energy.manage` and `energy.bills` site_admin, system_admin.
Installation scope only (v1). The permission is checked **before the body is read**; a refusal is 403 `forbidden` and is
audited. Money hiding is server-side: without `energy.bills` the keys listed as *money* below are absent (not null).

## 2. Common errors

| code | status | when |
|---|---|---|
| `forbidden` | 403 | missing permission (audited) |
| `unsupported_media_type` | 415 | body not JSON |
| `validation` | 422 | malformed body; `details.fields` |
| `not_found` | 404 | unknown id (or deleted) |
| `revision_conflict` | 409 | `base_revision` is not the current one; `details.current_revision` |
| `formula_invalid` | 422 | syntax error, unknown meter, meter × meter, division by a meter or by zero, empty; `details.errors[] = {code, message, pos}` |
| `formula_negative` | 422 | the formula gives a negative result for a period (`details.period`, `details.kwh`) |
| `tariff_missing` | 422 | no price in force on a date of the period (`details.date`) |
| `vat_missing` | 422 | no VAT rate in force on a date of the period (`details.date`) |
| `period_invalid` | 422 | from > to, longer than 366 days, before the account's first period, in the future for issue |
| `period_overlap` | 409 | the period overlaps an issued (not cancelled) bill of the account (`details.bill_id`, `details.number`) |
| `draft_exists` | 409 | a draft for exactly this period already exists (`details.bill_id`) |
| `bill_not_draft` | 409 | recalculate / delete / issue on a bill that is not a draft |
| `draft_stale` | 409 | issue: the fresh computation differs from the draft the user saw (a late reading). The draft is updated in the same call; `details = {old_total, new_total, old_kwh, new_kwh, row_version}`; show the new draft and issue again with the new `row_version` |
| `request_reused` | 409 | a `client_request_id` already used for another account |
| `number_taken` | 409 | (should not happen) the computed number is already in the ledger; retry |
| `bill_state` | 409 | the action is not allowed in the bill's current state (`details.state`) |
| `reason_required` | 422 | cancel without a reason |
| `customer_number_taken` | 409 | customer number already used (also by a deleted customer) |
| `customer_number_locked` | 409 | changing the number of a customer that has numbered bills |
| `customer_has_accounts` | 409 | deleting a customer with active accounts |
| `tariff_in_use` | 409 | deleting a tariff used by an active account, or a version / VAT rate used by an issued bill |
| `version_exists` | 409 | a tariff version or VAT rate with the same effective date exists |
| `pdf_unavailable` | 503 | the PDF renderer is not installed in this build (retryable: false) |
| `pdf_render_failed` | 503 | the renderer failed (retryable: true); the bill keeps its state |
| `logo_invalid` | 422 | not PNG/JPEG by magic bytes, larger than 1 MB, unreadable |

## 3. Customers (`customer card`, decision D2)

`Customer` = `{id, customer_number, name, revision, created_at, updated_at, account_count}` + contact (*money-class*, only with
`energy.bills` or `energy.manage`): `{address, phone, email, tax_id, notes}`.

| Method | Path | Permission | Body / query | Answer |
|---|---|---|---|---|
| GET | `/customers` | view, manage or bills | `q`, `limit` (≤500), `offset` | `{items: [Customer], total}` |
| GET | `/customers/next-number` | manage | – | `{customer_number: "0006"}` (next free, padded to `numbering.customer_digits`) |
| POST | `/customers` | manage | `{name, customer_number?, address?, phone?, email?, tax_id?, notes?}` | 201 `Customer` |
| GET | `/customers/{id}` | view, manage or bills | – | `Customer` + `accounts: [{id, name, status}]` + (bills) `bills: [BillSummary]` (last 24) |
| PATCH | `/customers/{id}` | manage | `{base_revision, ...fields}` | `Customer` |
| DELETE | `/customers/{id}` | manage | query `base_revision` | 204. Issued bills keep their snapshot copy |

Customer number: digits only, 1-9 digits, stored zero-padded to at least 4 (`"12"` → `"0012"`); unique for ever (a deleted
customer's number is not reused, so bill numbers never collide in meaning).

## 4. Accounts

`Account` = `{id, name, customer: {id, customer_number, name}, formula: {ast, text, sentence_he, meter_ids}, tariff: {id, name},
period_months (1|2), period_anchor_day (1-31; 29-31 are clamped to the month's last day), period_anchor_month (1-12, for 2-month
cycles: a month that opens a cycle), first_period_start, timezone, auto_mode ("off"|"draft"|"issue"), status ("active"|"paused"),
revision, created_at, updated_at, next_period: {from, to}, last_bill: BillSummary|null}`.
Money (bills only): `tariff.price`, `tariff.price_mode`.

| Method | Path | Permission | Body / query | Answer |
|---|---|---|---|---|
| GET | `/accounts` | view | `customer_id`, `q`, `status` | `{items: [Account]}` |
| POST | `/accounts` | manage | `{name, customer_id, formula: {text}|{ast}, tariff_id, period_months, period_anchor_day, period_anchor_month?, first_period_start, timezone?, auto_mode?}` | 201 `Account` |
| GET | `/accounts/{id}` | view | – | `Account` |
| PATCH | `/accounts/{id}` | manage | `{base_revision, ...}` | `Account` |
| DELETE | `/accounts/{id}` | manage | query `base_revision` | 204 (soft; issued bills stay; open drafts are deleted) |
| GET | `/accounts/{id}/periods` | view | `past` (0-24, default 6), `future` (0-6, default 1) | `{periods: [{from, to, end_exclusive, bill: BillSummary|null, state: "billed"|"draft"|"open"|"future"}]}` |
| GET | `/accounts/{id}/status` | view | – | `{period: {from, to}, kwh_so_far, meters: [{meter_id, name, kwh, last_report_at, reporting}], notes}`; bills adds `amount_so_far` (estimate, never stored) |

Formula on save: syntax/meter errors are 422 `formula_invalid`. `timezone` defaults to the installation time zone.
`auto_mode` default `"draft"` (owner: automatic draft at the end of each period; `"issue"` also issues it).

## 5. Formula

AST nodes: `{"m": "<meter id>"}`, `{"n": "0.30"}` (number ≥ 0, decimal string), `{"op": "+"|"-"|"*"|"/", "args": [a, b]}`,
`{"neg": node}`. Text mode: meters in square brackets by name or id, numbers, `%` after a number (30% = 0.30), `+ - * /`,
parentheses, unary minus: `[לוח סטודיו] + 30% * [תאורת לובי]`, `([ראשי] - [מזגן]) / 2`. The formula must be **linear**: a
meter may be multiplied or divided by a constant, never by a meter (so the period split and later time-of-use stay exact).
Parsing is a hand-written recursive-descent parser (no eval); max 2,000 characters, 64 meters, depth 32.

| Method | Path | Permission | Body | Answer |
|---|---|---|---|---|
| POST | `/formula/check` | view or manage | `{formula: {text}|{ast}, period?: {from, to}, timezone?}` | always 200 for a well-formed body: `{ok, ast, text, sentence_he, meter_ids, coefficients: {meter_id: "1"}, errors: [{code, message, pos}], warnings: [{code, message}], preview: {period: {from, to}, meters: [{meter_id, name, kwh}], result_kwh, negative} | null}` — the preview period defaults to the last full calendar month |
| POST | `/formula/preset` | view or manage | `{preset: "sum"|"main_minus_subs"|"share", meter_ids: [...], main_meter_id?, percent?}` | `{ast, text, sentence_he}` |

Error codes inside `errors[]`: `syntax`, `unbalanced`, `unknown_meter`, `nonlinear`, `constant_term` (a bare number added to
meters, e.g. `[A] + 5`), `no_meter`, `too_many_meters`, `division_by_zero`, `empty`, `too_long`, and from the preview `negative`
and `period`. Warnings: `duplicate_meter`, `meter_not_reporting`. `pos` is the character offset in the text (null for AST input).

## 6. Tariffs and VAT (Settings › מחירים ומע״מ)

`Tariff` = `{id, name, currency: "ILS", kind: "fixed", versions: [{id, effective_from, price, price_mode, created_at}], current: {...}|null, used_by: n}`.
Read: manage or bills. Write: manage.

| Method | Path | Body |
|---|---|---|
| GET | `/tariffs` | – → `{items: [Tariff]}` |
| POST | `/tariffs` | `{name, price, price_mode?, effective_from}` (price: up to 4 decimals, > 0; mode default from settings) |
| PATCH | `/tariffs/{id}` | `{name}` |
| DELETE | `/tariffs/{id}` | – (409 `tariff_in_use` while an active account uses it) |
| POST | `/tariffs/{id}/versions` | `{effective_from, price, price_mode}` |
| DELETE | `/tariffs/{id}/versions/{version_id}` | – (409 when an issued bill used it, or it is the only version) |
| GET | `/vat-rates` | – → `{items: [{id, effective_from, rate_percent}], current}` |
| POST | `/vat-rates` | `{effective_from, rate_percent}` (0-50, up to 2 decimals) |
| DELETE | `/vat-rates/{id}` | – (409 when an issued bill used it) |

## 7. Billing settings (Settings › פרטי העסק, numbering, payment)

`GET /billing-settings` (manage or bills), `PUT /billing-settings` (manage) with `{base_revision, ...any subset}`:

```json
{
  "revision": 3,
  "default_price_mode": "ex_vat",
  "payment_terms": {"mode": "net_days", "days": 14, "day_of_month": 15},
  "business": {"name": "", "registration_no": "", "address": "", "phone": "", "email": "", "accent_color": "#2767ed", "footer_note": ""},
  "numbering": {"customer_digits": 4, "format": "YYYY-MM-NNNN"},
  "auto": {"delay_hours": 6},
  "logo": {"sha256": "...", "mime": "image/png", "width": 400, "height": 120} 
}
```
- `payment_terms.mode`: `"net_days"` → due = issue date + `days` (0-120); `"day_of_month"` → the first `day_of_month` (1-31,
  clamped to the month's last day) strictly after the issue date.
- `auto.delay_hours` (0-72): how long after a period ends the automatic draft is made (late readings arrive first).

Logo: `PUT /billing-settings/logo` (manage) raw body `image/png` or `image/jpeg` (≤ 1 MB; checked by magic bytes, re-encoded
to PNG, max 800 px, metadata stripped) → `{logo}`; `DELETE /billing-settings/logo` → 204; `GET /billing-settings/logo` (manage
or bills) → the PNG.

## 8. Bills

`BillSummary` = `{id, account_id, account_name, customer: {id, customer_number, name}, number|null, revision, state, origin,
period: {from, to}, issue_date|null, due_date|null, kwh, total (money), replaces_bill_id|null, replaced_by_bill_id|null,
row_version, created_at, updated_at}`.
`Bill` = `BillSummary` + `{snapshot (§ snapshot doc), snapshot_sha256|null, sent: {at, how, note}|null, paid: {at, reference}|null,
void: {at, reason}|null, actions: ["recalculate","delete","issue","sent","paid","correct","void","pdf"]}`.

States: `draft` → `issued` → `sent` → `paid`; `void` (בוטל) from issued/sent (cancel with a reason, or automatically when a
correction is issued: reason "הוחלף ב-<number>"). A paid bill can only be corrected. Every action needs `energy.bills`.

| Method | Path | Body | Answer / notes |
|---|---|---|---|
| GET | `/bills` | query `account_id, customer_id, state, from, to, q (number or name), limit ≤ 500, offset` | `{items: [BillSummary], total, counts: {draft, issued, sent, paid, void}}` |
| POST | `/accounts/{id}/bills` | `{period?: {from, to}, client_request_id}` (no period = the last ended regular period) | 201 `Bill` (draft). The same `client_request_id` again → 200 with the same bill (double click). 409 `draft_exists`, `period_overlap`; 422 `formula_negative`, `tariff_missing`, `vat_missing`, `period_invalid` |
| GET | `/bills/{id}` | – | `Bill` |
| GET | `/bills/{id}/events` | – | `{items: [{at, action, actor: {kind, display_name}, details}]}` |
| POST | `/bills/{id}/recalculate` | `{row_version}` | `Bill` (draft recomputed) |
| DELETE | `/bills/{id}` | query `row_version` | 204 (draft only) |
| POST | `/bills/{id}/issue` | `{row_version, client_request_id, issue_date?}` (issue_date default today, not in the future, not before the period end) | `Bill` (number, snapshot sealed). Repeating with the same `client_request_id` → 200 with the same issued bill |
| POST | `/bills/{id}/sent` | `{at?, how: "email"|"hand"|"other", note?}` | `Bill` |
| POST | `/bills/{id}/paid` | `{at?, reference?}` | `Bill` |
| POST | `/bills/{id}/correct` | `{client_request_id}` | 201 `Bill` (a new draft, revision + 1, same period, `replaces_bill_id`); 409 `bill_state` when a correction draft already exists (`details.bill_id`) |
| POST | `/bills/{id}/void` | `{reason}` (1-300 chars) | `Bill` |
| GET | `/bills/{id}/pdf` | query `copy=1` (watermark "העתק") | `application/pdf`, file name `<number>.pdf` (draft: `draft-<id>.pdf`, watermark "טיוטה"; void: "בוטל"). 503 `pdf_unavailable` / `pdf_render_failed` |
| GET | `/auto-runs` | query `account_id`, `limit` | `{items: [{account_id, period: {from, to}, status: "created"|"issued"|"skipped"|"failed", bill_id, error_code, attempts, updated_at}]}` |

`row_version` protects against two people acting on one bill at once (409 `revision_conflict`).

Rules: a draft may be made for any period, also a running one (a preview); **issue** needs the period to be over (422
`period_invalid` otherwise) and `issue_date` between the period end and today. Issue recomputes the bill; if the numbers moved
it answers `draft_stale` (above). A correction keeps the period of the bill it replaces; when a later bill of the account
already exists, the correction keeps the original's per-meter end points (no energy billed twice). Draft retention:
`energy.draft_retention_days` (30); bill and PDF retention: `energy.bill_retention_years` (7) - the ledger of used numbers is
never pruned.

## 9. Automatic generation

A janitor step (every 5 minutes) finds, per active account with `auto_mode != "off"`, every regular period that ended at
least `auto.delay_hours` ago and has no bill yet (catching up after downtime, oldest first, at most 24 per account per pass),
computes it outside the write lock, then writes the draft in one short transaction keyed by `(account, period)` in
`energy_auto_runs` (idempotent; a second process or a restart never creates a second draft). `auto_mode = "issue"` issues it
in the same transaction. Failures (`formula_negative`, `tariff_missing`...) are recorded on the run with the error code and
retried every 6 hours; the screen shows them. Every automatic act is audited with the actor "system". Periods before the
account's `first_period_start` or before the account was created are never generated.

## 10. Status of this contract

Implemented on `pilot/elec-billing` (routes in `smplwise/routers/energy_billing.py`, inventory in `contracts/API_INVENTORY.md`),
tested with a fake readings store and a fake PDF renderer (`tests/test_energy_billing_api.py`, `tests/test_energy_billing_engine.py`).
Not built: notification "טיוטת חיוב מוכנה" through the notifications module, live `energy_bill_state` events on `/me/ws`
(the screens poll), rate limits on recalculate / PDF.

## 11. Audit actions

`energy.customer.create|update|delete` (field names only, no values), `energy.account.create|update|delete`,
`energy.tariff.create|update|delete`, `energy.tariff.version.create|delete`, `energy.vat.create|delete`,
`energy.billing_settings.update`, `energy.billing_settings.logo`, `energy.bill.draft|recalculate|delete|issue|sent|paid|correct|void|pdf`,
`energy.bill.auto_draft|auto_issue|auto_failed`. Refusals are audited as `denied` with the permission as the action.
