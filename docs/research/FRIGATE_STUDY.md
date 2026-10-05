# Frigate study (NN5): a Frigate provider for Arx

**Status:** research and proposal, 2026-10-05. Branch `pilot/NN5-frigate-study`. No product code was written or changed.
**Frigate version studied:** 0.18.0 (docs at tag `v0.18.0`; one real instance, read-only).
**Owner request:** control and manage "as much as possible" of Frigate from Arx, in 2-3 phases.
**Builds on:** `docs/architecture/NVR_VENDOR_ADAPTERS.md` (ADP), CR-022 (connection in Arx), CR-024 (multi-recorder),
CR-025 (Provision-ISR adapter, the template), CR-026 (recorder health), `docs/architecture/CAPABILITIES.md`.
AGENTS.md constraint that still stands: *No required Frigate*; continuous recording stays on the primary NVR. Frigate is
an additional, optional recorder/analytics provider.

## 1. Summary

1. **Frigate is not just another NVR; it is an analytics engine with an NVR attached.** The valuable part is not the
   recording, it is the **tracked-object / review-item model** (what happened, where, how important), plus search over it.
   Arx today has raw events and time-window grouping; it has no notion of "what is in the picture" beyond the device's
   own alarm types. A Frigate provider is the first source that gives Arx object-level facts (person / car / dog, zone,
   score, path, speed) and a second one (face, plate, classification) later.
2. **The integration surface is excellent.** `GET /api/openapi.json` is exposed (179 operations), JWT auth works with a plain
   `POST /api/login`, a broker-free `/ws` WebSocket mirrors the MQTT topics, recordings are exposed as 10-second segments
   with an HLS VOD endpoint, and the entire configuration has a JSON-Schema (`/api/config/schema.json`) and a hot-apply
   endpoint (`PUT /api/config/set`). Nearly everything the Frigate UI does is a documented HTTP call.
3. **Three phases.** F1 read-only provider (health, cameras, live, events/reviews, recordings coverage, HLS playback, clip
   export, thumbnails, search read); F2 runtime control (camera feature toggles, profiles tied to Arx modes, review/event
   actions, Frigate-side exports, PTZ steps) - every write class behind an owner approval; F3 configuration management
   (schema-driven settings, zones/masks editor over the live frame, retention, enrichments, camera add/clone/remove,
   libraries) - configuration writes behind per-class approvals and a rollback record.
4. **Effort (calibrated, section 9):** F1 about 15 active agent-hours, F2 about 10, F3a about 20 (F3b optional, 2-13);
   about 45 hours for F1-F3a, an assumed 25-36 % of one week's Sonnet quota spread over several weeks, plus Fable design passes
   for four screens only.
5. **Biggest risks:** (a) what the live instance cannot teach us (face / LPR / audio / PTZ / GenAI are off there), (b) the
   instance's own go2rtc has no streams, so "live from Frigate" needs a source decision per site (section 7.5),
   (c) Frigate's `PUT /api/config/set` writes the live config of a production system - the only dangerous call family.
6. **Fifteen decisions for the owner** are in section 11 (also in Hebrew in the summary file).

## 2. Method and sources

| Source | How |
|---|---|
| Official docs | All 81 markdown pages of `docs/docs/` at tag `v0.18.0` (configuration, usage, integrations, plus, troubleshooting, frigate) were read in full or skimmed by section; the HTTP API reference is generated from OpenAPI, so the live `openapi.json` of the studied instance was used as the authoritative API list. |
| Live instance | One `POST /api/login`, then `GET` only (about 60 distinct read endpoints), plus a passive 30 s and a 13 min listen on `/ws`. The web UI was visited with the session cookie injected into a headless browser (no credentials typed into any form). No write, no restart, no export, no toggle, no MQTT connection, no notification subscription. |
| Arx today | Code survey of `smplwise_vms/backend/smplwise/services/recorders/*`, `events_ingest.py`, routers, migrations 0003/0010/0055/0059, CR-020..CR-026, CAPABILITIES. |
| Not available | Real face/LPR/audio/PTZ/GenAI behaviour (features off on the instance), MQTT (broker not touched), write behaviour of any endpoint. These are marked **NOT VERIFIED** where they matter. |

Private captures (config with credentials masked, stats, event/review samples, screenshots with real people in them) are in
`private-evidence/frigate-*/` (gitignored). **Nothing from them is in this document beyond shapes and counts.**

## 3. The live instance (read-only study, 2026-10-05)

Method: one `POST /api/login` (JWT cookie `frigate_token`, kept in a gitignored jar), then `GET` only; the web UI was
visited with that cookie injected into a headless browser context (no credentials typed anywhere). Nothing was
written, restarted, exported or toggled. Raw captures are under `private-evidence/frigate-*/` (gitignored);
nothing from them is quoted here beyond shapes and counts.

### 3.1 What is running

| Item | Observed |
|---|---|
| Version | `0.18.0-77a66e7` (`GET /api/version` returns plain text; `/api/stats.service.latest_version` = `0.18.0`) |
| Cameras | 7 (`enabled: true` all), `type: generic`; detect 1920x1080 / 2560x1440 / one 5120x1440 at 5 fps; one camera group `home` |
| Inputs | six cameras are fed from an **external go2rtc** restream over `rtsp://<host>:8554/<name>` (record + detect on the same input); one reads a camera's sub stream directly. Frigate's own `go2rtc:` config is empty and `GET /api/go2rtc/streams` returns `{}` (it only restreams what it is configured to restream). |
| Detectors | `coral1`, `coral2` (`edgetpu`, `usb:0`/`usb:1`, 320x320 SSD), measured 8-9 ms per inference |
| Tracked objects | `person` globally; per camera `person` (+`dog`, `motorcycle` on two cameras); 16 attribute/logo labels declared in `model.attributes_map` (delivery brands, `face`, `license_plate`) - only relevant once a model supplies them |
| Recording | `record.enabled`, **continuous 0 days**, motion 10 days, alerts and detections retained 30 days (`mode: motion`), pre 10 s / post 15 s; export `max_concurrent: 3`, VAAPI. Recording segments are 10-second files |
| Snapshots | off (`snapshots.enabled: false`); `has_snapshot: false` on all events |
| Review | alerts on `person`, `car`; `cutoff_time` 40 s (alerts) / 30 s (detections); no required zones; GenAI review summaries off |
| Zones | none defined; masks: motion masks on 6 of 7 cameras, object masks on 4 |
| Semantic search | **on**: `jinav1`, size `large` (`model_state` over WS: CLIP text + vision ONNX "downloaded"); ~20 k tracked objects indexed |
| Off | face recognition, LPR, audio detection, audio transcription, birdseye, notifications (web push), GenAI (no provider, `GET /api/genai/models` = `{}`), custom classification (`[]`), bird classification, profiles (`[]`), autotracking (ONVIF present on every camera, autotracking disabled) |
| Auth | enabled, a single local user with role `admin`; `profile` returns `allowed_cameras` |
| MQTT | enabled, prefix `frigate`, stats interval 60 s (broker not contacted by this study) |
| Storage | recordings volume ~1.9 TB total / 0.69 TB used (unRAID `fuse.shfs`); `/api/recordings/storage` returns per-camera `usage` (MB), `bandwidth` (MB/h) and `usage_percent` |
| Health notes | one camera's detect pipe is `offline` (FFmpeg "connection timed out" in the logs); the UI also flagged high FFmpeg CPU on another - evidence that `status/detect` and `connection_quality` carry real health signal |
| Time | all timestamps are Unix epoch seconds (float); recordings summary by local day |

### 3.2 Read endpoints that answered (and their shape)

| Endpoint | Status | Shape / use |
|---|---|---|
| `GET /api/version` | 200 | plain text |
| `GET /api/config` | 200 | the effective, merged config (69 KB): global sections + `cameras.<name>` with every feature block repeated per camera, `enabled_in_config`, `ffmpeg_cmds`. **Contains stream URLs with credentials and the MQTT password is masked (`__FRIGATE_SAVED_CREDENTIAL__`)** - an adapter must scrub the camera `ffmpeg.inputs[].path` before logging or returning |
| `GET /api/config/schema.json` | 200 | JSON-Schema of the whole config (106 KB) - usable to render and validate settings forms generically |
| `GET /api/config/raw_paths` | 200 | raw (unmerged) input paths - credentials again |
| `GET /api/stats` | 200 | `cameras.<n>` {camera_fps, process_fps, skipped_fps, detection_fps, detection_enabled, connection_quality, expected_fps, reconnects_last_hour, stalls_last_hour, ffmpeg/capture/detect cpu, audio_rms/dBFS, pids}, `detectors`, `gpu_usages`, `cpu_usages`, `embeddings`, `service` {uptime, version, latest_version, storage per mount, last_updated}, `processes` |
| `GET /api/stats/history` | 200 | time series of the stats snapshot (1.1 MB with no filter - always pass `keys=`) |
| `GET /api/events` | 200 | tracked objects: `id` = `<start_epoch>-<6 chars>`, camera, label, `sub_label`, zones, start/end, `has_clip`, `has_snapshot`, `top_score`, `plus_id`, `retain_indefinitely`, `data` {box, region, score, top_score, attributes, `average_estimated_speed`, `velocity_angle`, `path_data` [[x,y],t], `type`, `max_severity`} - all geometry normalised 0..1 |
| `GET /api/events/search` | 200 | semantic / similarity / text search over tracked objects, adds `search_distance`, `search_source` |
| `GET /api/events/explore`, `/events/summary` | 200 | latest object per label/camera; summary is **14 MB** unfiltered - never call it without a window |
| `GET /api/review` (+ `/summary`, `/activity/motion`, `/review_ids`, `/review/{id}`) | 200 | review item = `id`, camera, start/end, **`severity` alert\|detection**, `thumb_path`, `has_been_reviewed`, `data` {detections[] (event ids), objects[], verified_objects[], sub_labels[], zones[], audio[], thumb_time, metadata (GenAI)}. Summary = per-day totals and reviewed counts (`last24Hours` + one row per day) |
| `GET /api/timeline`, `/timeline/hourly` | 200 | tracked-object lifecycle entries: `class_type` (`visible`, `entered_zone`, `attribute`, `stationary`, `active`, `gone` ...), box, label, source/source_id |
| `GET /api/<cam>/recordings?after&before` | 200 | 10-second segments: `id`, start/end, `segment_size` (MB), `motion`, `objects`, `motion_heatmap`, `duration` |
| `GET /api/<cam>/recordings/summary`, `/recordings/summary`, `/recordings/storage` | 200 | per-day/hour counts of events, motion, objects, duration; per-camera storage usage |
| `GET /vod/<cam>/start/<s>/end/<e>/index.m3u8` | 200 | **real HLS VOD playlist** (fMP4: `init-v1.mp4` + `seg-N-v1.m4s`, ~10 s segments) built on demand from the segment index - the seekable, anchor-able playback source |
| `GET /api/<cam>/latest.jpg` | 200 | current frame (JPEG); `?h=` resizes |
| `GET /api/exports`, `/cases`, `/jobs/export` | 200 | 5 existing exports (`id`, camera, name, date, `in_progress`, `export_case`), no cases, no active jobs |
| `GET /api/profiles`, `/profile/active`, `/profile` | 200 | camera profiles (none), active profile (null), current user + `allowed_cameras` |
| `GET /api/users`, `/auth/first_time_login` | 200 | user list |
| `GET /api/labels`, `/sub_labels`, `/audio_labels` | 200 | label vocabularies (`audio_labels` = 500+ AudioSet classes) |
| `GET /api/ffmpeg/presets`, `/vainfo`, `/nvinfo`, `/genai/models` | 200 | hardware and preset catalogues |
| `GET /api/chat/tools` | 200 | **eight LLM tools**: `search_objects`, `find_similar_objects`, `set_camera_state`, `get_live_context`, `start_camera_watch`, `stop_camera_watch`, `get_profile_status`, `get_recap` (the 0.18 "Chat" page; needs a configured GenAI provider) |
| `GET /api/media/sync/current`, `/debug_replay/status`, `/vlm/monitor` | 200 | job states (none active) |
| `GET /api/<cam>/ptz/info` | 200 `{}` | no PTZ configured/available on the sampled camera |
| `GET /api/ffprobe?paths=` | 200 | takes a **path/URL, not a camera name** (a camera name returns `return_code 1`) |
| `GET /api/openapi.json` | 200 | **exposed**, FastAPI, 179 operations (Appendix A) - the machine-readable contract for the adapter |
| `GET /api/recordings/unavailable` | 500 | server error on this build without parameters - avoid |
| `GET /api/storage`, `/api/triggers/status/<cam>` | 404 | no such route / trigger not configured |
| `GET /api/notifications/pubkey` | 400 | web-push is not configured (matches `notifications.enabled: false`) |

