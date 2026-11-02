# TICKETS-POLISH-2331 — Service requests: one compact toolbar for the list and the manager board

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
- **R-TICKETS-POLISH-2331-1 / AT-TICKETS-POLISH-2331-1:** The request list and the manager board share one compact toolbar with one Filter panel, removable chips, the view switch and "new" on the title row.

## Deliverables
- Change record docs/changes/TICKETS-POLISH-2331.md

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.
