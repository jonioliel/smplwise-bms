# CR-PARTNERAPI113 - An open interface for partners: scoped partner tokens and signed outgoing webhooks

Status: **BUILT, LAB ONLY** 2026-10-23 (section 16; was PROPOSED, design only). Board item r113. Branch `pilot/PARTNERAPI113-295` from `origin/main`
320e55551 (2.12.4). Migration **0170 PROVISIONAL** (one file, `0170_partner_api.sql`; renumbered at integration).
Go state after the build: **LAB ONLY**. Two switches, both OFF by default, plus a build constant `partner.GO_LIVE_PERMITTED = False`;
nothing is ever turned on on a real installation before a Fable security review of the new public surface (section 14, Q8).

Read with: `docs/security/HA_IDENTITY_RBAC_HE.md` (RBAC, scopes), `docs/changes/CR-USR2-ARX-ONLY-IDENTITY.md` (service identity,
LOCAL_ADMIN_PERMISSIONS and the second-factor gate), `docs/security/TICKETS_PUBLIC_SURFACE_REVIEW_CHECKLIST.md` (the public listener
rules, PUB-07 guard first), `docs/changes/CR-APPREFRESH295.md` on `origin/pilot/APPREFRESH-295` (hashed, shown-once, revocable tokens),
`docs/changes/CR-FLEET215.md` on `origin/pilot/FLEET215-295` (closed outbound schema, fail closed), `docs/changes/CR-WISKEY-HMAC-ROTATION-295.md`
(key ids and two-key overlap), `contracts/API_INVENTORY.md` (1199 routes at 2.12.4).

AGENTS.md applies in full: "no webhook outbound side effect without explicit task-specific authorization". Every slice is built and
tested against fakes (httpx.MockTransport, a fake resolver); the first delivery to a real partner host needs a separate owner approval.

## 1. Goal

Building managers, maintenance contractors and BMS / CAFM vendors ask for two things:

1. **Outgoing webhooks**: the installation tells a partner system, in near real time, that something happened (a service request was
   opened or closed, a cold room went into alarm, an elevator stopped) - signed, so the partner can trust it.
2. **An inbound API with tokens limited by scope**: a partner system reads a narrow slice of state (service requests, temperature units,
   elevators) and may perform one narrow write (open a service request), never more than the token's scopes and restriction allow.

Non-goals: anything physical (doors, alarm, relays, lighting, HVAC, PTZ, scenes, scripts, automations), video, recordings, access control,
WisKey, users, roles, settings, audit, backups, Home Assistant service calls. A partner token is never a person, never a Home Assistant
identity and never the USR2 service identity; no partner request ever leads to a bridge message.

## 2. What exists today (code facts at 320e55551, V = read in code)

| Primitive | Where | Reuse here |
|---|---|---|
| HMAC-SHA256 over `"<ts>.<nonce>.<sha256(canonical body)>"`, 60 s window, nonce cache | `custom_components/smplwise_bridge/signing.py`, `services/ha_bridge.py` (V) | the same construction idea (timestamp + id + body, constant-time compare) for webhook signatures; not the same key |
| Key ids, two-key overlap during rotation | `services/bridge_rotation.py`, CR-WISKEY-HMAC-ROTATION-295 (V) | webhook secret rotation: two signatures during the overlap |
| Outbound HTTPS to a SmplWise service, `follow_redirects=False`, short timeout, fake transport for tests | `services/mobile_push.py` `send_relay`, `services/push.py` (V) | the delivery client shape, `TRANSPORT` hook for tests |
| Resolve once, check, connect to the checked address (DNS rebinding defence); refused names / networks / own addresses | `services/connection_probe.py` `connect_target`, `REFUSED_NAMES`, `REFUSED_NETWORKS`; `services/ma_direct.py` `check_address` / `_pin` (V) | the webhook target check, inverted: partner targets must be PUBLIC (MA requires LAN) |
| Per-install AES-256-GCM sealing with AAD | `services/connection_store.py` `seal_service_secret` / `open_service_secret` (V) | webhook signing secret and target URL at rest |
| Hashed, shown-once, single-family revocable tokens | CR-APPREFRESH295 (`arxr_` / `arxa_`, SHA-256 at rest, `NEVER_EXPORTED_TABLES`, `SETTINGS_KEEP`) | partner token storage, export rules, audit vocabulary |
| A second, minimal public app (no routers, no session, no cookie, no CORS), strict JSON, uniform 404, idempotency | `services/tickets/public_app.py`, `public_http.PublicEdge` (V) | the partner API is a third sibling app on the same edge |
| Sliding-window limiter with named scopes | `services/tickets/ratelimit.py` `ScopedRateLimiter` (V) | per-token and per-endpoint limits (scopes `partner_in`, `partner_out`) |
| Notification sources (closed list, signal only, after-commit notifier) | `services/notify_policy.py` `SOURCES`, `services/tickets/notify_sources.py`, `services/notify_sources.py` (V) | the webhook event list maps onto these keys |
| Ticket creation used by people and rules | `services/tickets/create.py` `TicketSpec` / `create_ticket` (origins `manual`, `device`, `rule`, `inbound`) (V) | `tickets.create` adds origin `partner` |
| Temperature and elevator visibility by floor | `services/temperature_access.py` `Scope`, `services/elevators.py` `visible_to`, `services/ha_scope.py` (V) | the token restriction is evaluated through the same placement rules |
| Audit append | `audit.audit(conn, actor=..., action=..., decision=..., details=...)` (V) | every management action and every refusal |
| Scope chain | `rbac.SCOPE_ORDER = installation, site, building, floor, camera, access_control_station` (V) | restriction levels installation / site / building / floor only |

