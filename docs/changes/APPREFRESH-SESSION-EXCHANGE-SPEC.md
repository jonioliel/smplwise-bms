# APPREFRESH-SESSION-EXCHANGE-SPEC - The phone app's WebView session exchange (`POST /auth/app/session`)

> **DRAFT - NOT BUILT - needs security review.** Nothing in this document exists in code. No route, table, setting or cookie
> described here is implemented on any branch. Every rule below is a proposal until (1) the owner answers the questions of
> section 15, (2) the server slices of section 14 are built, and (3) a security review of the built surface is done.
> Activation (the switch ON on any installation) only after that review (owner decision 2026-10-24).

Contract draft for **mobile contract v2.2** (`docs/api/mobile-presence-contract.md` is at v2.1 today, PRESENCE307) and an
additive **revision 3** of `docs/changes/APPREFRESH-DEVICEKEY-SPEC.md` (one new signed purpose, `session`; nothing existing changes).
Branch of this document: `pilot/SESSIONEXCH217-295` from `origin/release/2160` (5b9b33fca). Design record of the feature:
`docs/changes/CR-APPREFRESH295.md` (section 9, slice 2 "proposed"; sections 12, 13 and 14 for the reviews, the device key and the pin).
Security reviews read: `private/planning/SECURITY_REVIEW_APPREFRESH_2026-10-23.md` (F-01 .. F-13) and
`private/planning/SECURITY_REVIEW_APPREFRESH2_2026-10-24.md` (D-01 .. D-12; go/no-go item 5 = this exchange).
Identity rules: `docs/security/HA_IDENTITY_RBAC_HE.md` section 11 (a known revoke blocks the next API request; open sessions,
media and subscriptions close within 30 s; an active-user refresh at most every 60 s).

Owner decision 2026-10-24: build the WebView session exchange with a security review before any activation; the apps keep the
feature behind a **build flag** until contract v2.2 is published.

The words MUST / MUST NOT / SHOULD are used in their RFC 2119 sense.

---

## 1. Purpose and the gap it closes

Today (code at 5b9b33fca) the app's saved sign-in (a refresh-token *family*) yields only a short access token (`arxa_`, default 10
minutes, `security.app_refresh_access_minutes`) whose single consumer is `GET /auth/app/whoami`
(`smplwise_vms/backend/smplwise/routers/app_refresh.py`, `whoami`). The web app the shell shows in its WebView authenticates with
the Arx session cookie (`__Secure-arx_session`, set by `POST /auth/session` in `routers/remote.py` for an HA sign-in, or by the
Arx-only sign-in in `services/local_identity.py`). So when the WebView's cookie is gone (OS cleared web storage, the HA sign-in aged
out, the shell was killed) the user types the password again even though the phone holds a live family. The CR describes this as
"Make the access token useful" (CR section 9, slice 2) and the second review lists it as customer precondition 5.

The exchange turns a **live access token of a live family**, plus (for a keyed family) a **device-key proof**, into a **new Arx
WebView session** that the shell places in the WebView's cookie store. The session is a new, persisted session kind, never longer
than the family, ended with it, and authorised live on every request like every other session.

Non-goals: signing every API call with the device key (DPoP; device-key spec 9.3 stays open), attestation (`arx-app-pop-v2`),
anything for a desktop browser, any change to the HA sign-in or the Arx-only sign-in.

## 2. What exists today that this builds on (code facts at 5b9b33fca)

