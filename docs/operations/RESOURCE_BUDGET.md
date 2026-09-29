# Resource budget and load measurements (T068)

**Status:** first reference measurement on 2026-09-16 (build 0.1.34) with `scripts/load_probe.py` against the developer
backend and the lab NVR / Home Assistant. These numbers describe *this* workstation and lab; the Home Assistant host
(the add-on's real home) has not been measured yet. Read-only probe: every request is a GET the UI issues anyway.

## Reference configuration

| Item | Value |
|---|---|
| Host | Windows 11 workstation, Python 3.12, SQLite WAL, one worker process (uvicorn), ffmpeg on PATH |
| Devices | Hikvision NVR over the LAN (11 channels, motion + continuous recording), Home Assistant with 351 synced entities |
| Catalogue | 1 site, 3 floors with published plans, 11 cameras, 2 placed pins + 4 zones on the probed floor, 717 events in the last 24 h |
| Backend process | 92.5 MB working set, 18 threads, 337 handles after ~10 minutes of uptime that included two probe runs and the HA snapshot |
| Probe | 8 concurrent workers × 5 rounds per endpoint (40 requests per endpoint), then 1 worker × 1 round for baselines |

## Baselines (one request at a time, warm caches)

| endpoint | p50 ms |
|---|---|
| health/summary | 59 |
| cameras | 35 |
| floor map | 44 |
| floor map at an instant (history) | 45 |
| events, last 24 h (717 rows, 500 returned) | 256 |
| events/facets | 44 |
| search | 47 |
| storage report (cached) | 16 |
| cases | 46 |
| camera recordings today (NVR search, cold) | 1494 |

## Under 8 concurrent workers

Run 1 (before the fixes below), backend warm:

| endpoint | n | errors | p50 ms | p95 ms | max ms |
|---|---|---|---|---|---|
| health/summary | 40 | 0 | 36.3 | 944.0 | 1167.9 |
| cameras | 40 | 0 | 14.6 | 335.8 | 614.5 |
| floor map | 40 | 0 | 15.9 | 581.4 | 730.3 |
| floor map @instant | 40 | 0 | 23.8 | 715.3 | 956.4 |
| events (24 h) | 40 | 0 | 100.3 | 4452.2 | 4903.9 |
| events/facets | 40 | 0 | 21.6 | 1073.1 | 1285.9 |
| search | 40 | 0 | 72.7 | 923.6 | 1171.0 |
| storage (cold cache) | 24 | 16 | 98.1 | 603.0 | 714.0 |
| cases | 40 | 0 | 77.1 | 1026.1 | 1494.2 |
| camera recordings today (cold) | 40 | 0 | 30.6 | 19845.3 | 23666.8 |

Run 2 (after the fixes), backend restarted seconds before the run (cold caches, HA snapshot being written):

| endpoint | n | errors | p50 ms | p95 ms | max ms |
|---|---|---|---|---|---|
| health/summary | 40 | 0 | 139.0 | 2070.9 | 2764.0 |
| cameras | 40 | 0 | 81.5 | 1052.7 | 1262.1 |
| floor map | 40 | 0 | 90.6 | 745.4 | 1407.0 |
| floor map @instant | 40 | 0 | 94.0 | 1039.3 | 1185.7 |
| events (24 h) | 38 | 2 | 325.1 | 7199.9 | 10520.3 |
| events/facets | 40 | 0 | 112.0 | 1500.8 | 1727.1 |
| search | 40 | 0 | 94.9 | 1673.2 | 1868.7 |
| storage (cold cache) | 40 | 0 | 68.5 | 51610.6 | 51862.4 |
| cases | 40 | 0 | 91.4 | 1226.0 | 1452.9 |
| camera recordings today (cold) | 40 | 0 | 81.3 | 2089.3 | 2632.9 |

## What the numbers say

- **Single requests are fast** (tens of milliseconds for every screen except the events list and a cold NVR search).
- **Concurrency was serialized until 0.1.47:** every request held SQLite's write lock for its whole life
  (`BEGIN IMMEDIATE`), so 8 simultaneous callers queued behind each other and p95 grew roughly linearly with the number
  of workers. Since 0.1.48 the busy GET handlers run in a deferred, query-only transaction (WAL readers never wait for
  the writer); only write requests still take the lock up front. The re-run at the end of this document shows the
  effect; the pilot budget of **up to 4 concurrent operators** is kept as the commitment, now with margin.
- **Fixed by this measurement:** (1) identical concurrent recording searches each ran their own NVR query behind the
  single-search lock — a cold "recordings today" p95 of ~20 s under 8 workers; an in-flight lock now lets followers reuse
  the first result (p95 2.1 s in run 2, on a cold backend). (2) The storage report was built by every concurrent first
  caller — 16 of 40 requests failed; it is now built once. The price is visible in run 2: callers arriving during the cold
  build wait for it (~50 s: eleven NVR "oldest recording" searches behind the single-search lock). Acceptable for an
  admin-only screen with a 10-minute cache; making the cold build asynchronous is listed below.
- **Run 2's events p95 (7.2 s, 2 errors)** happened while the storage build held the NVR search lock and the HA snapshot
  after the restart was writing 351 history rows; the two failed requests were not diagnosed in this session and are
  listed as open.
- **Memory:** 92.5 MB working set for the whole backend with HA sync, janitor and the export worker idle; no growth was
  visible across the two probe runs (92.5 → 92.6 MB). A multi-day leak check is still open.

## Budgets the pilot commits to (reference workstation)

| Budget | Target | Measured |
|---|---|---|
| Any screen, one operator, warm cache | p50 < 300 ms | met (max p50 256 ms, events list) |
| Map / live / search under 4 operators | p95 < 1.5 s | met at 8 workers since 0.1.48 (map 0.32 s, cameras 0.35 s, search 0.74 s) |
| Cold NVR search per camera-day | < 3 s, one query per key | met after the in-flight fix (2.1 s p95 at 8 workers) |
| Backend working set, idle + HA sync | < 200 MB | met (92.5 MB) |
| Live streams / transcodes | measured on the HA host, not here | open |
| SQLite write lock under mixed background + API load | 0 `database is locked`; innocent writer waits < 5 s; no hold > 3 s | met 2026-09-29 (0 errors, max wait 1.1-1.4 s, max hold < 1.2 s even with 5 s NVR search pages; see below) |
| Events list (24 h, 500 rows) under 8 alerts/s ingest + 8 readers | p95 < 1.5 s | met 2026-09-29: p50 1655 -> 191 ms, p95 2442 -> 663 ms (see "Events-window cache" below) |
| Device-free soak: restarts, ingest, readers, exports into a full disk | 0 `database is locked`, 0 HTTP 500, no thread / socket / subscriber growth, queues bounded, counters consistent | met 2026-09-29 for 10 minutes (all 21 checks; `SOAK_LOCAL.md`); 3-5 h still open |

### Bounds on caches and queues (T068, 2026-09-29)

Every in-process structure that grows with load has a fixed bound and a counter in `/health` (the drop / defer
policy is explicit, never "grow and hope").

| structure | bound | when full | where to see it |
|---|---|---|---|
| events-window cache (`services/events_cache.py`) | 32 windows, 5000 event rows in total (rows, not bytes: ~3 KB per row dict measured, so ≈ 15 MB worst case), TTL 5 s; the key carries the database file's identity (path, device, inode) | least recently used out; a window over 5000 rows is not cached | `/health` → `events.cache` (hits, misses, hit_rate, stale, evictions, size, rows) |
| thumbnail folder index (`thumbnails.INDEX`) | one id set per thumbs folder (the folder itself is capped at 200 MB by the prune) | re-read every 30 s; dropped by the prune | — |
| alert-ingest queue (`events_ingest.QUEUE`) | 256 waiting alerts | same camera / kind / state within 30 s (`DEDUP_WINDOW_S`) of the entry's first and newest alert: coalesced (stored as first + newest with the count between - the same rows as alert by alert); otherwise the oldest is dropped; at shutdown the writer stores what is queued for up to 5 s and counts the rest (`dropped_shutdown`) | `/health` → `backpressure.ingest_queue`, `events.ingest.queue` (accepted, processed, failed, coalesced, dropped, depth, high_water) |
| event WebSocket client queue | 200 pushes per socket (unchanged) | the push is dropped for that client | `events.ingest.ws_drops` |
| export queue | 20 waiting jobs (queued + paused) in total, 5 active per owner | 429 `export_queue_full` / `too_many_jobs` (retryable) | `/health` → `backpressure.exports` |
| data disk for exports | `storage.min_free_mb` (default 1024 MB; the same key guards T050 uploads) | new job: 507 `insufficient_storage` (also when the estimate would cross the line; a file listed without a size counts as the average known size, else 64 MB); running job: `paused_disk_full`, resumes by itself after a back-off (15 s, 1 min, then 5 min per pause in a row) once what it still needs - at least the bytes it reached before the pause - fits above the minimum + 64 MB, or from the storage screen. Not guarded: the ffmpeg remux after the download (it needs about the job's size again, briefly); a full disk there fails the remux and the raw NVR files are delivered instead | `/health` → `backpressure.data_disk`, `/storage/local`, the storage screen's "הדיסק של התוסף" card |
| export progress writes | at most one write transaction per second per job (was one per 256 KB chunk) | — | — |

### Events-window cache (2026-09-29)

`tests/test_events_cache_perf.py` (opt-in, `SW_EVENTS_PERF=1`): one temporary database seeded with 3000 events over
the last 24 h on 8 cameras; the NVR alert stream through the product's own listener at ~8 alerts/s on 8 channels (mostly
repeats of open bursts, every fifth a new row); 6 readers of the 24 h list (`limit=500`) and 2 of the facets, each waiting
0.2 s between requests; three 60 s phases with the same load. Reference workstation, quiet machine.

| phase | events list p50 / p95 / max | lists served | facets p50 / p95 | cache hit rate |
|---|---|---|---|---|
| before (pre-T068 code path: no cache, two `stat()` per listed event for its thumbnail) | 1655 / 2442 / 2954 ms | 192 | 155 / 238 ms | - |
| thumbnail folder index only | 320 / 612 / 999 ms | 655 | 106 / 173 ms | - |
| after (index + window cache, as shipped) | **191 / 663 / 1084 ms** | **784** | **82 / 179 ms** | 0.52 |

What the numbers say:
- The list's cost was not the query: a profile of one 500-row request showed ~80 % in `thumbnails.status_for` (two file
  `stat()`s per row on this Windows workstation). One folder listing per 30 s instead cut the list p50 by 5x.
