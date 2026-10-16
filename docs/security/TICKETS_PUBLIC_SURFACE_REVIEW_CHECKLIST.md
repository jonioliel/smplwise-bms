# Tickets module: public-surface security review checklist (CR-038, slice 8)

Status: **checklist only. No review has been performed and no result is recorded here.** A reviewer copies this file, fills the
"Result" column with PASS / FAIL / NOT_RUN and evidence (test name, command, line), and records findings in a separate
`SECURITY_REVIEW_*` document. Do not mark an item PASS from reading a note; the notes describe intent and local test results, not a
reviewed system.

Surface under review: the anonymous handler page and its API (`/t/*` on container port 18093, `services/tickets/public_*.py`,
`handler_*.py`, `links.py`, `codes.py`, `image_intake.py`, `cost_files.py`, `frontend/src/public-ticket/`), plus the two internal
paths that feed it (assignment to an outside contact, the message channel / WhatsApp inbound).

Sources the reviewer should read first (all in `docs/changes/`): `CR-038-TICKETS-MODULE.md` sections 10, 11A, 16 (threat table
S1-S25+), 17; `CR-038-PUBLIC-CORE-NOTES.md` (sections 3-8, 10, 11: the W1-W22 wiring traps, decisions, known limits);
`CR-038-S4-NOTES.md`; `CR-038-S5B-NOTES.md`; `CR-038-S7-NOTES.md` (branch `pilot/TICKETS-s7`); `CR-038-S9-NOTES.md` (branch
`pilot/TICKETS-s9`). Earlier reviews: `private/planning/TICKETS_SPEC_REVIEW_2026-10-13.md`,
`private/planning/TICKETS_PUBLIC_CORE_CODE_REVIEW_2026-10-13.md`.

Rules for the review itself: read-only; no real tunnel, device, vendor or phone number; use fakes or a local listener; never put a
token, link, code or phone number in the report.

## 1. Isolation and exposure

| # | Verify | Where (notes) | Result |
|---|---|---|---|
| 1.1 | The public listener is a separate thread, loop and thread limiter (6 tokens); the main app serves no `/t/*` route and the listener serves nothing else | PUBLIC-CORE 1, W14, W16 | |
| 1.2 | Port 18093 is declared in the add-on but unmapped on the host; the option `tickets_public` is off by default and the listener starts only with it on | S4 1 (listener wiring) | |
| 1.3 | The public bundle is built to `www-public/`, never into `www/` (repository test exists; confirm it runs in the gate) | PUBLIC-CORE W16 | |
| 1.4 | Module off: every public route, the shell and `/t/healthz` answer the byte-identical uniform 404 | PUBLIC-CORE 6.10, W3 | |
| 1.5 | No FastAPI body readers (`Body`, `Form`, `File`, `UploadFile`) in the public modules | W17 | |
| 1.6 | Response headers on every answer: CSP (`default-src 'none'`, `script-src 'self'`, `style-src 'self'`, `img-src 'self' blob:`), HSTS, `no-store`, no `Server`, no cookie, no CORS, no `ETag` / `Last-Modified` / `Accept-Ranges` | PUBLIC-CORE 2 (answer), 6.9, S4 7 | |
| 1.7 | No inline script or style, no `data:` URLs, no third-party origin, no fonts in the page | S4 1 (handler page) | |
| 1.8 | Install guide items present and correct: unmapped port, tunnel `keepAliveTimeout` below 5 s, `keepAliveConnections` at most 8, Cloudflare rate-limit rule on `/t/api/*`, script-injection features off for the dedicated hostname | PUBLIC-CORE 5.10, W22; `docs/user-guide/he/46-tickets_HE.md` part A | |

## 2. Request hardening and resource limits

