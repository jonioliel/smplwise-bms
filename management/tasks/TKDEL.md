# TKDEL — Service management 2.5.2: full deletion of a ticket by a manager (tickets.delete, single + bulk) and self-add of tickets.all_departments holders as department members / managers

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
- **R333 / AT349:** Service management 2.5.2: full deletion of a ticket by a manager (tickets.delete, single + bulk) and self-add of tickets.all_departments holders as department members / managers: fakes only (integ/252); no live send.

## Deliverables
- Implementation and regression tests on pilot/TICKETS-delete and pilot/TICKETS-handlers-selfadd
- Acceptance evidence tied to commit and environment

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.