### 3.3 The WebSocket (`/ws`) is the broker-free live feed

Connecting to `wss://<host>/ws` with the session cookie delivers JSON frames `{topic, payload}` that mirror the MQTT
topics (no broker needed): `<cam>/status/detect` (`online`/`offline`), `<cam>/motion` (`ON`/`OFF`), `camera_activity`
(per camera: motion, tracked objects, **and the live feature switches** `detect/enabled/snapshots/record/audio/...`),
`model_state`, `embeddings_reindex_progress`, `birdseye_layout`, `audio_detections`, `profile/state`, `job_state`;
`events`, `reviews`, `tracked_object_update` appear when detections happen. A passive 13-minute listen (night time, no
detection occurred) saw: `stats` every 60 s (full `/api/stats` payload), `camera_activity` once on connect, per-camera
`status/detect` **607 frames** (one camera's detect pipe flapped online/offline, which confirms Frigate's own advice to
debounce it), `<cam>/motion` 53 frames, per-label count topics (`<cam>/person`, `/active`, `all`) once on connect, and
`profile/state`, `job_state`, `model_state`, `embeddings_reindex_progress`, `birdseye_layout`, `audio_detections`. **No
`events` / `reviews` frames were seen**, so their `/ws` payloads remain NOT VERIFIED (documented MQTT shape in Appendix B).
The same channel accepts the control topics (`<cam>/detect/set`, ...) - the UI's switches use it. This study only listened.

### 3.4 The web UI, route by route (what to learn from it)

Routes in the bundle: `/` (live dashboard with camera groups), `/review` (alerts / detections / motion segments tabs,
severity counters, reviewed filter, 24 h / date filter, per-camera filter, a **time-ruler with red alert marks**),
`/explore` (grid of tracked objects by label, filters for camera / label / sub-label / zone / date / score / speed,
text + image search), `/export` (exports list with cases), `/faces` (face library: recent recognitions, train, upload),
`/classification` (object and state models), `/chat`, `/playground` (tracked-object path visualiser), `/replay`
(debug replay of a past period through the detector), `/logs` (frigate / go2rtc / nginx), `/system` (general, enrichments,
storage, cameras tabs), `/config` (Monaco YAML editor: save only / save and restart), `/settings` with pages: UI
settings, global configuration (per section), per-camera configuration (object detection, objects, motion detection,
motion tuner, streams, recording, snapshots, **masks / zones**, review, audio, transcription, birdseye, live playback,
notifications, face, LPR, ONVIF, MQTT, timestamp), enrichments, camera management (add, delete, clone settings, per
camera **On / Off / Disabled** state + drag-to-reorder), profiles, users (roles), notifications, Frigate+, maintenance.
The masks/zones editor draws polygons over the live frame with a list per mask kind and a "+" per kind.
Design observations are in Appendix C.

## 4. Feature inventory with API mapping

Legend: **R** = read (GET), **W** = write. All paths are under `/api` unless they start with `/vod`, `/live` or `/ws`.
Frigate's runtime-toggle writes map one-to-one to MQTT `.../set` topics. "On live" = the studied instance.

### 4.1 Cameras, streams, groups

| Feature | What Frigate does | Config keys | API / transport | On live |
|---|---|---|---|---|
| Camera inventory | One config block per camera; `type` generic or `lpr`; ffmpeg inputs with roles detect / record / audio | `cameras.<n>.{enabled,type,ffmpeg.inputs[],detect,ui}` | R `/config`, `/stats` | 7 cameras |
| Three-level camera state | **On** (runtime, persisted in `.runtime_state.json`), **Off** (pauses processing, history stays visible), **Disabled** (`enabled:false` in config, hidden, restart to re-enable) | `cameras.<n>.enabled` | W `PUT /camera/{cam}/set/enabled` (`ON`/`OFF`; `*` = all cameras); Disabled = `PUT /config/set` | all On |
| Camera health | `status/{detect,record,audio}` online/offline/disabled; per camera fps, `connection_quality`, `reconnects_last_hour`, `stalls_last_hour`, ffmpeg/capture/detect CPU, `audio_rms` | `/stats` fields | R `/stats` (poll); `/ws` and MQTT `<cam>/status/<role>` | one camera's detect pipe offline |
| Camera add wizard | Probe ONVIF or manual brand templates, per-stream test, role assignment, validation checklist, "reduce connections" via go2rtc, save without restart | camera block + `go2rtc.streams` | R `/onvif/probe`, `/ffprobe`, `/ffprobe/snapshot`, `/reolink/detect`; W `PUT /config/set`, `PUT /go2rtc/streams/{name}` | - |
| Camera delete | Admin only, irreversible: config + all DB rows + all media; exports kept unless `delete_exports=true`; config restored if unparsable | - | W `DELETE /cameras/{cam}` | - |
| Camera groups | Named sets with icon and order; layout and per-group streaming preferences live **in the browser** | `camera_groups.<g>.{cameras,icon,order}` | R `/config` | one group |
| Live players | Ladder MSE, WebRTC, jsmpeg; smart streaming (still image per minute while idle, live on activity); per-device stream choice | `live.{height,quality}`, `cameras.<n>.live.streams` | go2rtc proxied by Frigate: `/live/mse/api/ws`, `/live/webrtc/api/ws`, `/live/jsmpeg/<cam>`; R `GET /<cam>` (MJPEG), `/<cam>/latest.jpg` | no go2rtc streams; UI falls back to jsmpeg |
| Restream | `rtsp://<frigate>:8554/<name>`: one camera connection shared by detect, record and external consumers | `go2rtc.streams`, `go2rtc.rtsp.{username,password}` | R `/go2rtc/streams[/{name}]` (negotiated codecs); W `PUT/DELETE /go2rtc/streams/{name}` | `{}` |
| Birdseye | Auto composite (modes continuous / motion / objects, `max_cameras`, order, restream `rtsp://.../birdseye`) | `birdseye.*` | W set `birdseye`, `birdseye_mode`; `/ws birdseye_layout` | off |
| PTZ / ONVIF | Pan/tilt/zoom/focus, presets, click-to-move; autotracking (zones, return preset, calibration) | `cameras.<n>.onvif.*` | R `/<cam>/ptz/info`; control via `/ws` or MQTT topic `<cam>/ptz` (`preset_<n>`, `MOVE_*`, `ZOOM_*`, `STOP`); W set `ptz_autotracker` | ONVIF configured on all, autotracking off |
| Two-way talk | WebRTC backchannel; needs HTTPS and a dedicated stream without `#` parameters | go2rtc stream | UI only | - |
| Profiles | Named runtime overlays (Home / Away / Night), one active, no restart, clears runtime toggles on switch; scheduling deliberately external | `profiles.<p>`, `cameras.<n>.profiles.<p>.<section>` | R `/profiles`, `/profile/active`; W `PUT /camera/*/set/profile` (name or `none`); `/ws profile/state` | none defined |

### 4.2 Detection, objects, zones, masks, motion

| Feature | What Frigate does | Keys | API | On live |
|---|---|---|---|---|
| Object tracking | Detector on motion regions, tracker with ids, stationary handling; labels per camera | `objects.track`, `detect.{fps,width,height,stationary.*}`, `model.*` | R `/labels`, `/events`, `/timeline` | `person` (+`dog`, `motorcycle` on two cameras); 2 Coral detectors |
| Object filters | `min_area`, `max_area`, `min_ratio`, `max_ratio`, `min_score`, `threshold` per label; **median-of-history confirmation**; UI shows score / computed score / top score | `objects.filters.<label>.*` | W `config/set` | defaults |
| Zones | Normalised polygon tested at the **bottom centre of the box**; `objects`, `loitering_time`, `inertia`, `distances` + `speed_threshold` (4-point ground plane), `enabled`; a zone name shared across cameras is one logical zone | `cameras.<n>.zones.<z>.*` | R `/config`; W set `zone` (sub_command = name) | none defined |
| Masks | Motion mask (ignored for the motion trigger, hides nothing) vs object mask (drops detections whose bottom centre is inside) vs global / per-label; named, `enabled` toggle | `motion.mask.*`, `objects.mask.*`, `objects.filters.<l>.mask.*` | W set `motion_mask`, `object_mask` | 6 motion / 4 object masks |
| Motion tuning | `threshold`, `contour_area`, `lightning_threshold`, `skip_motion_threshold`, `improve_contrast`; live Motion Tuner | `motion.*` | W set `motion_threshold`, `motion_contour_area`, `improve_contrast`, `motion` | defaults |
| Attributes / sub labels | One label, one sub label (identity), many attributes (face, plate, brand logo, custom classifier) | `model.attributes_map` | W `POST /events/{id}/sub_label`, `/attributes` | none set |
| Debug view / replay | Overlays (boxes, regions, zones, motion); **Debug Replay** re-runs a recorded range through the pipeline | - | W `POST /debug_replay/start`, R `/debug_replay/status`, W `/debug_replay/stop` | idle |

### 4.3 Events, reviews, search, timeline

| Feature | What Frigate does | API | On live |
|---|---|---|---|
| Tracked object ("event") | Lifecycle new / update / end; id `<epoch>-<6 chars>`; box, region, score, top_score, zones, `path_data`, speed, attributes, `has_clip`, `has_snapshot`, `retain_indefinitely` | R `/events`, `/events/{id}`, `/event_ids`, `/events/summary`; `/ws` and MQTT `events` (`{type,before,after}`), `tracked_object_update` (late enrichment: description, face, lpr, classification) | about 20 k objects |
| Review item | Per camera, non-overlapping span bundling every tracked object and audio active together; severity **alert** or **detection** from (label x zone) rules; per-user reviewed state; optional GenAI title / summary / threat level | R `/review`, `/review/{id}`, `/review_ids`, `/review/summary` (per-day totals), `/review/event/{id}`; W `POST /reviews/viewed`, `/reviews/delete`; `/ws` and MQTT `reviews` | 179 alerts / 24 h, 0 detections |
| Motion activity | Per-30 s motion curve per camera for the timeline | R `/review/activity/motion` | yes |
| Timeline | Lifecycle rows per object (`visible`, `entered_zone`, `attribute`, `stationary`, `active`, `gone`) for click-to-seek with a box overlay | R `/timeline`, `/timeline/hourly` | yes |
| Manual events | Create / end an event from outside (PIR, door contact), categorised like detector events | W `POST /events/{cam}/{label}/create`, `PUT /events/{id}/end` | - |
| Retention flag | Retain an event indefinitely | W `POST/DELETE /events/{id}/retain` | - |
| Search | Semantic (text to image), similarity ("find similar"), description search; filters for camera, label, sub label, attribute, zone, time range, score, speed, plate, has clip / snapshot, Frigate+ | R `/events/search?query=&search_type=thumbnail\|description\|similarity&...`, `/events/explore` | semantic ON (`jinav1`, large) |
| Triggers | Per camera: reference thumbnail or text + threshold -> notification / sub label / attribute (text-to-image triggers deliberately unsupported: CLIP scores are unstable) | W `POST/PUT/DELETE /trigger/embedding`; R `/triggers/status/{cam}`; `/ws` and MQTT `triggers` | none |
| Motion Search | ROI polygon over recorded footage, % change per hit; uses the stored per-segment motion heatmap to skip quiet segments; async job | W `POST /{cam}/search/motion`, R `/{cam}/search/motion/{job}`, W `.../cancel` | - |
| Reindex | Rebuild embeddings after a model switch | W `PUT /reindex` | - |

