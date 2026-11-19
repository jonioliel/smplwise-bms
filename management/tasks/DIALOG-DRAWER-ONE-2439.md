# DIALOG-DRAWER-ONE-2439 — DIALOG-DRAWER-ONE-2439 - one opaque dialog and one opaque drawer for the whole system

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
- **R-DIALOG-DRAWER-ONE-2439-1 / AT-DIALOG-DRAWER-ONE-2439-1:** Delivered as recorded in docs/changes/DIALOG-DRAWER-ONE-2439.md: one opaque dialog and one opaque drawer for the whole system

## Deliverables
- Change note docs/changes/DIALOG-DRAWER-ONE-2439.md and the code it records

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.
