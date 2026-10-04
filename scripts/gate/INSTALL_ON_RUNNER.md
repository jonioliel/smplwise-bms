# Release gate on the Ubuntu runner

Files (keep them together in one directory, the runner convention is `~/`):

| File | Role |
|---|---|
| `release_gate.sh` | entry point: locks (gate + nightly), total timeout, hands over to the Python engine |
| `release_gate.py` | the engine: worktree, backend shards, Playwright groups, retries, verdict, reports, false-green guards |
| `gate_baselines.json` | per-category passed counts of the previous accepted release (used when the branch under test has none of its own in `scripts/gate/`) |
| `selftest_gate.py` | self-test with a fake suite; proves the gate fails on a crash and on zero tests |

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
