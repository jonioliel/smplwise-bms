# MFA-HA-PASSKEY-2520 - passkey sign-in for users who come in through the home-system identity

Branch `pilot/MFA-HA-PASSKEY-2520`, cut from `origin/main` = v2.51.0 (`3d71fb183`). Target 2.52 (spec approved). No version bump, no
changelog entry, no tag, no lab / Home Assistant / NVR / go2rtc contact, no change to home-system users, groups or admin flags. Fakes
only: the fake Home Assistant core of `tests/test_remote_access.py`, the software authenticator `tests/webauthn_fake.py`, a Chromium
virtual authenticator against mocked sign-in endpoints on `localhost` (an IP origin is never a WebAuthn RP id - commit `319f81676`).

Inputs read: `AGENTS.md`, `CLAUDE.md`, the 2.52 rows brief, `docs/changes/MFA-PASSKEYS-2490.md` (slice 4, its open question 5.1),
`docs/changes/MFA-SCREENS-2510.md` (its open question 4.3), and the code: `services/ha_user_auth.py` (the remote exchange and the bearer
path), `services/user_passkeys.py`, `services/local_passkeys.py`, `services/webauthn.py`, `services/step_up.py`,
`services/factor_policy.py`, `services/device_keys.py` (the pattern of a sign-in answer in `X-Arx-Second-Factor`), `routers/user_factors.py`,
`frontend/src/arx/auth.ts`, `arx-login.ts`, `webauthn.ts`, `components/sw-factor-policy-admin.ts`.

## 1. The real gap (written before building)

What a home-system user (a user who signs in through the home system's own identity, i.e. not an Arx-only identity) could already do
with a passkey at v2.51.0:

| Capability | State at v2.51.0 | Where |
|---|---|---|
| Register a passkey (My Account › Security), list, rename, remove | **exists** (switch `security.passkeys_all_users`, default on) - bound to the caller's session; a first factor needs a fresh sign-in; adding / removing with a factor needs a step-up proof while step-up is on | `services/user_passkeys.py`, `routers/local_passkeys.py` |
| The passkey as a step-up confirmation (before sensitive actions) | **exists** - `POST auth/step-up/challenge` + `POST auth/step-up/verify {method: passkey}`, the shell's step-up dialog offers it | `user_passkeys.challenge/verify`, `components/sw-step-up-dialog.ts` |
| The passkey counted as "a factor" (step-up methods, the first-factor rule, the user drawer) | **exists** (`user_passkeys.has_factor` / `counts`) | |
| **The passkey as the second factor of the remote (external) sign-in** | **MISSING** | `ha_user_auth.second_factor_need` returns `code` only for an enrolled authenticator (or, under a required policy, an active phone key); `_check_second_factor_sync` accepts only the authenticator code, a recovery code or `dk1:` (phone key). |
| The sign-in factor policy satisfied by a passkey | **MISSING** for home-system users | `second_factor_need` -> `enroll` / `ha_mfa`; `factor_policy._factor_of` counts passkeys of Arx-only identities only |
| The sign-in page offering the passkey to a home-system user | **MISSING** | `arx-login.methods()` returns `['totp', 'recovery']` for the remote step (MFA-SCREENS-2510 open question 4.3) |
| Passwordless sign-in (the passkey as the ONLY factor) | **not possible by the identity model** - see below | |

Consequences of the gap: (a) a home-system user whose only factor is a passkey is asked for nothing at a new remote sign-in - the
passkey protects step-up but not the sign-in itself, although registering it ended the user's other sign-ins "like a TOTP enrolment";
(b) under a required sign-in factor (per-user / per-role override, the legacy `admins` policy, or an enforced `security.factor_policy`)
such a user is refused with "enrol first" although a passkey that counts is on the account; (c) a user with the code and a passkey must
type the code.

Why not passwordless: a home-system user's Arx session (`RemoteSession`) stands on a home-system access token obtained through the home
system's own login flow, re-validated against it every few minutes and revoked with it (sessions list, sign-out everywhere). A passkey
cannot produce such a token unless Arx mints home-system credentials (an admin token, a created account or a refresh token on the user's
behalf) - account creation and changes to home-system users are out of bounds, and Arx never holds home-system passwords. So "sign in
with the passkey on the external path, where the identity model allows" = the passkey as the **second step** of the external sign-in,
after the home system accepted the password. The Arx-only identity's passwordless mode (`security.local_passkey_first`) is untouched.

## 2. What changed

### 2.1 Backend (default behaviour unchanged)

* New setting **`security.passkey_remote_factor`** (`off` default | `on`): `services/settings_store.py` DEFAULTS, `routers/settings.py`
  (pattern `^(on|off)$`, 422 otherwise), `services/backup.py` SETTINGS_KEEP (never restored). Changed through `PATCH /settings`
  (system.configure; the step-up gate covers it while step-up is on; audited `settings.update` with the key) - the same treatment as the
  other sign-in factor policy keys (`security.factor_policy*`).
* New `services/passkey_sign_in.py` (see its docstring): `counts()` (switch on AND `user_passkeys.counts`: made for the current public
  address, user verification for an administrative user, `security.passkeys_all_users` on; never an Arx-only identity), `offer()`,
  `parse_answer()`, `check_answer()`.
* `services/ha_user_auth.py` (the browser exchange `POST auth/session` only):
  * `second_factor_need(..., passkey=True)`: a passkey that counts is a factor like an enrolled authenticator - every NEW remote sign-in
    owes it (the rotation of the caller's own live cookie session does not, as before), and it satisfies a required policy.
  * The 401 `second_factor_required` carries `details` = `{methods, passkey: {origin, publicKey}}` - WebAuthn request options for the
    user's own usable passkeys - when (and only when) the switch is on and the user's passkey counts. Otherwise `details` stays `{}`
    (byte-identical answer of before). No new public route: the options reach only a caller whose home-system token was just validated
    for that user (the first factor), and the exchange's existing rate limits apply (per address 10 / min, 50 / h; per user 20 / min,
    200 / h).
  * The answer goes in the existing `X-Arx-Second-Factor` header as `pk1:<rawId>.<clientDataJSON>.<authenticatorData>.<signature>
    [.<userHandle>]` (base64url, at most 6000 characters) - the pattern of the phone key's `dk1:`.
* Challenge: 32 random bytes in a new `remote_factor` pool of `services/local_passkeys.py` (memory only; 60 s; single use - spent at the
  first presentation whatever the outcome; one open per user, a new offer replaces it; `MAX_CHALLENGES` ceiling - a full pool offers
  nothing and the code still works), bound to the user AND to the caller's home-system sign-in (a hash of the token's refresh-token id,
  else of the token) - an assertion made for one sign-in is refused on another.
