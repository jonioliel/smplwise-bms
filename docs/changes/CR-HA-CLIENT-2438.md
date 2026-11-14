# CR-HA-CLIENT-2438 - kept-alive Home Assistant REST client, one bridge status mapping, no body in bridge errors, two event-loop fixes

Branch `pilot/CR-HA-CLIENT-2438`, from `origin/main` at 0a8fb55e1 (v2.43.5). Not stacked on `CR-WAVE1B-COMBINED-2436`: that branch
touches none of the files below (checked with `git diff --stat origin/main...origin/pilot/CR-WAVE1B-COMBINED-2436`), and no other open
`pilot/` branch touches them either. Source: code review 2026-11-13, part 04 (other backend services), findings F12, F07, F08; master
plan section 3.3 row `CR-HA-CLIENT-2436`; lead decision L8. No migration, no setting, no UI change, no route change.

Files: `smplwise_vms/backend/smplwise/services/ha_client.py`, `services/ha_sync.py` (`HaSync._loop`, two lines),
`services/bridge_rotation.py` (`worker_loop`); new `tests/test_ha_client_2438.py`; the mock seam (not the assertions) of
`tests/test_camera_card.py`, `tests/test_ha_camera_live.py` and `tests/test_media_api.py`.

No test or check in this branch contacts a real Home Assistant: every HTTP answer comes from an `httpx.MockTransport` or a fake.

## 1. F12 (a) - kept-alive clients

Before: 12 call sites opened `httpx.Client(timeout=...)` per call (a new TCP connection and HTTP session to Home Assistant each time);
only `call_bridge_execute` used the LAT1 kept-alive client.

Now one small `_Pool` class (the LAT1 code, generalised) and two instances:

| pool | used by | limits |
|---|---|---|
| `_BRIDGE_POOL` (`_bridge_client`, unchanged contract) | `call_bridge_execute` only - the device-command hot path | 8 connections, 4 kept, 30 s idle (as before) |
| `_REST_POOL` (`_rest_client`, new) | `get_states`, `get_state`, `camera_image`, `media_artwork`, `get_config`, `get_config_item`, `call_service`, and the bridge services `set_entity_area`, `schedule`, `config_item`, `cast_stream`, `stream_source` | no connection cap (as many concurrent calls as before), 8 kept, 30 s idle |

