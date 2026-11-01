# PLAYBACK-SCRUB-2341 - fast scrubbing in recorded playback: native pins, less socket churn, nearest-frame previews

Branch `fix/PLAYBACK-SCRUB-2341`, cut from `origin/release/2332-train` @ `bc7b7ded0` (2.33.2 with the crash guard,
`docs/changes/SEGFAULT-PLAYBACK-2332.md`). Owner-approved 2026-11-01. No version bump, no CHANGELOG edit, no migration, no new add-on
option. One new product setting (`playback.max_seeks_per_min`, API only). Root cause of the 2.33.0 SIGSEGV is still **NOT PROVEN**: this
change removes the conditions it happened under (fresh native wheels, a burst of generations, an old relay socket closing while the new
one opens), it does not prove which native frame crashed. The crash guard's faulthandler stack remains the evidence to wait for.

## 1. A build fix found on the way (2.33.2 train)

`smplwise_vms/Dockerfile` on `release/2332-train` (commit `837481230`) has a literal backslash-n inside the `ENV` instruction:
`PYTHONUNBUFFERED=1 \n    PYTHONFAULTHANDLER=1`. Docker reads `\n` as an escaped `n`, i.e. a word without `=`, which is a syntax error
in `ENV name=value ...` ("can't find = in ..."): **the 2.33.2 image should fail to build** (Supervisor install/update fails). This
follows Docker's ENV parsing rules; it was not confirmed by an image build here (no Docker on the workstation). Fixed here (a real line continuation),
and `test_dockerfile_env_block_is_well_formed` guards it. If 2.33.2 ships before this branch, cherry-pick that one-line fix first.

## 2. Native networking dependencies pinned (why these versions)

The add-on image is built by the Supervisor from PyPI at install time. `uvicorn[standard]==0.53.0` was pinned, but its native
extras were not: uvicorn 0.53.0 asks for `uvloop>=0.15.1`, `httptools>=0.8.0`, `websockets>=13.0`, so an image built on 2026-11-01
received the newest wheels of the week. What PyPI offered then (read 2026-11-01 from the PyPI JSON API and the projects' GitHub
release notes / issues):

