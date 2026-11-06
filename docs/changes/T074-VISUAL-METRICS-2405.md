# T074-VISUAL-METRICS-2405 - the visual step blocks releases (with a flaky-render policy), time to camera / time to recording

Branch `chore/T074-VISUAL-METRICS-2405`, cut from `origin/main` at `eab715e53` (v2.40.4). Board card T074 (R147, R148). No version
bump, no tag, no merge here. Two parts: release tooling (`scripts/gate/`, the runner-side copies are the lead's install step, section
5) and a small product change (the playback socket measures its time to media; the live log line gains the answer time).

## 1. Where the visual step stood (read from the repository, 2026-11-06)

- The engine (`scripts/gate/release_gate.py`, byte-identical copies in `~/`, `~/gate2/`, `~/nightly-gate/` per GATE-HYGIENE-2402) ran
  the M074 matrix (`frontend/scripts/visual.mjs run --touched` against `origin/main`) in every tier as a **warning**: differences were a
  report section, the verdict never changed. `--visual-block` existed but no wrapper passed it.
- `release_gate2.sh` (the fast gate) passed `--no-visual` whenever the plan said `pixel: no frontend/src change`; `branch_check.sh`
  (the entry check) and `nightly_tests.sh` always passed `--no-visual`. With `--no-visual` the engine leaves `visual-matrix.spec.ts`
  in the pixel group, so the nightly did compare the matrix (desktop + mobile, no retry, blocking) - the release gates did not.
- `gate2_verdict.TEST_CATS` had no `visual`: a visual failure in block mode would have been a HARD failure (never quarantinable), and the
  all-quarantined re-run (`GATE2_RERUN_ONLY=1`) is started with `--no-visual`, so a quarantined visual case would have passed the
  re-run without being looked at (a false green).
- `visual.mjs --touched` maps changed `frontend/src` files to screens; a commit that only re-takes baselines touched nothing, so a
  baseline refresh was never verified by the gate.
- The last two nightlies on main (`gate_main_ccb77f28d`, `gate_main_eab715e53`, read 2026-11-06 read-only over ssh): pixel 0 failed,
  no visual-matrix item failed or flaked. The committed linux baselines match main.

## 2. The policy (what blocks, what does not)

| outcome of one case (`screen / state / scheme / project`) | release gate / entry check / nightly |
|---|---|
| matches the baseline | pass |
| differs (or errors) on the run, **matches on one re-capture alone** right after | **FLAKY**: listed in the report and the summary warning, not a failure (the engine's existing "failed once, passed alone" rule) |
| differs on the run **and** on the re-capture | **FAIL**, category `visual` - a test failure, quarantinable |
| no linux baseline | SKIPPED_NO_BASELINE: never a pass, a summary warning, not a failure (a new matrix case must bring its baselines) |
| the step cannot run (preview did not start, `visual.mjs` produced no results, timeout) | **FAIL**, category `visual-run` - a hard failure, never quarantined |
| no screen touched | nothing (the section says so) |

Quarantine (existing mechanism, unchanged rules: ticket, owner, reason, expiry at most 7 days, `gate_quarantine.py add`): category
`visual` is now valid; `--match` is a substring of the case id, e.g. `live-wall / ready` or `sites / ready / dark / mobile`. A
quarantined case still runs in every gate. When every failure of a gate-2 run is quarantined, `release_gate2.sh` starts the re-run on
the same sha as before; the engine now re-checks **exactly** the first report's visual FAIL cases in it (block mode, with the same
one re-capture), whatever flag the wrapper passed - a second red is a real FAIL. A run whose first report had no visual failure has
no visual step in the re-run. Quarantine is for a case that flakes **twice in a row** under load; a render that flakes once is
already FLAKY, and a deterministic difference is an intended change (re-take the baseline) or a regression (fix the code).

When the step runs:

- release gate (v1 `release_gate.sh` and gate 2): ON and blocking by default (`GATE_VISUAL` unset = block). Gate 2 passes
  `--no-visual` only when `gate2_select.py plan` prints `visual: skip` - no `frontend/src` change, no change of the visual harness or a
  baseline (`frontend/tests/visual/`, `frontend/tests/visual-matrix.spec.ts*` including the snapshots folder, `frontend/scripts/visual.mjs`,
  `frontend/playwright.config`), and no visual failure in an `--after` report. A `--after` re-run after a visual failure always runs
  the step (the fix is often baselines only).
