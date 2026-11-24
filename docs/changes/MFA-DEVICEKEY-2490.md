# MFA-DEVICEKEY-2490 - the phone key of the Android app (second-factor train, slice 8 "DEVICEKEY-SRV + APP")

Branch `pilot/MFA-DEVICEKEY-2490`, cut from `origin/pilot/MFA-STEPUP-2490` (slice 1, `fb9a3ac1e`). Plan: `docs/changes/MFA-STEPUP-TRAIN-2490.md`
section 4 row 8; design `docs/design/full-2fa-t095/DESIGN.md` (on `origin/pilot/FEATURE-DESIGNS-SEC-2490`) sections 4.2, 4.4, 6, 7, 8.
No merge, no version bump, no changelog entry, no web UI, no lab, Home Assistant, NVR or go2rtc contact, no real phone.

Owner decisions implemented: **Q51** (2026-11-22) "in the app, password + phone key counts as two-factor"; **q23 b** (form round 10)
"biometric or the phone's screen lock" (`security.device_key_auth` default `biometric_or_screen_lock`). **Q52** (attestation) is slice 9:
only the hook is here.

## 1. Server

| Piece | What |
|---|---|
| Migration `0222_device_keys.sql` | `auth_device_keys(id 'dk_'+24 hex, user_id, label, spki BLOB, fp UNIQUE, alg 'ES256', auth_kind CHECK biometric / biometric_or_screen_lock, platform 'android', created_at, last_used_at, sign_count, revoked_at, revoked_by, revoked_reason, attestation_json NULL)`. Number 0222 = the lead's allocation (0219 TOKENS, 0220 RECOVERY, 0221 POLICY); no other branch on origin uses 0221 / 0222 (checked 2026-11-24 over every remote branch). |
| `services/device_keys.py` | Challenges in memory, single use (spent at first presentation, also when refused), 60 s, at most 5 open per user / key and 5000 in all, bound to purpose (`register` / `step_up` / `sign_in`), origin (`<scheme>://<host>` the request reached), user, session (step-up session key), key and action. The signed bytes: `arx-device-key|v1|<purpose>|<origin>|<user or ->|<key id or ->|<action or ->|<nonce>`. ES256 verify reuses `services/app_refresh_key` (SPKI DER or X9.63 point; DER or raw r‖s signatures). Wrong signatures lock the phone-key method (5 / 5 min -> 10 min), persisted in `auth_totp_failures` under `dk:<user>`, separate from the authenticator-code lockout (design 8.2). `check_attestation()` = the slice-9 hook (checks and stores nothing). `revoke_all()` ready for slice 10. |
| `routers/device_keys.py` (mounted after `second_factor`, tag `remote`) | `POST auth/device-keys/challenge {purpose: register \| step_up, key_id?, action?}`; `POST auth/device-keys/sign-in/challenge {key_id}` (public, per-address limit, the same answer whether the key exists or not, no user id in the payload); `POST auth/device-keys {challenge_id, public_key, signature, label, auth_kind, attestation?}`; `GET auth/device-keys`; `DELETE auth/device-keys/{key_id}`. |
| Step-up (slice 1 core) | `step_up.methods_of` adds `device_key` for a user with an active key; `POST auth/step-up/verify {method: "device_key", challenge_id, key_id, signature, action?}` -> a proof on the session (`auth.step_up.ok` / `.failed`, same 400 `second_factor_invalid` / 429 `second_factor_locked` as the code). Wire `StepUpStatus.methods` / `StepUpProof.method` gain `device_key`. |
| Sign-in factor (Q51) | `X-Arx-Second-Factor: dk1:<challenge_id>:<signature>` on `POST auth/session` (cookie exchange) and the bearer path; the Arx-only second step `POST auth/local/sign-in/second-factor {code}` takes the same answer (field widened 16 -> 260; a TOTP code longer than 16 is refused as invalid). Audit rows name the method (`totp` / `device_key`). A user under a `required` policy whose only factor is a phone key now gets 401 `second_factor_required` (answerable from the app) instead of 403 `second_factor_enrollment_required`. |
| Registration / revoke rule (design 4.4, T2) | On the remote channel a user who already has a step-up method needs a fresh proof in this session (403 `step_up_required`, action `auth.device_key.register` / `auth.device_key.revoke`), whatever `security.step_up` says. A user with no factor registers the first key with the signed-in session only (like the first TOTP enrolment). The local channel (Ingress) is the break-glass path and needs no proof. A revoke drops the user's step-up proofs. |
| Setting | `security.device_key_auth` = `biometric_or_screen_lock` (default) \| `biometric`; `PATCH /settings` (system.configure, therefore step-up gated); in `backup.SETTINGS_KEEP`. |
| Audit / notice | `auth.device_key.registered` / `.revoked` / `.refused` (key id, 16-hex fingerprint prefix, auth kind; never a nonce, signature or key). Notice source `security.device_key_added` (the account's own user, inbox + app). |
| Backup / privacy | `auth_device_keys` in `backup.NEVER_EXPORTED_TABLES`; `local_privacy.DELETE_ROWS` and the data export (`phone_keys`, no key material). |

## 2. App (mobile/android-shell)

- `DeviceKey.kt`: `DeviceKeyPolicy` (pure, JVM-tested) - parses the payload, signs only for the app's own server origin, a known purpose,
  and (except `register`) the app's own key id; per-server Keystore alias; effective auth kind (screen lock only on API 30+, where a
  per-use key can take it; below: biometric only). `DeviceKey` - EC P-256 in `AndroidKeyStore`, `PURPOSE_SIGN`, SHA-256,
  `setUserAuthenticationRequired(true)`, API 30+: `setUserAuthenticationParameters(0, BIOMETRIC_STRONG [| DEVICE_CREDENTIAL])`,
  below: per-use biometric; `setInvalidatedByBiometricEnrollment(true)`; StrongBox when present (fallback to TEE); attestation challenge
  parameter for slice 9 (unused). `sign()` = `BiometricPrompt` + `CryptoObject(Signature SHA256withECDSA)`; the prompt shows the
  page's action text; a key voided by a new fingerprint is deleted and the user is told.
