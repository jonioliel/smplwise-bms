# Release gate wall time (GATESPEED-293)

Goal: cut the tier-L release gate (151 min 12 s for 2.9.2) without dropping a test. Status: the v2 schedule is implemented
behind `--schedule v2`. The default stays `v1`, the 2.9.2 gate unchanged. v2 has NOT run on the runner yet (the runner was busy).
The first v2 run is the validation run (see "Rollout").

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

## 5. Tests
- `smplwise_vms/backend/tests/test_gate_speed.py` (runs in the backend suite and on Windows): v1 default and knobs, v1 backend
  command unchanged, v1-identical size split without times, the duration split, junit parsing, the cost sources, the v2 job
  coverage proof, chunking and widening bounds, the pool simulation, the pool's slot limit, crash capture and memory guard,
  tmpfs sweep/floor (POSIX only), `--plan` starting no process, `--seed-from`, and the seed keys.
- `scripts/gate/selftest_gate.py` (POSIX, runner): new cases for the default schedule, the pool plus settle with crashing fake
  Playwright jobs, and the tmpfs scratch.
