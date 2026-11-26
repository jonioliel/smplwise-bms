# HONEST-STATES-2540 — Honest lock / alarm states on the home interface; an opt-in controlled sw-toggle

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
- **R-HONEST-STATES-2540-1 / AT-HONEST-STATES-2540-1:** An offline or unknown lock is never counted, announced or coloured as an open door and an unavailable / unknown alarm panel never reads as armed on the home interface; a controlled sw-toggle moves only when the screen sets the saved value.

## Deliverables
- Branch pilot/HONEST-STATES-2540, change note docs/changes/HONEST-STATES-2540.md, tests

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.
