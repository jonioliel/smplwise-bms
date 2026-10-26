# Multi-site plan (board items r116 and r271)

Status: plan, revised after owner answers 367-379 (batch of 2026-10-24/25) and the ten decisions of 2026-10-26 (section 9, all decided).
Change request opened: `CR-041` (`docs/changes/CR-041-MULTISITE-LIVE-LINK.md`), status PROPOSED until the owner approves it.
Documentation only: no code, no migration, no runner.
Supersedes the sync, key and permission parts of the earlier private analysis `MULTISITE_COST_AND_PLAN_2026-10-24` (which lives in
the gitignored `private/planning/`); everything else in that analysis (reuse inventory, slice 1 scope, security table) still holds and
is restated here only where it changes.

Inputs: owner decisions 333-341 (mock-up approved, existing look kept, mixed device source, corner switcher, overview opening,
invoice sequence per installation, new building inherits "all buildings", live alerts per building, phone read-only, modes A and B
together) and answers 367-379 (section 1). Contradiction recorded, not resolved: `MASTER_SPEC_HE.md` lists multi-site enterprise as
outside the initial scope, so the change request `CR-041` (opened 2026-10-26 on decision 10, one CR for the live link, the receive
endpoint and automatic key rotation) must be approved before slice 1 merges.

---

## 0. תקציר בעברית (למנהל המוצר)

**מה נקבע (תשובות 367-379, והחלטות 26.10 בסעיף 9):**
1. המסך המאוחד יושב על אחד השרתים הקיימים באתרים (למשל השרת במתחם עם 2 הבניינים). בלי ענן ובלי שרת נוסף.
2. **העדכון בין האתרים הוא מיידי (ONLINE), לא דגימה כל 5 דקות.** ברגע שיש שינוי באתר, הוא נראה במערכת המרכזית. בונים את שני הכיוונים:
   **הוחלט ב-26.10: שני אופני החיבור נבנים במקביל מהיום הראשון** (השרת המאוחד מחזיק חיבור פתוח לכל אתר, ובנוסף כל אתר דוחף בעצמו
   כשהשרת המאוחד נגיש לו). זו סטייה מההמלצה הקודמת (להתחיל באחד); התוכנית חותכת מחדש לפי זה.
   בדיקה תקופתית נשארת רק כרשת ביטחון (השוואה והשלמה אחרי נפילת חיבור), לא כשיטה העיקרית.
   כשהחיבור נופל: "לא מעודכן, עדכון אחרון לפני N" אחרי סף קצר הניתן לשינוי, וסנכרון אוטומטי בחזרה.
3. מהאתר יוצאים מספרים ומצבים, ושמות הבניינים יוצאים אם מנהל האתר מסמן זאת. הכול ניתן לשינוי בהגדרות.
4. לחיצה על בניין בשרת אחר פותחת את המערכת של אותו אתר בלשונית חדשה, עם כניסה נפרדת (ניתן לשינוי בהגדרות).
5. השרתים מדברים גם דרך הרשת המקומית (לא רק דרך הכתובת הציבורית). זה דורש הגדרה מפורשת של מנהל המערכת.
6. **הרשאה לכל בניין לחוד**, לפי תפקיד: אפשר להחליט על כל תפקיד אילו בניינים הוא רואה, ולהוסיף הרשאת "כל הבניינים".
   הרשאה חדשה לצפייה באתרים מרוחקים, למנהל מערכת כברירת מחדל וניתנת לכל תפקיד.
7. **החלפת מפתח אוטומטית**: מפתח הקישור בין השרתים מתחלף לבד, בלי התערבות אדם, בתהליך מסודר בין השרתים, בתדירות שנקבעת לפי
   ההמלצה, **והוחלט: כל 30 יום, תוקף 90 יום, חפיפה של 24 שעות, הכול ניתן לשינוי בהגדרות.** אם ההחלפה האוטומטית נכשלת שוב ושוב,
   מנהלי שני האתרים מקבלים התראה (ברירת מחדל 14 יום לפני פקיעה), אדם מצמיד מחדש, והקישור נשאר לקריאה בלבד.
8. סדר בנייה (הוחלט): שלב אחד של מסך סקירה חי (מבנה, קישור, עדכון בזמן אמת), ורק אחריו הרשאות והחלפת מפתח; אחר כך בורר הבניינים
   בפינה; טלפון עם כמה שרתים בשלב מאוחר; מקור מכשירים נפרד לבניין רק כשלקוח צריך.
