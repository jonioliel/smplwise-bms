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

## Items 5 to 9 (added)

| File | Item | Role |
|---|---|---|
| engine: `Recording`, `ckpt_*`, `--resume` / `GATE_RESUME=1` | 5 | checkpoint `gate_<b>_<sha>.checkpoint.json`: the backend (one unit) and every Playwright job (settled at once, one unit each) are saved when finished. `--resume` on the SAME full sha reuses them; a different sha, tier or selection base reuses nothing. `GATE_RESUME_RERUN_FAILED=1` also re-runs units that had failures. Pixel, fixture and visual jobs are not checkpointed (re-run). A killed gate loses the unit in flight and the backend if it had not finished collecting |
| `lint_spec_waits.py` + engine phase `spec-lint` | 6 | heuristic: a click followed within 8 lines by a size/position read with no `settle(page)` / wait. Only spec files ADDED since the base (`--select-base`, else origin/main) fail the gate, as category `lint`, before any test runs. `// lint-wait: ok` suppresses; `GATE_SPEC_LINT=0` switches off; `--all` reports the old debt (104 findings at this commit, informational) |
| `gate_quarantine.py` | 7 | ONE list = `gate2_quarantine.json` (reason, owner, ticket, expiry at most **7** days since ENTRY-CHECK-2310); the engine's auto queue is shown as candidates without effect; `list`, `add`, `remove`, `check`, `md`, `prune`. The re-run alone / second red = real logic is the existing `gate2_verdict.py` (rc 10) |
| `gate_holder.py`, `run_guarded.sh`, wrapper edits | 8 | the gate wrappers write `~/.smplwise-machine-holder.json` (who, what, since, pid) and remove it on exit; `run_guarded.sh "<agent>" <cmd>` or `gate_holder.py guard` refuses with a Hebrew message (exit 75) while a gate holds the machine. A raw command that skips the wrapper cannot be stopped |
| `gate_summary.py` + report/status | 9 | Hebrew section at the top of the report and one line in `gate_status.json`: real defects versus run problems, each with a "likely" cause (passed alone, timeout under load above 30, no time left, failed twice, deterministic phases) |

Install (same convention): `scp` `gate_summary.py lint_spec_waits.py gate_holder.py` to `~/` with the engine (`release_gate.py` imports them from its own directory),
and `gate_holder.py gate_quarantine.py run_guarded.sh` to `~/gate2/` (`release_gate2.sh` also copies nothing else new; `release_gate.sh` looks for `gate_holder.py` next to itself, so put it in `~/` too).
`chmod +x ~/gate2/run_guarded.sh`. Then add to the top of `run_remote.sh` / `run_smart.py` (private, not in this repo): `python3 ~/gate2/gate_holder.py guard --who "<agent>" || exit 75`.
Resume example: `gate_release.sh release/2271 --resume` (the wrapper passes `GATE_RESUME=1`; the sha must not have changed).
Quarantine: `python3 ~/gate2/gate_quarantine.py list --known ~/known_issues.json`.

Not validated on the runner: resume after a real kill, the inline settle of pool jobs under load (it replaces the settle step after the pool),
the lint phase inside a real gate, the holder file with real flock and wrapper traps, the thresholds of the Hebrew classification.

## Entry check before a release train (ENTRY-CHECK-2310)

Owner decisions 30.10 night: (1) no branch boards a release train without a GREEN runner entry check = the change-based selection run of
the branch against `origin/main` (~20-40 min, queued); (2) a test that fails only under load and passes alone goes to the gate's ONE
quarantine list with a fix ticket and an expiry of at most 7 days, shown in every report, so the nightly stays green and the fast gate
stays armed.

