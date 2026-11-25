# MFA-T095-REST-2530 - the rest of T095 (CR-011): approval on the phone with number matching, the alarm code as step-up

Branch `pilot/MFA-T095-REST-2530`, cut from `origin/release/2520-train` at `eadaa25b8`. Task T095 (the CR-011 umbrella, BACKLOG; target
2.53). No lab, no Home Assistant, no device, no WisKey, no go2rtc. Both new behaviours ship **off** (owner rule: step-up and everything
new is opt-in; with the switches off nothing changes for anyone).

## 1. Gap analysis: T095 / CR-011 against what shipped (2.49-2.52)

Inputs: `management/tasks.json` T095 (acceptance 1-3), `docs/changes/CR-011-SECOND-FACTOR.md` (options A-E, section 9),
`docs/design/full-2fa-t095/DESIGN.md` (`origin/pilot/FEATURE-DESIGNS-SEC-2490`, sections 4.2 / 13), `docs/changes/MFA-*.md` (the train
2.49-2.52) and `docs/security/MFA-REVIEW-2520.md`.

| T095 / CR-011 item | Status before this row | Evidence |
|---|---|---|
| A1 remote sign-in factor by policy, HA MFA provenance, long-lived tokens | shipped (`security.factor_policy`, report by default; long-lived tokens allowed - owner Q48) | MFA-POLICY-2490, MFA-TOKENS-2490 |
| A2 central step-up gate, 5-minute window, off switch, local-channel switch | shipped, **off by default** (owner Q2 = b) | MFA-STEPUP-TRAIN-2490, MFA-SECFIX-2500 |
| A2 physical actions (disarm, bypass, door open), once-actions | shipped | MFA-STEPUP-GATES-2490, MFA-RESET-HARDENING-2510 |
| A2 server challenge 32-byte nonce, 60 s, bound to user / session / action | shipped (passkey, phone key) | MFA-PASSKEYS-2490, MFA-DEVICEKEY-2490 |
| A2 Android Keystore P-256 key, BiometricPrompt + CryptoObject, attestation | shipped (`biometric_or_screen_lock` - owner q23 b; attestation - owner Q52) | MFA-DEVICEKEY-2490, MFA-DEVICEKEY-ATTEST-2490 |
| A2 enrolment only after a fresh sign-in or an existing factor | shipped (SR-3; every factor ADD - review N-1) | MFA-SECFIX-2500, MFA-FACTOR-HARDEN-2520 |
| **A2 "browser / PWA sessions without a device key fall back to the personal alarm PIN for alarm actions"** (CR-011 4E, Q6 = a; owner q24 a) | **partial**: the PIN counted only when the alarm screen itself asked for it; under `alarm.remote_codeless = true` (the default) a remote disarm asks no code, so a session that cannot use its phone key had no alarm-code path | MFA-STEPUP-GATES-2490 section 1 |
| A2 factor reset local-only by default | owner chose `any` (Q53), with a channel setting + UI | MFA-RESET-HARDENING-2510, MFA-RESET-CHANNEL-UI-2520 |
| A3 passkeys in browsers / PWA (step-up and sign-in factor) | shipped | MFA-PASSKEYS-2490, MFA-HA-PASSKEY-2520 |
| A3 passkeys inside the Android WebView (`setWebAuthenticationSupport(FOR_APP)` + assetlinks + runtime fallback) | **partial**: the server serves `/.well-known/assetlinks.json`; the shell never calls `setWebAuthenticationSupport` (grep of `mobile/android-shell`: none) - inside the app the phone key is the method | open question 3 |
| **A3 "after CR-012, a push approval with number matching signed by the device key approves a sensitive action started elsewhere"** (CR-011 D; Q11 never answered - design q30 "not understood") | **missing** | registry sync 2026-11-25 |
| Real-phone sign-in / real authenticator on the owner's installation | NOT_RUN (lab, out of scope) | - |

Built here: the two **missing / partial and clearly specified** items - push approval (option D) and the alarm-code fallback (4E / Q6).
Not built: the Android WebView passkey setting (Android shell code that needs a real device to prove; question 3) and anything lab.

