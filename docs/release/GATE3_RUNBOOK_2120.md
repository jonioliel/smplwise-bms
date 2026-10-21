# Gate 3 runbook - release 2.12.0 on `release/2120`

Prepared on the workstation only (git and files; nothing was run on the runner). Modelled on `docs/release/GATE2_RUNBOOK_2111.md`
(on `origin/release/2111`) and the targeted runbook of 2.11.1 (`docs/release/GATE_2112_TARGETED_RUNBOOK.md`). Planned start: 2026-10-22 08:00,
**only after the lead says the previous run is finished and its results are saved.** Never print hosts, IPs or secrets in logs, commits or this
file: `runner` is the ssh alias / config of the runner (host, user, key in `private/dashboard/config.json` and `secrets/`); read-only checks go
through `py -3.12 private/handoff-package/tools-1018/rr.py "<read-only command>"`. Runner paths: repo clone `~/smplwisebms`, worktrees `~/work/*`,
results `~/smplwise-results/`, gate entry `~/release_gate.sh` (+ `release_gate.py`, `gate_baselines.json`).

## 0. What `release/2120` is

`release/2120` = `origin/release/2112` @ `358cf0edd` (2.11.1 prep) + `--no-ff` merges of `origin/pilot/HMACACT2-295` (`97c13f812`) and
`origin/pilot/W11TPL-295` (`0afdb83bb`), no conflicts, no migration in either (still 0001..0145, contiguous) + the 2.12.0 prep commit
(version in `__init__.py`, `config.yaml`, `Dockerfile`, API inventory header; bilingual CHANGELOG section; `docs/release/2.12.0-RELEASE-NOTES.md`; this file).
Not yet in: `pilot/F3A-295`, `pilot/F3B-295` (Fable review 3 fixes, being written). The lead merges them into `release/2120` on the workstation
and pushes BEFORE step 3 (UI build), then adds their items to the CHANGELOG and release notes. The UI bundles in `smplwise_vms/www` and
`www-public` are still the 2.11.0 / 2.11.1 build: rebuild in step 3.

| Branch | Product change | Default |
|---|---|---|
| HMACACT2-295 | `bridge.key.rotate` permission (system_admin only); trusted door calls refused (503 `bridge_key_rotating`) or held during an unfinished rotation | pause only when `bridge.key_rotation` is on and a rotation runs |
| W11TPL-295 | `services/wa_template_send.py` + adapter seam `send_template` | OFF, permit False, nothing calls it |

Files most worth a targeted look in a red gate: `tests/test_bridge_key_pause_295.py`, `tests/test_bridge_key_rotation_295.py`,
`tests/test_wa_template_send_w11.py`, RBAC / role tests (a new system permission), the user-guide and docs consistency tests, `test_version.py`,
`test_release_notes_marker.py`, the API inventory check (no new route: header count stays 1196).

## 1. Pre-checks (read-only)

```
py -3.12 private/handoff-package/tools-1018/rr.py "python3 -c \"import json,os;d=json.load(open(os.path.expanduser('~/smplwise-results/gate_status.json')));print(d.get('branch'),d.get('state'),d.get('phase'))\""
py -3.12 private/handoff-package/tools-1018/rr.py "ps -eo pid,etimes,args | grep -E 'release_gate|waitgate|nightly_tests|playwright|pytest|vite' | grep -v grep | cut -c1-140"
py -3.12 private/handoff-package/tools-1018/rr.py "ls -la ~/.gate-pending ~/.nightly-pending 2>&1; flock -n ~/.smplwise-gate.lock true && echo gate_lock_free; flock -n ~/.smplwise-tests.lock true && echo tests_lock_free"
py -3.12 private/handoff-package/tools-1018/rr.py "df -h / | tail -1; uptime; free -g | head -2; nproc"
```

