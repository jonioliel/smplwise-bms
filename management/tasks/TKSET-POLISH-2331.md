# TKSET-POLISH-2331 — Service request settings and side screens polish

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
- **R-TKSET-POLISH-2331-1 / AT-TKSET-POLISH-2331-1:** Service request settings and side screens use one column below 1000 px, one save pattern per card and clearer loading and switched-off states.

## Deliverables
- Change record docs/changes/TKSET-POLISH-2331.md

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.
