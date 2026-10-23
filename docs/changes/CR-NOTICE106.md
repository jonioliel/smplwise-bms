# CR-NOTICE106 - building notice board: notices, audiences, push, and TV boards

Status: change record + mockup, no code. Branch `pilot/NOTICE106-295` from v2.12.4 (`320e55551`). Board item r106.
Module switch `notices.enabled`, **OFF by default**. Migration `0160_notices.sql` (**provisional** number, one file; renumber
at integration like every other branch). Mockup: `docs/design/mockups/notice-106/index.html` (owner standing style: the
infrastructure temperature / elevators / schedules language, real tokens and shell as in MAINT215 v2).

Naming: the repository already uses "announcements" for the spoken announcements of MU2/ANN2 (`routers/announcements.py`,
permission `media.announce`, channel `announce`, keys `announce.*`). This module is therefore called **notices**
(`notices.*`, table prefix `notice_`); product name in Hebrew: **לוח הודעות** (one notice = הודעה, a TV board = לוח תצוגה).

## 1. Goal

A manager writes a notice to the building ("water cut tomorrow 10:00-12:00", "elevator service on Tuesday"): a title, a
text, an audience (everyone / by floor or area / by group or role), a validity window and a severity. The notice

1. appears on the home screen (a widget) and on a dedicated page for the people in its audience, in the app and on the phone;
2. can be sent as a push through the existing notification pipeline (CR-018), to the audience only, once, on an explicit action;
3. expires by itself at the end of its window, without a worker;
4. can be shown on one or more **TV boards** spread around the building (parking board, lobby board, ...): each board has a
   name, its own link and its own display settings, shows only the notices tagged to it, needs no login on the TV, and
   carries the SmplWise logo plus an optional management-company logo (supplied per CR-LOGOS295).

Not a chat, not a ticket, not a document store: no replies, no attachments in slice 1, no per-apartment residents (the product
has no resident model today, see §5.3).

## 2. Placement (recommendation)

**Its own small page, reachable from the home screen and from Settings - not a tab of the service-management area.**

- Readers: `#/notices` - one page "לוח הודעות" in the main area ("ראשי"), listed in `AREA_TABS.devices` only while the module
  is on (the `applyTicketsHidden` pattern: `applyNoticesHidden(settings)` + `me.modules.notices`). The home widget's header
  links to it; on the phone it is the widget's "הכול" link and the same page.
- Managers: the same page carries the compose / edit / archive actions (by permission), like the temperature screen carries its
  manage actions; no separate "management" page for notices.
- Settings: `#/system/notices` - the module switch, the defaults (default validity, default severity, push default, retention),
  and the **TV boards** list (links, QR, rotate, preview). Registered in the four places of nav.ts / sw-app.ts / system-index.ts.

Why not the service-management area (the four sections of `SERVICE_IA_PROPOSAL_2026-10-23.md`): the area is gated by
`tickets.enabled` and is a staff tool (requests, maintenance, vendors and money, reports); its personas are the handler, the
department manager and finance. A notice is read by **everyone**, including viewers and kiosk users who never open the service
area, and must exist on installations that never turn tickets on. The IA proposal itself puts new modules' switches in a
"מודולים נלווים" card under Settings and keeps the area to service work. A notice is also written by the building manager, not by
a service department. So: readers get it where they already look (home), writers get it in the same place, and the switches and
the TV boards live in Settings with the wall displays and the cast screens, which are the same kind of thing.

## 3. Model

### 3.1 Tables (migration `0160_notices.sql`, provisional)