Go / no-go: previous gate / targeted run final and its results saved (`~/gate_clean.sh` keeps only the two newest `gate_*.logs`: copy the
previous gate's results off first if needed, especially before a v2 shadow run); no gate / waiter / test process; no `.gate-pending`; both locks
free; **free disk at least 25 GB** (`~/gate_clean.sh` itself refuses with `DISK_LOW` below 40 GB after cleaning: then the lead decides, never edit the
guard); load below about 4 on 16 cores. Check the cron table: the nightly (02:00 Asia/Jerusalem) must not start during the gate.

## 2. Merge `main` again if it moved (workstation)

```
cd C:\cloude\smplwise-smart-work\release2120
git fetch origin --prune
git rev-list --count release/2120..origin/main         # 0 = nothing to do
git merge --no-ff origin/main -m "merge origin/main into release/2120"   # only if the count is above 0
```

2.11.0 and 2.11.1 may have been released and tagged by then, and `gate_baselines.json` refreshed from a gate's `baseline_candidate`; the gate reads
`scripts/gate/gate_baselines.json` from the branch under test, so main's refresh must be in. Resolve any conflict in the version files in favour of
2.12.0 (CHANGELOG: keep the 2.12.0 section on top of 2.11.1 and 2.11.0). Re-run `python scripts/release_check.py` and push `release/2120`. If the
count was 0, record "main unchanged" in the results note.

## 3. Clean the runner, then build the UI bundles and regenerate the API inventory

```
ssh runner '~/gate_clean.sh'          # never touches gate-*, rel-build, ~/smplwisebms; keeps the 2 newest gate_*.logs. Expect free_mb_before/after, exit 0
```

On the runner (script `~/build_ui2120.sh`, `bash ~/build_ui2120.sh`; same recipe as `build_ui2101.sh` with the branch changed):

```
set -e
BASE=$HOME/smplwisebms; WT=$HOME/work/rel-build
cd $BASE && git fetch --all --prune -q
if [ -e "$WT/.git" ]; then git -C $WT reset -q --hard && git -C $WT clean -fdq smplwise_vms/www smplwise_vms/www-public && git -C $WT checkout -q -f --detach origin/release/2120; else git worktree add --detach $WT origin/release/2120 -q; fi
cd $WT; echo "SHA $(git rev-parse --short HEAD)"
if cmp -s frontend/package-lock.json $BASE/frontend/package-lock.json; then [ -e frontend/node_modules ] || ln -s $BASE/frontend/node_modules frontend/node_modules; else (cd frontend && npm ci >/dev/null 2>&1); fi
cd frontend && npm run build:addon > $WT/.build.log 2>&1 || { tail -15 $WT/.build.log; exit 1; }
cd $WT && $BASE/.venv/bin/python scripts/api_inventory.py && head -3 contracts/API_INVENTORY.md
cd $WT && tar czf /tmp/ui2120.tgz smplwise_vms/www smplwise_vms/www-public contracts/API_INVENTORY.md && ls -la /tmp/ui2120.tgz && tail -3 $WT/.build.log
```

- `npm run build:addon` = `tsc --noEmit && vite build --outDir ../smplwise_vms/www --emptyOutDir && vite build -c vite.public.config.ts --outDir ../smplwise_vms/www-public --emptyOutDir`.
  A `tsc` error fails the build: stop and report, do not patch on the runner.
- The inventory header must read `Version 2.12.0 · N routes` with N equal to the 2.11.1 count (1196) unless F3A / F3B add routes (then N is
  that count plus theirs; a different number without a reason is a red flag: stop).

Copy `/tmp/ui2120.tgz` back (the `pullb2101.py` flow with the runner config from `private/dashboard/config.json`), then in
`C:\cloude\smplwise-smart-work\release2120`: remove `smplwise_vms/www` and `smplwise_vms/www-public`, extract, `git add -A smplwise_vms/www
smplwise_vms/www-public contracts/API_INVENTORY.md`, commit (message file UTF-8 without BOM, `git commit -F`, trailer
`Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`):

```
build(ui): npm run build:addon on the runner - www + www-public rebuilt for 2.12.0; API inventory regenerated (N routes)
```

then `python scripts/release_check.py` (every item ok except the informational "git tag for this version"), `git push origin release/2120`, and record the
head sha: the gate runs on `origin/release/2120` exactly as the runner sees it. **Freeze the branch from here** (no more pushes) until the gate and any
shadow run end.

## 4. Full gate command (v1 schedule, full tier L)

```
cat > ~/waitgate2120.sh <<'EOF'
#!/bin/bash
touch ~/.gate-pending
~/gate_clean.sh > ~/gate2120.preclean.out 2>&1; rc=$?
if [ $rc -ne 0 ]; then echo "DISK_LOW rc=$rc" > ~/gate2120.out; rm -f ~/.gate-pending; exit 2; fi
for i in $(seq 1 1200); do
  if flock -n -x ~/.smplwise-tests.lock true 2>/dev/null; then
    cd ~ && GATE_TOTAL_SECS=16200 ./release_gate.sh release/2120 --tier L --schedule v1 > ~/gate2120.out 2>&1
    if ! grep -q "holds ~/.smplwise-tests.lock" ~/gate2120.out; then break; fi
  fi
  sleep 15
done
rm -f ~/.gate-pending
~/gate_clean.sh > ~/gate2120.postclean.out 2>&1
EOF
chmod +x ~/waitgate2120.sh
setsid -f bash ~/waitgate2120.sh >/dev/null 2>&1 < /dev/null
sleep 5
ps -eo pid,etimes,args | grep -E 'waitgate2120|release_gate' | grep -v grep | cut -c1-120
tail -3 ~/gate2120.preclean.out
```

- `GATE_TOTAL_SECS=16200` (4.5 h; the engine default of 5400 s is too low, see `GATE_V2_ROLLOUT.md` fact 1). If the GATEEFF2 policy layer has been
  installed on the runner, the verdict `review` (pixel lane) exists: the wait script must stop on `pass|fail|error|review`
  (`tools-2101/gatewait2101.sh` stops on the first three only; add `review*`). `GATE_PIXEL_LANE=0` restores "pixel mismatch = FAIL" for one run.
  Selection is automatic for tier L only while a recent full nightly finished; otherwise the full tier runs. Add `--full` if the lead wants the
  full tier without doubt.
- Optional `--base <previous release tag>` (v2.11.1 once tagged, else v2.11.0).
- The gate's own worktree is `~/work/gate-release-2120`; outputs `~/smplwise-results/gate_release_2120_<sha>.{json,md}` + `.logs/`, live phase in `gate_status.json`.
- Wait from the workstation (Git Bash) with a copy of `tools-2101/gatewait2101.sh`, `release/2101` replaced by `release/2120` (and `review*` added).
- Nothing else runs on the runner meanwhile (owner decision 2026-10-21: the runner is exclusive to gates).

## 5. After the v1 gate

- GREEN: the lead reads the verdict, refreshes `scripts/gate/gate_baselines.json` from `baseline_candidate`, pushes / tags per the release authority.
  This runbook does not tag and does not push `main`.
- RED: classify each failure (stale test vs real) before anything else; stale tests are fixed test-only; the owner approves in chat a targeted run on
  the release head instead of a full re-gate (rule of 2026-10-20). Likely stale-test candidates for this release: tests that list the permission
  set of `system_admin` or the closed list of system permissions (a new entry `bridge.key.rotate`), docs / user-guide consistency tests, and
  door tests that assume door calls are never refused (the new refusal exists only while a rotation runs with the switch on).
- Pixel baselines: this release changes no screen, so any pixel failure is first compared with `docs/release/PIXEL_FAILURES_2026-10-21.md`
  (28 known stale `visual-matrix` baselines) before a regeneration is proposed.

## 6. Optional: v2 shadow run on the same sha (only if the v2 gate is installed)

Condition: `docs/release/GATE_V2_ROLLOUT.md` on `origin/pilot/GATEEFF2-295` (head `2877de6f4`) has been executed through its sections 1-5 (backup, install,
verify, rollback rehearsed), i.e. the runner has `gate_policy.py`, `shadow_compare.py` and `selftest_gate.py`, and the self-test passed. If it is not
installed, skip this section; do not install it as part of this runbook. The v2 install is the lead's step and happens when the runner is idle, at
least 30 minutes before the 02:00 nightly.

Rules (rollout section 6): same sha for both runs (`git rev-parse origin/release/2120` identical before the v1 run, before the v2 run and in both
reports); v1 first (the release decision), then v2; v1 must be a PASS to be a reference; no push to the branch in between.

```
ssh runner '~/gate_clean.sh; df -h / | tail -1; uptime'                # disk below 80 percent, load below 8
# A. reference = step 4 (use --full so that the comparison counts as evidence; GATE_TOTAL_SECS=12000 or more)
# A2. keep the v1 report: the v2 run overwrites the same file name
ssh runner 'R=~/smplwise-results; for e in json md; do cp -p $R/gate_release-2120_<sha>.$e $R/gate_release-2120_<sha>.v1.$e; done; cp -a $R/gate_release-2120_<sha>.logs $R/gate_release-2120_<sha>.v1.logs'
# B. shadow
ssh runner 'cd ~ && GATE_TOTAL_SECS=12000 ~/release_gate.sh release/2120 --tier L --full --schedule v2 > ~/gate_shadow.out 2>&1'
# C. compare (exit 0 = SAME)
ssh runner 'R=~/smplwise-results; python3 ~/shadow_compare.py $R/gate_release-2120_<sha>.v1.json $R/gate_release-2120_<sha>.json'
# D. after
ssh runner '~/gate_clean.sh; rm -f ~/.gate-pending'
```

(The report file name uses the branch with `/` replaced by `-`; check the actual name in `~/smplwise-results/` before the copy; the example above and the
one in the rollout document differ in how they spell it.) Read the comparison table, the `resources` line, the `schedule` line and both wall clocks
(AC1..AC6 of the rollout). The canary (rollout 6.4) and `--record` are separate steps: recording is the owner's decision in chat. The shadow run
produces another `gate_*.logs` folder: save the v1 logs first.

## 7. Cleanup

`~/gate_clean.sh` once at the end (keeps `gate-*` and `rel-build`); `rm -f ~/.gate-pending` if the waiter did not; no leftover process or lock; free disk reported.

## 8. Checks already done on the workstation for `release/2120` (prep commit)

See the prep commit message and the final report of the prep. NOT run here: pytest, vitest / Playwright, `tsc`, the UI build, the API inventory
regeneration, a fresh-database migration run, the visual matrix. The gate runs them.
