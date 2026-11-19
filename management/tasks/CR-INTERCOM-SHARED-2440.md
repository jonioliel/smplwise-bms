# CR-INTERCOM-SHARED-2440 — CR-INTERCOM-SHARED-2440: Code-review batch 16.11, wave 3A (backend). Plan row pilot/CR-INTERCOM-SHARED-2436 in private/code-review-2026-11-13/MASTER_PLAN.md; findings 02:P2-6 and 02:P3-3 (the listen pump part). Base: origin/pilot/CR-WAVE2-COMBINED-2439 ...

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
- **R-CR-INTERCOM-SHARED-2440-1 / AT-CR-INTERCOM-SHARED-2440-1:** Delivered as recorded in docs/changes/CR-INTERCOM-SHARED-2440.md: Code-review batch 16.11, wave 3A (backend). Plan row pilot/CR-INTERCOM-SHARED-2436 in private/code-review-2026-11-13/MASTER_PLAN.md; findings 02:P2-6 and 02:P3-3 (the listen pump part). Base: origin/pilot/CR-WAVE2-COMBINED-2439 ...

## Deliverables
- Change note docs/changes/CR-INTERCOM-SHARED-2440.md and the code it records

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.
