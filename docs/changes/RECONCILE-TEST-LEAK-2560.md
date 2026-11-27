# RECONCILE-TEST-LEAK-2560

Target 2.56. Test-only change.

## Problem
`tests/test_ha_state_reconcile_2550.py::test_a_live_event_during_the_cycle_wins_over_its_listing` and
`::test_a_refused_listing_writes_nothing` passed alone but failed in the full backend run (shard 2 of the BACKEND-SUITE-COST-2560 split).

## Root cause
`FakeHa.states` (tests/test_ha_structure_refresh.py) was `STATES + [...]`: a new list, but the SAME state dicts as the shared
`test_devices.STATES`. `test_core_reliability_2540_sync.py::test_core03_a_held_event_older_than_the_snapshot_is_skipped` edits the
`lock.front` dict in place (`st.update(state="unlocked", ...)`), so every later test that built a fake from `STATES` saw `lock.front`
as `unlocked`; the reconcile tests expected `locked`. Bisected on the runner: shard-2 files 1-56 plus the reconcile file failed,
files 57-112 plus it passed; then the pair `test_core_reliability_2540_sync.py` + the reconcile file reproduced it.

## Fix
`FakeHa.states` now starts from `copy.deepcopy(STATES)` (the owner of the shared fixture), so no test can edit the shared dicts through
a fake listing. No assertion was changed or weakened.

## Tests
See the results appended below.

- Pair `test_core_reliability_2540_sync` + `test_ha_structure_refresh` + `test_ha_state_reconcile_2550` (-p no:randomly): 30 passed (before the fix the reconcile file failed 2 after the first).
- `test_ha_state_reconcile_2550.py` alone: 10 passed.
- Shard-2 files 1-56 (the half that failed: 2 failed, 4491 passed) plus the reconcile file, gate file order, `-m "not timing_lane"`: 4493 passed, 0 failed.
- The full 3-shard run was not repeated (NOT_RUN); the shard-2 second half passed with the reconcile file before the fix.
