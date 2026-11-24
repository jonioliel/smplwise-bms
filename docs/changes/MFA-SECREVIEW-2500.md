# MFA-SECREVIEW-2500 - adversarial security review of the second-factor train (slices 1-8, before integration)

Branch `pilot/MFA-SECREVIEW-2500`, cut from `origin/pilot/MFA-STEPUP-2490` (`fb9a3ac1e`). Review only: no slice is changed here. The
branch adds this note and `smplwise_vms/backend/tests/test_mfa_secreview_2500.py` (failing tests, each `xfail` with its finding id,
non-strict; a test whose slice is not merged into the running branch is skipped by `importorskip`). No lab, no Home Assistant, no
runner job (the test server was unavailable); every test run below is a workstation run of that one file.

Binding references read: `AGENTS.md`, `CLAUDE.md`, `docs/security/` (`HA_IDENTITY_RBAC_HE.md`, `FABLE_REVIEW_REPORT_2026-10-21.md`),
`MASTER_SPEC_HE.md` (security chapters: silent on step-up), the train plan `docs/changes/MFA-STEPUP-TRAIN-2490.md`, and every slice's
own change note.

## Heads reviewed

| Slice | Branch | Head |
|---|---|---|
| 1 STEPUP-CORE | `origin/pilot/MFA-STEPUP-2490` | `fb9a3ac1e` |
| 2 STEPUP-UI | `origin/pilot/MFA-STEPUP-UI-2490` | `423f580c7` |
| 3 STEPUP-GATES | `origin/pilot/MFA-STEPUP-GATES-2490` | `e1cb887dc` |
| 4 PASSKEYS | `origin/pilot/MFA-PASSKEYS-2490` | `ca64a6fcd` |
| 5 POLICY | `origin/pilot/MFA-POLICY-2490` | `5f600505c` |
| 6 TOKENS | `origin/pilot/MFA-TOKENS-2490` | `cb75cae6c` |
| 7 RECOVERY | `origin/pilot/MFA-RECOVERY-2490` | `affa63886` |
| 8 DEVICEKEY | `origin/pilot/MFA-DEVICEKEY-2490` | `e2ba0bd69` read; tests run at `359f9f273` (only regenerated wire types since) |
| train | `origin/pilot/MFA-TRAIN-2500` (slices 1, 2, 4, 6 merged) | `3d0768add` |

## Confirmed findings (most severe first)

### SR-1 (high) - a passkey-only (or phone-key-only) administrator strips another user's factor with no step-up at all

- Where: `origin/pilot/MFA-TRAIN-2500` and `origin/pilot/MFA-PASSKEYS-2490` (passkey), `origin/pilot/MFA-DEVICEKEY-2490` (phone key):
  `smplwise/routers/second_factor.py:194-198` (`require_step_up` returns False when the administrator has no TOTP) called from
  `admin_reset` (`:217`, `:232`); `smplwise/services/step_up.py:65-66` (`DELETE /auth/second-factor/users/{user_id}` is in
  `EXEMPT_ROUTES`, so the window gate never runs either); `step_up.py:226` (slice 4 makes a passkey a step-up method, slice 8 a phone key).
- Attack: a stolen session of a system administrator whose only factor is a passkey (or a phone key). Every settings change of that
  session is gated (403 `step_up_required`), but `DELETE /auth/second-factor/users/<victim>` runs with no code and no proof: the
  victim's factor (and recovery codes on slice 7) is removed and their sign-ins end. This is exactly what security review 2.2.0 M1
  closed for TOTP administrators. Proven: `test_sr1_...` answers 200 `{"removed": true}` on the train head.
- Status with slice 3: closed. Merged locally with `pilot/MFA-STEPUP-GATES-2490` (one conflict in `step_up_verify` resolved by hand,
  throw-away worktree), `once_proof()` uses `methods_of()` and the test passes. For the phone key it then fails closed (device-key
  `verify_step_up` has no once-action path, so a phone-key-only administrator cannot reset at all - see W-2).
