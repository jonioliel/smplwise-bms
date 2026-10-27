# CR-041 — Multi-site: live link between installations, the receive endpoint and automatic key rotation

**Status:** PROPOSED (owner decisions of 2026-10-26 applied; awaiting owner approval of this request). Documentation only: no product
code, no migration, no runner job, no device contact.
**Numbering:** CR-041, the next free number (CR-040 `docs/changes/CR-040-KEY-ROTATION.md` on `pilot/WXROT-2411` is the highest found on
`origin/main` and on every `origin/pilot/*`, `origin/release/*` and `origin/integ/*` branch at the time of writing). It replaces the
placeholder name `CR-MULTISITE116` used in the plan.
**Branch:** `pilot/MULTISITE-PLAN-295`. **Plan:** `docs/architecture/MULTISITE_PLAN.md` (board items r116 and r271).
**Test tier when built:** L (new public surface, new persistent state, cross-installation protocol).

## 0. תקציר בעברית (למנהל המוצר)

**מה מבקשים לאשר:** מסמך שינוי רשמי אחד לשלושה דברים שהם מערכת אחת: (1) קישור חי בין שרתים, (2) נקודת קבלה בשרת המאוחד שמקבלת
עדכונים שהאתרים דוחפים, (3) החלפת מפתח אוטומטית של הקישור. הסיבה למסמך: `MASTER_SPEC_HE.md` מגדיר ריבוי אתרים ארגוני כמחוץ להיקף
ההתחלתי, ולכן נדרש אישור שינוי לפני שהשלב הראשון נכנס.

**מה הוחלט (26.10):**
1. כשהקישור נופל: "לא מעודכן, עדכון אחרון לפני N" אחרי סף קצר הניתן לשינוי, וסנכרון אוטומטי כשהחיבור חוזר.
2. **שני אופני החיבור נבנים במקביל מהיום הראשון** (השרת המאוחד פותח חיבור לאתר, וגם האתר דוחף בעצמו). זו סטייה מהמלצת התוכנית.
3. החלפת מפתח: כל 30 יום, תוקף 90 יום, חפיפה של 24 שעות. הכול ניתן לשינוי בהגדרות.
4. התראות חיות מאתר מרוחק: מספרים ומצבים בלבד; כותרות התראה רק אם מנהל האתר מסמן אישור שיתוף (בשלב ההרשאות).
5. קישור דרך רשת מקומית: רק במתג מפורש של מנהל מערכת, כבוי כברירת מחדל, עם רשימת כתובות מותרות אופציונלית לכל קישור.
6. שינוי ספים בהגדרות: מנהל מערכת כברירת מחדל, ניתן להענקה לכל תפקיד.
7. אם ההחלפה האוטומטית נכשלת שוב ושוב: התראה למנהלי שני האתרים (ברירת מחדל 14 יום לפני פקיעה), אדם מצמיד מחדש, והקישור נשאר לקריאה בלבד.
8. לחיצה על בניין באתר שאין בו חשבון: נפתח בכל זאת, ומסך הכניסה של האתר מסביר.
9. סדר בנייה: שלב אחד של מסך סקירה חי (מבנה, קישור, עדכון בזמן אמת), ואחריו הרשאות והחלפת מפתח.
10. נפתח מסמך שינוי אחד (זה).

**עלות (שעות סוכן, טווחים):** שלב ראשון (סקירה חיה עם שני האופנים + בדיקת אבטחה) כ-37-57; עד הרשאות והחלפת מפתח כ-58-92; הכול כ-138-220.
כ-85-90% ניתן לבנייה ולבדיקה בלי ציוד אמיתי. אימות על שני שרתים אמיתיים והחלפת מפתח אחת בפועל דורשים ציוד.

**מה נמצא סותר או דורש תשומת לב:** סעיף 12 (בעיקר: בקישור שבו רק האתר מתחבר אל השרת המאוחד אין ערוץ בכיוון ההפוך, ולכן כל כיוון מחליף את
המפתח שלו בעצמו).

## 1. Background and contradiction

`MASTER_SPEC_HE.md` lists multi-site enterprise as outside the initial scope. The owner approved the multi-site direction in decisions
333-341 and answers 367-379 (2026-10-24/25) and answered the ten remaining design questions on 2026-10-26. Per the precedence rule
(approved change request first, then the master spec), the contradiction is recorded here and resolved only by the owner's approval of
this CR. No slice that adds a table, a route, a scope or a screen merges before that approval.

