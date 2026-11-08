# CAMERA-STREAM-SOURCES-2410 - a camera's video source, and cameras without a recorder

Branch `pilot/CAMERA-STREAM-SOURCES-2410` (from `main` @ d3aa3072c, v2.40.7). Target release 2.41.0 - the lead bumps the version,
writes the changelog and runs the gate. No push, no merge, no tag. Code and tests only: no device, go2rtc, camera or Home Assistant
was contacted (go2rtc is the real adapter over `httpx.MockTransport`; names resolve through a fixed table; addresses are TEST-NET).

## What

1. **Video source per camera** (camera screen › הגדרות מצלמה › מקור וידאו, holders of `system.configure`):
   - **מהמקליט** (default, no row): today's behaviour, byte for byte - nothing in the new code touches such a camera.
   - **כתובת ידנית**: an RTSP address for the main stream and one for the sub stream; one filled address serves both. Live video and
     snapshots then come from those addresses through go2rtc streams `smplwise_cam_<camera id>_<main|sub>`.
2. **Add camera without a recorder** (הגדרות › אבטחה › NVR › "מצלמות ללא מקליט", `system.configure`): name, area, main / sub RTSP.
   Such a camera is a catalogue camera of the pseudo-recorder `standalone` and appears wherever a camera appears: the camera list
   (`GET /cameras`), the live wall, the area screens' camera cards (`GET /devices/camera-card/sources` groups it under
   "מצלמות ללא מקליט"), the camera screen, map placement. Live + snapshots only.
3. **Test stream** button in both dialogs: one frame through a throwaway go2rtc stream - a small preview, the resolution and the codec,
   or a fixed Hebrew error (wrong user / password, no answer, path not found, no picture, video service unavailable).
4. **Health**: a manual source that stops working stays as it is (no fallback to the recorder) and raises the notification
   `camera.source` ("מקור וידאו ידני לא עובד", device faults, managers, inbox) until it works again; the camera screen shows the state.

## Owner decisions (08.11, all final)

