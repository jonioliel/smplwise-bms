# BUILDING-SCOPE-CONTROL-2351 — "Show and control" per building on a multi-building site

> Generated card. Edit management/tasks.json, then run this script with --write.

**Phase:** V1 | **Priority:** P1 | **Status:** IN_PROGRESS

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
- **R-BUILDING-SCOPE-CONTROL-2351-1 / AT-BUILDING-SCOPE-CONTROL-2351-1:** With the multi-building view on, the counters panel, floor and area turn-off actions, the floor lights pop-up and every single device control act only on the building shown, and the server refuses a request for another building's device; a setting chooses whether building permission follows the mapping or the map position.

## Deliverables
- Change record docs/changes/BUILDING-SCOPE-CONTROL-2351.md

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.
