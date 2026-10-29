# CALENDARS-298 - calendars and room booking: the phase 0 contract (board item r112)

**CR number:** provisional; the lead assigns the next free CR number at integration.
**Status:** PROPOSED - phase 0 (written contract + mockup round). Branch `pilot/CALENDARS-P0-298` from `main` @ 83a7c795f (v2.25.0).
No product code, no migration file, no test, no runner job, no account, no OAuth registration and no network call to any calendar
provider was made to write this. **Nothing here is an approval to build phase 1 or to connect any external calendar.**
**Migration:** `0190_calendars.sql` (phase 1 build, pilot/CALENDARS-P1-2300). The number 0190 was chosen on purpose: `0183` is a known
collision on other branches; 0183-0189 are left free for them and the migration runner has no contiguity rule (it applies every file whose
version is not recorded). The lead may still renumber at integration. Section 14.
**Mockup:** `private/design-system-2026-10-27/round6/calendars/index.html` (gitignored; local file only, invented data).
**Plan it implements:** `private/planning/PLAN_R112_CALENDARS_ROOMS_2026-10-28.md` + the owner decisions of 2026-10-29 (section 1).

---

## תקציר בעברית

- **מה זה:** מודול "יומנים" ב-Arx. מנוע יומן והזמנות פנימי הוא מקור האמת. סנכרון עם יומנים חיצוניים בא אחריו, בסדר קבוע: קודם iCal,
  אחר כך Google, אחר כך Microsoft. חשבונות OAuth נוצרים רק על ידי הבעלים; Arx לא יוצר חשבונות ולא שומר סיסמאות.
- **הרבה יומנים בהתקנה אחת:** יומן לצוות האחזקה, יומן לכל חדר ישיבות, יומני צוותים, יומן אירועים. לכל יומן: מנהל, סוג (חדר, צוות,
  אחזקה, אירועים), אזור זמן, צבע (אף פעם לא ירוק - ירוק שמור לסטטוס) וחיבור סנכרון אופציונלי.
- **הרשאות בשתי שכבות:** הרשאות מערכת חדשות במשפחת `calendar.*` (כניסה למודול, הזמנה בשם אחרים, ניהול יומנים, חלונות תחזוקה,
  חיבורים, פרטי אורחים), ומעליהן **תפקיד לכל יומן**: צפייה, יצירת אירועים שלי, עריכת הכול, ניהול ואישור. צוות יכול להזמין בשם צוות,
  חוג או לקוח (תווית בלבד).
- **אישור:** לכל יומן מתג אישור, כבוי כברירת מחדל. כשהוא דולק, מנהל היומן מאשר או דוחה בקשות (למשל צוות החוגים מבקש חדר). מצבים:
  ממתין, מאושר, נדחה, בוטל, נמשך, פג תוקף, נדחק על ידי תחזוקה. כל מעבר שולח התראה.
- **חלון תחזוקה מעל הזמנות קיימות:** הגדרה עם שלוש אפשרויות - (א) התחזוקה גוברת ומודיעים למארגנים (ברירת מחדל), (ב) אי אפשר להציב
  תחזוקה מעל הזמנה, (ג) לשאול בכל חלון. הזמנה שנדחקה לא נמחקת: היא עוברת למצב "נדחק" והמארגן מקבל הודעה עם הצעות לזמן חלופי.
- **אוטומציות מהזמנות:** רק חוזה - טריגרים (לפני תחילת הזמנה, בסוף, חדר התפנה, חלון תחזוקה נפתח/נסגר) ותבניות כבויות (תאורה ומיזוג
  לחדר מוזמן). הזמנה אף פעם לא מפעילה מכשיר ישירות.
- **קוד מבקר של WisKey:** בהמשך. כרגע רק שדה קישור ריק במודל.
- **פרטי אורחים ולקוחות:** שם וטלפון נשמרים 30 יום אחרי האירוע ואז נמחקים במשימת ניקוי (המספר ניתן לשינוי על ידי הבעלים). התווית
  (למשל "חוג קרמיקה") נשארת.
- **שלבים:** 0 חוזה ומוקאפ (המסמך הזה) · 1 מנוע · 2 מסכים · 3 שילובים בתוך Arx (בקשות, אחזקה, אוטומציות, התראות) · 4 iCal ·
  5 Google · 6 Microsoft · 7 טלפון ותוספות. בערך 205-260 שעות סוכן בסך הכול; שלבים 1-4 בערך 130-160.
- **שאלות פתוחות לבעלים:** בסעיף 19.

---

## 1. Owner decisions (2026-10-29, binding) and how this contract honours each

| # | Decision | Where |
|---|---|---|
| D1 | Internal calendar and booking engine is the source of truth; sync adapters come after | 2, 12 |
| D2 | Providers: iCal, Google AND Microsoft, in that order; OAuth accounts created by the owner only; Arx never creates accounts or stores passwords | 12, 15 |
| D3 | MANY calendars per installation; each has an owner/manager, a type (room, team, maintenance, event), a timezone and an optional sync binding | 3.1 |
| D4 | Sync: Arx-only first, then two-way on dedicated calendars only | 12.4 |
| D5 | Permission model: who may create/update events and in WHICH calendar (per-calendar roles view / create own / edit all / manage-approve); staff can book on behalf of teams, classes/clubs, customers | 6 |
| D6 | Optional per-calendar approval workflow, default none; manager approves/rejects; states pending/approved/rejected with notifications | 7 |
| D7 | Maintenance window over existing bookings: default maintenance wins + organizers notified; behaviour is a SETTING (wins+notify / cannot be placed / ask per window) | 8 |
| D8 | Automations triggered by bookings: triggers + disabled templates, contract only | 10.3 |
| D9 | WisKey visitor access codes later; a nullable link field in the model only | 3.2 (`visitor_invite_id`), 10.5 |
| D10 | Guest/customer name and phone kept 30 days after the event then erased (owner-configurable), plus a label | 9 |

### 1A. Changes after the owner answers of 2026-10-29 (round 6, binding; they supersede the text of later sections where they differ)

| # | Was in this contract | Now (owner answer) | Effect |
|---|---|---|---|
| C1 | Q4 per-calendar overlap override: contract assumed "any value", owner first said "only stricter" | Owner confirmed: a calendar manager may change the overlap policy in BOTH directions (stricter or looser than the installation value), and the installation value is changeable in settings | `overlap_override` takes any value; set by `manage` members of that calendar |
| C2 | A `pending` request HOLDS its slot (`pending_holds_slot` default true) | A pending request does NOT hold the slot. The FIRST entry that is `confirmed` holds it. A later overlapping request is not refused: it becomes `pending` and goes to the calendar manager for approval, flagged `contested`. The approvals list shows how many requesters compete for each window. The manager (calendar / area / system) prioritises | `pending_holds_slot` default **false**; new setting `contested_requests` = `queue` (default) or `reject` (the old 409); approving a contested request needs an explicit `displace_existing` decision; `competing_count` in the request list |
| C3 | D7: maintenance wins by default (`override_notify`) | Maintenance does NOT automatically win over an earlier entry. Priority is a setting. Default `first_holds`: a maintenance window over a confirmed entry is saved `pending` for the manager's decision (same queue as C2); the other values (`override_notify`, `block`, `ask`) remain selectable | `calendar.maintenance_overlap` default `first_holds` |
| C4 | D10 / section 9: guest retention 30 days, range 1-365 | Retention is fully configurable (0-3650 days; 0 = erase when the entry ends) and the owner may also destroy ALL guest personal data at once | new `POST /calendar/guests/purge` (`calendar.configure`, audited, counts only) |
| C5 | Question 1: mockup chose (a) | Default stays A (tab inside the main group); a setting lets the owner switch to B (own rail button) | setting `menu_position` = `a` (default) or `b`; returned by the module state route |
| C6 | Question 8: holiday eve | Regular day by default, changeable in settings | setting `holiday_eve_as_holiday` default false |
| C7 | Question 2 | Calendars are created by site manager and system admin | unchanged (`calendar.manage` is held by site_admin and system_admin) |
| C8 | Question 3 / 12 Google scope: narrow events scope | Full calendar scope; everything approved up front, no extra approval prompts in Arx | phase 5 (not built in phase 1) |
| C9 | 12.4: Arx wins on room calendars; external edits that break the rules are reverted | Calendars must stay editable outside Arx and Arx adapts. Every external change is accepted in both directions. When an external change conflicts with an Arx entry, BOTH are kept and flagged for a decision (`sync_flag = conflict`), nothing is reverted or deleted | phase 5; the `cal_events.sync_flag` column exists from phase 1 |
| C10 | Question 11 | Connecting external calendars is a permission the owner can hand out | new grant role `calendar_connect` (`calendar.connect`); not in `DEFAULT_DELEGABLE` |
| C11 | Questions 6, 9, 10, 12 | Public booking link: not now. Door display: later. Module name fixed "יומנים". "Room booked now" schedule condition: yes, phase 3 | no change to phase 1 |
| C12 | Question 14 | The bumped organizer chooses an alternative himself; maintenance does not always win | `displaced` state and alternatives as in section 7; auto-move not built |
| C13 | Migration number | `0190_calendars.sql` | header and section 14 |