| # | Decision | Where |
|---|---|---|
| 1 | Credentials in the URL stored ENCRYPTED like the recorder password; never returned (masked URL + `has_password`); an edit with the mask unchanged keeps the stored secret | `connection_store.seal_camera_source` (same key file / AES-256-GCM / `v1:`; AAD `camera_source|<camera id>|<profile>`); `camera_sources.mask` / `merge` |
| 2 | Without a recorder = live + snapshots only; the UI hides / greys recording, playback, recorded days, NVR events, NVR reboot with a short Hebrew explanation | `camera_sources.view().capabilities`; camera screen hides the recorder sections and the "הקלטות" button and shows "מצלמה ללא מקליט: וידאו חי ותמונות בלבד…"; playback picker leaves such cameras out |
| 3 | Source edit / add / remove need `system.configure` (the recorder connection settings' permission); every change audited, never the URL secret | `routers/camera_sources.py` (read-gate before the body); audit actions `camera.source.update`, `camera.source.test`, `camera.standalone.create`, `camera.standalone.delete`, `camera.source.stream_removed` |
| 4 | "Test stream" before saving; saving does not require a pass, the UI encourages it | `POST /cameras/source/test`; the dialog says "מומלץ לבדוק את הזרם לפני השמירה" |
| 5 | A failing manual source stays (no fallback) and raises an alert / health signal | `camera_sources.HEALTH` + poller; notification source `camera.source` |
| 6 | ONVIF discovery: not in scope | - |
| 7 | Target 2.41.0; the lead bumps | no version file touched |

## Decisions taken here (recorded, not asked)

- **Pseudo-recorder for cameras without a recorder.** `cameras.recorder_id` is `NOT NULL REFERENCES recorders(id)`; rebuilding the
  table was not worth the risk. The row `recorders(id='standalone', vendor='standalone', name='מצלמות ללא מקליט')` is created with the
  first such camera. It is not `nvr-<n>`, so `recorder_scope.settings_for` gives it no connection: every recorder-only path answers 409
  at the device boundary and can never reach a device. It is excluded from `registry.recorder_ids`, `GET /recorders`,
  `connection_store.further_recorders`, `recorder_health.camera_choices`, the `camera.offline` pass and the setup wizard's expected
  streams. `GET /cameras` lists it in `recorders` (id, name, vendor `standalone`) because its cameras are there - the recorder filter
  of the operator screens then offers "מצלמות ללא מקליט".
- **Area** of a camera without a recorder = a home-platform area id (the area screens' id), stored with the source (`area_id`) and
  returned in `GET /cameras` for such cameras. It does NOT auto-place a camera card on that area's layout (layouts are per-installation
  presentation records with revisions; writing them from here was out of proportion). The camera is offered in the area screen's
  camera-card picker like every camera. Open question below.
- **A masked password never travels to a new host**: an edit that keeps `***` is merged with the stored secret only when host and port
  are unchanged (path / user may change); otherwise 422 `password_reenter` ("הכתובת השתנתה: יש להקליד שוב את הסיסמה").
- **Secret query values** (`password=`, `pwd=`, `token=`, `key=`, `auth=`, `sig=`… by key name) are masked like the password.
- **Codec for the H.265 rule**: a manual source has no recorder registry; the codec of the last passing test of a SAVED address is
  stored (`probe_json`) and fed to `live_codec.registry_codecs`; go2rtc's producer report is merged as for any camera.
- **NVR-less mode**: the backend serves live / snapshots of a manual source without `ensure_nvr`, so it is ready; the UI's NVR-less mode
  still hides the camera screens (`nvrLess()` gates in the shell) - not changed here (follow-up below).
- **Health check load**: one frame of each manual source's sub stream every 5 minutes (at most 4 per 30 s pass), from a poller that only
  runs when there is a manual source and go2rtc is configured (`SW_CAMERA_SOURCE_HEALTH=0` turns it off). Snapshots and live opens feed
  the same health. A source is "failing" after 2 failures in a row; the notification waits the policy's `after_s` (120 s).
- **Stream test rate**: 6 per minute per person (429 `rate_limited`).
- **Removing** a camera without a recorder deletes its catalogue row and source, closes its map placements (`effective_to`), deletes
  its go2rtc streams and the cached snapshot. History rows naming the id (audit) stay. A recorder camera is refused (409 `not_standalone`).

## API (all under `/api/v1`, all `system.configure`)

| Route | Body | Answer |
|---|---|---|
| `GET /cameras/{id}/source` | - | `{camera_id, mode: nvr\|manual, standalone, main: {url (masked), has_password}\|null, sub: …, area_id, revision, updated_at, probe: {main\|sub: {codec, width, height, at}}, health: {state, code, checked_at, ok_at, since}\|null, capabilities: {live, snapshot, recording, playback, events, reboot}}` |
| `PUT /cameras/{id}/source` | `{mode, main_url?, sub_url?, area_id?, if_revision?}` | the same view; 409 `stale`, 409 `standalone_needs_source`, 422 `url_required` / `password_reenter` / policy codes |
| `POST /cameras/source/test` | `{url?, camera_id?, profile: main\|sub}` | `{ok: true, width, height, codec, codec_label, preview (data:image/jpeg, ≤640 px)}` or `{ok: false, code, message}`; 409 `media_not_configured`; 422 policy codes; 429 |
| `POST /cameras/standalone` | `{name, area_id?, main_url?, sub_url?}` | 201 the camera row + `standalone: true`, `video_source: "manual"`, `area_id` |
| `DELETE /cameras/standalone/{id}` | - | `{camera_id, deleted: true}`; 409 `not_standalone` |

Added fields (nothing renamed): `GET /cameras` items gain `video_source` (`nvr`\|`manual`), `standalone` (bool) and, for a camera
without a recorder, `area_id`. The raw-body routes check the permission on a read connection before reading the body (review L7).

## Migration 0209 (`0209_camera_stream_sources.sql`)

New table `camera_stream_sources(camera_id PK, main_url_enc, sub_url_enc, main_display, sub_display, main_has_password, sub_has_password,
area_id, probe_json, revision, created_at, updated_at, updated_by, CHECK one address)`. Additive; older code never reads it. Not a backup
table (the `recorder_connections` precedent): a sealed blob never travels in an archive and a restore never touches these rows. A project
restore that brings back a `standalone` camera row without its source leaves a camera that refuses to stream (`source_missing`) until a
source is saved again. Rollback: run the previous version (rows ignored; the `standalone` recorder row and its cameras then show as an
unconfigured recorder's cameras); drop the table to forget the addresses. Renumber at the train if another branch took 0209.

## Security notes

- Every address goes through `services/source_policy.py` (`source_refusal` + `go2rtc_targets`) on save, test, create AND each time a
  stream is written (a name may resolve elsewhere later): rtsp / rtsps only; no loopback / unspecified / link-local / multicast host in
  any spelling; no go2rtc host on its ports; a host name judged by what it resolves to; no `src` / `name` query keys. At write and test
  time an address whose first path segment names a go2rtc stream outside `smplwise_cam_` is refused (`camera_sources.names_foreign_stream`).
- go2rtc namespace: this feature creates / changes / deletes only `smplwise_cam_<id>_<main|sub>` (+ `_h264` transcodes) and throwaway
  `smplwise_cam_probe_<random>` test streams (deleted right after the test). `reconcile` (janitor, every 5 min) deletes only names of the
  exact shape `STREAM_SHAPE_RE` that no manual source wants - never an NVR, WisKey, Home Assistant camera or foreign stream.
- The address (and its password) is never logged, audited, returned, put in an error message, or written anywhere but the sealed column
  and go2rtc's API. Snapshots and health checks ask go2rtc for a frame by stream NAME only. go2rtc's own error text of a failed test is
  classified, never passed on (it echoes the address). `GET /media/streams` shows such a stream's source as its scheme only
  (`go2rtc.redact_source`: `rtsp://***`, like a Home Assistant camera's - a query may carry a token).
- Known limit (unchanged, services/go2rtc.py): go2rtc may persist a stream created through its API - source included - in its own
  configuration file on the go2rtc host.
- Residual risk of the source policy (DNS rebinding between our resolution and go2rtc's) is as documented in source_policy.py.

## Files

Backend: `smplwise/migrations/0209_camera_stream_sources.sql`, `smplwise/services/camera_sources.py` (new), `smplwise/routers/camera_sources.py`
(new), `smplwise/main.py` (router, poller start / stop, janitor reconcile), `services/connection_store.py` (seal / open, further_recorders),
`routers/media.py` (live info / socket / stream / transcode names for a manual source), `routers/cameras.py` (snapshot, list fields),
`services/autosync.py` (stream sync), `services/cast_sessions.py` (cast from the manual stream), `services/camera_image_health.py` (samples
the manual stream), `services/notify_policy.py` + `services/notify_sources.py` (`camera.source`, `camera.offline` skips standalone),
`services/recorders/registry.py`, `routers/recorders.py`, `services/recorder_health.py`, `services/setup_wizard.py` (standalone is not a
recorder), `tests/conftest.py` (`SW_CAMERA_SOURCE_HEALTH=0`), `tests/test_camera_sources_2410.py` (new).

Frontend: `src/api/camera-sources.ts`, `src/i18n/camera-sources.ts`, `src/screens/camera-source-logic.ts`,
`src/components/camera-source-dialog.ts`, `src/components/standalone-cameras-card.ts` (new); `src/api/types.ts` (Camera fields),
`src/screens/live-camera.ts` (source section, standalone gating), `src/screens/system-security.ts` (the card on the NVR page),
`src/screens/investigate-playback.ts` (no standalone camera in the playback picker); `tests/unit-camera-sources-2410.spec.ts` (new).

## Tests (run on the workstation, 2026-11-08, Python 3.12 venv of the main checkout, Node 24.21.0)

| Command (from `smplwise_vms/backend` / `frontend`) | Result |
|---|---|
| `python -m pytest tests/test_camera_sources_2410.py` | **48 passed** |
| related suites, serial: test_autosync, test_camera_card, test_camera_reboot_2407, test_camera_viewfinder_policy, test_cameras, test_camhealth091_295, test_cast_relay, test_cast_sessions, test_frigate_live_0180, test_ha_camera_live, test_live_h265, test_live_review_fixes, test_media, test_media_api, test_media_sync, test_notify_core, test_notify_sources, test_nvr_connection, test_nvr_less, test_recorder_health, test_recorder_health_nn6, test_setup_wizard, test_source_policy, test_stream_codecs, test_multi_nvr, test_multi_nvr_identity, test_multi_nvr_live, test_cr022_security_review / rereview / third_review, test_backup, test_notify_payload_golden | all passed except 5 x `test_nvr_less.py::test_nvr_routes_answer_409_nvr_not_configured[...]` and `test_setup_wizard.py::test_a_slow_device_is_cut_off_at_the_check_deadline` - wall-clock assertions (< 5 s per request) on a loaded workstation. **The same 6 fail identically on main @ d3aa3072c** (a clean detached worktree, same run): pre-existing / environmental, not this branch. (The pass count of this run was not captured - the output filter missed pytest's summary line.) |
| guards: test_no_ip_literals, test_plan_routes_unique, test_raw_body_order, test_gate_always_run, test_body_limit, test_capmap_295, test_pwclean_295, test_capabilities, test_remote_access, test_route, test_db_gate, test_db_template | **240 passed** (after the commits, so git ls-files sees the new files) |
| `npx tsc --noEmit` | exit 0 |
| `npx playwright test -c playwright.unit.config.ts tests/unit-camera-sources-2410.spec.ts tests/unit-camera-reboot-2407.spec.ts` | **13 passed** |
| unit lint / screen specs: unit-a11y-polished-lint, unit-dark-polish-beds, unit-date-format-module, unit-empty-state-icons, unit-menu-lint, unit-page-background, unit-token-lint, unit-uxfix-rtl, unit-video-2403, unit-tickets-gate-295, unit-camera-sources-2410, unit-camera-reboot-2407, unit-cast-logic | first run 93 passed / 1 failed (the DARK-SEG-ALL-2380 lint caught the new dialog's segmented key on a neutral surface) -> fixed to `--sw-seg-key` / `--sw-seg-key-ink`; unit-dark-polish-beds re-run **7 passed** |

The full node-only unit run (`playwright.unit.config.ts`, every spec) was started and stopped after ~60 min unfinished on the loaded
workstation: NOT_RUN as a whole (the targeted specs above ran). The project has no separate lint script (`package.json`); the lint
rules live in the unit specs above.

## NOT_RUN

- Pixel suite and the evidence (screenshot) suites: runner only. No pixel spec renders `/system/security/nvr` or `/live/cameras/*`
  (grep of `frontend/tests/pixel-*.spec.ts`), so no pixel baseline is expected to change. Evidence shots that will differ: the NVR page as
  a system administrator (new "מצלמות ללא מקליט" card: `evidence-nvr-cameras.spec.ts`, `evidence-nn1-p2.spec.ts`,
  `evidence-security-r1.spec.ts`, `evidence-security-polish.spec.ts`) and the camera screen's settings accordion as a system administrator
  when the source route is mocked (otherwise the section is absent).
- Lab: a real go2rtc (version-specific `frame.jpeg?src=&name=` Patch behaviour, codec in the producer list) and a real RTSP camera. The
  test-stream error classification depends on go2rtc's error wording - verified against the fake only.
- Full backend suite and the runner gate.

## Open questions (minimal)

1. Should choosing an area for a camera without a recorder also add its camera card to that area's layout automatically? (Today: the
   area is stored and shown; placing the card stays a layout edit.)
2. NVR-less installations: the backend is ready; showing the camera screens in the UI's NVR-less mode when cameras without a recorder
   exist is a separate shell change.
