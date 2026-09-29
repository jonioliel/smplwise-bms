# CR-011 — Second factor for Arx: remote sign-in and step-up for sensitive actions

**Numbering:** registered as CR-011 on 2026-09-30. Task card: T095 (requirements R193-R195, acceptance tests
AT193-AT195). T093 is claimed by both CR-009 and CR-010 on their branches, so T094 / R190-R192 / AT190-AT192 are left
for whichever of the two is renumbered at merge.

**Status:** Proposed - design record, no product code. Decisions for the owner in §9.

**Related:** CR-008 (remote channel `/arx`, sign-in through HA's login flow, sessions, `remote.require_mfa_admin`,
Android shell with an optional app lock), CR-010 (alarm; `alarm.remote_codeless`, default on, owner decision
2026-09-29 21:50 "relies on the Android app's biometric lock and plans 2FA"), CR-012 (notifications in the Android app;
option D here depends on it).

## 1. The request and the gap today

The owner said a second factor is coming and relies on it for (a) remote sign-in and (b) sensitive actions from outside,
above all disarming the alarm without a code (CR-010 `alarm.remote_codeless`, on by default).

What protects a code-less remote disarm today:

| Layer | What it proves | Gap |
|---|---|---|
| HA password (+ HA MFA if the user enabled it) | the person knew the password (and the code) **once, at sign-in** | the sign-in lasts up to 90 days (`remote.session = rolling_90d`); nothing is re-asked at the action |
| Arx session cookie | the request comes from that browser / app | a stolen cookie or an unlocked signed-in phone acts as the user |
| Android app lock (`AppLock.kt`, `BIOMETRIC_WEAK or DEVICE_CREDENTIAL`, no `CryptoObject`) | the phone unlocked the app **locally** | optional, off by default; the server never learns it happened; a browser or PWA session has no such lock |

So the server cannot tell, at the moment of a disarm, that the legitimate user is present. Everything below is about
closing that gap without making the alarm unusable.

## 2. Facts verified (2026-09-30)

### 2.1 Home Assistant MFA

- **Modules:** `totp` ("Authenticator app") and `notify` (a one-time code sent through a notify service, e.g. the
  Companion app). "If no `auth_mfa_modules` configuration section is defined … a TOTP module named Authenticator app
  will be autoloaded." [HA-MFA]
- **Enrolment is per user, by the user**, in HA's profile, Security tab (QR code, confirm one code). An administrator
  cannot enrol or reset another user's MFA from the UI; no per-role enforcement exists in HA. [HA-MFA], [HA-ISSUE-23250]
- **Enforcement in the login flow (code read):** after the password step, `AuthManagerFlowManager.async_finish_flow`
  runs `if auth_provider.support_mfa and not credentials.is_new:` → `async_get_enabled_mfa(user)` → if any module is
  enabled, the flow goes to `select_mfa_module` / `mfa`. So **every** sign-in of an MFA-enabled user through the
  `homeassistant` provider asks for the code. `trusted_networks` overrides `support_mfa` to `False`. [HA-CORE-AUTH],
  [HA-CORE-TN]
- **Limits:** the MFA step lives 5 minutes (`MFA_SESSION_EXPIRATION`), `totp.py` has `MAX_RETRY_TIME = 5` wrong codes
  before `too_many_retry`, `valid_window=1` (±30 s). The TOTP secret is stored unencrypted in
  `/config/.storage/auth_module.totp` (file permissions only). [HA-CORE-TOTP]
- **Recovery:** HA has **no recovery codes**. The known procedure for a lost authenticator is an operator with file
  access removing the user's entry from `/config/.storage/auth_module.totp` (or renaming the file, which disables TOTP
  for every user) and restarting HA. [HA-COMMUNITY-2FA], [HA-CORE-TOTP]
