# Home Assistant 2026.10 compatibility note - usernames and ingress

Branch `pilot/HAUSER-295` (from `release/2111`). Source: `docs/release/UPSTREAM_WATCH_2026-10-21.md` on `origin/pilot/UPSTREAM-295`.
Paths are under `smplwise_vms/backend/smplwise/`. Nothing was run against a live Home Assistant or Supervisor; this is a code review plus unit tests with fakes.

## Summary

HA 2026.10 trims and lower-cases usernames. Arx identity is keyed by the HA user **id** everywhere (`users.id`, `ha_users.id`, bindings, tokens, bridge directory). No path found can create a duplicate Arx user or fail a sign-in because of a lowercase rename. The username-string comparisons were already normalised by commit b763aa27b (`normalize_username` / `same_username`, strip + casefold). One residual comparison (`ha_user_admin.username_in_use`) was fixed here.

## Comparisons

| # | Location | What is compared | Verdict | Risk |
|---|---|---|---|---|
| 1 | auth.py:154-166 `touch_user` (upsert `ON CONFLICT(id)`) | row by HA user id; username only overwritten | id-based | none: a rename updates the row, no duplicate (test added) |
| 2 | auth.py:119-141 `resolve_principal` (Ingress headers) | `X-Remote-User-Id` is the identity; name is display only | id-based | none |
| 3 | auth.py:173-181, 193 `maybe_bootstrap` vs add-on option `bootstrap_admin_username` | username | case-insensitive (strip + casefold both sides, `same_username`) | none; tests exist |
| 4 | routers/access.py:1173-1178 audit filter by actor | `actor_username` | case-insensitive (SQL function with the Python normaliser) | none; old mixed-case audit rows still found |
| 5 | services/ha_user_auth.py:984-994 remote principal | user by id from `ha_users`/`users`; username display only | id-based | none |
| 6 | routers/ha.py:665-675 bridge directory push | `INSERT ... ON CONFLICT(id)`; active flag mirrored by id | id-based | none |
| 7 | routers/ha.py:715-727 `_apply_directory_to_users` | `pushed.get(users.id)` | id-based | none |
| 8 | routers/access.py:511-512 | `users` row created from `ha_users` by id | id-based | none |
| 9 | services/local_identity.py:152-159 `username_key`, 1151-1157 sign-in (`lower(u.username) = ?`, source `local` only) | Arx-only usernames, stored lowercase by `USERNAME_RE` | case-insensitive (key normalised, rows lowercase) | none; never an HA user |
| 10 | routers/local_identity.py:474-477 `_username_taken` | new Arx-only name vs `users` (`lower(trim())`) and vs `ha_users` (Python `username_key`) | case-insensitive; the HA side uses the full casefold | none (names are ASCII-only by regex) |
| 11 | routers/ha_users.py:230-235 create duplicate check (`lower(username) = ?`) | body username (pattern `^[a-z0-9]...` already lowercase) vs mirror and managed rows | case-insensitive for ASCII | none |
| 12 | services/ha_user_admin.py:242-247 `username_in_use` | typed name vs HA `config/auth/list` | was `.lower()` without trim (case-insensitive); now strip + casefold, empty never matches | low; **fixed** (6 lines) |
| 13 | routers/ha_users.py:365 `confirm_username != row["username"]` (UI: frontend/src/screens/system-ha-users.ts:188,307) | typed delete confirmation vs the managed row | case-sensitive, but the stored name is always lowercase (pattern) | none: fails closed, only friction if someone types capitals; left as is (UI change needed too) |
| 14 | services/service_identity.py:429, 606 and custom_components/.../config_flow.py:113 | `.strip().lower()` of **user ids** (hex), not usernames | id-based | none |
| 15 | display-only uses: routers/access.py:385-391,482; services/device_activity.py:247,299; tickets/store.py:45; wall.py:185; temperature.py:173 | name shown | not a comparison | none |
| 16 | `wiskey_username`, `go2rtc_api_username`, `nvr_username` options | credentials of other systems, not HA users | n/a | none |

Stored data note: old rows may keep mixed-case `users.username`/`audit_log.actor_username`; `users.username` is refreshed from the next request or directory push. Nothing is migrated.

## panel_admin and Supervisor 2026.10.2

`smplwise_vms/config.yaml:29` declares `panel_admin: false`. Per the watch report, Supervisor PR 7308 makes ingress sessions honour `panel_admin` (403 for a non-admin on panels that set it). I did not have the Supervisor source here, so that behaviour is taken from the report, not verified. With `false`, a non-admin HA user keeps the sidebar entry and the ingress session; with the old default `true` they would be refused. 2026.10.1 adds a sliding expiry for ingress sessions and 2026.10.3 filters ingress identity headers case-insensitively (we read `X-Remote-User-*`; no change expected).

What the code relies on: ingress trust is by peer address (`trusted_proxies`) plus `X-Remote-User-Id` (auth.py:119-141); no code reads an admin header or requires an HA admin for ingress. Authorisation is Arx RBAC (bindings), not the HA admin flag. The HA admin flag (`ha_users.is_admin` from the directory) is used only to gate HA user management (routers/ha_users.py:66-68, 337), delegated automation authoring (services/automation_scope.py:222) and the door-automation helpers, none of which are ingress admission. So a non-admin can open the product through ingress and sees what their bindings allow; they cannot use HA user management. Not done: the real non-admin ingress check on a 2026.10 Supervisor (required by AGENTS.md) - NOT_RUN, needs the lab after the update.

## Fix and tests

- services/ha_user_admin.py `username_in_use`: strip + casefold via `normalize_username`; empty name matches nothing.
- tests/test_username_normalisation.py: `test_username_in_use_is_normalised_and_an_empty_name_matches_nothing`, `test_a_username_case_change_keeps_one_user_row_keyed_by_id`. File run: 10 passed (including the pre-existing 8).

## Not done

Live non-admin ingress test; frontend delete-confirm case handling (row 13, proposal only: casefold on both sides in the route and the two UI lines, about 5 lines); other test files not re-run.
