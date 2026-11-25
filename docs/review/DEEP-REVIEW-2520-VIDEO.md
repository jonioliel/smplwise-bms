# Deep review 2.52 - area VIDEO

Reviewed head: `origin/release/2520-train` @ `eadaa25b81c0e65c86d8aa6ff5f108816bcc7c2d`. Branch of this report: `review/DEEP-2520-VIDEO`
(only this file changes). Read-only review: no product code edited, no lab, no device, no go2rtc access.

Scope: cameras, recorders (Hikvision ISAPI client and writes, privacy masks, reboot), ONVIF discovery, recordings / playback / seek,
snapshots, go2rtc stream management, Frigate, cast / display, camera source dialogs; the backend services and routers for these and
the live player's handling of relay frames.

Method and honesty notes:
- Every finding below was confirmed by reading the code path at the reviewed head. **No test was run (NOT_RUN)**: nothing here is
  "reproduced", only read. Where a finding also depends on how go2rtc or ffmpeg behaves, that part is marked PLAUSIBLE and says why.
- Depth was not even. Read end to end: `services/go2rtc.py`, `services/source_policy.py`, `services/cast_relay.py`,
  `services/playback.py`, `routers/playback.py`, `services/nvr_write.py`, `services/nvr_privacy.py`, `services/camera_reboot.py`,
  `services/device_http.py`, `services/camera_discovery/onvif_http.py`, `onvif_client.py`, `ranges.py`, `services/relay.py`,
  `services/live_diag.py`, `services/recorder_live.py`. Read in the relevant parts: `routers/media.py`, `routers/nvr_write.py`,
  `routers/nvr_privacy.py`, `routers/cameras.py`, `routers/cast.py`, `routers/exports.py`, `services/autosync.py`,
  `services/camera_sources.py`, `services/nvr.py`, `services/recorders/frigate_restream.py`, `vendor_io.py`, `provision_playback.py`
  (download), `services/thumbnails.py`, `services/cast_sessions.py` (janitor, expiry), `services/leases.py`.
  Only skimmed (see "Not covered"): the Frigate service layer above its HTTP gate, media groups / multimedia, `camera_discovery/service.py`
  beyond its structure, recordings search and time-zone handling, the frontend API clients other than the live player's frame handling.
- Earlier rounds (review 03 F01-F27, security reviews, CR-GO2RTC-OWNED-2436, CR-GO2RTC-ADAPTER-2436, BACKEND-SAFETY-2435) are visible
  in the code and were not re-reported. `docs/security/FFMPEG_PROCESS_LIST_CREDENTIALS.md` (accepted limit) is not re-reported.

## Summary

| Id | Severity | Title | File:line |
|---|---|---|---|
| V-01 | high | go2rtc error frames reach live and playback viewers unsanitized (addresses; PLAUSIBLE: recorder credentials) | `routers/media.py:581`, `routers/playback.py:236`, `frontend/src/components/sw-live-player.ts:1510,1550-1556` |
| V-02 | medium | The cast relay (the one unauthenticated listener) has no socket timeout and no connection cap | `services/cast_relay.py:349-352,411` |
| V-03 | medium | Generic NVR undo PUTs the old document without checking the device still holds the change | `services/nvr_write.py:209-233` |
| V-04 | medium | NVR undo and change detail skip the camera scope: generic change rows carry no `camera_id` | `routers/nvr_write.py:695`, `services/nvr_write.py:150-156` |
| V-05 | medium | A cast (a permanent one in particular) is never ended when its starter loses the camera or the cast permission | `services/cast_sessions.py:961-990` |
| V-06 | low | Disabling a camera stops nothing that is running, and its go2rtc streams are never removed | `services/autosync.py:262-263`, `services/leases.py:38-43` |
| V-07 | low | Motion capability cache is keyed by channel only and caches a failed read for the process lifetime | `services/nvr_write.py:262-284` |
| V-08 | low | Playback session terminal states: `revoked` counts as active; a late media byte revives a closed session | `routers/playback.py:215,244`, `services/playback.py:104-105` |
| V-09 | low | Snapshot cache file is written in place, with no single-flight per camera | `routers/cameras.py:201` |
| V-10 | low | Foreign-stream alias guard compares the first path segment only (PLAUSIBLE) | `services/go2rtc.py:685-696` |

