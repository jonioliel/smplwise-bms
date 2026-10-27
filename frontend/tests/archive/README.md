# Archived Playwright specs (never run)

Specs in this folder are retired: they are kept for their history and as a record of what was checked, but nothing runs them.

- `playwright.config.ts` and `playwright.unit.config.ts` ignore `**/archive/**` (`testIgnore`).
- `tsconfig.json` excludes `tests/archive` (the moved files' relative imports point one level too high and are not type-checked).
- The release gate (`scripts/gate/release_gate.py classify()`), the diff selection (`scripts/gate/select_tests.py`) and the
  nightly list only `frontend/tests/*.spec.ts` (top level), so a file here is never selected, counted or run.
- `management/test_catalog.json` does not name these files.

## owner-rounds-2026-09/ (GATELANES-297, owner approval 2026-10-27)

The September 2026 owner review rounds: `evidence-owner-round1..11.spec.ts` and `evidence-form-round9.spec.ts`
(12 files, 105 tests over the three projects). Every one needs a live backend (`SW_LIVE=1`), several wrote to the lab NVR and
rolled the change back, and none ran in a release gate or in the nightly (they skipped themselves without `SW_LIVE`).
The screens they reviewed have their current evidence / layout / pixel specs at the top level. See
`docs/testing/GATE_AUDIT_2026-10-27.md` (proposal P2) and `docs/testing/GATE_LANES.md`.

## Restoring a spec

1. Move it back with history: `git mv frontend/tests/archive/owner-rounds-2026-09/<file> frontend/tests/<file>`.
2. Its imports were written for `frontend/tests/` and work again unchanged once it is back there.
3. If it is an `evidence-*` spec, decide its tablet project in `frontend/tests/gate_tablet_allowlist.json` (the archived files were
   taken out of that list when they moved).
4. Run it on the runner first (`~/run_remote.sh spec <branch> tests/<file>`; a live spec needs `SW_LIVE=1` and the lab backend, and a
   spec that writes to a device needs the owner's task-specific approval, CLAUDE.md).
