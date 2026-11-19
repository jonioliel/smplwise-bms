# T095 - Full second factor for Arx: one policy, step-up for sensitive actions, passkeys for everyone

Row `FEATURE-DESIGNS-SEC-2490`, branch `pilot/FEATURE-DESIGNS-SEC-2490` (from `origin/main` @ `51da93753`). Target: 2.49.0
design round. **Design only - no product code, no migration, no setting is added by this document.** The owner decides whether
and when anything here is built. The mock-up is `docs/design/full-2fa-t095/mockup.html`.

Inputs read: `AGENTS.md`, `CLAUDE.md`, `docs/security/HA_IDENTITY_RBAC_HE.md`, `docs/changes/CR-011-SECOND-FACTOR.md`,
`docs/changes/CR-USR2-ARX-ONLY-IDENTITY.md`, `docs/security/FABLE_REVIEW_REPORT_2026-10-21.md`, `management/tasks.json` (T092,
T095), `private/planning/WORK_PLAN_2448_2449_2026-11-19.md`, the owner's recorded answers (06.10 form round 10 q20-q30;
18.10 service identity; 07.11 round 24 item 4.1) and the code on `origin/main`.

Owner constraints carried into every section:

- **"MFA later"** (07.11, round 24, 4.1 ג: "not now, talk later"). This design changes nothing by itself. Every default below
  keeps today's behaviour; no user is forced into anything until the owner switches a setting on.
- **Nearly everything is also a setting** (round 32). Each behaviour has a key, a default equal to today, and a place in the UI.
- **No HA branding** outside הגדרות › מערכת (`docs/design/UI_COPY_RULES.md`): user-facing copy says "חשבון המערכת", never
  Home Assistant. Settings screens may name the platform exactly.
- **HA is the human identity source** (v1.1 identity amendment). Arx never changes HA users, groups, admin flags or HA MFA modules.
- **No external provider** of any kind: every proof is verified by the add-on itself, offline. No SMS gateway, no cloud push
  approval service, no AI.
- Service identity (owner 18.10): **no second factor** for the extended service-identity actions and for the remote kill switch.

---

## 1. Problem

Arx is reachable from the internet (`/arx`, CR-008). A remote session today proves "someone knew a password" - and, depending on
the path, not even that: a long-lived HA token is accepted on the remote channel and skips HA's own MFA (CR-011 §2.2, still open).
Once signed in, every action - disarm, door unlock, role change, settings - is one tap, with no check that the person holding the
session is still the person who signed in. The pieces that exist (Arx TOTP, local-user passkeys, two ad-hoc step-up checks) were
built one at a time and do not form one policy an owner can reason about.

Goal of T095 "full 2FA": **one second-factor policy** for every remote sign-in path, **step-up** (a fresh proof) before the actions
that can open a door or disarm a building, **passkeys for every user** (not only Arx-only users), **recovery** that does not
depend on an administrator being on site, and a phone **device key** for the Android app - all off by default.

## 2. Current state in the code (origin/main @ 51da93753)

CR-011's status line ("proposed, no product code") is out of date: a good part of the machinery already shipped.

### 2.1 Identities and sessions

| Piece | Where | State |
|---|---|---|
| HA users on the remote channel | `services/ha_user_auth.py` (`SessionStore`, `exchange()`, `_bearer_session`, `policy_refusal`), `routers/remote.py`, `remote_channel.py` | HA access token exchanged for an in-memory `RemoteSession`, revalidated every 60 s via `auth/current_user` (which also reports MFA modules). **Any JWT HA validates is accepted - including long-lived tokens (the MFA bypass).** |
| Arx-only (local) users, USR2 | `services/local_identity.py`, `local_passwords.py`, `routers/local_identity.py`; migrations 0096, 0097, 0147 | Behind `security.local_identity` (off). scrypt PHC passwords, tiered brute-force limits, `auth_local_sessions` with `factor_at`, admin permissions refused without `factor_ok`. |
| App WebView sessions | `services/app_session.py`, migration 0174, `security.app_session_exchange` | `a.` cookies; `_mfa_refused` mirrors `remote.require_mfa_admin`. |
| App refresh device key (not biometric) | `services/app_refresh_key.py`, migration 0157, `docs/changes/APPREFRESH-DEVICEKEY-SPEC.md` | ES256 proof-of-possession for the app's refresh token. The server-side verification and nonce store are reusable; the key itself is **not** user-verification bound. |
| Wall users | `services/wall.py` (`KIOSK_ROLE`), `ha_user_auth.policy_refusal` | Wall users are refused remotely unless allowed. |

### 2.2 Second factor (Arx TOTP, K11, shipped 2.2.0)

- `services/second_factor.py`, `routers/second_factor.py`; migrations 0065 (`auth_totp`), 0069 (`auth_totp_failures`,
  `auth_totp_policy` with `subject_kind` user|role and `policy` optional|required).
