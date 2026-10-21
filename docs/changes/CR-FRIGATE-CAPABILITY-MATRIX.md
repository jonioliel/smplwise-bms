# CR-FRIGATE - capability matrix: Frigate 0.18 vs Arx (FRIGATE-295)

**Status:** working document of task FRIGATE-295 (branch `pilot/FRIGATE-295`, from `integ/293`). Builds on CR-029 (sections 1-14) and the
supervised runbook `docs/operations/FRIGATE_SUPERVISED_VERIFICATION_HE.md`. Product default unchanged: the add-on option
`frigate_enabled` stays `false`, every Frigate write class stays OFF per recorder.

## 1. Sources

| Source | What it settled |
|---|---|
| Frigate's own OpenAPI at tag `v0.18.2` (`docs/static/frigate-api.yaml`, 167 paths); method + path list kept as `smplwise_vms/backend/tests/fixtures/frigate_openapi_0_18_2_routes.json` | which routes exist, with which method |
| Frigate source at `v0.18.2`: `frigate/api/{app,camera,event,export,media,review}.py`, `frigate/api/defs/request/*`, `frigate/comms/dispatcher.py`, `frigate/comms/ws.py`, `frigate/review/maintainer.py`, `frigate/config/profile_manager.py`, `frigate/jobs/export.py`, `frigate/config/camera/updater.py` | request bodies, answer shapes, async behaviour, what a 200 means |
| Release list (GitHub): 0.18.0 2026-09-12, 0.18.1 2026-10-13, 0.18.2 2026-10-15 | the owner's instance read 0.18.0 on 2026-10-05; the OpenAPI route sets of 0.18.0, 0.18.1 and 0.18.2 are identical (diffed) |
| docs.frigate.video (0.18): HTTP API index, profiles, MQTT topics | cross-check only; the source above wins where they differ |
| The owner's instance, read-only capture of 2026-10-05 (`private-evidence/frigate-oliel/raw`, not in git) | `/api/profiles` and `/api/profile/active` shapes as served |

## 2. Wire-shape findings (fixed in phase 1, commit `fb6bc5fa1`)

| # | Arx sent (guessed in F2 / F2b) | Frigate 0.18.2 | Effect before the fix | Fix |
|---|---|---|---|---|
| W1 | clear a sub label with `{"subLabel": null}` | `subLabel` is a required string (max 100); `""` clears (`set_sub_label`) | undo of a sub label = 422, change stuck | sends `""`; test asserts the exact bodies |
| W2 | `DELETE /api/export/{id}` | no such route; `POST /api/exports/delete {"ids": [...]}` | export delete and the undo of a create = 405 | bulk route with exactly ONE id Arx owns |
| W3 | export body `{"name", "playback": "realtime"}` | `ExportRecordingsBody {source: recordings\|preview, name, export_case_id, chapters}`; answer **202** `{export_id, status: "queued"}`; the row appears in `/api/exports` only when the job starts | `playback` silently ignored; read-back right after the create missed a queued export -> `unverified` | `{"name", "source": "recordings"}`; read-back falls back to `GET /api/jobs/export/{id}` (control read); answer carries `queued` |
| W4 | `/api/profiles` read as a list or as a dict of names | `{"profiles": [{"name","friendly_name"}], "active_profile", "last_activated"}` (also seen live 2026-10-05) | the keys `profiles`, `active_profile`, `last_activated` were offered as profile names | parse the 0.18 document; one GET gives names and active |
| W5 | `/api/profile/active` read as `name` / `profile` / `active` | `{"active_profile": str\|null}` | the active profile was never seen (`active: null` always): the profile switch logged a wrong "before", undo targeted `none` | read `active_profile` |
| W6 | sub label read back on the next GET | applied asynchronously (event metadata publisher) | a correct write could log `unverified` | up to 4 reads, 0.5 s apart (reads only; the write is never repeated) |

