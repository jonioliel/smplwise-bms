# T120 - the home interface, next phase: wall panel, notices and calendar on the panel, scenes

Row: FEATURE-DESIGNS-HOME-2490 (work plan 2.48.0 / 2.49.0, `private/planning/WORK_PLAN_2448_2449_2026-11-19.md`).
Status: **design only, nothing built**. The owner chooses what gets built and in which version.
Mockup: [`mockup.html`](mockup.html) (RTL Hebrew; wall panel 1280x800, desktop 1440x900, phone 390x844).
Base: `origin/main` 51da93753. Written 2026-11-20.

## 0. Summary

The home interface (the "Control4-genre" resident face, T120) has shipped in seven steps: 2.42.0, 2.42.1, 2.43.0,
2.43.1, the 2.43.x gap / audit rounds and the round-32 answers. Almost every screen of the two approved mockups exists
(round 25 `home-simple-v2`, round 27 `home-full-v3`; section 2). What is left falls in three groups:

1. **The wall panel is still a person's screen locked to a room.** It has no idle (ambient) face and no night
   dimming. Urgent events cannot take over the screen, except the door call. Nobody can see which panels are
   online. Notices and the calendar exist only as two chips that open read-only lists (owner answers 14ב and 9ב:
   notices + calendar on the panel, adding a family event). They are not part of what the panel *shows* at a glance.
2. **Scenes run blind and cannot be edited at home.** A scene is pressed and a toast says it ran. Nobody sees that
   the kitchen light did not answer. Editing opens the full scene editor (administrators only). Scenes have no icon,
   no room order and no place on the panel.
3. **A short list of approved-mockup items is still open.** Each needs an owner answer (section 2.3).

This document designs the wall panel's next phase, the panel's "today" (notices + calendar), and scenes, as nine
rows (section 12). It keeps every owner rule: no scrolling on control screens, the floors -> rooms tree, no
platform branding, green for status only. Lobby screens use the luxury lobby styles. A resident's wall panel is not
a lobby screen; it keeps the person's home theme.

## 1. Problem

The owner's target is a resident face in the genre of the dedicated touch panels sold for luxury homes: a calm
screen on the wall that is useful at a glance, wakes to the room, and gets out of the way. Today's panel is the
phone UI enlarged. It shows controls all the time, at full brightness, all night. It does not tell the household
what matters today (the lift is under service, the pool is booked at 18:00, a parcel is waiting). It cannot show
that a scene only half worked.

## 2. Current state

### 2.1 Shipped (with evidence)