| File | Role |
|---|---|
| `branch_check.sh` | THE command: `~/gate2/branch_check.sh <branch>` (pushed branch, not main). Exit 0 GREEN, 1 RED / NOT_RUN, 2 usage |
| `branch_check.py` | the verdict: reads the engine report, applies the quarantine, writes `~/smplwise-results/entry_<b>_<sha>.md` (short, Hebrew + English) and `.json` |
| `gate2_verdict.py` | `MAX_QUARANTINE_DAYS = 7`, `load_quarantine_full` (active / expired / invalid), `quarantine_section` (the list every report carries) |
| `gate_quarantine.py` | `add` (validated: match, category, ticket, owner, reason, 1..7 days), `remove --match M --reason R` (to history), `check` (rc 1 on an invalid or expired entry), `md` |
| `gate_holder.py` | holder kind `entry`: agent runs through `run_guarded.sh` are refused while an entry check runs (Hebrew message) |
| `nightly_tests.sh` | appends the quarantine section to every nightly summary (information; the verdict is the engine's) |
| `selftest_entry_check.py` | hermetic self-test: Python parts + `branch_check.sh` end to end on a throw-away git repo with a fake engine and a fake `flock` |

What `branch_check.sh <branch>` does, and does not:
* It is **not** a release gate: no `~/.gate_fast_enabled` needed, the nightly state is printed for information only, the release gates'
  `gate_status.json` is never written (the engine's results go to `~/smplwise-results/entry/`), nothing is tagged.
* **Queue, never fail on busy**: it waits for `~/.smplwise-tests.lock` (the lock the nightly and the gates use), yielding to a pending
  release gate (`~/.gate-pending`) and a pending nightly (`~/.nightly-pending`). `~/smplwise-results/entry_status.json` says
  `queued` / `running` / `done`. Queue limit `--max-wait SECS` (default 12 h, `0` = none) -> NOT_RUN, exit 1. While an entry check runs,
  a release gate started by hand gets "lock busy" (exit 3) - start gates when `entry_status.json` is `done`.
* The run is the gate's own engine and selection, unforked: it stages `release_gate.py` + aux files from `~/` into `~/gate2/` exactly
  like `release_gate2.sh`, plans shards/slots with `gate2_select.py plan`, then runs
  `release_gate.py <branch> --tier L --schedule v2 --select-base origin/main --no-visual` with `GATE_SELECT_ENABLE=1`
  (the diff is `origin/main...<branch>`, i.e. from the merge base; the always-run core is included; heavy unchanged sweeps are deferred
  to the nightly as in a gate). Limit: `ENTRY_TOTAL_SECS`, else the derived select cap, else 5400 s.
* Verdict: **GREEN** = engine pass, or red only through ACTIVE quarantine entries (listed); **RED** = any failure outside the quarantine,
  including a test whose entry EXPIRED, or tsc / build / an engine guard; **NOT_RUN** = no engine report (queue limit, crash) - never green.
* `--dry-run` = `release_gate2.sh <branch> --base origin/main --dry-run` (selection + estimate; no lock, no test).

Quarantine (one list, `~/gate2/gate2_quarantine.json`):
```
python3 ~/gate2/gate_quarantine.py add --match test_x.py --category backend --ticket T-123 --owner lead --reason "fails under load only, passes alone" [--days 7]
python3 ~/gate2/gate_quarantine.py remove --match test_x.py --reason "fixed in T-123"
python3 ~/gate2/gate_quarantine.py check      # rc 1 when an entry is invalid or expired
python3 ~/gate2/gate_quarantine.py list --known ~/known_issues.json
```
Every entry needs match, category, ticket, owner, reason, `added`, `expires` with `expires - added <= 7` days. An invalid entry is ignored;
an expired entry explains nothing (its test counts as a failure again). The list is printed in the gate-2 summary
(`gate_<b>_<sha>.gate2.md`), the nightly summary (`<date>_main.md`) and the entry verdict; `gate_entry.py decide` (the fast-gate rule)
uses the same loader, so an expired entry also makes a red nightly "red" again (FULL tier).

Install (the lead, after train 2 releases, in a quiet window - `gate_status.json` finished, no `entry_status.json` running):
```
scp scripts/gate/{branch_check.sh,branch_check.py,gate2_verdict.py,gate_quarantine.py,gate_holder.py,gate_entry.py,selftest_entry_check.py} runner:~/gate2/
scp scripts/gate/gate_holder.py runner:~/          # release_gate.sh looks for it next to itself
scp scripts/gate/nightly_tests.sh runner:~/nightly_tests.sh
ssh runner 'chmod +x ~/gate2/branch_check.sh ~/nightly_tests.sh; cd ~/gate2 && python3 selftest_entry_check.py && python3 gate_quarantine.py check'
# then a first real check of a small pushed branch:  ~/gate2/branch_check.sh <branch>   (~20-40 min)
```
`gate2_quarantine.json` on the runner is the live list: do NOT overwrite it with the repository copy once entries exist; run
`gate_quarantine.py check` after the copy to see entries that the 7-day rule now marks invalid.

Not validated on the runner: the real queue with `flock -w`, the real engine under `--select-base origin/main`, wall times, the nightly
quarantine section in a real summary.

## Gate speed-ups (GATE-SPEED-2320, owner 31.10)

**Rule: every agent runs `early_local` before pushing; the lead runs `branch_early.sh` on the runner before a branch joins a train**
(and only then the ~20-40 min `branch_check.sh`).

### 1. Time limit = never below the estimate
`gate_budget.py limit` (used by `release_gate2.sh` and `branch_check.sh`): explicit `GATE_TOTAL_SECS` / `ENTRY_TOTAL_SECS` wins; else
`max(derived cap, ESTIMATE high x 1.25)`, never below the estimate high (the plan's `ESTIMATE gate2: ~lo-hi min` line); a side the
selection runs FULL uses the full-mode budgets (and a FULL frontend the full-tier estimate high); `--full` takes the plan's full-tier
estimate. The wrappers print `time limit: limit N s = max(...)`. On 31.10: cap 2924 s vs estimate 142 min -> now 10650 s; entry check
34 min cap vs ~110 min -> 8250 s.

### 2. Early check per branch
| File | Role |
|---|---|
| `early_check.py` | the driver: spec-lint (new specs: geometry read after a click with no settle), `tsc --noEmit`, the repository-wide unit rule specs (ONE Playwright run, `playwright.unit.config.ts`), the backend lint tests, `release_check.py`, and with `--layout` (runner) `vite build` + the gate's early layout list on the dist preview. All in parallel. `list`, `discover` (unit specs that read the source tree but are not listed) |
| `gate_early_check.json` | the list: 23 unit rule specs (uxfix-rtl, empty-state-icons, date-format-module, lead-reserve, tabset-registry, tabs-config, token-lint, menu-lint, page-background, access-parity-logic, tickets-naming/-quotes/-rules, people-strings, public-*, plan3d-assets), backend `test_upstream_watch.py`, `test_no_ip_literals.py`, `test_tickets_naming.py`, release_check, the layout list `gate_early_layout.json` |
| `branch_early.sh` | runner: `~/gate2/branch_early.sh <branch> [--no-layout] [--max-wait S]`; queues on `~/.smplwise-tests.lock` like `branch_check.sh` (yields to a pending gate / nightly), holder kind `entry`, worktree `~/work/early-<branch>`, links `~/smplwisebms/frontend/node_modules` when the lock file is identical (else `npm ci`), status `~/smplwise-results/early_status.json`, verdict `~/smplwise-results/entry_early_<branch>_<sha>.md/.json` (Hebrew + English). Exit 0 GREEN, 1 RED / NOT_RUN, 2 usage. Whole-run limit `EARLY_TOTAL_SECS` (1800) |
| `early_local.ps1` / `early_local.sh` | workstation, no runner: the same parts without the layout list. Needs `frontend/node_modules` (in a worktree: a junction, e.g. `New-Item -ItemType Junction frontend\node_modules -Target <checkout>\frontend\node_modules`) and a python with pytest (repo / main checkout `.venv`, or `EARLY_BACKEND_PYTHON`). Verdict file in `%TEMP%\smplwise-early\` |
| `selftest_gate_speed.py` | hermetic self-test: the limit rule + CLI, every early part with fake tools, the real list against the checkout, and `release_gate2.sh` / `branch_check.sh` / `branch_early.sh` end to end with fakes (needs bash + git; Git Bash is enough) |

```
powershell -NoProfile -File scripts\gate\early_local.ps1          # Windows agents, before every push (~4 min measured on 31.10)
bash scripts/gate/early_local.sh                                   # POSIX
~/gate2/branch_early.sh pilot/T123-foo                             # the lead, runner, before a train (~5-8 min target, not measured yet)
```

Install (the lead, quiet window: `gate_status.json` finished, no `entry_status.json` / `early_status.json` running):
```
scp scripts/gate/gate_budget.py runner:~/                          # release_gate2.sh / branch_check.sh copy ~/gate_budget.py over ~/gate2/ at each run
scp scripts/gate/{gate_budget.py,release_gate2.sh,branch_check.sh,branch_early.sh,early_check.py,gate_early_check.json,lint_spec_waits.py,selftest_gate_speed.py} runner:~/gate2/
ssh runner 'chmod +x ~/gate2/release_gate2.sh ~/gate2/branch_check.sh ~/gate2/branch_early.sh; cd ~/gate2 && python3 selftest_gate_speed.py'
# then: ~/gate2/release_gate2.sh <branch> --dry-run   (the ESTIMATE line)   and a first real  ~/gate2/branch_early.sh <small pushed branch>
```
Not validated on the runner: the real wall time of `branch_early.sh` (layout list cost vs `EARLY_LAYOUT_WORKERS`, default 6), the
`node_modules` link in `~/work/early-*`, the preview port (`EARLY_PREVIEW_PORT`, 4191), the limit values from real history.
