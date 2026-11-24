# MFA-RESET-HARDENING-2510 - the administrator's factor reset, hardened (second-factor train slice 10)

Branch `pilot/MFA-RESET-HARDENING-2510`, cut from `origin/pilot/MFA-TRAIN-2500` at `8d9faa6e3` (the integrated train after
MFA-SECFIX-2500). Target 2.51 with the rest of the train. Backend only: the screens are MFA-SCREENS-2510's (section 5 lists what this
slice exposes for them). No version bump, no changelog entry, no tag, no lab / Home Assistant / NVR / go2rtc contact.

Inputs: the train plan (`docs/changes/MFA-STEPUP-TRAIN-2490.md` on `origin/pilot/MFA-STEPUP-2490`, row 10), the design
`docs/design/full-2fa-t095/DESIGN.md` (sections 4.2, 4.6, 6, 8.1 T5 / T11, 8.3; `origin/pilot/FEATURE-DESIGNS-SEC-2490`),
`docs/changes/MFA-SECFIX-2500.md` (SR-2: the reset already removes every factor kind and its proofs and tells the user),
`docs/changes/MFA-SECREVIEW-2500.md`, the owner's answers of 2026-11-24 (Q2 = b step-up OFF by default; Q5 "never ask for
re-confirmation unless I switched it on"; Q14 no forced re-enrolment after a recovery-code sign-in), owner decision Q53 (2026-11-22).

## 1. Owner decision Q53 and its risk (recorded)

**Q53: an administrator may reset another user's authentication methods from ANY channel, with the administrator's own approval.**
The security recommendation was the local network only (`security.factor_reset_channel = local`); the owner kept "from anywhere"
(his earlier answer q28 ב). Built as decided: `security.factor_reset_channel` defaults to `any`.

**Risk (design T5).** Anyone who steals a signed-in administrator session **and** can satisfy that administrator's own step-up (their
authenticator code, passkey or phone key) can strip another user's factors from outside the building, end that user's sign-ins and
then - if they also know or can reset that user's password - take the account. With `local`, the same attacker would also need to be
on the local network. Mitigations in this slice (none of them removes the risk; they shrink and expose it):