### 4.4 Recording, retention, snapshots, exports, storage

| Feature | What Frigate does | Keys | API | On live |
|---|---|---|---|---|
| Recording | Stream copy, 10 s segments, UTC paths; segments pass a RAM cache and are validated before landing on disk | `record.enabled` | R `/<cam>/recordings?after&before` (id, times, size, motion, objects, `motion_heatmap`), `/<cam>/recordings/summary`, `/recordings/summary` (per day), `/recordings/storage` (per camera MB, MB/h, %) | continuous 0 d, motion 10 d |
| Retention tiers | `continuous.days`, `motion.days`, alerts / detections `retain.{days,mode all\|motion\|active_objects}`, `pre_capture` / `post_capture` per severity | `record.*` | W set `recordings`; config | alerts + detections 30 d |
| Playback | `/vod/<cam>/start/<s>/end/<e>/index.m3u8` (fMP4 HLS VOD built on demand), per-hour variants, per event / review clips | - | R `/vod/...`, `/<cam>/start/<s>/end/<e>/clip.mp4`, `/review/{id}/clip.mp4`, `/events/{id}/clip.mp4`, `/preview/...` | playlist verified |
| Snapshots | Clean image stored once per object; annotations (box, timestamp, crop, height) applied on request | `snapshots.*` | R `/events/{id}/snapshot.jpg`, `snapshot-clean.webp`, `thumbnail.jpg`, `/<cam>/latest.jpg`, `/<cam>/recordings/{t}/snapshot.jpg` | disabled |
| Exports | Copy of a range that retention never removes; time-lapse args; **cases** group exports; zip download of a case | `record.export.*` | R `/exports`, `/exports/{id}`, `/cases`, `/jobs/export`; W `POST /export/{cam}/start/{s}/end/{e}`, `/export/custom/...`, `/exports/batch`, `PATCH /export/{id}/rename`, `POST /exports/delete`, `/exports/reassign`, cases CRUD | 5 exports, 0 cases |
| Storage | DB-derived usage per camera + MB/h; emergency cleanup when under about 1 h of space remains (ignores retention); media sync job (orphans; aborts above 50 % deletions) | - | R `/recordings/storage`, `/stats` (mounts); W `POST /media/sync`, R `/media/sync/current` | 1.9 TB / 0.7 TB used |
| Recording delete | By time range | - | W `DELETE /recordings/start/{s}/end/{e}` (**a forbidden class in Arx**) | - |

### 4.5 Enrichments (optional; mostly off on the instance)

| Feature | What | Needs | API | On live |
|---|---|---|---|---|
| Semantic search | Jina CLIP embeddings of thumbnails and descriptions | AVX2, 8 GB RAM | `/events/search`, `/reindex` | ON |
| Face recognition | Face on `person` objects, weighted multi-frame consensus, library (train, reclassify, reprocess); sets `sub_label` | AVX2; `small` = CPU | R `/faces`; W `/faces/{n}/create\|register\|delete\|rename`, `/faces/train/{n}/classify`, `/faces/recognize`, `/faces/reprocess` | off, library empty |
| LPR | Plate detector + OCR, known plates with wildcards / regex / edit distance, `replace_rules`, dedicated `type: lpr` camera | 4 GB RAM | R `/recognized_license_plates`; W `/events/{id}/recognized_license_plate`, `PUT /lpr/reprocess` | off |
| Custom classification | Object (sub label / attribute) and **state** classification (crop of a fixed region -> open / closed ...); trained in the UI; consensus rules | CPU | R `/classification/...`; W train, dataset CRUD, delete model | none |
| Bird classification | iNat model sets the sub label | CPU | config | off |
| Audio detection | 500+ AudioSet labels (bark, glass, siren, speech ...), RMS / dBFS | stream with audio | R `/audio_labels`; MQTT `<cam>/audio/*`; W set `audio` | off |
| Audio transcription | Live (sherpa-onnx) and per event (whisper) | - | W `PUT /audio/transcribe`; set `audio_transcription` | off |
| GenAI | Providers llama.cpp / Ollama / OpenAI-compatible / Gemini / Azure; roles `chat`, `descriptions`, `embeddings`; **object descriptions**; **review summaries** (title, scene, short summary, confidence, threat level 0-2); **review reports**; **Chat** with tool calling (8 tools); VLM camera "watch" jobs | provider | R `/genai/models`, `/chat/tools`, `/vlm/monitor`; W `POST /genai/probe`, `/chat/completion`, `/chat/execute`, `/vlm/monitor`, `/review/summarize/start/{s}/end/{e}`, `/description/generate` | off |
| Frigate+ | Hosted model fine-tuning from submitted frames | account + key | `/plus/models`, `/events/{id}/plus` | not used |

### 4.6 System, administration, integration surface

| Feature | What | API |
|---|---|---|
| Version / health | Version string, latest version, uptime | R `/version` (plain text), `/stats`, `/` |
| Stats | CPU / GPU / memory per process, detector inference ms, per-camera fps, embeddings speeds, storage mounts, shm | R `/stats`, `/stats/history?keys=` (always filter: unfiltered it is 1 MB), `/metrics` (Prometheus), `/vainfo`, `/nvinfo` |
| Logs | frigate / go2rtc / nginx | R `/logs/{service}` |
| Config | Effective config, raw config, schema, validate-and-save, partial hot-apply with `requires_restart` | R `/config`, `/config/raw`, `/config/schema.json`, `/config/raw_paths`; W `POST /config/save?save_option=`, `PUT /config/set` |
| Restart | Process exits and the container manager restarts it | W `POST /restart`; MQTT `restart` |
| Auth and users | Local users; roles `admin`, `viewer`, custom roles = camera lists; JWT cookie `frigate_token` (24 h, refresh at 30 min) or `Authorization: Bearer`; proxy-header auth; login rate limit | R `/profile`, `/users`, `/auth`; W `POST /login`, `POST /users`, `PUT /users/{u}/password\|role`, `DELETE /users/{u}`, `GET /logout` |
| Notifications | Web push (VAPID), alerts only, global + per-camera cooldown, suspend, per-user camera access, images in Chrome only | R `/notifications/pubkey`; W `POST /notifications/register`; MQTT `notifications/*` |
| MQTT | See Appendix B | broker settings in `mqtt.*` |
| Home Assistant | HACS integration (MQTT based): camera, image, sensor, switch, binary_sensor, media browser, notification proxy | not needed: Arx talks to Frigate directly |

## 5. What is smart and worth importing into Arx

Ranked by value to Arx's operators (an owner or installer running a home or small site). "Needs provider" says whether
the data comes from Frigate or the idea is useful on every recorder. "Arx today" is from the survey in section 6.

| # | Idea and why it is right | Source detail | Needs provider? | Arx today |
|---|---|---|---|---|
| 1 | **Review item as the unit of attention.** One card per camera per activity span, bundling every object, severity from (label x zone) rules, instead of one row per detection. It is the difference between 179 reviewable alerts a day and 20 000 events. | `/review`, `review.alerts.{labels,required_zones,cutoff_time}` | data from provider; model generic | `events/windows` groups by time gap; no severity rules |
| 2 | **Alert / detection tier plus a motion-only tier.** Alerts notify, detections only list, motion is for "what did the detector miss". | review config | model generic | severity info / alert / critical, no tier rules |
| 3 | **Per-user reviewed state**, bulk "mark shown as reviewed", multi-select with keyboard shortcuts, calendar with a recordings underline and an unreviewed-severity dot. | `/reviews/viewed` | generic | `events/ack-many` (acknowledge, not per-user review) |
| 4 | **Zones that mean something:** bottom-centre presence test, `loitering_time`, `inertia`, `required_zones` per output (alert, detection, snapshot), objects per zone. Link a Frigate zone to an Arx room/area on the plan. | zones doc | provider; the link is Arx | `spatial_zones` are plan rooms, not detection zones |
| 5 | **Mask semantics spelled out on the control:** motion mask = "do not let this wake the detector" (hides nothing); object mask = "ignore this fixed false positive"; zone + required zone = "alert only here". Frigate documents this because users get it wrong. | masks doc | provider | none |
| 6 | **Three-level camera state** (On runtime, Off paused with history visible, Disabled in config) with drag-to-reorder. | camera management | provider (W) | `cameras.enabled` only |
| 7 | **Profiles tied to a system mode.** One call switches many per-camera overrides (Away: front door notifications on, indoor camera on; Home: indoor camera off for privacy). Arx already has alarm arm / disarm and presence; "armed away" should select the profile. | profiles doc | provider (W) | alarm + presence (CR-027); no recorder-side mode |
| 8 | **Tracked-object lifecycle timeline** with click-to-seek and a bounding-box overlay on the recording, plus an `annotation_offset` to correct drift. | `/timeline` | provider | event thumbnails only |
| 9 | **Semantic and similarity search** and a `key:value` search grammar that becomes chips, saved searches. Arx's `/search/semantic` parses text over metadata and says so; Frigate searches the pictures. | `/events/search` | provider (R) | local text baseline, no vision |
| 10 | **Motion Search over recordings** (draw an ROI, find when something changed: package gone, gate open) using a stored per-segment motion heatmap to skip quiet segments. | `/{cam}/search/motion` | provider (job) | none |
| 11 | **State classification** ("is the gate open") trained from the camera itself, with 3-consecutive-state debouncing: a sensorless sensor. | classification doc | provider (W) | HA binary sensors only |
| 12 | **Smart streaming and player ladder:** idle tile = still refreshed per minute, live on activity, honest "low bandwidth" label with a Reset, stream choice per browser. This is Arx's live-budget problem solved at the client. | live doc | generic (UI) | live budget per recorder (CR-024 note) |
| 13 | **Storage honesty:** usage from the DB (no disk scan), MB/h per camera, "hours left", orphan-sync with a 50 % abort guard, an explicit emergency-cleanup warning. | `/recordings/storage` | provider (R) + generic | `routers/storage.py`, `nvr_capacity.py` |
| 14 | **Camera wizard with a validation checklist** (detect stream too large or small, record stream without AAC, restream used for record, brand hints) and a **delete dialog that enumerates what disappears**. | camera setup | generic | setup wizard (CR-022) |
| 15 | **Settings UX:** Modified / Overridden badges, per-section Reset to Global, Save All with a pending-changes diff, restart-required icon. Matches the CR-020 S2C batch UX. | settings UI | generic | batch apply for encodings |
| 16 | **Debug Replay and Motion Tuner:** tune rules on recorded footage instead of waiting for tomorrow. | debug replay | provider (W job) | none |
| 17 | **Face and plate libraries with temporal consensus** (weighted over frames; known-plate wildcards / regex / edit distance; `replace_rules`; dedicated LPR camera mode). Needs a privacy decision (section 11). | face / LPR docs | provider (W) | none |
| 18 | **Late-enrichment channel:** an event is announced at once and enriched later (face, plate, GenAI text, classification) without re-sending it; notifications update in place (tag = event id) when a better thumbnail arrives. | `tracked_object_update` | provider | notifications are send-once |
| 19 | **Notification hygiene:** global + per-camera cooldown, suspend with an expiry, only alerts notify, camera permission decides who is notified. | notifications doc | generic | CR-018 policies |
| 20 | **GenAI review summaries** with a fixed schema (title, scene, short summary, confidence, concerns, threat level 0/1/2) and an owner-written "normal activity" prompt; **chat** over search tools. Optional, cost and privacy gated. | genai docs | provider (W) | `ai.provider` setting, nothing bundled |
| 21 | **Audio events** (glass, siren, dog, yell) as an event source. | audio docs | provider | none |
| 22 | **Birdseye-style dynamic mosaic:** cameras appear only when active, `max_cameras` + cooldown, scaling. Arx can build it on its own wall with any recorder's activity signal. | birdseye | generic | kiosk wall, saved views |
| 23 | **Health with context:** `connection_quality`, `reconnects_last_hour`, `stalls_last_hour`, per-role status with debounce for the dead-camera flap, `camera_fps == 0` = offline. | `/stats` | provider | CR-026 `HealthReader` seam fits |
| 24 | **Event lifecycle `before` / `after`** so consumers can diff without keeping state. | MQTT | provider | `events.details_json` can hold the last `before` |

