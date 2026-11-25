# Gate lanes (GATELANES-297)

Owner approval 2026-10-27 of the three proposals in `docs/testing/GATE_AUDIT_2026-10-27.md` (P1 fewer pixel skins, P2 archive the
September owner-round specs, P3 a separate lane for the timing tests). This page is the reference for what runs where.

## 1. The lanes

| Lane | What | When | Blocks a release? |
|---|---|---|---|
| Release gate (`release_gate.sh`, tier L) | everything under `frontend/tests/*.spec.ts` (top level) and `smplwise_vms/backend/tests/test_*.py`, EXCEPT the timing lane | on demand, one per release candidate | yes |
| Nightly (`nightly_tests.sh`) | the same engine and the same exclusions, on `main` | 02:00 | no (it is the safety net; reds become fixes) |
| **Timing lane** (`timing_lane.sh`) | ONLY the tests tagged `@timing-lane` (Playwright) / marked `timing_lane` (pytest) | after every gate, in the background, once the runner is quiet | **no** |
| **Fixture lane** (section 5) | the `"gate": true` specs of `fixture_specs.json`, each group against its own throwaway fixture backend | inside every tier-L gate; alone with `fixture_lane.sh` | inside a gate: yes (category `fixture`); alone: no |
| Archive (`frontend/tests/archive/`) | retired specs, history only | never | - |

## 2. Pixel baselines: classic + domus (P1)

- The skins that carry pixel baselines are ONE line: `PIXEL_SKIN_IDS` in `frontend/tests/helpers/pixel-skins.ts` (today
  `['classic', 'domus']`). The frozen skin (bubble, `helpers/frozen-skins.ts`) stays out of everything.
- Every per-skin case of the 12 `pixel-*.spec.ts` files that iterate skins still runs for every skin under test:
  - a pixel skin: `"<skin> is pixel-stable: ..."` - the screenshot compare, in the gate's pixel step (`--grep pixel-stable`);
  - any other skin (tesla, crystal): `"<skin> draws ... (structural smoke, no pixel baseline)"` - the SAME navigation to the SAME
    screen, then `expectSkinSmoke()`: the requested skin is the one drawn (`html[data-skin]`), the screen's element is visible with a
    real size, the page does not overflow sideways, and the page threw no error. It runs in the gate's preview / dev group.
- The tesla and crystal baselines (69 linux PNGs) were deleted; git history keeps them.
- Add a skin back: add it to `PIXEL_SKIN_IDS`, take its linux baselines on the runner with
  `npx playwright test tests/<pixel spec> --project=desktop --project=mobile --update-snapshots=missing`, review, commit.
- Single-skin pixel cases (`classic is pixel-stable: ...`) and the M074 visual matrix (classic only) are unchanged.

## 3. Archive (P2)

`frontend/tests/archive/owner-rounds-2026-09/`: `evidence-owner-round1..11.spec.ts` and `evidence-form-round9.spec.ts` (12 files,
105 tests over the three projects; all `SW_LIVE=1` live specs from the September owner review rounds, never run by a gate).
Moved with `git mv` (history kept). Ignored by `playwright.config.ts` / `playwright.unit.config.ts` (`testIgnore: ['**/archive/**']`)
and by `tsconfig.json` (`exclude`); the gate (`release_gate.py classify()`), the selection (`select_tests.py`) and the nightly glob
`frontend/tests/*.spec.ts` at the top level only. Restoring one: `frontend/tests/archive/README.md`.

## 4. The timing lane (P3)

### What is in it (and what stays blocking)

