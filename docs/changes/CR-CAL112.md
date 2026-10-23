# CR-CAL112 - calendar: an outgoing ICS feed first, optional Google / Microsoft write-through later

Status: PROPOSED (no code). Board row r112. Branch `pilot/CAL112-295` from `origin/main` @ `320e555` (v2.12.4). Module switch
`calendar.enabled`, **OFF by default**. Migration PROVISIONAL `0170_calendar.sql` (one file; the lead renumbers at integration).
Depends on, but does not block on, CR-MAINT215 (`maint_tasks`, branch `pilot/MAINT215-295`, not on main): the feed reads a
source registry, and the maintenance source plugs in when that module lands.

## 1. Goal and scope

(a) Maintenance windows and scheduled work appear in the managers' own calendars (Outlook, Google Calendar, Apple Calendar):
preventive maintenance, certificate / inspection due dates, supplier visits (the ticket `eta_at`), planned outages.
Read-only from the managers' side; Arx stays the source of truth.
(b) Room / space booking with conflict detection is a different product (it owns data, has write paths by guests, needs
check-in and cancellation). **It is not in this CR**; owner question 1 asks whether to open it. This CR keeps the event model
neutral so (b) could later publish its bookings through the same feed.

Out of scope: two-way sync (calendar edits changing Arx), invitations to external attendees, reading the user's calendar,
free/busy lookup, device writes.

## 2. What exists today (study result)

- No calendar or ICS code in the repository (`git grep` for `BEGIN:VCALENDAR`, `text/calendar`, `.ics`: none). The only
  "calendar" mentions are SLA time semantics in CR-038 (D7).
- Dated data that would feed it: ticket `eta_at` (CR-038, vendor / assignee ETA), the scheduler (`SCHEDULER_API.md`: house
  schedules - NOT exported: they are automation, not work), and CR-MAINT215: `maint_tasks.due_date` with `kind`
  certificate / preventive / round / vendor_document, local-date semantics in `time.zone`, injectable clock.
- Token precedent: CR-MAINT215 QR tags (`secrets.token_urlsafe(16)`, opaque, revocable) and the vendor portal links of the
  tickets module (opaque token, revocation, uniform 404).
- Public surface precedent: `services/tickets/public_prefix.py` - the public listener is served under ONE configurable
  single-segment prefix so one Cloudflare route `^/<prefix>(/.*)?$` reaches it; strict path validation, one uniform 404, a
  single allowlist. The Cloudflare tunnel is dashboard-managed (CR-008), routes are added by the owner by hand.
- OAuth in the product: only the Arx sign-in OAuth client of Home Assistant (`ha_user_auth.py`). There is NO outbound OAuth
  client for a third party, no token vault for third-party refresh tokens.
- Inbound constraint: the installation sits behind a customer Cloudflare tunnel; Google / Microsoft push callbacks (webhooks)
  need an inbound public route and a verified domain. Not needed if we only write outward (no push) or if clients poll a feed.

## 3. Design A - the ICS feed (slice 1, feed-only)

### 3.1 Shape
`GET /<cal_prefix>/<token>.ics` on the public listener (default prefix `cal`, same validation and reserved-word rules as the
support prefix; a new Cloudflare route `^/cal/` that the owner adds; documented in the release notes). Response:
`text/calendar; charset=utf-8`, RFC 5545, `PRODID:-//SmplWise Arx//Calendar//EN`, `X-WR-CALNAME`, one `VEVENT` per item.
Subscribable by URL in every calendar client ("subscribe", not "import"); clients poll.
Headers: `Cache-Control: private, max-age=300`, `ETag` / `If-None-Match` (304), `X-Robots-Tag: noindex`, no cookies, no CORS.

