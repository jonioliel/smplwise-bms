# Release gate v2 rollout: install, shadow run, acceptance, nightly (GATEEFF2-295)

Status: runbook written 2026-10-21 while gate 1 (2.10.1) is running. NOTHING in this document has been executed on the runner
(NOT_RUN). Do not start any step before gate 1 has finished and `gate_status.json` shows a final state. Tooling under test is the branch
`pilot/GATEEFF-295` (head `256205472`, v2.10.0 merged) plus the files added by `pilot/GATEEFF2-295`. Host names, addresses and
credentials are deliberately absent: `runner` below is the ssh alias the repo already uses (`INSTALL_ON_RUNNER.md`).

Owner decision (2026-10-21): install after gate 1, run a shadow v2 gate on the same sha as gate 2, only then make v2 the default; the full
suite moves to the nightly; release gates become risk-tiered (`GATE_TIERS_V2.md`).

## 0. Facts the plan depends on (checked in the code)

1. `release_gate.sh` and `release_gate.py` both default `GATE_TOTAL_SECS` to 5400 s (90 min). Past gates took 138-186 min, so the lead's
   launch scripts must set it (the repo does not show where). **Every run below sets `GATE_TOTAL_SECS=12000` explicitly** (200 min). A v2
   gate is modelled at 85-95 min and would sit at the default limit; do not rely on it.
2. The policy layer is active from the first run after the install, in v1 too: failure lanes, base comparison for test-level FAILs
   (`GATE_BASE_VERIFY`, default on), managed quarantine, flaky counter, one-page summary, and the new verdict `review` (pixel lane). A
   `review` verdict writes `state: review` to `gate_status.json` and exits 1. **Wait scripts that stop on `pass|fail|error` only (for
   example `tools-2101/gatewait2101.sh`) will not stop on `review`**: add `review*` to their case list before the first gate after the
   install. `GATE_PIXEL_LANE=0` restores the old "pixel mismatch = FAIL" behaviour for one run.
3. Selection is automatic for tier L, but only while the newest full nightly on main finished within 48 h and ran at least 70 percent of
   the backend/preview/dev baselines. The nightlies of 10-16 .. 10-20 did not finish, so until a nightly finishes the gate runs the full
   tier and the report's `selection_policy` line says why. Use `--full` on every shadow-run gate anyway.
4. The nightly sets `GATE_SCHEDULE` itself (`SW_NIGHTLY_SCHEDULE`, default `v1`), runs from its own copy in `~/nightly-gate/`, and is not
   affected by `~/gate_schedule_evidence.json`.
5. `shadow_compare.py --record` writes the evidence only when: the reference is a v1 PASS, the shadow is a v2 pass/review, same sha, same
   tier, and the shadow ran the full tier (no selection). Anything else exits 2 and writes nothing.

## 1. Preconditions (all must hold; read-only checks)

```
ssh runner 'python3 - <<EOF
import json,os
d=json.load(open(os.path.expanduser("~/smplwise-results/gate_status.json")))
print("gate_status:", d.get("branch"), d.get("state"), d.get("phase"))
EOF
ls ~/.gate-pending ~/.nightly-pending 2>&1 | head -3; pgrep -af "release_gate.py|nightly_tests.sh|playwright|pytest" | head -5; uptime; df -h / | tail -1'
```