| Fact | Where |
|---|---|
| Families, refresh / access tokens, every revocation hook, the remote-policy re-check at refresh and access use | `services/app_refresh.py` (`issue`, `refresh`, `resolve_access`, `_refusal`, `_remote_refusal`, `_anchor_revoked`, `_revoke`) |
| Access token = SHA-256 row in `app_access_tokens` (family, user, device, expiry); deleted with its family by `_revoke` | `migrations/0146_app_refresh_tokens.sql`; `services/app_refresh.py` `_mint_pair`, `_revoke` |
| A rotation keeps the previous access token for its minutes (review F-09, Info) | `services/app_refresh.py` `_mint_pair` deletes only expired ones |
| Device-key proof: ES256 over `arx-app-pop-v1` LF-joined lines, nonce from `POST /auth/app/refresh-challenge`, single use, 120 s, skew 300 s | `services/app_refresh_key.py` (`refresh_message`, `mint_message`, `replace_message`, `verify`, `NONCE_TTL_S`, `POP_SKEW_S`); `services/app_refresh.py` `_check_proof`, `_take_nonce`, `challenge` |
| Device-key pin and the administrator-approved reset | `services/app_refresh.py` (`pinned_key`, `release_pins`, `approve_key_reset`), `migrations/0158_app_refresh_device_key_pins.sql` |
| The public routes answer one 404 while the switch is off or on the local channel, before the body is read | `routers/app_refresh.py` `_public_guard` + `guarded_route` |
| Session cookie name and attributes: `__Secure-arx_session` (`arx_session` only outside the add-on over plain http), `HttpOnly`, `Secure`, `SameSite=Strict`, `Path=<remote_path>/` | `routers/remote.py` `create_session`; `services/ha_user_auth.py` `COOKIE_SECURE`, `cookie_name`, `session_id_of`; `services/local_identity.py` `cookie_header` |
| Cookie values are dispatched by prefix: `l.` = an Arx-only session, anything else = the in-memory HA session store | `services/ha_user_auth.py` `remote_principal`, `remote_principal_ws`, `holds_live_credential`, `logout` |
| HA sessions live in memory, carry the HA access token and are re-validated against HA every 60 s | `services/ha_user_auth.py` `RemoteSession`, `SessionStore`, `REVALIDATE_EVERY_S`, `STALE_AFTER_S` |
| Arx-only sessions are persisted (SHA-256 of the cookie in `auth_local_sessions`), cached 15 s, every revoke empties the cache; only users with `users.source = 'local'` resolve | `services/local_identity.py` `LocalSession`, `_Cache`, `CACHE_TTL_S`, `resolve`, `_usable` |
| A rotated cookie travels with the response that rotated it | `remote_channel.py` (`sw_local_set_cookie`), `services/local_identity.py` `queue_cookie` |
| CSRF rule for cookie-carrying state-changing requests (`Sec-Fetch-Site: same-origin`, else `Origin` = this host) | `remote_channel.py` `csrf_ok`, `csrf_reason` |
| The administrators' MFA rule needs `HaUser.mfa`, known only from a live HA sign-in | `services/ha_user_auth.py` `policy_refusal`; CR section 13.7 |
| Arx-only administrative permissions need a session whose sign-in showed the TOTP factor (`Principal.factor_ok`) | `rbac.py` `LOCAL_ADMIN_PERMISSIONS`, `local_factor_gate`, `authorize` |
| TFA2: a factor enabled / reset ends the user's device tokens and app families (`device_tokens_ended`) | `services/presence.py` `revoke_tokens`, `_end_app_sign_ins` |
| A session end revokes the actor's capture lease | `services/ha_user_auth.py` `_lease_session_ended`; `services/local_identity.py` `lease_hook` |
| Backup classification | `services/backup.py` `NEVER_EXPORTED_TABLES`, `SETTINGS_KEEP` |
| The app's user-agent mark | `services/presence.py` `APP_UA_MARK` (`SmplWiseArx/`) |

Gap that matters for the design: an HA user's existing session kind **cannot** be reused, because it needs a live HA access token
to exist and to be re-validated; the app holds none. An Arx-only session row cannot be reused as is either (`_usable` requires
`users.source = 'local'`). Hence a third session kind (section 6).

## 3. The flow (one exchange)

```
app (native HTTP client, no cookies)                       server (remote channel)
1  POST /auth/app/refresh-challenge {device_id}       ->   nonce n1                      (keyed family only)
2  POST /auth/app/refresh {refresh_token, ..., proof(n1)} -> new refresh token + access token A
3  POST /auth/app/refresh-challenge {device_id}       ->   nonce n2                      (keyed family only)
4  POST /auth/app/session  Authorization: Bearer A
       {device_id, install_id, proof(n2 over A)}       ->   200 {cookie {name, value, ...}, session {...}, user {...}}
5  app writes the cookie into the WebView cookie store, then loads / reloads the web app
```

Steps 1-2 are unchanged (CR section 4.2, device-key spec 5.3; single-flight, request timeout below 20 s). Step 4 spends the access
token A and the nonce n2. Steps 3-4 MAY follow any successful refresh while A is live; the app SHOULD refresh first when A has
less than 60 s left.

## 4. Request

```
POST /arx/api/v1/auth/app/session
Authorization: Bearer arxa_<43 base64url>
Content-Type: application/json
(no Cookie header; no Origin needed - the route takes no cookie)

{ "device_id":  "dev_<16 hex>",
  "install_id": "<the install id of the registration, 8-64 chars>",
  "proof": { "nonce": "arxn_<43 base64url>", "ts": 1900000003, "sig": "<base64url>" } }
```

