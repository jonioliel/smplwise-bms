# CR-029 - Frigate provider, phase F1 "see and play" (task NN5-F1A: backend)

**Status:** implemented on `pilot/NN5-F1A-backend`, not merged. **Read-only toward Frigate.** UI is task F1B.
**Study:** `docs/research/FRIGATE_STUDY.md` (branch `pilot/NN5-frigate-study`, sections 6-8). **Builds on:** CR-022 (connection in Arx),
CR-024 (multi-recorder), CR-025 (Provision-ISR, the template), CR-026 (recorder health), CR-027 (notifications).
AGENTS.md still holds: no required Frigate; continuous recording stays on the primary NVR; a site without Frigate behaves as before.

## 1. Owner decisions applied (defaults = the study's recommended answers; the owner confirms)

| Decision | Applied as |
|---|---|
| F1 only, no writes to Frigate | `frigate_http.GET_ALLOWED` is an allow-list; the only non-GET is `POST /api/login`. Tests assert `non_get == [login]` after every flow |
| Minimum version 0.18 | `frigate.MIN_VERSION`; an older server is `online=false, error=nvr_not_supported` and `409 frigate_version_unsupported` on import |
| "viewer" account first | The connection takes a user + password; a 403 on one route (a role limit) is a named part failure, a 401 is a stop |
| Live = still tiles until a restream exists | `capabilities().live = "none"` (or `rtsp` when `/go2rtc/streams` lists streams); `GET .../snapshot`; `ensure_streams` skips Frigate cameras; the media live route answers `409 live_not_available` with `fallback: still` |
| Same camera on Hikvision and Frigate = one place | Field only: table `camera_links` (migration 0064), returned as `links` in the camera list. No UI, no behaviour |
| Notifications from alerts only | `rules.evaluate_event` runs when a review item is first stored as an alert (or escalates detection -> alert); never for a detection |
| No face / LPR / genai | Discovered as features (`faces`, `lpr`, `genai`) and reported, never used |

## 2. Feature flag and provider selection

- The provider is selected by the recorder's vendor (`recorders.vendor = 'frigate'`, from the connection). Every route answers only for such a recorder (another id: 404).
- The catalogue (`GET /nvr/vendors`) keeps Frigate "coming soon" (`planned`, not selectable) until the add-on option `frigate_enabled` is on (`run.sh` exports it as `SW_FRIGATE=1`; the variable still works outside the add-on) (CR-022 D1: after the live validation checklist passes). A recorder that already has vendor `frigate` is served either way.
- `SW_FRIGATE_EVENTS=0` switches the event loop off (tests use it, like `SW_RECORDER_HEALTH`).

## 3. Migration

**0064** (`0064_frigate_provider.sql`; 0060 is released, 0061 generator / 0062 wall profiles / 0063 device activity are in flight on other branches, so the next free number was used). Additive; rollback = run the previous version.
`frigate_reviews`, `frigate_review_state` (per user), `frigate_sync_state`, `camera_links`. The hard-coded migration-list assertions in four tests now end `..., 59, 60, 64]`; whoever merges 0061-0063 must merge those lists (a trivial conflict).

## 4. Connection, secrets, TLS

- Stored through the existing recorder connection (AES-GCM password in `recorder_connections`): `host`, `http_port` (default **8971**, the authenticated port), `username`, `password`, extras `scheme` (https default | http), `tls_mode` (pin | verify | trust), `tls_pin`, `poll_interval_s`. Port 5000 (unauthenticated, everyone is admin) is NOT supported in F1.
- JWT cookie `frigate_token`: in memory only (never stored, logged or returned); one login at a time per device; on 401 one fresh login and one retry; a second 401 or a refused login starts a 5-minute backoff (Frigate rate-limits logins). 429 on login is `source_unavailable`.
- TLS: the Provision pinned context (`PinnedContext`, checked on the same connection before any request byte); the connection test returns the certificate's SHA-256 for pinning; `certificate.not_after` flows into the CR-026 card for pinned HTTPS.
- Scrubbing: `/api/config` holds RTSP URLs with credentials; only `summarize_config` (a whitelist) is returned or stored. `scrub()` removes secret-shaped keys, URL user-info and `ffmpeg_cmds` from anything else. No address, user, password, token or Frigate path reaches a browser, an error detail or a log line (a test sweeps every API body for them).