```
notices
  id TEXT PK, title TEXT NOT NULL (<= 120), body TEXT NOT NULL (<= 2000, plain text, line breaks kept),
  severity TEXT NOT NULL CHECK (info|alert|critical)         -- the vocabulary of notify_policy.SEVERITIES; UI: רגיל / חשוב / דחוף
  status TEXT NOT NULL CHECK (draft|published|archived) DEFAULT 'draft',
  starts_at TEXT NOT NULL, ends_at TEXT NULL,                 -- ISO UTC; NULL = until archived (allowed only for info/alert)
  pinned INTEGER NOT NULL DEFAULT 0,                          -- stays first in lists and widgets
  audience_json TEXT NOT NULL,                                -- §5
  push_requested INTEGER NOT NULL DEFAULT 0, pushed_at TEXT NULL, push_generation INTEGER NOT NULL DEFAULT 0,
  site_id TEXT NULL, building_id TEXT NULL, floor_id TEXT NULL, -- the writer's scope anchor (§6), like tickets / maintenance
  created_by TEXT NOT NULL, created_at TEXT NOT NULL, updated_by TEXT, updated_at TEXT, archived_at TEXT, deleted_at TEXT NULL
notice_boards
  id TEXT PK, name TEXT NOT NULL (<= 60), slug TEXT NOT NULL UNIQUE (a-z0-9-, <= 40, immutable after create),
  enabled INTEGER NOT NULL DEFAULT 1,
  display_json TEXT NOT NULL,                                 -- §8.2
  token_hash TEXT NULL, token_generation INTEGER NOT NULL DEFAULT 0, token_rotated_at TEXT NULL,
  last_seen_at TEXT NULL,                                     -- the last successful feed read (no address, no agent string)
  created_by, created_at, updated_by, updated_at, deleted_at
notice_board_items
  board_id TEXT NOT NULL REFERENCES notice_boards(id), notice_id TEXT NOT NULL REFERENCES notices(id),
  position INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (board_id, notice_id)
notice_reads
  notice_id TEXT NOT NULL, user_id TEXT NOT NULL, read_at TEXT NOT NULL, PRIMARY KEY (notice_id, user_id)
```

Indexes: `notices(status, starts_at, ends_at)`, `notices(deleted_at)`, `notice_board_items(notice_id)`,
`notice_boards(slug)`, `notice_boards(token_hash)`. Rollback: drop the four tables; the backup keep-list (`services/backup.py`)
gains the four names and the `notices.*` setting keys. Foreign keys to `users`, `floors`, `spatial_zones`, `groups` are soft
(ids kept, rows filtered when the target is deleted), as in the elevator alerts.

### 3.2 Derived state (read time, no worker)

```
effective = 'draft'     if status = draft
          = 'scheduled' if status = published and now < starts_at
          = 'active'    if status = published and starts_at <= now and (ends_at is NULL or now < ends_at)
          = 'expired'   if status = published and ends_at <= now
          = 'archived'  if status = archived
```

Readers (widget, page, TV feed, push) see **active** only. The manager page lists all five with KPI filters
(פעילות / מתוזמנות / דחופות / פגו / טיוטות), exactly the temperature-screen KPI-as-filter pattern. Expiry is therefore
automatic and exact to the second with no scheduler; a nightly sweep (`notices.retention_days`, default 365) only deletes
archived/expired rows older than the retention, soft-delete first.

### 3.3 Severity and the push vocabulary

| severity | Hebrew | in lists | push default | on a TV board |
|---|---|---|---|---|
| info | רגיל | plain row | off | rotates with the rest |
| alert | חשוב | warning badge | off, suggested on | rotates, warning badge |
| critical | דחוף | danger badge, pinned by default | on | sticky banner at the top, never rotated out; `ends_at` required |

## 4. API (prefix `/api/v1`, router `routers/notices.py`)

All routes except the display routes go through `router = APIRouter(dependencies=[Depends(module_gate)])` -> 404
`feature_disabled` while `notices.enabled` is off (the maintenance pattern); `open_router` serves `GET /notices/module` only.
Order on every route: principal -> module switch (404) -> permission (403, audited) -> visibility (404).