| Area | Shipped | Change records |
|---|---|---|
| Interface policy per person: default home / full, may switch, home-only (server gate 403 `home_interface_only`), wall panel (`kiosk` + `kiosk_area_id`), visible rooms and categories; favourites per person + administrator seed; 7 themes x dark / light; welcome choice | 2.42.0 (migration 0211) | `HOME-SIMPLE-2420.md` |
| Room wallpaper (gallery / picture), switch user, home-system door rules | 2.42.1 (0212) | `HOME-SIMPLE-2421.md` |
| Phase 1: "עוד" hub, recordings (one camera, day, LTR timeline), home diary, intercom calls, guest invite, who can enter, alarm screen + personal code, the administrator's room wallpaper for everyone (on a wall panel the administrator's wallpaper always wins) | 2.43.0 (0213) | `HOME-V3-P1-2430.md` |
| Phase 2: who is home, family calendar (day, new event), shared-room booking, notice board (read, "קראתי", buses), service requests, weather, my notifications + do-not-disturb, scene schedules, **new scene from the current state** (lights / shades / climate) | 2.43.1 (0214) | `HOME-V3-P2-2431.md` |
| Phase 3: music and screens, TV remote, announcement (room / house, text), bill, water, house systems (view only), schematic home map | 2.43.0 | `HOME-V3-P3-2432.md` |
| Follow-up A: per-person categories recordings / log / intercom, visitor invites off + admin switch, "show bill" | 2.43.1 (0215) | `HOME-V3-FOLLOWUP-A-2431.md` |
| Follow-up B: **wall panel adds a family-calendar event** (`POST /home/wall/events`; a panel's other calendar writes refused 403 `kiosk_calendar_add_only`), ticket photo | 2.43.x | `HOME-V3-FOLLOWUP-B-2431.md` |
| Gaps: alarm filter in the diary (`GET /home/alarm-log`), code row in "ההתראות שלי", plumber / fault tickets from water / systems | 2.43.x | `HOME-V3-GAPS-2436.md` |
| Audit fixes, round-32 answers: portrait tablet = phone layout with 4 tiles per row, calendar week switch, still-camera word, fade / rise motion setting | 2.43.x | `HOME-V3-AUDITFIX-2437.md`, `HOME-R32-ANSWERS-2438.md` |
| Lazy loading, reload throttling, English strings | 2.44.0 | `CR-HOME-LAZY-2440.md`, `CR-HOME-RELOAD-2436.md`, `CR-I18N-HOME-2441.md` |

### 2.2 The wall panel today (code)

- `frontend/src/home/sw-home.ts`: a panel is a person whose policy has `kiosk` and `kiosk_area_id`. It opens that
  room. `KIOSK_ROUTES` limits it to `r, lights, climate, shades, doors, scenes, active, alerts, media, notices,
  calendar`. The hub ("עוד") is hidden. A long press on the clock + the administrator's code unlocks it for 5 minutes
  (`KIOSK_UNLOCK_MS`). `home.kiosk_exit` = `code` | `none`.
- The room screen adds the chips "לוח הודעות" and "יומן" (`wallChips`, phase 2) and the room's media / announcement
  (`roomChips`, phase 3).
- Missing: an idle face, night dimming, takeovers other than the door call (`sw-home-call`), a panel status list.
  A `KioskIdle` machine exists for the map kiosk (`frontend/src/map/kiosk-idle.ts`, two phases active -> idle,
  pause gate). The home interface does not use it.

### 2.3 Still open against the approved mockups

| Item | Mockup | State | Recommendation |
|---|---|---|---|
| Climate "החזק כך" (hold) | v2 climate | not built (no generic concept to map to) | drop (question 7) |
| Simplified scene edit dialog | v2 scenes | partly: the list is built, editing opens the full editor | **designed here** (HS-SCENE-EDIT) |
| Drag to reorder favourites | v2 edit mode | arrows only | add long-press drag on the tablet only, arrows stay (question 8) |
| Room grid orphan row (audit item 8) | round 30 | open, needs the owner | keep the person's order, fill the orphan row with "+ הוסף" (question 9) |
| Calendar: edit / delete my own event | beyond the v3 mockup | not built | own events only, on phone / tablet; never on a panel (row HG-CAL-EDIT) |
| Announcement by voice / to a floor | v3 | no route (decisions 14א / 15א) | stays out |
| A picture per intercom call | v3 | the call log keeps no frames | stays out |
| Physical checks (real phone, portrait tablet, wall panel), the 5 other themes on the newer rules | every round | NOT_RUN | row HQ-DEVICE-QA (owner approval for the lab) |
| `management/tasks.json` T120 still `IN_PROGRESS` | - | the acceptance rows are shipped | the lead splits T120: close the shipped acceptance with evidence, open the rows below |

## 3. Users and stories

| Who | Story | Row |
|---|---|---|
| Family at home | The kitchen panel shows the time, the weather, what is on today, a new notice and which doors are open, quietly, without anyone touching it. | HP-AMBIENT, HP-TODAY |
| Family at night | After 23:00 the panel is dark and dim. A touch brings it back to the room at night brightness. | HP-AMBIENT |
| Anyone passing | An urgent building notice ("water off 10:00-12:00") or an alarm takes over the panel until someone acknowledges or the notice ends. | HP-TAKEOVER |
| Household admin | I see every panel in the house: room, online or not, awake / idle / night, last seen. I can make one reload. | HP-PANEL-ADMIN |
| Parent | The panel shows today's family events and the shared-room bookings. I add "dentist 16:00" from the panel (exists) and see it at once. | HP-TODAY |
| Resident | I press "ערב" and see in two seconds that 5 of 6 things happened, and which one did not, with "נסה שוב". | HS-SCENE-RESULT |
| Household admin (scene.manage) | I change the brightness of one light in "ערב" or remove the blind, without the installer's full editor. | HS-SCENE-EDIT |
| Household admin | "יציאה מהבית" has an icon, sits first on the entrance panel, and after it runs asks "לדרוך אזעקה?" (never arms by itself). | HS-SCENE-META |

## 4. Rules that do not change

- **A panel is a person.** CR-030 revision 2: no device tokens, no pairing codes. The panel is a user with the
  `kiosk` policy, signed in once on the tablet. Every route checks that user's own permissions. Nothing here adds a
  machine principal.
- **No new control path.** Lights, scenes, doors and the alarm go through the existing routes, confirmations and
  codes. Sensitive actions (door, alarm, a scene with a lock or an alarm member) keep their confirmation and their
  own permission, also from an ambient tap.
- **Never queue or blindly retry a physical command** (AGENTS.md). "נסה שוב" on a scene result is a new, explicit
  press that sends only the unreached members, after their current state is read again.
- **No scrolling on control screens.** Lists page. The only scrolling exception stays the long notice body inside
  its sheet (owner decision 10א).
- **The rooms tree stays** (floors -> rooms) on the rooms screen and in the panel's "חדרים" exit.
- **No platform names in the UI.** Green is status only. 56 px targets on the tablet, 44 px on the phone.
- **Calm motion:** fade 160 ms (the round-32 default), no looping oscillation near 0.2 Hz, no abrupt brightness jump
  (night fades over 2 s), and under reduced motion every change is a cross-fade.

## 5. Flows

### 5.1 Ambient face (HP-AMBIENT)
1. A panel goes **ambient** after `home.panel.ambient_after` of no touch (default 2 min). It does not go ambient
   while a sheet, a call, a takeover, the media remote or the kiosk code pad is open.
2. The ambient face (mockup screen 1) is one composition, no controls:
   - a large clock and date (Hebrew date line optional), outside temperature and the day's high / low;
   - **today**: the next three family events and bookings (HP-TODAY);
   - **notices**: the newest unread-for-the-house notice title (one at a time, changes every 20 s, fade only), plus
     "עוד 2" when there are more;
   - **the room**: lights on / off count, the room temperature, the doors status of the house ("כל הדלתות נעולות" /
     "דלת הכניסה פתוחה"), the alarm state word;
   - **scene buttons** of the panel (up to 4, HS-SCENE-META). They are the only touch targets that act from ambient,
     and they act on the second tap: the first tap wakes the panel and lifts the scene row.
3. **Wake:** any touch (pointer-down, not release) wakes the panel to the room screen in 160 ms. The waking touch
   never acts on a control. The scene buttons are the explicit, visible exception above.
4. **Burn-in:** the ambient composition moves by up to 6 px every 60 s (a slow translate, composite-only), it has no
   static white blocks, and the dark background is the theme's own `--sw-bg`.

### 5.2 Night (HP-AMBIENT)
1. `home.panel.night` = `hours` (default 23:00-06:00) | `sun` (sunset + 1 h to sunrise, from the weather source) | `off`.
2. At night the ambient face fades (2 s) to the night face (mockup screen 2): the theme's dark scheme, a black
   overlay at `home.panel.night_level` (default 70%), and only the clock, the doors line and the alarm word.
3. A touch at night wakes the room screen in the dark scheme at a 40% overlay. After `ambient_after` it returns to
   night.
4. The web page cannot change the tablet's backlight. With the kiosk browser's own bridge present (detected, never
   required) the panel may also lower the backlight. This adapter is optional and off by default (question 4).

### 5.3 Takeover (HP-TAKEOVER)
Priority, highest first: door call (exists, `sw-home-call`) > alarm triggered > urgent notice > none.

| Event | Shows | Leaves when |
|---|---|---|
| Alarm triggered (the panel's person can view the alarm) | red full-screen state: zone words, "פתח את מסך האזעקה" (the existing screen with its code rule) | the alarm is disarmed or restored, or "הסתר" (back after 2 min while it is still on) |
| Urgent notice (`severity` = `critical` or `alert`, using the takeover window the TV boards already apply to a new urgent notice) | the notice title, its time window, "הסתר" (no read mark on a panel by default, see 5.4) | the notice's takeover window ends, or "הסתר" |
| Door call | unchanged | unchanged |

A takeover wakes the screen from ambient and night (night: the 40% overlay). It never acts. Every button opens an
existing screen or hides the takeover.

### 5.4 Today: notices and calendar on the panel (HP-TODAY)
The owner approved notices + calendar on the panel (14ב) and adding a family event (9ב, built). This row makes them
part of what the panel shows at a glance:
1. **Room screen side rail** (tablet landscape 1280x800, mockup screen 3): a narrow "היום" column with up to 3
   upcoming items (family events + the household's shared-room bookings, in time order) and the top notice. "כל
   היומן" and "כל ההודעות" open the existing sheets. The column replaces nothing: the favourites grid keeps its 4 x 2
   at this size (the rail takes the space of today's chip strip on that edge).
2. **Ambient**: the same data (5.1).
3. **Read marks on a shared device.** A panel's "קראתי" marks the notice read for the *panel user*, not for a person.
   Recommended: on a panel the notice shows "חדש" for 48 h and has no "קראתי" (question 3). A person's own read marks
   stay on their own phone.
4. The calendar shown is the panel's family calendars (the role rule of `home_wall_events`: `book`+ for adding,
   `view` for showing).

### 5.5 Scene result (HS-SCENE-RESULT)
1. Pressing a scene sends the existing `POST /automations/scene/{id}/apply`. The tile shows a ring that fills as
   members reach their target state (from the state push `/ha/ws`, compared with the scene's targets).
2. After up to 8 s: all reached -> the tile settles with the active-scene mark and a toast "ערב הופעלה". Some did not
   -> the toast becomes "5 מתוך 6 · מנורת המטבח לא ענתה" with "פרטים". The sheet (mockup screen 5) lists each member
   (reached / not reached / unavailable) with "נסה שוב לפריטים שלא הגיעו".
3. "נסה שוב" is a new explicit press. It reads the current states, sends one command per unreached member through
   the single control route (with `building` when T119 applies), and never repeats on its own.
4. The targets come from a new read route that lists only the members the caller may read (5.7). A member the caller
   cannot read is counted as "פריט אחד שאינו מוצג לך" without its name.

### 5.6 Simplified scene editor (HS-SCENE-EDIT)
For a person with `scene.manage` on the scene's members (the household admin, or the installer). Opened from a
scene's long press or the scenes screen's "ערוך" (mockup screen 6):
1. Name, icon (from the home icon set), the rooms it belongs to.
2. Members as rows, by room: a light = on / off + brightness; a switch = on / off; a shade = position; a climate unit
   = mode + temperature. Any other captured attribute is kept exactly as captured and shown "נשמר כפי שצולם".
3. "הוסף מהחדר": the room's controllable devices with their state now. "צלם שוב": re-capture the selected members
   from their state now (the existing `POST /automations/scene/capture`).
4. A lock, an alarm panel or a door is never added here. They are refused by the server (the existing door rule
   for scenes) and are not offered.
5. Save = `PUT /automations/scene/{id}` with the module's own validation, version history and audit. Delete stays
   in the full editor.
6. Paging: at most 6 member rows per page on the tablet and on the phone (the phone row is one line: name, value, remove).
   No scrolling.

### 5.7 Scene placement and follow-up (HS-SCENE-META)
- Arx-side metadata per scene: icon, rooms (for the room's scene row), panel order (which scenes are the panel's 4
  buttons, per panel room), and an optional **follow-up suggestion**: `arm_alarm` | `lock_doors` | none.
- After a scene with a follow-up runs, a sheet asks "לדרוך את האזעקה במצב 'בחוץ'?" with the alarm's own
  confirmation and code rule, or "לנעול את כל הדלתות?" with the door rule. Nothing runs without that press.

### 5.8 Panels list (HP-PANEL-ADMIN)
User management > "ממשק ביתי" > tab "מסכי קיר" (mockup screen 7), `rbac.assign`:
- one row per panel person: room (and building, with T119), state (פעיל / רגיל / לילה / לא מחובר), last seen,
  screen size, app version, theme;
- per panel: ambient after, night mode, night level, takeovers on / off, scene buttons. Unset = the installation
  default;
- "רענן מסך" asks the panel to reload at its next heartbeat. It is audited and is not a physical action.
- The heartbeat: the panel posts `POST /home/panel/heartbeat {state, w, h, version}` every 60 s. The server keeps the
  last one in memory (no history, no personal data beyond the panel user). "לא מחובר" = no heartbeat for 3 minutes.

## 6. Data model changes

| Row | Change | Migration | Backup |
|---|---|---|---|
| HP-AMBIENT / HP-TAKEOVER / HP-PANEL-ADMIN | `home_interface_policy.panel_json TEXT NULL`: per-panel overrides `{ambient_after, night, night_from, night_to, night_level, takeover: {alarm, notice}, reload_seq}` | yes, additive | ACCESS_TABLES (already) |
| HP-PANEL-ADMIN | panel heartbeat: in memory only (`services/home_panels.py`), lost on restart (the list shows "לא ידוע" until the next beat) | no | - |
| HS-SCENE-META | `home_scene_meta (scene_id TEXT PK, icon TEXT, rooms_json TEXT, panel_json TEXT, follow_up TEXT CHECK IN ('arm_alarm','lock_doors') NULL, updated_at, updated_by)` | yes, new table | PROJECT_TABLES |
| HS-SCENE-RESULT, HS-SCENE-EDIT, HP-TODAY | none (existing scene store + calendar + notices) | no | - |

Installation settings are rows of the settings table (no migration). Migration numbers are assigned at train
integration.

## 7. API sketch

| Method + path | Row | Permission | Notes |
|---|---|---|---|
| `GET /home/interface` (+ `panel` block: effective panel settings) | HP-AMBIENT | unchanged | absent for a non-panel person (byte-identical answer) |
| `POST /home/panel/heartbeat {state, w, h, version}` | HP-PANEL-ADMIN | the caller must be a panel (else 403 `wall_panel_only`) | answers `{reload: bool}`; under the home-only allowlist |
| `GET /home/panels` | HP-PANEL-ADMIN | `rbac.assign` | panel people + last beat + effective settings, paged |
| `PUT /home/panels/{user_id}` | HP-PANEL-ADMIN | `rbac.assign` | overrides; audited `home.panel.update` |
| `POST /home/panels/{user_id}/reload` | HP-PANEL-ADMIN | `rbac.assign` | audited `home.panel.reload` |
| `GET /home/today?days=1` | HP-TODAY | the calendar / notices modules' own read rules for the caller | merged items: events, the household's bookings, the top notices; nothing the caller could not read through the modules |
| `GET /home/takeover` (+ the push on `/ha/ws` / `/me/ws`) | HP-TAKEOVER | alarm.view / notices reader rule | the current highest-priority takeover for this caller |
| `GET /home/scenes/{id}/targets` | HS-SCENE-RESULT | scene apply permission; members filtered by `entity.state.read` | `{members: [{entity_id, name, room, target}], hidden: n}` |
| `PUT /automations/scene/{id}` (exists) | HS-SCENE-EDIT | `scene.manage` + control of each member (exists) | the simplified editor builds the same body the full editor sends |
| `GET` / `PUT /home/scenes/{id}/meta` | HS-SCENE-META | read: scene view; write: `scene.manage` | icon, rooms, panel order, follow-up; audited |

Home-only allowlist (`services/home_interface.py`): the new `/home/*` routes are under the existing prefix. Each
keeps its own permission. The `/automations/scene/` prefix is already allowlisted for a home-only person (apply,
capture); the editor's `PUT /automations/scene/{id}` stays checked by `scene.manage` on the server. A wall panel gets a
new `KIOSK_REFUSED_WRITES_*` entry for it (403 `kiosk_scene_edit`): scenes are never edited from a shared panel.

## 8. Settings

| Key | Options | Default | Where | Row |
|---|---|---|---|---|
| `home.panel.ambient` | `on` / `off` | `on` | ממשק ביתי > הגדרות התקנה > מסכי קיר | HP-AMBIENT |
| `home.panel.ambient_after` | 1 / 2 / 5 / 10 min | 2 min | same, per panel override | HP-AMBIENT |
| `home.panel.night` | `hours` / `sun` / `off` | `hours` 23:00-06:00 | same | HP-AMBIENT |
| `home.panel.night_level` | 40-90% | 70% | same | HP-AMBIENT |
| `home.panel.backlight_bridge` | `off` / `on` (use the kiosk browser's own bridge when detected) | `off` | same | HP-AMBIENT |
| `home.panel.takeover_alarm` / `_notice` | `on` / `off` | `on` / `on` | same | HP-TAKEOVER |
| `home.panel.today` | `rail_and_ambient` / `ambient` / `off` | `rail_and_ambient` | same | HP-TODAY |
| `home.panel.notice_read` | `new48h` (no read on a panel) / `house_read` | `new48h` | same | HP-TODAY |
| `home.scenes.result` | `on` / `off` | `on` | ממשק ביתי > הגדרות התקנה | HS-SCENE-RESULT |
| `home.scenes.edit` | `scene_manage` (whoever holds it) / `admins` (installation administrators only) | `scene_manage` | same | HS-SCENE-EDIT |
| `home.scenes.follow_up` | `on` / `off` | `on` | same | HS-SCENE-META |

## 9. Rollout

- Every row is additive and off-switchable. With `home.panel.ambient = off` the panel is today's panel exactly; the
  pixel specs of `home-simple-2420` / `home-v3-*` pin it.
- First lab step (owner approval required, per step): one panel person on a real wall tablet, read-only checks of
  ambient / night / takeover timing (no physical action). Then one scene press with the owner present (lights only).
- Release notes in Hebrew and English (owner rule). The user guide (DOCS_HE.md) gets a "מסך קיר" section.

## 10. Risks

| Risk | Effect | Control |
|---|---|---|
| A waking touch lands on a control (lights off by accident) | annoying, sometimes unsafe | the waking touch is swallowed; the scene row needs a second tap; spec: the first touch never sends a command |
| A takeover hides a door call | missed visitor | strict priority, the door call is always first; spec covers the overlap |
| "נסה שוב" read as an automatic retry | a physical command repeated | explicit press only, re-reads states, sends only the unreached members; audited per command |
| The editor drops a captured attribute (colour, effect) | the scene changes silently | unknown attributes are kept byte for byte; round-trip test on every member type |
| Night overlay at 70% on a light theme reads as broken | owner rejects | night always uses the theme's dark scheme; reviewed on the 7 themes |
| The heartbeat becomes a presence signal for a person | privacy | panel users only (403 for anyone else), memory only, no history |
| Burn-in on OLED tablets | hardware damage | pixel shift, dark ambient, night mode default on |
| A notice marked read on the shared panel hides it from the family | missed notice | `new48h` default: no read marks on a panel |

## 11. Test plan

| Layer | What | Files (new) |
|---|---|---|
| Backend | heartbeat 403 for a non-panel, memory-only, reload flag once; panels list permission + audit; `panel_json` validation (422 Hebrew); today merges only readable items (a calendar the caller cannot view never appears); takeover priority + alarm.view gate; scene targets hide unreadable members (count only); simplified save round-trip keeps unknown attributes; meta follow-up enum; allowlist: home-only + `scene.manage` may PUT a scene, a panel may not | `tests/test_home_panels.py`, `test_home_today.py`, `test_home_takeover.py`, `test_home_scene_targets.py`, `test_home_scene_meta.py` |
| Frontend unit | idle machine (reuse `KioskIdle` phases) incl. "not while a sheet is open"; night window incl. the DST night; burn-in offset bounded; takeover priority; scene result reducer (reached / not reached / hidden); editor model per member type | `frontend/tests/unit-home-panel-*.spec.ts`, `unit-home-scene-*.spec.ts` |
| Evidence (Playwright) | panel 1280x800 + portrait 800x1280, phone 390x844, desktop 1440x900; ambient / night / takeover / rail / result / editor / panels list; no scroll (scrollTop 0), 56 px targets on the panel, no platform words, RTL, the 7 themes x dark / light contrast >= 4.5 on ambient text; reduced motion = cross-fades only; the first touch sends no command | `frontend/tests/home-panel-*.spec.ts`, `home-scene-*.spec.ts` |
| Pixel | ambient, night, takeover, rail, result sheet, editor, panels list (light + dark, panel + phone), baselines taken on the runner | `frontend/tests/pixel-home-panel-*.spec.ts` |
| Physical (HQ-DEVICE-QA, owner approval) | one real wall tablet, one phone, one portrait tablet; the 5 themes not yet reviewed | runbook in LAB-PACK style; NOT_RUN until approved |

## 12. Rows per agent

| Row | Branch | Scope | Depends on | Migration | Size | Model | Est. hours |
|---|---|---|---|---|---|---|---|
| HP-AMBIENT | `pilot/HP-AMBIENT-25xx` | idle machine, ambient face, night, burn-in, wake, panel settings in `/home/interface` | - | yes (`panel_json`) | L | balanced | 9 |
| HP-TODAY | `pilot/HP-TODAY-25xx` | `GET /home/today`, the room screen rail, ambient agenda + notice rotation, `new48h` rule | HP-AMBIENT (ambient slots) | no | M | balanced | 6 |
| HP-TAKEOVER | `pilot/HP-TAKEOVER-25xx` | takeover route + push, alarm / urgent-notice sheets, priority with the call | HP-AMBIENT | no | M | deep review (alarm path) | 5 |
| HP-PANEL-ADMIN | `pilot/HP-PANEL-ADMIN-25xx` | heartbeat, panels list, per-panel overrides, reload | HP-AMBIENT | no (uses `panel_json`) | M | balanced | 5 |
| HS-SCENE-RESULT | `pilot/HS-SCENE-RESULT-25xx` | targets route, ring + toast + result sheet, "נסה שוב" | - | no | M | deep review (no blind retry) | 6 |
| HS-SCENE-EDIT | `pilot/HS-SCENE-EDIT-25xx` | the simplified editor, allowlist entry, attribute round-trip | HS-SCENE-RESULT (targets model) | no | L | deep | 9 |
| HS-SCENE-META | `pilot/HS-SCENE-META-25xx` | meta table + routes, icons, room rows, panel buttons, follow-up sheets | - | yes (`home_scene_meta`) | M | balanced + deep review (follow-up = alarm / doors) | 6 |
| HG-OPEN-ITEMS | `pilot/HG-OPEN-ITEMS-25xx` | the owner's answers to questions 7-9 (hold, drag reorder, orphan row) + own-event edit / delete (phone / tablet, never a panel) | owner answers | no | M | balanced | 5 |
| HQ-DEVICE-QA | runbook only | real devices + the 5 themes, read-only | owner approval per step | - | S | - | 2 + lab time |

Suggested order: HS-SCENE-RESULT and HP-AMBIENT first (the two most visible changes). Then HP-TODAY,
HP-TAKEOVER, HP-PANEL-ADMIN and HS-SCENE-META. Then HS-SCENE-EDIT and HG-OPEN-ITEMS. With T119's MB-HOME-IFACE in
the same window, the panel's building comes from its room (one shared rule).

## 13. Open questions (recommendation first)

1. **Ambient face.** a. On by default after 2 minutes (recommended); b. off by default, a setting turns it on; c. not
   needed.
2. **Night.** a. Fixed hours 23:00-06:00, changeable (recommended); b. by sunset / sunrise; c. no night mode.
3. **"קראתי" on a shared panel.** a. Not on a panel; a notice is "חדש" for 48 h (recommended); b. "קראתי" marks it for
   the whole household; c. like today.
4. **Tablet backlight.** a. Only darken the screen (works everywhere) (recommended); b. also lower the backlight
   where the kiosk browser allows it.
5. **Takeover.** a. Alarm + urgent notices take over the panel, a door call above both (recommended); b. alarm only;
   c. none besides the door call.
6. **Who edits scenes in the home interface.** a. Whoever holds the scene-management permission, e.g. the household
   admin (recommended); b. installation administrators only (today).
7. **Climate "hold".** a. Drop it (recommended: no common meaning across thermostats); b. build "keep until I change
   it" as an Arx-side pause of climate schedules.
8. **Reordering favourites.** a. Long-press drag on the tablet, arrows stay (recommended); b. arrows only (today).
9. **Orphan row in the room grid.** a. Keep my order, fill the gap with "+ הוסף" (recommended); b. reorder by tile
   size automatically.
10. **After-scene suggestion (arm the alarm / lock the doors).** a. A suggestion sheet that the person confirms, with
    the usual code (recommended); b. no suggestions; c. include the alarm in the scene (not recommended: a sensitive
    action without its own confirmation).

## 14. Design notes (skills used)

- **ui-ux-pro-max** (`search.py "smart home wall panel touch kiosk ambient" --design-system`, `--domain ux` for kiosk
  / touch). Taken: 8 px or more between touch targets, the platform's target sizes (56 px on the panel as the product
  rule), live data labelled with its update time and stale state, pause offscreen work. Rejected: glassmorphism as a
  style (not the approved look), the green accent (green = status), Plus Jakarta Sans (Latin only; Heebo stays).
- **impeccable**: context loaded; no PRODUCT.md / DESIGN.md of its own, so the incumbent implementation is the
  authority (the approved v2 / v3 home CSS and themes). Craft floor applied: one authored motion moment (the wake /
  ambient cross-fade), themed focus rings and selection, tabular numerals for the clock and temperatures, no
  eyebrow labels, no nested cards. Detector run on the mockup (evidence in the change record of this row).
- **apple-design**: respond on pointer-down (wake), no slow looping oscillations, no abrupt brightness jumps (night
  fades over 2 s), sheets anchored to their trigger, reduced motion = cross-fade, wayfinding on every panel screen
  (room name + "חדרים").
- **emil-design-eng**: press feedback `scale(.97)` 120 ms ease-out; scenes are pressed tens of times a day, so the
  ring is the feedback (no entrance animation on the grid); the result toast enters 200 ms ease-out and leaves faster
  (150 ms); the ambient notice rotation is opacity-only.

## 15. Mockup evidence (2026-11-20, workstation)

| Check | Command / tool | Result |
|---|---|---|
| Render + layout check of every screen, both schemes | Playwright (Chromium, the main checkout's `frontend/node_modules`), each frame at its native size; a script lists any element outside the frame, any clipped box and any overflowing text | 9 screens (dark + light where it applies; night is dark only): no element outside its frame, no clipped or overflowing text, no scrolling |
| Look-and-fix loops | two loops on the screenshots | loop 1 fixed: the review caption covering the frames, a climate tile stacking vertically, page numbers reversed by the bidi algorithm ("1 / 2" -> "1 מתוך 2"), a duplicate icon on the phone bar, the desktop rail on the wrong side, a fabricated Hebrew date removed, the phone editor page raised to 6 rows; loop 2 fixed: night text contrast (3.1:1 -> 4.6:1), frames positioned by the review shell |
| Screenshots | JPEG | `shots/t120-NN.jpg` (dark), `shots/t120-NN-alt.jpg` (light) |
| impeccable detector | `.claude/skills/impeccable/scripts/impeccable.cmd detect --json mockup.html` | 7 `cramped-padding` warnings on centred fixed-height rows and the night face (kept), 4 `nested-cards` (tiles inside the room grid / sheet rows: the approved home structure, kept); the low-contrast finding fixed. Output: `inspect/impeccable-detect.json` (both mockups) |
| ui-ux-pro-max | `search.py "smart home wall panel touch kiosk ambient" --design-system -p "SmplWise Arx"`, `search.py "kiosk idle screen touch targets glanceable" --domain ux` | `inspect/ui-ux-pro-max-design-system.txt`, `inspect/ui-ux-pro-max-ux.txt` |
| apple-design, emil-design-eng | loaded through the Skill tool; the rules applied are listed in section 14 | - |
| Not run | a real wall tablet / phone, the product build, the 6 home themes besides classic | NOT_RUN (design only) |
