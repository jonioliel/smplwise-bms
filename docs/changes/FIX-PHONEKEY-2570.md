# FIX-PHONEKEY-2570 - a phone key can be registered; the phone shows what is signed

Row of the 2.57 fix train. Base: `origin/release/2570-train` (`9a7540f68`). Branch: `pilot/FIX-PHONEKEY-2570`.
Findings: second deep review, `docs/review/DEEP-REVIEW-2570-SECURITY-ADMIN.md` on `origin/review/DEEP2-2570-SECURITY-ADMIN`:
**SA2-01** (medium) and **SA2-02** (low). Owner decision for SA2-01: recommendation (a) - build the registration screen, test on a
real phone before the capability is announced.

## Confirmed at the base

- SA2-01: `git grep` at the base finds no caller of `deviceKey.create`, `purpose: 'register'` or `POST auth/device-keys` in
  `frontend/src`; `sw-device-keys.ts` said "No add button" and showed "add a key in the Android app"; the watcher read the key id once
  (`push-approval-watch.ts`). Still present - fixed here.
- SA2-02: `WebActivity.kt` built the prompt subtitle from `msg.optString("text")` (`DeviceKeyPolicy.promptText`); the bridge forwarded
  the page's second argument. Still present - fixed here.

## What changed

### SA2-01 - the registration (web, inside the Android app)