| # | Verify | Where | Result |
|---|---|---|---|
| 2.1 | Request head: 16 KiB / 64 headers (431), 10 s head deadline, TE + CL refused (400) | PUBLIC-CORE 2.1-2.2 | |
| 2.2 | Connection budget: 8 per untrusted client network, 64 total (JSON 503 then close), 256 hard (closed); slow readers aborted after 30 s; lifetime 300 s plus backstop | PUBLIC-CORE 2.1, 6.20-6.22 | |
| 2.3 | 16 requests in flight (JSON 503 `busy`); 2 body requests per token; 5 s idle between body chunks; body deadlines 10 s JSON / 60 s upload | PUBLIC-CORE 4 | |
| 2.4 | The rate gate runs before any database read; unknown, expired and revoked tokens cost exactly one indexed read and return the same 404 (timing and bytes) | PUBLIC-CORE 2.3, W1, W2; S4 wiring tests | |
| 2.5 | Rate numbers: 20 failed lookups / min per client network, 300 / min installation-wide, redeem 10 / min per network, writes 20 / h and photos 10 / h per link, spent after the effect (writes) or at the body phase (uploads) | PUBLIC-CORE 4, W18 | |
| 2.6 | Client address: taken only from the configured header and only from a trusted peer; behaviour when the header is missing or repeated; the address probe's SSRF rules (no redirects, private targets refused, body never shown, local only, rate-limited) | PUBLIC-CORE 6.12, W13, W21; S4 | |
| 2.7 | The default trusted-proxy network includes every add-on on the hassio network (known residual): confirm what holds against such a peer | PUBLIC-CORE 7 | |
| 2.8 | Idempotency: `client_request_id` replays only 2xx answers, scope `link:<id>:<generation>`, row written in the effect's transaction (W5) | PUBLIC-CORE 6.14, W5 | |

## 3. Tokens, links, redeem ids

| # | Verify | Where | Result |
|---|---|---|---|
| 3.1 | Token is 192 bits, derived from the module key, link id and generation; only its hash is stored; the token travels in the URL fragment and is removed from the address bar | PUBLIC-CORE 1 (`links.py`), S4 1 | |
| 3.2 | Token never appears in a log line, audit row, timeline row, error, health counter or response other than the one-time copy answer (`no-store`) | S4 7; `test_tickets_public_logs.py` | |
| 3.3 | Revocation folds into the single lookup: reassign, return, "not mine", manual revoke, contact change / erase, key rotation, grace end, past cap (W2) | S4 1 (links), W2 | |
| 3.4 | Lowering a cap pulls in live links; reopen kills a grace link | S4 1 | |
| 3.5 | The e-mail redeem id: single-statement release with a use limit under concurrency (W4), never the fragment in the e-mail | W4; S5B 4 (item 9) | |
| 3.6 | Module key: files `tickets_key.<id>` / `.current` (0600, atomic); created only on the module-on path and never while rows depend on a missing key (W12); rotation is atomic with the database; a restore without `secrets/` is refused / flagged | PUBLIC-CORE 5.11, W12; S4 2.3 | |
| 3.7 | Link forwarding: a link shows exactly one ticket, no other tickets, no phone numbers, no internal notes or photos | TICKETS-MODULE 16 S2 | |

## 4. Verification codes (slice 7 branch)

| # | Verify | Where | Result |
|---|---|---|---|
| 4.1 | Six digits, derived at render time under the link's own key; digits never stored, queued, logged or audited (W9); the stored hash includes the generation (deviation from the spec text, recorded) | PUBLIC-CORE 6.1, W9; S7 | |
| 4.2 | Caps per link generation (1 / 60 s, 3 / h, 6 / day) and per recipient (6 / h); a new code ends the older one; consume is compare-and-set | PUBLIC-CORE 4, W7, W8 | |
| 4.3 | Lock after the configured wrong attempts; only counted guesses; a locking guess writes a `system` timeline row; the manager's "new link" starts a clean generation | PUBLIC-CORE 6.5; S7 | |
| 4.4 | Until a code session exists, the ticket answer discloses only number, department, organisation and `code_required` | TICKETS-MODULE 10.5 | |
| 4.5 | Channel rule D6 in all combinations, at assign time, at send time and at "new link" | S7 decisions 1; S4 2.4 | |
| 4.6 | Session value is 256-bit, stored as a hash, 12 h, never past the link; dies with a new generation | TICKETS-MODULE 10.5 | |

