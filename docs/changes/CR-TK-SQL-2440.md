# CR-TK-SQL-2440

Code review 2026-11-13, wave 3A backend. Findings 01:F-14 (store-layer helpers and query builders copied) and 01:F-10
(run-time schema probes and "old database" shims). Plan row: `pilot/CR-TK-SQL-2436` in
`private/code-review-2026-11-13/MASTER_PLAN.md`. Base: `origin/pilot/CR-WAVE2-COMBINED-2439` @ `97080bbc4`.

Behaviour is unchanged on a migrated database. The two deliberate narrowings are listed under "Shims".

## What changed

### 01:F-14 - one copy of each helper (`services/tickets/_sql.py`, new)

| Helper | Replaces |
|---|---|
| `row_dict` | `_dict` in `store.py`, `store_costs.py`, `store_links.py`, `store_locations.py`, `store_quotes.py`, `store_rfq.py`; `_d` in `store_visits.py` |
| `insert` | `_insert` in `store_costs.py`, `store_quotes.py`, `store_rfq.py` |
| `like` | `store._like`, the two inline escapes in `store.candidate_rows` and the one in `store.purge_ticket` (the `ticket_requests` sweep) |
| `scope_clause(department_ids, user_id)` | the scope prefilter written twice in `store.py` (`candidate_rows`, `table_rows_unchecked`) |
| `text_clause(q)` | the free-text clause written twice in the same two functions |
| `has_table` | re-export of the cached `db.has_table` (CR-CORE-HELPERS-2438) |

Every store module imports the helper under its old private name (`_dict`, `_insert`, `_like`, `_has_table`, `_d`), so no
call site moved. `access.visible_page` now takes its scope-to-superset mapping from `access._table_superset` (the mapping
the table already used; same 403 for `all`, same empty answer when nothing can match).

`tests/test_tickets_sql_helpers.py` keeps the pre-change text of the scope and text builders verbatim and asserts the
helpers give the same SQL text and the same arguments for 8 scopes and 15 queries.

### 01:F-10 - probes

All 14 inline `SELECT 1 FROM sqlite_master ...` probes of the listed files, plus `store._has_table` (12 call sites), now ask
the one cached `db.has_table` (the answer is cached per database file and schema version; a table created later is seen at
once - pinned by a test):

- `out_documents.py` x4 (`outbound_documents`), `vendor_documents.py` x1 (`maint_tasks`);
- `store_links.py` x4 (`intercom_consent_requests`, `outbound_documents`, `ticket_rfq_links`, the loop in `key_ids_in_use`);
- `store_rfq.py` x4 (`has_postponements`, `has_attachments`, `has_vendor_files`, the instalment-demand delete);
- `store.py`: `_has_table` is now the same function.

**No probe was removed outright.** The plan row allows removal only where a test proves the object always exists; the proof
needed is "no test builds a partial schema and reaches this function", which needs the whole `test_tickets_*` set on the
runner (104 files; not run locally, see NOT_RUN). The new test `test_every_probed_table_exists_after_the_migrations` pins the
product-side half (all 17 probed tables exist after the migrations), so the closing chain (`CR-BE-DEAD-CODE`, plan section
5.3) can delete the guards and let the full suite name the fixtures to fix.

### Shims (01:F-10)

- `channel_email.mail_config`: `except Exception` -> `except sqlite3.Error`. The shim exists for a missing notification table;
  a programming error in `notify_settings.email_internal` is no longer read as "mail not configured".
- `notify_sources.module_on`: `except Exception` -> `except sqlite3.Error` (same reasoning; the shim is for a database without
  the settings table).
- `map_element.stored`: the `sqlite3.OperationalError` handler now ignores only "no such table" (`store.table_missing`, the
  helper of TICKETS-PERF-ERASE-2435); any other operational error propagates instead of reading as "nothing attached"
  (which `attach` would then treat as a first attachment).

For the lead: these three are of the "a narrowed type can surface a hidden error" kind (no owner question is open on this
row; the review's recommendation was taken). The return values on every path the tests exercise are unchanged.

## Resolved file list

`smplwise_vms/backend/smplwise/services/tickets/`: `_sql.py` (new), `store.py`, `store_costs.py`, `store_links.py`,
`store_locations.py`, `store_quotes.py`, `store_rfq.py`, `store_visits.py`, `access.py`, `out_documents.py`,
`vendor_documents.py`, `channel_email.py`, `notify_sources.py`, `map_element.py`.
`smplwise_vms/backend/tests/test_tickets_sql_helpers.py` (new). This note.

Outside my rows: nothing.

## Not done on purpose

- The probes in `vendor_portal.py` and `public_runtime.py` (01:F-10 shim list) belong to `CR-TK-EXCEPT-LOG-2440`.
- `store.py` keeps `_dicts` (a different function: the one-pass list builder of the manager dashboard).

## Tests actually run (workstation, Python 3.12 venv, `pytest -p no:xdist`)

One run, five files, **119 passed, 0 failed** (38 min on the loaded workstation):
`tests/test_tickets_sql_helpers.py` (new, 28 cases), `tests/test_tickets_table.py`, `tests/test_tickets_table_query.py`,
`tests/test_tickets_visibility.py`, `tests/test_tickets_api.py` - the four files the plan row names.

Static: every changed file parses and has no unused import / undefined name (a small `ast` check; ruff is not installed in
the workstation venv).

## NOT_RUN

- The whole `test_tickets_*` set (104 files) - the plan row's second test cell. Left to the combined entry check on the runner.
  Of the files that touch the changed code most directly, `test_tickets_delete.py`, `test_tickets_map_element.py`,
  `test_tickets_rfq.py`, `test_tickets_s5b_channel.py` and `test_notify_sources.py` were NOT run here.
- Runner entry check: not queued (batch rule: push only).
