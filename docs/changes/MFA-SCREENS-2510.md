# MFA-SCREENS-2510 - the second-factor screens (slice 11 "SCREENS" of the second-factor train)

Branch `pilot/MFA-SCREENS-2510`, cut from `origin/pilot/MFA-TRAIN-2500` at `92d3b6edd` (slices 1-9 already merged there by
MFA-SECFIX-2500, so `origin/pilot/MFA-POLICY-2490` and `origin/pilot/MFA-RECOVERY-2490` were already ancestors - nothing to merge
for them), then `origin/pilot/MFA-TRAIN-2500` merged again at `1331c2077` (SECFIX: step-up off by default) and at `8d9faa6e3` (SECFIX
done: all slices 1-9 and the security fixes) - both without a conflict. Target
version 2.51. Plan row 11 of `docs/changes/MFA-STEPUP-TRAIN-2490.md` section 4. No version bump, no changelog entry, no tag, no lab,
Home Assistant, NVR or go2rtc contact.

Owner answers 2026-11-24 applied (binding): step-up is OPT-IN (`security.step_up` default off, Q2 = b - the backend default itself was
flipped by MFA-SECFIX-2500 on the train; this slice's screens read a missing value as off too); Q14 - no forced re-enrolment after a
recovery-code sign-in yet: the screen hook is built and OFF.

## 1. What changed

### 1.1 My Account › Security (`components/sw-account-security.ts`, lazy chunk)

The user menu's "second factor" section became **אבטחה / Security** (`data-my-security`, the old `data-my-second-factor` hook kept on
the same `<details>`), and the separate "access tokens" section moved into it - the user's factors in one place:

- an overview: authenticator app on / off, passkeys, phone keys, recovery codes left (amber when low), long-lived tokens (amber when any);
- the blocks, each as its slice built it (own look kept): authenticator code + recovery codes count / regenerate (`sw-second-factor`,
  slice 7), passkeys (`sw-passkeys`, slice 4), **phone keys** (`components/sw-device-keys.ts`, new: read-only list with what unlocks the
  key, the attestation verdict, added / last used, and a revoke - asked once more in place, then the server's 403 `step_up_required` goes
  to the shell's step-up dialog and the DELETE is sent once more, once; slice 8 routes) and access tokens (`sw-access-tokens`, slice 6).
- The overview is read when the section opens and again after a phone key was revoked or a step-up proof was recorded.
- The whole section is one lazy chunk (it carries the QR library through sw-second-factor); `sw-access-tokens` and `sw-passkeys` left
  the shell's entry chunk with it (`scripts/lazy-tags-check.mjs` NOT_IN_ENTRY lists the new module).

### 1.2 Settings › Users & permissions › Second factor (`components/sw-factor-policy-admin.ts`, tab `factor`)

For holders of `system.configure` (edit) or `rbac.assign` (read only), not for a delegated site administrator:

- sign-in factor policy (optional / admins / sensitive / all), report vs enforce, wall-panel exemption, long-lived tokens from outside
  (allow / refuse under the policy / refuse) - slice 5 settings, saved with one save row through `PATCH /settings`;
- the compliance view (users, covered, of them with a factor, missing, exempt; who is missing and who is exempt, with the reason) and,
  while a different policy is chosen but not saved, the **preview** of that policy (`GET /security/factor-policy?policy=`) - "these users
  would have to enrol"; the preview ends with the save;
- step-up: the switch (off unless switched on), the minutes (0-30, disabled while off) and the local-channel switch, with the caller's own
  confirmation line (`sw-step-up-status`). While step-up is on the save itself is confirmed by the shell's dialog.
- The remote-access tab's step-up card (slice 2) is left in place (open question 4.1).

### 1.3 The user drawer (`components/sw-user-factors.ts`)

The drawer's "second factor" row now shows the authenticator row as before (`sw-second-factor-user`: on / off, since, its reset with the
administrator's own code) and under it the user's other factors - passkeys (all / usable), phone keys (active / counting), recovery codes
left, Home Assistant MFA seen - and the policy's verdict (required / optional / exempt, why, report only). A user with passkeys, phone
keys or recovery codes but **no** authenticator code gets the reset here too (the same existing route
`DELETE /auth/second-factor/users/{id}`, which removes every factor kind since SECFIX SR-2). `sw-second-factor-user` now fires
`factors-changed` after a reset (one line) so the list reads again.

### 1.4 The sign-in methods chooser (`arx/arx-login.ts`)

The second step of the sign-in has ONE chooser in the look of the local / infrastructure switch (`data-arx-methods`,
`data-arx-method="totp|passkey|recovery"`, `aria-pressed`), replacing slice 7's "use a recovery code" link and the separate passkey
button: a home-system user's remote sign-in offers the code and a recovery code (slice 4 left the passkey out of that step); an Arx-only
identity offers the code, a passkey (when the browser can) and a recovery code (only beside the code - the codes come with it); a
passkey-only identity sees no chooser. **Q14 hook**: `arx-login.recoveryReenrol` (from remote-config `recovery_reenrol`, which no server
sends) - on, a recovery-code sign-in lands on the enrolment step; off (default, today) nothing changes.

### 1.5 The step-up dialog's other methods (`components/sw-step-up-dialog.ts`; MFA-SECFIX-2500 open question 5, added to this slice by the lead)

The shell's step-up dialog (slice 2) offered the authenticator code and the passkey. Now also:

- **the phone key** - only inside the Android app that holds a key (`window.ArxApp.deviceKey.status()` answers a key id) and when the
  gate's 403 lists `device_key`: "אישור במפתח הטלפון" asks `POST auth/device-keys/challenge {purpose: step_up, key_id, action}`, the app's
  biometric prompt signs the server's text (`ArxApp.deviceKey.sign`), then `POST auth/step-up/verify {method: device_key, ...}` - the same
  proof, the same single retry. Outside the app a phone-key-only user is told to confirm from the app;
- **a recovery code** - a link under the code field switches it to a one-time recovery code (`XXXX-XXXX`, `method: recovery_code`), offered
  beside the code for the normal window only: never for a once-action (`details.once`) and never for adding a factor
  (`NO_RECOVERY_ACTIONS` mirrors `services/step_up.FACTOR_ADD_ACTIONS`); the server refuses those too (409 `step_up_method_refused`,
  shown as is).

`api/client.ts` `StepUpDetails.once?` (frontend type only), clients in `api/factor-screens.ts` (`deviceKeyStepUp`, `recoveryStepUp`,
`appDeviceKeyId`).

### 1.6 Backend - one read route (new files only, listed)

`GET /api/v1/security/user-factors/{user_id}` (`routers/user_factors.py`, `wire/user_factors.py`; readers as `GET /security/factor-policy`:
`rbac.assign` or `system.configure`): the authenticator code (on / since / last used), passkeys (all / usable), phone keys (active /
counting under the attestation mode), recovery codes (remaining / total / low), HA MFA seen, and the policy verdict. Counts, dates and
verdicts only; no write, no audit. Wiring: one `Mount("user_factors", "remote")` line in `routers/__init__.py` after `device_keys`, one
family line in `scripts/gen_wire_types.py`, generated `frontend/src/api/generated/wire-user-factors.ts` (byte-identical to the
generator's output on the runner), `contracts/API_INVENTORY.md` regenerated (1926 routes). No file of slices 1-9 changed on the backend.

### 1.7 Other files

`api/factor-screens.ts` (clients for phone keys, the policy read with preview, user factors), `i18n/msg/mfa.ts` + the English pack
`i18n/lang/en/i18n/msg/mfa.ts` (88 texts; `i18n/lang/en.ts` regenerated by `scripts/i18n-split-langs.mjs`), `arx/auth.ts`
(`RemoteConfig.recovery_reenrol?`), `arx/boot.ts` (passes it), `screens/system-access.ts` (the tab, the drawer row),
`shell/sw-user-menu.ts` (the section). Specs updated for the moved hooks: `tests/evidence-access-tokens.spec.ts` (tokens inside
Security), `tests/unit-mfa-recovery-codes-2490.spec.ts` (the chooser instead of the link).

## 2. Tests

New: `tests/evidence-mfa-screens-2510.spec.ts` (7 tests x desktop + mobile + a shots test; axe-core on each screen, serious / critical
violations inside this slice's elements), `tests/pixel-mfa-screens-2510.spec.ts` (3 baselines x desktop 1440 + phone 390, classic light),
`tests/unit-mfa-signin-methods-2510.spec.ts` (5 tests + shots, dev-server page spec), `tests/mfa-screens-mocks.ts` (shared mocked
backend), `smplwise_vms/backend/tests/test_mfa_screens_2510.py` (4 tests).

RESULTS: see section 3 (filled from the runner job `~/work/mfascreens_run.sh`, one slot-B lease).

## 3. Test results (real runs)

PENDING

## 4. Open questions (recommendation first)

1. **The remote-access tab still has the step-up card of slice 2** (same three settings, own save row). (a) remove it there and leave a
   one-line pointer to Users & permissions › Second factor, once MFA-SECFIX-2500's specs on that card are settled [recommended - one place
   per setting]; (b) keep both.
2. **Q14 re-enrolment after a recovery-code sign-in**: the hook exists (`recovery_reenrol`), no server sends it. (a) when wanted, a
   setting `security.recovery_reenrol` (default off) in remote-config, nothing else to build in the screens [recommended]; (b) drop the hook.
3. **Passkey as the home-system user's remote sign-in factor** (slice 4 open question 1): the chooser offers code / recovery code there.
   (a) add the passkey key to the chooser in the row that builds that sign-in path [recommended]; (b) leave as is.
