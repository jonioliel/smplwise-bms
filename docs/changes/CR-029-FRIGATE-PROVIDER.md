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
- The catalogue (`GET /nvr/vendors`) keeps Frigate "coming soon" (`planned`, not selectable) until the environment variable `SW_FRIGATE=1` is set (CR-022 D1: after the live validation checklist passes). A recorder that already has vendor `frigate` is served either way.
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
- Not built: UI, restream creation, any control / config write, search, timeline overlay, notifications beyond the existing rules path, the camera-link UI and merge logic.

## 8. Open decisions for the owner

1. Permission names: F1 reuses `events.read`, `video.live`, `video.playback`; the study proposed `analytics.read` / `analytics.review`. Add them (RBAC change) or keep the existing ones?
2. Marking reviewed currently needs only `events.read` (it is personal state). Keep?
3. Retention of stored review rows and their mirrored events: follows the events retention today; a separate setting?
4. Port 5000 (no auth) support: not offered. Keep it out?
5. Allow one `clip.mp4` GET test and one viewer-account validation on the live instance to close the NOT VERIFIED items.

## 9. Rollback

Run the previous version: migration 0064 is additive and ignored by it; the vendor stays "coming soon"; set the recorder's vendor back (or remove the recorder) to stop all Frigate traffic. Frigate itself is never changed, so there is nothing to roll back there.
