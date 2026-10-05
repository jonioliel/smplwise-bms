# CR-011 — Second factor for Arx: login policy, step-up for sensitive actions, passkeys (decision paper, revision 2)

**Status:** Proposed - decision paper, no product code, no migration number committed. Board task K11 (2.5.0 area);
requirements R193-R195 / task T095 / tests AT193-AT195 stay the registry anchors. Revision 2 (2026-10-06) refreshes
revision 1 (2026-09-30) against what shipped since: the remote channel (CR-008), the alarm with personal PINs
(CR-010), the mobile presence server with device tokens (CR-027) and the wall display decision (CR-030). Revision 1's
verified facts about HA MFA, Android biometrics and WebAuthn are kept in Appendix A and the sources at the end.

**Related:** CR-008 (remote `/arx`, HA login on our own screen, `__Secure-arx_session`, `remote.idle_lock_minutes`),
CR-010 (`alarm.remote_codeless`, personal PIN, `confirmed:true` on disarm), CR-027 (device registry, `arxd_` tokens),
CR-030 (wall users = `kiosk` role), CR-012 (notifications), `docs/security/HA_IDENTITY_RBAC_HE.md`.

## 1. How Arx authenticates today (code read on origin/main @ 486d4ea7)

| Channel | Credential | Proof of a person | Lifetime |
|---|---|---|---|
| Local, Ingress | HA session of the browser; HA proxy adds `X-Remote-User-*`, trusted only from `172.30.32.2` | HA login (password, + HA MFA if the user enabled it) once, by HA itself | HA's own (long) |
| Remote `/arx` | Arx login screen walks HA's login flow (incl. `select_mfa_module`/`mfa`), exchanges the HA access token at `POST auth/session` for the opaque cookie `__Secure-arx_session` (HttpOnly, Secure, SameSite=Strict, Path=/arx/) | HA password (+ HA code if enrolled) at sign-in only | `remote.session` = `rolling_90d` default; `rolling_90d_idle_lock` with `remote.idle_lock_minutes` (default 720) is an optional idle lock; the server revalidates sessions against HA periodically and drops revoked users |
| Remote API client | `Authorization: Bearer <HA access token>` (any token HA validates, including long-lived ones) | none beyond the token | token life |
| Mobile app (CR-027) | the web view holds the session cookie; the app's own HTTP calls use a **device token** `arxd_...` (SHA-256 hashed server side, 64 KiB bodies, rate-limited) | the token proves "this registered install", not a person present | until the device is removed |
| Wall / kiosk (CR-030) | an ordinary HA user bound to the `kiosk` role (`map.read`, `video.live`), signs in once on a tablet | none beyond the sign-in; cannot change anything | the remote session (90 days rolling) |

Patterns that already exist and can be reused:

- **Per-action confirmation (not authentication):** disarm requires `confirmed: true` (`409 confirmation_required`);
  HA actions are recorded in `ha_actions` and confirmed by observed state.
- **Per-action secret:** the alarm code policy (`services/alarm_codes.py`, `routers/alarm.py`): personal PIN (scrypt hash,
  AES-256-GCM key file for panel codes), 5 wrong codes in 5 min then a 10 min lockout, one unsettled typed attempt per
  user and panel. `alarm.remote_codeless` (default on) lets a remote user disarm **without any code** - the gap this CR closes.
- **Sensitive permissions** are already a category (`door.unlock`, `alarm.disarm`, `system.configure`, listed as
  "sensitive, not implied" in `routers/access.py`), so a step-up gate can key on the permission, not on routes.
- **Sessions:** `auth/sessions` list/revoke (own / all), "sign out everywhere", audit rows `auth.remote_session.*`.
- **Refusal flag:** `remote.require_mfa_admin` (default off) checks that the HA *account* has MFA enabled, not that this
  sign-in used it.
- **Known gap (unchanged):** a long-lived HA access token never passes a login flow, so the remote bearer path bypasses
  HA MFA entirely.

## 2. Threat model per channel

Threats: T1 stolen unlocked device with a live session; T2 stolen cookie/token (malware, copied profile, XSS on the
shared origin); T3 phished password and a relayed code; T4 hostile network; T5 insider/second admin abusing recovery.

