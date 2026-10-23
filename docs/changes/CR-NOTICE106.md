# CR-NOTICE106 - building notice board: notices, audiences, push, and TV boards

Status: change record + mockup **v4** (TV surface redesigned), no code. Branch `pilot/NOTICE106-295` from v2.12.4 (`320e55551`). Board item r106.

**Owner review 2026-10-24 (v1 -> v2).** The boards list, the board page and the compose dialog are approved **as the settings /
editing screens only**. The TV screen is a different product surface: "a comfortable advertising-style screen for the building's
customers - time, date, weather, news if possible, and the notices". Decisions taken with it: the default validity is editable in
Settings (Q7); read receipts show **names** to notice managers (Q5, privacy decision accepted by the owner); the TV carries **both**
the developer / management-company logo and the SmplWise logo (Q10), the SmplWise logo on the opposite side from the company logo
and both slightly larger than v1 (the logo feedback on CR-LOGOS295). Section 8 is rewritten for the display surface; §14 carries the
two new owner questions (weather source, news sources).
**Owner review of v2 (v2 -> v3).** "The TV screens are not displayed well or not at all, and they are what matters most; when it
worked it looked bad on a real screen." Cause in v2: the TV was a layer inside the editing mock-up (fixed over the app shell, offset
under the mock bar, sized in `vmax`; the preview was a second copy of the markup scaled with a transform), so opening it on a TV
browser showed the shell, the mock bar or a clipped layer, and the type and the logos did not hold up (a white logo on a white
plate, a numeric range like "10:00-12:00" reversed by the bidi algorithm, white on a light red band at ~2.6:1). v3 rebuilds the TV
as a **standalone page** (`docs/design/mockups/notice-106/tv.html`) drawn on a fixed design canvas and zoomed to the screen (§8.5),
and the display tab's preview is an iframe of the same file, so the preview is the TV. Direct entry: `tv.html?board=lobby&template=1`
(or `index.html?tv=1&template=2&board=parking`, which redirects there). §8 is updated accordingly.

**Owner review of v3 (same day).** The type was too large, and the screen must show **one notice at a time** - no "up next" strip,
no list or stack of notices; the notices follow one another in rotation. v3 therefore: (a) a text-size setting per board, small /
medium / large (`display.font_size` = `s` / `m` / `l`, multipliers 0.72 / 0.86 / 1.0 of the canvas type scale), **default small**,
with more air around the blocks; (b) every template draws exactly one notice card (template 2 lost its "up next" strip, the
portrait template its "coming next" list), with position dots only; (c) the news ticker isolates every headline (bidi-safe
punctuation), puts a dot between items, the source after each, and fades out at both edges instead of a hard cut.

**Owner review of v3, round 3 (v3 -> v4).** "Better, but not enough - it must look much, much better; think about how real
hotel / office / residential-tower lobby signage looks, day mode and night mode." v3 was a dashboard on a TV: system fallback
font (the mock-up never loaded Heebo), every block in a box (cards, pills, a boxed ticker), four competing accent colours,
no welcome, no depth. v4 rebuilds `tv.html` as **lobby signage**: Heebo (the add-on's own woff2, inlined in the mock-up; weights
200-700), one notice at a time on a quiet ground, a welcome with the building's name, the time as the largest and lightest
element, weather and date as lines of text rather than widgets, the building's status as a whisper in the footer, both logos
small and well placed. **Day mode** (ivory, ink, bronze) is bright and airy; **night mode** (charcoal, warm white, champagne) is
deep, warm and lower in luminance; the switch is automatic by sunrise / sunset (or configured hours) with a manual override,
and a late-night dim on top. Three templates that really differ (welcome classic / full-bleed image with a frosted card / minimal
information board), each with a landscape and a portrait composition; boards for the entrance lobby, the elevator lobby
(portrait), the parking and the gym. The "single notice" rule now also covers the urgent notice (§8.5). Settings from v3 kept
(size s/m/l, rotation, blocks, sources). §8 rewritten; evidence in §12.

**Owner review of v4, round 4 (same day).** "Much better." Two additions: (1) **control over the rotation** - the interval
in editable seconds per board, a hold on a chosen notice, manual next / previous (the control strip, the TV remote's arrows,
the Settings preview), a dwell per notice, and an "urgent stays" rule - all in the board's display tab; (2) a **display mode
that shows all the notices together**, not only one at a time: per board `rotation` (one notice, the single-notice rule) /
`all` (every notice in 2-4 columns, auto-fit, no scroll, pages that cycle when there are many) / `focus` (all together with one
highlighted large). Day / night, the templates and both orientations unchanged. §8.6 (rotation control) and §8.7 (display
modes) added; the display tab in `index.html` carries the new controls; evidence in §12.

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
| `GET /notices/{id}/reads` | `notices.manage` | `{audience: n, read: n, users: [{user_id, name, place, read_at}], unread: [{user_id, name, place}]}` - names visible to notice managers (owner decision 2026-10-24, §10); `notices.reads_names = false` reduces it to counts |
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

