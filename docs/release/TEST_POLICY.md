# Release test policy (risk-based)

Owner decision 2026-10-02: small releases ship fast with a focused suite; the full, comprehensive suite is reserved for large releases.
Never claim a pass that was not run; every release report states exactly which tier ran.

## Tiers

| Tier | When | What runs | Typical time |
|---|---|---|---|
| **S - small** | Fixes, settings, one screen, no shared-component or security change | `scripts/release_check.py`; backend tests of the touched modules + their direct neighbours (grep the changed file names in `smplwise_vms/backend/tests`); Playwright specs of the touched screens on all three projects (desktop, tablet, mobile); `tsc --noEmit`; a 10-minute smoke set (login/shell, home, area, security live, multimedia, settings open) | 40-70 min |
| **M - medium** | A shared component or style (`sw-page`, `sw-tabs`, tokens, `media-page`), a new setting with a /me/prefs path, a bridge change | Tier S + every spec that references the shared component (grep) + the whole backend directory of the touched domain (settings, access, automations, media...) | 1.5-2 h |
| **L - large** | New migration, RBAC/permission change, bridge allow-list, authentication, backup/restore, a new screen family, a skin/theme layer, anything an owner review flags | The FULL backend suite + the FULL Playwright suite on the dist preview + the dev-server specs + the camera-card fixture spec (the 0.1.151/0.1.152 routine) | 2.5-3 h |

A release takes the highest tier any of its changes needs. When in doubt, go one tier up.

## Always, whatever the tier
- `release_check.py` green (versions, migrations contiguous, bridge copies identical, UI built).
- Security-relevant changes (permissions, auth, request bodies, secrets, destructive actions) get a review before release.
- A nightly full run of backend + Playwright on the integration branch (when the machine is idle) keeps a current full-suite number, so a small release is never based on a stale full result.
- Known time-of-day-dependent tests (quiet hours) are run in daytime, or fixed with a frozen clock.
- Specs that import `/src/...` need the Vite dev server; the camera-card spec needs its fixture backend.
- On the Linux test machine `~/release_gate.sh <branch> [--tier S|M|L]` runs the whole tier-L routine by itself (backend in shards, tsc, build, the dist-preview specs, the dev-server specs, the camera-card fixture spec, the `-linux.png` pixel baselines when they exist, `release_check.py`), re-runs each failure once alone (a pass is reported FLAKY, not a failure), reads the allowlist `~/known_issues.json` (KNOWN) and writes a pass/fail verdict to `~/smplwise-results/gate_<branch>_<sha>.md|json` and `gate_status.json`. Fixture-backed specs other than the camera card are not part of it yet (they self-skip and are listed in the report).
- Evidence screenshots overwritten by a run are restored (`git checkout -- docs/...`) unless the change is intended.

## Parallel release gate (opt-in, 2026-10-11, branch `pilot/GATE-parallel`)

The serial tier-L gate took 5508 s (2.4.6 run 3): tsc 22 + build 11 + preview 2344 + fixture 96 + visual 84 + dev 2394 +
backend wait 550. The preview and dev stages ran one after the other, and the dev stage spent its last ~17 minutes on three
`--workers=1` chunks, one of which was a single file (`layout-bubble-screens`, 2206 s) - the machine was mostly idle then. The backend
shards (3 x 4700-5500 s in that run, 2000-2500 s in a normal one) are the other long pole.

`release_gate.sh <branch> --tier L --parallel` (or `GATE_PARALLEL=1`) changes only the scheduling. Without the flag the gate runs
exactly as before.

* One pool of `--workers=1` Playwright processes ("units") for the preview, dev-server, fixture, pixel and visual work, each on its own
  server (dist preview, Vite dev server, fixture backend + preview, visual preview: free ports; the fixture keeps its own empty data
  dir), at most `GATE_PAR_SLOTS` Chromium workers at once, longest expected unit first. Every unit has its own `--output` directory.
