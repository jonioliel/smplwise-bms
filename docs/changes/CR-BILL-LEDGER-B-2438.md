# CR-BILL-LEDGER-B-2438 - drafts, automatic generation and retention written once; the account history reads its bills once (step B)

Branch `pilot/CR-BILL-LEDGER-B-2438` (MASTER_PLAN row `CR-BILL-LEDGER-B-2436`), cut from `origin/pilot/CR-WAVE1B-COMBINED-2436` at
`ffb4af2d5`, which already holds step A (`CR-BILL-LEDGER-A-2436`: marks, void, numbering, seal). Code review 2026-11-13, report 04,
findings F04 (automatic generation, retention, drafts) and F26 (billing loops). Behaviour change: none for documents, amounts, numbers,
audit rows or errors; fewer statements on the account history. Pixels: no. No migration, no router, no frontend file.

## 1. Findings

- **04:F04 (rest)** - after step A the sealed-bill lifecycle was shared, but the drafts (`insert_draft`, `store_recalculated`,
  `delete_draft`, `by_create_request`, `_prev_bill`, `_carried_from`, `_end_caps`), the automatic generation (`_due_periods`,
  `_record_run`, `auto_generate`) and retention were still written twice (`energy_billing.py`, `water_billing.py`), differing only by
  table names, the quantity column, the audit prefix, the connection labels and two log words. A fix on one side only (idempotency of
  the generation, what retention deletes) was a real money risk.
- **04:F26 (billing loops)** - the account page's history looked the bill of every period up separately, twice per period (the sealed
  quantity and the bill shown), plus 13 lookups for the electricity comparison. Measured on the unchanged code with a 24-period
  history: **61** bill statements (electricity), **50** (water).

## 2. What changed

`smplwise_vms/backend/smplwise/services/bill_ledger.py` (the `BillKind` record of step A) gains five constant fields and the step-B
functions; both service modules keep every public and private name as a thin wrapper, so routers and tests are unchanged.

| `BillKind` field (new) | electricity | water |
|---|---|---|
| `accounts_table` | `energy_accounts` | `water_accounts` |
| `runs_table` | `energy_auto_runs` | `water_auto_runs` |
| `account_resource_type` (audit of a failed run) | `energy_account` | `water_account` |
| `log_word` (log lines) | `""` | `"water "` |
| `pdf_column` (files retention removes) | `pdf_path` | none |

Connection labels come from `kind.name` (`energy.auto.scan` / `water.auto.write` / `energy.billing.retention` ... as before).

- **Drafts**: `bl.insert_draft`, `store_recalculated`, `delete_draft`, `by_create_request`, `prev_bill`, `carried_from`, `end_caps`.
  The quantity and the total are stored exactly as the computation produced them (`getattr(comp, kind.quantity)`, `comp.total`).
- **Automatic generation**: `bl.auto_generate(kind, db, now, AutoHooks)`, `bl.due_periods`, `bl.record_run`, `bl.AutoOutcome`
  (`energy_billing.AutoOutcome` and `water_billing.AutoOutcome` are now that one class). What differs per kind is an `AutoHooks` record
  the wrapper builds at call time with lambdas over its own module names, so the test seams stay: replacing
  `energy_billing.insert_draft` / `compute` / `get_bill` / `get_provider` / `now_utc` or `water_billing.compute` / `provider_for` /
  `now_utc` still replaces what the pass calls. Water keeps its module switch (`enabled` hook), electricity its draft notification
  (`draft_ready` hook, ELECBILL77). The idempotency rule is unchanged and now single: the run row is written in the draft's transaction
  and re-checked under the write lock.
- **Retention**: `bl.retention(kind, db, now, data_dir)`. Same keys (`energy.draft_retention_days` 30, `energy.bill_retention_years`
  7), same cuts, same statements, the stored PDFs (electricity) removed after the commit; the number ledger and the run rows stay.
- **History (F26)**: new `bl.period_bills(kind, conn, account_id, periods)` - one `SELECT` of the account's non-void bills in the span of
  the periods, split into "sealed" (highest revision among issued / sent / paid: what `period_kwh` / `period_m3` read) and "shown"
  (highest revision that is not void: the bill of the history row). `period_kwh` / `period_m3` take an optional `sealed=` map; without
  it they look the one period up exactly as before (callers outside the history are unchanged). `energy_billing.account_history` and
  `compute_history`, `water_billing.account_history` use it: **61 -> 2** (electricity: the periods once, the comparison once) and
  **50 -> 1** (water) bill statements for a 24-period history. Ties of revision inside one exact period cannot be produced by the code
  (second draft, overlapping issue and second open correction are refused); on such legacy data the earlier-written row wins.

