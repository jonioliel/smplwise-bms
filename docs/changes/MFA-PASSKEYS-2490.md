# MFA-PASSKEYS-2490 - second-factor train, slice 4: passkeys for every user and the passkey step-up

Branch `pilot/MFA-PASSKEYS-2490`, cut from `origin/pilot/MFA-STEPUP-2490` at `fb9a3ac1e` (slice 1). Train plan and slice 1:
`docs/changes/MFA-STEPUP-TRAIN-2490.md`. No merge, no version bump, no changelog entry, no tag, no lab / Home Assistant / NVR / go2rtc
contact. Fakes only: the fake HA core of `tests/test_remote_access.py`, the software authenticator `tests/webauthn_fake.py`, and a
Chromium virtual authenticator (CDP WebAuthn) in Playwright against a mocked wire contract.

Inputs read: `AGENTS.md`, `CLAUDE.md`, `MASTER_SPEC_HE.md` and `docs/security/` (silent on passkeys for Home Assistant users and on
step-up; the Fable review's passkeys-only findings P-01..P-03 concern Arx-only identities and are untouched here), the design
`docs/design/full-2fa-t095/DESIGN.md` on `origin/pilot/FEATURE-DESIGNS-SEC-2490` (sections 2.3, 4.2, 4.3, 6, 7, 8, 10, 13 - owner
decision Q50 "passkeys for all users: yes"), slice 1 and the code of the sibling slices 2 (`pilot/MFA-STEPUP-UI-2490`), 3
(`pilot/MFA-STEPUP-GATES-2490`), 6 (`pilot/MFA-TOKENS-2490`) and 7 (`pilot/MFA-RECOVERY-2490`) for overlaps.

## 1. What changed

### 1.1 Passkeys for every user (owner Q50)

* New setting `security.passkeys_all_users` (`on` default | `off`): system administrators only, audited
  (`security.passkeys_all_users`, allowed / denied), in `backup.SETTINGS_KEEP` (never restored), changed through `PATCH /settings`
  (so the slice-1 step-up gate covers it). Not local-channel-only: it never widens who can sign in.
* The own passkey routes `auth/passkeys*` (`routers/local_passkeys.py`) now serve every user who signs in to Arx: Home Assistant users
  on the remote channel, in the phone app's session, and through Ingress. An Arx-only identity keeps exactly its rules of before
  (fresh sign-in, passkey-first / passkeys-only modes, the 202 sign-in step). With the switch off every other user gets the 403
  `not_local_identity` of before, and the passkeys they already made are kept, listed nowhere and never count.
* No migration: `auth_webauthn_credentials.user_id` already references `users(id)`, which holds Home Assistant ids (design section 6
  said "verify in the build row" - verified). Migration number 0220 is therefore NOT taken by this slice.
* Same relying party (the host of `security.local_public_url`), same verifier (`services/webauthn.py`), same challenge pools.
  `GET auth/passkeys` adds `user_kind` (`local` | `user`); for a user who is not an Arx-only identity the sign-in modes are false and
  `recent_auth` means "this session holds a step-up proof now".
* Registration of a user who is not an Arx-only identity (`services/user_passkeys.py`): the challenge is bound to the caller's session
  (the step-up session key: HA sign-in, app session, `ingress:<user>`); adding a passkey to an account that already has a factor needs
  a fresh proof in this session (`step_up.fresh_proof`) - otherwise a stolen session could add its own passkey and then pass every
  step-up with it - answered 403 `step_up_required` (action `auth.passkey.register`, `challenge_path`). The first factor made this way
  behaves like a TOTP enrolment: the user's other remote sign-ins and phone device tokens end, this session counts as having shown the
  factor.
* Removal: whenever the account has a factor, a proof - the current authenticator code in the request, a fresh step-up proof, or
  (Arx-only identity) the fresh sign-in of before. Otherwise 403 `step_up_required` (action `auth.passkey.remove`); an Arx-only identity
  keeps its 403 `reauth_required`. When the last factor goes, the user's step-up proofs go too (`step_up.forget_user`). Stricter than the
  task card's "removing the last factor needs a step-up": every removal from an account with a factor needs one (the existing local
  rule "a stolen session alone cannot strip a factor").
* Rename: `PATCH auth/passkeys/{id}` for every user, audited `auth.passkey.renamed` (the public id only, never the label).
* Audit (never a credential id, public key, challenge, signature or label): `auth.passkey.registered|removed|renamed|refused|
  counter_regression` for users who are not Arx-only identities (the Arx-only rows keep `auth.local.passkey.*`).

