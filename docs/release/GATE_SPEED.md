# Release gate wall time (GATESPEED-293)

Goal: cut the tier-L release gate (151 min 12 s for 2.9.2) without dropping a test. Status: the v2 schedule is implemented
behind `--schedule v2`. The default stays `v1`, the 2.9.2 gate unchanged, until a shadow comparison is recorded (section 7.8,
GATEEFF-295). v2 has NOT run on the runner yet. The first v2 run is the validation run (see "Rollout").
**GATEEFF-295 (section 7, 2026-10-21) adds the policy layer on top: failure lanes, managed quarantine, base comparison, pixel
review lane, automatic selection under a nightly-health rule, the schedule default switch and a one-page summary.**

## 1. Where the 151 minutes go (2.9.2 gate, integ/292-rel @ 7d62c315)

Two tracks run side by side from the first second. The backend shards start before tsc. Both tracks take about 150 minutes, so
cutting only one of them saves nothing.

| Phase (v1) | Wall | Note |
|---|---|---|
| modules | 0 s | `node_modules` symlinked (the lock file is the same as the clone's) |
| tsc / build / release_check | 22 s / 12 s / <1 s | not worth optimising |
| preview (Playwright, dist) | 4907 s (82 min) | 8 processes side by side. The longest are the three `--workers=1` chunks of the desktop-tablet-mobile group (66-69 min each). After them, the 13 pixel specs run one after another (about 12 min) |
| fixture | 85 s | |
| visual matrix (warn) | 87 s | |
| dev (Playwright, Vite dev) | 3819 s (64 min) | the three `--workers=1` desktop chunks (59-64 min each) are the tail |
| backend-wait | 133 s | shards already done, plus the retry of 8 failures |
| **backend shards (parallel to all of the above)** | 8436 / 8823 / 9051 s | 3 shards, split by file size (7 percent spread). 12k tests, about 2.2 s per test per shard |

Critical path: preview (82) + pixel (inside preview) + fixture + visual + dev (64) = about 148 min. The backend finishes at 151 min.

What the numbers show:
- **Playwright** does 13.5 worker-hours of work (the sum of the per-test durations in the 2.9.2 JSON reports). Over 148 min that
  is only about 5.5 workers busy on average. At the start there are 12 workers (memory then: 4.0 GB available of 15 GB, from
  `cleanup.log`). After the first 25 minutes only the `--workers=1` chunks and one 3-worker group are left. The dev phase waits
  for the whole preview phase, although it uses a different server.
- **Backend**: 26,311 shard-seconds. One pytest shard uses about 44 percent of a core (sampled on the runner: 44 s CPU in 99 s).
  The rest is waiting for the disk. Every test builds a fresh app and runs all 123 migrations in a new SQLite file with
  `synchronous=FULL`, so it makes 100+ fsyncs. Each shard writes 6.8 GB of scratch (`tmp_b1`). The disk is a consumer NVMe.
  Pressure on the runner: IO "full" is 5-10 percent with ONE pytest running.

## 2. Changes and estimates

The estimates come from `release_gate.py --plan`, which uses the recorded per-file costs. The same model gives 152 min for v1
(actual: 151), so it is calibrated on v1. v2 runs more at once, so single tests will be slower. The "expected" column adds
15-25 percent for that.

| # | Change | Status | Saves (estimate) |
|---|---|---|---|
| 1 | **One Playwright pool** (v2): the preview groups, dev groups, pixel, fixture and visual run as jobs under one worker budget (`GATE_PW_SLOTS`, 12), largest area (seconds x workers) first. The dev server starts together with the preview server | implemented (v2) | frontend track 148 -> ~75 min (model), **~85-90 expected** |
| 2 | **Wider `--workers=1` splitting**: chunks of about `GATE_CHUNK_TARGET_SECS` (1500 s), at most `GATE_W1_MAX_CHUNKS` (8), balanced by recorded time. Parallel groups get up to `GATE_PW_MAX_WORKERS` (6) workers (never fewer than `GATE_PW_WORKERS`) | implemented (v2) | part of #1. The floor is the longest single file, `layout-bubble-screens.spec.ts`, 34 min |
| 3 | **Pixel no longer serial after preview**: it is a pool job. Its retries still run alone after the pool | implemented (v2) | ~12 min of serial tail removed (part of #1) |
| 4 | **6 backend shards** (`GATE_BACKEND_SHARDS`), longest-processing-time split | implemented (v2) | backend 151 -> ~73 min if the disk scales (model). 8 shards: ~55 min |
| 5 | **Split by duration**: v2 writes `backend_sN.xml` (junit) per shard. The next gate balances by those per-file seconds (seed key `backend_seconds`). Until a v2 gate has run, sizes are scaled to `backend_shard_seconds_total` | implemented (v2) | ~3-5 min (the size split was already within 7 percent; it matters more at 6-8 shards) |
| 6 | **Backend scratch on tmpfs** (`GATE_BACKEND_TMPFS`, v2 default on): basetemp and `TMPDIR` of each shard on `/dev/shm` (7.7 GB). `tmp_path_retention_policy=failed`, so a passed test's directory is removed at its teardown. Falls back to disk when under `GATE_TMPFS_MIN_GB` (4) is free. Stale `smplwise-gate-*` directories are swept at start, and the directory is removed at the end | implemented (v2) | **not measured** (the runner was busy). If the fsync wait goes away, a shard needs ~45-55 percent of its current time, so the backend stops being critical even at 4 shards |
| 7 | Memory guard: no new pool job while MemAvailable < `GATE_MIN_FREE_MB` (1500) unless the pool is empty. Resource sampling: max load1 and min MemAvailable every 30 s, in the report (v1 and v2) | implemented | safety, no time |
| 8 | `--plan --root <checkout>`: v1 and v2 plans with estimates, runs nothing. `--seed-from <gate logs dir>`: the refreshed `gate_durations.json` | implemented | tooling |
| 9 | Refreshed `gate_durations.json` from the 2.9.2 gate (439 spec files, was 301 from 2.4.10). Adds `backend_shard_seconds_total` (26310.9), `pixel_phase_seconds` (710) and `backend_seconds` (empty) | done | better chunk balance on a fresh runner |

**Expected v2 gate: about 85-95 min instead of 151 (saves about 55-65 min).** The frontend pool becomes the critical path.
The backend is not critical at 6 shards, even on disk, if the disk scales. Model numbers per slot budget: 10 slots ~89 min,
12 slots ~75 min, 14 slots ~69 min (Playwright only, no load allowance).

### Proposed, not implemented (need a product or test-code change, or a measurement first)
| Proposal | Why it is not in this change | Expected gain |
|---|---|---|
| **Migrated-template SQLite for tests**: a session fixture migrates one DB, and each `settings` fixture copies the file instead of running 123 migrations | `tests/conftest.py` change (test infrastructure, every backend test). Needs proof that a copied DB equals a fresh migrate (schema dump). `test_migrations*` must keep migrating from empty. On the workstation `migrate()` is 6.1 s of a 9.2 s app start | probably the biggest backend lever (most of the 2.2 s per test) |
| pytest-xdist (`-n auto --dist loadfile`) | not installed in the runner venv (installing changes the runner). Process shards plus the duration split give the same balance without new in-process scheduling | ~ same as #4/#5 |
| Skip dev-server specs that preview already covers | **no such overlap exists**: `classify()` puts each spec in exactly one of fixture / dev / rest. A dev spec imports `/src/...` or needs the dev server, and does not run on the dist preview. Not provably equivalent, so not done | 0 |
| Caching node_modules / venv / build | already done: `node_modules` is a symlink when the lock file matches (0 s), the venv is shared, and the build runs once (12 s) | ~0 |
| Removing the gate's idle waits | the only real idle was the serial pixel tail and the phase barrier (preview -> dev), removed by #1/#3. The polling waits (1 s HTTP poll, 1 s SIGTERM grace) are seconds | (in #1) |
| Lower `GATE_TOTAL_SECS` for v2 (e.g. 7200) | only after two v2 gates confirm the time | - |
| `run_remote.sh backend` (private/runner, not in the repo): the same tmpfs + more shards | outside this branch | its 2-shard full run ~2x faster |

### Flaky-test retry policy (unchanged rule, recommendations)
- The rule stays: every failure is retried once alone (workers=1). Pass -> FLAKY, fail again -> FAIL. In v2 all retries run after
  the pool drained, so they are as "alone" as in v1 (only backend shards may still run, as in v1).
- Recurrent flaky tests (`unit-tabs-config.spec.ts:124` [tablet] in 2.9.0 / 2.9.1 / 2.9.2, `test_messaging_accounts_*`,
  `test_lat1_toggle_latency`) should get fix tickets. Do not skip them in the gate and do not add them to `known_issues.json`.
  A FLAKY in two consecutive gates is a defect.
- A v2 gate has more parallel load, so wall-clock bound tests may flake more often. `sw_load_factor()` (conftest) already scales
  them. Do NOT set `SW_TEST_TIME_FACTOR` in the gate: it would loosen the bounds, which is a coverage trade-off.

## 3. Coverage: what v2 changes and what it does not
- **Same tests**: the classification (`classify()`), the project lists (including E4), the `--workers=1` headers, the grep
  filters, the fixture/visual steps and the baseline check are shared with v1. A unit test
  (`test_v2_jobs_cover_exactly_the_v1_specs_and_projects`) proves that every (spec, project) pair of v1's preview and dev runs is
  in exactly one v2 job, that a job never mixes `--workers=1` and parallel specs, and that a `--workers=1` spec runs with one worker.
  The backend runs every `tests/test_*.py` in exactly one shard (`test_split_*`).
- **Same guards**: settle(), backend_finish(), the count-drop baseline check and the false-green guards are unchanged. The selftest
  proves that a load crash and a zero-test job inside the pool still fail the gate.
- **Trade-offs** (listed, not silent):
  1. *tmpfs scratch*: the backend tests no longer touch the real disk, so fsync timing and real-filesystem behaviour are not
     exercised. None of the tests can observe durability (no crash simulation), so no assertion changes. `TMPDIR` moves together
     with the basetemp, so "same filesystem" renames (`os.replace` from a temp dir) behave as on disk. Off with
     `GATE_BACKEND_TMPFS=0`.
  2. *Higher parallel load* during Playwright: no test is removed. Timing-sensitive tests can flake more, and that shows up as
     FLAKY in the report. Lower `GATE_PW_SLOTS` if FLAKY counts rise.
  3. *The fixture spec's retry* runs inside its pool job (it needs its own fake backend, which stops when the job ends), so it is
     not "alone" as the other retries are. It is one `SW_LIVE` spec with one worker.
  4. *A failed backend test's tmp directory* is not kept after a v2 gate (tmpfs is removed, and on disk the policy keeps failed
     ones only). The failure text in `backend_sN.log` and the retry log stay.

### What changes for v1 (the default) with this engine
Nothing in what runs or how a verdict is reached. These additions only affect reporting and robustness:
- the report adds a `schedule` line and a `resources` line;
- `count()` / `item()` take a lock, and `gate_status.json` is written through a per-thread temp file (the heartbeat and a phase
  could collide on one `.tmp` name);
- after the gate leaves its run section, `run()` starts no new process;
- the fixture and visual steps moved into functions with the same code;
- the refreshed seed only affects spec files that no gate log on the runner has timed.

## 4. Procedure

```
~/release_gate.sh <branch> --schedule v2            # or GATE_SCHEDULE=v2; the default (no flag) is v1
python3 scripts/gate/release_gate.py --plan --root . # estimates only (workstation or runner), runs nothing
```
Knobs (environment; the v1 value in brackets keeps v1 behaviour): `GATE_PW_SLOTS` 12, `GATE_BACKEND_SHARDS` 6 [3],
`GATE_BACKEND_TMPFS` 1 [0], `GATE_TMPFS_MIN_GB` 4, `GATE_W1_MAX_CHUNKS` 8 [3], `GATE_CHUNK_TARGET_SECS` 1500,
`GATE_PW_MAX_WORKERS` 6 [3], `GATE_MIN_FREE_MB` 1500. The report shows the schedule, the shards, the scratch location,
every pool job (workers / files / estimate / start / wall) and the resource line.

### Rollout
1. Install the new `release_gate.py` + `gate_durations.json` on the runner (`scripts/gate/INSTALL_ON_RUNNER.md`; idle runner only,
   backup first). Run `selftest_gate.py` there and expect `SELFTEST PASSED`.
2. Shadow run: a v2 gate (`--schedule v2`) on a branch that has a green v1 gate (for example the next release candidate, after
   its v1 gate). Every category's passed count must match the v1 gate (allowing for flaky tests). Check the resources line: if
   min MemAvailable < 2 GB or max load1 > 24, use `GATE_PW_SLOTS=10`.
3. After the shadow run: refresh the seed with `python3 ~/release_gate.py --seed-from ~/smplwise-results/gate_<b>_<sha>.logs "<source>" > gate_durations.json`
   (now with `backend_seconds`) and commit it.
4. Two green v2 release gates -> make v2 the default (a one-line change of `SCHEDULE`'s default, with an owner OK). The nightly
   stays v1 until then (it does not set `GATE_SCHEDULE`).

## 5. Phase 2 (lighter and shorter, still thorough)

### 5.1 Pre-migrated test database template (implemented, ON by default in the backend suite)
- `smplwise_vms/backend/tests/db_template.py` is installed by `tests/conftest.py`. Each pytest process runs the real migrations
  (127 files) once into a template file. Each fresh test database gets a page copy of it (SQLite backup API) at the exact moment
  `create_app` calls `Database.migrate()`. Everything before that call (the pre-upgrade backup check, the update runs' early
  boot) and everything after it (schema guards, seeding, start-up jobs) runs unchanged.
- The values the migrations take from the clock (`strftime(..., 'now')` in 0042 / 0049 / 0050 / 0079 / 0092,
  `schema_migrations.applied_at`) are re-stamped to the copy time. If a trigger exists on such a table, the template is not used.
- **Fallback switch**: `SW_TEST_DB_TEMPLATE=0`, which restores the per-test migrations.
- **Where the real path still runs**: every `Database.migrate()` call that does not come from `create_app`
  (`test_migrations*.py`, `test_switch_protection_migration.py` and every test that migrates by itself, about 30 files), every
  database that is not empty (upgrade / restart tests), and the template build itself.
- **Proof** (`tests/test_db_template.py`):
  - copy vs real migrations: identical `sqlite_master` (type, name, table, SQL), identical file pragmas (page_size,
    journal_mode, user_version, application_id, auto_vacuum, encoding), identical rows in every table (clock stamps
    normalised), and `integrity_check` / `foreign_key_check` clean;
  - `create_app` with and without the template: the same schema, pragmas and row counts per table;
  - direct `migrate()` calls take the real path;
  - the switch works.
- **Not compared, with reason**: `PRAGMA schema_version`, SQLite's internal change counter. A backup copy sets it to 1, while
  the real path ends at about 790. A test proves that no product code reads it.
- **Saving, measured on the runner** (2026-10-20, through `~/light_run.sh`, nice/ionice idle, other jobs running, load ~9):
  - **In-process A/B benchmark** (the reliable number; template on and off alternate in one process, 16 rounds each, the first
    dropped). One fresh `create_app` plus the first request:

    | Template | median | mean | min |
    |---|---|---|---|
    | off | 2.79 s | 3.77 s | 2.14 s |
    | on | 0.65 s | 0.91 s | 0.50 s |

    That is **about 2.1 s saved per fresh test app (-77%)**.
  - **Whole-file runs of `test_tickets_detail.py`** (36 tests) contradicted each other:
    - run 1: 175.9 s off vs 121.7 s on;
    - run 2: 115.5 s off vs 188.3 s on.

    The runner load during those idle-priority runs swamps the effect, so they are NOT evidence either way.
  - **Suite estimate**: most API tests start one app per test. At 2.1 s for an estimated 4,000-8,000 app starts, the saving is
    about 140-280 of the 439 shard-minutes (35-65 percent). To be confirmed by the next full backend run: compare the shard
    seconds in its logs.
  - **v1** (3 shards): the backend track goes from ~146 to ~55-95 min. The v1 Playwright track (~148 min) stays the critical
    path, so on its own the template does NOT shorten a v1 gate.
  - **v2** (6 shards): the backend goes from ~73 to ~30-50 min.
  - The template matters for every targeted or selection run, and for the nightly, whose backend was cut by its budget.

### 5.2 Diff-based selection (`--select-base <ref>`, opt-in)
`scripts/gate/select_tests.py` (installed next to `release_gate.py`) maps `base...HEAD` to tests:
- **Always run**:
  - every test file added or modified in the diff;
  - the smoke set (`SMOKE_BACKEND`: migrations, smoke after upgrade, gate hygiene, health, backup, release_check, db gate,
    template, gate tests; frontend: every `unit-*` spec plus nav/shell specs);
  - every security / permission suite in full (file name matches
    `security|rbac|perm|auth|secret|csrf|privacy|scope|role|passkey|webauthn|login|session|ingress|grant|harden|poc`).
  - Measured base load: 52 of 523 backend files (~40 of 439 shard-min) and 262 of 633 specs (~72 of 875 worker-min).
- **Backend mapping**:
  - the reverse import closure of the changed modules, which does not walk through main / db / rbac / auth / config / errors /
    audit / package `__init__` (each of them triggers the full tier itself);
  - test files importing a module of the closure;
  - a test name containing the changed module's stem;
  - tests calling an `/api/v1/<segment>` that a router in the closure serves;
  - importers of a changed test helper;
  - tests naming a changed script.
- **Frontend mapping**:
  - the reverse import closure of the changed `src` file, not through main.ts / router.ts / shell;
  - every spec that mentions a custom element defined in the closure;
  - specs that import the changed file or a changed helper;
  - spec names containing the changed file's stem or feature directory.
- **Full-tier triggers**:
  - backend: migrations, `main/db/config/errors/audit/__init__`, `conftest.py`, `db_template.py`, `hygiene.py`, requirements,
    Dockerfile;
  - frontend: package / lock / vite / tsconfig / playwright config, `main.ts`, `router.ts`, `shell/` (nav), i18n core, styles
    core, `design/`, `src/fixtures`, `tests/fixtures`, the tablet allowlist;
  - both: `roles.json`, `rbac.py`, `auth.py`, `capabilities.py`, `mode.py`, and more than 400 changed files.
  - A change that only bumps a version string (`__version__`, Dockerfile label, config.yaml) is ignored.
- The engine writes `gate_<b>_<sha>.selection.json` (selected, dropped, and why each file was selected) and a report section.
  The reduced categories skip the 70-percent baseline ratio (reported as `selection`). The per-process zero-test and crash
  guards still apply.

**Real numbers** (`select_tests.py report`, seed = the 2.9.2 gate's durations):

| Diff | Full backend? | Full frontend? | Backend | Frontend |
|---|---|---|---|---|
| 2.9.2 release (v2.9.1...v2.9.2, 168 files) | yes: `main.py`, migration 0124 | yes: `playwright.config.ts`, `shell/nav.ts` | 523/523 | 633/633 |
| 2.9.3 release (v2.9.2...integ/293, 299 files) | yes: migrations 0125-0127 | yes: `shell/nav.ts`, `sw-app.ts` | 523/523 | 633/633 |

**Both release gates would run in full, so the saving on these two releases is 0 min.** Every release of this train carried a
migration and a nav/shell change. Selection pays off on the individual branches and on releases without a migration. Per
branch (merge commit second parent vs first parent) of 2.9.2 + 2.9.3, 21 branches:

| Branch kind (count) | Backend selected | Frontend selected |
|---|---|---|
| UI-only fixes: VPORTAL2, ELEVDOORS, BGFIX, CLOCK, UIJANK, TEMPFIX, VISMATRIX-FIX (7) | 52-55 / 523 files (~40-44 of 439 shard-min, **-90%**) | 263-492 / 633 specs (72-647 of 875 worker-min, **-26 to -92%**) |
| backend service changes: SECFIX, PRIVTEXT, PERMOVR, WISKEYARX, ORGPLAN2, 292 fixes (6) | 425-457 / 523 (~372-383 shard-min, -13 to -15%) | 262-305 / 633 (~72-174 worker-min, -80 to -92%) |
| with migration and/or nav/shell/config/allowlist: TABSET, ACCESSREQ, GENWIDGET, TEMPCTL3, SHAREDID, E4, TEMPCTL-291, GATEHYGIENE (8) | full on at least one side | full on at least one side |

As a gate on a UI-only release, the backend track would drop from ~146 to ~15 min (3 shards) and the Playwright track to
roughly the selected share. A service change still selects most of the backend, because the closure of a shared service reaches
the routers and the API tests behind them. This is deliberate, because the gate stays thorough.

**What selection can miss** (and why the nightly full run on main stays mandatory):
1. Dynamic dependencies: string-based imports, `getattr` plugin lookups, a service reached only through an event bus or a
   scheduler. These are not visible in the import graph.
2. A frontend spec that reaches a changed component only through a route or a parent element whose tag it never names (it waits
   for `sw-app` and clicks through). The tag rule needs the spec to mention an element of the closure.
3. Data or text coupling: demo mocks or i18n feature strings used by a spec of another feature, and CSS in a shared component
   that moves the layout under an unrelated layout spec.
4. Behaviour through the HTTP API of a router whose path segment a test builds at run time (f-strings) instead of writing it.
5. Order and isolation effects: a test that only fails next to another test in the same shard.

**Safety net**: `nightly_tests.sh` runs main in full (no selection). After the run, `select_tests.py audit` writes
`<date>_selection-audit.md`, which lists every nightly FAIL / FLAKY in a file that one of the last 10 selection runs dropped.

**Blocking finding for the safety net**: the nightly did not finish in 2026-10-16..20.
- Every night it hit its 117 min engine budget, with verdict FAIL.
- On 10-20 the backend was cut at 3,564 of ~12,000 tests.
- Every night `visual-matrix.spec.ts` had 28 pixel failures (the nightly runs the matrix in the pixel group).

**Selection must stay off for release gates until the nightly completes** (v2 schedule via `SW_NIGHTLY_SCHEDULE=v2`, the
template, or a larger `SW_NIGHTLY_BRANCH_MAX_MIN`) **and its standing reds are fixed or listed.**

The engine enforced this with rc 2 unless `GATE_SELECT_ENABLE=1` was set. GATEEFF-295 (7.7) replaced the refusal by a measured rule:
selection runs only while the last full nightly on main finished; otherwise the gate runs the full tier and says why.

### 5.2a Making the nightly finish (lead follow-up)
- **Limits**: `nightly_tests.sh` now defaults to a 240 min hard limit and a 225 min engine budget per branch (was 150 / 120).
  - The six nightlies of 10-15..10-20 all stopped at 117 min:
    - Playwright preview took 63-82 min;
    - the dev phase was cut at 33-49 min, against the gate's 64;
    - the backend shards never reached their summary (backend-wait 0 s; 10-20: 3,564 of ~12,000 tests).
  - Expected full nightly on v1: about 160 min. Preview takes ~82 min plus the evidence specs on tablet, the dev server ~64 min
    and the backend ~146 min in parallel (~100 min with the template).
  - `SW_NIGHTLY_SCHEDULE=v2` brings it to about 85-95 min after v2's shadow run.
  - The runner copy (`~/nightly_tests.sh`) must be reinstalled on an idle runner for the new defaults to apply. Until then,
    the cron line can set `SW_NIGHTLY_MAX_MIN=240 SW_NIGHTLY_BRANCH_MAX_MIN=225`.
  - Trade-off: a nightly that waited for a gate (up to 3 h lock wait) can now run until about 09:00.
- **The 28 constant pixel failures** are `visual-matrix.spec.ts` in the nightly's pixel group. The nightly runs `--no-visual`,
  so the matrix spec lands in the pixel group. The same 28 cases, with identical pixel counts every night and on the retry,
  failed on main from 10-15 to 10-20. That makes them deterministic, not flaky. Triage:
  - **All 28 baselines were already re-accepted, after review, on integ/293** (VISMATRIX-FIX-293, `e04019b61`: "32 intended
    diffs, 9 stale dark baselines, plus devices-building (now the area-tiles view) and settings-diagnostics (now the health
    tab)"; a follow-up run of all 72 cases passed on the runner there). Every failing file is among the 45 refreshed ones.
  - The evidence matches that triage:
    - **stale dark baselines**: the ~0.7-0.8 ratios (devices-schedules, settings-notifications, multimedia-screens dark);
    - **a wrong-screen capture**: devices-building had the same pixel counts as devices-home (8394 / 8609 desktop,
      1452 / 1376 mobile). The routing fix `49e3407bb` / `7ab3be9f0` now captures the area-tiles view, with a guard;
    - **intended UI changes**: small 0.01-0.11 ratios (devices-home, security-alarm, live-wall, map-floor dark,
      settings-diagnostics light).
  - **No real regression was found. No baseline was refreshed here** (the 2.9.3 gate is running). The reds should go away when
    2.9.3 reaches main.
  - Verification NOT_RUN: Playwright was not allowed while the gate was pending. Check the first nightly after the 2.9.3
    merge: its pixel line must show 0 visual-matrix failures.

### 5.3 Quarantine (implemented, report only)
A test that failed on its first run (FLAKY or FAIL) in two consecutive release gates enters the quarantine. It leaves after two
consecutive gates without a first-run failure. Quarantine never skips a test: the test still runs, is retried once alone, and
counts as usual. The list goes into the report section "הסגר" and into `~/smplwise-results/quarantine.json`. It is the fix-ticket
queue (the lead files the tickets; this branch does not touch `management/tasks.json`). Today's candidates from 2.9.0-2.9.2:
`unit-tabs-config.spec.ts:124` [tablet] and the `test_messaging_accounts_*` tests. Note: a selection gate that did not run a test
counts as a clean gate for it.

### 5.4 Shadow-run recipe (v2 and/or selection)
1. Pick a sha that already has a GREEN normal gate (v1, full), for example the next release candidate right after its v1 gate,
   with no new commits.
2. On an idle runner (no `~/.gate-pending`, the tests lock free, `gate_clean.sh` before): run
   `~/release_gate.sh <same branch> --schedule v2` (add `--select-base <previous release>` to shadow the selection too).
3. Compare: `python3 ~/shadow_compare.py ~/smplwise-results/gate_<b>_<sha>.json <the v2 report .json>`. Every category must be
   `OK`: passed counts within the flaky + known slack, and no FAIL that the reference lacks. Selection categories are reported,
   not judged.
4. Read the report's resources line. If min MemAvailable < 2 GB, use `GATE_PW_SLOTS=10`.
5. `gate_clean.sh` after. Two SAME verdicts on two releases make v2 a candidate default, and the owner decides.

## 6. Tests
- `smplwise_vms/backend/tests/test_gate_speed.py` (runs in the backend suite and on Windows): v1 default and knobs, v1 backend
  command unchanged, v1-identical size split without times, the duration split, junit parsing, the cost sources, the v2 job
  coverage proof, chunking and widening bounds, the pool simulation, the pool's slot limit, crash capture and memory guard,
  tmpfs sweep/floor (POSIX only), `--plan` starting no process, `--seed-from`, and the seed keys.
- `scripts/gate/selftest_gate.py` (POSIX, runner): new cases for the default schedule, the pool plus settle with crashing fake
  Playwright jobs, and the tmpfs scratch.
- Phase 2:
  - `tests/test_db_template.py`: the equality proof and the fallback, see 5.1.
  - `tests/test_select_tests.py`, on a synthetic git repository:
    - import closure, API path, test helper, hub stop, full triggers, version-only bump, changed tests always run;
    - frontend element, spec-helper and nav rules;
    - the nightly audit and the engine filters;
    - the baseline "selection" state, the quarantine streak rules, the gate history, and the shadow comparison.


## 7. GATEEFF-295: the gate decides what a failure means (owner order 2026-10-21)

Order: improve the gate so that irrelevant and old tests never delay a release. Trigger: the 2.10.0 gate on `fef91ec0c` took
186 min and was red on 154 failures that were almost all stale tests, regenerated baselines and flakes; it then needed a manual
triage and a targeted run. Nothing below weakens a product test, deletes one, or hides one: every skip, quarantine and
classification is a visible line in the report.

### 7.1 What the 2.10.0 gate would have looked like (replay of its real report, `gate_release-2100_fef91ec0c.json`)

| Reds in that gate | Count | With this engine |
|---|---|---|
| pixel mismatches (reviewed UX changes, stale baselines) | 104 | `PIXEL_REVIEW` lane: verdict `review` (not red) until a person accepts or rejects them |
| baseline count drop (pixel 84 of 188 = 45 percent) | 1 | gone: a pixel test that produced an image counts as run (84 + 104 = 188 = 100 percent) |
| stale preview / dev tests (nn1-p2, public-ui5, frigate-ui, ...) | 47 | still RED: they fail because THIS diff changed the behaviour on purpose. The lead decides, visibly, to quarantine them (7.3) or to fix them; `gate_policy.py propose` drafts the entries in one command |
| backend (passkeys-only hook, Frigate zone delete) | 2 | still RED, same rule |
| flaky (passed alone) | 13 | FLAKY, counted across gates (7.4), never red |

So the lane for stale baselines is automatic and honest (a person must look), and a stale TEST is never excused by the machine.
That is deliberate: a test that fails because of the diff is exactly the signal a gate exists to give.

### 7.2 The lanes (every red test is in exactly one, after its retry alone)

| Lane (item status) | Meaning | Blocks the verdict? |
|---|---|---|
| `FAIL` | new red: caused by this diff, or not shown to be old | yes |
| `PREEXISTING` | also fails on the base commit (7.5) | no, listed with the evidence; `GATE_PREEXISTING=block` makes it red |
| `QUARANTINED` | a valid, unexpired entry in `gate_quarantine.json` names it (7.3) | no, listed with owner, ticket, expiry |
| `PIXEL_REVIEW` | screenshot mismatch that repeated alone (7.6) | verdict `review`: not pass, not fail |
| `FLAKY` | failed first, passed alone | no, counter |
| `KNOWN` | runner `known_issues.json` (unchanged; no expiry, so prefer the managed quarantine) | no |

Verdicts: `pass`, `fail`, `review`. `review` exits 1 (not a pass) with `state: review` in `gate_status.json`; the release is NOT ready until
`--resolve-review` turns it into `pass` or `fail`. The nightly keeps `GATE_PIXEL_LANE=0` (a mismatch stays a plain FAIL there) so
that nothing watching the nightly sees a new verdict value.

### 7.3 Managed quarantine (`scripts/gate/gate_quarantine.json`)

Every entry: `id`, `kind` (`backend` | `playwright`), the selector (`nodeid`; or `file` plus `line` or `title_contains`, optional
`project`; a whole spec file can never be quarantined), `reason`, `owner`, `added`, `expires` (at most 14 days after `added`),
`ticket` (URL or task id). Rules enforced by the engine:
- The file of the TESTED BRANCH is used (else the copy next to the engine). Entries the branch added compared with `--base`
  (default `origin/main`) are printed in the report and in the summary, so a branch cannot excuse its own red unseen.
- The test still runs and is still retried alone. Only if it still fails does it become `QUARANTINED`. A pass alone is `FLAKY`.
- An expired entry, a malformed entry (missing field, more than 14 days, whole file, bad ticket, duplicate id, `added` in the
  future) or an unreadable file is a RED item of category `quarantine`, and the entry excuses nothing.
- Entries that matched no failure in the run are listed ("remove them?").
- Nothing is ever added automatically. `python3 gate_policy.py propose <gate_*.json> --owner N --ticket T --reason R` prints draft
  entries for the red test items of a report; the lead edits and commits them.

### 7.4 Rerun alone and the flaky counter
The v1 rule stays and is now documented as the policy: every failed test is re-run once, alone (a separate process after the pool
drained; Playwright with one worker). Pass = `FLAKY`, fail again = red (or a lane). `flaky_counts.json` in the results directory
counts the GATES in which each test flaked; the summary prints `(xN)`. A retry that produces no result (cannot start, crashes, no
pytest summary) is never "passed alone": both tests stay red (this closed a gap in `backend_finish`).

### 7.5 Base comparison (is this red caused by this diff?)
After the main run and only for test-level `FAIL` items: `--base <ref>` / `GATE_BASE_REF` (default `origin/main`, the previous release).
1. The base's own gate / nightly report (same sha, in the results directory or `nightly/`): failed there = `PREEXISTING`; the category was
   run completely there and the test did not fail = new. Flaky / known there = inconclusive.
2. Otherwise the failed tests are run on the base commit in a second worktree (`~/work/gate-base-<tag>`): backend node ids in one pytest
   process, Playwright files on a fresh build of the base (preview) or its Vite dev server (dev), 2 workers. A test file that does not exist
   on the base = new.
3. Bounds: `GATE_BASE_VERIFY_SECS` (1200), `GATE_BASE_VERIFY_MAX` (80 failures; more = nothing compared, all red) and the gate's own budget.
   Anything not verified stays red and is counted as `unverified`. `GATE_BASE_VERIFY=0` switches it off. The nightly (branch = base) never does it.

### 7.6 Pixel lane: review and regenerate
A screenshot mismatch (`toHaveScreenshot` / snapshot comparison error) that repeats alone is `PIXEL_REVIEW`. The expected / actual / diff images are
copied to `gate_<b>_<sha>.logs/pixel_review/` before the next Playwright run wipes its output directory. The verdict is `review`.
A person looks at the images, then:
```
python3 ~/release_gate.py --resolve-review ~/smplwise-results/gate_<b>_<sha>.json --accept --by NAME --note "reviewed N images: heading style"
python3 ~/release_gate.py --resolve-review ... --reject --by NAME --note "layout regression on the map"
```
`--accept` makes the verdict `pass` and records who and why in the report; the baselines are regenerated on the branch in a reviewed commit
(`npx playwright test <spec> --project=<p> --update-snapshots`, see `docs/release/VISUAL_REGRESSION.md`). `--reject` makes the verdict `fail`
and counts the items as FAIL. Name and note are mandatory.

### 7.7 Change-based selection for a release gate
`decide_selection()` (runs at the start of every gate): tier L, not main, not the nightly, not partial, not `--full`, `GATE_SELECT` not `off`.
It then asks `nightly_health()`: selection is allowed only while the newest full nightly report on main is at most 48 h old, was not
terminated by its time budget and ran at least 70 percent of the backend / preview / dev baselines. Otherwise the run is the FULL tier and
the report says why (`selection_policy`). `GATE_SELECT_ENABLE=1` forces it on purpose. The previous hard refusal (rc 2) is gone.
What runs when it is allowed is unchanged from section 5.2: every touched test, the smoke set, every security / permission suite in full
(the fixed safety core, constants in `select_tests.py`), the import closure of the changed modules, and the full-tier triggers.
The nightly always runs everything (`GATE_FULL=1`) and audits what selection dropped.

### 7.8 Schedule default (v2) and the wall-clock target
- `release_gate.py` reads `gate_schedule_evidence.json` next to itself. With a record whose verdict is `SAME` the default schedule is `v2`; without it
  `v1`. `--schedule` and `GATE_SCHEDULE` always win, so `GATE_SCHEDULE=v1` goes back at once and removing the file reverts the default.
- The record is written only by `shadow_compare.py <v1 reference.json> <v2 shadow.json> --record gate_schedule_evidence.json`, and only when:
  the reference is a PASS on v1, the shadow is a PASS (or `review`) on v2, same sha, same tier, full tier (no selection), every category SAME.
- **Status: NOT validated.** No v2 gate has ever run on the runner (checked 2026-10-21: no `schedule: v2` report anywhere), so the evidence file
  is not shipped and the default is still v1. The first v2 run is the shadow run (recipe 5.4). A nightly with `SW_NIGHTLY_SCHEDULE=v2` on an
  unchanged main sha also works as the shadow if the v1 reference of that sha is complete.
- Target: tier L under 90 min on the 16-core runner (`GATE_WALL_TARGET_MIN`, reported in the summary; `GATE_TOTAL_SECS` 5400 stays the hard stop).
  `--plan` on `origin/integ/2101` (2026-10-21): v1 about 144 min (over the target), v2 about 80 min (within; excludes retries and the base comparison).
- Per-test budget: Playwright keeps its 60 s cap from `playwright.config.ts`; `GATE_PW_TEST_TIMEOUT_S` lowers it for a run. Slower passing tests
  (`GATE_SLOW_TEST_S` 45 s Playwright, `GATE_BACKEND_SLOW_S` 60 s backend from the v2 junit XML) are listed in the report and the summary.
  A backend per-test TIMEOUT is not available: `pytest-timeout` is not installed in the runner venv (checked), and installing it changes the runner.

### 7.9 The one-page summary
`gate_<b>_<sha>.summary.md` (and `LATEST_SUMMARY.md` in the results directory) is written the moment the verdict exists, before the long
report, and refreshed every 30 s while the gate runs. Counts per class, the reds that matter (at most 25 lines), pre-existing, quarantined,
the pixel lane with the exact `--resolve-review` command, flaky with counters, quarantine entries added by the branch, the selection sentence,
the slowest phases and tests, wall time against the target.

### 7.10 Tests of the tooling
- `smplwise_vms/backend/tests/test_gate_efficiency.py` (runs anywhere): entry validation (every field, 14-day maximum, ticket form, whole file),
  load / expiry / duplicates / broken file, matching, lane classification, `red()` counts and verdicts, `settle()` with a faked Playwright
  (flaky vs repeat vs pixel vs quarantine), baseline ratio with the pixel lane, expired entries as reds, base comparison (reports, run on
  base, cannot verify, same sha, too many, block policy), flaky counter, nightly health, `decide_selection`, schedule default, `--record`,
  summary size and content, `--resolve-review` (accept / reject / mandatory note), `collect_pw` images and durations, slow list, `--timeout`,
  `--plan` target, `propose`.
- `scripts/gate/selftest_gate.py` (POSIX, with the repo venv so pytest exists): backend lanes with a real mini pytest project (flaky, quarantined,
  expired, over-long entry, retry without result), pixel lane and the nightly switch, summary files.
- Two older tests were changed because their rule changed (not weakened): the v1 default now follows the evidence file, and the
  "selection is refused" test became the fall-back-to-full-tier test.
