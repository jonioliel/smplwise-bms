# CR-ACTIVE-USER-REST-2438 — CR-ACTIVE-USER-REST-2438 - every per-user "active" check uses the one definition

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
- **R-CR-ACTIVE-USER-REST-2438-1 / AT-CR-ACTIVE-USER-REST-2438-1:** Delivered as recorded in docs/changes/CR-ACTIVE-USER-REST-2438.md: every per-user "active" check uses the one definition

## Deliverables
- Change note docs/changes/CR-ACTIVE-USER-REST-2438.md and the code it records

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.
