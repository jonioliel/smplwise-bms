# DOOR-BLOCKS-I18N-2510 — The door blocks screen and the run guard in the reader's language

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
- **R-DOOR-BLOCKS-I18N-2510-1 / AT-DOOR-BLOCKS-I18N-2510-1:** The door blocks screen and the door run guard texts are in the reader's language, with tests.

## Deliverables
- Branch pilot/DOOR-BLOCKS-I18N-2510, change note docs/changes/DOOR-BLOCKS-I18N-2510.md, tests

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.