## 2. Scope

In scope (one change, three parts that share one protocol and one security review):

1. **The live link.** A hub (any installation) keeps a read-only, authenticated, sequence-numbered link per remote site and shows the
   remote buildings in one directory next to the local ones. Both connection modes are built in parallel from day one:
   - hub-initiated stream (the hub opens an outbound HTTPS stream to the site's partner listener), and
   - site-initiated push (the site posts signed deltas to the hub).
   Both feed the same state, de-duplicated by sequence number. A link may run either or both (setting, default both).
2. **The receive endpoint.** The hub-side endpoint that receives pushed `snapshot`, `delta`, `heartbeat` and `rotate` messages
   (closed schema, size and rate caps, default off), plus the matching stream-serving endpoint on the site's partner listener.
3. **Automatic key rotation.** Each link credential replaces itself on a schedule without human involvement, server to server, with an
   overlap window; a person is involved only at first pairing and when rotation keeps failing.

Also in scope because they are part of the same stage: freshness states, automatic resync, the LAN-allowance switch, the editable
thresholds, the per-building permission matrix and the share approval for alert titles.

Out of scope (unchanged from the plan, section 8): single sign-on across installations, video or frame transport between sites, any
control action across sites (the partner NEVER list for door and device control stays; no write scope exists for federation), a cloud hub.
Mode A (one server, several buildings), the corner switcher, the per-module building filters, the phone with several servers and the
separate device source per building are later slices of the plan and are not approved by this CR beyond what the plan already records
(they proceed under their own task cards, inside the approved multi-site direction).

## 3. Owner decisions (2026-10-26)

| # | Decision |
|---|----------|
| 1 | Link down: "not updated, last update N ago" after a short, editable threshold; automatic resync on reconnect. |
| 2 | Connection mode: BOTH in parallel from day one (hub-initiated stream AND site-initiated push). Differs from the plan's recommendation (stream first). |
| 3 | Key rotation: every 30 days, token valid 90 days, 24 h overlap; all editable in Settings. |
| 4 | Live alerts from remote sites: counts and states now; alert titles only if the site administrator ticks a share approval (permissions stage). |
| 5 | LAN or private-address links: only through an explicit system-administrator switch, default off, optional per-link allowed-address list. |
| 6 | Changing multi-site thresholds: system administrator by default, grantable per role. |
| 7 | Rotation keeps failing: notify the administrators of both sites at the warning threshold (default 14 days before expiry); a person re-pairs; the link stays read-only. |
| 8 | Click on a remote building without an account there: open anyway; the site's login screen explains. |
| 9 | Build order: one live overview in one stage (structure, link, real-time update), then permissions and key rotation. |
| 10 | One formal change request now, covering the live link, the receive endpoint and automatic key rotation (this document). |
| 11 | New role "super admin" (Hebrew: מנהל על): sees ALL linked installations together, read-only by default. Distinct from the per-site "all buildings" permission, which never crosses sites (answer q17: explicit permission per site). Section 4a. |
| 12 | No phone notification for remote-site changes in phase 1 (remote live alerts appear in the overview only). |
| 13 | A real two-server test happens only after phase 2 (permissions and key rotation); until then everything runs on fakes and the equipment tests are reported NOT_RUN. |
| 14 | No single sign-on across servers in this plan; each site keeps its own login. |
| 15 | Mismatched versions: the link works when the two versions are compatible (schema-version check at pairing and on every reconnect); otherwise the link card shows "update required" and no data is shown as live. |
| 16 | The commercial side (licensing, pricing, packaging of multi-site) is decided later and is outside this CR. |

Earlier decisions that still apply: 333-341 and answers 367-379 (see the plan, section 1).

## 4. Design summary

Full design: `docs/architecture/MULTISITE_PLAN.md` sections 2-5. Points this CR fixes as binding:

- **Closed schema, fail closed.** Exact key set at every level on both ends; any deviation drops the message and counts a metric.
  Message types: `snapshot`, `delta`, `heartbeat`, `rotate`, `ack`. Every message carries a per-link monotonic sequence number;
  deltas carry the new value (idempotent); a gap triggers a `snapshot` request.
- **Freshness.** Heartbeat default 5 s, "not updated" threshold default 15 s, reconcile safety net default 15 min, reconnect backoff
  1-60 s; all editable (decision 1, decision 6).
- **Never sent:** person names, phone numbers, entity ids, camera ids, frames, event texts, addresses, IPs. Building names only with the
  per-link share-names switch; alert titles only with the per-link share-approval ticked by the site administrator.
- **Opaque building references:** HMAC of the building id with a per-link key, so two hubs cannot correlate ids.
- **Storage:** `federation_links`, `federation_state`, `federation_keys` (sealed material only); never exported, never in backup, demo
  mode refuses. Restore onto another box does not carry links or keys.
- **Permissions:** `sites.federation.view`, `sites.federation.manage`, installation-scope "all buildings" binding, per-role per-building
  matrix with effective-access preview; explicit deny wins. One edit permission per setting (`settings.multisite.<name>.edit`), default
  system administrator, grantable to any role.
- **Click-through:** a remote building opens the site in a new tab with its own login (setting `federation.open_mode`), even without an
  account there.

## 4a. Super admin role ("מנהל על") - owner note, added 2026-10-27

**Purpose.** One person (for example the owner of a group of sites) sees every linked installation together in the hub overview.

**Not the same as "all buildings".** The installation-scope "all buildings" binding covers every building of ONE installation and never
crosses sites (answer q17: access to another site is an explicit permission per site). Super admin is a separate, hub-level role.

**Permissions (read-only by default).**
- `sites.federation.view_all`: see every approved linked site and building in the overview, link health, freshness, counts and states.
  Alert titles only where that site's administrator ticked the share approval (decision 4); building names only with the per-link
  share-names switch.
- `sites.federation.manage` is NOT included; link creation, pairing and re-pairing stay with the system administrator.
- No write scope exists in federation, so no write permission can be granted to this role.

**How it is granted.**
- Only a system administrator of the hub grants or revokes it, to a named account; it is never a default role and never inherited.
- A link is visible to a super admin only after the site's administrator ticks a per-link "visible to super admin" approval (default
  off, held and enforced at the site like the share approvals). A super admin cannot widen what a site shares.
