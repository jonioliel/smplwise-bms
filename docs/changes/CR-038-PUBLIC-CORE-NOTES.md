# CR-038 public core - implementation notes (branch `pilot/TICKETS-public-core`)

**What this is:** the foundation of the tickets module's public surface (the first anonymous surface of the product), built as
library code that does not touch the ticket tables: the isolated public listener on container port 18093, its request
hardening, the rate limits, link tokens, verification codes, the hostile-upload pipeline (photos, invoice pages, PDFs), text
hygiene and log hygiene. Slice 4 ("public page + links + directory", spec section 20) implements the storage ports below over
migration 0080 / 0079, adds the ticket routes (`/t/api/ticket`, `status`, `note`, `eta`, `return`) with the helpers exported
here, and does the one-line wiring in the shared files listed in section 5.

**Base:** `origin/integ/2410` @ `240424e0`, with `origin/pilot/TICKETS-spec` @ `589afea7` merged (the spec travels with the
code). Spec: `docs/changes/CR-038-TICKETS-MODULE.md` r2.7; review: `private/planning/TICKETS_SPEC_REVIEW_2026-10-13.md`.

**Rules kept:** new files only - no shared file was edited (no `main.py`, `config.yaml`, `config.py`, `roles.json`, router lists,
migrations, `ha_user_auth.py`, `body_limit.py`). No new dependency (FastAPI, uvicorn 0.53.0, h11, anyio, Pillow 12.3.0 are already
in `requirements.txt`; python-multipart is not used). No device, no network beyond 127.0.0.1, no secret.

## 1. Module map

All under `smplwise_vms/backend/smplwise/services/tickets/`. **The package has no `__init__.py` on this branch** (a namespace
package): slice 1 and the messaging-core branch each create their own `__init__.py` with a different docstring, and a third one
here would only add an add/add conflict. After integration the package is a regular one; nothing here depends on either.

