# MFA-REVIEW-2520 - adversarial review of the second factor as shipped in 2.51.0

Row `MFA-REVIEW-DOCS-2520`, branch `pilot/MFA-REVIEW-DOCS-2520`, base `origin/main` = v2.51.0 (`3d71fb183`). Scope: everything the
second-factor train put into main in 2.49-2.51 - step-up (`services/step_up.py`, default OFF, opt-in), passkeys for every user
(`services/user_passkeys.py`, `routers/local_passkeys.py`), phone keys and their attestation (`services/device_keys.py`,
`routers/device_keys.py`, `services/device_key_attestation.py`), the authenticator code and recovery codes (`services/second_factor.py`,
`services/recovery_codes.py`, `routers/second_factor.py`), the sign-in factor policy (`services/factor_policy.py`, report by default),
the hardened administrator reset (`services/factor_reset.py`) and the token rules (`services/access_tokens.py`, the bearer path of
`services/ha_user_auth.py`).

Method: read the code paths end to end with an attacker's eye (stolen session cookie, stolen administrator session, leaked recovery
code, HA credential, clock faults, the anonymous public routes, CSRF), then check every finding of the previous review
(`origin/pilot/MFA-SECREVIEW-2500`, `docs/changes/MFA-SECREVIEW-2500.md`) against main. No lab, no Home Assistant, no device. Line
numbers are of this branch; where a fix here moved them, the `origin/main` line is given too.