- **What a token says:** the access token is a JWT with only `iss` (refresh-token id), `iat`, `exp`; the refresh token
  stores no MFA flag. `auth/current_user` returns `mfa_modules[{id, name, enabled}]`; `auth/refresh_tokens` returns
  per sign-in `id, client_id, client_name, type, created_at, last_used_at, last_used_ip, auth_provider_type, expire_at,
  is_current`. [HA-CORE-AUTH], [HA-CORE-COMP-AUTH]

### 2.2 What Arx does today (code read on `g0/intake` @ 8b23749)

- `frontend/src/arx/arx-login.ts` / `auth.ts` walk HA's login flow including `select_mfa_module` / `mfa`, with Hebrew
  texts for `invalid_code`, `too_many_retry`.
- `services/ha_user_auth.py`: `remote.require_mfa_admin` (default off, CR-008 D8 = optional) refuses a user holding an
  administrative permission whose HA account has **no enabled MFA module** - it checks the account, not the sign-in.
- **Gap found:** the exchange (`POST auth/session`) and the bearer path accept any access token HA validates. A
  long-lived access token (`type = long_lived_access_token`, made in the HA profile) never passes a login flow, so it
  bypasses MFA. `auth/refresh_tokens` is consulted today only for "sign out everywhere".
- `services/alarm_codes.py` (CR-010 branch): AES-256-GCM with a 32-byte key in `<data>/keys/alarm-codes.key` (0600 in
  a 0700 directory, atomic create, never in a project backup), scrypt hashes for PINs, 5 wrong codes in 5 min → 10 min
  lockout. Web Push's VAPID pair is in the `push_vapid` table instead (outside `settings`, but inside the database).

### 2.3 Android and WebAuthn

- **Keystore + biometric:** a Keystore key can be bound to user authentication (`setUserAuthenticationRequired`,
  `setInvalidatedByBiometricEnrollment`) and used through `BiometricPrompt.authenticate(info, CryptoObject)`. Crypto-bound
  prompts accept only `BIOMETRIC_STRONG` (Class 3) and, from API 30, `DEVICE_CREDENTIAL`; `BIOMETRIC_WEAK` throws.
  `BIOMETRIC_STRONG | DEVICE_CREDENTIAL` is unsupported on API 28-29. [AND-BIO] (updated 2026-09-16), [BIO-WEAK]
- **Key attestation** proves the key lives in TEE / StrongBox with its properties (including the auth requirement);
  the chain is checked against Google's roots and the revocation list at `android.googleapis.com/attestation/status`;
  hardware attestation roots need Google Play services on the phone. [AND-ATTEST] (updated 2026-07-09)
- **WebAuthn in a WebView:** `WebSettingsCompat.setWebAuthenticationSupport(settings,
  WEB_AUTHENTICATION_SUPPORT_FOR_APP)` behind `WebViewFeature.WEB_AUTHENTICATION`, androidx.webkit ≥ 1.12.0 (added
  2024-09-10; 1.12.1+ advised because 1.12.0 had a runtime issue; our shell has 1.14.0, latest stable 1.17.1 of
  2026-09-23), and **Digital Asset Links**: the site must serve `/.well-known/assetlinks.json` naming the app.
  `mediation: "conditional"` is not supported. [AND-WV-WEBAUTHN] (updated 2026-02-26), [AND-WEBKIT-REL], [CORBADO]
  Reported, not verified by us: System WebView ≥ 124 carries the capability [VIA-1936]; in app mode the request goes
  through the phone's Credential Manager / Google Play services FIDO2 stack [CORBADO]. Runtime feature detection is
  required either way.
- **Passkeys:** synced passkeys by default (Google Password Manager on Android 9+, third-party providers from
  Android 14; iOS 16+; Chrome 129+ / Edge 122+ desktop); cross-device QR sign-in from a desktop to a phone. [PASSKEYS-DEV]
  A synced passkey is **not bound to one phone** - it follows the Google account.
- **TOTP:** RFC 6238, 30 s step, at most one step of delay tolerance recommended, and a verifier must not accept the
  same OTP twice. [RFC6238]

