# CR-TK-MONEY-UTILS-2440

Code review 2026-11-13, wave 3A backend. Finding 01:F-15 (validation and small utilities copied between the money modules).
Plan row: `pilot/CR-TK-MONEY-UTILS-2436` in `private/code-review-2026-11-13/MASTER_PLAN.md`.
Base: `origin/pilot/CR-WAVE2-COMBINED-2439` @ `97080bbc4`. Independent of `CR-TK-SQL-2440` (no shared file).

Behaviour is unchanged: same checks, same error codes and envelopes, same waits. No route, no schema, no setting.

## What changed

New `services/tickets/fields.py` (a leaf: clock helpers and text hygiene only):

| Helper | Replaces | How the module keeps its name |
|---|---|---|
| `text(value, field, max_len, *, refuse, multiline)` | `_text` in `costs.py` and `quotes.py` (identical) | `_text` is a one-line wrapper in both |
| `instant(value, field, now, *, horizon_days, refuse, future)` | `_instant` in `quotes.py` and `rfq.py` (the second had the `future` flag and its own horizon) | `_instant` is a one-line wrapper in both |
| `local_minute(iso, tz)` | `_local` in `export.py` and `costs_report.py` (identical) | `_local = fields.local_minute` |
| `local_text(at, tz, fmt)` | the `astimezone(...).strftime(...)` tail of `_local` in `quotes.py` and `rfq.py` | both keep `_local` and their own zone rule |
| `RateWindow(limit, window_s)` | the three per-user limiters of `export.py`, `costs_report.py`, `deletion.py` | `rate_check` / `mark` / `reset_rate` (exports) and `rate_wait` / `rate_mark` / `reset_rate` (deletion) stay as functions with the same signatures |

- The validators take the error factory as a parameter (`refuse(code, field)`): `costs._refused` builds the `CostRefused(422, ...)`
  of claims and quotes, `rfq._instant` passes its own 422 envelope (`rfq.invalid`).
- **Three limiter instances, never one bucket**: each module creates its own `RateWindow`. The exports use limit 1 per `RATE_S`
  (the old "time of the last successful export"), the deletion `RATE_PER_HOUR` per `RATE_WINDOW_S`. The limits are read through
  callables at every call, so each module's constants stay the single source (and a test can still change them).
- Imports that became unused were removed (`threading`, `time`, `collections`, `parse_utc` where nothing else used them).

## Left alone on purpose (recorded, not unified)

- `table._instant` is not a copy of the other two: it accepts only a strict pattern, has no range check, answers `""` for an
  empty value, parses a zone-less value as UTC and raises `TableError`. Folding it into `fields.instant` would change which
  filter values the table accepts. `table.py` is therefore untouched.
- `rfq_files._local(name)` is an XML helper (the local part of a namespaced tag) that only shares the name. Untouched.
- `quotes._local` keeps its own zone rule (an unknown zone shows UTC) and `rfq._local` keeps the messaging zone (an unknown zone
  shows the product default). The two rules differ, so only the formatting tail is shared; aligning them is a behaviour change
  for 01:F-07, not for this branch.
- `quotes._valid_until` (a date-or-instant rule of its own) is not a copy of `_instant`.

## Resolved file list

`smplwise_vms/backend/smplwise/services/tickets/`: `fields.py` (new), `costs.py`, `quotes.py`, `rfq.py` (`_instant`, `_local`
only), `export.py`, `costs_report.py`, `deletion.py`.
`smplwise_vms/backend/tests/test_tickets_fields.py` (new). This note.

In the plan row but not edited: `table.py`, `rfq_files.py` (reasons above). Outside my rows: nothing.

## Tests actually run (workstation, Python 3.12 venv, `pytest -p no:xdist`)

- `tests/test_tickets_fields.py` (new, unit; the pre-change text of every replaced helper is kept verbatim as the reference,
  the two limiters are walked against the old implementations over 600 / 1,500 random steps): **14 passed, 0 failed**.

Static: the changed files parse and have no unused import / undefined name (a small `ast` check; ruff is not installed in the
workstation venv).

## NOT_RUN

- The five files the plan row names - `test_tickets_costs.py`, `test_tickets_quotes.py`, `test_tickets_rfq.py`,
  `test_tickets_table.py`, `test_tickets_delete.py` - are NOT_RUN at the time of this commit (a run was in progress on the
  loaded workstation); a follow-up commit on this branch records the result if it completes, otherwise they are left to the
  combined entry check.
- Runner entry check: not queued (batch rule: push only).
