# Gate 2 runbook - release 2.11.0 on `release/2111`

Prepared on the workstation only (git and files, no runner use) while gate 1 (2.10.1, `release/2101` @ `3370bd704`) owned the runner.
Nothing below has been run yet. **Start only after the lead says gate 1 is finished and its results are saved.**

`release/2111` = `origin/integ/2111` @ `8e557adae` (17 pilot branches on top of `integ/2102`) + a merge of `origin/release/2101`
(`3370bd704`, the 2.10.1 prep and its UI bundle) + the 2.11.0 release prep (version, bilingual CHANGELOG, release notes, ROADMAP row,
DOCS / DOCS_HE, API inventory header). Migrations 0001..0145, contiguous. The UI bundles in `smplwise_vms/www` and
`smplwise_vms/www-public` on the branch are still the **2.10.1 build** - they must be rebuilt for 2.11.0 before the gate (step 3).

Conventions: `runner` below is the SSH alias / config of the runner (host, user and key live in `private/dashboard/config.json` and
`secrets/`; never paste them into chat, commits or this file). Read-only checks can go through
`py -3.12 private/handoff-package/tools-1018/rr.py "<read-only command>"`. Paths on the runner: repo clone `~/smplwisebms`, worktrees
`~/work/*`, results `~/smplwise-results/`, gate entry `~/release_gate.sh` (+ `release_gate.py`, `gate_baselines.json` next to it).

## 0. Hands off (until the lead's go)

- Never delete or clean `~/work/gate-release-2101`, `~/smplwise-results/gate_release_2101_*` (`.json`, `.md`, `.logs/`) or `gate_status.json`
  before the lead confirms gate 1 is finished **and saved**.
- `~/gate_clean.sh` keeps every `gate-*` worktree, but it deletes all `~/smplwise-results/gate_*.logs` except the **two newest**. Gate 1's logs
  survive the pre-clean of gate 2 and its post-clean (gate 2 + gate 1 are the two newest) - but any extra gate run in between (for example the
  GATEEFF v2 shadow run) would push them out. Copy gate 1's results off the runner first if they are needed later.
- Only the lead pushes `main` and tags. This runbook pushes `release/2111` only.

## 1. Pre-checks (read-only)

```
# gate 1 is final (state pass / fail / error, branch release/2101) and nothing else runs
py -3.12 private/handoff-package/tools-1018/rr.py "python3 -c \"import json,os;d=json.load(open(os.path.expanduser('~/smplwise-results/gate_status.json')));print(d.get('branch'),d.get('state'),d.get('phase'))\""
py -3.12 private/handoff-package/tools-1018/rr.py "ps -eo pid,etimes,args | grep -E 'release_gate|waitgate|playwright|pytest|vite' | grep -v grep | cut -c1-140"
# no pending-gate flag, no gate / test lock held
py -3.12 private/handoff-package/tools-1018/rr.py "ls -la ~/.gate-pending 2>&1; flock -n ~/.smplwise-gate.lock true && echo gate_lock_free; flock -n ~/.smplwise-tests.lock true && echo tests_lock_free"
# disk and load
py -3.12 private/handoff-package/tools-1018/rr.py "df -h / | tail -1; uptime; free -g | head -2; nproc"
```

Go / no-go:
- gate 1 state final; no `release_gate` / `waitgate*` process; `~/.gate-pending` absent (gate 1's waiter removes nothing - if it is still there after
  gate 1 ended, the lead removes it; it is only a flag); both locks free.
- **free disk at least 25 GB** (task floor). Note: `~/gate_clean.sh` itself refuses with `DISK_LOW` (exit 2) below **40 GB** free after cleaning,
  and the waiter below then does not start the gate. If free space is between 25 and 40 GB after the clean, the lead decides (free more space;
  do not edit the guard on the fly).
