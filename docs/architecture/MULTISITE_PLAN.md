# Multi-site plan (board items r116 and r271)

Status: plan, revised after owner answers 367-379 (batch of 2026-10-24/25). Documentation only: no code, no migration, no runner.
Supersedes the sync, key and permission parts of the earlier private analysis `MULTISITE_COST_AND_PLAN_2026-10-24` (which lives in
the gitignored `private/planning/`); everything else in that analysis (reuse inventory, slice 1 scope, security table) still holds and
is restated here only where it changes.

Inputs: owner decisions 333-341 (mock-up approved, existing look kept, mixed device source, corner switcher, overview opening,
invoice sequence per installation, new building inherits "all buildings", live alerts per building, phone read-only, modes A and B
together) and answers 367-379 (section 1). Contradiction recorded, not resolved: `MASTER_SPEC_HE.md` lists multi-site enterprise as
outside the initial scope, so a change request (proposed `CR-MULTISITE116`) must be approved before slice 1 merges (answer 379 = yes,
open it).

---

## 0. תקציר בעברית (למנהל המוצר)

**מה נקבע (תשובות 367-379):**
1. המסך המאוחד יושב על אחד השרתים הקיימים באתרים (למשל השרת במתחם עם 2 הבניינים). בלי ענן ובלי שרת נוסף.
2. **העדכון בין האתרים הוא מיידי (ONLINE), לא דגימה כל 5 דקות.** ברגע שיש שינוי באתר, הוא נראה במערכת המרכזית. בונים את שני הכיוונים:
   השרת המאוחד מחזיק חיבור פתוח לכל אתר והאתר דוחף אליו שינויים, ובנוסף כל אתר יכול לשלוח בעצמו כשהשרת המאוחד נגיש לו.
   בדיקה תקופתית נשארת רק כרשת ביטחון (השוואה והשלמה אחרי נפילת חיבור), לא כשיטה העיקרית.
3. מהאתר יוצאים מספרים ומצבים, ושמות הבניינים יוצאים אם מנהל האתר מסמן זאת. הכול ניתן לשינוי בהגדרות.
4. לחיצה על בניין בשרת אחר פותחת את המערכת של אותו אתר בלשונית חדשה, עם כניסה נפרדת (ניתן לשינוי בהגדרות).
5. השרתים מדברים גם דרך הרשת המקומית (לא רק דרך הכתובת הציבורית). זה דורש הגדרה מפורשת של מנהל המערכת.
6. **הרשאה לכל בניין לחוד**, לפי תפקיד: אפשר להחליט על כל תפקיד אילו בניינים הוא רואה, ולהוסיף הרשאת "כל הבניינים".
   הרשאה חדשה לצפייה באתרים מרוחקים, למנהל מערכת כברירת מחדל וניתנת לכל תפקיד.
7. **החלפת מפתח אוטומטית**: מפתח הקישור בין השרתים מתחלף לבד, בלי התערבות אדם, בתהליך מסודר בין השרתים, בתדירות שנקבעת לפי
   ההמלצה (ברירת מחדל מוצעת: כל 30 יום, תוקף 90 יום, חפיפה של 24 שעות), וניתנת לשינוי בהגדרות.
8. סדר בנייה: קודם מסך סקירה של כל הבניינים ואתרים מחוברים, אחר כך בורר הבניינים בפינה; טלפון עם כמה שרתים בשלב מאוחר;
   מקור מכשירים נפרד לבניין רק כשלקוח צריך; פותחים מסמך שינוי רשמי.

**כלל תכנון:** כל סף וכל ברירת מחדל (תדירות החלפת מפתח, תוקף, זמן מרבי לפני סימון "לא מעודכן", גודל חיבור, כתובות מותרות,
שיטת מעבר, פתיחת בניין בלשונית חדשה, הצגת שמות) נשמרים בהגדרות, וכל אחד מהם עם הרשאה לפי תפקיד לשינוי. אין ערך קבוע בקוד.

**עלות:** המסלול הקצר (סקירה + אתרים מחוברים בזמן אמת + בדיקת אבטחה) כ-30-46 שעות סוכן; כל השלבים כ-135-215 שעות.
הזמן אמת מוסיף כ-10-15 שעות לעומת התוכנית הקודמת. רוב העבודה ניתנת לביצוע בלי ציוד אמיתי (בדיקות עם חיבורים מדומים);
רק אימות על שני שרתים אמיתיים והחלפת מפתח בפועל דורשים ציוד.