| Field | Rule |
|---|---|
| `Authorization` | REQUIRED. A live access token of a live family. Any other credential (an HA token, a device token `arxd_`, a refresh token) -> `401 app_access_invalid`. |
| Cookies | The app MUST NOT send any. The server ignores every cookie on this route (it neither reads, rotates nor ends one): the route authenticates by the bearer token only, so it is outside the cookie CSRF rule. |
| `device_id`, `install_id` | REQUIRED, the same binding as refresh: they must equal the family's device and install hash (constant-time), else the family ends `binding_mismatch` (CR 4.2). Proposed: `device_id` with the pattern `^dev_[0-9a-f]{16}$` (review D-07 hardening, applied here from the start). |
| `proof` | REQUIRED when the family is keyed (`proof_required: true` in the last mint / refresh answer); ignored for a keyless family that the exchange mode admits (section 9). Strict JSON integer `ts` (review D-08: proposed `StrictInt` here). |
| Body size | at most 2 KiB (`extra="forbid"` models like `routers/app_refresh.py`). |

### 4.1 What is signed (purpose `session`, device-key spec revision 3)

Six lines joined by LF, UTF-8, no trailing LF - the same layout as device-key spec section 4:

```
arx-app-pop-v1
session
<device_id>
<nonce>
<ts>
<access_digest>
```

`<access_digest>` = base64url (no padding) of SHA-256 over the ASCII bytes of the access token sent in `Authorization`.
The nonce comes from the existing `POST /auth/app/refresh-challenge` (same scope: the device's live keyed family; same 120 s, single
use, same limits). A nonce is spent by whichever call presents it first (a refresh or an exchange); the purpose line keeps a
refresh signature from ever verifying as a session signature and back. Server helper to add: `session_message(device_id, nonce,
ts, access_token)` in `services/app_refresh_key.py`, pinned by a byte test like `test_the_signed_strings_are_exactly_the_documented_ones`.

Test vector (to be pinned by the server test when built):
`session_message("dev_a", "arxn_n", 1900000000, "arxa_t")` =
`arx-app-pop-v1\nsession\ndev_a\narxn_n\n1900000000\n` + base64url(SHA-256("arxa_t")).

## 5. Checks, in order (one write transaction)

Proposed order, mirroring `services/app_refresh.py` `refresh` so that every family-ending refusal is committed and audited:

1. Route guard (before the body is read): the exchange switch is not `off`, `security.app_refresh` is on, the request is on the
   remote channel - else the same `404 not_found` (PUB-07 pattern, `_public_guard`).
2. Per-client failure tier blocked -> `429` (shared `_Failures` of `services/app_refresh.py`, 20 / min per address, IPv6 per /64).
3. Access token: malformed / unknown / expired / spent -> `401 app_access_invalid`; counts on the client tier and (only for a token
   that resolves to no live family) the global tier (F-07 pattern). Nothing ends, nothing is audited.
4. Per-family exchange bucket (section 10) -> `429`.
5. Family live; binding (`device_id`, install hash) else end `binding_mismatch`; device live and still the user's and the same
   install else end `device_gone`; `_refusal` (user active, HA directory active, remote policy, wall user) else end with that reason;
   `_anchor_revoked` else end `sign_in_revoked`; absolute / idle expiry under the current settings else end `expired` / `idle`.
   These are exactly the refresh checks; a refusal answers `401 app_refresh_invalid` (or `401 app_refresh_expired`).
6. Exchange mode (section 9): a keyless family under `keyed_only` -> `403 app_session_key_required` (nothing ends: the family may
   still refresh under the device-key mode `optional`).
7. Device-key proof for a keyed family, as `_check_proof` does for refresh: no proof -> end `session_proof_missing`; nonce unknown /
   used / expired / of another family -> `401 app_refresh_proof_retry` (`reason = nonce`), nothing ends, the access token is NOT
   spent; signature invalid or by another key -> end `session_proof_invalid`; signature valid but `ts` outside +-300 s ->
   `401 app_refresh_proof_retry` (`reason = clock`, `server_time`), nothing spent.
8. Administrators' MFA rule (`remote.require_mfa_admin` = true): the user holds an administrative permission
   (`ha_user_auth.ADMIN_PERMISSIONS` for an HA user) and the family's recorded HA MFA flag (section 6.3) is not true ->
   `403 remote_mfa_required`, the family ends `mfa_required`. See section 13, contradiction 1.
9. Second-factor policy now (`second_factor.effective_policy`): an HA user whom the policy now requires to enrol and who has no factor
   -> `403 second_factor_enrollment_required`, nothing ends (the app shows the web sign-in, which leads to enrolment). An Arx-only
   user in the same state gets a gated session (gate `enrol`, `local_identity.ENROL_PATHS`), exactly as a fresh Arx-only sign-in would.
