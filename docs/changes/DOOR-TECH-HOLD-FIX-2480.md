# DOOR-TECH-HOLD-FIX-2480 - door technician screen: hold buttons stay usable while the screen re-reads after a write

Row of the 2.52 roadmap. Branch `pilot/DOOR-TECH-HOLD-FIX-2520`, base `origin/main` 3d71fb183 (v2.51.0).

## Finding: already delivered, no product change needed

The fix this row asks for is already in `main`, released with **v2.48.0**:

| What | Where |
|---|---|
| Fix commit | 5efb30eb1 `fix(door-tech): DOOR-TECH-REREAD-2480 - no lock and no stale write while the screen re-reads after a write (owner Q11)` on `pilot/FLAKY-SWEEP-2480` |
| Into main | 848f2ec20 `merge: RELEASE-2480-TRAIN - pilot/FLAKY-SWEEP-2480` (v2.48.0, d6f09395e) |
| Change record | `docs/changes/FLAKY-SWEEP-2480.md`, section "Session 3 (23.11): ... DOOR-TECH-REREAD" (cause, fix, proof table) |
| Comparison page | `private/planning/door_tech_2480_compare_2026-11-23.html` (private, not in git): before / after, desktop 1440 and phone 390 |
| Owner acceptance | morning questions of 23.11 (`private/planning/questions_morning_2026-11-23.html`, the door-technician question "approve the fix?"); the owner answered every morning question with the recommendation (approve) |

The task card's acceptance ("after a before/after comparison page is accepted by the owner, the hold buttons are no longer locked after
each write during the re-read; delivered on the FLAKY-SWEEP-2480 line") is therefore met. `management/tasks.json` still lists the row as
`BACKLOG` and `AT-DOOR-TECH-HOLD-FIX-2480-1` as `NOT_RUN`; this row does not edit `management/` (brief rule) - the lead records it.

### Behaviour in v2.51.0 (re-checked in `frontend/src/components/wk-door-tech.ts` at 3d71fb183)

- While a write is out (`running`), every write button and the dialog stay locked - one write at a time (unchanged, deliberate).
- When the answer arrives, `applyAnswer` draws it at once (`holdAfter` / `codeAfter` in `frontend/src/api/door-tech.ts`): an
  acknowledged hold save shows the new draft (new revision), a delete shows "no draft", a code write the slot presence.
- During the read that follows (`reread`), no button is disabled. A press is kept by `afterRead` (the button shows `busy` /
  `aria-busy`) and runs once the read is in, against the fresh state, so the confirmation carries the fresh revision. Tab switch or
  dialog close drops a kept press; `send()` still refuses while a write is out (two presses of "send" = one POST).
- Later commits touching these files after 5efb30eb1 (HAND-SWITCH-2480, COLOR-LITERAL-A-2480) are look / token refactors and leave
  this logic intact.

No visible change in this branch, so no pixel baselines and no new comparison page (the accepted 23.11 page stands).

## Files

- `docs/changes/DOOR-TECH-HOLD-FIX-2480.md` (this note) - the only file changed.

## Tests (runner, slot B, job `~/work/p2520_doorhold_run.sh 3d71fb183`; Playwright projects desktop + mobile, workers 2, retries 0)

Queued on the runner (slot B queue, ~20 jobs ahead); results are added to this note when the job has run. Until then:
NOT_RUN - `tsc --noEmit`, `vite build`, `tests/unit-wiskey-door-tech.spec.ts` + `tests/evidence-wiskey-door-tech.spec.ts`
(desktop + mobile), the two `DOOR-TECH-REREAD-2480` tests x5, and every other spec that drives `wk-door-tech`.
Last recorded run of the REREAD tests: `docs/changes/FLAKY-SWEEP-2480.md` session 3 (2.48.0 train, gate run 3 PASS).

Not run: the full frontend / backend suites (no product code changed); the lab (no device access in this row).

## Open questions

1. Close the row in `management/tasks.json` (status DONE, commit 5efb30eb1 / release 2.48.0, test `AT-DOOR-TECH-HOLD-FIX-2480-1` PASS
   with the run above)?
   a. Yes, the lead records it in the next management update (recommended).
   b. Keep it open for a lab check on the real WisKey (needs an owner-approved write window).