- Fix: never integrate slice 4 or 8 without slice 3 (or, if one ships alone: make `require_step_up` use `step_up.methods_of()` and
  refuse with `step_up_unavailable` when the administrator holds a method the route cannot check). Keep SR-1's test as the ratchet.

### SR-2 (medium) - "reset the second factor" leaves the user's passkeys and phone keys working

- Where: `routers/second_factor.py:234-235` on `MFA-TRAIN-2500` / `MFA-PASSKEYS-2490` / `MFA-DEVICEKEY-2490` (only `sf.remove` +
  `step_up.forget_user`); `services/device_keys.py:351` `revoke_all` exists but nothing calls it (deferred to slice 10);
  `services/ha_user_auth.py:1123` (DEVICEKEY) - under a `required` policy an active phone key is the sign-in factor.
- Attack: the user reports a compromise; an administrator resets the factor (owner Q53's recovery path). A passkey or phone key the
  attacker added stays: it still passes step-up (passkey, phone key) and still answers the sign-in factor (phone key under
  `required`), while the user is notified that their two-step verification was reset. Proven: after the reset `methods_of()` is
  `['passkey']` (train head), and `device_keys.has_active()` stays true (DEVICEKEY head).
- Fix: the administrator's reset removes every factor kind (TOTP, recovery codes, the user's passkeys, `device_keys.revoke_all`) and
  says which; or slice 10 (RESET-HARDENING) lands before slices 4 / 8 ship. The notice text should list what was removed.

### SR-3 (medium) - a first factor is enrolled from a stolen session (TOTP since K11; passkeys and phone keys new)

- Where: `origin/pilot/MFA-STEPUP-2490` `routers/second_factor.py:83` (`enroll`) and `:91-102` (`confirm` ends the user's other
  sign-ins, keeping the caller's); `origin/pilot/MFA-PASSKEYS-2490` `services/user_passkeys.py:178` (no proof while the account has no
  factor) and `:250` (the first passkey ends the other sign-ins); `origin/pilot/MFA-DEVICEKEY-2490` `routers/device_keys.py:64` (no
  proof while the user has no method).
- Attack: a session cookie of a user without a factor, stolen hours after its sign-in, enrols the thief's authenticator / passkey /
  phone key. The user's own sign-ins end, the thief's session stays, and from then on the thief owns the account's step-up method:
  the real user is asked for a code / passkey they do not have (TOTP: also at every new remote sign-in). Step-up was built to contain
  exactly a stolen session; this turns one into a persistent, exclusive hold. Proven on all three heads with a session aged one hour
  (`test_sr3_...`: enrolment starts with 200).
- Fix: enrolling a FIRST factor of any kind needs a recent authentication of the session (the sign-in within
  `lpk.RECENT_AUTH_S`, as Arx-only passkey registration already demands) - else 403 `reauth_required` and the user signs in again;
  and never end the user's other sign-ins silently: notify every device (as slice 8 does for a phone key).

### SR-4 (low) - one spent recovery code is laundered into a fresh batch of ten

- Where: `origin/pilot/MFA-RECOVERY-2490` `routers/second_factor.py:310` + `:319` (a recovery code at `step_up/verify` records an
  ordinary proof) and `:368` (`POST auth/recovery-codes` accepts any fresh proof), against the route's own rule "never a recovery code"
  (the body path refuses one: 400).
- Attack: session + one leaked code -> `verify {method: recovery_code}` -> `POST auth/recovery-codes` -> ten new codes that never
  expire, and the owner's remaining codes are voided. (Severity low because a recovery code can already remove the factor through
  `disable` - the lost-phone path - but this path keeps the owner's authenticator and silently replaces his recovery set.) Proven:
  `test_sr4_...` gets 200.
- Fix: record the method on the mark (it is already stored: `Mark.method`) and let `recovery_regenerate` accept only a proof whose
  method is not `recovery_code` (same for `sign_in` proofs that came from a recovery code: tag them in `note_sign_in_factor`).

### SR-5 (low) - the proof window follows the wall clock

