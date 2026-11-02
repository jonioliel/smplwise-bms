# MULTIBUILDING-HOME-2330 — Multi-building home: site level, building cards, building switch, shared building

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
  "escalation": "Triage the failure; at most 2 repair attempts, then explicit review. No automatic spending authorization."
}
```

## Acceptance
- **R-MULTIBUILDING-HOME-2330-1 / AT-MULTIBUILDING-HOME-2330-1:** On an installation of several buildings the home screen gets a site level (a card per building with counters and alerts, a grouped tree, a building switch, turn-off per building or for the site); a building can be marked as the shared building and is left unchecked by "turn off the whole site" (migration 0188; off until switched on).

## Deliverables
- Change record docs/changes/MULTIBUILDING-HOME-2330.md

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.