* Units are packed per (category, project) from the earlier gates' seconds per file and project (`pw_*.json` of the last 10 gates,
  `GATE_COSTS_FROM` first), about `GATE_PAR_CHUNK_SECS` each. A file+project above `GATE_PAR_SPLIT_SECS` whose spec has no serial mode,
  `beforeAll` or `afterAll` (and is not in `GATE_PAR_NO_SPLIT`) is split by test line - and parametrised siblings on one line by an
  anchored title grep - from a `playwright test --list` of the branch under test (with the run's own `--grep-invert`). A coverage check
  then requires every listed test of a split file to be reported exactly once (a FAIL otherwise).
* Unchanged: the false-green guards (load error / zero tests / timeout / exit code), KNOWN from `~/known_issues.json`, every failure
  retried ALONE with `--workers=1` after the WHOLE pool has finished (FLAKY when it passes), the budget, `~/.gate-pending` and the
  exclusive lock (the wrapper is unchanged), the per-category baselines, the report and `gate_status.json`. The pixel baselines run
  alone at the end of the pool (only the backend shards still run, as in the serial gate); in `--visual-block` mode the visual matrix
  does too, in the default warn mode it starts first with `GATE_PAR_VISUAL_SLOTS` slots.
* tsc and the build run side by side; the backend runs in `GATE_BACKEND_SHARDS` shards (parallel default 6), balanced by the earlier
  gates' junit seconds (`backend_s<k>.xml`, written in parallel mode only; the file size the first time).
* Memory: a unit starts only while `MemAvailable - GATE_PAR_MB_PER_SLOT x (workers of the units started in the last 30 s that still
  run) - GATE_PAR_MB_PER_SLOT x its workers >= GATE_PAR_MEM_FLOOR_MB`; when nothing of the pool runs it starts anyway (no deadlock),
  and every wait is counted. A sampler writes the minimum MemAvailable, the peak PSS of the gate's processes (by command), the peak
  slots and the peak load average into the report's "parallel" section.

| Knob | Default | Meaning |
|---|---|---|
| `--parallel` / `GATE_PARALLEL=1` | off | the pool scheduler |
| `GATE_PAR_SLOTS` | 10 | concurrent Chromium workers (one per unit); 12 on an otherwise idle runner |
| `GATE_PAR_CHUNK_SECS` | 300 | target seconds per packed unit |
| `GATE_PAR_SPLIT_SECS` | 600 | a file+project above this is split by test line / title |
| `GATE_PAR_SPLIT_TITLES` | 1 | 0 = split by line only |
| `GATE_PAR_NO_SPLIT` | - | comma list of spec files never split |
| `GATE_PAR_MEM_FLOOR_MB` / `GATE_PAR_MB_PER_SLOT` | 3072 / 800 | memory admission |
| `GATE_PAR_VISUAL_SLOTS` | 8 | slots the visual step holds (visual.mjs runs Playwright's default workers, cores / 2) |
| `GATE_BACKEND_SHARDS` | 3 serial / 6 parallel | backend pytest shards (also honoured by the serial gate when set) |
| `GATE_COSTS_FROM` | - | extra cost sources (a gate `.logs` dir or a durations txt), read before the last 10 gates |
| `GATE_ONLY_SPECS` / `GATE_ONLY_BACKEND` | - | regex on spec / backend test file names: a SUBSET run, marked in the summary and the report, never a release verdict |

Plan without running anything (on the runner, against a finished gate's reports):
`python3 scripts/gate/release_gate.py --plan --costs ~/smplwise-results/gate_<branch>_<sha>.logs [--slots N] [--frontend <dir>]`.
It prints the split files, the longest units and a simulated pool time for several slot counts.

Expected timeline from the 2.4.6 run-3 seconds (the slow, contended run; `--plan` on its 9274 per-test durations):

| | serial (measured) | parallel, 10 slots | parallel, 12 slots |
|---|---|---|---|
| before Playwright (tsc, build, release_check, servers, `--list`) | 33 s | ~50 s | ~50 s |
| Playwright (preview + fixture + visual + dev + pixel) | 4918 s | 3009 s simulated | 2553 s simulated |
| backend wait after Playwright | 550 s | 0 (15193 shard-s / 6 = ~2530 s < pool) | 0 |
| retries alone | inside the stages | ~30 s (3 flaky in run 3) | ~30 s |
| total | 5508 s (92 min) | ~3090 s (~52 min) | ~2630 s (~44 min) |

The pool is throughput-bound, not pole-bound: 29320 worker-seconds (27831 s of tests in run 3 + 5 s per unit + 0.25 s per file and
project + the visual step's 8 x 90 s) / 10 slots = 2932 s against the 3009 s simulated (102 units); the longest unit after splitting is 836 s
(`layout-bubble-screens` home-and-area [full]). On a normal day the same tests took ~0.65-0.85 of run 3's seconds (2.4.0-2.4.4:
preview 1470-1500 s, dev ~2000 s), which puts the 10-slot pool near 37 min.

Measured on the runner (subset, 6 slots, 2026-10-11, other agents' jobs running too: peak load 14.5): peak PSS of the gate's
processes 2987 MB with 6 slots busy - Chromium 2418 MB (~400 MB per worker), the Playwright runners 229 MB, vite servers ~200 MB,
backend shards + fixture 139 MB; MemAvailable fell 4.6 GB (12554 -> 7942 MB), ~770 MB per busy slot, a figure that also holds the
other users' work and Chromium's shared memory. Hence `GATE_PAR_MB_PER_SLOT=800`. For 10 slots + 6 full backend shards (~0.3 GB each)
expect a fall of about 9.5 GB from the ~13 GB an idle runner has free: about 3.5 GB left, kept at or above the 3 GB floor by the
admission check (a unit waits instead of starting). The light subset specs understate the layout sweeps' pages; the validation run's
report gives the real minimum. 12 slots only on an otherwise idle runner.

Risks: more CPU contention than the serial preview stage (10 Chromium + 6 pytest on 16 cores) can lengthen tests and raise the FLAKY
count (each is still retried alone); the Vite dev server serves more browsers at once while it is cold; a spec whose tests depend on
running in file order, without serial mode / `beforeAll`, would fail when split (a red, never a false green; add it to
`GATE_PAR_NO_SPLIT`); evidence specs of the same file now run concurrently per project (screenshots under `docs/` may be written by
two processes; nothing reads them back).

Validated so far (2026-10-11): `selftest_gate.py` on the runner (pure logic: packing, splitting, title greps, the dispatch rule, the
simulator, the pool's slot cap / exclusive units / memory admission, split coverage, cost sources, `--plan`, `--compare`; the pool
with the fake `npx`: pass, load error, exit code, FLAKY after the retry alone, FAIL after it); and a SUBSET run of the engine on the
runner (`GATE_ONLY_SPECS` = 8 spec files incl. the fixture and a pixel spec, 2 backend files, 6 slots, split threshold 10 s: 54 units,
12 split file+projects incl. the 40 title units of `evidence-electricity-skins`) against the SAME subset on the serial engine:
identical counts in every category (preview 50 / 4 skipped, dev 57 / 3, fixture 15 / 9, pixel 8, backend 10), 120 s against 222 s.
The first subset runs were red for real reasons the guards caught (a `gate_status.json` write race between the tsc and build threads;
a preview split listing that held the pixel-stable tests the units grep out) and were fixed.

Full validation (NOT RUN yet; the release lead runs it when the runner is free, after a serial reference gate on branch `<B>` at
sha `<X>`, while `origin/<B>` is still `<X>`):

```
# on the runner; the parallel copy lives in its own directory, ~/release_gate.* and ~/gateNNN/ are not touched
mkdir -p ~/gatepar ~/smplwise-results/parallel-validation
cd ~/smplwisebms && git fetch -q origin pilot/GATE-parallel
for f in release_gate.sh release_gate.py gate_baselines.json selftest_gate.py; do git show origin/pilot/GATE-parallel:scripts/gate/$f > ~/gatepar/$f; done
chmod +x ~/gatepar/release_gate.sh && python3 ~/gatepar/selftest_gate.py | tail -1                  # SELFTEST PASSED
python3 ~/gatepar/release_gate.py --plan --costs ~/smplwise-results/gate_<B-tag>_<X>.logs --slots 10   # the plan, nothing runs
touch ~/.gate-pending; free -m > ~/gatepar/free_before.txt
GATE_PARALLEL=1 GATE_PAR_SLOTS=10 GATE_RESULTS_DIR=~/smplwise-results/parallel-validation \
  GATE_COSTS_FROM=~/smplwise-results/gate_<B-tag>_<X>.logs \
  ~/gatepar/release_gate.sh <B> --tier L > ~/gatepar/validation.out 2>&1; echo "rc=$?" >> ~/gatepar/validation.out
rm -f ~/.gate-pending; free -m > ~/gatepar/free_after.txt
python3 ~/gatepar/release_gate.py --compare ~/smplwise-results/gate_<B-tag>_<X>.json ~/smplwise-results/parallel-validation/gate_<B-tag>_<X>.json
journalctl -k --since "-2h" | grep -i -E "out of memory|oom|killed process" || echo "no OOM"
```

(`GATE_RESULTS_DIR` keeps the reference report and the dashboard's `gate_status.json` untouched; `GATE_COSTS_FROM` gives the
packing the reference run's seconds, since the separate results directory has no earlier gates.)

Acceptance:
1. `--compare` exits 0: in every category the same number of tests ran (pass + flaky + known + fail) and were skipped as in the
   serial reference (2.4.6 run 3 for scale: preview 6455 / 2055 skipped, dev 636 / 96, backend 6307 / 4, fixture 15 / 9, pixel 16).
2. The verdict equals the reference's; no `split coverage`, `launcher`, `zero tests` or `load error` item; FLAKY at most the
   reference's + 3, none in `pixel`.
3. Wall clock (`wall_seconds`) at most 3300 s (55 min) with 10 slots; the goal is 3000 s (50 min) or less. The report's parallel
   section shows the per-category spans, the longest units and the simulated pool time to compare with.
4. Memory: the report's minimum MemAvailable at least 3072 MB, no OOM line in the kernel log, swap used grew by less than 1 GB
   (`free_before` / `free_after`).
5. When all of that holds twice (two releases), `--parallel` can become the release lead's default command; the serial path stays.

## Release steps (all tiers)
1. Integration branch merged, version bumped (`config.yaml`, `Dockerfile` label, `smplwise/__init__.py`, CHANGELOG head, API inventory), UI built into `smplwise_vms/www`.
2. Tier suites green; a red test is fixed or explained as pre-existing with evidence, never ignored.
3. Bilingual release notes (Hebrew and English): what was added, bugs fixed, how to enable.
4. Merge to the integration/main branches and push; the owner installs.

## Flaky tests of the 2.2.0 gate: root causes and fixes (branch `pilot/flaky-fixes`)
The 2.2.0 gate classed nine tests FLAKY (failed in the full run, passed alone). Verification helper: `pytest --sw-repeat N` (backend
`tests/conftest.py`) runs every selected test N times in one process; the runs below were made on the Linux runner through
`private/runner/run_smart.py backend <branch> <tests> --sw-repeat 20` while 24 busy-loop processes held the 16-core machine at load 24-26
(the unfixed code is run the same way from the branch `pilot/flaky-baseline` = 2.2.0 + the option only).

| Test | Root cause | Fix | Result |
|---|---|---|---|
| backend `test_intercom::test_card_capture_timeout_expiry_and_abandonment` | the abandoned session's state flips to `cancelled` inside the cancel's result callback, the `intercom.card_capture.cancel` audit row (with `trigger: abandoned`) is written only after the action returns; the test waited for the state and read `rows[-1]`, which under load was the earlier manual-cancel row (`KeyError: 'trigger'`). The later `result` rows had the same shape | test waits for the audit row itself (and for both `result` rows) | unfixed 3 of 20 failed; fixed 20 of 20 passed |
| backend `test_presence::test_token_guessing_is_throttled...` | real product timing: the per-device events limiter is a token bucket refilling 1 token/s on `time.monotonic()`; the test posts 61 times and expects the 61st to be 429, but on a slow machine the loop takes over a second and earns a token back (`200 == 429`) | the limiters read the clock through a seam (`services/presence._now`); the test freezes it | unfixed 2 of 20 failed; fixed 20 of 20 passed |
| backend `test_frigate_join::test_the_review_screen_flow_with_the_uis_own_query` | shared state: the poll cursor lives in the module dict `frigate_events.STATES`; `test_frigate_join` imports the `world` fixture but not `test_frigate_api`'s autouse `_clean`, so a cursor left by an earlier test moves the first poll's window (cursor - 600 s) past the oldest fake review and `poll()` returns 2, not 3. Deterministic on a second run in one process (19 of 20 failed in the repeat run); in the gate it depended on what ran before in the shard | the `world` fixture clears `STATES` on setup and teardown | unfixed 19 of 20 failed (state leak between repetitions); fixed 20 of 20 passed |
| preview `unit-plan-3d-determinism.spec.ts:127` [mobile] (`createTreeWalker is not a function`) | shared state between spec files in one Playwright worker: `unit-media-queue.spec.ts` set `globalThis.document = {baseURI}` and never restored it; lit-html, first imported later in that worker by the determinism spec, bound to the stub. Which spec ran first in a worker depended on scheduling | the stub is restored in `finally` (media-queue, and media-screens made exception-safe) | reproduced deterministically with `--workers=1` in file order (unfixed: 1 failed; fixed: 5 of 5 runs passed) |
| preview `unit-devices-tiles.spec.ts:116` [mobile] (panel `open` not set after `?domain=alarm`) | NOT ROOT-CAUSED. Hypothesis tested and rejected: a stale native `close` event of the sw-drawer's `<dialog>` closing a re-opened panel (no reproduction under load). Not reproduced locally in 30 of 30 runs under 16 busy loops; with 8 workers + 20 busy loops on 8 cores the run only produced 60 s timeouts (resource starvation) | none | open |
| pixel `evidence-design-foundation` "classic is pixel-stable: map" [mobile], and `pixel-nvr-encoding-batch:42` classic / domus / tesla | probable cause (not reproduced; the runner became unreachable before the failure artefacts could be read): fixed sleeps (900 / 400 / 500 ms) used as the readiness condition for a 0-pixel (40 px) comparison, so a late fixture answer, lazy chunk, enabled-state of the 3D / layers buttons or a pending Lit update lands inside the screenshot on a busy runner | `tests/pixel-settle.ts` `settlePage`: waits for fonts, network idle, no pending Lit update (shadow roots included), no image loading, no finite animation, unchanged element count and document height for 400 ms of frames | NOT VERIFIED on the runner |
