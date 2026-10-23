# CR-APPREFRESH295 - App refresh tokens: a persistent sign-in for the phone app

Status: APPROVED by the owner 2026-10-23 (section 11); security review 2026-10-23 fixes in (section 12); go state **LAB ONLY**; **slice 1 BUILT (backend only, switch default OFF)** on `pilot/APPREFRESH-295` from `origin/main` c37c75c91 (2.12.3).
**Device-bound key BUILT (backend only, mode default `optional`)** on `pilot/APPREFRESH2-295` (section 13; app contract
`docs/changes/APPREFRESH-DEVICEKEY-SPEC.md`); migration **0153 PROVISIONAL**. Needs its own security review before customers.
**Device-key pin + administrator-approved reset BUILT (backend only)** on `pilot/APPREFRESH3-295` (section 14; spec revision 2,
section 6a); migration **0158 PROVISIONAL**.
Board item r122, target 2.14.0. Migration **0150 PROVISIONAL** (one file, `0150_app_refresh_tokens.sql`; renumber at integration).
No app code, no frontend, nothing on a real device or server. Activation (switch ON on a real installation) only after a Fable
security review of the public surface (owner decision 1, section 11).

Read with: `docs/api/mobile-presence-contract.md` (CR-027 v2; its section 0.2 two-factor amendment is "proposed, not approved" and is
**not** implemented or relied on here), `docs/security/HA_IDENTITY_RBAC_HE.md`, `docs/changes/CR-USR2-ARX-ONLY-IDENTITY.md`
(Arx-only sessions, the Q3 administrator cap), `private/planning/MOBILE_V5_REVIEW_2026-10-23.md` (answers 3/14: the app signs in
with the web-view session cookie, not an HA bearer).

## 1. Goal

The Android / iOS shells wrap the Arx web app. Today a phone stays signed in only as long as the web view keeps Home Assistant's own
refresh token (HA frontend storage) or an Arx-only session cookie; when the OS clears web storage, the shell is killed, or the HA
sign-in ages out, the user signs in again. The device token (`arxd_`, CR-027) is persistent but deliberately narrow (presence and push
routes only) and never a user session.

The goal is an **app refresh token**: a credential the app keeps in the Keychain / Keystore next to its device token, which lets the
app obtain a short-lived Arx credential without the user typing anything - bound to that phone's device registration, rotating,
single use, revocable from the server at once (the lost-phone kill switch), and never stronger than the sign-in it came from.

Non-goals: the second factor of contract section 0.2 (not approved; untouched); push; presence; anything the web browser does.

## 2. What exists today (code facts at c37c75c91)

| Credential | Where | Lifetime | Stored | Revocation |
|---|---|---|---|---|
| HA session cookie (`__Secure-arx_session`) | `services/ha_user_auth.py` | <= the HA access token (30 min), memory only | in memory | sessions list, `DELETE /auth/sessions` (sign out everywhere), HA re-validation every 60 s, `remote_revoked_chains` by hashed HA refresh-token id (`iss_hash`) |
| Arx-only session cookie (`l.`) | `services/local_identity.py` | rolling 30/90 d, admin 7 d / 24 h idle | SHA-256 in `auth_local_sessions` | logout, revoke chain / user / all, password change, factor change, disable |
| Device token (`arxd_`) | `services/presence.py` | until rotated / deleted | SHA-256 in `mobile_devices.token_hash` | `DELETE presence/devices/{id}`, re-registration of the same `install_id`, TFA2 `revoke_tokens` |
| HA bearer token | `ha_user_auth` bearer path | HA's | not stored (hash cache) | HA |

`install_id` (8-64 chars, one per install per server) is stored in clear on the device row; the device row belongs to exactly one
user (`GET /me` `user.id`).

## 3. Threat model

