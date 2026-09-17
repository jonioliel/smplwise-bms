# Changelog — SMPLWISE VMS add-on

## 0.1.63 (pilot) — the owner's test round, batch 3
- Floor map: a "רשימה" panel lists the cameras (status) and the HA entities (by kind, with state) placed on the
  plan; a click zooms to the pin and opens its card, or adds the camera while picking. Open state kept per browser.
- Pick bar: one chip per room that holds cameras ("אולם ספורט (2)") picks or drops the room's cameras by name, so a
  concave room never needs a click inside its shape; "קיר חי" is the first action in the bar.

## 0.1.62 (pilot) — the owner's test round, batch 2
- History map: the navigation linked the demo floor id, so an installation opened "הקומה לא נמצאה" (3.11). The
  screen now lands on the first real floor and keeps its floor selector.
- Review windows (3.12): grouping by camera (as before), all cameras together, room or floor, with the gap
  selectable from 1 to 60 minutes; a grouped window lists the cameras inside it. Sensor events without a camera
  stay one window each.

## 0.1.61 (pilot) — the owner's test round, batch 1
- Camera wall: the tile count is remembered per browser and opens with the owner's default (הגדרות › כללי ›
  "מצלמות בקיר כברירת מחדל"); layouts up to 32 tiles (above the live-stream cap the extra tiles show snapshots).
- Kiosk: a layout picker in the header (2×2 … 6×4) writes cols/rows into the kiosk URL and is remembered per browser;
  the owner's default layout applies when the URL carries none.
- Event centre: "סמן הכול כטופל (N)" acknowledges every unreviewed event of the shown list (chunks of 500).
- Settings: "הסתרת חיפוש AI" removes the search tab from the navigation.
- Floor map: a plan larger than the viewport now zooms out until it fits (the "-1" plan opened huge).

## 0.1.60 (pilot) — hover preview on event rows
- Event centre (T044): resting the pointer on an event's thumbnail for a quarter of a second opens a strip with the
  frames 5 s before, at and 5 s after the event, taken from the recording through the existing frame endpoint
  (cached, two grabs at a time); a frame the recording cannot give says so. Touch devices are not affected.

## 0.1.59 (pilot) — playback opens inside the last recording
- The recordings screen opened "five minutes before the last segment ends", which on cameras that record on
  motion only landed in a gap between short clips ("no recording at this time" until a click). It now opens inside
  the last segment (its start when the segment is shorter than five minutes). Found in the review of the owner's
  installation on 0.1.58.

## 0.1.58 (pilot) — hotfix: the first real NVR alerts froze the installation
- The alert handler read the time zone through a second write connection while it already held the write lock:
  every alert blocked every writer for the busy timeout (10 s), and with "Notify Surveillance Center" enabled the
  installation answered `database is locked` everywhere. The zone is now read before the write connection opens,
  and the zone getter uses a read-only connection. Regression test in tests/test_events.py.
- The bridge integration's running version is recorded on every directory push, not only at pairing: the
  connections page no longer says "Home Assistant still runs 0.1.1" after an update and a restart.

## 0.1.57 (pilot) — bookmarks on the playback timeline
- Playback (T049): the day's case items of the camera (event windows and clips) show as flags on the timeline,
  coloured by preservation (copy saved / copying / bookmark the NVR still serves); a flag click seeks to it and
  names the case with a link to it; Alt + click on the track bookmarks that instant through the case picker
  (10 s before, 20 s after), and the new flag appears at once. `GET /cases/bookmarks?camera_id&date` (events.read
  on the camera; no NVR probe). The whole-case export with a manifest across items has existed since 0.1.40
  (evidence bundles).

## 0.1.56 (pilot) — selection on the map: rectangle, room, save as a view
- Floor map, "בחירת מצלמות" (T043): dragging a rectangle over the plan picks every camera under it (Shift + drag, a
  second finger and the wheel still move and zoom the plan); a click on a room picks the cameras placed inside it
  (a second click drops them); the pick bar counts the selection as watchable / offline / without live permission
  and says how many of the floor's cameras are not placed on the plan yet.
- "שמור כתצוגה": the selection becomes a saved view (name, kiosk layout, shared when the caller may share) that
  opens from the pick bar in the saved-views screen or straight on the live wall. Cameras the caller may not watch
  live are left out and counted; a view holds sixteen cameras at most.

