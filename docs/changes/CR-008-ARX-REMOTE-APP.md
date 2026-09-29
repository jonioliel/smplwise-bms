# CR-008 — SmplWise Arx remote access: `https://<site>/arx` with our own login, then an installable app

**Numbering:** registered as CR-008 on 2026-09-29 (CR-005 WisKey phase 2, CR-006 3D visuals and CR-007 device control
are in progress). Task card: T092 (requirements R184-R186, acceptance tests AT184-AT186).

**Status:** Proposed - planning record, no product code yet. The owner asked for a working environment today and the
full plan after; §4 is the fastest path, §5 the phases, §6 the decisions only the owner can take. Nothing here changes
the identity contract (`docs/security/HA_IDENTITY_RBAC_HE.md`) until the owner approves it: this CR *adds* a second,
server-validated entry channel next to Ingress (§3b) and records that as a proposed amendment of its §4.
Owner answers of 2026-09-29 are recorded in §7 (D1, D3-D7, D10 decided; D2, D8, D9 pending). A second round of
owner answers, taken the same afternoon on the domain and tunnel model for remote access, is recorded as
D11-D14 (all decided; see §7.2).

## 1. The request (owner, 2026-09-29, translated)

The product is being renamed **SmplWise Arx**. Every customer already exposes Home Assistant through the Cloudflared
add-on (brenner-tobias) at a hostname such as `ecc.smplwise.com`. The owner wants `https://ecc.smplwise.com/arx` to
open **only our system** (not the HA UI), with **our own designed login screen** that takes the HA username and
password, and later an **app** (like the HA Companion app) with notifications and so on. Cloudflare Tunnel already
carries his WebRTC signalling (WisKey intercom) without trouble - the media itself goes directly over UDP. He wants a
working environment **today** (fastest path) and the complete plan afterwards.

## 2. Facts learnt (sources read on 2026-09-29)

### 2.1 The Cloudflared add-on

Sources: `https://github.com/brenner-tobias/ha-addons/tree/main/cloudflared` (DOCS.md, config.yaml); the add-on's
`config.yaml` now points at `https://github.com/homeassistant-apps/app-cloudflared` (version 7.0.17), whose
`cloudflared/rootfs/etc/s6-overlay/s6-rc.d/prepare/run.sh` builds the tunnel configuration.

- **Two modes.**
  - *Locally managed (options):* `external_hostname`, `additional_hosts`, `catch_all_service`, `nginx_proxy_manager`,
    `tunnel_name`. The script writes `/tmp/config.json` as an ingress list in this order: the `external_hostname`
    rule (`service: <http|https>://homeassistant:<port>`, the port and TLS read from HA's own http settings) →
    each `additional_hosts` entry → `catch_all_service` / NPM (`http://a0d7b954-nginxproxymanager:80`) → the final
    `http_status:404`.
  - *Remotely managed:* "Set `tunnel_token` app option to your tunnel token (all other configuration will be
    ignored)" and "Any configuration changes should be made in the Cloudflare Teams dashboard." The script logs
    "Using Cloudflare Remote Management Tunnel" and runs the token as is.
- **Path routing is not available in options mode.** The option schema of an `additional_hosts` entry is exactly
  `hostname: str`, `service: str`, `disableChunkedEncoding: bool?` - there is no `path` key, and the script never
  writes one. Even if a path rule could be smuggled in, the plain `external_hostname` rule for the same hostname is
  emitted first and cloudflared takes the first matching rule, so a later `/arx` rule on `ecc.smplwise.com` could
  never match. **Conclusion: `ecc.smplwise.com/arx/*` → our add-on needs a remotely-managed tunnel (`tunnel_token`)
  with a path route in the Cloudflare dashboard.** Options mode can only give us a *separate hostname*
  (`additional_hosts: [{hostname: arx-ecc.smplwise.com, service: http://0b8c26d5-smplwise-vms:8099}]`), which loses
  the same-origin properties §3 depends on (decision D1).
- **Path semantics (Cloudflare docs).** Published application routes take Subdomain, Domain, an optional **Path** and a
  Service URL (dashboard: Networking → Tunnels → the tunnel → Routes → Add route → Published application). The path
  is a Go regular expression. "Specifying a path routes matching requests to the service URL, but does not strip or
  rewrite the path. The service receives the complete request path." Ingress rules are evaluated "from top to bottom"
  and the first match wins (`developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/get-started/create-remote-tunnel/`,
  `.../do-more-with-tunnels/local-management/configuration-file/`). So our add-on receives `/arx/...` unchanged.
- **How the tunnel reaches our add-on.** The Cloudflared add-on is not `host_network`; it sits on the Supervisor's
  internal `hassio` network like every other add-on and already addresses HA as `homeassistant:<port>` and NPM as
  `a0d7b954-nginxproxymanager:80`. The HA developer docs: "We use an internal network that's allowed to communicate
  with every app ... by using its name or alias", named `{REPO}_{SLUG}` with `_` replaced by `-`
  (`developers.home-assistant.io/docs/add-ons/communication/`). Our slug from the GitHub repository is
  `0b8c26d5_smplwise_vms` (`smplwise_vms/DOCS.md`), so the **internal service URL is
  `http://0b8c26d5-smplwise-vms:8099`** (a locally built copy would be `http://local-smplwise-vms:8099`; the add-on's
  Info page shows the hostname). Our uvicorn already binds `0.0.0.0:8099` (`Dockerfile`: `SW_HOST=0.0.0.0`), so **no
  `ports:` mapping is needed** - `ports:` only publishes to the host LAN, which we still do not want.
- **HA's proxy settings already cover us.** The add-on requires HA `http` "Trust X-Forwarded-For" with trusted proxy
  `172.30.33.0/24` - the add-on address range, which contains our add-on as well as cloudflared (used in §3b.6).
- **What the tunnel does to identity today.** Requests arriving through cloudflared come from its add-on address
  (`172.30.33.x`), never from the Ingress proxy `172.30.32.2`. `auth.resolve_principal` trusts `X-Remote-User-*` only
  from `settings.trusted_proxies` (default `172.30.32.2`), so a tunnel request today is refused with
  `untrusted_origin` even if it carries forged headers. That property must survive this CR (§3e).

### 2.2 Home Assistant authentication for a third-party web client

Sources: `developers.home-assistant.io/docs/auth_api/`; HA core `homeassistant/components/auth/{__init__,login_flow,indieauth}.py`,
`homeassistant/auth/const.py`, `homeassistant/auth/providers/__init__.py`, `homeassistant/components/http/{__init__,ban}.py`;
HA frontend `src/data/auth.ts`, `src/common/auth/token_storage.ts`, `src/entrypoints/core.ts`,
`src/entrypoints/service-worker.ts`; `home-assistant-js-websocket/lib/auth.ts`.

- **client_id.** Must be an http(s) URL with a path. `verify_redirect_uri` accepts a `redirect_uri` with the same
  scheme and host as the `client_id` without fetching anything. So Arx uses
  `client_id = https://ecc.smplwise.com/arx/` and `redirect_uri = https://ecc.smplwise.com/arx/?auth_callback=1`. The
  Companion apps are special-cased (`https://home-assistant.io/iOS|android` + `homeassistant://auth-callback`).
