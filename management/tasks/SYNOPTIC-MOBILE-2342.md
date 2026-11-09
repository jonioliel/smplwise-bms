# SYNOPTIC-MOBILE-2342 — The synoptic map on phones in three layouts

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
- **R-SYNOPTIC-MOBILE-2342-1 / AT-SYNOPTIC-MOBILE-2342-1:** The synoptic map has three phone layouts (compact table by default, floor cards, building section) chosen in its settings, with no overlapping numbers.

## Deliverables
- Change record docs/changes/SYNOPTIC-MOBILE-2342.md

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.
