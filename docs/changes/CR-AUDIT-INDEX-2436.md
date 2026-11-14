# CR-AUDIT-INDEX-2436 - review indexes (migration 0216) and the audit row id

Branch `pilot/CR-AUDIT-INDEX-2436`, from `origin/main` at 665ec8f24. Code review 2026-11-13, master plan section 3.2
(wave 1, backend), findings 05:P1-04, 05:P2-12, 01:F-09. Single database owner of the wave. No version bump. Behaviour
identical: indexes change query plans only; the audit row id is the one the removed lookup found.

## Migration number

`0216_review_indexes.sql`. Checked at start: the highest on `origin/main` is 0215; `git ls-remote --heads origin 'pilot/*'`
(564 branches) and `git ls-tree` of each tip showed no migration numbered 0216-0299 on any pushed pilot branch.

## What changed

| File | Change |
|---|---|
| `smplwise_vms/backend/smplwise/migrations/0216_review_indexes.sql` (new) | five `CREATE INDEX IF NOT EXISTS` (below) |
| `smplwise_vms/backend/smplwise/audit.py` | `_write_audit` and `audit` return the new row's id (`cursor.lastrowid`); callers that ignore the return value are unaffected |
| `smplwise_vms/backend/smplwise/services/media_commands.py` | `_audit_keys` and `_audit_limited` take the id from `audit(...)` instead of `SELECT MAX(id) FROM audit_log WHERE action = ...` right after the insert (a full scan per key window) |
| `smplwise_vms/backend/tests/test_query_plans.py` (new) | `EXPLAIN QUERY PLAN` assertions, written first (red without 0216, green with it), plus the idempotency check of the file |
| `smplwise_vms/backend/tests/test_home_v3_followup_a.py` | the 0215 test pinned 0215 as the *last* number; it now checks 0215 exists once (the next number is 0216). Outside the row's file list; needed by any new migration |

Indexes (each only for a lookup the reports show as a full scan today):

| Index | Serves |
|---|---|
| `idx_audit_action_at ON audit_log (action, at)` | ~25 lookups filtering on `action` (capture lease, anchors presence view, access external, WisKey install, media windows ...) |
| `idx_nvr_changes_batch ON nvr_changes (batch_id, batch_index) WHERE batch_id IS NOT NULL` | `services/nvr_batch.py` (13 queries by batch) |
| `idx_notifications_source ON notifications (source, state)` | the monitors' open-row lookups (`notify_sources.py:219` and the others) |
| `idx_notifications_dedupe ON notifications (dedupe_key)` | `tickets/store_dash_extra.py notification_key_seen` (any state; the existing unique index is partial on open rows) |
| `idx_ticket_visits_assignment ON ticket_visits (assignment_id, created_at) WHERE assignment_id IS NOT NULL` | `tickets/store_visits.py latest_for_assignment`, `latest_missed` |

`lastrowid` and read-mode: `audit()` on a read-mode connection writes through `write_aside()`; it now returns that side
connection's `lastrowid`, i.e. the row it just wrote. A trigger insert does not change `lastrowid` after the statement ends.

## Not done (NOT_RUN)

- **Write-cost evaluation: NOT_RUN, pending lab row counts.** The row asks for row counts from a read-only lab database copy
  to decide which candidate indexes are worth their write cost. No lab copy was available and the lab was not touched, so
  only the five clearly needed indexes above were added. Waiting for the counts: `idx_audit_actor (actor_user_id, id)` (05:P1-04),
  the 22 foreign-key child columns (05:P2-12), the other F-09 ticket columns (`ticket_cost_files.ticket_id`,
  `tickets.duplicate_of`, `ticket_assignments.contact_id`, `ticket_events.actor_contact_id`, `ticket_outbox.link_id`). No
  index was dropped.
- Runner entry check: not queued (per instruction).

## Tests (workstation, `-p no:xdist`, project venv Python 3.12.10)

Run from `smplwise_vms/backend` with `python -m pytest -p no:xdist -p no:warnings -q -rf <files>`:

| Run | Outcome |
|---|---|
| `tests/test_query_plans.py` **without** 0216 (red, written first) | 16 failed (every plan assertion + the idempotency check) |
| `test_query_plans.py test_migrations.py test_home_v3_followup_a.py test_db_template.py` | 35 passed, exit 0 |
| `test_media_commands.py test_media_players_commands.py test_refusal_audit_throttle.py test_access.py test_tickets_mgrdash_summary.py test_tickets_visits.py` | 139 passed, exit 0 |

NOT_RUN: the full backend suite, the rest of `test_media_*`, the pixel gate (no UI change), the runner entry check.

## Rollback

Revert the commit. The indexes are harmless if left behind on a database that already ran 0216; to remove them,
`DROP INDEX IF EXISTS` each of the five names. `schema_migrations` keeps version 216.
