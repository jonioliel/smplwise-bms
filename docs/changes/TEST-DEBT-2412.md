# TEST-DEBT-2412 - wall-clock backend tests and the flaky items of the 2.41.0 / 2.41.1 gates

Branch `fix/TEST-DEBT-2412`, cut from `origin/main` at `9e6a8d62c` (the 2.41.1 release). No version bump, no merge into main or a
train. Test-and-tooling only: **no product module changed** (one product finding is recorded in section 4 for a decision).

Sources read (runner, read-only, nothing started or stopped): `~/smplwise-results/gate_release-2410-train_99f500a71.json` (2.41.0 full
gate: 18 FLAKY + 1 FAIL), `gate_release-2411-train_9e6a8d62c.json` (2.41.1: 11 FLAKY), their `.logs/` (Playwright logs, backend
junit) and the nightly `nightly/gate_main_9e6a8d62c.logs/` backend junit.

## 1. The "wall-clock" backend failures (test_nvr_less, test_setup_wizard)

They are not dates that have passed. Every failing case is a latency bound measured from a FRESH app:

- `test_nvr_less.py::test_nvr_routes_answer_409_nvr_not_configured[...]` - `time.time() - t0 < 5 * sw_time_factor()`. Failing params
  differ per run (`GET /nvr/system`, `GET /nvr/notify`, `POST /nvr/reboot`, `GET /cameras/cam1/osd`, `GET /cameras/cam1/frame?at=...`):
  2.41.0 gate (3, reported as FLAKY), main nightly 9e6a8d62c (3), local origin/main run (4 of 18, below).
- `test_setup_wizard.py::test_a_slow_device_is_cut_off_at_the_check_deadline` - `time.monotonic() - t0 < 5` (5.5 s locally).

Cause (measured): fastapi 0.141 builds each included router's route state (dependants, compiled paths, pydantic adapters) **lazily, on
the first request matched against it, under one lock**. The tests warm up with `GET /api/v1/me`, which builds only the routers in front
of `/me`; the timed request then paid the build of every router up to its own. Stack sampling of the slow request showed only
`fastapi/routing.py _build_effective_context -> from_api_route -> get_dependant / compile_path`; a standalone fresh app on this
workstation: first unmatched request **9.3 s**, the next ones 0.04 s; a second `create_app` pays it again (9.9 s).

Fix: `tests/conftest.py::warm_routes(client)` - one request to a path that matches nothing (`/api/v1/...` and `/arx/api/v1/...`) walks
every router and builds them all; called before the timed window in both tests. The bounds themselves are unchanged.

The other clock reads in these files were checked: the DST cases use fixed instants (`dt.datetime(2026, 9, 29, ...)`); the probe case
`test_nvr_clock_warning_drift_failure_and_dst_failure_through_the_probe` reads today's offset of Asia/Jerusalem and picks the opposite
one, so it holds in summer and winter (it passed on 2026-11-09, winter time). No change there.

## 2. Flaky items, grouped by cause