| Channel | Realistic attackers | What a second factor must achieve | Verdict |
|---|---|---|---|
| Local Ingress | someone on the LAN with HA access; HA login already gates it | little new; physical presence assumed | no mandatory factor; optional step-up for destructive admin actions (off by default) |
| Remote `/arx` (browser, PWA) | internet attackers: password stuffing, phishing (T3), cookie theft (T2) | a factor at sign-in for users with sensitive permissions, and a **fresh** proof at the sensitive action | main target of this CR |
| Mobile app | thief with the unlocked phone (T1), malware (T2) | a proof bound to the phone's biometric, checked by the server | strongest value: device key + biometric |
| Kiosk / wall tablet | passer-by touching a screen; theft of the tablet | **no** interactive factor possible or needed: the role cannot change anything; the risk is a stolen tablet keeping a 90-day session | exempt from step-up and sign-in factor; mitigate by the session list, one-click revoke, and the role holding no sensitive permission |

Out of scope: Cloudflare Access (CR-008 D3), changing HA users or MFA configuration (Arx never does, AGENTS.md).
The iOS and Android shells are Codex-built; the device-key contract (challenge string, signature format, key
properties) is handed over as an addendum, this CR does not touch `mobile/`.

## 3. Options

Where each is verified is the key design axis: **HA** (HA's login flow; Arx only infers) or **Arx** (the add-on
verifies a proof itself, no HA round trip).

| Option | Verified by | Sign-in | Step-up | T1 phone | T2 cookie | T3 phishing | Enrolment | Recovery |
|---|---|---|---|---|---|---|---|---|
| A. HA-side MFA reuse + Arx policy (`remote.mfa_policy`, provenance check of the sign-in via `auth/refresh_tokens`, refuse long-lived tokens remotely) | HA | yes | only by a fresh HA sign-in (password + code), awkward | no | no | partial (TOTP relay) | in the HA profile, by the user | HA's only: an operator edits `auth_module.totp`; no recovery codes |
| B. Arx TOTP | Arx | possible (duplicate of A) | yes (6 digits) | weak if the authenticator is on the same phone | yes | partial | QR in Arx, confirm one code | 10 single-use recovery codes; admin reset |
| C. Passkeys / WebAuthn (rpId = Arx hostname, user verification required) | Arx | optional | yes (touch / Hello / phone QR) | depends on UV | yes | **yes** | register in Arx; remote hostname only (different rpId than Ingress) | second passkey, device key, or admin reset; in the Android WebView needs an `assetlinks.json` route and a recent WebView |
| D. Trusted-device cookie ("remember this browser") | Arx | reduces prompts only | no | no | no (it is a cookie) | no | automatic after one proof | revoke in the device list |
| E. Device key in the app (Keystore / Secure Enclave key, biometric-bound; the server stores the public key beside the CR-027 device) | Arx | in-app | **yes**, cryptographic proof of a fresh biometric | **yes** (biometric-only) | yes | yes in the app | at device registration; needs a fresh HA sign-in or an existing factor | revoke the device; re-register |
| F. Push approval with number match | Arx + E | - | yes, from a desktop | biometric | yes | yes | needs E and CR-012 | as E |

Honest notes:
- **D is a convenience, not a factor.** It must never replace step-up for door unlock or disarm; it is useful only to
  avoid re-entering HA's sign-in code for non-sensitive remote use.
- **A alone does not close the owner's actual risk** (code-less disarm from a signed-in phone or browser): the code is
  asked at sign-in, not at the action.
- **B has the weakest unique value** once A and C/E exist; keep it only as a fallback for users with neither the app nor
  a passkey-capable browser.
- An HA-verified factor needs the user to enrol in HA; Arx cannot enrol or reset it.

## 4. Step-up for sensitive actions

A request needing step-up gets `403 step_up_required {methods}` unless the session holds a fresh proof; the UI opens a
sheet, collects the proof, retries once. The proof lives on the Arx session (never on the HA token); default freshness
5 minutes, `0` = every action.

| Action | Default | Reason |
|---|---|---|
| Disarm alarm, zone bypass (CR-010) | step-up on remote; `alarm.remote_codeless` then means "no typed code **after** a step-up" | the stated risk |
| Door / lock unlock (`door.unlock`) | step-up on remote | physical entry |
| Camera / NVR writes (`nvr_write`, `nvr_batch`, `nvr_settings`) | step-up on remote | irreversible device changes |
| User admin: roles, bindings, remote-access flag, revoking others' sessions, factor reset | step-up everywhere (local too) | privilege change |
| `system.configure` settings, alarm codes / PINs, remote alarm settings | step-up on remote | |
| Arming, live video, map, normal device control | none | usability |