- **Login flow (what HA's own login page does, `src/data/auth.ts`):**
  1. `GET /auth/providers` - pick the provider of type `homeassistant` (HA's user store).
  2. `POST /auth/login_flow` `{client_id, handler: ["homeassistant", null], redirect_uri, code_challenge,
     code_challenge_method: "S256"}` → `{type: "form", flow_id, step_id: "init", data_schema: [username, password]}`.
     HA pins the flow to the caller's IP ("IP address changed" aborts it).
  3. `POST /auth/login_flow/{flow_id}` `{client_id, username, password}` → one of: the same form with
     `errors.base = "invalid_auth"`; `step_id: "select_mfa_module"` or `"mfa"` (field `code`; wrong code →
     `invalid_code`; after the module's retry limit the flow aborts with `too_many_retry`); an abort; or
     `{type: "create_entry", result: "<authorization code>"}`.
  4. `POST /auth/token` (form-encoded) `grant_type=authorization_code&code=…&client_id=…&code_verifier=…` →
     `{access_token, expires_in: 1800, refresh_token, token_type: "Bearer", ha_auth_provider}`.
  5. Refresh: `grant_type=refresh_token&refresh_token=…&client_id=…` - HA refuses when `client_id` differs from the one
     the refresh token was issued to. Revoke: `action=revoke&token=<refresh token>` (always 200).
  - Lifetimes (`auth/const.py`): access token 30 min, MFA session 5 min, refresh token 90 days since last use.
  - The user sees each client in *Profile → Security → Refresh tokens* and can delete it there (lost phone).
- **Validating a token server-side.** The WebSocket API (`/api/websocket`: `auth_required` → `{type: auth,
  access_token}` → `auth_ok`) followed by `auth/current_user` returns `id, name, is_owner, is_admin, credentials,
  mfa_modules` - **no username**; our `ha_users` catalog (migration 0004) has the username and `is_active`. The
  Supervisor's `http://supervisor/core` proxy authenticates *the add-on's* `SUPERVISOR_TOKEN`, not a user token, so
  user tokens are validated directly against HA core on the internal network (`http://homeassistant:8123`, or `https`
  when HA itself serves TLS - the same detection the Cloudflared script does).
- **Failed-login handling.** `@log_invalid_auth` / `process_wrong_login` count failures per `request.remote` and raise
  a persistent notification "Login attempt or request with invalid authentication from …". Banning happens only when
  `login_attempts_threshold` is set: its default is `NO_LOGIN_ATTEMPT_THRESHOLD = -1` (no bans), `ip_ban_enabled`
  defaults to true, `use_x_frame_options` defaults to true (HA sends `X-Frame-Options: SAMEORIGIN`).
- **Pre-seeded tokens are accepted.** HA's frontend (`core.ts`) calls `getAuth({hassUrl, limitHassInstance: true,
  saveTokens, loadTokens})`; `loadTokens()` reads `localStorage.hassTokens`, and on finding tokens sets
  `writeEnabled = true` so refreshed tokens are written back. `getAuth` uses them when `data.hassUrl === hassUrl`
  (`hassUrl` = `${location.protocol}//${location.host}` in the HA build). The stored shape is
  home-assistant-js-websocket's `AuthData`: `{hassUrl, clientId, expires, refresh_token, access_token, expires_in}`
  with `expires = Date.now() + expires_in*1000`. The refresh uses `data.clientId`, so a seeded entry whose
  `clientId` is `https://ecc.smplwise.com/arx/` refreshes correctly. **So an Arx login on the same origin can sign in
  the embedded WisKey panel (`/hikvision-intercom`, an HA frontend page) with no second login.**
- **HA's service worker covers `/arx` too.** HA registers `/sw-<build>.js` with scope `/`. Its routes: anything
  matching `/(api|auth)/` → network only; any URL ending in `/` → stale-while-revalidate; every other same-origin GET →
  stale-while-revalidate in `file-cache` for 24 h; a failed document request falls back to HA's cached `/`. Once a
  browser has loaded HA on `ecc.smplwise.com` (which the WisKey frame does), **HA's worker would serve `/arx/` and our
  assets from its caches and could show HA's page under `/arx` when offline**. The fix is ours: register our own
  worker at `/arx/sw.js` (scope `/arx/`); the browser picks the registration with the longest matching scope.

### 2.3 Our code today

- `smplwise_vms/backend/smplwise/auth.py`: identity only from `X-Remote-User-Id/-Name/-Display-Name`, only from
  `trusted_proxies`; every HTTP and WS path funnels through `resolve_principal` (WS via a duck-typed request in
  `routers/media.py:_principal_for_ws`), then `touch_user` and `maybe_bootstrap` (bootstrap by username).
- `frontend/src/api/client.ts`: every URL is relative to `document.baseURI` (`api/v1/…`), WS URLs too
  (`media.liveWsUrl`, `events.ts`, `session.ts`, `ha.ts`, `intercom.ts`); routing is hash-based (`router.ts`);
  `index.html` uses `./` asset URLs. Nothing reads `X-Ingress-Path`. **The build already works under any prefix that
  ends in `/`**; `/arx` without the slash must redirect to `/arx/`.
- `main.py` mounts the built UI at `/` (`StaticFiles`, `index.html` with `no-cache`) and the API at `/api/v1`.
- Non-fetch resources exist: `<img src=resourceUrl(...)>` (plan images, site photos, thumbnails), download links
  (`exports/{id}/download`, `backups/{name}/download`) and six WebSockets. None of them can carry an
  `Authorization` header, which is why §3b uses a cookie for the session after the bearer exchange.
- WisKey embed (`docs/integrations/wiskey/embed-api-v1/WISKEY_EMBED_API_V1.md`): the frame URL is built from the
  **origin** (`new URL('/hikvision-intercom', location.origin)`), must be same-origin, and "The VMS server must not
  expose Supervisor tokens to this iframe or JavaScript" (also CR-005 §3: the browser never receives a Supervisor
  token).
- Identity contract (`HA_IDENTITY_RBAC_HE.md` §1/§4): HA users only, no new password system, VMS roles bound to HA
  user ids, never accept `user_id`/`role` from the browser as truth; Ingress is the preferred entry. A bearer token
  that *our server* validates against HA keeps all of these; it only adds a channel.

## 3. Architecture

### 3a. Base path `/arx` outside Ingress

- **Server:** a pure ASGI middleware in front of everything. When `remote_access` (new add-on option, default
  **false**) is on and the path starts with `SW_PUBLIC_PATH` (default `/arx`, option `remote_path`):
  `/arx` → `308 /arx/`; `/arx/<rest>` → strip the prefix, set `scope["root_path"] = "/arx"` and
  `scope["state"]["channel"] = "remote"`, continue. When the option is off, `/arx*` → 404. Requests without the prefix
  keep today's behaviour (Ingress from `172.30.32.2`, everything else `untrusted_origin`). A request is never
  "remote" and "ingress" at once: the channel comes from the path, the Ingress trust from the peer address, and the
  remote channel **ignores and strips** `X-Remote-User-*`.
