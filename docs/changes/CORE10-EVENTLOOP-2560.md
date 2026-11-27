# CORE10-EVENTLOOP-2560 - the Home Assistant state feed's work off the socket reader

Row for 2.56 (owner answer to LOWS-BACKEND-2550 question 2 = a: its own row, worker thread with a bounded queue, order kept, a soak
run on the runner before merge). Base: `origin/pilot/LOWS-BACKEND-2550` (`d65bbfd93`). Deep review finding **CORE-10** (low),
`docs/review/DEEP-REVIEW-2520-BACKEND-CORE.md` on `origin/review/DEEP-2520-BACKEND-CORE`; confirmed still open at the base.

## What blocked the reader (found at the base)

`ha_client.ws_session`'s reader calls the session's `on_event` synchronously for every `state_changed` frame, on the feed thread's
asyncio loop. Everything below ran inside that call, so while it ran no frame was read, no command reply was delivered
(`HaSync.ws_call`, the path of schedules, "refresh from Home Assistant" and detect-by-pressing: 503 after its timeout), and the
socket's keepalive was answered late:

| Work inside one `on_event` | Where | How long it can block |
|---|---|---|
| The mirror write transaction (`BEGIN IMMEDIATE`) | `ha_sync.handle_state_event` | up to `BUSY_TIMEOUT_S` (10 s) while another writer holds the lock (a backup - CORE-05 -, a migration step, a lock storm) |
| Its hooks in the same transaction: state history, device activity, correlation event, rule evaluation, notification rows (`notify_sensors`), automations / schedules mirror, the alarm's Frigate profile and live-event hooks, media features | `handle_state_event._write` | CPU + SQLite, inside the same lock wait |
| Rule delivery after the commit: one synchronous POST to Home Assistant per notify service (`rules.HA_NOTIFY` -> `ha_client.call_service`) | `rules.deliver_pending` | the HTTP timeout per call |
| A rule's announce action: its own write transaction, the TTS / media_player calls and the volume restore sleep | `announcements.run_for_rule` | its transaction + the speaker calls |
| The state removal write (a removed entity) | `_session.apply_event` | up to `BUSY_TIMEOUT_S` |
| The multimedia `media_state` frame (two read transactions) | `media_store.on_state_event` | short |

Presence and energy do not run on this path (their samplers read the mirror on their own threads) - nothing to move there.
Other event frames (`on_message`: automation runs, scheduler component events, ticket replies, door-window events) are rare, mostly
already handed to their own workers, and were left as they are (see "Not changed").

## What changed

- **`services/ha_state_worker.py` (new).** `StateWorker`: one consumer thread (`ha-state-worker`, daemon, started on the first job)
  and a FIFO queue. One consumer keeps the order of every frame - per entity by construction, and across entities, as the
  correlation events and the rules saw it before. Frames are bounded (`STATE_QUEUE_MAX` = 20,000, the same order as the connect
  window's `HELD_STATES_MAX`); a frame that does not fit is refused, never blocks the reader, and is counted. Control jobs (the
  re-read) are never refused. `wait_idle(timeout)`, `depth()`, `frames()`, `max_depth`, `max_wait_s`, `refused`, `failed`.
  A failing job is logged and never ends the thread.
  `deliver_later(fired)`: when a fired rule has a Home Assistant notify or announce action, `rules.deliver_pending` runs on its own
  single thread (`ha-rule-delivery`, firing order kept); a list without such an action only wakes the notifier thread, inline as
  before.
