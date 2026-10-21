# Targeted verification runbook - release 2.11.1 on `release/2112`

Prepared on the workstation only (git and files; nothing was run on the runner). Owner decision 2026-10-21: 2.11.1 is a SMALL release
right after 2.11.0 and is verified by the TARGETED run below, not by a full gate. **Start only after gate 2 (2.11.0 on `release/2111`)
is finished, its results are saved, and the lead says go.** Never print hosts, IPs or secrets in logs, commits or this file; the runner
is reached through the usual helper (`private/handoff-package/tools-1018/rr.py` / `runsh.py`) with its own config.

`release/2112` = `origin/release/2111` @ `5cbfe7df4` + merges of `pilot/DDAREA-295` (`c4522680a`), `pilot/TESTDEBT3-295` (`4bd0d96bc`),
`pilot/SMALL3-295` (`f0e492a4e`; also carries `bdbaf7868`), all three without conflicts + the 2.11.1 prep commit (version, CHANGELOG,
release notes, this runbook). Not included: HMACACT2, W11TPL. No migration, no new route (API inventory header only), no bridge change.

## 0. What changed (git diff --stat vs `origin/release/2111`, 15 files before the prep commit)

| Area | Files | Kind |
|---|---|---|
| Devices floor / area chips follow the phone dropdown setting | `frontend/src/screens/devices-area-nav.ts` | PRODUCT |
| WisKey people list: queued refresh runs after a page load; refresh waits for "load more" | `frontend/src/screens/wiskey-people.ts` | PRODUCT |
| Connection probe deadline = setting `SW_PROBE_DEADLINE_S`, default 30 s | `smplwise_vms/backend/smplwise/services/connection_probe.py` | PRODUCT |
| Soak sampler + guard | `scripts/soak/mask_soak.py`, `scripts/soak/soak_guard_io.py` | tooling, not in the add-on |
| Tests | `dropdown-area-nav-phone.spec.ts` (new), `evidence-area-nav.spec.ts`, `evidence-tickets-device.spec.ts`, `evidence-wiskey-people-native.spec.ts`, `wiskey-people-mock.ts`, `test_probe_deadline_setting.py` (new), `test_soak_guard_io.py` (new), `test_lat1_toggle_latency.py`, `messaging_registry_isolation.py` | test only |
| Docs | `docs/release/PIXEL_FAILURES_2026-10-21.md` (analysis only) | doc |

Note: `python scripts/gate/targeted_plan.py --base <sha>` answers "full gate required" (exit 2) for this release because product files
changed; that is expected and is the reason the OWNER approval of 2026-10-21 (targeted run for 2.11.1) is recorded here. Run it anyway
(step 3) and keep its printed plan with the results.

## 1. Pre-checks (read-only)

```
# gate 2 is final and saved; nothing else runs
python3 -c "import json,os;d=json.load(open(os.path.expanduser('~/smplwise-results/gate_status.json')));print(d.get('branch'),d.get('state'),d.get('phase'))"
ps -eo pid,etimes,args | grep -E 'release_gate|waitgate|playwright|pytest|vite' | grep -v grep | cut -c1-140
ls -la ~/.gate-pending 2>&1; flock -n ~/.smplwise-gate.lock true && echo gate_lock_free; flock -n ~/.smplwise-tests.lock true && echo tests_lock_free
df -h / | tail -1; uptime; free -g | head -2; nproc
```

Go / no-go:
- gate 2 state final and its `gate_release_2111_*` results copied off the runner or confirmed saved by the lead (`~/gate_clean.sh` keeps only the two newest `gate_*.logs`; do not run it before that);
- no `release_gate` / `waitgate*` / playwright / pytest / vite process, `~/.gate-pending` absent, both locks free;
- free disk at least 25 GB (task floor; `~/gate_clean.sh` itself refuses below 40 GB after cleaning - then the lead decides, do not edit the guard);
- load average below about 4 on 16 cores.

If `~/.gate-pending` exists for any reason, use ONLY `~/light_run.sh <command>` (2 shared slots, nice/ionice idle, waits for load below 8,
exit 76 = load above 13 aborted, exit 75 = waited too long, re-queue; single-file pytest, tsc, spec runs with `--workers=2`). With the runner
idle and no pending gate plain commands are fine, but keep the `~/light_run.sh` prefix shown below when other jobs may start; it costs seconds.

## 2. Worktree on the runner

```
cd ~/smplwisebms && git fetch --all --prune -q
WT=$HOME/work/targeted-2112
if [ -e "$WT/.git" ]; then git -C $WT reset -q --hard && git -C $WT clean -fdq && git -C $WT checkout -q -f --detach origin/release/2112; else git worktree add --detach $WT origin/release/2112 -q; fi
cd $WT && git rev-parse HEAD            # must equal the head sha the lead names
if cmp -s frontend/package-lock.json ~/smplwisebms/frontend/package-lock.json; then [ -e frontend/node_modules ] || ln -s ~/smplwisebms/frontend/node_modules frontend/node_modules; else (cd frontend && npm ci >/dev/null 2>&1); fi
PY=~/smplwisebms/.venv/bin/python
```

