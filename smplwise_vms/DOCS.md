# SMPLWISE VMS add-on (pilot 0.1.0)

Map-centred video management for a Hikvision NVR, served inside Home Assistant through Ingress.
This build contains the catalogue (sites → buildings → floors), architectural plan import (PDF / PNG /
JPG with page selection, rotation and crop), camera placement with view cones, server-side roles and
scopes, and an audit log. Live video, playback and events arrive in the following builds.

## Installation

1. Settings → Apps → App store → ⋮ → **Repositories** → paste
   `https://github.com/jonioliel/smplwise-bms` → **Add**.
2. Install **SMPLWISE VMS**. The Supervisor builds the image locally (a few minutes on first install).
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
4. Start the add-on and open it from the sidebar (**SMPLWISE VMS**). With NVR details set, the cameras
   appear by themselves within a minute (discovery at start-up and every 10 minutes); הגדרות → מצלמות
   → "סנכרון מה־NVR" refreshes immediately. If the list stays empty, check the add-on log and
   `/api/v1/health` (`discovery.cameras_last_error`).

## Identity and access

- Users are Home Assistant users. The Supervisor forwards the authenticated user with every Ingress
  request; the add-on trusts that identity only when the request comes from the Supervisor proxy.
- Nobody has access until a VMS administrator assigns a role in a scope (site, building, floor).
  Home Assistant admin status grants nothing inside the product, and the product never changes HA
  users, groups or admin flags.
- Every decision, upload, publish and placement is recorded in the audit log (no secrets).

## Data and backups

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
- Session cap (`media.max_live_sessions`, default 8) protects the NVR; the wall and the kiosk use sub
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
- The centre's tabs: לבדיקה (not yet handled), הכל, טופלו.

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

## Floor map

- The map shows the published plan with the pins on it; the floor chip names the floor, the zoom
  controls sit at the bottom-left (scroll or pinch also zooms, dragging pans) and the legend at the
  bottom-right. "שכבות" opens a panel with one switch per layer and its count (cameras, doors and
  intercom, lighting, security and sensors, room names); a switch only changes what is drawn and never
  operates equipment. Room names are shown when the room is wide enough on screen.
- Clicking a camera pin opens its card: the live picture plays inside the card (a session for that card
  only; closing the card releases it), with the camera's status, its location (floor and the room or
  zone the pin sits in), "צפייה מלאה" for the full-screen view and "הקלטות" for playback. Escape closes
  the card and returns keyboard focus to the pin. Entity pins open the same card with the entity's
  state and the actions the user is allowed to run through the bridge.

## Plan import: rotation and crop

- The wizard shows the page already rotated by the server; the crop rectangle is drawn with the mouse
  directly over that picture (or typed as percentages), and rotating again resets the crop. What is
  inside the dashed rectangle is exactly what the saved version contains; the original file is never
  modified.

## Floor plan editor

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
- Roles are the built-in catalogue (viewer, operator, editor, site_admin, system_admin); a binding is a
  role at a scope (whole installation, site, building or floor) for a user or a VMS group. Only holders
  of `rbac.assign` (system_admin in the pilot) assign; system_admin and other system permissions can only
  be bound installation-wide, and the last active administrator cannot be removed. Each change bumps the
  permission revision, is audited with a before/after diff of the subject's bindings and takes effect
  immediately.
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

## Limits in this build

- Uploads: PDF/PNG/JPG up to 40 MB, PDF up to 20 pages; SVG and DWG/DXF are rejected.
- PDF rasterization runs in a separate process (pdftoppm) with a 30 s limit.
- Playback: speed 1× only, no frame step; up to four cameras side by side (best effort sync); events are
  not drawn on the timeline yet. Export trims at key frames (the start may be a few seconds early). PTZ and two-way audio are not exposed until the
  capability is verified per camera.
- Home Assistant actions: only the allow-listed services above, no arguments yet (brightness, position);
  entity widgets are generic (state, unit, last change); scripts/scenes run but report "unknown" if HA
  keeps no state to observe.
- Live video needs a browser with H.264 support (Chrome, Edge, Safari, Firefox on desktop); Playwright's
  bundled Chromium has none, so the evidence suites run with `SW_CHROME=1`.

## Troubleshooting

- "Home Assistant לא העביר זהות משתמש": the Supervisor did not send the `X-Remote-User-*` headers.
  Update Supervisor/Core; the add-on refuses to guess an identity.
- "אין הרשאה": your HA user has no VMS role yet — ask the VMS administrator (bootstrap user).
- Logs: the add-on **Log** tab; set `log_level: debug` for request-level detail (never prints secrets).
