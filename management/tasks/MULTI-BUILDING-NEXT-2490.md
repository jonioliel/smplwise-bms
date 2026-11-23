# MULTI-BUILDING-NEXT-2490 — Multi-building next phase (safety first, then the home interface, then filtering and lobby)

> Generated card. Edit management/tasks.json, then run this script with --write.

**Phase:** V1 | **Priority:** P2 | **Status:** BACKLOG

**Owner role:** engineering | **Hardware:** False

**Dependencies:** MULTIBUILDING-HOME-2330

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
- **R-MULTI-BUILDING-NEXT-2490-1 / AT-MULTI-BUILDING-NEXT-2490-1:** Multi-building next phase (safety first, then the home interface, then filtering and lobby): floor move between buildings, a check before multi-building is switched on, the building selector of the home interface and the lobby screen follow the owner decisions; safety first.

## Deliverables
- change note docs/changes/MULTI-BUILDING-NEXT-2490.md, tests

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.