| # | Threat | Mitigation in this design | Residual |
|---|---|---|---|
| T1 | **Stolen unlocked phone** | The family is revoked from the server at once: the user's "sign out everywhere", an administrator's revoke of the user, `DELETE /auth/app/families[/{id}]`, or `DELETE presence/devices/{id}`. Access tokens live minutes and are deleted with the family (every use re-checks the family). | Whatever the attacker did before the revoke. |
| T2 | **Token replay** (a token copied from the phone, a proxy, a crash log) | Single use + rotation: every refresh marks the token used. Presenting a used token outside the retry grace is **reuse** and revokes the family; inside the grace the unused child is superseded, so whichever of thief / phone refreshes second ends the family on its next refresh. | A thief who refreshes first holds a live family until the phone's next refresh (minutes); the phone then signs in again and the event is in the audit. |
| T3 | **Leaked backup** (an Arx project backup, a database copy) | Only SHA-256 of 256-bit random tokens is stored; the three tables are `NEVER_EXPORTED_TABLES`, the switch and lifetimes are `SETTINGS_KEEP` (never exported, never restored). A restore can never revive a revoked family or a used token. | A phone backup (iCloud / Google) of app storage: the app must store the token in the Keychain with `ThisDeviceOnly` / Android Keystore-backed storage excluded from backup (app requirement A1). |
| T4 | **Malicious app on the same phone** | OS sandbox + Keychain / Keystore (A1). Server side: a token presented with another `device_id` or `install_id` ends the family (`binding_mismatch`), so a token lifted without its install id is useless and noisy. | install_id lives in the same sandbox; true proof of possession needs a device-bound key (slice 3, Q6). |
| T5 | **Session cookie theft used to mint a family** | Minting needs a signed-in REMOTE session (the local channel / Ingress never mints - security review F-02) AND the caller's own device registration AND its install_id, from a sign-in at most 15 minutes old, and the remote-access policy must admit the user. Every mint and every mint refusal is audited. | HA sessions are in memory: after an add-on restart a silent HA re-sign-in starts a new chain (counts as fresh). |
| T6 | **Lost / stolen phone remote kill** | The existing kill switch: `DELETE /auth/sessions?user_id=` (sign out everywhere / an administrator) now also ends every app family of the user, also while the phone is offline; plus the per-family routes and the device delete. | - |
| T7 | **User disabled, password changed, HA sign-in ended** | Checked at every refresh and every access-token use (user inactive / deleted in Arx or in the HA directory copy; the anchor sign-in in `remote_revoked_chains`); pushed at once from the revocation paths (local password change / reset / revoke, `revoke_user_sign_ins`, HA re-validation refusing the anchor's token, TFA2 device-token end). | An HA password change is invisible to Arx unless HA revokes the refresh token behind the anchor (it does not by itself): see Q4. |
| T8 | **Brute force / guessing** | 256-bit tokens; per-client failure limiter (20 / min) and global (300 / min) -> 429; per-family refresh bucket; per-user mint bucket. Unknown tokens are answered from a read, never the write gate. | - |
| T9 | **Probing the public routes** | Guard first (PUB-07): while the switch is off, or on the local channel, every public route answers the same 404 before its body is read. | - |
| T10 | **Secrets in logs / audit** | Tokens are never logged, audited or returned except to their owner in the minting response; audit carries family / device ids and reasons. Tests scan every table, the audit log and the log capture. | - |
| T11 | **Privilege outliving the sign-in** | A family is never stronger than its user right now: slice 2 consumers authorise every request live (RBAC is read per request). Administrators get the USR2 Q3 cap (7 d absolute, 24 h idle), also when the permission is gained later. | - |

## 4. Design

### 4.1 Objects (migration 0150)

- **Family** (`app_refresh_families`): `family_id` (`arf_` + 16 hex, an id, not a secret), `user_id`, `device_id`, `install_hash`
  (SHA-256 of `"install:" + install_id`), platform, **anchor** (`anchor_kind` = `ha` | `local` | `ingress` | `dev` | `none`,
  `anchor_hash` = the HA sign-in's `iss_hash` or SHA-256 of the Arx-only chain id), channel, `admin_capped`, created / last used,
  `absolute_expires_at`, `idle_expires_at`, `generation`, `revoked_at`, `revoked_reason`. One live family per device.
- **Refresh token** (`app_refresh_tokens`): `arxr_` + 43 base64url (256 bits); row = SHA-256, family, generation, parent / child,
  `state` live | used | superseded | revoked, issued / used.
- **Access token** (`app_access_tokens`): `arxa_` + 43 base64url; row = SHA-256, family, user, device, expiry (default 10 min).

### 4.2 Flows

1. **Mint** (`POST /auth/app/refresh-tokens`, session): body `{device_id, install_id}`. The device must be live and the caller's own,
   the install id must match the registration (`409 binding_mismatch`, audited). The remote channel only (404 on the local channel, F-02); the remote-access policy must admit the user (`403 remote_not_allowed`, F-01); sign-in age <= 15 min
   (`403 fresh_sign_in_required`). A previous live family of the device is revoked (`replaced`). Answers `201` with the refresh and
   access tokens (shown once).
2. **Refresh** (`POST /auth/app/refresh`, public, remote channel): body `{refresh_token, device_id, install_id}`. In one write
   transaction: family live; binding (device id + install hash, constant-time) else `binding_mismatch` -> revoke; device live and still
   the same user and install else `device_gone`; user active (Arx and HA directory) else `user_inactive` / `user_deleted`; anchor not in
   `remote_revoked_chains` else `sign_in_revoked`; administrator cap; absolute / idle expiry (`401 app_refresh_expired`). Then the
   token state: `live` -> rotate; `used` within `RETRY_GRACE_S` (20 s, a constant) with a still-unused child -> supersede the child and its access tokens,
   rotate again from the same parent; anything else -> **reuse**: revoke the family, audit `auth.app_refresh.reuse_detected`,
   `401 app_refresh_invalid`. Rotation slides the idle window (capped by the absolute one).
3. **Use** (slice 1: `GET /auth/app/whoami` only): `Authorization: Bearer arxa_...`; live, family live, user active.
4. **Sign out** (`POST /auth/app/sign-out`, public): `{refresh_token}` -> `204`; the family ends (`app_sign_out`). Unknown token: the
   same `204`.

### 4.3 Revocation (all implemented in slice 1)

| Event | Path | Reason |
|---|---|---|
| Device deleted | `presence.unregister` | `device_deleted` |
| Same install registers again | `presence.register` (rotation branch) | `device_reregistered` |
| Device tokens ended (TFA2 factor enabled / reset) | `presence.revoke_tokens` | `device_tokens_ended` |
| HA: sign out everywhere / administrator revoke-all | `ha_user_auth.revoke_sessions` (persist) | `signed_out_everywhere` / `revoked_all_by_admin` |
| HA: one sign-in revoked from the sessions list | same, by `iss_hash` | `revoked_by_user` / `revoked_by_admin` |
| HA: other sign-ins ended (factor on / reset, M4) | `ha_user_auth.revoke_user_sign_ins` (keeps the caller's own sign-in) | the caller's reason |
| HA refused the anchor's token (refresh token deleted at HA, user disabled at HA) | `ha_user_auth.revalidate_once` | `ha_sign_in_revoked` |
| Arx-only: password change / reset, disable, delete, factor change, logout-all | `local_identity.revoke_user_sessions` | the caller's reason |
| Arx-only: one chain revoked / logout | `local_identity.revoke_chain` (by anchor) | the caller's reason |
| Arx-only switch off | `local_identity.revoke_all` (anchor kind `local`) | the caller's reason |
| User inactive / deleted / HA-disabled | checked at refresh and at access use | `user_inactive` / `user_deleted` |
| Anchor in `remote_revoked_chains` | checked at refresh | `sign_in_revoked` |
| Feature switched off | `PUT /auth/app/settings` | `feature_off` |
| Explicit | `DELETE /auth/app/families[/{id}]` | `revoked_by_user` / `revoked_by_admin` / `signed_out_everywhere` / `revoked_all_by_admin` |

A hook failure never breaks the primary revocation (`app_refresh.hook` logs and returns 0); the family then still ends at its next
refresh through the live checks.

### 4.4 Settings (all `SETTINGS_KEEP`)

| Key | Default | Range |
|---|---|---|
| `security.app_refresh` | `off` | on / off - ON only from the local channel; OFF from either channel (kill switch) and ends every family |
| `security.app_refresh_absolute_days` | 90 | 1-365 |
| `security.app_refresh_idle_days` | 30 | 1-90, never above the absolute lifetime |
| `security.app_refresh_access_minutes` | 10 | 1-60 |
| `security.app_refresh_admin_absolute_days` | 7 | 1-7 (USR2 Q3) |
| `security.app_refresh_admin_idle_hours` | 24 | 1-72 |

### 4.5 Audit (no secrets)

`auth.app_refresh.issued` (family, anchor kind, admin cap, channel), `.issue` denied (`not_own_device`, `binding_mismatch`,
`sign_in_not_fresh`), `.refused` (family-ending refusals: `binding_mismatch`, `device_gone`, `user_inactive`, `sign_in_revoked`, `expired`,
`idle`), `.reuse_detected`, `.revoked` (count + ids, reason), `.feature_enabled` / `.feature_disabled`, `.settings`, `.manage` denied.
Rotations are NOT audited row by row (one every few minutes per phone); the family keeps `generation` and `last_used_at`. Unknown-token
refusals are not audited (the limiter counts them), like CR-027's device tokens.

### 4.6 Rate limits

Mint: 10 per hour per user. Refresh: burst 10, 30 per minute per family. Unknown / refused tokens: 20 per minute per client address
(IPv6 per /64), 300 per minute in all -> `429 rate_limited` with `retry_after_s`. Settings writes: 20 per minute.

## 5. API shapes

```
POST /arx/api/v1/auth/app/refresh-tokens          (session cookie + Origin)
  { "device_id": "dev_...", "install_id": "3f1c...uuid" }
  201 { "family_id": "arf_...", "token_type": "Bearer", "refresh_token": "arxr_...", "refresh_expires_at": "...Z",
        "absolute_expires_at": "...Z", "access_token": "arxa_...", "access_expires_at": "...Z", "expires_in": 600 }
  404 not_found (switch off, or not the caller's live device) | 409 binding_mismatch | 403 fresh_sign_in_required | 429 rate_limited

POST /arx/api/v1/auth/app/refresh                  (no cookie)
  { "refresh_token": "arxr_...", "device_id": "dev_...", "install_id": "..." }
  200 (same shape as 201) | 401 app_refresh_invalid | 401 app_refresh_expired | 429 rate_limited | 404 (switch off / local channel)

POST /arx/api/v1/auth/app/sign-out                 { "refresh_token": "arxr_..." }  -> 204
GET  /arx/api/v1/auth/app/whoami                   Authorization: Bearer arxa_...
  200 { "user_id", "device_id", "family_id", "expires_at" } | 401 app_access_invalid

GET    /auth/app/families[?user_id=&all=true]      (session) { "families": [ { family_id, device_id, device_name, platform, channel,
                                                   created_at, last_used_at, idle_expires_at, absolute_expires_at, admin_capped } ], "enabled" }
DELETE /auth/app/families/{family_id}              (owner or system.configure) -> 204
DELETE /auth/app/families[?user_id=]               (own, or system.configure) -> { "families_ended": n }
GET/PUT /auth/app/settings                         (system administrator) -> { "settings": {...}, "families_ended"? }
```

App behaviour (for the app teams, slice 4): `401` from refresh -> forget the refresh token, show the sign-in; `404` -> the server does
not offer it (older or switched off): keep today's behaviour; `429` -> wait `retry_after_s`; a network error during refresh -> retry
the SAME token within 20 s, never in parallel (single-flight; the refresh request timeout must be below 20 s - section 12).

## 6. Permissions

- Mint: any signed-in user with a live device registration of their own (registration already needs `presence.report`).
- Own families: list / end by the owner. Another user's: `system.configure` (audited denial otherwise).
- Settings: a system administrator (`rbac.is_system_admin`), ON from the local channel only.
- An access token never grants more than its user holds right now (slice 2 authorises every request live).

## 7. Migrations

One file, **0150 PROVISIONAL**: `app_refresh_families`, `app_refresh_tokens`, `app_access_tokens` with indexes. Additive; older code never
reads them. Rollback: run the previous version (the tables are ignored); dropping them signs every phone out of the persistent sign-in
and nothing else. Not backup tables.

## 8. Test plan

Slice 1 (`smplwise_vms/backend/tests/test_app_refresh_295.py`, fakes only): switch off -> every route absent, the same 404 whatever the
body; local channel absent when on; mint returns tokens once, hashes only; mint refusals (another user's device, wrong install id);
replacement; rotation and sliding idle; reuse outside the grace revokes the family and its access tokens; the retry grace and the
loser caught; retry after the child was used and after the grace is reuse; binding mismatch (install, device); idle and absolute
expiry; administrator cap including a later grant; every revocation path of 4.3 (device delete / re-register, TFA2, disabled user,
anchor revoked, `revoke_user_sign_ins`, local revoke user / chain, sign out everywhere, the family routes, app sign-out, switch off);
rate limits (unknown tokens per client, per family, per user); settings authority and validation; the lifetime settings (defaults,
bounds, idle never above absolute, a change applies to new tokens, existing families re-evaluated at refresh - shortened at once, never
extended past their issued absolute expiry); backup classification; the anchor /
freshness unit; janitor; and that no token is in any table, the audit log or the log.
Not covered in slice 1 (named, not claimed): the remote-channel mint through a real HA or Arx-only session (freshness is unit-tested on
the anchor helper), the ON-from-remote refusal (needs a remote admin session fixture), concurrency of two parallel refreshes (one
SQLite write transaction serialises them by construction; a threaded test is slice 2).

## 9. Slices

| Slice | Content | Status |
|---|---|---|
| 1 | Backend core: tables, service, mint / refresh / sign-out / whoami, family management, settings, all revocation hooks, janitor, audit, limits, tests | **BUILT (this branch), switch OFF** |
| 2 | Make the access token useful: `POST /auth/app/session` exchanges a live access token for an Arx session cookie for the web view (a persisted session row like USR2's, never longer than the family, revoked with it), the remote policy (`remote.policy`, flag / any role) and `remote.require_mfa_admin` checked at exchange; a concurrency test | proposed |
| 3 | Proof of possession: the app generates a non-exportable key (Secure Enclave / StrongBox) at mint, the server stores its public key on the family, every refresh is a signed challenge (DPoP-style). Makes T3/T4 residuals go away | **BUILT** on `pilot/APPREFRESH2-295` as "slice 2 (device key)" - section 13 |
| 4 | App work (Android + iOS) and the settings card ("כניסה שמורה באפליקציה") with the families list per user in "החשבון שלי" / user admin | proposed |
| 5 | Contract text: a v2.1 section of `mobile-presence-contract.md` | after Q-answers |

## 10. Contradictions and choices recorded

1. The contract says a device token is "sent on its own, never together with a session cookie". Minting therefore authenticates with
   the session only and proves the device by `device_id` + `install_id` of the caller's own registration (not with the device token).
2. The task asks for revocation on "password-or-HA-session change". Arx cannot see an HA password change; it sees HA refusing the
   anchor's token (re-validation) and the sign-in ended from the sessions list. Recorded as Q4.
3. Rotation is not audited per use (volume); every family-ending event is.

## 11. Owner decisions (2026-10-23, all seven recommendations approved, plus one addition)

1. **Activation gate:** a Fable security review of the public routes (refresh / sign-out / whoami) before the switch is turned ON on any
   installation.
2. **Lifetimes:** 90 days absolute, 30 days idle, 10 minutes access - as defaults. **Addition:** the three are installation settings,
   adjustable in the Settings (section 4.4), validated server-side.
3. **Administrators:** the USR2 Q3 cap (7 days absolute, 24 h idle) stays.
4. **HA password change:** Arx ends the family when HA ends the sign-in behind it (re-validation, sessions list), plus the idle lifetime;
   "sign out everywhere" in Arx is the lost-phone action.
5. **Retry grace:** 20 seconds, a constant (`RETRY_GRACE_S`), not a setting.
6. **Device-bound key (slice 3):** required before the apps ship to customers.
7. **Switch-off:** OFF ends every saved sign-in (as built).

### 11.1 The lifetime settings (slice 1b)

- Keys, defaults and bounds are in section 4.4; every value is an integer, a write outside its range is `422 validation`.
- The idle lifetime may never exceed the absolute one: a write that would leave idle > absolute (in the same request or against the stored
  value) is `422 validation` with `details.field = security.app_refresh_idle_days`; a hand-edited stored row is clamped on read.
- Where they are set: `GET / PUT /auth/app/settings` (a system administrator; the settings card itself is the frontend slice 4). They are
  `SETTINGS_KEEP` (never exported, never restored), like `security.app_refresh`.
- **Effect on existing families: re-evaluated against the current settings at every refresh** (the safer choice). A shortened absolute or
  idle lifetime (and the administrator cap) applies to existing families at once - their next refresh is refused `app_refresh_expired`
  when the new limit has passed. A lengthened lifetime never extends the absolute expiry a family was issued with (the effective value is
  the minimum of the stored and the current one); the idle window slides by the current idle lifetime, capped by that absolute expiry.
  The access-token lifetime applies to tokens issued after the change (an already issued access token keeps its minutes).

## 12. Security review 2026-10-23 (Fable; `private/planning/SECURITY_REVIEW_APPREFRESH_2026-10-23.md`, reviewed head b740aff89)

No Critical or High finding. Resolutions on this branch:

| Finding | Resolution |
|---|---|
| F-01 Medium: remote-access policy not enforced on refresh / whoami; flag removal kept the families | `_remote_refusal` (wall user without remote, the `remote.policy` flag / administrator default / any_role basis; Arx-only identities are remote by design) is re-evaluated at every refresh (the family ends, reason `remote_not_allowed` / `wall_user_remote_not_allowed`), at every access-token use and at mint (audited). Removing the flag (`PUT /access/users/{id}/remote-access`) ends the user's families at once (`remote_access_removed`). The HA re-validation pass ends the anchor's families for every drop reason, not only `token_revoked`. The administrators' MFA rule needs the HA user's factor, which only a live HA sign-in knows: it is enforced at the slice 2 session exchange. |
| F-02 Medium: a family minted on the local channel had no anchor and no freshness | The safer choice: minting is **refused on the local channel** (404, like the public routes); every family now comes from a remote sign-in Arx can anchor and end, within 15 minutes of it. |
| F-03 Low: sign-out accepted historical tokens | Only the family's CURRENT token signs out (live, or the parent inside the 20 s grace with an unused child); any older token of a live family is a reuse: the family ends `reuse`, audited `reuse_detected`. |
| F-04 Low: mint refusal of an inactive user not audited | Audited (`auth.app_refresh.issue` denied, reason `user_inactive` / `user_deleted` / the policy reason). |
| F-05 Low: the 20 s grace hands a pair to a thief who presents the parent inside it | Accepted design residual until slice 3. **App requirement:** the refresh request timeout must be **below 20 s** (a retry after the grace is a reuse and signs the user out). |
| F-06 Low: two parallel refreshes from one phone sign it out | **App requirement (MUST):** single-flight refresh - one refresh at a time per server, every caller waits for it. |
| F-07 Low: the global failure tier (300 / min) could lock every phone out for a minute | A token (refresh, sign-out) or access token that resolves to a LIVE family skips the global tier - its per-family bucket bounds it; the global tier only stops unknown / ended tokens. The per-client tier (20 / min per address, IPv6 per /64) still applies to everyone. |
| F-08 .. F-13 Info | Recorded: existence oracles through the limiter / 404 (random ids, no practical impact); a rotation keeps the previous access token for its minutes (slice 2 deletes them on rotation when the access token becomes a session, and keeps the access lifetime <= 15 min then); a server clock moving backwards widens windows (NTP from HA OS); caller-supplied `device_id` in a denied audit row (bounded); migration 0150 renumbered at integration; the named test gaps of section 8. |

### 12.1 Go state

- **Now: LAB ONLY.** The owner may switch `security.app_refresh` ON on his own installation (from the local channel), after the backend
  suite is green on the integration head and the migration is renumbered; first family from his own phone after a fresh remote sign-in;
  `reuse_detected` exercised once by hand and its audit row inspected (review section 6).
- **Customers: NO-GO** until **slice 3, the device-bound key** (owner decision 6), is built and reviewed together with slice 2's session
  exchange. Until then the refresh token and the install id live in the same app sandbox, and a copy of both works from anywhere for up
  to the idle / absolute lifetime; detection is reactive (the next refresh of the real phone). The device key is the precondition for any
  customer installation or app release with this feature.

## 13. Device-bound key (APPREFRESH2-295, owner decision 6; built on `pilot/APPREFRESH2-295`)

Numbering note (recorded, not resolved): section 9 lists the device key as slice 3 and the session exchange as slice 2. The task that
built it called it "slice 2"; the branch is `pilot/APPREFRESH2-295`. The session exchange (`POST /auth/app/session`) is still NOT built.
The wire contract for the Android / iOS teams is `docs/changes/APPREFRESH-DEVICEKEY-SPEC.md` (v1, `arx-app-pop-v1`); this section is
the design record.

### 13.1 Primitive and why

**ECDSA P-256 with SHA-256 (`ES256`)** - the only signature algorithm both hardware keystores generate and use natively: Android Keystore
(TEE / StrongBox, `secp256r1`, `SHA256withECDSA`) and the iOS Secure Enclave (P-256 only). Ed25519 is not in the Secure Enclave and not in
every Keystore; RSA is not in the Secure Enclave. Verification uses the backend's existing `cryptography` dependency
(`services/app_refresh_key.py`); **no new dependency**.

### 13.2 Wire format (summary; exact bytes in the spec, section 4)

- Public key at mint: base64url (no padding) of the SPKI DER (Android `getEncoded()`) or the 65-byte `04||X||Y` point (iOS); normalised to
  SPKI DER on the family; fingerprint = SHA-256(SPKI DER).
- Signature: base64url of DER `ECDSA-Sig-Value` (both platforms' native output) or raw 64-byte `r||s`; exactly 64 bytes = raw.
- Signed message: `arx-app-pop-v1 LF <purpose> LF <device_id> LF <nonce> LF <ts> LF <last>`, UTF-8, no trailing LF. Refresh:
  `<nonce>` = the challenge nonce, `<last>` = base64url(SHA-256(refresh token)). Mint: `<nonce>` = `-`, `<last>` = the `public_key` field
  verbatim.
- Nonce: `POST /auth/app/refresh-challenge {device_id}` -> `arxn_` + 256 random bits, **single use, 120 s**, bound to the device's live
  keyed family, stored as SHA-256 (`app_refresh_nonces`); at most 5 open per family. An unknown device gets the same answer shape with a
  nonce stored nowhere.
- `ts`: integer Unix seconds; **clock skew window +-300 s** (`POP_SKEW_S`). Replay window: none - a nonce verifies once; a captured
  request is refused (`app_refresh_proof_retry`, nothing ends).

### 13.3 Flows

1. **Mint with a key**: `device_key {alg: "ES256", public_key, proof {ts, sig}}` on `POST /auth/app/refresh-tokens`. Checked after the
   existing mint checks and the rate limit, BEFORE the previous family is replaced (a refused key ends nothing): key parses as P-256
   (`422 device_key_invalid`), mint signature verifies (`422 device_key_proof_invalid`, audit reason `proof_invalid`), `ts` inside the skew
   (`proof_stale`), the key is not bound to a live family of ANOTHER device (`409 device_key_in_use`). Every refusal is audited
   (`auth.app_refresh.issue` denied, the reason only).
2. **Refresh of a keyed family**: the proof is checked after every slice-1 live check (binding, device, user, policy, anchor, expiry) and
   BEFORE the token state, so the first try and the **retry inside the 20 s grace both need a fresh nonce and a valid signature**.
   - no proof -> the family ends `proof_missing` (a token without its key is a theft signal, like `binding_mismatch`);
   - nonce unknown / expired / used / of another family -> `401 app_refresh_proof_retry` (`details.reason = nonce`), nothing ends, the
     token is not consumed;
   - the nonce is consumed (also when the request is then refused); signature invalid or by another key -> the family ends `proof_invalid`;
   - signature valid but `ts` outside +-300 s -> `401 app_refresh_proof_retry` (`reason = clock`, `server_time`), the token not consumed.
   Security review F-05 (a thief holding the parent inside the grace obtains a pair) is closed for keyed families: without the key the
   parent yields nothing and ends the family.
3. **Rotation / replacement** = a re-mint with a new key from a fresh session (the existing replacement path, reason `replaced`); the same
   key may re-mint on the same device. No in-band key change in v1.
4. **Re-registration** of the device ends the family (`device_reregistered`, unchanged); the next mint binds the new key; a proof by the old
   key never verifies against it (tested).
5. **Revocation**: every path of 4.3 ends a keyed family as before; `_revoke` also drops the family's nonces; the janitor drops expired /
   used nonces. Sign-out needs no proof (it can only end).

### 13.4 Setting `security.app_refresh_device_key` (SETTINGS_KEEP)

| Value | Mint | Keyed family | Keyless family |
|---|---|---|---|
| `off` | binds no key (answer `bound: false`) | proof still required (no downgrade by a setting) | refreshes |
| `optional` (**default**, the lab) | binds the key when sent | proof required | refreshes |
| `required` (**before any customer**) | `422 device_key_required` without a key | proof required | ended at refresh / access use; switching to `required` ends every keyless family at once (`device_key_required`) |

A stored unknown value reads as `required` (fails closed). Raising the mode works from either channel; **weakening it (required ->
optional / off, optional -> off) only from the local channel** (`403 local_channel_only`, audited) - the same rule as switching the feature
ON. Validation: one of the three strings, else `422 validation`.

### 13.5 Migration 0153 PROVISIONAL (one file `0153_app_refresh_device_key.sql`)

`app_refresh_families` + `device_key_spki`, `device_key_fp` (64 hex), `device_key_alg` (`ES256`), `device_key_bound_at`; index on the
fingerprint; table `app_refresh_nonces(nonce_hash PK, family_id, issued_at, expires_at, used_at)`. Additive. Renumber at integration (after
0150). `app_refresh_nonces` is in `NEVER_EXPORTED_TABLES`. Rollback caveat: older code ignores the key columns, so a keyed family would
refresh WITHOUT a proof - roll back only together with switching `security.app_refresh` off.

### 13.6 Audit, logs, limits

- `auth.app_refresh.issued` gains `device_key: "ES256" | null` and `key_fp` = the first **16 hex** of the fingerprint. No row carries the
  public key, the full fingerprint, a signature or a nonce (tested over the audit log and the log capture; nonces are in no table in clear).
- Refusals: `auth.app_refresh.refused` reasons `proof_missing`, `proof_invalid`, `device_key_required`; mint denials `device_key_required`,
  `device_key_invalid`, `proof_invalid`, `proof_stale`, `device_key_in_use`. Nonce / clock retries are not audited (counted by the limiter).
- Limits: challenge per family burst 10 / 30 per minute; an unknown device counts on the per-client failure tier (20 / min) and the global
  tier; every refused refresh (proof retries included) counts on the per-client tier as before.

### 13.7 Administrators' MFA rule (`remote.require_mfa_admin`)

Not enforceable at refresh without a live HA sign-in: the rule needs the HA user's MFA modules, which only the HA sign-in answer carries
(`ha_user_auth.HaUser.mfa`; Arx stores no copy). What holds: the mint requires a remote sign-in at most 15 minutes old, and that sign-in
already passed `policy_refusal` including the MFA rule; administrators are capped at 7 days / 24 h idle. Not covered: an administrator who
removes MFA at HA (or the rule switched on) after the mint keeps the family until the cap. **Left documented** (task rule: enforce only if
feasible without a live HA sign-in). Cheap follow-up candidate: when `remote.require_mfa_admin` is switched on, end the families of every
user holding an administrative permission (they re-mint through a sign-in that passes the rule).

### 13.8 Go state

- Lab: unchanged (LAB ONLY, section 12.1); mode `optional` lets the owner test keyed and keyless phones side by side.
- Customers: the device key is now built; preconditions remain - a security review of this slice and of the session exchange, the backend
  suite green on the integration head, migrations renumbered, the apps implementing the spec, and **mode `required`** on every customer
  installation.

### 13.9 Open questions

1. Attestation (Android Key Attestation / iOS App Attest) so the server knows the key is hardware-backed - proposed as `pop-v2`.
2. Access tokens stay bearer (minutes); sign every API call (DPoP) or only the session exchange? Decide with the session-exchange slice.
3. The MFA follow-up of 13.7 (end admin families when the rule is switched on) - owner decision.
4. Should the installation default move from `optional` to `required` once the app versions with the key are out (an upgrade step)?

## 14. Device-key pin and the administrator-approved reset (APPREFRESH3-295; built on `pilot/APPREFRESH3-295` from `pilot/APPREFRESH2B` 373c04c39)

### 14.1 The weakness closed

Section 13 / D-01 asked for the old key's proof only while the device had a LIVE keyed family. The key lived on the family row, so every
path that ended the family forgot it: re-registering the device (`device_reregistered`, which a signed-in session can trigger with the
same install id), deleting and re-adding it, an administrator's end, a refusal. The next mint - any fresh session of the user - could
then bind an attacker's key with no proof of possession of the old one.

### 14.2 Design

- **Pin** (migration 0158 PROVISIONAL, `app_refresh_device_keys`, one row per `mobile_devices.id`): the last key a mint bound; created /
  updated by every keyed mint, dropped by a keyless mint that was consented to, backfilled from the newest keyed family. The live keyed
  family stays authoritative if the two ever differ (logged). Never exported (`backup.NEVER_EXPORTED_TABLES`): a restore can neither drop
  a pin nor revive one. The janitor drops pins whose registration row is gone and clears lapsed approvals.
- **Mint rule (secure default):** a pinned device binds another key, or none, only with (1) `device_key.replaces` signed by the pinned key
  (wire format unchanged), (2) after the USER's own end of the old sign-in (owner decision Q296, 2026-10-23: the app's sign-out with its
  current token, "end this sign-in" or "sign out everywhere" on their own account - audited `auth.app_refresh.key_released`), or (3) a
  pending administrator-approved reset. Otherwise `409 device_key_bound`, audited, nothing ends.
- **Challenge:** a pinned device without a live keyed family gets a stored nonce in its pin scope (`app_refresh_nonces.family_id` =
  `dk:<device_id>`; no schema change), same answer shape, same rate limits (the scope is the bucket key). Such a nonce is accepted only
  as a `replaces` nonce of that device.
- **Reset (lost key):** `POST /auth/app/devices/{id}/key-reset {reason}` - a system administrator (`is_system_admin`, the same gate as the
  settings); an administrator's OWN device only from the local channel, so a stolen remote administrator session cannot re-key its own
  phone. Ends the live family (`device_key_reset`), drops pin-scope nonces, opens a **24 h** one-time window (`RESET_WINDOW_S`, a
  constant), audits `auth.app_refresh.key_reset_approved` (actor, device, user, note, 16-hex fingerprint prefix, channel, families ended,
  whether the notice was queued), and notifies the device's user. `DELETE` withdraws (audited `key_reset_withdrawn`); `GET .../key` shows
  the status without key material. The mint that spends the window writes `auth.app_refresh.key_replaced` with `via: "admin_reset"` and
  `approved_by`.
- **Notice** (owner decision Q297: in the app and on the phone): source `security.app_device_key_reset` (category security, severity
  alert, recipients `initiator` = the device's user, channels inbox + push + phone app by default, editable like every policy). Title and
  body come from the Settings (`security.app_refresh_key_reset_notice_title` <= 80, `_body` <= 180; plain text, placeholders `{device}`
  and `{until}` only, substituted by plain replacement - never `str.format`; `null` restores the default; `SETTINGS_KEEP`). The notice
  never names the administrator or the reason. A failure to queue it never undoes the reset (logged; `user_notified: false`).

### 14.3 Residual risk (recorded)

- Path (2) is the owner's choice: a fresh, stolen session of the user can still end the user's own sign-in and then bind a new key. It is
  audited (`key_released`) but not notified. Cheap follow-up candidate: notify the user on `key_released` too (same source pattern).
- Path (3) relies on the administrator verifying the request out of band; there is no in-app "request a reset" flow (not asked for).
- A new install id is a new device registration (no pin); that is session-bound device enrolment, out of this slice's scope.

### 14.4 Tests

`tests/test_app_refresh_keypin_295.py` (re-registration needs the old key; replayed and wrong-key consent; an administrator's end and a
deleted-and-re-added device keep the pin; the user's own end releases it; the lost-key reset end to end with the audit rows and the
notice; the wording from the Settings and its validation; who may approve; lapse and withdrawal; the status route; the pin fallback for a
family the backfill missed; backup and the janitor). `tests/test_app_refresh_devicekey_295.py`: the re-registration test now asserts the
new default.