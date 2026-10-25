# Release gate v2 (GATE2-295): change-impact selection on top of the v2 schedule

Status: design + implementation on `pilot/GATE2-295`, 2026-10-25, revised the same day after the retrospective replay
(`GATE_V2_REPLAY.md`): rules R1-R4 added and a smoke-masking bug fixed; the replay escape rate went from 15/138 failing files to
0/138 on the last 10 red gates. Only dry-runs and replays were run. **The real gate-2 run on the runner is
NOT_RUN.** The runner was not locked or loaded: one read-only inspection (`rr.py`) and one `release_gate.py --seed-from` (it prints
JSON and starts no test). The existing gate (`~/release_gate.sh`, v1 and `--schedule v2`) is unchanged and stays the default.

Read with: `GATE_SPEED.md` (the v2 schedule and the select_tests mapping), `TEST_POLICY.md` (tiers S/M/L), and the unmerged
proposals on `pilot/GATEEFF-295` / `pilot/GATEEFF2-295` (policy layer, rollout runbook). Gate 2 does not depend on those branches.

## 1. Measured: where the time goes today

Runner: 16 cores, 15 GB RAM (about 12 GB available when idle), 232 GB disk at 66 percent (77 GB free), `/dev/shm` for the backend
scratch. Source: the 2.19.0 gate report and logs (`gate_release-2190_e476e48ae`, tier L, `--schedule v2`, 2026-10-25).

| Item | Measured |
|---|---|
| Wall | 152 min (verdict fail: 12 pixel in one spec, 2 stale backend tests, all fixed test-only afterwards) |
| Phases | tsc 31 s, build 23 s, release_check <1 s, **Playwright pool 8686 s (145 min)**, settle/retries 397 s, backend-wait 10 s |
| Playwright work | **1514 worker-min**: preview 902 (desktop 512, mobile 235, tablet 155), dev server 593 (desktop 569), pixel 16, fixture 2. 769 spec files, ~17,500 test runs |
| Backend work | **570 shard-min** in 705 files; 6 shards of 94-98 min each, in parallel with the pool |
| Load | max load1 47.8 on 16 cores, min MemAvailable 1575 MB. The machine is CPU-saturated for the whole run |
| Longest single files (one `--workers=1` process each) | `layout-schedules-parity` 73 min (its test has a 30-min timeout and flaked on it), `layout-bubble-screens` 65, `evidence-automations-list` 39, `layout-update-screens` 32, `layout-tickets-tabs` 30 |

History (all gate reports on the runner, `hist` summary): the v1 gates of 2.10.1-2.14.0 took 150-179 min. Since 2.15.0 the gate
runs `--schedule v2` and took 139-164 min (one 252-min red run). **The v2 schedule did not deliver its 85-95 min model**: the
model assumed idle cores, but 12 Playwright slots plus 6 backend shards on 16 cores give an effective ~13.7 concurrent units
(2084 unit-min of work / 152 min). Wall time is now proportional to the amount of work. Re-ordering cannot cut it further;
only running less work can.

What the reds were (release reports in `private/planning/`, gate reports 2.10.0-2.19.0): almost all are (a) stale tests that met
an intended change of the same diff, (b) pixel baselines of intended UX changes, (c) flaky tests (8-16 FLAKY per gate, passed
alone). Real defects found by the gate are rare (2.10.0: two, with the visual matrix). Every red since 2.9.0 was closed by a
test-only fix. **Full re-gates cost the most**: 2.15.0 ran two full gates (155 + 139 min), 2.16.0 two (252 + 150). The nightly
full run on main now finishes (2026-10-25: 170 min; standing reds: 28 visual-matrix pixel cases only).

Consequences for the design:
1. Cut the WORK per gate (selection), not the schedule.
2. A red gate must be followed by a targeted re-run, never a second full gate.
3. The nightly full tier L keeps the full coverage. It works now, so it can be the safety net.

## 2. Design

`scripts/gate/release_gate2.sh` runs the unchanged engine `release_gate.py` (a fresh byte-identical copy of the v1 install at
every run) from `~/gate2/`. There, `select_tests.py` is a shim that returns the gate-2 selection. Everything else is the
engine's own code: the classification, the v2 pool, the retry-alone of every failure, the false-green guards (crash, zero
tests, timeout, rc), the count-drop baseline check of every category that was not reduced, and the reports.

