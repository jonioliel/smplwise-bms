# Changelog — SMPLWISE VMS add-on

## 0.1.26 (pilot)
- NVR storage and recording plan, read-only (T051): מערכת › אחסון shows the disks (capacity, free space,
  status), the recording schedule of every camera (mode, days, pre/post seconds, stream facts) and two
  retention numbers that are deliberately different: measured (the oldest recording the NVR still has, one
  bounded search per camera) and estimated (capacity over the configured bitrates), each with its reason.
  Nothing is written to the device: no format, RAID, deletion, quota or schedule changes; the quota and
  overwrite endpoints the lab NVR refuses (403) are named as such. Cached ten minutes, refresh on demand.

## 0.1.25 (pilot)
- Investigation cases (T049): a case links events, recording clips and notes from several cameras, with tags
  and a status (open / in review / closed). "הוסף לתיק" on the event page, in playback and on the historical
  map; the case page shows every item with its preservation state: a clip is a bookmark into the NVR until
  "שמור עותק" runs an export job that copies it (preserved only when the copy is complete); footage the NVR no
  longer has is shown as missing and never as preserved; an unreachable NVR reads "not checked". Edits need
  the cases.manage permission (operator, site admin, system admin) and the current revision (409 on a stale
  one). Cases are part of the project backup.

## 0.1.24 (pilot)
- Plan version history (T038): the editor lists every version of the floor (thumbnail, status, date, placed
  items, notes). Publishing always shows a preview first: geometry changes against the published version and
  what happens to every placed item. An archived version can be restored: it is published again as a new copy,
  the previous one goes to the archive, and pins follow whenever the geometry is identical (never to an
  invented location). Concurrent changes are refused clearly (409 stale_revision / stale_published).
- Historical map: the plan version and the pins shown are the ones in force at the chosen instant once the
  floor's history has begun; earlier instants show the current map and say so.

## 0.1.23 (pilot)
- Recording frames at an instant (T044): GET /cameras/{id}/frame?at= grabs one JPEG from the recording
  (ffmpeg on the server, cached per 10 seconds, negative-cached, capped at 150 MB, playback permission).
  The playback timeline shows a floating preview while hovering; the historical map shows the selected
  camera's frame at the chosen instant.

