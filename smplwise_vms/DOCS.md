# SmplWise Arx add-on (pilot 0.1.0)

Map-centred video management for a Hikvision NVR, served inside Home Assistant through Ingress.
This build contains the catalogue (sites → buildings → floors), architectural plan import (PDF / PNG /
JPG with page selection, rotation and crop), camera placement with view cones, server-side roles and
scopes, and an audit log. Live video, playback and events arrive in the following builds.

## Installation

1. Settings → Apps → App store → ⋮ → **Repositories** → paste
   `https://github.com/jonioliel/smplwise-bms` → **Add**.
2. Install **SmplWise Arx**. The Supervisor builds the image locally (a few minutes on first install).
3. Open the add-on **Configuration** tab:
   - `bootstrap_admin_username` — the Home Assistant **username** (not display name) that becomes the
     VMS system administrator. The grant happens once, on that user's first visit, and is written to
     the audit log. Leave everything else empty for now if you only want to try the maps.
   - `nvr_host`, `nvr_http_port`, `nvr_rtsp_port`, `nvr_username`, `nvr_password` — read-only ISAPI
     access used by "Sync cameras" and snapshots; the RTSP port is what go2rtc pulls video from. Prefer
     a dedicated non-admin NVR account. The add-on never changes NVR settings.
   - `go2rtc_url` — the external go2rtc API, e.g. `http://<ha-host>:1984` (the AlexxIT add-on). The
     product creates only streams named `smplwise_*` there and never touches other streams. Optional
     `go2rtc_api_username` / `go2rtc_api_password` if the go2rtc API is protected.
   - `wiskey_username`, `wiskey_password` — the RTSP account of the WisKey door stations, assumed the same on
     every station; the WisKey tab shows each station camera's still through go2rtc with it. A station with
     a different account gets its own in הגדרות › חיבורים › "מצלמות עמדות WisKey" (system administrator only;
     the stored account is never shown again, and each set/clear is audited without the password).
     go2rtc versions before 1.9.14 write a stream's source URL, including this account, to the go2rtc log each time
     SMPLWISE registers a station stream (after an add-on start, a go2rtc restart or a credential change). Use go2rtc
     1.9.14 or newer.
   - `openai_api_key` (optional) — the OpenAI API key for AI-rendered floor skins (see "AI-rendered floor skins"
     below). Stored only in the add-on options: never in the database, the logs, the audit log or an error message;
     the settings screen shows only whether it is set. Leave it empty and nothing can be sent to OpenAI.
   - `remote_access` (default `false`) and `remote_path` (default `/arx`) — SmplWise Arx remote access (CR-008):
     `https://<your HA hostname>/arx` opens the product with its own sign-in page (your Home Assistant username and
     password) through a Cloudflare tunnel path route. Off by default; while off, `/arx` answers 404 even if a tunnel
     route exists. See "Remote access (SmplWise Arx)" below and `docs/operations/ARX_CLOUDFLARE_GUIDE_HE.md`.
   - `db_write_gate` (default `true`) — database writes wait in one queue, in arrival order, instead of retrying on
     their own (the fix for the "database is locked" storm of test round 10). Leave it on; turn it off only when
     support asks, to compare. `/health` → `db.write_lock` shows `write_gate`, the queue (`gate`) and the waits.
   - WisKey (the `hikvision_intercom` integration) is reached through the add-on's own Home Assistant user (the
     Long-Lived Access Token in `ha_token`). WisKey authorizes that user by its own areas: viewing the WisKey tab
     needs the `overview`, `users` and `events` areas at `view`; **editing people from SMPLWISE (the person editor,
     permission `access.people.manage`) requires the `users` area at `manage`** (or an HA administrator), otherwise
     WisKey refuses every save as `unauthorized` and nothing is changed. This is a requirement stated from WisKey's
     source; it has not yet been verified against the lab installation. The WisKey tab's editor context shows
     whether WisKey lists the people commands for the add-on's user. Reading a card from a station's reader (card
     capture, `cards/*`) is in the same WisKey `users` area at `manage`.
4. Start the add-on and open it from the sidebar (**SmplWise Arx**). With NVR details set, the cameras
   appear by themselves within a minute (discovery at start-up and every 10 minutes); הגדרות → מצלמות
   → "סנכרון מה־NVR" refreshes immediately. If the list stays empty, check the add-on log and
   `/api/v1/health` (`discovery.cameras_last_error`).
5. Open הגדרות → **אשף התקנה** and work down the six steps until it says "מוכן לעבודה" (next section).

## Setup wizard (T071)

הגדרות → אשף התקנה (`#/system/wizard`, system administrators: `system.configure` at installation scope) checks the
installation in six steps and says, for each one that is not done, what is wrong, what to do next and where:

| Step | Done when | Evidence shown |
|---|---|---|
| 1. התקנת ה-Add-on | the database answers (the step's own check runs SQLite `quick_check`), `/data` is writable with at least 512 MB free | version, free space, system administrators, identity source, installation time zone |
| 2. חיבור ל-NVR | `deviceInfo` answers, the channel list is not empty, the clock drift is at most 30 s and the NVR's UTC offset matches the installation time zone now | model, firmware, channels (online / offline), channels with a main and a sub track, video profiles, clock drift, offset vs expected |
| 3. Home Assistant והגשר | the add-on's HA connection is live, the SMPLWISE Bridge is paired and loaded (no HA restart pending), HA's clock within 30 s | HA version, entities, bridge state and version, pending restart, HA clock drift and time zone, NVR-HA clock gap |
| 4. go2rtc | `/api` and `/api/streams` answer and, once cameras exist, `smplwise_` streams are present | version, our streams (active now), expected streams and the missing ones, the number of other products' streams (never their names) |
| 5. קומה ותוכנית | at least one floor has a published plan | sites / buildings / floors, floors with a published plan, floors without one |
| 6. מצלמה על המפה | at least one camera is placed on a plan | cameras (enabled), placed, with a known stream profile, unplaced ones |

- Status: **הושלם** (done), **לביצוע** (todo: configuration work remains, or a device step was not checked yet),
  **נכשל** (failed: a check found a problem) and **ממתין לשלב קודם** (skipped: the camera step waits for the NVR or
  the floor step). A step that is not done shows the problem, "מה עושים" (the concrete next action) and a link to the
  settings screen that fixes it; warnings (a clock a few seconds off, channels offline, streams missing, floors
  without a plan) do not stop a step from passing.
- Clock thresholds: a device clock within 2 s of the add-on's is fine, up to 30 s is a warning, beyond that the step
  fails. The NVR's UTC offset is compared with the installation time zone (הגדרות → כללי → וידאו ומדיה, "אזור זמן של האתר וה־NVR") at this moment: a wrong
  daylight-saving rule on the NVR fails the NVR step, because recording searches are made in the NVR's wall clock and
  would be an hour off. HA's clock is read from its API's `Date` header (one-second resolution).
- Reading the wizard (`GET /api/v1/setup/state`) never contacts a device: device steps show the last on-demand check
  for 10 minutes, otherwise what the add-on's own jobs know (camera discovery, the stream sync, the HA connection),
  labelled "לפי עבודות הרקע". Opening the screen checks each such step once; "בדוק שוב" on a step (or "בדוק הכול")
  runs `POST /api/v1/setup/check/{step}` - read-only calls to the NVR, go2rtc and Home Assistant, at most once per
  user and step every 5 seconds (429 otherwise, and the screen says how long to wait). Every check is audited as
  `setup.check` with its outcome. Nothing in the wizard writes to the NVR, go2rtc or Home Assistant; the fixes it
  links to are the existing screens, with their own permissions and confirmations.
- While steps remain, a system administrator sees "השלם את ההתקנה · n מתוך 6 שלבים הושלמו" above every screen, with a
  link to the wizard; × hides it until the browser session ends.
- Without a backend (the design preview) the wizard shows fixture data.

## NVR-less mode (Home Assistant only)

The add-on also runs without a Hikvision NVR, for an installation that uses it for electricity and device control only.

- **How to install for electricity only.** Leave `nvr_host` empty in the add-on Configuration (with `nvr_username` /
  `nvr_password`). The add-on then starts in the `ha_only` installation mode; the log says so in one INFO line at
  start-up. `go2rtc_url` is optional (only WisKey station video uses it). Home Assistant is connected automatically
  through the Supervisor, as always.
- **What works.** The map (sites, floors, plans, 3D, HA entity anchors), חשמל והתקנים (device control), WisKey,
  settings, users and roles, backup and restore - unchanged.
- **What is hidden.** For every user, regardless of role: the live overview and cameras, events, the historical map,
  recordings and synchronized playback, cases, rules, search and exports, and camera health. A direct link to one of
  them shows a "מצב ללא NVR" panel that points at the add-on options. The server refuses the NVR routes itself with
  409 `nvr_not_configured` (hidden is not unprotected; every route keeps its permission check). The Lovelace card falls
  back to the map for its NVR views. The storage page shows the add-on's own disk only; the video settings tab shows a
  neutral notice instead of video forms.
- **Health and the wizard.** The NVR shows as "לא מוגדר" (neutral, never red); no NVR job (camera discovery, alert
  stream, derived events, thumbnails, exports) runs or is reported. The setup wizard marks the NVR and camera steps
  "דילוג - מצב ללא NVR" (and go2rtc as optional while neither it nor the WisKey credentials are configured);
  "מוכן לעבודה" is reached with the remaining steps. Home Assistant is the product in this mode: missing, or
  disconnected for more than a minute, it is shown as an error.
- **Adding the NVR later.** Fill `nvr_host`, `nvr_username` and `nvr_password` and restart the add-on. The mode is
  derived from the options on every start and nothing in the data depends on it: no migration, maps, plans and
  permissions stay as they are, and the camera areas appear. Removing the host again returns to the NVR-less mode.

Design note: `docs/operations/NVR_LESS_MODE.md`.

## Identity and access

- Users are Home Assistant users. The Supervisor forwards the authenticated user with every Ingress
  request; the add-on trusts that identity only when the request comes from the Supervisor proxy.
- Nobody has access until a VMS administrator assigns a role in a scope (site, building, floor).
  Home Assistant admin status grants nothing inside the product, and the product never changes HA
  users, groups or admin flags.
- Every decision, upload, publish and placement is recorded in the audit log (no secrets).

## Data and backups

- הגדרות → גיבוי ושחזור keeps project backups inside the add-on (`/data/backups`): one is written
  automatically before every version upgrade (the last five are kept) and one a day (the last seven),
  and "צור גיבוי" writes one on request. A backup is a zip with the project data (sites, buildings,
  floors, plan files and versions, pins, cameras, rooms and zones, settings; users and permissions are
  included but only restored on request) and can be downloaded to a computer or uploaded into a fresh
  installation. "שחזר" loads a backup after typing RESTORE, either replacing the current project data or
  merging the missing items; the administrator who restores keeps access, and the restore is audited.
  Backups never contain the NVR or HA credentials (those live in the add-on options) and never video.
- Rollback after a bad upgrade: install the previous version from Home Assistant, then restore the
  "לפני עדכון" backup with "החלפה".

- Everything lives in `/data` (SQLite database + original plan files + derived images) and is
  included in Home Assistant backups (`backup: hot`).
- Original plan uploads are never modified; backgrounds are derived and can be regenerated.

## Live video

- Browser ↔ add-on WebSocket relay ↔ go2rtc. The browser never learns the go2rtc address or any
  RTSP URL; every stream request is authorized per camera (a viewer sees only cameras anchored on
  floors in their scope).
- Transport: **MSE** is the default (fMP4 over the relay socket: works through Ingress, Cloudflare
  tunnels and behind CGNAT). **WebRTC** gives the lowest latency but needs UDP between the browser
  and the go2rtc host (fine on the LAN, not through a tunnel or CGNAT); `auto` tries WebRTC and
  falls back to MSE. The product default is set in Settings → וידאו ומדיה; every player can
  override it for the current browser.
- What to expect with a Hikvision NVR (measured on the pilot lab, Chrome): the **sub** profile (H.264
  Baseline 640×360) plays over WebRTC within a few seconds; the **main** profile (H.264 Main
  2560×1440) connects over WebRTC but browsers do not decode it from RTP, so `auto` switches to MSE
  after ~12 s. MSE shows the first frame only at the next key frame — with the NVR's ~8 s GOP that is
  8–12 s. Failed streams retry with back-off (3 s → 30 s); a denied camera or a quota hit is shown as
  such and never as "live".
- First open the streams in go2rtc: Settings → וידאו ומדיה → **סנכרון זרמים** (system.configure).
  Only `smplwise_*` streams are created or updated; other streams on the same go2rtc are listed as
  "foreign" and never touched.
- Camera tiles show a fresh NVR snapshot (read-only ISAPI picture, cached in /data for
  `snapshots.max_age_s`) until the stream plays.
- Session cap (`media.max_live_sessions`, default 16, was 8; a saved value is kept) protects the NVR; the wall and the kiosk use sub
  streams, the single-camera view the main stream. Tiles beyond the cap show the snapshot only.

## Recordings and playback

- הקלטות (Playback) searches the NVR for one local day per camera (`GET /api/v1/cameras/{id}/recordings?date=`).
  The search is read-only, paged, serialized (the NVR allows one search at a time) and reports
  `coverage: complete | partial` — a truncated search is never shown as "no recordings".
- Times: the NVR speaks its local wall clock; the add-on converts with the IANA zone in Settings →
  וידאו ומדיה → אזור זמן (default `Asia/Jerusalem`, DST-aware). Every API time is UTC (`Z`).
- A playback session is one go2rtc stream (`smplwise_pb_<session>_g<generation>`) built from the NVR's
  RTSP playback URL. Clicking the timeline or ±10 s seeks: the old stream is deleted, a new generation is
  created, and a socket of the old generation is closed (code 4410) so no old frame can appear.
  Sessions are capped (`playback.max_sessions`) and expire after `playback.lease_s` without a socket;
  leftovers are removed on start-up. Precision is labelled `keyframe_limited`: the first frame is the
  key frame at or after the requested time (typically 2–4 s to first frame on the lab NVR).
- A gap is shown as a gap. Requesting a time without recording starts at the next segment (and says
  so) or reports "no recording" — it never switches to live.

## Events

- Two sources, both labelled: **measured** alerts from the NVR's alert stream (`/ISAPI/Event/notification/alertStream`,
  read-only, reconnecting, heartbeat used as a health signal, gaps recorded as `coverage_gap`), and
  **inferred** events derived from the recording search (every motion/alarm recording file is an event
  with confidence `inferred`). Inferred events are never shown as measured alerts.