| Package | Pinned | Newest | Why the pin |
|---|---|---|---|
| uvloop | **0.22.1** (2025-10-16) | 0.23.0 (2026-09-30) | 0.23.0 is one month old and rewrites the transport write path (#619), moves context enter/exit into the C API (#627) and upgrades libuv to 1.52.1 - all on the socket path that was being opened and closed at the crash. An image built after 2026-09-30 (2.33.0 on home-oliel) most likely ran 0.23.0 (not proven: the crash guard's start-up line now logs it). 0.22.1 has a year of field use. Its one fix we give up (#740, fd double-close when `create_connection(sock=...)` is cancelled) is not on our path: the relay connects to go2rtc by host and port, never with `sock=`. **Open upstream:** issue #706 reports a SIGSEGV in `__uv_close_handle_cb` (handle close, Python 3.12) on 0.22.1; no release fixes it and its root cause is unknown, so no uvloop version is free of a known socket-close crash report. That is why the crash guard's safe mode (pure-Python loop and parser after two crashes) stays, and why the order of socket teardown is fixed below. |
| httptools | **0.8.0** (2026-05-25) | 0.9.0 (2026-10-09) | 0.9.0 (llhttp 9.4.3, three weeks old) is in the same fresh-build window; 0.8.0 is the floor uvicorn 0.53.0 accepts, carries the URL-truncation security fix (#144) and is the version of the documented add-on image build (`docs/evidence/electricity-pdf-addon-image/report.txt`). No segfault report exists for either. |
| websockets | **15.0.1** (2025-03-05) | 17.4 | The range `>=13,<16` resolved to 15.0.1 anyway (same evidence report, same dev venv). An exact pin removes the drift; 16.x/17.x need the HA client review the old range already asked for. One segfault report in the project's history (2023, closed, not reproducible). |
| uvicorn[standard] | **0.53.0** (unchanged) | 0.54.0 | Already exact. |

`smplwise_vms/backend/requirements.txt`: `uvloop==0.22.1; sys_platform != "win32"` (uvloop does not exist on Windows),
`httptools==0.8.0`, `websockets==15.0.1`; the websockets range line is gone. `management/upstream_watch.json`: `py-websockets` now has
`current.version` 15.0.1 (the registry test requires a pinned item to name its pin), new items `py-uvloop` and `py-httptools` watch for
releases with crash / close / libuv / llhttp keywords; `py-uvloop`'s note says to read issue #706 before any upgrade.

## 3. Less socket churn

### Frontend (`frontend/src/api/seek-coalescer.ts`, `frontend/src/screens/investigate-playback.ts`)
- Every timeline seek and every nudge button goes through a `SeekCoalescer`: only the **last seek requested within 250 ms** is sent
  (trailing debounce; the cursor moves at once), **one seek in flight**, **at most one pending** behind it (a newer one replaces it).
  So a drag or a burst of clicks makes one new generation, not one per click.
- A seek the screen could not start because it was busy with something else (its own automatic resume) is retried 200 ms later
  unless a newer one arrived, so the operator's last position is never dropped (before: silently skipped).
- 429 `seek_rate` / 409 `seek_busy` from the server: the Hebrew notice line shows the server's text, the cursor returns to what is
  actually playing, the current generation keeps playing.

### Backend (`services/playback.py`, `services/relay.py`, `routers/playback.py`, `routers/playback_groups.py`)
A seek is now strictly ordered:
1. one seek per session at a time (`seek_lock`, a second one waits up to 15 s, then 409 `seek_busy`);
2. the rate cap (below) - refused before anything is torn down;
3. the generation bump (a socket of the old generation that connects now gets 4410; one accepted a moment ago sees it before it
   opens its upstream socket and never connects to go2rtc);
4. the old generation's relay socket is **told to stop** (`RelayHandle.stop`: `loop.call_soon_threadsafe(stop_event.set)`, an
   `asyncio.Event` that `relay_ws` now waits on next to its pumps - immediate, not the 1 s poll) and the seek **waits** (max
   `RELAY_CLOSE_WAIT_S` = 3 s) until `relay_ws` has returned, i.e. until its `async with websockets.connect(...)` has closed the
   go2rtc socket;
5. only then is the old go2rtc stream deleted;
6. only then is the new stream created.
Before, the old stream was deleted while its relay socket was still open (go2rtc dropped that socket under it) and the new socket
could be accepted in the same moment - the "open-while-closing" window of the 2.33.0 crash log. `close()` (DELETE, beacon, janitor,
revocation, group close) follows the same order. A relay that does not close in time is logged and the seek goes on (bounded).

**Cap:** setting `playback.max_seeks_per_min` (default 30, 0 = no cap, 0..600, `PATCH /api/v1/settings`), per session in a rolling
minute. Over it: `429 seek_rate`, retryable, message "יותר מדי קפיצות בזמן בדקה האחרונה (עד N בדקה); הניגון ממשיך מהנקודה הנוכחית.
אפשר לקפוץ שוב בעוד S שניות.", `details.retry_after_s`. A group seek checks every member first and refuses as a whole (a group never
moves some tiles and leaves one behind). With the 250 ms coalescing a person scrubbing continuously makes at most ~4 seeks a second
only while clicking, so 30 a minute is reached only by a real storm. No settings-screen row was added (that would change the
diagnostics screen's pixel baselines); the value is editable through the settings API.

## 4. Smooth scrubbing previews

### Backend (`routers/frames.py`)
`GET /cameras/{id}/frame?at=` returned 404 for every second where the NVR handed over no picture (a gap, the last seconds of a
file, a keyframe-less start) and negative-cached it for 10 minutes. Now:
- The camera's recording segments around `at` (+-30 s) come from the existing recordings search (`recordings.search_segments`, its own
  cache), asked for whole 10-minute windows so hovering along the timeline reuses one cached question.
