# POLISH4-WP3-SERVICE-2370 — Polish round 4, WP3: the service area

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
- **R-POLISH4-WP3-SERVICE-2370-1 / AT-POLISH4-WP3-SERVICE-2370-1:** The ticket full screen, handlers, vendor accounts, tickets overview and maintenance pages are polished (defects D3-D6 fixed, D27 and D29 verified).

## Deliverables
- Change record docs/changes/POLISH4-WP3-SERVICE-2370.md

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.
