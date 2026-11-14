# CR-ACTIVE-USER-REST-2438 - every per-user "active" check uses the one definition

Branch `pilot/CR-ACTIVE-USER-REST-2438`, stacked on `pilot/CR-ADMIN-GATE-2438` @ `fcc8060bd` (which is stacked on
`pilot/CR-RBAC-EVAL-2438`); merge order: RBAC-EVAL, ADMIN-GATE, this one.
Lead decision (answer to question 1 of CR-ADMIN-GATE-2438): apply `services/active_users` (owner decision O16 a: disabled on either
side is not active) to the remaining places, even where authorize() already refuses first - one definition, no drift.

## What changed

`services/active_users` gains `has_active_account(conn, uid)`: an Arx account (a `users` row) with `users.active = 1` and not
disabled on the Home Assistant side. It is for the callers that always required a `users` row (they refused an unknown id) and keeps
that; `is_disabled` (no row = not disabled) is for the callers that always let a row-less principal through.

| Place | Before | Now |
|---|---|---|
| `routers/me._active` (`/me.active`) | users only, no row = active | `not is_disabled` |
| `services/door_authority.check` (the door rule) | users only | `is_disabled` -> `user_inactive` |
| `services/door_windows.identity_refusal` (window + emergency writes) | users only | `is_disabled` -> `user_inactive` |
| `services/door_windows` approver re-check of a running window | users row + active | `has_active_account` |
| `services/door_window_triggers._actor_ok` | users row + active | `has_active_account` |
| `services/door_automation.armer_reason` | users row + active | `has_active_account` |
| `services/door_path._user_active` | both sides (inline) | `has_active_account` (same rule, shared) |
| `services/wiskey_auto_door._principal` | users row + active | `has_active_account` |
| `services/intercom_parity.principal_of` | users row + active | `has_active_account` |
| `services/emergency/access.Viewer.held` | users only, no row = active | `not is_disabled` |
| `services/emergency/engine._reachable_contacts` | users row + active | `has_active_account` |
| `services/maintenance/access.Viewer.anywhere` | users only | `not is_disabled` |
| `services/ha_user_auth.policy_refusal` (remote channel) | both sides (inline) | `is_disabled` (same rule, shared) |
| `services/presence.by_token` (a phone's device token) | users only | `is_disabled` |
| `services/schedule_view` (`owner_inactive`) | users only | `is_disabled` |
| `services/access_grants` recovery actor + approver re-check | users row + active | `has_active_account` |
| `services/bridge_key_notice` owner contacts | users row + active | `has_active_account` |
| `services/partner/core.token_view` (`owner_gone`) | users row + active | `has_active_account` |

The lead named seven places; the sweep found these eighteen per-user reads of the same kind (an exact grep for one user's active
flag, plus the door / emergency reads that select it with other columns). All of them are in.

Safety: a local (Arx-only) user has no `ha_users` row and keeps working on every path (tested on the door rule, the window /
emergency person rule, the trigger actor, door path, auto-door principal, parity, the emergency view). The service identity is a Home
Assistant user with no Arx row: it is never "an Arx account" (tested), and nothing that judged it before changes.

## Not in this branch (follow-up)

Lists of active users - `SELECT id FROM users WHERE active = 1` over all users, about 25 sites: recipient lists (elevator,
temperature, water, generator, insights, notify, notices, maintenance reminders, WhatsApp), pickers (alarm, tickets admin, calendar,
scenarios, home interface, access request), counts (`fleet_report`, `access_readiness`), the SQL joins `u.active = 1`
(`home_family`, `presence_people`, `readiness`, `partner/core.py:650`, `out_documents`) and the reads that select `active` together
with `deleted_at` / `source` (`capture_lease`, `cast_sessions`, `service_identity`, `calendar_feeds`, `calendar`, `local_identity`,
`local_passkeys`, `push`, `notify_visibility`, `presence.py:679`). They are a set-based change (a JOIN / `NOT IN ha_users WHERE
is_active = 0`) best done once with `CR-RECIPIENTS` merged (its `notify_recipients.active_user_ids` is one of them).

## Tests (local, Windows, py 3.12 `.venv`, `-p no:xdist`)

- New `tests/test_active_user_rest_2438.py` (13, one per place or group, plus a no-drift guard that fails if any module reads one
  user's `users.active` on its own again): before the fix 11 failed, 2 passed (the door rule already refused through authorize(); the
  remote policy was already two-sided); after it 13 passed.
- Regression: `test_door_automation_295.py`, `test_doorwin_api.py`, `test_doorwin2_roles.py`, `test_doorwin2_review2.py`,
  `test_emergency_readiness_295.py`, `test_intercom_parity.py`, `test_maintenance_215.py`, `test_me_permissions.py`,
  `test_remote_hardening.py`, `test_remote_access.py`, `test_presence.py`, `test_partner_api_113.py`,
  `test_bridge_key_activation_295.py`: all passed except one, `test_partner_api_113.py::test_sec217_global_failure_flood_never_locks_out_a_valid_token`
  (expects 300 x 401 then 429 from a time-window limiter). It fails the same way on the base `fcc8060bd` without this branch (re-run
  alone, both ways), so it is not caused here; most likely the loaded workstation is too slow for the window. Left to the runner.
- NOT_RUN locally: the full suite and lint (runner entry check).
