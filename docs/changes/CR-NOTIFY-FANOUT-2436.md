# CR-NOTIFY-FANOUT-2436 - fewer statements per notification fan-out (code review 04:F05, the part outside notify.py)

Branch `pilot/CR-NOTIFY-FANOUT-2436`, cut from `origin/main` @ `665ec8f24` (2.43.4). Row: code-review master plan 2026-11-13,
section 3.2 (wave 1, backend). Behaviour is unchanged: the same targets, filters, reasons and order; only the number of SQL statements
changes. No version bump, no CHANGELOG entry, no migration, no API change. No device, runner, lab or Home Assistant action.

`services/notify.py` (`managers`, `recipients_for`, `escalation_targets`) and the alert modules belong to `pilot/CR-RECIPIENTS-2436`
and are not touched here; the `principals_of` / `active_principals` helpers added below are there for that branch to adopt.

## Finding (04:F05, the rest)

One notification to N recipients cost several statements per user on the notifier thread, per channel:

- `Dispatch.reach` built each principal with its own `SELECT ... FROM users WHERE id = ?` (`principal_of`).
- The Web Push plan read each user's subscriptions with one statement per user and the snooze row with another.
- The WhatsApp plan read the snooze row per user again, and in `resolved` mode one `notification_deliveries` lookup per user.
- `publish_ui` (the `/me/ws` frames) built one principal per listening user.
- The maintenance recipient rule (`reminders.recipient_users`) ran `principal_of` for every active user after selecting their ids.

## What changed

| file | change |
|---|---|
| `smplwise/services/notify_visibility.py` | `principals_of(conn, ids)` (one `IN (...)` statement per 500 ids, active users only, same `Principal` as `principal_of`) and `active_principals(conn)` (one statement, `ORDER BY id`). `principal_of` is unchanged (shares the row-to-principal helper). |
| `smplwise/services/notify_channels.py` | `Dispatch.reach` loads the principals of all `d.users` once on first use (an id outside `d.users` still goes through `principal_of`). New `Dispatch.snoozed_until(uid)`: the notification's snooze rows read once per dispatch into `d.scratch` and shared by the channels (the planning connection is one read transaction, so the value is the one the per-user lookup saw). `WebPushChannel.plan` reads the subscriptions of all recipients in one `IN` statement, grouped per user in `created_at` order. `publish_ui` builds its principals with `principals_of`. |
| `smplwise/services/notify_whatsapp.py` (`plan` only) | the snooze check uses `d.snoozed_until`; a resolve notice filters the recipients with one `SELECT DISTINCT user_id ... status = 'sent'` instead of one lookup per user (recipients' order kept). |
| `smplwise/services/maintenance/reminders.py` (`recipient_users` only) | iterates `active_principals(conn)` - the same users in the same `ORDER BY id`, one statement instead of N+1. |
| `smplwise_vms/backend/tests/test_notify_fanout_2436.py` (new) | the statement-count and equivalence tests below. |

What is NOT changed and still costs statements per user: the permission checks themselves (`Reach.can_see` -> `row_scope`, `can_ack` ->
`authorize`, `permissions_anywhere`) - they live in `rbac` / `services/access`, outside this row. They are now the whole remaining
per-user cost.

## Tests (written first, then the code)

`tests/test_notify_fanout_2436.py`, 5 tests:

1. `test_webpush_plan_for_200_users_...` - 200 operators (installation) + the notify world's users, every 10th with two subscriptions,
   two snoozed, one with a snooze in the past, one inactive, one whose binding was revoked. A spy runs a **reference copy of the
   pre-change per-user plan** and the real plan on the same dispatch and asserts the targets are identical (user, host, status,
   reason, subscription, order); then bounds the statements of the whole planning connection.
2. `test_principal_batch_matches_principal_of` - `principals_of` / `active_principals` equal `principal_of` for active, inactive and
   unknown ids, in id order.
3. `test_whatsapp_resolve_notice_filter_...` - 200 recipients, 5 reached before: the plan asks for exactly those 5, in order.
4. `test_snooze_lookup_is_read_once_per_dispatch` - one statement for 20 users plus an unknown id; values as stored.
5. `test_maintenance_recipients_for_200_users_...` - a floor task and a placeless task; the result equals a reference copy of the old
   `recipient_users` (same list, same order), the floor-2 managers of the crowd are included.

### Statement counts, before / after (same fixture; BEFORE run on `665ec8f24` with the new test file and the old service code)

| measurement | before | after |
|---|---|---|
| one dispatch, Web Push, 200 users: the whole planning connection | 2608 | 2008 |
| WhatsApp plan of a resolve notice, 200 recipients | 205 | 2 |
| `maintenance` recipient rule, floor task, 200 users + tickets world | 1057 | 846 |
| `maintenance` recipient rule, placeless task | not measured (the before run stopped at the floor-task assertion) | 213 |

The Web Push saving is exactly 3 statements per user (principal, subscriptions, snooze). The bounds in the test sit between the two
columns (`PLAN_BOUND = 2108`, `WA_RESOLVED_BOUND = 10`, `MAINT_BOUND = 906`).

### Runs (workstation, Windows, Python 3.12.10 from the main checkout's `.venv`, `-p no:xdist`, one file at a time)

Command per file: `python -m pytest tests/<file>.py -p no:xdist -o addopts="" -rfE -p no:cacheprovider -W ignore` (from
`smplwise_vms/backend`), on the final code of this branch:

| file | result |
|---|---|
| `tests/test_notify_fanout_2436.py` (new) | 5 passed |
| `tests/test_notify_core.py` | 27 passed |
| `tests/test_notify_channels.py` | 19 passed |
| `tests/test_notify_whatsapp.py` | 111 passed |
| `tests/test_maintenance_215.py` | 39 passed |

All fixture-based (fake push service, fake WhatsApp transport); no real device or service.

## NOT_RUN

- The runner entry check and the targeted gate (the lead combines the branches).
- Pixel gate (no UI change).
- The suites of other channels that build a `Dispatch` (`test_app_server_leftovers_2380.py`, `test_genalert_295.py`, e-mail / app /
  mobile push tests) - not in the row; the `Dispatch` constructor is unchanged (two defaulted fields added at the end).
- A 500-user measurement and any measurement on a real installation (the plan's 500-user fixture was replaced by the row's 200).

## Rollback

Revert the commit: no data, schema or setting is involved.
