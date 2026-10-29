# GATE-FAST-2291: fast release gate tooling (install notes)

Branch `pilot/GATE-FAST-2291`, owner-approved plan `private/planning/GATE_OVERHAUL_PLAN_HE_2026-10-29.md` (all answers A), work items 1 to 4.
Nothing here is installed on the runner yet. The lead installs it in a quiet window, never while a gate runs
(`~/smplwise-results/gate_status.json` must show a finished state). All files are tracked in `scripts/gate/`; `private/runner/` is gitignored
and was not touched.

## What is new

| File | Item | Role |
|---|---|---|
| `gate_backcompare.py` | 1 | back-comparison of past gate reports: what the selection would have run, which failing files it would have missed, nightly state when the gate started. Read-only, starts no test |
| `gate_entry.py`, `gate_release.sh` | 2 | THE entry point `gate_release.sh <branch>`; the FULL-or-SELECT rule; fast gate OFF until the flag file exists |
| `gate_early_layout.json`, engine change in `release_gate.py` | 3 | early layout stage, first in the Playwright queue, parallel to the backend shards, fail-fast report `gate_<b>_<sha>.early.md` |
| `gate_budget.py`, `gate_phase_budgets.json`, engine change, `release_gate.sh` / `release_gate2.sh` | 4 | per-phase budgets (previous x 1.25, else seed estimates), total cap = sum x 1.5, lateness in `gate_status.json` and the report |
| `selftest_gate_fast.py` | 1-4 | self-test with fake data only (runs on Windows and POSIX, no runner needed) |

## The rule (also `python3 gate_entry.py rule`)

* Fast (change-based) selection is **OFF by default** (owner answer 2A). The lead switches it on with `touch ~/.gate_fast_enabled` only after the
  Friday 30.10 full run ended green or with explained failures. Flag absent: every gate is the FULL tier on the v2 schedule.
* Flag present, newest full nightly on main: green -> SELECT; red only through quarantined tests (ticket + owner + expiry, `gate2_quarantine.json`)
  -> SELECT and the explained failures are listed; red with any other failure, an engine-level failure, older than 36 h, or missing -> FULL, with the
  reason and the failing test names printed. `--full` forces FULL. `--after <report>` is the unchanged targeted re-run after a red gate.
* Tagging a release needs a FULL green nightly on main at most 7 days old: `python3 gate_entry.py tagcheck` (plan rule 3A, answer 3A).
* Early layout stage failure: the gate stops at once (answer 1A) and writes the early report; `GATE_EARLY_FAILFAST=continue` keeps collecting.
  `GATE_EARLY_LAYOUT=0` switches the stage off. Over-budget phases only produce a lateness report (answer 7A); the cap is the derived total.

## Install (runner, quiet window)

```
# back up what is there, then copy (the convention: engine files in ~/, the gate-2 wrapper files in ~/gate2/)
scp scripts/gate/release_gate.py scripts/gate/release_gate.sh scripts/gate/gate_budget.py scripts/gate/gate_phase_budgets.json \
    scripts/gate/gate_early_layout.json runner:~/
scp scripts/gate/release_gate2.sh scripts/gate/gate_release.sh scripts/gate/gate_entry.py scripts/gate/gate_budget.py \
    scripts/gate/gate_backcompare.py runner:~/gate2/
ssh runner 'chmod +x ~/release_gate.sh ~/gate2/release_gate2.sh ~/gate2/gate_release.sh'
```

`release_gate2.sh` copies the engine and the three aux files from `~/` into `~/gate2/` at each real run, so `~/` stays the source of truth.
`gate_entry.py` imports `gate2_verdict.py` and `gate_budget.py`, which must sit in `~/gate2/` (they do after the copy above and the existing gate-2 install).
Validate with `python3 selftest_gate_fast.py` (copy it too), then `gate_release.sh <branch> --dry-run` (takes no lock, starts no test).

## Back-comparison (item 1), to be run where the result files are

```
python3 gate_backcompare.py --results ~/smplwise-results --repo ~/smplwisebms --last 8 --out /tmp/backcompare.md
```
It needs repository tags and the `nightly/` reports; with `--selection-dir` it reuses stored `gate_<b>_<sha>.selection.json` files. Related earlier
analysis: `docs/release/GATE_V2_REPLAY.md`.

## Not validated on the runner (needs a quiet window)

Real gate run with the early stage and budgets (timings, the real early-list cost against the 8 minute target, `max_worker_seconds` tuning),
fail-fast kill of the backend shards, the derived cap values from real history, `gate_release.sh` end to end (flock paths, `--dry-run`), and the
back-comparison numbers themselves. The seed budgets are estimates, not measurements.