9. התראות חיות מאתרים מרוחקים: מספרים ומצבים כעת; כותרות התראה רק אם מנהל האתר מסמן אישור שיתוף (בשלב ההרשאות).
10. קישור דרך רשת מקומית/כתובת פרטית: רק במתג מפורש של מנהל מערכת, כבוי כברירת מחדל, עם רשימת כתובות מותרות לכל קישור (לא חובה).
11. שינוי הספים: מנהל מערכת כברירת מחדל, ניתן להענקה לכל תפקיד. לחיצה על בניין באתר שאין בו חשבון: נפתח בכל זאת, ומסך הכניסה של האתר מסביר.
12. נפתח מסמך שינוי רשמי אחד: `CR-041` (קישור חי, נקודת הקבלה, החלפת מפתח אוטומטית).

**כלל תכנון:** כל סף וכל ברירת מחדל (תדירות החלפת מפתח, תוקף, זמן מרבי לפני סימון "לא מעודכן", גודל חיבור, כתובות מותרות,
שיטת מעבר, פתיחת בניין בלשונית חדשה, הצגת שמות) נשמרים בהגדרות, וכל אחד מהם עם הרשאה לפי תפקיד לשינוי. אין ערך קבוע בקוד.

**עלות (טווחים, שעות סוכן, אחרי חיתוך מחדש):** סקירה חיה עם שני אופני החיבור + בדיקת אבטחה כ-37-57 שעות; המסלול המלא עד החלפת מפתח
והרשאות כ-58-92; כל השלבים כ-138-220. שני האופנים יחד מהיום הראשון מוסיפים כ-4-6 שעות (בדיקות התכנסות ומניעת כפילות) לעומת
ההמלצה הקודמת. רוב העבודה ניתנת לביצוע בלי ציוד אמיתי (חיבורים מדומים); רק אימות על שני שרתים אמיתיים והחלפת מפתח בפועל דורשים ציוד.

**שאלות פתוחות לבעלים:** אין. כל עשר השאלות נענו ב-26.10 (סעיף 9).

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
| 374 | Live alerts from remote sites | (a) numbers first, live alerts at the next stage | The next stage is the permissions stage (slice 2, section 7). Decision 4 (section 9) fixes the rule: counts and states first, titles only with the site admin's share approval. |
| 375 | Key lifetime | (a) plus free text: automatic key replacement with no human involvement, in an orderly server-to-server process, at an interval I recommend | Automatic rotation protocol (section 5). |
| 376 | Build order | (a) tonight: overview of all buildings and connected sites, then the corner switcher | Slice order below (re-cut after decision 9 of 2026-10-26). |
| 377 | Phone with several servers | (a) later, after the unified screen works | Slice 7. |
| 378 | Separate device source per building | (a) only when a customer needs it, last | Slice 8. |
| 379 | Change request | (a) open a change request on the strength of the approval | Opened as `CR-041` (decision 10). Approval needed before slice 1 merges. |

Decisions of 2026-10-26 (ten questions, answered): see section 9. Where they differ from the 2026-10-25 recommendations (decision 2:
both connection modes from day one) the plan below follows the decision.

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
  notification policy have no building) are slice 9 (modules that already carry a building: slice 6) and are unchanged.
- Role-to-building permission: no new table; reuse role bindings at building scope plus an installation-scope "all buildings" binding.
  One new permission pair: `sites.federation.view` and `sites.federation.manage`.

### 3.2 Auth
- Per-link credential, created at the site by a site administrator (consent), scope `summary.read` plus `summary.stream`
  (read-only, building-restricted by the existing partner restriction mechanism). Stored as SHA-256 at the site, AES-256-GCM sealed
  at the hub.
- Automatic key replacement (section 5). Mandatory expiry stays; a human is only involved at first pairing and when automatic
  replacement fails past its warning threshold (notice to both site administrators; the link stays read-only).
- A link that runs both transports holds two credentials, one per direction (hub-to-site stream, site-to-hub push); each is rotated
  by the side that holds it (section 5).
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
- Freshness (decision 1): each building card shows "live" while heartbeats are within the editable threshold, otherwise
  "not updated, last update N ago", and the link resyncs automatically on reconnect (snapshot on the first message after a gap).
  The threshold is a setting (default suggested 15 seconds for heartbeat loss, editable).
