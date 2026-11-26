# Release gate on the Ubuntu runner

Files (keep them together in one directory, the runner convention is `~/`):

| File | Role |
|---|---|
| `release_gate.sh` | entry point: locks (gate + nightly), total timeout, hands over to the Python engine |
| `release_gate.py` | the engine: worktree, backend shards, Playwright groups, retries, verdict, reports, false-green guards |
| `gate_baselines.json` | the FLOOR of the count-drop check: per-category passed counts of a green full run, plus per-category `thresholds` (used when the branch under test has none of its own in `scripts/gate/`). GATE-TRUST-2540 (TR-07): the engine raises each category to its count in the newest green FULL tier-L run of `~/smplwise-results` and `~/smplwise-results/nightly` (at most 30 days old), so no hand refresh after a release |
| `gate_durations.json` | seconds per Playwright spec file from the last accepted gate: a committed seed that `release_gate.py` uses only for files no `gate_*.logs/pw_*.json` on the runner has timed (balances the `--workers=1` chunks); since GATESPEED-293 also `backend_seconds` (per backend test file, v2 shard split), `backend_shard_seconds_total` and `pixel_phase_seconds` (`--plan` estimates); optional, the engine runs without it |
| `selftest_gate.py` | self-test with a fake suite; proves the gate fails on a crash and on zero tests |
| `gate2/selftest_gate_trust.py` | GATE-TRUST-2540 self-test (fake data only): the lint lane lints the gate's worktree (TR-05), the self-refreshing per-lane count baseline (TR-07), the coverage anchor of a targeted `--after` run (TR-09) |
| `timing_lane.sh` | GATELANES-297: the non-blocking timing lane (`@timing-lane` / `timing_lane` tests), started by `release_gate.sh` in the background after a gate; waits for a quiet machine; reports in `~/smplwise-results/timing-lane/` (`docs/testing/GATE_LANES.md`) |
| `fixture_lane.sh` | GATE-FIXTURE-LANE-2530: the fixture groups of `frontend/tests/fixtures/fixture_specs.json` on their own (`GATE_LANE=fixture` of the engine next to it); a tier-L gate runs the same groups itself; reports in `~/smplwise-results/fixture-lane/` (`docs/testing/GATE_LANES.md` section 5); `engine_sync.py install --files fixture_lane.sh` |
| `addon_build_check.sh` | SUPERVISOR-BUILD-GATE-2341: the Supervisor-style image build + smoke test; run from the branch under test, not copied (section below) |
| `runner_cleanup.sh` | disk housekeeping by the retention rules below (dry run by default) |

## Install / update

**Since GATE-HARDEN-2520: one installer and a drift check.** Install the engine from a checkout of the commit you mean to gate
(on the runner; idle runner only - the installer refuses while `gate_status.json` / the nightly's / `entry_status.json` say running
or a `release_gate` / `nightly_tests` / `branch_check.sh` process exists):

```
python3 <checkout>/scripts/gate/engine_sync.py install --src <checkout>                       # dry run: what would be copied where
python3 <checkout>/scripts/gate/engine_sync.py install --src <checkout> --apply --suffix .bak_DDMM
```

The default set is the engine group: `release_gate.py` to `~/`, `~/gate2/` and `~/nightly-gate/`; `release_gate2.sh` and
`engine_sync.py` to `~/gate2/` (`engine_sync.py` also to `~/`); `selftest_gate.py` to `~/`. `--files a,b` installs other mapped files
(the map is `INSTALL_MAP` in the script). Every replaced file is backed up once as `<file><suffix>` (an existing backup is kept), the
copy is atomic, and `~/gate_install_manifest.json` records the source commit and the sha256 of every installed file.

`release_gate2.sh` runs `engine_sync.py check` right after its fetch, before anything else: the sha256 of `~/release_gate.py` and
`~/gate2/release_gate.py` must equal `scripts/gate/release_gate.py` of `origin/<branch>`, or the gate is REFUSED (exit 2, nothing run).
A deliberate pin: `--engine-drift-ok "<reason>"` (or `GATE2_ENGINE_DRIFT_OK`), written into `gate_<b>_<sha>.engine.json`. The other
gate-2 files (`gate2_select.py`, `gate2_verdict.py`, `gate_entry.py`, ...) are compared too and reported loudly, never refused.
The nightly writes the same record for `~/nightly-gate/` (warn only: main can be older than an engine installed ahead of its release),
and every report's JSON carries `engine_sha256`. Self-test: `python3 scripts/gate/selftest_engine_sync.py` (hermetic since
TEST-STABILITY-2530: a fake home as HOME and a fake process table, so it passes while a gate runs on the same runner; the install
itself still refuses then).

