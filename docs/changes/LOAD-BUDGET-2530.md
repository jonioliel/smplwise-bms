# LOAD-BUDGET-2530 - a written resource budget and an automated load run that fails above it (T068)

Branch `pilot/LOAD-BUDGET-2530` from `origin/release/2520-train` @ `eadaa25b8`. Card T068 (Load / Soak and resource budget,
AT135 / AT136); target 2.53. Test-and-docs only: no product code changed, no UI change, no lab, no device.

## What existed

- `scripts/load_probe.py` (2026-09, concurrent GETs against a live backend + lab devices) and `RESOURCE_BUDGET.md` with the 2026-09
  budget lines measured on the Windows workstation (0.1.x).
- The device-free soaks: `tests/soak/soak_local.py` (10 min, `SOAK_LOCAL.md`), `tests/soak/soak_long.py` + `soak_long_backend.py`
  (hours, the backend in its own process against fake NVR / HA + WisKey / go2rtc, samples every 60 s; T068-SOAK-2406, fixes in
  T068-INGEST-LOCK-2406 and SOAK-DBGROWTH-2412), the edge tests of T068-EDGE-2450, the launcher `scripts/soak/t068_long_soak.sh`.
- Missing: a budget the add-on is held to today (the 2026-09 lines predate most modules; the memory line no longer held), a run that
  *judges* the numbers (the soaks only record them), the TV boards / wall screens / home panels in the client mix, connection-drain
  and go2rtc-stream checks, and a runbook for the 14 h soak.

## What changed