## 5. What is built

| Area | Where |
|---|---|
| HTTP, auth, allow-list, caps | `services/recorders/frigate_http.py` |
| Adapter: capabilities (discovered `features`), health, cameras, reads | `services/recorders/frigate.py`; registered through `registry.register_vendor` |
| Review items, events mirror, WebSocket + polling loop, offline debounce | `services/recorders/frigate_events.py` |
| Coverage, density, playlist rewrite, playback and export design | `services/recorders/frigate_playback.py` |
| Dispatch for the Hikvision-shaped call sites | `services/recorders/frigate_io.py`; hooks in `autosync`, `routers/cameras.py` (snapshot), `routers/media.py`, `events_ingest._loop`, `connection_probe`, `health_report`, `recorder_health` |
| API | `routers/frigate.py` |
| `RecorderCapabilities.features` (frozenset, default empty) and `HealthReading.details` | `base.py` (additive; Hikvision and Provision untouched) |

**Camera identity (ADP 3.2):** `cameras.source_ref` = the Frigate config key; `channel` is synthetic, assigned once (existing rows keep theirs); `main_track` stays NULL so no Hikvision recording path touches the row. A camera disabled in Frigate is imported as a disabled Arx row with `capabilities.stream.reason = disabled_in_frigate`. A camera that left the config is marked offline + disabled, never deleted (history stays).

**Review model:** one `frigate_reviews` row per review id (layers `alert` | `detection`; `motion` is activity density at `/activity`), updated in place; mirrored as ONE `events` row (`source = frigate`, `dedup_key = frigate|<recorder>|review|<id>`, type person / vehicle / other, severity alert -> alert, detection -> info, confidence measured). Per-user reviewed state is Arx's (`frigate_review_state`); Frigate's `has_been_reviewed` is never written.

**Transport:** WebSocket `/ws` is primary (listen only, nothing is ever sent). Polling `GET /api/review` is always on: 60 s while the WebSocket is connected, `poll_interval_s` (default 10 s, never below 5 s) while it is not, and 5 s after any `events` / `tracked_object_update` hint. Each poll re-reads 10 minutes back and refreshes (by id) up to 20 still-open items older than that; an item Frigate dropped is closed where it stood. A connection lost longer than 45 s records a `coverage_gap` event and the backfill reads the missed span from Frigate's own history (`measured`). `<cam>/status/detect` offline becomes one `offline` (critical) event only after 60 s (debounce), closed when the camera returns.

## 6. API for the UI (F1B)

All under `/api/v1/frigate/{recorder_id}` (recorder ids are `nvr-<n>`), JSON unless stated; errors are the shared `{code, user_message, ...}` model.