- load average below ~4 on 16 cores (no other agent jobs: the runner is exclusive to gates, owner decision 2026-10-21).
- if `origin/main` moved after gate 1 (2.10.1 released, `gate_baselines.json` refreshed from gate 1's `baseline_candidate`, report commits),
  merge `origin/main` into `release/2111` on the workstation first and push (`release/2101` is then a fast-forward of main, already merged here,
  so only the post-gate commits come in). The gate reads `scripts/gate/gate_baselines.json` from the branch under test.

## 2. Clean the runner

```
ssh runner '~/gate_clean.sh'          # conservative; never touches gate-*, rel-build, ~/smplwisebms; keeps the 2 newest gate_*.logs
```

Expected last lines: `free_mb_before=... free_mb_after=...`, the `df` line, exit 0 (no `DISK_LOW`).

## 3. Build the UI bundles and regenerate the API inventory (runner, then commit on the workstation)

Same recipe as 2.10.1 (`private/handoff-package/tools-2101/build_ui2101.sh` + `pullb2101.py`), branch changed to `release/2111`.

On the runner (script `~/build_ui2111.sh`, run with `bash ~/build_ui2111.sh`):

```
set -e
BASE=$HOME/smplwisebms; WT=$HOME/work/rel-build
cd $BASE && git fetch --all --prune -q
if [ -e "$WT/.git" ]; then git -C $WT reset -q --hard && git -C $WT clean -fdq smplwise_vms/www smplwise_vms/www-public && git -C $WT checkout -q -f --detach origin/release/2111; else git worktree add --detach $WT origin/release/2111 -q; fi
cd $WT; echo "SHA $(git rev-parse --short HEAD)"
if cmp -s frontend/package-lock.json $BASE/frontend/package-lock.json; then [ -e frontend/node_modules ] || ln -s $BASE/frontend/node_modules frontend/node_modules; else (cd frontend && npm ci >/dev/null 2>&1); fi
cd frontend && npm run build:addon > $WT/.build.log 2>&1 || { tail -15 $WT/.build.log; exit 1; }
cd $WT && $BASE/.venv/bin/python scripts/api_inventory.py && head -3 contracts/API_INVENTORY.md
cd $WT && tar czf /tmp/ui2111.tgz smplwise_vms/www smplwise_vms/www-public contracts/API_INVENTORY.md && ls -la /tmp/ui2111.tgz && tail -3 $WT/.build.log
```

- Command: `npm run build:addon` in `~/work/rel-build/frontend` (= `tsc --noEmit && vite build --outDir ../smplwise_vms/www --emptyOutDir && vite build -c vite.public.config.ts --outDir ../smplwise_vms/www-public --emptyOutDir`).
- Expected output: `smplwise_vms/www/index.html` + `smplwise_vms/www/assets/index-*.js` (+ `arx-sw.js` and the lazy chunks) and
  `smplwise_vms/www-public/index.html` + `smplwise_vms/www-public/assets/public-ticket-*.js` (+ `lang-ar-*.js`, `lang-ru-*.js`; `unit-public-ticket.spec.ts`
  checks those two chunks exist in a bundle built from this source). `tsc` errors fail the build: stop and report, do not patch on the runner.
- API inventory: `scripts/api_inventory.py` needs the backend dependencies (the runner venv; the workstation has no fastapi). The header must read
  `Version 2.11.0 · N routes` with N above 1157 (door windows, emergency, off-box, pacing, bridge key and other routes were added after 2.10.0 without a
  regeneration). Version strings are already 2.11.0 on the branch.

On the workstation: copy `/tmp/ui2111.tgz` back (as `pullb2101.py` did, with the runner config from `private/dashboard/config.json`), then in
`C:\cloude\smplwise-smart-work\release2111`: remove `smplwise_vms/www` and `smplwise_vms/www-public`, extract the archive, `git add -A smplwise_vms/www
smplwise_vms/www-public contracts/API_INVENTORY.md`, commit (message file UTF-8 without BOM, `git commit -F`):

```
build(ui): npm run build:addon on the runner - www + www-public rebuilt for 2.11.0; API inventory regenerated (N routes)
```

then `python scripts/release_check.py` (expect every item ok except "git tag for this version", which is informational) and
`git push origin release/2111`. Record the new head sha: the gate runs on `origin/release/2111` as the runner sees it.

## 4. Gate 2 command (v1 schedule, full tier L)

Gate 1 was started by `private/handoff-package/tools-2101/mkgate2101.sh`, whose waiter ran
`cd ~ && GATE_TOTAL_SECS=16200 ./release_gate.sh release/2101` (tier L and schedule v1 are the defaults). Gate 2 is the same with the branch
changed and the tier / schedule written out:

```
cat > ~/waitgate2111.sh <<'EOF'
#!/bin/bash
touch ~/.gate-pending
~/gate_clean.sh > ~/gate2111.preclean.out 2>&1; rc=$?
if [ $rc -ne 0 ]; then echo "DISK_LOW rc=$rc" > ~/gate2111.out; rm -f ~/.gate-pending; exit 2; fi
for i in $(seq 1 1200); do
  if flock -n -x ~/.smplwise-tests.lock true 2>/dev/null; then
    cd ~ && GATE_TOTAL_SECS=16200 ./release_gate.sh release/2111 --tier L --schedule v1 > ~/gate2111.out 2>&1
    if ! grep -q "holds ~/.smplwise-tests.lock" ~/gate2111.out; then break; fi
  fi
  sleep 15
done
rm -f ~/.gate-pending
~/gate_clean.sh > ~/gate2111.postclean.out 2>&1
EOF
chmod +x ~/waitgate2111.sh
setsid -f bash ~/waitgate2111.sh >/dev/null 2>&1 < /dev/null
sleep 5
ps -eo pid,etimes,args | grep -E 'waitgate2111|release_gate' | grep -v grep | cut -c1-120
tail -3 ~/gate2111.preclean.out
```

- `GATE_TOTAL_SECS=16200` (4.5 h; the floor for this train is 12000 s). Gate 1 alone ran at load ~44 on 16 cores; 2.11.0 has more tests (door windows,
  off-box, pacing, ECCACT, HMACACT), so do not lower it.
- The gate's own worktree is `~/work/gate-release-2111`; outputs `~/smplwise-results/gate_release_2111_<sha>.{json,md}` + `.logs/`, live phase in
  `gate_status.json`.
- Wait from the workstation (Git Bash) with a copy of `tools-2101/gatewait2101.sh` with `release/2101` replaced by `release/2111`.
- Do not start any other runner job while it runs (owner: runner exclusive during gates).

## 5. After the gate

- GREEN: the lead reads the verdict, refreshes `scripts/gate/gate_baselines.json` from the gate's `baseline_candidate`, and pushes / tags per the
  release authority. RED: classify each failure (stale test vs real) before any re-gate (owner rule 2026-10-20: a targeted run on the release head,
  owner approves in chat). Pixel baselines may need a reviewed regeneration for the intended UI changes (door-window screens, privacy-mask editor,
  doors widget), as in 2.10.0 (`test(pixel): regenerate ... baselines`).
- Optional, owner-approved plan of 2026-10-21: the GATEEFF v2 shadow run on the same sha after the v1 gate (`docs/release/GATE_V2_ROLLOUT.md` on
  `pilot/GATEEFF2-295`). It produces another `gate_*.logs` folder: save gate 1's logs first (section 0).
- Also after gate 1 (lead's list, not part of this runbook): restore the nightly cron line `0 2 * * *`, the mask soak rerun.

## 6. Checks already done on the workstation for `release/2111` (prep commit)

See the prep commit message for the exact list. Not run here: pytest, vitest / Playwright, `tsc`, the UI build, the API inventory regeneration,
a fresh-database migration run, the visual matrix. Gate 2 runs them.