### 2.1 Change-impact selection (`scripts/gate/gate2_select.py`)
Diff = `<last release tag>...<branch head>` (default: the newest `v*` tag below the head, which is the last green release).
The mapping is the GATESPEED-293 `select_tests.py` mapping, reused, with a different policy:

| Rule | select_tests (today, opt-in) | gate 2 |
|---|---|---|
| Always-run core | smoke + security suites + every `unit-*` spec (334 files) | **hard-coded CORE**: backend migrations/upgrade/db/backup/health/release-check/docs/version/route-sweep/roles/rbac/gate tests + every security/permission suite; frontend nav/shell/login/i18n/router/perm specs; **R3** `test_no_ip_literals.py` and any backend test that runs `git ls-files` (repo-wide lints). Core alone: 76 backend files (60 shard-min) + 24 specs (40 worker-min), **~27-31 min** |
| Source-tree scanners (**R2**) | - | specs containing `readdirSync` / `ls-files` (23) run whenever any `frontend/src` file changed; never deferred |
| Specs that bundle with esbuild (**R4**) | invisible | the `import '...'` strings of the esbuild stdin `contents` (with `resolveDir`) and `entryPoints` are graph edges of the spec (4 specs) |
| `unit-*` specs reached by the mapping | tagged "smoke" first | **bug fixed after the replay**: the smoke tag hid closure/tag/name hits and gate 2 then dropped them; the mapping now runs without that smoke set |
| Tests changed in the diff | always | always (a heavy changed spec too) |
| Import closure | unlimited | **depth 2** (`GATE2_CLOSURE_DEPTH`; measured: depth 1/2/unlimited select 600/624/638 backend files on 2.20.0, so the depth is not the lever) |
| `main.py`, `body_limit.py`, `__init__.py` | full backend | each changed hunk is attributed to the modules it names (import aliases) and the `/api/v1/` paths it contains; an unattributable hunk -> full backend |
| new migration | full backend | migration tests + tests and modules that name its tables; a modified/deleted migration -> full backend |
| `roles.json` | full both sides | structural JSON diff: new/removed permission ids select the modules/src files that check them; changed roles select the tests and specs that name them |
| `i18n/he.ts`, `en.ts` | full frontend | the changed keys (section.key) select the src files using them, then the closure |
| `shell/`, `design/`, styles core | full frontend | own elements + (shell) the direct importers' elements + specs importing the file + the shell or design spec family by name; a design/styles change runs **all pixel specs** and the design family |
| Kept full-tier triggers | - | `db/config/errors/audit/__main__`, **`rbac/auth/capabilities/mode` (security core, TEST_POLICY L)**, `routers|services/__init__`, `conftest/db_template/hygiene`, requirements; frontend package/lock/vite/tsconfig/playwright config/index.html, `main.ts`, `router.ts`, shared fixtures, tablet allowlist |
| more than 400 files | full | no automatic full (the rules decide) |
| Dockerfile/config.yaml/run.sh | full or version-only | build files: no tests (release_check covers version and bundle) |

### 2.2 Pixel only for UI changes
A `toHaveScreenshot` spec (and the visual matrix) runs only when a `frontend/src` file changed and the spec is mapped to it.
All of them run when the design/styles layer changed. With no frontend change, none runs and `--no-visual` is passed.

### 2.3 Heavy sweeps to the nightly
A spec whose recorded cost is above `GATE2_HEAVY_SECS` (900 worker-seconds) and that did not change is **deferred** to the
nightly. These are the layout sweeps above, 16-19 files and about 460 worker-min. Every report lists them. `--keep-heavy`
runs them. **R1 (replay: 13 of the 15 escapes)**: no deferral on a frontend side that is already full-tier. A hub change is
exactly when these sweeps find layout breakage. Source-tree scanners are never deferred.

### 2.4 Sharding and parallelism that fit the runner
One CPU budget of 18 units (`GATE2_CPU_UNITS`, measured safe in 2.19.0: 12 slots + 6 shards, min 1.5 GB free). For each run
the plan tries every split between backend shards (4-10, `GATE_BACKEND_SHARDS`) and Playwright slots (at least 6,
`GATE_PW_SLOTS`). It picks the split with the shortest critical path, using the engine's own `v2_jobs()` /
`simulate_pool()` / `split_backend()`. Backend shards stay on tmpfs (engine v2 default). **Backend shards** are the engine's
existing time-balanced junit-cost split.

