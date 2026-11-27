# BACKEND-SUITE-COST-2560 - a cheaper backend suite without losing coverage (target 2.56)

Branch `pilot/BACKEND-SUITE-COST-2560`, one commit on `origin/release/2550-train` @ ad778e4ea (2.55.0). The work and every
measurement were done on 11bfcad19 (commits 7703d3d0e, 451084ecc, 34a6bb45a, later squashed onto ad778e4ea with the same content);
`smplwise_vms/backend` and `scripts` are identical in 11bfcad19 and ad778e4ea (only `www/`, the registry and release notes differ). Follows GATE-SPEED-2550 section 1.2 / 1.6
(backend shards of ~10,500 s each; 96 % of the time in tests of 1 s or more). The runner was used read only for the gate history
(`~/smplwise-results/gate_release-2540-train_f9217db8a.logs/backend_s*.xml`, the 2.54 full gate) and as slot-B jobs
(`~/work/p2520_bsc_*.sh`, one pytest process at a time) for the profile and the before/after measurement.

## 1. Where the time goes (2.54 full gate, junit seconds, 46,556 tests, 42,019 s)

Median test 0.0 s, p75 0.33 s, p90 3.6 s, p99 8.0 s. The slow tail is not a few pathological tests: it is thousands of tests that
each build a fresh application and talk to it over HTTP. Two costs dominate one such test app.

**A. fastapi's per-application route analysis (CPU; the gate's real cost).** Since fastapi 0.141 every application builds, lazily
and per included router, an "effective route context" for each API route it walks: the dependency tree (`get_dependant`,
`inspect.signature` of every dependency) and the request / response model fields (one pydantic TypeAdapter each). The product has
one application, so it pays this once. The suite pays it for every test app. cProfile of three `test_tickets_dept_handlers.py`
tests (PC): `fastapi.routing._populate_api_route_state` 6,771 calls, **133 s of the 181 s** spent in the fixture; one ticket world
(`tickets_world.build`, about 30 requests) walks 1,510 route contexts. The gate is CPU-bound (GATE-SPEED-2550 1.1: load 40-99 on 16
cores), so this CPU is what turns a 0.5 s test into a 3-14 s one there.

**B. fsync of the template copy (disk only).** `db_template.copy_into` copies the 5.8 MB pre-migrated template into the test's
database file with SQLite's backup API on a connection with the default `synchronous=FULL`, then commits the re-stamp: two fsyncs.
Idle runner, on disk (`~/work/bsc_tpl.py`): 350-870 ms per test app; with `synchronous=OFF` on that copying connection, 4-6 ms. The
release gate already puts the backend's tmp on /dev/shm (`GATE_BACKEND_TMPFS`, where fsync costs nothing), so this one helps the
nightly / coverage lane / developer runs on disk, not the gate.

| step of one test app | time |
|---|---|
| `create_app` total (idle runner, disk) | 0.55-0.68 s (the first one in a process 5.5 s: imports, plus 8.7 s for the template build) |
| of which `db_template.copy_into` | 0.45-0.92 s, almost all fsync; 4-6 ms with `synchronous=OFF` on the copying connection |
| re-stamp of the 11 clock values of the template | 17 ms |
| the route analysis for the routers one ticket world walks (PC) | 12.0-13.6 s per app without the cache, 2.8-3.5 s with it |

### 1.1 The 25 slowest files and why

