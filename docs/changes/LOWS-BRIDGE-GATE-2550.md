# LOWS-BRIDGE-GATE-2550 - deep review 2.52: the open low findings of the bridge (WB-) and the gate tooling (TR-), plus TR-08

Row of the 2.55 train (owner-approved roadmap 2.53-2.55). Base: `origin/release/2540-train` @ `f9217db8a`. Branch
`pilot/LOWS-BRIDGE-GATE-2550`. Finding sources: `docs/review/DEEP-REVIEW-2520-INDEX.md` and the area reviews on
`origin/review/DEEP-2520-WISKEY-BRIDGE` / `origin/review/DEEP-2520-TESTS-RELEASE`.

Every finding below was re-read at the base and confirmed still open before it was touched. Each fix has a test that FAILED on the
base code and passes with the fix (the "before" runs swapped the base version of the fixed file back in; results below).

## Table

| id | severity | status | what |
|---|---|---|---|
| WB-04 | low | **question** | key-store write per second of v2 traffic: the fix changes what WisKey sees (refusals for N s after every entry reload) - Q1 |
| WB-05 | low | **fixed** | `GET /system/bridge-key/service-grant` answers a fresh observation instead of a new signed WisKey read per call |
| WB-06 | low | **fixed (bridge 0.10.10)** | `Persister.control`: lock over the whole step; a rollback leaves the set dirty |
| TR-08 | medium | **partial + questions** | `run.sh` now executed (sandbox test + in-image step); report-only coverage lane (stdlib); gate selftests + live-only list in that lane. Real Home Assistant run and aarch64: Q2, Q3; schedule the lane: Q4 |
| TR-10 | low | **fixed** | Playwright reuses a running server only when told to; `@unit-page-spec` marker (unit-mfa-passkeys-2490) |
| TR-12 | low (PLAUSIBLE) | **fixed (part a)** | the two leftover swap folders are removed on every install run; staging outside `custom_components` not done - Q5 |
| TR-13 | low (PLAUSIBLE) | **fixed** | both mirror checks compare file bytes |
| TR-14 | low | **fixed in the repo, install pending** | `nightly_tests.sh --local-hour=02`; new cron line - install steps below |

Already fixed earlier (not in this row): WB-01, WB-02, WB-03, WB-07, TR-01, TR-02, TR-06, TR-11 (see the index). TR-03 / TR-04 /
TR-05 / TR-07 / TR-09 are medium or high and belong to other rows (GATE-TRUST-2540 took TR-05 / TR-07 / TR-09).

## What changed

### WB-06 - `keyset.Persister.control` rollback details (bridge 0.10.10)

`custom_components/smplwise_bridge/keyset.py` (mirror regenerated with `scripts/sync_integration.py`):

- (a) after a failed save `control` reloads the snapshot and now sets `dirty = True`. The snapshot can hold high-water marks whose 2 s
  delayed save was pending; `reload` re-ran `__init__`, which marked them clean, so they were not saved until the next message raised
  the mark again (a short cross-restart replay gap for the bridge's own services).
- (b) `control` holds the saver's asyncio lock for snapshot + `handle_control` + save (the save body moved to `_persist_held`;
  `persist()` takes the lock and calls it). A second `control` that ran its op while the first one's save was in flight used to answer
  "ok" for a change the first one's rollback reverted.
- No answer, refusal code or signature byte changes. `test_capmap_295.py`: reviewed successor `05d6458f..` -> `78a444e6..` for
  keyset.py (KeySet / sign / verify / `_check` / `handle_control` byte-identical).
- Version 0.10.10: `manifest.json`, `const.py` (history entry), `www/smplwise-card.js`, mirror, 19 test files' version pins.
  `wiskey_media_v2.BRIDGE_REQUIRED` stays `0.10.9` (a minimum; 0.10.10 satisfies it). The frontend demo / mock values `0.10.9`
  (`system-diagnostics.ts` DEMO_VERSIONS, onboarding mocks) were left alone: they are demo data, not the shipped version, and changing
  them moves pixel baselines.
- **Restart**: 2.52 was installed in the lab without a Home Assistant restart, so the lab's active bridge stayed 0.10.8 and the
  0.10.9 load is still pending (not re-checked in the lab by this row). If that one owner-approved restart has not happened when
  0.10.10 ships, 0.10.10 rides on it and costs no extra restart; if it has, 0.10.10 needs one more.

### WB-05 - the service-grant GET is no longer an unthrottled signed read