## 0.1.22 (pilot)
- Multi-camera selection from the floor map (T043): "בחירת מצלמות" turns pins into a picker (or "בחר
  הכל"), "קיר חי" opens the live wall with exactly those cameras, "ניגון מסונכרן" opens playback with the
  first as lead and up to three more as the synchronized group. The live wall accepts `?cameras=` and
  playback accepts `?extra=`.

## Documentation (2026-09-16, no version change)
- G0 documents: dependency, licence and secrets audit (`docs/security/DEPENDENCY_AND_SECRETS_AUDIT.md`,
  pip-audit and npm audit clean), model policy page (`docs/operations/MODEL_POLICY.md`), pilot contract
  lock (`docs/architecture/ADR-015-pilot-contract-lock.md`) with the generated route inventory
  (`contracts/API_INVENTORY.md`, `scripts/api_inventory.py`), and `scripts/progress.py` for the
  progress figures in every report.

## 0.1.21 (pilot)
- System status in the top bar (T035): the pill shows green "מערכת תקינה", amber "יש מה לבדוק" or red
  "תקלה: …" from a cheap summary (alert stream, camera discovery, go2rtc sync, HA sync, event pictures,
  backup age; no device probes), refreshed every minute; clicking it opens הגדרות → בריאות ועבודות. When
  something fails a banner under the top bar names it on every screen. API: GET /health/summary (every
  signed-in user; operator wording only). הגדרות accepts ?tab=.

## 0.1.20 (pilot)
- Phone layout (T034): every table becomes a card list under 768 px (cells stack with their column label,
  the picture sits beside the text, nothing scrolls sideways); the event centre shows "לבדיקה / טופלו
  היום" tiles on phones (M45); the camera card, event drawer, event page and historical map already stack
  or open as bottom sheets. Fix: in design SW A the phone layout kept an empty rail column and squeezed
  every screen into a narrow strip; the shell now collapses to one column on phones. Verified at 390 px
  against the developer backend.

## 0.1.19 (pilot)
- Historical map on real data (T030, design M16 basic): the floor at a chosen instant — cameras show
  whether a recording covers that instant (blue) or not (dashed), HA entities are shown as unknown (no
  state history is stored; never the last live value), events around the instant are listed, a day
  timeline with recording segments and event ticks scrubs the time, a date picker and floor switch, and
  an explicit "חזרה למצב חי". The event page's "המשך חקירה במפה" opens it at the event time with the camera
  selected; "נגן מכאן" opens playback at the chosen instant. No physical actions in this mode.

## 0.1.18 (pilot)
- Health and diagnostics (T033): הגדרות → בריאות ועבודות shows one card per subsystem with a real status —
  database, storage (free space and what the add-on uses), NVR (live probe: model, firmware), go2rtc
  (version, our streams), HA sync, bridge, event ingest, recording-derived events, camera discovery,
  event pictures, exports, live and playback sessions, backups — with "בדוק עכשיו". API: GET /health/report
  (system.configure), probes cached for 20 seconds.

## 0.1.17 (pilot)
- Project backups (T026) and rollback safety (T036): a zip with the project tables (sites, buildings,
  floors, plan assets and versions, anchors, cameras, zones, settings; optionally users and permissions)
  plus the plan files. Written automatically before every version upgrade (last 5 kept) and once a day
  (last 7 kept), on request from הגדרות → גיבוי ושחזור, downloadable, uploadable, and restorable in one
  transaction (replace or merge; the restoring administrator keeps access; RESTORE must be typed; audited).
  Never contains secrets or video. API: /backups.

## 0.1.16 (pilot)
- Event centre review windows (design M26): "חלונות" groups adjacent events of the same camera (gap
  1 / 3 / 5 / 10 minutes) into one row with picture, dominant type ×count, camera, time range and
  handling status; a window opens a drawer with its raw events, "סמן הכל כטופל" handles them at once
  (each ack audited by name) and "סקירה מלאה" opens the event page. Nothing is merged or deleted in
  the store. API: GET /events/windows, POST /events/ack-many. The chosen view is remembered.

## 0.1.15 (pilot)
- Global search in the top bar (design M48, pilot scope): Ctrl/⌘+K focuses it; typing lists rooms and
  zones (those marked for spatial search), cameras (name or channel), floors, buildings and HA entities,
  each with its place; arrows + Enter or a click open the hit — a room opens its floor highlighted and
  zoomed, a placed camera or entity opens its card on the map, an unplaced camera opens the live view.
  Results are filtered by the user's scope. API: GET /search?q=.
- Floor map: ?zone= / ?camera= / ?entity= on the floor route select and zoom to the item.

## 0.1.14 (pilot)
- Stylized rendering with choices: cleaning strength (קל / בינוני / חזק), room fill (white, one soft tint
  per room, none) and whether furniture, doors and other thin lines from the drawing are kept in a faint
  tone; the comparison caption names the chosen options. API: `room_fill` on POST /plan-versions/{id}/stylize.
- Floor map: the layer switches are remembered per floor in the browser (M07).

## 0.1.13 (pilot)
- Zones can be reshaped on the map (design M13): the selected zone shows corner handles (drag to move,
  double-click to remove, at least three stay) and edge-midpoint handles (drag to add a corner); each
  change is saved at once with the zone's revision.

## 0.1.12 (pilot)
- Event page (design M27) at #/investigate/events/{id}: the recording plays from two seconds before the
  event (event time and played frame time shown separately), context card with status / source / type /
  start time / window duration / location "building · floor / zone", the camera's floor with the pin
  selected and the zones under it, events ±10 minutes, "סמן כטופל", "המשך חקירה במפה", "הנגן המלא עם
  ציר הזמן". API: GET /events/{id} (names, picture state, time zone, location from the camera's anchor and
  the smallest zone containing it; scoped per camera), `acked=true` on GET /events.
- Event centre (M26): tabs לבדיקה / הכל / טופלו; the drawer's "סקירה מלאה" opens the event page.

## 0.1.11 (pilot)
- Floor map viewer per the design (M05/M06/M07): floor chip on the map, zoom controls bottom-left and
  legend bottom-right, a "שכבות" panel with toggles and counts (cameras, doors/intercom, lighting,
  security/sensors, room names; a toggle changes only what is drawn), zone name chips shown by zoom
  level, the camera card plays the camera live inside the card (session released with the card; NVR
  snapshot as poster) with status, location (floor / zone the pin sits in), "צפייה מלאה" and "הקלטות",
  and Escape closes the card with keyboard focus back on the pin.