### 2.5 Flake quarantine and targeted re-runs (`scripts/gate/gate2_verdict.py`, `gate2_quarantine.json`)
- The engine still retries every failure once alone (pass -> FLAKY).
- **Managed quarantine**: an entry needs a ticket, an owner and an expiry of at most 21 days. Candidates come from
  `gate2_verdict.py propose` (first-run failures in 2 or more of the last 6 gates). The lead adds entries by hand, and the
  list starts empty. A quarantined test always runs. When EVERY failure of a run is quarantined, the wrapper re-runs **only
  those tests** on the same sha (`GATE2_RERUN_ONLY`, about 5-10 min). A second red is a real FAIL.
- **Any other red**: the summary prints the exact command
  `~/gate2/release_gate2.sh <branch> --after <red report>`. That run selects the failed tests' files, plus everything the fix
  diff (red sha..new head) touches, plus the core. **This replaces the full re-gate.** The release decision is the red report
  plus the targeted run. A hard failure (tsc, build, release_check, an engine guard) needs a normal gate run.

### 2.6 Nightly full tier L (unchanged cron, now a precondition)
`nightly_tests.sh` at 02:00 on main, full tier, no selection (170 min on 2026-10-25). `release_gate2.sh` checks the newest
nightly report first (`gate2_select.py nightly`): it must be at most 36 h old, have no engine hard failure, and have run the
backend. If not, the run falls back to the full tier and says why (`--accept-stale-nightly` overrides). After each gate-2
release, `select_tests.py audit` on the next nightly lists every nightly red in a file that the selection had dropped. Each
such red is a missed-selection incident.

## 3. Dry-run results (workstation, the same code that runs on the runner; costs = the 2.19.0 gate)

Calibration: the planner gives 137 min for the full tier of the 2.19.0 tree (12 slots, 6 shards). The measured pool phase was
145 min, so k = 1.06. Each range below is `[0.85 x planner, k x planner] + 9.5 min fixed` (setup, settle/retries, servers).

| Diff | Changed files | Full side | Backend selected | Frontend selected | Deferred heavy | Estimate | Full tier, same tree |
|---|---|---|---|---|---|---|---|
Recomputed after R1-R4 and the smoke fix (each estimate in its own process; the first numbers are kept in brackets):

| Diff | Changed files | Full side | Backend selected | Frontend selected | Deferred heavy | Estimate | Full tier, same tree |
|---|---|---|---|---|---|---|---|
| `release/2200` + this branch vs `v2.19.0` (2.20.0 train, 13 branches) | 197 | none | 626/717 files, 565 shard-min | 581/779 specs, 1142 worker-min | 19 specs, 458 worker-min | **95-116 min** [96-117] (longest job 73 min: `layout-schedules-parity` changed by one line, so it is pinned) | 126-154 (actual 2.19.0: 152) |
| `v2.19.0` vs `v2.18.0` (previous release) | 215 | backend (`auth.py`) | 705/705 (587 shard-min) | 503/770 specs, 797 worker-min | 16 specs, 460 worker-min | **81-98 min** [83-101] | 126-154 |
| a release whose FRONTEND is full-tier (`vite.config.ts`, `index.html`, shared fixtures; 2.10.0, 2.16.0, 2.18.0) | - | frontend (+ backend) | - | all, no deferral (R1) | 0 | **about the full tier, 126-154 min** | - |
| core only (no diff) | 0 | none | 76 files, 60 shard-min | 24 specs, 40 worker-min | 0 | **27-31 min** | |

Per branch of the 2.20.0 train (each merge's own diff, i.e. a release of one branch; all 13 evaluated, one process each,
current rules):

| Branch | Files | Backend | Frontend | Deferred | Estimate |
|---|---|---|---|---|---|
| WKVEC | 4 | 77 files | 24 specs | 0 | 27-31 min |
| CAPMAP | 4 | 208 | 24 | 0 | 27-31 |
| NOTICERSS | 19 | 284 | 104 | 4 | 35-41 |
| LOGOSIDE | 20 | 214 | 203 | 9 | 35-42 |
| NOTICEDEL | 17 | 435 | 121 | 4 | 43-51 |
| WALINK | 12 | 436 | 140 | 6 | 43-52 |
| EMROLE | 19 | 437 | 152 | 6 | 43-52 |
| NOTICECAPS | 9 | 505 | 96 | 4 | 49-58 |
| TEMPLINK | 19 | 537 | 195 | 9 | 55-66 |
| ANNOUNCE | 29 | 529 | 356 | 13 | 72-87 |
| POLISH | 46 | 497 | 217 (73-min spec changed) | 9 | 72-87 |
| WKF01F02 | 22 | 355 | 492 | 21 | 76-92 |

