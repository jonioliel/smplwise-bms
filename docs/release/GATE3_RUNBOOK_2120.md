# Gate 3 runbook - release 2.12.0 on `release/2120b`

Prepared on the workstation only (git and files; nothing was run on the runner). Modelled on `docs/release/GATE2_RUNBOOK_2111.md`
(on `origin/release/2111`) and the targeted runbook of 2.11.1 (`docs/release/GATE_2112_TARGETED_RUNBOOK.md`). Planned start: 2026-10-22 08:00,
**only after the lead says the previous run is finished and its results are saved.** Never print hosts, IPs or secrets in logs, commits or this
file: `runner` is the ssh alias / config of the runner (host, user, key in `private/dashboard/config.json` and `secrets/`); read-only checks go
through `py -3.12 private/handoff-package/tools-1018/rr.py "<read-only command>"`. Runner paths: repo clone `~/smplwisebms`, worktrees `~/work/*`,
results `~/smplwise-results/`, gate entry `~/release_gate.sh` (+ `release_gate.py`, `gate_baselines.json`).

## 0. What `release/2120b` is

`release/2120b` replaces the earlier `release/2120` (b5c3963cd, cut from the old 2.11.1 prep; do not use it). It is `origin/main` @ `dd67a56f0`
(2.11.0, tag v2.11.0) + `--no-ff` merges, in this order (merged head in brackets):

| # | Branch (head) | Conflicts at the merge | Product change | Default |
|---|---|---|---|---|
| 1 | HMACACT2-295 (`97c13f812`) | none | `bridge.key.rotate` permission (system_admin only); trusted door calls refused (503 `bridge_key_rotating`) or held during an unfinished rotation | pause only when `bridge.key_rotation` is on and a rotation runs |
| 2 | W11TPL-295 (`0afdb83bb`) | none | `services/wa_template_send.py` + adapter seam `send_template` | switch OFF, `TEMPLATE_SEND_SUPPORTED` False, nothing calls it |
| 3 | F3A-295 (`c3a86e776`, stacks on DWFIX-295, already in main) | none | Fable review 3: DW-03 emergency lane, DW-05 release without permit, DW-06 simulated storm cap, G-01 acr5 switches gate the readback; 2.11.0 CHANGELOG lines corrected | nothing enabled; `LIVE_ENGINE_BUILT` False |
| 4 | F3B-295 (`fde4c1df9`) | none | K-01 "doors paused" line on the bridge key card (UI); WP-01..WP-05 WhatsApp budget bounds, port caps, admin refusal, audit rows | port parked, permission in no role |
| 5 | F3C-295 (`4c19b4ed6`, contains W11TPL) | none | DA-06 door-automation corroboration read, E-05 409 `duplicate_request`, TP-01/03/04 template sender, HA-03 pairing-code row text, G-03 pin | door automations locked; template send OFF |
| 6 | EXTID-295 (`890ac4612`) | none | bridge 0.9.6 V-01 impact check; 13.6 default-policy refusal (`service_identity_policy_default`), `service_policy_restricted` report, `BRIDGE_EXTENDED_REQUIRED = 0.9.6`; spec 1.2 docs; task card SCHEDIMPACT-295 | `EXTENDED_GO_LIVE_PERMITTED` False |
| 7 | LEASEBR-295 (`8a3c491dd`) | 5 files, see below | bridge 0.9.6 `lease_event` / `lease_request` services | Arx route locked (`capture_lease.GO_LIVE_PERMITTED` False, `MIN_BRIDGE_FOR_CAPTURE_LEASE` None) |
| 8 | LEASEARX-295 (`6aaa12b27`) | 1 file, see below | final lease service names, no kid on the lease wire, closed answers (`services/lease_answers.py`) | same lock |
| 9 | DOCS2111-295 (`862b912f7`) | 1 file, see below | Hebrew user guide pages 13, 48, 86, 87; bridge-key page; GUIDE_ALL_HE.html | docs only |

Conflicts and resolutions:
- LEASEBR-295 vs EXTID-295 (both bump the bridge to 0.9.6): `custom_components/smplwise_bridge/__init__.py` and its mirror (docstring item 14: kept EXTID's
  item 14, LEASEBR's became item 15), `const.py` and its mirror (both 0.9.6 comment blocks kept, LEASEBR's marked "combined with EXTID-295 in release 2.12.0
  into ONE bridge 0.9.6"; `VERSION = "0.9.6"` was identical on both sides), `tests/test_bridge_schedule_service.py` (the removed-services set takes LEASEBR's
  superset with `SERVICE_ROTATE`, `SERVICE_LEASE_EVENT`, `SERVICE_LEASE_REQUEST`; the `kid` schema assertions keep the G2FIX version). Manifest, card JS,
  test pins, `BRIDGE_EXTENDED_REQUIRED`, strings / translations / services.yaml merged without conflict. ONE bridge version, **0.9.6**: no released
  build ever shipped 0.9.6 (main is 0.9.5), every pin of both branches already says 0.9.6, and the add-on's `BRIDGE_EXTENDED_REQUIRED = 0.9.6` is then
  satisfied by a bridge that also carries the lease services. `scripts/sync_integration.py --check`: mirror up to date.