## 5. Handler writes, uploads and text hygiene

| # | Verify | Where | Result |
|---|---|---|---|
| 5.1 | Every write re-reads the link inside its own transaction; a link that stopped serving gives the uniform 404; grace gives 409 `read_only`; status moves limited to the handler's table | S4 1 (public routes) | |
| 5.2 | Photos: JPEG / PNG only (HEIC and WebP refused), 8 MiB, header-judged pixel limits before decode, 16-bit and exotic PNG / JPEG refused, EXIF / GPS / ICC stripped by re-encoding, output at most 2048 px | PUBLIC-CORE 4, 6.7-6.8 | |
| 5.3 | Decoder receives a metadata-free copy; no upload metadata reaches any logger at any level (log scan with `PIL` at level 1) | PUBLIC-CORE 6.8, V10 | |
| 5.4 | Decode memory: peak RSS per path measured on Linux (`SW_MEASURE_RSS=1`); the 400 MB bound is a guess until measured | PUBLIC-CORE 8 (NOT_RUN) | |
| 5.5 | Upload budgets: one upload in flight per link, 32 MiB of declared bodies at once, 2 processing slots, storage cap, 30 / 60 photos per assignment / ticket; a transaction failure after storing deletes the file (W5, W6) | PUBLIC-CORE 4, W5, W6 | |
| 5.6 | Token-authorised photo read answers only attachments marked visible to the handler, of this link's ticket, not deleted, path confined (W10, W19) | S4 7 | |
| 5.7 | Text hygiene on every input (controls, bidi, zero-width, NFC, length after cleaning); no auto-linking; the page builds no link and uses text nodes only (W20; Playwright check) | PUBLIC-CORE 6.13, W20 | |
| 5.8 | CSV export neutralises formulas; templates reject hidden characters | PUBLIC-CORE 1 (`text_hygiene`); S6B 1 | |
| 5.9 | Cost-claim files (slice 9 branch): PDF magic / trailer / size, refused names in the file and in every inflated zlib stream, remaining limit (other filters are not decoded) accepted explicitly; PDFs served as sandboxed downloads only | PUBLIC-CORE 4 (PDFs), 7; S9 | |
| 5.10 | Cost claims: totals recomputed on the server from integer minor units, client totals ignored, immutable revisions, append-only decisions | TICKETS-MODULE 11A.13 (S21); S9 | |

## 6. WhatsApp and e-mail channel (internal side of the surface)

| # | Verify | Where | Result |
|---|---|---|---|
| 6.1 | Master switch `whatsapp.enabled` off by default: nothing leaves, no reply subscription, no event subscription | S5B top | |
| 6.2 | The outbox row, the timeline row and the audit row are one transaction; no column holds a number, address, token, code or text (test asserts it); the provider call runs with no write lock held | S5B 1, 3 | |
| 6.3 | Outcomes: `unknown` is never retried or re-routed; `not_sent` retries then falls back; a disconnected account holds then falls back and does not send on reconnect; a switch turned off holds queued rows | S5B 4; MSG-CORE 5 | |
| 6.4 | Inbound replies are advisory: forward-only status, notes marked unverified, never done / close / return; code-protected contacts: notes only; late replies flagged; dedupe 24 h; nonce bound to the live link and, when a number is present, to the sender's phone key | TICKETS-MODULE 16 S6; MSG-CORE 5 (item 11) | |
| 6.5 | Ambiguous replies: claim-before-reveal compare-and-set, text shown to the claimer only and audited, text deleted on attach / dismiss, queue shows the directory name only | S5B 1 (routes) | |
| 6.6 | Account filter on inbound events by entry id; behaviour without an entry id (UNVERIFIED) | S5B 7 | |
| 6.7 | Logs, hooks, audit envelopes and ledger rows contain no number, token, redeem id, code or message text (`test_tickets_msg_logscan.py`) | MSG-CORE 7 | |
| 6.8 | The e-mail channel sends the redeem link, never the fragment URL; e-mail codes only with the fallback on and never when the link itself went by e-mail | S5B 4 (items 9, 10) | |