- `nearest_candidates`: inside a segment the asked second, then one more try 10 s on (back, at the segment end); in a gap the nearest
  edge of the neighbouring segment (1 s inside its start / 3 s before its end) within 30 s. At most two grabs per request.
- **404 only when no recording lies within 30 s** (negative-cached as before). The recording exists but the recorder did not hand
  the picture over: **503 `frame_retry`** (retryable), that picture is not asked again for 30 s. No grab slot free within 8 s: **503
  `frame_busy`** (not remembered). Search unavailable (recorder offline): the asked second, exactly as before (404 when it fails).
- `X-Frame-At` names the picture's own instant, `X-Frame-Asked` the asked one.
- Recent pictures per camera in memory (`FrameMemo`: 48 per camera, 16 cameras, LRU) plus which asked bucket resolved to which
  picture; the disk cache under `/data/thumbs/frames` stays as it was.
- One grab per (camera, bucket) at a time (single flight: identical hovers wait for the first one's result); still at most two grabs
  at once (`_sem`), and no unbounded wait for a slot.
- Still never decodes an image in the server process (ffmpeg child process, bytes served as stored).

### Frontend (`frontend/src/api/frame-preview.ts`, `investigate-playback.ts`)
- `FramePreviewLoader`: requests keyed by camera + 10-second bucket (the URL asks for the bucket start, so the browser cache helps
  too); a bucket that is cached, loading or known to have no recording is never asked again; at most two requests in flight and one
  waiting; when the slots are full of buckets nobody looks at any more, the oldest is aborted (`AbortController`); a finished stale
  request still fills the cache (40 object URLs, LRU, revoked on eviction / camera change / leaving the screen).
- The popover follows the pointer at once and keeps the **last good picture** (slightly dimmed) while the next loads; "אין הקלטה בזמן
  זה" only on a 404; a 503 keeps the picture. The request waits for the pointer to rest 120 ms (was 250 ms before showing anything).

## 5. Tests

| File | What | Result (workstation, Windows) |
|---|---|---|
| `smplwise_vms/backend/tests/test_playback_scrub_2341.py` | nearest-frame search (inside, gap before / after, out of window, malformed, one candidate per bucket), aligned search window, `FrameMemo` bounds; endpoint: nearest picture instead of 404 with `X-Frame-At`, memory hits without a grab, 404 only without recording + negative cache, 503 + 30 s retry memory, search-unavailable fallback, single flight (6 identical hovers -> 1 grab), <= 2 grabs at once, `frame_busy` instead of a queue; seek rate cap (counting, retry_after, rolling window, 0 = off), setting default / bounds; seek ordering (stop -> relay closed -> delete old -> create new), bounded wait for a relay that never closes, two concurrent seeks never overlap, a capped seek tears nothing down, close in the same order; `relay_ws` `stop_event` against real sockets (uvicorn asyncio+h11 and a fake go2rtc): stops at once, 4410 to the browser, upstream socket closed; exact pins in requirements.txt; well-formed Dockerfile ENV | see the closing report |
| `smplwise_vms/backend/tests/test_frames.py`, `test_playback_stress_2332.py` | unchanged assertions; the recorder search is stubbed as unreachable (they have no recorder) so they keep testing the asked-second path | |
| `frontend/tests/unit-playback-scrub.spec.ts` | coalescer with a fake clock (burst -> last one only, spaced seeks each sent, one in flight + one pending with replacement, debounce honoured after an in-flight finishes, busy retry, flush / cancel / a throwing run); frame loader with a fake fetch (bucket de-dup, stale abort at two in flight, last good picture kept, a stale result fills the cache / a hole, 404 vs 503, clear / dispose / LRU revoke) | |

Not covered here: a browser run of the playback screen (the workstation does not run vite / Playwright page specs tonight), the
uvloop variant (Windows has no uvloop; runner), and the real NVR (read-only lab access was not part of this task).

## 6. Rollback
Revert the branch commits. The Dockerfile line fix should be kept (2.33.2 does not build without it). The new setting key stays in
the settings table harmlessly (unused after a revert).
