# TEST-STABILITY-2530 - two test-only stability fixes: the nvrless plan editor click, the engine_sync selftest

Branch `pilot/TEST-STABILITY-2530` from `origin/release/2530-train` (8ae83adfa). Target 2.53. No product code changed and no screen
changed (no baseline, no compare page). Nothing ran against the lab, a device, WisKey, go2rtc or Home Assistant; nothing was installed
into `~` or `~/gate2` on the runner. Follows up open question 1 of `docs/changes/STALE-FIXTURE-SPECS-2530.md` and open point 4 of
`docs/changes/RELEASE-2530-TRAIN.md`.

## 1. evidence-nvrless-cameras-2412 - mode b, "plan editor ... places one"

**Root cause (measured, not guessed).** A diagnostic copy of the spec (runner only, not committed) logged the editor and canvas state
around the placement click. Both runs had the editor armed (`tool: camera`, `placing: חניון`), the canvas in placing mode
(`.viewport.placing`) and fitted (scale 0.75 desktop / 0.42 tablet). The difference was the scroll position:

| Run | canvas box (desktop / tablet) | click point (30 % / 75 % of the box) | result |
|---|---|---|---|
| quiet runner (load ~8) | top -10 / -21 px, 909 px tall | y ~672 / ~661, inside the window | anchor created, PASS |
| 28 busy loops (load ~38) | top 225 / 225 px, 909 px tall | y 906 on a 900 / 768 px window | `elementFromPoint` null, no `plan-click`, no anchor, FAIL (desktop + tablet, same as the gate lane at load 40.8) |

The spec clicked at 30 % / 75 % of the canvas BOX with `page.mouse.click`. The box is taller than the window (the map column grows
with the side panel), so that point is on screen only when an earlier step happens to leave the page scrolled down; under load it stayed
at the top and the click landed below the fold, where nothing receives it.

**Fix (spec only).** Before the click the spec now waits for real readiness signals - the camera row is armed (`.on`), the canvas is in
placing mode (`.viewport.placing`), the canvas has a fitted view (`getView() !== null`) - then `settle()`. It aims at a point of the PLAN
(30 % across, 75 % down: the lower left room), mapped by the canvas's own `toScreen()`, and clicks it with `locator.click({ position })`,
which scrolls the point into view if needed and checks that the point really hits the canvas (no overlay, not off-screen). No fixed
sleep was added; `lint_spec_waits.py` reports 0 findings.

## 2. scripts/gate/selftest_engine_sync.py - hermetic against a running gate

**Cause.** `engine_sync.busy()` probes the machine with `pgrep` (`[r]elease_gate`, `[n]ightly_tests`, `[b]ranch_check.sh`). The selftest
already used a fake home for the status files, but the process half read the runner's real process table: while any `release_gate`
process ran, its `install --apply` correctly refused (rc 3) and the selftest then read a manifest that was never written.

**Fix.**
- `engine_sync.py`: the process probe is injectable - `pgrep_lines(pat)` (the real `pgrep -af`, None without pgrep), `PROC_PROBE = pgrep_lines`
  and `busy(home, probe=None)`. Production behaviour is unchanged: the default probe, the patterns, the own-command-line filter and the
  rc 3 refusal are the same code paths.
- `selftest_engine_sync.py`: `HOME` / `USERPROFILE` point at the fake home for the whole run (every `Path.home()` default), and
  `es.PROC_PROBE` is a fake process table (`FAKE_PROCS`). New cases: install refused while a `release_gate` process is listed (rc 3,
  nothing copied); the message names the pattern and the pid; engine_sync's own command line naming `release_gate.py` is not a gate; a
  nightly run is busy; quiet fake home + quiet table -> `''` whatever runs on the machine; the install goes through once the process is
  gone; production's default probe is `pgrep_lines`; and (POSIX) the real `pgrep_lines` against a fake `pgrep` on PATH (busy) and with no
  `pgrep` at all (only the status files count).
- `INSTALL_ON_RUNNER.md`: one sentence on the hermetic selftest.