There is no partner, API-key or webhook concept on main today (V: `git grep -i webhook` finds only the AGENTS rule and unrelated test
fakes).

## 3. Shape of the solution

- **Partner** (`partner_clients`): a named external system ("Contractor X CAFM"). Owns tokens and endpoints. Disabling a partner stops all
  its tokens and endpoints at once.
- **Partner token** (`partner_tokens`): bearer credential for the inbound API, scopes from a closed list, one restriction, expiry.
- **Webhook endpoint** (`partner_endpoints`): a target URL, a signing secret, a subset of the closed event list, one restriction.
- **Outbox / deliveries** (`partner_outbox`, `partner_deliveries`): events waiting, being retried, delivered or dead.

Where it is served (Q1, recommendation A): a **third minimal app on the existing public listener** (`/p/v1/*`, behind `PublicEdge`),
sharing nothing with the main app: no session, no cookie, no CORS, no Ingress identity, no `/api/v1` router. A partner token presented
to `/api/v1/*` is refused (it is not an `auth.resolve_principal` credential); a session cookie or HA bearer presented to `/p/v1/*` is
refused. Guard first (PUB-07): while `partner.api` is off, every `/p/v1/*` path answers the same 404 before the body is read.

## 4. Token model

### 4.1 Format and storage

- Token: `arxp_` + 43 base64url characters (256 random bits, `secrets.token_urlsafe(32)`). The fixed prefix makes leaked tokens findable by
  secret scanners. A visible id `ptk_` + 16 hex identifies the token in lists, audit and logs.
- At rest: SHA-256 of the token only (`token_hash`, unique). 256-bit random input makes a slow hash unnecessary (same reasoning as
  CR-APPREFRESH295 T8). Lookup by hash, compared with `hmac.compare_digest`; an unknown token is answered from a read, never the write gate.
- **Shown once**: the creating response is the only place the plaintext appears. Lists show id, label, last 4 characters, scopes,
  restriction, created / last used / expiry.
- Bound to the installation: the row carries `installation_id` (the `SETTINGS_KEEP` value); a row whose id differs from the running
  installation is refused (a database copied to another box authenticates nothing).

### 4.2 Scopes (closed list)

Scopes are a frozen tuple in code; any other string is refused at creation (422) and a stored unknown scope (a downgrade) is ignored and
audited. Adding a scope is an amendment of this record.

| Scope | Allows | Personal data |
|---|---|---|
| `tickets.read` | list and read service requests inside the restriction (and, per token, the allowed departments) | none by default (4.5) |
| `tickets.create` | open a service request in an allowed department, category, priority and location | none accepted by default (4.5) |
| `temperature.read` | temperature units: friendly name, place label, current reading, status, door open / closed, alarm state | none exists |
| `elevators.read` | elevators: friendly name, place label, derived state, since | none exists |
| `webhooks.self` (reserved, not slice 1-5) | a partner reads its own delivery log | none |

Never a scope (explicit refusal list, tested): doors, access control, alarm, cameras, live video, recordings, events / images, WisKey,
devices control, scenes, scripts, automations, users, roles, audit, settings, backups, energy bills (personal / billing data; a later
amendment may add a read scope after counsel), generator control, HA anything.

Each scope is checked per request against the token AND the feature's own module switch (the tickets module off -> `tickets.*` answers
404 as if the route did not exist; owner rule 2026-10-20: no service-request action when the module is off).

### 4.3 Restriction (per token)

- Exactly one restriction: `installation`, or a non-empty list of `site`, `building` or `floor` ids (one level per token, max 50 ids).
  The ids are validated at creation; an id deleted later simply stops matching.
- Evaluated by the same placement rules as people (`ha_scope.visible_floors`, `temperature_access.Scope`, `elevators.visible_to`), with a
  synthetic, read-only partner principal whose only grants are the scope-mapped permissions on the restriction. An object outside the
  restriction answers the same 404 as one that does not exist (no existence oracle).
- `tickets.*` also carries `departments` (a list of department ids, required for `tickets.create`, optional filter for `tickets.read`).
- The creator must hold the mapped permission on the whole restriction at creation time (`tickets.view` / `tickets.create`,
  `devices.read`); a partner token can never be wider than what its creator could see.