| Test | Why in the lane | What stays in the blocking gate |
|---|---|---|
| `test_f3a_doorwin_dw03_295.py::test_the_in_flight_slot_is_freed_when_the_hung_call_ends` (new: the second half of the old in-flight cap test) | the hung call's thread must free its slot within 2 s; the combined test was FLAKY 8 / 40 | `test_the_in_flight_cap_refuses_to_send_rather_than_queue`: with the cap full every call is refused `not_sent:lane_full` and never reaches the engine (physical-command safety) - no clock in it any more. Every other DW-03 test (hung doors, deadline, stale-row claim, late answers) is unchanged and blocking. |
| `test_lat1_toggle_latency.py::test_toggle_reaches_ha_and_pushes_back_without_waiting` | dispatch / push median bounds under a load factor; FLAKY 3 / 40 | new `test_toggles_reuse_one_connection_and_report_every_hop` (one keep-alive connection, every Server-Timing hop); the record-before-send, never-sent-when-unrecorded and duplicate-click tests of the same file are unchanged and blocking |
| `test_lat1_toggle_latency.py::test_the_recorded_command_leaves_promptly_once_the_write_lock_is_free` (CR-BE-FOLLOWUPS-2470: the upper bound split out of the held-lock test) | "leaves within 400 ms of the lock being free" is wall-clock; it failed under load on old and new code | `test_the_command_is_recorded_before_it_leaves_and_waits_for_a_short_write_lock`: the record is durable before the call arrives, the call does not leave before the lock is free, the 202 and the `attempt` audit row - no wall-clock ceiling in it |
| `test_plan_detect_baseline.py::test_every_plan_finishes_inside_the_wall_clock_budget` (TIMING-LANE-2480: the wall-clock half of the detection baseline) | the 15 s per plan of T086 / AT172 is a true latency budget; the 2.47.0 gate run 1 (load ~250) took the `apartment` plan past it | `test_baseline_on_the_synthetic_set`: every quality bound unchanged, and the same 15 s budget as the detector's CPU time (`cpu_ms`, `time.process_time`) - an algorithmic regression still fails the blocking gate, a descheduled run does not |
| `evidence-nvr-cameras-batch.spec.ts` describe "hundreds of cameras" (300 cameras) | scale / timing under load; FLAKY 10 / 40 | the ONE-confirmation, progress, stop, undo, unknown-outcome and permission tests of the batch (same file) |
| `unit-plan-3d-realistic.spec.ts` "the level-3 graph is deterministic ..." | two full rebuilds on SwiftShader; FLAKY 6 / 40 | the other level-3 tests |
| `unit-plan-3d-view.spec.ts` "frames render on demand ..." | counts frames over wall-clock windows; FLAKY 6 / 40 | the other 3D view tests |
| `evidence-uxfix-rtl.spec.ts` "a russian / english title keeps its beginning" | wrapping measured while the web fonts load; FLAKY 4 / 40 | the Hebrew-date title and the sites / buildings cases |

Kept blocking on purpose although they flake: `test_installation_capabilities.py::test_route_sweep[*]` (permission sweep, security),
`test_tickets_public_server.py::test_one_upload_in_flight_per_link_at_the_socket` (public-surface abuse guard).
A FLAKY result never blocks a gate anyway (each failure is retried alone).

### Made clock-free instead (TIMING-LANE-2480)

The 2.47.0 gate run 1 (runner load up to ~250) failed eight backend tests that pass alone. Only one of them measures a real latency
budget (the plan-detection row in the table above); the other seven waited for, or bounded, something by the wall clock that the test
does not mean to measure. They now pin the clock the product code reads, or wait on the event itself, and stay in the blocking gate
with every assertion they had (several got stronger). Rule: before a test goes into the lane, look for the clock it reads.

