# CR-BILL-LEDGER-A-2436 - one lifecycle for sealed electricity and water bills (step A)

Branch `pilot/CR-BILL-LEDGER-A-2436`, cut from `origin/main` at `665ec8f24` (2.43.4). Code review 2026-11-13, report 04, finding F04;
master plan section 3.2. Behaviour change: none. Pixels: no. No migration, no router, no frontend file.

## 1. Finding (04:F04)

The lifecycle of a sealed bill was written twice: `services/energy_billing.py` and `services/water_billing.py` each had their own
`number_for`, `seal`, `_check_version`, `mark_sent`, `mark_paid`, `void_bill` and `check_correctable`, differing only by table name,
quantity column (`kwh` / `m3`) and audit prefix. Both kinds share one number space (`energy_bill_numbers`), so a fix made on one side
only was a real risk for money documents.

## 2. What changed

New `smplwise_vms/backend/smplwise/services/bill_ledger.py` with a frozen `BillKind` record and the lifecycle written once. Each service
module holds its kind as a module constant `KIND`; table and column names come only from those two constants, never from input.

| `BillKind` field | electricity (`energy_billing.KIND`) | water (`water_billing.KIND`) |
|---|---|---|
| `table` / `events_table` | `energy_bills` / `energy_bill_events` | `water_bills` / `water_bill_events` |
| `quantity` | `kwh` | `m3` |
| `resource_type` / `audit_prefix` | `energy_bill` / `energy.` | `water_bill` / `infra.water.` |
| `correction_columns` | `*` (as before: `open_correction` selects `*`) | `id` (as before) |
| `number_tables` | `energy_bill_numbers`, `energy_bills` | `energy_bill_numbers`, `energy_bills`, `water_bills` |
| `account_table` | `energy_accounts` (the seal reads it first and names its id in the audit row) | none (the audit row names `bill.account_id`) |

Two commits, as the row asks:

1. **Marks and void** - `get_bill`, the bill event row, the audit row, `check_version`, `mark_sent`, `mark_paid`, `void_bill`,
   `open_correction`, `check_correctable`.
2. **Numbering and seal** - `overlapping`, `overlap_error`, `number_for`, `seal`.

Every public (and private) name of both modules stays, as a thin wrapper with the same signature: `get_bill`, `_event`, `_audit` (water),
`_check_version`, `mark_sent`, `mark_paid`, `void_bill`, `open_correction` (electricity), `check_correctable`, `_overlapping` /
`_overlap_error` (electricity), `overlapping` / `overlap_error` (water), `number_for`, `seal`. Routers and tests are unchanged.

Carried over literally: the statement texts and their order, the audit actions (`energy.bill.*`, `infra.water.bill.*`), the bill events,
the error codes and Hebrew messages, the details of every error. The clock stays each module's own seam: the `seal` wrappers pass
`lambda: now_utc()`, so a test that pins `energy_billing.now_utc` or `water_billing.now_utc` keeps pinning exactly what it pinned before.
The ledger reads the shared engine helpers (`_date`, `_iso`, `sha256_of`) from `energy_billing` at call time (late import: that module
imports the ledger at load time). The only textual difference is the indentation inside the triple-quoted `UPDATE ... SET state = 'issued'`
of the water seal (whitespace only; the golden comparison normalises whitespace).

Kept as it was, on purpose (recorded, not changed):

- The electricity `number_for` looks up the sequence and a taken number in `energy_bill_numbers` and `energy_bills` only, while water also
  looks in `water_bills`. Every water number is registered in `energy_bill_numbers` when it is sealed, so the electricity side sees it
  through the ledger; the difference matters only for a water row that carries a number without a ledger row (none is written by the
  code). Unifying the lists would add one statement per electricity issue; left for an explicit decision.
- `bill_actions`, `bill_summary`, `bill_dict`, drafts, automatic generation and retention are not in this step (step B,
  `CR-BILL-LEDGER-B-2436`, after this one has soaked one release).

Files (all under `smplwise_vms/backend/`): new `smplwise/services/bill_ledger.py`; `smplwise/services/energy_billing.py`;
`smplwise/services/water_billing.py`; new `tests/test_bill_ledger_cross_kind.py`; new `tests/fixtures/bill_ledger_sql_golden.json`
(the golden traces - a test-data file beside the test the row names); this note.

## 3. Tests

Written first, on the unchanged code; the golden traces were recorded from the two hand-written copies before the extraction.

New `smplwise_vms/backend/tests/test_bill_ledger_cross_kind.py` (11 tests) with `tests/fixtures/bill_ledger_sql_golden.json`:

- the cross-kind rule (asked by the lead): an electricity bill and a water bill of the same customer and month never share a number,
  electricity first and water first (`2026-09-CCCC` then `/2`, a third bill `/3`, both in the one ledger);
- corrections of both kinds keep their own base and never collide (`-2`, `/2-2`), the originals are void and point at the correction;
- a number already in another kind's table is refused as `number_taken`;
- per kind: the marks, the void and the correction check - error codes (`revision_conflict`, `bill_state`, `reason_required`, 404),
  messages, audit actions and events; a system seal is `auto_issue` with `issued_by: system`;
- per kind: a golden trace of every statement sent by `number_for`, `seal`, a correction seal, `mark_sent`, `mark_paid`, `void_bill`,
  `check_correctable`, `get_bill` and their refusals (text, order, bound values with ids and instants masked, and the ApiError raised).

Runs (local workstation, Python 3.12.10, `pytest -p no:xdist`, one file at a time; fixtures only, no device):

| Test file | Before (unchanged code) | After step 1 (`0ffef8af7`) | After step 2 |
|---|---|---|---|
| `test_bill_ledger_cross_kind.py` | 9 passed; the 2 golden tests recorded the traces | 11 passed | 11 passed |
| `test_energy_billing_engine.py` | NOT_RUN | 17 passed | 17 passed |
| `test_energy_billing_api.py` | NOT_RUN | 35 passed | 35 passed |
| `test_energy_bill_opening_reading.py` | NOT_RUN | 10 passed, 2 skipped | 10 passed, 2 skipped |
| `test_water_billing_s3.py` | NOT_RUN | 19 passed | 19 passed |
| `test_energy_tou_billing.py` (extra, calls `seal`) | NOT_RUN | NOT_RUN | 19 passed, 2 skipped |
| `test_energy_elecbill77.py` (extra) | NOT_RUN | NOT_RUN | 23 passed |

The 4 skips are environment skips of PDF rendering on this workstation (`pdftotext` / a PDF engine not available), not related to this
change. "Before" of the four named suites was not run separately: the golden traces are the before/after proof for the moved code.

## 4. NOT_RUN

- The full backend suite and the targeted gate on the runner (the lead queues the runner entry check; not queued from this branch).
- Other suites that reach the billing modules (`test_energy_bill_pdf_*`, `test_energy_integration.py`, `test_home_v3_followup_a.py`,
  the water and energy router suites): NOT_RUN here.
- Static check (ruff / pyflakes): NOT_RUN, not installed in the workstation venv; unused imports were checked by hand (none left).
- No lab, device or runner action.

## 5. Rollback

Revert the two commits. No data, schema or API change.
