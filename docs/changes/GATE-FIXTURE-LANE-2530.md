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

RESULTS_PLACEHOLDER