- **Client:** no URL changes - `document.baseURI` is `/arx/`, so `api/v1/…`, `ws(s)://…/arx/api/v1/…/ws`, images and
  downloads resolve under `/arx/`. Channel detection for the UI: `location.pathname` starts with the Ingress prefix
  (`/api/hassio_ingress/`) → Ingress; otherwise → remote (login screen, token handling, logout in the user menu). The
  server confirms it: on the remote channel an unauthenticated call returns `401 {code: "remote_login_required"}`.
- **Every route:** API, WS, static files, hash links (`/arx/#/…`), redirects (only the fixed
  `/arx` → `/arx/` one), `sw.js`, and later `manifest.webmanifest`. WisKey stays at the origin (`/hikvision-intercom`).
  `/healthz` stays at the root (not exposed through the tunnel route).

### 3b. Bearer identity

1. **Our login page** (SmplWise Arx design, RTL, Hebrew): username, password, "keep me signed in", then an MFA code
   step when HA asks for one. It talks to **HA's own endpoints on the same origin** (`/auth/providers`,
   `/auth/login_flow`, `/auth/token`) exactly as HA's login page does, with PKCE (S256). The password never reaches
   our add-on; HA does the password check, MFA, failed-login accounting and notifications (with the real client IP,
   because cloudflared sends `X-Forwarded-For` and HA trusts `172.30.33.0/24`).
2. **Token storage:** `localStorage["arx.auth.v1"] = {hassUrl, clientId: "https://<host>/arx/", access_token,
   refresh_token, expires, expires_in, user_id}` (session-only when "keep me signed in" is off: `sessionStorage`,
   decision D5). **Seeding HA:** `localStorage["hassTokens"]` is written with the same `AuthData` shape
   (`hassUrl: "https://ecc.smplwise.com"`, no trailing slash; `clientId: "https://ecc.smplwise.com/arx/"`), so the
   embedded WisKey panel (and HA's own UI at `/` in the same browser) starts signed in as the same user and refreshes
   with our client id. Risk, stated plainly: the browser that signs in to Arx is then also signed in to the full HA UI
   at `/` as that user (the same user could log in there with the same password anyway), and an existing `hassTokens`
   of another HA user in that browser is replaced. Without seeding, the WisKey frame shows HA's own login inside the
   frame (decision D6). Logout revokes the refresh token at HA and clears both keys.
3. **Refresh:** 5 minutes before `expires` (and on 401), `grant_type=refresh_token` with our client id; a failed
   refresh → login screen. Refreshes from the HA frontend in the WisKey frame write `hassTokens`; Arx keeps its own
   copy, both are valid access tokens of the same refresh token.
4. **Exchange → session:** `POST /arx/api/v1/auth/session` with `Authorization: Bearer <HA access token>`. The server:
   pre-checks the token shape locally (a JWT whose unverified `exp` is in the future - rejects garbage and expired
   tokens without calling HA); validates it against HA core (`/api/websocket`: `auth` + `auth/current_user`); refuses
   users that `ha_users` marks inactive or system-generated; builds the **same `Principal`** as Ingress
   (`user_id` = HA user id, `display_name` = HA name, `username` from `ha_users`, `source = "remote"`); creates an
   opaque session (random 256-bit id, in memory, keyed to the HA access token and its `exp`) and sets
   `__Secure-arx_session=<id>; Path=/arx/; HttpOnly; Secure; SameSite=Strict` (no `Domain`; `__Host-` is not
   possible because it requires `Path=/`). The response is `/me`. The client repeats the exchange after every refresh
   (new id - rotation), so a session never outlives its access token (≤ 30 min) and revoked refresh tokens stop
   producing new sessions.
5. **Per request:** `resolve_principal` on the remote channel accepts the session cookie (images, downloads, WS
   handshakes) or `Authorization: Bearer` (API clients, the future native app) - both map to a cached validation.
   **Cache ≤ 60 s:** a background task re-validates every session used in the last 2 minutes at most every 60 s
   (`auth/current_user` again); an `auth_invalid` result (refresh token deleted in the HA profile, user disabled or
   deleted) drops the session and closes its WebSockets - revocation takes effect within 60 s. RBAC is evaluated per
   request exactly as today; permission-revision changes apply immediately as today.
6. **Brute force / rate limits:** HA handles password guessing (recommend `login_attempts_threshold`, e.g. 10, and
   MFA for admin-role users - D8/D9; an optional Cloudflare rate-limiting rule on `/auth/login_flow*` and
   `/auth/token`). Our exchange endpoint: 10 attempts/min and 50/h per client IP (`CF-Connecting-IP`, trusted only on
   the remote channel), negative cache of rejected token hashes, and our validation calls to HA carry
   `X-Forwarded-For: <client IP>` so HA attributes any invalid token to the caller, never to our add-on's address
   (otherwise a token spray could make HA ban our add-on once a threshold is set).
7. **Bootstrap:** `maybe_bootstrap` never runs on the remote channel - the first system admin is granted only
   through Ingress.
8. **Audit:** `auth.remote_session.created` (user, client IP, country header, user agent), `.rejected` (reason,
   IP), `.revoked` (revalidation failure), `.logout`, visible in the existing audit screen; tokens and cookies never
   appear in logs (`Authorization`/`Cookie` redacted).
9. **Unchanged:** the Supervisor token stays server-side (CR-005 rule); the browser never sees NVR, go2rtc or WisKey
   service credentials. Cloudflare Access / WAF can be layered on top of `/arx` without code changes (D3).

### 3c. What stays identical

- **RBAC and scopes**: the principal is the same HA user id, so bindings, groups, scopes and audit attribution are
  unchanged. The remote gate on top is `remote.policy` (§3f, D4).
- **WisKey embed**: same origin, same `/hikvision-intercom?embed=1` frame, same message contract; signed in via the
  seeded `hassTokens` (D6). HA's default `X-Frame-Options: SAMEORIGIN` allows the frame.
- **Video**: the live and playback WebSockets go through the tunnel to our backend and on to go2rtc exactly as under
  Ingress; WebRTC media flows directly between the browser and go2rtc (the same path the owner already uses for
  WisKey). The remote default stream is `remote.default_profile` (default `main`) **over WebRTC whenever the
  connection allows**; MSE - where the video itself travels through the tunnel - is only an explicit last-resort
  fallback (`remote.mse_fallback`, can be switched off; heavy video through Cloudflare's network is also a
  terms-of-service consideration). Known lab fact, stated honestly: in the lab WebRTC decoded only the sub profile and
  the main profile needed MSE (the main stream's encoding - codec / B-frames). WebRTC in browsers takes H.264 without
  B-frames; H.265 does not play over WebRTC in most browsers. So the MVP checks the main stream's encoding (go2rtc's
  stream info) and shows a settings hint when main cannot go over WebRTC ("set the NVR main stream to H.264 without
  B-frames, or choose `sub` as the remote default") - D7.
- **Device control** (CR-007), maps, events, Plan Studio: unchanged; they are API calls under the same principal.

### 3d. The app

1. **PWA first** (no store): `manifest.webmanifest` (name "SmplWise Arx", `scope`/`start_url` `/arx/`, `display:
   standalone`, `dir: rtl`, `lang: he`, icons), our service worker at `/arx/sw.js` (network-first for `index.html`,
   cache-first for hashed assets, never caches `api/`), an install prompt (`beforeinstallprompt` on Android/desktop,
   an "Add to Home Screen" guide on iOS). **Web Push**: a VAPID key pair generated once and kept in `/data` (private key
   never leaves the add-on), `GET api/v1/push/vapid-key`, `POST/DELETE api/v1/push/subscriptions`, table
   `push_subscriptions(id, user_id, endpoint, p256dh, auth, user_agent, created_at, last_ok_at, failures)`, and a
   notify path from the rules/alerts engine: rule fires → recipients = users with a subscription **and** permission to
   see that event's scope → minimal payload (title, body, event id; no image by default) → push services (FCM,
   Mozilla, Apple) over outbound HTTPS - nothing inbound is needed. A click opens `/arx/#/…/events/<id>`. iOS
   delivers Web Push only to Home-Screen-installed PWAs (16.4+). Our subscription is separate from HA's own html5
   notifications (different worker scope).
2. **Native wrapper (Capacitor)** later: the WebView loads the customer's `https://<site>/arx/` (same origin, so
   login, WisKey and cookies behave exactly as in the browser; several sites per app), native push through FCM/APNs
   (`@capacitor/push-notifications`) with the device token in the same subscription table (`kind = fcm|apns`),
   biometric unlock of the stored refresh token (Keychain/Keystore). FCM/APNs credentials belong to the app publisher
   and cannot ship in every customer's add-on, so native push needs a small **SmplWise push relay** (as HA's
   Companion apps use a relay): the add-on signs a request with its installation key, the relay forwards to FCM/APNs.
   Store accounts, privacy labels and review (Apple asks wrappers for real native value - push and biometrics provide
   it). Native push is deferred to a later version (D10).

