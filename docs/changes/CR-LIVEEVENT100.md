# CR-LIVEEVENT100: live event mode - one page for an incident in progress

Status: change record + mockup (v2, owner review 2026-10-24 applied - see section 10, APPROVED); built on pilot/LIVEEVENT100B-295 - see section 11. Board item r100. Branch `pilot/LIVEEVENT100-295` from
`origin/main` @ `320e5555172106843b2690692d534aeed19eb8b3` (v2.12.4). Mockup: `docs/design/mockups/liveevent-100/index.html`
(single file, RTL Hebrew, light + dark, desktop / tablet / phone, states active · none · camera offline · permission-limited ·
loading · error · module off). Screenshots: `private/review/liveevent-100/` (gitignored). No code changes, no secrets, fake data only.

## 1. Goal

When something is happening right now (an intrusion-alarm zone, a door forced, a generator switching to emergency, a drill), the
operator today opens four or five screens: the event page, the live wall, the floor map, the door screen, the elevators page, the
notifications centre. The live event mode gathers, on ONE page, for ONE incident: the floor plan with the event location, the
nearest cameras live, the doors involved (state and who opened), the state of the elevators and the generator, and the chain of who
was notified / acknowledged / acted. Everything on the page is read-only; the only actions are the existing, already-permissioned
ones (acknowledge, add to a case, close the incident, links to the existing screens). Nothing physical is operated from here:
no door open, no emergency open / lock, no alarm arm / disarm / bypass, no PTZ. Fire and emergency controls are explicitly out of
this change.

## 2. Home of the screen (proposal; owner decides, Q1)

**Recommendation: the security area, section "חקירה", a new page "אירוע חי".**

- List `#/investigate/incidents` (open incident first, then the closed ones of the retention window) and detail
  `#/investigate/incidents/<id>`. Level-1 row unchanged (לייב · חקירה · אזעקה, `SECURITY_SECTIONS`); the page is a new
  `TabItem` in `SECTION_TABS.investigate` (`nav.ts:810`) between "מרכז אירועים" and "הקלטות", with a red dot while an incident is
  open (the RFQ-questions badge pattern, `applyRfqQuestions`, `nav.ts:729`); the dot is a setting, see section 10.
- While an incident the viewer may read is open: a red dot on the security rail icon and an "אירוע פעיל" pill beside the floating
  corner pill on every screen (shell `renderChrome`), so the page is one tap away from anywhere. Both disappear when the incident
  closes or the module is off. (Section 10: the setting `incident.red_dot` can switch the two DOTS off; the pill stays.)
- Why the security area and not the service-management area: every trigger is a security object (alarm panel zone, event-centre
  event, security notification); every permission the page needs already exists in the security vocabulary (`events.read`,
  `events.ack`, `video.live`, `map.read`, `access.events.read`); the components it reuses (`investigate-event-detail`,
  `sw-plan-canvas`, `sw-live-player`) live there; and the service area is being reorganised right now
  (`private/planning/SERVICE_IA_PROPOSAL_2026-10-23.md`, slice 1 = navigation only, parity rule) - adding an unrelated security page
  to it would both break its "four job-based sections" structure and tie this change to that reorganisation's timetable.
- Why "חקירה" and not "לייב" or "אזעקה": the incident is a record with a history (opened / acknowledged / closed, audited,
  retained) and the natural continuation is the event page, the history map and a case - all pages of "חקירה". "אזעקה" is one source
  among several and its section is the alarm screen alone. Alternative for the owner: a fourth level-1 section "אירוע" (Q1 b).