| # | file | s | tests | s/test | why slow |
|---|---|---|---|---|---|
| 1 | test_get_routes_read_conn | 1866 | 743 | 2.51 | one fresh app per parametrized GET route (743 apps), each walking the routers: A (+ B on disk) |
| 2 | test_tickets_org_locations | 416 | 49 | 8.49 | fresh app + ticket world seeded over HTTP per test: A; one case took 144 s = a stall under load, not a wait |
| 3 | test_partner_api_113 | 369 | 126 | 2.93 | fresh app per test + partner seeding |
| 4 | test_access_grants | 346 | 72 | 4.81 | fresh app + grants world per test |
| 5 | test_doorwin_watch | 313 | 22 | 14.22 | fresh app + DoorwinWorld; the watchdog is stepped every 15 s of fake clock through hours of a window (no real sleep); not A, unchanged |
| 6 | test_tickets_dept_handlers | 302 | 33 | 9.15 | fresh app + department world per test |
| 7 | test_tickets_vendor_portal | 279 | 61 | 4.57 | fresh app + vendor world per test |
| 8 | test_nvr_stream_batch | 266 | 43 | 6.18 | fresh app + fake NVR per test |
| 9 | test_nvr_connection | 255 | 78 | 3.27 | fresh app + fake NVR per test |
| 10 | test_notify_whatsapp | 247 | 111 | 2.22 | fresh app per test |
| 11 | test_tickets_dept_handlers_decisions | 245 | 49 | 4.99 | fresh app + department world per test |
| 12 | test_maintenance_215 | 240 | 39 | 6.15 | fresh app + maintenance seeding per test |
| 13 | test_tickets_handler_load | 237 | 45 | 5.28 | fresh app + ticket world per test (functional, not a load test) |
| 14 | test_remote_access | 234 | 66 | 3.55 | fresh app per test; one test walks every route (47.8 s) |
| 15 | test_local_passkeys | 233 | 73 | 3.19 | fresh app per test |
| 16 | test_app_session_295 | 232 | 53 | 4.37 | fresh app per test |
| 17 | test_tickets_s5b_channel | 230 | 38 | 6.06 | fresh app + ticket world per test |
| 18 | test_nvr_stream_write | 225 | 45 | 5.00 | fresh app + fake NVR per test |
| 19 | test_local_identity | 225 | 41 | 5.48 | fresh app per test |
| 20 | test_notice_delete_295 | 219 | 20 | 10.95 | fresh app + boards and notices over HTTP per test |
| 21 | test_bridge_keyrot_harness_295 | 216 | 34 | 6.36 | fresh app + bridge harness per test |
| 22 | test_tickets_s4_assign | 213 | 35 | 6.09 | fresh app + ticket world per test |
| 23 | test_tickets_detail | 209 | 36 | 5.81 | fresh app + ticket world per test |
| 24 | test_notices_106 | 208 | 43 | 4.83 | fresh app per test |
| 25 | test_nvr_less | 207 | 54 | 3.84 | fresh app per test; the route-state build of 409 routes |

Every "fresh app" row above is cost A (plus B on a disk tmp). Specific single tests outside that pattern:
* `test_wiskey_live_validation_2390::test_no_final_result_is_a_fail_never_a_pass[running|lost]` - 60.8 s + 60.6 s: a **real 60 s
  wait**. The test sets `lv.RESULT_WAIT_S = 0`, but `run_native(..., wait_s=RESULT_WAIT_S)` bound the value as the default when the
  module loaded, so the patch never reached it and the poll loop slept 0.5 s x 120.