10. Spend: the access token row is deleted; the previous live web session of the family (if any) ends `replaced`; the new session row
    is written; the audit row `auth.app_session.created` is written.

## 6. The session that is created

### 6.1 Storage (one new table; migration needed - number assigned at the build task)

`app_web_sessions` (proposed columns): `sid_hash` (PK, SHA-256 of the cookie value, CHECK length 64), `family_id`, `user_id`,
`device_id`, `key_fp_prefix` (16 hex or NULL), `created_at`, `last_used_at`, `expires_at`, `idle_expires_at`, `factor_ok` (0/1, for an
Arx-only user, section 6.3), `perm_fingerprint`, `gate` (`""` | `enrol` | `change`), `ip_masked`, `user_agent` (200 chars),
`revoked_at`, `revoked_reason`. Indexes on `family_id`, `user_id`. In `backup.NEVER_EXPORTED_TABLES` (a restore can never revive one).
Additive; older code never reads it.

Family columns (same migration): `ha_mfa` (INTEGER NULL: 1 / 0 from the minting HA sign-in's `HaUser.mfa`, NULL for an Arx-only
family or a family minted before this migration) and `factor_at` (TEXT NULL: when the minting session had shown the Arx TOTP factor).

### 6.2 The cookie

| Attribute | Value |
|---|---|
| Name | the existing one: `__Secure-arx_session` (`ha_user_auth.cookie_name`; `arx_session` only outside the add-on over plain http) - the frontend, the CSRF middleware, the media and WebSocket readers work unchanged, as for USR2 |
| Value | `a.` + 43 base64url characters (256 random bits). The prefix `a.` is new and cannot collide: HA session ids are `token_urlsafe` (no `.`), Arx-only values start `l.` |
| `Path` | `<remote_path>/` |
| `HttpOnly`, `Secure`, `SameSite=Strict` | always (as `routers/remote.py` / `local_identity.cookie_header`) |
| `Domain` | none (host-only) |
| `Max-Age` | seconds until the session's absolute expiry (section 7) |

**Delivery:** the value travels in the response BODY (`cookie.value`) and NOT in a `Set-Cookie` header, so that a native HTTP
client's shared cookie jar never keeps a copy outside the WebView (see question 4 in section 15). The value is shown once and
stored only as SHA-256.

### 6.3 Who the session speaks for

- An HA user: `Principal(source="remote", via="cookie")` built from the `ha_users` / `users` directory rows (the same username /
  display-name rule as `ha_user_auth.build_principal`, without an `HaUser` object).
- An Arx-only user: `Principal(source="local", via="cookie", factor_ok=<family.factor_at is set and the user still has the factor>)`.
  Without `factor_ok` the administrative permissions are refused (`rbac.local_factor_gate`), fail closed.
- RBAC is read live on every request, as for every principal. A session never grants more than the user holds now.
- Duck-typed like `LocalSession` (`sid`, `sign_in()`, `via`, `user_id`, `chain_id`, `kind = "app"`), so `ha_user_auth.session_of`
  readers (the live-stream cap, the sessions list's current marker) work unchanged. `sign_in()` = `"f:" + family_id`.
- A web session is **not** a live session of its family's anchor: it never keeps an `s:`-anchored family alive
  (`app_refresh._anchor_revoked` counts only `ha_user_auth.STORE` sessions; this must stay so - no self-sustaining chain).

### 6.4 Resolution on every request

The resolver (new; dispatched on the `a.` prefix in `ha_user_auth.remote_principal`, `remote_principal_ws`,
`holds_live_credential` and `logout`) answers a principal only when: the session row is live and inside its absolute and idle
expiry; its family is live (`revoked_at IS NULL`); the user is active (Arx and the HA directory); `_refusal` passes; the device-key
mode does not refuse a keyless family (`required`). Cached at most 15 s like `local_identity._Cache`; every revocation path drops the
cache entry at once and closes the session's WebSockets (HA identity spec section 11: within 30 s). Touch (`last_used_at`, idle
slide) at most once a minute (`TOUCH_EVERY_S` pattern). A permission-fingerprint change rotates the cookie through the existing
`sw_local_set_cookie` path (`remote_channel.py`), as USR2 does. No age rotation (the lifetime is short, section 7).

The web session is used ONLY on the remote channel. A cookie with the `a.` prefix on the local channel is ignored (the local
channel authenticates by Ingress identity).

## 7. Lifetime and binding