Assumptions (not verified): the Cloudflare edge terminates TLS for `/arx` (it is a Cloudflare tunnel), so Cloudflare is
inside the transport trust boundary; a phone thief who watched the phone PIN can use anything gated by
`DEVICE_CREDENTIAL`.

## 3. Threats considered

| # | Threat | Example |
|---|---|---|
| T1 | Stolen **unlocked** phone, Arx app or browser signed in | picked up from a table; phone PIN possibly shoulder-surfed |
| T2 | Stolen **session cookie / tokens** | malware or an XSS on the shared origin reads `arx.auth.v1`; a copied browser profile |
| T3 | **Phished password** (+ phished TOTP relayed in real time) | fake "Arx" page on a look-alike domain |
| T4 | **Malicious network** | hostile Wi-Fi; TLS stays intact (HSTS via Cloudflare), so mainly T3-style redirection and metadata |
| T5 | **Insider / second admin** abusing recovery | resets a user's factor to enrol their own |

## 4. Options

### A. Rely on HA's MFA, enforced by Arx policy for remote sign-in

- **What Arx can verify:** not that *this* sign-in used MFA directly (no claim in the token), but a sound inference:
  (1) `auth/current_user` shows an enabled MFA module; (2) `auth/refresh_tokens` shows the token's sign-in (`iss`) is
  `type = normal`, `client_id` = this Arx address, `auth_provider_type = homeassistant`; (3) its `created_at` is later
  than the first moment Arx saw MFA enabled for that user (recorded by Arx - HA does not expose when MFA was enabled; an
  older sign-in may predate MFA). HA's code then guarantees the code was asked (§2.1).
- **Policy:** replace the boolean `remote.require_mfa_admin` with `remote.mfa_policy = off | admins | sensitive | all`
  plus a per-user override in משתמשים והרשאות. Long-lived tokens and other clients' sign-ins are refused on the
  remote channel for users under the policy (closes the §2.2 gap). A user without MFA gets a clear refusal pointing to
  the profile page (settings wording may name HA; elsewhere "תשתית המערכת", UI_COPY_RULES).
- **Step-up variant (A-re):** for a sensitive action Arx can ask for a *fresh* HA sign-in (password + code) and accept
  it only when the new sign-in's `created_at` is under 2 minutes old; Arx then revokes the extra refresh token.
- **Security:** T3 partly (a relayed TOTP is still phishable); T1/T2 not at all for sign-in-only; A-re covers T1/T2
  but costs a password and a code per action.
- **UX:** users enrol in the HA profile (a screen outside Arx); code entry at every sign-in. Desktop and phone alike.
- **Installer:** nothing (TOTP is auto-loaded); explain enrolment to users.
- **Recovery / offline:** HA's only (file edit by an operator, §2.1). No recovery codes.
- **Effort:** policy + provenance check + LLAT refusal + UI + tests **1.5-2 d**; A-re **+1.5 d**. Depends on nothing.

### B. Arx's own TOTP

- Enrolment in Arx (QR rendered in the page, confirm one code), secret encrypted with AES-256-GCM under
  `<data>/keys/second-factor.key` (the `alarm_codes.py` key-file pattern; associated data = user id), 10 single-use
  recovery codes stored as scrypt hashes, last accepted time step stored (no replay), 5 wrong codes in 5 min → 15 min
  lockout per user and per address, audit without values; administrator reset.
- **Security:** same phishing weakness as any TOTP (T3 real-time relay); on T1 weak when the authenticator app is on
  the same unlocked phone; good against T2 for step-up.
- **UX:** works in every browser, PWA and the app; typing 6 digits per step-up. Recovery codes are Arx's advantage over HA.
- **Installer:** nothing. **Effort:** **4-5 d** (QR, crypto, recovery, lockout, UI, tests). Duplicates HA's TOTP for
  sign-in; its only unique value is step-up in browsers without passkeys, plus recovery codes.