Proof methods per channel: app = device key + biometric (E); browser / PWA = passkey (C). Until C exists, browser / PWA
alarm actions fall back to the existing **personal alarm PIN** (per-user, throttled) and other sensitive actions to a
fresh HA sign-in; TOTP (B) only if built.

### Kiosk and wall exemptions
The `kiosk` role holds none of the sensitive permissions (`test_kiosk_role.py` proves it cannot reach events, settings,
exports, playback or HA control), so no step-up applies and no sign-in factor is demanded: the policy is "users holding a
sensitive permission", and a kiosk user is outside it by construction. The wall tablet's exposure is a stolen tablet;
the answer is the session list (revoke, audit) and, as an option, a **shorter maximum session age for kiosk users**
(not a factor). A user holding both a kiosk binding and a sensitive role is flagged in settings as a misconfiguration.

## 5. Recovery and break-glass

- **Lost phone:** the user or an administrator removes the device (revokes its key, its `arxd_` token, its sessions).
- **Factor reset** (device keys, passkeys, Arx TOTP) by a `system.configure` administrator **from the local channel only**
  by default, with a notice to the user and an audit row. A remote attacker with an admin cookie cannot reset factors (T5).
- **Break-glass:** the owner account can always act through Ingress (HA login, no Arx factor). Deliberate: local is the
  recovery path, which is why local must not get a mandatory factor that could lock everyone out.
