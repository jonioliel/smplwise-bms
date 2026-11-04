# LAB-NVR-DOOR-READONLY-0411 — Read-only checks of 04.11 evening: recorder sub streams of two panoramic cameras, door contact input on one station

> Generated card. Edit management/tasks.json, then run this script with --write.

**Phase:** V1 | **Priority:** P1 | **Status:** REVIEW

**Owner role:** qa | **Hardware:** False

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
- **R-LAB-NVR-DOOR-READONLY-0411-1 / AT-LAB-NVR-DOOR-READONLY-0411-1:** With the owner's approval (round 19 Q5a, Q3a), read-only reads of the recorder and of one door station explain the missing sub stream and the odd door events, and name the owner's next physical step; nothing is written.

## Deliverables
- Implementation and regression tests on an isolated branch
- Change record and known limits

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.