| Rule | Proposed value |
|---|---|
| Absolute | `security.app_session_hours`, default **8**, range 1-24; never beyond the family's current absolute expiry or idle expiry at exchange (`min` of the three) |
| Idle | `security.app_session_idle_minutes`, default **60**, range 5-240, never above the absolute |
| Administrator (holds an administrative permission, also one gained later) | absolute at most **1 h**, idle at most **30 min** (re-evaluated per request, like USR2 Q3 in `local_identity.resolve`) |
| Live web sessions per family | **one**: a new exchange ends the previous (`replaced`) |
| Binding | to `family_id` (and so to the device registration, the install and - for a keyed family - the key that signed the exchange). Ends with the family, always |
| Not bound | to the client address (mobile addresses change) or the TLS channel. A copied cookie works from elsewhere until the session ends: residual R1, section 12 |
| Optional hardening (question 6) | refuse a web-session request whose user agent lacks `presence.APP_UA_MARK` (cheap noise signal, trivially forged) |

Using the web session does not slide the family's idle window; only a refresh does (CR 4.2 unchanged).

## 8. Single use and replay

- **Access token:** spent by a successful exchange (row deleted in the same transaction). Presented again -> `401
  app_access_invalid`, nothing ends (a lost answer is recovered by refresh + a new exchange; the new session replaces the lost one).
- **Nonce:** single use, consumed on presentation also when the proof is then refused (`_take_nonce` behaviour).
- **Proof:** binds device, nonce, time and the access token's digest; a captured exchange body cannot be replayed (nonce spent) nor
  re-targeted to another access token (digest) or device (device line).
- **Cookie value:** returned once; only its hash is stored; one live session per family.
- **Access tokens of earlier rotations:** while the exchange switch is not `off`, a rotation deletes the family's previous access
  tokens (review F-09) - so only the newest access token of a family can ever be exchanged.
- **Access-token lifetime bound:** while the exchange switch is not `off`, `security.app_refresh_access_minutes` is limited to 1-15
  (review section 4: "keep the upper bound at 15 min"); turning the exchange on with a stored value above 15 is `422 validation`.

## 9. Feature switch, modes and rollback

`security.app_session_exchange` (new, `SETTINGS_KEEP`, never exported or restored):

| Value | Meaning |
|---|---|
| `off` (**default**) | the route answers the uniform 404; every `a.` cookie resolves to nothing; switching to `off` ends every live web session (`feature_off`); families are untouched |
| `keyed_only` (recommended for any customer) | only a keyed family may exchange; a keyless one gets `403 app_session_key_required` |
| `allow_keyless` (lab only) | a keyless family may exchange too (only while the device-key mode is not `required`) |

- Raising strictness (`allow_keyless` -> `keyed_only` -> `off`) from either channel; weakening (anything -> `allow_keyless`, `off` ->
  anything) only from the local channel, by a system administrator (`403 local_channel_only`, audited) - the existing rule of
  `security.app_refresh` and `security.app_refresh_device_key` (CR 4.4, 13.4).
- Requires `security.app_refresh` = on; switching `security.app_refresh` off ends every family and with them every web session.
- Read / written through the existing `GET / PUT /auth/app/settings` (`routers/app_refresh.py` `get_settings`, `put_settings`;
  `services/app_refresh.py` `update_settings`, `SETTING_KEYS`). An unknown stored value reads as `off` (fails closed).
- **Rollback (older add-on version):** the table and the setting are ignored; an `a.` cookie is unknown to older code and falls through
  to the HA path, which answers `401 remote_login_required` -> the app shows the normal sign-in. Fails closed; no rollback SQL needed
  (contrast review D-04). On a later roll-forward a session still inside its expiry would resolve again only if its family is still
  live; proposed: the start-up janitor ends every web session created before the newest start of an older version (question 9).

## 10. Rate limits

| Limit | Proposed |
|---|---|
| Exchange per family | burst 5, 30 per hour (an app exchanges on a cold start or after a 401, not per request) |
| Unknown / spent / malformed access token | the existing per-client failure tier (20 / min per address, IPv6 per /64) and the global tier (300 / min) - the global tier never stops a token of a live family (F-07) |
| Nonce / clock retries | counted on the per-client tier; per family more than 5 retries in a minute writes one audit row `auth.app_session.proof_retry` per hour (review D-03 applied here) |
| Settings writes | the existing 20 / min |

`429 rate_limited` with `details.retry_after_s` (as `routers/app_refresh.py` `_too_many`).

## 11. Responses, error codes and what the app does

### 11.1 Success

