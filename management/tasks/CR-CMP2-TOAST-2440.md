# CR-CMP2-TOAST-2440 — CR-CMP2-TOAST-2440: 2.44.0 programme rows (private/planning/REMAINING_WORK_2026-11-18.md section C "Programmes"; code-review private/code-review-2026-11-13/MASTER_PLAN.md section 3.6):

> Generated card. Edit management/tasks.json, then run this script with --write.

**Phase:** V1 | **Priority:** P2 | **Status:** REVIEW

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
- **R-CR-CMP2-TOAST-2440-1 / AT-CR-CMP2-TOAST-2440-1:** Delivered as recorded in docs/changes/CR-CMP2-TOAST-2440.md: 2.44.0 programme rows (private/planning/REMAINING_WORK_2026-11-18.md section C "Programmes"; code-review private/code-review-2026-11-13/MASTER_PLAN.md section 3.6):

## Deliverables
- Change note docs/changes/CR-CMP2-TOAST-2440.md and the code it records

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.
