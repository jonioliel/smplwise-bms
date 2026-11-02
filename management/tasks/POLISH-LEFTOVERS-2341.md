# POLISH-LEFTOVERS-2341 — Three leftovers of the 2.33.1 polish round

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
- **R-POLISH-LEFTOVERS-2341-1 / AT-POLISH-LEFTOVERS-2341-1:** The three leftovers of the 2.33.1 design polish round are closed (see the change record).

## Deliverables
- Change record docs/changes/POLISH-LEFTOVERS-2341.md

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.
