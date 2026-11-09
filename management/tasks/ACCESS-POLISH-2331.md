# ACCESS-POLISH-2331 — People and access administration polish (wave 1)

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
- **R-ACCESS-POLISH-2331-1 / AT-ACCESS-POLISH-2331-1:** User and group drawers are side panels (a bottom sheet on a phone), deny rules are marked in the tables and loading, error and empty states are consistent.

## Deliverables
- Change record docs/changes/ACCESS-POLISH-2331.md

## Guardrails
Read AGENTS.md and the linked master chapters. Inspect legacy code before replacement. No production configuration writes, physical commands, spending, or claims of passing unrun tests. Record commit, environment, commands and evidence.