- Where: `origin/pilot/MFA-STEPUP-2490` `services/step_up.py:143` (`time.time()`), `:290` and `:294` (`now - at <= window` also
  accepts a negative age); inherited by every slice (`fresh_proof`, `mark_once`, `_take_once`).
- Attack / fault: a backward clock step (NTP correction, a restored VM, a Pi without RTC that synced late) keeps every live proof and
  every Arx-only `factor_at` valid for the window PLUS the step. Proven: a one-hour step back keeps a 5-minute proof valid 6 minutes
  later (`test_sr5_...`).
- Fix: in-memory marks on `time.monotonic()`; for `auth_local_sessions.factor_at` refuse an age below zero (`0 <= now - at <= window`).

### SR-6 (low) - a restore brings back a passkey the user removed (now a step-up method for every user)

- Where: `origin/pilot/MFA-PASSKEYS-2490` `services/backup.py:85` (`auth_webauthn_credentials` is an ACCESS_TABLE) and `:744`
  (`replace` empties and re-inserts it). TOTP, recovery codes and phone keys are `NEVER_EXPORTED_TABLES`; passkeys are the odd one.
- Attack / fault: a passkey removed after a lost phone comes back with a `project+access` restore of an older archive and counts again
  as a step-up method (since slice 4, for HA users too) and, for an Arx-only identity, as a sign-in factor. Needs `backup.manage` (and
  a step-up) for the restore, hence low. Proven: `test_sr6_...` (the row is back, `methods_of` = `['passkey']`).
- Fix: on restore keep only the passkey rows that exist now (intersection by `credential_id`), or restore them disabled until the user
  confirms; record it in the restore answer.

### SR-7 (medium, slice 1 alone; closed by slice 3) - a delegated administrator's permission changes are not gated

- Where: `origin/pilot/MFA-STEPUP-2490` (and `MFA-TRAIN-2500`, which does not carry slice 3 yet) `routers/access_groups.py:59`
  (`_assign_gate_ro`: `assigns_anywhere()` true -> no `require()`), `:160` (the delegated branch of `_reach_or_refuse` never calls
  `require()`), so `PUT /access/groups/{id}/members` (`:264`) and `POST /access/bindings/bulk` (`:455`) by a delegated (site)
  administrator change who holds which role with no proof; slice 1 recorded only `DELETE /access/bindings/{id}` (its 6.2).
- Slice 3 closes it: `services/rbac_admin.assigns_anywhere` (`:641` on slice 1) calls `step_up.on_grant(..., "rbac.assign")` on the
  linked read connection, which the gate refuses for a PUT / POST (read by code; not run). No test here (a delegated-administrator
  fixture is large); slice 3's route-table ratchet is the guard.
- Fix: same as SR-1 - the train must not ship slices 1/2/4/6 without slice 3.

## Integration watch items (not findings on any pushed head)

- **W-1 (recovery + gates).** Slice 3's `step_up_verify` turns a code for a once-action (`auth.second_factor.reset`,
  `bridge.key.code_revealed`, `auth.local.passkey.removed`) into a once-proof; slice 7 adds `method: recovery_code` to the same
  function. A naive merge lets a recovery code authorise the reset of ANOTHER user's factor and the bridge-key reveal - which slice 7's
  own docstring forbids. At merge: refuse `recovery_code` when `body.action in ONCE_ACTIONS` (and keep `once_proof()`'s inline code
  TOTP-only, as it is). Same rule for the owner's open question "recovery code as a step-up proof": recommended (a) accept it for the
  window only, never for once-actions, never for minting new codes (SR-4).
- **W-2 (device keys + gates).** `routers/device_keys.verify_step_up` has no once-action path (passkeys' `user_passkeys.verify` has one
  through `getattr`); after the merge a phone-key-only administrator cannot do any once-action (fails closed). Add the once branch.
- **W-3 (proof is not action-bound).** Passkey and phone-key challenges are bound to the action, but `step_up.mark()` then records a
  window proof valid for every gated permission and every physical action (door open, disarm). Consistent with the TOTP design; note
  it so nobody relies on the action binding for anything but once-actions.