## 8. The TV display surface (v4)

The TV is **not** the editing board shown large. It is lobby signage: part of the building's entrance, like the stone, the
lighting and the concierge desk - a calm screen the building's customers glance at from 4-5 metres. The time and date, the
weather, the building's status, one notice at a time, an occasional promo slide, an optional news line; an urgent notice becomes
the notice on the screen (and, for its first minute, the whole screen). Its own visual language, not the app's: Heebo, generous
whitespace, hairlines instead of boxes, one accent (bronze by day, champagne by night), restrained luxury. Mockup v4: the
standalone `tv.html` (boards `lobby` / `elevator` / `parking` / `gym`, `?template=1|2|3`, `?theme=day|night|auto`, all switches
in its header comment); verified at 1280x720, 1920x1080, 3840x2160, 1080x1920, 2160x3840, 1024x768 (4:3) and 2560x1080 (21:9),
day and night, every template in both orientations.

### 8.0 Day mode / night mode

| | day | night |
|---|---|---|
| ground | ivory `#f4f1ea` with a soft daylight gradient and a faint grain | charcoal `#0b0d12` with a warm lamplight glow top-start and a cool shadow bottom-end |
| text | ink `#16181d`, secondary `#474a52`, tertiary `#767a84` | warm white `#ebe6db`, secondary `#b9b3a7`, tertiary `#847f76` |
| accent | bronze `#8a6a3a` (welcome line, forecast icon, position dot, ticker dots) | champagne `#d2b078` |
| states | warn `#a8600f`, danger `#9b1e1e`, ok `#2f7a4f` | warn `#e2a24b`, danger `#e35c5c`, ok `#5cc48a` |
| luminance | high contrast, bright | every surface and text level lower; no pure white anywhere |

Switching: `display.theme` = `day` / `night` / `auto` (default **auto**). Auto uses the installation's coordinates (sunrise + 15
min -> day, sunset - 15 min -> night; NOAA approximation, computed locally, no network) or configured hours
(`display.day_hours`, e.g. `07:00-19:00`) when the manager sets them; a manual choice overrides. The page re-evaluates every
clock tick and re-renders once on a change (the product debounces to one switch per 10 minutes so dusk never flickers). On top
of night mode, `display.night` (23:00-06:00, dim 0.5 by default) lowers brightness further for the small hours. `light` / `dark`
are accepted as aliases for compatibility with the v3 preview links.

### 8.1 Blocks

| block | content | source | default |
|---|---|---|---|
| **clock + date** | the time in the largest and lightest type on the screen (Heebo 200, 232 px on the 1920 canvas at size "l", 248 px portrait, tabular figures, a dimmed colon), the weekday and date under it, the Hebrew date with the Shabbat candle-lighting time in the tertiary colour | the add-on clock (installation zone); Hebrew date and candle lighting computed locally (`hdate`-style algorithm, no network) | on; Hebrew date on |
| **welcome** | "ברוכים הבאים" in the accent, the building's name large (88 px, Heebo 500) under it; templates 1 and 2 (template 3 shows the name small with the board's place) | the installation's building name | on; the greeting line can be hidden (`blocks.welcome`) |
| **weather** | a line of text, not a box: icon, temperature (Heebo 300), condition; the next N hours (3 / 5 / 8) as a small row of time / icon / degrees | the installation's **Home Assistant weather entity first** (`weather.*` chosen in Settings, `forecast` hourly attribute via `weather.get_forecasts`); internet fallback optional (Q11) | on when a weather entity exists |
| **building status** | a quiet line of text in the footer - a state dot, the name, the state - no pills, no icons: elevators (ELEVATORS280 state), generator (GEN1 ready / running), free parking (PARK count), gym open; **never** details, names or counts of people | the existing modules' public-safe state; each chip is opt-in per board and disappears when its module is off | on where the module exists; chips chosen per board |
| **notices** | exactly one notice on the screen, in every template and orientation, cross-fading; no card frame in templates 1 and 3 (the notice sits on the ground), the frosted card in template 2; a meta line (severity word in its colour, a dot, the window) above the title for important / urgent notices, the window under the body for ordinary ones; an urgent notice adds a short red rule above its meta line | §3 active notices tagged to the board | always on (it is the product) |
| **urgent** | default `stage`: the urgent notice **is the notice on the screen** - first in the rotation, double dwell, no second notice beside it (the single-notice rule, §8.5); `full`: the first-minute **takeover** (oxblood ground, a short red rule and the words "הודעה דחופה" letter-spaced, title 124 px Heebo 500, body 56 px, the "until" line, the clock and both logos stay; dignified, unmistakable); `band` keeps v3's strip under the header for comparison only | critical notices | automatic: takeover for the first 60 s, then `stage` |
| **promo / info slides** | a slide in the same rotation as the notices (after them): the picture beside the title and the line on the wide stage, stacked in portrait and in the card; a placeholder tint until the manager uploads a picture | slides the manager adds per board (text + optional JPEG/PNG up to 1 MB, re-encoded to 800 px like the bill logo; stored in a `notice_board_slides` table) | off until a slide exists |
| **news ticker** | a single line above the footer under a hairline: a small letter-spaced "חדשות" label, the headlines scrolling with the source name after each in the tertiary colour, an accent dot between items, both edges faded | RSS feeds chosen in the board settings from a curated list or a custom URL, fetched **server-side** by the add-on every 15 min, titles only, HTML stripped, 2 KB per item cap, no images, no links; **off by default** (Q12) | off |
| **logos** | company logo at the inline start of the header (72 px high on the 1920 canvas, 64 portrait); the SmplWise wordmark small at the inline end of the **footer** (40 px) in templates 1 and 3, in the header in template 2 - opposite corners, the operator's brand quiet, as on hotel signage; night mode uses each logo's dark variant; a logo without a dark variant sits on an ivory plate with its light variant (CR-LOGOS295 plate rule); on the takeover the company logo always sits on the plate | CR-LOGOS295 | both on; the company logo can be hidden per board, the SmplWise logo cannot |
| **status footer** | the building-status line at the inline start; "עודכן 09:12 · the board's name" with a small green dot and the SmplWise mark at the inline end; the stale text in the warn colour; offline replaces the status line with "הלוח מנותק מהמערכת · מוצגות ההודעות האחרונות" | the page itself | always |