Precedence (CLAUDE.md): approved change request > `MASTER_SPEC_HE.md` and `docs/security/` > `AGENTS.md` > this document. The plan
(`PLAN_R112...`) proposed `rooms.*` permissions and a single room resource table; D3 and D5 replace that with "every bookable thing is
a calendar" and a `calendar.*` family. That is a deliberate change from the plan, recorded here, not a contradiction with an approved
document. Contradictions found: none.

## 2. Scope and non-goals

In scope (phases 1-7): calendars of four types, events and bookings (one table), recurrence with exceptions, conflicts, buffers, capacity,
open hours, per-calendar roles, approval, maintenance windows and the overlap setting, guest details with retention, notifications,
projections of ticket visits and maintenance tasks, the automation trigger contract and disabled templates, iCal feeds out and in,
Google and Microsoft adapters, the phone view.

Not in scope: a public booking page for customers (needs the public-surface review; question 19.6), invitations e-mailed to external
attendees, free/busy of personal staff calendars, a groupware replacement, check-in kiosks at room doors (later, question 19.9),
CalDAV (optional later adapter), any device write from a booking.

Module switch: `calendar.enabled`, default **false**. While off every `/calendar/*` route answers the uniform 404 (`feature_disabled`),
the navigation item is hidden, no worker runs, feeds answer 404. Same pattern as tickets / notices / visitors.

## 3. Data model

All instants are UTC ISO-8601 strings (`...Z`), as everywhere in the product. Local wall-clock values (`HH:MM`, dates) are stored only
where the meaning is wall-clock (recurrence anchors, open hours, all-day dates). Every mutable row has `revision INTEGER` (optimistic
concurrency: a PATCH carries the revision it read; a mismatch is `409 stale`). Ids are opaque text (`cal_...`, `evt_...`), never
sequential. Soft delete = `archived_at`.

### 3.1 `cal_calendars` - one row per calendar (D3)

| Column | Type | Notes |
|---|---|---|
| `id` | TEXT PK | `cal_<22 chars>` |
| `name` | TEXT NOT NULL | 1-80 chars, unique among non-archived calendars (case-folded) |
| `type` | TEXT NOT NULL | `room` \| `team` \| `maintenance` \| `event` |
| `description` | TEXT | 0-500 chars, plain text |
| `color` | TEXT NOT NULL | a palette KEY, not a hex value, in this fixed order: `blue`, `rose`, `cyan`, `orange`, `violet`, `brown`, `magenta`, plus the neutral `slate` (imported / read-only calendars only). **No green key exists** (green is status only); no amber (it is the warning status). The 7 hues passed the dataviz palette validator in light and dark (mockup round 6, `inspect/dataviz-validate-palette.txt`); a first 10-hue set failed (sky/cyan and violet/indigo indistinguishable). Calendars beyond 7 reuse keys; identity is never colour alone (every chip and bar carries the calendar or event name). The UI maps keys to tokens per skin and scheme |
| `tz` | TEXT NOT NULL | IANA zone; default = `time.zone` at creation; changing it later does not move existing instants (section 5) |
| `owner_user_id` | TEXT NOT NULL | the accountable manager (one person); also gets a `manage` membership row automatically |
| `area_ref` | TEXT | room: the area / zone / org location id it stands for (nullable for non-spatial rooms) |
| `floor_id` | TEXT | derived from `area_ref` for scope checks (section 6.4); NULL = installation-wide |
| `capacity` | INTEGER | room only; 1-2000; NULL = no capacity check |
| `equipment` | TEXT (JSON) | room only; list of keys (`screen`, `projector`, `video_call`, `whiteboard`, `kitchen`, `accessible`), max 20 |
| `conflict_policy` | TEXT NOT NULL | `exclusive` (default for `room`, `maintenance`) \| `overlap` (default for `team`, `event`) |
| `buffer_before_min` / `buffer_after_min` | INTEGER NOT NULL | 0-240, default 0 / 0 (room default 0 / 10) |
| `slot_step_min` | INTEGER NOT NULL | 5 \| 10 \| 15 \| 30 \| 60; default 15 |
| `min_minutes` / `max_minutes` | INTEGER | duration bounds of one occurrence; defaults 15 / 720; NULL = no bound |
| `lead_min` | INTEGER NOT NULL | minimum notice before start for non-editors, default 0 |
| `horizon_days` | INTEGER NOT NULL | how far ahead a non-editor may book, 1-730, default 180 |
| `hours_mode` | TEXT NOT NULL | `always` \| `working_hours` (the SLACAL working-hours calendar) \| `custom` |
| `hours_json` | TEXT (JSON) | when `custom`: the SLACAL shape `{weekdays, start, end, days}` (same validator, no window across midnight) |
| `holiday_rule` | TEXT NOT NULL | `ignore` \| `closed` (no booking on holidays from `special_days`) \| `warn`; default `warn` |
| `approval_mode` | TEXT NOT NULL | `none` (default, D6) \| `always` \| `outside_hours` \| `on_behalf` (only bookings for teams/classes/customers) |
| `approval_timeout_h` | INTEGER | a pending request not decided N hours before its start becomes `expired`; default 2; NULL = at start |
| `overlap_override` | TEXT | NULL = follow the installation setting (section 8); else one of its three values for this calendar |
| `visibility` | TEXT NOT NULL | `members` (default: only members see it) \| `busy_to_all` (holders of `calendar.view` see busy blocks without titles) \| `details_to_all` |
| `sync_binding_id` | TEXT | FK `cal_sync_bindings.id`, NULL = Arx-only (D4) |
| `kiosk_visible` | INTEGER NOT NULL | 0; reserved for the door panel (later) |
| `created_by`, `created_at`, `updated_at`, `archived_at`, `revision` | | |

Limits: at most 500 calendars per installation (setting `calendar.max_calendars`, 1-2000).

### 3.2 `cal_events` - the single event table (bookings, events, maintenance windows, projections)