- The NVR only sends an alert to the stream when the trigger's linkage includes **Notify Surveillance
  Center**. On the pilot NVR motion and intrusion triggers are linked to "record" and "white light" only,
  so the stream carries heartbeats but no motion alerts until that linkage is enabled in the NVR
  (Configuration → Event → … → Linkage Method → Notify Surveillance Center). The add-on never changes NVR
  settings.
- אירועים (Event centre): day/type/camera/unacked filters, live updates over a WebSocket, acknowledge
  (`events.ack`, audited), "נגן כאן" plays the recording from two seconds before the event inside the
  event drawer (a normal playback session, closed with the drawer) and "להקלטה" opens the full playback
  screen at that time. Markers also appear on the playback timeline. Retention: `events.retention_days`
  (default 30).
- Event pictures: the NVR keeps no snapshots for these events, so the add-on grabs one frame from the
  recording at the event time (ffmpeg on the RTSP playback stream, 480 px wide) lazily, one at a time,
  for the events the centre shows first; rows show a shimmer until the picture is ready, failures are
  remembered for an hour and the picture is never a live frame. Files live under `/data/thumbs`
  (pruned with the events retention, capped at 200 MB).

## Historical map

- חקירה → מפה היסטורית (or "המשך חקירה במפה" on an event page) shows the floor at a chosen instant: a
  camera pin is blue when a recording covers that instant and dashed when there is none or the NVR could
  not be asked; HA entities are always shown as "לא ידוע" because no state history is stored yet — the
  map never shows the last live value as if it were the past. The side panel lists the events around
  the instant and the recording segment of the selected camera; the timeline at the bottom scrubs the
  day (segments and event ticks), the date picker changes the day. "נגן מכאן" opens playback at that
  instant; "חזרה למצב חי" returns to the live map. No equipment can be operated from this screen. The
  side panel also shows a frame from the selected camera's recording at the chosen instant (a few seconds
  the first time, cached afterwards); in playback, hovering the timeline shows the same kind of preview.
- Placed HA entities show the state the local history knows for that instant (door open / closed, lock locked,
  light on) with the time it changed, or "לא ידוע" with the reason: before the local history began, no state
  recorded, or the last confirmation is older than 24 hours with nothing later to bound it. The history starts
  when the add-on first connected to Home Assistant and keeps 30 days; nothing is forward-filled without a bound.

## Event page

- "סקירה מלאה" in the event centre (or a click on a nearby event) opens the event's own page: the
  recording plays from two seconds before the event; the event time and the time of the frame being
  played are shown separately because playback starts on a keyframe. The context card shows whether the
  event was handled and by whom, its source (NVR alert, derived from a recording, system), type, start
  time, window duration and repeats, and where the camera sits: building, floor and the room or zone
  containing the pin, with the floor plan and the pin highlighted. "המשך חקירה במפה" opens that floor;
  "הנגן המלא עם ציר הזמן" opens playback at the event; "סמן כטופל" is recorded in the audit log under
  the user's name. Events from the same ten minutes are listed for context; a nearby event is context,
  not proof of a causal link.
- The centre's tabs: לבדיקה (not yet handled), הכל, טופלו. "חלונות" switches the list to review
  windows: adjacent events of the same camera (gap of 1 to 10 minutes, selectable) become one row with
  the dominant type and count; opening a window shows its raw events, "סמן הכל כטופל" handles them
  together and "סקירה מלאה" opens the event page. The raw events are never merged or deleted.

## Export

- ייצוא (Export) from the playback screen: pick a range on the selected day, get an estimate (number of
  NVR files and bytes), confirm, and follow the job under ניגון → ייצוא. Jobs are durable rows; one
  download at a time; progress is byte-based; cancel and partial results are honest states.
- The lab NVR only supports download **by file** (KNOWN_QUIRKS S4), so the add-on downloads the whole
  recording files overlapping the range and then, with ffmpeg (in the image), remuxes the Hikvision PS
  container to MP4 (H.264 copied, G.711 audio to AAC), concatenates and trims to the requested range at
  key frames. The manifest records requested vs. actual range, source files, pipeline version and
  SHA-256. Without ffmpeg the original PS files are delivered as `.mpg` (VLC plays them) and marked so.
- Export needs the explicit `video.export` permission (operator, site_admin, system_admin). Files are
  deleted after `exports.retention_days`; jobs above `exports.max_mb` are refused up front.

## Multi-camera playback

- On the playback screen, "השוואה" adds up to three more cameras: one reference time and generation,
  a session per camera, the timeline follows the leading camera and each tile shows its drift. Without a
  verified PTS↔UTC anchor this is labelled best effort (chapter 25); a camera without a recording at that
  time is shown as such, never as a frozen frame.

## Designs "SW A" and "SW B"

- Two designs ship: **SW A** (the 50-screen handoff v1.3: right icon rail with the four areas, 72 px
  top bar with breadcrumbs/search/user, 26 px page titles, the SW A tokens) and **SW B** (the earlier
  boards). הגדרות → כללי → "עיצוב הממשק" sets the installation default (`ui.design`), renames both
  (`ui.design_names`) and lets each browser keep its own choice. `?design=a|b` on the URL forces one.
  Without a backend (design preview) the page stays on SW B.

## Search

- The search field in the top bar (Ctrl+K or ⌘K) finds rooms and zones, cameras (by name or channel
  number), floors, buildings and Home Assistant entities, and shows where each one is. Choosing a room
  opens its floor with the room highlighted and zoomed in; a camera or entity placed on a plan opens its
  card on the map; a camera that is not placed opens its live view. Only rooms marked "הכללה בחיפוש
  מרחבי" appear, and every user sees only what their roles allow. Events are searched in the event
  centre with its own filters.

## Floor map

- The map shows the published plan with the pins on it; the floor chip names the floor, the zoom
  controls sit at the bottom-left (scroll or pinch also zooms, dragging pans) and the legend at the
  bottom-right. "שכבות" opens a panel with one switch per layer and its count (cameras, doors and
  intercom, lighting, security and sensors, room names); a switch only changes what is drawn and never
  operates equipment. Room names are shown when the room is wide enough on screen.
- "בחירת מצלמות" switches the map into a picker: clicks add or remove cameras (or "בחר הכל"), then
  "קיר חי" shows exactly those cameras on the live wall and "ניגון מסונכרן" opens playback with the
  first one leading and up to three more following it.
- Clicking a camera pin opens its card: the live picture plays inside the card (a session for that card
  only; closing the card releases it), with the camera's status, its location (floor and the room or
  zone the pin sits in), "צפייה מלאה" for the full-screen view and "הקלטות" for playback. Escape closes
  the card and returns keyboard focus to the pin. Entity pins open the same card with the entity's
  state and the actions the user is allowed to run through the bridge.

## AI-rendered floor skins (preview: the foundation only)

