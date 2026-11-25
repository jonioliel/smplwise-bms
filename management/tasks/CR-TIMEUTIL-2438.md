# CR-TIMEUTIL-2438 — CR-TIMEUTIL-2438 - one home for the UTC ISO text and the installation's time zone

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
- **R-CR-TIMEUTIL-2438-1 / AT-CR-TIMEUTIL-2438-1:** Delivered as recorded in docs/changes/CR-TIMEUTIL-2438.md: one home for the UTC ISO text and the installation's time zone

## Deliverables
- Change note docs/changes/CR-TIMEUTIL-2438.md and the code it records

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.
