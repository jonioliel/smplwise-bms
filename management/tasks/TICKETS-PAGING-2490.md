# TICKETS-PAGING-2490 — Tickets table paging; case details stay a scrolling document

> Generated card. Edit management/tasks.json, then run this script with --write.

**Phase:** V1 | **Priority:** P2 | **Status:** IN_PROGRESS

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
- **R-TICKETS-PAGING-2490-1 / AT-TICKETS-PAGING-2490-1:** Tickets table paging; case details stay a scrolling document: the tickets table pages instead of scrolling; the case details window stays a scrolling document (permitted scroll); no urgency while the tickets module is off.

## Deliverables
- Branch pilot/TICKETS-PAGING-2490, change note docs/changes/TICKETS-PAGING-2490.md, tests

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.