- LEASEARX-295 vs HMACACT2-295: `services/lease_events.py` - imports combined (`bridge_rotation as _rotation` + `ha_bridge, lease_answers, trusted_caller`);
  `_secret()` keeps LEASEARX's docstring first and HMACACT2's rotation pause (`NotSendable(PAUSE_CODE)`) right after it.
- DOCS2111-295 vs HMACACT2-295: `docs/user-guide/he/84-bridge-key_HE.md` - DOCS2111's sentence (with "not checked against a live bridge in 2.11.0") plus
  HMACACT2's new section on the permission and the door pause; `GUIDE_ALL_HE.html` regenerated with `python scripts/build_guide.py` (`--check` clean).
- One test-only reconciliation commit after the merges: `tests/test_bridge_lease_event.py::test_the_provisional_names_live_in_one_constant_each_and_nothing_else_spells_them`
  (LEASEBR) looked for the literal `"smplwise_bridge", "lease_event"` in `lease_events.py`, which LEASEARX replaced by constants; it now checks
  `BRIDGE_DOMAIN` / `SERVICE_EVENT` / `SERVICE_REQUEST` there against the bridge's `const.py`.

No branch adds a migration (still 0001..0145, contiguous). No new route (API inventory header stays 1196). Then the 2.12.0 prep commit (version in
`__init__.py`, `config.yaml`, `Dockerfile`, API inventory header; bilingual CHANGELOG section with a `[platform-restart]` line for bridge 0.9.6;
`docs/release/2.12.0-RELEASE-NOTES.md`; this file). **2.11.1 is NOT in this branch** (DDAREA, TESTDEBT3, SMALL3, MASKSWITCH, TEMPREP, HAUSER, BREAKUI):
step 2 merges `main` once 2.11.1 is released and tagged. The UI bundles in `smplwise_vms/www` and `www-public` are the 2.11.0 build and do not contain
the F3B / F3C card changes: rebuild in step 3 (mandatory for this release).

Owner actions at home (in the release notes; not part of the gate): update the bridge to 0.9.6 and restart Home Assistant once; before the extended-identity
supervised run, put the service user in a restricted group (until then the extended mode refuses by design).

