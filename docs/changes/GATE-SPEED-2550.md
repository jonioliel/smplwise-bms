# GATE-SPEED-2550 - a faster release gate without losing coverage (target 2.55)

Branch `pilot/GATE-SPEED-2550` (base `origin/release/2550-train` @ 5aa03829b). Repository copies under `scripts/gate/` only, plus the
backend test of the gate that pins the job coverage. **Nothing was installed on the runner and no gate was started** (a 2.54 gate was
running). The runner was used read only: listings and copies of `~/smplwise-results` reports and logs, `~/gate2` and `~/nightly-gate`
checksums, one live `vmstat` / `ps` sample. Checks ran on the PC and as one slot-B job on the runner (section 6).

## 1. Measurements (read only, runner)

Sources: `gate_release-2530-train_aeb05ad3d.*` (2.53 full), `gate_release-2540-train_f9217db8a.*` (2.54 full), the 2.53 targeted runs
`gate_release-2530-train_5613a0ace.pre-gate2.*` (run 2) and `gate_release-2530-train_5613a0ace.*` (run 3), the wrapper logs
`gate2_25*.log`, each report's `phases` and pool section, the Playwright JSON reports (`pw_*.json`: per test, per project,
`stats.duration`), the backend junit XML (`backend_s*.xml`) and shard logs, 230 older reports for the trend, and a live
`vmstat` / `ps` sample during the 2.54 `--after` run.

| run | wall | before the pool | pool | backend shards (4) | max load1 | min MemAvailable |
|---|---|---|---|---|---|---|
| 2.53 full aeb05ad3d | 211 min (12660 s) | 492 s | 12104 s | 10822-12061 s | 64.0 | 121 MB |
| 2.54 full f9217db8a | 192 min (11530 s) | 247 s | 11270 s | 10229-10973 s | 99.2 | 168 MB |
| 2.53 run 2 `--after` (5613a0ace, first try) | killed at 66 min | 428 s | 3498 s (stopped) | killed | 52.5 | 1573 MB |
| 2.53 run 3 `--after` (5613a0ace) | 125 min (7515 s) | 670 s | 6528 s | 7152-7480 s (the critical path) | 66.6 | 978 MB |

Full gates on the same 8 slots / 4 shards took 128-137 min (09-11.11), 151-170 min (16-19.11) and 171-211 min (24-26.11). The suite grew
about 40 % in two weeks. Two full gates were killed by their cap (2.43.9 and 2.47.0: 198 min against a 200 min cap). The cap today is
`GATE_CAP_MAX` = 14400 s (240 min), and the 2.53 full gate used 88 % of it.

### 1.1 The machine is CPU-bound
The live sample during the 2.54 `--after` pool showed `us 83-87 %, sy 12-14 %, id 0-2 %`, a run queue of 39-51, load 41-45 on 16 cores,
2.3 GB of swap in use and about 7.7 GB RSS in 81 `chrome-headless` processes. The full gates peak at load 64-99 with 121-168 MB
MemAvailable. So the wall time is about (total CPU work / 16 cores) plus the stretches where the machine is NOT saturated. Scheduling
cannot add capacity. It can only remove the unsaturated stretches. The reports kept no CPU record (only max load and min memory), so
the idle tail had to be inferred from the job timeline. This row adds a CPU sampler (2.4).

### 1.2 Critical path: two tracks of about the same length
* Backend: 4 shards of about 10,500 s each (42,019 test-seconds and 46,556 tests in 2.54). The 9,655 tests that take 1 s or more account
  for 40,358 s (96 %). The top 30 files account for 21 %. One file, `test_get_routes_read_conn.py`, takes 1,866 s.
* Playwright pool: 8 slots, 39 jobs, 79,888 slot-seconds, so the lower bound is 9,986 s. The pool actually took 11,270 s.
* In BOTH full gates the backend finished 535 s before the pool (2.54: engine time 10,982 s against 11,517 s; 2.53: 12,061 s against
  12,596 s).

### 1.3 Where the pool loses time
1. **The pixel job is the tail.** Its estimate is the seed's `pixel_phase_seconds` = 710 s (taken from 2.9.2). It actually took 1,728 s
   (2.54), 2,386 s (2.53) and 1,739 s (2.53 run 3). The pool orders jobs by area (est x workers), so the pixel job started at pool time
   9,543 s / 9,718 s and ran ALONE at the end. In 2.54 every other job had ended by pool time 10,291 s and the backend by 10,735 s, but
   the pixel job ran until 11,271 s. Busy slots every 500 s in 2.54: `8` from 0 to 7000 s, then `7 5 7 5 8 8` (7500-10000 s), then
   `1 1` (10500-11000 s).