| File | Spec | What |
|---|---|---|
| `public_server.py` | 10.1 | `PublicListener` (`SERVER`): bind in `start()`, own daemon thread `tickets-public`, a fresh asyncio loop, anyio thread limiter of THAT loop = 4 tokens, `PublicConfig` (never reconfigures process logging, never wraps the app), `PublicServer` (no signal capture), `PublicH11Protocol` (ProtocolLog logging, 10 s request-head deadline, 300 s connection lifetime between requests, JSON 400 with the security headers), `stop()` joins (5 s) then forces, `snapshot()` for health |
| `public_http.py` | 10.1-10.4 | `PublicEdge`, the pure ASGI layer in front of the public FastAPI app: head cap (431), module switch, the route allow-list `ROUTES` (the whole public surface of 10.3 + 11A.12 with kinds, body rules, caps, deadlines), client network, token header parse + hash, the rate gate before any read, Content-Type / Content-Length rules, body read deadlines, cookie stripping, response header policy in one canonical order, drain-before-early-answer, uniform 404, sanitised 500 |
| `public_app.py` | 10.2, 10.3, 10.5, 10.6 | `create_public_app(PublicDeps) -> PublicApp`; `link_context()` dependency; `read_json()` + the input-free 422 envelope; `parse_client_request_id()`; `Idempotency`; routes: `GET /t/`, `GET /t/r/{rid}` (same static shell), `GET /t/assets/{name}`, `GET /t/healthz`, `POST /t/api/redeem`, `POST /t/api/code/send`, `POST /t/api/code/verify`, `POST /t/api/photo`, `GET /t/api/photo/{attachment_id}`; `PublicDeps.extra_routers` for slice 4's routes |
| `public_ports.py` | - | the Protocols slice 4 implements + `LinkRecord` / `CodeRecord` / `FailureRecord` / `SessionRecord` / `StoredResponse` / `PhotoCounts` / `StoredImage` / `PhotoFile`, and `CachedSwitch` |
| `ratelimit.py` | 10.2 | `ScopedRateLimiter` (scope-parameterised RateLimiter, `block_counters` persistence: `flush` / `restore` / `flush_to(db)` / `restore_from(db)`), `parse_trusted_cidrs`, `client_network`, `PublicLimits`, `PublicRateGate` (`admit` / `failure` / `success` / `trips`), `MinuteCounter`, `new_public_limiter()` (scope `tickets_link`) |
| `links.py` | 10.2, 7.2 | `derive_token`, `token_hash`, `parse_token`, `verify_token`, `limiter_key`, `new_link_id`, redeem ids (`new_redeem_id`, `parse_redeem_id`, `redeem_hash`), code sessions (`new_session_value`, `parse_session`, `session_hash`), `phone_key`, `client_key`, `ua_family`, `validate_public_base_url`, `handler_url` (token in the fragment), `redeem_url` |
| `module_key.py` | 7.4 | `k_tickets` in `<data>/secrets/tickets_key` (0600, atomic write, damaged file refused), `load`, `rotate`, `ModuleKey` (cached provider, callable) |
| `codes.py` | 10.5 | `CodeEngine` (`issue`, `withdraw`, `verify`, `session_ok`, `reset`, `locked_for`), `CodePolicy` (+ `from_settings`), `derive_code`, `code_hash`, `parse_code`, `code_channel` (the D6 rule), `effective_require_code` |
| `image_intake.py` | 10.6, 11A.6A | `reencode` (the whole hostile-image pipeline), `png_scan`, `sniff`, `decode_slot` (the module's own semaphore), `store_image` / `resolve_stored` / `remove_stored` / `confine` / `write_atomic`, `StorageMeter`, `check_photo_quota`, `InFlight` |
| `cost_files.py` | 11A.6, 11A.6A | `check_pdf`, `active_markers`, `claim_file_kind`, `assemble_documents` (3 documents x 10 pages, 25 files), `page_fields`, `check_pending_quota`, `pdf_download_headers`, `photo_headers` |
| `public_multipart.py` | 10.6 | `boundary_of`, `parse_form` (strict, bounded, in memory, no logging), `FieldRule`, `Part` |
| `text_hygiene.py` | 16 (T9) | `clean_text`, `clean_field`, `clean_str` (pydantic field type), `hidden_characters` (template validation), `csv_cell` / `csv_row`, `AUTO_LINKIFY = False` |
| `public_log.py` | 10.4, 17 | `PublicStats` (health counters), `log_request` (route template only), `ProtocolLog` (the sanitising logger of the listener's protocol), `exception_summary` |

Tests (all new, `smplwise_vms/backend/tests/`): `tickets_public_fakes.py` (in-memory fakes of every port + `build_world()`, the
harness), `test_tickets_text_hygiene.py`, `test_tickets_links.py`, `test_tickets_ratelimit.py`, `test_tickets_codes.py`,
`test_tickets_image_intake.py`, `test_tickets_cost_files.py`, `test_tickets_public_multipart.py`, `test_tickets_public_app.py`,
`test_tickets_public_server.py`, `test_tickets_public_logs.py`.

## 2. Request path (what happens, in order)

1. **uvicorn / h11** (`PublicH11Protocol`): a request head must be complete within 10 s (also on a kept-alive connection) and
   within 16 KiB while incomplete; a malformed request gets `400 {"code":"bad_request"}` with the security headers; at most 16
   concurrent connections (uvicorn counts the arriving one: 15 open + the new one gets 503); keep-alive 5 s.
2. **Edge** (`PublicEdge`): head > 64 headers or 16 KiB -> 431; module off -> uniform 404; client network; unmatched
   (method, path) -> uniform 404 (charged to the static budget, 120/min per network); token parse + SHA-256; **rate gate**;
   body rules; cookie removed; deadline-bound receive; the app runs.
3. **App** (`link_context`): ONE `LinkStore.lookup(token_hash)`; unknown / expired / revoked / past grace -> `gate.failure()` +
   uniform 404; read-only grace (409 `read_only` on writes); code session (`X-Ticket-Session`, 403 `code_required` on writes).
4. **Answer**: canonical headers (spec 10.4 set, `cache-control: no-store` unless the route set one, no `Server`, no cookie, no
   CORS); a small unread body is drained first so the client is not reset out of the answer.

The uniform 404 (`404 {"code":"link_unavailable"}`) is byte-identical whoever produces it (edge or app) and for every case: unknown
token, expired, revoked, past grace, old generation, malformed or missing token, unknown path, other method, OPTIONS, HEAD,
module off (API, shell and healthz). Unknown and dead tokens go through the same path with exactly one indexed read.

## 3. Interfaces slice 4 must implement (`public_ports.py`)

Contract for every implementation: times are epoch seconds (float, UTC; convert to the `...Z` ISO text of the tables); never a
token, code, session value, redeem id or phone number in clear - only `links.token_hash`, `codes.code_hash`, `links.session_hash`,
`links.redeem_hash`, `phone_key`; every write is one short transaction (no gate held across image work).

| Port | Methods | Backed by (spec) | Notes |
|---|---|---|---|
| `LinkStore` | `lookup(token_hash) -> LinkRecord \| None`; `by_id(link_id)` | `ticket_links` (+ `ticket_assignments.ended_at`, `ticket_contacts.phone_key`, `tickets.number`) | ONE indexed read on `ticket_links.token_hash` (unique). Return the row in ANY state; set `revoked=True` when `revoked_at` is set OR the assignment is no longer current; `grace_until` from the close; `recipient_key` = the contact's `phone_key`; `sent_via`, `ticket_number`. Purged ticket -> None. |
| `ModuleSwitch` | `module_on() -> bool` (memory only) | `tickets.enabled` | Use `CachedSwitch(read)`; call `refresh()` from the janitor tick and right after `PUT /settings tickets.enabled`. Off until the first refresh (fail closed). |
| `RedeemStore` | `release(rid_hash, now, max_uses) -> (link_id, generation) \| None` | `ticket_link_redeems` | Atomic check-and-increment (`UPDATE ... SET uses = uses + 1 WHERE id_hash = ? AND expires_at > ? AND uses < ?` then read). |
| `RequestLog` | `get(scope, crid)`, `put(scope, crid, route, status, body) -> bool` | `ticket_requests` (24 h) | Scope `link:<link_id>`. Write the row **in the same transaction as the effect** (the in-process claim of `Idempotency` covers concurrent duplicates inside the process). Only 2xx answers are stored. |
| `CodeStore` | `latest_code`, `code_times_since`, `replace_code`, `expire_code`, `add_attempt`, `consume`, `failures`, `put_failures`, `clear_failures`, `put_session`, `session` | `ticket_link_codes`, `ticket_link_failures`, `ticket_link_sessions` | `replace_code`: insert and set `expires_at = now` on every older unconsumed code of the link, in one transaction. `consume`: compare-and-set on `consumed_at IS NULL`. `ticket_link_failures` is keyed by `link_id` (no generation column): the manager's "שלח קישור חדש" must call `CodeEngine.reset(link_id)`. |
| `CodeSender` | `channel_for(link) -> 'whatsapp' \| 'email' \| None`; `send(link, code_id, channel) -> bool` | the outbox (slice 5b / 7), purpose `code`, priority 0, never held | Implement `channel_for` with `codes.code_channel(...)` (D6). `send` queues the row with `code_id` only; the worker renders the six digits with `codes.derive_code(k_tickets, code_id)` (see 6, decision 1). |
| `PhotoSink` | `counts(link) -> PhotoCounts`; `record(link, StoredImage, crid) -> answer`; `open(link, attachment_id) -> PhotoFile \| None` | `ticket_attachments`, `ticket_events` | `record`: the attachment row (`visible_external = 1`), the `photo` timeline row, audit, sliding expiry - raising makes the route delete the stored file. `open`: only `visible_external`, not deleted, of the link's ticket; return the absolute path (the route confines it again). |

Other things slice 4 builds with these helpers: the ticket routes as a router in `PublicDeps.extra_routers` (the edge rules for
them already exist in `ROUTES`); `link_context(write=True)` for writes, `read_json(request, Model)` with
`model_config = ConfigDict(extra="forbid", strict=True)` and `text_hygiene.clean_str(...)` fields, `parse_client_request_id`,
`Idempotency(...).run(...)`; `ticket_link_access.client_key` = `links.client_key(key, ctx.request.net,
links.ua_family(ctx.request.user_agent))`; the claim routes of slice 9 reuse `image_intake.reencode` / `store_image(...,
subdir="costs")`, `cost_files.check_pdf`, `check_pending_quota`, `assemble_documents`, the `InFlight` guard and the
`claim_file` rate kind. The test router in `tests/test_tickets_public_app.py` (`slice4_router`) shows the pattern.

## 4. Numbers (all from the spec unless marked)

| What | Value |
|---|---|
| Listener | port 18093, `limit_concurrency` 16, keep-alive 5 s, 4 worker tokens, backlog 64, graceful stop 3 s, join 5 s |
| Head | 16 KiB / 64 headers (431; *added*), 10 s to complete (*added*), connection closed between requests after 300 s (*added*) |
| Bodies | JSON 16 KiB (claim JSON 32 KiB, *chosen*), photo 8 MiB + 64 KiB, invoice file 10 MiB + 64 KiB; deadline 10 s JSON / 60 s upload; drained below 64 KiB (*added*) |
| Rate gate | unknown tokens 20 failures/min per /24-/64 and 300/min global; token 60 req/min, 20 writes/h, 10 photos/h, 40 invoice files/h; redeem 10/min per network; static + unmatched 120/min per network (*added*); known-good bypass 15 min (*added*) |
| Codes | 6 digits fixed; TTL 10 min; 1/60 s, 3/h, 6/day per link; 6/h per recipient; 5 wrong / 15 min -> 30 min lock; session 12 h (never past the link) |
| Photos | JPEG / PNG only; 8 MiB; 16 MP; side <= 10 000 px (*added*); <= 100 JPEG scans (*added*); out <= 2048 px, JPEG q82; 30 per assignment, 60 per ticket; 2 GiB installation cap (60 s cached walk); one upload in flight per link; 4 upload bodies in memory, 1 decode admitted per loop (*added*) |
| PDFs | `%PDF-` at 0, `%%EOF` in the last 1 KiB, 10 MiB, refused names `/JavaScript /JS /Launch /EmbeddedFile /RichMedia /XFA /OpenAction /AA /Encrypt` (as whole names, `#xx` decoded; > 2000 escaped names refused) |
| Documents | 3 per revision, 1 PDF or 1-10 pages each, 25 files, no duplicate SHA-256; 30 pending per link, pending 24 h |

## 5. Wiring checklist (shared files - one line or block each; owned by slice 1 / slice 4)

1. **Add-on option** `tickets_public: false` - `config.yaml` (`options`, `schema: bool?`, `ports: 18093/tcp: null`,
   `ports_description`), `services/self_update.py OPTION_TYPES` (the test that keeps the three equal), `config.py Settings`
   field + `load_settings` line (the `cast_relay` precedent, `SW_TICKETS_PUBLIC` for a developer backend).
2. **Start** in `main.py _start_janitor` next to the cast relay (in a worker thread - `start()` waits up to 5 s for the listener):
   `if settings.tickets_public: await run_in_threadpool(public_server.SERVER.start, create_public_app(deps))`, where `deps`
   comes from slice 4's store (`PublicDeps(links=..., switch=CachedSwitch(...), key=ModuleKey(settings.data_dir), requests=...,
   redeems=..., codes=CodeEngine(store, key, limiter=limiter), code_sender=..., photos=..., attachments_root=settings.data_dir /
   "tickets", storage=StorageMeter(...), shell_dir=<www-public>, limiter=limiter, trusted_proxies=parse_trusted_cidrs(
   settings_doc.public.trusted_proxy_cidrs))`). Restore the counters first: `limiter.restore_from(app.state.db)`.
3. **Stop** in `main.py _stop_janitor` next to `cast_relay.SERVER.stop()`: `await run_in_threadpool(public_server.SERVER.stop)`,
   then `limiter.flush_to(app.state.db)`.
4. **Janitor tick** (guarded steps): `limiter.flush_to(db)` (scope `tickets_link` only); `switch.refresh()`; slice 4's retention of
   codes / sessions / redeem ids / requests (spec 15.1).
5. **Settings route**: after `PUT /settings` changes `tickets.enabled`, call `switch.refresh()`; a changed
   `tickets.settings.public.trusted_proxy_cidrs` needs a listener restart (or rebuild the app) - validate it with
   `parse_trusted_cidrs`, and `public.base_url` with `links.validate_public_base_url`.
6. **Health** (`GET /api/v1/tickets/health`, spec 17): `public_server.SERVER.snapshot()` + `app.gate.trips()`.
7. **Bundle**: slice 4's second Vite entry builds `smplwise_vms/www-public/index.html` + `assets/*.{js,css,svg,png,ico}`
   (`shell_dir`); no inline script or style (CSP `script-src 'self'; style-src 'self'`), no fonts (`default-src 'none'`), photos
   shown through `blob:` URLs after a fetch with the token header. Until it exists, `/t/` serves a script-free fallback page.
8. **Backup**: `<data>/tickets/` joins `backup.RESTORABLE_ROOTS` (spec 7.4); `block_counters` is not a project table (counters do
   not travel); `secrets/tickets_key` never travels.
9. **Security note** in `docs/security/` (slice 4, review C13): the token-authorised media exception (`GET /t/api/photo/{id}`).
10. **Install guide** (slice 8): Cloudflare rate-limiting rule and script-injecting features (Rocket Loader, e-mail obfuscation,
    Bot Fight Mode) off for the `t-*` hostname; port 18093 never mapped on the host.

## 6. Decisions where the spec was ambiguous or silent (the safer reading), and deviations

1. **Codes are derived, not stored** (spec gap). 10.5 stores only `HMAC(k, link_id | code)` and 7.3 forbids `{code}` in the
   outbox parameters, so a queued code message could not know its digits. `derive_code(k_tickets, code_id)` (HMAC of a 128-bit
   random row id, mod 10^6) is as unpredictable as `secrets.randbelow` without the key and lets the worker render the message
   from the row id - the digits are never stored, queued or logged. The stored hash keeps the spec's formula.
2. **Logging of the listener**: the spec names `access_log=False` and a filter on `uvicorn.error`. In uvicorn 0.53 both act on
   process-wide loggers shared with the main app (`access_log=False` empties `uvicorn.access` and would silence the main app's
   access log). Here `PublicConfig.configure_logging` is a no-op and the protocol class logs through `ProtocolLog` (no access
   line, invalid-request records dropped and counted, exceptions as type + frame) - same intent, no side effect. `access_log`
   etc. are still set on the Config (asserted by a test).
3. **Rate limiter**: the spec asks `RateLimiter` to gain a scope parameter. On this new-files-only branch it is a new class,
   `ScopedRateLimiter` (same table, row format, half-cap rule, bounded keys; plus `check`, `record`, per-scope `horizon_s`).
   Follow-up (optional): re-base `ha_user_auth.RateLimiter` on it as scope `signin`.
4. **Known-good tokens pass the flood caps** (review T1b): a token that resolved to a live link within 15 minutes is not
   "unknown", so the 300/min global and the per-network failure caps do not lock out vendors already working. A fresh link's
   first open during a flood still meets the 429 (the page says "try again in a minute").
5. **Lock-out without extra DoS** (review T5a): a malformed code and a guess while no code is live are not counted (they cannot
   succeed); the 5 / 15 min / 30 min numbers are unchanged. The lock is per link; a new generation must call `reset()`.
6. **PDF scan**: names are matched as whole PDF name tokens with `#xx` escapes decoded - catches `/J#61vaScript`, does not refuse
   `/JSON` or `/AAPL` as a substring scan would; more than 2000 escaped names refuse the file (CPU bound).
7. **JPEG reduced decode**: `draft` is asked for a long side of 1536, not the literal `(2048, 2048)` box: a 12 MP phone photo
   then decodes at 1/2 (9 MB instead of 36 MB) and is stored at 2016 px - "at most 2048". Also added: side <= 10 000 px, <= 100
   JPEG scans (progressive scan bombs), a PNG chunk walk before Pillow (critical chunks only, bounded text / ICC / EXIF, no APNG).
8. **Pillow logging (finding)**: Pillow's TIFF reader logs EXIF tag VALUES at DEBUG while `exif_transpose` reads them; at add-on
   log level "debug" every upload's GPS / serial numbers would reach the log. `image_intake` pins the `PIL` logger at INFO for
   the process (the `main.py` httpx precedent). Found by the log scan; regression test next to the pipeline.
9. **Edge additions not in the spec table**: 431 head cap; drain of small unread bodies (a socket closed on unread bytes is
   RESET and the client can lose the answer - seen on Windows in the tests, the same TCP rule on Linux); unmatched paths charged
   to the static budget; one decode admitted per loop (otherwise uploads waiting for a decode slot held elsewhere could occupy
   all 4 worker threads and stall every lookup - a test shows a 4.3 s stall without it); head deadline and connection lifetime.
10. **Module off** answers the uniform 404 to everything including the shell and `/t/healthz` (spec 6 / C8 literal). The
    address probe of slice 4 therefore only succeeds while the module is on.
11. **Status codes chosen** (the spec names only some): 403 `code_required`, 408 `body_timeout`, 409 `read_only` /
    `request_id_reused` / `request_in_progress` / `code_not_required` / `photo_limit` / `file_limit`, 413 `too_large`, 415
    `unsupported_media_type` / `unsupported_format` / `webp_refused` / `heic_refused`, 422 `invalid` (+ `fields`) / `image_invalid`
    / `too_many_pixels` / `pdf_refused` / `pdf_invalid` / `code_malformed` / `code_missing` / `code_expired` / `code_invalid` (+
    `attempts_left`), 429 `rate_limited` / `busy` / `code_locked` (+ `retry_after_s`, `Retry-After`), 431 `headers_too_large`,
    503 `code_unavailable`, 507 `storage_full`, 500 `server_error`. The page maps codes to its four-language strings.
12. **Trusted proxies**: `parse_trusted_cidrs` refuses networks broader than /8 (IPv4) or /32 (IPv6); a repeated or malformed
    `CF-Connecting-IP` from a trusted peer counts as the peer. **Public base URL**: a port other than 443 and the reserved names
    (localhost, homeassistant, supervisor, `.local` ...) are refused too.
13. **File names**: the image-validation half of the spec's `attachments.py` is `image_intake.py` (slice 1 plans its own
    `attachments.py` for internal uploads - it should call `image_intake.reencode` / `store_image`); codes live in `codes.py`
    (the spec puts them in `links.py`); `text_hygiene.clean_text` keeps the semantics of slice 1's `model.clean_text` and also
    normalises U+2028 / U+2029 / VT / FF / NEL and cuts stacked combining marks - one of the two should delegate at integration.
14. **Idempotency** replays 2xx answers only and claims (scope, id) in the process before reading the log; a concurrent duplicate
    is 409 `request_in_progress` (retryable).
15. **Times**: the ports use epoch seconds; the tables keep ISO text (slice 4 converts).

## 7. Known limits (stated, accepted or residual)

- Every add-on on the hassio network (172.30.32.0/23) is inside the default trusted-proxy network and can set
  `CF-Connecting-IP`; only the installation-wide caps hold against such a peer (review T1a residual).
- The PDF scan cannot see names inside compressed object streams (pinned by
  `test_known_limit_names_inside_a_compressed_object_stream_are_not_seen`); the controls are "never parsed or rendered" and the
  sandboxed download headers. A hostile PDF can still reach a reviewer's own viewer (spec S25).
- Pillow decoder vulnerabilities remain a dependency risk (`upstream_watch.json` `py-pillow`).
- The SQLite write gate and the GIL are still shared with the main app (spec S13 residual); public writes are rate-limited.
- uvicorn's own 503 at the concurrency limit is plain text without the security headers (generated inside uvicorn's protocol).
- A large unread upload body is cut with `connection: close`; the client may get a TCP reset instead of the 4xx (the page's
  retry with the same `client_request_id` covers it).
- A token / code limiter row survives a restart only once a key reached half a cap (the RateLimiter rule); the per-link code caps
  are counted over the code rows and always survive.
- The per-recipient code cap needs the contact's `phone_key`; a contact without a phone (e-mail only) has only the per-link caps.
- During a global flood a freshly sent link's first open can meet the 429 (review T1b residual).
- Anyone holding a forwarded link can lock the code entry for 30 minutes (spec S10, accepted; the manager's new link resets it).
- Escalating back-off for unknown-token networks is not implemented (192-bit tokens; 20 lookups/min per network is the spec's
  rate); the code lock is the meaningful lock-out.
- anyio worker threads of a stopped listener loop stay as idle daemon threads until the process ends (bounded by 4).

## 8. UNVERIFIED (needs the owner's environment or a later slice)

- **Cloudflare tunnel to container port 18093** on the owner's installation (spec 22 item 4): reachability of a second container
  port through `cloudflared`, and the source address cloudflared connects from (inside 172.30.32.0/23 is assumed).
- The runtime is Linux (the add-on image); every test here ran on the Windows workstation (Proactor event loop, Windows TCP
  stack). The listener's own loop is a stdlib asyncio loop on both. `SO_REUSEADDR` is set on Linux only.
- uvicorn 0.53.0 behaviours the design rests on are asserted by tests against the pinned version (signal capture skipped off the
  main thread, `configure_logging` side effects, `limit_concurrency` counting, h11 incomplete-event cap); a uvicorn upgrade must
  re-run `test_tickets_public_server.py`.
- Real phone uploads (iPhone HEIC conversion to JPEG, Android camera JPEGs with large EXIF) were not tried; the corpus is synthetic.
- The full backend suite on the runner was NOT run (a release gate holds the runner); only this branch's tests ran locally.

## 9. Tests (local, Windows workstation, `C:\cloude\smplwisebms\.venv` Python 3.12.10, one process)

Command (from `smplwise_vms/backend`): `python -m pytest tests/test_tickets_text_hygiene.py tests/test_tickets_links.py
tests/test_tickets_ratelimit.py tests/test_tickets_codes.py tests/test_tickets_image_intake.py tests/test_tickets_cost_files.py
tests/test_tickets_public_multipart.py tests/test_tickets_public_app.py tests/test_tickets_public_server.py
tests/test_tickets_public_logs.py -q`

| File | Tests | Covers |
|---|---|---|
| `test_tickets_text_hygiene.py` | 23 | bidi / zero-width / controls / noncharacters, line handling, combining marks, length after cleaning, pydantic type, template check, random-text fuzz, CSV formula escaping |
| `test_tickets_links.py` | 38 | spec token formula (192 bits), generation, hash-only, strict parsing fuzz, mutated tokens, redeem ids, sessions, keyed digests, public URL rules, fragment-only transport, hash-timing check, key file create / damaged / rotate |
| `test_tickets_ratelimit.py` | 21 | windows, retry-after, sliding lock, bounded keys, block_counters round trip (sqlite + the real `Database` with all migrations), busy database, exact counting under 16 threads, trusted-proxy keying, flood with known-good bypass, per-token caps, `CachedSwitch` |
| `test_tickets_codes.py` | 42 | derivation and storage, uniformity, parsing (incl. Arabic-Indic digits) + fuzz, send caps, invalidation, per-recipient cap, lock and window, not-counted guesses, reset, withdraw, 40 parallel guesses, 8 parallel correct codes (one session), policy bounds, D6 rule in all 64 combinations |
| `test_tickets_image_intake.py` | 52 | re-encode, bounds, phone sizes, metadata stripping (EXIF GPS / ICC / XMP / comment), orientation, polyglots, PNG chunk attacks, pixel and zlib bombs, 16 MP + 1, scan bomb, truncation, every refused type, own semaphore vs the administrator's, storage confinement, storage cap, quotas, in-flight guard, EXIF never logged |
| `test_tickets_cost_files.py` | 57 | each refused name, encryption, `#xx` spellings, look-alike names, magic / trailer / size, the pinned known limit, scan cost bounds, documents and pages rules, pending quota, download headers |
| `test_tickets_public_multipart.py` | 33 | exact form reading, boundary rules, every refusal, fuzz |
| `test_tickets_public_app.py` | 43 | only /t/ routes, headers on every answer, no cookie / CORS, byte-identical uniform 404 (15 cases), one lookup per dead token, rate gate before any lookup, trusted proxy, JSON-only and caps, 422 without input, text cleaning, idempotency (incl. concurrency), grace, code flow, lock, redeem, photos (re-encode, replay, refusals, storage full, failed record, scoping), 500 without data, shell and assets, missing key fails closed |
| `test_tickets_public_server.py` | 38 | Config values, no logging side effect, never wrapped at TRACE, no signal capture (and uvicorn's own off-main-thread skip), own thread / loop / 4-token pool, start / stop / busy port, route enumeration at the socket, malformed requests, head floods, slow heads, lifetime, body deadline, large vs small unread bodies, keep-alive, the connection cap, decoder held elsewhere, one upload in flight, CF-Connecting-IP from a trusted peer, the main app serves no /t/ route |
| `test_tickets_public_logs.py` | 1 | the log scan described in its docstring |
| **Total** | **348 passed** | last run 58 s on the workstation (one process) |

Also run (unchanged repository tests that scan the source tree): `test_db_gate.py::test_no_manual_transaction_control_outside_db_py`,
`test_security_review_246_poc.py::test_i3_no_module_but_image_guard_writes_pillows_process_wide_threshold` - passed.

**NOT_RUN:** the backend suite and every other tier on the shared runner (a release gate holds it; no `run_smart.py` job was
started); frontend / Playwright (nothing of the frontend is built on this branch); any live check (no device, no tunnel).
