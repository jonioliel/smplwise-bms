# TICKETS-1440-COLUMN-SETTING-2360 — Tickets table: which column the default table keeps at a medium width

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
- **R-TICKETS-1440-COLUMN-SETTING-2360-1 / AT-TICKETS-1440-COLUMN-SETTING-2360-1:** A tickets setting (ui.table_mid_width) chooses whether the default table keeps the sentence column (default) or the department column at about 1440 px; the other stays in the column chooser and a viewer's own choice wins.

## Deliverables
- Change record docs/changes/TICKETS-1440-COLUMN-SETTING-2360.md

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.