Owner decisions taken as given (not reopened, residual risk named where it matters): step-up OFF by default (Q2 = b: "never ask for
re-confirmation unless I switched it on"); a FIRST factor needs a fresh sign-in (SR-3 kept); an administrator may reset factors from
any channel (Q53, `security.factor_reset_channel = any`); long-lived HA tokens from outside stay allowed and skip step-up (Q48); a
recovery code is a window proof only (Q13 = a); no forced re-enrolment after a recovery-code sign-in (Q14 = a).

## 1. The previous review (SR-1..SR-7, W-1..W-3) against main

| Id | Finding (2.50 review) | Status in main 2.51.0 | Evidence |
|---|---|---|---|
| SR-1 (high) | a passkey-only administrator reset another user's factor with no step-up | **fixed** - `once_proof` asks for a proof whenever the caller has ANY method | `services/step_up.py:754-774`; regression `tests/test_mfa_secreview_2500.py::test_sr1_...` |
| SR-2 (medium) | the reset left passkeys and phone keys | **fixed** - every factor kind goes | `services/second_factor.py:283-297` (`remove_every_factor`), `routers/second_factor.py:322-325`; `test_sr2_*` (2) |
| SR-3 (medium) | a first factor enrolled from an old stolen session | **fixed for the FIRST factor** (recent sign-in, 300 s) - **but see N-1**: a factor ADDED next to an existing one asks nothing while step-up is off | `services/step_up.py:518-530`; `test_sr3_*` (2) |
| SR-4 (low) | one recovery code laundered into ten | **fixed while step-up is on** (strict proofs); **with step-up off (the default) no proof at all is asked** - see N-1 | `services/step_up.py:538-558`, `routers/second_factor.py:476-477`; `test_sr4_...` |
| SR-5 (low) | proof window follows the wall clock | **fixed** - monotonic marks, `0 <= age <= limit` | `services/step_up.py:261-280`; `test_sr5_...` |
| SR-6 (low) | a restore revived a removed passkey | **fixed** - passkeys never exported; the current rows are kept on restore | `services/backup.py:102-110`, `:785`; `test_sr6_...` |
| SR-7 (medium) | delegated administrator's permission changes ungated | **fixed** (slice 3 `on_grant` in `rbac_admin.assigns_anywhere`) | route-table ratchet `tests/test_mfa_stepup_gates_2490.py` |
| W-1 | recovery code for a once-action | **fixed** - refused before it is read (409 `step_up_method_refused`) | `routers/second_factor.py:408-414`, `step_up.NO_RECOVERY_ACTIONS` (`:129`) |
| W-2 | phone-key-only administrator could not do a once-action | **fixed** | `routers/device_keys.py:237-262` |
| W-3 | proofs are not action-bound | unchanged by design (a window proof covers every gated change and physical action) | `services/step_up.py:563-571` |

All eight review tests run unmarked in main (`tests/test_mfa_secreview_2500.py`, re-run here: section 5).

## 2. New findings (most severe first)

| Id | Severity | Title | Status here |
|---|---|---|---|
| N-1 | medium | with step-up off (the default) a factor ADDED to an account that already has one needs neither a proof nor a fresh sign-in | proposed row (owner question) |
| N-2 | medium | an administrator's removal of an Arx-only identity's passkey skips the reset hardening, incl. the owner's `local` channel setting | **channel part fixed**; rest proposed |
| N-3 | low | the last-administrator rule counts a Home Assistant user's passkey as a remote sign-in factor | **fixed** |
| N-4 | low | a bearer sign-in admitted by HA's own MFA records a fresh step-up proof | **fixed** |
| N-5 | low | an administrator with no factor resets other users' factors with no proof and no fresh sign-in | proposed row |
| N-6 | low | no notice to the user when a factor is removed, a recovery batch is made, or a recovery code signs in | proposed row |
| N-7 | low | `security.factor_reset_channel` (the owner's main mitigation for Q53) has no screen | proposed row |
| I-1..I-4 | info | recorded residuals | - |

### N-1 (medium) - with step-up off, adding a factor next to an existing one asks nothing; a session thief keeps a factor of their own

- **Where.** `services/step_up.py:523-528` (`require_first_factor_freshness`: a user WITH a method returns at once when
  `factor_change_proof_on` is false - the fresh-sign-in rule is applied only to a user with no method); `services/user_passkeys.py:179-182`
  (passkey registration: proof only while the switch is on); `routers/device_keys.py:176` (phone-key registration through the same
  function); `routers/second_factor.py:476-477` (a new batch of recovery codes: `pass` while the switch is off);
  `services/device_key_attestation.py:56` (`preferred` by default: a key that is not hardware-attested is accepted and counts);
  `services/ha_user_auth.py:1123` + `:1243` (a user with the authenticator code owes "a code" at sign-in, and a phone-key answer
  `dk1:...` is accepted as that code).
- **Scenario.** Installation defaults (step-up off, attestation `preferred`). A thief holds the session cookie of a user who has the
  authenticator code - stolen hours after the sign-in. (1) `POST auth/device-keys/challenge {purpose: register}` -> payload; signs it with
  a P-256 key made by a script on any computer; `POST auth/device-keys {..., auth_kind: "biometric_or_screen_lock"}` -> 200, the key is
  active (`attested: none`). From now on `dk1:<challenge>:<signature>` answers the second factor of every NEW remote sign-in of that user
  (`_check_second_factor_sync`), and it survives the end of the stolen session, the user's "sign out everywhere" (`routers/remote.py:390`
  does not touch phone keys) and a password change. With the password (phished later, or reused) the thief signs in at will. (2) Or
  `POST auth/recovery-codes` -> ten fresh codes for the thief; the user's own codes stop working and **nobody is told** (only the audit row
  `auth.recovery_codes.generated`). A recovery code also answers the sign-in factor. (3) Same for a passkey (a step-up method; for an
  Arx-only identity also a sign-in factor).
- **Why it matters.** The rule is now weaker for the accounts that chose a factor than for those that did not: a user with NO factor
  must have signed in within 5 minutes before enrolling one (SR-3), a user WITH one needs nothing to add another. Mitigations present:
  the phone key and the passkey send `security.device_key_added` / `security.second_factor_added` to the user's devices; the recovery
  batch sends nothing (N-6).
- **Proposed row MFA-FACTOR-ADD-FRESH-2520.** With step-up off, apply the SAME re-sign-in rule as SR-3 to every factor ADD
  (`FACTOR_ADD_ACTIONS`: code enrolment, recovery batch, passkey, phone key) on the remote channel: a sign-in of this session within 5
  minutes, else 403 `reauth_required`. It is a re-sign-in, not a code prompt (the owner kept exactly that for the first factor), the local
  channel stays the break-glass path, and with step-up on nothing changes (a fresh proof as today). Plus a user notice for a new recovery
  batch (N-6). Not built here: it changes what a user sees when adding a passkey or a phone key more than 5 minutes after signing in -
  an owner decision (question 1 in the change note).