- The timeout is given per request with the same value as before (20 / 10 / 15 / 10 / 8 / 10 s, or the caller's `timeout`).
- Device commands keep their own pool, so a slow read (a camera still) never holds one of their connection slots.
- A transport error of a REST call is reported exactly as before and leaves the pool alone (a broken connection is discarded by the pool
  itself; closing the client would cut other calls in flight). `call_bridge_execute` still drops its pool on a transport error (LAT1).
- TCP_NODELAY on both pools (the LAT1 reason: a small POST split into header and body must not wait for a delayed ACK on a kept-alive
  connection).
- The pool key is (base URL, client factory): a changed HA URL, or a test that replaces `httpx.Client`, gets a new client and the old one
  is closed. In production the factory never changes.
- URLs, headers, request bodies (`content=json.dumps(...)` / `json=`), status mappings, codes and messages are unchanged.
- New `reset_rest_session()` (tests), next to `reset_bridge_session()`.

Test seams: three test files replaced `httpx.Client` with `lambda **kw: real(transport=Mock, **kw)` or with a fake taking only `timeout`.
The pool passes its own `transport` and `limits`, so these lambdas now override the transport (`real(**{**kw, "transport": Mock})`) and the
fake accepts the keyword arguments and `close()`. The assertions of those tests are unchanged.

## 2. F12 (b) - one status mapping for the bridge services

New private `_bridge_ready(settings, payload)` (not configured -> 503 `ha_not_configured`; the USR2 P3 subject guard) and
`_bridge_post(settings, service, payload, timeout, *, missing, missing_statuses, timeout_error, client, on_transport_error)`, the one
sending and status-mapping block, used by `call_bridge_execute`, `call_bridge_schedule`, `call_bridge_config_item`,
`call_bridge_cast_stream` and `call_bridge_stream_source`. Per call the parameters reproduce the old mapping exactly:

| function | "missing" statuses -> code (details) | time-out | client |
|---|---|---|---|
| execute | 400 + "not found" -> `bridge_not_installed` | 503 `ha_unavailable` (pool dropped) | LAT1 pool |
| schedule | 400/404 + "not found" -> `bridge_too_old` | 504 `scheduler_timeout` | REST pool |
| config_item | 400/404 + "not found" -> `bridge_too_old` | 504 `config_timeout` | REST pool |
| cast_stream | 400/404 + "not found" -> `bridge_outdated` (`required: 0.7.0`) | 503 `ha_unavailable` | REST pool |
| stream_source | 400/404 + "not found" -> `bridge_too_old` | 503 `ha_unavailable` | REST pool |

Then for all: 401/403 -> 503 `ha_forbidden`; any other status from 400 -> 503 `bridge_error` (not retryable); a transport error -> 503
`ha_unavailable` with `details.error` = the class name. `execute` still runs the WisKey door guard before anything is sent; each caller
still reads its own answer (key filtering, the 8 KB cap of `stream_source`). `call_bridge_set_area` keeps its own single block, as its
docstring asks (one easily audited CONFIG write path); it only moved to the REST pool and lost the body (below).

## 3. Lead decision L8 - no body in bridge errors (behaviour change of one error detail)

`call_bridge_execute`, `call_bridge_set_area` and `call_bridge_schedule` put `r.text[:200]` in `details.body` of a `bridge_error`;
`config_item`, `cast_stream` and `stream_source` already said the body must never be carried (a refusal can echo a URL or an address).
Now no bridge error carries the body: `details` is `{"status": <code>}`. Checked before the change: no backend code and no frontend
source reads `details.body` of these errors (grep over `smplwise_vms/backend` and `frontend/src`); the only test that mentions such a
body (`test_alarm.py`) raises it from its own fake.

## 4. F07 - the HA sync stop watcher

`HaSync._loop` started `watch_stop()` with `asyncio.create_task` and kept no reference; the event loop holds tasks only weakly, so the
watcher could be collected and `stop_evt` would never be set. The task is now kept in a local (named `ha-sync-watch-stop`) and cancelled
when the loop ends (an escaping cancellation is cleaned up by `asyncio.run`). The 1-second poll stays: the stop flag is a thread event.

## 5. F08 - the rotation worker's blocking read

`bridge_rotation.worker_loop` ran the pass in the thread pool and then opened `db.connection(mode="read")` on the event loop for the
"busy" flag. Pass and read now run together in one thread-pool call that returns the flag. Same query, same order, other thread.

## 6. Tests

New `tests/test_ha_client_2438.py`:

- pooling: reads, `call_service` and a bridge POST share one client (built once, no default timeout, no connection cap); each call keeps
  its own timeout (20 / 10 / 8 / caller's); execute keeps its own 8-connection pool; a changed factory or base URL builds a new client and
  closes the old; a read's transport error leaves the pool alone; execute's drops it and is sent once; a camera still streams through
  the pool;
- the status table over `_bridge_post` (8 statuses x 6 functions, `set_entity_area` included): code, status and details per row, never
  the body (an echoed RTSP address is checked absent), the exact URL, method, token header and body sent;
- transport errors (connect error, read time-out) per function; nothing is sent without configuration or for a local id; the answers are
  read as before (key filtering, non-JSON, a list, the 8 KB cap);
- F07: after the loop ends with stop set, the watcher task is cancelled and none is left pending;
- F08: the busy read runs on the worker thread (the same thread as the pass), in read mode.

Local runs (Windows, Python 3.12, the repository `.venv`, `-p no:xdist`): see the commit message for the exact counts.
NOT_RUN locally: the full backend suite (runner entry check).

## 7. Rollback

Revert the commit. No data, settings or schema change.
