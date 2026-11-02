# PRESENCE-COMPACT-2310 — Presence card: compact redesign (owner rejected the tall card 30.10)

> Generated card. Edit management/tasks.json, then run this script with --write.

**Phase:** V1 | **Priority:** P2 | **Status:** REVIEW

**Owner role:** design | **Hardware:** False

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
- **R-PRESENCE-COMPACT-2310-1 / AT-PRESENCE-COMPACT-2310-1:** The building presence card is a compact strip of active rooms (four styles; empty rooms, details and "empty since" are settings) never taller than its neighbours, and the area window shows the room status.

## Deliverables
- Code and tests in git history of pilot/PRESENCE-COMPACT-2310

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.