### N-2 (medium) - the administrator's passkey removal of an Arx-only identity bypasses the reset hardening

- **Where.** `routers/local_passkeys.py:328-353` (`DELETE /identity/local-users/{user_id}/passkeys/{pk_id}`; `origin/main` `:327-345`).
  It removes another user's authentication method, like `DELETE /auth/second-factor/users/{id}`, but MFA-RESET-HARDENING-2510 put its
  rules only on the latter (`routers/second_factor.py:294-318`).
- **Scenario.** The owner switches `security.factor_reset_channel` to `local` (the mitigation Q53 recorded for a stolen administrator
  session). A holder of `identity.local.manage` signed in from outside - with no factor of their own, so `require_step_up` asks nothing
  (`step_up.once_proof` returns None, `services/step_up.py:763-764`) - removes an Arx-only identity's passkeys one call each, from
  outside: **no channel check** (before this fix), no typed confirmation, no 3-per-hour limit, no last-administrator rule, the managers
  are not told, `must_enroll` is not set. The permission is `identity.local.manage`, which a delegated identity manager may hold (the
  reset needs `system.configure`). Unlike `PUT .../passkey-only` (`:299-310`), an administrative target is not refused from outside.
- **Fixed here (small, default unchanged).** The route now honours `security.factor_reset_channel = local`: a remote call answers 403
  `factor_reset_local_only`, audited `identity.local.user.passkey_removed` denied `local_only`, before the rate limiter, the passkey
  lookup or the proof (`routers/local_passkeys.py:337-342`). With the default `any` nothing changes.
  Test: `tests/test_mfa_review_docs_2520.py::test_n2_an_administrators_passkey_removal_honours_the_local_only_reset_channel`.
- **Proposed row MFA-PASSKEY-ADMIN-REMOVE-2520.** Give the route the rest of the reset's rules: the typed username, a share of the
  administrator's 3-per-hour budget, the managers' notice (`security.second_factor_reset_by_admin`), `must_enroll` when the last factor
  goes, and the 404-from-outside of `passkey-only` for an administrative target.

### N-3 (low) - the last-administrator rule took a Home Assistant user's passkey for a sign-in factor - FIXED

- **Where.** `services/factor_reset.py:218` (`origin/main` `:203`): `signs_in_remotely` answered True for any user with a step-up
  method (`step_up.methods_of`), and that list includes a passkey. A Home Assistant user's passkey is a step-up method only: the remote
  sign-in asks the authenticator code or a phone key (`services/ha_user_auth.py:1114-1143`), so under a policy that requires a factor a
  passkey-only administrator goes to enrolment and cannot sign in from outside.