## 0.1.10 (pilot)
- Fix: the plan import crop did not match the preview when the page was rotated (the crop box was placed
  against the container while the CSS-rotated picture kept its unrotated box). Page previews are now
  served already rotated (`preview.png?rotation=90|180|270`), the crop rectangle is drawn with the mouse
  over that picture and rotating resets it; the saved version is exactly the drawn area.
- Rooms and zones (design M13): named polygons on the floor (`spatial_zones`, migration 0006). The plan
  editor's "חדרים ואזורים" tool detects rooms on the plan locally (same wall analysis as the stylized
  rendering; candidates only, nothing saved until accepted), lets you name, keep or drop each one, draw
  further zones by clicking corners, and edit name / kind / colour / searchable; the viewer shows the
  names under the pins with a layer toggle. API: GET/POST /floors/{id}/zones, PATCH/DELETE /zones/{id},
  POST /floors/{id}/zones/detect, POST /floors/{id}/zones/accept; zones ride in the floor map bundle.
  A map zone is spatial context only, not a camera detection zone or privacy mask.

## 0.1.9 (pilot)
- Design switch: "SW A" (mockups v1.3: four-area icon rail, 72 px top bar with breadcrumbs, SW A tokens)
  and "SW B" (the earlier boards); installation default, editable names and a per-browser choice in
  הגדרות → כללי. `docs/design/mockups-v1.3/` holds the handoff document and key screens.
- Plan editor rebuilt per M12: direction and field-of-view handles on the selected camera, click-to-place
  for cameras and HA entities, floating tool rail, numeric inspector, keyboard nudges and shortcuts,
  layers, explicit save; bearing 0° = up, clockwise.
- Stylized plan rendering per M11 (local): `POST /plan-versions/{id}/stylize`, `PATCH /plan-versions/{id}`
  (render_mode), source/stylized picture endpoints, migration 0005; the map serves the chosen rendering.
- Dependency: numpy.

## 0.1.8 (pilot)
- Users and roles (הגדרות → משתמשים והרשאות): directory from Home Assistant through the bridge,
  role bindings for users and VMS groups at installation/site/building/floor scope with a preview,
  effective-permission view, RBAC audit tab, "sync users" button (integration 0.1.2 adds the
  `smplwise_bridge.sync_directory` service). API: /identity/users, /identity/sync, /access/roles,
  /access/bindings, /access/groups, /access/preview, /audit.
- Access rules: rbac.assign only; system roles installation-wide; last administrator protected; a user
  disabled or removed in HA loses access at the next push; revocations bump the permission revision and
  end the user's live/playback sockets.

## 0.1.7 (pilot)
- Fix: the automatic bridge install crashed inside the add-on image (IndexError while locating the
  integration files) and the settings tab blamed the config mapping; the source lookup no longer assumes a
  repository checkout above the module, and start-up errors are logged with their traceback.
- Settings tab: the "not available" reason now names the actual cause (mapping missing, files missing, crash).

## 0.1.6 (pilot)
- The bridge integration is delivered by the add-on: shipped in the image, copied into Home
  Assistant's `custom_components` through the `homeassistant_config` mapping when missing/outdated,
  announced via Supervisor discovery (config flow `hassio` step with the pairing code prefilled); status
  and an "install / update" button in הגדרות → גשר Home Assistant; `POST /ha/bridge/install`.
- Event pictures from the recording (lazy, one worker, ffmpeg frame grab, cached under /data/thumbs) in
  the event centre rows and drawer; "נגן כאן" plays the recording inside the drawer from the event time.
- Add-on config: `hassio_api`, `discovery: [smplwise_bridge]`, `map: homeassistant_config:rw`.

## 0.1.5 (pilot)
- Read-only Home Assistant sync: registries (entity/device/area/floor) and states through the
  Supervisor proxy, `state_changed` over the Core WebSocket, tombstones, freshness, `ha_entities` table
  (migration 0004); catalogue API and screen (ישויות HA) with domain/area/search filters and scoping
  by floor placements; `/ha/ws` push and `home_assistant` health.
- Entities on the map: plan editor entity picker (`?entity=` deep link from the catalogue), domain
  layers, live state in the marker and card, freshness/unavailable warnings.