```
200 { "session": { "id": "aps_<16 hex>", "expires_at": "...Z", "idle_expires_at": "...Z", "expires_in": 28800, "kind": "app" },
      "cookie":  { "name": "__Secure-arx_session", "value": "a.<43 base64url>", "path": "/arx/", "max_age": 28800,
                   "secure": true, "http_only": true, "same_site": "Strict" },
      "user":    { "id": "...", "username": "...", "display_name": "...", "source": "remote" | "local" },
      "family_id": "arf_...", "gate": "" }
```

`session.id` is a public id (a hash prefix, like `local_identity.public_id`), never the cookie value. `cookie.path` is the
installation's remote path; the example shows a typical value.

### 11.2 Errors

| Status / code | Meaning | App action |
|---|---|---|
| `404 not_found` | the server does not offer the exchange (switch off, older server, local channel) | keep today's behaviour: the WebView signs in itself. Do not retry until the next app start |
| `401 app_access_invalid` | access token unknown, expired or already spent | refresh (challenge -> sign -> refresh), then exchange again ONCE |
| `401 app_refresh_proof_retry` `reason = nonce` | nonce unknown / used / expired; nothing spent | new challenge, sign again, retry ONCE with the same access token |
| `401 app_refresh_proof_retry` `reason = clock` | signature valid, `ts` off by > 300 s; nonce spent, token not | new challenge, sign with `ts = server_time + elapsed`, retry ONCE |
| `401 app_refresh_invalid` | the saved sign-in ended (binding, device gone, user state, policy, anchor revoked, missing / invalid proof) | forget the refresh token AND delete the key pair (device-key spec 5.3), clear the WebView cookie, show the sign-in |
| `401 app_refresh_expired` | the family ran out | as `app_refresh_invalid` (key pair: keep - the pin rules of device-key spec 6a apply) |
| `403 app_session_key_required` | exchange mode `keyed_only`, keyless family | keep the family for presence; let the WebView sign in normally; a later mint with a key (a fresh sign-in) fixes it |
| `403 remote_mfa_required` | administrator without HA MFA while the rule is on; the family ended | show the web sign-in (HA will ask for MFA set-up) |
| `403 second_factor_enrollment_required` | an HA user must enrol a factor first | show the web sign-in; nothing ended |
| `403 remote_not_allowed` / `wall_user_remote_not_allowed` | (never as such: a policy refusal ends the family and answers `401 app_refresh_invalid`) | - |
| `422 validation` | malformed body | app bug; report; do not loop |
| `429 rate_limited` | a limit hit | wait `details.retry_after_s`; never in parallel |
| network error / 5xx | unknown outcome | the access token may be spent: refresh, then exchange again (the new session replaces a lost one) |

Single-flight (CR F-06) extends to the exchange: one refresh-or-exchange in flight per server at a time.

### 11.3 What the app does with the cookie (both platforms)

1. Delete any existing `__Secure-arx_session` / `arx_session` cookie for the server origin from the WebView store.
2. Write the new cookie into the WebView store only - Android `CookieManager.setCookie(<origin><path>, "<name>=<value>; Path=<path>;
   Max-Age=<max_age>; Secure; HttpOnly; SameSite=Strict")` then `flush()`; iOS `WKWebsiteDataStore.httpCookieStore.setCookie` with a
   host-only `HTTPCookie`. The exact host-only behaviour of `HTTPCookie` in `WKHTTPCookieStore` is UNKNOWN here and MUST be verified on
   a device.
3. The exchange request MUST use a client with no shared cookie storage (Android: an OkHttp client without a `CookieJar`; iOS: an
   ephemeral `URLSessionConfiguration` with `httpCookieStorage = nil`), never the WebView itself (the access token must never reach
   page JavaScript).
4. Never log, persist or back up the cookie value or the access token.
5. When the web app inside the WebView reports a signed-out / expired state (a 401 `remote_login_required`, or the bridge call of the
   frontend slice), refresh + exchange silently once; if that fails, show the sign-in.

## 12. Revocation and interactions

