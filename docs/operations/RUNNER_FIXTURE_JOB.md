# Runner fixture job

Playwright specs that need a live fixture backend used to be skipped by `run_smart.py spec` (dev server, no backend), and agents
started the fixture by hand over ssh. The `fixture` job does it in one command.

    python private/runner/run_smart.py fixture <branch> [spec ...] [--project=desktop|tablet|mobile] [--no-build]
    # example: run_smart.py fixture pilot/x evidence-arx-second-factor --project=desktop

Chain: `run_smart.py fixture` -> ssh -> `~/run_remote.sh fixture <branch> ...` -> `scripts/fixture_job.py` of the branch worktree.

## What it does
1. `run_remote.sh fixture` takes `~/.smplwise-tests.lock` SHARED (same as `visual`): it waits up to `SW_LOCK_WAIT` s (default 900)
   while a release gate or the nightly run holds it exclusively, and never fights it.
2. `fixture_job.py`: `npm run build`, then per group of `frontend/tests/fixtures/fixture_specs.json`: the fixture backend
   (`devices_fake_ha.py` or `arx_fake_ha.py`) on a free port range with its own empty data dir, the optional seed, `vite preview`
   of `frontend/dist` proxying to it (`SW_API_PORT`), then `npx playwright test` (workers=1, JSON report) with the group's
   `pw_env` (`SW_LIVE=1` plus `SW_DEVICES_FIXTURE=1` or `SW_ARX_FIXTURE=1`). Same env, ports and teardown as the gate's
   `playwright-fixture` phase, plus the `arx` group's extra free ports (fake HA at port+2).
3. Teardown: SIGTERM then SIGKILL to the process groups it started (`start_new_session`), nothing by name. Verdict per run: PASS only
   when Playwright exited 0 and at least one test really ran (all-skipped = FAIL). Output lines `FIXTURE_RESULT ...` and
   `FIXTURE_PASS` / `FIXTURE_FAIL`; logs in a temp dir printed on the last line (on the runner).
4. No real Home Assistant or device: both fixtures force `.test` hosts and refuse to run inside the add-on.

## One list for the gate and the job
`frontend/tests/fixtures/fixture_specs.json`: groups with `script`, optional `seed`, `pw_env`, `extra_ports`, and `specs`
(`gate` flag, default projects). `scripts/gate/release_gate.py` reads it (`FIXTURE_SPECS` = specs with `"gate": true`, falling back
to the built-in default when the JSON is not beside the script, as in the `~/` copy on the runner); `test_fixture_job.py` pins that
both agree.

**What the gate runs is unchanged:** only `evidence-camera-card.spec.ts` is `"gate": true`. The four specs added to the list
(`evidence-arx-second-factor`, `evidence-arx-sessions`, `evidence-custom-roles`, `evidence-plan-package` live part) are
`"gate": false`: the job can run them, the gate still does not. Promoting one is a one-flag change plus a gate baseline refresh;
note it here when done. `evidence-custom-roles` uses group `devices_floor`, which runs `seed_floor_plan.py` (a site / floor with a
published plan and two cameras through the backend's own routes) because that spec was written against the developer database.

## Runner files (private/runner, gitignored; backups beside them, suffix `.bak-fixture-20261006`)
`run_remote.sh` (new `fixture` mode, shared lock for visual and fixture), `run_smart.py` (`JOB_MODE["fixture"] = "fixture"`, usage text),
`run_smart_README_HE.md`, `tests/test_run_smart.py` (one new test). Install `run_remote.sh` as `~/run_remote.sh` on the runner.
