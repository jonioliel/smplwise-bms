# PILOT-ROLLBACK-2550 — Safe rollback of an add-on version: downgrade-safety check of migrations, pilot runbook, commit-time disk-full and clock-jump fixes (T035, T036)

> Generated card. Edit management/tasks.json, then run this script with --write.

**Phase:** V1 | **Priority:** P1 | **Status:** REVIEW

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
- **R-PILOT-ROLLBACK-2550-1 / AT-PILOT-ROLLBACK-2550-1:** Every migration since the previous release is checked backward compatible (or carries a Rollback note) by release_check; a refused COMMIT answers 507 storage_full and is rolled back at once; outages and coverage gaps are measured on the monotonic clock when the wall clock jumps.

## Deliverables
- Branch pilot/PILOT-ROLLBACK-2550, change note docs/changes/PILOT-ROLLBACK-2550.md, tests

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.