- Granting or removing a holder needs a confirmation with a reason; the holder list is visible in Settings.

**Audit.** Grant, revoke, and every view of a remote site's detail are audited at the hub (who, which link, when; never token text or
payload content). The site records "viewed by super admin of hub X" in its own audit log. Records are append-only and visible to the
administrators of both sites.

**What it can never do.**
- No door, gate, elevator, alarm, emergency or any device command on a remote site. The partner NEVER list stays and no federation write
  scope exists. Any cross-site command would need per-site approval under a separate change request and is not offered by this CR.
- No change to a remote site's settings, users, permissions or links; no reading of person names, phone numbers, camera ids or frames.
- No access to a site that did not approve the link, and no bypass of an explicit deny at the site.
- No self-granting and no self-service elevation.

**Slice and tests.** Built with slice 2 (permissions). Acceptance: a super admin sees all approved linked sites; an unapproved link is
invisible to them; an "all buildings" holder sees no remote site; every attempted command from this role is refused and audited.

## 5. Security notes

1. **New public surface.** The stream and the receive endpoint are default off, closed schema, size cap (64 KB), rate cap (20 msg/s per
   link), maximum links per hub (20), delta coalescing (one per building per second). A Fable security review of the whole surface
   (stream, receive endpoint, rotation, LAN allowance, share approvals) must pass before any switch is turned on outside a lab.
2. **Key rotation (decision 3).** Defaults: replace every 30 days, token lifetime 90 days, overlap 24 hours; all three editable in
   Settings with the permission of decision 6. Generation N+1 is restricted exactly like N and never wider; it is returned once, sealed
   to the requester's nonce; N is retired at the end of the overlap or on `ack` (setting). Own context string for the key purpose; it
   never reuses the evidence-signing key or the fleet key. Everything is audited at both ends without token text.
3. **Two credential directions.** A link running both modes has a hub-held credential (stream) and a site-held credential (push). Each
   is replaced by its holder through the channel that direction already uses, so a push-only link rotates without the hub calling the
   site.
