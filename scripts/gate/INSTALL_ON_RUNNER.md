# Release gate on the Ubuntu runner

Files (keep them together in one directory, the runner convention is `~/`):

| File | Role |
|---|---|
| `release_gate.sh` | entry point: locks (gate + nightly), total timeout, hands over to the Python engine |
| `release_gate.py` | the engine: worktree, backend shards, Playwright groups, retries, verdict, reports, false-green guards |
| `gate_baselines.json` | per-category passed counts of the previous accepted release (used when the branch under test has none of its own in `scripts/gate/`) |
| `gate_durations.json` | seconds per Playwright spec file from the last accepted gate: a committed seed that `release_gate.py` uses only for files no `gate_*.logs/pw_*.json` on the runner has timed (balances the `--workers=1` chunks); since GATESPEED-293 also `backend_seconds` (per backend test file, v2 shard split), `backend_shard_seconds_total` and `pixel_phase_seconds` (`--plan` estimates); optional, the engine runs without it |
| `selftest_gate.py` | self-test with a fake suite; proves the gate fails on a crash and on zero tests |
| `timing_lane.sh` | GATELANES-297: the non-blocking timing lane (`@timing-lane` / `timing_lane` tests), started by `release_gate.sh` in the background after a gate; waits for a quiet machine; reports in `~/smplwise-results/timing-lane/` (`docs/testing/GATE_LANES.md`) |
| `runner_cleanup.sh` | disk housekeeping by the retention rules below (dry run by default) |

## Install / update

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
  removes it at the end. A gate killed by `timeout -k` leaves `/dev/shm/smplwise-gate-*`, and the next v2 gate sweeps it at start.
  To check by hand: `ls -d /dev/shm/smplwise-gate-* 2>/dev/null` (empty when no gate runs).
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

`nightly_tests.sh` (installed as `~/nightly_tests.sh`, cron line `0 2 * * * /home/sw/nightly_tests.sh >> ~/smplwise-results/cron.log 2>&1`)
drives THIS engine, tier L without the visual step, from its own copy in `~/nightly-gate/` so that installing a new nightly never
changes the release gate (and the reverse). Since 2026-10-09 (NIGHTLY-speed): the old script ran every spec on the dist preview on
all three projects with `--workers=2`, dev-server specs included, and hit its 150 min limit; the engine's classification and
parallel groups finish the same suite in about 60 min.

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
