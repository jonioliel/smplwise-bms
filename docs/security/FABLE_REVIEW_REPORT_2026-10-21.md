# Fable security review - public surfaces, HMAC key rotation, door automation, passkeys-only (2026-10-21)

Owner item 25: Fable reviews the public surfaces before any of the four features below is switched on. Review-only: no product
code was changed on any branch; this report is the only deliverable (branch `pilot/FABLE-REVIEW-295`). Fakes only: no live system,
tunnel, phone, WhatsApp or Home Assistant was contacted. No secret, host, address, serial or token appears here.

Starting point: `docs/security/FABLE_REVIEW_PACKAGE_2026-10-20.md` on `origin/pilot/SECFIX2-295` (02a252636) and its 20 questions
(section 7). Precedence (AGENTS.md): approved change request -> `MASTER_SPEC_HE.md` / `docs/security/` -> `AGENTS.md`. Contradictions
are recorded, not resolved (section 8).

## 0. Heads reviewed (pinned)

| Scope | Ref | Commit reviewed | Base used for the diff |
|---|---|---|---|
| 1 | `origin/integ/2100` (document links, camera policy, everything merged for 2.10.0) | `f32770899` | `origin/integ/293` 9b14e158b |
| 1 | `origin/pilot/SECFIX2-295` (PUB-03, PUB-04, PUB-07, uniform 404; the review package) | `02a252636` | 90a50db90 |
| 1 | `origin/pilot/VENDORQ-294` | `ea5250342` (its document code is identical on integ/2100; reviewed there) | - |
| 2 | `origin/pilot/HMACROT-295` | `168fe9e4c` | 9b14e158b |
| 3 | `origin/pilot/AUTODOORS-295` | `2dd8f5b3e` | 90a50db90 |
| 4 | `origin/pilot/PASSKEYONLY-295` | `59847b671` | 9b14e158b |

`origin/integ/2100` moves; every file:line below is at `f32770899`.

## 1. Summary

| Severity | Count | IDs |
|---|---|---|
| critical | 0 | - |
| high | 2 | H-01, A-01 |
| medium | 8 | D-01, D-04 (PUB-04), D-06 (PUB-07), H-02, H-03, A-02, A-03, P-01 |
| low | 14 | D-02, D-03, D-05, D-07, D-08, H-04, H-05, H-09, A-04, A-07, A-09, A-10, P-02, R-01 |
| info | 12 | D-09 .. D-14, H-06, H-07, H-08, A-05, A-06, P-03 |

Totals: 36 findings (0 critical, 2 high, 8 medium, 14 low, 12 info).

**Blocking list** - what must be done before the named switch is turned on (everything else is a recommendation):

| Feature / switch | Blocks ON? | Why | Finding |
|---|---|---|---|
| `reports.documents` (document links) | **No for PDF documents. Yes for the first HTML producer.** | Today nothing mints an HTML document (no product caller of `out_documents.mint`). The HTML filter is bypassable 15 ways (tested); any producer that interpolates operator text must escape it and the file must be served/handed over as `application/octet-stream`. | D-01, D-02 |
| `vendor_portal.start_worker` (PUB-04) | No, with one condition | Expose the worker's `dropped` counter to the administrator before ON; otherwise a flood silently suppresses real codes with no one knowing. | D-04 |
| `access.external.pending_retention_days` / `pending_max_per_vendor` (PUB-03) | No | Verified: cap refusal rolls back the claim row; the erase runs under BEGIN IMMEDIATE so a manager's accept cannot interleave. | D-11, D-12 |
| PUB-07 guard-first routes (no switch) | No | Robust; one residual (sync DB read on the loop) is pre-existing and low cost. | D-06 |
| `access.unknown_person_uniform_404` | No - recommend flipping the default to `true` | Byte-identical 404 verified by the branch's own tests (run here: see section 7); the 403 carries no value for a writer who cannot see the record anyway. | D-13 |
| `bridge.key_rotation` (HMAC rotation) | **Yes** (already enforced: `GO_LIVE_PERMITTED = False`) | In this slice the rotation rotates a key set that nothing verifies against; `ha_bridge.sign/verify` still use `bridge.secret`, which `adopt_legacy` leaves in place. A "verified" rotation would be a false statement to the administrator until the activation slice wires verify and clears the legacy secret in the same commit as the permit. Also fix H-02 (state oracle before the MAC) before activation. | H-01, H-02 |
| `doors.automation_open` (door automation) | **Yes** (already enforced: `GO_LIVE_PERMITTED = False`) | Trigger corroboration (CR 11.1 / 12.6) is required before any send: a spoofed `automation_triggered` without a user context passes every gate within the caps. Also re-check the kill switch inside the per-door transaction (A-02) and add a per-door installation-wide cap (A-03). | A-01, A-02, A-03 |
| passkeys-only mode (`auth_local_credentials.passkey_only`) | No, with one condition | Fix the password-validity oracle (a correct password for a passkeys-only account skips every failure counter and the lock) before the owner switch is turned on for real users. Cheap. | P-01 |