Confirmed as built (no change): `PUT /api/camera/{cam}/set/{feature}` `{"value": "ON"\|"OFF"}` (admin role), `PUT /api/camera/*/set/profile`
`{"value": name\|"none"}` (the only `*`), `POST /api/reviews/viewed {"ids"}` / `DELETE /api/review/{id}/viewed`, `POST\|DELETE /api/events/{id}/retain`,
`POST /api/events/{cam}/{label}/create` (`EventsCreateBody`), `PUT /api/events/{id}/end {"end_time"}`, `PATCH /api/export/{id}/rename {"name"}`,
`POST /api/cases {"name","description"}` (answer = the case row with `id`), `PATCH /api/cases/{id}`, `DELETE /api/cases/{id}`,
`PUT /api/config/set {"requires_restart": 0, "update_topic": "config/cameras/<cam>/<section>", "config_data"}` (sections = `CameraConfigUpdateEnum`;
`None` / `""` deletes a key), `GET /api/{cam}/start/{s}/end/{e}/clip.mp4` and `GET /api/events/{id}/clip.mp4` (fragmented MP4 streamed by ffmpeg,
`video/mp4`, no length), WebSocket frames `{"topic","payload"}` with `reviews` payload = JSON string `{"type": new|update|end, "before", "after"}`
(the Arx parser already decodes a string payload). `GET /api/review` has no default `reviewed` filter in 0.18.2 (the CR-029 section 14 worry is closed).

Behaviour that matters for verification (0.18): `camera_set` answers `{"success": true}` **before** the handler runs; the handler only LOGS a refusal
(ON for an item disabled in the YAML, an unknown zone). So a 200 proves nothing: Arx's read-back of `/api/config` (same in-memory config object the
dispatcher mutates) is the proof, and `unverified` is the honest state. Runtime toggles are **persisted** across Frigate restarts in 0.18
(`dispatcher.apply_runtime_state`), unlike older versions: an Arx toggle that is not undone stays. The reviewed flag is **per Frigate user**
(`UserReviewStatus`): the mirror marks items for the Arx account only.

## 3. Capability matrix

Legend: **built** = in Arx and tested against the fake; **verified** = also exercised on the owner's instance; **gap** = not in Arx;
**out** = deliberately not offered (reason given).

