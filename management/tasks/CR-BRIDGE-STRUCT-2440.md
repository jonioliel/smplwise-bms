# CR-BRIDGE-STRUCT-2440 — CR-BRIDGE-STRUCT-2440 - NOT IMPLEMENTED: the row's premise does not hold (lead decision needed)

> Generated card. Edit management/tasks.json, then run this script with --write.

**Phase:** V1 | **Priority:** P2 | **Status:** BACKLOG

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
- **R-CR-BRIDGE-STRUCT-2440-1 / AT-CR-BRIDGE-STRUCT-2440-1:** Decide the CR-BRIDGE-STRUCT row (bridge runtime object, one services table) against the pins recorded in docs/changes/CR-BRIDGE-STRUCT-2440.md: implement as a pure move, change the pins with approval, or close the row.

## Deliverables
- Change note docs/changes/CR-BRIDGE-STRUCT-2440.md and the code it records

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.