## 7. Internal authorisation that guards the public surface

| # | Verify | Where | Result |
|---|---|---|---|
| 7.1 | Sending outside needs manager rights and `tickets.external`; gates run in order before any write; refusals audited | S4 1 | |
| 7.2 | A contact row that names an internal user can never receive a link; phone or e-mail change revokes live links; erase writes a tombstone | S4 1 | |
| 7.3 | `access.visible` is the only decider; unchecked store readers are called from `access.py` only (static test); every `{ticket_id}` route returns the uniform 404 for an invisible ticket | S1 1 | |
| 7.4 | Sensitive permissions are not implied by roles; the single-permission roles; the sensitive list (`tickets.external`, `tickets.all_departments`, `tickets.configure`, `messaging.accounts.manage`, cost permissions) | S1 1 | |
| 7.5 | Local-only routes stay local: address probe, WhatsApp test send; remote channel blocks them | S4 1, S5A 1 | |
| 7.6 | Backups: settings keys and the WhatsApp mapping never travel in a project backup; `secrets/` is never restored; the add-on backup residual is documented | S1 3 (item 9); PUBLIC-CORE 5.8 | |

## 8. Assumptions that only a live or Linux check can settle (record NOT_RUN honestly)

- A real Cloudflare tunnel to port 18093: second container port reachability, the peer address, request-body streaming, origin
  keep-alive and pool, and how the browser sees a connection-budget 503 (PUBLIC-CORE 8, S4 7).
- The Linux add-on image: the listener's header-flood branch on Linux, Pillow decoders, `RETURNING` on the image's SQLite, peak RSS per
  decode path (PUBLIC-CORE 8).
- Real phone uploads: iPhone HEIC conversion, Android camera JPEGs with large EXIF and MPF; the camera capture of the cost-claim step
  (S4 7, S9 4).
- `ha-whatsapp` behaviour: `account` accepts the config entry id; REST response shape; unknown-account error; event fields and
  `entry_id`; `sender_number` and timestamp shapes; what the "last message" sensor puts into the entity mirror and the recorder
  (S5A 4, S5B 7, MSG-CORE 6; checks listed in `private/planning/TICKETS_WHATSAPP_LIVE_CHECKS_HE.md`).
- uvicorn 0.53.0 behaviours the listener relies on: re-run `test_tickets_public_server.py` on any upgrade (PUBLIC-CORE 8).

## 9. Known and accepted residuals to confirm with the owner (not findings by themselves)

Taken from PUBLIC-CORE section 7 and TICKETS-MODULE section 16: every add-on on the hassio network can set the client-address
header; PDF filters other than Flate are not decoded; Pillow / libjpeg / zlib vulnerabilities remain a dependency risk; the SQLite
write gate is shared with the main app; holders of a forwarded link can lock that generation's code entry; a flood of well-formed
guesses can make a fresh link's first open meet a 429; an HA add-on backup holds the module key and the database; without a code,
whoever holds the link can update that ticket while the link lives.

2.5.7 (TK251A, deep review A2): the invoice PDF scan now refuses a stream dictionary that names /Predictor, indirect /DecodeParms or /Filter, or a /Filter
array with FlateDecode twice, and re-inflates output that is itself zlib (4 layers at most). Accepted exception, stated: a cross-reference stream and an image
XObject (/Type absent or /XObject, exactly one /Subtype /Image, /Width and /Height present) keep their PNG predictor, because every PDF 1.5+ writer predictor-codes
cross-reference streams and PNG images embedded by common libraries keep predictor-coded rows; image samples are not parsed as objects. The exception applies on a
trusted dictionary only. Residual: a reader that ignores /Type when it opens an object stream could be fed a predictor-coded object stream that passes as an
image. The scan remains a filter, not a guarantee (sandboxed downloads stay the real control). Pending invoice bytes are capped at 64 MiB per link next to the 30-file count.