| Route | Permission | Notes |
|---|---|---|
| `GET /frigate/recorders` | recorder read | `{recorders: [{id, name, enabled, firmware}]}` |
| `GET .../status[?refresh=true]` | recorder read (`refresh`: `system.configure`) | `version`, `version_ok`, `min_version`, `features{}`, `routes_known`, `retention`, `detectors`, `cameras`, `sync{ws_state, ws_frames, last_poll_at, last_poll_error, polls}`, `health` (the CR-026 card), `warnings[]`, `live{mode: still\|restream}` |
| `POST .../discover` | `system.configure` | imports / refreshes cameras (read-only toward Frigate); returns the `sync_cameras` result |
| `GET .../cameras` | `video.live` or `events.read` per camera | `{id, key, channel, name, enabled, frigate_enabled, disabled_reason, status, snapshots, ptz, labels, zones, links[], can_view_live, can_play}` |
| `GET .../reviews` | `events.read`, camera-scoped | filters `severity=alert\|detection`, `camera_id`, `reviewed=true\|false` (the caller's), `from`, `to` (epoch or ISO), `before` (paging), `limit` (1-200); returns `{items[], next_before, layers, motion_layer}`; item = `{id, camera_id, camera_key, camera_name, severity, start, end, open, duration_s, objects[], zones[], sub_labels[], detections (count), type, event_id, reviewed, thumbnail}` |
| `GET .../reviews/{id}` | same | adds `detection_ids[]`, `reviewed_at` |
| `GET .../reviews/summary?days=7` | same | `{severity{alert{total, unreviewed}, detection{...}}, unreviewed_by_camera{}}` for the caller |
| `POST .../reviews/reviewed` | `events.read` on every item | body `{ids[1..200], reviewed: true\|false}`; the caller's state only |
| `GET .../reviews/{id}/thumbnail` | `events.read` on the camera | image bytes (webp), `Cache-Control: private`; falls back to the first tracked object's thumbnail |
| `GET .../activity?from&to` | `events.read` | the MOTION layer: `{buckets: [{start, motion, cameras[]}], bucket_s: 30}`, window <= 24 h, camera-scoped |
| `GET .../cameras/{camera_id}/snapshot[?h=]` | `video.live` | latest still, `h` 1-4000 clamped to 120-1440, server cache 2 s (`X-Still-Cache`), 429 `frigate_busy` beyond 4 reads in flight |
| `GET .../cameras/{camera_id}/recordings?from&to` | `video.playback` | coverage: `{ranges[{start,end,seconds,segments,motion,objects}], covered_s, ratio, partial, policy: continuous\|motion\|events\|off\|unknown, sparse_by_design, density[{start,motion,objects}], bucket_s}`; default last 6 h, max 24 h. **Partial is not empty**: with a motion-only policy `sparse_by_design` is true |
| `GET .../cameras/{camera_id}/recordings/summary` | `video.playback` | per-day (site zone) counts |
| `GET .../cameras/{camera_id}/playback?start&end` | `video.playback` | the plan: `playlist`, `assets`, `anchors{proven: false, ...}`, `seek`, `coverage`; window <= 6 h |
| `GET .../cameras/{camera_id}/playback/index.m3u8?start&end` | `video.playback` | HLS playlist (`application/vnd.apple.mpegurl`, `no-store`) with every URI rewritten to the asset route below |
| `GET .../cameras/{camera_id}/playback/{start}/{end}/{name}` | `video.playback`, re-checked per request | `init-v1.mp4` / `seg-N-v1.m4s` as `video/mp4`; only VOD names; 429 beyond 6 reads in flight |
| `GET .../cameras/{camera_id}/export-plan?start&end` | `video.playback` | DESIGN only: `executed: false`; nothing requested, nothing created |
| `GET .../storage` | recorder read | per-camera usage / bandwidth (names only) + policy |

Elsewhere: Frigate events appear in `GET /events` (`source=frigate`, `recorder_id`, `details{review_id, labels, zones, camera_key, severity_layer}`) and `GET /events/{id}/thumbnail` serves their picture; `GET /cameras/{id}/snapshot.jpg` works for a Frigate camera; `GET /recorder-health` cards of a Frigate recorder carry `vendor_details` (detectors, per-camera fps / skipped / reconnects / stalls, storage bandwidth and hours left, recording policy).

## 7. NOT VERIFIED / NOT BUILT (honest list)

- **WebSocket `reviews` / `events` frame payloads** were never observed on the real instance (no detection during the passive listen). The parser is defensive and tested against the documented MQTT shape (`{type, before, after}`); the always-on poll is therefore mandatory.
- **HLS anchors**: the playlist carries no `EXT-X-PROGRAM-DATE-TIME`; whether the first segment starts before the requested start and the rendered-time error are unproven (`ANCHORS_PROVEN = False`; the plan says so). Measurement F1-M1 with a real player is still to do. No playback session lease in F1 (every request is authorised individually).
- **Clip export**: design only; `GET .../clip.mp4` is not on the allow-list.
- Whether a **viewer** role can read `/api/config`, `/api/openapi.json` and `/ws` (a viewer account has not been created yet). A 403 on openapi leaves `routes_known: false`; on `/api/config` discovery fails with `source_forbidden`.
- **Live check (2026-10-05, read-only, owner's instance 0.18.0, account = the owner's existing one, NOT a viewer)**: the adapter ran one login plus GETs only and everything answered in the expected shape: version, discovery (7 cameras, 2 edgetpu detectors, routes known from openapi, features incl. `review_items`, `hls_playback`, `search_semantic`), the CR-026 reading (recordings mount in MB, per-camera connected / recording, detector inference ms, bandwidth and hours left), 178 review items of the last 24 h (all normalized; only `alert` severity occurred), review thumbnail (webp), one tracked-object read, motion activity, storage usage, `latest.jpg`, recordings coverage (297 segments in an hour, ratio 0.93, policy motion, partial), the VOD playlist (**no `EXT-X-PROGRAM-DATE-TIME`**, the first segment starts at the first recorded segment's start, rewrite OK) and one 2.3 MB segment. A 25-second passive WebSocket listen through the adapter (TLS trust, session cookie, nothing sent) connected and delivered 19 frames (`<cam>/status/detect`, `<cam>/motion`); no `reviews` / `events` frame occurred, so those payloads stay NOT VERIFIED. Not exercised live: a viewer role, clip export. The Frigate host clock read about 26 s behind this PC (Date header).
- `camera_links` and `frigate_review_state` are NOT in the Arx backup archive yet (the link has no behaviour; reviewed state is personal and cheap to lose); add them to `backup.PROJECT_TABLES` together with the restore tests when the link gets behaviour. `frigate_reviews` is re-pollable history and is not backed up (like `events`, it is an optional table).
- A Frigate camera that goes offline can be reported twice: by the debounced `offline` event of this loop and by the existing camera-offline notification that reads the CR-026 channel state. Not de-duplicated in F1.
- Not built: UI, restream creation, any control / config write, search, timeline overlay, notifications beyond the existing rules path, the camera-link UI and merge logic.

## 8. Open decisions for the owner

1. Permission names: F1 reuses `events.read`, `video.live`, `video.playback`; the study proposed `analytics.read` / `analytics.review`. Add them (RBAC change) or keep the existing ones?
2. Marking reviewed currently needs only `events.read` (it is personal state). Keep?
3. Retention of stored review rows and their mirrored events: follows the events retention today; a separate setting?
4. Port 5000 (no auth) support: not offered. Keep it out?
5. Allow one `clip.mp4` GET test and one viewer-account validation on the live instance to close the NOT VERIFIED items.

## 9. Rollback

Run the previous version: migration 0064 is additive and ignored by it; the vendor stays "coming soon"; set the recorder's vendor back (or remove the recorder) to stop all Frigate traffic. Frigate itself is never changed, so there is nothing to roll back there.

## 10. F2 - control and actions (branch pilot/NN5-F2, migration 0066)

Owner decisions 2026-10-06 applied: one Frigate account with admin rights is allowed, but every READ path stays read-only (`GET_ALLOWED` is unchanged; the writes have their own allow-list `frigate_http.WRITE_ALLOWED`, one entry set per write class); writes only through explicit permission classes; "reviewed" is kept in Arx per user AND mirrored to Frigate; PTZ is not released now, the plumbing is built behind a flag.

**Model of a write** (`services/frigate_control_svc.py`): permission on the camera (or installation for a recorder-wide class) -> the class is switched on for that recorder (`frigate_write_policy`, default OFF for every class, switched by `system.configure`) -> a per-action confirmation for the classes `record`, `profile`, `ptz` -> read the state, ONE write, read it back -> a row in `frigate_changes` (before, after, state hash, inverse) and an audit row. Nothing is retried or queued; a lost answer is `frigate_write_unknown`, never repeated. Undo (`POST /frigate/{rid}/changes/{id}/revert`) re-checks that Frigate is still in the state the change left (409 `frigate_change_stale` otherwise) and applies the same class gates.

| Class | Permission | What | Per-action confirm |
|---|---|---|---|
| `analytics` | `analytics.control` | detect, motion, audio, review alerts / detections, notifications, improve contrast, birdseye, PTZ autotracker - ONE camera, never `*` | no |
| `record` | `analytics.record_control` | camera enabled, recordings, snapshots (footage is not kept while off) | yes |
| `profile` | `analytics.profile` | the active profile (the only `*` call) + the alarm-state -> profile MAPPING (system.configure; a mapping, nothing is switched by it) | yes |
| `review` | `analytics.review` | mirror of "reviewed" to Frigate (an un-mark reaches Frigate only when no other Arx user still holds it) | no |
| `events` | `analytics.events` | retain flag, sub-label correction (no delete) | no |
| `ptz` | `camera.ptz` (existing, held by no built-in role) | one step / zoom / stop / saved position over `/ws`, a 30 s lease per camera, no patrol | yes |

`analytics.review` is held by operator and above; the other four new permissions are sensitive and held by site_admin and system_admin. PTZ is additionally behind the code flag `frigate_control_svc.PTZ_RELEASED = False`: the class cannot be switched on (409 `frigate_ptz_not_released`) and a step answers 409 `frigate_ptz_disabled` before anything else happens.

**Never offered:** `/api/config/set`, `/api/config/save`, restart, deletes of events / reviews / recordings (export and case deletes exist only for objects Arx created, section 11), users, faces and plates, go2rtc stream edits, an "all cameras" switch.

**UI:** operator camera drawer on the live camera page (only for a Frigate camera and only when the caller may change something now; no hints); Settings > the Frigate recorder: write classes, alarm mapping, change log with undo. The connection summary no longer says "read only" once a class is on.

**NOT VERIFIED:** every wire shape of a write (`PUT /api/camera/{cam}/set/{feature}` with `{"value": "ON"|"OFF"}`, `PUT /api/camera/*/set/profile`, `POST /api/reviews/viewed`, `DELETE /api/review/{id}/viewed`, `POST|DELETE /api/events/{id}/retain`, `POST /api/events/{id}/sub_label` with `{"subLabel": ...}`, the PTZ message `{"topic": "<cam>/ptz", "payload": ...}`) and whether the effective `/api/config` reflects a runtime toggle (if not, the change is logged `unverified`, not failed). Tests use only the in-process fake. The first supervised write of each class on the owner's instance is still to do.
**Not built:** automatic switching of a profile on an alarm change (the mapping and `profile-suggestion` exist; applying is a confirmed `PUT .../profile`), Frigate-native exports / cases, manual event create / end, a PTZ pad (no UI while PTZ is unreleased).
**Gap closure after 2.2.0 (branch pilot/gaps-220, no migration):** (a) the review detail now carries the retain flag and the sub-label per tracked object (`frigate-event-control` rows, one per detection id, at most 6 rows; operator screen rules: no hints, no badges, one short status line). The rows are drawn only when `GET /frigate/{rid}/events/{id}/control` answers `writable: true` (`analytics.events` on the event's camera AND the `events` class on; otherwise the answer carries no Frigate state and no Frigate call is made) and the screen asks only for a caller who holds `analytics.events` somewhere. The write routes are unchanged. Not verified against a real Frigate (fake only). (b) `frigate_write_policy`, `frigate_changes`, `frigate_profile_rules` and `frigate_review_state` (with `mirrored_at` / `mirror_error`) are now `backup.PROJECT_TABLES` (`backup.FRIGATE_TABLES`). A restore only brings back Arx's own records and never touches Frigate. An archive written before them keeps the current change log and reviewed state (`KEEP_WHEN_ABSENT`) but empties the write-class policy, so every class is OFF afterwards (fail closed). Restoring an archive that has the policy restores the classes exactly as they were. `frigate_reviews`, `frigate_sync_state` (re-polled) and `camera_links` (no behaviour yet) stay out.
**Rollback:** run the previous version (0066 is additive); with every class off (the default) nothing is ever written to Frigate.

## 11. F2b - the F2 leftovers, server side (branch pilot/NN5-F2b, migration 0068)

Server only: clean APIs for the later operator screens, no UI. Every new write class is OFF by default, every new write call has an UNVERIFIED wire shape, and all of it is tested only against the in-process fake Frigate (`backend/tests/fixtures/fake_frigate.py`, extended with exports, cases and manual events). Nothing was run against the owner's Frigate or any device.

**Read allow-list untouched.** `GET_ALLOWED` has no new entry. The two read-backs (`GET /api/exports`, `GET /api/cases`) are on `CONTROL_GET_ALLOWED`, reachable only with `control=True`, which the control adapter alone passes; the new writes are in `WRITE_ALLOWED` under their own classes. A test asserts that every new path (read and write) is refused by `FrigateHttp.get` and that cross-class use is refused locally (`frigate_path_not_allowed`).

**First supervised write flag.** The task text referred to an existing flag; none existed in code, so it is now `frigate_first_write` (migration 0068). The first write of each new kind toward a recorder (`export_create`, `export_rename`, `export_delete`, `case_create`, `case_rename`, `case_delete`, `event_create`, `event_end`, `profile_auto`) is refused with 409 `frigate_first_write_unsupervised` unless the request carries `supervised: true` from a holder of `system.configure`; the row is stored only after Frigate accepted that write (a failed first write does not count). `GET /frigate/{rid}/control/first-writes` shows which kinds are done. An undo counts as a write of its inverse kind. The existing F2 classes are not retro-gated.

### 11.1 Automatic profile on an alarm-state change

Per recorder `frigate_profile_auto_setting`: `mode` = `off` (default) | `suggest` | `apply`, and a separate `auto_apply_consent` flag (who and when stored). `PUT /frigate/{rid}/profile-auto/setting` (system.configure): `apply` without the consent is 422 `frigate_auto_consent_required`; withdrawing the consent drops `apply` to `suggest`; `off` dismisses everything open.

Flow: `ha_sync.handle_state_event` calls `frigate_auto_profile.note_alarm_change` (own savepoint, database only) for an `alarm_control_panel.*` state change into a known alarm state. For each recorder whose mode is not `off`, older open rows are superseded and, when `frigate_profile_rules` maps the new state, one `pending` row is queued in `frigate_profile_auto`. The recorder's own event loop (`frigate_events.run_loop`, every 2 s) processes its pending rows (`frigate_auto_profile.tick`): `suggest` -> status `suggested`; `apply` -> the switch is made only when the `profile` class is on, the consent is given AND the supervised first write of kind `profile_auto` exists, else the row stays `suggested` with the reason (`class_off`, `no_consent`, `first_write_unsupervised`) and a denied audit row. The switch uses the same `apply_profile` as the manual path (read, ONE write, read back, `frigate_changes` row with the alarm change in `before.auto`, actor `arx-auto`, audit row), so it is undone with the existing `POST .../changes/{id}/revert`. A failed or unanswered write is final for its row (`failed`, never retried); a row older than 10 minutes becomes `expired`; an already-active profile is `skipped`; a profile mapped to `none` switches the profile off.

API: `GET /frigate/{rid}/profile-auto` (setting, recent rows, modes), `PUT .../profile-auto/setting`, `POST .../profile-auto/{id}/apply` (`confirm: true`; with `supervised: true` from a system administrator it is also the supervised first write that unlocks `apply` mode), `POST .../profile-auto/{id}/dismiss`.

### 11.2 Frigate-native exports and cases (classes `exports`, `cases`)

Permissions `analytics.exports` and `analytics.cases` (sensitive; site_admin and system_admin, added to `roles.json` and the role-catalog contract); exports also need `video.export` on the camera. Both classes are off by default (`PUT /control/policy`). A per-action confirmation is asked only where something is destroyed: `delete` and an undo that deletes (`confirm_actions` in the policy view).

| Route | Wire call (UNVERIFIED) |
|---|---|
| `GET /frigate/{rid}/exports`, `GET .../cases` | `GET /api/exports`, `GET /api/cases` (fixed small rows; Frigate file paths and thumbnails are dropped; exports filtered to the cameras the caller may export) |
| `POST .../exports` `{camera_id, start, end, name}` | `POST /api/export/{cam}/start/{s}/end/{e}` body `{"name","playback":"realtime"}`; ONE camera, at most 2 h, not in the future; id from `export_id` or found by name |
| `PATCH .../exports/{id}` / `POST .../exports/{id}/delete` | `PATCH /api/export/{id}/rename` `{"name"}` / `DELETE /api/export/{id}` |
| `POST .../cases` `{name, description}` | `POST /api/cases`; id from the answer or found by name |
| `PATCH .../cases/{id}` / `POST .../cases/{id}/delete` | `PATCH /api/cases/{id}` `{"name"}` / `DELETE /api/cases/{id}` |

Ownership rule: rename and delete work only on exports and cases Arx created itself (`frigate_native_objects`); anything else is 409 `frigate_object_not_arx`, so the export and case entries on the write allow-list are not a general delete and Frigate's own exports and cases are never touched. Each write is read back (list), logged in `frigate_changes` (`export_*` / `case_*`) and audited. Undo: a create is undone by deleting it (confirm), a rename by renaming back; both check that the state is still what the change left (409 `frigate_change_stale`).

### 11.3 Manual events (class `events`, permission `analytics.events`)

`POST /frigate/{rid}/cameras/{camera_id}/events/manual` `{label, duration_s (1..600, or null = stays open), sub_label}` -> `POST /api/events/{cam}/{label}/create` body `{"sub_label","duration","include_recording":true,"score":0,"draw":{}}`, id from `event_id`, read back through `GET /api/events/{id}`. `POST /frigate/{rid}/events/{id}/end` -> `PUT /api/events/{id}/end` body `{"end_time": <epoch>}`; only events Arx created (their `event_create` change rows) can be ended, others are 409 `frigate_object_not_arx`. The undo of a create ends the event. The camera must be enabled and in the caller's scope.

### 11.4 Clip read (read side, GET only)

`GET /frigate/{rid}/cameras/{camera_id}/clip.mp4?start&end` (a window of at most one hour) and `GET /frigate/{rid}/events/{event_id}/clip.mp4` (an event of a review item the caller can see). Permission `video.playback` on the camera. Wire calls (UNVERIFIED, nothing was ever read from a real instance): `GET /api/{camera}/start/{s}/end/{e}/clip.mp4` and `GET /api/events/{id}/clip.mp4`.

They are NOT on `GET_ALLOWED` and not on `CONTROL_GET_ALLOWED`: a separate `CLIP_ALLOWED` list reachable only through `FrigateHttp.open_clip`, which only these two routes call. The answer is streamed through Arx (cap 400 MB, 30 s per network read, 300 s total, at most 6 clip or segment reads in flight per recorder, 429 otherwise); a declared length over the cap is refused before the first byte; only `video/*` or octet-stream is passed on (anything else is `source_invalid`); response headers carry no Frigate address, key or path. Frigate errors map like every other read (404, `source_unavailable`).

First supervised read: the same flag as 11 (`frigate_first_write`, kind `clip_read`). Until a `system.configure` holder has passed `supervised=true` once, both routes answer 409 `frigate_first_write_unsupervised` and nothing is requested from Frigate; the flag is stored once Frigate accepted that first read. Each served clip writes an audit row (`frigate.clip.read`). Only GET is ever sent (tests assert the fake saw nothing but the login besides the clip GET).

**NOT VERIFIED (F2b):** every wire shape in 11.2, 11.3 and 11.4 and the id fields in the answers (`export_id`, `id`, `event_id`); whether Frigate export ids match `[A-Za-z0-9_.-]{1,80}`; whether `GET /api/events/{id}` shows a manual event's `end_time`. Each shape sits in one place in `services/recorders/frigate_control.py`. The first supervised write of each kind on the owner's instance is still to do.
**Not built (F2b):** all operator screens (a design agent builds them), assigning an export to a case, a PTZ pad, backup of the new tables. The `triggered` alarm state can be mapped to a profile like any other, but no real-hardware trial exists.
**Rollback:** run the previous version (0068 only adds tables and rebuilds `frigate_write_policy` with the same rows and two more allowed class names); with every class off and the auto mode `off` (the defaults) nothing is written to Frigate.
