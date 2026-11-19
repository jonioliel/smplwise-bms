# CR-TK-EXCEPT-LOG-2440 — CR-TK-EXCEPT-LOG-2440: Code review 2026-11-13, wave 3A backend. Finding 01:F-11 (broad handlers that return a default without logging). Plan row: pilot/CR-TK-EXCEPT-LOG-2436 in private/code-review-2026-11-13/MASTER_PLAN.md. Base: ...

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
- **R-CR-TK-EXCEPT-LOG-2440-1 / AT-CR-TK-EXCEPT-LOG-2440-1:** Delivered as recorded in docs/changes/CR-TK-EXCEPT-LOG-2440.md: Code review 2026-11-13, wave 3A backend. Finding 01:F-11 (broad handlers that return a default without logging). Plan row: pilot/CR-TK-EXCEPT-LOG-2436 in private/code-review-2026-11-13/MASTER_PLAN.md. Base: ...

## Deliverables
- Change note docs/changes/CR-TK-EXCEPT-LOG-2440.md and the code it records

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.