## 2. Method: verified-by-reading vs tested

- **Read**: every file cited below was read at the pinned commit with `git show`; the routes, transactions and gates were traced by hand.
- **Tested** (this review, locally, fakes only):
  - `_HTML_FORBIDDEN` bypass probe: the regex copied verbatim from `out_documents.py:42-45`, run with an isolated interpreter against 21
    inputs (section 7.1). 15 of the 17 bypass candidates pass the filter.
  - Backend test files of the reviewed branches re-run on the reviewed heads through `local_run.sh` (section 7.2). Results are stated
    as PASS / FAIL / NOT_RUN with counts; nothing is reported as passed that did not run.
- **NOT verified** (section 9): header pins on every edge answer, the camera-policy frontend specs, the remote-channel questions Q16-Q18
  beyond reading, FastAPI version behaviour of `route_class_override` beyond the branch's own test, blob/CSP behaviour in real browsers,
  the Cloudflare assumptions of package section 4.4, any Linux add-on image.

## 3. Scope 1 - public vendor surfaces

### 3.1 Document links (`reports.documents`, OFF) - `out_documents.py`, `public_documents.py`, `doc-page.ts`, `state.ts`

**D-01 - medium - the HTML "inert" filter is bypassable (TESTED).**
`smplwise_vms/backend/smplwise/services/tickets/out_documents.py:42-45` (`_HTML_FORBIDDEN`), `:88-93` (`_check_content`).
The regex blocks `<script>`, frames, forms, `javascript:` and remote `src/href` schemes, but it does not block: inline event
handlers (`<img src=x onerror=...>`, `<svg onload>`, `<body onload>`, `<details ontoggle>`, `<input autofocus onfocus>`,
`<video onloadstart>`), HTML-entity-encoded schemes (`&#106;avascript:`, `javascript&#58;`), whitespace inside the scheme
(`java\tscript:`), `data:image/svg+xml` in an `href`/`<use href>` (the lookahead whitelists every `data:image/` including SVG, which
can carry script when navigated), `formaction` on a `<button>`, `<meta http&#45;equiv>`. Probe output in section 7.1.
*Exploit*: an HTML report is built server-side from operator-controlled text (a sensor name, a note, a vendor name). If a future
producer interpolates such text without `html.escape`, the recipient downloads a `.html` whose script runs when they open it from disk
(`file://` origin, with access to other local files in some browsers) or, on a browser that ignores `download` (D-02), renders on the
customer's public hostname. *Today*: no product code calls `out_documents.mint` (verified: only tests do), so the exposure is latent.
*Fix*: (a) treat the regex as a tripwire, not a sanitizer - require every HTML producer to escape all interpolated values and to ship a
unit test with hostile names; (b) extend the regex with `\bon[a-z]+\s*=`, `formaction`, `srcdoc`, `&#`/`&[a-z]+;` inside URL
attributes, `[\s]` inside the scheme match, and drop `data:image/svg+xml` from the allowance; (c) store/serve HTML documents as
`application/octet-stream` with the `.html` filename (D-02) so no browser ever renders them from the link. *Blocks*: the first HTML
producer, not the PDF path.

**D-02 - low - the download blob keeps `text/html` and relies on the `download` attribute (READ).**
`frontend/src/public-ticket/doc/doc-page.ts:104-118`. `res.blob()` inherits the response type; `URL.createObjectURL` makes a
`blob:` URL of the listener origin; `a.download` is honoured by Chrome/Firefox/Safari >= 13 but not by every in-app WebView a WhatsApp
link opens in. A navigated `text/html` blob renders on the listener origin. CSP3 says a `blob:` document inherits the creator's policy
(`default-src 'none'; script-src 'self'`), so inline script would not run in the browsers we support - but phishing content would
render under the customer's hostname, and the inheritance was not tested here. *Fix*: hand the bytes over as
`new Blob([await res.arrayBuffer()], { type: 'application/octet-stream' })` (or serve octet-stream, D-01c). Q7 answer: the CSP most
likely reaches the blob document, the regex is **not** a sufficient second line (D-01), and octet-stream is safer - adopt it.