### 3f. Settings (owner decisions of 2026-09-29, §7)

Two families of product settings (the settings screen, stored like the existing `media.*` keys; system-admin only),
next to the add-on options `remote_access` (default `false`) and `remote_path` (default `/arx`):

| Key | Values | Default | Meaning |
|---|---|---|---|
| `remote.policy` | `flag` \| `any_role` | `flag` | `flag`: only users whose explicit per-user `remote.access` flag is on may sign in remotely; `any_role`: every HA user holding any Arx role may (D4) |
| `remote.session` | `rolling_90d` \| `browser_session` \| `rolling_90d_idle_lock` | `rolling_90d` | `rolling_90d`: HA's sliding 90-day refresh token in `localStorage`; `browser_session`: tokens in `sessionStorage`, gone with the browser (HA can only read `hassTokens` from `localStorage`, so the seed is written there and removed at logout and at the next Arx start without a session); `rolling_90d_idle_lock`: as the first, plus an idle lock that asks for the password again (D5) |
| `remote.idle_lock_minutes` | integer ≥ 5 | `720` | idle time before the lock, used by `rolling_90d_idle_lock` |
| `remote.default_profile` | `main` \| `sub` | `main` | the stream a remote viewer gets first, over WebRTC (D7) |
| `remote.mse_fallback` | `true` \| `false` | `true` | allow MSE through the tunnel as an explicit last resort when WebRTC cannot connect or decode; the player says so when it happens (D7) |

The server enforces `remote.policy` at the session exchange and at every revalidation (turning the flag off ends the
user's remote sessions within 60 s); the other keys are delivered to the client in `/me` on the remote channel.

### 3e. Security threats specific to public exposure

1. **Forged identity headers** through the tunnel: remote channel ignores/strips `X-Remote-User-*`; Ingress trust stays
   bound to `172.30.32.2`, which the tunnel can never be. Automated test for both.
2. **Unprotected routes**: a test enumerates every route of the app and asserts `401` on `/arx/...` without a session
   (allow-list: `sw.js`, static assets, `auth/session`). The static bundle must contain no secrets (already true;
   the test greps the build).
3. **Token theft (XSS)**: Arx shares the origin with HA - an XSS in either reads the other's tokens (HA already has
   this exposure with its custom cards). Mitigations: strict CSP on `/arx` (`default-src 'self'; script-src 'self';
   object-src 'none'; base-uri 'self'; frame-ancestors 'self'; frame-src 'self'; img-src 'self' data: blob:;
   media-src 'self' blob:; connect-src 'self' wss:`), no third-party scripts, `HttpOnly` session cookie, short
   access-token life, revocation within 60 s.
4. **CSRF on a path-shared origin**: API state changes need the JSON content type or `Authorization` (non-simple
   requests), the cookie is `SameSite=Strict`, and WS handshakes check `Origin == https://<Host>`. Same-origin HA pages
   are inside the trust boundary by construction (they can read `hassTokens`).
5. **Cookie scoping**: `Path=/arx/` keeps the cookie off HA's requests (path is not an isolation boundary inside one
   origin - `HttpOnly` is what stops script access).
6. **Clickjacking**: `X-Frame-Options: SAMEORIGIN` + `frame-ancestors 'self'` on `/arx` (Ingress framing is
   same-origin, so it keeps working).
7. **Caching**: `Cache-Control: no-store` on `api/`; our `/arx/` worker replaces HA's for our scope (§2.2).
8. **Brute force and lockout**: HA's own rules (no ban by default; notification per failure; MFA retry limit →
   `too_many_retry`), plus §3b.6. Risk of locking out a legitimate user with a threshold: an IP ban at HA blocks that
   IP for HA and Arx alike until removed from `ip_bans.yaml` - document it in DOCS.
9. **Session fixation / replay**: new opaque session id at every exchange; no session id in URLs; logout revokes the
   HA refresh token.
10. **Resource exhaustion**: existing live-session limits per installation, plus a per-user cap on concurrent remote
    live sessions.
11. **Exposure switch**: `remote_access: false` by default; when off, `/arx` is 404 even if the tunnel route exists.

## 4. The fastest path to a working environment today

**Step 0 (works now, no code):** remote use through HA itself - open `https://ecc.smplwise.com`, log in to HA, open
the SMPLWISE sidebar entry (Ingress). This is the fallback while the MVP is built.

**Owner steps (≈ 30-45 min, one short outage of the public hostname while DNS moves):**

1. In the Cloudflared add-on log, check the mode: "Using Cloudflare Remote Management Tunnel" = token mode (skip to 4).
2. Zero Trust dashboard → Networking → Tunnels → Create a tunnel → Cloudflared → name `ecc-ha` → copy the token (the
   `eyJ…` string in the install command). Do not run the install command.
