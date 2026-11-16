# CR-TK-EXCEPT-LOG-2440

Code review 2026-11-13, wave 3A backend. Finding 01:F-11 (broad handlers that return a default without logging). Plan row:
`pilot/CR-TK-EXCEPT-LOG-2436` in `private/code-review-2026-11-13/MASTER_PLAN.md`.
Base: `origin/pilot/CR-WAVE2-COMBINED-2439` @ `97080bbc4`. Independent of the other three branches of this agent (no shared
file).

Every default is kept: no return value changed. Only the exception type caught and the logging changed. Where a type was
narrowed, an unexpected error now surfaces instead of reading as the default - that is the point of the finding.

## What changed

Rule used: **narrow** where the cause is known and the code under the `try` can raise nothing else by design; otherwise keep
the broad handler and **log**. Logs on paths that handle contacts, numbers, codes, keys or webhooks carry the exception TYPE
only (the convention of these files: never a value that could hold a number or a token); infrastructure reads (settings,
counters) log with `exc_info` at debug level.

| File | Site | Before | After |
|---|---|---|---|
| `vendor_portal.py` | `enabled`, `closed_months`, `require_confirmed`, `start_worker` | four `except Exception` copies around the same `settings_doc.read` | one `_cfg(conn, key, default)`; catches `sqlite3.Error` (the document always carries every key), debug log; `enabled` reads the module switch under its own `sqlite3.Error` handler. Same defaults: off / 2 / ON / off |
| `vendor_portal.py` | `number_key`, `request_code` (the key of a code), `derive_for_outbox`, `verify`, `session` | `except Exception` around `KEYS.current` / `KEYS.get` | `except (ModuleKeyError, OSError)` - no key, a damaged or unreadable key file. Same answers (`None` / `"nokey"`) |
| `vendor_portal.py` | `derive_for_outbox` (the code row read) | `except Exception` "a database before 0105" | `except sqlite3.Error` |
| `budgets.py` | `scope_label` (site / building name) | `except Exception` | `except sqlite3.Error` |
| `code_flow.py` | `channel_still_allowed` | silent `return False` | logged (type), like the first check 80 lines above |
| `contact_reports.py` | `render` (provider body), `on_outcome` | logged without the cause | the exception type is added to the line |
| `contact_reports.py` | `render` (document link), `still_relevant` | silent | logged (type) |
| `readiness.py` | the account mapping, the e-mail configuration | silent | debug log with traceback (new module logger `smplwise.tickets.readiness`) |
| `public_runtime.py` | `configure` (pin the prefix, check the key), the portal switch refresh, the code policy refresh | silent `pass` / return | debug log with traceback |
| `public_runtime.py` | the janitor's RFQ code retention | `except Exception: pass` "a database before 0089" | a missing table stays silent (`store.table_missing`); any other failure is a warning (type); the janitor goes on as before |
| `create.py` | `_partner_hook` | silent `pass` | warning (type) (new module logger `smplwise.tickets.create`) |

Left as they are (already logged, or already narrowed by TICKETS-PERF-ERASE-2435): `vendor_portal.request_code` (the enqueue failure),
`vendor_portal.prune`, `vendor_portal.forget_contact`, `code_flow.code_channel_for`, `code_flow.send_code`,
`public_runtime.build_app` / `start` / `stop`.

## Recorded decisions (no owner question open on this row)

- The four portal switches stay fail closed on a database failure; a failure of any other kind (a schema key removed by
  mistake, a type error) now raises. Both halves are pinned by the new `tests/test_tickets_except_log.py`.
- `public_runtime.py` keeps an unused import of `ModuleKeyError` (01:F-17 lists it; not this row).
- The 56 other broad handlers of the review's sweep (63 rows, 7 files here) live in files this row does not list; they are
  for the closing chain (3B) if wanted.

## Resolved file list

`smplwise_vms/backend/smplwise/services/tickets/`: `vendor_portal.py`, `budgets.py`, `code_flow.py`, `contact_reports.py`,
`readiness.py`, `public_runtime.py`, `create.py`. `smplwise_vms/backend/tests/test_tickets_except_log.py` (new). This note.

Outside my rows: nothing.

## Tests actually run (workstation, Python 3.12 venv, `pytest -p no:xdist`)

- `tests/test_tickets_except_log.py` (new, unit): **12 passed, 0 failed**.

Static: the changed files parse and have no new unused import / undefined name (a small `ast` check; ruff is not installed in
the workstation venv).

## NOT_RUN

- The four files the plan row names - `test_tickets_vendor_portal.py`, `test_tickets_budgets.py`, `test_tickets_codes.py`,
  `test_tickets_public_app.py` - are NOT_RUN at the time of this commit (the workstation was short on memory); a follow-up
  commit on this branch records their result if they are run here, otherwise they are left to the combined entry check.
- Runner entry check: not queued (batch rule: push only).