* Verification: `local_passkeys._check` (the verifier every passkey ceremony uses): origin and RP id of the configured public address
  (`security.local_public_url`, never a request header), user presence, user verification for an administrative user, signature,
  backup-eligibility, counter. Also: the credential is the user's own, counts now, and the user handle (when sent) is the user's.
* Refusals: uniform 401 `second_factor_invalid` (the page keeps the step, as for a wrong code), audited `auth.second_factor.failed` with
  method `passkey` and `why` = `passkey_<reason>` (`not_counting`, `not_offered`, `malformed`, `challenge_unknown`, `challenge_mismatch`,
  `cross_user`, `credential_unknown`, `user_handle_mismatch`, `not_usable`, and the verifier's reasons such as `origin_mismatch`,
  `counter_regression`). A counter regression also writes `auth.passkey.counter_regression` (step `sign_in`) and the managers'
  `security.local_passkey_clone` notice. Success: `auth.passkey.used` (step `sign_in`, the passkey's public id), the counter and
  `last_used_at` updated, and the new session starts with a fresh step-up proof (`step_up.note_sign_in_factor`, as after the code). No
  audit row ever carries a credential id, a public key, a challenge, a signature, a label or the answer.
* Bearer path (native clients): unchanged - `second_factor_need` is called without `passkey`, so the passkey is not a sign-in factor
  there (as before), and a `pk1:` answer is refused (`passkey_not_offered`, fail closed). A native client has no browser origin to make a
  passkey assertion for the public address.
* `services/factor_policy._factor_of` (the compliance view: who has a factor): a home-system user's passkey that counts is `passkey`
  while the switch is on.
* Not changed: Ingress (no sign-in exchange), the phone app's session path (`app_session`), the Arx-only identity's passkey rules,
  registration / removal / step-up of slice 4, the HA-users directory, groups and admin flags.

### 2.2 Frontend

* `arx/auth.ts`: `ArxAuthError.details` (additive); the pending second step keeps the server's offer (`pendingFactorMethods()`,
  `pendingPasskeyOrigin()`); `completeSecondFactorPasskey()` - asks the exchange again without an answer when the offer is older than
  40 s or was already used (the challenge lives 60 s and is single use), runs the ceremony (`webauthn.getPasskey`), sends `pk1:` once;
  a cancelled ceremony keeps the step; `passkeyAnswer()` (the encoding). `completeSecondFactor(code)` unchanged in behaviour.