## Tests run (real results)

Runner jobs `~/work/p2520_teststab_repro.sh` / `p2520_teststab_proof.sh` through `~/work/slotb.sh`, in a private worktree
(`~/work/p2520_teststab`, removed afterwards). "Load" = 28 CPU busy loops started by the job itself at the job's nice level (killed at
its end) on top of the other agents' jobs; the load average is the one the job logged.

| What | Where / command | Result |
|---|---|---|
| **Before the fix, under load** (diagnostic copy of the spec at the base 8ae83adfa) | `fixture_job.py evidence-nvrless-cameras-2412 --project=desktop --project=tablet`, load ~38 | the plan editor test FAILED on desktop and tablet (click point off-screen, see section 1); the other tests passed; run stopped after the first group |
| Before the fix, quiet runner (same diagnostic copy) | same command, load ~8 | PASS: 10 / 6 / 2 expected, 0 unexpected (b / a / d) |
| **After the fix, under load, 4 repeat runs, all three widths** | `fixture_job.py evidence-nvrless-cameras-2412 --project=desktop --project=tablet --project=mobile` x4 (build once, then `--no-build`), at 23791ee75, load 32 - 60 | **4 / 4 PASS**: each run nvrless_cameras (b) 14 expected / 0 unexpected, stage a 9 / 0, nvrless_recorder (d) 3 / 0 |
| **selftest_engine_sync, base, a gate "running"** (fake `pgrep` first on PATH listing a `release_gate.py` process) | `PATH=<fakegate>:$PATH python3 selftest_engine_sync.py` (the base copy) | rc 1: `FileNotFoundError ... gate_install_manifest.json` - the reported failure, reproduced |
| selftest_engine_sync, base, quiet | `python3 selftest_engine_sync.py` (base) | rc 0, SELFTEST PASSED (13 OK) |
| **selftest_engine_sync, head, a gate "running"** | same fake `pgrep` on PATH, the branch's file | **rc 0, SELFTEST PASSED (22 OK, 0 BROKEN)** |
| selftest_engine_sync, head, quiet | runner and PC (`py -3.12`) | rc 0, SELFTEST PASSED (runner 22 OK; PC 20 OK - the two fake-`pgrep` cases are POSIX only) |
| `selftest_gate.py` | runner, the branch's tree | rc 0, SELFTEST PASSED |
| `npm run -s typecheck` (tests + scripts) | runner | rc 0, 0 errors |
| `lint_spec_waits.py` on the spec | runner and PC | 0 findings |
| eslint on the spec | runner | NOT_RUN in effect: eslint reports the file as ignored by the config (0 errors, 1 "file ignored" warning), as before this row |
| ruff on `engine_sync.py`, `selftest_engine_sync.py` | runner venv / PC | 1 finding, pre-existing at the base: RUF100 unused `noqa: E402` on the `import engine_sync` line (unchanged line) |

NOT_RUN: a release gate or the fixture lane through `release_gate.py` (the fixture job runs the same groups with the same backends);
a real release gate running concurrently with the selftest (simulated with the fake `pgrep`, which is exactly what `busy()` reads);
the engine is not installed on the runner (lead's step).

## Files

- `frontend/tests/evidence-nvrless-cameras-2412.spec.ts` (the placement click)
- `scripts/gate/engine_sync.py` (injectable process probe; behaviour unchanged)
- `scripts/gate/selftest_engine_sync.py` (temp HOME, fake process table, new cases)
- `scripts/gate/INSTALL_ON_RUNNER.md`
- `docs/changes/TEST-STABILITY-2530.md`

Files of the 2.52 train rows: none touched. `engine_sync.py` is in the engine install group: the runner copies change only at the next
`engine_sync.py install --apply` by the lead (not done here); it is not a STRICT file of the drift check, so the gate is not refused.

## Open questions (recommendation first)

1. The diagnostic copy of the spec (state of the editor and canvas around the click) is not committed: (a) leave it out, the change note
   records what it found [recommended]; (b) commit a `SW_DIAG=1` switch in the spec.
