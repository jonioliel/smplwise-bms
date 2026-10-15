# TKFIX256 — Service management 2.5.6: 'waiting for a part' is a sub-state of 'in progress' (status strip, chips, menus, vendor toggle), no API or stored-status change

> Generated card. Edit management/tasks.json, then run this script with --write.

**Phase:** V1 | **Priority:** P1 | **Status:** REVIEW

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
  "escalation": "Triage the failure; at most 2 repair attempts, then explicit review. No automatic spending authorization. No live door, key, lock or device action without the owner's explicit, task-specific approval."
}
```

## Acceptance
- **R336 / AT352:** Service management 2.5.6: the part wait is a sub-state of 'in progress' in the status strip, chips and menus, with a toggle (staff and vendor); API and stored status unchanged; fakes only (integ/256).

## Deliverables
- Implementation and regression tests on pilot/FIX-status-substate-256
- Acceptance evidence tied to commit and environment

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.
