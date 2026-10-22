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

Items 1, 2 and 3 were run live on 2026-10-22 and are closed in section 8 (profile switch, viewer role, Frigate's restream).

1. **Profiles**: define one profile in Frigate (owner) to run the profile switch live; it resets runtime toggles of every camera.
2. **Viewer account**: still unverified which routes a Frigate viewer may read (`/api/config`, `/api/openapi.json`, `/ws`).
3. **Restream**: this Frigate's go2rtc lists no streams; live video through Frigate's restream stays unverified here.
4. `put_settings` with an explicit reset to "default" (`None`) of a key the file does not hold would still be a 500 (`""` on a missing key) when
   the effective value differs from Arx's documented default (a global override). Rare; the route should compare with `inherited()` first.
5. The `review_summary` / single-review shapes above are not consumed by Arx; no change made.
6. `EXT-X-PROGRAM-DATE-TIME` is still absent (CR-029 section 7 stands).

## 6. Second run: the supervised first session driven through Arx itself (2026-10-21)

Sections 1-5 exercised the adapter and control code directly. This run drives the same instance **through Arx's own HTTP API** on a throwaway
local backend (isolated data directory, `SW_FRIGATE=1`, bootstrap administrator, one extra dev user bound to the `viewer` role), so the
permission model, class policy, first-write rule, read-back and change log are the ones an operator meets. Raw scrubbed log (gitignored):
`private-evidence/frigate-2026-10-20/live/ARX_SUPERVISED_SESSION_2026-10-21.md`. Frigate was written to only through Arx routes; the only direct
calls were read-only (`/api/config`, `/api/config/raw`, review and event reads) to compare before and after.

| # | Step | Result |
|---|---|---|
| S1 | Recorder added in TLS **pin** mode: the connection test returns the certificate fingerprint without sending credentials, the pin is saved, then the login | PASS. The first save answered `source_unavailable` (the probe took about 5.6 s on a direct run, its budget is 8 s); the second save succeeded (see open item 7) |
| S2 | Discover and read sync through Arx: status (version 0.18.0, `version_ok`), 7 cameras (6 online), reviews, review summary, motion activity, still picture, recordings and coverage, playback plan, export plan, storage, profiles, exports, cases, config schema, per-camera config, WebSocket (`connected`, 260 frames, 0 unknown) | PASS (19 reads, all 200 except PTZ read: 403 as designed) |
| S3 | RBAC: a `viewer` may read cameras but gets 403 on the policy (read and write), a camera switch (also with the class on), and a case create | PASS |
| S4 | All write classes off by default: an administrator's switch is `409 frigate_write_class_off` | PASS |
| S5 | `analytics`: `improve_contrast` off, read-back verified, undo from the change log | PASS, identical |
| S6 | `analytics`: named motion mask off, verified, undo | PASS, identical |
| S7 | `record`: `snapshots` on needs `confirm` (409 without), verified, undo needs `confirm` again | PASS, identical |
| S8 | `review`: mark reviewed with the mirror to Frigate, then unmark | PASS (Frigate's per-user flag true, then false) |
| S9 | `events`: retain on and undo, sub label set and undo, on a real tracked object | PASS (event document equal to before; the known `sub_label_score` residue is not visible in the fields compared) |
| S10 | `cases` + `exports`: first write refused unless `supervised: true`; case create, rename; export of a 5 s window straight into the case, rename, out of the case, back, delete (409 without `confirm`), case delete | PASS, exports 5 and cases 0 as at the start |
| S11 | `config` (persists in Frigate's YAML): first write refused unless supervised; `motion.threshold` 30 -> 31 and undo; zone create and undo | PASS |
| S12 | PTZ route | 403 as designed (`PTZ_RELEASED = False`) |

After every step the camera switches and settings of all 7 cameras, the exports and cases lists and a hash of the effective config were compared
with the baseline taken before the first write: identical each time. At the end the **raw YAML was byte-identical to the original saved on
2026-10-21** (SHA-256 equal), and all write classes were switched off again. On the throwaway instance 9 of the 13 first-write kinds are now marked
done (export create/rename/delete/assign, case create/rename/delete, config zone/settings).
Arx's change log held 22 rows, `applied` or `reverted`.

Not run: profile switch (the instance defines no profiles), PTZ, manual events (done through the adapter in W13/W14 and not repeated because a
manual event cannot be removed through Arx), Frigate's restream, a real Frigate viewer account.

### Open items added
7. **Connection probe budget**: adding a Frigate recorder can fail once with `source_unavailable` when the instance is slow to log in (about
   5.6 s for login, version, config, routes and restream list, against a probe deadline of 8 s). The error offers "save untested", which hides
   the cause. Consider a longer deadline for Frigate or a `timeout` outcome. No code change made here.
8. After adding a recorder the add-on must be restarted (`restart_required`) before `/api/v1/frigate/{id}/...` answers; the run did exactly that.

## 7. FRIGATE2-295: code-side closure of the open items (2026-10-22)

Code and fake-Frigate tests only (`tests/test_frigate2_295.py`); no live write and no live read were made for this section.

- **Item 4 (reset of a key the file does not hold)**: closed. `put_settings` resolves a `null` value against `FrigateConfig.inherited()` (the
  global section the key falls back to, else the documented default) before it compares with the effective value. A key that already shows the
  inherited value is not written (`changed: false`, no `config/set`); a key the file really holds is removed with `""` as before. The change log
  now holds effective values for a reset (`after` = the inherited value, not `null`), so the undo's stale check and read-back compare like with
  like. Residue: a camera that sets a key to exactly the inherited value keeps that explicit line after a reset (the effective state is correct).
- **Item 7 (probe budget)**: closed. The connection test of a Frigate recorder now has (a) a total budget of at least `FRIGATE_MIN_BUDGET_S`
  (30 s; `SW_PROBE_DEADLINE_S` can only raise it, other vendors keep the setting) and (b) a per-request timeout of `FRIGATE_STEP_TIMEOUT_S`
  (20 s, inside the same wall-clock deadline) instead of the 8 s of normal use, which one slow login could exceed. A network timeout (login,
  version, TLS handshake) now answers `timeout` ("the recorder did not answer in time") instead of `source_unavailable`; a refused connection, a
  5xx or a DNS failure stay `source_unavailable`. Fail-closed is unchanged: both outcomes may be saved untested only with `save_untested` and the
  typed word, and the audit row records the outcome. Normal operation (reads, polling, writes) keeps its 8 s timeouts.
- **Item 8 (restart after adding a recorder)**: not made hot, on purpose. Every recorder connection is overlaid into the process settings once at
  start (`connection_store.apply_at_startup`; `recorder_scope.settings_for` reads only that map), by the owner decision of CR-024 ("every
  recorder change waits for a restart"). Registering a connection at run time would mean mutating that start-up map under the autosync, event
  ingest, health, go2rtc and switch-protection workers of every vendor, and bypassing the identity and first-sync checks that run at start. That
  is not small, and it is not Frigate-specific. What changed: `/api/v1/frigate/{id}/...` for a Frigate recorder that is stored but not loaded
  now answers `409 recorder_pending_restart` (`retryable`, `details.restart_required`) with a message telling the operator to restart the
  add-on, instead of the generic `503 source_not_configured`. The save response already carried `restart_required: true`, and `/me` and
  `/health` report `connection_pending_restart`.

### 7.1 Items 1, 2 and 3: what a read-only live check needs (not guessed, not run)

All three need something only the owner can define. Arx must not create Frigate users, profiles or restream entries.

1. **Profiles (item 1)**. Owner defines ONE profile in Frigate's config (any name, for example a profile that changes only a harmless camera
   setting). Then a read-only check can verify: `GET /api/profiles` lists it, `GET /api/profile/active` (or the active profile field in the
   effective config) names the current one, and the Arx profile list shows the same name. The switch itself is a write that resets runtime
   toggles of every camera; it stays a separate, owner-attended step (record the toggles first, switch, switch back, compare).
2. **Viewer account (item 2)**. Owner creates a Frigate account with the `viewer` role and gives its credentials to `secrets/frigate_oliel.env`
   (a second variable pair; never echoed). A read-only check logs in once with it (one retry at most; Frigate rate-limits logins) and records,
   per route, only the HTTP status: `/api/version`, `/api/config`, `/api/openapi.json`, `/api/cameras` style reads Arx uses, `/api/review`,
   `/api/events`, `/api/exports`, `/api/profiles`, and the `/ws` upgrade. The result decides whether Arx's "viewer account" hint in the connection
   form is right and whether discover must tolerate a 403 on `/api/config` (the adapter already treats the camera count as optional).
3. **Restream (item 3)**. Owner either adds at least one stream to Frigate's go2rtc section or confirms an existing camera stream is restreamed.
   A read-only check then lists the restream names (`GET /api/go2rtc/streams`, as Arx's `frigate_restream` reads it), confirms which of them map
   to a camera key, and opens ONE RTSP DESCRIBE (no media) on the restream port with the connection's account to confirm the auth mode
   (`restream_auth`: none or account). Playing video end to end stays a browser check on the owner's screen.

## 8. FRIGLIVE2-295: the three live-unverified items, run live (2026-10-22)

**Branch:** `pilot/FRIGLIVE2-295` (from `release/2121` @ `90cd7d9ae`). **Instance:** the same Frigate 0.18.0-77a66e7. **Authorization:** owner, in
chat on 2026-10-22 (all remaining Frigate work, writes and config changes approved in advance; same rules: original recorded first, one action at a
time, verified, restored, redacted evidence). **Arx:** a throwaway local backend of this branch (isolated data directory, `SW_FRIGATE=1`, no
go2rtc configured, so no stream was created anywhere), the recorder added through `POST /recorders` in TLS **pin** mode. Raw scrubbed log
(gitignored): `private-evidence/frigate-2026-10-20/live/FRIGLIVE2_ACTIONS_LOG.md` and `viewer_route_matrix_2026-10-22.json`. The raw YAML was
saved again before the first write (gitignored `secrets/`); at the start it was byte-identical to the 2026-10-21 original.

| # | Step (live) | Original state recorded | Result | Restored / verified |
|---|---|---|---|---|
| A1 | Connection test through Arx, pin mode, no pin | - | `tls_pin_required` + fingerprint, 2.8 s | read only |
| A2 | Connection test with the pin (FRIGATE2 budget) | - | `ok`, 2.2 s (no `timeout` / `source_unavailable` this time) | read only |
| A3 | Add the recorder (admin account) | empty Arx | 201, `restart_required: true` | throwaway Arx only |
| A4 | `/frigate/nvr-1/{status,cameras,profiles}` before the restart | - | **404 `not_found`** (expected 409): fix G1 below; after the fix, on a fresh data directory: **409 `recorder_pending_restart`**, `retryable`, `details.restart_required` | read only |
| B1 | Baseline of every runtime toggle of the 7 cameras (93 values), effective-config hash, raw YAML | yes | - | - |
| B2 | Define ONE profile `arx_test` (`config/set`, `requires_restart: 0`): top-level `profiles.arx_test.friendly_name` + test camera `profiles.arx_test.motion.improve_contrast: false` | yes | 200; `/api/profiles` lists it at once (no restart needed); Arx lists it; no runtime toggle changed | - |
| B3 | Through Arx: classes `analytics` + `profile` on; a runtime switch on a SECOND camera (`improve_contrast` off, verified); switch without `confirm` | - | 409 `confirmation_required` | - |
| B3 | Through Arx: `PUT /frigate/nvr-1/profile {"profile": "arx_test", "confirm": true}` | - | 200, `verified: true` in 0.8 s; Frigate `active_profile: arx_test`; **the second camera's runtime switch was reset to its config value** (false -> true) and the test camera took the profile override (true -> false), nothing else changed: the documented "Frigate clears the runtime toggles on a switch" holds | - |
| B4 | Undo of the runtime switch the profile already reset | - | **409 `frigate_change_stale`** (correct: Frigate no longer shows the state that change left; nothing sent) | - |
| B4 | Undo of the profile switch (without, then with `confirm`) | - | 409 `confirmation_required`, then 200 `verified`; `active_profile: null`; all 93 toggles equal to the baseline | yes |
| B5 | Restore: `config/set` `profiles: ""` and the camera's `profiles: ""` | - | 200; **raw YAML byte-identical**, effective-config hash equal, `/api/profiles` empty, Arx lists none | yes |
| C1 | Create ONE Frigate user `arx_viewer_test`, role `viewer` (random password, kept only in a gitignored secrets file) | users: 1 | 200, users: 2 | deleted in F1 |
| C2 | Direct route matrix with the viewer (one login, statuses only) | - | table below | read only (two refused writes) |
| C3 | Arx connection test + save with the viewer account | - | test `ok` 3.0 s; saved, restart | throwaway Arx only |
| C4 | Every Arx read route with the viewer account (status, cameras, reviews, summary, activity, still, recordings, summary, playback, export plan, storage, policy, control, profiles, exports, cases, config schema, camera config, recorder health) | - | all 200 except **`/frigate/nvr-1/storage`: 503 `source_forbidden`** (Frigate 403 on `/api/recordings/storage`): fix G2; after the fix 200 with `usage_unavailable: "role_limited"`; the health card is complete (its storage part already treated the 403 as a named part); WebSocket `connected` | read only |
| C5 | A write through Arx with the viewer account (`analytics` on, `improve_contrast` off) | - | **409 `frigate_write_forbidden`** (`details.status: 403`), change-log row `failed`, Frigate unchanged; class switched off again | nothing changed |
| D1 | Add ONE stream to Frigate's OWN go2rtc: `PUT /api/go2rtc/streams/<test camera>?src=<that camera's own input>` (runtime; not the intercom go2rtc, no `smplwise_` stream touched) | streams: none | 200; `/api/go2rtc/streams` lists it with 1 producer; **the YAML is not changed** by this runtime API | removed in D4 |
| D1 | Arx discover + status | `live.mode: still`, `no_streams` | `live.mode: restream`, `cameras_live: 1`, `reason: partial`, `auth: none` | - |
| D2 | Arx's own plan + `frigate_restream.source_url` for that camera | - | plan `{main, sub}` = the camera key (`live.streams`); URL `rtsp://<frigate host>:8554/<camera>` with no credentials | - |
| D2/D3 | Video through that URL (ffprobe / ffmpeg on the workstation, no credentials) | - | DESCRIBE + SETUP OK without credentials (so `restream_auth: none` is right for this instance): H.264 2560x1440; 54 frames decoded in 12 s; one JPEG frame (184 kB) | read only |
| D4 | Restore: `DELETE /api/go2rtc/streams/<test camera>` | - | 200; streams: none; YAML and effective config equal to the baseline; Arx back to `still` / `no_streams` | yes |
| E | FRIGATE2 item 4 through Arx (`config` class, supervised): `motion.threshold: null` on the test camera, which does not hold the key (inherits 30) | key absent | 200 `changed: false`, `verified`, no `config/set` sent, YAML unchanged; then 30 -> 31 and `null` again: the key is removed, YAML **byte-identical** | yes |
| F1 | Delete the test viewer user; final comparison | - | users: 1; raw YAML byte-identical to the 2026-10-21 original; effective-config hash, all 93 runtime toggles, profiles (none) and go2rtc streams (none) equal to the start | yes |

**Viewer route matrix (Frigate 0.18.0, role `viewer`):**

| Allowed (200) | Refused (403) |
|---|---|
| `/api/version`, `/api/stats`, **`/api/config`**, **`/api/openapi.json`**, `/api/go2rtc/streams`, `/api/labels`, `/api/sub_labels`, `/api/profile`, `/api/profiles`, `/api/events` (+ `/{id}`, thumbnail), `/api/review` (+ `/{id}`, `/summary`, `/activity/motion`), `/api/{cam}/recordings` (+ `/summary`), `/api/{cam}/latest.jpg`, `/vod/.../index.m3u8`, `/api/{cam}/ptz/info`, `/api/exports`, `/api/cases`, `/api/config/schema.json`, range `clip.mp4`, **`/ws`** (upgrade OK, frames delivered) | **`/api/recordings/storage`**, **`/api/profile/active`**, `/api/users`, `/api/config/raw`, and every write tried (`PUT /api/camera/{cam}/set/...`, `PUT /api/camera/*/set/profile`): "A user with the admin role is required" |

So the CR-029 section 7 assumptions are answered: a viewer **can** read `/api/config`, `/api/openapi.json` and `/ws` (discovery and
`routes_known` work with a viewer account); it cannot read the storage usage or the separate active-profile route; and **every Frigate write
class needs an admin-role account** (with a viewer Arx answers `frigate_write_forbidden`, named and logged, nothing changes).

### 8.1 Fixes made (code + tests)

| Fix | Live finding | Change | Tests |
|---|---|---|---|
| G1 | The FIRST recorder (`nvr-1`) added as Frigate after the start answered 404 `not_found` instead of FRIGATE2's 409 `recorder_pending_restart`: the process runs `nvr-1` with its start-up connection (default vendor; a placeholder host on a developer backend, an empty or old host in the add-on), so the "no host" test missed it | `frigate_io.adapter_for`: pending when the process does not hold a **Frigate** connection for that id (no host OR another vendor) and the stored row is an enabled Frigate one | `test_friglive2_295.py` (5) |
| G2 | `/frigate/{rid}/storage` failed as a whole (503 `source_forbidden`) with a viewer account | a 403 on `/api/recordings/storage` is a role limit: 200 with `cameras: []` and `usage_unavailable: "role_limited"`, policy and retention still served; a 401, outage or pin problem still fail | `test_friglive2_295.py` (3) |
| G3 | `/api/profile/active` is admin-only | the fallback read (used only when `/api/profiles` carries no `active_profile`) treats a 403 as "unknown" instead of failing; a 401 still fails | `test_friglive2_295.py` (2) |

### 8.2 Behaviour measured, no code change

- **Profiles**: defined and removed with `config/set` and `requires_restart: 0`; Frigate lists a new profile at once. Activating a profile resets
  runtime switches of other cameras to their config values and applies the profile's overrides; deactivating it returns every camera to its base
  config. A change-log row of a runtime switch that a later profile switch reset stays `applied` in Arx's log, but its undo is refused as
  `frigate_change_stale` (nothing is sent) - correct and fail-safe; the row's status is not rewritten. Residue in Frigate: `/api/profiles`
  keeps `last_activated: {"arx_test": <time>}` after the profile was removed (runtime state, not in the YAML).
- **Restream**: Frigate's runtime `PUT /api/go2rtc/streams/{name}?src=` adds a stream without touching the YAML (it would not survive a
  Frigate restart); a permanent restream is a `go2rtc.streams` section in Frigate's YAML (restart needed) - an owner decision. The restream on
  this instance needs no RTSP credentials.
- **Probe budget (FRIGATE2 item 7)**: two connection tests took 2.2 s and 3.0 s (6 calls each); no timeout seen, so the longer budget was not
  exercised by a slow login today.
- **Not run:** the browser leg of live video (Arx's go2rtc -> WebRTC/MSE in the player): the throwaway Arx had no go2rtc of its own, and the
  lab go2rtc was not used because its `smplwise_nvr-1_*` names belong to the lab's own Arx. The source Arx's go2rtc would pull was played
  instead (D2/D3). PTZ: no PTZ camera.

### 8.3 Tests

| Run | Where | Result |
|---|---|---|
| All 15 Frigate test files (`test_friglive2_295.py`, `test_frigate2_295.py`, `test_frigate_*.py`) at `239ba72c2` | runner, two batches | 206 + 117 = **323 PASS, 0 FAIL** |
| Live checks G1 and G2 after the fix | owner's instance, throwaway Arx of this branch | G1: 409 `recorder_pending_restart`; G2: 200 `usage_unavailable: role_limited` |

Full backend suite: NOT_RUN on this branch (only the Frigate files).
