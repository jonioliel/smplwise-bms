# WISKEY-R8-2520 — Manual service grant v3: the READ, the v3 write contract, explicit path selection (row R8)

> Generated card. Edit management/tasks.json, then run this script with --write.

**Phase:** V1 | **Priority:** P2 | **Status:** IN_PROGRESS

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
- **R-WISKEY-R8-2520-1 / AT-WISKEY-R8-2520-1:** Arx reads the manual service grant v3, uses its write contract, and the people-write path is chosen explicitly; the inactive-card label explains removal after sync and readback.

## Deliverables
- Branch pilot/WISKEY-R8-2520, change note docs/changes/WISKEY-R8-2520.md, tests

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.