- RFC 6238 (SHA-1, 6 digits, 30 s, ±1 step), secret AES-256-GCM via `alarm_codes.encrypt` (`<data>/keys/alarm-codes.key`,
  AAD `totp:<user_id>`, out of backups), replay refused (`last_step`), 5 wrong codes / 5 min → 10 min lock (persisted).
- Settings: `security.second_factor_policy` = `optional` (default) | `admins`; `security.second_factor_bearer` = `enforce` | `off`.
  `effective_policy()`: user override → any role `required` → any role `optional` → global.
- Applies to **new remote sign-ins only**; code travels in `X-Arx-Second-Factor`. Ingress (local) is the break-glass path.
- Admin reset (`DELETE auth/second-factor/users/{id}`, `system.configure`, from any channel), with the admin's own code if the
  admin has one (`require_step_up`), revokes the target's sessions, inbox notice `second_factor_reset`.
- **No recovery codes.**

### 2.3 Passkeys (USR2 phase 4, shipped)

- Own verifier `services/webauthn.py` on `cryptography` (ES256 + RS256, attestation `none`; `py_webauthn` rejected - musl wheels).
- `services/local_passkeys.py`, `routers/local_passkeys.py`; migrations 0098 (`auth_webauthn_credentials`), 0130 (`passkey_only`).
- rpId = host of `security.local_public_url` (https + DNS name only, never from request headers); challenge pools per purpose
  (32 bytes, 60 s, single use, in memory); counter regression → refused + `security.local_passkey_clone` notice;
  `/.well-known/assetlinks.json` from `security.local_passkey_android`.
- **Local users only**: `_self` answers 403 `not_local_identity` for an HA user.
- A passkey counts as the local user's second factor (`has_factor` = TOTP or usable passkey). `recent_auth()` (5 min) gates
  passkey management and password change (`reauth_required`).

### 2.4 Step-up today (ad hoc)

| Check | Where | Proof |
|---|---|---|
| `require_step_up()` | `routers/second_factor.py` | admin's own TOTP code; only if the admin has TOTP; `second_factor_step_up_required` |
| bridge key reveal | `routers/bridge_key.py` (`_with_step_up`) | mandatory TOTP; `step_up_unavailable` without a factor |
| `recent_auth()` | `services/local_passkeys.py` | a factor-backed sign-in < 5 min old (local users) |
| typed confirm words | `services/confirm_words.py` | not a factor - an intent check (purge, schedule disarm) |
| alarm PIN | `services/alarm_codes.py`, migration 0036 | per-user scrypt PIN + `Lockout`; **not** used as step-up; `alarm.remote_codeless` = `true` |

Not in the code: a generic `step_up_required`, `auth/step-up/*`, `security.step_up_minutes`, `remote.mfa_policy`, any HA
refresh-token provenance check at sign-in (only `delete_refresh_token_at_ha()` reads `auth/refresh_tokens`, at sign-out), any
Keystore key in `mobile/` (`AppLock.kt` is a local `BIOMETRIC_WEAK | DEVICE_CREDENTIAL` lock without a `CryptoObject`).

### 2.5 Front end

`src/shell/sw-user-menu.ts` (lazy `<sw-second-factor>`, `<sw-passkeys>`), `src/components/sw-second-factor.ts`
(`sw-second-factor`, `-user`, `-policy`), `src/components/sw-passkeys.ts`, `src/api/second-factor.ts`, `src/api/passkeys.ts`,
`src/screens/system-access.ts` (user drawer, role cards), `src/screens/system-local-users.ts`, `src/arx/arx-login.ts`
(`lfactor` step), `src/arx/auth.ts` (`completeSecondFactor`), `src/arx/webauthn.ts`.

### 2.6 Owner answers already on record (CR-011 §9 ↔ form round 10, 06.10)

| CR-011 | Form | Answer | Status |
|---|---|---|---|
| Q1 who at sign-in | q20 | develop it, **do not force**; he picks who later (optional + per-user/role policy) | binding; shipped as `optional` + overrides |
| Q4 freshness | q22 | not understood | **open** (re-asked below, plain words) |
| Q5 app proof | q23 ב | biometric **or the phone's screen code** | binding → `biometric_or_screen_lock` default |
| Q6 browser disarm fallback | q24 א | personal alarm code | binding |
| Q7 passkeys | q25 א | browsers + PWA, then the app | binding |
| Q8 own TOTP | q26 א | "don't build" (he asked what it is) | **contradiction**: TOTP shipped in 2.2.0 citing "owner decisions 2026-10-06". Recorded, not resolved - re-asked below. |
| - remember browser | q27 ב | remember-this-browser only for non-sensitive actions + a cookie/storage notice | binding |
| Q9 reset | q28 ב | from anywhere (with own step-up) - weaker than recommended, risk flagged | binding → `factor_reset_channel = any` |
| - wall tablets | q29 א | exempt | binding |
| Q11 push approval | q30 | not understood | **open** - out of scope here |
| Q2, Q3, Q10 | - | never asked in the form | **open** |
| round 24 4.1 | - | "MFA not now, talk later" | binding: design only, defaults = today |

## 3. User stories per role

