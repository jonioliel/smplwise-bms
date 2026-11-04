# GATE-HYGIENE-2402 - scanners always run, a Windows-only demo check, and a test-state leak

Branch `chore/GATE-HYGIENE-2402`, cut from `origin/release/2401-train` at `604305354` (the 2.40.1 version commit). Target: **Arx 2.40.2**
(2.40.1 was in its release gate while this was written). No version bump, no tag, no merge here. Test-and-tooling only: no product module
changed.

## 1. Selection miss: whole-package scanners and pins now run in every selection

### Cause

`tests/test_fake_doorwin_closed_rule_sr1.py` (SR-1) parses every module under `smplwise/` by PATH (AST). It imports no product module and
its name matches no module stem, so none of the selector's mappings (import closure, name stem, API path segment, changed script) reaches
it from a far change. The gate-2 "repository scanner" rule (`gate2_select.REPO_SCAN_BE_RE`) only matches `git ls-files`. Result: the
2.39.0 gates never ran SR-1, WISKEY-DOOR-TECH-2390 added program-write sites without re-pinning, and main v2.39.0 shipped red on it
(fixed by `613f4b0ef`).

Reproduced with the real selector, read-only (no test run), on the merge of `pilot/WISKEY-DOOR-TECH-2390` into the 2.39.0 train
(`3a92fe01c...e3789536b`, `scripts/gate/gate2_select.py select`, checkout = this branch's tree):

| | backend selected | SR-1 selected |
|---|---|---|
| before (no list) | 523 of 885 | **no** |
| after (this branch) | 533 of 886 | **yes** - `always-run (gate_always_run.json): SR-1 AST pin ...` |

The 10 files added there: `test_capabilities`, `test_fake_doorwin_closed_rule_sr1`, `test_gate_always_run`, `test_plan_routes_unique`,
`test_t06_work_states_297`, `test_tickets_rfq`, `test_tickets_table`, `test_tickets_visibility`, `test_wiskey_m12_s3_maintenance`,
`test_zones_nvr` (recorded cost of the six with a seed value: 673 worker-seconds).

### Where the selection lives (repo vs runner)

- The engine `release_gate.py` imports `select_tests` from its own directory. `~/release_gate.py` and `~/gate2/release_gate.py` are
  byte-identical to `scripts/gate/release_gate.py` (md5 `8eb765c7...`, read 2026-11-04 over ssh, read-only).
- `~/gate2/select_tests.py` is the gate-2 shim, identical to `scripts/gate/gate2/select_tests.py`. It calls `gate2_select.select_gate2`,
  which calls `select_tests_v1.select()`; `release_gate2.sh` copies `~/select_tests.py` to `~/gate2/select_tests_v1.py` at every real run.
- `~/select_tests.py` (= `select_tests_v1.py`) is identical to `scripts/gate/select_tests.py` before this change (md5 `91e0e78a...`).
- `~/gate2/gate2_select.py` differs from the repository only in `nightly_health` (the runner copy predates NIGHTLYRED-295, `e20fd4b7e`).
  Not touched here; noted for the lead.
- The entry check (`branch_check.sh`) and the fast gate (`gate_release.sh` -> `release_gate2.sh`) both reach the same `select()`.

So the in-repository source of truth is `scripts/gate/select_tests.py`, and gate 2 inherits the change through `select()`; no gate-2 file
changes.

### Change

- `smplwise_vms/backend/tests/gate_always_run.json` (new): the declarative list, 40 backend files with the scanner test and what it pins,
  plus `not_scanners` (2 reviewed false positives of the detector). It is read **from the checkout under test**, so a branch that adds a
  scanner adds its list entry in the same commit and the runner needs no reinstall for list changes.
- `scripts/gate/select_tests.py`: `ALWAYS_RUN_FILE`, `PACKAGE_SCAN_RE` (the detector: `rglob("*.py")`, `routers/*.py`, `_routers()`,
  `pkgutil.iter_modules`, `app.routes` / `app.router.routes`, `ls-files`), `always_run_backend(root)`, `package_scanners(tests_dir)`, and
  in `select()` every listed file is added with the reason `always-run (gate_always_run.json): <why>`. A missing list (older branch) is
  empty; a malformed one raises, so the engine falls back to the full tier and says so in its report (`compute_selection`'s error path).
- `smplwise_vms/backend/tests/test_gate_always_run.py` (new, itself on the list): the list parses and every entry exists; the named
  examples (SR-1, `test_no_ip_literals`, the signing-caller pin `test_wiskey_door_path`, the channel allow-list pin `test_wiskey_channels`,
  `test_remote_access`, `test_plan_routes_unique`) are listed; **every backend test the detector matches is listed or reviewed** (a new
  scanner without an entry fails in every gate); the detector itself; both selectors (v1 `select_diff` and gate 2 `select_gate2`) drop a
  path scanner without the list and select it with the list on a tiny real git repository; a malformed list raises; a missing list is empty.

How the set was found: every `tests/test_*.py` matching the detector (42 files with the new guard), each scanner function read; all walk the whole
`smplwise/` package (or `services/` + `routers/`), the router registry, or the repository. `test_gate2_select.py` (names `ls-files` in a
string) and `test_remote_hardening.py` (reorders its own test app's routes) walk nothing and are in `not_scanners`.

### Tiers and modes

- Every real gate is tier L (`release_gate2.sh`, `branch_check.sh`, the nightly, the timing lane). FULL tier runs everything anyway;
  SELECT (fast gate), the entry check and `--after` re-runs go through `select()` and now always carry the list.
- Tier S runs no backend at all (engine: `TIER in ("M", "L")`); it is a manual frontend-only tier, not used for releases. Unchanged.
- The automatic quarantine re-run (`GATE2_RERUN_ONLY=1`, `rerun_only_selection`) re-runs only the failed files of the same sha, whose
  first pass already ran the list. Unchanged.

### Cost

Recorded seed costs (`gate2_costs.json`) exist for 24 of the 40 files: 1638 worker-seconds in total if NONE of them was selected by the
mapping (about 4.5 min wall on the v2 schedule's 6 balanced shards; in the 2.39.0 example the real addition was 673 s). Five files carry
most of it because the engine is file-granular: `test_tickets_rfq` 374 s, `test_remote_access` 255 s, `test_tickets_table` 216 s,
`test_self_update_s3` 129 s, `test_tickets_monitor` 103 s. Follow-up (not done): move those five scanner functions into a light file, or
teach the engine node ids.

### Runner install (the lead, quiet window only)

Not installed: the 2.40.1 gate was running while this was built (`~/smplwise-results/gate_status.json`: `release/2401-train` @ `d6e20460f`,
state `running`, read 2026-11-04 20:16 UTC; at 21:13 UTC it showed `0e8c3109b` pass / done). Nothing on the runner was written; the
install is the lead's step.

```
# after gate_status.json shows a finished state
ssh runner 'cp -p ~/select_tests.py ~/select_tests.py.bak-gatehyg2402'
scp scripts/gate/select_tests.py runner:~/select_tests.py        # release_gate2.sh copies it to ~/gate2/select_tests_v1.py at each run
ssh runner 'md5sum ~/select_tests.py'                             # must equal the repository file at this branch
```

No other runner file changes. Until the copy, the runner keeps selecting as before; the list file in a branch is harmless to the old selector.

## 2. Windows-only failure: `test_readiness_96.py::test_a_demo_runs_on_a_separate_database_and_leaves_the_real_one_untouched`

### Cause (measured)

A probe (a temporary test, deleted) on Windows after `POST /demo/stop`: the `demo` directory still held `demo.sqlite`; a plain
`shutil.rmtree` right after the request had ended **succeeded**. So no handle leaks: the only holder is the stop request's OWN connection.
It was opened on the demo file (the request started while the demo ran), `demo_mode.stop()` releases it (commit) but cannot close it,
and FastAPI closes the request's `get_conn` dependency only after the response (and after background tasks: they run inside the same
exit stack in FastAPI 0.141 / Starlette 1.6). `demo_mode._leave()`'s `rmtree(ignore_errors=True)` runs before that and is already
documented as best effort ("an open reader may hold the file on some systems; the next boot clears it"). Linux (the add-on platform and the
runner) unlinks open files, so the directory is gone there at once.

### Change (test only)

`_assert_demo_dir_removed(settings)`: on POSIX the directory must be gone (unchanged). On Windows a leftover may contain only
`demo.sqlite*`, and a strict `shutil.rmtree` (no `ignore_errors`) must succeed - a handle leaked past the request raises PermissionError,
so the check still catches a real leak. No product change: a janitor-tick removal was considered and rejected (it races a demo start that
is building the directory while `db.demo` is still false).

## 3. Leak between test files: `bridge_install.STATE`

`smplwise/services/bridge_install.STATE` is a process-wide dict (source / installed version, mapped HA config dir, last error). Any test
that runs an install with a mapped config dir leaves it set (`test_bridge_install.py` and 12 other files that set `SW_HA_CONFIG_DIR` or
call the install). A later `test_self_update*` test without the app's start-up then sees a bridge copy "waiting for a restart":
`platform_restart.reasons()` adds a `bridge` reason and 4 tests fail (`test_state_before_any_check`, `test_platform_restart_reasons`,
`test_state_carries_the_reasons_to_admins_only`, `test_platform_restart_end_to_end`).

Fix: an autouse fixture in `tests/conftest.py`, `_bridge_install_state_is_per_test`, restores the dict IN PLACE (modules hold a reference
to it) to its import-time content before and after every test - the pattern already used for `ha_sync.STATE`. Note: `conftest.py` is a
full-backend-tier trigger of the selector, so the 2.40.2 gate runs the full backend tier for this branch.

## 4. Tests (workstation, Windows 11, Python 3.12 venv)

All run from `smplwise_vms/backend` with `-q -p no:cacheprovider -o addopts=`; the machine also carried other agents' pytest runs.

| command | result |
|---|---|
| `pytest tests/test_gate_always_run.py tests/test_select_tests.py tests/test_gate2_select.py` | exit 0 (56 tests, all passed) |
| `pytest tests/test_readiness_96.py tests/test_gate_always_run.py` (final versions) | **40 passed** (21 + 19) |
| probe (temporary test, deleted): stop a demo, then a strict `rmtree` of `data/demo` | before: `['demo.sqlite']` left; strict rmtree after the request: ok |
| BEFORE the fix: `pytest tests/test_bridge_install.py tests/test_self_update.py tests/test_self_update_s3.py` | **4 failed, 67 passed** (the 4 tests named in section 3) |
| BEFORE the fix: `pytest tests/test_self_update.py tests/test_self_update_s3.py tests/test_bridge_install.py` | 71 passed |
| AFTER the fix: `pytest tests/test_bridge_install.py tests/test_self_update.py tests/test_self_update_s3.py` | **71 passed** |
| AFTER the fix: `pytest tests/test_self_update.py tests/test_self_update_s3.py tests/test_bridge_install.py` | **71 passed** |
| AFTER the fix, other `bridge_install` users in one process: `test_bridge_stale_discovery_2383`, `test_wiskey_adopt_2272_review`, `test_wiskey_adopt_2272_installer`, `test_wiskey_pairing_2382`, `test_setup_wizard`, `test_bridge_keyrot_harness_295`, `test_lovelace_card`, `test_installation_capabilities` | 229 passed, 6 skipped, 1 failed: `test_setup_wizard.py::test_a_slow_device_is_cut_off_at_the_check_deadline` (a wall-clock `< 5 s` assertion; 3 pytest processes on the box) |
| that test alone, same tree | 1 passed |
| `scripts/gate/gate2_select.py select --base 3a92fe01c --head e3789536b` before / after | SR-1 dropped / selected (section 1) |
| `python scripts/release_check.py --root .` | `RESULT: ready for the owner's approval`, no `[FAIL]` (the v2.40.1 tag exists since the 2.40.1 gate passed; an earlier run before the tag showed only that one) |

The before/after runs used the same tree with only `tests/conftest.py` swapped (HEAD's copy vs this branch's).

## 5. NOT_RUN

- The release gate, the entry check and the full backend suite: not run (2.40.1 gate running on the runner; no runner job was started).
- The runner install of `select_tests.py` (section 1): left to the lead for a quiet window.
- The runner self-tests (`selftest_gate*.py`) against the new selector: not run.
- Frontend specs: none touched; none run.