- `smplwise_vms/backend/tests/soak/load_budget.py` (new): the budget run. Reuses soak_long's backend process, fakes and actors and
  adds: the notices module seeded (8 TV boards with tokens, 6 published notices), camera-wall screens, home wall panels, TV boards
  and a notice author with the UI's own polling periods; phases idle -> warm-up -> measured window -> drain; latencies kept per route
  (bounded reservoir, safe for 14 h); memory (idle, max, growth, least-squares slope), CPU, DB + WAL growth, fds, sockets, threads,
  loop lag, go2rtc streams and media sockets, write-lock hold / wait, ingest drops, live failures; after the drain no WebSocket, live
  session, event subscriber or go2rtc media socket may remain. Writes `budget_report.md` / `.json`, `routes.json`, `samples.csv`
  (soak_long's columns + phase / go2rtc streams / sockets), `summary.json`; the report states the host load of the window. Exit 0 within budget, 1 over budget, 2 run incomplete.
  `--evaluate <run-dir>` re-judges a finished run against a (changed) budget file. `--restarts` turns on soak_long's device restarts
  and the `max_with_restarts` limits. Opt-in (`SW_SOAK=1`), refuses to run inside the add-on, 127.0.0.1 only.
- `smplwise_vms/backend/tests/soak/load_budget.json` (new): the budget, 39 lines (latency groups for screens / polling / writes /
  live, and memory, CPU, DB, connection, stream, drain, error and write-lock lines), calibrated on run 1 (draft limits
  corrected where the draft was wrong, not where the product was slow).
- `smplwise_vms/backend/tests/test_load_budget.py` (new): fast unit tests of the helpers, the evaluator, the window numbers and the
  budget file (every line is a value the run produces), plus an opt-in one-minute end-to-end run.
- `scripts/soak/t068_long_soak.sh`: `SOAK_HARNESS=load_budget` runs the budget run under the same guards (default unchanged:
  soak_long); `status` prints the report's verdict line.
- `docs/operations/RESOURCE_BUDGET.md`: new section "Resource budget 2.53" (method, reference configuration, mix, the budget with
  run 1 / run 2, what the numbers say, what is not covered); the 2026-09 table marked historical. `RESOURCE_BUDGET_HE.md`: the same
  section in Hebrew (summary).
- `docs/operations/SOAK_14H_RUNBOOK.md` (new): how the lead runs the 14 h soak after the 2.52 gate (prerequisites, start, status,
  stop, collect, redaction, failure table). **Not started** (as the row asks).

## Results

See `RESOURCE_BUDGET.md` "Resource budget 2.53" for the table. Short form:

- Run 1 (10 min window, commit `f595e84af`, host load 1-9): FAIL on 2 lines of the first draft, both draft limits corrected
  from it (idle RSS 355 MB vs a 250 MB draft; a go2rtc "no stream growth" line that is wrong for short windows - removed).
  Every other line PASS; closest to the limit: write-lock hold 2.56 / 3 s, write-lock wait 4.71 / 5 s.
- Run 2 (15 min window, commit `e2ab53fed`, calibrated budget, host load 4.7-12.6, average 8.5 - twice run 1's): FAIL on three
  latency lines, all on routes that wait for the SQLite write lock: TV board feed p95 1217 ms (limit 800), export create worst p95
  6037 ms (limit 3000; n = 5), first live chunk p95 3123 ms (limit 2000). Every resource, connection, drain and error line PASS
  (idle RSS 354 MB, max 406 MB, CPU 9 %, DB 37 MB/h, 0 errors in 2787 requests, all connections drained). The limits were not relaxed
  after run 2; the report now carries the host load so a breach can be read against it.

Findings (no product change made; recorded for the owner / the next row):

1. Idle memory is ~355 MB (600 HA entities, every module): the 2026-09 line (< 200 MB) is obsolete; the new line is 400 / 450 MB.
2. The write lock is the tightest line under a busy host (hold 2.56 s by the alert writer, wait 4.71 s by the HA state writer).
3. The TV board feed (`GET /notices/display/<slug>`) writes `last_seen_at` inside the request once a minute per board, so half of
   a board's polls wait for the write lock (feed p95 297 ms in run 1, 1217 ms in run 2 - over budget - while p50 stays 13-17 ms).
4. On a busy host the write-bound routes (acknowledge, export create, live start, the TV feed) are the first over budget; reads keep
   p95 under 50 ms.

## Tests

| command | where | exit | result |
|---|---|---|---|
| `python -m pytest tests/test_load_budget.py -q -p no:cacheprovider` (backend dir) | workstation, Windows 11, Python 3.12 (main checkout's venv) | 0 | 6 passed, 1 skipped (the opt-in run) |
| `ruff check tests/soak/load_budget.py tests/test_load_budget.py` | workstation | 0 | clean |
| `bash -n scripts/soak/t068_long_soak.sh` | workstation (Git Bash) | 0 | syntax ok |
| `load_budget.py --minutes 1` small mix (smoke) | runner, slot B (`p2520_loadbudget_run.sh smoke`) | 1 | harness end-to-end OK; FAIL on 3 draft lines (idle RSS, stream growth, one 1.17 s TV-feed outlier in a 6-request sample) |
| `load_budget.py --minutes 10` full mix (run 1) | runner, slot B | 1 | FAIL on 2 draft lines (see above); 37 PASS / SKIPPED |
| `load_budget.py --minutes 15` full mix (run 2, calibrated budget) | runner, slot B | 1 | FAIL on 3 latency lines (above); 36 PASS / SKIPPED |

NOT_RUN: the opt-in pytest end-to-end case (`SW_SOAK=1 ... test_short_load_budget_run`) - the same code path ran as the smoke run
above, not through pytest; `t068_long_soak.sh start` with `SOAK_HARNESS=load_budget` (the 14 h soak belongs to the lead; only its
syntax was checked); the release gate (this row adds an opt-in test file whose fast tests run in the normal backend suite).

## Open questions

1. The budget's latency limits are the user-facing targets (screens p95 1.5 s, polling p95 0.5 s) - on the runner the measured p95
   values are 30-50x lower. Keep them? (a) keep - recommended: the add-on runs on hosts several times slower; (b) tighten to ~5x
   the runner's numbers so a regression on the runner shows sooner.
2. The TV feed's `last_seen_at` write inside the request (over budget in run 2): (a) a follow-up row moves the write out of the
   request (best effort, after the answer) - recommended; (b) leave it and relax the polling line.
3. Run 2 failed latency lines on a host at load ~8.5 (other jobs): (a) keep the limits, judge the budget on a quiet runner (the
   14 h soak after the gate) and read breaches against the reported host load - recommended; (b) relax the write-bound limits
   (writes / live / TV feed) to what a busy runner gives.
4. Should the short budget run join the nightly or the release gate as a ~14 min job? (a) not yet - first the 14 h soak, then decide
   - recommended; (b) add it to the nightly now (report only, not blocking).
