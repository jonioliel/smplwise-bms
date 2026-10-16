# USR1 — Home system users from Arx (create / deactivate / delete)

Status: design + implementation on `pilot/USR1` (provisional migration `0096`, the lead renumbers).
Owner request 2026-10-16 (board, thawed from the backlog): "users screen: a manager creates a user (name, password, Arx
role) and the system creates it in HA as a NON-admin user and binds Arx permissions; needs verification that the
add-on's token is authorised; develop against a fake; a live test only with the owner's per-action approval; about
10-30 users". The owner also asked for DELETE.

Hard limits of this task: no code of this feature has been run against a real Home Assistant (lab or HOME-OLIEL);
every test uses the in-process fake `smplwise_vms/backend/tests/fake_ha_users.py`; no lab token was read.

## 0. Recorded contradictions (not silently resolved)

| # | Source | Says | This design |
|---|--------|------|-------------|
| C1 | `docs/security/HA_IDENTITY_RBAC_HE.md` §1, §12 | No new password system; no write-back of HA groups / admin fields; "no button to change an HA password or make someone an HA admin"; "users are created in HA only" (also the notice on the users screen) | The owner request is the newer product decision. Arx never STORES a password (it passes through once to HA and is dropped), never changes the groups or the admin flag of an EXISTING user, never promotes anyone, and creates only `system-users` members. The `is_active` toggle and the delete apply only to users Arx itself created. **Needs an approved change request (CR) entry by the lead before release**; until then this branch is a pilot. |
| C2 | Same spec §2.3 | A site / building / floor administrator has no "HA management" | The task text says "site/system admins". The security spec has precedence: `users.ha_manage` is a SYSTEM permission (built-in `system_admin` only, never in a custom role, never delegable). |
| C3 | Same spec §8 | "Do not use an admin token to do what the user may not do" | Creating HA users is an HA-administrator act. The Arx actor must therefore hold `users.ha_manage` AND be an active HA administrator in the synced user directory (`ha_users.is_admin = 1`, pushed by the bridge). A non-admin HA user who is an Arx system admin is refused (`ha_admin_required`). The owner may relax this later; it is a single check. |
| C4 | `CR-017` §8.2 | Product writes to HA go through the bridge as the single enforcement point | This slice uses the WebSocket API with the add-on's token (or an owner-supplied admin token), the same path the add-on already uses for registries. The bridge path (a signed `smplwise_bridge.user_*` service calling `hass.auth` with the actor's `Context`) is the recommended hardening step once the owner's live check passes; it needs a bridge release. |

## 1. How an add-on can create / delete HA users at all

### 1.1 HA core commands (WebSocket only; there is no REST user API)

| Command | Arguments | Notes |
|---------|-----------|-------|
| `config/auth/list` | — | admin-only (`@require_admin`). Returns users: `id, name, username, is_owner, is_active, local_only, system_generated, group_ids, credentials[]`. |
| `config/auth/create` | `name`, `group_ids?`, `local_only?` | admin-only. Creates a user WITHOUT credentials. `group_ids` defaults to `[]` in the auth manager, so Arx always sends `["system-users"]`. There is no `is_admin` argument; admin = membership of `system-admin`, which Arx never sends. Caveat: on an installation with no owner yet the first created user becomes owner — impossible on an onboarded system, refused anyway because Arx requires a directory with an active HA admin. |
| `config/auth_provider/homeassistant/create` | `user_id`, `username`, `password` | admin-only. Adds username/password credentials of the built-in provider and links them. Errors: `not_found`, `system_generated`, `username_exists` (newer releases also refuse a non-normalised username). |
| `config/auth/update` | `user_id`, `name?`, `is_active?`, `group_ids?`, `local_only?` | admin-only. Refuses system-generated users; refuses deactivating the owner / removing the owner from admins. Arx sends ONLY `is_active`. |
| `config/auth/delete` | `user_id` | admin-only. `no_delete_self`, `not_found`. `async_remove_user` also removes the user's credentials (the provider forgets the username) and refresh tokens, and fires `user_removed` (the person integration clears the link). |
| `person/create` / `person/delete` | `name`, `user_id` / `person_id` | admin-only. The HA user screen creates a person with every user; Arx does the same (optional, on by default). |