**Resident / tenant (remote, phone)** - "I disarm from the app at the gate; one fingerprint, not a password." / "If my phone is
stolen unlocked, the thief cannot open my door." / "If I lose my phone I can still get in with a recovery code."

**Operator / guard (desktop, often local)** - "On the local network nothing changes for me unless the owner says so." / "When I
unlock a door remotely, Windows Hello or a code from my phone is enough."

**Site administrator** - "I set who must use a second factor: admins, holders of sensitive permissions, or everyone; with
exceptions for a person or a role and for wall tablets." / "I see who has which factor and who is not compliant." / "I reset a
user's factors and the user is told."

**System administrator / owner** - "A stolen cookie must not let anyone change roles or settings." / "A long-lived token must not
skip the second factor." / "I can always get back in from the local network." / "Nothing changes until I flip it."

**Installer** - "I set the public address once; passkeys then just work for HA and Arx-only users alike."

**Service identity (automation)** - not a person; never asked for a second factor (owner 18.10).

## 4. Design overview

Three layers, each a separate switch:

1. **Sign-in policy** (who must show a second factor when signing in remotely). One policy for every remote path: HA login flow,
   bearer/long-lived token, Arx-only password, app WebView exchange.
2. **Step-up** (a fresh proof right before a sensitive action). Server challenge → proof → a short-lived mark on the session.
3. **Factors and recovery** (what counts as a proof): HA MFA (sign-in only, inferred), Arx TOTP, passkey (now for HA users too),
   Android device key, personal alarm code (alarm actions only, fallback), recovery codes (sign-in and factor recovery only).

```
            remote sign-in                                      sensitive action
  ┌─────────────────────────────────┐            ┌──────────────────────────────────────────┐
  │ password (HA flow / Arx-only)   │            │ POST /alarm/.../disarm                   │
  │   │                             │            │   │ gate: step_up.require(action)        │
  │   ▼ policy says factor needed?  │            │   ▼ mark on session younger than N min?  │
  │ HA MFA provenance ✓  ─► session │            │   yes ─► run action                      │
  │ else Arx factor (TOTP/passkey/  │            │   no  ─► 403 step_up_required {methods}  │
  │   device key/recovery) ─► session│           │        UI: step-up sheet → challenge →   │
  │ long-lived token ─► refused     │            │        proof → mark → retry ONCE         │
  │   (if user under policy)        │            │                                          │
  └─────────────────────────────────┘            └──────────────────────────────────────────┘
```

### 4.1 Sign-in policy

