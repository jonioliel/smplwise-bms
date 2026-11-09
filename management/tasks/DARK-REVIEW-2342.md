# DARK-REVIEW-2342 — Dark-mode review of the screens polished on 01.11

> Generated card. Edit management/tasks.json, then run this script with --write.

**Phase:** V1 | **Priority:** P1 | **Status:** DONE

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
- **R-DARK-REVIEW-2342-1 / AT-DARK-REVIEW-2342-1:** Five dark-mode contrast fixes on the polished screens and the selected segment of every segmented control is a raised, lighter key.

## Deliverables
- Change record docs/changes/DARK-REVIEW-2342.md

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.
