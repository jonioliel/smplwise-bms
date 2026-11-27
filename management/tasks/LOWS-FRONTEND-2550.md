# LOWS-FRONTEND-2550 — The open low frontend findings of the 2.52 deep review (SCR-41..57, FC-07..12)

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
- **R-LOWS-FRONTEND-2550-1 / AT-LOWS-FRONTEND-2550-1:** The deep review's low frontend findings are fixed with a unit or page spec each that fails on the base: the room card's all-off runs once and reports what stayed on, the English home lays out left to right, destructive settings actions ask first, WisKey station writes and late poll answers are honest.

## Deliverables
- Branch pilot/LOWS-FRONTEND-2550, change note docs/changes/LOWS-FRONTEND-2550.md, tests

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.
