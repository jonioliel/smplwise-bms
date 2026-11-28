# FIX-HOME-MAPS-2570 — Deep review fixes MH-02..MH-04: A/C setpoint order, jammed / moving locks never open, busy note on the room all-off

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
- **R-FIX-HOME-MAPS-2570-1 / AT-FIX-HOME-MAPS-2570-1:** Deep review fixes MH-02..MH-04: A/C setpoint order, jammed / moving locks never open, busy note on the room all-off; merged into the 2.57.0 train, change note docs/changes/FIX-HOME-MAPS-2570.md.

## Deliverables
- Branch pilot/FIX-HOME-MAPS-2570, change note docs/changes/FIX-HOME-MAPS-2570.md, tests

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.