## 2. What this row adds

### 2.1 Approval on the phone with number matching (`security.push_approval`, default `off`)

For a session that is refused with 403 `step_up_required` and cannot answer itself (a desktop without the authenticator code or a
passkey, a browser without the phone key), when the account has an active phone key:

1. **Requester** `POST auth/step-up/push {action}` -> an approval request `pa_...` bound to the user, the requester's session (the
   step-up session key), the action and a random two-digit **number** (10-99, `secrets.randbelow`) that only the requester's answer
   carries. The account's own user gets the content-free notice `security.push_approval_requested` (new source; he/en) on every device
   through the **existing** channels - inbox, web push, the phone app's push through the SmplWise relay. No new provider, and the notice
   carries neither the number nor the action.
2. **Phone** (the Android app of the same user; a watcher that runs only inside the app shell holding a key) `GET auth/push-approvals`
   -> the pending request: the action, never the number. The person **types** the number the requesting screen shows.
3. `POST auth/push-approvals/{id}/challenge {key_id, number}` -> an ordinary phone-key `step_up` challenge (services/device_keys) bound to
   the PHONE's session, the key and the action text `auth.push_approval.n<number>` - the number is inside the signed bytes, and the
   existing app code (`DeviceKey.kt`, unchanged) shows the prompt and signs it after the fingerprint / face / screen lock.
4. `POST auth/push-approvals/{id}/approve {challenge_id, key_id, signature}` -> the signature is checked first (single use, bound,
   counts towards the phone-key lockout), then the number: the right one **approves**; a wrong one **denies** the request
   (`number_mismatch`). `POST .../deny` ("not me") denies too. After a denial the user's new requests wait 5 minutes (cooldown) -
   the push-fatigue attack is a flood of prompts.
5. The requester polls `GET auth/step-up/push/{id}` and, once `approved`, spends it with `POST auth/step-up/verify {method: "push",
   challenge_id: <id>, action}` within 60 s -> a proof for **one request of exactly that action on exactly that session**
   (`step_up.mark_action`, kept apart from the window mark), then it is `used`.

Fail closed: an unknown / other-user / other-session / expired (90 s) / unused (60 s after approval) / cancelled / superseded (one open
request per user) / spent request gets the same refusal. The requesting session never sees its own request in the phone list and
cannot approve it (409 `push_approval_same_session`). Push approval is **never** a proof for a once-action (another user's factor
reset, the bridge-key reveal, a role change to system administrator, a restore, an Arx-only passkey removal) nor for a change of the
caller's own factors (409 `step_up_method_refused` before anything is sent - question 2). Rate limits: 5 requests / 5 min and 20 / h per
user (refusals count); the phone routes 30 / min. Audit: `auth.push_approval.requested / .approved / .denied / .cancelled / .failed /
.refused`, `auth.step_up.ok` (method `push`, `action_bound: true`, the key id) - never the number, a challenge id or a signature.

**Why typed, not chosen.** The first cut showed three numbers to pick from; a blind tap would then succeed one time in three. The phone
now types the two digits (one in 90 for a blind guess, and a miss ends the request with a cooldown) - the safer default; question 1.

### 2.2 The personal alarm code as the step-up of one alarm action (`security.step_up_alarm_pin`, default `off`)