| # | Item (gate) | Cause | Action |
|---|---|---|---|
| A | `unit-wiskey-stations.spec.ts:501` [desktop] [tablet] (2.41.0), [desktop] (2.41.1); `unit-wxsch.spec.ts:37` [mobile] (2.41.0); `unit-wxunblk.spec.ts:32` [tablet], `unit-wxmedset.spec.ts:31` [mobile] (2.41.1) - `Cannot read properties of undefined (reading 'lang')` | **State leak between spec files in one worker.** `unit-video-sub-fallback-2402.spec.ts` set `globalThis.document ??= { baseURI }` and never removed it. Playwright reuses a worker for the next files (alphabetical: `unit-w*` come right after `unit-v*`); their i18n helpers test `typeof document !== 'undefined'` and then read `document.documentElement.lang`. Reproduced locally: those 5 files with `--workers=1` -> 1 failed / 79 passed. | **Fixed**: the stub is restored in a `finally` (the same pattern every other stub in tests/ already uses). |
| B | `test_nvr_less.py::...409...[GET/POST ...]` x2 (2.41.0) | Section 1 (lazy route build inside the timed window). | **Fixed** (`warm_routes`). |
| C | `test_remote_auth_first.py::test_the_flood_does_not_queue_behind_a_writer_nor_delay_the_next_one` (2.41.0 8.0 s, 2.41.1 5.8 s, nightly 5.9 s vs `5.0 * load factor`) | Same cause as B: 35 requests from 4 threads on a fresh app; the first ones built the routers under FastAPI's lock and the others queued behind it - inside `flood_s`. `most_waiting == 1` and `acquires == baseline` (the property under test) held every time. | **Fixed** (`warm_routes` before the holder starts). |
| D | `test_ha_camera_live.py::test_a_failing_stream_makes_the_next_open_read_the_source_again` (2.41.0: `ENTITY in hls._STALE`) | Race in the test. The "healthy" second session used the fake relay's default end reason `upstream_closed`, which `note_session_end` correctly treats as "go2rtc closed it at once -> stale". Whether that teardown ran before the TestClient's close cancelled the server task decided the result. | **Fixed**: the second session ends as `client_closed` (the viewer leaving, which `with ...: pass` models). Product unchanged. |
| E | `test_wxd11_t19_fake_ha_context.py::test_t19_concurrent_runs_...` (2.41.0: `OperationalError('database is locked')`) | Write-lock contention in the DB write path. | **Not touched**: that area belongs to `fix/SOAK-DBGROWTH-2412` (db.py, write paths). Noted for that branch. |
| F | `unit-plan-3d-kiosk.spec.ts:93` [mobile] (2.41.0) - `['timeout','change','timeout']` | The frame poll before the read outlasted the 2 s quiet period, so the next (correct) `timeout` was already logged. | **Fixed**: the first two events are this step's (`slice(0, 2)`); the next line still waits for the quiet `timeout`. Same guard on the sibling test (line 88). |
| G | `dropdown-phone-choice.spec.ts:358` [desktop] domus/dark (2.41.0) - `inside` false | Read after a fixed 700 ms while the sheet was still sliding up. | **Fixed**: polls until the sheet is inside the screen (10 s), then the same assertions. |
| H | `layout-skin-qa-2403.spec.ts:335` [mobile] soft light (2.41.0) - press scale 0.987 vs token 0.97 | One read at a fixed 160 ms during the press transition. | **Fixed**: reads until the press reaches the token (3 s budget); a press that never does still fails. |
| I | `evidence-alarm.spec.ts:116` [desktop] (2.41.0) - `not.toContainText` -> element(s) not found | A negative assertion on a tab row that had not rendered yet (open() waits 400 ms). | **Fixed**: waits for the row to be visible (20 s) first. |
| J | `dropdown-styles-b.spec.ts:575` [desktop] dev (2.41.1) - `facts()` null | One read after `openShell`'s fixed 1.2 s; the tabs render after the lazy screen chunk. | **Fixed**: `expect.poll(facts)` (15 s) before, and a poll for `variant === 'dropdown'` instead of a fixed 700 ms after the switch. |
| K | `evidence-system-update-apply.spec.ts:500` [tablet] (2.41.1) - `loads` 0 | The card reloads when `me` answers AFTER it was seen down, else only after the 15 s settle time. The test brought Arx back after a fixed 3.5 s; under load the card's first 3 s poll came after that, so it never saw "down" and the settle path missed the 15 s window. | **Fixed**: the load listener is set before the confirm; Arx comes back only once a refused `me` was seen (`requestfailed`), then up to 20 s for the reload. |
| L | `evidence-system-multimedia.spec.ts:37` [mobile] (2.41.0 and 2.41.1) - 60 s timeout in a capture | Two full-page captures (1440x4600, 390x7600) in one test. | **Fixed**: `test.slow()` (x3 budget; same work). |
| M | `evidence-tickets-table.spec.ts:374` [mobile] (2.41.1) - 60 s timeout | Five page loads and four captures in one test. | **Fixed**: `test.slow()`. |
| N | `pixel-access-events.spec.ts:44/:55` [desktop] (2.41.0), `pixel-nvr-encoding-batch.spec.ts:51` [desktop] (2.41.1) - `toHaveScreenshot` "Timeout 5000ms exceeded" | Playwright's default 5 s for the stable-screenshot loop under load (no pixel difference was reported). | **Fixed**: `timeout: 15_000` on those two compares. |
| O | `pixel-access-s12.spec.ts:49` [mobile] classic + domus, `:62` [mobile] classic (2.41.0; :49 domus and :62 again in 2.41.1) | The phone cards came out 15-23 px taller (366x1259 / 1267 vs the 366x1244 baseline; parity 23590 px different). No diff image left on the runner, so the extra line is not identified. | **Quarantined** (below). |
| P | `evidence-wall.spec.ts:270` (2.41.0, FAIL, not flaky) | Evaluate before render. | Already fixed on main before this branch (the wait at line 275, 2.41.1). |

### Quarantine

Added with `scripts/gate/gate_quarantine.py add` (validated; `check` rc 0):

| match | category | ticket | owner | added | expires |
|---|---|---|---|---|---|
| `[mobile] pixel: CR-036 S12` | pixel | `FLAKY-S12-PIXEL-2412` (management/tasks.json, READY) | lead | 2026-11-09 | 2026-11-16 |