`services/wiskey_service_grants_v3.py`: new `ManualGrantSource.observe()`; `routers/bridge_key.py` `get_service_grant` uses it instead
of `refresh()`. A fresh (`FRESHNESS_S` = 60 s, the window `current_grant()` already uses for writes) observation of the current
connection that really sent the read is answered as it is; a stale one, one of another connection, or one that sent nothing (a
precondition such as "direct not connected" - those cost no read) is read again. A caller that waited for the lock takes the observation
the call ahead of it made. The forced-refresh query parameter the review mentioned was not added: the screen reads once per visit and
has no refresh button (API stays as it was, ADR-015).

### TR-10 - Playwright server reuse and the page-spec detector

- `frontend/playwright.config.ts`: `reuseExistingServer: reuseServer(process.env)` (new `frontend/tests/helpers/server-reuse.ts`):
  reuse only with `SW_BASE_URL` (the gate passes its own port) or `SW_REUSE_SERVER=1`. A bare run on the default 4173 with something
  already on the port now stops ("port already used") instead of testing another checkout's build.
- `frontend/playwright.unit.config.ts`: `PAGE_SPEC` also matches the header marker `@unit-page-spec`; `unit-mfa-passkeys-2490.spec.ts`
  carries it (it builds its origin at run time and failed in the node-only run with ERR_CONNECTION_REFUSED).
- The other seven "candidates" of the review were re-read: `unit-arx-local-login`, `unit-arx-pending-tokens`, `unit-brand-login`,
  `unit-local-user-create-2438`, `unit-service-identity` navigate to their own fake origin `http://arx.test` with routed answers - they
  need no server and are node-only by design (`unit-unit-config-pages-2440` asserts exactly that); `unit-walk-ui`'s `.goto(` is a HUD
  method, not a navigation; `unit-unit-config-pages-2440` only builds sample strings. No change for them.
- Agents who start a preview on 4173 by hand and run without `SW_BASE_URL` must now pass `SW_BASE_URL=http://127.0.0.1:4173/` (or
  `SW_REUSE_SERVER=1`).

### TR-12 - leftover swap folders in `custom_components`