## 6. Arx today and the gap

### 6.1 How recorders are modelled (code survey, `origin/main` e7dfb451)

| Area | State | Where |
|---|---|---|
| Adapter seam | `RecorderAdapter` Protocol: `capabilities`, `health`, `list_channels`, `read_stream_encodings`, `stream_options`, `read_stream`, `write_stream_encoding`; optional `HealthReader.read_health`. Adapters do device I/O only, are synchronous and bounded, raise `ApiError` with shared codes, never see SQLite | `services/recorders/base.py` |
| Registry | `VENDORS` + `VENDOR_SPECS`; `register_vendor(spec, ctor)` is the seam for a new vendor and returns an undo; **Frigate already has a catalogue entry** (`planned`, ports 5000 / 8554, no form fields) | `services/recorders/registry.py` |
| Vendors built | Hikvision (ISAPI, full read + one guarded write), Provision-ISR (HTTP API v1: read, events by polling and device push, playback search, RTSP download; not registered until validated) | `hikvision.py`, `provision_*.py` |
| Multi-recorder | `recorders` table + `recorder_connections` (host, ports, user, AES-GCM password) per recorder, per-recorder effective settings, discovery and alert stream per recorder, `recorder_id` on cameras and events | CR-022, CR-024, migration 0052 / 0055 |
| Capability model | `CAPABILITIES.md`: `nvr`, `go2rtc`, `live_video`, `playback`, `events_recorder` flags; an NVR without go2rtc is unsupported (D2); no NVR hides the Investigate area (D3) | `docs/architecture/CAPABILITIES.md` |
| Health | CR-026: `HealthReading` (disks, channels, clock drift and sync, disk alarms, certificate), noise rules, thresholds in Settings, a screen | CR-026, `recorder_health.py`, `health_report.py` |
| Events | `events` table (source `alertstream` / `recording` / `system`, raw type, normalised type, severity info / alert / critical, confidence measured / inferred, dedup key, ack), ingestion queue with dedup window, coverage-gap events, per-recorder listeners, WebSocket fan-out; `events/windows` groups by gap; manual window groups (0059) | `events_ingest.py`, `routers/events.py`, `provision_events.py` |
| Playback | Playback sessions over go2rtc (seek generations, leases, max sessions), playback groups on a UTC timeline, recording coverage per camera | `routers/playback.py`, `services/playback_groups.py`, `routers/recordings.py`, ADR-013 |
| Exports | Export jobs with estimate, cancel, download, manifest, retention and size limits; cases with items and snapshots | `routers/exports.py`, `services/exports.py`, `routers/cases.py` |
| Rules / notifications | Rules over stored events (never devices), alerts with cooldown; notification policies, sources, visibility, mobile push (CR-018, CR-027) | `rules.py`, `notify*.py`, `mobile_push.py` |
| Search | Text parser to the event centre's own filters with a stated "never identity evidence" note; provider registry with `none` default | `routers/search.py` |
| Spatial | Plan rooms / zones (`spatial_zones`), camera anchors on floors, floor map | migration 0006, `anchors.py` |
| Permissions | `nvr.*` family (config.time, config.events, stream.write, record.manual, alarm_output, rollback, connection.update ...), `events.read`, `events.ack`, `rules.manage`, `cases.manage`, `map.*`, `system.*`; row-scope by camera | `services/access.py` |
| Frigate on the board | Only notes: ADP section 5.3 (a table of expectations), the catalogue entry, CR-024 ("later"), CR-022 ("coming soon"), roadmap 0.2.0 line. No code, no task card in `management/tasks.json` on `origin/main` (the NN5 card lives on the board branch) | |

### 6.2 Gap analysis (Frigate capability versus Arx)

| Frigate capability | Arx today | Gap | Phase |
|---|---|---|---|
| Object-level detections (label, score, zone, path, speed) | Device alarm types only (motion, line, field, ...) | **Large**: no object model | F1 |
| Review items with severity rules | Time-gap windows, no severity rules | Medium: the grouping exists, severity and bundling by objects do not | F1 |
| Per-user reviewed state | Acknowledge (`acked_by`), no per-user read state | Small-medium | F1 (Arx-side state) |
| Event lifecycle new / update / end with late enrichment | One row per event, count + ended_at | Small: dedup/update path exists | F1 |
| Tracked-object timeline + overlay | none | Medium (UI) | F1 minimal, F2 full |
| Semantic / similarity search | Text parser over metadata | **Large** | F1 read, F3 saved searches |
| Motion Search, Motion Previews | none | Medium | F3 |
| HLS VOD playback of a recorder | Provision RTSP playback via go2rtc; ADP names `hls` as a separate player path | **Medium**: first HLS member (player + proxy + anchors to prove) | F1 |
| Recording coverage with motion heatmap | Coverage per camera from NVR record tracks | Small | F1 |
| Native exports and cases | Arx exports and cases (own store) | Decide: duplicate or reference | F1 clip export, F2 native |
| Runtime camera toggles (detect, record, audio, ...) | Hikvision schedule / smart / alarm-output writes with gates | Medium: a new write family and approval classes | F2 |
| Profiles | Alarm modes (HA), presence (CR-027) | Medium: map Arx mode to a recorder profile | F2 |
| PTZ | Hikvision PTZ code exists in `nvr.py` / `cameras.py` | Small (another adapter), physical-action rules | F2 |
| Zones / masks / filters editor | Plan zones only | **Large** (and a Fable UI) | F3 |
| Retention tiers | NVR storage reads, `nvr_capacity` | Medium | F3 (write), F1 (read) |
| Config as a managed document (schema, validate, diff, apply, rollback) | Per-stream encoding change log with undo (CR-020) | Medium: reuse the pattern, new payload | F3 |
| Camera add / clone / remove | Hikvision channel add / remove designed (S3) | Medium | F3 |
| Face / plate / classification libraries | none | Large + privacy | F3 (optional) |
| Audio events | none | Small once the event source exists | F3 |
| GenAI summaries / chat | `ai.provider` placeholder | Optional | F3 (decision) |
| Health detail (fps, stalls, detector load, mounts) | CR-026 readings for disks / channels / clock | Small: more fields | F1 |
| Birdseye-like mosaic | Wall and saved views | Generic UI task, independent of Frigate | outside, noted |

## 7. Architecture of the Frigate provider

### 7.1 Adapter shape

New modules next to the Provision ones, same rules (ADP section 1):

| Module | Role |
|---|---|
| `recorders/frigate.py` | `FrigateAdapter` (the Protocol): `capabilities`, `health`, `read_health`, `list_channels`, `read_stream_encodings` (facts only), `stream_options` (`writable=False`, reason `frigate_does_not_own_the_encoder`), `live_source`, plus vendor methods `snapshot`, `recordings`, `coverage`, `vod_playlist`, `search` |
| `recorders/frigate_http.py` | The only code that talks HTTP: auth, token refresh, TLS pinning, timeouts, **allow-list of GET paths in F1** (as Provision P1 had an allow-list of read commands), scrubbing of responses |
| `recorders/frigate_events.py` | WebSocket listener with polling backfill, mapping to `ParsedAlert`-like rows for `events_ingest` |
| `recorders/frigate_playback.py` | Coverage, HLS playlist rewrite, clip fetch for export |
| `recorders/frigate_control.py` (F2) | Runtime toggles, profile, review actions, native exports, PTZ steps - each a separate function with its own approval class; never called from F1 code paths |
| `recorders/frigate_config.py` (F3) | Config read + scrub, schema forms, diff, `config/set`, rollback records |
| Registry | `register_vendor(VendorSpec("frigate", "Frigate", ...), constructor)`; status stays `planned` ("coming soon") until the live validation checklist passes (CR-022 D1) |

Connection form (the `VendorSpec.fields`): host, HTTP port (default 8971 authenticated; 5000 is the unauthenticated internal
port and is only offered with an "insecure" acknowledgement), `tls` (verify / pin / plain HTTP), user name, password
(secret), and RTSP restream port (8554). The password is stored like every recorder's, AES-GCM in `recorder_connections`.

**Capabilities.** `RecorderCapabilities(vendor="frigate", read_encodings=True (facts), write_encodings=False, add_channel=False,
remove_channel=False, live="rtsp" or "none" per site, playback="hls", events="push", health_detail=True)`. The existing
dataclass is not enough for what Frigate can do, so the design adds one optional field `features: frozenset[str]` (default
empty, so Hikvision and Provision are untouched) holding **discovered** abilities, never version guesses:
`review_items`, `object_events`, `timeline`, `snapshots`, `search_text`, `search_semantic` (only if `semantic_search.enabled`),
`motion_search`, `runtime_toggles`, `profiles` (only if `profiles` exist or the endpoint answers), `ptz` (per camera, from
`/<cam>/ptz/info` and `onvif.host`), `exports_native`, `zones`, `faces`, `lpr`, `classification`, `audio_events`, `genai`,
`config_write`. Discovery reads `GET /config` (which sections are enabled) and `GET /openapi.json` (which routes exist).
Anything missing is `False` with a reason, and a route asks before it calls.

### 7.2 Identity

- Recorder id `frigate-1`, `frigate-2`, ... (ADP 3.1). A host change keeps the id.
- Camera `source_ref` = the camera's config key (`front_door`; lower snake, immutable in Frigate). `channel` is a synthetic
  number assigned once (ADP 3.2). Display name = `friendly_name` when present.
- Renaming a camera in Frigate's config makes a new `source_ref`; Arx shows the old row as "removed from recorder" and the
  new one for review, and the installer may map the old history to it (an explicit merge, as in ADP 3.3 for replaced devices).
- A camera with `enabled: false` stays in `/config` but is hidden in Frigate's UI: Arx keeps the row, disabled, with the reason.
- Frigate event ids (`<epoch>-<6>`) and review ids are globally unique per instance: dedup key
  `frigate|<recorder_id>|review|<id>` and `frigate|<recorder_id>|object|<id>`.