Go only if: state is `pass`, `fail`, `error` or `review` (not `running`); no `.gate-pending` / `.nightly-pending`; the pgrep line is empty; load
below 8; disk below 80 percent (else `~/runner_cleanup.sh` first, dry run, then `--apply` on the lead's word). Check the cron table is not
about to start the nightly (02:00 Asia/Jerusalem): install at least 30 minutes before it, or after it ended.

Also: gate 1's report and `LATEST_SUMMARY` copied somewhere safe (`~/smplwise-results/` is never touched by the install).

## 2. Backup (one directory, restored by one command)

```
ssh runner 'D=~/gate-backup-$(date +%Y%m%d-%H%M); mkdir -p $D $D/nightly-gate &&
  cp -p ~/release_gate.sh ~/release_gate.py ~/nightly_tests.sh ~/select_tests.py ~/shadow_compare.py ~/gate_baselines.json ~/gate_durations.json ~/selftest_gate.py $D/ 2>/dev/null;
  cp -p ~/nightly-gate/* $D/nightly-gate/ 2>/dev/null; ls -l $D $D/nightly-gate; echo $D'
```

Write down the printed directory. If `ls` shows no `release_gate.py` in it, STOP (the runner layout is not what this runbook assumes).

## 3. Install

From a checkout of `pilot/GATEEFF2-295` (it contains `pilot/GATEEFF-295`); record its sha in the install note.

```
git rev-parse HEAD
md5sum scripts/gate/{release_gate.sh,release_gate.py,gate_policy.py,gate_quarantine.json,shadow_compare.py,select_tests.py,selftest_gate.py,gate_baselines.json,gate_durations.json,nightly_tests.sh,rollback_gate_install.sh} > /tmp/install.md5

scp scripts/gate/{release_gate.sh,release_gate.py,gate_policy.py,gate_quarantine.json,shadow_compare.py,select_tests.py,selftest_gate.py,gate_baselines.json,gate_durations.json,rollback_gate_install.sh} runner:~/
scp scripts/gate/{release_gate.py,gate_policy.py,gate_baselines.json,gate_durations.json} runner:~/nightly-gate/
scp scripts/gate/nightly_tests.sh runner:~/
ssh runner 'chmod +x ~/release_gate.sh ~/nightly_tests.sh ~/rollback_gate_install.sh'
```

Do NOT copy `gate_schedule_evidence.json` (it does not exist yet; its presence makes v2 the default) and do not copy `tier_domain_map.py`
(workstation helper). Do not touch the cron table in this step.

## 4. Verify (every line must be satisfied; paste the output into the install note)

```
# 4.1 the files on the runner are the files in the checkout
ssh runner 'cd ~ && md5sum release_gate.sh release_gate.py gate_policy.py gate_quarantine.json shadow_compare.py select_tests.py selftest_gate.py gate_baselines.json gate_durations.json nightly_tests.sh rollback_gate_install.sh' | diff - /tmp/install.md5 && echo MD5_OK
ssh runner 'cd ~/nightly-gate && md5sum release_gate.py gate_policy.py gate_baselines.json gate_durations.json'      # same sums as the lines above

# 4.2 self-test with the repo venv (fake suite in a temp dir; no real results, worktrees, ports or browsers)
ssh runner '~/smplwisebms/.venv/bin/python ~/selftest_gate.py | tail -3'                 # expect: SELFTEST PASSED, no NOT_RUN

# 4.3 nightly wiring, runs nothing
ssh runner '~/nightly_tests.sh --dry-run'                                                 # engine: ... present; the limits printed

# 4.4 engine estimates, runs nothing (any checkout; use the newest gate worktree)
ssh runner 'python3 ~/release_gate.py --plan --root ~/work/<an existing worktree of the branch> | tail -20'
ssh runner 'python3 ~/release_gate.py --help | head -5; python3 ~/gate_policy.py --help | head -3; ~/release_gate.sh --help | head -3'

# 4.5 the unit tests of the tooling, from a checkout of the same sha, idle runner only
ssh runner 'D=~/work/gateeff2-verify; git -C ~/smplwisebms fetch -q origin pilot/GATEEFF2-295 && git -C ~/smplwisebms worktree add --detach $D FETCH_HEAD &&
  cd $D/smplwise_vms/backend && ~/smplwisebms/.venv/bin/python -m pytest -o addopts= -q tests/test_gate_efficiency.py tests/test_gate_speed.py tests/test_select_tests.py tests/test_targeted_plan.py 2>&1 | tail -5'
ssh runner 'git -C ~/smplwisebms worktree remove --force ~/work/gateeff2-verify'

# 4.6 the quarantine file is valid and empty
ssh runner 'python3 -c "import sys,json,datetime; sys.path.insert(0,\"/home/sw\"); import gate_policy as p; q=p.load_quarantine(\"/home/sw/gate_quarantine.json\", datetime.date.today()); print(q[\"error\"] or \"ok\", len(q[\"entries\"]), q[\"invalid\"])"'
```

`/home/sw` in 4.6 is the runner's home as used by the repo scripts; replace it with `$HOME` if the account differs. Expected: `ok 0 []`.
If 4.5 fails because `~/smplwisebms` has no network or the worktree command is not how the runner does it, run the same pytest line
from any existing worktree of the branch; record which. Any failure in 4.1-4.6: run section 5 and report; do not start a gate.

## 5. Rollback (one command)

```
ssh runner '~/rollback_gate_install.sh'              # restores the newest ~/gate-backup-*
ssh runner '~/rollback_gate_install.sh --dry-run'    # the same, listing what it would do and changing nothing
```

It refuses while a gate or nightly runs, restores every backed-up file in `~/` and `~/nightly-gate/`, removes the files that did not exist
before (`gate_policy.py`, `gate_quarantine.json`, `gate_schedule_evidence.json`, and `select_tests.py` / `shadow_compare.py` when the
backup has none), prints the md5 of each restored file. Afterwards `ssh runner '~/nightly_tests.sh --dry-run'` must work. The script itself
stays on the runner (it was never in the backup). The old engine ignores unknown files, so a leftover is harmless.

Without a rollback, one behaviour at a time: `GATE_SCHEDULE=v1` (or `--schedule v1`), `--full`, `GATE_SELECT=off`, `GATE_BASE_VERIFY=0`,
`GATE_PIXEL_LANE=0`, `GATE_PREEXISTING=block`. Undo "v2 is the default": `ssh runner 'rm -f ~/gate_schedule_evidence.json'`.

Rehearse the rollback with `--dry-run` once right after the install and note the output; a rollback that was never tried is not a rollback.

## 6. Shadow run on the same sha as gate 2

Goal: prove that v2 reaches the same verdict as v1 on one identical sha, and measure the saved wall time, before anything becomes default.

### 6.1 Choose the sha
- The release candidate that gate 2 will test, frozen: a branch whose head will not move (create `release/<x>` and stop pushing to it). The
  shadow uses the SAME sha: `git rev-parse origin/<branch>` must print the same value before the v1 run, before the v2 run and in both
  reports (`shadow_compare.py` warns on a mismatch; `--record` refuses).
- Order: first the normal gate (v1, full) because it is the release decision; then the v2 shadow. The two cannot overlap (one gate lock),
  so budget about 3 h + 1.5-2 h on an idle runner. If the v1 gate is RED the sha cannot be a reference (`--record` needs a v1 PASS):
  fix test-only per the owner's targeted-run rule, then either re-gate the fixed sha on v1 or choose the next candidate. Do not "fix" the
  comparison by relaxing the check.

### 6.2 Commands

```
# before each run
ssh runner '~/gate_clean.sh; df -h / | tail -1; uptime'                 # the lead's cleanup script; disk below 80 percent, load below 8
ssh runner 'touch ~/.gate-pending'                                      # as the lead's launch scripts do; removed after the run

# A. reference: v1, full tier, the release gate itself
ssh runner 'cd ~ && GATE_TOTAL_SECS=12000 ~/release_gate.sh <branch> --tier L --full --schedule v1 --base <previous release tag> > ~/gate_ref.out 2>&1'

# A2. keep the v1 report: the v2 run writes the same file name for the same branch and sha
ssh runner 'R=~/smplwise-results; for e in json md; do cp -p $R/gate_<b>_<sha>.$e $R/gate_<b>_<sha>.v1.$e; done; cp -a $R/gate_<b>_<sha>.logs $R/gate_<b>_<sha>.v1.logs'

# B. shadow: v2, full tier, same sha (only if A is a pass)
ssh runner 'cd ~ && GATE_TOTAL_SECS=12000 ~/release_gate.sh <branch> --tier L --full --schedule v2 --base <previous release tag> > ~/gate_shadow.out 2>&1'

# C. compare (reads two reports, runs nothing)
ssh runner 'R=~/smplwise-results; python3 ~/shadow_compare.py $R/gate_<b>_<sha>.v1.json $R/gate_<b>_<sha>.json'    # exit 0 = SAME

# D. after the run
ssh runner '~/gate_clean.sh; rm -f ~/.gate-pending'
```

The report files are `gate_<branch>_<sha>.json|md` and `gate_<branch>_<sha>.logs/` (`<branch>` with `/` replaced by `-`). The second run of
the same branch and sha overwrites the first, which is why step A2 copies the v1 report and its logs before B starts; the comparison
reads the copy. (`cp -a` of the logs directory is a few hundred MB; the disk check of step 1 covers it.)

### 6.3 What to read
1. `shadow_compare.py` table: every category `OK`, verdict `SAME`.
2. The v2 report's `resources` line: min MemAvailable at least 2 GB and max load1 at most 24. Otherwise rerun B with `GATE_PW_SLOTS=10`
   (that run replaces the first as the shadow).
3. The v2 report's `schedule` line says `v2`; the pool jobs table lists every preview, dev, pixel, fixture and visual job; `/dev/shm` is
   empty afterwards (`ls -d /dev/shm/smplwise-gate-*`).
4. Wall clock of both runs (report header): feeds acceptance criterion AC3.

### 6.4 Canary: prove that v2 does not hide a real failure (one extra run, short)
A green-versus-green comparison cannot show detection. So, on the runner while idle, run a throwaway branch cut from the shadow sha:
`pilot/GATEEFF2-canary` with ONE commit that (a) adds a backend test `tests/test_gate_canary.py` asserting `False`, (b) adds a spec
`frontend/tests/unit-gate-canary.spec.ts` with a failing `expect`, and (c) inverts one assertion of one existing, fast, domain test (a
real test that passes on the base). Never merged, deleted afterwards. Run
`GATE_TOTAL_SECS=12000 ~/release_gate.sh pilot/GATEEFF2-canary --tier L --select-base <shadow sha> --base <shadow sha> --schedule v2`.
Expected: verdict `fail`; the three tests listed as `FAIL` (not `QUARANTINED`, not `PREEXISTING`: they pass, or do not exist, on the base);
the retry alone ran; `gate_quarantine.json` untouched. NOT_RUN today. This run is selection-sized (about 25-40 min on v2).

### 6.5 Record
Only when 6.3 holds and the canary behaved:
```
ssh runner 'python3 ~/shadow_compare.py ~/smplwise-results/gate_<b>_<sha>.v1.json ~/smplwise-results/gate_<b>_<sha>.json --record ~/gate_schedule_evidence.json'
```
This writes `~/gate_schedule_evidence.json`; from the next run the release gate defaults to v2 (`schedule_why` says so, `--schedule v1`
still wins). Copy the file into `scripts/gate/` on a reviewed commit so the decision is in git. The nightly does not follow it (section 9).
**Recording is the owner's decision; do not run this line without his word in chat.**

## 7. Acceptance criteria for making v2 the default

All must hold on the shadow sha (and AC9-AC10 afterwards). Source of each number is named; none of them is a guess.

| # | Criterion | How it is measured | Pass |
|---|---|---|---|
| AC1 | Same verdict on the same sha | `shadow_compare.py` exit 0; evidence recorded | SAME |
| AC2 | **Zero missed real failures versus v1** | (a) no FAIL/QUARANTINED/PIXEL_REVIEW item in the v2 report that is not in the v1 report, and every v1 FAIL/FLAKY id that is red in v1 is executed in v2 (compare the `pw_*.json` / `backend_s*.xml` test lists of both log directories); (b) per-category passed counts equal within the flaky + known slack (`shadow_compare.py`); (c) the structural unit test `test_v2_jobs_cover_exactly_the_v1_specs_and_projects` and the backend split tests green; (d) the canary of 6.4 failed as expected with FAIL classification | all four |
| AC3 | Wall clock saved | v2 report wall versus v1 report wall of the same sha, both on an idle runner, `GATE_TOTAL_SECS` not hit | v2 at most 65 percent of v1 (model: 85-95 min against 138-186); if less than 80 percent saved the default is not worth the risk, report and stop |
| AC4 | Stability under the higher parallel load | FLAKY items in v2 that are not FLAKY in v1 | at most 5, each passes alone; no timing-bound test fails alone |
| AC5 | Runner health during v2 | the report's `resources` line | min MemAvailable at least 2 GB, max load1 at most 24, no leftover `/dev/shm/smplwise-gate-*`, no orphan Chromium |
| AC6 | Tooling healthy | `selftest_gate.py` PASSED; the four pytest files of 4.5 green on the runner; `--plan` works | all |
| AC7 | Nothing deleted or weakened | `git diff --name-status <previous release tag>...<sha> -- 'smplwise_vms/backend/tests/test_*.py' 'frontend/tests/*.spec.ts'` | no `D` line; every `M` line is a reviewed stale-test fix (listed in the integration notes); baseline counts per category (`gate_baselines.json`) not below 99 percent |
| AC8 | Quarantine hygiene | `gate_quarantine.json` | 0 expired or invalid entries, every entry has owner + ticket, at most 10 entries, none for a test listed in `GATE_QUARANTINE_SEED.md` section D |
| AC9 | Rollback rehearsed | `~/rollback_gate_install.sh --dry-run` output in the install note | done |
| AC10 | Confirmation on the first real v2 release gate | counts per category at least 99 percent of `gate_baselines.json` (full tier), same FLAKY/resource limits as AC4/AC5, no red that a later targeted run or the nightly shows as a real defect the gate passed | if a real failure that v2 passed is found anywhere (nightly, v1, post-release), set the default back to v1 the same day (`rm ~/gate_schedule_evidence.json`) and open a ticket |

Order of decisions (owner decides each): (1) AC1-AC9 hold, lead recommends, owner says yes: record evidence, release gates default v2.
(2) AC10 holds on the first v2 release gate: nightly moves to v2 (section 9). (3) Selection as the standing rule for S/M releases: only
after ten consecutive nightlies finished and `select_tests.py audit` shows zero dropped nightly reds over the last ten selection runs.
`GATE_SPEED.md` asks for two green v2 gates before the default; this document proposes one SAME shadow run plus AC10 on the first release
gate, and leaves the stricter reading to the owner.

## 8. Weekly review (15 minutes, the lead, Sunday morning)

Read the newest `LATEST_SUMMARY.md` and the nightly summary: expired/renewing quarantine entries (none today; calendar: first possible
expiry 2026-11-04), the flaky counter (`(x2)` and above = a fix ticket, `GATE_QUARANTINE_SEED.md` section C), the `unused entries` line, the
selection audit file, disk (below 80 percent), and whether the nightly finished.

## 9. Nightly full-suite schedule (proposal)

Today (installed): cron `0 2 * * *` Asia/Jerusalem, main, tier L v1, hard limit 240 min, engine budget 225 min, no selection; the six
nightlies of 10-15 .. 10-20 stopped at 117 min with the backend cut (3,564 of about 12,000 tests on 10-20) and the 2.9.3 nightly ended FAIL.

| When | What | Why |
|---|---|---|
| Daily 02:00 Asia/Jerusalem (unchanged time) | `nightly_tests.sh` on main, full tier L, no selection, `GATE_PIXEL_LANE=0`, `GATE_BASE_VERIFY=0` (already the script's setting). Schedule v1 until AC10 holds, then `SW_NIGHTLY_SCHEDULE=v2` in the cron line | Machine is idle; releases are gated in the day. v2 brings it to about 85-110 min, so it ends before 04:00-05:00 instead of about 09:00 |
| Budget | keep `SW_NIGHTLY_MAX_MIN=240`, `SW_NIGHTLY_BRANCH_MAX_MIN=225` until three v2 nightlies finish; then lower to 150 / 135 so a stuck run is cut early | the nightly has to FINISH to enable selection (rule G2 in `GATE_TIERS_V2.md`) |
| Daily 07:30 (lead, 5 minutes) | read the nightly summary; any new red is a ticket the same day; a red in a test that a recent selection run dropped is a missed-selection incident (selection audit file) | the safety net of the tiers |
| After every release that used selection | run `~/nightly_tests.sh` on demand on the released main the same evening if the cron run is more than 12 h away | a small release is never based on a stale full result (TEST_POLICY) |
| Saturday 02:00 (Israeli weekend, runner idle) | the nightly plus `--visual-block` variant of the visual matrix, once a week, report only | the matrix is warn-only in gates; one blocking weekly look catches slow drift |
| Never | a release gate and the nightly overlapping | one lock; the nightly waits up to 3 h and yields to `.gate-pending`; a v1 nightly that runs to 09:00 collides with the morning gate, a v2 one does not |

Install the nightly change last, and only on an idle runner; the cron line is a lead-owned edit (`crontab -e` on the runner) and is NOT part
of section 3. Roll it back by restoring the previous line.

## 10. NOT_RUN and unverified in this document

- Everything on the runner: backup, install, md5, selftest, the four pytest files, `--plan`, the shadow run, the canary, the evidence
  file, the cron change. NOT_RUN.
- The location of `~/gate_clean.sh`, `~/smplwisebms` as the runner's git directory for `worktree add`, `GATE_TOTAL_SECS` being set by the
  lead's launch scripts: taken from the repo documents and the lead's memory notes, not verified on the runner.
- v2 wall time (85-95 min) is the model of `GATE_SPEED.md`; v2 has never run on the runner. The DB template saving was measured only by an
  in-process benchmark (about 2.1 s per fresh app), not by a full backend run.
- Gate 1's own report was not available; `RELEASE_2101_REPORT_DRAFT.md` does not exist yet.
- `tier_domain_map.py`, `rollback_gate_install.sh`: syntax- and sandbox-tested on the workstation only (`rollback_gate_install.sh` against a temp HOME,
  `tier_domain_map.py report/paths/diff`); the repo unit-test suites were not run.