**`~/known_issues.json` (TR-06):** an entry explains a failure only with a non-empty `ticket` and an `expires` date (YYYY-MM-DD) from
today to at most `GATE_KNOWN_MAX_DAYS` (7) days ahead - the quarantine rule. Other entries are refused, listed in the report (`known_refused`)
and their failures count as FAIL.

The manual copies below remain valid for files outside the map.

Never while a gate is running (`~/smplwise-results/gate_status.json` must show a finished state).

```
ssh runner 'cp ~/release_gate.sh ~/release_gate.sh.bak-$(date +%Y%m%d)'      # back up the old one first
scp scripts/gate/release_gate.sh scripts/gate/release_gate.py scripts/gate/timing_lane.sh scripts/gate/gate_baselines.json scripts/gate/gate_durations.json runner:~/
ssh runner 'chmod +x ~/release_gate.sh ~/timing_lane.sh && python3 - < /dev/null'
```

Without `~/timing_lane.sh` (or with `GATE_TIMING_LANE=off`) the gate still leaves the timing-lane tests out; they then run nowhere
until the lane is installed - install the three files together.

Then run the self-test on the runner (it touches only a temp directory, no real results, worktrees or browsers):

```
scp scripts/gate/selftest_gate.py runner:~/ && ssh runner 'python3 ~/selftest_gate.py'
```

Expected last line: `SELFTEST PASSED`.

## v2 schedule (GATESPEED-293, opt-in)

The same three files carry an opt-in faster schedule (see `docs/release/GATE_SPEED.md`): `~/release_gate.sh <branch> --schedule v2`
(or `GATE_SCHEDULE=v2`). Without the flag the engine is the 2.9.2 gate. Runner notes:
- v2 puts the backend shards' scratch (basetemp + `TMPDIR`) on `/dev/shm` when at least `GATE_TMPFS_MIN_GB` (4) GB are free, and
  removes it at the end. A gate killed by `timeout -k` leaves `/dev/shm/smplwise-gate-*`, and the next v2 gate sweeps it at start -
  only dirs no running engine owns (NIGHTLY-2331): each dir carries `owner.json` (engine pid + start time) and is swept only when that
  process is gone; a dir without `owner.json` only after `GATE_TMPFS_STALE_MIN` (360) idle minutes. A run never removes another
  run's scratch. To check by hand: `ls -d /dev/shm/smplwise-gate-* 2>/dev/null` (empty when no gate runs).
- v2 writes `backend_sN.xml` (junit) next to each shard log. The next v2 gate reads the last 10 gates' XML to balance the shards.
  Keep them like the `pw_*.json` (small, the retention table below keeps the `.logs/` files).
- Estimates without running anything: `python3 ~/release_gate.py --plan --root ~/work/gate-<branch>` (any checkout).
- After a green v2 gate, refresh the seed:
  `python3 ~/release_gate.py --seed-from ~/smplwise-results/gate_<branch>_<sha>.logs "gate <branch> @ <sha> (...)" > gate_durations.json`.
  Copy that file into `scripts/gate/` and commit it.
- The selftest has v2 cases (pool + tmpfs scratch in its own temp directory). They need no browser and no lock.
- Phase 2: copy `select_tests.py` and `shadow_compare.py` next to `release_gate.py` (`~/` and `~/nightly-gate/`).
  - `--select-base <ref>` needs `select_tests.py` in the same directory; without it the selection fails and the gate runs
    the full tier, as the report says.
  - The nightly writes `<date>_selection-audit.md` when `~/nightly-gate/select_tests.py` exists and a selection run left a
    `gate_*.selection.json`.
  - The quarantine list is `~/smplwise-results/quarantine.json`; it is rewritten by every gate.
  - `SW_NIGHTLY_SCHEDULE=v2` in the cron line runs the nightly on the v2 schedule.

## Nightly run (cron 02:00 Asia/Jerusalem)

