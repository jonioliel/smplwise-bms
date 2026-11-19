# CR-BE-SMALL-2440 — CR-BE-SMALL-2440 - three small backend rows for 2.44.0

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
- **R-CR-BE-SMALL-2440-1 / AT-CR-BE-SMALL-2440-1:** Delivered as recorded in docs/changes/CR-BE-SMALL-2440.md: three small backend rows for 2.44.0

## Deliverables
- Change note docs/changes/CR-BE-SMALL-2440.md and the code it records

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.