2. **A long file at the end of a parallel job holds all of that job's slots.** In `dev_desktop` (4 workers),
   `layout-electricity.spec.ts` (1,008 s, desktop) ran last (Playwright takes files in name order) after the other 3 workers were done.
   That left 1,189 slot-seconds idle in 2.54 and 1,263 in 2.53. The big 4-worker preview job left about 510 slot-seconds idle at its
   end.
3. **The estimates are stale.** The planner's seed `gate2_costs.json` came from the 2.19.0 gate (630 spec files; 546 of today's 1,332
   spec files were never timed). Its calibration was also 2.19.0, at 12 slots / 6 shards, while every gate since then runs 8 / 4.
4. The `--workers=1` chunks are balanced by recorded cost (est 3,633 s each; measured 2,744-3,512 s). This works.
5. Before the pool: tsc 30-122 s, build 24-56 s, the early layout stage 172-292 s (10 workers on 8 slots, with the backend already
   running). These are small.

### 1.4 Why the targeted run was killed (2.53 run 2)
`release_gate2.sh` gives a select run the limit `gate_budget.py cap --mode select`. That limit takes the phases of the newest PASSED select
run, multiplies each by 1.25, sums them and multiplies by 1.5. Here the newest such run was the small 2.52 `--after` run (34 min), so the
limit came out at **4,059 s**. Running the repository's `gate_budget.py` on a copy of the history reproduces this number exactly.

The plan for run 2 said `ESTIMATE gate2: ~91-105 min`. That estimate assumed 14 slots, but the run had `GATE_PW_SLOTS=8`: the wrapper
keeps an explicit value, and the plan ignored it. Every job after pool time 3,459 s ran for 0 s and the backend was killed. Run 3 needed
an explicit 10,800 s limit and took 125 min.

The GATE-SPEED-2320 fix (`gate_budget.py limit`, which never goes below the estimate) is installed on the runner as `~/gate_budget.py` and
`~/gate2/gate_budget.py`. That copy is why every gate prints `engine_sync: WARNING drift DIFFERENT ~/gate2/gate_budget.py`. But
`chore/GATE-SPEED-2320` was never merged, and the wrappers still call `cap`.

### 1.5 The slowest 30 spec files
Measured in the 2.54 full gate, as test-seconds summed over tests and projects. Together they are 29.1 % of 71,956 s.