`nightly_tests.sh` (installed as `~/nightly_tests.sh`, cron line
`0 23,0 * * * /home/sw/nightly_tests.sh --local-hour=02 >> ~/smplwise-results/cron.log 2>&1`)
drives THIS engine, tier L without the visual step, from its own copy in `~/nightly-gate/` so that installing a new nightly never
changes the release gate (and the reverse). Since 2026-10-09 (NIGHTLY-speed): the old script ran every spec on the dist preview on
all three projects with `--workers=2`, dev-server specs included, and hit its 150 min limit; the engine's classification and
parallel groups finish the same suite in about 60 min.

LOWS-BRIDGE-GATE-2550 (deep review 2.52 TR-14): the runner's cron does NOT honour `CRON_TZ=Asia/Jerusalem` (the runner is Etc/UTC), so the
old line `0 2 * * *` started at 02:00 UTC = 04:00 local in winter. The line fires at both UTC hours that can be 02:00 local (00:00 UTC in
winter, 23:00 UTC in summer) and `--local-hour=02` makes the wrong one exit at once (no lock, nothing written). Keep the date guards of
the existing line (`[ "$(date +\%Y\%m\%d)" ... ] &&`) in front of it when they still apply; note that at 23:00 UTC `date` is still the
previous UTC day. Check: `~/nightly_tests.sh --local-hour=02 --dry-run` prints the branches only at 02:xx local.

```
ssh runner 'mkdir -p ~/nightly-gate && cp ~/nightly_tests.sh ~/nightly_tests.sh.bak-$(date +%Y%m%d)'
scp scripts/gate/release_gate.py scripts/gate/gate_baselines.json scripts/gate/gate_durations.json runner:~/nightly-gate/
scp scripts/gate/nightly_tests.sh runner:~/ && ssh runner 'chmod +x ~/nightly_tests.sh && ~/nightly_tests.sh --dry-run'
```

Never while a nightly or a gate runs (`~/.smplwise-tests.lock` free, no `~/.gate-pending`). Results: the per-branch summary stays
`~/smplwise-results/<date>_<branch>.md` (the dashboard reads it); the engine's full report, logs and its own `gate_status.json` are
in `~/smplwise-results/nightly/` (never the release gate's files). Knobs: `SW_NIGHTLY_MAX_MIN` (hard limit, 240 since GATESPEED-293; was 150),
`SW_NIGHTLY_BRANCH_MAX_MIN` (engine budget per branch, 225; was 120, which cut every nightly of 10-15..10-20), `SW_NIGHTLY_SCHEDULE` (v1 or v2), `GATE_PW_WORKERS` (workers per Playwright process, 3),
`SW_NIGHTLY_ENGINE` (engine path). `--backend-only` keeps the old two-shard backend path; `--frontend-only` / `--no-dev` map to
the engine's `GATE_SKIP_BACKEND=1` / `GATE_SKIP_DEV=1` (a skipped category is left out of the baseline check).

## Supervisor build stage (SUPERVISOR-BUILD-GATE-2341)

The engine starts `scripts/gate/addon_build_check.sh` **of the branch under test** (nothing to copy for the script itself) in the
background right after `release_check`, and collects it before the backend. It builds the add-on image as the HA Supervisor does
(`docker build` of `smplwise_vms/` with `BUILD_FROM` = build.yaml amd64, `BUILD_VERSION`, `BUILD_ARCH=amd64`, layer cache kept) and
runs `import smplwise`, `create_app()`, `python3 -m smplwise` + `/healthz`, and the Dockerfile's tools inside it with `--network none`.
Report: section "addon_build" and `gate_<b>_<sha>.logs/addon_build.{log,json}`. Category `addon_build` has no count baseline.

| `GATE_ADDON_BUILD` | Effect |
|---|---|
| `auto` (default) | PASS / FAIL as the script says; no docker (or a branch without the script) = `SKIPPED_NOT_RUN` with the reason, never a pass |
| `require` | as auto, but NOT_RUN fails the gate (use once docker is installed) |
| `off` | not started |

`GATE_ADDON_BUILD_SECS` (600) is the stage's budget; the script is killed 30 s after it.

**Python lock (PY-CONSTRAINTS-LOCK-2407).** Before the engine probe the script checks `smplwise_vms/backend/constraints.txt`
with `scripts/lock_python.py` using the runner's `python3` (Ubuntu 24.04: CPython 3.12, the image's minor version):
`lock_static` (offline: every requirement pinned and satisfied), `lock_wheels` (PyPI JSON: a CPython 3.12 musllinux wheel per pin
for amd64 and aarch64) and `lock_pip` (a clean `python3 -m venv`, then `pip install --dry-run --report -r requirements.txt
-c constraints.txt` for musllinux / CPython 3.12, compared with the lock; needs the `python3.12-venv` package, otherwise NOT_RUN).
These run **without docker too**: a wrong lock fails the stage even while the image build itself is NOT_RUN. With docker, step
`constraints_match` also compares the image's installed distributions with the lock. `ADDON_BUILD_LOCK=static` limits the lock
part to the offline check (the hermetic tests use it). Run only the lock part by hand (no build, about 1 minute):