| Method, path | Permission | Notes |
|---|---|---|
| `GET /notices/module` | any principal | `{enabled}`; also mirrored as `me.modules.notices` |
| `GET /notices` | `notices.view` | my active notices (audience-resolved for me), `?scope=mine|all` (`all` needs `notices.manage` and returns every effective state, with filters `state`, `severity`, `board`, `q`) |
| `GET /notices/{id}` | `notices.view` | 404 if not in my audience and no `notices.manage` |
| `POST /notices` | `notices.manage` | create as draft (or `publish: true`); validates §3.1 limits, audience within the writer's scope (§6) |
| `PATCH /notices/{id}` | `notices.manage` | edit; editing a published notice does not push again |
| `POST /notices/{id}/publish` | `notices.manage` | draft -> published; `push: bool` (default by severity, §3.3) triggers §7 once |
| `POST /notices/{id}/push` | `notices.push` | explicit re-send to the audience (new `push_generation`, new dedupe key); audited |
| `POST /notices/{id}/archive` | `notices.manage` | any state -> archived; removes it from boards and widgets at once |
| `DELETE /notices/{id}` | `notices.manage` | drafts only; published rows are archived, never deleted (audit trail) |
| `POST /notices/{id}/read` | `notices.view` | marks read for me (widget "new" dot); idempotent |
| `GET /notices/{id}/reads` | `notices.manage` | counts only: `{audience: n, read: n}` - never a user list (§10) |
| `GET /notices/audience/preview` | `notices.manage` | `audience_json` -> `{users: n, floors: [...], groups: [...], roles: [...]}` for the compose dialog |
| `GET /notices/boards` | `notices.boards` | list with `enabled`, `last_seen_at`, `has_token`, `item_count` |
| `POST /notices/boards` | `notices.boards` | create; the answer carries the **plain token once** |
| `PATCH /notices/boards/{id}` | `notices.boards` | name, enabled, `display_json`; slug is immutable |
| `POST /notices/boards/{id}/rotate-token` | `notices.boards` | new token, old one dead at once; plain token once; audited |
| `DELETE /notices/boards/{id}` | `notices.boards` | soft delete; the link answers 404 from then on |
| `PUT /notices/boards/{id}/items` | `notices.manage` | the ordered notice ids of a board (and `PATCH /notices/{id}` carries `boards: [ids]` for the compose dialog) |
| `GET /notices/boards/{id}/preview` | `notices.boards` | the same payload the TV gets, through the session (the Settings preview) |

### 4.1 Display routes (no login, the TV)

| Route | Auth | Notes |
|---|---|---|
| `GET /b/{slug}` | none | the static TV page (one built html, no app shell, no navigation); the token travels in the **URL fragment** `#t=<token>` exactly like the tickets public listener (`services/tickets/links.py`): the fragment never reaches the server, logs or referrers; the page reads it and sends the `X-Board-Token` header |
| `GET /api/v1/notices/display/{slug}` | `X-Board-Token` | the feed (§8.1); `If-None-Match` / `ETag` = the board version; answers 304 while nothing changed |
| `GET /api/v1/notices/display/{slug}/logo/{kind}` | `X-Board-Token` | `kind = product|company`; proxies the asset chosen per CR-LOGOS295 (read-only, cacheable `private, max-age=3600`) |

Rules of the display routes (the "safest" option asked for):

- one **long random revocable token per board** (`secrets.token_urlsafe(32)`, 43 chars); only the SHA-256 is stored
  (`token_hash`), shown once at create / rotate, compared with `hmac.compare_digest`; `token_generation` bumps on rotate;
- read-only: no POST, no cookies, no session, no user data, no navigation, no links out of the page;
- shows **only** active notices tagged to that board (`notice_board_items`) - the audience of a notice does not apply to a TV
  (a TV is a public place; the writer chose the board explicitly);
- rate limited with the main-app `RateLimiter` (`services/ha_user_auth.LIMITER`): per token 2/s burst 10, per network 10/s;
  a wrong or revoked token answers a uniform 404 after a constant-time compare, counted against the network limit
  (`limit_ip`), 20 misses per 10 min -> 429;
- headers: `Cache-Control: no-store` (feed and page), `X-Robots-Tag: noindex, nofollow`, `<meta name="robots">`, the strict CSP
  of `public_http.SECURITY_HEADERS` (self only, no inline script, no frames), `Referrer-Policy: no-referrer`;
- local channel only by default: the display routes are in `BLOCKED_ON_REMOTE` (the TVs are on the LAN); `notices.boards.remote`
  (default off) opens them on the remote channel for a board that is a browser on a mobile network (owner question Q3);
- HTTPS: Ingress is HTTPS already; for a plain-HTTP LAN origin the TV page works the same (the fragment is not sent over the
  wire either way), but the owner is told in Settings when the origin is `http://` (the cast-origin check text, reused);
- the audit log records `notices.board.create / rotate / disable / delete` (actor, board id); the feed itself is not audited
  (it is polled every 30 s), only `last_seen_at` moves.

### 4.2 Cast

The existing Cast service (CR-028) can **not** cast a page: the bridge's `cast_policy.py` admits only
`/cast/<32hex>/index.m3u8` on the announced origin, the Default Media Receiver plays media, not HTML, and a custom receiver app
("not planned", needs an HTTPS receiver that cannot load LAN http video) was rejected. Three options:

