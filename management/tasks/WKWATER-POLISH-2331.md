# WKWATER-POLISH-2331 — WisKey stations and water pages polish (wave 3)

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
- **R-WKWATER-POLISH-2331-1 / AT-WKWATER-POLISH-2331-1:** The stations screen fits the window on a desktop, the water pages take the height under the tabs and the chart follows its box width.

## Deliverables
- Change record docs/changes/WKWATER-POLISH-2331.md

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.