Kept as it was, on purpose (recorded, not changed):

- The two janitor throttles (`energy_billing.janitor`, `water_billing.janitor`) stay in their modules: their state is per module and is a
  test seam (`eb._LAST_AUTO`, `wb.reset()`), and water's runs behind its module switch and table probe.
- Retention deletes a document (any state) whose period ended before the first of the month `energy.bill_retention_years` back (owner
  setting, 7 years by default, 1..15). That is the existing feature and stays; what the new tests pin is that nothing inside those years
  is ever deleted, whatever its state or the age of its last change, and that the number and the run row stay after a deletion.
- `_int_setting` stays in `energy_billing` (the water router reads it there).

## 3. Tests

Written first and recorded on the unchanged code; the golden traces were recorded from the two hand-written copies before the move.

New `smplwise_vms/backend/tests/test_bill_ledger_lifecycle_b.py` (25 tests) with `tests/fixtures/bill_ledger_b_sql_golden.json`:

- golden traces per kind (statement text and order with bound values, ids and instants masked; the mode and label of every connection;
  log lines; results and errors): every draft operation and its refusals (`draft_exists`, `period_overlap`, `bill_not_draft`,
  `revision_conflict`), the carried end points; four automatic-generation passes over eight accounts (draft mode, issue mode with a
  refused issue (`number_taken`), an existing bill (`skipped`), off and paused accounts, an account created mid-period, a failure with
  retry (`vat_missing`), an internal error (logged, retried), an account changed during the computation (left for the next pass), a
  draft written by another pass meanwhile (`draft_exists` -> `skipped`)); three retention runs (drafts, nothing due, the years cut with
  PDFs);
- money rules on a real database (foreign keys on): auto-issued bills carry the computed quantity and total strings exactly
  (`776.20` kWh / `36.125` m3, `497.33`), due date and system issuer, audit `auto_draft` + `auto_issue`; auto-issued electricity and
  water bills of one customer and month never share a number (`/2`); a re-run, a pass after the retry window, the janitor right after a
  restart (throttles empty) and a person's deleted draft never generate twice; a crash after the draft write leaves no bill and no run
  row, then four concurrent passes make exactly one draft per period (both kinds);
- retention: issued / sent / paid / void documents with a years-old last change are kept until the exact cut (kept at
  2033-10-31 23:59:59 UTC, deleted at 2033-11-01 00:00:00 for a period ending 2026-10-01), the draft window is exact to the second
  (`updated_at` equal to the cut is kept), the number ledger and the run rows stay, a later pass never regenerates the deleted period.

Added to existing files (F26, written before the change, measured 61 / 50 there):

- `test_energy_billing_api.py::test_account_history_reads_the_bills_once_and_equals_the_per_period_reading` (with and without money):
  the batched history equals the per-period reading (oracle in the test: the old loop over the per-period path) with a void original, its
  sealed correction and a draft; 2 bill statements.
- `test_water_billing_s3.py::test_account_history_reads_the_bills_once_and_equals_the_per_period_reading`: sealed original plus an open
  correction draft; 1 bill statement.

Runs (local workstation, repo venv Python 3.12, `pytest -p no:xdist`, one file at a time; fixtures only, no device):

| Test file | Before (unchanged code) | After |
|---|---|---|
| `test_bill_ledger_lifecycle_b.py` (new) | 19 passed; the 6 golden tests recorded the traces (then 25 passed on a re-run) | 25 passed |
| `test_bill_ledger_cross_kind.py` (step A) | NOT_RUN | 11 passed |
| `test_energy_billing_api.py` | the 2 new history tests: equal answers, count assertion failed with 61 statements (the measurement) | 37 passed |
| `test_water_billing_s3.py` | the new history test: equal answer, count assertion failed with 50 statements (the measurement) | 20 passed |
| `test_energy_billing_engine.py` | NOT_RUN | 17 passed |
| `test_energy_bill_opening_reading.py` | NOT_RUN | 10 passed, 2 skipped |
| `test_energy_elecbill77.py` (auto drafts + notification) | NOT_RUN | 23 passed |
| `test_energy_tou_billing.py` | NOT_RUN | 19 passed, 2 skipped |

The 4 skips are the workstation's PDF-rendering environment skips (as in step A), not related to this change. `ruff check` (the
project's `F` rules) on the six touched Python files: clean.

## 4. NOT_RUN

- The full backend suite: on the runner entry check (queued, see the report).
- Other suites that reach the billing modules (`test_energy_bill_pdf_*`, `test_energy_integration.py`, `test_energy_manual_readings.py`,
  the router suites): NOT_RUN locally.
- No lab, device, payment provider or runner write.

## 5. Rollback

Revert the branch commits. No data, schema or API change.