- Bridge: `window.ArxApp.deviceKey = {status(), create({authKind}), sign(payload, text), setKeyId(id), remove()}` (promises), messages
  `deviceKeyStatus / Create / Sign / SetId / Delete` through the existing `addWebMessageListener` port, answered via its reply proxy
  (`deviceKeyResult`). `create` and `remove` need a recent tap; one prompt at a time; nothing while the app lock is up.
- Strings (Hebrew): `device_key_prompt_title`, `device_key_prompt_default`, `device_key_invalidated`.
- Not in this slice: the web page that drives it (account security page / step-up sheet - slices 2 and 11) and the sign-in page's use
  of the sign-in challenge (`arx-login.ts`).

## 3. Contradictions and limits (recorded, not resolved silently)

1. The design's API sketch names `POST auth/device-keys/register/options {label}` -> `{nonce, expires_in, auth_kind}`. Implemented as
   `POST auth/device-keys/challenge {purpose: "register"}` (one challenge route for register and step-up; the server hands out the
   exact payload). The design's `POST auth/step-up/challenge` belongs to slice 4 (PASSKEYS) and is not touched here.
2. The design's `sign_count` / `.counter_regression`: a Keystore ECDSA key has no authenticator counter; `sign_count` counts verified
   signatures only and no counter-regression rule exists.
3. A user whose ONLY factor is a phone key is gated in a browser too (same choice as slice 4 for passkey-only users), where the key
   cannot answer: such a change must be made from the app, or the user adds the authenticator code. Open question 4.1.
4. Challenges live in memory: a restart loses them (the user taps again). The sign-in challenge is public but carries no user and
   reveals nothing about the key.
5. Origin binding uses the request's Host (as `arx_client_id` does), not `security.local_public_url`; the app refuses any payload
   whose origin is not its own server, which is what makes a relayed page unable to obtain a signature.
6. Merge note: slice 4 (PASSKEYS) edits the same `StepUpBody` / `step_up_verify` / `methods_of` / wire literals; the merge combines the
   method lists (`totp|passkey|device_key`). Slice 7 (RECOVERY) edits `local_identity.second_factor_step` too.

## 4. Open questions (recommendation first)

1. **Phone-key-only user changing settings from a desktop browser.** (a) keep gated; the step-up sheet (slice 2/11) tells the user to
   approve from the app or add the authenticator code [recommended: a stolen desktop cookie must not skip step-up]; (b) not gated where
   the key cannot answer.
2. **Who may change `security.device_key_auth`.** (a) any `system.configure` holder after step-up, audited by the settings row
   [recommended, like the step-up switches]; (b) system administrators only (a validator like `security.passkeys_all_users`).
3. **Lost phone when the phone key is the only factor.** Remote self-revoke needs a proof the user cannot give; (a) revoke from the
   local channel or by an administrator (slice 10 `revoke_all`) [recommended]; (b) allow a remote revoke without proof (would let a
   stolen session remove the factor and switch step-up off for that user).

## 5. Tests (real runs)

| Where | Command | Result |
|---|---|---|
| workstation (Windows, Python 3.12, `.venv` of the main checkout, `SW_WIRE_STRICT=1`) | `pytest tests/test_mfa_devicekey_2490.py -o addopts=""` | **19 passed** |
| runner slot B | auth-related backend files (see 5.1) | see 5.1 |
| runner | Android unit tests / compile | see 5.1 |
| real phone | instrumented key creation, prompt text, invalidation after a new fingerprint, screen-lock variant on API 30+ | **NOT_RUN** (owner must be present) |

### 5.1 Runner results

(filled in below after the runner job)
