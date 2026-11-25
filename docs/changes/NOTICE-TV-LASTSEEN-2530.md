# NOTICE-TV-LASTSEEN-2530 - the TV board feed no longer writes "last seen" inside the request

Branch `pilot/NOTICE-TV-LASTSEEN-2530` from `origin/pilot/LOAD-BUDGET-2530` @ `8c299c508`; target 2.53. Follow-up of LOAD-BUDGET-2530
open question 2 (answer a, the recommendation). Backend only: no UI change, no API change, no migration, no lab, no device.

## Why

`GET /api/v1/notices/display/<slug>` (and the same feed on the TV boards' LAN listener) recorded the board's `last_seen_at` inside the
request, at most once a minute per board (`display.touch_seen`). That `UPDATE` took the single SQLite write lock (`BEGIN IMMEDIATE`),
so for a board polling every 30 s every other read queued behind the alert writer, the HA state writer and the rest. LOAD-BUDGET-2530
run 2 measured the feed as the slowest polling route: p95 1217 ms against an 800 ms limit (p50 17 ms), on a host at load ~8.5.

## What changed

- `smplwise/services/notices/display.py`: `touch_seen` replaced by `SeenRecorder`.
  - `note(board_id)` is all the feed does: the request's time (whole-second UTC, the same text as before) goes into a dict under a
    lock. No database, no write lock, nothing a request can wait for. Only ids that `resolve()` accepted are noted (a real, enabled
    board whose token matched), so the dict is bounded by the number of boards.
  - A daemon thread of its own (`notice-board-seen`, started on the first note - an installation without TV boards runs none)
    writes every board noted since the previous pass in ONE write transaction every `SEEN_FLUSH_S` = 60 s
    (`UPDATE notice_boards SET last_seen_at = ? WHERE id = ? AND (last_seen_at IS NULL OR last_seen_at < ?)`, executemany). With
    8 boards: one write transaction a minute instead of up to 8, none of them on a request.
  - The UPDATE never moves a value backwards; a pass that fails (e.g. `database is locked`) puts its values back, merged with newer
    notes, for the next pass; nothing is raised into a request.
  - `close()` stops the thread (bounded join, 5 s) and writes once more; later notes are ignored; calling it twice is safe.
  - `seen_recorder(app.state)`: one recorder per application (`app.state.notice_seen`), shared by the application's display routes and
    the LAN listener. `close_seen(app.state)`: the shutdown step.
  - The per-test reset (`register_reset`) now also closes every live recorder (without a flush), next to the existing limiter reset.
- `smplwise/routers/notices.py` (`_display_service`) and `smplwise/main.py` (LAN listener start): `touch=seen_recorder(app.state).note`.
- `smplwise/main.py` shutdown: a new step "notice board last seen" (`close_seen`) right after the LAN listener stops, long before the
  database pool closes.

Unchanged: the token check (`resolve`: constant-time compare, uniform 404, rate limits), ETag / 304, the response headers, the link
capture of pre-NOTICEPERM-295 boards (`capture_link`, a one-time write per old board), the read-mode connection of the feed.

### The lag an administrator may see (documented)

The "last seen" in Settings › לוח הודעות (the board list, the board page) is now at most `SEEN_FLUSH_S` = 60 s older than the TV's
last successful feed read (plus the TV's own 30 s poll). Before, the request wrote at most once a minute per board, so the bound is the
same; the "online" chip (seen within 3 minutes, `frontend/src/notices/model.ts`) is not affected. On a crash (no shutdown) at most the
last 60 s of "last seen" is lost; the TV's next poll after the restart sets it again. A clean stop / restart writes it.

## Tests

New `tests/test_notice_tv_lastseen_2530.py` (8 tests):

- the feed never takes the write lock (a spy on `db._begin_immediate` around 200 / 304 / wrong-token / no-token / repeated reads:
  no label at all), ETag / 304 and the uniform 404 unchanged, the value is not in the database until a pass, the pass is one
  `notices.board.seen` transaction and the board list shows it;
- the feed answers while another writer holds the write lock (3 reads, each < 3 s; with the old code the first read of the board
  waited for the lock);
- a pass writes the latest value per board in one transaction; an older note never replaces a newer pending one; nothing pending =
  no write lock;
- a pass never moves a stored value backwards;
- a failed pass keeps its values and the next pass writes the newest;
- the background thread writes on its interval (no thread before the first note);
- `close()` flushes once, joins the thread, ignores later notes, is safe twice; a new recorder (the next process) on the same file
  starts empty and moves the value on;
- through the real lifespan (`with TestClient(create_app(...))`): the routes share one recorder and the shutdown step writes the value.

| command | where | exit | result |
|---|---|---|---|
| `python -m pytest tests/test_notice_tv_lastseen_2530.py -q -p no:cacheprovider -x` (backend dir) | workstation, Windows 11, Python 3.12 (main checkout's venv) | 0 | 8 passed |
| `ruff check` on the 4 changed / new Python files | workstation | 0 | clean |
| `pytest -q tests/test_notice_tv_lastseen_2530.py tests/test_notices_106.py tests/test_board_answers_2400.py tests/test_board_mgmt_2381.py tests/test_singletons_registered.py tests/test_get_routes_read_conn.py tests/test_load_budget.py` (one process) | runner, slot wrapper, tree extracted to tmpfs (see below) | 1 | every test passed except 2 that read files outside `smplwise_vms/backend` (the first extract held only `smplwise_vms/backend`; e.g. `contracts/examples/role-catalog.design.json`) - not product failures; this repository's `-q` output prints no count line |
| the same 2 tests again after extracting `smplwise_vms`, `contracts`, `docs/integrations` | runner, slot wrapper | 0 | 2 passed |

## Load budget run (load_budget.py, after the change)

One run, `SW_SOAK=1 tests/soak/load_budget.py --minutes 10` (full mix: 8 TV boards polling every 30 s with If-None-Match, 8 wall
screens, 6 home panels, author, operators, acker, exporter, live viewers), commit `7c7b461c8`, runner slot wrapper (`nice 19`),
2026-11-25 17:28-17:41Z. Verdict **PASS, 39 lines, 0 over budget**. Report kept locally (private, not in git):
`private/planning/notice_tv_lastseen_2530_budget_report_2026-11-25.md`.

| TV board feed (`notices_display`) | n | p50 | p95 | max | host load avg / max | where the database lived |
|---|---|---|---|---|---|---|
| before - LOAD-BUDGET-2530 run 1 (`f595e84af`) | - | 13-17 ms | 297 ms | - | 4.1 / 9 | runner disk |
| before - LOAD-BUDGET-2530 run 2 (`e2ab53fed`) | - | 13-17 ms | **1217 ms (FAIL, limit 800)** | - | 8.5 / 12.6 | runner disk |
| after - this row (`7c7b461c8`) | 160 | 12.1 ms | **20.1 ms** | 23.3 ms | 7.8 / 9.25 | **tmpfs** (`/dev/shm`) |

After the run all 8 boards had `last_seen_at` set, the newest 17:41:13Z (the drain / the shutdown flush): the background pass and
the final flush write it. The feed's p95 is now in line with the other read polls of the same run (notices list 19.2 ms, building
presence 12.9 ms, health summary 12.6 ms).

**Caveat - read the "after" numbers with this in mind.** The runner's disk was full (100 %, 0 bytes free, 25.11 ~15:55Z, other jobs'
files) when this row's run was queued, so the tree, the run directory and therefore the backend's SQLite database were placed on
tmpfs. On tmpfs a commit's fsync is almost free: the whole run's write lock was far calmer than in the disk-backed runs (longest
hold 0.035 s vs 2.26-2.56 s, longest wait 0.025 s vs 3.45-4.71 s, writes p95 14 ms vs ~1-2 s). So the drop from 1217 ms to 20 ms is
partly the storage, not only this change. What this change guarantees by itself, independent of storage, is pinned by the tests: the
feed never begins a write transaction (spy on `_begin_immediate`) and answers while another writer holds the lock. A disk-backed
re-run is open question 1. Only one run was made, as the row asked (<= 15 min of runner time).

## Not run

- The full backend suite and the release gate (the train's gate runs them). Only the targeted files above ran.
- The LAN listener path end to end on a real TV (no lab in this row); it uses the same `DisplayService.feed` and the same recorder as
  the application's routes (pinned by the lifespan test for the routes; the listener's own wiring is one line in `main.py`).

## Files

- `smplwise_vms/backend/smplwise/services/notices/display.py`
- `smplwise_vms/backend/smplwise/routers/notices.py`
- `smplwise_vms/backend/smplwise/main.py` (two lines: the listener's `touch=` and the shutdown step)
- `smplwise_vms/backend/tests/test_notice_tv_lastseen_2530.py` (new)
- `docs/operations/RESOURCE_BUDGET.md` (the TV feed paragraph), this note

## Open questions

1. The "after" run sat on tmpfs (runner disk full), so it is not a like-for-like comparison with LOAD-BUDGET-2530 runs 1-2.
   (a) leave the disk-backed confirmation to the next budget run on disk (the 14 h soak after the gate already runs the TV boards) -
   recommended: the request-path guarantee is pinned by tests; (b) queue one more 10-minute disk-backed run now (~14 min runner).
2. Flush interval: (a) 60 s - recommended, the same freshness bound as before (the request wrote at most once a minute per board) and
   one write transaction a minute for all boards; (b) 30 s - fresher "last seen" in Settings, twice the (small) writes.
3. Should Settings read the in-memory value too, so "last seen" shows no flush lag? (a) no - recommended: the 60 s bound equals the old
   behaviour and the "online" chip uses 3 minutes; (b) yes - overlay `SeenRecorder.pending()` on the board list (small, additive).
