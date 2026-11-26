# CORE-RELIABILITY-2540 — Backend core fixes: state sync window, backup outside the write lock, bearer rate limit, app factor rule

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
- **R-CORE-RELIABILITY-2540-1 / AT-CORE-RELIABILITY-2540-1:** A state change between the HA snapshot and the subscription is applied; the daily and manual backups compress without holding the write lock; re-validating an existing bearer session is not billed to the sign-in limit; the app web session admits every factor the remote sign-in admits.

## Deliverables
- Branch pilot/CORE-RELIABILITY-2540, change note docs/changes/CORE-RELIABILITY-2540.md, tests

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.