## 0.1.55 (pilot) — kiosk restore and a smoke test after upgrades
- Kiosk (T057): the wall comes back to the exact page it showed after a reload, a power cycle or a reconnect (kept
  per view in the browser), and a user whose only role is "תצוגת קיוסק" is kept on the kiosk by the shell — any other
  route lands on `#/kiosk/all` (the API already limits that role to map.read + video.live).
- Tooling (T036, outside the add-on): `scripts/smoke_after_upgrade.py` runs sixteen read-only checks against a VMS
  (health facts, identity, cameras, sites, events, snapshot, a playback session it closes itself, export estimate,
  saved views, storage, audit, the built UI, and the bridge on the owner's installation) and exits non-zero on real
  breakage; checks the caller may not run are skipped, not failed.

## 0.1.54 (pilot) — export queue order
- Export jobs now run **smallest first**: the NVR hands files out at a fixed, modest rate (a 1 GB file took over
  half an hour in the lab), so a short clip no longer waits behind a whole-file preservation. A job that has waited
  more than 15 minutes goes first regardless, so big jobs never starve. One download at a time, as before (the NVR's
  playback slots are the limit).
- Tooling (outside the add-on): `scripts/migrate_legacy.py` (migration dry run from the legacy add-on, T070) and
  `scripts/release_check.py` + `docs/release/RELEASE_PACKAGE_V1.md` (T072).

## 0.1.53 (pilot) — slow motion and frame stepping (T066)
- הקלטות: **הילוך איטי ×0.5 / ×0.25** and **צעד־פריים** (one frame back / forward while paused) on the MSE
  playback path. Both are honest about the source: the relay delivers the NVR stream in real time, so the buffer
  is consumed slower or stepped through and the time on the stamp stays the source time (measured: at ×0.5 the
  position advances at about half the wall time). A frame outside the buffered media asks for a real seek.
- 2× / 4× stay disabled with the reason (they need a source that sends faster than real time); in a synchronized
  group only 1×. The session's capabilities now say so (`frame_step`, `supported_speeds`).

## 0.1.52 (pilot) — more entity adapters with risk classes (T040)
- Entity actions on the floor map now cover, beside lights / switches / fans / covers / locks / buttons / scripts /
  scenes: **climate** (operating mode, target temperature), **media players** (play, pause, stop, volume),
  **number / input_number** (set a value), **select / input_select** (choose an option), **input_boolean**,
  **vacuum** (start, return to base), **siren** (on / off) and the **alarm panel** (arm home / away, disarm).
- Every action carries a risk class: *routine* runs at once; *attention* (scripts, scenes, buttons, covers,
  sirens, arming) asks for an explicit confirmation; *sensitive* (unlocking a door, disarming the alarm) also needs
  its own grant that no role implies — `door.unlock` and the new `alarm.disarm`, granted through a custom role.
- Arguments are validated by the add-on before anything reaches Home Assistant (numbers in range, modes and
  options from a fixed list, texts bounded), the expected state follows the requested value (a mode, an option,
  a number), and the entity card offers an input per argument with sensible defaults from the entity itself.
- Bridge integration 0.2.1: the allow-list learns the new services. Home Assistant must be restarted once
  after the update for the new services to pass; until then they answer "service not allowed" with a hint.

## 0.1.51 (pilot) — the last two hidden screens built for real (live review F1 F3)
- לייב › **תמונת מצב** (F1): a real dashboard — greeting by the product time zone, cameras online / total with
  the recorder model, sites and floors with plans, today's events with the unreviewed count, the system status
  from the health summary; two live camera posters; storage (used %, capacity, measured retention — only for
  users who may read the storage report); sites and buildings with plan coverage and the NVR row; the last six
  events with pictures; and "דורש תשומת לב": offline cameras, failing health checks, unreviewed events, an alert
  stream that never delivered ("Notify Surveillance Center"), a lost Home Assistant connection — each with the
  reason it is shown and a button to the right screen. Refreshes every minute.
- לייב › **תצוגות שמורות** (F3): saved views for real — `saved_views` table (migration 0012), `GET/POST/PUT/DELETE
  /api/v1/views`. A view is a name, up to 16 cameras and a cols × rows layout; personal views belong to their
  owner, shared views (visible to everyone) need `rbac.assign` at the installation or at a site; every camera must
  be one the caller may watch live, and a reader who may not see one of a shared view's cameras gets the view
  without it (counted). The screen shows snapshot mosaics, opens a view on the live wall or in the kiosk
  (cols × rows per page), and edits or deletes with the owner's rights. Audited; part of project backups.

## 0.1.50 (pilot) — three of the hidden screens built for real (live review F4 F5 F6)
- חקירה › **Review · חלונות** (F4): the tab opens the event centre grouped into review windows (the day's events
  per camera by proximity, `/events/windows`), the same data the "חלונות" toggle shows — no demo queue any more.
- חקירה › **ניגון מסונכרן** (F5): a real launcher — pick 2–4 cameras (the first is the lead / reference clock),
  a start time, open the comparison in the recordings screen; the last six sets are kept in the browser. The
  measured sync itself is unchanged (0.1.38 / 0.1.41).
- הגדרות › **חיבורים** (F6, replaces the demo setup wizard): read-only facts about the add-on's connections —
  NVR (model, firmware, discovery, alert stream, stored alerts with the "Notify Surveillance Center" hint when
  none arrive), go2rtc (stream sync, health check), Home Assistant (connection, entities, snapshot / event /
  registry times, reconnects, identity source), storage and tools (DB, /data, PDF renderer, thumbnails,
  backups), and the list of Add-on option names with where they are set. Values are never shown.
- Breadcrumbs and tab labels use the real screen names with a backend; the design fixtures keep the demo
  screens.

## 0.1.49 (pilot) — live review fixes (docs/operations/LIVE_REVIEW_2026-09-17_HE.md)
- No demo data with a real backend: the demo-only screens are hidden from the tab bars and their routes land on
  the real screen — לייב › תמונת מצב → כל המצלמות, תצוגות שמורות → כל המצלמות, Review → מרכז אירועים,
  ניגון מסונכרן → הקלטות (the real sync is the comparison there), אשף התקנה → הגדרות (F1 F3 F4 F5 F6 F10).
  דלתות ואינטרקום shows an honest "not connected yet" state until the hardware exists (F7); the invented
  NTP toggle is gone from settings (F8). The demo versions stay for the design fixtures.
- Audit log for real (F2): הגדרות › אודיט lists the installation's `audit_log` — action family, user, count
  filters, decision badges, reason and details, CSV export.
- Camera health shows the camera's own snapshot instead of an illustration (F9).
- Events: the row subtitle names the real source — התראה מה־NVR / נגזר מהקלטה / חיישן HA / מערכת (F12); when
  the NVR alert stream is connected but produced no alert in the facet window, the header says so and names the
  NVR setting to enable ("Notify Surveillance Center", F14).
- A Home Assistant restart no longer writes one "None → state" door event per lock and sensor: an entity that
  just appeared has no transition (F11); older rows of that kind read "לא ידוע → …" instead of "None".
- HA sync: the periodic registry refresher is cancelled with its session, so a reconnect no longer leaves a stale
  task warning "registry refresh failed: ConnectionClosedOK" every 10 minutes (F13).
- Kiosk: 3×2 tiles per page by default (`rows=` in the URL restores 3×3) and streams start 400 ms apart, so the
  last tiles of a page no longer stall on the lab NVR / relay (F15).
- Polish: negative floor levels render "-1" instead of "1-" (F16); the floor selector no longer clips its label
  (F17); a favicon (F18); the import wizard names DXF and shows KB for small files (F19); version-history rows
  wrap their actions (F20); the AI-search provider note is in Hebrew (F21); the playback time field shows all
  digits (F22); two channels with the same NVR name are told apart by their channel number (F24); a cancelled
  queued export says who cancelled it (F25); a user without a role sees no developer links or search box (F26).

## 0.1.48 (pilot)
- Read requests no longer take the database write lock: the busy GET handlers (events list / facets, floor map,
  cameras, health summary, search, storage report, cases, camera recordings, /me) run in a deferred, query-only
  SQLite transaction, so eight concurrent operators are served side by side instead of one after the other
  (load probe: events 24 h p95 9.0 s → 3.5 s, health 2.7 s → 0.9 s, map / cameras / cases / facets ≈ 1–1.8 s →
  0.3–0.35 s; see docs/operations/RESOURCE_BUDGET.md). What such a request must still record — the audit row of a
  refusal, the one-time admin bootstrap, the user's last-seen stamp — is written through a short side transaction;
  the last-seen stamp is now updated at most once a minute per user instead of on every request. Write handlers
  are unchanged (BEGIN IMMEDIATE for their whole life).

## 0.1.47 (pilot)
- Storage report always warm: the report that costs one NVR search per camera (~40–50 s cold) is now built in the
  background once after start-up discovery and refreshed by the janitor every 8 minutes, so הגדרות › אחסון opens
  from cache; a failed warm-up is logged and the next request builds on demand.
- No screen recreation on first load: the shell now starts with the design this browser saw last (or the URL /
  per-browser override), so the product setting arriving a moment later no longer swaps the layout and rebuilds
  the screen — typing or uploading during the first second is no longer lost. First visit on a fresh browser still
  switches once when the setting differs from the default.
- Load probe re-run (docs/operations/RESOURCE_BUDGET.md): 0 errors on every endpoint under eight workers; the
  24 h events list still pays the write-lock serialisation (p95 ≈ 9 s under that load; read-only connections
  remain the next optimisation).

## 0.1.46 (pilot)
- Playback quota hygiene: a playback session nobody ever connected to (a tab closed during start-up, a screen
  left before its stream arrived) is dropped after 90 s instead of holding a relay stream and one of the four
  quota slots for the whole idle lease; and the browser releases its own sessions and groups when a page is left
  (beacon to the new POST …/close routes, which do the same as DELETE). Found during the night's regression sweep,
  where a burst of screens produced "מכסת הניגון מלאה".

## 0.1.45 (pilot)
- Lovelace card (T056): the SMPLWISE Bridge integration (now 0.2.0) ships `custom:smplwise-card` and registers it
  as a dashboard resource on load (best effort — in YAML-mode dashboards the log names the resource to add by
  hand). The card embeds the add-on's own Ingress page for one view — `camera` (with a camera id), `map` (with a
  floor id), `events`, `health` or `wall` — so the person is who Home Assistant says they are and the VMS applies
  its own roles: no secret in YAML, no entities, no way around a permission. The VMS gained an embed mode
  (`embed=1` in the route): the screen renders without the shell chrome, and stays that way for in-app navigation
  inside the iframe. After updating the add-on, restart Home Assistant once so the 0.2.0 integration (with the
  card) loads; then add the card to a dashboard.

