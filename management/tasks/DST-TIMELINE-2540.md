# DST-TIMELINE-2540 — Rooms timeline and resident time bar on a wall-clock axis on the DST change days

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
- **R-DST-TIMELINE-2540-1 / AT-DST-TIMELINE-2540-1:** On the DST change days the rooms timeline and the resident's time bar draw every entry at its clock hour, a tap books the hour under the finger, the skipped spring hour is hatched and not bookable and the repeated autumn hour is marked x2 with its own lanes.

## Deliverables
- Branch pilot/DST-TIMELINE-2540, change note docs/changes/DST-TIMELINE-2540.md, tests

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.
