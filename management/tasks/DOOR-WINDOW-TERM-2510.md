# DOOR-WINDOW-TERM-2510 — 'Door window' in the role, permission and notification English

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
- **R-DOOR-WINDOW-TERM-2510-1 / AT-DOOR-WINDOW-TERM-2510-1:** The English role, permission and notification texts use the term 'door window' consistently.

## Deliverables
- Branch pilot/DOOR-WINDOW-TERM-2510, change note docs/changes/DOOR-WINDOW-TERM-2510.md, tests

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.