- entry check (`branch_check.sh`): the same rule (it was always `--no-visual`). Owner rule 30.10 ("a UI branch refreshes its baselines
  on the runner before joining a train") is now enforced before boarding instead of in the train gate.
- nightly (`nightly_tests.sh`): the engine's visual step on **every** screen (`GATE_VISUAL_SCOPE=all`, all three viewports, with the
  re-capture), blocking (`SW_NIGHTLY_VISUAL=block`, the default). This replaces the old path (the spec inside the pixel group, desktop +
  mobile, no re-capture, also blocking), so the nightly is as strict as before and also covers tablet. The pixel count of a full
  run drops by the matrix cases (about 135 expected of the 175 baseline, above the 70 percent guard; the note was already in
  `gate_baselines.json`).
- `visual.mjs --touched`: a changed baseline image touches its own screen (`<screen>-<state>-...png`); a change of
  `visual-matrix.spec.ts` or `visual.mjs` touches every screen.

Rollback: one run - `GATE_VISUAL=warn` in the environment (or `-- --visual` after the `release_gate2.sh` options) gives the old
warning-only step, `GATE_VISUAL=off` / `--no-visual` none; nightly - `SW_NIGHTLY_VISUAL=warn|off` (`off` = the old run exactly);
everything - restore the `.bak-t074` copies of section 5. The visual count category and `visual-run` have no count baseline
(`OPTIONAL_CATS`: the count follows the touched screens).

Report: the Hebrew "visual" section shows the first run, the re-capture (`.logs/visual-retry/summary.md`, `index.html`), the FLAKY,
FAILED and no-baseline cases; the JSON report now carries the same data under `visual` (the nightly summary prints one line from it).
`gate2_verdict.py` adds a "Visual failures (T074)" next-step paragraph (re-take with `visual.mjs accept --screens <ids>` on the runner
for an intended change, then `--after`).

## 3. Time to camera / time to recording

### What the add-on measures (server side, numbers only)

| metric | from -> to | where it is written |
|---|---|---|
| `live.mse.first_media_ms` | live socket open -> first media byte relayed (MSE) | `video.live.stop` `ttff_ms` (2.40.0), log `first media N ms` |
| `live.webrtc.answer_ms` | live socket open -> go2rtc's `webrtc/answer` | `video.live.stop` `answer_ms` (2.40.0), log `answer N ms` (**new**) |
| `playback.start.first_media_ms` | `POST /playback/sessions` (the session object) -> first media byte of generation 0: **time to recording** | `video.playback.stop` `first_media_ms` (**new**, always written, `null` = no media), log `first media N ms` (**new**) |
| `playback.seek.first_media_ms` | the seek request (generation bump) -> first media byte of the new generation | `video.playback.stop` `seek_media_ms` (**new**, newest 20), log |
| `live.no_media_ratio`, `playback.no_media_ratio` | sessions that ended without any measured media / all sessions | derived |

Product changes (`smplwise/services/playback.py`, `routers/playback.py`, `routers/media.py`): `PlaybackSession.gen_started`
(monotonic; set at creation and at every seek), `note_first_media()` (once per generation; a byte of a superseded generation measures
nothing), `media_timing()` for the two stop rows (DELETE and the beacon close); the playback socket's close line ends
`(B bytes, first media N ms)`; the live line gains `, answer N ms` (its prefix is unchanged). No new endpoint, no schema, no setting,
no frame, no URL: the rows already existed and are read by `audit.read` holders only. Not covered: a session the janitor expires
writes no stop row (its socket lines still carry the numbers); the browser's first DECODED frame (WebRTC media never crosses the
add-on) - a client-side mark would need an opt-in channel back, which R148 allows but this branch does not add.

### The metric: `scripts/gate/video_timing.py`

`video_timing.py report [--log F]... [--audit-json F]... [--db F --since-days 7] [--thresholds F] [--json OUT] [--md OUT] [--enforce]`

