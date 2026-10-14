# CR-038 public core - implementation notes (branch `pilot/TICKETS-public-core`)

**What this is:** the foundation of the tickets module's public surface (the first anonymous surface of the product), built as
library code that does not touch the ticket tables: the isolated public listener on container port 18093, its request
hardening, the rate limits, link tokens, verification codes, the hostile-upload pipeline (photos, invoice pages, PDFs), text
hygiene and log hygiene. Slice 4 ("public page + links + directory", spec section 20) implements the storage ports below over
migration 0080 / 0079, adds the ticket routes (`/t/api/ticket`, `status`, `note`, `eta`, `return`) with the helpers exported
here, and does the one-line wiring in the shared files listed in section 5.

**Base:** `origin/integ/2410` @ `240424e0`, with `origin/pilot/TICKETS-spec` @ `589afea7` merged (the spec travels with the
code). Spec: `docs/changes/CR-038-TICKETS-MODULE.md` r2.7; reviews: `private/planning/TICKETS_SPEC_REVIEW_2026-10-13.md` (spec),
`private/planning/TICKETS_PUBLIC_CORE_CODE_REVIEW_2026-10-13.md` (code, section 10 here).

**Rules kept:** new files only - no shared file was edited (no `main.py`, `config.yaml`, `config.py`, `roles.json`, router lists,
migrations, `ha_user_auth.py`, `body_limit.py`, `backup.py`). No new dependency (FastAPI, uvicorn 0.53.0, h11, anyio, Pillow
12.3.0 and the stdlib `zlib` are already there; python-multipart is not used). No device, no network beyond 127.0.0.1, no secret.

## 1. Module map

All under `smplwise_vms/backend/smplwise/services/tickets/`. **The package has no `__init__.py` on this branch** (a namespace
package): slice 1 and the messaging-core branch each create their own `__init__.py` with a different docstring, and a third one
here would only add an add/add conflict. After integration the package is a regular one; nothing here depends on either.