- Never sent: person names, phone numbers, entity ids, camera ids, frames, event texts, addresses, IPs. Alert titles are sent only
  when the site administrator ticks a per-link share approval (decision 4; the tick ships in the permissions stage, slice 2);
  until then only counts and states leave the site.

### 3.4 UI (existing look, no redesign - owner 333)
- Clicking a remote building opens the site in a new tab even when the user has no account there; the site's login screen explains (decision 8).
- Overview screen reuses the current home cards; remote cards get an "external site" mark and a live/last-update indicator.
- Corner switcher button next to search (335); hidden with one building and no links.
- Settings: card "Connected sites" (add, pause, remove, test, rotate now, show key generation and next replacement), card
  "Multi-site" (all thresholds below), permission matrix per role and building (mock-up screen 3) with an "effective access" preview.
- Opening view: Settings default plus personal choice (336). Phone remains read-only for permissions (340).
- Wording: no Home Assistant branding outside the infrastructure settings screens; no internal codes in operator text.

### 3.5 Settings (every default editable, per-role permission to change - design rule)
Each item below is a setting with its own permission (`settings.multisite.<name>.edit`), grantable to any role, default
system administrator (decision 6). No threshold is hard-coded.

| Setting | Suggested default |
|---------|-------------------|
| Multi-site overview enabled / hub enabled | off |
| Transport per link (hub-initiated stream / site-initiated push / both) | both (decision 2: both are built from day one) |
| Heartbeat interval; loss threshold before "not updated, last update N ago" | 5 s; 15 s |
| Reconcile interval (safety net) | 15 min |
| Reconnect backoff (min / max) | 1 s / 60 s |
| Key replacement interval; token lifetime; overlap window | 30 days; 90 days; 24 h |
| Early warning before expiry if replacement keeps failing (notice to both site administrators) | 14 days |
| Allow private / LAN / CGNAT targets for federation links (system admin only; optional per-link address list) | off |
| Share building names from a site | off per link |
| Share alert titles from a site (site administrator approval, per link) | off per link |
| Remote building click behaviour | new tab, opens even without an account at that site |
| Live alerts across sites (on/off, severity floor) | off, then per 339 |
| Max message size, max links per hub, rate cap per link | 64 KB, 20, 20 msg/s |
| Opening view (building or overview) | overview for multi-building users (336) |

### 3.6 Migrations
Numbers are provisional on the pilot branch and renumbered at integration (the migration renumbering rule applies).
- M1: `federation_links`, `federation_state`, `federation_keys`, plus partner scope rows for `summary.read` / `summary.stream`.
- M2: settings keys and permission rows (can be data seeds in M1 if the project convention allows).
- M3 (slice 9): `recorders.building_id` and alarm table building columns, backfilled to the first building.
- M4 (slice 9): settings scope per building, optional separate invoice sequence.
- M5 (slice 8, only on customer demand): `sources` table and `source_id` tagging.
All federation tables join the never-exported list; restore onto another box does not carry links or keys.

---

## 4. Immediate (online) sync - design

Goal: a change at a site is visible at the hub within seconds, not minutes.

1. **Primary, hub-initiated stream.** The hub opens one outbound HTTPS stream (server-sent events or WebSocket, to be fixed in the
   CR) to the site's partner listener. It needs no new inbound port at the hub and no new listener at the site beyond the existing
   default-off partner interface. The site writes a `delta` the moment a counter or state changes (hook on the same event sources
   the partner reads already) and a heartbeat otherwise.
2. **Site-initiated push, built in the same stage** (owner decision 2, 2026-10-26: both modes in parallel from day one). The site posts signed `delta` messages to a hub receive endpoint, used when the
   hub is reachable from the site (same compound LAN, or a public hub). Both transports feed the same sequence-numbered state, so the
   receiver deduplicates. A link can run either or both (setting, default both). A push-only link is a first-class case (a hub that
the site can reach but the hub cannot reach the site), which matters for key rotation (section 5).
3. **Safety net.** A slow reconcile (default 15 min) compares sequence numbers and requests a `snapshot` after any gap or reconnect;
   on reconnect the link resyncs by itself (decision 1).
4. **Honest limits.** "Online" means seconds when both servers and the network are up; a lost link shows "not updated, last update N ago"
   rather than a stale number presented as current. Latency is measured and shown in the link health card.
5. **Load control.** Delta coalescing (at most one delta per building per second), per-link rate cap, backoff on reconnect.

Risk to the existing partner design: the partner interface is request/response today; adding a long-lived stream and an inbound hub
receive endpoint is new public surface and needs the Fable security review (slice 4) before it is switched on in production.

