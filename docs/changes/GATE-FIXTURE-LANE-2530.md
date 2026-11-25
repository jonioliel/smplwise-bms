# GATE-FIXTURE-LANE-2530 - the fixture lane: the fixture-backed specs no released gate ever ran

Branch `pilot/GATE-FIXTURE-LANE-2530` from `origin/release/2520-train` (c128c2f86, includes the GATE-HARDEN-2520 engine). Target 2.53.
No product code changed; test infrastructure (gate engine, fixture job, the fixture spec list) and docs only. Nothing ran against the
lab, a device, WisKey, go2rtc or Home Assistant: every backend here is a committed fixture that forces `.test` hosts and refuses to
start inside the add-on.

## Why

`docs/changes/ACCEPT-SWEEP-2530.md` (origin/chore/ACCEPT-SWEEP-2530) left seven cards plus the two HAND-SWITCH-HOME cards in REVIEW
because their evidence specs self-skip in every released gate: the gate started ONE fixture backend (`devices_fake_ha.py`) for three
specs; anything needing another backend (nvrless cameras, multi-NVR, media, WisKey) or only an env switch (`DP_OUT`, `SW_SHOTS=1`)
never ran.

## What changed

- `frontend/tests/fixtures/fixture_specs.json` (the one list, read by the gate and `scripts/fixture_job.py`): schema extended
  (`_schema` key documents it) - `script: null` (no backend), `backend_env`, placeholders `{port}` / `{port+N}` / `{out}`, `then`
  stages (backend restarted on the same data dir and port), a spec may sit in more than one group. New gate groups `nvrless_cameras`
  (b, then a), `nvrless_recorder` (d), `media_ma`, `media_sonos`, `wiskey`, `shots_devpolish`, `shots_home_personal`,
  `shots_home_edit`; `evidence-floorstrip` and `evidence-home-screen` flipped to `"gate": true` in `devices`.
