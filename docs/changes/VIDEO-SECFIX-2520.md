# VIDEO-SECFIX-2520 - go2rtc error frames never reach a viewer; NVR change detail and undo keep the camera scope

Branch `pilot/VIDEO-SECFIX-2520`, base `origin/release/2520-train` (`189ec3f4a`). Spec: findings **V-01** (high) and **V-04** (medium)
of `docs/review/DEEP-REVIEW-2520-VIDEO.md` (branch `review/DEEP-2520-VIDEO`, `abbc9e13b`), built to the review's recommended fixes.
No other finding is touched. No version bump, no changelog entry, no lab / Home Assistant / NVR / go2rtc contact.

## 1. What and why

### V-01 - go2rtc error frames reached live and playback viewers unsanitized

Three of the five relay routes (recorder-camera live, manual-source camera live - the same route - and playback) forwarded go2rtc's
`{"type":"error","value":...}` frames verbatim. Their text can name the device's LAN address (a failed dial) and, for an `ffmpeg:` source
(Provision-ISR by default), possibly the whole RTSP URL with the recorder's user name and password. The Home Assistant camera route and
the intercom station route already replaced them, each with its own copy of the rule.

- **One shared sanitizer**: `services/relay.sanitize_upstream_frame(text, *, error_value="upstream_error", on_error=None)`.
  An error frame becomes the fixed `{"type":"error","value":"upstream_error"}`; a text frame that is not a JSON object is dropped
  (go2rtc's signalling is JSON objects); every other frame passes unchanged. Never raises.
- It is `relay_ws`'s default when no `on_text` is given, and `media._live_relay`'s default - so a future route that forgets to pass
  one is still safe.
- The HA camera route keeps its own code (`upstream_unavailable`) and its "mark stale" side effect, now as
  `sanitize_upstream_frame(text, error_value="upstream_unavailable", on_error=...)`; the intercom route uses the shared function
  directly (same `upstream_error` as before). The two private copies are gone.
- Logging: the live routes already logged go2rtc's error only through `services/live_diag` (classified + sanitized: no URL, address,
  credential, MAC or serial). The playback socket now does the same (`LiveDiag` observes its frames; one warning line
  `playback session <id> g<n>: go2rtc error <class>: <sanitized text>` when go2rtc reported an error). The raw text is never logged.
- The player (`sw-live-player.ts`) is unchanged: `upstream_error` is not one of the player's own codes, so it still counts as a stream
  error (`sub_error`), the sub-stream fallback and the transport ladder behave as before; the on-screen "Stream error: {v}" now shows the
  fixed code instead of go2rtc's text (see question 1).

### V-04 - NVR undo and change detail skipped the camera scope

Generic change rows (motion, OSD, channel name, arming / recording schedules, smart rules, Notify Surveillance Center) were stored
without `camera_id`, so `POST /nvr/changes/{id}/rollback` checked only the installation-wide permission and `GET /nvr/changes/{id}`
only `_require_read` - a user with an explicit deny on camera X could read and undo X's changes, although the direct write is refused.

- `nvr_write.apply_change(..., camera_id=None)` records the camera; every camera route passes it (`set_notify` per channel,
  `set_motion`, `set_osd`, `write_channel_name` via `nvr_system.set_channel_name(camera_id=)`, `set_arming`, `set_record_schedule`,
  `set_smart`). `_record` writes `recorder_id` and `camera_id` in its one INSERT (the separate `UPDATE ... recorder_id` is gone).
  An undo row keeps the original's camera.
- `nvr_write.change_cameras(conn, row) -> (camera_level, ids)`: installation-level kinds (`time`, `reboot`, `alarm_output`,
  `storage_test`) have no camera scope; every other kind - including any kind added later - is camera-level (fail closed). The ids are
  the stored `camera_id` plus the camera the row's target names on its recorder now (`track-<n>`: the camera whose main track is n,
  or `<channel>01` when none is recorded - the rule of `_track_of`; `<anything>-<n>`: the camera on channel n). So rows written before
  2.52 are covered without a migration, and the camera the undo would actually write to is always checked.
- Undo gate (`_rollback_gate`): after the existing installation-wide `require`, the change's own permission must hold on **every**
  camera the row touches (audited 403 naming the camera, as `require_camera`). This replaces the privacy-mask-only check (NVRMASK-295),
  which is now the general rule.
- Detail (`GET /nvr/changes/{id}`) and list (`GET /nvr/changes`): the read rule of a camera's NVR settings
  (`_camera_config_scope` with no write: any of `system.configure`, `nvr.config.events` and the NVR write permissions on the camera).
  A camera-denied row is refused (detail, audited) or left out (list). Stream-encoding rows keep their own stricter rule, unchanged.
