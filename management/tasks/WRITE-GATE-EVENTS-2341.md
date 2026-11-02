# WRITE-GATE-EVENTS-2341 — False "write gate held outside a transaction" log alarm removed

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
- **R-WRITE-GATE-EVENTS-2341-1 / AT-WRITE-GATE-EVENTS-2341-1:** The false "write gate held by events_ingest._write outside a transaction" alarm is gone and a camera-list read no longer takes the write lock.

## Deliverables
- Change record docs/changes/WRITE-GATE-EVENTS-2341.md

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.