3. Recreate every existing public name as routes of this tunnel (the add-on's `additional_hosts` too). For the HA name,
   the old tunnel's `ecc` CNAME must be removed first (DNS → `ecc` record) or the dashboard refuses the route.
4. Add route → Published application, **first**: Subdomain `ecc`, Domain `smplwise.com`, Path `^/arx(/.*)?$`,
   Service `HTTP` `0b8c26d5-smplwise-vms:8099`.
5. Add route → Published application, **second**: Subdomain `ecc`, Domain `smplwise.com`, Path empty, Service `HTTP`
   `homeassistant:8123` (or `HTTPS` + "No TLS Verify" if HA serves TLS itself). Confirm the `/arx` route is listed
   above it (top-to-bottom evaluation; recreate the plain one if the order is wrong).
6. Cloudflared add-on configuration: `tunnel_token: <token>` (other options are then ignored), save, restart; check
   `https://ecc.smplwise.com` still opens HA.
7. After our release: SMPLWISE add-on option `remote_access: true`, restart, open `https://ecc.smplwise.com/arx`.
8. Recommended: HA → Settings → System → Network → HTTP server: login attempts before ban `10`.

**Our steps (MVP = base path + bearer login + our login page; no PWA):**

| # | Work | Estimate |
|---|---|---|
| 1 | Options `remote_access` (bool, default false) / `remote_path` (default `/arx`) in `config.yaml`, `Settings`; DOCS + DOCS_HE | 0.5 h |
| 2 | ASGI prefix middleware (strip, `308 /arx`, channel flag, 404 when off, header stripping), security headers on the remote channel | 1.5 h |
| 3 | `services/ha_user_auth.py` (HA core WS `auth` + `auth/current_user`, JWT pre-check, `X-Forwarded-For`, 60 s revalidation task), in-memory session store, `POST/DELETE api/v1/auth/session`, `resolve_principal` remote branch (cookie or bearer; WS Origin check), rate limits, audit, no bootstrap remotely; unit/contract tests incl. header forgery and route enumeration | 4 h |
| 4 | Frontend: channel detection, Arx login screen (username/password, MFA step, HA error texts), PKCE, token store + `hassTokens` seed, refresh loop + re-exchange, 401 → login, logout; a no-op `/arx/sw.js` registered with scope `/arx/` | 4 h |
| 5 | Settings `remote.policy` / `remote.session` / `remote.idle_lock_minutes` (§3f) with the per-user `remote.access` flag toggle in the users screen, enforcement at exchange and revalidation, the three session modes incl. the idle lock | 2 h |
| 6 | Remote video: `remote.default_profile` / `remote.mse_fallback` in the player (WebRTC first, MSE only as the announced last resort), check of the main stream's encoding from go2rtc stream info + settings hint when main cannot go over WebRTC | 1.5 h |
| 7 | Review round, release, owner check on the lab site (incl. main over WebRTC remotely on the lab NVR) | 1.5 h |
| | **Total** | **≈ 14-15 h** |

Realistic delivery: the same day only if the work starts in the morning; otherwise the next morning. Step 0 covers
the gap.

**"Working" for the first check (AT185 subset):** (1) `https://ecc.smplwise.com/arx` shows the Arx login, not HA;
(2) an HA user with a VMS role signs in (and a user with MFA gets the code step); (3) the map, devices and events load
with that user's permissions; (4) the WisKey area opens already signed in; (5) live video plays over WebRTC with the default `main` profile (lab
check: main over WebRTC remotely on the lab NVR - if its encoding prevents it, the settings hint appears and MSE is used
only as the announced last resort); (6) `https://ecc.smplwise.com` still opens HA; (7) deleting the "…/arx/" refresh token in the HA
profile logs Arx out within a minute; (8) a request to `/arx/api/v1/me` with forged `X-Remote-User-Id` returns 401.

## 5. Phases and estimates

| Phase | Content | Estimate |
|---|---|---|
| P0 | Remote use through HA Ingress (exists) | 0 |
| P1 MVP | §4, including the §3f settings | ≈ 14-15 h |
| P2 Hardening | full CSP report pass, remote sessions list + "sign out everywhere", per-user live caps, rate-limit guide in DOCS, pen-test checklist run on the lab, audit filters; future options kept on the roadmap (D3): Cloudflare Access on `/arx` with an email one-time code, or Access only for admin roles | ≈ 8-10 h |
| P3 PWA + Web Push | manifest, icons, real service worker, install prompt / iOS guide, VAPID + subscriptions + notify path from rules, per-user notification preferences, tests | ≈ 14-18 h |
| P4 Native app | Capacitor shell (multi-site, biometrics, native push), SmplWise push relay service, store accounts and review | ≈ 30-45 h + relay 10-15 h + store lead time |

## 6. Decisions for the owner

- **D1 Hostname scheme:** (a) path `/arx` on the HA hostname - same origin, WisKey and token seeding work, needs the
  token-managed tunnel [recommended]; (b) a separate hostname via `additional_hosts` - no tunnel change, but WisKey
  must log in separately and HA login needs CORS or a server-side proxy.
- **D2 Current tunnel mode** (fact to report): options or token (§4 step 1).
- **D3 Cloudflare Access on `/arx`:** none / email one-time code / only for admin roles.
- **D4 Who may log in remotely:** every HA user with any VMS role, or only users with an explicit `remote.access`
  flag (default off except the owner) [recommended].
- **D5 Session lifetime:** "keep me signed in" = HA's 90-day sliding refresh token; otherwise a session ending with the
  browser; plus an optional Arx idle lock (e.g. 12 h).
- **D6 Seed `hassTokens`:** yes (WisKey signed in; the browser is also signed in to HA at `/`) [recommended] / no.
- **D7 Remote video:** sub profile only / main allowed / MSE fallback through the tunnel allowed or not.
- **D8 MFA:** required for remote users holding admin roles, or optional.
- **D9 HA ban threshold:** set `login_attempts_threshold` (e.g. 10) or keep HA's default (no bans).
- **D10 Native push** (P4): SmplWise-hosted relay, or Web Push only.

## 7. Decisions recorded (owner, 2026-09-29)