A later version will ask an image provider (OpenAI, the owner's choice) to turn the product's own 3D picture of a floor
into a photoreal one, once per floor, and keep the answer for reuse. This version has the groundwork only; no floor
picture is sent anywhere yet.

- **Key.** Set the add-on option `openai_api_key`. Without it nothing can be sent.
- **What may leave the installation** (הגדרות › וידאו ומדיה › "סקינים מרונדרים (AI)" lists it word for word): the
  product's schematic control image of the floor - an isometric render of walls, openings, floors, furniture and room
  colour, **without any labels** - and, only when the sender chooses it for a particular send, the original plan image.
  Never camera stills, people, labels, room or entity names, sensor states or Home Assistant data.
- **Privacy acknowledgement.** Off by default. While it is off nothing is sent, not even the connection test.
- **Budget.** "רינדורים לקומה" (default 4, per floor and structure version) and "רינדורים בחודש" (default 20, per
  installation and calendar month, connection tests included). The card shows how many were used this month and a
  rough cost estimate per floor render (an estimate, not a price list; the real charge is on the OpenAI account).
- **"בדיקת חיבור לספק הרינדור"** (system administrators): with the key set and the acknowledgement on, sends ONE
  synthetic 64x64 test pattern (colour bars and a checkerboard - not a plan) with a fixed prompt, and shows the
  provider's answer (HTTP status, and the returned picture when there is one). It is recorded, audited and counted in
  the monthly budget. Without the acknowledgement or the key it refuses with a message and sends nothing.
- **"תמונות בקרה"** (the floor map's 3D view, map editors): captures the floor's two control images (every light off /
  every light on) from the published structure, without labels, names, cameras or live states, and stores them in the
  add-on's data folder only. Nothing is sent. They are deleted with the floor.

## Plan import: rotation and crop

- The wizard shows the page already rotated by the server; the crop rectangle is drawn with the mouse
  directly over that picture (or typed as percentages), and rotating again resets the crop. What is
  inside the dashed rectangle is exactly what the saved version contains; the original file is never
  modified.

## Alarm rules and alerts

- חקירה › חוקים והתראות: a rule is trigger × scope × time window × cooldown. Trigger = event types (motion,
  door, offline, …), sources (NVR alert, derived from recording, HA sensor, system) and a minimum severity;
  scope = floors, rooms / zones and cameras, resolved through the pins on the floor plan (an empty scope means the
  whole installation); the window is in the site's time zone and may cross midnight; the cooldown suppresses
  repeats per rule and camera (or sensor), measured between event times.
- The only action is a notification inside the VMS (the "התראות" tab, acknowledged by name). No device
  commands, no webhooks, no Home Assistant services — a rule can never feed itself or another rule, and a
  rule you keep in Home Assistant is stored here as a reference only, so nothing fires twice.
- "הרצה יבשה" replays the stored events of the last 24 hours (up to 14 days through the API) through the same
  matcher and lists every event with the reason it would or would not have raised an alert. It writes nothing.
  Managing rules needs the rules.manage permission (site admin at installation scope, system admin).

## Wall display (kiosk)

- Open #/kiosk/all on the wall screen. The saved view is the URL: `cameras=a,b,c` (ids from the live wall's
  multi-selection), `cols=2..4`, `rotate=30` (seconds per page; 0 = no rotation). The wall shows live tiles,
  the clock, a system health pill and nothing else: no menus, no settings, no unlock. After three failed health
  polls it dims and says the server is unreachable; the first successful poll reloads the tiles. An offline
  camera is shown as offline, never as a live feed.
- Give the wall its own Home Assistant user and bind it to the "תצוגת קיוסק" role: map and live video only.

## Suggested path after an event

- The event page of a placed camera lists "המשך מסלול מוצע": cameras in the same room, in adjacent rooms and
  within reach on the floor plan, ranked, with the activity each reported in the window and a play button at
  the event time. It is a hypothesis from the map's topology — never a claim that it is the same person or
  vehicle — and it never triggers anything; the operator confirms the sequence in a case.

## Searching events by place and source

- חקירה › מרכז אירועים filters by camera, type, date, place and source. "מקום" lists the floors with what is
  placed on them; choosing a floor offers its rooms and zones. An event belongs to a place through the current
  pin of its camera (or of its HA sensor) on the floor plan, so the place filter works only for placed items.
- The line above the list names the fields that have data in the last 90 days and the ones that do not, with
  the reason (hover): the lab NVR sends motion alerts only, so person, vehicle, line-crossing and intrusion
  filters cannot match until smart events are configured on the cameras. Such a filter shows "המסנן אינו
  נתמך כאן" instead of an empty list that would look like "nothing happened".

## Door–camera–sensor correlation

- Transitions of door / window contacts, motion sensors, locks and gates in Home Assistant are recorded as
  events under the sensor's name (source "חיישן HA"), including a sensor going unavailable.
- Every event page shows "קורלציה דלת–מצלמה–חיישן": the sensors and locks placed near the camera on the floor
  plan (the same room, or within a room-scale radius), what they reported within ±2 minutes, unlock commands
  sent from the VMS and the neighbouring cameras' events. Each line carries its certainty: "נמדד" (a sensor
  transition or an NVR alert), "נגזר" (derived from recording metadata), "פקודה" (a command that was sent — it
  is never proof that the door opened; the confirmation only says the entity reported the expected state).
- The card names what it cannot know: a device clock that reported the event long before it arrived, a sensor
  without a state, an unplaced camera (time-only comparison). Nothing is unlocked, disarmed or triggered from a
  correlation or from video analysis.

## NVR storage and recording plan

- מערכת › אחסון reads the NVR only: disks and free space, the recording plan of every camera (continuous /
  motion, days, pre/post seconds, bitrate and resolution) and retention. "נמדד" is the oldest recording the
  NVR still has for each camera (a bounded search 120 days back); "אומדן" is capacity divided by the
  configured bitrates as if every camera recorded continuously, so motion-based cameras keep more in
  practice. Each number carries its reason. The report is cached for ten minutes; "רענון מול ה־NVR" asks again.
- Nothing on this screen changes the device: no format, RAID, deletion, quota or schedule edits (the lab NVR
  also refuses the quota and overwrite endpoints, which is stated on the screen). Only the system admin sees it.

## Investigation cases

- חקירה › תיקים lists the cases; a case is opened from an event page ("הוסף לתיק"), from the playback screen
  (a clip around the cursor: 15 s before, 45 s after) or from the historical map (the selected camera around
  the chosen instant), or with "תיק חדש" in the list. Notes are written on the case page.
- Every item shows what it really is: "סימנייה ל־NVR בלבד" points at the recording on the NVR and can still be
  overwritten; "שמור עותק" starts an export job (T048) and the item becomes "עותק שמור" only when the copy is
  complete; "חסר" means the NVR no longer has the footage (it is never called preserved); "לא נבדק" means the
  NVR could not be asked. Closing a case stops new items; deleting a case removes its items only.
- "צלם תמונה לתיק" copies one picture from a camera into the case (a real copy, hashed, "עותק שמור").
  "צור חבילת ראיות" writes one ZIP: preserved clips with their export manifests, snapshots, notes, a manifest
  with SHA-256 per file and a readable report; bookmarks that were never preserved are listed as skipped.
  "אימות חבילה" recomputes the hashes of any bundle file and reports each entry. The hash proves integrity since
  the bundle was made, not authenticity against the camera (the manifest signature is described under "Limits").
- Bundle import (T050): "ייבוא חבילת ראיות" on the cases list takes a bundle ZIP made by another installation (or
  by this one, earlier), verifies it first and shows a report: every file of the manifest as תואם / שונה / חסר /
  פגום with its size, files the manifest does not list, the manifest version, the producing installation (its id,
  SMPLWISE version, export time and exporter), whether that is this installation, the signature verdict and a
  plain-language summary. "ייבא כתיק" is enabled only when everything matched; it creates a NEW case marked
  "מיובא" with a provenance banner (source installation, exporter, export time, the bundle's SHA-256, "hash תואם"
  at import) and a "בדיקת hash חוזרת" button that re-hashes the stored copies. Clips and snapshots are copied under
  /data/imported/<bundle SHA-256>/ together with the manifest and its signature; notes become read-only imported
  notes; bookmarks the source never preserved stay as "לא נכלל בחבילת המקור". Imported items cannot be removed one
  by one; deleting the case removes them and their files. The same bundle is imported once (409 names the existing
  case); after that case is deleted it can be imported again.
- What verification proves: a matching SHA-256 per file (and an intact manifest) means the files did not change
  since the bundle was exported. A valid signature by a key of THIS installation also confirms that this
  installation produced it; a valid signature by an unknown key proves integrity only. The installation id in a
  manifest is a claim, confirmed only by that signature: the id is public (every bundle and the signing screen show
  it), so an unsigned bundle carrying this installation's id is reported and bannered as "לפי המזהה בלבד (לא מאושר
  בחתימה)", never as made here. What it does not prove: that the footage is genuine, that
  the camera clock was right, or anything about legal admissibility - the camera, the NVR and the network are
  outside every hash and signature.