- **A (slice 1, recommended): the link.** Every Android TV / Google TV / LG / Samsung / Fire TV has a browser or a kiosk
  app (Fully Kiosk, TV Bro); open `https://<host>/b/lobby#t=...` once and set it as the start page. The page is built for
  that: no login, auto-refresh, stale indicator, burn-in behaviour. QR + copy-link in Settings.
- **B (slice 3, candidate): cast as a picture.** The backend renders the board to a PNG every N seconds (headless Chromium is
  already a test dependency, not a runtime one - this needs a runtime renderer, see Q4) and the relay serves
  `/cast/<32hex>/board.png`; the bridge casts it with `media_content_type: image/png` through the Default Media Receiver, which
  the policy can admit by one more `PATH_RE` branch. Keeps every CR-028 rule (announced origin, hashed session token, no-store,
  relay off by default). Loses the live clock and the smooth rotation (a new picture per rotation step).
- **C (rejected): a custom Cast receiver** - the same reasons as CR-028.

So the CR ships A; B is described so the owner can ask for it; the board model already has what B needs (slug, token,
display settings).

## 5. Audience resolution

`audience_json` is one of:

```
{"everyone": true}
{"floors": [floor_id...], "areas": [zone_id...], "groups": [group_id...], "roles": [role_id...]}   -- any subset, OR-ed
```

Resolution (`services/notices/audience.py`, reusing `elevator_alerts.recipient_users` for groups and roles):

1. **everyone** = all `users.active = 1`, every source (ingress / local / remote).
2. **groups** = `group_members` of those groups.
3. **roles** = users holding a live `bindings` row for that role (`effect = allow`, not expired, not revoked), direct or through a
   group - the elevator-alerts resolver, unchanged.
4. **floors / areas** = users whose live allow bindings reach that place: a binding whose scope is the floor itself, its
   building, its site or the installation. An area (`spatial_zones`) resolves to its floor (a zone has no scope of its own:
   `ha_scope.py` - "HA areas / floors are not a scope"). Installation-scope admins are therefore in every floor audience; the
   compose preview shows the number so the writer sees that.
5. Union, then `notify_visibility.Reach(conn, p).can_see(n)` on the push path (the engine does that for every source anyway),
   and the **reading test** `in_audience(conn, user_id, notice)` is the same function evaluated for one user (cached per
   request); the widget and the page call it, so a notice is visible exactly to the people it is pushed to.

5.1 Resolution time: the push resolves at publish (the recipient list is frozen into `notification_recipients` by the
engine); the **reading** side resolves live, so a user added to a floor tomorrow sees yesterday's active floor notice.

5.2 Scope of the writer (§6): a writer with `notices.manage` at building B can only choose "everyone in B" (= everyone whose
bindings reach B), floors of B and groups; roles and installation-wide "everyone" need installation scope. The server
re-checks on save (403 `audience_out_of_scope`).

5.3 Residents: there is no resident / apartment model in the product (users are HA, local or remote identities; the only
user-to-place link is an RBAC binding). "Floor 3" therefore means "everyone whose access reaches floor 3". An apartment ->
person mapping is a future table (`units`, `unit_members`) that would plug into step 4 without changing the API; it is **not**
in this CR (Q6).

## 6. Permissions

| Permission | Built-in holders | Opens |
|---|---|---|
| `notices.view` | viewer, kiosk, operator, editor, site_admin, system_admin (implied by `view` like `wall.view`) | the page, the widget, read marks |
| `notices.manage` | editor, site_admin, system_admin; delegable | compose, edit, publish, archive, board assignment, audience preview, read counts; **scoped** - the audience must fit the writer's scope (§5.2) |
| `notices.push` | site_admin, system_admin; delegable | publish with push, re-send |
| `notices.boards` | system_admin; delegable (`DEFAULT_DELEGABLE`) | TV boards: create, display settings, tokens, preview, disable, delete |
| `system.configure` | system_admin | the module switch and the defaults (`notices.*` keys) |

Added to `roles.json` + `contracts/examples/role-catalog.design.json`, labels in `access.PERMISSION_LABELS`. Kiosk users read
only (a wall tablet may show the widget later; not in this CR). The remote channel serves the in-app routes as usual and blocks
the display routes (§4.1). Audit actions: `notices.create`, `.publish`, `.push`, `.archive`, `.delete`,
`notices.board.create`, `.update`, `.rotate`, `.disable`, `.delete`, each with actor, resource id and the audience summary
(counts, never names).