- `scripts/gate/release_gate.py` (the engine - drift check: re-install after merge):
  - `fixture_groups(fe)`: the groups come from the WORKTREE under test (the `~/` copy runs whatever groups the branch declares;
    a worktree without the JSON falls back to the devices group and its three original specs);
  - `classify()` puts every gate fixture spec in `fixture` and builds `fixture_groups` (projects from the JSON, else the header);
    the diff selection (`filter_classification`) narrows the groups too;
  - `fixture_block(..., gname)`: one group = its backend on free ports (`free_port_range`) with its own data dir, a vite preview, its
    specs per project set with the group's env, settled (retry alone / FLAKY / FAIL) under category `fixture`, then each `then` stage
    (`reap_wait` frees the port first); v1 runs the groups in the fixture phase, v2 makes one pool job per group (slot weight 2 with a
    backend, 1 without; estimate = recorded costs x stages + 45 s);
  - `GATE_LANE=fixture`: modules + vite build, then ONLY the fixture groups (`GATE_FIXTURE_SLOTS`, default 2, at a time;
    `GATE_FIXTURE_GROUPS=a,b`), own worktree `~/work/fxlane-<branch>`, own results dir (defaults to
    `~/smplwise-results/fixture-lane`, never the gate's `gate_status.json`), no count-baseline check.
- `scripts/gate/fixture_lane.sh` (new): runs the engine next to it with `GATE_LANE=fixture` (waits for the gate lock to be free, takes
  `~/.smplwise-tests.lock` shared, like the timing lane). `engine_sync.py` maps it (`--files fixture_lane.sh`).
- `scripts/fixture_job.py`: the same schema (stages, placeholders, no-backend groups), `--gate` (only the gate specs).
- Tests: `smplwise_vms/backend/tests/test_fixture_job.py` (the gate and the job agree on the new set; placeholders expand the same in
  both; every placeholder known and within `extra_ports`; stages; one v2 pool job per group; the devices fallback; the selection
  narrows the groups).
- Docs: `docs/testing/GATE_LANES.md` section 5, `docs/operations/RUNNER_FIXTURE_JOB.md`, `scripts/gate/INSTALL_ON_RUNNER.md`.

## Specs now covered (gate set, `"gate": true`) - and what still cannot run

| Spec | Group(s) | Card | Runner result (lane run 2, f8f3ecb6f) |
|---|---|---|---|
| evidence-floorstrip.spec.ts | devices | FLOORSTRIP | 4 passed (desktop + mobile; every skin x scheme inside a test) |
| evidence-nvrless-cameras-2412.spec.ts | nvrless_cameras (b, then a), nvrless_recorder (d) | EVIDENCE-CAMERAS-2412 | b 14 passed, a 9 passed, d 3 passed (other project / mode tests skip by design) |
| devpolish-2331-shoot.spec.ts | shots_devpolish (no backend, `DP_OUT`) | DEVICES-POLISH-2331 | 100 passed (10 screens x 5 sizes x 2 schemes; 100 PNGs + metrics.txt) |
| hand-switch-home-personal-2500-shots.spec.ts | shots_home_personal (no backend, `SW_SHOTS=1`) | HAND-SWITCH-HOME-PERSONAL-2490 | 4 passed (captures) |
| hand-switch-home-edit-2500-shots.spec.ts | shots_home_edit (no backend, `SW_SHOTS=1`) | HAND-SWITCH-HOME-EDIT-2500 | 4 passed (captures) |
| (unchanged) evidence-camera-card / -curved-walls / -curve-points | devices | CURVEDGATE-297 etc. | 15 / 6 / 7 passed |

Listed in the JSON (`fixture_job.py` runs them) but `"gate": false`, the reason in `_why_not_gate` - REAL failures, each also failing
when retried alone (lane run 1, efda5f63e, full set):

- **evidence-home-screen.spec.ts** (HAND-SWITCH-HOME-PERSONAL / -EDIT behaviour): 21 passed, 2 failed - desktop, direction b, cards
  and tiles view at 1440x900: the page `main` scrolls (918 / 900 px), against the no-scroll rule of the control screens. Product
  layout defect, not a harness problem.
- **evidence-media-players-live.spec.ts** (CR-MULTIMEDIA-BASE-2440): ma 43 passed / 6 failed, sonos 40 passed / 4 failed. The spec was
  written against the CR-016 contract before S1-S3 existed ("UNVERIFIED until S1-S3 merge" in its header); the failures are those
  guesses: "unplaced devices are listed last", the favourites tab text, group leave answers `unknown` where `left` is expected, a
  cross-brand group's room name.
- **evidence-wiskey-people / -editor / -capture.spec.ts** (CR-WISKEY-NOTIF-2443, DIALOG-DRAWER-ONE-2439): the first test of each serial
  group fails (no row in 30 s), the other 19 do not run. They drive the pre-CR-036 people screen (`sw-table[data-wiskey-people-table]`
  fed by `/intercom/people`); the native screen (CR-036 S7) reads `/api/v1/access-control/people` and draws
  `div.tablewrap[data-wiskey-people-table]` - stale specs (and the fixture may need the access-control answers). This is the same
  "harness" failure LAB-ACCEPT-2311 saw.
- Part 1 of evidence-wiskey-people (a backend with NO Home Assistant, `ha_not_configured`): no fixture group is that; stays skipped.
- **layout-bubble-screens.spec.ts** (MEDIA-POLISH-2331): not a fixture problem - the whole file skips while the bubble skin is frozen
  (owner decision BUBBLE-FREEZE-295). Cannot run until the skin is unfrozen; not in the lane.

## Tests run (real results)

| What | Where / command | Result |
|---|---|---|
| `tests/test_fixture_job.py` (16 tests) | PC, `py -3.12 -m pytest -q -p no:cacheprovider -o addopts= --noconftest tests/test_fixture_job.py` | 16 passed |
| Fixture lane run 1, every listed group incl. the later-excluded ones | runner, slot B/priority, `GATE_LANE=fixture GATE_RESULTS_DIR=~/work/fixturelane-res python3 scripts/gate/release_gate.py pilot/GATE-FIXTURE-LANE-2530 --tier L --no-visual` at efda5f63e | all groups ran in ~16 min (2 slots); failures above; the report step crashed (`KeyError 'slots'`, the lane's pool summary shape) - fixed |
| Fixture lane run 2, the gate set | same command at f8f3ecb6f | **PASS in 7 m: build 1p; fixture 166 passed / 0 failed / 0 flaky**; report `gate_pilot-GATE-FIXTURE-LANE-2530_f8f3ecb6f.md` |
| `selftest_gate.py`, `selftest_engine_sync.py`, `selftest_gate_fast.py` | runner at f8f3ecb6f | SELFTEST PASSED x3 |
| `release_gate.py --plan --root <checkout> --tier L` | runner at f8f3ecb6f | classification fixture 8 files; v2 pool shows one `fixture_<group>` job per group |
| `bash -n scripts/gate/fixture_lane.sh` | runner | rc 0 |
| ruff on the changed Python files | runner, repo-root config | the engine and `fixture_job.py` carry pre-existing findings (61 in all, `scripts/` is not ruff-gated); the new code's UP031 / BLE001 were tidied; `test_fixture_job.py` clean |
| FINAL_RUN_PLACEHOLDER |

NOT_RUN: a real release gate with the new engine (needs the engine re-installed with `engine_sync.py` after the merge; the drift check
refuses otherwise); `fixture_lane.sh` itself (it takes `~/.smplwise-tests.lock` shared, which this row may not; the engine it runs was
run directly instead); the nightly. The compare pages of HAND-SWITCH-HOME-* (the captures exist in the lane's logs folder; building the
pages is the cards' own follow-up).

## Runtime

Lane alone, 2 groups at a time: 7 minutes for the gate set (devpolish 4.6 min is the longest group). Inside a v2 gate the groups are
pool jobs (weight 2 with a backend, 1 without) next to the preview chunks, adding about 13 worker-minutes.

## Open questions (recommendation first)

1. Home-screen 18 px scroll at 1440x900 (direction b): (a) open a fix row, flip `evidence-home-screen` to gate after it [recommended];
   (b) flip it now and let the next gate go red until fixed.
2. Media spec guesses: (a) a spec follow-up row that checks each failing assertion against the real CR-016 UI, then flip [recommended];
   (b) leave it job-only.
3. WisKey specs: (a) rewrite the three specs for the native people screen (+ fixture access-control answers) in a WisKey row, then flip
   [recommended]; (b) retire them.
4. Gate 2 (`--select-base`) keeps only the selected fixture specs, as before: (a) keep (full gates run the whole lane) [recommended];
   (b) put the lane in gate 2's always-run core (+~13 worker-minutes per targeted gate).

## Rollback

Revert the branch's commits; re-install the previous engine with `engine_sync.py` (backups `.bak_<suffix>`). No product file, data or
setting changes.