4. **Read-only on failed rotation (decision 7).** Retry with backoff; at the early-warning threshold (default 14 days before expiry,
   editable) notify the administrators of both sites; a person re-pairs. A failed rotation never widens access, never extends a token
   and never leaves the link without a valid generation until natural expiry. The link is read-only at all times; no write scope exists.
5. **Revocation.** A token revoked at the site ends the link immediately; the hub shows "revoked by site".
6. **LAN switch off by default (decision 5).** The existing partner rule refuses private and CGNAT targets. Federation links get their
   own allowance: a system-administrator switch, default off, optional allowed-address list per link, audited. The public address
   through the existing tunnel stays the default and the recommendation.
7. **Alert titles (decision 4).** Counts and states only until the site administrator ticks the per-link share approval; the tick and its
   audit record live at the site, and the site enforces it when building messages (the hub cannot widen it).
8. **Clock skew.** Ordering uses sequence numbers, not clocks; expiry uses each side's own clock with the overlap as margin; skew is
   shown in the link health card.
9. **Secrets and private material.** No lab host, address, serial number or credential appears in fixtures, logs, documents or commit
   messages; tests use in-process fake peers and a fake clock.

## 6. Settings (every default editable, per-role permission, none hard-coded)

Overview and hub enable (off); transport per link (both); heartbeat interval and "not updated" threshold (5 s, 15 s); reconcile
interval (15 min); reconnect backoff (1 s / 60 s); key replacement interval, token lifetime, overlap (30 d / 90 d / 24 h); early
warning (14 d); private/LAN/CGNAT allowance (off, system administrator only, optional per-link list); share building names (off per
link); share alert titles (off per link, site administrator); remote building click behaviour (new tab); live alerts across sites (off,
severity floor); message size, links per hub, rate cap (64 KB, 20, 20 msg/s); opening view (overview for multi-building users).

## 7. Slice order

Sizes are agent-hours, estimates and not measurements; migration numbers are provisional and renumbered at integration.

| # | Slice | Hours |
|---|-------|-------|
| 0 | This CR approved; transport decision (SSE vs WebSocket); schema freeze | 2-4 |
| **Stage 1 — one live overview (decisions 2 and 9)** | | |
| 1a | Site summary + closed schema, `federation_*` tables, hub link CRUD, sealed credential, local-buildings overview, Settings card skeleton | 10-14 |
| 1b | Hub-initiated stream, deltas, heartbeat, sequence/gap/snapshot, freshness, automatic resync | 8-12 |
| 1c | Site-initiated push and the receive endpoint | 6-9 |
| 1d | Dual-transport convergence and de-duplication, reconcile, LAN-allowance switch, editable thresholds, link health card | 6-9 |
| **Stage 2 — permissions and key rotation** | | |
| 2 | Per-building permission matrix, `sites.federation.view/manage`, "all buildings", effective-access preview, remote live alerts (counts/states; titles with share approval) | 12-19 |
| 3 | Automatic key rotation (both credential directions, overlap, retries, early warning, read-only on failure, audit) | 9-16 |
| 4 | Fable security review of the federation surface and fixes (must pass before production switch-on) | 5-9 |
| **Later (plan slices 5-9, under their own task cards)** | corner switcher; module building filters; phone with several servers; separate device source; recorders/cameras/alarms per building | 80-128 |

Totals: stage 1 plus the review (0, 1a-1d, 4) about 37-57; full federation path (0, 1a-1d, 2, 3, 4) about 58-92; everything about 138-220.
Every slice ships OFF behind its switch and changes no existing query.

## 8. Acceptance criteria

1. With the hub and two fake sites configured, a change at a site (a counter or a state) is visible in the hub overview within the
   configured freshness bound in both transports, with the hub clock and the site clock unrelated.
2. Killing a link shows "not updated, last update N ago" after the threshold and never a stale value presented as live; on reconnect
   the state converges to the site's truth with no manual action.
3. Running both transports on one link yields one state: duplicates and reordered deltas are ignored by sequence number; a gap
   triggers exactly one snapshot.
4. Every message with an extra key, a missing key, a wrong type, an oversize body, a replayed sequence or a bad signature is dropped
   with a counted reason; nothing outside the closed schema ever leaves a site.