- Safe actions through the new `custom_components/smplwise_bridge` integration (pairing code + HMAC,
  `smplwise_bridge.execute` with `Context(user_id)`, user directory push); allow-list on both sides,
  sensitive actions need confirmation, idempotent client ids, pending → confirmed by observed state,
  `ha.entity.control` permission (operator and above), audit rows.
- Settings → גשר Home Assistant: connection and sync status, pairing status, masked pairing code,
  add-on address, install steps, code regeneration (audited).
- Fix: recording-derived events no longer hold the SQLite write lock during NVR searches (other
  workers hit "database is locked" at start-up); HA sync writes in short chunks with busy retries.

## 0.1.4 (pilot)
- Events: alert-stream ingestion (parse, heartbeat, dedup, reconnect, coverage gaps, audited ack),
  recording-derived motion events (inferred), event centre with live updates, markers on the playback
  timeline, ingestion state in health; `events.retention_days`.
- Note: 0.1.3 was published twice under the same number; this release carries the events build.

## 0.1.3 (pilot)
- Cameras are discovered automatically: at start-up and every 10 minutes the add-on reads the NVR's
  channels (read-only) and, when go2rtc is configured, keeps the `smplwise_*` live streams in place.
  No "sync" click is needed before the first camera appears; the manual buttons remain. The last
  discovery result and error are shown in /api/v1/health (`discovery`).
- Playback stream names carry a per-installation id so a second product instance on the same go2rtc
  (a developer workstation next to the add-on) never deletes this instance's playback streams.
- Map screen: a fresh installation without floors shows what to do instead of an error.

## 0.1.2 (pilot, in progress)
- Default video transport is now **MSE** (works through Ingress, Cloudflare and behind CGNAT);
  WebRTC or automatic WebRTC→MSE can be selected in Settings → וידאו ומדיה when UDP to the go2rtc
  host is possible. Settings shows the running add-on version.
- Recordings: read-only NVR search per camera and local day with paging, coverage status and a short
  cache; TimeAdapter for the NVR's wall-clock times (IANA zone setting, DST-aware).
- Playback: sessions through the relay (go2rtc stream per session generation), seek = new generation,
  session cap and idle lease, orphan cleanup on start-up, audit of start/seek/stop; the הקלטות screen
  plays real recordings with the timeline following the media clock (precision labelled).
- Settings: playback cap and lease, time zone. Requirements: `tzdata`.
- Export: durable jobs (download by file from the NVR, ffmpeg remux to MP4 with concat + key-frame trim,
  manifest with SHA-256, cancel/partial/retention); `video.export` granted to operator and admins.
- Multi-camera playback groups (up to four cameras, best-effort sync with per-tile drift).
- Timeline: day → minute zoom (wheel), second-level seeks, drag scrubbing, future greyed out.
- Image: ffmpeg added to the add-on container.

## 0.1.1 (pilot, in progress)
- Live video: go2rtc adapter (namespaced `smplwise_*` streams only), authorized WebSocket relay,
  WebRTC/MSE player with automatic fallback and a transport default in Settings.
- NVR snapshots (read-only) as tile posters, cached in /data.
- Settings API (media transport, session cap, wall profile, snapshot freshness) and the Settings →
  וידאו ומדיה tab (go2rtc status, stream sync, open sessions).
- Camera view, wall, kiosk and the map popover use real streams and snapshots when a backend answers.
- Options: `nvr_rtsp_port`, `go2rtc_api_username`, `go2rtc_api_password`.
- Fixes: request transactions start with `BEGIN IMMEDIATE` (no "database is locked" when two live
  sessions end together); a live session is always released, even if its audit row fails; httpx/httpcore
  logging is capped at WARNING so source URLs never reach the add-on log; the floor-map nav entry opens
  the first real floor instead of the fixture id.

## 0.1.0 (pilot, in progress)
- Ingress-only FastAPI backend with SQLite in /data and versioned migrations.
- Identity from Supervisor Ingress headers; explicit bootstrap of the first VMS administrator.
- Sites → buildings → floors; plan assets (PDF/PNG/JPG), derived plan versions with rotation/crop,
  draft → published, map anchors with revisions and tombstones; audit log.
- Read-only camera discovery from the NVR (channels, online state, track ids).
- Built web UI (Hebrew, RTL, boards-language) served from the add-on.
