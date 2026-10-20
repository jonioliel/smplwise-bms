# Gate: tablet project for evidence specs (E4)

Applies from the 2.9.3 gate. The 2.9.2 gate is unaffected: the runner runs the installed copy of `release_gate.py`, and this
change takes effect only when the updated `release_gate.py` / `nightly_tests.sh` are installed on the runner
(`scripts/gate/INSTALL_ON_RUNNER.md`) and the tested branch contains `frontend/tests/gate_tablet_allowlist.json`.

## What changed
- `frontend/tests/gate_tablet_allowlist.json` lists every `evidence-*.spec.ts` that the gate classifies as "rest" and that ran on
  all three projects, in two reviewed lists:
  - `tablet` (121 files): explicit tablet / 1024 logic (WIDTH maps, tablet-only tests, per-project shots), or width-dependent
    assertions (scrollWidth / clientWidth / innerWidth, computed style, matchMedia, overflow guards), or kept on the owner's word
    (`evidence-access-schedules`, `evidence-curve-points`). The gate still runs these on desktop + tablet + mobile.
  - `desktop_mobile` (102 files): behaviour or canvas geometry that does not depend on the 769-1100 px layout band. The gate runs
    these on desktop + mobile only.
  - A spec in neither list keeps the tablet project (safe default, so a new evidence spec is never silently reduced).
  - A header with `--project=` or "one project" still wins over the lists.
- `release_gate.py` (`classify`, `tablet_skip_set`) applies the list; the report's classification block shows how many specs lost
  tablet. `GATE_TABLET_FULL=1` ignores the list.
- `nightly_tests.sh` sets `GATE_TABLET_FULL=1`, so the nightly runs every evidence spec on all three projects: the 1024 band is
  still checked every night (B).
- Test: `smplwise_vms/backend/tests/test_gate_tablet_allowlist.py`.

## Saved time (measured from the 2.9.1 gate, integ/291-rel @ c787ac14, per-test durations of its preview/dev/fixture reports)
| | worker time | tests |
|---|---|---|
| evidence specs on tablet today | 3489 s (58 min) | 1794 |
| of which removed from the gate | 756 s (12.6 min) | 398 |

The gate runs the preview group with `--workers=3` (several Playwright processes in parallel), so the wall-clock saving is about
12.6 / 3 = 4 min, at most about 12 min if the removed files sit on the critical chunk. Of the whole gate (about 150 min in
2.9.1) this is 3-8 percent. The biggest single items removed: plan-studio-6 (215 s), media-players (160 s), media-screens
(116 s), schedules-list (98 s), security-r1 (58 s), system-multimedia (57 s). The per-file seed `gate_durations.json` holds sums
over projects only, so the tablet share was taken from the gate's own JSON reports, not from the seed.
The `preview` baseline in `gate_baselines.json` (11664) drops by about 398 tests (3.4 percent), far above the 70 percent guard.

## Coverage trade-off (honest)
- Removed from the release gate: the 1024x768 run of the 102 listed specs. These have no tablet-specific assertions; what is lost
  is the chance that a CSS rule in the 769-1100 px band (51 `max-width: 1100px` rules in `frontend/src`) breaks one of their
  behaviour assertions at 1024, and the per-project 1024 evidence screenshots they save. The nightly still runs them.
- A regression of that kind is now found by the nightly (next morning) instead of the gate, and a release can ship in between.
- The selection is heuristic (text signals in the spec source), not a per-assertion proof. Move a file to `tablet` if a review
  finds a width dependence.
- Option C (a small dedicated tablet layout-check set) was not added: the 121-file `tablet` list plus the nightly already cover it.