```
bash ~/work/gate-<branch>/scripts/gate/addon_build_check.sh --root ~/work/gate-<branch> --lock-only
```

**State on 2026-11-01 (read-only probe):** the runner has **no docker** (`docker: command not found`). `podman` 4.9.3 is installed,
but `podman version` did not answer within 60 s while a gate was running, so the script does not use podman unless
`ADDON_BUILD_ENGINE=podman` is set on purpose. Until docker is installed the stage reports NOT_RUN in every gate.

Owner steps to enable it (once, on an idle runner; nothing here was done by an agent):

```
sudo apt-get update && sudo apt-get install -y docker.io docker-buildx
sudo usermod -aG docker sw            # docker group membership is root-equivalent on this host
# log out and in again (or reboot), then:
docker version && docker run --rm hello-world
# warm the layer cache once (base image pull + pip layer, about 1-3 GB under /var/lib/docker; later runs reuse the layers):
bash ~/work/gate-<branch>/scripts/gate/addon_build_check.sh --root ~/work/gate-<branch>   # any checkout that has the script
```

After that a gate shows `addon_build: PASS`; switch to `GATE_ADDON_BUILD=require` in the gate's environment when it has been
green twice. Disk: the check keeps one tagged image (`smplwise-gate/amd64-addon-smplwise_vms:gate`) as its cache and prunes only the
dangling layers of its own label (`smplwise.gate=addon-build`); `docker system df` shows the use.

Re-install after this change (idle runner only, backup first):

```
ssh runner 'cp ~/release_gate.py ~/release_gate.py.bak-$(date +%Y%m%d) && cp ~/nightly-gate/release_gate.py ~/nightly-gate/release_gate.py.bak-$(date +%Y%m%d)'
scp scripts/gate/release_gate.py scripts/gate/selftest_gate.py runner:~/
scp scripts/gate/release_gate.py runner:~/nightly-gate/
ssh runner 'GATE_SELFTEST_REPO=~/work/gate-<branch> python3 ~/selftest_gate.py'   # the addon-build cases need a checkout with the script (fake docker); without it they print SKIP
```

`~/gate2/release_gate.py` is refreshed from `~/` by `release_gate2.sh` only when it is missing: copy it there too
(`scp scripts/gate/release_gate.py runner:~/gate2/`). A gate started before the copy keeps the old engine (no stage).

## Usage

```
~/release_gate.sh <branch> [--tier S|M|L] [--allow-count-drop "<reason>"]
```

* A Playwright or pytest process that crashed at load time, ran zero tests, hit the timeout, or exited non-zero without a failed
  test is a FAIL (category line in the report: `<label>: load error` / `zero tests` / `exit code` / `timeout`).
* Every category's passed count (pass + flaky) must be at least 70 percent (`GATE_DROP_THRESHOLD=0.70`) of
  `gate_baselines.json` (tier L only; S and M print a warning that the check was not applied). Below that the gate is red.
  `--allow-count-drop "<reason>"` waives the check for one run (for a deliberate removal of tests); the reason is printed in
  the report and the summary says `count-drop check WAIVED`.
* The report (`gate_<branch>_<sha>.md/.json`) lists every category: passed, failed, flaky, known, skipped, baseline and ratio.
  The `.json` also carries `baseline_candidate`.

## After each release