- What an imported bundle may not do: nothing in it becomes a camera, an event, a plan, a user, a binding or a
  setting; source camera ids are kept as text only; report.html and notes.md are hashed but never stored to be
  shown; only clip / snapshot files whose names pass a strict allow-list reach the disk, served with their real
  type (JPEG / MP4 by signature, anything else as a download), nosniff and a sandbox policy. Archives with `..`,
  absolute paths, drive letters, backslashes, control characters, symlinks, encrypted entries, duplicate names, more
  than 5000 entries, a central directory larger than 5000 records could be, an extreme compression ratio or an
  uncompressed total above twice the upload cap are refused before anything is read (the entry count and the
  directory size are read from the archive's end records before the ZIP is indexed). Uploads are streamed to a
  temporary file (removed afterwards) and capped by the product setting `cases.import_max_mb` (default 512 MB,
  16-4096); an upload that stalls for 30 s or takes longer than 10 minutes is dropped with 408, freeing the slot.
  One verification or import runs at a time (another one gets 429 "busy"), and none starts - or goes on -
  when it would leave less than `storage.min_free_mb` (default 1024 MB) free on /data, where the database lives
  (507). "בדיקת hash חוזרת" runs one at a time and at most once a minute per case. Dates, names and texts from a
  bundle are validated and stripped of control and bidi-override characters before they are stored or shown.
- Permissions: verifying needs what reading cases needs (events.read somewhere); importing needs cases.manage for
  the whole installation (an imported case belongs to no camera here). Both are checked before the upload is read.
  Imported items are shown only to users who read every camera. Verification and import (allowed and refused) are
  audited. The imported bytes appear under מערכת › אחסון ("אחסון התוסף (/data)" › ראיות מיובאות) and in the
  health report, and leave with the case. Imported files are not part of project backups (like snapshots): after a
  backup restore an imported case comes back with its items marked "חסר" and still blocks a re-import of the same
  bundle (409 names it) - delete that case, then import the bundle again to get the files back.
- Managing cases (create, edit, add or remove items, preserve) needs the cases.manage permission — operators,
  site admins and the system admin have it; viewers see nothing here. Every change is audited.

## Floor plan editor

- Version history: the "גרסת תוכנית" card lists every version of the floor. "השווה" shows the two pictures side
  by side, the geometry change and what happens to every placed item; "פרסום גרסה" always goes through that
  preview. "שחזר" restores an archived version as a new published copy; pins follow whenever the geometry is
  identical, otherwise they stay where they were and the map marks them for a check. Published versions are
  never deleted, so the historical map can show the plan that was in force at any instant.
- Everything is done with the mouse on the plan: drag a pin to move it, drag the round handle in front
  of a selected camera to turn it, drag the two square handles at the edges of its cone to widen or
  narrow the field of view, scroll to zoom, drag the background to pan. Cameras and HA entities are
  added by picking them in the tool rail and clicking the spot on the plan. Arrow keys nudge the
  selection (Shift = larger step), Delete removes it, Ctrl+Z / Ctrl+Y undo and redo, Ctrl+S saves.
  The inspector mirrors the same values numerically (bearing, field of view, X/Y in percent).
- Bearing convention (design contract §ו): 0° points up on the plan and degrees grow clockwise; the
  cone is an illustration for planning, not measured coverage, and changing it never sends a PTZ
  command.
- Nothing is written until "שמירת מיקום" / "שמירה"; a stale revision (someone else edited) reloads
  the map instead of overwriting. Publishing a draft plan is a separate action.

## Stylized plan ("SMPLWISE language")

- The plan editor's "עיבוד לשפת SMPLWISE" turns the uploaded architectural drawing into a clean
  rendering in the design tokens: text, dimension lines and thin furniture outlines are removed, walls
  become grey-blue bands, enclosed rooms are painted white and the outside stays on the canvas colour.
  Three cleaning strengths: קל (thin walls kept as drawn), בינוני (double-line walls merged; the usual
  choice), חזק (dense drawings such as stairs or fixtures become solid blocks). Two more choices: the room
  fill (white, one soft tint per room so rooms read as distinct areas, or none) and whether furniture,
  doors and other thin lines from the drawing stay in a faint tone. "עבד תצוגה מקדימה" renders a
  comparison; "השתמש בתוצאה" makes it the map picture.
- It is local image processing in the add-on (Pillow + numpy); no AI, nothing leaves the device, it
  takes a few seconds per plan. Rooms are counted but not named and doorways are not recognised as
  such. The source picture is never modified: "הצג מקור" switches back at any time, and anchors keep
  their coordinates because the rendering has the same geometry as the source.

## Rooms and zones

- The plan editor's "חדרים ואזורים" tool puts named areas on the floor. "זהה חדרים" runs the local room
  detection on the plan (the same wall analysis as the stylized rendering, in three strengths) and
  proposes one polygon per enclosed room, drawn dashed on the map with rows to name each one, change
  its kind (חדר / אזור / מסדרון / חוץ / שירות) or leave it out; "שמור" stores the chosen ones. Any
  area can also be drawn by clicking its corners ("צייר אזור"; Enter or a click on the first corner
  closes it). Selecting a zone edits its name, kind, colour and whether it takes part in spatial search,
  and lists the cameras and HA entities that sit inside it. The selected zone can be reshaped on the
  map: drag a corner to move it, drag the small handle in the middle of an edge to add a corner, and
  double-click a corner to remove it (a zone keeps at least three); every change is saved at once. The
  viewer shows the names under the pins; the layer buttons hide them.
- Detection is local image processing (no AI, nothing leaves the device) and only proposes; it does
  not read room names off the drawing. Zones are a data layer next to the plan: they survive a change
  of rendering (source / SMPLWISE language) and are never burnt into the picture. A zone on the map is
  spatial context for search and rules only; it is not a camera detection zone and not a privacy mask,
  and it changes nothing on the NVR.

## Users, groups and roles

- Users come only from Home Assistant: the bridge integration pushes the user directory (id, name,
  username, active, admin flag, groups) every minute, and a person also appears when they open the
  add-on through Ingress. Nobody is created here, no passwords exist here, and the HA admin flag is shown
  as information only. הגדרות → משתמשים והרשאות lists everyone with their sync state, VMS groups and
  role bindings; "סנכרון משתמשים מ־HA" asks the integration for a push right away.
- A user disabled or deleted in Home Assistant loses access at the next directory push (within 60 s):
  new requests are refused, open live/playback sockets end within seconds, and the audit keeps the id.
  A current VMS administrator is never dropped merely because a push omitted them.
- Roles are the built-in catalogue (viewer, operator, editor, kiosk, site_admin, system_admin) plus custom
  roles; a binding is a role at a scope (whole installation, site, building or floor) for a user or a VMS
  group. System_admin and other system permissions can only be bound installation-wide, and the last active
  administrator cannot be removed. Each change bumps the permission revision, is audited with a before/after
  diff of the subject's bindings and takes effect immediately.
- WisKey embedded (owner decision 2026-09-28): by default the WisKey area shows your real WisKey panel from Home
  Assistant (`/hikvision-intercom`) inside SMPLWISE, as it is - including WisKey's own screens SMPLWISE never built
  (עמדות, סנכרון, בריאות, יומן שינויים, ניהול), each tab opening the matching WisKey screen. In הגדרות › בקרות כניסה
  (system administrator) you choose, for מרכז הכניסה, פעילות and אנשים, "WisKey (מוטמע)" or the SMPLWISE screen; the
  other WisKey screens are always embedded. Inside an embedded screen you are using WisKey itself with your own Home
  Assistant login, so WisKey's permissions, confirmations and log apply there, not SMPLWISE's. In particular, a user
  whose Home Assistant account holds WisKey `manage` (or who is a Home Assistant administrator) can release doors and
  edit people (PIN, cards, validity) inside the embedded WisKey without SMPLWISE's confirmation step and without an
  entry in SMPLWISE's audit - only WisKey's own log records it. SMPLWISE hides Home
  Assistant's sidebar around the panel where the Home Assistant version allows it (otherwise it stays visible and a
  note says so); the embedded screen loads a second copy of Home Assistant's interface, so it is slower than a
  SMPLWISE screen, especially on a phone. "פתח בחלון מלא" opens the same panel in its own tab. Nothing is embedded
  when the UI is opened outside Home Assistant; the screen then says so and offers the SMPLWISE screens.
  In the Home Assistant phone app nothing is embedded either: the app signs Home Assistant in through itself, and
  that sign-in does not reach a Home Assistant nested inside SMPLWISE. There, מרכז הכניסה, פעילות and אנשים show the
  SMPLWISE screens, the other WisKey tabs show a short note, and "פתח ב-WisKey" switches the app itself to the WisKey
  panel. The same happens in a browser when Home Assistant asks for a login inside the
  embedded frame (for example after signing in without "keep me logged in").
- WisKey (access control) permissions: `access.read` (viewer and above) shows the entry center, the activity log and
  the people directory; `access.release` (site_admin and system_admin only, sensitive) covers the physical actions -
  door release, call answer / reject / hang up, announcements; `access.people.manage` (site_admin and system_admin
  only, sensitive) opens the person editor - create, edit and delete people in WisKey with their PIN, cards, validity
  window and station assignments. To give one specific person the editor without the whole site_admin role, create a
  custom role that lists `access.people.manage` among its sensitive permissions and bind it to them at the
  installation scope. Every save is audited under the SMPLWISE user (field names and counts, never a PIN, card number
  or phone); WisKey's own log shows the add-on's HA user.