**שאלות פתוחות לבעלים:** סעיף 9 (ממוספרות, עם אפשרויות באותיות והמלצה).

---

## 1. Owner answers 367-379 mapped to the design

Answer index: option letters are those of the earlier question list; "x" = free text.

| # | Question | Answer | Effect |
|---|----------|--------|--------|
| 367 | Who holds the unified screen | (a) one of the site servers, e.g. the compound server | Any Arx installation can be a hub. No cloud, no extra server. |
| 368 | How data moves | free text: both directions, and it must be ONLINE without delay | Replaces "hub polls every N minutes". Push in both directions plus a persistent stream; polling only as reconciliation (section 4). |
| 369 | What leaves a site | (b) counts and states, plus building names if the site admin ticks it; editable in Settings | Share-names switch per link, default off; Settings editable with permission. |
| 370 | Click on a remote building | (a) opens that site in a new tab with its own login; editable in Settings | Setting `federation.open_mode` (new tab / disabled / later single sign-on). |
| 371 | Network path | (b) public address AND local network / private network, explicit setting | The partner rule that refuses private and CGNAT targets needs a separate, explicit, admin-only allowance for federation links (section 5). |
| 372 | Refresh of remote sites | free text: online, no delay, visible centrally the moment a change happens | Polling interval is no longer the product; freshness target is seconds. |
| 373 | Who sees remote sites | (a) and (b): a new permission, and the owner decides per role, adding an "all buildings" permission | Per-role, per-building matrix; `sites.federation.view` plus the existing installation-scope binding. |
| 374 | Live alerts from remote sites | (a) numbers first, live alerts at the next stage | With streaming in place the next stage is slice 3 (section 7). Open question 4 confirms. |
| 375 | Key lifetime | (a) plus free text: automatic key replacement with no human involvement, in an orderly server-to-server process, at an interval I recommend | Automatic rotation protocol (section 5). |
| 376 | Build order | (a) tonight: overview of all buildings and connected sites, then the corner switcher | Slice order below. |
| 377 | Phone with several servers | (a) later, after the unified screen works | Slice 8. |
| 378 | Separate device source per building | (a) only when a customer needs it, last | Slice 9. |
| 379 | Change request | (a) open a change request on the strength of the approval | CR before slice 1 merges. |

Prior decisions that still apply: 333 (no redesign), 334 (shared device source by default), 335 (corner switcher), 336 (opening
view is a setting plus a personal choice), 337 (invoice sequence per installation), 338 (new building inherits "all buildings"),
339 (live alerts from all buildings the user may see, changeable in Settings), 340 (permissions read-only on the phone), 341
(modes A and B must work together).

Letters are read from the answer file as option index 0 = first option (a). Where an answer carries free text, the free text wins.

---

## 2. Architecture (two modes, one directory)

- **Mode A, one server with several buildings.** The location tree (`sites -> buildings -> floors`) and RBAC scope chain already exist
  (`rbac.scope_chain`, installation/site/building/floor bindings). The building is the unit of filtering. A single-building
  installation sees no switcher and no overview.
- **Mode B, several servers joined in one view.** A hub (any installation) keeps a **link** per remote site. A link is a
  long-lived, authenticated, read-only channel. The hub never controls anything at a site; the partner NEVER list (door and device
  control) is unchanged.
- **One building directory** on the hub = local buildings (mode A) + remote buildings (from link state). Overview, switcher and search
  read only this directory.

```
 Site 2 (own server) --- change event ---> Hub (e.g. compound server)  <--- change event --- Site 3
        ^                                      |   directory = local + remote
        |   hub-initiated stream (default)      |
        +--------------------------------------+   periodic reconcile = safety net only
```

## 3. What changes, area by area

### 3.1 Data model
- New tables (never exported, never in backup, demo mode refuses): `federation_links` (id, label, transport, endpoint host,
  sealed credential, state, last_event_at, last_reconcile_at, last_error_class, share_names flag, key generation, created_by/at),
  `federation_state` (link_id, building ref, last good summary body validated, sequence number, received_at),
  `federation_keys` (link_id, generation, valid_from, valid_to, state: active / pending / retired; sealed material only).
- Building references from a remote site are opaque (HMAC of the building id with a per-link key), so two hubs cannot correlate ids.
- Local buildings need no change for slices 1-3. Gaps already known (recorders, cameras, rules, alarm tables, settings overrides,
  notification policy have no building) are slices 5-6 and are unchanged.
