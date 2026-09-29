# Soak (device-free) — T068

**What it is:** `smplwise_vms/backend/tests/soak/soak_local.py`, a soak of the whole backend in one process against a
fake NVR and a fake Home Assistant that restart on a schedule. It is the device-free half of T068 (AT136: soak,
HA / NVR restarts, export queue with a full disk, backpressure). The device-dependent half — the real NVR, go2rtc
restarts, streams and transcodes on the Home Assistant host — stays on the lab checklist.

## Run it

```
cd smplwise_vms/backend
SW_SOAK=1 python tests/soak/soak_local.py --minutes 10 --out <scratch>/soak.json
# or through pytest (same run; fails when a check fails)
SW_SOAK=1 SW_SOAK_MIN=10 SW_SOAK_OUT=<scratch>/soak.json python -m pytest tests/soak/soak_local.py -s -p no:cacheprovider
```

Options: `--nvr-every` (s, default 120), `--ha-every` (s, default 150), `--rss-slope-mb-h` (default 60).
`SW_SOAK_TRACEMALLOC=1` adds the top Python allocation growth between the end of the warm-up and the end of the run
(diagnosis only: tracemalloc slows everything down enough to distort the lock and latency numbers).
Nothing leaves the machine: everything listens on 127.0.0.1, the data directory is a fresh temporary folder, and the
script refuses to run inside the add-on (`SUPERVISOR_TOKEN`).

## What runs

| actor | what it does |
|---|---|
| fake NVR (HTTP) | `alertStream`: 8 channels of motion bursts (5 s active, 1 inactive, 2 s quiet) ≈ 6 alerts/s + a heartbeat every 5 s; `ContentMgmt/search`: 3 files covering the requested window; `ContentMgmt/download`: the file's bytes, paced (~1.3 s per 2 MB). Restarted every 120 s, down 10 s and 50 s alternately (the 50 s outage is longer than the 45 s coverage-gap threshold) |
| fake Home Assistant (WebSocket) | auth, config, states, the four registry listings, `subscribe_events`; ~10 `state_changed`/s (motion sensors become HA events, power sensors only update states). Restarted every 150 s, down 8 s |
| the application | the real lifespan: alert-stream reader + writer, HA sync, export worker, janitor, thumbnail worker (frame grab faked) |
| 3 readers | events list, facets, timeline, windows, health, storage/local, unacked list, exports list; 0.2 s apart |
| acker | acknowledges the newest unacknowledged event every 5 s |
| WebSocket client | `/events/ws`, 20 s per connection, reconnects |
| slow database | holds SQLite's write lock for 3 s every 40 s (another process, an fsync stall) |
| exporter | a 30-minute export every 2 s into a pretend 50 MB data disk (`storage.min_free_mb` = 20, resume margin scaled to 2 MB); keeps 5 finished jobs in even minutes (the disk fills: 507s, jobs paused mid-download) and 1 in odd minutes (room again: automatic resume) |

Sampled every 5 s: working set / private bytes, threads, handles (Windows) or fds (Linux), Python object count, queue
depths, export jobs waiting; TCP connections of the process by state every 30 s.

## What is asserted

After the run, a drain (room on the disk again, both feeds up, up to 120 s) and the application's shutdown:

- no `database is locked` in the log and `db.write_lock.busy_errors` = 0; no HTTP 500;
- working set and private bytes slope after the warm-up (30 % of the run, at least 60 s) below `--rss-slope-mb-h`;
- threads (max − first after warm-up ≤ 12), handles / fds (≤ +150), TCP connections (≤ 60 open, ≤ 5 `CLOSE_WAIT`);
- no product thread (`alertstream`, `alertstream-writer`, `ha-sync`, `intercom-sync`, `export-worker`, `event-thumbs`,
  `storage-warm`) alive 30 s after shutdown;
- ingest queue within its bound; `accepted = processed + failed + coalesced + dropped + depth`; every submitted alert
  accepted; the listener read what the NVR sent (documents cut by a restart excepted); when nothing was dropped, the
  stored burst counts (`SUM(count)` of the motion rows) equal the number of motion alerts - coalescing loses nothing;
- WebSocket subscribers back to zero; export jobs waiting never above `MAX_QUEUED_TOTAL`;
- every 507 the client received was counted (`refused_disk`); at least one job paused for a full disk and resumed;
  nothing left queued / running / paused after the drain;
- both feeds connected again after their last restart; no soak client hung.

## Results

10 minutes on the reference workstation (Windows 11, Python 3.12), 2026-09-29, branch
`pilot/T068-events-cache-soak`; report JSON kept in the session scratchpad (not committed). **PASSED** (all 21 checks).

| | |
|---|---|
| duration / restarts | 652 s; 4 NVR restarts (two of them 50 s outages: 2 coverage-gap events recorded), 3 HA restarts |
| NVR alerts | 2225 active + 445 inactive sent, all 2670 accepted by the queue; 1978 stored by the writer, 692 coalesced (newest kept), 0 dropped, 0 failed; queue high-water 14 of 256; `SUM(count)` of the motion rows = 2225 = every active alert |
| HA | 5350 `state_changed` pushed; 2685 HA events stored; reconnected after every restart |
| exports | 55 created, 102 refused with 507 (all 102 counted), 23 × 429 (5 per owner), 22 × 503 (NVR down during the search); 14 jobs paused mid-download, 14 resumed; 6 done after the drain, none left queued / running / paused |
| SQLite | 11 065 write-lock holds, longest 0.30 s (`events_ingest._write`), 0 busy errors, 0 `database is locked` (with a 3 s outside write-lock hold every 40 s) |
| HTTP | 0 × 500 |
| memory | working set 89 MB at start, 112.5 MB after warm-up (3 min), 116.6 MB at the end (max 117.2); slope after warm-up +33 MB/h (private bytes +37 MB/h) with a flat Python object count (145k -> 149k): consistent with warm-up of the caches up to their bounds, not proven either way in 7 minutes |
| threads / handles / sockets | threads 29 -> max 35 -> 29 (per-request test-client threads come and go); handles 515 -> 543 (max 585); TCP max 20 open, max 1 CLOSE_WAIT; 1 thread (the main one) after shutdown, no product thread left |
| WebSocket | subscribers back to 0 after every reconnect |

Found and fixed by the soak runs (before the passing run):
- `/events/windows`, the per-camera timeline and the day summary ran in write-mode connections: under load one windows
  build held the write lock for 0.5 s (and 30 s with tracemalloc on, enough for 20 busy errors and 7 HTTP 500). They are
  reads and now use read-mode connections (`test_event_centre_reads_never_wait_for_the_write_lock`).
- An export whose run raised (e.g. a progress write still busy after its retries) stayed `running` until the next
  restart; the worker now marks it `failed` with a Hebrew reason.

## Limits

- One Windows workstation, one process, faked devices: the numbers are about the product's own code (queues, locks,
  threads, sockets, memory), not about the NVR, go2rtc or the Home Assistant host.
- Ten minutes shows leaks of the fast kind (threads, sockets, subscribers, queues); a slow memory leak needs the
  3-5 h run (`--minutes 240`) and, for the real picture, the add-on on Linux with the real NVR.
- The disk is pretend (50 MB, `shutil.disk_usage` replaced for the data directory only): it proves the policy, not
  the file system's behaviour at 100 % full.