Counts: critical 0, high 1, medium 4, low 5.

The go2rtc namespace guarantee itself held on every path read (see "Checked and fine").

Paths below are relative to `smplwise_vms/backend/smplwise/` unless they start with `frontend/`.

---

## V-01 (high) - go2rtc error frames reach live and playback viewers unsanitized

**Where.** `routers/media.py:572-581` (`_live_relay`: `observed_text` returns the text unchanged when the route passes no `on_text`),
`routers/media.py:676-685` (`live_ws` passes none), `routers/playback.py:236-237` (`relay_ws` called with no `on_text`),
`services/relay.py:54-56` (text frames forwarded as they are), `frontend/src/components/sw-live-player.ts:1510` (`console.warn` of
`msg.value`) and `:1550-1556` (`'שגיאת זרם: {v}'` puts the value on screen).

**What is confirmed.** Three of the five relay routes forward go2rtc's `{"type":"error","value":...}` frames verbatim to the browser:
the recorder camera live socket, the manual-source camera live socket (same route) and the playback socket. The other two replace
them with a fixed code, and say why in their own docstrings: `ha_camera_streams.sanitize_frame` ("its text may carry an address or a
credential of the camera") and `routers/intercom_media._sanitize_frame` ("their text may name the source"). `services/live_diag.py`
sanitizes the same text before it is LOGGED ("a source URL can carry the station's credentials") - so the log line is protected and
the frame sent to the viewer is not. The player then prints the value to the console and, on several branches, shows it in the tile.

**What the text contains.**
- Confirmed class: go2rtc reports producer failures as Go errors; a failed dial names host and port. That is the recorder's (or the
  camera's own) LAN address, shown to every holder of `video.live` / `video.playback`, including remote (`/arx`) users. This project
  treats those addresses as private.
- PLAUSIBLE, not proven here (no go2rtc was contacted): for a source that go2rtc runs through ffmpeg, the error value carries ffmpeg's
  stderr, and ffmpeg names its input URL when it cannot open it. Provision-ISR recorders use exactly that by default
  (`recorders/vendor_io.go2rtc_source`: `ffmpeg:rtsp://<user>:<password>@...#video=copy`, live and playback). The product's own code
  already assumes ffmpeg prints the full URL: `thumbnails._redact` and `provision_playback.rtsp_download` strip the URL, user,
  password and host from ffmpeg's stderr. If go2rtc relays that stderr, a viewer of a Provision camera that is offline or refusing
  receives the recorder's user name and password.

**Scenario.** A guard with `video.live` on one camera opens it while the recorder is rebooting. go2rtc cannot open the source and
sends an error frame; the relay forwards it; the browser console (and possibly the tile) shows the recorder address - for a
Provision recorder possibly the whole credentialed RTSP URL.

**Fix.** Give `_live_relay` a default `on_text` that replaces every `type == "error"` frame with a fixed code (the HA route's
`LIVE_ERROR_FRAME` pattern), and pass the same to the playback relay. The classified reason from `LiveDiag.classify` (`auth`,
`timeout`, `refused`, `codecs`, ...) is safe to send as the value if the player needs to branch on it; the player's sub-fallback
logic only needs "an error that is not one of ours". Add a test that feeds a credentialed error frame through each relay route.
Verify on the lab what go2rtc actually sends for an `ffmpeg:` source before deciding whether a password rotation is advisable.

---

## V-02 (medium) - the cast relay has no socket timeout and no connection cap

**Where.** `services/cast_relay.py:349-352` (`_Handler`: no `timeout` attribute, `protocol_version = "HTTP/1.1"`), `:411`
(`ThreadingHTTPServer`, `daemon_threads`, no limit).

**What is confirmed.** `BaseHTTPRequestHandler.timeout` defaults to `None`, so a connection that sends nothing (or one byte a minute)
holds its thread forever; with HTTP/1.1 keep-alive an idle connection does too. Every connection is a new thread and nothing bounds
their number. The per-token rate limits only apply after a full request line with a valid token was parsed. The module's own header
calls this "the ONLY unauthenticated listener of the add-on". The two sibling listeners were hardened for exactly this:
`recorders/provision_push.py` (`HANDLER_TIMEOUT_S`, `MAX_CONNECTIONS`, `MAX_PER_SOURCE`, "security review M1") and
`notices/listener.py` (`_CappedServer`, `SOCKET_TIMEOUT_S`). The cast relay was not.

**Scenario.** The owner mapped the relay port (required for casting). Any device on that network opens a few thousand TCP
connections and leaves them idle. The add-on process accumulates one thread per connection until memory or the thread limit is
exhausted - the whole add-on (not only casting) degrades or is killed.

**Fix.** Reuse `notices.listener._CappedServer` (or copy its caps): a socket timeout of about 10-15 s on the handler, a total
connection cap and a per-source cap sized for a handful of TVs. Refusals over the cap close the socket without a thread.

Related, smaller: `Entry.hls_ids` (`:292`) only grows - each `index.m3u8` fetch of a long-lived (permanent) token adds an id. Keep
the newest few ids per entry.

---

## V-03 (medium) - generic NVR undo overwrites whatever the device holds now

**Where.** `services/nvr_write.py:209-233` (`rollback`): it PUTs `orig["before_xml"]` to `orig["path"]` without reading the current
document first.

**What is confirmed.** `apply_change` stores the WHOLE document before and after. The undo writes the whole old document back. Two
other undo paths check first: privacy masks (`nvr_privacy.restore_change`: 409 `changed_since` against `etag_after`) and stream
encoding (`nvr_settings.rollback_stream`, "etag-of-after check"). The generic path - motion detection, OSD, arming schedules, the
recording schedule, smart rules, notify-centre - has no such check. It also accepts a change whose status is already `rolled_back`.

**Scenario.** Monday: the recording schedule of a camera is changed (change A). Tuesday: someone corrects it again (change B), or
edits it in the recorder's own UI. Wednesday: an operator presses undo on A in the change log. The Sunday document is written back;
B is gone with no warning. The route's own docstring says of this document "a mistake here means hours without recording".

**Fix.** Before the PUT, GET the path and compare `_normalize(current)` with `_normalize(orig["after_xml"])`; when they differ answer
409 `changed_since` (the privacy-mask wording exists already) and let the caller confirm an explicit `force`. Refuse a change that is
already `rolled_back` unless forced.

---

## V-04 (medium) - NVR undo and change detail skip the camera scope

**Where.** `routers/nvr_write.py:684-698` (`_rollback_gate`: for every kind except `stream_encoding` and `privacy_mask` only
`require(conn, principal, r["permission"], INSTALLATION)`), `routers/nvr_write.py:660-671` (`GET /nvr/changes/{id}` returns both
documents after `_require_read` only), `services/nvr_write.py:150-156` (`_record` never writes `camera_id`; only
`camera_reboot.prepare` and `nvr_privacy._rec` set it afterwards).

**What is confirmed.** Every write route of a camera's settings enforces the camera scope (T055) on top of the installation grant -
`_channel_of(..., write)` / `_track_of(..., write)` / `require_camera`. Their docstring states the rule: "an explicit deny on the
camera (or its floor / site) takes the camera's settings away even from an installation-wide holder". The change-log row of such a
write has no `camera_id`, so the undo gate cannot apply that rule and does not try: the undo of a motion / OSD / schedule / smart /
notify change on a denied camera is allowed, and `GET /nvr/changes/{id}` shows its before / after documents. For the same reason the
`camera_id` filter of `GET /nvr/changes` never matches these rows.

**Scenario.** A technician holds `nvr.config.schedule` installation-wide with an explicit deny on the management-floor cameras. The
direct `PUT /cameras/{id}/record-schedule` on such a camera is refused (403, audited). `POST /nvr/changes/{id}/rollback` on a change
of that same camera's schedule is accepted and writes to the recorder.

**Fix.** Have `apply_change` take and store `camera_id` (every caller has the camera row), backfill old rows from `target` where the
channel can be mapped, and make `_rollback_gate` and `get_change` call `require_camera(conn, principal, r["camera_id"], r["permission"])`
whenever the row has one. For installation-level changes (clock, NTP) nothing changes.

---

## V-05 (medium) - a cast is never ended when its starter loses access

**Where.** `services/cast_sessions.py:961-990` (`janitor`): the only owner-related end condition is `owner_gone` (a LOCAL user
disabled or deleted; "a Home Assistant owner is never judged here"). `_expiry` (`:644-650`) returns `None` for a permanent cast.
`services/cast_relay.py` serves the token until the session row is ended.

**What is confirmed.** Live and playback sockets hold a `CameraLease` that is re-checked on every access change of the user and every
`RECHECK_S`, and close with `access_lost`. A cast has no equivalent. Nothing re-checks `video.live` on the camera or `media.cast` on
the screen after the start, and disabling the camera (`cameras.enabled = 0`) does not end it either. A timed cast ends by itself
within its minutes (plus up to 8 extends, each re-authorized); a permanent cast survives restarts by design (`load_index`) and so
continues indefinitely.

**Scenario.** An operator starts a permanent cast of an entrance camera to a lobby screen. Later the operator's role is changed and
the camera is taken out of their scope (or their Home Assistant user is removed). The TV keeps showing the camera until an
administrator finds the session and stops it.

**Fix.** In the janitor (every 30 s already), for each running session re-check the starter's `video.live` on the camera and
`media.cast` on the screen through the same rule the start uses, and end the session (`access_lost`, one stop) when either fails or
the camera is disabled. Decide explicitly what happens to a permanent cast whose starter is a Home Assistant user that no longer
exists; today it stays.

---

## V-06 (low) - disabling a camera stops nothing that is running

**Where.** `services/autosync.py:262-270`: the sync ensures streams for `enabled = 1` cameras and deletes only the streams of removed
or disabled RECORDERS (`gone`). `services/leases.py:38-43`: the lease re-check is `camera_allowed` (permission only).
`routers/cameras.py` `update_camera` only patches the row.

**What is confirmed.** After `PATCH /cameras/{id} {"enabled": false}` a NEW live socket is refused (`camera_disabled`), but open live
sockets, open playback sessions and casts of that camera continue, and its `smplwise_<recorder>_ch<n>_*` streams (with the recorder
credentials in their source) stay in go2rtc until the recorder itself is removed. Manual-source cameras behave better: their
reconcile wants only enabled cameras and deletes the rest.

**Fix.** Treat a disabled camera like a disabled recorder: add its stream names (and `_h264` variants) to `gone` in `ensure_streams`,
and let `CameraLease.allowed_now` (or its `extra_stop`) also read `cameras.enabled`.

---

## V-07 (low) - motion capability cache: wrong key, and failures cached forever

**Where.** `services/nvr_write.py:262-284` (`_MOTION_CAPS: dict[int, ...]`, `motion_capabilities`).

**What is confirmed.** The cache key is the channel number alone, although the function is called with the camera's own recorder
settings (CR-024). With two recorders, channel 3 of the second gets the sensitivity `min / max / step` read from channel 3 of the
first. And when the capability read does not answer 200 (a busy recorder, a transient 401 after the single retry), the defaults
`0 / 100 / 1` are stored and never read again until the add-on restarts.

**Scenario.** A camera whose sensitivity step is 20: after one failed capability read, `PUT /cameras/{id}/motion {"sensitivity": 50}`
is no longer snapped to 40 or 60; the recorder silently keeps its old value and the request ends in 409 `nvr_no_effect` - for every
later attempt until a restart.

**Fix.** Key by `(settings.nvr_recorder_id, channel)`; store only a 200 answer (or give the default a short TTL).

---

## V-08 (low) - playback session terminal states

**Where.** `services/playback.py:104-105` (`active()` treats only `closed / expired / failed` as finished),
`routers/playback.py:244` and `routers/playback_groups.py:149` (`pb.close(..., "revoked")`), `routers/playback.py:210-215`
(`on_down` sets `state = "playing"` on the first byte without looking at the current state).

**What is confirmed.**
1. A session closed as `revoked` is still "active": it counts against `playback.max_sessions`, is listed with a `media_handle`, and
   only leaves when `expire_idle` turns it into `expired` after the lease. No media is reachable (its stream is deleted and the
   stream name is empty, so a reconnect fails), but a quota slot is held and the listing is misleading.
2. `pb.close` sets `closed` and only then stops the relay. If the generation's first media frame is relayed in that window,
   `on_down` sets `playing`; the socket's `finally` then turns it into `paused`. The session is active again with no stream, until the
   lease expires.

**Fix.** One constant for the terminal states that includes `revoked`, used by `active()`, the routes and `to_dict`; in `on_down`
change the state only when it is `buffering` or `seeking`.

---

## V-09 (low) - snapshot cache written in place, no single-flight

**Where.** `routers/cameras.py:186-206` (`path.write_bytes(data)` at `:201`, `path.read_bytes()` for the answer).

**What is confirmed.** The cached `<camera>.jpg` is truncated and rewritten in place while other requests of the same camera decide
"fresh" from its mtime and read it. A concurrent reader can get an empty or cut JPEG (a broken tile until the next refresh). And when
the copy is stale, every concurrent request of that camera asks the recorder itself - a wall of tiles opened by several users
multiplies the picture requests toward a recorder whose HTTP server is known to be slow under load (AZIA-LIVE-2331).

**Fix.** Write to a temporary name and `os.replace`; take a per-camera lock around "stale -> fetch" so one request fetches and the
others serve the result.

---

## V-10 (low, PLAUSIBLE) - foreign-stream alias guard compares the first path segment only

**Where.** `services/go2rtc.py:685-696` (`names_foreign_stream`), used by `camera_sources.test_url` before `grab_probe`.

**Reasoning.** The guard exists because go2rtc's `frame.jpeg?src=<rtsp url>&name=<ours>` links our name to an EXISTING stream when the
URL's path names one (whatever the host). The guard compares the first path segment with the foreign stream names. From memory of
go2rtc's source (not verified against the deployed version) the match there is on the whole path after the first `/`. A foreign
stream whose name contains a `/` would then be matched by go2rtc and missed by the guard, and the stream test would return one
preview frame of that foreign stream. The foreign stream itself is not modified or deleted (the probe name is removed by key).
Reach: an administrator with `system.configure`, a foreign stream name with a slash. The stored-source path (`ensure_stream`, a PUT)
is not affected.

**Fix.** Compare the whole decoded path (and every prefix of it ending at a `/`) with the foreign names, not only the first segment.

---

## Improvements (short)

- `Go2rtc.ensure_stream` and `delete_stream` check the `smplwise_` prefix but not `NAME_RE`; `create_stream`, `frame_*`, `ws_url`
  check both. All callers build names with validated builders today; adding `NAME_RE` to the two makes the adapter self-sufficient.
- `cast_relay`: `_VALUE_RE.match`, `_PATH_RE.match`, `_PROBE_RE.match` use `$`, which also accepts a trailing newline (`n=5%0A`).
  Harmless as far as read (the id must be in `hls_ids`), but `fullmatch` states the intent.
- `source_policy.go2rtc_targets` resolves the go2rtc host with a bare `socket.getaddrinfo` (no timeout, not the bounded resolver)
  once a minute on a request thread; route it through `Resolver`.
- `apply_change` and its siblings record the change row and the audit row in autocommit inside `unlocked()` after the device write
  (the code says so itself at `routers/nvr_write.py`, "which records inside `unlocked`"). `_record` is an INSERT plus a separate
  UPDATE of `recorder_id`: a failure between the two leaves a row that names the first recorder, and its undo would go there. Put
  `recorder_id` (and `camera_id`, V-04) into the INSERT.
- `camera_reboot`: when the lock cannot be taken back after the device call, the row stays `sending` and no outcome audit row is
  written. A janitor step that closes `sending` rows older than a few minutes as `unconfirmed` would keep the log truthful.
- `nvr.py` reads most ISAPI answers with `r.text` uncapped; `device_http.read_capped` exists and is used by the batch paths only.
- On go2rtc 1.9.15+ every add-on restart rewrites every stream once (`_SOURCE_DIGEST` is in memory). Persisting the digests (they
  are digests, not sources) would avoid one DELETE + PUT per stream per restart.

## Checked and fine

go2rtc namespace guarantee (the focus of this review):
- Every write and delete in `services/go2rtc.py` refuses a name outside `smplwise_` before a request is built (`ensure_stream`,
  `create_stream`, `delete_stream`, `frame_jpeg`, `frame_existing`, `grab_probe`, `probe_video_codec`, `ws_url`,
  `discard_leased_stream`). No module talks to go2rtc's API outside this adapter (`cast_relay` goes through `fetch_capped` with fixed
  paths; the stream name there is the server's own).
- Callers: `autosync.ensure_streams` (names from `stream_name`; deletes by exact name, re-checked against the prefix; foreign streams
  only counted), `recorder_live.delete_streams` (`delete_listed`), `camera_sources` and `ha_camera_streams` (`OwnedStreams` with an
  exact shape regex; reconcile deletes only that shape), `playback` (instance-scoped prefix, noted before write), `live_codec`
  (transcode names and `ffmpeg:<our stream>` sources checked), `intercom_media` (leased / probe names only).
- Name collisions between features: new recorder ids are `nvr-<n>` only, `ha_` is refused as a recorder id, manual-camera and HA
  shapes cannot be produced by `stream_name`.
- Sources: `source_policy.source_refusal` (rtsp / rtsps only, loopback and link-local in every spelling, go2rtc's own host and ports,
  `src` / `name` query keys, `#`, resolver that fails closed when saturated) is applied to typed sources, ONVIF-assembled sources,
  HA-reported sources and the Frigate restream URL, and again at every ensure. `refuse_foreign` runs on the listing before a write.

Credentials:
- No log line in the reviewed modules prints a source, URL, password or exception text (class names and stable codes only);
  `redact_source` covers the two `log.info` lines of the adapter. ffmpeg stderr is redacted in thumbnails and Provision downloads;
  `subprocess` exceptions are logged by type only.
- The recorder connection view never returns the password; a stored password is not reused for a changed destination.
- ONVIF: closed allow-list of Get* actions, 64 KiB cap, no redirects, 3 s timeout, no DOCTYPE; one credential attempt per press with
  the lockout guard asked before the single Digest answer; stream addresses must be rtsp(s) to the answering address, without user
  info, fragment or go2rtc query keys; serial used only for the keyed fingerprint. Scan ranges: RFC 1918 site networks from the
  Supervisor only, at most 1,024 addresses, fail closed without a known site network.

NVR write safety:
- Order of guards on every write route read: installation permission, camera scope, writes switch (`nvr_write_guard`), then the
  device. Privacy masks: etag of the previewed state, validation against the device's frame, PUT + DELETE of merged regions, verified
  read-back, restore on failure, `changed_since` on undo. Camera reboot: permission at both scopes, vendor, switch, literal
  `confirm: true`, cooldown and per-user rate, reserved row before the device call. NVR reboot: typed word plus the switch.
  Manual recording: two-phase with a janitor stop.

Streaming resources:
- Live relay: session registered only after both caps are re-checked with nothing awaited; unregistered in `finally`; transcode
  budget released in `finally`; lease re-check stops the relay. Playback: seek order (generation bump, relay stop with bounded wait,
  delete, create), orphan sweep with a write grace, never-connected sessions dropped after 90 s.
- Cast relay request handling: token by SHA-256 lookup, fixed upstream paths, playlists checked line by line, HLS ids bound to the
  token, body caps, per-token rate limits. (Its socket handling is V-02.)
- Frigate HTTP gate (`recorders/frigate_http.py`): `fullmatch` allow-lists per method and write class, dot-segment refusal, body and
  reply caps, per-read timeouts under a whole-operation deadline.
- Exports: owner or administrator, camera scope at creation and at delivery, quotas, disk-full pause, no path taken from a request.

## Not covered (so the owner knows the gaps)

- Frigate service layer above the HTTP gate (`frigate_control_svc`, `frigate_config_svc`, `frigate_native_svc`, `frigate_events`,
  `frigate_perm_restream`, `routers/frigate*.py`): only the gate and the restream source were read.
- Media groups, multimedia router, media queue / commands / store / model, `notices/display.py`.
- `camera_discovery/service.py` (job manager, rate limits, the add step) beyond its structure; `wsd.py`, `sweep.py`, `known.py`.
- Recording search, recorded days, time-zone conversion (`recordings.py`, `recorded_days.py`, `provision_time.py`), playback groups.
- `nvr_settings.py` / `nvr_batch.py` / `nvr_encoding_batch.py` (stream encoding writes and batches), `nvr_system.py`, `nvr_schedule.py`.
- Frontend API clients, other than how `sw-live-player.ts` treats relay error frames.