### 8.2 Templates (per board, with a live preview thumbnail in the "display" tab)

| template | landscape (1920x1080) | portrait (1080x1920) | for |
|---|---|---|---|
| 1 **ברוכים הבאים** (welcome classic) | header (company logo) / body: the welcome column at the inline start - "ברוכים הבאים", the building's name, the clock, date, Hebrew date, weather line + hours - a vertical hairline, the stage (one notice) at the inline end / ticker / footer (status line, updated, SmplWise) | welcome and name / the clock large / date / weather and hours on one row / a hairline / the stage / ticker / footer with the status on two lines | entrance lobby, reception |
| 2 **תמונה** (full-bleed image, overlay card) | the building's own photo on the whole screen (`display.photo`; a placeholder sky / dusk scene until one is uploaded) with a soft veil and grain; both logos in the header; welcome, clock, date and weather on the photo at the inline start; a frosted-glass card (blur 28 px) at the inline end with the notice and the status line | welcome and clock at the top on the photo, the card low on the screen | gym, lounge, pool, any space with a photo worth showing |
| 3 **לוח מידע** (minimal information board) | typographic, hairlines only: a top row with the building's name + the board's place and the clock + date / a hairline / the notice in editorial type (104 px title, Heebo 400) / a hairline / the status line and a one-line weather | the clock very large and light (220 px) with the date and the name under it / a hairline / the notice / a hairline / status, weather and hours | elevator lobbies (portrait, glanceable from the elevator doors), parking (no weather), service corridors |

