# SEGFAULT-PLAYBACK-2332 - the add-on process crashed (SIGSEGV) during recorded-playback scrubbing

Branch `fix/SEGFAULT-PLAYBACK-2332`, cut from `origin/release/2331-train` @ `3c74a5da5` (the 2.33.1 train) so it can ship as a fast
hotfix. No version bump, no CHANGELOG edit, no migration, no new add-on option, no new dependency, no UI source change.

## 1. The incident

home-oliel, add-on **2.33.0** (Supervisor `/addons/<slug>/info`, read 2026-11-01; `watchdog: false`). Add-on log (read-only through
HA core's `/api/hassio/addons/<slug>/logs`, redacted copy kept in `private-evidence/segv-2332/`, never in git), 2026-11-01 19:25-19:27
local time:

- one camera, track 1401; within ~90 s three playback sessions and eleven generations (`smplwise_pb_<cam>_<session>_g0..g7`), each
  seek creating a new go2rtc stream and closing the previous relay socket (`socket closed: superseded`);
- interleaved `GET /cameras/<id>/frame?at=...` requests (timeline hover), about half `404` ("no picture there"), the rest `200`;
- `frigate ws (nvr-2): source_forbidden` warnings every ~30 s (a separate recorder, unrelated thread);
- last lines: `WebSocket .../playback/sessions/<id>/ws?generation=1 [accepted]`, `connection open`, then `Segmentation fault (core
  dumped)` and `s6-rc: ... legacy-services: stopping` - the container stopped and, with the watchdog off, stayed down.

The log history available on the device (journal back to 2026-10-24, three boots) holds **this one** segmentation fault; every other
stop is an ordinary SIGTERM stop (updates/restarts). No faulthandler output exists: the server did not enable it, so the crash left no
Python stack.

## 2. What native code runs on that path (evidence, not a guess)

| Path | Native code in the server process | Verdict |
|---|---|---|
| `GET /cameras/{id}/frame` (`routers/frames.py`) | none for the picture: `thumbnails._grab` runs **ffmpeg as a child process** (`subprocess.run`, timeout 25 s) and the JPEG is served as file bytes (`FileResponse`). No Pillow, PyAV, cv2 or ctypes. sqlite3 per request (own connection, `unlocked()` around the grab). | A truncated / garbage JPEG cannot crash the server here; an ffmpeg crash kills only the child (`returncode != 0` -> 404). Pillow decode of a truncated JPEG is **ruled out** for this path (test below). |
| playback relay socket (`routers/playback.py` -> `services/relay.py`) | the event loop and transports (**uvloop / libuv** in the add-on: `uvicorn[standard]`, loop `auto`), the HTTP parser of the upgrade request (**httptools**), `websockets` (server side via uvicorn; client to go2rtc; its C `speedups` only masks frames) | the only native code that drives the sockets that were being opened, superseded and dropped at the moment of the crash |
| sqlite3 | one connection per request / per lease check (`Database.connection`), opened `check_same_thread=False` but never shared by two threads at once; the per-request dependency runs enter / exit in the thread pool sequentially | no shared-connection pattern found |
| image work with Pillow / numpy | floor images, plans, camera image health (`services/camera_image_health.py`, a background poller that is off by default and not on this path) | not on the crash path |
| frigate alert stream (nvr-2) | `websockets.sync` client in its own thread, reconnecting every ~30 s with `source_forbidden` | concurrent, but no link to the crash moment |

**Root cause: NOT PROVEN.** The crash came within milliseconds of a playback relay socket being accepted while the previous generation's
relay was being torn down; in that window the native code at work is uvloop/libuv and httptools (plus websockets' masking helper).
Known crash classes there (transport close/write races in uvloop under rapid open/close) fit the timing, but without a stack this stays a
hypothesis. Pillow / PyAV / cv2 are not on the path; sqlite connections are not shared across threads. The exact uvloop / httptools /
websockets versions inside the 2.33.0 image are not known from here (`websockets>=13,<16` and uvloop are unpinned; the image is built by
the Supervisor from PyPI) - from this fix on, the start-up log names them.

## 3. Changes

### (a) The next crash leaves a Python traceback
- `smplwise/crashguard.py` `enable_faulthandler()` - called first thing by `python -m smplwise` (`__main__.py`): `faulthandler` for all
  threads into `/data/crash/faulthandler.log` (append, one `=== smplwise run pid=... at=... ===` marker per run, cut back past 512 KB).
- `PYTHONFAULTHANDLER=1` in the Dockerfile and in run.sh: the interpreter's own handler (stderr) covers the moments before that.
- After a crash the supervisor copies that run's faulthandler output into the add-on log, so the log shows the stack too.
- Start-up log line `smplwise.crashguard: faulthandler on (...); native: python=... libc=... sqlite=... uvloop=... httptools=...
  websockets=... uvicorn=... pillow=... numpy=... cryptography=... pydantic-core=...`.

### (b) Self-healing instead of a stopped container
- run.sh: `exec python3 -m smplwise.crashguard` (was `exec python3 -m smplwise`). The crash guard (stdlib only, imports no application
  code) runs the server as a child with inherited stdout/stderr and forwards SIGTERM / SIGINT / SIGHUP.
- A death **from a signal** that nobody asked for (SIGSEGV, SIGABRT, SIGBUS, SIGILL, SIGFPE, SIGKILL of the OOM killer ...) is recorded in
  `/data/crash/restarts.json` (time, signal name, uptime; last 20 kept, total count) and the server starts again after 2, 4, 8 ... s
  (cap 60 s; a run longer than 10 minutes resets the series).
- An ordinary exit (0 or a positive code) and any stop (SIGTERM / SIGINT / SIGHUP, also when it reaches the child before the supervisor)
  end the supervisor with the child's code, exactly as before; s6 then stops the container as before.
- The watchdog stays as it was (`config.yaml`: `watchdog: http://[HOST]:[PORT:8099]/healthz`, `init: false`): `/healthz` is served by the
  child; during a 2-8 s backoff (plus the server's start-up time) it is briefly unreachable. If the Supervisor's watchdog restarts the
  add-on in that window, the result is the same as before this fix (a full restart) - its exact grace period was not verified here.
- Health: **Settings > Diagnostics** shows a card "הפעלות מחדש אחרי קריסה" once a crash was recorded (warn while one is less than 24 h
  old or safe mode is on; details: crashes in 24 h, total, last time / signal / uptime, where the trace is). The top-bar summary shows
  "שרת התוסף קרס והופעל מחדש אוטומטית (N ביממה האחרונה)" while a crash is less than 24 h old. Both are rendered by the existing generic
  check / summary components - no UI source change, no build needed.

### (c) Root-cause side: safe mode (removes the native loop / parser from the server after repeated crashes)
- Two native crashes within 6 hours start the server in **safe mode**: `SW_UVICORN_LOOP=asyncio`, `SW_UVICORN_HTTP=h11` (read by
  `__main__.server_impl()` and passed to `uvicorn.run(loop=..., http=...)`) - the pure-Python event loop and HTTP parser instead of
  uvloop / httptools, i.e. none of the native code that drives the playback relay sockets. It ends by itself when the window holds fewer
  crashes (checked at every start). A log warning and the diagnostics card say when it is on.
- Not done, on purpose (no evidence): no change to the frame endpoint (it does not decode in-process), no sqlite change (no shared
  connection), no relay rewrite. If the next crash's faulthandler stack points elsewhere, the fix follows the stack.

## 4. Tests

| File | What |
|---|---|
| `tests/test_crashguard_2332.py` | exit classification and the restart rule (signal vs exit vs stop signal vs forwarded stop); backoff 2/4/8/../60 and the stable-run reset; safe mode after 2 crashes in the window and its end; child env (faulthandler, safe-mode loop/parser) and `server_impl`; bounded crash record without paths; the supervisor loop with fake children (two SIGSEGV -> two restarts -> safe mode; ordinary exit code kept; SIGTERM child not restarted; a forwarded stop is not a crash; a stop during the backoff); a real child crashed with `faulthandler._sigsegv()` leaves its stack (function name, all threads) under its run marker in `crash/faulthandler.log`; log cut-back; a real end-to-end supervisor restart of a segfaulting child (POSIX only); run.sh / Dockerfile / config.yaml watchdog wiring; the supervisor imports no application code; the native-versions line; the health report card and the summary item in Hebrew (shown / warn / ok-when-old / absent) |
| `tests/test_playback_stress_2332.py` | a 90-request frame burst from 12 threads with garbage / truncated JPEG bytes and 404s while `PIL.Image.open` raises: never decodes in-process, bytes served unchanged, at most 2 grabs at once; the relay under a real uvicorn server (`asyncio`+`h11`, `asyncio`+`httptools`, `uvloop`+`httptools`) against a fake go2rtc streaming binary: 80 sockets in waves of 8, rapid closes, abrupt transport aborts and seeks superseding live sockets - no upstream socket left open, the server still answers |

`tests/test_self_update_s3_fixes.py` (security guard "every child process gets `minimal_env()`"): one explicit exemption,
`SERVER_SPAWN = {("crashguard.py", "subprocess", "Popen")}` - the crash guard starts the server itself, which needs the environment it
always had under `exec` (Supervisor token, SW_* settings); `test_crashguard_2332.py` pins that the child gets the supervisor's environment
plus four fixed, non-secret keys only. Reviewer: please confirm this exemption.

The stress test does **not** reproduce a segmentation fault: the workstation is Windows (no uvloop; Python crashes there are access
violations, not signals). The uvloop variant and the POSIX end-to-end supervisor test are skipped on Windows and are meant for the runner.

## 5. Owner actions now
1. Home Assistant > Settings > Add-ons > SmplWise Arx > turn **Watchdog** on (it is off on home-oliel). Until this hotfix is installed it is
   the only thing that brings the add-on back after a crash; afterwards it still covers a hang (healthz not answering).
2. After installing the hotfix: if the add-on crashes again, the log will show `[crashguard] server process died from SIGSEGV ...`
   followed by the faulthandler stack, and Diagnostics will show the card. Send that log part (it holds no credentials) - the stack names
   the native module and the fix follows it.

## 6. Rollback
Revert the branch commit(s): run.sh goes back to `exec python3 -m smplwise`; `/data/crash/` is then simply unused (safe to delete).