**D-03 - low - a forwarded link can burn the recipient's downloads (READ).**
`out_documents.py:197-214` (`open_file`, compare-and-set), `settings_doc.py:496-497` (defaults 72 h, 5 opens), `ratelimit.py:426`
(`file_read` 20 / min, 60 / h per token). Anyone holding the link can spend the 5 opens in seconds; the real recipient then sees the
uniform 404. This is inherent to a bearer link and acceptable for a 72 h / 5-download document; the compare-and-set is correct (two
parallel last downloads: one wins). *Optional*: count opens per `client_key` (network + UA family, already computed for tickets) so the
recipient's own re-downloads do not consume the budget; or keep 5 and let the sender re-mint. Q8 answer: acceptable; document it.

**D-09 - info - `X-Document-Digest` / `digest` in the metadata (READ).** `out_documents.py:191-194`, `public_documents.py:39-42`. The
digest is only served while the bytes themselves are downloadable (`_live`), so it discloses nothing beyond what the holder can fetch.
After expiry / use-up the metadata route answers the uniform 404. Q9 answer: no linkage risk; keep it.

**D-10 - info - token domain separation (READ, both sides).** `links.py:57-74` (`doc|<id>|<gen>` HMAC input, `TOKEN_DOMAINS`);
`state.ts:36-56` (`#d.` -> mode `document` only, never kept in storage; `bootFrom` requires the WHOLE fragment to be a 32-character
token, so `d.<token>` can never be a ticket token); `public_documents.py:60-64` looks up `outbound_documents.token_hash` only, while
`link_context` (`public_app.py:217-232`) looks up `ticket_links` only. A ticket token presented to `/t/api/doc` hashes to a value that
cannot exist in `outbound_documents` (different HMAC domain). Q10 answer: confirmed.

**D-14 - info - edge properties of the two routes (READ).** `public_http.py:214-215` lists both routes with kinds `token_read` /
`file_read` (per-token windows, failure caps, no body); `final_headers` (`:280-297`) strips any route `set-cookie`/CORS, forces the
security header set (CSP `default-src 'none'`, `nosniff`, `no-referrer`, `frame-ancestors 'none'`, HSTS) and `cache-control: no-store`
unless the route set one (`private, no-store` here). `Content-Disposition: attachment` with a `[A-Za-z0-9._-]` filename (D-01 does
not weaken this). Enumeration: one indexed read by `sha256(token)` for every token shape; 192-bit tokens; the uniform 404 is byte
identical. Path handling: exact `(method, path)` match; no path parameter. Good.

### 3.2 Pending-technician flow (PUB-03, both OFF) - `access_arrival.py`, `access_grants.py`, `pending_retention.py`

**D-11 - info - Q2 verified (READ).** `access_arrival.py:229-248` runs `handler_actions.claim` (idempotency row) before
`_new_technician`; the cap raises `Refused(429)` at `:150-153`; `public_routes.py:94-108, 262-269` converts it to `ActionRefused` inside
`tx`, i.e. inside the `with db.connection()` block, so the whole BEGIN IMMEDIATE transaction rolls back (claim row, contact insert,
audit). `spend_budget` runs only on `new` (`:104-105`), so no budget is spent. A replay of the same `client_request_id` either returns
the idempotency wrapper's remembered refusal or re-runs and hits the cap again; a new id hits the cap too. Nothing survives.

**D-12 - info - Q3 verified (READ).** `db.py:455-479`: `mode="write"` is BEGIN IMMEDIATE, so `_erasable`
(`pending_retention.py:46-59`) re-reads under the single write lock and a manager's accept cannot interleave. Audit without a human
actor: `tcontacts.erase_checked(conn, _SystemViewer(), ...)` with `extra_audit={"by": "pending_retention"}` and one summary row per run
(counts only). Acceptable; recommend a stable system actor id (e.g. `system:pending_retention`) so the trail filters cleanly.

**D-08 - low - the cap is availability-sensitive by design (READ).** `access_arrival.py:150-153`: a vendor whose legitimate requests
sit unreviewed hits 429 for a new arrival for an hour. Acceptable for a privacy cap; the needs-review report lists pending rows from
30 days, long before a janitor erase (`pending_retention.py:14-15`). Keep the default 0 until managers review promptly.

### 3.3 Vendor portal start worker (PUB-04, OFF) - `public_portal.py`