- **The same physical camera often exists on a Hikvision NVR and in Frigate.** Rows are separate (one per recorder) with an
  optional `camera_links` relation ("same place") so the timeline can merge events and the user picks which recorder serves
  playback. This is a decision for the owner (question 8).

### 7.3 Authentication and secrets

- `POST /api/login {user,password}` on the authenticated port returns a JWT cookie (24 h session, refreshed within 30 min
  of expiry). The adapter keeps the token **in memory only** and may use `Authorization: Bearer` (documented) so it needs no
  cookie jar. On 401 it logs in once and retries once; a second 401 is `source_forbidden`. A password change on the
  Frigate side invalidates tokens (documented) and surfaces as the same error.
- **Least privilege:** Frigate has `admin`, `viewer` and custom roles (camera lists). F1 should run on a **viewer** account
  that the owner creates in Frigate (Arx never creates Frigate users, same rule as for Home Assistant): Frigate itself then
  enforces read-only. F2 and F3 need an admin account for `config/set`; use a second connection secret
  (`write_user`) so write capability is a separate, auditable credential. **NOT VERIFIED:** which endpoints a viewer can read
  (`/config`, `/stats`, `/ws` in particular); to be checked with the first viewer account.
- TLS: Frigate's authenticated port serves a self-signed certificate by default. Reuse the Provision pinned-HTTPS handling
  (CR-025 section 6.5): pin on first use, show `certificate.not_after` in health, warn on plain HTTP. The unauthenticated
  port 5000 treats every caller as admin; if the owner chooses it, it is stored as `insecure` and writes are refused
  unless a separate acknowledgement exists.
- **Scrubbing is mandatory.** `GET /config` and `/config/raw_paths` contain camera RTSP URLs with embedded credentials and
  an MQTT user; `ffmpeg_cmds` contains the same inside command lines. The adapter returns a scrubbed copy
  (URL userinfo, any key named `password`, `auth_secret`, `api_key`, `token`, `ffmpeg_cmds`, `inputs[].path` host and
  credentials), never logs raw bodies, and never lets a raw camera URL reach the browser (AGENTS: credentials never go
  from browser to recorder).
- Error mapping: connection / timeout -> `source_unavailable`; 401 / 403 -> `source_forbidden`; 400 on config -> `nvr_rejected`
  (with Frigate's validation message, scrubbed); 404 on an optional route -> the capability is `False`; 5xx -> `source_unavailable`.

### 7.4 Events: transport choice and mapping

| Transport | Pros | Cons | Verdict |
|---|---|---|---|
| **WebSocket `/ws`** (JWT) | Broker-free, same JSON as MQTT, one connection per recorder, also carries the live feature switches (`camera_activity`) and `status/*` | A session that can drop; payloads for `events` / `reviews` not yet seen in the live capture (see section 10, U1) | **Primary** |
| **API polling** `GET /review?after=`, `/events?after=` | Stateless, truthful backfill after any outage, works for history import | Latency (poll interval), items mutate (end time, severity) so the window must overlap | **Always on as backfill and gap detector** |
| MQTT | QoS, retained state, independent of Frigate sessions | Needs the broker address and credentials, a new client library in Arx (none today), another secret | Not in F1; revisit only if the broker is already reachable and the owner wants it |

Rules (same as `events_ingest`): the stream is a health signal as well as a source; a connection lost longer than the gap
threshold records a `coverage_gap` event, and the backfill then reads the missed span from the API - unlike the Hikvision
alert stream, **history exists on the device here, so a backfill is truthful (`confidence = measured`)** and still never
fabricated from the live stream.

Mapping to `events` (migration 0003; `source` is free text, no CHECK):

| Frigate | Arx `events` column | Note |
|---|---|---|
| review item (`id`) | one row, `source='frigate'`, `dedup_key='frigate|<rec>|review|<id>'`, updated in place on `update` / `end` | the "attention" row |
| `severity` alert / detection | `severity` alert / info | rules for who is notified use this |
| objects[] labels | `type`: person -> `person`; car, truck, bus, motorcycle, bicycle -> `vehicle`; others -> `other` with the label in `details_json` (proposal: add `animal`, `package`) | normalised type stays small |
| `zones`, `sub_labels`, `detections[]`, `thumb_time` | `details_json` | object ids allow drill-down |
| `start_time` / `end_time` (epoch seconds, float) | `occurred_at` / `ended_at` (UTC ISO) | **no time-zone or DST ambiguity**, unlike Hikvision; clock drift from the HTTP `Date` header goes to `RecorderHealth.clock_drift_s` |
| `<cam>/status/detect` offline or `connection_quality` poor for N s | `type='offline'`, severity critical, debounced | Frigate's own docs warn the dead-camera flap needs debouncing |
| `tracked_object_update` (description, face, lpr, classification) | merge into `details_json`; if a notification is pending, update it in place | late enrichment |
| manual event, audio event | `type` other / audio label | only if enabled |

Thumbnails: `GET /clips/review/thumb-<cam>-<id>.webp` (verified 200 for a review item) and `GET /api/events/{id}/thumbnail.jpg`
(verified 200); `thumb_path` in the payload is a server path, not a URL. The thumbnail route in Arx
(`/events/{id}/thumbnail`) fetches server-side with the adapter token.

### 7.5 Video: live, playback, snapshots

**Live (needs a decision per site).** The browser never talks to Frigate; Arx's go2rtc pulls and the existing live
pipeline serves. Source ladder, chosen by discovery:

1. **Frigate's restream** `rtsp://<frigate>:8554/<camera>` (optionally with `go2rtc.rtsp` credentials), only if
   `GET /go2rtc/streams` lists the camera. Frigate then holds the single camera connection and Arx is one more consumer. The
   stream name follows the existing rule `smplwise_<recorder_id>_ch<n>_<main|sub>` (`go2rtc.stream_name`).
2. **Snapshot / MJPEG through the Arx backend**: `GET /<cam>/latest.jpg?h=` (about 1-2 fps polled) or `GET /<cam>` (MJPEG,
   re-encoded by Frigate, at most 720p, no audio). Works with no restream, costs Frigate CPU per viewer; suitable for tiles and
   thumbnails, not for the main player. This is what the studied instance can offer today, because its own go2rtc has no streams.
3. **An opt-in "enable restream" action (F3, a config write):** `PUT /go2rtc/streams/<cam>` with an `ffmpeg:` / `rtsp://` source
   that points at the camera's existing upstream, plus the `live.streams` mapping. This is a Frigate configuration write on a
   production system and needs the F3 approval gate; it can duplicate a camera connection, so it shows the estimated extra
   connections first.
4. **Never:** reading the camera's RTSP URL out of `/config` to bypass Frigate (credentials extraction), or touching a go2rtc
   that Frigate's cameras are fed from (on the studied instance that go2rtc also serves another project; CLAUDE.md allows only
   the `smplwise_` namespace there).

**Playback.** Frigate has no RTSP playback; it has **HLS VOD** built on demand from its segment index
(`/vod/<cam>/start/<s>/end/<e>/index.m3u8` verified: fMP4 init + `seg-N-v1.m4s`, about 10 s each). Design (the "HLS member"
of ADP 6.2):

- Arx backend proxies playlist and segments through a **playback session** (`/playback/sessions/{id}/...`) with its own
  token, rewrites relative URIs, authorises every segment request (AGENTS: every media asset), and enforces
  lease / max-sessions like the go2rtc sessions. The browser plays it with hls.js (or native HLS on Safari); this is a new
  player branch next to the go2rtc one.
- **Seek = new playlist** at the new start (cheap, built on demand) tagged with an Arx seek generation; there is no
  long-lived producer to cancel, so cleanup is a lease expiry, not a go2rtc delete.
- **Anchors:** the playlist head carried no `EXT-X-PROGRAM-DATE-TIME` in the sample, so the media anchor comes from
  `GET /<cam>/recordings?after&before` (segment `start_time` floats). **NOT VERIFIED:** whether the first returned segment
  starts before the requested `start`, and the rendered-time versus anchor error. A measurement step (F1-M1) must prove
  anchor, seek generation, rendered time and cleanup before playback is declared supported (AGENTS rule).
- **Coverage:** merge `recordings` segments into ranges with a gap tolerance; the per-segment `motion` and
  `motion_heatmap` give a motion density bar for Arx's timeline for free. The studied instance keeps no continuous
  recording (motion 10 d, alerts 30 d), so coverage is **sparse by design**: the UI must show "recording policy: motion
  only" (read from `record`), and treat partial coverage as partial, not empty (AGENTS).
- **Time:** all Frigate times are epoch seconds. Endpoints that bucket by day or hour take a `timezone` parameter; always pass
  the Arx site's IANA zone. `/recordings/summary` day keys are therefore site-local when asked so.
- **Export (F1, read-only on Frigate):** `GET /<cam>/start/<s>/end/<e>/clip.mp4` is a GET that concatenates segments; the Arx
  export job streams it into Arx's own export store (manifest, audit, size limits, retention) - Frigate stores nothing.
  **NOT VERIFIED** (not executed: a GET that makes the server cut a clip was outside the study's read-only comfort zone; test it
  with approval). Frigate-native exports (stored on Frigate, never expire, cases) are an F2 write.
- **Snapshots at a time:** `GET /<cam>/recordings/<ts>/snapshot.jpg` returns a frame from the recording, the equivalent of
  Provision's `snapshot_at`; `GET /events/<id>/snapshot.jpg` and `snapshot-clean.webp` when snapshots are enabled
  (disabled on the studied instance: `has_snapshot` false everywhere, thumbnails only).

### 7.6 Control surface (F2/F3) and the write gates

The CR-020 pattern is reused: the adapter performs the call; `services/...` records an `nvr_changes` row (extended with
`recorder_id`, `camera_id`, `fields_json`, before / after), checks the permission, verifies by reading back, and offers
rollback. Frigate has no ETag, so the "etag" is a hash of the relevant config section / feature state read immediately
before the write; if it moved, the write is refused as stale (409), exactly like Hikvision stream writes.