| Area | Frigate 0.18 offers | Arx today | Status / plan |
|---|---|---|---|
| Connection, auth | `POST /api/login` JWT cookie (port 8971, TLS self-signed), roles admin / viewer / custom per camera | stored connection (AES-GCM), TLS pin / verify / trust, one login + backoff | built; F1 read verified 2026-10-05 (0.18.0). Viewer account: gap in evidence only (owner creates one) |
| Version / capability discovery | `/api/version`, `/api/config`, `/api/openapi.json`, `/api/config/schema.json` | discovery, `features{}`, `routes_known`, schema check for the config class | built; phase 1 adds a test that every Arx call exists in the 0.18.2 route list |
| Cameras mapping | config keys, `enabled`, friendly names, zones, labels | import as Arx cameras (synthetic channel, `source_ref` = key), disabled in Frigate = disabled row, never deleted | built, verified read 2026-10-05 |
| Live video | Frigate's go2rtc restream (`/api/go2rtc/streams`, RTSP 8554), MSE / WebRTC in Frigate UI | Arx pulls the restream into its own `smplwise_` go2rtc streams (TKFRIGLIVE), still fallback | built; live restream NOT verified on the owner's install (port mapping / RTSP auth unknown) |
| Snapshots | `latest.{ext}`, recording snapshot, event `snapshot.jpg`, `snapshot-clean.webp`, review thumbs | latest still (cached), review / event thumbnails | built; `snapshot-clean.webp` gap (low value) |
| Review items (alerts / detections) | `/api/review`, `/review/summary`, `/review/activity/motion`, per-user reviewed, WS `reviews` | poll + WS, mirror into Arx events, per-user reviewed in Arx + mirror to Frigate (class `review`) | built; poll verified read; WS `reviews` payload confirmed from source, not live |
| Tracked objects / events | `/api/events` (filters), `/events/{id}`, retain, sub label, description, false positive, Frigate+ | read, retain + sub label (class `events`), manual events create / end | built; W1/W6 fixed. Description / genai / Frigate+ / plates: **out** (owner: no face / LPR / genai) |
| Clips | `GET /api/{cam}/start/end/clip.mp4`, `/events/{id}/clip.mp4`, `/review/{id}/clip.mp4`, preview mp4 / gif | range clip and event clip behind the first-supervised-read gate | built; **phase 3 adds the review-item clip** (closed items <= 1 h only). Preview gif / mp4: gap (UI hover, later) |
| Recordings / playback | `/{cam}/recordings`, summary, VOD HLS `/vod/...`, `recordings/unavailable` | coverage, density, HLS playlist rewrite through Arx | built, verified read 2026-10-05; `EXT-X-PROGRAM-DATE-TIME` absent (anchors unproven, CR-029 section 7) |
| Exports and cases | queued export jobs, rename, bulk delete, bulk reassign to a case, cases CRUD, case zip download | create / rename / delete own exports, cases CRUD (own), list | built; W2/W3 fixed; **phase 3 adds export -> case assignment and a case on create**. Batch export, case zip download: gap (later) |
| Zones and object filters | zones in config (`/api/config/set`), runtime `set/zone/{name}`, masks `set/motion_mask|object_mask/{name}` | zone CRUD + curated settings (class `config`, FRGS) | built; **phase 3 adds runtime switches of one named zone / motion mask / object mask** (class `analytics`) |
| Runtime toggles | `set/{feature}`: enabled, detect, motion, recordings, snapshots, audio, audio_transcription, notifications, review_alerts, review_detections, object/review_descriptions, improve_contrast, ptz_autotracker, birdseye, birdseye_mode, motion_contour_area, motion_threshold | 12 boolean switches in classes `analytics` / `record` | built. `audio_transcription`, `*_descriptions` (genai): out (owner decision). `motion_threshold` / `contour_area` runtime ints: covered persistently by the config class; runtime variant not added |
| Profiles | named overrides, `set/profile`, `profile/state` | manual switch (class `profile`), auto on alarm state (off / suggest / apply) | built; W4/W5 fixed. The owner's instance had NO profiles on 2026-10-05 -> live step NOT_RUN unless he defines one |
| Notifications | Frigate web push (`/notifications/*`), MQTT | Arx notifications from alerts (rules), not Frigate's push | built; Frigate's own push: out (Arx is the notifier) |
| PTZ | `/{cam}/ptz/info`, WS `<cam>/ptz` commands, autotracker | plumbing behind `PTZ_RELEASED = False` | out until a PTZ camera exists (owner 2026-10-20: "later") |
| Retention / storage | `/api/recordings/storage`, `/api/stats` storage, config `record.*.retain` | storage usage, policy, CR-026 health card | built read; retention edit stays in Frigate (no Arx write) |
| Stats / health | `/api/stats`, `/api/stats/history`, `/metrics`, `/nvinfo`, `/vainfo` | CR-026 card: detectors, fps, skipped, reconnects, storage, cert expiry | built, verified read 2026-10-05. Hardware accel facts (`vainfo` / `nvinfo`): gap (diagnostics only) |
| Config editing | `/api/config/set` (YAML file, validated, restart flag), `/api/config/save` raw | config class: zones + curated settings, read back, undone from the change log | built (FRGS); `config/save`, restart, camera add/remove, go2rtc stream edits: **out** (blast radius) |
| Search | `/api/events/search` (text / similarity), motion search jobs, `timeline` | not built | gap: read-only search route (later phase, needs a UI) |
| Users | `/api/users*` | never | **out** (identity rules: no account management from Arx) |
| Delete recordings / events / reviews | routes exist | never | **out** (AGENTS.md: no recording deletion) |

## 4. Phases on this branch

| Phase | Content | Tests |
|---|---|---|
| 1 | W1-W6 wire fixes; fake Frigate answers with the 0.18.2 shapes; `test_frigate_wire_0182.py` (every call vs the 0.18.2 route list) | see the report |
| 2 | this matrix; runbook section 0 (H1 / H2 are resolved in code since 2.2.1 / F2b), 0.18 behaviour notes | doc |
| 3 | named zone / mask runtime switches; export -> case assignment (+ case on create); review-item clip | `test_frigate_295_features.py` |
| 4 | live supervised session on the owner's instance | evidence in `private-evidence/frigate-2026-10-20/` |

## 5. Rollback

Code: run the previous version (no migration on this branch). On a live instance every Arx write is in `frigate_changes` and undone from there;
runtime toggles persist across Frigate restarts in 0.18, so an un-reverted toggle stays until undone.