- **At least one factor must remain** before the last one can be removed; enrolling a *new* factor needs a fresh proof or
  a fresh HA sign-in (otherwise a stolen cookie enrols the attacker's phone).
- **HA's own TOTP** stays HA's: reset by file edit by an operator (Appendix A). Arx never touches it.
- **Offline / HA down:** Arx-verified proofs (C, E, B) work without HA; HA-verified (A) do not. Remote sign-in needs HA anyway.

## 6. Enrollment UX

- Settings, "Security" (Hebrew UI rules, no HA branding outside settings): a short per-user list - passkeys, phone keys,
  trusted browsers - each with name, created, last used, remove; one "Add" button.
- The first sensitive action without a factor offers enrolment inline ("Set up in 30 seconds"), never a wall of text.
- App: after device registration (CR-027) one prompt "Use fingerprint to confirm sensitive actions", on by default.
- Administrators see who has no factor in the users screen and can set a per-user override of the policy.
- No internal codes (CR-011, K11) are ever shown to users.

## 7. Effect on the mobile app and the wall display

- **Mobile app:** gains the device key (CR-027 registration is the natural enrolment point: same `device_id`, public key
  stored beside the token) and a biometric sheet fed by the `window.ArxApp` bridge. The `arxd_` token does not prove a
  person is present, so no sensitive endpoint may accept a device token alone (today it is limited to presence / push
  routes; a test must keep it that way). The app lock stays for UX but is no longer the only protection.
- **Wall display:** no change (exempt, section 4); its session stays revocable.

## 8. Data model (no migration number committed)

- `auth_factors`: id, user_id, kind (`passkey|device_key|totp`), label, public key or encrypted-secret reference,
  credential_id, sign_count, device_id (nullable, the CR-027 device), created_at, last_used_at, disabled_at.
- Step-up challenges: in the session store (user, session, action, nonce hash, 60 s expiry, used flag); persisted only if
  replay protection across restarts is wanted.
- Session record: `step_up_until`, `step_up_method` (never on the HA token).
- `recovery_codes` (scrypt hashes) only if B or printable recovery is chosen.
- Settings: `remote.mfa_policy` (`off|admins|sensitive|all`, replaces `remote.require_mfa_admin`),
  `security.step_up_minutes` (0-30, default 5), `security.step_up_local` (default off),
  `security.device_key_auth` (`biometric|biometric_or_screen_lock`), `security.factor_reset_channel` (`local|any`).
  TOTP secrets, if built, reuse the `<data>/keys/` key-file pattern and stay out of backups.

## 9. API (proposed)

- `GET auth/factors` (own; admin for others), `DELETE auth/factors/{id}`.
- `POST auth/factors/passkey/options|register`, `POST auth/factors/device-key` (public key, optional attestation).
- `POST auth/step-up/challenge {action}` -> `{nonce, methods, expires_in}`; `POST auth/step-up/verify {method, proof}` ->
  `{fresh_until}`.
- Gated routes answer `403 step_up_required {methods, action}` with a Hebrew `user_message` and a stable code.
- Audit: `auth.factor.enrolled|removed|reset`, `auth.step_up.ok|failed|locked` (method only, never values).
- Lockout: 5 failures in 5 minutes, 15 minutes, per user and per address (the alarm-code shape).

## 10. Tests

Unit: challenge binding (user, session, action), expiry, replay, WebAuthn sign-count and origin / rpId checks, TOTP window
and no-reuse (if B), policy resolution per permission set, kiosk user outside the policy. API: every gated route 403
without proof and 200 with, device token rejected on every sensitive route, long-lived bearer refused for policy users,
factor reset only from local, last-factor removal refused, audit rows free of secrets. UI / e2e (Playwright with a virtual
authenticator): the sheet appears and retries once, the kiosk flow is unaffected. App: device-key signature
verification with a canned vector; real biometric and WebView cases stay NOT_RUN until a device is available. The
existing alarm, kiosk and remote suites must stay green.

## 11. Phases, realistic effort, quota

Agent-hours are wall-clock agent work including runner tests; revision 1's day figures were 5-10x too high.
Weekly-quota percentages are rough planning numbers (a Sonnet-class agent about 1-2% of the weekly quota per
agent-hour, a Fable-class review pass 3-5%); replace them with the live usage reading before launching.

| Phase | Content | Agent-hours | Weekly quota |
|---|---|---|---|
| P1 | `remote.mfa_policy`, sign-in provenance check, refuse long-lived tokens for policy users, settings + users-screen UI | 1.5-2 | 2-4% |
| P2 | Step-up framework: session fields, challenge / verify, gates on the section 4 routes, UI sheet, PIN fallback for alarm, audit, lockout, tests | 2.5-3.5 | 4-6% |
| P3 | Device key: table, CR-027 registration tie-in, server signature verification, "My devices" list; handoff addendum for the app shells | 1.5-2 | 2-4% |
| P4 | Passkeys for browsers / PWA (library vs own verification decided in the task), virtual-authenticator tests | 2-3 | 3-5% |
| P5 | Android WebView passkeys (asset-links route in the tunnel provisioning), only if the app wants it | 1-1.5 | 2-3% |
| P6 | Push approval (needs CR-012 and P3) | 1.5-2 | 2-4% |
| optional | Arx TOTP + recovery codes | 1.5-2 | 2-4% |
| optional | Key attestation verification | 1 | 1-2% |

Recommended first release: P1 + P2 (about 4-5.5 h, 6-10%), which closes the code-less remote disarm risk for browsers
through the PIN fallback and gates every sensitive route; P3 with the app next; P4 after.

## 12. Recommendation

1. **A + the step-up framework first:** `remote.mfa_policy = sensitive` by default; step-up for the section 4 list on the
   remote channel; local unchanged; kiosk exempt.
2. Then the **device key** (E) with the app biometric as the primary proof and **passkeys** (C) for browsers; keep the
   **personal alarm PIN** as the interim browser proof for alarm actions only.
3. **Do not build Arx TOTP** now. Do not treat the trusted-device cookie as a factor; if offered at all, only for
   non-sensitive prompts and only after P2.
4. Factor reset from the local channel only; the owner account keeps Ingress as break-glass.

## 13. Decisions for the owner

See `private/review/second-factor/SUMMARY_HE.md` (Hebrew, lettered options, recommendation marked): sign-in policy scope;
which actions need step-up; freshness window; whether the app biometric key counts as the second factor; interim browser
proof for remote disarm; passkeys now or later; Arx TOTP; trusted-device cookie; factor reset channel; kiosk exemption;
push approval timing.

---

# Appendix A — Verified facts (revision 1, 2026-09-30, unchanged)

## A.0 Facts verified (2026-09-30)

### A.1 Home Assistant MFA

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

### A.2 What Arx does today (code read on `g0/intake` @ 8b23749)

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

### A.3 Android and WebAuthn

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


---

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