| Write class | Calls | Reversible? | Gate (CLAUDE.md device-write rule) |
|---|---|---|---|
| W1 analytics runtime toggles | `PUT /camera/{cam}/set/{detect,motion,audio,review_alerts,review_detections,notifications,improve_contrast,ptz_autotracker,birdseye,birdseye_mode,motion_threshold,motion_contour_area,motion_mask,object_mask,zone}` | yes (set back) | owner approves the class once per site; each call audited; never `*` (all cameras) without a confirm |
| W2 recording-affecting toggles | `set/enabled`, `set/recordings`, `set/snapshots` | yes, but **footage is lost while off** | per-action approval and an on-screen warning (recording policy edit) |
| W3 profile switch | `set/profile` with `*` | yes | per-action approval (changes many cameras and clears runtime toggles) |
| W4 PTZ | `<cam>/ptz` via `/ws` (preset, single move step, zoom step, stop) | n/a (physical) | per-action approval; **no patrol, no queue, no blind retry** (AGENTS); a lease so two users cannot fight |
| W5 native exports / cases | `POST /export/...`, `/exports/batch`, cases CRUD, rename | deletable only by W7 | class approval (creates data on Frigate's disk) |
| W6 configuration | `PUT /config/set`, `POST /config/save`, `PUT/DELETE /go2rtc/streams/{name}`, camera add / clone | yes by recorded inverse (not for add) | per change-set approval with a diff preview; restart is a separate approval; validation first (`config/save` validates and returns 400) |
| W7 destructive | delete camera / recordings / reviews / events / exports / faces, `media/sync`, `restart` | **no** | **not offered** in F1-F3 except `restart` and `media/sync` as separate explicit approvals; recording deletion and camera deletion are never done by Arx |
| W8 identity libraries | faces and plates (create, register, reclassify, known plates) | partly | privacy approval (biometric data); off by default |
| W9 external AI | GenAI provider, chat, VLM watch | n/a | egress and cost decision by the owner |
| W10 Frigate users and roles | `/users*` | - | **never**: the owner creates accounts in Frigate |

Permissions proposed (names in the style of `nvr.*`): `analytics.read` (events, reviews, search, timeline), `analytics.review`
(reviewed state), `analytics.control` (W1), `analytics.record_control` (W2), `analytics.profile` (W3), `analytics.ptz` (W4),
`analytics.export` (W5), `analytics.config` (W6), `analytics.libraries` (W8). Camera row-scope applies to every call.

### 7.7 Health (CR-026 seam)

`health()` = `GET /version` + `GET /stats` (online, version string `0.18.0-77a66e7` as `firmware`, model = detector types),
`clock_drift_s` = HTTP `Date` header minus host time. `read_health()` fills `HealthReading`:

- disks: the `service.storage` mounts (`/media/frigate/recordings`: total, used, free MB, `mount_type`); the DB-derived Frigate
  footprint from `/recordings/storage`; a derived **hours-of-recording-left** = free / sum of `bandwidth` (MB/h), with an
  alarm below Frigate's own emergency-cleanup horizon (about 1 h) and a softer Arx threshold;
- channels: `connected` from `connection_quality` / `camera_fps > 0` / `status/detect`; `record_state` from `status/record`
  and `record.enabled`;
- vendor-specific rows: detector inference ms, `skipped_fps > 0` (detector overload), per-camera `reconnects_last_hour` and
  `stalls_last_hour`, ffmpeg CPU, GPU, `shm` headroom (`/dev/shm` mount info), embeddings speeds, certificate expiry;
- noise rules as CR-026 section 3 (debounce the detect-pipe flap, require N consecutive failures).

### 7.8 Testing strategy

A fake Frigate in `tests/fixtures/fake_frigate.py` (same pattern as `fake_provision.py`): login, `/version`, `/stats`, `/config`
(scrubbed fixture), `/events`, `/review`, `/recordings`, `/vod` playlist, `/ws` frames, error injection (401 refresh, 5xx,
slow, partial). Fixtures come only from `private-evidence/frigate-*/` after redaction and review (CLAUDE.md). Contract
test: the fake serves the real OpenAPI path list, and a test fails if the adapter calls a path outside its allow-list.
Live validation checklist (read-only, owner present) like CR-025 section 6.

## 8. Proposal: three phases

Principles: (1) F1 is **read-only against Frigate** (one login POST and a WebSocket listen are the only non-GET traffic), so
it needs no write approval at all. (2) Every phase ships behind capability discovery and stays "coming soon" in the vendor
catalogue until its live validation checklist passes on the owner's instance. (3) F2 and F3 each add **write classes**
(section 7.6) and each class needs the owner's explicit approval before its first live use. (4) Frigate is never required:
a site without it behaves exactly as today. (5) Targets follow the board's numbering: F1 = 2.5.0 (the Frigate provider slot),
F2 and F3 follow on the 2.x train at the owner's pace.

### F1 - "See and replay": read-only provider (target 2.5.0)

| Item | Detail |
|---|---|
| **Scope** | Connection form and test (viewer account); discovery of cameras (incl. disabled); capability discovery (`features`); health (CR-026 reading + Frigate-specific rows); live per site (restream if present, else snapshot / MJPEG tiles); **events and reviews** from `/ws` with polling backfill and `coverage_gap`; Arx-side **per-user reviewed state** and bulk review; alerts / detections / motion tiers; recording **coverage + motion density**; **HLS playback member** (proxy, seek generations, anchors measured); **clip export** into Arx's own export store; snapshot at a time; thumbnails; tracked-object **lifecycle timeline** with click-to-seek; **search read** (text, semantic, similarity) through `/events/search`; storage read (`/recordings/storage`, MB/h, hours left); Frigate review alerts as a **notification source** (cooldown, update-in-place); fake Frigate server + tests; live validation checklist |
| **API calls** | `POST /login` (+ `Authorization: Bearer`), `GET /version`, `/stats`, `/config`, `/config/schema.json`, `/openapi.json`, `/go2rtc/streams`, `/events`, `/events/{id}`, `/events/search`, `/review`, `/review/{id}`, `/review/summary`, `/review/activity/motion`, `/timeline`, `/<cam>/recordings`, `/<cam>/recordings/summary`, `/recordings/storage`, `/recordings/summary`, `/vod/<cam>/start/.../index.m3u8` + segments, `/<cam>/latest.jpg`, `/<cam>/recordings/{ts}/snapshot.jpg`, `/events/{id}/thumbnail.jpg`, `/clips/review/thumb-...`, `/<cam>/start/.../clip.mp4`, `/labels`, `/sub_labels`, `/profile`; WebSocket `/ws` (listen only) |
| **UI screens** | Settings > connections: Frigate card (extends CR-022 form). Devices: recorder rows. **Investigate > Alerts** (review cards: thumbnail, object chips, zone, severity colour, duration, reviewed state, multi-select, shortcuts, calendar with recordings underline + unreviewed dot). Event drawer (lifecycle timeline, score / top score, play from here). Playback with an HLS member and a coverage + motion bar. Search box (text, semantic, similar-to-this, `key:value` chips). Health card rows. Storage screen rows. |
| **Permissions** | `analytics.read`, `analytics.review`, existing `events.read`, `playback.*`, `exports.*`, `system.health`; camera row-scope everywhere |
| **Approvals** | None for Frigate writes (there are none). Owner actions: create a Frigate **viewer** account; allow one `clip.mp4` GET test; be present for the live validation |
| **Risks** | R1 viewer role may not read `/config` or `/ws` (NOT VERIFIED). R2 `events` / `reviews` frames over `/ws` were not observed in a 13 min night-time listen (no detection happened); the polling backfill is therefore mandatory, not optional, until a detection is captured. R3 HLS anchors / seek error unproven until measured. R4 polling and MJPEG load on Frigate's CPU (the instance already shows high ffmpeg CPU on one camera): budgets per recorder, poll no faster than 5 s, MJPEG capped. R5 thumbnails of people are stored in Arx: retention follows the events setting. R6 sparse coverage (motion-only retention) must not be shown as "no recording". R7 duplicates with a Hikvision camera (question 4). R8 self-signed TLS (pin on first use). R9 `events/summary` is 14 MB unfiltered: the allow-list forbids it without a time window |
| **Dependencies** | CR-024 recorder model and CR-026 health (both on `main`); Provision playback patterns (CR-025 P3) for the session / lease shape; Arx go2rtc for live; owner's viewer account |
| **Fable UI** | One pass: the **Alerts / review screen** (cards + timeline + lifecycle overlay + calendar). Everything else reuses existing components |

### F2 - "Control and act": runtime control and safe actions

| Item | Detail |
|---|---|
| **Scope** | Per-camera **control drawer**: detect, motion, audio, review alerts / detections, notifications (+ suspend), improve-contrast, motion threshold and contour area, PTZ autotracker, mask / zone on-off, birdseye mode; recording-affecting toggles (**enabled, recordings, snapshots**) behind a warning; **profiles** and a rule "alarm mode X selects profile Y" through Arx automations (CR-017), with a visible active profile; **PTZ steps** (preset, step, zoom, stop; lease; no patrol); event actions (retain flag, sub label correction, manual event create / end from Arx rules, e.g. a door sensor); **Frigate-native exports and cases** ("keep on Frigate"), rename; Debug Replay start / stop and viewer; live feature state shown from `camera_activity` with "persisted / not persisted" labels (Frigate's own rule); audit log and one-click revert for every change |
| **API calls** | `PUT /camera/{cam}/set/{feature}[/{sub}]` (value body), `/ws` control topics (`<cam>/ptz`, `notifications/suspend`), `POST /events/{id}/sub_label`, `POST/DELETE /events/{id}/retain`, `POST /events/{cam}/{label}/create`, `PUT /events/{id}/end`, `POST /export/{cam}/start/{s}/end/{e}`, `/exports/batch`, `PATCH /export/{id}/rename`, cases POST / PATCH, `POST /debug_replay/start`, `/stop`, plus all F1 reads |
| **UI screens** | Camera page drawer; Settings > Modes (profile mapping); Exports > "kept on Frigate"; PTZ pad on the live page; change log with revert; reuse of the CR-020 S2C review-then-apply pattern |
| **Permissions** | `analytics.control`, `analytics.record_control`, `analytics.profile`, `analytics.ptz`, `analytics.export`; plus an automation scope for the profile rule |
| **Approvals** | W1 class once per site; **W2, W3 and W4 per action** (CLAUDE.md: no physical action, no recording policy edit without task-specific approval); W5 class; the first live write of each class is a supervised owner test on a camera of his choice (as CR-020 S2 decided "one lab write, owner's choice") |
| **Risks** | Write on a production system. Mitigation: read-before / read-after with state hash, `*` (all cameras) never default, no queue / no blind retry for PTZ, revert recorded, class approvals. A toggle to OFF stops recording for the duration (W2). Profile switch clears runtime toggles. PTZ needs a lease. Frigate state persists differently per feature (documented; shown in UI) |
| **Dependencies** | F1 merged and validated; an admin account for Frigate (second secret); CR-017 automation scope for the profile rule |
| **Fable UI** | None required; the drawer follows existing camera-card patterns. A short mockup review by the owner is enough |

### F3 - "Configure and enrich": configuration management (3a) and enrichments (3b)

**F3a - configuration as a managed document**

| Item | Detail |
|---|---|
| **Scope** | Scrubbed config viewer; **schema-driven forms** from `/config/schema.json` with Modified / Overridden badges, Reset to Global, Save All with a pending-changes diff, restart-needed marker; object tracking and filters (min / max area, ratio, score, threshold); motion settings; **retention tiers** (continuous / motion / alerts / detections with mode and pre / post) with a **storage forecast** (MB/h x days vs free space); review rules (alert labels, required zones); **zones and masks editor over the live frame** (polygons, loitering, inertia, speed calibration, enabled toggle; explicit mask semantics; zone to Arx plan-area link); **camera add wizard** (probe, per-stream test, validation checklist), clone, enable / disable, "enable restream" (go2rtc entry) with the extra-connection estimate; Motion Search jobs and Motion Previews; logs viewer; media sync and restart as separately approved maintenance; config history with per-subtree rollback; Frigate users read-only (to map to Arx roles, never created by Arx) |
| **API calls** | F1 + F2 + `PUT /config/set`, `POST /config/save` (validate first), `GET /config/raw` (admin, scrubbed before display), `PUT/DELETE /go2rtc/streams/{name}`, `GET /onvif/probe`, `/ffprobe`, `/ffprobe/snapshot`, `/ffmpeg/presets`, `POST /{cam}/search/motion` + status + cancel, `GET /logs/{service}`, `POST /media/sync`, `POST /restart` |
| **UI screens** | Settings > Frigate (sections), **Zones and masks editor**, **Retention planner**, camera wizard, Motion Search, config history, maintenance |
| **Permissions** | `analytics.config` (+ `system.configure` for maintenance) |
| **Approvals** | W6 **per change-set** with the diff shown; restart separate; camera add and restream creation per action; W7 items other than restart / media sync are not offered |
| **Risks** | The only dangerous family: a bad config can stop every camera of that Frigate (it restarts all cameras). Mitigation: validate through `config/save` before apply, apply hot (`config/set`, `requires_restart=0`) whenever the key allows, snapshot of the subtree before, automatic read-back, one-click inverse, a maintenance-window warning. Config is YAML on Frigate: Arx edits through the API only, never the file. Camera delete is **not** offered (irreversible, deletes media) |
| **Dependencies** | F2; owner approval of the write classes; Fable pass for the editors |
| **Fable UI** | **Yes, three pieces:** zones / masks editor (live frame + polygons + calibration), retention planner with forecast, search / explore grid with similarity and chips. The camera wizard and settings forms reuse the CR-020 / CR-022 patterns |

**F3b - enrichments (optional, each behind its own decision)**

| Item | Detail |
|---|---|
| **Scope** | Semantic-search reindex and model choice; **audio events** (labels, thresholds, RMS view); **face library and plate library** (known plates with wildcards, replace rules, dedicated LPR camera) - privacy gated; **state classification** trainer (gate open / closed) with the crop editor; object classification; GenAI providers, review summaries with the threat-level prompt, Chat - egress gated; Frigate+ not planned |
| **Approvals** | W8 (biometrics) and W9 (external AI) explicit; default off |
| **Risks** | Biometric data and legal/privacy posture; model downloads need internet on Frigate; trainers consume CPU on a box that already runs hot |
| **Fable UI** | Libraries and trainer screens if the owner chooses to build them |

## 9. Effort and quota (calibrated)

**Calibration.** The lead's historical estimates were nominal agent-hours and ran 5-10x above reality: CR-015 was estimated at
92-116 agent-hours and took about 2.5 hours of wall clock with four parallel agents (`docs/architecture/AUTOMATIONS_API.md`
calibration note); the whole Provision-ISR P1 adapter (about 1.2 k lines of adapter, 0.7 k of parsers, a fake device and
30 tests) was one agent session, while CR-025's own ETA table said 2-3 days per phase. The figures below are **active agent
time** (one agent working), already scaled by about 1/8 from a classic estimate, and exclude the owner's review time. Quota
percentages are an **assumption** (about 0.5-0.8 % of one week's quota per Sonnet agent-hour, taken from recent rounds, to
be re-measured with the usage report after F1's first segment); treat them as +/-50 %.

| Phase | Work packages (active agent-hours) | Total | Sonnet quota | Fable passes | Wall clock with 3 agents |
|---|---|---|---|---|---|
| F1 | adapter + http + auth + fake + tests 2.5; events/WS/poll/mapping/backfill/notification source 2.5; playback HLS proxy + coverage + export + measurement 2.5; health + capabilities + registry + connection form 1.5; UI (alerts, drawer, search, coverage bar, settings) 3.5; review fixes 1.0; live validation 1.5 | **about 15 h** | **8-12 %** | 1 (alerts screen) | 1 working day |
| F2 | write plumbing (audit, revert, state hash, gates) 1.5; toggles + profile rule 1.5; PTZ + lease 1.0; event actions + native exports 1.5; UI drawer + modes + exports 2.0; tests 1.0; supervised live writes 1.0 | **about 10 h** | **5-8 %** | 0 | 0.5-1 day |
| F3a | config read/scrub/schema forms 3.0; diff + apply + history + rollback 2.5; retention planner + forecast 2.0; zones/masks editor 4.0; camera wizard + clone + restream 3.0; Motion Search + logs + maintenance 2.0; tests and validation 3.0 | **about 20 h** | **12-16 %** | 3 (editors, planner, explore) | 2-3 days |
| F3b | per item 2-4 h (audio 2, libraries 4, trainer 4, GenAI 3) | **2-13 h** | **2-9 %** | optional | optional |
| **Total F1-F3a** | | **about 45 h** | **25-36 %** | 4 | about 4-5 working days of agents, spread over the owner's review rhythm |

Fable (design) is spent only on the four screens above; at the current weekly level the owner's rule (Fable for advanced
graphic design only) is respected. F1 alone already delivers the visible win (alerts and replay); F2 and F3 can wait for a
review round without blocking it.

## 10. Risks, unknowns, and what could not be verified

| # | Item | Status | How to close |
|---|---|---|---|
| U1 | `events`, `reviews`, `tracked_object_update` frames over `/ws` (none occurred in a 30 s and a 13 min listen) | not verified | capture one during a detection, read-only, before F1 relies on it; polling stays the backfill |
| U2 | What a **viewer** account may read (`/config`, `/stats`, `/ws`, `/events`) | not verified (only an admin was available) | owner creates a viewer account; one read pass |
| U3 | HLS anchor accuracy (first segment vs requested start), seek behaviour, cleanup | not verified | F1 measurement step (AGENTS media-anchor rule) |
| U4 | `GET .../clip.mp4` behaviour (time to build, size, load) | not executed on purpose | one supervised GET test |
| U5 | Face / LPR / audio / PTZ / GenAI / classification / birdseye / profiles behaviour | features are off or unconfigured on the instance; documented only | verify when the owner enables them, or on a second instance |
| U6 | Every write endpoint | not exercised (read-only study) | F2 / F3 supervised tests |
| U7 | `GET /recordings/unavailable` answered 500 on this build | observed; avoid | allow-list excludes it |
| U8 | Docs inconsistencies noted by the reading agents (stationary default 10 s vs 50 frames; `preset-vaapi` described as deprecated on one page and listed on another; review-card hover vs click marks reviewed) | not material to the adapter | none needed |
| U9 | MQTT topics were taken from the docs, not observed (no broker access) | documented | not needed if `/ws` carries the same frames |
| U10 | Frigate behaviour on versions before 0.18 (the API has changed: `/review` on newer versions, `recordings` retention keys, `profiles`) | tested only on 0.18.0 | support statement: 0.18+; older versions degrade by capability discovery |
| U11 | The instance's own go2rtc has no streams; its cameras are fed by an external go2rtc that also serves another project | observed | do not touch that go2rtc; see live ladder |

## 11. Questions for the owner (English reference; the Hebrew numbered version is in the owner summary)

Each has short options and a recommendation.

| # | Question | Options | Recommendation |
|---|---|---|---|
| 1 | How far to go? | a) F1, F2, F3a in order with a review after each; b) F1 + F2 now, F3 later; c) F1 only for now | a) |
| 2 | Frigate accounts | a) the owner creates a **viewer** user for Arx now (F1) and an admin user for Arx later (F2/F3); b) one admin user for everything | a) (Frigate then enforces read-only in F1) |
| 3 | Live video for this instance (its own go2rtc is empty) | a) tiles from snapshots / MJPEG until restream exists; b) the owner adds restream entries in Frigate himself; c) Arx adds them in F3 behind approval | a) now, c) in F3 |
| 4 | The same camera in the Hikvision NVR and in Frigate | a) link them as one place; Hikvision stays primary for playback, Frigate adds analytics and its own playback as an alternative; b) keep them separate | a) |
| 5 | Which Frigate items notify the phone / dashboard | a) alerts only (Frigate's own rule), detections only listed; b) alerts + detections; c) per camera policy | a) |
| 6 | Face and plate recognition (biometrics) | a) off; b) allowed, owner-only library; c) full | a) for now, decide in F3b |
| 7 | Generative AI (descriptions, summaries, chat; sends frames to a model) | a) no; b) local model only; c) cloud allowed | a) |
| 8 | Write classes (section 7.6): approve now | a) W1 analytics toggles as a class, W2-W4 per action; b) everything per action; c) wait until F2 | a) at the start of F2 |
| 9 | Reviewed state | a) kept in Arx per user (Frigate's own state belongs to its service account); b) also mirrored to Frigate | a) |
| 10 | PTZ and test of a first physical step | a) allow one supervised step on a camera of his choice at F2; b) no PTZ | a) |
| 11 | Recording policy of this Frigate is motion-only, 10 days, alerts 30 days | a) Arx shows it read-only and warns that coverage is sparse; b) Arx may propose changes in F3a (approval per change) | a) then b) |
| 12 | Minimum Frigate version | a) 0.18+ only; b) also try older | a) |
| 13 | Design budget | a) Fable for the alerts screen (F1) and the zones / masks editor (F3a) only; b) Fable for all four; c) in-house only | a) |
| 14 | Order on the train | a) F1 = 2.5.0, F2 / F3 as later 2.x releases; b) F1+F2 together | a) |
| 15 | May the study agent do one supervised read of `clip.mp4` (a server-side cut) and later a viewer-account read pass? | a) yes, when he is present; b) no | a) |