| File | Spec | What |
|---|---|---|
| `public_server.py` | 10.1 | `PublicListener` (`SERVER`): bind in `start()`, own daemon thread `tickets-public`, a fresh asyncio loop, anyio thread limiter of THAT loop = 6 tokens, `PublicConfig` (never reconfigures process logging, never wraps the app; uvicorn's `limit_concurrency` OFF), `PublicServer` (no signal capture), `ConnectionBudget` (8 open connections per untrusted client network, 64 in all -> that connection's request answers a JSON 503 `busy` and it closes; 256 hard -> closed at once; trusted proxies exempt per network), `PublicH11Protocol` (ProtocolLog logging, 10 s request-head deadline, 300 s lifetime retired with `connection: close`, lifetime backstop ABORTS at +120 s, a send buffer that does not move for 30 s is aborted, JSON 400 with the security headers), `stop()` joins (5 s) then forces, `snapshot()` for health |
| `public_http.py` | 10.1-10.4 | `PublicEdge`, the pure ASGI layer in front of the public FastAPI app: 16 requests in flight (JSON 503 `busy` + headers + `Retry-After`), head cap (431), TE + CL refused, module switch, the route allow-list `ROUTES` (the whole public surface of 10.3 + 11A.12 with kinds, body rules, caps, deadlines, idle limits), client network + its source (V3 counters), token header parse + hash, the rate gate (one `RequestCost` per request) before any read, Content-Type / Content-Length rules, 2 body requests in flight per token, body read deadlines + a 5 s idle limit between chunks, cookie / range / conditional headers stripped, response header policy in one canonical order (HSTS included), drains ONLY for a token that proved valid (4 at once), uniform 404, sanitised 500 |
| `public_app.py` | 10.2, 10.3, 10.5, 10.6 | `create_public_app(PublicDeps) -> PublicApp` (`.trusted` for the connection budget); `link_context()` dependency; `read_json()` + the input-free 422 envelope; `parse_client_request_id()`; `Idempotency` + `idempotency_scope(link)` (`link:<id>:<generation>`); `spend_budget(request)` (writes) and `begin_body(request)` (uploads); routes: `GET /t/`, `GET /t/r/{rid}` (same static shell), `GET /t/assets/{name}`, `GET /t/healthz` (records the probe), `POST /t/api/redeem`, `POST /t/api/code/send`, `POST /t/api/code/verify`, `POST /t/api/photo` (32 MiB byte budget, 2 processing slots), `GET /t/api/photo/{attachment_id}`; `PublicDeps.extra_routers` for slice 4's routes |
| `public_ports.py` | - | the Protocols slice 4 implements + `LinkRecord` (with `key_id`) / `CodeRecord` (with `generation`) / `FailureRecord` / `SessionRecord` / `StoredResponse` / `PhotoCounts` / `StoredImage` / `PhotoFile`, and `CachedSwitch` |
| `ratelimit.py` | 10.2 | `ScopedRateLimiter` (scope-parameterised RateLimiter, per-key memory pruned to the key's own window, `block_counters` persistence: `flush` / `restore` / `flush_to(db)` (never raises on a busy write lock) / `restore_from(db)`), `parse_trusted_cidrs`, `client_network`, `classify_client`, `forwarded_values` (cf-connecting-ip / x-forwarded-for last hop), `PublicLimits`, `PublicRateGate` (`open` -> `RequestCost`, `admit` / `failure` / `success` / `spend` / `window` / `trips` / `flush_to` / `restore_from`; a second limiter, scope `tickets_good`, keeps the known-good marks), `RequestCost` (`proved` / `unknown` / `refused_early` / `body_phase` / `effect` / `charges`), `MinuteCounter`, `new_public_limiter()` (scope `tickets_link`, 600 events per key) |
| `links.py` | 10.2, 7.2 | `derive_token`, `token_hash`, `parse_token`, `verify_token`, `limiter_key`, `new_link_id`, redeem ids (`new_redeem_id`, `parse_redeem_id`, `redeem_hash`), code sessions (`new_session_value`, `parse_session`, `session_hash`), `phone_key`, `client_key`, `ua_family`, `validate_public_base_url`, `handler_url` (token in the fragment), `redeem_url` |
| `module_key.py` | 7.4 | `k_tickets` WITH KEY IDS: `<data>/secrets/tickets_key.<id>` + `tickets_key.current` (0600, atomic writes, damaged files refused); `ModuleKey(data_dir, has_links=...)`: `current(create=)`, `get(key_id)`, `__call__`, `current_id`, `ids`, `stage`, `commit`, `retire`, `reload`, `status` |
| `codes.py` | 10.5 | `CodeEngine` (`issue`, `withdraw`, `verify`, `session_ok`, `reset(link)`, `locked_for`) - every read and window per (link, generation); `CodePolicy` (+ `from_settings`), `derive_code`, `code_hash(key, link_id, generation, code)`, `parse_code`, `code_channel` (the D6 rule), `effective_require_code` |
| `image_intake.py` | 10.6, 11A.6A | `reencode` (the whole hostile-image pipeline: a structure walk hands Pillow a METADATA-FREE copy), `png_layout` / `png_scan`, `jpeg_layout`, `exif_orientation` (bounded IFD0 reader), `Layout`, `sniff`, `decode_slot` (the module's own semaphore), `store_image` / `resolve_stored` / `remove_stored` / `confine` / `write_atomic`, `StorageMeter`, `check_photo_quota`, `InFlight` (`on_busy` hook) |
| `cost_files.py` | 11A.6, 11A.6A | `check_pdf` (raw scan + bounded inflate of every zlib stream), `active_markers`, `inflated_streams`, `claim_file_kind`, `assemble_documents` (3 documents x 10 pages, 25 files), `page_fields`, `check_pending_quota`, `pdf_download_headers`, `photo_headers` |
| `public_multipart.py` | 10.6 | `boundary_of`, `params_of` (RFC 2045 parameter tokeniser), `parse_form` (strict, bounded, in memory, no logging), `FieldRule`, `Part` |
| `text_hygiene.py` | 16 (T9) | `clean_text` (+ `KEEP_FORMAT`, NFC), `clean_field`, `clean_str` (pydantic field type), `hidden_characters` (template validation), `csv_cell` / `csv_row`, `AUTO_LINKIFY = False` |
| `public_log.py` | 10.4, 17 | `PublicStats` (health counters, per-link trouble, last probe, decode-time histogram), `log_request` (one stable schema, sampled), `ProtocolLog` (the sanitising logger of the listener's protocol), `exception_summary` |

Tests (all new, `smplwise_vms/backend/tests/`): `tickets_public_fakes.py` (in-memory fakes of every port + `build_world()`, the
harness), `test_tickets_text_hygiene.py`, `test_tickets_links.py`, `test_tickets_ratelimit.py`, `test_tickets_codes.py`,
`test_tickets_image_intake.py`, `test_tickets_cost_files.py`, `test_tickets_public_multipart.py`, `test_tickets_public_app.py`,
`test_tickets_public_server.py`, `test_tickets_public_logs.py`.

## 2. Request path (what happens, in order)

1. **Connection** (`PublicH11Protocol` + `ConnectionBudget`): more than 8 open connections from one untrusted client /24 or /64,
   or more than 64 in all -> the connection's request is answered `503 {"code":"busy","retry_after_s":1}` (security headers,
   `connection: close`); more than 256 -> closed at once. A request head must be complete within 10 s (also on a kept-alive
   connection) and within 16 KiB while incomplete; a malformed request gets `400 {"code":"bad_request"}` with the security
   headers; keep-alive 5 s; a client that stops reading is aborted after 30 s; the lifetime backstop aborts.
2. **Edge** (`PublicEdge`): more than 16 requests in flight -> 503 `busy`; client network and its source; head > 64 headers or
   16 KiB -> 431, TE + CL -> 400 (both a network failure); module off -> uniform 404; unmatched (method, path) -> uniform 404
   (charged to the static budget, 120/min per network); token parse + SHA-256; **rate gate** (`gate.open` -> the request's
   `RequestCost`); body rules (413 / 415: a network failure unless the token is known good); 2 body requests per token in flight;
   `Cookie`, `Range` and conditional headers removed; deadline- and idle-bound receive (no deadline once the body is complete);
   the app runs.
3. **App** (`link_context`): ONE `LinkStore.lookup(token_hash)`; unknown / expired / revoked / past grace -> `cost.unknown()` +
   uniform 404; otherwise `cost.proved(link_id)`; read-only grace (409 `read_only` on writes); code session (`X-Ticket-Session`,
   403 `code_required` on writes). An upload: one upload in flight per link, the byte budget (busy after 5 s, free), the storage
   cap, then `begin_body` (one unit of the photo budget), the body, then at most 2 uploads in their processing (quota, decode,
   store, record) at once.
4. **Answer**: canonical headers (spec 10.4 set + HSTS, `cache-control: no-store` unless the route set one, no `Server`, no
   cookie, no CORS, no `ETag` / `Last-Modified` / `Accept-Ranges`); an answer given before the body was read waits for a small
   body (<= 64 KiB, <= 2 s, 4 at once) ONLY when the token proved valid - every other early answer is sent at once and closes the
   connection. A client that leaves mid-body is recorded as 499 (no error line, no 5xx). One request line (section 6, decision
   25).

The uniform 404 (`404 {"code":"link_unavailable"}`) is byte-identical whoever produces it (edge or app) and for every case: unknown
token, expired, revoked, past grace, old generation, malformed or missing token, unknown path, other method, OPTIONS, HEAD,
absolute-form target, module off (API, shell and healthz). Unknown and dead tokens go through the same path with exactly one
indexed read.

## 3. Interfaces slice 4 must implement (`public_ports.py`)

Contract for every implementation: times are epoch seconds (float, UTC; convert to the `...Z` ISO text of the tables); never a
token, code, session value, redeem id or phone number in clear - only `links.token_hash`, `codes.code_hash`, `links.session_hash`,
`links.redeem_hash`, `phone_key`; every write is one short transaction (no gate held across image work).

| Port | Methods | Backed by (spec) | Notes |
|---|---|---|---|
| `LinkStore` | `lookup(token_hash) -> LinkRecord \| None`; `by_id(link_id)` | `ticket_links` (+ `ticket_assignments.ended_at`, `ticket_contacts.phone_key`, `tickets.number`) | ONE indexed read on `ticket_links.token_hash` (unique). Return the row in ANY state; set `revoked=True` when `revoked_at` is set OR the assignment is no longer current; `grace_until` from the close; `recipient_key` = the contact's `phone_key`; `key_id` = `ticket_links.key_id` (**new column**, code review V4); `sent_via`, `ticket_number`. Purged ticket -> None. |
| `ModuleSwitch` | `module_on() -> bool` (memory only) | `tickets.enabled` | Use `CachedSwitch(read)`; call `refresh()` from the janitor tick and right after `PUT /settings tickets.enabled`. Off until the first refresh (fail closed). |
| `RedeemStore` | `release(rid_hash, now, max_uses) -> (link_id, generation) \| None` | `ticket_link_redeems` | ONE atomic statement: `UPDATE ... SET uses = uses + 1 WHERE id_hash = ? AND expires_at > ? AND uses < ? RETURNING link_id, generation` (W4). |
| `RequestLog` | `get(scope, crid)`, `put(scope, crid, route, status, body) -> bool` | `ticket_requests` (24 h) | Scope `link:<link_id>:<generation>` (`public_app.idempotency_scope`, code review V19). Write the row **in the same transaction as the effect** (W5). Only 2xx answers are stored. |
| `CodeStore` | `latest_code(link_id, generation)`, `code_times_since(link_id, generation, since)`, `replace_code`, `expire_code`, `add_attempt`, `consume`, `failures(link_id, generation)`, `put_failures(link_id, generation, rec)`, `clear_failures(link_id, generation)`, `put_session`, `session` | `ticket_link_codes` (**+ `generation` column**), `ticket_link_failures` (**keyed by (link_id, generation)**), `ticket_link_sessions` | Code review V8: every read and window is per generation. `replace_code`: insert and set `expires_at = now` on every older unconsumed code of the LINK (any generation), in one transaction (W7). `consume`: `UPDATE ... WHERE id = ? AND consumed_at IS NULL`, check rowcount (W7). |
| `CodeSender` | `channel_for(link) -> 'whatsapp' \| 'email' \| None`; `send(link, code_id, channel) -> bool` | the outbox (slice 5b / 7), purpose `code`, priority 0, never held | Implement `channel_for` with `codes.code_channel(...)` (D6). `send` queues the row with `code_id` only; the worker renders the six digits with `codes.derive_code(key(link.key_id), code_id)` at render time (W9). |
| `PhotoSink` | `counts(link) -> PhotoCounts`; `record(link, StoredImage, crid) -> answer`; `open(link, attachment_id) -> PhotoFile \| None` | `ticket_attachments`, `ticket_events`, `ticket_requests` | `record`: the attachment row (`visible_external = 1`), the `photo` timeline row, audit, sliding expiry, and the `ticket_requests` row (scope `link:<id>:<generation>`, crid, `/t/api/photo`, 201, the answer) **in the same transaction** (W5; the fakes do it, a crash-between test proves why) - raising makes the route delete the stored file. `open`: only `visible_external`, not deleted, of the link's ticket (W10); return the absolute path (the route confines it again). |

Other things slice 4 builds with these helpers: the ticket routes as a router in `PublicDeps.extra_routers` (the edge rules for
them already exist in `ROUTES`); `link_context(write=True)` for writes, `read_json(request, Model)` with
`model_config = ConfigDict(extra="forbid", strict=True)` and `text_hygiene.clean_str(...)` fields, `parse_client_request_id`,
`Idempotency(...).run(idempotency_scope(ctx.link), ...)` (the effect's own transaction should also write the `ticket_requests`
row), and **`spend_budget(request)` inside the idempotent work, after the effect** (W18; the edge only checks the 20 writes /
hour budget); an UPLOAD route (slice 9's claim file) calls **`begin_body(request)`** after its slot / memory wait and before
its first read; `ticket_link_access.client_key` = `links.client_key(key, ctx.request.net, links.ua_family(ctx.request.user_agent))`;
the claim routes of slice 9 reuse `image_intake.reencode` / `store_image(..., subdir="costs")`, `cost_files.check_pdf`,
`check_pending_quota`, `assemble_documents`, the `InFlight` guard and the `claim_file` rate kind. The test router in
`tests/test_tickets_public_app.py` (`slice4_router`) shows the pattern.

## 4. Numbers (all from the spec unless marked)

| What | Value |
|---|---|
| Listener | port 18093, 6 worker tokens (*changed*, review V15), backlog 64, graceful stop 3 s, join 5 s, keep-alive 5 s; uvicorn `limit_concurrency` off (*changed*, V5) |
| Connections (*added*, V5 / review 5.2) | 16 requests in flight (JSON 503); 8 open connections per untrusted client /24 or /64, 64 in all (JSON 503 + close), 256 hard (closed at once); a send buffer still for 30 s is aborted; lifetime 300 s (retired), + 120 s backstop (aborted) |
| Head | 16 KiB / 64 headers (431; *added*), 10 s to complete (*added*), TE + CL refused (400; *added*) |
| Bodies | JSON 16 KiB (claim JSON 32 KiB, *chosen*), photo 8 MiB + 64 KiB, invoice file 10 MiB + 64 KiB; deadline 10 s JSON / 60 s upload; 5 s idle between chunks (*added*, V2); 2 body requests in flight per token (*added*); an early answer drains <= 64 KiB for at most 2 s, 4 at once, only for a token that proved valid (*changed*, V1) |
| Rate gate | failed lookups 20/min per /24-/64 network; 300/min installation-wide for tokens and, separately, 300/min for redeem ids (*added*); requests without a well-formed token and early refusals of unproved tokens (413 / 415 / 431 / TE+CL) count per network only (*added*, V1); token 60 req/min (counted once the token proved valid); photo reads their own 120/min per token (*added*, V26); 20 writes/h (spent after the effect), 10 photos/h and 40 invoice files/h (spent when the body phase starts, *changed*, V2); redeem 10/min per network; static + unmatched 120/min per network (*added*); hashed assets 300/min per network (*added*, V26); known-good bypass 24 h, persisted (*added*); 600 events kept per key (*changed*, V9) |
| Codes | 6 digits fixed; TTL 10 min; 1/60 s, 3/h, 6/day per link GENERATION (*changed*, V8); 6/h per recipient; 5 wrong / 15 min -> 30 min lock per generation; session 12 h (never past the link) |
| Photos | JPEG / PNG only; 8 MiB; baseline JPEG 16 MP, progressive JPEG 8 MP and <= 32 scans, sequential <= 4 scans, PNG 8 MP and 8-bit (*changed*, V6); side <= 10 000 px (*added*); out <= 2048 px, JPEG q82; 30 per assignment, 60 per ticket; 2 GiB installation cap (60 s cached walk, re-walked off the lock); one upload in flight per link; 32 MiB of declared upload bodies at once, 2 uploads processing, 1 decode admitted per loop (*added*) |
| PDFs | `%PDF-` at 0, `%%EOF` in the last 1 KiB, 10 MiB, refused names `/JavaScript /JS /Launch /EmbeddedFile /RichMedia /XFA /OpenAction /AA /Encrypt` (as whole names, `#xx` decoded, malformed escapes refused; > 2000 escaped names refused) in the file AND in every inflated zlib stream (max(8 x file, 4 MiB), <= 32 MiB, <= 4000 streams; *added*, V7) |
| Documents | 3 per revision, 1 PDF or 1-10 pages each, 25 files, no duplicate SHA-256; 30 pending per link, pending 24 h |

## 5. Wiring checklist (shared files - one line or block each; owned by slice 1 / slice 4)

1. **Add-on option** `tickets_public: false` - `config.yaml` (`options`, `schema: bool?`, `ports: 18093/tcp: null`,
   `ports_description`), `services/self_update.py OPTION_TYPES` (the test that keeps the three equal), `config.py Settings`
   field + `load_settings` line (the `cast_relay` precedent, `SW_TICKETS_PUBLIC` for a developer backend).
2. **Start** in `main.py _start_janitor` next to the cast relay (in a worker thread - `start()` waits up to 5 s for the listener):
   `if settings.tickets_public: await run_in_threadpool(public_server.SERVER.start, create_public_app(deps))` (W14: never awaited
   on the main loop directly), where `deps` comes from slice 4's store (`PublicDeps(links=..., switch=CachedSwitch(...),
   key=ModuleKey(settings.data_dir, has_links=store.any_key_rows), requests=..., redeems=..., codes=CodeEngine(store, key,
   limiter=limiter), code_sender=..., photos=..., attachments_root=settings.data_dir / "tickets", storage=StorageMeter(...),
   shell_dir=<www-public>, limiter=new_public_limiter(), trusted_proxies=parse_trusted_cidrs(settings_doc.public.trusted_proxy_cidrs),
   client_ip_header=settings_doc.public.client_ip_header)`; assert `limiter.scope == "tickets_link"` (W14). Restore the counters
   right after building the app, AFTER `db.migrate()`: `public_app.gate.restore_from(app.state.db)` (W15).
3. **Stop** in `main.py _stop_janitor` next to `cast_relay.SERVER.stop()`: `await run_in_threadpool(public_server.SERVER.stop)`,
   then `public_app.gate.flush_to(app.state.db)`.
4. **Janitor tick** (guarded steps): `public_app.gate.flush_to(db)` (its own scopes only; no write transaction when nothing
   changed; returns 0 and keeps the batch when the write lock is busy - W15); `switch.refresh()`; slice 4's retention of codes /
   sessions / redeem ids / requests (spec 15.1).
5. **Settings route**: after `PUT /settings` changes `tickets.enabled`, call `switch.refresh()` (W3); a changed
   `tickets.settings.public.trusted_proxy_cidrs` or **`public.client_ip_header`** (`cf-connecting-ip` default, or
   `x-forwarded-for` for another reverse proxy - last hop only; *new setting*, V3) needs a listener restart (or rebuild the app) -
   validate them with `parse_trusted_cidrs` / `ratelimit.CLIENT_IP_HEADERS`, and `public.base_url` with
   `links.validate_public_base_url` (W21). The **address probe** fetches `https://<base_url>/t/healthz` with
   `X-Ticket-Probe: <random 32 chars>`, `follow_redirects=False`, 5 s, the body never shown, and then reads
   `SERVER.snapshot()["stats"]["last_probe"]`: the peer cloudflared connects from and whether the client address came from the
   trusted header (`source == "header"`); anything else is a warning on the settings page (W13).
6. **Health** (`GET /api/v1/tickets/health`, spec 17): `public_server.SERVER.snapshot()` (running, port, error,
   `connections_open`, and `stats`: counters - among them `client_trusted_no_header`, `client_unknown`, `busy_refusals`,
   `connections_busy`, `connections_dropped`, `drains`, `drain_timeouts`, `body_idle_timeouts`, `write_stalls_aborted`,
   `lifetime_closed`, `log_lines_suppressed` -, per-link `busy` / `wasted` uploads, `last_probe`, `decode_ms`) + `app.gate.trips()`
   + `ModuleKey.status()`. Flag: links exist and the key state is not `ok` -> an ERROR line and a red health item (W12).
7. **Bundle**: slice 4's second Vite entry builds `smplwise_vms/www-public/index.html` + `assets/*.{js,css,svg,png,ico}`
   (`shell_dir`; content-hashed names get the asset budget and `immutable`); no inline script or style (CSP
   `script-src 'self'; style-src 'self'`), no fonts (`default-src 'none'`), photos shown through `blob:` URLs after a fetch with
   the token header. Until it exists, `/t/` serves a script-free fallback page. The bundle must stay OUTSIDE `smplwise_vms/www`
   (W16; now a repository test: `test_the_public_bundle_is_never_built_into_the_main_apps_www`).
8. **Backup**: `<data>/tickets/` joins `backup.RESTORABLE_ROOTS` (spec 7.4; W11: disjoint from other modules' roots);
   `block_counters` is not a project table (counters do not travel); **`secrets/` becomes an explicit never-restored name in
   `backup.py`** (today it is excluded only by the whitelist - code review V16: a future `RESTORABLE_ROOTS` addition must not be
   able to include it).
9. **Security note** in `docs/security/` (slice 4, review C13): the token-authorised media exception (`GET /t/api/photo/{id}`).
10. **Install guide** (slice 8, W22): Cloudflare rate-limiting rule on `/t/api/*` and script-injecting features (Rocket Loader,
    e-mail obfuscation, Bot Fight Mode) off for the `t-*` hostname; port 18093 never mapped on the host; the tunnel route's
    `originRequest.keepAliveTimeout` SHORTER than the listener's 5 s keep-alive (e.g. 4 s) and **`originRequest.keepAliveConnections`
    <= 8** (code review V5: cloudflared's default pool is 100 idle connections; the listener's connection budget is 64); the
    mandatory "verify the peer" step = the settings page's address probe (item 5).
11. **Module key** (W12, code review V4): `ModuleKey(data_dir, has_links=...)` where `has_links` answers "does any row depend on a
    key" (any `ticket_links` row or any contact with a `phone_key`) - without it the class never creates a key. `current(create=True)`
    only in the "enable module" settings path; everywhere else `get(row.key_id)` / `current()`. Rotation (a settings action):
    `new = key.stage()` -> ONE transaction: revoke live links (reason `module_key`) and recompute every `phone_key` +
    `phone_key_id = new` -> `key.commit(new)` -> `key.retire(old)` once `SELECT 1 FROM ticket_links WHERE key_id = ? AND
    revoked_at IS NULL` and the contacts query find nothing. Inbound phone matching computes `phone_key` under every id of
    `key.ids()` (at most two during a rotation). Until this is wired, rotation stays disabled in the UI.
12. **Pillow logger** (code review V10): in `main.py` next to `logging.getLogger("httpx").setLevel(logging.WARNING)`, add
    `logging.getLogger("PIL").setLevel(logging.INFO)` (the process's logging owner; `image_intake` pins it at import as well) and
    assert it in a startup test. Since the decoder no longer receives upload metadata (decision 8) this is belt and braces.
13. **Migration 0080 deltas** from this review: `ticket_links.key_id TEXT NOT NULL`; `ticket_contacts.phone_key_id TEXT`;
    `ticket_link_codes.generation INTEGER NOT NULL` (+ index `(link_id, generation, created_at)`); `ticket_link_failures`
    primary key `(link_id, generation)`.
14. **Spec text** to align at integration (owner of the spec): 10.5 / 7.2 code hash formula with the generation (decision 1),
    send caps per generation (decision 5), the uploads paying at their body phase (decision 16).

## 6. Decisions where the spec was ambiguous or silent (the safer reading), and deviations

1. **Codes are derived, not stored** (spec gap). 10.5 stores only `HMAC(k, link_id | code)` and 7.3 forbids `{code}` in the
   outbox parameters, so a queued code message could not know its digits. `derive_code(k_tickets, code_id)` (HMAC of a 128-bit
   random row id, mod 10^6) is as unpredictable as `secrets.randbelow` without the key and lets the worker render the message
   from the row id - the digits are never stored, queued or logged. **Deviation (code review V8):** the stored hash is
   `HMAC(k, link_id | generation | code)`, not the spec's `link_id | code`.
2. **Logging of the listener**: the spec names `access_log=False` and a filter on `uvicorn.error`. In uvicorn 0.53 both act on
   process-wide loggers shared with the main app (`access_log=False` empties `uvicorn.access` and would silence the main app's
   access log). Here `PublicConfig.configure_logging` is a no-op and the protocol class logs through `ProtocolLog` (no access
   line, invalid-request records dropped and counted, exceptions as type + frame) - same intent, no side effect. `access_log`
   etc. are still set on the Config (asserted by a test).
3. **Rate limiter**: the spec asks `RateLimiter` to gain a scope parameter. On this new-files-only branch it is a new class,
   `ScopedRateLimiter` (same table, row format, half-cap rule, bounded keys; plus `check`, `record`, per-scope `horizon_s`).
   Follow-up (optional): re-base `ha_user_auth.RateLimiter` on it as scope `signin`.
4. **Known-good tokens pass the flood caps** (review T1b): a token that resolved to a live link within 24 hours is not
   "unknown", so the 300/min global and the per-network failure caps do not lock out vendors already working; the marks are
   persisted (scope `tickets_good`). A request without a well-formed token never counts against the installation-wide budget
   (it costs no lookup), and redeem ids have a budget of their own. A fresh link's first open during a sustained flood of
   well-formed guesses still meets the 429 (the page says "try again in a minute").
5. **Lock-out without extra DoS** (review T5a): a malformed code and a guess while no code is live are not counted (they cannot
   succeed); the 5 / 15 min / 30 min numbers are unchanged. **Generation-scoped (code review V8):** codes, the failure window
   AND the per-link send caps are per (link, generation), so the manager's "new link" starts clean by construction (a fresh
   send budget too - otherwise a stranger who spent the old message's 3/h could keep the vendor waiting); `reset(link)` is
   defence in depth and also lifts the per-recipient cap a stranger may have spent (the manager's own resend).
6. **PDF scan**: names are matched as whole PDF name tokens with `#xx` escapes decoded - catches `/J#61vaScript`, does not refuse
   `/JSON` or `/AAPL` as a substring scan would; a malformed escape (`/J#avaScript`) is refused; more than 2000 escaped names
   refuse the file (CPU bound). **Every zlib stream is inflated within a bound and scanned too (code review V7)** - the
   reviewer's bound was "4 x file, 32 MiB"; 4 x is tight for text-heavy invoices (content streams compress 5-10 x), so the
   bound is max(8 x file, 4 MiB), <= 32 MiB, <= 4000 streams.
7. **JPEG / PNG structure walks**: `draft` is asked for a long side of 1536, not the literal `(2048, 2048)` box (a 12 MP phone
   photo decodes at 1/2 and is stored at 2016 px - "at most 2048"). Before Pillow: a PNG chunk walk (critical chunks only, bounded
   text / ICC / EXIF, no APNG, no 16-bit) and a JPEG segment walk (8-bit Huffman frames only; lossless / hierarchical /
   arithmetic / 12-bit refused 415). Limits added by code review V6: PNG 8 MP, progressive JPEG 8 MP and 32 scans, sequential 4
   scans (counted in the primary image only - an MPF secondary image or a payload after the primary EOI is cut away). A 16-bit
   PNG answers 415 `unsupported_format` ("send a JPEG or an ordinary PNG").
8. **Pillow logging (finding, made robust - code review V10)**: Pillow's TIFF reader logs EXIF tag VALUES at DEBUG and its PNG
   reader an ICC profile's NAME. The decoder now receives a METADATA-FREE copy (the walks above keep only what decoding needs:
   PNG IHDR / PLTE / tRNS / IDAT / IEND; JPEG SOI, frame, DQT, DHT, DRI, APP0, APP14 and the primary scans), and the EXIF
   orientation is read by a bounded IFD0 reader (the same mapping as `ImageOps.exif_transpose`, tested for all 8 values). No
   upload metadata reaches any logger at any level (the log scan captures `PIL` and its readers at level 1). The INFO pin on `PIL`
   stays (wiring item 12). Accepted consequence: a PNG's eXIf orientation is honoured, its gamma / ICC are dropped (they were
   dropped from the output before as well).
9. **Edge additions not in the spec table**: 431 head cap; TE + CL refused; a short drain (<= 64 KiB, <= 2 s, 4 at once) of a
   small unread body before an early answer to a token that PROVED VALID (a socket closed on unread bytes is RESET and the client
   can lose the answer) - none for anything else (code review V1: unknown tokens, module off, unknown paths, dead tokens, 429s
   are answered at once and closed); unmatched paths charged to the static budget; `Range` / conditional request headers
   dropped and cache validators never sent; head deadline; over-age connections retired with `connection: close` on their next
   answer; client disconnects recorded as 499; HSTS (`max-age=31536000; includeSubDomains`, V24 - the public hostname is
   HTTPS-only by construction).
10. **Module off** answers the uniform 404 to everything including the shell and `/t/healthz` (spec 6 / C8 literal). The
    address probe therefore only succeeds while the module is on.
11. **Status codes chosen** (the spec names only some): 403 `code_required`, 408 `body_timeout`, 409 `read_only` /
    `request_id_reused` / `request_in_progress` / `code_not_required` / `photo_limit` / `file_limit`, 413 `too_large`, 415
    `unsupported_media_type` / `unsupported_format` / `webp_refused` / `heic_refused`, 422 `invalid` (+ `fields`) / `image_invalid`
    / `too_many_pixels` / `pdf_refused` / `pdf_invalid` / `code_malformed` / `code_missing` / `code_expired` / `code_invalid` (+
    `attempts_left`), 429 `rate_limited` / `busy` / `code_locked` (+ `retry_after_s`, `Retry-After`), 431 `headers_too_large`,
    503 `busy` (capacity) / `code_unavailable`, 507 `storage_full`, 500 `server_error`. The page maps codes to its four-language
    strings.
12. **Trusted proxies**: `parse_trusted_cidrs` refuses networks broader than /8 (IPv4) or /32 (IPv6); a repeated or malformed
    `CF-Connecting-IP` from a trusted peer counts as the peer (and is counted in health). `X-Forwarded-For` (the option for another
    reverse proxy) is read from its LAST hop only. **Public base URL**: a port other than 443 and the reserved names (localhost,
    homeassistant, supervisor, `.local` ...) are refused too.
13. **File names**: the image-validation half of the spec's `attachments.py` is `image_intake.py` (slice 1 plans its own
    `attachments.py` for internal uploads - it should call `image_intake.reencode` / `store_image`); codes live in `codes.py`
    (the spec puts them in `links.py`); `text_hygiene.clean_text` keeps the semantics of slice 1's `model.clean_text` and also
    normalises U+2028 / U+2029 / VT / FF / NEL, cuts stacked combining marks, keeps the spelling format characters and applies
    NFC - one of the two should delegate at integration.
14. **Idempotency** replays 2xx answers only and claims (scope, id) in the process before reading the log; a concurrent duplicate
    is 409 `request_in_progress` (retryable); a failing `RequestLog.put` after a stored effect still answers the success. The scope
    carries the generation (V19).
15. **Times**: the ports use epoch seconds; the tables keep ISO text (slice 4 converts).
16. **What a request costs is one object (code review 5.1)**: `RequestCost`, opened at admission. JSON writes spend their unit
    AFTER the effect (a refused, replayed or failed write costs nothing). **Uploads spend their unit when the body phase starts,
    whatever follows (code review V2)** - a stored photo, a replay (it read a whole body too: a free replay would be the V2 loop
    again), a refusal after the body, a 408 / 413 / 499. A `busy` refusal before the body costs nothing. A legitimate retry after a
    lost answer therefore costs one more unit of the 10 photos / hour.
17. **First independent review** (read-only, 2026-10-13, after the first complete version): 2 medium + 14 low findings, all fixed
    on this branch (commit `eb5b2b06`), each with a test.
18. **Key ids from day one (code review V4 / 5.4)**: files `tickets_key.<id>` + `tickets_key.current` instead of one
    `tickets_key`; every derivation uses the id its row names. Spec 7.4 names the single file; nothing has shipped yet.
19. **Cf characters kept (code review V11)**: ZWNJ and the prepended concatenation marks stay. **Deviation from the review's
    list:** U+061C (ARABIC LETTER MARK) is a bidi control like LRM / RLM and stays removed.
20. **Per-network connection budget exempts trusted proxies** (review 5.2 suggested 3 per network): behind cloudflared every
    client arrives over the proxy's own connections, so a per-network cap on the proxy's address would cap the whole tunnel. The
    cap (8, not 3: a phone browser opens up to 6) therefore guards direct peers - a mapped port, the LAN, an add-on outside the
    trusted range; the tunnel's own pool is capped in the install guide.
21. **Connection caps answer JSON**: past the soft caps a connection is served once - its request read (within the 10 s head
    deadline) and answered the edge's JSON 503 - rather than closed, so the page (through cloudflared) can say "busy, retry"; past
    the hard cap it is closed unread (file descriptors are the process's).
22. **Slow readers (found while fixing V5)**: a response the client never reads would hold a request slot forever (uvicorn has no
    write timeout, and a plain close waits for the buffer to flush - forever, if the peer keeps a zero window). A send buffer
    that does not move for 30 s is aborted, and the lifetime backstop aborts instead of closing.
23. **Per-token body requests**: at most 2 requests WITH a body in flight per token (*added*): one link holder trickling JSON
    bodies (10 s deadline, 60 requests / minute) could otherwise hold 10 request slots of 16.
24. **Health counters per link** keep the 32 noisiest links (12-character id prefixes), `busy` (uploads refused for capacity)
    and `wasted` (uploads paid for that stored nothing - a trickler's signature).
25. **Request line (code review 5.7)**: `public request method= route= status= ms= cost= drain_ms= body_ms=` - INFO for every 4xx and
    1 in 100 successes, WARNING for a 5xx, at most 60 such lines a minute (the rest counted in `log_lines_suppressed`), DEBUG for
    all when enabled. The route TEMPLATE, never the path; `cost` is `RequestCost.charges` (e.g. `good+body`, `unknown`, `early`).

## 7. Known limits (stated, accepted or residual)

- Every add-on on the hassio network (172.30.32.0/23) is inside the default trusted-proxy network and can set
  `CF-Connecting-IP`; only the installation-wide caps hold against such a peer (review T1a residual). A trusted proxy is also
  exempt from the per-network connection budget (decision 20).
- The PDF scan does not decode streams under other filters (LZW, ASCII85, ASCIIHex, RunLength) or filter chains (pinned by
  `test_known_limit_other_filters_are_not_decoded`); the controls are "never parsed or rendered" and the sandboxed download
  headers. A hostile PDF can still reach a reviewer's own viewer (spec S25).
- Pillow / libjpeg / zlib decoder vulnerabilities remain a dependency risk (`upstream_watch.json` `py-pillow`).
- The SQLite write gate and the GIL are still shared with the main app (spec S13 residual); public writes are rate-limited and at
  most 2 uploads hold worker threads.
- A large unread upload body is cut with `connection: close`; the client may get a TCP reset instead of the 4xx (the page's
  retry with the same `client_request_id` covers it - and costs a unit, decision 16).
- A token / code limiter row survives a restart only once a key reached half a cap (the RateLimiter rule); the per-link code caps
  are counted over the code rows and always survive. Known-good marks are written at every flush (30 s): a crash can lose the
  last 30 s of them.
- The per-recipient code cap needs the contact's `phone_key`; a contact without a phone (e-mail only) has only the per-link caps.
- During a sustained flood of WELL-FORMED token guesses from many networks (an IPv6 /64-rotating client reaches the 300/min
  installation budget easily), a freshly sent link's first open - and an e-mail redeem during a redeem flood - can meet the 429
  (review T1b residual). Vendors whose token worked within 24 h are not affected. The Cloudflare rate-limiting rule is the
  first line (install guide).
- Budgets are checked at admission and spent after the effect (JSON writes) or at the body phase (uploads): two concurrent writes
  of one link can both pass the last free unit (a small overshoot; at most 2 body requests per token are in flight anyway).
- Idempotency is atomic with the effect only when slice 4 writes the `ticket_requests` row inside the effect's transaction (W5;
  proven with the fakes, to be proven over the real store by slice 4); the in-process claim covers concurrent duplicates.
- Anyone holding a forwarded link can lock the code entry of THAT generation for 30 minutes (spec S10, accepted; the manager's
  new link is a new generation and starts clean).
- A link holder can still occupy upload memory: each trickling upload holds its declared length (<= 8 MiB) of the 32 MiB budget
  for <= 60 s and pays one photo unit per attempt (10 / hour per link): about 24 forwarded links would be needed to hold all
  of it continuously (code review V2 residual, accepted).
- Escalating back-off for unknown-token networks is not implemented (192-bit tokens; 20 lookups/min per network is the spec's
  rate); the code lock is the meaningful lock-out.
- anyio worker threads of a stopped listener loop stay as idle daemon threads until the process ends (bounded by 6).
- A PNG's gamma / colour profile are not applied (dropped before the decode, as they were dropped from the output before).

## 8. UNVERIFIED (needs the owner's environment, the Linux image or a later slice)

- **Cloudflare tunnel to container port 18093** on the owner's installation (spec 22 item 4): reachability of a second container
  port through `cloudflared`, the source address cloudflared connects from (inside 172.30.32.0/23 is assumed - the address probe
  of wiring item 5 makes it visible), whether Cloudflare streams request bodies to the origin or buffers them (V1 / V2 are only
  reachable from the internet if it streams), the tunnel's origin keep-alive (must be below 5 s) and pool size (<= 8), and how
  cloudflared reports the connection-budget 503 / a connection closed at the hard cap to the browser.
- The runtime is Linux (the add-on image); every test here ran on the Windows workstation (Proactor event loop, Windows TCP
  stack). The listener's own loop is a stdlib asyncio loop on both. `SO_REUSEADDR` is set on Linux only. The header-flood test
  asserts the 400 bytes on Linux and tolerates a reset on Windows only - so its Linux branch has not run yet.
- **Peak memory per decode path** (code review V6): `test_peak_rss_of_one_decode_per_path` measures it in a fresh interpreter;
  it runs only on Linux with `SW_MEASURE_RSS=1` (NOT_RUN here: no runner job was started). Its 400 MB bound is a guess until
  measured.
- uvicorn 0.53.0 behaviours the design rests on are asserted by tests against the pinned version (signal capture skipped off the
  main thread, `configure_logging` side effects, `self.app` per protocol instance, h11 incomplete-event cap, `connection: close`
  ending a cycle); a uvicorn upgrade must re-run `test_tickets_public_server.py`.
- Real phone uploads (iPhone HEIC conversion to JPEG, Android camera JPEGs with large EXIF and MPF gain maps) were not tried; the
  corpus is synthetic.
- W5 / W7 over the real SQLite store (code review 4.1 item 9) - slice 4, before the first live link.
- The full backend suite on the runner was NOT run; only this branch's tests ran locally.

## 9. Tests (local, Windows workstation, `C:\cloude\smplwisebms\.venv` Python 3.12.10, one process)

Command (from `smplwise_vms/backend`): `python -m pytest tests/test_tickets_text_hygiene.py tests/test_tickets_links.py
tests/test_tickets_ratelimit.py tests/test_tickets_codes.py tests/test_tickets_image_intake.py tests/test_tickets_cost_files.py
tests/test_tickets_public_multipart.py tests/test_tickets_public_app.py tests/test_tickets_public_server.py
tests/test_tickets_public_logs.py -q`

| File | Tests | Covers |
|---|---|---|
| `test_tickets_text_hygiene.py` | 25 | bidi / zero-width / controls / noncharacters, the kept spelling format characters and NFC, line handling, combining marks (incl. enclosing and class-0 marks), length after cleaning, pydantic type, template check, random-text fuzz, CSV formula escaping |
| `test_tickets_links.py` | 39 | spec token formula (192 bits), generation, hash-only, strict parsing fuzz, mutated tokens, redeem ids, sessions, keyed digests, public URL rules, fragment-only transport; key ids: creation only after a link check, a restore without secrets/ refused, damaged files, an interrupted first creation, stage / commit / retire rotation |
| `test_tickets_ratelimit.py` | 30 | windows, retry-after, sliding lock, bounded keys, protected keys under an address-rotating flood, block_counters round trip (sqlite + the real `Database`), a busy batch, `flush_to` under a write lock held by another connection, exact counting under 16 threads, trusted-proxy keying, flood with known-good bypass (persisted across a restart), token-less floods, the separate redeem budget, unknown tokens creating no key, the request cost object on every exit, per-key memory, `CachedSwitch` |
| `test_tickets_codes.py` | 43 | derivation and storage (the generation in the hash), uniformity, parsing (incl. Arabic-Indic digits) + fuzz, send caps, invalidation, per-recipient cap, lock and window, not-counted guesses, reset, a new generation without reset (V8, written red first), withdraw, 40 parallel guesses, 8 parallel correct codes, policy bounds, D6 rule in all 64 combinations |
| `test_tickets_image_intake.py` | 79 (3 skipped) | re-encode, bounds, phone sizes, metadata stripping, no metadata in any log record with Pillow's loggers at level 1, the orientation reader against `exif_transpose` (8 values, both byte orders) and broken EXIF blocks, polyglots, PNG chunk attacks, the metadata-free decoder copy (EXIF / ICC / XMP / COM / Photoshop / MPF / trailing payload), refused frames, 16-bit PNG, PNG and progressive 8 MP caps, pixel and zlib bombs (code + time), scan bombs, truncation, every refused type, own semaphore, storage, quotas, in-flight guard; peak RSS per path (Linux + `SW_MEASURE_RSS=1` only: the 3 skipped) |
| `test_tickets_cost_files.py` | 64 | each refused name, encryption, `#xx` and malformed spellings, look-alike names, magic / trailer / size, names inside a compressed object stream found, a compressed invoice accepted, inflate bombs and stream counts, a corrupt stream, the pinned remaining limit (other filters), scan cost bounds, documents and pages rules, pending quota, download headers |
| `test_tickets_public_multipart.py` | 41 | exact form reading, boundary rules, every refusal, quoted parameters with `;` and escaped quotes, broken parameter syntax, fuzz |
| `test_tickets_public_app.py` | 54 | only /t/ routes, headers on every answer, no cookie / CORS, byte-identical uniform 404, one lookup per dead token, rate gate before any lookup, token-less floods, TE + CL, trusted proxy and the V3 health counters / probe, X-Forwarded-For last hop, JSON-only and caps, 422 without input, text cleaning, idempotency (concurrency, the generation scope, a crash between the effect and the request row), grace, code flow, lock, redeem, photos (re-encode, replay, refusals, storage full, failed record, scoping, range / conditional requests ignored, one unit per body phase, writes spent after the effect), photo reads' own window, the asset budget, 500 without data, shell and assets, missing key fails closed |
| `test_tickets_public_server.py` | 36 | Config values (uvicorn's cap off, the budget), no logging side effect, never wrapped at TRACE, no signal capture, own thread / loop / 6-token pool, start / stop / busy port, route enumeration compared byte for byte (19 accepted scans, 4 refused), malformed requests, TE + CL, head floods, slow heads, over-age connections retired, the lifetime backstop mid-request, body deadline, early refusals answered at once unless the token proved valid, the V1 shape (written red first), the V2 shape (written red first), idle keep-alive not counted, 16 requests in flight -> JSON 503, the per-network and hard connection caps, a client that stops reading, large vs small unread bodies, client disconnects, keep-alive, decoder held elsewhere, a held write gate, one upload in flight (busy free, idle cut, unit paid), CF-Connecting-IP from a trusted peer, the main app serves no /t/ route, no public bundle in www (W16), no FastAPI body readers in the package (W17) |
| `test_tickets_public_logs.py` | 1 | the log scan described in its docstring (now with PIL, starlette, fastapi, anyio at level 1, a PNG with tEXt / iCCP / eXIf, a progressive JPEG, the connection budget) |
| **Total** | **412 collected: 409 passed, 3 skipped** | about 2-3 minutes on the workstation (one process) |

**NOT_RUN:** the backend suite and every other tier on the shared runner (no `run_smart.py` job was started); the Linux-only
measurement and the Linux branch of the header-flood test; frontend / Playwright (nothing of the frontend is built on this
branch); any live check (no device, no tunnel).

## 10. Code review 2026-10-13 (`private/planning/TICKETS_PUBLIC_CORE_CODE_REVIEW_2026-10-13.md`) - what was done

| # | Sev | Finding | Status |
|---|---|---|---|
| V1 | H | uncounted 2 s drain (415 with a never-valid token, module-off 404, dead-token 404) | **Fixed** - drain only for a proved token, 4 at once, counted; early refusals of unproved tokens cost a network failure. Red test first. |
| V2 | H | upload slot held by a trickle, 408 free | **Fixed** - byte budget (32 MiB), unit paid at the body phase (408 / 413 / 499 / replay), 5 s idle limit, 2 processing slots, 6 tokens, per-link health. Red test first. |
| V3 | M | client keying depends on an unverified peer | **Fixed** - health counters, probe record with nonce, configurable header (cf-connecting-ip / x-forwarded-for last hop). The owner's tunnel stays UNVERIFIED. |
| V4 | M | key rotation / creation not atomic with the DB | **Fixed** - key ids, stage / commit / retire, `has_links` refusal inside the class, `status()`. The DB side is slice 4 (wiring 11, 13). |
| V5 | M | the cap counts idle keep-alive connections, bare 503 | **Fixed** - request cap in the edge, connection budget at the protocol layer, JSON 503 with headers; install guide `keepAliveConnections` <= 8. |
| V6 | M | decode memory peaks | **Fixed** - 16-bit PNG refused, PNG 8 MP, progressive 8 MP / 32 scans, sequential 4 scans, decode histogram. Peak RSS: a Linux measurement test, NOT_RUN. |
| V7 | M | PDF names in object streams invisible | **Fixed** - bounded inflate of zlib streams, malformed escapes refused; other filters remain the stated limit. |
| V8 | L-M | codes / failures not generation-scoped | **Fixed** - generation in the HMAC, the code row, the lookups, the failure window and the send caps. Red test first. |
| V9 | L | per-key memory | **Fixed** - 600 events, pruned to each key's own window. |
| V10 | L | Pillow logger pinned at import only | **Fixed robustly** - the decoder never sees metadata; the scan captures PIL at level 1. The `main.py` line is wiring item 12 (shared file). |
| V11 | L | Cf removal too wide, no NFC | **Fixed** - ZWNJ and the prepended marks kept, NFC. U+061C stays removed (deviation, decision 19). |
| V12, V13, V15, V16-V18, V21-V23, V25 | OK | - | No change needed; V15's THREADPOOL_TOKENS 6 done; V16's backup denylist = wiring item 8. |
| V14 | - | covered by V1 / V2 | Done with them. |
| V19 | OK | idempotency scope across generations | **Done** - `link:<id>:<generation>`. |
| V20 | OK | `;` inside a quoted filename | **Done** - RFC 2045 tokeniser. |
| V24 | L | no HSTS | **Done**. |
| V26 | L | asset / photo-read budgets | **Done** - hashed assets 300/min per network, photo reads 120/min per token. |
| 4.1 #9 | - | W5 / W7 over the real store | **Deferred to slice 4** (the real store does not exist on this branch); the fakes now follow W5 and a crash-between test documents it. |

Section 2 of the review (tests that did not prove their claim): route enumeration now compares exact bytes (and lists what h11
refuses); the tautological hash-timing test is dropped; the bomb and 16-bit tests assert code and time; the header-flood reset
tolerance is Windows-only; idempotency atomicity is exercised (crash between effect and request row, with a control); a held
write gate is tested (event-driven); `flush_to` under a real held write lock; the log scan's logger list widened with a PNG
tEXt and a progressive JPEG; the V1 / V2 / V8 shapes; the lifetime backstop; the `www/t/` guard is a repository test.

## 11. Wiring-trap checklist (W1-W22, from the code review section 3)

Each line is a way slice 4 / 8 can re-open a hole. "Here" = what this branch already enforces or provides.

| # | Trap | Hole it reopens | Check | Here |
|---|---|---|---|---|
| W1 | `LinkStore.lookup` does more than one indexed read, or reads differently per state | timing / enumeration between link states | `EXPLAIN QUERY PLAN` shows one `SEARCH ... USING INDEX (token_hash)`; the row is returned in every state and `LinkRecord.available()` decides | the app calls `lookup` exactly once per request (tested with the fakes); the SQL check is slice 4's |
| W2 | `revoked` does not fold in "assignment no longer current" or `grace_until` from the close | a returned / reassigned vendor keeps writing | unit test per state transition against the real store | `LinkRecord` docstring states it |
| W3 | `ModuleSwitch` as a per-request settings read, or `refresh()` not called after `PUT /settings` and in the janitor | module-off not honoured, or a DB read per anonymous request | `refresh()` in both places; a test that flips the setting and asserts the next 404 | `CachedSwitch` (fail closed); wiring items 4, 5 |
| W4 | `RedeemStore.release` as read-then-update | a 4th+ release under concurrency | one `UPDATE ... WHERE ... AND uses < ? RETURNING` | port docstring + section 3 |
| W5 | `RequestLog.put` / `PhotoSink.record` not in the same transaction as the effect | a retry stores the photo twice | `record` writes the `ticket_requests` row; a kill-between test | the fakes do it; `test_a_crash_between_the_effect_and_the_request_row_never_stores_twice` (with a control) |
| W6 | port writes holding the write gate across image work | the shared gate stalls the main app (S13) | every port write one short transaction; `test_no_manual_transaction_control_outside_db_py` | the route stores the image BEFORE `record`; `test_uploads_blocked_in_a_held_write_gate_never_stall_lookups` |
| W7 | `replace_code` not invalidating atomically; `consume` not compare-and-set | two live codes; two sessions from one code | the two statements of section 3 | fakes atomic; 8 parallel correct codes -> one session (tested) |
| W8 | "new link" bumps the generation without `reset()` | old code valid, lock carried over | - | **closed by V8**: generation-scoped; `reset(link)` is defence in depth |
| W9 | `CodeSender.send` queues the digits | the code in the outbox, worker logs, backups | grep test on the outbox row; `derive_code` at render time only | `send(link, code_id, channel)` takes no digits |
| W10 | `PhotoSink.open` without `visible_external`, `deleted_at` or the link's ticket | cross-ticket photo read | `open()` joins on the link's ticket id; two-link test | the route confines the path; scoping tested with the fakes |
| W11 | `attachments_root` shared with another module, or `<data>/tickets/` not restorable | photos not restorable | disjoint roots; restore test | wiring item 8 |
| W12 | `create=True` on the request path or at startup with links present | a restore without secrets/ silently kills every link | `create=True` only in "enable module" with zero links; startup ERROR + health flag | **enforced in `ModuleKey`** (`has_links`, no check -> no creation); `status()` for the flag |
| W13 | trusted proxies left at the default unverified; changed without a restart | every client in one bucket | the address probe reports the peer; health counter | `client_trusted_no_header` / `client_unknown` counters, `last_probe` with nonce; wiring item 5 |
| W14 | the listener started on the main loop, or the main app's limiter passed | `start()` blocks the main loop 5 s; scopes mixed | wiring item 2 exactly; `limiter.scope == "tickets_link"` | `new_public_limiter()`; wiring item 2 |
| W15 | `restore_from` before `migrate()`, `flush_to` outside the guarded step | counters lost, or the janitor stopped | guarded-step pattern | **`flush_to` never raises on a busy lock** (tested); wiring items 2, 4 |
| W16 | the public bundle built into `smplwise_vms/www/` | the public page under the Ingress origin | repository test | **repository test** |
| W17 | routes with FastAPI `Body` / `Form` / `File` / `UploadFile` | the body read before `link_context`, spooling, `input` in 422s | lint | **repository test** (no such import in the package) |
| W18 | a write route forgets `spend_budget` (or calls it before the effect) | the write budget never spent (or spent on refusals) | per-route test: N successes = N units | the test router does it; `test_write_routes_spend_after_the_effect_only` |
| W19 | a path id used in a filesystem path without `confine` | path traversal (bounded by the edge regex) | `confine` on every file path | `photo_get` confines |
| W20 | a vendor URL shown as a link; `unsafeHTML` / `innerHTML` | phishing / XSS inside the CSP | `AUTO_LINKIFY = False`; a Playwright check that no `<a>` has a vendor `href` | `text_hygiene.AUTO_LINKIFY`; Playwright is slice 4's |
| W21 | `public.base_url` validated otherwise; the probe following redirects or showing the body | SSRF (spec T11) | `follow_redirects=False`, 5 s, body never shown | `links.validate_public_base_url`; wiring item 5 |
| W22 | install guide: port mapped; keep-alive / pool; Cloudflare rules; Rocket Loader etc. | V3, V5, a broken CSP page | slice 8 checklist | wiring item 10 |

## 12. "What I would build differently" (code review section 5) - status

1. **One cost object per request** - **done**: `ratelimit.RequestCost` (`gate.open`), every exit decides through it; the edge's
   flags remain only for the body state.
2. **A connection budget per client network at the protocol layer** - **done**: `public_server.ConnectionBudget` in
   `connection_made` / `connection_lost` (8 per untrusted network, trusted proxies exempt - decision 20).
3. **Bytes, not slots, for upload memory** - **done**: a 32 MiB byte budget next to `MAX_BYTES` (`UPLOAD_MEMORY_BYTES`).
4. **Key ids from day one** - **done** (`module_key`); the columns are wiring item 13.
5. **The generation in every per-link secret derivation** - **done** (codes, failure window, send caps, idempotency scope).
6. **The PDF path: inflate-and-scan or drop the scan** - **inflate-and-scan**, with the remaining limit stated plainly.
7. **One request line with a stable schema, sampled** - **done** (decision 25).
8. **Fewer wall-clock assertions** - the new tests are event-driven where they can be (held write gate, busy before the body,
   the V1 / V2 shapes assert a bound only on the healthy path); the remaining wall-clock bounds keep `sw_time_factor()`.