### 3.2 Token model (like the document and QR links)
Table `cal_feeds`: id, `owner_user_id` (nullable for a team feed), `team_key` (nullable), label, `token_hash` (SHA-256 of a
`secrets.token_urlsafe(24)` = 192 bits; the plaintext is shown ONCE at creation and never stored), `scope_json` (below),
`created_at`, `created_by`, `last_used_at` (coarse, minute granularity), `use_count`, `revoked_at`, `expires_at` (optional,
default none), `revision`. Verification is constant-time on the hash; unknown, revoked, expired and module-off are the SAME
404 body and timing class. Rotation = create new + revoke old (the UI offers "regenerate"). A revoked link stops at the next
poll; cached copies in a client age out (documented: revocation is not instant for the client cache).
Rate limit per IP and per token (e.g. 30 / min), with 429 never distinguishing token validity.

### 3.3 Scopes (what a feed contains)
A feed is a saved filter, evaluated by the server at request time against the RBAC of its **owner at request time** (a user
who lost a place loses it in the feed too; a deactivated user's feeds return 404):
sources (`maintenance_due`, `maintenance_visit`, `ticket_eta`, `planned_outage`), places (site / building / floor ids), kinds,
and a horizon (default: from 7 days back to 180 days ahead, maximum 400). A TEAM feed (for a shared calendar, e.g. the
managers' common one) is created by a `calendar.manage` holder, is bound to explicit places instead of a user, and is
limited to the union a manager chose; it never exceeds what the creator may see at creation time (re-checked on each use
against the creator's current rights; creator removal suspends the feed until a manager adopts it).

### 3.4 Content minimisation (no personal data)
Event fields: `SUMMARY` = category + title (e.g. "Elevator B - annual inspection due"), `DTSTART` (all-day `VALUE=DATE` for
due dates; timed for visits and outages), `LOCATION` = place name (building / floor), `DESCRIPTION` = one line of kind and
state + a deep link path `<remote address>/arx/#/...` (sign-in required, so no data is reachable through it), `UID` =
`<source>-<opaque id>@<install key>` (stable across updates), `SEQUENCE`, `DTSTAMP`, `LAST-MODIFIED`, `CATEGORIES`,
`STATUS` (`CONFIRMED` / `CANCELLED` for deleted so clients drop it), `TRANSP:TRANSPARENT` for due dates (does not mark the
manager busy), optional `VALARM` (the user's lead in minutes, default none: the notification module remains the reminder owner).
NEVER in the feed: requester or resident names, phone numbers, unit numbers, free-text ticket notes, supplier contact
details, attachments, door / security / access events, camera names, anything from the security panel. Supplier visits
carry the supplier's company label only if the owner turns that on per feed (default off) - question 4. Text is escaped and
folded per RFC 5545 (CRLF, 75 octets); control characters stripped; a hostile title cannot inject a property.

### 3.5 Update frequency
Clients poll on their own schedule (Outlook / Google: hours; Apple: 15 min - 1 week). The feed advertises
`REFRESH-INTERVAL;VALUE=DURATION:PT1H` and `X-PUBLISHED-TTL:PT1H` (hints only). The server builds from the database per
request with a short in-memory cache (60 s) and an ETag; it never pushes. Honest limit stated to the owner: Google refreshes
subscribed ICS about every 8-24 h, so a change may take a day to appear; only write-through (design B) is faster.

### 3.6 Audit and abuse
Feed creation, regeneration, revocation, scope change are audited (who, when, feed id; never the token). Each use updates
`last_used_at`; an unusual burst (token seen from > N addresses in an hour) raises a notification to the feed owner,
default on. The URL is a bearer secret: the UI states "anyone with this link can see these events"; never logged in access
logs (the path is redacted to `/cal/<redacted>.ics` in the listener log and in error reports).

## 4. Design B - write-through to Google / Microsoft (optional, slice 3+)

Arx creates / updates / deletes events in a calendar the manager connected, so changes land in minutes.

| Aspect | Google Calendar | Microsoft 365 / Outlook |
|---|---|---|
| Registration | Google Cloud project, OAuth consent screen, scope `calendar.events` (a SENSITIVE scope) | Entra (Azure AD) app registration, delegated `Calendars.ReadWrite` |
| Verification burden | Production consent screen with a sensitive scope needs Google verification (privacy policy URL, verified domain, justification, weeks); unverified = "testing" mode capped at 100 test users and refresh tokens that expire after 7 days | Publisher verification recommended; multi-tenant app; no review for delegated user consent |
| Consent | The user consents once | The user consents, but many tenants forbid user consent: a tenant ADMIN must grant consent (admin-consent URL); common in companies |
| Redirect URI | A fixed HTTPS redirect URI per app; every installation has a different public hostname, so a **central relay** (one hosted redirect page) is needed, or each customer registers their own app (heavy) | Same problem; registered redirect URIs must be exact |
| Tokens | Refresh token (long lived), access token 1 h | Refresh token 90 days sliding, access ~1 h; conditional access may force re-auth |
| Revoke | User revokes in their Google account; we must handle `invalid_grant` | Tenant admin / user revokes; handle `invalid_grant`, `interaction_required` |
| Callbacks | Push channels need a public HTTPS endpoint (we avoid: write-only, no push) | Graph subscriptions need a public endpoint (avoided) |

Common burdens: Arx needs a **token vault** (encrypt refresh tokens at rest with a key outside the database, per-connection
rows, rotation on refresh, deletion on disconnect, never in clear in backups, never logged), a per-calendar
**sync map** (`cal_sync_map`: item uid -> remote event id, hash of last pushed content, state), a **dedicated calendar**
created by Arx ("SmplWise Arx") so deleting events never touches personal items (we never write to the user's primary
calendar), retry with backoff, rate-limit handling (Google 429 / Graph 429 Retry-After), idempotent upsert keyed by UID, and
a reconcile job (remote edits are overwritten; remote deletes are re-created once, then the connection is flagged).
An outage or a revoked token must degrade to the feed and a visible "connection broken" state; it must never block the
ticket or maintenance flow (events are enqueued in an outbox, delivery is best-effort).
Per-customer app vs a central relay: the central relay means the vendor (SmplWise) operates an OAuth endpoint that sees
tokens in transit - a new trust and privacy role (processor) and a legal item; per-customer registration keeps the vendor
out but is too heavy for a non-technical building manager. This is the main reason the recommendation is feed-only first.

A cheaper middle option that needs no OAuth: email invitations (iMIP) to the manager's own mailbox give "add to calendar"
per event with no token vault, but need a mail sender and create noise (question 3).

## 5. Privacy

Minimisation per 3.4; the feed carries operational data only; no personal data of residents or tenants. The feed URL is a
bearer secret (192-bit, stored hashed, revocable). Third-party calendars become copies we cannot recall once synced: the
owner is told so in the enable screen; a revoked feed stops updates but cached events remain in the client until it
refreshes. For design B the manager's personal Google / Microsoft account is involved: only their own consent, only the
dedicated calendar, only the minimised content; a disclosure line (processing by Google / Microsoft) is shown at connect.
Retention: `cal_feeds` rows kept after revocation for audit (tokens hashed anyway); the sync map is deleted at disconnect.

## 6. Permissions and defaults

- `calendar.use` (own feeds: create, list, regenerate, revoke) - default site_admin, system_admin; NOT operators,
  technicians or residents.
- `calendar.manage` (team feeds, list all feeds, revoke anyone's, install defaults, connect an external calendar in
  slice 3) - sensitive, system_admin default.
- Feed content is always filtered by the owner's current place scope (RBAC) at request time.
- Module OFF by default: the public route answers the uniform 404, nav item hidden, no worker, no table reads. Turning it off
  keeps rows and returns 404 on all feeds; turning it back on restores them.
- The public route is also gated by `calendar.public_enabled` (second switch, off): the owner can use the feed on the LAN
  before opening the Cloudflare route.
- No mutating public endpoint exists: the feed is GET / HEAD only.

## 7. Migration PROVISIONAL `0170_calendar.sql` (one file, additive)

Tables: `cal_feeds` (3.2), `cal_settings` (single row: enabled, public_enabled, prefix, defaults, horizon caps). Events are
NOT stored: they are computed live from the sources, so nothing to migrate or go stale. Slice 3 would add `cal_connections`
and `cal_sync_map` in a later file only if it ships; this CR reserves 0170 only. Indexes: unique `token_hash`,
`(owner_user_id, revoked_at)`. Rollback: additive, no existing table altered; down = drop with the module off.
Backups: `cal_feeds` included (hashes only, no plaintext); connections never in unencrypted backups.

## 8. Tests plan (all with fakes, no network)

- Token: 192-bit generation, plaintext never persisted or logged, constant-time hash compare; revoked / expired /
  module-off / deactivated-owner / unknown all give a byte-identical 404 in the same timing class.
- Scope: owner without the place sees no event of it; place removed -> gone next request; team feed re-check on the
  creator's rights; horizon clamp.
- RFC 5545 conformance: golden `.ics` files parsed back with a reference parser; folding at 75 octets with Hebrew and emoji
  (multi-byte not split), escaping of `,` `;` `\` and newline, CRLF, stable UID, SEQUENCE increments on change, `CANCELLED`
  on delete, all-day vs timed, DST day in Asia/Jerusalem, 29 Feb, month clamp.
- Minimisation: a sentinel test seeds personal data (names, phones, unit, notes, attachment names) in every source and
  asserts none appears in any feed byte; the deep link carries no token.
- Injection: hostile titles (`\r\nATTENDEE:`), very long text, control characters.
- Public listener: only GET / HEAD, path validation (`%2e`, double slashes, case), rate limit, 304 on ETag, log redaction
  proves the token never reaches the access log or the error report.
- Permissions: matrix of `calendar.use` / `calendar.manage` x role x place; module off hides routes and nav.
- Slice 3 fakes: a fake OAuth provider (authorize / token / revoke), fake Google Calendar and Graph servers; token vault
  round trip and a no-plaintext scan of DB and backup; refresh success / `invalid_grant` / 429 backoff; idempotent upsert;
  dedicated-calendar-only writes (proof the primary calendar id is never used); the outbox never blocks the ticket flow
  when the provider is down.
- Real Google / Microsoft accounts are NOT used by agents (credentials and consent are owner actions).

## 9. Slices

1. **Feed-only (build target of this CR)**: `0170`, token model, feed builder with sources `ticket_eta` and (when MAINT215
   is merged) `maintenance_due`, personal feeds, public route + prefix, settings UI (create / copy once / regenerate /
   revoke), the non-OAuth tests above. About 4-5 agent days.
2. Team feeds, `maintenance_visit` / `planned_outage` sources, optional `VALARM`, supplier-label toggle, burst notification,
   he / en strings and a user-guide page.
3. (Only after an owner decision) Google write-through, then Microsoft: relay decision, token vault, sync map, dedicated
   calendar, outbox, reconcile. About 10-14 agent days each plus external verification time (weeks).
4. (Separate CR, only if the owner opens it) room / space booking.

## 10. Open owner questions (recommendation first)

1. Room / space booking (b): in scope now?
   a. no - a separate CR later, feed first (recommended)  b. yes, open its own CR now  c. never
2. Integration level for the first release:
   a. ICS feed only (recommended: no OAuth, no vendor-held tokens, works with Google, Outlook and Apple)
   b. feed plus Google write-through  c. feed plus Microsoft write-through  d. all three
3. If faster-than-hours delivery is wanted without OAuth:
   a. accept the polling delay (recommended)  b. email "add to calendar" invitations as a middle option  c. go to write-through
4. Show the supplier company name in visit events?
   a. no, off by default and a per-feed opt-in (recommended)  b. always  c. never
5. Public exposure of the feed:
   a. a new Cloudflare route `/cal` added by the owner, with `calendar.public_enabled` off until then (recommended)
   b. reuse the existing support route  c. LAN only
6. Feed lifetime:
   a. no expiry, manual revoke, burst alert (recommended)  b. auto-expire after 90 days with a renewal reminder
7. Who may create feeds:
   a. site_admin and system_admin for themselves, team feeds system_admin only (recommended)  b. any user with a place
   c. system_admin only
8. If write-through is chosen later, how do OAuth redirects work?
   a. a central relay run by SmplWise with a privacy and processing notice (recommended only if write-through is wanted)
   b. per-customer app registration  c. do not build
9. Planned outages as a source: they are not recorded anywhere yet.
   a. add a small "planned window" entry to the maintenance module in slice 2 (recommended)  b. skip the source
