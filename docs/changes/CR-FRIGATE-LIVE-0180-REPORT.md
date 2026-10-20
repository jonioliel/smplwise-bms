# Frigate live validation on the owner's instance - evidence and compatibility report (FRIGLIVE-295)

**Date:** 2026-10-20/21 (Israel night). **Branch:** `pilot/FRIGLIVE-295` (from `pilot/FRIGATE-295` @ `81f53cf02`). **Instance:** the owner's Frigate
**0.18.0-77a66e7**, 7 cameras, 2 Coral (edgetpu) detectors, MQTT on, authenticated HTTPS port with a self-signed certificate (adapter TLS mode
`trust` for the session). **Account:** the owner's admin account (no viewer account exists). **Authorization:** owner, in chat (full testing on his
systems, writes and config changes allowed with: original recorded first, one action at a time, verified, rolled back, redacted evidence).
Raw evidence (scrubbed, gitignored): `private-evidence/frigate-2026-10-20/live/` (`ACTIONS_LOG.md`, wire-shape skeletons, the live 0.18.0 route
list). The original Frigate YAML was saved before the first write (gitignored `secrets/`, it holds credentials). No host, address, user name,
password or token appears in this document or in git.

## 1. Result in one table

| # | Area | Frigate route(s) | Result | Rolled back / identical |
|---|---|---|---|---|
| R1 | Version, discovery | `/api/version`, `/api/config`, `/api/openapi.json`, `/api/go2rtc/streams` | PASS (0.18.0, `version_ok`, routes known) | read only |
| R2 | Health (CR-026) | `/api/stats`, `/api/recordings/storage` | PASS (1 recordings mount, 7 channels, 2 detectors ~9 ms) | read only |
| R3 | Review items, events, motion, summary | `/api/review`, `/api/review/{id}`, `/api/events`, `/api/review/activity/motion`, `/api/review/summary` | PASS (200 items / 24 h, all normalized; severities alert + detection) | read only |
| R4 | Pictures | `latest.jpg`, review thumb, event thumbnail, recording snapshot | PASS | read only |
| R5 | Recordings, VOD | `/{cam}/recordings`, `/recordings/summary`, `/vod/.../index.m3u8`, init segment | PASS (no `EXT-X-PROGRAM-DATE-TIME`, as in October) | read only |
| R6 | Control / config reads | `/api/profiles`, `/api/profile/active`, `/api/exports`, `/api/cases`, `/api/config/schema.json`, `ptz/info` | PASS (schema check: no Arx field missing) | read only |
| W1 | Runtime switch (analytics) | `PUT /api/camera/{cam}/set/improve_contrast` | PASS after fix F1 (read-back 0.1 s) | yes: config + YAML identical |
| W2 | Named motion mask | `PUT .../set/motion_mask/{name}` | PASS | yes: identical |
| W3 | Named object mask | `PUT .../set/object_mask/{name}` | PASS (also flips the matching `objects.filters.<label>.mask.global_object_mask_N`) | yes: identical |
| W4 | Record class | `PUT .../set/snapshots` (OFF -> ON -> OFF) | PASS | yes: identical |
| W5 | Reviewed mirror | `POST /api/reviews/viewed`, `DELETE /api/review/{id}/viewed` | PASS (per-user flag) | yes: list row identical |
| W6 | Retain | `POST` / `DELETE /api/events/{id}/retain` | PASS | yes: event document identical |
| W7 | Sub label | `POST /api/events/{id}/sub_label` `{"subLabel": "arx-test"}` then `""` | PASS (`""` clears to null) | effective yes; residue: `data.sub_label_score: null` added (see 3.6) |
| W8 | Clip reads | `/api/{cam}/start/{s}/end/{e}/clip.mp4`, `/api/events/{id}/clip.mp4`, `/api/review/{id}/clip.mp4` | PASS: `video/mp4`, no length header, fMP4 `ftyp`; range clip without recordings -> fix F3 | read only |
| W9 | Cases | `POST /api/cases`, `PATCH /api/cases/{id}`, `DELETE /api/cases/{id}` | PASS | yes: cases list identical (0) |
| W10 | Exports | `POST /api/export/{cam}/start/{s}/end/{e}` (202, job), `/api/jobs/export/{id}`, rename, `POST /api/exports/reassign` (to a case, to null, back), `POST /api/exports/delete` | PASS after fix F2 | yes: exports document identical (5) |
| W11 | Config setting | `PUT /api/config/set` `motion.threshold` 30 -> 31 -> undo | PASS after fix F5 | yes: config + YAML identical |
| W12 | Config zone + zone switch | `config/set` create zone, `PUT .../set/zone/{name}` OFF/ON, delete | PASS after fix F4 (first attempt: 500, nothing written) | yes: config + YAML identical |
| W13 | Manual event | `POST /api/events/{cam}/{label}/create`, `PUT /api/events/{id}/end` | PASS (label `arx_test`, an open event, ended) | test event and its review item removed afterwards (cleanup only, outside Arx's allow-list) |
| W14 | WebSocket `reviews` frame | `/ws` passive listen during W13 | PASS: one `reviews` frame `{type: "update", before, after}` with a JSON-string payload; Arx `parse_frame` decoded it | listen only |
| - | Profile switch | `PUT /api/camera/*/set/profile` | **NOT_RUN**: the instance has no profiles (`{"profiles": [], "active_profile": null}`) | - |
| - | PTZ | `/ws` `<cam>/ptz` | **NOT_RUN**: no PTZ camera; `PTZ_RELEASED = False` | - |
| - | Viewer role | - | **NOT_RUN**: no viewer account (Arx never creates Frigate users) | - |
| - | Restream live video | `/api/go2rtc/streams` | **NOT_RUN**: Frigate's go2rtc lists no streams on this instance (its `go2rtc` section is empty), so `restream: false` is correct | - |

Final state after the session: effective `/api/config` hash and raw YAML hash equal to the baseline taken before the first write; exports 5,
cases 0, the test camera's switches as at the start.

## 2. Version differences (live 0.18.0 vs the 0.18.2 the code was reviewed against)

- **Route list:** the live `/api/openapi.json` has 179 method+path pairs, **identical** to the 0.18.2 list kept in
  `tests/fixtures/frigate_openapi_0_18_2_routes.json` (paths relative to `/api`, parameter names included). `info.version` reads `0.1.0` (not the
  Frigate version; never use it).
- **Shapes that differ from what the fake / code assumed** (whether 0.18.2 also differs is not proven; the code now reads both):
  - `GET /api/exports` rows name the case **`export_case`**; the job document and request bodies use `export_case_id` (fix F2).
  - `GET /api/review/{id}` (single item) has **no** `has_been_reviewed`; only the list rows carry the per-user flag. Arx does not read it.
  - `GET /api/review/summary` is a map of day -> counts plus `last24Hours` (the fake served only `last24Hours`). Arx does not consume it.
  - `GET /api/events` rows carry `data.{attributes, average_estimated_speed, box, max_severity, path_data, region, score, ...}`; Arx reads only
    `retain_indefinitely`, `sub_label`, `camera`, `label`, times.
  - Zones and masks in the effective config are mappings `name -> {coordinates, enabled, enabled_in_config, friendly_name, raw_coordinates}`;
    a zone also shows `color, distances, filters, inertia, loitering_time, objects` with defaults. Object masks are mirrored per label as
    `objects.filters.<label>.mask.global_object_mask_N`.
- **Behaviour not in the published docs** (measured):
  - Frigate's nginx keeps a **~5 s micro-cache of `/api/*`** (`X-Cache-Status: HIT`); `X-Cache-Bypass: 1` skips it (`BYPASS`). Fix F1.
  - `config/set` deletes a key given as `""` with Python `del`: `""` for a key the YAML file does not hold -> **500** "Error updating config" and
    the file is left unchanged (source `frigate/util/builtin.update_yaml`, v0.18.0). Fix F4.
  - `/api/config` is the **effective** config (unset keys show defaults / inherited values). Fix F5.
  - A range clip over a window without recordings -> **400** `{"message": "No recordings found for the specified time range"}`. Fix F3.
  - Manual events: the review item's `data.objects` holds `"<label>: <sub label>"`; the review stays open for a while after the event ends.
  - Host clock about 26 s behind the workstation (`Date` header), as in October.

## 3. Fixes made in code (with tests)

| Fix | What was wrong on the live instance | Change | Tests |
|---|---|---|---|
| F1 | Every read-back after a write saw the cached old state for 5.5-6.1 s: every toggle / retain / reviewed / export change was logged `unverified`, and an undo right after a change would have been refused as `frigate_change_stale` | `FrigateHttp.get(..., fresh=True)` sends `X-Cache-Bypass: 1`; every read in `FrigateControl` and `FrigateConfig` (the reads that decide about a write) uses it; polling, discovery and pictures keep Frigate's cache | `test_frigate_live_0180.py` (3) |
| F2 | `list_exports` read `export_case_id`: an export's case was never seen | `_case_of` reads `export_case`, then `export_case_id`; the fake serves `export_case` | `test_frigate_live_0180.py` (1); 2 existing tests updated |
| F3 | A clip over a window without recordings was a generic `nvr_rejected` | the 400 with that message is `409 no_recording` | `test_frigate_live_0180.py` (1) |
| F4 | The first zone create answered 500 (it sent `""` for `inertia`, `loitering_time`, empty `objects`) | `write_zone` sends `""` only for a field the effective config proves the file holds (a non-default value); removing the camera's last zone removes the `zones` key (no `zones: {}` left) | `test_frigate_live_0180.py` (3); `test_frigate_config.py` (2 assertions updated) |
| F5 | The undo of `motion.threshold` 30 -> 31 wrote `threshold: 30` into the YAML (effective state equal, file one line longer) | undo of a camera setting whose old value equals what the key inherits (global section, else Frigate's default) REMOVES the key; if the read-back then disagrees the value is written once as a correction | `test_frigate_live_0180.py` (3) |

Fake Frigate (`tests/fixtures/fake_frigate.py`) gains the measured behaviour as knobs: `micro_cache`, `strict_delete`, `effective_defaults`,
`clip_no_recordings` (off by default; the new tests switch them on).

### 3.6 Known residue (not fixable through the API)
Setting and clearing a sub label adds `data.sub_label_score: null` to that event (Frigate's own handler). The visible state (`sub_label`) is
restored; the extra key is harmless metadata. One event on the test camera carries it.

## 4. Tests

| Run | Where | Result |
|---|---|---|
| All 13 Frigate test files (`test_frigate_*.py`, 302 tests) at `a38e18023` | runner, `run_remote.sh backend` (no gate pending) | 300 PASS, 2 FAIL (test-side: an event id the fake does not know; an assertion on the old `zones: {}` shape) |
| `test_frigate_live_0180.py` + `test_frigate_config.py` after the test fixes, at `d78f66348` | runner | 28 PASS, 0 FAIL (the 2 earlier failures included; the other 11 files are unchanged since the 300-PASS run) |
| Live session | owner's instance | 6 read groups PASS (36 calls), 14 write / read actions PASS, 4 NOT_RUN (profile, PTZ, viewer, restream) |

Full backend suite: NOT_RUN on this branch (only the Frigate files).

## 5. Open items

1. **Profiles**: define one profile in Frigate (owner) to run the profile switch live; it resets runtime toggles of every camera.
2. **Viewer account**: still unverified which routes a Frigate viewer may read (`/api/config`, `/api/openapi.json`, `/ws`).
3. **Restream**: this Frigate's go2rtc lists no streams; live video through Frigate's restream stays unverified here.
4. `put_settings` with an explicit reset to "default" (`None`) of a key the file does not hold would still be a 500 (`""` on a missing key) when
   the effective value differs from Arx's documented default (a global override). Rare; the route should compare with `inherited()` first.
5. The `review_summary` / single-review shapes above are not consumed by Arx; no change made.
6. `EXT-X-PROGRAM-DATE-TIME` is still absent (CR-029 section 7 stands).
