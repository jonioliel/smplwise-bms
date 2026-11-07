# BOARD-DECISIONS-2407 - an OBSOLETE dependency counts as met; WXG0 / WXG1 OBSOLETE; T006 / T070 lose T003 / T004; new lock-file card

Branch `chore/BOARD-DECISIONS-2407` from `origin/release/2406-train` @ `51ac656a2`.
Owner decisions of 2026-11-07, relayed by the lead (there is no written answers file in `private/planning/`).
Registry and tooling only. No runner, no lab, no device, no acceptance test run or marked PASS.

## 1. The rule change

A dependency on an **OBSOLETE** card now counts as satisfied under every status rule of BOARD-RULE-2404:

| Card status | Dependencies must be | Before |
|---|---|---|
| REVIEW | REVIEW, DONE or OBSOLETE | REVIEW or DONE |
| READY, IN_PROGRESS, VALIDATION, DONE | DONE or OBSOLETE | DONE |
| BACKLOG, BLOCKED | no rule (unchanged) | no rule |

OBSOLETE is still not a status. A card is OBSOLETE when all three marks hold: status `BLOCKED`, a blocker that starts with
`Excluded - OBSOLETE`, and at least one evidence line that starts with `EXCLUDED`. A plain BLOCKED card, or one excluded without the
OBSOLETE mark (`Excluded - owner decision ...`), still counts as unmet; so does an unknown dependency.

- `scripts/project_status.py`: `OBSOLETE_BLOCKER_PREFIX`, `is_obsolete(task)` and `dependency_met(dep_id, allowed, index)`;
  `dependency_error` uses them. The generated `management/STATUS.md` header states the new clause.
- `README_HE.md`, section "ניהול מצב": one sentence added to the OBSOLETE paragraph.
- Test: `smplwise_vms/backend/tests/test_board_decisions_2407.py` (21 cases: the three marks and every partial mark, a missing card, an
  OBSOLETE dependency under each of the five ruled statuses, plain BLOCKED still unmet, an OBSOLETE dependency next to an unmet one,
  unknown dependency, two end-to-end `validate()` runs, the STATUS header text after `generate()`, and the real registry: T003, T004,
  WXG0, WXG1 are OBSOLETE and T006 / T070 no longer list T003 / T004). `test_board_rule_2404.py` is unchanged and still passes.
- Not changed: `scripts/task_runner.py` (its own start gate) and `scripts/progress.py` (`is_excluded` already covers OBSOLETE cards).

## 2. Registry edits

| Card | Change | Status |
|---|---|---|
| T006 | dependency T003 removed (the legacy comparison is done in the lab session now); dependencies now none | BACKLOG (unchanged; PARTLY: the media-anchor / PTS measurement LAB-T006-01 is still open) |
| T070 | dependency T004 removed; dependencies now T036, T055, T068 | BACKLOG (unchanged) |
| WXG0 | OBSOLETE: the WX3 gate tool checks a WisKey source folder; superseded by the managed bundle checked against `MANAGED_MANIFEST.json` behind the Core provenance gate (answer to question 1 of `V1-REMAINING-2406.md`) | BACKLOG -> BLOCKED |
| WXG1 | OBSOLETE, same reason (it extends WXG0) | BACKLOG -> BLOCKED |
| T005 | decisions on the secret-scan findings of `T005-AUDIT-2406.md` section 3 recorded: N3 the lab value in 4 tests is replaced by a documentation value (the lead, on the 2.40.6 train; not in this branch's base); N4 the owner checks the 2 history-only password-like values himself; N5 `private/` in the public history goes with the licence + private repo plan, no history rewrite now; N1 -> the new card below. AT009 / AT010 not marked | IN_PROGRESS (unchanged) |
| PY-CONSTRAINTS-2407 (new) | "Python constraints lock file for the add-on + Supervisor build check" (owner decision 7.2, finding N1): per-arch constraints lock with hashes generated on the runner, drift test against `requirements.txt`, and a Supervisor-equivalent build check in the release gate / checklist. Requirements `R-PY-CONSTRAINTS-2407-1/-2`, acceptance tests `AT-PY-CONSTRAINTS-2407-1/-2` (NOT_RUN stubs) | BACKLOG (no card in the registry is READY; work needs the runner) |

Every edit carries an evidence line tagged `2026-11-07 (BOARD-DECISIONS-2407)`. No card was deleted, none moved to REVIEW or DONE.

## 3. Effect on the stuck cards

Input: the SHIPPED cards of `BOARD-HYGIENE-2403.md` still in BACKLOG / BLOCKED (78, the set BOARD-RULE-2404 left pinned). A fixpoint
under the old rule and under the new rule with the T006 / T070 edits:

| | Old rule | New rule + edits |
|---|---|---|
| Stuck SHIPPED cards | 78 | 78 |
| Free to move to REVIEW | 0 | **0** |

As BOARD-RULE-2404 section 2 predicted, the OBSOLETE clause frees nothing on its own: T003 / T004 are no longer an unmet dependency
of T006, T012, T014, T035 or T070, but every one of those still waits for T005 (IN_PROGRESS) or T006 (BACKLOG, PARTLY) somewhere
upstream (T008 <- T005, T006; T009 ... T097 <- T008). Freeing the chain needs T005 and T006 in REVIEW or DONE: T005 waits for N3 on
the train and the owner's N4 check, T006 for the lab session (LAB-T006-01). WXD11 (PARTLY) no longer counts WXD5B as unmet but still
waits for WXD5A.

## 4. Counts

| Status | Before (51ac656a2) | After |
|---|---|---|
| REVIEW | 294 | 294 |
| BACKLOG | 96 | 95 (WXG0, WXG1 out; PY-CONSTRAINTS-2407 in) |
| BLOCKED | 18 | 20 (WXG0, WXG1) |
| DONE | 40 | 40 |
| IN_PROGRESS | 3 | 3 |
| Total | 451 | 452 |

`scripts/progress.py`: before 434 / 447 cards with evidence (97 %, weighted 97 %), excluded 4; after 434 / 446 (97 %, weighted 98 %),
excluded 6 (WXG0 and WXG1 leave the denominator, the new card enters it without evidence).

`scripts/project_status.py --write`: PASS (452 tasks, 562 requirements); views regenerated.

## 5. NOT_RUN

The release gate and the full backend suite; every acceptance test keeps its recorded status. The registry card for
BOARD-DECISIONS-2407 itself is not added here (the train coordinator registers train members).

## 6. Rollback

`git revert` of the commit restores the old rule, the four card states, the T006 / T070 dependencies, removes the new card with its
requirement and test stubs, and regenerates nothing by itself: run `python scripts/project_status.py --write` afterwards.