### C. WebAuthn / passkeys

- Registration and assertion in Arx (`rpId` = the Arx hostname), `userVerification: "required"`, challenge bound
  server-side to user + session + action; public keys only on the server.
- **Security:** phishing-resistant (the browser binds the assertion to the origin) - the only option here that stops
  T3; T2 covered for step-up; T1 depends on the phone's user verification (biometric or phone PIN). Synced passkeys are
  not tied to one device.
- **UX:** one touch of the fingerprint / Windows Hello / phone-as-authenticator (QR) on desktop. Browsers and installed
  PWA: works on the Arx hostname. **Inside our Android WebView:** needs `setWebAuthenticationSupport(...FOR_APP)`, a
  WebView new enough (runtime check; fall back otherwise), and `assetlinks.json` at
  `https://<customer>.<arx-domain>/.well-known/assetlinks.json` - the root path goes to HA today, so each site needs an
  extra tunnel route for that one path to the Arx add-on (the provisioning script, CR-008 D14, can add it).
- A passkey made on the remote hostname does not work on the Ingress (local) hostname - a different `rpId`. Step-up is
  a remote-channel feature by default, so this is acceptable.
- **Installer:** the extra tunnel route (app case only). **Effort:** browsers + PWA **4-5 d**; Android WebView
  **+2 d** (WebView setting, asset links route, fallback). Library choice (`webauthn` package vs own verification with
  `cryptography`) decided in the task.

### D. Push approval in the Android app

- "Approve disarm on your phone?" with a number to match, approved with the biometric-bound device key of E; useful
  when acting from a desktop.
- **Security:** resists T2 (the attacker's desktop cannot approve); push fatigue is countered by number matching and
  rate limits. **Depends on CR-012** (a way to wake the app) and on E's device key. **Effort:** **3 d** after both.

### E. Step-up for sensitive actions (recommended core)

A sensitive action is served only when the session holds a **fresh second-factor proof** (default: within 5 minutes,
per session; setting `security.step_up_minutes`, 0 = every action).

- **Sensitive actions (proposed default):** disarm and zone bypass (CR-010), door / lock unlock (CR-005 / CR-007),
  alarm codes, PINs and remote alarm settings, user roles and the remote-access flag, `system.configure` settings,
  revoking other users' sessions, second-factor reset. Arming stays one tap.
- **Server:** `POST auth/step-up/challenge {action}` → a 32-byte nonce, 60 s, bound to user, session and action;
  `POST auth/step-up/verify` with the proof → a step-up mark on the session (never on the HA token); a refused
  sensitive call answers `403 step_up_required {methods}` and the UI opens the step-up sheet, then retries once. Audit
  `auth.step_up.ok / .failed / .locked` with the method. Lockout as in B. Remote channel by default;
  `security.step_up_local` (default off) extends it to Ingress.
- **Proof methods:** (1) **Android device key** (below), (2) passkey (C), (3) Arx TOTP (B) if built, (4) HA re-sign-in
  (A-re), (5) push approval (D). Until C exists, a browser / PWA session without a device key falls back to **the
  personal alarm PIN of CR-010** for alarm actions (it is already a per-user secret with lockout) - proposed in §9 Q6.
- **Android device key:** at enrolment the app creates an EC P-256 signing key in the Keystore
  (`setUserAuthenticationRequired(true)`, per-use authentication, `setInvalidatedByBiometricEnrollment(true)`, StrongBox
  when present), sends the public key (and optionally the attestation chain) to the server, which stores it per user
  and device. A step-up is `BiometricPrompt` with a `CryptoObject(Signature)` over `arx-step-up|v1|<origin>|<user>|
  <action>|<nonce>`; the server verifies the signature with the stored key. This is a **real cryptographic proof** that
  the enrolled phone's user just passed a Class 3 biometric (or, if the owner allows, the phone's screen lock on API 30+).
  The page asks the app through the existing `window.ArxApp` bridge (origin-limited `addWebMessageListener`); the app
  shows the action text in the prompt. **Enrolment** of a device key itself requires a fresh HA sign-in (A-re) or an
  existing factor, is announced to the user's other devices and audited - otherwise a stolen cookie (T2) could enrol the
  attacker's phone. The same key can serve as the **sign-in second factor inside the app** (password + key).
