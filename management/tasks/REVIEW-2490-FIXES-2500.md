# REVIEW-2490-FIXES-2500 — The three findings of the 2.49.0 review, fixed for 2.50

> Generated card. Edit management/tasks.json, then run this script with --write.

**Phase:** V1 | **Priority:** P2 | **Status:** DONE

**Owner role:** engineering | **Hardware:** False

**Dependencies:** None

**Chapters:** 

**Screens:** N/A

## Model policy — not a live model switch
```json
{
  "implementation": "balanced",
  "review": "balanced",
  "effort": "medium",
  "escalation": "Triage the failure; at most 2 repair attempts, then explicit review. No automatic spending authorization."
}
```

## Acceptance
- **R-REVIEW-2490-FIXES-2500-1 / AT-REVIEW-2490-FIXES-2500-1:** The three findings of the 2.49.0 code review are fixed with regression tests (docs/changes/REVIEW-2490-FIXES-2500.md).

## Deliverables
- Branch pilot/REVIEW-2490-FIXES-2500, change note docs/changes/REVIEW-2490-FIXES-2500.md, tests

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.