One setting replaces two: `security.factor_policy` = `optional` (default, = today) | `admins` (= today's `admins`) | `sensitive`
(any permission in the sensitive set: admin permissions, `alarm.disarm`, door unlock, `rbac.assign`...) | `all`.
`remote.require_mfa_admin` and `security.second_factor_policy` are migrated into it (read-compatible for one version; see §9).

Overrides (existing `auth_totp_policy`, extended): per user and per role, `required` | `optional` | **`exempt`** (new; the owner's
wall-tablet answer). Wall users (`services/wall.py`) are exempt by default (`security.factor_wall_exempt` = on). Precedence
unchanged: user override → role `required` → role `exempt`/`optional` → global.

What satisfies the sign-in factor, in order of preference:

1. **HA MFA with provenance** (CR-011 option A, inferred - HA tokens carry no MFA claim): `auth/current_user` lists an enabled MFA
   module AND `auth/refresh_tokens` shows the session's token is `type = normal`, `client_id` = this Arx public origin,
   `auth_provider_type = homeassistant`, `created_at` later than the first moment Arx saw MFA enabled for that user (new table
   `auth_mfa_seen`). HA's own login flow then guarantees the code was asked. Read-only websocket calls; no HA write.
2. **Arx factor** after the password (existing `X-Arx-Second-Factor` / 202 pending flow): TOTP, passkey, Android device key, or a
   recovery code.

**Long-lived tokens on the remote channel** (`security.remote_long_lived_tokens`): `allow` (default = today) | `refuse_under_policy`
(recommended once the policy is on: a user the policy covers cannot use one remotely; refusal audited
`auth.remote_session.refused` reason `long_lived_token`) | `refuse`. Ingress is never affected.

A user under the policy without any factor gets the existing enrolment path (`enroll_required`): they sign in, can only reach the
enrolment page, and must enrol before anything else (`ENROL_PATHS`, already built for local users; extended to HA users).

### 4.2 Step-up

`security.step_up` = `off` (default) | `on`. When on:

- **Registry** `services/step_up.py: ACTIONS` - a closed, code-level list of sensitive action ids with a Hebrew label each.
  The setting `security.step_up_scope` picks the group (owner Q3, open): `alarm` (disarm, bypass) | `alarm_doors` (+ door/lock
  unlock, alarm codes/PINs, remote alarm settings) | `all_sensitive` (+ roles and remote flag, user management, `system.configure`
  settings, revoking others' sessions, factor reset, NVR writes, bridge-key reveal, restore, update). Recommended
  `all_sensitive`. Never in the list: arming, lights, everyday device control, service-identity actions, the remote kill switch
  (owner 18.10).
- **Gate** `step_up.require(conn, request, principal, action, resource)` in each listed route, **after** authorization and
  **before** the body is acted on (the guard-before-body rule, PUB-07). Answer when missing:
  `403 step_up_required` with `details = {action, action_label, methods[], challenge_url}` in the project's `ApiError` envelope
  (aligned with ADR L2 when it lands).
- **Challenge** `POST /auth/step-up/challenge {action, resource?}` → 32-byte nonce, 60 s, single use, bound to user + session id
  + action + resource, in a memory pool (like the passkey pools; lost on restart = the user is asked again).
- **Verify** `POST /auth/step-up/verify {challenge_id, method, proof}` → a mark on the session: `step_up_at`, `step_up_method`,
  `step_up_scope` (`action` or `window`). Stored on `auth_local_sessions` / app sessions (new columns) and in the in-memory
  `RemoteSession` for HA sessions. Never on the HA token, never in a client cookie.
- **Freshness** `security.step_up_minutes` 0-30, default 5 (owner Q4, open; 0 = every action). A mark is valid for the window
  for every action in the scope, except `security.step_up_once_actions` (default: factor reset, role change to system admin,
  restore) which always need a fresh, action-bound proof.
- **Channel** `security.step_up_local` = off (default; the local network keeps today's behaviour) | on.
- **Retry**: the front end's API client catches `step_up_required`, opens the step-up sheet, then retries the original request
  **once** with the same client request id. Physical actions are never queued or retried blindly (AGENTS.md): if the retry fails,
  the user sees the failure and taps again.
- **Remember this browser** (owner q27 ב, `security.remember_browser_days` 0-30, default 0 = off): skips the **sign-in** factor on
  that browser for N days; **never** skips step-up. Needs the storage notice (the legal cookie text) shown once.

Proof methods (each also a setting under `security.step_up_methods`, all enabled by default when step-up is on):

| Method | Proof | Where | Notes |
|---|---|---|---|
| `passkey` | WebAuthn assertion, `userVerification: required`, challenge = the nonce | browsers, PWA, Android WebView (FOR_APP + asset links) | phishing-resistant; preferred |
| `device_key` | ES256 signature of `arx-step-up|v1|<origin>|<user>|<action>|<nonce>` by a Keystore key behind `BiometricPrompt` + `CryptoObject` | Android app | `security.device_key_auth` = `biometric_or_screen_lock` (owner q23 ב) \| `biometric` |
| `totp` | 6-digit code | everywhere | replay + lockout as today |
| `alarm_pin` | personal alarm code (CR-010) | alarm actions only | owner q24 א; the fallback for a browser without a passkey |
| `recovery_code` | - | **not** a step-up method | recovery codes only restore sign-in / re-enrol |

### 4.3 Passkeys for every user

Lift the `not_local_identity` gate behind `security.passkeys_all_users` (off by default). An HA user can then register passkeys
for **step-up and the sign-in factor** - not as a password replacement (HA must still issue tokens for the embedded panels;
passwordless stays an Arx-only-user feature). Same rpId rule (public URL host), same verifier, same counter-regression handling.
Passkeys made on the remote hostname do not work on the Ingress hostname (different rpId) - acceptable, since step-up is remote by
default; on the local channel the TOTP or alarm PIN method remains.

### 4.4 Android device key

The app creates an EC P-256 key in the Keystore (`setUserAuthenticationRequired(true)`, `setUserAuthenticationParameters(0,
BIOMETRIC_STRONG | DEVICE_CREDENTIAL)` on API 30+ per owner q23 ב, or `BIOMETRIC_STRONG` only when the setting says so;
`setInvalidatedByBiometricEnrollment(true)`; StrongBox when present). Registration needs a fresh sign-in or an existing factor
(otherwise a stolen cookie enrols the attacker's phone), is announced to the user's other devices and audited. The page asks the
app through the existing `window.ArxApp` bridge; the prompt shows the action text. Attestation: not now (Q10, recommended).

### 4.5 Recovery codes

`security.recovery_codes` = off (default) | on. When on, enrolling the first factor shows **10 single-use codes** (format
`XXXX-XXXX`, Crockford base32, 40 bits each), shown once, downloadable as a text file and printable; stored as scrypt hashes;
"regenerate" needs a step-up and voids the previous batch. A recovery code completes a sign-in factor step **and** forces
re-enrolment of a new factor before anything else; it never satisfies step-up. Using one notifies the user and managers.

### 4.6 Factor reset by an administrator

Owner q28 ב: from anywhere, with the administrator's own step-up (`security.factor_reset_channel` = `any`, default per the owner's
answer; `local` remains selectable). Always: `step_up_once` action, audited, the target notified in-app and on their other devices,
all the target's remote sessions and device keys revoked, never on oneself, never on the last administrator without a second
administrator present (the existing `recovery_path_exists` rule). The owner can always enter through Ingress (break glass).

## 5. Flows

**F1 - remote sign-in, HA user, policy `sensitive`, has HA MFA.** HA login flow (password + HA code) → token exchange → Arx checks
provenance (normal token, our client id, after MFA seen) → session. No extra Arx step.

**F2 - remote sign-in, HA user under policy, no HA MFA, has a passkey.** HA login flow → exchange answers 202 `{second_factor:
"required", methods: ["passkey","totp","recovery_code"]}` → passkey assertion → session with `factor_at`.

**F3 - long-lived token, user under policy, `refuse_under_policy`.** Exchange → 403 `long_lived_token_refused` "החיבור הזה לא
מאפשר אימות דו-שלבי. התחברו עם שם המשתמש והסיסמה." → audit.

**F4 - remote disarm from the Android app.** Tap "נטרל" → 403 `step_up_required` → app bridge: challenge → BiometricPrompt "לנטרל
את האזעקה בבניין A?" → signature → verify → mark → retry once → disarmed.

**F5 - remote door unlock from a desktop browser with Windows Hello.** Tap → sheet "אימות לפני פתיחת דלת" with the method list
(passkey first) → Windows Hello → retry once.

**F6 - disarm from a browser without a passkey.** Sheet offers "קוד אזעקה אישי" (alarm actions only) and "קוד מאפליקציית אימות" if
enrolled.

**F7 - enrolment under policy.** Sign-in → `enroll_required` → "אבטחת החשבון" page with only enrolment reachable → passkey (or TOTP)
→ recovery codes shown (if on) → "שמרתי את הקודים" → normal session.

**F8 - lost phone.** The user signs in with password + recovery code → forced re-enrolment → the old device key revoked in "המכשירים
שלי". Or an administrator resets (F9).

**F9 - administrator reset.** User drawer › אבטחת חשבון › "איפוס גורמי אימות" → step-up of the admin (once-action) → typed confirm of the
user's name → reset, sessions revoked, notice.

**F10 - owner switches the policy on.** Settings › משתמשים והרשאות › אימות דו-שלבי → the compliance preview shows "12 users will have
to enrol at their next remote sign-in, 3 are exempt" → save (step-up of the owner) → audit.

## 6. Data model and migrations

All additive. Numbers are provisional (main ends at 0216; the train renumbers).

| Migration | Content | Rollback |
|---|---|---|
| `02xx_factor_policy` | `auth_factor_policy(subject_kind TEXT CHECK IN ('user','role'), subject_id TEXT, sign_in TEXT CHECK IN ('required','optional','exempt'), updated_at, updated_by, PRIMARY KEY(subject_kind, subject_id))`; rows copied from `auth_totp_policy`. The old table stays read-only for one version. | previous version reads `auth_totp_policy` (unchanged) |
| `02xx_mfa_seen` | `auth_mfa_seen(user_id PRIMARY KEY, first_seen_at, last_seen_at, modules_json)` - when Arx first saw HA MFA enabled per user | ignored by the previous version |
| `02xx_step_up_marks` | `auth_local_sessions` + `app_refresh_families` (or the app session table of 0174): `step_up_at TEXT NULL`, `step_up_method TEXT NULL`, `step_up_action TEXT NULL` | columns ignored |
| `02xx_recovery_codes` | `auth_recovery_codes(id, user_id, batch_id, code_hash, created_at, used_at NULL, used_ip_hash NULL)`; index on (user_id, used_at) | ignored; codes simply stop working |
| `02xx_device_keys` | `auth_device_keys(id 'dk_'+ULID, user_id, label, spki BLOB, fp TEXT UNIQUE, alg 'ES256', auth_kind TEXT CHECK IN ('biometric','biometric_or_screen_lock'), created_at, last_used_at, sign_count, revoked_at, revoked_by, revoked_reason, attestation_json NULL)` | ignored; app falls back to the other methods |
| `02xx_passkeys_all_users` | none needed if `auth_webauthn_credentials.user_id` already references `users(id)` (HA ids live there); otherwise a nullable `user_kind` column. **Verify in the build row.** | - |

Secrets: device keys and passkeys store public keys only; recovery codes as scrypt; TOTP unchanged. Nothing new enters the backup
except policy rows (backup must not carry factor material: device keys, recovery codes and passkeys stay out like `auth_totp`).

Settings (all in `services/settings_store.DEFAULTS`, validated in `routers/settings.py`; security keys changeable from the local
channel only unless noted - `routers/settings_patch/identity.py`):

| Key | Values | Default (= today) | Recommended when "MFA" is turned on |
|---|---|---|---|
| `security.factor_policy` | `optional`\|`admins`\|`sensitive`\|`all` | from `security.second_factor_policy` / `remote.require_mfa_admin` | `sensitive` |
| `security.factor_methods` | csv `ha_mfa,totp,passkey,device_key` | all | all |
| `security.factor_wall_exempt` | on\|off | on | on |
| `security.remote_long_lived_tokens` | `allow`\|`refuse_under_policy`\|`refuse` | `allow` | `refuse_under_policy` |
| `security.step_up` | off\|on | off | on |
| `security.step_up_scope` | `alarm`\|`alarm_doors`\|`all_sensitive` | `all_sensitive` (inert while off) | `all_sensitive` |
| `security.step_up_minutes` | 0-30 | 5 | 5 |
| `security.step_up_local` | off\|on | off | off |
| `security.step_up_methods` | csv `passkey,device_key,totp,alarm_pin` | all | all |
| `security.device_key_auth` | `biometric`\|`biometric_or_screen_lock` | `biometric_or_screen_lock` (owner q23 ב) | same |
| `security.passkeys_all_users` | off\|on | off | on |
| `security.recovery_codes` | off\|on | off | on |
| `security.factor_reset_channel` | `local`\|`any` | `any` (owner q28 ב) | `any` (owner) |
| `security.remember_browser_days` | 0-30 | 0 | 0-14 |
| `alarm.remote_codeless` | existing | `true` | meaning becomes "no alarm code **after** a step-up" |

## 7. API sketch

Every JSON route declares a response model in a wire module (`smplwise/wire/<router>.py`, `WireModel`, `**wire(Model)`, `NO_JSON`
for the rest), the generated types land in `frontend/src/api/generated/wire-<router>.ts` via `scripts/gen_wire_types.py`, and the
route-table test asserts the family. Errors use `ApiError(status, code, message_he, details)`.

| Route | Who | Body | Answer (wire model) |
|---|---|---|---|
| `GET /auth/factors` | self | - | `MyFactors {policy: {sign_in, source}, ha_mfa: {enabled, seen_at}, totp: {enrolled}, passkeys: [PasskeyRow], device_keys: [DeviceKeyRow], recovery: {enabled, remaining, created_at}, step_up: {on, minutes, methods, mark_valid_until?}}` |
| `POST /auth/step-up/challenge` | self | `{action, resource?}` | `StepUpChallenge {challenge_id, action, action_label, expires_in, methods: [..], webauthn?: PublicKeyRequestOptions, device_key?: {payload}}` |
| `POST /auth/step-up/verify` | self | `{challenge_id, method, code? \| assertion? \| signature? \| pin?}` | `StepUpMark {method, valid_until, scope: 'action'\|'window'}`; 401 `step_up_failed`, 429 `step_up_locked` |
| any gated route | - | - | 403 `step_up_required` `{details: {action, action_label, methods, challenge_url}}` |
| `GET /auth/recovery-codes` | self | - | `RecoveryStatus {enabled, remaining, created_at}` |
| `POST /auth/recovery-codes` | self + step-up once | - | `RecoveryBatch {codes: [str] (shown once), created_at}` |
| `POST /auth/device-keys/register/options` | self + recent factor | `{label}` | `DeviceKeyOptions {nonce, expires_in, auth_kind}` |
| `POST /auth/device-keys` | self | `{nonce, spki, signature, label, attestation?}` | `DeviceKeyRow` |
| `GET /auth/device-keys`, `DELETE /auth/device-keys/{id}` | self | - | `[DeviceKeyRow]`, `{revoked: true}` |
| `GET /security/factor-policy` | `rbac.assign` read | - | `FactorPolicy {global, overrides: [Override], compliance: {users_total, covered, enrolled, missing: [..], exempt}}` |
| `PUT /security/factor-policy/overrides/{kind}/{id}` | `system.configure` + step-up | `{sign_in}` | `Override` (replaces `PUT auth/second-factor/overrides/{kind}/{id}`; the old path answers for one version) |
| `GET /identity/users/{id}/factors` | `identity.directory.read` | - | `UserFactors` (no secrets; counts and labels) |
| `DELETE /identity/users/{id}/factors` | `system.configure` + step-up once + channel rule | `{confirm_name}` | `{reset: true, revoked_sessions: n}` |
| sign-in step | existing `POST auth/local/sign-in/second-factor`, `X-Arx-Second-Factor` | add `method: "recovery_code"` | existing models + `methods` list gains `recovery_code`, `device_key` |

Front end: `src/api/step-up.ts` (thin, typed from generated wire), an interceptor in `src/api/client.ts` for `step_up_required`
(opens `<sw-step-up-sheet>`, retries once), `src/components/sw-step-up-sheet.ts`, `src/screens/account-security.ts`,
`src/screens/system-factor-policy.ts` (new tab under משתמשים והרשאות), changes to `sw-user-menu.ts`, `system-access.ts`
(drawer section), `arx-login.ts` (methods chooser + recovery code).

## 8. Security analysis

### 8.1 Threats (CR-011 §3 numbering, plus new)

| # | Threat | Mitigation in this design | Residual |
|---|---|---|---|
| T1 | stolen unlocked phone | device key behind biometric/screen lock; step-up per action window; a new fingerprint voids the key | with `biometric_or_screen_lock` (owner's choice) a shoulder-surfed phone PIN unlocks the key - flagged; `biometric` remains selectable |
| T2 | stolen cookie/token | step-up proofs need the factor, not the cookie; marks are server-side; device-key/passkey enrolment needs a fresh factor | read-only views stay open to a stolen session until it expires |
| T3 | phishing (real-time relay) | passkeys and the device key bind the origin; TOTP/alarm PIN remain relayable | TOTP users stay phishable - UI nudges to passkeys |
| T4 | hostile network | TLS (Cloudflare) as today | - |
| T5 | insider admin abusing reset | admin's own step-up (once), typed confirm, target notified on all devices, audit, never self | owner chose reset from anywhere: a stolen admin session **plus** the admin's factor is enough - documented |
| T6 | long-lived token bypass | `refuse_under_policy` | default `allow` until the owner switches (MFA later) |
| T7 | recovery code theft | 10 codes, scrypt, single use, use notifies, forces re-enrolment, never step-up | printed codes are as safe as the paper |
| T8 | challenge replay / cross-action | nonce bound to user+session+action+resource, 60 s, single use; signed string contains origin and action | - |
| T9 | downgrade to the weakest method | `step_up_methods` setting; alarm PIN only for alarm actions; recovery never step-up | owner may allow weak methods |
| T10 | push fatigue | push approval out of scope | - |
| T11 | lockout of the owner | Ingress break-glass unaffected (`step_up_local` off); reset requires a remaining admin path | - |

### 8.2 Rate limits and lockout

Reuse `hua.LIMITER` (scope `signin`) with new keys `stepup:user:<id>` (10 / 5 min, 30 / h) and `stepup:ip:<net>` (30 / 5 min);
method lockouts stay per method (TOTP 5 / 5 min → 10 min, alarm PIN `alarm_codes.LOCKOUT`, passkey failures counted). A lockout
of step-up never ends the session; it only refuses sensitive actions and notifies the user (`security.step_up_locked`). Challenge
pool caps like the passkey pools (per user 5 live challenges, global 5000, oldest evicted).

### 8.3 Audit and notifications

Audit actions (no secret, no code, no nonce in details): `auth.factor_policy.changed`, `auth.remote_session.refused`
(`long_lived_token`, `factor_required`), `auth.step_up.challenge`, `auth.step_up.ok` / `.failed` / `.locked` (with method and
action), `auth.recovery.generated` / `.used`, `auth.device_key.registered` / `.revoked` / `.counter_regression`,
`auth.factors.reset`. Notification sources: `security.step_up_locked`, `security.recovery_used`, `security.device_key_added`,
`security.factors_reset` (user + managers; policy-editable like every source).

### 8.4 Privacy

No biometric data ever leaves the phone; the server sees a signature. Device labels are user-chosen. IP addresses in recovery
use are stored hashed. The remember-browser cookie needs the storage notice (owner q27 ב).

## 9. Failure modes

| Failure | Behaviour |
|---|---|
| HA websocket down during provenance check | sign-in refused for users under the policy (fail closed) with "תשתית המערכת לא זמינה כרגע"; users not under the policy unaffected |
| HA `auth/refresh_tokens` shape changes | provenance check returns "unknown" → treat as no HA MFA → Arx factor asked (never silently pass); a health check flags it |
| user enabled HA MFA after an old sign-in | `created_at` < first seen → that old token does not count; next sign-in does |
| add-on restart | in-memory challenges and HA-session marks lost → user asked again; persisted marks (local/app sessions) survive |
| public URL changes (rpId) | passkeys of the old rpId listed as "לא פעיל בכתובת הנוכחית", not counted; user re-registers; admins warned on the change |
| WebView too old for WebAuthn | runtime check → device key or TOTP offered |
| user loses every factor, recovery off | administrator reset (any channel per owner) or Ingress |
| step-up sheet dismissed | original request not retried; nothing sent to a device |
| retry after a successful proof fails (network) | not retried again; the user sees "הפעולה לא בוצעה" and may tap again (no blind physical retry) |
| policy turned on while users have no factor | they are not locked out: next remote sign-in goes to enrolment; local unaffected |
| migration renumber collision | renumbered at the train (standard) |

## 10. Test plan

Backend (pytest, fixtures, no real HA): policy matrix (4 policies × overrides × wall users × channels); provenance with a fake
`auth/refresh_tokens` (normal/long-lived/other client/older than MFA seen/shape drift); LLAT refusal per setting; step-up gate on
every registry route (a route-table test: every route that calls a listed action has the gate - a ratchet); challenge binding
(other user, other session, other action, expired, reused); each method's verify (passkey via `tests/webauthn_fake.py`, device
key with a generated P-256 key, TOTP, alarm PIN only on alarm actions, recovery never); marks and freshness incl. `0` and
once-actions; lockouts and rate limits; recovery generate/use/regenerate/void; reset rules (self, last admin, channel setting);
audit rows carry no secret (grep test); wire models (`--check`, route-table family test).

Front end (Playwright, mocked backend): step-up sheet per method, desktop + phone, light + dark, RTL; interceptor retries once and
never twice; sign-in methods chooser incl. recovery code; enrolment-only mode; account security page states (no factor / some /
all / recovery low); admin policy page with compliance preview; pixel baselines refreshed on the runner (UI rows); axe-core on
every new screen (A11Y-AUDIT-2490).

Android (instrumented on a real phone, owner present): key creation, prompt text, invalidation after a new fingerprint, screen-lock
variant on API 30+. Lab (owner approval per step, read-only on HA): provenance against the real HA version; nothing disarmed or
unlocked for real - step-up is proven on a no-op test action (`step_up.test`) built for this purpose.

## 11. Rollout

0. Owner decision (this document's questions). Nothing built before that ("MFA later").
1. Ship code with every switch off = today's behaviour byte for byte (characterisation tests on sign-in and the gated routes).
2. Owner enrols himself (passkey + recovery codes) from the account page.
3. Owner turns on step-up with scope `alarm` for a week, then `all_sensitive`.
4. Owner turns on the sign-in policy `admins`, watches the compliance preview, then `sensitive`; LLAT `refuse_under_policy`.
5. Android device key with the next app release.
Each step is a setting flip, reversible from Ingress.

## 12. Effort (rows that fit one agent each)

| Row | Content | Estimate | Depends on |
|---|---|---|---|
| 2FA-POLICY | `security.factor_policy` + `auth_factor_policy` (+ exempt, wall users) + migration of the two old keys + compliance view; backend + tests | 1.5 d | - |
| 2FA-PROVENANCE | `auth_mfa_seen`, HA refresh-token provenance, LLAT setting on exchange + bearer + app paths; fake HA fixtures | 1.5 d | POLICY |
| 2FA-STEPUP-CORE | `services/step_up.py` registry, challenge/verify, marks (migration), rate limits, audit, wire module | 2 d | - |
| 2FA-STEPUP-GATES | gates on all registry routes + route-table ratchet test; replace the two ad-hoc checks | 1.5 d | STEPUP-CORE |
| 2FA-STEPUP-UI | `sw-step-up-sheet`, client interceptor (retry once), methods UI, desktop + phone, baselines | 2 d | STEPUP-CORE |
| 2FA-PASSKEYS-ALL | lift the local-only gate behind the setting; passkey as step-up and sign-in factor for HA users; rpId change handling | 1.5 d | STEPUP-CORE |
| 2FA-RECOVERY | recovery codes backend + sign-in use + forced re-enrolment + UI (show once, print, download) | 1.5 d | POLICY |
| 2FA-SCREENS | account security page, admin policy tab, user-drawer factors section, sign-in chooser | 2 d | POLICY, RECOVERY |
| 2FA-ALARM-WALL | alarm PIN as step-up for alarm actions, `alarm.remote_codeless` meaning, remember-browser + storage notice | 1 d | STEPUP-CORE |
| 2FA-DEVICEKEY-SRV | `auth_device_keys`, register/verify/revoke routes, notices | 1 d | STEPUP-CORE |
| 2FA-DEVICEKEY-APP | Android Keystore key, BiometricPrompt + CryptoObject, `ArxApp` bridge calls, WebView WebAuthn FOR_APP check | 2.5 d | DEVICEKEY-SRV |
| 2FA-REVIEW-DOCS | deep security review of the gates/enrolment/recovery, DOCS.md + DOCS_HE.md, bilingual notes | 1 d | all |
| **Total** | | **≈ 19 agent-days** (≈ 12 calendar days with 3 agents in parallel) | |

Push approval (CR-011 D) stays out: it needs CR-012 and the owner did not understand the question (q30).

## 13. Open questions (with recommendations)

1. **When** to build (round 24: "MFA later"): (a) schedule after 2.49.0 as one train [recommended - the design is ready and the
   long-lived-token gap is open]; (b) only the step-up part now; (c) keep waiting.
2. **Q3 - which actions need a fresh proof:** (a) disarm + bypass; (b) + doors and alarm codes; (c) + every setting, user and role
   change [recommended].
3. **Q4 - how long a proof lasts (plain words: "after you approve once, for how many minutes the system will not ask again"):**
   (a) every action; (b) 5 minutes [recommended]; (c) 15 minutes.
4. **Q8 contradiction - Arx's own authenticator-app codes (TOTP):** the 06.10 answer said "don't build", yet it shipped in 2.2.0.
   (a) keep it as one method next to passkeys [recommended - it is the only option on a browser without passkeys]; (b) hide it for
   new enrolments; (c) remove it.
5. **Long-lived tokens from outside** when the policy is on: (a) refused for users under the policy [recommended]; (b) refused for
   everyone; (c) allowed.
6. **Recovery codes:** (a) on, 10 per user [recommended]; (b) off (administrator reset only).
7. **Passkeys for all users** (today only Arx-only users): (a) yes [recommended]; (b) no.
8. **Q2 - in the app, may password + the phone's device key count as the sign-in second factor:** (a) yes [recommended]; (b) no.
9. **Q10 - hardware attestation of the phone key:** (a) not now [recommended]; (b) yes.
10. **Factor reset from anywhere** (q28 ב, already answered): confirm keeping it after reading the risk (T5): (a) keep "from
    anywhere with own approval" (owner's answer); (b) switch to local network only [recommended by security].