- **Security:** T1 covered when biometric-only (a known phone PIN does not unlock a `BIOMETRIC_STRONG`-only key, and a
  new fingerprint invalidates it); T2 covered (the cookie alone cannot sign); T3 covered in the app (the app signs only
  for stored servers' origins, the origin is inside the signed string); T4 no effect beyond TLS.
- **Effort:** step-up framework (server + UI sheet + gates on the listed routes + tests) **3 d**; device registration
  (table, enrolment rules, list / revoke in "המכשירים שלי", shared with CR-012) **2 d**; Android key + prompt + bridge
  **2 d**; attestation verification (optional) **+2 d**.

### Summary

| | Sign-in 2FA | Step-up | Phishing (T3) | Stolen cookie (T2) | Unlocked phone (T1) | Effort |
|---|---|---|---|---|---|---|
| A HA MFA + policy | yes | A-re only (password + code) | partial | no (A-re: yes) | no (A-re: partial) | 1.5-2 d (+1.5) |
| B Arx TOTP | duplicate of A | yes | partial | yes | weak | 4-5 d |
| C Passkeys | possible | yes | **yes** | yes | depends on UV | 4-5 d (+2 app) |
| D Push approval | - | yes | yes | yes | biometric | 3 d, after CR-012 + E |
| E + device key | in the app | **yes** | yes (app) | yes | **yes** (biometric-only) | 7 d (+2 attestation) |

## 5. Recovery and administration

- **Lost phone:** the user or an administrator revokes the device key ("המכשירים שלי" / the user drawer); the HA
  sign-ins of that phone are revoked with the existing "sign out everywhere".
- **Reset of a user's factors** (device keys, passkeys, Arx TOTP) by a `system.configure` administrator, **only from
  the local channel (Ingress)** by default - a remote attacker holding an admin's cookie cannot reset factors (T5
  mitigated by audit + a notice to the user). HA's own TOTP stays HA's (file procedure, §2.1).
- **Offline:** proofs are verified by the add-on itself; nothing needs the internet except the optional attestation
  revocation list. With HA down, sign-in is impossible anyway (CR-008).
- **Lockout protection:** at least one factor must remain; the owner account can always act through Ingress.

## 6. Recommended plan

| Phase | Content | Effort |
|---|---|---|
| 1 | A: `remote.mfa_policy` + sign-in provenance + long-lived-token refusal on the remote channel. E: step-up framework, device registration, Android biometric device key; browser / PWA fallback for alarm actions = the personal PIN; `alarm.remote_codeless` then means "no code **after a device-key step-up**" | ≈ 8-9 d |
| 2 | C: passkeys for browsers and the PWA (desktop step-up by phone QR or Windows Hello); then in the Android WebView with the asset-links route | ≈ 6-7 d |
| 3 | D: push approval, after CR-012 | ≈ 3 d |
| optional | B Arx TOTP (only if some users have neither the app nor passkeys); key attestation | 4-5 d; 2 d |

Why this order: the owner's risk is the code-less remote disarm; phase 1 turns the app's local lock into a server-checked
proof on the device he already uses and closes the long-lived-token bypass, without asking users to learn a new
authenticator. Passkeys follow for everything outside the app.

## 7. Settings (proposed)

| Key | Values | Default |
|---|---|---|
| `remote.mfa_policy` | `off` \| `admins` \| `sensitive` \| `all` (+ per-user override) | `sensitive` (replaces `remote.require_mfa_admin`) |
| `security.step_up_minutes` | 0-30 | 5 |
| `security.step_up_local` | bool | false |
| `security.device_key_auth` | `biometric` \| `biometric_or_screen_lock` | `biometric` |
| `security.factor_reset_channel` | `local` \| `any` | `local` |