| # | spec file | seconds | per project | job |
|---|---|---|---|---|
| 1 | layout-skin-qa-2403.spec.ts | 1395 | desktop 1059, tablet 7, mobile 329 | preview_desktop-tablet-mobile |
| 2 | evidence-nn1-p2.spec.ts | 1235 | desktop 380, tablet 363, mobile 491 | preview_desktop-tablet-mobile |
| 3 | layout-tickets-tabs.spec.ts | 1018 | desktop 1017, mobile 1 | preview_desktop-tablet-mobile_w1_c0 |
| 4 | layout-electricity.spec.ts | 1008 | desktop 1008 | dev_desktop |
| 5 | layout-schedules-parity.spec.ts | 822 | desktop 822 | dev_desktop_w1_c0 |
| 6 | evidence-menu-opaque.spec.ts | 814 | desktop 412, tablet 3, mobile 399 | preview_desktop-tablet-mobile_w1_c6 |
| 7 | evidence-replay-3d.spec.ts | 786 | desktop 285, tablet 261, mobile 240 | preview_desktop-tablet-mobile |
| 8 | uxrest-states.spec.ts | 783 | desktop 261, tablet 275, mobile 248 | preview_desktop-tablet-mobile |
| 9 | evidence-plan-3d-dpr-cap.spec.ts | 773 | desktop 278, tablet 261, mobile 233 | preview_desktop-tablet-mobile_w1_c1 |
| 10 | layout-update-screens.spec.ts | 759 | desktop 759 | dev_desktop |
| 11 | evidence-system-update-apply.spec.ts | 724 | desktop 222, tablet 257, mobile 245 | preview_desktop-tablet-mobile |
| 12 | evidence-automations-builder.spec.ts | 699 | desktop 296, tablet 277, mobile 127 | preview_desktop-tablet-mobile_w1_c2 |
| 13 | evidence-wiskey-stations.spec.ts | 687 | desktop 206, tablet 146, mobile 336 | preview_desktop-tablet-mobile_w1_c6 |
| 14 | layout-worstcase-screens-297.spec.ts | 667 | desktop 250, tablet 200, mobile 217 | preview_desktop-tablet-mobile |
| 15 | layout-tickets-board.spec.ts | 641 | desktop 640 | preview_desktop-tablet-mobile_w1_c0 |
| 16 | unit-plan-3d-realistic.spec.ts | 587 | desktop 246, tablet 190, mobile 152 | preview_desktop-tablet-mobile |
| 17 | layout-tickets.spec.ts | 585 | desktop 584 | preview_desktop-tablet-mobile_w1_c4 |
| 18 | layout-access-events.spec.ts | 583 | desktop 583 | dev_desktop_w1_c1 |
| 19 | evidence-plan-studio-6.spec.ts | 558 | desktop 293, mobile 265 | preview_desktop-mobile |
| 20 | evidence-security-polish.spec.ts | 550 | desktop 212, tablet 1, mobile 337 | preview_desktop-tablet-mobile_w1_c4 |
| 21 | layout-electricity-meters.spec.ts | 544 | desktop 544 | dev_desktop_w1_c3 |
| 22 | layout-access-status.spec.ts | 540 | desktop 540 | dev_desktop_w1_c2 |
| 23 | layout-media-admin-list.spec.ts | 539 | desktop 539 | dev_desktop_w1_c4 |
| 24 | evidence-design-foundation.spec.ts | 539 | desktop 218, tablet 33, mobile 287 | preview_desktop-tablet-mobile_w1_c5 |
| 25 | layout-tickets-table.spec.ts | 537 | desktop 536 | preview_desktop-tablet-mobile_w1_c3 |
| 26 | unit-plan-3d-odd.spec.ts | 534 | desktop 369, tablet 62, mobile 103 | preview_desktop-tablet-mobile |
| 27 | evidence-notifications.spec.ts | 516 | desktop 194, tablet 144, mobile 179 | preview_desktop-tablet-mobile_w1_c3 |
| 28 | layout-noscroll-297.spec.ts | 509 | desktop 509 | dev_desktop |
| 29 | evidence-schedules-list.spec.ts | 508 | desktop 145, tablet 210, mobile 152 | preview_desktop-tablet-mobile_w1_c7 |
| 30 | layout-tickets-map.spec.ts | 506 | desktop 499, tablet 4, mobile 3 | preview_desktop-tablet-mobile_w1_c5 |

### 1.6 The slowest 30 backend test files
Measured in the 2.54 full gate, as junit seconds. Together they are 21.4 % of 42,019 s.

| # | test file | seconds |
|---|---|---|
| 1 | test_get_routes_read_conn.py | 1866 |
| 2 | test_tickets_org_locations.py | 416 |
| 3 | test_partner_api_113.py | 369 |
| 4 | test_access_grants.py | 346 |
| 5 | test_doorwin_watch.py | 313 |
| 6 | test_tickets_dept_handlers.py | 302 |
| 7 | test_tickets_vendor_portal.py | 279 |
| 8 | test_nvr_stream_batch.py | 266 |
| 9 | test_nvr_connection.py | 255 |
| 10 | test_notify_whatsapp.py | 247 |
| 11 | test_tickets_dept_handlers_decisions.py | 245 |
| 12 | test_maintenance_215.py | 240 |
| 13 | test_tickets_handler_load.py | 237 |
| 14 | test_remote_access.py | 234 |
| 15 | test_local_passkeys.py | 233 |
| 16 | test_app_session_295.py | 232 |
| 17 | test_tickets_s5b_channel.py | 230 |
| 18 | test_nvr_stream_write.py | 225 |
| 19 | test_local_identity.py | 225 |
| 20 | test_notice_delete_295.py | 219 |
| 21 | test_bridge_keyrot_harness_295.py | 216 |
| 22 | test_tickets_s4_assign.py | 213 |
| 23 | test_tickets_detail.py | 209 |
| 24 | test_notices_106.py | 208 |
| 25 | test_nvr_less.py | 207 |
| 26 | test_bustimes_295.py | 204 |
| 27 | test_tickets_vendor_portal_more.py | 198 |
| 28 | test_app_refresh_295.py | 192 |
| 29 | test_tickets_staff_links.py | 191 |
| 30 | test_lobby_styles_2300.py | 190 |

