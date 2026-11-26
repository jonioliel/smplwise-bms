# AREA-HONEST-COUNT-2540 — The full interface's area row and summaries tell an unknown lock / alarm apart

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
- **R-AREA-HONEST-COUNT-2540-1 / AT-AREA-HONEST-COUNT-2540-1:** DeviceCounts carries locks_unknown / alarms_unknown (additive); an unknown lock is never 'not locked' and one unreadable alarm panel never hides a known state; the area row, floor chip, building locks tile and area popover show unknown in grey.

## Deliverables
- Branch pilot/AREA-HONEST-COUNT-2540, change note docs/changes/AREA-HONEST-COUNT-2540.md, tests

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.