## 8. Out of scope

Changing HA users, groups or MFA configuration (Arx never does, AGENTS.md); Cloudflare Access (CR-008 D3, unchanged);
iOS app.

## 9. Decisions for the owner

1. Second factor at remote sign-in: (a) only users with administrative permissions; (b) users with any sensitive
   permission (admin, disarm, door unlock) [recommended]; (c) every remote user; (d) optional, as today.
2. In the Android app, may password + the phone's fingerprint-bound device key count as the second factor at sign-in
   (instead of the HA code)? (a) yes [recommended]; (b) no, the HA code always.
3. Which actions need a fresh second factor: (a) disarm and bypass only; (b) plus door unlock and alarm codes / settings;
   (c) plus all settings and user management [recommended].
4. How fresh: (a) every action; (b) 5 minutes [recommended]; (c) 15 minutes.
5. In the app, the proof accepts: (a) fingerprint / face only [recommended]; (b) also the phone's PIN / pattern.
6. From a browser / PWA without a device key, until passkeys exist, a remote disarm: (a) asks for the personal alarm
   PIN [recommended]; (b) is refused; (c) works without a code, as today.
7. Passkeys (phase 2): (a) browsers and PWA, then the app [recommended]; (b) browsers only; (c) not now.
8. Arx's own TOTP: (a) not built, HA's code is used at sign-in [recommended]; (b) build it.
9. Reset of a user's factors: (a) by an administrator from the local network only [recommended]; (b) from anywhere
   with his own step-up; (c) plus printable recovery codes per user.
10. Hardware attestation of the phone key: (a) not now [recommended]; (b) yes (the add-on fetches Google's revocation
    list).
11. Push approval on the phone: (a) after CR-012 [recommended]; (b) not needed.

## Sources (read 2026-09-30)

- [HA-MFA] https://www.home-assistant.io/docs/authentication/multi-factor-auth/
- [HA-CORE-AUTH] https://github.com/home-assistant/core/blob/dev/homeassistant/auth/__init__.py (`async_finish_flow`,
  `async_create_refresh_token`, JWT claims)
- [HA-CORE-TN] …/homeassistant/auth/providers/trusted_networks.py (`support_mfa` → False)
- [HA-CORE-TOTP] …/homeassistant/auth/mfa_modules/totp.py; …/notify.py
- [HA-CORE-COMP-AUTH] …/homeassistant/components/auth/__init__.py (`auth/refresh_tokens`, `auth/current_user`)
- [HA-COMMUNITY-2FA] https://community.home-assistant.io/t/turning-off-two-factor-authentication/148854
- [HA-ISSUE-23250] https://github.com/home-assistant/home-assistant.io/issues/23250 (request: reset 2FA for a user)
- [AND-BIO] https://developer.android.com/identity/sign-in/biometric-auth (updated 2026-09-16)
- [BIO-WEAK] https://github.com/sbaiahmed1/react-native-biometrics/pull/103 (quotes androidx.biometric's exception for
  crypto with Class 2)
- [AND-ATTEST] https://developer.android.com/privacy-and-security/security-key-attestation (updated 2026-07-09)
- [AND-WV-WEBAUTHN] https://developer.android.com/identity/sign-in/credential-manager-webview (updated 2026-02-26)
- [AND-WEBKIT-REL] https://developer.android.com/jetpack/androidx/releases/webkit
- [CORBADO] https://www.corbado.com/blog/native-app-passkeys (modified 2026-08-30)
- [VIA-1936] https://github.com/tuyafeng/Via/issues/1936
- [PASSKEYS-DEV] https://passkeys.dev/device-support/
- [RFC6238] https://www.rfc-editor.org/info/rfc6238/
