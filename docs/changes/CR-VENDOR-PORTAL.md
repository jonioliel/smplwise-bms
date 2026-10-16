# CR-VENDOR-PORTAL - the vendor portal on the public page (branch `pilot/VPORTAL`)

**Status:** implemented on `pilot/VPORTAL` (base `origin/integ/263` @ `984b6c94`), OFF by default. Owner-approved design (2026-10-16).
**This is a NEW PUBLIC AUTHENTICATION SURFACE.** It needs the security review of `docs/security/TICKETS_PUBLIC_SURFACE_REVIEW_CHECKLIST.md`
(sections 1, 2, 6) plus section 6 below before it is switched on anywhere.

## 1. What it does

A vendor opens the public page address without a link - `https://<host>/support` (also `/support/`, `/Support`, `/SUPPORT/`: only
the bare root, only while the portal is on) - and types a mobile number. The number is normalised to one canonical form
(`050-900-7676`, `0509007676`, `+972 50 900 7676`, `+972-50-9007676`, `00972509007676`, `+972 050 ...`, Arabic-Indic digits ->
`972509007676`; the directory's own `contacts.normalize_phone` rule plus the `+972 0` slip). If, and only if, that number belongs to a
live directory row (contact or vendor, active, not erased, not linked to a user, not an employee row, WhatsApp verification not
pending) that has at least one request to show, a 6-digit code is sent over WhatsApp - the existing outbox and the fixed
`phone_verify` message (TKNOTIFOTP). The answer is ALWAYS `202 {"code":"sent_if_registered"}`.

After the right code: a read-only session of 30 minutes (absolute, never extended) in an HttpOnly cookie. The vendor sees their open
requests and the ones finished within `closed_months` (default 2): number, title, place, department, status, dates (sent, finished,
expected), the quote (amount + state) and the payment request (amount + status, paid / not paid). Never a payment reference, a
payment date, notes, internal notes, a phone number or any bank detail - the item answer is an allow-list (`vendor_portal.ITEM_KEYS`)
and the module collects no bank data at all (a repository test greps the migrations and the module for bank field names). An item
with a live handler link opens the EXISTING handler page (the token already sent to that number for that assignment; the page keeps
its own code / grace rules - nothing is widened). The portal writes nothing about any request.

Branding on all public pages (handler page, quote request page, portal): the organisation name (existing setting) and an optional
logo uploaded in Settings (system.configure), served as a separate image file `/<prefix>/brand/<stamp>.jpg` - never inlined in a
bundle. Without a logo the pages show the name only (the initial in the badge, as before).

## 2. Switches and settings (all in `tickets.settings`, edited with `system.configure`)

| Key | Default | Meaning |
|---|---|---|
| `vendor_portal.enabled` | `false` | The portal. Off: every portal route answers the public uniform 404, the bare / any-case root stays 404, the page shows its unavailable screen exactly as before. |
| `vendor_portal.closed_months` | `2` | 1-24: how far back finished requests are listed. |
| `brand.logo` | `""` | The logo's stamp. Written ONLY by `POST/DELETE /api/v1/tickets/settings/logo`; `PUT /tickets/settings` refuses it (422). |

Settings UI: Settings > the module > General > the handler-page card - "לוגו בדפים הציבוריים" (upload / replace / remove, preview) and
"אזור ספקים" (on / off, months back).

**Cloudflare:** the route is the owner's job. The existing single route `^/support(/.*)?$` already covers `/support` and `/support/...`.
It is case-sensitive in Cloudflare: `/Support` reaches the listener only if the owner adds a case-insensitive route (or a second
route for `/Support`). The listener itself serves the any-case root while the portal is on.

## 3. Routes

Public listener (port 18093, behind the edge; internal names under `/t/`, served under the public prefix):

| Route | Kind (rate gate) | Answer |
|---|---|---|
| `GET /t/api/portal/config` | `portal_read` | brand + look; uniform 404 while off |
| `POST /t/api/portal/start` `{phone}` | `portal_start` | always 202 `sent_if_registered` for a well-formed number (422 for a malformed one); the lookup and the message run after the answer (background task) |
| `POST /t/api/portal/verify` `{phone, code}` | `portal_verify` | 200 + `Set-Cookie`, or the one 422 `code_invalid` |
| `GET /t/api/portal/items` | `portal_read` | the session's items; uniform 404 without a live session |
| `POST /t/api/portal/open` `{item}` | `portal_read` | `{token, number}` of that item's live handler link; uniform 404 for anything out of scope |
| `POST /t/api/portal/logout` `{}` | `portal_read` | revokes the session, clears the cookie |
| `GET /t/brand/<stamp>.jpg` | `asset` | the current logo only (`image/jpeg`, `nosniff`, immutable); uniform 404 otherwise |

Main app (system.configure): `POST /api/v1/tickets/settings/logo` (multipart, <= 512 KB, within the default 1 MiB body limit),
`DELETE /api/v1/tickets/settings/logo`, `GET /api/v1/tickets/settings/logo` (preview).

The cookie: `__Secure-arx_vp=<256-bit value>; Path=/<prefix>/api/portal; Max-Age=1800; Secure; HttpOnly; SameSite=Strict`. The edge
(`public_http.py`) keeps its rule "no cookie in, no cookie out" with ONE narrow exception: it reads exactly one `__Secure-arx_vp` pair
of the right shape for `/t/api/portal/{items,open,logout}` (two pairs or another shape = no session) and lets a `Set-Cookie` of that
name leave only from `/t/api/portal/{verify,logout}`. The `Cookie` header itself still never reaches the app.

## 4. Data (migration `0110_ticket_vendor_portal.sql` - PROVISIONAL NUMBER)

Additive only: `ticket_portal_codes` (one row per accepted code request for a number: `phone_key` = HMAC of the canonical number under
the module key, `code_hash` = HMAC-SHA256(k, 'vp|' id | phone_key | code), digits derived from the 128-bit row id at render time - W9;
`contact_id` = the row the message went to, NULL when nothing was sent; attempts, consumed, invalidated; pruned after 2 days) and
`ticket_portal_sessions` (`id_hash` = SHA-256 of the cookie value, `phone_key`, `key_id`, created / expires / revoked; pruned once
ended). No number, code or session value is stored in clear. Neither table is a project-backup table.

**Renumbering:** 0110 is provisional - the lead renumbers it at integration (the runner accepts a gap; `tests/test_migrations.py`
asserts no gap and is red until then).

## 5. Reuse (nothing duplicated)

- WhatsApp: the existing outbox, purpose `phone_verify` (fixed code text, WhatsApp only, never held, never a fallback channel);
  `phone_verify.derive_for_outbox` renders a portal row too; `phone_verify.kill_codes` (a changed number) also ends the portal codes
  that went to that row and cancels their queued message; erase (`phone_verify.forget`) deletes them.
- Codes: `codes.new_code_id` / `derive_code` / `parse_code`; keys: `keyring.KEYS`, `links.phone_key`, `links.new_session_value` /
  `session_hash` / `parse_session`, `links.derive_token`.
- Who may receive: `phone_verify.whatsapp_allowed` (TKNOTIFOTP), `messaging.whatsapp_code_ready`.
- The handler link's state: `public_store.fold` + `LinkRecord.available` / `no_money`.
- Images: `image_intake.reencode` (the public surface's hostile-image pipeline) for the logo.

## 6. Threat model

| Threat | Control | Residual |
|---|---|---|
| **Enumeration** of registered numbers (response, status, timing, side effects) | Identical 202 bytes and headers for every well-formed number; the lookup and the message run after the answer was sent (background task) - same timing class; a code row is written for unknown numbers too, so verify walks the same path (row, HMAC compare, attempt update) and answers the same 422; no audit row on a wrong guess (it would only exist for a known number - a timing difference); per-number caps answer the same 202. Tested byte for byte. | The WhatsApp message itself reaches the real owner of the number (that is the point). A slower answer under load is not number-dependent. |
| **Brute force** of the code | 6 digits, 10 min, single use (compare-and-set), 5 wrong guesses end the code, a new code ends the old one; per number 1 / 60 s, 3 / h, 6 / day (unknown numbers count too); `portal_verify` 30 / 10 min per client network; malformed values are not guesses. Worst case per number: 6 codes x 5 guesses = 30 guesses a day ~ 3 x 10^-5. | An attacker who knows a vendor's number can spend that number's daily code budget (a denial of sign-in for that vendor for the day, never access). |
| **SIM swap / number reuse** (a number now in someone else's hands) | Only rows active, not erased, not staff, not employee; only numbers with something to show; the item list is re-read from the CURRENT number on every request (a changed number empties a live session at once and kills pending codes); 30-minute read-only session; no bank or contact data; with `phone_verify.required` (TKNOTIFOTP) an unverified number never receives a code. | A reassigned number whose directory row was not updated can see that vendor's titles, places and amounts for the window. Recommended: turn on number verification, keep `closed_months` short, deactivate vendors who left. |
| **Session theft** (XSS, CSRF, interception, fixation) | HttpOnly (no script reads it), Secure + `__Secure-` prefix (HTTPS only), SameSite=Strict + JSON-only bodies (415 otherwise) - no cross-site request carries it; Path = the portal API only; 256-bit random value stored as a hash; minted only after a correct code (no fixation); absolute 30 min, never extended; logout revokes; the portal switch off or a key rotation ends every session; item ids are per-session HMACs; CSP without inline script; DOM from text nodes only. | A stolen unlocked phone with an open session shows the list for at most 30 minutes (read-only). The handler token handed to the page for "open" is the one already sent to that number. |
| **Cost abuse of WhatsApp** | A message only for a registered number with something to show; per number caps; `portal_start` 10 / 10 min and 30 / h per client network, 300 / h installation-wide; at most 200 portal messages a day for the installation (`SENT_PER_DAY`); the outbox paces the account like every message. | A distributed flood can use up the daily 200 and the hourly 300 - a denial of sign-in for everyone until the window passes, never a bill beyond 200 messages a day. The Cloudflare rate-limiting rule on `/support/api/*` (install guide) is the first line. |
| **Malicious logo** (SVG script, polyglot, decompression bomb, metadata) | JPEG / PNG by content only (SVG, WebP, HEIC, GIF refused); 512 KB; header-judged pixel cap (4 MP) before decoding; metadata-free decoder copy; a fresh JPEG <= 512 px; fixed `image/jpeg` + `nosniff` + the public CSP; the file name is the content stamp and the page only builds a path from the exact `[0-9a-f]{16}.jpg` shape. Upload: system.configure, audited. | Pillow / libjpeg decoder bugs (dependency risk, as for photos). |
| **Data exposure** beyond the vendor's own rows | Rows matched by the keyed CURRENT number only; allow-listed item keys; no payment reference / date, no notes, no lines; uniform 404 for any item or session out of scope. | Rows of the same number in the directory (e.g. a person and a vendor company with one shared number) are shown together - by design of "scoped to that phone". |

## 7. Tests

- Backend `smplwise_vms/backend/tests/test_tickets_vendor_portal.py` (47, negative cases first): off by default (uniform 404 on every
  route, root 404, nothing written), validation and permission of the settings, byte-identical answers for a known and an unknown
  number, the answer independent of the lookup, one refusal for every failed verification, malformed numbers / bodies, 9 Israeli
  formats, 5 wrong guesses, malformed codes not counted, expiry, single use, a new code ends the old, per-number caps answer the same,
  the client-network limit, the installation daily cap, no code for a number with nothing to show / inactive / staff / unverified /
  without a channel, an old number's code signs nobody in, the cookie's attributes and hashed storage, tampered / doubled / foreign
  cookies, 30-minute expiry without renewal, logout, cross-session item ids, a changed number empties a live session, the switch off
  ends sessions, the edge never passing / setting the cookie elsewhere, allow-listed keys with amounts and paid and no payment
  reference, no bank fields in the module, the happy path to the existing handler page with no secret in logs / outbox / audit, a
  queued message rendering its code after the in-memory copy is lost, an item without a live link, the window setting, the any-case
  root only while on, the logo (SVG / GIF / WebP / garbage / too large refused, permission, re-encode, stamp naming, immutable, 404 for
  old / other names, handler view field, delete), the config answer's keys.
- Frontend `frontend/tests/unit-public-portal.spec.ts` (guards: no innerHTML / cookie access / storage / links in the portal chunk,
  `credentials: 'same-origin'` and `redirect: 'error'`, the logo path shape; texts: all four languages complete with the same
  placeholders, no "not registered" wording; logic: refusal mapping, inputs, canonical root, item split, money lines) and the budget
  test in `unit-public-ticket.spec.ts` (the portal chunk and stylesheet `portal-page-*` get their own 12 KB; the ticket page keeps
  60 KiB).

## 8. Deviations from the request (and why)

1. **Plain DOM, not Lit, on the public page** - the public page has never used Lit (its gzip budget and its "no app code" guard); the
   portal follows the page's own `dom.ts` / `strings.ts` pattern. The Settings controls are Lit (the app).
2. **Code lifetime 10 minutes** - the fixed WhatsApp text (`phone_verify`, reused as asked) says "valid for 10 minutes".
3. **"Back to the list" after an opened item** - not built: the ticket page's 60 KiB budget had 257 bytes left; the portal hand-off,
   the logo and the canonical-root move took 249 of them. "סיום" ends at the finished screen as for any link; opening `/support`
   again shows the list while the session lives.
4. **Requests for quotation** are not listed (only service requests with their quote and payment request); RFQ quotes stay on the
   RFQ vendor page. See question 2.
5. The bare / any-case root is served only while the portal is on (with it off nothing changes on upgrade, as required).

## 9. Questions for the owner

1. Number reuse: should the portal require a number confirmed by code (TKNOTIFOTP) even while the installation switch is off?
2. Should open requests for quotation (RFQ invitations and their quotes) appear in the portal too?
3. A vendor company and its technicians: should a company number also see the requests of its persons (`vendor_id`)? Today: only
   rows whose own number matches.
4. May the portal be switched on from a remote (tunnel) session, or local only like the public address? Today: any system.configure
   session.
5. Cloudflare: add a case-insensitive route so `/Support` reaches the listener?

## 10. NOT_RUN / limits

- No runner job (runner disk full, release gate running): the full backend suite, the Linux image, Playwright screenshots
  (desktop / mobile / RTL, loading / empty / error / ready) and the evidence suites are NOT_RUN. The public bundle in
  `smplwise_vms/www-public/` was NOT rebuilt (release step); the budget was measured on a local build in the scratchpad.
- No live WhatsApp, tunnel or phone; Arabic and Russian strings need a native review.
