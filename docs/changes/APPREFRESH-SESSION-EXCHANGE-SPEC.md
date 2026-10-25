# APPREFRESH-SESSION-EXCHANGE-SPEC - The phone app's WebView session: one-time code exchange (`POST /auth/app/session` + `GET /auth/app/session/redeem`)

> **Revision 3 (2026-10-24) - BUILT on `pilot/SESSIONEXCH2-295` (the spec was fixed first, owner decision 428), OFF by default, NOT ACTIVATED.** Revision 2.2 (`998f2a756`,
> "DRAFT - NOT BUILT") was reviewed in `private/planning/SECURITY_REVIEW_SESSIONEXCH217_2026-10-24.md` (S-01 .. S-16). This revision
> applies the owner decisions of 2026-10-24 (answers 427-432, section 0) and the review's four medium findings (S-01 .. S-04,
> section 17), and describes the server side as built. The switch `security.app_session_exchange` stays `off` on every installation
> until (1) the security review of the BUILT code (section 14, X4) is done and (2) the device tests of section 16 have run on a real
> phone. Nothing here is live or installed.

Contract for **mobile contract v2.2** (`docs/api/mobile-presence-contract.md` is at v2.1, PRESENCE307) and an additive **revision 3**
of `docs/changes/APPREFRESH-DEVICEKEY-SPEC.md` (one new signed purpose, `session`). The app-team summary is
`private/handoff-package/SESSIONEXCH_CLIENT_CONTRACT_2026-10-24.md`. Design record: `docs/changes/CR-APPREFRESH295.md` (section 9,
slice 2). Earlier reviews: `SECURITY_REVIEW_APPREFRESH_2026-10-23.md` (F-01 .. F-13), `SECURITY_REVIEW_APPREFRESH2_2026-10-24.md`
(D-01 .. D-12). Identity rules: `docs/security/HA_IDENTITY_RBAC_HE.md` section 11.

The words MUST / MUST NOT / SHOULD are used in their RFC 2119 sense.

---

## 0. Owner decisions applied (2026-10-24)

| # | Decision | Where in this document |
|---|---|---|
| 427 (a) | Build now, **OFF by default**. The saved sign-in keeps the durations approved on 2026-10-23: **90 days absolute, 30 days idle** (`security.app_refresh_absolute_days` / `_idle_days`, unchanged) | 9, 7 |
| 428 (b) | Fix the review's four medium findings in the spec first, then build | 17 (S-01 .. S-04), 5, 6.4, 12 |
| 429 (c) | The server sets the cookie through a **one-time code**: the app obtains a short-lived single-use code, the WebView redeems it at the server, the server sets the cookie. Supersedes answer 393 ("cookie in the response body") | 3, 4, 5, 6.2 |
| 430 (d) | **No option for phones without a device key** (no downgrade path, also not for the lab or customers). The mode `allow_keyless` is gone; answer 395 is superseded | 5 step 6, 9 |
| 431 (e) | Web session: **one hour, renewed automatically while in use, at most 7 days** | 7 |
| 432 (f) | **No** user-agent ("is it the app's web view") check. Answer 399 is superseded | 7 |