## 7. Delivery (push through CR-018)

- New `Source` in `notify_policy.SOURCES`: key `notice.published`, category `building` (new entry in `CATEGORIES`, label
  "הודעות לבניין"), severity from the notice, title = the notice title, body = first 160 chars, `link = #/notices/{id}`,
  `who = notice_audience` (new entry in `RECIPIENT_RULES` -> `recipients_for()` branch calling §5 with `origin.notice_id`),
  `push = True`, `email = False` by default (owner may turn email on in the policy screen like any source), `app = True`.
- One `emit_full(conn, Signal(source='notice.published', subject_kind='notice', subject_id=id, severity, dedupe_key=
  f'notice:{id}:{push_generation}', params={title, body, ends_at}, origin={notice_id, user_id}, category='building'))`
  inside the publish transaction; the notifier thread sends after commit; channels per each user's `push_prefs` /
  `notify_settings` (web push, phone app, WhatsApp if NOTIFWA is on, inbox always).
- New subject kind `notice` in `SUBJECT_KINDS`; `notify_visibility` rule: a notification about a notice is visible to a user iff
  `in_audience(user, notice)` or the user holds `notices.manage` (so a manager sees the sent item in the deliveries screen).
- `resolve`: archiving or expiry of a notice resolves its open notifications (`resolves=True`, the same signal with
  `resolve=True`), so the inbox does not keep a dead notice as unread.
- No push for drafts, edits or TV-only notices (a notice with boards and `audience = {}` is legal: TV only, no users).
- Quiet hours and pacing: whatever the pipeline does for `alert` today (NOTIFWA pacing, `0144_wa_pacing`) applies unchanged;
  the notice module does not add its own.

## 8. The TV board

### 8.1 Feed (`GET /api/v1/notices/display/{slug}`)

```json
{"board": {"name": "לוח הלובי", "slug": "lobby", "version": 17,
           "display": {"lang": "he", "theme": "dark", "rotate_s": 12, "font_scale": 1.0, "layout": "auto",
                       "clock": true, "night": {"from": "23:00", "to": "06:00", "dim": 0.5}, "burn_in": {"shift": true}},
           "logos": {"product": "/api/v1/notices/display/lobby/logo/product",
                     "company": "/api/v1/notices/display/lobby/logo/company"}},
 "now": "2026-10-24T09:12:00Z",
 "notices": [{"id": "...", "title": "...", "body": "...", "severity": "critical", "starts_at": "...", "ends_at": "...",
              "pinned": true}]}
```

Nothing else: no author, no audience, no ids of places, no counters. `version` = max(`notice_boards.updated_at`,
`notices.updated_at` of its items) as an integer, used as the ETag. `logos.company` is absent when the installation has no
company logo (CR-LOGOS295 decides what "has" means and supplies both files in light and dark variants; the feed passes
`theme` so the page asks for the right variant: `?variant=dark`).

### 8.2 Display settings (`display_json`, per board, edited in Settings)

| key | values | default |
|---|---|---|
| `lang` | `he` / `en` (UI strings of the page; notices are shown as written) | `he` |
| `theme` | `light` / `dark` / `auto` (auto = dark 19:00-07:00) | `dark` |
| `rotate_s` | 6..60 | 12 |
| `font_scale` | 0.8..1.6 | 1.0 |
| `layout` | `auto` / `landscape` / `portrait` | `auto` (from the viewport) |
| `clock` | bool | true |
| `night` | `{from, to, dim 0.3..1}` | 23:00-06:00, 0.5 |
| `burn_in` | `{shift: bool}` (the CR-030 rule: +-2 px on a 60 s cycle) | true |
| `show_company_logo` | bool | true when a company logo exists |

### 8.3 Behaviour of the page

- Full screen, no chrome: a header (board name, the two logo slots, clock and date), the body, a thin footer (the stale
  indicator and the last update time). RTL Hebrew; `lang=en` flips the UI strings only.
- Large type: base 2.2 vw in landscape (1920 -> 42 px), scaled by `font_scale`; titles 1.6 x; a body is clamped to 6 lines
  with "..." - a notice is a notice, not an article.
- **Critical** notices are a sticky banner at the top (danger colour, the warning icon, the title and the first line), never
  rotated out, up to two stacked; the rest rotate below.