When the release gate is green, refresh `scripts/gate/gate_baselines.json` from `baseline_candidate` of that gate's `.json`,
commit it, and copy it to the runner. Refresh `gate_durations.json` from the same gate's `gate_<branch>_<sha>.logs/pw_*.json`
(skip the `_retry_` files; per spec file sum `results[].duration` over all tests, in seconds, rounded to 0.1; drop files that sum to 0).
Sum on the runner, or on Windows with `python -X utf8`: `prior_costs()` reads each report with the locale encoding and silently
skips one it cannot decode (an unforced Windows run parsed 8 of 422 spec files).
The engine already reads the last 10 gates' `pw_*.json` on the runner, so the seed only matters for a new runner, a cleaned logs
directory, or specs added since those gates. Unlike `gate_baselines.json`, the seed is read from the directory of the engine that
runs (`~/`, `~/nightly-gate/`, or a per-release copy `~/gateNNN/` of `scripts/gate/`), never from the branch under test: the `~/` and
`~/nightly-gate/` copies are replaced separately (idle runner only, backup first), and a release gate gets a new seed through the
copy of `scripts/gate/` it is started from. The `gate_baselines.json` numbers are passed COUNTS, not times; there is no per-stage
time baseline that the engine reads (the stage seconds are in each report's `phases`; the `source` line of the file and the refresh
log below repeat them for the gate the numbers came from, for people only). The baseline is a tracked file on purpose: its history is the record of the suite size.

The gate reads the `gate_baselines.json` of the branch under test first (`scripts/gate/` in its worktree) and falls back to
`~/gate_baselines.json` only when the branch has none. Every branch cut from `main` carries one, so the refreshed file takes effect
for a gate once it is merged into `main` (or the integration branch); the runner copy matters only for older branches. Back the
runner copy up before replacing it:

```
ssh runner 'cp ~/gate_baselines.json ~/gate_baselines.json.bak-$(date +%Y%m%d) && cat > ~/gate_baselines.json' < scripts/gate/gate_baselines.json
```

Refresh log (newest first):

| Date | From gate | preview | dev | backend | pixel | fixture | Note |
|---|---|---|---|---|---|---|---|
| 2026-10-13 | integ/2410 @ 240424e0 (2.4.10, pass) | 8685 | 852 | 7133 | 188 | 15 | no flaky, no known; `gate_durations.json` regenerated whole from the same gate's 18 `pw_*.json` (301 spec files, about 8.9 h of summed test time over all projects: 39 specs added, 5 near-zero unit specs fell below 0.05 s and were dropped, the rest re-measured). Stage seconds (preview / dev / wall): 2.4.8 2592 / 2867 / 93 min 38 s, 2.4.9 3264 / 2834 / 104 min 24 s, 2.4.10 3275 / 2965 / 106 min 38 s (2.4.10 also: tsc 17, build 9, fixture 62, visual 63). The 2.4.9 gate (8471 / 829 / 7070 / 188 / 15) was never refreshed here. Runner copies of both files in `~/` and `~/nightly-gate/` replaced 2026-10-13 18:19 UTC on an idle runner (backups `*.bak-20261013-1819`; the older `*.bak-20261013` backups were kept) |
| 2026-10-12 | integ/248 @ 10620d30 (2.4.8, pass) | 7960 | 766 | 6738 | 108 | 15 | pixel = 107 + 1 flaky, dev = 765 + 1 flaky; adds `gate_durations.json` (267 spec files, about 7.5 h of summed test time over all projects). The 2.4.6 gate (6452 / 636 / 6307 / 16 / 15) was never refreshed; the repo file was still the 2.0.0 one |
| 2026-10-05 | integ/200 @ f9576923 (2.0.0, pass) | 4928 | 582 | 5129 | 16 | 15 | BL1; the runner copy was still the 0.1.157 one (3917 / 218 / 3934 / 8 / 15) and was replaced too |
| 2026-10-05 | integ/0163 @ 1cd6aa72 (0.1.163, pass) | 4848 | 582 | 5099 | 16 | 15 | repo file only |

## Retention and disk housekeeping

The runner disk filled up to 95 percent in four days (2026-10-02 to 10-05): every gate leaves about 3.3 GB of pytest scratch
and every `run_remote.sh` / gate call leaves a git worktree under `~/work` (0.3 to 4.7 GB each, some with their own
`node_modules`). Retention rules (implemented by `scripts/gate/runner_cleanup.sh`, installed as `~/runner_cleanup.sh`):