| Test | The wall-clock dependence | Now |
|---|---|---|
| `test_f3a_doorwin_dw03_295.py::test_four_hung_doors_do_not_hold_back_the_other_four` | an answering door had to answer inside the real 0.5 s per-call deadline, plus an `elapsed < 4.5 s` bound | `DeadlineClock` (in the test file): door_emergency's own `threading.Event` / `futures_wait` / call-budget clock run on a clock the test advances once the four answering doors HAVE answered while the hung four are in flight; then the hung four end `unknown/deadline`, the incident settles without the dispatcher's grace, and the late answers are awaited (event) instead of a 0.2 s sleep. No product constant changed. |
| `test_lat1_toggle_latency.py::test_a_command_whose_record_cannot_be_written_in_time_is_never_sent` | the write lock was held for `PENDING_WAIT_S + 2` s of wall clock; a slow request reached its record wait after the holder let go and was sent | the lock is held until the request has answered (event; `HANG_GUARD_S` only frees a hung test) |
| `test_sync_gate_wait.py::test_sync_handlers_do_not_starve_behind_gate_waiters` | gate waiters timed out (`BUSY_TIMEOUT_S` 8 s) while 45 writers were still being queued; 1 s per-writer cap; `elapsed < 8 s` | the gate queue's entry wait is untimed in this test (db.py's own `threading.Event` only); each writer is awaited into the queue (event); starvation is asserted where it happens: while the writers are parked the shared AnyIO pool keeps a free thread (a mutation that puts the gate wait back into the shared pool fails at once: "writer 38: ... 40 of 40") |
| `test_soak_edges_2450.py::test_d1_ha_websocket_drop_and_reconnect_three_cycles` | the thread-leak check compared every live thread; an AnyIO worker thread of the test client (idles out ~10 s later) or a daemon thread of an earlier test in the shard came and went between snapshots | AnyIO workers are left out like the other pool workers, and so are threads alive before the test began (`own_threads(started_before)`); a thread leaked per reconnect still fails it |
| `test_wiskey_door_tech.py::test_the_view_says_who_may_write_what_this_wiskey_offers_and_the_recent_writes` (and `test_the_cooldown_after_a_send_and_not_after_a_refusal`) | two real posts had to land inside the 3 s cool-down | the cool-down's `time.monotonic()` (services/wiskey_door_tech.py) is a `ManualClock`; the cool-down test also proves the end of the window (2.9 s: refused, 3.1 s: sent) |
| `test_partner_api_113.py::test_sec217_global_failure_flood_never_locks_out_a_valid_token` | 320 failures (a TestClient each) had to fit in one minute of wall clock | `PartnerApp(clock=...)` pinned: all 320 fall in one window on any machine |
| `test_setup_wizard.py::test_unknown_step_rate_limit_and_audit` | the second check had to come within 5 s of the first live check | the slot's `time.monotonic()` (services/setup_wizard.py) is a `ManualClock`; the test also proves the slot frees after `CHECK_EVERY_S` |

