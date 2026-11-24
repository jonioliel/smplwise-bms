# LAB-V3-SEEK-2490 — Recordings player seek measurement in the lab (V3)

> Generated card. Edit management/tasks.json, then run this script with --write.

**Phase:** V1 | **Priority:** P2 | **Status:** BACKLOG

**Owner role:** engineering | **Hardware:** True

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
- **R-LAB-V3-SEEK-2490-1 / AT-LAB-V3-SEEK-2490-1:** Recordings player seek measurement in the lab (V3): the owner plays yesterday's recording and skips to the 8 given hours with a screenshot per skip (about 35 minutes, read-only); results recorded redacted.

## Deliverables
- Owner-run lab step with a redacted result recorded in docs/changes/

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.