Files most worth a targeted look in a red gate (all changed or added by this release):
backend - `test_bridge_key_pause_295.py`, `test_bridge_key_rotation_295.py`, `test_bridge_key_activation_295.py`, `test_bridge_lease_event.py`,
`test_lease_wire_closed_295.py`, `test_capture_lease_events.py`, `test_capture_lease_review_fixes.py`, `test_bridge_080.py`, `test_bridge_config_drift.py`,
`test_bridge_media_players.py`, `test_bridge_media_policy.py`, `test_bridge_runnable.py`, `test_bridge_schedule_service.py`, `test_bridge_service_identity.py`,
`test_bridge_stream_source.py`, `test_lovelace_card.py`, `test_extid_followups.py`, `test_service_identity_extended.py`, `test_service_identity_runnable.py`,
`test_door_automation_295.py`, `test_f3a_acr5_gate_295.py`, `test_f3a_doorwin_dw03_295.py`, `test_f3a_doorwin_dw05_295.py`, `test_f3a_doorwin_dw06_295.py`,
`test_f3c_e05_295.py`, `test_f3c_g03_295.py`, `test_f3c_ha03_295.py`, `test_f3c_tpl_295.py`, `test_wa_pacing.py`, `test_wa_template_send_w11.py`;
plus RBAC / role tests (new system permission `bridge.key.rotate`), `test_harden271_backup_keys.py`, `test_service_identity_remote_kill.py`,
`test_version.py`, `test_release_notes_marker.py`, the user-guide and docs consistency tests, the API inventory check;
frontend - `frontend/tests/unit-bridge-key.spec.ts` (vitest) and the Playwright specs that render the bridge key card / system diagnostics
(the pixel lane may flag the card's new pairing-code text).

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
cd C:\cloude\smplwise-smart-work\release2120b
git fetch origin --prune
git rev-list --count release/2120b..origin/main         # 0 = nothing to do
git merge --no-ff origin/main -m "merge origin/main into release/2120b"   # only if the count is above 0
```

2.11.0 and 2.11.1 may have been released and tagged by then, and `gate_baselines.json` refreshed from a gate's `baseline_candidate`; the gate reads
`scripts/gate/gate_baselines.json` from the branch under test, so main's refresh must be in. Resolve any conflict in the version files in favour of
2.12.0 (CHANGELOG: keep the 2.12.0 section on top of 2.11.1 and 2.11.0). Re-run `python scripts/release_check.py` and push `release/2120b`. If the
count was 0, record "main unchanged" in the results note.

Expected when 2.11.1 comes in: conflicts in `config.yaml`, `Dockerfile`, `smplwise/__init__.py`, the API inventory header (keep 2.12.0), the CHANGELOG
(2.12.0 section first, then 2.11.1, then 2.11.0) and the UI bundles (take either side, step 3 rebuilds them). 2.11.1 does not change the bridge: any
bridge file or pin must stay at 0.9.6 (`python scripts/sync_integration.py --check`). If `docs/user-guide/he/*` changed on both sides, regenerate
`GUIDE_ALL_HE.html` with `python scripts/build_guide.py` and check `--check`. Migrations must stay contiguous (2.11.1 adds none as of its prep).
Then replace "2.11.1 is NOT in this branch" in section 0 and in the release notes' header with the merged 2.11.1 tag.

## 3. Clean the runner, then build the UI bundles and regenerate the API inventory

```
ssh runner '~/gate_clean.sh'          # never touches gate-*, rel-build, ~/smplwisebms; keeps the 2 newest gate_*.logs. Expect free_mb_before/after, exit 0
```

On the runner (script `~/build_ui2120.sh`, `bash ~/build_ui2120.sh`; same recipe as `build_ui2101.sh` with the branch changed):

```
set -e
BASE=$HOME/smplwisebms; WT=$HOME/work/rel-build
cd $BASE && git fetch --all --prune -q
if [ -e "$WT/.git" ]; then git -C $WT reset -q --hard && git -C $WT clean -fdq smplwise_vms/www smplwise_vms/www-public && git -C $WT checkout -q -f --detach origin/release/2120b; else git worktree add --detach $WT origin/release/2120b -q; fi
cd $WT; echo "SHA $(git rev-parse --short HEAD)"
if cmp -s frontend/package-lock.json $BASE/frontend/package-lock.json; then [ -e frontend/node_modules ] || ln -s $BASE/frontend/node_modules frontend/node_modules; else (cd frontend && npm ci >/dev/null 2>&1); fi
cd frontend && npm run build:addon > $WT/.build.log 2>&1 || { tail -15 $WT/.build.log; exit 1; }
cd $WT && $BASE/.venv/bin/python scripts/api_inventory.py && head -3 contracts/API_INVENTORY.md
cd $WT && tar czf /tmp/ui2120.tgz smplwise_vms/www smplwise_vms/www-public contracts/API_INVENTORY.md && ls -la /tmp/ui2120.tgz && tail -3 $WT/.build.log
```

- `npm run build:addon` = `tsc --noEmit && vite build --outDir ../smplwise_vms/www --emptyOutDir && vite build -c vite.public.config.ts --outDir ../smplwise_vms/www-public --emptyOutDir`.
  A `tsc` error fails the build: stop and report, do not patch on the runner.
- The inventory header must read `Version 2.12.0 · N routes` with N = 1196: no branch of this release adds a route (checked by
  grepping the router decorators in the merge diff) and 2.11.1 adds none as of its prep; a different number without a reason is a red flag: stop.

Copy `/tmp/ui2120.tgz` back (the `pullb2101.py` flow with the runner config from `private/dashboard/config.json`), then in
`C:\cloude\smplwise-smart-work\release2120b`: remove `smplwise_vms/www` and `smplwise_vms/www-public`, extract, `git add -A smplwise_vms/www
smplwise_vms/www-public contracts/API_INVENTORY.md`, commit (message file UTF-8 without BOM, `git commit -F`, trailer
`Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`):

```
build(ui): npm run build:addon on the runner - www + www-public rebuilt for 2.12.0; API inventory regenerated (N routes)
```

then `python scripts/release_check.py` (every item ok except the informational "git tag for this version"), `git push origin release/2120b`, and record the
head sha: the gate runs on `origin/release/2120b` exactly as the runner sees it. **Freeze the branch from here** (no more pushes) until the gate and any
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
    cd ~ && GATE_TOTAL_SECS=16200 ./release_gate.sh release/2120b --tier L --schedule v1 > ~/gate2120.out 2>&1
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
- The gate's own worktree is `~/work/gate-release-2120b`; outputs `~/smplwise-results/gate_release_2120b_<sha>.{json,md}` + `.logs/`, live phase in `gate_status.json`.
- Wait from the workstation (Git Bash) with a copy of `tools-2101/gatewait2101.sh`, `release/2101` replaced by `release/2120b` (and `review*` added).
- Nothing else runs on the runner meanwhile (owner decision 2026-10-21: the runner is exclusive to gates).

## 5. After the v1 gate

- GREEN: the lead reads the verdict, refreshes `scripts/gate/gate_baselines.json` from `baseline_candidate`, pushes / tags per the release authority.
  This runbook does not tag and does not push `main`.
- RED: classify each failure (stale test vs real) before anything else; stale tests are fixed test-only; the owner approves in chat a targeted run on
  the release head instead of a full re-gate (rule of 2026-10-20). Likely stale-test candidates for this release: tests that list the permission
  set of `system_admin` or the closed list of system permissions (a new entry `bridge.key.rotate`), docs / user-guide consistency tests, and
  door tests that assume door calls are never refused (the new refusal exists only while a rotation runs with the switch on).
- Pixel baselines: this release changes two texts on the bridge key card (the "doors paused" line only during a rotation, and the pairing-code row
  after a rotation); any other pixel failure is first compared with `docs/release/PIXEL_FAILURES_2026-10-21.md` (28 known stale `visual-matrix`
  baselines) before a regeneration is proposed.
- Other likely stale-test candidates: tests that pin the bridge version (must all read 0.9.6), the bridge's closed service list (now includes
  `lease_event` / `lease_request`), the extended-identity status shape (new `service_policy_restricted` and the `service_policy_default` step).

## 6. Optional: v2 shadow run on the same sha (only if the v2 gate is installed)

Condition: `docs/release/GATE_V2_ROLLOUT.md` on `origin/pilot/GATEEFF2-295` (head `2877de6f4`) has been executed through its sections 1-5 (backup, install,
verify, rollback rehearsed), i.e. the runner has `gate_policy.py`, `shadow_compare.py` and `selftest_gate.py`, and the self-test passed. If it is not
installed, skip this section; do not install it as part of this runbook. The v2 install is the lead's step and happens when the runner is idle, at
least 30 minutes before the 02:00 nightly.

Rules (rollout section 6): same sha for both runs (`git rev-parse origin/release/2120b` identical before the v1 run, before the v2 run and in both
reports); v1 first (the release decision), then v2; v1 must be a PASS to be a reference; no push to the branch in between.

```
ssh runner '~/gate_clean.sh; df -h / | tail -1; uptime'                # disk below 80 percent, load below 8
# A. reference = step 4 (use --full so that the comparison counts as evidence; GATE_TOTAL_SECS=12000 or more)
# A2. keep the v1 report: the v2 run overwrites the same file name
ssh runner 'R=~/smplwise-results; for e in json md; do cp -p $R/gate_release-2120b_<sha>.$e $R/gate_release-2120b_<sha>.v1.$e; done; cp -a $R/gate_release-2120b_<sha>.logs $R/gate_release-2120b_<sha>.v1.logs'
# B. shadow
ssh runner 'cd ~ && GATE_TOTAL_SECS=12000 ~/release_gate.sh release/2120b --tier L --full --schedule v2 > ~/gate_shadow.out 2>&1'
# C. compare (exit 0 = SAME)
ssh runner 'R=~/smplwise-results; python3 ~/shadow_compare.py $R/gate_release-2120b_<sha>.v1.json $R/gate_release-2120b_<sha>.json'
# D. after
ssh runner '~/gate_clean.sh; rm -f ~/.gate-pending'
```

(The report file name uses the branch with `/` replaced by `-`; check the actual name in `~/smplwise-results/` before the copy; the example above and the
one in the rollout document differ in how they spell it.) Read the comparison table, the `resources` line, the `schedule` line and both wall clocks
(AC1..AC6 of the rollout). The canary (rollout 6.4) and `--record` are separate steps: recording is the owner's decision in chat. The shadow run
produces another `gate_*.logs` folder: save the v1 logs first.

## 7. Cleanup

`~/gate_clean.sh` once at the end (keeps `gate-*` and `rel-build`); `rm -f ~/.gate-pending` if the waiter did not; no leftover process or lock; free disk reported.

## 8. Checks already done on the workstation for `release/2120b` (prep commit)

See the prep commit message for exact results. Workstation checks: `git diff --check` (origin/main..HEAD), `python scripts/release_check.py`,
`python scripts/sync_integration.py --check`, `python scripts/build_guide.py --check`, `py_compile` of every changed Python file, the bridge version-pin
grep (manifest, const, card, both copies, `BRIDGE_EXTENDED_REQUIRED` and every test pin say 0.9.6), the migration sequence (0001..0145, contiguous),
the code constants (no permit, switch default or `LIVE_ENGINE_BUILT` changed), and the backend test files changed by this release run locally with
fakes. NOT run here: the full pytest suite, vitest / Playwright, `tsc`, the UI build, the API inventory regeneration, a fresh-database migration run,
the visual matrix. The gate runs them.