## 0.1.44 (pilot)
- Semantic search with a local baseline (T063): חקירה › חיפוש AI takes a free question in Hebrew or English
  ("אדם בלובי אתמול בערב", "vehicle near the gate this morning 08:00-09:30") and turns it, without any model or
  network, into the event centre's own filters — object class from the device's detection target, places from the
  catalogue (rooms, floors, cameras, matched by name inside the caller's scope), a time window in the site zone —
  shows the interpretation as chips, runs the scoped query and labels every hit with a confidence (exact / partial)
  and its basis. Colour and appearance terms are reported as unsupported because no source produced that metadata;
  words that were not used are listed. The provider registry states the contract every analysis provider must
  meet — model version, privacy statement (what leaves the installation), daily budget, explicit opt-in — and no
  external provider is bundled: ai.provider=external is refused rather than pretended. Every answer carries the
  statement that metadata matches are not identity evidence.

## 0.1.43 (pilot)
- DXF floor plans (T065): the import wizard accepts .dxf (recognised by content, like every upload) through an
  isolated conversion adapter built on ezdxf (MIT). On upload the drawing is inspected — DXF version, units from
  the header, layers with their drawable counts, entity counts, and the entity types that are not converted
  (TEXT/MTEXT, HATCH, DIMENSION, 3D) — and rendered from LINE / LWPOLYLINE / POLYLINE / CIRCLE / ARC / ELLIPSE /
  SPLINE / INSERT. A partial conversion is always stated, never hidden; a selection with nothing drawable is
  refused. Layers and units are chosen per file and re-render the preview from the untouched source; a version
  made from a drawing with known units carries its scale (metres per pixel) automatically. DWG is not supported
  (closed format): convert to DXF first.

## 0.1.42 (pilot)
- Capability facts per camera (T045 / T012, read-only half): the camera page now shows what the NVR itself reports
  — PTZ supported / unsupported (only on the device's own notSupport) / unknown with the reason, the preset list
  (read, never recalled), and two-way audio available / disabled on the device / unsupported / unknown — as badges,
  cached five minutes, same permission as live video. Moving the camera, recalling a preset and talking are device
  writes: not offered in the pilot and never shown as a fake control; digital zoom is named for what it is, a
  browser enlargement. Lab: the fixed cameras answer PTZ notSupport, an empty preset list and an audio channel that
  exists but is disabled.

## 0.1.41 (pilot)
- Synchronized playback closes small drifts without re-seeking (T042 follow-up): a tile that is between 0.25 s and
  3 s off the master clock plays 5–15 % faster (behind) or slower (ahead) until it is back within 0.25 s; only a
  drift beyond 3 s still costs a member re-seek. Nudges are counted per tile in the sync report. Lab measurement:
  real Chrome, 3 cameras: right after the barrier 'slight' with p95 1.27 s and one nudge; within 90 s the second tile stalled again (two re-seeks, then late) and the third never rendered - the nudge is correct but the lab's playback delivery (NVR / relay / MSE stalls) remains the limit.

## 0.1.40 (pilot)
- Signed evidence bundles and key management (T067): every bundle now carries manifest.sig.json — an Ed25519
  signature over manifest.json by the installation's active key, with the public key and key id embedded.
  Verification (in the app or offline with scripts/verify_bundle.py) recomputes every hash and checks the
  signature, and says which of three things it found: signed by a key of this installation (active or retired),
  signed by a key this installation does not know (integrity only), or unsigned (bundles from before 0.1.40).
  Tampering with a file, the manifest or the signature is reported. The private key is created in /data/keys
  with mode 0600, never leaves it and never enters a backup; הגדרות → אחסון shows the active key and lets a system
  administrator rotate it (audited) — retired public keys stay in the keyring so older bundles still verify.
  The trust statement is explicit: a signature proves the bundle did not change since export by that key
  (integrity-at-export); it does not prove the footage is authentic at capture and is no statement of legal
  admissibility. New dependency: cryptography.

## 0.1.39 (pilot)
- Detection zones and privacy masks as the NVR holds them (T075, read-only half): the camera page reads the
  channel's motion-detection grid (rows × columns, sensitivity, target types, coverage), privacy-mask regions,
  intrusion (field) regions and line-crossing lines through ISAPI GETs only, parsed with the safe XML parser and
  cached for a minute, and draws them over the snapshot with per-layer toggles. A source the device refuses or
  lacks is listed as "not read" with the reason, never invented. The card states what it is: polygons in the
  camera image (not rooms on the floor plan), a browser overlay that is not an NVR mask and protects no
  recording; editing or a real mask needs an explicit approval, a verified write-back and a check in the stream,
  none of which exist in the pilot (no write route). Same permission as live video.

## 0.1.38 (pilot)
- Measured multi-camera sync (T042): a playback group now runs on one master clock — an opening barrier waits for
  every member to render (or 12 s), then the clock is the median rendered time of the playing tiles (the lead's
  when fewer than three), carried by the wall clock between frames, so no single tile drives the timeline. Each
  tile's rendered time is measured against that clock twice a second; the p95 of |drift| over the last 40
  samples sets the quality shown on the stamp (מסונכרן ≤ 0.5 s, סטייה קלה ≤ 2 s, לא מסונכרן) and is reported to the
  server on the group for the session's evidence. A tile that is out by more than 2 s for three samples is
  re-seeked alone, aiming ahead by its own measured start-up latency; the clock and the other tiles never move,
  a tile without a recording stays "missing", a tile that does not render within 8 s is marked late. Only 1× is
  offered in a group and the source's unsupported speeds are disabled with the reason. Lab measurement: lab 2026-09-16/17, real Chrome, 3-4 cameras: tiles render 4-11 s after the seek; right after the barrier p95 was 1.9-2.6 s (three of four tiles within 1.2 s of the clock), degrading to 3-7 s within 1-2 minutes as MSE tiles stall; a member re-seek recovers a tile briefly; in one run two of four tiles never rendered within 100 s (concurrent playback capacity of the lab NVR / relay) - measured, shown and reported, not hidden.
- Fixed: the 30 s housekeeping pass (idle playback, orphan streams, export retention, event / thumbnail / audit /
  HA-history pruning, periodic discovery) had died silently at every tick since 0.1.30 on a missing import; it
  now runs as a tested function and logs a traceback if a step fails.
- Fixed: a playback session created while the playback screen was being replaced (route change during start-up)
  leaked until its lease ran out and counted against the playback quota; it is released at once.

## 0.1.37 (pilot)
- Home Assistant's own answer decides an action (T079): every entity action still runs in the VMS user's own HA
  identity through the bridge, and a refusal by Home Assistant (the user lacks the entity permission there, or the
  HA user behind the session no longer exists) is now recorded and audited as `ha_unauthorized` / `ha_unknown_user`
  and explained in words on the map — the add-on's own token being an administrator changes nothing. Unlocking a
  lock needs the separate `door.unlock` grant on top of entity control: no built-in role carries it, a custom role
  can, the entity card disables the button and says why, and the refusal (`grant_required`) is audited without
  anything reaching Home Assistant. Map editing grants no control. The action request is closed — it cannot carry
  a user id, a context or a raw service call, and only the allow-listed actions exist, so there is no generic
  service proxy. Live evidence with a second, restricted HA user is still pending (owner's item).

## 0.1.36 (pilot)
- Custom roles and delegated administration (T082): הגדרות › משתמשים והרשאות › תפקידים lets a system
  administrator compose a custom role from ordinary permissions plus sensitive grants that must be ticked
  explicitly (export, entity control, unlock, PTZ, talk…); system permissions (configuration, role management,
  binding management) can never be part of a custom role, and built-in roles stay immutable. Before a role is
  saved the screen shows its impact — how many bindings, which users and groups, at which scopes, and which
  permissions are added or removed — and a change takes effect on the next request of every affected session
  (optimistic revision, so two administrators cannot overwrite each other). A role that is still bound cannot be
  deleted. Delegation: a site administrator may now assign roles inside their own site, but only roles on the
  delegation allowlist (a setting edited on the same tab), only roles whose permissions they hold at that scope,
  only to users (never groups) and never a role that carries a system permission; every refused delegation is
  audited with its reason. Custom roles are part of the settings backup.

## 0.1.35 (pilot)
- Alarm rules with a dry run (T052): חקירה › חוקים והתראות builds a rule from trigger (event types, sources,
  minimum severity), scope (floors, rooms, cameras through the floor plan), a site-local time window and a
  cooldown; the only action in the pilot is a VMS notification. "הרצה יבשה" replays the day's stored events and
  explains, per event, why an alert would or would not have been raised — nothing is written or sent. Enabled
  rules evaluate new NVR alerts and HA sensor transitions as they arrive; alerts are acknowledged on the
  "התראות" tab. Alerts are not events (no loops), one alert per rule and event, cooldowns compare event times,
  every change carries its author and revision, and a rule owned by Home Assistant is a reference only.

## 0.1.34 (pilot)
- Load probe and resource budget (T068): scripts/load_probe.py measures latency percentiles per endpoint under
  concurrent load plus the backend process memory, and docs/operations/RESOURCE_BUDGET.md records the reference
  measurement on the developer workstation against the lab NVR and HA. Two findings fixed on the way: identical
  concurrent recording searches now wait for one NVR search instead of each running their own (the p95 of a
  cold "recordings today" request under 8 workers went from about 20 s to well under 2 s), and the storage report is
  built once even when several callers ask at the same moment. Read-only measurement; no device writes.

## 0.1.33 (pilot)
- HA history on the historical map (T041): every entity state the VMS learns of (the snapshot at connect and each
  change) is kept locally for 30 days. The historical map shows, per placed entity, the state that was in force at
  the chosen instant — known only when the local history covers it (a later change bounds it, or the last
  confirmation is at most 24 hours old); otherwise "unknown" with the reason (before the history began, no
  recorded state, or too old to forward-fill). The live value is never shown in a historical bundle, and a
  timezone change never moves the instant.

## 0.1.32 (pilot)
- Evidence bundle (T050): "צור חבילת ראיות" on a case builds one ZIP with the preserved clips (copies of the
  finished export outputs and their export manifests), the snapshots, the notes, a manifest with a SHA-256 per
  file and the source / time details of every item, and a readable Hebrew report. Items that are only
  bookmarks are listed as skipped, never silently included. "אימות חבילה" recomputes every hash of an
  uploaded bundle and reports each file (ok / mismatch / missing / extra). The hash proves the file did not
  change since the bundle was made — not the authenticity of the picture; signing is a separate capability.
- Snapshots into a case (T046): "צלם תמונה לתיק" copies one JPEG from the camera into the case with its hash;
  the item is "עותק שמור" from the start. Manual recording and OSD sync are not offered in this build: no
  proven ISAPI capability on the lab NVR and no approval for device writes — there is no placeholder button.

## 0.1.31 (pilot)
- Kiosk / wall display (T057): #/kiosk/all takes a saved view in the URL (cameras, cols, rotate seconds),
  rotates pages, shows the system health pill from the summary endpoint, dims the wall after three failed
  polls and reloads it on the first success, and never shows an offline camera as live. A new "תצוגת קיוסק"
  role (map + live only) lets a wall log in without events, playback, exports, HA control or settings.
- Suggested path (T064): every event page of a placed camera offers "המשך מסלול מוצע" — the neighbouring
  cameras ranked same room → adjacent room → within reach, with the window to look at and the activity each
  reported. Labelled hypothetical: no claim of the same person or vehicle, no action.

## 0.1.30 (pilot)
- Spatial RBAC (T055): an explicit deny on a floor now wins over an installation-wide allow for every camera-bound
  request (live, playback, recordings, events, cases, exports, HA); before, the fallback check re-evaluated the
  wide scope and let the holder through. Camera refusals are audited with the real reason (explicit_deny /
  no_binding / user_inactive). Audit rows older than 365 days are pruned by the janitor. A matrix test covers
  viewer / operator / editor / site admin / denied operator across map, live, playback, events, cases, exports,
  publishing, placements, HA actions, storage, access administration, revocation inside an open session and
  deactivation.
- File and network hardening (T069): device XML with DOCTYPE / ENTITY declarations is refused before parsing
  (NVR search, discovery, alert stream, storage, schedules); a corrupt PDF upload is a 422 instead of a crash;
  tests pin content sniffing (SVG refused, name and declared type ignored), the upload size cap, path traversal
  in every file-serving route, the absence of any URL-fetching parameter, relative media paths only, and bridge
  replay / expiry / forgery / tampering refusal.

## 0.1.29 (pilot)
- Documentation: operator guide in Hebrew (install → NVR → HA → go2rtc → floor → camera with the checks that
  prove each step, daily use, investigation from event to preserved evidence, recovery, privacy and permissions,
  what to collect for support) — docs/operations/OPERATOR_GUIDE_HE.md. Visual regression process —
  docs/operations/VISUAL_REGRESSION.md. Canonical plan geometry schema v1 with a validator and a deterministic
  export of a plan version — contracts/schemas/plan_geometry.v1.schema.json, docs/architecture/PLAN_GEOMETRY_SCHEMA.md.
  No behaviour change in the add-on.

## 0.1.28 (pilot)
- Spatial metadata search (T062): the event centre filters by place (building · floor, then room / zone)
  through the items placed on the floor plan, and by source (NVR alert, derived from recording, HA sensor,
  system) and severity. A line above the list says which fields have data in the last 90 days and why the
  others are empty (for example: no person / vehicle events because the NVR sends motion only). A filter that
  cannot match by construction — a type this installation never produced, a room with nothing placed in it —
  is shown as "unsupported here", never as "no results".

## 0.1.27 (pilot)
- Door–camera–sensor correlation (T053): state transitions of door and window contacts, motion sensors, locks
  and gates from Home Assistant are kept as events (source "חיישן HA"). Every event page has a correlation
  card: the sensors and locks placed around the camera on the floor plan (same room or within reach), what
  they reported within ±2 minutes, unlock commands sent from the VMS, and the other cameras' events — each
  with its certainty (measured / inferred / command). A pulse unlock is shown as a command that was sent,
  never as proof that the door opened. Delayed device clocks and sensors without a state are named. No
  action is ever triggered from a correlation.

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