| Event | Effect on web sessions |
|---|---|
| Any family end (all of CR 4.3: device deleted / re-registered, TFA2 `device_tokens_ended`, sign out everywhere, administrator revoke, HA re-validation drop, Arx-only password change / revoke, remote flag removed, `feature_off`, reuse, proof failures, key reset `device_key_reset`) | every web session of the family ends at once (a hook in `app_refresh._revoke`, same transaction), cache dropped, WebSockets closed, capture lease ended (`session_ended`) |
| **TFA2** factor enabled / reset (`presence.revoke_tokens`) | the families end (`device_tokens_ended`), so the web sessions end; the next mint needs a fresh sign-in that shows the factor |
| Arx-only factor removed (`local_identity.on_factor_removed`) | the family's `factor_at` is cleared and the web sessions lose `factor_ok` at once (cache dropped) |
| **Device-key pin** (device-key spec 6a) | the exchange binds no key and never changes the pin. Ending a family through the exchange's refusals is not the user's own end and does not release the pin |
| Sign-out inside the WebView (`DELETE /auth/session`, `routers/remote.py`) with an `a.` cookie | proposed: ends the web session AND its family (`web_sign_out`), counted as the user's own end (releases the pin, Q296) - question 5 |
| `DELETE /auth/sessions` (sign out everywhere) | already ends the families (`revoke_user`) -> web sessions end |
| The sessions list (`GET /auth/sessions`) | proposed: one row per live web session, kind "app", device name; ending it ends the web session only (question 7) |
| User disabled / deleted (Arx or HA directory) | refused at the next request (cache <= 15 s) and the family ends at its next refresh / exchange |
| Permission change | live RBAC per request; the cookie rotates on a fingerprint change |
| `remote_access` add-on option off | the remote channel is gone; sessions unusable and lapse by time |
| Add-on restart | web sessions survive (persisted); `s:`-anchored families still end as today (CR 12, M-4) and take their web sessions with them |

### 12.1 Residual risks (recorded, for the security review)

- **R1 - cookie theft from the WebView.** The cookie is a bearer credential for its lifetime (8 h / 60 min idle by default; 1 h /
  30 min for administrators); it is not bound to the device key per request. Mitigations: HttpOnly, short lifetime, one per family,
  ends with the family, the lost-phone kill switch. Full binding would need DPoP-style signing of every request (device-key spec 9.3).
- **R2 - keyless families (`allow_keyless`).** A copied refresh token + install id yields web sessions from anywhere (first review
  2026-10-23, section 5). Lab only; customers use `keyed_only` with the device-key mode `required`.
- **R3 - HA-side changes invisible.** An HA password change or an MFA removal at HA after the mint is not seen (CR Q4, 13.7); the web
  session inherits that residual, bounded by the family's lifetime and the administrator caps.
- **R4 - no attestation.** A software key from a modified app passes (review D section 3).
- **R5 - a stolen fresh web session can mint a family** (as today for any session, CR T5); the exchange adds nothing to this path but
  makes its prize a durable web session - D-01 / the pin are the mitigation.

## 13. Contradictions recorded (not silently resolved)