## Appendix A - the HTTP API of the studied instance (OpenAPI, 179 operations)

Grouped by tag; paths relative to `/api`. Source: the instance's own `GET /api/openapi.json` (FastAPI 0.1.0 schema,
Frigate 0.18.0).

**Auth** (10): `GET /api/auth/first_time_login`; `GET /api/auth`; `GET /api/profile`; `GET /api/logout`; `POST /api/login`; `GET /api/users`; `POST /api/users`; `DELETE /api/users/{username}`; `PUT /api/users/{username}/password`; `PUT /api/users/{username}/role`

**Camera** (12): `GET /api/go2rtc/streams`; `GET /api/go2rtc/streams/{stream_name}`; `PUT /api/go2rtc/streams/{stream_name}`; `DELETE /api/go2rtc/streams/{stream_name}`; `GET /api/ffprobe`; `GET /api/keyframe_analysis`; `GET /api/ffprobe/snapshot`; `GET /api/reolink/detect`; `GET /api/onvif/probe`; `DELETE /api/cameras/{camera_name}`; `PUT /api/camera/{camera_name}/set/{feature}/{sub_command}`; `PUT /api/camera/{camera_name}/set/{feature}`

**Chat** (6): `GET /api/chat/tools`; `POST /api/chat/execute`; `POST /api/chat/completion`; `POST /api/vlm/monitor`; `GET /api/vlm/monitor`; `DELETE /api/vlm/monitor`

**Classification** (25): `GET /api/faces`; `POST /api/faces/reprocess`; `POST /api/faces/train/{name}/classify`; `POST /api/faces/{name}/create`; `POST /api/faces/{name}/register`; `POST /api/faces/recognize`; `POST /api/faces/{name}/reclassify`; `POST /api/faces/{name}/delete`; `PUT /api/faces/{old_name}/rename`; `PUT /api/lpr/reprocess`; `PUT /api/reindex`; `PUT /api/audio/transcribe`; `GET /api/classification/{name}/dataset`; `GET /api/classification/attributes`; `GET /api/classification/{name}/train`; `POST /api/classification/{name}/train`; `POST /api/classification/{name}/dataset/{category}/delete`; `POST /api/classification/{name}/dataset/{category}/reclassify`; `PUT /api/classification/{name}/dataset/{old_category}/rename`; `POST /api/classification/{name}/dataset/categorize`; `POST /api/classification/{name}/dataset/{category}/create`; `POST /api/classification/{name}/train/delete`; `POST /api/classification/generate_examples/state`; `POST /api/classification/generate_examples/object`; `DELETE /api/classification/{name}`

**Review** (10): `GET /api/review`; `GET /api/review_ids`; `GET /api/review/summary`; `POST /api/reviews/viewed`; `POST /api/reviews/delete`; `GET /api/review/activity/motion`; `GET /api/review/event/{event_id}`; `GET /api/review/{review_id}`; `DELETE /api/review/{review_id}/viewed`; `POST /api/review/summarize/start/{start_ts}/end/{end_ts}`

