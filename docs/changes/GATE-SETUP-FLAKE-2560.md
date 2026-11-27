# GATE-SETUP-FLAKE-2560 (target 2.56)

## Problem
In the 2.55 gate (RELEASE-2550-TRAIN section 3.15, cause B) a `beforeAll` hook timeout in `evidence-curved-walls.spec.ts` on the
mobile project was attributed by Playwright to `:108`, a desktop-only test that skips itself on mobile. On the rerun alone the hook
passed and `:108` skipped. `release_gate.settle` does not count a skip as a pass, so it reported "failed again alone" (a hard failure)
for what was a setup flake.

## Change (repo copies only, scripts/gate/*)
- `release_gate.py`: new `setup_flake_self_skip()`, used in `settle()` before the "failed again alone" branch. A failed test whose
  rerun alone is a real self-skip (annotated skip/fixme, not "did not run") is classified **FLAKY**, with the note
  "setup failure (<error>), rerun green, test self-skips on this project", only when every other test of the same file and project is
  positively green (rerun result when it was rerun, else first-run result) and at least one of them really passed.
  It is never counted as a pass and never silent: it is an item in the report like any FLAKY.
- Unchanged: rerun still failing, a sibling still failing, or nothing in the file positively passed (all skips) -> failure as before.
- `selftest_gate.py`: fake modes `sf_*` and 4 cases (flaky case fails before the change: it reported "failed again alone"; the other
  three guard the reverse direction).

## Tests (runner server, slot-free fake suite, nothing installed)
- `selftest_gate.py` with the change: **SELFTEST PASSED** (all cases, including the 4 new ones).
- Same selftest with the old `release_gate.py` from the train: **FAILED, 1 case** - the new flaky case ("failed again alone"); the
  three reverse/guard cases pass on both engines, as intended.
- Playwright, product tests: NOT_RUN (not needed; gate tooling only).

## Install on the runner (owner/lead; not done by this row)
From a checkout of the merged train (dry run first, then `--apply`; an existing backup is never overwritten):
```
python3 scripts/gate/engine_sync.py install --src <checkout> --files release_gate.py,selftest_gate.py --suffix .bak_DDMM
python3 scripts/gate/engine_sync.py install --src <checkout> --files release_gate.py,selftest_gate.py --suffix .bak_DDMM --apply
python3 scripts/gate/engine_sync.py check
```
DDMM = day and month of the install. Roll back by restoring the `.bak_DDMM` copies. Run `python3 scripts/gate/selftest_gate.py` on
the runner after installing.