**D-04 - medium - silent drops are invisible to the administrator (READ).** `public_portal.py:60-80` (`StartWorker.submit`: a full
queue or a dead thread increments `dropped` and returns False), `:236-247` (the route answers 202 regardless). `dropped` is read by
nothing (no `PublicStats`, no health, no admin view). One daemon thread drains the queue; each job does the directory lookup and the
WhatsApp send, so under a flood of well-formed numbers (10 / 10 min per network, many networks) the 64-deep queue fills and REAL
vendors' codes are dropped with a "sent" answer and no trace. *Fix*: surface `accepted` / `dropped` in the listener stats and the
administrator's health card; raise an operator notice when `dropped > 0` in an hour; optionally an installation-wide `portal/start`
budget. Q4 answer: with the worker on, the request-level difference between a known and an unknown number is gone; the residual is the
write-lock contention other requests may observe and the out-of-band WhatsApp delivery time. 64 + silent drop is the right trade only if
the drop count is visible - make it visible before ON.

**D-07 - low - worker registry holds stale Database objects (READ).** `public_portal.py:122-139`: `_workers[id(db)]` keeps a strong
reference; a new `Database` with a new id leaves the previous entry and its thread alive until `stop_workers`. Jobs hold `digits` in a
closure until processed. `public_server.stop` (`:433-441`) stops all workers. Q5 answer: no correctness hazard (a job uses the `db` it
was created with; a restore closes the old handle, the job fails and is logged by type); a small resource leak per listener restart in
one process. Key the registry by the listener, not by `id(db)`.

**D-05 - low - PUB-11 revisited (READ, not re-traced).** The 30-minute, read-only, non-client-bound portal cookie now also authorises
`techs` / `techs/cancel` writes (VPORTALRFQ). The writes are confined to the vendor's own technician requests. Q6 answer: still
acceptable for a code-verified phone session; cheap hardening = bind the session hash to the UA family at verify time, and keep the
30-minute idle expiry. Not blocking.

### 3.4 Guard-before-body routes (PUB-07, no switch) - `guarded_route.py`, `routers/local_identity.py`, `routers/local_passkeys.py`

**D-06 - medium - the guard performs a synchronous database read on the event loop (READ).** `guarded_route.py:34-36` calls
`cls.guard(request)` synchronously inside the async handler; `_public_guard` (`routers/local_identity.py:93-104`) calls
`li.enabled_db(request.app.state.db)` - a blocking SQLite read - on every unauthenticated POST before body limits and per-route limiters.
This is unchanged from before PUB-07 (the endpoints called the guard first, also synchronously), so SECFIX2 made nothing worse, but every
remote-channel POST to these nine routes blocks the loop for one read. In WAL mode readers do not wait for writers, so the cost is small
and bounded; the risk is a slow disk under a flood. *Fix*: cache the `enabled` answer for 1-2 s, or run the guard in the threadpool
(`await run_in_threadpool(cls.guard, request)`). Q14 answer: not expensive to make expensive from outside, but it should not be on the
loop. Not blocking.

**Q13 (READ)**: `APIRoute.get_route_handler` has been the public override point since FastAPI 0.6x and `route_class_override` is a
documented `add_api_route` argument; both are stable across 0.100-0.141. The end-to-end test (malformed body on the local channel =
the same 404) is the right guard rail; add one assertion that all nine routes' `type(route).guard is _public_guard` so a refactor that
reverts to `@router.post` fails loudly. `auth/session` and `csp-report` need no guard: `auth/session` legitimately exists on both
channels, and `csp-report` accepts any body by design.

**Q15 (READ, not timed)**: the uniform answers (401 `sign_in_failed`, 202 reset, 422 `code_invalid`, 401 `passkey_invalid`) keep the
dummy-hash pattern (`lp.verify_dummy`) on every refusal branch in `sign_in`; the reset sender thread decouples the 202 from the
WhatsApp send. The one new timing/side-channel difference is P-01 (passkeys-only), which belongs to scope 4.

### 3.5 Uniform 404 for a malformed WisKey record (`access.unknown_person_uniform_404`, OFF) - `intercom_writes.py`, `intercom_authority.py`