Backend commands below run from `$WT/smplwise_vms/backend` in the shape the gate uses:
`$PY -m pytest -o addopts= -q -p no:cacheprovider -rfE --basetemp <dir>`.

## 3. Cheap static checks

```
cd $WT && python3 scripts/gate/targeted_plan.py --base origin/release/2111 | tee ~/smplwise-results/targeted_2112_plan.txt   # exit 2 expected (product files)
cd $WT && $PY scripts/release_check.py                      # every item ok except "git tag for this version" (informational)
cd $WT/frontend && ~/light_run.sh npx tsc --noEmit          # includes the specs (tsconfig covers tests/)
git -C $WT diff --check origin/release/2111
```

`release_check.py` also checks that the built UI is current; if it lists the bundle as stale before step 6, that is the known
"www is still the 2.11.0 build" state and is closed by step 6, not by a patch.

## 4. Backend tests (pytest, from `$WT/smplwise_vms/backend`)

Required (the new / changed tests and the product files they cover):

```
~/light_run.sh $PY -m pytest -o addopts= -q -p no:cacheprovider -rfE --basetemp /tmp/t2112_b1 \
  tests/test_probe_deadline_setting.py tests/test_soak_guard_io.py tests/test_lat1_toggle_latency.py \
  tests/test_nvr_connection.py tests/test_nvr_system.py tests/test_provision_push_token.py tests/test_provision_tls_pin.py \
  tests/test_gate_hygiene.py tests/test_version.py tests/test_release_notes_marker.py tests/test_docs_config_consistency.py tests/test_release_check.py
~/light_run.sh $PY -m pytest -o addopts= -q -p no:cacheprovider -rfE --basetemp /tmp/t2112_b2 \
  tests/test_messaging_accounts_api.py tests/test_messaging_accounts_runtime.py
```

- `test_probe_deadline_setting.py` and `test_soak_guard_io.py` are the two new files; `test_lat1_toggle_latency.py` is a timing test with a changed bound (expect a pass on an idle runner; a red is read against `record_ms` in its message, not rerun blindly).
- The three NVR / provision files are the importers of `connection_probe` / `connection_store` per `select_tests.py` (run on the workstation with `--base origin/release/2111`).
- `messaging_registry_isolation.py` is a helper imported by the two `test_messaging_accounts_*` files (second command).
- The version / docs / release-notes / release-check tests prove the 2.11.1 prep (`__version__`, CHANGELOG head, marker).

Optional wider batch (not required for green; only if the runner is idle and time allows): the engine's selection for this diff is large
(499 of 595 backend files, because `connection_probe` is reached through the NVR routers; most of it is the fixed smoke and security sets).
List it with `python3 scripts/gate/select_tests.py select --root . --base origin/release/2111 --head HEAD --out ~/sel2112.json`. Smoke subset:
`test_migrations.py test_smoke_after_upgrade.py test_health_summary.py test_health_report.py test_backup.py test_db_gate.py test_db_template.py test_gate_speed.py test_select_tests.py`.
The changed-path map of `docs/release/GATE_TIERS_V2.md` (on `origin/pilot/GATEEFF2-295`) puts every changed path in tier S (ordinary backend / frontend files);
no L trigger (migration, RBAC, auth, bridge allow-list, shell, skin layer) is touched.

## 5. Playwright specs (preview server, `$WT/frontend`)

Build the preview bundle exactly as the gate does, then run the specs against it (`playwright.config.ts` starts `npm run preview` on the
port of `SW_BASE_URL`, default 4173):

```
cd $WT/frontend && ~/light_run.sh npx vite build
SW_BASE_URL=http://127.0.0.1:4173 ~/light_run.sh npx playwright test --workers=2 --reporter=list <spec files of the sets below>
```

Required sets (all projects the spec headers allow; do not narrow with `--project` unless a header says so):

1. new / changed specs: `dropdown-area-nav-phone`, `evidence-area-nav`, `evidence-wiskey-people-native`, `evidence-tickets-device`;
2. consumers of `<devices-area-nav>`: `dropdown-styles-b`, `evidence-devices`, `evidence-tabs-dropdown-settings`, `evidence-tabs-pair`;
3. home / devices screens that use `<devices-area>` (the devices-building surface): `evidence-home-polish`, `evidence-area-redesign`, `evidence-area-hscroll`, `evidence-area-row`, `evidence-area-card-library`, `evidence-bubble-screens`, `evidence-bv1-tiles`, `evidence-devices-tiles`, `evidence-devices-tree-collapse`, `evidence-home-screen`, `evidence-homelive-295`, `evidence-nvr-less`, `evidence-device-cards`, `evidence-tickets-map-internal`, `layout-bubble-screens`, `layout-bv1-tiles`, `layout-material`;
4. WisKey people: `evidence-wiskey-people`, `evidence-wiskey-people-writes`, `evidence-wiskey-capture`, `evidence-wiskey-editor`, `evidence-wiskey-messaging`, `layout-wiskey-people`, `layout-wiskey-people-writes`, `layout-wiskey-messaging`, and the pixel specs `pixel-wiskey-people`, `pixel-wiskey-people-writes`, `pixel-wiskey-messaging`.