- Card capture (`access.cards.capture`, site_admin and system_admin only, sensitive; needed IN ADDITION to
  `access.people.manage`): in the person editor's cards section, "קריאת כרטיס מהאינטרקום" puts the reader of a chosen
  door station into card-collection mode (WisKey `cards/capture_start` - a physical action at a door, started only
  after a confirmation step), the person holds ONE card to the reader, WisKey shows it masked (`•••• 1234` - the full
  number never leaves WisKey), and only the administrator's approval ("הוספת הכרטיס וסנכרון", WisKey
  `cards/capture_confirm`) adds it to the person and asks WisKey to sync it to their stations - from that moment the
  card opens their doors. It is offered for a saved person whose form has no unsaved changes, as in WisKey. WisKey's
  limits apply: one capture per station and three in all (WisKey's own panel counts too), the reader waits up to 30 s
  for a card, and the session lasts 120 s; SMPLWISE also allows one open capture per user and cancels a capture
  whose dialog stopped asking for it for 20 s (the dialog then says so - a frozen tab or a sleeping laptop). The
  sessions SMPLWISE follows live in its memory: if the add-on restarts during a capture, WisKey keeps that session
  until its 120 s run out, the station stays busy meanwhile and a new capture there is refused
  (`intercom_capture_station_busy`) - wait two minutes. A capture belongs to the SMPLWISE user who started it - another user cannot see, cancel or
  approve it. Each start, cancel, approval and result (read / WisKey's timeout / expired) is audited under the real
  user without the card's number. A start or cancel WisKey does not clearly answer is shown as "unknown": the
  reader may still be in collection mode until WisKey's timeout, and that station is held meanwhile.
- A PIN generated in the person editor ("יצירת PIN ייחודי אוטומטית") is shown once in clear, with "העתק", so it can be
  handed over; it is hidden again once copied, hidden, saved or the form is closed. A copied PIN stays in the
  operating system's clipboard (and clipboard history, where that is on) until something else is copied - clear it
  after handing the PIN over.
  **The first real use is the live test.** Card capture was built against WisKey's source and a fixture only; WisKey's
  own panel still says "physical collection still needs commissioning". Not verified yet (UNVERIFIED): that a real
  station collects a card this way at all; whether a card that is ALREADY enrolled, presented during collection, is
  both read and opens the door (WisKey only says an authorized card "may still operate the lock"); how long the
  reader itself stays in collection mode after a cancel or timeout (firmware-controlled); that the add-on's HA user
  holds WisKey's `users:manage`. Do the first capture with someone at the door and check the door and the reader.
- Custom roles (תפקידים tab): a system administrator composes a role from ordinary permissions plus sensitive
  grants that must be ticked explicitly; a custom role never carries a system permission (configuration,
  role or binding management) and built-in roles cannot be edited. Before saving, the dialog shows the impact
  (bindings, users, groups, scopes, permissions added or removed); the change applies to every affected
  session on its next request, a stale edit is refused (revision), and a role that is still bound cannot be
  deleted. Custom roles are included in the settings backup.
- Delegated administration: a site administrator may assign roles inside their own site, subject to four
  limits — only roles on the delegation allowlist (edited on the same tab; built-in viewer/operator/editor/kiosk
  by default plus custom roles marked "ניתן להאצלה"), only roles whose permissions they themselves hold at that
  scope, only to users (never groups), and never a role with a system permission. Anything outside the limits
  is refused with a reason (`role_not_delegable`, `delegation_escalation`, `delegation_groups`) and audited.
- The wizard shows what the role allows at the chosen scope and what stays excluded (sensitive
  permissions such as export or entity control, other scopes). "הרשאות אפקטיביות" computes a user's
  real permissions at a scope on the server, without impersonation.

## Home Assistant entities and the bridge

- The add-on reads Home Assistant through the Supervisor proxy (`homeassistant_api: true`): entity,
  device, area and floor registries plus all states once at start-up, then `state_changed` events over
  the Core WebSocket. The result is a read-only catalogue (ישויות HA) with stable ids, area/floor names,
  disabled/hidden flags, tombstones for removed entities and a freshness flag that drops while the
  sync is disconnected. Nothing is placed or controllable by being imported.
- Placement: the plan editor's "הוספת ישות" searches the catalogue and pins an entity on a floor;
  the marker takes its layer from the domain (doors, lights, sensors) and shows the live state. Floor
  users only see entities placed on floors they may read.
- Actions never use the add-on's own token. They go through the **SMPLWISE Bridge** custom
  integration (`custom_components/smplwise_bridge`), which re-issues the service call with
  `Context(user_id=<the HA user behind the VMS session>)`, so Home Assistant's per-user entity
  permissions decide. Allow-list on both sides: light/switch/fan on-off, cover open/close/stop, lock
  lock/unlock, button press, script and scene start. Sensitive actions (unlock, open/close cover,
  button, script, scene) need an explicit confirmation; every request is idempotent by client id,
  audited, and reported as pending → confirmed (state observed after the request) / unknown /
  failed / denied. Until the integration is paired, actions are refused with `bridge_not_paired`.
- Authority on an action is checked twice (T079): the VMS checks `ha.entity.control` at the entity's floor
  (map editing is a different permission and grants nothing here) plus the action's own grant when it has one —
  unlocking a lock needs `door.unlock`, which no built-in role carries and only a custom role can hold; the card
  disables such a button and says why, and the refusal is audited as `grant_required` before anything is sent.
  Home Assistant then applies the user's own entity permissions, because the call runs in that user's context:
  its refusal is recorded as `ha_unauthorized` (or `ha_unknown_user` when the HA user behind the session no
  longer exists), shown in words and audited, and the bridge's own token being an administrator changes
  nothing. The request body is closed — it cannot carry a user id, a context or a raw service call — and only the
  allow-listed actions exist, so there is no generic service proxy.
- Installing the bridge (once): the add-on ships the integration and, with the `homeassistant_config`
  mapping, copies it to `<config>/custom_components/smplwise_bridge` at start-up (only that folder,
  only when missing or outdated) and announces it to the Supervisor discovery API. Restart Home
  Assistant once so the component loads, then confirm "SMPLWISE Bridge" under Settings → Devices &
  services (the pairing code is already filled in). Without the mapping, the manual path remains:
  copy the folder yourself or add the repository in HACS as a custom Integration repository, then add
  the integration and paste the add-on address and pairing code from הגדרות → גשר Home Assistant.
  Requests between the two are HMAC-SHA256 signed with a 60 s window and nonce replay protection.
  The integration also pushes the HA user directory (id, name, username, active, admin, groups) every
  minute so VMS roles can be granted to HA users. The settings tab shows the copy state (waiting for
  restart / active / update pending) and has a "התקן / עדכן" button that repeats the copy and the
  announcement.

## Lovelace cards

- The bridge integration serves `custom:smplwise-card` (resource `/smplwise_bridge/smplwise-card.js`, registered
  automatically when the integration loads; in YAML-mode dashboards add it as a module resource yourself). A card
  embeds one VMS screen through the add-on's Ingress page, so it needs no secret, creates no entity and cannot bypass
  a VMS role — the viewer is the Home Assistant user, exactly as in the sidebar panel.

  ```yaml
  type: custom:smplwise-card
  view: camera          # camera | map | events | health | wall
  camera: <camera id>   # for view: camera — the id in the VMS camera page URL
  floor: <floor id>     # for view: map
  height: 360
  title: כניסה ראשית
  ```

  Optional keys: `addon` (the add-on slug, default `0b8c26d5_smplwise_vms`) and `ingress_url` for a user whose
  Home Assistant account may not read add-on info. The card creates the Ingress session itself and keeps it
  alive while the dashboard is open. Screens inside the card open with `embed=1`, i.e. without the shell chrome.

## Remote access (SmplWise Arx)

CR-008 MVP. With the add-on option `remote_access: true`, `https://<your Arx hostname>/arx/` opens the product
directly (not the HA UI) with its own sign-in page. The Cloudflare side (a token-managed tunnel with a `/arx` path
route to `http://<add-on host>:8099` above the plain HA route) is described step by step in
`docs/operations/ARX_CLOUDFLARE_GUIDE_HE.md`. The add-on needs no `ports:` mapping; the tunnel reaches it on the
Supervisor network.

- **Sign-in.** Your Home Assistant username and password, then the MFA code when your HA account has one. The page
  talks to Home Assistant's own login endpoints on the same hostname; the password never reaches the add-on, and HA
  counts failed attempts and raises its usual notification. HA lists the sign-in as the client `…/arx/` under
  Profile › Security › Refresh tokens - deleting it there signs that browser out of Arx within a minute.
- **Who may sign in.** הגדרות › גישה מרחוק › "מי רשאי להיכנס מרחוק": by default only users whose personal flag is
  on (משתמשים והרשאות › the user › "גישה מרחוק"); alternatively every HA user who holds any Arx role. Everyone else
  gets "הגישה מרחוק לא הופעלה עבור המשתמש שלך". Turning a flag off ends that user's remote sessions at once.
  Roles and scopes are exactly the ones the user has through Ingress (the same HA user id). The first system
  administrator is still granted only through Ingress (`bootstrap_admin_username` never applies remotely).
- **Staying signed in.** `remote.session`: 90 days rolling (HA's refresh token, like the Companion app; the
  default), until the browser closes, or 90 days with an idle lock (`remote.idle_lock_minutes`, default 720).
  Optional: require HA MFA for users holding administrative permissions (`remote.require_mfa_admin`, off).
- **WisKey.** The sign-in also signs the browser in to Home Assistant on the same hostname (HA's `hassTokens`), so
  the embedded WisKey panel opens without a second login. That browser is then signed in to the HA UI at `/` as the
  same user too; signing out of Arx signs it out of both.
- **Video.** Remotely every live player starts with `remote.default_profile` (main) over **WebRTC** - the media goes
  straight between the browser and go2rtc, not through the tunnel. If WebRTC fails - it does not connect, or video
  bytes arrive but no frame decodes within the stream's key-frame interval plus a margin (a slow link without any
  bytes yet waits up to 30 s) - the player falls back by `remote.mse_fallback`: on (default) → the same profile over
  MSE through the tunnel, announced on the picture; off → the other profile over WebRTC (announced), and when that
  fails too, "הזרם הראשי אינו ניתן לפענוח ב-WebRTC - ראה הגדרות › וידאו" - never MSE. With go2rtc down the player
  says "שרת הווידאו אינו זמין" and retries. A badge on the picture shows what is tried ("מנסה main·WebRTC…") and,
  once it plays, what plays (`main·WebRTC`, `sub·WebRTC`, `main·MSE`). The camera wall and map tiles keep their own
  profile (the wall's `media.wall_profile`, default sub) under the same rule - an owner decision still to confirm.
  The LAN / Ingress player is unchanged.
- **Codec check.** Browsers decode H.264 over WebRTC, but not H.265 (most browsers), MJPEG, or H.264 with B-frames or
  SVC. The camera discovery (start-up, every 10 minutes, "Sync cameras") reads each camera's main and sub encoding
  from the NVR (`GET /ISAPI/Streaming/channels`, read-only) into the camera registry; a stream known not to play over
  WebRTC is skipped remotely (straight to the fallback); a reading from a recording track alone never counts as
  "plays". On the pilot lab seven of ten cameras have an H.264 main stream with **SVC on** (their sub streams: H.264
  without SVC) and three are H.265 in both streams, and WebRTC decoded only the sub profile - turning SVC off on the
  main stream (and H.265 → H.264) is the first thing to try. Where it shows: הגדרות › גישה מרחוק (a read-only summary line with a link), the health report card
  "וידאו ב־WebRTC" (the cameras and a Hebrew hint each, e.g. "הזרם הראשי של X מקודד H.265 - לא יתנגן ב-WebRTC;
  לשינוי: NVR → Encoding → Main stream → H.264, B-frames off"; with a Hikvision model from deviceInfo the hint names the
  NVR web menu, Configuration → Video/Audio → Video - not yet verified on the lab NVR), the camera's capability row,
  the setup wizard's NVR step, and counts in `/health` (`video_codecs`). The card warns only while `remote_access` is
  on and remote viewers get the main stream first. The add-on never changes the NVR's encoding itself.
- **Security.** The `/arx` channel never accepts Ingress identity headers (they are dropped), answers 404 while the
  option is off, sends a strict CSP (`frame-ancestors 'self'`), `X-Frame-Options: SAMEORIGIN`, `Referrer-Policy`
  and `Permissions-Policy`, and keeps its session in an `HttpOnly; Secure; SameSite=Strict; Path=/arx/` cookie that is
  re-issued with every token refresh (at most 30 minutes old; the previous one ends at once). A state-changing
  request that carries that cookie must come from an Arx page on the same origin (`Sec-Fetch-Site: same-origin`, or a
  matching `Origin`), otherwise it is refused (`csrf_refused`, audited). The cookie cannot use the `__Host-` prefix
  (that needs `Path=/`, which would send it to HA's pages too), so a sibling sub-domain of the same zone could plant a
  cookie of the same name; that only ever signs the victim in as someone else's session, never exposes the real one
  - keep untrusted hosts off the Arx zone (CR-008 D11). Sessions are re-checked against HA every minute
  while in use. Sign-in attempts are rate-limited per address and per user, and every sign-in, refusal, revocation
  and sign-out is in the audit log (`auth.remote_session.*`; addresses and ids, never tokens).
- **Home Assistant settings.** Cloudflared requires HA's `http` `use_x_forwarded_for` with `trusted_proxies`
  `172.30.33.0/24`; that also lets HA see the real address behind Arx's token checks. HA bans no address by default;
  a `login_attempts_threshold` (HA → Settings → System → Network, or `http:` in configuration.yaml) makes HA ban an
  address after that many failures - for HA and Arx alike, until it is removed from `ip_bans.yaml`. That is an HA
  decision (CR-008 D9), not an Arx setting.
- **Limits.** Remote sessions live in memory: after an add-on restart the browser re-establishes its session
  silently from its HA token. Native-app push, the installable app and Cloudflare Access are later phases.

### Remote-access hardening (CR-008 P2)

- **Sessions list.** הגדרות › גישה מרחוק › "כניסות פעילות מרחוק" lists every active remote sign-in (one row per
  browser or client; a system administrator sees everyone's, anyone else their own): the browser family and system,
  the country (Cloudflare's `CF-IPCountry`) or the last address masked to /24 (IPv6 /48), the first sign-in, the last
  activity, cookie (a browser) or bearer (a client sending its HA token on every request), live streams, and "המכשיר
  הזה" for the current one. The id shown is a hash, never the cookie. The avatar menu has the same list for the user
  ("הסשנים שלי") with "התנתק מכל המקומות". API: `GET auth/sessions?scope=own|all`, `DELETE auth/sessions/{id}`,
  `DELETE auth/sessions[?user_id=]`.
- **What ending a sign-in does.** Its sessions end, their WebSockets (live video, events, the access channel) close
  before the answer, and the sign-in cannot come back: the refresh-token id its access tokens carry is recorded
  (hashed, table `remote_revoked_chains`, kept a year) and a re-exchange answers `remote_session_revoked`; the browser
  then shows the sign-in page ("הכניסה במכשיר הזה נותקה") and revokes its own refresh token. When users end their OWN
  sign-ins, the add-on also deletes those refresh tokens at Home Assistant (`auth/delete_refresh_token` with the user's
  own token, best effort, 8 seconds at most) - but only the ones HA lists as normal sign-ins of the Arx client
  (`https://<host><remote_path>/`); a long-lived access token or a sign-in of another app used with Arx is never
  deleted at HA - the same browsers are signed out of HA at `/` too. An administrator's revoke ends the Arx
  access only; the user's HA sign-in is theirs. Every revoke is audited (`auth.remote_session.revoked`, reason
  `signed_out_everywhere` / `revoked_by_user` / `revoked_by_admin` / `revoked_all_by_admin`).
- **Bearer clients** (an API client, the future native app) get a session of their own per sign-in: listed, revocable,
  re-checked against HA every minute like a browser's, with their WebSockets closed on revoke; their actions are
  audited with `via: bearer`.
- **Per-user flag.** משתמשים והרשאות shows for each user the flag, the last remote sign-in and the active remote
  sign-ins; switching the flag off while sign-ins are active first says how many will close (under
  `remote.policy = flag` they close at once, WebSockets included).
- **Audit filters.** The audit screen filters by channel (local / remote / remote with a bearer token) and has two
  quick views: "כניסות מרחוק" (every `auth.remote_*` row) and "סירובים מרחוק" (every refusal on the remote channel:
  `remote_not_allowed`, `csrf_refused`, the rate limits, a revoked sign-in, the live-stream cap). API: `GET audit`
  with `channel=local|remote|bearer` and `view=remote_sign_ins|remote_refusals`.
- **Live streams per sign-in.** `remote.max_live_streams` (default 16, 1-32; 4 before the 11-camera wall hotfix - a value an administrator saved is kept): the next live start of the same remote
  sign-in is refused - `GET media/live/{id}` answers 429 `remote_live_cap` with a Hebrew message, the live socket
  sends the message (with `max`) and closes 4429; the player shows it as a cap (no retry, no ladder), the wall shows the tiles beyond the cap as snapshots and streams only the tiles in view. `remote.wall_profile` (sub / main) is the wall's stream on the remote channel; each device can switch it on the wall. `media.max_live_sessions` still caps the whole installation. `/health` (system
  administrators) shows `remote`: sessions by kind, sign-ins, users, sockets, remote live streams and the cap.
- **Content-Security-Policy.** The enforced policy is unchanged (`script-src 'self'`, no inline script). A stricter one
  - no inline `<style>` elements (`style-src-elem 'self'`; inline style attributes stay allowed for Lit) - is sent as
  `Content-Security-Policy-Report-Only`. Both report to `POST <remote_path>/api/v1/csp-report` (`report-to` with
  `Reporting-Endpoints`, and `report-uri` for Firefox / Safari). The endpoint is unauthenticated by nature and
  therefore remote-only, rate-limited (30 per minute per address, 300 per minute in total), bounded (16 KB a body, 20
  reports a batch) and keeps counters only: disposition, directive and blocked origin (scheme + host or a keyword),
  never a page URL, sample or path, at most 200 rows (the rest counts as "other"). הגדרות › גישה מרחוק › "מדיניות
  אבטחת תוכן (CSP)" shows the counters; after reviewing them the owner switches "אכוף את המדיניות המחמירה"
  (`remote.csp_enforce`), which takes effect on the next response. Reports from unknown origins are usually browser
  extensions. A route's own CSP (e.g. `sandbox` on evidence files) is kept next to the channel's.
- **Rate limits, in one place.** Arx: the session exchange 10 per minute and 50 per hour per address, 20 per minute and
  200 per hour per user (bearer requests are validated under the same limits); sign-out per address; CSP reports as
  above. Home Assistant: its own failed-login accounting and optional `login_attempts_threshold` (see above - it bans the
  address for HA and Arx alike). Cloudflare (optional, recommended): a rate-limiting rule on `/auth/login_flow*`,
  `/auth/token` and `/arx/api/v1/auth/session`, e.g. 20 requests per minute per address, action "block" for 10
  minutes; Cloudflare Access on `/arx` stays a later option (D3).
- **Pen-test checklist.** `docs/operations/ARX_REMOTE_PENTEST_HE.md`: the attack paths the two security reviews listed
  as untested on a real deployment, each with the exact request and the expected result.

## Security boundaries checked by tests

- Permissions are evaluated per resource on the server: a camera is reachable only through a floor the user may
  see or an installation-wide grant, and an explicit deny on a floor is final even for installation-wide users.
  Every refusal is written to the audit log with its reason; audit rows are kept for a year.
- Uploads are judged by content, not by name or declared type; SVG is refused; the size cap applies while the
  file streams; a corrupt PDF is a client error. File routes refuse path traversal. No API route accepts a URL
  to fetch, the browser only receives relative media paths, and signed bridge messages cannot be replayed,
  forged, tampered with or reused after their window.

## Limits in this build

- Uploads: PDF/PNG/JPG up to 40 MB, PDF up to 20 pages; SVG and DWG/DXF are rejected.
- PDF rasterization runs in a separate process (pdftoppm) with a 30 s limit.
- Evidence bundles are signed: manifest.sig.json holds an Ed25519 signature over manifest.json by the
  installation's active key (public key and key id embedded). Verify in the case page or offline with
  `python scripts/verify_bundle.py bundle.zip --keyring keyring.json`; the result separates "signed by a key of
  this installation" (active or retired), "signed by an unknown key" (integrity only) and "unsigned" (older
  bundles). The private key lives only in /data/keys (mode 0600) and is never backed up; הגדרות → אחסון shows the
  active key and rotates it (system.configure, audited), keeping retired public keys for older bundles. A valid
  signature proves the bundle did not change since export — not that the footage is authentic at capture, and
  it is no statement of legal admissibility.
- Semantic search (חקירה › חיפוש AI): a free question becomes the event centre's filters through a local
  baseline — object class from the device's detection target, places by catalogue name within your scope, a time
  window in the site zone — with the interpretation shown as chips, unsupported terms (colour, appearance) named
  with the reason, and every result labelled exact / partial with its basis. Results are metadata matches, never
  identity evidence. Settings `ai.provider` (none / local), `ai.privacy_ack`, `ai.budget_daily` hold the contract
  for an external analysis provider; none is bundled and `external` is refused.
- DXF plans: the import wizard also takes .dxf files (content-sniffed). The drawing is inspected (units, layers,
  entity counts, unsupported types) and rendered from the geometric entities only; text, hatches, dimensions and
  3D entities are counted and reported as a partial conversion. Choose layers and units on the DXF card; a version
  made from a drawing with known units gets its scale automatically. DWG must be converted to DXF first.
- Capability facts (camera page, read-only): PTZ (supported / unsupported / unknown, with the device's reason),
  the preset list and two-way audio (available / disabled / unsupported / unknown) exactly as the NVR reports them.
  PTZ moves, preset recall and talk are device writes and are not offered in the pilot; no control is simulated.
- Detection zones (camera page, read-only): the motion grid, privacy-mask regions, intrusion regions and
  line-crossing lines exactly as the NVR holds them for that channel (ISAPI GET only, cached for a minute), drawn
  over the snapshot with layer toggles. They are polygons in the camera image, not rooms on the plan; the overlay
  is not an NVR mask and protects no recording; nothing is written to the device (no write route in the pilot).
- Playback: 1×, slow motion ×0.5 / ×0.25 and frame stepping (T066) on the MSE path — the relay delivers the NVR
  stream in real time, so the buffer is consumed slower or stepped through and the shown time stays the source
  time; faster speeds are disabled with the reason (they need a source that sends faster than real time);
  in a synchronized group only 1×; up to four cameras side by side on one master clock (the median rendered time of the playing
  tiles) with the drift of every tile measured against it (p95 over the last 40 samples, quality on the stamp, reported on the group); a tile out by
  more than 2 s is re-seeked alone, never the whole group. Still best effort: no verified PTS↔UTC anchor; events are
  not drawn on the timeline yet. Export trims at key frames (the start may be a few seconds early). PTZ and two-way audio are not exposed until the
  capability is verified per camera.
- Home Assistant actions: only the allow-listed services above, no arguments yet (brightness, position);
  entity widgets are generic (state, unit, last change); scripts/scenes run but report "unknown" if HA
  keeps no state to observe.
- Live video needs a browser with H.264 support (Chrome, Edge, Safari, Firefox on desktop); Playwright's
  bundled Chromium has none, so the evidence suites run with `SW_CHROME=1`.

## Troubleshooting

- The pill in the top bar is the first signal: green = everything the add-on can see is working, amber =
  something needs attention (named in the tooltip), red = a failure, and then a banner under the top bar
  names it on every screen. Click the pill to open the health cards.
- Start at הגדרות → בריאות ועבודות: every subsystem has its own card and status (green = working, amber =
  not configured or waiting, red = failing with the reason), plus the storage the add-on uses and the last
  backup. "בדוק עכשיו" probes the NVR and go2rtc again.

- "Home Assistant לא העביר זהות משתמש": the Supervisor did not send the `X-Remote-User-*` headers.
  Update Supervisor/Core; the add-on refuses to guess an identity.
- "אין הרשאה": your HA user has no VMS role yet — ask the VMS administrator (bootstrap user).
- Logs: the add-on **Log** tab; set `log_level: debug` for request-level detail (never prints secrets).

## Saved views (0.1.51)

לייב › תצוגות שמורות keeps named camera sets with a layout. A personal view belongs to the user who made it;
a shared view is visible to every signed-in user and can be created by a site administrator or a system
administrator (`rbac.assign`). Every camera in a view must be one the creator may watch live, and a reader who
may not watch one of the cameras sees the view without it. "פתח" opens the cameras on the live wall; "קיוסק"
opens `#/kiosk/all?cameras=…&cols=…&rows=…` in a new tab (the kiosk pages through the cameras, cols × rows at a
time). Views travel with the project backup.

## Entity actions and risk classes (0.1.52, T040)

Actions on Home Assistant entities run through the SMPLWISE Bridge integration in the acting user's own HA
identity; Home Assistant's own permissions decide last. The add-on allow-lists the services and validates the
arguments first:

| Domain | Actions | Risk |
|---|---|---|
| light, switch, fan, input_boolean, vacuum | on / off (brightness or speed for light / fan), start / return to base | routine |
| climate | operating mode (from the entity's modes), off, target temperature 5–35 ° (confirmed from the `temperature` attribute), fan mode (from the entity's fan modes) | routine |
| fan | speed 0–100 % (confirmed from `percentage` within the fan's own step) | routine |
| media_player | on / off, play, pause, stop, volume 0–100 %, mute | routine |
| number, input_number, select, input_select | set a value / choose an option (the expected state is the value) | routine |
| cover | open / close / set position (one physical movement: all three need the confirmation; the position is confirmed from `current_position`; stop is routine and never gated) | attention — confirmation |
| button, script, scene, siren | press / run / activate / on | attention — confirmation |
| alarm_control_panel | arm home / arm away | attention — confirmation |
| lock | unlock | sensitive — confirmation + `door.unlock` grant |
| alarm_control_panel | disarm | sensitive — confirmation + `alarm.disarm` grant |

Sensitive grants are never implied by a built-in role; a custom role that lists them explicitly (הגדרות › משתמשים
והרשאות › תפקידים) gives them at a scope. Every action, refusal and its reason is audited. The bridge
integration's allow-list must match (0.2.4 for the rows above - fan speed, cover position, climate fan mode and
off, media on / off and mute were added in 0.2.4 for the devices area): after updating the add-on, restart Home
Assistant once so it loads the new bridge; until then those actions answer `service_not_allowed`. An action whose
effect Home Assistant does not report (stop, a target temperature on an entity without a single `temperature`, mute
on a player that does not report it) is shown as "sent", never as confirmed.

### Device control permissions (CR-007 slice 2)

`devices.control` lets the devices area (חשמל והתקנים) run single-entity actions on light, switch, input_boolean,
cover, climate, fan and media_player entities only, at the entity's own floor scope. It never reaches a lock, the
alarm panel, a siren, a script, a scene or a button: those stay behind `ha.entity.control` (plus `door.unlock` /
`alarm.disarm`). Granted by default to operator, site_admin and system_admin - not to viewer, kiosk or editor.

### Bulk device actions (CR-007 slice 3)

`devices.control_bulk` (site_admin and system_admin by default; a sensitive permission, so a custom role grants it only
by naming it explicitly) adds the building buttons, each floor's menu and each area's popover: turn off the lights,
close the covers, turn off the climate (climate and fans), turn off the screens, or turn everything off (all of those plus
the switches a system administrator marked "safe for bulk" on the area screen - a lighting circuit's switch is only
suggested for the mark; any other switch may be a door release and is listed as not included; a mark is cleared when
its entity leaves Home Assistant). Every action opens a confirmation dialog that lists what will be sent; the add-on resolves the set itself and
sends one ordinary HA action per entity through the bridge, at most 8 at a time, one bulk per scope at a time. Locks, the
alarm panel, sirens, scripts, scenes, buttons, input_booleans, door / garage / gate covers and covers or switches placed on
the map's door layer are never included; entities already off or unavailable are skipped. The result is per entity: "בוצע" only when Home
Assistant confirmed every one, otherwise "בוצע חלקית" with the list of those that did not confirm. A floor-scoped holder
acts only on the entities placed on their floors; the building actions need installation scope. The building screen
offers the tree + floor cards layout (default) and the tiles layout (פריסה), remembered per browser.
## Export queue (0.1.54)

Export and preservation jobs download the original files from the NVR one at a time (the NVR's playback slots are
the limit) at the rate the NVR allows — in the lab about 0.5–1 MB/s, so a whole 1 GB recording file takes half an
hour. Jobs therefore run smallest first (by the estimated size); a job that has waited more than 15 minutes goes
first regardless. חקירה › ייצוא shows the queue with progress; a queued job can be cancelled.


## Install as an app and push notifications (CR-008 P3)

SmplWise Arx is an installable web app (PWA): `arx-manifest.webmanifest` and the service worker `arx-sw.js` are served
next to `index.html`, and the worker's scope is the app's own base - the Ingress prefix inside Home Assistant, `/arx/`
on the remote channel - so it never touches Home Assistant's own pages or service worker. It caches the app shell only
(the page, the hashed build files, fonts and icons); API responses, images from the API, downloads and video are never
cached. Without a network the last cached shell opens, or a Hebrew "no connection" page.

**Installing.** Android and desktop Chrome / Edge: the "התקן את Arx" card appears at the bottom when the browser offers
installation (or use the browser menu). iPhone / iPad: Safari has no install prompt; Arx shows a short guide (Share →
Add to Home Screen). iOS delivers Web Push only to an app installed this way (iOS 16.4+). Inside Home Assistant (the
Ingress frame) no install prompt is shown. When a new version's worker is waiting, "גרסה חדשה של Arx זמינה" offers a
reload.

**Notifications (מערכת › התראות, every user).** Each HA user switches Web Push on per browser ("הפעלת התראות במכשיר
הזה"), chooses categories - rule alerts, doors (HA door / lock transitions; WisKey calls are not stored as events yet),
device faults (video loss, tamper, storage, a sensor that went unavailable), system health (NVR system events) - and
optional quiet hours in the installation's time zone (critical alerts may pass). A test button sends one notification to
the user's own devices (3 per minute). Up to 10 devices per user; a device that has not opened Arx for 120 days is pruned.

**What is sent, to whom.** Every alert a local rule raises is also pushed - after the rule engine's commit, from a worker
thread, never under the database write lock - to each subscribed user who may see it: the same rule as the alert list
(a camera alert needs `events.read` on that camera or a floor / building / site it is placed on; a camera-less alert
needs installation-wide `events.read`). Per-user rate limit: 10 per minute. The payload is title, one line of text, an
in-app deep link (`#/investigate/events/<id>`), the event and alert ids, category and severity - no image, no token, no
URL; the app loads the details after the user signs in. A click routes an open Arx window to the event or opens Arx
(inside HA: the HA page hosting it). The same HA user id counts on Ingress and on the remote channel.

**Keys and push services.** A VAPID key pair is generated once per installation and kept in the add-on database (table
`push_vapid`, never in the settings and never in a project backup, never logged); only the public key is served
(`GET api/v1/push/vapid-key`). Messages are encrypted end to end (RFC 8291 `aes128gcm`) and signed (RFC 8292 VAPID),
implemented with the `cryptography` package already in the image (no additional dependency). The add-on only calls the
browsers' push services (Google FCM, Mozilla, Apple, Microsoft WNS) over outbound HTTPS; a subscription pointing
anywhere else is refused. Nothing inbound is needed. A 404/410 from the push service removes the subscription;
429 and 5xx are retried with backoff; every retry first re-checks that the subscription still belongs to the same user
and that the user still reaches the alert. Subscribe, unsubscribe, preference changes, test sends and key rotation are
audited (the subscription URL itself is never logged or returned). Worker counters (queued, sent, retried, gone,
refused …) appear under `push` in `GET api/v1/health` for `system.configure` holders.

**Backups and key rotation.** An Arx project backup never contains the VAPID key or the subscriptions. A Home Assistant
backup of the add-on (`backup: hot`, the whole `/data`) does contain both: restoring it brings the same key and
subscriptions back, and anyone holding that backup file holds the private key. Restoring an Arx project backup on a
different installation keeps that installation's own key; browsers that still allow notifications re-register silently
the next time Arx opens there (the app compares its subscription's key with the server's on every start). If a key
may have leaked (a Home Assistant backup out of your control), a system administrator replaces it: מערכת › התראות ›
"החלפת המפתח" (`POST api/v1/push/rotate-key`, `system.configure`, audited). All subscriptions of all users are removed
and each device re-subscribes with the new key on its next visit.

Quiet hours need two different times (`from == to` is refused); a window that crosses midnight (22:00–07:00) is fine.

**API.** `GET push/vapid-key`, `GET|POST push/subscriptions`, `DELETE push/subscriptions/{id}` (own only),
`GET|PUT push/prefs`, `POST push/test` - all under `api/v1/`, all acting on the calling user only; `POST push/rotate-key`
(`system.configure`).

**Service worker updates.** The worker's cache is named after the add-on version, so every release ships a changed
`arx-sw.js`; the new worker deletes the previous release's cache when it takes over (after "רענון" on the update notice).
Hashed build files are served cache-first; fonts, icons, brand images and the manifest network-first (the cache is only
the offline fallback).

## Security area and the intrusion alarm (CR-010)

**Navigation.** Design A's rail and phone bar are אבטחה · מפה · חשמל · WisKey · מערכת. "אבטחה" (security) holds two
sections - לייב (live), חקירה (investigation) and אזעקה (the alarm) - shown as a segmented control at the head of the page;
each section's own pages stay the tab row under it, and `#/security` opens the section the browser used last. The alarm
section (`#/security/alarm[?panel=...]`, canonical, last by default; `ui.tabs` orders / hides it like the others) renders
the same screen as **הגדרות › אבטחה › אזעקה** (`#/system/security/alarm`), which also holds the alarm management
(`#/system/security/manage`, `system.configure`) and an NVR summary (`#/system/security/nvr`; the NVR connection and
recorder settings stay in הגדרות › חיבורים). Any of `alarm.view` / `alarm.arm` / `alarm.disarm` / `alarm.bypass` (any
scope) or `system.configure` shows the alarm section and the Settings page (the screen itself lists panels with
`alarm.view`; the server checks every call), and the Settings section is offered even without general settings access
(the user menu's "מערכת" opens it). "There is an alarm" = any enabled `alarm_control_panel` in the mirror, whatever it
has (no zones, no bypass switches, no code format): only a positive "no panel" answer hides the tab, so loading, an error
or an unknown answer never do. The answer is cached (10 minutes when yes, 60 seconds when no) and re-asked when the
mirror changes (`structure_changed`, the sync reconnecting, an alarm panel appearing) and when the security area is
entered; a saved link to `#/security/alarm` on a system without a panel shows the screen's own "no alarm panel" state.
`#/system/devices` → `#/investigate/health` (camera health is the last tab of חקירה, still `video.live`) and
`#/system/diagnostics?tab=alarm` → `#/system/security/manage` redirect with their query; the Lovelace card views and the
kiosk are unchanged. Design B has no flat "אזעקה" entry.
The live overview ("תמונת מצב") can be hidden for everyone with הגדרות › וידאו ומדיה › תמונת מצב באבטחה
(`ui.security_snapshot`, default shown); the live section then opens on "כל המצלמות" and `#/live` redirects there.

**What the alarm shows.** Every `alarm_control_panel` entity is a panel: its state, the arm modes it reports
(`supported_features`), whether it needs a code (`code_format`, `code_arm_required`) and who changed it last. Its zones
are the `binary_sensor` entities of the same integration and config entry (auxiliary tamper / battery / "alarmed" /
"armed" sensors attach to their zone), each with its bypass control when one is found: the same device, then an exact
integration key (Risco: the system and zone number of the unique id - the owner's system, never paired by name), then
the entity or unique id with the property words removed, the name, the zone number. Visonic's bypass is a select
(`bypass` / `armed`); Alarmo reports the sensors it watches while they are open or bypassed, and others are assigned
by hand. Unpaired bypass switches are listed ("ללא שיוך"). הגדרות › אבטחה › ניהול אזעקה shows every panel, its integration and
the pairing table with manual overrides (pair, no bypass, assign to one partition, exclude).

**Control.** Arm (`alarm.arm`: operator, site_admin, system_admin), disarm (`alarm.disarm`: site_admin, system_admin;
sensitive), bypass a zone (`alarm.bypass`: site_admin, system_admin; sensitive) through the bridge like every entity
action, audited with actor, panel / zone, outcome and channel. Disarm and bypass ask for a confirmation; arming does not.
Trigger is never offered. Scope: installation-wide holders see every panel, a floor binding the panels placed on its
floors. The bridge must be 0.2.6 (restart Home Assistant once after the update) for arm_night, arm_vacation,
arm_custom_bypass and the "code refused" answer.

**Codes (owner decisions 2026-09-29).** An administrator stores each panel's code once (הגדרות › אבטחה › ניהול אזעקה,
`system.configure`); it is encrypted (AES-256-GCM) with a key in `/data/keys/alarm-codes.key` (mode 0600) and is never
shown again, logged, audited or returned. Per user (משתמשים והרשאות › user): arming and disarming each either "ללא קוד"
(Arx sends the stored code) or "חייב קוד" (default). What a "חייב קוד" user types is `alarm.code_mode`: a personal Arx
PIN (default; `alarm.pin_min_length` digits - 6 by default, 4-8 - up to 8, stored only as a salted scrypt hash) or the
panel's own code (compared with the stored one). The first PIN is set by an administrator in משתמשים והרשאות (or by the
user after typing a stored panel code correctly); changing it needs the current one; an administrator's own policy
and PIN are changed by another administrator or with their current PIN. Without a stored code the panel's code is
typed and passed through each time. Wrong codes: 5 in 5 minutes lock code entry for 10 minutes - per user for a PIN,
per user and panel for a panel code; the lock survives a restart. The panel and every bypass control are operated
only from the alarm screen: map cards, the devices screens and bulk actions show them read-only ("נשלט ממסך
האזעקה"), and a zone shared by two partitions is visible and bypassable only for someone who holds both. There is no
key rotation, and renaming a panel's entity id requires entering its code again.

**Remote channel (`/arx`).** `alarm.remote_control` (default on) and `alarm.remote_disarm` (default on; off = from
outside only arming and restoring a bypassed zone). `alarm.remote_codeless` (default ON, owner decision): "ללא קוד" users
arm and disarm without a code from outside too. The biometric lock exists only in the Android app, and only when
switched on there; a browser or installed-PWA session has none - turn the setting off to make every remote action ask
for a code. Every remote alarm action is audited with `channel: remote`.

**Backups and who can read the codes.** An Arx project backup contains no alarm code, PIN hash or key. A Home
Assistant backup of the add-on (`backup: hot`, the whole `/data`) contains the database and the key file together, so
whoever holds it can decrypt the panel codes - the same policy as the VAPID and signing keys: keep those backups
private, and after a leak change the code at the panel and store it again. Anyone with shell access to the Home
Assistant host can read `/data`. Home Assistant sees the panel code in the service call, as it does for its own alarm
card. Threat model: docs/changes/CR-010-SECURITY-ALARM.md §5a.

## Schedules (CR-014)

The home area (חשמל והתקנים) has two tabs: **מבט על** (the former home screen) and **תזמונים**
(`#/devices/schedules`). The tab row is shown only when more than one tab is visible, and "תזמונים" only to a holder of
`schedule.view` or `schedule.manage` (at any scope) while `schedules.enabled` is on (default **off**; switched on in
הגדרות › תזמונים, `system.configure`). Contract: `docs/architecture/SCHEDULER_API.md`; design record:
`docs/design/CR-014-scheduler.md`; user guide: `docs/user-guide/he/41-schedules_HE.md`.

**The component is the authority.** Schedules live and run in the third-party *Scheduler* integration
(`scheduler` by nielsfaber, GPL-3.0, minimum Home Assistant 2024.11.0; installed by the administrator through HACS or
by hand, never bundled). Arx keeps a read model: a full pull from the component's WebSocket commands (`scheduler`,
`scheduler/item`, `scheduler/tags`) at every session start and every 10 minutes, the `scheduler_updated` subscription
and the mirrored `switch.schedule_*` states as two more refresh layers, and a cache in `schedule_cache`. Definitions are
keyed by `schedule_id`, never by entity id; every read carries a `revision` (SHA-256 of the canonical item without the
volatile keys). A missing component (`unknown_command`, confirmed by two answers at least 5 minutes apart) shows "אין
תזמונים להצגה" to users and the installation steps to `system.configure`; an unreachable platform shows the cached
list as stale and refuses writes. The schedule switches themselves are not devices: they are excluded from the devices
area, tiles, bulk actions and `POST /ha/entities/{id}/actions` (409 `use_schedules_screen`).

**Writes** go through the bridge, version **0.3.0** or newer (restart Home Assistant once after the add-on update; until
then the list is read-only and writes answer 503 `bridge_too_old`): the signed service `smplwise_bridge.schedule` with the
operations add, edit, remove, copy, run, enable and disable, in the acting user's own Home Assistant identity. The bridge
re-validates independently of the add-on (signature, the action allow-list, argument specs, no code key at any depth, a
sensitive flag that must match the entities, and - for a non-administrator - Home Assistant's own control check on every
action entity). Arx never calls `scheduler.*` directly and never `enable_all` / `disable_all`. A write carries
`base_revision` and `client_request_id`: a moved revision answers 409 `schedule_changed` with the current version (there
is no compare-and-set in the component, so a window of a few milliseconds remains); a bridge timeout is never retried
(504 `scheduler_timeout`, "the change may have been saved").

**Permissions** (in `roles.json` and the access catalogue): `schedule.view` (site_admin, system_admin), `schedule.manage`
(site_admin at its scope, system_admin; sensitive) and `schedule.sensitive` (system_admin; sensitive); none is implied by
another, and `system.configure` grants none of them. Reads accept view or manage. A caller **sees** a schedule only when
every *action* entity passes `schedule.view`/`schedule.manage`, a state read and (an alarm panel) `alarm.view` at the
entity's own placement; a condition entity never hides a schedule (an unreadable one is shown without its state and
locked). A caller **changes** a schedule only when, for the old and the new content, every action entity passes
`schedule.manage`, the control rule of its class (`devices.control` / `ha.entity.control`; locks and doors
`ha.entity.control`, unlock also `door.unlock`; alarm `alarm.arm` / `alarm.disarm` at the panel), `schedule.sensitive` for
the classes alarm, lock and door, and the class must be enabled in `schedules.classes`. A locked condition must reach the
bridge unchanged (403 `condition_locked`). Otherwise the schedule is read-only with the reasons listed per entity. The
recipe for an editor limited to a floor is a custom role (ordinary: `schedule.view`, `devices.read`, `devices.control`;
sensitive: `schedule.manage`; `entity.state.read` can stand in for `devices.read`) bound at that floor.

**Classes and safety rules** (server-enforced, not settings): light, switch (only entities marked safe for bulk actions),
cover (not door / garage / gate, not on the map's door layer), climate and fan; and, with `schedule.sensitive`, alarm
(arming modes and disarm), lock and door (door covers, door-layer switches and buttons). Never schedulable: alarm-managed
bypass controls, scripts, scenes, plain buttons, sirens, `input_*`, media players and every other domain. **No code is ever
written into a schedule** (Home Assistant stores service data in clear text): a new or changed alarm action whose panel
needs a code for it is refused (422 `alarm_code_needed`, likewise `lock_code_needed`); an unchanged existing one is kept with
a warning and appears in the review list; when the creator's own alarm policy is "code required" the code is asked once,
verified with the alarm gate's lockout rules and discarded. A schedule that opens or disarms something (unlock, disarm,
door covers and door-layer controls) needs an explicit confirmation (`confirm_lowering`) to be created, edited, enabled
or restored, and a run-now confirmation. Delete = confirmation, then a snapshot in `schedule_trash` for **30 days** with
restore (a restore re-creates it under the current rules and a new id; purge is installation-wide `schedule.manage`
only). Audit actions: `schedule.create|update|enable|disable|run|split|copy|delete|restore|purge|bulk|organise`, plus
system rows `schedule.executed` (a sensitive run observed) and `schedule.changed_outside` (a sensitive schedule changed
without an Arx operation); a code, `raw` content or free service data never enters the log.

**What the screen shows and does.** List as cards, table or a read-only week board, search, filters (area, floor, state,
day, tag, "רק בשבת ובחג" / "לא בשבת ובחג" / has a condition), grouping and sorting, a detail drawer with the upcoming and
the last runs, bulk enable / disable (a schedule that opens or disarms is enabled one at a time), run now (one run per
schedule per 10 s), copy, delete, trash and, for installation-wide managers, the review list ("לבדיקה"). The editor
(`#/devices/schedules/<id>/edit`) has a 7 × 24 h week grid (00:00 at the left, LTR axis in the RTL page), a day view, a table
view over the same model, snapping to 5 / 15 / 30 minutes, drag / resize / move and keyboard equivalents, the "כיבוי בסיום
החלון" helper, copy to other days, a split of one day into its own schedule (server `split`, with compensation when the
second write fails: 502 `split_incomplete`), conditions with presets and an unsaved-changes guard with a conflict banner.
The create dialog offers templates and a three-tap quick create. Defaults come from `schedules.*` (below).

**Conditions.** A schedule has one condition block applied to every slot (the component's own rule: identical conditions in
each slot): entity state or attribute with `is` / `not` / `above` / `below`, `and` / `or`, and "keep checking until the window
ends" (`track_conditions`). With `schedules.shabbat_sensor` set (the "issur melacha in effect" binary sensor of the Jewish
calendar) the presets "רק בשבת ובחג", "לא בשבת ובחג" and the template "מוצאי שבת" (sunset + 40 minutes, only when the
sensor is off) are offered. Neither the component's `timestamps` nor Arx evaluate conditions: a schedule with conditions
shows "· בתנאי" instead of a promised next run.

**Settings** (`GET/PATCH /settings`, `system.configure`, audited): `schedules.enabled` (`false`), `schedules.classes`
(a JSON array, all eight classes), `schedules.snap_minutes` (`15`; 5 / 15 / 30), `schedules.default_repeat` (`repeat`;
`repeat` / `pause` / `single`), `schedules.runs_retention_days` (`90`; 7-365) and `schedules.shabbat_sensor` (`''` or a
`binary_sensor.*`; the server refuses one that does not look like a Jewish-calendar sensor unless
`schedules.shabbat_sensor_force` is sent).

**Limits.** (1) A schedule created or edited directly in Home Assistant - by any user who can reach the component, for
example through the original scheduler card - bypasses every Arx rule (permissions, scope, the class allow-list,
confirmations, audit); Arx cannot prevent it ("Arx restrictions do not restrict the original Home Assistant UI"). Such a
schedule appears as external ("נוצר מחוץ למערכת"), is editable only when fully understood and is never rewritten
otherwise; a sensitive one is flagged in the review list (`no_owner_sensitive`) and a later change to it is audited as
`schedule.changed_outside`. (2) An action fires at the slot's **start** only; the end of a slot is a window end and does
nothing, so "on until 19:00" needs two slots. (3) Weekdays, dates and repeat belong to the whole schedule; a day with
other hours is a split into two schedules; `workday` / `weekend` schedules cannot be split and are not computed in the
week board or the preview. (4) Conditions are not evaluated in "next run". (5) The component has no run history: Arx
derives one (a switch entering `triggered`, the entities' states 20 s later: confirmed / not confirmed / skipped, never
"failed"; a slot skipped by its conditions leaves no row). (6) An alarm or lock action that needs a code cannot be
scheduled; a design for it (an Arx relay with the stored code, phase 2b, 16-22 agent-hours) needs a separate approval.
(7) A schedule keeps running after its creator loses a right or is removed; the review list (`GET /schedules/review`,
installation-wide `schedule.manage`) shows it, and Arx never disables anything on its own. (8) Not yet available: tag
editing (`capabilities.tags` is false until a real write is verified), negative sun offsets, folders / manual order /
import and export, the full activity screen and conflict detection between schedules. (9) The phase-0 read-only
verification on a real component (2026-09-30) confirmed the data shapes; the checks that need a write (a restricted
user's control check in the bridge, a live create / edit / delete through Arx) are listed in
`docs/operations/SCHEDULER_PHASE0_CHECKLIST_HE.md` and have not run yet.

## Tabs, home screen and other settings (0.1.146)

**Tabs (הגדרות › לשוניות, `ui.tabs`).** For every navigation section - the main navigation, the home area, security and
its live / investigation pages, the map, WisKey, the settings and its security pages - an administrator shows or hides
each tab and sets its order; a section lands on its first visible tab, at least one tab stays visible, and the settings
entry that leads to the editor is locked. Hiding is presentation only: permissions gate first, the address of a hidden tab
keeps working for those who hold the permission. The administrator's order of the main navigation is the default; a user's
own order (user menu › "סדר הלשוניות", stored per user) wins, and a user without one follows the administrator's.
`GET/PATCH /settings` carries the whole object (`{}` clears it). Details: `docs/architecture/TABS_CONFIG.md`.

**Map default floor (`map.default_floor`, הגדרות › מפה).** The floor the map opens first (`""` = the user's first readable
floor). A user who may not read it gets their own first floor; deleting the floor clears the setting.

**Device catalogue.** The map's "התקנים" tab is now **הגדרות › קטלוג התקנים** (`#/system/entities`,
`system.configure`); the old address redirects. The endpoints behind it are unchanged.

**Home screen.** "עריכת המסך הראשי" (user menu, `system.configure`) edits the layout, the title (`home.title`), optional
header widgets - a clock (`home.clock`), weather from a weather entity and the parsha / candle-lighting / Shabbat end from
sensors you choose (`home.weather*`, `home.jewish*`; all off by default, read from the mirrored entities, no external
service) - and the floor order (`home.floor_order`, applied to the tree, the cards and the tiles).

**Start screen (`ui.start_route`, הגדרות › וידאו ומדיה › מסך פתיחה).** The screen Arx opens on when the address names no
screen. The default is **"ראשי"** (`devices`); a value an administrator stored earlier overrides the default (an
installation that saved "מפת קומה" keeps opening on the map until it is changed). A start screen the user may not see falls
back to their first tab; settings that cannot be read fall back to "ראשי".

**WisKey size (`ui.wiskey_size`, `ui.wiskey_scale`, הגדרות › וידאו ומדיה).** The embedded WisKey is the frame alone (no
strip, refresh / enlarge / new-window buttons or border). `normal` fills the content area, `fit` renders the frame larger
and scales it down (100 / 90 / 80 / 70 %), `full` covers the whole window (Esc or the corner button leaves).

**NVR clock.** The NVR reports its wall clock, summer time applied, tagged with the standard offset; read literally it
looked an hour off (+3599 s). The clock is now read in the installation's time zone, so the system screen and the setup
wizard show no phantom drift. "סנכרן לשעון השרת עכשיו" writes the same way, reads the clock back and, when the device is
still more than 2 minutes off, answers 502 `clock_verify_failed` (audited). That write has not been tried on a real device.