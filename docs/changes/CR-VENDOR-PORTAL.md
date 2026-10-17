# CR-VENDOR-PORTAL - the vendor portal on the public page (branch `pilot/VPORTAL`)

**Status:** implemented on `pilot/VPORTAL` (base `origin/integ/263` @ `984b6c94`), OFF by default. Owner-approved design (2026-10-16).
**This is a NEW PUBLIC AUTHENTICATION SURFACE.** It needs the security review of `docs/security/TICKETS_PUBLIC_SURFACE_REVIEW_CHECKLIST.md`
(sections 1, 2, 6) plus section 6 below before it is switched on anywhere.
**VPORTALRFQ addition (section 12, `pilot/VPORTALRFQ`, OFF by default):** open requests for quotation and company technician requests
inside the portal. **A Fable public-surface review of section 12 is required before release.**

## 1. What it does

A vendor opens the public page address without a link - `https://<host>/support` (also `/support/`, `/Support`, `/SUPPORT/`: only
the bare root, only while the portal is on) - and types a mobile number. The number is normalised to one canonical form
(`050-900-7676`, `0509007676`, `+972 50 900 7676`, `+972-50-9007676`, `00972509007676`, `+972 050 ...`, Arabic-Indic digits ->
`972509007676`; the directory's own `contacts.normalize_phone` rule, which since the 2.6.4 review also drops the `+972 0` slip). If,
and only if, that number belongs to a live directory row (contact or vendor, active, not erased, not linked to a user, not an
employee row, WhatsApp verification not pending, and - while `vendor_portal.require_confirmed_number` is on, the default - a number
its owner PROVED: `phone_confirmed_via` in `('code', 'user')`, never a manager's mark) that has at least one request to show, a
6-digit code is sent over WhatsApp - the existing outbox, purpose `phone_verify` (TKNOTIFOTP), with the portal's own code-owned
text `portal_code` (organisation, "sign-in code for the vendor area", 10 minutes, "we will never ask you for this code"). The
answer is ALWAYS `202 {"code":"sent_if_registered"}` - also for an unconfirmed number (no enumeration).

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
| `vendor_portal.require_confirmed_number` | `true` | 2.6.4 review F1 (owner decision 2026-10-17): "הפורטל דורש מספר שאושר בקוד" - only a number proved by its owner (`phone_confirmed_via` `code` or `user`) gets a code, EVEN WHILE `phone_verify.required` is off. The owner may switch it off. An unconfirmed number gets exactly the answer of an unknown one. |
| `brand.logo` | `""` | The logo's stamp. Written ONLY by `POST/DELETE /api/v1/tickets/settings/logo`; `PUT /tickets/settings` refuses it (422). |

All three `vendor_portal` keys are edited with `system.configure`, audited as `tickets.settings.update` (the changed key paths), and -
owner decision 2026-10-17 - may be changed from a REMOTE (tunnel) session as well as locally (they are not keys of the public
address; the reviewer's "local only" recommendation was not taken).

Settings UI: Settings > the module > General > the handler-page card (`tickets-public-card`) - "אזור ספקים" (on / off), "סגורות
להצגה (חודשים אחורה)" and "הפורטל דורש מספר שאושר בקוד" (on / off, with the line saying how to confirm a number). The 2.6.4 fix branch
found that the original branch had only the strings for these controls; it wired them. **Still missing:** the logo controls
("לוגו בדפים הציבוריים" - upload / replace / remove, preview): the strings and `api/tickets-brand.ts` exist, no card uses them yet
(the API routes work; a follow-up builds the controls).

**How a manager confirms a vendor's number (the existing TKNOTIFOTP flow):** the contacts directory > the vendor's card > "שליחת
קוד" (`POST /api/v1/tickets/admin/contacts/{id}/phone-verify/send`, `tickets.configure`) - the vendor reads the 6 digits to the
manager, who types them and presses "אימות" (`.../phone-verify/check`). The row is then `phone_confirmed_via = 'code'`. A change of
the number clears it. User guide: part 7, "אזור ספקים".

**Cloudflare:** the route is the owner's job. The existing single route `^/support(/.*)?$` already covers `/support` and `/support/...`.
It is case-sensitive in Cloudflare: `/Support` reaches the listener only if the owner adds a case-insensitive route (or a second
route for `/Support`). The listener itself serves the any-case root while the portal is on. **Rate limiting:** besides the rule on
`/support/api/*`, a tighter rule on `/support/api/portal/*` (e.g. 10 requests / 10 min per IP) while the portal is on - the first line
against code-request floods and guessing (user guide part 7, item 3).

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

## 4. Data (migration `0105_ticket_vendor_portal.sql`; provisional 0110 on the branch)

Additive only: `ticket_portal_codes` (one row per accepted code request for a number: `phone_key` = HMAC of the canonical number under
the module key, `code_hash` = HMAC-SHA256(k, 'vp|' id | phone_key | code), digits derived from the 128-bit row id at render time - W9;
`contact_id` = the row the message went to, NULL when nothing was sent; attempts, consumed, invalidated; `net_hash` =
HMAC(k, 'vpn|' requesting client network, /24 or /64) - 2.6.4 review F6; pruned after 2 days) and
`ticket_portal_sessions` (`id_hash` = SHA-256 of the cookie value, `phone_key`, `key_id`, created / expires / revoked; pruned once
ended). No number, code or session value is stored in clear. Neither table is a project-backup table.

**Renumbering:** provisional 0110 on the branch; renumbered to 0105 at the integ/264 integration (contiguous 0101..0105).

## 5. Reuse (nothing duplicated)

- WhatsApp: the existing outbox, purpose `phone_verify` (WhatsApp only, never held, never a fallback channel); the text is the
  code-owned variant `portal_code` (`message_templates.FIXED_STARTERS`, chosen by the row's `template_id = 'starter:portal_code'`
  through `fixed_starter`; never editable, a stored template is never used) - no outbox purpose or table change;
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
| **Enumeration** of registered numbers (response, status, timing, side effects) | Identical 202 bytes and headers for every well-formed number; the lookup and the message run after the answer was sent (background task) - same timing class; a code row is written for unknown numbers too, so verify walks the same path (row, HMAC compare, attempt update) and answers the same 422; no audit row on a wrong guess (it would only exist for a known number - a timing difference); per-number caps answer the same 202. Tested byte for byte. 2.6.4 review F3: who the number belongs to (directory rows, items, daily budget, account) is read on a READ connection before the write transaction, so that work never holds the shared write lock; under the lock every number walks the same statements (prune, caps, one primary-key re-check with an empty id for nobody, invalidate, insert). | The WhatsApp message itself reaches the real owner of the number (that is the point). Under the write lock only the outbox insert + the `code_send` audit row of a message that really leaves still differ (a few ms, after the answer was sent, 6 requests / number / day): the full "constant-shape row + deferred delivery by the janitor" would only move the difference to the janitor tick, so it was not built. |
| **Brute force** of the code | 6 digits, 10 min, single use (compare-and-set), 5 wrong guesses end the code, a new code ends the old one; per number 1 / 60 s, 3 / h, 6 / day (unknown numbers count too); `portal_verify` 30 / 10 min per client network; malformed values are not guesses. 2.6.4 review F6: a code is bound to the client network that requested it (`net_hash`); a guess from any other network is refused and NOT counted, the right code from elsewhere signs nobody in. Worst case per number: 6 codes x 5 guesses = 30 guesses a day ~ 3 x 10^-5. | A stranger who knows a vendor's number can no longer burn the vendor's live code by guessing; he can still request a new code (which ends the older one) within the per-number caps - a denial of sign-in for that vendor for up to a day, never access. A vendor who changes network (Wi-Fi -> cellular) inside the 10 minutes asks for a new code. |
| **SIM swap / number reuse / a mistyped number on file** (a number now in someone else's hands) | 2.6.4 review F1 (owner decision): only a number its owner PROVED (`phone_confirmed_via` `code` / `user`) gets a code, also while the installation's verification switch is off (`vendor_portal.require_confirmed_number`, default on, owner may switch off); only rows active, not erased, not staff, not employee; only numbers with something to show; the item list is re-read from the CURRENT number on every request (a changed number clears its confirmation, empties a live session at once and kills pending codes); 30-minute read-only session; no bank or contact data. | A number proved once and later recycled by the carrier without the row being updated can still see that vendor's titles, places and amounts for the window. Recommended: keep the rule on, keep `closed_months` short, deactivate vendors who left. With the rule switched off: the residual of the original design (a mistyped / stale number on file reads the list). |
| **Session theft** (XSS, CSRF, interception, fixation) | HttpOnly (no script reads it), Secure + `__Secure-` prefix (HTTPS only), SameSite=Strict + JSON-only bodies (415 otherwise) - no cross-site request carries it; Path = the portal API only; 256-bit random value stored as a hash; minted only after a correct code (no fixation); absolute 30 min, never extended; logout revokes; the portal switch off or a key rotation ends every session; item ids are per-session HMACs; CSP without inline script; DOM from text nodes only. | A stolen unlocked phone with an open session shows the list for at most 30 minutes (read-only). The handler token handed to the page for "open" is the one already sent to that number. |
| **Cost abuse of WhatsApp** | A message only for a registered number with something to show; per number caps; `portal_start` 10 / 10 min and 30 / h per client network, 300 / h installation-wide; at most 200 portal messages a day for the installation (`SENT_PER_DAY`); the outbox paces the account like every message. | A distributed flood can use up the daily 200 and the hourly 300 - a denial of sign-in for everyone until the window passes, never a bill beyond 200 messages a day. The Cloudflare rate-limiting rule on `/support/api/*` (install guide) is the first line. |
| **Malicious logo** (SVG script, polyglot, decompression bomb, metadata) | JPEG / PNG by content only (SVG, WebP, HEIC, GIF refused); 512 KB; header-judged pixel cap (4 MP) before decoding; metadata-free decoder copy; a fresh JPEG <= 512 px; fixed `image/jpeg` + `nosniff` + the public CSP; the file name is the content stamp and the page only builds a path from the exact `[0-9a-f]{16}.jpg` shape. Upload: system.configure, audited. | Pillow / libjpeg decoder bugs (dependency risk, as for photos). |
| **Data exposure** beyond the vendor's own rows | Rows matched by the keyed CURRENT number only; allow-listed item keys; no payment reference / date, no notes, no lines; uniform 404 for any item or session out of scope. | Rows of the same number in the directory (e.g. a person and a vendor company with one shared number) are shown together - by design of "scoped to that phone". |

## 7. Tests

- Backend `smplwise_vms/backend/tests/test_tickets_vendor_portal.py` (47 + 14 for the 2.6.4 review, section 10; negative cases first): off by default (uniform 404 on every
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
2. **Code lifetime 10 minutes** - the portal's code text (`portal_code`, 2.6.4 review F2; it replaced the reuse of the generic
   number-verification text) says "valid for 10 minutes", and `vendor_portal.CODE_TTL` is 10 minutes.
3. **"Back to the list" after an opened item** - not built: the ticket page's 60 KiB budget had 257 bytes left; the portal hand-off,
   the logo and the canonical-root move took 249 of them. "סיום" ends at the finished screen as for any link; opening `/support`
   again shows the list while the session lives.
4. **Requests for quotation** are not listed (only service requests with their quote and payment request); RFQ quotes stay on the
   RFQ vendor page. See question 2.
5. The bare / any-case root is served only while the portal is on (with it off nothing changes on upgrade, as required).

## 9. Owner decisions (2026-10-17) on the questions

1. Number reuse: **yes** - the portal requires a code-confirmed number even while the installation switch is off; an installation
   setting `vendor_portal.require_confirmed_number` (default ON, system.configure, audited, in the settings card) lets the owner
   switch it off. Built (2.6.4 review F1).
2. Open requests for quotation in the portal: **a LATER version** (noted, not built). It is a cross-vendor surface that needs its
   own review (keyed by invitation, never by RFQ id). **Update 2026-10-17: approved and built OFF by default on `pilot/VPORTALRFQ`
   (section 12), keyed by invitation; Fable review required before release.**
3. A vendor company's number seeing its technicians' requests (`vendor_id`): **a possible LATER feature** (noted, not built). Today
   only rows whose own number matches. (Section 12's "company technician requests" is a different feature: a company asks a manager
   to add / replace a technician; it does not show the technicians' service requests.)
4. Switching the portal on from a remote (tunnel) session: **allowed** - remote as well as local, `system.configure` required; NOT
   local-only (the reviewer recommended local-only; the owner decided otherwise). Tested.
5. Cloudflare case-insensitive route: not needed; vendors get the lowercase address (user guide part 7 item 4).

## 10. The 2.6.4 security review (Fable, `private/planning/RELEASE_264_REVIEW_VPORTAL.md`) - fixes on `pilot/VPORTAL-FIX`

Every fix has a negative test first in `test_tickets_vendor_portal.py` (section 4b) unless stated.

| Finding | Fix |
|---|---|
| F1 (P2) unconfirmed number served | `contacts_of` skips a row whose current number is not proved (`code` / `user`) while `vendor_portal.require_confirmed_number` is on (default); the same answer as an unknown number; settings key + PUT field + the settings card control; remote allowed. Tests: unconfirmed known vs unknown byte-identical and no message, a manager's mark refused, `user` / `code` served, the switch (422 type, 403 without system.configure, audited, remote PUT saves, off = served). |
| F2 (P2) generic verification text | `portal_code` variant (he / en / ar / ru) of the fixed `phone_verify` message: organisation (own line, dropped when unset), "sign-in code for the vendor area", 10 minutes, "we will never ask you for this code, not even by phone", "if you did not try to sign in, ignore". Same outbox pipeline (purpose, WhatsApp only, never held, never a fallback, W9 derivation); no outbox CHECK change. The manager's number verification keeps its own text. Tests: the rendered WhatsApp text; the variant list pinned (`FIXED_STARTERS == {portal_code}`), valid as a code template, noun lint, the 0092 old-line check. |
| F3 (P3) lookup under the write lock | `plan_request` on a read connection, then `request_code` on the write connection (constant statements until a real enqueue). Test: the lookup runs on a `query_only` connection. Residual recorded in section 6. |
| F4 (P3) key retirement | `store_links.key_ids_in_use` also keeps the key of live `ticket_portal_codes`, live `ticket_portal_sessions` and (same bug class) live `ticket_phone_verifications`. Test. |
| F5 (P3) `open` 422 before 404 | the session is checked before the body; `logout` stays idempotent and answers byte-identically with a live, a dead or no session. Test. |
| F6 (P3) a stranger burns the code | (b) requester binding - the smaller safe change than a separate per-number verify brake (that would lock the vendor out too): `net_hash` column in 0105 (provisional 0110), `verify(..., net=)` refuses another network without counting. Tests: 7 wrong + the right code from another network leave the code untouched and the vendor signs in; 5 wrong guesses from the requesting network still end it. |
| F7 (P3) `+972 0` slip | moved into `contacts.normalize_phone` (12 / 13 digits starting `9720` -> drop the 0; mobile and landline), removed from the portal. Tests in the directory and portal files, and a contact saved as `+972 050 ...` reachable through the portal. Rows saved earlier with the 13-digit key are not re-keyed automatically (fail closed as before: such a row never received WhatsApp either); saving the contact again re-keys it. |
| F8 (P3) cookie not client-bound; parent-domain cookie | recorded, not changed (read-only 30-minute session; mobile networks change address; `__Host-` conflicts with the narrow path). |
| F9 (P3) docs drift | user guide part 7 item 4 (the root is 404 only while the portal is off), the tighter Cloudflare rule on `/support/api/portal/*` (item 3), a short "אזור ספקים" part; checklist 1.6 names the one cookie exception. |
| F10 (P3) name and logo public while on | recorded, intended (a sign-in page needs branding). |

Migration 0105 (provisional `0110`, renumbered at integ/264); the new `net_hash` column was added to it in place (never released).

## 11. NOT_RUN / limits

- No runner job (runner disk full, release gate running): the full backend suite, the Linux image, Playwright screenshots
  (desktop / mobile / RTL, loading / empty / error / ready) and the evidence suites are NOT_RUN. The public bundle in
  `smplwise_vms/www-public/` was NOT rebuilt (release step); the budget was measured on a local build in the scratchpad.
- No live WhatsApp, tunnel or phone; Arabic and Russian strings need a native review.

## 12. VPORTALRFQ - open requests for quotation and company technician requests (branch `pilot/VPORTALRFQ`, base `integ/264`)

**Status:** implemented on `pilot/VPORTALRFQ`, OFF by default (two switches, both need `vendor_portal.enabled`). Owner 2026-10-17:
section 9 items 2 and 3 ("a LATER version" / "possible in future") approved to build now. **A Fable public-surface review
(`docs/security/TICKETS_PUBLIC_SURFACE_REVIEW_CHECKLIST.md` sections 1, 2, 6 + 12.5 below) is REQUIRED before release and before
either switch is turned on anywhere.**

### 12.1 What it does

1. **Open requests for quotation** (`vendor_portal.rfqs`). After sign-in the portal lists the requests for quotation addressed to
   the session's own directory rows, keyed by the INVITATION (`ticket_rfq_vendors` of that contact), never by an RFQ id, and only
   while open for HIS quote: the request `sent` / `collecting` and not past its deadline, his page state `open` / `declined`, his
   personal RFQ link live (not revoked, not expired, not in read-only grace). Per item: the reference (`RFQ-07`), the department, the
   deadline, his state (open / he said "not interested"), and - unless his link asks for a code first - the title and HIS OWN latest
   quote (state + amount + currency). For a code-protected link the list shows no title and no quote (`code_first: true`): the portal
   never shows more than the link shows before its code (contract 15.3). "Open" returns HIS OWN RFQ link's token (the one already sent
   to him) and the page opens the EXISTING RFQ page with it - its own code gate, deadline, read-only and write rules, nothing widened.
   With the switch on, an open invitation counts as "something to show" for the sign-in (a vendor with only RFQs gets a code).
2. **Company technician requests** (`vendor_portal.technician_requests`). A session whose rows include a vendor COMPANY row (kind
   `vendor`; a person's or technician's own number never gets the section) sees, per company, its active technicians (names only)
   and the requests it sent in the last 90 days (action, name, the number's last four digits, state). It may ask to ADD a technician or
   REPLACE one of its own - a name and a mobile number - or withdraw a pending request. Nothing changes in the directory until a
   directory editor (`tickets.configure`, every vendor) or a holder of the NEW permission `tickets.technician_requests` (owner
   2026-10-17 - see 12.8; only the vendors of the departments he manages, every vendor with `tickets.all_departments`) approves on
   "מטפלים וספקים" › ספקים (the card "בקשות טכנאים מספקים"): the approval creates the person row through the directory's create path (kind person, `vendor_id` = the company, the company's language and departments, WhatsApp
   preferred; its number NOT confirmed - the editor confirms it with the existing code flow) and, for a replacement, sets the old row
   inactive through `contacts.update` (its live links are revoked by that path). Reject changes nothing. **No door / access right of
   any kind** - that is the separate WisKey flow. The editors get a notification `ticket.portal_tech_request` (installation level,
   subject `system`, no name / number in the text; resolved on decision or withdrawal).

Never bank data; amounts + status only, as the portal does today.

### 12.2 Switches (`tickets.settings`, `system.configure`, audited, remote allowed like the other portal keys)

| Key | Default | Meaning |
|---|---|---|
| `vendor_portal.rfqs` | `false` | Section 1. Off: its routes are the uniform 404 and an invitation is not "something to show". |
| `vendor_portal.technician_requests` | `false` | Section 2. Off: its routes are the uniform 404 (pending requests stay for the editors to decide). |

The items answer carries `features: {rfqs, techs}` (`techs` only for a session with a company row); the page fetches the lazy
`portal-more` chunk only when one is true. Settings UI: the handler-page card, under the existing portal controls.

### 12.3 Routes (public listener; the same session cookie - its Path already covers them; `PORTAL_SESSION_ROUTES` extended, the
setters unchanged)

| Route | Kind | Answer |
|---|---|---|
| `GET /t/api/portal/rfqs` | `portal_read` | `{items: [{id, ref, title, department, due_at, state, quote, code_first}]}` (allow-list `RFQ_ITEM_KEYS`) |
| `POST /t/api/portal/rfqs/open` `{item}` | `portal_read` | `{token, kind: "rfq", ref}` - his own RFQ link; the uniform 404 for anything else |
| `GET /t/api/portal/techs` | `portal_read` | `{companies: [{id, name, techs: [{id, name}], requests: [...]}], limits}` |
| `POST /t/api/portal/techs` `{company, action, name, phone, replaces?}` | `portal_write` (new) | 201 `{ok, request}`; 422 `invalid` + `fields` (name / phone / replaces / action); 409 `tech_limit`; foreign company -> the uniform 404 |
| `POST /t/api/portal/techs/cancel` `{item}` | `portal_write` | `{ok}`; the uniform 404 for anything not a pending request of this session |

Order on every route: the live session first (no / dead / doubled / malformed cookie -> the uniform 404 before the body is read),
then the section's switch (the same 404), then the strict body. Ids are opaque PER SESSION (HMAC of the session hash, each kind its
own domain `vpr|` / `vpc|` / `vpt|` / `vpq|`, distinct from the items' `vpi|`). New rate kind `portal_write`: 10 / 10 min and 20 / h
per client network, 200 / h installation-wide (before any read); per company 5 pending and 10 requests / 24 h in the rows; a
repeated identical pending request returns the existing one (nothing new stored).

Internal API (`tickets.configure`, or `tickets.technician_requests` within its department scope - 12.8; refusals audited by `rbac.require`): `GET /api/v1/tickets/portal-requests?state=pending|...|all`,
`POST /api/v1/tickets/portal-requests/{id}/approve|reject {revision}` (409 `tech_request_decided` / `tech_request_stale` /
`tech_request_vendor_gone` / `tech_request_replaced_gone`). Audit: `ticket.portal.rfq_open`, `.tech_request`, `.tech_cancel` (actor
`contact:<company>`, ids only), `.tech_approve`, `.tech_reject` (the editor), plus the directory's own `ticket.contact.create` /
`.update`.

### 12.4 Data - migration `0112_ticket_portal_tech_requests.sql` (provisional 0114 on the branch; renumbered at integ/270, 2.7.0)

One additive table `ticket_portal_tech_requests` (company, sender row, action, the technician to replace, the cleaned name, the
number as E.164 digits, state, decision, the created row, revision). The number is stored in clear because it is what the editor will
put on the row; it never leaves to the vendor again in full (last four digits), never reaches a log or an audit row. Retention:
decided rows 180 days after the decision, pending rows 90 days after they were sent (the janitor, `vendor_portal.prune`); erase of a
row deletes every request that names it (`phone_verify.forget` -> `vendor_portal.forget_contact`). Not a project-backup table (the
backup is an allow-list). No change to any RFQ table.

### 12.5 Threat model (additions)

| Threat | Control | Residual |
|---|---|---|
| Another vendor's RFQ (IDOR, enumeration of requests) | Invitations of the CURRENT number's rows only, re-read per request; per-session item ids; the uniform 404; never an RFQ id in the API | Rows sharing one number (a person and a company) see each other's invitations - the existing "scoped to that phone" rule |
| The list leaking past an RFQ link's code gate | A code-protected link lists only ref / department / deadline; open hands the link's own token; the RFQ page keeps its code gate | The reference, department and deadline of such a request (the RFQ page shows the same before its code) |
| Token exposure | The token only in the `open` JSON answer (as the item hand-off); never in a log or audit row (tested); the page keeps it in its existing per-tab RFQ slot | As the WhatsApp link itself |
| Directory enumeration through technician requests | The same answer for a known and an unknown number (masked, no "already exists"); only the editor sees `phone_known` | None found |
| Spam / text injection through the name | `model.text_field` (controls, bidi, zero-width stripped) + at least two letters, no `://`, `www.`, `@`, `<>{}`, at most four digits, 80 chars; rendered as text only (DOM text nodes, Lit escaping) | A rude but well-formed name reaches the editor, who rejects it |
| Request floods | `portal_write` per network + installation; 5 pending / 10 a day per company; idempotent repeat | An attacker with a company's session (a proved number) can fill that company's queue for a day |
| A technician request becoming a door right | None is created; the approval writes a directory row only (no access, no link, number unconfirmed) | - |
| A person's number acting for the company | The section exists only for vendor-kind rows | A company number shared by several employees: each can send requests (by design: "the company's number") |

### 12.6 Tests

- Backend `smplwise_vms/backend/tests/test_tickets_vendor_portal_more.py` (23, negative cases first): off by default (uniform 404 on
  every new route, nothing written), the portal off opens nothing, switch validation / `system.configure`; no / tampered / doubled /
  foreign-named cookie and an expired session are the uniform 404 even with a malformed body; a switch off ends a live session; the
  edge's cookie routes and setters; the `portal_write` per-network limit (429 after 10, unauthenticated); another vendor's invitation
  never listed, a foreign / guessed / truncated id never opens; an invitation alone signs in only with the section on; a code-protected
  link lists no title and no quote and its page keeps its code gate; cancelled / removed / past-deadline invitations not listed; the
  allow-list and no other vendor's amount; the hand-off token works on the RFQ page and is absent from logs and audit; a person session
  has no company; foreign company / technician ids, name hygiene (empty, URL, address, markup, digits, too long), bad numbers, extra /
  wrong fields; bidi / zero-width stripped; known and unknown numbers answer the same masked shape; no number or name in logs or audit;
  idempotent repeat and the 5-pending cap; withdrawal only of its own pending request; editors only (403 for tom / mona / vic); approve
  creates the row (unconfirmed) and deactivates the replaced one; stale / decided refusals; reject changes nothing; erase deletes the
  requests; no bank field names in the module. The existing `test_tickets_vendor_portal.py` pins the two new keys and `features`.
- Frontend `frontend/tests/unit-public-portal.spec.ts` (+3): the `portal-more` chunk calls only through the page's `call`, keeps no
  token, is imported only dynamically; four languages complete with the same placeholders and no "already exists" wording; refusal
  mapping and shape checks. `unit-public-ticket.spec.ts`: `portal-more-*` gets its own 6 KB gzip cap.
- Bundle (local build in the scratchpad, gzip): ticket page 62,352 / 62,464 B (+16: the `openRfq` hand-off in `main.ts`); portal page
  8,385 / 12,288 B (+311); `portal-more` 5,065 / 6,144 B (new, lazy); RFQ page unchanged.

### 12.7 NOT_RUN / open

- No runner job (runner busy): the full backend suite, the Linux image, Playwright screenshots (desktop / mobile / RTL; loading / empty
  / error / ready) of the two sections and of the editors' card, the evidence suites. `www-public` / `www` NOT rebuilt (release step).
- Arabic and Russian strings of the new sections are developer-written (dev-marked), need a native review.
- The Fable public-surface review (above). Open questions for the owner: see the branch report.

### 12.8 The approval permission `tickets.technician_requests` (owner decision 2026-10-17, second commit)

Owner answer to question 4: technician-request approval is NOT limited to `tickets.configure`.

- New permission `tickets.technician_requests` ("{module}: אישור בקשות טכנאים מספקים (במחלקות שבאחריותי)"), **sensitive**
  (`roles.json` `sensitive_permissions_not_implied`), **not delegable by default**, in the single-permission built-in role
  `tickets_technician_requests` that the owner / system administrator grants to any user through the normal roles / permissions UI
  (`POST /api/v1/access/bindings`; the "הרשאות" tab lists it). Among the built-in roles only `system_admin` holds it - it is NOT a
  default of department managers, `site_admin` or `tickets_manage`. Effective only when held at the INSTALLATION scope (a site / floor
  binding does not approve anything - departments are installation-wide configuration, like `tickets.configure` / `tickets.handlers`).
- Scope (`portal_more.approver_scope`): `tickets.configure` -> every request (unchanged); else the permission is required (the audited
  403 `{permission: "tickets.technician_requests"}` via `rbac.require`) and then `tickets.all_departments` -> every request; otherwise only
  requests of vendors attached to a department the holder MANAGES (`tickets.manage` + a manager membership). A vendor of no department
  (shared with all) is not in a department manager's scope (the CR-DEPT-MANAGER-HANDLERS reading). Out of scope: never listed; approve /
  reject answer the 404 `tech_request_not_found`, exactly like an unknown id.
- The approval writes through the directory's own validated path (`contacts._fields` / `_departments` + `insert_checked`, and
  `update_checked` for a replacement) once the approver's authority was checked - the same validation, keyed number, link revocation and
  `ticket.contact.create` / `.update` audit rows, naming the approver. The number in the list is full for `tickets.configure`,
  `tickets.external` or with "managers see full numbers"; otherwise the last four digits.
- `GET /tickets/meta` `can.technician_requests` decides whether the "מטפלים וספקים" card renders (no denied call for anyone else).
- Contracts and docs: `smplwise_vms/backend/smplwise/roles.json`, `contracts/examples/role-catalog.design.json`, `routers/access.py`
  `PERMISSION_LABELS`, the user guide's permission table (`docs/user-guide/he/46-tickets_HE.md`). No migration change (0112 unchanged).
- Tests (`test_tickets_vendor_portal_more.py`, section 6, negative first): the catalogue (sensitive, not delegable, labelled,
  system_admin only); department managers / a member WITHOUT the permission refused (403, audited, nothing decided, `can` false); a
  holder sees and decides only his departments' vendors (another department's and a no-department vendor: not listed, 404), the created
  row and its audit actor; another department's holder sees only his; an all-departments holder sees all; `tickets.configure` unchanged;
  grant / revoke through the bindings API take effect at once; a floor-scoped binding grants nothing. The pinned catalogue tests
  (`test_tickets_admin`, `test_tickets_s2`, `test_wiskey_door_path`) list the new role / permission.
