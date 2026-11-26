# CAST-RELAY-HARDEN-2540 - the cast relay gets the LAN listeners' socket bounds; a cast ends when its user loses access; NVR undo checks the device first

Branch `pilot/CAST-RELAY-HARDEN-2540`, base `origin/release/2530-train` (`aeb05ad3d`). Spec: findings **V-02**, **V-05** and **V-03**
(all medium) of `docs/review/DEEP-REVIEW-2520-VIDEO.md` (branch `review/DEEP-2520-VIDEO`; index on `chore/REVIEW-FINDINGS-INDEX-2530`),
built to the review's recommended fixes. Target 2.54. No version bump, no changelog entry, no lab / Home Assistant / NVR / go2rtc contact.

## 1. What and why

### V-02 - the cast relay had no socket timeout and no connection cap

`services/cast_relay.py` is the add-on's one unauthenticated listener (container port 18092, when the owner maps it). Its
`ThreadingHTTPServer` had no connection limit and its handler no `timeout`, with HTTP/1.1 keep-alive: a device on the LAN could open
thousands of idle connections, one thread each, until the add-on process ran out of memory or threads. The two sibling listeners
(notice boards, Provision push) were already bounded.

- **Reuse**: the notice listener's `_CappedServer` moved to a new shared module `services/lan_listener.py` as `CappedServer`
  (unchanged behaviour, plus an `open_connections()` reader and a `refused` count). `services/notices/listener.py` imports it back
  under its old name `_CappedServer`, so the notice listener and its tests are untouched.
- The relay now listens through `CappedServer` with `MAX_CONNECTIONS = 32` and `MAX_PER_ADDRESS = 8` (a handful of TVs, a few parallel
  fetches each). Over a cap the socket is closed at once, without a thread.
- `_Handler.timeout = SOCKET_TIMEOUT_S = 15 s` bounds every socket read and write.
- **Slow-loris**: a per-read timeout alone does not stop a client that drips one byte just inside it (verified: with only the read
  timeout such a connection stayed open indefinitely). New `lan_listener.RequestDeadline` mixin + `DeadlineReader`: the whole wait for
  one request - the keep-alive gap after the previous answer, the request line and the headers - must finish within
  `REQUEST_DEADLINE_S = 15 s`; past it the read raises `TimeoutError`, which `BaseHTTPRequestHandler` answers by closing the connection.
  The answer itself is bounded by the socket timeout only (`clear_deadline()` before writing). A TV that polls every few seconds keeps
  its kept-alive connection; an idle one is closed after 15 s.
- The related smaller finding: `Entry.hls_ids` only grew (each `index.m3u8` of a permanent token added an id). It is now an ordered set
  capped at `HLS_IDS_MAX = 8`, newest kept, updated under a lock.

### V-05 - a cast was never ended when its starter lost access

The only owner-related end condition of `cast_sessions.janitor` was `owner_gone` (a LOCAL user disabled / deleted). Nothing re-checked
`video.live` or `media.cast` after the start, and disabling the camera did not end the cast; a permanent cast survives restarts, so it
continued indefinitely.

- New `cast_sessions.access_lost(conn, row) -> str | None`, asked by the janitor (every 30 s) for each running session after the
  `owner_gone`, `timeout` and `target_gone` rules. The rules of `start`, asked again:
  - the user is not disabled on either side (`active_users.is_disabled`) -> else `user_inactive`. A Home Assistant user absent from the
    directory push is marked `is_active = 0` by `ha_store`, so **a removed Home Assistant starter's cast now ends** (the review asked for
    an explicit decision; this is the recommendation, see question 2);
  - the camera exists and is enabled -> else `camera_gone` / `camera_disabled`;
  - `video.live` on the camera (`access.camera_allowed`, the camera scope incl. explicit denies) for whoever chose the camera now ->
    else `video_live`. `switch` now records `camera_by` (the switching user) in `restore_json`; the starter until a switch;
  - for a camera cast: `media.cast` at the screen's anchor for the starter, and `media.public` on a public screen (`media_store.Access`,
    the same check as the start) -> else `media_cast` / `media_public`. The administrator's 60 s test cast is judged by the camera rules
    only (it was started under `system.configure`).