- The window cache helps the facets and the p50 of the list; the list's p95 stays at the index-only level because at
  8 alerts/s every alert changes a row the list shows (a repeat bumps `count`), so most list requests arrive at a new
  version (hit rate of the list alone is low; the facets, which ignore repeats, hit most of the time). Correctness wins
  here on purpose: a cached list is never served for a version older than the data.
- In the 10-minute soak (mixed readers, ingest from both feeds) the overall hit rate was 0.29 with 6 entries / 1313 rows
  held - far below the bounds.

### SQLite write-lock contention (2026-09-29, round-10 lock storm)

`tests/test_db_contention.py` (opt-in, `SW_DB_LOAD=1`) runs 12 concurrent actors for 90 s through the product's own code
(HA state pushes ~40/s, alert stream, audit, 4 API clients, export create, `events_derive`, manual recording, a probe
writer) with faked devices. Before the fix, device calls ran inside write transactions: with 5 s NVR search pages it
produced 24 `database is locked` + 25 HTTP 500 in 368 operations and an 11.4 s probe wait; after the fix 5805 operations,
0 errors, 1.14 s maximum wait. Pure contention (instant devices) was never a storm: ~4-6k operations, 0 errors, ~30 ms
p50 per tiny write transaction on this workstation (new connection + BEGIN IMMEDIATE + fsync'd commit). Budget rule:
nothing slow under the write lock - device calls in `unlocked()`, notifications after the commit, responses sent after
the commit; `/health` → `db.write_lock` shows the longest hold and its holder. Full write-up:
`TEST_ROUND_RESULTS_2026-09-26_ROUND10_HE.md` section 4.

## Not measured yet (open)

- Live streams and transcodes versus CPU on the Home Assistant host itself (go2rtc runs there; this workstation only
  relays). Time-to-first-frame is a browser measurement (planned in VISUAL_REGRESSION.md).
- A 24-hour soak with HA / go2rtc / NVR restarts on the real devices; today's evidence is ~25 backend restarts during the
  day with the health report back to OK within 15–25 s each time, and HA reconnecting on its own. The device-free part
  (fake NVR / HA restarting, ingest, exports into a full disk, backpressure) runs since 2026-09-29: `SOAK_LOCAL.md`; a
  3-5 h run of it (`--minutes 240`) is still open.
- Backpressure on the live relay (go2rtc streams) - device-dependent. The export queue under a full disk is covered by
  the device-free soak.
- The events list itself: with the lock gone, eight concurrent 24 h lists still take ≈ 3.1 s each (p50 ≈ p95) because
  they now share the CPU instead of queueing — the list is built in Python per request (derived events, filters,
  spatial joins); caching the assembled day or paging the derivation is the next optimisation. Done since this section
  was written: read-only connections (0.1.48), background build of the storage report (0.1.47), and the two events-list
  errors of run 2 did not reproduce in the 0.1.47 and 0.1.48 runs.

Re-run: `python scripts/load_probe.py --workers 8 --rounds 5 --markdown out.md` with the dev backend up.

## Re-run 2026-09-17 morning (0.1.47, after the janitor, playback-quota and storage warm-up changes)

`python scripts/load_probe.py --workers 8 --rounds 5` against the developer backend, lab NVR and HA, right after a
restart (storage report warmed in the background in 42.7 s):

| endpoint | n | errors | p50 ms | p95 ms | max ms |
|---|---|---|---|---|---|
| health/summary | 40 | 0 | 128.2 | 2705.1 | 3147.2 |
| cameras | 40 | 0 | 101.9 | 1019.6 | 1503.2 |
| floor map | 40 | 0 | 94.9 | 1123.8 | 1252.7 |
| floor map @instant | 40 | 0 | 102.7 | 1381.0 | 1512.7 |
| events (24 h) | 40 | 0 | 232.5 | 8955.3 | 9653.3 |
| events/facets | 40 | 0 | 119.0 | 1836.2 | 2043.2 |
| search | 40 | 0 | 108.0 | 1261.1 | 1771.7 |
| storage (cached) | 40 | 0 | 64.4 | 1048.4 | 1379.9 |
| cases | 40 | 0 | 103.2 | 952.1 | 1344.4 |
| camera recordings today | 40 | 0 | 67.2 | 1792.5 | 2445.7 |

Findings: the two events-list errors seen on 2026-09-16 did not reproduce (0 errors on every endpoint); the
storage report is never cold any more (warmed at start-up and every 8 minutes by the janitor, cache 10 minutes);
the events list under eight concurrent workers still shows the serialisation cost of the write lock taken by
every request (p95 ≈ 9 s for the 24 h list; p50 232 ms) — read-only connections for GET handlers remain the next
optimisation and are not in the pilot.

## Re-run 2026-09-17 (0.1.48, read-mode connections for the busy GET handlers)

`python scripts/load_probe.py --workers 8 --rounds 5` against the developer backend, lab NVR and HA, right after a
restart (storage report warmed in the background in 31.9 s), with the same catalogue as the 0.1.47 run:

| endpoint | n | errors | p50 ms | p95 ms | max ms |
|---|---|---|---|---|---|
| health/summary | 40 | 0 | 370.5 | 912.2 | 919.1 |
| cameras | 40 | 0 | 297.9 | 350.1 | 384.3 |
| floor map | 40 | 0 | 271.8 | 322.9 | 329.8 |
| floor map @instant | 40 | 0 | 295.7 | 349.3 | 352.7 |
| events (24 h) | 40 | 0 | 3086.6 | 3457.1 | 3634.7 |
| events/facets | 40 | 0 | 240.2 | 306.2 | 345.2 |
| search | 40 | 0 | 560.6 | 741.5 | 813.0 |
| storage (cached) | 40 | 0 | 172.0 | 386.4 | 407.9 |
| cases | 40 | 0 | 288.0 | 359.2 | 413.9 |
| camera recordings today | 40 | 0 | 192.2 | 1814.6 | 1831.2 |

Single worker × 3 rounds on the same backend (per-request cost without contention):

| endpoint | n | errors | p50 ms | p95 ms | max ms |
|---|---|---|---|---|---|
| health/summary | 3 | 0 | 54.2 | 69.1 | 69.1 |
| cameras | 3 | 0 | 37.3 | 38.8 | 38.8 |
| floor map | 3 | 0 | 37.8 | 38.6 | 38.6 |
| floor map @instant | 3 | 0 | 62.1 | 68.7 | 68.7 |
| events (24 h) | 3 | 0 | 285.4 | 293.9 | 293.9 |
| events/facets | 3 | 0 | 50.7 | 51.1 | 51.1 |
| search | 3 | 0 | 43.1 | 48.4 | 48.4 |
| storage (cached) | 3 | 0 | 14.9 | 15.8 | 15.8 |
| cases | 3 | 0 | 17.1 | 23.4 | 23.4 |
| camera recordings today | 3 | 0 | 43.1 | 1528.8 | 1528.8 |

Findings: no request waited for the write lock any more — p95 fell from 9.0 s to 3.5 s on the 24 h events list, from
2.7 s to 0.9 s on the health summary and from 1.0–1.8 s to 0.3–0.35 s on the map, cameras, facets, storage and cases
(0 errors, no "database is locked" in the log). The p50 of the busiest endpoints rose (events 0.23 s → 3.1 s) because
eight requests now really run at the same time and share one Python process instead of one running while seven wait:
the wall time of a round of eight fell from 9.7 s to 3.6 s, but every caller in that round pays about the same. The
single-worker table shows the cost of one request stays where it was (the deferred BEGIN and `query_only` add nothing
measurable). "Camera recordings today" keeps its NVR-bound p95 (one search per camera-day behind the in-flight lock).

Second run, ten minutes later on the same backend (steady state: thumbnails of the listed events already generated,
no start-up work left):

| endpoint | n | errors | p50 ms | p95 ms | max ms |
|---|---|---|---|---|---|
| health/summary | 40 | 0 | 78.5 | 88.2 | 94.1 |
| cameras | 40 | 0 | 83.2 | 93.2 | 95.5 |
| floor map | 40 | 0 | 75.7 | 85.3 | 145.0 |
| floor map @instant | 40 | 0 | 78.5 | 149.3 | 157.7 |
| events (24 h) | 40 | 0 | 793.5 | 863.1 | 872.1 |
| events/facets | 40 | 0 | 60.3 | 78.6 | 99.2 |
| search | 40 | 0 | 165.8 | 176.6 | 181.5 |
| storage (cached) | 40 | 0 | 30.8 | 40.9 | 51.0 |
| cases | 40 | 0 | 77.4 | 87.5 | 109.4 |
| camera recordings today | 40 | 0 | 43.2 | 1476.6 | 1479.4 |

The first run after a restart pays for what the requests themselves trigger — every 24 h events list queues up to 30
missing thumbnails, each an ffmpeg grab from the NVR that competes for the CPU — plus the HA snapshot and discovery
still settling; the steady-state run is what an operator sees during the day: p95 under 0.2 s on every screen except
the 24 h events list (0.86 s for 500 rows under eight concurrent callers) and the NVR-bound recordings search.