Every template has both compositions; `layout` = `auto` follows the screen, `portrait` / `landscape` pins it, and a forced
mismatch (a portrait board on a landscape TV) is pillar-boxed, never stretched. Per-place defaults in the mock-up: lobby = 1,
elevator = 3 portrait, parking = 3 without weather and news, gym = 2. The preview in Settings is the
**same page in an iframe** (`/b/{slug}` with the board's draft `display_json` and `embed=1`; in the mock-up `tv.html?...&embed=1`)
in a 16:9 or 9:16 frame, so the manager sees exactly what the TV draws, in the board's theme; "full screen" opens the same URL.

### 8.3 Feed (`GET /api/v1/notices/display/{slug}`)

```json
{"board": {"name": "לוח הלובי", "slug": "lobby", "version": 17,
           "display": {"lang": "he", "theme": "dark", "template": 1, "layout": "auto", "rotate_s": 12, "font_scale": 1.0,
                       "blocks": {"clock": true, "hebdate": true, "weather": true, "info": ["elevators", "generator", "parking"],
                                  "promo": true, "news": true, "company_logo": true},
                       "weather": {"source": "ha", "hours": 5}, "news": {"speed": "normal"},
                       "night": {"from": "23:00", "to": "06:00", "dim": 0.5}, "burn_in": {"shift": true}},
           "logos": {"product": "/api/v1/notices/display/lobby/logo/product",
                     "company": "/api/v1/notices/display/lobby/logo/company"}},
 "now": "2026-10-24T09:12:00Z",
 "notices": [{"id": "...", "title": "...", "body": "...", "severity": "critical", "starts_at": "...", "ends_at": "...", "pinned": true}],
 "weather": {"updated": "...", "now": {"t": 24, "condition": "sunny", "text": "בהיר · רוח קלה מערבית"},
             "hours": [{"at": "12:00", "t": 26, "condition": "sunny"}]},
 "info": [{"kind": "elevator", "label": "מעלית צפונית", "state": "ok", "text": "פועלת"}],
 "slides": [{"id": "...", "title": "...", "text": "...", "image": "/api/v1/notices/display/lobby/slide/<id>?v=<stamp>"}],
 "news": [{"source": "ynet", "title": "..."}]}
```

Nothing personal: no author, no audience, no ids of places, no counters. `version` = max(`notice_boards.updated_at`,
`notices.updated_at` of its items, slides, feed fetch time) as an integer, used as the ETag. Weather, info and news are
assembled server-side (the TV page never talks to Home Assistant or to the internet; only to the add-on), cached per board, and
absent when the block is off. `logos.company` is absent when the installation has no company logo; the feed passes `theme`
so the page asks for the right variant (`?variant=dark`).

### 8.4 Display settings (`display_json`, per board; the "display" tab of the board page)

| key | values | default |
|---|---|---|
| `template` | 1 / 2 / 3 (§8.2) | 1 |
| `lang` | `he` / `en` (UI strings; notices as written) | `he` |
| `theme` | `day` / `night` / `auto` (auto = by sunrise / sunset at the installation's coordinates, or `day_hours`); `light` / `dark` accepted as aliases | `auto` |
| `day_hours` | `HH:MM-HH:MM` or empty (empty = the sun) | empty |
| `photo` | the building's picture for template 2 (JPEG/PNG up to 2 MB, re-encoded to 1920 px; the bill-logo pipeline) | none (placeholder scene) |
| `urgent` | `stage` / `stay` / `full` / `band` (§8.1 urgent, §8.6) | `stage` (the takeover is automatic for the first minute) |
| `mode` | `rotation` / `all` / `focus` (§8.7) | `rotation` |
| `rotate_s` | 6..60, an editable number (not a fixed list) | 12 |
| `hold` | a notice id or empty (§8.6) | empty |
| `layout` | `auto` / `landscape` / `portrait` | `auto` |
| `rotate_s` | 6..60 (notices) | 12 |
| `font_size` | `s` / `m` / `l` - Settings "גודל הכתב": קטן / בינוני / גדול (multipliers 0.72 / 0.86 / 1.0) | **`s`** (owner 2026-10-24) |
| `font_scale` | 0.85..1.2, a fine adjustment on top of `font_size` (not shown in the UI) | 1.0 |
| `blocks.clock`, `blocks.hebdate`, `blocks.welcome` | bool | true, true, true |
| `blocks.weather`, `weather.source`, `weather.hours` | bool; `ha` / `internet`; 3 / 5 / 8 | true when an entity exists; `ha`; 5 |
| `blocks.info` | list of chip kinds from `elevators`, `generator`, `parking`, `gym` | the kinds whose module is on |
| `blocks.promo` | bool (+ the slides table) | true when a slide exists |
| `blocks.news`, `news.feeds`, `news.speed` | bool; list of `{name, url}`; `slow` / `normal` / `fast` | **false**; []; `normal` |
| `blocks.company_logo` | bool | true when a company logo exists |
| `night` | `{from, to, dim 0.3..1}` | 23:00-06:00, 0.5 |
| `burn_in` | `{shift: bool}` (CR-030: +-2 px on a 60 s cycle) | true |

Installation-wide in Settings > לוח הודעות > ברירות מחדל: the weather source for all boards (`notices.weather_entity`,
`notices.weather_fallback`), the news allow-list (`notices.news_sources`, curated; a custom URL is per board and audited).

### 8.5 Behaviour of the page

- Full screen, no chrome, no navigation, no links out. RTL Hebrew; `lang=en` flips the UI strings only.
- **Scaling (v3).** The page is authored on a fixed design canvas, 1920 x 1080 (landscape) or 1080 x 1920 (portrait), and the
  whole canvas is zoomed to the viewport (CSS `zoom`, a `transform: scale` fallback): 1280x720 = x0.667, 1920x1080 = x1,
  3840x2160 = x2, so every TV shows the same composition and 4K is sharp, not small. One axis is exactly the base and the other
  follows the screen's real ratio (a 4:3 or 21:9 screen gets a taller / wider canvas instead of black bars); only a forced
  orientation mismatch (template 3 on a landscape TV) is boxed. No scrolling, nothing outside the canvas, the cursor hidden.
- **Type** - Heebo throughout (the add-on's own woff2; the TV build target serves them like the app; the weight axis 200-900
  is used: 200 for the clock, 300 for bodies and temperatures, 400-500 for titles, 500-600 for the few emphasised words; nothing
  heavier - weight 800 was part of what made v3 look cheap). 1920-canvas px at size **l**; size **s** (default) is x0.78, **m**
  x0.9: clock 232 (s 181; portrait 248 / 193; template 3 top row 96 / 75), building name 88 (69), notice title 80 (62; template 2
  68 / 53; template 3 104 / 81; portrait 78-92), body 46 (36; template 3 50 / 39), meta and date 32-40 (25-31), ticker 34 (27),
  status line 28 (22), takeover title 124 (97). The 4 m rule: everything meant to be read from the lobby floor is >= 30 px at
  size s (~0.75 cm x-height on a 55"); the footer status (22-25 px) is for people standing close. Safe margins 88 / 64 px
  (landscape), 64 / 56 (portrait). Contrast: ink on ivory 15:1, warm white on charcoal 14:1, the tertiary colour >= 4.5:1 on
  both grounds, the severity words >= 4.5:1. `font_scale` multiplies the text as before.
- **Fit, not clip.** A title wraps freely (balanced); the body is clamped at 4 lines (5 in the card, 6 portrait) and the whole
  notice steps its type down to at most 60 % (`--k`) before the clamp cuts; the welcome column drops, in order, the hourly
  forecast, the Hebrew date and the condition text when the column is short (size l, the band, a 4:3 screen); the status line is
  one row and hides on offline (the offline sentence takes its place); in the card it may take two rows. Numeric ranges
  ("10:00–12:00", "02.11 – 05.11") are wrapped in a left-to-right isolate so the bidi algorithm does not reverse them.
- **Implementation notes:** never combine `text-wrap: balance` with `-webkit-line-clamp` on one element (it hung Chromium's layout
  in v3). Hidden stage items are translated **up**, not down, for their entrance, and inline SVG icons are `display: block`:
  both otherwise extend the scrollable overflow of their containers. Chromium counts a tight-leaded text's font content-area
  (Heebo ~1.3 em) as layout overflow; the "nothing clipped" check therefore compares real element boxes, not `scrollHeight`.
- **The single-notice rule** (owner 2026-10-24, extended in v4): the screen never shows two notices. An urgent notice is therefore
  **the** notice on the screen - first in the rotation, double dwell, with its red rule and "הודעה דחופה" meta line - instead of a
  band above another notice; for its first 60 s after publication it is the full-screen takeover (`urgent=full`), then it rejoins
  the rotation as the first item. The v3 band is kept as `urgent=band` only so the owner can compare; it is not the default.
  Everything else keeps running (a sign that shows only the alarm loses the people who came for the time).
- **Rotation**: one item at a time - the notices (pinned, severity, `starts_at` desc) and then the promo slides, in one playlist;
  dots show the position; a long body and the urgent notice take two ticks; a single item does not rotate; the entrance is a 1 s
  fade with a 14 px settle (reduced motion: a plain 0.3 s fade).
- The ticker scrolls at the chosen speed, right-to-left reading order (the start of a headline enters from the left edge first),
  ~120 canvas px/s at `normal`; each headline is a bidi-isolated run (punctuation stays with its sentence), an accent dot separates
  items, and both edges fade over 80 px so no word is cut hard against the label.
- Polling every 30 s with `If-None-Match`; a changed version re-renders without flashing (the stage keeps its current item if
  it still exists). No SSE / WebSocket (CR-030's reasoning); polling with a stale indicator is the honest answer for a sign.
- **Stale**: after 3 missed polls (90 s) the amber "לא מעודכן מ-09:04" chip appears in the footer and the live dot turns
  amber; after 10 minutes the body dims to 0.7 and a grey band says the board is offline; the last good content stays. The
  clock keeps running from the TV's own clock. A 404 (board deleted, token rotated, module off) shows "הלוח אינו פעיל" and
  stops polling.
- **Empty**: "אין הודעות כרגע · the building's name · יום נעים" in light type where the notice would be; the other blocks stay.
- **Day / night** (§8.0): automatic by the sun or configured hours, manual override; **late night** dims the whole canvas to
  `night.dim` (brightness .58 and a touch less saturation in the mock-up); a critical notice published during the night wakes it
  for its validity.
- **Burn-in (OLED-safe)**: the whole canvas drifts by up to 6 canvas px on a 60 s cycle (7 positions, 3 s glide; the CR-030 rule,
  scaled); the only other motion is the ticker and the 1 s item fades; soft gradients and a faint grain, no fixed high-contrast
  edges, no filled blocks, no white; the ambient gradient is replaced by the building's photo in template 2.
- Privacy on a public screen: building chips are states only; weather is a place, not a person; the news ticker shows titles
  the add-on fetched, never a third-party script in the page (the CSP of §4.1 stays `self` only).

### 8.6 Rotation control (round 4)

All of it in the board's display tab, under "הודעות"; the TV applies a change within one poll (30 s).

| control | setting | behaviour on the TV |
|---|---|---|
| interval | `rotate_s`, a number field 6..60 s | one tick of the rotation; in `all` mode a page stays two ticks |
| dwell per notice | `dwell_s` on the notice (compose / edit dialog; empty = the board's interval) | ticks = round(dwell_s / rotate_s), at least 1; without it an urgent notice and a long body (> 110 chars) take two ticks |
| hold | `hold` = a notice (select "השהיה על הודעה"; "ללא" releases) | the screen stays on that notice (`rotation` / `focus`: it is the one shown; `all`: its page, the cell gets an accent ring) and shows a quiet "מושהה" mark next to the position dots; the manager releases it from the tab or the TV's remote |
| manual next / previous / pause | no setting: the TV remote (ArrowLeft = next in a right-to-left list, ArrowRight = previous, Play/Pause, MediaTrackNext / Previous), the Settings preview's three buttons (a `postMessage` to the iframe, the product will send the same command through the feed's `control` field with a 60 s lease), the mock-up's control strip | moves the rotation (or the page) and resets the dwell; pause holds the current item and shows "מושהה"; play resumes and clears a hold |
| urgent rule | `urgent` = `stage` (rotates with the rest, double dwell, takeover for the first minute) / `stay` (holds the screen until it expires, nothing else rotates; in `all` mode its page holds) / `full` (takeover for the first minute only, then like `stage`) | §8.1 |

A hold and a pause never outlive the notice: when the held notice expires or is archived the rotation resumes by itself.

### 8.7 Display modes (round 4)

| mode | what the screen shows | rules |
|---|---|---|
| `rotation` (default) | exactly one notice (or promo slide) at a time; the single-notice rule | §8.5 |
| `all` ("כולן יחד") | every active notice together in a grid of quiet cells (a 4 % ink tint, a hairline; the urgent one tinted red with a red border); the promo slides are not shown | columns by the stage's width and the count: a wide stage 1-3 notices = 1-3 columns, 4 = 2x2, 5-6 = 3x2; the narrower stage of template 2 at most 2 columns (2x2); portrait one column of up to 4. More notices than a page holds = pages that auto-cycle (two ticks per page) with page dots; nothing scrolls, nothing is clipped: each cell steps its type down to 60 % before the 4-line clamp. Cell type at size l: title 58, body 40, meta 26-28 (size s: 45 / 31 / 21) - every title and body readable from 4 m, the meta for people standing close |
| `focus` ("כולן יחד + הודעה מודגשת") | one notice large (the rotation's current item, or the held / urgent one) at the stage's inline end, a hairline, and the other notices as a compact list of up to three cells (title + two body lines) with "ועוד N הודעות" when there are more | the large item rotates like `rotation` (same dwell rules, same dots), the list always shows the others; landscape 3:2 columns, portrait two rows; the promo slides are not shown |

The mode is per board (`display.mode`), chosen in the display tab next to the interval; the preview shows it live.

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
- **Read receipts** ("מי קרא", owner decision 2026-10-24): the read count in the manager's table is a button that opens a
  narrow sheet: KPI tiles (read / unread / recipients), a progress bar, a segmented control read / unread, a table of names with
  the user's place and the read time. Visible to `notices.manage` only; not exported, not pushed.
- **Settings > לוח הודעות**: the module switch card; defaults card (the default validity in days **editable** - owner 2026-10-24,
  default severity, push on publish, read receipts names / counts, history retention, the weather source for the boards);
  **TV boards** card: table (name, slug, enabled, items, last seen, actions: copy link, open).
- **Board page** with three tabs (`sw-tabs` compact): **כללי** (name, fixed slug, location, language, the link shown once on
  create / rotate with the QR from `qrSvg` of `sw-second-factor.ts`), **תצוגה** (the template picker with schematic
  thumbnails, the live preview drawn by the TV renderer scaled, theme / orientation / font size / night dim / burn-in / company
  logo, and the "מה מוצג" block list: clock + Hebrew date, weather source + hours, news feeds list + add + speed, building
  chips, notices rotation, promo slides grid with add / edit), **הודעות** (the notices on the board).
- States everywhere from `sw-state-panel`: loading (skeleton), empty, error, forbidden, module off.

## 10. Privacy

- The TV feed and page carry no personal data at all (§8.1); the token is in the fragment, hashed at rest, rotatable.
- Read receipts: the owner decided (2026-10-24) that notice managers see **names** (and the user's place and read time);
  readers are told in the compose dialog's recipients line that managers see who read; no export, no push, counts only in the
  audit log; `notices.reads_names` turns it back to counts per installation.
- The TV feed adds weather, building states, slides and headlines - none of it personal; feeds are fetched by the add-on, so
  the TV page never contacts a third party and no viewer is tracked by a news site.
- `last_seen_at` on a board is a timestamp only - no address, no user agent.
- Notices are building information; the body is plain text, no HTML, no attachments, no @-mentions.
- Retention: archived / expired notices are soft-deleted after `notices.retention_days` (365) and purged after 30 more days;
  the audit log keeps the action rows per its own policy.
- The technician-privacy rules (TECHPRIVACY280) are untouched: a vendor's external session never sees notices.

## 11. Module switch and settings keys

`notices.enabled` (default `"false"`), `notices.default_days` (7, editable 1..90), `notices.default_severity` (`info`),
`notices.push_default` (`by_severity`), `notices.reads_names` (`"true"`), `notices.retention_days` (365), `notices.boards.remote`
(`"false"`), `notices.boards.max` (10), `notices.weather_entity` (the chosen `weather.*` entity or empty), `notices.weather_fallback`
(`"false"`, Q11), `notices.news_sources` (the curated list, Q12). All in
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
Playwright: the page and the compose dialog at 1366 / 1024 / 375 light + dark; the TV page at 1920x1080, 1366x768 and 1080x1920,
templates 1-3, urgent on / off, stale / offline / gone / empty / night, with and without the company logo and the ticker.
Mockup v2 evidence: `private/review/notice-106-v2/` (29 screenshots). Mockup v3 evidence: `private/review/notice-106-v3/` (42
screenshots, after the second owner round: the TV at 1280x720, 1366x768, 1920x1080, 3840x2160, 1080x1920, 2160x3840, 1024x768, 2560x1080; templates 1-3; urgent
band / full takeover / none; stale / offline / gone / empty / night; light + dark; text size small (default) / medium / large; the editing screens with the iframe
preview). Mockup **v4** evidence: `private/review/notice-106-v4/` (44 screenshots: template 1 lobby day + night at 1280x720,
1920x1080, 3840x2160 and portrait 1080x1920, promo slide, no urgent, no company logo / no news, sizes m and l; template 2 gym day +
night at 1280x720, 1920x1080, 3840x2160 and portrait both modes, the lobby on template 2; template 3 elevator portrait day + night
at 1080x1920 and 2160x3840, parking day + night, parking 1280x720, the lobby on template 3 with the ticker; urgent as the notice,
the takeover day + night + portrait, the v3 band; stale / offline / gone / empty / late-night dim; auto theme at 21:00 (night) and
07:30 with configured hours (day); 1024x768, 2560x1080, a portrait board on a landscape screen (boxed), the control strip; the
display tab with the preview iframe for templates 1-3 and day). Round 4 adds 23 shots (67 in all): mode `all` for the lobby
day + night at 1920x1080 (3x2, 7 notices = 2 pages, page 2), 3840x2160, size l, portrait (1 column, 4 per page), the parking on
template 3 (2x2), the elevator portrait, the gym on template 2 (2x2 in the card) landscape + portrait; mode `focus` for the lobby
day + night + 4K + portrait, the parking and the elevator on template 3, the gym on template 2; a hold in rotation and in `all`
(the accent ring), pause, urgent `stay` in rotation and in `focus`; the display tab with mode `all`. `shots.mjs` fails on page errors, console errors or warnings,
document scroll, anything outside the canvas, a visible box leaving its container (the clip check) and a missing Heebo;
`errors.txt` = clean; `report.txt` = canvas size, theme and fit factor per shot. Every screenshot was viewed; the rounds fixed:
the portrait template 1 stage getting a 1 px grid row, the welcome column overflowing at sizes m / l (the drop order), the
template 2 card sized by its hidden promo slide, the fourth status chip wrapping out of sight in the card and behind the offline
line, the template 2 logos forced white on a bright day sky, a promo picture placeholder that read cheap; round 4: the focus
layout at 50/50 squeezing the highlighted notice (now 3:2), the secondary list too small for 4 m, the pause label collapsed by the
dot rule. Playwright TV tests in slice 3 take the same resolutions and checks.
Risk tier M (one module, one migration, one public surface); the public surface gets the security review of the tickets public
listener as its checklist.

## 13. Slices

1. **Core** - migration, model, in-app API, permissions, module switch, page + compose + widget, tests. No push, no boards.
2. **Push** - the source, the recipient rule, visibility, resolve on archive, the push checkbox.
3. **TV boards** - boards API, display routes, the TV page (build target like `public-ticket.html`, Heebo served like the app)
   with templates 1-3 in both orientations, day / night / auto (sun by the installation's coordinates), the clock / Hebrew date /
   welcome / notices / urgent / logos blocks, the burn-in drift, the rotation control (interval, hold, next / previous / pause
   through the feed's `control` lease and the remote's keys, dwell per notice, the urgent rule) and the three display modes
   (§8.6-8.7), the board page with the display tab and the live preview, QR.
4. **TV data blocks** - weather from the HA entity, building chips, promo slides (table + upload), the building photo for
   template 2, the news ticker with the server-side RSS fetcher and the curated list; each block behind its own setting.
5. **Cast as picture** (option B of §4.2) - only on the owner's word.
6. Later: residents / units model, attachments, English second body, a wall-display widget, internet weather fallback (Q11).

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
5. **Read receipts.** Decided 2026-10-24: names visible to notice managers (`notices.manage`), counts elsewhere; §10.
6. **Residents.** Recommendation: not in this CR; "floor" means "whose access reaches the floor" (§5.3). A units model is a
   separate change record once residents exist as users.
7. **Default validity.** Decided 2026-10-24: 7 days as the default, editable in Settings (1..90 days); critical requires an
   explicit end; "until archived" allowed for info / alert.
8. **Severity names in Hebrew.** Recommendation: רגיל / חשוב / דחוף.
9. **Language on the TV.** Recommendation: Hebrew UI strings, one body as written; an English second body is slice 5.
10. **Logos.** Decided 2026-10-24: both logos on the TV - the company logo at the inline start of the header, the SmplWise
    logo at the inline end (opposite sides), both slightly larger than v1 (4.6 % / 4 % of the long side), light and dark
    variants, landscape and portrait, supplied per CR-LOGOS295 (the display endpoint only proxies). The company logo can be
    hidden per board; the SmplWise logo cannot.
11. **Weather source.** Recommendation: the installation's Home Assistant weather entity first (`weather.*`, chosen in Settings;
    hourly forecast via `weather.get_forecasts`) - it is already there, local, and matches the building's location. Internet
    fallback (Open-Meteo by the building's coordinates, no key, no account) only as an opt-in per installation for buildings
    whose HA has no weather integration; off by default because it is an outbound call from the add-on on a schedule.
    Alternative: internet only - rejected as the default (an outbound dependency for data HA already has).
12. **News sources.** Recommendation: the ticker is **off by default**; when a manager turns it on, the feed list offers a short
    curated list of Israeli general-news RSS feeds (the owner names which: e.g. ynet, Globes, Calcalist, Walla) plus a custom
    URL field (audited). Fetched server-side every 15 min, titles only, HTML stripped, no images, no links on the TV. Questions
    for the owner: (a) which sources go on the curated list; (b) whether a custom URL is allowed at all or only the list;
    (c) whether a building may show the ticker on a parking screen (recommendation: yes, template 2 keeps it optional).
13. **Promo slides.** Recommendation: text + optional picture per slide, per board, up to 10 slides, JPEG/PNG up to 1 MB
    re-encoded to 800 px (the bill-logo pipeline), no video, no external images. Question: should slides be shareable across
    boards (one slide, several boards) - recommendation yes, via the same board-items pattern, in slice 4.

## 15. Build NOTICE106B-295 (pilot/NOTICE106B-295, from a1ac9d3ac)

Built (module `notices.enabled` OFF by default): slice 1 core without the home widget, slice 3 TV boards in full, and from slice 4 the
weather (the installation's `weather.*` entity) and the news ticker (server-side RSS, curated list + optional https URL).

- Migration `0165_notices.sql` (built as provisional `0160_notices.sql`; renumbered at the 2.16.0 integration, release/2160).
- Backend: `services/notices/` (model, store, audience, display, sources, page, listener), `routers/notices.py`. Settings are the module's
  own keys behind `GET/PATCH /notices/settings` (not the global settings PATCH); `notices.enabled` and `notices.boards.remote` are in the
  backup `SETTINGS_KEEP`. New key `notices.boards.origin` (the address the TV links point to). Company logo: the boards keep their own
  copy (`PUT /notices/settings/logo`, the bill-logo sanitiser) until CR-LOGOS295 lands. Control lease: `POST /notices/boards/{id}/control`.
- The TVs reach the boards through a LAN listener (add-on option `notice_boards`, container port 18094, unmapped by default): it serves only
  `/b/<slug>`, the TV page's own asset files and the two display routes. The main app serves the same routes (Ingress preview; the remote
  channel only with `notices.boards.remote`).
- TV page: `frontend/notice-tv.html` + `src/notice-tv/` - a third entry of the main Vite build; `tv.css` is generated from the approved
  `tv.html` (verbatim, Heebo inlined); the renderer is the mock-up's, driven by the feed. Pixel check against the mock-up:
  `tests/pixel-notice-tv-mock.spec.ts`. One deliberate deviation: template 2 shows the SmplWise mark in the header only (the mock-up also
  drew it in the footer; §8.1 says header).
- UI: `#/devices/notices` (ראשי › לוח הודעות; KPI filters, table / cards, compose dialog) and `#/system/notices` (+ `/<board id>`: tabs
  כללי / תצוגה / הודעות, the live iframe preview, link + QR shown once).
- NOT built: push (slice 2; `notices.push` is catalogued), the home widget, promo slides, the template-2 building photo, the building-status
  chips (the page draws `info` when a feed carries it; the backend sends none yet), internet weather fallback, cast as a picture.
