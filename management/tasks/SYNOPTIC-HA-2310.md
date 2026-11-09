# SYNOPTIC-HA-2310 — Synoptic map and building cross-section read every home-system floor; floor mapping editor

> Generated card. Edit management/tasks.json, then run this script with --write.

**Phase:** V1 | **Priority:** P1 | **Status:** DONE

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
- **R-SYNOPTIC-HA-2310-1 / AT-SYNOPTIC-HA-2310-1:** The synoptic map and the building cross-section read every floor of the home system: floors match by level on a one-building site, and a floor link editor links floors and adds or removes areas by hand (migration 0187).

## Deliverables
- Change record docs/changes/SYNOPTIC-HA-2310.md

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.