**App** (34): `GET /api/`; `GET /api/config/schema.json`; `GET /api/version`; `GET /api/stats`; `GET /api/stats/history`; `GET /api/metrics`; `GET /api/genai/models`; `POST /api/genai/probe`; `GET /api/config`; `GET /api/profiles`; `GET /api/profile/active`; `GET /api/ffmpeg/presets`; `GET /api/config/raw_paths`; `GET /api/config/raw`; `POST /api/config/save`; `PUT /api/config/set`; `GET /api/vainfo`; `GET /api/nvinfo`; `GET /api/logs/{service}`; `POST /api/restart`; `POST /api/media/sync`; `GET /api/media/sync/current`; `GET /api/media/sync/status/{job_id}`; `GET /api/labels`; `GET /api/sub_labels`; `GET /api/audio_labels`; `GET /api/plus/models`; `GET /api/recognized_license_plates`; `GET /api/timeline`; `GET /api/timeline/hourly`; `POST /api/debug_replay/start`; `POST /api/debug_replay/start_from_export`; `GET /api/debug_replay/status`; `POST /api/debug_replay/stop`

**Preview** (3): `GET /api/preview/{camera_name}/start/{start_ts}/end/{end_ts}`; `GET /api/preview/{year_month}/{day}/{hour}/{camera_name}/{tz_name}`; `GET /api/preview/{camera_name}/start/{start_ts}/end/{end_ts}/frames`

**Notifications** (2): `GET /api/notifications/pubkey`; `POST /api/notifications/register`

**Export** (16): `GET /api/exports`; `GET /api/cases`; `POST /api/cases`; `GET /api/cases/{case_id}`; `PATCH /api/cases/{case_id}`; `DELETE /api/cases/{case_id}`; `GET /api/cases/{case_id}/download`; `GET /api/jobs/export`; `GET /api/jobs/export/{export_id}`; `POST /api/exports/batch`; `POST /api/export/{camera_name}/start/{start_time}/end/{end_time}`; `PATCH /api/export/{event_id}/rename`; `POST /api/export/custom/{camera_name}/start/{start_time}/end/{end_time}`; `GET /api/exports/{export_id}`; `POST /api/exports/delete`; `POST /api/exports/reassign`

**Events** (24): `GET /api/events`; `GET /api/events/explore`; `GET /api/event_ids`; `GET /api/events/search`; `GET /api/events/summary`; `GET /api/events/{event_id}`; `DELETE /api/events/{event_id}`; `POST /api/events/{event_id}/retain`; `DELETE /api/events/{event_id}/retain`; `POST /api/events/{event_id}/plus`; `PUT /api/events/{event_id}/false_positive`; `POST /api/events/{event_id}/sub_label`; `POST /api/events/{event_id}/recognized_license_plate`; `POST /api/events/{event_id}/attributes`; `POST /api/events/{event_id}/description`; `PUT /api/events/{event_id}/description/regenerate`; `POST /api/description/generate`; `DELETE /api/events/`; `POST /api/events/{camera_name}/{label}/create`; `PUT /api/events/{event_id}/end`; `POST /api/trigger/embedding`; `PUT /api/trigger/embedding/{camera_name}/{name}`; `DELETE /api/trigger/embedding/{camera_name}/{name}`; `GET /api/triggers/status/{camera_name}`

**Media** (28): `GET /api/{camera_name}`; `GET /api/{camera_name}/ptz/info`; `GET /api/{camera_name}/latest.{extension}`; `GET /api/{camera_name}/recordings/{frame_time}/snapshot.{format}`; `POST /api/{camera_name}/plus/{frame_time}`; `GET /api/{camera_name}/start/{start_ts}/end/{end_ts}/clip.mp4`; `GET /api/vod/{camera_name}/start/{start_ts}/end/{end_ts}`; `GET /api/vod/{year_month}/{day}/{hour}/{camera_name}`; `GET /api/vod/{year_month}/{day}/{hour}/{camera_name}/{tz_name}`; `GET /api/vod/event/{event_id}`; `GET /api/vod/clip/{camera_name}/start/{start_ts}/end/{end_ts}`; `GET /api/events/{event_id}/snapshot.jpg`; `GET /api/events/{event_id}/thumbnail.{extension}`; `GET /api/{camera_name}/grid.jpg`; `DELETE /api/{camera_name}/region_grid`; `GET /api/events/{event_id}/snapshot-clean.webp`; `GET /api/events/{event_id}/clip.mp4`; `GET /api/review/{review_id}/clip.mp4`; `GET /api/events/{event_id}/preview.gif`; `GET /api/{camera_name}/start/{start_ts}/end/{end_ts}/preview.gif`; `GET /api/{camera_name}/start/{start_ts}/end/{end_ts}/preview.mp4`; `GET /api/review/{event_id}/preview`; `GET /api/preview/{file_name}/thumbnail.webp`; `GET /api/preview/{file_name}/thumbnail.jpg`; `GET /api/{camera_name}/{label}/thumbnail.jpg`; `GET /api/{camera_name}/{label}/best.jpg`; `GET /api/{camera_name}/{label}/clip.mp4`; `GET /api/{camera_name}/{label}/snapshot.jpg`

**Motion Search** (3): `POST /api/{camera_name}/search/motion`; `GET /api/{camera_name}/search/motion/{job_id}`; `POST /api/{camera_name}/search/motion/{job_id}/cancel`

**Recordings** (6): `GET /api/recordings/storage`; `GET /api/recordings/summary`; `GET /api/{camera_name}/recordings/summary`; `GET /api/{camera_name}/recordings`; `GET /api/recordings/unavailable`; `DELETE /api/recordings/start/{start}/end/{end}`

## Appendix B - MQTT / WebSocket topics (documented; WebSocket subset observed)

Default prefix `frigate`. Over `/ws` the same payloads arrive as `{topic, payload}` without the prefix.

| Topic | Direction | Payload |
|---|---|---|
| `available` | out | `online` / `stopped` / `offline` (LWT; republished on every broker reconnect) |
| `events` | out | `{type: new\|update\|end, before:{...}, after:{...}}`; object fields: id, camera, label, sub_label, zones (current / entered), score, top_score, box, region, area, ratio, active / stationary, speed, attributes, plate, `has_clip`, `has_snapshot` |
| `reviews` | out | `{type, before, after}`; item: id, camera, start / end, severity, `thumb_path`, `data.{detections,objects,sub_labels,zones,audio}` |
| `tracked_object_update` | out | `{type: description\|face\|lpr\|classification, id, ...}` (late enrichment, keyed by event id) |
| `triggers` | out | `{name, camera, event_id, type, score}` |
| `stats` | out | same as `/api/stats`, every `stats_interval` (60 s) |
| `camera_activity` | out | per camera: motion, objects, and the live feature switches (observed over `/ws`) |
| `<cam>/status/<role>` | out | `online` / `offline` / `disabled` for detect, record, audio (observed: detect) |
| `<cam>/motion` | out | `ON` / `OFF` (sticky for `mqtt_off_delay`; observed) |
| `<cam>/<object>[/active]`, `<zone>/<object>[/active]` | out | counts |
| `<cam>/<object>/snapshot` | out | JPEG bytes |
| `<cam>/audio/<type>`, `audio/dBFS`, `audio/rms`, `audio/transcription` | out | state / numbers / text |
| `<cam>/classification/<model>` | out | state class (state classification) |
| `<cam>/review_status` | out | `NONE` / `DETECTION` / `ALERT` |
| `<cam>/{enabled,detect,audio,recordings,snapshots,motion,improve_contrast,review_alerts,review_detections,object_descriptions,review_descriptions,birdseye,ptz_autotracker,notifications}/set` and `/state` | in / out | `ON` / `OFF` (persistence differs per feature) |
| `<cam>/{motion_threshold,motion_contour_area}/set`, `birdseye_mode/set` | in | integer / `CONTINUOUS\|MOTION\|OBJECTS` |
| `<cam>/{motion_mask,object_mask,zone}/<name>/set` | in | `ON` / `OFF` |
| `<cam>/ptz` | in | `preset_<name>`, `MOVE_UP\|DOWN\|LEFT\|RIGHT`, `ZOOM_IN\|OUT`, `STOP` |
| `<cam>/notifications/suspend`, `suspended` | in / out | minutes / unix timestamp |
| `profile/set`, `profile/state` | in / out | profile name or `none` (state retained; observed over `/ws`) |
| `notifications/set`, `notifications/state` | in / out | `ON` / `OFF` |
| `restart` | in | any payload makes Frigate exit |
| `embeddings_reindex_progress`, `model_state`, `birdseye_layout`, `audio_detections`, `job_state` | out (WS) | observed over `/ws` |

Home Assistant users get a notification proxy at `/api/frigate/notifications/<event-id>/...` (thumbnail, snapshot, clip,
master.m3u8 for iOS, preview gif) - a design worth copying for Arx's mobile push: a media URL keyed by event id, served by the
hub, so the recorder is never exposed.

## Appendix C - UI reference (what the Frigate web app offers, for the designer)

- **Live:** camera-group rail (home + one icon per group), filmstrip of recent alerts (inline reviewed check), tiles with
  pulsing red motion dot, red outline for an active object, label chips, "stream offline" / "camera is off" placeholders,
  stats overlay, right-click menu (volume, stats, debug, per-camera On/Off for admins), smart streaming with
  "low bandwidth" notice and Reset, per-group editable layout stored per device, single-camera view with PiP, fullscreen,
  two-way talk (`t`), mute (`m`), zoom, PTZ pad, on-demand recording, instant snapshot, debug overlays, admin toggles.
- **Review:** Alerts / Detections / Motion toggle with counts, card grid with inline preview on hover, vertical activity
  timeline with red / orange marks, filters (cameras, labels, zones, date, reviewed), calendar (recordings underline,
  severity dot), multi-select with `Ctrl+A`, `R`, `Esc`, export / mark reviewed / delete; Motion tab (multi-camera scrub,
  Motion Previews with heatmap and a 16x16 cell filter, Motion Search with ROI).
- **History (recording viewer):** vertical timeline with motion lines and coloured bands, Events list, Detail inspector
  (lifecycle rows, annotation offset), secondary preview row to follow a subject across cameras, Actions (export, share
  timestamp, motion search, debug replay, snapshot).
- **Explore:** grouped by label with counts, search box (text / image similarity) with filter chips and saved searches,
  filters (camera, label, sub label, attribute, plate, zone, date, time range, score, speed, clip / snapshot, Frigate+),
  details dialog with tracking details and editable fields, actions menu (download, find similar, add trigger, delete).
- **Export:** list with search, cases (new case, uncategorised), play / download / share / rename / delete, bulk reassign.
- **System:** General (CPU, GPU, detectors, per-process), Enrichments (embedding speeds), Storage (recordings per camera
  from the DB, free space, hours), Cameras (fps, ffmpeg / capture / detect CPU, probe info).
- **Settings:** UI, global configuration, per-camera sections, masks / zones editor, motion tuner, camera management
  (add wizard, delete, clone, On / Off / Disabled with drag-reorder), profiles, users and roles, notifications (register this
  device, test), Frigate+, maintenance (media sync, restart). Config editor (YAML, Monaco) with "save only" and "save and
  restart". Logs (frigate / go2rtc / nginx). Replay (debug replay session). Playground (tracked-object paths). Chat.
- **Design language:** light, quiet, thin dividers, single left rail, the camera image is the hero, severity colours (red
  alert, orange detection, yellow motion) used sparingly, everything keyboard-reachable. Compared with Arx's contract
  (light surfaces, restrained blue, map-first, Hebrew RTL with video never mirrored) the two agree on tone; Frigate is
  **camera-first** while Arx is **map-first**, so Arx should import the review / timeline / editor mechanics and keep its
  own floor-plan context (a review card should say which room and floor, and open the plan).
