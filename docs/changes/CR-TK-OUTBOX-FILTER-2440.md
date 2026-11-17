# CR-TK-OUTBOX-FILTER-2440

Code review 2026-11-13, wave 3A backend. Findings 01:F-16 (the outbox filters open rows in Python) and 01:F-22 (the outbox
line only). Plan row: `pilot/CR-TK-OUTBOX-FILTER-2436` in `private/code-review-2026-11-13/MASTER_PLAN.md`.
Base: `origin/pilot/CR-WAVE2-COMBINED-2439` @ `97080bbc4`. Independent of the other three branches of this agent (no shared
file).

Behaviour is unchanged: the same rows are selected, in the same order, and the state changes applied to them are untouched.

## What changed

### 01:F-16

- `outbox.OutboxStore` (the protocol) gains
  `open_rows_where(*, assignment_id=None, link_id=None, contact_id=None, ticket_id=None, use_key=None)`:
  the rows of `open_rows()`, in its order, that match every filter given (`None` = not filtered).
- Both implementations provide it:
  - `outbox.MemoryOutboxStore` (the reference store the tests use) filters its own `open_rows()`;
  - `outbox_store.SqliteOutboxStore` adds `AND <column> = ?` terms to the `open_rows()` statement (same index predicate, same
    `ORDER BY priority, not_before, created_at, id`), so the filter runs in SQL and only the matching rows are decoded.
- The three callers pass their filter instead of loading the whole open queue under the outbox lock:
  - `Outbox.enqueue` (supersede the older message of one assignment): `open_rows_where(assignment_id=...)`, purpose checked as
    before;
  - `Outbox.cancel_where`: `open_rows_where(link_id=..., contact_id=..., ticket_id=...)`, purposes checked as before;
  - `Outbox.open_count`: `open_rows_where(use_key=...)`, department checked as before.
- The worker (`tick`) still reads every open row: it needs them all.

### 01:F-22 (outbox line)

`outbox.py` (`enqueue`, the report rule): one condition line carried a run of 21 spaces where a line break was lost. It is now
two lines inside parentheses; the expression is the same.

## Resolved file list

`smplwise_vms/backend/smplwise/services/tickets/outbox.py`, `smplwise_vms/backend/smplwise/services/tickets/outbox_store.py`,
`smplwise_vms/backend/tests/test_tickets_outbox_filter.py` (new), this note.

Outside my rows: nothing.

## Tests

New `tests/test_tickets_outbox_filter.py`:
- both stores against one reference ("`open_rows()` filtered in Python", what the callers did before) over 72 seeded rows and
  21 filter combinations - the SQLite store on the real migrated schema;
- the SQLite read is one statement carrying the filter and is not a table scan;
- `enqueue` / `cancel_where` / `open_count` no longer ask for the whole open queue.

### Actually run (workstation, Python 3.12 venv, `pytest -p no:xdist`)

- `tests/test_tickets_msg_outbox.py` (the plan row's file; the in-memory store): **51 passed, 0 failed**.
- `tests/test_tickets_outbox_filter.py` (new; both stores): **3 passed, 0 failed** (a first run failed on the test's own seed -
  too few matching rows for its "the cases really select rows" guard; the seed was widened, the code was not touched).

Static: the changed files parse and have no unused import / undefined name (a small `ast` check; ruff is not installed in the
workstation venv).

## NOT_RUN

- `tests/test_tickets_s5b_channel.py`, `tests/test_tickets_outbox_queue_index.py` and the rest of the messaging suite
  (`test_tickets_msg_*`): not run here; left to the combined entry check.
- Runner entry check: not queued (batch rule: push only).