### 1.2 The passkey as a step-up method, and the challenge endpoint

* `services/step_up.methods_of` lists `passkey` when the user's passkeys count (`user_passkeys.counts`: made for the current public
  address, user verification for an administrative user, the all-users switch for a user who is not an Arx-only identity). A passkey-only
  user (Home Assistant or Arx-only) therefore has a method and **is gated now** (slice 1 left them `no_method`).
* `POST auth/step-up/challenge {action?}` (`routers/local_passkeys.py`, wire `StepUpChallenge`): `{challenge_id, action, expires_in: 60,
  methods, webauthn: {publicKey: RequestOptions}}`. 32 random bytes from the `step_up` pool of `local_passkeys` (memory only), bound to
  the user, a hash of the session key and the action; single use (spent by the first verification that names it, whatever the
  outcome); one open per user; at most `MAX_CHALLENGES` live (429 beyond). Rate-limited per user (20 / 5 min, 60 / h). Audited
  `auth.step_up.challenge`. 409 `step_up_no_session` / `step_up_no_method`.
* `POST auth/step-up/verify {method: "passkey", challenge_id, assertion, action?}` (`routers/second_factor.step_up_verify` hands the
  passkey method to `user_passkeys.verify`): the challenge must be a step-up challenge of THIS user, THIS session, THIS action, named by
  its id, within 60 s; the credential must be the caller's own and count; origin, RP id, user presence, user verification (admin),
  signature, backup-eligibility and the counter are checked by the existing `local_passkeys._check`. Success records the same
  server-side proof as the code (`step_up.mark`; one-shot when `security.step_up_minutes = 0`), audited `auth.step_up.ok` with method
  `passkey` and the passkey's public id. Failure: uniform 400 `step_up_failed`, audited `auth.step_up.failed` with reason
  `passkey_<why>`; a counter regression also writes `auth.passkey.counter_regression` and the managers' `security.local_passkey_clone`
  notice. Same applicability as the code, except the factor actions (`auth.passkey.register`, `auth.passkey.remove`), which are accepted
  also while step-up is off, on the local channel or for a bearer caller (a factor change needs a proof whatever the switch says), and
  the slice-3 once-actions when slice 3 is merged (`getattr(step_up, "ONCE_ACTIONS")` / `mark_once` - forward compatible, see 3).
* The authenticator-code path of `verify` accepts the two factor actions on the same terms (else a TOTP user could never prove a
  passkey change while step-up is off). `StepUpBody.code` became optional (required for `totp`, a 422 otherwise);
  `StepUpStatus.methods` / `StepUpProof.method` accept `passkey`.

### 1.3 My Account (minimal screen; module look kept)

`components/sw-passkeys.ts` (already lazy under החשבון שלי › אימות דו־שלבי): shown to every user the server answers; a Home Assistant
user sees a note fitted to them and no sign-in modes; new **rename** (inline field); removing the last factor shows a warning line; a
factor change answered 403 `step_up_required` opens a small confirmation **in place** - "אישור במפתח גישה" (challenge, the device,
verify) and / or the authenticator code, as the server lists them - and the change is sent again **once** after the proof (a second
refusal is shown, never retried; cancel sends nothing). `api/step-up-passkey.ts` (new): `stepUpChallenge`, `verifyPasskeyStepUp`,
`verifyCodeStepUp`, `passkeyStepUp(action)` (the whole ceremony) and `stepUpNeed(err)` - kept apart so the slice-2 dialog can import it.
Hebrew + English strings in `i18n/local-identity.ts` and its English pack.

Compare page: `private/planning/mfa_passkeys_compare_2026-11-24.html` (server screenshots, desktop + phone, light + dark).

### 1.4 Files

`smplwise/services/user_passkeys.py` (new), `smplwise/services/step_up.py` (`METHOD_PASSKEY`, `methods_of`, `fresh_proof`),
`smplwise/services/local_passkeys.py` (the `step_up` pool), `smplwise/routers/local_passkeys.py` (`_caller`, the own routes for every
user, `POST auth/step-up/challenge`), `smplwise/routers/second_factor.py` (verify dispatch, optional code), `smplwise/wire/local_passkeys.py`
(`StepUpChallenge`, `OwnPasskeys.user_kind`), `smplwise/wire/second_factor.py` (method literals), `smplwise/services/settings_store.py`,
`smplwise/routers/settings.py`, `smplwise/routers/settings_patch/{__init__,identity}.py`, `smplwise/services/backup.py`,
`tests/test_mfa_passkeys_2490.py` (new), `tests/test_local_passkeys.py` (one test now switches the all-users switch off first),
`frontend/src/api/step-up-passkey.ts` (new), `frontend/src/api/passkeys.ts`, `frontend/src/components/sw-passkeys.ts`,
`frontend/src/i18n/local-identity.ts`, `frontend/src/i18n/lang/en/i18n/local-identity.ts`, `frontend/tests/unit-mfa-passkeys-2490.spec.ts`
(new), generated `frontend/src/api/generated/wire-local-passkeys.ts`, `wire-second-factor.ts`, `contracts/API_INVENTORY.md`.

