# Release gate on the Ubuntu runner

Files (keep them together in one directory, the runner convention is `~/`):

| File | Role |
|---|---|
| `release_gate.sh` | entry point: locks (gate + nightly), total timeout, hands over to the Python engine |
| `release_gate.py` | the engine: worktree, backend shards, Playwright groups, retries, verdict, reports, false-green guards |
| `gate_baselines.json` | per-category passed counts of the previous accepted release (used when the branch under test has none of its own in `scripts/gate/`) |
| `selftest_gate.py` | self-test with a fake suite; proves the gate fails on a crash and on zero tests |
| `runner_cleanup.sh` | disk housekeeping by the retention rules below (dry run by default) |

## Install / update

Never while a gate is running (`~/smplwise-results/gate_status.json` must show a finished state).

```
ssh runner 'cp ~/release_gate.sh ~/release_gate.sh.bak-$(date +%Y%m%d)'      # back up the old one first
scp scripts/gate/release_gate.sh scripts/gate/release_gate.py scripts/gate/gate_baselines.json runner:~/
ssh runner 'chmod +x ~/release_gate.sh && python3 - < /dev/null'
```

Then run the self-test on the runner (it touches only a temp directory, no real results, worktrees or browsers):

```
scp scripts/gate/selftest_gate.py runner:~/ && ssh runner 'python3 ~/selftest_gate.py'
```

Expected last line: `SELFTEST PASSED`.

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
commit it, and copy it to the runner. The baseline is a tracked file on purpose: its history is the record of the suite size.

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