(The merge-back of `main` v2.19.0 into the train, 30-34 min in the first pass, is not a branch release and was not recomputed.)

### Honest range
- **A release of 1-3 ordinary branches: about 27-66 min.** 8 of the 12 branches land at 27-58 min, which meets the target;
  TEMPLINK 55-66; three big branches 72-92. Two or three of the small ones together stay near the largest member plus a few
  minutes of backend, because the core and the closure overlap. That combination is an inference, not measured.
- **A release with a full-tier frontend: about the full tier (126-154 min)**, because R1 brings the heavy sweeps back on purpose.
- **A train like 2.20.0 or 2.19.0: about 81-116 min**, against 152 today, so it saves 35-70 min. It does NOT meet the 45-60 min
  target. Selection over a 13-branch train still reaches most of the backend, because the import closure of shared services
  (access, ha_sync, ha_bridge, backup, tickets) covers most API tests.
- To reach 45-60 for a typical release: **release smaller, more often** (the owner's continuous-pipeline rule), and do the
  structural follow-ups in section 6.

## 4. What each shortcut risks (stated, not hidden)

| Shortcut | What can be missed | Caught by |
|---|---|---|
| Change-impact selection | dynamic dependencies (string imports, event bus, scheduler), a spec that reaches a component only by clicking through, data/text coupling across features, f-string API paths, order effects between tests (GATESPEED 5.2) | nightly full tier on main, at most about 24 h later; `select_tests.py audit` |
| Closure depth 2 | a behaviour change 3+ import levels away | the same; measured gain is small (624 vs 638 files), the knob is there |
| Narrowed hubs (main/body_limit/migration/roles/i18n/shell/design) | an effect outside the attributed modules, e.g. a migration that changes a table read by code that does not name it, or a shell change felt by a screen that never names the shell's elements | unattributable hunks fall back to full; nightly |
| Security core stays full | none added; `rbac/auth/capabilities/mode` keep the full backend | - |
| Pixel only for UI changes | a backend change that alters rendered data in a screenshot (demo data is frontend-side, so low risk) | nightly pixel group |
| Heavy sweeps deferred (only on a change-impact frontend side, R1) | a layout regression on the screens those sweeps cover, shipped until the next nightly | nightly; `--keep-heavy` for releases that touch layout broadly |
| Selection fitted to history | the replay (0/138 escapes) was run on the same 10 gates the rules were derived from; unseen failure classes can still escape | nightly + `select_tests.py audit`; any audit hit is added as a rule and to the replay |
| Targeted re-run after red | an interaction between the fix and an untouched area | the fix diff is mapped like any change; nightly |
| Quarantine | a real regression inside a quarantined test is retried once more before it counts | it still fails twice -> FAIL; entries expire in 21 days and need a ticket |
| Higher shard count when Playwright is light | memory: 10 shards are not measured | engine memory guard on the pool; the report's resources line; set `GATE_BACKEND_SHARDS` lower |

The worst case: a defect that only the deferred or dropped tests see ships in a release and the next nightly shows it red.
The rule: a nightly red that the selection audit attributes to a dropped file is fixed the same day, with a hotfix release.
Two such incidents in 30 days move gate 2 back to `--full` until the mapping is fixed.

## 5. Implementation (files on `pilot/GATE2-295`)
- `scripts/gate/release_gate2.sh`: the wrapper (locks, engine refresh, nightly check, plan, knobs, report backup, engine run,
  verdict, re-run of quarantined failures). `--dry-run` takes no lock and writes only to `/tmp` (temporary worktree, or
  `--root`).
- `scripts/gate/gate2_select.py`: the policy, `plan` (selection + estimate, runs nothing), `select`, `nightly`.
- `scripts/gate/gate2/select_tests.py`: the engine shim (installed as `~/gate2/select_tests.py`).
- `scripts/gate/gate2_verdict.py`: gate-2 summary `gate_<b>_<sha>.gate2.md`, quarantine, the next-step command, `propose`.
- `scripts/gate/gate2_quarantine.json`: empty managed list. `scripts/gate/gate2_costs.json`: cost seed from the 2.19.0 gate
  (file names and seconds only).
- `docs/release/GATE_V2_REPLAY.md`: the retrospective replay on the last 10 red gates (first pass 15/138 escapes, after
  R1-R4 0/138).
- `smplwise_vms/backend/tests/test_gate2_select.py`: 15 unit tests, including R2/R3/R4, the smoke-masking fix and R1 on
  synthetic git repositories; the original 10 cover (aliases, hunk attribution helpers, migration tables,
  roles parsing, re-run selection, failed-file extraction, quarantine rules, verdict exit codes, seed, estimate range).

## 6. Structural follow-ups (not in this branch, each a ticket)
1. Split `layout-schedules-parity.spec.ts` (73 min, one test with a 30-min timeout) and `layout-bubble-screens.spec.ts`
   (65 min). They set the floor of any gate that runs them.
2. Tablet project only in the nightly, except for specs mapped by the diff: 155 worker-min (10 percent of Playwright). This
   needs an engine option (the project list is decided in `classify()`).
3. Backend per-test cost: 570 shard-min for ~16,700 tests. The DB template is on. The next lever is app start-up per test
   (fixtures at module scope where safe).
4. A second runner, or a bigger one: the gate is CPU-bound, so wall time scales with cores.

## 7. Migration plan

### Install (idle runner only, the lead, no gate or nightly running; nothing in `~/` is replaced)
```
ssh runner 'mkdir -p ~/gate2'
scp scripts/gate/{release_gate2.sh,gate2_select.py,gate2_verdict.py,gate2_costs.json,gate2_quarantine.json} runner:~/gate2/
scp scripts/gate/gate2/select_tests.py runner:~/gate2/select_tests.py
ssh runner 'chmod +x ~/gate2/release_gate2.sh'
ssh runner '~/gate2/release_gate2.sh release/<x> --dry-run'          # no lock; prints selection + estimate
```
The first real run copies `release_gate.py`, `select_tests.py` (as `select_tests_v1.py`) and the two JSON files from `~/`
into `~/gate2/`. The v1 install is never written.

### Switch (the flag)
- Old gate: `~/release_gate.sh <branch> --schedule v2` (unchanged).
- Gate 2: `~/gate2/release_gate2.sh <branch>`. Use the same `~/gate_clean.sh` before and after, as for every gate.
- Inside gate 2: `--full` = the full tier (the old gate's content), `--keep-heavy`, `--depth 0`.

### Rollback
- Use the old command. Gate 2 changes nothing the old gate reads, apart from its own reports. A same-sha old report is kept as
  `.pre-gate2.*`.
- Uninstall: `ssh runner 'rm -rf ~/gate2'`.

### First real use (proposal for the owner)
1. **Shadow run**: on the 2.20.0 candidate AFTER its normal gate. Run `release_gate2.sh release/2200` on the same sha. Compare
   with `shadow_compare.py`: every FAIL of the full gate in a selected file must also be red in gate 2, and wall time is
   measured against the estimate (96-117 min).
2. **Canary**: a throwaway branch with one failing backend test, one failing spec and one inverted assertion in an existing
   test. Gate 2 must report all three as FAIL.
3. **First release decided by gate 2**: a small release (1-3 branches), estimate 27-60 min. Keep `--full` for releases
   carrying `auth/rbac`, conftest or the build configuration (they fall back to full anyway).
4. **The next morning**: read the nightly + `select_tests.py audit` before the next gate-2 release.
5. Two clean gate-2 releases + clean audits: gate 2 becomes the lead's default. The old gate stays for `--full`-type releases
   and as the rollback.

## 8. Verification status
- Unit tests `tests/test_gate2_select.py`: **15 passed** (workstation, repo venv, pytest 9.1.1). The full backend suite: NOT_RUN.
- Replay of the selector on the last 10 red gates (local report copies, no runner contact): **0 of 138 failing files escape**
  (`GATE_V2_REPLAY.md` section 7). In the excluded, budget-starved 2.17.1 run, 4 unverified timeouts or infrastructure errors
  stay unselected.
- `bash -n release_gate2.sh`: OK. `release_gate2.sh --dry-run --root <checkout>` on the workstation: OK (output in section 3).
- Dry-run ON the runner, real gate-2 run, shadow run, canary, the quarantine re-run path, 10 shards / 8 slots under load:
  **NOT_RUN** (the runner held `~/.smplwise-tests.lock`, and a 2.20.0 gate is due).
- `selftest_gate.py`: NOT_RUN (unchanged engine).