**D-13 - info - Q19 / Q20 (READ + branch tests run).** `intercom_writes.py:115-130` (`sees_unknown_person`, `unknown_station_refusal`),
`:229-236` (`check_person`). Every write route reads the person once (`read_person`, `:169-183`, one `users/get`), so (a) unknown id,
(b) malformed record and (c) foreign well-formed record each cost one service read and answer 404 with the same body
(`intercom_person_not_found`); the branch's test strips volatile headers and asserts byte equality and covers every write route and the
editor route. Audit rows differ by reason but are not visible to the restricted writer. Residual oracle: none found on the write gate;
the capture-start and revision-409 paths were not re-traced here. Q20: flip the default to `true` - the read side already hides such a
record from a restricted writer, so the 403 cannot help "a restricted operator whose own person has a malformed record" (he cannot see
it either way, as the branch's own test `..._own_station_is_hidden_like_the_read_side` shows).

### 3.6 Camera policy and the remaining package questions

- **Q11 (READ)**: the remote channel sends `camera=(self), microphone=(self)` while nothing uses the microphone and the viewfinder is
  OFF. Recommendation: `microphone=()` now; make `camera` follow `ui.camera_viewfinder` at document load (it is one SPA document, so
  the header can be computed per request from the switch). The same-origin WisKey panel inherits whatever the document allows, which is
  one more reason to keep `camera=()` until the viewfinder is on. Low; not blocking (R-01).
- **Q12**: NOT VERIFIED here (the pin tests exist; not re-run in this review).
- **Q1, Q16, Q17, Q18**: NOT RE-VERIFIED here beyond reading the package; the PUB-01/PUB-05/PUB-06 state stands as the 2026-10-20
  review left it.

## 4. Scope 2 - bridge HMAC key rotation (`origin/pilot/HMACROT-295` 168fe9e4c)

Files: `services/bridge_keys.py` (wire format, verify, HKDF, seal), `services/bridge_rotation.py` (engine), `services/bridge_rotation_peer.py`,
`services/connection_store.py:252-268`, `routers/bridge_key.py`, `migrations/0143_bridge_key_rotation.sql`, `services/backup.py`.

**H-01 - high - the rotation does not yet rotate the key that is verified (READ). Blocks activation (already enforced).**
`bridge_keys.py:13` ("Not wired to `ha_bridge.sign/verify` in this slice"), `:237-246` (`adopt_legacy` leaves `settings.bridge.secret`
in place). The engine can run to `verified`, the screen can show "the old key is gone" (`bridge_rotation.py:369-391`), yet
`ha_bridge.verify` still accepts the legacy pairing secret, which remains in settings and therefore in any settings export that carries
it. This is by design for this slice, but it means: (1) the UI state "verified / anchor eligible" would be false for the real channel;
(2) the activation slice must, in ONE commit, wire sign/verify to `bridge_keys`, clear `bridge.secret` after adoption, and flip
`GO_LIVE_PERMITTED` - never in separate releases. (3) Until then the screen must say the rotation is not active. Section 14 items 1, 11.

**H-02 - medium - `verify()` leaks key state before the MAC check (READ).** `bridge_keys.py:272-289`: `key_unknown`, `key_not_active`
(pending), `key_retired`, `key_expired` and `stale` are raised before `hmac.compare_digest` (`:292-294`). A sender on the hassio channel
without any key can enumerate which kids exist and in which state (an 8-hex kid is 2^32, but the generation prefix is predictable and the
legacy kid is fixed), and learns the active kid set for free. Section 14 item 3 asked that "error codes leak nothing". *Fix*: compute the
MAC first (a dummy MAC when the material is unavailable), then collapse every refusal of an unauthenticated message to one wire code
(`bad_signature`) and keep the detailed code in an internal counter / log-by-type. Check `stale` after the MAC as well. Not blocking
today (nothing verifies through this path yet) - fix before activation.

**H-03 - medium (design limit, must be documented) - rotation is hygiene, not compromise recovery (READ).** `bridge_keys.py:116-122`
derives K_next = HKDF(K_cur, salt, info) and `bridge_rotation.py:263-264` sends the salt signed but in clear. Whoever holds K_cur and can
read the local channel derives every future key; whoever holds K_cur can also drive the peer into a rotation Arx does not know about
(the peer accepts `begin` under K_cur), leaving the bridge dead until re-pairing. Section 14 item 4's answer is therefore: a leaked
K_cur gives everything; the proof cannot be replayed into another rotation (bound to `rotation_id`, `:125-127`), but that does not help
against a K_cur holder. The CR, the screen and the user guide must say: "suspect a leak -> re-pair; rotate for hygiene only".

**H-04 - low - nonce cache is process-local (READ).** `bridge_keys.py:132-154`: after a restart within the +-60 s window a captured
message replays once. Pruning is O(n) under a lock per verified message (only key holders reach it). *Fix*: persist a per-kid
high-water `ts` or accept with a note. Not blocking.

**H-05 - low - `_repair` retires K_cur on the peer's word alone (READ).** `bridge_rotation.py:495-532`: a `status` answer with
`active_kid == kid_to` (signed under K_cur, which the peer still has) makes Arx retire K_cur and promote K_next without probing under
K_next. A buggy or hostile peer that never derived K_next bricks the bridge until re-pairing. *Fix*: probe under K_next and require `ok`
before the retire in repair. Section 14 item 10.

**H-09 - low - control answers accepted under either kid regardless of phase (READ).** `bridge_rotation.py:181-182`: a `commit` answer
signed under K_cur is accepted; a peer without K_next could answer "committed", Arx switches, the post-switch probe fails and
`_switch_back` recovers under K_cur (`:340-347, 435-453`) - self-healing, so low. Tighten: `commit`/`retire`/post-switch answers must be
signed under K_next, `begin`/`abort` under K_cur.

**H-06 - info** - hard cut keeps the old material as a Python `str` for V1c (`bridge_rotation.py:352, 382`); `del` cannot wipe an
immutable string. Unavoidable in CPython; note it. **H-07 - info** - the wipe `value_enc = NULL` (`bridge_keys.py:228-230`, CHECKs in
0143) leaves the SEALED blob in free pages / WAL until checkpoint; plaintext is never on disk; `PRAGMA secure_delete` or an incremental
vacuum after retire would finish the job. Section 14 item 7.

**H-08 - info - verified by reading**: RBAC = `system.configure` on the installation AND `is_system_admin`, denial audited
(`routers/bridge_key.py:51-56`); the switch cannot be `on` without the permit (`bridge_rotation.py:198-209`); `bridge.key_rotation` and
the reminder are in `SETTINGS_KEEP` and both tables in `NEVER_EXPORTED_TABLES` (`backup.py` diff); the AAD binds the kid
(`connection_store.py:256-260`); the signature input `v2.<kid>.<ts>.<nonce>.<sha256(body)>` cannot collide with v1 (`<ts>.` starts with
a digit) and binds the kid; the kidless rule accepts only `g0-legacy` while `current` / `retiring` and refuses it once `next` exists or
the legacy key is retired (`bridge_keys.py:262-287`) - the downgrade guard holds; every step is committed before the next peer call and
`tick()` resolves every crash point (`bridge_rotation.py:457-484`), with a restore rolling back a pre-switch rotation; the overlap cap
and the hard-cut "no instant with two keys" are enforced by `verify_until = now` (`:327`) and `key_expired`; `test_no_key_material_in_audit_logs_or_answers`
covers item 8 (not re-run here). Clock skew: the +-60 s window is the only coupling between wall clocks; the peer's cap is monotonic.

## 5. Scope 3 - door automation design (`origin/pilot/AUTODOORS-295` 2dd8f5b3e)

Files: `services/door_automation.py`, `routers/door_automations.py`, `migrations/0145_door_automations.sql`, `services/backup.py`.

**A-01 - high - trust in the `automation_triggered` event (READ). Blocks go-live (already enforced).** `door_automation.py:708-722`
(`handle_trigger`) accepts any `automation_triggered` frame whose `entity_id` maps to an armed block; `_block_gates` (`:599-621`)
refuses only a human context (`context.user_id`) or `source` in `("trigger action", "manual")`. Any integration, script or template
in Home Assistant can `hass.bus.async_fire("automation_triggered", {...})` with no user context, and the HA administrator can do so
through a script run by an automation. Within the caps (4 / hour / door, 20 / day, 60 s cooldown) that opens a door. I agree with CR
11.1 / 12.6: before any send, corroborate the fire - the automation entity's `last_triggered` must have moved in the mirror within N
seconds AND, for state/numeric_state triggers, the watched entity must have changed in the mirror in the same window. Add the
corroboration gate to `_block_gates` and record `uncorroborated` refusals as a storm reason.

**A-02 - medium - block gates and the per-door send are in different transactions (READ).** `handle_item_event` (`:694-706`) evaluates
kill / feature / expiry / revision / window in one read transaction, then `_fire_door` (`:653-692`) opens a write transaction per door
that re-checks only `state == 'armed'` and the per-door gates. A kill switch set between the two is not seen; with N doors the window
spans N sends. *Fix*: re-evaluate `killed()`, `enabled()` and expiry inside the `_fire_door` transaction (three cheap reads). Section
11 item 8.

**A-03 - medium - loop protection is one hop and caps are per block (READ).** `loop_refusal` (`:366-384`) resolves the automation's
own triggers only; an intermediary entity (`input_boolean`, another automation, a script) breaks the static check - the caps and the
storm disarm are then the only bound. Caps are per automation (`_door_gate`, `:624-645`): two blocks on the same door double them, and
`max_per_day` is per automation not per door. *Fix*: a per-door installation-wide cap across all blocks (e.g. 6 / hour, 30 / day) in
`_door_gate`; document the one-hop limit in the CR and the user guide. Section 11 items 4, 5.

**A-04 - low - manual detection depends on HA's `source` wording (READ).** `:607`, `MANUAL_SOURCES = ("trigger action", "manual")`.
If HA changes the text, the gate fails open to "automatic". Prefer the context (`user_id`, or `parent_id` resolving to a user) and treat
a `source` outside a known allow-list of automatic sources as manual.

**A-07 - low - backup / kill-switch persistence (READ, one item not verified).** `killed()` (`:151-154`) fails closed on any value
other than absent / `off`; `SETTINGS_KEEP_PREFIXES` includes `doors.` (`backup.py:149`) so a restore never changes the kill or feature
switch; blocks are not backed up (CR 9). Open owner decision (CR 12.3): I recommend "back up and restore as disarmed" - losing blocks
on restore is safe but surprising. NOT VERIFIED: that `door_automations` / `door_automation_fires` are in `NEVER_EXPORTED_TABLES`.

**A-09 - low - one daemon thread per event (READ).** `on_event` (`:725-742`) starts a thread for EVERY `automation_triggered` in HA,
armed or not; `handle_trigger` then does one read. Under an HA event storm this is unbounded thread creation. *Fix*: a bounded queue +
one worker (the PUB-04 pattern), dropping with a counter.

**A-10 - low - DST edges (READ).** `in_window` (`:174-188`) reads the UTC instant in the installation zone: a window starting in a
skipped hour never matches that day (safe); a window ending in a repeated hour is open one hour longer (fall back). Document; fail
closed on an unknown zone is in place (`ClockUntrusted`).

**A-05 - info** - `dev_mode = bool(settings.dev_user)` relaxes `identity_ok` in `armer_reason` (`:320-333`); the add-on never sets
`dev_user`. **A-06 - info - delegation verified by reading**: the operator principal (`automation:<id>`, source `automation`) never
reaches `rbac.authorize` (`_NOT_FROM_A_GRANT`, `:70, 672`); `is_operator` requires BOTH the prefix and the source, so a `users` row
named `automation:...` from a restore or sync (source `ha`/`local`) can never be the operator; the armer is re-checked at every fire
(`users.active`, `access.doors.automate` on the station chain, the one-door rule) - `:624-631`. Audit `trigger.source` is 120 printable
characters and may name an entity (section 11 item 6): acceptable in the access audit. Live sender: `LiveSender.open` refuses
(`:80-87`); no live wiring exists, and the CR requires the permit flip in the same commit.

## 6. Scope 4 - local passkeys-only mode (`origin/pilot/PASSKEYONLY-295` 59847b671)

Files: `services/local_identity.py:1157-1242`, `services/local_passkeys.py`, `routers/local_passkeys.py`, `routers/local_identity.py`.

**P-01 - medium - a correct password is distinguishable from a wrong one by side effects (READ).** `local_identity.py:1238-1242`:
for a passkeys-only account the CORRECT password returns `fail("passkey_only", count=False)` AFTER `lp.verify` succeeded - no
`TIERS.acct_fail`, no `failed_count` / `last_failed_at` update, no account lock, no `fail_global`, no manager notification; a WRONG
password (`:1213-1237`) does all of them. The 401 body is identical, but a guesser who repeats one candidate learns whether it is right
from the delay / lock behaviour (and the managers are notified only for wrong guesses). A confirmed password is reusable elsewhere. The
"identical message" requirement is met; the "identical behaviour" requirement is not. *Fix*: keep the audit tier `passkey_only` but
book-keep exactly like a wrong password (acct_fail, failed_count, lock, fail_global) - the lock affects password sign-in only, which this
user does not use. Cheap; do it before the owner switch is on for real users.

**P-02 - low - silent fallback to password when the mode stops being effective (READ).** `local_passkeys.py:178-181`
(`only_effective` = flag AND owner switch AND a usable passkey). A changed public address (rp_id), a switched-off owner switch or an
unusable credential makes the password work again with no audit specific to the fallback. A settings administrator can therefore re-open
password sign-in for a passkeys-only user. *Fix*: audit `auth.local.sign_in.passkey_only_fallback` and notify the user / managers on the
first password sign-in while `passkey_only = 1`.

**P-03 - info - verified by reading**: enumeration unchanged (same 401; `verify_dummy` on every refusal branch); the last usable
passkey cannot be removed while the mode is on (`:441-447`); passkey-first cannot be switched off under the mode (`:473-474`, router
PATCH `:613-616`); self-service needs a fresh sign-in; an administrative user needs another administrator with a non-passkey-only way in
(`recovery_path_exists`, evaluated at enable time only - a later removal of that administrator can strand the user; the admin route on
the local channel remains the recovery); administrative targets are hidden on the remote channel (404). Lockout: the password path's
lock does not touch the passkey path, so a locked password never locks out the passkey user.

## 7. Tests

### 7.1 HTML filter probe (TESTED, this review)

Scratch script (not committed), regex copied verbatim from `out_documents.py:42-45`, run with `python -I`:

```
BLOCKED  script tag
BLOCKED  javascript href
BLOCKED  remote img
BLOCKED  meta refresh
PASSES   img onerror handler
PASSES   svg onload handler
PASSES   body onload
PASSES   details ontoggle
PASSES   entity-encoded javascript scheme
PASSES   entity-encoded colon
PASSES   tab inside scheme
PASSES   newline inside scheme
PASSES   svg script via data:image/svg+xml in a href
PASSES   math/svg use with data:image
PASSES   style tag with expression (IE only)
PASSES   input autofocus onfocus
PASSES   video poster relative + onloadstart
PASSES   formaction without form (button)
PASSES   srcdoc on non-iframe (inert)
PASSES   entity in meta http-equiv
BLOCKED  protocol-relative in a background attr with leading newline
```

### 7.2 Branch test files re-run on the reviewed heads (local workstation, `local_run.sh`, fakes only)

| Head | File(s) | Result |
|---|---|---|
| integ/2100 `f32770899` | `tests/test_vendorq_294_documents.py` | PASS 25 / FAIL 0 (exit 0; `-x`) |
| SECFIX2-295 `02a252636` | `tests/test_secfix2_pub07_guard_first.py`, `tests/test_secfix2_unknown_person_404.py`, `tests/test_secfix2_pub04_portal_start_worker.py` | PASS 59 / FAIL 0 / ERROR 0 / skipped 0 (exit 0) |

Both runs used the workstation venv (`.venv`, Python 3.12) in detached worktrees at the pinned commits, `-p no:cacheprovider`, BelowNormal
priority through `local_run.sh`. Warnings only (a Starlette TestClient deprecation).

NOT_RUN in this review: every frontend spec, `test_bridge_key_rotation_295.py`, `test_door_automation_295.py`, the passkeys-only
tests, the camera header pins, the remote-channel files. Their last results are the branches' own reports.

## 8. Contradictions recorded (not resolved)

1. CR-WISKEY-HMAC-ROTATION-295 presents "verified / anchor eligible" states while section 13 defers the wiring of sign/verify to the
   activation slice; the screen vocabulary and the real channel disagree until then (H-01).
2. CR-AUTODOORS-295 12.1: CR-033 6.4 (D10a) "stored approving actor" vs the operator-plus-armer model - owner decision pending.
3. CR-AUTODOORS-295 12.4: `automation.manage` at the installation vs floor-scoped editors - owner decision pending.
4. The package's assumption 4.4(2)-(3) (Cloudflare body buffering decides whether body-phase costs are reachable) is still an
   assumption; nothing in the reviewed code can make it true or false.

## 9. Not verified

Real browsers (blob `download`, CSP inheritance into `blob:` documents), any phone or in-app WebView, the Cloudflare tunnel and its
rules, the Linux add-on image, FastAPI versions other than the one pinned in the repository, the header pins on every edge answer
(Q12), the remote-channel limiter keying for IPv6 (Q16), `remote-config` (Q17), the CSRF rule on `DELETE` / `PATCH` (Q18), pre-code
writes on handler / RFQ / consent paths (Q1), the `NEVER_EXPORTED_TABLES` membership of the door-automation tables, the WisKey
capture-start and revision-409 paths for the uniform 404, and every test listed as NOT_RUN in section 7.

## 10. Recommended order of work

1. P-01 (one function, before passkeys-only reaches real users).
2. D-01 (b)+(c) and D-02 (octet-stream + regex hardening) before any HTML producer; D-04 counter before `start_worker` ON.
3. H-02, H-05, H-09 inside the HMAC activation slice together with the H-01 wiring; H-03 text in CR, screen and guide.
4. A-01 corroboration gate, A-02 in-transaction re-check, A-03 per-door cap - all before `doors.automation_open`.
5. Flip `access.unknown_person_uniform_404` default to `true` (D-13); `microphone=()` on the remote channel (R-01).