## 5. Automatic key replacement - design

Owner: the key must renew itself without human involvement, in an orderly server-to-server process, at an interval I recommend.

Decided (2026-10-26, decision 3): replacement every 30 days, token lifetime 90 days, overlap 24 hours, all three editable in
Settings.

Which side acts: with both transports from day one a link has up to two credentials, one per direction. The credential the hub
holds at the site (stream mode) is replaced by the hub; the credential the site holds at the hub (push mode) is replaced by the site,
through the channel that direction already uses. A push-only link therefore rotates without the hub ever calling the site.
The protocol below is written for the hub-held credential; the site-held one is the mirror image.

Protocol (the holder is the active party, because it already holds a credential at the peer):
1. At 30 days (setting) the hub calls `rotate` over the authenticated link and presents a fresh public key / nonce.
2. The site issues generation N+1 (a new token, restricted exactly like generation N, never wider), returns it once, sealed to the
   hub's nonce, and marks generation N as `retired_at = now + overlap`.
3. The hub stores N+1 sealed, switches the stream to N+1, sends `ack`; the site retires N at the end of the overlap or immediately
   after `ack` (setting).
4. Failure handling (decision 7): retry with backoff; if replacement has not succeeded by the early-warning threshold (default 14
   days before expiry), notify the administrators of both sites; only then does a person re-pair. A failed replacement never widens
   access, never extends a token and never leaves a link without a valid generation until natural expiry; the link stays read-only
   throughout.
5. A revoked token at the site (manual kill) ends the link at once; the hub shows "revoked by site".
6. Everything is audited at both ends without token text. The key purpose is separate (own context string); it never reuses the
   evidence-signing key or the fleet key.

Network path (answer 371, decision 5): the existing partner rule refuses private and CGNAT webhook targets. Federation links get
their own explicit allowance, a system-administrator switch (default off) plus an optional allowed-address list per link. The public address through
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
| Spec contradiction (multi-site outside initial scope) | `CR-041` approved before slice 1 merges (answer 379, decision 10) |
| Two transports at once double the test matrix and can disagree | One sequence-numbered state per link, idempotent deltas, convergence tests with injected loss, reordering and duplicate delivery on both paths |

## 7. Staged slices (re-cut 2026-10-26)

Re-cut after decisions 2 and 9: both connection modes are built in parallel from day one, and the first stage is ONE live overview
(structure, link, real-time update); permissions and key rotation follow as separate stages. Old slices 1 and 2 are merged into the
live-overview stage (slice 1, four sub-slices 1a-1d that can run as parallel agents on one integration branch).

Sizes are ranges in agent-hours (estimates, not measurements). "No equipment" = buildable and testable with fakes (httpx mock
transports, in-process fake peer, fake clock, seeded two-building database); no lab host, no runner gate beyond targeted suites.
Migration numbers provisional. Every slice ships OFF behind its switch.