Earlier answers that still hold: 390 (a separate call, after the refresh), 392 (administrators 1 h / 30 min idle), 394 (the sign-out
inside the web screen ends the saved sign-in too, as the user's own end), 396 (the app connection is its own row in "my account"
connections), 397 (when "administrators need MFA" is switched on, saved sign-ins are not ended; the rule is checked on every request),
398 (after a rollback and re-upgrade, app web sessions created before it end - implemented as "every app web session ends at every
start-up", section 9). Answer 391's "never expires" option is superseded by 431.

## 1. Purpose

The app's saved sign-in (a refresh-token *family*) yields a short access token (`arxa_`) whose only consumer was
`GET /auth/app/whoami`. The web app inside the shell's WebView authenticates with the Arx session cookie. When the WebView's cookie is
gone (the OS cleared web storage, the shell was killed, the session ran out) the user had to type the password again although the
phone holds a live family. The exchange turns a **live access token of a live, keyed family plus a device-key proof** into a
**one-time code**, and the WebView turns the code into a **new Arx WebView session** whose cookie the SERVER sets.

Non-goals: signing every API call (DPoP), attestation, desktop browsers, any change to the HA sign-in or the Arx-only sign-in.

## 2. Code facts it builds on

Unchanged from revision 2.2 (`services/app_refresh.py`, `services/app_refresh_key.py`, `routers/app_refresh.py`,
`services/ha_user_auth.py`, `services/local_identity.py`, `remote_channel.py`, `routers/remote.py`, migrations 0146 / 0157 / 0158);
the review's section 0 verified them. New code: `services/app_session.py`, migration `0174_app_web_sessions.sql`.

## 3. The flow

```
app (native HTTP client, NO cookie store)                       server (remote channel)
1  POST /auth/app/refresh-challenge {device_id}            ->   nonce n1
2  POST /auth/app/refresh {refresh_token, ..., proof(n1)}  ->   new refresh token + access token A
3  POST /auth/app/refresh-challenge {device_id}            ->   nonce n2
4  POST /auth/app/session   Authorization: Bearer A
       {device_id, install_id, proof(n2 over A)}           ->   200 {code: "arxc_...", expires_in: 60, redeem_path: "/arx/api/v1/auth/app/session/redeem"}
WebView (the app's web view, its own cookie store)
5  GET <origin><redeem_path>?code=arxc_...                 ->   303 Location: <remote_path>/   Set-Cookie: __Secure-arx_session=a.<...>; HttpOnly; Secure; SameSite=Strict; Path=<remote_path>/; Max-Age=...
6  the web app loads with its cookie
```

Steps 1-2 are unchanged. Step 4 does NOT spend the access token (section 8, review S-07 option 1): the nonce is the replay guard and
every exchange needs a fresh device-key signature. Step 5 is a top-level navigation of the WebView (Android `WebView.loadUrl`, iOS
`WKWebView.load(URLRequest)`), never a fetch from page JavaScript and never the native client.

## 4. The exchange request

```
POST /arx/api/v1/auth/app/session
Authorization: Bearer arxa_<43 base64url>
Content-Type: application/json
(no Cookie header)

{ "device_id":  "dev_<16 hex>",
  "install_id": "<the install id of the registration, 8-64 chars>",
  "proof": { "nonce": "arxn_<43 base64url>", "ts": 1900000003, "sig": "<base64url>" } }
```

| Field | Rule |
|---|---|
| `Authorization` | REQUIRED. A live access token of a live family. Anything else -> `401 app_access_invalid`. |
| Cookies | The app MUST NOT send any. **A POST that carries the session cookie is refused by the remote channel (`403 csrf_refused`) unless it also proves its origin; the route itself never reads, touches, rotates or ends a cookie** (review S-06). |
| `device_id` | REQUIRED, pattern `^dev_[0-9a-f]{16}$` (else `422`); must equal the family's device, else the family ends `binding_mismatch`. |
| `install_id` | REQUIRED, 8-64 characters; its hash must equal the family's install hash (constant time), else the family ends `binding_mismatch`. |
| `proof` | REQUIRED (every family that may exchange is keyed, decision 430). `ts` is a strict JSON integer (`StrictInt`; `"1900000003"` or `true` is `422`). |
| Body | `extra="forbid"`; at most the channel's anonymous body cap. |

### 4.1 What is signed (purpose `session`, device-key spec revision 3)

Six lines joined by LF, UTF-8, no trailing LF:

```
arx-app-pop-v1
session
<device_id>
<nonce>
<ts>
<access_digest>
```

`<access_digest>` = base64url (no padding) of SHA-256 over the ASCII bytes of the access token sent in `Authorization`. The nonce comes
from `POST /auth/app/refresh-challenge` (scope: the device's live keyed family; 120 s; single use). A nonce is spent by whichever call
presents it first; the purpose line keeps a refresh signature from verifying as a session signature and back. Server helper:
`app_refresh_key.session_message(device_id, nonce, ts, access_token)`, pinned by a byte test.

Test vector: `session_message("dev_a", "arxn_n", 1900000000, "arxa_t")` =
`arx-app-pop-v1\nsession\ndev_a\narxn_n\n1900000000\n` + base64url(SHA-256("arxa_t")).

## 5. Exchange checks, in order (one write transaction; every family-ending refusal is committed and audited)

1. Route guard, before the body is read: `security.app_session_exchange = on`, `security.app_refresh = on`, the remote channel - else
   the uniform `404 not_found` (PUB-07 pattern).
2. Per-client failure tier (20 / min per address, IPv6 per /64) -> `429`.
3. Access token unknown / malformed / expired / of an ended family -> `401 app_access_invalid` (counts on the client tier; on the global
   tier only when it names no live family, F-07). Nothing ends, nothing is audited.
4. Per-family exchange bucket (burst 5, 30 per hour) -> `429`.
5. Family checks, exactly those of a refresh: binding -> end `binding_mismatch`; device gone / re-registered -> end `device_gone`;
   user / HA directory / remote policy / wall user (`_refusal`) -> end with that reason; anchor revoked -> end `sign_in_revoked`
   (answer `401 app_refresh_invalid`); absolute / idle expiry under the current settings -> end `expired` / `idle` (answer
   `401 app_refresh_expired`).
6. **A keyless family -> `403 app_session_key_required`, nothing ends** (decision 430: no keyless exchange, no setting can allow one).
7. Device-key proof: missing -> end `session_proof_missing`; nonce unknown / used / expired / of another family -> `401
   app_refresh_proof_retry` (`reason: nonce`), nothing ends; signature invalid or by another key -> end `session_proof_invalid`;
   valid but `ts` outside +-300 s -> `401 app_refresh_proof_retry` (`reason: clock`, `server_time`).
8. Administrators' MFA rule (`remote.require_mfa_admin = true`), an HA user holding an administrative permission
   (`ha_user_auth.ADMIN_PERMISSIONS`) whose family's recorded HA MFA flag (`ha_mfa`, recorded at mint) is not 1 -> `403
   remote_mfa_required`, **nothing ends** (decision 397). The same rule is re-checked on every web-session request (section 6.4).
9. Second-factor policy now: an HA user whom the policy requires to enrol and who has no factor -> `403
   second_factor_enrollment_required`, nothing ends. An Arx-only user in that state gets a gated web session (`enrol`), exactly as a
   fresh Arx-only sign-in would.
10. Issue the code: every unredeemed code of the family is withdrawn (one outstanding code per family); a new code row is written
    (section 6.1); audit `auth.app_session.code_issued`. The access token is NOT spent.

Answer `200 {"code": "arxc_<43>", "expires_in": 60, "expires_at": "...Z", "redeem_path": "<remote_path>/api/v1/auth/app/session/redeem"}`.

## 5a. The redeem (the WebView's navigation)

```
GET /arx/api/v1/auth/app/session/redeem?code=arxc_<43 base64url>
```

1. Route guard: as step 1 of section 5 (the uniform 404).
2. Per-client failure tier -> `429`.
3. **Cross-site refusal (login CSRF / session fixation):** a `Sec-Fetch-Site` header other than `none` or `same-origin` -> refused
   (`cross_site`). A page elsewhere cannot make a browser adopt an attacker's session. (A WebView that sends no fetch metadata is
   admitted; see residual R6.)
4. Code unknown / malformed -> refused (`invalid`). Code already used -> refused, audited `auth.app_session.code_replayed`. Code
   expired -> refused (`expired`), the row marked used.
5. **The code is spent here (single use), before any further check** - also when a later check refuses it.
6. **Origin binding:** SHA-256 of the redeem request's `<scheme>://<host><remote_path>/` must equal the one recorded at the exchange
   (constant time), else refused (`origin_mismatch`), audited.
7. **Device-key binding:** the family is still live and still holds the key (fingerprint) that signed the exchange, else refused
   (`key_changed` / `family_ended`), audited.
8. The family / user / policy / anchor / expiry / administrators' MFA checks of section 6.4 -> refused with the reason, audited.
9. Create the web session (section 6): the previous live web session of the family ends `replaced`; audit `auth.app_session.created`.

Success: `303 See Other`, `Location: <remote_path>/`, `Set-Cookie` with the server's own attributes (section 6.2),
`Cache-Control: no-store` (the remote channel's own `Referrer-Policy: same-origin` applies, so the redeem URL never travels as a referrer to another origin). Any refusal: `303`, `Location: <remote_path>/?app_session=failed`, no
cookie (the web app then shows its normal sign-in; the reason is in the audit, never in the URL). The code never appears in a log:
the access-log line of this path is redacted (`code=REDACTED`).

## 6. The session that is created

### 6.1 Storage (migration 0174)

`app_session_codes`: `code_hash` (PK, SHA-256 hex), `family_id`, `user_id`, `device_id`, `key_fp` (the family key's full SHA-256
fingerprint at the exchange), `origin_hash` (SHA-256 of `<scheme>://<host><remote_path>/`), `created_at`, `expires_at` (+60 s),
`used_at`, `used_reason`.

`app_web_sessions`: `sid_hash` (PK, SHA-256 of the cookie value), `public_id` (20 hex, the sessions list id), `family_id`, `user_id`,
`device_id`, `key_fp`, `created_at`, `last_used_at`, `expires_at`, `idle_expires_at`, `perm_fingerprint`, `ip_masked`, `user_agent`
(200 chars), `revoked_at`, `revoked_reason`.

Family columns: `ha_mfa` (1 / 0 from the minting HA sign-in's `HaUser.mfa`; NULL for an Arx-only family or one minted before 0174 -
fails closed under the MFA rule) and `factor_at` (when the minting Arx-only session had shown the factor).

Both tables are in `backup.NEVER_EXPORTED_TABLES`; the three new settings are `SETTINGS_KEEP`. Additive; older code never reads them.

### 6.2 The cookie (set by the server at the redeem)

| Attribute | Value |
|---|---|
| Name | `__Secure-arx_session` (`ha_user_auth.cookie_name`; `arx_session` only outside the add-on over plain http) - derived from the request, never a constant (S-13) |
| Value | `a.` + 43 base64url characters (256 random bits); only its SHA-256 is stored |
| `Path` | `<remote_path>/` |
| `HttpOnly`, `SameSite=Strict`, `Secure` (with the `__Secure-` name) | always - set by the server, so they hold on both platforms (S-05 resolved) |
| `Domain` | none (host-only) |
| `Max-Age` | seconds until the session's absolute expiry |

The cookie value never leaves the server-to-WebView channel: the native client never sees it, page JavaScript cannot read it.

### 6.3 Who the session speaks for

- An HA user: `Principal(source="remote", via="cookie")` from the directory rows (username / display name as `build_principal`).
- An Arx-only user: `Principal(source="local", via="cookie", factor_ok = family.factor_at is set AND the user still has a factor)`.
- RBAC is read live on every request. A session never grants more than the user holds now.
- The session object (`app_session.AppWebSession`, `kind = "app"`) is duck-typed for `ha_user_auth.session_of` readers (the
  live-stream cap, the sessions list's current marker). `sign_in()` = `"a:" + public_id`. It has no `chain_id` and no `iss_hash`.
- **A web session never mints a family and never anchors one** (S-01): `POST /auth/app/refresh-tokens` from an app web session is
  refused `403 sign_in_not_anchorable` (audited `auth.app_refresh.issue` denied, reason `web_session`) before the pin, the replace
  logic and `revoke_device` run - the phone's live family is untouched. `session_anchor` is never computed from an `a.` session.

### 6.4 Resolution on every request (S-03, S-09)

Dispatched on the `a.` prefix in `ha_user_auth.remote_principal`, `remote_principal_ws`, `holds_live_credential` and `logout`. On every
cache miss (cache at most 15 s) both switches are read (`security.app_refresh = on` AND `security.app_session_exchange = on`, else
nothing resolves) and the session answers a principal only when ALL of these hold:

- the row is live and `now < min(expires_at, created_at + current absolute cap)` and `now < min(idle_expires_at, last_used_at + current
  idle cap)` (the administrator caps of section 7 apply at once, also for a permission gained later);
- its family is live AND inside its absolute / idle expiry under the CURRENT settings (the refresh's own formula) AND
  `not _anchor_revoked(family)` (an `s:`-anchored family whose HA sign-in is gone ends its web session now, not at its next refresh);
- the family still holds the key that signed the exchange; the device registration is live and still the user's;
- `_refusal` passes (user active in Arx and the HA directory, remote policy, wall user);
- the administrators' MFA rule (section 5 step 8) passes;
- the user's permission fingerprint equals the one recorded at creation (a change ends the session `permissions`; the app re-exchanges
  silently once - section 11.3).

A session that fails ends (`revoked_at`, the reason), its cache entry is dropped, its WebSockets close and the user's capture lease
ends (`session_ended`). Use slides the idle window (written at most once a minute) but never beyond the absolute expiry. The family's
idle window is not slid by web use (only a refresh slides it). The janitor also ends web sessions whose family ended or ran out (a sweep
for a missed fan-out, S-09).

The web session is used ONLY on the remote channel; an `a.` cookie on the local channel is ignored (Ingress identity).

## 7. Lifetime and binding (decisions 427, 431, 392, 432)

| Rule | Value |
|---|---|
| Saved sign-in (family) | unchanged: 90 days absolute, 30 days idle (administrators 7 days / 24 h), settings of 2026-10-23 |
| Web session idle | `security.app_session_idle_minutes`, default **60**, range 5-60: one hour without use ends it |
| Web session absolute | `security.app_session_max_days`, default **7**, range 1-7: renewed automatically by use (the idle window slides) up to 7 days from the redeem, never beyond the family's current absolute / idle expiry at creation |
| Administrator (holds an administrative permission, also one gained later) | absolute **1 h**, idle **30 min** (constants), re-evaluated per request |
| Live web sessions per family | **one**: a redeem ends the previous (`replaced`) |
| One-time code | 60 s, single use, one outstanding per family, bound to the family, its key and the origin |
| Binding | the family (so the device registration, the install and the key). Ends with the family, always |
| Not bound | the client address, the TLS channel, the user agent (decision 432: no web-view check) - residual R1 |

After 7 days the app silently performs a new exchange (a fresh device-key signature), which is the "automatic renewal".

## 8. Single use and replay

- **Code:** single use (spent at the first redeem, also when refused), 60 s, hash only at rest, one outstanding per family; a replay is
  refused and audited.
- **Nonce:** single use, consumed on presentation also when the proof is then refused.
- **Proof:** binds device, nonce, time and the access token's digest.
- **Access token:** NOT spent by the exchange (review S-07, option 1): every exchange needs a fresh nonce and a fresh device-key
  signature, so a captured access token alone exchanges nothing; `whoami` keeps working after an exchange (no refresh loop).
- **Access tokens of earlier rotations (S-02, F-09 moved into the build):** while the exchange switch is `on`, a rotation deletes ALL
  previous access tokens of the family - only the newest one can ever be exchanged.
- **Access-token lifetime bound (S-02):** while the exchange switch is `on`, `security.app_refresh_access_minutes` is limited to 1-15;
  turning the exchange on with a stored value above 15, or raising it above 15 while on, is `422 validation`.
- **Cookie value:** shown to nobody but the WebView; only its hash is stored.

## 9. Feature switch and rollback

`security.app_session_exchange` = `off` (**default**) | `on`. There is no keyless mode (decision 430). An unknown stored value reads
as `off`.

- `off`: both routes answer the uniform 404; no `a.` cookie resolves; switching to `off` ends every live web session (`feature_off`)
  and withdraws every unredeemed code. Families are untouched.
- Switching ON only from the local channel by a system administrator (`403 local_channel_only`, audited); OFF from either channel.
  Turning it on needs `security.app_refresh = on` (else `422`); switching `security.app_refresh` off ends every family and with them
  every web session.
- Read / written through `GET / PUT /auth/app/settings` with the other app-refresh settings.
- **Start-up (decision 398, S-03):** every live web session ends (`restart`) and every unredeemed code is withdrawn at every start of
  the add-on. This covers a rollback followed by a re-upgrade (nothing issued before the restart survives it) and the `s:`-anchored
  families whose HA sign-in did not survive the restart. The app re-exchanges silently once.
- **Rollback to an older version:** the tables and settings are ignored; an `a.` cookie is unknown to older code and falls through to
  `401 remote_login_required`. Fails closed; no rollback SQL.

## 10. Rate limits

| Limit | Value |
|---|---|
| Exchange per family | burst 5, 30 per hour |
| Unknown / malformed access token, unknown code, cross-site redeem | the per-client failure tier (20 / min per address, IPv6 /64) and the global tier (300 / min, never for a live family's token) |
| Nonce / clock retries | the per-client tier |
| Settings writes | the existing 20 / min |

`429 rate_limited` with `details.retry_after_s`.

## 11. Responses, error codes and what the app does

### 11.1 Exchange success

`200 {"code": "arxc_...", "expires_in": 60, "expires_at": "...Z", "redeem_path": "/arx/api/v1/auth/app/session/redeem"}`.
The app navigates its WebView to `<the server origin it called><redeem_path>?code=<code>` at once.

### 11.2 Exchange errors

| Status / code | Meaning | App action |
|---|---|---|
| `404 not_found` | the server does not offer the exchange (switch off, older server, local channel) | keep today's behaviour (the WebView signs in itself); do not retry until the next app start |
| `401 app_access_invalid` | access token unknown / expired | refresh (challenge -> sign -> refresh), then exchange again ONCE |
| `401 app_refresh_proof_retry` `reason: nonce` | nonce unknown / used / expired | new challenge, sign again, retry ONCE |
| `401 app_refresh_proof_retry` `reason: clock` | `ts` off by more than 300 s | new challenge, sign with `ts = server_time + elapsed`, retry ONCE |
| `401 app_refresh_invalid` | the saved sign-in ended (binding, device, user, policy, anchor, missing / invalid proof) | forget the refresh token AND delete the key pair, clear the WebView cookie, show the sign-in |
| `401 app_refresh_expired` | the family ran out | as above (keep the key pair) |
| `403 app_session_key_required` | a keyless family (a slice-1 app) | keep the family for presence; the WebView signs in normally; a fresh sign-in that binds a key fixes it |
| `403 remote_mfa_required` | administrator without HA MFA while the rule is on; nothing ended | show the web sign-in |
| `403 second_factor_enrollment_required` | an HA user must enrol a factor first; nothing ended | show the web sign-in |
| `422 validation` | malformed body | app bug; report; do not loop |
| `429 rate_limited` | a limit hit | wait `details.retry_after_s`; never in parallel |
| network error / 5xx | unknown outcome | a new challenge and exchange (an unredeemed earlier code is withdrawn by the new one) |

### 11.3 The redeem and the WebView (both platforms)

1. The exchange uses the native client with **no cookie store** (OkHttp without `CookieJar`; iOS ephemeral `URLSessionConfiguration`
   with `httpCookieStorage = nil`). The access token never reaches the WebView or page JavaScript.
2. The WebView performs a top-level GET navigation to the redeem URL. The app does NOT write any cookie itself.
3. Success = the WebView lands on `<remote_path>/` (the web app) signed in. `?app_session=failed` in the landing URL = refused; the
   web app shows its sign-in; the app SHOULD NOT loop (at most one silent exchange per app start per family).
4. Never log, persist or back up the code, the access token or the cookie.
5. When the web app reports a signed-out state (`401 remote_login_required`, or the bridge call of the frontend slice), the app MAY
   refresh + exchange + redeem silently **once per app start per family** (review S-04: a counter, not a loop); if that fails, the
   WebView shows the sign-in.

## 12. Revocation and interactions

| Event | Effect on web sessions |
|---|---|
| Any family end (CR 4.3: device deleted / re-registered, TFA2 `device_tokens_ended`, sign out everywhere, administrator revoke, HA re-validation drop, Arx-only password change / revoke, remote flag removed, `feature_off`, reuse, proof failures, key reset) | every web session of the family ends in the same transaction (inside `app_refresh._revoke` itself, not a best-effort hook), its unredeemed codes are withdrawn, the cache dropped, the WebSockets closed, the capture lease ended |
| TFA2 factor enabled / reset | the families end, so the web sessions end |
| Arx-only factor removed | `factor_ok` is recomputed live (cache dropped at once) |
| Device-key pin | the exchange binds no key and never changes the pin; a family ended by the exchange's refusals does not release the pin |
| Sign-out inside the WebView (`DELETE /auth/session`) with an `a.` cookie | ends the web session AND its family (`web_sign_out`), counted as the user's own end: releases the pin (Q296) (decision 394) |
| `DELETE /auth/sessions` (sign out everywhere) | ends the families (`revoke_user`) -> the web sessions end |
| **The sessions list (`GET /auth/sessions`)** (decision 396, S-04) | one row per live web session: `kind: "app"`, the device name, `saved_sign_in: true`. **Ending that row (`DELETE /auth/sessions/{id}`) ends its FAMILY** (`revoked_by_user` / `revoked_by_admin`, exactly like `DELETE /auth/app/families/{id}`; the user's own end releases the pin). The app therefore cannot silently re-create it: the next exchange answers `401 app_access_invalid` / `app_refresh_invalid` |
| User disabled / deleted, remote flag removed | refused at the next request (cache <= 15 s); the family ends at its next refresh / exchange |
| Permission change | the web session ends `permissions` at the next request; the app re-exchanges once |
| `s:`-anchored family whose HA sign-in is gone | the web session ends at its next request (S-03), not lazily at the next refresh |
| Add-on restart | every web session ends (`restart`) |

### 12.1 Residual risks (recorded)

- **R1 - cookie theft from the WebView.** The cookie is a bearer credential for at most 1 h idle / 7 days (1 h for administrators);
  HttpOnly is guaranteed by the server; not bound per request to the device key (DPoP would be needed).
- **R2 - removed** (no keyless exchange, decision 430).
- **R3 - HA-side changes invisible.** An HA password change or MFA removal after the mint is not seen (`ha_mfa` is the value at mint).
- **R4 - no attestation.** A software key from a modified app passes.
- **R5 - a stolen fresh web session (of any kind) can mint a family** (CR T5); an APP web session cannot (S-01).
- **R6 - a code leaked within its 60 s** (a screen recorder, a hostile keyboard, a WebView history dump before use) yields one web
  session from anywhere; it is single use, origin-bound and the legitimate redeem then fails visibly (`?app_session=failed`).
  A WebView without fetch metadata is admitted by the cross-site rule.
- **R7 - cache window (S-16).** A revocation drops the cache entry inside its transaction; a concurrent request between the UPDATE and
  the commit may re-cache the live row for up to 15 s (the same window as USR2; HA identity spec 11 allows 30 s).

## 13. Contradictions recorded

1. **MFA rule at the exchange.** Resolved by decision 397: `ha_mfa` is recorded at mint and checked at the exchange, the redeem and on
   every web-session request; switching the rule on ends nothing. It still cannot see an MFA removal at HA after the mint (R3).
2. **Cookie delivery.** Answer 393 (body) is superseded by 429 (one-time code, the server sets the cookie).
3. **Keyless phones.** Answer 395 (lab / customer setting) is superseded by 430 (none).
4. **Web-view check.** Answer 399 is superseded by 432 (none).
5. **Lifetime.** Answer 391 (8 h / 60 min, optional "never") is superseded by 431 (1 h renewed to 7 days).
6. **Contract numbering.** The exchange and the refresh-token routes are contract **v2.2** (v2.1 was taken by PRESENCE307).
7. **Permission change.** Revision 2.2 proposed rotating the cookie on a permission-fingerprint change; the build ENDS the session
   instead (the app re-exchanges once). Simpler, and a privilege change never keeps a cookie value.

## 14. Server implementation (as built) and what remains

Migration **0174** (`app_session_codes`, `app_web_sessions`, family columns `ha_mfa`, `factor_at`). On this branch alone the
migration sequence has a gap (0172 / 0173 belong to other branches): `tests/test_migrations_263_upgrade.py::
test_the_release_numbers_are_contiguous_and_final` is expected to fail until they land.

| Slice | Status |
|---|---|
| X1 core: routes, code store, session kind and resolver, revocation fan-out, cache + WebSockets + capture lease, start-up end, janitor, settings + channel rule, audit, backup, `issue()` records `ha_mfa` / `factor_at`, S-01 refusal | BUILT (`services/app_session.py`, `routers/app_refresh.py`, `services/app_refresh.py`, `services/app_refresh_key.py`, `services/ha_user_auth.py`, `auth.py`, `routers/remote.py`, `services/backup.py`, `main.py`) |
| X2 hardening: F-09 (S-02), the sessions-list row and its revoke (S-04), `DELETE /auth/session` (decision 394) | BUILT |
| X3 inventory and docs: API inventory regeneration, contract v2.2 text in `docs/api/mobile-presence-contract.md`, device-key spec rev 3 | NOT DONE (the client contract is in the handoff package) |
| X4 security review of the built code | REQUIRED before any switch ON - NOT DONE |
| X5 frontend bridge hook (`signedIn` / `signedOut`) | separate task |
| SXFIX-295 (additive): `signedOut({reason})` closed vocabulary, strict `X-Correlation-Id`, official fixtures `contracts/fixtures/app_session/`, audit of a cross-site redeem refusal | built on `pilot/SXFIX-295`; client text in `docs/api/mobile-presence-contract.md` section 10 |

Tests: `smplwise_vms/backend/tests/test_app_session_295.py`.

Activation sequence (lab): X4 review -> the device tests of section 16 -> the owner switches `security.app_session_exchange` on from
the local channel -> one keyed phone with the build flag ON -> exchange, redeem, "sign out everywhere", confirm the WebView is signed
out within 30 s and the audit rows.

## 15. Audit events

| Action | Decision | Details (never a code, cookie, hash of either, access digest, nonce, signature, `ts`, full user agent or unmasked address) |
|---|---|---|
| `auth.app_session.code_issued` | allowed | `family`, `device`, `key_fp` (16 hex) |
| `auth.app_session.exchange` | denied | `reason` (`key_required`, `mfa_required`, `enrol_required`), `family` |
| `auth.app_refresh.refused` | denied | a family ended by the exchange (`binding_mismatch`, `device_gone`, `session_proof_missing`, `session_proof_invalid`, policy reasons, `expired`, `idle`, `sign_in_revoked`) via `_end`, actor = the family's user, source `device` |
| `auth.app_session.created` | allowed | `session` (public id), `family`, `device`, `key_fp`, `admin_capped`, `ha_mfa`, `gate`, `via: "app"` |
| `auth.app_session.redeem` | denied | `reason` (`origin_mismatch`, `key_changed`, `family_ended`, policy reasons), `family` |
| `auth.app_session.code_replayed` | denied | `family` |
| `auth.app_session.ended` | allowed | `session`, `reason` (`expired`, `idle`, `permissions`, `mfa_required`, `sign_in_revoked`, ...) |
| `auth.app_session.signed_out` | allowed | `session`, `family` |
| `auth.app_session.feature_enabled` / `_disabled` | allowed / denied | `channel`, `sessions_ended` |

## 16. Device tests still owed (NOT_RUN)

- Android WebView and iOS WKWebView: the redeem navigation receives and stores the `__Secure-` cookie with `SameSite=Strict` and sends
  it on the following requests to `<remote_path>/` (expected: a browser-initiated top-level navigation is same-site).
- Both: `Sec-Fetch-Site` value sent by the WebView on `loadUrl` / `load(URLRequest)` (expected `none` or absent).
- Both: the landing URL is observable by the shell (`?app_session=failed`).

## 17. Review findings - disposition

| Finding | Disposition |
|---|---|
| S-01 (Medium) web session can mint a family | FIXED: section 6.3; `routers/app_refresh.issue` refuses `403 sign_in_not_anchorable` before any pin / replace / revoke |
| S-02 (Medium) several live access tokens up to 60 min | FIXED in the build: section 8 (rotation deletes all previous access tokens while ON; 1-15 bound) |
| S-03 (Medium) resolver lacks anchor / expiry re-check | FIXED: section 6.4 (family expiry under current settings + `_anchor_revoked` per lookup) and section 9 (start-up end) |
| S-04 (Medium) "end this session" undone by the app | FIXED: section 12 (ending the row ends the family) and 11.3-5 (once per app start) |
| S-05 cookie in the body / HttpOnly on iOS | RESOLVED by decision 429 (the server sets the cookie) |
| S-06 cookie on the exchange route | FIXED: section 4 wording; the route never reads a cookie (tested) |
| S-07 spending the access token | RESOLVED: option 1, the token is not spent (section 8) |
| S-08 administrator caps vs the family cap | OPEN (owner question): an administrator's saved sign-in reaches the web app without a password for up to 7 days of family life, 1 h per web session; the MFA rule (when on) is the only extra control |
| S-09 fan-out may fail silently | FIXED: the fan-out is inside `_revoke`; the resolver reads both switches on every cache miss and re-checks the family; the janitor sweeps |
| S-10 `allow_keyless` | RESOLVED by decision 430 (removed) |
| S-11 `ts` strictness, signed digest | APPLIED to the new route (`StrictInt`); `ProofIn` / `MintProofIn` / `ReplaceProofIn` unchanged - OPEN (Info) |
| S-12 audit hygiene | APPLIED (section 15; tested) |
| S-13 derived cookie attributes | APPLIED (`ha_user_auth.cookie_name`) |
| S-14 nonce sharing wording | APPLIED (section 4.1) |
| S-15 device id pattern | APPLIED to the new route only; the older routes unchanged - OPEN (Info) |
| S-16 cache drop before commit | RECORDED as R7 |

Nothing in this document contains token material, key material, nonces, hostnames, addresses or credentials.
