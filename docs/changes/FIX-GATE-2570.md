# FIX-GATE-2570 - release-gate trust fixes (second deep review of 2.57: CD2-01, CD2-03, CD2-09, CD2-10)

Branch `pilot/FIX-GATE-2570`, base `origin/release/2570-train` (= v2.56.0, `6ea807b2e`).
Findings: `docs/review/DEEP-REVIEW-2570-CORE-DATA-RELEASE.md` on `origin/review/DEEP2-2570-CORE-DATA-RELEASE`.
Each finding was re-checked at the base before the fix (the "before" test runs below are that check).

## CD2-01 (high) - a targeted `--after` re-run trusted coverage a red run never had

Before: a crashed / timed-out / zero-test backend shard was ONE item `shard <k>` and a failed Playwright process one item
`<label>: no report | load error | timeout | zero tests | exit code`, with no file of its own. `gate2_select.failed_files` parsed only
test ids, so the `--after` selection re-ran nothing of that shard / process, and `gate_entry.full_run_completed` accepted the red run as
the coverage anchor. A quarantined process-level item made the quarantine re-run select nothing at all (green).

After (fail closed at every step):
- `release_gate.py`: `item(..., files=[...])` - a process-level FAIL now carries the test files its process owned:
  backend shards (`SHARD_FILES`, filled by `backend_start` / `backend_start_v2`), every Playwright process (`PROC_FILES`, filled by
  `run_pw` per label), the fixture-group failures (`fake backend`, `seed`, `preview` -> the group's specs) and crashed pool jobs
  (`job_files`). A crashed `visual` pool job is now a `visual-run` failure (the step did not run: hard, never quarantined) instead of
  a "visual case" named `visual` that a re-run would re-check as nothing.
- `gate2_select.failed_files`: selects those `files` whole; a FAIL of a test category that names neither a test nor files (a report
  of an older engine, `vite preview did not start`, ...) marks its side `full` (`after["full"]`), and `select_gate2` /
  `rerun_only_selection` then run that full side. `failed_files` also counts the test failures (`after["failures"]`).
- `gate2_select.rerun_only_selection`: a re-run that would select no backend file, no spec and no visual case although the report has
  test failures raises `NothingToRerun`; the shim's exception path makes the engine run the full tier (CD2-01 (c)).
- `gate_entry.full_run_completed(doc, is_after)`: a run with a process-level failure is a coverage anchor only when it IS the
  `--after` report (same branch, sha, finish time) AND every such item names its files; otherwise it is rejected with the reason
  ("process-level failure ... its tests ran in no run" / "names no files"), and the rejected run is listed in the anchor record.

## CD2-03 (medium) - all-skipped processes and a broken fixture config were green

- `release_gate.settle`: a Playwright process whose rows are ALL `skipped` (self-skips, not "did not run") is
  `FAIL <label>: all skipped` ("zero tests ran") in the categories of `ALL_SKIPPED_FAIL_CATS` - `fixture` and `pixel` by default
  (`GATE_ALL_SKIPPED_FAIL_CATS` overrides). `preview` / `dev` are the explicit allow list: the runner's real gates of 2.51-2.56
  (scanned read-only, 25 newest log dirs) have green runs with whole preview / dev processes of environment-gated evidence specs that
  skip themselves (`pw_dev_desktop-mobile_w1` 32 skipped, `pw_preview_desktop-mobile` 24, ...); no fixture or pixel process was ever
  all-skipped (400 log dirs). There they are listed as `SKIPPED_ALL` items (visible in the report, not a failure). The backend already
  failed a shard with zero tests run (`ran == 0`).
- `release_gate.fixture_groups`: a `fixture_specs.json` that EXISTS but does not parse is recorded (`FIXTURE_JSON_ERRORS`); the gate
  adds `FAIL fixture_specs.json: unreadable` (it still runs the built-in devices group) and the fixture lane fails and stops (it never
  runs the fallback as if it were the branch's groups). A missing file is still the documented fallback (no failure).
- The fixture lane with `--groups` matching no group was already a FAIL ("no fixture group"); the header of `fixture_lane.sh` now
  says all of this.

## CD2-09 (low) - the coverage lane started recording too late

`coverage_lane.py` now starts the recorder when `-p coverage_lane` imports the plugin (pytest does that before the initial
`conftest.py`, which imports the whole app), only under the plugin's own module name; `pytest_configure` stays as an idempotent
fallback. Module-level lines of the modules conftest imports now count.

## CD2-10 (low) - `fixture_job.py --gate` passed with nothing run

`fixture_job.py`: no spec selected at all (e.g. `--gate` on a JSON that lost its `"gate": true` flags) prints
`FIXTURE: nothing to run` / `FIXTURE_FAIL nothing ran` and exits 1, before any build.

## SA2-05 a (lead's addition; `docs/review/DEEP-REVIEW-2570-SECURITY-ADMIN.md` on `origin/review/DEEP2-2570-SECURITY-ADMIN`)

The six SFTP off-box backup tests (`tests/test_offbox_sftp.py`, `pytest.importorskip("paramiko")`) were skipped green on the runner
because `paramiko`, a pinned product requirement, was missing from the test interpreter (the lead has since installed it).

- `release_gate.product_requirements_check` (before the backend shards start, every tier M / L run that runs the backend): the
  test interpreter (`PY`) reads the branch's `smplwise_vms/backend/requirements.txt` (environment markers applied with
  `packaging.markers`), and every requirement must be installed (`importlib.metadata`) and each of its top-level modules must
  import. A missing or unimportable one is a FAIL of the new hard category `requirements` (not a test category: never
  quarantined; the summary asks for a fix and a new gate).
- Lead 28.11 (Q2 a): every INSTALLED package with an `==` pin in `constraints.txt` (or in `requirements.txt`) must have exactly that
  version - otherwise `FAIL <name>: version differs from the pin` (category `requirements`, hard). A constrained package that is not
  installed (a transitive pin the test environment does not need) is listed (`constraint_not_installed`), not failed.
  **This needs the pinned install on the runner first:** `~/smplwisebms/.venv/bin/pip install -r smplwise_vms/backend/requirements.txt
  -c smplwise_vms/backend/constraints.txt` - without it the 2.57 gate is red at once (the lead counted 15 differing packages on 28.11,
  among them pillow 12.3.0 vs 13.0.0 and uvloop 0.23.0 vs 0.22.1; the check's own count is in the test table below).
- The backend shards now run with `-rfEs` (the skip reasons are printed); `requirement_skips` reads the
  `SKIPPED [n] tests/test_x.py:L: could not import 'mod'` lines and a skip whose module is a product requirement (its import names
  from the check, or the usual rename table for an uninstalled one) is `FAIL tests/test_x.py: skipped - product requirement ...`
  with `files` = that test file (the `--after` re-run re-selects it). An optional tool's `importorskip` stays a skip.
- `gate_entry.full_run_completed`: a run with a `requirements` failure is not a coverage anchor (its tests did not run).
- Lead 28.11 (Q3 a): `tests/test_offbox_sftp.py` imports `paramiko` plainly (no `importorskip`): without it the file FAILS.

## Nightly: report-only arm64 Dockerfile check (lead 28.11; deep review CD2-08)

`scripts/gate/nightly_tests.sh` (based on the train's newest version, FIX-CORE-DATA-2570's coverage lane kept; the train was merged into
this branch first): on main, after the coverage lane, `arm64_check_line` writes ONE line into the nightly summary, never the verdict:
1. `docker buildx build --check --platform linux/arm64 -f Dockerfile .` in `smplwise_vms/` with NO `--build-arg` (nothing is built);
2. the Dockerfile's default base image (the first `FROM` with the `ARG` defaults filled in) must list `linux/arm64` in its registry
   manifest (`docker buildx imagetools inspect`, nothing pulled).
Step 2 is needed because step 1 alone does NOT catch CD2-08: on the runner (28.11) `--check --platform linux/arm64` on the v2.56.0
Dockerfile (default `amd64-base-python`) says "Check complete, no warnings found." (rc 0), while `imagetools inspect` shows that image
has only `linux/amd64`; FIX-CORE2-2570's multi-arch `base-python` lists `linux/amd64` and `linux/arm64`. Line states: OK, WARNINGS,
FAIL (no arm64 in the base, base not inspectable, no FROM), TIMEOUT, NOT_RUN (switched off, no Dockerfile, no buildx, too little
time). Bounded: `SW_NIGHTLY_ARM64_CHECK_SECS` (300) or what is left before the end mark, the inspect 120 s;
`SW_NIGHTLY_ARM64_CHECK=off` switches it off; `--dry-run` names it; `nightly_tests.sh --arm64-check=<checkout>` runs only the check
(selftest / by hand). The full output is in `arm64_check.log` of the night's log dir.

`scripts/release_check.py` is NOT touched by this row (FIX-CORE2-2570's base-image rule there is unaffected).

## Lead 28.11 (Q1 a): a red full run anchors only as the `--after` report

`gate_entry.anchor_check`: a RED full run is the coverage anchor only when it IS the `--after` report (same branch, sha, finish
time) - only then are its failures exactly what the targeted run re-selects. Before, any red full run of the same branch qualified and
its failures were re-run only if they also failed in the `--after` report. The rejected run is listed with the reason ("a red full run
that is not the --after report"). `selftest_gate_trust.py`: the TR-09 "red full run of the same branch" case now passes the red report
itself as `--after`; a new case pins that the same red run is no anchor for another `--after` report; the CLI case uses the red report.

## Not changed

- `scripts/gate/gate_backcompare.py` (analysis tool) keeps its own re-implementation of `failed_files` without `files`: it only
  compares past reports, never selects tests.

## Installed engine files that change (for the lead's `engine_sync.py install` before the 2.57 gate)

| repo file | installed as | change |
|---|---|---|
| `scripts/gate/release_gate.py` | `~/release_gate.py`, `~/gate2/release_gate.py`, `~/nightly-gate/release_gate.py` | engine (CD2-01 files on items, CD2-03, SA2-05 a requirements + constraints pins) |
| `scripts/gate/gate2_select.py` | `~/gate2/gate2_select.py` | `failed_files` / `select_gate2` / `rerun_only_selection` (CD2-01) |
| `scripts/gate/gate_entry.py` | `~/gate2/gate_entry.py` | the coverage anchor (CD2-01, Q1 a, SA2-05 a) |
| `scripts/gate/selftest_gate_trust.py` | `~/gate2/selftest_gate_trust.py` | CD2-01, SA2-05 a and Q1 a cases |
| `scripts/gate/nightly_tests.sh` | `~/nightly_tests.sh` | the arm64 Dockerfile check (on top of FIX-CORE-DATA-2570's version) |
| `scripts/gate/fixture_lane.sh` | `~/fixture_lane.sh` | header comment only (optional) |

Not installed (run from the checkout): `scripts/gate/coverage_lane.py`, `scripts/fixture_job.py`. Unchanged: `gate2_verdict.py`,
`gate2/select_tests.py`, `release_gate2.sh`, `gate_budget.py`, the other selftests.

```
python3 <checkout>/scripts/gate/engine_sync.py install --src <checkout> --files release_gate.py,gate2_select.py,gate_entry.py,selftest_gate_trust.py,nightly_tests.sh,fixture_lane.sh
python3 <checkout>/scripts/gate/engine_sync.py install --src <checkout> --files release_gate.py,gate2_select.py,gate_entry.py,selftest_gate_trust.py,nightly_tests.sh,fixture_lane.sh --apply --suffix .bak_2570
```

Install `release_gate.py` and `gate2_select.py` together. Mixed versions stay safe: a new selector reading a report of the old engine
(no `files`) takes the full side of a process-level failure; the old selector ignores `files` (the old behaviour).

## Tests

Runner, slot B (`~/work/slotb.sh`), worktrees `~/work/p2570_fixgate` (this branch) and `~/work/p2570_fixgate_before` (the base with
only the new tests copied in). New: `smplwise_vms/backend/tests/test_gate_trust_2570.py` (fake data only) and four cases in `scripts/gate/selftest_gate_trust.py`.

Every test / selftest command below was run on the runner through slot B (28.11); results as printed.

| Run | Tree | Result |
|---|---|---|
| `tests/test_gate_trust_2570.py` (18 tests at that point: CD2-01, CD2-03, CD2-09, CD2-10, SA2-05 a) | BEFORE: base `6ea807b2e` + the new test file | **18 failed** (each finding reproduced) |
| `selftest_gate_trust.py` (branch copy, run against the base's `gate_entry.py`) | BEFORE | **3 BROKEN**: the two CD2-01 anchor cases and the SA2-05 a case (the "is the --after report with files" case passes before too, as expected) |
| `tests/test_gate_trust_2570.py` (18) | AFTER `7d93e1816` | 18 passed |
| `tests/test_gate_trust_2570.py` (20, + the two nightly arm64 cases) | AFTER `b8dc4ebdd` | 20 passed |
| `test_gate2_select`, `test_gate_speed`, `test_select_tests` | AFTER `7d93e1816` | 1 failed (`test_backend_command_v1_unchanged_v2_adds_junit_and_retention` pinned `-rfE`; updated to `-rfEs`), 55 passed |
| same group | AFTER `b8dc4ebdd` | 56 passed |
| `test_gate_hygiene`, `test_gate_always_run`, `test_gate_addon_build`, `test_gate_tablet_allowlist`, `test_gate_visual_block_t074` | AFTER `7d93e1816` | 218 passed |
| `test_fixture_job`, `test_coverage_lane_2550`, `test_release_check`, `test_release_check_green_2560`, `test_nightly_lightening_2560`, `test_nightly_local_hour_2550`, `test_wire_route_coverage_2460` | AFTER `7d93e1816` | 51 passed |
| `test_fixture_job`, `test_coverage_lane_2550`, `test_nightly_lightening_2560`, `test_nightly_local_hour_2550`, `test_offbox_sftp` | AFTER `b8dc4ebdd` (train merged) | 35 passed (the SFTP file now RUNS: paramiko installed by the lead) |
| selftests `selftest_gate`, `selftest_gate_trust`, `selftest_gate_speed_2550`, `selftest_engine_sync`, `selftest_entry_check`, `selftest_fe_static`, `selftest_gate_fast` | AFTER `7d93e1816` | all 7 PASSED |
| selftests `selftest_gate`, `selftest_gate_trust`, `selftest_gate_speed_2550` | AFTER `b8dc4ebdd` | all 3 PASSED |
| the real `nightly_tests.sh --arm64-check=` on this tree (v2.56.0 Dockerfile) | runner, real docker | `FAIL - the default base image ghcr.io/home-assistant/amd64-base-python:3.12-alpine3.22 has no linux/arm64 (platforms: linux/amd64 unknown/unknown) ...; build checks OK` |
| `docker buildx build --check --platform linux/arm64` alone | v2.56.0 Dockerfile / FIX-CORE2-2570 Dockerfile | both rc 0 "Check complete, no warnings found." (why step 2 exists) |
| the real `product_requirements_check` on this tree | runner venv, `b8dc4ebdd` (requirements.txt pins only) | ok, 17 checked, none missing / broken; version differs: uvloop 0.23.0 (pin 0.22.1), pillow 12.3.0 (pin 13.0.0) |
| **Run 3 (lead Q1 a / Q2 a / Q3 a)** | | |
| the three new tests (red anchor only as `--after`, constraints pin, plain paramiko import) | BEFORE: `c91b44e19` + the new test file | **3 failed** |
| `selftest_gate_trust.py` (new copy) | BEFORE: `c91b44e19` | **1 BROKEN**: "a RED full run of the same branch is NOT the anchor of ANOTHER --after report" |
| `tests/test_gate_trust_2570.py` | AFTER `ced224772` | 23 passed |
| `test_offbox_sftp`, `test_gate2_select`, `test_gate_speed`, `test_select_tests` | AFTER `ced224772` | 62 passed (the SFTP tests run and pass with the plain import) |
| hygiene / always_run / addon_build / tablet / visual group | AFTER `ced224772` | 218 passed |
| fixture_job / coverage_lane / release_check / nightly / wire_route group | AFTER `ced224772` | 1 failed (`test_release_check.py::test_repository_is_release_consistent`), 50 passed - the same test fails identically on `origin/release/2570-train` @ `1c526b71b` itself (train state, not this row) |
| all 7 gate selftests | AFTER `ced224772` | all PASSED |
| the real `product_requirements_check` with constraints.txt | runner venv, before the lead's pinned install | **FAIL**: 17 requirements + 49 constraint pins checked, none missing, **15 versions differ** (anyio, brotli, certifi, click, ezdxf, fonttools, numpy, pillow 12.3.0 vs 13.0.0, pycparser, pydyf, starlette, typing-inspection, tzdata, uharfbuzz, uvloop 0.23.0 vs 0.22.1) - the expected red until the pinned install |

NOT_RUN: the nightly arm64 test against the BASE script (the base has no `--arm64-check` option: it would take it as a branch name
and start a real nightly); a real gate, fixture lane or nightly (never run by a fix row); Playwright; anything on the lab.
Read-only scans on the runner (no test): all-skipped Playwright processes in the newest 25 / 400 gate log dirs (CD2-03 allow list).