- **Scenario.** Policy `admins`. Administrator A has the authenticator code; administrator B only a passkey. B (or a stolen B session -
  the once-proof is B's passkey) resets A: `last_admin_blocks(A)` sees B as "can sign in remotely" and lets it through. A must enrol
  again and B cannot sign in remotely - no administrator can, which is exactly what the rule promises never to do. Availability only
  (the local channel stays the way back).
- **Fix.** `factor_reset.sign_in_factor` (`services/factor_reset.py:186-197`): a Home Assistant user counts the code or an active phone
  key; an Arx-only identity the code or a usable passkey (its own sign-in rule, `local_passkeys.has_factor`). `signs_in_remotely` uses it.
  Test: `test_n3_a_passkey_only_administrator_does_not_count_as_one_who_can_sign_in_remotely` (reset -> 409 `factor_reset_last_admin`).

### N-4 (low) - HA's MFA at a bearer sign-in became a fresh step-up proof - FIXED

- **Where.** `services/ha_user_auth.py:1515-1523` (`origin/main` `:1515-1519`): after a new bearer sign-in admitted by the enforced
  sign-in policy through HA's own MFA (`ha_mfa_ok`), `step_up.note_sign_in_factor(s, None)` recorded a `sign_in` mark - a full proof for 5
  minutes, also for the strict factor-ADD checks. HA's MFA happened when the refresh token was made (provenance only says "not before
  MFA was first seen"), possibly weeks earlier. The cookie exchange records no proof in the same case (`:1334-1345`).
- **Scenario.** Step-up on, enforced policy, a user whose methods include a passkey or a phone key: any new bearer chain of that user (a
  native client, or a stolen refresh token) starts with a step-up proof without showing anything now - gated settings changes, physical
  actions and factor additions pass for 5 minutes.
- **Fix.** Only a sign-in that just showed the Arx factor (`factor == "code"`) records a proof; `ha_mfa_ok` still marks the sign-in
  verified for its next access tokens. Test: `test_n4_a_bearer_sign_in_admitted_by_home_assistants_mfa_records_no_step_up_proof`.

### N-5 (low) - an administrator with no factor resets other users' factors with no proof at all

- **Where.** `services/step_up.py:763-764` (`once_proof` returns None for a caller with no method) and `routers/second_factor.py:318`
  (the reset goes on). Recorded as intended in MFA-RESET-HARDENING-2510 ("nothing for an administrator who has no method").
- **Scenario.** Defaults (policy optional, channel `any`). A session cookie of a system administrator who never enrolled, stolen at any
  age: three resets an hour from outside - each removes the victim's factors, ends every sign-in and device credential of the victim.
  The typed username and the managers' notice slow and expose it; nothing stops it.
- **Proposed (in MFA-FACTOR-ADD-FRESH-2520 or its own row).** When the administrator has no method, ask a sign-in of this session within
  5 minutes for the reset on the remote channel (the SR-3 rule; a re-sign-in, not a code), or refuse the remote reset until the
  administrator enrols a factor. Owner question 2.

### N-6 (low) - factor changes the user is not told about

- **Where.** Notices exist for a factor added (`notify_sources.second_factor_added`, `device_key_added`) and the administrator's reset;
  none for: removing one's own authenticator code (`routers/second_factor.py:156-178`), a passkey (`services/user_passkeys.py:303-320`) or
  a phone key (`routers/device_keys.py:209-223`); a new batch of recovery codes (`routers/second_factor.py:492-494`); a sign-in answered
  with a recovery code (`services/ha_user_auth.py:1249-1252`, `services/local_identity.py:1294-1305`).
- **Scenario.** With step-up off, a session thief removes the user's passkey or phone key (no proof asked, `services/user_passkeys.py:291`,
  `routers/device_keys.py:69`) or mints new recovery codes; the user learns of it only when a factor fails. A recovery code used by
  someone else at sign-in leaves only an audit row.
- **Proposed row MFA-FACTOR-NOTICES-2520.** One content-free notice source `security.second_factor_changed` (removed / new recovery
  batch / recovery-code sign-in) to the account's own user on every device, as `second_factor_added`.

### N-7 (low) - the reset channel setting has no screen

- **Where.** `security.factor_reset_channel` is only reachable through `PATCH /settings` (`routers/settings.py:294`); no component
  reads or writes it (`frontend/src` has only the refusal text in `components/factor-reset-confirm.ts:30`).
- **Risk.** Q53's recorded mitigation ("the owner can switch to `local` at any moment") is invisible to the owner. **Proposed:** a row on
  the second-factor tab (Settings > Users and permissions > Second factor) with the "widen only from the local network" rule shown.

### Recorded residuals (info)

- **I-1 (Q48).** A long-lived HA token from outside skips step-up entirely, the physical gates included (`services/step_up.py:379-385`).
  Anyone who can sign in to HA can mint one. The owner's recorded risk; `security.remote_long_lived_tokens` can refuse them.
- **I-2.** "Recent sign-in" on the bearer path is the first request of the HA sign-in in this Arx process: after a restart, or after
  every earlier access token's session ended, the chain looks new (`services/ha_user_auth.py:400`, `:416-418`). It needs an HA token, i.e.
  an HA credential - acceptable for the SR-3 rule, noted so nobody relies on it as "the password was typed".