| # | Decision | Status |
|---|---|---|
| D1 | (a) path `/arx` on the HA hostname (token-managed tunnel, same origin). | Decided |
| D2 | Current tunnel mode: the owner will send the Cloudflared add-on log (§4 step 1). | Pending |
| D3 | (a) no Cloudflare Access for now. (b) email one-time code and (c) Access only for admin roles stay on the roadmap as future options (P2), not dropped. | Decided |
| D4 | Default (b): an explicit per-user `remote.access` flag; a settings switch allows (a) every HA user with an Arx role: `remote.policy: flag \| any_role`, default `flag` (§3f). | Decided |
| D5 | All three options available in settings: `remote.session: rolling_90d \| browser_session \| rolling_90d_idle_lock`, default `rolling_90d`; idle-lock minutes configurable (`remote.idle_lock_minutes`) (§3f). | Decided |
| D6 | (a) yes. The owner's goal is that Arx and WisKey work together with one login; seeding `hassTokens` is our means to it. | Decided |
| D7 | MSE is not the norm. `remote.default_profile: main \| sub`, default `main`, delivered over WebRTC whenever the connection allows; MSE only as an explicit last-resort fallback that can be disabled (`remote.mse_fallback`). Known lab fact: WebRTC decoded only the sub profile and main needed MSE (main stream encoding - codec / B-frames); the MVP therefore checks the main stream's encoding (H.264 without B-frames works in WebRTC, H.265 does not in most browsers) and shows a settings hint. Lab acceptance check: main over WebRTC remotely on the lab NVR. | Decided |
| D8 | Recommendation kept: (a) MFA required remotely for users holding admin roles. The owner asked for an explanation before deciding. | Pending |
| D9 | Recommendation kept: `login_attempts_threshold: 10`. The owner asked for an explanation before deciding. | Pending |
| D10 | Native push deferred to later versions: P4 stays as planned, Web Push stays in P3. | Decided |

### 7.1 Possible WisKey requests for Arx remote (placeholder)

The owner may forward a request document to the WisKey side if something there would make the remote / app
integration easier. None of these is required for the MVP; candidates only:

1. An app-aware embed mode: the panel knows it runs inside Arx remote / the future app (compact layout, no HA chrome
   assumptions, deep links that return to Arx).
2. An event feed for the future app: door-station calls, access events and alarms published in a form Arx can turn
   into Web Push / native push (with the permission filter on our side).
3. A signed-in / session-state message in the embed API, so Arx can tell "needs HA login" from "loading" without
   guessing when the seeded tokens expire or are revoked.
4. Remote media guidance: which WisKey streams are WebRTC-safe (codec / B-frames), so the same profile policy applies
   to intercom video.

### 7.2 Domain and tunnel model for remote access (owner, 2026-09-29 afternoon)

D1 (§7) fixed the *shape* of remote access - path `/arx` on a shared hostname, same origin as HA - but assumed
that hostname was the customer's existing one on the owner's `smplwise.com` zone. This round of decisions fixes
*which* domain and tunnel carry that hostname, because `smplwise.com` is not Arx's alone.

| # | Decision | Status |
|---|---|---|
| D11 | **Dedicated Arx domain.** The owner's Cloudflare zone `smplwise.com` also serves other products on the same account (`home-<customer>` = the customer's own HA, `sw-ems-<customer>` = energy-monitoring systems). Cloudflare API tokens are scoped per zone at best, never per-hostname, so automation must never run against `smplwise.com`. Arx gets its **own dedicated domain** (the owner will buy one; this CR and the guide use the placeholder `<arx-domain>`), added to the same Cloudflare account as its own zone, with an API token scoped to exactly `Zone:DNS:Edit` on that zone plus `Account:Cloudflare Tunnel:Edit` - it can create Arx tunnels and DNS records and nothing else, and it cannot touch `smplwise.com` or any other zone on the account. | Decided |
| D12 | **A second tunnel per customer, for Arx only.** Hostname `<customer>.<arx-domain>` (default scheme `ecc.<arx-domain>`, matching the existing `ecc` sub-domain naming), with the same two-route, top-to-bottom model as §3a/§4: `/arx(/.*)?` -> the Arx add-on (`<addon-host>:8099`) **first**, `/` -> `homeassistant:8123` **second**. This keeps the same-origin property §3b relies on for HA login and the WisKey embed (D6) - HA is served a second time, on the new hostname, alongside Arx. The existing `home-<customer>.smplwise.com` tunnel and its DNS records are **never touched** by this CR or by the provisioning automation (D14) - customers keep using that hostname for HA exactly as before. HA needs no change to accept the additional hostname (it is still just an HTTP request to `homeassistant:8123`); `trusted_proxies` stays whatever the Cloudflared add-on's own documentation recommends (already `172.30.33.0/24`, §2.1) - unaffected by which zone the hostname lives in. | Decided |
| D13 | **One Cloudflared add-on per customer, in token mode.** The owner keeps running the separate **Cloudflared add-on** - Arx does not bundle its own `cloudflared` - so the second tunnel's token has to live somewhere, and a Cloudflared add-on instance runs exactly one tunnel. Two options were compared: **(a) [recommended]** switch the add-on to token mode with a *new* tunnel that carries **both** hostnames - `home-<customer>.smplwise.com` -> HA (unchanged mapping) and `<customer>.<arx-domain>` with the two routes of D12 - one tunnel, one add-on instance, and the pre-existing `home-<customer>` hostname migrates to the new tunnel via a **manual** DNS CNAME change in the `smplwise.com` zone, done by the owner by hand (never by the provisioning script, which is scoped to `<arx-domain>` only per D11); **(b)** leave the existing tunnel serving `home-*` untouched and run a *second* Cloudflared add-on instance dedicated to the Arx tunnel. Checked against the add-on store's own mechanics for (b): **Home Assistant Supervisor identifies an installed add-on by its slug within the repository it came from, and currently allows installing a given repository's add-on only once** - there is no supported "install a second copy" action in the Store UI or the Supervisor API. The one confirmed workaround, used by other add-on authors facing the same request, is to **fork the add-on's repository under a different slug** (a cosmetic fork - different name/slug, same code) so it appears as a second, independent add-on; nothing in the Cloudflared add-on itself makes this special-cased or easier. That is not something to ask the owner or a customer's installer to do per site, so (b) is **not recommended**. **(a) is recommended**: one add-on, one tunnel, one manual CNAME step per already-migrated customer (today, that is only the owner's own `ecc.smplwise.com`); every new customer (D14 Level 1) only ever gets a single, `<arx-domain>`-scoped tunnel and never touches `smplwise.com`. | Decided |
| D14 | **Provisioning automation, two levels.** **Level 1** (build after the MVP, ≈2 h): `scripts/provision_customer.py <customer>`, run by the owner from his own PC with the `<arx-domain>`-scoped API token of D11 read from `secrets/` (never printed to chat, committed, or logged) - creates the tunnel (`POST /accounts/{account_id}/cfd_tunnel`, body `{"name": "<customer>-arx", "config_src": "cloudflare"}`), writes its ingress rules (`PUT /accounts/{account_id}/cfd_tunnel/{tunnel_id}/configurations`, body `{"config": {"ingress": [{"hostname": "<customer>.<arx-domain>", "path": "^/arx(/.*)?$", "service": "http://<addon-host>:8099"}, {"hostname": "<customer>.<arx-domain>", "service": "http://homeassistant:8123"}, {"service": "http_status:404"}]}}`), and creates the DNS CNAME (`POST /zones/{zone_id}/dns_records`, body `{"type": "CNAME", "name": "<customer>.<arx-domain>", "content": "<tunnel_id>.cfargotunnel.com", "proxied": true}`); prints the tunnel token for the add-on's `tunnel_token` option; idempotent (looks the tunnel up by name before creating one); `--dry-run` prints the calls it would make without sending them; `--remove` deletes the DNS record then the tunnel. API shapes confirmed 2026-09-29 against `developers.cloudflare.com/api/resources/zero_trust/subresources/tunnels/` (tunnel create/configure) and the zone DNS records resource (record create). **Level 2** (P2.5, ≈2-3 days incl. the service): a "Enable remote access" (הפעל גישה מרחוק) action in the Arx setup wizard calls a small SmplWise-hosted provisioning service (Cloudflare Worker or small server, holding the D11 token plus a customer-licence registry) that returns **only that customer's tunnel token** - never the account-wide token; Arx then writes the token into the Cloudflared add-on's own options through the Supervisor API (`POST /addons/<slug>/options` + a restart call) and shows the connection status in the wizard. This needs `hassio_role: manager` in our `config.yaml` instead of today's narrower role - **state the security implication plainly: `manager` lets Arx read and write the options and start/stop/restart of every add-on on the host, not just Cloudflared's**, which is a materially larger blast radius if Arx itself were ever compromised. Per this repo's device-access rule (`AGENTS.md` / `CLAUDE.md` "Process": no writes to the NVR, go2rtc, HA users, or network settings without an explicit, task-specific owner approval), a Supervisor role widening is the same category of decision and needs the same explicit, task-specific owner approval before implementation - Level 2 is recorded as planned, not started, and not to be built under a general "docs" or "provisioning" task without that separate approval. | Decided |

