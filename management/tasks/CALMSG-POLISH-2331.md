# CALMSG-POLISH-2331 — Calendars and messaging settings polish

> Generated card. Edit management/tasks.json, then run this script with --write.

**Phase:** V1 | **Priority:** P2 | **Status:** DONE

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
- **R-CALMSG-POLISH-2331-1 / AT-CALMSG-POLISH-2331-1:** Calendar, calendar connections and messaging channel settings have no cut-off rows, behaviour settings are grouped by topic and card actions sit at the foot of each card.

## Deliverables
- Change record docs/changes/CALMSG-POLISH-2331.md

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.