- Role-to-building permission: no new table; reuse role bindings at building scope plus an installation-scope "all buildings" binding.
  One new permission pair: `sites.federation.view` and `sites.federation.manage`.

### 3.2 Auth
- Per-link credential, created at the site by a site administrator (consent), scope `summary.read` plus `summary.stream`
  (read-only, building-restricted by the existing partner restriction mechanism). Stored as SHA-256 at the site, AES-256-GCM sealed
  at the hub.
- Automatic key replacement (section 5). Mandatory expiry stays; a human is only involved at first pairing and when automatic
  replacement fails past its retry budget.
- No single sign-on across installations (still not decided; remote building opens in a new tab with the site's own login).
- Per-building access on the hub: authorization evaluated by `rbac.authorize` at building scope for local buildings and by
  `sites.federation.view` plus the per-link building allowlist for remote ones. Explicit deny wins, as today.

### 3.3 Sync protocol
- Closed schema, exact key set at every level, fail closed on any deviation (same rule as `fleet_report.validate`), enforced on both
  ends.
- Message types: `snapshot` (full state of shared buildings, with sequence number), `delta` (one or more changed counters or states,
  with sequence number and site timestamp), `heartbeat`, `rotate` (section 5), `ack`.
- Ordering and loss: every message carries a monotonic sequence number per link. The receiver detects gaps and requests a
  `snapshot`. Deltas are idempotent (they carry the new value, not an increment).
- Freshness: each building card shows "live" while heartbeats are within the editable threshold, otherwise "last update N ago".
  The threshold is a setting (default suggested 15 seconds for heartbeat loss, editable).
- Never sent: person names, phone numbers, entity ids, camera ids, frames, event texts, alert titles (unless owner approves
  question 4 in section 9), addresses, IPs.

### 3.4 UI (existing look, no redesign - owner 333)
- Overview screen reuses the current home cards; remote cards get an "external site" mark and a live/last-update indicator.
- Corner switcher button next to search (335); hidden with one building and no links.
- Settings: card "Connected sites" (add, pause, remove, test, rotate now, show key generation and next replacement), card
  "Multi-site" (all thresholds below), permission matrix per role and building (mock-up screen 3) with an "effective access" preview.
- Opening view: Settings default plus personal choice (336). Phone remains read-only for permissions (340).
- Wording: no Home Assistant branding outside the infrastructure settings screens; no internal codes in operator text.

### 3.5 Settings (every default editable, per-role permission to change - design rule)
Each item below is a setting with its own permission (`settings.multisite.<name>.edit`), grantable to any role, default
system administrator. No threshold is hard-coded.

| Setting | Suggested default |
|---------|-------------------|
| Multi-site overview enabled / hub enabled | off |
| Transport per link (hub-initiated stream / site-initiated push / both) | both |
| Heartbeat interval; loss threshold before "not live" | 5 s; 15 s |
| Reconcile interval (safety net) | 15 min |
| Reconnect backoff (min / max) | 1 s / 60 s |
| Key replacement interval; token lifetime; overlap window | 30 days; 90 days; 24 h |
| Early warning before expiry if replacement keeps failing | 14 days |
| Allow private / LAN / CGNAT targets for federation links | off (admin-only switch) |
| Share building names from a site | off per link |
| Remote building click behaviour | new tab |
| Live alerts across sites (on/off, severity floor) | off, then per 339 |
| Max message size, max links per hub, rate cap per link | 64 KB, 20, 20 msg/s |
| Opening view (building or overview) | overview for multi-building users (336) |

### 3.6 Migrations
Numbers are provisional on the pilot branch and renumbered at integration (the migration renumbering rule applies).
- M1: `federation_links`, `federation_state`, `federation_keys`, plus partner scope rows for `summary.read` / `summary.stream`.
- M2: settings keys and permission rows (can be data seeds in M1 if the project convention allows).
- M3 (slice 5): `recorders.building_id` and alarm table building columns, backfilled to the first building.
- M4 (slice 6): settings scope per building, optional separate invoice sequence.
- M5 (slice 9, only on customer demand): `sources` table and `source_id` tagging.
All federation tables join the never-exported list; restore onto another box does not carry links or keys.

---

## 4. Immediate (online) sync - design

Goal: a change at a site is visible at the hub within seconds, not minutes.

1. **Primary, hub-initiated stream.** The hub opens one outbound HTTPS stream (server-sent events or WebSocket, to be fixed in the
   CR) to the site's partner listener. It needs no new inbound port at the hub and no new listener at the site beyond the existing
   default-off partner interface. The site writes a `delta` the moment a counter or state changes (hook on the same event sources
   the partner reads already) and a heartbeat otherwise.
2. **Secondary, site-initiated push** (owner: "both"). The site posts signed `delta` messages to a hub receive endpoint, used when the
   hub is reachable from the site (same compound LAN, or a public hub). Both transports feed the same sequence-numbered state, so the
   receiver deduplicates. A link can run either or both (setting).
3. **Safety net.** A slow reconcile (default 15 min) compares sequence numbers and requests a `snapshot` after any gap or reconnect.
4. **Honest limits.** "Online" means seconds when both servers and the network are up; a lost link shows "not live, last update N ago"
   rather than a stale number presented as current. Latency is measured and shown in the link health card.
5. **Load control.** Delta coalescing (at most one delta per building per second), per-link rate cap, backoff on reconnect.

Risk to the existing partner design: the partner interface is request/response today; adding a long-lived stream and an inbound hub
receive endpoint is new public surface and needs the Fable security review (slice 10) before it is switched on in production.

## 5. Automatic key replacement - design

Owner: the key must renew itself without human involvement, in an orderly server-to-server process, at an interval I recommend.

Recommendation: token lifetime 90 days, replacement every 30 days, overlap 24 hours, all editable.

Protocol (hub is the active party, because it already holds a credential at the site):
1. At 30 days (setting) the hub calls `rotate` over the authenticated link and presents a fresh public key / nonce.
2. The site issues generation N+1 (a new token, restricted exactly like generation N, never wider), returns it once, sealed to the
   hub's nonce, and marks generation N as `retired_at = now + overlap`.
3. The hub stores N+1 sealed, switches the stream to N+1, sends `ack`; the site retires N at the end of the overlap or immediately
   after `ack` (setting).
4. Failure handling: retry with backoff; if replacement has not succeeded by the early-warning threshold (default 14 days before
   expiry), raise a notice at both ends; only then does a human re-pair. A failed replacement never widens access and never leaves a
   link without a valid generation until natural expiry.
5. A revoked token at the site (manual kill) ends the link at once; the hub shows "revoked by site".
6. Everything is audited at both ends without token text. The key purpose is separate (own context string); it never reuses the
   evidence-signing key or the fleet key.

Network path (answer 371): the existing partner rule refuses private and CGNAT webhook targets. Federation links get their own
explicit allowance, a system-administrator switch (default off) plus an optional CIDR allowlist per link. The public address through
the Cloudflare tunnel remains the default and the recommendation.

## 6. Risks

| Risk | Mitigation |
|------|------------|
| New public surface (stream, receive endpoint) | Default off, closed schema both ends, size/rate caps, Fable security review before production use |
| Automatic rotation locks the link out | Overlap window, retry budget, early warning, manual re-pair fallback; tested with fakes for every failure step |
| Clock skew breaks expiry/ordering | Sequence numbers for ordering; expiry uses each side's own clock with the overlap as margin; skew shown in link health |
| Stale data shown as live | Heartbeat-based freshness, explicit "not live" state, no silent staleness |
| Cross-building leakage in mode A | Scope-leak test per router (user bound to building A asks for an id in B gets the same 404); the bulk of mode A cost |
| LAN allowance misused | Admin-only, default off, per-link CIDR, audited |
| Federation load grows with links | Coalescing, caps, a setting for max links |
| Scope creep into control actions | NEVER list unchanged; no write scope exists for federation |
| Spec contradiction (multi-site outside initial scope) | CR before slice 1 merges (answer 379) |

## 7. Staged slices

Sizes in agent-hours. "No equipment" = buildable and testable with fakes (httpx mock transports, in-process fake peer, seeded
two-building database); no lab host, no runner gate beyond targeted suites. Migration numbers provisional.

| # | Slice | Agent-hours | Without equipment? | Needs equipment for |
|---|-------|-------------|--------------------|---------------------|
| 0 | CR-MULTISITE116 change request, transport decision (SSE vs WebSocket), schema freeze | 2-4 | Yes | - |
| 1 | Site summary + closed schema + local buildings overview (mode A) + `federation_*` tables + hub link CRUD + sealed credential; both switches off | 10-14 | Yes | - |
| 2 | **Online sync**: hub-initiated stream, deltas, heartbeat, sequence/gap/snapshot, freshness states, reconcile; site-initiated push receiver | 12-20 | Yes (fake peer, fake clock) | Latency and reconnect behaviour on two real servers |
| 3 | Per-building permission matrix + `sites.federation.view/manage` + "all buildings" binding + effective-access preview; remote live alerts (counts first, alerts per 374/339) | 10-16 | Yes | - |
| 4 | **Automatic key replacement** (rotate protocol, overlap, retries, notices, audit) | 8-14 | Yes (fake clock, fake peer) | One real rotation across two servers, once |
| 5 | Corner switcher, opening-view setting + personal choice, remote-building open behaviour setting | 8-12 | Yes (UI) | Visual check on a real multi-building box |
| 6 | Building filter on modules that already carry a building (service requests, maintenance, notices, incidents, energy) with scope-leak tests | 12-18 | Yes | - |
| 7 | Recorders/cameras/alarms per building, backfill; notification per building, push payload building id, per-building settings overrides, optional separate invoice sequence | 28-42 | Yes | Backfill dry-run on a copy of a real database |
| 8 | Phone app with several servers (installation list, notices tagged by site) | 8-16 | Server side yes | Real phone build/test |
| 9 | Separate device source per building (only on customer demand) | 24-40 | Mostly | Second real device source |
| 10 | Fable security review of the federation surface (stream, receive endpoint, rotation, LAN allowance) and fixes | 4-8 | Yes | - |

Totals: shortest useful path = slices 0, 1, 2, 3, 4, 10 = about 46-76 agent-hours, or "overview with live remote sites" alone
(0, 1, 2, 10) = about 28-46. All slices = about 126-210. Without-equipment share is roughly 85-90% of the hours; equipment is
needed only for acceptance on two real servers, one real key replacement, the backfill dry-run, the phone build and a second device
source.

Default state of every slice is OFF behind its switch; slices 1-4 add tables, scopes and screens only and change no existing query.

## 8. Not in this plan (said up front)
Single sign-on across installations (no decision; estimated 40-80 hours if ever wanted), video or frame transport between sites,
any control action across sites, a cloud hub.

## 9. Open questions for the owner (numbered, lettered options, recommendation first)

1. How should "online" be bounded when a link drops?
   a. Show "not live, last update N ago" after a short, editable threshold and resync automatically on reconnect (recommended)
   b. Hide the remote card until the link returns
   c. Keep showing the last value without any mark
2. Which transport do we build first?
   a. Hub-initiated stream first, site-initiated push as the second step of the same slice (recommended: works when the hub sits behind
      the compound LAN and the sites are reachable through their tunnel)
   b. Site-initiated push first
   c. Both in parallel from day one
3. Automatic key replacement cadence (all values editable in Settings):
   a. Replace every 30 days, token valid 90 days, 24-hour overlap (recommended)
   b. Replace every 7 days, valid 30 days
   c. Replace every 90 days, valid 365 days
4. Live alerts from remote sites (earlier decision 339 said alerts per building the user may see):
   a. Counts and states live now; alert titles only if the site administrator ticks a share switch, in slice 3 (recommended)
   b. Counts only until a later stage
   c. Titles always
5. Local network access (answer 371):
   a. Allowed only through an explicit system-administrator switch, default off, with an optional per-link address list (recommended)
   b. Allowed by default for private addresses
   c. Public address only
6. Who may change multi-site thresholds in Settings (design rule: every threshold editable with per-role permission)?
   a. System administrator by default, grantable per role (recommended)
   b. Any role with the general settings permission
7. When a remote site loses its key and automatic replacement fails past the warning threshold:
   a. Notice to both administrators, a person re-pairs; the link stays read-only and never widens (recommended)
   b. The link stays valid until natural expiry with no extra notice
8. Remote building click (answer 370) when the user has no account at that site:
   a. Open the site anyway; the login screen explains (recommended)
   b. Hide the open button unless the hub administrator marks the site as "users have accounts"
9. Order of the first night:
   a. Slices 0, 1, 2 together as one live overview with fakes, then permissions and key replacement (recommended)
   b. Overview first with the 5-minute poll as a stopgap, live sync after
10. Change request:
   a. Open `CR-MULTISITE116` now, covering the live stream, the receive endpoint and automatic key replacement (recommended)
   b. Open it only for slice 1 and amend later

## 10. Verification status
Nothing in this document has been run or tested; it is a plan. Effort figures are estimates, not measurements. Code references come
from the earlier read of `origin/release/2160`; re-check them on the integration head before slice 1.