## 2. Contradictions recorded (not resolved silently)

1. **User verification at step-up.** Design 4.2 says the passkey step-up uses `userVerification: required`. Implemented: required for a
   user who holds an administrative permission, preferred otherwise - the rule the passkey already met at registration and sign-in
   (`local_passkeys`), so a passkey that counts as a factor can always pass the step-up (a security key without a PIN registered by a
   non-administrator would otherwise be a method that can never succeed). Open question 5.3.
2. **Default of `security.passkeys_all_users`.** Design 4.3 / 6: `off` ("every switch off = today's behaviour", written before the
   owner's 2026-11-22 answers). Owner Q50: "passkeys for all users: yes". Implemented `on` - consistent with slice 1, where the lead set
   `security.step_up` on. Effect is nil until a system administrator sets `security.local_public_url` (passkeys need it). Open question 5.2.
3. **Passkeys in the backup.** Design section 6: "backup must not carry factor material: ... passkeys stay out like `auth_totp`".
   Migration 0098 (owner answer Q8, USR2): the public keys travel in the access part of the backup like the password hashes. Unchanged
   here (public keys only, no secret); recorded for the review slice.
4. **Verify body and error.** Design 7: `verify {challenge_id, method, proof}` and 401 `step_up_failed`. Implemented `{method,
   challenge_id, assertion}` and **400** `step_up_failed` - a 401 would trigger the web client's re-sign-in handler.
5. **Challenge pool caps.** Design 8.2: per user 5 live challenges, oldest evicted. Implemented the existing passkey pool rule: one open
   step-up challenge per user (a new one replaces it), at most 5000 live, 429 beyond.
6. **Slice scope.** Design table 4 puts "passkey as the sign-in factor of HA users" and "rpId change handling" in this slice; the task
   card names enrolment, the challenge, the step-up method, audit and the screen. Built: the latter. rpId change: a passkey of another
   address is listed and never counts (the existing rule), now for every user; nothing new. The HA sign-in factor is NOT built (open
   question 5.1).

## 3. Overlaps with the other slices (merge notes)

* **Slice 2 (`pilot/MFA-STEPUP-UI-2490`) - MERGE BLOCKER for passkey-only users.** Its `sw-step-up-dialog` offers the authenticator code
  only (`methods.includes('totp')`, else "no method"). Since this slice makes passkey-only users gated, the dialog must gain a passkey
  button before both ship, e.g. in `render()`:
  `methods.includes('passkey') && passkeysSupported()` -> a primary button that runs
  `passkeyStepUp(this.details.action)` (`api/step-up-passkey.ts`), dispatches `STEP_UP_VERIFIED` and answers true; `PasskeyCancelled`
  -> `lit('passkeyCancelled')`. Until then a passkey-only administrator cannot pass the central gate in the UI (the in-place confirmation
  of this slice covers only the passkey changes in My Account). Also: slice 2's client interceptor catches every 403
  `step_up_required` that names `verify_path` - including the two answers of this slice - so after the merge the dialog opens first and
  the in-place confirmation only appears when the dialog is cancelled.
  `api/second-factor.ts verifyStepUp` (slice 2) and `api/step-up-passkey.ts verifyCodeStepUp` (here) are the same call; keep one.
* **Slice 3 (`pilot/MFA-STEPUP-GATES-2490`)** rewrites `step_up.py` around `EXEMPT_ROUTES` / once-actions and the verify route. Conflicts
  expected in `routers/second_factor.step_up_verify` (both edit its top) and `services/step_up.py` (different functions; this slice
  only touches `methods_of`, `METHOD_PASSKEY`, `fresh_proof`). The passkey verify already honours slice 3's once-actions when they exist.
  `once_proof()` with an inline code calls `sf.verify` - a passkey-only administrator must use `verify {action}` (the once-proof), never
  an inline code. Slice 3 lists `DELETE /identity/local-users/{user_id}/passkeys/{pk_id}` as a once-action; the own removal
  `DELETE /auth/passkeys/{pk_id}` is this slice's and is not gated by `require()` (no permission), so it does not need an entry.
  Slice 3's `PHYSICAL_HE` / `REQUIRED_HE` texts still say "the authenticator code" only - worth "a passkey or the code" after the merge.
* **Slice 6 (`pilot/MFA-TOKENS-2490`)** and **slice 7 (`pilot/MFA-RECOVERY-2490`)** both add migration 0219 (they must renumber one);
  this slice adds none. Slice 7 edits `StepUpBody` / `step_up_verify` / `wire/second_factor.py` (`recovery_code`) - a textual conflict
  with the method pattern here (`^(totp|passkey)$` + `^(totp|recovery_code)$` -> `^(totp|passkey|recovery_code)$`, the `code` field
  optional for `passkey` only). Slice 7's `sw-second-factor` and this slice's `sw-passkeys` are separate elements; `sw-user-menu.ts`
  (touched by slice 6) is not changed here.

## 4. Known limits

1. The passkey is not a sign-in factor for Home Assistant users: their remote sign-in still asks only the authenticator code
   (`X-Arx-Second-Factor`), so an HA user under `security.second_factor_policy = admins` with only a passkey is treated as having no
   factor at sign-in (open question 5.1).
2. Registration and step-up work only at the public address (the RP id). On Ingress the browser refuses a passkey of another host; the
   screen says "passkeys work only at <address>" (the existing `passkeyWrongHost` line).
3. A bearer caller (native client, no Arx session) has no session to bind a challenge to: `step_up_no_session` / `passkey_no_session`.
4. Challenges and proofs live in memory: a restart asks again (as slice 1).
5. No real device was used (NOT_RUN): Chrome / Android / iOS passkeys against the lab address need the owner's devices.

## 5. Open questions (recommendation first)

1. **Passkey as the HA users' sign-in factor** (design table, slice 4). (a) a separate row after slice 5 (policy + provenance), where
   the sign-in factor of HA users is redesigned anyway (the 202 pending step exists only for Arx-only identities) [recommended];
   (b) add it now to the HA exchange with a new pending step.
2. **Default of `security.passkeys_all_users`.** (a) keep `on` (owner Q50) [recommended]; (b) ship `off` and switch on with the
   screens slice.
3. **User verification at step-up.** (a) as the sign-in rule: required for administrators, preferred otherwise [recommended, see 2.1];
   (b) required for everyone (design 4.2), and stop counting non-UV passkeys as a step-up method.
4. **Removing a passkey that is not the last factor.** (a) keep the proof for every removal from an account with a factor
   [recommended]; (b) only for the last factor (the task card's wording).

## 6. Tests (real runs)

| Where | Command | Result |
|---|---|---|
| workstation (Windows, repo venv, `SW_WIRE_STRICT=1`), one file at a time | `pytest tests/test_mfa_passkeys_2490.py` (switch, HA enrolment, gating, challenge binding user / session / action / id / expiry / single use, signature / origin / RP id / counter / UV refusals, factor changes while step-up is off for passkey and code, removal proof, 0-minute mode, rename audit, Ingress, audit hygiene, Arx-only identity) | **26 passed** (final state, `2f6e947bb`) |
| workstation | `pytest tests/test_local_passkeys.py` | 73 passed |
| workstation | `pytest tests/test_mfa_stepup_2490.py tests/test_passkey_only.py` | 32 passed |
| workstation | `ruff check smplwise` | All checks passed |
| workstation | `scripts/gen_wire_types.py`, `scripts/api_inventory.py` | regenerated and committed (`cb1d7c38f`) |
| runner slot B | `~/work/mfapk_run1.sh` (quick files, tsc, eslint, Playwright `unit-mfa-passkeys-2490.spec.ts` + `evidence-second-factor.spec.ts` desktop + mobile `--workers=2` with a CDP virtual authenticator, compare shots after / before, ~150 backend files in 6 shards, ruff, wire `--check`) | **NOT_RUN at the time of writing: queued behind ~12 slot-B jobs (each ~2 h)**; output will land in `~/work/mfapasskeys-out/summary.txt` |

NOT_RUN: tsc, eslint, every Playwright spec (the new spec included), the compare screenshots, the backend families beyond the four
files above, the full backend suite, any real device, any lab check.