- Sources: add-on log text, the JSON of `GET /api/v1/audit?prefix=video.live.stop&limit=500` (and `...=video.playback.stop`), or an
  Arx SQLite copy opened read-only (`mode=ro`). A session seen in two sources counts once. Rows / lines of older versions that measured
  nothing (live before 2.40.0, playback before T074) are counted as unmeasured, never as "no media".
- Output: n, p50, p90, p95 (nearest rank), max per metric; no-media ratios; live sessions by transport and surface (resource type);
  go2rtc error classes. No session id, camera, user, stream, URL, address or error text (pinned by a test).
- Thresholds: `scripts/gate/video_timing_thresholds.json`, status **PROVISIONAL** - the values (live MSE p90 4000 ms, WebRTC answer p90
  2000 ms, playback start p90 8000 ms, seek p90 6000 ms, no-media ratios 0.25) are NOT derived from a measurement. Below
  `min_samples` (5) a check is INSUFFICIENT, and no evaluated check = NOT_EVALUATED (never a pass).
- Exit: 0 report (always, without `--enforce`); with `--enforce` 1 = a limit breached, 3 = nothing evaluated; 2 = input error.
- Nightly: when `~/smplwise-results/video_timing/` holds `*.log` / `*.json` / `*.sqlite`, the main nightly appends the section (report
  only, no `--enforce`) and writes `nightly/video_timing_<date>.json`; empty folder = a `NOT_RUN` line. Getting the input is the lead's
  read-only step (the add-on log, or the audit API with a token that has `audit.read`); nothing reaches a device.
- Calibration (next step, the lead): after 7 days of real samples set each p90 limit to about 1.5 x the measured p90, set `status` to
  `calibrated`, then decide whether the nightly passes `--enforce`. The release gate has no live video (fixtures only), so the gate
  does not report these numbers.

## 4. Tests (workstation, Windows 11, Python 3.12 venv, Node 24)

Backend tests run from `smplwise_vms/backend` with `-q -p no:cacheprovider -o addopts=`; other agents' pytest runs shared the machine.

| command | result |
|---|---|
| `pytest tests/test_gate_visual_block_t074.py` (new, 14 tests: default, judge, flaky / fail / no baseline / step not running / warn, untouched, re-run override and case filter, preview down, gate-2 verdict + quarantine + selector, wrappers, nightly) | **14 passed** |
| `pytest tests/test_video_timing_t074.py` (new, 7 tests: percentiles, log, audit merge and old rows, read-only DB window, thresholds, validation, CLI exit codes and privacy) | **7 passed** |
| `pytest tests/test_playback_timing_t074.py` (new, 4 tests: start and seek timed through the real route with a fake relay, audit row + log line, null = no media on the beacon close, once per generation + bound, the live line format parsed) | **4 passed** |
| `pytest tests/test_gate2_select.py tests/test_gate_speed.py tests/test_select_tests.py tests/test_gate_always_run.py tests/test_fixture_job.py tests/test_recordings.py tests/test_playback_release.py tests/test_video_transport_2400.py tests/test_ha_camera_live.py tests/test_targeted_plan.py tests/test_gate_addon_build.py tests/test_gate_tablet_allowlist.py tests/test_rbac_camera_scope.py tests/test_xsecfollow_297.py` | **384 passed, 6 skipped** |
| after the nightly / scope edits: `pytest tests/test_gate_visual_block_t074.py tests/test_video_timing_t074.py tests/test_gate_speed.py tests/test_gate2_select.py tests/test_gate_always_run.py` | 74 passed, 1 skipped, 1 failed (my nightly pin matched a comment) -> fixed -> `test_gate_visual_block_t074.py` 14 passed |
| `node --test scripts/visual.test.mjs` (frontend, one new case: baseline -> its screen, spec / driver -> all) | **8 passed** |
| `bash -n` on `release_gate2.sh`, `branch_check.sh`, `nightly_tests.sh` | rc 0 |
| `python scripts/release_check.py --root .` | rc 0, `RESULT: ready for the owner's approval` |

`selftest_gate.py` (the engine self-test; POSIX only) gained four visual checks and the new default - result in section 6.

## 5. Runner install (the lead, quiet window only - nothing on the runner was written by this branch)

Preconditions: `~/smplwise-results/gate_status.json` in a finished state, `entry_status.json` not `running`, no nightly running.
Read 2026-11-06: last gate `release/2404-train @ eab715e53` pass / done, last entry check done (2026-10-31).