CR-011 4E / Q6 = a (owner q24 a): with the switch on, the 403 of an alarm **disarm** or **zone bypass** lists `alarm_pin` when the user
has a personal alarm code, and `POST auth/step-up/verify {method: "alarm_pin", code, action}` proves **one** request of exactly that
action on this session (never a window, never another action - a disarm proof does not open a bypass nor a settings change). The code is
checked against the same scrypt hash and counts towards the **same lockout** as the alarm screen's own code gate (key `user:<id>`,
5 wrong in 5 minutes -> 10 minutes, the administrators told): two doors never double the guesses. A user whose only method would be the
alarm code is gated for alarm actions only while the switch is on (with it off, `no_method` keeps today's behaviour); everything else
of that user is unchanged. The inline PIN of MFA-STEPUP-GATES-2490 (when the alarm screen asks the PIN itself) is unchanged.

### 2.3 Where it shows

- Step-up dialog (`sw-step-up-dialog`): "אישור בטלפון" (approve on the phone) - outside the app that holds the key - shows the number
  and waits; denial / expiry show the reason; cancel cancels the request on the server. The alarm code is the only field when the
  account has no authenticator code, behind a link otherwise (the recovery-code link hides while it is chosen).
- Phone (`sw-push-approval-sheet` + `shell/push-approval-watch.ts`): inside the Android shell with a phone key only (outside the app
  the watcher never calls the server - tested); looks at start, on every return to the foreground and every 5 s while visible and the
  switch is on. What is asked (in words, never an internal id), the number field, "אישור", "לא אני - לדחות".
- Settings > Users and permissions > Second factor, card "אישור לפני שינויים רגישים": two toggles under the local-channel one
  ("אישור בטלפון", "קוד האזעקה האישי כאישור"), disabled while step-up is off. Hebrew + English (`msg/mfa`). No HA branding.

## 3. Files

Backend: `services/push_approval.py` (new), `routers/push_approval.py` (new), `wire/push_approval.py` (new), `services/step_up.py`
(`methods_for`, `alarm_pin_*`, `mark_action` / `_take_action`, `not_applicable(action)`, `guard`, `required_error`),
`routers/second_factor.py` (verify dispatch, method pattern), `routers/alarm.py` (`verify_step_up_pin`), `wire/second_factor.py`
(`StepUpProof.method`), `routers/settings.py`, `services/settings_store.py`, `services/backup.py` (`SETTINGS_KEEP`),
`services/notify_policy.py` / `notify_policy_en.py` / `notify_policy_text.py` / `notify_sources.py` (the notice), `routers/__init__.py`
(mount), `scripts/gen_wire_types.py` (family `PushApproval`), regenerated `contracts/API_INVENTORY.md`,
`frontend/src/api/generated/wire-push-approval.ts`, `wire-second-factor.ts`.
Frontend: `src/api/push-approval.ts` (new), `src/components/sw-push-approval-sheet.ts` (new), `src/shell/push-approval-watch.ts` (new),
`src/components/sw-step-up-dialog.ts`, `src/components/sw-factor-policy-admin.ts`, `src/api/factor-screens.ts` (`deviceKeyBridge`
exported), `src/main.ts`, `src/i18n/lang/en/i18n/msg/mfa.ts`.
Tests: `smplwise_vms/backend/tests/test_mfa_t095_rest_2530.py` (new), `frontend/tests/unit-mfa-t095-rest-2530.spec.ts` (new), refreshed
`frontend/tests/pixel-mfa-screens-2510.spec.ts-snapshots/` (the policy tab).

Hot files shared with the 2.52 train: `services/step_up.py`, `routers/second_factor.py`, `routers/alarm.py`, `services/notify_*`,
`sw-step-up-dialog.ts`, `sw-factor-policy-admin.ts`. No WisKey / bridge / DESIGN-LITERALS file is touched.

## 4. Tests

See section 6 (filled from the real runs).

## 5. Open questions (recommendation first; unanswered = the recommendation, already built)

1. Number matching on the phone: (a) the person types the two digits of the requesting screen [recommended, built]; (b) picks one of
   three numbers shown (one blind tap in three succeeds).
2. Push approval for the once-actions (another user's factor reset, bridge-key reveal, role change to system administrator, restore)
   and for adding / removing one's own factors: (a) never - only the device that asks may prove those [recommended, built];
   (b) allow it like the phone key in the app.
3. Passkeys inside the Android app's WebView (`setWebAuthenticationSupport(FOR_APP)`, the assetlinks route already served): (a) a
   separate Android row with a real-device check (the phone key already covers the app) [recommended]; (b) not needed.
4. Turning the two features on in the lab: (a) the owner switches `security.push_approval` / `security.step_up_alarm_pin` himself once
   step-up is on, then one real-phone check [recommended]; (b) leave off.