| # | Slice | Agent-hours | Without equipment? | Needs equipment for |
|---|-------|-------------|--------------------|---------------------|
| 0 | `CR-041` approval, transport decision (SSE vs WebSocket), schema freeze | 2-4 | Yes | - |
| 1a | Live overview, part 1: site summary + closed schema, `federation_*` tables, hub link CRUD, sealed credential, local-buildings overview (mode A), Settings card skeleton | 10-14 | Yes | - |
| 1b | Live overview, part 2: hub-initiated stream, deltas, heartbeat, sequence/gap/snapshot, freshness ("not updated, last update N ago"), auto resync | 8-12 | Yes (fake peer, fake clock) | Latency and reconnect on two real servers |
| 1c | Live overview, part 3: site-initiated push and the receive endpoint (signed deltas, size/rate caps, closed schema both ends) | 6-9 | Yes | - |
| 1d | Live overview, part 4: dual-transport convergence and de-duplication, reconcile safety net, LAN-allowance switch (off, per-link list), all thresholds as editable settings with per-role permission, link health card | 6-9 | Yes | - |
| 2 | Permissions stage: per-building matrix, `sites.federation.view/manage`, "all buildings" binding, effective-access preview, remote live alerts (counts and states; titles only with the site admin's share approval, decisions 4 and 374/339) | 12-19 | Yes | - |
| 3 | **Automatic key rotation**: both credential directions, overlap, retries, early warning to both site administrators at 14 days, read-only on failure, audit | 9-16 | Yes (fake clock, fake peer) | One real rotation across two servers, once |
| 4 | Fable security review of the whole federation surface (stream, receive endpoint, rotation, LAN allowance, share approvals) and fixes | 5-9 | Yes | - |
| 5 | Corner switcher, opening-view setting + personal choice, remote-building open behaviour | 8-12 | Yes (UI) | Visual check on a real multi-building box |
| 6 | Building filter on modules that already carry a building (service requests, maintenance, notices, incidents, energy) with scope-leak tests | 12-18 | Yes | - |
| 7 | Phone app with several servers (installation list, notices tagged by site) | 8-16 | Server side yes | Real phone build/test |
| 8 | Separate device source per building (only on customer demand) | 24-40 | Mostly | Second real device source |
| 9 | Recorders/cameras/alarms per building, backfill; notification per building, push payload building id, per-building settings overrides, optional separate invoice sequence | 28-42 | Yes | Backfill dry-run on a copy of a real database |

Totals (ranges): live overview alone with both transports and the security review = slices 0, 1a-1d, 4 = about 37-57. Full
federation path (0, 1a-1d, 2, 3, 4) = about 58-92. All slices = about 138-220. Against the 2026-10-25 version of this plan (28-46,
46-76, 126-210) the live overview costs about 4-6 more hours because both transports are built and tested together, and the
permissions stage costs 2-3 more for the share approval; the rest is unchanged. Without-equipment share stays roughly 85-90% of the
hours.

Order and gating: stage 1 (0, 1a-1d) first and alone; stage 2 (slice 2 permissions, slice 3 key rotation) next; the security review
(slice 4) must pass before any federation switch is turned on outside a lab. Slices 5-9 follow the owner's earlier order.

Default state of every slice is OFF behind its switch; slices 1-3 add tables, scopes and screens only and change no existing query.

## 8. Not in this plan (said up front)
Single sign-on across installations (no decision; estimated 40-80 hours if ever wanted), video or frame transport between sites,
any control action across sites, a cloud hub.

## 9. Owner decisions of 2026-10-26 (all ten decided; no open questions)

Source: owner answer file of 2026-10-26 to the ten questions. Letters refer to the earlier question list.

| # | Question | Decision | Where it lands |
|---|----------|----------|----------------|
| 1 | Link down | Show "not updated, last update N ago" after a short, editable threshold; resync automatically on reconnect (a) | 3.3, 4, 3.5 |
| 2 | Connection mode | **Both in parallel from day one: hub-initiated stream AND site-initiated push (c).** Differs from the recommendation (a: stream first, push as the second step) | 4, 7 (slices 1b/1c/1d), CR-041 |
| 3 | Key rotation | Replace every 30 days, token valid 90 days, 24 h overlap; all editable in Settings (a) | 5, 3.5 |
| 4 | Live alerts from remote sites | Counts and states now; alert titles only if the site administrator ticks a share approval, in the permissions stage (a) | 3.3, 7 (slice 2) |
| 5 | LAN / private-address links | Only through an explicit system-administrator switch, default off, optional per-link allowed-address list (a) | 5, 3.5, 7 (1d) |
| 6 | Who changes the thresholds | System administrator by default, grantable per role (a) | 3.5 |
| 7 | Rotation keeps failing | Notify the administrators of both sites at the warning threshold (default 14 days before expiry); a person re-pairs; link stays read-only (a) | 5 |
| 8 | Click on a building without an account there | Open anyway; the site's login screen explains (a) | 3.4 |
| 9 | Build order | One live overview in one stage (structure, link, real-time), then permissions and key rotation (a, re-cut around decision 2) | 7 |
| 10 | Change request | Open ONE now, covering the live link, the site receive endpoint and automatic key rotation (a) | `CR-041` |

Notes recorded with the decisions:
- Decision 2 and the key-rotation design interact: a push-only link has no hub-to-site channel, so each credential direction is
  rotated by its holder (section 5). The earlier text "the hub is the active party" no longer holds for every link.
- "Receive endpoint": in push mode this is an endpoint on the hub (it receives the site's deltas); in stream mode the site exposes the
  stream endpoint on its partner listener. CR-041 covers both and uses the term "receive endpoint" for the hub-side one.

## 10. Verification status
Nothing in this document has been run or tested; it is a plan. Revised 2026-10-26 for the owner decisions (documents only, no runner job). Effort figures are estimates, not measurements. Code references come
from the earlier read of `origin/release/2160`; re-check them on the integration head before slice 1.