```
ssh runner 'cd ~ && for f in release_gate.py nightly_tests.sh nightly-gate/release_gate.py gate2/release_gate2.sh gate2/gate2_select.py \
  gate2/gate2_verdict.py gate2/gate_quarantine.py gate2/branch_check.sh; do [ -f "$f" ] && cp -p "$f" "$f.bak-t074"; done'
scp scripts/gate/release_gate.py runner:~/                       # release gates; release_gate2.sh / branch_check.sh stage it into ~/gate2/ at each run
scp scripts/gate/release_gate.py scripts/gate/video_timing.py scripts/gate/video_timing_thresholds.json runner:~/nightly-gate/
scp scripts/gate/nightly_tests.sh runner:~/
scp scripts/gate/{release_gate2.sh,gate2_select.py,gate2_verdict.py,gate_quarantine.py,branch_check.sh} runner:~/gate2/
ssh runner 'chmod +x ~/nightly_tests.sh ~/gate2/release_gate2.sh ~/gate2/branch_check.sh && mkdir -p ~/smplwise-results/video_timing'
ssh runner 'md5sum ~/release_gate.py ~/nightly-gate/release_gate.py ~/gate2/{release_gate2.sh,gate2_select.py,gate2_verdict.py,gate_quarantine.py,branch_check.sh} ~/nightly_tests.sh'
scp scripts/gate/selftest_gate.py runner:~/ && ssh runner 'python3 ~/selftest_gate.py'          # must print SELFTEST PASSED
ssh runner 'cd ~/gate2 && python3 selftest_entry_check.py && python3 gate_quarantine.py check && ~/nightly_tests.sh --dry-run'
```

- Do **not** copy `gate2_quarantine.json`: the runner's copy is the live list (only its `_comment` changed here).
- `~/gate2/gate2_select.py` on the runner predates NIGHTLYRED-295 (GATE-HYGIENE-2402 noted it); copying the repository file also
  installs that change (a red nightly = an unhealthy safety net -> gate 2 runs the full tier). It is on main since `e20fd4b7e`; the
  lead decides, the alternative is to apply only the T074 hunks (`failed_files` visual set, `visual_decision`, the `visual:` plan line).
- A partial install fails safe (stricter, never greener): the new engine with the old `gate2_verdict.py` makes a visual FAIL a hard
  failure; with the old `release_gate2.sh` / `gate2_select.py` the step is skipped exactly as before when no `frontend/src` changed.
- Order with the next train: install after the train's gate, then the next UI branch's entry check is the first blocking run. A
  branch that changes a screen must carry re-taken linux baselines (`run_smart.py visual <branch> --screens <ids>` to look, then
  `visual.mjs accept` on the runner).

## 6. Results of the closing steps

- `python scripts/project_status.py --write`: rc 0, `PASS: planning registry links, dependency graph and original design hashes; 451 tasks, 560 requirements.`; the regenerated views are in the commit (`PROJECT_BOARD.html`, `management/STATUS.md`).
- `python scripts/release_check.py --root .`: rc 0, `RESULT: ready for the owner's approval`, no `[FAIL]`.
- Runner self-tests: see below (run after the first commit, streamed to a temporary directory on the runner, nothing installed).

## 7. NOT_RUN

- A real release gate, entry check or nightly with the new engine (needs the runner install of section 5).
- A real visual difference through the blocking path on the runner (covered by unit tests with `visual.mjs` faked).
- Any measurement of real time-to-camera / time-to-recording numbers: no lab data was pulled (device access is read-only and needs
  the lead's step); the thresholds stay PROVISIONAL.
- The full backend suite and the frontend Playwright suites (not touched beyond `visual.mjs`'s selection; the driver's node test ran).

## 8. Known limits

- WebRTC time to camera is the signalling answer, not the first frame (the media path bypasses the add-on).
- Visual baselines are linux-only; a workstation run compares nothing (`no baseline`) and proves nothing.
- The re-capture re-runs the whole screen on the affected projects (Playwright selects by screen); only the differing cases are judged.
- AT147 / AT148 stay NOT_RUN until a gate run on the runner and real samples exist.