* `rc.run_checks(ROOT)` (scripts/release_check.py on the whole tree) is called by four files: 141 s, 61 s, 42 s, 14 s in the gate,
  5.9 s idle (4.2 s of it the design ratchet's regex scan of 2,020 files, 1.3 s the migration downgrade check): load inflation of
  CPU work, not a wait; not changed (section 5).
* the repository scanners (`test_no_ip_literals`, the ratchets, `test_supervisor_build_check`) 59-75 s each: they read the tree; not
  changed here.

No test in the top 25 is a wall-clock / soak test, so nothing was moved to the timing lane (`-m timing_lane`): moving a functional
test there would remove it from the gate.

## 2. Changes

| # | file | change |
|---|---|---|
| 1 | `smplwise_vms/backend/tests/support/route_cache.py` (new), `tests/conftest.py` | `_EffectiveRouteContext.from_api_route` memoised per process (cost A) |
| 2 | `smplwise_vms/backend/tests/test_route_cache.py` (new) | proof of 1 |
| 3 | `smplwise_vms/backend/tests/db_template.py` | `copy_into` sets `PRAGMA synchronous=OFF` on the copying connection only (cost B) |
| 4 | `smplwise_vms/backend/tests/test_db_template.py` | new `test_the_unsynced_copy_leaves_the_application_connections_their_durability` |
| 5 | `smplwise_vms/backend/smplwise/services/wiskey_live_validation.py` | `run_native(wait_s=None)` reads `RESULT_WAIT_S` at call time |
| 6 | `smplwise_vms/backend/tests/test_infra_elevators_280.py` | one history row pinned 600 s inside the window (a same-second flake exposed by the speed, 4.1) |
| 7 | `smplwise_vms/backend/tests/test_wire_consumption_2450.py` | the meter replacement at `started_at + 1 s` instead of `now` (the same, 4.1) |

1. **Route cache.** The analysis is a pure function of the route and of the include context it is mounted with (prefix, tags,
   dependencies, responses, response class, ...). Its one per-application input is `dependency_overrides_provider` (the app whose
   `dependency_overrides` a request consults). The memo key is every field of the include context except that provider, plus every
   attribute of the route the analysis reads (path, endpoint, response model, dependencies, ...); containers are keyed by content,
   routers and routes by identity (they define `__eq__` without `__hash__`), and anything unhashable is not cached (the real path
   runs). Every application gets its OWN context object (`dataclasses.replace` with its own provider); only the analysed parts
   (dependant, body and response fields) are shared, as every request of the one production app shares them. Not a product change:
   the product keeps fastapi's own path. `SW_TEST_ROUTE_CACHE=0` switches it off; if fastapi's private names change, `install()`
   patches nothing and the real path runs.
3. `synchronous` belongs to a connection, not to the file. The copy is the same bytes (the existing
   `test_template_copy_equals_the_real_migrations` and `test_create_app_with_and_without_the_template_build_the_same_database`
   compare schema, pragmas, every row and the integrity check); every product connection sets its own class (`db.py` `_open`, and
   `_reset` for a reused connection: FULL, or NORMAL for the mirror writes), which the new test pins after a copy.
5. Production behaviour is unchanged (60 s, now read when the call starts). The test's existing
   `monkeypatch.setattr(lv, "RESULT_WAIT_S", 0.0)` now does what it says. No assertion was changed anywhere.

Not changed on purpose: no fixture was widened to module scope (the ticket, door-window and notice worlds are mutated by their
tests; sharing them would couple tests), no data was shrunk, and no test was moved to the timing lane (no wall-clock / soak test
is in the top 25; moving a functional test there would take it out of the gate).

## 3. Proof that the guards still guard (mutation, runner job `~/work/p2520_bsc_ab.sh`, restored after each)

| pattern | mutation | result |
|---|---|---|
| route cache | `from_api_route` returns the cached context itself (no per-app provider) | `test_route_cache.py::test_each_application_keeps_its_own_dependency_overrides` FAILED (rc=1) |
| template copy | product connections opened with `synchronous=OFF` (`db.py`) | `test_db_template.py::test_the_unsynced_copy_leaves_the_application_connections_their_durability` FAILED: `assert 0 == 2` |
| 60 s wait | the timeout branch of `run_native` reports `start_unknown` instead of `result_unknown` | `test_no_final_result_is_a_fail_never_a_pass[running]` and `[lost]` FAILED |

The template and wait mutations were also run on the PC with the same results. The runner tree was clean after the job.

`test_route_cache.py::test_the_product_app_answers_the_same_with_and_without_the_cache` builds the product app once with and once
without the cache: the same status, content type and body (minus per-app ids, clock values and correlation ids) for `/api/v1/me`,
`/api/v1/settings`, an unknown route (404), a 422 refusal and `/healthz`, and the same OpenAPI document.

## 4. Measurement

Runner job `~/work/p2520_bsc_ab.sh`: one pytest process at a time, the flags of a gate shard (`-o addopts= -q -m "not timing_lane"
-o tmp_path_retention_policy=failed`); before = `origin/release/2550-train` @ 11bfcad19, after = this branch @ 7703d3d0e; each file
before and after back to back, with tmp on /dev/shm (as the gate) and on disk. Seconds are pytest wall seconds.

| file (tests) | before shm | after shm | before disk | after disk |
|---|---|---|---|---|
| test_get_routes_read_conn (744) | 833.7 | **87.4** | 722.7 | 123.8 |
| test_tickets_org_locations (49) | 119.7 | **40.1** | 224.3 | 45.5 |
| test_tickets_dept_handlers (33) | 58.6 | **22.0** | 75.8 | 32.6 |
| test_notice_delete_295 (20) | 31.8 | **11.5** | 32.5 | 12.2 |
| test_wiskey_live_validation_2390 (58) | 151.1 | **13.3** | 149.5 | 14.2 |
| test_db_template (7 / 8) | 10.8 | 11.8 | 11.9 | 12.4 |
| test_route_cache (new, 4) | - | 23.6 | - | 23.3 |
| test_doorwin_watch (22) | 121.7 (load 3) | 213.3 (load 15) | 169.8 | 165.1 |
| **sum without doorwin** | **1205.7** | **209.7** | **1316.7** | **264.0** |

Saved on these files: **996 s of 1,206 s with tmp on /dev/shm (83 %)**, 1,053 s of 1,317 s on disk (80 %). Every test passed
before and after (counts above). `test_doorwin_watch` does not gain (its time is the fake-clock watchdog loop, not cost A): the shm
pair ran while other jobs pushed the load to 15; the disk pair (load 7) is flat. PC cross-check, cache off / on, same tree:
`test_tickets_org_locations.py` 1,035 s / 384 s; `tickets_world.build` 12.0-13.6 s / 2.8-3.5 s per app.

In the 2.54 full gate the five files that gain here took 2,983 test-seconds (read_conn 1,866, org_locations 416, dept_handlers 302,
notice_delete 219, live_validation ~180).

### 4.1 The whole backend suite

Runner jobs `~/work/p2520_bsc_full*.sh`: every `tests/test_*.py`, 3 shards balanced by the 2.54 junit times, the gate's flags,
tmp on /dev/shm, the runner otherwise quiet (load 1-3). Base = `origin/release/2550-train` @ 11bfcad19, branch = @ 7703d3d0e (run 1)
and @ 451084ecc (run 2; run 3 on the final head below).

| | base | branch run 1 | branch run 2 |
|---|---|---|---|
| tests (junit) | 46,756 | 46,761 | 46,761 |
| test-seconds (junit sum) | **16,755** | 5,769 | **5,987** |
| tests of 1 s or more | 6,924 | 1,158 | 1,249 |
| shard pytest seconds | 5,825 / 5,772 / 5,440 | 1,939 / 2,167 / 1,932 | 2,002 / 2,229 / 1,994 |
| wall (the slowest shard) | **5,833 s (97 min)** | 2,175 s (36 min) | **2,237 s (37 min)** |

**Saved: 10,768 of 16,755 test-seconds (64 %); the 3-shard wall from 97 to 37 min.** Biggest file drops (base -> run 2,
test-seconds): read_conn 786 -> 103, live_validation 144 -> 5, vendor_portal 124 -> 29, partner_api 124 -> 20, access_grants
124 -> 50, org_locations 115 -> 26, rfq_award_notice 103 -> 33, dept_handlers_decisions 100 -> 20, local_passkeys 98 -> 16. The
slowest files now are `test_db_gate_stray_detector` (138), `test_doorwin_watch` (126) and read_conn (103).

What it means for the gate (an estimate, not measured: no gate was run): the 2.54 backend shards held 42,019 test-seconds on a
CPU-bound machine; the same 64 % would leave about 15,000, i.e. about 3,800 s per shard instead of about 10,500, and give the CPU
back to the Playwright pool, which becomes the critical path (GATE-SPEED-2550 1.2: 11,270 s).

Failures in these runs, each checked against the base tree:

| test | base | branch | verdict |
|---|---|---|---|
| `test_release_check.py::test_repository_is_release_consistent`, `test_release_bundle_version_2520.py::test_run_checks_reports_the_bundle_row_on_this_tree` | fail | fail | pre-existing: the train's `www/` is still the 2.54.0 build (`arx-shell-2.54.0`, build stamp 2.54.0) and no v2.55.0 tag yet; the release rebuild fixes it |
| `test_ha_state_reconcile_2550.py` (2 tests) | fail in the full shard, pass alone | the same | pre-existing order dependence in shard 2 (not investigated further here) |
| `test_wxd11_t19_fake_ha_context.py::test_t19_concurrent_runs_keep_their_own_context_doors_and_request_ids` | fail (2 of 4 with `--sw-repeat 4`) | failed in run 1, passed in run 2 and 4 of 4 repeats | pre-existing flake (`database is locked`) |
| `test_infra_elevators_280.py::test_history_hidden_from_a_viewer_who_sees_part_of_the_elevator` | pass | **failed in run 1** | exposed by speed: fixed (451084ecc) |
| `test_wire_consumption_2450.py::test_water_routes_without_another_test_answer_as_before` | pass | **failed in run 2** | exposed by speed: fixed (34a6bb45a) |

The two "exposed by speed" tests took an instant at `now` and then asked the service about that same wall-clock second, which the
service treats as a zero-length span by design (elevator history drops a zero-length trailing segment; a meter cannot be replaced
in the second its counter life began). Before this change every test app spent seconds in the route analysis, so the clock always
ticked in between. Both are fixed the way earlier fixes in the same files did it (an instant pinned inside the window, `at` = start
+ 1 s); no assertion changed. More such same-second tests may surface now that the apps answer fast; the pattern and fix are the
same.

Run 3 on the final head 34a6bb45a (same job, same split): 46,761 tests, **5,736 test-seconds**, 1,092 tests of 1 s or more, shards
1,898 / 2,163 / 1,885 s, wall 2,171 s (36 min). Failures: only the pre-existing ones of the table (`test_release_check`,
`test_release_bundle_version_2520`, the two `test_ha_state_reconcile_2550` tests); s3 (elevators, t19) and the water test passed.

## 5. Not done / open

* `run_checks(ROOT)` runs four times per gate (one per file, often in different shards): 5.9 s idle each, CPU (regex scan). A
  process-wide memo would save little across shards; left as is.
* `test_doorwin_watch.py` (126 test-seconds idle, 313 in the 2.54 gate): the watchdog loop on the fake clock is the test's subject;
  not shrunk. `test_db_gate_stray_detector.py` (138) is now the slowest file; not looked at.
* Cost B in the gate: none (its tmp is already on /dev/shm). It matters for disk runs only.
* NOT_RUN: a release gate on this branch (the runner's gate is not mine to start). The gate figure in 4.1 is an estimate.

Open questions (recommendation first):
1. `test_ha_state_reconcile_2550.py` fails in a full shard on the base tree too (passes alone). a) a separate small row to find the
   leaking state (recommended); b) leave it to the next gate's quarantine.
2. The route cache is on by default in every backend test run (`SW_TEST_ROUTE_CACHE=0` turns it off). a) keep it on (recommended);
   b) on for the gate only.