Each name is a file `tests/<name>.spec.ts`; check each exists on the branch before running (`ls tests/<name>.spec.ts`) and report any that does not. Specs whose
header asks for the dev server, a fixture backend, or are pixel specs run on the server `release_gate.classify` assigns (the plan printed in step 3 names
the server for each changed spec); a fixture spec that self-skips in the preview run is reported as SKIPPED, not green. The engine's full selection (340 specs,
mostly the smoke set) is in the `select_tests.py` output; the sets above are the ones derived from the changed files (`uses <devices-area-nav>`,
`uses <devices-area>`, `uses <wiskey-people>`, `imports a changed file`). Run a failing spec ONCE more alone before judging; a flaky pass is recorded as flaky.

## 6. UI build for the shipped bundles (after steps 3-5 are green)

Same recipe as 2.11.0 (`docs/release/GATE2_RUNBOOK_2111.md` section 3), branch `release/2112`. On the runner:

```
set -e
BASE=$HOME/smplwisebms; WT=$HOME/work/rel-build
cd $BASE && git fetch --all --prune -q
if [ -e "$WT/.git" ]; then git -C $WT reset -q --hard && git -C $WT clean -fdq smplwise_vms/www smplwise_vms/www-public && git -C $WT checkout -q -f --detach origin/release/2112; else git worktree add --detach $WT origin/release/2112 -q; fi
cd $WT; echo "SHA $(git rev-parse --short HEAD)"
if cmp -s frontend/package-lock.json $BASE/frontend/package-lock.json; then [ -e frontend/node_modules ] || ln -s $BASE/frontend/node_modules frontend/node_modules; else (cd frontend && npm ci >/dev/null 2>&1); fi
cd frontend && npm run build:addon > $WT/.build.log 2>&1 || { tail -15 $WT/.build.log; exit 1; }
cd $WT && $BASE/.venv/bin/python scripts/api_inventory.py && head -3 contracts/API_INVENTORY.md
cd $WT && tar czf /tmp/ui2112.tgz smplwise_vms/www smplwise_vms/www-public contracts/API_INVENTORY.md && ls -la /tmp/ui2112.tgz && tail -3 $WT/.build.log
```

- `npm run build:addon` = `tsc --noEmit && vite build --outDir ../smplwise_vms/www --emptyOutDir && vite build -c vite.public.config.ts --outDir ../smplwise_vms/www-public --emptyOutDir`. A `tsc` error fails the build: stop and report, do not patch on the runner.
- The API inventory header must read `Version 2.11.1` with the same route count as the 2.11.0 header on `release/2111` (1196 at the time of writing; this release adds no route). A different count is a red flag: stop.

Copy the archive back to the workstation (the same flow as the 2.11.0 build, runner config from `private/dashboard/config.json`), then in
`C:\cloude\smplwise-smart-work\release2112`: remove `smplwise_vms/www` and `smplwise_vms/www-public`, extract the archive,
`git add -A smplwise_vms/www smplwise_vms/www-public contracts/API_INVENTORY.md`, commit (message file UTF-8 without BOM, `git commit -F`, trailer
`Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`):

```
build(ui): npm run build:addon on the runner - www + www-public rebuilt for 2.11.1 (release/2112 @ <sha>)
```

then `python scripts/release_check.py` (every item ok except the informational tag item) and `git push origin release/2112`. Only the lead pushes
`main` and tags `v2.11.1`.

## 7. What counts as green

GREEN = all of:
- step 3: `tsc` exit 0, `release_check.py` ok except the informational tag item, `git diff --check` clean;
- step 4: every listed pytest file passes (zero failed, zero errors, at least one test collected per file);
- step 5: every listed spec passes on every project its header allows. `dropdown-area-nav-phone.spec.ts` and `evidence-area-nav.spec.ts` have never run in a
  full gate: this targeted run is the only evidence for the chips fix;
- step 6: `build:addon` exit 0, inventory header `2.11.1` with the expected route count, `release_check.py` ok on the committed bundle head;
- before: at least 25 GB free; after: no leftover process or lock, `~/gate_clean.sh` run once at the end (it keeps `gate-*` and `rel-build`).

RED rules (owner 2026-10-20): classify each failure as stale test or real defect before anything else; a stale test is fixed test-only and re-run
alone; a real defect stops the release and goes to the lead. Pixel failures in the wiskey pixel specs are compared with
`docs/release/PIXEL_FAILURES_2026-10-21.md` (the 28 known stale `visual-matrix` baselines are not part of this run). Record the results (counts,
durations, any retried spec) in `~/smplwise-results/targeted_2112.md` and claim only what ran.

Cleanup afterwards: `git -C ~/smplwisebms worktree remove --force ~/work/targeted-2112` (never touch `gate-*` or `rel-build`).
