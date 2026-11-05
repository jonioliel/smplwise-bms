# BOARD-RULE-2404 - REVIEW may follow REVIEW dependencies; four cards marked OBSOLETE

Branch `chore/BOARD-RULE-2404` from `origin/release/2403-train` @ `5573b8e58` (BOARD-HYGIENE-2403 merged there as dc142795c).
Owner answers of 2026-11-05 (round 22, relayed by the coordinator; there is no written answers file in `private/planning/`) to the two
questions of `docs/changes/BOARD-HYGIENE-2403.md` section 4: **Q1 = ב** (change the rule), **Q2 = א** (mark the four candidates OBSOLETE).
Registry and tooling only. No runner, no lab, no device, no acceptance test run or marked PASS.

## 1. The rule change (Q1 = ב)

| Card status | Dependencies must be | Before |
|---|---|---|
| REVIEW | REVIEW or DONE | DONE |
| READY, IN_PROGRESS, VALIDATION, DONE | DONE (unchanged; MASTER_SPEC_HE.md chapter 35: Ready needs closed dependencies) | DONE |
| BACKLOG, BLOCKED | no rule (unchanged) | no rule |

- `scripts/project_status.py`: the inline check became `DEPENDENCY_RULE` + `dependency_error(task, index)`; the error now names the unmet
  dependencies (`X: dependencies not REVIEW or DONE (A, B)`). The generated `management/STATUS.md` states the rule under the header.
- Test: `smplwise_vms/backend/tests/test_board_rule_2404.py` (18 cases: every dependency state under REVIEW, the DONE-only states, BACKLOG
  / BLOCKED, unknown dependency, and three end-to-end `validate()` runs over a two-card registry). Run on the workstation together with
  `test_progress_matcher.py` and `test_task_runner.py`: 67 passed.
- Board documentation: `README_HE.md`, section "ניהול מצב" (the rule and the OBSOLETE convention).
- Not changed: `scripts/task_runner.py` keeps its own start gate (dependencies DONE, or `--gate evidence`); it decides when work may start,
  not when shipped work may be reviewed.

## 2. Applying the rule

Input: the 105 SHIPPED cards that BOARD-HYGIENE-2403 kept BACKLOG/BLOCKED by the dependency rule. They were moved to a fixpoint (a card
moves when every dependency is REVIEW or DONE, then its children are re-checked). Each moved card got a
`commit <sha> (release X, on origin/main) - 2026-11-05 (BOARD-RULE-2404)` evidence line naming its dependencies' statuses.

**Moved to REVIEW (27):** WXD1, WXD3, WXD4, WXD6, WXD7, WXD7R, WXD8, WXD9, WXD10A, WXD10B, WXH1, WXH2 (BLOCKED -> REVIEW; their blocker
text already said "not a work blocker", it is cleared), ST7S1, ST7S2, ST7S3, ST7S4, ST7S5, ST7S7, ST7INT, WXN34, WXN5, WXN6,
APP-TEAM-R11-2380, BOARD-ADMIN-2380, WALL-FOLLOWUPS-2380, ROUND4-LEFTOVERS-2380, RELEASE-2380-TRAIN.
WXD7R has no implementation commit (it was an owner-approved read run on 2026-11-04 that the owner closed); its line cites that run.

**Still pinned (78):** the G0 / pilot / beta chain and most early V1 cards. Their roots:

| Root | Status | Holds |
|---|---|---|
| T003 / T004 | BLOCKED (now OBSOLETE, below) | T006, T012, T014 directly; T035 and T070 through T004 |
| T005 | IN_PROGRESS | T008 |
| T006 | BACKLOG, class PARTLY (media-anchor / PTS mapping never measured) | T008 and with it T009 ... T097 |
| T035 (PARTLY) -> T036 -> T071, T063 (PARTLY) -> T064, T060 (PARTLY) -> T069, WXN11 (PARTLY) -> WXW | | five more |

What would free them (owner decisions, not taken here): letting an OBSOLETE / excluded dependency count as met frees nothing on its own,
because T005 and T006 also sit at the root; with T003 / T004 counted as met **and** T005 and T006 in REVIEW or DONE, 73 of the 78 move.
The rule as decided treats an OBSOLETE dependency like any other BLOCKED one.

## 3. OBSOLETE (Q2 = א)

The registry has no OBSOLETE status (`STATES` in `scripts/project_status.py`). The closest supported mechanism is the exclusion that
T003 / T004 already used since 2026-09-22 and that `scripts/progress.py` (`is_excluded`) understands: **status BLOCKED, a blocker that
starts with "Excluded", and an evidence line that starts with "EXCLUDED"**. Each card now carries `Excluded - OBSOLETE by owner decision
2026-11-05 (round 22, Q2 = א ...)` as its blocker and an `EXCLUDED - OBSOLETE ...` evidence line with its source. No card was deleted.

| Card | Status | Source decision |
|---|---|---|
| T003 | BLOCKED (unchanged) | owner exclusion 2026-09-22 (`docs/architecture/DECISIONS.md`; `docs/release/RELEASE_PACKAGE_V1.md` known limit 8) |
| T004 | BLOCKED (unchanged) | the same exclusion |
| WXD5B | BACKLOG -> BLOCKED | `docs/changes/DOORLIVE-2310.md` (owner decisions 2026-10-30): door actions go over the WisKey direct join |
| WXIMP | BACKLOG -> BLOCKED | `private/planning/OWNER_DECISIONS_2026-10-20_NIGHT.md` round 1 item 7 and round 4 item 6; `docs/changes/WISKEY-MANAGED-INSTALL-2382.md` |

Left as they are (no decision file): WXG0, WXG1, T060, T061. WXD11 still lists WXD5B as a dependency; it stays BACKLOG (PARTLY).

## 4. Counts

| | Before (5573b8e58) | After |
|---|---|---|
| REVIEW | 263 | 290 |
| BACKLOG | 123 | 96 |
| BLOCKED | 18 | 18 (WXH1, WXH2 out; WXD5B, WXIMP in) |
| IN_PROGRESS | 6 | 6 |
| DONE | 40 | 40 |

`scripts/progress.py`: before 423 / 448 cards with evidence (94 %, weighted 95 %), after 422 / 446 (95 %, weighted 95 %); excluded
2 -> 4. WXD5B was counted before and is now excluded, so the numerator drops by one; the 27 moved cards were already counted.

`scripts/project_status.py --write`: PASS; views regenerated.

## 5. NOT_RUN

The release gate and the full backend suite; every acceptance test of the moved cards keeps its recorded status. No card was given
DONE. The registry card for BOARD-RULE-2404 itself is not added here (the train coordinator registers train members).

## 6. Rollback

`git revert` of the commit restores the old rule (DONE only), the 31 statuses and the views. A rollback of the rule alone without the
statuses would make `project_status.py` fail on the 27 moved cards, so revert both together.
