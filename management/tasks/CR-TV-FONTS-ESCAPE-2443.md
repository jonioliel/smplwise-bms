# CR-TV-FONTS-ESCAPE-2443 — CR-TV-FONTS-ESCAPE-2443 - TV board: escape every feed value (08:F05), lobby fonts per style family (08:F04)

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
- **R-CR-TV-FONTS-ESCAPE-2443-1 / AT-CR-TV-FONTS-ESCAPE-2443-1:** Delivered as recorded in docs/changes/CR-TV-FONTS-ESCAPE-2443.md: TV board: escape every feed value (08:F05), lobby fonts per style family (08:F04)

## Deliverables
- Change note docs/changes/CR-TV-FONTS-ESCAPE-2443.md and the code it records

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.
