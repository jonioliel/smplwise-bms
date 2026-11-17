# CR-EXPORTS-HOUSEKEEPING-2440

Code-review batch 16.11, wave 3A (backend). Plan row `pilot/CR-EXPORTS-HOUSEKEEPING-2436` in
`private/code-review-2026-11-13/MASTER_PLAN.md`; findings 03:F08, 03:F18, 03:F25 (two texts), 03:F26,
05:P3-06 (`TimeoutExpired`).
Base: `origin/pilot/CR-WAVE2-COMBINED-2439` (`97080bbc4`).

## What and why

1. **The Provision export download can no longer hang on ffmpeg's stderr (03:F08).**
   `provision_playback.rtsp_download` started ffmpeg with `stderr=PIPE` and read it only after the process ended. A
   stream that made ffmpeg log errors for minutes filled the pipe, ffmpeg blocked on the write, and the export
   worker (one job at a time) waited out the 3,600 s timeout. A small thread (`_StderrTail`, thread name
   `export-ffmpeg-stderr`) now reads stderr while ffmpeg runs and keeps its last 8 KB. Chosen over a temporary
   file: the text can carry the source URL with its credentials, so it stays in memory. Same command, same exit
   handling, same scrubbed error tail (the last 160 characters, URL / user / password / host replaced).
2. **A stuck ffmpeg never leaks its command line (05:P3-06).** The 30 s wait for the finished or killed process could
   raise `subprocess.TimeoutExpired`, which carries the command line (the credentialed URL), and the export worker
   logs an unexpected exception with its text. The wait's time-out is now caught inside `rtsp_download`: the process
   is killed and the download fails with `503 download_refused` (`details.error = "ffmpeg_stuck"`), the refusal every
   other failure of it gives. Second line of defence in `exports.py`: the worker logs a `subprocess.SubprocessError`
   by its type only (no text, no traceback). Behaviour note: before, this rare case ended as an "unexpected" failed
   file with the exception's type; now it is a failed file with `download_refused`.
3. **The revocation hook dispatches through a table (03:F18).** `app_refresh.hook(name, ...)` resolved the name with
   `globals()[name]` inside its guard: a mistyped name became a warning line and a revocation that never ran. It now
   reads `app_refresh.HOOKS` (the six `revoke_*` functions; the four names callers use today resolve to the same
   functions). An unknown name raises `KeyError` at the call. A failure of the revocation itself is still logged
   and swallowed, as designed.
4. **Small duplicates (03:F26, the parts in this row's files).** The two `wait_idle` test helpers share
   `nvr_batch.threads_idle`; `log =logging.getLogger` spacing in `app_refresh.py`; the unused `import os` in
   `exports.py` is gone.
5. **Stale text (03:F25).** The `rtsp_playback_url` docstring no longer describes wiring "after CR-024"; it names the
   module that calls it today.

## Not done, and why

- **03:F25, the go2rtc module header** ("to be verified on the lab's go2rtc version"). `services/go2rtc.py` is not a
  file of this row (the go2rtc branches hold it), and the file records no lab finding about whether go2rtc persists
  API-created streams into its configuration file; the later 1.9.15 notes are about API shapes. Rewriting the header
  would state something nobody measured. Left for whoever verifies it on the lab.
- **03:F26, the parts outside this row's files:** the double `hashlib` import in `services/go2rtc.py` and the second
  `_raw_body` in `routers/nvr_write.py`. `routers/nvr_connection.py` already uses the shared `_common.raw_body`
  (wave 2), so that file needed no change.

## Files

Changed: `smplwise_vms/backend/smplwise/services/recorders/provision_playback.py`, `services/exports.py`,
`services/app_refresh.py`, `services/nvr_batch.py`, `services/nvr_verify.py`.
New: `smplwise_vms/backend/tests/test_exports_housekeeping_2440.py` (a fake ffmpeg that writes 200 KB to stderr
returns; the scrubbed error tail; abort and time-out; the stuck-reap case; every hook name a caller uses is in the
table; an unknown name raises; the shared wait).
Unchanged although listed in the row: `routers/nvr_connection.py` (see above).

Outside my rows: none.

## Tests actually run

See the end of this file (filled after the run).