1. **MFA rule at the exchange.** CR section 12 (F-01) says the administrators' MFA rule "is enforced at the slice 2 session
   exchange"; CR section 13.7 says it cannot be enforced without a live HA sign-in. Both are true of the code: the exchange has no HA
   sign-in either. Proposed resolution: record `HaUser.mfa` on the family at mint (`ha_mfa`, section 6.1) and check it at every
   exchange (section 5, step 8), plus the 13.7 follow-up (switching the rule on ends the administrators' families). It still cannot
   see an MFA removal at HA after the mint (R3).
2. **Which credential is exchanged.** CR section 9 says "a live access token"; the 24.10 task says "refresh/access token". This draft
   takes the access token (keeps the refresh token single-purpose and its rotation / grace logic untouched); a combined call is
   question 1.
3. **Contract numbering.** CR section 9 row 5 plans the contract text as "v2.1 of `mobile-presence-contract.md`", but v2.1 was taken by
   PRESENCE307. The exchange (and the refresh-token routes) become **v2.2**.
4. **Device-key spec 5.4** says the access token is "not signed in v1". It stays unsigned for API calls; the exchange signs over its
   digest under a new purpose line, an additive revision 3 of `arx-app-pop-v1`.
5. **Slice numbering** (already recorded in CR 13): the device key was built as "slice 2"; this exchange is CR section 9 slice 2.

## 14. Server implementation plan (short)

Migration: **yes, one file** (`app_web_sessions` + family columns `ha_mfa`, `factor_at`); number assigned by the lead at the build
task, contiguous, added to `tests/test_migrations.py`. No migration in this document's branch.

| Slice | Content | Files (existing unless marked new) | Tests |
|---|---|---|---|
| X1 core | the table; `session_message`; `POST /auth/app/session` (guarded, limits, checks of section 5); the session kind and its resolver dispatched on `a.`; revocation hook in `_revoke`; cache + WebSocket attach + capture-lease hook; janitor; settings key + validation + local-channel rule; audit; backup classification; `issue()` records `ha_mfa` / `factor_at` | `services/app_session.py` (new), `services/app_refresh.py`, `services/app_refresh_key.py`, `routers/app_refresh.py`, `services/ha_user_auth.py` (`remote_principal`, `remote_principal_ws`, `holds_live_credential`, `logout`), `services/local_identity.py` (`on_factor_removed` hook), `services/backup.py`, migration (new) | `tests/test_app_session_295.py` (new): switch off / local channel -> 404 before the body; success shape and cookie attributes; hash-only storage; access token spent once; proof missing / invalid ends, nonce / clock retry ends nothing; purpose separation (a refresh signature never verifies as session and back); binding / device / policy / anchor / expiry refusals; one session per family; every CR 4.3 path ends the web sessions; WebSocket closed on revoke; administrator caps; MFA rule; Arx-only `factor_ok`; gated session; limits; no token / cookie / nonce / key in any table, audit row or log; backup + migration |
| X2 hardening | access tokens deleted on rotation and the 15-minute bound while ON (F-09); the sessions-list row; `DELETE /auth/session` behaviour (question 5); D-03-style retry audit; the 13.7 follow-up | `services/app_refresh.py`, `routers/remote.py`, `services/ha_user_auth.py` (`describe`, sessions list) | extend the X1 file; `tests/test_remote_access.py` `PUBLIC_ON_REMOTE` gains the route |
| X3 inventory and docs | API inventory; CR-APPREFRESH295 section 9 status; contract v2.2 text; device-key spec rev 3 | `scripts/api_inventory.py` -> `contracts/API_INVENTORY.md`; `docs/api/mobile-presence-contract.md`; `docs/changes/APPREFRESH-DEVICEKEY-SPEC.md` | the inventory test |
| X4 security review | Fable review of X1 + X2 (the public route, the resolver, the revocation fan-out) before any switch ON | - | NOT_RUN until built |
| X5 frontend (separate task) | the bridge hook that tells the shell the web session ended (mobile v5 review section 4: `signedIn` / `signedOut`) | `frontend/src/arx/android-app.ts`, `frontend/src/arx/auth.ts` | vitest of those files |

Activation sequence (lab): X1 + X2 built and their tests green on the integration head -> X4 review -> owner switches
`security.app_session_exchange` to `keyed_only` from the local channel on his installation -> one keyed phone with the build flag ON ->
exchange, revoke from "sign out everywhere", confirm the WebView is signed out within 30 s and the audit rows.

## 15. Open questions for the owner (plain wording)

1. **One call or two?** Should the phone get its web session in the same call that renews the saved sign-in (one round trip fewer),
   or in a separate call right after it (simpler, keeps the renewal logic untouched)?
   a. separate call (recommended) b. one combined call
2. **How long may a web session live inside the app?** a. 8 hours, 60 minutes idle (recommended) b. a full day c. only 1 hour, then
   the app silently gets a new one
3. **Administrators in the app:** a. 1 hour, 30 minutes idle (recommended) b. the same as everyone c. no web session for
   administrators through the saved sign-in at all (they type the password)
4. **How the cookie reaches the app:** a. in the answer body only, so it never lands in a shared cookie store (recommended) b. as a
   normal cookie header
5. **Sign-out button inside the app's web screen:** should it also end the saved sign-in of that phone (so the next start asks for the
   password)? a. yes, and it counts as the user's own sign-out (recommended) b. no, it ends only the web screen's session
6. **Phones without the hardware security key:** may they use this in your lab? a. yes in the lab, never for customers
   (recommended) b. never, not even in the lab
7. **The sessions list in "My account":** should the app's web session appear there as its own row ("app on <phone>")? a. yes
   (recommended) b. no, only in the saved sign-ins list
8. **Administrators' MFA rule:** when "require MFA for administrators" is switched on, end the saved sign-ins of every administrator
   at once (they sign in again through a sign-in that checks MFA)? a. yes (recommended) b. no, only check at each web-session request
9. **After a roll-back and a later upgrade:** end every app web session that was issued before the roll-back? a. yes (recommended)
   b. no, let them run out
10. **Extra check that the request comes from the app's own browser screen** (a weak but cheap signal): a. add it (recommended)
    b. skip it

## 16. Not covered by this draft (named, not claimed)

Attestation; signing every API call; desktop browsers; push / presence behaviour; the app code itself; whether the iOS
host-only cookie behaviour holds (UNKNOWN, device test needed); performance of the resolver under many phones (one indexed read per
request after the 15 s cache, like USR2 - not measured). Nothing here was run or tested: every test above is NOT_RUN.

Nothing in this document contains token material, key material, nonces, hostnames, addresses or credentials.