`services/bridge_install.py`: `_sweep_leftovers(target)` runs at the start of every install run (normal path, before the "is a copy
needed" decision) and removes exactly `smplwise_bridge.smplwise-new` and `smplwise_bridge.smplwise-old` when they are real directories
(never a link, never another name). A failed removal is logged and retried next run. Part (b) of the suggestion - staging the new tree
outside `custom_components` - was not done (Q5).

### TR-13 - mirror checks by bytes

`scripts/sync_integration.py` (`differences()`, used by `--check` and `test_bridge_install.py`) and `scripts/release_check.py`
(`dir_identical`) compare every common file by its bytes; `filecmp.dircmp().diff_files` is shallow (size + mtime).

### TR-14 - the nightly at 02:00 local

`scripts/gate/nightly_tests.sh`: option `--local-hour=HH`; the run continues only when it is HH:xx in Asia/Jerusalem and otherwise
exits 0 at once (before the lock, nothing written). The cron line fires at both UTC hours that can be 02:00 local and the wrong one
does nothing, so daylight saving needs no crontab edit. `SW_NIGHTLY_NOW=<epoch>` replaces "now" for the test. The inner run never
checks. `scripts/gate/INSTALL_ON_RUNNER.md`: the new cron line and why.

### TR-08 - coverage gaps (the part that needs no new infrastructure)

1. **run.sh is executed** - `smplwise_vms/backend/tests/test_run_sh_sandbox_2550.py`: the real `run.sh` text runs in bash after a fake
   bashio (the same shell options the image's `/usr/bin/bashio` sets: errexit, errtrace, nounset, pipefail, inherit_errexit; only the five
   functions run.sh calls, all present in the real library; any other `bashio::*` is recorded as missing), a fake `python3` on PATH and
   `/app` redirected. Checks: LF line ends, the shebang, the Dockerfile's COPY / chmod / CMD, the start command
   (`python3 -m smplwise.crashguard` in /app), the exported `SW_LOG_LEVEL` / `SW_FRIGATE` / `PYTHONFAULTHANDLER` for given and default
   options, the bootstrap warning, and that a bashio typo is caught.
2. **run.sh inside the image** - `scripts/gate/addon_build_check.sh` steps `run_sh_in_image` (executable, the with-contenv bashio
   shebang, no CR, both interpreters present, `bash -n`, every `bashio::` function run.sh calls defined by the IMAGE's
   `/usr/lib/bashio/bashio.sh`) and `run_sh_is_cmd` (the image's CMD is `/run.sh`). The real s6 start with a Supervisor is still not
   run (bashio's `config` reads the Supervisor API) - that part stays a question (Q2).
3. **Coverage measurement, report only** - `scripts/gate/coverage_lane.py` (a pytest plugin on Python 3.12 `sys.monitoring`, stdlib
   only, nothing to install; and a `report` command that never fails) and `scripts/gate/coverage_lane.sh` (backend tests in N shards,
   default 2, one merged Markdown report: total, the 40 least-covered modules, the modules no test imports; exit 0 always). Part of no
   gate.
4. **Gate tooling selftests** - the lane also runs every `scripts/gate/selftest_*.py` (all hermetic) and lists PASS / FAIL / TIMEOUT.
5. **Live-only specs** - the lane lists the Playwright specs guarded by `SW_LIVE !== '1'` (their last-run date is not recorded
   anywhere, so only the list).

Not done (questions): the bridge against a real Home Assistant (hassfest + import / `async_setup_entry` smoke in a throw-away venv,
Q3), the aarch64 image (Q3), scheduling the coverage lane (Q4).

## Install steps (runner) - NOT done by this row

Nothing was installed. After the merge, outside a gate / nightly:

1. Nightly script: `python3 <checkout>/scripts/gate/engine_sync.py install --src <checkout> --files nightly_tests.sh --apply --suffix .bak_DDMM`
   then `~/nightly_tests.sh --local-hour=02 --dry-run` (prints the branches only at 02:xx local; otherwise "nothing run").
2. Crontab (`crontab -e`), replace the nightly line (keep the existing date guards if they still apply):
   `0 23,0 * * * /home/sw/nightly_tests.sh --local-hour=02 >> /home/sw/smplwise-results/cron.log 2>&1`
   (`CRON_TZ=Asia/Jerusalem` can stay; it has no effect on this cron.)
3. `addon_build_check.sh`, `coverage_lane.*`, the mirror checks and the Playwright configs run from the checkout under test - nothing to
   install.
4. Optional, to try the lane: `~/work/slotb.sh bash <checkout>/scripts/gate/coverage_lane.sh --root <checkout>` (report in
   `~/smplwise-results/coverage/<date>_<sha>/coverage.md`).

## Tests

All on fakes; nothing touched the lab, Home Assistant, WisKey or go2rtc. Runner jobs `p2520_lowsbg_run*.sh` through `~/work/slotb.sh`
(slot B, after the 2.54 gate), one pytest process per file; PC: one file per process.

New tests (each failed on the base code - the fixed file swapped back to its `release/2540-train` version - and passes with the fix):

| test | finding | before (base code) | after |
|---|---|---|---|
| `tests/test_bridge_persister_rollback_2550.py` | WB-06 | 2 failed ("after the rollback the unsaved mark is still to be saved"; "the retire ... is in effect") | 2 passed |
| `tests/test_wiskey_service_grant_observe_2550.py` | WB-05 | 4 failed | 4 passed |
| `tests/test_bridge_install_leftovers_2550.py` | TR-12 | 2 failed, 1 skipped (PC: no link right) | 3 passed (runner) |
| `tests/test_mirror_deep_compare_2550.py` | TR-13 | 2 failed, 1 passed (the control case) | 3 passed |
| `tests/test_nightly_local_hour_2550.py` | TR-14 | 6 failed, 1 passed (runner) | 7 passed (runner); skipped on the PC (Git Bash has no zone data) |
| `frontend/tests/unit-pw-server-reuse-2550.spec.ts` | TR-10 | fails to load (no helper) with the base configs | 3 passed (runner, with `unit-unit-config-pages-2440`: 8 passed) |
| `tests/test_run_sh_sandbox_2550.py` | TR-08 | new coverage (run.sh itself unchanged); its own control case shows a bashio typo is caught | 4 passed (PC and runner) |
| `tests/test_coverage_lane_2550.py` | TR-08 | new tool | 4 passed |
| `test_gate_addon_build.py` (new `badcmd` case) + `selftest_gate.py` | TR-08 | the in-image steps need the fake engines to answer `image inspect`: `selftest_gate.py` went red on this branch - found by the coverage lane's selftest section - and the fakes were updated | 12 passed; SELFTEST PASSED |

The in-image step was also run against the runner's existing add-on image (`smplwise-gate/amd64-addon-smplwise_vms:gate`, `--network
none`): `run_sh_in_image` PASS ("5 bashio functions ok"), `run_sh_is_cmd` PASS; and against a throw-away image with `bashio::confg`
put into `/run.sh`: `run_sh_in_image` FAIL ("bashio has no function bashio::confg"); the throw-away image was removed.

Regression files (runner, head `bccf6978a`, then `0674b1003` for the gate files), all passed: `test_bridge_080` 3, `test_bridge_config_drift` 13,
`test_bridge_gaps_2438` 8, `test_bridge_install` 5, `test_bridge_key_activation_295` 30, `test_bridge_keyrot_harness_295` 34,
`test_bridge_lease_event` 66, `test_bridge_media_players` 17, `test_bridge_media_policy` 49, `test_bridge_native_keyset_2520` 32,
`test_bridge_repair_legacy_2520` 13, `test_bridge_runnable` 110 (+1 skipped), `test_bridge_schedule_service` 83,
`test_bridge_service_identity` 171, `test_bridge_stale_discovery_2383` 32, `test_bridge_stream_source` 50,
`test_bridge_update_listener_2401` 13, `test_build_guards_2438` 11, `test_capmap_295` 65, `test_door_bridge_block_2404` 21,
`test_extid_followups` 20, `test_lovelace_card` 5, `test_release_check` 3, `test_wiskey_adopt_2272_review` 41,
`test_wiskey_m12_policy_b_native_gate` 31, `test_wiskey_media_v2_2530` 39, `test_wiskey_r3_2272_owner_switch` 11,
`test_wiskey_s4_core_observer` 31 (failed once on the PC before `bccf6978a`: its section split `"# 0.10.1"` also matched `"# 0.10.10"`;
fixed to `"# 0.10.1 ("`), `test_wiskey_service_grants_v3_2520` 58, `test_wxh4_emergency_revoke_2407` 22, `test_gate_addon_build` 12,
`test_python_constraints_2407` 34, `test_supervisor_build_check` 19. `scripts/sync_integration.py --check`: up to date.

Lint: `ruff check` of the new files: clean. Of the changed existing files: the same finding count before and after (keyset.py 5,
release_check.py 8, selftest_gate.py 8 - all pre-existing; the others 0). `bash -n` of the three changed shell scripts: OK.

Coverage lane, sample run (runner, 3 backend files, 2 shards): report written, "17.9 %" of 274,835 executable lines (a 3-file sample, not
a measurement of the suite), 6 gate selftests listed, 104 live-only spec files listed, exit 0.

NOT_RUN: the full backend suite and the Playwright suites (the train's gate runs them); `tsc` of the frontend (the unit spec loads the
two changed configs through Playwright's TypeScript loader; a filtered `tsc --noEmit` printed nothing for the changed files); the
coverage lane over the whole suite; anything in the lab (the bridge 0.10.10 load needs the owner's Home Assistant restart).

## Open questions (recommendation first)

- **Q1 (WB-04)** - v2 admission writes the key store up to once per second per key under steady WisKey traffic. The review's fix
  (save the mark N s ahead) makes the bridge refuse WisKey v2 for up to N s after every entry reload and needs WisKey to accept that.
  (a) leave it until the lab measures the real write rate on 0.10.10 with v2 traffic (count `.storage` writes for an hour), then
  decide; (b) do the save-ahead now with N = 10 s and tell WisKey; (c) never.
- **Q2 (TR-08 run.sh under s6)** - start the image with its real entrypoint needs a Supervisor (bashio reads options from its API).
  (a) keep the sandbox test + the in-image check of this row and stop there; (b) add a fake Supervisor HTTP stub in the build check
  so the real `/init` -> `/run.sh` -> `/healthz` path runs.
- **Q3 (TR-08 real Home Assistant, aarch64)** - (a) one runner job per release train: throw-away venv with the current
  `homeassistant` wheel, hassfest + import / `async_setup_entry` smoke of the bridge mirror (about 1 GB download, 10 min); aarch64
  stays "wheels checked, not built" and is written in DOCS as such; (b) the same plus an aarch64 build under qemu in the nightly
  (slow: about 30-60 min); (c) nothing.
- **Q4 (TR-08 coverage lane)** - (a) run the lane once a week on the runner (Sunday after the prune, 2 shards) and keep the newest
  report next to the nightly's; (b) after every nightly; (c) only by hand.
- **Q5 (TR-12 part b)** - stage the new bridge tree outside `custom_components` (`<config>/.smplwise-staging/`): (a) not needed now -
  the leftovers are removed on every run; (b) do it.