- `frontend/src/api/factor-screens.ts`: `registerDeviceKey(label)` = `POST auth/device-keys/challenge {purpose: "register"}` ->
  `ArxApp.deviceKey.create({authKind: <installation's kind>, payload})` (the app attests with SHA-256 of the payload) ->
  `deviceKey.sign(payload)` (the new key signs; the phone's own prompt) -> `POST auth/device-keys {challenge_id, public_key, signature,
  label, auth_kind, attestation?}` -> `deviceKey.setKeyId(id)` -> window event `sw-device-key-changed`. The server routes are
  unchanged (ADR-015: nothing new on the wire): step-up / recent sign-in (`step_up.require_first_factor_freshness`, 403
  `step_up_required` answered by the shell's dialog and the request sent once more; 403 `reauth_required`), auth kind, attestation
  mode, rate limits, audit `auth.device_key.registered` / `.refused`, the notice to the user's devices, and the revoke in the existing list.
- `deviceKeyEnrolment()`: `ready` only inside the top-level page of the Android app whose bridge has `create`, `setKeyId` and the new
  `signedPrompt: true` (i.e. the SA2-02 app); `update` in an older app; `no_app` in a browser or a frame. No key is ever registered
  through an app whose prompt shows the page's text.
- `components/sw-device-keys.ts`: under the list, inside the `ready` app, a name field and "הוספת מפתח בטלפון הזה" (design tokens, the
  passkeys' add-row pattern); the row of THIS phone gets the badge "הטלפון הזה"; while this phone's key is active the add is not
  offered ("revoke first"); an unconfirmed earlier key on the phone is announced as replaced; no biometric / screen lock, and the
  per-user maximum, are said before a press. Every failure says what happened (cancelled on the phone, no tap, timeout of the 60 s
  challenge after a slow confirmation, a server refusal, registered-but-not-kept). An older app: "update to 2.1.0". A browser with no
  key: "add it from the Arx Android app (2.1.0 or later)" (replaces the old empty line; a browser WITH keys looks as before).
- Review point 1 (`DeviceKey.create` deletes the old key first): settled on the page side - the add is offered only when this phone's
  key is not active on the account, so a refused registration never costs the phone a key the server still counts. `DeviceKey.kt` is
  unchanged there.
- Review point 2: `shell/push-approval-watch.ts` re-reads the app's key id on `sw-device-key-changed`: an enrolment starts the
  approval watcher without a reload (no request is ever made while the app has no key).
- Settings: the admin switch "אישור בטלפון" (`security.push_approval`, `sw-factor-policy-admin.ts`) is shown where a key can be
  registered (the `ready` app) and wherever it is ON (it must stay possible to switch it off); otherwise an honest line: available in
  the Arx Android app from 2.1.0. `security.device_key_auth` / `security.device_key_attestation` have no screen (unchanged). The
  step-up dialog already offers the phone key only when the app holds one.
- Not built (and said so in the guide): the phone key as the second factor of a SIGN-IN (owner Q51) - the server is ready, no client.

### SA2-02 - the prompt shows the signed payload

- Android (`DeviceKey.kt`): `DeviceKeyPolicy.promptOf(payload)` maps the SIGNED purpose / action to a fixed line (register, sign-in,
  identity, approval with the number from `auth.push_approval.n<NN>`, disarm, bypass, alarm, door, permissions, users, sign-in methods,
  backup restore, bridge key, settings; anything else shows the signed action name). `WebActivity.kt` uses it for the BiometricPrompt
  subtitle; the page's text is not read. `promptText` / `MAX_PROMPT_TEXT` removed. `strings.xml`: the lines (Hebrew, the app's only
  language).
- Bridge (`BridgeScript.kt`): `sign(payload)` sends the payload only (a second argument is dropped before the message), and
  `deviceKey.signedPrompt: true` advertises the behaviour.
- Web (`api/device-key-prompt.ts`, `signPayload` in `factor-screens.ts`): the page also sends the payload-derived line (so an older app
  that still shows the page's text shows the signed action, too); `deviceKeyStepUp(keyId, action)` and
  `approvePushApproval(id, keyId, number, signer)` lost their free-text argument.
- App version: `mobile/android-shell/gradle.properties` 2.0.2 (3) -> **2.1.0 (4)** (the page names 2.1.0: `PHONE_KEY_APP_VERSION`).

### Docs

- `docs/user-guide/he/82-second-factor_HE.md`, `docs/user-guide/en/82-second-factor_EN.md`: how a key is added, what the phone shows,
  that phone-key sign-in is not available yet, where the switch is.
- Owner's real-phone acceptance steps (Hebrew): `private/planning/phone_key_owner_steps_2026-11-28_HE.md` (not in Git).
- Compare page: `private/planning/fix_phonekey_2570_compare_2026-11-28.html` (not in Git; 16 pictures in `private/planning/fix_phonekey_2570_shots/`).

## Tests

All runs on the runner through `~/work/slotb.sh` (job `~/work/p2570_phonekey_job.sh after|before`, Node + Playwright, desktop and
mobile projects, 2 workers, no retries). "before" = the base (`origin/release/2570-train` at `ae9b986c0`) with this row's new and
changed test files copied in; "after" = this branch at `244cc18b2` (the later commits change only the compare-shot test and this note).

| Check | before | after |
|---|---|---|
| `tsc --noEmit` app + `npm run typecheck` (tests) | - | PASS (0 errors each) |
| `npm run lint` (eslint src) | - | PASS |
| `unused-exports --enforce` | - | exit 1: three NEW items, all in `src/home/home-logic.ts` / `home-target.ts` (not touched by this row; present at the base). Nothing of this row is listed |
| `vite build` | PASS | PASS |
| unit (Node): `unit-fix-phonekey-2570` (10) + `unit-push-approval-fix-2560` + `unit-android-app` | **FAIL** (the new spec cannot load: `api/device-key-prompt` and the registration API do not exist) | **PASS** 21/21 |
| page: `evidence-fix-phonekey-2570` (7 x 2 projects) | **FAIL** 10 of 14: add / step-up-then-register / cancelled / older app / browser line (the two "switch stays while on / in the app" guards pass on both) | **PASS** |
| page: `evidence-mfa-screens-2510` (phone-key step-up now expects the signed action's words, `שינוי הגדרות`) | **FAIL** 2 (desktop + mobile: the page sent its heading `אישור זהות`) | **PASS** |
| page: `unit-mfa-t095-rest-2530` (phone approval: the signed number), `pixel-mfa-screens-2510` (account security, policy tab, user drawer; existing baselines compared, none skipped) | PASS | PASS |
| totals of the page run | 12 failed, 50 passed, 10 skipped | 62 passed, 10 skipped (the skips are the shot-only tests and tablet-excluded cases) |
| Android `testDebugUnitTest` (`DeviceKeyPolicyTest`: prompt from the signed payload, the approval's signed number, the bridge drops the page's text, `signedPrompt`) | NOT_RUN | **NOT_RUN** - no JDK / Android SDK on the runner or the workstation |
| Android build of 2.1.0 (APK) | - | **NOT_RUN** (no toolchain; no app-store build by rule) |
| real phone (Keystore key, prompt text, attestation, step-up, approval, new fingerprint) | - | **NOT_RUN** - the owner's acceptance steps: `private/planning/phone_key_owner_steps_2026-11-28_HE.md` |
| backend | - | not changed; no backend test run |
| compare shots (`evidence-fix-phonekey-2570` -g shots, `SW_SHOTS_DIR`; app + browser, desktop + phone, light + dark) | PASS, 8 pictures at `9a7540f68` + this row's spec / mock | PASS, 8 pictures at `39175f51b` |

Not claimed: that anything works on a real phone. The capability must not be announced before the owner's steps pass.

## Open questions

1. (lead: a) The "approve on the phone" switch in a desktop browser: (a, built) shown only in the app that registers keys and wherever it is on,
   a line otherwise; (b) always shown, with a hint line. Recommendation: a (the owner's brief).
2. (lead: a) App version: (a, built) `gradle.properties` 2.0.2 (3) -> 2.1.0 (4) in this row; (b) leave the number to the lead and change
   `PHONE_KEY_APP_VERSION` with it. Recommendation: a.
3. (lead: a) Phone key as a sign-in factor (Q51): (a) a later row with its own screen and a real-phone test; (b) drop the server part.
   Recommendation: a.

## Rollback

Revert the branch's commits. No migration, no setting, no wire change; an app 2.1.0 keeps working with an older page (the page then
offers no registration).