| What | Kept | Removed |
|---|---|---|
| `~/smplwise-results/gate_*.md/.json`, nightly `*.md`, `gate_status.json` | always (small; the history of every gate) | never |
| `~/smplwise-results/*.logs/` logs and `pw_*.json` | always (`release_gate.py` balances the `--workers=1` chunks by the last 10 gates' `pw_*.json`) | never |
| pytest `--basetemp` scratch in a finished run (`*.logs/tmp_b1..3`, `tmp_bretry`, nightly `tmp1`/`tmp2`) | while the run is active and for 2 hours after | after 2 hours (pytest wipes a basetemp at the start of every session anyway) |
| worktrees `~/work/<branch>` and `~/work/gate-<branch>` | `~/work/main`; the newest passing gate's worktree; anything not merged into `origin/main`; anything checked out in the last 12 hours or used as a process's working directory; anything with tracked edits outside `docs/design/`, `docs/evidence/`, `smplwise_vms/www/` | merged into `origin/main` and idle for 12 hours (`run_remote.sh` and the gate recreate a worktree on demand) |

```
ssh runner '~/runner_cleanup.sh'            # dry run: the list and the total size, nothing removed
ssh runner '~/runner_cleanup.sh --apply'    # removes exactly that list; the list is kept in ~/smplwise-results/cleanup_<ts>.txt
```

The script refuses to start, and stops between items, while a release gate or a nightly run is active (it does not probe the
gate lock, so it can never make a starting gate refuse to run). Run it after each release round, or when `df -h /` passes
80 percent. Remote branches are never deleted by it.

## Frontend static checks (CR-FE-GATES-ENFORCE-2442)

`release_gate.py` runs three blocking checks of category `fe_static` for a branch that carries
`frontend/scripts/gates-baseline.json`: the entry-chunk budget and the unused-export baseline right after the build, ESLint over
`src/` in the background (collected after Playwright). The scripts and their baselines come from the branch under test; only the
engine is copied. `GATE_FE_STATIC=auto` (default): a check that could not finish (ESLint over `GATE_FE_LINT_SECS`, 1800; eslint
missing from `node_modules`) is a skipped NOT_RUN item; `=require`: NOT_RUN fails the gate; `=off`: nothing runs.

Re-install after this change (idle runner only, backup first), then the self-test (the process cases need `node`):

```
ssh runner 'cp ~/release_gate.py ~/release_gate.py.bak-$(date +%Y%m%d)'
scp scripts/gate/release_gate.py scripts/gate/gate_summary.py scripts/gate/selftest_fe_static.py runner:~/
scp scripts/gate/release_gate.py scripts/gate/gate_summary.py runner:~/gate2/
scp scripts/gate/release_gate.py scripts/gate/gate_summary.py runner:~/nightly-gate/
ssh runner 'python3 ~/selftest_fe_static.py'      # expected last line: SELFTEST OK
```

The first gate after the copy shows how long ESLint takes on the runner (`fe-lint-wait` and `fe_static.eslint.seconds` in the
report). Switch to `GATE_FE_STATIC=require` once it has finished inside its budget twice.

## Type-check programs (CR-TSCONFIG-SPLIT-2443)

`frontend/tsconfig.json` is the app alone (`src` + the two vite configs); `frontend/tsconfig.tests.json` is everything the gate
checked before the split (plus the other Playwright configs); `frontend/tsconfig.scripts.json` checks the `.mjs` tools. The
engine's `tsc` phase runs `tsc --noEmit -p tsconfig.tests.json` and then every other `frontend/tsconfig.*.json`
(`release_gate.tsc_commands`), all into `tsc.log`, one `tsc` count. A tree from before the split (no `tsconfig.tests.json`) gets
plain `tsc --noEmit` as before, so the new engine is safe for every open branch.

**Order matters: install this engine BEFORE a branch that carries the split is checked or merged.** An engine from before this
change runs plain `tsc --noEmit`, which on a split tree type-checks `src` only - the specs would silently leave the check.
Same copy commands as the section above (`~/`, `~/gate2/`, `~/nightly-gate/`), then `python3 ~/selftest_fe_static.py`
(the `tsc:` cases run everywhere).