### 4.4 Lifetime, rotation, revocation

- Expiry is mandatory: default 90 days, maximum 365 (Q6). No non-expiring tokens. A notice 14 days before expiry (new notification source
  `partner.token_expiring`, category `system`, administrators only).
- **Rotation**: `POST .../tokens/{id}/rotate` creates a successor with the same scopes and restriction and shortens the predecessor to
  `min(expiry, now + overlap)`; overlap 0-7 days, default 24 h. The successor is shown once.
- **Revocation**: immediate (`revoked_at`, reason). Paths: explicit revoke; partner disabled; partner deleted; `partner.api` switched off
  (every token stays stored but nothing authenticates while off; switching off deletes nothing); installation id mismatch.
  Expired and revoked rows are purged 90 days after the end (hash kept nowhere else).
- Optional per-token source restriction: a list of up to 10 CIDRs the partner calls from (default empty = any). Recommended for BMS
  vendors with fixed egress.
- The token is owned by the installation, not by the person who created it (Q7): it survives the creator's removal; administrators get
  a notice `partner.owner_gone` and the token list flags it.

### 4.5 Personal data (none by default)

Default payloads and responses carry ids, keys, enums, timestamps, numbers and friendly names of places, departments and devices. They
never carry a person's name, phone, e-mail, address, a requester or assignee identity, a visitor, an image, free text typed by a person,
an entity id or a URL.

Opt-in per token and per scope, only by a system administrator, each with an on-screen statement and an audit row
(`partner.token.personal_data`):

| Opt-in | Adds | Applies to |
|---|---|---|
| `ticket.text` | title and description of the request | `tickets.read`, ticket webhooks; `tickets.create` may then send a description |
| `ticket.people` | requester / assignee display names (no phone, no e-mail ever) | `tickets.read`, ticket webhooks |