- The alarm screen (`security-alarm.ts`), the event page (`investigate-event-detail.ts`), the notification rows (`notify-row.ts`)
  and the floor map (`explore-floor-map.ts`) each get one existing-style button / link to it (see §3). With the module off none of
  them is drawn (the owner's rule of 2026-10-20 for the tickets module, applied here).

## 3. Triggers

| # | Trigger | How | Opens automatically? |
|---|---|---|---|
| T1 | Intrusion alarm: a zone goes into alarm (`routers/alarm.py`, `/alarm/panels`, the alarm websocket / poll) | the alarm service calls `incidents.open(source='alarm', ...)` with the zone's floor and anchor (zones are mapped to a floor / anchor in alarm settings; without a mapping the incident opens without a location) | setting `incident.auto_open.alarm` (default OFF; owner 2026-10-24: burglary alarm only, editable) |
| T2 | Event centre: any event row / the event page | button "פתח אירוע חי" on the event page (`investigate-event-detail`, beside "סמן כטופל"), row menu entry on `investigate-events` | manual only |
| T3 | Notification: a push / in-app notification whose `link` is `#/investigate/incidents/<id>` (`Notification.link`, `api/notifications.ts:76`) - sent when an incident opens (T1 / T2 / T4) to the recipients of the existing notification matrix for the source kind | the deep link opens the page; the notification's `ack` is one step of the chain | - |
| T4 | Manual: from the floor map (`explore-floor-map`, a point or a camera / lock marker → "פתח אירוע חי כאן") or from the incidents list ("פתיחת אירוע ידנית" → a floor and a point, optional title) | `incidents.open(source='manual')` | - |
| T5 | ~~Rule alert~~ - dropped by the owner decision of 2026-10-24 (automatic opening only from the burglary alarm) | - | - |

An incident is one row; a second trigger on the same floor within `incident.merge_window_s` (default 300 s = 5 minutes, owner 2026-10-24; editable in the settings sheet) is attached to the
open incident as a chain step ("אירוע נוסף: ...") instead of opening a second one. Several open incidents on different floors are
allowed; the pill shows the count and opens the list.

## 4. The page: panels, data, permissions

The page is composed of existing components; a viewer sees only the panels their permissions allow, and a panel they lack is
replaced by its own `sw-state-panel` (forbidden) or leaves entirely (table below). Server side, every panel is a separate endpoint
that already enforces its own scope (`rbac.authorize`, `services/access.py row_scope`), so the page never receives data the viewer
may not see; the client only decides what to draw.

| Panel | Data (existing source) | Permission (existing key, scope) | Viewer lacks it → |
|---|---|---|---|
| Head: title, source, opened by / at, elapsed, status | new `incidents` row (§6) | `events.read` at the incident's floor (the page itself) | the route answers forbidden (`sw-state-panel` forbidden), the pill and the dot are not drawn for this viewer |
| ~~Facts strip~~ (v2: removed so the page fits without scrolling; each fact now sits in the head of its own panel - cameras "4 חיות", doors "2 פתוחות", chain "2 ממתינים"; the source and the opener are in the subtitle) | derived from the panels | as the panel each fact comes from | the chip shows "אין הרשאה" or leaves |
| Map: floor plan, zones, the event pin, camera cones, lock markers | `loadMap(floor_id)` → `MapBundle` (`api/maps.ts`), `<sw-plan-canvas>` with `markers`, `selectedId` = the event anchor, `highlightIds` = the suggested cameras; the same block as `investigate-event-detail.ts:805-830` (incl. the 3D toggle and "מפה חיה") | `map.read` (floor) | the map leaves; the location stays as text (building · floor / zone) |
| Nearest cameras (live) | `suggestAdjacent()` (`map/adjacent-cameras.ts`: same room → shares a wall → nearby) on the client, cross-checked with `suggest_route()` (`services/correlation.py`) from the server; tiles are `<sw-live-player profile="sub" mode="auto" compact>` inside the live wall's tile; the first tile is the camera in the event's room | `video.live` per camera (`require_camera`); cameras the viewer lacks are not listed at all (the route filters by `row_scope`) | panel replaced by forbidden "וידאו חי אינו זמין לך"; the rest of the page is drawn |
| Doors in the vicinity | lock entities from `correlate()` (`services/correlation.py`, ±10 min window, kind `lock` and door `binary_sensor`), state from the entity state; "who opened" = the access-events log rows of the window for the station mapped to the lock (`/intercom/door-map`, `/access-control/events?door=&start=&end=`, `AccessEvent.person_name / authentication`); "לדלת" = the existing door page `#/doors/<id>` | state column: `entity.state.read` (floor); "who opened" column: `access.events.read` (station scope); the link: drawn always (the door page enforces its own permissions) | without `access.events.read` the "מי פתח" column leaves (the row still shows open / locked and when) |
| Elevators and generator | `GET /infra/elevators` (`ElevatorLive`: state, reason, stale, since) filtered to the incident's building; `GET /generator/devices/live` (`LiveResponse`); drawn with the existing home widgets (`elevators/home-widget.ts renderElevators`, `generator/home-widget.ts renderGenerators`) in the row look of the mockup | elevators: `devices.read` (installation); generator: `generator.view` | the panel leaves entirely; with one of the two, only that half is drawn |
| Actor chain | ONE source: the audit log filtered by `resource_type='incident', resource_id=<id>` (`audit.py`, `GET /audit?resource_id=`) plus the incident's `incident_steps` (§6) that mirror the external facts: the event ack (`events.acked_by_username`), the notification deliveries and acks (`notifications` rows with the incident link), the door-open commands signed by `trusted_door.actor_name` (`routers/access_control.py` ≈898, audited as `door_open`), notes. Order by time; "ממתין" steps for recipients who have not acknowledged | `events.read` (floor); "אודיט מלא" link requires `audit.read` | names of door openers follow `access.events.read` (the step shows "פתיחת דלת" without the person) |

Actions on the page, all existing and already permissioned:

| Action | Existing endpoint / permission | Notes |
|---|---|---|
| אישור קבלה | `POST /incidents/{id}/ack` (new, same shape as `POST /events/{id}/ack`) → one chain step; also acks the source event (`events.ack`) | first acknowledger is shown in the facts strip; everyone with `events.ack` may acknowledge |
| הוסף לתיק | the existing case picker (`casePick`, `cases.manage`) with `{kind:'incident'}` → the case gets the incident link and the suggested cameras exactly as the event page's M064 route confirmation | |
| סגירת האירוע | `POST /incidents/{id}/close` (`events.ack`) with an optional note; audited | closing does not ack the alarm panel and does not touch the NVR |
| Links out | event page, full player (`/investigate/playback?camera=&t=`), live map (`/explore/floors/<id>`), history map (`/investigate/floors/<id>?t=`), door page, elevators page, audit | each target enforces its own permission |

Not on the page, by design: door open / lock, emergency open / lock (`access.emergency.*`), alarm arm / disarm / zone bypass
(`alarm.arm`, `/zones/{id}/bypass`), PTZ, generator start / stop, elevator commands, notification sending. If the owner wants any
of them later, it is a separate change record with its own approval (the AGENTS.md physical-actions rule).

## 5. Performance with several live streams

Lab facts (memory `project-lab-video-facts`, 2026-09-14): WebRTC through go2rtc decodes only the NVR **sub** profile (main =
PLI storm, no frame); main needs MSE and starts in 8-12 s (GOP ≈ 8 s); timeouts 12 s WebRTC / 20 s MSE; the player's auto mode
ends up WebRTC for tiles and MSE for a single main view. Therefore:

- The page always asks the **sub** profile (`profile="sub"`, never `autoProfile`), transport auto (WebRTC first, MSE fallback for
  the focused tile only - a 20 s MSE start on four tiles would defeat the purpose).
- **Desktop budget** `incident.max_live` default 4 (1..6, Q5). Tiles beyond the budget are drawn with the last snapshot
  (`/media/snapshot`, the existing thumbnails) and a "הפעלה" tap that swaps one live tile out (the live wall's `allocateLive(order,
  wanted, current, cap)` in `api/live-budget.ts`, with the page's order = the suggestion ranking).
- The page counts against the existing caps: `media.max_live_sessions` (default 16) and `remote.max_live_streams` via
  `effectiveLiveCap(mediaCap, remoteCap)`; the cameras panel shows the live count (the "4 of 16" cap text moves to a tooltip in v2). A 429 from `remote_cap_refusal` turns the tile
  into the snapshot + "המכסה מלאה" state (the existing `liveCapTitle`).
- **Phone**: one live tile (the event's camera), the rest snapshots that refresh every 10 s; tapping a snapshot swaps the live tile
  (the lab's SourceBuffer limit and the Companion WebView budget). Owner decision 2026-10-24: 4 live tiles on a desktop, 1 on a phone (the v2 mockup
  drops the all-live comparison switch).
- Leaving the page (route change, tab hidden > 30 s) stops every player (`active=false`); the page never keeps streams alive in the
  background. Re-entering restores them in ranking order.
- Camera offline / failed within `WEBRTC_CONNECT_MS` (5 s) and MSE fallback failed: the tile becomes the offline state (mockup
  state "מצלמה לא זמינה") and the player retries with the existing backoff; it never blocks the other tiles.
- Data refresh: events through the existing `/events/ws` (`event_added` already filtered to what the caller may see); doors, elevators
  and generator through their existing polls (10 s while the page is visible, none while hidden); the chain through a single
  `GET /incidents/{id}` every 10 s (one row + steps, no joins against the video path).
- Nothing new on the media path: no new go2rtc streams, no transcoding, no main-profile requests, no change to the relay.

## 6. Data, audit, retention, default OFF

**New tables** (one migration, next free number at build time):

- `incidents(id, status open|closed, source alarm|event|notification|manual|rule, source_ref, title, building_id, floor_id, anchor_id?,
  x?, y?, zone?, opened_at, opened_by (username, 'system' for auto), closed_at?, closed_by?, close_note?, facts_json)`.
  `facts_json` is a snapshot taken at open time (event label, suggested camera ids and names, door entity ids and names): the
  incident stays readable after the events it refers to are pruned (`events.retention_days` default 30 < incident retention).
- `incident_steps(id, incident_id, at, kind opened|notified|acked|door_open|door_state|note|event_added|closed, actor?, actor_kind
  user|system|access_control, ref_type?, ref_id?, text)` - the chain; mirrored from the audit rows and the external facts at the
  time they happen (not re-derived on every read).

**Audit** (`audit(conn, actor=, action=, decision=, resource_type='incident', resource_id=, request_id=, details=)`): `incident.open`
(details: source, floor, auto / manual), `incident.ack`, `incident.note`, `incident.close` (details: note, duration,
acknowledgers). Opening the page is NOT audited per view (the event page does not either; the owner may ask for it - Q6). Video
sessions started from the page are audited exactly as the live wall's are today (no change).

**Retention**: `incidents.retention_days` default 365 (`INT_KEYS`, `Field(ge=30, le=3650)`), pruned by the janitor (`main.py:36-46`)
with the audit rows kept by `audit.retention_days` as today; the closed-incidents list shows "נשמרים 365 ימים". Snapshots are not
stored by the incident (the thumbnails module keeps its own retention); recordings stay on the NVR.

**Default OFF**: `incident.enabled = "false"` in `routers/settings.py DEFAULTS`, exposed by `/me` as `modules.incidents`
(`routers/me.py`), frontend `applyIncidentsHidden(settings)` / `INCIDENTS_OFF` on the `applyTicketsHidden` pattern (`nav.ts:745-758`).
While off: the page is not in the row, every `#/investigate/incidents*` route answers "המודול כבוי" with a settings link for
`system.configure` only, no trigger button is drawn anywhere (alarm screen, event page, map, notification rows), the alarm hook does
not open incidents, and the pill / dots are never drawn. Switch: Settings › אבטחה › a card "מצב אירוע חי" (`system.configure`) with
`incident.enabled`, `incident.auto_open.alarm`, `incident.max_live`, `incident.merge_window_s`, `incidents.retention_days`.

**Permissions**: no new permission key. Page = `events.read`; acknowledge / close = `events.ack`; panels by their own keys (§4).
`TAB_PERMISSIONS['#/investigate/incidents'] = ['events.read']`. The server never trusts a client flag (AGENTS.md).

## 7. Test plan

Backend (`tests/test_liveevent_100.py`, fakes):

| Id | Test |
|---|---|
| B-01 | module off: every `/incidents*` route 404/403 "module off", the alarm hook opens nothing, `/me.modules.incidents=false` |
| B-02 | open from alarm (auto ON) / event / manual; merge window attaches a second trigger as a step; different floors → two incidents |
| B-03 | `GET /incidents/{id}` filtered by floor scope: a viewer with `events.read` on floor A gets 403 for floor B; the suggested cameras exclude cameras outside `row_scope` |
| B-04 | doors panel: "who opened" present only with `access.events.read`; state present with `entity.state.read` |
| B-05 | elevators / generator halves follow `devices.read` / `generator.view` |
| B-06 | ack / close: audited with actor, username; first acknowledger; close note; acking the source event |
| B-07 | chain mirrors the notification ack, the door-open audit row, the event ack - in time order |
| B-08 | retention: janitor prunes closed incidents older than `incidents.retention_days`, never an open one; `facts_json` survives event pruning |
| B-09 | settings bounds (`max_live` 1..6, `retention_days` 30..3650, `merge_window_s` 0..3600) |

Frontend (Playwright, evidence + layout + unit):

| Id | Test |
|---|---|
| F-01 | `unit-incidents-nav.spec.ts`: tab offered only with `events.read` and the module on; red dot / pill follow the open count; legacy fallbacks |
| F-02 | `evidence-incidents.spec.ts`: the four panels, the forbidden camera panel, the hidden infra panel, the "מי פתח" column, the actions per role (viewer sees none) |
| F-03 | `evidence-incidents-live.spec.ts` (bundled Chromium with the fake media server): at most `max_live` players active; snapshot tiles beyond; swap on tap; players stopped on route change and on hidden > 30 s; 429 → cap state |
| F-04 | `layout-incidents.spec.ts`: 1366x768 / 1920x1080 / 390x844 (+ 1024x768, 1280x720, 768x1024), light + dark, NO scrolling at all (owner hard rule 2026-10-24): `scrollTop == 0`, `scrollHeight <= clientHeight`, `scrollWidth <= clientWidth`, no element clipped by an overflow ancestor, no inner overflow, 44-px targets on the phone, the plan not mirrored (geometry assert as in the map specs) |
| F-05 | states: loading / error / module off / no event / camera offline (the player's failure path) |
| F-06 | deep link from a notification opens the page and the notification ack appears as a chain step |

Lab (real NVR, read-only, owner's standing test permission of 2026-10-20): four sub-profile WebRTC tiles on the page in real
Chrome (`SW_CHROME=1`) - time to first frame per tile, CPU on the HA host and on the workstation, behaviour when one camera is
unplugged (offline tile, others unaffected), and the phone (Companion) with one live tile. Reported as measured, NOT_RUN until run.

## 8. Slices

| Slice | Content | Size |
|---|---|---|
| S1 | backend: tables + migration, `incidents` service and router (open / get / list / ack / close), settings keys (OFF), audit, janitor, B-01..B-09 | M |
| S2 | page: route + tab + head + facts + map panel + actor chain + the no-event list, states, F-01 / F-02 / F-04 / F-05 (without video) | M |
| S3 | cameras panel: suggestion ranking, live budget, snapshot tiles, swap, offline state, F-03 | M |
| S4 | doors + elevators + generator panels, the "who opened" join, B-04 / B-05 parity | S |
| S5 | triggers: alarm hook (auto OFF), event page button, event row menu, notification link + chain mirroring, map "open here", manual open dialog, F-06 | M |
| S6 | lab measurement, phone tuning, release notes (he + en), settings card | S |

S1 and S2 can run in parallel on fakes; S3 needs S2; S4 and S5 need S1; S6 last. Default OFF means every slice can merge
without being visible.

## 9. Owner questions (recommendation first)

1. **Home of the screen. DECIDED 2026-10-24:** (a) with a red dot that can be disabled or lit only while an event is active. Options were: (a) security area › חקירה › "אירוע חי", plus the rail dot and the "אירוע פעיל" pill (recommended - §2);
   (b) a fourth level-1 section "אירוע" in the security area; (c) inside the service-management area (not recommended while it is
   being reorganised).
2. **Scope of the first version.** (a) the six slices as written, read-only, no physical action (recommended); (b) also a
   per-incident "notify again" button (sends the existing notification again - the only non-physical action not included).
3. **Automatic opening. DECIDED 2026-10-24:** (a) - burglary alarm only, OFF initially, editable. Options were: (a) from the intrusion alarm only, switch default OFF, the owner turns it on after the lab test
   (recommended); (b) also from rule alerts (per rule); (c) never automatically - manual and from notifications only.
4. **Merge window. DECIDED 2026-10-24: 5 minutes.** Options were: (a) 5 minutes (recommended); (b) 15 minutes; (c) no merging - every
   trigger its own incident.
5. **Live budget.** **DECIDED 2026-10-24:** (a) desktop 4 live tiles, phone 1 live + snapshots.
6. **Audit of viewing.** (a) open / ack / note / close only (recommended, like the event page); (b) also every page view
   (one audit row per viewer per incident).
7. **Retention** of closed incidents: (a) 365 days (recommended - longer than events, shorter than audit); (b) equal to
   `events.retention_days` (30); (c) equal to `audit.retention_days`.
8. **Phone order. DECIDED 2026-10-24:** (a) cameras first. Options were: (a) cameras first, then the map, doors, infrastructure, chain (recommended - the mockup); (b) the map first.

## 10. Owner review 2026-10-24 and the v2 layout

Source: `private/planning/OWNER_MOCKUP_REVIEW_2026-10-24_raw.txt`, item 10. **General rule from the owner: from now on no
scrolling at all in control screens.** This change is the first screen built to it; the rule is recorded here so that slices S2 / S3
and every later screen are held to it (F-04 asserts it).

### 10.1 Decisions applied

| Topic | Decision | Where in the mockup / record |
|---|---|---|
| Home | security > investigation; red dot, which can be disabled or lit only while an event is active (setting) | tab dot + rail dot; setting `incident.red_dot` = `active` (default) or `off`, in the settings sheet |
| Phone order | cameras first | phone: the part switch starts on "מצלמות" |
| Live tiles | 4 on a desktop, 1 on a phone | 2x2 grid; phone: one big live tile + 3 snapshots |
| Automatic opening | only from the burglary alarm, OFF initially, editable | settings sheet row; T5 (rules) dropped |
| Merge window | 5 minutes, editable | settings sheet; a merged event shows in the chain ("אירוע נוסף צורף") |
| Header clock | yes | wall-clock chip in the head (setting `incident.header_clock`, default on) |
| Chain of handling | wanted, but badly placed - fixed | side rail, see 10.2 |

New settings keys (all under Settings > Security > "מצב אירוע חי", `system.configure`): `incident.red_dot` (`active` | `off`),
`incident.header_clock` (bool, default true), next to the existing `incident.enabled`, `incident.auto_open.alarm`,
`incident.max_live` (desktop; a separate phone value, default 1), `incident.merge_window_s` (default 300). Assumption to confirm:
the red-dot setting governs the two dots only; the "אירוע פעיל" pill beside the corner pill stays while an incident is open.

### 10.2 Layout (no scrolling)

- **Desktop (>= 1200)**: one board that takes exactly the height left under the head; three columns, nothing scrolls, nothing is
  clipped. Column 1 (inline start, where the eye lands first in RTL): the floor plan, with the doors under it. Column 2: the four
  live cameras (2x2) and under them elevators + generator. Column 3 (side rail): the chain of handling as a compact vertical
  timeline (time, what, who; one row per step; pending recipients as a hollow dot). The old horizontal chain strip, the facts strip
  and the page-level scroll are gone.
- **Tablet / phone (<= 1199)**: the head (title, clock, acknowledge / to case / close / settings) stays; under it a four-part
  switch - cameras (default), map, doors and infrastructure, chain of handling. One part is on screen at a time and each part fits
  the space; nothing inside a part scrolls. The settings sheet is a fixed overlay and fits as well.
- Everything is derived from the viewport: panels either size to their content or fill what is left (`flex: 1; min-height: 0`),
  the plan letterboxes inside its box, the video tiles fill their cells. There is no `overflow: hidden` on the page frame, so a
  layout that does not fit shows up as a failing scroll assertion rather than as hidden content.
- Existing product component not changed by this rule: the level-2 tab row of the investigation section scrolls horizontally on a
  phone (11 tabs; `sw-tabs`). It is a navigation row, not screen content; flagged for the owner in case the rule should cover it.
- Honest limits: the mockup's own top bar (the state / role pickers) is part of the frame and is counted inside the viewport; on a
  1366x768 screen the board is therefore about 530 px high, a little less than a product screen would have, and the layout still fits.

### 10.3 Verification (mockup, Playwright, bundled Chromium)

Run against `docs/design/mockups/liveevent-100/index.html` for 1366x768, 1920x1080, phone 390x844 (touch emulation), plus
1024x768, 1280x720 and 768x1024 as extra sizes; states active, camera offline, permission-limited, no event, loading, error, module off;
light and dark; role "operator without infrastructure"; every phone part; the settings sheet open. Per case: scrollTop == 0,
scrollHeight <= clientHeight, scrollWidth <= clientWidth, no element outside the viewport, no element clipped by an overflow
ancestor, no inner overflow. Screenshots were looked at (`private/review/liveevent-100-v2/`, gitignored).

## 11. Build (branch `pilot/LIVEEVENT100B-295`, from the approved mockup v2)

Built: S1 (migration **0168**, built as provisional 0196; renumbered at the 2.16.0 integration, release/2160), S2, S3, S4, most of S5,
the settings card of S6. Deviations from the text above, recorded rather than silently resolved:

- Settings live in their own route (`GET|PUT /incidents/settings`, system.configure, every key bounded) instead of `routers/settings.py`
  DEFAULTS, to keep the shared settings router out of the change; `/me` carries `modules.incidents`. Extra editable keys (owner rule
  "all thresholds / timeouts editable"): `incident.max_live_phone`, `incident.snapshot_refresh_s`, `incident.refresh_s`,
  `incident.hidden_stop_s`, `incident.door_window_s`, `incident.near_radius_pct`. Recipients: the notification policy
  `incident.opened` (new subject kind `incident`, visibility = events.read at the incident's floor, acknowledge = events.ack).
- The notification's acknowledge, its pending recipients and the door-open commands (audit rows `intercom.release`, outcome phase) are
  read into the chain at read time (one notification + its events, the audit rows of the doors in the window), not mirrored as rows.
- "Add to case" uses the existing item kinds (`event` for an incident from an event, otherwise a `note`); no new `incident` case kind.
- Camera ranking is computed on the server from the map (same room, shared wall, radius, rest of the floor); `suggestAdjacent()` on the
  client is not used. The elevators / generator halves call the existing endpoints (no building filter: elevators carry an area only).
- Doors: "לדלת" opens the device screen (`#/devices?entity=`), where the existing per-action confirmation applies; there is no door page.

Not built (open): the map "open here" action and the alarm-screen button (T4 / part of T5), the explicit 429 "quota full" tile state
(the tile shows the player's own state), the lab measurement (S6), release notes.