5. With the share switches off, no building name and no alert title reaches the hub (asserted on the wire, not only in the UI).
6. A user sees a remote building only with `sites.federation.view` plus the building binding (or "all buildings"); an explicit deny wins;
   a new building inherits "all buildings" (decision 338).
7. Key rotation: at the configured interval a fresh generation is issued, the old one still works for the overlap and not after; the new
   token is never wider than the old; a push-only link rotates without any hub-to-site call; with rotation failing, both site
   administrators are notified at the warning threshold and the link stays read-only until a person re-pairs.
8. The LAN allowance is refused unless the system-administrator switch is on; the per-link address list, when set, is enforced.
9. Every threshold is read from settings, changeable only by a holder of its edit permission (default system administrator); no
   hard-coded value is found by the settings-coverage test.
10. A single-building installation with no links shows no switcher and no overview; with every federation switch off, no existing
    response changes (golden-file comparison of the existing API).
11. The security review passes with no open high finding before any non-lab switch-on.

## 9. Test plan

Tier L. All of it runs against fakes: httpx mock transports, an in-process fake peer, a fake clock, a seeded two-building database.
No lab host, no runner job in the planning stage; implementation slices run targeted suites and one full gate at release.

- Unit: schema validator (exact key set, types, size), sequence/gap logic, de-duplication across transports, freshness state machine
  with the fake clock, rotation state machine (success, each failure step, overlap expiry, clock skew), settings and permission
  resolution.
- Integration (fake peer): stream and push convergence under injected loss, reordering and duplication; reconnect resync; revocation;
  LAN allowance on and off with and without an address list; share switches on the wire; rate and size caps.
- Authorization: matrix per role and building; explicit deny; "all buildings"; scope-leak test per router.
- Regression: golden-file comparison of existing API responses with federation off; demo mode refuses; backup and export exclude
  `federation_*`.
- UI (Playwright, existing layout guards): overview, link health, Settings cards, permission matrix, permission-denied and
  link-down states in every skin and theme; no scrolling in control screens.
- Equipment, once, with explicit owner approval at the time: latency and reconnect on two real servers; one real key rotation across
  two servers. Until then these are reported NOT_RUN.
- Security: the Fable review of slice 4.

## 10. Rollback

Every slice is behind a default-off switch. Turning the master switch off stops the stream, the push and the receive endpoint and hides
the screens; the tables stay inert. Removing a link deletes its sealed material. No existing table is altered in stages 1-2.

## 11. Registries

`management/tasks.json` and `management/test_catalog.json` are NOT edited by this documentation-only change: the branch is far behind
`main`, those files are canonical and conflict-prone, and the task and requirement ids are assigned when the owner approves the CR
and the slices are cut onto a current base (then `python scripts/project_status.py --write` is run and the regenerated views are
committed, per `CLAUDE.md`).

## 12. Contradictions and open points recorded (not silently resolved)

1. **Spec scope:** `MASTER_SPEC_HE.md` puts multi-site enterprise outside the initial scope; resolved only by approval of this CR.
2. **Decision 2 vs the plan's recommendation:** the plan staged the stream first and the push second; the owner chose both from day one.
   The plan's old slice 2 already named both, but as sequential steps; the re-cut merges them and adds about 4-6 hours of convergence
   testing.
3. **Rotation vs push-only links:** the plan's protocol had the hub as the single active party. A link where only the site can reach the
   hub has no hub-to-site channel, so each credential direction is rotated by its holder (section 5, note 3). The plan is updated.
4. **Wording "site receive endpoint":** in push mode the receiving endpoint is on the hub; in stream mode the site serves the stream.
   This CR names the hub-side one "receive endpoint" and covers both; confirm if "site receive endpoint" meant something else.
5. **Plan arithmetic:** the plan's Hebrew summary quoted 30-46 and 135-215 while its table summed to 28-46 and 126-210; superseded by
   the ranges above.
6. **Decision 4 vs earlier 374:** consistent (counts first), but the share approval is ticked at the site, not at the hub; the plan did
   not say where. Fixed here as the site (section 5, note 7).
7. **Registry convention:** this repository has no separate CR registry; a CR is its file under `docs/changes/`, referenced from tasks,
   requirements and traceability when implemented. See section 11.

## 13. Verification status

Nothing here has been run or tested. Hour figures are estimates. Code references come from the earlier read of `origin/release/2160` and
must be re-checked on the integration head before slice 1.
