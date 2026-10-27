# Gate lanes (GATELANES-297)

Owner approval 2026-10-27 of the three proposals in `docs/testing/GATE_AUDIT_2026-10-27.md` (P1 fewer pixel skins, P2 archive the
September owner-round specs, P3 a separate lane for the timing tests). This page is the reference for what runs where.

## 1. The lanes

| Lane | What | When | Blocks a release? |
|---|---|---|---|
| Release gate (`release_gate.sh`, tier L) | everything under `frontend/tests/*.spec.ts` (top level) and `smplwise_vms/backend/tests/test_*.py`, EXCEPT the timing lane | on demand, one per release candidate | yes |
| Nightly (`nightly_tests.sh`) | the same engine and the same exclusions, on `main` | 02:00 | no (it is the safety net; reds become fixes) |
| **Timing lane** (`timing_lane.sh`) | ONLY the tests tagged `@timing-lane` (Playwright) / marked `timing_lane` (pytest) | after every gate, in the background, once the runner is quiet | **no** |
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
| `evidence-nvr-cameras-batch.spec.ts` describe "hundreds of cameras" (300 cameras) | scale / timing under load; FLAKY 10 / 40 | the ONE-confirmation, progress, stop, undo, unknown-outcome and permission tests of the batch (same file) |
| `unit-plan-3d-realistic.spec.ts` "the level-3 graph is deterministic ..." | two full rebuilds on SwiftShader; FLAKY 6 / 40 | the other level-3 tests |
| `unit-plan-3d-view.spec.ts` "frames render on demand ..." | counts frames over wall-clock windows; FLAKY 6 / 40 | the other 3D view tests |
| `evidence-uxfix-rtl.spec.ts` "a russian / english title keeps its beginning" | wrapping measured while the web fonts load; FLAKY 4 / 40 | the Hebrew-date title and the sites / buildings cases |

Kept blocking on purpose although they flake: `test_installation_capabilities.py::test_route_sweep[*]` (permission sweep, security),
`test_tickets_public_server.py::test_one_upload_in_flight_per_link_at_the_socket` (public-surface abuse guard),
`test_f3a_doorwin_dw03_295.py::test_four_hung_doors_do_not_hold_back_the_other_four` (emergency door release reaches the other doors).
A FLAKY result never blocks a gate anyway (each failure is retried alone).

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