- **Rotation**: one notice fills the stage at a time when more than one is active; a dot row shows the position; a notice
  with a long body gets its time doubled; a single notice does not rotate. Order: pinned first, then severity, then
  `starts_at` desc.
- Polling every 30 s with `If-None-Match`; a changed version re-renders without flashing (the stage keeps its current item
  if it still exists). No SSE / WebSocket: the product has no SSE and a TV browser reconnecting a WebSocket after sleep is
  the failure mode CR-030 fights; polling with a stale indicator is the simplest honest answer for a sign.
- **Stale**: after 3 missed polls (90 s) a small amber "לא מעודכן מ-12:04" chip appears in the footer; after 10 minutes the
  stage dims to 0.7 and a grey band says the board is offline; the last good content stays (a sign that goes blank is worse
  than a sign that is 10 minutes old). A 404 (board deleted or token rotated) shows "הלוח אינו פעיל" and stops polling.
- **Empty**: "אין הודעות כרגע" with the clock large - the sign stays useful.
- **Night**: inside the night window the whole page dims to `night.dim`; a critical notice published during the night wakes it
  to full brightness for its validity.
- **Burn-in**: the CR-030 pixel shift; the header and footer also swap sides every hour (the clock moves from one end to the
  other), the stage background is a flat token colour, no fixed high-contrast edges.
- Portrait: header stacks (logos row, then name, then clock), banner full width; the stage has the height, so every active
  notice is **stacked** (no rotation, no dots) and only a list longer than the screen rotates in pages.
- Light + dark: the product token table; dark is the default for a TV (CR-030 chose the same for walls).

## 9. UI (owner standing style)

- **Home widget** `notices` (new id in `home_config.WIDGET_IDS` and `api/home-config.ts`, renderer `notices/home-widget.ts`,
  `case 'notices'` in `home-widgets.ts`, availability + poll in `devices-building.ts` like `doors`): up to 3 active notices for
  me, critical first, a "new" dot for unread, the title and the window, the header link "הכול" -> `#/notices`; sizes s/m/l;
  hidden when the module is off or when I have no active notice and the widget is set to "hide when empty" (default on).