| Column | Type | Notes |
|---|---|---|
| `id` | TEXT PK | `evt_...` |
| `calendar_id` | TEXT NOT NULL | the home calendar |
| `kind` | TEXT NOT NULL | `booking` \| `event` \| `maintenance` \| `ticket_visit` \| `maint_task` \| `external` \| `block` |
| `title` | TEXT NOT NULL | 1-120 chars plain text |
| `notes` | TEXT | 0-2000 chars plain text; visible per section 6.3 |
| `starts_at` / `ends_at` | TEXT NOT NULL | UTC; `ends_at > starts_at`; for all-day: local midnight of the first day / of the day after the last day, in `tz` |
| `all_day` | INTEGER NOT NULL | 0/1 |
| `tz` | TEXT NOT NULL | the zone the organizer worked in (defaults to the calendar's) |
| `local_start` / `local_end` | TEXT | wall-clock `YYYY-MM-DDTHH:MM` in `tz`, kept for recurrence expansion and DST |
| `rrule` | TEXT | RFC 5545 subset (section 4); NULL = single |
| `series_until` | TEXT | UTC end of the series (from COUNT/UNTIL or the horizon), for indexing |
| `exdates` | TEXT (JSON) | local start datetimes removed from the series |
| `holiday_skip` | INTEGER NOT NULL | 0/1: skip occurrences on `special_days` holidays |
| `override_of` | TEXT | for a moved/edited single occurrence: the series id |
| `override_start` | TEXT | the ORIGINAL local start of the occurrence this row replaces (RECURRENCE-ID) |
| `state` | TEXT NOT NULL | section 7: `pending` \| `confirmed` \| `rejected` \| `withdrawn` \| `expired` \| `cancelled` \| `displaced` \| `done` |
| `organizer_user_id` | TEXT NOT NULL | the Arx user who created it (for projections: the system principal) |
| `on_behalf_kind` | TEXT NOT NULL | `self` \| `team` \| `class` \| `customer` \| `department` \| `vendor` |
| `on_behalf_label` | TEXT | 0-80 chars, the label that stays after retention (D10), e.g. "חוג קרמיקה" |
| `headcount` | INTEGER | 1-2000 |
| `equipment_req` | TEXT (JSON) | requested equipment keys |
| `maint_overlap_mode` | TEXT | maintenance only: the mode decided for THIS window (`override_notify` \| `block`), written at save |
| `expected_deviation` | TEXT (JSON) | maintenance only: `{"devices": [...], "areas": [...], "note": "..."}` - read by alert rules later (off by default) |
| `source` | TEXT NOT NULL | `arx` \| `ics` \| `google` \| `microsoft` \| `ticket` \| `maintenance` |
| `source_ref` | TEXT | ticket visit id / maintenance task id / external uid |
| `visitor_invite_id` | TEXT | **D9: nullable, always NULL in phases 1-7**; FK-shaped reference to `visitor_invites.id` when the visitor module and the WisKey write permit exist |
| `automation_hold` | INTEGER NOT NULL | 0/1: the organizer asked to NOT fire room automations for this booking (e.g. a vacant-room inspection) |
| `created_by`, `created_at`, `updated_by`, `updated_at`, `revision` | | |

### 3.3 `cal_event_rooms` - rooms held by an event of another calendar

A team or event-calendar entry can hold one or more rooms ("the classes team asks for the gym"). Each row is the room-side half of the
same event and has its own approval state, because the ROOM's manager decides.

| Column | Notes |
|---|---|
| `event_id`, `room_calendar_id` | PK pair; `room_calendar_id` must be a `room` calendar |
| `state` | the room-side state (section 7); the event is shown on the room only while `pending` or `confirmed` |
| `decided_by`, `decided_at`, `decision_note` | |

A booking created directly IN a room calendar has no row here (its own `state` is the room state).

### 3.4 `cal_members` - per-calendar roles (D5)

| Column | Notes |
|---|---|
| `calendar_id` | |
| `subject_kind` | `user` \| `role` (an Arx role id, built-in or custom) \| `department` (a tickets department: every member) \| `everyone` (every holder of `calendar.view` in scope) |
| `subject_id` | user id / role id / department id / `*` |
| `cal_role` | `view` \| `book` (create own) \| `edit` (edit all) \| `manage` (manage + approve) |
| `added_by`, `added_at` | |

PK (`calendar_id`, `subject_kind`, `subject_id`). The effective calendar role of a principal is the highest role among the rows that
match it, capped by the installation permissions (section 6.2). At most 300 rows per calendar.

### 3.5 `cal_approvals` - the decision log (append-only)

`id, event_id, room_calendar_id (NULL = the event's home calendar), action (request|approve|reject|withdraw|expire|reopen),
actor_user_id (NULL = system), note (0-300), at`. Never edited, kept with the event.

### 3.6 `cal_guest_details` - personal data, separate on purpose (D10)

| Column | Notes |
|---|---|
| `event_id` | PK part |
| `seq` | PK part, 1..20 guests per event |
| `name_sealed` | name, sealed with the installation key (the `connection_store` AES-GCM `v1:` format, associated data `cal_guest|<event>|<seq>|name`) |
| `phone_sealed` | E.164 phone, sealed the same way (`...|phone`) |
| `phone_index` | keyed HMAC of the normalised phone (the directory's keyed-index helper) - for dedupe only, never reversible |
| `erase_after` | UTC: the end of the event (series: the end of the LAST occurrence) + `calendar.guest_retention_days` |
| `erased_at` | set by the retention job; the sealed columns become NULL |

The label (`cal_events.on_behalf_label`) is NOT personal data by rule: the UI hint says "שם קבוצה או ארגון, לא שם של אדם".

### 3.7 Sync tables (phases 4-6; created in the phase 1 migration so the model is stable)

- `cal_connections` - `id, provider (ics_out|ics_in|google|microsoft), label, owner_user_id (the person who connected it), account_hint
  (masked e-mail / feed host, display only), token_ref (name in the secrets store; NULL for ics_out), scope (read|read_write), state
  (ok|needs_reauth|error|paused|revoked), last_sync_at, next_sync_at, error_code, error_text_sanitised, created_at, revision`.
- `cal_sync_bindings` - `id, connection_id, calendar_id, external_calendar_id_ref (sealed), direction (export|import|two_way),
  detail (busy|titles|details), dedicated (0/1; two_way requires 1), sync_token_sealed, created_by, revision`. One binding per calendar.
- `cal_sync_map` - `event_id, binding_id, ext_uid, ext_etag, last_pushed_revision, last_pulled_at, origin (arx|external)`; PK
  (`binding_id`, `ext_uid`); unique (`event_id`, `binding_id`).
- `cal_feeds` - outgoing iCal feeds: `id, calendar_ids (JSON), detail (busy|titles), token_hash (SHA-256; the token is shown ONCE),
  created_by, created_at, last_used_at, revoked_at, rate_bucket`.

### 3.8 `cal_settings` - one settings document (key `calendar.settings`), section 11.

### 3.9 Indexes

`cal_events(calendar_id, starts_at)`, `cal_events(calendar_id, series_until)` for series, `cal_events(state)`,
`cal_event_rooms(room_calendar_id, state)`, `cal_guest_details(erase_after) WHERE erased_at IS NULL`, `cal_members(subject_kind, subject_id)`.

### 3.10 Materialised occurrences

`cal_occurrences(event_id, occ_start, occ_end, local_start, room_calendar_id NULL, state)` - a cache of expanded occurrences for the
next 400 days and the past 30 days, rebuilt per series in the same transaction as any write to it, and by a nightly job that rolls the
window. Conflict checks, the automation clock and feeds read this table; it is never the source of truth (dropping it and rebuilding
gives the same rows - a test asserts this).

## 4. Recurrence

Storage: the RRULE text (RFC 5545) on the series row + `exdates` + override rows. Supported subset (anything else is `422 rrule_unsupported`):

- `FREQ=DAILY|WEEKLY|MONTHLY|YEARLY`, `INTERVAL=1..52`;
- `BYDAY` (weekly: list of days; monthly: one ordinal day such as `2TU` or `-1FR`), `BYMONTHDAY` (1..31, -1), `BYMONTH`;
- `COUNT=1..500` OR `UNTIL` (local date, stored as the end of that local day in UTC); no COUNT/UNTIL = open series, expanded to
  `calendar.series_horizon_days` (default 400) and re-expanded nightly;
- not supported: `BYHOUR`, `BYMINUTE`, `BYSETPOS` with several values, `BYWEEKNO`, `BYYEARDAY`, `RDATE`, sub-daily frequencies.

Rules:
1. **Wall-clock**: occurrences are generated in LOCAL time in the event's `tz` (`local_start` + rule), then converted per occurrence to UTC
   with the same helper as `services/tickets/hours._local_instant`. A Tuesday 18:00 class stays 18:00 across DST.
   A local time inside a spring-forward gap resolves to the first instant after the gap; in the repeated autumn hour the FIRST
   instant is used. Duration is wall-clock duration (an 18:00-20:00 occurrence on a change night lasts 1 h or 3 h of real time only if
   the change falls inside it - documented, tested).
2. **Monthly on the 31st**: months without that day are skipped (RFC behaviour), with a UI hint; `BYMONTHDAY=-1` offers "last day".
3. **Holiday skip** (`holiday_skip=1`): an occurrence whose local date is a `holiday` from `services/special_days` (generator + the
   manager's overrides) is not generated; it shows as a ghost "דילוג - חג" in the series editor. `holiday_eve` is not skipped unless the
   calendar's `holiday_rule` says `closed` on eves (setting, question 19.8).
4. **Edits** take a scope: `occurrence` (writes an override row; RECURRENCE-ID = `override_start`), `following` (splits the series:
   the old series gets `UNTIL` before this occurrence, a new series row starts here; overrides after the split move to the new
   series when their original start still matches), `series` (rewrites the rule; overrides whose original start no longer exists
   become orphans and are listed to the editor as "שינויים שיאבדו: N" before saving - never silently dropped).
5. **Cancel** takes the same scope: `occurrence` adds an EXDATE (or cancels its override row), `following` cuts the series,
   `series` cancels the series row.
6. **Past occurrences are immutable** except `state` (`done`, `cancelled` after the fact is refused) and `notes`.
7. Expansion limit: at most 2000 occurrences per series in the window; more is `422 series_too_large`.

Library: phase 1 picks either `python-dateutil`'s `rrule` (whether it is already a dependency is NOT verified here) or a small in-repo expander
limited to the subset above. Decision rule: whatever passes the golden DST/holiday tests with the smaller dependency surface; the choice
goes through `docs/security/DEPENDENCY_AND_SECRETS_AUDIT.md`.

## 5. Time zones

- Instants are UTC; local values carry their zone. No fixed offsets anywhere (AGENTS.md).
- A calendar's `tz` defaults to the installation `time.zone`. An event's `tz` defaults to its calendar's.
- Views render in the VIEWER's display zone (the installation zone in v1; a per-user zone is a later option). An event whose `tz`
  differs from the view zone shows a small zone chip ("לפי שעון לונדון 10:00").
- Changing a calendar's `tz` never moves existing instants; future recurring series keep their own `tz` (the organizer re-saves to
  move them). The settings screen warns with the count of series in the old zone.
- All-day events are local dates in their `tz`; they are shown on the same local date in any view zone (not shifted).
- Open hours, buffers that cross midnight, and lead/horizon limits are evaluated in the CALENDAR's `tz`.
- Feeds and providers receive `DTSTART;TZID=...` with a `VTIMEZONE` for recurring events and UTC for single events.

## 6. Permissions

### 6.1 New installation permissions (the `PERMISSION_LABELS` catalogue in `routers/access.py`)

Naming follows the repo convention `<module>.<verb>` / `<module>.<object>.<verb>` (compare `tickets.manage`, `notices.boards`,
`access.windows.manage`). Hebrew labels use the module token `{calendar}` like the tickets labels use `{module}` only if the owner wants
the module renamable (question 19.10); otherwise plain "יומנים:".

| Permission | Hebrew label | Meaning | Built-in roles | Sensitive / delegable |
|---|---|---|---|---|
| `calendar.view` | יומנים: צפייה | Open the calendar area; see calendars per their visibility and the person's calendar roles | viewer, operator, editor, site_admin, system_admin | no / delegable |
| `calendar.book` | יומנים: יצירת אירועים והזמנות שלי | Create, edit and cancel OWN entries in calendars where the person's calendar role is `book` or higher | operator, site_admin, system_admin | no / delegable |
| `calendar.book_for_others` | יומנים: הזמנה בשם צוות, חוג או לקוח | Use `on_behalf_kind` other than `self`; enter guest details (name, phone) | site_admin, system_admin | no / delegable |
| `calendar.manage` | יומנים: ניהול יומנים (יצירה, מנהלים, תפקידים) | Create / edit / archive calendars, set the manager, edit `cal_members` of calendars in scope | site_admin, system_admin | no / not delegable by default |
| `calendar.maintenance` | יומנים: חלונות תחזוקה (גוברים על הזמנות) | Place maintenance windows and blocks; may displace bookings per the overlap setting | site_admin, system_admin | **yes** / not delegable by default |
| `calendar.guests` | יומנים: צפייה בפרטי אורחים (שם וטלפון) | Read the sealed guest name/phone of entries the person can see in full | system_admin (calendar managers hold it implicitly for their calendars, section 6.2) | **yes** / not delegable |
| `calendar.configure` | יומנים: הגדרות המודול | The settings document (overlap behaviour, retention, defaults, module switch) | system_admin | no / not delegable |
| `calendar.connect` | יומנים: חיבור יומנים חיצוניים ופידים | Add / authorise / pause / remove connections and feeds; bind calendars | system_admin | **yes** / never delegable |

New single-permission grant roles (pattern of `tickets_*` / `notices_*`): `calendar_booker` (`calendar.view` + `calendar.book`),
`calendar_on_behalf` (`calendar.book_for_others`), `calendar_manager` (`calendar.manage`), `calendar_maintenance`
(`calendar.maintenance`). `DEFAULT_DELEGABLE` gains `calendar_booker` and `calendar_on_behalf` only. A fifth grant role `calendar_connect` (`calendar.connect`, C10) exists for the owner to hand out; it is not delegable.
`sensitive_permissions_not_implied` (roles.json) gains `calendar.maintenance`, `calendar.guests`, `calendar.connect`.
`calendar.connect` joins the owner-only set reviewed with `SYSTEM_PERMISSIONS` (question 19.11).

### 6.2 Per-calendar roles (`cal_members.cal_role`) and how they combine

Rights are cumulative: `view` < `book` < `edit` < `manage`.

| Action | Needs installation permission | AND calendar role |
|---|---|---|
| See the calendar in the switcher and its entries (titles per visibility) | `calendar.view` | `view`+ (or the calendar's `visibility` is `busy_to_all` / `details_to_all`) |
| See busy blocks only (no title, no organizer) | `calendar.view` | none, when `visibility = busy_to_all` |
| Create an own entry (booking / event) | `calendar.book` | `book`+ |
| Create on behalf of a team / class / customer / department | `calendar.book` + `calendar.book_for_others` | `book`+ |
| Edit / cancel OWN entry | `calendar.book` | `book`+ (and the entry is not past) |
| Edit / cancel ANY entry; book inside `lead_min` / beyond `horizon_days`; override min/max duration | `calendar.book` | `edit`+ |
| Approve / reject requests; edit calendar rules (hours, buffers, approval mode, color, members) | `calendar.view` (`calendar.manage` NOT required for his own calendars) | `manage` |
| Create a calendar; archive; change `owner_user_id` | `calendar.manage` | - |
| Place a maintenance window on a calendar | `calendar.maintenance` | `view`+ on every affected calendar (he must see what he displaces) |
| Read guest name / phone | `calendar.guests` OR `manage` on that calendar | `view`+ |
| Bind the calendar to a sync connection | `calendar.connect` | - |

Rules:
1. A role row never grants more than the installation permissions allow: a `manage` member without `calendar.book` can approve but not
   create (by design: an approver may be an office manager who books nothing).
2. `owner_user_id` always has an implicit `manage` row (cannot be removed while he is the owner).
3. `system_admin` has implicit `manage` everywhere (audited as such). `site_admin` has implicit `edit` on calendars inside his scope.
4. A deny binding (rbac) that removes `calendar.view` hides every calendar regardless of members.
5. Member subjects of kind `role` and `department` are evaluated at request time (adding a person to a department gives him the calendar
   role at once; removing takes it away).
6. "Book on behalf" never creates an Arx identity for the customer/class; the party is a label (+ optional guest details, section 9).

### 6.3 What each viewer sees of one entry

| Viewer | Title | Notes | Organizer | On-behalf label | Guest name/phone |
|---|---|---|---|---|---|
| Organizer | yes | yes | yes | yes | with `calendar.book_for_others` (he entered them), until erased |
| `edit` / `manage` member | yes | yes | yes | yes | `manage` only (or `calendar.guests`) |
| `view` / `book` member | yes | no | yes | yes | no |
| Busy-to-all viewer | "תפוס" | no | no | no | no |

### 6.4 Scope

Calendars with a `floor_id` are judged at that floor's scope (`require(principal, perm, ("floor", floor_id))`); calendars without one at
installation scope. A floor-scoped operator sees only room calendars on his floors plus installation-wide calendars where he is a member.
Absent, never masked: a calendar outside scope is not in the list (no "hidden calendar" placeholder) and its id answers the uniform 404.

### 6.5 Audit

Every write is audited with ids only: `calendar.calendar.create|update|archive|restore`, `calendar.members.update`,
`calendar.event.create|update|cancel` (+ `scope`), `calendar.request.decide`, `calendar.maintenance.place` (+ displaced count),
`calendar.guests.read` (each read of sealed details), `calendar.guests.erase` (counts per run), `calendar.settings.update`,
`calendar.connection.add|authorize|pause|remove`, `calendar.binding.set`, `calendar.feed.create|rotate|revoke`. Titles, notes, names and
phones never enter the audit log.

## 7. Approval and entry states (D6)

```
create --(approval needed)--> pending --approve--> confirmed --end passes--> done
create --(no approval)------> confirmed
pending  --reject--> rejected     pending --withdraw--> withdrawn     pending --timeout--> expired
confirmed --cancel--> cancelled   confirmed --maintenance wins--> displaced --rebook/cancel--> cancelled (+ a new entry)
rejected | expired | withdrawn --reopen (manager, 7 days)--> pending
```

| From | Event | To | Who | Notification |
|---|---|---|---|---|
| (new) | create, approval needed | `pending` | booker | `calendar.request.new` -> the calendar's `manage` members |
| (new) | create, no approval needed | `confirmed` | booker | none (optional confirmation to organizer, setting) |
| `pending` | approve | `confirmed` | `manage` | `calendar.request.approved` -> organizer |
| `pending` | reject (note 0-300, optional) | `rejected` | `manage` | `calendar.request.rejected` -> organizer, with the note |
| `pending` | withdraw | `withdrawn` | organizer | none |
| `pending` | `approval_timeout_h` before start | `expired` | system | `calendar.request.expired` -> organizer and managers |
| `pending` | edited by organizer (time/room) | `pending` (new request row) | organizer | `calendar.request.changed` -> managers |
| `confirmed` | edited by organizer, approval needed for the NEW time | `pending` | organizer | as create; the old slot is released only on approval (a test) |
| `confirmed` | cancel | `cancelled` | organizer / `edit`+ | `calendar.booking.cancelled` -> organizer if someone else cancelled |
| `confirmed` | maintenance placed over it (mode `override_notify`) | `displaced` | system | `calendar.booking.displaced` -> organizer, with 3 free alternative slots |
| `displaced` | organizer picks an alternative | the new entry follows the normal create path; the old one becomes `cancelled` | organizer | as create |
| `confirmed` | end passes | `done` | system | none |
| `rejected` / `expired` / `withdrawn` | reopen by manager within 7 days | `pending` | `manage` | `calendar.request.new` |

Rules:
- (Changed by C2.) A `pending` entry does NOT hold its slot by default: the first `confirmed` entry holds it, and a later overlapping request
  becomes a `pending`, `contested` request for the manager (setting `calendar.contested_requests`, default `queue`; `reject` answers
  `409 conflict`). Approving a contested request while a confirmed entry still holds the window needs `displace_existing: true`
  (the earlier entries become `displaced`, their organizers choose an alternative) - otherwise `409 slot_held`. Setting
  `calendar.pending_holds_slot` (default **false**; true = pending entries block others, the pre-round-6 behaviour).
- Approve re-checks conflicts inside the transaction (a maintenance window may have arrived meanwhile).
- An event holding rooms (3.3): each room row is decided independently; the event is "חלקית מאושר" until every room row is decided;
  the organizer may drop a rejected room and keep the rest.
- Recurring requests: one decision for the whole series by default; the manager may approve the series and reject single occurrences
  (EXDATE with a reason) - shown to the organizer as "אושר למעט 2 מועדים".
- Editors (`edit`+) and managers bypass approval on their own calendar (setting `calendar.editors_bypass_approval`, default true).

## 8. Maintenance windows over existing bookings (D7)

A maintenance window is a `cal_events` row with `kind = maintenance` in a calendar of type `maintenance`, holding one or more ROOM
calendars through `cal_event_rooms` (state `confirmed` immediately - the maintenance planner's right comes from `calendar.maintenance`,
not from the room's approval) and optionally a device/area list in `expected_deviation`.

Installation setting `calendar.maintenance_overlap` (per-calendar `overlap_override` may narrow it):

| Value | Hebrew (settings) | Behaviour when the window overlaps confirmed/pending entries |
|---|---|---|
| `first_holds` (**default**, C3) | הראשון שאושר מחזיק, התחזוקה מחכה להחלטת המנהל | Save succeeds as `pending` + `contested`; nothing is displaced until the manager approves with `displace_existing` |
| `override_notify` | התחזוקה גוברת ומודיעים למארגנים | Save succeeds; every overlapping entry (incl. buffers) becomes `displaced`; organizers get `calendar.booking.displaced` with alternatives; managers of the rooms get a digest |
| `block` | אי אפשר להציב תחזוקה מעל הזמנה | Save is refused: `409 maintenance_overlap` with the list of overlapping entries (title only if visible to the planner, else "תפוס") and the nearest free windows of the same length |
| `ask` | לשאול בכל חלון | The dialog shows the overlap list and asks: "התחזוקה גוברת" or "לא להציב"; the chosen mode is stored in `maint_overlap_mode`; the API requires `overlap_decision` in the body when overlaps exist (`422 overlap_decision_required` otherwise) |

Rules:
- The preview endpoint (`POST /calendar/maintenance/preview`) returns the overlap list for the dialog BEFORE saving; the warning is
  always shown in every mode (the mode only decides what saving does).
- Displaced entries are never deleted; a displaced recurring series displaces only the overlapping occurrences (override rows with
  `state = displaced`).
- Moving or cancelling the maintenance window does NOT restore displaced entries automatically; it notifies their organizers "החדר
  התפנה שוב" with a one-tap "להחזיר" that re-runs the create path (conflicts and approval apply again).
- A per-calendar `overlap_override` may hold any of the three values (e.g. a gym that is never displaced while the installation
  default is "wins"). Whether it may also be LOOSER than the installation value is question 19.4; the contract assumes "any value".
- Maintenance windows on calendars with `conflict_policy = overlap` (team/event) never displace; they show as an overlay.

## 9. Guest details and retention (D10)

- Entry: only with `calendar.book_for_others`, only when `on_behalf_kind` is `customer` or `class` (setting decides which kinds may carry
  details), up to 20 guests, name 1-80, phone E.164 (Israeli local formats normalised). A privacy hint is shown in the dialog.
- Storage: sealed columns in `cal_guest_details` (3.6); never in `cal_events`, never in notifications, feeds, provider pushes, logs,
  audit rows, exports or automation payloads.
- Retention: `calendar.guest_retention_days` - default **30**, 0-3650, owner-configurable (`calendar.configure`; C4: `0` = erase when the entry
  ends). `POST /calendar/guests/purge` destroys every guest record now. The dialog does not offer guest fields when
  `calendar.guest_details_enabled` is false.
  `erase_after = end of the event (series: end of the last occurrence, recomputed when the series is cut or extended) + N days`.
- The janitor step `calendar_retention.janitor()` is called from `main.janitor_tick` at most once an hour per process (pattern of
  `services/pending_retention.py`): it NULLs the sealed columns and `phone_index`, sets `erased_at`, one transaction per event, one audit row
  per run with counts only. A failure is logged by type and never stops the tick.
- Changing N applies to rows not yet erased (recomputes `erase_after`); lowering it may erase on the next run - the settings save shows
  "N רשומות יימחקו בהרצה הבאה" and needs a confirm.
- Cancelled / rejected / withdrawn / expired entries: `erase_after = the decision time + N` (they never happened).
- The label (`on_behalf_label`) stays. A data-subject request ("erase me now") is served by an `edit`+ member or `calendar.guests`
  holder: `DELETE /calendar/events/{id}/guests` (audited).

## 10. Integration points inside Arx

### 10.1 Tickets (CR-038, CR-SVC215, SLACAL)

- **Visit projection:** every planned vendor visit (`tickets_visits`) is projected into ONE maintenance calendar chosen per department
  (setting `calendar.ticket_visit_calendar_by_department`, map department id -> calendar id; none = not projected). Projection row:
  `kind = ticket_visit`, `source = ticket`, `source_ref = visit id`, title = the ticket's short title (visible only to people who can see
  the ticket: viewers without ticket visibility see "ביקור ספק" only). Written in the SAME transaction as the visit change (store_visits
  hook). The projection is read-only in the calendar: "edit" opens the ticket drawer. The tickets tables stay authoritative.
- **Room hold for a visit:** a visit may carry a room (`location` -> room calendar via `area_ref`); then the projection holds that room
  like a maintenance window (the overlap setting applies).
- **Slot picker:** the ticket drawer's "תזמון ביקור" reuses the calendar's free-slot endpoint with the department's working hours (SLACAL)
  and vendor send hours (hours.py) as constraints; the result is the existing `POST /tickets/{id}/visits` body.
- **Working hours and holidays:** `hours_mode = working_hours` reads the SLACAL document (installation or department) through
  `work_calendar.is_working` / windows; holidays come from `special_days` (one source of truth, never a second list).

### 10.2 Maintenance module (CR-MAINT215)

- Tasks with a due date are projected as all-day `maint_task` entries into a chosen maintenance calendar (setting
  `calendar.maintenance_task_calendar`); state colour = the task's due state (ok / due_soon / overdue - status colours, the only place
  green appears: "בוצע").
- "Schedule this task" on a task creates a maintenance window linked by `source_ref` (the task's own date logic is unchanged).
- Rounds (`round`) may be shown as recurring entries from their fixed schedule (read-only).

### 10.3 Automations (D8) - contract only

New Arx-side trigger SOURCE `calendar`, fired by the calendar clock from `cal_occurrences`:

| Trigger key | Parameters | Fires |
|---|---|---|
| `calendar.booking_starts` | `offset_min` -120..+60 (negative = before), calendar ids or types, `kinds` | once per occurrence at start+offset |
| `calendar.booking_ends` | `offset_min` -60..+120 | once per occurrence at end+offset |
| `calendar.room_free` | `free_for_min` 5..240 | when a room calendar has no entry for the next N minutes after an entry ended |
| `calendar.room_occupied_changes` | - | entering/leaving "a confirmed entry is running now" |
| `calendar.maintenance_opens` / `calendar.maintenance_closes` | calendar ids | at window start / end |
| `calendar.request_pending` | calendar ids | a new pending request (for notification-style automations only) |

Delivery: the calendar clock publishes a content-free event to the automation engine - `smplwise_arx_calendar` with
`{trigger, calendar_id, room_area_id, occurrence_id, offset_min, kind}` (no title, no organizer, no guest data). The automation builder
gets a typed "יומן" trigger block that compiles to a generic event trigger filtered on those fields (stable shape, CR-017 rule "write
generic triggers"). Missed fires after downtime: a trigger is fired late only if it is less than `calendar.automation_late_grace_min`
(default 5) late; otherwise skipped and logged (never a burst of old fires - AGENTS.md "never queue physical commands after reconnect").
`automation_hold = 1` on an entry suppresses all its triggers.

Disabled templates shipped (each is an automation draft, `enabled = false`, the owner arms it; CR-019 protected-switch rules apply):
1. "לפני ישיבה: מיזוג" - `booking_starts` -30 -> climate of the room's area to the comfort preset.
2. "לפני ישיבה: תאורה" - `booking_starts` -5 -> lights of the area on.
3. "אחרי ישיבה בלי תנועה: כיבוי" - `booking_ends` +10 AND no motion in the area for 10 min -> lights off, climate eco.
4. "חדר פנוי שעה: חיסכון" - `room_free` 60 -> climate eco.
5. "חלון תחזוקה: השתקת התראות" - `maintenance_opens` -> mark the window's devices "expected deviation" (consumed by alert rules later).
No booking ever writes to a device directly; only an armed automation does.

### 10.4 Schedules (CR-014)

A booking is never a schedule object. Schedules may READ "is the room booked now" as a condition later (a condition block
`calendar.room_booked`, question 19.12). The week-grid visual component is shared.

### 10.5 Visitors / WisKey (D9)

`cal_events.visitor_invite_id` stays NULL. When CR-VISITOR105 is ON and the WisKey write permit exists, a later task adds "להזמין את
האורח" which creates a visitor invitation for the occurrence window + buffers through the visitor module's own route and authority;
the calendar module never talks to WisKey.

### 10.6 Notifications (CR-018) - new sources

| Source key | Hebrew label | Who | Severity | Default channels |
|---|---|---|---|---|
| `calendar.request.new` | יומנים: בקשה חדשה לאישור | `manage` members of the calendar | info | inbox, push, app |
| `calendar.request.changed` | יומנים: בקשה עודכנה | same | info | inbox |
| `calendar.request.approved` | יומנים: הבקשה אושרה | organizer | info | inbox, push, app |
| `calendar.request.rejected` | יומנים: הבקשה נדחתה | organizer | info | inbox, push, app |
| `calendar.request.expired` | יומנים: בקשה פגה | organizer + managers | info | inbox |
| `calendar.booking.displaced` | יומנים: הזמנה נדחקה בגלל תחזוקה | organizer | alert | inbox, push, app |
| `calendar.booking.cancelled` | יומנים: הזמנה בוטלה על ידי אחר | organizer | info | inbox |
| `calendar.booking.freed` | יומנים: החדר התפנה שוב | organizers of displaced entries | info | inbox |
| `calendar.booking.reminder` | יומנים: תזכורת לפני הזמנה | organizer (opt-in per user) | info | app |
| `calendar.sync.failed` | יומנים: סנכרון נכשל | the connection's owner | alert | inbox, e-mail |
| `calendar.sync.needs_reauth` | יומנים: נדרש חיבור מחדש | the connection's owner | alert | inbox, e-mail |

Payloads carry the calendar name, the local date/time and the room name - never notes, guest names or phones. Quiet hours and the
notification policy apply unchanged.

### 10.7 Mobile app (CR-027)

Phase 7: "ההזמנות שלי", a room's day, approve/reject from the app channel push (the decision needs a fresh app session; the same API).

## 11. Settings (`calendar.settings`, `calendar.configure`, audited `calendar.settings.update`)

```json
{ "enabled": false,
  "maintenance_overlap": "first_holds",
  "contested_requests": "queue",
  "menu_position": "a",
  "holiday_eve_as_holiday": false,
  "guest_details_enabled": true,
  "guest_details_kinds": ["customer", "class"],
  "guest_retention_days": 30,
  "pending_holds_slot": false,
  "editors_bypass_approval": true,
  "default_room_buffer_after_min": 10,
  "series_horizon_days": 400,
  "max_calendars": 500,
  "automation_late_grace_min": 5,
  "ticket_visit_calendar_by_department": {},
  "maintenance_task_calendar": null,
  "notify_confirmations": false,
  "feeds_enabled": false }
```
A save replaces the document; missing keys read as defaults; a corrupt document reads as defaults with `enabled: false` (fail closed).
Every threshold is a setting (the owner's standing rule).

## 12. Sync adapters (D2, D4)

### 12.1 Order and modes

| Phase | Provider | Mode | Accounts |
|---|---|---|---|
| 4a | iCal OUT (`ics_out`) | Arx publishes a secret-URL feed per selected calendars; read-only for subscribers | none |
| 4b | iCal IN (`ics_in`) | Arx subscribes to an https iCal URL into a dedicated `external` calendar (busy blocks or titles); read-only | none (the URL is a secret, sealed) |
| 5 | Google Calendar | export first, then two-way on dedicated calendars | the owner's own Google Cloud project + OAuth client + consent, done by the owner |
| 6 | Microsoft 365 / Outlook (Graph) | export first, then two-way on dedicated calendars | the owner's own Entra app registration + consent, done by the owner |

D4: until the owner switches a binding to `two_way`, every binding is `export` or `import`. `two_way` is refused unless the binding is
`dedicated = 1` (a calendar created for Arx or nominated by the owner as dedicated, never a personal calendar).

### 12.2 Interface (Python, `services/calendar_sync/adapter.py`)

```python
class SyncAdapter(Protocol):
    provider: Literal["ics_out", "ics_in", "google", "microsoft"]

    def health(self, conn: Connection) -> Health: ...            # ok | needs_reauth | error(code)
    def list_calendars(self, conn: Connection) -> list[ExtCalendar]: ...   # id_ref, name, can_write, is_primary
    def pull(self, binding: Binding, since_token: str | None) -> PullResult: ...
        # -> changes: list[ExtEvent | ExtDeletion], next_token, full_resync_required: bool
    def push(self, binding: Binding, event: OutEvent) -> PushResult: ...    # create or update; returns ext_uid, etag
    def delete(self, binding: Binding, ext_uid: str, etag: str | None) -> None: ...
    def revoke(self, conn: Connection) -> None: ...               # best effort at the provider, then local delete
```
- `OutEvent` is built by ONE mapper per binding detail level: `busy` -> title "תפוס", no description, no location;
  `titles` -> title + room name; `details` -> + notes (never guests). An Arx marker (Google `extendedProperties.private.arx_id`,
  Graph `singleValueExtendedProperties`, ICS `X-ARX-ID`) is set on every pushed event.
- `pull` ignores events carrying our marker whose `etag` equals `cal_sync_map.ext_etag` (loop prevention).
- A `FakeAdapter` (in-memory provider with sync tokens, etags, 410-gone resync, rate-limit errors) drives every contract test; no test
  calls a real provider.

### 12.3 Scheduling

Polling only (no inbound webhook = no new public surface): every `poll_min` (default 5, 2-60) per connection, jittered; exponential
backoff to 60 min on errors; `410 / invalid sync token` -> full resync of the window; at most one sync per connection at a time
(lease row). Manual "סנכרן עכשיו" is rate-limited (1/min).

### 12.4 Two-way rules (dedicated calendars only)

- (Superseded by C9: external changes are accepted both ways; a conflict keeps BOTH entries and flags them. The rule below is the pre-round-6 text and is NOT built.) Room and maintenance calendars: **Arx wins**. An external create/edit that conflicts or violates hours/approval is not applied; the
  external event is reverted (for an edit) or deleted (for a create) and the connection owner gets a notice. An external create that
  passes the rules becomes a booking `pending` (if the calendar needs approval) or `confirmed`, organizer = the connection owner, label
  "מיומן חיצוני".
- Team / event calendars: last writer by provider `updated` vs Arx `updated_at`, ties -> Arx.
- Recurring events from providers are imported as series when the RRULE is inside the supported subset, otherwise expanded into single
  occurrences for the window (flagged `source_series_unsupported`).
- Ticket / maintenance projections are export-only; external edits to them are reverted.

### 12.5 Owner setup (documented for the owner, never done by Arx)

Google: create a Google Cloud project, enable Calendar API, create an OAuth client (web), set the redirect URL Arx shows, add himself as
test user, paste client id/secret into Arx (secrets store), press "התחבר" and complete consent in his browser. Microsoft: an Entra app
registration, redirect URL, delegated `Calendars.ReadWrite` (or `Calendars.Read`), client secret into Arx, consent. Arx shows these
steps as a checklist; it creates nothing at the provider.

## 13. API (all under the module gate; JSON; errors `{code, message_he, details}`; every write audited)

Order of checks on every route: signed in -> module switch (404) -> calendar visibility (uniform 404) -> role/permission (audited 403)
-> validation (422) -> conflict (409).

### 13.1 Calendars

| Method | Path | Who | Request | Response |
|---|---|---|---|---|
| GET | `/calendar/calendars` | `calendar.view` | `?type=&include_archived=0` | `{calendars:[{id,name,type,color,tz,owner:{id,name},my_role,visibility,approval_mode,capacity,floor_id,area_ref,sync:{state,provider,direction}\|null,pending_count}]}` |
| POST | `/calendar/calendars` | `calendar.manage` | `{name,type,color,tz?,owner_user_id,area_ref?,capacity?,equipment?,conflict_policy?,buffer_before_min?,buffer_after_min?,slot_step_min?,min_minutes?,max_minutes?,lead_min?,horizon_days?,hours_mode?,hours_json?,holiday_rule?,approval_mode?,approval_timeout_h?,overlap_override?,visibility?}` | `201 {calendar}` |
| GET | `/calendar/calendars/{cid}` | `view`+ | - | `{calendar, members_summary, rules}` |
| PATCH | `/calendar/calendars/{cid}` | `manage` (owner change: `calendar.manage`) | `{revision, ...fields}` | `{calendar}`; `409 stale` |
| POST | `/calendar/calendars/{cid}/archive` / `restore` | `calendar.manage` | `{revision}` | `{calendar}`; archive refused with future confirmed entries unless `{cancel_future:true}` (organizers notified) |
| GET | `/calendar/calendars/{cid}/members` | `manage` | - | `{members:[{subject_kind,subject_id,label,cal_role}]}` |
| PUT | `/calendar/calendars/{cid}/members` | `manage` | `{revision, members:[...]}` (whole list) | `{members}` |

### 13.2 Entries

| Method | Path | Who | Request | Response |
|---|---|---|---|---|
| GET | `/calendar/occurrences` | `calendar.view` | `?from=&to=` (UTC, max 62 days) `&calendars=cid,cid&kinds=&states=` | `{occurrences:[{occurrence_id, event_id, calendar_id, room_calendar_ids, start, end, all_day, title\|null, state, kind, on_behalf_label\|null, organizer\|null, recurring, can:{edit,cancel,approve}}], truncated}` |
| GET | `/calendar/rooms/day` | `calendar.view` | `?date=YYYY-MM-DD&calendars=` | the resource timeline: `{rooms:[{calendar_id,name,capacity,equipment,open:[{from,to}],entries:[...]}]}` |
| POST | `/calendar/availability` | `calendar.view` | `{from,to,duration_min,headcount?,equipment?,types:["room"],calendars?}` | `{free:[{calendar_id,start,end}], nearest:[...]}` (max 20) |
| POST | `/calendar/events` | `calendar.book` + `book`+ | `{calendar_id, kind:"booking"\|"event", title, notes?, start, end, all_day?, tz?, rrule?, holiday_skip?, rooms?:[cid], on_behalf:{kind,label}?, headcount?, equipment_req?, guests?:[{name,phone}], automation_hold?}` | `201 {event, state:"pending"\|"confirmed", requests:[{room_calendar_id,state}]}`; `409 conflict {conflicts:[{calendar_id,start,end,title\|null,state}], suggestions:[{start,end}]}` |
| POST | `/calendar/events/preview` | `calendar.book` | same body | `{conflicts, needs_approval_by:[cid], outside_hours, holiday_hits, capacity_ok}` - no write |
| GET | `/calendar/events/{eid}` | visible | `?occurrence=` | `{event, occurrence?, requests, history:[approval rows], guests_count, guests_visible:bool}` |
| PATCH | `/calendar/events/{eid}` | organizer or `edit`+ | `{revision, scope:"occurrence"\|"following"\|"series", occurrence_start?, ...fields}` | `{event, orphaned_overrides?}` |
| POST | `/calendar/events/{eid}/cancel` | organizer or `edit`+ | `{revision, scope, occurrence_start?, note?}` | `{event}` |
| POST | `/calendar/events/{eid}/withdraw` | organizer | `{revision}` | `{event}` |
| GET | `/calendar/events/{eid}/guests` | `calendar.guests` or `manage` | - | `{guests:[{seq,name,phone}], erase_after}` (audited read) |
| DELETE | `/calendar/events/{eid}/guests` | `edit`+ or `calendar.guests` | - | `204` |
| GET | `/me/calendar` | `calendar.view` | `?from=&to=` | my entries and my pending requests |

### 13.3 Approvals

| Method | Path | Who | Request | Response |
|---|---|---|---|---|
| GET | `/calendar/requests` | `manage` on at least one calendar | `?state=pending&calendars=` | `{requests:[{event_id, room_calendar_id\|null, calendar:{id,name,color}, title, start, end, recurring_summary, organizer, on_behalf_label, headcount, conflicts_now, requested_at}]}` |
| POST | `/calendar/requests/{eid}/decide` | `manage` on the deciding calendar | `{room_calendar_id?, decision:"approve"\|"reject", note?, except_occurrences?:[local starts], revision}` | `{event, state}`; approve re-checks conflicts (`409 conflict`) |
| POST | `/calendar/requests/{eid}/reopen` | `manage` | `{room_calendar_id?, revision}` | `{event}` |

### 13.4 Maintenance

| Method | Path | Who | Request | Response |
|---|---|---|---|---|
| POST | `/calendar/maintenance/preview` | `calendar.maintenance` | `{calendar_id, rooms:[cid], start, end, rrule?}` | `{overlaps:[{event_id, calendar_id, start, end, title\|null, organizer\|null, state}], mode:"override_notify"\|"block"\|"ask", alternatives:[{start,end}]}` |
| POST | `/calendar/maintenance` | `calendar.maintenance` | `{calendar_id, title, notes?, rooms:[cid], start, end, rrule?, expected_deviation?, overlap_decision?:"override_notify"\|"block"}` | `201 {event, displaced:[event_id]}`; `409 maintenance_overlap`; `422 overlap_decision_required` |

### 13.5 Settings, feeds, connections

| Method | Path | Who | Notes |
|---|---|---|---|
| GET / PUT | `/calendar/settings` | `calendar.view` (read, masked) / `calendar.configure` | the document of section 11; PUT returns `{settings, erase_preview}` |
| GET / POST | `/calendar/feeds` | `calendar.connect` | POST `{calendar_ids, detail}` -> `201 {feed, url}` (the URL with its token is returned ONCE) |
| POST | `/calendar/feeds/{fid}/rotate` / `revoke` | `calendar.connect` | rotate returns the new URL once |
| GET | `/calendar/feed/{token}.ics` | public, token | 200 text/calendar; 404 for unknown/revoked/off; rate-limited per token and IP; no cookies |
| GET / POST | `/calendar/connections` | `calendar.connect` | POST `{provider, label, scope}` -> `{connection, setup_steps}`; never takes a password |
| PUT | `/calendar/connections/{id}/client` | `calendar.connect` | `{client_id, client_secret}` -> secrets store; answer `{configured:true}` only |
| POST | `/calendar/connections/{id}/authorize` | `calendar.connect` (the connection owner) | `{}` -> `{authorize_url, state}`; PKCE + state bound to the session |
| GET | `/calendar/oauth/callback` | the same browser session | exchanges the code; tokens to the secrets store; redirects to the screen |
| GET | `/calendar/connections/{id}/calendars` | `calendar.connect` | external calendars `{id_ref, name, can_write}` |
| PUT | `/calendar/calendars/{cid}/binding` | `calendar.connect` | `{connection_id, external_calendar_ref, direction, detail, dedicated}` or `null` |
| POST | `/calendar/connections/{id}/sync` | `calendar.connect` | manual sync (1/min) |
| POST | `/calendar/connections/{id}/pause` / `resume` | `calendar.connect` | |
| DELETE | `/calendar/connections/{id}` | `calendar.connect` | revoke at provider (best effort) + delete tokens; bindings removed; Arx entries stay |
| GET | `/calendar/automation/triggers` | `automation.manage` | the trigger catalogue of 10.3 for the builder |

## 14. Migration plan

- One file `0190_calendars.sql` (C13): all tables of section 3 (incl. the sync tables, empty until phases 4-6), indexes,
  the settings default row, the new permissions in the built-in roles (roles.json, not SQL) and the grant roles.
- Additive only; nothing existing is altered. The module is OFF after migration; no data is created except the settings document.
- Ticket visit / maintenance task projections are back-filled by a one-time job when the owner maps a department/maintenance calendar
  (not by the migration).
- Rollback: the module switch off hides everything; a down path drops the `cal_*` tables (no other table references them; `cal_events.
  visitor_invite_id` is a plain text column, no FK constraint into the visitor tables to keep the rollback clean).
- Backup: `cal_guest_details` sealed columns follow the backup-sensitive rules (`services/backup_sensitive.py`): excluded from an
  unencrypted export, included in an encrypted one.

## 15. Security and privacy

1. **No accounts, no passwords** (D2). Arx never creates a provider account or app registration, never asks for or stores a user
   password, never automates a consent screen. The owner pastes his OWN client id/secret and completes consent himself.
2. **Tokens** (OAuth refresh/access tokens, client secrets, iCal-in URLs, external calendar ids) live in the secrets store
   (`services/secrets_store.py` sealing, `v1:` AES-256-GCM with the per-install key) - never in the repo, fixtures, logs, audit rows, API
   responses, notifications or the UI. `cal_connections.token_ref` is a name. Answers carry `configured: true/false` and times only.
3. **Least scope:** Google: the narrowest events scope that covers the bound calendars (the exact scope string is fixed in phase 5
   after checking the provider documentation; question 19.3), read-only for `import` bindings;
   Microsoft `Calendars.Read` / `Calendars.ReadWrite` delegated; never mail, contacts or directory scopes.
4. **OAuth flow:** authorization code + PKCE, `state` bound to the user session and single use, redirect URL fixed per installation,
   callback rejects anything without a matching state. Tokens refreshed server-side only.
5. **Inbound data is untrusted:** iCal/provider titles and descriptions are text-only (no HTML, no links rendered as HTML), length-capped,
   never interpreted as commands; iCal-in URLs must be https to a public host (SSRF rules of the tickets module's outbound fetch: no
   private ranges, no redirects into them, size cap 5 MB, timeout 15 s).
6. **Feeds:** 32-byte random tokens, stored as SHA-256, shown once, rotatable/revocable, rate-limited, `busy` detail by default; never
   guest data, never notes unless `detail = titles` (titles only) - notes never leave via feeds.
7. **Guest data:** sealed, separated, retention job, audited reads, never exported to providers or feeds (section 9).
8. **Authorization server-side only;** the UI's "can" flags are hints. Context (a room id) is not authorization.
9. **No device writes** from the calendar module; automations stay behind their own policy and the protected-switch rules.
10. **Failure:** provider or internet down -> Arx keeps working from its store; connection state `error`, notice to its owner, backoff.
11. **Review gates:** a security review of the feed endpoint (phase 4) and of the token store use and the OAuth callback (phase 5)
    before each ships; a threat note in `docs/security/`.

## 16. UI (mockup round 6, see the mockup folder) - frozen shell

New navigation entry "יומנים" in the existing navigation where the product places module areas (no new rail button without the owner's
answer, question 19.1); settings live in the settings tree under "מערכת ותשתית" › "יומנים". Screens: calendars list/management, month/
week/day view with a calendar switcher and per-calendar colours, room booking by hours (resource timeline across rooms), new/edit dialog
with permission-aware fields, approval inbox, maintenance window with the overlap warning, settings (overlap behaviour, approval per
calendar, retention, per-calendar permissions), sync connections. Rules: frozen shell (rail, tabs, logos, titles, floor chips, order of
controls), no scrolling inside control screens (paging), green only for status, calendar colours from the non-green palette keys,
no Home Assistant words.

Mockup round 6 (2026-10-29, `private/design-system-2026-10-27/round6/calendars/`, local only, invented data, product tokens generated
from `frontend/src/design/css.ts`): 8 screens and their states - month / week / day with the calendar switcher; rooms timeline (time
axis left-to-right inside the RTL page, like the schedules day bar; 6-hour window on the phone); new / edit drawer in three permission
variants (operator: own only, "on behalf" locked; site_admin: on behalf + guest details with the retention notice; calendar manager:
no approval, delete); approvals inbox with series approval and per-occurrence rejection; maintenance window in the three overlap modes;
calendars management; settings tabs (overlap, approval per calendar, per-calendar permissions, guest retention); sync connections
(iCal, Google, Microsoft in that order). Kind marks used on every surface: confirmed = tinted fill, pending = dashed outline,
maintenance = diagonal hatch, displaced = amber hatch + strike-through, closed hours = fine hatch, imported = neutral well.
164 screenshots (classic + domus, light + dark, 1440x900 + 390x844, worst-case and empty data): 0 with page scroll or sideways overflow.

## 17. Test plan (phase by phase; nothing here has been run)

| Area | Tests | Kind |
|---|---|---|
| Recurrence | golden expansions: weekly/monthly ordinal/last-day/yearly; COUNT vs UNTIL; DST spring and autumn in Asia/Jerusalem and Europe/London; holiday skip with `special_days` overrides; edit scopes occurrence/following/series incl. orphan listing; 2000 cap | unit (pure) |
| Occurrence cache | rebuild == incremental (property test over random edits) | unit |
| Conflicts | buffers both sides, touching intervals are NOT conflicts, pending holds slot, overlap policy, capacity, hours/holiday rules, lead/horizon for non-editors | unit + API |
| Race | two concurrent bookings of one slot -> exactly one 201 (threads on one SQLite file, `BEGIN IMMEDIATE`) | API |
| Permissions | matrix of 6.2 x role (viewer, operator, site_admin floor-scoped, system_admin, member rows of each kind) incl. deny bindings, department membership change, uniform 404 out of scope, audited 403 | API (`test_calendar_rbac_matrix.py`) |
| Approval | every transition of section 7; timeout expiry with an injected clock; series approve with exceptions; multi-room partial approval | API |
| Maintenance overlap | the three modes; preview; displaced series occurrences; "freed" notice on move/cancel; per-calendar override | API |
| Retention | erase_after for single/series/cut series/cancelled; janitor erases exactly due rows; audit counts only; setting change preview | unit + API |
| Notifications | each source fires once, content-free payload (no notes/guests) | API |
| Automations | clock fires once per occurrence and offset; late grace; automation_hold; no fire for cancelled/displaced; payload shape | unit |
| Tickets/maintenance projections | visit create/move/cancel in one transaction; read-only in calendar; visibility of titles | API |
| Feeds | ICS validity (RFC 5545 parser round-trip), busy detail, token rotate/revoke, rate limit, no guest data | API |
| Sync | FakeAdapter contract suite run against every adapter: pull/push/delete, etag loop prevention, 410 resync, two-way only on dedicated, Arx-wins on rooms; real Google/Microsoft runs are OWNER-RUN only and reported NOT_RUN otherwise | unit + contract |
| Security | tokens never in logs/answers (log capture), OAuth state/PKCE, SSRF on iCal-in, HTML in imported titles rendered as text | API + review |
| UI | layout specs per screen: no scroll in control screens at 1440x900 and 390x844, RTL, light/dark, classic/domus, empty/loading/error/ready, worst-case Hebrew data | Playwright (runner) |

`management/test_catalog.json` entries are added in phase 1 (not in phase 0).

## 18. Phases and estimates (agent-hours, implementation + tests + one review)

| Phase | Content | Agent-h | Model |
|---|---|---|---|
| 0 | This contract + mockup round 6 + owner answers | 12-16 | Opus (contract), design skills (mockup) |
| 1 | Engine: migration, calendars, members, events, recurrence, occurrences cache, conflicts/buffers/hours, approval, maintenance overlap, guest data + retention, permissions, audit, settings, notifications sources | 45-55 | Opus for recurrence/conflicts/transactions, Sonnet for CRUD/tests |
| 2 | Screens: calendars, month/week/day, rooms timeline, dialog, approvals, maintenance, settings; demo data; layout tests | 35-42 | Sonnet; Fable review of the first screen |
| 3 | Inside Arx: ticket visit projection + slot picker, maintenance task projection, automation trigger source + 5 disabled templates, holiday sharing | 25-32 | Opus (clock, ticket coupling), Sonnet |
| 4 | iCal out + in, feeds UI, security review of the endpoint | 14-18 | Sonnet, Opus review |
| 5 | Adapter interface + FakeAdapter + Google (export, then two-way dedicated), secrets store use, OAuth flow, connection UI | 30-38 | Opus |
| 6 | Microsoft adapter on the same interface | 18-24 | Opus/Sonnet |
| 7 | Phone: my bookings, room day, approvals from push; optional door panel; utilisation report | 16-22 | Sonnet |

Total about 205-260 agent-hours; phases 1-4 about 130-160. Suggested releases: R-A (1+2), R-B (3), R-C (4), R-D (5), R-E (6), R-F (7).
Real-provider tests need the owner's registrations and a test calendar; until then they are BLOCKED, not PASS.

## 19. Open owner questions

1. **Where does "יומנים" live in the navigation?** a) a tab inside "ראשי" next to תזמונים/אוטומציות; b) a new rail button (changes the frozen rail); c) inside "תשתיות". Mockup uses (a).
2. **Who may create calendars?** a) site_admin and system_admin (`calendar.manage`, recommended); b) system_admin only; c) also any calendar manager may create calendars of his type.
3. **Google scope for export-only bindings:** a) the narrow events scope on the chosen calendar only (recommended); b) full calendar scope (simpler setup, wider access).
4. **Per-calendar overlap override:** a) any value (a room may say "never displaced", recommended); b) only stricter than the installation default; c) no per-calendar override.
5. **Does a pending request hold the slot?** a) yes, first request holds until decided (recommended); b) no, first approved wins.
6. **Public booking link for customers (no Arx account):** a) not now (recommended); b) later phase after the public-surface review; c) never.
7. **Guest details allowed for which kinds?** a) customers and classes (recommended); b) customers only; c) every on-behalf kind.
8. **Holiday eves:** a) treat like regular days (recommended); b) like holidays for "closed" calendars; c) per calendar.
9. **Room door panel (a wall/kiosk display of the current/next booking):** a) later phase 7 (recommended); b) not needed.
10. **Module name renamable like the tickets module?** a) fixed "יומנים" (recommended); b) renamable display name.
11. **`calendar.connect`:** a) system_admin only, never delegable (recommended); b) also a dedicated grant role the owner can hand out.
12. **Room-booked condition for schedules (CR-014):** a) yes, a condition block "החדר מוזמן עכשיו" in phase 3; b) automations only.
13. **Two-way conflict on a room calendar (external edit breaks the rules):** a) Arx wins, revert the external change and notify (recommended); b) keep both and mark "דורש החלטה".
14. **Displaced bookings:** a) the organizer chooses an alternative himself (recommended); b) Arx auto-moves to the nearest free slot of the same room and notifies.