| Mitigation | Where |
|---|---|
| the administrator's own **fresh, action-bound** proof on every call (once-action, never the 5-minute window) - unchanged, as it always was | `step_up.once_proof` |
| a **typed confirmation** of the target's username, checked server-side before the proof is read | `factor_reset.confirm_matches` |
| **3 resets per administrator per hour**, counted from the durable audit rows; the fourth is refused and audited | `factor_reset.resets_left` |
| the target is told (inbox, push) **and the managers are told** (new source `security.second_factor_reset_by_admin`) | `notify_sources` |
| every sign-in and every device credential of the target ends at once (the administrator's "sign out everywhere") | `admin_reset` |
| the target must enrol again (`must_enroll`) - an attacker cannot ride on the HA-MFA path of the policy afterwards | `factor_reset.must_enroll` |
| never the last system administrator who can sign in remotely | `factor_reset.last_admin_blocks` |
| the owner can switch to `local` at any moment; switching back to `any` is possible **only from the local channel** | `settings_patch/identity.factor_reset_channel` |
| the audit row names the administrator, the target, the channel and the setting in force | `auth.second_factor.reset` |

Residual: a stolen administrator session plus that administrator's second factor (a phished code, an unlocked phone) is enough to
reset up to three users an hour from outside. Accepted by the owner (Q53).

## 2. What changed

### 2.1 `DELETE /api/v1/auth/second-factor/users/{user_id}` (routers/second_factor.admin_reset)

Body `{confirm, code?}` (`confirm` is new and REQUIRED). The checks, in this order (each refusal is an `auth.second_factor.reset`
row with `decision = denied` and the reason; no typed value and no code is ever written):

| # | Check | Answer when it fails |
|---|---|---|
| 1 | `system.configure` at the installation (as before) | 403 (audited by `require`) |
| 2 | not the caller's own account (as before; now audited, reason `self`) | 409 `second_factor_self_reset` |
| 3 | the user exists (users directory, else the HA user list) | 404 `user_unknown` (new; before, an unknown id "reset" nothing) |
| 4 | the channel: `security.factor_reset_channel = local` refuses a remote request | 403 `factor_reset_local_only` (reason `local_only`) |
| 5 | `confirm` present | 422 `factor_reset_confirm_required` (`details.field = confirm`) |
| 6 | `confirm` = the target's username (NFC, trimmed, case-insensitive; the user id when the account has no username) | 422 `factor_reset_confirm_mismatch` |
| 7 | the last-administrator rule (2.3) | 409 `factor_reset_last_admin` |
| 8 | at most 3 allowed resets by this administrator in the last hour | 429 `factor_reset_rate_limited` (`details = {limit: 3, window_s: 3600}`) |
| 9 | the per-user action limiter (as before) | 429 `rate_limited` |
| 10 | the administrator's own proof - **unchanged** (owner answers 24.11: the reset always asked): the current code in `X-Arx-Second-Factor` / `{code}`, or a once-proof from `POST auth/step-up/verify {action: "auth.second_factor.reset"}`; nothing for an administrator with no method | 403 `second_factor_step_up_required` (`details.once = true`) / 400 `second_factor_invalid` / 429 `second_factor_locked` |

Checks 2-8 run before the proof is read, so a refused request never spends the administrator's once-proof or code.

After the reset (on top of SR-2's removal of every factor kind, the proofs, the HA / Arx-only sign-ins and the device tokens):

- `presence.end_on_sign_out(..., everywhere=True)` - the same call as the administrator's "sign out everywhere"
  (`DELETE /auth/sessions?user_id=`): the phones' device tokens **and push registrations** end, queued pushes are dropped
  (`presence.device.credentials_ended`, reason `second_factor_reset`);
- `must_enroll` is set for the user (2.4);
- the user's notice `security.second_factor_reset` (as before, when a factor was there) and, new, the managers' notice
  `security.second_factor_reset_by_admin` on every reset (content-free: the channel only; never the user, the administrator or a
  secret - the audit row carries the ids);
- the audit row gains `device_credentials_ended`, `managers_notified`, `must_enroll`, `reset_channel`, `resets_left`.

The answer (`FactorReset`) gains `sign_ins_ended`, `device_credentials_ended`, `must_enroll` (always true), `resets_left`.

### 2.2 `GET /api/v1/auth/second-factor/users/{user_id}/reset-check` (new, `system.configure`, read only)

The preflight for the reset dialog (`FactorResetCheck`): `allowed`, `reason` (the first refusal the reset would meet: `self`,
`user_unknown`, `local_only`, `last_admin`, `rate_limited`), `confirm_text` (what to type), `channel` (`any` | `local`), `remote`
(this request came from outside), `resets_left`, `rate_max`, `factors` (`totp`, `passkeys`, `device_keys` active, `recovery_codes`
unused - what a reset would remove), `must_enroll_after` (the user's policy requires a factor), `step_up` (the once-action details:
`{action, methods, minutes: 0, once: true, verify_path}`). Spends nothing, writes nothing.

### 2.3 The last-administrator rule (precise)

`factor_reset.last_admin_blocks(conn, target, remote_on)` refuses the reset when **all** hold:

1. the target is a system administrator (`rbac.is_system_admin`: an active installation-wide `system_admin` allow-binding);
2. the target can complete a new remote sign-in **now** (`signs_in_remotely`: the remote channel is on, the user is active and not a
   wall-only user, the remote policy admits them, and the second factor does not stop them - they hold a factor, or their policy does
   not require one, or the enforced sign-in policy's `ha_mfa` path applies and HA MFA was seen for them);
3. **after** the reset they could not (their factor policy requires a factor, so the next remote sign-in goes to enrolment);
4. **no other** active system administrator can sign in remotely now (the caller counts when they are one).

So a reset never leaves the installation without an administrator who can sign in from outside, unless that was already so before it.
The local channel (Ingress) is the break-glass path either way (design T11). Limits: "can sign in remotely" is Arx's own view - it
does not ask Home Assistant whether the password still works, and an administrator who never made a request (no `users` row) is not
counted (conservative: it refuses more, never less). `remote.require_mfa_admin` (HA's own MFA flag) is not part of the check.

### 2.4 `must_enroll` (migration 0224 `auth_factor_resets`)

Set by an administrator's reset; cleared by the user's next enrolment of any factor (the code confirmed, a passkey - HA user or
Arx-only - or a phone key registered); while set it counts only if the user still has no factor. Effects:

- a NEW remote sign-in of a Home Assistant user whose factor policy requires a factor goes to enrolment: 403
  `second_factor_enrollment_required` with `details = {"must_enroll": true, "reason": "admin_reset"}` (cookie exchange and bearer
  sign-in). Under the enforced sign-in policy (`security.factor_policy_mode = enforce`) HA's own MFA (`ha_mfa`) no longer satisfies
  it until an Arx factor is enrolled again - and no Home Assistant call is made for that refusal;
- an Arx-only identity already goes to its enrolment gate when the policy requires a factor (unchanged);
- with a policy that does not require a factor the sign-in goes ahead; the account screen sees `must_enroll`.

**Owner Q14 kept:** only an administrator's reset sets the flag. A sign-in with a recovery code never does (tested).

Table: `auth_factor_resets(user_id PK, reset_at, reset_by, must_enroll)`. In `backup.NEVER_EXPORTED_TABLES` (runtime security state of
this box) and in `local_privacy.DELETE_ROWS`. Number 0224 follows the train's 0223 (RENUMBER AT MERGE only if the order changed).

### 2.5 `security.factor_reset_channel` (`any` | `local`, default `any`)

`settings_store.DEFAULTS`, `PATCH /settings` (`SettingsPatch`), `backup.SETTINGS_KEEP` (a restore never changes it). Handler
`settings_patch/identity.factor_reset_channel`: a system administrator only (403 `forbidden`, audited); narrowing to `local` from any
channel; **widening to `any` only from the local channel** (403 `local_only`, audited `security.factor_reset_channel` reason
`remote_channel`) - a stolen remote administrator session cannot undo the owner's `local` and then reset from outside. Every change
is audited (`security.factor_reset_channel`), plus the generic `settings.update` row. A settings change, so the step-up gate applies
while step-up is on.

### 2.6 The extra once-actions (slice 3's open question 7; design 4.2 `step_up_once_actions`; owner Q5)

A **role change to system administrator** and a **backup restore** need a once-proof **only while step-up applies** to the caller
(`step_up.not_applicable(...) is None`: the switch on, the channel covered, a method to prove with). With step-up off - the owner's
default (Q2 = b) - nothing is asked, exactly as before the train. When it applies, the 5-minute window does not count for them: each call
needs the caller's own current code in `X-Arx-Second-Factor` or a once-proof from `POST auth/step-up/verify {action}` (60 s, one use).

| Action | Where it is checked |
|---|---|
| `rbac.system_admin.assign` | `rbac_admin.insert_binding` (the choke point of every new binding: single, group, bulk, HA-user creation, ...) for a `system_admin` allow-binding; `PUT /access/groups/{id}/members` when members are added to a group that holds `system_admin`; declared before the authorisation (one prompt) in `POST /access/bindings` and `POST /ha-users` (before anything is created at Home Assistant); checked before the savepoint in `POST /access/bindings/bulk` |
| `backup.restore` | `POST /backups/{name}/restore`, `POST /backups/offbox/restore` (declared before `require`, re-checked after it) |

Mechanics (`services/step_up.py`): `STEP_UP_ONCE_ACTIONS`, `ANY_ONCE_ACTIONS` (= the always-once-actions + these), `declare_once`,
`require_once_when_on`; `guard()` asks the declared once-proof instead of the window proof (one 403, one prompt); the refusal is 403
`step_up_required` with `details = {action, methods, minutes: 0, once: true, verify_path}` (the shell's step-up dialog already sends
`details.action` to verify, so it gets a once-proof and retries once). Audit: `auth.step_up.required` with `details.once = true` /
`auth.step_up.failed` for a wrong inline code. `verify` (code, passkey, phone key) gives once-proofs for them; a recovery code is
refused for them (`NO_RECOVERY_ACTIONS`). Known limit: the group-binding and bulk routes authorise in a dependency before the body is
read, so with step-up on and no window proof a caller may see the window prompt first and then the once prompt.

### 2.7 Other

- `GET /auth/second-factor` (own): `must_enroll`, `must_enroll_enforced`. `GET /auth/second-factor/users`: `must_enroll` (user ids).
- `tests/test_settings_patch_audit_order.py`: the validator table pins `security.passkeys_all_users` (slice 4 had added it without
  updating the pin - the test was red on the train head) and the new `security.factor_reset_channel`.
- `tests/fixtures/bill_ledger_b_sql_golden.json`: the new notice source's policy row.
- Existing tests that reset a factor now send `confirm` (10 files); two of them read the username from the new preflight.

## 3. Files

Backend: `services/factor_reset.py` (new), `migrations/0224_factor_resets.sql` (new), `routers/second_factor.py`, `services/step_up.py`,
`services/ha_user_auth.py`, `services/rbac_admin.py`, `routers/access_bindings.py`, `routers/access_groups.py`, `routers/ha_users.py`,
`routers/backup.py`, `routers/backup_offbox.py`, `routers/device_keys.py`, `services/user_passkeys.py`, `services/local_passkeys.py`,
`services/notify_policy.py`, `services/notify_sources.py`, `services/settings_store.py`, `services/backup.py`, `services/local_privacy.py`,
`routers/settings.py`, `routers/settings_patch/__init__.py`, `routers/settings_patch/identity.py`, `wire/second_factor.py`.
Generated: `frontend/src/api/generated/wire-second-factor.ts`, `contracts/API_INVENTORY.md`.
Tests: `tests/test_mfa_reset_hardening_2510.py` (new); updated `test_second_factor.py`, `test_second_factor_followups.py`,
`test_security_review_220.py`, `test_mfa_stepup_2490.py`, `test_mfa_stepup_gates_2490.py`, `test_mfa_secfix_2500.py`,
`test_mfa_secreview_2500.py`, `test_mfa_recovery_codes_2490.py`, `test_capture_lease_triggers.py`, `test_local_identity.py`,
`test_settings_patch_audit_order.py`, `fixtures/bill_ledger_b_sql_golden.json`.

## 4. Tests (real runs)

Workstation (Windows, Python 3.12, the project venv), each file in its own pytest process with its own `--basetemp` (deleted after),
`-o addopts=""`, at `d98180f8b` + the W-1 limiter fix (`bfb32affc`):

| File | Result |
|---|---|
| `test_mfa_reset_hardening_2510.py` (new) | **22 passed** (first run found a duplicate-binding test bug, fixed before the commit) |
| `test_mfa_secfix_2500.py` | 16 passed, 1 failed at `d98180f8b`: `test_w1_...` - the loop over `NO_RECOVERY_ACTIONS` (now 11 actions) ran into the verify route's 10 per 5 minutes; fixed in the test (`bfb32affc`, clears the limiter per action); the test re-run alone: **1 passed** |
| `test_mfa_secreview_2500.py` | 8 passed |
| `test_mfa_stepup_2490.py` | 22 passed |
| `test_mfa_stepup_gates_2490.py` | 19 passed |
| `test_mfa_passkeys_2490.py` | 26 passed |
| `test_mfa_tokens_2490.py` | 22 passed |
| `test_mfa_recovery_codes_2490.py` | 21 passed |
| `test_mfa_policy_2490.py` | 70 passed |
| `test_mfa_devicekey_2490.py` | 19 passed |
| `test_mfa_devicekey_attest_2490.py` | 23 passed |
| `test_second_factor.py` | 23 passed |
| `test_second_factor_followups.py` | 11 passed |
| `test_security_review_220.py` | 37 passed |
| `test_settings_patch_audit_order.py` | 8 passed (was red on the train head: the slice-4 validator was not pinned) |

Generators on the workstation: `scripts/gen_wire_types.py` (wrote `wire-second-factor.ts`), `scripts/api_inventory.py` (+1 route).
Not run on the workstation (PC memory rule): ruff, `test_capture_lease_triggers.py`, `test_local_identity.py`,
`test_bill_ledger_lifecycle_b.py`, the wider backend families - they are in the runner job below.

Runner (slot B): ONE job `~/work/mfareset_run.sh` (the 22 MFA / auth files above plus `test_capture_lease_triggers`, `test_local_identity`,
`test_bill_ledger_lifecycle_b`, `test_migrations*`, `test_local_auth_inventory`; `gen_wire_types --check`; ruff; then the auth / identity /
remote / access / app-session / bridge-key / backup / security / wire / settings / rbac / notify-policy / privacy / presence families in
shards of 40, each pytest with its own `--basetemp`, deleted after). Queued 13:15 UTC; slot B stayed taken by other jobs until 16:12 UTC
(the 3-hour box): **NOT_RUN**. The lease is still queued; when it runs, results land in `~/work/mfareset-out/summary.txt` (the job
checks out the branch head when it starts).

Known red on the train head before this slice (seen in MFA-SECFIX-2500's runner job, not caused here): `test_migrations_263_upgrade::
test_the_release_numbers_are_contiguous_and_final` (the train skips 0217 / 0218 until the merge; 0224 continues that) and
`test_local_auth_inventory::test_identity_dependencies_outside_principal_are_listed` (`GET /auth/tokens`, slice 6).

## 5. For MFA-SCREENS-2510 (what the screens need; nothing of it is built here)

1. **The reset dialog** (user drawer › account security › "reset authentication methods"): call
   `GET auth/second-factor/users/{id}/reset-check` first. `allowed = false` -> show the reason (`self` -> point to "remove" in My
   Account; `local_only` -> "only from the local network"; `last_admin` -> "this is the last administrator who can sign in from
   outside"; `rate_limited` -> "3 per hour"); `factors` lists what will be removed; ask the administrator to type `confirm_text`;
   `must_enroll_after` -> "the user will have to set up two-step verification again at the next remote sign-in".
2. **The reset call** must send `{"confirm": <typed>}` (plus `code` / the `X-Arx-Second-Factor` header as today). Today's
   `frontend/src/api/second-factor.ts::resetFactor(userId, ownCode?)` sends NO body - against this backend it gets 422
   `factor_reset_confirm_required` until the screens slice adds the field. The two slices must ship together.
3. New error codes to translate (he + en): `factor_reset_confirm_required`, `factor_reset_confirm_mismatch`, `factor_reset_local_only`,
   `factor_reset_last_admin`, `factor_reset_rate_limited`, `user_unknown` (404 on the reset); the server's Hebrew `user_message` is set.
4. The answer's `sign_ins_ended`, `device_credentials_ended`, `resets_left` for the done text.
5. **My Account**: `GET auth/second-factor` -> `must_enroll` (banner "an administrator reset your sign-in methods - set them up again"),
   `must_enroll_enforced` (the policy requires it).
6. **Sign-in screen**: 403 `second_factor_enrollment_required` with `details.must_enroll = true` -> the same enrolment hint with "an
   administrator reset your methods".
7. **Admin factor list**: `GET auth/second-factor/users` -> `must_enroll` (user ids still to enrol after a reset).
8. **Settings** (Users & permissions › two-step verification): `security.factor_reset_channel` `any` | `local` (system administrator
   only; switching back to `any` only works from the local channel -> 403 `local_only` from outside). `frontend/src/api/media.ts`'s
   settings type needs the key. The new notice source `security.second_factor_reset_by_admin` may need a label in the notification
   settings list if that list is hand-written.
9. **Step-up dialog**: nothing new - a 403 `step_up_required` with `details.once = true` for `rbac.system_admin.assign` /
   `backup.restore` goes through the existing dialog (it already passes `details.action` to verify).

## 6. Open questions (recommendation first; built to the recommendation)

1. **Typed confirmation is mandatory now.** (a) mandatory, the screens slice ships in the same release [built - the design's
   mitigation only works when it cannot be skipped]; (b) optional until the screens land.
2. **Widening the channel back to `any`.** (a) only from the local channel [built]; (b) from any channel like other settings.
3. **Managers' notice content.** (a) content-free (the channel only), like every other notice to the managers [built]; (b) name the
   user (more useful, breaks the "never a person in a managers' notice" rule of USR2 F7).
4. **Managers' notice on a reset that removed nothing** (the user had no factor; their sign-ins still end). (a) yes, every reset
   [built]; (b) only when something was removed.
5. **`must_enroll` under the enforced HA-MFA policy path.** (a) an Arx factor is required after an administrator's reset (HA MFA alone
   no longer satisfies) [built - the reset is the "the account may be compromised" moment]; (b) HA MFA keeps satisfying it.
6. **Group / bulk binding routes may prompt twice** (window, then once) while step-up is on. (a) accept, documented [built]; (b) move
   their authorisation out of the dependency (a wider change to slice 3's guard-first ordering).