D11-D14 do not change D1 (path `/arx`, same origin) or D6 (seed `hassTokens`) - they only fix which domain and
tunnel deliver that hostname per customer. `docs/operations/ARX_CLOUDFLARE_GUIDE_HE.md` §0 and §9 carry the
installer-facing walkthrough and the automation details.

Owner answers later on 2026-09-29: **D8 = (b) MFA optional** (the setting `remote.require_mfa_admin` exists, default
off); **D9 stays open** - an HA-side setting, documented in DOCS and the guide, never enforced by Arx.

## 8. MVP built (branch `pilot/CR008-arx-mvp`, 2026-09-29)

§4 "our steps" 1-4 are built, plus the §3f settings and the per-user flag (part of step 5). Not yet released.

| Step | What exists |
|---|---|
| 1 | Add-on options `remote_access` (bool, default false) and `remote_path` (default `/arx`, one safe path segment; HA's root paths refused) in `config.yaml` / `Settings`; `ha_core_url` (HA core for token validation; inside the add-on from the Supervisor's `/core/info`). DOCS + DOCS_HE. |
| 2 | `remote_channel.py`, the outermost ASGI middleware: 404 under the prefix while off, `308 /arx -> /arx/`, `root_path` = prefix, request state `sw_channel = remote`, inbound `X-Remote-User-*` / `X-Ingress-*` / `X-Hass-*` / developer identity headers dropped, the HA bridge's signed machine routes 404; CSP (`frame-ancestors 'self'`; `style-src` also needs `'unsafe-inline'` for Lit's inline style attributes), `X-Frame-Options: SAMEORIGIN`, `Referrer-Policy: same-origin`, `Permissions-Policy`, `nosniff`, COOP, `Cache-Control: no-store` on the API. HSTS left to Cloudflare. |
| 3 | `services/ha_user_auth.py`: JWT pre-check, HA core WebSocket `auth` + `auth/current_user` with the caller's `X-Forwarded-For` (retried without it if HA refuses the header), negative cache; in-memory sessions (256-bit ids, rotated on every exchange, never beyond the access token); `POST/DELETE api/v1/auth/session`, `GET api/v1/auth/remote-config`; `resolve_principal`'s remote branch (cookie or bearer; the same `Principal`, `source = "remote"`; never the developer identity); WebSocket `Origin` check and socket closing on revocation; 60 s revalidation of sessions used in the last 2 minutes; `remote.policy` flag / any_role, inactive users, `remote.require_mfa_admin`; rate limits per address (10/min, 50/h) and per user (20/min, 200/h); audit `auth.remote_session.created/.rejected/.revoked/.logout` and `remote.access_flag`; no bootstrap remotely. Migration 0033 `remote_access_users`; `PUT api/v1/access/users/{id}/remote-access`. |
| 4 | `frontend/src/arx/`: channel detection from the address, the designed sign-in page (username/password, MFA step, HA's error texts in Hebrew), PKCE against HA's `/auth/login_flow` + `/auth/token` with `client_id = <origin>/arx/`, `arx.auth.v1` storage per `remote.session`, the `hassTokens` seed (shape verified against HA's `token_storage.ts` and home-assistant-js-websocket's `AuthData`), refresh 5 min before expiry and on 401 with a cookie re-exchange, idle lock, sign-out (revoke + session delete + both stores). The service worker registered is `arx-sw.js` with scope `/arx/` - the file itself ships with the PWA branch (`pilot/CR008-pwa-push`). הגדרות › גישה מרחוק; the per-user toggle in משתמשים והרשאות. |

Deviations from the text above, recorded: the cookie is `SameSite=Strict` as §3b.4 says (the MVP brief said Lax;
Strict is the stricter of the two and works because every Arx request is same-site); audit action names follow
§3b.8; the setting is `remote.mse_fallback` (§3f), not `remote.allow_mse_fallback`; the "keep me signed in" box of
§3b.1 is replaced by the `remote.session` setting (D5); a bearer token on a WebSocket is not accepted (cookie only).

Not built yet (remaining §4 steps): the player's use of `remote.default_profile` / `remote.mse_fallback` and the
go2rtc main-stream codec check (step 6 - the settings screen shows the static H.264 / B-frames hint only); review
round and release (step 7). Tests: 45 backend tests (`tests/test_remote_access.py`, fake HA core
`tests/fake_ha_core.py`) and 8 Playwright runs (`tests/evidence-arx-remote.spec.ts` desktop + phone against
`tests/fixtures/arx_fake_ha.py`). Owner check: AT185 subset of §4 on the lab site.

### 8.1 Security review round 1 (fixed on the same branch)

- **B1 CSRF:** `SameSite=Strict` still sends the cookie on same-*site* requests (sibling sub-domains), and ~35 POST
  routes take no JSON body. `RemoteChannel` now refuses any non-GET/HEAD/OPTIONS request that carries the session
  cookie unless `Sec-Fetch-Site: same-origin` (or, without that header, `Origin` equal to the request's scheme + host):
  403 `csrf_refused`, audited `auth.remote_csrf_refused`. Bearer-only requests (no cookie) are exempt.
- **M1:** in `browser_session` the `hassTokens` seed exists only while an Arx page is open (cleared on `pagehide`,
  re-seeded on load / back-forward); sign-out and the idle lock clear it; the settings tab says plainly that HA at `/`
  shares the sign-in.
- **M2:** a re-exchange ends the presented session at once (its WebSockets move to the new one); sign-out ends every
  session of that browser's chain.
- **M3:** turning the flag off also forgets cached bearer principals; the bearer path has the per-user limit and
  audits its refusals (`via: bearer`).
- **M4:** HA device actions (single, bulk, area assignment) accept the remote principal like an Ingress one; every
  audit row of a remote actor carries `channel: remote`.
- Nits: users first seen through Arx follow the HA directory's active flag like Ingress users; remote WebSockets
  accept a bearer without a cookie (the future native app); `__Host-` is impossible under `Path=/arx/` (documented);
  the guide warns that a ban threshold without `trusted_proxies` can ban the add-on's own address.
- **V1, HA's real request schemas** (HA core `dev`, read 2026-09-29): `POST /auth/login_flow` - `client_id` (str,
  required), `handler` ([str|null, str|null], exactly 2), `redirect_uri` (str, required), `code_challenge`
  (optional, `^[A-Za-z0-9_-]{43}$`), `code_challenge_method` (optional; a challenge requires `S256`, `plain` refused),
  `type` (optional, default `authorize`); no other keys. `POST /auth/login_flow/{flow_id}` - `client_id` required,
  extra keys allowed (the step's fields). `POST /auth/token` - `grant_type=authorization_code` with `client_id`,
  `code` and, when the flow had a challenge, `code_verifier` (SHA-256, base64url, unpadded, constant-time compare);
  `grant_type=refresh_token` with `refresh_token` and the issuing `client_id`; `action=revoke` with `token`. So PKCE is
  native to HA and the Arx client's requests match; the fake HA core now refuses exactly what these schemas refuse.

## 9. Build status

### P3 built (2026-09-29, branch `pilot/CR008-pwa-push`, not released)

Built independently of the P1 MVP branch (base path, remote login and sessions are that branch's; nothing here depends on
them - the worker and the manifest follow whatever base the page is served under):

- **PWA:** `arx-manifest.webmanifest` (scope / start_url `./`, `dir: rtl`, `lang: he`, 192 / 512 / maskable / SVG
  icons), service worker `arx-sw.js` registered from `document.baseURI` with the app base as scope (Ingress prefix
  today, `/arx/` after P1): network-first shell with a Hebrew offline page, cache-first hashed assets, never `api/` or
  video. "התקן את Arx" banner, iOS add-to-home-screen guide, update-available notice. The worker file is `arx-sw.js`
  (not `sw.js` as §3a/§3d wrote) so it cannot collide with Home Assistant's own worker names.
- **Web Push:** migration 0034 (`push_subscriptions`, `push_prefs`, `push_vapid`), `services/push.py`,
  `routers/push.py` (`push/vapid-key`, `push/subscriptions`, `push/prefs`, `push/test`); VAPID + `aes128gcm`
  implemented with `cryptography` (no pywebpush - it would add requests, aiohttp, http-ece, py-vapid and six);
  endpoint allow-list of the browser push services; recipients by `row_scope(events.read)` (the alert list's rule);
  categories, quiet hours, per-user rate limit, retry/backoff, 404/410 removal. The VAPID pair lives in the database
  table `push_vapid` (outside `settings`, so never in a project backup) rather than a file in `/data`.
- **Settings:** מערכת › התראות (every user). The notify path is the local rules engine (every rule alert); WisKey calls
  are not events yet (§7.1 item 2 would enable a door-call category).
- **Tests:** `tests/test_push.py` (RFC 8291 known answer, key lifecycle, own-only CRUD, fake push service
  200 / 410 / 429, scope filtering, prefs + quiet hours, rate limit, payload without secrets);
  `frontend/tests/evidence-pwa-push.spec.ts` + `unit-pwa-deeplink.spec.ts` (desktop + phone).
- **Security review (2026-09-29) fixes:** retries re-check owner and reach before every attempt; `drain()` counts
  retries in flight; the worker cache is versioned by the add-on version (unhashed files network-first, old caches
  deleted on activate); `push` counters in `/health`; `POST push/rotate-key`; HA add-on backups carry the key (documented).
- **Not verified yet:** delivery through the real push services (FCM / APNs / Mozilla) on a real phone, and the
  notification click on the lab site under Ingress and under `/arx/` - an owner check after the P1 merge.

### 8.2 Step 6 built (branch `pilot/CR008-video-policy`, 2026-09-29)

- **Player policy** (`frontend/src/api/video-policy.ts`, `sw-live-player`): on the remote channel (`/me.channel`)
  every live player walks a ladder - `remote.default_profile` over WebRTC; then `remote.mse_fallback` true → the same
  profile over MSE, false → the other profile over WebRTC and finally the message "הזרם הראשי אינו ניתן לפענוח
  ב-WebRTC - ראה הגדרות › וידאו". A WebRTC step is judged by its RTP statistics (review M2): bytes arriving with no
  decoded frame for the stream's GOP + 3 s (6-20 s; 10 s when the GOP is unknown, 20 s with smart codec) is a decode
  failure; no bytes yet keeps waiting up to 30 s and then counts as a connection failure; a transient `disconnected`
  before the first frame is not a failure. A stream the registry marks as not WebRTC-safe is skipped. go2rtc down
  shows "שרת הווידאו אינו זמין" without walking the ladder. The badge reads "מנסה main·WebRTC…" while trying and
  `main·WebRTC` / `sub·WebRTC` / `main·MSE` once it plays; fallbacks are announced on the picture. LAN / Ingress
  unchanged (no `video.lan_profile` setting exists; none was added).
- **To confirm with the owner (D7 note):** only the single-camera view starts on `remote.default_profile`; the camera
  wall and map tiles keep their own profile remotely (the wall's `media.wall_profile`, default `sub`; the map tile
  `sub`) and follow the same WebRTC-first ladder - several main streams at once over a mobile link would be heavy.
- **Codec check** (deviation from §3c's "go2rtc stream info"): read from the NVR instead - `GET
  /ISAPI/Streaming/channels` (read-only) during the discovery, stored per camera in `capabilities_json.encoding`
  (codec, profile, SVC, smart codec, B-frames where exposed, verdict ok / no / unknown). The lab probe of 2026-09-14
  (ten cameras): seven have an H.264 main stream with **SVC on** and an H.264 sub stream without SVC; three are
  H.265 in both streams. With D7's lab fact (WebRTC decoded only the sub profile) that makes H.264 + SVC count as not
  WebRTC-safe alongside H.265, MJPEG and B-frames - an inference from the correlation, to be confirmed by the lab
  check. The lab firmware exposes no B-frame element. A reading from a recording track's Description alone (the lab's
  tracks say H.264-BP for all ten) is at most "unknown", never "plays" (review M1). Shown in הגדרות › גישה מרחוק (summary line → health detail), the health report card `video_webrtc` (warns
  only with `remote_access` on and main first), the camera capabilities, the setup wizard's NVR step (Hebrew hint;
  with a Hikvision model the NVR web menu path, not yet verified on the lab NVR), `/health.video_codecs` (counts).
- Tests: `tests/test_stream_codecs.py` (backend), `tests/evidence-remote-video.spec.ts` (Playwright, desktop, against
  `tests/fixtures/setup_fake_devices.py`; the browser's WebRTC / MSE are faked there - real media is the lab check).