## Checked and dropped (no exploit found)

- Recovery-code double spend: `recovery_codes.consume` is a conditional `UPDATE ... WHERE used_at IS NULL` checked by `rowcount`
  inside a write transaction - atomic. TOTP replay: conditional `last_step` update (`second_factor.verify`). Passkey / phone-key
  challenges: popped on first presentation, bound to purpose, user, session hash, action, origin; cross-user and cross-session
  replays refused. One-shot marks: consumed under the lock.
- Timing: TOTP `hmac.compare_digest`; recovery codes `local_passwords.verify`; ECDSA / WebAuthn verification - no early-exit compare on
  secrets found.
- Lockout via method switching: recovery codes share the TOTP lockout (`second_factor.FAILURES`); passkeys and phone keys cannot be
  guessed; the phone key's own lockout (`dk:<user>`) is separate by design.
- WebSockets: the gate is HTTP-only, and no WebSocket handler performs a settings / users / permissions write or a physical action
  (`/ha/ws`, `/wall/ws`, `/me/ws`, `/events/ws`, intercom talk / listen read or push only).
- Bulk device actions: `device_bulk.NEVER_BULK_DOMAINS` excludes locks, alarm panels, sirens, scripts; door covers and the door layer
  are excluded - no unlock / disarm through bulk.
- Retry-once client logic (slice 2, `api/client.ts`): every physical gate of slice 3 sits before any record or send (alarm after the
  idempotency lookup and before the code gate; the WisKey tile before its pending row; `open_door` before the relay reservation;
  `door_windows.open_for` before `commit_now`), so the single retry is the first real send; a second 403 is final.
- Audit rows: no code, secret, assertion, signature, challenge or label in any new row (`auth.step_up.*`, `auth.recovery_code*`,
  `auth.passkey.*`, `auth.device_key.*`, `auth.token.*`).
- Restore of security settings: every new key is in `backup.SETTINGS_KEEP` (`security.step_up*`, `security.passkeys_all_users`,
  `security.device_key_auth`, `security.factor_policy*`, `security.factor_wall_exempt`, `security.remote_long_lived_tokens`).
- Defaults that lock users out on upgrade: `security.factor_policy` = optional / report; step-up applies only to users with a method;
  Ingress stays the break-glass path (`security.step_up_local = off`); the train's dialog handles TOTP and passkeys.
- Long-lived-token exemption (slice 6): `kind_of` reads `exp - iat` only after HA accepted the token, so the claims are HA's own.
  That anyone holding an HA token can mint a long-lived one at HA and skip step-up is the owner's recorded Q48 risk.

## Tests (real runs, workstation, `C:\cloude\smplwisebms\.venv` Python, one file at a time, `--runxfail` to see the real failures)

| Branch running the file | Result |
|---|---|
| `pilot/MFA-SECREVIEW-2500` (= slice 1) | SR-3 (TOTP) and SR-5 fail for the stated reason; 6 skipped (slices not present) |
| `origin/pilot/MFA-TRAIN-2500` `3d0768add` | SR-1, SR-2 (passkey), SR-3 (TOTP + passkey), SR-5, SR-6 fail for the stated reason; 2 skipped |
| `MFA-TRAIN-2500` + `MFA-STEPUP-GATES-2490` merged locally (not pushed) | SR-1 passes (closed by slice 3); SR-2 still fails |
| `origin/pilot/MFA-RECOVERY-2490` `affa63886` | SR-4 fails for the stated reason |
| `origin/pilot/MFA-DEVICEKEY-2490` `359f9f273` | SR-2 (phone key) and SR-3 (TOTP) fail for the stated reason |

Without `--runxfail` the failing tests report as xfailed (on this branch: 2 xfailed, 6 skipped, exit 0). NOT_RUN: any runner / slot-B run, the full backend suite, ruff (the file
follows the surrounding test style), any Playwright or lab check.