- **`services/ha_sync.py`.**
  - `_session.on_event` (the reader's callback) only hands the frame on (`queue_event` -> `STATE_WORKER.submit(apply_event, ...)`).
    `apply_event` (mirror write, removal, push) runs on the worker; the removal's debounced registry refresh is poked through
    `loop.call_soon_threadsafe` (the debouncer lives on the session loop).
  - **Never silently:** a refused frame increments `STATE.state_overflows` (one warning per burst) and schedules ONE re-read
    (`resync_states`): once the queue is at most half full it asks Home Assistant for `get_states` and queues `apply_resync` as a
    control job - behind every frame queued so far (they are older than the listing) and ahead of every later frame. `apply_resync`
    stores the snapshot, counts `STATE.state_resyncs` and publishes `structure_changed` with reason `resync`, the CORE-06 signal
    every open screen already refetches on. It repeats while frames keep being refused.
  - The CORE-03 window is kept as it was; its held events are now queued in order after the snapshot is stored.
  - A new session's snapshot waits (`DRAIN_S`, 30 s at most) until the worker has stored an earlier session's frames - an old frame
    applied after the new snapshot would overwrite it. A session ends with its own frames stored (`END_DRAIN_S` 10 s, 2 s on stop).
  - On the worker a busy database is retried (`STATE_WRITE_ATTEMPTS` = 3): the reason for one attempt (the socket's ping deadline)
    no longer applies. `handle_state_event` / `on_state_changed` keep their defaults (1 attempt, inline delivery) for every direct
    caller and test; the worker passes `attempts` and `deliver=ha_state_worker.deliver_later`.
- No API, schema, setting or UI change. `STATE.as_dict()` (the heartbeat document) is unchanged; the two new counters are on `STATE`
  only, like CORE-06's `dropped_frames`.

## Tests

### New

- `tests/test_core10_eventloop_2560.py` (gate lane, 6 tests): a locked database no longer blocks the reader; a slow rule notification
  blocks neither the reader nor the next state's write; the order of 240 frames over 3 entities is kept; a full queue is counted and
  every state is re-read (`get_states` asked once more, the refused state stored, `structure_changed`/`resync` published); the
  connect snapshot waits for an earlier session's frames; the worker's own contract (refusal, control jobs, a failing job).
- `tests/test_core10_eventloop_load_2560.py` (`timing_lane`): the load test (below).

### Load test - before / after

`tests/test_core10_eventloop_load_2560.py`, on the runner (job `~/work/p2520_core10_run.sh`, shared runner, load average about 8),
the same test file on the base `d65bbfd93` and on the branch `2290a0a62`, alternating, two rounds. 5,000 `state_changed` frames over
500 entities in 5 bursts of 1,000 at 5,000 frames/s (1 s pause), a rule with a notify action fires on every 100th door transition
(10 fires) and Home Assistant answers it in 0.3 s, and once (third burst) another writer holds the write lock for 1.5 s.

| Measure | Before r1 | Before r2 | After r1 | After r2 |
|---|---|---|---|---|
| `on_event` (reader busy per frame), max | 2,595 ms | 2,196 ms | 0.2 ms | 0.3 ms |
| `on_event` p99 / mean | 189 / 13.7 ms | 332 / 16.2 ms | 0.0 / 0.0 ms | 0.0 / 0.0 ms |
| A request thread's call onto the session loop (`ws_call`'s path), max | 57,392 ms | 8,164 ms | 4.0 ms | 5.2 ms |
| 5 ms timer on the session loop, worst lateness | 68,460 ms | 80,958 ms | 7.0 ms | 7.4 ms |
| Socket backlog (frames sent, not read), max | 4,991 | 4,992 | 50 | 50 |
| State worker queue, max | - | - | 4,003 | 4,451 |
| Frame arrival -> row stored and pushed, max / p95 | 63.4 / 63.1 s | 75.8 / 75.3 s | 19.8 / 19.5 s | 13.1 / 12.8 s |
| All 5,000 frames read / stored | 68.5 / 68.5 s | 81.0 / 81.0 s | 6.2 / 24.9 s | 6.2 / 18.3 s |
| Frames stored, last state correct, notifications sent | 5,000, yes, 10/10 | 5,000, yes, 10/10 | 5,000, yes, 10/10 | 5,000, yes, 10/10 |
| Refused frames / re-reads | - | - | 0 / 0 | 0 / 0 |
| Test result (bounds: handler < 50 ms, loop < 250 ms, reply < 250 ms) | FAILED | FAILED | passed | passed |

Reading the numbers: before, the reader handled the frames one after another on the loop; while a backlog was waiting the reader
never gave the loop back (the next frame was always ready), so a timer, a pending command reply or a keepalive waited for the whole
backlog - up to 81 s here, far past the keepalive's 20 s deadline (a disconnect on a real socket). After, the reader keeps up with
Home Assistant (backlog at most one 10 ms batch of 50 frames) and the loop answers in a few milliseconds throughout; the storing
work waits in the worker queue instead (at most ~4,500 frames, a quarter of the bound) and is done 3-4 times sooner overall, because
the slow notifications and the held lock no longer stall it (they run on the delivery thread / are waited for by the worker only).
The "arrival -> stored" time is the worker's backlog on a loaded shared runner; it is the same work as before, no longer in the
reader's way.

### Runs

| Where | Command | Result |
|---|---|---|
| PC | `ruff check` on the four changed files | All checks passed |
| PC (venv, one file per process) | `pytest tests/test_core10_eventloop_2560.py` on the branch | exit 0, 6 passed |
| PC | the same file on an export of the base `d65bbfd93` | exit 1, 5 failed, 1 passed (the order test: the base is serial too) |
| PC | `test_core_reliability_2540_sync.py`, `test_ha_structure_refresh.py`, `test_live_review_fixes.py`, `test_dev_states_push_order_2540.py` | exit 0 each (the CORE-03 source-order check failed once until `resync_states` was placed after `on_ready`; passed after) |
| PC | `test_lat1_toggle_latency.py` | exit 1: `test_the_recorded_command_leaves_promptly_once_the_write_lock_is_free` (timing lane, 2,534 ms) - **fails the same on the base** (2,786 ms) on the loaded PC; not this row's path (action dispatch) |
| PC | the load test with `SW_CORE10_EVENTS=400` | passed (smoke) |
| Runner | the load test, base / branch alternating, 2 rounds (`-m timing_lane -s`) | base FAILED x2, branch passed x2 (table above) |
| Runner | `test_core10_eventloop_2560.py` base / branch | base exit 1 (5 failed, 1 passed); branch exit 0 (6 passed) |
| Runner | every test file that uses `ha_sync` (119 files), branch, one pytest process per file, `-m "not timing_lane"` | 118 exit 0; 1 failing: `test_soak_edges2_2450.py::test_g1_a_real_full_database_under_load` (`assert 'warn' == 'ok'`) - **the same failure on the base** |

NOT_RUN: the full backend suite and the release gate (the train's gate runs them); a soak of hours (the owner's answer asks for "a
soak run on the runner before merge": the two load rounds above are the short version - a long soak is open question 3).

## Not changed

- `on_message` frames (automation runs and reloads, scheduler component events) still do one short write on the loop; they are rare
  and their run rows are idempotent (`INSERT OR IGNORE` on a deterministic id), so their order relative to the state frames does not
  matter. Ticket replies and door-window events were already handed to their own workers.
- A frame refused by a full queue loses what only that frame carried (a door transition's correlation event, a rule that would
  have fired on it): the re-read restores every state, not the transitions inside the gap. Before the change the same overload
  stalled the reader until the keepalive failed - a disconnect and a full resync with the same loss. The bound (20,000 frames) is
  far above the measured peak.

## Open questions

1. **The two new counters on the health page.** `STATE.state_overflows` / `state_resyncs` (and the worker's `max_wait_s`) are kept
   but not shown.
   a. Add them to the "HA sync" check of the system report in a later backend row (the report already shows the link) **(recommended)**.
   b. Keep them internal (log lines only).
2. **`on_message` writes on the loop** (see "Not changed").
   a. Leave them (rare, short, idempotent) **(recommended)**.
   b. Route the automation / scheduler event writes through the same worker too.
3. **The soak before merge.**
   a. Before the 2.56 train merges this branch, run the existing long backend soak (`tests/soak/soak_long_backend.py`) on the runner
      for 2 hours with this branch, plus the load test 10 times in a row (watch for a growing worker queue or thread count)
      **(recommended)**.
   b. The two load rounds of this row are enough.
