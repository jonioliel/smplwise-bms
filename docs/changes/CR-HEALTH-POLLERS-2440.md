# CR-HEALTH-POLLERS-2440

Code-review batch 16.11, wave 3A (backend). Plan row `pilot/CR-HEALTH-POLLERS-2436` in
`private/code-review-2026-11-13/MASTER_PLAN.md`; findings 03:F11, 03:F13, 03:F14, 03:F21, 03:F25 (cameras text).
Base: `origin/pilot/CR-WAVE2-COMBINED-2439` (`97080bbc4`).

## What and why

1. **One poller thread shape (03:F11).** New `services/poller.py` with `PeriodicWorker`. The three identical `Poller`
   classes in `recorder_health.py`, `camera_image_health.py` and `camera_sources.py` are gone; each module keeps
   `POLLER = PeriodicWorker(...)`. Unchanged: thread names (`recorder-health`, `camera-image-health`,
   `camera-source-health`), environment switches (`SW_RECORDER_HEALTH`, `SW_CAMERA_IMAGE_HEALTH`,
   `SW_CAMERA_SOURCE_HEALTH`), first waits (15 / 20 / 30 s), tick intervals, the "never dies on one bad pass" guard,
   the 3 s join at shutdown, the public attributes `thread` and `stop_evt`, `start(db, settings)` and
   `shutdown(timeout)`. The pass and `TICK_S` are read from the module at each pass, so tests that patch them still work.
   The recorder poller still reads its interval from the database before the pass, inside the same guard.
2. **One TTL cache (03:F21).** New `services/ttl_cache.py` with `TtlCache` (lock, per-read TTL, optional bound that
   drops the oldest quarter, single-flight). Migrated, same TTLs and keys:
   - `routers/cameras.py` `_ZONES_CACHE` (60 s) and `_CAPS_CACHE` (300 s): now locked and bounded at 512.
   - `services/recordings.py` `_cache` (30 s / 600 s, bound 512) and `services/recorded_days.py` `_cache`
     (`TTL_CURRENT_S` / `TTL_PAST_S`, bound `CACHE_MAX`): the hand-written in-flight lock tables are the cache's
     `flight()`. One difference: a search that raises no longer leaves its in-flight lock behind.
   - `services/health_report.py` `_probe_cache` (20 s): now single-flight, so two report builds probe once.
   - **Not migrated:** the per-app recorder health cache on `app.state` in `routers/recorders.py`. It is keyed by
     known recorder ids only (bounded by nature) and `test_security_lows.py` writes its entries as plain tuples; it
     stays a dict. Hikvision `_OPTIONS` and the Frigate / Provision discovery caches are not files of this row.
3. **One recorder reading, not three probes (03:F14).** New `recorder_health.recent_online(recorder_id, max_age_s)`.
   The health report's NVR probe and `GET /recorders/{id}/health` serve the poller's own reading when it is
   **online** and younger than their TTL (20 s / 10 s); otherwise they ask the device exactly as before. An
   unreachable poller reading is never served: the poller also marks a recorder unreachable when its detail read
   fails, which a plain health check would not. The route answers such a reading with `"cached": true`, like its own
   cache hit. New public `health_report.cached_status(key)`; `services/emergency/engine.py` uses it instead of
   reading `_probe_cache` without its lock (same any-age semantics).
4. **`GET /health` does less per call (03:F13).** Capabilities and `permissions_anywhere` are computed once per
   request (were twice each). The `pdftoppm` scan of every `PATH` directory runs once per `PATH` value. The events
   count is cached for 5 s per database file.
5. **Stale text (03:F25, cameras).** The zones route docstring no longer says editing is "not in the pilot"; it names
   the write routes that exist. The `write_reason` string in the API answer is **unchanged** (the frontend types it
   in `frontend/src/api/media.ts`; not this row's file).

## Decisions recorded

- **L11 (events count in `GET /health`).** The recommendation was "serve the counter the ingest already keeps".
  `events_ingest.STATE.events_stored` counts the alerts this process stored since start, not the rows of the events
  table, so serving it would change the value of `events.stored`. Taken instead: the review's other option, the
  same `COUNT(*)` cached for 5 s (`EVENTS_COUNT_TTL_S`). The field and its meaning are unchanged; it may be up to
  5 s old.
- **F14 scope.** Only online readings are reused (see 3). This keeps "same fields, same values" for every failure
  path at the price of not saving the device call while a recorder is down.

## Files

New: `smplwise_vms/backend/smplwise/services/poller.py`, `.../services/ttl_cache.py`,
`smplwise_vms/backend/tests/test_health_pollers_2440.py`.
Changed: `routers/health.py`, `routers/recorders.py`, `routers/cameras.py`, `services/health_report.py`,
`services/recorder_health.py`, `services/camera_image_health.py`, `services/camera_sources.py` (poller only),
`services/recordings.py`, `services/recorded_days.py`, `services/emergency/engine.py` (the go2rtc status read).

Outside my rows: none.

## Tests actually run

See the end of this file (filled after the run).