Sources: `homeassistant/components/config/auth.py` ([H02] in `docs/research/SOURCES.md`),
`homeassistant/components/config/auth_provider_homeassistant.py`, `homeassistant/auth/__init__.py`,
`homeassistant/components/person/__init__.py`.

### 1.2 Which token may call them

- **Supervisor proxy token (`SUPERVISOR_TOKEN`, `http://supervisor/core/websocket`).** `config.yaml` already sets
  `homeassistant_api: true`. The Supervisor proxy authenticates the add-on and talks to core as the Supervisor's own
  system user, which the `hassio` integration creates in the `system-admin` group; `CR-017` §8.2 records the same
  belief ("that token is already admin-capable"). If that holds, the admin-only commands pass with no owner action.
- **Owner-supplied admin long-lived token (new optional add-on option `ha_users_token`).** Used only by this feature,
  on HA core directly (`ha_user_auth.core_ws_url`, never on the proxy), never logged or shown. The fallback when the
  Supervisor path is refused, or when the owner prefers that the changes be attributed to a named admin account.
- The browser never receives either token. The Ingress identity is never used as an HA credential.

### 1.3 Reused add-on plumbing

`services/ha_client.ws_session` (one authenticated WebSocket session, `url` / `token` overrides, token never logged),
`services/ha_user_auth.core_ws_url` (HA core on the Supervisor network), the bridge's signed directory push
(`routers/ha.bridge_directory` → `ha_users`, which supplies `is_admin` for C3), the RBAC binding pipeline
(`routers/access.validate_binding` / `check_delegation` / `insert_binding` / `revoke_one` / `keep_an_admin` /
`admin_count` / `_terminate`) and `audit.audit`.

### 1.4 VERIFIED vs NOT VERIFIED

VERIFIED (in this repository, by reading code and by tests against the fake):
- The add-on has `homeassistant_api: true`; `SUPERVISOR_TOKEN` is the `ha_token` inside the add-on; WebSocket goes to
  `http://supervisor/core/websocket` (`config.py`, `ha_client._ws_url`).
- `config/auth/list` is admin-only — recorded in ADR-012 and the identity spec from HA source.
- The bridge directory push carries `is_admin` per user (`routers/ha.py`).
- Arx's own logic: permission matrix, refusals, partial-failure compensation, idempotency, no password in logs /
  audit / answers — tests in `tests/test_ha_users.py` against `tests/fake_ha_users.py` (which speaks the HA WebSocket
  protocol through a patched `websockets.connect`, so the real transport code runs).