* `arx/arx-login.ts`, the remote second step of a home-system user: with no offer (the switch off) exactly the step of before (code +
  recovery code). With an offer: code + passkey + recovery code in the existing methods chooser (MFA-SCREENS-2510's look) when the user
  has both; the existing passkey block alone (no chooser) for a passkey-only user; the passkey key only when this browser can use
  passkeys and the page is at the address the passkey works at - elsewhere a passkey-only user gets the button disabled and the existing
  line "passkeys work only at <address>". No new style, colour or size.
* `components/sw-factor-policy-admin.ts` (Settings › Users & permissions › Second factor): one more row in the sign-in policy card -
  "מפתח גישה כאימות בכניסה" / "Passkey at sign-in", a switch (`sw-toggle`, as the wall-panel row), off unless switched on, saved with the
  tab's one save row, read-only without system.configure.
* Texts (Hebrew + English): `i18n/lang/en/i18n/msg/mfa.ts` (2), `i18n/lang/en/i18n/msg/misc.ts` (1). The sign-in reuses existing
  `local-identity` texts (`passkeyUse`, `passkeyWaiting`, `passkeyUnsupported`, `passkeyWrongHost`, `passkeyCancelled`). No home-system
  brand name anywhere in the UI.

### 2.3 Files

`smplwise_vms/backend/smplwise/services/passkey_sign_in.py` (new), `services/ha_user_auth.py`, `services/local_passkeys.py` (one pool),
`services/factor_policy.py`, `services/settings_store.py`, `services/backup.py`, `routers/settings.py`,
`smplwise_vms/backend/tests/test_mfa_ha_passkey_2520.py` (new), `frontend/src/arx/auth.ts`, `frontend/src/arx/arx-login.ts`,
`frontend/src/arx/webauthn.ts` (exports `RequestOptionsJSON`), `frontend/src/components/sw-factor-policy-admin.ts`, the two English packs,
`frontend/tests/unit-mfa-ha-passkey-2520.spec.ts` (new), `frontend/tests/evidence-mfa-ha-passkey-2520.spec.ts` (new), refreshed
baselines of `frontend/tests/pixel-mfa-screens-2510.spec.ts-snapshots/mfa-policy-preview-*` (the policy card gained the row). No route,
wire type, migration or API inventory change. Files of the 2.52 train rows (WisKey R1-R7, bridge, DESIGN-LITERALS-2510): none touched.

## 3. Security notes

* Origin / RP id per access path: the RP is the configured public address only. The remote path at that address works; any other host
  (a second domain, a plain-http IP) cannot produce an assertion for it (the browser refuses the RP id, and the server compares the
  client data's origin with the configured origin) - fail closed, and the page says where passkeys work. Ingress has no sign-in step.
* Fail closed everywhere: an unreadable switch = off; a missing public address = the passkey does not count (nothing to ask, the
  behaviour of before - never a step nothing can pass); a full challenge pool = no offer (the code still works); every malformed or
  mismatching answer = 401 `second_factor_invalid`.
* No self-grant: the switch only adds a requirement / a way to answer it for a user who already registered a passkey under slice 4's
  rules; it never widens who can sign in, never creates accounts, never touches home-system users.
* Lock-out: a passkey-only user who loses the device signs in through the local channel (Ingress, no sign-in factor) and removes the
  passkey, or an administrator resets the user's methods (`DELETE /auth/second-factor/users/{id}`, which removes passkeys too); or the
  owner switches `security.passkey_remote_factor` off.

## 4. Known limits

1. The phone app's web sign-in: if its web view cannot run WebAuthn, a passkey-only home-system user cannot answer the step there (the
   button is disabled with "this browser cannot use passkeys"); the code or the phone key still work for users who have them. Open
   question 6.2.
2. The bearer path (native clients) never offers or accepts the passkey (section 2.1).
3. Challenges live in memory: a restart between the offer and the answer asks again (the page renews the offer by itself).
4. No real device was used (NOT_RUN): Chrome / Android / iOS passkeys at the lab address need the owner's devices.

## 5. Tests (real runs)

RESULTS: section 5 is filled from real runs only.

| Where | Command | Result |
|---|---|---|
| workstation (Windows, repo venv, `SW_WIRE_STRICT=1`) | `pytest tests/test_mfa_ha_passkey_2520.py` (15 tests: switch, off = before, on = asked and passes, code-or-passkey, binding to the sign-in / single use / RP id / signature / user handle / UP / malformed, wrong origin, cross-user, counter regression + notice audit, off again, required policy, bearer path, compliance, no public address, answer format, audit hygiene, local channel) | **15 passed** |
| workstation | `ruff check smplwise` | All checks passed |

## 6. Open questions (recommendation first)

1. **Default of `security.passkey_remote_factor`.** (a) ship `off` (the brief: default = today's behaviour; the owner switches it on in
   Settings › Users & permissions › Second factor) [recommended]; (b) `on`, so every home-system user with a passkey is asked at the next
   remote sign-in.
2. **The phone app's web view** (limit 4.1). (a) leave as is and check WebAuthn support of the Android shell in a separate row (the phone
   key already covers the app) [recommended]; (b) exempt sign-ins from inside the app from the passkey requirement (weakens the factor).
3. **Who may change the switch.** (a) system.configure through `PATCH /settings`, audited `settings.update` - like the other sign-in
   factor policy keys [recommended]; (b) system administrators only with a dedicated audit row, like `security.passkeys_all_users`.
4. **An enrolment-required home-system user registering a passkey as the enrolment** (today the "enrol first" answer leads to the
   authenticator code). (a) a later row, together with the step-up dialog wording ("a passkey or the code") [recommended]; (b) nothing.