- **Page** `#/notices`: the temperature-screen head (h1 "לוח הודעות", subtitle with counts, actions: "הודעה חדשה" by
  `notices.manage`), the KPI row (reader: פעילות / דחופות / חדשות; manager: פעילות / מתוזמנות / דחופות / פגו / טיוטות), the
  places tree on the side (floors / areas, the owner's rule, a select on the phone) that filters by audience, a segmented
  control (הכול / שלי / בלוחות), the electricity table (desktop) / cards (phone): severity badge, title + first line, audience
  chips, window, boards chips, actions (edit / archive). Reader rows open a read sheet; manager rows open the compose dialog.
- **Compose dialog** (`sw-dialog`): title, body, severity (segmented), validity (from / to, with "עד לביטול" for non-critical),
  audience (segmented "כולם" / "לפי מקום" (the tree as checkboxes) / "לפי קבוצה או תפקיד" (chips)) with the live preview count,
  TV boards (chips of the enabled boards), push (checkbox, default by severity, disabled without `notices.push`), pinned;
  footer: "שמירה כטיוטה" / "פרסום". Short confirmations (toast), no hints paragraphs (owner 2026-09-30).
- **Settings > לוח הודעות**: the module switch card; defaults card; **TV boards** card: table (name, slug, enabled, items,
  last seen, actions: copy link, QR, preview, rotate link, settings, disable) and the board sheet (display settings + the link
  shown once on create / rotate, with the QR from `qrSvg` of `sw-second-factor.ts`).
- States everywhere from `sw-state-panel`: loading (skeleton), empty, error, forbidden, module off.

## 10. Privacy

- The TV feed and page carry no personal data at all (§8.1); the token is in the fragment, hashed at rest, rotatable.
- Read receipts are counts only; no "who has read" list, no per-user export (Q5 asks whether a manager may see names).
- `last_seen_at` on a board is a timestamp only - no address, no user agent.
- Notices are building information; the body is plain text, no HTML, no attachments, no @-mentions.
- Retention: archived / expired notices are soft-deleted after `notices.retention_days` (365) and purged after 30 more days;
  the audit log keeps the action rows per its own policy.
- The technician-privacy rules (TECHPRIVACY280) are untouched: a vendor's external session never sees notices.

## 11. Module switch and settings keys

`notices.enabled` (default `"false"`), `notices.default_days` (7), `notices.default_severity` (`info`), `notices.push_default`
(`by_severity`), `notices.retention_days` (365), `notices.boards.remote` (`"false"`), `notices.boards.max` (10). All in
`settings.DEFAULTS`, PATCH aliases, audit `notices.module.enable|disable`, `/me.modules.notices`, backup keep-list.
With the module off: the routes answer 404, the nav tab and widget are hidden, the TV links answer 404 (a board page says
"הלוח אינו פעיל"), nothing is deleted.

## 12. Tests (plan)

Backend (pytest, fakes only, no lab): migration up/down; derived state at the four boundaries; audience resolution (everyone,
group, role via binding, floor via building and installation bindings, area -> floor, deleted targets); scope check on save
(403); publish emits exactly one signal with the frozen recipients and the dedupe key; re-push bumps the generation; archive
resolves; module off -> 404 before 403; display route: good token 200 + ETag/304, rotated token 404, wrong token constant-time
404 and the 429 after 20 misses, headers (`no-store`, `X-Robots-Tag`, CSP), remote channel blocked, no user fields in the feed
(a schema test); logo proxy 404 when CR-LOGOS295 has none; retention sweep.
Frontend (vitest): widget model (order, unread dot, hide-when-empty), page filters, compose validation (critical needs an end,
audience within scope), the TV page's rotation / stale / empty / night state machine (pure logic module `tv-logic.ts`).
Playwright: the page and the compose dialog at 1366 / 1024 / 375 light + dark; the TV page at 1920x1080 and 1080x1920.
Risk tier M (one module, one migration, one public surface); the public surface gets the security review of the tickets public
listener as its checklist.

## 13. Slices

1. **Core** - migration, model, in-app API, permissions, module switch, page + compose + widget, tests. No push, no boards.
2. **Push** - the source, the recipient rule, visibility, resolve on archive, the push checkbox.
3. **TV boards** - boards API, display routes, the TV page (build target like `public-ticket.html`), Settings card with QR,
   logo slots per CR-LOGOS295.
4. **Cast as picture** (option B of §4.2) - only on the owner's word.
5. Later: residents / units model, attachments, English second body, a wall-display widget.

## 14. Owner questions (recommendation first)

1. **Placement.** Recommendation: its own page in the main area + the home widget + Settings (§2). Alternative: a fifth
   section in the service area - not recommended, it hides notices from everyone the area excludes.
2. **One token per board or per TV?** Recommendation: **per board** (one link per board, rotatable). A TV is a place, a board
   is content; two TVs showing the lobby board share a link, and a compromised TV is handled by rotating that board's link
   (seconds, in Settings). Per-TV tokens would need a device list we do not have (and would be CR-030's pairing design that was
   dropped). If the owner wants per-TV, it is one more table (`notice_board_screens`) with the same hashing, later.
3. **Display routes on the remote channel?** Recommendation: **local only** by default, `notices.boards.remote` as an opt-in
   per installation. TVs sit on the LAN; a mobile-network sign is the exception.
4. **Cast.** Recommendation: ship the link (A) and decide on "cast as picture" (B) after the first TVs are up; B needs a
   runtime renderer in the add-on (size and CPU) and is not free.
5. **Read receipts.** Recommendation: counts only (privacy, and the clean-screen rule). Alternative: names visible to
   `notices.manage` - a privacy decision the owner should make explicitly.
6. **Residents.** Recommendation: not in this CR; "floor" means "whose access reaches the floor" (§5.3). A units model is a
   separate change record once residents exist as users.
7. **Default validity.** Recommendation: 7 days, critical requires an explicit end; "until archived" allowed for info / alert.
8. **Severity names in Hebrew.** Recommendation: רגיל / חשוב / דחוף.
9. **Language on the TV.** Recommendation: Hebrew UI strings, one body as written; an English second body is slice 5.
10. **Logos.** Reserved slots: product logo at the inline start of the header, company logo at the inline end, both in light
    and dark, both in landscape and portrait, supplied per CR-LOGOS295 (the display endpoint only proxies). Recommendation:
    the company logo defaults to shown when it exists; the product logo is always shown (small, never the larger of the two).