The slowest single tests are `test_tickets_org_locations.py::test_bad_fields_are_refused_by_name[...url_not_allowed]` (144 s),
`test_release_bundle_version_2520.py::test_run_checks_reports_the_bundle_row_on_this_tree` (141 s) and
`test_tickets_dept_handlers.py::test_the_people_picker_is_names_only_and_needs_the_capability` (135 s). After them come the repository
scanners (`test_no_ip_literals`, the ratchets, `test_supervisor_build_check`) at 59-75 s each.

## 2. Changes

| # | file | change | knob (default v2 / v1) |
|---|---|---|---|
| 2.1 | `release_gate.py` | The pixel estimate is now the sum of each pixel file's measured process wall: `pw_pixel_*.json` `stats.duration` from the last 10 gates, else the seed's `pixel_seconds`, else the old rule. | - |
| 2.2 | `release_gate.py` | The pixel files are split into `ceil(estimate / GATE_CHUNK_TARGET_SECS)` one-worker jobs `pixel_c<i>` (at most 3), balanced by measured wall. Log names keep the global index (`pw_pixel_<i>.json`). | `GATE_PIXEL_CHUNKS` 0=auto / 1; `GATE_PIXEL_MAX_CHUNKS` 3 |
| 2.3 | `release_gate.py` | Heavy-unit split: in a PARALLEL group, a (file, project) unit whose recorded seconds are at least max(300 s, 25 % of the group's expected wall) runs as its own one-worker job (`<group>_h<k>`, `"heavy": true`). The file's other projects run together in one more job. Untimed files never move; at most 6 such jobs per group; `--workers=1` groups are not touched. | `GATE_HEAVY_SPLIT_SECS` 300 / 0, `GATE_HEAVY_SPLIT_FRAC` 0.25, `GATE_HEAVY_MAX_JOBS` 6 |
| 2.4 | `release_gate.py` | CPU sampler in the 30 s heartbeat (`/proc/stat`), stored as `resources.cpu_busy_pct[]`, `idle_core_s` and `cpus`. The report line adds "CPU 16 cores: busy N % on average, idle M core-min, last tenth of the run busy K %". | - |
| 2.5 | `release_gate.py` | `--seed-from` also writes `pixel_seconds` and `pixel_phase_seconds` (the sum of the process walls). | - |
| 2.6 | `gate_budget.py` | The 2320 `limit` (same CLI as the runner copy), plus a load factor `1 + max(0, load1 - 0.25 x nproc) / nproc`, at most 1.6. `limit = max(derived cap, estimate high x 1.25 x load factor)`, never below the estimate; an explicit limit wins. | `GATE_EST_FACTOR` 1.25, `GATE_LOAD_FREE` 0.25, `GATE_LOAD_FACTOR_MAX` 1.6 |
| 2.7 | `release_gate2.sh` | Select runs take `limit` from the plan plus `/proc/loadavg` and `nproc`, with the old `cap` as fallback. `--full` runs also use the plan's full-tier estimate as a floor. `--dry-run` prints the limit a real run would get. | `GATE_TOTAL_SECS` wins |
| 2.8 | `branch_check.sh` | The entry check gets the same limit (it used the derived select cap, else 5400 s). | `ENTRY_TOTAL_SECS` wins |
| 2.9 | `gate2_select.py` | The estimate uses an explicit `GATE_PW_SLOTS` / `GATE_BACKEND_SHARDS`, and the knobs line says so. The calibration is now the 2.54.0 gate (8 slots, 4 shards, pool 11,270 s, 247 s before the pool). The heavy deferral reads the frozen `defer_seconds`. | - |
| 2.10 | `gate_durations.json`, `gate2_costs.json` | Refreshed from the 2.54.0 full gate (1,150 spec files, 1,099 backend files, 70 pixel walls). `gate2_costs.json` keeps the 2.19.0 seconds as `defer_seconds`, so **what a select gate runs does not change**. With the measured seconds, 17 heavy sweeps would come back into select gates and `layout-skin-qa-2403.spec.ts` would be left to the nightly (question 1). | - |
| 2.11 | `engine_sync.py` | The install map also covers `gate_budget.py`, `gate_durations.json`, `gate2_costs.json`, `branch_check.sh` (atomic `os.replace`) and `selftest_gate_speed_2550.py`. | - |
| 2.12 | `selftest_gate_speed_2550.py` | 62 cases, fake data only, Windows and Linux. | - |
| 2.13 | `smplwise_vms/backend/tests/test_gate_speed.py` | The coverage test now allows a heavy job (one file, a subset of its projects, one worker) and several pixel jobs. It still checks that every (spec, project) is in exactly one job and every pixel spec runs exactly once. | - |

Not changed: the job order rule (area first). On measured estimates it lands within 2 % of the lower bound; plain longest-first was not
better in the replay. Also unchanged: the memory guard, the early stage, the backend split, the selection itself, every verdict,
quarantine and baseline rule, and `nightly_tests.sh`.

Coverage: no test, project or backend file is dropped or added. The heavy split and the pixel chunks only move existing
(spec, project) units into other processes, on the same server with the same grep. The self-test and the backend test both assert
"every unit exactly once". The deferral list is frozen (2.10).

## 3. Expected wall-time gain (arithmetic from the measurements)

### 3.1 Full gate
**2.54 (192 min = 11,530 s).** With the measured estimate, the pixel work (1,728 s on one slot, about 1.25 cores) moves into the
saturated part of the run. A replay of the 2.54 pool with the measured walls moves the pixel start from 8,558 s to 7,501 s, and with 2
chunks it ends long before the other jobs. Its CPU then costs the other jobs about 1,728 x 1.25 / 16 = ~135 s. The other pool jobs ended
at engine time 247 + 10,291 = 10,538 s, so the pool would end at about 10,538 + 135 = ~10,673 s, **before the backend (10,982 s)**. The
gate then ends with the backend: 11,530 - 10,982 - ~15 s (report) = **~530 s saved, about 9 min (192 -> ~183 min, -4.6 %)**.

**2.53 (211 min).** The other jobs ended at engine time 492 + 11,925 = 12,417 s and the backend at 12,061 s. A replay of its pool with
measured estimates goes from 12,071 s to 11,788 s (-283 s), so **about 4-5 min saved (-2 %)**.

The heavy split frees about 1,190 slot-seconds per full gate (dev_desktop), which is 1,190 / 8 = ~150 s of pool time in the slot model.
On a CPU-saturated machine most of that is not really lost today, so it is NOT counted (0-2.5 min).

**Expected: 4-9 min per full gate (2-5 %).** After this change the backend is the only critical path (section 4).

### 3.2 Targeted `--after` runs
Here the gain is a run that is no longer killed. 2.53 run 2 would have had a limit of max(4,059 s, 106 min x 1.25) = **7,950 s
(132 min)** instead of 4,059 s. This comes from a dry-run of the new planner on the run-2 tree with 8 slots / 4 shards, the run-2 history
and `gate_budget.py limit`. Run 3 needed 125 min. Saved: the 66 min that were killed, plus the manual re-run with an explicit limit.

With load 12 on 16 cores at the start, the limit would be x 1.5 = 198 min. The new plan for that tree says `~86-106 min` (the old one
said `~91-105 min`, for 14 slots). The run actually took 125 min, so the 1.25 margin leaves 6 % headroom (question 2).

### 3.3 Full-gate limit
Without a plan, the full cap is pinned at 14,400 s (240 min) while full gates keep growing (211 min on 26.11). The full branch now also
takes the plan's full-tier estimate x 1.25 (x load). For the 2.53 tree that gives max(14,400, 194 min x 1.25 = 14,550 s). The limit keeps
growing with the suite instead of killing a gate at 240 min, the way 2.43.9 and 2.47.0 were killed at 200 min.

## 4. What would make the gate much faster (not in this row - owner decisions)
1. **The backend tests** (42,019 s; 96 % in tests of 1 s or more; `test_get_routes_read_conn.py` alone takes 31 min; the repository
   scanners take about 1 min each). The cost looks like per-test app / database setup under load. A separate row that profiles the
   slowest 30 files and shares fixtures could shorten this co-critical track directly.
2. **Balance after this row.** The backend now ends last. Try `GATE_BACKEND_SHARDS=5 GATE_PW_SLOTS=7` on one nightly and read the new
   CPU line. Memory is tight: 121-168 MB MemAvailable at the peak.
3. Overlap the end of the early stage and the dev-server jobs with tsc / build (about 1-3 min).

## 5. Install steps (runner, quiet window - NOT done)
Preconditions: `~/smplwise-results/gate_status.json` is not `running`, no entry check is running (`entry_status.json`), and the nightly
is not running (02:00-06:00 Israel time). The release gate refuses to run when the installed engine differs from the branch's
`scripts/gate/release_gate.py` (TR-02). So install **after this branch is merged into the train that is gated next**, from that train's
commit. Otherwise every gate needs `--engine-drift-ok`.
```
cd ~/smplwisebms && git fetch -q origin
git worktree add --detach ~/work/gs2550-install origin/<train with GATE-SPEED-2550>
cd ~/work/gs2550-install/scripts/gate
python3 selftest_gate_speed_2550.py && python3 selftest_gate.py && python3 selftest_gate_fast.py && python3 selftest_entry_check.py
F=release_gate.py,release_gate2.sh,engine_sync.py,selftest_gate.py,gate2_select.py,gate_budget.py,gate_durations.json,gate2_costs.json,branch_check.sh,selftest_gate_speed_2550.py
python3 engine_sync.py install --src ~/work/gs2550-install --files "$F" --suffix .bak_2550           # dry run: lists every copy
python3 engine_sync.py install --src ~/work/gs2550-install --files "$F" --suffix .bak_2550 --apply   # backups <file>.bak_2550
python3 ~/gate2/selftest_gate_speed_2550.py
python3 ~/gate2/engine_sync.py check --repo ~/smplwisebms --ref origin/<train>                         # in sync, no gate_budget drift
~/gate2/release_gate2.sh <train> --dry-run          # last lines: "time limit: limit N s (...) = max(derived select cap ..., estimate high ...)"
git -C ~/smplwisebms worktree remove ~/work/gs2550-install
```
The new `gate_budget.py` replaces the 2320 copy. It is a superset: the same CLI, plus `--load1` / `--nproc`. `release_gate2.sh` copies
`~/gate_budget.py` and `~/gate_durations.json` into `~/gate2/` at every real run. The nightly engine (`~/nightly-gate/release_gate.py`)
gets the same engine and seed, so the pixel and heavy changes apply there too; `nightly_tests.sh` is unchanged.

Rollback without reinstalling: `GATE_PIXEL_CHUNKS=1`, `GATE_HEAVY_SPLIT_SECS=0`, or an explicit `GATE_TOTAL_SECS`. Full rollback: the
`.bak_2550` files.

After the first full gate with this change, check three things. In the pool section, the pixel jobs `pixel_c0/1` start before 2 h and
there is no single-slot tail. The new CPU line's "last tenth busy" stays high. Then refresh the seeds with
`python3 ~/release_gate.py --seed-from <logs> "<source>"`.

## 6. Tests
PC (Windows, one file per process; `py -3.12`, the backend tests with the project venv):

| command | exit | result |
|---|---|---|
| `py -3.12 scripts/gate/selftest_gate_speed_2550.py` | 0 | 62 OK, SELFTEST OK (also without `PYTHONUTF8`) |
| `py -3.12 scripts/gate/selftest_gate_fast.py` | 0 | SELFTEST PASSED |
| `py -3.12 scripts/gate/test_selftest_hermetic.py` | 0 | clean + polluted PASSED, HERMETIC |
| `py -3.12 scripts/gate/selftest_gate_trust.py` | 0 | SELFTEST PASSED |
| `py -3.12 scripts/gate/selftest_engine_sync.py` | 0 | SELFTEST PASSED (after the install-map change) |
| `pytest tests/test_gate_speed.py` | 0 | 18 passed, 1 skipped |
| `pytest tests/test_gate2_select.py` | 0 | 17 passed |
| `pytest tests/test_fixture_job.py` / `test_targeted_plan.py` / `test_gate_always_run.py` | 0 | 16 / 23 / 19 passed |
| `pytest tests/test_gate_visual_block_t074.py` / `test_select_tests.py` / `test_gate_tablet_allowlist.py` | 0 | 14 / 20 / 4 passed |
| `bash -n release_gate2.sh branch_check.sh` (inside the self-test, Git Bash) | 0 | syntax OK |

Dry-runs on throw-away results folders (PC):
* `release_gate.py --plan --root <this tree>`, with `GATE_RESULTS_DIR` pointing to a scratch copy of the 2.54 logs and 8 slots / 4
  shards. Old engine: `pixel` is 1 job, est 11.8 min. New engine: `pixel_c0` 14.0 min + `pixel_c1` 13.9 min (measured), and
  `dev_desktop` goes from 4 workers x 21.8 min to 3 workers x 14.5 min plus `dev_desktop_h0..h3` (16.8 / 12.6 / 8.5 / 5.8 min). The
  backend, 4 shards at about 176 min, is the critical path, as measured.
* `gate2_select.py plan` on the 2.53 run-2 tree (5613a0ace, base aeb05ad3d, `--after` the 2.53 report). Old:
  `knobs ... GATE_PW_SLOTS=14 ... ~91-105 min`. New: `GATE_PW_SLOTS=8 [estimated with the explicit ...] ~86-106 min`.
* `gate_budget.py` on a copy of the history as it was at the time of run 2. Old `cap` = 4059. New `limit` = 7950 (load 3) / 11925
  (load 12).

Runner (Linux, slot-B job `~/work/p2520_gatespeed2550_run.sh` at b330e0887, 2026-11-27 00:37-00:43 UTC, after the 2.54 gate had
finished; no gate lock, nothing installed, throw-away results folder `/tmp/gs2550_res` removed afterwards):

| command | exit | result |
|---|---|---|
| `python3 scripts/gate/selftest_gate_speed_2550.py` | 0 | SELFTEST OK |
| `python3 scripts/gate/selftest_gate.py` | 0 | SELFTEST PASSED (176 s) |
| `python3 scripts/gate/selftest_gate_fast.py` | 0 | SELFTEST PASSED |
| `python3 scripts/gate/selftest_entry_check.py` (runs `branch_check.sh` end to end, fake engine and `flock`) | 0 | SELFTEST PASSED |
| `python3 scripts/gate/selftest_gate_trust.py` / `selftest_engine_sync.py` | 0 / 0 | SELFTEST PASSED / PASSED |
| `bash scripts/gate/tests/test_branch_check_fifo.sh` | 0 | FIFO TEST PASSED |
| `pytest tests/test_gate_speed.py` / `test_gate2_select.py` (Linux venv) | 0 / 0 | 19 passed / 17 passed |
| `ruff check --select F` on the changed Python files | 1 | 1 finding: `import math` unused in `gate2_select.py` (already in the base); removed in the next commit, the self-test re-run OK |
| `release_gate.py --plan` base vs new (2.54 logs linked read only) | 0 / 0 | base: `pixel` 1 job 11.8 min start 133 min; new: `pixel_c0/c1` 14.0 / 13.9 min start 121 min, `dev_desktop_h0..h3`; backend 176 min critical path |
| `release_gate2.sh pilot/GATE-SPEED-2550 --after <2.54 report> --dry-run` | 0 | no coverage anchor for this branch in the copy -> full plan; `time limit: limit 16587 s (276 min) = max(derived full cap 14400 s, estimate high 194 min x 1.25 x load factor 1.14 (load1 6.3 on 16 cores))` |
| `release_gate2.sh pilot/GATE-SPEED-2550 --full --dry-run` | 0 | `limit 17315 s (288 min)`, load factor 1.19 (load1 7.1) |

One more calibration point: the 2.54 `--after` run (c768bfc8a) finished green in 2,229 s (37 min) against its plan `~33-37 min`.

## 7. Open questions (recommendation first)
1. The heavy deferral list (what a select gate leaves to the nightly): (a) keep the frozen 2.19.0 list (recommended; no coverage
   change now); (b) use the measured 2.54 seconds: 17 heavy sweeps come back into select gates (slower select runs), and
   `layout-skin-qa-2403.spec.ts` is newly left to the nightly.
2. The estimate margin for targeted runs: (a) keep x 1.25 with the load factor (recommended; for 2.53 run 3 the limit would be
   132 min against 125 min measured); (b) x 1.4 for more headroom.
3. The full-gate cap: (a) leave `GATE_CAP_MAX` at 240 min; the estimate path lifts the limit as the suite grows (recommended);
   (b) also raise `GATE_CAP_MAX` to 300 min.
4. A row for the backend test cost (section 4.1): (a) yes, for 2.56 (recommended); (b) later.
5. One nightly with 5 shards / 7 slots (section 4.2): (a) yes, after this change is installed (recommended); (b) no.