The match covers exactly the two phone tests (not the desktop ones; checked with `gate2_verdict.quarantined`). The gates read the
**runner's** `~/gate2/gate2_quarantine.json`, not the repository file: installing this entry there is the lead's step. That runner file
currently holds a runner-only entry (`pixel-wiskey-stations.spec.ts:87`, ticket WKWATER-POLISH-2331-pixel, expires 2026-11-09) which
is not in the repository - merge, do not overwrite.

## 3. Test results (actually run, this workstation, Windows, 2026-11-09)

Python 3.12 (`.venv`), Node 24.21.0, Playwright `--workers=1`; preview on port 4517 from this branch's `npm run build` (tsc passed);
the dev spec against `vite` on port 5199 (stopped afterwards).

| What | Command (short) | Result |
|---|---|---|
| Before, origin/main tree | `pytest tests/test_nvr_less.py tests/test_setup_wizard.py` | **5 failed** / 81 passed (86): 4 x `409_nvr_not_configured` (frame, nvr/system, nvr/notify, osd), `slow_device...deadline`. An earlier run: 2 failed. |
| Before, origin/main tree | unit: `unit-video-sub-fallback-2402` + `unit-wiskey-stations` + `unit-wxsch` + `unit-wxunblk` + `unit-wxmedset`, `-c playwright.unit.config.ts` | **1 failed** / 79 passed (`reading 'lang'`) |
| After, x3 | `pytest tests/test_nvr_less.py tests/test_setup_wizard.py tests/test_remote_auth_first.py tests/test_ha_camera_live.py` | 178 passed, 178 passed, 178 passed (0 failed) |
| After, x3 | the same 5 unit specs | 80 passed x3 |
| After, x3 | `dropdown-phone-choice -g "the sheet is readable" --project=desktop` | 8 passed x3 |
| After, x3 | `evidence-alarm -g "general settings keep no alarm tab"` (3 projects) | 3 passed x3 |
| After, x3 | `evidence-system-update-apply -g "restart Arx" --project=desktop --project=tablet` | 6 passed x3 |
| After, x3 | `evidence-system-multimedia -g "the sections in order" --project=mobile` | 1 passed x3 |
| After, x3 | `evidence-tickets-table -g density --project=mobile` | 1 passed x3 |
| After, x3 | `layout-skin-qa-2403 -g "phone toolbar" --project=mobile` | 13 passed, 13 skipped (the file's own skips) x3 |
| After, x3 | `unit-plan-3d-kiosk --project=mobile --project=desktop` | 14 passed x3 |
| After, x3 | `pixel-access-events pixel-nvr-encoding-batch --project=desktop` | 11 passed x3 (compare skipped: Linux-only baselines) |
| After, x3 | `dropdown-styles-b -g "settings sub-tabs" --project=desktop` (vite dev) | 2 passed x3 |
| Guards | `pytest test_gate2_select test_select_tests test_gate_visual_block_t074 test_board_rule_2404 test_board_decisions_2407 test_targeted_plan test_task_runner test_no_ip_literals test_gate_always_run` | 138 passed |
| Guards | `scripts/gate/selftest_gate_fast.py`, `selftest_entry_check.py` | SELFTEST PASSED x2 (entry check part B SKIP: no bash/git in that process) |
| Registry | `scripts/gate/gate_quarantine.py check`; `scripts/project_status.py --write` | rc 0 (1 active entry); PASS, 456 tasks |

The local runs pass, but that does not show the gate-load flakes are gone: the fixes target causes seen in the gate logs, and only full
gates under load can confirm them.

## 4. Product finding (not changed here - for a decision)

The lazy route build of section 1 is also what a real installation does after every start: the first request that reaches a not-yet-built
router (in practice the first unmatched path, or the first request to a later router) builds them all on the event loop, under FastAPI's
lock, for several seconds (9-10 s on this workstation under load; unmeasured on a Home Assistant host). Every other request waits for it.
This is a latency issue, not a correctness bug, so it is not fixed in this test branch. A possible follow-up: build the route state once
at start-up off the request path (e.g. one unmatched request through the app in the lifespan, in a worker thread) and keep the test
helper. It needs a decision because `main.py` start-up is shared.

## 5. Not done / NOT_RUN

- No gate, nightly or targeted run on the runner (read-only access by instruction). Pixel compares: the baselines are Linux-only, so on
  this workstation the two pixel specs skip the compare (`no baseline on win32`) - the timeout change is NOT verified against a real
  compare.
- Item E (`test_wxd11_t19`, database is locked) left to `fix/SOAK-DBGROWTH-2412`. The nightly's `unable to open database file` setup
  errors (db_template, same nightly) are in the same area and were not looked at.
- The quarantine entry is not installed on the runner (lead).
- `layout-skin-qa-2403.spec.ts` was run only for its phone-toolbar tests (`-g "phone toolbar"`, mobile), not the whole 20-minute file.
