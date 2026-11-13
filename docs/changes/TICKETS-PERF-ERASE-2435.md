# TICKETS-PERF-ERASE-2435 - tickets list reads, outbox queue index, erase failures

Branch `pilot/TICKETS-PERF-ERASE-2435`, cut from `origin/main` @ `665ec8f24` (2.43.4). Source: the backend tickets code review of
2026-11-13 (private review notes, items F-01, F-02, F-03). No version bump, no CHANGELOG entry, no migration, no schema change, no
API change. No device, NVR, media server or Home Assistant was contacted.

## F-01 - the module switch was read once per row on every list read

`access.visible()` reads the `tickets.enabled` setting (`module_on`, one `SELECT` on `settings`) and the paging loops called it per
candidate row. The review measured 51 of 63 statements on `GET /tickets` (and the same shape on `/tickets/table`, `/tickets/facets`,
`/tickets/board`, `/tickets/export.csv`).

Changed (`smplwise/services/tickets/access.py`, `rfq.py`): `visible_for_entity`, `visible_page`, `_table_scan` (table, facets, CSV
export, monthly report) and `rfq.visible_page` read the switch once per call and decide each row with `_decide()` - exactly what
`visible_many()` already did. When the switch is off every row decides `None`, as before, so the walk, the scanned count and the
returned cursor are unchanged too (the routes are behind `module_gate` anyway). `visible()` itself is unchanged for single reads.

## F-02 - the outbox worker's queries could not use their partial index

`idx_ticket_outbox_queue` is declared `WHERE state IN ('queued', 'held', 'sending')`. SQLite uses a partial index only when the
query's WHERE contains a term that implies its predicate; `state IN ('queued', 'held')` and `state = ?` are not proved to, so
`due()` (every 2 s worker check), `open_rows()` and `in_state('sending')` planned as `SCAN ticket_outbox`.

Changed (`smplwise/services/tickets/outbox_store.py`): the constants `QUEUE_INDEX_WHERE` / `QUEUE_INDEX_STATES`; `open_rows`, `due`
(both branches) and `any_open` carry the index's own predicate text beside their existing (narrower) condition; `in_state(state)`
adds it only for a state the index covers (any other state keeps the old query, so its rows cannot change). The narrower term
still decides the rows; `ORDER BY` is unchanged. Plans are now `SEARCH ticket_outbox USING [COVERING] INDEX idx_ticket_outbox_queue
(state=?)`. No migration.

## F-03 - erase and retention DELETEs swallowed every exception

`vendor_portal.forget_contact` and `portal_more.forget_contact` wrapped their DELETEs in `except Exception: pass` ("a database
before 0105 / 0112"), so a locked database or any other failure let `POST .../erase` answer `erased: true` while the portal code
rows (keyed number index) or the technician requests (a name and a number) remained.

Changed: `store.table_missing(exc)` (new helper - `sqlite3.OperationalError` with "no such table" only). In both `forget_contact`
functions a missing table is still ignored; any other failure is re-raised, which fails the whole erase transaction exactly like
the unguarded `DELETE FROM ticket_phone_verifications` beside it in `phone_verify.forget` always did (the request rolls back, the
route answers an error, nothing is half erased). In the two janitor functions (`vendor_portal.prune`, `portal_more.prune`) a
missing table stays silent and any other failure is now logged (`log.warning`, exception class only - no values) and the janitor
goes on, so retention behaviour is unchanged apart from the log line. Not touched here (same pattern, review F-03/F-11 list):
`phone_verify.kill_codes` (an UPDATE) and `public_runtime` prune.

## Tests

New:
- `tests/test_tickets_list_statement_guard.py` - F-01: every list route (`/tickets` x3 variants, `/tickets/table`, `/facets`, `/board`,
  `/export.csv`, `/tickets/rfqs`) for every caller of the mixed-permission seed answers byte-identically through the fixed path and
  through the pre-fix shape (switch re-read beside every `_decide`); the switch reads per request stay small and do not grow with
  the number of tickets; the device tab reads it once and decides the same; module off still yields nothing.
- `tests/test_tickets_outbox_queue_index.py` - F-02: over the real migrated schema with a row in every state and hold reason, the
  statements the code really sends (trace callback) plan through `idx_ticket_outbox_queue` with no `SCAN`; the old forms are shown to
  scan; rows and order equal the pre-fix SQL (kept verbatim) for `open_rows`, `in_state` (all nine states), `due` (on/off, three
  instants) and `any_open`, on four state mixes.
- `tests/test_tickets_erase_no_swallow.py` - F-03: a real `RAISE(ABORT)` trigger on `ticket_portal_codes` /
  `ticket_portal_tech_requests` makes `POST /tickets/contacts/{id}/erase` fail (no `erased: true`), the rows remain and the contact is
  not half erased; the service functions raise; a database without the tables still passes; the janitor logs and goes on; the
  successful erase is unchanged. These tests were also run against the pre-fix `vendor_portal.py` / `portal_more.py`: 4 of 7 failed
  there (the regression is caught).

### Runs (workstation, Windows, Python 3.12.10, repo `.venv`; the machine was at 100% CPU from other sessions)

- New tests: `python -m pytest tests/test_tickets_list_statement_guard.py tests/test_tickets_outbox_queue_index.py
  tests/test_tickets_erase_no_swallow.py` - 25 passed, 0 failed (12 + 6 + 7).
- Existing tickets tests, full `tests/test_tickets_*.py`: NOT_RUN locally - started, reached 2% in an hour under the load and
  was stopped. Left to the runner's entry check (`~/gate2/branch_check.sh`).
- Existing tickets tests, targeted (the files the review names for these areas: visibility, board, table, table_query, device, rfq,
  mgrdash_batch_visibility, mgrdash_batched_guard, msg_outbox, s5b_channel, vendor_portal, vendor_portal_more, phone_verify,
  s4_directory): PARTIAL at commit time - the first 39 tests passed, 0 failed; the rest had not finished.

## Rollback

Revert the commit. No data or schema change to undo.
