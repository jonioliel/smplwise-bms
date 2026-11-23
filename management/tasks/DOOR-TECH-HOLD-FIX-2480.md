# DOOR-TECH-HOLD-FIX-2480 — Door technician screen: hold buttons stay usable while the screen re-reads after a write

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
- **R-DOOR-TECH-HOLD-FIX-2480-1 / AT-DOOR-TECH-HOLD-FIX-2480-1:** Door technician screen: hold buttons stay usable while the screen re-reads after a write: after a before/after comparison page is accepted by the owner, the hold buttons are no longer locked after each write during the re-read; delivered on the FLAKY-SWEEP-2480 line.

## Deliverables
- Branch pilot/FLAKY-SWEEP-2480, change note docs/changes/DOOR-TECH-HOLD-FIX-2480.md, tests

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.