- **Fail closed**: a camera-level row whose camera cannot be determined (no stored camera, no camera on that channel / track now) is
  allowed only to a caller who holds the permission on every camera with no deny anywhere (`camera_scope(...).everything`); otherwise
  403, audited with reason `camera_unknown` (resource `nvr` / the row's target, details `change_id`, `kind`). The 403 body is the
  standard `forbidden` envelope (catalogue text, Hebrew + English); no new user-visible text.
- Users without a deny see no change: their scope is `everything`, the list filter is skipped (`row_visible=None`) and every camera
  check passes.
- Side effect (the review's note): `GET /nvr/changes?camera_id=` now matches generic rows written from 2.52 on.

## 2. Files

- `smplwise_vms/backend/smplwise/services/relay.py` - `UPSTREAM_ERROR`, `sanitize_upstream_frame`, `relay_ws` default.
- `smplwise_vms/backend/smplwise/routers/media.py` - `_live_relay` uses the shared sanitizer by default.
- `smplwise_vms/backend/smplwise/routers/playback.py` - `on_text` (LiveDiag + sanitizer), sanitized warning line.
- `smplwise_vms/backend/smplwise/services/ha_camera_streams.py` - `sanitize_frame` delegates (`LIVE_ERROR_FRAME` -> `LIVE_ERROR_VALUE`).
- `smplwise_vms/backend/smplwise/routers/intercom_media.py` - private `_sanitize_frame` removed, shared one used.
- `smplwise_vms/backend/smplwise/services/nvr_write.py` - `_record(camera_id=)`, `apply_change(camera_id=)`, rollback keeps the camera,
  `INSTALLATION_KINDS`, `change_cameras`, `list_changes(row_visible=)`.
- `smplwise_vms/backend/smplwise/services/nvr_system.py` - `set_channel_name(camera_id=)`.
- `smplwise_vms/backend/smplwise/routers/nvr_write.py` - callers pass `camera_id`; `READ_PERMISSIONS`, `_require_change_cameras`,
  `_change_visible`; detail, list and undo gates.
- Tests: `smplwise_vms/backend/tests/test_video_secfix_2520.py` (new, 10), `tests/test_ha_camera_live.py` (one assertion: a non-JSON
  text frame is now dropped on the HA route too).

None of these files is owned by the WisKey R1-R7 / bridge 0.10.9 rows or DESIGN-LITERALS-2510. No migration, no API shape change
(additive: the existing `camera_id` column is now filled), no frontend change.

## 3. Tests

All backend tests ran on the Linux runner (`~/work/slotb.sh`, priority job `p2520_videosecfix_run.sh`) at `3e4317bb9`, one pytest
process per shard of 8 files. The selection: every backend test file that names the changed code (`nvr_write`, `/nvr/changes`,
`services.relay` / `relay_ws`, playback, `/media/live`, `ha_camera_streams`, `intercom_media`, `nvr_system`, `live_diag`), plus the
structural checks (`test_async_routes_no_inline_db`, `test_db_gate`, `test_migrations`, `test_singletons_registered`,
`test_i18n_errors_en_2520`, `test_wire_routers_b/c/d`, `test_intercom`) - **97 files, 2643 tests collected** (`test_soak_long` left out).

| Run | Command | Exit | Result |
|---|---|---|---|
| PC, the new file | `pytest tests/test_video_secfix_2520.py` | 0 | 10 passed |
| PC, the new file on the base code (product changes stashed) | same | 1 | 10 failed - the tests catch both findings |
| Runner, shards 0-8 and 10-12 (89 files) | `pytest -q -x <8 files>` x 12 | 0 each | all passed (the `-q -q` output prints no counts) |
| Runner, shard 9 again without `-x` (8 files, incl. `test_video_secfix_2520`, `test_video_transport_2400`, `test_video_sub_fallback_2402`, `test_video_timing_t074`, `test_wall`) | `pytest <8 files>` | 1 | **220 passed, 3 xfailed, 1 failed** |
| ruff on every changed file | `ruff check` | 0 | clean |

The one failure is **not this row's**: `test_t06_admission_295.py::test_the_only_modules_that_reach_a_signing_call_are_the_known_ones`
lists the modules allowed to reach a WisKey signing call, and `services/wiskey_schedule_reads.py` (a WisKey row already merged into
`release/2520-train`) is not in its list. The module and the unchanged test file are both on the train base (`189ec3f4a`); this branch
touches neither. Owner of the fix: the WisKey schedule-reads row / the train (add the module to the test's set). Not re-run on the bare
base commit (NOT_RUN) - the cause is read from the assertion.

NOT_RUN: the full backend suite (only the 97 affected files), frontend checks (no frontend change), Linux pixel baselines and a
compare page (no UI change), any lab check (no lab access in this row).

## 4. Open questions (recommendation first)

1. The player shows "Stream error: upstream_error" (Hebrew / English template) where it used to show go2rtc's raw text.
   a. (recommended) Leave it for 2.52 - safe and still says "stream error"; a later UI row maps `upstream_error` to a readable sentence.
   b. Map it now in `sw-live-player.ts` (one new bilingual string; needs pixel / evidence checks).
2. go2rtc's error class (`auth`, `timeout`, `refused`, ...) is safe and could be sent to the viewer instead of the fixed code.
   a. (recommended) No - keep one fixed code; the class stays in the server log and the audit row.
   b. Yes, as an extra `reason` field next to the fixed `value`.
3. Lab check suggested by the review (not done here - no lab access): what go2rtc actually sends for a Provision `ffmpeg:` source that
   fails, to decide whether a recorder password rotation is advisable.
   a. (recommended) A short read-only lab check after 2.52 is installed (the leak is closed either way).
   b. Skip.