Recommendation (Q4): ship slices 1-5 with **no opt-in at all**; the opt-ins arrive in slice 8 after the lead's counsel analysis
(`legal_pack_technician_privacy_2026-10-18`) and the owner's approval. Without `ticket.text`, `tickets.create` accepts a title from a
closed per-department template list plus a structured `external_ref` (partner's own reference, `[A-Za-z0-9._:-]{1,64}`), never free text.

## 5. Inbound API (served at `/p/v1`)

| Method | Path | Scope | Notes |
|---|---|---|---|
| GET | `/p/v1/whoami` | any | token id, partner label, scopes, restriction kind, expiry; never the token |
| GET | `/p/v1/tickets?updated_since=&cursor=&status=` | `tickets.read` | page of 100, cursor-based, `updated_at` ascending |
| GET | `/p/v1/tickets/{id}` | `tickets.read` | 404 outside restriction / departments |
| POST | `/p/v1/tickets` | `tickets.create` | `Idempotency-Key` header required (the public app's `Idempotency.run()`), strict JSON (`extra=forbid`), origin `partner`, attribution `partner:<ptk id>` |
| GET | `/p/v1/temperature/units` | `temperature.read` | friendly names only, never entity ids (owner decision 7 of CR-INFRA-TEMPERATURE) |
| GET | `/p/v1/elevators` | `elevators.read` | derived state from `elevators.live_of` |

Rules: `Authorization: Bearer arxp_...` only (no query-string token, no cookie); responses `Cache-Control: no-store`; the public 422
envelope (`{"code": "invalid", "fields": [...]}`); a fixed error vocabulary (`unauthorized`, `forbidden_scope`, `not_found`,
`rate_limited`, `invalid`, `request_id_reused`). Unknown / expired / revoked token -> 401 `unauthorized` with the same bytes; a known
token without the scope -> 403 `forbidden_scope` (audited). Body cap 16 KiB. A ticket created by a partner raises the normal
`ticket.new_unassigned` notification and appears in the board like any other.

## 6. Webhook model

### 6.1 Event types (closed list, mapped to existing notification sources)

| Event type | From source(s) | Payload (no personal data) |
|---|---|---|
| `ticket.created` | the `create_ticket` commit (all origins) / `ticket.new_unassigned` | ticket id, number, department key, category key, priority key, location label, origin, created_at |
| `ticket.status_changed` | `ticket.status_update`, `ticket.returned` | ticket id, number, from / to status keys, at |
| `ticket.done` | `ticket.done` | ticket id, number, at |
| `temperature.alarm` / `.warning` / `.offline` / `.escalation` | the same keys | unit id, friendly name, place label, reading, limits, state, at |
| `temperature.resolved` | the resolve of any of the four | unit id, source key, at |
| `elevator.fault` / `.out_of_service` / `.fire_service` | the same keys | elevator id, friendly name, place label, state, at |
| `elevator.resolved` | the resolve of any of the three | elevator id, source key, at |
| `endpoint.ping` | the test button / creation check | endpoint id, at |

Explicitly excluded (tested): `security.*`, `access.*`, `door.*`, `alarm.*`, `camera.*`, `privacy.*`, `notify.*`, `intercom.*`,
`automation.*`, `schedule.*`, `backup.*`, `update.*`, and in v1 also `sensor.leak` / `.smoke` / `.gas` / `.co` (Q5).

### 6.2 Where events come from

The webhook layer is one more **consumer** of the notification signals and never decides anything a source does not already decide:
inside the same transaction that writes the notification row, `partner_events.enqueue()` writes one outbox row per subscribed, active
endpoint whose restriction covers the object (only when both `partner.webhooks` is on and at least one endpoint subscribes; otherwise it
is a constant-time no-op). Rollback removes the outbox rows with the notification. The payload is built at enqueue from a closed schema
per event type (exact key set, typed, patterns; any deviation fails closed and is counted, as in CR-FLEET215 section 4). A hook failure
never breaks the source (logged, counted, returns).

Loop guard (Q9): a ticket created by partner P is not sent back to P's endpoints as `ticket.created` (per-endpoint flag `skip_own`,
default on).

### 6.3 Signing and replay protection

Format follows the public "Standard Webhooks" convention, so partners can use existing libraries:

- `webhook-id`: `evt_` + 16 hex, stable across retries of the same event to the same endpoint (the receiver's dedupe key).
- `webhook-timestamp`: Unix seconds of this attempt.
- `webhook-signature`: `v1,<base64(HMAC-SHA256(secret, id + "." + timestamp + "." + raw body bytes))>`; during a secret rotation two
  space-separated signatures (old and new key).
- Secret: `whsec_` + base64 of 32 random bytes, per endpoint, shown once, stored sealed (`seal_service_secret(data_dir,
  "partner_webhook", endpoint_id, "secret", ...)`). It cannot be hashed (we must sign with it); it is never logged, audited, returned
  after creation or exported.
- Rotation: `POST .../endpoints/{id}/secret/rotate`, overlap 0-7 days (default 24 h), then the old key is erased.
- Receiver guidance (published in the partner guide, slice 6): reject timestamps more than 5 minutes off; reject a seen `webhook-id`;
  compare in constant time. Body also carries `event_id`, `type`, `occurred_at`, `installation` (opaque per-partner id, not the
  installation id), `sequence` (monotonic per endpoint, gaps possible after dead-letter).
- Tests carry fixed vectors (secret, id, timestamp, body -> signature) in `tests/fixtures/partner_webhook_vectors.json`.

### 6.4 Delivery, retries, dead-letter

- One delivery worker thread (no database connection held during a network call), per-endpoint concurrency 1, ordering best-effort.
- Success: any 2xx within the timeout. Retry on network error, timeout, 408, 425, 429 (honouring `Retry-After`, capped at 1 h) and 5xx.
  Any other 4xx dead-letters at once (a 410 also disables the endpoint, reason `gone`). A 3xx is a failure and is **never followed**.
- Backoff with full jitter: 30 s, 2 min, 10 min, 30 min, 1 h, 3 h, 6 h, 12 h, 24 h (9 retries, about 47 h), then **dead** (`dead_reason`
  = `attempts`, `client_error`, `gone`, `overflow`, `expired`). Dead rows stay 14 days; a system administrator may redeliver a dead event
  (audited, limited to 100 per hour) - it is signed again with a new timestamp and the same `webhook-id`.
- Circuit: 50 consecutive failed attempts or 24 h without a success pauses the endpoint (`paused`, notice `partner.endpoint_paused` to
  administrators); new events for it are dead-lettered `paused` until resumed. Resume needs a successful `endpoint.ping`.
- Bounds: at most 10 endpoints per installation, 5000 queued rows per endpoint (beyond that the oldest dead-letters `overflow` and one
  notice is raised), events older than 48 h are not sent (`expired`).

### 6.5 Delivery log (no secrets)

`partner_deliveries` keeps per attempt: event id, endpoint id, type, attempt number, started_at, duration_ms, HTTP status, error class
(`timeout`, `connect`, `tls`, `refused_address`, `redirect`, `http_4xx`, ...). It never keeps the signature, the secret, request or response
headers, the response body (read up to 4 KiB, discarded) or the full URL. The payload stays in `partner_outbox` only until delivered or
dead + 14 days, so an administrator can see exactly what left (mirrors `GET /fleet/report/log` of CR-FLEET215). Log rows are purged after 30 days.

### 6.6 SSRF defences for the target URL

Validated at create / update and **again before every attempt**:

1. Syntax: `https://` only (Q2 recommends no http), host name or IP literal, port 443 or 8443 (Q2), path and query allowed, no user-info,
   no fragment, length <= 2048, no control or whitespace characters, IDN converted to A-labels; IP literals in decimal / octal / hex or
   shortened forms are refused as syntax.
2. Names: refuse `connection_probe.REFUSED_NAMES` (`localhost`, `supervisor`, `hassio`, `homeassistant`, `metadata`,
   `metadata.google.internal`, ...), `*.localhost`, `*.local`, `*.internal`, `*.lan`, `*.home.arpa`, the machine's own host name, the
   HA host name, the remote-access host name of this installation.
3. Addresses: resolve once (bounded budget); **every** answer must be globally routable. Refused: RFC 1918, loopback, link-local
   (`169.254.0.0/16` including `169.254.169.254`, `fe80::/10`), CGNAT `100.64.0.0/10` (also Tailscale), `0.0.0.0/8`, multicast, reserved,
   benchmarking, documentation ranges, ULA `fc00::/7`, `::1`, `::`, IPv4-mapped / -compatible IPv6 (judged on the embedded IPv4), NAT64
   `64:ff9b::/96` with a private embedded address, 6to4 / Teredo (`2002::/16`, `2001::/32`), `REFUSED_NETWORKS` (Supervisor
   `172.30.32.0/23`, cloud metadata), the machine's own addresses and the trusted proxies.
4. Connect to the checked address (pinned transport; TLS SNI and `Host` = the name, certificate verified against the name) - a DNS
   answer that changes between check and connect cannot redirect the request (rebinding).
5. `follow_redirects=False`, `trust_env=False` (no proxy variables), connect 5 s / total 10 s, request body <= 16 KiB, response read
   <= 4 KiB.
6. A refusal is audited `partner.endpoint.refused_address` with the host only, the attempt counts as a failure, nothing is connected.

A private target for an on-site BMS (Q2 option B) would be a separate, per-endpoint "local network" flag set by a system administrator on
the local channel, never covering loopback, link-local, metadata, Supervisor, the machine itself, go2rtc or the NVR addresses; not in
slices 1-7.

### 6.7 Rate limits

| Limit | Value | On excess |
|---|---|---|
| inbound, per token | 60 / min, 2000 / h | 429 `rate_limited` + `Retry-After` |
| inbound `tickets.create`, per token | 30 / h, 200 / day | 429 |
| inbound unknown-token failures, per source address | 20 / min (global 300 / min) | 429 from the edge, no lookup |
| outbound, per endpoint | 60 / min | queued (not dropped) |
| outbound, installation | 300 / min | queued |
| redeliver, installation | 100 / h | 429 |

## 7. Threat model

| # | Threat | Mitigation | Residual |
|---|---|---|---|
| T1 | **Stolen partner token** (partner's server, logs, a repo) | narrow closed scopes, mandatory expiry, per-token restriction and optional source CIDRs, instant revoke / partner disable / kill switch, `arxp_` prefix for secret scanners, last-used time and address shown, per-token rate limits | reads inside the scope until revoked |
| T2 | **Token theft from our side** (backup, database copy) | SHA-256 only; tables `NEVER_EXPORTED_TABLES`; switches `SETTINGS_KEEP`; installation-id binding | - |
| T3 | **SSRF through a webhook URL** | section 6.6: public addresses only, resolve-once + pinned connect, no redirects, no proxy env, refused names, checked per attempt; only `partner.manage` holders set URLs | a public host the administrator chose receives our events (by design) |
| T4 | **Data over-exposure** | closed scope list, closed payload schemas built fail-closed, personal data none by default, opt-in per scope, 404 outside the restriction, friendly names not entity ids, tests with planted sentinel names / phones | an administrator opting in exposes what he opted in |
| T5 | **DoS amplifier** (our box flooding a third party, or a partner flooding us) | max 10 endpoints, per-endpoint and global outbound limits, folding already done by the sources (`window_s`), backoff and circuit, loop guard, inbound limits and the edge's gate, body caps | - |
| T6 | **Tenant data separation** | one add-on = one installation; tokens and endpoints bound to `installation_id`; within an installation the restriction is evaluated by the same placement rules as people; a partner's events go only to its own endpoints; `installation` in payloads is an opaque per-partner id so two partners cannot correlate | - |
| T7 | **Forged / replayed webhooks** (at the partner) | HMAC with a per-endpoint secret, timestamp + id signed, receiver guidance and vectors | a receiver that skips verification |
| T8 | **Privilege outliving its grant** | creator must hold the permission at creation; scopes judged live with the module switches; partner disable; expiry | token outlives a creator who left (Q7, notice) |
| T9 | **Credential confusion** | partner tokens are not principals on `/api/v1`; sessions / HA bearers refused on `/p/v1`; never the service identity; no bridge message | - |
| T10 | **Secrets in logs / audit** | tokens, secrets, signatures and full URLs never logged or audited (host only); tests scan tables, audit and log capture | - |
| T11 | **Probing** | guard first: 404 while off, before the body; uniform 401 for any unusable token | - |
| T12 | **Partner-created ticket spam** | `tickets.create` limits, allowed departments only, templates instead of free text by default, idempotency, origin `partner` visible on the board | - |

## 8. Permissions

- New permission **`partner.manage`**: create / rotate / revoke tokens, create / edit / pause / delete endpoints, rotate secrets, read the
  delivery log and outbox, redeliver. Bound to `system_admin` only in `roles.json` (Q3), added to `LOCAL_ADMIN_PERMISSIONS` (an Arx-only
  identity needs the TOTP second factor for it).
- The switches `partner.api` and `partner.webhooks`: `system.configure` **and** `partner.manage`; ON only from the local channel; OFF from
  either channel (kill switch). ON is refused 409 while `GO_LIVE_PERMITTED` is False.
- Creating a token with `tickets.*` also needs the matching ticket permission on the restriction; `temperature.read` / `elevators.read`
  need `devices.read` on it (section 4.3).
- Every management route answers 404 while both switches are off, except `GET` of the settings card and switching on.

## 9. Audit (no secrets)

`partner.feature_enabled` / `_disabled` (which switch, channel), `partner.client.created` / `.disabled` / `.deleted`,
`partner.token.created` (id, scopes, restriction kind and count, expiry), `.rotated`, `.revoked` (reason), `.expired`, `.personal_data`,
`.denied` (`forbidden_scope`, `restriction`, `source_address`, `installation_mismatch`), `partner.ticket.created` (ptk id, ticket id),
`partner.endpoint.created` / `.updated` / `.deleted` / `.paused` / `.resumed` / `.secret_rotated` / `.refused_address` (host only),
`partner.delivery.dead` (aggregated per endpoint per hour), `partner.delivery.redeliver`, `partner.manage` denied. Successful reads are
not audited one by one; per-token counters (requests, last used, last address) are kept on the token row.

## 10. Settings (all `SETTINGS_KEEP`)

| Key | Default | Range |
|---|---|---|
| `partner.api` | `off` | on / off (section 8) |
| `partner.webhooks` | `off` | on / off |
| `partner.token_default_days` | 90 | 1-365 |
| `partner.token_max_days` | 365 | 1-365 |
| `partner.max_endpoints` | 10 | 1-10 |

## 11. Data (migration 0170 PROVISIONAL, one file `0170_partner_api.sql`)

| Table | Key columns |
|---|---|
| `partner_clients` | `id` (`pcl_`+16 hex), `label`, `opaque_installation_ref`, `state` active / disabled, created_by, created_at |
| `partner_tokens` | `id` (`ptk_`), `client_id`, `token_hash` UNIQUE, `last4`, `scopes_json`, `restriction_kind`, `restriction_ids_json`, `departments_json`, `source_cidrs_json`, `personal_json` (empty), `installation_id`, created_by / at, `expires_at`, `predecessor_id`, `last_used_at`, `last_used_addr`, `request_count`, `revoked_at`, `revoked_reason` |
| `partner_endpoints` | `id` (`pep_`), `client_id`, `url_enc`, `host` (display / audit), `secret_enc`, `secret_prev_enc`, `secret_prev_until`, `events_json`, `restriction_kind`, `restriction_ids_json`, `skip_own`, `state` pending / active / paused / disabled, `fail_streak`, `last_success_at`, `sequence` |
| `partner_outbox` | `id` (`evt_`), `endpoint_id`, `type`, `payload_json`, `occurred_at`, `next_at`, `attempts`, `state` queued / delivering / delivered / dead, `dead_reason`, `delivered_at` |
| `partner_deliveries` | `id`, `event_id`, `endpoint_id`, `attempt`, `started_at`, `duration_ms`, `http_status`, `error_class` |
| `partner_idempotency` | `token_id`, `key_hash`, `ticket_id`, `response_json`, `created_at` (24 h) |

All six tables join `NEVER_EXPORTED_TABLES`: a backup never carries partner credentials, sealed secrets (which would not open elsewhere
anyway) or queued payloads; a restore leaves partner state as it was on the target box. Indexes on `token_hash`, `(state, next_at)`,
`(endpoint_id, state)`. Rollback: the feature off is the full stop; the migration is additive and the tables may stay.

## 12. Tests plan (fakes only; no real partner host)

1. Tokens: format, hash only at rest, shown once (second read has no plaintext), expiry default / max, rotation overlap, revoke paths,
   installation-id mismatch, unknown scope refused, refusal list scopes impossible, source CIDRs.
2. Credential separation: `arxp_` refused on every `/api/v1` route (sampled from the inventory); cookie / HA bearer refused on `/p/v1`;
   query-string token refused; 404 guard while off, before the body.
3. Restriction: a seeded two-site / multi-floor database; each read and the create honour site / building / floor; outside = the same 404
   bytes as nonexistent; departments filter; module switch off -> 404.
4. Privacy: planted sentinel names, phones, e-mails and free text in tickets, contacts and users never appear in any response, payload,
   outbox row, delivery row, audit row or log line (scan), with every scope combination and no opt-in.
5. Payload schemas: every event type builds exactly its key set; an extra or wrong-typed field aborts the enqueue (fail closed).
6. Signing: fixed vectors, two signatures during rotation, `webhook-id` stable across retries, timestamp per attempt.
7. SSRF matrix: every refused range (IPv4, IPv6, mapped, NAT64, 6to4, Teredo, CGNAT, metadata), numeric-literal tricks, trailing dot,
   IDN, refused names, own host; a fake resolver that answers public then private (rebinding) -> refused at attempt time; 301 / 302 / 307
   not followed; proxy env ignored.
8. Delivery: backoff schedule on a fake clock, `Retry-After` cap, 4xx dead-letter, 410 disables, circuit pause and ping resume,
   overflow, 48 h expiry, redeliver limits, no connection held during the call, rollback of the source removes the outbox row.
9. Limits: inbound per-token and create limits, failure limiter, outbound per-endpoint and global queueing.
10. Loop guard: partner-created ticket not echoed to the same partner; echoed to another partner.
11. Backup / restore: tables absent from the archive, settings kept, restore keeps the target's partner state.
12. Audit: every action in section 9 written, no secret / URL path in any row.
13. Inventory and docs: `scripts/api_inventory.py` regenerated; docs-config consistency; `roles.json` drift test for `partner.manage`.

Test tier: M for slices 1-4, L for slice 5 (the delivery worker). Lab tests only after the owner's approval of a real target (AGENTS).

## 13. Slices (smallest first)

| Slice | Content | Depends on |
|---|---|---|
| S1 | migration 0170, `partner.api` switch + GO_LIVE constant, partners and tokens (create / list / rotate / revoke), `/p/v1/whoami`, guard, limits, audit, management API backend only | owner answers Q1, Q3, Q6, Q7 |
| S2 | `elevators.read`, `temperature.read` | S1 |
| S3 | `tickets.read` | S1, Q4 |
| S4 | `tickets.create` (templates, idempotency, origin `partner`, loop flag) | S3 |
| S5 | `partner.webhooks`: endpoints, sealed secrets, enqueue hook, closed payloads, signing, SSRF, worker, retries, dead-letter, circuit, delivery log | S1, Q2, Q5, Q9 |
| S6 | Settings screens ("ממשק לשותפים": partners, tokens, endpoints, delivery log) from an approved mockup, plus the partner guide (EN) with receiver verification examples | S1-S5 |
| S7 | Fable security review of the public surface, fixes, lab activation with the owner's approval of one real target | S6, Q8 |
| S8 | Personal-data opt-ins after counsel | S7, Q4 |

## 14. Owner questions (recommendation first)

1. **Where partners reach the API.** A: a third minimal app on the existing public listener (`/p/v1`, behind the public edge, no session,
   no cookie) - recommended. B: under the remote channel `/arx/...` next to the main app. C: both.
2. **Webhook targets.** A: public HTTPS only, ports 443 / 8443 - recommended for v1. B: also allow an on-site BMS on the local network,
   per endpoint, set by a system administrator on the local channel (a later slice, never loopback / metadata / the machine itself).
3. **Who manages partners.** A: system administrator only (`partner.manage` bound to `system_admin`) - recommended. B: a role the
   administrator may give to a facility manager.
4. **Free text and people in service requests.** A: none in v1; title / description / names only as an opt-in after counsel -
   recommended. B: title and description included by default, names opt-in.
5. **Safety sensor events (leak, smoke, gas, CO) as webhooks.** A: not in v1, an amendment later - recommended. B: include as opt-in
   event types now.
6. **Token lifetime.** A: mandatory expiry, default 90 days, maximum 365 - recommended. B: allow non-expiring tokens for long contracts.
7. **When the person who created a token leaves.** A: the token stays (it belongs to the installation) and administrators are told -
   recommended. B: the token is revoked automatically.
8. **Activation.** A: nothing on a real installation before a Fable security review of the public surface and an owner approval of the
   first real target - recommended. B: lab activation after the internal code review only.
9. **Echo of partner-created requests.** A: a partner does not receive `ticket.created` for requests it opened itself (default on,
   per endpoint) - recommended. B: always send.

## 15. Not done here

No code, no migration file, no route, no UI, no test, no change to main, `release/*` or any other branch. Nothing contacted a partner,
the lab or Home Assistant.

## 16. Build record (PARTNERAPI113-295, 2026-10-23, branch `pilot/PARTNERAPI113-295` on origin/main 2.14.0)

Status: **BUILT, LAB ONLY** - slices S1-S6 in one branch; S7 (security review of the public surface, first real destination) and the
activation stay with the owner. `services/partner/core.GO_LIVE_PERMITTED = False`: both switches are refused ON (409
`go_live_not_permitted`), so nothing in this build can serve `/p/v1` or send a webhook on a real installation.

Owner answers applied (24.10 batch 3, questions 164-172):

| Q | Answer | Where |
|---|---|---|
| 1 (164) | A: third minimal app on the existing public listener | `services/partner/api_app.py`; `PublicApp.__call__` hands `/p/...` to it before the tickets edge |
| 2 (165) | A, public HTTPS only, **ports 9443 / 9453** (never 443 / 8443) | `services/partner/ssrf.ALLOWED_PORTS`; no local-network targets |
| 3 (166) | A: system administrator only | `partner.manage` in `system_admin` only, SYSTEM_PERMISSIONS, LOCAL_ADMIN_PERMISSIONS, sensitive |
| 4 (167) | **B**: title + description by default, names opt-in (off) | per token / endpoint `personal = {ticket_text: true, ticket_people: false}`; any non-default is audited `partner.token.personal_data` |
| 5 (168) | A: no safety-sensor webhooks in v1 | `sensor.*` in `webhooks.EXCLUDED_PREFIXES` |
| 6 (169) | A: expiry mandatory, 90 / 365, editable | settings `partner.token_default_days`, `partner.token_max_days` |
| 7 (170) | A: token stays, managers notified | janitor -> notification `partner.owner_gone`; the list flags `owner_gone` |
| 8 (171) | A: nothing live before the review and the owner's approval of the first destination | `GO_LIVE_PERMITTED = False` |
| 9 (172) | A: no echo, configurable per endpoint | `partner_endpoints.skip_own` (default 1) |

Deviations and decisions of the build (to confirm at review):

1. **Migration number**: PROVISIONAL **0197** (`0197_partner_api.sql`), not 0170 (the task's number); renumbered at integration.
2. **`tickets.origin` stays `inbound`** for a partner request: the CHECK of migration 0079 cannot be widened without rebuilding `tickets`
   (foreign keys cannot be switched off inside the migration transaction). The partner link lives in the new table
   `partner_ticket_links (ticket_id, token_id, client_id, external_ref)`; the author is `partner:<ptk id>`, the timeline event carries
   `via: partner`, the API and the webhook payload say `origin: "partner"`.
3. **Ticket placement**: a token restricted to sites / buildings / floors must send `floor_id` inside its restriction when it opens a request
   (else it could never read it back); an installation-wide token may open a placeless request.
4. **Free text**: with `ticket_text` on (the default, Q4 = B) `tickets.create` accepts title and description; with it off, a ticket template
   of the department (`template_id`) gives the title and free text is refused.
5. **Webhooks follow the notification sources**: an event is enqueued only when the notification engine CREATED or RESOLVED a row
   (`notify._emit` hook) - so a source switched off in the notification settings (the elevator sources are OFF by default) sends no webhook
   either. `ticket.created` comes from the creation path itself (all origins).
6. **Backoff jitter**: each delay is drawn in [base / 2, base] (never an immediate retry), not full jitter in [0, base].
7. **Management API**: answers 404 while both switches are off except `GET/PUT /partners/settings` (section 8), so in this build the card
   shows only the switches (disabled) and the editable limits. All management works from either channel (system administrator + TOTP for an
   Arx-only identity); only switching ON is local-only.
8. **Secret sealing**: `connection_store.seal_partner_secret` (AAD `partner_webhook|<pep id>|<field>`, fields `url`, `secret`, `secret_prev`)
   instead of `seal_service_secret`, whose allow-list is static.
9. **Log hygiene (T10)**: the HTTP client's per-request INFO line (which carries the URL) is dropped while a partner delivery is in flight
   (a logging filter bound to the sending thread's context).
10. **Settings added** (all `partner.*`, never exported or restored - `SETTINGS_KEEP_PREFIXES`): `rate_per_min` 60, `rate_per_hour` 2000,
    `create_per_hour` 30, `create_per_day` 200, `expiry_notice_days` 14, `rotation_overlap_hours` 24 (standing rule: every threshold editable).
    The per-token rate limit is stored on the token (defaults from the settings).
11. **Not built**: `webhooks.self` (reserved), the partner-facing guide (EN, slice 6 text), the private-network target option (Q2 B).
12. **Listener port**: the public listener keeps its container port (18093) behind the tunnel; how 9443 / 9453 are exposed for partners on
    the public side (Cloudflare / firewall) is deployment configuration outside this repository - to confirm with the owner.

Files: `services/partner/{core,ssrf,webhooks,api_app,reads}.py`, `routers/partner.py`, migration 0197, hooks in `services/notify.py`,
`services/tickets/create.py` (`create_by_partner` + the `ticket.created` hook), `services/tickets/public_app.py` / `public_runtime.py`,
`connection_store.py`, `backup.py`, `rbac.py`, `routers/access.py`, `roles.json`, `notify_policy.py` (three `partner.*` notices), `main.py`;
UI `frontend/src/components/sw-partner-api-card.ts`, `frontend/src/api/partners.ts`, `frontend/src/i18n/partners.ts` (Hebrew + English;
Arabic / Russian fall back to Hebrew, dev-marked); tests `tests/test_partner_api_113.py`, `frontend/tests/unit-partner-api.spec.ts`.