- **I-3.** The phone-key challenge pool is shared by all purposes (`services/device_keys.py:73`, 5000); the PUBLIC sign-in challenge
  (`routers/device_keys.py:123-133`, 20 a minute per address block, 60 s life) can evict older challenges only from hundreds of address
  blocks at once. A sign-in then fails and is retried; no bypass.
- **I-4.** Wrong codes lock code entry for 10 minutes (5 in 5 minutes), shared by the authenticator code and recovery codes
  (`services/recovery_codes.py:145-152`). Whoever holds a session (or the password) can lock the user out of code entry for a while -
  a deliberate trade against guessing.

## 3. Checked and found sound (no finding)

- **Replay.** TOTP steps are single use through a conditional `UPDATE ... last_step < ?` (`services/second_factor.py:265`); recovery codes
  through `UPDATE ... used_at IS NULL` (`services/recovery_codes.py:128`); passkey and phone-key challenges are popped on first presentation
  and bound to purpose, user, session hash, action and origin (`services/user_passkeys.py:364-398`, `services/device_keys.py:308-342`);
  once-proofs are consumed under the lock (`services/step_up.py:745-751`).
- **Downgrade.** Removing a factor with step-up on needs a proof (`removal_proof`, `_proof_missing`); `disable` always needs a current code
  or a recovery code; the switch, minutes and local-channel keys are settings writes and thus gated while step-up is on; widening the reset
  channel back to `any` is local-only (`routers/settings_patch/identity.py:209-212`) and the value is pattern-checked
  (`routers/settings.py:294`), so an unknown value cannot fall back to `any`.
- **Enumeration.** The public phone-key sign-in challenge answers the same shape for any key id; the factor existence is revealed only
  after the first factor; `reset-check` and the factor lists need `system.configure` / `rbac.assign`.
- **Rate limits.** step-up verify 10 / 5 min and 30 / h per user; challenges per user; factor routes 20 / min; the reset 3 / h per
  administrator from durable audit rows; public sign-in challenge per address.
- **Audit.** Every success and refusal of enrol, confirm, disable, verify, reset, passkey and phone-key add / remove writes a row with the
  method and reason; no row carries a code, secret, assertion, signature, challenge or label.
- **Recovery abuse.** A recovery code is never a once-proof (refused unread), never a strict proof (`RECOVERY_PROOFS`), and a recovery-code
  sign-in is a window proof only (`sign_in:recovery_code`, `note_recovery_sign_in`) - while step-up is on (N-1 for off).
- **Admin reset abuse.** Never oneself; typed username before the proof is read; checks 2-8 spend nothing; the target's sign-ins, device
  tokens and push registrations end; managers notified; `must_enroll` set (and HA MFA no longer satisfies an enforced policy until an
  Arx factor is enrolled again).
- **CSRF / origin.** Every state-changing request that carries the Arx session cookie needs `Sec-Fetch-Site: same-origin` or a matching
  `Origin` (`remote_channel.py:243-277`), cookies are `SameSite=Strict`; WebAuthn checks origin and RP id; phone-key payloads carry the
  origin and the app refuses another server's.
- **Clock.** Marks run on `time.monotonic()`; stored instants are checked with `0 <= age <= limit` (SR-5).
- **Restore.** No factor table travels in a backup (`backup.NEVER_EXPORTED_TABLES`), the security keys are in `SETTINGS_KEEP`.

## 4. Proposed rows (not built here)

| Row | What | Owner question |
|---|---|---|
| MFA-FACTOR-ADD-FRESH-2520 | N-1 (+ N-5): with step-up off, every factor ADD - and an administrator's reset by a caller with no factor - needs a sign-in of this session within 5 minutes on the remote channel | 1, 2 |
| MFA-PASSKEY-ADMIN-REMOVE-2520 | N-2 rest: typed username, shared 3 / h budget, managers' notice, `must_enroll`, administrative targets local-only | - |
| MFA-FACTOR-NOTICES-2520 | N-6: a notice for factor removal, a new recovery batch, a recovery-code sign-in | 3 |
| MFA-RESET-CHANNEL-UI-2520 | N-7: the reset channel on the second-factor tab | - |

## 5. Tests

See `docs/changes/MFA-REVIEW-DOCS-2520.md` section 3 for the commands and the real results.
