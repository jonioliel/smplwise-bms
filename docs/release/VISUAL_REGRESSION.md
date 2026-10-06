# Visual regression in the release gate - evidence (M074, 2026-10-06)

Owner approval 2026-10-06: the automatic screenshot comparison is part of the release gate as a WARNING-ONLY step. Usage: `docs/operations/VISUAL_REGRESSION.md`.

## Baselines on 2.2.0
The 72 Linux baselines (12 cases x desktop / tablet / mobile, `frontend/tests/visual-matrix.spec.ts-snapshots/`) were NOT regenerated: against main `f0b42dd0` (2.2.0) the matrix passed 72/72 on two consecutive runner runs (`run_smart.py visual pilot/M074-gate --all`, SHA 863674e9), so the committed images are still the reference.

## Gate run, no difference (tier S, `--visual-base f9576923`)
`release_gate.sh pilot/M074-gate --tier S --visual-base f9576923` @ 5e3b6c2b: verdict PASS; report section "visual (M074, mode warn - non-blocking)": pass 72, differs 0, error 0, no baseline 0; phase `visual-matrix` 47 s.

## Gate run, deliberate difference (throwaway branch, discarded)
A throwaway branch changed one rule in `frontend/src/screens/explore-sites.ts` (top padding 10px -> 26px, pink background). `release_gate.sh <branch> --tier S` (base `origin/main`):

* Verdict PASS (second run; the first run failed on one unrelated flaky spec, `unit-devices-tiles.spec.ts:116` deep link, which passed on the rerun - the visual section was identical both times).
* Summary line: `PASS in 3m: tsc 1p/0f; build 1p/0f; release_check 1p/0f; preview 3672p/0f | WARNING (non-blocking): 6 visual difference(s), see the report's visual section`.
* Report section: pass 66, differs 6 (`sites / ready / light|dark / desktop|tablet|mobile`), listed as warnings; nothing else flagged (the other 66 images are stable).
* `diff-demo-summary.md` is the produced summary; `visual-regression-evidence/010-sites-ready-light-desktop-{expected,actual,diff}.png` are the three images of one difference (demo fixture data only, no camera frames).

The branch and its runner worktree were deleted afterwards; nothing of it reached main.

## Verified
* `selftest_gate.py` on the runner: SELFTEST PASSED (includes warn mode keeping the verdict green and the GATE_VISUAL parsing).
* Not covered: block mode on a real run (covered by the selftest logic only); tiers M/L with the visual step (same code path, not run to keep the load low).
