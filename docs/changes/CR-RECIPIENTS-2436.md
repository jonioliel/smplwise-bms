# CR-RECIPIENTS-2436 - one recipient expansion and validation, a rule registry, managers() in one query

Branch `pilot/CR-RECIPIENTS-2436`, from `origin/main` at 665ec8f24 (v2.43.4). Code-review master plan 2026-11-13, section 3.2
(wave 1, backend), theme T4. No migration, no version bump, no frontend change, no device or lab action.

## Findings covered

| Finding | What changed | Behaviour |
|---|---|---|
| 04:F03 | New `services/notify_recipients.py` with `expand(conn, rec, routable_roles, ...)` and `validate(conn, rec, field, routable_roles, ...)`. The temperature, water and elevator modules call it; each keeps its own `AlertsInvalid` class, role text, limits and field paths. `temperature_alerts._expand` stays as a one-line wrapper (old private name). Water no longer imports temperature's private function. | Identical: same SQL (statement text kept, one `now` per expansion), same order (named users, group members, direct role holders, role holders through a group, `dict.fromkeys`), same active-user filter, same check order and texts. The elevator save still reads the active users and the groups once per save (`notify_recipients.Known`). |
| 04:F18 | `services/notify.py`: the 13-branch `if / elif` in `recipients_for` became `RECIPIENT_RULES` (rule name -> `fn(conn, n)`) plus `register_rule()`. Rules of other modules are small entries that import the module on call and look `recipient_users` up at call time (modules import `notify`, so `notify` still must not import them at load). | Identical: same callables, same arguments (the two ticket rules still pass the rule name), same fallback to `user_ids` for an unknown rule, same visibility step after it. |
| 04:F05 (managers part) | `notify.managers()` builds the principals from one `SELECT id, username, display_name FROM users WHERE active = 1 ORDER BY id` (`_active_principals`) instead of one `principal_of` query per active user. | Identical holders and order; the principals equal what `principal_of` builds (tested). The rest of F05 belongs to `CR-NOTIFY-FANOUT-2436`. |
| 04:F02 (behind a flag) | `generator_alerts.recipient_users` calls the shared `expand` with explicit parameters `ROLE_EXPANSION = {"role_via_groups": False, "role_expiry": False, "active_only": False}`, then its unchanged `generator.view` check. | Identical to today (O1 pending): user bindings only, `expires_at` not looked at, inactive users dropped at the `principal_of` / `generator.view` step. O1 (a) is the one-line change `ROLE_EXPANSION = {}`; two tests in `test_notify_recipients.py` already show what it would change. |

The generator's own `_validate_recipients` (roles + users, its own `RoutingInvalid` shape) is not one of the three validation copies in F03 and
is left as it is.

## Files

- new `smplwise_vms/backend/smplwise/services/notify_recipients.py`
- `smplwise_vms/backend/smplwise/services/notify.py` (lines 148-223 region only: `_active_principals`, `managers`, the rule registry, `recipients_for`)
- `smplwise_vms/backend/smplwise/services/temperature_alerts.py`, `water_alerts.py`, `elevator_alerts.py`, `generator_alerts.py`
- new `smplwise_vms/backend/tests/test_notify_recipients.py`
- this note

## Tests

New `tests/test_notify_recipients.py` (written first): the expansion table (named user, group member, role held directly, role binding
that expires later, role through a group, expired, revoked, deny, inactive named user, inactive role holder, a role that may not be routed),
order and duplicates, the generator parameters (today's rule) and what the corrected parameters would change, the validation refusals and
canonical form, each module keeping its own texts, the elevator reading users / groups once per save, the rule registry (every rule
named, a registered rule, the `user_ids` fallback, lazy lookup at call time), `managers()` in one users query and principal parity.

## Runs (local Windows workstation, Python 3.12.10, the repo venv, one process, no xdist; machine shared with other agents)

1. Row tests + new file, after the change:
   `pytest -p no:cacheprovider tests/test_notify_recipients.py tests/test_elevator_alert_recipients_295.py tests/test_water_alerts_s2.py
   tests/test_infra_temperature.py tests/test_infra_temperature_phase3.py tests/test_infra_temperature_report.py
   tests/test_temperature_registry_295.py tests/test_generator.py tests/test_notify_core.py tests/test_notify_sources.py`
   -> **289 passed, 0 failed** (exit 0; of which `test_notify_recipients.py` = 36, collected separately).
2. Touched area suite, after the change:
   `pytest -p no:cacheprovider -o addopts= -q tests/test_genalert_295.py tests/test_generator_home_widget.py tests/test_genlog_092.py
   tests/test_infra_elevators.py tests/test_infra_elevators_280.py tests/test_infra_elevators_travel.py tests/test_tempexplain_093.py
   tests/test_shift114.py tests/test_notify_channels.py tests/test_notify_email.py tests/test_notify_payload_golden.py
   tests/test_notify_schedule_hook.py tests/test_notify_sensors.py tests/test_notify_whatsapp.py tests/test_maintenance_215.py
   tests/test_notices_push_295.py tests/test_calendar_attendees_2343.py tests/test_tickets_rfq_notify.py tests/test_tickets_notify_matrix.py
   tests/test_bridge_key_activation_295.py tests/test_water_meters_s1.py tests/test_water_billing_s3.py`
   -> **608 passed, 0 failed** (1:38 h under load).

A pre-change baseline run of the row tests was started and stopped unfinished (machine at 100 % CPU); it is NOT_RUN. Whole backend suite: NOT_RUN.

## Skipped / NOT_RUN

- `services/tickets/notify_matrix.py` (the fourth copy) is not touched: it adopts the helper in `CR-TK-ROUTER-COMMON` (plan theme T4).
- The F02 correction itself (owner decision O1) is not applied.
- No runner entry check was queued (the lead combines the wave-1 branches). No pixel work (row says "Pixels: no").
- No ruff / pyflakes in the local venv; unused imports were checked by hand (`now_iso`, `copy`, `principal_of` still used where imported).