Helpers: `tests/support/waiting.py` `ManualClock` (a monotonic clock only the test moves) and `time_shim(monotonic=..., wall=...)` (a
stand-in for one module's `import time`; the `datetime_shim` pattern).

### Proposed gate change (for the lead; runner-side, not made here)

The lane already exists and needs nothing new for the one test added to it. Today the lane run uses the gate's backend sharding
(`GATE_BACKEND_SHARDS`, 6 shards under schedule v2), so its few files still run side by side. To run the lane's backend tests alone and
SERIALLY after the gate, `timing_lane.sh` would export `GATE_BACKEND_SHARDS=1` next to `GATE_LANE=timing` (one pytest process; the lane
files take well under its 45 min budget). The quiet-machine wait and the shared tests lock stay as they are.

### How to put a test in the lane

- Playwright: `test('title', { tag: '@timing-lane' }, async (...) => ...)` (or on a `test.describe`). Keep at least one untagged test
  in the file, or the gate's run of that file finds no test.
- pytest: `@pytest.mark.timing_lane` (registered in `smplwise_vms/backend/pyproject.toml`).
- Never tag a test whose assertion is a physical-command safety, permission or security rule: split it so that the rule stays in a
  clock-free test in the blocking gate and only the wall-clock part moves (as the door in-flight cap above).

### How the gate leaves it out

`scripts/gate/release_gate.py`: every Playwright run adds `--grep-invert @timing-lane` (combined with `pixel-stable` in the preview
groups); every pytest shard adds `-m "not timing_lane"`. The self-test (`selftest_gate.py`) checks both.

### How the release script invokes it

`release_gate.sh <branch> ...` runs the gate; after the verdict (its exit code is unchanged) it starts
`timing_lane.sh <branch>` in the background (`nohup setsid`, without the gate's lock file descriptors) and prints where the log is.
`GATE_TIMING_LANE=off` skips that. `timing_lane.sh`:

1. waits up to `LANE_WAIT_SECS` (4 h) until no gate holds `~/.smplwise-gate.lock` and the 1-minute load is under `LANE_MAX_LOAD`
   (half the CPUs); otherwise it logs "NOT RUN" and stops;
2. takes `~/.smplwise-tests.lock` SHARED (as `run_remote.sh visual / fixture`; a gate or the nightly that starts meanwhile sees the
   lock and exits 3, so the lane keeps its run short: budget `LANE_TOTAL_SECS`, 45 min);
3. runs the same engine with `GATE_LANE=timing`: worktree `~/work/lane-<branch>`, tsc + build, only the tagged / marked tests, each
   failure retried alone; no release_check, visual step, pixel step or count-baseline check;
4. writes `~/smplwise-results/timing-lane/gate_<branch>_<sha>.{json,md}` (header "מסלול התזמון (לא חוסם)") and
   `timing-lane/lane_last.log`; exit code 0 whatever the verdict.

By hand: `nohup ~/timing_lane.sh <branch> [--now] >/dev/null 2>&1 &` (`--now` skips the quiet wait, not the lock).
The lead reads the lane report with the gate report; a red lane test is a ticket, not a release blocker.

### Install

`timing_lane.sh` sits next to `release_gate.sh` / `release_gate.py` on the runner (`scripts/gate/INSTALL_ON_RUNNER.md`). Until the new
engine is installed there, gates run the old engine: the lane tests then still run inside the gate (as before), nothing is lost.

## 5. The fixture lane (GATE-FIXTURE-LANE-2530)

Before this change a tier-L gate started ONE fixture backend (`devices_fake_ha.py`) for three specs; every other spec that needs a
throwaway backend - or only an env switch such as `DP_OUT` / `SW_SHOTS=1` - self-skipped in every released gate, so its card could
never be accepted on gate evidence (docs/changes/ACCEPT-SWEEP-2530.md, "runner follow-up").

### What runs

`frontend/tests/fixtures/fixture_specs.json` is the single list (also read by `scripts/fixture_job.py`). Every **group** with a
`"gate": true` spec is one fixture run: its backend (`script`, or none for `"script": null`) on free ports with its own empty data
dir, a `vite preview` of the built `dist` proxying to it, its specs with the group's `pw_env`, each failure retried alone (FLAKY rule),
then each `then` stage on the same data dir (the backend restarted on the same port with the stage's env, the specs run again).
Placeholders in env values: `{port}`, `{port+N}` (control / fake ports right above the API port, `extra_ports`), `{out}` (the group's
output folder under the run's logs: `fixture_<group>_out/`).

| Group | Backend | Specs (projects) | Cards it serves |
|---|---|---|---|
| `devices` | `devices_fake_ha.py` | camera-card (3), curved-walls / curve-points (desktop, mobile), **floorstrip** (desktop, mobile); home-screen listed, `"gate": false` (see below) | CURVEDGATE-297, FLOORSTRIP |
| `nvrless_cameras` | `nvrless_cameras_backend.py` `SW_WEBRTC=1`, then `=0` on the same data | evidence-nvrless-cameras-2412 mode b, then mode a (3) | EVIDENCE-CAMERAS-2412 |
| `nvrless_recorder` | `multi_nvr_backend.py` | evidence-nvrless-cameras-2412 mode d (3) | EVIDENCE-CAMERAS-2412 |
| `media_ma`, `media_sonos` (listed, **not in the gate yet**) | `media_fake_ha.py` `SW_FAKE_HOUSE=ma` / `sonos` | evidence-media-players-live (3), `"gate": false` (see below) | CR-MULTIMEDIA-BASE-2440 |
| `wiskey` (listed, **not in the gate yet**) | `wiskey_fake_ha.py` (control API at `{port+1}`) | evidence-wiskey-people / -editor / -capture (desktop), `"gate": false`: they still drive the pre-CR-036 people screen and fail on the native one (see below) | CR-WISKEY-NOTIF-2443, DIALOG-DRAWER-ONE-2439 |
| `shots_devpolish` | none | devpolish-2331-shoot, `DP_OUT={out}` (desktop) | DEVICES-POLISH-2331 |
| `shots_home_personal`, `shots_home_edit` | none | hand-switch-home-personal / -edit-2500-shots, `SW_SHOTS=1 SW_SHOTS_DIR={out}` (desktop) | HAND-SWITCH-HOME-PERSONAL-2490 / -EDIT-2500 (captures) |

Not in it, and why: `layout-bubble-screens.spec.ts` (MEDIA-POLISH-2331) skips itself while the bubble skin is frozen (owner decision
BUBBLE-FREEZE-295) - no backend or env brings it back; it returns by itself when `FROZEN_SKINS` is emptied. Part 1 of
`evidence-wiskey-people.spec.ts` needs a plain backend WITHOUT any Home Assistant (state `ha_not_configured`); no fixture group is
that, so it stays skipped. The three WisKey specs run in the `wiskey` group (`fixture_job.py`) but are not `"gate": true`: on the
first runner run every first test of their serial groups waited 30 s for `wiskey-people sw-table[data-wiskey-people-table] tbody tr`
- the pre-CR-036 people screen fed by `/intercom/people`; the native screen (CR-036 S7) reads `/api/v1/access-control/people` and
draws `div.tablewrap[data-wiskey-people-table]`. Rewriting them (and the fixture's access-control answers) is a follow-up; flip the
flag when `fixture_job.py evidence-wiskey-people evidence-wiskey-editor evidence-wiskey-capture` passes.

Listed with `"gate": false` after the first runner run (2026-11-25), the reason in the JSON (`_why_not_gate`) - real failures,
each also failing alone; flip the flag when the follow-up lands:
- `evidence-home-screen.spec.ts` (HAND-SWITCH-HOME behaviour): 21 pass, 2 fail - direction b, cards and tiles at 1440x900: the page's
  `main` scrolls 918 / 900 px (the no-scroll rule of the control screens). A product layout defect.
- `evidence-media-players-live.spec.ts`: ma 43 pass / 6 fail, sonos 40 pass / 4 fail - assertions written before the CR-016 server
  existed ("unplaced devices are listed last", the favourites tab text, the group-leave outcome `left` vs `unknown`, a cross-brand
  group's room name).

### Where it runs

- **Every tier-L release gate** (v1 fixture phase, groups one after the other; v2: one pool job per group, slot weight 2 for a group
  with a backend, 1 without). The engine reads the groups from the WORKTREE under test, so the installed `~/release_gate.py` runs
  whatever groups the branch declares; a worktree without the JSON falls back to the devices group and its three original specs.
  Blocking like every category (`fixture`). A diff-selected gate (gate 2 `--select-base`) keeps only the selected fixture specs (and
  their groups), as before.
- **On its own** (`scripts/gate/fixture_lane.sh <branch> [--groups a,b] [--now]`): the same engine with `GATE_LANE=fixture` -
  worktree `~/work/fxlane-<branch>`, node modules + vite build, then only the fixture groups, `GATE_FIXTURE_SLOTS` (2) at a time;
  report `~/smplwise-results/fixture-lane/gate_<branch>_<sha>.{json,md}` (never the gate's `gate_status.json`; without
  `GATE_RESULTS_DIR` the engine itself defaults there in this mode); no backend suite, tsc, static checks, preview / dev / pixel /
  visual and no count-baseline check. It waits for the gate lock to be free and takes `~/.smplwise-tests.lock` SHARED.
- `scripts/fixture_job.py --gate` (the runner's `fixture` job) runs the same set with the same env (no retries; per-process PASS).

### Install

`fixture_lane.sh` next to `~/release_gate.py` (`engine_sync.py install --files fixture_lane.sh --apply`). The engine change itself
is in `release_gate.py`: after the merge the lead re-installs the engine group with `engine_sync.py` (the drift check refuses a gate
whose installed engine differs from the branch's).