NOT VERIFIED (needs the owner's one-time live check, §6):
- N1 that the Supervisor proxy forwards the admin-only `config/auth/*` commands for this add-on on the owner's
  Supervisor / HA versions (2026.9.x / 2026.10.x);
- N2 the exact argument and result shapes and error codes listed in §1.1 on that HA version;
- N3 that a user created this way logs in to HA as a non-admin and reaches the Arx panel through Ingress;
- N4 that `config/auth/delete` removes the credentials (the username can be reused) and unlinks the person;
- N5 which HA account HA attributes the change to (Supervisor vs the admin token's account).

## 2. Design

### 2.1 Permission and actor

- `users.ha_manage` — label "ניהול משתמשי מערכת הבית: יצירה, השבתה ומחיקה". In `SYSTEM_PERMISSIONS`; in `roles.json`
  for `system_admin` only. Checked at installation scope on every route (audited refusal).
- Actor must also be an active HA administrator in the directory (C3). Dev mode: the dev user has no directory row,
  so it is refused like any non-admin (tests seed the directory).

### 2.2 Data (`migrations/0096_ha_managed_users.sql`)

`ha_managed_users(id, request_key UNIQUE, ha_user_id UNIQUE, username, display_name, role_id, scope_type, scope_id,
binding_id, person_id, state, repair, created_by, created_at, updated_by, updated_at, deleted_at)`.
`state ∈ creating | active | inactive | needs_repair | deleted`. Only rows in this table can ever be deactivated,
activated or deleted from Arx. Rows are tombstoned (`deleted`), never removed, so the audit trail keeps the id.
At most 50 live rows (the owner expects 10-30).

### 2.3 Create (`POST /api/v1/ha-users`)

Body: `display_name` (1-60), `username` (`^[a-z0-9][a-z0-9._-]{2,31}$`), `password`, `role_id`, `scope_type` /
`scope_id` (default installation), `create_person` (default true), `local_only` (default false), `request_key`
(optional idempotency key).

Order: permission → HA-admin actor → password policy → idempotent replay (same `request_key` returns the existing row
without calling HA) → limit → username free (directory and managed rows) → the Arx binding pre-validated with the
same checks as the bindings API (role known, scope exists, `check_delegation`) → a `creating` row committed → HA:
`config/auth/create` (`group_ids: ["system-users"]`) → `config/auth_provider/homeassistant/create` →
`person/create` (optional) → Arx: directory mirror row, user row, ONE binding (the chosen role and scope, nothing
else) → `active`.

Password policy (`services/ha_user_admin.password_problem`): 10-128 characters; not a single repeated character or a
keyboard / alphabet / digit run; not in a local denylist of common passwords; must not contain the username or a
word (3+ letters) of the display name. No outbound breach lookup (HIBP would need an outbound call). The password is
a `SecretStr`, passed once to HA and dropped: never stored, never in a log line, an audit row, an error payload or an
answer; a refusal names only the rule (`too_short`, `common`, ...).

### 2.4 Deactivate / activate (the safer default)

`POST /ha-users/{ha_user_id}/deactivate` and `/activate`, body `{"confirm": true}`. HA `config/auth/update
{is_active}`; Arx mirrors `users.active` / `ha_users.is_active` and ends the user's sessions on deactivate. The list
offers "השבתה" as the primary action, delete as the secondary one.

### 2.5 Delete

`POST /ha-users/{ha_user_id}/delete`, body `{"confirm_username": "<exact username>"}` (typed confirmation).
Refused: not in `ha_managed_users` (`not_managed`, also for the owner / any admin / any other user), oneself
(`self_target`), the last active Arx administrator (`last_admin`, dry-run before HA is touched), a target that HA
now reports as owner / admin-group member / system-generated, or that the directory shows as admin
(`target_not_safe`). Then `person/delete` (if linked) → `config/auth/delete` → Arx revokes every binding of the user
(`revoke_one`, audited), removes group memberships, marks the user inactive, tombstones the row and ends sessions.

### 2.6 Access check

`POST /ha-users/check` runs `config/auth/list` (admin-only) and stores `{state, checked_at}`; `GET /ha-users` returns
the last result. States: `ok`, `not_authorised`, `unavailable`, `not_configured`, `unknown`. The screen's
"not authorised" state tells the owner, in Hebrew, to provide an administrator token in the add-on's options
(`ha_users_token`) or to keep managing users in the home system's own screen.

### 2.7 Audit (ids only)

`ha_users.create | .activate | .deactivate | .delete | .check`, decision `allowed | denied | failed`, details:
row id, `ha_user_id`, `role_id`, scope, `person` (bool), outcome / refusal code. Never a password, username,
token or HA message text.

### 2.8 UI

הגדרות › משתמשים והרשאות › tab "משתמשי מערכת הבית" (only with `users.ha_manage`): access state line with "בדיקת
הרשאה", the list of Arx-managed users (name, username, Arx role and scope, state chip, created), "משתמש חדש" dialog
(name, username, password + repeat with the rule shown, role, scope, create person), "השבתה" / "הפעלה", "מחיקה" with
the username typed; empty / loading / error / forbidden / not-authorised states; tokens only, RTL, every skin (settings
styles). The wording says "מערכת הבית", never the platform's product name (owner rule; this is a settings screen
but the neutral wording is preferred). he + en strings in `frontend/src/i18n/ha-users.ts`.

## 3. Failure modes

| Case | Behaviour |
|------|-----------|
| HA refuses the token / admin command | `409 ha_not_authorised`; access state `not_authorised`; nothing created; the pending row removed |
| HA unreachable / timeout | `503 ha_unavailable`, retryable; pending row removed (or, after a created user, see below) |
| Username exists in HA | `409 username_taken`; the user created a moment earlier is deleted again (compensation) |
| Credentials step fails | compensating `config/auth/delete`; if that fails too: row `needs_repair` (`compensation_failed`) with the HA id |
| Person step fails | user kept (a person is optional); row `active` with `repair = person_missing` |
| Arx binding fails after HA created the user | compensating delete in HA; if it fails: row `needs_repair` (`binding_failed`) |
| Arx cleanup fails after the HA delete | row `needs_repair` (`cleanup_failed`); the next delete finds the user gone in HA (`not_found` = already deleted) and finishes |
| Same request sent twice | `request_key` replays the stored outcome; no second HA call |
| Repair | a `needs_repair` row offers "מחיקה" (retries the HA delete; `not_found` counts as done) |
| Deactivate / delete the last Arx admin, oneself | refused before HA is called |

Uniform errors: every refusal is the standard error envelope with a fixed Hebrew message and a code; HA's own error
text never reaches the answer.

## 4. Files

Backend: `smplwise/services/ha_user_admin.py`, `smplwise/routers/ha_users.py`, `smplwise/migrations/0096_ha_managed_users.sql`,
`roles.json`, `routers/access.py` (label + system permission), `config.py` + `config.yaml` + `DOCS*.md`
(`ha_users_token`), `main.py`. Tests: `tests/fake_ha_users.py`, `tests/test_ha_users.py`.
Frontend: `src/api/ha-users.ts`, `src/i18n/ha-users.ts`, `src/screens/ha-users-logic.ts`, `src/screens/system-ha-users.ts`,
`src/screens/system-access.ts`, `src/shell/nav.ts`, `src/screens/system-index.ts`, `tests/unit-ha-users.spec.ts`.

## 5. Rollback

Remove the router include and the tab; the table is inert. No HA state is touched by a rollback; users created
through Arx stay ordinary HA users (manageable in the home system's own screen).

## 6. The owner's one-time live check (needs explicit per-action approval)

Run on the owner's installation with a throw-away username, one step at a time, each approved separately:

1. Install the branch build; open הגדרות › משתמשים והרשאות › משתמשי מערכת הבית as an HA admin who is an Arx system admin.
2. Press "בדיקת הרשאה" (read-only `config/auth/list`). Expected `ok` (N1). If `not_authorised`: create an admin
   long-lived token for a dedicated admin account, put it in the `ha_users_token` option, restart, repeat.
3. Create `arx-test-1` (role viewer, installation, person on). In the home system's user screen check: the user exists,
   is NOT an administrator, belongs to "Users", has a person (N2, N3).
4. Log in as `arx-test-1` in a private window; the Arx panel opens with viewer rights only (N3).
5. Deactivate it in Arx; the login is refused; activate it; the login works again.
6. Delete it in Arx (type the username). Check: user and person gone; creating `arx-test-1` again works (N4).
7. Read the home system's logbook / the user list for who made the change (N5) and report the result. Record the
   outcome in this document (VERIFIED / NOT VERIFIED per N1-N5).