- A failure ends the session with the new stop reason **`access_lost`** through the existing `_end` (token revoked first, ONE stop, the
  restore rule's off); the `media.cast.stop` audit row carries `details.lost` (which rule failed). The janitor's counts get
  `access_lost` only when it happened (the existing count shape is unchanged otherwise).
- A re-check that raises (a busy database) keeps the cast for that round (asked again 30 s later), like a camera lease re-check.
- `frontend/src/api/cast.ts`: `'access_lost'` added to the `CastStopReason` type (type only; no screen shows the reason text today).
- Found on the way: the response models `CastSession` / `CastSessionsSession` declared `expires_at: str`, so `GET` of a session or
  the session list answered 500 while a PERMANENT cast was open (`expires_at` is null). Now `str | None` (`wire/cast.py`;
  `frontend/src/api/generated/wire-cast.ts` regenerated with `scripts/gen_wire_types.py`).

### V-03 - generic NVR undo overwrote whatever the device held

`nvr_write.rollback` PUT the stored `before` document without looking at the device. Privacy-mask and encoding undo already checked.

- Before the PUT the document is read and compared (whitespace aside, `_normalize`) with the change's `after`. When it differs:
  409 **`changed_since`** ("the setting on the device has changed since this change; undoing it would overwrite what it holds now; you
  can confirm the undo anyway"), audited (`nvr.rollback` denied, reason `changed_since`), nothing written, the change stays `applied`.
- A change already undone: 409 **`already_rolled_back`** (audited), unless forced.
- `POST /nvr/changes/{id}/rollback` body `{"force": true}` (only the literal `true`; any other body behaves as before) skips both
  checks; the allowed audit row then says `forced: true`. Additive (ADR-015); the OpenAPI body schema documents `force`. Both refusals
  carry `details.force_allowed: true`. English texts added to `error_text_en.json`.
- Stream encoding and privacy masks keep their own undo paths, unchanged.

## 2. Files

- `smplwise_vms/backend/smplwise/services/lan_listener.py` (new) - `CappedServer` (moved), `DeadlineReader`, `RequestDeadline`
- `smplwise_vms/backend/smplwise/services/notices/listener.py` - imports `CappedServer` back as `_CappedServer`
- `smplwise_vms/backend/smplwise/services/cast_relay.py` - caps, timeouts, deadline, capped `hls_ids`
- `smplwise_vms/backend/smplwise/services/cast_sessions.py` - `access_lost`, `_principal_of`, the janitor rule, `camera_by` on switch,
  `_end(lost=)`
- `smplwise_vms/backend/smplwise/services/nvr_write.py`, `routers/nvr_write.py` - the undo check and `force`
- `smplwise_vms/backend/smplwise/error_text_en.json` - two English texts
- `smplwise_vms/backend/smplwise/wire/cast.py`, `frontend/src/api/generated/wire-cast.ts` - nullable `expires_at`
- `frontend/src/api/cast.ts` - the stop-reason type
- tests: `test_cast_relay_harden_2540.py`, `test_cast_access_lost_2540.py`, `test_nvr_undo_changed_since_2540.py` (new)

## 3. Tests

Fakes only: the relay on 127.0.0.1 with a fake go2rtc, the synthetic media installation with a fake bridge, the fake NVR (httpx
MockTransport). Runner (Linux, slot B, `~/work/p2520_castrelay_run.sh` at `0b1990190`, one pytest process per group,
`python -m pytest -q -p no:cacheprovider -o addopts=""`):

| group | files | exit | result |
|---|---|---|---|
| ruff | the 10 touched backend / test files | 0 | all checks passed |
| new | the 3 new test files | 0 | 20 passed |
| cast | test_cast_relay, test_cast_sessions, test_janitor, test_service_identity, test_shutdown_safely | 0 | 137 passed |
| notices | test_notices_security_295, test_notice_caps_295, test_notices_106, test_bustimes_295, test_notice_slides_295, test_notice_rss_sources_295 | 0 | 210 passed |
| nvr | test_nvr_write, test_backend_safety_2435, test_video_secfix_2520, test_nvr_write_guard_2438, test_nvr_schedule, test_nvr_system, test_multi_nvr, test_nvr_privacy_mask, test_camera_reboot_2407 | 0 | 93 passed |
| guards | test_i18n_errors_en_2520, test_singletons_registered, test_wire_ratchet_2480, test_wire_route_coverage_2460, test_error_envelope_family678_2520, test_routers_table_2440, test_mfa_stepup_gates_2490, test_go2rtc_stream_sync_2436, test_timeutil_formats, test_secrets_transitional_263 | 0 | 184 passed |
| frontend | `npx tsc --noEmit` | 0 | clean |

Also on the PC (Windows, one file at a time): the 3 new files (7 + 8 + 5 passed), test_cast_relay.py (40 passed),
test_notice_caps_295.py (12 passed), test_i18n_errors_en_2520.py (9 passed). A side check without the request deadline (only the
1 s read timeout) showed a dripping connection still open after 5 s - the deadline is what cuts it.

NOT_RUN: the full backend suite and the release gate (the train's gate covers them); Playwright / pixel specs (no screen changed).

- `test_cast_relay_harden_2540.py` (7): an idle connection is closed and frees its slot; a slow-loris that drips a byte every 0.3 s
  (inside the 1 s read timeout) is cut off by the 1.5 s request deadline; the per-address cap closes the extra socket at once and a TV is
  served afterwards; the total cap; a kept-alive TV is served request after request on one connection; `hls_ids` capped newest kept;
  the notice listener still has its capped server.
- `test_cast_access_lost_2540.py` (8): a healthy permanent cast keeps running; a camera deny, losing `media.cast`, a disabled camera and
  a starter dropped from the home directory each end it (`access_lost`, ONE stop, token 403, `details.lost`); after a switch the camera
  is judged for the switcher and the screen for the starter; a failing re-check keeps the cast; the administrator's test cast is judged
  by the camera only.
- `test_nvr_undo_changed_since_2540.py` (5): a device edited after the change -> 409 `changed_since`, nothing written, audited, then
  `force` undoes; whitespace-only differences are not a change; an undone change -> 409 unless forced; only the literal `true` forces;
  the refusal texts have English.

## 4. Open questions (recommendation first)

1. Caps of the cast relay as administrator settings (like the notice boards' NOTICECAPS-295)? a) no, fixed constants (32 / 8 / 15 s) -
   recommended; b) settings under the cast administration.
2. A cast whose Home Assistant starter was removed from Home Assistant: a) it ends (`access_lost`, `user_inactive`) - recommended, built;
   b) it stays until an administrator stops it (today's behaviour).
3. The UI's undo button on a `changed_since` refusal: a) shows the refusal text now; a "undo anyway" confirmation (sending `force`) in a
   later UI row - recommended; b) add the confirmation in this row.
4. Apply the request deadline (`RequestDeadline`) to the notice-board and Provision-push listeners too (they have the per-read timeout
   only)? a) yes, in a small follow-up row - recommended; b) no.
